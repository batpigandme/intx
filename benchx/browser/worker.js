'use strict';

function computeStats(samples, itersPerRound) {
  const n = samples.length;
  const sortedTimes = [...samples].sort((a, b) => a - b);
  const minTime = sortedTimes[0];
  const maxTime = sortedTimes[n - 1];
  const medianTime =
    n % 2 === 1
      ? sortedTimes[Math.floor(n / 2)]
      : (sortedTimes[n / 2 - 1] + sortedTimes[n / 2]) / 2;

  const sum = sortedTimes.reduce((acc, v) => acc + v, 0);
  const meanTime = sum / n;
  const variance =
    sortedTimes.reduce((acc, v) => acc + (v - meanTime) ** 2, 0) / (n - 1 || 1);
  const stddev = Math.sqrt(variance);
  const moePercent = (stddev / meanTime) * 100;

  const maxOps = (itersPerRound * 1000) / minTime;
  const medianOps = (itersPerRound * 1000) / medianTime;
  const meanOps = (itersPerRound * 1000) / meanTime;

  return {
    minTime,
    maxTime,
    medianTime,
    meanTime,
    stddev,
    moePercent,
    maxOps,
    medianOps,
    meanOps,
  };
}

function createMonomorphicRunner(fn, name, isStrided = false, a = 0xdeadbeef) {
  const r = new Uint32Array(2);
  const callExpr = isStrided ? 'fn(r[1], a, r, 1, 0);' : 'fn(r[1], a, r);';
  const cleanName = (name || 'kernel').replace(/[^a-zA-Z0-9]/g, '_');
  return new Function(
    'fn',
    'a',
    'r',
    `
    /* [BenchX Browser Monomorphic Compilation Unit: ${cleanName}_${Date.now()}_${Math.random()}] */
    return function benchKernel_${cleanName}(n) {
      r[1] = 1;
      for (let i = 0; i < n; i++) {
        ${callExpr}
      }
      return r;
    };
  `,
  )(fn, a, r);
}

