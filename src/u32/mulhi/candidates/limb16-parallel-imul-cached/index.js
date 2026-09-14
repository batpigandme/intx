"use strict";

const imul = Math.imul;
const LOW_16 = 0xffff;

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * Parallel 4-way 16-bit limb split using cached Math.imul reference.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} High 32 bits of the 64-bit product (a * b) >>> 32.
 */
function mulhi(a, b) {
	a >>>= 0;
	b >>>= 0;

	const ah = a >>> 16;
	const al = a & LOW_16;
	const bh = b >>> 16;
	const bl = b & LOW_16;

	const albl = imul(al, bl) >>> 0;
	const ahbl = imul(ah, bl) >>> 0;
	const albh = imul(al, bh) >>> 0;
	const ahbh = imul(ah, bh) >>> 0;

	const mid = (ahbl + (albl >>> 16)) >>> 0;
	const mid2 = (albh + (mid & LOW_16)) >>> 0;

	return (ahbh + (mid >>> 16) + (mid2 >>> 16)) >>> 0;
}

module.exports = mulhi;
