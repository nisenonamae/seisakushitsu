// 選んで取り消す（9.5節）：AI が A を変える → 人が A を直す → AI の分だけ戻す。表の全部の行。
// どの行でも「人の直しが残ること」を確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBatch, check, aiRecordIds, checkInvariants, replay, toEntries, same, makeUndo, makeRedo } from '../src/index.js';
import { fixture, H, AI, S, hex, path } from './helpers.js';

/** AI の記録（ids）を、人が選んで戻す */
function revertAI(b, ids, extra = {}) {
  const r = b.try({ type: 'revert', mode: 'select', targets: ids, ...extra }, H());
  assert.equal(r.status, 'applied', `${r.reason} ${r.message}`); assert.deepEqual(checkInvariants(b.doc), []);
  const rp = replay(b.init, toEntries(b.s.log)); assert.ok(same(rp.state.doc, b.doc), '記録から同じ文書');
  return r;
}
const results = (r) => r.outcomes.map((o) => o.result);
const pt = (b, node, id) => b.doc.nodes[node].geo.pts.find((p) => p.id === id);
const key = (b, id) => b.doc.nodes.B.xf.rot.keys.find((k) => k.id === id);
/** AI の「消す」は提案どまりなので、人が採った形（actor は ai・proposal つき・送り主は人）で記録に入る */
const ACCEPT = { actor: { k: 'ai', agent: 'w1' }, proposal: 'pr1' };

// ───────── 行1：置きかえ（set）／だれも同じ所を変えていない → before に戻す
test('行1 set・そのまま → before に戻す（人が別の値の道を直していても、ぶつからない）', () => {
  const b = fixture();
  const a = b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#ff00ff') }, AI());
  b.do({ type: 'prop.set', node: 'A', path: 'xf.pos', value: S([7, 7]) }, H());      // 人：同じ部品の位置
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 1] }, H());                     // 人：同じ部品の点
  const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(results(r), ['reverted']);
  assert.equal(b.doc.nodes.A.fill.color.v.v, '#336699', 'AI の色は元へ');
  assert.deepEqual(b.doc.nodes.A.xf.pos.v, [7, 7], '人の位置は残る'); assert.deepEqual(pt(b, 'A', 'p1').p.v, [1, 1], '人の点は残る');
});
test('行1 set の色々：名前・鍵の値・鍵の時刻・取っ手・角', () => {
  const b = fixture(); const ids = [];
  for (const body of [{ type: 'node.rename', node: 'A', name: 'AIの名前' }, { type: 'key.value', node: 'B', path: 'xf.rot', key: 'k2', v: 45 }, { type: 'key.retime', node: 'B', path: 'xf.rot', key: 'k2', t: { k: 'sec', s: 3 } },
    { type: 'pt.handle', node: 'A', pt: 'p1', which: 'out', value: S([3, 3]) }, { type: 'pt.corner', node: 'A', pt: 'p2', corner: true }]) ids.push(b.do(body, AI()).cmd.id);
  b.do({ type: 'key.value', node: 'B', path: 'xf.rot', key: 'k1', v: -5 }, H());        // 人：別の鍵
  const r = revertAI(b, ids);
  assert.ok(results(r).every((x) => x === 'reverted'));
  assert.equal(b.doc.nodes.A.name, 'A'); assert.equal(key(b, 'k2').v, 90); assert.deepEqual(key(b, 'k2').t, { k: 'sec', s: 1 });
  assert.equal(pt(b, 'A', 'p1').out, undefined); assert.equal(pt(b, 'A', 'p2').corner, undefined); assert.equal(key(b, 'k1').v, -5, '人の鍵は残る');
});

