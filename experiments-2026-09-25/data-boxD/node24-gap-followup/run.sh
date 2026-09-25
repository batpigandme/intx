#!/bin/bash
# boxD: three checks on reduce.js. One process at a time; two blocks; outputs are one line per run.
cd "$(dirname "$0")"
for blk in 1 2; do
 for B in /opt/node22/bin/node /usr/local/nvm/versions/node/v24.19.0/bin/node /usr/local/nvm/versions/node/v26.7.0/bin/node; do
  v=$($B -v | tr -d v); out=block$blk-node$v.txt; : > $out
  echo "# boxD block $blk $B ($($B -v), v8 $($B -p process.versions.v8)) start $(date -u +%FT%TZ) loadavg $(cat /proc/loadavg)" >> $out
  # baseline (stock reduce.js behaviour)
  for va in uncoerced coerced literal; do for m in big small; do echo "baseline | $($B reduce.js $va $m)" >> $out; done; done
  # check 1: --no-use-osr
  for va in uncoerced coerced; do echo "no-use-osr | $($B --no-use-osr reduce.js $va big)" >> $out; done
  # check 2: form of c
  for va in local localcopy param; do echo "c-form | $($B reduce.js $va big)" >> $out; done
  # check 3: operators (uncoerced closure c vs coerced), cold
  for op in - '*' '^'; do for va in uncoerced coerced; do echo "op | $($B reduce.js $va big "$op")" >> $out; done; done
  echo "# end $(date -u +%FT%TZ) loadavg $(cat /proc/loadavg)" >> $out
  echo "$(date -u +%T) block$blk node$v done"
 done
done
