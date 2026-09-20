"use strict";

const { spawnSync } = require("node:child_process");

let pmuBinding = null;

function loadPmu() {
	if (pmuBinding) return pmuBinding;

	try {
		pmuBinding = require("./build/Release/pmu.node");
	} catch {
		try {
			const res = spawnSync("node-gyp", ["rebuild"], {
				cwd: __dirname,
				stdio: "ignore",
			});
			if (res.status === 0) {
				pmuBinding = require("./build/Release/pmu.node");
			}
		} catch {
			// build failed
		}
	}

	if (!pmuBinding) {
		throw new Error(
			"bench.cycles requires the native PMU addon to be built. Run 'npm run build:native'.",
		);
	}

	if (!pmuBinding.isSupported()) {
		throw new Error(
			"bench.cycles requires Linux PMU hardware counter support (/proc/sys/kernel/perf_event_paranoid <= 2). " +
				"For portable time-domain benchmarking across all platforms, use bench() or bench.suite().",
		);
	}

	return pmuBinding;
}

let memoizedBoundaryTax = null;

/**
 * Calibrates empty boundary tax of tic/toc pair in PMU hardware cycles.
 *
 * @returns {number} Boundary tax in CPU cycles.
 */
function calibrateBoundaryTax() {
	const pmu = loadPmu();
	let minTaxCycles = Infinity;
	let minTaxIns = Infinity;
	for (let i = 0; i < 100; i++) {
		pmu.tic();
		pmu.toc();
		const res = pmu.elapsed();
		if (res.cycles >= 0 && res.cycles < minTaxCycles) {
			minTaxCycles = res.cycles;
			minTaxIns = res.instructions;
		}
	}
	const cycles = minTaxCycles === Infinity ? 0 : minTaxCycles;
	const instructions = minTaxIns === Infinity ? 0 : minTaxIns;
	return {
		cycles,
		instructions,
		valueOf() {
			return this.cycles;
		},
	};
}

function getBoundaryTax() {
	if (memoizedBoundaryTax === null) {
		memoizedBoundaryTax = calibrateBoundaryTax();
	}
	return memoizedBoundaryTax;
}

/**
 * Samples a runner by invoking it with (iters, tic, toc) and recording PMU cycles, instructions, and IPC.
 *
 * @param {Function} runner - Runner function (iters, tic, toc) => any.
 * @param {number} iters - Iteration count for this sample.
 * @returns {{ value: any, cycles: number, instructions: number, ipc: number }}
 */
function sample(runner, iters) {
	const pmu = loadPmu();
	const boundaryTax = getBoundaryTax();

	const value = runner(iters, pmu.tic, pmu.toc);
	const res = pmu.elapsed();

	if (res.cycles < 0) {
		throw new Error(
			"Runner must call tic() and toc() around the target measurement loop.",
		);
	}

	const netCycles = Math.max(0, res.cycles - boundaryTax.cycles);
	const netInstructions = Math.max(
		0,
		res.instructions - (boundaryTax.instructions || 0),
	);
	const ipc = netCycles > 0 ? netInstructions / netCycles : 0.0;

	return {
		value,
		cycles: netCycles,
		instructions: netInstructions,
		ipc,
	};
}

function pinCore(coreId) {
	return loadPmu().pinCore(coreId);
}

function getCore() {
	return loadPmu().getCore();
}

module.exports = {
	loadPmu,
	sample,
	getBoundaryTax,
	calibrateBoundaryTax,
	pinCore,
	getCore,
};
