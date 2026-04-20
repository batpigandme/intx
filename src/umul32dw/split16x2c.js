"use strict";

const LOW_16 = 0xffff;

// 64-bit result of multiplying two 32-bit uint
export default function umul32dw(a, b, out) {
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & LOW_16;
  const bh = b >>> 16;
  const bl = b & LOW_16;

  const albl = (al * bl) >>> 0;
  const lll = albl & LOW_16;
  const llh = albl >>> 16;

  const ahbl = (ah * bl + llh) >>> 0;
  const hll = ahbl & LOW_16;
  const hlh = ahbl >>> 16;

  const albh = (al * bh + hll) >>> 0;
  const lhl = albh & LOW_16;
  const lhh = albh >>> 16;

  const lo = (lll | lhl << 16) >>> 0;
  const hi = (ah * bh + hlh + lhh) >>> 0;

  out[0] = hi;
  out[1] = lo;
}