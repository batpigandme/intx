"use strict";

const { suite } = require("./suite");
const { renderTable } = require("./render");

function getComparator(order) {
	if (typeof order === "function") {
		return order;
	}

	switch (order) {
		case "median":
			return (a, b) => a.medianCycles - b.medianCycles;
		case "mean":
			return (a, b) => a.meanCycles - b.meanCycles;
		case "min":
		case "best":
			return (a, b) => a.minCycles - b.minCycles;
		case "max":
		case "worst":
			return (a, b) => a.maxCycles - b.maxCycles;
		case "ipc":
			return (a, b) => b.ipc - a.ipc;
		default:
			throw new Error(
				`Unknown comparison order for cycles: "${order}". Expected "median", "mean", "min", "best", "max", or "ipc".`,
			);
	}
}

function rank(title, runners, options = {}) {
	const order = options.order ?? options.metric ?? "best";
	const comparator = getComparator(order);
	const silent = !!options.silent;

	const results = suite(title, runners, {
		...options,
		render: false,
	});

	results.sort(comparator);

	if (!silent) {
		renderTable(results, {
			ranked: true,
			width: options.width,
			details: options.details,
			metric: options.metric ?? "best",
			order,
			digits: options.digits,
			precision: options.precision,
			snap: options.snap,
		});
	}

	return results;
}

module.exports = {
	rank,
	getComparator,
};
