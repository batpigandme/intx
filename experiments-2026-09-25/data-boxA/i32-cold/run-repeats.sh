#!/bin/bash
# boxA boot 4: 8 repeats x cold/warm of i32 divmod (i32 showdown row 5, iters 1e7) and i32.add Parallel 4x (row 2, iters 1e8).
D=$EXPERIMENTS_DIR/data-boxA/i32-cold
cd /tmp/intx-stock/scratch-osr
for B in /opt/node22/bin/node /usr/local/nvm/versions/node/v24.19.0/bin/node /usr/local/nvm/versions/node/v26.7.0/bin/node; do
 v=$($B -v | tr -d v); out=$D/repeats-node$v.jsonl; : > $out
 echo "{\"meta\":\"boxA boot 4\",\"binary\":\"$B\",\"start\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
 for r in 1 2 3 4 5 6 7 8; do for p in cold warm; do
  $B osr2.js i32 5 $p >> $out 2>&1
  $B osr2.js i32-add 2 $p >> $out 2>&1
 done; done
 echo "$(date -u +%T) node$v: $(grep -c median $out) results"
done
