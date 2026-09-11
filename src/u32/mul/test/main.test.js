"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mul = require("../index.js");
const { randomU32 } = require("#test/utils.js");

function oracle(a, b) {
	return Number(BigInt.asUintN(32, BigInt(a >>> 0) * BigInt(b >>> 0)));
}

test("u32.mul: edge cases and fuzz testing", () => {
	const edgeCases = [
		[0, 0],
		[1, 1],
		[0xffffffff, 0],
		[0, 0xffffffff],
		[0xffffffff, 1],
		[0xffffffff, 0xffffffff],
		[0x80000000, 0x80000000],
		[0xdeadbeef, 0x8badf00d],
		[0x12345678, 0x87654321],
		[0x55555555, 0xaaaaaaaa],
	];

	for (const [a, b] of edgeCases) {
		const expected = oracle(a, b);
		const actual = mul(a, b);
		assert.equal(
			actual,
			expected,
			`u32.mul failed on edge case (${a.toString(16)}, ${b.toString(16)})`,
		);
	}

	for (let i = 0; i < 100000; i++) {
		const a = randomU32();
		const b = randomU32();
		const expected = oracle(a, b);
		const actual = mul(a, b);
		assert.equal(
			actual,
			expected,
			`u32.mul failed on random fuzz (${a.toString(16)}, ${b.toString(16)})`,
		);
	}
});
