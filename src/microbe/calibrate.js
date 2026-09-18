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
	const minElapsedFloor = Math.min(0.010, targetSeconds * 0.5);
	const maxElapsedCeiling = Math.min(0.080, Math.max(0.020, targetSeconds * 0.6));

	let probeIters = 100;
	let prevRate = 0;
	let totalElapsed = 0;
	let stableCount = 0;
	let res = sample(runner, probeIters);
	totalElapsed += res.elapsed;

	for (let step = 0; step < 12; step++) {
		const rate = res.elapsed > 0 ? probeIters / res.elapsed : 0;

		// Check rate stability if sample duration is measurable (>= 2ms)
		if (prevRate > 0 && res.elapsed >= 0.002) {
			const delta = Math.abs(rate - prevRate) / Math.max(rate, prevRate);
			if (delta <= 0.15) {
				stableCount++;
				if (stableCount >= 2 && totalElapsed >= minElapsedFloor) {
					return Math.max(1, Math.round(rate * targetSeconds));
				}
			} else {
				stableCount = 0;
			}
		}

		prevRate = rate;

		if (res.elapsed < 0.002) {
			if (res.elapsed <= 0) {
				probeIters *= 10;
			} else {
				const estimated = Math.round((0.004 / res.elapsed) * probeIters);
				probeIters = Math.min(1e8, Math.max(probeIters * 5, estimated));
			}
		} else {
			probeIters = Math.min(1e8, Math.round(probeIters * 2));
		}

		res = sample(runner, probeIters);
		totalElapsed += res.elapsed;

		if (totalElapsed >= maxElapsedCeiling) {
			break;
		}
	}

	const finalRate = res.elapsed > 0 ? probeIters / res.elapsed : (prevRate || 1e6);
	return Math.max(1, Math.round(finalRate * targetSeconds));
}

module.exports = {
	calibrate,
};
