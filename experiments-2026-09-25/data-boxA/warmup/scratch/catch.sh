#!/bin/bash
# usage: catch.sh <node> <label> <threshold> <max> -- <args...>; keeps traced runs whose median > threshold
B=$1; L=$2; T=$3; MAX=$4; shift 5
n=0
for r in $(seq $MAX); do
  $B --trace-opt --trace-deopt --trace-osr "$@" > /tmp/tc.txt 2>&1
  m=$(grep -o '"median":[0-9.]*' /tmp/tc.txt | cut -d: -f2)
  if python3 -c "import sys; sys.exit(0 if float('${m:-0}')>$T else 1)"; then n=$((n+1)); cp /tmp/tc.txt diag/slow-warm/$L-slow-$n.txt; fi
  [ $n -ge 2 ] && break
done
echo "$L: $n slow of $r runs"
