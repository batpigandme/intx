"use strict";

const { bench, createRunner } = require("#microbe");
const { randomI32 } = require("#utils");
const i32 = require("#i32");
const u32 = require("#u32");

/**
 * EXPERIMENT 9: Signed (i32.mulwide) vs Unsigned (u32.mulwide) 1x Serial Throughput
 *
 * Objectives:
 * 1. Measure and compare max 1x serial throughput of signed vs unsigned widening multiplication.
 * 2. Compare across:
 *    - Pure Serial Recurrence (r[0] ^ r[1] feed-forward, 1x latency bound)
 *    - L1 Buffer Walk (Reading diverse 32-bit test vectors with fixed output buffer)
 *    - Quantify the exact cost of the Hacker's Delight signed correction stage.
 */

const i32Mulwide = i32.mulwide;
const u32Mulwide = u32.mulwide;

// Test vectors
const buf = new Int32Array(256);
for (let i = 0; i < 256; i++) buf[i] = randomI32();

const cSigned = 0x9e3779b9 | 0;
const cUnsigned = 0x9e3779b9 >>> 0;

const outI32 = new Int32Array(2);
const outU32 = new Uint32Array(2);

const ops = {
	"1. u32.mulwide: Pure Serial Recurrence (1x Latency Bound)": createRunner({
		context: { mulwide: u32Mulwide, c: cUnsigned, r: outU32 },
		setup: "r[0] = 0x12345678; r[1] = 0x87654321;",
		loop: "mulwide((r[0] ^ r[1]) >>> 0, c, r);",
		teardown: "return r[0] ^ r[1];",
	}),

	"2. i32.mulwide: Pure Serial Recurrence (1x Latency Bound)": createRunner({
		context: { mulwide: i32Mulwide, c: cSigned, r: outI32 },
		setup: "r[0] = 0x12345678; r[1] = 0x87654321;",
		loop: "mulwide((r[0] ^ r[1]) | 0, c, r);",
		teardown: "return r[0] ^ r[1];",
	}),

	"3. u32.mulwide: L1 Buffer Walk (Diverse Inputs)": createRunner({
		context: { mulwide: u32Mulwide, c: cUnsigned, buf, r: outU32 },
		setup: "let idx = 0;",
		loop: `
			mulwide(buf[idx] >>> 0, c, r);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return r[0] ^ r[1];",
	}),

	"4. i32.mulwide: L1 Buffer Walk (Diverse Inputs)": createRunner({
		context: { mulwide: i32Mulwide, c: cSigned, buf, r: outI32 },
		setup: "let idx = 0;",
		loop: `
			mulwide(buf[idx], c, r);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return r[0] ^ r[1];",
	}),
};

bench.suite("Exp 9: Signed vs Unsigned mulwide 1x Serial Throughput", ops, {
	rounds: 5,
	iters: 1e8,
	width: 120,
});
