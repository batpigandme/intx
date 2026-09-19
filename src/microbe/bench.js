"use strict";

const { sample } = require("./timer");
const { sleep, gc } = require("#utils");
const { computeStats } = require("./stats");
const { calibrate } = require("./calibrate");
const {
	renderBench,
	writeProgress,
	clearProgress,
	hideCursor,
	showCursor,
} = require("./render");
const { presets } = require("./presets");

/**
 * Warms up and calibrates a runner, adapting iteration count if JIT tier-up occurs during warmup.
 *
 * @param {Function} runner - Target runner function `(iters, tic, toc) => any`.
 * @param {object} [options={}] - Configuration options (dur, iters, cooldown).
 * @returns {{ iters: number, warmup: object, value: any }}
 */
function warmupRunner(runner, options = {}) {
	gc(50);

	const dur = options.dur ?? presets.medium.dur;
	const iters = options.iters;
	const dynamic = iters === undefined;
	const cooldown = options.cooldown ?? presets.medium.cooldown;

	let itersCount = dynamic ? calibrate(runner, dur) : iters;
	let warmupSample = sample(runner, itersCount);

	if (dynamic && warmupSample.elapsed > 0) {
		const target = dur / 1000;
		const warmupRate = itersCount / warmupSample.elapsed;
		if (Math.abs(warmupSample.elapsed - target) / target > 0.15) {
			itersCount = Math.max(1, Math.round(warmupRate * target));
			warmupSample = sample(runner, itersCount);
		}
	}

	if (cooldown > 0) {
		sleep(cooldown);
	}

	return {
		iters: itersCount,
		warmup: {
			elapsed: warmupSample.elapsed,
			iters: itersCount,
			rate: itersCount / warmupSample.elapsed,
		},
		value: warmupSample.value,
	};
}

/**
 * Executes a single measurement round sample with optional priming and cooldown.
 *
 * @param {Function} runner - Target runner function `(iters, tic, toc) => any`.
 * @param {number} itersCount - Iteration count for this sample.
 * @param {object} [options={}] - Configuration options (prime, cooldown).
 * @returns {{ elapsed: number, value: any }}
 */
function sampleRound(runner, itersCount, options = {}) {
	// gc();

	const prime = options.prime ?? presets.medium.prime;
	const cooldown = options.cooldown ?? presets.medium.cooldown;

	if (prime) {
		const primeIters = Math.min(10000, Math.max(100, (itersCount * 0.01) | 0));
		runner(
			primeIters,
			() => {},
			() => {},
		);
	}

	const res = sample(runner, itersCount);

	if (cooldown > 0) {
		sleep(cooldown);
	}

	return res;
}

/**
 * Benchmarks a single kernel runner across multiple measurement rounds with dynamic calibration.
 *
 * @param {string} title - Benchmark title.
 * @param {Function} runner - Synchronous runner function `(iters, tic, toc) => any`.
 * @param {object} [options=presets.medium] - Configuration options.
 * @param {number} [options.rounds=10] - Number of measurement rounds.
 * @param {number} [options.dur=50] - Target duration in milliseconds per sample (dynamic auto-calibration).
 * @param {number} [options.iters] - Manual iteration count (disables dynamic calibration).
 * @param {number} [options.cooldown=0] - Cooldown pause (in ms) between samples to allow CPU cooling.
 * @param {boolean} [options.prime=false] - If true, executes an untimed priming pass before each timed sample.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @param {boolean} [options.render=true] - If true and not silent, renders benchmark summary block.
 * @param {boolean} [options.cursor=true] - If true and interactive, manages terminal cursor visibility.
 * @returns {object} Object containing statistical metrics for the run.
 */
function bench(title, runner, options = presets.medium) {
	if (typeof runner !== "function") {
		throw new TypeError(
			`bench expected runner function as 2nd argument, received: ${typeof runner}`,
		);
	}

	const rounds = options.rounds ?? presets.medium.rounds;
	const silent = !!options.silent;
	const render = options.render ?? true;
	const cursor = options.cursor ?? true;

	const isInteractive = !silent && !!process.stdout.isTTY;

	if (isInteractive && cursor) {
		hideCursor();
	}

	let result;
	try {
		if (isInteractive) {
			writeProgress(`🔥 Warming up & calibrating '${title}'... `);
		}

		// 1. Calibrate & Warmup Round
		const { iters, warmup, value: initValue } = warmupRunner(runner, options);

		// 2. Multi-round measurement
		let value = initValue;
		const sampleTimes = [];
		const samples = [];
		for (let r = 0; r < rounds; r++) {
			if (isInteractive) {
				writeProgress(`[Round ${r + 1}/${rounds}] Sampling '${title}'... `);
			}

			const res = sampleRound(runner, iters, options);
			sampleTimes.push(res.elapsed);
			samples.push({
				round: r + 1,
				elapsed: res.elapsed,
				iters,
				rate: iters / res.elapsed,
			});
			value = res.value;
		}

		if (isInteractive) {
			clearProgress();
		}

		// 3. Statistical analysis
		const stats = computeStats(sampleTimes, iters);
		result = {
			title,
			name: title,
			value,
			warmup,
			samples,
			rounds,
			iters,
			...stats,
		};
	} finally {
		if (isInteractive && cursor) {
			showCursor();
		}
	}

	// 4. Output summary block
	if (!silent && render) {
		renderBench(result);
	}

	return result;
}

module.exports = {
	bench,
	warmupRunner,
	sampleRound,
};
