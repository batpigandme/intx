# Chapter 4: BenchX & The Science of Precision Microbenchmarking

Microbenchmarking arithmetic kernels executing at hundreds of millions of operations per second is fraught with pitfalls. When evaluating 20 different candidate implementations across multiple rounds, standard naive benchmarking loops (`for (let i = 0; i < N; i++) fn()`) produce wildly inaccurate results due to **JIT compiler caching, Inline Cache (IC) pollution, and CPU dynamic frequency scaling**.

To solve these challenges, we created **BenchX** ([`benchx/lib.js`](../../benchx/lib.js)), an open-source statistical benchmarking harness built specifically for JavaScript JIT engines.

---

## 4.1 The Genesis of BenchX: Eliminating Code Duplication

Before BenchX, evaluating dozens of candidate functions required copying and pasting hundreds of lines of boilerplate benchmark scripts:
- Manual timer management (`performance.now()`).
- Repetitive warmup loops.
- Ad-hoc statistical calculations (mean, standard deviation, margin of error).
- Disorganized, hardcoded runner functions prone to subtle copy-paste bugs.

BenchX was conceived to **eliminate this code duplication** while encapsulating rigorous scientific benchmarking principles in a clean, declarative API:

```javascript
const suite = new BenchXSuite({
  name: 'u32.wmul: Grand Candidate Evaluation',
  rounds: 5,
  iters: 5e7,
  warmup: 5e6,
});

suite
  .add('limb16-parallel-imul-all', limb16_parallel_imul_all)
  .add('limb16-pipeline-imul-all', limb16_pipeline_imul_all)
  .add('float64-corrected', float64_corrected);

suite.run();
```

---

## 4.2 The Megamorphic Inline Cache (IC) Trap

During early development, we observed an alarming anomaly:
- When a candidate kernel was tested alone in an isolated script, it ran at **370 Mops/s**.
- When the same candidate was tested 3rd or 4th in a list of 10 candidates using a shared generic runner string (`new Function('fn', 'return function(n) { ... }')`), its throughput plunged by **8x to ~45 Mops/s**!

### The Root Cause: V8's Compilation Cache & Megamorphism
V8 maintains a global **`CompilationCache`** for dynamic functions created via `new Function(...)` or `eval()`.
1. When two `new Function()` calls receive identical string contents, V8 reuses the existing compiled code object and its associated **`FeedbackVector`**.
2. When candidate 1 (`limb16-parallel`) is passed to the runner, the FeedbackVector records type feedback: `call_site -> limb16-parallel` (**Monomorphic**).
3. When candidate 2 (`limb16-pipeline`) is passed to the identical runner, the FeedbackVector updates: `call_site -> { limb16-parallel, limb16-pipeline }` (**Polymorphic**).
4. When candidate 3 and beyond are passed, the FeedbackVector exceeds 4 targets and transitions to **Megamorphic**.
5. Once megamorphic, TurboFan permanently disables **function inlining** and **speculative call optimization**, forcing every iteration to incur a full dynamic indirect dispatch call through the C++ runtime trampoline.

```
[Monomorphic: 1 Target] ---> Inlined Directly (370 Mops/s)
[Polymorphic: 2-4 Targets] -> Polymorphic Inline Cache (~280 Mops/s)
[Megamorphic: 5+ Targets] -> Deoptimized Generic Dispatch (~45 Mops/s) ❌
```

---

## 4.3 The Solution: Monomorphic JIT Isolation

To guarantee 100% monomorphic isolation for every candidate regardless of execution order, BenchX generates a **unique compilation unit string** for each runner by injecting an isolated comment header:

```javascript
function createMonomorphicRunner(fn, name = 'kernel', isStrided = false, a = 0xdeadbeef) {
  const r = new Uint32Array(2);
  const callExpr = isStrided ? 'fn(r[1], a, r, 1, 0);' : 'fn(r[1], a, r);';
  const cleanName = (name || 'kernel').replace(/[^a-zA-Z0-9]/g, '_');

  return new Function(
    'fn',
    'a',
    'r',
    `
    /* [BenchX Monomorphic Compilation Unit: ${cleanName}_${Date.now()}_${Math.random()}] */
    return function benchKernel_${cleanName}(n) {
      r[1] = 1;
      for (let i = 0; i < n; i++) {
        ${callExpr}
      }
      return r;
    };
  `,
  )(fn, a, r);
}
```

Because the source string contains a unique timestamp and random salt, V8's `CompilationCache` treats every candidate as an independent compilation unit with a pristine, private `FeedbackVector`, guaranteeing full TurboFan inlining across all 20 candidates.

---

## 4.4 Round-Robin Interleaved Sampling for Thermal Normalization

Sequential benchmarking (running Candidate A for 5 rounds, then Candidate B for 5 rounds, etc.) suffers from **thermal throttling bias**:
- Candidate A runs on a cold CPU core at peak Intel Turbo Boost / AMD Precision Boost frequencies ($5.0\text{ GHz}$).
- By the time Candidate T is tested 60 seconds later, the CPU has reached thermal limits ($85^\circ\text{C}$), throttling clock frequencies down to $3.6\text{ GHz}$ and unfairly penalizing later candidates.

BenchX implements **Round-Robin Interleaved Execution**:

```
Round 1: [Cand 1] -> [Cand 2] -> [Cand 3] ... -> [Cand 20]
Round 2: [Cand 1] -> [Cand 2] -> [Cand 3] ... -> [Cand 20]
Round 3: [Cand 1] -> [Cand 2] -> [Cand 3] ... -> [Cand 20]
...
```

By rotating across all candidates in each round, CPU temperature increases and dynamic clock adjustments affect all candidates equally, yielding stable statistical standard deviation ($< \pm 5\%$).

---

## 4.5 The `--expose-gc` Fallacy

Many developers assume that invoking `global.gc()` before each benchmark iteration improves accuracy. In our empirical testing with `--expose-gc`:
- Zero-allocation integer loops showed an inflated **Margin of Error (MoE) of $\pm 120\%$**.
- Running *without* `--expose-gc` reduced MoE to a precise **$\pm 3–5\%$**.

### Why `--expose-gc` Introduces Jitter
In V8, calling `global.gc()` synchronously collects the heap, but leaves **background concurrent sweeping threads** active in V8's task runner pool. In pure numeric loops allocating zero bytes of memory, the main thread contends with background GC threads for CPU cache lines and memory bandwidth, causing severe timing jitter.

In zero-allocation code, leaving V8's natural memory management undisturbed produces the cleanest measurements.

---

In [**Chapter 5: Cross-Runtime Realities, Browser Engines & Future Directions**](ch5-cross-runtime-and-future.md), we explore how these findings translate across Chrome, Firefox, and Safari.
