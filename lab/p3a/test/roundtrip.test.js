// 全部の種類の命令で「当てる → 取り消す → 元と同じ」「→ やり直す → 当てた後と同じ」
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeUndo, makeRedo, applyBatch, checkInvariants, SPECS, replay, toEntries, same } from '../src/index.js';
import { fixture, H, S, hex, path } from './helpers.js';

const K = (id, s, v) => ({ id, t: { k: 'sec', s }, v });
/** [名前, 命令の中身, 先にやっておく事] */
const CASES = [
  ['node.add（形）', { type: 'node.add', node: path('N1', [['a', 1, 1], ['b', 2, 2]], { parent: 'G', order: 'x' }) }],
  ['node.add（まとまり）', { type: 'node.add', node: { id: 'N2', scene: 's1', kind: 'group', name: 'g', order: 'z' } }],
  ['node.remove（葉）', { type: 'node.remove', node: 'C' }],
  ['node.remove（子ごと）', { type: 'node.remove', node: 'G' }],
  ['node.move（親と順番）', { type: 'node.move', node: 'A', parent: null, order: 'a' }],
  ['node.move（順番だけ）', { type: 'node.move', node: 'A', parent: 'G', order: 'z' }],
  ['node.rename', { type: 'node.rename', node: 'A', name: '母カバの頭' }],
  ['prop.set（位置）', { type: 'prop.set', node: 'A', path: 'xf.pos', value: S([3.5, -2]) }],
  ['prop.set（色）', { type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#ffffff') }],
  ['prop.set（鍵の並びごと）', { type: 'prop.set', node: 'B', path: 'xf.rot', value: { k: 'keys', keys: [K('z1', 0, 5)] } }],
  ['prop.set（点の位置）', { type: 'prop.set', node: 'A', path: 'geo.pts.p2.p', value: S([11, 1]) }],
  ['prop.nudge（位置）', { type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [0.1, 0.7] }],
  ['prop.nudge（回転）', { type: 'prop.nudge', node: 'A', path: 'xf.rot', d: [33.3333] }],
  ['prop.scale（伸ばす）', { type: 'prop.scale', node: 'A', path: 'xf.scale', f: [1.5, 0.3333] }],
  ['prop.scale（反転）', { type: 'prop.scale', node: 'A', path: 'xf.scale', f: [-1, 1] }],
  ['prop.scale（1つの数で両方・丸めが入る）', { type: 'prop.scale', node: 'C', path: 'geo.size', f: [0.3333] }],
  ['prop.kind（固定→鍵）', { type: 'prop.kind', node: 'A', path: 'xf.pos', value: { k: 'keys', keys: [K('m1', 0, [0, 0]), K('m2', 1, [5, 5])] } }],
  ['prop.kind（固定→式）', { type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'expr', src: 'wiggle(3, 2, 5) + ref("B.xf.rot") * 0.5', base: S(10) } }],
  ['prop.kind（固定→参照）', { type: 'prop.kind', node: 'A', path: 'fill.color', value: { k: 'ref', to: { k: 'prop', node: 'B', path: 'fill.color' } } }],
  ['prop.kind（鍵→固定）', { type: 'prop.kind', node: 'B', path: 'xf.rot', value: S(45) }],
  ['geo.set（図形 → 自由な形）', { type: 'geo.set', node: 'C', geo: { t: 'path', closed: true, pts: [{ id: 'c1', p: S([-4, 0]) }, { id: 'c2', p: S([0, -4]) }, { id: 'c3', p: S([4, 0]) }, { id: 'c4', p: S([0, 4]) }] } }],
  ['geo.set（清書：点の並びごと）', { type: 'geo.set', node: 'A', geo: { t: 'path', closed: true, pts: [{ id: 'p1', p: S([0, 0]) }, { id: 'p3', p: S([10, 10]) }] } }],
  ['pt.add（頭に）', { type: 'pt.add', node: 'A', pt: { id: 'n1', p: S([-1, -1]) }, after: null }],
  ['pt.add（途中に・取っ手つき）', { type: 'pt.add', node: 'A', pt: { id: 'n2', p: S([5, 0]), in: S([-1, 0]), out: S([1, 0]), corner: false }, after: 'p1' }],
  ['pt.add（末尾に）', { type: 'pt.add', node: 'A', pt: { id: 'n3', p: S([0, 10]) }, after: 'p3' }],
  ['pt.remove（途中）', { type: 'pt.remove', node: 'A', pt: 'p2' }],
  ['pt.remove（頭）', { type: 'pt.remove', node: 'A', pt: 'p1' }],
  ['pt.nudge', { type: 'pt.nudge', node: 'A', pt: 'p3', d: [0.3, -0.1] }],
  ['pt.handle（付ける）', { type: 'pt.handle', node: 'A', pt: 'p1', which: 'out', value: S([2, 0]) }],
  ['pt.handle（自動に戻す）', { type: 'pt.handle', node: 'L', pt: 'q2', which: 'in', value: null }],
  ['pt.corner', { type: 'pt.corner', node: 'A', pt: 'p2', corner: true }],
  ['key.add（途中）', { type: 'key.add', node: 'B', path: 'xf.rot', key: { id: 'k9', t: { k: 'sec', s: 0.5 }, v: 30 }, after: 'k1' }],
  ['key.add（合図つき）', { type: 'key.add', node: 'B', path: 'xf.rot', key: { id: 'k8', t: { k: 'cue', cue: { token: 'tk2', edge: 'start', offset: 0.1 } }, v: 10, hold: true }, after: 'k2' }],
  ['key.remove', { type: 'key.remove', node: 'B', path: 'xf.rot', key: 'k1' }],
  ['key.retime', { type: 'key.retime', node: 'B', path: 'xf.rot', key: 'k2', t: { k: 'cue', cue: { token: 'tk3', edge: 'end' } } }],
  ['key.value', { type: 'key.value', node: 'B', path: 'xf.rot', key: 'k2', v: 180 }],
  ['mode.set（工程）', { type: 'mode.set', stage: 'art', mode: 'human' }],
  ['mode.set（場面ごと）', { type: 'mode.set', stage: 'motion', mode: 'collab', scene: 's1' }],
  ['perms.set', { type: 'perms.set', key: 'remove', value: 'propose' }],
  ['lock.add（部品を固定）', { type: 'lock.add', lock: { id: 'lk1', target: { node: 'A' }, level: 'frozen', why: '良いと言われた' } }],
  ['lock.add（値の道だけ）', { type: 'lock.add', lock: { id: 'lk2', target: { node: 'A', path: 'fill.color' }, level: 'ask' } }],
  ['lock.remove', { type: 'lock.remove', lock: 'pre', why: '直すため' }, (b) => b.do({ type: 'lock.add', lock: { id: 'pre', target: { scene: 's1' }, level: 'ask' } })],
  ['line.add', { type: 'line.add', line: { id: 'ln2', text: 'ab', tokens: [{ id: 'x1', text: 'a' }, { id: 'x2', text: 'b' }] }, after: 'ln1' }],
  ['line.edit', { type: 'line.edit', line: 'ln1', text: 'カバは陸で暮らす', tokens: [{ id: 'tk1', text: 'カバは' }, { id: 'tk9', text: '陸で' }, { id: 'tk3', text: '暮らす' }] }],
  ['line.remove', { type: 'line.remove', line: 'ln1' }],
];

for (const [name, body, pre] of CASES) {
  test(`当てる → 取り消す → 元と同じ：${name}`, () => {
    const b = fixture(); if (pre) pre(b);
    const before = b.snap();
    b.do(body);
    const after = b.snap();
    assert.notEqual(after, before, '当てたら変わるはず');
    let r = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u1')], H()); assert.equal(r.status, 'applied', r.message); b.s = r.state;
    assert.equal(b.snap(), before, '取り消したら元と同じ');
    assert.ok(r.outcomes.every((o) => o.result === 'reverted'));
    r = applyBatch(b.s, [makeRedo(b.s.log, 'd1', 'r1')], H()); assert.equal(r.status, 'applied', r.message); b.s = r.state;
    assert.equal(b.snap(), after, 'やり直したら当てた後と同じ');
    r = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u2')], H()); assert.equal(r.status, 'applied', r.message); b.s = r.state;
    assert.equal(b.snap(), before, 'もう一度取り消しても元と同じ');
    assert.deepEqual(checkInvariants(b.doc), []);
    const rp = replay(b.init, toEntries(b.s.log)); assert.deepEqual(rp.skipped, []); assert.ok(same(rp.state.doc, b.doc), '記録から同じ文書');
  });
}

test('試した種類が、命令の一覧を全部おおっている（revert は取り消し・やり直しで通っている）', () => {
  const tried = new Set(CASES.map((c) => c[1].type)); tried.add('revert');
  assert.deepEqual(Object.keys(SPECS).filter((t) => !tried.has(t)), []);
});

test('取り消しを重ねる：3つ当てて3つ戻すと最初と同じ。途中で新しい操作をすると、やり直しは消える', () => {
  const b = fixture(); const s0 = b.snap(); let u = 0;
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 1] }); const s1 = b.snap();
  b.do({ type: 'node.rename', node: 'A', name: 'x' }); const s2 = b.snap();
  b.do({ type: 'node.remove', node: 'G' });
  const undo = () => { const c = makeUndo(b.s.log, 'd1', `u${++u}`); const r = applyBatch(b.s, [c], H()); assert.equal(r.status, 'applied'); b.s = r.state; };
  undo(); assert.equal(b.snap(), s2); undo(); assert.equal(b.snap(), s1); undo(); assert.equal(b.snap(), s0);
  const rd = applyBatch(b.s, [makeRedo(b.s.log, 'd1', 'rd')], H()); b.s = rd.state; assert.equal(b.snap(), s1);
  b.do({ type: 'node.rename', node: 'C', name: 'y' });
  assert.equal(makeRedo(b.s.log, 'd1', 'rd2'), null);
});

test('別の端末の操作は、自分の取り消しでは戻らない', () => {
  const b = fixture();
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 0] }, H('d1'));
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [0, 7] }, H('d2'));
  const r = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u1')], H('d1')); b.s = r.state;
  assert.deepEqual(b.doc.nodes.A.geo.pts[0].p.v, [0, 7]);
});
