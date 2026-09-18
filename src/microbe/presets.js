"use strict";

/**
 * Standard predefined benchmark option presets.
 * Monomorphic, frozen option objects with single-word property names.
 */
const short = Object.freeze({
	mode: "sequential",
	rounds: 5,
	dur: 40,
	pause: 20,
	cooldown: 0,
	prime: false,
});

const medium = Object.freeze({
	mode: "sequential",
	rounds: 10,
	dur: 50,
	pause: 30,
	cooldown: 0,
	prime: false,
});

const long = Object.freeze({
	mode: "sequential",
	rounds: 20,
	dur: 50,
	pause: 50,
	cooldown: 0,
	prime: true,
});

const presets = Object.freeze({
	short,
	medium,
	long,
});

module.exports = {
	presets,
};
