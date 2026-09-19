"use strict";

const os = require("node:os");
const readline = require("node:readline");

function formatCycles(cycles) {
	if (cycles >= 1e6) return `${(cycles / 1e6).toFixed(2)} M`;
	if (cycles >= 1e3) return `${(cycles / 1e3).toFixed(2)} K`;
	return cycles.toFixed(2);
}

function renderBench(result) {
	const title = result.title || "Kernel";
	const iters = result.iters;
	const rounds = result.rounds || (result.samples ? result.samples.length : 0);
	const itersStr = iters ? iters.toExponential() : "N/A";

	console.log(`● ${title} (${rounds} rounds × ${itersStr} iters)`);

	if (result.warmup) {
		const cycPerOp = result.warmup.cycles / iters;
		const wCycles = `${formatCycles(cycPerOp)} cyc/op`.padStart(13);
		const wIpc = `(IPC: ${result.warmup.ipc.toFixed(2)})`;
		console.log(`  • Warmup:   ${wCycles} ${wIpc}`);
	}

	if (Array.isArray(result.samples)) {
		result.samples.forEach((s, idx) => {
			const roundNum = s.round ?? idx + 1;
			const cycPerOp = s.cycles / iters;
			const cycStr = `${formatCycles(cycPerOp)} cyc/op`.padStart(13);
			const ipcStr = `(IPC: ${s.ipc.toFixed(2)})`;
			console.log(`  • Round ${roundNum}: ${cycStr} ${ipcStr}`);
		});
	}

	const medianStr = `${formatCycles(result.medianCycles)} cyc/op`;
	const bestStr = `${formatCycles(result.minCycles)} cyc/op`;
	const meanStr = `${formatCycles(result.meanCycles)} cyc/op`;
	const ipcStr = `${result.ipc.toFixed(2)} IPC`;
	const moeStr = `±${result.moePercent.toFixed(1)}%`;

	console.log(
		`  ── Summary: Median ${medianStr} | Best ${bestStr} | Mean ${meanStr} | ${ipcStr} (${moeStr})\n`,
	);
}

function renderTable(results, options = {}) {
	const ranked = options.ranked ?? options.isRanked ?? false;
	const width = options.width ?? 90;
	const titleWidth = Math.max(10, width - 69);
	const baselineMedian = results[0]?.medianCycles ?? 1;

	const indexHeader = ranked ? "Rank" : " #  ";
	const titleHeader = "Title".padEnd(titleWidth);
	const medianHeader = "Median (/op)";
	const peakHeader = "Best (/op)";
	const ipcHeader = " IPC ";
	const moeHeader = "MoE (±%)";
	const relativeHeader = "Relative";

	const headerLine = `| ${indexHeader} | ${titleHeader} | ${medianHeader} | ${peakHeader} | ${ipcHeader} | ${moeHeader} | ${relativeHeader} |`;

	const sepIndex = ":----:";
	const sepTitle = `:${"-".repeat(titleWidth + 1)}`;
	const sepMedian = `${"-".repeat(12)}:`;
	const sepPeak = `${"-".repeat(10)}:`;
	const sepIpc = `${"-".repeat(6)}:`;
	const sepMoe = `${"-".repeat(9)}:`;
	const sepRelative = `${"-".repeat(9)}:`;

	const separatorLine = `|${sepIndex}|${sepTitle}|${sepMedian}|${sepPeak}|${sepIpc}|${sepMoe}|${sepRelative}|`;

	console.log(headerLine);
	console.log(separatorLine);

	results.forEach((res, idx) => {
		const rawTitle = res.title || "";
		const displayTitle =
			rawTitle.length > titleWidth
				? `${rawTitle.slice(0, Math.max(1, titleWidth - 1))}…`
				: rawTitle;

		const indexStr = `${idx + 1}`.padStart(4);
		const rowTitle = displayTitle.padEnd(titleWidth);
		const medianVal = formatCycles(res.medianCycles).padStart(11);
		const peakVal = formatCycles(res.minCycles).padStart(9);
		const ipcVal = res.ipc.toFixed(2).padStart(5);
		const moe = `±${res.moePercent.toFixed(1)}%`.padStart(8);
		const relative =
			idx === 0
				? "baseline".padStart(8)
				: `${(res.medianCycles / baselineMedian).toFixed(2)}x`.padStart(8);

		console.log(
			`| ${indexStr} | ${rowTitle} | ${medianVal} | ${peakVal} | ${ipcVal} | ${moe} | ${relative} |`,
		);
	});

	console.log();
}

function getCpuModel() {
	const cpus = os.cpus();
	if (!cpus || cpus.length === 0) return "Unknown CPU";
	const raw = cpus[0].model || "Unknown CPU";
	return raw
		.replace(/\((R|TM)\)/gi, "")
		.replace(/\s+/g, " ")
		.replace(/\s*CPU\s*/, " ")
		.trim();
}

function renderBanner(title, options = {}) {
	const rounds = options.rounds ?? 30;
	const dur = options.dur ?? 20;
	const iters = options.iters;
	const mode = options.mode ?? "shuffled";
	const cooldown = options.cooldown ?? 0;
	const pause = options.pause ?? 20;
	const prime = options.prime ?? true;

	const timingLabel =
		iters === undefined
			? `${rounds} rounds × ~${dur}ms/sample (dynamic)`
			: `${rounds} rounds × ${Number(iters).toExponential()} iters/round`;

	let modeLabel;
	if (mode === "sequential") {
		modeLabel = "Order: Sequential";
	} else if (mode === "ordered") {
		modeLabel = "Order: Round-Robin";
	} else {
		modeLabel = "Order: Shuffled";
	}

	let extra = "";
	if (cooldown > 0) extra += ` | Cooldown: ${cooldown}ms`;
	if (pause > 0) extra += ` | Pause: ${pause}ms`;
	if (prime) extra += ` | Primed`;

	const cpu = getCpuModel();
	const rawTitle = title || "Hardware PMU Benchmark";

	const headingLine = `\n### ${rawTitle}`;
	const configLine = `> **Config:** ${timingLabel} | Metric: Hardware PMU (Cycles & IPC) | ${modeLabel}${extra}  `;
	const platformLine = `> **Platform:** Node ${process.version} (${process.arch}) | ${cpu}`;

	console.log(headingLine);
	console.log(configLine);
	console.log(`${platformLine}\n`);
}

function writeProgress(text) {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	process.stdout.write(text);
}

function clearProgress() {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
}

function hideCursor() {
	if (process.stdout.isTTY) {
		process.stdout.write("\x1b[?25l");
		process.once("exit", showCursor);
	}
}

function showCursor() {
	if (process.stdout.isTTY) {
		process.stdout.write("\x1b[?25h");
		process.removeListener("exit", showCursor);
	}
}

module.exports = {
	formatCycles,
	renderBanner,
	renderBench,
	renderTable,
	writeProgress,
	clearProgress,
	hideCursor,
	showCursor,
};
