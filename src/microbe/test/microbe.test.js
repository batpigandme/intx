"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { bench, createRunner, presets } = require("../index");
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
		dur: 20,
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
		dur: 20,
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
		slow: (iters, tic, toc) => {
			tic();
			let acc = 0;
			for (let i = 0; i < iters; i++) {
				for (let j = 0; j < 50; j++) acc = (acc + j) | 0;
			}
			toc();
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

test("microbe: presets export and configuration validation", () => {
	assert.ok(presets?.short && presets.medium && presets.long);

	// Short preset assertions
	assert.strictEqual(presets.short.mode, "sequential");
	assert.strictEqual(presets.short.dur, 40);
	assert.strictEqual(presets.short.prime, false);
	assert.strictEqual(presets.short.cooldown, 0);
	assert.ok(presets.short.pause > 0);

	// Medium preset assertions
	assert.strictEqual(presets.medium.mode, "sequential");
	assert.strictEqual(presets.medium.dur, 50);
	assert.strictEqual(presets.medium.cooldown, 0);
	assert.ok(presets.medium.pause > 0);

	// Long preset assertions
	assert.strictEqual(presets.long.mode, "sequential");
	assert.strictEqual(presets.long.dur, 50);
	assert.strictEqual(presets.long.prime, true);
	assert.strictEqual(presets.long.cooldown, 0);
	assert.ok(presets.long.pause > 0);
});

test("microbe: sequential mode runs runners consecutively without shuffling", () => {
	const executionTrace = [];
	const ops = {
		candidate_1: (_iters, tic, toc) => {
			executionTrace.push("candidate_1");
			tic();
			toc();
		},
		candidate_2: (_iters, tic, toc) => {
			executionTrace.push("candidate_2");
			tic();
			toc();
		},
	};

	// 1 warmup + 3 rounds each in sequential mode
	bench.suite("test_sequential", ops, {
		...presets.short,
		rounds: 3,
		iters: 10,
		pause: 0,
		silent: true,
	});

	// candidate_1 should run 4 times before candidate_2 runs 4 times
	assert.deepStrictEqual(executionTrace, [
		"candidate_1",
		"candidate_1",
		"candidate_1",
		"candidate_1",
		"candidate_2",
		"candidate_2",
		"candidate_2",
		"candidate_2",
	]);
});

test("microbe: suite and rank accept preset option objects", () => {
	const ops = {
		a: createRunner({
			setup: "let x = 0;",
			loop: "x = (x + 1) | 0;",
			teardown: "return x;",
		}),
		b: createRunner({
			setup: "let y = 0;",
			loop: "y = (y + 2) | 0;",
			teardown: "return y;",
		}),
	};

	const suiteRes = bench.suite("test_preset_obj", ops, {
		...presets.short,
		rounds: 2,
		dur: 10,
		silent: true,
	});
	assert.strictEqual(suiteRes.length, 2);

	const rankRes = bench.suite.rank("test_rank_obj", ops, {
		...presets.short,
		rounds: 2,
		dur: 10,
		silent: true,
	});
	assert.strictEqual(rankRes.length, 2);
});

test("microbe: pre-sample priming executes untimed pass", () => {
	let callCount = 0;
	const ops = {
		primed_a: (_iters, tic, toc) => {
			callCount++;
			tic();
			toc();
		},
		primed_b: (_iters, tic, toc) => {
			callCount++;
			tic();
			toc();
		},
	};

	// 2 runners, 2 rounds each.
	// With prime: true:
	// Warmup: 1 call per runner (2 calls)
	// Round 1: 1 prime + 1 sample per runner (4 calls)
	// Round 2: 1 prime + 1 sample per runner (4 calls)
	// Total = 2 + 4 + 4 = 10 calls
	bench.suite("test_prime_calls", ops, {
		mode: "sequential",
		rounds: 2,
		iters: 100,
		prime: true,
		pause: 0,
		silent: true,
	});

	assert.strictEqual(callCount, 10);
});

test("microbe: options parameter defaults to presets.medium when omitted", () => {
	const ops = {
		c1: createRunner({ loop: "let a = 1 + 1;" }),
		c2: createRunner({ loop: "let b = 2 * 2;" }),
	};

	// bench.suite with options omitted
	const suiteRes = bench.suite("test_omitted_suite", ops, { silent: true });
	assert.strictEqual(suiteRes[0].rounds, presets.medium.rounds); // 10 rounds

	// bench.suite.rank with options omitted
	const rankRes = bench.suite.rank("test_omitted_rank", ops, { silent: true });
	assert.strictEqual(rankRes[0].rounds, presets.medium.rounds); // 10 rounds

	// single bench with options omitted
	const benchRes = bench("test_omitted_bench", ops.c1, { silent: true });
	assert.strictEqual(benchRes.rounds, presets.medium.rounds); // 10 rounds
});

test("microbe: shuffled mode defaults prime to true when unspecified", () => {
	let callCount = 0;
	const ops = {
		s1: (_iters, tic, toc) => {
			callCount++;
			tic();
			toc();
		},
		s2: (_iters, tic, toc) => {
			callCount++;
			tic();
			toc();
		},
	};

	// 2 runners, 2 rounds each in shuffled mode with prime unspecified:
	// Warmup: 1 call per runner (2 calls)
	// Round 1: 1 prime + 1 sample per runner (4 calls)
	// Round 2: 1 prime + 1 sample per runner (4 calls)
	// Total = 10 calls
	bench.suite("test_shuffled_default_prime", ops, {
		mode: "shuffled",
		rounds: 2,
		iters: 100,
		pause: 0,
		silent: true,
	});
	assert.strictEqual(callCount, 10);

	// Explicit prime: false should be respected
	callCount = 0;
	bench.suite("test_shuffled_explicit_no_prime", ops, {
		mode: "shuffled",
		rounds: 2,
		iters: 100,
		prime: false,
		pause: 0,
		silent: true,
	});
	// Warmup: 2 calls, Round 1: 2 calls, Round 2: 2 calls = 6 calls total
	assert.strictEqual(callCount, 6);
});