// ───────── 行2：置きかえ（set）／人が同じ所をさらに置きかえた → 何もしない（上書き済み）
test('行2 set・人が同じ所を置きかえた → 何もしない。「上書き済み」と報告。人の値が残る', () => {
  const b = fixture();
  const a = b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#ff00ff') }, AI());
  b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#00ffff') }, H());
  const snap = b.snap(); const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why]), [['noop', 'overwritten']]);
  assert.equal(b.snap(), snap); assert.equal(b.doc.nodes.A.fill.color.v.v, '#00ffff');
});
test('行2 人が AI と同じ値をわざわざ置き直した場合も、人の置きかえとして残す', () => {
  const b = fixture();
  const a = b.do({ type: 'node.rename', node: 'A', name: '頭' }, AI()); b.do({ type: 'node.rename', node: 'A', name: '顔' }, H()); b.do({ type: 'node.rename', node: 'A', name: '頭' }, H());
  const r = revertAI(b, [a.cmd.id]); assert.deepEqual(results(r), ['noop']); assert.equal(b.doc.nodes.A.name, '頭');
});

// ───────── 行3：足した量（delta）／人も足している → AI の分だけ引く
test('行3 delta・人も足した → AI の分だけ引く。人の分は残る（点・位置・回転）', () => {
  const b = fixture();
  const a1 = b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [10, 0] }, AI());
  const a2 = b.do({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [100, 100] }, AI());
  const a3 = b.do({ type: 'prop.nudge', node: 'A', path: 'xf.rot', d: [30] }, AI());
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [0, 5] }, H()); b.do({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [-0.5, 0.25] }, H()); b.do({ type: 'prop.nudge', node: 'A', path: 'xf.rot', d: [1.5] }, H());
  const r = revertAI(b, [a1.cmd.id, a2.cmd.id, a3.cmd.id]);
  assert.deepEqual(results(r), ['reverted', 'reverted', 'reverted']);
  assert.deepEqual(pt(b, 'A', 'p1').p.v, [0, 5]); assert.deepEqual(b.doc.nodes.A.xf.pos.v, [-0.5, 0.25]); assert.equal(b.doc.nodes.A.xf.rot.v, 1.5);
});
test('行3の周り：delta のあと人が置きかえた → 上書き済み／人が鍵に変えた → 聞く（残すだけ）', () => {
  const b = fixture();
  const a1 = b.do({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [100, 100] }, AI()); b.do({ type: 'prop.set', node: 'A', path: 'xf.pos', value: S([3, 3]) }, H());
  const a2 = b.do({ type: 'prop.nudge', node: 'A', path: 'xf.rot', d: [30] }, AI());
  b.do({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'keys', keys: [{ id: 'h1', t: { k: 'sec', s: 0 }, v: 30 }, { id: 'h2', t: { k: 'sec', s: 1 }, v: 60 }] } }, H());
  const snap = b.snap(); const r = revertAI(b, [a1.cmd.id, a2.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.cmd, o.result, o.why]), [[a2.cmd.id, 'ask', 'kind-changed'], [a1.cmd.id, 'noop', 'overwritten']]);
  assert.deepEqual(r.outcomes[0].choices, ['keep']); assert.equal(b.snap(), snap, '人の直しは何も変わらない');
});

// ───────── 行4：足した物（insert）／だれも触っていない → 外す
test('行4 insert・そのまま → 外す（点・鍵・部品）。人がほかの点・鍵・部品を直していても残る', () => {
  const b = fixture();
  const a1 = b.do({ type: 'pt.add', node: 'A', pt: { id: 'ai1', p: S([5, -3]) }, after: 'p1' }, AI());
  const a2 = b.do({ type: 'key.add', node: 'B', path: 'xf.rot', key: { id: 'ak', t: { k: 'sec', s: 0.5 }, v: 20 }, after: 'k1' }, AI());
  const a3 = b.do({ type: 'node.add', node: path('AIN', [['a', 0, 0], ['b', 1, 1]], { parent: 'G', order: 'x' }) }, AI());
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p2', d: [0, 9] }, H()); b.do({ type: 'key.value', node: 'B', path: 'xf.rot', key: 'k2', v: 77 }, H()); b.do({ type: 'node.rename', node: 'L', name: '人の線' }, H());
  const r = revertAI(b, [a1.cmd.id, a2.cmd.id, a3.cmd.id]);
  assert.deepEqual(results(r), ['reverted', 'reverted', 'reverted']);
  assert.deepEqual(b.doc.nodes.A.geo.pts.map((p) => p.id), ['p1', 'p2', 'p3']); assert.deepEqual(b.doc.nodes.B.xf.rot.keys.map((k) => k.id), ['k1', 'k2']); assert.equal(b.doc.nodes.AIN, undefined);
  assert.deepEqual(pt(b, 'A', 'p2').p.v, [10, 9]); assert.equal(key(b, 'k2').v, 77); assert.equal(b.doc.nodes.L.name, '人の線');
});

