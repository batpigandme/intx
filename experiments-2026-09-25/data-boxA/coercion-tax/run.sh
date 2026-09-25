#!/bin/bash
# boxA boot 4: exploration 01's seven rows, three calling patterns, stock a8de2d6 (git archive at /tmp/intx-stock).
D=$EXPERIMENTS_DIR/data-boxA/coercion-tax
cd /tmp/intx-stock/scratch-osr
for blk in 1 2; do
 for B in /opt/node22/bin/node /usr/local/nvm/versions/node/v24.19.0/bin/node /usr/local/nvm/versions/node/v26.7.0/bin/node; do
  v=$($B -v | tr -d v); out=$D/block$blk-node$v.jsonl; : > $out
  echo "{\"meta\":\"boxA boot 4\",\"binary\":\"$B\",\"start\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
  for i in 0 1 2 3 4 5 6; do for p in cold warm calib; do
   $B osr2.js exp01 $i $p 1e8 2e6 >> $out 2>&1 || echo "{\"error\":\"exp01 $i $p exit $?\"}" >> $out
  done; done
  echo "{\"meta\":\"end\",\"end\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
  echo "$(date -u +%T) block$blk node$v: $(grep -c median $out) results"
 done
done
