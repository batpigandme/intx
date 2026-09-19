"use strict";

const { bench, warmupRunner, sampleRound } = require("./bench");
const { sleep } = require("#utils");
const { computePmuStats } = require("./stats");
const {
	renderTable,
	renderBanner,
	writeProgress,
	clearProgress,
	hideCursor,
	showCursor,
} = require("./render");

function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = (Math.random() * (i + 1)) | 0;
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array;
}

function suite(title, runners, options = {}) {
	if (!runners || typeof runners !== "object" || Array.isArray(runners)) {
		throw new TypeError(
			"bench.cycles.suite expected runners to be an object map of runner functions.",
		);
	}

	const names = Object.keys(runners);
	if (names.length < 2) {
		throw new Error(
			"bench.cycles.suite requires at least two runner functions.",
		);
	}

	for (const name of names) {
		if (typeof runners[name] !== "function") {
			throw new TypeError(
				`bench.cycles.suite expected runner function for '${name}', received: ${typeof runners[name]}`,
			);
		}
	}

	const rounds = options.rounds ?? 30;
	const iters = options.iters;
	const cooldown = options.cooldown ?? 0;
	const pause = options.pause ?? 20;
	const mode = options.mode ?? "sequential";
	const prime = options.prime ?? mode === "shuffled";
	const silent = !!options.silent;
	const render = options.render ?? true;
	const width = options.width ?? 90;

	if (!silent && render) {
		renderBanner(title, {
			rounds,
			iters,
			cycles: options.cycles,
			dur: options.dur,
			mode,
			cooldown,
			pause,
			prime,
			width,
			metric: options.metric,
			order: options.order,
		});
	}

	const isInteractive = !silent && !!process.stdout.isTTY;
	if (isInteractive) {
		hideCursor();
	}

	let results;
	try {
		if (mode === "sequential") {
			results = [];
			for (let i = 0; i < names.length; i++) {
				const name = names[i];
				results.push(
					bench(name, runners[name], {
						...options,
						prime,
						render: false,
						cursor: false,
					}),
				);

				if (pause > 0 && i < names.length - 1) {
					sleep(pause);
				}
			}
		} else {
			const itersMap = {};
			const warmupMap = {};
			const values = {};
			const samples = {};
			const sampleDetails = {};

			for (const name of names) {
				samples[name] = [];
				sampleDetails[name] = [];
				if (isInteractive) {
					writeProgress(`🔥 Warming up & calibrating PMU ('${name}')... `);
				}
				const {
					iters: itersCount,
					warmup,
					value,
				} = warmupRunner(runners[name], { ...options, prime });
				itersMap[name] = itersCount;
				warmupMap[name] = warmup;
				values[name] = value;
			}

			for (let round = 1; round <= rounds; round++) {
				const roundOrder = mode === "ordered" ? names : shuffle([...names]);
				for (const name of roundOrder) {
					if (isInteractive) {
						writeProgress(`[Round ${round}/${rounds}] Sampling '${name}'... `);
					}
					const itersCount = itersMap[name];
					const res = sampleRound(runners[name], itersCount, {
						...options,
						prime,
					});
					values[name] = res.value;
					samples[name].push({
						cycles: res.cycles,
						instructions: res.instructions,
						ipc: res.ipc,
					});
					sampleDetails[name].push({
						round,
						cycles: res.cycles,
						instructions: res.instructions,
						ipc: res.ipc,
						iters: itersCount,
					});
				}

				if (pause > 0 && round < rounds) {
					sleep(pause);
				}
			}

			results = names.map((name) => {
				const itersCount = itersMap[name];
				const stats = computePmuStats(samples[name], itersCount);
				return {
					title: name,
					name,
					value: values[name],
					warmup: warmupMap[name],
					samples: sampleDetails[name],
					rounds,
					iters: itersCount,
					...stats,
				};
			});
		}

		if (isInteractive) {
			clearProgress();
		}
	} finally {
		if (isInteractive) {
			showCursor();
		}
	}

	if (!silent && render) {
		renderTable(results, {
			width: options.width,
			details: options.details,
			metric: options.metric,
			order: options.order,
		});
	}

	return results;
}

module.exports = {
	suite,
};
