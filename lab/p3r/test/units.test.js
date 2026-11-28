// 部品ごとにまとめる取り消し（DATA_MODEL 改訂4の 9.5節 ②③）と、掛ける量（prop.scale／効果 mul）。
//  ・planRevert は文書を変えない　・既定は全部「残す」　・「外す」は、人が ack つきで選んだ時だけ
//  ・単位の中は割らない　・場合 1〜7（BRIEF2.md の A-3）
import test from 'node:test';
import assert from 'node:assert/strict';
import { planRevert, applyBatch, makeUndo, makeRedo, checkInvariants, replay, toEntries, same, canon } from '../src/index.js';
import { humanWorkIntact } from '../tools/oracle.js';
import { fixture, H, AI, S, hex, path } from './helpers.js';

const tri = (id, more = {}) => path(id, [['a', 0, 0], ['b', 6, 0], ['c', 6, 6], ['d', 0, 6]], more);
/** AI の下組み：まとまり X の中に、形 X1・X2・X3（1つのまとまり job） */
function scaffold(b, agent = 'w1', tag = 'X') {
  const r = b.batch([{ type: 'node.add', node: { id: tag, scene: 's1', kind: 'group', name: '下組み', order: 'x' } },
    { type: 'node.add', node: tri(`${tag}1`, { parent: tag, order: 'c' }) }, { type: 'node.add', node: tri(`${tag}2`, { parent: tag, order: 'd' }) },
    { type: 'node.add', node: tri(`${tag}3`, { parent: tag, order: 'e' }) },
    { type: 'prop.set', node: `${tag}2`, path: 'fill.color', value: hex('#123456') }], AI(agent), { group: `job-${tag}` });
  assert.equal(r.status, 'applied', r.message); return r.applied.map((a) => a.cmd.id);
}
/** 計画を作る（文書が変わらないことも見る）*/
function plan(b, ids) { const snap = canon(b.s.doc); const n = b.s.log.n; const p = planRevert(b.s, ids); assert.equal(canon(b.s.doc), snap, '計画は文書を変えない'); assert.equal(b.s.log.n, n); return p; }
/** 部品ごとの取り消しを当てる（人）。記録からの作り直し・全体の決まり・人の直しが残ることも見る */
function revertUnits(b, ids, extra = {}, ctx = H()) {
  const before = b.s; const r = b.try({ type: 'revert', mode: 'units', targets: ids, ...extra }, ctx);
  if (r.status !== 'applied') return r;
  assert.deepEqual(checkInvariants(b.doc), []); assert.ok(r.outcomes.every((o) => o.result !== 'ask'), '部品ごとの方式は、止まって聞かない');
  const rp = replay(b.init, toEntries(b.s.log)); assert.deepEqual(rp.skipped, []); assert.ok(same(rp.state.doc, b.doc), '記録から同じ文書');
  if (!extra.decisions) assert.deepEqual(humanWorkIntact(before, b.s, ids).broken, [], '既定（全部残す）では、人の直しは1つも壊れない');
  return r;
}
const dropAll = (p) => { const decisions = {}; const ack = {}; for (const u of p.units) if (u.choices.includes('drop')) { decisions[u.id] = 'drop'; ack[u.id] = u.later.map((l) => l.seq); } return { at: p.at, decisions, ack }; };
const unit = (p, id) => p.units.find((u) => u.id === id);
const pt = (b, node, id) => b.doc.nodes[node].geo.pts.find((q) => q.id === id);

// ───────── 場合 1〜7
test('場合1 AI が作った部品を、人が変えていない → 単位は 0 個。全部外れる', () => {
  const b = fixture(); const s0 = b.snap(); const ids = scaffold(b);
  const p = plan(b, ids); assert.deepEqual(p.units, []); assert.deepEqual(p.containers, []); assert.equal(p.auto.reverted, 5);
  const r = revertUnits(b, ids); assert.equal(r.status, 'applied'); assert.equal(b.snap(), s0, '下組みの前と同じ');
});

