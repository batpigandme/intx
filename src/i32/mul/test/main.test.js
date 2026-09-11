"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mul = require("../index.js");
const { randomI32 } = require("#test/utils.js");

function oracle(a, b) {
	return Number(BigInt.asIntN(32, BigInt(a) * BigInt(b)));
}

test("i32.mul: edge cases and fuzz testing", () => {
	const edgeCases = [
		[0, 0],
		[1, 1],
		[-1, -1],
		[-1, 5],
		[-1, 0],
		[0x7fffffff, 2],
		[-2147483648, 1],
		[-2147483648, -1],
		[-2147483648, 0],
		[0x7fffffff, 0x7fffffff],
		[-2147483648, -2147483648],
		[0x12345678, -0x12345678],
		[0x12345678, 0x76543210],
	];

	for (const [a, b] of edgeCases) {
		const expected = oracle(a, b);
		const actual = mul(a, b);
		assert.equal(actual, expected, `i32.mul failed on edge case (${a}, ${b})`);
	}

	for (let i = 0; i < 100000; i++) {
		const a = randomI32();
		const b = randomI32();
		const expected = oracle(a, b);
		const actual = mul(a, b);
		assert.equal(
			actual,
			expected,
			`i32.mul failed on random fuzz (${a}, ${b})`,
		);
	}
});
