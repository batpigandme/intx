"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const u64 = require("./index.js");

function toBigInt(hi, lo) {
	return (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
}

const MASK_64_BIG = 0xffffffffffffffffn;

test("u64: add and sub edge cases & carry/borrow", () => {
	const out = new Uint32Array(2);

	// add
	u64.add(0, 1, 0, 2, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 3);

	// low word overflow generates carry
	u64.add(0, 0xffffffff, 0, 1, out);
	assert.equal(out[0], 1);
	assert.equal(out[1], 0);

	// 64-bit overflow wraps around
	u64.add(0xffffffff, 0xffffffff, 0, 1, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 0);

	// sub
	u64.sub(0, 10, 0, 3, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 7);

	// low word borrow propagates to high word
	u64.sub(1, 0, 0, 1, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 0xffffffff);

	// 64-bit underflow wraps around
	u64.sub(0, 0, 0, 1, out);
	assert.equal(out[0], 0xffffffff);
	assert.equal(out[1], 0xffffffff);
});

test("u64: mul edge cases", () => {
	const out = new Uint32Array(2);

	// 0 * x = 0
	u64.mul(0, 0, 0x12345678, 0x9abcdef0, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 0);

	// 1 * x = x
	u64.mul(0, 1, 0x12345678, 0x9abcdef0, out);
	assert.equal(out[0], 0x12345678);
	assert.equal(out[1], 0x9abcdef0);

	// max * max mod 2^64: (2^64 - 1)^2 = 2^128 - 2*2^64 + 1 = 1 mod 2^64
	u64.mul(0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, out);
	assert.equal(out[0], 0);
	assert.equal(out[1], 1);

	// Arbitrary vector
	u64.mul(0x12345678, 0x9abcdef0, 0xfedcba98, 0x76543210, out);
	const bigA = toBigInt(0x12345678, 0x9abcdef0);
	const bigB = toBigInt(0xfedcba98, 0x76543210);
	const expected = (bigA * bigB) & MASK_64_BIG;
	assert.equal(toBigInt(out[0], out[1]), expected);
});

test("u64: shifts (shl, shr) edge cases", () => {
	const out = new Uint32Array(2);

	const shifts = [0, 1, 15, 16, 31, 32, 33, 48, 63, 64, 65];
	const ah = 0x12345678;
	const al = 0x9abcdef0;

	for (const s of shifts) {
		const s64 = BigInt(s & 63);
		const bigA = toBigInt(ah, al);

		// shl
		u64.shl(ah, al, s, out);
		const expectedShl = (bigA << s64) & MASK_64_BIG;
		assert.equal(toBigInt(out[0], out[1]), expectedShl);

		// shr
		u64.shr(ah, al, s, out);
		const expectedShr = (bigA >> s64) & MASK_64_BIG;
		assert.equal(toBigInt(out[0], out[1]), expectedShr);
	}
});

test("u64: rotates (rotl, rotr) edge cases", () => {
	const out = new Uint32Array(2);

	const shifts = [0, 1, 15, 16, 31, 32, 33, 48, 63, 64, 65];
	const ah = 0x12345678;
	const al = 0x9abcdef0;

	for (const s of shifts) {
		const s64 = BigInt(s & 63);
		const bigA = toBigInt(ah, al);

		// rotl
		u64.rotl(ah, al, s, out);
		const expectedRotl =
			s64 === 0n ? bigA : ((bigA << s64) | (bigA >> (64n - s64))) & MASK_64_BIG;
		assert.equal(toBigInt(out[0], out[1]), expectedRotl);

		// rotr
		u64.rotr(ah, al, s, out);
		const expectedRotr =
			s64 === 0n ? bigA : ((bigA >> s64) | (bigA << (64n - s64))) & MASK_64_BIG;
		assert.equal(toBigInt(out[0], out[1]), expectedRotr);
	}
});

test("u64: div, mod, divmod edge cases", () => {
	const outDivmod = new Uint32Array(4);
	const outDiv = new Uint32Array(2);
	const outMod = new Uint32Array(2);

	// Division by zero throws
	assert.throws(() => u64.divmod(1, 0, 0, 0, outDivmod), RangeError);
	assert.throws(() => u64.div(1, 0, 0, 0, outDiv), RangeError);
	assert.throws(() => u64.mod(1, 0, 0, 0, outMod), RangeError);

	// a < b -> q = 0, r = a
	u64.divmod(0, 10, 0, 20, outDivmod);
	assert.equal(outDivmod[0], 0);
	assert.equal(outDivmod[1], 0);
	assert.equal(outDivmod[2], 0);
	assert.equal(outDivmod[3], 10);

	// a == b -> q = 1, r = 0
	u64.divmod(0x12345678, 0x9abcdef0, 0x12345678, 0x9abcdef0, outDivmod);
	assert.equal(outDivmod[0], 0);
	assert.equal(outDivmod[1], 1);
	assert.equal(outDivmod[2], 0);
	assert.equal(outDivmod[3], 0);

	// 64-by-32 division
	u64.divmod(1, 0, 0, 2, outDivmod);
	assert.equal(outDivmod[0], 0);
	assert.equal(outDivmod[1], 0x80000000);
	assert.equal(outDivmod[2], 0);
	assert.equal(outDivmod[3], 0);

	u64.div(1, 0, 0, 2, outDiv);
	assert.equal(outDiv[0], 0);
	assert.equal(outDiv[1], 0x80000000);

	u64.mod(1, 0, 0, 2, outMod);
	assert.equal(outMod[0], 0);
	assert.equal(outMod[1], 0);
});

test("u64: fuzz testing against BigInt oracle (10,000 vectors)", () => {
	const out2 = new Uint32Array(2);
	const out4 = new Uint32Array(4);

	for (let i = 0; i < 10000; i++) {
		const ah = (Math.random() * 0x100000000) >>> 0;
		const al = (Math.random() * 0x100000000) >>> 0;
		let bh = (Math.random() * 0x100000000) >>> 0;
		let bl = (Math.random() * 0x100000000) >>> 0;
		if ((bh | bl) === 0) bl = 1;

		if (i % 10 === 0) bh = 0; // test 32-bit divisor

		const bigA = toBigInt(ah, al);
		const bigB = toBigInt(bh, bl);

		// add
		u64.add(ah, al, bh, bl, out2);
		assert.equal(toBigInt(out2[0], out2[1]), (bigA + bigB) & MASK_64_BIG);

		// sub
		u64.sub(ah, al, bh, bl, out2);
		assert.equal(toBigInt(out2[0], out2[1]), BigInt.asUintN(64, bigA - bigB));

		// mul
		u64.mul(ah, al, bh, bl, out2);
		assert.equal(toBigInt(out2[0], out2[1]), (bigA * bigB) & MASK_64_BIG);

		// div & mod & divmod
		u64.divmod(ah, al, bh, bl, out4);
		assert.equal(toBigInt(out4[0], out4[1]), bigA / bigB);
		assert.equal(toBigInt(out4[2], out4[3]), bigA % bigB);

		u64.div(ah, al, bh, bl, out2);
		assert.equal(toBigInt(out2[0], out2[1]), bigA / bigB);

		u64.mod(ah, al, bh, bl, out2);
		assert.equal(toBigInt(out2[0], out2[1]), bigA % bigB);

		// shifts & rotates
		const s = (Math.random() * 128) | 0;
		const s64 = BigInt(s & 63);

		u64.shl(ah, al, s, out2);
		assert.equal(toBigInt(out2[0], out2[1]), (bigA << s64) & MASK_64_BIG);

		u64.shr(ah, al, s, out2);
		assert.equal(toBigInt(out2[0], out2[1]), (bigA >> s64) & MASK_64_BIG);

		u64.rotl(ah, al, s, out2);
		const expectedRotl =
			s64 === 0n ? bigA : ((bigA << s64) | (bigA >> (64n - s64))) & MASK_64_BIG;
		assert.equal(toBigInt(out2[0], out2[1]), expectedRotl);

		u64.rotr(ah, al, s, out2);
		const expectedRotr =
			s64 === 0n ? bigA : ((bigA >> s64) | (bigA << (64n - s64))) & MASK_64_BIG;
		assert.equal(toBigInt(out2[0], out2[1]), expectedRotr);
	}
});
