#!/usr/bin/env node
// メモリの内訳（追加の検証 BRIEF2 の 2）：記録の本体（効果つき）／命令だけ／索引 が、1件あたり何バイトか。10 万件・部品 300・ばらけた操作（作った操作）。
//   node --expose-gc tools/mem_parts.js [件数=100000]
import { createState, applyBatch, logItems, evictLog, setArchive, slimOf } from '../src/index.js';
import { workload } from './bench.js';
const N = Number(process.argv[2] || 100000); const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } };
const heap = () => { global.gc(); global.gc(); const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
const h0 = heap(); const w = workload(N, 300, 'spread'); let s = createState(INIT);
const mk = (id, ctx, body, node) => ({ id, v: 1, actor: ctx.sender.k === 'human' ? { k: 'human', device: 'mac' } : { k: 'ai', agent: 'w1', task: 't' }, base: node ? { [`node:${node}`]: s.doc.revs[`node:${node}`] } : {}, body });
for (const p of w.parts) s = applyBatch(s, [mk(w.id(), p.ctx, p.body)], p.ctx).state;
const h1 = heap(); for (let i = 0; i < N; i++) { const g = w.gen(i); s = applyBatch(s, [mk(w.id(), g.ctx, g.body, g.node)], g.ctx).state; }
const all = heap() - h1;
let cmds = logItems(s.log).slice(300).map((a) => JSON.parse(JSON.stringify({ cmd: a.cmd, sender: a.sender, batch: a.batch }))); const hc = heap() - h1 - all; cmds = null;
let slims = logItems(s.log).slice(300).map((a) => JSON.parse(JSON.stringify(slimOf(a)))); const hs = heap() - h1 - all; slims = null;
setArchive(s.log, { get() { throw new Error('読まない'); } }); evictLog(s.log, N + 300); const idx = heap() - h1;
console.log(JSON.stringify({ n: N, perRecordBytes: { all: Math.round(all / N), bodyWithEffects: Math.round((all - idx) / N), index: Math.round(idx / N), commandsOnlyBody: Math.round(hc / N), slimBody: Math.round(hs / N) } }));
