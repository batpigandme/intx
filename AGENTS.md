# Formatting Rules
- NEVER use LaTeX formatting (e.g., $$, $, \(, \), \approx, \times, \ge, \le, \text{...}) in your chat responses, agent rule files (`AGENTS.md`, `GEMINI.md`), or agent skills (`SKILL.md`) under any circumstances because the IDE and agent markdown renderers do not support it. This includes math notation, approximations (use `~` or `approx`), inline variables, complexity symbols (use plain `O(N^2)`), comparisons (use `<=`, `>=`), and margins of error (use `+/-`). Always use plain Unicode text or standard Markdown.
- LaTeX formatting ($...$, $$...$$) is strictly and exclusively reserved for GitHub-rendered markdown documentation (e.g., `README.md` and repository docs).
- When inserting benchmark tables, banners, or formatted markdown blocks inside existing `.md` documentation files, NEVER enclose them in triple-backtick markdown blocks (```` ```markdown ... ````); let them render natively as standard Markdown elements.
- **GFM Table Pipe Escaping & Prose Pipe Invariant**:
  - **Inside Table Cells**: In GitHub Flavored Markdown (GFM) tables, NEVER use raw pipe characters `|` inside table cells, even within backticks (e.g. `| 0`), as GFM parsers treat every unescaped `|` as a column delimiter. Always escape them as `\|` (e.g. `\| 0`), or rephrase to avoid pipes in table cells.
  - **Outside Table Cells (Prose, Code Spans, Lists, Headings)**: NEVER escape pipes as `\|`. Use raw `|` (e.g., `| 0`, `a |= 0`). Escaping pipes outside tables causes Markdown engines and Gists to render literal redundant backslashes (`\| 0`).
- **Fragile Math in Table Cells**: Avoid LaTeX/KaTeX math syntax inside Markdown table cells, as unescaped `&`, `<`, and `|` break GFM table parsing and cause "Unable to render expression" errors. Use clean standard Markdown, backticks, or escaped operators.
- **Mermaid Safety & Gist Rendering Invariant**:
  - GitHub Gists (`gist.github.com`) do NOT support Mermaid; use clean ASCII box-and-arrow diagrams for Gist content or portable terminal output.
  - When authoring Mermaid diagrams for GitHub repository markdown, NEVER use raw `<` or `<=` inside node labels (Mermaid parses `<` as the opening of an unclosed HTML tag and crashes with a syntax error); use `&le;`, words (`up to`), or standard ASCII. Always use valid XHTML `<br/>` tags for linebreaks.

# Git & Workspace Safety Rules
- When implementing multi-part features or tasks requested in a list/series (e.g. "feature A, then B, then C"), always create separate, granular commits for each logical step so the user can easily review, test, or revert specific components.
- **Conventional Commits Invariant**: All commit messages must strictly follow the Conventional Commits format with a lowercase type and optional scope (e.g., `feat(u64): ...`, `perf(cycles): ...`, `refactor: ...`, `docs: ...`, `test: ...`, `chore: ...`).
- NEVER stage or commit the user's uncommitted work. Always run `git status` first and selectively stage only the exact files touched for the assigned task.
- **Pre-Commit Verification Gate**: Before staging and committing any changes, always verify that `npm test` and `npx @biomejs/biome check` pass with zero errors.
- When performing substantial git resets or restructuring, proactively create a backup branch first.

# Communication & Documentation Style
- **Concise Communication**: Keep chat responses concise, punchy, and scannable. Avoid long walls of text. Use bullet points and compact tables for empirical data.
- **No Collaborative "We"**: Never use "we" or "What We Learned" in repository documentation. Use objective, concise headings (e.g., "Key Findings", "Analysis").
- **No Unsolicited AI Recommendations**: Do NOT add unsolicited advice, opinionated "Production Kernel" suggestions, or generic AI summaries unless specifically requested by the user. Maintain a personal, direct developer lab-notebook tone.
- **Upfront Signature & Contract**: When documenting candidate suites or kernels, always specify the function signature, argument types, and memory allocation contract (`op(a, b, out)`) before benchmark tables and analysis.
- **Relative Repository Links**: Always link to internal modules and tools using relative Markdown links (e.g., `[microbe](../../../microbe)`) instead of raw npm-style handles (e.g. `@microbe`).

# Integer & JIT Arithmetic Rules
- Prefer signed 32-bit integer coercion (`| 0`) over unsigned right shift (`>>> 0`) for intermediate arithmetic operations so both V8 (unboxed) and JavaScriptCore (Int32 NaN-tag) remain in CPU integer ALU registers without deopting into Float64 doubles.
- **Plain Array Smi Eviction Guard**: When output destination buffers are plain JavaScript arrays (`[0, 0]`), returning numbers >= 2^31 via `>>> 0` causes values to exceed the 32-bit signed Smi range (`[-2^31, 2^31 - 1]`). This forces V8 to transition elements from `PACKED_SMI_ELEMENTS` to `PACKED_DOUBLE_ELEMENTS` and allocate `HeapNumber` objects on the GC heap, causing a ~2.2x to 2.5x throughput collapse (~98 M iters/s vs ~227 M iters/s). In contrast, `Uint32Array` buffers lower directly to raw 32-bit machine stores (`mov [rdi], eax`), allowing both representations to run at peak silicon rate. Always use signed integer coercions (`| 0`) when storing into plain JS arrays to preserve Smi packing.
- **Redundant Coercion Elimination**: Never chain `(expr >>> 0) | 0` for signed 32-bit integer generation. In ECMAScript, bitwise OR (`| 0`) directly invokes `ToInt32`, which truncates and wraps into the signed 32-bit range in a single step; the preceding `>>> 0` is redundant Ignition bytecode.
- **Top-Level Constant Binding**: Always import and destructure numeric constants from `#const` (or define constants) strictly at the top-level file scope using `const` (e.g., `const { LOW_16 } = require("#const");`). In CommonJS, top-level single-assignment `const` values fold directly into TurboFan `Int32Constant` machine nodes (`movzxwl`). Never destructure constants inside functions or loop bodies (which introduces runtime property lookups / cell loads), and never declare module constants with `let` or `var`.

# Kernel Architecture & Calling Conventions
- Multi-word compound operations must take scalar word arguments directly (e.g., `(ah, al, bh, bl, out)` or `(ah, al, s, out)`) instead of passing array/buffer wrappers `(a, b, out)` to eliminate array indexing overhead, bounds checks, and polymorphic element kinds.
- **Big-Endian Limb Layout Invariant**: All multi-word functions and destination buffers strictly adhere to Big-Endian word order (`[hi, lo]` for 64-bit; `[w3, w2, w1, w0]` from most-significant to least-significant for 128-bit; `[qh, ql, rh, rl]` for `divmod`). In scalar parameter lists, higher-order words always precede lower-order words (`(ah, al, bh, bl, out)`).
- Destination `out` buffers are strictly required (never optional or defaulted via `out = out || new Uint32Array(...)`) to maintain monomorphic call sites and guarantee zero heap allocation.
- Operations returning multiple compound words (e.g., `divmod`) must write into a single contiguous output buffer (`out[0..3] = [qh, ql, rh, rl]`).

# Candidate Organization & Packaging Rules
- `index.js` files must strictly export ONLY the default/winning canonical function directly (`module.exports = require("./candidates/...")` or direct export).
- NEVER attach or re-export candidate suites onto `index.js` (e.g., do NOT do `mul.candidates = { ... }`), as `package.json` excludes `!**/candidates/**` from the published npm package.
- **Minimal Public Surface & No Leaky Internals**: Never re-export internal orchestration helpers, private timing utilities, or callback parameters in `index.js`. Public module exports must strictly expose only the primary consumer API.
- **Clean Module-Private Identifier Naming**: In module-scoped JavaScript files, avoid Hungarian notation or pseudo-private leading underscores (`_t0`, `_t1`) on top-level variables. Use clean, descriptive identifier names (`startTime`, `stopTime`).
- Candidate tests belong exclusively inside the `candidates/` folder (`<op>/candidates/test.js`). Namespace-level test files (`<namespace>/test.js`) must strictly test only the public exported API.
- **BigInt Ground-Truth Oracle**: Candidate and unit tests must validate against `BigInt` reference computations. Test matrices must include explicit boundary conditions (0, 1, 2^16 - 1, 2^31 - 1, 2^31, 2^32 - 1, 2^64 - 1, signed/unsigned wrap-arounds) and randomized fuzzing vectors generated with `randomU32()` / `randomI32()`.

# Module Format & Tooling Rules
- **Explicit CommonJS Declaration**: Always explicitly define `"type": "commonjs"` in `package.json`. When `"type"` is omitted, Biome defaults `.js` files to ES Modules and falsely flags `'use strict';` as redundant. Explicitly declaring `"type": "commonjs"` natively informs Biome and Node.js without requiring custom rule suppressions in `biome.json`.
- **CommonJS Strict Mode Invariant**: All source, benchmark, and candidate `.js` files must retain `'use strict';` at the top for Node.js runtime strict mode enforcement. NEVER remove `'use strict';` or rename `.js` files to `.cjs`.

# Microbe Benchmarking Conventions
- In `createRunner`, the loop body option is strictly named `loop` (never `body`).
- **Positional Runner Arguments (`(iters, tic, toc)`)**: Always pass iteration counts and clock controls as raw positional arguments directly into runner functions `(iters, tic, toc) => ...` rather than bundling them in an injected context object wrapper (`b`). This ensures arguments stay in CPU machine registers, eliminates heap allocations, and avoids loop-condition property lookups (`i < b.iters`).
- **Setup & Teardown Timing Isolation**: Always place `tic()` immediately before the measurement loop and `toc()` immediately after. Fixture generation, TypedArray allocations, and state resets must execute in `setup` before `tic()`, and value returns in `teardown` after `toc()`, to guarantee zero setup contamination in arithmetic metrics.
- **Deterministic Runner Contracts**: Keep benchmark harness execution paths strictly deterministic. Avoid introducing speculative runtime checks, fallback branches, or polymorphic signatures into timing-sensitive code paths.
- Do NOT include manual numeric prefixes (e.g., `"1. "`, `"2. "`) in runner/candidate titles, as `microbe` automatically prints the `#` index column.
- **Table Width Configuration**: Specify `width: 100` (or `width: 120`) in `bench.suite` and `bench.suite.rank` options when runner titles are descriptive/long to prevent column truncation. For wide tables (such as `#microbe/cycles` with Instructions/IPC columns or candidate showdowns with >15 runners), specify `width: 160`.
- In benchmark runner scripts that spawn child processes, use `process.execPath` instead of hardcoded `"node"` to support Bun, Node, and Deno seamlessly.
- In `bench.suite`, when `mode: "shuffled"` is used, ensure `prime: true` is enabled (automatically defaulted) so that candidate interleaving does not suffer I-cache / BTB switching penalties.
- **Runner Call Boundary Invariance**: Dynamically invoking runner functions from the outer benchmark harness (e.g., `runners[name](...)` or `table[i](...)`) has zero impact on inner-loop inlining. Because the dynamic property lookup occurs once outside the timed loop and the runner closure is an independent `SharedFunctionInfo`, kernels invoked via static lexical/closure bindings inside the loop are inlined monomorphically by TurboFan.
- In `microbe`, the single-runner API is strictly `bench(title, runner, options)` (using `title`, not `name`, matching `compare(title, ...)`).
- In documentation and examples for `microbe`, always demonstrate realistic integer arithmetic kernels (e.g. `u32.mul`) with runnable `bench()` invocations, never non-representative toy algorithms like Fibonacci.

# Hardware Cycle Benchmarking (`#microbe/cycles`)
- When measuring cycle-accurate hardware efficiency (independent of CPU clock frequency scaling and thermal throttling), use the PMU backend: `const cycles = require("#microbe/cycles");`.
- In `cycles.bench.suite`, configure `cycles` (target cycle budget, e.g. `1e6`), `rounds` (e.g. `500`), and `details: true` to output `Median (/op)`, `Best (/op)`, `Ins (/op)`, and `IPC`.
- **Peak IPC Calculation**: Compute IPC strictly using `bestInsPerOp / minCycles` (peak instructions over minimum cycles) to represent true superscalar processor execution capacity, rather than median values.
- **CPU Affinity & Core Pinning**: Always pin hardware cycle benchmark runs to an isolated physical core from the terminal (e.g. Core 2, via `taskset -c 2`) to eliminate Linux scheduler migration penalties, L1/L2 cache evictions, and frequency scaling jitter.
- **4-Decimal Precision for Sub-10 Cycle Kernels**: Dynamically format cycle and instruction counts to 4 decimal places for sub-10 cycle kernels or when `details: true` to expose fractional 1/16 and 1/4 execution port lattices.
- **Boundary Tax Compensation**: Always calibrate and subtract both cycle and instruction boundary taxes (`boundaryTax.cycles`, `boundaryTax.instructions`) to eliminate N-API glue code (~470 instructions) from inner-loop metrics.
- **Raw Hardware Integrity**: Never apply analytical grid snapping by default; keep analytical snapping strictly opt-in (`snap: false` by default) to preserve raw hardware PMU readings and expose true microarchitectural latency.
- **16-Multiple Iteration Alignment**: Align calibrated loop iterations to multiples of 16 (`Math.round(raw / 16) * 16`) to eliminate TurboFan 4x unrolled scalar tail loop epilogues.
- **Sample Duration Strategy**: Use sub-millisecond bursts (`cycles: 1e6`, ~0.3 ms, 500 rounds) to fit between Linux `CONFIG_HZ` APIC timer ticks for pristine silicon cycle floors; use multi-millisecond runs (`cycles: 1e7`, ~3.5 ms, 100 rounds) to lock instruction counts to exact theoretical rational fractions and achieve <= +/-0.2% MoE.
- **Maglev Usurpation Guard**: When benchmarking with >= 1,000 measurement rounds, execute with `--no-maglev` to prevent V8 from recompiling the outer runner wrapper and degrading TurboFan inlining. Standard 100-round runs stay well below Maglev invocation thresholds and do not require flags.

# JIT Inlining & Non-Inlining Benchmarking Rules
- When isolating un-inlined function call overhead, NEVER use dynamic dispatch arrays (`dispatch[i % 3]`) inside inner loops, as array element lookups and modulo arithmetic contaminate execution timing.
- To measure pure hardware `CALL`/`RET` overhead without inlining, use engine-native flags (`--no-turbo-inlining --no-maglev-inlining` on Node, `--v8-flags` on Deno, `JSC_maximumInliningDepth=0` on Bun) via child process spawning (`process.execPath`).
- Avoid redundant no-op input coercions (`a >>>= 0; b >>>= 0;` or `a |= 0; b |= 0;`) when operands are immediately masked (`& 0xffff`) or logically shifted (`>>> 16`), as each redundant statement adds ~6 bytes of Ignition bytecode that consumes the parent's 920-byte cumulative inlining budget.
- **Single-Function Inlining Budget**: V8's single-function inlining budget is strictly **460 bytes** of bytecode (`--max-inlined-bytecode-size=460`). Small leaf functions (<= 27 bytes) receive an automatic priority boost and are exempt from the 920-byte cumulative caller budget up to the 4,600-byte absolute ceiling.
- **Deopt Exponential Backoff Guard**: When designing benchmarks or kernels, ensure strict input type homogeneity and explicit signed coercion (`| 0`) to prevent speculative deopts. An unexpected type causes V8 to bail out and exponentially double the tier-up threshold (30k -> 60k -> 120k ticks), stranding the function in interpreter/Maglev execution.

# JIT Tier-Up & Calibration Rules
- In dynamic iteration calibration, always enforce a sample duration floor (`tierUpFloor >= 0.05` / 50ms) to ensure V8's concurrent TurboFan background compiler finishes and installs before declaring rate stability. Never rely on stability checks on sub-10ms probes alone, as intermediate tiers (Maglev) can appear stable with `< 1%` variance before TurboFan tier-up.
- Once a calibration probe approaches the target duration window (`res.elapsed >= target * 0.75`), clamp iterations directly to `Math.round(rate * target)` rather than blindly doubling (`iters *= 2`) to prevent probe overshoot.
- **Feedback Vector Allocation Floor**: Before invoking `%OptimizeFunctionOnNextCall` or asserting TurboFan tier-up, execute a minimum of 10 warmup iterations with representative monomorphic types to clear V8's 8-call `FeedbackVector` lazy-allocation threshold.
- **Semi-Space Clamping Guard**: When expanding young-generation semi-spaces to suppress Scavenge GC during measurement runs, always specify both `--min-semi-space-size` and `--max-semi-space-size` in tandem. Specifying `--min-semi-space-size` alone silently clamps the nursery to the default platform ceiling (64 MB on 64-bit systems).
- **OSR Timing Shield**: In inner measurement loops, disable On-Stack Replacement via `--no-use-osr` (and `--no-maglev-osr`) to prevent mid-iteration bytecode-to-machine-code replacement from skewing latency and cycle timers.
