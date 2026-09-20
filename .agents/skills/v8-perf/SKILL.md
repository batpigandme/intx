---
name: v8-perf
description: V8 performance, JIT optimization flags, Fish shell abbreviations, and Linux hardware PMU profiling recipes for microbenchmarking.
---

# V8 Performance & Microbenchmarking Guide

This skill provides reference configurations, fish shell abbreviations, V8 engine flags, and Linux profiling commands for low-level JavaScript integer arithmetic and microbenchmarking.

---

## 1. Curated Fish Shell Abbreviations

Place these abbreviations in `~/.config/fish/config.fish` or a function file:

```fish
function def-abbr
    abbr -g "$argv[1]" --position anywhere -- "$argv[2]"
end

# --- JIT Inspection, Disassembly & Tracing ---
def-abbr -poc   "--print-opt-code"                               # Print TurboFan machine assembly
def-abbr -tro   "--trace-opt"                                    # Trace JIT tier-up events
def-abbr -trd   "--trace-deopt"                                  # Trace deoptimization bailouts
def-abbr -tric  "--trace-ic"                                     # Trace Inline Cache transitions
def-abbr -ans   "--allow-natives-syntax"                         # Enable %-prefixed runtime intrinsics

# --- JIT Tiering & Compilation Control ---
def-abbr -atf   "--always-turbofan"                              # Force eager TurboFan compilation on call 1
def-abbr -nmg   "--no-maglev"                                    # Disable Maglev mid-tier compiler
def-abbr -nsp   "--no-sparkplug"                                 # Disable Sparkplug baseline compiler
def-abbr -ncr   "--no-concurrent-recompilation"                  # Synchronous TurboFan compilation on main thread
def-abbr -nosr  "--no-use-osr --no-maglev-osr"                   # Disable On-Stack Replacement (prevent mid-loop recompilation)
def-abbr -nti   "--no-turbo-inlining"                            # Disable TurboFan inlining
def-abbr -nmi   "--no-maglev-inlining"                           # Disable Maglev inlining
def-abbr -ttin  "--trace-turbo-inlining"                         # Trace TurboFan inlining decisions
def-abbr -mibs  "--max-inlined-bytecode-size"                   # Set maximum bytecode size for single inlining (default 460)
def-abbr -mibsc "--max-inlined-bytecode-size-cumulative"        # Set cumulative bytecode inlining budget (default 920)
def-abbr -ftf   "--no-maglev --invocation-count-for-turbofan=20 --invocation-count-for-feedback-allocation=1 --minimum-invocations-after-ic-update=1 --no-concurrent-recompilation" # Fast TurboFan tier-up (20 iters)

# --- Determinism & Thread Isolation ---
def-abbr -prd   "--predictable"                                  # Deterministic memory layout and address order
def-abbr -sth   "--single-threaded"                              # Run V8 completely single-threaded

# --- Memory Management & Garbage Collection ---
def-abbr -egc   "--expose-gc"                                    # Expose global.gc() for manual compaction
def-abbr -nim   "--no-incremental-marking"                       # Disable incremental GC marking
def-abbr -ncm   "--no-concurrent-marking"                        # Disable background GC marking threads
def-abbr -ncs   "--no-concurrent-sweeping"                       # Disable background GC sweeping threads
def-abbr -stg   "--single-threaded-gc"                           # Force synchronous GC on mutator thread
def-abbr -miss  "--min-semi-space-size=256"                      # 256 MB Young Gen semi-space (avoids Scavenge)
def-abbr -mass  "--max-semi-space-size=256"                      # Prevent dynamic Young Gen resizing (must match min)

# --- Linux Hardware Profiling & CPU Affinity ---
def-abbr t2     "taskset -c 2"                                   # Pin process to isolated Core 2
def-abbr -pbp   "--perf-basic-prof"                              # Emit /tmp/perf-<pid>.map for Linux perf
def-abbr pstat  "perf stat -e cycles,instructions,branches,branch-misses,L1-dcache-load-misses"
```

---

## 2. Common Workflows & Command Recipes

