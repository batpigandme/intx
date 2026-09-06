'use strict';

const { BenchXSuite } = require('../benchx/lib.js');
const mul = require('../src/u32/mul');

const LOW_16_MODULE = 0xffff;

// 1. Literal constants
function pipe_literal(a, b, out) {
  a >>>= 0;
  b >>>= 0;
  const ah = a >>> 16,
    al = a & 0xffff;
  const bh = b >>> 16,
    bl = b & 0xffff;

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

// 2. Module constant
function pipe_module_const(a, b, out) {
  a >>>= 0;
  b >>>= 0;
  const ah = a >>> 16,
    al = a & LOW_16_MODULE;
  const bh = b >>> 16,
    bl = b & LOW_16_MODULE;

  const albl = Math.imul(al, bl) >>> 0;
  const llh = albl >>> 16;
  const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
  const hll = ahbl & LOW_16_MODULE;
  const hlh = ahbl >>> 16;
  const albh = (Math.imul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}

// 3. Local constant
function pipe_local_const(a, b, out) {
  a >>>= 0;
  b >>>= 0;
  const LOW_16_LOCAL = 0xffff;
  const ah = a >>> 16,
    al = a & LOW_16_LOCAL;
  const bh = b >>> 16,
    bl = b & LOW_16_LOCAL;

  const albl = Math.imul(al, bl) >>> 0;
  const llh = albl >>> 16;
  const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
  const hll = ahbl & LOW_16_LOCAL;
  const hlh = ahbl >>> 16;
  const albh = (Math.imul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}

// 4. Cached Math.imul
const imul = Math.imul;
function pipe_cached_imul(a, b, out) {
  a >>>= 0;
  b >>>= 0;
  const ah = a >>> 16,
    al = a & 0xffff;
  const bh = b >>> 16,
    bl = b & 0xffff;

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

// 5. Imported mul wrapper
function pipe_imported_mul(a, b, out) {
  a >>>= 0;
  b >>>= 0;
  const ah = a >>> 16,
    al = a & 0xffff;
  const bh = b >>> 16,
    bl = b & 0xffff;

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

const suite = new BenchXSuite({
  name: 'Constant Inlining Analysis: limb16-pipeline Variants',
  rounds: 5,
  iters: 5e7,
  warmup: 5e6,
});

suite
  .add('pipe-literal', pipe_literal)
  .add('pipe-module-const', pipe_module_const)
  .add('pipe-local-const', pipe_local_const)
  .add('pipe-cached-imul', pipe_cached_imul)
  .add('pipe-imported-mul', pipe_imported_mul);

suite.run();
