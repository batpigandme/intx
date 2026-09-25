#!/bin/bash
# boxA boot 4: warm-up strategy comparison. 5 cases x 5 strategies x 3 Node versions x 12 repeats, one process at a time.
# Repeats are interleaved (rep loop outermost) so slow drift on the host spreads across strategies instead of hitting one.
D=$EXPERIMENTS_DIR/data-boxA/warmup
cd /tmp/intx-stock/scratch-osr
for B in /opt/node22/bin/node /usr/local/nvm/versions/node/v24.19.0/bin/node /usr/local/nvm/versions/node/v26.7.0/bin/node; do
 v=$($B -v | tr -d v); out=$D/node$v.jsonl; : > $out
 echo "{\"meta\":\"boxA boot 4\",\"binary\":\"$B\",\"start\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
 for rep in $(seq 12); do
  for c in exp01r6 rc-div-closure rc-rotl-closure rc-div-arg rc-rotl-arg; do
   for s in S0 S1 S2 S3 S4; do $B warm3.js $c $s >> $out 2>&1 || echo "{\"error\":\"$c $s\"}" >> $out; done
  done
 done
 echo "{\"meta\":\"end\",\"end\":\"$(date -u +%FT%TZ)\",\"loadavg\":\"$(cat /proc/loadavg)\"}" >> $out
 echo "$(date -u +%T) node$v: $(grep -c median $out) results"
done
