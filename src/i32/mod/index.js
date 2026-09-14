"use strict";

/**
 * 32-bit signed integer modulo (remainder).
 * Uses explicit Int32 coercion to guarantee hardware idivl emission.
 *
 * @param {number} a - Dividend as 32-bit signed integer.
 * @param {number} b - Divisor as 32-bit signed integer.
 * @returns {number} Signed 32-bit remainder (a % b).
 */
function mod(a, b) {
	return ((a | 0) % (b | 0)) | 0;
}

module.exports = mod;
