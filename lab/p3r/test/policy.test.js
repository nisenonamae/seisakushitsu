// 許しの検査（度合い・許可・固定）。送り主は「確かめられた身元」で決まり、名乗りを偽っても権限は増えない。
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBatch, replay, toEntries, same, logItems } from '../src/index.js';
import { fixture, H, AI, S, hex, path } from './helpers.js';

const NUDGE = { type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 1] };
const COLOR = { type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#123456') };

test('度合い：ai はすぐ入る／collab は提案に回る（文書は変わらない）／human は断る', () => {
  const b = fixture();
  assert.equal(b.try(NUDGE, AI()).status, 'applied');
  b.do({ type: 'mode.set', stage: 'art', mode: 'collab' });
  const s = b.s; let r = b.try(NUDGE, AI());
  assert.equal(r.status, 'proposed'); assert.deepEqual(r.why, ['collab']); assert.equal(b.s, s);
  assert.equal(r.effects.length, 1, '提案にも、核が作った効果の見こみが付く');
  b.do({ type: 'mode.set', stage: 'art', mode: 'human' });
  r = b.try(NUDGE, AI()); assert.equal(r.reason, 'forbidden'); assert.equal(r.detail.why, 'mode-human');
  assert.equal(b.try(NUDGE, H()).status, 'applied', '人はどの度合いでも直せる');
  // 工程は命令の種類から核が決める：絵は human でも、動きは ai のまま
  assert.equal(b.try({ type: 'key.value', node: 'B', path: 'xf.rot', key: 'k1', v: 5 }, AI()).status, 'applied');
  // 場面ごとの上書き
  b.do({ type: 'mode.set', stage: 'art', mode: 'ai', scene: 's1' });
  assert.equal(b.try(NUDGE, AI()).status, 'applied');
});

test('提案に回る命令も、形と全体の決まりの検査は受ける（だめな提案は断る）', () => {
  const b = fixture(); b.do({ type: 'mode.set', stage: 'art', mode: 'collab' });
  assert.equal(b.try({ type: 'pt.nudge', node: 'A', pt: 'nope', d: [1, 1] }, AI()).reason, 'invalid');
  assert.equal(b.try({ type: 'node.move', node: 'G', parent: 'G', order: 'i' }, AI()).reason, 'breaks-invariant');
});

test('許可：不可は断る・提案のみは提案・消すのは許可があっても提案どまり', () => {
  const b = fixture();
  let r = b.try({ type: 'node.remove', node: 'C' }, AI()); assert.equal(r.reason, 'forbidden');
  b.do({ type: 'perms.set', key: 'remove', value: 'allow' });
  r = b.try({ type: 'node.remove', node: 'C' }, AI()); assert.equal(r.status, 'proposed'); assert.ok(r.why.includes('remove')); assert.ok(b.doc.nodes.C);
  b.do({ type: 'perms.set', key: 'write.color', value: 'propose' });
  assert.equal(b.try(COLOR, AI()).status, 'proposed'); assert.equal(b.try(NUDGE, AI()).status, 'applied');
  b.do({ type: 'perms.set', key: 'write.color', value: 'deny' });
  assert.equal(b.try(COLOR, AI()).reason, 'forbidden');
  b.do({ type: 'perms.set', key: 'create', value: 'deny' });
  assert.equal(b.try({ type: 'node.add', node: path('N', [['a', 0, 0]]) }, AI()).reason, 'forbidden');
});

test('AI は度合い・許可・固定を変えられない（許可の cover を allow にしてあっても）', () => {
  const b = fixture(); b.do({ type: 'perms.set', key: 'cover', value: 'allow' });
  b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'C' }, level: 'frozen' } });
  for (const body of [{ type: 'mode.set', stage: 'art', mode: 'ai' }, { type: 'perms.set', key: 'remove', value: 'allow' }, { type: 'lock.remove', lock: 'lk' }, { type: 'lock.add', lock: { id: 'l2', target: { node: 'A' }, level: 'ask' } }]) {
    const r = b.try(body, AI()); assert.equal(r.reason, 'forbidden', body.type);
  }
});

