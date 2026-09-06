# 00. Chronicle of the intx Journey: The Flow of Discovery

> *"Optimization without rigorous measurement is speculation. Benchmarking without compiler insight is superstition."*

This chapter chronicles the chronological sequence of experiments, breakthroughs, compiler investigations, and architectural decisions that took place during the research and engineering of wide integer arithmetic in `intx`.

---

## 1. Phase 1: The Baseline & The stdlib Comparison

The investigation began with a simple question: **What is the fastest way to multiply two 32-bit unsigned integers into an exact 64-bit wide result $[hi, lo]$ in pure JavaScript?**

Historically, developers relied on packages like `@stdlib/number-uint32-base-muldw`, which implements a textbook 16-bit limb split:

```javascript
// stdlib/muldw.assign (Strided reference implementation)
function muldw(a, b, out, stride, offset) {
  const u1 = a >>> 0;
  const u2 = b >>> 0;
  const u = (u1 & 0xffff) * (u2 & 0xffff);
  const w = (u1 >>> 16) * (u2 & 0xffff) + (u >>> 16);
  const x = (u1 & 0xffff) * (u2 >>> 16) + (w & 0xffff);
  out[offset] = ((u1 >>> 16) * (u2 >>> 16) + (w >>> 16) + (x >>> 16)) >>> 0;
  out[offset + stride] = ((u & 0xffff) | (x << 16)) >>> 0;
  return out;
}
```

While correct, early benchmarks showed that this baseline executed at **~145 Mops/s** in Node.js / V8. Preliminary handwritten limb-splitting prototypes (`split16x2allimul`) suggested throughput could reach **~350–370 Mops/s**—more than double the standard library's speed.

However, when multiple algorithmic prototypes were run consecutively in a single benchmark file, strange performance anomalies began to surface.

---

## 2. Phase 2: The Mystery of the 8x Performance Drop

When a candidate algorithm was benchmarked in an isolated script, it consistently clocked **~370 Mops/s**. But when 10 different candidates were placed into a standard array and executed sequentially:

```javascript
// ❌ Naive benchmark loop with shared runner template
const runnerTemplate = (fn) => new Function('fn', 'r', `
  return function bench(n) {
    for (let i = 0; i < n; i++) fn(r[1], 0xdeadbeef, r);
  }
`)(fn, new Uint32Array(2));

for (const candidate of candidates) {
  const run = runnerTemplate(candidate.fn);
  run(50000000); // 1st candidate: 370 Mops/s, 4th candidate: 45 Mops/s!
}
```

The 3rd and subsequent candidates suffered an inexplicable **8x performance collapse (~45 Mops/s)**!

### Uncovering the Root Cause: V8's Compilation Cache & Megamorphism
Using V8 diagnostic flags (`--trace-ic`, `--trace-opt`, `--trace-deopt`), we uncovered a critical compiler artifact:
1. V8 caches compiled bytecode and machine code for `new Function(...)` strings in a global **`CompilationCache`**.
2. Because the source text of `runnerTemplate` was identical for all candidates, V8 reused the *same* underlying compiled function object and shared its internal **`FeedbackVector`**.
3. Passing Candidate 1 initialized the feedback slot to **Monomorphic** (1 target).
4. Passing Candidate 2 modified the slot to **Polymorphic** (2 targets).
5. Passing Candidate 3 and beyond overflowed the slot capacity ($> 4$ targets), turning the call site **Megamorphic**.
6. In megamorphic state, TurboFan permanently **disabled function inlining**, forcing every single iteration in the 50-million-loop benchmark to go through a dynamic C++ runtime indirect call trampoline.

---

## 3. Phase 3: The Birth of BenchX

To solve this compilation cache pollution and eliminate repetitive benchmark boilerplate across dozens of files, we engineered **BenchX** ([`benchx/lib.js`](../../benchx/lib.js)).

### Core Innovations in BenchX:
1. **Deduplicated Benchmark Infrastructure**: A unified, fluent `BenchXSuite` API (`.add(name, fn)`) that standardizes warmup tier-up, sample collection, statistical reduction, and tabular formatting.
2. **Monomorphic JIT Isolation**: Every runner is instantiated with a unique string header:
   ```javascript
   /* [BenchX Monomorphic Compilation Unit: ${cleanName}_${Date.now()}_${Math.random()}] */
   ```
   This forces V8's `CompilationCache` to treat every candidate as a completely separate compilation unit with its own private FeedbackVector, guaranteeing 100% monomorphic inlining.
3. **Round-Robin Interleaved Execution**: Rather than running Candidate 1 for 5 rounds and then Candidate 2 for 5 rounds, BenchX samples each candidate sequentially in round-robin fashion per round. This normalizes the effect of **CPU thermal throttling and Intel Turbo Boost frequency decay** across all candidates.
4. **Statistical Rigor**: BenchX calculates min, max, median, mean, standard deviation, and Margin of Error (MoE %) across multiple rounds.

