'use strict';

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * BigInt implementation using BigInt.asUintN(32, prod) for the low word
 * instead of allocating a temporary bitwise mask heap object.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @param {Array|Uint32Array} out - Destination buffer [hi, lo].
 * @returns {Array|Uint32Array} Destination buffer out.
 */
function wmul(a, b, out) {
  const prod = BigInt(a >>> 0) * BigInt(b >>> 0);
  out[0] = Number(prod >> 32n) >>> 0;
  out[1] = Number(BigInt.asUintN(32, prod));
  return out;
}

module.exports = wmul;
