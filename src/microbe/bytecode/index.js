"use strict";

const { compare } = require("./compare");
const { analyze } = require("./analyze");
const {
	SMALL_LEAF_BUDGET,
	SINGLE_FN_BUDGET,
	CUMULATIVE_CALLER_BUDGET,
	ABSOLUTE_MAX_BUDGET,
} = require("./constants");

module.exports = {
	compare,
	analyze,
	SMALL_LEAF_BUDGET,
	SINGLE_FN_BUDGET,
	CUMULATIVE_CALLER_BUDGET,
	ABSOLUTE_MAX_BUDGET,
};
