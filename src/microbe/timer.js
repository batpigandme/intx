"use strict";

const { performance } = require("node:perf_hooks");

let ticTime = 0;
let tocTime = 0;

/**
 * Starts the high-resolution timer clock. Call immediately before the measurement loop.
 */
function tic() {
	ticTime = performance.now();
}

/**
 * Stops the high-resolution timer clock. Call immediately after the measurement loop.
 */
function toc() {
	tocTime = performance.now();
}

/**
 * Samples a runner by invoking it with (iters, tic, toc) and recording the measured duration.
 *
 * @param {Function} runner - Runner function (iters, tic, toc) => any
 * @param {number} iters - Iteration count for this sample.
 * @returns {{ value: any, elapsed: number }} Computed value and elapsed duration in seconds.
 */
function sample(runner, iters) {
	ticTime = 0;
	tocTime = 0;
	const fallbackStart = performance.now();
	const value = runner(iters, tic, toc);
	const fallbackStop = performance.now();
	const elapsed =
		ticTime > 0 && tocTime >= ticTime
			? (tocTime - ticTime) / 1000
			: (fallbackStop - fallbackStart) / 1000;
	return {
		value,
		elapsed,
	};
}

module.exports = {
	sample,
};
