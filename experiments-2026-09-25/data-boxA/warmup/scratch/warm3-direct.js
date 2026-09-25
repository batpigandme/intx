"use strict";
// Compare warm-up strategies before a fixed-size timed measurement. Scratch only; stock intx a8de2d6 is not modified.
// usage: node warm3.js <case> <strategy>
//   case: exp01r6       -> exploration 01 row 6 (uncoerced closure add), Abdul's own runner, N = 1e8
//         rc-div-closure | rc-rotl-closure | rc-div-arg | rc-rotl-arg  -> standalone kernels (see reduce-const.js), N = 1e7
//   strategy:
//     S0 none                  : no warm-up (what microbe's fixed-iters suites do)
//     S1 2000 x 1e4            : the warm-up used in earlier notes
//     S2 20000 x 100           : many tiny calls, each too short for the loop to trigger on-stack replacement
//     S3 S2 + settle           : S2, then a 20 ms Atomics.wait pause (lets a concurrent compile finish), then 200 x 100
//     S4 microbe calibrate     : stock src/microbe/calibrate.js calibrate(runner, 50) (microbe's dynamic wall-clock path)
// Then: 1 untimed call of N, 5 timed calls of N. Reports per-call ns, the median, and warm-up wall time.
const { performance } = require("node:perf_hooks");
const [kase, strategy] = process.argv.slice(2);

let run;
let N;
let P;
if (kase === "exp01r6") {
	const m = require("./exp01.js");
	run = m.runners[Object.keys(m.runners)[6]];
	N = 1e8;
} else {
	const [, kernel, operand] = kase.split("-");
	const rotl = (a, b) => (a << b) | (a >>> (-b & 31)) | 0;
	const div = (a, b) => ((a | 0) / (b | 0)) | 0;
	const buf = new Int32Array(1024);
	let s = 0x2545f491;
	for (let i = 0; i < 1024; i++) {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		buf[i] = s | 0;
	}
	const k = 13 | 0;
	const d = 17 | 0;
	const arg = operand === "arg" ? "p" : kernel === "rotl" ? "k" : "d";
	const loop = kernel === "rotl" ? `acc = rotl(acc, ${arg});` : `acc = div(buf[idx], ${arg}); idx = (idx + 1) & 1023;`;
	const setup = kernel === "rotl" ? "let acc = 0x12345678;" : "let acc = 0, idx = 0;";
	run = new Function(
		"rotl",
		"div",
		"k",
		"d",
		"buf",
		`return function kernel(iters, tic, toc, p) { ${setup} tic(); for (let i = 0; i < iters; i++) { ${loop} } toc(); return acc; };`,
	)(rotl, div, k, d, buf);
	N = 1e7;
	P = kernel === "rotl" ? k : d;
}

let t0 = 0;
let t1 = 0;
const tic = () => {
	t0 = performance.now();
};
const toc = () => {
	t1 = performance.now();
};
let sink = 0;
const call = (n) => {
	sink ^= run(n, tic, toc, P) | 0;
};

const w0 = performance.now();
if (strategy === "S1") for (let j = 0; j < 2000; j++) sink ^= run(1e4, tic, toc, P) | 0; // direct, no wrapper
if (strategy === "S2" || strategy === "S3") for (let j = 0; j < 20000; j++) sink ^= run(100, tic, toc, P) | 0; // direct
if (strategy === "S3") {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
	for (let j = 0; j < 200; j++) call(100);
}
if (strategy === "S4") {
	const { calibrate } = require("../src/microbe/calibrate.js");
	calibrate((n, a, b) => run(n, a, b, P), 50);
}
const warmMs = performance.now() - w0;

sink ^= run(N, tic, toc, P) | 0;
const ns = [];
for (let j = 0; j < 5; j++) {
	sink ^= run(N, tic, toc, P) | 0;
	ns.push(((t1 - t0) * 1e6) / N);
}
if (sink !== sink) throw new Error("unreachable");
const med = [...ns].sort((a, b) => a - b)[2];
console.log(
	JSON.stringify({ node: process.version, v8: process.versions.v8, kase, strategy, warmMs: +warmMs.toFixed(1), ns: ns.map((x) => +x.toFixed(4)), median: +med.toFixed(4) }),
);
