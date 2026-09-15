"use strict";

const { bench, createRunner } = require("#microbe");
const { randomI32 } = require("#utils");
const i32 = require("./index.js");

// 32-Bit Constants & Buffers
const c = 0x9e3779b9 | 0; // Golden ratio prime constant (-1640531527)
const d = 17 | 0; // Small divisor constant
const k = 13 | 0; // Rotation amount
const out = new Int32Array(2);

// 1,024-element L1 cached test vector buffer (avoids fixed-point lock and division decay)
const buf = new Int32Array(1024);
for (let i = 0; i < 1024; i++) {
	buf[i] = randomI32();
}

const ops = {
	add: createRunner({
		context: { add: i32.add, c },
		setup: "let acc = 1;",
		loop: "acc = add(acc, c);",
		teardown: "return acc;",
	}),

	sub: createRunner({
		context: { sub: i32.sub, c },
		setup: "let acc = 1;",
		loop: "acc = sub(acc, c);",
		teardown: "return acc;",
	}),

	mul: createRunner({
		context: { mul: i32.mul, c },
		setup: "let acc = 1;",
		loop: "acc = mul(acc, c);",
		teardown: "return acc;",
	}),

	div: createRunner({
		context: { div: i32.div, d, buf },
		setup: "let acc = 0, idx = 0;",
		loop: `
			acc = div(buf[idx], d);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return acc;",
	}),

	mod: createRunner({
		context: { mod: i32.mod, d, buf },
		setup: "let acc = 0, idx = 0;",
		loop: `
			acc = mod(buf[idx], d);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return acc;",
	}),

	divmod: createRunner({
		context: { divmod: i32.divmod, d, buf, out },
		setup: "let idx = 0;",
		loop: `
			divmod(buf[idx], d, out);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return out[0] ^ out[1];",
	}),

	rotl: createRunner({
		context: { rotl: i32.rotl, k },
		setup: "let acc = 0x12345678;",
		loop: "acc = rotl(acc, k);",
		teardown: "return acc;",
	}),

	rotr: createRunner({
		context: { rotr: i32.rotr, k },
		setup: "let acc = 0x12345678;",
		loop: "acc = rotr(acc, k);",
		teardown: "return acc;",
	}),

	clz: createRunner({
		context: { clz: i32.clz, c },
		setup: "let acc = 1;",
		loop: "acc = clz(acc ^ c);",
		teardown: "return acc;",
	}),
};

bench.suite.rank("i32: Intrinsic Scalar Operations Showdown", ops, {
	rounds: 5,
	iters: 1e7,
	width: 100,
});
