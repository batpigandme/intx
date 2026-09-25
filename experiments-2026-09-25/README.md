# experiments-2026-09-25

**Not for merging.** This branch exists only to share the experiments behind the notes below. It's based on stock
`a8de2d6` and changes nothing outside this folder. The two proposed changes are on their own branches:
`fix/pmu-errors-and-run-all` and `feat/cycles-wall-clock-fallback`.

These are the follow-up experiments from running intx on cloud Linux boxes on 2026-09-25 (UTC): the on-stack
replacement (OSR) effect behind the `i32.add` "Inline Operator" row, how far it reaches in the suite, the coercion
tax, the i32 cold-call rows, and warm-up strategies. Start with
[`summary-for-abdul-2026-09-25.md`](summary-for-abdul-2026-09-25.md). The four write-ups link into the data folders
below. `boxA` is an Intel Xeon @ 2.10GHz (family 6, model 207) and `boxD` an Intel Xeon @ 2.80GHz (family 6, model
85). Both are KVM guests in Docker with 4 cores and no hardware PMU. A "boot" is one container lifetime; results from
different boots or boxes are never pooled. Node binaries are 22.22.2 (V8 12.4.254.21), 24.19.0 (V8 13.6.233.17) and
26.7.0 (V8 14.6.202.34). Scripts ran against a `git archive` of `a8de2d6` extracted to `/tmp/intx-stock`, and some
have absolute paths that need adjusting before you rerun them. `$EXPERIMENTS_DIR` (this folder) and `$SCRATCH` (a
scratch directory) are placeholders for local paths.

- [`summary-for-abdul-2026-09-25.md`](summary-for-abdul-2026-09-25.md): the three actionable items and the rest,
  briefly.
- [`node24-gap-2026-09-25.md`](node24-gap-2026-09-25.md): why "Inline Operator" is ~13× slower on Node 24, and the
  boxD follow-up (`--no-use-osr`; local and parameter forms of `c`; `+ - * ^`).
- [`osr-sweep-2026-09-25.md`](osr-sweep-2026-09-25.md): cold against warmed across all 60 showdown rows, and the audit
  of every runner loop for the pattern.
- [`coercion-tax-and-i32-cold-2026-09-25.md`](coercion-tax-and-i32-cold-2026-09-25.md): Exp 1's coercion tax, and the
  i32 div/mod/rotl rows.
- [`warmup-and-open-items-2026-09-25.md`](warmup-and-open-items-2026-09-25.md): five warm-up strategies compared, and
  why some warm runs stayed slow.
- `data-boxA/box-record.txt`: boxA's box record (boot 1).
- `data-boxA/node24-gap/`: boxA, boot 2. Node 22, 24, 26. Repeat blocks 3–4 of the "Inline Operator" and 06 rows, the
  standalone `scratch/reduce.js`, and `diag/` traces and `--print-opt-code` dumps.
- `data-boxA/osr-sweep/`: boxA, boot 3. Node 22, 24, 26. The 60-row cold/warm sweep (JSONL), its driver and scratch
  copies of the showdowns.
- `data-boxA/coercion-tax/`: boxA, boot 4. Node 22, 24, 26. Exp 1's seven rows under three calling patterns.
- `data-boxA/i32-cold/`: boxA, boot 4. Node 22, 24, 26. The closure/literal/argument reduction, repeats, and code
  dumps.
- `data-boxA/warmup/`: boxA, boot 4. Node 22, 24, 26. The warm-up strategy comparison, direct against wrapped calls,
  and the Node 26 wrapper traces.
- `data-boxD/node24-gap-followup/`: boxD, boot 1. Node 22, 24, 26. Box record, the extended `reduce.js`, and the three
  follow-up checks.
- `data-boxD/osr-audit/`: boxD, boot 2. Node 24, 26. The flagged-row list, the loader that captures your runners
  unmodified, and the cold/warm output.
