"use strict";

const LOW_16 = 0xffff;

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * 2-stage pipelined 16-bit limb split using direct Math.imul for ALL multiplications
 * and signed 32-bit integer (| 0) casts.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @param {Array|Uint32Array} out - Destination buffer [hi, lo].
 * @returns {Array|Uint32Array} Destination buffer out.
 */
function wmul(a, b, out) {
	a |= 0;
	b |= 0;

	const ah = a >>> 16;
	const al = a & LOW_16;
	const bh = b >>> 16;
	const bl = b & LOW_16;

	const albl = Math.imul(al, bl) | 0;
	const llh = albl >>> 16;

	const ahbl = (Math.imul(ah, bl) + llh) | 0;
	const hll = ahbl & LOW_16;
	const hlh = ahbl >>> 16;

	const albh = (Math.imul(al, bh) + hll) | 0;
	const lhh = albh >>> 16;

	const lo = Math.imul(a, b) | 0;
	const hi = (Math.imul(ah, bh) + hlh + lhh) | 0;

	out[0] = hi;
	out[1] = lo;
	return out;
}

module.exports = wmul;
