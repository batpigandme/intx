# `microbe`

A lightweight microbenchmarking harness designed for measuring low-level JavaScript arithmetic kernels without JIT pollution or thermal bias.

```javascript
const { bench, compare, createRunner } = require('#microbe');
```

---

## Why standard JS benchmarks lie

Measuring tight arithmetic loops in JavaScript (e.g. integer math, bitwise ops) is tricky because V8 JIT optimizations can easily be distorted by the benchmark harness itself:

1. **Megamorphic Call Sites (IC Pollution)**: If a single benchmark loop calls candidate A, candidate B, and candidate C from the same call site, V8's Inline Cache (IC) transitions to *megamorphic* (3+ distinct targets). This permanently disables TurboFan function inlining and creates an artificial 5x–10x slowdown.
2. **Thermal Throttling & CPU Boost Bias**: Running 10^8 iterations of candidate A, then candidate B sequentially gives candidate A an unfair advantage on a cold, high-boost CPU core (~4.8 GHz) before the CPU thermally throttles (~3.2 GHz) for candidate B.
3. **Warmup Tier-Up**: Functions need enough warmup iterations to tier up through Ignition → Sparkplug → Maglev → TurboFan before timing starts.

`microbe` solves these by:
- Compiling **isolated monomorphic closures** per candidate via `createRunner()`, giving each candidate its own pristine feedback vector.
- **Interleaving and shuffling** measurement rounds across candidates so thermal fluctuations affect all targets equally.
- Providing **warmup rounds** and robust statistics (Median, Peak, Margin of Error).

---

## Quick Tutorial

### 1. Benchmark a Single Kernel (`bench`)

```javascript
const { bench } = require('#microbe');

function mul(a, b) {
  return Math.imul(a, b) >>> 0;
}

// Runner contract: (iters: number) => any
bench('u32.mul', (iters) => {
  let acc = 1;
  for (let i = 0; i < iters; i++) {
    acc = mul(acc, 0x12345678);
  }
  return acc;
}, {
  rounds: 5,
  iters: 1e7,
});
```

### 2. Isolate JIT Compilation with `createRunner`

To prevent megamorphic call sites when testing multiple kernels, compile an isolated runner:

```javascript
const { bench, createRunner } = require('#microbe');

const runner = createRunner({
  name: 'u32_mul',
  context: {
    mul: (a, b) => Math.imul(a, b) >>> 0,
    a: 0x12345678,
    b: 0x87654321,
  },
  setup: 'let acc = 0;',
  body: 'acc = mul(acc ^ a, b);',
  teardown: 'return acc;',
});

bench('u32.mul (isolated)', runner, {
  rounds: 5,
  iters: 1e7,
});
```

### 3. Multi-Candidate Showdown (`compare`)

To compare multiple algorithmic approaches side-by-side:

```javascript
const { compare, createRunner } = require('#microbe');

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
    body: 'fn(0x1234, 0x5678);',
  }),
  native_imul: createRunner({
    name: 'native_imul',
    context: { fn: nativeImul },
    body: 'fn(0x1234, 0x5678);',
  }),
};

// Run showdown
compare('Multiplication Showdown', runners, {
  rounds: 5,
  iters: 1e7,
  shuffled: true,
});
```

#### Output:
```text
====================================================================================================
 Multiplication Showdown (Node v22.22.1, x64)
 Config: 5 rounds × 1e+7 iters/round | Order: Shuffled
====================================================================================================

🔥 Warming up JIT compilers... Ready.

 [Completed 5 measurement rounds]             

Rank  Kernel / Target                           Median (iters/s)  Peak (iters/s)  MoE (±%)  Relative
----------------------------------------------------------------------------------------------------
  1.  native_imul                                       278.29 M        278.72 M     ±0.2%  baseline
  2.  bitwise                                            15.42 M         15.65 M     ±1.2%     0.06x
----------------------------------------------------------------------------------------------------
🏆 Winner: native_imul (278.29 M iters/s)
```

---

## API Reference

### `createRunner(options)`
Generates an isolated closure `(n) => ...` with its own `SharedFunctionInfo`.

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `'kernel'` | Identifier used for function tagging. |
| `context` | `object` | `{}` | Variables injected into the runner's closure scope. |
| `setup` | `string` | `''` | JS executed before the iteration loop. |
| `body` | `string` | `''` | JS executed inside `for (let i = 0; i < n; i++)`. |
| `teardown` | `string` | `''` | JS executed after the loop (e.g. `return out;`). |

---

### `bench(title, runner, options)`
Runs a multi-round benchmark for a single runner function.

| Option | Type | Default | Description |
|---|---|---|---|
| `rounds` | `number` | `5` | Number of measurement rounds. |
| `iters` | `number` | `5e7` | Loop iterations per round. |
| `warmup` | `number` | `min(iters*0.1, 5e6)` | Warmup iterations before timing. |
| `silent` | `boolean` | `false` | Suppress console output and return stats object. |

---

### `compare(title, runners, options)`
Runs an interleaved multi-candidate showdown and outputs a ranked results table.

| Option | Type | Default | Description |
|---|---|---|---|
| `rounds` | `number` | `5` | Number of measurement rounds. |
| `iters` | `number` | `5e7` | Iterations per round. |
| `warmup` | `number` | `min(iters*0.1, 5e6)` | Warmup iterations per runner. |
| `shuffled` | `boolean` | `true` | Randomize candidate execution order per round. |
| `silent` | `boolean` | `false` | Suppress console output and return results array. |
