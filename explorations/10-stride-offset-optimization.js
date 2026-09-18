"use strict";

const { bench, createRunner } = require("../src/microbe");

// --- Implementations ---
const LOW_16 = 0xffff;

function mulwide_fixed(a, b, out) {
	a >>>= 0;
	b >>>= 0;
	const ah = a >>> 16;
	const al = a & LOW_16;
	const bh = b >>> 16;
	const bl = b & LOW_16;

	const albl = Math.imul(al, bl) >>> 0;
	const llh = albl >>> 16;
	const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
	const hll = ahbl & LOW_16;
	const hlh = ahbl >>> 16;
	const albh = (Math.imul(al, bh) + hll) >>> 0;
	const lhh = albh >>> 16;

	const lo = Math.imul(a, b) >>> 0;
	const hi = (Math.imul(ah, bh) + hlh + lhh) >>> 0;

	out[0] = hi;
	out[1] = lo;
	return out;
}

function mulwide_stride(a, b, out, stride, offset) {
	a >>>= 0;
	b >>>= 0;
	const ah = a >>> 16;
	const al = a & LOW_16;
	const bh = b >>> 16;
	const bl = b & LOW_16;

	const albl = Math.imul(al, bl) >>> 0;
	const llh = albl >>> 16;
	const ahbl = (Math.imul(ah, bl) + llh) >>> 0;
	const hll = ahbl & LOW_16;
	const hlh = ahbl >>> 16;
	const albh = (Math.imul(al, bh) + hll) >>> 0;
	const lhh = albh >>> 16;

	const lo = Math.imul(a, b) >>> 0;
	const hi = (Math.imul(ah, bh) + hlh + lhh) >>> 0;

	out[offset] = hi;
	out[offset + stride] = lo;
	return out;
}

// -------------------------------------------------------------
// EXPERIMENT 2: Pure Un-inlined Call Isolation
// We prevent inlining cleanly by padding the callee bytecode size beyond V8's
// --max-inlined-bytecode-size (460 bytes) using an unreachable dead branch.
// This preserves a 100% monomorphic, direct function call without ANY loop
// overhead (no array lookups, no modulo, no property access).
// -------------------------------------------------------------

function padBytecode(fnBody) {
	return `
    if (a === -999999999) {
      let x = a;
      ${Array.from({ length: 40 }, (_, i) => `x = (Math.imul(x, ${i + 1}) + ${i}) | 0;`).join("\n")}
      return x;
    }
    ${fnBody}
  `;
}

const fixedBody = `
	a >>>= 0; b >>>= 0;
	const ah = a >>> 16, al = a & 0xffff, bh = b >>> 16, bl = b & 0xffff;
	const albl = Math.imul(al, bl) >>> 0, llh = albl >>> 16;
	const ahbl = (Math.imul(ah, bl) + llh) >>> 0, hll = ahbl & 0xffff, hlh = ahbl >>> 16;
	const albh = (Math.imul(al, bh) + hll) >>> 0, lhh = albh >>> 16;
	const lo = Math.imul(a, b) >>> 0, hi = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
	out[0] = hi;
	out[1] = lo;
	return out;
`;

const strideBody = `
	a >>>= 0; b >>>= 0;
	const ah = a >>> 16, al = a & 0xffff, bh = b >>> 16, bl = b & 0xffff;
	const albl = Math.imul(al, bl) >>> 0, llh = albl >>> 16;
	const ahbl = (Math.imul(ah, bl) + llh) >>> 0, hll = ahbl & 0xffff, hlh = ahbl >>> 16;
	const albh = (Math.imul(al, bh) + hll) >>> 0, lhh = albh >>> 16;
	const lo = Math.imul(a, b) >>> 0, hi = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
	out[offset] = hi;
	out[offset + stride] = lo;
	return out;
`;

const mulwide_fixed_uninlined = new Function("a", "b", "out", padBytecode(fixedBody));
const mulwide_stride_uninlined = new Function("a", "b", "out", "stride", "offset", padBytecode(strideBody));

const r_u32 = new Uint32Array(2);

const suite_uninlined = {
	"Un-inlined Fixed Indexing: fn(a, b, r) [3 args]": createRunner({
		context: { fn: mulwide_fixed_uninlined, r: r_u32, a: 0xdeadbeef },
		setup: "r[0] = 0; r[1] = 1;",
		loop: "fn(r[0] ^ r[1], a, r);",
		teardown: "return r[1];",
	}),

	"Un-inlined Stride with Constant Args (1, 0) [5 args]": createRunner({
		context: { fn: mulwide_stride_uninlined, r: r_u32, a: 0xdeadbeef },
		setup: "r[0] = 0; r[1] = 1;",
		loop: "fn(r[0] ^ r[1], a, r, 1, 0);",
		teardown: "return r[1];",
	}),
};

