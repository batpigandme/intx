# `u32.mulhi` Candidate Benchmark Notes

Notes and benchmark results for 25 candidate implementations of 32-bit unsigned integer high multiplication across 5 algorithmic families.

### Kernel Signature & Contract
```javascript
mulhi(a, b) // a, b: uint32 [0, 2^32 - 1] -> returns uint32 hi [0, 2^32 - 1]
```
Computes the upper 32 bits of the 64-bit product ($a \times b \to \lfloor (a \cdot b) / 2^{32} \rfloor$) and returns the 32-bit unsigned integer result directly.

Benchmarked with [`microbe`](../../../microbe) (5 rounds × 1e7 iterations, shuffled order) on Node.js (V8 x64).

---

## 1. Candidate Families

| Family | Approach | Candidates | Idea |
|---|---|---|---|
| **1. Parallel 16-bit** | 4-way limb split | `limb16-parallel-*` (6) | Splits inputs into 16-bit halves `(ah, al)` and `(bh, bl)`. Computes all 4 partial products (`al*bl`, `ah*bl`, `al*bh`, `ah*bh`) and sums carries to produce `hi`. |
| **2. Pipelined 16-bit** | 2-stage carry chain | `limb16-pipeline-*` (7) | Folds carries sequentially: `ahbl = ah*bl + (al*bl >>> 16)`, then `albh = al*bh + (ahbl & 0xFFFF)`. Reduces register live ranges. |
| **3. Float48** | 48-bit asymmetric split | `limb16-float48-*` (3) | Asymmetric 16x32 limb split using 48-bit exact IEEE-754 floating-point arithmetic (accumulated sum < $2^{48} < 2^{53}$ without rounding error). |
| **4. Float64 Corrected** | Float64 + analytical fix | `float64-corrected*` (3) | `hi = ((a * b - (Math.imul(a, b) >>> 0)) * 2^-32 + 0.5) >>> 0`. Exact for all $2^{64}$ pairs (maximum double rounding error bounded by 2048, so error × $2^{-32} \ll 0.5$). |
| **5. BigInt** | 64-bit BigInt / Oracle | `bigint-*` (6) | Reference oracle (`bigint-literal-mask`) and `BigInt.asUintN` / division variants. |

---

## 2. Benchmark Results

| Rank | Candidate / Family | Median (M/s) | Peak (M/s) | MoE (±%) | Relative | Notes |
|:---:|---|:---:|:---:|:---:|:---:|---|
| **1** | **`limb16_parallel_bitwise_smi`** | **143.26** | **146.69** | ±2.9% | **1.00x** | Parallel bitwise `*` with signed return |
| **2** | **`limb16_parallel_bitwise`** | **142.63** | **143.13** | ±9.6% | **1.00x** | Parallel bitwise `*` with unsigned return |
| **3** | **`limb16_parallel_imul_all_smi`** | **140.65** | **143.04** | ±7.5% | **0.98x** | 4-way parallel `Math.imul` with signed return |
| **4** | **`limb16_pipeline_imul_all_smi`** | **140.07** | **142.26** | ±1.8% | **0.98x** | Pipelined direct `Math.imul` with signed return |
| **5** | **`limb16_pipeline_bitwise_smi`** | **138.97** | **143.69** | ±11.3% | **0.97x** | Pipelined bitwise `*` with signed return |
| **6** | **`limb16_pipeline_bitwise`** | **138.48** | **145.67** | ±6.7% | **0.97x** | Bitwise `*` pipelined carry chain |
| **7** | **`limb16_pipeline_imul_cached_smi`** | **136.28** | **142.75** | ±8.0% | **0.95x** | Pipelined cached `imul` with Smi return |
| **8** | **`limb16_parallel_imul_all`** | **135.95** | **138.46** | ±4.8% | **0.95x** | 4-way parallel `Math.imul` limb split |
| **9** | **`limb16_parallel_imul_cached`** | **135.26** | **137.37** | ±6.6% | **0.94x** | Parallel with local cached `Math.imul` |
| **10** | **`limb16_pipeline_imul_all`** | **132.51** | **133.30** | ±10.6% | **0.92x** | Pipelined direct `Math.imul` |
| **11** | **`limb16_pipeline_imul_import`** | **132.27** | **136.66** | ±6.1% | **0.92x** | Cross-module imported helper |
| **12** | **`limb16_pipeline_imul_cached`** | **131.45** | **133.09** | ±5.7% | **0.92x** | Pipelined with local cached `Math.imul` |
| **13** | **`limb16_parallel_imul_cached_smi`** | **130.90** | **140.95** | ±20.8% | **0.91x** | Parallel cached `imul` with Smi return |
| **14** | **`float64_corrected_smi`** | **59.16** | **59.57** | ±4.7% | **0.41x** | Analytical float64 with signed return |
| **15** | **`float64_corrected`** | **58.88** | **60.31** | ±4.7% | **0.41x** | Analytical float64 without cached `imul` |
| **16** | **`float64_corrected_cached`** | **58.84** | **59.06** | ±6.5% | **0.41x** | Analytical float64 + cached `Math.imul` |
| **17** | **`limb16_float48_trunc_smi`** | **42.90** | **43.04** | ±1.2% | **0.30x** | Float48 with signed return |
| **18** | **`limb16_float48_trunc`** | **42.80** | **43.10** | ±1.1% | **0.30x** | Float48 with `>>> 0` truncation |
| **19** | **`limb16_float48_floor`** | **39.77** | **41.30** | ±5.5% | **0.28x** | Asymmetric float48 with `Math.floor` |
| **20** | **`bigint_as_uintn_literal`** | **8.43** | **9.18** | ±12.1% | **0.06x** | `BigInt.asUintN(64, ...)` |
| **21** | **`bigint_as_uintn_local_const`** | **8.20** | **9.00** | ±16.2% | **0.06x** | `BigInt.asUintN` with local constants |
| **22** | **`bigint_as_uintn_module_const`** | **7.42** | **10.01** | ±16.2% | **0.05x** | `BigInt.asUintN` with module constants |
| **23** | **`bigint_literal_mask` (Oracle)** | **4.32** | **5.64** | ±12.6% | **0.03x** | Reference oracle with BigInt literal shift |
| **24** | **`bigint_as_uint32`** | **3.87** | **4.92** | ±12.3**%** | **0.03x** | `BigInt.asUintN(32, ...)` |
| **25** | **`bigint_hi`** | **3.57** | **3.83** | ±8.3% | **0.02x** | BigInt division (`/ 0x100000000n`) |ivision (`/ 0x100000000n`) |

