"use strict";

const path = require("node:path");

/**
 * Retrieves the absolute path of the external script that invoked microbe bytecode tooling.
 *
 * Uses V8 CallSite stack introspection to bypass internal orchestration frames
 * and isolate the user-facing benchmark or showdown script.
 *
 * @returns {string} Absolute path to the caller script.
 */
function getCallerFile() {
	const originalPrepareStackTrace = Error.prepareStackTrace;
	let callerPath = null;

	try {
		Error.prepareStackTrace = (_, stack) => stack;
		const error = new Error();
		const stack = error.stack;

		if (Array.isArray(stack)) {
			const currentDir = __dirname;
			for (const callSite of stack) {
				const fileName = callSite.getFileName();
				if (!fileName) continue;
				const normalized = path.resolve(fileName);
				// Skip frames inside src/microbe/bytecode/
				if (normalized.startsWith(currentDir)) continue;
				// Skip Node.js internal modules (node:*)
				if (fileName.startsWith("node:")) continue;

				callerPath = normalized;
				break;
			}
		}
	} finally {
		Error.prepareStackTrace = originalPrepareStackTrace;
	}

	if (callerPath) {
		return callerPath;
	}

	if (process.argv[1]) {
		return path.resolve(process.argv[1]);
	}

	throw new Error(
		"Unable to determine caller script file path for bytecode re-execution.",
	);
}

module.exports = {
	getCallerFile,
};