test('場合2 AI が作った部品を、人が一部だけ変えた（点を1つ動かした・色だけ変えた）→ その部品だけ1つの単位で残る。中は割らない', () => {
  const b = fixture(); const ids = scaffold(b);
  b.do({ type: 'pt.nudge', node: 'X2', pt: 'a', d: [1, 1] });                          // 人：X2 の点を1つ
  b.do({ type: 'prop.set', node: 'X3', path: 'fill.color', value: hex('#ff0000') });   // 人：X3 の色だけ
  const p = plan(b, ids);
  assert.deepEqual(p.units.map((u) => [u.id, u.why, u.by, u.choices, u.later.length]).sort(), [['part:node:X2', 'ai-added-part', 'human', ['keep', 'drop'], 1], ['part:node:X3', 'ai-added-part', 'human', ['keep', 'drop'], 1]]);
  assert.deepEqual(p.containers.map((c) => c.id), ['container:node:X'], '入れ物は、選ぶ単位にしない');
  const r = revertUnits(b, ids, { at: p.at }); assert.equal(r.status, 'applied');
  assert.deepEqual(Object.keys(b.doc.nodes).filter((k) => k.startsWith('X')).sort(), ['X', 'X2', 'X3'], '直していない X1 は外れ、入れ物は残る');
  assert.equal(b.doc.nodes.X2.fill.color.v.v, '#123456', 'X2 を残すなら、AI が同じ作業で付けた色もそのまま（途中の値に戻さない）');
  assert.deepEqual(pt(b, 'X2', 'a').p.v, [1, 1]); assert.equal(b.doc.nodes.X3.fill.color.v.v, '#ff0000');
  const rec = b.s.log.store.items[b.s.log.n - 1]; assert.deepEqual(rec.units.map((u) => u.id).sort(), ['part:node:X2', 'part:node:X3'], '残した物は、記録に一覧で残る');
  // そのあと：残した部品を、人が見たうえで外す → 入れ物も空になって外れる
  const p2 = plan(b, ids); const r2 = revertUnits(b, ids, dropAll(p2)); assert.equal(r2.status, 'applied');
  assert.deepEqual(Object.keys(b.doc.nodes).filter((k) => k.startsWith('X')), []);
  // 外したのも取り消せる（人の直しごと戻る）
  const u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'undo1')], H()); assert.equal(u.status, 'applied'); b.s = u.state;
  assert.deepEqual(pt(b, 'X2', 'a').p.v, [1, 1]); assert.equal(b.doc.nodes.X3.fill.color.v.v, '#ff0000');
});

test('場合3 AI が作った部品を、人が大きく変えた（点の大半・形の種類・清書）→ 単位は1つのまま。失われる直しは全部 later に出る', () => {
  const b = fixture(); const ids = scaffold(b);
  for (const q of ['a', 'b', 'c']) b.do({ type: 'pt.nudge', node: 'X1', pt: q, d: [2, -1] });                                                  // 点の大半
  b.do({ type: 'geo.set', node: 'X2', geo: { t: 'ellipse', size: S([9, 9]) } });                                                               // 形の種類
  b.do({ type: 'geo.set', node: 'X3', geo: { t: 'path', closed: true, pts: [{ id: 'a', p: S([0, 0]) }, { id: 'n1', p: S([3, 8]) }, { id: 'c', p: S([6, 6]) }] } }); // 清書
  b.do({ type: 'pt.nudge', node: 'X3', pt: 'n1', d: [1, 0] });
  const p = plan(b, ids);
  assert.deepEqual(p.units.map((u) => [u.id, u.later.length]).sort(), [['part:node:X1', 3], ['part:node:X2', 1], ['part:node:X3', 2]]);
  assert.equal(p.auto.reverted, 0); const snap = b.snap();
  const r = revertUnits(b, ids); assert.equal(r.status, 'applied'); assert.equal(b.snap(), snap, '何も戻らない（全部が、人の直しの乗った部品）');
  assert.deepEqual(r.tally, { reverted: 0, noop: 0, ask: 0, kept: 5 });
});

test('場合4 AI が作った部品に、別の AI の変更が乗った → 黙って壊さない。作業ごとにまとめて知らせ、一緒に戻す相手を返す', () => {
  const b = fixture(); const ids = scaffold(b);
  const o = b.batch([{ type: 'pt.nudge', node: 'X1', pt: 'a', d: [3, 3] }, { type: 'prop.set', node: 'X3', path: 'fill.color', value: hex('#00ff00') }], AI('w2'), { group: 'job-other' });
  assert.equal(o.status, 'applied'); const other = o.applied.map((a) => a.cmd.id);
  const p = plan(b, ids);
  assert.deepEqual(p.units.map((u) => [u.id, u.by]).sort(), [['part:node:X1', 'ai'], ['part:node:X3', 'ai']]);
  assert.deepEqual(p.laterAI.map((t) => [t.task, t.agent, t.units.sort(), t.records.sort()]), [['job-other', 'w2', ['part:node:X1', 'part:node:X3'], other.slice().sort()]]);
  const snap = b.snap(); const r = revertUnits(b, ids); assert.equal(r.status, 'applied');
  assert.deepEqual(pt(b, 'X1', 'a').p.v, [3, 3], 'ほかの AI の作業は残る'); assert.equal(b.doc.nodes.X3.fill.color.v.v, '#00ff00'); assert.ok(!b.doc.nodes.X2);
  // 「一緒に戻す」＝あとの AI の作業も戻す相手に入れて、計画を作り直す → 単位は無くなり、全部外れる
  b.s = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'undo1')], H()).state; assert.equal(b.snap(), snap);
  const p2 = plan(b, [...ids, ...p.laterAI[0].records]); assert.deepEqual(p2.units, []);
  revertUnits(b, [...ids, ...other]); assert.deepEqual(Object.keys(b.doc.nodes).filter((k) => k.startsWith('X')), []);
});

