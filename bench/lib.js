export default function bench(fn, name = "Anonymous", ITER = 1e7) {
  let t0, t1, d0, d1;
  t0 = performance.now();
  fn(); // WARMUP
  fn(); // WARMUP
  fn(); // WARMUP
  fn(); // WARMUP
  fn(); // WARMUP
  t1 = performance.now();
  d0 = t1 - t0;

  t0 = performance.now();
  const r = fn();
  t1 = performance.now();
  d1 = t1 - t0;

  // console.log(`${name}:: Duration: ${d1.toFixed(3)}, Warm-up x5: ${d0.toFixed(3)}, Result: ${r}`);
  console.log(`${name}::`);
  console.log(`\tDuration: ${d1.toFixed(3)}`);
  console.log(`\tRate: ${(ITER * 1000 / d1).toExponential()}`)
}