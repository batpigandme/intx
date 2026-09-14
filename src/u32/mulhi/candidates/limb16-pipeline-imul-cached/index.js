"use strict";

const imul = Math.imul;
const LOW_16 = 0xffff;

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * 2-stage pipelined 16-bit limb split using cached Math.imul reference.
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
	const llh = albl >>> 16;

	const ahbl = (imul(ah, bl) + llh) >>> 0;
	const hll = ahbl & LOW_16;
	const hlh = ahbl >>> 16;

	const albh = (imul(al, bh) + hll) >>> 0;
	const lhh = albh >>> 16;

	return (imul(ah, bh) + hlh + lhh) >>> 0;
}

module.exports = mulhi;
