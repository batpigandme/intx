'use strict';

const INV_TWO_32 = 1 / 4294967296;

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * Double-precision float product with Math.imul exact low-word and residual correction.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @param {Array|Uint32Array} out - Destination buffer [hi, lo].
 * @returns {Array|Uint32Array} Destination buffer out.
 */
function wmul(a, b, out) {
  a >>>= 0;
  b >>>= 0;

  const lo = Math.imul(a, b) >>> 0;
  const hi = ((a * b - lo) * INV_TWO_32 + 0.5) >>> 0;

  out[0] = hi;
  out[1] = lo;
  return out;
}

module.exports = wmul;
