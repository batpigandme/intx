"use strict";

const TWO_32_BI = 0x100000000n;

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * BigInt implementation using BigInt division by 2^32.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} High 32 bits of the 64-bit product (a * b) >>> 32.
 */
function mulhi(a, b) {
	const prod = BigInt(a >>> 0) * BigInt(b >>> 0);
	return Number(prod / TWO_32_BI) >>> 0;
}

module.exports = mulhi;
