// 当てる手順（9.3節①〜⑦）：重複・形の検査・前提・ひとまとめ・全体の決まり・版の移し替え・記録からの作り直し
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, applyBatch, check, replay, toEntries, same, checkInvariants, logLength, logItems, analyzeExpr, deepFreeze, REASONS } from '../src/index.js';
import { fixture, Bench, H, AI, S, hex, path } from './helpers.js';

test('① 同じ命令を2回当てても変わらない（前と同じ結果を返す）', () => {
  const b = fixture(); const c = b.cmd({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [3, 4] });
  const r1 = apply(b.s, c, H()); assert.equal(r1.status, 'applied');
  const r2 = apply(r1.state, c, H()); assert.equal(r2.status, 'duplicate');
  assert.equal(r2.state, r1.state); assert.equal(r2.applied[0], r1.applied[0]);
  assert.deepEqual(r1.state.doc.nodes.A.geo.pts[0].p.v, [3, 4]);
  assert.equal(logLength(r2.state.log), logLength(r1.state.log));
});
test('① 同じ id で中身が違う命令は断る', () => {
  const b = fixture(); const c = b.cmd({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [3, 4] });
  const r1 = apply(b.s, c, H()); const r2 = apply(r1.state, { ...c, body: { ...c.body, d: [9, 9] } }, H());
  assert.equal(r2.status, 'rejected'); assert.equal(r2.reason, 'duplicate'); assert.equal(r2.state, r1.state);
});

test('② 形の検査：一覧にない種類・引数の形・範囲・実在しない id は invalid', () => {
  const b = fixture(); const before = b.s;
  const bads = [
    { type: 'node.explode', node: 'A' },
    { type: 'pt.nudge', node: 'A', pt: 'p1', d: [1] },
    { type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, Infinity] },
    { type: 'pt.nudge', node: 'A', pt: 'nope', d: [1, 1] },
    { type: 'pt.nudge', node: 'NOPE', pt: 'p1', d: [1, 1] },
    { type: 'prop.set', node: 'A', path: 'xf.pos', value: S(5) },                    // 型が違う
    { type: 'prop.set', node: 'A', path: 'constructor', value: S(5) },               // 道の名前でない
    { type: 'prop.set', node: 'A', path: 'geo.round', value: S(5) },                 // この形に無い道
    { type: 'prop.set', node: 'A', path: 'xf.pos', value: { k: 'keys', keys: [] } }, // 種類を変えるのは prop.kind
    { type: 'prop.set', node: 'A', path: 'fill.color', value: hex('red') },
    { type: 'prop.nudge', node: 'B', path: 'xf.rot', d: [1] },                       // 鍵のある値には足せない
    { type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'expr', src: 'while(1)' } },
    { type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'expr', src: 'eval("x")' } },
    { type: 'node.add', node: { id: '__proto__', scene: 's1', kind: 'group', name: 'x', order: 'i' } },
    { type: 'node.add', node: { id: 'A', scene: 's1', kind: 'group', name: 'x', order: 'i' } },
    { type: 'node.add', node: { id: 'N', scene: 'nope', kind: 'group', name: 'x', order: 'i' } },
    { type: 'node.add', node: { id: 'N', scene: 's1', kind: 'group', name: 'x', order: 'i', parent: 'A' } }, // 親はまとまりだけ
    { type: 'node.add', node: { id: 'N', scene: 's1', kind: 'image', name: 'x', order: 'i' } },
    { type: 'key.add', node: 'A', path: 'xf.rot', key: { id: 'k', t: { k: 'sec', s: 0 }, v: 1 } },         // 鍵を持つ値でない
    { type: 'key.value', node: 'B', path: 'xf.rot', key: 'k1', v: 'x' },
    { type: 'key.retime', node: 'B', path: 'xf.rot', key: 'k1', t: { k: 'sec', s: -1 } },
    { type: 'pt.add', node: 'A', pt: { id: 'p1', p: S([0, 0]) }, after: null },                             // 点の id が重なる
    { type: 'pt.add', node: 'B', pt: { id: 'z', p: S([0, 0]) }, after: null },                              // 点を持たない形
    { type: 'mode.set', stage: 'art', mode: 'god' },
    { type: 'perms.set', key: 'everything', value: 'allow' },
    { type: 'lock.add', lock: { id: 'l', target: {}, level: 'frozen' } },
    { type: 'line.edit', line: 'ln1', text: 'x', tokens: [{ id: 'tk1', text: 'x' }] },                      // 中身の変わったトークンに前の id
    { type: 'revert', targets: ['no-such-record'] },
  ];
  for (const body of bads) { const r = b.try(body); assert.equal(r.status, 'rejected', JSON.stringify(body)); assert.equal(r.reason, 'invalid', JSON.stringify(body) + r.message); }
  assert.equal(b.s, before, '断られた命令は何も変えない');
  // 封筒そのものの形
  for (const c of [null, {}, { id: 'x' }, { id: 'x', v: 1, actor: { k: 'human' }, body: {} }, { id: 'x', v: 99, actor: { k: 'human' }, body: { type: 'node.rename', node: 'A', name: 'n' } }, { id: 'x', v: 1, actor: { k: 'cat' }, base: {}, body: { type: 'node.rename', node: 'A', name: 'n' } }]) {
    const r = applyBatch(b.s, [c], H()); assert.equal(r.status, 'rejected'); assert.equal(r.reason, 'invalid');
  }
  // 身元を渡さない呼び出しは通らない
  assert.equal(applyBatch(b.s, [b.cmd({ type: 'node.rename', node: 'A', name: 'n' })], {}).reason, 'invalid');
});

