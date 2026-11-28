#!/usr/bin/env node
// 保存の途中でプロセスを止める試し（追加の検証 BRIEF2 の 7）。子プロセス（tools/crash_child.js）に、実際にファイルへ書かせ、
// 決まった所（行を書く途中・書いたあと fsync の前・写しを書く途中・名前の付けかえの前後・束の切りかえの途中…）か、でたらめな時刻で SIGKILL で止める。
// 止めるたびに、同じフォルダを開き直して確かめる：
//   ①文書が「どれかのまとまりの後」の文書と同じ（別に、メモリの上だけで作った文書の印と比べる）②残ったと知らせた（ack）まとまりは、全部ある ③ack より多く残っていても、多くて 1 まとまり
//   ④時々、束のファイルだけを頭から読み、命令だけを検査つきで当て直して、同じ文書になること（索引の控え・写しを使わない別の道）
// そのまま続きを書かせる（＝止まった跡の上に、何度も書き足す）。
//   node tools/crash.js [回数=400] [種=1] → results/crash.jsonl（1回ごとに1行。止まっても残る）・results/crash.txt（まとめ）
// **SIGKILL は、OS が受け取った書きこみを失わせない。**電源が落ちた時（fsync していない分が消える・順が入れかわる）は、ここでは試せていない。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createState, applyBatch, docHash, mulberry32, parseLine, loadReplay, GENESIS } from '../src/index.js';
import { openStore } from '../src/fsjournal.js';
import { genBatch, INIT, STORE_OPT } from './crash_gen.js';

const here = path.dirname(fileURLToPath(import.meta.url)); const CYCLES = Number(process.argv[2] || 400); const SEED0 = Number(process.argv[3] || 1); const TOTAL = Number(process.env.P3R_TOTAL || 1500);
const ROOT = '/tmp/p3r/crash'; const OUT = path.join(here, '../results/crash.jsonl'); fs.rmSync(ROOT, { recursive: true, force: true }); fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(OUT, '');
const POINTS = ['seg-mid', 'seg-written', 'seg-synced', 'idx-written', 'seg-closed', 'seg-created', 'seg-linked', 'snap-mid', 'snap-written', 'snap-synced', 'snap-renamed', 'snap-pruned'];
const now = () => Number(process.hrtime.bigint()) / 1e6;

