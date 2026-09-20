"use strict";

// TODO: compare scalar parameters (ah, al, bh, bl, out) vs array parameters (a, b, out) in microbe showdown

/**
 * 64-bit logical left shift (branched).
 *
 * Writes high 32 bits into out[0] and low 32 bits into out[1].
 *
 * @param {number} ah - High 32 bits of operand a.
 * @param {number} al - Low 32 bits of operand a.
 * @param {number} s - Shift count (0..63).
 * @param {Uint32Array|Array<number>} out - Destination buffer [hi, lo].
 * @returns {Uint32Array|Array<number>} Destination buffer out.
 */
function shl(ah, al, s, out) {
	ah |= 0;
	al |= 0;
	s = (s | 0) & 63;

	if (s === 0) {
		out[0] = ah >>> 0;
		out[1] = al >>> 0;
	} else if (s < 32) {
		out[0] = ((ah << s) | (al >>> (32 - s))) >>> 0;
		out[1] = (al << s) >>> 0;
	} else {
		out[0] = (al << (s & 31)) >>> 0;
		out[1] = 0;
	}
	return out;
}

module.exports = shl;
