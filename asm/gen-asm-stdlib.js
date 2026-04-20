"use strict";

import umuldw from '@stdlib/number-uint32-base-muldw';

const f = umuldw.assign;

// Typed buffer for storing output from umul32dw kernels
const res = new Uint32Array(2);

// Collect type information on next call
%PrepareFunctionForOptimization(f)

// Call function once to fill type information
f(0xffffffff, 0xffffffff, res, 1, 0);

// Call function again to go from uninitialized -> pre-monomorphic -> monomorphic
f(0xdeadbeef, 0x8badf00d, res, 1, 0);

// Force TurboFan compilation on next call
%OptimizeFunctionOnNextCall(f);
f(0xac1dba5e, 0x5a171337, res, 1, 0);

console.log(res);
