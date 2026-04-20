"use strict";

import f16x1 from '#src/umul32dw/split16x1.js';
import f16x1c from '#src/umul32dw/split16x1c.js';
import f16x1i from '#src/umul32dw/split16x1imul.js';
import f16x1ic from '#src/umul32dw/split16x1imulc.js';
import f16x2 from '#src/umul32dw/split16x2.js';
import f16x2c from '#src/umul32dw/split16x2c.js';
import f16x2i from '#src/umul32dw/split16x2imul.js';
import f16x2ic from '#src/umul32dw/split16x2imulc.js';
import f16x2ai from '#src/umul32dw/split16x2allimul.js';
import f16x2aic from '#src/umul32dw/split16x2allimulc.js';
import f16x2ais from '#src/umul32dw/split16x2ais.js';

import process from "node:process";

const name = process.argv[2];

const funcs = {
  '16x1': f16x1,
  '16x1c': f16x1c,
  '16x1i': f16x1i,
  '16x1ic': f16x1ic,
  '16x2': f16x2,
  '16x2c': f16x2c,
  '16x2i': f16x2i,
  '16x2ic': f16x2ic,
  '16x2ai': f16x2ai,
  '16x2aic': f16x2aic,
  '16x2ais': f16x2ais,
}

if (name in funcs) {
  optimize(funcs[name]);
}
else {
  console.log('Specify a function name among these: ' + Object.keys(funcs).join(', '));
}

function optimize(f) {
  // Typed buffer for storing output from umul32dw kernels
  const res = new Uint32Array(2);

  // Collect type information on next call
  % PrepareFunctionForOptimization(f)

  // Call function once to fill type information
  f(0xffffffff, 0xffffffff, res);

  // Call function again to go from uninitialized -> pre-monomorphic -> monomorphic
  f(0xdeadbeef, 0x8badf00d, res);

  // Force TurboFan compilation on next call
  % OptimizeFunctionOnNextCall(f);
  f(0xac1dba5e, 0x5a171337, res);

  console.log(res);
}