"use strict";

/**
 * 32-bit bitwise left rotation (circular shift).
 *
 * @param {number} a - 32-bit integer operand to rotate.
 * @param {number} b - Rotation count.
 * @returns {number} Rotated signed 32-bit integer.
 */
function rotl(a, b) {
	return (a << b) | (a >>> (-b & 31)) | 0;
}

module.exports = rotl;