/** 別の道の正解：メモリの上だけで、同じ操作を当てた時の、まとまりごとの文書の印 */
function expected(seed) { let s = createState(INIT); const hs = [docHash(s.doc)]; for (let n = 0; n < TOTAL; n++) { let r = null; for (let t = 0; t < 50; t++) { const g = genBatch(s, seed, n, t); r = applyBatch(s, g.cmds, g.ctx); if (r.status === 'applied') break; } if (r.status !== 'applied') throw new Error('stuck'); s = r.state; hs.push(docHash(s.doc)); } return hs; }
function runChild(dir, seed, crash, killAfterMs) {
  return new Promise((resolve) => {
    const ch = spawn(process.execPath, [path.join(here, 'crash_child.js'), dir, String(seed), String(TOTAL), ...(crash ? [JSON.stringify(crash)] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = ''; let timer = null; let killed = false;
    ch.stdout.on('data', (d) => { out += d; if (killAfterMs !== null && !timer && out.includes('open ')) timer = setTimeout(() => { killed = true; ch.kill('SIGKILL'); }, killAfterMs); });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('close', (code, sig) => { if (timer) clearTimeout(timer); const acks = out.split('\n').filter((l) => l.startsWith('ack ')); resolve({ code, sig, killed, opened: /open (\d+)/.exec(out) ? Number(/open (\d+)/.exec(out)[1]) : null, ack: acks.length ? Number(acks[acks.length - 1].slice(4)) : null, ended: out.includes('end '), err: err.slice(0, 500) }); });
  });
}
/** 束のファイルだけを頭から読み、命令だけを検査つきで当て直す（索引の控え・写しを使わない）*/
function replayFromSegs(dir) {
  const segs = fs.readdirSync(dir).filter((f) => f.startsWith('seg-') && f.endsWith('.jl')).sort(); const entries = []; let prev = GENESIS; let n = 1;
  for (const f of segs) for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) { if (!l) continue; const o = parseLine(l); if (!o || o.n !== n || o.p !== prev) throw new Error(`開き直したあとの束が、きれいでない：${f}`); entries.push({ n: o.n, sender: o.s, cmds: o.c }); prev = o.h; n++; }
  const R = loadReplay(INIT, entries); if (R.skipped.length) throw new Error('当て直しで断られた'); return { n: entries.length, hash: docHash(R.state.doc) };
}

const rng = mulberry32(SEED0 * 7 + 1); let seed = SEED0; let dir = path.join(ROOT, `w${seed}`); let want = expected(seed); let lastN = 0;
const sum = {}; const bad = []; let worlds = 1; const t00 = now();
for (let c = 1; c <= CYCLES; c++) {
  const random = rng() < 0.3; let crash = null; let killMs = null;
  if (random) killMs = Math.floor(rng() * 120); else { const point = POINTS[Math.floor(rng() * POINTS.length)]; const rare = !point.startsWith('seg-mid') && !point.startsWith('seg-w') && !point.startsWith('seg-s') && point !== 'idx-written'; crash = { point, at: rare ? 1 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 45), cut: rng() }; }
  const r = await runChild(dir, seed, crash, killMs);
  const key = random ? 'でたらめな時刻' : crash.point; const s = sum[key] || (sum[key] = { runs: 0, killed: 0, lostAfterAck: 0, extra1: 0, extraMore: 0, wrongDoc: 0, truncated: 0, rewrote: 0, idxRebuilt: 0, tmpRemoved: 0, snapNotes: 0, noSnap: 0, openMs: 0, openMaxMs: 0 });
  const stopped = r.sig === 'SIGKILL'; const acked = r.ack === null ? r.opened ?? lastN : r.ack;
  // 開き直して確かめる
  const t0 = now(); let st; let row = { c, key, crash, killMs, stopped, opened: r.opened, ack: r.ack };
  try {
    st = openStore(dir, INIT, STORE_OPT); const ms = now() - t0; const n = st.n; const h = docHash(st.state.doc);
    Object.assign(row, { n, ok: h === want[n], lost: Math.max(0, acked - n), extra: Math.max(0, n - acked), info: { truncated: st.info.truncated, rewrote: st.info.rewrote, idxRebuilt: st.info.idxRebuilt, used: st.info.used, notes: st.info.notes, tail: st.info.tail }, openMs: +ms.toFixed(1) });
    s.runs++; if (stopped) s.killed++; if (row.lost) s.lostAfterAck++; if (row.extra === 1) s.extra1++; if (row.extra > 1) s.extraMore++; if (!row.ok) s.wrongDoc++;
    s.truncated += st.info.truncated; s.rewrote += st.info.rewrote; s.idxRebuilt += st.info.idxRebuilt; s.tmpRemoved += st.info.notes.filter((x) => x.why === 'tmp-removed').length; s.snapNotes += st.info.notes.filter((x) => x.snapshot !== undefined).length; if (!st.info.used && n >= STORE_OPT.snapEvery) s.noSnap++;
    s.openMs += ms; s.openMaxMs = Math.max(s.openMaxMs, ms); st.close(); lastN = n;
    if (c % 10 === 0) { const R = replayFromSegs(dir); row.replay = R.n === n && R.hash === h; if (!row.replay) bad.push({ c, why: 'replay-differs' }); }
    if (!row.ok || row.lost || row.extra > 1 || (r.code && r.code !== 0 && !stopped)) bad.push({ c, key, row, err: r.err });
  } catch (e) { row.error = String(e && e.stack || e).slice(0, 600); bad.push({ c, key, error: row.error }); }
  fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
  if (lastN >= TOTAL || row.error) { seed++; worlds++; dir = path.join(ROOT, `w${seed}`); want = expected(seed); lastN = 0; }
}
const lines = [`保存の途中で止める試し：${CYCLES} 回（うち止まった回 ${Object.values(sum).reduce((a, s) => a + s.killed, 0)}）・世界 ${worlds} 個（1つ ${TOTAL} まとまり）・${((now() - t00) / 1000).toFixed(0)} 秒`,
  `束 ${STORE_OPT.segSize} まとまりごと・写し ${STORE_OPT.snapEvery} まとまりごと・メモリに持つ本体 ${STORE_OPT.hot} 件`, '',
  '止め所 | 回 | 止まった | 文書が合わない | ack のあとに失った | ack より 1 多く残った | 2 以上多い | 終わりを切りつめた | 束を書き直した | 索引の控えを作り直した | 残っていた .tmp を消した | 使わなかった写し | 写しなしで開いた | 開く時間 平均／最大 ms', '---|---|---|---|---|---|---|---|---|---|---|---|---|---'];
for (const k of [...POINTS, 'でたらめな時刻']) { const s = sum[k]; if (!s) continue; lines.push(`${k} | ${s.runs} | ${s.killed} | ${s.wrongDoc} | ${s.lostAfterAck} | ${s.extra1} | ${s.extraMore} | ${s.truncated} | ${s.rewrote} | ${s.idxRebuilt} | ${s.tmpRemoved} | ${s.snapNotes} | ${s.noSnap} | ${(s.openMs / s.runs).toFixed(1)}／${s.openMaxMs.toFixed(1)}`); }
lines.push('', `合わなかった回：${bad.length}`, ...bad.slice(0, 20).map((b) => JSON.stringify(b)));
fs.writeFileSync(path.join(here, '../results/crash.txt'), lines.join('\n') + '\n'); console.log(lines.join('\n'));
