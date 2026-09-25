# Warm-up: what reaches the optimized code, and the open items from the coercion-tax note

**Box: `boxA`, boot 4** (same boot as [`coercion-tax-and-i32-cold-2026-09-25.md`](coercion-tax-and-i32-cold-2026-09-25.md);
record in [`data-boxA/coercion-tax/boot4-record.txt`](data-boxA/coercion-tax/boot4-record.txt)). Stock `a8de2d6`,
scratch files only. Node 22.22.2 (V8 12.4), 24.19.0 (V8 13.6), 26.7.0 (V8 14.6).

## Verdict

**A better warm-up exists: many tiny calls.** About 20000 calls of 100 iterations each (8–16 ms) reached the
fully-optimized code in 9–12 of 12 runs, for every closure-constant case on every Node version, whether the runner was
called directly or through a wrapper. None of the other strategies managed that everywhere.

- **The warm-up in earlier notes** (2000 × 1e4) worked when called directly but failed on Node 24 through a wrapper:
  0 of 12 fast.
- **microbe's own `calibrate()`** at its 50 ms target failed on Node 22 and 24 for these kernels, 0 of 12, as badly as
  no warm-up. It starts with small calls, but it grows them quickly into calls long enough to be optimized through
  on-stack replacement.

**But warm-up can't fix what the harness measures.** A kernel that takes its operand as an **argument**, the way real
code does, is slow in *both* compiles on every version: no compile can fold a value it doesn't know. So for the i32
div and rotl rows, the warmed-up closure-constant number measures a constant fold that real callers don't get, and the
cold number is the closer match. Which number is "right" depends on the question. The one thing that removes the
ambiguity is passing operands the way callers do.

**The open items from the last note:**

- **Warm runs that stayed slow** have two separate causes:
  1. **A JIT race on Node 22.** The regular compile deoptimized once, on the inlined `tic()` call at the top of the
     runner, and was never rebuilt. Every later call ran the OSR code.
  2. **Mid-run slowdowns** with no JIT event at all, which point at the machine.
- **Parallel 4x:** it isn't the `lea` form I described before; that count came from elsewhere in the function. The two
  loops are the same 14 instructions, except that the regular compile uses a 32-bit immediate, which makes its loop 65
  bytes and one byte past a cache line. The OSR loop is 50 bytes. That fits a front-end cost, but it can't be
  confirmed without hardware counters.

**One surprise, left open.** On Node 26, through a wrapper, with the 2000 × 1e4 warm-up, 9 of 30 runs of the
uncoerced-add row took about 6 ns. Neither of the two optimized code objects V8 built in those runs contains a
floating-point add; both loops are plain integer code. So the slow timed calls weren't running either optimized code
object, and what they did run wasn't identified. This means the claim that Node 26 fixed this row holds for the cold
pattern and for direct calls, but not for every calling structure, and only for `+`: with `-` the loop is still
slow on Node 26 (5.50–5.59 ns; [`node24-gap-2026-09-25.md`](node24-gap-2026-09-25.md), boxD follow-up).

## Status

| Item | Result |
|---|---|
| Warm-up reaching the regular compile before timing | Checked: in 18 of 18 traced direct-call runs the regular compile finished before warm-up ended |
| Why some warm runs were still slow | **Two causes:** a Node 22 deopt-then-OSR-forever race (caught 2 in 66 traced runs), and mid-run slowdowns with no JIT event (machine) |
| Parallel 4x faster cold | Same 14-instruction loop; regular compile's loop is 65 bytes (crosses a 64-byte line) against 50. Cause unconfirmed without PMU |
| Argument-operand kernels | Slow cold **and** warm on every version: div ≈2.13 ns, rotl ≈1.15–1.43 ns |
| Better warm-up | **S2, 20000 × 100:** reliable on every version, direct or wrapped, 8–16 ms |
| microbe's `calibrate(50)` as a warm-up | 0/12 on Node 22 and 24 for closure-constant kernels; 8–12/12 on Node 26 |
| Node 26 wrapper + S1 slow runs | **Open:** 9 of 30 at ~6 ns; not the floating-point add; code actually run not identified |


## §1. Why some warm runs stayed slow

