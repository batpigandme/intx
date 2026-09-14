"use strict";

const SHIFT_32 = 32n;

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * Optimized BigInt implementation using BigInt.asUintN(64, 32)
 * with a module-level constant `const SHIFT_32 = 32n`.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @param {Array|Uint32Array} out - Destination buffer [hi, lo].
 * @returns {Array|Uint32Array} Destination buffer out.
 */
function wmul(a, b, out) {
	const prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0));
	out[0] = Number(BigInt.asUintN(32, prod >> SHIFT_32));
	out[1] = Number(BigInt.asUintN(32, prod));
	return out;
}

module.exports = wmul;
