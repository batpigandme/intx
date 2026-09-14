"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomU32 } = require("#utils");

// Oracle
const oracle = require("./bigint-literal-mask");

// Family 1: limb16-parallel
const limb16_parallel_bitwise = require("./limb16-parallel-bitwise");
const limb16_parallel_bitwise_smi = require("./limb16-parallel-bitwise-smi");
const limb16_parallel_imul_all = require("./limb16-parallel-imul-all");
const limb16_parallel_imul_all_smi = require("./limb16-parallel-imul-all-smi");
const limb16_parallel_imul_cached = require("./limb16-parallel-imul-cached");
const limb16_parallel_imul_cached_smi = require("./limb16-parallel-imul-cached-smi");

// Family 2: limb16-pipeline
const limb16_pipeline_bitwise = require("./limb16-pipeline-bitwise");
const limb16_pipeline_bitwise_smi = require("./limb16-pipeline-bitwise-smi");
const limb16_pipeline_imul_all = require("./limb16-pipeline-imul-all");
const limb16_pipeline_imul_all_smi = require("./limb16-pipeline-imul-all-smi");
const limb16_pipeline_imul_cached = require("./limb16-pipeline-imul-cached");
const limb16_pipeline_imul_cached_smi = require("./limb16-pipeline-imul-cached-smi");
const limb16_pipeline_imul_import = require("./limb16-pipeline-imul-import");

// Family 3: limb16-float48
const limb16_float48_floor = require("./limb16-float48-floor");
const limb16_float48_trunc = require("./limb16-float48-trunc");
const limb16_float48_trunc_smi = require("./limb16-float48-trunc-smi");

// Family 4: float64
const float64_corrected = require("./float64-corrected");
const float64_corrected_smi = require("./float64-corrected-smi");
const float64_corrected_cached = require("./float64-corrected-cached");

// Family 5: bigint variations
const bigint_as_uint32 = require("./bigint-as-uint32");
const bigint_as_uintn_literal = require("./bigint-as-uintn-literal");
const bigint_as_uintn_module_const = require("./bigint-as-uintn-module-const");
const bigint_as_uintn_local_const = require("./bigint-as-uintn-local-const");
const bigint_hi = require("./bigint-hi");

const candidates = {
	// Family 1
	"limb16-parallel-bitwise": limb16_parallel_bitwise,
	"limb16-parallel-bitwise-smi": limb16_parallel_bitwise_smi,
	"limb16-parallel-imul-all": limb16_parallel_imul_all,
	"limb16-parallel-imul-all-smi": limb16_parallel_imul_all_smi,
	"limb16-parallel-imul-cached": limb16_parallel_imul_cached,
	"limb16-parallel-imul-cached-smi": limb16_parallel_imul_cached_smi,

	// Family 2
	"limb16-pipeline-bitwise": limb16_pipeline_bitwise,
	"limb16-pipeline-bitwise-smi": limb16_pipeline_bitwise_smi,
	"limb16-pipeline-imul-all": limb16_pipeline_imul_all,
	"limb16-pipeline-imul-all-smi": limb16_pipeline_imul_all_smi,
	"limb16-pipeline-imul-cached": limb16_pipeline_imul_cached,
	"limb16-pipeline-imul-cached-smi": limb16_pipeline_imul_cached_smi,
	"limb16-pipeline-imul-import": limb16_pipeline_imul_import,

	// Family 3
	"limb16-float48-floor": limb16_float48_floor,
	"limb16-float48-trunc": limb16_float48_trunc,
	"limb16-float48-trunc-smi": limb16_float48_trunc_smi,

	// Family 4
	"float64-corrected": float64_corrected,
	"float64-corrected-smi": float64_corrected_smi,
	"float64-corrected-cached": float64_corrected_cached,

	// Family 5
	"bigint-as-uint32": bigint_as_uint32,
	"bigint-as-uintn-literal": bigint_as_uintn_literal,
	"bigint-as-uintn-module-const": bigint_as_uintn_module_const,
	"bigint-as-uintn-local-const": bigint_as_uintn_local_const,
	"bigint-hi": bigint_hi,
};

test("u32.mulhi: candidates verification vs BigInt oracle", () => {
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
		[0x00010000, 0x00010000],
		[0xffff0000, 0x0000ffff],
		[0x7fffffff, 2],
		[0x80000001, 0x7fffffff],
	];

	for (const [name, fn] of Object.entries(candidates)) {
		const isSmi = name.endsWith("-smi");

		// 1. Edge cases
		for (const [a, b] of edgeCases) {
			const rawExpected = oracle(a, b);
			const expected = isSmi ? rawExpected | 0 : rawExpected;
			const actual = fn(a, b);
			assert.equal(
				actual,
				expected,
				`Candidate ${name} failed on edge case (0x${a.toString(16)}, 0x${b.toString(16)})`,
			);
		}

		// 2. Random fuzz testing (100,000 random inputs per candidate)
		for (let i = 0; i < 100000; i++) {
			const a = randomU32();
			const b = randomU32();
			const rawExpected = oracle(a, b);
			const expected = isSmi ? rawExpected | 0 : rawExpected;
			const actual = fn(a, b);
			assert.equal(
				actual,
				expected,
				`Candidate ${name} failed on random fuzz (0x${a.toString(16)}, 0x${b.toString(16)})`,
			);
		}
	}
});