// -------------------------------------------------------------
// EXPERIMENT 3: Buffer Array Mutation (Uint32Array vs Fast Array [0, 0])
// -------------------------------------------------------------

const suite_types = {
	"Uint32Array: Fixed [0]/[1]": createRunner({
		context: { fn: mulwide_fixed, r: new Uint32Array(2), a: 0xdeadbeef },
		setup: "r[0] = 0; r[1] = 1;",
		loop: "fn(r[0] ^ r[1], a, r);",
		teardown: "return r[1];",
	}),

	"Uint32Array: Inlined Stride (1, 0)": createRunner({
		context: { fn: mulwide_stride, r: new Uint32Array(2), a: 0xdeadbeef },
		setup: "r[0] = 0; r[1] = 1;",
		loop: "fn(r[0] ^ r[1], a, r, 1, 0);",
		teardown: "return r[1];",
	}),

	"Fast Array [0, 0]: Fixed [0]/[1]": createRunner({
		context: { fn: mulwide_fixed, r: [0, 0], a: 0xdeadbeef },
		setup: "r[0] = 0; r[1] = 1;",
		loop: "fn(r[0] ^ r[1], a, r);",
		teardown: "return r[1];",
	}),

	"Fast Array [0, 0]: Inlined Stride (1, 0)": createRunner({
		context: { fn: mulwide_stride, r: [0, 0], a: 0xdeadbeef },
		setup: "r[0] = 0; r[1] = 1;",
		loop: "fn(r[0] ^ r[1], a, r, 1, 0);",
		teardown: "return r[1];",
	}),
};

// -------------------------------------------------------------
// EXPERIMENT 4: Strided Array Walk (Writing across a 1024-element buffer)
// -------------------------------------------------------------

const BUF_LEN = 1024;
const src_u32 = new Uint32Array(BUF_LEN);
const dst_u32 = new Uint32Array(BUF_LEN);

function mulwide_at_idx(a, b, out, idx) {
	a >>>= 0; b >>>= 0;
	const ah = a >>> 16, al = a & LOW_16, bh = b >>> 16, bl = b & LOW_16;
	const albl = Math.imul(al, bl) >>> 0, llh = albl >>> 16;
	const ahbl = (Math.imul(ah, bl) + llh) >>> 0, hll = ahbl & LOW_16, hlh = ahbl >>> 16;
	const albh = (Math.imul(al, bh) + hll) >>> 0, lhh = albh >>> 16;
	const lo = Math.imul(a, b) >>> 0, hi = (Math.imul(ah, bh) + hlh + lhh) >>> 0;
	out[idx] = hi;
	out[idx + 1] = lo;
	return out;
}

const suite_walk = {
	"Walk: Fixed Unit-Stride Helper: fn_at(src[idx], a, dst, idx)": createRunner({
		context: { fn: mulwide_at_idx, src: src_u32, dst: dst_u32, a: 0xdeadbeef, mask: BUF_LEN - 2 },
		setup: "src[0] = 1; src[1] = 2;",
		loop: "const idx = (i * 2) & mask; fn(src[idx], a, dst, idx);",
		teardown: "return dst[0];",
	}),

	"Walk: General Strided Helper: fn_stride(src[idx], a, dst, 1, idx)": createRunner({
		context: { fn: mulwide_stride, src: src_u32, dst: dst_u32, a: 0xdeadbeef, mask: BUF_LEN - 2 },
		setup: "src[0] = 1; src[1] = 2;",
		loop: "const idx = (i * 2) & mask; fn(src[idx], a, dst, 1, idx);",
		teardown: "return dst[0];",
	}),

	"Walk: General Strided with Variable Stride (stride=1)": createRunner({
		context: { fn: mulwide_stride, src: src_u32, dst: dst_u32, a: 0xdeadbeef, mask: BUF_LEN - 2, stride: 1 },
		setup: "src[0] = 1; src[1] = 2;",
		loop: "const idx = (i * 2) & mask; fn(src[idx], a, dst, stride, idx);",
		teardown: "return dst[0];",
	}),
};

bench.suite.rank("Experiment 2: Pure Un-inlined Call Isolation (Bytecode Budget Saturation)", suite_uninlined, {
	rounds: 5,
	iters: 1e7,
	width: 100,
});

bench.suite.rank("Experiment 3: TypedArray vs Fast Array Elements", suite_types, {
	rounds: 5,
	iters: 1e7,
	width: 100,
});

bench.suite.rank("Experiment 4: Strided Buffer Walk (1024-element Uint32Array)", suite_walk, {
	rounds: 5,
	iters: 1e7,
	width: 100,
});
