# Project Roadmap & TODOs

## 1. Benchmarking & Tooling Infrastructure
- [ ] **Rename `benchx` to `microbe`** (`microbe[nchmark]`):
  - Rename `src/benchx/` to `src/microbe/`.
  - Update subpath import in `package.json` (`#benchx` -> `#microbe`).
  - Update imports across benchmark files.
- [ ] **Build `testx` Tool**:
  - Implement a modular candidate validation and fuzz testing harness matching the design of `benchx` / `microbe`.
- [ ] **Rebuild Browser Benchmarking UI**:
  - Re-integrate the browser-based benchmark harness (`tmp/benchx/browser`) to work with the declarative `bench.suite()` runner.

---

## 2. Kernels & Operation Namespaces
- [ ] **Strided `u32.wmul` & `@stdlib/muldw` Baseline**:
  - Implement strided variants of `u32.wmul` (`fn(a, b, out, offset)`).
  - Add `@stdlib/muldw-cjs` back into `src/u32/wmul/candidates/bench.js` for comparative analysis.
- [ ] **Adopt Shared Constants in Kernels**:
  - Update kernels across all namespaces to import constants from `src/const/index.js` (`LOW_16`, `TWO_16`, `MASK_32`, `SIGN_BIT_32`, etc.).
- [ ] **Populate Remaining Operations**:
  - **`i32`**: add, sub, div, divmod, clz, shifts, rotates
  - **`u32`**: divmod, add, sub, shifts, rotates
  - **`u64` / `i64`**: add, sub, mul, wmul, div, divmod, shl, shr, rotl, rotr
  - **`u128`**: multi-word arithmetic operations
