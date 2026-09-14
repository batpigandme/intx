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
 * @param {object} runners - Object map of target names to runner functions `(iters, startClock, stopClock) => any`.
 * @param {object} [options={}] - Comparison configuration options.
 * @param {number} [options.rounds=5] - Number of measurement rounds.
 * @param {number} [options.iters=5e7] - Default iteration count per round.
 * @param {boolean} [options.shuffled=true] - If true, randomizes runner order per round; otherwise round-robin.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @param {string|Function} [options.order="median"] - Metric to sort by ("median", "mean", "max", "min", "warmup") or comparator.
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
 *   order: 'median',
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

	const order = options.order ?? "median";
	const comparator = getComparator(order);

	const silent = !!options.silent;
	const rounds = options.rounds ?? 5;
	const iters = options.iters ?? 5e7;
	const shuffled = options.shuffled ?? true;

	const width = options.width ?? 80;

	if (!silent) {
		renderBanner(title, { rounds, iters, shuffled, width });
	}

	// 1. Run suite without individual block rendering
	const results = suite(title, runners, {
		...options,
		silent,
		render: false,
	});

	// 2. Sort by specified metric/comparator
	results.sort(comparator);

	// 3. Render comparison showdown table
	if (!silent) {
		renderTable(results, { isRanked: true, width });
	}

	return results;
}

module.exports = {
	compare,
};
