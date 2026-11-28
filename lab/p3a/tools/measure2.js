#!/usr/bin/env node
// 部品ごとにまとめる取り消しの測り。  使い方：node tools/measure2.js [種の数=200]
// 数字は、こちらで作った筋書きの物（本物の操作ではない）。
import { PLOTS2, CASES, runCase, runPlot2, runCase7, runRebase } from './scenarios2.js';

const SEEDS = Number(process.argv[2] || 200); const HS = [1, 5, 20, 60];
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
const med = (a) => { if (!a.length) return '-'; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const max = (a) => (a.length ? Math.max(...a) : '-'); const sum = (a) => a.reduce((x, y) => x + y, 0); const mean = (a) => (a.length ? (sum(a) / a.length).toFixed(2) : '-');
let broken = 0; let checked = 0;

function table(title, rows) {
  console.log(`\n### ${title}\n`);
  console.log('| 筋書き | 回 | 画面に出る部品（単位）中央値・最大 | 完全に戻せた部品 | 人の直しで残した部品 | AI と人が混ざる部品 | 残った AI の効果（数・生きていた効果のうち）| 残した部品の値のうち AI だけの物 | 点のうち AI のまま | 人の直し 1 件あたり、残った AI の値 | 前の方式：聞く回数（中央値・最大）| 新：押す回数（既定／全部決める・中央値）|');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, rs] of rows) {
    const g = (f) => rs.map(f); const sh = (k) => sum(g((r) => r.share[k]));
    for (const r of rs) { broken += r.intact.broken.length; checked += r.intact.checked; }
    console.log(`| ${name} | ${rs.length} | ${med(g((r) => r.units))}・${max(g((r) => r.units))} | ${med(g((r) => r.fullParts))}（計 ${sum(g((r) => r.fullParts))}/${sum(g((r) => r.parts))}）| ${med(g((r) => r.keptParts))}（計 ${sum(g((r) => r.keptParts))}。うち入れ物 ${sum(g((r) => r.contParts))}）| ${sum(g((r) => r.mixedParts))}（残した部品の ${pct(sum(g((r) => r.mixedParts)), sum(g((r) => r.keptParts)))}）| ${sum(g((r) => r.kept))}・${pct(sum(g((r) => r.kept)), sum(g((r) => r.live)))} | ${pct(sh('pure'), sh('total'))}（混ざり ${pct(sh('mixed'), sh('total'))}）| ${pct(sh('ptsPure'), sh('pts'))} | ${sum(g((r) => r.humanTouches)) ? (sh('pure') / sum(g((r) => r.humanTouches))).toFixed(1) : '-'} | ${med(g((r) => r.oldAsks))}・${max(g((r) => r.oldAsks))} | ${med(g((r) => r.newClicksDefault))}／${med(g((r) => r.newClicksAll))} |`);
  }
}
const all = [];
const caseRows = Object.keys(CASES).map((name) => { const rs = []; for (let s = 1; s <= SEEDS; s++) { const r = runCase(name, s); if (r && !r.failed) rs.push(r); } all.push(...rs); return [name, rs]; });
table(`場合 1〜6（下組みが相手。種 ${SEEDS} 通り）`, caseRows);
console.log('\n単位の内訳（場合ごと）：');
for (const [name, rs] of caseRows) { const by = { human: 0, ai: 0, both: 0, none: 0 }; const why = {}; let la = 0; let ch = 0; let u = 0;
  for (const r of rs) { for (const k of Object.keys(by)) by[k] += r.by[k]; for (const k of Object.keys(r.why)) why[k] = (why[k] || 0) + r.why[k]; la += r.laterAI; ch += r.choosable; u += r.units; }
  console.log(`- ${name}：単位 ${u} 個（上に乗っているのが 人 ${by.human}・AI ${by.ai}・両方 ${by.both}・なし ${by.none}）／種類 ${JSON.stringify(why)}／「外す」を選べる ${ch}／あとの AI の作業のまとまり ${la}`); }

