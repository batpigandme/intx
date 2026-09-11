"use strict";

/**
 * 32-bit unsigned integer multiplication (32x32 -> 32-bit low word).
 * Wraps Math.imul(a, b) >>> 0.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} Unsigned 32-bit product (a * b) mod 2^32.
 */
function mul(a, b) {
	return Math.imul(a, b) >>> 0;
}

module.exports = mul;
