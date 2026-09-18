"use strict";

const os = require("node:os");

/**
 * Formats throughput rate into human-readable engineering notation.
 *
 * @param {number} rate - Throughput in iterations per second.
 * @returns {string} Formatted string (e.g. "370.50 M", "2.10 B").
 */
function formatRate(rate) {
	if (rate >= 1e9) return `${(rate / 1e9).toFixed(2)} B`;
	if (rate >= 1e6) return `${(rate / 1e6).toFixed(2)} M`;
	if (rate >= 1e3) return `${(rate / 1e3).toFixed(2)} K`;
	return rate.toFixed(2);
}

/**
 * Formats time duration into human-readable adaptive units.
 *
 * @param {number} seconds - Elapsed duration in seconds.
 * @returns {string} Formatted duration string (e.g. "35.89 ms", "1.20 s", "450.00 µs").
 */
function formatTime(seconds) {
	if (seconds < 0.001) {
		return `${(seconds * 1e6).toFixed(2)} µs`;
	}
	if (seconds < 1) {
		return `${(seconds * 1e3).toFixed(2)} ms`;
	}
	return `${seconds.toFixed(2)} s`;
}

/**
 * Renders a single kernel benchmark summary block in tree/bullet format.
 *
 * @param {object} result - Benchmark result object.
 */
function renderBench(result) {
	const title = result.title || "Kernel";
	const iters = result.iters;
	const rounds = result.rounds || (result.samples ? result.samples.length : 0);
	const itersStr = iters ? iters.toExponential() : "N/A";

	console.log(`● ${title} (${rounds} rounds × ${itersStr} iters)`);

	if (result.warmup) {
		const wTime = formatTime(result.warmup.elapsed).padStart(9);
		const wRate = `${formatRate(result.warmup.rate)} iters/s`.padStart(15);
		console.log(`  • Warmup:   ${wTime} (${wRate})`);
	}

	if (Array.isArray(result.samples)) {
		result.samples.forEach((s, idx) => {
			const roundNum = s.round ?? idx + 1;
			const elapsed = typeof s === "number" ? s : s.elapsed;
			const rate =
				typeof s === "object" && s.rate !== undefined
					? s.rate
					: iters / elapsed;
			const timeStr = formatTime(elapsed).padStart(9);
			const rateStr = `${formatRate(rate)} iters/s`.padStart(15);
			console.log(`  • Round ${roundNum}:  ${timeStr} (${rateStr})`);
		});
	}

	const medianStr = `${formatRate(result.medianRate)} iters/s`;
	const peakStr = `${formatRate(result.maxRate)} iters/s`;
	const meanStr = `${formatRate(result.meanRate)} iters/s`;
	const moeStr = `±${result.moePercent.toFixed(1)}%`;

	console.log(
		`  ── Summary: Median ${medianStr} | Peak ${peakStr} | Mean ${meanStr} (${moeStr})\n`,
	);
}

/**
 * Renders the multi-target benchmark table to stdout in GitHub Markdown format.
 *
 * @param {Array<object>} results - Evaluated result objects.
 * @param {object} [options={}] - Table render options.
 * @param {boolean} [options.ranked=false] - If true, displays "Rank" header; otherwise "#".
 * @param {number} [options.width=80] - Total table column width.
 */
function renderTable(results, options = {}) {
	const ranked = options.ranked ?? options.isRanked ?? false;
	const width = options.width ?? 80;
	const titleWidth = Math.max(10, width - 59);
	const baselineMedian = results[0]?.medianRate ?? 1;

	const indexHeader = ranked ? "Rank" : " #  ";
	const titleHeader = "Title".padEnd(titleWidth);
	const medianHeader = "Median (/s)";
	const peakHeader = "Peak (/s)";
	const moeHeader = "MoE (±%)";
	const relativeHeader = "Relative";

	const headerLine = `| ${indexHeader} | ${titleHeader} | ${medianHeader} | ${peakHeader} | ${moeHeader} | ${relativeHeader} |`;

	const sepIndex = ":----:";
	const sepTitle = `:${"-".repeat(titleWidth + 1)}`;
	const sepMedian = `${"-".repeat(12)}:`;
	const sepPeak = `${"-".repeat(10)}:`;
	const sepMoe = `${"-".repeat(9)}:`;
	const sepRelative = `${"-".repeat(9)}:`;

	const separatorLine = `|${sepIndex}|${sepTitle}|${sepMedian}|${sepPeak}|${sepMoe}|${sepRelative}|`;

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
		const medianRate = formatRate(res.medianRate).padStart(11);
		const peakRate = formatRate(res.maxRate).padStart(9);
		const moe = `±${res.moePercent.toFixed(1)}%`.padStart(8);
		const relative =
			idx === 0
				? "baseline".padStart(8)
				: `${(res.medianRate / baselineMedian).toFixed(2)}x`.padStart(8);

		console.log(
			`| ${indexStr} | ${rowTitle} | ${medianRate} | ${peakRate} | ${moe} | ${relative} |`,
		);
	});

	console.log();
}

/**
 * Retrieves and formats CPU model description.
 *
 * @returns {string} Cleaned CPU model name.
 */
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

/**
 * Renders the benchmark header in GitHub Markdown format.
 *
 * @param {string} title - Benchmark suite title.
 * @param {object} [options={}] - Configuration options (rounds, iters, dur, mode, cooldown, pause, prime).
 */
function renderBanner(title, options = {}) {
	const rounds = options.rounds ?? 5;
	const dur = options.dur ?? 100;
	const iters = options.iters;
	const mode = options.mode || "shuffled";
	const cooldown = options.cooldown ?? 0;
	const pause = options.pause ?? 0;
	const prime = !!options.prime;

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
	const rawTitle = title || "Benchmark Suite";

	const headingLine = `\n### ${rawTitle}`;
	const configLine = `> **Config:** ${timingLabel} | ${modeLabel}${extra}  `;
	const platformLine = `> **Platform:** Node ${process.version} (${process.arch}) | ${cpu}`;

	console.log(headingLine);
	console.log(configLine);
	console.log(`${platformLine}\n`);
}

module.exports = {
	formatRate,
	formatTime,
	renderBanner,
	renderBench,
	renderTable,
};
