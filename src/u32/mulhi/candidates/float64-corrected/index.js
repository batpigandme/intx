"use strict";

const INV_TWO_32 = 1 / 4294967296;

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * Double-precision float product with Math.imul exact low-word and residual correction.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} High 32 bits of the 64-bit product (a * b) >>> 32.
 */
function mulhi(a, b) {
	a >>>= 0;
	b >>>= 0;
	return ((a * b - (Math.imul(a, b) >>> 0)) * INV_TWO_32 + 0.5) >>> 0;
}

module.exports = mulhi;
