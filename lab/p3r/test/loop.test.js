// 取り消し・やり直しをくり返す（P3r の A-5）。あいだに、ほかの端末・AI の操作が入る場合も。
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBatch, makeUndo, makeRedo, canon, content, logLength, logItems, toJournal, readJournal, loadReplay, docHash, mulberry32, scaleV, snap, revertTuning, undoStacks } from '../src/index.js';
import { fixture, H, AI, S, path } from './helpers.js';

const LOOPS = Number(process.env.P3R_LOOPS || 20000);
test(`取り消し ⇄ やり直しを ${LOOPS} 回（250 回ごとに、ほかの端末と AI の操作が同じ値の道に入る）：毎回「その操作が無い文書」か「有る文書」とぴったり同じ`, () => {
  const b = fixture(); const w = fixture(); const wo = fixture();   // b＝本物／w＝取り消さない世界／wo＝その操作が無い世界
  for (const x of [b, w, wo]) x.do({ type: 'prop.set', node: 'A', path: 'xf.scale', value: S([123.4567, -0.0031]) });
  const X = [{ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [0.3333, 7.7] }, { type: 'pt.nudge', node: 'A', pt: 'p1', d: [0.5, -0.25] }, { type: 'node.add', node: path('N', [['a', 0, 0], ['b', 5, 0], ['c', 5, 5]]) }, { type: 'prop.set', node: 'C', path: 'fill.color', value: S({ k: 'hex', v: '#123456' }) }];
  assert.equal(b.batch(X, H('d1')).status, 'applied'); assert.equal(w.batch(X, H('d1')).status, 'applied');
  const stack0 = undoStacks(b.s.log, 'd1').undo.length; const rng = mulberry32(9); let undone = false; let n = 0; const t0 = process.hrtime.bigint(); let tFirst = 0; let tLast0 = 0n; const len0 = logLength(b.s.log);
  const others = () => { // ほかの端末（d2）と AI：同じ道への掛け算・同じ点への足し算・別の部品
    const ops = [[{ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [rng() < 0.5 ? 1.25 : 0.8] }, H('d2')], [{ type: 'pt.nudge', node: 'A', pt: 'p1', d: [snap(rng() * 4 - 2), snap(rng() * 4 - 2)] }, AI()], [{ type: 'prop.nudge', node: 'B', path: 'xf.pos', d: [1, 1] }, H('d2')], [{ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [rng() < 0.5 ? 2 : 0.5] }, AI()]];
    for (const [body, ctx] of ops) { b.do(body, ctx); w.do(body, ctx); wo.do(body, ctx); }
  };
  for (let i = 0; i < LOOPS; i++) {
    if (i === 1000) tFirst = Number(process.hrtime.bigint() - t0) / 1e6; if (i === LOOPS - 1000) tLast0 = process.hrtime.bigint();
    if (i % 250 === 125) others();
    const c = undone ? makeRedo(b.s.log, 'd1', `u${++n}`) : makeUndo(b.s.log, 'd1', `u${++n}`); assert.ok(c, `回 ${i}`);
    const r = applyBatch(b.s, [c], H('d1')); assert.equal(r.status, 'applied', `回 ${i}：${r.reason} ${r.message}`); b.s = r.state; undone = !undone;
    if (canon(content(b.doc)) !== (undone ? wo : w).snap()) assert.fail(`回 ${i}：${undone ? '無い' : '有る'}世界と違う`);
  }
  const tLast = Number(process.hrtime.bigint() - tLast0) / 1e6;
  const st = undoStacks(b.s.log, 'd1'); assert.equal(st.undo.length + st.redo.length, stack0, '取り消し・やり直しの積み重ねは太らない');
  // 記録の太り方：取り消し・やり直し1回につき、記録が1まとまり（命令1つ）。打ち消し合った組は、記録には残る（消さない）
  const j = toJournal(b.s.log); const bytes = j.lines.reduce((a, l) => a + l.length, 0); const rj = readJournal(j.lines); assert.ok(rj.clean);
  const rp = loadReplay(b.init, rj.entries); assert.deepEqual(rp.skipped, []); assert.equal(docHash(rp.state.doc), docHash(b.doc)); assert.equal(canon(logItems(rp.state.log)), canon(logItems(b.s.log)));
  const full = toJournal(b.s.log, { full: true }).lines.reduce((a, l) => a + l.length, 0);
  console.log(`  ${LOOPS} 回：記録 ${len0} → ${logLength(b.s.log)} 件（1回につき +${((logLength(b.s.log) - len0) / LOOPS).toFixed(2)} 件）／保存する量 命令だけ ${(bytes / LOOPS).toFixed(0)} バイト/回・効果つき ${(full / LOOPS).toFixed(0)} バイト/回／1回の時間 最初の 1000 回 ${(tFirst / 1000).toFixed(3)} ms → 最後の 1000 回 ${(tLast / 1000).toFixed(3)} ms`);
  if (LOOPS >= 5000) assert.ok(tLast < tFirst * 6 + 200, '回数を重ねても、1回の時間が伸びていかない');
});

