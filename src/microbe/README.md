# `microbe`

A lightweight microbenchmarking harness designed for measuring low-level JavaScript arithmetic kernels without JIT pollution or thermal bias.

```javascript
const { bench } = require('#microbe');
```

---

## Why standard JS benchmarks lie

Measuring tight arithmetic loops in JavaScript (e.g. integer math, bitwise ops) is tricky because V8 JIT optimizations can easily be distorted by the benchmark harness itself:

1. **Megamorphic Call Sites (IC Pollution)**: If a single benchmark loop calls candidate A, candidate B, and candidate C from the same call site, V8's Inline Cache (IC) transitions to *megamorphic* (3+ distinct targets). This permanently disables TurboFan function inlining and creates an artificial 5x–10x slowdown.
2. **Thermal Throttling & CPU Boost Bias**: Running 10^8 iterations of candidate A, then candidate B sequentially gives candidate A an unfair advantage on a cold, high-boost CPU core (~4.8 GHz) before the CPU thermally throttles (~3.2 GHz) for candidate B.
3. **Setup/Teardown Contamination**: Fixture allocations or array resets included in the timing loop distort nanosecond-scale arithmetic measurements.
4. **Warmup Tier-Up**: Functions need initial execution to tier up through Ignition → Sparkplug → Maglev → TurboFan before timing starts.

`microbe` solves these by:
- Compiling **isolated monomorphic closures** per candidate via `createRunner()`, giving each candidate its own pristine feedback vector.
- Timing **only the measurement loop** via `start()` / `stop()`, excluding setup and teardown overhead.
- Providing standardized execution modes (`"sequential"`, `"shuffled"`, `"ordered"`) to eliminate thermal and cache bias.
- Providing automatic **Round 0 warmup** and adaptive rate-derivative calibration.

---

## Quick Tutorial

### 1. Benchmark a Single Kernel (`bench`)

```javascript
const { bench } = require('#microbe');

function mul(a, b) {
  return Math.imul(a, b) | 0;
}

// Runner contract: (iters: number, start: Function, stop: Function) => any
bench('u32.mul', (iters, start, stop) => {
  let acc = 1; // un-timed setup

  start();
  for (let i = 0; i < iters; i++) {
    acc = mul(acc, 0x12345678);
  }
  stop();

  return acc; // un-timed teardown
}, {
  rounds: 5,
  iters: 1e7,
});
```

#### Output:
```text
● u32.mul (5 rounds × 1e+7 iters)
  • Warmup:    36.21 ms (276.16 M iters/s)
  • Round 1:   35.89 ms (278.63 M iters/s)
  • Round 2:   35.92 ms (278.40 M iters/s)
  • Round 3:   36.01 ms (277.70 M iters/s)
  • Round 4:   35.88 ms (278.71 M iters/s)
  • Round 5:   35.95 ms (278.16 M iters/s)
  ── Summary: Median 278.40 M iters/s | Peak 278.71 M iters/s | Mean 278.32 M iters/s (±0.1%)
```

### 2. Isolate JIT Compilation with `bench.createRunner`

To prevent megamorphic call sites when testing multiple kernels, compile an isolated runner:

```javascript
const { bench } = require('#microbe');

const runner = bench.createRunner({
  name: 'u32_mul',
  context: {
    mul: (a, b) => Math.imul(a, b) >>> 0,
    a: 0x12345678,
    b: 0x87654321,
  },
  setup: 'let acc = 0;',
  loop: 'acc = mul(acc ^ a, b);',
  teardown: 'return acc;',
});

bench('u32.mul (isolated)', runner, {
  rounds: 5,
  iters: 1e7,
});
```

### 3. Multi-Target Suite (`bench.suite`)

To run multiple related benchmarks from a single file without sorting (e.g. testing scaling or execution patterns), while preserving definition order and eliminating thermal and execution bias:

```javascript
const { bench } = require('#microbe');

const ops = {
  '1. Serial': bench.createRunner({
    setup: 'let acc = 1;',
    loop: 'acc = (acc + 1) | 0;',
    teardown: 'return acc;',
  }),
  '2. Parallel 2x': bench.createRunner({
    setup: 'let a0 = 1, a1 = 2;',
    loop: 'a0 = (a0 + 1) | 0; a1 = (a1 + 1) | 0;',
    teardown: 'return a0 ^ a1;',
  }),
};

bench.suite('Integer Addition Patterns', ops, {
  rounds: 5,
  iters: 2e7,
});
```

#### Output:
```markdown
### Integer Addition Patterns
> **Config:** 5 rounds × 2e+7 iters/round | Order: Shuffled  
> **Platform:** Node v24.19.0 (x64) | Intel Core i5-8350U @ 1.70GHz

|  #   | Title                 | Median (/s) | Peak (/s) | MoE (±%) | Relative |
|:----:|:----------------------|------------:|----------:|---------:|---------:|
|    1 | 1. Serial             |      1.96 B |    1.97 B |    ±0.3% | baseline |
|    2 | 2. Parallel 2x        |      1.19 B |    1.19 B |    ±0.3% |    0.61x |
```

### 4. Multi-Candidate Showdown (`bench.suite.rank`)

To compare multiple algorithmic approaches side-by-side with automatic ranking:

