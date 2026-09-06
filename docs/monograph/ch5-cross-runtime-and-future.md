# Chapter 5: Cross-Runtime Realities, Browser Engines & Future Directions

While Node.js / V8 on x86-64 server environments was our primary baseline, modern applications run across diverse JavaScript runtimes:
- **Google Chrome / Microsoft Edge** (V8)
- **Mozilla Firefox** (SpiderMonkey / IonMonkey / Warp)
- **Apple Safari** (JavaScriptCore / FTL / B3)
- **Bun** (JavaScriptCore)
- **Deno** (V8)

To evaluate how our algorithmic families perform across different JIT compilation pipelines, we created the **BenchX Browser Microbenchmark Suite** ([`benchx/browser/`](../../benchx/browser/)).

---

## 5.1 Architecture of the Browser Benchmark Suite

Running hundreds of millions of arithmetic operations directly on the browser's main UI thread causes the browser to freeze, triggering the dreaded "Page Unresponsive" dialog and distorting high-resolution timing via `performance.now()`.

### The Web Worker Execution Pipeline
BenchX Browser runs the entire benchmark suite inside a dedicated **`Worker` thread**:

```mermaid
graph LR
    subgraph Main Thread [Main UI Thread (60 FPS)]
        UI["DOM / Controls / Progress Bar / Tables"]
        App["app.js Controller"]
    end
    
    subgraph Worker Thread [Dedicated Web Worker]
        W["worker.js"]
        Mono["Monomorphic JIT Runners"]
        Stats["Statistical Profiler"]
    end
    
    App -->|"postMessage({ rounds, iters, scope })"| W
    W -->|"postMessage({ type: 'progress', percent })"| App
    W -->|"postMessage({ type: 'complete', results })"| App
    App --> UI
```

1. **Zero UI Blocking**: The main DOM thread animates real-time progress bars and responsive charts smoothly at 60 FPS.
2. **Dedicated Core Execution**: The Web Worker receives a dedicated OS thread without competing with DOM layout, rendering, or browser garbage collection.
3. **Monomorphic Runner Isolation**: Just like the CLI harness, each candidate in the worker is compiled into an isolated `new Function(...)` unit to prevent cross-candidate Inline Cache (IC) pollution across SpiderMonkey and JavaScriptCore.

---

## 5.2 Comparative Analysis Across JIT Engines

```
+---------------------------+-----------------------------------+---------------------------------------+
| JIT Engine                | Top Algorithmic Family            | BigInt Optimization Status            |
+---------------------------+-----------------------------------+---------------------------------------+
| V8 (Node, Chrome, Deno)   | limb16-pipeline (242 Mops/s)      | No unboxing; asUintN(64) gives 2.5x   |
| SpiderMonkey (Firefox)    | limb16-parallel / float64         | Warp avoids some allocations; ~12Mops |
| JavaScriptCore (Safari, Bun)| limb16-pipeline (FTL/B3)        | B3 scalarizes Smis; BigInt still boxed|
+---------------------------+-----------------------------------+---------------------------------------+
```

### Key Insights:
1. **`Math.imul` is Universally Optimal**: Every modern JIT compiler (V8, SpiderMonkey, JSC FTL) maps `Math.imul` to 1-cycle CPU integer multiplication instructions.
2. **`float64-corrected` is the Portability Champion**: Across browsers where 16-bit bitwise shifts may experience varying register allocation heuristics, `float64-corrected` maintains consistent $\sim 210–240\text{ Mops/s}$ throughput because floating-point multiplication units (FPUs) are uniformly fast across all architectures.
3. **BigInt Remains a Barrier**: No major JavaScript engine currently performs scalar replacement / escape analysis on BigInt arithmetic, meaning unboxed procedural integer pipelines remain **14x–20x faster than BigInt** across all browsers.

---

## 5.3 Developer Decision Matrix & Cheat Sheet

When implementing high-performance low-level arithmetic in JavaScript, use this practical guide:

| Use Case | Recommended Kernel | Why |
| :--- | :--- | :--- |
| **Max Absolute Throughput (Crypto, Bignum, Hashing)** | [`limb16-pipeline-imul-all`](../src/u32/wmul/candidates/limb16-pipeline-imul-all) or [`limb16-imul-import`](../src/u32/wmul/candidates/limb16-imul-import) | Peak throughput (~242 Mops/s), pure 32-bit integer registers, 0 FPU penalties. |
| **Simplicity & Smallest Code Footprint** | [`float64-corrected`](../src/u32/wmul/candidates/float64-corrected) | Only 3 lines of arithmetic code, ~220 Mops/s (91% of peak integer speed). |
| **Reference Verification & Testing (Oracle)** | [`bigint-literal-mask`](../src/u32/wmul/candidates/bigint-literal-mask) | Built-in arbitrary precision mathematical correctness, simple syntax. |
| **Low-Throughput / Non-Critical Paths** | [`bigint-hi`](../src/u32/wmul/candidates/bigint-hi) | Hybrid `asUintN(32)` + `Math.imul` yields ~18 Mops/s with standard BigInt syntax. |

---

## 5.4 Conclusion & The Road Ahead

Through the development of [`intx`](https://github.com/impawstarlight/intx) and the **BenchX** suite, we demonstrated that pure JavaScript can execute 64-bit integer wide multiplication at **quarter-billion operations per second**, rivaling native C performance when authored with an intimate understanding of JIT compilation, memory representation, and hardware instructions.

As JavaScript engines continue to evolve, future proposals (such as WebAssembly GC and potential SIMD/Int64 unboxing in TurboFan) may bridge the gap further. Until then, carefully structured 16-bit limb pipelines and double-precision residual scaling remain the gold standard for high-performance JavaScript integer arithmetic.
