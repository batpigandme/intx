# BenchX: Precision Microbenchmarking Harness for JIT Arithmetic Kernels

`BenchX` is a specialized microbenchmarking framework designed for low-level integer and floating-point arithmetic kernels running on V8 (Node.js/Chrome), JavaScriptCore (Bun/Safari), and SpiderMonkey (Firefox/Deno).

---

## The Four Engineering Pillars of BenchX

### 1. Isolated Monomorphic JIT Compilation
Standard JavaScript benchmark loops often reuse the same dynamic function wrapper or pass different function pointers into a shared call site.
- **The Failure**: In V8, invoking 3+ distinct functions at the same call site triggers **Megamorphic Inline Cache (IC) pollution**, permanently disabling TurboFan JIT inlining and causing severe (~8–10x) artificial slowdowns.
- **The BenchX Solution**: Dynamically creates unique `SharedFunctionInfo` compilation units per candidate, guaranteeing 100% monomorphic inlining for every algorithm.

### 2. Round-Robin Interleaved Execution
Traditional benchmarks execute $10^8$ iterations of Algorithm A, then $10^8$ of Algorithm B sequentially:
- **The Failure**: Modern CPUs dynamically modulate clock frequencies (Intel Speed Shift / AMD CPPC) and throttle under thermal load. The first candidate runs on a cold, high-boost core (~4.8 GHz) while subsequent candidates run on a hot, throttled core (~3.2 GHz).
- **The BenchX Solution**: Interleaves measurement across $N$ rounds (`A -> B -> C -> A -> B -> C...`), ensuring all candidates experience the exact same thermal and frequency environment.

### 3. Statistical Distribution & Outlier Elimination
Single-shot stopwatch timers (`t1 - t0`) capture operating system interrupts, page faults, and background thread jitter.
- **The BenchX Solution**: Records individual round durations and computes:
  - **Median Throughput**: The robust central tendency immune to GC pauses or OS interrupts.
  - **Peak (Max) Throughput**: The physical upper limit of the CPU hardware pipeline.
  - **Margin of Error ($\pm\%$ MoE)**: Quantifies measurement variance and confidence.

### 4. Memory Hygiene
Automatically triggers `global.gc()` between sampling rounds if Node is started with `--expose-gc`, preventing inter-candidate GC contamination.

---

## Usage

```bash
# Run u32.wmul multi-round interleaved benchmark with BenchX
node benchx/u32-wmul.js

# Run with explicit garbage collection enabled
node --expose-gc benchx/u32-wmul.js
```
