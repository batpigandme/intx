"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { bench, createRunner } = require("../index");
const { computeStats, getTCritical, getPercentile } = require("../stats");
const { calibrate } = require("../calibrate");

test("microbe: stats calculation and Student's t-distribution", () => {
	// Degrees of freedom checks
	assert.strictEqual(getTCritical(1), 12.706);
	assert.strictEqual(getTCritical(4), 2.776);
	assert.strictEqual(getTCritical(9), 2.262);
	assert.strictEqual(getTCritical(150), 1.96);

	// Percentile checks
	const sorted = [10, 20, 30, 40, 50];
	assert.strictEqual(getPercentile(sorted, 0.5), 30);
	assert.strictEqual(getPercentile(sorted, 0), 10);
	assert.strictEqual(getPercentile(sorted, 1), 50);

	// Sample stats computation
	const samples = [0.1, 0.1, 0.1, 0.1, 0.1];
	const iters = 1e7;
	const stats = computeStats(samples, iters);

	assert.strictEqual(stats.medianTime, 0.1);
	assert.strictEqual(stats.meanTime, 0.1);
	assert.strictEqual(stats.stddev, 0);
	assert.strictEqual(stats.moePercent, 0);
	assert.strictEqual(stats.outlierCount, 0);
	assert.strictEqual(stats.medianRate, 1e8);
});

test("microbe: stats with variance and outlier detection", () => {
	const samples = [0.1, 0.1, 0.105, 0.095, 0.5]; // 0.5 is an outlier
	const iters = 1e6;
	const stats = computeStats(samples, iters);

	assert.ok(stats.stddev > 0);
	assert.ok(stats.moe > 0);
	assert.ok(stats.moePercent > 0);
	assert.strictEqual(stats.outlierCount, 1);
});

test("microbe: dynamic calibration with calibrate()", () => {
	// Fast kernel (sub-nanosecond)
	const fastRunner = createRunner({
		setup: "let acc = 0;",
		loop: "acc = (acc + 1) | 0;",
		teardown: "return acc;",
	});

	const fastIters = calibrate(fastRunner, 50); // 50ms target
	assert.ok(
		fastIters >= 1e6,
		`Expected fast kernel iters >= 1e6, got ${fastIters}`,
	);

	// Slower kernel with simulated work
	const slowRunner = (iters) => {
		let acc = 0;
		for (let i = 0; i < iters; i++) {
			for (let j = 0; j < 100; j++) acc += j;
		}
		return acc;
	};

	const slowIters = calibrate(slowRunner, 20); // 20ms target
	assert.ok(
		slowIters < fastIters,
		"Slow kernel should have fewer iters than fast kernel",
	);
});

test("microbe: single bench with dynamic timing and manual iters", () => {
	const runner = createRunner({
		setup: "let acc = 0;",
		loop: "acc = (acc + 1) | 0;",
		teardown: "return acc;",
	});

	// Dynamic timing
	const resDynamic = bench("fast_kernel_dynamic", runner, {
		rounds: 3,
		time: 20,
		silent: true,
	});

	assert.ok(resDynamic.iters > 1000);
	assert.strictEqual(resDynamic.samples.length, 3);
	assert.ok(resDynamic.medianRate > 0);

	// Manual iters override
	const resManual = bench("fast_kernel_manual", runner, {
		rounds: 3,
		iters: 5000,
		silent: true,
	});

	assert.strictEqual(resManual.iters, 5000);
	assert.strictEqual(resManual.samples.length, 3);
});

test("microbe: suite with dynamic calibration and definition order", () => {
	const ops = {
		candidate_a: createRunner({
			setup: "let a = 1;",
			loop: "a = (a + 1) | 0;",
			teardown: "return a;",
		}),
		candidate_b: createRunner({
			setup: "let b = 2;",
			loop: "b = (b * 3) | 0;",
			teardown: "return b;",
		}),
	};

	const results = bench.suite("test_suite", ops, {
		rounds: 3,
		time: 20,
		silent: true,
	});

	assert.strictEqual(results.length, 2);
	assert.strictEqual(results[0].name, "candidate_a");
	assert.strictEqual(results[1].name, "candidate_b");
	assert.ok(results[0].iters > 0);
	assert.ok(results[1].iters > 0);
});

test("microbe: suite.rank sorts results correctly", () => {
	const ops = {
		slow: (iters, start, stop) => {
			start();
			let acc = 0;
			for (let i = 0; i < iters; i++) {
				for (let j = 0; j < 50; j++) acc = (acc + j) | 0;
			}
			stop();
			return acc;
		},
		fast: createRunner({
			setup: "let a = 0;",
			loop: "a = (a + 1) | 0;",
			teardown: "return a;",
		}),
	};

	const ranked = bench.suite.rank("rank_test", ops, {
		rounds: 3,
		iters: 10000,
		order: "median",
		silent: true,
	});

	assert.strictEqual(ranked.length, 2);
	assert.strictEqual(ranked[0].name, "fast");
	assert.strictEqual(ranked[1].name, "slow");
	assert.ok(ranked[0].medianRate > ranked[1].medianRate);
});

test("microbe: suite with isolated subprocess forking (fork: true)", () => {
	const ops = {
		fork_a: createRunner({
			setup: "let a = 1;",
			loop: "a = (a + 1) | 0;",
			teardown: "return a;",
		}),
		fork_b: createRunner({
			setup: "let b = 2;",
			loop: "b = (b ^ 3) | 0;",
			teardown: "return b;",
		}),
	};

	const results = bench.suite("fork_test_suite", ops, {
		rounds: 2,
		time: 20,
		fork: true,
		silent: true,
	});

	assert.strictEqual(results.length, 2);
	assert.strictEqual(results[0].name, "fork_a");
	assert.strictEqual(results[1].name, "fork_b");
	assert.strictEqual(results[0].samples.length, 2);
	assert.strictEqual(results[1].samples.length, 2);
	assert.ok(results[0].medianRate > 0);
	assert.ok(results[1].medianRate > 0);
});
