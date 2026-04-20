"use strict";

import bench from "./lib.js";
import f16x1 from '#src/umul32dw/split16x1.js';
import f16x1c from '#src/umul32dw/split16x1c.js';
import f16x1i from '#src/umul32dw/split16x1imul.js';
import f16x1ic from '#src/umul32dw/split16x1imulc.js';
import f16x2 from '#src/umul32dw/split16x2.js';
import f16x2c from '#src/umul32dw/split16x2c.js';
import f16x2i from '#src/umul32dw/split16x2imul.js';
import f16x2ic from '#src/umul32dw/split16x2imulc.js';
import f16x2ai from '#src/umul32dw/split16x2allimul.js';
import f16x2aic from '#src/umul32dw/split16x2allimulc.js';
import f16x2ais from '#src/umul32dw/split16x2ais.js';
import umul32dw from '@stdlib/number-uint32-base-muldw';

const fstdlib = umul32dw.assign;

const ITER = 1e7;
const a = 0xdeadbeef;
const r = new Uint32Array(2);

bench(b16x1, "16x1");
bench(b16x1c, "16x1c");
bench(b16x1i, "16x1i");
bench(b16x1ic, "16x1ic");

bench(b16x2, "16x2");
bench(b16x2c, "16x2c");
bench(b16x2ic, "16x2ic");
bench(b16x2i, "16x2i");
bench(b16x2ai, "16x2ai");
bench(b16x2aic, "16x2aic");
bench(b16x2ais, "16x2ais");

bench(bstdlib, "stdlib");






function b16x1() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x1(r[1], a, r);
  }
  return r;
}

function b16x1i() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x1i(r[1], a, r);
  }
  return r;
}

function b16x2() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x2(r[1], a, r);
  }
  return r;
}

function b16x2i() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x2i(r[1], a, r);
  }
  return r;
}

function b16x2ai() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x2ai(r[1], a, r);
  }
  return r;
}

function b16x2ais() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x2ais(r[1], a, r);
  }
  return r;
}




function b16x2c() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x2c(r[1], a, r);
  }
  return r;
}

function b16x2ic() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x2ic(r[1], a, r);
  }
  return r;
}

function b16x2aic() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x2aic(r[1], a, r);
  }
  return r;
}


function b16x1c() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x1c(r[1], a, r);
  }
  return r;
}


function b16x1ic() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    f16x1ic(r[1], a, r);
  }
  return r;
}

function bstdlib() {
  r[1] = 1;
  for (let i = 0; i < ITER; i++) {
    fstdlib(r[1], a, r, 1, 0);
  }
  return r;
}