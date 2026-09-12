"use strict";

const mul = require("../../../mul");

const LOW_16 = 0xffff;

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * 2-stage pipelined 16-bit limb split using user-defined mul imported from src/u32/mul.
 * Evaluates the impact of function call overhead and cross-module function inlining in V8.
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

	const albl = mul(al, bl);
	const llh = albl >>> 16;

	const ahbl = (mul(ah, bl) + llh) >>> 0;
	const hll = ahbl & LOW_16;
	const hlh = ahbl >>> 16;

	const albh = (mul(al, bh) + hll) >>> 0;
	const lhh = albh >>> 16;

	const lo = mul(a, b);
	const hi = (mul(ah, bh) + hlh + lhh) >>> 0;

	out[0] = hi;
	out[1] = lo;
	return out;
}

module.exports = wmul;
