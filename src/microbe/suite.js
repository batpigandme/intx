"use strict";

const readline = require("node:readline");
const { sample } = require("./timer");
const { computeStats } = require("./stats");
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
 * Multi-target microbenchmark suite runner with thermal and ordering bias mitigation.
 * Executes targets in interleaved rounds while preserving declaration order in output and results.
 *
 * @param {string} title - Title of the benchmark suite.
 * @param {object} runners - Object map of target names to runner functions `(iters, startClock, stopClock) => any`.
 * @param {object} [options={}] - Suite configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.iters=5e7] - Iteration count per round.
 * @param {boolean} [options.shuffled=true] - If true, randomizes runner execution order per round.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @param {boolean} [options.render=true] - If true and not silent, renders benchmark table.
 * @returns {Array<object>} Array of evaluated results in original runner definition order.
 *
 * @example
 * const { suite, createRunner } = require('#microbe');
 *
 * suite('i32.add: Patterns', {
 *   '1. Serial': runner1,
 *   '2. Parallel': runner2,
 * }, {
 *   rounds: 5,
 *   iters: 2e7,
 * });
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
	const iters = options.iters ?? 5e7;
	const shuffled = options.shuffled ?? true;
	const silent = !!options.silent;
	const render = options.render ?? true;

	const width = options.width ?? 80;

	if (!silent && render) {
		renderBanner(title, { rounds, iters, shuffled, width });
	}

	const isInteractive = !silent && !!process.stdout.isTTY;

	if (isInteractive) {
		hideCursor();
	}

	let results;
	try {
		// 1. Warmup Phase (Round 0 for JIT tier-up across all candidates)
		const samples = {};
		const sampleDetails = {};
		const values = {};
		const warmup = {};

		for (const name of names) {
			const runner = runners[name];
			if (typeof runner !== "function") {
				throw new TypeError(
					`suite expected runner function for '${name}', received: ${typeof runner}`,
				);
			}
			if (isInteractive) {
				writeProgress(`🔥 Warming up JIT compilers ('${name}')... `);
			}
			const warmupSample = sample(runner, iters);
			warmup[name] = {
				elapsed: warmupSample.elapsed,
				iters,
				rate: iters / warmupSample.elapsed,
			};
			values[name] = warmupSample.value;
			samples[name] = [];
			sampleDetails[name] = [];
		}

		// 2. Interleaved Measurement Rounds
		for (let round = 1; round <= rounds; round++) {
			const roundOrder = shuffled ? shuffle([...names]) : names;

			for (const name of roundOrder) {
				if (isInteractive) {
					writeProgress(`[Round ${round}/${rounds}] Sampling '${name}'... `);
				}
				const runner = runners[name];
				const res = sample(runner, iters);
				values[name] = res.value;
				samples[name].push(res.elapsed);
				sampleDetails[name].push({
					round,
					elapsed: res.elapsed,
					iters,
					rate: iters / res.elapsed,
				});
			}
		}

		if (isInteractive) {
			clearProgress();
		}

		// 3. Compute statistics for all targets in definition order
		results = names.map((name) => {
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
