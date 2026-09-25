# The coercion tax and the i32 cold-call rows: one cause, two symptoms

**Box: `boxA`, boot 4.** Same CPU model as before (Intel Xeon @ 2.10GHz, family 6 model 207 stepping 2, 4 cores, no
`cpu` event source), but the container rebooted again, at 02:38Z. Nothing here is pooled with boots 1–3. Records:
[`data-boxA/coercion-tax/boot4-record.txt`](data-boxA/coercion-tax/boot4-record.txt). Stock `a8de2d6` throughout,
from a pristine `git archive`. Abdul's code was not modified.

## Verdict

**The coercion tax and the i32 cold-call rows are related.** Both come from the same fact: **when V8 optimizes a loop
through on-stack replacement (OSR, entered mid-loop during one long call), it treats closure variables as unknown
values. The regular compile, which only happens once the function has been called enough, treats them as the
constants they are.** Microbe's fixed-`iters` suites call each runner cold with one long call, so they measure the OSR
code. What that costs depends on the operation:

- **Coercion tax** (`((acc | 0) + c) | 0`, `c` a closure variable). On Node 22 and 24, the OSR code does the add in
  floating point, converting every iteration: about 6 ns against 0.44–0.72 ns. Node 26's OSR code does an integer add,
  so the tax is gone there in this calling pattern. (Through a wrapper after a 2000 × 1e4 warm-up, 9 of 30 Node 26
  runs were still slow for a different, unidentified reason: see
  [`warmup-and-open-items-2026-09-25.md`](warmup-and-open-items-2026-09-25.md) §5.) Coercing `c` in source fixes it on every version. (Node 26 fixed this for `+` only: the same loop with `-` is still slow there, 5.50–5.59 ns on boxD; see [`node24-gap-2026-09-25.md`](node24-gap-2026-09-25.md), boxD follow-up.)
- **i32 div, mod, divmod, rotl, rotr** (`d = 17`, `k = 13` as closure variables). On **every** version, Node 26
  included, the OSR code divides with a hardware `idiv` and rotates with variable shifts. The regular compile divides
  by 17 with a multiply and rotates by a fixed immediate. Writing the operand as a literal makes cold and warm match.
- **The two leftovers aren't separate effects.** divmod's one-block 2.14× on Node 24 was an occasional slow cold run
  (1–2 in 8) on top of the same `idiv` penalty. "Parallel 4x faster cold" is the mirror image: there, the regular
  compile's constant folding produces *slower* code than the OSR compile, on every version.

**Abdul's REPORT.md figure fits.** His Exp 1 section is headed "Results (1e8 iterations, 5 rounds)", a fixed-`iters`,
cold-call measurement. Replaying the cycles harness's own calibration schedule, which starts with small calls, the
uncoerced row runs at full speed on every version.

## Status

| Question | Answer | Evidence |
|---|---|---|
| Does the coercion tax reproduce, cold? | **Yes, Node 22 and 24 only:** 5.76–6.12 ns, against 0.44–0.48 ns on Node 26 | Exp 01 table below, two blocks |
| Warm? | **No** on Node 24 (0.45); Node 22 warm was slow in 1 of 2 blocks (6.16) | same |
| With the cycles harness's calibration schedule? | **No, on every version** (0.44–0.71) | same, `calib` rows |
| Any other Exp 01 row taxed? | **No.** All six others are 0.44–0.78 in every pattern, bar one 1.37 outlier | same |
| i32 rows: is it the closure operand? | **Yes.** Closure operand, cold: div 2.11–2.49 ns, rotl 1.16–1.50. Literal operand: cold within 1.13× of warm in 17 of 18 cells | Reduction table |
| i32 rows: what differs in the code? | OSR compile: `idiv` / variable shifts. Regular compile: `imul` (divide by constant) / `ror` by immediate. Same on 22, 24, 26 | Code counts below |
| divmod 2.14× one-off | Occasional slow cold run: 2 of 8 on Node 22, 1 of 8 on 24, 0 of 8 on 26 (max 2.19). Not version-specific | Repeats table |
| Parallel 4x faster cold | On **all** versions here (cold 0.76–0.81 ns, warm 0.79–1.02). The regular compile folds `c` into `lea` immediates and runs slower | Repeats table; code counts |

## Method

