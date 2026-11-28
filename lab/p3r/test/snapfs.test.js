// 写しの保存・壊れ・作り直し（追加の検証 BRIEF2 の 5）。実際のファイルを壊して、開く時にどう見つけ、どう立ち直るか。
// 記録は「実際の制作に近い記録」（tools/realistic.js。作り物）。時間は results/snapfs.txt に書く（P3R_WRITE=1 の時）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createState, applyBatch, docHash, canon, logItems, sha256, readSnapshot, makeUndo } from '../src/index.js';
import { openStore, verifySnapshots } from '../src/fsjournal.js';
import { runRealistic, INIT } from '../tools/realistic.js';

const ROOT = '/tmp/p3r/test-snap'; fs.rmSync(ROOT, { recursive: true, force: true }); const PARTS = Number(process.env.P3R_PARTS || 60); const DRAG = process.env.P3R_DRAG || 'commit';
const OPT = { segSize: Number(process.env.P3R_SEG || 200), snapEvery: Number(process.env.P3R_SNAP || 250), hot: 300, fsync: false }; const now = () => Number(process.hrtime.bigint()) / 1e6; const rows = [];
function build(name, seed) {
  const dir = path.join(ROOT, name); const st = openStore(dir, INIT, OPT); let plain = createState(INIT);
  const io = { get state() { return plain; }, apply(cmds, ctx) { const r = applyBatch(plain, cmds, ctx); if (r.status === 'applied') { plain = r.state; const r2 = st.apply(cmds, ctx); assert.equal(canon(r2.applied), canon(r.applied)); } return r; } };
  runRealistic({ parts: PARTS, seed, drag: DRAG, rounds: 2 }, io); const n = st.n; st.close(); return { dir, plain, n, want: docHash(plain.doc), wantLog: sha256(canon(logItems(plain.log))) };
}
const W = build('main', 1); const X = build('other', 2);
const snaps = (dir) => fs.readdirSync(dir).filter((f) => /^snap-\d+\.json$/.test(f)).sort();
const copy = (name) => { const d = path.join(ROOT, name); fs.rmSync(d, { recursive: true, force: true }); fs.cpSync(W.dir, d, { recursive: true }); return d; };
/** 開いて、文書・記録が正しいことと、そのあとの取り消しが同じ答えになることを確かめる。時間を返す */
function openOk(dir, label, expectWrong = false) {
  const t = now(); const st = openStore(dir, INIT, OPT); const ms = now() - t; const h = docHash(st.state.doc);
  if (expectWrong) { st.close(); return { st, ms, wrong: h !== W.want }; }
  assert.equal(h, W.want, label); assert.equal(sha256(canon(logItems(st.state.log))), W.wantLog, label);
  const u = makeUndo(W.plain.log, 'mac', 'zz'); const a = applyBatch(W.plain, [u], { sender: { k: 'human', device: 'mac' } }); const b = st.apply([u], { sender: { k: 'human', device: 'mac' } }); assert.equal(canon(b.applied), canon(a.applied), label);
  st.close(); rows.push(`${label} | ${st.info.used ? '写し ' + st.info.used.snapshot : '写しなし（束を頭から）'} | 続き ${st.info.tail} まとまり | ${ms.toFixed(0)} ms | ${JSON.stringify(st.info.notes.map((x) => x.why))}${st.info.idxRebuilt ? '・索引の控えを作り直した ' + st.info.idxRebuilt : ''}`);
  return { st, ms };
}
test('写しが2つある（ふつうの場合）：新しい方から開く', () => { assert.ok(W.n > 4 * OPT.snapEvery, `まとまり ${W.n}`); assert.equal(snaps(W.dir).length, 2); const r = openOk(copy('c0'), '写しが2つ（ふつう）'); assert.ok(r.st.info.used); });
test('写しを書く途中で切れた（新しい方の写しが、途中まで）：1つ前の写しから開く', () => {
  const full = fs.readFileSync(path.join(W.dir, snaps(W.dir)[1]), 'utf8');
  for (const cut of [0, 5, 73, 74, 200, full.length >> 1, full.length - 2])   // 終わりの改行だけが無い物（full.length - 1）は、中身が全部あるので使える写し
    { const d = copy('c1'); const f = snaps(d)[1]; fs.writeFileSync(path.join(d, f), full.slice(0, cut)); const older = Number(snaps(d)[0].slice(5, 13)); const r = openOk(d, `新しい写しが ${cut} 字で切れた`); assert.equal(r.st.info.used.snapshot, older); }
});
test('書きかけ（.tmp）が残っている：消して、今ある写しから開く', () => { const d = copy('c2'); fs.writeFileSync(path.join(d, 'snap-99999999.json.tmp'), 'P3R-SNAP 00'); const r = openOk(d, '.tmp が残っている'); assert.ok(r.st.info.notes.some((x) => x.why === 'tmp-removed')); assert.ok(!fs.existsSync(path.join(d, 'snap-99999999.json.tmp'))); });
test('古い写しだけが残った（新しい写しが無い）：古い写しから、長い続きを当てて開く', () => { const d = copy('c3'); fs.unlinkSync(path.join(d, snaps(d)[1])); const r = openOk(d, '古い写しだけ'); assert.ok(r.st.info.tail > OPT.snapEvery); });
test('写しが別の記録の物：使わない', () => { const d = copy('c4'); for (const f of snaps(d)) { const src = snaps(X.dir)[0]; fs.writeFileSync(path.join(d, f), fs.readFileSync(path.join(X.dir, src), 'utf8')); } const r = openOk(d, '写しが2つとも別の記録の物'); assert.equal(r.st.info.used, null); assert.ok(r.st.info.notes.filter((x) => x.why === 'not-on-this-journal').length === 2);
  // 番号まで同じ（中身は別の世界）：行の印が合わない
  const d2 = copy('c4b'); const f = snaps(d2)[1]; const s = readSnapshot(fs.readFileSync(path.join(X.dir, snaps(X.dir)[0]), 'utf8')); const mine = readSnapshot(fs.readFileSync(path.join(d2, f), 'utf8')); const body = JSON.stringify({ ...s, n: mine.n, seq: mine.seq }); fs.writeFileSync(path.join(d2, f), `P3R-SNAP ${sha256(body)}\n${body}\n`); const r2 = openOk(d2, '番号は同じ・別の記録の写し'); assert.ok(r2.st.info.notes.some((x) => x.why === 'not-on-this-journal')); });
