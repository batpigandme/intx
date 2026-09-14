"use strict";

const { bench } = require("./bench");
const { suite } = require("./suite");
const { compare } = require("./compare");
const { createRunner } = require("./create-runner");

module.exports = {
	bench,
	suite,
	compare,
	createRunner,
};