test('でたらめな順に、AI の操作を取り消す・やり直すを 4000 回（3つの値の道・人の操作が交互に乗る）：毎回、生きている操作だけを記録の順に当てた値（別の計算）と同じ。途中の値の控えを使っても使わなくても同じ', () => {
  const run = (noPrefix) => {
    revertTuning.noPrefix = noPrefix;
    try {
      const b = fixture(); const rng = mulberry32(21); const paths = [['A', 'xf.scale'], ['B', 'xf.scale'], ['C', 'xf.scale']]; const ops = paths.map(() => []); const v0 = [[3.3333, -7], [0.01, 250], [1, 1]];
      paths.forEach(([node, p], k) => b.do({ type: 'prop.set', node, path: p, value: S(v0[k]) }));
      for (let i = 0; i < 40; i++) paths.forEach(([node, p], k) => { const ai = i % 2 === 0; const f = [snap(0.2 * Math.pow(25, rng())), snap(0.5 * Math.pow(4, rng())) * (rng() < 0.1 ? -1 : 1)]; const a = b.do({ type: 'prop.scale', node, path: p, f }, ai ? AI() : H('d2')); ops[k].push({ id: a.cmd.id, f, ai, alive: true, last: a.cmd.id }); });
      const sig = [];
      for (let t = 0; t < 4000; t++) {
        const k = Math.floor(rng() * 3); const cand = ops[k].filter((o) => o.ai); const o = cand[Math.floor(rng() * cand.length)];
        if (o.alive) { // 取り消す：1つだけ、またはまとめて（生きている物を 2〜3 個、1つの取り消しで）
          const group = [o]; if (rng() < 0.2) for (const x of cand) if (x !== o && x.alive && group.length < 3 && rng() < 0.5) group.push(x);
          const r = b.do({ type: 'revert', mode: 'select', targets: group.map((x) => x.id) }); assert.equal(r.tally.reverted, group.length, `回 ${t}`);
          for (const x of group) { x.alive = false; x.last = r.cmd.id; }
        } else { // やり直す：その操作を取り消した記録を戻す（まとめて取り消した記録なら、まとめて生き返る）
          const group = cand.filter((x) => !x.alive && x.last === o.last);
          const r = b.do({ type: 'revert', mode: 'select', targets: [o.last] }); assert.equal(r.tally.reverted, group.length, `回 ${t}`);
          for (const x of group) x.alive = true;
        }
        const want = ops[k].reduce((v, o) => (o.alive ? scaleV(v, o.f, false) : v), v0[k]);
        assert.deepEqual(b.doc.nodes[paths[k][0]].xf.scale.v, want, `回 ${t}（道 ${k}）`); sig.push(want.join(','));
      }
      return { sig: sig.join('|'), doc: b.snap(), log: canon(logItems(b.s.log)) };
    } finally { revertTuning.noPrefix = false; }
  };
  const a = run(false); const c = run(true); assert.equal(a.sig, c.sig); assert.equal(a.doc, c.doc); assert.equal(a.log, c.log, '記録（効果・取り消しの一覧）も1字も違わない');
});
