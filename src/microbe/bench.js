"use strict";

const { sample } = require("./timer");
const { sleep } = require("#utils");
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
	const dur = options.dur ?? presets.medium.dur;
	const iters = options.iters;
	const dynamic = iters === undefined;
	const cooldown = options.cooldown ?? presets.medium.cooldown;
	const prime = options.prime ?? presets.medium.prime;
	const silent = !!options.silent;
	const render = options.render ?? true;
	const cursor = options.cursor ?? true;

	const isInteractive = !silent && !!process.stdout.isTTY;

	if (isInteractive && cursor) {
		hideCursor();
	}

	let result;
	try {
		if (typeof global.gc === "function") {
			global.gc();
		}

		if (isInteractive) {
			writeProgress(`🔥 Warming up & calibrating '${title}'... `);
		}

		// 1. Calibrate & Warmup Round
		const itersCount = dynamic ? calibrate(runner, dur) : iters;
		const warmupSample = sample(runner, itersCount);
		const warmup = {
			elapsed: warmupSample.elapsed,
			iters: itersCount,
			rate: itersCount / warmupSample.elapsed,
		};

		if (cooldown > 0) {
			sleep(cooldown);
		}

		// 2. Multi-round measurement
		let value = warmupSample.value;
		const sampleTimes = [];
		const samples = [];
		for (let r = 0; r < rounds; r++) {
			if (isInteractive) {
				writeProgress(`[Round ${r + 1}/${rounds}] Sampling '${title}'... `);
			}

			if (typeof global.gc === "function") {
				global.gc();
			}

			if (prime) {
				const primeIters = Math.min(
					10000,
					Math.max(100, (itersCount * 0.01) | 0),
				);
				runner(
					primeIters,
					() => {},
					() => {},
				);
			}

			const res = sample(runner, itersCount);
			sampleTimes.push(res.elapsed);
			samples.push({
				round: r + 1,
				elapsed: res.elapsed,
				iters: itersCount,
				rate: itersCount / res.elapsed,
			});
			value = res.value;

			if (cooldown > 0) {
				sleep(cooldown);
			}
		}

		if (isInteractive) {
			clearProgress();
		}

		// 3. Statistical analysis
		const stats = computeStats(sampleTimes, itersCount);
		result = {
			title,
			name: title,
			value,
			warmup,
			samples,
			rounds,
			iters: itersCount,
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
};
