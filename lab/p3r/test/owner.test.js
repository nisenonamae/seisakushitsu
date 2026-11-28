// だれの物か（P3r の B）：5つの情報を別々に持つ。引き取りで変わるのは「今の持ち主」だけ。
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBatch, canon, content, logItems, logLength, makeUndo, makeRedo, planRevert, aiRecordIds, whoOf, ownerOf, creatorOf, makerOf, buildProvenance, originOf, bundles, bundleKey, ledger, logIndexOf,
  toJournal, readJournal, loadReplay, loadTrusted, loadTail, loadIndexed, makeSnapshot, readSnapshot } from '../src/index.js';
import { fixture, H, AI, S, hex, path } from './helpers.js';
import { leavesOf } from '../tools/provenance.js';
import { runFuzz, INIT } from '../tools/fuzz.js';

/** AI の作業 j：部品 N を足して色を付け、今ある丸 C の色も変える。人が N の点を直す。AI の提案（部品 P）を人が採る。人が部品 M を足す */
function scene() {
  const b = fixture();
  const r = b.batch([{ type: 'node.add', node: path('N', [['a', 0, 0], ['b', 5, 0], ['c', 5, 5]]) }, { type: 'prop.set', node: 'N', path: 'fill.color', value: hex('#ff0000') }, { type: 'prop.set', node: 'C', path: 'fill.color', value: hex('#0000ff') }, { type: 'prop.scale', node: 'N', path: 'xf.scale', f: [2] }], AI(), { group: 'j' });
  assert.equal(r.status, 'applied'); const job = r.applied.map((a) => a.cmd.id);
  const h1 = b.do({ type: 'pt.nudge', node: 'N', pt: 'a', d: [1, 1] }, H('d1')).cmd.id;
  const h2 = b.do({ type: 'prop.scale', node: 'N', path: 'xf.scale', f: [1.5] }, H('d1')).cmd.id;
  const p = b.do({ type: 'node.add', node: path('P', [['a', 0, 0], ['b', 1, 0], ['c', 1, 1]]) }, H('d1'), { actor: { k: 'ai', agent: 'w1' }, proposal: 'pr1' }).cmd.id;
  const m = b.do({ type: 'node.add', node: path('M', [['a', 0, 0], ['b', 2, 0], ['c', 2, 2]]) }, H('d2')).cmd.id;
  return { b, job, h1, h2, p, m };
}
const provText = (log) => { const pv = buildProvenance(log); return canon([...pv.prov].map(([t, m]) => [t, [...m].sort((x, y) => (x[0] < y[0] ? -1 : 1))]).sort((x, y) => (x[0] < y[0] ? -1 : 1))); };
const frozen = (b) => ({ creators: canon(Object.keys(b.doc.nodes).sort().map((id) => [id, creatorOf(b.s.log, id)])), prov: provText(b.s.log), makers: canon(logItems(b.s.log).map((a) => [a.cmd.id, makerOf(a), a.sender, bundleKey(a)])), records: canon(logItems(b.s.log)), content: canon(content(b.doc)) });

test('5つの情報：操作の主体・今の持ち主・最初に作った主体・変更の由来・操作のまとまり が、別々に読める', () => {
  const { b, job, h1, h2, p } = scene(); const log = b.s.log; const idx = (id) => logIndexOf(log, id);
  assert.deepEqual(whoOf(log, 'N'), { creator: { by: 'ai:w1', via: 'ai:w1', seq: 7, cmd: job[0] }, owner: 'ai:w1', adopted: null });
  assert.deepEqual(whoOf(log, 'P').creator, { by: 'ai:w1', via: 'human:d1', proposal: 'pr1', seq: 13, cmd: p }, 'AI が作り、人が採った');
  assert.equal(whoOf(log, 'P').owner, 'ai:w1'); assert.equal(whoOf(log, 'M').owner, 'human:d2'); assert.equal(whoOf(log, 'A').owner, 'human:d1');
  const pv = buildProvenance(log);
  // 値の道ごと・点ごとの由来：N の点 a は「AI が置き、人が上に足した」。N の伸ばしは「AI が置き（足した時の値）、AI と人が掛けた」。丸 C の色は AI、位置は人のまま
  let o = originOf(log, pv, ['node', 'N', 'geo', 'pts', 'a', 'p'], idx); assert.equal(o.set.by, 'ai:w1'); assert.deepEqual(o.on.map((x) => [x.cmd, x.by]), [[h1, 'human:d1']]);
  o = originOf(log, pv, ['node', 'N', 'xf', 'scale'], idx); assert.deepEqual(o.on.map((x) => x.by), ['ai:w1', 'human:d1']);
  o = originOf(log, pv, ['node', 'N', 'geo', 'pts', 'b', 'p'], idx); assert.equal(o.set.by, 'ai:w1'); assert.deepEqual(o.on, []);
  assert.equal(originOf(log, pv, ['node', 'C', 'fill', 'color'], idx).set.by, 'ai:w1'); assert.equal(originOf(log, pv, ['node', 'C', 'geo', 'size'], idx).set.by, 'human:d1');
  o = originOf(log, pv, ['node', 'P', 'geo', 'pts', 'a', 'p'], idx); assert.deepEqual([o.set.by, o.set.via, o.set.proposal], ['ai:w1', 'human:d1', 'pr1']);
  // まとまり：AI の作業（task）・提案・人の1回の操作
  const bs = bundles(log); const j = bs.find((x) => x.ids.includes(job[0])); assert.deepEqual([j.kind, j.by, j.ids], ['task', 'ai:w1', job]);
  assert.equal(bs.find((x) => x.ids.includes(p)).key, 'proposal:pr1'); assert.equal(bs.find((x) => x.ids.includes(h2)).kind, 'batch');
});

