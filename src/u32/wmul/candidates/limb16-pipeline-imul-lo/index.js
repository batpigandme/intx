"use strict";

const LOW_16 = 0xffff;

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * 2-stage pipelined 16-bit limb split using standard multiplication (*) for carries,
 * and Math.imul(a, b) for exact 1-cycle low-word computation.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @param {Array|Uint32Array} out - Destination buffer [hi, lo].
 * @returns {Array|Uint32Array} Destination buffer out.
 */
function wmul(a, b, out) {
	a >>>= 0;
	b >>>= 0;

	const ah = a >>> 16;
	const al = a & LOW_16;
	const bh = b >>> 16;
	const bl = b & LOW_16;

	const k1 = (al * bl) >>> 16;
	const t1 = (ah * bl + k1) >>> 0;
	const w1 = t1 >>> 16;
	const w2 = t1 & LOW_16;

	const k2 = (al * bh + w2) >>> 16;

	out[0] = (ah * bh + w1 + k2) >>> 0;
	out[1] = Math.imul(a, b) >>> 0;
	return out;
}

module.exports = wmul;
