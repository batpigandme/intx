"use strict";

const { sample } = require("./timer");

/**
 * Dynamically calibrates the loop iteration count for a runner to fit within a target duration window.
 * Uses geometric ramp-up probing to prevent running slow functions for too long.
 *
 * @param {Function} runner - Runner function (iters, tic, toc) => any.
 * @param {number} [dur=100] - Target duration in milliseconds per measurement sample.
 * @returns {number} Calibrated iteration count.
 */
function calibrate(runner, dur = 100) {
	const target = dur / 1000;
	const tierUpFloor = Math.max(0.05, target);
	const minElapsed = Math.max(tierUpFloor, target * 0.8);
	const maxElapsed = Math.max(0.25, target * 3.0);

	let iters = 100;
	let prevRate = 0;
	let total = 0;
	let stable = 0;
	let tieredUp = false;
	let res = sample(runner, iters);
	total += res.elapsed;

	for (let step = 0; step < 16; step++) {
		const rate = res.elapsed > 0 ? iters / res.elapsed : 0;

		if (res.elapsed >= tierUpFloor * 0.7) {
			tieredUp = true;
		}

		// Check rate stability once runner has tiered up and sample is measurable (>= 5ms)
		if (tieredUp && prevRate > 0 && res.elapsed >= 0.005) {
			const delta = Math.abs(rate - prevRate) / Math.max(rate, prevRate);
			if (delta <= 0.05) {
				stable++;
				if (stable >= 2 && total >= minElapsed) {
					return Math.max(1, Math.round(rate * target));
				}
			} else {
				stable = 0;
			}
		}

		if (total >= maxElapsed) {
			break;
		}

		prevRate = rate;

		if (res.elapsed < 0.004) {
			if (res.elapsed <= 0) {
				iters *= 10;
			} else {
				const estimated = Math.round((0.008 / res.elapsed) * iters);
				iters = Math.min(1e8, Math.max(iters * 4, estimated));
			}
		} else if (!tieredUp) {
			// Ramp towards tierUpFloor to ensure TurboFan compilation completes
			const floorIters = rate > 0 ? Math.round(rate * tierUpFloor) : iters * 2;
			iters = Math.min(1e8, Math.max(iters * 2, floorIters));
		} else if (res.elapsed >= target * 1.5) {
			// Step down to target duration once tiered up
			iters = Math.min(1e8, Math.max(10, Math.round(rate * target)));
		} else {
			const targetIters = rate > 0 ? Math.round(rate * target) : iters * 2;
			iters = Math.min(1e8, Math.min(targetIters, Math.round(iters * 2)));
		}

		res = sample(runner, iters);
		total += res.elapsed;
	}

	const finalRate = res.elapsed > 0 ? iters / res.elapsed : prevRate || 1e6;
	return Math.max(1, Math.round(finalRate * target));
}

module.exports = {
	calibrate,
};
