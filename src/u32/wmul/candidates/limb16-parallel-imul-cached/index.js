'use strict';

const LOW_16 = 0xffff;
const imul = Math.imul;

/**
 * 32-bit unsigned integer wide multiplication (32x32 -> 64-bit [hi, lo])
 * Parallel 4-way 16-bit limb split using a cached file-level closure variable
 * `const imul = Math.imul` for all 5 multiplications.
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

  const albl = imul(al, bl) >>> 0;
  const ahbl = imul(ah, bl) >>> 0;
  const albh = imul(al, bh) >>> 0;
  const ahbh = imul(ah, bh) >>> 0;

  const mid = (ahbl + (albl >>> 16)) >>> 0;
  const mid2 = (albh + (mid & LOW_16)) >>> 0;

  out[0] = (ahbh + (mid >>> 16) + (mid2 >>> 16)) >>> 0;
  out[1] = imul(a, b) >>> 0;
  return out;
}

module.exports = wmul;
