"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const i32 = require("./index.js");

test("i32: arithmetic and hardware operations", () => {
	// add (prevents float64 promotion / preserves modular arithmetic)
	assert.equal(i32.add(1, 2), 3);
	assert.equal(i32.add(0x7fffffff, 1), -2147483648);
	assert.equal(i32.add(-1, 1), 0);
	assert.equal(i32.add(0xffffffff, 1), 0);

	// sub (prevents float64 promotion / preserves modular arithmetic)
	assert.equal(i32.sub(10, 3), 7);
	assert.equal(i32.sub(-2147483648, 1), 0x7fffffff);
	assert.equal(i32.sub(0, 1), -1);

	// mul (Math.imul wrapper)
	assert.equal(i32.mul(3, 4), 12);
	assert.equal(i32.mul(0x7fffffff, 2), -2);
	assert.equal(i32.mul(-1, -1), 1);
	assert.equal(i32.mul(-2147483648, 1), -2147483648);

	// div (hardware idivl semantics)
	assert.equal(i32.div(10, 3), 3);
	assert.equal(i32.div(-10, 3), -3);
	assert.equal(i32.div(10, -3), -3);
	assert.equal(i32.div(-10, -3), 3);
	assert.equal(i32.div(-2147483648, -1), -2147483648);

	// mod (hardware idivl remainder semantics)
	assert.equal(i32.mod(10, 3), 1);
	assert.equal(i32.mod(-10, 3), -1);
	assert.equal(i32.mod(10, -3), 1);
	assert.equal(i32.mod(-10, -3), -1);

	// divmod (simultaneous quotient and remainder)
	const out = new Int32Array(2);
	i32.divmod(10, 3, out);
	assert.equal(out[0], 3);
	assert.equal(out[1], 1);

	i32.divmod(-10, 3, out);
	assert.equal(out[0], -3);
	assert.equal(out[1], -1);

	i32.divmod(10, -3, out);
	assert.equal(out[0], -3);
	assert.equal(out[1], 1);

	i32.divmod(-10, -3, out);
	assert.equal(out[0], 3);
	assert.equal(out[1], -1);

	i32.divmod(-2147483648, -1, out);
	assert.equal(out[0], -2147483648);
	assert.equal(out[1], 0);

	// clz (Math.clz32 wrapper)
	assert.equal(i32.clz(0), 32);
	assert.equal(i32.clz(1), 31);
	assert.equal(i32.clz(0x80000000 | 0), 0);
	assert.equal(i32.clz(-1), 0);
});

test("i32: rotate operations", () => {
	// rotl
	assert.equal(i32.rotl(1, 1), 2);
	assert.equal(i32.rotl(0x80000000 | 0, 1), 1);
	assert.equal(i32.rotl(0x12345678, 13), 0x8acf0246 | 0);

	// rotr
	assert.equal(i32.rotr(1, 1), 0x80000000 | 0);
	assert.equal(i32.rotr(2, 1), 1);
	assert.equal(i32.rotr(0x8acf0246 | 0, 13), 0x12345678);
});
