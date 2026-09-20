# `u32.wmul` Candidate Benchmark Notes

Notes and benchmark results for 25 candidate implementations of 32-bit wide multiplication across 5 algorithmic families.

### Kernel Signature & Contract
```javascript
wmul(a, b, out) // a, b: uint32 [0, 2^32 - 1] -> writes [hi, lo] into out[0], out[1]
```
To eliminate return-object heap allocations, all kernels write their 64-bit product (`a * b = hi * 2^32 + lo`) in-place into a caller-supplied 2-element destination buffer `out` (`Uint32Array(2)` or Array `[0, 0]`).

Benchmarked with [`microbe`](../../../microbe) (5 rounds × 1e7 iterations, shuffled order) across Node.js v20, v22, v24, and v26.

---

## 1. Candidate Families

| Family | Approach | Candidates | Idea |
|---|---|---|---|
| **1. Parallel 16-bit** | 4-way limb split | `limb16-parallel-*` (7) | Splits inputs into 16-bit halves `(ah, al)` and `(bh, bl)`. Computes all 4 partial products (`al*bl`, `ah*bl`, `al*bh`, `ah*bh`) and sums carries. |
| **2. Pipelined 16-bit** | 2-stage carry chain | `limb16-pipeline-*` (8) | Folds carries sequentially: `ahbl = ah*bl + (al*bl >>> 16)`, then `albh = al*bh + (ahbl & 0xFFFF)`. Reduces register live ranges. |
| **3. Float48** | 48-bit middle sum | `limb16-float48-*` (2) | Accumulates cross terms in float64 (sum is under 2^33, fits within 53-bit mantissa). |
| **4. Float64 Corrected** | Float64 + analytical fix | `float64-corrected` (1) | `hi = ((a * b - lo) * 2^-32 + 0.5) >>> 0`. Exact for all 2^64 pairs (max float error is 1024, so error * 2^-32 << 0.5). |
| **5. BigInt** | 64-bit BigInt / Oracle | `bigint-*` (7) | Reference oracle (`bigint-literal-mask`) and `BigInt.asUintN` / hybrid variants. |

---

## 2. Benchmark Results

### A. `Uint32Array(2)` Output Buffer

| Candidate / Family | Node v20 (M/s) | Node v22 (M/s) | Node v24 (M/s) | Node v26 (M/s) | Notes |
|---|:---:|:---:|:---:|:---:|---|
| **`limb16_pipeline_imul_import`** | 233.4 | **278.3** | **278.3** | **278.4** | Inlines imported `mul(a, b)` with zero overhead |
| **`limb16_pipeline_imul_all`** | **238.7** | 277.8 | 276.6 | 276.7 | Pure `Math.imul` pipeline |
| **`limb16_parallel_imul_*`** | ~238 | ~277 | ~277 | ~277 | All parallel `imul` variants hit the same ceiling |
| **`float64_corrected`** | 238.4 | 264.9 | 257.6 | 264.2 | ~95% of peak; 1 `imul` + 1 float `mul` |
| **`limb16_float48_imul_lo`** | 175.1 | 193.5 | 190.8 | 103.4 | JIT struggles with int/float register mixing |
| **`limb16_*_bitwise_lo`** | ~140–151 | ~151–157 | ~151–157 | ~150–157 | ~45% slower without hardware `imul` |
| **`bigint-as-uint64-imul-lo`** | 24.1 | 20.7 | 21.1 | 20.6 | Capped by BigInt heap allocation |
| **`bigint_literal_mask` (Oracle)** | 5.6 | 5.3 | 5.2 | 5.5 | Reference oracle |

### B. JS Array `[0, 0]` Output Buffer

| Candidate / Family | Node v20 (M/s) | Node v22 (M/s) | Node v24 (M/s) | Node v26 (M/s) | Notes |
|---|:---:|:---:|:---:|:---:|---|
| **`limb16_*_smi`** | **~183** | **~196–200** | **~221–225** | **~216–227** | Signed coercion (`\| 0`) keeps array in `PACKED_SMI_ELEMENTS` |
| **`float64_corrected`** | 106.6 | 101.1 | 106.4 | **240.4** | Faster on v26 due to better double unboxing in arrays |
| **`limb16_*` (non-SMI / `>>> 0`)** | ~96–100 | ~99–105 | ~99–102 | ~188–195 | **2x drop on v20–v24** (array transitions to doubles/heap numbers) |
| **`bigint_*`** | 5.5–23.4 | 5.2–19.0 | 5.2–20.5 | 5.3–20.4 | Bottlenecked by BigInt allocations |

---

## 3. Key Findings

### The JS Array SMI Cliff (`Uint32Array` vs `Array [0, 0]`)
- **The `out` buffer difference**: Because `wmul(a, b, out)` writes its 64-bit result in-place into `out[0] = hi` and `out[1] = lo`, the memory backing of the destination container determines write throughput.
- **TypedArrays (`Uint32Array(2)`)**: TypedArrays are unboxed contiguous memory blocks where element writes (`out[0] = hi`) compile directly to raw machine stores (`mov DWORD PTR [rdi], eax`), sustaining peak throughput (~278 M/s).
- **Standard JS arrays (`[0, 0]`)**: Standard arrays start with the `PACKED_SMI_ELEMENTS` map. On 64-bit Node, a Small Integer (Smi) is a 32-bit **signed** integer in `[-2^31, 2^31 - 1]`.
- **The transition**: When kernels write unsigned 32-bit values with the high bit set (`>= 0x80000000`) into `out` using `>>> 0`, the value exceeds the signed 32-bit Smi range. V8 is forced to transition the array from `PACKED_SMI_ELEMENTS` to `PACKED_DOUBLE_ELEMENTS` or allocate boxed `HeapNumber` objects, cutting throughput by half (~97–100 M/s vs ~183–225 M/s) on Node 20–24.
- **The fix**: Applying signed 32-bit coercion (`| 0`) before writing to `out` (in the `*_smi` variants) keeps all written elements inside the Smi range, preserving `PACKED_SMI_ELEMENTS` and running at full speed.

