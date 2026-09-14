# `limb16-pipeline-imul-import`

## Overview
`limb16-pipeline-imul-import` is a variation of the 2-stage pipelined 16-bit limb multiplication algorithm (`limb16-pipeline-imul-all`) where every multiplication is dispatched through a user-defined helper function `mul(a, b)` imported from `src/u32/mul` (`Math.imul(a, b) >>> 0`).

## Motivation & Hypothesis
- **Question**: Does delegating low 32-bit multiplication to a user-defined module function introduce call-frame overhead, prevent cross-function inlining, or lower to the exact same TurboFan IR graph as native `Math.imul`?
- **Hypothesis**: In TurboFan's inlining phase (`Inliner`), small monomorphic JavaScript functions with a single return statement are candidates for aggressive inlining. However, whether module-boundary indirection or extra call-site feedback vectors affect warmup latency or register allocation in practice can be measured directly against `limb16-pipeline-imul-all`.

## Implementation
```javascript
'use strict';

const mul = require('../../../mul');

const LOW_16 = 0xffff;

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
```
