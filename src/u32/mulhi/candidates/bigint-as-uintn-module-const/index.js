"use strict";

const BITS_64 = 64;
const SHIFT_32 = 32n;

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * BigInt implementation with module-scoped constant shift and width parameters.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} High 32 bits of the 64-bit product (a * b) >>> 32.
 */
function mulhi(a, b) {
	const prod = BigInt.asUintN(BITS_64, BigInt(a >>> 0) * BigInt(b >>> 0));
	return Number(prod >> SHIFT_32) >>> 0;
}

module.exports = mulhi;
