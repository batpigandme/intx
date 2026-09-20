"use strict";

// TODO: compare scalar parameters (ah, al, bh, bl, out) vs array parameters (a, b, out) in microbe showdown

/**
 * 64-bit logical right shift (branchless).
 *
 * Uses bitwise mask multiplexing and cross-shift:
 *   s32 = (s - 32) >> 31 (-1 if s < 32, 0 if s >= 32)
 *   cross = (ah << 1) << (31 - k)
 *
 * Constant-folds at JIT compile-time under fixed/loop-invariant shift amounts.
 * Writes high 32 bits into out[0] and low 32 bits into out[1].
 *
 * @param {number} ah - High 32 bits of operand a.
 * @param {number} al - Low 32 bits of operand a.
 * @param {number} s - Shift count (0..63).
 * @param {Uint32Array|Array<number>} out - Destination buffer [hi, lo].
 * @returns {Uint32Array|Array<number>} Destination buffer out.
 */
function shr(ah, al, s, out) {
	ah |= 0;
	al |= 0;
	s = (s | 0) & 63;

	const k = s & 31;
	const s32 = (s - 32) >> 31;
	const ahk = ah >>> k;
	const cross = (ah << 1) << (31 - k);
	const part = (al >>> k) | cross;

	out[0] = (ahk & s32) >>> 0;
	out[1] = ((part & s32) | (ahk & ~s32)) >>> 0;
	return out;
}

module.exports = shr;
