"use strict";
// usage: node osr.js <showdown-tag> <row-index> <cold|warm>
// cold: 1 untimed call of N, then 5 timed calls of N  (what microbe's fixed-iters suite does per runner)
// warm: 2000 untimed calls of 1e4 first, then the same 1 + 5 x N
const { performance } = require("node:perf_hooks");
const [tag, idxStr, pattern] = process.argv.slice(2);
const { runners, iters: N } = require(`./${tag}.js`);
const names = Object.keys(runners);
const name = names[Number(idxStr)];
const run = runners[name];
let t0 = 0, t1 = 0;
const tic = () => { t0 = performance.now(); };
const toc = () => { t1 = performance.now(); };
let sink = 0;
if (pattern === "warm") for (let k = 0; k < 2000; k++) sink ^= run(1e4, tic, toc) | 0;
sink ^= run(N, tic, toc) | 0;
const ns = [];
for (let k = 0; k < 5; k++) { sink ^= run(N, tic, toc) | 0; ns.push(((t1 - t0) * 1e6) / N); }
if (sink !== sink) throw new Error("unreachable");
const med = [...ns].sort((a, b) => a - b)[2];
console.log(JSON.stringify({ node: process.version, v8: process.versions.v8, tag, idx: Number(idxStr), name, pattern, N, ns: ns.map((x) => +x.toFixed(4)), median: +med.toFixed(4) }));
