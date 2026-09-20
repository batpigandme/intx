"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const mulwideDelegate = require("./mulwide-delegate");
const inlinedLimb16 = require("./inlined-limb16");

function toBigInt(hi, lo) {
	return (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
}
const MASK_64_BIG = 0xffffffffffffffffn;

test("u64.mul: candidates verification vs BigInt oracle", () => {
	const outDelegate = new Uint32Array(2);
	const outInlined = new Uint32Array(2);

	const testVectors = [
		[0, 0, 0x12345678, 0x9abcdef0],
		[0, 1, 0x12345678, 0x9abcdef0],
		[0, 100, 0, 200],
		[1, 0, 0, 0x1000],
		[0x7fffffff, 0x80000000, 2, 3],
		[0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff],
		[0x12345678, 0x9abcdef0, 0xfedcba98, 0x76543210],
	];

	for (const [ah, al, bh, bl] of testVectors) {
		mulwideDelegate(ah, al, bh, bl, outDelegate);
		inlinedLimb16(ah, al, bh, bl, outInlined);
		assert.equal(outDelegate[0], outInlined[0]);
		assert.equal(outDelegate[1], outInlined[1]);

		const bigA = toBigInt(ah, al);
		const bigB = toBigInt(bh, bl);
		const expected = (bigA * bigB) & MASK_64_BIG;
		assert.equal(toBigInt(outDelegate[0], outDelegate[1]), expected);
	}

	for (let i = 0; i < 5000; i++) {
		const ah = (Math.random() * 0x100000000) >>> 0;
		const al = (Math.random() * 0x100000000) >>> 0;
		const bh = (Math.random() * 0x100000000) >>> 0;
		const bl = (Math.random() * 0x100000000) >>> 0;

		mulwideDelegate(ah, al, bh, bl, outDelegate);
		inlinedLimb16(ah, al, bh, bl, outInlined);
		assert.equal(outDelegate[0], outInlined[0]);
		assert.equal(outDelegate[1], outInlined[1]);

		const bigA = toBigInt(ah, al);
		const bigB = toBigInt(bh, bl);
		const expected = (bigA * bigB) & MASK_64_BIG;
		assert.equal(toBigInt(outDelegate[0], outDelegate[1]), expected);
	}
});
