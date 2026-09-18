"use strict";

const readline = require("node:readline");
const { sample, sleep } = require("./timer");
const { computeStats } = require("./stats");
const { calibrate } = require("./calibrate");
const { renderTable, renderBanner } = require("./render");

/**
 * Fisher-Yates array shuffle.
 *
 * @template T
 * @param {T[]} array - Target array to shuffle in-place.
 * @returns {T[]} Shuffled array.
 */
function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = (Math.random() * (i + 1)) | 0;
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array;
}

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
 * Multi-target microbenchmark suite runner with dynamic calibration, statistical rigor, and isolation.
 * Executes targets in interleaved rounds while preserving declaration order in output and results.
 *
 * @param {string} title - Title of the benchmark suite.
 * @param {object} runners - Object map of target names to runner functions `(iters, startClock, stopClock) => any`.
 * @param {object} [options={}] - Suite configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.time=100] - Target duration in milliseconds per sample (dynamic auto-calibration).
 * @param {number} [options.iters] - Manual iteration count (disables dynamic calibration).
 * @param {number} [options.cooldown=0] - Cooldown pause (in ms) between samples to allow CPU cooling.
 * @param {boolean} [options.shuffled=true] - If true, randomizes runner execution order per round.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @param {boolean} [options.render=true] - If true and not silent, renders benchmark table.
 * @param {number} [options.width=80] - Total table column width.
 * @returns {Array<object>} Array of evaluated results in original runner definition order.
 */
function suite(title, runners, options = {}) {
	if (!runners || typeof runners !== "object" || Array.isArray(runners)) {
		throw new TypeError(
			"suite expected runners to be an object map of runner functions.",
		);
	}

	const names = Object.keys(runners);
	if (names.length < 2) {
		throw new Error("suite requires at least two runner functions.");
	}

	const rounds = options.rounds ?? 5;
	const isDynamic = options.iters === undefined;
	const targetMs = options.time ?? 100;
	const manualIters = options.iters;
	const cooldown = options.cooldown ?? 0;
	const shuffled = options.shuffled ?? true;
	const silent = !!options.silent;
	const render = options.render ?? true;
	const width = options.width ?? 80;

	if (!silent && render) {
		renderBanner(title, {
			rounds,
			iters: manualIters,
			time: isDynamic ? targetMs : undefined,
			shuffled,
			cooldown,
			width,
		});
	}

	const isInteractive = !silent && !!process.stdout.isTTY;

	if (isInteractive) {
		hideCursor();
	}

	let results;
	try {
		const itersMap = {};
		const samples = {};
		const sampleDetails = {};
		const values = {};
		const warmup = {};

		// 1. Warmup & Calibration Phase
		for (const name of names) {
			const runner = runners[name];
			if (typeof runner !== "function") {
				throw new TypeError(
					`suite expected runner function for '${name}', received: ${typeof runner}`,
				);
			}

			if (typeof global.gc === "function") {
				global.gc();
			}

			if (isInteractive) {
				writeProgress(`🔥 Warming up & calibrating JIT ('${name}')... `);
			}

			const iters = isDynamic ? calibrate(runner, targetMs) : manualIters;
			itersMap[name] = iters;

			const warmupSample = sample(runner, iters);
			warmup[name] = {
				elapsed: warmupSample.elapsed,
				iters,
				rate: iters / warmupSample.elapsed,
			};
			values[name] = warmupSample.value;
			samples[name] = [];
			sampleDetails[name] = [];

			if (cooldown > 0) {
				sleep(cooldown);
			}
		}

		// 2. Interleaved Measurement Rounds
		for (let round = 1; round <= rounds; round++) {
			const roundOrder = shuffled ? shuffle([...names]) : names;

			for (const name of roundOrder) {
				if (isInteractive) {
					writeProgress(`[Round ${round}/${rounds}] Sampling '${name}'... `);
				}

				if (typeof global.gc === "function") {
					global.gc();
				}

				const runner = runners[name];
				const iters = itersMap[name];
				const res = sample(runner, iters);
				values[name] = res.value;
				samples[name].push(res.elapsed);
				sampleDetails[name].push({
					round,
					elapsed: res.elapsed,
					iters,
					rate: iters / res.elapsed,
				});

				if (cooldown > 0) {
					sleep(cooldown);
				}
			}
		}

		// 3. Compute statistics for all targets in definition order
		results = names.map((name) => {
			const iters = itersMap[name];
			const stats = computeStats(samples[name], iters);
			return {
				title: name,
				name,
				value: values[name],
				warmup: warmup[name],
				samples: sampleDetails[name],
				rounds,
				iters,
				...stats,
			};
		});

		if (isInteractive) {
			clearProgress();
		}
	} finally {
		if (isInteractive) {
			showCursor();
		}
	}

	// 4. Render benchmark table in definition order
	if (!silent && render) {
		renderTable(results, { width });
	}

	return results;
}

module.exports = {
	suite,
};
