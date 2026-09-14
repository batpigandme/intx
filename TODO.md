# Project Roadmap & TODOs

## 1. Benchmarking & Tooling Infrastructure
- [x] **Rename `benchx` to `microbe`** (`microbe[nchmark]`):
  - Renamed `src/benchx/` to `src/microbe/`.
  - Updated subpath import in `package.json` (`#microbe`).
  - Added full benchmark test and runner suites.
- [x] **L1 Buffer Walk Benchmark Pattern**:
  - Replaced decaying serial recurrence in division / modulo benchmarks with 1,024-element L1 cached test vector buffer.
  - Utilized `(idx + 1) & 1023` to trigger TurboFan Bounds Check Elimination (BCE) and branch-free evaluation.
- [ ] **Build `testx` Tool**:
  - Implement a modular candidate validation and fuzz testing harness matching the design of `microbe`.
- [ ] **Rebuild Browser Benchmarking UI**:
  - Re-integrate the browser-based benchmark harness (`tmp/benchx/browser`) to work with the declarative `microbe` runner.

---

## 2. Kernels & Operation Namespaces
- [x] **`u32.mulhi` & Candidate Showdown**:
  - Implemented 25 candidate kernels across 5 algorithmic families.
  - BigInt oracle verification & 100k random fuzzing test suite.
  - Monomorphic JIT showdown runner (`npm run u32:mulhi:showdown`).
- [x] **`u32.mulwide` & Refactoring**:
  - Standardized widening 32x32 -> 64-bit multiplication as `mulwide` across namespaces.
  - Created 24 candidates, verified against BigInt oracle, and added dedicated showdown runner (`npm run u32:mulwide:showdown`).
- [x] **`i32` Operations & Showdowns**:
  - Implemented all operations (`add`, `sub`, `mul`, `div`, `mod`, `divmod`, `clz`, `rotl`, `rotr`) in `src/i32/`.
  - Added dedicated showdown harnesses (`i32:showdown`, `i32:add:showdown`, `i32:mul:showdown`).
  - Documented x86 divider architecture, `divmod` algebraic optimization, and C vs JS empirical comparison in `integer-notes.md`.
- [ ] **`u32` Core Operations**:
  - Implement `u32.add`, `u32.sub`, `u32.div`, `u32.mod`, `u32.divmod`, `u32.rotl`, `u32.rotr`.
- [ ] **Multi-Word Namespaces (`u64`, `i64`, `u128`)**:
  - Implement `u64` compound arithmetic (`add`, `sub`, `mul`, `mulhi`, `mulwide`, `div`, `mod`, `divmod`, `shl`, `shr`, `rotl`, `rotr`, `clz`).
  - Implement `u128` multi-word arithmetic and widening operations.
- [ ] **Strided `u32.mulwide` & `@stdlib/muldw` Baseline**:
  - Implement strided variants of `u32.mulwide` (`fn(a, b, out, offset)`).
  - Add `@stdlib/muldw-cjs` into `src/u32/mulwide/candidates/bench.js` for comparative analysis.
- [ ] **Adopt Shared Constants in Kernels**:
  - Update kernels across all namespaces to import constants from `src/const/index.js` (`LOW_16`, `TWO_16`, `MASK_32`, `SIGN_BIT_32`, etc.).

---

## 3. Codebase Hygiene & Maintenance
- [x] **Namespace Standardization**:
  - Replaced all legacy `wmul` / `muldw` references with canonical `mulwide`.
  - Standardized on `mod` (over `rem`) and compound buffer writes `(a, b, out)`.
- [x] **Directory Sanitization**:
  - Cleaned up empty candidate directory scaffolds across `src/u32/`, `src/u64/`, and `src/u128/`.
- [x] **Biome Formatting & Linting**:
  - Ensured 100% compliance across `src/` with `npx @biomejs/biome check`.
