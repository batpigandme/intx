'use strict';

const { performance } = require('node:perf_hooks');

/**
 * Dynamically compiles a dedicated, 100% monomorphic benchmark runner for a kernel function.
 *
 * CRITICAL BENCHMARK ENGINEERING FIX:
 * V8's CompilationCache caches compiled scripts by exact source string.
 * If multiple `createBenchmark` calls use the identical string, V8 reuses the same
 * compiled Bytecode and inline cache (FeedbackVector). Calling different functions at the
 * same call site turns the IC MEGAMORPHIC (3+ functions), permanently disabling TurboFan
 * inlining for subsequent candidates and causing a 8-10x slowdown (~3000ms vs ~400ms).
 *
 * By injecting a unique compilation identifier comment into the generated source, each
 * candidate gets an isolated SharedFunctionInfo and a pristine, 100% monomorphic FeedbackVector.
 */
function createBenchmark(
  fn,
  name = fn.name,
  isStrided = false,
  a = 0xdeadbeef,
) {
  const r = new Uint32Array(2);
  const callExpr = isStrided ? 'fn(r[1], a, r, 1, 0);' : 'fn(r[1], a, r);';
  const cleanName = (name || 'kernel').replace(/[^a-zA-Z0-9]/g, '_');

  return new Function(
    'fn',
    'a',
    'r',
    `
    /* [CompilationUnit: ${cleanName}_${Math.random()}] */
    return function benchKernel_${cleanName}(n) {
      r[1] = 1;
      for (let i = 0; i < n; i++) {
        ${callExpr}
      }
      return r;
    };
  `,
  )(fn, a, r);
}

function bench(fn, name = fn.name, iter = 1e8, isStrided = false) {
  const runner =
    typeof fn === 'function' && fn.length >= 3
      ? createBenchmark(fn, name, isStrided)
      : fn;

  // Adaptive warmup: enough for TurboFan tier-up without excessive GC stalls
  const warmIter = Math.min(iter * 0.05, 1e7);
  runner(warmIter);
  runner(warmIter);

  const t0 = performance.now();
  runner(iter);
  const t1 = performance.now();
  const d1 = t1 - t0;

  const rate = (iter * 1000) / d1;
  console.log(
    `${name.padEnd(45)}:: ${iter.toExponential()} iters | Duration: ${d1.toFixed(2).padStart(8)} ms | Rate: ${(+rate.toPrecision(4)).toExponential()} iter/sec`,
  );
}

module.exports = bench;
module.exports.bench = bench;
module.exports.createBenchmark = createBenchmark;
