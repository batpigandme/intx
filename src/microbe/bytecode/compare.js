"use strict";

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { getCallerFile } = require("./caller");
const { parseDelimitedOutput } = require("./parse");
const { renderTable } = require("./render");

const suiteOccurrences = new Map();

function createDummyResult(name) {
	return {
		name,
		bytes: 10,
		parameters: 2,
		registers: 0,
		frameSize: 0,
		isSmall: true,
		isInlinable: true,
		status: "SMALL (Boosted)",
		callerBudgetPercent: "1.0%",
		instructionCount: 1,
		instructions: [{ offset: 0, hex: "b3", mnemonic: "Return", operands: "" }],
	};
}

/**
 * Compares candidate integer arithmetic kernels by Ignition bytecode size,
 * evaluating inlining eligibility against V8 TurboFan and Maglev thresholds.
 *
 * Uses the Caller-File Self-Re-Execution pattern to preserve all local lexical closures,
 * module imports, and ad-hoc candidate functions with zero manual serialization.
 *
 * @param {string} title - Benchmark / showdown suite title.
 * @param {Record<string, Function|object>} candidates - Map of candidate names to function references.
 * @param {object} [options={}] - Comparison options.
 * @param {boolean} [options.rank=false] - Whether to sort candidates ascending by bytecode size.
 * @param {boolean} [options.verbose=false] - Whether to print disassembled opcode instructions.
 * @param {boolean} [options.silent=false] - Whether to suppress stdout rendering and return raw data.
 * @param {number} [options.width=90] - Target terminal table width.
 * @returns {Array<object>} Array of parsed candidate metrics.
 */
function compare(title, candidates, options = {}) {
	if (
		!candidates ||
		typeof candidates !== "object" ||
		Array.isArray(candidates)
	) {
		throw new TypeError(
			"bytecode.compare expected candidates to be an object map of function references.",
		);
	}

	const candidateKeys = Object.keys(candidates);
	if (candidateKeys.length === 0) {
		throw new Error(
			"bytecode.compare requires at least one candidate function.",
		);
	}

	const occurrences = (suiteOccurrences.get(title) || 0) + 1;
	suiteOccurrences.set(title, occurrences);
	const currentSuiteTag = `${title}:::${occurrences}`;

	const targetSuiteTag = process.env.__MICROBE_SUITE_TAG__;

	// Construct delimiter tokens dynamically to avoid string literals appearing in constant pools
	const startPrefix = ["@@", "MICROBE_START", "@@:"].join("");
	const endPrefix = ["@@", "MICROBE_END", "@@:"].join("");

	// --- Child Execution Path ---
	if (targetSuiteTag !== undefined) {
		if (targetSuiteTag === currentSuiteTag) {
			for (const key of candidateKeys) {
				fs.writeSync(1, `\n${startPrefix}${key}\n`);
				try {
					const candidate = candidates[key];
					if (typeof candidate === "function") {
						candidate();
					} else if (candidate && typeof candidate.kernel === "function") {
						candidate.kernel();
					} else if (candidate && typeof candidate.fn === "function") {
						candidate.fn();
					}
				} catch (_) {
					// Ignition compiles the AST upon invocation before body execution.
				}
				fs.writeSync(1, `\n${endPrefix}${key}\n`);
			}
			// Terminate immediately to avoid running subsequent suites or benchmarks
			process.exit(0);
		}
		// Not the targeted suite for this child execution; return valid dummy results so caller assertions don't abort child
		return candidateKeys.map(createDummyResult);
	}

	// --- Parent Execution Path ---
	const callerFile = getCallerFile();

	// Filter out test-runner specific flags from execArgv so child runs in plain script mode
	const cleanExecArgv = process.execArgv.filter(
		(arg) => arg !== "--test" && !arg.startsWith("--test-"),
	);

	const spawnArgs = [
		"--no-maglev",
		"--print-bytecode",
		"--print-bytecode-filter=*",
		...cleanExecArgv,
		callerFile,
		...process.argv.slice(2),
	];

	const result = spawnSync(process.execPath, spawnArgs, {
		cwd: process.cwd(),
		env: {
			...process.env,
			__MICROBE_SUITE_TAG__: currentSuiteTag,
		},
		encoding: "utf8",
		maxBuffer: 25 * 1024 * 1024,
	});

	if (result.error) {
		throw new Error(
			`Failed to re-execute caller file for bytecode analysis: ${result.error.message}`,
		);
	}

	let parsedResults = parseDelimitedOutput(result.stdout, candidateKeys);

	// Apply sorting if ranked
	if (options.rank) {
		parsedResults = [...parsedResults].sort((a, b) => {
			if (a.bytes === null) return 1;
			if (b.bytes === null) return -1;
			return a.bytes - b.bytes;
		});
	}

	if (!options.silent) {
		renderTable(title, parsedResults, { ...options, callerFile });
	}

	return parsedResults;
}

/**
 * Ranked candidate comparison (sorted ascending by bytecode size with rank header).
 */
compare.rank = function compareRank(title, candidates, options = {}) {
	return compare(title, candidates, { ...options, rank: true });
};

module.exports = {
	compare,
};
