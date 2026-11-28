#!/usr/bin/env node
// 部品ごとの取り消しの暫定の仕様（P3r の C）を、前回の「必ず確かめる場合 1〜7」で通し直す。  使い方：node tools/cases.js [種の数=100]
// 既定のまま送る：{ type:'revert', mode:'units', targets, at }（同じ形への変更も残す・掛ける量は組み立て直す・人の変更は残す）。
// 人の直しが壊れていないかは、3通りで確かめる：
//   ① 人の記録の効果が、取り消したあとも文書に残っているか（tools/oracle.js。前回と同じ）
//   ② 取り消す前に「その AI の作業が関わっていない値」が、取り消したあとも同じか（由来から。前回と同じ）
//   ③ **別のやり方（新しく足した）＝人の直しを1つだけ変えた、もう1つの世界と比べる**：
//      人の命令を1つ選んで、量だけ変える（動かす量を +0.5,+0.25／色を別の色に）。記録を流し直して「もう1つの世界」を作り、同じ取り消しを当てる。
//      取り消す前に2つの世界で違っていた値は、取り消したあとも、同じだけ違っていなければならない（人の直しが、取り消しを通り抜けている）。
//      核の効果・由来・取り消しの判定を1つも使わない（使うのは、文書の値と、命令の流し直しだけ）。
// 数字は、こちらで作った筋書きの物（本物の操作ではない）。
import { applyBatch, planRevert, logItems, toEntries, replay, getAt, canon, content, checkInvariants, toGrid, whoOf } from '../src/index.js';
import { CASES } from './scenarios2.js';
import { build, judgeResult, secondRevert, case7, INIT } from './methods.js';
import { leavesOf } from './provenance.js';
import { HUMAN, AI, Session } from './scenarios.js';

const leafVal = (doc, a) => { if (a[2] === '@place') { const n = doc.nodes[a[1]]; return n ? [n.parent, n.order] : undefined; } return getAt(doc, a); };
const leaves = (doc) => { const m = new Map(); for (const n of Object.values(doc.nodes)) for (const a of leavesOf(n)) m.set(a.join('/'), a); return m; };
const nums = (v) => (v && typeof v === 'object' && v.k === 'static' ? v.v : v);
const isNum = (x) => typeof x === 'number' || (Array.isArray(x) && x.every((y) => typeof y === 'number'));
const diff = (a, b) => (Array.isArray(a) ? a.map((x, i) => toGrid(x) - toGrid(b[i])) : [toGrid(a) - toGrid(b)]);
const revertCmd = (id, ids, at) => ({ id, v: 1, actor: { k: 'human', device: 'mac' }, body: { type: 'revert', mode: 'units', targets: ids, at } });

