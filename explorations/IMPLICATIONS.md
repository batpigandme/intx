# 1. Candidate Selection Framework & Tie-Breaking Hierarchy

The core objective of this repository is to select the single canonical winner among candidate implementations. Evaluation follows a strict tier-based decision hierarchy.

```text
+-------------------------------------------------------------------------+
|                          Candidates Evaluated                           |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| Tier 1: TurboFan Peak Silicon Floor                                     |
| (Hardware cycles/op, retired instructions, IPC)                         |
+-------------------------------------------------------------------------+
     |                                                      |
[Clear Winner]                                        [Tie / Within MoE]
     |                                                      |
     |                                                      v
     |      +-------------------------------------------------------------+
     |      | Tier 2: Ignition Bytecode Footprint & Inlining Budget       |
     |      | (<= 27 B leaf bonus, <= 460 B single, <= 920 B cumulative)  |
     |      +-------------------------------------------------------------+
     |           |                                          |
     |      [Clear Winner]                            [Tie / Equal Size]
     |           |                                          |
     |           |                                          v
     |           |      +-------------------------------------------------+
     |           |      | Tier 3: Multi-Pattern Adaptability              |
     |           |      | (Latency bound vs ILP saturation vs L1 stream)  |
     |           |      +-------------------------------------------------+
     |           |           |                              |
     |           |      [Clear Winner]                [Tie / Same Curve]
     |           |           |                              |
     |           |           |                              v
     |           |           |     +--------------------------------------+
     |           |           |     | Tier 4: Sub-Tier & Engine Portability|
     |           |           |     | (Maglev SSA lowering, JSC Int32 tag) |
     |           |           |     +--------------------------------------+
     |           |           |                              |
     +-----------+-----------+------------------------------+
                             |
                             v
+-------------------------------------------------------------------------+
|                       Canonical Export in index.js                      |
+-------------------------------------------------------------------------+
```

### Hierarchy Breakdown

| Tier | Evaluation Target | Winning Criteria | Rationale |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Primary)** | **TurboFan Peak Performance** | Lowest hardware `cycles/op` and `instructions/op` at peak IPC | Top-tier JIT represents hot inner-loop production speed. |
| **Tier 2 (Tie-Breaker 1)** | **Bytecode Inlining Budget** | Smallest Ignition bytecode size (bytes) | A candidate that fits the <= 27 B leaf function bonus or consumes fewer bytes of TurboFan's 460 B / 920 B cumulative budget preserves inlining capacity for caller routines. |
| **Tier 3 (Tie-Breaker 2)** | **Multi-Pattern Robustness** | Consistent superiority across Latency, ILP, and L1 Buffer Walk | Prevents picking a candidate that only excels under artificial 1x serial recurrence but degrades under realistic streaming or multi-accumulator usage. |
| **Tier 4 (Tie-Breaker 3)** | **Sub-Tier & Cross-Engine Portability** | Clean Maglev SSA lowering & unboxed Int32 execution in JSC (Bun) | In cold/warm paths before TurboFan or under alternate engines (Bun/Safari), operations with clean Int32 coercion prevent NaN-boxed Float64 deopts. |

---

# 2. Kernel Multi-Pattern Evaluation Suite

Every candidate must be benchmarked across distinct usage patterns to reflect realistic consumption:

| Pattern | Inner Loop Structure | Architectural Target Measured |
| :--- | :--- | :--- |
| **1. Pure Serial Recurrence** | `acc = op(acc, c)` | **Critical Path Latency (1x bound)**: Tests serialized instruction dependency chains and ALU port latency. |
| **2. Multi-Accumulator ILP** | `a0 = op(a0, c); a1 = op(a1, c); ... a3 = op(a3, c)` | **Execution Port Saturation**: Tests superscalar throughput, pipelining (e.g. 3-cycle `Math.imul` pipeline saturation at 4x unrolling), and IPC ceilings. |
| **3. L1 Buffer Walk (Streaming)** | `acc = op(acc, inBuf[idx]); idx = (idx + 1) & 0xff` | **Memory-to-Register Interleaving**: Evaluates out-of-order latency hiding and Address Generation Unit (AGU) pipelining on diverse input vectors. |
| **4. Destination Buffer Store** | `op(ah, al, bh, bl, outBuf)` | **Store Buffer & Compound Packing**: Tests multi-word operations returning limbs via TypedArray destination buffers without memory allocation. |
| **5. Branch Stress (Branchless vs Branchful)** | `op(randomA, randomB)` | **Branch Predictor Penalty**: Compares ternary/conditional branching against branchless arithmetic masks under unpredictable inputs (15-20 cycle pipeline flush penalty). |
| **6. Un-inlined CALL Overhead** | Child process with `--no-turbo-inlining` | **Calling Convention Cost**: Evaluates register spills and parameter passing cost when inlining budget is exhausted. |

