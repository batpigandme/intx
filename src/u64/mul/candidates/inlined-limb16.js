"use strict";

const { LOW_16 } = require("../../../const");

// TODO: compare scalar parameters (ah, al, bh, bl, out) vs array parameters (a, b, out) in microbe showdown

/**
 * 64-bit unsigned integer multiplication (64x64 -> 64-bit low word).
 * Candidate: Inlines 2-stage pipelined 16-bit limb decomposition directly
 * into the kernel to avoid any sub-call boundary overhead.
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

	const all = al & LOW_16;
	const alh = al >>> 16;
	const bll = bl & LOW_16;
	const blh = bl >>> 16;

	const albl = Math.imul(all, bll) >>> 0;
	const llh = albl >>> 16;

	const ahbl = (Math.imul(alh, bll) + llh) >>> 0;
	const hll = ahbl & LOW_16;
	const hlh = ahbl >>> 16;

	const albh = (Math.imul(all, blh) + hll) >>> 0;
	const lhh = albh >>> 16;

	const lo = Math.imul(al, bl) | 0;
	const carry = (Math.imul(alh, blh) + hlh + lhh) | 0;
	const hi = (((carry + Math.imul(ah, bl)) | 0) + Math.imul(al, bh)) | 0;

	out[0] = hi >>> 0;
	out[1] = lo >>> 0;
	return out;
}

module.exports = mul;
