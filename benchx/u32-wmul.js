'use strict';

const { BenchXSuite } = require('./lib.js');

// Family 1: limb16-parallel
const limb16_parallel_bitwise_lo = require('../src/u32/wmul/candidates/limb16-parallel-bitwise-lo');
const limb16_parallel_imul_lo = require('../src/u32/wmul/candidates/limb16-parallel-imul-lo');
const limb16_parallel_imul_all = require('../src/u32/wmul/candidates/limb16-parallel-imul-all');
const limb16_parallel_imul_cached = require('../src/u32/wmul/candidates/limb16-parallel-imul-cached');

// Family 2: limb16-pipeline
const limb16_pipeline_bitwise_lo = require('../src/u32/wmul/candidates/limb16-pipeline-bitwise-lo');
const limb16_pipeline_imul_lo = require('../src/u32/wmul/candidates/limb16-pipeline-imul-lo');
const limb16_pipeline_imul_all = require('../src/u32/wmul/candidates/limb16-pipeline-imul-all');
const limb16_pipeline_imul_cached = require('../src/u32/wmul/candidates/limb16-pipeline-imul-cached');
const limb16_imul_import = require('../src/u32/wmul/candidates/limb16-imul-import');

// Family 3: limb16-float48
const limb16_float48_bitwise_lo = require('../src/u32/wmul/candidates/limb16-float48-bitwise-lo');
const limb16_float48_imul_lo = require('../src/u32/wmul/candidates/limb16-float48-imul-lo');

// Family 4: float64
const float64_corrected = require('../src/u32/wmul/candidates/float64-corrected');

// Family 5: bigint variations
const bigint_literal_mask = require('../src/u32/wmul/candidates/bigint-literal-mask');
const bigint_as_uint32 = require('../src/u32/wmul/candidates/bigint-as-uint32');
const bigint_as_uintn_literal = require('../src/u32/wmul/candidates/bigint-as-uintn-literal');
const bigint_as_uintn_module_const = require('../src/u32/wmul/candidates/bigint-as-uintn-module-const');
const bigint_as_uintn_local_const = require('../src/u32/wmul/candidates/bigint-as-uintn-local-const');
const bigint_as_uint64_imul_lo = require('../src/u32/wmul/candidates/bigint-as-uint64-imul-lo');
const bigint_hi = require('../src/u32/wmul/candidates/bigint-hi');

const stdlibCJS = require('@stdlib/muldw-cjs');

const suite = new BenchXSuite({
  name: 'u32.wmul: Grand Candidate Evaluation',
  rounds: 5,
  iters: 5e7,
  warmup: 5e6,
});

suite
  // Family 1: Parallel
  .add('limb16-parallel-bitwise-lo', limb16_parallel_bitwise_lo)
  .add('limb16-parallel-imul-lo', limb16_parallel_imul_lo)
  .add('limb16-parallel-imul-all', limb16_parallel_imul_all)
  .add('limb16-parallel-imul-cached', limb16_parallel_imul_cached)
  // Family 2: Pipelined
  .add('limb16-pipeline-bitwise-lo', limb16_pipeline_bitwise_lo)
  .add('limb16-pipeline-imul-lo', limb16_pipeline_imul_lo)
  .add('limb16-pipeline-imul-all', limb16_pipeline_imul_all)
  .add('limb16-pipeline-imul-cached', limb16_pipeline_imul_cached)
  .add('limb16-imul-import', limb16_imul_import)
  // Family 3: Float48
  .add('limb16-float48-bitwise-lo', limb16_float48_bitwise_lo)
  .add('limb16-float48-imul-lo', limb16_float48_imul_lo)
  // Family 4: Float64
  .add('float64-corrected', float64_corrected)
  // Baseline stdlib
  .add('stdlib/umuldw.assign', stdlibCJS.assign, { isStrided: true })
  // Family 5: BigInt variations
  .add('bigint-literal-mask', bigint_literal_mask, { iters: 5e6 })
  .add('bigint-as-uint32', bigint_as_uint32, { iters: 5e6 })
  .add('bigint-as-uintn-literal', bigint_as_uintn_literal, { iters: 5e6 })
  .add('bigint-as-uintn-module-const', bigint_as_uintn_module_const, {
    iters: 5e6,
  })
  .add('bigint-as-uintn-local-const', bigint_as_uintn_local_const, {
    iters: 5e6,
  })
  .add('bigint-as-uint64-imul-lo', bigint_as_uint64_imul_lo, { iters: 5e6 })
  .add('bigint-hi', bigint_hi, { iters: 5e6 });

suite.run();
