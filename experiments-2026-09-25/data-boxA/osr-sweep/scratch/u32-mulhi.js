"use strict";

const { bench, createRunner } = require("#microbe");

// Family 1: limb16-parallel
const limb16_parallel_bitwise = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-parallel-bitwise");
const limb16_parallel_bitwise_smi = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-parallel-bitwise-smi");
const limb16_parallel_imul_all = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-parallel-imul-all");
const limb16_parallel_imul_all_smi = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-parallel-imul-all-smi");
const limb16_parallel_imul_cached = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-parallel-imul-cached");
const limb16_parallel_imul_cached_smi = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-parallel-imul-cached-smi");

// Family 2: limb16-pipeline
const limb16_pipeline_bitwise = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-pipeline-bitwise");
const limb16_pipeline_bitwise_smi = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-pipeline-bitwise-smi");
const limb16_pipeline_imul_all = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-pipeline-imul-all");
const limb16_pipeline_imul_all_smi = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-pipeline-imul-all-smi");
const limb16_pipeline_imul_cached = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-pipeline-imul-cached");
const limb16_pipeline_imul_cached_smi = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-pipeline-imul-cached-smi");
const limb16_pipeline_imul_import = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-pipeline-imul-import");

// Family 3: limb16-float48
const limb16_float48_floor = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-float48-floor");
const limb16_float48_trunc = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-float48-trunc");
const limb16_float48_trunc_smi = require("/tmp/intx-stock/src/u32/mulhi/candidates/limb16-float48-trunc-smi");

// Family 4: float64
const float64_corrected = require("/tmp/intx-stock/src/u32/mulhi/candidates/float64-corrected");
const float64_corrected_smi = require("/tmp/intx-stock/src/u32/mulhi/candidates/float64-corrected-smi");
const float64_corrected_cached = require("/tmp/intx-stock/src/u32/mulhi/candidates/float64-corrected-cached");

// Family 5: bigint variations
// const bigint_literal_mask = require("/tmp/intx-stock/src/u32/mulhi/candidates/bigint-literal-mask");
// const bigint_as_uint32 = require("/tmp/intx-stock/src/u32/mulhi/candidates/bigint-as-uint32");
// const bigint_as_uintn_literal = require("/tmp/intx-stock/src/u32/mulhi/candidates/bigint-as-uintn-literal");
// const bigint_as_uintn_module_const = require("/tmp/intx-stock/src/u32/mulhi/candidates/bigint-as-uintn-module-const");
// const bigint_as_uintn_local_const = require("/tmp/intx-stock/src/u32/mulhi/candidates/bigint-as-uintn-local-const");
// const bigint_hi = require("/tmp/intx-stock/src/u32/mulhi/candidates/bigint-hi");

const candidates = {
	// Family 1: Parallel
	limb16_parallel_bitwise,
	limb16_parallel_bitwise_smi,
	limb16_parallel_imul_all,
	limb16_parallel_imul_all_smi,
	limb16_parallel_imul_cached,
	limb16_parallel_imul_cached_smi,

	// Family 2: Pipelined
	limb16_pipeline_bitwise,
	limb16_pipeline_bitwise_smi,
	limb16_pipeline_imul_all,
	limb16_pipeline_imul_all_smi,
	limb16_pipeline_imul_cached,
	limb16_pipeline_imul_cached_smi,
	limb16_pipeline_imul_import,

	// Family 3: Float48
	limb16_float48_floor,
	limb16_float48_trunc,
	limb16_float48_trunc_smi,

	// Family 4: Float64
	float64_corrected,
	float64_corrected_smi,
	float64_corrected_cached,

	// Family 5: BigInt variations
	// bigint_literal_mask,
	// bigint_as_uint32,
	// bigint_as_uintn_literal,
	// bigint_as_uintn_module_const,
	// bigint_as_uintn_local_const,
	// bigint_hi,
};

// Helper to build a monomorphic JIT runner for u32.mulhi kernels: mulhi(a, b)
function createMulhiRunner(candidate, name) {
	// const r = [0];
	const r = new Uint32Array(1);
	return createRunner({
		name,
		context: { mulhi: candidate, r, a: 0xdeadbeef },
		setup: "r[0] = 1;",
		loop: "r[0] = mulhi(r[0], a);",
		teardown: "return r[0];",
	});
}

const runners = {};
for (const name in candidates) {
	runners[name] = createMulhiRunner(candidates[name], name);
}

// scratch copy: the stock suite call is replaced by an export; nothing else changed
module.exports = { runners: runners, iters: 10000000 };