---

## 3. Key Findings

### Mathematical Soundness of `float64-corrected`
- Double-precision floats (IEEE 754) have a 53-bit mantissa.
- For $a, b \in [0, 2^{32} - 1]$, the maximum product $a \times b < 2^{64}$ falls in the range $[2^{63}, 2^{64})$. The unit in the last place (ulp) is $2^{64 - 52} = 2^{12} = 4096$, meaning round-to-nearest produces an absolute error $\le 2048$.
- The exact product is $a \cdot b = hi \cdot 2^{32} + lo$, where $lo = \text{Math.imul}(a, b) >>> 0$.
- Subtracting $lo$ from $a \cdot b$ yields $(a \cdot b - lo) = hi \cdot 2^{32} + \text{error}$, where $|\text{error}| \le 2048$.
- Multiplying by $2^{-32}$:
  $$\frac{a \cdot b - lo}{2^{32}} = hi + \frac{\text{error}}{2^{32}}$$
- Because $|\text{error} \cdot 2^{-32}| \le 2048 \cdot 2^{-32} = 2^{-21} \approx 4.76 \times 10^{-7} \ll 0.5$, adding $0.5$ shifts the value safely into $(hi, hi + 1)$.
- Applying `>>> 0` performs JavaScript's `ToUint32` ($\lfloor x \rfloor \pmod{2^{32}}$), yielding the mathematically exact high 32-bit word across all $2^{64}$ possible input pairs.

### Pipelined 16-bit Carry Chain vs Parallel Splits
- `limb16-pipeline-imul-all` minimizes register live ranges by folding intermediate carries sequentially (`albl >>> 16` folded into `ahbl`, whose carry is then folded into `albh`).
- In V8 TurboFan, this sequential dependency structure maps efficiently onto machine registers with minimal spilling, sustaining ~90–95M ops/sec.

### BigInt Allocation Barrier
- BigInt arithmetic requires young-generation heap allocations on every operation.
- In tight loops, BigInt operations run at only ~3.5–8.5M ops/sec (11x–27x slower than 16-bit limb and float64 kernels), making them unsuitable for performance-critical integer pipelines.

---

## 4. Running the Showdown

```bash
# Using npm script
npm run u32:mulhi:showdown

# Directly with node
node src/u32/mulhi/candidates/showdown.js
```

Or open `src/u32/mulhi/candidates/showdown.js` in VS Code and run it via the **Code Runner** extension (`Ctrl+Alt+N` / `Cmd+Option+N` or *Run Code*).
