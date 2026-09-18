"use strict";

const { bench } = require("./bench");
const { suite } = require("./suite");
const { rank } = require("./rank");
const { createRunner } = require("./create-runner");

const { presets, short, medium, long } = require("./presets");

suite.rank = rank;
bench.suite = suite;

module.exports = {
	bench,
	createRunner,
	presets,
	short,
	medium,
	long,
};

