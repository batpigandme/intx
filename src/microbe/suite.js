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
 *
 * @param {string} title - Title of the benchmark suite.
 * @param {object} runners - Object map of target names to runner functions `(iters, start, stop) => any`.
 * @param {object} [options={}] - Suite configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.dur=100] - Target duration in milliseconds per sample (dynamic auto-calibration).
 * @param {number} [options.iters] - Manual iteration count (disables dynamic calibration).
 * @param {number} [options.cooldown=0] - Cooldown pause (in ms) between samples to allow CPU cooling.
 * @param {number} [options.pause=0] - Pause (in ms) between runners or round cycles.
 * @param {string} [options.mode="shuffled"] - Execution ordering ("shuffled", "sequential", "ordered").
 * @param {boolean} [options.prime=false] - If true, executes an untimed priming pass before each timed sample.
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
	const dur = options.dur ?? 100;
	const iters = options.iters;
	const dynamic = iters === undefined;
	const cooldown = options.cooldown ?? 0;
	const pause = options.pause ?? 0;
	const mode = options.mode || "shuffled";
	const prime = !!options.prime;
	const silent = !!options.silent;
	const render = options.render ?? true;
	const width = options.width ?? 80;

	if (!silent && render) {
		renderBanner(title, {
			rounds,
			iters,
			dur: dynamic ? dur : undefined,
			mode,
			cooldown,
			pause,
			prime,
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

		for (const name of names) {
			samples[name] = [];
			sampleDetails[name] = [];
		}

		function calibrateRunner(name) {
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

			const itersCount = dynamic ? calibrate(runner, dur) : iters;
			itersMap[name] = itersCount;

			const warmupSample = sample(runner, itersCount);
			warmup[name] = {
				elapsed: warmupSample.elapsed,
				iters: itersCount,
				rate: itersCount / warmupSample.elapsed,
			};
			values[name] = warmupSample.value;

			if (cooldown > 0) {
				sleep(cooldown);
			}
		}

		function sampleRunner(name, round) {
			if (isInteractive) {
				writeProgress(`[Round ${round}/${rounds}] Sampling '${name}'... `);
			}

			if (typeof global.gc === "function") {
				global.gc();
			}

			const runner = runners[name];
			const itersCount = itersMap[name];

			if (prime) {
				const primeIters = Math.min(10000, Math.max(100, (itersCount * 0.01) | 0));
				runner(primeIters, () => {}, () => {});
			}

			const res = sample(runner, itersCount);
			values[name] = res.value;
			samples[name].push(res.elapsed);
			sampleDetails[name].push({
				round,
				elapsed: res.elapsed,
				iters: itersCount,
				rate: itersCount / res.elapsed,
			});

			if (cooldown > 0) {
				sleep(cooldown);
			}
		}

		if (mode === "sequential") {
			for (let i = 0; i < names.length; i++) {
				const name = names[i];
				calibrateRunner(name);
				for (let round = 1; round <= rounds; round++) {
					sampleRunner(name, round);
				}
				if (pause > 0 && i < names.length - 1) {
					sleep(pause);
				}
			}
		} else {
			for (const name of names) {
				calibrateRunner(name);
			}
			for (let round = 1; round <= rounds; round++) {
				const roundOrder = mode === "ordered" ? names : shuffle([...names]);
				for (const name of roundOrder) {
					sampleRunner(name, round);
				}
				if (pause > 0 && round < rounds) {
					sleep(pause);
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
