// 送る前の箱（追加の検証 BRIEF2 の 4）：取り消し・やり直しの連打を畳んでから送る。畳む前の並びが、ほかの端末に見えないこと・中身が同じこと。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyBatch, canon, content, logItems, logIndexOf, makeUndo, makeRedo, mulberry32, toJournal, readJournal, loadReplay, docHash } from '../src/index.js';
import { makeOutbox } from '../src/outbox.js';
import { runRealistic, INIT } from '../tools/realistic.js';

test('連打を畳んで送る：受け取る端末には、畳んだ組が1つも届かない。手元・受け取る端末・畳まずに全部送った世界で、文書の中身が毎回同じ', () => {
  const S = (v) => ({ k: 'static', v }); const H = { sender: { k: 'human', device: 'mac' } }; const A = { sender: { k: 'ai', agent: 'w1' } };
  for (const seed of [1, 2, 3]) {
    const rng = mulberry32(seed * 131); const box = makeOutbox(createState(INIT)); let recv = createState(INIT); let all = createState(INIT); let k = 0; const dropped = []; let burst = 0;
    const act = (kind, body, ctx) => {
      // 同じ「操作」を、畳む世界（box）と、畳まずに全部送る世界（all）に。取り消しの命令は、それぞれの記録から作る（相手の id が違うので）
      const mk = (state, tag) => { if (kind === 'undo' || kind === 'redo') { const u = (kind === 'undo' ? makeUndo : makeRedo)(state.log, 'mac', `${tag}${seed}-${k}`); return u; } return { id: `c${seed}-${k}`, v: body.type === 'prop.set' ? 2 : 1, actor: ctx === A ? { k: 'ai', agent: 'w1', task: 't' } : { k: 'human', device: 'mac' }, base: { ...state.doc.revs }, body }; };
      k++; const c1 = mk(box.local, 'u'); const c2 = mk(all, 'v'); assert.equal(!c1, !c2, '取り消せる物の有り無しが同じ'); if (!c1) return;
      const r1 = box.push([c1], ctx); const r2 = applyBatch(all, [c2], ctx); assert.equal(r1.status === 'rejected', r2.status === 'rejected', `${kind} ${r1.message || ''} ${r2.message || ''}`); if (r2.status === 'applied') all = r2.state;
      if (r1.status === 'collapsed') dropped.push(...r1.dropped);
      assert.equal(canon(content(box.local.doc)), canon(content(all.doc)), `中身が同じ（${kind}）`);
    };
    const flush = () => { for (const b of box.flush()) { const r = applyBatch(recv, b.cmds, { sender: b.sender }); assert.equal(r.status, 'applied'); recv = r.state; } assert.equal(canon(recv.doc), canon(box.base.doc)); assert.equal(canon(logItems(recv.log)), canon(logItems(box.base.log))); };
    for (let i = 0; i < 8; i++) act('do', { type: 'node.add', node: { id: `n${i}`, scene: 's1', kind: 'shape', name: `n${i}`, order: 'i' + i, geo: { t: 'path', closed: true, pts: [0, 1, 2, 3].map((j) => ({ id: `p${j}`, p: S([j, i]) })) }, fill: { color: S({ k: 'hex', v: '#888888' }) }, xf: { scale: S([1, 1]) } } }, i % 2 ? A : H);
    flush();
    for (let i = 0; i < 2500; i++) {
      const x = rng(); const node = `n${Math.floor(rng() * 8)}`;
      if (burst > 0 || x < 0.12) { if (burst <= 0) burst = 1 + Math.floor(rng() * 8); burst--; act(rng() < 0.55 ? 'undo' : 'redo', null, H); }
      else if (x < 0.45) act('do', { type: 'pt.nudge', node, pt: `p${Math.floor(rng() * 4)}`, d: [Math.round(rng() * 100) / 10, 1] }, H);
      else if (x < 0.65) act('do', { type: 'prop.scale', node, path: 'xf.scale', f: [[0.5, 0.8, 1.25, 2, 0.3333, 3][Math.floor(rng() * 6)]] }, rng() < 0.3 ? A : H);
      else if (x < 0.8) act('do', { type: 'prop.set', node, path: 'fill.color', value: S({ k: 'hex', v: '#' + Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0') }) }, H);
      else if (x < 0.83) act('do', { type: 'node.add', node: { id: `x${i}`, scene: 's1', kind: 'shape', name: 'x', order: 'r' + i, geo: { t: 'rect', size: S([1, 1]), round: S(0) } } }, H);
      if (rng() < 0.15 && burst <= 0) flush();
    }
    flush();
    assert.ok(box.stats.collapsedPairs > 80, JSON.stringify(box.stats));
    for (const id of dropped) assert.equal(logIndexOf(recv.log, id), -1, '畳んだ組は、受け取る端末の記録に無い');
    assert.equal(canon(content(recv.doc)), canon(content(all.doc)), '畳まずに全部送った世界と、中身が同じ');
    assert.equal(logItems(recv.log).length + 2 * box.stats.collapsedPairs, logItems(all.log).length, '減った記録は、畳んだ組の分だけ');
    // 受け取る端末の記録だけから、同じ文書を作り直せる（畳んだあとの並びだけで閉じている）
    const R = loadReplay(INIT, readJournal(toJournal(recv.log).lines).entries); assert.deepEqual(R.skipped, []); assert.equal(docHash(R.state.doc), docHash(recv.doc));
  }
});

test('実際の制作に近い記録（作り物）で：取り消しの連打の間だけ送らずに持つと、記録が何件減るか', () => {
  const H = { sender: { k: 'human', device: 'mac' } }; const run = (hold) => {
    const box = makeOutbox(createState(INIT)); let recv = createState(INIT); const flush = () => { for (const b of box.flush()) { const r = applyBatch(recv, b.cmds, { sender: b.sender }); assert.equal(r.status, 'applied'); recv = r.state; } };
    const io = { get state() { return box.local; }, apply(cmds, ctx) { const isUR = cmds[0].body.type === 'revert' && (cmds[0].body.mode === 'undo' || cmds[0].body.mode === 'redo'); if (!isUR || !hold) flush(); const r = box.push(cmds, ctx); if (!hold) flush(); return r.status === 'collapsed' ? { status: 'applied', state: r.state } : r; } };
    const stats = runRealistic({ parts: 60, seed: 5, rounds: 2 }, io); flush(); return { recv, stats, box };
  };
  const a = run(false); const b = run(true);
  assert.equal(a.box.stats.collapsedPairs, 0); assert.ok(b.box.stats.collapsedPairs > 20);
  assert.equal(canon(content(a.recv.doc)), canon(content(b.recv.doc)), '畳んでも畳まなくても、中身は同じ');
  const bytes = (s) => toJournal(s.log).lines.reduce((x, l) => x + l.length, 0);
  console.log(`# 部品 60・2 回：畳まない ${logItems(a.recv.log).length} 件（${bytes(a.recv)} バイト）／連打の間だけ持つ ${logItems(b.recv.log).length} 件（${bytes(b.recv)} バイト）・畳んだ組 ${b.box.stats.collapsedPairs}・取り消し ${a.stats.undo}＋やり直し ${a.stats.redo}`);
});

test('採らない案：打ち消し合った組を、記録から消す → あとの記録が、当て直せなくなる（版がずれる）', () => {
  const H = { sender: { k: 'human', device: 'mac' } }; const io = { state: createState(INIT), apply(cmds, ctx) { const r = applyBatch(io.state, cmds, ctx); if (r.status === 'applied') io.state = r.state; return r; } };
  runRealistic({ parts: 30, seed: 2, rounds: 1 }, io); const rj = readJournal(toJournal(io.state.log).lines);
  // 「取り消し → やり直し」が隣り合う組を、記録から抜く
  const keep = []; let removed = 0; for (let i = 0; i < rj.entries.length; i++) { const e = rj.entries[i]; const nx = rj.entries[i + 1]; const m = (x) => x && x.cmds.length === 1 && x.cmds[0].body.type === 'revert' ? x.cmds[0].body.mode : null; if (m(e) === 'undo' && m(nx) === 'redo' && nx.cmds[0].body.targets.includes(e.cmds[0].id)) { i++; removed += 2; continue; } keep.push(e); }
  assert.ok(removed >= 4); const R = loadReplay(INIT, keep);
  console.log(`# 組を ${removed / 2} 個抜いた記録を当て直す：断られたまとまり ${R.skipped.length}（理由：${[...new Set(R.skipped.map((s) => s.reason))].join('・')}）・文書の中身が同じ：${canon(content(R.state.doc)) === canon(content(io.state.doc))}`);
  assert.ok(R.skipped.length > 0 || canon(R.state.doc) !== canon(io.state.doc), '消すと、当て直しの結果が変わる');
});
