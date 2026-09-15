"use strict";

const { bench, createRunner } = require("#microbe");
const i32 = require("#i32");

/**
 * EXPERIMENT 1: Dead Code Elimination (DCE), Constant Handling & Type Truncation
 *
 * Objectives:
 * 1. Demonstrate that pure, unused computations inside a loop are eliminated by TurboFan (DCE).
 * 2. Demonstrate that constants passed via `context` behave as dynamic runtime parameters.
 * 3. Discover the "Closure Coercion Tax": why uncoerced closure variables trigger generic Number checks,
 *    whereas functions with explicit `| 0` coercion (like `i32.add`) achieve full machine-code speed.
 */

const c = 0x9e3779b9 | 0;

const ops = {
	"DCE: Unused Pure Function (Math.imul(42, 17))": createRunner({
		setup: "let acc = 0;",
		loop: "Math.imul(42, 17);",
		teardown: "return acc;",
	}),

	"DCE: Static Invariant Expression ((42 * 17) | 0)": createRunner({
		setup: "let acc = 0;",
		loop: "acc = ((42 * 17) | 0);",
		teardown: "return acc;",
	}),

	"Kernel with Context Constant (i32.add(acc, c))": createRunner({
		context: { add: i32.add, c },
		setup: "let acc = 1;",
		loop: "acc = add(acc, c);",
		teardown: "return acc;",
	}),

	"Kernel with Inlined Literal (i32.add(acc, 0x9e3779b9))": createRunner({
		context: { add: i32.add },
		setup: "let acc = 1;",
		loop: "acc = add(acc, 0x9e3779b9 | 0);",
		teardown: "return acc;",
	}),

	"Inline Op with Literal (((acc|0) + -1640531527)|0)": createRunner({
		setup: "let acc = 1;",
		loop: "acc = ((acc | 0) + (-1640531527)) | 0;",
		teardown: "return acc;",
	}),

	"Inline Op with Coerced Context Var (((acc|0) + (c|0))|0)": createRunner({
		context: { c },
		setup: "let acc = 1;",
		loop: "acc = ((acc | 0) + (c | 0)) | 0;",
		teardown: "return acc;",
	}),

	"Inline Op with Uncoerced Context Var (((acc|0) + c)|0) [TRAP]": createRunner(
		{
			context: { c },
			setup: "let acc = 1;",
			loop: "acc = ((acc | 0) + c) | 0;",
			teardown: "return acc;",
		},
	),
};

bench.suite("Exp 1: Dead Code Elimination (DCE) & Closure Constants", ops, {
	rounds: 5,
	iters: 1e8,
	width: 100,
});
