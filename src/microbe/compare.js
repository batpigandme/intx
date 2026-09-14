"use strict";

const { sample } = require("./timer");
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
 * @param {object} runners - Object map of target names to runner functions `(iters, startClock, stopClock) => any`.
 * @param {object} [options={}] - Comparison configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.iters=5e7] - Default iteration count per round.
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
		process.stdout.write("🔥 Warming up JIT compilers (Round 0)... ");
	}

	// 1. Warmup Phase (Round 0 for JIT tier-up across all candidates)
	const samples = {};
	const values = {};
	const warmup = {};

	for (const name of names) {
		const runner = runners[name];
		if (typeof runner !== "function") {
			throw new TypeError(
				`compare expected runner function for '${name}', received: ${typeof runner}`,
			);
		}
		const warmupSample = sample(runner, iters);
		warmup[name] = {
			elapsed: warmupSample.elapsed,
			iters,
			rate: iters / warmupSample.elapsed,
		};
		values[name] = warmupSample.value;
		samples[name] = [];
	}

	if (!silent) {
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
			const res = sample(runner, iters);
			values[name] = res.value;
			samples[name].push(res.elapsed);
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
			warmup: warmup[name],
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