**Direct calls, traced** (`--trace-opt`, with markers printed at the end of warm-up and the start of timing; untimed
runs): in 18 of 18 runs across the three Node versions, the regular TurboFan compile of the div kernel completed before
warm-up ended. So "not enough warm-up" isn't the usual story. Untraced, the same cells were slow in 1–3 of 20 runs.

**Cause 1: a JIT race (Node 22, Exp 01 row 6).** Caught 2 slow runs in 66 traced ones. In both, the regular compile
was built, then deoptimized once with `Insufficient type feedback for generic named access` at bytecode offset 5.
That's the `tic()` call at the top of the runner (`CallUndefinedReceiver0 a1` at offset 3), inlined into the runner. It
was never rebuilt. After that, every call, all 2000 of the warm-up and the timed ones, entered through the cached OSR
code: 2002 OSR entries, against 41 in a fast run. Traces:
[`data-boxA/warmup/diag/slow-warm/`](data-boxA/warmup/diag/slow-warm/node22-exp01r6-warm-slow-1.txt).

**Cause 2: the machine (Node 24, rotl and div).** In the caught runs the regular compile finished before warm-up
ended, and there's no compile or deopt event afterwards. The per-call times still step up partway through a run:
rotl went 0.63, 0.66, 0.85, 0.95, 0.94 ns; div went 1.41, 1.41, 1.96, 2.64, 2.65 ns. The same code got slower, which
points at the host (another tenant, or a frequency change), not at V8. The earlier divmod outliers show the same stepped
shape.

**Also visible in the bytecode:** `c` is read with `LdaImmutableCurrentContextSlot`. V8 knows the closure slot never
changes, which is what lets the regular compile fold it. The OSR compile doesn't use that.

## §2. Parallel 4x: the loop bodies

Node 24.19.0, from the saved dumps:

| | OSR compile (cold) | Regular compile (warm) |
|---|---|---|
| Loop instructions | 14 | 14 |
| The four accumulator adds | `addl r11,r9` (register) | `subl r11,0x61c88647` (`c` folded as a 32-bit immediate) |
| Loop size | 50 bytes | 65 bytes |
| Crosses a 64-byte line | no | yes, by 1 byte |
| 32-byte fetch windows spanned | 2 | 3 |
| Measured (repeats, ns per iteration) | 0.76–0.81 | 0.79–1.02 |

The earlier note said the regular compile used `leal`. It has 9 `leal` in the whole function, but none in the loop, so
that was the wrong place to look. The loop difference is the immediate operand. A loop that no longer fits one cache
line is a plausible front-end cost, but this box has no hardware counters to confirm it, so it stays a hypothesis.

## §3. Operand passed as an argument

[`scratch/reduce-const.js`](data-boxA/i32-cold/scratch/reduce-const.js) gained an `arg` operand: the runner receives
`d` or `k` as a fourth parameter on every call. From the warm-up comparison below, medians of 12 runs:

| Kernel | Node | Argument, cold (S0) | Argument, tiny-call warm (S2) | Closure, cold (S0) | Closure, tiny-call warm (S2) |
|---|---|---:|---:|---:|---:|
| div | 22.22.2 | 2.13 | 2.12 | 2.14 | 1.42 |
| | 24.19.0 | 2.13 | 2.12 | 2.15 | 1.47 |
| | 26.7.0 | 2.13 | 2.14 | 2.14 | 1.17 |
| rotl | 22.22.2 | 1.42 | 1.43 | 1.44 | 0.88 |
| | 24.19.0 | 1.17 | 1.42 | 1.17 | 0.62 |
| | 26.7.0 | 1.17 | 1.18 | 1.18 | 0.62 |

With the operand as an argument, warm-up doesn't reach a faster fold, because there's nothing to fold. The closure-cold
column is close to the argument columns. On Node 24, rotl with an argument is **slower** after the tiny-call warm-up
(1.42 against 1.17): the choice of warm-up can move even a fold-free kernel by about 20%. That wasn't investigated.

## §4. Warm-up strategies compared

Five strategies before the same timed measurement (1 untimed + 5 timed calls of N; N = 1e8 for Exp 01 row 6, 1e7 for
the kernels), driven by [`scratch/warm3.js`](data-boxA/warmup/scratch/warm3.js). The runner is called through a small
wrapper, which is how microbe calls it too (`sample(runner, iters)`).

