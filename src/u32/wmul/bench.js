'use strict';

const bench = require('../../../bench/lib.js');

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

// Family 3: limb16-float48
const limb16_float48_bitwise_lo = require('./candidates/limb16-float48-bitwise-lo');
const limb16_float48_imul_lo = require('./candidates/limb16-float48-imul-lo');

// Family 4: float64
const float64_corrected = require('./candidates/float64-corrected');

// Baseline stdlib
const stdlibCJS = require('@stdlib/muldw-cjs');

const fstdlib = stdlibCJS.assign;
const ITERS = 1e8;

console.log(
  '\n================================================================',
);
console.log(` u32.wmul: Candidate Benchmarks (Node ${process.version})`);
console.log('================================================================');

bench(limb16_pipeline_imul_all, 'limb16-pipeline-imul-all', ITERS);
bench(limb16_pipeline_imul_lo, 'limb16-pipeline-imul-lo', ITERS);
bench(limb16_pipeline_imul_cached, 'limb16-pipeline-imul-cached', ITERS);
bench(limb16_pipeline_bitwise_lo, 'limb16-pipeline-bitwise-lo', ITERS);

bench(limb16_parallel_imul_all, 'limb16-parallel-imul-all', ITERS);
bench(limb16_parallel_imul_lo, 'limb16-parallel-imul-lo', ITERS);
bench(limb16_parallel_imul_cached, 'limb16-parallel-imul-cached', ITERS);
bench(limb16_parallel_bitwise_lo, 'limb16-parallel-bitwise-lo', ITERS);

bench(limb16_float48_imul_lo, 'limb16-float48-imul-lo', ITERS);
bench(limb16_float48_bitwise_lo, 'limb16-float48-bitwise-lo', ITERS);

bench(float64_corrected, 'float64-corrected', ITERS);
bench(fstdlib, 'stdlib/umuldw.assign', ITERS, true);