### Inspecting TurboFan Assembly for a Specific Kernel
```bash
node --allow-natives-syntax --print-opt-code --print-opt-code-filter="*kernel*" script.js
```

### Deterministic Microbenchmarking (No Thread Jitter)
```bash
taskset -c 2 node --allow-natives-syntax --no-maglev --no-concurrent-recompilation --no-concurrent-marking --predictable benchmark.js
```

### Cross-Engine Non-Inlining Isolation Commands
When measuring pure hardware `CALL`/`RET` overhead across engines without bytecode padding:

| Runtime | Underlying Engine | Command to Disable Inlining |
| :--- | :---: | :--- |
| **Node.js** | Google V8 | `node --no-turbo-inlining --no-maglev-inlining script.js` |
| **Deno** | Google V8 | `deno run --v8-flags="--no-turbo-inlining,--no-maglev-inlining" script.js` |
| **Bun** | Apple JavaScriptCore | `JSC_maximumInliningDepth=0 bun script.js` |

### Tracing Inlining Decisions in TurboFan
```bash
node --allow-natives-syntax --trace-turbo-inlining script.js
```

### Investigating Deoptimization Bailouts
```bash
node --allow-natives-syntax --trace-deopt benchmark.js
```

### Generating Turbolizer Sea-of-Nodes Graphs
```bash
node --allow-natives-syntax --trace-turbo --turbo-filter="*targetFunction*" script.js
# Generates turbo-*.json and turbo-*.dot files in current working directory.
# Inspect at https://v8.github.io/tools/turbolizer
```

### Linux Hardware PMU Profiling with `perf`
```bash
# 1. Hardware event counters
taskset -c 2 perf stat -e cycles,instructions,branches,branch-misses,L1-dcache-load-misses node script.js

# 2. Recording hot call-chains with JIT symbol resolution
taskset -c 2 perf record -k 1 -F 999 -g node --perf-basic-prof script.js
perf report -g 'graph,0.5,caller'
```

---

## 3. V8 Inlining Architecture Reference

* **Budget Measurement Unit**: Inlining budgets in TurboFan strictly measure **Ignition Bytecode bytes** (`BytecodeArray->length()`), not native machine code.
* **Single Function Budget**: 460 bytes (`--max-inlined-bytecode-size`).
* **Cumulative Parent Budget**: 920 bytes (`--max-inlined-bytecode-size-cumulative`).
* **Small Function Exemption**: <= 27 bytes (`--max-inlined-bytecode-size-small`).
* **Hotness Threshold**: Call site execution frequency >= 0.15 (`--min-inlining-frequency`).
* **Call Site Invariants**: Static closure identifiers (`fn(...)`) and static property accesses (`obj.prop(...)`) inline monomorphically; dynamic/computed property calls (`obj[prop](...)`) are blocked by `KeyedCallIC` dispatch.

---

## 4. V8 JIT Tier-Up & Feedback Vector Mechanics

V8 is a speculative, profile-guided compiler pipeline:
**Ignition** (Interpreter) → **Sparkplug** (Baseline) → **Maglev** (Mid-tier) → **TurboFan** (Top-tier).

### The 10-Iteration Feedback Vector Floor
* **Lazy Allocation Threshold**: V8 does not allocate a function's `FeedbackVector` until it has been called at least **8 times** in unprofiled bytecode (`--invocation-count-for-feedback-allocation=8`).
* **Why Premature Opt Fails**: Invoking `%OptimizeFunctionOnNextCall(fn)` with <= 8 iterations is silently ignored because TurboFan cannot compile without a valid feedback vector. Iterations 1–9 leave slots unallocated or immature.
* **The 10-Iteration Rule**: Running **at least 10 warmup iterations** with representative monomorphic arguments guarantees that:
  1. The `FeedbackVector` is allocated (call 8/9).
  2. The target IC slots are populated with monomorphic Map / Smi type feedback (call 9/10).
  3. `%OptimizeFunctionOnNextCall(fn)` compiles cleanly to `TURBOFAN_JS` on the subsequent invocation without deoptimizing.

