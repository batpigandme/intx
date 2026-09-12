"use strict";

const { compare, createRunner } = require("#microbe");

// Family 1: limb16-parallel
const limb16_parallel_bitwise_lo = require("./limb16-parallel-bitwise-lo");
const limb16_parallel_imul_lo = require("./limb16-parallel-imul-lo");
const limb16_parallel_imul_all = require("./limb16-parallel-imul-all");
const limb16_parallel_imul_cached = require("./limb16-parallel-imul-cached");

// Family 2: limb16-pipeline
const limb16_pipeline_bitwise_lo = require("./limb16-pipeline-bitwise-lo");
const limb16_pipeline_imul_lo = require("./limb16-pipeline-imul-lo");
const limb16_pipeline_imul_all = require("./limb16-pipeline-imul-all");
const limb16_pipeline_imul_cached = require("./limb16-pipeline-imul-cached");
const limb16_imul_import = require("./limb16-imul-import");

// Family 3: limb16-float48
const limb16_float48_bitwise_lo = require("./limb16-float48-bitwise-lo");
const limb16_float48_imul_lo = require("./limb16-float48-imul-lo");

// Family 4: float64
const float64_corrected = require("./float64-corrected");

// Family 5: bigint variations
const bigint_literal_mask = require("./bigint-literal-mask");
const bigint_as_uint32 = require("./bigint-as-uint32");
const bigint_as_uintn_literal = require("./bigint-as-uintn-literal");
const bigint_as_uintn_module_const = require("./bigint-as-uintn-module-const");
const bigint_as_uintn_local_const = require("./bigint-as-uintn-local-const");
const bigint_as_uint64_imul_lo = require("./bigint-as-uint64-imul-lo");
const bigint_hi = require("./bigint-hi");

// Helper to build a monomorphic JIT runner for u32.wmul kernels: wmul(a, b, out)
function makeWmulRunner(candidate, name) {
	const r = new Uint32Array(2);
	return createRunner({
		name,
		context: { wmul: candidate, r, a: 0xdeadbeef },
		setup: "r[0] = 0; r[1] = 1;",
		body: "wmul(r[1], a, r);",
		teardown: "return r;",
	});
}

const candidates = {
	// Family 1: Parallel
	limb16_parallel_bitwise_lo,
	limb16_parallel_imul_lo,
	limb16_parallel_imul_all,
	limb16_parallel_imul_cached,

	// Family 2: Pipelined
	limb16_pipeline_bitwise_lo,
	limb16_pipeline_imul_lo,
	limb16_pipeline_imul_all,
	limb16_pipeline_imul_cached,
	limb16_imul_import,

	// Family 3: Float48
	limb16_float48_bitwise_lo,
	limb16_float48_imul_lo,

	// Family 4: Float64
	float64_corrected,

	// Family 5: BigInt variations
	bigint_literal_mask,
	bigint_as_uint32,
	bigint_as_uintn_literal,
	bigint_as_uintn_module_const,
	bigint_as_uintn_local_const,
	bigint_as_uint64_imul_lo,
	bigint_hi,
};

const runners = {};
for (const name in candidates) {
	runners[name] = makeWmulRunner(candidates[name], name);
}

// TODO: Add @stdlib/muldw benchmark comparison once strided wmul candidates are implemented

compare("u32.wmul: Grand Candidate Evaluation", runners, {
	rounds: 5,
	iters: 5e7,
	warmup: 5e6,
});
