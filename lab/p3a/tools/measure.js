#!/usr/bin/env node
// 「止まって聞く」がどのくらい出るかを測る。  使い方：node tools/measure.js [種の数=200]
import { PLOTS, runPlot } from './scenarios.js';

const SEEDS = Number(process.argv[2] || 200); const HUMAN_STEPS = [5, 20, 60];
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
console.log(`種 ${SEEDS} 通り × 人の直し ${HUMAN_STEPS.join('・')} 手。効果＝AI の作業が実際に変えた所の1つ1つ。\n`);
console.log('| 筋書き | 人の直し | 効果の数 | 戻した | 上書き済み・もう無い | 聞く | 聞く（部品の数で）/回 | 聞くが0件の回 | 人の直しの確かめ（壊れ/調べた数）|');
console.log('|---|---|---|---|---|---|---|---|---|');
const total = { reverted: 0, noop: 0, ask: 0 }; const whyAll = {}; let brokenAll = 0;
for (const plot of Object.keys(PLOTS)) for (const h of HUMAN_STEPS) {
  const t = { reverted: 0, noop: 0, ask: 0 }; let runs = 0; let zero = 0; let askNodes = 0; let checked = 0; let broken = 0; let mismatch = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = runPlot(plot, seed, h); if (r.empty) continue; runs++;
    for (const k of Object.keys(t)) { t[k] += r.tally[k]; total[k] += r.tally[k]; }
    if (JSON.stringify(r.tally) !== JSON.stringify(r.dryTally)) mismatch++;
    if (r.tally.ask === 0) zero++; askNodes += r.askNodes; checked += r.intact.checked; broken += r.intact.broken.length;
    for (const k of Object.keys(r.why)) whyAll[k] = (whyAll[k] || 0) + r.why[k];
  }
  brokenAll += broken; const n = t.reverted + t.noop + t.ask;
  console.log(`| ${plot} | ${h} 手 | ${n} | ${pct(t.reverted, n)} | ${pct(t.noop, n)} | ${pct(t.ask, n)} | ${(askNodes / runs).toFixed(2)} | ${pct(zero, runs)} | ${broken}/${checked}${mismatch ? `（先の一覧と食い違い ${mismatch}）` : ''} |`);
}
const n = total.reverted + total.noop + total.ask;
console.log(`\n全体：効果 ${n} 個 → 戻した ${pct(total.reverted, n)}／上書き済み・もう無い ${pct(total.noop, n)}／聞く ${pct(total.ask, n)}`);
console.log(`聞く理由の内訳：${JSON.stringify(whyAll)}`);
console.log(`人の直しが壊れた数：${brokenAll}`);
if (brokenAll) process.exitCode = 1;
