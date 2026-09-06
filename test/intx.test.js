'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const intx = require('../index.js');

test('intx: root exports and u32.wmul', () => {
  assert.ok(intx.u32, 'intx.u32 should exist');
  assert.ok(
    typeof intx.u32.mul === 'function',
    'intx.u32.mul should be a function',
  );
  assert.ok(
    typeof intx.u32.wmul === 'function',
    'intx.u32.wmul should be a function',
  );

  assert.equal(intx.u32.mul(0x12345678, 0x87654321), 1891143032);

  const out = new Uint32Array(2);
  intx.u32.wmul(0xffffffff, 0xffffffff, out);

  // (2^32 - 1)^2 = 2^64 - 2^33 + 1 -> hi: 0xfffffffe, lo: 0x00000001
  assert.equal(out[0], 0xfffffffe);
  assert.equal(out[1], 0x00000001);
});
