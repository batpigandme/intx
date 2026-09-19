"use strict";

const { getTCritical, getPercentile } = require("../stats");

/**
 * Computes descriptive and robust PMU statistics from sample rounds.
 *
 * @param {Array<{ cycles: number, instructions: number, ipc: number }>} samples - Round sample measurements.
 * @param {number} iters - Iterations per round.
 * @returns {object} Calculated PMU statistics.
 */
function computePmuStats(samples, iters) {
	const n = samples.length;
	if (n === 0) {
		throw new Error("computePmuStats requires at least one sample.");
	}

	const sortedCycles = samples.map((s) => s.cycles).sort((a, b) => a - b);
	const sortedIns = samples.map((s) => s.instructions).sort((a, b) => a - b);

	const minRawCycles = sortedCycles[0];
	const maxRawCycles = sortedCycles[n - 1];
	const medianRawCycles = getPercentile(sortedCycles, 0.5);

	const sumCycles = sortedCycles.reduce((acc, v) => acc + v, 0);
	const meanRawCycles = sumCycles / n;

	const medianRawIns = getPercentile(sortedIns, 0.5);

	const variance =
		n > 1
			? sortedCycles.reduce((acc, v) => acc + (v - meanRawCycles) ** 2, 0) /
				(n - 1)
			: 0;
	const stddev = Math.sqrt(variance);

	const df = n - 1;
	const tCrit = getTCritical(df);
	const sem = n > 1 ? stddev / Math.sqrt(n) : 0;
	const moe = tCrit * sem;
	const moePercent = meanRawCycles > 0 ? (moe / meanRawCycles) * 100 : 0;

	const q1 = getPercentile(sortedCycles, 0.25);
	const q3 = getPercentile(sortedCycles, 0.75);
	const iqr = q3 - q1;
	const lowerFence = q1 - 1.5 * iqr;
	const upperFence = q3 + 1.5 * iqr;
	const outliers = sortedCycles.filter((c) => c < lowerFence || c > upperFence);

	const minCycles = minRawCycles / iters;
	const maxCycles = maxRawCycles / iters;
	const medianCycles = medianRawCycles / iters;
	const meanCycles = meanRawCycles / iters;
	const insPerOp = medianRawIns / iters;
	const ipc = medianCycles > 0 ? insPerOp / medianCycles : 0.0;

	return {
		metric: "cycles",
		minCycles,
		maxCycles,
		medianCycles,
		meanCycles,
		insPerOp,
		ipc,
		minRawCycles,
		maxRawCycles,
		medianRawCycles,
		meanRawCycles,
		stddev,
		sem,
		moe,
		moePercent,
		q1,
		q3,
		iqr,
		outlierCount: outliers.length,
	};
}

module.exports = {
	computePmuStats,
};