---

# 3. Kernel Authoring Guidelines & Pitfalls

### Guidelines
- **Enforce Signed Integer Coercion (`| 0`)**: Always coerce intermediate and return values using `| 0` instead of `>>> 0` unless the operation specifically produces an unsigned 32-bit result. Signed 32-bit integers remain unboxed in V8 CPU registers and map directly to unboxed Int32 tags in JavaScriptCore (Bun), avoiding Float64 Double heap conversions.
- **Pass Scalar Parameters Directly**: For multi-word operations, accept scalar words (`(ah, al, bh, bl, out)`) rather than buffer objects `(a, b, out)` to eliminate bounds checks and array property overhead.
- **Top-Level Constant Binding**: Import or define numeric constants strictly at module top-level using `const` (e.g., `const { LOW_16 } = require("#const");`) so TurboFan folds them directly into `Int32Constant` machine nodes (`movzxwl`).
- **Target the 27-Byte Leaf Inlining Threshold**: Tiny arithmetic helpers <= 27 bytes of Ignition bytecode bypass TurboFan's 920-byte cumulative inlining ceiling and inline up to the 4,600-byte absolute limit.

### Critical Pitfalls
- **The Redundant Coercion Bloat Trap**: Never chain `(expr >>> 0) | 0` or write redundant coercions (`a |= 0; b |= 0;`) when operands are immediately masked (`& 0xffff`) or shifted (`>>> 16`). Every redundant coercion adds ~6 bytes of Ignition bytecode that burns TurboFan's inlining budget without changing machine code.
- **Plain Array Smi Eviction**: Storing values >= 2^31 (via `>>> 0`) into plain JS arrays `[0, 0]` evicts V8 elements from `PACKED_SMI_ELEMENTS` to `PACKED_DOUBLE_ELEMENTS`, creating heap allocations and causing a ~2.5x throughput collapse (~98 M/s vs ~227 M/s). Use `Uint32Array` or keep plain arrays strictly within signed range (`| 0`).
- **Dynamic Keyed Lookups**: Avoid dynamic property lookups (`obj[key]()`) inside kernel dispatch paths; dynamic calls generate `KeyedCallIC` stubs that block TurboFan inlining.

---

# 4. Benchmark Authoring Guidelines & Pitfalls

### Guidelines
- **Pass Invariant Constants via `context`**: Inject external constants via the benchmark `context` closure object. TurboFan treats closure variables as runtime parameters loaded from the closure frame, preventing Dead Code Elimination (DCE) while allowing Loop Invariant Code Motion (LICM) to hoist the load into a machine register outside the loop.
- **Use 1 KB L1 Buffers with Hex Masks for Diverse Inputs**: Use `new Int32Array(256)` with `idx = (idx + 1) & 0xff`. This guarantees:
  1. 100% Bounds Check Elimination (BCE).
  2. Byte zero-extension optimization (`movzxbl`), saving 1 uop per iteration over 128-element or 1024-element buffers.
  3. 100% L1 Data Cache residency (1 KB out of 32 KB L1D).
- **Separate Read and Write Buffers**: When benchmarking mutating operations, read from `inBuf` and write to `outBuf`. In-place mutation risks test-vector decay across rounds, while separate buffers maintain pristine vector inputs with negligible store overhead.
- **Maintain Monomorphic TypedArray Destinations**: Pass strictly `Int32Array` or `Uint32Array` into `out` parameters. Never mix generic `Array` (`[0, 0]`) into the same call site, which degrades inline caches to megamorphic stubs (~30-40% penalty).

