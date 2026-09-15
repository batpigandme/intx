"use strict";

const { bench, createRunner } = require("#microbe");
const i32 = require("#i32");

/**
 * EXPERIMENT 4: Theoretical Peak (Reg-to-Reg) & Multi-Accumulator ILP
 *
 * Objectives:
 * 1. Formulate and compare independent multi-accumulator streams (1x, 2x, 4x, 8x).
 * 2. Compare how Instruction-Level Parallelism (ILP) saturates across distinct hardware units:
 *    - Single-cycle ALU: add, rotl, clz
 *    - Pipelined Multiplier: mul (Math.imul, ~3-cycle latency, 1-cycle throughput)
 *    - Hardware Divider: div (idivl, ~10-30 cycles latency, non-pipelined)
 */

const c = 0x9e3779b9 | 0;
const k = 13 | 0;

const addOps = {
	"i32.add 1x (Latency Bound)": createRunner({
		context: { add: i32.add, c },
		setup: "let a0 = 1;",
		loop: "a0 = add(a0, c);",
		teardown: "return a0;",
	}),

	"i32.add 2x (2 Streams)": createRunner({
		context: { add: i32.add, c },
		setup: "let a0 = 1, a1 = 2;",
		loop: `
			a0 = add(a0, c);
			a1 = add(a1, c);
		`,
		teardown: "return a0 ^ a1;",
	}),

	"i32.add 4x (4 Streams - Peak ALU)": createRunner({
		context: { add: i32.add, c },
		setup: "let a0 = 1, a1 = 2, a2 = 3, a3 = 4;",
		loop: `
			a0 = add(a0, c);
			a1 = add(a1, c);
			a2 = add(a2, c);
			a3 = add(a3, c);
		`,
		teardown: "return a0 ^ a1 ^ a2 ^ a3;",
	}),

	"i32.add 8x (8 Streams)": createRunner({
		context: { add: i32.add, c },
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
};

const mulOps = {
	"i32.mul 1x (Latency Bound)": createRunner({
		context: { mul: i32.mul, c },
		setup: "let a0 = 1;",
		loop: "a0 = mul(a0, c);",
		teardown: "return a0;",
	}),

	"i32.mul 2x (2 Streams)": createRunner({
		context: { mul: i32.mul, c },
		setup: "let a0 = 1, a1 = 2;",
		loop: `
			a0 = mul(a0, c);
			a1 = mul(a1, c);
		`,
		teardown: "return a0 ^ a1;",
	}),

	"i32.mul 4x (4 Streams - Pipelined Saturation)": createRunner({
		context: { mul: i32.mul, c },
		setup: "let a0 = 1, a1 = 2, a2 = 3, a3 = 4;",
		loop: `
			a0 = mul(a0, c);
			a1 = mul(a1, c);
			a2 = mul(a2, c);
			a3 = mul(a3, c);
		`,
		teardown: "return a0 ^ a1 ^ a2 ^ a3;",
	}),

	"i32.mul 8x (8 Streams)": createRunner({
		context: { mul: i32.mul, c },
		setup:
			"let a0 = 1, a1 = 2, a2 = 3, a3 = 4, a4 = 5, a5 = 6, a6 = 7, a7 = 8;",
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
};

const rotlOps = {
	"i32.rotl 1x (Latency Bound)": createRunner({
		context: { rotl: i32.rotl, k },
		setup: "let a0 = 0x12345678;",
		loop: "a0 = rotl(a0, k);",
		teardown: "return a0;",
	}),

	"i32.rotl 4x (4 Streams)": createRunner({
		context: { rotl: i32.rotl, k },
		setup:
			"let a0 = 0x12345678, a1 = 0x87654321, a2 = 0x13579bdf, a3 = 0x2468ace0;",
		loop: `
			a0 = rotl(a0, k);
			a1 = rotl(a1, k);
			a2 = rotl(a2, k);
			a3 = rotl(a3, k);
		`,
		teardown: "return a0 ^ a1 ^ a2 ^ a3;",
	}),
};

bench.suite("Exp 4A: i32.add ILP Stream Scaling", addOps, {
	rounds: 5,
	iters: 1e8,
	width: 100,
});

bench.suite("Exp 4B: i32.mul ILP Stream Scaling (Pipelined)", mulOps, {
	rounds: 5,
	iters: 1e8,
	width: 100,
});

bench.suite("Exp 4C: i32.rotl ILP Stream Scaling", rotlOps, {
	rounds: 5,
	iters: 1e8,
	width: 100,
});