### Rapid Natural Tier-Up Recipe (Without Natives Syntax)
To trigger natural TurboFan compilation within 20 iterations without code modifications:
```bash
node \
  --no-maglev \
  --invocation-count-for-turbofan=20 \
  --invocation-count-for-feedback-allocation=1 \
  --minimum-invocations-after-ic-update=1 \
  --no-concurrent-recompilation \
  bench.js
```

---

## 5. Loop Peeling vs. Loop Unrolling in V8

| Optimization | V8 Flag | Transformation | Purpose & Microarchitectural Impact |
| :--- | :--- | :--- | :--- |
| **Loop Peeling** | `--turbo-loop-peeling`<br>`--maglev-loop-peeling` | Unrolls iteration 0 into straight-line code before the loop header. | **Hoists invariants & dynamic checks**: Shapes/Maps, prototype guards, and null-checks verified in iteration 0 are stripped from subsequent iterations. |
| **Loop Unrolling** | `--turboshaft-loop-unrolling` | Replicates the loop body K times inside the loop. | **Amortizes branch penalty & unlocks ILP**: Decreases branch instructions, reduces loop counter updates, and lets out-of-order execution ports run multiple arithmetic operations in parallel. |

* **Microbenchmarking Guard**: Disable On-Stack Replacement with `--no-use-osr --no-maglev-osr` in measurement loops. OSR recompiles running loops mid-iteration, causing severe timing anomalies during cycle calibration.

---

## 6. Memory & Heap Stabilization Pitfalls

### Young-Gen Semi-Space Clamping Gotcha
* Specifying `--min-semi-space-size=N` alone **silently clamps** the semi-space size down to the platform default maximum (64 MB on 64-bit systems).
* **Rule**: You MUST specify both `--min-semi-space-size` and `--max-semi-space-size` in tandem to allocate larger nurseries (e.g. 256 MB or 512 MB).
* **Nursery Sizing Rule of Thumb**:
  * `--min-semi-space-size=256 --max-semi-space-size=256`: Allocates 512 MB total RAM (From-Space + To-Space). Prevents Scavenge minor GCs during tight loops allocating < 256 MB.
  * Pair with an explicit `global.gc()` (`--expose-gc`) immediately before starting the benchmark timer.

### Full Background Thread & Jitter Suppression
To ensure 100% of CPU time and L1/L2 cache lines belong to your measurement loop without background worker contention:
```bash
node \
  --predictable \
  --predictable-gc-schedule \
  --single-threaded \
  --single-threaded-gc \
  --no-concurrent-recompilation \
  --no-concurrent-marking \
  --no-concurrent-sweeping \
  --no-use-osr \
  --min-semi-space-size=128 \
  --max-semi-space-size=128 \
  --expose-gc \
  bench.js
```

---

## 7. JavaScriptCore (Bun) JIT Inspection & Profiling

Bun executes on Apple's **JavaScriptCore (JSC)** engine with the **B3 (Bare Bones Backend)** compiler rather than V8.

### Key Bun / JSC Environment Variables & Flags

| Environment Variable / Flag | Description |
| :--- | :--- |
| `BUN_JSC_dumpDisassembly=1` | Prints B3 and FTL machine assembly to stdout |
| `BUN_JSC_dumpDFGDisassembly=1` | Dumps DFG mid-tier intermediate representation |
| `JSC_maximumInliningDepth=0` | Disables function inlining across call sites |
| `BUN_JSC_useFTLJIT=0` | Disables FTL top-tier JIT (stops at DFG) |
| `BUN_JSC_useJIT=0` | Disables JIT completely (interpreter-only mode) |

### JSC NaN-Boxing (`JSValue`) & Register Rules
- **Signed 32-bit Int32 (`| 0`)**: Encoded directly inside the 64-bit `JSValue` (`0xFFFF000000000000 | int32`). Stays unboxed in hardware ALU registers.
- **Unsigned Uint32 (`>>> 0`)**: Values >= 2^31 (bit 31 set) cannot fit into signed Int32 and are boxed as Float64 Doubles, forcing floating-point conversions.
- **BigInt Arithmetic**: JSC allocates heap objects for BigInt values; avoid BigInt in tight inner loops where V8's unboxed 64-bit register fast path would otherwise excel.


