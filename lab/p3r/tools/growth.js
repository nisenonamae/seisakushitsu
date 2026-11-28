#!/usr/bin/env node
// 取り消し・やり直しのくり返しで、記録がどう太るか（追加の検証 BRIEF2 の 4）→ results/growth.jsonl
// 土台は、実際の制作に近い記録（作り物・部品 120・2 回）。その終わりで、直前の操作の 取り消し ⇄ やり直し をくり返す。ファイルに保存しながら（fsync は切る）。
//   node --expose-gc tools/growth.js [組の数の上限=100000]
import fs from 'node:fs';
import { makeUndo, makeRedo, docHash, canon, content, logLength, sha256 } from '../src/index.js';
import { openStore } from '../src/fsjournal.js';
import { runRealistic, INIT } from './realistic.js';
const MAX = Number(process.argv[2] || 100000); const dir = '/tmp/p3r/growth'; fs.rmSync(dir, { recursive: true, force: true }); const OUT = new URL('../results/growth.jsonl', import.meta.url); fs.writeFileSync(OUT, '');
const OPT = { segSize: 1000, snapEvery: 1000, hot: 2000, fsync: false }; const H = { sender: { k: 'human', device: 'mac' } }; const now = () => Number(process.hrtime.bigint()) / 1e6;
const gc = () => { global.gc && global.gc(); const m = process.memoryUsage(); return Math.round((m.heapUsed + m.arrayBuffers) / 1048576); };
let st = openStore(dir, INIT, OPT); const io = { get state() { return st.state; }, apply: (c, x) => st.apply(c, x) }; runRealistic({ parts: 120, rounds: 2, seed: 1 }, io);
const base = canon(content(st.state.doc)); const baseRecords = logLength(st.state.log); let pairs = 0; let c = 0; let f0 = null;
const measure = () => {
  const f = st.files(); st.close(); const t = now(); st = openStore(dir, INIT, OPT); const openMs = now() - t; if (!f0) f0 = f;
  const t1 = now(); for (let i = 0; i < 50; i++) { st.apply([makeUndo(st.state.log, 'mac', `g${++c}`)], H); st.apply([makeRedo(st.state.log, 'mac', `g${++c}`)], H); } const pairMs = (now() - t1) / 50; pairs += 50;
  const o = { pairs: pairs - 50, records: logLength(st.state.log) - 100, undoRedoShare: +((pairs * 2 - 100 + 398) / (logLength(st.state.log) - 100)).toFixed(3), segMB: +(f.seg / 1048576).toFixed(2), idxMB: +(f.idx / 1048576).toFixed(2), bytesPerPairFull: pairs > 50 ? Math.round((f.seg - f0.seg) / (pairs - 50)) : null, bytesPerPairIdx: pairs > 50 ? Math.round((f.idx - f0.idx) / (pairs - 50)) : null,
    openMs: +openMs.toFixed(0), open: st.info.ms, pairMs: +pairMs.toFixed(3), memMB: gc(), sameContent: canon(content(st.state.doc)) === base };
  fs.appendFileSync(OUT, JSON.stringify(o) + '\n'); console.log(JSON.stringify(o));
};
measure();
for (const target of [1000, 10000, 100000, 1000000].filter((x) => x <= MAX)) { while (pairs < target) { let r = st.apply([makeUndo(st.state.log, 'mac', `g${++c}`)], H); if (r.status !== 'applied') throw new Error(r.message); r = st.apply([makeRedo(st.state.log, 'mac', `g${++c}`)], H); if (r.status !== 'applied') throw new Error(r.message); pairs++; } measure(); }
st.close(); fs.rmSync(dir, { recursive: true, force: true });
