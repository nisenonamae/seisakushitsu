// 保存して読みこむ・写し・途中で失敗した場合の立ち直り（P3r の A-2・3・4）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyBatch, canon, logItems, logLength, makeUndo, aiRecordIds, mulberry32,
  toJournal, journalLine, readJournal, repairJournal, GENESIS, docHash, makeSnapshot, readSnapshot, snapshotFits, loadReplay, loadTrusted, loadTail, loadIndexed, open, hydrate, makeInbox, sha256 } from '../src/index.js';
import { createHash } from 'node:crypto';
import { runFuzz, INIT } from '../tools/fuzz.js';

const H = { sender: { k: 'human', device: 'd1' } };
/** でたらめな記録と、まとまりごとの文書の印（k まとまり当てた時の印） */
function world(seed, steps) {
  const prefix = [docHash(createState(INIT).doc)];
  const w = runFuzz(seed, steps, { onApplied: (r) => prefix.push(docHash(r.state.doc)) });
  // 終わりに、取り消しでない素直な操作を3つ足す（写しの試しで「続きに古い記録を相手にする取り消しが無い」場合を作るため）
  for (let i = 1; i <= 3; i++) { const r = applyBatch(w.state, [{ id: `tail-${i}`, v: 1, actor: { k: 'human', device: 'd1' }, base: {}, body: { type: 'node.add', node: { id: `tail${i}`, scene: 's1', kind: 'shape', name: `終わり${i}`, order: 'z' + i, geo: { t: 'rect', size: { k: 'static', v: [1, 1] }, round: { k: 'static', v: 0 } } } } }], H); assert.equal(r.status, 'applied', r.message); w.state = r.state; prefix.push(docHash(r.state.doc)); }
  const j = toJournal(w.state.log); const jf = toJournal(w.state.log, { full: true });
  return { ...w, prefix, lines: j.lines, full: jf.lines, text: j.lines.join(''), hash: docHash(w.state.doc) };
}
const W = world(11, 2500);
/** 同じ取り消し（AI の記録を選んで戻す＋自分の直前の操作を戻す）を当てた結果の印 */
function after(state, fullEntries) {
  const out = []; let s = state; const tryAll = (cmd) => { let r = applyBatch(s, [cmd], H); if (r.status === 'rejected' && r.reason === 'needs-history') { s = hydrate(INIT, s, fullEntries); r = applyBatch(s, [cmd], H); out.push('reach-back'); } out.push(r.status + (r.reason ? ':' + r.reason : '')); s = r.state; if (r.applied) out.push(sha256(canon(r.applied))); };
  const ai = W.aiIds;
  tryAll({ id: 'after-1', v: 1, actor: { k: 'human', device: 'd1' }, body: { type: 'revert', mode: 'units', targets: ai.slice(-40) } });
  tryAll({ id: 'after-2', v: 1, actor: { k: 'human', device: 'd1' }, body: { type: 'revert', mode: 'units', targets: ai.slice(0, 40) } });
  const u = W.undoIds; tryAll({ id: 'after-3', v: 1, actor: { k: 'human', device: 'd1' }, body: { type: 'revert', mode: 'undo', targets: u } });
  out.push(docHash(s.doc)); return out.filter((x) => x !== 'reach-back');
}
W.aiIds = aiRecordIds(W.state.log); W.undoIds = makeUndo(W.state.log, 'd1', 'x').body.targets;