// ───────── 行5：足した物（insert）／人がそれを直した・子を付けた・参照した → 止まって聞く
test('行5 insert・人がそれを直した → 止まって聞く（答えが無ければ残す）。何が一緒に消えるかを返す', () => {
  const b = fixture();
  const a1 = b.do({ type: 'pt.add', node: 'A', pt: { id: 'ai1', p: S([5, -3]) }, after: 'p1' }, AI());
  const a2 = b.do({ type: 'key.add', node: 'B', path: 'xf.rot', key: { id: 'ak', t: { k: 'sec', s: 0.5 }, v: 20 }, after: 'k1' }, AI());
  const a3 = b.do({ type: 'node.add', node: path('AIN', [['a', 0, 0], ['b', 1, 1]], { parent: 'G', order: 'x' }) }, AI());
  const h1 = b.do({ type: 'pt.nudge', node: 'A', pt: 'ai1', d: [0.5, 0.5] }, H());
  const h2 = b.do({ type: 'key.value', node: 'B', path: 'xf.rot', key: 'ak', v: 25 }, H());
  const h3 = b.do({ type: 'prop.set', node: 'AIN', path: 'fill.color', value: hex('#abcdef') }, H());
  const snap = b.snap(); const ids = [a1.cmd.id, a2.cmd.id, a3.cmd.id];
  // 先に一覧だけ見る（当てない）
  const pre = check(b.s, b.cmd({ type: 'revert', targets: ids }), H()); assert.deepEqual(pre.tally, { reverted: 0, noop: 0, ask: 3, kept: 0 }); assert.equal(pre.state, b.s);
  const r = revertAI(b, ids);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why, o.choices, o.collateral.records]), [
    ['ask', 'edited', ['keep', 'force'], [h3.cmd.id]], ['ask', 'edited', ['keep', 'force'], [h2.cmd.id]], ['ask', 'edited', ['keep', 'force'], [h1.cmd.id]]]);
  assert.equal(b.snap(), snap, '答えが無いあいだは、人の直しごと全部残る');
  // 答える：点は残す・鍵と部品は「人の直しごと外す」
  const r2 = revertAI(b, ids, { decisions: { [`${a1.cmd.id}#0`]: 'keep', [`${a2.cmd.id}#0`]: 'force', [`${a3.cmd.id}#0`]: 'force' } });
  assert.deepEqual(r2.outcomes.map((o) => [o.result, o.forced]), [['reverted', 'force'], ['reverted', 'force'], ['kept', undefined]]);
  assert.deepEqual(pt(b, 'A', 'ai1').p.v, [5.5, -2.5], '残すと答えた点は、人の直しごと残る'); assert.equal(key(b, 'ak'), undefined); assert.equal(b.doc.nodes.AIN, undefined);
  // 「人の直しごと外す」も取り消せる（戻すと人の直しごと帰ってくる）
  const u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u1')], H()); b.s = u.state; assert.equal(b.snap(), snap);
});
test('行5 insert・人が子を付けた → 止まって聞く（子の一覧つき）。外すと答えたら子ごと外れる', () => {
  const b = fixture();
  const a = b.do({ type: 'node.add', node: { id: 'AIG', scene: 's1', kind: 'group', name: 'AIのまとまり', order: 'x' } }, AI());
  b.do({ type: 'node.add', node: path('HC', [['a', 0, 0]], { parent: 'AIG' }) }, H());   // 人：新しい子
  b.do({ type: 'node.move', node: 'C', parent: 'AIG', order: 'k' }, H());                  // 人：もとからある物を中へ
  const snap = b.snap(); const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why, o.collateral.children]), [['ask', 'has-children', ['C', 'HC']]]); assert.equal(b.snap(), snap);
  const r2 = revertAI(b, [a.cmd.id], { decisions: { [`${a.cmd.id}#0`]: 'force' } });
  assert.deepEqual(results(r2), ['reverted']); assert.ok(!b.doc.nodes.AIG && !b.doc.nodes.HC && !b.doc.nodes.C);
});
test('行5 insert・人がそれを参照した → 止まって聞く（参照している所つき）。外す道は出さない', () => {
  const b = fixture();
  const a1 = b.do({ type: 'node.add', node: path('AIN', [['a', 0, 0]]) }, AI());
  const a2 = b.do({ type: 'pt.add', node: 'A', pt: { id: 'ai1', p: S([5, -3]) }, after: 'p1' }, AI());
  b.do({ type: 'prop.kind', node: 'C', path: 'xf.rot', value: { k: 'expr', src: 'ref("AIN.xf.rot") + 10' } }, H());
  b.do({ type: 'prop.kind', node: 'C', path: 'xf.pos', value: { k: 'ref', to: { k: 'prop', node: 'A', path: 'geo.pts.ai1.p' } } }, H());
  const snap = b.snap(); const r = revertAI(b, [a1.cmd.id, a2.cmd.id], { decisions: { [`${a1.cmd.id}#0`]: 'force', [`${a2.cmd.id}#0`]: 'force' } });
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why, o.choices, o.collateral.refs]), [['ask', 'referenced', ['keep'], ['C.xf.pos']], ['ask', 'referenced', ['keep'], ['C.xf.rot']]]);
  assert.equal(b.snap(), snap);
});
test('行5 AI のまとまりの中に AI の子、その子を人が直した → 子で聞き、親も（子が残るので）聞く', () => {
  const b = fixture();
  const a1 = b.do({ type: 'node.add', node: { id: 'AIG', scene: 's1', kind: 'group', name: 'g', order: 'x' } }, AI());
  const a2 = b.do({ type: 'node.add', node: path('AIC', [['a', 0, 0]], { parent: 'AIG' }) }, AI());
  const a3 = b.do({ type: 'node.add', node: path('AIC2', [['a', 0, 0]], { parent: 'AIG', order: 'k' }) }, AI());
  b.do({ type: 'pt.nudge', node: 'AIC', pt: 'a', d: [1, 1] }, H());
  const r = revertAI(b, [a1.cmd.id, a2.cmd.id, a3.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.cmd, o.result]), [[a3.cmd.id, 'reverted'], [a2.cmd.id, 'ask'], [a1.cmd.id, 'ask']]);
  assert.ok(b.doc.nodes.AIG && b.doc.nodes.AIC && !b.doc.nodes.AIC2); assert.deepEqual(b.doc.nodes.AIC.geo.pts[0].p.v, [1, 1]);
});