```javascript
const { bench } = require('#microbe');

// Two candidate implementations to compare
const bitwiseMul = (a, b) => {
  let res = 0;
  while (b > 0) {
    if (b & 1) res = (res + a) >>> 0;
    a = (a << 1) >>> 0;
    b >>>= 1;
  }
  return res;
};

const nativeImul = (a, b) => Math.imul(a, b) >>> 0;

// Build monomorphic runners
const runners = {
  bitwise: createRunner({
    name: 'bitwise',
    context: { fn: bitwiseMul },
    loop: 'fn(0x1234, 0x5678);',
  }),
  native_imul: createRunner({
    name: 'native_imul',
    context: { fn: nativeImul },
    loop: 'fn(0x1234, 0x5678);',
  }),
};

// Run showdown with preset or custom options
bench.suite.rank('Multiplication Showdown', runners, {
  ...short,
  order: 'median', // 'median' | 'mean' | 'max' | 'min' | 'warmup' | comparator fn
  width: 100,
});
```

#### Output:
```markdown
### Multiplication Showdown
> **Config:** 5 rounds × ~50ms/sample (dynamic) | Order: Sequential | Pause: 20ms  
> **Platform:** Node v24.19.0 (x64) | Intel Core i5-8350U @ 1.70GHz

| Rank | Title                 | Median (/s) | Peak (/s) | MoE (±%) | Relative |
|:----:|:----------------------|------------:|----------:|---------:|---------:|
|    1 | native_imul           |    278.29 M |  278.72 M |    ±0.2% | baseline |
|    2 | bitwise               |     15.42 M |   15.65 M |    ±1.2% |    0.06x |
```

---

## Presets

Monomorphic, frozen configuration objects for standardized benchmarking:

```javascript
const { bench, short, medium, long } = require('#microbe');

// Quick sequential run without thermal skew:
bench.suite('Quick Check', runners, short);

// Standard shuffled run:
bench.suite.rank('Standard Showdown', runners, medium);

// High-precision run with per-sample cooldown and cache priming:
bench.suite.rank('Deep Analysis', runners, long);
```

| Preset | `mode` | `rounds` | `time` | `pause` | `cooldown` | `prime` |
|---|---|---|---|---|---|---|
| `short` | `"sequential"` | `5` | `50` ms | `20` ms | `0` ms | `false` |
| `medium` | `"shuffled"` | `10` | `100` ms | `20` ms | `0` ms | `false` |
| `long` | `"shuffled"` | `20` | `200` ms | `50` ms | `20` ms | `true` |

---

## API Reference

All options and parameter names are strictly monomorphic and single words.

### `bench(title, runner, options)`
Runs a multi-round benchmark for a single runner function.

| Option | Type | Default | Description |
|---|---|---|---|
| `rounds` | `number` | `5` | Number of measurement rounds. |
| `time` | `number` | `100` | Target duration in milliseconds per sample (dynamic calibration). |
| `iters` | `number` | `undefined` | Manual loop iterations per round (disables dynamic calibration). |
| `cooldown` | `number` | `0` | Cooldown pause (in ms) between samples to allow CPU cooling (0% CPU futex sleep). |
| `prime` | `boolean` | `false` | Untimed cache/CPU priming pass before each timed sample. |
| `silent` | `boolean` | `false` | Suppress console output and return stats object. |

---

### `createRunner(options)`
Generates an isolated closure `(iters, start, stop) => ...` with its own `SharedFunctionInfo`.

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `'kernel'` | Identifier used for function tagging. |
| `context` | `object` | `{}` | Variables injected into the runner's closure scope. |
| `setup` | `string` | `''` | JS executed before `start()`. |
| `loop` | `string` | `''` | JS executed inside the timed loop `for (let i = 0; i < iters; i++)`. |
| `teardown` | `string` | `''` | JS executed after `stop()` (e.g. `return out;`). |

---

### `bench.suite(title, runners, options)`
Runs a multi-target benchmark suite preserving declaration order in output and results.

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `'shuffled'` | Execution mode: `'sequential'`, `'shuffled'`, or `'ordered'`. |
| `rounds` | `number` | `5` | Number of measurement rounds. |
| `time` | `number` | `100` | Target duration in milliseconds per sample (dynamic calibration). |
| `iters` | `number` | `undefined` | Iterations per round (disables dynamic calibration). |
| `pause` | `number` | `0` | Pause (in ms) between runners (sequential) or round cycles (shuffled). |
| `cooldown` | `number` | `0` | Cooldown pause (in ms) between samples to allow CPU cooling (0% CPU futex sleep). |
| `prime` | `boolean` | `false` | Untimed cache/CPU priming pass before each timed sample. |
| `silent` | `boolean` | `false` | Suppress console output and return results array. |
| `render` | `boolean` | `true` | If true and not silent, renders table. |
| `width` | `number` | `80` | Total table column width. |

---

### `bench.suite.rank(title, runners, options)`
Runs a multi-candidate showdown and outputs a ranked results table.

| Option | Type | Default | Description |
|---|---|---|---|
| `order` | `string \| Function` | `'median'` | Metric to sort by (`"median"`, `"mean"`, `"max"`, `"min"`, `"warmup"`) or comparator. |
| `mode` | `string` | `'shuffled'` | Execution mode: `'sequential'`, `'shuffled'`, or `'ordered'`. |
| `rounds` | `number` | `5` | Number of measurement rounds. |
| `time` | `number` | `100` | Target duration in milliseconds per sample (dynamic calibration). |
| `iters` | `number` | `undefined` | Iterations per round (disables dynamic calibration). |
| `pause` | `number` | `0` | Pause (in ms) between runners (sequential) or round cycles (shuffled). |
| `cooldown` | `number` | `0` | Cooldown pause (in ms) between samples to allow CPU cooling (0% CPU futex sleep). |
| `prime` | `boolean` | `false` | Untimed cache/CPU priming pass before each timed sample. |
| `silent` | `boolean` | `false` | Suppress console output and return results array. |
| `width` | `number` | `80` | Total table column width. |
