"use strict";

const { bench, createRunner } = require("#microbe");

/**
 * EXPERIMENT 8: Megamorphic IC Degradation on `out` Parameter Buffers
 *
 * Objectives:
 * 1. Test whether passing different array types (Int32Array, Uint32Array, Float64Array, generic Array)
 *    into a kernel with an `out` parameter causes Inline Cache (IC) pollution and megamorphic slowdowns.
 * 2. Measure performance across:
 *    - Pure Monomorphic Int32Array (INT32_ELEMENTS)
 *    - Pure Monomorphic Uint32Array (UINT32_ELEMENTS)
 *    - Pure Monomorphic Generic Array (PACKED_SMI_ELEMENTS)
 *    - Polymorphic (2 types: Int32Array + Uint32Array on alternating calls)
 *    - Megamorphic (4 types: Int32Array + Uint32Array + Float64Array + Generic Array on alternating calls)
 * 3. Demonstrate the "Shared Kernel Contamination" effect where a polluted global kernel function
 *    permanently degrades even monomorphic callers in the same process.
 */

// Fresh clones of divmod to test isolated monomorphic vs contaminated feedback vectors
function createDivmod() {
	return function divmod(a, b, out) {
		a |= 0;
		b |= 0;
		const q = (a / b) | 0;
		out[0] = q;
		out[1] = (a - Math.imul(q, b)) | 0;
	};
}

// 1. Pristine isolated kernels
const divmodI32 = createDivmod();
const divmodU32 = createDivmod();
const divmodGeneric = createDivmod();
const divmodPolymorphic = createDivmod();
const divmodMegamorphic = createDivmod();

// Shared kernel to test cross-candidate contamination
const contaminatedDivmod = createDivmod();

// Test buffers
const outI32 = new Int32Array(2);
const outU32 = new Uint32Array(2);
const outF64 = new Float64Array(2);
const outGeneric = [0, 0];

// Pollute the contaminated kernel's internal FeedbackVector upfront
for (let i = 0; i < 10000; i++) {
	contaminatedDivmod(100, 10, outGeneric);
	contaminatedDivmod(100, 10, outF64);
	contaminatedDivmod(100, 10, outU32);
	contaminatedDivmod(100, 10, outI32);
}

const polyBuffers = [outI32, outU32];
const megaBuffers = [outI32, outU32, outF64, outGeneric];

const buf = new Int32Array(256);
for (let i = 0; i < 256; i++) buf[i] = (i * 0x45d9f3b + 1) | 0;
const d = 17 | 0;

const ops = {
	"1. Monomorphic: Pristine Int32Array out": createRunner({
		context: { divmod: divmodI32, d, buf, out: outI32 },
		setup: "let idx = 0;",
		body: `
			divmod(buf[idx], d, out);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return out[0] ^ out[1];",
	}),

	"2. Monomorphic: Pristine Uint32Array out": createRunner({
		context: { divmod: divmodU32, d, buf, out: outU32 },
		setup: "let idx = 0;",
		body: `
			divmod(buf[idx], d, out);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return out[0] ^ out[1];",
	}),

	"3. Monomorphic: Pristine Generic Array out ([0, 0])": createRunner({
		context: { divmod: divmodGeneric, d, buf, out: outGeneric },
		setup: "let idx = 0;",
		body: `
			divmod(buf[idx], d, out);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return out[0] ^ out[1];",
	}),

	"4. Polymorphic Call Site (2 types: Int32 + Uint32 alternating)":
		createRunner({
			context: { divmod: divmodPolymorphic, d, buf, polyBuffers },
			setup: "let idx = 0, bIdx = 0;",
			body: `
			divmod(buf[idx], d, polyBuffers[bIdx]);
			bIdx = (bIdx + 1) & 1;
			idx = (idx + 1) & 0xff;
		`,
			teardown: "return polyBuffers[0][0] ^ polyBuffers[1][0];",
		}),

	"5. Megamorphic Call Site (4 types: Int32 + Uint32 + Float64 + Generic)":
		createRunner({
			context: { divmod: divmodMegamorphic, d, buf, megaBuffers },
			setup: "let idx = 0, bIdx = 0;",
			body: `
			divmod(buf[idx], d, megaBuffers[bIdx]);
			bIdx = (bIdx + 1) & 3;
			idx = (idx + 1) & 0xff;
		`,
			teardown:
				"return (megaBuffers[0][0] ^ megaBuffers[1][0] ^ megaBuffers[2][0] ^ megaBuffers[3][0]) | 0;",
		}),

	"6. Contaminated Kernel: Int32Array on Pre-Polluted divmod": createRunner({
		context: { divmod: contaminatedDivmod, d, buf, out: outI32 },
		setup: "let idx = 0;",
		body: `
			divmod(buf[idx], d, out);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return out[0] ^ out[1];",
	}),
};

bench.suite("Exp 8: Megamorphic IC Degradation on 'out' Parameter", ops, {
	rounds: 5,
	iters: 1e8,
	width: 120,
});