test('古い版の命令を新しい形に移す：prop.set v1（裸の値）→ v2（札つき）。記録は書きかえない', () => {
  const b = fixture(); const c = { ...b.cmd({ type: 'prop.set', node: 'A', path: 'xf.rot', value: 30 }), v: 1 };
  const r = apply(b.s, c, H()); assert.equal(r.status, 'applied', r.message);
  assert.deepEqual(r.state.doc.nodes.A.xf.rot, S(30));
  assert.equal(r.applied[0].cmd.v, 1); assert.equal(r.applied[0].cmd.body.value, 30);
  assert.equal(apply(b.s, { ...c, id: 'v2raw', v: 2 }, H()).reason, 'invalid', 'v2 では裸の値は通らない');
  const rp = replay(b.init, toEntries(r.state.log)); assert.ok(same(rp.state.doc, r.state.doc));
});

test('④ 前提：base の版が古くても、道が重ならなければ当たる。同じ道の置きかえは conflict。足す量どうしは両方当たる', () => {
  const b = fixture(); const old = { ...b.doc.revs };
  b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#101010') }, H('d1'));
  // 別の端末：古い版を見ていた
  let r = b.try({ type: 'prop.set', node: 'A', path: 'xf.pos', value: S([1, 1]) }, H('d2'), { base: old });
  assert.equal(r.status, 'applied', '同じ部品の別の値は、ぶつからない');
  r = b.try({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#202020') }, H('d2'), { base: old });
  assert.equal(r.reason, 'conflict'); assert.equal(b.doc.nodes.A.fill.color.v.v, '#101010', '先の物が生きる');
  const old2 = { ...b.doc.revs };
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 0] }, H('d1'));
  r = b.try({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [0, 2] }, H('d2'), { base: old2 });
  assert.equal(r.status, 'applied'); assert.deepEqual(b.doc.nodes.A.geo.pts[0].p.v, [1, 2]);
  // 足した物と外した物の食い違い
  const old3 = { ...b.doc.revs };
  b.do({ type: 'pt.remove', node: 'A', pt: 'p2' }, H('d1'));
  r = b.try({ type: 'pt.nudge', node: 'A', pt: 'p2', d: [1, 1] }, H('d2'), { base: old3 });
  assert.equal(r.reason, 'stale', '相手がもう無い');
  r = b.try({ type: 'pt.add', node: 'A', pt: { id: 'n', p: S([0, 0]) }, after: 'p2' }, H('d2'), { base: old3 });
  assert.equal(r.reason, 'stale');
  // 外された点を、古い版を見て置きかえる → 外した物と置きかえの食い違い
  const old4 = { ...b.doc.revs };
  b.do({ type: 'node.remove', node: 'C' }, H('d1'));
  r = b.try({ type: 'node.rename', node: 'C', name: 'x' }, H('d2'), { base: old4 });
  assert.equal(r.reason, 'stale');
  // base に版が書いていない／まだ無い版を前提にしている
  r = b.try({ type: 'node.rename', node: 'A', name: 'x' }, H('d2'), { base: {} }); assert.equal(r.reason, 'stale');
  r = b.try({ type: 'node.rename', node: 'A', name: 'x' }, H('d2'), { base: { 'node:A': 999 } }); assert.equal(r.reason, 'stale');
});

