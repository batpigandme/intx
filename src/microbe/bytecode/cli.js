"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { parseCandidateBlock } = require("./parse");
const { renderTable } = require("./render");

function printUsage() {
	console.log(`
Microbe Ignition Bytecode Analyzer CLI

Usage:
  node src/microbe/bytecode/cli.js <file.js> [options]
  node src/microbe/bytecode/cli.js -e "<code>" [options]

Options:
  --verbose, -v        Print full disassembled instruction listings
  --filter=<pattern>   V8 bytecode filter pattern (default: "*")
  --help, -h           Show this help message
`);
}

function runCli() {
	const args = process.argv.slice(2);
	if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
		printUsage();
		process.exit(0);
	}

	const verbose = args.includes("--verbose") || args.includes("-v");
	const filterArg = args.find((a) => a.startsWith("--filter="));
	const filter = filterArg ? filterArg.split("=")[1] : "*";

	const evalIndex = args.indexOf("-e");
	if (evalIndex !== -1 && evalIndex + 1 < args.length) {
		const code = args[evalIndex + 1];
		const spawnArgs = [
			"--no-maglev",
			"--print-bytecode",
			`--print-bytecode-filter=${filter}`,
			"-e",
			`try { (${code})(); } catch (_) {}`,
		];

		const proc = spawnSync(process.execPath, spawnArgs, { encoding: "utf8" });
		const parsed = parseCandidateBlock(proc.stdout, "adhoc");
		renderTable("CLI Inline Snippet", [parsed], { verbose });
		process.exit(0);
	}

	const filePath = args.find((a) => !a.startsWith("-"));
	if (!filePath) {
		console.error("Error: No target file specified.");
		printUsage();
		process.exit(1);
	}

	const resolved = path.resolve(filePath);
	const mod = require(resolved);

	if (typeof mod === "function") {
		const spawnArgs = [
			"--no-maglev",
			"--print-bytecode",
			`--print-bytecode-filter=${filter}`,
			resolved,
		];
		const proc = spawnSync(process.execPath, spawnArgs, { encoding: "utf8" });
		const parsed = parseCandidateBlock(
			proc.stdout,
			mod.name || path.basename(filePath, ".js"),
		);
		renderTable(path.basename(filePath), [parsed], {
			verbose,
			callerFile: resolved,
		});
		process.exit(0);
	}

	if (typeof mod === "object" && mod !== null) {
		const candidateKeys = Object.keys(mod).filter(
			(k) => typeof mod[k] === "function",
		);
		if (candidateKeys.length > 0) {
			const candidates = {};
			for (const k of candidateKeys) candidates[k] = mod[k];
			const { compare } = require("./compare");
			compare(path.basename(filePath), candidates, { verbose, rank: true });
			process.exit(0);
		}
	}

	// Fallback: simply run the file with print-bytecode and filter
	const proc = spawnSync(
		process.execPath,
		[
			"--no-maglev",
			"--print-bytecode",
			`--print-bytecode-filter=${filter}`,
			resolved,
		],
		{ encoding: "utf8" },
	);
	const parsed = parseCandidateBlock(
		proc.stdout,
		path.basename(filePath, ".js"),
	);
	renderTable(path.basename(filePath), [parsed], {
		verbose,
		callerFile: resolved,
	});
}

if (require.main === module) {
	runCli();
}

module.exports = { runCli };
