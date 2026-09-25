"use strict";
// usage: node osr2.js <module> <row-index> <cold|warm|calib> [N] [targetCycles]
// cold : 1 untimed call of N, then 5 timed calls of N (microbe's fixed-iters suites)
// warm : 2000 untimed calls of 1e4 first, then the same 1 + 5 x N
// calib: replays the ITERATION SCHEDULE of src/microbe/cycles/calibrate.js (a8de2d6), with "cycles" ESTIMATED as
//        wall-clock ns x 2.1 (boxA's nominal GHz). Not a cycle measurement: only the call-size sequence is reproduced.
//        Then 1 untimed call and 20 timed calls at the calibrated iters.
const { performance } = require("node:perf_hooks");
const [mod, idxStr, pattern, nStr, tStr] = process.argv.slice(2);
const m = require(`./${mod}.js`);
const names = Object.keys(m.runners);
const name = names[Number(idxStr)];
const run = m.runners[name];
const N = nStr ? Number(nStr) : m.iters;
const GHZ = 2.1;
let t0 = 0, t1 = 0;
const tic = () => { t0 = performance.now(); };
const toc = () => { t1 = performance.now(); };
let sink = 0;
const timed = (n) => { sink ^= run(n, tic, toc) | 0; return (t1 - t0) * 1e6; }; // ns for n iters
let iters = N, reps = 5, schedule = [];
if (pattern === "warm") for (let k = 0; k < 2000; k++) sink ^= run(1e4, tic, toc) | 0;
if (pattern === "calib") {
	const target = tStr ? Number(tStr) : 5e7;
	const minWarm = 1e8, maxWarm = Math.max(target * 3, 3e8);
	let it = 100, prev = 0, total = 0, stable = 0, tiered = false;
	let cyc = timed(it) * GHZ; total += cyc; schedule.push(it);
	let done = false;
	for (let step = 0; step < 16 && !done; step++) {
		const cpo = it > 0 && cyc > 0 ? cyc / it : 0;
		if (total >= minWarm) tiered = true;
		if (tiered && prev > 0 && cpo > 0) {
			const delta = Math.abs(cpo - prev) / Math.max(cpo, prev);
			if (delta <= 0.05) { stable++; if (stable >= 2) { iters = Math.max(16, Math.min(1e8, Math.round(Math.round(target / cpo) / 16) * 16)); done = true; break; } }
			else stable = 0;
		}
		if (total >= maxWarm) break;
		prev = cpo;
		if (cyc < 50000) it = cyc <= 0 ? it * 10 : Math.min(1e8, Math.max(it * 4, Math.round((200000 / cyc) * it)));
		else if (!tiered) it = Math.min(1e8, Math.max(it * 2, cpo > 0 ? Math.round((minWarm * 0.5) / cpo) : it * 2));
		else if (cyc >= target * 1.5) it = Math.min(1e8, Math.max(10, Math.round(target / cpo)));
		else it = Math.min(1e8, Math.min(cpo > 0 ? Math.round(target / cpo) : it * 2, Math.round(it * 2)));
		cyc = timed(it) * GHZ; total += cyc; schedule.push(it);
	}
	if (!done) { const fc = cyc > 0 && it > 0 ? cyc / it : prev || 1; iters = Math.max(16, Math.min(1e8, Math.round(Math.round(target / fc) / 16) * 16)); }
	reps = 20;
}
console.log("### MARK warmup-done");
timed(iters);
console.log("### MARK timed-start");
const ns = [];
for (let k = 0; k < reps; k++) ns.push(timed(iters) / iters);
if (sink !== sink) throw new Error("unreachable");
const med = [...ns].sort((a, b) => a - b)[Math.floor(reps / 2)];
console.log(JSON.stringify({ node: process.version, v8: process.versions.v8, mod, idx: Number(idxStr), name, pattern, iters, schedule, ns: ns.map((x) => +x.toFixed(4)), median: +med.toFixed(4) }));
