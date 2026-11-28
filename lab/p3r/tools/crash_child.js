#!/usr/bin/env node
// 保存の途中で止める試しの子：フォルダを開き、続きの操作を当てては保存する。1まとまりが残ったと確かめられるたびに「ack 番号」を出す。
//   node tools/crash_child.js <フォルダ> <種> <ここまで> [止め所の JSON]
import fs from 'node:fs';
import { openStore } from '../src/fsjournal.js';
import { genBatch, INIT, STORE_OPT } from './crash_gen.js';
const [dir, seedS, upToS, crashS] = process.argv.slice(2); const seed = Number(seedS); const upTo = Number(upToS);
const st = openStore(dir, INIT, { ...STORE_OPT, crash: crashS ? JSON.parse(crashS) : undefined });
fs.writeSync(1, `open ${st.n}\n`);
while (st.n < upTo) {
  let r = null; for (let t = 0; t < 50; t++) { const g = genBatch(st.state, seed, st.n, t); r = st.apply(g.cmds, g.ctx); if (r.status === 'applied') break; }
  if (!r || r.status !== 'applied') { fs.writeSync(1, `stuck ${st.n}\n`); process.exit(3); }
  fs.writeSync(1, `ack ${st.n}\n`);
}
st.close(); fs.writeSync(1, `end ${st.n}\n`);
