# Chapter 3: Under the Hood: V8 TurboFan, Machine Lowering & Compiler Mechanics

To understand why performance spans from **4.17 Mops/s** (`bigint-literal-mask`) to **242.13 Mops/s** (`limb16-imul-import`) across algorithms that compute the exact same mathematical value, we must examine how JavaScript engines—specifically Google V8's **Ignition** bytecode interpreter and **TurboFan** optimizing compiler—lower high-level JavaScript AST nodes to machine instructions.

```mermaid
graph LR
    JS["JavaScript Source"] --> Ign["Ignition Bytecode"]
    Ign --> TF["TurboFan JIT Pipeline"]
    TF --> Opt["Inlining & Escape Analysis"]
    Opt --> IR["Sea-of-Nodes IR Graph"]
    IR --> CodeGen["x86-64 / ARM64 Machine Code"]
```

---

## 3.1 Why `Math.imul` Dominates the Benchmark

In standard ECMAScript, the multiplication operator `*` is dynamically typed:
- It must handle Small Integers (Smis), Double-precision floats (HeapNumbers), and BigInts.
- In TurboFan, `*` begins with speculative type feedback. If operands exceed 31-bit signed integers, TurboFan inserts deoptimization guards and promotes values to 64-bit IEEE 754 floats (`Float64Mul`), requiring conversions between General-Purpose Registers (GPRs) and SSE/AVX registers (`xmm0`).

In contrast, `Math.imul(a, b)` has a rigid ECMAScript semantic contract:
- It coerces both arguments to 32-bit signed integers: $a_{32} = \text{ToInt32}(a)$, $b_{32} = \text{ToInt32}(b)$.
- It computes $(a_{32} \times b_{32}) \pmod{2^{32}}$ in 32-bit signed two's complement integer space.

### TurboFan Lowering
TurboFan recognizes `Math.imul` as a native intrinsic. In the **Simplified Operator Lowering** phase, it translates `Math.imul` directly into an **`Int32Mul`** IR node:

```
[TurboFan IR Graph]
  n12: Parameter[1] (a)
  n13: Parameter[2] (b)
  n14: Word32And(n12, 0xFFFF)
  n15: Word32And(n13, 0xFFFF)
  n16: Int32Mul(n14, n15)  ---> [x86-64 CodeGen] ---> imull %edx, %eax
```

On modern x86-64 microarchitectures (Intel Raptor Lake / AMD Zen 4), `imull` executes on integer execution ports (ALU 0/1) with:
- **Latency**: 3 cycles
- **Throughput**: 1 instruction per cycle (reciprocal throughput: 1.0)
- **Zero FPU Domain Penalty**: Operands remain entirely within 32-bit CPU registers (`eax`, `edx`, `ecx`).

---

## 3.2 The BigInt Escape Analysis Wall

A common question among systems engineers is:
> *"Since we are passing 32-bit integers in and returning 32-bit integers out, why can't TurboFan's Escape Analysis eliminate the BigInt allocations and lower `BigInt(a) * BigInt(b)` directly to a 64-bit hardware instruction like `imulq` or `mulq`?"*

### The Theoretical Hypothesis
In C, C++, or Rust:
```c
uint64_t wmul(uint32_t a, uint32_t b) {
    return (uint64_t)a * (uint64_t)b; // Lowers to single 'mulx' or 'imulq'
}
```

### The V8 Reality
In V8, `BigInt` values are full-fledged JavaScript heap objects. A BigInt object header consists of:
1. `Map` pointer (8 bytes on 64-bit platforms).
2. Bitfield header indicating digit length and sign bit (8 bytes).
3. Flexible inline array of 64-bit digits.

```
+------------------+------------------+--------------------------+
| Map Word (8B)    | Bitfield (8B)    | Digit 0 (uint64_t) (8B)  |
+------------------+------------------+--------------------------+
```

When executing `BigInt(a) * BigInt(b)`:
1. `BigInt(a >>> 0)` allocates a 24-byte BigInt heap object in the Young Generation (NewSpace).
2. `BigInt(b >>> 0)` allocates a second 24-byte BigInt heap object.
3. The multiplication operator `*` calls the C++ runtime stub `BigIntMultiply()`, which allocates a third 24-byte result object.
4. The shift `prod >> 32n` calls `BigIntShiftRight()`, allocating a fourth object.
5. The cast `Number(...)` reads the digit and frees or leaves the objects for garbage collection.

### Why Escape Analysis Fails for BigInt
TurboFan's **Escape Analysis** pass operates on `JSCreate` and `StoreField` nodes for standard JavaScript objects where object fields are known at compile time. However:
- BigInt runtime operations are implemented via **C++ runtime builtins** (`Builtin::kBigIntMultiply`, `Builtin::kBigIntShiftRight`).
- Calls across the JavaScript-to-C++ builtin boundary act as **opaque side-effect barriers**.
- TurboFan cannot prove that the intermediate BigInt digits do not escape, forcing physical heap allocation for every temporary arithmetic operation.

### Why `BigInt.asUintN(64)` Yields a 2.5x Speedup
When using `BigInt.asUintN(64, ...)`, V8's fast-path stub detects that the result fits within a single 64-bit digit word, reading the digit directly without invoking arbitrary-precision digit reallocation loops:
- `bigint-literal-mask`: **4.17 Mops/s**
- `bigint-as-uintn-literal`: **10.53 Mops/s** (2.52x faster)
- `bigint-hi` (hybrid `asUintN(32)` + `Math.imul`): **17.56 Mops/s** (4.21x faster)

Despite this optimization, heap boxing overhead leaves BigInt **13.8x slower** than pure unboxed integer pipelines (~242 Mops/s).

---

## 3.3 Function Inlining & Modular Abstractions (`limb16-imul-import`)

In candidate `limb16-imul-import`, we evaluated importing a modular helper:
```javascript
// src/u32/mul/index.js
function mul(a, b) {
  return Math.imul(a, b) >>> 0;
}
```

### TurboFan Inlining Mechanics
During the `InliningPhase`, TurboFan inspects call sites to user functions. When a function satisfies inlining heuristics:
1. **Bytecode Size**: The target function has a small bytecode footprint ($< 60$ bytes of AST).
2. **Monomorphic Call Site**: The target function FeedbackVector has only one observed target.
3. **Leaf Function**: The target contains no nested loops or try-catch blocks.

TurboFan completely eliminates the JavaScript call frame (`Call` node) and substitutes the inlined function's Sea-of-Nodes sub-graph directly into the caller. Because `mul` explicitly appends `>>> 0`, TurboFan receives strong type feedback that the result is an **Unsigned 32-bit Integer (`kUint32`)**, eliminating redundant sign-extension instructions and achieving our top throughput: **242.13 Mops/s**.

---

In [**Chapter 4: BenchX & The Science of Precision Microbenchmarking**](ch4-benchx-and-microbenchmarking.md), we explore how to measure these sub-nanosecond kernels without being deceived by JIT compiler caching artifacts and thermal throttling.
