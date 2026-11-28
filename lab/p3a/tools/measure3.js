#!/usr/bin/env node
// 部品ごとの取り消しの改善案の比べ（BRIEF3 の B）。  使い方：node tools/measure3.js [種の数=100]
// 数字は、こちらで作った筋書きの物（本物の操作ではない）。種つきなので、何回流しても同じ数字。
import { CASES, PLOTS2 } from './scenarios2.js';
import { compareOne, secondRevert, case7, ALL_METHODS, EXTRA } from './methods.js';

const SEEDS = Number(process.argv[2] || 100); const HS = [1, 5, 20, 60];
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-'); const sum = (a) => a.reduce((x, y) => x + y, 0); const mean = (a) => (a.length ? (sum(a) / a.length).toFixed(2) : '-');
const LABEL = { M1: '1 部品を丸ごと残す', M1w: '1w 丸ごと残す＋同じ形への変更も残す', M2: '2 足した点を1つずつに割る', M3: '3 別の下地へ移す（AI の作業が無かった文書に当て直す）' };
const groups = [];
for (const name of Object.keys(CASES)) groups.push([name, name, undefined]);
for (const name of Object.keys(PLOTS2)) for (const h of HS) groups.push([`${name}・人 ${h} 手`, name, h]);
for (const name of Object.keys(EXTRA)) for (const h of HS) groups.push([`${name}・人 ${h} 手`, name, h]);
const tot = {}; for (const m of [...ALL_METHODS, 'M3']) tot[m] = []; let bad = 0;
console.log(`## 方式ごとの比べ（種 ${SEEDS} 通り。既定＝聞かれた所は全部残す）\n`);
console.log('| 筋書き | 方式 | 人の直しが壊れた数（確かめ①／②：調べた数）| 残った AI の効果（生きていた効果のうち）| 残った「AI だけの値」（取り消す前のうち）| 形が割れた形の数 | 割って外した点 | 全体の決まりの破れ・点が足りない形 | 画面に出る単位（平均）| M3：当たらなかった人の命令／全部 | M3：違う下地に当たった直し | M3 の文書が 1 と同じ回 |'); console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [label, name, h] of groups) { const rs = []; for (let s = 1; s <= SEEDS; s++) { const r = compareOne(name, s, h); if (r && !r.M1.failed) rs.push(r); }
  for (const m of ALL_METHODS) { const g = (f) => rs.map((r) => f(r[m])); tot[m].push(...rs.map((r) => r[m]));
    const b1 = sum(g((x) => x.broken1.length)); const b2 = sum(g((x) => x.broken2.length)); bad += b1 + b2 + sum(g((x) => x.invariants));
    console.log(`| ${label} | ${LABEL[m]} | ${b1}／${b2}（${sum(g((x) => x.checked1))}／${sum(g((x) => x.checked2))}）| ${sum(g((x) => x.kept))}・${pct(sum(g((x) => x.kept)), sum(g((x) => x.live)))} | ${sum(g((x) => x.pureAfter))}・${pct(sum(g((x) => x.pureAfter)), sum(g((x) => x.pureBefore)))} | ${sum(g((x) => x.splitGeo))} | ${sum(g((x) => x.splitOut))} | ${sum(g((x) => x.invariants))}・${sum(g((x) => x.degenerate))} | ${mean(g((x) => x.units))} | | | |`); }
  { const g = (f) => rs.map((r) => f(r.M3)); tot.M3.push(...rs.map((r) => r.M3)); bad += sum(g((x) => x.invariants));
    console.log(`| ${label} | ${LABEL.M3} | 元は変えない | — | ${sum(g((x) => x.pureAfter))}・${pct(sum(g((x) => x.pureAfter)), sum(g((x) => x.pureBefore)))} | — | — | ${sum(g((x) => x.invariants))}・${sum(g((x) => x.degenerate))} | 1 画面 | ${sum(g((x) => x.humanFailed))}／${sum(g((x) => x.humanTotal))}（${pct(sum(g((x) => x.humanFailed)), sum(g((x) => x.humanTotal)))}）| ${sum(g((x) => x.ctxDiff))} | ${rs.filter((r) => r.M3.sameAsM1).length}／${rs.length} |`); } }