test('引き取り（node.adopt）：変わるのは「今の持ち主」だけ。最初に作った主体・変更の由来・前の記録・文書の中身は、1字も変わらない', () => {
  const { b, job } = scene(); const f0 = frozen(b); const n0 = logLength(b.s.log);
  assert.equal(b.try({ type: 'node.adopt', node: 'N' }, AI()).reason, 'forbidden', 'AI は引き取れない');
  assert.equal(b.try({ type: 'node.adopt', node: 'M' }, H('d1')).reason, 'invalid', '人の物は、引き取る相手でない（人の物を別の主体の物にする命令は無い）');
  assert.equal(b.try({ type: 'node.adopt', node: 'none' }, H('d1')).reason, 'invalid');
  const a = b.do({ type: 'node.adopt', node: 'N' }, H('d2'));
  assert.deepEqual(a.effects, [{ k: 'own', node: 'N', from: 'ai:w1', to: 'human:d2' }]);
  assert.equal(whoOf(b.s.log, 'N').owner, 'human:d2'); assert.deepEqual(whoOf(b.s.log, 'N').adopted, { by: 'human:d2', seq: a.seq, cmd: a.cmd.id });
  assert.equal(b.try({ type: 'node.adopt', node: 'N' }, H('d1')).reason, 'invalid', 'もう人の物');
  const f1 = frozen(b);
  assert.equal(f1.creators, f0.creators, '最初に作った主体'); assert.equal(f1.prov, f0.prov, '変更の由来'); assert.equal(f1.content, f0.content, '文書の中身');
  assert.equal(canon(logItems(b.s.log).slice(0, n0)), f0.records, '前の記録'); assert.ok(aiRecordIds(b.s.log).includes(job[0]), 'AI の記録は、AI の記録のまま');
  // 提案から採った部品も引き取れる。由来は「AI が作り、人が採った」のまま
  b.do({ type: 'node.adopt', node: 'P' }, H('d1')); assert.equal(whoOf(b.s.log, 'P').owner, 'human:d1'); assert.equal(whoOf(b.s.log, 'P').creator.proposal, 'pr1'); assert.equal(frozen(b).prov, f0.prov);
});

test('引き取ったあとに AI の作業を戻す：引き取った部品は相手にしない（知らせるだけ）。ほかの部品への AI の変更は戻る。引き取りのあとの AI の変更は、ふつうに戻せる', () => {
  const { b, job } = scene();
  let plan = planRevert(b.s, job); assert.deepEqual(plan.units.map((u) => [u.id, u.why, u.offer]), [['part:node:N', 'ai-added-part', ['keep', 'adopt', 'drop']]]); assert.deepEqual(plan.adopted, []);
  b.do({ type: 'node.adopt', node: 'N' }, H('d1'));
  plan = planRevert(b.s, job); assert.deepEqual(plan.units, []); assert.deepEqual(plan.adopted, [{ node: 'N', effects: 3 }]);
  const before = canon(b.doc.nodes.N); const late = b.do({ type: 'prop.set', node: 'N', path: 'stroke.w', value: S(9) }, AI()).cmd.id; const mid = canon(b.doc.nodes.N);
  const r = b.do({ type: 'revert', mode: 'units', targets: job }, H('d1'));
  assert.equal(canon(b.doc.nodes.N), mid, '引き取った部品は、そのまま'); assert.equal(b.doc.nodes.C.fill.color.v.v, '#00aa00', 'ほかの部品への AI の変更は戻る');
  assert.equal(r.outcomes.filter((o) => o.why === 'adopted').length, 3);
  b.do({ type: 'revert', mode: 'units', targets: [late] }, H('d1')); assert.equal(canon(b.doc.nodes.N), before, '引き取りのあとの AI の変更は戻る');
  // AI 自身が自分の作業を戻す時も同じ（引き取った部品には触れない）
  const c = scene(); c.b.do({ type: 'node.adopt', node: 'N' }, H('d1')); const keep = canon(c.b.doc.nodes.N); c.b.do({ type: 'revert', mode: 'units', targets: c.job }, AI()); assert.equal(canon(c.b.doc.nodes.N), keep);
});

