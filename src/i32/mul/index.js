"use strict";

/**
 * 32-bit signed integer multiplication (32x32 -> 32-bit signed low word).
 * Wraps Math.imul(a, b).
 *
 * @param {number} a - First 32-bit signed integer operand.
 * @param {number} b - Second 32-bit signed integer operand.
 * @returns {number} Signed 32-bit product (a * b) mod 2^32.
 */
function mul(a, b) {
	return Math.imul(a, b);
}

module.exports = mul;
