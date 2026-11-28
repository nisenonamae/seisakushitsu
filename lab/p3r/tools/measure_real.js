#!/usr/bin/env node
// 実際の制作に近い記録（tools/realistic.js。**作り物**）で、追加の検証の 1・3・4 を測り直す → results/real.jsonl（1組1行）
//   node --expose-gc tools/measure_real.js            （4組。数分）
import fs from 'node:fs';
import * as NEW from '../src/index.js';
import * as OLD from '../src0/index.js';
import { realisticInMemory, INIT } from './realistic.js';
const { canon, docHash, toJournal, readJournal, makeSnapshot, readSnapshot, loadLazy, memArchive, slimLine, logItems, planRevert, open, applyBatch, makeUndo, makeRedo } = NEW;
const now = () => Number(process.hrtime.bigint()) / 1e6; const OUT = new URL('../results/real.jsonl', import.meta.url); fs.writeFileSync(OUT, '');
const CONFIGS = [{ parts: 30, drag: 'commit', rounds: 1 }, { parts: 120, drag: 'commit', rounds: 2 }, { parts: 300, drag: 'commit', rounds: 2 }, { parts: 300, drag: 'stream', rounds: 2 }, { parts: 300, drag: 'stream', rounds: 6 }];
const H = { sender: { k: 'human', device: 'mac' } };
for (const cfg of CONFIGS) {
  const o = { ...cfg }; let t = now(); const w = await realisticInMemory({ ...cfg, seed: 1 }); o.buildS = +((now() - t) / 1000).toFixed(1); const st = w.state; const items = logItems(st.log);
  o.records = items.length; o.partsNow = Object.keys(st.doc.nodes).length; o.docKB = Math.round(JSON.stringify(st.doc).length / 1024); o.stats = { undo: w.stats.undo, redo: w.stats.redo, selRecent: w.stats.selRecent, selOld: w.stats.selOld, ai: w.stats.aiRecords, human: w.stats.humanRecords, tasks: w.stats.tasks, drags: w.stats.drags };
  // 保存する量：命令だけ／効果つき／索引の控え。取り消し・やり直しの分
  const j = toJournal(st.log); const jf = toJournal(st.log, { full: true }); const rj = readJournal(j.lines); const rf = readJournal(jf.lines); const isUR = (e) => e.cmds[0].body.type === 'revert' && (e.cmds[0].body.mode === 'undo' || e.cmds[0].body.mode === 'redo');
  const sum = (ls, f) => ls.reduce((a, l, i) => a + (f(i) ? l.length : 0), 0); const idxBytes = rf.entries.reduce((a, e) => a + slimLine(e.n, e.h, e.applied).length, 0);
  o.bytes = { cmd: sum(j.lines, () => true), full: sum(jf.lines, () => true), idx: idxBytes, cmdUR: sum(j.lines, (i) => isUR(rj.entries[i])), fullUR: sum(jf.lines, (i) => isUR(rj.entries[i])) };
  o.urShare = { records: +((w.stats.undo + w.stats.redo) / items.length).toFixed(3), cmdBytes: +(o.bytes.cmdUR / o.bytes.cmd).toFixed(3), fullBytes: +(o.bytes.fullUR / o.bytes.full).toFixed(3) };
  // 1つの値の道・1つの部品に、操作がいくつ積もるか
  const lens = st.log.store.pathList.filter((p) => p.opE).map((p) => p.opE.length).sort((a, b) => a - b); const mulLens = st.log.store.pathList.filter((p) => p.opM && p.opM.includes(1)).map((p) => p.opM.filter((m) => m === 1).length).sort((a, b) => a - b);
  const per = [...st.log.store.byTarget.values()].map((l) => l.length).sort((a, b) => a - b); const q = (l, f) => (l.length ? l[Math.min(l.length - 1, Math.floor(l.length * f))] : 0);
  o.pathOps = { paths: lens.length, med: q(lens, 0.5), p99: q(lens, 0.99), max: q(lens, 1) }; o.mulOps = { paths: mulLens.length, med: q(mulLens, 0.5), p99: q(mulLens, 0.99), max: q(mulLens, 1) }; o.perPart = { med: q(per, 0.5), p99: q(per, 0.99), max: q(per, 1) };
  // 古い AI の作業を選んで戻す（計画だけ＝文書を変えない）。前回の核と、答えを突き合わせる
  let old = OLD.createState(INIT); for (const b of w.batches) old = OLD.applyBatch(old, b.cmds, { sender: b.sender }).state;
  if (canon(old.doc) !== canon(st.doc) || canon(OLD.logItems(old.log)) !== canon(items)) throw new Error('前回の核と、記録が違う');
  const tasks = new Map(); for (const a of items) if (a.sender.k === 'ai' && a.cmd.body.type !== 'revert') { const k = a.cmd.actor.task; if (!tasks.has(k)) tasks.set(k, []); tasks.get(k).push(a.cmd.id); }
  const tn = []; const to = []; let same = 0; let units = 0;
  const best = (f) => { let b = Infinity; let r; for (let i = 0; i < 3; i++) { const t0 = now(); r = f(); b = Math.min(b, now() - t0); } return [r, b]; };   // 3 回のうち、いちばん速い回（暖まる前の遅さを除く）
  for (const ids of tasks.values()) { const [p0, b0] = best(() => OLD.planRevert(old, ids)); const [p1, b1] = best(() => planRevert(st, ids)); tn.push(b1); to.push(b0); if (canon(p1) === canon(p0)) same++; units += p1.units.length; }
  const one = items.filter((a) => a.sender.k === 'ai' && a.cmd.body.type !== 'revert'); const t1 = []; const t1o = [];
  for (let i = 0; i < 120; i++) { const id = one[Math.floor((one.length - 1) * i / 119)].cmd.id; const [p0, b0] = best(() => OLD.planRevert(old, [id])); const [p1, b1] = best(() => planRevert(st, [id])); t1.push(b1); t1o.push(b0); if (canon(p1) !== canon(p0)) throw new Error('計画が違う'); }
  const ms = (l) => ({ mean: +(l.reduce((a, b) => a + b, 0) / l.length).toFixed(3), max: +Math.max(...l).toFixed(2) });
  o.revertTask = { tasks: tasks.size, samePlan: same, unitsPerTask: +(units / tasks.size).toFixed(1), now: ms(tn), before: ms(to) }; o.revertOne = { now: ms(t1), before: ms(t1o) };
  // 直前の操作の取り消し ⇄ やり直し
  { let s = st; const t0 = now(); let k = 0; for (let i = 0; i < 100; i++) { const u = makeUndo(s.log, 'mac', `mu${i}`); if (!u) break; let r = applyBatch(s, [u], H); if (r.status !== 'applied') break; s = r.state; const d = makeRedo(s.log, 'mac', `mr${i}`); r = applyBatch(s, [d], H); if (r.status !== 'applied') break; s = r.state; k += 2; } o.undoMs = k ? +((now() - t0) / k).toFixed(3) : null; }
  // 3：写し＋続き。どの時点で閉じても開けるか。前のやり方（写し＋続きだけ）が使えない時点の割合を、記録から数える
  const arch = memArchive(rf.entries); const batchOf = new Map(); rf.entries.forEach((e, i) => { for (const a of e.applied) batchOf.set(a.cmd.id, i + 1); });
  o.tailNeedsHistory = {};
  for (const K of [250, 1000]) {
    let badPoints = 0; let blockers = 0; let until = 0;   // until＝この番号より前で閉じると、前のやり方では開けない
    for (let n = 1; n <= rf.entries.length; n++) { const snapN = Math.floor((n - 1) / K) * K; const e = rf.entries[n - 1];
      if (e.cmds.some((c) => c.body.type === 'revert' && c.body.targets.some((id) => batchOf.get(id) <= snapN))) { blockers++; until = Math.max(until, snapN + K); }   // 次の写しまで、ずっと使えない
      if (n <= until && n > snapN && until === snapN + K) badPoints++; }
    o.tailNeedsHistory[K] = { closePoints: rf.entries.length, cannotOpenOldWay: badPoints, share: +(badPoints / rf.entries.length).toFixed(3), blockers };
  }
  // 実際に開いて確かめる：写しを K=1000（小さい記録は 250）ごとに置き、次の写しの直前で閉じた時
  { const K = rf.entries.length > 3000 ? 1000 : 250; let s = NEW.createState(INIT); const snaps = []; const pts = []; for (let n = 1; n <= rf.entries.length; n++) { const e = rj.entries[n - 1]; s = applyBatch(s, e.cmds, { sender: e.sender }).state; if (n % K === 0) snaps.push({ n, text: makeSnapshot(s, n, e.h) }); if ((n % K === K - 1 && n > K) || n === rf.entries.length) pts.push({ n, hash: docHash(s.doc) }); }
    let oldFail = 0; let newOk = 0; const tNew = []; const tOld = []; let reads = 0; let snapBytes = 0;
    for (const p of pts.slice(-12)) { const sn = snaps.filter((x) => x.n <= p.n).pop(); if (!sn) continue; snapBytes = sn.text.length;
      let t0 = now(); const snap = readSnapshot(sn.text); const before = arch.reads; const L = loadLazy(snap, arch.slims(snap.seq), rj.entries.slice(sn.n, p.n), arch); tNew.push(now() - t0); reads += arch.reads - before; if (!L.skipped.length && docHash(L.state.doc) === p.hash) newOk++;
      t0 = now(); const O = open(INIT, j.lines.slice(0, p.n), [sn.text]); tOld.push(now() - t0); if (!O.used) oldFail++; if (docHash(O.state.doc) !== p.hash) throw new Error('前のやり方で、文書が違う'); }
    o.openCheck = { K, points: tNew.length, newOk, oldCouldNotUseSnapshot: oldFail, newMs: ms(tNew), oldMs: ms(tOld), archiveReads: reads, snapKB: Math.round(snapBytes / 1024), slimInlineKB: Math.round(idxBytes / 1024) }; }
  fs.appendFileSync(OUT, JSON.stringify(o) + '\n'); console.log(JSON.stringify(o));
}
