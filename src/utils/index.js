"use strict";

const { randomU32, randomI32 } = require("./random");
const { sleep } = require("./sleep");
const { gc } = require("./gc");

module.exports = {
	randomU32,
	randomI32,
	sleep,
	gc,
};
