#!/usr/bin/env node
// 1 まとまりを保存する時間：fsync あり／なし（追加の検証 BRIEF2 の 7）。この機械のディスク（仮想のディスク）での数字。本物の端末では変わる。
import fs from 'node:fs';
import { openStore } from '../src/fsjournal.js';
import { runRealistic, INIT } from './realistic.js';
const now = () => Number(process.hrtime.bigint()) / 1e6;
for (const fsync of [false, true]) { const dir = `/tmp/p3r/fsync-${fsync}`; fs.rmSync(dir, { recursive: true, force: true }); const st = openStore(dir, INIT, { fsync }); let n = 0; let tw = 0; const io = { get state() { return st.state; }, apply(c, x) { const t = now(); const r = st.apply(c, x); tw += now() - t; n++; return r; } };
  runRealistic({ parts: 60, rounds: 2, seed: 1 }, io); const f = st.files(); st.close(); console.log(JSON.stringify({ fsync, batches: n, msPerBatch: +(tw / n).toFixed(3), segKB: Math.round(f.seg / 1024), snapshots: Math.floor(n / 1000) })); fs.rmSync(dir, { recursive: true, force: true }); }
