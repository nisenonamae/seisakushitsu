// 部品ごとの取り消しの暫定の仕様（P3r の C）：場合 1〜7 を既定で通す（短い版。全部は node tools/cases.js 100）。端末をまたいだ一致の短い版も。
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from '../tools/scenarios2.js';
import { runCaseDefault, runScaleCase } from '../tools/cases.js';
import { case7, secondRevert } from '../tools/methods.js';
import { runAll } from '../tools/xcheck.js';
import { planRevert } from '../src/index.js';
import { fixture, H, AI, S, hex, path } from './helpers.js';

test('場合 1〜6：既定（残す）で送る。人の直しが壊れた数は、3通りの確かめで 0。形は割れない。AI が足した部品は丸ごと残り、［残す・引き取る・（外す）］が出る', () => {
  let twin = 0; let units = 0;
  for (const name of Object.keys(CASES)) for (let seed = 1; seed <= 8; seed++) { const r = runCaseDefault(name, seed); if (!r) continue; assert.equal(r.failed, undefined, name);
    assert.equal(r.broken1 + r.broken2, 0, name); assert.deepEqual(r.twin.broken, [], name); assert.equal(r.splitGeo + r.splitPart + r.partial + r.invariants + r.degenerate, 0, name); assert.ok(r.offers && r.stillAI, name);
    twin += r.twin.leaves; units += r.units; if (name.startsWith('1 ') || name.startsWith('5c')) assert.equal(r.units, 0, name); if (name.startsWith('5b')) assert.equal(r.dropOffer, 0, '参照されている部品は、外せない（残す・引き取るだけ）'); }
  assert.ok(twin > 100 && units > 100);
});
test('足した場合 S（伸ばしが混ざる）：AI の作業の命令を抜いて流し直した文書と、ぴったり同じ', () => {
  for (let seed = 1; seed <= 15; seed++) { const r = runScaleCase(seed); assert.equal(r.failed, undefined); assert.deepEqual([r.differ, r.broken, r.twin.broken.length, r.units, r.colorSame, r.unplayed], [0, 0, 0, 0, 4, 0]); assert.equal(r.rebuilt, 4); }
});
test('場合7：見たあとに人の直しが増えていたら断る（文書は変わらない）。通った時に壊れた直しは 0。引き取った部品は、2回めに聞かれない', () => {
  let refused = 0; for (let seed = 1; seed <= 10; seed++) for (const late of [0, 3]) { const r = case7(seed, late, 'M1w'); if (!r.drops) continue; assert.equal(r.lost, 0); if (r.status !== 'applied') { refused++; assert.equal(r.reason, 'stale'); assert.equal(r.unchanged, true); } else if (late === 0) assert.equal(r.status, 'applied'); }
  assert.ok(refused > 3);
  let m1 = 0; let m4 = 0; for (let seed = 1; seed <= 8; seed++) { const r = secondRevert('下組みを丸ごと戻す', seed, 5); assert.ok(r.sameDoc); assert.equal(r.m1.broken + r.m4.broken, 0); m1 += r.m1.units; m4 += r.m4.units; } assert.ok(m4 < m1);
});
test('AI は「外す」を選べない。人が外す時は、見た直しの一覧（ack）が要る。AI が足した部品の「AI の分だけ取り除く」は無い（split を付けても、部品は丸ごと残る）', () => {
  const b = fixture(); const r = b.batch([{ type: 'node.add', node: path('N', [['a', 0, 0], ['b', 5, 0], ['c', 5, 5]]) }, { type: 'prop.set', node: 'N', path: 'fill.color', value: hex('#ff0000') }, { type: 'pt.nudge', node: 'N', pt: 'b', d: [1, 0] }], AI(), { group: 'j' }); const ids = r.applied.map((a) => a.cmd.id);
  const h = b.do({ type: 'pt.nudge', node: 'N', pt: 'a', d: [1, 1] }); const plan = planRevert(b.s, ids); const u = plan.units[0]; assert.deepEqual([u.why, u.offer, u.later.map((l) => l.cmd)], ['ai-added-part', ['keep', 'adopt', 'drop'], [h.cmd.id]]);
  assert.equal(b.try({ type: 'revert', mode: 'units', targets: ids, decisions: { [u.id]: 'drop' } }, AI()).reason, 'forbidden');
  assert.equal(b.try({ type: 'revert', mode: 'units', targets: ids, decisions: { [u.id]: 'drop' } }, H()).reason, 'stale', '見た直しの一覧が無い');
  const save = b.s; const before = b.snap();
  for (const extra of [{}, { split: true }]) { b.s = save; b.do({ type: 'revert', mode: 'units', targets: ids, ...extra }, H()); assert.equal(b.snap(), before, '既定：部品は丸ごと残る（色も、AI が動かした点も、そのまま）'); }
  b.s = save; b.do({ type: 'revert', mode: 'units', targets: ids, at: plan.at, decisions: { [u.id]: 'drop' }, ack: { [u.id]: u.later.map((l) => l.seq) } }, H()); assert.equal(b.doc.nodes.N, undefined, '人が、直しの一覧を見たうえで外す');
});
test('端末をまたいだ一致（短い版）：読みこみ方・届く順・写しの有り無しで、同じ文書・同じ記録・同じ取り消しの結果', () => {
  const { sig } = runAll({ seeds: [5], steps: 900 }); let n = 0;
  for (const k of Object.keys(sig)) { const v = sig[k]; if (Array.isArray(v) && v.every((x) => typeof x === 'boolean')) { assert.deepEqual(v, [true, true, true], k); n++; } }
  assert.equal(n, 8); assert.equal(sig.mul_ok, true); assert.equal(sig.mul_replay, true);
});