test('固定 frozen：AI も人も断る。人は lock.remove してから直す。親の固定は中身にも効く', () => {
  const b = fixture(); b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'G' }, level: 'frozen', why: '良いと言われた' } });
  for (const who of [AI(), H()]) {
    for (const body of [NUDGE, COLOR, { type: 'node.rename', node: 'G', name: 'x' }, { type: 'node.remove', node: 'A' }, { type: 'node.move', node: 'A', parent: null, order: 'a' },
      { type: 'node.move', node: 'C', parent: 'G', order: 'a' }, { type: 'node.add', node: path('N', [['a', 0, 0]], { parent: 'G' }) }, { type: 'key.value', node: 'B', path: 'xf.rot', key: 'k1', v: 5 }]) {
      const r = b.try(body, who); if (who.sender.k === 'ai' && body.type === 'node.remove') { assert.equal(r.status, 'rejected'); continue; }
      assert.equal(r.reason, 'locked', `${who.sender.k} ${body.type}`); assert.deepEqual(r.detail.locks, ['lk']);
    }
  }
  assert.equal(b.try({ type: 'node.rename', node: 'C', name: '外' }, AI()).status, 'applied', '固定の外は動く');
  b.do({ type: 'lock.remove', lock: 'lk', why: '直す' }); assert.equal(b.try(NUDGE, H()).status, 'applied');
});

test('固定 ask：AI は提案になる。人はそのまま直せる。値の道だけの固定は、ほかの道に効かない', () => {
  const b = fixture(); b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'A', path: 'fill.color' }, level: 'ask' } });
  let r = b.try(COLOR, AI()); assert.equal(r.status, 'proposed'); assert.deepEqual(r.why, ['lock-ask']);
  assert.equal(b.try(NUDGE, AI()).status, 'applied'); assert.equal(b.try(COLOR, H()).status, 'applied');
  b.do({ type: 'lock.add', lock: { id: 'sc', target: { scene: 's1' }, level: 'ask' } });
  assert.equal(b.try(NUDGE, AI()).status, 'proposed');
  r = b.try({ type: 'node.remove', node: 'A' }, H()); assert.equal(r.status, 'applied', '人は ask では止まらない');
});

test('前の段の物を AI が作り替えると、提案に回る', () => {
  const b = new (fixture().constructor)({ scenes: [{ id: 's1', stage: 2 }], stages: { art: 'ai', motion: 'ai' } });
  b.do({ type: 'node.add', node: path('OLD', [['a', 0, 0]], { stage: 1 }) }); b.do({ type: 'node.add', node: path('NOW', [['a', 0, 0]]) });
  assert.equal(b.doc.nodes.NOW.stage, 2);
  const r = b.try({ type: 'pt.nudge', node: 'OLD', pt: 'a', d: [1, 1] }, AI()); assert.equal(r.status, 'proposed'); assert.deepEqual(r.why, ['previous-stage']);
  assert.equal(b.try({ type: 'pt.nudge', node: 'NOW', pt: 'a', d: [1, 1] }, AI()).status, 'applied');
});

test('名乗りを偽っても権限は増えない：AI が actor に「人」と書いても、AI として検査される', () => {
  const b = fixture(); b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'C' }, level: 'ask' } }); b.do({ type: 'mode.set', stage: 'motion', mode: 'human' });
  const fake = { actor: { k: 'human', device: 'd1' } };
  const tries = [[{ type: 'node.remove', node: 'A' }, 'forbidden'], [{ type: 'perms.set', key: 'remove', value: 'allow' }, 'forbidden'], [{ type: 'mode.set', stage: 'motion', mode: 'ai' }, 'forbidden'],
    [{ type: 'lock.remove', lock: 'lk' }, 'forbidden'], [{ type: 'key.value', node: 'B', path: 'xf.rot', key: 'k1', v: 5 }, 'forbidden']];
  for (const [body, reason] of tries) { const r = b.try(body, AI(), fake); assert.equal(r.status, 'rejected', body.type); assert.equal(r.reason, reason, body.type); }
  const r = b.try({ type: 'node.rename', node: 'C', name: 'x' }, AI(), fake); assert.equal(r.status, 'proposed', '固定 ask も、名乗りでは抜けられない');
  // 通った命令の記録には、確かめられた身元が残る（名乗りは参考）
  const a = b.do(NUDGE, AI(), fake); assert.equal(a.sender.k, 'ai'); assert.equal(a.cmd.actor.k, 'human');
  // 逆に、人が AI の提案を採る（actor は ai、送り主は人）のは通る
  assert.equal(b.try({ type: 'node.remove', node: 'A' }, H(), { actor: { k: 'ai', agent: 'w1' }, proposal: 'pr1' }).status, 'applied');
});