test('場合5a 人が、AI の部品の子として新しい部品を足した → AI のまとまりは単位になる（子の一覧つき）。既定では残り、人の部品は無事', () => {
  const b = fixture(); const ids = scaffold(b);
  const h = b.do({ type: 'node.add', node: tri('HC', { parent: 'X', order: 'k' }) });
  const p = plan(b, ids); const u = unit(p, 'part:node:X');
  assert.deepEqual([u.why, u.children, u.later.map((l) => l.cmd), u.choices], ['ai-added-part', ['HC'], [h.cmd.id], ['keep', 'drop']]);
  revertUnits(b, ids); assert.deepEqual(Object.keys(b.doc.nodes).filter((k) => k.startsWith('X') || k === 'HC').sort(), ['HC', 'X']); assert.equal(b.doc.nodes.HC.parent, 'X');
});
test('場合5b 人が、AI の部品を参照する部品を足した → 単位になり、外す道は出さない（外すと参照が切れる）', () => {
  const b = fixture(); const ids = scaffold(b);
  b.do({ type: 'node.add', node: tri('HR', { order: 'k', xf: { pos: { k: 'ref', to: { k: 'prop', node: 'X1', path: 'xf.pos' } } } }) });
  const p = plan(b, ids); const u = unit(p, 'part:node:X1');
  assert.deepEqual([u.choices, u.refs], [['keep'], ['HR.xf.pos']]);
  const r = b.try({ type: 'revert', mode: 'units', targets: ids, decisions: { 'part:node:X1': 'drop' }, ack: { 'part:node:X1': [] } });
  assert.deepEqual([r.status, r.reason, r.detail.why], ['rejected', 'stale', 'plan-changed'], '外せない単位に「外す」を送ると断る');
  revertUnits(b, ids); assert.ok(b.doc.nodes.X1 && b.doc.nodes.HR && b.doc.nodes.X && !b.doc.nodes.X2 && !b.doc.nodes.X3);
});
test('場合5c 人が、関係のない新しい部品を足した → 単位は 0 個。AI の下組みは全部外れ、人の部品は残る', () => {
  const b = fixture(); const ids = scaffold(b);
  b.do({ type: 'node.add', node: tri('HN', { order: 'k' }) }); b.do({ type: 'pt.nudge', node: 'HN', pt: 'a', d: [1, 1] });
  const p = plan(b, ids); assert.deepEqual(p.units, []);
  revertUnits(b, ids); assert.deepEqual(Object.keys(b.doc.nodes).filter((k) => k.startsWith('X')), []); assert.deepEqual(pt(b, 'HN', 'a').p.v, [1, 1]);
});

test('場合6 人が変えたあと、さらに AI が同じ部品を変えた：あとの AI の分だけ戻す → 値の道ごとに戻る／最初の AI の分を戻す → 部品は残り、あとの AI も知らせる', () => {
  const b = fixture(); const ids = scaffold(b);
  b.do({ type: 'pt.nudge', node: 'X1', pt: 'a', d: [1, 1] });                                                           // 人
  const o = b.batch([{ type: 'pt.nudge', node: 'X1', pt: 'a', d: [10, 0] }, { type: 'pt.nudge', node: 'X1', pt: 'b', d: [0, 5] },
    { type: 'prop.set', node: 'X1', path: 'fill.color', value: hex('#abcdef') }, { type: 'pt.add', node: 'X1', pt: { id: 'z', p: S([3, 3]) }, after: 'a' }], AI('w1'), { group: 'job-2' });
  const second = o.applied.map((a) => a.cmd.id);
  b.do({ type: 'pt.nudge', node: 'X1', pt: 'a', d: [0, 2] });                                                           // 人（あとの AI の上に）
  // あとの AI の分だけ
  let p = plan(b, second); assert.deepEqual(p.units, []); assert.deepEqual(p.auto, { reverted: 3, superseded: 0, subtracted: 1, gone: 0 });
  const save = b.s; revertUnits(b, second);
  assert.deepEqual(pt(b, 'X1', 'a').p.v, [1, 3], '人の2回の直し（+1,+1・0,+2）だけが残る'); assert.deepEqual(pt(b, 'X1', 'b').p.v, [6, 0]); assert.ok(!pt(b, 'X1', 'z')); assert.equal(b.doc.nodes.X1.fill.color.v.v, '#336699');
  // 最初の AI の分（下組み）を戻す
  b.s = save; p = plan(b, ids); const u = unit(p, 'part:node:X1');
  assert.equal(u.by, 'both'); assert.equal(u.later.length, 6, '人の直し 2 件＋あとの AI の 4 件'); assert.deepEqual(p.laterAI.map((t) => t.task), ['job-2']);
  const snap = canon(b.doc.nodes.X1); revertUnits(b, ids); assert.equal(canon(b.doc.nodes.X1), snap, 'X1 はそのまま'); assert.ok(!b.doc.nodes.X2 && !b.doc.nodes.X3 && b.doc.nodes.X);
});

