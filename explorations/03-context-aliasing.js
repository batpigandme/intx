"use strict";

const { bench, createRunner } = require("#microbe");
const i32 = require("#i32");

/**
 * EXPERIMENT 3: Context Variable Aliasing in Local Scope
 *
 * Objectives:
 * 1. Compare accessing closure variables directly (`context: { c }` -> `body: add(acc, c)`)
 *    vs aliasing them into local `setup` variables (`setup: "const localC = c;"`).
 * 2. Test across scalar constants, function references, and TypedArray buffers.
 * 3. Verify whether TurboFan Loop Invariant Code Motion (LICM) renders manual aliasing redundant.
 */

const c = 0x9e3779b9 | 0;
const buf = new Int32Array(256);
for (let i = 0; i < 256; i++) buf[i] = (i * 0x45d9f3b + 1) | 0;

const ops = {
	"1. Scalar Constant: Direct Closure Access": createRunner({
		context: { add: i32.add, c },
		setup: "let acc = 1;",
		body: "acc = add(acc, c);",
		teardown: "return acc;",
	}),

	"2. Scalar Constant: Local 'const' Alias in setup": createRunner({
		context: { add: i32.add, c },
		setup: "const localC = c; let acc = 1;",
		body: "acc = add(acc, localC);",
		teardown: "return acc;",
	}),

	"3. Scalar Constant: Local 'let' Alias in setup": createRunner({
		context: { add: i32.add, c },
		setup: "let localC = c, acc = 1;",
		body: "acc = add(acc, localC);",
		teardown: "return acc;",
	}),

	"4. Function Ref: Direct Closure Access": createRunner({
		context: { add: i32.add, c },
		setup: "let acc = 1;",
		body: "acc = add(acc, c);",
		teardown: "return acc;",
	}),

	"5. Function Ref: Local 'const' Alias in setup": createRunner({
		context: { add: i32.add, c },
		setup: "const localAdd = add; let acc = 1;",
		body: "acc = localAdd(acc, c);",
		teardown: "return acc;",
	}),

	"6. Buffer Ref: Direct Closure Access": createRunner({
		context: { add: i32.add, buf },
		setup: "let acc = 1, idx = 0;",
		body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return acc;",
	}),

	"7. Buffer Ref: Local 'const' Alias in setup": createRunner({
		context: { add: i32.add, buf },
		setup: "const localBuf = buf; let acc = 1, idx = 0;",
		body: `
			acc = add(acc, localBuf[idx]);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return acc;",
	}),
};

bench.suite("Exp 3: Context Variable Direct Access vs Local Aliasing", ops, {
	rounds: 5,
	iters: 1e8,
});
