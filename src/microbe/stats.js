"use strict";

/**
 * Two-tailed Student's t-distribution critical values for 95% confidence interval.
 * Keyed by degrees of freedom (df = n - 1).
 */
const T_TABLE_95 = {
	1: 12.706,
	2: 4.303,
	3: 3.182,
	4: 2.776,
	5: 2.571,
	6: 2.447,
	7: 2.365,
	8: 2.306,
	9: 2.262,
	10: 2.228,
	11: 2.201,
	12: 2.179,
	13: 2.16,
	14: 2.145,
	15: 2.131,
	16: 2.12,
	17: 2.11,
	18: 2.101,
	19: 2.093,
	20: 2.086,
	25: 2.06,
	30: 2.042,
	40: 2.021,
	50: 2.009,
	60: 2.0,
	80: 1.99,
	100: 1.984,
};

/**
 * Retrieves the two-tailed 95% critical t-value for a given degrees of freedom.
 *
 * @param {number} df - Degrees of freedom (n - 1).
 * @returns {number} Critical t-value.
 */
function getTCritical(df) {
	if (df <= 0) return 1.96;
	if (T_TABLE_95[df]) return T_TABLE_95[df];
	if (df > 100) return 1.96;

	// Nearest lower lookup
	const keys = Object.keys(T_TABLE_95)
		.map(Number)
		.sort((a, b) => a - b);
	let closest = keys[0];
	for (const k of keys) {
		if (k <= df) closest = k;
		else break;
	}
	return T_TABLE_95[closest] || 1.96;
}

/**
 * Calculates a specific percentile from a sorted array of numbers.
 *
 * @param {number[]} sorted - Ascending sorted array.
 * @param {number} p - Percentile between 0 and 1.
 * @returns {number} Value at percentile.
 */
function getPercentile(sorted, p) {
	const n = sorted.length;
	if (n === 0) return 0;
	if (n === 1) return sorted[0];

	const index = (n - 1) * p;
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	const weight = index - lower;

	if (lower === upper) return sorted[lower];
	return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Computes descriptive and robust statistics from round duration samples.
 *
 * @param {number[]} samples - Array of round durations in seconds.
 * @param {number} itersPerRound - Number of iterations executed per round.
 * @returns {object} Object containing statistical metrics.
 */
function computeStats(samples, itersPerRound) {
	const n = samples.length;
	if (n === 0) {
		throw new Error("computeStats requires at least one sample.");
	}

	const sortedTimes = [...samples].sort((a, b) => a - b);
	const minTime = sortedTimes[0];
	const maxTime = sortedTimes[n - 1];
	const medianTime = getPercentile(sortedTimes, 0.5);

	const sum = sortedTimes.reduce((acc, v) => acc + v, 0);
	const meanTime = sum / n;

	const variance =
		n > 1
			? sortedTimes.reduce((acc, v) => acc + (v - meanTime) ** 2, 0) / (n - 1)
			: 0;
	const stddev = Math.sqrt(variance);

	// Student's t-distribution Margin of Error at 95% Confidence Interval
	const df = n - 1;
	const tCrit = getTCritical(df);
	const sem = n > 1 ? stddev / Math.sqrt(n) : 0;
	const moe = tCrit * sem;
	const moePercent = meanTime > 0 ? (moe / meanTime) * 100 : 0;

	// Interquartile Range (IQR) and Outlier Analysis
	const q1 = getPercentile(sortedTimes, 0.25);
	const q3 = getPercentile(sortedTimes, 0.75);
	const iqr = q3 - q1;
	const lowerFence = q1 - 1.5 * iqr;
	const upperFence = q3 + 1.5 * iqr;
	const outliers = sortedTimes.filter((t) => t < lowerFence || t > upperFence);

	const minRate = itersPerRound / maxTime;
	const maxRate = itersPerRound / minTime;
	const medianRate = itersPerRound / medianTime;
	const meanRate = itersPerRound / meanTime;

	return {
		minTime,
		maxTime,
		medianTime,
		meanTime,
		stddev,
		sem,
		moe,
		moePercent,
		q1,
		q3,
		iqr,
		outlierCount: outliers.length,
		minRate,
		maxRate,
		medianRate,
		meanRate,
	};
}

module.exports = {
	computeStats,
	getTCritical,
	getPercentile,
};
