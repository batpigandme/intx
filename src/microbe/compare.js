"use strict";

const { performance } = require("node:perf_hooks");
const { computeStats } = require("./stats");
const { renderTable } = require("./render");

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
 * Multi-target benchmark showdown & ranking orchestrator.
 *
 * @param {string} title - Title of the comparison suite.
 * @param {object} runners - Object map of target names to runner functions.
 * @param {object} [options={}] - Comparison configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.iters=5e7] - Default iteration count per round.
 * @param {number} [options.warmup] - Warmup iteration count.
 * @param {boolean} [options.shuffled=true] - If true, randomizes runner order per round; otherwise round-robin.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @returns {Array<object>} Sorted array of evaluated results.
 *
 * @example
 * const { compare, createRunner } = require('#microbe');
 *
 * compare('u32.wmul: Showdown', {
 *   'candidate-1': runner1,
 *   'candidate-2': runner2,
 * }, {
 *   rounds: 5,
 *   iters: 5e7,
 *   shuffled: true,
 * });
 */
function compare(title, runners, options = {}) {
	if (!runners || typeof runners !== "object" || Array.isArray(runners)) {
		throw new TypeError(
			"compare expected runners to be an object map of runner functions.",
		);
	}

	const names = Object.keys(runners);
	if (names.length < 2) {
		throw new Error("compare requires at least two runner functions.");
	}

	const rounds = options.rounds ?? 5;
	const iters = options.iters ?? 5e7;
	const warmup = options.warmup ?? Math.min(iters * 0.1, 5e6);
	const shuffled = options.shuffled ?? true;
	const silent = !!options.silent;

	const orderLabel = shuffled ? "Order: Shuffled" : "Order: Round-Robin";

	if (!silent) {
		console.log(`\n${"=".repeat(100)}`);
		console.log(` ${title} (Node ${process.version}, ${process.arch})`);
		console.log(
			` Config: ${rounds} rounds × ${iters.toExponential()} iters/round | ${orderLabel}`,
		);
		console.log(`${"=".repeat(100)}\n`);
		if (warmup > 0) {
			process.stdout.write("🔥 Warming up JIT compilers... ");
		}
	}

	// 1. Warmup Phase (tier-up all runners in V8 TurboFan)
	const samples = {};
	const values = {};

	for (const name of names) {
		const runner = runners[name];
		if (typeof runner !== "function") {
			throw new TypeError(
				`compare expected runner function for '${name}', received: ${typeof runner}`,
			);
		}
		if (warmup > 0) {
			runner(warmup);
			runner(warmup);
		}
		samples[name] = [];
	}

	if (!silent && warmup > 0) {
		console.log("Ready.\n");
	}

	// 2. Interleaved Measurement Rounds
	for (let round = 1; round <= rounds; round++) {
		if (!silent) {
			process.stdout.write(
				`\r [Round ${round}/${rounds}] Sampling runners... `,
			);
		}

		const roundOrder = shuffled ? shuffle([...names]) : names;

		for (const name of roundOrder) {
			const runner = runners[name];
			const t0 = performance.now();
			values[name] = runner(iters);
			const t1 = performance.now();
			samples[name].push((t1 - t0) / 1000);
		}
	}

	if (!silent) {
		console.log(`\r [Completed ${rounds} measurement rounds]             \n`);
	}

	// 3. Compute statistics for all targets
	const results = names.map((name) => {
		const stats = computeStats(samples[name], iters);
		return {
			name,
			value: values[name],
			...stats,
		};
	});

	// Sort by median throughput descending
	results.sort((a, b) => b.medianRate - a.medianRate);

	// 4. Render Table
	if (!silent) {
		renderTable(results);
	}

	return results;
}

module.exports = {
	compare,
};
