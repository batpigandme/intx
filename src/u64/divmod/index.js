"use strict";

const mulhi = require("../../u32/mulhi");

// TODO: compare scalar parameters (ah, al, bh, bl, out) vs array parameters (a, b, out) in microbe showdown

/**
 * 64-bit unsigned integer simultaneous division and modulo (quotient & remainder).
 * Writes:
 *   out[0] = high 32 bits of quotient
 *   out[1] = low 32 bits of quotient
 *   out[2] = high 32 bits of remainder
 *   out[3] = low 32 bits of remainder
 *
 * @param {number} ah - High 32 bits of dividend a.
 * @param {number} al - Low 32 bits of dividend a.
 * @param {number} bh - High 32 bits of divisor b.
 * @param {number} bl - Low 32 bits of divisor b.
 * @param {Uint32Array|Array<number>} out - Destination buffer of length >= 4 [qh, ql, rh, rl].
 * @returns {Uint32Array|Array<number>} Destination buffer out.
 */
function divmod(ah, al, bh, bl, out) {
	ah >>>= 0;
	al >>>= 0;
	bh >>>= 0;
	bl >>>= 0;

	// Case 0: Divisor is 0
	if ((bh | bl) === 0) {
		throw new RangeError("Division by zero");
	}

	// Case 1: a < b
	if (ah < bh || (ah === bh && al < bl)) {
		out[0] = 0;
		out[1] = 0;
		out[2] = ah;
		out[3] = al;
		return out;
	}

	// Case 2: a == b
	if (ah === bh && al === bl) {
		out[0] = 0;
		out[1] = 1;
		out[2] = 0;
		out[3] = 0;
		return out;
	}

	// Case 3: bh === 0 (32-bit divisor)
	if (bh === 0) {
		let qh = 0;
		let rem = ah;
		if (ah >= bl) {
			qh = Math.floor(ah / bl) >>> 0;
			rem = (ah - Math.imul(qh, bl)) >>> 0;
		}

		const al_h = al >>> 16;
		const al_l = al & 0xffff;

		const d1 = rem * 65536 + al_h;
		const q1 = Math.floor(d1 / bl);
		const r1 = d1 - q1 * bl;

		const d0 = r1 * 65536 + al_l;
		const q0 = Math.floor(d0 / bl);
		const r0 = d0 - q0 * bl;

		out[0] = qh;
		out[1] = ((q1 << 16) | q0) >>> 0;
		out[2] = 0;
		out[3] = r0 >>> 0;
		return out;
	}

	// Case 4: bh > 0 (Divisor >= 2^32, quotient fits in 32 bits, qh = 0)
	const s = Math.clz32(bh);
	let qHat;

	if (s === 0) {
		qHat = ah < bh ? 0 : 1;
	} else {
		const b1 = ((bh << s) | (bl >>> (32 - s))) >>> 0;
		const a2 = ah >>> (32 - s);
		const a1 = ((ah << s) | (al >>> (32 - s))) >>> 0;

		if (a2 >= b1) {
			qHat = 0xffffffff;
		} else {
			const a1_h = a1 >>> 16;
			const a1_l = a1 & 0xffff;

			const d1 = a2 * 65536 + a1_h;
			const q1 = Math.floor(d1 / b1);
			const r1 = d1 - q1 * b1;

			const d0 = r1 * 65536 + a1_l;
			const q0 = Math.floor(d0 / b1);

			qHat = ((q1 << 16) | q0) >>> 0;
		}
	}

	// Verify and correct qHat in 64-bit space (at most 2 corrections)
	while (true) {
		const prod_lo = Math.imul(qHat, bl) >>> 0;
		const prod_mid = mulhi(qHat, bl);
		const prod_hi_lo = Math.imul(qHat, bh) >>> 0;
		const prod_hi_carry = mulhi(qHat, bh);

		const mid_sum = (prod_mid + prod_hi_lo) >>> 0;
		const carry = (mid_sum < prod_mid ? 1 : 0) + prod_hi_carry;
		const prod_hi = mid_sum;

		if (carry > 0 || prod_hi > ah || (prod_hi === ah && prod_lo > al)) {
			qHat = (qHat - 1) >>> 0;
		} else {
			const rem_lo = (al - prod_lo) | 0;
			const borrow = ((~al & prod_lo) | ((~al | prod_lo) & rem_lo)) >>> 31;
			const rem_hi = (((ah - prod_hi) | 0) - borrow) | 0;

			out[0] = 0;
			out[1] = qHat;
			out[2] = rem_hi >>> 0;
			out[3] = rem_lo >>> 0;
			return out;
		}
	}
}

module.exports = divmod;
