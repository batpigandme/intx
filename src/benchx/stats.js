"use strict";

/**
 * Computes descriptive and robust statistics from round duration samples.
 *
 * @param {number[]} samples - Array of round durations in seconds.
 * @param {number} itersPerRound - Number of iterations executed per round.
 * @returns {object} Object containing statistical metrics.
 */
function computeStats(samples, itersPerRound) {
	const n = samples.length;
	const sortedTimes = [...samples].sort((a, b) => a - b);
	const minTime = sortedTimes[0];
	const maxTime = sortedTimes[n - 1];
	const medianTime =
		n % 2 === 1
			? sortedTimes[Math.floor(n / 2)]
			: (sortedTimes[n / 2 - 1] + sortedTimes[n / 2]) / 2;

	const sum = sortedTimes.reduce((acc, v) => acc + v, 0);
	const meanTime = sum / n;

	const variance =
		sortedTimes.reduce((acc, v) => acc + (v - meanTime) ** 2, 0) / (n - 1 || 1);
	const stddev = Math.sqrt(variance);
	const moePercent = (stddev / meanTime) * 100;

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
		moePercent,
		minRate,
		maxRate,
		medianRate,
		meanRate,
	};
}

module.exports = {
	computeStats,
};
