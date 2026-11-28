#!/usr/bin/env node
// メモリを抑える方法の比べ（追加の検証 BRIEF2 の 2）。1つの組を測って、JSON を1行ずつ results/mem.jsonl に足す（途中で止まっても、そこまでは残る）。
//   node --expose-gc --max-old-space-size=6000 tools/bench_mem.js <mem|paged> <件数> <部品> <spread|hot|real-commit|real-stream>
//   mem   ＝記録の全部（本体＋索引）をメモリに持つ（前回の形）
//   paged ＝本体は束のファイルに置き、メモリには索引と、新しい 2000 件だけ（src/fsjournal.js）。閉じて、開き直す所まで測る
// fsync は切って測る（計算と読み書きの量を見る。fsync の時間は tools/bench_fsync.js で別に測る）。数字は、作った操作で測った物。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState, applyBatch, makeUndo, makeRedo, docHash, logLength, indexStats, canon, sha256 } from '../src/index.js';
import { openStore } from '../src/fsjournal.js';
import { workload } from './bench.js';
import { runRealistic, INIT as RINIT } from './realistic.js';

const [METHOD, NS, PS, MODE] = process.argv.slice(2); const N = Number(NS); const P = Number(PS); const here = path.dirname(fileURLToPath(import.meta.url)); const OUT = process.env.P3R_OUT || path.join(here, '../results/mem.jsonl');
const HU = { sender: { k: 'human', device: 'mac' } }; const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } };
const now = () => Number(process.hrtime.bigint()) / 1e6; const gc = () => { if (global.gc) { global.gc(); global.gc(); } const m = process.memoryUsage(); return { heap: Math.round(m.heapUsed / 1048576), ext: Math.round((m.external + m.arrayBuffers) / 1048576), rss: Math.round(m.rss / 1048576) }; };
const out = { method: METHOD, n: N, parts: P, mode: MODE }; const emit = (stage) => fs.appendFileSync(OUT, JSON.stringify({ ...out, stage }) + '\n');
const dir = `/tmp/p3r/mem-${METHOD}-${N}-${P}-${MODE}`; fs.rmSync(dir, { recursive: true, force: true });
const SOPT = { segSize: 1000, snapEvery: 1000, hot: 2000, cacheSegs: 4, fsync: false };
const mem0 = gc(); let st = METHOD === 'paged' ? openStore(dir, MODE.startsWith('real') ? RINIT : INIT, SOPT) : null; let s = createState(MODE.startsWith('real') ? RINIT : INIT);
const REAL = MODE.startsWith('real'); const realAi = [];
const io = { get state() { return st ? st.state : s; }, apply(cmds, ctx) { const r = st ? st.apply(cmds, ctx) : applyBatch(s, cmds, ctx); if (r.status === 'applied') { if (!st) s = r.state; if (REAL && ctx.sender.k === 'ai' && cmds[0].body.type !== 'revert') realAi.push(cmds[0].id); } return r; } };
const aiIds = []; let t = now(); let c = 0; const id = () => `z${++c}`;
if (MODE.startsWith('real')) { const stats = runRealistic({ parts: P, drag: MODE.slice(5), rounds: Number(process.env.P3R_ROUNDS || 2), seed: 1 }, io); out.stats = { applied: stats.applied, undo: stats.undo, redo: stats.redo, selOld: stats.selOld, selRecent: stats.selRecent }; }
else {
  const w = workload(N, P, MODE); const mk = (i, ctx, body, node) => ({ id: i, v: 1, actor: ctx.sender.k === 'human' ? { k: 'human', device: 'mac' } : { k: 'ai', agent: 'w1', task: 't' + (Number(i.slice(1)) >> 6) }, base: node ? { [`node:${node}`]: io.state.doc.revs[`node:${node}`] } : {}, body });
  for (const p of w.parts) { const r = io.apply([mk(w.id(), p.ctx, p.body)], p.ctx); if (r.status !== 'applied') throw new Error(r.message); }
  t = now(); const lastFrom = N - 2000; let tLast = 0;
  for (let i = 0; i < N; i++) { if (i === lastFrom) tLast = now(); const g = w.gen(i); const cmd = mk(w.id(), g.ctx, g.body, g.node); const r = io.apply([cmd], g.ctx); if (r.status !== 'applied') throw new Error(`${i} ${r.message}`); if (g.ctx.sender.k === 'ai' && (i % 97 === 0 || i < 50)) aiIds.push(cmd.id); if (i % 500000 === 499999) { out.progress = i + 1; out.memAt = gc(); emit('building'); } }
  out.applyLastMs = +((now() - tLast) / 2000).toFixed(4);
}
out.buildS = +((now() - t) / 1000).toFixed(1); out.records = logLength(io.state.log); out.applyMs = +((now() - t) * 1 / out.records).toFixed(4); delete out.progress; delete out.memAt;
const m1 = gc(); out.heapMB = m1.heap - mem0.heap; out.typedMB = m1.ext - mem0.ext; out.rssMB = m1.rss; out.index = indexStats(io.state.log); emit('built');
if (REAL) for (const x of realAi) aiIds.push(x);   // AI の記録の id は、作り手が送った順から（本体を読まずに済むように）
// 取り消し：直前の操作（200 往復）・古い AI の記録（頭・まん中・終わりから 40 件を 1 件ずつ）
let round = 0;
const ops = () => {
  const o = {}; let t0 = now(); let k = 0;
  for (let i = 0; i < 200; i++) { const u = makeUndo(io.state.log, 'mac', id()); if (!u) break; let r = io.apply([u], HU); if (r.status !== 'applied') break; const d = makeRedo(io.state.log, 'mac', id()); r = io.apply([d], HU); k += 2; }
  o.undoMs = k ? +((now() - t0) / k).toFixed(4) : null;
  const pick = [...new Set(Array.from({ length: 40 }, (_, i) => aiIds[Math.floor((aiIds.length - 1) * ((i + round * 0.5) / 40))]))].filter(Boolean); const ts = []; const h = [];
  const reads0 = st ? st.info.segReads : 0;
  for (const tid of pick) { t0 = now(); const r = io.apply([{ id: id(), v: 1, actor: { k: 'human', device: 'mac' }, body: { type: 'revert', mode: 'units', targets: [tid] } }], HU); ts.push(now() - t0); if (r.status !== 'applied') throw new Error('revert ' + r.message); h.push(canon(r.applied)); }
  ts.sort((a, b) => a - b); if (ts.length) { o.revertMs = +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(3); o.revertMedMs = +ts[ts.length >> 1].toFixed(3); o.revertMaxMs = +ts[ts.length - 1].toFixed(2); } o.revertSegReads = st ? st.info.segReads - reads0 : 0;
  round++; o.revertsHash = sha256(h.join('|')).slice(0, 16); o.docHash = docHash(io.state.doc).slice(0, 16); return o;
};
Object.assign(out, ops()); emit('ops');
if (st) {
  out.files = st.files(); out.filesMB = { seg: +(out.files.seg / 1048576).toFixed(1), idx: +(out.files.idx / 1048576).toFixed(1), snap: +(out.files.snap / 1048576).toFixed(2) }; delete out.files; st.close(); st = null; const before = gc();
  // 新しいプロセスで開くだけ（開く時間・開いたあとのメモリ。このプロセスの中で開き直すと、前の入れ物が残っていて、メモリが倍に見えた）
  { const { spawnSync } = await import('node:child_process'); const r = spawnSync(process.execPath, ['--expose-gc', `--max-old-space-size=${process.env.P3R_OPEN_HEAP || 5000}`, path.join(here, 'open_only.js'), dir, ...(REAL ? ['real'] : [])], { encoding: 'utf8' }); try { out.freshOpen = JSON.parse(r.stdout); } catch { out.freshOpen = { error: (r.stderr || String(r.signal)).slice(0, 200) }; } emit('fresh-open'); }
  // 開き直す（写し＋索引の控え＋続き）
  t = now(); st = openStore(dir, MODE.startsWith('real') ? RINIT : INIT, SOPT); out.openS = +((now() - t) / 1000).toFixed(2); out.openMs = st.info.ms; out.openUsed = st.info.used; out.openTail = st.info.tail;
  const m2 = gc(); out.afterOpen = { heapMB: m2.heap - mem0.heap, typedMB: m2.ext - mem0.ext, rssMB: m2.rss }; out.docHashAfterOpen = docHash(st.state.doc).slice(0, 16);
  { const o2 = ops(); out.afterOpenOps = o2; }
  st.close();
  if (process.env.P3R_KEEP !== '1') fs.rmSync(dir, { recursive: true, force: true });
}
emit('done'); console.log(JSON.stringify(out));