// ───────── 行6：外した物（remove）→ 戻す。親が無くなっていたら、止まって聞く
test('行6 remove → 戻す（点・鍵・部品を子ごと）。中身は記録から。人のほかの直しは残る', () => {
  const b = fixture();
  const a1 = b.do({ type: 'pt.remove', node: 'A', pt: 'p2' }, H(), ACCEPT);
  const a2 = b.do({ type: 'key.remove', node: 'B', path: 'xf.rot', key: 'k1' }, AI());
  const a3 = b.do({ type: 'node.remove', node: 'C' }, H(), ACCEPT);
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p3', d: [2, 2] }, H()); b.do({ type: 'pt.add', node: 'A', pt: { id: 'hp', p: S([9, 9]) }, after: 'p1' }, H()); b.do({ type: 'key.value', node: 'B', path: 'xf.rot', key: 'k2', v: 60 }, H());
  const r = revertAI(b, [a1.cmd.id, a2.cmd.id, a3.cmd.id]);
  assert.deepEqual(results(r), ['reverted', 'reverted', 'reverted']);
  assert.deepEqual(b.doc.nodes.A.geo.pts.map((p) => p.id), ['p1', 'p2', 'hp', 'p3'], '元の隣（p1）の後ろへ戻る。人が足した点も残る');
  assert.deepEqual(pt(b, 'A', 'p2').p.v, [10, 0]); assert.deepEqual(pt(b, 'A', 'p3').p.v, [12, 12]);
  assert.deepEqual(b.doc.nodes.B.xf.rot.keys.map((k) => [k.id, k.v]), [['k1', 0], ['k2', 60]]); assert.equal(b.doc.nodes.C.name, '丸');
});
test('行6 remove（まとまりを子ごと）→ 親から順に全部戻る', () => {
  const b = fixture(); const snap = b.snap();
  const a = b.do({ type: 'node.remove', node: 'G' }, H(), ACCEPT); assert.equal(a.effects.length, 4);
  b.do({ type: 'node.rename', node: 'C', name: '人' }, H());
  const r = revertAI(b, [a.cmd.id]); assert.deepEqual(results(r), ['reverted', 'reverted', 'reverted', 'reverted']);
  b.do({ type: 'node.rename', node: 'C', name: '丸' }, H()); assert.equal(b.snap(), snap);
});
test('行6 remove・親が無くなっていた → 止まって聞く：①そのまま ②いちばん上に戻す', () => {
  const b = fixture();
  const a = b.do({ type: 'node.remove', node: 'A' }, H(), ACCEPT);
  b.do({ type: 'node.remove', node: 'G' }, H());                                         // 人：親ごと消した
  const snap = b.snap(); const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why, o.choices, o.collateral]), [['ask', 'parent-gone', ['keep', 'root'], { parent: 'G' }]]); assert.equal(b.snap(), snap);
  const r2 = revertAI(b, [a.cmd.id], { decisions: { [`${a.cmd.id}#0`]: 'root' } });
  assert.deepEqual(results(r2), ['reverted']); assert.equal(b.doc.nodes.A.parent, null); assert.equal(b.doc.nodes.G, undefined);
});
test('行6の周り：点・鍵の入れ物が無くなっていた／人がもう戻していた', () => {
  const b = fixture();
  const a1 = b.do({ type: 'key.remove', node: 'B', path: 'xf.rot', key: 'k1' }, AI());
  b.do({ type: 'prop.kind', node: 'B', path: 'xf.rot', value: S(12) }, H());              // 人：鍵をやめて固定に
  const a2 = b.do({ type: 'pt.remove', node: 'A', pt: 'p2' }, H(), ACCEPT);
  b.do({ type: 'revert', targets: [a2.cmd.id] }, H());                                    // 人：もう戻した
  const snap = b.snap(); const r = revertAI(b, [a1.cmd.id, a2.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why]), [['noop', 'already'], ['ask', 'container-gone']]); assert.equal(b.snap(), snap);
});

