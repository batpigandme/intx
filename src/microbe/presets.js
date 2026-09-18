"use strict";

/**
 * Standard predefined benchmark option presets.
 * Monomorphic, frozen option objects with single-word property names.
 */
const short = Object.freeze({
	mode: "sequential",
	rounds: 5,
	dur: 50,
	pause: 20,
	cooldown: 0,
	prime: false,
});

const medium = Object.freeze({
	mode: "shuffled",
	rounds: 10,
	dur: 100,
	pause: 20,
	cooldown: 0,
	prime: false,
});

const long = Object.freeze({
	mode: "shuffled",
	rounds: 20,
	dur: 200,
	pause: 50,
	cooldown: 20,
	prime: true,
});

const presets = Object.freeze({
	short,
	medium,
	long,
});

module.exports = {
	presets,
	short,
	medium,
	long,
};