- **S0** none
- **S1** 2000 × 1e4, the warm-up used in earlier notes
- **S2** 20000 × 100: calls short enough that the loop never triggers on-stack replacement
- **S3** S2, then a 20 ms `Atomics.wait` pause for background compilation, then 200 × 100
- **S4** stock `src/microbe/calibrate.js` `calibrate(runner, 50)`, microbe's own wall-clock warm-up, called directly

Each cell: runs out of 12 within 15% of the fastest run seen for that case and version · median ns per iteration ·
median warm-up time. The repeats were interleaved across strategies, so drift on the host is spread evenly. For the
argument cases the "fastest" run is often only slightly faster, so read their counts as consistency, not as reaching a
better code path.

| Case | Node | S0 none | S1 2000×1e4 | S2 20000×100 | S3 S2 + settle | S4 microbe `calibrate(50)` |
|---|---|---|---|---|---|---|
| Exp 01 row 6 (uncoerced closure add) | 22.22.2 | 0/12 · 6.14 ns · 0 ms | 11/12 · 0.72 ns · 18 ms | 12/12 · 0.73 ns · 8 ms | 9/12 · 0.74 ns · 28 ms | 0/12 · 6.10 ns · 113 ms |
|  | 24.19.0 | 0/12 · 5.87 ns · 0 ms | 0/12 · 6.05 ns · 100 ms | 9/12 · 0.46 ns · 16 ms | 11/12 · 0.45 ns · 35 ms | 0/12 · 5.87 ns · 91 ms |
|  | 26.7.0 | 12/12 · 0.45 ns · 0 ms | 11/12 · 0.45 ns · 14 ms | 12/12 · 0.45 ns · 15 ms | 11/12 · 0.45 ns · 29 ms | 12/12 · 0.45 ns · 90 ms |
| div, closure operand | 22.22.2 | 0/12 · 2.14 ns · 0 ms | 11/12 · 1.43 ns · 40 ms | 10/12 · 1.42 ns · 9 ms | 11/12 · 1.43 ns · 29 ms | 0/12 · 2.12 ns · 117 ms |
|  | 24.19.0 | 0/12 · 2.15 ns · 0 ms | 0/12 · 1.89 ns · 40 ms | 11/12 · 1.47 ns · 10 ms | 11/12 · 1.43 ns · 30 ms | 0/12 · 2.13 ns · 212 ms |
|  | 26.7.0 | 0/12 · 2.14 ns · 0 ms | 10/12 · 1.17 ns · 27 ms | 11/12 · 1.17 ns · 8 ms | 11/12 · 1.16 ns · 29 ms | 8/12 · 1.17 ns · 187 ms |
| rotl, closure operand | 22.22.2 | 0/12 · 1.44 ns · 0 ms | 8/12 · 0.89 ns · 30 ms | 12/12 · 0.88 ns · 8 ms | 12/12 · 0.89 ns · 28 ms | 0/12 · 1.42 ns · 175 ms |
|  | 24.19.0 | 0/12 · 1.17 ns · 0 ms | 0/12 · 0.89 ns · 20 ms | 12/12 · 0.62 ns · 8 ms | 12/12 · 0.62 ns · 28 ms | 0/12 · 1.16 ns · 173 ms |
|  | 26.7.0 | 0/12 · 1.18 ns · 0 ms | 9/12 · 0.63 ns · 16 ms | 12/12 · 0.62 ns · 8 ms | 10/12 · 0.62 ns · 28 ms | 10/12 · 0.62 ns · 181 ms |
| div, argument operand | 22.22.2 | 11/12 · 2.13 ns · 0 ms | 11/12 · 2.13 ns · 49 ms | 12/12 · 2.12 ns · 10 ms | 12/12 · 2.14 ns · 31 ms | 11/12 · 2.12 ns · 120 ms |
|  | 24.19.0 | 1/12 · 2.13 ns · 0 ms | 12/12 · 1.86 ns · 42 ms | 1/12 · 2.12 ns · 10 ms | 1/12 · 2.14 ns · 31 ms | 1/12 · 2.12 ns · 184 ms |
|  | 26.7.0 | 0/12 · 2.13 ns · 0 ms | 1/12 · 2.12 ns · 45 ms | 0/12 · 2.14 ns · 10 ms | 0/12 · 2.13 ns · 31 ms | 0/12 · 2.12 ns · 213 ms |
| rotl, argument operand | 22.22.2 | 9/12 · 1.42 ns · 0 ms | 12/12 · 1.42 ns · 32 ms | 10/12 · 1.43 ns · 9 ms | 11/12 · 1.43 ns · 29 ms | 11/12 · 1.42 ns · 120 ms |
|  | 24.19.0 | 10/12 · 1.17 ns · 0 ms | 11/12 · 1.24 ns · 28 ms | 0/12 · 1.42 ns · 9 ms | 0/12 · 1.43 ns · 29 ms | 12/12 · 1.19 ns · 195 ms |
|  | 26.7.0 | 11/12 · 1.17 ns · 0 ms | 12/12 · 1.19 ns · 26 ms | 11/12 · 1.18 ns · 8 ms | 10/12 · 1.19 ns · 29 ms | 12/12 · 1.16 ns · 200 ms |

