"use strict";

const { suite } = require("./suite");
const { renderTable } = require("./render");
const { presets } = require("./presets");

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
 * @param {object} runners - Object map of target names to runner functions `(iters, tic, toc) => any`.
 * @param {object} [options=presets.medium] - Comparison configuration options.
 * @param {number} [options.rounds=10] - Number of measurement rounds.
 * @param {number} [options.dur=50] - Target duration in milliseconds per sample (dynamic auto-calibration).
 * @param {number} [options.iters] - Manual iteration count (disables dynamic calibration).
 * @param {number} [options.cooldown=0] - Cooldown pause (in ms) between samples to allow CPU cooling.
 * @param {number} [options.pause=30] - Pause (in ms) between runners or round cycles.
 * @param {string} [options.mode="sequential"] - Execution ordering ("sequential").
 * @param {boolean} [options.prime=false] - If true, executes an untimed priming pass before each timed sample.
 * @param {boolean} [options.silent=false] - If true, suppresses console output.
 * @param {string|Function} [options.order="median"] - Metric to sort by ("median", "mean", "max", "min", "warmup") or comparator.
 * @param {number} [options.width=80] - Total table column width.
 * @returns {Array<object>} Sorted array of evaluated results.
 */
function rank(title, runners, options = presets.medium) {
	const order = options.order ?? "median";
	const comparator = getComparator(order);
	const silent = !!options.silent;
	const width = options.width ?? 80;

	// 1. Run suite (renders banner and live progress, suppresses unsorted table)
	const results = suite(title, runners, {
		...options,
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