// ───────── 行7：親・順番の移動（move）／人がさらに移した → 何もしない
test('行7 move・人がさらに移した → 何もしない（上書き済み）', () => {
  const b = fixture();
  const a = b.do({ type: 'node.move', node: 'A', parent: null, order: 'a' }, AI());
  b.do({ type: 'node.move', node: 'A', parent: 'G', order: 'z' }, H());
  const snap = b.snap(); const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why]), [['noop', 'overwritten']]); assert.equal(b.snap(), snap);
});

// ───────── 行8：親・順番の移動（move）／そのまま → 元の親・順番へ。元の親が無ければ聞く
test('行8 move・そのまま → 元の親・順番へ（人が中身を直していても残る）', () => {
  const b = fixture();
  const a = b.do({ type: 'node.move', node: 'A', parent: null, order: 'a' }, AI());
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [4, 4] }, H()); b.do({ type: 'node.move', node: 'B', parent: 'G', order: 'zz' }, H());
  const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(results(r), ['reverted']); assert.equal(b.doc.nodes.A.parent, 'G'); assert.equal(b.doc.nodes.A.order, 'c');
  assert.deepEqual(pt(b, 'A', 'p1').p.v, [4, 4]); assert.equal(b.doc.nodes.B.order, 'zz');
});
test('行8 move・元の親が無くなっていた → 止まって聞く：①そのまま ②いちばん上に戻す', () => {
  const b = fixture();
  b.do({ type: 'node.add', node: { id: 'G2', scene: 's1', kind: 'group', name: 'g2', order: 'x' } });
  const a = b.do({ type: 'node.move', node: 'A', parent: 'G2', order: 'a' }, AI());
  b.do({ type: 'node.remove', node: 'G' }, H());
  const snap = b.snap(); const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why, o.choices]), [['ask', 'parent-gone', ['keep', 'root']]]); assert.equal(b.snap(), snap);
  revertAI(b, [a.cmd.id], { decisions: { [`${a.cmd.id}#0`]: 'root' } }); assert.equal(b.doc.nodes.A.parent, null);
});
test('行8の周り：戻すと親子が輪になる → 当てずに聞く', () => {
  const b = fixture();
  b.do({ type: 'node.add', node: { id: 'G2', scene: 's1', kind: 'group', name: 'g2', order: 'x' } });
  b.do({ type: 'node.add', node: { id: 'G3', scene: 's1', kind: 'group', name: 'g3', parent: 'G2', order: 'x' } });
  const a = b.do({ type: 'node.move', node: 'G3', parent: null, order: 'a' }, AI());      // AI：G3 を G2 の中から外へ
  b.do({ type: 'node.move', node: 'G2', parent: 'G3', order: 'a' }, H());                  // 人：G2 を G3 の中へ
  const snap = b.snap(); const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why]), [['ask', 'breaks-invariant']]); assert.equal(b.snap(), snap);
});