/** ③：人の直しを1つ変えた世界との比べ。@returns {{tried:number, leaves:number, broken:string[]}} */
export function twinCheck(before, ids, max = 6) {
  const T = new Set(ids); const undone = new Set(); for (const a of logItems(before.log)) if (a.cmd.body.type === 'revert') for (const t of a.cmd.body.targets) undone.add(t);
  const cand = logItems(before.log).filter((a) => a.sender.k === 'human' && !T.has(a.cmd.id) && !undone.has(a.cmd.id) && a.cmd.proposal === undefined && ['pt.nudge', 'prop.nudge', 'prop.set'].includes(a.cmd.body.type));
  const step = Math.max(1, Math.ceil(cand.length / max)); const out = { tried: 0, leaves: 0, broken: [], skipped: 0 };
  const r0 = applyBatch(before, [revertCmd('twin-r', ids, undefined)], HUMAN); if (r0.status !== 'applied') return out;
  const B = before.doc; const A = r0.state.doc;
  for (let i = 0; i < cand.length; i += step) {
    const h = cand[i]; const entries = JSON.parse(JSON.stringify(toEntries(before.log))); let changed = false;
    for (const e of entries) for (const c of e.cmds) if (c.id === h.cmd.id) { const b = c.body;
      if (b.d) { b.d = b.d.map((x, j) => x + (j ? 0.25 : 0.5)); changed = true; }
      else if (b.value && b.value.k === 'static') { const v = b.value.v; if (v && v.k === 'hex') { b.value = { k: 'static', v: { k: 'hex', v: v.v === '#010203' ? '#030201' : '#010203' } }; changed = true; } else if (typeof v === 'number') { b.value = { k: 'static', v: v + 0.5 }; changed = true; } else if (Array.isArray(v) && v.every((x) => typeof x === 'number')) { b.value = { k: 'static', v: v.map((x, j) => x + (j ? 0.25 : 0.5)) }; changed = true; } } }
    if (!changed) { out.skipped++; continue; }
    const tw = replay(INIT, entries); if (tw.skipped.length) { out.skipped++; continue; }             // 量を変えたら、あとの命令が当たらなくなった（比べられない）
    const r1 = applyBatch(tw.state, [revertCmd('twin-r', ids, undefined)], HUMAN); if (r1.status !== 'applied') { out.skipped++; continue; }
    const B2 = tw.state.doc; const A2 = r1.state.doc; out.tried++; let saw = 0;
    for (const [key, a] of leaves(B)) {
      const vb = leafVal(B, a); const vb2 = leafVal(B2, a); if (canon(vb ?? null) === canon(vb2 ?? null)) continue; saw++; out.leaves++;
      const va = leafVal(A, a); const va2 = leafVal(A2, a);
      if (va === undefined || va2 === undefined) { out.broken.push(`${h.cmd.id} ${key}：取り消したあとに無い`); continue; }
      const nb = nums(vb); const nb2 = nums(vb2); const na = nums(va); const na2 = nums(va2);
      if (isNum(nb) && isNum(nb2) && isNum(na) && isNum(na2)) { if (canon(diff(na2, na)) !== canon(diff(nb2, nb))) out.broken.push(`${h.cmd.id} ${key}：違いが ${diff(nb2, nb)} → ${diff(na2, na)}`); }
      else if (canon(va) !== canon(vb) || canon(va2) !== canon(vb2)) out.broken.push(`${h.cmd.id} ${key}：値が変わった`);
    }
    if (!saw) out.skipped++;                                                                            // その直しは、取り消す前にもう上書きされていた
  }
  return out;
}

/** 場合1つ・種1つ */
export function runCaseDefault(name, seed) {
  const { z, ids } = build(name, seed); if (!ids.length) return null; const before = z.s;
  const plan = planRevert(before, ids); const r = applyBatch(before, [revertCmd(`case-${seed}`, ids, plan.at)], HUMAN); if (r.status !== 'applied') return { failed: r.reason };
  const j = judgeResult(before, r.state, ids, r.outcomes); const tw = twinCheck(before, ids);
  const parts = plan.units.filter((u) => u.why === 'ai-added-part');
  // AI が足した部品で、残した物：その部品への同じ作業の効果が1つも戻っていないこと（「AI の分だけ取り除く」をしていない）
  const keptNodes = new Set(parts.map((u) => u.node)); const partial = r.outcomes.filter((o) => o.result === 'reverted' && o.at.startsWith('node/') && keptNodes.has(o.at.split('/')[1])).length;
  return { units: plan.units.length, parts: parts.length, offers: parts.every((u) => u.offer && u.offer.includes('adopt') && u.offer.includes('keep')), dropOffer: parts.filter((u) => u.offer.includes('drop')).length, partial,
    broken1: j.broken1.length, checked1: j.checked1, broken2: j.broken2.length, checked2: j.checked2, twin: tw, splitGeo: j.splitGeo, splitPart: j.splitPart, invariants: j.invariants, degenerate: j.degenerate, kept: j.kept, live: j.live,
    rebuilt: r.outcomes.filter((o) => o.rebuilt).length, auto: plan.auto, stillAI: parts.every((u) => whoOf(r.state.log, u.node).owner.startsWith('ai:')) };
}

/**
 * 足した場合 S（前回の場合 1〜7 には、伸ばす操作が無かったので）：人が形を 4 つ作る → AI の作業が、全部を伸ばして色を変える → 人と別の AI が、同じ形をさらに伸ばす・動かす → AI の作業を戻す。
 * 正解は「AI の作業の命令を抜いて、記録を流し直した文書」（核の取り消しを通らない）。伸ばしの値が、それとぴったり同じか。
 */
