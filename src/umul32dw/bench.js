"use strict";

import bench from "../bench/index.js";
import s16x1 from "./split16x1.js";
import s16x1i from "./split16x1imul.js";
import s16x2 from "./split16x2.js";
import s16x2i from "./split16x2imul.js";

const ITER = 1e7;

function toHex(dw) {
  return dw.reduce((a, x) => a + x.toString(16), "");
}


bench(function dummy() {
  let sum = 0;
  for (let i = 0; i < ITER; i++)
    sum += i;
  return sum;
}, "Dummy warmup")

bench(function b16x2() {
  const a = 0x81276345;
  let r = [0, 1];
  
  for (let i = 0; i < ITER; i++) {
    r = s16x2(r[1], a);
  }
  
  return toHex(r);
}, "16x2");

bench(function b16x1() {
  const a = 0x81276345;
  let r = [0, 1];

  for (let i = 0; i < ITER; i++) {
    r = s16x1(r[1], a);
  }

  return toHex(r);
}, "16x1");

bench(function b16x1i() {
  const a = 0x81276345;
  let r = [0, 1];

  for (let i = 0; i < ITER; i++) {
    r = s16x1i(r[1], a);
  }

  return toHex(r);
}, "16x1i");

bench(function b16x2i() {
  const a = 0x81276345;
  let r = [0, 1];

  for (let i = 0; i < ITER; i++) {
    r = s16x2i(r[1], a);
  }

  return toHex(r);
}, "16x2i");
