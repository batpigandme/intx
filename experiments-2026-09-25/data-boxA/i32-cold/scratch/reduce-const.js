"use strict";
// Standalone: does the cold-call (OSR) penalty on intx's i32 div/mod/rotl rows come from a closure constant operand?
// No intx code: the kernels are copied inline, the runner is built the way microbe's createRunner builds it.
// usage: node reduce-const.js <kernel> <operand> <cold|warm>
//   kernel : rotl | div | mod
//   operand: arg      -> second operand is a parameter of the runner (passed on every call), as a real kernel takes it
//   operand: closure  -> second operand is a closure variable (as in src/i32/showdown.js: k = 13, d = 17)
//            literal  -> second operand is the same value written as a literal
// cold: 1 untimed + 5 timed calls of 1e7 (the showdown's iters); warm: 2000 x 1e4 first, then the same.
const { performance } = require("node:perf_hooks");
const [kernel = "rotl", operand = "closure", pattern = "cold"] = process.argv.slice(2);

function rotl(a, b) {
	return (a << b) | (a >>> (-b & 31)) | 0;
}
function div(a, b) {
	return ((a | 0) / (b | 0)) | 0;
}
function mod(a, b) {
	return ((a | 0) % (b | 0)) | 0;
}

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
const arg = operand === "literal" ? (kernel === "rotl" ? "13" : "17") : operand === "arg" ? "p" : kernel === "rotl" ? "k" : "d";
const loop =
	kernel === "rotl"
		? `acc = rotl(acc, ${arg});`
		: `acc = ${kernel}(buf[idx], ${arg}); idx = (idx + 1) & 1023;`;
const setup = kernel === "rotl" ? "let acc = 0x12345678;" : "let acc = 0, idx = 0;";

const run = new Function(
	"rotl",
	"div",
	"mod",
	"k",
	"d",
	"buf",
	`return function kernel(iters, tic, toc, p) { ${setup} tic(); for (let i = 0; i < iters; i++) { ${loop} } toc(); return acc; };`,
)(rotl, div, mod, k, d, buf);

let t0 = 0;
let t1 = 0;
const tic = () => {
	t0 = performance.now();
};
const toc = () => {
	t1 = performance.now();
};
let sink = 0;
const N = 1e7;
const P = kernel === "rotl" ? k : d;
if (pattern === "warm") for (let j = 0; j < 2000; j++) sink ^= run(1e4, tic, toc, P);
sink ^= run(N, tic, toc, P);
const ns = [];
for (let j = 0; j < 5; j++) {
	sink ^= run(N, tic, toc, P);
	ns.push(((t1 - t0) * 1e6) / N);
}
if (sink !== sink) throw new Error("unreachable");
const med = [...ns].sort((a, b) => a - b)[2];
console.log(
	JSON.stringify({ node: process.version, v8: process.versions.v8, kernel, operand, pattern, ns: ns.map((x) => +x.toFixed(4)), median: +med.toFixed(4) }),
);
