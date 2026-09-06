'use strict';

const f = require('../src/u32/wmul/candidates/limb16-pipeline-imul-all');

const res = new Uint32Array(2);

// Collect type information on next call
%PrepareFunctionForOptimization(f);

// Call function once to fill type information
f(0xffffffff, 0xffffffff, res);

// Call function again to go from uninitialized -> pre-monomorphic -> monomorphic
f(0xdeadbeef, 0x8badf00d, res);

// Force TurboFan compilation on next call
%OptimizeFunctionOnNextCall(f);
f(0xac1dba5e, 0x5a171337, res);

console.log(
  `Optimized result: [0x${res[0].toString(16)}, 0x${res[1].toString(16)}]`,
);
