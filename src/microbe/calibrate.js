"use strict";

const { sample } = require("./timer");

/**
 * Dynamically calibrates the loop iteration count for a runner to fit within a target duration window.
 * Uses geometric ramp-up probing to prevent running slow functions for too long.
 *
 * @param {Function} runner - Runner function (iters, startClock, stopClock) => any.
 * @param {number} [targetMs=100] - Target duration in milliseconds per measurement sample.
 * @returns {number} Calibrated iteration count.
 */
function calibrate(runner, targetMs = 100) {
	const targetSeconds = targetMs / 1000;
	let probeIters = 1;
	let res = sample(runner, probeIters);

	// Ramp up exponentially until we get a reliable timing sample (>= 2ms)
	while (res.elapsed < 0.002 && probeIters < 1e8) {
		if (res.elapsed <= 0) {
			probeIters *= 100;
		} else {
			const estimated = Math.round((0.005 / res.elapsed) * probeIters);
			probeIters = Math.min(1e8, Math.max(probeIters * 10, estimated));
		}
		res = sample(runner, probeIters);
	}

	const rate = res.elapsed > 0 ? probeIters / res.elapsed : 1e6;
	const calibrated = Math.max(1, Math.round(rate * targetSeconds));

	return calibrated;
}

module.exports = {
	calibrate,
};
