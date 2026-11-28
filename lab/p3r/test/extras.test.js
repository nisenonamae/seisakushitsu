// 余力の分：語りのトークンと合図（6節）・提案が生きているか（9.7節）
import test from 'node:test';
import assert from 'node:assert/strict';
import { retoken, danglingCues, proposalStatus, lineText, applyBatch, makeUndo } from '../src/index.js';
import { fixture, H, AI, S, hex } from './helpers.js';

test('語りを直す：変わっていないトークンは同じ id のまま。新しい言葉には新しい id', () => {
  const old = [{ id: 't1', text: 'カバは' }, { id: 't2', text: '水の中で' }, { id: 't3', text: '暮らす' }];
  assert.deepEqual(retoken(old, ['カバは', '昼のあいだ', '水の中で', '暮らす'], 'n').map((t) => t.id), ['t1', 'n0', 't2', 't3']);
  assert.deepEqual(retoken(old, ['カバは', '陸で', '暮らす'], 'n').map((t) => t.id), ['t1', 'n0', 't3']);
  assert.deepEqual(retoken(old, ['暮らす', 'カバは'], 'n').map((t) => t.id).filter((x) => x.startsWith('t')).length, 1, '順番が入れかわった言葉は、片方だけ同じ id（もう片方は新しい id）');
  // 同じ言葉が2回出る行：位置で対応する（文字列では区別できない所）
  const dup = [{ id: 'a', text: '水' }, { id: 'b', text: 'と' }, { id: 'c', text: '水' }];
  assert.deepEqual(retoken(dup, ['水', 'と', '水', 'と'], 'n').map((t) => t.id), ['a', 'b', 'c', 'n0']);
  assert.deepEqual(retoken(dup, ['と', '水'], 'n').map((t) => t.id), ['b', 'c']);
});

test('合図はトークンの id を指す。消えたトークンを指す合図は「宙に浮いた合図」。勝手に付け替えず、候補を出す', () => {
  const b = fixture();
  b.do({ type: 'key.retime', node: 'B', path: 'xf.rot', key: 'k1', t: { k: 'cue', cue: { token: 'tk1', edge: 'start' } } });
  b.do({ type: 'key.retime', node: 'B', path: 'xf.rot', key: 'k2', t: { k: 'cue', cue: { token: 'tk2', edge: 'end', offset: 0.2 } } });
  assert.deepEqual(danglingCues(b.s), []);
  const line = b.doc.script.lines[0]; const tokens = retoken(line.tokens, ['カバは', '陸で', '暮らす'], 'x');
  b.do({ type: 'line.edit', line: 'ln1', text: 'カバは陸で暮らす', tokens });
  assert.equal(lineText(b.doc.script.lines[0]), 'カバは陸で暮らす');
  const d = danglingCues(b.s);
  assert.deepEqual(d, [{ node: 'B', path: 'xf.rot', key: 'k2', token: 'tk2', line: 'ln1', candidates: ['tk1', 'tk3'] }]);
  assert.deepEqual(b.doc.nodes.B.xf.rot.keys[1].t.cue.token, 'tk2', '合図そのものは書きかえない');
  assert.deepEqual(b.doc.nodes.B.xf.rot.keys[0].t.cue.token, 'tk1', '残ったトークンへの合図は、そのまま');
  // 語りの直しを取り消すと、合図は元どおり生きる
  const u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u')], H()); b.s = u.state; assert.deepEqual(danglingCues(b.s), []);
  // 行ごと消しても同じ（候補なし）
  b.do({ type: 'line.remove', line: 'ln1' }); assert.deepEqual(danglingCues(b.s).map((x) => [x.key, x.line, x.candidates]), [['k1', 'ln1', []], ['k2', 'ln1', []]]);
});

test('提案が生きているか：reads の物が変わったかだけで決める。関係ない所の直しでは無効にならない', () => {
  const b = fixture(); b.do({ type: 'mode.set', stage: 'art', mode: 'collab' });
  const c1 = b.cmd({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#775544') }, AI());
  const c2 = b.cmd({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [2, 2] }, AI());
  const c3 = b.cmd({ type: 'node.rename', node: 'C', name: '目' }, AI());
  for (const c of [c1, c2, c3]) c.base = { [`node:${c.body.node}`]: b.doc.revs[`node:${c.body.node}`] };
  assert.equal(applyBatch(b.s, [c1], AI()).status, 'proposed', 'collab では文書に入らない');
  const p = { id: 'pr1', commands: [c1, c2, c3], reads: [{ target: 'node:A', rev: b.doc.revs['node:A'] }, { target: 'node:C', rev: b.doc.revs['node:C'] }, { target: 'node:B', rev: b.doc.revs['node:B'] }] };
  const st = () => proposalStatus(b.s, p, H().sender);
  assert.equal(st().status, 'open');
  b.do({ type: 'node.rename', node: 'L', name: '関係ない直し' }); assert.deepEqual([st().status, st().premiseChanged], ['open', false]);
  b.do({ type: 'prop.set', node: 'A', path: 'xf.pos', value: S([1, 1]) });               // reads の物だが、提案が触る道とは重ならない
  assert.deepEqual([st().status, st().changedReads, st().premiseChanged], ['open', ['node:A'], true]);
  b.do({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [1, 0] });                              // 足す量どうしは両方生きる
  assert.equal(st().status, 'open');
  b.do({ type: 'prop.set', node: 'A', path: 'fill.color', value: hex('#000001') });        // 提案が触る道を人が変えた → その命令だけ stale
  assert.deepEqual([st().status, st().commands.map((c) => [c.live, c.reason])], ['partly', [[false, 'conflict'], [true, undefined], [true, undefined]]]);
  b.do({ type: 'key.value', node: 'B', path: 'xf.rot', key: 'k1', v: 3 });                 // 判断に使っただけの物が変わった
  assert.deepEqual(st().changedReads, ['node:A', 'node:B']);
  // 一部だけ採る：生きている命令を、人が核に通す（もう一度ぜんぶの検査を受ける）
  const acc = applyBatch(b.s, [{ ...c2, proposal: 'pr1' }, { ...c3, proposal: 'pr1' }], H()); assert.equal(acc.status, 'applied'); b.s = acc.state;
  assert.deepEqual(b.doc.nodes.A.geo.pts[0].p.v, [3, 2]); assert.equal(b.doc.nodes.C.name, '目');
  assert.equal(applyBatch(b.s, [{ ...c1, proposal: 'pr1' }], H()).reason, 'conflict', '古くなった命令は、採ろうとしても当たらない');
});
