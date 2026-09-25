#!/bin/bash
D=$EXPERIMENTS_DIR/data-boxA/node24-gap
N=$SCRATCH/n24
mkdir -p $D
cd /tmp/intx-stock
for blk in 3 4; do
 for B in /opt/node22/bin/node /usr/local/nvm/versions/node/v24.19.0/bin/node /usr/local/nvm/versions/node/v26.7.0/bin/node; do
  v=$($B -v | tr -d v)
  for job in "i32-add-showdown:src/i32/add/showdown.js" "06-stock-timer:scratch-n24/a-06-stock-timer.js" "06-row1-last:scratch-n24/b-06-row1-last.js" "i32add-inline-first:scratch-n24/c-i32add-inline-first.js" "reduce-uncoerced-big:$N/reduce.js uncoerced big" "reduce-uncoerced-small:$N/reduce.js uncoerced small" "reduce-coerced-big:$N/reduce.js coerced big"; do
   tag=${job%%:*}; cmd=${job#*:}
   out=$D/block$blk-node$v-$tag.txt
   { echo "# boxA · node24-gap · block $blk · $cmd (stock intx a8de2d6 tree at /tmp/intx-stock; scratch files are not Abdul's code)"
     echo "# binary: $B ($($B -v), v8 $($B -p process.versions.v8))"
     echo "# start: $(date -u +%FT%TZ) · loadavg: $(cat /proc/loadavg)"; echo
     s=$(date +%s); $B $cmd 2>&1; rc=$?; echo
     echo "# exit: $rc · wall: $(( $(date +%s)-s ))s · end: $(date -u +%FT%TZ)"; } > $out
   echo "$(date -u +%T) block$blk node$v $tag exit=$rc"
  done
 done
done
