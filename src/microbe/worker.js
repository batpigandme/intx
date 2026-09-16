"use strict";

const fs = require("node:fs");
const { sample, sleep } = require("./timer");
const { createRunner } = require("./create-runner");
const { calibrate } = require("./calibrate");
const { computeStats } = require("./stats");

function main() {
	const rawInput = fs.readFileSync(0, "utf-8");
	const { config, options } = JSON.parse(rawInput);

	// Reconstruct context functions if serialized
	if (config.serializedContext) {
		config.context = config.context || {};
		for (const [key, code] of Object.entries(config.serializedContext)) {
			// eslint-disable-next-line no-new-func
			config.context[key] = new Function(`return (${code})`)();
		}
	}

	const runner = createRunner(config);
	const rounds = options.rounds || 5;
	const isDynamic = options.iters === undefined;
	const targetMs = options.time || 100;
	const cooldown = options.cooldown || 0;

	if (typeof global.gc === "function") {
		global.gc();
	}

	// 1. Calibrate & Warmup
	const iters = isDynamic ? calibrate(runner, targetMs) : options.iters;
	const warmupSample = sample(runner, iters);
	const warmup = {
		elapsed: warmupSample.elapsed,
		iters,
		rate: iters / warmupSample.elapsed,
	};

	if (cooldown > 0) {
		sleep(cooldown);
	}

	// 2. Measure
	const sampleTimes = [];
	const sampleDetails = [];
	let value = warmupSample.value;

	for (let r = 1; r <= rounds; r++) {
		if (typeof global.gc === "function") {
			global.gc();
		}

		const res = sample(runner, iters);
		value = res.value;
		sampleTimes.push(res.elapsed);
		sampleDetails.push({
			round: r,
			elapsed: res.elapsed,
			iters,
			rate: iters / res.elapsed,
		});

		if (cooldown > 0) {
			sleep(cooldown);
		}
	}

	// 3. Stats
	const stats = computeStats(sampleTimes, iters);
	const output = {
		value,
		warmup,
		samples: sampleDetails,
		rounds,
		iters,
		...stats,
	};

	process.stdout.write(JSON.stringify(output));
}

try {
	main();
} catch (err) {
	process.stderr.write(err.stack || err.message);
	process.exit(1);
}
