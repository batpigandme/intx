# V8 TurboFan Constant Inlining & Engine Mechanics: Lessons Learned & Technical Digest

> A consolidated reference of architectural findings, JIT optimization barriers, subtle traps, historical design rationales, and multi-version V8 mechanics discovered during extended-precision integer arithmetic (`intx`) optimization.

---

## 1. The Root Cause of the "Keyword Matters" Mixup

### The `.js` + `"type": "module"` Trap
During initial benchmarking, a test using `let MASK = 0xFFFF` appeared to fail constant inlining in CommonJS, emitting a bloated 424-byte function with dynamic heap lookups (`andl r8, rcx`).

**What actually happened:**
* The parent `package.json` had `"type": "module"`.
* When a test file was named with a generic `.js` extension (e.g., `let-test.js`), Node.js executed it as **native ESM**, not CommonJS.
* In ESM, top-level `let` creates a mutable `ModuleContext` slot, which forces TurboFan to emit dynamic heap loads.
* Because the file extension was `.js`, it was mistakenly attributed as a CommonJS test failure.

### The True Rule Across Module Systems
1. **In CommonJS (`.cjs`)**: The keyword **DOES NOT MATTER**.
   Node.js wraps `.cjs` files in an invisible function closure:
   ```javascript
   (function(exports, require, module, __filename, __dirname) {
     let MASK = 0xFFFF; // Function-local lexical variable!
     function mask(x) { return x & MASK; }
   });
   ```
   Because `MASK` is local to Node's wrapper function and never reassigned, V8's SSA (Static Single Assignment) analysis proves it is immutable. **`const`, `var`, and `let` all inline identically into `movzxwl rdx, rdx` (136 bytes).**

2. **In ECMAScript Modules (`.mjs`)**: The keyword **DOES MATTER**.
   * `top-level const MASK = 0xFFFF;` $\rightarrow$ **YES (Inlined)** (`movzxwl` / 136 B).
   * `top-level var MASK = 0xFFFF;` $\rightarrow$ **NO (Dynamic Load)** (`andl rdx, rdi` / 176 B).
   * `top-level let MASK = 0xFFFF;` $\rightarrow$ **NO (Dynamic Load)** (`andl rdx, rdi` / 256 B).

> [!IMPORTANT]
> **Lesson**: Never rely on `.js` file extensions when benchmarking engine-level module mechanics. Always use hardcoded `.cjs` and `.mjs` extensions to guarantee explicit execution context.

---

## 2. ESM Live Bindings & The 1-Line Re-binding Fix

### The Specification Constraint (ECMA-262)
Under the ECMAScript specification, all ESM imports are **live bindings** residing in a shared `Module Environment Record`. Because an exporting module could theoretically mutate bindings (`export let`), or circular dependencies/asynchronous imports could defer initialization, V8 treats imported bindings dynamically as heap `Cell` references:

```assembly
; Direct ESM import: import { MASK } from './constants.mjs';
movq rcx, [cell + 0x7]     ; Chasing heap pointer from ModuleContext slot
andl rdx, rdi              ; Register-to-register AND (no immediate operand)
```

### The 1-Line Fix
Re-assigning the imported identifier to a module-local `const` gives TurboFan the static immutability guarantee it needs:

```javascript
import { MASK as _MASK } from './constants.mjs';
const MASK = _MASK; // Re-bind to local lexical const

function mask(x) {
  return x & MASK; // -> 100% Hardware Inlined! (movzxwl rdx, rdx / 136 B)
}
```

---

## 3. CommonJS `require(esm)` Interop & The `.default` Trap

When a CommonJS module requires an ES Module (`.mjs`):
1. `require('./constants/default.mjs')` returns the **ES Module Namespace Object**:
   ```javascript
   const mod = require('./default.mjs');
   // Output: [Module: null prototype] { __esModule: true, default: 65535 }
   ```
2. **The Silent Coercion Bug**:
   If `.default` is omitted:
   ```javascript
   var MASK = require('./default.mjs'); // MASK is [Module: null prototype]
   function mask(x) {
     return x & MASK; // Silently executes: ToInt32("[object Object]") -> NaN -> 0
   }
   ```
   This does **not** throw an error at runtime; it silently returns `0`, creating insidious silent bugs in arithmetic code.
3. **Correct Usage**:
   ```javascript
   const MASK = require('./default.mjs').default;
   // OR
   const { default: MASK } = require('./default.mjs');
   ```

---

## 4. Hardware Instruction Selection: Zero-Extension vs. Arbitrary Immediate

TurboFan chooses different native CPU instruction strategies based on the bit pattern of the constant:

### A. Power-of-2 / Byte & Word Boundaries (`0xFF`, `0xFFFF`)
* **8-bit (`0xFF`)**: Emits **`movzxbl rdx, rdx`** (x86_64) or **`uxtb`** (ARM64).
* **16-bit (`0xFFFF`)**: Emits **`movzxwl rdx, rdx`** (x86_64) or **`uxth`** (ARM64).
* **Instruction properties**: 3 bytes long in machine code (`0f b7 d2`). On modern Out-of-Order CPU cores (Intel Skylake+, AMD Zen+, Apple Silicon), register-to-register `movzx` is eliminated at **zero latency** via the CPU's register renaming unit.

