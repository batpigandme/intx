"use strict";

const LOW_16 = 0xffff;

// 64-bit result of multiplying two 32-bit uint
// Using Math.imul for every multiplication in the split16x2 flow
export default function umul32dw(a, b, out) {
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & LOW_16;
  const bh = b >>> 16;
  const bl = b & LOW_16;

  const albl = Math.imul(al, bl) >>> 0;
  const llh = albl >>> 16;

  const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
  const hll = ahbl & LOW_16;
  const hlh = ahbl >>> 16;

  const albh = (Math.imul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  const lo = Math.imul(a, b) >>> 0;
  const hi = (Math.imul(ah, bh) + hlh + lhh) >>> 0;

  out[0] = hi;
  out[1] = lo;
}
