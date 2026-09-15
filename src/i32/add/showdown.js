"use strict";

const { bench, createRunner } = require("#microbe");
const add = require("./index.js");

// 32-Bit Constants & Buffers
const c = 0x9e3779b9 | 0;
const r = new Int32Array(1);
const buf = new Int32Array(1024);
for (let i = 0; i < 1024; i++) buf[i] = (i * 0x45d9f3b + 1) | 0;

const ops = {
	"Serialized (1x Latency Bound)": createRunner({
		context: { add, c },
		setup: "let acc = 1;",
		loop: "acc = add(acc, c);",
		teardown: "return acc;",
	}),

	"Parallel 2x (2 Independent Accumulators)": createRunner({
		context: { add, c },
		setup: "let a0 = 1, a1 = 2;",
		loop: `
			a0 = add(a0, c);
			a1 = add(a1, c);
		`,
		teardown: "return a0 ^ a1;",
	}),

	"Parallel 4x (4 Independent Accumulators)": createRunner({
		context: { add, c },
		setup: "let a0 = 1, a1 = 2, a2 = 3, a3 = 4;",
		loop: `
			a0 = add(a0, c);
			a1 = add(a1, c);
			a2 = add(a2, c);
			a3 = add(a3, c);
		`,
		teardown: "return a0 ^ a1 ^ a2 ^ a3;",
	}),

	"Parallel 8x (8 Independent Accumulators)": createRunner({
		context: { add, c },
		setup:
			"let a0 = 1, a1 = 2, a2 = 3, a3 = 4, a4 = 5, a5 = 6, a6 = 7, a7 = 8;",
		loop: `
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

	"Outer Fixture (Int32Array In-Place Mutation)": createRunner({
		context: { add, c, r },
		setup: "r[0] = 1;",
		loop: "r[0] = add(r[0], c);",
		teardown: "return r[0];",
	}),

	"Array Reduction (Int32Array Buffer Walk)": createRunner({
		context: { add, buf },
		setup: "let acc = 1, idx = 0;",
		loop: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return acc;",
	}),

	"Inline Operator (((a|0) + c)|0 Baseline)": createRunner({
		context: { c },
		setup: "let acc = 1;",
		loop: "acc = ((acc | 0) + c) | 0;",
		teardown: "return acc;",
	}),
};

bench.suite("i32.add: Execution Pattern Suite", ops, {
	rounds: 5,
	iters: 1e8,
});
