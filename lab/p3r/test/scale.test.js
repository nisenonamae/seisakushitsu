// 掛ける量の戻し方（BRIEF3 の A）：revert の scale＝'divide'（前のまま：割る）・'keep'（上に掛け算があれば残す）・'rebuild'（記録から組み立て直す）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { replay, toEntries, same, mulberry32, snap, checkInvariants } from '../src/index.js';
import { fixture, H, AI, S } from './helpers.js';
import { Slot, replayOps } from '../tools/numcheck3.js';

const sc = (b, id = 'A') => b.doc.nodes[id].xf.scale.v;
const mul = (b, f, ctx) => b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f }, ctx).cmd.id;
const rev = (b, targets, scale, mode = 'select') => b.do({ type: 'revert', mode, targets, ...(scale ? { scale } : {}) });
const rf = (rng, lo, hi) => snap(lo * Math.pow(hi / lo, rng()));
const start = (v) => { const b = fixture(); b.do({ type: 'prop.set', node: 'A', path: 'xf.scale', value: S(v) }); return b; };

test('rebuild：AI ×f → 人 ×g → AI の分だけ戻す ＝ AI の操作が無かった時の値と、ぴったり同じ（小さい比でも）', () => {
  const rng = mulberry32(11); let n = 0;
  for (const [lo, hi] of [[0.5, 2], [0.01, 100], [0.0001, 0.01]]) for (let i = 0; i < 60; i++) {
    const v0 = [snap(rng() * 200 - 100), snap(rng() * 20 - 10)]; const f = [rf(rng, lo, hi), -rf(rng, lo, hi)]; const g = [rf(rng, 0.5, 2)];
    const b = start(v0); const a = mul(b, f, AI()); mul(b, g);
    const r = rev(b, [a], 'rebuild'); assert.equal(r.tally.reverted, 1);
    const c = start(v0); mul(c, g);                      // AI の操作が無かった世界
    assert.deepEqual(sc(b), sc(c), `f=${f} g=${g} v0=${v0}`); n++;
  }
  assert.equal(n, 180);
});
test('上に何も無ければ、before にぴったり戻る。何も書かなくても「組み立て直す」。割る・残すの切り替えは無い', () => {
  { const b = start([1, 1]); const a = mul(b, [2], AI()); for (const sc2 of ['divide', 'keep', 'guess']) assert.equal(b.try({ type: 'revert', targets: [a], scale: sc2 }).reason, 'invalid'); }
  for (const mode of [undefined, 'rebuild']) { const b = start([123.4567, 0.0003]); const before = b.snap(); const a = mul(b, [0.3333, 7], AI()); rev(b, [a], mode); assert.equal(b.snap(), before, mode); }
});
test('rebuild：AI と人が交互に 8 組 → AI の分を、まとめて／1つずつ でたらめな順で戻す → 人の操作だけの値と同じ。数だけの模型（3a）とも同じ', () => {
  const rng = mulberry32(5);
  for (let t = 0; t < 40; t++) { const v0 = snap(rng() * 100 + 1); const b = start([v0, v0]); const c = start([v0, v0]); const m = new Slot(v0, '3a'); const ai = []; const ops = []; const hu = [];
    for (let i = 0; i < 8; i++) { const f = rf(rng, 0.05, 20); const g = rf(rng, 0.5, 2); ai.push(mul(b, [f], AI())); ops.push(m.do({ k: 'mul', a: f })); mul(b, [g]); mul(c, [g]); hu.push(m.do({ k: 'mul', a: g })); }
    if (t % 2) rev(b, ai, 'rebuild');
    else { const order = ai.map((id, i) => i).sort(() => rng() - 0.5); for (const i of order) { rev(b, [ai[i]], 'rebuild'); m.undo(ops[i]); assert.equal(sc(b)[0], m.v, '模型と同じ'); } }
    assert.deepEqual(sc(b), sc(c)); assert.equal(sc(b)[0], replayOps(v0, hu));
    const rp = replay(b.init, toEntries(b.s.log)); assert.deepEqual(rp.skipped, []); assert.ok(same(rp.state.doc, b.doc), '記録から同じ文書'); }
});
test('rebuild：取り消し → やり直し → 取り消し を 1500 回。値は2つの間を行き来するだけで、ずれない', () => {
  const b = start([123.4567, -0.0031]); const a = mul(b, [0.0007, 3.3333], AI()); mul(b, [1.7, 0.6]); const full = sc(b).slice();
  const c = start([123.4567, -0.0031]); mul(c, [1.7, 0.6]); const without = sc(c).slice();
  let last = a;
  for (let i = 0; i < 1500; i++) {
    const r = rev(b, [last], 'rebuild'); assert.equal(r.tally.reverted, 1); assert.deepEqual(sc(b), i % 2 ? full : without, `回 ${i}`); last = r.cmd.id;
  }
  assert.deepEqual(checkInvariants(b.doc), []);
  const rp = replay(b.init, toEntries(b.s.log)); assert.ok(same(rp.state.doc, b.doc), '記録から同じ文書');
});
test('rebuild：元の記録を何度も相手にしても（戻す → やり直す → また元の記録を戻す）同じ', () => {
  const b = start([10, 10]); const a = mul(b, [0.3333], AI()); mul(b, [3]);
  const r1 = rev(b, [a], 'rebuild'); assert.deepEqual(sc(b), [30, 30]);
  rev(b, [r1.cmd.id], 'rebuild'); assert.deepEqual(sc(b), [9.999, 9.999]);
  rev(b, [a], 'rebuild'); assert.deepEqual(sc(b), [30, 30]);
  const again = rev(b, [a], 'rebuild'); assert.equal(again.tally.reverted, 0); assert.deepEqual(sc(b), [30, 30]);
});
test('rebuild：反転（−1）を奇数回・偶数回。0 の符号が出ない', () => {
  for (const n of [1, 2, 7, 8]) { const b = start([0, 2.5]); const ai = []; for (let i = 0; i < n; i++) ai.push(mul(b, [-1], AI())); mul(b, [0.5]);
    rev(b, ai, 'rebuild'); assert.deepEqual(sc(b), [0, 1.25]); assert.ok(!Object.is(sc(b)[0], -0)); }
});
test('rebuild でも、足す量と掛ける量が混ざる所は残す（答えが意味で分かれる）。置きかえが乗れば「上書き済み」', () => {
  const b = start([2, 2]); const a = mul(b, [3], AI()); b.do({ type: 'prop.nudge', node: 'A', path: 'xf.scale', d: [1, 1] });
  let r = rev(b, [a], 'rebuild'); assert.equal(r.outcomes[0].result, 'ask'); assert.equal(r.outcomes[0].why, 'added-on-top'); assert.deepEqual(sc(b), [7, 7]);
  b.do({ type: 'prop.set', node: 'A', path: 'xf.scale', value: S([5, 5]) });
  r = rev(b, [a], 'rebuild'); assert.equal(r.outcomes[0].why, 'overwritten'); assert.deepEqual(sc(b), [5, 5]);
  // 置きかえのあとの掛け算は、置きかえの値から組み立てる
  const a2 = mul(b, [0.0001], AI()); mul(b, [4]); rev(b, [a2], 'rebuild'); assert.deepEqual(sc(b), [20, 20]);
});
test('rebuild：部品ごとの取り消し（mode:units）でも同じ値。ふつうの取り消し（あいだに別の端末の掛け算）でも同じ', () => {
  const b = start([7, 7]); const a = mul(b, [0.0009], AI()); mul(b, [2]);
  const r = rev(b, [a], 'rebuild', 'units'); assert.equal(r.tally.reverted, 1); assert.deepEqual(sc(b), [14, 14]);
  const c = start([7, 7]); const mine = mul(c, [0.0009], H('d1')); mul(c, [2], H('d2'));
  c.do({ type: 'revert', mode: 'undo', targets: [mine], scale: 'rebuild' }); assert.deepEqual(sc(c), [14, 14]);
});
