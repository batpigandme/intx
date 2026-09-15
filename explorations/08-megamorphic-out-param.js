"use strict";

const { bench, createRunner } = require("#microbe");

/**
 * EXPERIMENT 8: Megamorphic IC Degradation on `out` Parameter Buffers (using i32.mulwide)
 *
 * Objectives:
 * 1. Test whether passing different array types (Int32Array, Uint32Array, Float64Array, generic Array)
 *    into `i32.mulwide(a, b, out)` causes Inline Cache (IC) pollution and megamorphic slowdowns.
 * 2. Observe how a larger multi-limb arithmetic kernel (~200 bytes bytecode) behaves compared to smaller leaf functions.
 * 3. Test:
 *    - Pure Monomorphic Int32Array (INT32_ELEMENTS)
 *    - Pure Monomorphic Uint32Array (UINT32_ELEMENTS)
 *    - Pure Monomorphic Generic Array (PACKED_SMI_ELEMENTS)
 *    - Polymorphic Call Site (2 types: Int32Array + Uint32Array alternating)
 *    - Megamorphic Call Site (4 types: Int32Array + Uint32Array + Float64Array + Generic Array alternating)
 *    - Contaminated Kernel (Pre-Polluted mulwide called with pristine Int32Array)
 */

const LOW_16 = 0xffff;

function createMulwide() {
	return function mulwide(a, b, out) {
		a |= 0;
		b |= 0;

		const ua = a >>> 0;
		const ub = b >>> 0;

		const ah = ua >>> 16;
		const al = ua & LOW_16;
		const bh = ub >>> 16;
		const bl = ub & LOW_16;

		const albl = Math.imul(al, bl) >>> 0;
		const llh = albl >>> 16;

		const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
		const hll = ahbl & LOW_16;
		const hlh = ahbl >>> 16;

		const albh = (Math.imul(al, bh) + hll) >>> 0;
		const lhh = albh >>> 16;

		const lo = Math.imul(a, b) | 0;
		let hi = (Math.imul(ah, bh) + hlh + lhh) | 0;

		hi = (hi - ((a >> 31) & b) - ((b >> 31) & a)) | 0;

		out[0] = hi;
		out[1] = lo;
		return out;
	};
}

// 1. Pristine isolated kernels
const mulwideI32 = createMulwide();
const mulwideU32 = createMulwide();
const mulwideGeneric = createMulwide();
const mulwidePolymorphic = createMulwide();
const mulwideMegamorphic = createMulwide();

// Shared kernel to test cross-candidate contamination
const contaminatedMulwide = createMulwide();

// Test destination buffers
const outI32 = new Int32Array(2);
const outU32 = new Uint32Array(2);
const outF64 = new Float64Array(2);
const outGeneric = [0, 0];

// Pollute the contaminated kernel's internal FeedbackVector upfront
for (let i = 0; i < 10000; i++) {
	contaminatedMulwide(100, 10, outGeneric);
	contaminatedMulwide(100, 10, outF64);
	contaminatedMulwide(100, 10, outU32);
	contaminatedMulwide(100, 10, outI32);
}

const polyBuffers = [outI32, outU32];
const megaBuffers = [outI32, outU32, outF64, outGeneric];

const buf = new Int32Array(256);
for (let i = 0; i < 256; i++) buf[i] = (i * 0x45d9f3b + 1) | 0;
const c = 0x9e3779b9 | 0;

const ops = {
	"1. Monomorphic: Pristine Int32Array out": createRunner({
		context: { mulwide: mulwideI32, c, buf, out: outI32 },
		setup: "let idx = 0;",
		body: `
			mulwide(buf[idx], c, out);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return out[0] ^ out[1];",
	}),

	"2. Monomorphic: Pristine Uint32Array out": createRunner({
		context: { mulwide: mulwideU32, c, buf, out: outU32 },
		setup: "let idx = 0;",
		body: `
			mulwide(buf[idx], c, out);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return out[0] ^ out[1];",
	}),

	"3. Monomorphic: Pristine Generic Array out ([0, 0])": createRunner({
		context: { mulwide: mulwideGeneric, c, buf, out: outGeneric },
		setup: "let idx = 0;",
		body: `
			mulwide(buf[idx], c, out);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return out[0] ^ out[1];",
	}),

	"4. Polymorphic Call Site (2 types: Int32 + Uint32 alternating)":
		createRunner({
			context: { mulwide: mulwidePolymorphic, c, buf, polyBuffers },
			setup: "let idx = 0, bIdx = 0;",
			body: `
			mulwide(buf[idx], c, polyBuffers[bIdx]);
			bIdx = (bIdx + 1) & 1;
			idx = (idx + 1) & 0xff;
		`,
			teardown: "return polyBuffers[0][0] ^ polyBuffers[1][0];",
		}),

	"5. Megamorphic Call Site (4 types: Int32 + Uint32 + Float64 + Generic)":
		createRunner({
			context: { mulwide: mulwideMegamorphic, c, buf, megaBuffers },
			setup: "let idx = 0, bIdx = 0;",
			body: `
			mulwide(buf[idx], c, megaBuffers[bIdx]);
			bIdx = (bIdx + 1) & 3;
			idx = (idx + 1) & 0xff;
		`,
			teardown:
				"return (megaBuffers[0][0] ^ megaBuffers[1][0] ^ megaBuffers[2][0] ^ megaBuffers[3][0]) | 0;",
		}),

	"6. Contaminated Kernel: Int32Array on Pre-Polluted mulwide": createRunner({
		context: { mulwide: contaminatedMulwide, c, buf, out: outI32 },
		setup: "let idx = 0;",
		body: `
			mulwide(buf[idx], c, out);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return out[0] ^ out[1];",
	}),
};

bench.suite("Exp 8: Megamorphic IC Degradation on 'out' (i32.mulwide)", ops, {
	rounds: 5,
	iters: 1e8,
	width: 120,
});
