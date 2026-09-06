'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Oracle
const oracle = require('./candidates/bigint-literal-mask');

// Family 1: limb16-parallel
const limb16_parallel_bitwise_lo = require('./candidates/limb16-parallel-bitwise-lo');
const limb16_parallel_imul_lo = require('./candidates/limb16-parallel-imul-lo');
const limb16_parallel_imul_all = require('./candidates/limb16-parallel-imul-all');
const limb16_parallel_imul_cached = require('./candidates/limb16-parallel-imul-cached');

// Family 2: limb16-pipeline
const limb16_pipeline_bitwise_lo = require('./candidates/limb16-pipeline-bitwise-lo');
const limb16_pipeline_imul_lo = require('./candidates/limb16-pipeline-imul-lo');
const limb16_pipeline_imul_all = require('./candidates/limb16-pipeline-imul-all');
const limb16_pipeline_imul_cached = require('./candidates/limb16-pipeline-imul-cached');
const limb16_imul_import = require('./candidates/limb16-imul-import');

// Family 3: limb16-float48
const limb16_float48_bitwise_lo = require('./candidates/limb16-float48-bitwise-lo');
const limb16_float48_imul_lo = require('./candidates/limb16-float48-imul-lo');

// Family 4: float64
const float64_corrected = require('./candidates/float64-corrected');

// Family 5: bigint variations
const bigint_as_uint32 = require('./candidates/bigint-as-uint32');
const bigint_as_uintn_literal = require('./candidates/bigint-as-uintn-literal');
const bigint_as_uintn_module_const = require('./candidates/bigint-as-uintn-module-const');
const bigint_as_uintn_local_const = require('./candidates/bigint-as-uintn-local-const');
const bigint_as_uint64_imul_lo = require('./candidates/bigint-as-uint64-imul-lo');
const bigint_hi = require('./candidates/bigint-hi');

const candidates = {
  'limb16-parallel-bitwise-lo': limb16_parallel_bitwise_lo,
  'limb16-parallel-imul-lo': limb16_parallel_imul_lo,
  'limb16-parallel-imul-all': limb16_parallel_imul_all,
  'limb16-parallel-imul-cached': limb16_parallel_imul_cached,
  'limb16-pipeline-bitwise-lo': limb16_pipeline_bitwise_lo,
  'limb16-pipeline-imul-lo': limb16_pipeline_imul_lo,
  'limb16-pipeline-imul-all': limb16_pipeline_imul_all,
  'limb16-pipeline-imul-cached': limb16_pipeline_imul_cached,
  'limb16-imul-import': limb16_imul_import,
  'limb16-float48-bitwise-lo': limb16_float48_bitwise_lo,
  'limb16-float48-imul-lo': limb16_float48_imul_lo,
  'float64-corrected': float64_corrected,
  'bigint-as-uint32': bigint_as_uint32,
  'bigint-as-uintn-literal': bigint_as_uintn_literal,
  'bigint-as-uintn-module-const': bigint_as_uintn_module_const,
  'bigint-as-uintn-local-const': bigint_as_uintn_local_const,
  'bigint-as-uint64-imul-lo': bigint_as_uint64_imul_lo,
  'bigint-hi': bigint_hi,
};

test('u32.wmul: edge cases and fuzz testing vs BigInt oracle', () => {
  const edgeCases = [
    [0, 0],
    [1, 1],
    [0xffffffff, 0],
    [0, 0xffffffff],
    [0xffffffff, 1],
    [0xffffffff, 0xffffffff],
    [0x80000000, 0x80000000],
    [0xdeadbeef, 0x8badf00d],
    [0x12345678, 0x9abcdef0],
    [0x55555555, 0xaaaaaaaa],
  ];

  const expected = new Uint32Array(2);
  const actual = new Uint32Array(2);

  for (const [name, fn] of Object.entries(candidates)) {
    // 1. Edge cases
    for (const [a, b] of edgeCases) {
      oracle(a, b, expected);
      fn(a, b, actual);
      assert.deepEqual(
        Array.from(actual),
        Array.from(expected),
        `Candidate ${name} failed on edge case (${a.toString(16)}, ${b.toString(16)})`,
      );
    }

    // 2. Random fuzz testing (100,000 random inputs per candidate)
    for (let i = 0; i < 100000; i++) {
      const a = (Math.random() * 0x100000000) >>> 0;
      const b = (Math.random() * 0x100000000) >>> 0;
      oracle(a, b, expected);
      fn(a, b, actual);
      assert.deepEqual(
        Array.from(actual),
        Array.from(expected),
        `Candidate ${name} failed on random fuzz (${a.toString(16)}, ${b.toString(16)})`,
      );
    }
  }
});
