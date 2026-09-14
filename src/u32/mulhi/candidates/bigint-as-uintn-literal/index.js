"use strict";

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * BigInt implementation using BigInt.asUintN(64, ...) and literal shift.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} High 32 bits of the 64-bit product (a * b) >>> 32.
 */
function mulhi(a, b) {
	const prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0));
	return Number(prod >> 32n) >>> 0;
}

module.exports = mulhi;
