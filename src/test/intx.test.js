"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const intx = require("../index.js");

test("intx: root exports and i32.mul / u32.mulwide", () => {
	assert.ok(intx.const, "intx.const should exist");
	assert.ok(intx.i32, "intx.i32 should exist");
	assert.ok(
		typeof intx.i32.mul === "function",
		"intx.i32.mul should be a function",
	);
	assert.equal(intx.i32.mul(0x12345678, 0x87654321), 1891143032);
	assert.equal(intx.i32.mul(-1, -1), 1);
	assert.equal(intx.i32.mul(-1, 5), -5);
	assert.equal(intx.i32.mul(0x7fffffff, 2), -2);
	assert.equal(intx.i32.mul(-2147483648, 1), -2147483648);
	assert.ok(
		typeof intx.i32.mulwide === "function",
		"intx.i32.mulwide should be a function",
	);

	const i32Out = new Int32Array(2);
	intx.i32.mulwide(-1, -1, i32Out);
	assert.equal(i32Out[0], 0);
	assert.equal(i32Out[1], 1);

	intx.i32.mulwide(-1, 5, i32Out);
	assert.equal(i32Out[0], -1);
	assert.equal(i32Out[1], -5);

	intx.i32.mulwide(0x7fffffff, 0x7fffffff, i32Out);
	assert.equal(i32Out[0], 0x3fffffff);
	assert.equal(i32Out[1], 1);

	intx.i32.mulwide(-2147483648, -2147483648, i32Out);
	assert.equal(i32Out[0], 0x40000000);
	assert.equal(i32Out[1], 0);

	intx.i32.mulwide(-2147483648, 2, i32Out);
	assert.equal(i32Out[0], -1);
	assert.equal(i32Out[1], 0);

	assert.ok(intx.u32, "intx.u32 should exist");
	assert.ok(
		typeof intx.u32.mul === "function",
		"intx.u32.mul should be a function",
	);
	assert.ok(
		typeof intx.u32.mulhi === "function",
		"intx.u32.mulhi should be a function",
	);
	assert.ok(
		typeof intx.u32.mulwide === "function",
		"intx.u32.mulwide should be a function",
	);

	assert.equal(intx.u32.mul(0x12345678, 0x87654321), 1891143032);
	assert.equal(intx.u32.mulhi(0xffffffff, 0xffffffff), 0xfffffffe);
	assert.equal(intx.u32.mulhi(0x12345678, 0x87654321), 0x09a0cd05);
	assert.equal(intx.u32.mulhi(0, 0xffffffff), 0);
	assert.equal(intx.u32.mulhi(0xffffffff, 1), 0);
	assert.equal(intx.u32.mulhi(0x80000000, 2), 1);

	const out = new Uint32Array(2);
	intx.u32.mulwide(0xffffffff, 0xffffffff, out);

	// (2^32 - 1)^2 = 2^64 - 2^33 + 1 -> hi: 0xfffffffe, lo: 0x00000001
	assert.equal(out[0], 0xfffffffe);
	assert.equal(out[1], 0x00000001);
});

test("intx.u64: namespace exports and operations", () => {
	assert.ok(intx.u64, "intx.u64 should exist");

	const ops = [
		"add",
		"sub",
		"mul",
		"div",
		"mod",
		"divmod",
		"shl",
		"shr",
		"rotl",
		"rotr",
	];
	for (const op of ops) {
		assert.equal(
			typeof intx.u64[op],
			"function",
			`intx.u64.${op} should be a function`,
		);
	}

	const out = new Uint32Array(2);
	intx.u64.add(0, 1, 0, 2, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 3);

	intx.u64.mul(0, 3, 0, 4, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 12);

	intx.u64.shl(0, 1, 1, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 2);

	intx.u64.rotr(0, 1, 1, out);
	assert.equal(out[0], 0x80000000);
	assert.equal(out[1], 0);
});