### Critical Pitfalls
- **The Closure Coercion Tax (10.2x Penalty Trap)**:
  - Referencing a closure variable directly in arithmetic without signed coercion (`((acc | 0) + c) | 0`) causes TurboFan to treat `c` as an untyped JavaScript `Number`, emitting dynamic type guards and causing a **10.2x slowdown** (115 M/s vs 1.18 B/s).
  - Always coerce closure variables explicitly: `((acc | 0) + (c | 0)) | 0` or pass them into typed kernel functions.
- **The Postfix Assignment Freezing Bug**:
  - Writing `idx = (idx++) & 0xff` causes `idx` to freeze at 0 forever because `idx++` returns the pre-incremented value (`0`), causing TurboFan to constant-fold the loop into a static load of `buf[0]`.
  - Always use `idx = (idx + 1) & 0xff` or `idx = (++idx) & 0xff`.
- **The Primitive Operator Paradox (TurboFan Partial Unrolling)**:
  - Bare leaf operators like `acc ^= inBuf[idx]` trigger TurboFan's 4x partial loop unrolling with individual dynamic exit checks and register ping-pong (~16% slower). Calling an inlined wrapper function (`xorWrapper(acc, inBuf[idx])`) preserves a compact 1x loop structure.

---

# 5. Measurement, JIT Calibration & Hardware PMU Protocol

### Guidelines
- **Feedback Vector 10-Call Allocation Floor**: Always run at least 10 warmup iterations before asserting TurboFan tier-up or invoking `%OptimizeFunctionOnNextCall`. V8 delays `FeedbackVector` allocation until call 8.
- **Adaptive Rate-Derivative Calibration**: Sizing iterations using cold 2 ms probes causes mid-flight JIT tier-up during measurement rounds, inflating MoE up to +/-117%. Calibration must use rate-derivative convergence detection: continue scaling iterations until throughput delta flattens (`Delta <= 15%`) and accumulated time exceeds 50 ms.
- **Hardware PMU Dual-Mode Strategy (`#microbe/cycles`)**:
  - **Silicon Floor Discovery** (`cycles: 1e6`, ~0.3 ms, 500 rounds): Fits cleanly between Linux `CONFIG_HZ` APIC timer ticks (1.0 ms intervals), avoiding pipeline flushing and revealing exact physical execution port latencies (1/16 cycle lattice: `1.5000`, `1.8125`, `1.8750`).
  - **Macro-Architectural Verification** (`cycles: 1e7`, ~3.5 ms, 100 rounds): Locks instruction counts to exact theoretical rational values (`.7500`, `.2500`, `.5000`), engages Intel Loop Stream Detection (>4 IPC), and achieves Inlier MoE <= +/-0.2%.
- **N-API Boundary Tax Calibration**: Always measure and subtract N-API counter read boundary taxes (`boundaryTax.cycles`, `boundaryTax.instructions`) to prevent ~470 trampoline instructions from skewing inner loop metrics.
- **Physical Core Pinning & Stationary Power**: Always pin benchmark execution to an isolated core (e.g. `taskset -c 2`), run on AC power with a fixed CPU governor, and use continuous execution (`cooldown: 0`, >= 50 ms samples) to keep the core in active C0 state without CPU frequency flapping.

### Critical Pitfalls
- **The Maglev Usurpation Trap**: In benchmark runs with >= 1,000 rounds, the outer runner wrapper accumulates sufficient invocations to trigger mid-tier Maglev recompilation. Maglev replaces TurboFan OSR code with less aggressive inlining, degrading instructions per op. Run high-round benchmarks with `--no-maglev`, or keep standard suites to <= 100 rounds.
- **Semi-Space Clamping Bug**: Passing `--min-semi-space-size=256` alone silently clamps the nursery to 64 MB. Always pass both `--min-semi-space-size=256` and `--max-semi-space-size=256` in tandem.
- **Mid-Loop OSR Jitter**: Inner measurement loops must disable On-Stack Replacement (`--no-use-osr --no-maglev-osr`) during timing calibration to prevent mid-iteration re-compilation artifacts.
