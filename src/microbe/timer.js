"use strict";

const { performance } = require("node:perf_hooks");

let startTime = 0;
let stopTime = 0;

/**
 * Starts the high-resolution timer clock. Call immediately before the measurement loop.
 */
function startClock() {
	startTime = performance.now();
}

/**
 * Stops the high-resolution timer clock. Call immediately after the measurement loop.
 */
function stopClock() {
	stopTime = performance.now();
}

/**
 * Samples a runner by invoking it with (iters, startClock, stopClock) and recording the measured duration.
 *
 * @param {Function} runner - Runner function (iters, startClock, stopClock) => any
 * @param {number} iters - Iteration count for this sample.
 * @returns {{ value: any, elapsed: number }} Computed value and elapsed duration in seconds.
 */
function sample(runner, iters) {
	startTime = 0;
	stopTime = 0;
	const value = runner(iters, startClock, stopClock);
	const elapsed = (stopTime - startTime) / 1000;
	return {
		value,
		elapsed,
	};
}

const sab = new SharedArrayBuffer(4);
const sleepInt32 = new Int32Array(sab);

/**
 * Synchronously sleeps the current thread for the specified duration using OS kernel futex.
 * Consumes 0% CPU to allow CPU cores to cool down and recover Turbo Boost headroom.
 *
 * @param {number} ms - Milliseconds to sleep.
 */
function sleep(ms) {
	if (ms > 0) {
		Atomics.wait(sleepInt32, 0, 0, ms);
	}
}

module.exports = {
	sample,
	sleep,
};

