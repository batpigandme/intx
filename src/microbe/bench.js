"use strict";

const readline = require("node:readline");
const { sample, sleep } = require("./timer");
const { computeStats } = require("./stats");
const { calibrate } = require("./calibrate");
const { renderBench } = require("./render");

/**
 * Writes in-place live progress to stdout cross-platform.
 *
 * @param {string} text - Status text to write.
 */
function writeProgress(text) {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	process.stdout.write(text);
}

/**
 * Clears the current terminal line cross-platform.
 */
function clearProgress() {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
}

/**
 * Hides terminal cursor safely with exit cleanup.
 */
function hideCursor() {
	if (process.stdout.isTTY) {
		process.stdout.write("\x1b[?25l");
		process.once("exit", showCursor);
	}
}

/**
 * Restores terminal cursor.
 */
function showCursor() {
	if (process.stdout.isTTY) {
		process.stdout.write("\x1b[?25h");
		process.removeListener("exit", showCursor);
	}
}

/**
 * Benchmarks a single kernel runner across multiple measurement rounds with dynamic calibration.
 *
 * @param {string} title - Benchmark title.
 * @param {Function} runner - Synchronous runner function `(iters, start, stop) => any`.
 * @param {object} [options={}] - Configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.time=100] - Target duration in milliseconds per sample (dynamic auto-calibration).
 * @param {number} [options.iters] - Manual iteration count (disables dynamic calibration).
 * @param {number} [options.cooldown=0] - Cooldown pause (in ms) between samples to allow CPU cooling.
 * @param {boolean} [options.prime=false] - If true, executes an untimed priming pass before each timed sample.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @returns {object} Object containing statistical metrics for the run.
 */
function bench(title, runner, options = {}) {
	if (typeof runner !== "function") {
		throw new TypeError(
			`bench expected runner function as 2nd argument, received: ${typeof runner}`,
		);
	}

	const rounds = options.rounds ?? 5;
	const time = options.time ?? 100;
	const iters = options.iters;
	const dynamic = iters === undefined;
	const cooldown = options.cooldown ?? 0;
	const prime = !!options.prime;
	const silent = !!options.silent;

	const isInteractive = !silent && !!process.stdout.isTTY;

	if (isInteractive) {
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
		const itersCount = dynamic ? calibrate(runner, time) : iters;
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
				const primeIters = Math.min(10000, Math.max(100, (itersCount * 0.01) | 0));
				runner(primeIters, () => {}, () => {});
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
		if (isInteractive) {
			showCursor();
		}
	}

	// 4. Output summary block
	if (!silent) {
		renderBench(result);
	}

	return result;
}

module.exports = {
	bench,
};
