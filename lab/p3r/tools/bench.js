#!/usr/bin/env node
// 速さと大きさの測り（P3r の A-1・A-2）。1つの組（記録の件数・部品の数・操作の集まり方）を測って、JSON を1行で出す。
//   node --expose-gc --max-old-space-size=6500 tools/bench.js <件数> <部品の数> <spread|hot>
// 数字は、こちらで作った操作（種つきの乱数）で測った物。本物の操作ではない。
import { createState, applyBatch, makeUndo, makeRedo, mulberry32, rankBetween, logLength, logItems, toJournal, journalLine, GENESIS, readJournal, loadReplay, loadTrusted, loadTail, loadIndexed,
  makeSnapshot, readSnapshot, docHash, hydrate, planRevert } from '../src/index.js';

const N = Number(process.argv[2] || 10000); const P = Number(process.argv[3] || 300); const MODE = process.argv[4] || 'spread';
const S = (v) => ({ k: 'static', v }); const HU = { sender: { k: 'human', device: 'mac' } }; const AI = { sender: { k: 'ai', agent: 'w1' } };
const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } };
const now = () => Number(process.hrtime.bigint()) / 1e6;
const gc = () => { if (global.gc) { global.gc(); global.gc(); } return process.memoryUsage().heapUsed / 1048576; };
const out = { n: N, parts: P, mode: MODE };