test('引き取りそのものの取り消し・やり直し：持ち主が戻る・また進む。作った主体と由来は、ずっと同じ。AI は引き取りを戻せない', () => {
  const { b, job } = scene(); const f0 = frozen(b); const ad = b.do({ type: 'node.adopt', node: 'N' }, H('d1'));
  assert.equal(b.try({ type: 'revert', mode: 'units', targets: [ad.cmd.id] }, AI()).reason, 'forbidden');
  for (let i = 0; i < 50; i++) {
    const u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', `u${i}`)], H('d1')); assert.equal(u.status, 'applied'); b.s = u.state;
    assert.equal(ownerOf(b.s.log, 'N'), 'ai:w1'); assert.equal(planRevert(b.s, job).units.length, 1, '取り消すと、また「AI が足した部品」として出る');
    const r = applyBatch(b.s, [makeRedo(b.s.log, 'd1', `r${i}`)], H('d1')); assert.equal(r.status, 'applied'); b.s = r.state;
    assert.equal(ownerOf(b.s.log, 'N'), 'human:d1'); assert.equal(planRevert(b.s, job).units.length, 0);
    const f = frozen(b); assert.equal(f.creators, f0.creators); assert.equal(f.prov, f0.prov); assert.equal(f.content, f0.content);
  }
  // 選んで戻す（人）でも同じ。引き取りを戻したあとは、もう一度引き取れる
  b.do({ type: 'revert', mode: 'units', targets: [ad.cmd.id] }, H('d2')); assert.equal(ownerOf(b.s.log, 'N'), 'ai:w1', '元の記録を相手にすると、いま生きている引き取り（鎖の最後）が戻る');
  b.do({ type: 'node.adopt', node: 'N' }, H('d2')); assert.equal(ownerOf(b.s.log, 'N'), 'human:d2'); assert.equal(frozen(b).creators, f0.creators); assert.equal(frozen(b).prov, f0.prov);
});

test('由来は、取り消し・やり直しで行って戻る：AI の値を人が置きかえて取り消すと、由来は AI に戻る', () => {
  const { b } = scene(); const log0 = b.s.log; const pv0 = provText(log0);
  b.do({ type: 'prop.set', node: 'N', path: 'fill.color', value: hex('#00ff00') }, H('d1'));
  let o = originOf(b.s.log, buildProvenance(b.s.log), ['node', 'N', 'fill', 'color'], (id) => logIndexOf(b.s.log, id)); assert.equal(o.set.by, 'human:d1');
  const u = applyBatch(b.s, [makeUndo(b.s.log, 'd1', 'u1')], H('d1')); b.s = u.state; assert.equal(provText(b.s.log), pv0);
  const r = applyBatch(b.s, [makeRedo(b.s.log, 'd1', 'r1')], H('d1')); b.s = r.state;
  o = originOf(b.s.log, buildProvenance(b.s.log), ['node', 'N', 'fill', 'color'], (id) => logIndexOf(b.s.log, id)); assert.equal(o.set.by, 'human:d1');
});

test('だれの物かは、記録から計算する：でたらめな記録（引き取り・取り消し入り）を、どの読みこみ方で読んでも同じ帳簿。今ある値の全部に由来がある', () => {
  const w = runFuzz(7, 2500); assert.ok(w.stats.adopt > 5);
  const want = canon(ledger(w.state)); const owners = Object.values(ledger(w.state)).map((x) => x.owner.split(':')[0]); assert.ok(owners.includes('ai') && owners.includes('human'));
  assert.ok(Object.values(ledger(w.state)).some((x) => x.adopted), '引き取った部品が残っている');
  const rj = readJournal(toJournal(w.state.log).lines); const rf = readJournal(toJournal(w.state.log, { full: true }).lines);
  assert.equal(canon(ledger(loadReplay(INIT, rj.entries).state)), want); assert.equal(canon(ledger(loadTrusted(INIT, rf.entries).state)), want);
  const at = rj.entries.length - 1; const head = loadReplay(INIT, rj.entries.slice(0, at)).state; const snap = readSnapshot(makeSnapshot(head, at, rj.entries[at - 1].h));
  assert.equal(canon(snap.led), canon(ledger(head)), '写しに入れた控えは、記録から作り直した物と同じ');
  assert.equal(canon(ledger(loadIndexed(snap, rf.entries).state)), want);
  const T = loadTail(snap, rj.entries.slice(at)); if (!T.skipped.length) assert.equal(canon(ledger(T.state)), want, '写し＋続きだけの端末でも同じ（写しの控えを使う）');
  const pv = buildProvenance(w.state.log); let leaves = 0; let none = 0;
  for (const n of Object.values(w.state.doc.nodes)) for (const a of leavesOf(n)) { leaves++; if (!pv.lookup(a)) none++; }
  assert.ok(leaves > 200); assert.equal(none, 0, '由来の無い値は無い');
});