export function runScaleCase(seed) {
  const z = new Session(seed); const ids0 = []; for (let i = 0; i < 4; i++) { const b = z.shapeBody(`h${i}`, null, 'k' + (i + 1)); z.run([b], HUMAN); ids0.push(`h${i}`); }
  const f = () => [0.0003, 0.05, 0.3333, 0.75, 1.5, 3, 12.5, -1][z.R(8)];
  const ids = z.run(ids0.flatMap((id) => [{ type: 'prop.scale', node: id, path: 'xf.scale', f: [f(), f()] }, { type: 'prop.set', node: id, path: 'fill.color', value: z.color() }]), AI, { group: 'job' });
  for (let i = 0; i < 12; i++) { const id = z.pick(ids0); const r = z.rng();
    if (r < 0.5) z.run([{ type: 'prop.scale', node: id, path: 'xf.scale', f: [f()] }], HUMAN); else if (r < 0.7) z.run([{ type: 'prop.scale', node: id, path: 'xf.scale', f: [f()] }], { sender: { k: 'ai', agent: 'other' } }); else if (r < 0.9) z.run([{ type: 'prop.nudge', node: id, path: 'xf.pos', d: z.vec(5) }], HUMAN); else z.run([{ type: 'prop.set', node: id, path: 'fill.color', value: z.color() }], HUMAN); }
  const before = z.s; const plan = planRevert(before, ids); const r = applyBatch(before, [revertCmd(`s-${seed}`, ids, plan.at)], HUMAN); if (r.status !== 'applied') return { failed: r.reason };
  const T = new Set(ids); const entries = toEntries(before.log).map((e) => ({ sender: e.sender, cmds: e.cmds.filter((c) => !T.has(c.id)).map((c) => ({ ...c, base: undefined })) })).filter((e) => e.cmds.length);
  // 前提（base）は付け直す：AI の命令を抜くと、版の数字がずれるので
  let st = replay(INIT, []).state; let unplayed = 0; for (const e of entries) { const x = applyBatch(st, e.cmds.map((c) => ({ ...c, base: { ...st.doc.revs } })), { sender: e.sender }); if (x.status === 'applied') st = x.state; else unplayed++; }
  const j = judgeResult(before, r.state, ids, r.outcomes); let same = 0; let differ = 0; for (const id of ids0) { if (canon(r.state.doc.nodes[id].xf) === canon(st.doc.nodes[id].xf)) same++; else differ++; }
  return { same, differ, unplayed, colorSame: ids0.filter((id) => canon(r.state.doc.nodes[id].fill) === canon(st.doc.nodes[id].fill)).length, rebuilt: r.outcomes.filter((o) => o.rebuilt).length, units: plan.units.length, broken: j.broken1.length + j.broken2.length, twin: twinCheck(before, ids) };
}

