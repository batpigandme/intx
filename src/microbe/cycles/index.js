"use strict";

const { bench } = require("./bench");
const { suite } = require("./suite");
const { rank } = require("./rank");
suite.rank = rank;
bench.suite = suite;

module.exports = {
	bench,
	suite,
	rank,
};
