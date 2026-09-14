"use strict";

const { bench } = require("#microbe");
const mul = require("./index.js");

// Monomorphic JIT runner for u32.mul: mul(a, b)
// const r = [0];
const r = new Uint32Array(1);

const runner = bench.createRunner({
	name: "u32_mul",
	context: { mul, r, a: 0xdeadbeef },
	setup: "r[0] = 1;",
	body: "r[0] = mul(r[0], a);",
	teardown: "return r[0];",
});

bench("u32.mul", runner, {
	rounds: 5,
	iters: 1e8,
});
