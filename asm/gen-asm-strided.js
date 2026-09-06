"use strict";

import f from '#src/umul32dw/strided/split16x2imulc.js';

// Typed buffer for storing output from umul32dw kernels
// const res = new Uint32Array(2);
const res = [0, 0];

// Collect type information on next call
% PrepareFunctionForOptimization(f)

// Call function once to fill type information
f(0xffffffff, 0xffffffff, res, 1, 0);

// Call function again to go from uninitialized -> pre-monomorphic -> monomorphic
f(0xdeadbeef, 0x8badf00d, res, 1, 0);

// Force TurboFan compilation on next call
% OptimizeFunctionOnNextCall(f);
f(0xac1dba5e, 0x5a171337, res, 1, 0);

console.log(res);