test('SHA-256（素の JavaScript）は、Node の部品と同じ答え', () => {
  for (const s of ['', 'abc', 'あ'.repeat(777), canon(W.state.doc)]) assert.equal(sha256(s), createHash('sha256').update(s).digest('hex'));
});
test('保存して読みこむ：記録だけ／効果つき／写し＋続き／写し＋索引 のどれでも、同じ文書・同じ記録・同じ取り消しの結果', () => {
  const rj = readJournal(JSON.parse(JSON.stringify(W.text))); assert.ok(rj.clean); assert.equal(rj.entries.length, W.lines.length);
  const A = loadReplay(INIT, rj.entries); assert.deepEqual(A.skipped, []); assert.equal(docHash(A.state.doc), W.hash);
  assert.equal(canon(logItems(A.state.log)), canon(logItems(W.state.log)), '効果・版・取り消しの一覧も同じ');
  const rf = readJournal(W.full.join('')); const B = loadTrusted(INIT, rf.entries); assert.equal(docHash(B.state.doc), W.hash); assert.equal(canon(logItems(B.state.log)), canon(logItems(W.state.log)));
  const want = after(W.state, rj.entries); assert.deepEqual(after(A.state, rj.entries), want); assert.deepEqual(after(B.state, rj.entries), want);
  let reach = 0;
  for (const at of [1, 50, Math.floor(rj.entries.length / 2), rj.entries.length - 30, rj.entries.length - 1, rj.entries.length]) {
    const head = loadReplay(INIT, rj.entries.slice(0, at)).state; const text = makeSnapshot(head, at, at ? rj.entries[at - 1].h : GENESIS);
    const snap = readSnapshot(JSON.parse(JSON.stringify(text))); assert.ok(snap && snapshotFits(snap, rj.entries));
    const o = open(INIT, W.text, [text]);                      // 写し＋続き。足りなければ、記録の全部から作り直す
    assert.equal(docHash(o.state.doc), W.hash, `写し ${at}`); if (!o.used) reach++;
    assert.deepEqual(after(o.state, rj.entries), want, `写し ${at}：取り消しの結果`);
    const I = loadIndexed(snap, rf.entries); assert.equal(docHash(I.state.doc), W.hash); assert.equal(canon(logItems(I.state.log)), canon(logItems(W.state.log))); assert.deepEqual(after(I.state, rj.entries), want);
  }
  console.log(`  まとまり ${rj.entries.length}・記録 ${logLength(W.state.log)} 件。写し 6 か所のうち、続きに古い記録を相手にする取り消しがあって全部から作り直した回：${reach}`);
});
test('写しから始めた状態：写しより前の操作を戻す命令は needs-history で断られ、文書は変わらない。古い記録を読み足すと、全部を持つ端末と同じ結果', () => {
  const rj = readJournal(W.text); const tail = 5; const at = rj.entries.length - tail; const head = loadReplay(INIT, rj.entries.slice(0, at)).state;
  const T = loadTail(readSnapshot(makeSnapshot(head, at, rj.entries[at - 1].h)), rj.entries.slice(at)); assert.deepEqual(T.skipped, []);
  const cmd = { id: 'old-1', v: 1, actor: { k: 'human', device: 'd1' }, body: { type: 'revert', mode: 'units', targets: W.aiIds.slice(0, 5) } };
  const r = applyBatch(T.state, [cmd], H); assert.equal(r.status, 'rejected'); assert.equal(r.reason, 'needs-history'); assert.equal(r.state, T.state);
  const full = hydrate(INIT, T.state, rj.entries); const a = applyBatch(full, [cmd], H); const b = applyBatch(W.state, [cmd], H);
  assert.equal(a.status, 'applied'); assert.equal(docHash(a.state.doc), docHash(b.state.doc)); assert.equal(canon(a.applied), canon(b.applied));
});

