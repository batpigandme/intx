"use strict";

/**
 * 32-bit signed integer subtraction with two's complement modular wrapping.
 * Uses explicit Int32 coercion to prevent Float64 promotion in TurboFan.
 *
 * @param {number} a - First 32-bit signed integer operand.
 * @param {number} b - Second 32-bit signed integer operand.
 * @returns {number} Signed 32-bit difference (a - b) mod 2^32.
 */
function sub(a, b) {
	return ((a | 0) - (b | 0)) | 0;
}

module.exports = sub;
