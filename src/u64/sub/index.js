"use strict";

// TODO: compare scalar parameters (ah, al, bh, bl, out) vs array parameters (a, b, out) in microbe showdown

/**
 * 64-bit unsigned integer subtraction: (a - b) mod 2^64.
 * Writes high 32 bits into out[0] and low 32 bits into out[1].
 *
 * Uses branchless borrow-out bit extraction:
 *   borrow = ((~al & bl) | ((~al | bl) & lo)) >>> 31
 *
 * @param {number} ah - High 32 bits of operand a.
 * @param {number} al - Low 32 bits of operand a.
 * @param {number} bh - High 32 bits of operand b.
 * @param {number} bl - Low 32 bits of operand b.
 * @param {Uint32Array|Array<number>} out - Destination buffer [hi, lo].
 * @returns {Uint32Array|Array<number>} Destination buffer out.
 */
function sub(ah, al, bh, bl, out) {
	ah |= 0;
	al |= 0;
	bh |= 0;
	bl |= 0;

	const lo = (al - bl) | 0;
	const borrow = ((~al & bl) | ((~al | bl) & lo)) >>> 31;
	const hi = (((ah - bh) | 0) - borrow) | 0;

	out[0] = hi >>> 0;
	out[1] = lo >>> 0;
	return out;
}

module.exports = sub;
