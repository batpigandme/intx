"use strict";

const { bench } = require("./bench");
const { suite } = require("./suite");
const { rank } = require("./rank");
const { fallback, hinted } = require("./fallback");
suite.rank = rank;
bench.suite = suite;

module.exports = fallback() ?? hinted({ bench, suite, rank });