### Direct calls against a wrapper

The same S1 and S2 strategies, 6 runs each, alternating a direct call with a wrapped one
([`scratch/warm3-direct.js`](data-boxA/warmup/scratch/warm3-direct.js)). Medians, ns per iteration:

| Case | Node | S1 direct | S1 wrapper | S2 direct | S2 wrapper |
|---|---|---:|---:|---:|---:|
| Exp 01 row 6 | 22.22.2 | 0.71 | 0.75 | 0.71 | 0.71 |
| | 24.19.0 | 0.45 | **5.97** | 0.44 | 0.45 |
| | 26.7.0 | 0.45 | 0.44 (one run 6.21) | 0.45 | 0.46 |
| div, closure | 22.22.2 | 1.43 | 1.43 | 1.42 | 1.42 |
| | 24.19.0 | 1.43 | **1.87** | 1.42 | 1.42 |
| | 26.7.0 | 1.17 | 1.16 | 1.18 | 1.17 |

S1's failure on Node 24 is specific to the wrapper; S2 doesn't care. Why a wrapper changes the outcome for S1 wasn't
investigated.

## §5. The open surprise: Node 26 through a wrapper

The single 6.21 ns run above led to a focused check: Node 26.7.0, Exp 01 row 6, wrapper, S1, 30 runs. **9 of 30 took
about 6 ns** for all five timed calls. With no warm-up (S0), 0 of 15 did. Data:
[`data-boxA/warmup/node26-exp01r6-check.jsonl`](data-boxA/warmup/node26-exp01r6-check.jsonl).

Known so far:

- **Same compiles in fast and slow runs:** one regular and one OSR TurboFan code object for the runner, and no TurboFan
  deopt. What differs is OSR entries: 290 in a fast run, 15–17 in slow ones, all during warm-up.
- **Neither code object is slow code.** Dumped from a slow run, both are integer loops. The regular one folds `c` as
  `subl rdi,0x61c88647`, unrolled 4×, and should run at about 0.45 ns. **Neither contains a floating-point add**, so
  this isn't the Node 22/24 mechanism.
- **In the slow runs, the warm-up itself was slow** (97.9 ms, against 13 ms in a fast run).

So in slow runs the timed calls are running something other than either optimized code object, and I didn't identify
what. Baseline (Sparkplug) code is one candidate, but it wasn't checked. Traces and dumps:
[`data-boxA/warmup/diag/node26-wrapper/`](data-boxA/warmup/diag/node26-wrapper/optcode-slow.txt). **Consequence:** "Node
26 fixed the coercion tax" holds for the cold pattern and for direct calls, and only for `+` (`-` is still 5.50–5.59 ns
on Node 26). It doesn't hold for every calling structure.

## What this means for microbe

- **For fixed-`iters` suites,** a short run of tiny calls before the timed rounds (about 20000 × 100, around 10 ms) is
  the cheapest way found here to measure the regular compile rather than the OSR one, and it held up through a wrapper.
- **The dynamic calibration** at its default 50 ms target doesn't do that job for closure-constant runners on Node 22
  and 24.
- **Either way,** a runner that reads a constant from its closure measures a fold real callers may not get. Passing
  the operand the way callers do makes the harness question go away.
- **These are observations from one box, not a patch.** Nothing in intx was changed.
