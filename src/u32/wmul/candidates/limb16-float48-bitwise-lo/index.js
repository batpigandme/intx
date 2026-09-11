"use strict";

const LOW_16 = 0xffff;
const INV_TWO_16 = 1 / 65536;

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * Asymmetric 16x32 limb split using 48-bit exact IEEE-754 floating-point
 * arithmetic with manual bitwise shift/OR assembly for the low word.
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

	const pl = al * b;
	const ph = ah * b;

	const pl_lo = pl & LOW_16;
	const pl_hi = Math.floor(pl * INV_TWO_16);

	const sum_h = ph + pl_hi;
	const mid = sum_h & LOW_16;
	const hi = Math.floor(sum_h * INV_TWO_16) >>> 0;
	const lo = ((mid << 16) | pl_lo) >>> 0;

	out[0] = hi;
	out[1] = lo;
	return out;
}

module.exports = wmul;
