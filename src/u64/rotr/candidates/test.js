"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const branchless = require("./branchless");
const branched = require("./branched");

function toBigInt(hi, lo) {
	return (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
}
const MASK_64_BIG = 0xffffffffffffffffn;

test("u64.rotr: candidates verification vs BigInt oracle", () => {
	const outBranchless = new Uint32Array(2);
	const outBranched = new Uint32Array(2);

	const shifts = [0, 1, 15, 16, 31, 32, 33, 48, 63, 64, 65];
	const ah = 0x12345678;
	const al = 0x9abcdef0;

	for (const s of shifts) {
		const s64 = BigInt(s & 63);
		const bigA = toBigInt(ah, al);

		branchless(ah, al, s, outBranchless);
		branched(ah, al, s, outBranched);
		assert.equal(outBranchless[0], outBranched[0]);
		assert.equal(outBranchless[1], outBranched[1]);

		const expected =
			s64 === 0n ? bigA : ((bigA >> s64) | (bigA << (64n - s64))) & MASK_64_BIG;
		assert.equal(toBigInt(outBranchless[0], outBranchless[1]), expected);
	}

	for (let i = 0; i < 5000; i++) {
		const ah = (Math.random() * 0x100000000) >>> 0;
		const al = (Math.random() * 0x100000000) >>> 0;
		const s = (Math.random() * 128) | 0;
		const s64 = BigInt(s & 63);

		branchless(ah, al, s, outBranchless);
		branched(ah, al, s, outBranched);
		assert.equal(outBranchless[0], outBranched[0]);
		assert.equal(outBranchless[1], outBranched[1]);

		const bigA = toBigInt(ah, al);
		const expected =
			s64 === 0n ? bigA : ((bigA >> s64) | (bigA << (64n - s64))) & MASK_64_BIG;
		assert.equal(toBigInt(outBranchless[0], outBranchless[1]), expected);
	}
});
