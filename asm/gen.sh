#!/bin/bash

if [[ "$1" == "stdlib" ]]; then
  script="gen-asm-stdlib.js"
elif [[ "$1" == "strided" ]]; then
  script="gen-asm-strided.js"
else
  script="gen-asm.js"
fi

nver=$(node -v)
mkdir -p "out/$nver"
file="out/$nver/$1.txt"

echo "node $nver" > "$file"
node -p "'V8 v' + process.versions.v8" >> "$file"
echo >> "$file"

node --allow-natives-syntax --print-opt-code --code-comments "$script" "$1" >> "$file"