function main() {
  const SEEDS = Number(process.argv[2] || 100); const sum = (a) => a.reduce((x, y) => x + y, 0); const mean = (a) => (a.length ? (sum(a) / a.length).toFixed(2) : '-'); let bad = 0;
  console.log(`## 場合 1〜6（種 ${SEEDS} 通り。P3r の既定で送る）\n`);
  console.log('| 場合 | 回 | 単位（平均・0 個の回）| うち「AI が足した部品」（平均）・［外す］も選べる物 | 人の直しが壊れた数 ①／②／③（調べた数）| ③で比べた世界・値 | 形が割れた形 | 残した AI の部品から一部だけ戻った効果 | 決まりの破れ・点が足りない形 | 残った AI の効果 | 組み立て直した掛け算 |'); console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const name of Object.keys(CASES)) { const rs = []; for (let s = 1; s <= SEEDS; s++) { const r = runCaseDefault(name, s); if (r && !r.failed) rs.push(r); else if (r) bad++; }
    const g = (f) => rs.map(f); const b3 = sum(g((r) => r.twin.broken.length)); const b = sum(g((r) => r.broken1)) + sum(g((r) => r.broken2)) + b3; bad += b + sum(g((r) => r.invariants + r.splitGeo + r.partial)) + rs.filter((r) => !r.offers).length;
    console.log(`| ${name} | ${rs.length} | ${mean(g((r) => r.units))}・${(100 * rs.filter((r) => !r.units).length / rs.length).toFixed(0)}% | ${mean(g((r) => r.parts))}・${sum(g((r) => r.dropOffer))}／${sum(g((r) => r.parts))} | ${sum(g((r) => r.broken1))}／${sum(g((r) => r.broken2))}／${b3}（${sum(g((r) => r.checked1))}／${sum(g((r) => r.checked2))}／${sum(g((r) => r.twin.leaves))}）| ${sum(g((r) => r.twin.tried))}・${sum(g((r) => r.twin.leaves))} | ${sum(g((r) => r.splitGeo))} | ${sum(g((r) => r.partial))} | ${sum(g((r) => r.invariants))}・${sum(g((r) => r.degenerate))} | ${sum(g((r) => r.kept))}／${sum(g((r) => r.live))} | ${sum(g((r) => r.rebuilt))} |`);
    for (const r of rs) for (const x of r.twin.broken.slice(0, 2)) console.log(`  - ③の違い：${x}`); }
  { const rs = []; for (let s2 = 1; s2 <= SEEDS; s2++) { const r = runScaleCase(s2); if (r.failed) bad++; else rs.push(r); } const g = (f) => rs.map(f); const tb = sum(g((r) => r.twin.broken.length)); bad += sum(g((r) => r.differ + r.broken + r.unplayed)) + tb;
    console.log(`\n## 足した場合 S：AI の作業が形を伸ばして色を変え、人と別の AI が同じ形をさらに伸ばす（比 0.0003〜12.5・反転も）→ AI の作業を戻す（${rs.length} 回）\n`);
    console.log(`- 伸ばし・位置が「AI の作業の命令を抜いて流し直した文書」とぴったり同じだった形：${sum(g((r) => r.same))}／${sum(g((r) => r.same + r.differ))}（違った形 ${sum(g((r) => r.differ))}）。色も同じだった形：${sum(g((r) => r.colorSame))}／${rs.length * 4}`);
    console.log(`- 組み立て直した掛け算：${sum(g((r) => r.rebuilt))} 個／単位（聞く物）：${sum(g((r) => r.units))} 個／人の直しが壊れた数 ①＋②：${sum(g((r) => r.broken))}・③：${tb}（比べた値 ${sum(g((r) => r.twin.leaves))}）`); }
  console.log(`\n## 場合7（確認の画面を見て、選べる単位を全部「外す」→ 送る前に人が直す → 送る）\n`);
  console.log('| 送る前の人の直し | 外す単位があった回 | 断られた（見ていない直しがある）| 通った | 通った時に壊れた、あとからの直し | 断られた時に変わった文書 |'); console.log('|---|---|---|---|---|---|');
  for (const late of [0, 1, 3, 10]) { let n = 0; let st = 0; let ok = 0; let lost = 0; let ch = 0;
    for (let s = 1; s <= SEEDS; s++) { const r = case7(s, late, 'M1w'); if (!r.drops) continue; n++; if (r.status === 'applied') { ok++; lost += r.lost; } else { st++; if (!r.unchanged) ch++; } }
    bad += lost + ch; console.log(`| ${late} 手 | ${n} | ${st} | ${ok} | ${lost} | ${ch} |`); }
  console.log('\n## 引き取り（同じ画面の選び方）：戻す → 残った「AI が足した部品」を引き取る → 人が 5 手なおす → 同じ作業をもう一度戻す\n');
  console.log('| 筋書き | 回 | 1回めの単位 | 引き取った部品 | 2回めの単位：引き取らない | 2回めの単位：引き取った | 壊れた直し | 引き取りで中身が変わった回 |'); console.log('|---|---|---|---|---|---|---|---|');
  for (const h of [1, 5, 20]) { const rs = []; for (let s = 1; s <= SEEDS; s++) { const r = secondRevert('下組みを丸ごと戻す', s, h); if (r) rs.push(r); } const g = (f) => rs.map(f); bad += sum(g((r) => r.m1.broken + r.m4.broken)) + rs.filter((r) => !r.sameDoc).length;
    console.log(`| 下組みを丸ごと戻す・人 ${h} 手 | ${rs.length} | ${mean(g((r) => r.first))} | ${mean(g((r) => r.adopted))} | ${mean(g((r) => r.m1.units))} | ${mean(g((r) => r.m4.units))} | ${sum(g((r) => r.m1.broken + r.m4.broken))} | ${rs.filter((r) => !r.sameDoc).length} |`); }
  console.log(bad ? `\n**壊れ・破れ・失敗が ${bad} 件**` : '\n壊れ・破れ・失敗：0 件'); if (bad) process.exitCode = 1;
}
if (process.argv[1] && process.argv[1].endsWith('cases.js')) main();