// Candidate Implementations
const candidates = {
  'limb16-parallel-bitwise-lo': {
    family: 'parallel',
    fn: (a, b, out) => {
      const al = a & 0xffff;
      const ah = a >>> 16;
      const bl = b & 0xffff;
      const bh = b >>> 16;
      const p0 = al * bl;
      const p1 = ah * bl;
      const p2 = al * bh;
      const p3 = ah * bh;
      const mid = (p0 >>> 16) + (p1 & 0xffff) + (p2 & 0xffff);
      out[0] = (p3 + (p1 >>> 16) + (p2 >>> 16) + (mid >>> 16)) >>> 0;
      out[1] = ((p0 & 0xffff) | ((mid & 0xffff) << 16)) >>> 0;
      return out;
    },
  },
  'limb16-parallel-imul-lo': {
    family: 'parallel',
    fn: (a, b, out) => {
      const al = a & 0xffff;
      const ah = a >>> 16;
      const bl = b & 0xffff;
      const bh = b >>> 16;
      const p0 = al * bl;
      const p1 = ah * bl;
      const p2 = al * bh;
      const p3 = ah * bh;
      const mid = (p0 >>> 16) + (p1 & 0xffff) + (p2 & 0xffff);
      out[0] = (p3 + (p1 >>> 16) + (p2 >>> 16) + (mid >>> 16)) >>> 0;
      out[1] = Math.imul(a, b) >>> 0;
      return out;
    },
  },
  'limb16-parallel-imul-all': {
    family: 'parallel',
    fn: (a, b, out) => {
      const al = a & 0xffff;
      const ah = a >>> 16;
      const bl = b & 0xffff;
      const bh = b >>> 16;
      const p0 = Math.imul(al, bl);
      const p1 = Math.imul(ah, bl);
      const p2 = Math.imul(al, bh);
      const p3 = Math.imul(ah, bh);
      const mid = (p0 >>> 16) + (p1 & 0xffff) + (p2 & 0xffff);
      out[0] = (p3 + (p1 >>> 16) + (p2 >>> 16) + (mid >>> 16)) >>> 0;
      out[1] = Math.imul(a, b) >>> 0;
      return out;
    },
  },
  'limb16-parallel-imul-cached': {
    family: 'parallel',
    fn: (() => {
      const imul = Math.imul;
      return (a, b, out) => {
        const al = a & 0xffff;
        const ah = a >>> 16;
        const bl = b & 0xffff;
        const bh = b >>> 16;
        const p0 = imul(al, bl);
        const p1 = imul(ah, bl);
        const p2 = imul(al, bh);
        const p3 = imul(ah, bh);
        const mid = (p0 >>> 16) + (p1 & 0xffff) + (p2 & 0xffff);
        out[0] = (p3 + (p1 >>> 16) + (p2 >>> 16) + (mid >>> 16)) >>> 0;
        out[1] = imul(a, b) >>> 0;
        return out;
      };
    })(),
  },
  'limb16-pipeline-bitwise-lo': {
    family: 'pipeline',
    fn: (a, b, out) => {
      const al = a & 0xffff;
      const ah = a >>> 16;
      const bl = b & 0xffff;
      const bh = b >>> 16;
      const ll = al * bl;
      const hl = ah * bl + (ll >>> 16);
      const lh = al * bh + (hl & 0xffff);
      const hh = ah * bh + (hl >>> 16) + (lh >>> 16);
      out[0] = hh >>> 0;
      out[1] = ((ll & 0xffff) | (lh << 16)) >>> 0;
      return out;
    },
  },
  'limb16-pipeline-imul-lo': {
    family: 'pipeline',
    fn: (a, b, out) => {
      const al = a & 0xffff;
      const ah = a >>> 16;
      const bl = b & 0xffff;
      const bh = b >>> 16;
      const ll = al * bl;
      const hl = ah * bl + (ll >>> 16);
      const lh = al * bh + (hl & 0xffff);
      const hh = ah * bh + (hl >>> 16) + (lh >>> 16);
      out[0] = hh >>> 0;
      out[1] = Math.imul(a, b) >>> 0;
      return out;
    },
  },
  'limb16-pipeline-imul-all': {
    family: 'pipeline',
    fn: (a, b, out) => {
      const al = a & 0xffff;
      const ah = a >>> 16;
      const bl = b & 0xffff;
      const bh = b >>> 16;
      const ll = Math.imul(al, bl);
      const hl = Math.imul(ah, bl) + (ll >>> 16);
      const lh = Math.imul(al, bh) + (hl & 0xffff);
      const hh = Math.imul(ah, bh) + (hl >>> 16) + (lh >>> 16);
      out[0] = hh >>> 0;
      out[1] = Math.imul(a, b) >>> 0;
      return out;
    },
  },
  'limb16-pipeline-imul-cached': {
    family: 'pipeline',
    fn: (() => {
      const imul = Math.imul;
      return (a, b, out) => {
        const al = a & 0xffff;
        const ah = a >>> 16;
        const bl = b & 0xffff;
        const bh = b >>> 16;
        const ll = imul(al, bl);
        const hl = imul(ah, bl) + (ll >>> 16);
        const lh = imul(al, bh) + (hl & 0xffff);
        const hh = imul(ah, bh) + (hl >>> 16) + (lh >>> 16);
        out[0] = hh >>> 0;
        out[1] = imul(a, b) >>> 0;
        return out;
      };
    })(),
  },
  'limb16-imul-import': {
    family: 'pipeline',
    fn: (() => {
      function mul(a, b) {
        return Math.imul(a, b) >>> 0;
      }
      return (a, b, out) => {
        const al = a & 0xffff;
        const ah = a >>> 16;
        const bl = b & 0xffff;
        const bh = b >>> 16;
        const ll = mul(al, bl);
        const hl = (mul(ah, bl) + (ll >>> 16)) >>> 0;
        const lh = (mul(al, bh) + (hl & 0xffff)) >>> 0;
        const hh = (mul(ah, bh) + (hl >>> 16) + (lh >>> 16)) >>> 0;
        out[0] = hh;
        out[1] = mul(a, b);
        return out;
      };
    })(),
  },
  'limb16-float48-bitwise-lo': {
    family: 'float',
    fn: (a, b, out) => {
      const al = a & 0xffff;
      const ah = a >>> 16;
      const u = b >>> 0;
      const p0 = al * u;
      const p1 = ah * u;
      const mid = (p0 * (1 / 65536)) | 0;
      const hi = (p1 + mid) * (1 / 65536);
      out[0] = hi >>> 0;
      out[1] = ((p0 & 0xffff) | (((p1 + mid) & 0xffff) << 16)) >>> 0;
      return out;
    },
  },
  'limb16-float48-imul-lo': {
    family: 'float',
    fn: (a, b, out) => {
      const al = a & 0xffff;
      const ah = a >>> 16;
      const u = b >>> 0;
      const p0 = al * u;
      const p1 = ah * u;
      const mid = (p0 * (1 / 65536)) | 0;
      const hi = (p1 + mid) * (1 / 65536);
      out[0] = hi >>> 0;
      out[1] = Math.imul(a, b) >>> 0;
      return out;
    },
  },
  'float64-corrected': {
    family: 'float',
    fn: (a, b, out) => {
      const u = a >>> 0;
      const v = b >>> 0;
      const lo = Math.imul(u, v) >>> 0;
      const d = u * v - lo;
      const hi = (d * 2.3283064365386963e-10 + 0.5) >>> 0;
      out[0] = hi;
      out[1] = lo;
      return out;
    },
  },
  'stdlib/umuldw.assign': {
    family: 'stdlib',
    isStrided: true,
    fn: (a, b, out, stride, offset) => {
      const u1 = a >>> 0;
      const u2 = b >>> 0;
      const u = (u1 & 0xffff) * (u2 & 0xffff);
      const w = (u1 >>> 16) * (u2 & 0xffff) + (u >>> 16);
      const x = (u1 & 0xffff) * (u2 >>> 16) + (w & 0xffff);
      out[offset] = ((u1 >>> 16) * (u2 >>> 16) + (w >>> 16) + (x >>> 16)) >>> 0;
      out[offset + stride] = ((u & 0xffff) | (x << 16)) >>> 0;
      return out;
    },
  },
  'bigint-literal-mask': {
    family: 'bigint',
    isBigInt: true,
    fn: (a, b, out) => {
      const prod = BigInt(a >>> 0) * BigInt(b >>> 0);
      out[0] = Number(prod >> 32n);
      out[1] = Number(prod & 0xffffffffn);
      return out;
    },
  },
  'bigint-as-uint32': {
    family: 'bigint',
    isBigInt: true,
    fn: (a, b, out) => {
      const prod = BigInt(a >>> 0) * BigInt(b >>> 0);
      out[0] = Number(prod >> 32n);
      out[1] = Number(BigInt.asUintN(32, prod));
      return out;
    },
  },
  'bigint-as-uintn-literal': {
    family: 'bigint',
    isBigInt: true,
    fn: (a, b, out) => {
      const prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0));
      out[0] = Number(BigInt.asUintN(32, prod >> 32n));
      out[1] = Number(BigInt.asUintN(32, prod));
      return out;
    },
  },
  'bigint-as-uintn-module-const': {
    family: 'bigint',
    isBigInt: true,
    fn: (() => {
      const SHIFT_32 = 32n;
      return (a, b, out) => {
        const prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0));
        out[0] = Number(BigInt.asUintN(32, prod >> SHIFT_32));
        out[1] = Number(BigInt.asUintN(32, prod));
        return out;
      };
    })(),
  },
  'bigint-as-uintn-local-const': {
    family: 'bigint',
    isBigInt: true,
    fn: (a, b, out) => {
      const S32 = 32n;
      const prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0));
      out[0] = Number(BigInt.asUintN(32, prod >> S32));
      out[1] = Number(BigInt.asUintN(32, prod));
      return out;
    },
  },
  'bigint-as-uint64-imul-lo': {
    family: 'bigint',
    isBigInt: true,
    fn: (() => {
      const SHIFT_32 = 32n;
      return (a, b, out) => {
        const prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0));
        out[0] = Number(BigInt.asUintN(32, prod >> SHIFT_32));
        out[1] = Math.imul(a, b) >>> 0;
        return out;
      };
    })(),
  },
  'bigint-hi': {
    family: 'bigint',
    isBigInt: true,
    fn: (a, b, out) => {
      out[0] = Number(
        BigInt.asUintN(
          32,
          BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0)) >> 32n,
        ),
      );
      out[1] = Math.imul(a, b) >>> 0;
      return out;
    },
  },
};

