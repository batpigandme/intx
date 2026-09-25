"use strict";
// usage: node capture-run.js <file relative to intx root> <row-index> <cold|warm> [N]
// Loads Abdul's file UNMODIFIED from the stock tree, with microbe's suite functions swapped for a stub that records the
// runners instead of running them. Then times one runner:
//   cold: 1 untimed + 5 timed calls of N (what microbe's fixed-iters suites do)
//   warm: 20000 untimed calls of 100 first (the robust tiny-call warm-up), then the same
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const root = "/tmp/intx-stock";
const [file, idxStr, pattern, nStr] = process.argv.slice(2);
const captured = [];
const stub = (title, ops, opts) => { captured.push({ title, ops, opts: opts || {} }); return []; };
const wall = require(path.join(root, "src/microbe/index.js"));
wall.bench.suite = Object.assign(stub, { rank: stub });
const cyc = require(path.join(root, "src/microbe/cycles/index.js"));
cyc.bench.suite = Object.assign((t, o, p) => stub(t, o, p), { rank: stub });
cyc.suite = cyc.bench.suite;
require(path.join(root, file));
const all = captured.flatMap((c) => Object.entries(c.ops).map(([name, run]) => ({ name, run, iters: c.opts.iters })));
const { name, run, iters } = all[Number(idxStr)];
const N = nStr ? Number(nStr) : iters || 1e8;
let t0 = 0, t1 = 0;
const tic = () => { t0 = performance.now(); };
const toc = () => { t1 = performance.now(); };
let sink = 0;
if (pattern === "warm") for (let j = 0; j < 20000; j++) sink ^= run(100, tic, toc) | 0;
sink ^= run(N, tic, toc) | 0;
const ns = [];
for (let j = 0; j < 5; j++) { sink ^= run(N, tic, toc) | 0; ns.push(((t1 - t0) * 1e6) / N); }
if (sink !== sink) throw new Error("unreachable");
const med = [...ns].sort((a, b) => a - b)[2];
console.log(JSON.stringify({ node: process.version, v8: process.versions.v8, file, idx: Number(idxStr), name, pattern, N, ns: ns.map((x) => +x.toFixed(4)), median: +med.toFixed(4) }));
