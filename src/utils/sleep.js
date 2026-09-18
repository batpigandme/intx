"use strict";

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
	sleep,
};