// ───────── 表の下の決まり・分かっている限界
test('種類を変える命令（prop.kind）は「足した物」と同じ扱い：人がその上で直していたら聞く。いなければ戻す', () => {
  const b = fixture();
  const a1 = b.do({ type: 'prop.kind', node: 'A', path: 'xf.pos', value: { k: 'keys', keys: [{ id: 'm1', t: { k: 'sec', s: 0 }, v: [0, 0] }, { id: 'm2', t: { k: 'sec', s: 1 }, v: [5, 5] }] } }, AI());
  const a2 = b.do({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'expr', src: 'wiggle(1,2,3)' } }, AI());
  const h = b.do({ type: 'key.value', node: 'A', path: 'xf.pos', key: 'm2', v: [6, 7] }, H());   // 人：AI の鍵を直した
  const r = revertAI(b, [a1.cmd.id, a2.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.cmd, o.result, o.why]), [[a2.cmd.id, 'reverted', undefined], [a1.cmd.id, 'ask', 'kind-edited']]);
  assert.deepEqual(r.outcomes[1].collateral.records, [h.cmd.id]);
  assert.deepEqual(b.doc.nodes.A.xf.rot, S(0)); assert.deepEqual(b.doc.nodes.A.xf.pos.keys[1].v, [6, 7]);
});
test('図形の種類を変える（geo.set）も同じ扱い：AI が丸を自由な形にし、人がその点を直した → 聞く。直していなければ戻す', () => {
  const b = fixture(); const geo = () => ({ t: 'path', closed: true, pts: [{ id: 'c1', p: S([-4, 0]) }, { id: 'c2', p: S([0, -4]) }, { id: 'c3', p: S([4, 0]) }] });
  const a1 = b.do({ type: 'geo.set', node: 'C', geo: geo() }, AI());
  b.do({ type: 'node.add', node: { id: 'D', scene: 's1', kind: 'shape', name: '丸2', order: 'w', geo: { t: 'ellipse', size: S([8, 8]) }, fill: { color: hex('#00aa00') } } }, H());
  const a2 = b.do({ type: 'geo.set', node: 'D', geo: geo() }, AI());
  b.do({ type: 'pt.nudge', node: 'C', pt: 'c2', d: [0, -1] }, H()); b.do({ type: 'prop.set', node: 'D', path: 'fill.color', value: hex('#0000aa') }, H());
  const r = revertAI(b, [a1.cmd.id, a2.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.cmd, o.result, o.why]), [[a2.cmd.id, 'reverted', undefined], [a1.cmd.id, 'ask', 'kind-edited']]);
  assert.equal(b.doc.nodes.D.geo.t, 'ellipse'); assert.equal(b.doc.nodes.D.fill.color.v.v, '#0000aa'); assert.deepEqual(pt(b, 'C', 'c2').p.v, [0, -5]);
});
test('置きかえの上に人が「足した」（表に無い組）→ 黙って決めずに聞く', () => {
  const b = fixture();
  const a = b.do({ type: 'prop.set', node: 'A', path: 'xf.pos', value: S([100, 100]) }, AI());
  b.do({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [5, 0] }, H());
  const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why, o.choices]), [['ask', 'edited-on-top', ['keep', 'force']]]); assert.deepEqual(b.doc.nodes.A.xf.pos.v, [105, 100]);
});
test('戻すと参照先が無くなる（全体の決まりを破る）→ 当てずに聞く', () => {
  const b = fixture();
  b.do({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'ref', to: { k: 'prop', node: 'C', path: 'xf.rot' } } }, H());
  const a = b.do({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: S(5) }, AI());     // AI：参照をやめて固定に
  b.do({ type: 'node.remove', node: 'C' }, H());                                           // 人：参照先だった物を消した
  const snap = b.snap(); const r = revertAI(b, [a.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why]), [['ask', 'breaks-invariant']]); assert.equal(b.snap(), snap);
});
test('固定（frozen）された物は、選んで取り消すときも変えない → 聞く（固定を外してから）', () => {
  const b = fixture();
  const a1 = b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [10, 0] }, AI()); const a2 = b.do({ type: 'node.rename', node: 'C', name: 'x' }, AI());
  b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'A' }, level: 'frozen' } }, H());
  const r = revertAI(b, [a1.cmd.id, a2.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why]), [['reverted', undefined], ['ask', 'locked']]); assert.deepEqual(pt(b, 'A', 'p1').p.v, [10, 0]);
});
test('AI の1回の作業（まとまり）を戻す：一覧を先に見せ、戻せる所だけ戻り、人の直しは全部残る。その取り消しも取り消せる', () => {
  const b = fixture(); const g = { group: 'job1' };
  b.batch([{ type: 'node.add', node: path('EYE', [['e1', 0, 0], ['e2', 2, 0], ['e3', 1, 2]], { parent: 'G', order: 'x' }) }, { type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#775544') },
    { type: 'pt.nudge', node: 'A', pt: 'p1', d: [-2, -2] }, { type: 'pt.add', node: 'A', pt: { id: 'ai1', p: S([5, -3]) }, after: 'p1' }, { type: 'node.move', node: 'L', parent: null, order: 'b' }, { type: 'prop.set', node: 'B', path: 'geo.round', value: S(6) }], AI(), g);
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [0.5, 0] }, H()); b.do({ type: 'prop.set', node: 'B', path: 'geo.round', value: S(4) }, H()); b.do({ type: 'pt.nudge', node: 'EYE', pt: 'e3', d: [0, 1] }, H()); b.do({ type: 'node.rename', node: 'L', name: 'ひげ' }, H());
  const ids = aiRecordIds(b.s.log, (a) => a.cmd.group === 'job1'); assert.equal(ids.length, 6);
  const before = b.snap(); const r = revertAI(b, ids);
  assert.deepEqual(r.tally, { reverted: 4, noop: 1, ask: 1, kept: 0 });
  assert.deepEqual(pt(b, 'A', 'p1').p.v, [0.5, 0]); assert.equal(b.doc.nodes.B.geo.round.v, 4); assert.deepEqual(pt(b, 'EYE', 'e3').p.v, [1, 3]); assert.equal(b.doc.nodes.L.name, 'ひげ');
  assert.equal(b.doc.nodes.L.parent, 'G'); assert.equal(b.doc.nodes.A.fill.color.v.v, '#336699'); assert.equal(pt(b, 'A', 'ai1'), undefined);
  const u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u1')], H()); b.s = u.state; assert.equal(b.snap(), before, '選んで取り消した結果そのものも取り消せる');
});
test('同じ AI の記録を2回戻しても、2回めは何も起きない', () => {
  const b = fixture(); const a = b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [10, 0] }, AI()); const a2 = b.do({ type: 'node.rename', node: 'A', name: 'x' }, AI());
  revertAI(b, [a.cmd.id, a2.cmd.id]); const snap = b.snap(); const r = revertAI(b, [a2.cmd.id]);
  assert.deepEqual(results(r), ['noop']); assert.equal(b.snap(), snap);
});
test('AI は、人の記録を選んで取り消せない。自分の記録は（度合いが ai なら）戻せる', () => {
  const b = fixture(); const h = b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 1] }, H()); const a = b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [10, 0] }, AI());
  assert.equal(b.try({ type: 'revert', targets: [h.cmd.id] }, AI()).reason, 'forbidden');
  assert.equal(b.try({ type: 'revert', targets: [h.cmd.id] }, AI(), { actor: { k: 'human', device: 'd1' } }).reason, 'forbidden');
  assert.equal(b.try({ type: 'revert', targets: [a.cmd.id] }, AI()).status, 'applied'); assert.deepEqual(pt(b, 'A', 'p1').p.v, [1, 1]);
  b.do({ type: 'mode.set', stage: 'art', mode: 'collab' });
  const a2 = b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [10, 0] }, H(), ACCEPT);
  assert.equal(b.try({ type: 'revert', targets: [a.cmd.id] }, AI()).status, 'proposed');
  void a2;
});

