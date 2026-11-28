#!/bin/sh
# メモリを抑える方法の比べを、全部の組で流す（数時間。メモリ 7GB の機械）。結果は results/mem.jsonl に1行ずつ足される（止まっても残る）。
# メモリが足りずに落ちた組は、/tmp/p3r/mem.err に残る → RESULTS2.md では「未測定」と書く。
cd "$(dirname "$0")/.."
run() { echo "== $*" >> /tmp/p3r/mem.err; node --expose-gc --max-old-space-size=${HEAP:-6000} tools/bench_mem.js "$@" > /dev/null 2>> /tmp/p3r/mem.err || echo "FAILED $*" >> /tmp/p3r/mem.err; }
run paged 1000000 300 spread; run mem 1000000 300 spread
run paged 1000000 300 hot;    run mem 1000000 300 hot
run paged 3000000 300 spread; run mem 3000000 300 spread
run paged 3000000 300 hot;    run mem 3000000 300 hot
run paged 1000000 3000 spread; run mem 1000000 3000 spread
run paged 10000000 300 spread
run paged 3000000 3000 spread
echo ALLDONE >> /tmp/p3r/mem.err
