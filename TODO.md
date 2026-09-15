# Project Roadmap & TODOs

## 1. Benchmarking & Tooling Infrastructure
- [x] **Rename `benchx` to `microbe`** (`microbe[nchmark]`):
  - Renamed `src/benchx/` to `src/microbe/`.
  - Updated subpath import in `package.json` (`#microbe`).
  - Added full benchmark test and runner suites.
- [x] **L1 Buffer Walk Benchmark Pattern**:
  - Replaced decaying serial recurrence in division / modulo benchmarks with 1,024-element L1 cached test vector buffer.
  - Utilized `(idx + 1) & 1023` to trigger TurboFan Bounds Check Elimination (BCE) and branch-free evaluation.
- [x] **JIT & Microbenchmarking Pattern Explorations**:
  - [x] **Observe DCE in a Bench Run**: Construct a benchmark demonstrator showing dead code elimination (DCE) when pure expressions or unused loop values fold into an empty loop (`explorations/01-dce-and-constants.js`).
  - [x] **Observe No DCE in Closure Constants**: Verify that constants injected via `context` are treated as runtime parameters preventing static folding/DCE while staying hoisted and monomorphic (`explorations/01-dce-and-constants.js`).
  - [x] **Theoretical Peak (Reg-to-Reg) & ILP Exploration for All Ops**:
    - Formulate independent multi-accumulator strategies (1x latency-bound vs 2x, 4x, 8x instruction-level parallelism throughput bounds) across arithmetic and bitwise ops (`explorations/04-reg2reg-ilp.js`).
  - [x] **Read-Only Buffer Walk: BCE vs Non-BCE & Buffer Sizing**:
    - Benchmark Bounds Check Elimination (BCE) vs non-BCE indexing (e.g., `& 0x3ff` vs dynamic modulo or unmasked indices).
    - Test smaller L1 cache footprints (e.g., 1 KB / 256 elements with `& 0xff` hex mask vs 4 KB / 1024 elements with `& 0x3ff`) (`explorations/05-readonly-buffer-walk.js`).
  - [x] **Buffer Mutation: In-Place vs Separate Write Buffers vs Local Allocation**:
    - Benchmark `context` (allocated once) vs local `setup` (allocated per round) buffers.
    - Separate read inputs from write outputs (`inBuf` -> `outBuf`) and compare in-place mutation vs separate output buffer writes (`explorations/06-buffer-mutation.js`).
  - [x] **Observe Loop Producing Constant Value (DCE / DLE)**: Test whether loops that compute invariant or statically predictable values (e.g., identity operations or closed-form expressions) trigger Dead Loop Elimination (`explorations/02-constant-loop-dle.js`).
  - [x] **Observe Aliasing a Context Variable in Local Scope**: Compare accessing closure context variables directly vs aliasing them into local `setup` bindings (`const localC = c;`) to analyze register allocation and context slot load hoisting (`explorations/03-context-aliasing.js`).
  - [x] **Observe Megamorphic IC Degradation on `out` Buffer**: Test whether kernels with an `out` destination parameter (e.g. `divmod(a, b, out)`, `mulwide(a, b, out)`) degrade into polymorphic or megamorphic IC states when passed different backing types (`Int32Array`, `Uint32Array`, generic `Array`, etc.) within the same program or shared call site (`explorations/08-megamorphic-out-param.js`).
  - [x] **Isolate Pure Loop Overhead**:
    - Construct baseline empty loop runners (`for (let i = 0; i < iters; i++) {}`) to accurately measure and subtract loop control overhead (`explorations/07-loop-overhead-isolation.js`).
  - [x] **Signed vs Unsigned `mulwide` Latency & Throughput**:
    - Measure and compare max 1x serial throughput and Hacker's Delight correction latency between `i32.mulwide` and `u32.mulwide` (`explorations/09-mulwide-signed-vs-unsigned.js`).
- [ ] **Cross-Engine & Compiler Deep-Dives**:
  - [ ] **Probe Loop Unrolling Thresholds in V8/TurboFan**:
    - Profile exact compile-time constant trip count boundaries (e.g. `<= 16` or `32` iterations) where TurboFan unrolls and fully eliminates empty loops vs where loop headers and back-edges are emitted.
  - [ ] **Document Empty Loop DLE Across Different Engines**:
    - Document Dead Loop Elimination behavior across runtimes: JavaScriptCore / B3 (Bun, Safari), SpiderMonkey (Firefox), and V8 (Node, Chrome).
  - [ ] **Cross-Check Microbenchmark Findings Across Node Versions & Engines**:
    - Run the exploration benchmark matrix across multiple Node versions (Node 16/18 Crankshaft/TurboFan transition -> Node 20/22/24 Maglev/Concurrent Sparkplug) and alternate engines (Bun/JSC, Deno/V8).
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
