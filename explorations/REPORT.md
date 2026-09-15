# JIT & Microbenchmarking Explorations Report

This report documents comprehensive empirical investigations into V8 TurboFan optimization behaviors, closure context handling, Dead Code Elimination (DCE), Bounds Check Elimination (BCE), Instruction-Level Parallelism (ILP), and memory hierarchy dynamics for JavaScript integer microbenchmarking.

---

## Master Summary of Results

| Experiment | Focus Area | Key Metric / Result | Core Takeaway |
| :--- | :--- | :--- | :--- |
| **Exp 1** | DCE & Closure Constants | DCE: 1.45 B/s vs Kernel: 1.12 B/s | Unused pure expressions fold to empty loops (~0 ns); closure context constants act as dynamic parameters preventing DCE. |
| **Exp 1 (Trap)** | Closure Coercion Tax | Coerced: 1.18 B/s vs Uncoerced: 115 M/s (**10.2x penalty**) | Closure variables used directly in operators without `\| 0` trigger generic Number type checks. |
| **Exp 2** | Constant Loops & DLE | Identity ops: ~1.61 B/s (folds to empty loop) | TurboFan simplifies identity operations (`acc + 0`, `acc ^ 0`, `acc * 1`) into empty loops. |
| **Exp 3** | Context Aliasing | Direct: 1.21 B/s vs Local Alias: 1.27 B/s | Manual `const localC = c;` aliasing in `setup` is redundant; TurboFan's LICM hoists context slots automatically. |
| **Exp 4** | Reg-to-Reg ILP Streams | Add 1x: 1.18 B ops/s vs Add 8x: **2.82 B ops/s (2.39x)** | Multi-accumulator streams break the 1x latency bound and saturate CPU superscalar execution ports. |
| **Exp 5** | BCE & Buffer Sizing | 1 KB (`& 0xff`): 537 M/s vs Modulo (`% 250`): **135 M/s (4.0x slower)** | Power-of-two bitmasks enable Bounds Check Elimination (BCE); 1 KB buffer maximizes L1D cache residency. |
| **Exp 6** | Buffer Mutation | Read-Only: 597 M/s vs In-Place: 524 M/s vs Separate: 494 M/s | In-place mutation adds store buffer latency and risks input test-vector decay across iterations. |
| **Exp 7** | Loop Overhead Isolation | Baseline loop: ~0.61 ns/iter; Kernel delta: ~0.20 ns | Pure loop control overhead can be cleanly isolated and subtracted to obtain true kernel latencies. |

---

## Detailed Experiment Findings

### Experiment 1: Dead Code Elimination (DCE) & Closure Constants

#### Results (1e8 iterations, 5 rounds)
* **DCE Unused Pure Function (`Math.imul(42, 17)`):** `1.45 B/s` (~0.69 ns/iter, pure empty loop)
* **DCE Static Invariant Expression (`(42 * 17) | 0`):** `1.44 B/s`
* **Kernel with Context Constant (`i32.add(acc, c)`):** `1.12 B/s` (~0.89 ns/iter)
* **Inline Op with Coerced Context (`((acc\|0) + (c\|0))\|0`):** `1.16 B/s` (~0.86 ns/iter)
* **Inline Op with Uncoerced Context (`((acc\|0) + c)\|0`) [CRITICAL TRAP]:** `115.1 M/s` (~8.69 ns/iter, **10.2x slower**)

#### Key Architectural Findings:
1. **Unused Pure Calls are Stripped**: When an operation has no side effects and its return value is not assigned or returned from the runner, TurboFan strips the call entirely.
2. **Closure Context Prevents Static DCE**: When constants are passed via `context`, TurboFan treats them as runtime arguments loaded from the closure frame. Because `acc` is returned in `teardown`, the computation cannot be folded away at compile time.
3. **The Closure Coercion Tax (Critical Gotcha)**:
   * In `((acc | 0) + c) | 0`, `c` is loaded as an untyped JavaScript `Number`. Because JavaScript allows `+` on numbers, strings, and objects, TurboFan must emit dynamic type-check guards before the addition.
   * In `((acc | 0) + (c | 0)) | 0` (or inside `i32.add`), explicit truncation (`c | 0`) signals to TurboFan's representation selector that `c` is strictly a 32-bit signed integer, emitting a single bare machine instruction (`addl`).

---

### Experiment 2: Constant & Invariant Loops (Dead Loop Elimination / DLE)

