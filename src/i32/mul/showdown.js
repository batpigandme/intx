"use strict";

const { bench, createRunner } = require("#microbe");
const mul = require("./index.js");

// 32-Bit Constants & Buffers
const c = 0x9e3779b9 | 0;
const r = new Int32Array(1);
const buf = new Int32Array(1024);
for (let i = 0; i < 1024; i++) buf[i] = (i * 2 + 1) | 0 | 1; // odd numbers

const ops = {
	"Serialized (1x Latency Bound)": createRunner({
		context: { mul, c },
		setup: "let acc = 1;",
		loop: "acc = mul(acc, c);",
		teardown: "return acc;",
	}),

	"Parallel 2x (2 Independent Accumulators)": createRunner({
		context: { mul, c },
		setup: "let a0 = 1, a1 = 3;",
		loop: `
			a0 = mul(a0, c);
			a1 = mul(a1, c);
		`,
		teardown: "return a0 ^ a1;",
	}),

	"Parallel 4x (4 Independent Accumulators)": createRunner({
		context: { mul, c },
		setup: "let a0 = 1, a1 = 3, a2 = 5, a3 = 7;",
		loop: `
			a0 = mul(a0, c);
			a1 = mul(a1, c);
			a2 = mul(a2, c);
			a3 = mul(a3, c);
		`,
		teardown: "return a0 ^ a1 ^ a2 ^ a3;",
	}),

	"Parallel 8x (8 Independent Accumulators)": createRunner({
		context: { mul, c },
		setup:
			"let a0 = 1, a1 = 3, a2 = 5, a3 = 7, a4 = 9, a5 = 11, a6 = 13, a7 = 15;",
		loop: `
			a0 = mul(a0, c);
			a1 = mul(a1, c);
			a2 = mul(a2, c);
			a3 = mul(a3, c);
			a4 = mul(a4, c);
			a5 = mul(a5, c);
			a6 = mul(a6, c);
			a7 = mul(a7, c);
		`,
		teardown: "return a0 ^ a1 ^ a2 ^ a3 ^ a4 ^ a5 ^ a6 ^ a7;",
	}),

	"Outer Fixture (Int32Array In-Place Mutation)": createRunner({
		context: { mul, c, r },
		setup: "r[0] = 1;",
		loop: "r[0] = mul(r[0], c);",
		teardown: "return r[0];",
	}),

	"Array Reduction (Int32Array Buffer Walk)": createRunner({
		context: { mul, buf },
		setup: "let acc = 1, idx = 0;",
		loop: `
			acc = mul(acc, buf[idx]);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return acc;",
	}),

	"Inline Math.imul (Direct Builtin Baseline)": createRunner({
		context: { c },
		setup: "let acc = 1;",
		loop: "acc = Math.imul(acc, c);",
		teardown: "return acc;",
	}),
};

bench.suite.rank("i32.mul: Execution Pattern Showdown", ops, {
	rounds: 5,
	iters: 2e7,
	width: 100,
});
