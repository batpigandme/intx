'use strict';

// Environment detection
const ua = navigator.userAgent;
let engine = 'Unknown Engine';
if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
  const v = ua.match(/Chrome\/([0-9.]+)/)?.[1] || '';
  engine = `Google Chrome ${v} (V8)`;
} else if (ua.includes('Edg/')) {
  const v = ua.match(/Edg\/([0-9.]+)/)?.[1] || '';
  engine = `Microsoft Edge ${v} (V8)`;
} else if (ua.includes('Firefox/')) {
  const v = ua.match(/Firefox\/([0-9.]+)/)?.[1] || '';
  engine = `Mozilla Firefox ${v} (SpiderMonkey)`;
} else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
  const v = ua.match(/Version\/([0-9.]+)/)?.[1] || '';
  engine = `Apple Safari ${v} (JavaScriptCore)`;
}

const envInfo = document.getElementById('env-info');
if (envInfo) {
  envInfo.textContent = `Runtime: ${engine} | Platform: ${navigator.platform}`;
}

// UI Controller
let currentWorker = null;
let latestResults = null;

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const progressPercent = document.getElementById('progress-percent');
const summaryGrid = document.getElementById('summary-grid');
const tableBody = document.getElementById('table-body');
const exportBtns = document.getElementById('export-btns');

