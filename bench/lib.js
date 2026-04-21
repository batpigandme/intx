export default function bench(fn, name = fn.name, iter = 5e8) {
  let t0, t1, d0, d1;
  t0 = performance.now();
  fn(1e6); // WARMUP
  fn(1e7); // WARMUP
  fn(1e8); // WARMUP
  t1 = performance.now();
  d0 = t1 - t0;

  t0 = performance.now();
  const r = fn(iter);
  t1 = performance.now();
  d1 = t1 - t0;

  // console.log(`${name}:: Duration: ${d1.toFixed(3)}, Warm-up x5: ${d0.toFixed(3)}, Result: ${r}`);
  console.log(`${name}:: ${iter.toExponential()} iterations`);
  console.log(`\tDuration: ${d1.toFixed(3)} ms`);
  console.log(`\tRate: ${(+(iter * 1000 / d1).toPrecision(4)).toExponential()} iter/sec`)
}