"use strict";

/**
 * Generates a random unsigned 32-bit integer [0, 2^32 - 1].
 * @returns {number}
 */
function randomU32() {
	return (Math.random() * 0x100000000) >>> 0;
}

/**
 * Generates a random signed 32-bit integer [-2^31, 2^31 - 1].
 * @returns {number}
 */
function randomI32() {
	return (Math.random() * 0x100000000) | 0;
}

module.exports = {
	randomU32,
	randomI32,
};
