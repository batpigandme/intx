"use strict";

const { bench, warmupRunner, sampleRound } = require("./bench");
const { sleep } = require("#utils");
const { computeStats } = require("./stats");
const {
	renderTable,
	renderBanner,
	writeProgress,
	clearProgress,
	hideCursor,
	showCursor,
} = require("./render");
const { presets } = require("./presets");

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
 * Multi-target microbenchmark suite runner with dynamic calibration, statistical rigor, and isolation.
 *
 * @param {string} title - Title of the benchmark suite.
 * @param {object} runners - Object map of target names to runner functions `(iters, tic, toc) => any`.
 * @param {object} [options=presets.medium] - Suite configuration options.
 * @param {number} [options.rounds=10] - Number of measurement rounds.
 * @param {number} [options.dur=50] - Target duration in milliseconds per sample (dynamic auto-calibration).
 * @param {number} [options.iters] - Manual iteration count (disables dynamic calibration).
 * @param {number} [options.cooldown=0] - Cooldown pause (in ms) between samples to allow CPU cooling.
 * @param {number} [options.pause=30] - Pause (in ms) between runners or round cycles.
 * @param {string} [options.mode="sequential"] - Execution ordering ("sequential", "shuffled", "ordered").
 * @param {boolean} [options.prime=false] - If true, executes an untimed priming pass before each timed sample.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @param {boolean} [options.render=true] - If true and not silent, renders benchmark table.
 * @param {number} [options.width=80] - Total table column width.
 * @returns {Array<object>} Array of evaluated results in original runner definition order.
 */
function suite(title, runners, options = presets.medium) {
	if (!runners || typeof runners !== "object" || Array.isArray(runners)) {
		throw new TypeError(
			"suite expected runners to be an object map of runner functions.",
		);
	}

	const names = Object.keys(runners);
	if (names.length < 2) {
		throw new Error("suite requires at least two runner functions.");
	}

	for (const name of names) {
		if (typeof runners[name] !== "function") {
			throw new TypeError(
				`suite expected runner function for '${name}', received: ${typeof runners[name]}`,
			);
		}
	}

	const rounds = options.rounds ?? presets.medium.rounds;
	const dur = options.dur ?? presets.medium.dur;
	const iters = options.iters;
	const dynamic = iters === undefined;
	const cooldown = options.cooldown ?? presets.medium.cooldown;
	const pause = options.pause ?? presets.medium.pause;
	const mode = options.mode ?? presets.medium.mode;
	const prime =
		options.prime ?? (mode === "shuffled" ? true : presets.medium.prime);
	const silent = !!options.silent;
	const banner = options.banner ?? true;
	const render = options.render ?? true;
	const width = options.width ?? 80;

	if (!silent && banner) {
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
		if (mode === "sequential") {
			results = [];
			for (let i = 0; i < names.length; i++) {
				const name = names[i];
				results.push(
					bench(name, runners[name], {
						...options,
						prime,
						render: false,
						cursor: false,
					}),
				);

				if (pause > 0 && i < names.length - 1) {
					sleep(pause);
				}
			}
		} else {
			// Interleaved: "shuffled" or "ordered"
			const itersMap = {};
			const warmupMap = {};
			const values = {};
			const samples = {};
			const sampleDetails = {};

			for (const name of names) {
				samples[name] = [];
				sampleDetails[name] = [];
				if (isInteractive) {
					writeProgress(`🔥 Warming up & calibrating JIT ('${name}')... `);
				}
				const {
					iters: itersCount,
					warmup,
					value,
				} = warmupRunner(runners[name], { ...options, prime });
				itersMap[name] = itersCount;
				warmupMap[name] = warmup;
				values[name] = value;
			}

			for (let round = 1; round <= rounds; round++) {
				const roundOrder = mode === "ordered" ? names : shuffle([...names]);
				for (const name of roundOrder) {
					if (isInteractive) {
						writeProgress(`[Round ${round}/${rounds}] Sampling '${name}'... `);
					}
					const itersCount = itersMap[name];
					const res = sampleRound(runners[name], itersCount, {
						...options,
						prime,
					});
					values[name] = res.value;
					samples[name].push(res.elapsed);
					sampleDetails[name].push({
						round,
						elapsed: res.elapsed,
						iters: itersCount,
						rate: itersCount / res.elapsed,
					});
				}

				if (pause > 0 && round < rounds) {
					sleep(pause);
				}
			}

			results = names.map((name) => {
				const itersCount = itersMap[name];
				const stats = computeStats(samples[name], itersCount);
				return {
					title: name,
					name,
					value: values[name],
					warmup: warmupMap[name],
					samples: sampleDetails[name],
					rounds,
					iters: itersCount,
					...stats,
				};
			});
		}

		if (isInteractive) {
			clearProgress();
		}
	} finally {
		if (isInteractive) {
			showCursor();
		}
	}

	if (!silent && render) {
		renderTable(results, { width });
	}

	return results;
}

module.exports = {
	suite,
};
