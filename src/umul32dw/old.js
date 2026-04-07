"use strict";

const LOW_16 = 0xffff;
const TWO_16 = 0x10000;

function umul32dw(a, b) { // 64-bit result of multiplying two 32-bit uint
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & LOW_16;

  const ahb = ah * b;
  const alb = al * b;

  const lo = (((ahb & LOW_16) << 16) + (alb >>> 0)) >>> 0;
  const hi = ((ahb + ((alb / TWO_16) >>> 0)) / TWO_16) >>> 0;

  return [hi, lo];
}

function umul32dw_imul(a, b) { // Using Math.imul for the lo part
  a >>>= 0;
  b >>>= 0;

  const ah = a >>> 16;
  const al = a & LOW_16;

  const ahb = ah * b;
  const alb = al * b;

  const lo = Math.imul(a, b) >>> 0;
  const hi = ((ahb + ((alb / TWO_16) >>> 0)) / TWO_16) >>> 0;

  return [hi, lo];
}

/**************************************/

const ITER = 1e7;

/**************************************
// old bench: deoptimizes at second run, dunno why

function bench(fmul) {
  const a = 0x81276345;
  let r = [0, 1];
  
  let t = performance.now();
  for (let i = 0; i < ITER; i++) {
    r = fmul(r[1], a);
  }
  t = performance.now() - t;

  console.log(t.toFixed(3), r);
}

bench(umul32dw);
bench(umul32dw);
bench(umul32dw_imul);
bench(umul32dw);
bench(umul32dw_imul);
bench(umul32dw_imul);

/**************************************/


function bench(fn) {
  // fn(); // WARMUP
  // fn(); // WARMUP
  // fn(); // WARMUP
  let t = performance.now();
  const r = fn();
  t = performance.now() - t;
  console.log(t.toFixed(3), r);
}

function bench_manual() {
  const a = 0x81276345;
  let r = [0, 1];
  for (let i = 0; i < ITER; i++) {
    r = umul32dw(r[1], a);
  }
  return r;
}

function bench_imul() {
  const a = 0x81276345;
  let r = [0, 1];
  for (let i = 0; i < ITER; i++) {
    r = umul32dw_imul(r[1], a);
  }
  return r;
}


bench(bench_manual);
bench(bench_imul);
bench(bench_manual);
bench(bench_imul);