test('写しの中身が1字違う・印が合わない：使わない', () => { const d = copy('c5'); const f = path.join(d, snaps(d)[1]); const t = fs.readFileSync(f, 'utf8'); const i = t.indexOf('"v":', 2000) + 4; fs.writeFileSync(f, t.slice(0, i) + (t[i] === '1' ? '2' : '1') + t.slice(i + 1)); const r = openOk(d, '中身が1字違う（印が合わない）'); assert.ok(r.st.info.notes.some((x) => x.why === 'broken')); });
test('写しの中身が1字違う・印は合う（書いた側の誤り）：開く時の印では見つからない → 突き合わせ（verify）で見つけて、使えなくする → 開き直すと正しい', () => {
  const forge = (d) => { const f = path.join(d, snaps(d)[1]); const s = readSnapshot(fs.readFileSync(f, 'utf8')); const id = Object.keys(s.doc.nodes)[3]; s.doc.nodes[id].xf.pos.v[0] += 1; s.docHash = docHash(s.doc); const body = JSON.stringify(s); fs.writeFileSync(f, `P3R-SNAP ${sha256(body)}\n${body}\n`); return Number(path.basename(f).slice(5, 13)); };
  const d = copy('c6'); const badN = forge(d); const r = openOk(d, '', true); assert.ok(r.wrong, '印は合うので、開く時には気づかない（文書が違う）');
  for (const [label, o] of [['突き合わせ：増えた分だけ（1つ前の写しから先の、保存してある効果を当てる）', { from: Number(snaps(d)[0].slice(5, 13)) }], ['突き合わせ：全部（保存してある効果を頭から当てる）', {}], ['突き合わせ：全部・厳しく（命令だけを、検査つきで頭から当て直す）', { strict: true }]]) {
    const d2 = copy('c6v'); forge(d2); const v = verifySnapshots(d2, INIT, o); assert.deepEqual(v.bad, [badN], label); rows.push(`${label} | 見つけた写し ${v.bad} | 当てたまとまり ${v.entries} | ${v.ms.toFixed(0)} ms |`);
    const r2 = openOk(d2, `印は合うが中身が違う写し → ${label.slice(0, 12)}…のあとに開く`); assert.notEqual(r2.st.info.used && r2.st.info.used.snapshot, badN);
  }
  const ok = verifySnapshots(copy('c6ok'), INIT, {}); assert.ok(ok.ok && ok.checked.length === 2);
});
test('写しが無い：束を頭から当てて開く。次に写しを書けば、元の写しと1字も違わない', () => {
  const d = copy('c7'); const orig = fs.readFileSync(path.join(d, snaps(d)[1]), 'utf8'); const name = snaps(d)[1]; for (const f of snaps(d)) fs.unlinkSync(path.join(d, f)); const r = openOk(d, '写しが無い'); assert.equal(r.st.info.used, null);
  // 記録から作り直した写し（同じ番号の所で）
  const n = Number(name.slice(5, 13)); const d2 = path.join(ROOT, 'c7b'); fs.rmSync(d2, { recursive: true, force: true }); fs.mkdirSync(d2); for (const f of fs.readdirSync(W.dir)) if (f.startsWith('seg-')) fs.copyFileSync(path.join(W.dir, f), path.join(d2, f));
  const st = openStore(d2, INIT, { ...OPT, snapEvery: 0 }); assert.equal(st.info.idxRebuilt > 0, true); st.close();
  const all = fs.readdirSync(d2).filter((f) => f.startsWith('seg-')).sort(); let lines = []; for (const f of all) lines = lines.concat(fs.readFileSync(path.join(d2, f), 'utf8').split('\n').filter(Boolean));
  const d3 = path.join(ROOT, 'c7c'); fs.rmSync(d3, { recursive: true, force: true }); fs.mkdirSync(d3); fs.writeFileSync(path.join(d3, 'seg-00000001.jl'), lines.slice(0, n).join('\n') + '\n'); const st3 = openStore(d3, INIT, { ...OPT, segSize: 1e9, snapEvery: 0 }); assert.equal(st3.n, n); st3.snapshot(); st3.close();
  assert.equal(fs.readFileSync(path.join(d3, name), 'utf8'), orig, '記録から作り直した写しは、元の写しと同じ');
});
test('索引の控えが無い・短い・別の物：束から作り直して開く', () => {
  let d = copy('c8'); for (const f of fs.readdirSync(d)) if (f.startsWith('idx-')) fs.unlinkSync(path.join(d, f)); let r = openOk(d, '索引の控えが全部無い'); assert.ok(r.st.info.idxRebuilt >= 2);
  d = copy('c8b'); const idx = fs.readdirSync(d).filter((f) => f.startsWith('idx-')).sort(); const t = fs.readFileSync(path.join(d, idx[1]), 'utf8'); fs.writeFileSync(path.join(d, idx[1]), t.slice(0, t.length >> 1)); fs.copyFileSync(path.join(X.dir, idx[0]), path.join(d, idx[0])); r = openOk(d, '索引の控えが、1つは途中まで・1つは別の記録の物'); assert.ok(r.st.info.idxRebuilt >= 2);
});
test('古い束の中身が1字化けた：開く時には気づかない（本体を読まない）。その記録を読む時に見つけて止まる／厳しい突き合わせなら、開く前に見つかる', () => {
  const d = copy('c9'); const seg = fs.readdirSync(d).filter((f) => f.startsWith('seg-')).sort()[0]; const f = path.join(d, seg); const t = fs.readFileSync(f, 'utf8'); const lines = t.split('\n'); const i = lines[3].indexOf('"c":[') + 9; lines[3] = lines[3].slice(0, i) + 'X' + lines[3].slice(i + 1); fs.writeFileSync(f, lines.join('\n'));
  const st = openStore(d, INIT, OPT); assert.equal(docHash(st.state.doc), W.want); assert.throws(() => logItems(st.state.log), /壊れている/); st.close();
  rows.push('古い束が1字化けた | 開く時は気づかない・読む時に止まる（台帳から受け取り直す） | | |');
});
test('時間を書き出す', () => { if (process.env.P3R_WRITE) fs.writeFileSync(new URL('../results/snapfs.txt', import.meta.url), [`写しの壊れと立ち直り：実際の制作に近い記録（作り物）・部品 ${PARTS}・${DRAG}・まとまり ${W.n}・束 ${OPT.segSize}・写し ${OPT.snapEvery} まとまりごと`, '', '場合 | 何から開いたか | 続き | 時間 | 気づいたこと', '---|---|---|---|---', ...rows].join('\n') + '\n'); });
