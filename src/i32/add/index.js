"use strict";

/**
 * 32-bit signed integer addition with two's complement modular wrapping.
 * Uses explicit Int32 coercion to prevent Float64 promotion in TurboFan.
 *
 * @param {number} a - First 32-bit signed integer operand.
 * @param {number} b - Second 32-bit signed integer operand.
 * @returns {number} Signed 32-bit sum (a + b) mod 2^32.
 */
function add(a, b) {
	return ((a | 0) + (b | 0)) | 0;
}

module.exports = add;