### The 12-Candidate SSA Isomorphism Paradox (Parallel vs Pipeline Equivalence)
- **The Observation**: When measured with hardware PMU counters (`#microbe/cycles`), all 12 variants across the "Parallel" and "Pipeline" families (`imul_lo`, `imul_all`, `imul_cached`, `smi`) yield identical results: **exactly 31.00 instructions per operation, ~14.45 peak cycles, and 2.15 IPC**.
- **TurboFan Sea-of-Nodes Graph Collapse**: In JS source code, "parallel" algorithms group multiplications upfront while "pipeline" algorithms chain them sequentially. However, TurboFan lowers JavaScript AST into a Sea-of-Nodes Static Single Assignment (SSA) representation where statement ordering is discarded. Because both algorithms compute the same partial products and carries, their dependency graphs are mathematically isomorphic.
- **Identical Machine Code**: TurboFan's GVN (Global Value Numbering) and instruction selector emit the exact same 31 x86-64 machine instructions in the exact same sequence for both families.
- **Out-of-Order (OoO) Execution Saturation**: On modern superscalar cores (e.g. Intel Skylake with a 224-entry ROB), register renaming dispatches independent micro-ops across 4 integer ALU ports (Ports 0, 1, 5, 6). Execution is strictly bound by the ~14.45-cycle critical dependency chain of carry additions.

### The `imul_import` Sub-Op Delta (+1 Instruction)
- Earlier time-domain benchmarks (M/s) concluded that importing `const mul = require('#u32/mul')` had "zero overhead" (278.3 M/s vs 277.8 M/s).
- Hardware PMU disassembly (`--print-opt-code`) reveals a subtle microarchitectural artifact:
  - `mul(a, b)` wraps `Math.imul(a, b) >>> 0`. While inlined, the `>>> 0` return boundary creates an extra representation node in TurboFan's graph.
  - This forces the register allocator to insert **one extra register copy** (`movl rdi, rcx`) before the carry shift/mask, increasing the loop body from **31 to 32 instructions**.
  - Peak latency increases from **14.45 cycles to 14.83 cycles** (+0.38 cyc), reflecting the retirement of that extra move instruction.

### Hardware `Math.imul` vs Bitwise Synthesis (`bitwise_lo`)
- Older JS arithmetic libraries synthesized 32-bit multiplication using manual 16-bit limb shift-and-add logic (`limb16_*_bitwise_lo`) to avoid floating-point rounding before `Math.imul` was standardized.
- **Why `bitwise_lo` is only 33 instructions (only +2 instructions)**: Naive intuition expects manual 32-bit synthesis to require dozens of instructions. However, the 16-bit wide multiplication pipeline **already calculated** `al * bl` (in `rbx`) and `al * bh + hll` (in `rax`) to compute high-word carries. Assembling the low word only requires `shll rsi, 16`, `movzxwl rbx, rbx`, and `orl rsi, rbx` (3 instructions replacing 1 `imull`), resulting in a net delta of exactly +2 instructions (33 vs 31).
- **The Critical-Path Penalty**: Despite only adding 2 instructions, `bitwise_lo` takes **15.92–16.02 cycles** (+1.5 cycles, ~10% slower). `imull` runs independently on Execution Port 1, whereas `bitwise_lo` serializes onto the already-loaded carry dependency chain.

### Exact Analytical Correction in `float64-corrected`
- Standard IEEE-754 doubles have 53 bits of precision. Multiplying two 32-bit integers in double precision ($a \times b < 2^{64}$) loses up to 11 bits of precision, with a maximum rounding error bounded by 1024.
- By getting the exact low 32 bits ($lo$) via `Math.imul`, subtracting it gives `hi * 2^32 + error`. Multiplying by `2^-32` shrinks the error to at most `1024 * 2^-32 ≈ 2.38e-7 << 0.5`.
- Adding `0.5` places the value safely in the center of the integer rounding interval, making `>>> 0` truncation 100% exact for all $2^{64}$ possible input pairs.
- With only 1 integer multiplication and 1 float multiplication, it reaches ~95% of peak TypedArray performance and won Node 26 array benchmarks (240.4 M/s) thanks to newer V8 float-unboxing optimizations.

### The BigInt Heap Allocation Wall
- Native BigInt arithmetic (`BigInt(a) * BigInt(b)`) is mathematically exact and readable, but every BigInt operation allocates a heap object.
- In tight loops, these short-lived heap allocations flood the young-generation nursery and trigger frequent GC scavenges. This caps BigInt throughput at 20–24 M/s (12x–14x slower than 16-bit limb arithmetic), making it unsuitable for hot arithmetic loops.

---

## 4. Running the Showdown

```bash
# Using npm script
npm run u32:wmul:showdown

# Directly with node
node src/u32/wmul/candidates/showdown.js
```

Or open `src/u32/wmul/candidates/showdown.js` in VS Code and run it via the **Code Runner** extension (`Ctrl+Alt+N` / `Cmd+Option+N` or *Run Code*).
