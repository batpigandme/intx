"use strict";

const os = require("node:os");
const readline = require("node:readline");

function formatCycles(cycles, digits = 2) {
	if (cycles >= 1e6) return `${(cycles / 1e6).toFixed(2)} M`;
	if (cycles >= 1e3) return `${(cycles / 1e3).toFixed(2)} K`;
	return cycles.toFixed(digits);
}

function snapToGrid(cycles, ins, tolerance = 0.005) {
	if (typeof cycles !== "number" || cycles <= 0) return cycles;
	let unroll = 4;
	for (const u of [4, 8, 2, 16]) {
		if (Math.abs(ins * u - Math.round(ins * u)) < 1e-4) {
			unroll = u;
			break;
		}
	}
	const grid = unroll * 4;
	const snapped = Math.round(cycles * grid) / grid;
	return Math.abs(cycles - snapped) <= tolerance ? snapped : cycles;
}

function renderBench(result) {
	const title = result.title || "Kernel";
	const iters = result.iters;
	const rounds = result.rounds || (result.samples ? result.samples.length : 0);
	const itersStr = iters ? iters.toExponential() : "N/A";
	const digits = result.digits ?? 2;

	console.log(`● ${title} (${rounds} rounds × ${itersStr} iters)`);

	if (result.warmup) {
		const cycPerOp = result.warmup.cycles / iters;
		const wCycles = `${formatCycles(cycPerOp, digits)} cyc/op`.padStart(13);
		const wIpc = `(IPC: ${result.warmup.ipc.toFixed(2)})`;
		console.log(`  • Warmup:   ${wCycles} ${wIpc}`);
	}

	if (Array.isArray(result.samples)) {
		result.samples.forEach((s, idx) => {
			const roundNum = s.round ?? idx + 1;
			const cycPerOp = s.cycles / iters;
			const cycStr = `${formatCycles(cycPerOp, digits)} cyc/op`.padStart(13);
			const ipcStr = `(IPC: ${s.ipc.toFixed(2)})`;
			console.log(`  • Round ${roundNum}: ${cycStr} ${ipcStr}`);
		});
	}

	const medianStr = `${formatCycles(result.medianCycles, digits)} cyc/op`;
	const bestStr = `${formatCycles(result.minCycles, digits)} cyc/op`;
	const meanStr = `${formatCycles(result.meanCycles, digits)} cyc/op`;
	const insStr = `${(result.bestInsPerOp ?? result.insPerOp).toFixed(digits)} ins/op`;
	const ipcStr = `${(result.bestIpc ?? result.ipc).toFixed(2)} IPC`;
	const moeStr = `±${result.moePercent.toFixed(1)}%`;

	console.log(
		`  ── Summary: Median ${medianStr} | Best ${bestStr} | Mean ${meanStr} | ${insStr} | ${ipcStr} (${moeStr})\n`,
	);
}

