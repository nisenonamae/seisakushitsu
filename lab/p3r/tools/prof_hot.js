#!/usr/bin/env node
// 1つの値の道に操作が集中した時の、古い AI の操作を戻す1回の内訳（BRIEF2 の 1）。
//   node --cpu-prof --cpu-prof-dir=/tmp/p3r/prof tools/prof_hot.js <件数> [hot|spread]   → そのあと node tools/prof_top.js /tmp/p3r/prof/<ファイル>
// 記録を作る所は測りに入れない（console.profile は使わず、作る時間と戻す時間を別に出す）。
import { workload } from './bench.js';
// P3R_ENGINE=src0 で、前回の核（突き合わせ用の写し）を測る。部品の数は P3R_PARTS（既定 300）
const ENGINE = process.env.P3R_ENGINE || 'src'; const { applyBatch, createState, revertTuning, docHash } = await import(`../${ENGINE}/index.js`);
const N = Number(process.argv[2] || 100000); const MODE = process.argv[3] || 'hot';
const HU = { sender: { k: 'human', device: 'mac' } }; const AI = { sender: { k: 'ai', agent: 'w1' } };
const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } };
const mk = (id, ctx, body, doc, node) => ({ id, v: 1, actor: ctx.sender.k === 'human' ? { k: 'human', device: 'mac' } : { k: 'ai', agent: 'w1', task: 't' + (Number(id.slice(1)) >> 6) }, base: node ? { [`node:${node}`]: doc.revs[`node:${node}`] } : {}, body });
const now = () => Number(process.hrtime.bigint()) / 1e6;
const w = workload(N, Number(process.env.P3R_PARTS || 300), MODE); let s = createState(INIT); const aiIds = [];
for (const p of w.parts) s = applyBatch(s, [mk(w.id(), p.ctx, p.body, s.doc)], p.ctx).state;
let t = now();
for (let i = 0; i < N; i++) { const g = w.gen(i); const cmd = mk(w.id(), g.ctx, g.body, s.doc, g.node); const r = applyBatch(s, [cmd], g.ctx); if (r.status !== 'applied') throw new Error(r.message); s = r.state; if (g.ctx.sender.k === 'ai') aiIds.push(cmd.id); }
const build = now() - t; const R = Number(process.env.R || 60); const ts = [];
t = now();
for (let i = 0; i < R; i++) { const id = aiIds[Math.floor((aiIds.length - 1) * (i / (R - 1)))]; const t0 = now(); const r = applyBatch(s, [{ id: w.id(), v: 1, actor: { k: 'human', device: 'mac' }, body: { type: 'revert', mode: 'units', targets: [id] } }], HU); ts.push(now() - t0); if (r.status !== 'applied') throw new Error(r.message); s = r.state; }
ts.sort((a, b) => a - b);
console.log(JSON.stringify({ n: N, mode: MODE, parts: Number(process.env.P3R_PARTS || 300), engine: ENGINE, docHash: docHash(s.doc).slice(0, 16), medMs: +ts[ts.length >> 1].toFixed(3), buildS: +(build / 1000).toFixed(1), reverts: R, meanMs: +(ts.reduce((a, b) => a + b, 0) / R).toFixed(3), maxMs: +ts[ts.length - 1].toFixed(2) }));
