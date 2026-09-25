#!/bin/bash
# boxA boot 3 OSR calling-pattern sweep. Stock intx a8de2d6 via git archive at /tmp/intx-stock.
D=$EXPERIMENTS_DIR/data-boxA/osr-sweep
cd /tmp/intx-stock/scratch-osr
declare -A ROWS=([i32-mul]=7 [i32-add]=7 [i32]=9 [u32-mulhi]=19 [u32-mulwide]=18)
for blk in 1 2; do
 for B in /opt/node22/bin/node /usr/local/nvm/versions/node/v24.19.0/bin/node /usr/local/nvm/versions/node/v26.7.0/bin/node; do
  v=$($B -v | tr -d v)
  out=$D/block$blk-node$v.jsonl; : > $out
  echo "{\"meta\":\"boxA boot 3\",\"binary\":\"$B\",\"start\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
  for t in i32-mul i32-add i32 u32-mulhi u32-mulwide; do
   for ((i=0;i<${ROWS[$t]};i++)); do
    for p in cold warm; do $B osr.js $t $i $p >> $out 2>&1 || echo "{\"error\":\"$t $i $p exit $?\"}" >> $out; done
   done
  done
  echo "{\"meta\":\"end\",\"end\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
  echo "$(date -u +%T) block$blk node$v done: $(grep -c median $out) results"
 done
done
