// ファイルへの保存（追加の検証 BRIEF2 の 2・3・5）：束・索引の控え・写し。開き直しても、メモリに全部持つ場合と、1字も違わないこと。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createState, applyBatch, canon, logItems, logLength, makeUndo, makeRedo, aiRecordIds, mulberry32, docHash, toJournal, readJournal, loadReplay, loadLazy, memArchive, makeSnapshot, readSnapshot, indexStats } from '../src/index.js';
import { openStore } from '../src/fsjournal.js';
import { runFuzz, INIT } from '../tools/fuzz.js';

const ROOT = '/tmp/p3r/test-fs'; fs.rmSync(ROOT, { recursive: true, force: true });
const H = { sender: { k: 'human', device: 'd1' } };
const dirOf = (name) => { const d = path.join(ROOT, name); fs.rmSync(d, { recursive: true, force: true }); return d; };
const W = runFuzz(31, 2600);
/** 同じ取り消しを当てた結果 */
function after(apply, state0) {
  const out = []; const ai = aiRecordIds(W.state.log);
  for (const [k, targets] of [ai.slice(-40), ai.slice(0, 40), ai.filter((_, i) => i % 9 === 0)].entries()) { const r = apply([{ id: `after-${k}`, v: 1, actor: { k: 'human', device: 'd1' }, body: { type: 'revert', mode: 'units', targets } }], H); out.push(r.status, canon(r.applied), canon(r.outcomes)); }
  return out;
}

test('束・写し・索引の控え：途中で何度閉じて開き直しても、メモリに全部持つ場合と、まとまりごとの結果・文書・記録が同じ。古い記録の本体はメモリに無い', () => {
  const dir = dirOf('twin'); const rng = mulberry32(3); let st = openStore(dir, INIT, { segSize: 64, snapEvery: 150, hot: 20, fsync: false }); let plain = createState(INIT); let reopen = 0; let usedSnap = 0;
  for (let i = 0; i < W.batches.length; i++) {
    const b = W.batches[i]; const ctx = { sender: b.sender };
    const r1 = applyBatch(plain, b.cmds, ctx); plain = r1.state; const r2 = st.apply(b.cmds, ctx);
    assert.equal(r2.status, r1.status); assert.equal(canon(r2.applied), canon(r1.applied), `まとまり ${i + 1}`);
    if (rng() < 0.02) { st.close(); st = openStore(dir, INIT, { segSize: 64, snapEvery: 150, hot: 20, fsync: false }); reopen++; if (st.info.used) usedSnap++; assert.equal(docHash(st.state.doc), docHash(plain.doc)); assert.equal(st.n, i + 1); }
  }
  assert.ok(reopen > 20 && usedSnap > 15, `開き直し ${reopen}・写しを使った ${usedSnap}`);
  assert.equal(canon(st.state.doc), canon(plain.doc)); assert.equal(canon(logItems(st.state.log)), canon(logItems(plain.log)));
  const stats = indexStats(st.state.log); assert.ok(stats.inMemory <= 100 && stats.records === logLength(plain.log), JSON.stringify(stats));
  let p2 = plain; const a1 = after((c, x) => { const r = applyBatch(p2, c, x); p2 = r.state; return r; }); const a2 = after((c, x) => st.apply(c, x));
  assert.deepEqual(a2, a1); assert.equal(docHash(st.state.doc), docHash(p2.doc));
  st.close();
  // 写しを使わずに開いても同じ
  const st2 = openStore(dir, INIT, { segSize: 64, noSnapshot: true, fsync: false }); assert.equal(st2.info.used, null); assert.equal(docHash(st2.state.doc), docHash(p2.doc)); assert.equal(canon(logItems(st2.state.log)), canon(logItems(p2.log))); st2.close();
});

test('写し＋索引（細い記録）＋命令だけの続き：写しをどこに置いても開ける（続きに、古い記録を相手にする取り消しがあっても）。前のやり方（写し＋続きだけ）で開けなかった所を数える', async () => {
  const { open } = await import('../src/index.js');
  const j = toJournal(W.state.log); const jf = toJournal(W.state.log, { full: true }); const rj = readJournal(j.lines); const rf = readJournal(jf.lines); const arch = memArchive(rf.entries);
  const want = docHash(W.state.doc); const wantLog = canon(logItems(W.state.log)); let s = createState(INIT); let oldFail = 0; let tried = 0; let reads = 0;
  for (let n = 0; n < rj.entries.length; n++) {
    const e = rj.entries[n]; s = applyBatch(s, e.cmds, { sender: e.sender }).state;
    if ((n + 1) % 97 !== 0) continue; tried++;
    const snap = readSnapshot(makeSnapshot(s, n + 1, e.h)); const before = arch.reads;
    const L = loadLazy(snap, arch.slims(snap.seq), rj.entries.slice(n + 1), arch); reads += arch.reads - before;
    assert.deepEqual(L.skipped, []); assert.equal(docHash(L.state.doc), want); assert.equal(canon(logItems(L.state.log)), wantLog);
    const o = open(INIT, j.lines, [makeSnapshot(s, n + 1, e.h)]); if (!o.used) oldFail++; assert.equal(docHash(o.state.doc), want);
  }
  assert.ok(tried >= 10 && oldFail > 0, `写し ${tried} か所・前のやり方で使えなかった ${oldFail} か所`);
  console.log(`# 写し ${tried} か所：前のやり方（写し＋続きだけ）で使えなかった ${oldFail} か所／新しいやり方は全部開けた（古い記録の本体を読んだ回数 合計 ${reads}）`);
});