test('場合7 確認の画面を見たあと、実行の前に人の変更が増えた → 「外す」は断られ（stale）、増えた直しを返す。人の変更は壊れない', () => {
  const b = fixture(); const ids = scaffold(b);
  b.do({ type: 'pt.nudge', node: 'X2', pt: 'a', d: [1, 1] });
  const p = plan(b, ids); const answer = dropAll(p); assert.deepEqual(Object.keys(answer.decisions), ['part:node:X2']);
  const late = b.do({ type: 'prop.set', node: 'X2', path: 'fill.color', value: hex('#fedcba') }, H('d2'));   // 画面を見ている間に、別の端末で
  const late2 = b.do({ type: 'pt.nudge', node: 'X1', pt: 'b', d: [4, 4] }, H('d2'));                         // 計画では「全部外れる」はずだった X1 にも
  const snap = b.snap(); const n = b.s.log.n;
  const r = b.try({ type: 'revert', mode: 'units', targets: ids, ...answer });
  assert.deepEqual([r.status, r.reason, r.detail.why, r.detail.unit, r.detail.unseen.map((l) => l.cmd)], ['rejected', 'stale', 'unseen-edits', 'part:node:X2', [late.cmd.id]]);
  assert.equal(b.snap(), snap, '文書は変わらない'); assert.equal(b.s.log.n, n);
  // 計画を作り直す：X1 も単位になっている。見直して送れば通る
  const p2 = plan(b, ids); assert.deepEqual(p2.units.map((u) => u.id).sort(), ['part:node:X1', 'part:node:X2']); assert.deepEqual(unit(p2, 'part:node:X1').later.map((l) => l.cmd), [late2.cmd.id]);
  // 既定（残す）で送る分には、断られない。あとから入った直しのある X1 は、当てる時の作り直しで「残す」に回る
  const r2 = revertUnits(b, ids, { at: p.at }); assert.equal(r2.status, 'applied');
  assert.deepEqual(pt(b, 'X1', 'b').p.v, [10, 4]); assert.equal(b.doc.nodes.X2.fill.color.v.v, '#fedcba'); assert.ok(!b.doc.nodes.X3);
});

// ───────── 安全の決まり（9.5節③）
test('AI は「外す」を選べない（forbidden）。既定（全部残す）の取り消しは出せる。古い方式の force・root も AI には選べない', () => {
  const b = fixture(); const ids = scaffold(b); b.do({ type: 'pt.nudge', node: 'X2', pt: 'a', d: [1, 1] });
  const p = plan(b, ids); const snap = b.snap();
  let r = b.try({ type: 'revert', mode: 'units', targets: ids, ...dropAll(p) }, AI());
  assert.deepEqual([r.status, r.reason, r.detail.why], ['rejected', 'forbidden', 'revert-drop-ai']); assert.equal(b.snap(), snap);
  r = b.try({ type: 'revert', mode: 'select', targets: ids, decisions: { [`${ids[2]}#0`]: 'force' } }, AI());
  assert.deepEqual([r.status, r.reason], ['rejected', 'forbidden']); assert.equal(b.snap(), snap);
  // 名乗りだけ人にしても通らない（送り主は AI）
  r = applyBatch(b.s, [{ ...b.cmd({ type: 'revert', mode: 'units', targets: ids, ...dropAll(p) }, H()) }], AI()); assert.equal(r.status, 'rejected'); assert.equal(r.reason, 'forbidden');
  r = revertUnits(b, ids, {}, AI()); assert.equal(r.status, 'applied'); assert.ok(b.doc.nodes.X2 && !b.doc.nodes.X1, 'AI の既定の取り消し：戻せる分だけ戻り、人の直しのある部品は残る');
  // AI は、人の記録を戻せない（前からの決まり）
  const h = b.do({ type: 'node.rename', node: 'A', name: '人の名前' }); r = b.try({ type: 'revert', mode: 'units', targets: [h.cmd.id] }, AI()); assert.deepEqual([r.status, r.reason], ['rejected', 'forbidden']);
});
test('度合いが Collaborative なら、AI の取り消しは提案に回る（文書は変わらない）', () => {
  const b = fixture(); const ids = scaffold(b); b.do({ type: 'mode.set', stage: 'art', mode: 'collab' }); const snap = b.snap();
  const r = b.try({ type: 'revert', mode: 'units', targets: ids }, AI()); assert.equal(r.status, 'proposed'); assert.equal(b.snap(), snap);
});
test('ack が無い・足りない「外す」は断る。知らない単位への「外す」は、何も外さない', () => {
  const b = fixture(); const ids = scaffold(b); b.do({ type: 'pt.nudge', node: 'X2', pt: 'a', d: [1, 1] }); b.do({ type: 'pt.nudge', node: 'X2', pt: 'b', d: [1, 1] });
  const p = plan(b, ids); const snap = b.snap();
  let r = b.try({ type: 'revert', mode: 'units', targets: ids, decisions: { 'part:node:X2': 'drop' } }); assert.deepEqual([r.status, r.reason, r.detail.unseen.length], ['rejected', 'stale', 2]);
  r = b.try({ type: 'revert', mode: 'units', targets: ids, decisions: { 'part:node:X2': 'drop' }, ack: { 'part:node:X2': [p.units[0].later[0].seq] } }); assert.deepEqual([r.status, r.reason, r.detail.unseen.length], ['rejected', 'stale', 1]);
  assert.equal(b.snap(), snap);
  r = b.try({ type: 'revert', mode: 'units', targets: ids, decisions: { 'part:node:A': 'drop', 'part:node:ghost': 'drop' }, ack: {} }); assert.equal(r.status, 'applied');
  assert.ok(b.doc.nodes.A && b.doc.nodes.X2, '人の部品 A も、直しのある X2 も残る');
  r = b.try({ type: 'revert', mode: 'units', targets: ids, at: 99999 }); assert.deepEqual([r.status, r.reason], ['rejected', 'invalid']);
  r = b.try({ type: 'revert', mode: 'units', targets: ids, decisions: { 'part:node:X2': 'force' } }); assert.deepEqual([r.status, r.reason], ['rejected', 'invalid']);
});
test('固定（frozen）された部品は、単位「固定されている」になり、選べない。人が「外す」を送っても変わらない', () => {
  const b = fixture(); const ids = scaffold(b); b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'X1' }, level: 'frozen' } });
  const p = plan(b, ids); const u = unit(p, 'frozen:node:X1'); assert.deepEqual([u.why, u.choices], ['frozen', ['keep']]);
  let r = b.try({ type: 'revert', mode: 'units', targets: ids, decisions: { 'frozen:node:X1': 'drop' }, ack: { 'frozen:node:X1': [] } }); assert.deepEqual([r.status, r.reason], ['rejected', 'stale']);
  r = revertUnits(b, ids); assert.equal(r.status, 'applied'); assert.ok(b.doc.nodes.X1 && b.doc.nodes.X && !b.doc.nodes.X2);
  // 固定を外してからなら、戻せる
  b.do({ type: 'lock.remove', lock: 'lk' }); revertUnits(b, ids); assert.ok(!b.doc.nodes.X1 && !b.doc.nodes.X);
});
test('打ち消し合った取り消しの組は「その後に起きたこと」に数えない。やり直したら、また数える', () => {
  const b = fixture(); const ids = scaffold(b);
  b.do({ type: 'pt.nudge', node: 'X2', pt: 'a', d: [1, 1] });
  b.s = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u1')], H()).state;
  assert.deepEqual(plan(b, ids).units, [], '直して、取り消した → 単位にならない');
  b.s = applyBatch(b.s, [makeRedo(b.s.log, 'd1', 'r1')], H()).state;
  assert.deepEqual(plan(b, ids).units.map((u) => u.id), ['part:node:X2'], 'やり直した → また数える');
});