test('⑤ ひとまとめ：途中で失敗する group は何も変えない。全部通れば全部入る', () => {
  const b = fixture(); const s0 = b.s; const snap = b.snap();
  let r = b.batch([{ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 1] }, { type: 'node.rename', node: 'A', name: 'x' }, { type: 'pt.nudge', node: 'A', pt: 'nope', d: [1, 1] }]);
  assert.equal(r.status, 'rejected'); assert.equal(r.at, 2); assert.equal(b.s, s0); assert.equal(b.snap(), snap);
  r = b.batch([{ type: 'node.add', node: path('X', [['a', 0, 0]]) }, { type: 'pt.add', node: 'X', pt: { id: 'b', p: S([1, 1]) }, after: 'a' }, { type: 'pt.nudge', node: 'X', pt: 'b', d: [1, 1] }], H(), { group: 'g1' });
  assert.equal(r.status, 'applied'); assert.equal(r.applied.length, 3); assert.deepEqual(b.doc.nodes.X.geo.pts[1].p.v, [2, 2]);
  assert.equal(b.doc.revs['node:X'], 3);
  // 最後の検査（全体の決まり）で落ちる group も、何も変えない
  const s1 = b.s;
  r = b.batch([{ type: 'node.rename', node: 'A', name: 'y' }, { type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'ref', to: { k: 'prop', node: 'A', path: 'xf.rot' } } }]);
  assert.equal(r.reason, 'breaks-invariant'); assert.equal(b.s, s1);
  // 一部だけ当て済みの group
  const c1 = b.cmd({ type: 'node.rename', node: 'A', name: 'z' }); b.s = apply(b.s, c1, H()).state;
  r = applyBatch(b.s, [c1, b.cmd({ type: 'node.rename', node: 'C', name: 'z' })], H()); assert.equal(r.reason, 'duplicate');
});

test('⑥ 全体の決まり：親子の輪・切れた参照・参照の輪は breaks-invariant', () => {
  const b = fixture();
  b.do({ type: 'node.add', node: { id: 'G2', scene: 's1', kind: 'group', name: 'g2', parent: 'G', order: 'x' } });
  let r = b.try({ type: 'node.move', node: 'G', parent: 'G2', order: 'i' }); assert.equal(r.reason, 'breaks-invariant');
  r = b.try({ type: 'node.move', node: 'G', parent: 'G', order: 'i' }); assert.equal(r.reason, 'breaks-invariant');
  r = b.try({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'ref', to: { k: 'prop', node: 'ZZ', path: 'xf.rot' } } }); assert.equal(r.reason, 'breaks-invariant');
  r = b.try({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'ref', to: { k: 'prop', node: 'B', path: 'xf.pos' } } }); assert.equal(r.reason, 'breaks-invariant', '型の違う参照');
  // 参照されている物は外せない
  b.do({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'ref', to: { k: 'prop', node: 'C', path: 'xf.rot' } } });
  r = b.try({ type: 'node.remove', node: 'C' }); assert.equal(r.reason, 'breaks-invariant');
  // 参照の輪（参照と式をまたいで）
  b.do({ type: 'prop.kind', node: 'C', path: 'xf.rot', value: { k: 'expr', src: 'ref("L.xf.rot") * 2' } });
  r = b.try({ type: 'prop.kind', node: 'L', path: 'xf.rot', value: { k: 'expr', src: 'sin(time) + ref("A.xf.rot")' } }); assert.equal(r.reason, 'breaks-invariant');
  // 点への参照があるとき、その点は外せない
  b.do({ type: 'prop.kind', node: 'C', path: 'xf.pos', value: { k: 'ref', to: { k: 'prop', node: 'A', path: 'geo.pts.p2.p' } } });
  r = b.try({ type: 'pt.remove', node: 'A', pt: 'p2' }); assert.equal(r.reason, 'breaks-invariant');
  assert.deepEqual(checkInvariants(b.doc), []);
});

