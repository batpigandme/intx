"use strict";

const mulwide = require("../../../u32/mulwide");

// TODO: compare scalar parameters (ah, al, bh, bl, out) vs array parameters (a, b, out) in microbe showdown

/**
 * 64-bit unsigned integer multiplication (64x64 -> 64-bit low word).
 * Candidate: Reuses u32.mulwide for the 32x32 low product (5 Math.imul ops)
 * and accumulates the two 32-bit cross-products (2 Math.imul ops).
 * Total: exactly 7 Math.imul operations.
 *
 * Writes high 32 bits into out[0] and low 32 bits into out[1].
 *
 * @param {number} ah - High 32 bits of operand a.
 * @param {number} al - Low 32 bits of operand a.
 * @param {number} bh - High 32 bits of operand b.
 * @param {number} bl - Low 32 bits of operand b.
 * @param {Uint32Array|Array<number>} out - Destination buffer [hi, lo].
 * @returns {Uint32Array|Array<number>} Destination buffer out.
 */
function mul(ah, al, bh, bl, out) {
	ah |= 0;
	al |= 0;
	bh |= 0;
	bl |= 0;

	mulwide(al, bl, out);
	out[0] = ((out[0] + Math.imul(ah, bl) + Math.imul(al, bh)) | 0) >>> 0;
	return out;
}

module.exports = mul;
