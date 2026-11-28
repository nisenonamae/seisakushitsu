#!/usr/bin/env node
// 保存してあるフォルダを、新しいプロセスで開くだけ（開く時間と、開いたあとのメモリを、ほかの物が混ざらない形で測る）。
//   node --expose-gc tools/open_only.js <フォルダ> [real]
import { openStore } from '../src/fsjournal.js';
import { docHash } from '../src/index.js';
import { INIT as RINIT } from './realistic.js';
const INIT = process.argv[3] === 'real' ? RINIT : { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } };
const g = () => { global.gc(); global.gc(); const m = process.memoryUsage(); return [Math.round(m.heapUsed / 1048576), Math.round(m.arrayBuffers / 1048576), Math.round(m.rss / 1048576)]; };
const a = g(); const t = Number(process.hrtime.bigint()) / 1e6; const st = openStore(process.argv[2], INIT, { segSize: 1000, snapEvery: 1000, hot: 2000, cacheSegs: 4, fsync: false }); const ms = Number(process.hrtime.bigint()) / 1e6 - t; const b = g();
console.log(JSON.stringify({ openS: +(ms / 1000).toFixed(2), heapMB: b[0] - a[0], typedMB: b[1] - a[1], rssMB: b[2], n: st.n, used: st.info.used, tail: st.info.tail, ms: st.info.ms, docHash: docHash(st.state.doc).slice(0, 16) }));