function formatOps(ops) {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)} Gops/s`;
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)} Mops/s`;
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(2)} Kops/s`;
  return `${ops.toFixed(0)} ops/s`;
}

function getFamilyTag(family) {
  switch (family) {
    case 'pipeline':
    case 'pipe':
      return '<span class="tag tag-pipe">Pipeline</span>';
    case 'parallel':
      return '<span class="tag tag-parallel">Parallel</span>';
    case 'float':
      return '<span class="tag tag-float">Float</span>';
    case 'bigint':
      return '<span class="tag tag-bigint">BigInt</span>';
    case 'stdlib':
      return '<span class="tag tag-stdlib">Stdlib</span>';
    default:
      return '';
  }
}

function runBenchmark() {
  if (currentWorker) {
    currentWorker.terminate();
  }

  startBtn.disabled = true;
  stopBtn.disabled = false;
  progressSection.style.display = 'block';
  progressBar.style.width = '0%';
  progressPercent.textContent = '0%';
  summaryGrid.style.display = 'none';
  exportBtns.style.display = 'none';

  const rounds = Number.parseInt(
    document.getElementById('rounds-select').value,
    10,
  );
  const iters = Number.parseInt(
    document.getElementById('iters-select').value,
    10,
  );
  const scope = document.getElementById('scope-select').value;

  try {
    currentWorker = new Worker('worker.js');
  } catch (_e) {
    // Fallback if accessed via direct file:// without web server
    fetch('worker.js')
      .then((res) => res.text())
      .then((code) => {
        const blob = new Blob([code], { type: 'text/javascript' });
        currentWorker = new Worker(URL.createObjectURL(blob));
        setupWorkerHandlers(rounds, iters, scope);
      })
      .catch((err) => {
        progressStatus.textContent = `Worker Load Error: ${err.message}. Please use 'npm run bench:browser' to serve locally.`;
        finishBenchmark();
      });
    return;
  }

  setupWorkerHandlers(rounds, iters, scope);
}

function setupWorkerHandlers(rounds, iters, scope) {
  currentWorker.onmessage = (e) => {
    const data = e.data;
    if (data.type === 'status' || data.type === 'progress') {
      progressStatus.textContent = data.message;
      if (data.percent !== undefined) {
        progressBar.style.width = `${data.percent}%`;
        progressPercent.textContent = `${data.percent}%`;
      }
    } else if (data.type === 'complete') {
      renderResults(data.results, data.totalDuration, data.totalOps);
      finishBenchmark();
    }
  };

  currentWorker.onerror = (err) => {
    progressStatus.textContent = `Error: ${err.message}`;
    finishBenchmark();
  };

  currentWorker.postMessage({ rounds, iters, scope });
}

function finishBenchmark() {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (currentWorker) {
    currentWorker.terminate();
    currentWorker = null;
  }
}

function renderResults(results, totalDuration, totalOps) {
  latestResults = results;
  progressSection.style.display = 'none';
  summaryGrid.style.display = 'grid';
  exportBtns.style.display = 'flex';

  const winner = results[0];
  document.getElementById('card-winner-name').textContent = winner.name;
  document.getElementById('card-winner-ops').textContent = formatOps(
    winner.medianOps,
  );

  const peakOps = Math.max(...results.map((r) => r.maxOps));
  document.getElementById('card-peak-ops').textContent = formatOps(peakOps);
  document.getElementById('card-total-ops').textContent = `${(
    totalOps / 1e6
  ).toFixed(1)} Million`;
  document.getElementById('card-duration').textContent =
    `Duration: ${totalDuration.toFixed(2)}s`;

  const baselineOps = winner.medianOps;

  tableBody.innerHTML = results
    .map((res, idx) => {
      const rank = idx + 1;
      const rankClass =
        rank === 1
          ? 'rank-1'
          : rank === 2
            ? 'rank-2'
            : rank === 3
              ? 'rank-3'
              : '';
      const relativeRatio = res.medianOps / baselineOps;
      const relPercent = Math.max(1, relativeRatio * 100).toFixed(1);
      const relativeText =
        idx === 0 ? 'baseline' : `${relativeRatio.toFixed(2)}x`;
      const isWinner = idx === 0;

      return `
        <tr>
          <td class="rank-cell ${rankClass}">${rank}</td>
          <td>
            <div class="candidate-name">
              <span>${res.name}</span>
              ${getFamilyTag(res.family)}
            </div>
          </td>
          <td class="mono"><strong>${formatOps(res.medianOps)}</strong></td>
          <td class="mono">${formatOps(res.maxOps)}</td>
          <td class="mono">±${res.moePercent.toFixed(1)}%</td>
          <td class="bar-col">
            <div class="rel-bar-wrap">
              <div class="rel-bar-inner ${isWinner ? 'winner' : ''}" style="width: ${relPercent}%"></div>
            </div>
          </td>
          <td class="mono">${relativeText}</td>
        </tr>
      `;
    })
    .join('');
}

startBtn.addEventListener('click', runBenchmark);
stopBtn.addEventListener('click', () => {
  if (currentWorker) {
    currentWorker.terminate();
    currentWorker = null;
  }
  progressStatus.textContent = 'Benchmark cancelled by user.';
  finishBenchmark();
});

// Export Handlers
document.getElementById('export-json-btn').addEventListener('click', () => {
  if (!latestResults) return;
  const blob = new Blob([JSON.stringify(latestResults, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'benchx-u32-wmul-browser.json';
  a.click();
});

document.getElementById('export-csv-btn').addEventListener('click', () => {
  if (!latestResults) return;
  const headers = [
    'Rank',
    'Candidate',
    'Family',
    'MedianOps',
    'PeakOps',
    'MoE_Percent',
    'Relative',
  ];
  const baseline = latestResults[0].medianOps;
  const rows = latestResults.map((r, i) => [
    i + 1,
    `"${r.name}"`,
    r.family,
    r.medianOps.toFixed(0),
    r.maxOps.toFixed(0),
    r.moePercent.toFixed(2),
    (r.medianOps / baseline).toFixed(3),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'benchx-u32-wmul-browser.csv';
  a.click();
});

document.getElementById('export-md-btn').addEventListener('click', () => {
  if (!latestResults) return;
  const baseline = latestResults[0].medianOps;
  let md =
    '| Rank | Candidate | Median (ops/s) | Peak (ops/s) | MoE (±%) | Relative |\n';
  md += '|:---:|:---|:---:|:---:|:---:|:---:|\n';
  latestResults.forEach((r, i) => {
    const rel =
      i === 0 ? 'baseline' : `${(r.medianOps / baseline).toFixed(2)}x`;
    md += `| ${i + 1} | ${r.name} | ${formatOps(r.medianOps)} | ${formatOps(r.maxOps)} | ±${r.moePercent.toFixed(1)}% | ${rel} |\n`;
  });
  navigator.clipboard.writeText(md).then(() => {
    alert('Markdown table copied to clipboard!');
  });
});
