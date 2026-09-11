"use strict";

const bench = require("./lib.js");
const intx = require("../index.js");
const stdlibCJS = require("@stdlib/muldw-cjs");

const fstdlib = stdlibCJS.assign;
const ITERS = 1e8;

console.log(
	"\n================================================================",
);
console.log(` intx: Global Benchmark Suite (Node ${process.version})`);
console.log("================================================================");

// 1. u32.wmul Validated Winning Kernel vs stdlib
bench(intx.u32.wmul, "intx.u32.wmul (limb16-pipeline-imul-all)", ITERS);
bench(fstdlib, "stdlib/umuldw.assign (CJS)", ITERS, true);
