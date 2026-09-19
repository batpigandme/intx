"use strict";

const { sample, loadPmu } = require("./timer");
const { sleep, gc } = require("#utils");
const { computePmuStats } = require("./stats");
const { calibrate } = require("./calibrate");
const {
	renderBench,
	writeProgress,
	clearProgress,
	hideCursor,
	showCursor,
} = require("./render");

function warmupRunner(runner, options = {}) {
	gc(50);

	const iters = options.iters;
	const dynamic = iters === undefined;
	const cooldown = options.cooldown ?? 0;

	const itersCount = dynamic ? calibrate(runner, options) : iters;
	const warmupSample = sample(runner, itersCount);

	if (cooldown > 0) {
		sleep(cooldown);
	}

	return {
		iters: itersCount,
		warmup: {
			cycles: warmupSample.cycles,
			instructions: warmupSample.instructions,
			ipc: warmupSample.ipc,
			iters: itersCount,
		},
		value: warmupSample.value,
	};
}

function sampleRound(runner, itersCount, options = {}) {
	// gc();

	const prime = options.prime ?? false;
	const cooldown = options.cooldown ?? 0;

	if (prime) {
		const pmu = loadPmu();
		const primeIters = Math.min(10000, Math.max(100, (itersCount * 0.01) | 0));
		runner(primeIters, pmu.tic, pmu.toc);
	}

	const res = sample(runner, itersCount);

	if (cooldown > 0) {
		sleep(cooldown);
	}

	return res;
}

function bench(title, runner, options = {}) {
	if (typeof runner !== "function") {
		throw new TypeError(
			`bench.cycles expected runner function as 2nd argument, received: ${typeof runner}`,
		);
	}

	const rounds = options.rounds ?? 30;
	const silent = !!options.silent;
	const render = options.render ?? true;
	const cursor = options.cursor ?? true;

	const isInteractive = !silent && !!process.stdout.isTTY;

	if (isInteractive && cursor) {
		hideCursor();
	}

	let result;
	try {
		if (isInteractive) {
			writeProgress(`🔥 Warming up & calibrating PMU ('${title}')... `);
		}

		const { iters, warmup, value: initValue } = warmupRunner(runner, options);

		let value = initValue;
		const samples = [];
		for (let r = 0; r < rounds; r++) {
			if (isInteractive) {
				writeProgress(`[Round ${r + 1}/${rounds}] Sampling '${title}'... `);
			}

			const res = sampleRound(runner, iters, options);
			samples.push({
				round: r + 1,
				cycles: res.cycles,
				instructions: res.instructions,
				ipc: res.ipc,
				iters,
			});
			value = res.value;
		}

		if (isInteractive) {
			clearProgress();
		}

		const stats = computePmuStats(samples, iters);
		result = {
			title,
			name: title,
			value,
			warmup,
			samples,
			rounds,
			iters,
			...stats,
		};
	} finally {
		if (isInteractive && cursor) {
			showCursor();
		}
	}

	if (!silent && render) {
		renderBench(result);
	}

	return result;
}

module.exports = {
	bench,
	warmupRunner,
	sampleRound,
	gc,
};
