#!/bin/bash
# boxD boot 2: measure every audit-flagged row, cold vs tiny-call warm, Node 24 and 26, two blocks, one process at a time.
D=$EXPERIMENTS_DIR/data-boxD/osr-audit
cd /tmp/intx-stock/scratch-audit
n=$(python3 -c "import json;print(len(json.load(open('rows.json'))))")
for blk in 1 2; do
 for B in /usr/local/nvm/versions/node/v24.19.0/bin/node /usr/local/nvm/versions/node/v26.7.0/bin/node; do
  v=$($B -v | tr -d v); out=$D/block$blk-node$v.jsonl; : > $out
  echo "{\"meta\":\"boxD boot 2\",\"binary\":\"$B\",\"start\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
  for ((r=0;r<n;r++)); do
   f=$(python3 -c "import json;print(json.load(open('rows.json'))[$r]['file'])"); i=$(python3 -c "import json;print(json.load(open('rows.json'))[$r]['idx'])")
   for p in cold warm; do $B capture-run.js "$f" "$i" $p >> $out 2>/dev/null || echo "{\"error\":\"$f $i $p\"}" >> $out; done
  done
  echo "{\"meta\":\"end\",\"end\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
  echo "$(date -u +%T) block$blk node$v: $(grep -c median $out) results"
 done
done
