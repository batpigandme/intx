"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const wmul = require("../index.js");
const oracle = require("../candidates/bigint-literal-mask");
const { randomU32 } = require("#test/utils.js");

test("u32.wmul: main export edge cases and fuzz testing", () => {
	const edgeCases = [
		[0, 0],
		[1, 1],
		[0xffffffff, 0],
		[0, 0xffffffff],
		[0xffffffff, 1],
		[0xffffffff, 0xffffffff],
		[0x80000000, 0x80000000],
		[0xdeadbeef, 0x8badf00d],
		[0x12345678, 0x9abcdef0],
		[0x55555555, 0xaaaaaaaa],
	];

	const expected = new Uint32Array(2);
	const actual = new Uint32Array(2);

	// 1. Edge cases
	for (const [a, b] of edgeCases) {
		oracle(a, b, expected);
		wmul(a, b, actual);
		assert.deepEqual(
			Array.from(actual),
			Array.from(expected),
			`u32.wmul failed on edge case (${a.toString(16)}, ${b.toString(16)})`,
		);
	}

	// 2. Random fuzz testing (100,000 random inputs)
	for (let i = 0; i < 100000; i++) {
		const a = randomU32();
		const b = randomU32();
		oracle(a, b, expected);
		wmul(a, b, actual);
		assert.deepEqual(
			Array.from(actual),
			Array.from(expected),
			`u32.wmul failed on random fuzz (${a.toString(16)}, ${b.toString(16)})`,
		);
	}
});
