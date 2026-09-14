"use strict";

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * BigInt implementation using BigInt.asUintN(32, ...) truncation.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} High 32 bits of the 64-bit product (a * b) >>> 32.
 */
function mulhi(a, b) {
	const prod = BigInt(a >>> 0) * BigInt(b >>> 0);
	return Number(BigInt.asUintN(32, prod >> 32n));
}

module.exports = mulhi;
