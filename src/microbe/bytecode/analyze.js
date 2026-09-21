"use strict";

const { compare } = require("./compare");

/**
 * Analyzes Ignition bytecode metrics for a single function reference.
 *
 * @param {Function} targetFn - Direct reference to the function to analyze.
 * @param {object} [options={}] - Options (e.g. { verbose: true, silent: true }).
 * @returns {object} Parsed bytecode metrics for the target function.
 */
function analyze(targetFn, options = {}) {
	if (typeof targetFn !== "function") {
		throw new TypeError("bytecode.analyze expected a function reference.");
	}

	const name = targetFn.name || "anonymous_target";
	const suiteName = options.title || `Bytecode Analysis: ${name}`;

	// Default analyze to silent: true unless explicit render is requested
	const isSilent = options.render ? false : (options.silent ?? true);

	const results = compare(
		suiteName,
		{ [name]: targetFn },
		{ ...options, silent: isSilent },
	);

	return results[0];
}

module.exports = {
	analyze,
};
