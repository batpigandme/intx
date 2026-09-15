"use strict";

const { bench, createRunner } = require("#microbe");
const i32 = require("#i32");

/**
 * EXPERIMENT 7: Pure Loop Overhead & Calibration Techniques
 *
 * Objectives:
 * 1. Measure and isolate the raw loop control cost (counter increment, cmp, jmp).
 * 2. Compare empty loops vs minimal induction sinks vs simple arithmetic.
 * 3. Demonstrate subtraction of baseline overhead to obtain pure kernel latency.
 */

const c = 0x9e3779b9 | 0;
const buf = new Int32Array(256);
for (let i = 0; i < 256; i++) buf[i] = (i * 0x45d9f3b + 1) | 0;

const ops = {
	"1. Empty Loop (DLE Candidate)": createRunner({
		setup: "let acc = 0;",
		body: "",
		teardown: "return acc;",
	}),

	"2. Minimal Opaque Induction Sink (acc ^= (i & mask))": createRunner({
		context: { mask: 0x7fffffff },
		setup: "let acc = 0;",
		body: "acc = (acc ^ (i & mask)) | 0;",
		teardown: "return acc;",
	}),

	"3. Minimal Register In-Place Step (acc = (acc + 1) | 0)": createRunner({
		setup: "let acc = 0;",
		body: "acc = (acc + 1) | 0;",
		teardown: "return acc;",
	}),

	"4. Read-Only Buffer Walk Baseline (acc ^= buf[idx])": createRunner({
		context: { buf },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = (acc ^ buf[idx]) | 0;
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return acc;",
	}),

	"5. Target Operation: i32.add (acc = add(acc, c))": createRunner({
		context: { add: i32.add, c },
		setup: "let acc = 1;",
		body: "acc = add(acc, c);",
		teardown: "return acc;",
	}),

	"6. Target Operation: i32.add on Buffer (acc = add(acc, buf[idx]))":
		createRunner({
			context: { add: i32.add, buf },
			setup: "let acc = 0, idx = 0;",
			body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) & 0xff;
		`,
			teardown: "return acc;",
		}),
};

bench.suite("Exp 7: Pure Loop Overhead & Calibration Baseline", ops, {
	rounds: 5,
	iters: 1e8,
});
