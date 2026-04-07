export default function bench(fn, name = "Anonymous") {
  let t0, t1, d0, d1;
  t0 = performance.now();
  fn(); // WARMUP
  fn(); // WARMUP
  t1 = performance.now();
  d0 = t1 - t0;

  t0 = performance.now();
  const r = fn();
  t1 = performance.now();
  d1 = t1 - t0;

  console.log(`${name}:: Duration: ${d1.toFixed(3)}, Warm-up: ${d0.toFixed(3)}, Result: ${r}`);
}