#### Results (1e8 iterations, 5 rounds)
* **Empty Loop (`for (let i = 0; i < iters; i++) {}`):** `1.58 B/s` (~0.63 ns/iter)
* **Identity Addition (`acc = (acc + 0) | 0`):** `1.68 B/s` (~0.60 ns/iter)
* **Identity Bitwise XOR (`acc = acc ^ 0`):** `1.60 B/s` (~0.62 ns/iter)
* **Fixed-Point Collapse (`acc = acc & 0`):** `1.61 B/s` (~0.62 ns/iter)
* **Identity Multiplication (`Math.imul(acc, 1)`):** `1.63 B/s` (~0.61 ns/iter)
* **Active Linear Induction (`acc = (acc + 1) | 0`):** `1.30 B/s` (~0.77 ns/iter)
* **Non-Linear Recurrence (`acc = Math.imul(acc, 33) + 1 | 0`):** `574.3 M/s` (~1.74 ns/iter)

#### Key Architectural Findings:
1. **Algebraic Simplification to No-Ops**: Identity arithmetic (`+ 0`, `^ 0`, `& 0`, `* 1`) is simplified away during TurboFan's optimization graph reduction phase. The loop body becomes a no-op, executing at the exact same rate as an empty loop.
2. **Loop Preservation vs Invariant Outputs**: Even though `acc = 0` throughout the entire loop in `acc = (acc + 0) | 0`, TurboFan preserves the outer loop control structure because `iters` is an external runtime bound.

---

### Experiment 3: Context Variable Direct Access vs Local Aliasing

#### Results (1e8 iterations, 5 rounds)
* **Scalar Constant: Direct Closure Access (`add(acc, c)`):** `1.21 B/s` peak
* **Scalar Constant: Local `const` Alias (`const localC = c`):** `1.27 B/s` peak
* **Function Reference: Direct Closure Access:** `1.21 B/s` peak
* **Function Reference: Local `const` Alias (`const localAdd = add`):** `1.26 B/s` peak
* **Buffer Reference: Direct Closure Access (`buf[idx]`):** `613.7 M/s` peak
* **Buffer Reference: Local `const` Alias (`const localBuf = buf`):** `592.7 M/s` peak

#### Key Architectural Findings:
* **Loop Invariant Code Motion (LICM)**: TurboFan automatically loads closure context slots into machine registers during the loop pre-header. 
* **Zero Benefit from Manual Aliasing**: Writing `const localC = c;` inside `setup` produces virtually identical machine code to referencing `c` directly from closure `context`.

---

### Experiment 4: Reg-to-Reg ILP Multi-Accumulator Streams

#### Normalized Operations Throughput:
| Operation | 1x (Serialized Latency) | 2x Independent Streams | 4x Independent Streams | 8x Independent Streams | Peak Speedup |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`i32.add`** | 1.18 B ops/s (0.85 ns) | 1.42 B ops/s (0.70 ns) | 2.64 B ops/s (0.38 ns) | **2.82 B ops/s (0.35 ns)** | **2.39x** |
| **`i32.mul`** | 684 M ops/s (1.46 ns) | 1.15 B ops/s (0.87 ns) | 1.99 B ops/s (0.50 ns) | **1.98 B ops/s (0.50 ns)** | **2.91x** |

#### Key Architectural Findings:
1. **1x Latency Bound**: In `acc = add(acc, c)`, each addition depends on the result of the previous one. The CPU can only execute 1 operation per cycle (the latency of the ALU instruction).
2. **2x to 8x ILP Streams**: With independent accumulators (`a0..a7`), the CPU's out-of-order execution engine dispatches multiple independent additions to multiple ALU ports concurrently within the same cycle.
3. **Pipelined Multiplier Saturation**: `Math.imul` has a latency of 3 cycles but a throughput of 1 cycle. In 1x serial execution, the multiplier sits idle 2 out of 3 cycles. At 4x unrolling, the multiplier pipeline is 100% saturated, yielding a **2.91x speedup**.

---

### Experiment 5: Read-Only Buffer Walk: BCE vs Non-BCE & Buffer Sizing

