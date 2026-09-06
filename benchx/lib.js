'use strict';

const { performance } = require('node:perf_hooks');

/**
 * BenchX: Precision Microbenchmarking & Statistical Harness for V8/JIT Kernels
 *
 * Designed specifically for low-level arithmetic kernels:
 * 1. Monomorphic JIT Isolation: Generates unique compilation units per candidate
 *    to prevent V8 CompilationCache sharing and Megamorphic Inline Cache (IC) pollution.
 * 2. Round-Robin Interleaved Execution: Distributes CPU thermal throttling and clock
 *    frequency scaling evenly across all candidates.
 * 3. Statistical Profiling: Computes min, max, median, mean, standard deviation,
 *    and margin of error (MoE %) across multiple measurement rounds.
 * 4. Pre-measurement Garbage Collection: Cleans heap state if --expose-gc is enabled.
 */

function formatOps(ops) {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)} G`;
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)} M`;
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(2)} K`;
  return `${ops.toFixed(0)} `;
}

function computeStats(samples, itersPerRound) {
  const n = samples.length;
  const sortedTimes = [...samples].sort((a, b) => a - b);
  const minTime = sortedTimes[0];
  const maxTime = sortedTimes[n - 1];
  const medianTime =
    n % 2 === 1
      ? sortedTimes[Math.floor(n / 2)]
      : (sortedTimes[n / 2 - 1] + sortedTimes[n / 2]) / 2;

  const sum = sortedTimes.reduce((acc, v) => acc + v, 0);
  const meanTime = sum / n;

  const variance =
    sortedTimes.reduce((acc, v) => acc + (v - meanTime) ** 2, 0) / (n - 1 || 1);
  const stddev = Math.sqrt(variance);
  const moePercent = (stddev / meanTime) * 100;

  const maxOps = (itersPerRound * 1000) / minTime;
  const medianOps = (itersPerRound * 1000) / medianTime;
  const meanOps = (itersPerRound * 1000) / meanTime;

  return {
    minTime,
    maxTime,
    medianTime,
    meanTime,
    stddev,
    moePercent,
    maxOps,
    medianOps,
    meanOps,
  };
}

/**
 * Creates an isolated monomorphic JIT runner for a kernel function.
 */
function createMonomorphicRunner(
  fn,
  name = 'kernel',
  isStrided = false,
  a = 0xdeadbeef,
) {
  const r = new Uint32Array(2);
  const callExpr = isStrided ? 'fn(r[1], a, r, 1, 0);' : 'fn(r[1], a, r);';
  const cleanName = (name || 'kernel').replace(/[^a-zA-Z0-9]/g, '_');

  return new Function(
    'fn',
    'a',
    'r',
    `
    /* [BenchX Monomorphic Compilation Unit: ${cleanName}_${Date.now()}_${Math.random()}] */
    return function benchKernel_${cleanName}(n) {
      r[1] = 1;
      for (let i = 0; i < n; i++) {
        ${callExpr}
      }
      return r;
    };
  `,
  )(fn, a, r);
}

class BenchXSuite {
  constructor(options = {}) {
    this.name = options.name || 'BenchX Benchmark Suite';
    this.rounds = options.rounds || 5;
    this.itersPerRound = options.iters || 5e7;
    this.warmupIters = options.warmup || 5e6;
    this.tasks = [];
  }

  add(name, fn, options = {}) {
    const isStrided = !!options.isStrided;
    const iters = options.iters || this.itersPerRound;
    const runner =
      typeof fn === 'function' && fn.length >= 3
        ? createMonomorphicRunner(fn, name, isStrided)
        : fn;

    this.tasks.push({
      name,
      fn,
      runner,
      isStrided,
      iters,
      samples: [],
    });
    return this;
  }

  run() {
    console.log(`\n${'='.repeat(78)}`);
    console.log(` ${this.name} (Node ${process.version}, ${process.arch})`);
    console.log(
      ` Config: ${this.rounds} rounds × ${(this.itersPerRound).toExponential()} iters/round | Interleaved Execution`,
    );
    console.log(`${'='.repeat(78)}\n`);

    // 1. Initial Warmup Phase (tier-up all runners in V8 TurboFan)
    process.stdout.write('🔥 Tiering up V8 TurboFan compilers... ');
    for (const task of this.tasks) {
      task.runner(this.warmupIters);
      task.runner(this.warmupIters);
    }
    console.log('Ready.\n');

    // 2. Interleaved Round-Robin Measurement Rounds
    for (let round = 1; round <= this.rounds; round++) {
      process.stdout.write(
        ` [Round ${round}/${this.rounds}] Sampling candidates... \r`,
      );
      for (const task of this.tasks) {
        if (typeof global.gc === 'function') {
          global.gc();
        }
        const t0 = performance.now();
        task.runner(task.iters);
        const t1 = performance.now();
        task.samples.push(t1 - t0);
      }
    }
    console.log(
      ` [Completed ${this.rounds} rounds]                                  \n`,
    );

    // 3. Compute statistics for all tasks
    const results = this.tasks.map((task) => {
      const stats = computeStats(task.samples, task.iters);
      return {
        name: task.name,
        ...stats,
      };
    });

    // Sort by median throughput descending
    results.sort((a, b) => b.medianOps - a.medianOps);
    const baselineMedian = results[0].medianOps;

    // 4. Render Table
    console.log(
      `Rank  ${'Candidate'.padEnd(40)} ${'Median (ops/s)'.padStart(14)} ${'Peak (ops/s)'.padStart(14)} ${'MoE (±%)'.padStart(9)} ${'Relative'.padStart(9)}`,
    );
    console.log('-'.repeat(88));

    results.forEach((res, idx) => {
      const rank = (idx + 1).toString().padStart(2);
      const name = res.name.padEnd(40);
      const medianOps = `${formatOps(res.medianOps)}ops/s`.padStart(14);
      const peakOps = `${formatOps(res.maxOps)}ops/s`.padStart(14);
      const moe = `±${res.moePercent.toFixed(1)}%`.padStart(9);
      const relative =
        idx === 0
          ? 'baseline'.padStart(9)
          : `${(res.medianOps / baselineMedian).toFixed(2)}x`.padStart(9);

      console.log(
        `${rank}.  ${name} ${medianOps} ${peakOps} ${moe} ${relative}`,
      );
    });

    console.log('-'.repeat(88));
    console.log(
      `🏆 Winning Kernel: ${results[0].name} (${formatOps(results[0].medianOps)}ops/s)\n`,
    );

    return results;
  }
}

module.exports = {
  BenchXSuite,
  createMonomorphicRunner,
  computeStats,
};
