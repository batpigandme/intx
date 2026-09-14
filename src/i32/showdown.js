"use strict";

const { bench } = require("#microbe");
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
	add: bench.createRunner({
		context: { add: i32.add, c },
		setup: "let acc = 1;",
		body: "acc = add(acc, c);",
		teardown: "return acc;",
	}),

	sub: bench.createRunner({
		context: { sub: i32.sub, c },
		setup: "let acc = 1;",
		body: "acc = sub(acc, c);",
		teardown: "return acc;",
	}),

	mul: bench.createRunner({
		context: { mul: i32.mul, c },
		setup: "let acc = 1;",
		body: "acc = mul(acc, c);",
		teardown: "return acc;",
	}),

	div: bench.createRunner({
		context: { div: i32.div, d, buf },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = div(buf[idx], d);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return acc;",
	}),

	mod: bench.createRunner({
		context: { mod: i32.mod, d, buf },
		setup: "let acc = 0, idx = 0;",
		body: `
			acc = mod(buf[idx], d);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return acc;",
	}),

	divmod: bench.createRunner({
		context: { divmod: i32.divmod, d, buf, out },
		setup: "let idx = 0;",
		body: `
			divmod(buf[idx], d, out);
			idx = (idx + 1) & 1023;
		`,
		teardown: "return out[0] ^ out[1];",
	}),

	rotl: bench.createRunner({
		context: { rotl: i32.rotl, k },
		setup: "let acc = 0x12345678;",
		body: "acc = rotl(acc, k);",
		teardown: "return acc;",
	}),

	rotr: bench.createRunner({
		context: { rotr: i32.rotr, k },
		setup: "let acc = 0x12345678;",
		body: "acc = rotr(acc, k);",
		teardown: "return acc;",
	}),

	clz: bench.createRunner({
		context: { clz: i32.clz, c },
		setup: "let acc = 1;",
		body: "acc = clz(acc ^ c);",
		teardown: "return acc;",
	}),
};

bench.suite.rank("i32: Intrinsic Scalar Operations Showdown", ops, {
	rounds: 5,
	iters: 1e7,
});