- **Three calling patterns**, driven by [`scratch/osr2.js`](data-boxA/coercion-tax/scratch/osr2.js) over Abdul's own
  runners, with the suite call replaced by an export ([`scratch/exp01.js`](data-boxA/coercion-tax/scratch/exp01.js)):
  - **cold:** one untimed call, then five timed calls, all of 1e8. This is what microbe's fixed-`iters` suites do, and
    how REPORT.md's Exp 1 was headed.
  - **warm:** 2000 untimed calls of 1e4 first, then the same.
  - **calib:** replays the **iteration schedule** of `src/microbe/cycles/calibrate.js`, starting at 100 iterations and
    growing. It needs a cycle count to pick each next call size, so cycles are **estimated** as wall-clock ns × 2.1
    (the box's nominal GHz). **Nothing here is a cycle measurement.** Only the sequence of call sizes is reproduced;
    for example 100, 865, 350551, 826935, … on Node 24. Then 20 timed calls at the calibrated size.
- **Standalone reduction:** [`scratch/reduce-const.js`](data-boxA/i32-cold/scratch/reduce-const.js), no intx code. It
  copies `rotl`, `div` and `mod` inline, builds the runner the way `createRunner` does, and switches the second operand
  between a closure variable and the same value as a literal. `iters` is 1e7, as in `src/i32/showdown.js`.
- **Isolation:** one row, one pattern, one Node version per process, nothing else running, two blocks. Code dumps
  (`--print-opt-code`) were separate untimed runs.

## Why the fold matters, from the code

Node 26.7.0, `rotl`, closure operand (`k = 13`), with the code objects in the order they were installed:

| Run | Code objects | Rotate instructions | Shift instructions |
|---|---|---:|---:|
| cold | 1: TurboFan, OSR | 0 | 15 |
| warm | 1: TurboFan, OSR | 0 | 16 |
| | 2: TurboFan, regular | 4 (`rorl r11,19`) | 5 |

`div` by `d = 17`, same versions:

| | OSR compile | Regular compile |
|---|---|---|
| Node 22.22.2 | 4 `idiv`, 0 `imul` | 0 `idiv`, 2 `imul` |
| Node 24.19.0 | 4 `idiv`, 0 `imul` | 0 `idiv`, 2 `imul` |
| Node 26.7.0 | 4 `idiv`, 0 `imul` | 0 `idiv`, 5 `imul` |

`rorl r11,19` is rotate-left-by-13 written as rotate-right-by-19, with the 13 folded in. The `imul` replaces the
division by a multiply with a magic constant, which a compiler can only do when it knows the divisor. The cold run
never gets the second code object inside its six calls. Presumably each call re-enters the loop through the cached OSR
code, but that's an inference; it wasn't traced.

`i32.add` "Parallel 4x" on Node 24.19.0: the OSR compile keeps `c` in a register (7 `addl reg,reg`, 740 bytes). The
regular compile folds it (0 `addl reg,reg`, 1184 bytes). The folded version measures slower here. **Correction:** the
`leal` count was for the whole function, not the loop. The loop itself uses `subl r,imm32`, and the likely reason it's
slower (a 65-byte loop crossing a cache line) is in
[`warmup-and-open-items-2026-09-25.md`](warmup-and-open-items-2026-09-25.md) §2.

All dumps: [`data-boxA/i32-cold/diag/`](data-boxA/i32-cold/diag/optcode-node26.7.0-rotl-closure-warm.txt).

## What this means for Abdul's numbers

- **Fixed-`iters` suites measure OSR code.** For rows whose loop reads a closure constant, that's slower than the code
  the same kernel gets after ordinary warm-up. By 13× for the uncoerced add on Node 22–24, and 1.4–1.9× for division
  and rotation by a constant on every version. The 60-row sweep flagged only the first at >2×; the second is the
  1.25–2× group it recorded.
- **REPORT.md's Exp 1 explanation** says the uncoerced form makes TurboFan "emit dynamic type-check guards before the
  addition". The Node 24 OSR code dumped in [`node24-gap-2026-09-25.md`](node24-gap-2026-09-25.md) checks `c`'s type
  once, before the loop, and pays per iteration for a floating-point add with int/double conversions, not for guards.
  This is recorded as what the dump shows, for Abdul to weigh.
- **Argument-passing kernels** (tested afterwards, in
  [`warmup-and-open-items-2026-09-25.md`](warmup-and-open-items-2026-09-25.md) §3) are slow in both compiles, with
  nothing to fold. So the warmed closure-constant number is the one that doesn't match how real callers pass operands.

## Recorded, not chased

- **Warm didn't always reach the regular compile before timing:** 4 of 18 closure-operand warm cells in the reduction,
  and Node 22's Exp 01 row 6 in block 2. **Followed up** in
  [`warmup-and-open-items-2026-09-25.md`](warmup-and-open-items-2026-09-25.md) §1: it was not unfinished compilation.
  It was a Node 22 deopt-then-OSR race, plus mid-run slowdowns on the host.
- **Occasional slow cold runs** (divmod 2.54, 2.76, 3.28 ns; one literal-`div` run at 2.78) appear on Node 22 and 24
  and not on 26 in these samples.

### Exploration 01, all seven rows (ns per iteration, median; block 1 / block 2)

| Row | Pattern | Node 22.22.2 | Node 24.19.0 | Node 26.7.0 |
|---|---|---:|---:|---:|
| DCE: Unused Pure Function (Math.imul(42, 17)) | cold | 0.72 / 0.71 | 0.44 / 0.45 | 0.44 / 0.44 |
|  | warm | 0.74 / 0.73 | 0.45 / 0.46 | 0.45 / 0.46 |
|  | calib | 0.74 / 0.71 | 0.44 / 0.45 | 0.44 / 0.45 |
| DCE: Static Invariant Expression ((42 * 17) \| 0) | cold | 0.75 / 0.71 | 0.44 / 0.44 | 0.45 / 0.45 |
|  | warm | 0.71 / 0.73 | 0.44 / 0.44 | 0.52 / 0.44 |
|  | calib | 0.70 / 1.37 | 0.45 / 0.44 | 0.44 / 0.45 |
| Kernel with Context Constant (i32.add(acc, c)) | cold | 0.76 / 0.73 | 0.49 / 0.45 | 0.44 / 0.46 |
|  | warm | 0.70 / 0.72 | 0.46 / 0.45 | 0.45 / 0.48 |
|  | calib | 0.71 / 0.71 | 0.43 / 0.44 | 0.45 / 0.44 |
| Kernel with Inlined Literal (i32.add(acc, 0x9e3779b9)) | cold | 0.71 / 0.71 | 0.45 / 0.46 | 0.49 / 0.46 |
|  | warm | 0.70 / 0.71 | 0.44 / 0.49 | 0.44 / 0.46 |
|  | calib | 0.70 / 0.71 | 0.44 / 0.44 | 0.76 / 0.43 |
| Inline Op with Literal (((acc\|0) + -1640531527)\|0) | cold | 0.72 / 0.71 | 0.44 / 0.44 | 0.45 / 0.45 |
|  | warm | 0.72 / 0.71 | 0.47 / 0.44 | 0.44 / 0.45 |
|  | calib | 0.72 / 0.71 | 0.44 / 0.47 | 0.44 / 0.46 |
| Inline Op with Coerced Context Var (((acc\|0) + (c\|0))\|0) | cold | 0.76 / 0.78 | 0.45 / 0.46 | 0.45 / 0.44 |
|  | warm | 0.74 / 0.77 | 0.45 / 0.49 | 0.55 / 0.44 |
|  | calib | 0.71 / 0.75 | 0.44 / 0.45 | 0.44 / 0.44 |
| Inline Op with Uncoerced Context Var (((acc\|0) + c)\|0) [TRAP] | cold | **6.04 / 6.12** | **5.76 / 5.91** | 0.45 / 0.48 |
|  | warm | **0.70 / 6.16** | 0.45 / 0.45 | 0.44 / 0.44 |
|  | calib | 0.70 / 0.71 | 0.44 / 0.44 | 0.46 / 0.44 |

### Standalone reduction: closure operand vs literal (ns per iteration, median; cold / warm, block 1 then block 2)

| Kernel | Operand | Node 22.22.2 | Node 24.19.0 | Node 26.7.0 |
|---|---|---|---|---|
| `rotl` | closure | 1.50 / 1.23; 1.41 / 1.43 | 1.16 / 0.94; 1.16 / 0.62 | 1.16 / 0.62; 1.18 / 0.65 |
| `rotl` | literal | 0.89 / 0.90; 0.89 / 0.89 | 0.63 / 0.62; 0.63 / 0.62 | 0.62 / 0.62; 0.63 / 0.62 |
| `div` | closure | 2.49 / 1.44; 2.12 / 1.41 | 2.16 / 2.06; 2.12 / 1.41 | 2.12 / 1.18; 2.11 / 1.15 |
| `div` | literal | 1.42 / 1.41; 2.78 / 1.43 | 1.41 / 1.41; 1.43 / 1.42 | 1.17 / 1.21; 1.17 / 1.15 |
| `mod` | closure | 2.18 / 1.43; 2.17 / 1.45 | 2.14 / 1.48; 2.14 / 1.43 | 2.39 / 1.37; 2.12 / 1.41 |
| `mod` | literal | 1.63 / 1.45; 1.55 / 1.42 | 1.58 / 1.42; 1.62 / 1.44 | 1.44 / 1.38; 1.46 / 1.39 |

### Repeats: 8 processes per cell (ns per iteration; min / median / max of the 8 medians)

| Row | Pattern | Node 22.22.2 | Node 24.19.0 | Node 26.7.0 |
|---|---|---:|---:|---:|
| `i32` divmod (iters 1e7) | cold | 2.12 / 2.14 / 3.28 | 2.11 / 2.14 / 2.76 | 2.12 / 2.14 / 2.19 |
|  | warm | 1.70 / 1.71 / 2.59 | 1.54 / 1.56 / 1.57 | 1.54 / 1.57 / 1.59 |
| `i32.add` Parallel 4x (iters 1e8) | cold | 0.76 / 0.78 / 0.80 | 0.76 / 0.78 / 0.80 | 0.77 / 0.77 / 0.81 |
|  | warm | 0.83 / 0.97 / 1.00 | 0.93 / 0.98 / 1.02 | 0.79 / 0.91 / 0.95 |
