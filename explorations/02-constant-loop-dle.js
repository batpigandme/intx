"use strict";

const { bench, createRunner } = require("#microbe");

/**
 * EXPERIMENT 2: Constant & Invariant Loops (Dead Loop Elimination / DLE)
 *
 * Objectives:
 * 1. Test whether loops that produce mathematically constant/invariant values trigger DLE or fold.
 * 2. Compare identity operations (acc + 0, acc ^ 0, acc * 1) vs active induction (acc + 1) vs non-linear recurrence.
 */

const ops = {
	"1. Empty Loop (Bare Induction i++)": createRunner({
		setup: "let acc = 0;",
		body: "",
		teardown: "return acc;",
	}),

	"2. Identity Addition (acc = (acc + 0) | 0)": createRunner({
		setup: "let acc = 0;",
		body: "acc = (acc + 0) | 0;",
		teardown: "return acc;",
	}),

	"3. Identity Bitwise XOR (acc = acc ^ 0)": createRunner({
		setup: "let acc = 0x12345678;",
		body: "acc = acc ^ 0;",
		teardown: "return acc;",
	}),

	"4. Fixed-Point Collapse (acc = acc & 0)": createRunner({
		setup: "let acc = 0x12345678;",
		body: "acc = acc & 0;",
		teardown: "return acc;",
	}),

	"5. Identity Multiplication (acc = Math.imul(acc, 1))": createRunner({
		setup: "let acc = 0x12345678;",
		body: "acc = Math.imul(acc, 1);",
		teardown: "return acc;",
	}),

	"6. Active Linear Induction (acc = (acc + 1) | 0)": createRunner({
		setup: "let acc = 0;",
		body: "acc = (acc + 1) | 0;",
		teardown: "return acc;",
	}),

	"7. Non-Linear Recurrence (acc = Math.imul(acc, 33) + 1 | 0)": createRunner({
		setup: "let acc = 1;",
		body: "acc = (Math.imul(acc, 33) + 1) | 0;",
		teardown: "return acc;",
	}),
};

bench.suite("Exp 2: Constant & Invariant Loops (DLE / Fold Behavior)", ops, {
	rounds: 5,
	iters: 1e8,
});