// 場合7
console.log('\n### 場合7（確認の画面を見て「全部外す」→ 送る前に人が直す → 送る）\n');
console.log('| 送る前に入った人の直し | 回（外す単位があった回）| 断られた（stale）| うち、外す部品に本当に直しが入っていた | 通った | 通ったのに、外す部品に直しが入っていた（＝見逃し）| 通った時に、あとから入った人の直しが壊れた数 | 断られた時に文書が変わった数 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const late of [0, 1, 3, 10]) { let n = 0; let st = 0; let stHit = 0; let ok = 0; let miss = 0; let lost = 0; let changed = 0;
  for (let s = 1; s <= SEEDS; s++) { const r = runCase7(s, late); if (!r.drops) continue; n++;
    if (r.status === 'applied') { ok++; if (r.hit) miss++; lost += r.lostLate.length; } else { if (r.reason === 'stale') { st++; if (r.hit) stHit++; } if (!r.unchanged) changed++; } }
  console.log(`| ${late} 手 | ${n} | ${st} | ${stHit} | ${ok} | ${miss} | ${lost} | ${changed} |`); if (lost || changed) process.exitCode = 1; }

const plotRows = []; for (const name of Object.keys(PLOTS2)) for (const h of HS) { const rs = []; for (let s = 1; s <= SEEDS; s++) { const r = runPlot2(name, s, h); if (r && !r.failed) rs.push(r); } all.push(...rs); plotRows.push([`${name}・人 ${h} 手`, rs]); }
table(`筋書き × 人の直しの量（種 ${SEEDS} 通り）`, plotRows);

const g = (f) => all.map(f);
console.log(`\n### 全体（${all.length} 回の戻す操作）\n`);
console.log(`- 画面に出る部品（単位）の数：中央値 ${med(g((r) => r.units))}・平均 ${mean(g((r) => r.units))}・最大 ${max(g((r) => r.units))}。単位が 0 個の回 ${pct(all.filter((r) => r.units === 0).length, all.length)}`);
console.log(`- 前の方式（効果ごとに聞く）の、聞く回数：中央値 ${med(g((r) => r.oldAsks))}・平均 ${mean(g((r) => r.oldAsks))}・最大 ${max(g((r) => r.oldAsks))}。0 回の回 ${pct(all.filter((r) => r.oldAsks === 0).length, all.length)}`);
console.log(`- 押す回数：前の方式 計 ${sum(g((r) => r.oldClicksAll))}（既定でも、聞かれた数だけ答える）／新しい方式 既定 計 ${sum(g((r) => r.newClicksDefault))}・全部を自分で決める 計 ${sum(g((r) => r.newClicksAll))}`);
console.log(`- 残った AI の効果：${sum(g((r) => r.kept))} 個（戻す相手の効果 ${sum(g((r) => r.effects))} 個のうち ${pct(sum(g((r) => r.kept)), sum(g((r) => r.effects)))}。まだ生きていた効果 ${sum(g((r) => r.live))} 個のうち ${pct(sum(g((r) => r.kept)), sum(g((r) => r.live)))}）`);
console.log(`- 前の方式で「聞く」になった効果 計 ${sum(g((r) => r.oldAsks))} 個 → 新しい方式で残した効果 計 ${sum(g((r) => r.kept))} 個（単位の中を割らないので、聞かれなかった効果も一緒に残る：${sum(g((r) => r.kept)) - sum(g((r) => r.oldAsks))} 個ぶん多い）`);
console.log(`- 足した点は残るのに、同じ形の「今ある点」への AI の変更は戻った単位：${sum(g((r) => r.halfShapes))} 個`);
console.log(`- 人の直しが壊れた数（既定＝全部残す。核とは別のやり方で確かめた）：${broken}／調べた ${checked} か所`);
if (broken) process.exitCode = 1;

// 当て直し
console.log('\n### 人の直しを、出し直した下組みに当て直す（試し。元の文書は変えない）\n');
console.log('| 人の直し | 下地 | 人の命令 | 当たった | 割合 | 種類ごと（当たった/全部）|');
console.log('|---|---|---|---|---|---|');
for (const h of [5, 20, 60]) for (const same of [true, false]) { let t = 0; let a = 0; const by = {};
  for (let s = 1; s <= SEEDS; s++) { const r = runRebase(s, h, same); t += r.total; a += r.applied; for (const k of Object.keys(r.byType)) { by[k] = by[k] || [0, 0]; by[k][0] += r.byType[k][0]; by[k][1] += r.byType[k][1]; } }
  console.log(`| ${h} 手 | ${same ? '同じ下組み（確かめ用：全部当たるはず）' : '出し直した下組み（id の付け方は同じ・数と値は別）'} | ${t} | ${a} | ${pct(a, t)} | ${Object.keys(by).sort().map((k) => `${k} ${by[k][0]}/${by[k][1]}`).join('、')} |`); }
