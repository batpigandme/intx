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
	const inlierCycles = sortedCycles.filter(
		(c) => c >= lowerFence && c <= upperFence,
	);

	const inlierN = inlierCycles.length;
	let inlierMeanRaw = meanRawCycles;
	let inlierMedianRaw = medianRawCycles;
	let inlierStddev = stddev;
	let inlierMoe = moe;
	let inlierMoePercent = moePercent;

	if (inlierN > 0) {
		const inlierSum = inlierCycles.reduce((acc, v) => acc + v, 0);
		inlierMeanRaw = inlierSum / inlierN;
		inlierMedianRaw = getPercentile(inlierCycles, 0.5);

		const inlierVariance =
			inlierN > 1
				? inlierCycles.reduce((acc, v) => acc + (v - inlierMeanRaw) ** 2, 0) /
					(inlierN - 1)
				: 0;
		inlierStddev = Math.sqrt(inlierVariance);
		const inlierDf = inlierN - 1;
		const inlierTCrit = getTCritical(inlierDf);
		const inlierSem = inlierN > 1 ? inlierStddev / Math.sqrt(inlierN) : 0;
		inlierMoe = inlierTCrit * inlierSem;
		inlierMoePercent =
			inlierMeanRaw > 0 ? (inlierMoe / inlierMeanRaw) * 100 : 0;
	}

	const inliers = {
		count: inlierN,
		moe: inlierMoe,
		moePercent: inlierMoePercent,
		medianCycles: inlierMedianRaw / iters,
		meanCycles: inlierMeanRaw / iters,
		stddev: inlierStddev,
	};

	const outliersInfo = {
		count: outliers.length,
		percent: n > 0 ? (outliers.length / n) * 100 : 0,
		values: outliers.map((c) => c / iters),
	};

	let bestSample = samples[0];
	for (let i = 1; i < n; i++) {
		if (samples[i].cycles < bestSample.cycles) {
			bestSample = samples[i];
		}
	}

	const minCycles = minRawCycles / iters;
	const maxCycles = maxRawCycles / iters;
	const medianCycles = medianRawCycles / iters;
	const meanCycles = meanRawCycles / iters;
	const medianInsPerOp = medianRawIns / iters;
	const bestInsPerOp = bestSample.instructions / iters;
	const medianIpc = medianCycles > 0 ? medianInsPerOp / medianCycles : 0.0;
	const bestIpc =
		bestSample.cycles > 0 ? bestSample.instructions / bestSample.cycles : 0.0;

	return {
		metric: "cycles",
		minCycles,
		maxCycles,
		medianCycles,
		meanCycles,
		insPerOp: medianInsPerOp,
		medianInsPerOp,
		bestInsPerOp,
		ipc: medianIpc,
		medianIpc,
		bestIpc,
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
		inliers,
		outliers: outliersInfo,
	};
}

module.exports = {
	computePmuStats,
};