### B. Arbitrary Bitmasks (`0x1234`, `0xDEADBEEF`)
* **Arbitrary 16-bit (`0x1234`)**: Emits **`andl rdx, 0x1234`** (6-byte immediate instruction / 140-byte compiled function).
* **Arbitrary 32-bit (`0xDEADBEEF`)**: Emits **`andl rdx, 0xdeadbeef`** (or `and w0, w0, #0xdeadbeef` on ARM64).

### C. The Signed Smi Dilemma (`0xDEADBEEF` Machine Code Bloat)
1. **Why Smis are Signed**:
   * A 32-bit slot can represent $2^{32} = 4.29$ billion values.
   * Representing negative integers (loop counters, subtractions) and positive numbers up to $4.29$ billion requires 33 bits.
   * All standard ECMAScript bitwise ops (`|`, `&`, `^`, `<<`, `>>`) return `ToInt32` (Signed 32-bit). Only `>>>` returns `ToUint32`.
2. **The HeapNumber Penalty**:
   * `0xDEADBEEF >>> 0` ($+3,735,928,559$) exceeds $+2^{31}-1$, forcing V8 to allocate a boxed `HeapNumber` (Float64).
   * TurboFan emits a **~92-byte fallback path** (`vmovsd`, `vcvttsd2siq`, `call DoubleToI`), ballooning compiled function size to **232 bytes**.
3. **The Smi Optimization**:
   * Writing `0xDEADBEEF | 0` ($-559,038,737$) fits in signed 31-bit/32-bit two's complement, remaining an unboxed Smi and shrinking compiled size from 232 B to **140 B**.

---

## 5. Multi-Version V8 / Node.js Engine Evolution

Testing across all major Node.js releases (`v18.20.8` through `v25.9.0`) revealed:

| Node Version | V8 Version | Inlining Parity (52 Cases) | Inlined Instruction | Inlined Size | Dynamic Load Instruction | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **v18.20.8** | `10.2.154` | **100% Identical** | `movzxwl rdx, rdx` | 148 B | `andl rdx, rcx` | `require(esm)` unsupported in Node 18 runtime. |
| **v20.20.2** | `11.3.244` | **100% Identical** | `movzxwl rdx, rdx` | 144 B | `andl rdx, rcx` | Full CJS $\leftrightarrow$ ESM interop parity. |
| **v22.22.1** | `12.4.254` | **100% Identical** | `movzxwl rdx, rdx` | 152 B | `andl rdx, rdi` | Shifted dynamic register allocation from `rcx` to `rdi`. |
| **v23.11.1** | `12.9.202` | **100% Identical** | `movzxwl rdx, rdx` | 152 B | `andl rdx, rdi` | Identical to v22. |
| **v24.19.0** | `13.6.233` | **100% Identical** | `movzxwl rdx, rdx` | **136 B** | `andl rdx, rdi` | **10.5% smaller** due to TurboFan prolog/epilog compaction. |
| **v25.9.0** | `14.1.146` | **100% Identical** | `movzxwl rdx, rdx` | **136 B** | `andl rdx, rdi` | Compact machine code generation maintained. |

**Key Takeaway**: The optimization barrier of ESM live bindings and the 100% effectiveness of lexical re-binding (`const MASK = _MASK`) are universal across every modern V8 release.

---

## 6. Value Representation Across JavaScript Engines

| Engine / Runtime | Value Strategy | Integer Range | Double (Float64) Storage | Pointer Compression |
| :--- | :--- | :--- | :--- | :---: |
| **Google V8 (Node.js)** | **Pointer Tagging** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | Boxed **`HeapNumber`** on heap | ❌ Disabled |
| **Google V8 (Chrome)** | **Pointer Tagging** | **31-bit Signed**<br>`[-1,073,741,824, +1,073,741,823]` | Boxed **`HeapNumber`** on heap | ✅ Enabled (4GB cage) |
| **Safari (JavaScriptCore)** | **NaN-Boxing (`JSValue`)** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | **Unboxed Double** (in NaN payload) | ❌ N/A (64-bit value) |
| **Firefox (SpiderMonkey)** | **Punned NaN-Boxing** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | **Unboxed Double** (in NaN payload) | ❌ N/A (64-bit value) |

### Why V8 Uses Pointer Tagging Instead of NaN-Boxing
1. **32-bit Heritage**: In 2008, 32-bit x86 pointers were 4 bytes. NaN-boxing requires 8 bytes (64 bits), which would have doubled memory usage on 32-bit systems.
2. **Pointer Compression**: In 64-bit Chrome, V8 confines heaps to a 4GB virtual cage, halving pointers and Smis to 32 bits. NaN-boxing cannot physically compress below 64 bits.
3. **Zero-Cost Pointer Dereferencing**: In V8, tagged pointer dereferencing is `mov rax, [rdi - 1]` (0-cycle base-displacement addressing). In NaN-boxing, pointer tags must be masked out (`and rax, 0x00007FFFFFFFFFFF`).

---

## 7. Git Architecture for Nested Standalone Repositories

When extracting a sub-project (like `constinlin`) from a parent monorepo:
1. **Unstage from Parent Cache**: `git rm -r --cached constinlin` (preserves local disk files).
2. **Ignore in Parent**: Add `constinlin/` to parent `.gitignore`.
3. **Initialize Standalone Child**:
   ```bash
   cd constinlin
   git init -b main
   git remote add origin git@github.com:impawstarlight/constinlin.git
   git push -u origin main
   ```
4. **Self-Containment Rule**: Ensure no relative markdown links point outside the child repository (`../integer-notes.md`), ensuring zero broken links when viewed on GitHub.