self.onmessage = (e) => {
  const { rounds, iters, scope } = e.data;
  const taskKeys = Object.keys(candidates).filter((key) => {
    const item = candidates[key];
    if (scope === 'all') return true;
    if (scope === 'fast') return item.family !== 'bigint';
    if (scope === 'limb16')
      return item.family === 'parallel' || item.family === 'pipeline';
    if (scope === 'bigint') return item.family === 'bigint';
    return true;
  });

  const tasks = taskKeys.map((key) => {
    const item = candidates[key];
    const taskIters = item.isBigInt ? Math.min(iters, 5e6) : iters;
    return {
      name: key,
      family: item.family,
      iters: taskIters,
      runner: createMonomorphicRunner(item.fn, key, item.isStrided),
      samples: [],
    };
  });

  const totalSteps = tasks.length * rounds;
  let currentStep = 0;

  self.postMessage({
    type: 'status',
    message: '🔥 Warmup: Tiering up JIT compilers...',
  });
  for (const task of tasks) {
    task.runner(Math.min(task.iters, 2e6));
  }

  const tStart = performance.now();

  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      currentStep++;
      self.postMessage({
        type: 'progress',
        percent: Math.round((currentStep / totalSteps) * 100),
        message: `[Round ${round}/${rounds}] Sampling ${task.name}...`,
      });

      const t0 = performance.now();
      task.runner(task.iters);
      const t1 = performance.now();
      task.samples.push(t1 - t0);
    }
  }

  const tEnd = performance.now();
  const totalDuration = (tEnd - tStart) / 1000;

  const results = tasks.map((task) => {
    const stats = computeStats(task.samples, task.iters);
    return {
      name: task.name,
      family: task.family,
      iters: task.iters,
      ...stats,
    };
  });

  results.sort((a, b) => b.medianOps - a.medianOps);

  self.postMessage({
    type: 'complete',
    results,
    totalDuration,
    totalOps: tasks.reduce((sum, t) => sum + t.iters * rounds, 0),
  });
};
