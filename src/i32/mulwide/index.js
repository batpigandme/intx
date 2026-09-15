"use strict";

const LOW_16 = 0xffff;

/**
 * 32-bit signed integer widening multiplication (32x32 -> 64-bit [hi, lo]).
 * Uses 2-stage pipelined 16-bit unsigned limb decomposition with algebraic signed correction.
 *
 * Mathematical Identity (Hacker's Delight 2nd ed, §8-3: "High-Order Product Signed from/to Unsigned"):
 *   hi_signed = hi_unsigned - ((a < 0) ? b : 0) - ((b < 0) ? a : 0)
 *
 * References:
 *   - Warren, Henry S. (2013). "Hacker's Delight" (2nd ed.), Chapter 8, Section 8-3.
 *   - Knuth, Donald E. (1997). "The Art of Computer Programming", Vol 2 (3rd ed.), Section 4.3.1.
 *
 * Writes signed 32-bit high word into out[0] and low word into out[1].
 *
 * @param {number} a - First 32-bit signed integer operand.
 * @param {number} b - Second 32-bit signed integer operand.
 * @param {Int32Array|Array<number>} out - Destination buffer [hi, lo].
 * @returns {Int32Array|Array<number>} Destination buffer out.
 */
function mulwide(a, b, out) {
	a |= 0;
	b |= 0;

	const ah = a >>> 16;
	const al = a & LOW_16;
	const bh = b >>> 16;
	const bl = b & LOW_16;

	const albl = Math.imul(al, bl) >>> 0;
	const llh = albl >>> 16;

	const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
	const hll = ahbl & LOW_16;
	const hlh = ahbl >>> 16;

	const albh = (Math.imul(al, bh) + hll) >>> 0;
	const lhh = albh >>> 16;

	const lo = Math.imul(a, b) | 0;
	let hi = (Math.imul(ah, bh) + hlh + lhh) | 0;

	// Branch-free signed correction:
	// If a < 0 (a >> 31 === -1), subtract b.
	// If b < 0 (b >> 31 === -1), subtract a.
	hi = (hi - ((a >> 31) & b) - ((b >> 31) & a)) | 0;

	out[0] = hi;
	out[1] = lo;
	return out;
}

module.exports = mulwide;
