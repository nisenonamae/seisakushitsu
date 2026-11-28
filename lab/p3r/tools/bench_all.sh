#!/bin/sh
# 測りを全部の組で流す（1組ずつ別のプロセス。全部で 30〜60 分）。結果は results/bench.jsonl（1行＝1組）
cd "$(dirname "$0")/.." || exit 1
out=results/bench.jsonl; : > "$out"
run() { node --expose-gc --max-old-space-size=6500 tools/bench.js "$1" "$2" "$3" >> "$out" 2>> /tmp/p3r/bench.err || echo "{\"n\":$1,\"parts\":$2,\"mode\":\"$3\",\"failed\":true}" >> "$out"; }
for p in 30 300 3000; do run 10000 $p spread; done
for n in 10000 100000; do run $n 300 hot; done
for p in 30 300; do run 100000 $p spread; done
run 100000 3000 spread
run 1000000 300 hot
run 1000000 300 spread