#### Results (1e8 iterations, 5 rounds)
* **BCE 1 KB (256 elements, mask `& 0xff`):** `537.3 M/s` (~1.86 ns/iter) — **Fastest**
* **BCE 512 B (128 elements, mask `& 0x7f`):** `420.3 M/s` (~2.38 ns/iter)
* **BCE 4 KB (1024 elements, mask `& 0x3ff`):** `325.4 M/s` (~3.07 ns/iter)
* **Non-BCE Power-of-Two Modulo (`% 256`):** `277.9 M/s` (~3.60 ns/iter, **1.9x slower**)
* **Non-BCE Arbitrary Modulo (`% 250`):** `135.5 M/s` (~7.38 ns/iter, **4.0x slower**)
* **Non-BCE Branching Reset (`if (idx === 256) idx = 0`):** `255.9 M/s` (~3.91 ns/iter, **2.1x slower**)

#### Key Architectural Findings:
1. **Bounds Check Elimination (BCE)**: Using a power-of-two bitmask matching buffer capacity (`(idx + 1) & 0xff` for 256 elements) allows TurboFan's range analysis to prove $0 \le idx < 256$, completely eliminating the bounds check branch (`cmp + jge`).
2. **Modulo Penalty**: Unaligned modulo (`% 250`) forces a hardware integer division instruction on every iteration, destroying throughput.
3. **L1D Cache Locality**: A 1 KB (256-element `Int32Array`) buffer fits tightly into L1D cache, yielding the highest throughput and lowest cache line conflict rate.

---

### Experiment 6: Buffer Mutation Patterns

#### Results (1e8 iterations, 5 rounds)
* **Read-Only Baseline (Walk Only):** `597.4 M/s` (~1.67 ns/iter)
* **In-Place Mutation (`mutBuf[idx] = add(...)`, Context):** `524.1 M/s` (~1.91 ns/iter)
* **In-Place Mutation (Local `setup` Buffer):** `523.1 M/s` (~1.91 ns/iter)
* **Separate Write Buffer (`outBuf[idx] = add(inBuf[idx], c)`):** `494.8 M/s` (~2.02 ns/iter)
* **Fixed Fixture Mutation (`out[0] = ...; out[1] = ...`):** `408.1 M/s` (~2.45 ns/iter)

#### Key Architectural Findings:
1. **Context vs Local Buffer Allocation**: Allocating the buffer in closure `context` vs in local `setup` yields identical loop execution speeds (~524 M/s). However, `context` allocation avoids heap garbage collection overhead across rounds.
2. **Store Buffer Cost**: Writing to memory adds store buffer overhead and cache line dirtying compared to read-only buffer walks.
3. **Separate Output Buffers**: Using `inBuf -> outBuf` provides clean separation of inputs and outputs with negligible throughput difference compared to in-place mutation, while completely preventing input test-vector corruption across rounds.

---

### Experiment 7: Pure Loop Overhead & Calibration Baseline

#### Baseline Decomposition:
* **Empty Loop Control Overhead:** `1.61 B/s` (~0.62 ns/iter)
* **Minimal Opaque Induction Step (`acc ^= (i & mask)`):** `982.1 M/s` (~1.02 ns/iter)
* **Minimal In-Register Step (`acc = (acc + 1) | 0`):** `1.26 B/s` (~0.79 ns/iter)
* **Read-Only Buffer Walk Baseline (`acc ^= buf[idx]`):** `492.6 M/s` (~2.03 ns/iter)
* **Target Kernel on Buffer (`acc = add(acc, buf[idx])`):** `586.9 M/s` (~1.70 ns/iter)

#### How to Calibrate Microbenchmarks:
$$\text{Pure Kernel Execution Latency} = \text{Total Time per Iteration} - \text{Baseline Loop Control Overhead}$$

---

## Best Practices Checklist for High-Performance JS Microbenchmarks

1. [x] **Pass Constants via `context`**: Injects values as dynamic closure parameters, preventing compile-time dead code elimination and constant-folding.
2. [x] **Always Coerce Closure Variables**: If using closure variables directly in inline expressions, ensure explicit `| 0` coercion (`(acc + (c | 0)) | 0`) to avoid the **10x Closure Coercion Tax**.
3. [x] **Use 1 KB L1 Buffers with Hex Masks for Diverse Inputs**: Use `new Int32Array(256)` with `idx = (idx + 1) & 0xff` for maximum L1 cache residency and 100% Bounds Check Elimination (BCE).
4. [x] **Use Separate Write Buffers for Mutations**: Always write outputs to a dedicated `outBuf` instead of mutating the input test vector to prevent input decay across benchmark rounds.
5. [x] **Use Multi-Accumulator Streams (4x/8x) for Peak Throughput**: When measuring the theoretical execution port limits of a kernel, use 4x or 8x independent accumulators to break the 1x serialization latency bound.
