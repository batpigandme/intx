"use strict";

/**
 * Runner Contract:
 * A runner function is any synchronous function with the signature:
 *   (iters: number) => any
 *
 * @typedef {(iters: number) => any} RunnerFunction
 */

/**
 * Creates an isolated, monomorphic JIT-optimized runner function for microbenchmarking.
 *
 * Why dynamic compilation?
 * In V8, invoking multiple distinct functions from a shared static call site makes the
 * Inline Cache (IC) MEGAMORPHIC (3+ distinct functions), which permanently disables
 * TurboFan JIT inlining and causes severe (~8-10x) artificial performance degradation.
 *
 * By generating a unique function closure per candidate with an embedded unique identifier,
 * V8 creates an isolated SharedFunctionInfo with a pristine 100% monomorphic FeedbackVector.
 *
 * @param {object} options - Runner configuration options.
 * @param {string} [options.name="kernel"] - Descriptive name used for function naming and compilation tagging.
 * @param {object} [options.context={}] - Key-value map of variables to inject into the runner's closure scope.
 * @param {string} [options.setup=""] - JavaScript code string executed before the loop.
 * @param {string} [options.body=""] - JavaScript code string executed inside the `for (let i = 0; i < n; i++)` loop.
 * @param {string} [options.teardown=""] - JavaScript code string executed after the loop (e.g. return value).
 * @returns {RunnerFunction} Generated monomorphic runner function `(n) => ...`.
 *
 * @example
 * const runner = createRunner({
 *   name: 'u32_wmul_candidate',
 *   context: { wmul: myKernel, r: new Uint32Array(2), a: 0xdeadbeef },
 *   setup: 'r[0] = 0; r[1] = 1;',
 *   body: 'wmul(r[1], a, r);',
 *   teardown: 'return r;'
 * });
 */
function createRunner(options = {}) {
	const name = options.name || "kernel";
	const cleanName = name.replace(/[^a-zA-Z0-9_$]/g, "_");
	const context = options.context || {};
	const setup = options.setup || "";
	const body = options.body || "";
	const teardown = options.teardown || "";

	const contextKeys = Object.keys(context);
	const contextValues = Object.values(context);
	const uniqueId = `${cleanName}_${Date.now()}_${(Math.random() * 1e9) | 0}`;

	const functionSource = `
    /* [Microbe Monomorphic Unit: ${uniqueId}] */
    return function bench_${cleanName}(n) {
      ${setup}
      for (let i = 0; i < n; i++) {
        ${body}
      }
      ${teardown}
    };
  `;

	const factory = new Function(...contextKeys, functionSource);
	return factory(...contextValues);
}

module.exports = {
	createRunner,
};
