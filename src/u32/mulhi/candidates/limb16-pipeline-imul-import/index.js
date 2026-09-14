"use strict";

const mul = require("../../../mul");

const LOW_16 = 0xffff;

/**
 * 32-bit unsigned integer high multiplication (32x32 -> 32-bit high word).
 * 2-stage pipelined 16-bit limb split using user-defined mul imported from src/u32/mul.
 * Evaluates the impact of function call overhead and cross-module function inlining in V8.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @returns {number} High 32 bits of the 64-bit product (a * b) >>> 32.
 */
function mulhi(a, b) {
	a >>>= 0;
	b >>>= 0;

	const ah = a >>> 16;
	const al = a & LOW_16;
	const bh = b >>> 16;
	const bl = b & LOW_16;

	const albl = mul(al, bl);
	const llh = albl >>> 16;

	const ahbl = (mul(ah, bl) + llh) >>> 0;
	const hll = ahbl & LOW_16;
	const hlh = ahbl >>> 16;

	const albh = (mul(al, bh) + hll) >>> 0;
	const lhh = albh >>> 16;

	return (mul(ah, bh) + hlh + lhh) >>> 0;
}

module.exports = mulhi;
