"use strict";

const { sample } = require("./timer");

/**
 * Dynamically calibrates the loop iteration count for a runner to fit within a target duration window.
 * Uses geometric ramp-up probing to prevent running slow functions for too long.
 *
 * @param {Function} runner - Runner function (iters, start, stop) => any.
 * @param {number} [dur=100] - Target duration in milliseconds per measurement sample.
 * @returns {number} Calibrated iteration count.
 */
function calibrate(runner, dur = 100) {
	const target = dur / 1000;
	const minElapsed = Math.min(0.010, target * 0.5);
	const maxElapsed = Math.min(0.080, Math.max(0.020, target * 0.6));

	let iters = 100;
	let prevRate = 0;
	let total = 0;
	let stable = 0;
	let res = sample(runner, iters);
	total += res.elapsed;

	for (let step = 0; step < 12; step++) {
		const rate = res.elapsed > 0 ? iters / res.elapsed : 0;

		// Check rate stability if sample duration is measurable (>= 2ms)
		if (prevRate > 0 && res.elapsed >= 0.002) {
			const delta = Math.abs(rate - prevRate) / Math.max(rate, prevRate);
			if (delta <= 0.15) {
				stable++;
				if (stable >= 2 && total >= minElapsed) {
					return Math.max(1, Math.round(rate * target));
				}
			} else {
				stable = 0;
			}
		}

		prevRate = rate;

		if (res.elapsed < 0.002) {
			if (res.elapsed <= 0) {
				iters *= 10;
			} else {
				const estimated = Math.round((0.004 / res.elapsed) * iters);
				iters = Math.min(1e8, Math.max(iters * 5, estimated));
			}
		} else {
			iters = Math.min(1e8, Math.round(iters * 2));
		}

		res = sample(runner, iters);
		total += res.elapsed;

		if (total >= maxElapsed) {
			break;
		}
	}

	const finalRate = res.elapsed > 0 ? iters / res.elapsed : (prevRate || 1e6);
	return Math.max(1, Math.round(finalRate * target));
}

module.exports = {
	calibrate,
};
