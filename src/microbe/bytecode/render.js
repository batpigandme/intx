"use strict";

const path = require("node:path");

/**
 * Renders the bytecode audit table to stdout in GitHub Flavored Markdown format.
 *
 * @param {string} title - Suite title.
 * @param {Array<object>} results - Array of parsed candidate result objects.
 * @param {object} [options={}] - Render options.
 * @param {boolean} [options.rank=false] - Whether results are ranked by bytecode size.
 * @param {number} [options.width=90] - Target table column width.
 * @param {boolean} [options.verbose=false] - If true, prints instruction disassembly per candidate.
 * @param {string} [options.callerFile=""] - Path to caller file.
 */
function renderTable(title, results, options = {}) {
	const isRanked = Boolean(options.rank);
	const width = options.width ?? 90;
	const verbose = Boolean(options.verbose);
	const callerName = options.callerFile
		? path.basename(options.callerFile)
		: "";

	// Banner
	console.log(`### ${title}`);
	const v8Version = process.versions.v8 || "unknown";
	const nodeVersion = process.version;
	const meta = `V8 ${v8Version} (Node ${nodeVersion})${callerName ? ` | ${callerName}` : ""}`;
	console.log(`*${meta}*\n`);

	// Column calculations
	const nameWidth = Math.max(16, width - 68);
	const indexHeader = isRanked ? "Rank" : " #  ";
	const nameHeader = "Candidate".padEnd(nameWidth);
	const bytesHeader = "Bytecode (B)";
	const statusHeader = "Inlining Status".padEnd(19);
	const budgetHeader = "% of 920B";
	const regsHeader = "Regs";
	const insHeader = "Ins Count";

	const headerLine = `| ${indexHeader} | ${nameHeader} | ${bytesHeader} | ${statusHeader} | ${budgetHeader} | ${regsHeader} | ${insHeader} |`;
	const separatorLine = `|:----:|:${"-".repeat(nameWidth + 1)}|${"-".repeat(12)}:|:${"-".repeat(19)}|${"-".repeat(9)}:|${"-".repeat(4)}:|${"-".repeat(9)}:|`;

	console.log(headerLine);
	console.log(separatorLine);

	results.forEach((res, idx) => {
		const indexStr = `${idx + 1}`.padStart(4);
		const rawName = res.name || "anonymous";
		const displayName =
			rawName.length > nameWidth
				? `${rawName.slice(0, Math.max(1, nameWidth - 1))}…`
				: rawName;
		const rowName = displayName.padEnd(nameWidth);

		const bytesStr =
			res.bytes !== null ? `${res.bytes} B`.padStart(12) : "ERROR".padStart(12);
		const statusStr = (res.status || "UNKNOWN").padEnd(19);
		const budgetStr = (res.callerBudgetPercent || "N/A").padStart(9);
		const regsStr =
			res.registers !== null ? `${res.registers}`.padStart(4) : "-".padStart(4);
		const insStr =
			res.instructionCount !== null
				? `${res.instructionCount}`.padStart(9)
				: "-".padStart(9);

		console.log(
			`| ${indexStr} | ${rowName} | ${bytesStr} | ${statusStr} | ${budgetStr} | ${regsStr} | ${insStr} |`,
		);
	});

	console.log();

	if (verbose) {
		console.log("#### Disassembled Instructions\n");
		for (const res of results) {
			console.log(
				`**${res.name}** (${res.bytes !== null ? `${res.bytes} B` : "Error"}):`,
			);
			if (res.instructions && res.instructions.length > 0) {
				console.log("```text");
				for (const ins of res.instructions) {
					const offsetStr = `@${ins.offset}`.padEnd(6);
					const hexStr = ins.hex.padEnd(12);
					const mnemonicStr = ins.mnemonic.padEnd(26);
					console.log(
						`  ${offsetStr} : ${hexStr} ${mnemonicStr} ${ins.operands}`,
					);
				}
				console.log("```\n");
			} else if (res.error) {
				console.log(`  *Error: ${res.error}*\n`);
			} else {
				console.log("  *No instructions available*\n");
			}
		}
	}
}

module.exports = {
	renderTable,
};
