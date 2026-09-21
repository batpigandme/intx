"use strict";

/**
 * V8 TurboFan and Maglev Ignition Inlining Budget Constants.
 *
 * Measurements are strictly based on the Ignition BytecodeArray length in bytes.
 */
const SMALL_LEAF_BUDGET = 27;
const SINGLE_FN_BUDGET = 460;
const CUMULATIVE_CALLER_BUDGET = 920;
const ABSOLUTE_MAX_BUDGET = 4600;

module.exports = {
	SMALL_LEAF_BUDGET,
	SINGLE_FN_BUDGET,
	CUMULATIVE_CALLER_BUDGET,
	ABSOLUTE_MAX_BUDGET,
};