test('写しより前・後・またがる取り消しとやり直しを混ぜた並び：写しから開き直した端末と、開き直さない端末で、毎回の結果・文書・記録が同じ', () => {
  const S = (v) => ({ k: 'static', v }); const A = { sender: { k: 'ai', agent: 'w1' } }; const H2 = { sender: { k: 'human', device: 'd2' } };
  for (const seed of [1, 2, 3]) {
    const dir = dirOf(`mix${seed}`); const o = { segSize: 50, snapEvery: 120, hot: 60, fsync: false }; let st = openStore(dir, INIT, o); let plain = createState(INIT); const rng = mulberry32(seed * 31); let k = 0; const ids = []; const cnt = { old: 0, recent: 0, reopen: 0, undo: 0, redo: 0, applied: 0 };
    const both = (body, ctx) => {
      const actor = ctx.sender.k === 'human' ? { k: 'human', device: ctx.sender.device } : { k: 'ai', agent: 'w1', task: 't' + (k >> 4) };
      const cmd = { id: `m${seed}-${++k}`, v: body.type === 'prop.set' ? 2 : 1, actor, base: { ...plain.doc.revs }, body };
      const r1 = applyBatch(plain, [cmd], ctx); plain = r1.state; const r2 = st.apply([cmd], ctx);
      assert.equal(r2.status, r1.status); assert.equal(r2.reason, r1.reason); assert.equal(canon(r2.applied), canon(r1.applied)); assert.equal(canon(r2.outcomes), canon(r1.outcomes));
      if (r1.status === 'applied') { cnt.applied++; if (body.type !== 'revert') ids.push(cmd.id); } return r1;
    };
    for (let i = 0; i < 6; i++) both({ type: 'node.add', node: { id: `n${i}`, scene: 's1', kind: 'shape', name: `n${i}`, order: 'i' + i, geo: { t: 'path', closed: true, pts: [0, 1, 2, 3].map((j) => ({ id: `p${j}`, p: S([j, i]) })) }, fill: { color: S({ k: 'hex', v: '#888888' }) }, xf: { scale: S([1, 1]) } } }, i % 2 ? A : H2);
    ids.length = 0;
    for (let i = 0; i < 3000; i++) {
      const x = rng(); const node = `n${Math.floor(rng() * rng() * 6)}`; const ctx = rng() < 0.3 ? A : rng() < 0.6 ? H : H2;
      if (x < 0.25) both({ type: 'prop.scale', node, path: 'xf.scale', f: [[0.5, 0.8, 1.25, 2, -1, 0.3333, 3][Math.floor(rng() * 7)]] }, ctx);
      else if (x < 0.45) both({ type: 'pt.nudge', node, pt: `p${Math.floor(rng() * 4)}`, d: [Math.round(rng() * 100) / 10, Math.round(rng() * 100) / 10] }, ctx);
      else if (x < 0.55) both({ type: 'prop.set', node, path: 'fill.color', value: S({ k: 'hex', v: '#' + Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0') }) }, ctx);
      else if (x < 0.7) { const u = makeUndo(plain.log, 'd1', 'x'); if (u) { both(u.body, H); cnt.undo++; } }
      else if (x < 0.8) { const u = makeRedo(plain.log, 'd1', 'x'); if (u) { both(u.body, H); cnt.redo++; } }
      else if (x < 0.88 && ids.length) { const t = []; const m = 1 + Math.floor(rng() * 4); for (let q = 0; q < m; q++) t.push(ids[Math.floor(rng() * ids.length)]); both({ type: 'revert', mode: 'units', targets: [...new Set(t)] }, H); cnt.old++; }   // 古い物・新しい物・またがる物が混ざる
      else if (x < 0.95 && ids.length) { both({ type: 'revert', mode: 'units', targets: [ids[ids.length - 1 - Math.floor(rng() * Math.min(30, ids.length))]] }, H); cnt.recent++; }
      else { st.close(); st = openStore(dir, INIT, o); cnt.reopen++; assert.equal(docHash(st.state.doc), docHash(plain.doc)); }
    }
    assert.equal(canon(st.state.doc), canon(plain.doc)); assert.equal(canon(logItems(st.state.log)), canon(logItems(plain.log)));
    assert.ok(cnt.reopen > 80 && cnt.old > 150 && cnt.undo > 200, JSON.stringify(cnt)); st.close();
    // 記録だけ（命令だけ）から作り直しても同じ
    const rj = readJournal(toJournal(plain.log).lines); const R = loadReplay(INIT, rj.entries); assert.deepEqual(R.skipped, []); assert.equal(docHash(R.state.doc), docHash(plain.doc));
  }
});
