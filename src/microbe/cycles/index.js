"use strict";

const { bench } = require("./bench");
const { suite } = require("./suite");
const { rank } = require("./rank");
const { pinCore, getCore } = require("./timer");

suite.rank = rank;
bench.suite = suite;
bench.pinCore = pinCore;
bench.getCore = getCore;

module.exports = {
	bench,
	suite,
	rank,
	pinCore,
	getCore,
};
