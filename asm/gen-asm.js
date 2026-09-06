'use strict';

const process = require('node:process');

// 1. Literal constants variant
function pipe_imul_all_literal(a, b, out) {
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & 0xffff;
  const bh = b >>> 16;
  const bl = b & 0xffff;

  const albl = Math.imul(al, bl) >>> 0;
  const llh = albl >>> 16;

  const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
  const hll = ahbl & 0xffff;
  const hlh = ahbl >>> 16;

  const albh = (Math.imul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}

// 2. Module-scoped constant variant
const MODULE_LOW_16 = 0xffff;
function pipe_imul_all_module_const(a, b, out) {
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & MODULE_LOW_16;
  const bh = b >>> 16;
  const bl = b & MODULE_LOW_16;

  const albl = Math.imul(al, bl) >>> 0;
  const llh = albl >>> 16;

  const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
  const hll = ahbl & MODULE_LOW_16;
  const hlh = ahbl >>> 16;

  const albh = (Math.imul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}

// 3. Local-scoped constant variant
function pipe_imul_all_local_const(a, b, out) {
  a >>>= 0;
  b >>>= 0;
  const LOCAL_LOW_16 = 0xffff;

  const ah = a >>> 16;
  const al = a & LOCAL_LOW_16;
  const bh = b >>> 16;
  const bl = b & LOCAL_LOW_16;

  const albl = Math.imul(al, bl) >>> 0;
  const llh = albl >>> 16;

  const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
  const hll = ahbl & LOCAL_LOW_16;
  const hlh = ahbl >>> 16;

  const albh = (Math.imul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}

// 4. Cached Math.imul variant
const imul = Math.imul;
function pipe_imul_all_cached(a, b, out) {
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & 0xffff;
  const bh = b >>> 16;
  const bl = b & 0xffff;

  const albl = imul(al, bl) >>> 0;
  const llh = albl >>> 16;

  const ahbl = (imul(ah, bl) + llh) >>> 0;
  const hll = ahbl & 0xffff;
  const hlh = ahbl >>> 16;

  const albh = (imul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (imul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = imul(a, b) >>> 0;
  return out;
}

// 5. Imported helper variant
const mul = require('../src/u32/mul');
function pipe_imul_all_import(a, b, out) {
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & 0xffff;
  const bh = b >>> 16;
  const bl = b & 0xffff;

  const albl = mul(al, bl);
  const llh = albl >>> 16;

  const ahbl = (mul(ah, bl) + llh) >>> 0;
  const hll = ahbl & 0xffff;
  const hlh = ahbl >>> 16;

  const albh = (mul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (mul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = mul(a, b);
  return out;
}

// Candidates map
const funcs = {
  'literal': pipe_imul_all_literal,
  'module-const': pipe_imul_all_module_const,
  'local-const': pipe_imul_all_local_const,
  'cached': pipe_imul_all_cached,
  'import': pipe_imul_all_import,
  'winner': require('../src/u32/wmul/candidates/limb16-pipeline-imul-all'),
  'float64': require('../src/u32/wmul/candidates/float64-corrected'),
  'parallel': require('../src/u32/wmul/candidates/limb16-parallel-imul-all'),
};

const name = process.argv[2];

if (name && name in funcs) {
  optimize(funcs[name]);
} else {
  console.log(
    `Specify a function name among: ${Object.keys(funcs).join(', ')}`,
  );
}

function optimize(f) {
  const res = new Uint32Array(2);

  %PrepareFunctionForOptimization(f);
  f(0xffffffff, 0xffffffff, res);
  f(0xdeadbeef, 0x8badf00d, res);

  %OptimizeFunctionOnNextCall(f);
  f(0xac1dba5e, 0x5a171337, res);

  console.log(`Optimized execution result: [0x${res[0].toString(16)}, 0x${res[1].toString(16)}]`);
}