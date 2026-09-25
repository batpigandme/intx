# intx on Linux: three things you can act on

For Abdul Kaium. Run on
[`impawstarlight/intx` at `a8de2d6`](https://github.com/impawstarlight/intx/tree/a8de2d6617136153643348a42f26dfb952d9326e),
unmodified, on four cloud Linux boxes across two CPU models, on 2026-09-25 (UTC). Node 22.22.2, 24.19.0 and 26.7.0.
Nothing is pooled across machines or Node versions.

## 1. `node cycles.js` on a fresh clone always says the addon isn't built

`loadPmu()` in `src/microbe/cycles/timer.js` tries to rebuild the addon itself, by running a bare `node-gyp` with
`stdio: "ignore"`. With a local install `node-gyp` isn't on `PATH` (npm puts its bundled copy there only inside
`npm run`), so the rebuild fails silently and you get

```
bench.cycles requires the native PMU addon to be built. Run 'npm run build:native'.
```

even where `npm run build:native` works. It built in seconds on every box.

## 2. `run-all.js` never ran experiment 10

`explorations/run-all.js` lists `01`–`09`. `10-stride-offset-optimization.js` isn't in the sweep. (Separately,
`REPORT.md`'s "Experiment 10" is the calibration deep dive; nothing in it covers the stride/offset file.)

## 3. An uncoerced `+` or `-` on a named value is slow when the loop is entered cold, and Node 26 fixed only `+`

`acc = ((acc | 0) OP c) | 0`, cold, per iteration, on one Cascade Lake box (boxD), two runs:

| | Node 22 | Node 24 | Node 26 |
|---|---:|---:|---:|
| `+ c` | 5.6–5.7 ns | 5.6–5.7 ns | **0.54–0.56 ns** |
| `- c` | 5.6–5.8 ns | 5.6 ns | **5.50–5.59 ns** |
| `+ (c \| 0)` or `- (c \| 0)` | 0.61–0.64 ns | 0.53–0.54 ns | 0.53–0.55 ns |
| `^ c` | 0.73–0.76 ns | 0.54–0.55 ns | 0.54–0.55 ns |

- **When:** only when the loop is first optimized mid-call (on-stack replacement, or OSR). Your fixed-`iters`
  suites do exactly that, because the first call runs all 1e8 iterations. With `--no-use-osr`, or after warming up with
  many small calls, `+ c` runs at full speed on every version.
- **What:** on Node 22 and 24 the OSR code does the add in floating point, converting every iteration. No deopt.
- **It isn't about closures:** `c` as a local `const` initialized from a literal, or as a parameter, is just as slow.
  Only a literal written into the expression is fast. The likely reason is that OSR takes a named value from the
  unoptimized frame and treats it as unknown. That's an inference, not something traced.
- **Node 26 fixed it for `+` and not for `-`.** That matters more than the fix: a loop that subtracts a named,
  uncoerced value still pays about 5 ns per iteration on current Node when it's entered cold.
- **The fix is yours already:** `(c | 0)` removes it for both operators on every version. It's the "Closure Coercion
  Tax" from your `REPORT.md` Exp 1, with a mechanism behind it. Your Exp 1 figure was measured cold ("1e8 iterations,
  5 rounds"), which fits. One detail the machine code doesn't bear out: REPORT.md attributes the tax to per-iteration
  type-check guards, but the Node 24 loop checks `c` once, before the loop, and pays for the floating-point add.

**How far it reaches in your suite:** every loop in the five showdowns and ten explorations was read for this pattern
(34 rows flagged), and each flagged row was measured cold against warmed. **Only the `i32.add` "Inline Operator" row
and Exp 1's `[TRAP]` row are affected** (about 12× on Node 24), and those two are the same code. No row uses `-` this
way, so nothing in the suite hits the Node 26 gap today.

**A milder relative, on every version:** OSR code also doesn't fold named constants. The i32 showdown's div, mod,
divmod, rotl and rotr rows (dividing by `d = 17`, rotating by `k = 13`) run 1.4–1.9× slower cold, on Node 26 too:
hardware `idiv` and variable shifts, where the regular compile uses a multiply and a fixed rotate. But a kernel that
takes the operand **as an argument**, as real callers pass it, can't fold it in either compile, so there the cold
number is the realistic one.

## Context: no hardware cycle counter on any box

`cycles.js`, and explorations 01 and 06, which use `cycles.bench.suite`, can't run here. It isn't permissions:
`perf_event_paranoid` is 2 and the addon builds. The boxes are KVM guests that expose no PMU, so `perf_event_open`
returns `ENOENT`, on both CPU models. With the addon built, the error still blames `perf_event_paranoid`. Everything
else ran twice on each of the first three boxes. (Those per-box tables for the full run aren't in this folder; this
folder holds the follow-up experiments.)

## Two proposed branches

Two independent branches on my fork, `batpigandme/intx`, each based on `a8de2d6`. Either can merge alone, and they merge cleanly in
either order.

- **`fix/pmu-errors-and-run-all`:** fixes items 1 and 2, and makes the "addon built" error stop blaming
  `perf_event_paranoid` when it's already 2 or lower. Three small commits.
- **`feat/cycles-wall-clock-fallback`:** an opt-in fallback. With `MICROBE_CYCLES_FALLBACK=time` and no counter, the
  cycles harness runs on your wall-clock harness, and every title is labelled `[WALL-CLOCK FALLBACK: time, not
  cycles]`. Its design choices are stated in its PR text.

Each branch's PR description gives the evidence and the design choices.

## Also noticed, not investigated

- **Warm-up:** about 20000 calls of 100 iterations (~10 ms) was the only warm-up that reliably reached the fully
  optimized code on every Node version, direct or through a wrapper. microbe's `calibrate()` at 50 ms didn't, on Node
  22 and 24.
- **Open:** on Node 26, through a wrapper with a longer warm-up, 9 of 30 runs of the `+ c` row were still ~6 ns. It
  isn't the floating-point add, and the code those runs executed wasn't identified.
- **Node 24's first runner in a sequential suite can be slow** (06: 1.8–5.7 ns, against 0.89 ns when run last).
- **`limb16_float48_*` candidates are slower on Node 26 than on 24,** except mulhi's `trunc*`.

## Possible next experiments

Yours to pick from; none has been run.

1. **Re-run Exp 1 on your machine, cold and warmed, with `+` and `-`, on Node 24 and 26.** That shows whether the `-`
   gap on 26 reproduces on your hardware.
2. **Check whether module-level `const` values reach OSR code as constants.** Your AGENTS.md relies on top-level
   `const` folding into `Int32Constant`. Here, even a function-local `const` didn't, in OSR code.
3. **Try the tiny-call warm-up before microbe's fixed-`iters` rounds and compare rankings,** keeping in mind that a
   warmed named-constant runner measures a fold real callers may not get.
4. **Test Node 24's first-runner slowdown** with a throwaway runner placed first, or with `mode: "shuffled"`.
5. **Get cycle counts for mulhi and mulwide on bare-metal Linux,** or on a VM with PMU passthrough. That was your
   original request, and no cloud box here can serve it.

Details: [`node24-gap-2026-09-25.md`](node24-gap-2026-09-25.md) (mechanism and the `-` result),
[`osr-sweep-2026-09-25.md`](osr-sweep-2026-09-25.md) (the audit),
[`coercion-tax-and-i32-cold-2026-09-25.md`](coercion-tax-and-i32-cold-2026-09-25.md),
[`warmup-and-open-items-2026-09-25.md`](warmup-and-open-items-2026-09-25.md).
