"use strict";

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * Optimized BigInt implementation using BigInt.asUintN(64) on the product
 * and BigInt.asUintN(32) for both limbs, using inline literal 32n shift.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @param {Array|Uint32Array} out - Destination buffer [hi, lo].
 * @returns {Array|Uint32Array} Destination buffer out.
 */
function wmul(a, b, out) {
	const prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0));
	out[0] = Number(BigInt.asUintN(32, prod >> 32n));
	out[1] = Number(BigInt.asUintN(32, prod));
	return out;
}

module.exports = wmul;
