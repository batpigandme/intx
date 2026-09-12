# `u32.wmul` Candidate Benchmark Notes

Notes and benchmark results for 25 candidate implementations of 32-bit wide multiplication ($a \times b \to hi, lo$) across 5 algorithmic families.

Benchmarked with [`microbe`](../../../microbe) (5 rounds × 1e7 iterations, shuffled order) across Node.js v20, v22, v24, and v26.

---

## 1. Candidate Families

| Family | Approach | Candidates | Idea |
|---|---|---|---|
| **1. Parallel 16-bit** | 4-way limb split | `limb16-parallel-*` (7) | $a = a_h 2^{16} + a_l$, $b = b_h 2^{16} + b_l$. Compute all 4 partial products ($a_l b_l, a_h b_l, a_l b_h, a_h b_h$) and sum carries. |
| **2. Pipelined 16-bit** | 2-stage carry chain | `limb16-pipeline-*` (8) | Fold carries as we go: $\text{ahbl} = a_h b_l + (a_l b_l \gg 16)$, then $\text{albh} = a_l b_h + (\text{ahbl} \bmod 2^{16})$. Shorter register live ranges. |
| **3. Float48** | 48-bit middle sum | `limb16-float48-*` (2) | Accumulate cross terms in float64 ($< 2^{33}$, fits within 53-bit mantissa). |
| **4. Float64 Corrected** | Float64 + analytical fix | `float64-corrected` (1) | $hi = \lfloor (a \cdot b - lo) \cdot 2^{-32} + 0.5 \rfloor$. Exact for all $2^{64}$ pairs (float rounding error $|\epsilon| \le 1024 \implies \epsilon \cdot 2^{-32} \ll 0.5$). |
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
| **`limb16_*_smi`** | **~183** | **~196–200** | **~221–225** | **~216–227** | `| 0` keeps array in `PACKED_SMI_ELEMENTS` |
| **`float64_corrected`** | 106.6 | 101.1 | 106.4 | **240.4** | Faster on v26 due to better double unboxing in arrays |
| **`limb16_*` (non-SMI / `>>> 0`)** | ~96–100 | ~99–105 | ~99–102 | ~188–195 | **2x drop on v20–v24** (array transitions to doubles/heap numbers) |
| **`bigint_*`** | 5.5–23.4 | 5.2–19.0 | 5.2–20.5 | 5.3–20.4 | Bottlenecked by BigInt allocations |

---

## 3. Key Findings

- **The JS Array SMI cliff**: On 64-bit Node, Smis are 32-bit signed integers ($[-2^{31}, 2^{31}-1]$). When writing unsigned 32-bit numbers ($\ge 0x80000000$) with `>>> 0` into a JS array, V8 transitions the array from `PACKED_SMI_ELEMENTS` to `PACKED_DOUBLE_ELEMENTS` / heap numbers, halving throughput on Node 20–24. Using `| 0` avoids this entirely.
- **Import inlining is free**: `limb16-pipeline-imul-import` (importing `mul` from `#u32/mul`) runs at the exact same speed as inline `Math.imul` (278.4 M/s). TurboFan inlines small helpers with zero penalty.
- **`Math.imul` vs bitwise**: Bitwise limb multiplication without `Math.imul` is ~45% slower because it can't map to a single x86 `imul` instruction.
- **`float64-corrected` is surprisingly fast and exact**: 1 integer multiplication + 1 float multiplication gets ~95% of peak throughput on TypedArrays and 240 M/s on Node 26 arrays.
- **BigInt is unusable for hot arithmetic**: BigInts top out at 20–24 M/s (12x–14x slower) due to heap allocation and GC churn on every operation.