// ───────── 取り消しの鎖：人が自分の直しを取り消した所は「人が直した所」に数えない
test('人が直して、その直しを自分で取り消した → 人の直しは残っていないので、AI の分はふつうに戻る（聞かない）', () => {
  const b = fixture();
  const a1 = b.do({ type: 'pt.add', node: 'A', pt: { id: 'ai1', p: S([5, -3]) }, after: 'p1' }, AI());
  const a2 = b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#ff00ff') }, AI());
  b.do({ type: 'pt.nudge', node: 'A', pt: 'ai1', d: [1, 1] }, H()); let u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u1')], H()); b.s = u.state;
  b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#00ffff') }, H()); u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u2')], H()); b.s = u.state;
  const r = revertAI(b, [a1.cmd.id, a2.cmd.id]);
  assert.deepEqual(results(r), ['reverted', 'reverted']); assert.equal(pt(b, 'A', 'ai1'), undefined); assert.equal(b.doc.nodes.A.fill.color.v.v, '#336699');
});
test('人が直して、取り消して、やり直した → 人の直しは生きているので、聞く／上書き済みになる', () => {
  const b = fixture();
  const a1 = b.do({ type: 'pt.add', node: 'A', pt: { id: 'ai1', p: S([5, -3]) }, after: 'p1' }, AI());
  const a2 = b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#ff00ff') }, AI());
  b.do({ type: 'pt.nudge', node: 'A', pt: 'ai1', d: [1, 1] }, H()); b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#00ffff') }, H());
  for (const mk of [makeUndo, makeUndo, makeRedo, makeRedo]) { const c = mk(b.s.log, 'd1', `x${b.n++}`); assert.ok(c); const u = applyBatch(b.s, [c], H()); assert.equal(u.status, 'applied'); b.s = u.state; }
  const snap = b.snap(); const r = revertAI(b, [a1.cmd.id, a2.cmd.id]);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.why]), [['noop', 'overwritten'], ['ask', 'edited']]); assert.equal(b.snap(), snap);
  assert.deepEqual(pt(b, 'A', 'ai1').p.v, [6, -2]); assert.equal(b.doc.nodes.A.fill.color.v.v, '#00ffff');
});
test('AI の分を戻し、その取り消しを取り消した（＝AI の分が生き返った）あとで、もう一度 AI の分を戻せる。2重には引かない', () => {
  const b = fixture();
  const a = b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [10, 0] }, AI()); b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [0, 5] }, H());
  revertAI(b, [a.cmd.id]); assert.deepEqual(pt(b, 'A', 'p1').p.v, [0, 5]);
  let r = revertAI(b, [a.cmd.id]); assert.deepEqual(r.outcomes.map((o) => [o.result, o.why]), [['noop', 'already']]); assert.deepEqual(pt(b, 'A', 'p1').p.v, [0, 5], '2重に引かない');
  const u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'uu')], H()); b.s = u.state;       // 直前（何も起きなかった取り消し）を取り消す → 何も変わらない
  const u2 = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'uu2')], H()); b.s = u2.state;    // その前（AI の分を戻した取り消し）を取り消す → AI の分が生き返る
  assert.deepEqual(pt(b, 'A', 'p1').p.v, [10, 5]);
  r = revertAI(b, [a.cmd.id]); assert.deepEqual(results(r), ['reverted']); assert.deepEqual(pt(b, 'A', 'p1').p.v, [0, 5]);
});
