#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$1" == "stdlib" ]]; then
  script="$DIR/gen-asm-stdlib.js"
elif [[ "$1" == "strided" ]]; then
  script="$DIR/gen-asm-strided.js"
else
  script="$DIR/gen-asm.js"
fi

nver=$(node -v)
outdir="$DIR/out/$nver"
mkdir -p "$outdir"
file="$outdir/$1.txt"

echo "node $nver" > "$file"
node -p "'V8 v' + process.versions.v8" >> "$file"
echo >> "$file"

node --allow-natives-syntax --print-opt-code --code-comments "$script" "$1" >> "$file"
echo "Generated $file"