// ───────── 単位の中は割らない
test('今ある部品に AI が足した点：1つでも人が直していたら、同じ作業が足した点は全部残す。外すなら全部外す。ほかの値（色）は道ごとに戻る', () => {
  const b = fixture();
  const o = b.batch([{ type: 'pt.add', node: 'A', pt: { id: 'z1', p: S([1, 1]) }, after: 'p1' }, { type: 'pt.add', node: 'A', pt: { id: 'z2', p: S([2, 2]) }, after: 'p2' }, { type: 'pt.add', node: 'A', pt: { id: 'z3', p: S([3, 3]) }, after: 'p3' },
    { type: 'pt.nudge', node: 'A', pt: 'z3', d: [0.5, 0] }, { type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#00ffff') }, { type: 'pt.nudge', node: 'A', pt: 'p1', d: [-1, 0] }], AI(), { group: 'smooth' });
  const ids = o.applied.map((a) => a.cmd.id);
  const h = b.do({ type: 'pt.nudge', node: 'A', pt: 'z2', d: [0, 9] });
  const p = plan(b, ids); const u = unit(p, 'items:node:A:geo.pts');
  assert.deepEqual([u.why, u.effects.length, u.later.map((l) => l.cmd), u.choices], ['ai-added-items', 5, [h.cmd.id], ['keep', 'drop']], '点 3 つ＋AI が自分の点を動かした分＋今ある点 p1 を動かした分（P3r の既定＝同じ形への変更も一緒に残す）＝5つの効果が1つの単位');
  const save = b.s; revertUnits(b, ids);
  assert.deepEqual(b.doc.nodes.A.geo.pts.map((q) => q.id), ['p1', 'z1', 'p2', 'z2', 'p3', 'z3'], '点は全部残る'); assert.deepEqual(pt(b, 'A', 'z3').p.v, [3.5, 3]);
  assert.equal(b.doc.nodes.A.fill.color.v.v, '#336699', '色は単位に入らない：道ごとに戻る'); assert.deepEqual(pt(b, 'A', 'p1').p.v, [-1, 0], 'P3r の既定：今ある点を AI が動かした分は、足した点と一緒に残る（形を割らない）');
  b.s = save; revertUnits(b, ids, dropAll(p)); assert.deepEqual(b.doc.nodes.A.geo.pts.map((q) => q.id), ['p1', 'p2', 'p3'], '外すなら全部');
});
test('だれも直していなければ、AI が足した点は全部外れる（単位は出ない）', () => {
  const b = fixture(); const o = b.batch([{ type: 'pt.add', node: 'A', pt: { id: 'z1', p: S([1, 1]) }, after: 'p1' }, { type: 'pt.add', node: 'A', pt: { id: 'z2', p: S([2, 2]) }, after: 'p2' }], AI());
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p2', d: [0, 9] }); const ids = o.applied.map((a) => a.cmd.id);
  assert.deepEqual(plan(b, ids).units, []); revertUnits(b, ids); assert.deepEqual(b.doc.nodes.A.geo.pts.map((q) => q.id), ['p1', 'p2', 'p3']); assert.deepEqual(pt(b, 'A', 'p2').p.v, [10, 9]);
});
test('種類を変えた（固定→鍵）あと、人が鍵を直した → 部品ごとに1つの単位。同じ作業があとから変えた鍵の値も、途中の値に戻さない', () => {
  const b = fixture();
  const o = b.batch([{ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'keys', keys: [{ id: 'm1', t: { k: 'sec', s: 0 }, v: 0 }, { id: 'm2', t: { k: 'sec', s: 1 }, v: 30 }] } },
    { type: 'key.value', node: 'A', path: 'xf.rot', key: 'm2', v: 60 }, { type: 'prop.kind', node: 'A', path: 'xf.pos', value: { k: 'keys', keys: [{ id: 'n1', t: { k: 'sec', s: 0 }, v: [0, 0] }] } }], AI(), { group: 'animate' });
  const ids = o.applied.map((a) => a.cmd.id);
  b.do({ type: 'key.value', node: 'A', path: 'xf.rot', key: 'm1', v: -10 });
  const p = plan(b, ids); const u = unit(p, 'kind:node:A'); assert.deepEqual([u.why, u.effects.length, u.choices], ['kind-changed', 2, ['keep', 'drop']]);
  revertUnits(b, ids);
  assert.deepEqual(b.doc.nodes.A.xf.rot.keys.map((k) => k.v), [-10, 60], '回転の鍵は、人の値も AI の 60 も、そのまま'); assert.deepEqual(b.doc.nodes.A.xf.pos, S([0, 0]), '位置の方は、だれも直していないので戻る');
});
test('AI が足した部品に、同じ作業で付けた動き（鍵）を人が直した → 部品ごとの単位が、ほかの単位を飲みこむ（1つの部品に単位は1つ）', () => {
  const b = fixture(); const ids = scaffold(b);
  const o = b.batch([{ type: 'prop.kind', node: 'X2', path: 'xf.rot', value: { k: 'keys', keys: [{ id: 'm1', t: { k: 'sec', s: 0 }, v: 0 }] } }], AI(), { group: 'job-X' });
  b.do({ type: 'key.value', node: 'X2', path: 'xf.rot', key: 'm1', v: 5 });
  const all = [...ids, o.applied[0].cmd.id]; const p = plan(b, all);
  assert.deepEqual(p.units.map((u) => [u.id, u.effects.length]), [['part:node:X2', 3]]);
  revertUnits(b, all, dropAll(p)); assert.ok(!b.doc.nodes.X2 && !b.doc.nodes.X, '外すと、部品ごと・入れ物ごと外れる');
});

// ───────── 掛ける量（prop.scale／mul）と、9.5節①の表の足した行
test('prop.scale：比も結果も格子に丸める。0 は断る。鍵のある値には使えない', () => {
  const b = fixture();
  b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [1.23456789, -1] }); assert.deepEqual(b.doc.nodes.A.xf.scale.v, [1.2346, -1]);
  const e = b.s.log.store.items[b.s.log.n - 1].effects[0]; assert.deepEqual([e.k, e.f, e.before, e.after], ['mul', [1.2346, -1], [1, 1], [1.2346, -1]]);
  for (const f of [[0], [0.00004], [1, 0], [NaN], [1, 2, 3], []]) { const r = b.try({ type: 'prop.scale', node: 'A', path: 'xf.scale', f }); assert.deepEqual([r.status, r.reason], ['rejected', 'invalid'], JSON.stringify(f)); }
  let r = b.try({ type: 'prop.scale', node: 'B', path: 'xf.rot', f: [2] }); assert.equal(r.reason, 'invalid', '鍵のある値');
  r = b.try({ type: 'prop.scale', node: 'A', path: 'fill.color', f: [2] }); assert.equal(r.reason, 'invalid', '色');
  r = b.try({ type: 'prop.scale', node: 'A', path: 'xf.rot', f: [2, 2] }); assert.equal(r.reason, 'invalid', '数に2つの比');
});
test('丸め方：ちょうど半分は 0 から遠い方へ（正も負も同じ大きさになる）', () => {
  const b = fixture();
  b.do({ type: 'prop.set', node: 'A', path: 'xf.pos', value: S([0.5, -0.5]) }); b.do({ type: 'prop.scale', node: 'A', path: 'xf.pos', f: [0.0001] });
  assert.deepEqual(b.doc.nodes.A.xf.pos.v, [0.0001, -0.0001], '0.00005 → 0.0001、-0.00005 → -0.0001');
});
test('行6 mul・そのまま → before にぴったり戻る（丸めで情報が落ちる比でも）', () => {
  const b = fixture(); b.do({ type: 'prop.set', node: 'A', path: 'xf.scale', value: S([0.0007, 123.4567]) });
  const a = b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [0.3333, 0.0001] }, AI()); assert.deepEqual(b.doc.nodes.A.xf.scale.v, [0.0002, 0.0123]);
  b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#101010') });
  const p = plan(b, [a.cmd.id]); assert.deepEqual([p.units, p.auto.reverted], [[], 1]); revertUnits(b, [a.cmd.id]);
  assert.deepEqual(b.doc.nodes.A.xf.scale.v, [0.0007, 123.4567]);
});
test('行7 mul・人も掛けている → AI の分だけ割る（結果は格子に丸める）。人の分は残る', () => {
  const b = fixture(); const a = b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [2, 4] }, AI());
  b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [1.5, -1] });
  const p = plan(b, [a.cmd.id]); assert.deepEqual(p.auto, { reverted: 0, superseded: 0, subtracted: 1, gone: 0 }); revertUnits(b, [a.cmd.id]);
  assert.deepEqual(b.doc.nodes.A.xf.scale.v, [1.5, -1]);
  // その取り消しを取り消すと、割る前にぴったり戻る
  b.s = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u1')], H()).state; assert.deepEqual(b.doc.nodes.A.xf.scale.v, [3, -4]);
});
test('行8 mul・人が同じ所を置きかえた → 何もしない（上書き済み）／行5 delta・人が置きかえた → 何もしない', () => {
  const b = fixture(); const a = b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [2] }, AI()); const a2 = b.do({ type: 'prop.nudge', node: 'A', path: 'xf.rot', d: [30] }, AI());
  b.do({ type: 'prop.set', node: 'A', path: 'xf.scale', value: S([7, 7]) }); b.do({ type: 'prop.set', node: 'A', path: 'xf.rot', value: S(5) });
  const p = plan(b, [a.cmd.id, a2.cmd.id]); assert.deepEqual([p.units, p.auto.superseded], [[], 2]); revertUnits(b, [a.cmd.id, a2.cmd.id]);
  assert.deepEqual([b.doc.nodes.A.xf.scale.v, b.doc.nodes.A.xf.rot.v], [[7, 7], 5]);
});
test('行9 delta・mul のあと、人が値の種類を変えた（固定 → 鍵）→ 残す（選べない）', () => {
  const b = fixture(); const a = b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [2] }, AI()); const a2 = b.do({ type: 'prop.nudge', node: 'A', path: 'xf.rot', d: [30] }, AI());
  b.do({ type: 'prop.kind', node: 'A', path: 'xf.scale', value: { k: 'keys', keys: [{ id: 'm1', t: { k: 'sec', s: 0 }, v: [2, 2] }] } });
  b.do({ type: 'prop.kind', node: 'A', path: 'xf.rot', value: { k: 'keys', keys: [{ id: 'm2', t: { k: 'sec', s: 0 }, v: 30 }] } });
  const p = plan(b, [a.cmd.id, a2.cmd.id]); const u = unit(p, 'kind:node:A'); assert.deepEqual([u.why, u.effects.length, u.choices, u.later.length], ['kind-changed', 2, ['keep'], 2]);
  const snap = b.snap(); revertUnits(b, [a.cmd.id, a2.cmd.id]); assert.equal(b.snap(), snap);
});
test('行3 置きかえの上に、人が足した・掛けた → 残す（差し引きが 0 でも、核は決めない）。人が選べば、直しごと元の値へ', () => {
  const b = fixture(); const a = b.do({ type: 'prop.set', node: 'A', path: 'xf.pos', value: S([100, 100]) }, AI()); const a2 = b.do({ type: 'prop.set', node: 'A', path: 'xf.scale', value: S([2, 2]) }, AI());
  b.do({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [5, 0] }); b.do({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [-5, 0] }); b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [1.5] });
  const ids = [a.cmd.id, a2.cmd.id]; const p = plan(b, ids); const u = unit(p, 'built:node:A');
  assert.deepEqual([u.why, u.effects.length, u.later.length, u.choices], ['built-on', 2, 3, ['keep', 'drop']]);
  const save = b.s; revertUnits(b, ids); assert.deepEqual([b.doc.nodes.A.xf.pos.v, b.doc.nodes.A.xf.scale.v], [[100, 100], [3, 3]]);
  b.s = save; revertUnits(b, ids, dropAll(p)); assert.deepEqual([b.doc.nodes.A.xf.pos.v, b.doc.nodes.A.xf.scale.v], [[0, 0], [1, 1]]);
});
test('表に無い組：足した量の上に掛けた／掛けた量の上に足した → 残す（選べない）', () => {
  const b = fixture(); const a = b.do({ type: 'prop.nudge', node: 'C', path: 'geo.size', d: [2, 2] }, AI()); b.do({ type: 'prop.scale', node: 'C', path: 'geo.size', f: [3] });
  const a2 = b.do({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [2] }, AI()); b.do({ type: 'prop.nudge', node: 'A', path: 'xf.scale', d: [0.5, 0.5] });
  const p = plan(b, [a.cmd.id, a2.cmd.id]);
  assert.deepEqual(p.units.map((u) => [u.id, u.why, u.detail, u.choices]).sort(), [['built:node:A', 'built-on', ['added-on-top'], ['keep']], ['built:node:C', 'built-on', ['scaled-on-top'], ['keep']]]);
  const snap = b.snap(); revertUnits(b, [a.cmd.id, a2.cmd.id]); assert.equal(b.snap(), snap); assert.deepEqual(b.doc.nodes.C.geo.size.v, [30, 30]);
});
test('行13 外した物の入れ物が無い・置きかわった → 残す（戻せないと知らせる。選べない）', () => {
  const b = fixture();
  const a1 = b.do({ type: 'pt.remove', node: 'A', pt: 'p2' }, H(), { actor: { k: 'ai', agent: 'w1' }, proposal: 'pr1' });
  const a2 = b.do({ type: 'key.remove', node: 'B', path: 'xf.rot', key: 'k1' }, AI());
  const a3 = b.do({ type: 'node.remove', node: 'L' }, H(), { actor: { k: 'ai', agent: 'w1' }, proposal: 'pr2' });
  b.do({ type: 'geo.set', node: 'A', geo: { t: 'ellipse', size: S([5, 5]) } }); b.do({ type: 'prop.kind', node: 'B', path: 'xf.rot', value: S(0) }); b.do({ type: 'node.remove', node: 'G' });
  const ids = [a1.cmd.id, a2.cmd.id, a3.cmd.id]; const p = plan(b, ids);
  assert.ok(p.units.length >= 1 && p.units.every((u) => u.why === 'cannot-restore' && u.choices.length === 1), JSON.stringify(p.units.map((u) => [u.id, u.why, u.choices])));
  const snap = b.snap(); revertUnits(b, ids); assert.equal(b.snap(), snap);
});
test('行16・17 種類を変えた（清書）：そのままなら before に戻る／清書のあとの点を人が直したら残す', () => {
  const b = fixture(); const geo = { t: 'path', closed: true, pts: [{ id: 'p1', p: S([0, 0]) }, { id: 'n1', p: S([5, 9]) }, { id: 'p3', p: S([10, 10]) }] };
  const before = canon(b.doc.nodes.A.geo); const a = b.do({ type: 'geo.set', node: 'A', geo }, AI());
  b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#222222') });
  const save = b.s; assert.deepEqual(plan(b, [a.cmd.id]).units, []); revertUnits(b, [a.cmd.id]); assert.equal(canon(b.doc.nodes.A.geo), before); assert.equal(b.doc.nodes.A.fill.color.v.v, '#222222');
  b.s = save; b.do({ type: 'pt.nudge', node: 'A', pt: 'n1', d: [1, 1] });
  const p = plan(b, [a.cmd.id]); assert.deepEqual(p.units.map((u) => [u.id, u.why, u.choices]), [['kind:node:A', 'kind-changed', ['keep', 'drop']]]);
  revertUnits(b, [a.cmd.id]); assert.deepEqual(pt(b, 'A', 'n1').p.v, [6, 10]);
});
test('行19 もう戻してある → 何もしない（2回めの取り消しは空）', () => {
  const b = fixture(); const ids = scaffold(b); revertUnits(b, ids); const snap = b.snap();
  const r = revertUnits(b, ids); assert.equal(r.tally.reverted, 0); assert.equal(b.snap(), snap);
});
test('戻すと全体の決まりを破る（人の式が、AI の足した点を見ている）→ 並びの単位ごと残す', () => {
  const b = fixture();
  const o = b.batch([{ type: 'pt.add', node: 'A', pt: { id: 'z1', p: S([1, 1]) }, after: 'p1' }, { type: 'pt.add', node: 'A', pt: { id: 'z2', p: S([2, 2]) }, after: 'p2' }], AI()); const ids = o.applied.map((a) => a.cmd.id);
  b.do({ type: 'prop.kind', node: 'C', path: 'xf.pos', value: { k: 'ref', to: { k: 'prop', node: 'A', path: 'geo.pts.z1.p' } } });
  const p = plan(b, ids); assert.equal(p.units.length, 1); assert.deepEqual(p.units[0].choices, ['keep']);
  revertUnits(b, ids); assert.deepEqual(b.doc.nodes.A.geo.pts.map((q) => q.id), ['p1', 'z1', 'p2', 'z2', 'p3'], '参照されていない z2 も、同じ単位なので残る');
});
