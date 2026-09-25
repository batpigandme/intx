"use strict";

const { loadPmu } = require("./timer");
const wallclock = require("../index.js");

// Options that only mean something to the PMU harness. The wall-clock harness
// either ignores them or rejects them (e.g. order: "best" | "ipc").
const PMU_ONLY = [
	"cycles",
	"order",
	"metric",
	"details",
	"digits",
	"precision",
	"snap",
];

const LABEL = "[WALL-CLOCK FALLBACK: time, not cycles]";

function pmuAvailable() {
	try {
		loadPmu();
		return true;
	} catch {
		return false;
	}
}

function strip(options = {}) {
	const out = { ...options };
	for (const key of PMU_ONLY) {
		delete out[key];
	}
	return out;
}

/**
 * Returns a wall-clock stand-in for `bench.cycles` when the hardware PMU is
 * unavailable AND `MICROBE_CYCLES_FALLBACK=time` is set; otherwise `null`.
 *
 * Opt-in only: without the variable, behaviour is unchanged and a missing PMU
 * still throws. Results are time-domain rates, not cycles — every title is
 * labelled so the two can't be confused.
 */
function fallback() {
	if (process.env.MICROBE_CYCLES_FALLBACK !== "time" || pmuAvailable()) {
		return null;
	}

	console.error(
		`${LABEL} No hardware PMU available; MICROBE_CYCLES_FALLBACK=time set, so bench.cycles is running on the wall-clock harness. Units are ops/s, not cycles.`,
	);

	const label = (title) => `${title} ${LABEL}`;
	const { bench: wbench } = wallclock;

	const bench = (title, runner, options) =>
		wbench(label(title), runner, strip(options));
	const suite = (title, runners, options) =>
		wbench.suite(label(title), runners, strip(options));
	const rank = (title, runners, options) =>
		wbench.suite.rank(label(title), runners, strip(options));

	suite.rank = rank;
	bench.suite = suite;

	return { bench, suite, rank };
}

module.exports = { fallback };
