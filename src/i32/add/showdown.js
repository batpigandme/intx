"use strict";

const { compare, createRunner } = require("#microbe");
const add = require("./index.js");

// 32-Bit Constants & Buffers
const c = 0x9e3779b9 | 0;
const r = new Int32Array(1);
const buf = new Int32Array(1024);
for (let i = 0; i < 1024; i++) buf[i] = (i * 0x45d9f3b + 1) | 0;

const ops = {
	"1. Serialized (1x Latency Bound)": createRunner({
		context: { add, c },
		setup: "let acc = 1;",
		body: "acc = add(acc, c);",
		teardown: "return acc;",
	}),

	"2. Parallel 2x (2 Independent Accumulators)": createRunner({
		context: { add, c },
		setup: "let a0 = 1, a1 = 2;",
		body: `
			a0 = add(a0, c);
			a1 = add(a1, c);
		`,
		teardown: "return a0 ^ a1;",
	}),

	"3. Parallel 4x (4 Independent Accumulators)": createRunner({
		context: { add, c },
		setup: "let a0 = 1, a1 = 2, a2 = 3, a3 = 4;",
		body: `
			a0 = add(a0, c);
			a1 = add(a1, c);
			a2 = add(a2, c);
			a3 = add(a3, c);
		`,
		teardown: "return a0 ^ a1 ^ a2 ^ a3;",
	}),

	"4. Parallel 8x (8 Independent Accumulators)": createRunner({
		context: { add, c },
		setup:
			"let a0 = 1, a1 = 2, a2 = 3, a3 = 4, a4 = 5, a5 = 6, a6 = 7, a7 = 8;",
		body: `
			a0 = add(a0, c);
			a1 = add(a1, c);
			a2 = add(a2, c);
			a3 = add(a3, c);
			a4 = add(a4, c);
			a5 = add(a5, c);
			a6 = add(a6, c);
			a7 = add(a7, c);
		`,
		teardown: "return a0 ^ a1 ^ a2 ^ a3 ^ a4 ^ a5 ^ a6 ^ a7;",
	}),

	"5. Outer Fixture (Int32Array In-Place Mutation)": createRunner({
		context: { add, c, r },
		setup: "r[0] = 1;",
		body: "r[0] = add(r[0], c);",
		teardown: "return r[0];",
	}),

	"6. Array Reduction (Int32Array Buffer Walk)": createRunner({
		context: { add, buf },
		setup: "let acc = 1, idx = 0;",
		body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return acc;",
	}),

	"7. Inline Operator (((a|0) + c)|0 Baseline)": createRunner({
		context: { c },
		setup: "let acc = 1;",
		body: "acc = ((acc | 0) + c) | 0;",
		teardown: "return acc;",
	}),
};

compare("i32.add: Execution Pattern Showdown", ops, {
	rounds: 5,
	iters: 2e7,
});
