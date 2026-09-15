"use strict";

const { bench, createRunner } = require("#microbe");
const { randomI32 } = require("#utils");
const i32 = require("#i32");

/**
 * EXPERIMENT 5: Read-Only Buffer Walk: BCE vs Non-BCE & Buffer Sizing
 *
 * Objectives:
 * 1. Compare Bounds Check Elimination (BCE) vs Non-BCE indexing patterns.
 * 2. Compare 1 KB (256 elements, & 0xff mask) vs 4 KB (1024 elements, & 0x3ff mask) vs 512 B (& 0x7f).
 * 3. Quantify the penalty of modulo vs bitmask indexing.
 */

// 1 KB Buffer (256 Int32 elements)
const buf256 = new Int32Array(256);
for (let i = 0; i < 256; i++) buf256[i] = randomI32();

// 4 KB Buffer (1024 Int32 elements)
const buf1024 = new Int32Array(1024);
for (let i = 0; i < 1024; i++) buf1024[i] = randomI32();

// 512 B Buffer (128 Int32 elements)
const buf128 = new Int32Array(128);
for (let i = 0; i < 128; i++) buf128[i] = randomI32();

const ops = {
	"1. BCE: 1 KB (256 elements, mask & 0xff)": createRunner({
		context: { add: i32.add, buf: buf256 },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) & 0xff;
		`,
		teardown: "return acc;",
	}),

	"2. BCE: 4 KB (1024 elements, mask & 0x3ff)": createRunner({
		context: { add: i32.add, buf: buf1024 },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) & 0x3ff;
		`,
		teardown: "return acc;",
	}),

	"3. BCE: 512 B (128 elements, mask & 0x7f)": createRunner({
		context: { add: i32.add, buf: buf128 },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) & 0x7f;
		`,
		teardown: "return acc;",
	}),

	"4. Non-BCE: Modulo Indexing ((idx + 1) % 256)": createRunner({
		context: { add: i32.add, buf: buf256 },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) % 256;
		`,
		teardown: "return acc;",
	}),

	"5. Non-BCE: Modulo Non-Power-of-Two ((idx + 1) % 250)": createRunner({
		context: { add: i32.add, buf: buf256 },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) % 250;
		`,
		teardown: "return acc;",
	}),

	"6. Non-BCE: Branching Reset (idx >= 256 ? 0 : idx)": createRunner({
		context: { add: i32.add, buf: buf256 },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = add(acc, buf[idx]);
			idx = (idx + 1) | 0;
			if (idx === 256) idx = 0;
		`,
		teardown: "return acc;",
	}),
};

bench.suite("Exp 5: Read-Only Buffer Walk: BCE vs Non-BCE & Sizing", ops, {
	rounds: 5,
	iters: 1e8,
});