export function workload(N, P, MODE, seed = 7) {
  const rng = mulberry32(seed); let c = 0; const flip = new Array(P).fill(false); const cmds = [];
  let prev = null; const parts = [];
  for (let i = 0; i < P; i++) { prev = rankBetween(prev, null);
    parts.push({ ctx: HU, body: { type: 'node.add', node: { id: `n${i}`, scene: 's1', kind: 'shape', name: `n${i}`, order: prev, geo: { t: 'path', closed: true, pts: Array.from({ length: 8 }, (_, j) => ({ id: `p${j}`, p: S([j, i]), in: S([1, 0]), out: S([-1, 0]) })) }, fill: { color: S({ k: 'hex', v: '#888888' }) } } } }); }
  const gen = (i) => {
    if (MODE === 'hot') { const f = i % 2 ? 0.8 : 1.25; return { ctx: i % 10 === 3 ? AI : HU, node: 'n0', body: { type: 'prop.scale', node: 'n0', path: 'xf.scale', f: [f] } }; }
    const k = Math.floor(rng() * P); const node = `n${k}`; const r = rng(); const ctx = rng() < 0.2 ? AI : HU;
    if (r < 0.4) return { ctx, node, body: { type: 'pt.nudge', node, pt: `p${Math.floor(rng() * 8)}`, d: [Math.round(rng() * 200 - 100) / 10, Math.round(rng() * 200 - 100) / 10] } };
    if (r < 0.6) return { ctx, node, body: { type: 'prop.nudge', node, path: 'xf.pos', d: [Math.round(rng() * 200 - 100) / 10, Math.round(rng() * 200 - 100) / 10] } };
    if (r < 0.8) { flip[k] = !flip[k]; return { ctx, node, body: { type: 'prop.scale', node, path: 'xf.scale', f: [flip[k] ? 1.25 : 0.8] } }; }
    return { ctx, node, body: { type: 'prop.set', node, path: 'fill.color', value: S({ k: 'hex', v: '#' + Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0') }) } };
  };
  return { parts, gen, id: () => `c${++c}` };
}
const mk = (id, ctx, body, doc, node) => ({ id, v: 1, actor: ctx.sender.k === 'human' ? { k: 'human', device: 'mac' } : { k: 'ai', agent: 'w1', task: 't' + (Number(id.slice(1)) >> 6) }, base: node ? { [`node:${node}`]: doc.revs[`node:${node}`] } : {}, body });

async function main() {
  const base0 = gc(); const w = workload(N, P, MODE); let s = createState(INIT);
  for (const p of w.parts) { const r = applyBatch(s, [mk(w.id(), p.ctx, p.body, s.doc)], p.ctx); if (r.status !== 'applied') throw new Error(r.message); s = r.state; }
  out.docKB = Math.round(JSON.stringify(s.doc).length / 1024);
  // 1 命令を当てる
  let t = now(); let tLast = 0; const lastFrom = N - Math.min(2000, N); const aiIds = [];
  const heads = {};
  for (let i = 0; i < N; i++) {
    if (i === lastFrom) tLast = now(); if (i === N - 100 || i === N - 1000 || i === N - 10000) heads[N - i] = s;
    const g = w.gen(i); const cmd = mk(w.id(), g.ctx, g.body, s.doc, g.node); const r = applyBatch(s, [cmd], g.ctx);
    if (r.status !== 'applied') throw new Error(`${i} ${r.reason} ${r.message}`); s = r.state; if (g.ctx === AI) aiIds.push(cmd.id);
  }
  const t1 = now(); out.applyMs = +((t1 - t) / N).toFixed(4); out.applyLastMs = +((t1 - tLast) / (N - lastFrom)).toFixed(4); out.buildS = +((t1 - t) / 1000).toFixed(1);
  out.heapMB = Math.round(gc() - base0);
  let built = s; const records = logLength(s.log);
  // 2 ふつうの取り消し・やり直し（直前の操作）を 200 往復
  t = now(); for (let i = 0; i < 200; i++) { const u = makeUndo(s.log, 'mac', w.id()); let r = applyBatch(s, [u], HU); if (r.status !== 'applied') throw new Error('undo ' + r.message); s = r.state; const d = makeRedo(s.log, 'mac', w.id()); r = applyBatch(s, [d], HU); if (r.status !== 'applied') throw new Error('redo ' + r.message); s = r.state; }
  out.undoMs = +((now() - t) / 400).toFixed(4);
  // 3 選んで取り消す：古い AI の記録を 1件ずつ（記録の頭のほう・まん中・終わりのほうから 60 件）
  const pick = []; for (let i = 0; i < 60; i++) pick.push(aiIds[Math.floor((aiIds.length - 1) * (i / 59))]);
  let worst = 0; let rebuilt = 0; let rebuiltMax = 0; let kept = 0; const ts = [];
  for (const id of [...new Set(pick)]) { const t0 = now(); const r = applyBatch(s, [{ id: w.id(), v: 1, actor: { k: 'human', device: 'mac' }, body: { type: 'revert', mode: 'units', targets: [id] } }], HU); const dt = now() - t0; if (r.status !== 'applied') throw new Error('revert ' + r.message); s = r.state; ts.push(dt); worst = Math.max(worst, dt);
    for (const o of r.outcomes) { if (o.rebuilt) rebuilt++; if (o.result === 'kept') kept++; } }
  ts.sort((a, b) => a - b); out.revertMs = +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(4); out.revertMedMs = +ts[ts.length >> 1].toFixed(4); out.revertMaxMs = +worst.toFixed(3); out.rebuilt = rebuilt; out.revertKept = kept;
  // 計画だけ（文書を変えない）
  t = now(); planRevert(s, [aiIds[aiIds.length >> 1]]); out.planMs = +(now() - t).toFixed(3);
  // 4 保存する量（命令だけ／効果つき）
  s = built; built = null; t = now(); const jc = toJournal(s.log); out.journalWriteS = +((now() - t) / 1000).toFixed(2); out.journalMB = +(jc.lines.reduce((a, l) => a + l.length, 0) / 1048576).toFixed(2); out.bytesPerRecord = Math.round(out.journalMB * 1048576 / records);
  const BIG = N > 200000;
  let jf = null; if (!BIG) { jf = toJournal(s.log, { full: true }); out.journalFullMB = +(jf.lines.reduce((a, l) => a + l.length, 0) / 1048576).toFixed(2); }
  else { let sum = 0; let prev = GENESIS; let n = 0; for (const a of logItems(s.log).slice(0, 20000)) { const l = journalLine(++n, prev, a.sender, [a.cmd], [a]); sum += l.text.length; prev = l.h; } out.journalFullMB = +((sum / 20000) * records / 1048576).toFixed(1); out.journalFullEstimated = true; }
  const want = docHash(s.doc); out.docHash = want.slice(0, 12);
  // 5 読みこみ（記録だけから）
  const snapText = {}; const snapMs = {};
  for (const K of [100, 1000, 10000]) { if (!heads[K] || K >= jc.lines.length) continue; const at = jc.lines.length - K; t = now(); snapText[K] = makeSnapshot(heads[K], at, jc.lines[at - 1].slice(0, 16)); snapMs[K] = now() - t; heads[K] = null; }
  s = null;
  t = now(); const rj = readJournal(jc.lines); out.readS = +((now() - t) / 1000).toFixed(2); if (!rj.clean) throw new Error('journal');
  t = now(); let L = loadReplay(INIT, rj.entries); out.replayS = +((now() - t) / 1000).toFixed(2); if (L.skipped.length || docHash(L.state.doc) !== want) throw new Error('replay differs');
  L = null; gc();
  let rf = null;
  if (jf) { t = now(); rf = readJournal(jf.lines); out.readFullS = +((now() - t) / 1000).toFixed(2); t = now(); L = loadTrusted(INIT, rf.entries); out.trustedS = +((now() - t) / 1000).toFixed(2); if (docHash(L.state.doc) !== want) throw new Error('trusted differs'); L = null; }
  // 6 写しを併用（間かく K：写しのあとに K まとまり。いちばん長く待つ場合）
  out.snap = {};
  for (const K of [100, 1000, 10000]) {
    if (K >= rj.entries.length) continue; const at = rj.entries.length - K; const o = {};
    const text = snapText[K]; if (!text) continue;
    o.writeMs = +snapMs[K].toFixed(1); o.snapKB = Math.round(text.length / 1024); o.writePerCmdMs = +(o.writeMs / K).toFixed(4);
    t = now(); const snap = readSnapshot(text); const tail = readJournal(jc.lines.slice(at), { prev: rj.entries[at - 1].h, n: at }); let T = loadTail(snap, tail.entries); o.tailLoadMs = +(now() - t).toFixed(1);
    if (T.skipped.length || docHash(T.state.doc) !== want) throw new Error('tail differs ' + K);
    // 写しより前の操作を戻す → 断られる → 古い記録を読み足す（さかのぼる）→ 戻す
    const old = aiIds[0]; let r = applyBatch(T.state, [{ id: 'zz1', v: 1, actor: { k: 'human', device: 'mac' }, body: { type: 'revert', mode: 'units', targets: [old] } }], HU); o.oldRevert = r.status === 'rejected' ? r.reason : r.status;
    if (!BIG || K === 1000) { t = now(); const full = hydrate(INIT, T.state, rf ? rf.entries : rj.entries); r = applyBatch(full, [{ id: 'zz1', v: 1, actor: { k: 'human', device: 'mac' }, body: { type: 'revert', mode: 'units', targets: [old] } }], HU); o.reachBackS = +((now() - t) / 1000).toFixed(2); if (r.status !== 'applied') throw new Error('reach back'); }
    // 写しより後の操作は、そのまま戻せる
    const u = makeUndo(T.state.log, 'mac', 'zz2'); if (u) { t = now(); r = applyBatch(T.state, [u], HU); o.tailUndoMs = +(now() - t).toFixed(3); o.tailUndo = r.status === 'rejected' ? r.reason : r.status; }
    T = null;
    if (rf) { t = now(); const snap2 = readSnapshot(text); const I = loadIndexed(snap2, rf.entries); o.indexedLoadMs = +(now() - t).toFixed(1); if (docHash(I.state.doc) !== want) throw new Error('indexed differs'); }
    out.snap[K] = o; gc();
  }
  console.log(JSON.stringify(out));
}
if (process.argv[1] && process.argv[1].endsWith('bench.js')) main();
