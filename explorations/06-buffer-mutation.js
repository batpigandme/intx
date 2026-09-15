"use strict";

const { bench, createRunner } = require("#microbe");
const { randomI32 } = require("#utils");
const i32 = require("#i32");

/**
 * EXPERIMENT 6: Buffer Mutation: In-Place vs Separate Output vs Local Allocation
 *
 * Objectives:
 * 1. Compare in-place mutation (`buf[idx] = op(buf[idx], c)`) vs separate write buffer (`outBuf[idx] = op(inBuf[idx], c)`).
 * 2. Compare globally allocated context buffers vs per-round allocated local buffers.
 * 3. Compare with fixed fixture mutation (`out[0] = ...`, like divmod).
 * 4. Contrast against read-only buffer walk.
 */

const c = 0x9e3779b9 | 0;

// Context Buffers (Allocated once globally)
const inBuf = new Int32Array(256);
const outBuf = new Int32Array(256);
const mutBuf = new Int32Array(256);
const outFix = new Int32Array(2);

for (let i = 0; i < 256; i++) {
	const val = randomI32();
	inBuf[i] = val;
	mutBuf[i] = val;
}

const ops = {
	"1. Read-Only Baseline (Walk Only)": createRunner({
		context: { add: i32.add, c, inBuf },
		setup: "let acc = 0, idx = 0;",
		loop: `
			acc = add(acc, inBuf[idx]);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return acc;",
	}),

	"2. In-Place Mutation (Context Buffer)": createRunner({
		context: { add: i32.add, c, mutBuf },
		setup: "let idx = 0;",
		loop: `
			mutBuf[idx] = add(mutBuf[idx], c);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return mutBuf[0];",
	}),

	"3. In-Place Mutation (Local Setup Buffer)": createRunner({
		context: { add: i32.add, c },
		setup: `
			const localBuf = new Int32Array(256);
			for (let i = 0; i < 256; i++) localBuf[i] = (i * 0x45d9f3b + 1) | 0;
			let idx = 0;
		`,
		loop: `
			localBuf[idx] = add(localBuf[idx], c);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return localBuf[0];",
	}),

	"4. Separate Write Buffer (inBuf -> outBuf, Context)": createRunner({
		context: { add: i32.add, c, inBuf, outBuf },
		setup: "let idx = 0;",
		loop: `
			outBuf[idx] = add(inBuf[idx], c);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return outBuf[0];",
	}),

	"5. Separate Write Buffer (Local Setup Buffers)": createRunner({
		context: { add: i32.add, c },
		setup: `
			const localIn = new Int32Array(256);
			const localOut = new Int32Array(256);
			for (let i = 0; i < 256; i++) localIn[i] = (i * 0x45d9f3b + 1) | 0;
			let idx = 0;
		`,
		loop: `
			localOut[idx] = add(localIn[idx], c);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return localOut[0];",
	}),

	"6. Fixed Fixture Mutation (out[0] = ... like divmod)": createRunner({
		context: { add: i32.add, c, inBuf, outFix },
		setup: "let idx = 0;",
		loop: `
			outFix[0] = add(inBuf[idx], c);
			outFix[1] = add(inBuf[idx], -c);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return outFix[0] ^ outFix[1];",
	}),
};

bench.suite("Exp 6: Buffer Mutation Patterns", ops, {
	rounds: 5,
	iters: 1e8,
});
