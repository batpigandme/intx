"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const bytecode = require("../index");
const mul = require("../../../u32/mul");
const { LOW_16 } = require("../../../const");

test("bytecode.analyze extracts metrics for u32.mul", () => {
	const result = bytecode.analyze(mul);

	assert.ok(typeof result.bytes === "number", "bytes must be a number");
	assert.ok(result.bytes > 0, "bytes must be positive");
	assert.equal(
		result.isSmall,
		true,
		"u32.mul should qualify as small boosted leaf function (<= 27B)",
	);
	assert.equal(result.status, "SMALL (Boosted)");
	assert.ok(result.instructionCount > 0, "must parse instructions");
	assert.ok(Array.isArray(result.instructions), "instructions must be array");
});

test("bytecode.compare handles multiple candidates with closures and ad-hoc functions", () => {
	const shift = 16;
	const candDirect = (a, b) => Math.imul(a, b) >>> 0;
	const candClosure = (a) => ((a >>> shift) & LOW_16) | 0;
	const candRedundant = (a, b) => {
		a >>>= 0;
		b >>>= 0;
		return Math.imul(a, b) >>> 0;
	};

	const results = bytecode.compare(
		"Test Multi-Candidate Comparison",
		{
			candDirect,
			candClosure,
			candRedundant,
		},
		{ silent: true },
	);

	assert.equal(results.length, 3);
	assert.equal(results[0].name, "candDirect");
	assert.equal(results[1].name, "candClosure");
	assert.equal(results[2].name, "candRedundant");

	assert.ok(results[0].bytes > 0);
	assert.ok(results[1].bytes > 0);
	assert.ok(
		results[2].bytes > results[0].bytes,
		"redundant candidate should have larger bytecode",
	);
});

test("bytecode.compare.rank sorts candidates ascending by bytecode size", () => {
	const candFast = (a, b) => (a + b) | 0;
	const candLarge = (a, b) => {
		a >>>= 0;
		b >>>= 0;
		const x = (a + b) | 0;
		const y = (a ^ b) | 0;
		return (x * y) | 0;
	};

	const results = bytecode.compare.rank(
		"Test Ranking",
		{
			candLarge,
			candFast,
		},
		{ silent: true },
	);

	assert.equal(results.length, 2);
	assert.equal(
		results[0].name,
		"candFast",
		"fast/smaller candidate should be ranked first",
	);
	assert.equal(
		results[1].name,
		"candLarge",
		"large candidate should be ranked second",
	);
	assert.ok(results[0].bytes <= results[1].bytes);
});

test("bytecode.compare gracefully isolates failing candidates", () => {
	const good = (a, b) => (a + b) | 0;
	const throwing = () => {
		throw new Error("Immediate invocation crash");
	};

	const results = bytecode.compare(
		"Test Failure Resilience",
		{
			good,
			throwing,
		},
		{ silent: true },
	);

	assert.equal(results.length, 2);
	assert.equal(results[0].name, "good");
	assert.ok(results[0].bytes > 0);

	// Even if a function throws on invocation, Ignition compiles the AST into bytecode before body runs
	assert.equal(results[1].name, "throwing");
	assert.ok(results[1].bytes > 0 || results[1].status === "ERROR");
});
