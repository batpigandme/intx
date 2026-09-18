"use strict";

const { suite } = require("./suite");
const { renderTable, renderBanner } = require("./render");

/**
 * Returns a comparator function for sorting benchmark results based on order key.
 *
 * @param {string|Function} order - Metric name or custom comparison function.
 * @returns {Function} Comparator function (a, b) => number.
 */
function getComparator(order) {
	if (typeof order === "function") {
		return order;
	}
	switch (order) {
		case "median":
			return (a, b) => b.medianRate - a.medianRate;
		case "mean":
			return (a, b) => b.meanRate - a.meanRate;
		case "max":
		case "peak":
			return (a, b) => b.maxRate - a.maxRate;
		case "min":
			return (a, b) => b.minRate - a.minRate;
		case "warmup":
			return (a, b) => (b.warmup?.rate ?? 0) - (a.warmup?.rate ?? 0);
		default:
			throw new Error(
				`Unknown comparison order: "${order}". Expected "median", "mean", "max", "min", "warmup", or a custom comparator function.`,
			);
	}
}

/**
 * Multi-target benchmark showdown & ranking orchestrator.
 *
 * @param {string} title - Title of the comparison suite.
 * @param {object} runners - Object map of target names to runner functions `(iters, start, stop) => any`.
 * @param {object} [options={}] - Comparison configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.time=100] - Target duration in milliseconds per sample (dynamic auto-calibration).
 * @param {number} [options.iters] - Manual iteration count (disables dynamic calibration).
 * @param {number} [options.cooldown=0] - Cooldown pause (in ms) between samples to allow CPU cooling.
 * @param {number} [options.pause=0] - Pause (in ms) between runners or round cycles.
 * @param {string} [options.mode="shuffled"] - Execution ordering ("shuffled", "sequential", "ordered").
 * @param {boolean} [options.prime=false] - If true, executes an untimed priming pass before each timed sample.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @param {string|Function} [options.order="median"] - Metric to sort by ("median", "mean", "max", "min", "warmup") or comparator.
 * @param {number} [options.width=80] - Total table column width.
 * @returns {Array<object>} Sorted array of evaluated results.
 */
function rank(title, runners, options = {}) {
	if (!runners || typeof runners !== "object" || Array.isArray(runners)) {
		throw new TypeError(
			"bench.suite.rank expected runners to be an object map of runner functions.",
		);
	}

	const names = Object.keys(runners);
	if (names.length < 2) {
		throw new Error("bench.suite.rank requires at least two runner functions.");
	}

	const order = options.order ?? "median";
	const comparator = getComparator(order);
	const silent = !!options.silent;
	const width = options.width ?? 80;

	if (!silent) {
		renderBanner(title, {
			rounds: options.rounds ?? 5,
			iters: options.iters,
			time: options.iters === undefined ? (options.time ?? 100) : undefined,
			mode: options.mode || "shuffled",
			cooldown: options.cooldown ?? 0,
			pause: options.pause ?? 0,
			prime: !!options.prime,
			width,
		});
	}

	// 1. Run suite without individual block rendering
	const results = suite(title, runners, {
		...options,
		silent: true,
		render: false,
	});

	// 2. Sort by specified metric/comparator
	results.sort(comparator);

	// 3. Render comparison showdown table
	if (!silent) {
		renderTable(results, { ranked: true, width });
	}

	return results;
}

module.exports = {
	rank,
};
