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
	assert.equal(intx.i32.mul(-2147483648, -1), -2147483648);

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
