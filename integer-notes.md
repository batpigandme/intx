# Miscellaneous V8 & JavaScript Runtime Notes

Technical notes on V8 engine internals, memory representations, pointer tagging, NaN-boxing, engine comparisons, hardware intrinsics, microbenchmarking design, and multi-precision integer architecture.

---

## Table of Contents

1. [Value Representation Across JavaScript Engines](#1-value-representation-across-javascript-engines)
2. [Deep Dive: NaN-Boxing vs. Pointer Tagging](#2-deep-dive-nan-boxing-safari--firefox-vs-pointer-tagging-v8)
3. [Why JavaScript Was Designed with Only One Number (Float64)](#3-why-javascript-was-designed-with-only-one-number-float64)
4. [The Signed Smi Dilemma & 0xDEADBEEF](#4-the-signed-smi-dilemma--0xdeadbeef)
5. [Modern JavaScript Engine Performance Comparison](#5-modern-javascript-engine-performance-comparison)
6. [The JavaScript `+` / `-` Rules & The `Math.imul` Counterpart](#6-the-javascript----rules--the-mathimul-counterpart)
7. [TurboFan Hardware Bit Rotation (`rorl` / `roll`) Idiom Recognition](#7-turbofan-hardware-bit-rotation-rorl--roll-idiom-recognition)
8. [ECMAScript Operator Type Coercion Matrix](#8-ecmascript-operator-type-coercion-matrix)
9. [x86 Hardware Division Architecture & The `divmod` Algebraic Trick](#9-x86-hardware-division-architecture--the-divmod-algebraic-trick)
10. [Microbenchmarking Pitfalls: Serial Recurrence vs. L1 Buffer Walk](#10-microbenchmarking-pitfalls-serial-recurrence-vs-l1-buffer-walk)
11. [Power-of-Two Bitwise Masking & Bounds Check Elimination (BCE)](#11-power-of-two-bitwise-masking--bounds-check-elimination-bce)
12. [Empirical Performance Gap: JavaScript (V8 TurboFan) vs. Native C (GCC -O3)](#12-empirical-performance-gap-javascript-v8-turbofan-vs-native-c-gcc--o3)
13. [Widening Multi-Word Naming Conventions (`mul`, `mulhi`, `mulwide`)](#13-widening-multi-word-naming-conventions-mul-mulhi-mulwide)

---

## 1. Value Representation Across JavaScript Engines

| Engine / Runtime | Value Strategy | Integer Range | Double (Float64) Storage | Pointer Compression |
| :--- | :--- | :--- | :--- | :---: |
| **Google V8 (Node.js)** | **Pointer Tagging** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | Boxed **`HeapNumber`** on heap | ❌ Disabled |
| **Google V8 (Chrome)** | **Pointer Tagging** | **31-bit Signed**<br>`[-1,073,741,824, +1,073,741,823]` | Boxed **`HeapNumber`** on heap | ✅ Enabled (4GB cage) |
| **Safari (JavaScriptCore)** | **NaN-Boxing (`JSValue`)** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | **Unboxed Double** (in NaN payload) | ❌ N/A (64-bit value) |
| **Firefox (SpiderMonkey)** | **Punned NaN-Boxing** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | **Unboxed Double** (in NaN payload) | ❌ N/A (64-bit value) |

---

## 2. Deep Dive: NaN-Boxing (Safari & Firefox) vs. Pointer Tagging (V8)

### How NaN-Boxing Works (IEEE 754 Payload Reuse)
In a 64-bit IEEE 754 double, a **Quiet NaN** has exponent `0x7FF` and the top fraction bit set to `1`, leaving **51 unused payload bits**. 
JSC and SpiderMonkey use those unused 51 bits to encode:
- **Int32**: Stored directly in lower 32 bits with an `0xFFFE...` tag.
- **Pointers**: Stored directly with an `0xFFFF...` tag.
- **Booleans / Null / Undefined**: Encoded as specific bit patterns.
- **Doubles**: Stored raw as unboxed 64-bit floats with zero heap allocation!

### Why V8 Chose Pointer Tagging Instead
1. **32-bit Heritage (2006-2008)**: On 32-bit x86, a V8 tagged pointer took only **4 bytes (32 bits)**. NaN-boxing requires **8 bytes (64 bits)**, which would have doubled memory usage on every 32-bit computer.
2. **Pointer Compression (4-Byte Slots on 64-bit)**: In 64-bit Chrome, V8 confines heaps to a 4GB virtual cage, halving the size of object pointers and Smis to 32 bits. NaN-boxing cannot physically compress below 64 bits.
3. **Zero-Cost Pointer Dereferencing**: In V8, pointer dereference is `mov rax, [rdi - 1]` (0-cycle base-displacement addressing). In NaN-boxing, pointer tags must be masked out (`and rax, 0x00007FFFFFFFFFFF`).

---

## 3. Why JavaScript Was Designed with Only One `Number` (Float64)

- **The 10-Day Creation (May 1995)**: Brendan Eich had 10 days to build JS for non-programmer web designers. Integer division (`5 / 2 = 2` in C/Java) was considered too confusing for beginners.
- **Float64 Exact Integers**: IEEE 754 float64 can represent exact integers up to $9,007,199,254,740,991$ ($2^{53}-1$) *and* fractions (`5 / 2 = 2.5`) in one type.
- **"Don't Break the Web"**: TC39 could never change `Number` to integer division without breaking the web. Instead, specialized types were layered on later:
  - **TypedArrays (`Int32Array`, `Uint32Array`)**: WebGL & linear buffers.
  - **`BigInt` (`BigUint64Array`)**: 64-bit / arbitrary-precision integers.
  - **WebAssembly (Wasm)**: Bare-metal `i32`, `i64`, `f32`, `f64`.

---

## 4. The Signed Smi Dilemma & `0xDEADBEEF`

1. **Why Smis are Strictly Signed**:
   - A 32-bit slot can represent $2^{32} = 4.29 \times 10^9$ discrete values.
   - Representing both negative numbers (`-1`, loop decrements, subtractions) and positive numbers up to $4.29 \times 10^9$ requires **33 bits**.
   - Almost all ECMAScript operations (`|`, `&`, `^`, `<<`, `>>`) return `ToInt32` (Signed 32-bit). Only `>>>` returns `ToUint32`.
2. **The Boundary Behavior**:
   - `0xDEADBEEF >>> 0` ($+3,735,928,559$): Exceeds $+2^{31}-1$, forcing V8 to allocate a boxed `HeapNumber` (Float64).
   - `0xDEADBEEF | 0` ($-559,038,737$): Because its binary starts with `11` (`0xD`), it fits in 31-bit two's complement ($[-2^{30}, 2^{30}-1]$) as well as 32-bit Smi, avoiding heap allocation.
3. **Machine Code Bloat & Runtime Fallbacks**:
   - When a function receives `HeapNumber` (Float64) operands instead of Smis, TurboFan cannot lower the operation directly to single-cycle integer ALU instructions.
   - It must emit extensive runtime type-checking and fallback paths for each operand:
     1. **Pointer Tag Check**: `testb reg, 0x1` (checking whether the tagged value is an integer Smi or a heap object pointer).
     2. **HeapNumber Map Check**: `cmpq [r13 + 0x2c8], map` (verifying the heap object is an IEEE 754 `HeapNumber`).
     3. **Float64 Unboxing & Truncation**: `vmovsd xmm0, [reg + 0x7]` followed by `vcvttsd2siq` or a call to the `DoubleToI` runtime stub.
   - By ensuring operands are strictly coerced to Int32 (`| 0`), TurboFan's Simplified Lowering pass proves all inputs are valid 32-bit integers, completely eliminating the heap-checking scaffolding and emitting pure, single-cycle hardware instructions (`addl`, `subl`, `imull`, `idivl`).

---

## 5. Modern JavaScript Engine Performance Comparison

| Metric / Workload | Winner | Architectural Details |
| :--- | :--- | :--- |
| **DOM & UI Responsiveness (Speedometer 3.0)** | **JavaScriptCore** (Safari) | Low-overhead ICs, specialized DOM bindings on WebKit. |
| **Startup Time & CLI Tooling** | **JavaScriptCore** (Bun / Safari) | Low-Level Interpreter (**LLInt**) in handcrafted assembly; minimal warmup latency. |
| **Peak Throughput (Long-running servers)** | **Tie (V8 vs. JSC)** | V8 TurboFan and JSC FTL/B3 generate top-tier speculative assembly. |
| **WebAssembly (Wasm)** | **V8** (Chrome / Node) | Two-tier Wasm pipeline: **Liftoff** (instant baseline) + **TurboFan** (peak optimization). |
| **Memory Footprint (Large Object Graphs)** | **V8** (Chrome) | **Pointer Compression** halves pointer/Smi memory consumption in browser tabs. |

### Compilation Pipelines

```text
Google V8:
  Ignition (Interpreter) -> Sparkplug (Baseline JIT) -> Maglev (Mid-Tier SSA JIT) -> TurboFan (Optimizing JIT)

Apple JavaScriptCore:
  LLInt (Low-Level ASM Interpreter) -> Baseline JIT -> DFG (Data Flow Graph JIT) -> FTL / B3 (Bare Bones Backend)
```

---

## 6. The JavaScript `+` / `-` Rules & The `Math.imul` Counterpart

### The Exact Rules for 32-Bit Addition & Subtraction in TurboFan
Through disassembly inspection across compilation tiers, V8 handles addition in three distinct modes:

1. **Unchecked Integer Math (`a + b`)** (`int.log`):
   - TurboFan emits speculative integer `addl`, but **must guard it with `jo` (Jump on Overflow)**.
   - If the sum exceeds $[-2^{31}, 2^{31}-1]$, it triggers `deopt reason: 'overflow'`, deoptimizing back to Ignition.

2. **Outer Truncation Only (`(a + b) | 0`)** (`dblor.log`):
   - If either operand has Float64 feedback (or is a raw literal $> 2^{31}-1$ like `0x9e3779b9 = 2654435769`), TurboFan evaluates $a + b$ in Float64 (`vaddsd`) and truncates the result (`vcvttsd2siq`).
   - Latency drops by ~10-15x (~105 M ops/sec vs ~1.1 G ops/sec).

3. **Full Int32 Coercion (`((a | 0) + (b | 0)) | 0` or `a |= 0; b |= 0; return (a + b) | 0;`)** (`dbloror.log` / `hexor.log`):
   - **The exact addition counterpart of `Math.imul(a, b)`**.
   - TurboFan proves via Simplified Lowering that $\text{ToInt32}(\text{Int32}(a) + \text{Int32}(b)) \equiv \text{Word32Add}(a, b)$.
   - It emits pure **1-cycle hardware modular integer addition (`addl` / `subl`)** with **zero deopts and zero float math** (~1.1 - 1.2 G ops/sec).

---

## 7. TurboFan Hardware Bit Rotation (`rorl` / `roll`) Idiom Recognition

JavaScript has no native `Math.rol()` or `>>> <` rotate operator. However, TurboFan's `MachineOperatorReducer` has built-in idiom recognition:

### Constant Shift Amounts -> Pure 1-Instruction Hardware Rotate
When written with constant shift amounts summing to 32 ($k + (32 - k) = 32$):
```javascript
function rotl13(a) {
  return (a << 13) | (a >>> 19);
}
```
TurboFan matches `Word32Or(Word32Shl(x, 13), Word32Shr(x, 19))` and lowers it directly to a single 1-cycle x86 instruction:
```assembly
rorl rdx, 19    ; Hardware 32-bit rotate right by 19 (= rotate left by 13)!
```
Throughput: **~1.1 G ops/sec**.

### Why Variable Rotate is Slower
When written as a general function with a variable shift amount:
```javascript
function rol(a, b) {
  return (a << b) | (a >>> (32 - b));
}
```
If $b = 0$, $32 - 0 = 32$. In ECMAScript, $a \ggg 32$ masks the shift count with `32 & 31 = 0`, shifting by 0 instead of 32 (which would compute $a \mid a$).

Because of this edge case, TurboFan cannot safely lower variable `(a << b) | (a >>> (32 - b))` to a single hardware rotate instruction. It emits 4 separate instructions (`subl`, `shrl`, `shll`, `orl`), dropping throughput to **~480 M ops/sec**.

---

## 8. ECMAScript Operator Type Coercion Matrix

| Operator Category | Operators | Native ECMAScript Type | Explicit `| 0` Required? | Compiled Hardware Instruction |
| :--- | :--- | :--- | :---: | :--- |
| **Bitwise Logic** | `^`, `&`, `\|`, `~` | `ToInt32` (Signed 32-bit) | ❌ No | `xorl`, `andl`, `orl`, `notl` |
| **Bitwise Shifts** | `<<`, `>>` | `ToInt32` (Signed 32-bit) | ❌ No | `shll`, `sarl` |
| **Logical Shift** | `>>>` | `ToUint32` (Unsigned 32-bit) | ❌ No | `shrl` |
| **Hardware Multiply** | `Math.imul` | `ToInt32` (Signed 32-bit) | ❌ No | `imull` |
| **Constant Rotate** | `(a << k) \| (a >>> (32-k))` | `ToInt32` (Signed 32-bit) | ❌ No | `roll` / `rorl` |
| **Linear Arithmetic** | `+`, `-` | `Number` (Float64) | ✅ **Yes** (`((a\|0) + (b\|0))\|0`) | `addl`, `subl` |
| **Division / Modulo** | `/`, `%` | `Number` (Float64) | ✅ **Yes** (`((a\|0) / (b\|0))\|0`) | `idivl` |

---

## 9. x86 Hardware Division Architecture & The `divmod` Algebraic Trick

### Why `idivl` Produces Both Quotient and Remainder
In the x86/x86-64 ISA, integer division is hardware-coupled to fixed registers:
- **Inputs**: 64-bit dividend in `edx:eax` (sign-extended via `cdq` from `eax`) and 32-bit divisor in a general register (`ecx`).
- **Outputs**:
  - `eax` = Quotient (`a / b`)
  - `edx` = Remainder (`a % b`)

Because both results are computed simultaneously by the CPU's hardware divider unit, there is no standalone `mod` instruction on x86.

### The Register Mismatch: Why `mod` is Slower than `div` in Recurrence Loops
When chaining operations in a loop:
- **`div` (Quotient)**: The result is already in `eax`, so the next iteration runs `cdq; idivl` with zero extra moves.
- **`mod` (Remainder)**: The result is in `edx`. To prepare for the next step, the CPU must first execute `mov eax, edx` before `cdq` can run, adding a register dependency on every step.

### The `divmod` Algebraic Optimization
When both quotient and remainder are needed, computing them naively (`(a / b) | 0` and `(a % b) | 0`) forces TurboFan to emit **two separate 25-40 cycle `idivl` instructions**.

Instead, using the algebraic identity:
$$r = a - (q \times b)$$
```javascript
function divmod(a, b, out) {
  a |= 0;
  b |= 0;
  const q = (a / b) | 0;
  out[0] = q;
  out[1] = (a - Math.imul(q, b)) | 0;
}
```
Emits **1 `idivl` instruction**, followed by a **3-cycle `imul`** and **1-cycle `sub`**, boosting combined throughput by **~40%** (109.4 M ops/sec vs 77.2 M ops/sec).

---

## 10. Microbenchmarking Pitfalls: Serial Recurrence vs. L1 Buffer Walk

### Why Serial Recurrence Fails for Division & Modulo
In microbenchmarking, serial recurrence (`acc = op(acc, c)`):
- Works for `add` and `mul` because their values cycle endlessly within the 32-bit modular ring $\mathbb{Z} / 2^{32}\mathbb{Z}$.
- **Fails for `div` and `mod` because they are mathematical sinkholes**:
  - `div` quickly decays to `0` (e.g. $2147483647 / 17 / 17 \dots \to 0$), spending 99.999% of the benchmark dividing $0 / 17$.
  - `mod` immediately locks into an immutable fixed point on step 1 (because for any $k < d$, $k \pmod d = k$), spending 99.999% of the benchmark computing $8 \pmod{17}$.
- Adding inline reset logic (`acc = div(acc, d) || 0x7fffffff`) introduces branch mispredictions (a 15-20 cycle pipeline flush every 8 iterations).

### Why the L1 Buffer Walk is the Gold Standard
```javascript
acc = div(buf[idx], d);
idx = (idx + 1) & 1023;
```
1. **Diverse 32-bit Test Vectors**: Tests actual varied integer distributions (positive, negative, large, small) without mathematical collapse.
2. **Zero Branch Noise**: Eliminates artificial reset jumps and branch misprediction stalls.
3. **Zero Cache Latency**: A 1,024-element `Int32Array` is exactly 4 KB, fitting 100% inside the CPU's ultra-fast L1 data cache (0.5 ns access).
4. **Realistic Throughput**: Reflects real-world array/stream processing in bignum and cryptography libraries.

---

## 11. Power-of-Two Bitwise Masking & Bounds Check Elimination (BCE)

For any power-of-two buffer size $N = 2^k$, $x \pmod N \equiv x \ \& \ (N - 1)$.

Writing `(idx + 1) & 1023`:
1. **Zero-branch wrapping**: Replaces a conditional branch (`if (idx >= 1024) idx = 0`) with a single 1-cycle `andl` instruction.
2. **TurboFan Bounds Check Elimination (BCE)**:
   - TurboFan's Simplified Lowering proves that `idx & 1023` is strictly within $[0, 1023]$.
   - Because $1023 < \text{buf.length}$ (1024), TurboFan **completely removes runtime array bounds checks (`CheckBounds`)**, lowering the memory read to a raw 0-overhead machine instruction:
     ```nasm
     movl eax, [r12 + r15*4]   ; Direct base + index*4 load
     ```

---

## 12. Empirical Performance Gap: JavaScript (V8 TurboFan) vs. Native C (GCC -O3)

Benchmarked on Intel Core i5-8350U CPU:

| Operation / Workload | JavaScript (V8 JIT) | Native C (GCC -O3) | Ratio (C vs JS) | Root Architectural Cause |
| :--- | :--- | :--- | :--- | :--- |
| **`add` (serial `acc += c`)** | 1.07 G iters/s | 1.96 G iters/s | **1.8x faster** | 1-cycle ALU latency; C has tighter unrolled loop branches. |
| **`sub` (serial `acc -= c`)** | 1.07 G iters/s | 1.92 G iters/s | **1.8x faster** | 1-cycle ALU latency. |
| **`mul` (serial `acc *= c`)** | 625 M iters/s | 650 M iters/s | **1.04x (Tie)** | **Pure hardware multiplier latency bound** (3-cycle `imul`). |
| **`div` (serial `idivl`)** | 80 M iters/s | 167 M iters/s | **2.1x faster** | 20-30 cycle non-pipelined iterative radix divider. |
| **`rotl` (serial rotate)** | 446 M iters/s | 1.93 G iters/s | **4.3x faster** | GCC emits native 1-cycle `roll`; JS had multi-instruction fallback. |
| **4x Independent `add`** | *N/A* | 3.90 G ops/s | **3.6x faster** | Out-of-order execution saturating 4 integer ALUs per core. |
| **AVX2 256-bit SIMD `add`** | *N/A* | 39.40 G ops/s | **~37x faster** | 8 x 32-bit integer additions per vector instruction (32 ops/iter). |

---

## 13. Widening Multi-Word Naming Conventions (`mul`, `mulhi`, `mulwide`)

In multi-precision arithmetic:
- **`mul`**: Low word product ($N \times N \to N$ bits, modular ring $\mathbb{Z} / 2^N \mathbb{Z}$).
- **`mulhi`**: High word product ($N \times N \to N$ bits high).
- **`mulwide`**: Full widening product ($N \times N \to 2N$ bits, writing `[hi, lo]` to an `out` buffer).

### Why `mulwide` vs `muldw`
- **`muldw`** creates historical ambiguity: In x86/Win32 assembly, `DWORD` is strictly 32 bits (so a 64-bit or 128-bit result is a `QWORD` or `DQWORD`, not a "Double Word").
- **`mulwide`** (from compiler widening operations) unambiguously means producing double the input bit-width across all namespaces (`u32.mulwide` $\to$ 64-bit, `u64.mulwide` $\to$ 128-bit, `u128.mulwide` $\to$ 256-bit).
