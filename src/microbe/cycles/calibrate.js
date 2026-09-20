"use strict";

const { sample } = require("./timer");

/**
 * Resolves the target cycle count from options.
 *
 * @param {number|object} [options] - Target cycle count number or options object ({ cycles, dur }).
 * @returns {number} Target unhalted cycle count.
 */
function resolveTargetCycles(options) {
	if (typeof options === "number") {
		return options > 0 ? options : 5e7;
	}
	if (options && typeof options === "object") {
		if (typeof options.cycles === "number" && options.cycles > 0) {
			return options.cycles;
		}
		if (typeof options.dur === "number" && options.dur > 0) {
			// 1 ms ≈ 2,000,000 unhalted cycles on modern 2 GHz+ CPUs
			return options.dur * 2e6;
		}
	}
	return 5e7; // Default: 50 Million unhalted cycles (~15-25ms)
}

/**
 * Dynamically calibrates the loop iteration count for a runner to fit within a target CPU cycle budget.
 * Uses geometric ramp-up probing to warm up V8 JIT tiering (TurboFan) and measure unhalted cycles per op.
 *
 * @param {Function} runner - Runner function (iters, tic, toc) => any.
 * @param {number|object} [options] - Target cycle budget number or options object.
 * @returns {number} Calibrated iteration count.
 */
function calibrate(runner, options) {
	const targetCycles = resolveTargetCycles(options);
	const minWarmupCycles = 1e8;
	const maxWarmupCycles = Math.max(targetCycles * 3.0, 3e8);

	let iters = 100;
	let prevCycPerOp = 0;
	let totalCycles = 0;
	let stable = 0;
	let tieredUp = false;

	let res = sample(runner, iters);
	totalCycles += res.cycles;

	for (let step = 0; step < 16; step++) {
		const cycPerOp = iters > 0 && res.cycles > 0 ? res.cycles / iters : 0;

		if (totalCycles >= minWarmupCycles) {
			tieredUp = true;
		}

		// Check rate stability once runner has tiered up into TurboFan
		if (tieredUp && prevCycPerOp > 0 && cycPerOp > 0) {
			const delta =
				Math.abs(cycPerOp - prevCycPerOp) / Math.max(cycPerOp, prevCycPerOp);
			if (delta <= 0.05) {
				stable++;
				if (stable >= 2) {
					const raw = Math.round(targetCycles / cycPerOp);
					const aligned = Math.round(raw / 16) * 16;
					return Math.max(16, Math.min(1e8, aligned));
				}
			} else {
				stable = 0;
			}
		}

		if (totalCycles >= maxWarmupCycles) {
			break;
		}

		prevCycPerOp = cycPerOp;

		if (res.cycles < 50000) {
			if (res.cycles <= 0) {
				iters *= 10;
			} else {
				const estimated = Math.round((200000 / res.cycles) * iters);
				iters = Math.min(1e8, Math.max(iters * 4, estimated));
			}
		} else if (!tieredUp) {
			// Ramp towards minWarmupCycles to ensure TurboFan compilation completes
			const floorIters =
				cycPerOp > 0
					? Math.round((minWarmupCycles * 0.5) / cycPerOp)
					: iters * 2;
			iters = Math.min(1e8, Math.max(iters * 2, floorIters));
		} else if (res.cycles >= targetCycles * 1.5) {
			// Step down to target
			iters = Math.min(1e8, Math.max(10, Math.round(targetCycles / cycPerOp)));
		} else {
			const targetIters =
				cycPerOp > 0 ? Math.round(targetCycles / cycPerOp) : iters * 2;
			iters = Math.min(1e8, Math.min(targetIters, Math.round(iters * 2)));
		}

		res = sample(runner, iters);
		totalCycles += res.cycles;
	}

	const finalCycPerOp =
		res.cycles > 0 && iters > 0 ? res.cycles / iters : prevCycPerOp || 1;
	const raw = Math.round(targetCycles / finalCycPerOp);
	const aligned = Math.round(raw / 16) * 16;
	return Math.max(16, Math.min(1e8, aligned));
}

module.exports = {
	calibrate,
	resolveTargetCycles,
};
