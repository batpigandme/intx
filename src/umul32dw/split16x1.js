"use strict";

import { LOW_16, TWO_16 } from "./constants.js";

// 64-bit result of multiplying two 32-bit uint
export default function umul32dw(a, b, out) {
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & LOW_16;

  const ahb = ah * b;
  const alb = al * b;

  const lo = (((ahb & LOW_16) << 16) + (alb >>> 0)) >>> 0;
  const hi = ((ahb + ((alb / TWO_16) >>> 0)) / TWO_16) >>> 0;

  out[0] = hi;
  out[1] = lo;
}