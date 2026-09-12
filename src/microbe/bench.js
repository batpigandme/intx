"use strict";

const { performance } = require("node:perf_hooks");
const { computeStats } = require("./stats");
const { renderBench } = require("./format");

/**
 * Benchmarks a single kernel runner across multiple measurement rounds.
 *
 * @param {string} name - Benchmark title.
 * @param {Function} runner - Synchronous runner function `(iters: number) => any`.
 * @param {object} [options={}] - Configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.iters=5e7] - Iteration count per round.
 * @param {number} [options.warmup=5e6] - Warmup iterations for JIT tier-up.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @returns {object} Object containing statistical metrics for the run.
 *
 * @example
 * const { bench, createRunner } = require('#microbe');
 *
 * const runner = createRunner({ ... });
 * bench('u32.mul', runner, { iters: 1e8, rounds: 5 });
 */
function bench(name, runner, options = {}) {
	if (typeof runner !== "function") {
		throw new TypeError(
			`bench expected runner function as 2nd argument, received: ${typeof runner}`,
		);
	}

	const rounds = options.rounds || 5;
	const iters = options.iters || 5e7;
	const warmup = options.warmup || Math.min(iters * 0.1, 5e6);
	const silent = !!options.silent;

	// 1. Warmup for JIT tier-up
	runner(warmup);
	runner(warmup);

	// 2. Multi-round measurement
	let value;
	const samples = [];
	for (let r = 0; r < rounds; r++) {
		const t0 = performance.now();
		value = runner(iters);
		const t1 = performance.now();
		samples.push((t1 - t0) / 1000);
	}

	// 3. Statistical analysis
	const stats = computeStats(samples, iters);
	const result = {
		name,
		value,
		...stats,
		rounds,
		iters,
	};

	// 4. Output summary line
	if (!silent) {
		renderBench(result);
	}

	return result;
}

module.exports = {
	bench,
};
