#!/usr/bin/env node
// 効果つきの記録（自分の端末の控え）からの読みこみだけを測る（tools/bench.js の読みこみの所を、あとで速くしたので、測り直す用）。
//   node --expose-gc --max-old-space-size=6500 tools/bench_load.js <件数> <部品の数> <spread|hot>
import { createState, applyBatch, logLength, toJournal, readJournal, loadTrusted, loadIndexed, loadTail, makeSnapshot, readSnapshot, docHash, hydrate } from '../src/index.js';
import { workload } from './bench.js';
const N = Number(process.argv[2] || 10000); const P = Number(process.argv[3] || 300); const MODE = process.argv[4] || 'spread';
const HU = { sender: { k: 'human', device: 'mac' } }; const AI = { sender: { k: 'ai', agent: 'w1' } }; const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } };
const now = () => Number(process.hrtime.bigint()) / 1e6; const out = { n: N, parts: P, mode: MODE, loads: true };
const mk = (id, ctx, body, doc, node) => ({ id, v: 1, actor: ctx.sender.k === 'human' ? { k: 'human', device: 'mac' } : { k: 'ai', agent: 'w1', task: 't' + (Number(id.slice(1)) >> 6) }, base: node ? { [`node:${node}`]: doc.revs[`node:${node}`] } : {}, body });
const w = workload(N, P, MODE); let s = createState(INIT); const heads = {}; let firstAI = null;
for (const p of w.parts) s = applyBatch(s, [mk(w.id(), p.ctx, p.body, s.doc)], p.ctx).state;
for (let i = 0; i < N; i++) { if (i === N - 100 || i === N - 1000 || i === N - 10000) heads[N - i] = s; const g = w.gen(i); const cmd = mk(w.id(), g.ctx, g.body, s.doc, g.node); const r = applyBatch(s, [cmd], g.ctx); if (r.status !== 'applied') throw new Error(r.message); s = r.state; if (!firstAI && g.ctx.sender.k === 'ai') firstAI = cmd.id; }
const want = docHash(s.doc); let t = now(); const jf = toJournal(s.log, { full: true }); out.writeFullS = +((now() - t) / 1000).toFixed(2); out.journalFullMB = +(jf.lines.reduce((a, l) => a + l.length, 0) / 1048576).toFixed(2);
const snapText = {}; for (const K of [100, 1000, 10000]) if (heads[K] && K < jf.lines.length) { const at = jf.lines.length - K; snapText[K] = makeSnapshot(heads[K], at, jf.lines[at - 1].slice(0, 16)); heads[K] = null; }
s = null;
t = now(); const rf = readJournal(jf.lines); out.readFullS = +((now() - t) / 1000).toFixed(2);
t = now(); let L = loadTrusted(INIT, rf.entries); out.trustedS = +((now() - t) / 1000).toFixed(2); if (docHash(L.state.doc) !== want || logLength(L.state.log) !== N + P) throw new Error('trusted'); L = null; if (global.gc) global.gc();
out.snap = {};
for (const K of [100, 1000, 10000]) { const text = snapText[K]; if (!text) continue; const o = {}; const at = jf.lines.length - K;
  t = now(); const I = loadIndexed(readSnapshot(text), rf.entries); o.indexedLoadMs = +(now() - t).toFixed(1); if (docHash(I.state.doc) !== want) throw new Error('indexed');
  // 写し＋続きだけ（頭は読まない。続きは検査つきで当て直す）
  t = now(); const tail = readJournal(jf.lines.slice(at), { prev: rf.entries[at - 1].h, n: at }); const T = loadTail(readSnapshot(text), tail.entries); o.tailLoadMs = +(now() - t).toFixed(1); if (docHash(T.state.doc) !== want) throw new Error('tail');
  const cmd = { id: 'zz1', v: 1, actor: { k: 'human', device: 'mac' }, body: { type: 'revert', mode: 'units', targets: [firstAI] } }; let r = applyBatch(T.state, [cmd], HU); o.oldRevert = r.status === 'rejected' ? r.reason : r.status;
  t = now(); const rf2 = readJournal(jf.lines); const full = hydrate(INIT, T.state, rf2.entries); r = applyBatch(full, [cmd], HU); o.reachBackS = +((now() - t) / 1000).toFixed(2); if (r.status !== 'applied') throw new Error('reach ' + r.status + ' ' + r.reason + ' ' + r.message + JSON.stringify(r.detail));
  out.snap[K] = o; if (global.gc) global.gc(); }
console.log(JSON.stringify(out));
