#!/usr/bin/env node
// results/bench.jsonl（tools/bench.js の出力。1行＝1組）を、表にする。  使い方：node tools/bench_table.js [ファイル…]
import fs from 'node:fs';
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['results/bench.jsonl'];
const rows = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))).filter((r) => !r.failed)
  .sort((a, b) => (a.mode < b.mode ? 1 : a.mode > b.mode ? -1 : a.n - b.n || a.parts - b.parts));
const nn = (n) => (n >= 1e6 ? `${n / 1e6}00 万` : `${n / 1e4} 万`); const mode = (m) => (m === 'hot' ? '1つの道に集中' : 'ばらけた');
const ms = (x) => (x === undefined ? '—' : x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const s = (x) => (x === undefined ? '—' : x >= 100 ? x.toFixed(0) : x.toFixed(1));
console.log('### 表1：写しなし（記録だけ）\n');
console.log('| 記録 | 部品（文書）| 操作 | 命令1つを当てる（平均／最後の 2000 件）| 直前の操作の取り消し1回 | 古い AI の記録を選んで戻す1回（平均／中央／最大）| メモリ | 保存する量：命令だけ（1件あたり）／効果つき | 読みこみ：命令だけを検査つきで当て直す（行を読む＋当てる）| 読みこみ：効果つきを検査なしで当てる（読む＋当てる）|');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${nn(r.n)} | ${r.parts}（${r.docKB >= 1024 ? (r.docKB / 1024).toFixed(1) + ' MB' : r.docKB + ' KB'}）| ${mode(r.mode)} | ${ms(r.applyMs)}／${ms(r.applyLastMs)} ms | ${ms(r.undoMs)} ms | ${ms(r.revertMs)}／${ms(r.revertMedMs)}／${ms(r.revertMaxMs)} ms | ${r.heapMB} MB | ${r.journalMB} MB（${r.bytesPerRecord} バイト）／${r.journalFullMB} MB${r.journalFullEstimated ? '（見積もり）' : ''} | ${s(r.readS)}＋${s(r.replayS)} 秒 | ${r.trustedS === undefined ? '測っていない' : `${s(r.readFullS)}＋${s(r.trustedS)} 秒`} |`);
console.log('\n### 表2：写しを併用（写しのあとに K まとまり＝いちばん長く待つ場合）\n');
console.log('| 記録 | 部品 | 操作 | K | 写しの大きさ | 写しを書く時間（命令1つあたりにならすと）| 読みこみ：写し＋続きだけ | 読みこみ：写し＋効果つきの記録の全部（頭は索引だけ）| 写しのあとの直前の取り消し | 写しより前の操作を戻す：まず断られるか → 古い記録を読み足して戻すまで |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) for (const K of [100, 1000, 10000]) { const o = r.snap && r.snap[K]; if (!o) continue;
  console.log(`| ${nn(r.n)} | ${r.parts} | ${mode(r.mode)} | ${K} | ${o.snapKB >= 1024 ? (o.snapKB / 1024).toFixed(1) + ' MB' : o.snapKB + ' KB'} | ${ms(o.writeMs)} ms（${o.writePerCmdMs} ms）| ${o.tailLoadMs >= 1000 ? (o.tailLoadMs / 1000).toFixed(1) + ' 秒' : ms(o.tailLoadMs) + ' ms'} | ${o.indexedLoadMs === undefined ? '測っていない' : o.indexedLoadMs >= 1000 ? (o.indexedLoadMs / 1000).toFixed(1) + ' 秒' : ms(o.indexedLoadMs) + ' ms'} | ${o.tailUndo === 'applied' ? ms(o.tailUndoMs) + ' ms' : o.tailUndo} | ${o.oldRevert === 'needs-history' ? '断られる' : o.oldRevert} → ${o.reachBackS === undefined ? '測っていない' : s(o.reachBackS) + ' 秒'} |`); }
// 表3：効果つきの記録（自分の端末の控え）からの読みこみ（tools/bench_load.js。results/bench_load.jsonl があれば）
if (fs.existsSync('results/bench_load.jsonl')) {
  const ls = fs.readFileSync('results/bench_load.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.failed).sort((a, b) => (a.mode < b.mode ? 1 : a.mode > b.mode ? -1 : a.n - b.n || a.parts - b.parts));
  console.log('\n### 表3：効果つきの記録（自分の端末の控え）から読みこむ（検査なし。読みこみを速くしたあとの測り直し）\n');
  console.log('| 記録 | 部品 | 操作 | 効果つきの記録 | 行を読む（印の確かめ＋JSON）| 効果を当てる | 写し＋索引（K=100／1000／1 万。行を読む時間は別）| 写し＋続きだけ（K=100／1000／1 万）| 写しより前の操作を戻す：断られてから、読み足して戻すまで |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of ls) { const k = (f) => [100, 1000, 10000].map((K) => (r.snap[K] ? f(r.snap[K]) : '—')).join('／');
    console.log(`| ${nn(r.n)} | ${r.parts} | ${mode(r.mode)} | ${r.journalFullMB} MB | ${r.readFullS} 秒 | ${r.trustedS} 秒 | ${k((o) => ms(o.indexedLoadMs))} ms | ${k((o) => ms(o.tailLoadMs))} ms | ${k((o) => o.reachBackS)} 秒 |`); }
}
