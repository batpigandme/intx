"use strict";

const { bench, createRunner } = require("#microbe");

// Family 1: limb16-parallel
const limb16_parallel_bitwise_lo = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-parallel-bitwise-lo");
const limb16_parallel_imul_lo = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-parallel-imul-lo");
const limb16_parallel_imul_lo_smi = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-parallel-imul-lo-smi");
const limb16_parallel_imul_all = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-parallel-imul-all");
const limb16_parallel_imul_all_smi = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-parallel-imul-all-smi");
const limb16_parallel_imul_cached = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-parallel-imul-cached");
const limb16_parallel_imul_cached_smi = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-parallel-imul-cached-smi");

// Family 2: limb16-pipeline
const limb16_pipeline_bitwise_lo = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-pipeline-bitwise-lo");
const limb16_pipeline_imul_lo = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-pipeline-imul-lo");
const limb16_pipeline_imul_lo_smi = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-pipeline-imul-lo-smi");
const limb16_pipeline_imul_all = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-pipeline-imul-all");
const limb16_pipeline_imul_all_smi = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-pipeline-imul-all-smi");
const limb16_pipeline_imul_cached = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-pipeline-imul-cached");
const limb16_pipeline_imul_cached_smi = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-pipeline-imul-cached-smi");
const limb16_pipeline_imul_import = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-pipeline-imul-import");

// Family 3: limb16-float48
const limb16_float48_bitwise_lo = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-float48-bitwise-lo");
const limb16_float48_imul_lo = require("/tmp/intx-stock/src/u32/mulwide/candidates/limb16-float48-imul-lo");

// Family 4: float64
const float64_corrected = require("/tmp/intx-stock/src/u32/mulwide/candidates/float64-corrected");

// Family 5: bigint variations
// const bigint_literal_mask = require("/tmp/intx-stock/src/u32/mulwide/candidates/bigint-literal-mask");
// const bigint_as_uint32 = require("/tmp/intx-stock/src/u32/mulwide/candidates/bigint-as-uint32");
// const bigint_as_uintn_literal = require("/tmp/intx-stock/src/u32/mulwide/candidates/bigint-as-uintn-literal");
// const bigint_as_uintn_module_const = require("/tmp/intx-stock/src/u32/mulwide/candidates/bigint-as-uintn-module-const");
// const bigint_as_uintn_local_const = require("/tmp/intx-stock/src/u32/mulwide/candidates/bigint-as-uintn-local-const");
// const bigint_as_uint64_imul_lo = require("/tmp/intx-stock/src/u32/mulwide/candidates/bigint-as-uint64-imul-lo");
// const bigint_hi = require("/tmp/intx-stock/src/u32/mulwide/candidates/bigint-hi");

const candidates = {
	// Family 1: Parallel
	limb16_parallel_bitwise_lo,
	limb16_parallel_imul_lo,
	limb16_parallel_imul_lo_smi,
	limb16_parallel_imul_all,
	limb16_parallel_imul_all_smi,
	limb16_parallel_imul_cached,
	limb16_parallel_imul_cached_smi,

	// Family 2: Pipelined
	limb16_pipeline_bitwise_lo,
	limb16_pipeline_imul_lo,
	limb16_pipeline_imul_lo_smi,
	limb16_pipeline_imul_all,
	limb16_pipeline_imul_all_smi,
	limb16_pipeline_imul_cached,
	limb16_pipeline_imul_cached_smi,
	limb16_pipeline_imul_import,

	// Family 3: Float48
	limb16_float48_bitwise_lo,
	limb16_float48_imul_lo,

	// Family 4: Float64
	float64_corrected,

	// Family 5: BigInt variations
	// bigint_literal_mask,
	// bigint_as_uint32,
	// bigint_as_uintn_literal,
	// bigint_as_uintn_module_const,
	// bigint_as_uintn_local_const,
	// bigint_as_uint64_imul_lo,
	// bigint_hi,
};

// Helper to build a monomorphic JIT runner for u32.mulwide kernels: mulwide(a, b, out)
function createMulwideRunner(candidate, name) {
	// const r = [0, 0];
	const r = new Uint32Array(2);
	return createRunner({
		name,
		context: { mulwide: candidate, r, a: 0xdeadbeef },
		setup: "r[0] = 0; r[1] = 1;",
		loop: "mulwide(r[0] ^ r[1], a, r);",
		teardown: "return r[1];",
	});
}

const runners = {};
for (const name in candidates) {
	runners[name] = createMulwideRunner(candidates[name], name);
}

// scratch copy: the stock suite call is replaced by an export; nothing else changed
module.exports = { runners: runners, iters: 10000000 };