---

## 4. Phase 4: Taxonomy Evolution & Systematic Naming

Early prototypes had arbitrary, confusing filenames (`split16x2`, `split16x2ais`, `f64`, `bitwise-pipe`). To understand the exact source of performance gains, we established a clear, 5-family taxonomy and structured the candidate directory (`src/u32/wmul/candidates/`):

1. **`limb16-parallel`**: 4 independent partial products with multi-column carry assembly.
2. **`limb16-pipeline`**: 3-stage sequential carry forwarding minimizing register pressure.
3. **`limb16-float48`**: Asymmetric 16x32 split fitting $< 2^{48}$ products in exact 53-bit float mantissas.
4. **`float64-corrected`**: Double-precision floating point product with analytical residual scaling.
5. **`bigint`**: Native ES2020 BigInt operations (reference oracle and escape analysis study).

For each family, we methodically varied the low-word extraction (`bitwise-lo`, `imul-lo`, `imul-all`, `imul-cached`) to isolate the exact impact of `Math.imul` at every stage.

---

## 5. Phase 5: The BigInt Escape Analysis Experiment

We hypothesized: *If a BigInt computation takes 32-bit integers in and extracts 32-bit integers out without leaking BigInt references outside the function, can V8's TurboFan escape-analyze the operations into unboxed 64-bit CPU registers (`imulq`)?*

To test this, we built and profiled 7 variations:
- `bigint-literal-mask`: Naive `>> 32n` and `& 0xffffffffn` (**4.17 Mops/s**).
- `bigint-as-uint32`: Truncating `lo` via `BigInt.asUintN(32, prod)` (**4.74 Mops/s**).
- `bigint-as-uintn-literal`: Truncating the product with `BigInt.asUintN(64, ...)` (**10.53 Mops/s** — a 2.5x speedup because V8 reads the 64-bit digit directly without intermediate memory allocation).
- `bigint-as-uintn-module-const` & `local-const`: Testing scope of `const SHIFT_32 = 32n` (**10.7 Mops/s**).
- `bigint-as-uint64-imul-lo` & `bigint-hi`: Extracting `lo` via `Math.imul(a, b)` and truncating `hi` via `asUintN(32, ...)` (**17.56 Mops/s**).

**Conclusion**: TurboFan cannot eliminate BigInt heap allocations because BigInt operations cross into C++ runtime builtins, which act as opaque side-effect barriers. Unboxed integer pipelines remain **~14x faster than the fastest BigInt code**.

---

## 6. Phase 6: Function Inlining & The `limb16-imul-import` Breakthrough

We tested whether breaking `Math.imul(a, b) >>> 0` out into a dedicated user-defined module helper (`src/u32/mul/index.js`) would introduce function call overhead:

```javascript
// src/u32/mul/index.js
function mul(a, b) {
  return Math.imul(a, b) >>> 0;
}
```

In candidate `limb16-imul-import`, every multiplication called `mul(a, b)`.

**Result**: Instead of slowing down, `limb16-imul-import` became the **#1 overall winner at 242.13 Mops/s (Peak: 275.50 Mops/s)**! TurboFan's inliner inlines the single-expression leaf function with zero call-frame penalty, and the explicit unsigned shift `>>> 0` provides strong `kUint32` type feedback to the compiler.

---

## 7. Phase 7: Extending BenchX to the Browser

To verify whether these optimizations generalize across JavaScript engines, we built **BenchX Browser** ([`benchx/browser/`](../../benchx/browser/)):
- Built a zero-dependency local static server (`npm run bench:browser`).
- Ran all candidate runners in a background **Web Worker** with streaming `postMessage` telemetry, keeping the UI at 60 FPS.
- Confirmed that `Math.imul` and pipelined limb splitting dominate across Google Chrome (V8), Mozilla Firefox (SpiderMonkey), and Apple Safari (JavaScriptCore).

---

## 8. Summary of Findings

| Metric | stdlib Baseline | Naive BigInt | Optim BigInt (`asUint64`) | `float64-corrected` | `limb16-pipeline` (Winner) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Median Ops/sec** | 148 Mops/s | 4.17 Mops/s | 17.56 Mops/s | 220 Mops/s | **242.13 Mops/s** |
| **Throughput vs BigInt** | 35.5x | 1.0x (baseline) | 4.2x | 52.8x | **58.1x** |
| **Heap Allocations** | 0 bytes | 4 objects / op | 2 objects / op | 0 bytes | **0 bytes** |
| **CPU Execution Domain** | Integer GPR | V8 C++ Heap | V8 C++ Heap | FPU (XMM) | **Integer GPR** |

In the following chapters, we dive deep into the V8 memory architecture, TurboFan assembly lowering, algorithmic blueprints, and the complete systems codex for extended-precision arithmetic.
