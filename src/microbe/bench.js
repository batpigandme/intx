"use strict";

const { sample } = require("./timer");
const { computeStats } = require("./stats");
const { renderBench } = require("./render");

/**
 * Benchmarks a single kernel runner across multiple measurement rounds.
 *
 * @param {string} title - Benchmark title.
 * @param {Function} runner - Synchronous runner function `(iters: number, startClock: Function, stopClock: Function) => any`.
 * @param {object} [options={}] - Configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.iters=5e7] - Iteration count per round.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @returns {object} Object containing statistical metrics for the run.
 *
 * @example
 * const { bench, createRunner } = require('#microbe');
 *
 * const runner = createRunner({ ... });
 * bench('u32.mul', runner, { iters: 1e8, rounds: 5 });
 */
function bench(title, runner, options = {}) {
	if (typeof runner !== "function") {
		throw new TypeError(
			`bench expected runner function as 2nd argument, received: ${typeof runner}`,
		);
	}

	const rounds = options.rounds ?? 5;
	const iters = options.iters ?? 5e7;
	const silent = !!options.silent;

	// 1. Warmup Round (Round 0 for JIT tier-up, excluded from stats)
	const warmupSample = sample(runner, iters);
	const warmup = {
		elapsed: warmupSample.elapsed,
		iters,
		rate: iters / warmupSample.elapsed,
	};

	// 2. Multi-round measurement
	let value = warmupSample.value;
	const samples = [];
	for (let r = 0; r < rounds; r++) {
		const res = sample(runner, iters);
		samples.push(res.elapsed);
		value = res.value;
	}

	// 3. Statistical analysis
	const stats = computeStats(samples, iters);
	const result = {
		title,
		name: title,
		value,
		...stats,
		warmup,
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
