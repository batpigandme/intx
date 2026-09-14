"use strict";

/**
 * Count leading zeros in a 32-bit binary representation.
 * Wraps Math.clz32(a).
 *
 * @param {number} a - 32-bit integer operand.
 * @returns {number} Number of leading zero bits (0-32).
 */
function clz(a) {
	return Math.clz32(a);
}

module.exports = clz;
