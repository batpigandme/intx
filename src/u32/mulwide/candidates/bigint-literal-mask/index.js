"use strict";

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * Baseline BigInt reference implementation with inline literal shift (32n)
 * and mask (0xffffffffn).
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @param {Array|Uint32Array} out - Destination buffer [hi, lo].
 * @returns {Array|Uint32Array} Destination buffer out.
 */
function wmul(a, b, out) {
	const prod = BigInt(a >>> 0) * BigInt(b >>> 0);
	out[0] = Number(prod >> 32n) >>> 0;
	out[1] = Number(prod & 0xffffffffn) >>> 0;
	return out;
}

module.exports = wmul;
