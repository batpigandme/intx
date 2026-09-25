"use strict";
// Standalone reduction of intx's i32.add "Inline Operator" row. No intx code.
// usage: node reduce.js <variant> <mode> [op]
//   op (optional, default +): + | - | * | ^   applied as acc = ((acc | 0) OP <c-form>) | 0
//   extra variants (boxD follow-up): local (c declared inside the kernel as a literal-initialised const),
//     localcopy (const cl = c inside the kernel, copied from the closure), param (c passed as a kernel parameter)
//   variant: uncoerced | coerced | literal
//   mode:    big   -> 5 calls x 1e8 iters from cold (what the showdown does: iters: 1e8)
//            small -> 2000 calls x 1e4 iters first (warm-up like dynamic calibration), then 5 x 1e8
const { performance } = require("node:perf_hooks");
const [variant = "uncoerced", mode = "big", op = "+"] = process.argv.slice(2);

const c = 0x9e3779b9 | 0;
const body = {
	uncoerced: `acc = ((acc | 0) ${op} c) | 0;`,
	coerced: `acc = ((acc | 0) ${op} (c | 0)) | 0;`,
	literal: `acc = ((acc | 0) ${op} (-1640531527)) | 0;`,
	local: `acc = ((acc | 0) ${op} cl) | 0;`,
	localcopy: `acc = ((acc | 0) ${op} cl) | 0;`,
	param: `acc = ((acc | 0) ${op} cp) | 0;`,
}[variant];
const pre = variant === "local" ? "const cl = -1640531527;" : variant === "localcopy" ? "const cl = c;" : "";

// Same shape as microbe's createRunner: context values become closure variables of a new Function factory.
const run = new Function(
	"c",
	`return function kernel(iters, cp) { ${pre} let acc = 1; for (let i = 0; i < iters; i++) { ${body} } return acc; };`,
)(c);

let sink = 0;
if (mode === "small") {
	for (let k = 0; k < 2000; k++) sink ^= run(1e4, c);
}
const ns = [];
for (let k = 0; k < 5; k++) {
	const t0 = performance.now();
	sink ^= run(1e8, c);
	const t1 = performance.now();
	ns.push(((t1 - t0) * 1e6) / 1e8);
}
if (sink !== sink) throw new Error("unreachable"); // keep result live
const sorted = [...ns].sort((a, b) => a - b);
console.log(
	`${process.version} v8=${process.versions.v8} ${variant} ${mode} op=${op}: ns/iter per call = ${ns.map((x) => x.toFixed(3)).join(" ")} | median ${sorted[2].toFixed(3)}`,
);
