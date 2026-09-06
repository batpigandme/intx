# 05. The V8 Systems Programmer's Codex

> *"Rules, Patterns, Anti-Patterns, and Practical Mandates for Achieving Bare-Metal Execution Speeds in JavaScript."*

---

## 5.1 The 12 Golden Commandments of V8 Integer Optimization

### I. Thou Shalt Use `Math.imul` for All 32-bit Multiplications
Never use `a * b` when computing 32-bit integer products. `Math.imul(a, b)` maps directly to a 1-cycle x86 `imull` instruction, preventing speculative promotion to floating-point numbers.

### II. Thou Shalt Apply Explicit Unsigned Truncation (`>>> 0`)
Always terminate unsigned 32-bit arithmetic with `>>> 0`. This provides unambiguous `kUint32` type feedback to TurboFan, allowing the compiler to optimize out sign-extension and range-check guards.

### III. Thou Shalt Never Allocate Objects in Hot Loops
Do not return `[hi, lo]` arrays or `{ hi, lo }` objects from arithmetic kernels. Adhere strictly to the **Zero-Allocation Procedural Contract**: pass a pre-allocated destination buffer (`out`) and mutate limbs in place (`out[0] = hi; out[1] = lo;`).

### IV. Thou Shalt Pipeline Carry Chains to Reduce Register Pressure
Avoid wide fan-in calculations with 6+ live intermediate variables. Organize carry forwarding into sequential stages ($ll \to hl \to lh \to hh$) so TurboFan's Linear Scan register allocator can recycle physical CPU registers without spilling to the stack.

### V. Thou Shalt Not Rely on BigInt Escape Analysis for Local Ints
Do not use `BigInt` for performance-critical inner loops under the assumption that TurboFan will unbox them into 64-bit CPU registers. BigInts cross C++ runtime builtins and remain boxed heap objects.

### VI. Thou Shalt Prefer Double-Precision Float Correction for Simplicity
When implementing wide multiplication without bitwise limb decomposition, `float64-corrected` ($u \cdot v - lo$) achieves 91% of peak integer speed with only 3 lines of code.

### VII. Thou Shalt Keep Functions Small and Monomorphic for Inlining
Leaf helper functions (like `mul(a, b) { return Math.imul(a, b) >>> 0; }`) with small bytecode footprints ($< 60$ bytes) inline with **zero function call overhead**.

### VIII. Thou Shalt Avoid Frequent Float $\leftrightarrow$ Integer Domain Switching
Do not interleave double-precision float operations with 16-bit bitwise shifts in tight loops. Each transition incurs an expensive `cvttsd2si` or `movd` domain crossing instruction between XMM and GPR registers.

### IX. Thou Shalt Use TypedArrays for Contiguous Memory Windows
Store multi-word integers in flat `Uint32Array` buffers. TypedArrays compile to direct base-plus-offset indexed memory loads (`movl (%rdi, %rax, 4), %ecx`) without object property lookup overhead.

### X. Thou Shalt Isolate Dynamic Benchmark Units to Prevent Megamorphism
When creating benchmark harnesses with `new Function(...)`, inject unique timestamp and salt comments into the code string to guarantee pristine, monomorphic Inline Caches for every candidate.

### XI. Thou Shalt Sample Benchmarks Interleaved in Round-Robin Fashion
Never benchmark candidates sequentially. Interleave candidate sampling per round to distribute CPU thermal throttling and dynamic clock adjustments evenly across all implementations.

### XII. Thou Shalt Not Call `global.gc()` in Zero-Allocation Loops
Avoid synchronous GC calls before zero-allocation benchmark measurements. Synchronous GC triggers asynchronous concurrent background sweeping threads that inject $\pm 120\%$ timing jitter into your measurements.

---

## 5.2 The Optimization Anti-Pattern vs Pattern Matrix

```
+------------------------------------+------------------------------------+
| ❌ Anti-Pattern (Slow)             | ✅ High-Performance Pattern (Fast)  |
+------------------------------------+------------------------------------+
| function wmul(a, b) {              | function wmul(a, b, out) {         |
|   return [hi, lo]; // Heap alloc!  |   out[0] = hi; out[1] = lo;        |
| }                                  | }                                  |
+------------------------------------+------------------------------------+
| const lo = (a * b) & 0xffffffff;   | const lo = Math.imul(a, b) >>> 0;  |
| // Promotes to double float!       | // 1-cycle x86 imull instruction!  |
+------------------------------------+------------------------------------+
| const prod = BigInt(a) * BigInt(b);| const al = a & 0xffff, ah = a >>> 16|
| const hi = Number(prod >> 32n);    | // Unboxed 16-bit limb pipeline in |
| // 120 bytes allocated on heap!    | // CPU general-purpose registers!  |
+------------------------------------+------------------------------------+
| const mid = Math.floor(p0 / 65536);| const mid = p0 >>> 16;             |
| // Float division is 14-20 cycles! | // Hardware bit-shift is 1 cycle!  |
+------------------------------------+------------------------------------+
```

---

## 5.3 Quick-Reference Integer Kernel Implementations

### Wide Multiplication ($32 \times 32 \to 64$-bit $[hi, lo]$):
```javascript
function wmul(a, b, out) {
  a >>>= 0; b >>>= 0;
  const ah = a >>> 16, al = a & 0xffff;
  const bh = b >>> 16, bl = b & 0xffff;

  const albl = Math.imul(al, bl) >>> 0;
  const llh = albl >>> 16;

  const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
  const hll = ahbl & 0xffff;
  const hlh = ahbl >>> 16;

  const albh = (Math.imul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}
```

### 64-Bit Multiplication ($64 \times 64 \to 64$-bit):
```javascript
function mul64(a0, a1, b0, b1, out) {
  wmul(a1, b1, out);
  out[0] = (out[0] + Math.imul(a0, b1) + Math.imul(a1, b0)) >>> 0;
  return out;
}
```

### Branch-Free 64-Bit Addition with Carry:
```javascript
function add64(a0, a1, b0, b1, out) {
  const lo = (a1 + b1) >>> 0;
  const carry = (lo < (a1 >>> 0)) ? 1 : 0;
  out[0] = (a0 + b0 + carry) >>> 0;
  out[1] = lo;
  return out;
}
```

---

## 5.4 Concluding Epilogue

Writing high-performance systems code in JavaScript is not about fighting the runtime; it is about **aligning your algorithms with the compiler's optimization model**.

By respecting V8's type specialization tiers, keeping intermediate calculations in unboxed CPU registers, and designing zero-allocation procedural APIs, pure JavaScript can execute arithmetic at **hundreds of millions of operations per second**, delivering bare-metal speed with universal portability.