test('式の上限：大きさ 200・深さ 16・follow 4段。越えたら断る。読めない物・できない事も断る', () => {
  const b = fixture(); const ex = (src) => b.try({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'expr', src } });
  assert.equal(ex(Array.from({ length: 150 }, (_, i) => `sin(${i})`).join('+')).reason, 'breaks-invariant');
  assert.equal(ex('abs('.repeat(17) + '1' + ')'.repeat(17)).reason, 'breaks-invariant');
  assert.equal(ex('follow('.repeat(5) + 'time' + ',1)'.repeat(5)).reason, 'breaks-invariant');
  for (const src of ['', '1 +', 'x = 1', 'Math.random()', 'time; time', '"abc"', 'ref(time)', 'ref("A")', 'sin(1,2)', 'process', 'a.b', '[1]', 'f(){}']) assert.equal(ex(src).reason, 'invalid', src);
  assert.deepEqual(analyzeExpr('clamp(spring(ref("B.xf.rot"), 0.5, 0.2) + noise(7, time * 3), -10, 10)').refs, [{ k: 'prop', node: 'B', path: 'xf.rot' }]);
  assert.equal(ex('follow(follow(follow(follow(time,1),1),1),1) + loop(time, 2) > 0 ? value : -value').status, 'applied');
  // 送る側が書いた refs は信じない（核が式から作り直す）
  const r = b.try({ type: 'prop.kind', node: 'C', path: 'xf.rot', value: { k: 'expr', src: 'ref("B.xf.rot")', refs: [] } });
  assert.deepEqual(r.applied[0].effects[0].after.refs, [{ k: 'prop', node: 'B', path: 'xf.rot' }]);
});

test('効果は核が作る：送る側が書いた effects・undo・rev は使われない', () => {
  const b = fixture(); const c = b.cmd({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 1], effects: [{ k: 'set', at: ['cover', 'perms', 'cover'], before: 'deny', after: 'allow' }], undo: 'rm -rf' });
  c.effects = [{ k: 'set', at: ['cover', 'perms', 'cover'], after: 'allow' }];
  const r = apply(b.s, c, H()); assert.equal(r.status, 'applied');
  assert.deepEqual(r.applied[0].effects, [{ k: 'delta', at: ['node', 'A', 'geo', 'pts', 'p1', 'p'], d: [1, 1] }]);
  assert.equal(r.state.doc.cover.perms.cover, 'deny');
});

test('核は元の状態を書きかえない（凍らせた状態に当てても動く）。check は何も変えない', () => {
  const b = fixture(); deepFreeze(b.s.doc); const snap = b.snap(); const n = logLength(b.s.log);
  const c = b.cmd({ type: 'node.remove', node: 'G' });
  const d = check(b.s, c, H()); assert.equal(d.status, 'applied'); assert.equal(d.state, b.s); assert.equal(logLength(b.s.log), n);
  const r = apply(b.s, c, H()); assert.equal(r.status, 'applied'); assert.equal(b.snap(), snap);
  // 古い状態から枝分かれして当てても、もう片方の記録は変わらない
  const r2 = apply(b.s, b.cmd({ type: 'node.rename', node: 'A', name: '枝' }), H());
  assert.equal(logItems(r.state.log).at(-1).cmd.body.type, 'node.remove'); assert.equal(logItems(r2.state.log).at(-1).cmd.body.type, 'node.rename');
  assert.equal(logLength(r.state.log), n + 1); assert.equal(logLength(r2.state.log), n + 1);
});

test('数は 1/10000 の格子に乗る：小数を足して引いても、きっかり元に戻る', () => {
  const b = fixture(); b.do({ type: 'prop.set', node: 'A', path: 'xf.pos', value: S([0.1, 0.123456789]) });
  assert.deepEqual(b.doc.nodes.A.xf.pos.v, [0.1, 0.1235]);
  const a = b.do({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [0.2, 0.7] });
  b.do({ type: 'revert', targets: [a.cmd.id] });
  assert.deepEqual(b.doc.nodes.A.xf.pos.v, [0.1, 0.1235]);
});

test('記録からの作り直し：同じ記録からは同じ文書・同じ効果。断りの札は決まった一覧の中', () => {
  const b = fixture();
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 1] }, AI()); b.do({ type: 'node.remove', node: 'C' });
  const entries = toEntries(b.s.log); const r1 = replay(b.init, entries); const r2 = replay(b.init, JSON.parse(JSON.stringify(entries)));
  assert.ok(same(r1.state.doc, b.doc)); assert.ok(same(r2.state.doc, b.doc));
  assert.ok(same(logItems(r1.state.log), logItems(b.s.log)), '効果・版・方針も同じに作り直される');
  assert.deepEqual(REASONS, ['duplicate', 'invalid', 'forbidden', 'locked', 'stale', 'conflict', 'breaks-invariant']);
});
