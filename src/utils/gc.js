"use strict";

const { sleep } = require("./sleep");

/**
 * Invokes V8's full garbage collection if exposed via --expose-gc,
 * with an optional pause to let background sweeping threads settle.
 *
 * @param {number} [pause=0] - Milliseconds to sleep after triggering GC.
 */
function gc(pause = 0) {
	if (typeof global.gc === "function") {
		global.gc();
		if (pause > 0) {
			sleep(pause);
		}
	}
}

module.exports = {
	gc,
};
