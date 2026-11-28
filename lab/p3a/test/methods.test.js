// 部品ごとの取り消しの改善案（BRIEF3 の B）：wide（同じ形への変更も残す）・split（足した点を1つずつに割る）・node.adopt（引き取り）・rebaseWithout（別の下地へ移す）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { planRevert, replay, toEntries, same, makeUndo, applyBatch, checkInvariants } from '../src/index.js';
import { fixture, H, AI, S, path } from './helpers.js';
import { compareOne, secondRevert, case7, rebaseWithout, EXTRA } from '../tools/methods.js';
import { CASES } from '../tools/scenarios2.js';

const pts = (b, id = 'A') => b.doc.nodes[id].geo.pts.map((p) => p.id);
const units = (b, targets, extra = {}) => b.do({ type: 'revert', mode: 'units', targets, ...extra });
/** AI が、今ある形 A（点 p1・p2・p3）に点を 3 つ足し、p2 の取っ手も直す。そのあと人が x1 を動かす */
function added() {
  const b = fixture(); const g = { group: 'job' };
  const r = b.batch([{ type: 'pt.add', node: 'A', pt: { id: 'x1', p: S([1, 1]) }, after: 'p1' }, { type: 'pt.add', node: 'A', pt: { id: 'x2', p: S([2, 2]) }, after: 'x1' },
    { type: 'pt.add', node: 'A', pt: { id: 'x3', p: S([9, 9]) }, after: 'p3' }, { type: 'pt.handle', node: 'A', pt: 'p3', which: 'in', value: S([3, 0]) }], AI(), g);
  assert.equal(r.status, 'applied'); const ids = r.applied.map((a) => a.cmd.id);
  b.do({ type: 'pt.nudge', node: 'A', pt: 'x1', d: [0.5, 0.5] });
  return { b, ids };
}
test('方式1（今のまま）：足した点は全部残るが、同じ作業が今ある点に付けた取っ手だけ戻る（形が割れる）', () => {
  const { b, ids } = added(); units(b, ids);
  assert.deepEqual(pts(b), ['p1', 'x1', 'x2', 'p2', 'p3', 'x3']); assert.equal(b.doc.nodes.A.geo.pts.find((p) => p.id === 'p3').in, undefined);
});
test('wide：同じ作業が同じ形に加えた変更は、足した点と一緒に全部残る（形は AI が作った形のまま＋人の直し）', () => {
  const { b, ids } = added(); const before = b.snap(); const r = units(b, ids, { wide: true });
  assert.equal(b.snap(), before); assert.equal(r.tally.reverted, 0); assert.equal(r.units.length, 1);
});
test('split：人が触った点（x1）と、その隣（x2）は残し、離れた点（x3）だけ外す。人の直しはそのまま', () => {
  const { b, ids } = added(); const r = units(b, ids, { split: true });
  assert.deepEqual(pts(b), ['p1', 'x1', 'x2', 'p2', 'p3']); assert.deepEqual(b.doc.nodes.A.geo.pts.find((p) => p.id === 'x1').p.v, [1.5, 1.5]);
  assert.equal(r.outcomes.filter((o) => o.split).length, 1); assert.deepEqual(checkInvariants(b.doc), []);
  const rp = replay(b.init, toEntries(b.s.log)); assert.deepEqual(rp.skipped, []); assert.ok(same(rp.state.doc, b.doc));
});
test('split：隣を人が触っていたら（今ある点 p3 を動かした）、離れた点も残す。人が何も触っていなければ、全部外れる', () => {
  const { b, ids } = added(); b.do({ type: 'pt.nudge', node: 'A', pt: 'p3', d: [1, 0] }); units(b, ids, { split: true });
  assert.deepEqual(pts(b), ['p1', 'x1', 'x2', 'p2', 'p3', 'x3']);
  const c = fixture(); const r = c.batch([{ type: 'pt.add', node: 'A', pt: { id: 'x1', p: S([1, 1]) }, after: 'p1' }, { type: 'pt.add', node: 'A', pt: { id: 'x2', p: S([2, 2]) }, after: 'x1' }], AI(), { group: 'j' });
  units(c, r.applied.map((a) => a.cmd.id), { split: true }); assert.deepEqual(pts(c), ['p1', 'p2', 'p3']);
});
test('split・wide は、AI が足した部品（戻す先が無い）には効かない：丸ごと残る', () => {
  for (const extra of [{}, { split: true }, { wide: true }]) { const b = fixture();
    const r = b.batch([{ type: 'node.add', node: path('N', [['a', 0, 0], ['b', 5, 0], ['c', 5, 5]]) }, { type: 'prop.set', node: 'N', path: 'fill.color', value: S({ k: 'hex', v: '#ff0000' }) }], AI(), { group: 'j' });
    b.do({ type: 'pt.nudge', node: 'N', pt: 'a', d: [1, 1] }); const before = b.snap(); const u = units(b, r.applied.map((a) => a.cmd.id), extra);
    assert.equal(b.snap(), before); assert.equal(u.units.length, 1); assert.equal(u.units[0].why, 'ai-added-part'); }
});
test('引き取り（node.adopt）：文書の中身は変わらない。AI は出せない。引き取った部品は、もう「AI の分を戻す」の相手にならない', () => {
  const b = fixture();
  const r = b.batch([{ type: 'node.add', node: path('N', [['a', 0, 0], ['b', 5, 0], ['c', 5, 5]]) }, { type: 'prop.set', node: 'N', path: 'fill.color', value: S({ k: 'hex', v: '#ff0000' }) }], AI(), { group: 'j' });
  const ids = r.applied.map((a) => a.cmd.id); b.do({ type: 'pt.nudge', node: 'N', pt: 'a', d: [1, 1] });
  assert.equal(planRevert(b.s, ids).units.length, 1);
  assert.equal(b.try({ type: 'node.adopt', node: 'N' }, AI()).reason, 'forbidden');
  const before = b.snap(); b.do({ type: 'node.adopt', node: 'N' }); assert.equal(b.snap(), before, '中身は同じ');
  assert.equal(planRevert(b.s, ids).units.length, 0);
  const u = units(b, ids); assert.equal(b.snap(), before, '引き取った部品は、色も点もそのまま'); assert.ok(u.outcomes.every((o) => o.result === 'noop' && o.why === 'adopted'));
  const rp = replay(b.init, toEntries(b.s.log)); assert.deepEqual(rp.skipped, []); assert.ok(same(rp.state.doc, b.doc));
});
test('引き取りは取り消せる：取り消すと、また「AI が足した部品」として単位に出る。引き取りのあとの AI の変更は、ふつうに戻せる', () => {
  const b = fixture(); const add = b.do({ type: 'node.add', node: path('N', [['a', 0, 0], ['b', 5, 0], ['c', 5, 5]]) }, AI()).cmd.id;
  b.do({ type: 'pt.nudge', node: 'N', pt: 'a', d: [1, 1] }); b.do({ type: 'node.adopt', node: 'N' });
  const later = b.do({ type: 'prop.set', node: 'N', path: 'fill.color', value: S({ k: 'hex', v: '#00ff00' }) }, AI()).cmd.id;
  const u = units(b, [add, later]); assert.equal(u.tally.reverted, 1); assert.equal(b.doc.nodes.N.fill.color.v.v, '#336699');
  const b2 = fixture(); const add2 = b2.do({ type: 'node.add', node: path('N', [['a', 0, 0], ['b', 5, 0], ['c', 5, 5]]) }, AI()).cmd.id; b2.do({ type: 'pt.nudge', node: 'N', pt: 'a', d: [1, 1] }); b2.do({ type: 'node.adopt', node: 'N' });
  const r = applyBatch(b2.s, [makeUndo(b2.s.log, 'd1', 'undo-adopt')], H()); assert.equal(r.status, 'applied'); b2.s = r.state;
  assert.equal(planRevert(b2.s, [add2]).units.length, 1);
});
test('別の下地へ移す（rebaseWithout）：元は変えない。AI の物は残らない。当たらなかった人の命令は一覧で返る', () => {
  const r = compareOne('2 人が一部だけ変えた（点1つ／色だけ）', 3);
  assert.equal(r.M3.pureAfter, 0); assert.equal(r.M3.humanFailed, 1); assert.equal(r.M3.invariants, 0);
  const x = compareOne('手直しだけ戻す', 3, 20); assert.equal(x.M3.humanFailed, 0); assert.ok(x.M3.sameAsM1, '人の直しが全部当たる時は、方式1 の結果と同じ文書');
});
test('比べの筋書き（種 8）：どの方式でも、人の直しが壊れない（2通りの確かめ）・全体の決まりが破れない。wide は形を割らない', () => {
  for (const name of [...Object.keys(CASES), ...Object.keys(EXTRA)]) for (let seed = 1; seed <= 8; seed++) { const r = compareOne(name, seed, 20); if (!r) continue;
    for (const m of ['M1', 'M1w', 'M2']) { assert.ok(!r[m].failed, `${name} ${m}`); assert.deepEqual(r[m].broken1, [], `${name} ${m} 種${seed}`); assert.deepEqual(r[m].broken2, [], `${name} ${m} 種${seed}`); assert.equal(r[m].invariants, 0); assert.equal(r[m].degenerate, 0); }
    assert.equal(r.M1w.splitGeo, 0); assert.ok(r.M2.pureAfter <= r.M1.pureAfter && r.M1.pureAfter <= r.M1w.pureAfter, '残る AI の値：割る ≤ 今のまま ≤ 同じ形も残す'); }
});
test('2回めの取り消し：引き取った部品は単位に出ない。場合7：どの方式でも、断られた時に文書は変わらない', () => {
  let m1 = 0; let m4 = 0; for (let seed = 1; seed <= 8; seed++) { const r = secondRevert('下組みを丸ごと戻す', seed, 5); assert.ok(r.sameDoc); assert.equal(r.m1.broken + r.m4.broken, 0); m1 += r.m1.units; m4 += r.m4.units; }
  assert.ok(m4 < m1);
  for (const m of ['M1', 'M1w', 'M2']) for (let seed = 1; seed <= 6; seed++) { const r = case7(seed, 3, m); assert.equal(r.lost, 0); if (r.status !== 'applied') assert.equal(r.unchanged, true); }
});
