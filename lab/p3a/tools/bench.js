#!/usr/bin/env node
// 速さの目安：部品 300個×点 20個の文書に、点を動かす命令を 2000 回当てる／記録から作り直す。
import { createState, applyBatch, replay, toEntries, rankBetween } from '../src/index.js';
const S = (v) => ({ k: 'static', v }); const H = { sender: { k: 'human', device: 'mac' } }; const INIT = { scenes: [{ id: 's1' }] };
let s = createState(INIT); let n = 0; let prev = null;
const cmd = (body) => ({ id: `c${++n}`, v: 1, actor: { k: 'human', device: 'mac' }, base: body.node && typeof body.node === 'string' ? { [`node:${body.node}`]: s.doc.revs[`node:${body.node}`] } : {}, body });
for (let i = 0; i < 300; i++) { prev = rankBetween(prev, null);
  s = applyBatch(s, [cmd({ type: 'node.add', node: { id: `n${i}`, scene: 's1', kind: 'shape', name: `n${i}`, order: prev, geo: { t: 'path', closed: true, pts: Array.from({ length: 20 }, (_, j) => ({ id: `p${j}`, p: S([j, i]), in: S([1, 0]), out: S([-1, 0]) })) }, fill: { color: S({ k: 'hex', v: '#888888' }) } } })], H).state; }
let t = process.hrtime.bigint();
for (let i = 0; i < 2000; i++) s = applyBatch(s, [cmd({ type: 'pt.nudge', node: `n${i % 300}`, pt: `p${i % 20}`, d: [0.5, -0.5] })], H).state;
const ap = Number(process.hrtime.bigint() - t) / 1e6;
t = process.hrtime.bigint(); const rp = replay(INIT, toEntries(s.log)); const re = Number(process.hrtime.bigint() - t) / 1e6;
console.log(`部品 300・点 6000 の文書：点を動かす命令 1つ ${(ap / 2000).toFixed(3)} ms（2000 回で ${ap.toFixed(0)} ms）／記録 ${rp.state.log.n} 件からの作り直し ${re.toFixed(0)} ms／文書の JSON ${(JSON.stringify(s.doc).length / 1024).toFixed(0)} KB`);
