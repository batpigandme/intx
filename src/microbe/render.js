"use strict";

/**
 * Formats throughput rate into human-readable engineering notation.
 *
 * @param {number} rate - Throughput in iterations per second.
 * @returns {string} Formatted string (e.g. "370.50 M", "2.10 G").
 */
function formatRate(rate) {
	if (rate >= 1e9) return `${(rate / 1e9).toFixed(2)} G`;
	if (rate >= 1e6) return `${(rate / 1e6).toFixed(2)} M`;
	if (rate >= 1e3) return `${(rate / 1e3).toFixed(2)} K`;
	return rate.toFixed(2);
}

/**
 * Renders a single kernel benchmark summary line to stdout.
 *
 * @param {object} result - Benchmark result object.
 */
function renderBench(result) {
	const title = result.title || result.name || "";
	const padTitle = title.padEnd(40);
	const medianStr = `${formatRate(result.medianRate)} iters/s`;
	const peakStr = `${formatRate(result.maxRate)} iters/s`;
	const moeStr = `±${result.moePercent.toFixed(1)}%`;
	console.log(
		`${padTitle} :: ${result.rounds} rounds × ${result.iters.toExponential()} iters | Median: ${medianStr.padStart(18)} | Peak: ${peakStr.padStart(18)} (${moeStr})`,
	);
}

/**
 * Renders the multi-target comparison table to stdout.
 *
 * @param {Array<object>} results - Sorted result objects.
 */
function renderTable(results) {
	const baselineMedian = results[0].medianRate;

	console.log(
		`Rank  ${"Kernel / Target".padEnd(42)}${"Median (iters/s)".padStart(16)}${"Peak (iters/s)".padStart(16)}${"MoE (±%)".padStart(10)}${"Relative".padStart(10)}`,
	);
	console.log("-".repeat(100));

	results.forEach((res, idx) => {
		const rank = `${idx + 1}.`.padStart(4);
		const name = res.name.padEnd(42);
		const medianRate = formatRate(res.medianRate).padStart(16);
		const peakRate = formatRate(res.maxRate).padStart(16);
		const moe = `±${res.moePercent.toFixed(1)}%`.padStart(10);
		const relative =
			idx === 0
				? "baseline".padStart(10)
				: `${(res.medianRate / baselineMedian).toFixed(2)}x`.padStart(10);

		console.log(`${rank}  ${name}${medianRate}${peakRate}${moe}${relative}`);
	});

	console.log("-".repeat(100));
	console.log(
		`🏆 Winner: ${results[0].name} (${formatRate(results[0].medianRate)} iters/s)\n`,
	);
}

module.exports = {
	formatRate,
	renderBench,
	renderTable,
};