console.log(`\n## 全体（${tot.M1.length} 回の戻す操作）\n`);
console.log('| 方式 | 人の直しが壊れた数（①／②）| 残った AI の効果 | 残った「AI だけの値」| 形が割れた形 | 割って外した点 | 全体の決まりの破れ | 点が足りない形 | 単位（平均・0 個の回）| 押す回数（既定／全部決める）| 残した AI の部品への「途中の値に戻るだけ」の効果 |'); console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const m of ALL_METHODS) { const g = (f) => tot[m].map(f);
  console.log(`| ${LABEL[m]} | ${sum(g((x) => x.broken1.length))}／${sum(g((x) => x.broken2.length))}（${sum(g((x) => x.checked1))}／${sum(g((x) => x.checked2))} か所）| ${sum(g((x) => x.kept))}（${pct(sum(g((x) => x.kept)), sum(g((x) => x.live)))}）| ${sum(g((x) => x.pureAfter))}（${pct(sum(g((x) => x.pureAfter)), sum(g((x) => x.pureBefore)))}）| ${sum(g((x) => x.splitGeo))} | ${sum(g((x) => x.splitOut))} | ${sum(g((x) => x.invariants))} | ${sum(g((x) => x.degenerate))} | ${mean(g((x) => x.units))}・${pct(tot[m].filter((x) => x.units === 0).length, tot[m].length)} | ${sum(g((x) => x.clicksDefault))}／${sum(g((x) => x.clicksAll))} | ${sum(g((x) => x.keptHasBefore))} |`); }
{ const g = (f) => tot.M3.map(f); const by = {}; for (const x of tot.M3) for (const k of Object.keys(x.failedByType)) by[k] = (by[k] || 0) + x.failedByType[k];
  console.log(`| ${LABEL.M3} | 元は変えない。横の文書に当たらなかった人の命令 ${sum(g((x) => x.humanFailed))}／${sum(g((x) => x.humanTotal))}（${pct(sum(g((x) => x.humanFailed)), sum(g((x) => x.humanTotal)))}）| — | ${sum(g((x) => x.pureAfter))}（${pct(sum(g((x) => x.pureAfter)), sum(g((x) => x.pureBefore)))}）| —（違う下地に当たった直し ${sum(g((x) => x.ctxDiff))}）| — | ${sum(g((x) => x.invariants))} | ${sum(g((x) => x.degenerate))} | 1 画面（2つの文書を見比べる）| ${sum(g((x) => x.clicksDefault))}／— | — |`);
  console.log(`\n- M3 で当たらなかった人の命令の種類：${Object.keys(by).sort((a, b) => by[b] - by[a]).map((k) => `${k} ${by[k]}`).join('、')}`);
  console.log(`- M3 の文書が、方式1（既定）の文書と同じ中身だった回：${tot.M3.filter((x) => x.sameAsM1).length}／${tot.M3.length}`); }

console.log('\n## 2回めの取り消し（方式1 と 方式4＝引き取り の違い）：戻す → 人が 5 手なおす → 同じ作業を、もう一度戻す\n');
console.log('| 筋書き | 回 | 1回めの単位（平均）| 引き取った部品（平均）| 2回めの単位：方式1（平均・0 の回）| 2回めの単位：方式4（平均・0 の回）| 人の直しが壊れた数（1／4）| 引き取りで文書の中身が変わった回 |'); console.log('|---|---|---|---|---|---|---|---|');
for (const name of ['下組みを丸ごと戻す', '下組み（足して、同じ作業で色・点も直す）を戻す', '足した点（なめらかに）だけ戻す']) for (const h of [1, 5, 20]) { const rs = []; for (let s = 1; s <= SEEDS; s++) { const r = secondRevert(name, s, h); if (r) rs.push(r); }
  const g = (f) => rs.map(f); bad += sum(g((r) => r.m1.broken + r.m4.broken)) + rs.filter((r) => !r.sameDoc).length;
  console.log(`| ${name}・人 ${h} 手 | ${rs.length} | ${mean(g((r) => r.first))} | ${mean(g((r) => r.adopted))} | ${mean(g((r) => r.m1.units))}・${pct(rs.filter((r) => r.m1.units === 0).length, rs.length)} | ${mean(g((r) => r.m4.units))}・${pct(rs.filter((r) => r.m4.units === 0).length, rs.length)} | ${sum(g((r) => r.m1.broken))}／${sum(g((r) => r.m4.broken))} | ${rs.filter((r) => !r.sameDoc).length} |`); }

console.log('\n## 場合7（確認の画面を見て「全部外す」→ 送る前に人が直す → 送る）\n');
console.log('| 方式 | 送る前の人の直し | 外す単位があった回 | 断られた（やり直し）| 通った | 通った時に壊れた、あとからの直し | 断られた時に変わった文書 | M3：あとからの直しのうち、横の文書に当たらなかった数／全部 |'); console.log('|---|---|---|---|---|---|---|---|');
for (const m of ALL_METHODS) for (const late of [0, 1, 3, 10]) { let n = 0; let st = 0; let ok = 0; let lost = 0; let ch = 0; let lf = 0; let lt = 0;
  for (let s = 1; s <= SEEDS; s++) { const r = case7(s, late, m); if (!r.drops) continue; n++; if (r.status === 'applied') { ok++; lost += r.lost; } else { st++; if (!r.unchanged) ch++; } lf += r.lateFailed; lt += r.late; }
  bad += lost + ch; console.log(`| ${LABEL[m]} | ${late} 手 | ${n} | ${st} | ${ok} | ${lost} | ${ch} | ${m === 'M1' ? `${lf}／${lt}` : ''} |`); }
if (bad) { console.log(`\n**壊れ・破れが ${bad} 件**`); process.exitCode = 1; }
