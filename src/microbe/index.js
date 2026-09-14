"use strict";

const { bench } = require("./bench");
const { suite } = require("./suite");
const { rank } = require("./rank");
const { createRunner } = require("./create-runner");

suite.rank = rank;
bench.suite = suite;
bench.createRunner = createRunner;

module.exports = {
	bench,
};
