'use strict';

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * Direct inline BigInt high-word extraction with asUintN(32) truncation:
 * Number(BigInt.asUintN(32, BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0)) >> 32n))
 * combined with Math.imul(a, b) for the low word.
 *
 * @param {number} a - First 32-bit unsigned integer operand.
 * @param {number} b - Second 32-bit unsigned integer operand.
 * @param {Array|Uint32Array} out - Destination buffer [hi, lo].
 * @returns {Array|Uint32Array} Destination buffer out.
 */
function wmul(a, b, out) {
  out[0] =
    Number(
      BigInt.asUintN(
        32,
        BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0)) >> 32n,
      ),
    ) >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}

module.exports = wmul;