// ---- 途中で失敗した場合
const okPrefix = (h) => W.prefix.lastIndexOf(h);
test('まとまりの途中で断られる：何も入らない（文書も記録も、行も増えない）', () => {
  let s = W.state; const ids = Object.keys(s.doc.nodes); const id = ids.find((x) => s.doc.nodes[x].xf && s.doc.nodes[x].xf.pos && s.doc.nodes[x].xf.pos.k === 'static'); assert.ok(id);
  const mk = (i, body) => ({ id: `mid-${i}`, v: 1, actor: { k: 'human', device: 'd1' }, base: { ...s.doc.revs }, body });
  const r = applyBatch(s, [mk(1, { type: 'prop.nudge', node: id, path: 'xf.pos', d: [1, 1] }), mk(2, { type: 'prop.nudge', node: id, path: 'xf.pos', d: [2, 2] }), mk(3, { type: 'prop.nudge', node: 'no-such', path: 'xf.pos', d: [1, 1] })], H);
  assert.equal(r.status, 'rejected'); assert.equal(r.at, 2); assert.equal(r.state, s); assert.equal(docHash(r.state.doc), W.hash); assert.equal(toJournal(r.state.log).lines.length, W.lines.length);
});
test('記録に書く途中で切れる：最後の行が、どこで切れても、文書は「最後の1まとまりの前」か「後」。失うのは多くて1まとまり', () => {
  const last = W.lines[W.lines.length - 1]; const headText = W.lines.slice(0, -1).join(''); const n = W.lines.length; let before = 0; let afterN = 0;
  for (let cut = 0; cut <= last.length; cut += cut < 40 || cut > last.length - 40 ? 1 : 17) {
    const o = open(INIT, headText + last.slice(0, cut)); const k = okPrefix(docHash(o.state.doc));
    assert.ok(k === n || k === n - 1, `切れ目 ${cut}：まとまり ${k}`); assert.equal(o.journal.entries.length, k); assert.equal(o.journal.stopped, null);
    if (k === n) afterN++; else before++;
    if (cut > 0 && k === n - 1) assert.deepEqual(o.journal.problems.map((p) => p.why), ['broken']);
  }
  assert.ok(before > 10 && afterN >= 1); // 行末の改行だけ欠けた時は、印が合うので使える
});
test('最後の行が欠ける・同じ行が2回書かれる・半分書かれたあとに書き直される：どれも、どれかのまとまりの後の文書になる', () => {
  const n = W.lines.length; const L = W.lines;
  let o = open(INIT, L.slice(0, -1).join('')); assert.equal(okPrefix(docHash(o.state.doc)), n - 1); assert.ok(o.journal.clean);
  o = open(INIT, [...L.slice(0, 700), L[699], ...L.slice(700)].join('')); assert.equal(docHash(o.state.doc), W.hash); assert.deepEqual(o.journal.problems, [{ line: 701, why: 'duplicate' }]);
  o = open(INIT, [...L, L[n - 1]].join('')); assert.equal(docHash(o.state.doc), W.hash); assert.equal(o.journal.problems[0].why, 'duplicate');
  o = open(INIT, [...L.slice(0, 900), L[900].slice(0, 60) + '\n', ...L.slice(900)].join('')); assert.equal(docHash(o.state.doc), W.hash); assert.deepEqual(o.journal.problems, [{ line: 901, why: 'broken' }]);
  o = open(INIT, [...L.slice(0, 900), L[900].slice(0, 60), ...L.slice(900)].join('')); // 改行なしで切れた所に、続きが書かれた（1行がつぶれる）→ その行は壊れた行。次の行は鎖がつながらないので、そこで止まる
  const k = okPrefix(docHash(o.state.doc)); assert.equal(k, 900); assert.equal(o.journal.stopped.why, 'gap');
  // 立ち直り：使える所までを、きれいな記録に書き直す → もう問題は無い
  const fixed = repairJournal([...L.slice(0, 700), L[699], ...L.slice(700, -1), L[n - 1].slice(0, 33)].join('')); assert.equal(fixed.kept, n - 1);
  const again = readJournal(fixed.lines); assert.ok(again.clean); assert.equal(docHash(loadReplay(INIT, again.entries).state.doc), W.prefix[n - 1]);
});
test('まん中の行が壊れた（1字化けた・1行抜けた・順が入れかわった）：見つけて、そこから先は使わない。手前までの文書は正しい', () => {
  const L = W.lines; const flip = (s, i) => s.slice(0, i) + (s[i] === '1' ? '2' : '1') + s.slice(i + 1);
  for (const [name, lines, k, why] of [
    ['1字化けた', [...L.slice(0, 400), flip(L[400], 40), ...L.slice(401)], 400, 'gap'],
    ['1行抜けた', [...L.slice(0, 400), ...L.slice(401)], 400, 'gap'],
    ['順が入れかわった', [...L.slice(0, 400), L[401], L[400], ...L.slice(402)], 400, 'gap'],
    ['別の歴史の行が混ざった', [...L.slice(0, 400), journalLine(5, 'ffffffffffffffff', H.sender, []).text, ...L.slice(400)], 400, 'fork'],
  ]) { const o = open(INIT, lines.join('')); assert.equal(o.journal.stopped.why, why, name); assert.equal(okPrefix(docHash(o.state.doc)), k, name); }
});
test('写し：書く途中で切れた写し・別の記録の写し・中身が食い違う写しは使わない。記録から同じ文書を作り直せる', () => {
  const rj = readJournal(W.text); const N = rj.entries.length; const at = N - 1; const head = loadReplay(INIT, rj.entries.slice(0, at)).state; const good = makeSnapshot(head, at, rj.entries[at - 1].h);
  const older = makeSnapshot(loadReplay(INIT, rj.entries.slice(0, N - 3)).state, N - 3, rj.entries[N - 4].h);
  for (let cut = 0; cut < good.length - 1; cut += Math.max(1, Math.floor(good.length / 60))) assert.equal(readSnapshot(good.slice(0, cut)), null, `切れ目 ${cut}`);
  let o = open(INIT, W.text, [good.slice(0, good.length >> 1), older]);         // 新しい写しは途中で切れた → 1つ前の写しを使う
  assert.equal(o.used.n, N - 3); assert.deepEqual(o.notes, [{ snapshot: 0, why: 'broken' }]); assert.equal(docHash(o.state.doc), W.hash);
  o = open(INIT, W.text, [good.slice(0, 100)]); assert.equal(o.used, null); assert.equal(docHash(o.state.doc), W.hash);
  const other = makeSnapshot(head, at, 'aaaaaaaaaaaaaaaa'); o = open(INIT, W.text, [other]); assert.equal(o.notes[0].why, 'not-on-this-journal'); assert.equal(docHash(o.state.doc), W.hash);
  // 中身が記録と食い違う写し（印は付け直してある＝書いた側の誤り）。印では見つからないので、突き合わせ（verify）で見つける
  const bad = JSON.parse(good.slice(74)); const id = Object.keys(bad.doc.nodes)[0]; bad.doc.nodes[id].name = '食い違い'; bad.docHash = docHash(bad.doc); const body = JSON.stringify(bad); const badText = `P3R-SNAP ${sha256(body)}\n${body}\n`;
  assert.ok(readSnapshot(badText)); o = open(INIT, W.text, [badText]); assert.ok(o.used, '印だけでは見つからない');
  o = open(INIT, W.text, [badText], { verify: true }); assert.equal(o.used, null); assert.equal(o.notes[0].why, 'differs-from-journal'); assert.equal(docHash(o.state.doc), W.hash);
  const rebuilt = makeSnapshot(loadReplay(INIT, rj.entries.slice(0, at)).state, at, rj.entries[at - 1].h); assert.equal(rebuilt, good, '記録から作り直した写しは、元の写しと1字も違わない');
  // 文書の印を付け直していない化け（保存の途中の化け）は、印で見つかる
  const bad2 = JSON.parse(good.slice(74)); bad2.doc.nodes[id].name = 'x'; const b2 = JSON.stringify(bad2); o = open(INIT, W.text, [`P3R-SNAP ${sha256(b2)}\n${b2}\n`]); assert.equal(o.notes[0].why, 'doc-hash');
});
test('受け口：行がばらばらの順で届いても（重なっても）、番号の順に当てるので、同じ文書・同じ記録', () => {
  const rng = mulberry32(4); const order = W.lines.map((l, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.max(0, i - Math.floor(rng() * 40)); [order[i], order[j]] = [order[j], order[i]]; }
  const box = makeInbox(INIT); let maxWait = 0; for (const i of order) { box.receive(W.lines[i]); if (rng() < 0.05) box.receive(W.lines[i]); maxWait = Math.max(maxWait, box.waiting); }
  assert.equal(box.n, W.lines.length); assert.equal(box.waiting, 0); assert.deepEqual(box.skipped, []); assert.ok(maxWait > 3);
  assert.equal(docHash(box.state.doc), W.hash); assert.equal(canon(logItems(box.state.log)), canon(logItems(W.state.log)));
  const half = makeInbox(INIT); for (const i of order) if (i !== 1200) half.receive(W.lines[i]);     // 1行届いていない → そこで待つ（先へ進まない）
  assert.equal(half.n, 1200); assert.equal(docHash(half.state.doc), W.prefix[1200]); half.receive(W.lines[1200]); assert.equal(docHash(half.state.doc), W.hash);
});
