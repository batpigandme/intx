"use strict";

// TODO: compare scalar parameters (ah, al, bh, bl, out) vs array parameters (a, b, out) in microbe showdown

/**
 * 64-bit circular right rotate (branchless).
 *
 * Mathematically: rotr(a, s) === rotl(a, -s & 63).
 * Uses branchless conditional word-swap:
 *   diff = (ah ^ al) & -(s >> 5)
 * and branch-free cross-word bit rotation.
 *
 * Writes high 32 bits into out[0] and low 32 bits into out[1].
 *
 * @param {number} ah - High 32 bits of operand a.
 * @param {number} al - Low 32 bits of operand a.
 * @param {number} s - Rotation count (0..63).
 * @param {Uint32Array|Array<number>} out - Destination buffer [hi, lo].
 * @returns {Uint32Array|Array<number>} Destination buffer out.
 */
function rotr(ah, al, s, out) {
	ah |= 0;
	al |= 0;
	s = -s & 63;

	const k = s & 31;
	const diff = (ah ^ al) & -(s >> 5);
	const x = ah ^ diff;
	const y = al ^ diff;

	const crossY = (y >>> 1) >>> (31 - k);
	const crossX = (x >>> 1) >>> (31 - k);

	out[0] = ((x << k) | crossY) >>> 0;
	out[1] = ((y << k) | crossX) >>> 0;
	return out;
}

module.exports = rotr;
