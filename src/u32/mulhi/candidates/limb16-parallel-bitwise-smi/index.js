"use strict";

const LOW_16 = 0xffff;

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * Parallel 4-way 16-bit limb split using standard multiplication (*) with signed return (| 0).
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
	const bh = b >>> 16;
	const bl = b & LOW_16;

	const albl = (al * bl) >>> 0;
	const ahbl = (ah * bl) >>> 0;
	const albh = (al * bh) >>> 0;
	const ahbh = (ah * bh) >>> 0;

	const mid = (ahbl + (albl >>> 16)) >>> 0;
	const mid2 = (albh + (mid & LOW_16)) >>> 0;

	return (ahbh + (mid >>> 16) + (mid2 >>> 16)) | 0;
}

module.exports = mulhi;
