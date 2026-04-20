#!/bin/bash

nver=$(node -v)
file="out/$nver/stdlib.txt"
mkdir -p "out/$nver"

echo "node $nver" > "$file"
node -p "'V8 v' + process.versions.v8" >> "$file"
echo >> "$file"

node --allow_natives_syntax --print-opt-code --code_comments gen-asm-stdlib.js >> "$file"