test('記録を読むときも同じ検査：核を通さずに足された「許しの外」の命令は、作り直しで当たらない', () => {
  const b = fixture(); b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'A' }, level: 'frozen' } });
  b.do({ type: 'node.rename', node: 'C', name: '正しい記録' }, AI());
  const entries = toEntries(b.s.log); const n = entries.length;
  const forged = (id, body, extra = {}) => ({ id, v: 1, actor: { k: 'human', device: 'd1' }, base: { ...b.doc.revs }, body, ...extra });
  entries.push({ sender: { k: 'ai', agent: 'w1' }, cmds: [forged('f1', NUDGE)] });                                   // 固定された物への AI の変更
  entries.push({ sender: { k: 'ai', agent: 'w1' }, cmds: [forged('f2', { type: 'lock.remove', lock: 'lk' })] });      // 固定を自分で外す
  entries.push({ sender: { k: 'ai', agent: 'w1' }, cmds: [forged('f3', { type: 'node.remove', node: 'C' })] });       // 消す
  entries.push({ sender: { k: 'ai', agent: 'w1' }, cmds: [{ ...forged('f4', { type: 'node.rename', node: 'C', name: 'x' }), effects: [{ k: 'remove', at: ['cover', 'locks'], id: 'lk' }] }] }); // 偽の効果つき
  entries.push({ sender: { k: 'human', device: 'd1' }, cmds: [forged('f5', { type: 'node.rename', node: 'C', name: '人の直し' }, { base: { 'node:C': b.doc.revs['node:C'] + 1 } })] }); // f4 のあとを見ていた
  const rp = replay(b.init, entries);
  assert.deepEqual(rp.skipped.map((s) => [s.entry - n, s.reason]), [[0, 'locked'], [1, 'forbidden'], [2, 'forbidden']]);
  assert.equal(rp.state.doc.cover.locks.length, 1); assert.ok(rp.state.doc.nodes.C); assert.equal(rp.state.doc.nodes.C.name, '人の直し');
  assert.deepEqual(logItems(rp.state.log).find((a) => a.cmd.id === 'f4').effects.map((e) => e.k), ['set'], '偽の効果は使われない');
  const again = replay(b.init, entries); assert.ok(same(again.state.doc, rp.state.doc));
});

test('記録には、当てた時の度合い・許可・固定が残る', () => {
  const b = fixture(); b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'A' }, level: 'ask' } });
  const a = b.do(NUDGE, H()); assert.equal(a.policy.mode, 'ai'); assert.deepEqual(a.policy.locks, ['lk']); assert.match(a.policy.perms, /^[0-9a-f]{8}$/);
  const lock = b.doc.cover.locks[0]; assert.equal(lock.by, 'human:d1'); assert.equal(typeof lock.at, 'number', '固定の「いつ」は時計でなく記録の番号');
});

test('固定を外す命令と直しを、同じまとまりで出してもよい（命令ごとに、その前の表紙で見る）。逆の順は断る', () => {
  const b = fixture(); b.do({ type: 'lock.add', lock: { id: 'lk', target: { node: 'A' }, level: 'frozen' } });
  let r = b.batch([NUDGE, { type: 'lock.remove', lock: 'lk' }]); assert.equal(r.reason, 'locked');
  r = b.batch([{ type: 'lock.remove', lock: 'lk' }, NUDGE]); assert.equal(r.status, 'applied');
  // 固定を付ける命令と同じまとまりの、あとの直しは断る
  r = b.batch([{ type: 'lock.add', lock: { id: 'lk2', target: { node: 'A' }, level: 'frozen' } }, NUDGE]); assert.equal(r.reason, 'locked');
});