function renderTable(results, options = {}) {
	const ranked = options.ranked ?? options.isRanked ?? false;
	const details = options.details === true;
	const defaultWidth = details ? 130 : 105;
	const width = options.width ?? defaultWidth;
	const overhead = details ? 109 : 81;
	const titleWidth = Math.max(10, width - overhead);
	const metric =
		options.metric ??
		(options.order === "best" || options.order === "min" ? "best" : "best");
	const useBest = metric === "best" || metric === "min";
	const baselineVal =
		(useBest ? results[0]?.minCycles : results[0]?.medianCycles) || 1;

	const digits =
		options.digits ??
		options.precision ??
		(options.details
			? 4
			: results.some((r) => (r.minCycles ?? 0) < 10)
				? 4
				: 2);

	const indexHeader = ranked ? "Rank" : " #  ";
	const titleHeader = "Title".padEnd(titleWidth);
	const medianHeader = "Median (/op)";
	const peakHeader = "Best (/op)";
	const insHeader = "Ins (/op)";
	const ipcHeader = " IPC ";
	const moeHeader = "MoE (±%)";
	const inlierMoeHeader = "Inlier MoE";
	const outlierHeader = "Outliers (%)";
	const relativeHeader = "Relative";

	let headerLine;
	let separatorLine;

	const sepIndex = ":----:";
	const sepTitle = `:${"-".repeat(titleWidth + 1)}`;
	const sepMedian = `${"-".repeat(13)}:`;
	const sepPeak = `${"-".repeat(11)}:`;
	const sepIns = `${"-".repeat(10)}:`;
	const sepIpc = `${"-".repeat(6)}:`;
	const sepMoe = `${"-".repeat(9)}:`;
	const sepInlierMoe = `${"-".repeat(11)}:`;
	const sepOutlier = `${"-".repeat(13)}:`;
	const sepRelative = `${"-".repeat(9)}:`;

	if (details) {
		headerLine = `| ${indexHeader} | ${titleHeader} | ${medianHeader} | ${peakHeader} | ${insHeader} | ${ipcHeader} | ${moeHeader} | ${inlierMoeHeader} | ${outlierHeader} | ${relativeHeader} |`;
		separatorLine = `|${sepIndex}|${sepTitle}|${sepMedian}|${sepPeak}|${sepIns}|${sepIpc}|${sepMoe}|${sepInlierMoe}|${sepOutlier}|${sepRelative}|`;
	} else {
		headerLine = `| ${indexHeader} | ${titleHeader} | ${medianHeader} | ${peakHeader} | ${insHeader} | ${ipcHeader} | ${moeHeader} | ${relativeHeader} |`;
		separatorLine = `|${sepIndex}|${sepTitle}|${sepMedian}|${sepPeak}|${sepIns}|${sepIpc}|${sepMoe}|${sepRelative}|`;
	}

	console.log(headerLine);
	console.log(separatorLine);

	const snap = options.snap === true;

	results.forEach((res, idx) => {
		const rawTitle = res.title || "";
		const displayTitle =
			rawTitle.length > titleWidth
				? `${rawTitle.slice(0, Math.max(1, titleWidth - 1))}…`
				: rawTitle;

		const indexStr = `${idx + 1}`.padStart(4);
		const rowTitle = displayTitle.padEnd(titleWidth);
		const medianVal = formatCycles(res.medianCycles, digits).padStart(12);
		const rawPeak = res.minCycles;
		const targetIns = res.bestInsPerOp ?? res.insPerOp;
		const targetPeak = snap ? snapToGrid(rawPeak, targetIns) : rawPeak;
		const peakVal = formatCycles(targetPeak, digits).padStart(10);
		const insVal = (targetIns ?? 0).toFixed(digits).padStart(9);
		const targetIpc =
			res.bestIpc && !snap
				? res.bestIpc
				: targetPeak > 0
					? targetIns / targetPeak
					: res.ipc;
		const ipcVal = (targetIpc ?? 0).toFixed(2).padStart(5);
		const moe = `±${res.moePercent.toFixed(1)}%`.padStart(8);
		const targetVal = useBest ? targetPeak : res.medianCycles;
		const relative =
			idx === 0
				? "baseline".padStart(8)
				: `${(targetVal / baselineVal).toFixed(2)}x`.padStart(8);

		if (details) {
			const inlierMoeVal = res.inliers
				? `±${res.inliers.moePercent.toFixed(1)}%`.padStart(10)
				: "N/A".padStart(10);
			const outlierVal = res.outliers
				? `${res.outliers.percent.toFixed(1)}%`.padStart(12)
				: "0.0%".padStart(12);
			console.log(
				`| ${indexStr} | ${rowTitle} | ${medianVal} | ${peakVal} | ${insVal} | ${ipcVal} | ${moe} | ${inlierMoeVal} | ${outlierVal} | ${relative} |`,
			);
		} else {
			console.log(
				`| ${indexStr} | ${rowTitle} | ${medianVal} | ${peakVal} | ${insVal} | ${ipcVal} | ${moe} | ${relative} |`,
			);
		}
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
	const iters = options.iters;
	const mode = options.mode ?? "sequential";
	const cooldown = options.cooldown ?? 0;
	const pause = options.pause ?? 20;
	const prime = options.prime ?? true;

	const cyclesTarget =
		options.cycles ?? (options.dur !== undefined ? options.dur * 2e6 : 5e7);
	const timingLabel =
		iters === undefined
			? `${rounds} rounds × ~${formatCycles(cyclesTarget)} cyc/sample (dynamic)`
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

	const metricLabel =
		options.metric === "best" ||
		options.metric === "min" ||
		options.order === "best" ||
		options.order === "min"
			? "Hardware PMU (Best / Peak Cycles)"
			: "Hardware PMU (Cycles & IPC)";

	const headingLine = `\n### ${rawTitle}`;
	const configLine = `> **Config:** ${timingLabel} | Metric: ${metricLabel} | ${modeLabel}${extra}  `;
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
