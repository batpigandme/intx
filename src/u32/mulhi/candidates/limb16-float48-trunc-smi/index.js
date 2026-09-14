"use strict";

const LOW_16 = 0xffff;
const INV_TWO_16 = 1 / 65536;

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * Asymmetric 16x32 limb split using 48-bit exact IEEE-754 floating-point arithmetic
 * with signed 32-bit return (| 0).
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} High 32 bits of the 64-bit product as signed 32-bit int.
 */
function mulhi(a, b) {
	a >>>= 0;
	b >>>= 0;

	const ah = a >>> 16;
	const al = a & LOW_16;

	const pl = al * b;
	const ph = ah * b;

	const pl_hi = (pl * INV_TWO_16) >>> 0;
	return ((ph + pl_hi) * INV_TWO_16) | 0;
}

module.exports = mulhi;
