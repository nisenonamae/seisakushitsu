// 追加の検証（BRIEF2 の 1）：速くした核（src）と、前回の核（src0＝コミット c6d8832 の src の写し）が、1字も違わない答えを出すこと。
// 同じ命令の並びを両方に流して、まとまりごとの結果（通った・断られた理由）と、記録の全部（効果・取り消しの結果の一覧・版）と、文書を比べる。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as NEW from '../src/index.js';
import * as OLD from '../src0/index.js';
import { _step1 } from '../src/revert.js';
import { runFuzz, INIT } from '../tools/fuzz.js';

const DBG = {}; process.on('exit', () => { if (process.env.DBG) console.error(DBG); });
const { canon, mulberry32, scaleV, toGrid, GRID } = NEW;
test('数1つの掛け算・足し算：速い計算（53 ビットの中）が、桁の長い整数の計算（scaleV）と同じ', () => {
  const rng = mulberry32(5); let big = 0;
  for (let i = 0; i < 400000; i++) {
    const mag = [1e-4, 1, 1e3, 1e6, 1e9, 3e11][i % 6]; const x = (rng() * 2 - 1) * mag; const f = [0.5, 0.8, 1.25, 2, -1, 0.3333, 3, 0.0001, 12345.6789, -0.9999, 1e5][i % 11] * (i % 7 === 0 ? rng() * 3 : 1);
    const xs = i % 5 === 0 ? Math.round(x * 2e4) / 2e4 : x;   // ちょうど半分の値も混ぜる
    assert.ok(Object.is(_step1(xs, toGrid(f), 1), scaleV(xs, [f], false)), `${xs} × ${f}`);
    if (Math.abs(toGrid(xs)) * Math.abs(toGrid(f)) > 9007199254740991) big++;
    const d = (rng() * 2 - 1) * 100; const want = (toGrid(xs) + toGrid(d)) / GRID; assert.ok(Object.is(_step1(xs, toGrid(d), 0), want === 0 ? 0 : want));
  }
  assert.ok(big > 1000, '53 ビットを超える場合も通っている');
});

for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 21, 22, 23, 24]) {
  test(`でたらめな記録（種 ${seed}）：前回の核と、まとまりごとの結果・記録・文書が同じ`, () => {
    let old = OLD.createState(INIT); let diff = 0; let rej = 0;
    const cmp = (r, cmds, ctx) => { const o = OLD.applyBatch(old, cmds, ctx); old = o.state;
      if (o.status !== r.status || o.reason !== r.reason || canon(o.detail) !== canon(r.detail) || canon(o.applied) !== canon(r.applied) || canon(o.outcomes) !== canon(r.outcomes)) diff++; if (r.status === 'rejected') rej++; };
    const w = runFuzz(seed, 1500, { onApplied: cmp, onRejected: cmp });
    assert.equal(diff, 0); assert.ok(rej > 0 && w.stats.reverts > 20, JSON.stringify(w.stats));
    assert.equal(canon(w.state.doc), canon(old.doc)); assert.equal(canon(NEW.logItems(w.state.log)), canon(OLD.logItems(old.log)));
    // 選んで取り消す：AI の記録を、古い順・新しい順・まとめて
    const ai = NEW.aiRecordIds(w.state.log); let a = w.state; let b = old; const H = { sender: { k: 'human', device: 'd1' } };
    for (const [k, targets] of [ai.slice(0, 30), ai.slice(-30), ai.filter((_, i) => i % 7 === 0)].entries()) {
      for (const mode of ['units', undefined]) {
        const cmd = { id: `sel-${k}-${mode}`, v: 1, actor: { k: 'human', device: 'd1' }, body: { type: 'revert', ...(mode ? { mode } : {}), targets } };
        const ra = NEW.applyBatch(a, [cmd], H); const rb = OLD.applyBatch(b, [cmd], H); assert.equal(ra.status, rb.status); assert.equal(canon(ra.applied), canon(rb.applied)); assert.equal(canon(ra.outcomes), canon(rb.outcomes)); a = ra.state; b = rb.state;
        assert.equal(canon(NEW.planRevert(a, targets.slice(0, 5))), canon(OLD.planRevert(b, targets.slice(0, 5))));
      }
    }
    assert.equal(canon(a.doc), canon(b.doc));
  });
}

test('1つの値の道に集中（掛ける・足す・置きかえ・種類の切りかえが混ざる）：取り消し・やり直し・選んで取り消すが、前回の核と同じ。控えを使わない計算とも同じ', () => {
  const S = (v) => ({ k: 'static', v }); const H = { sender: { k: 'human', device: 'd1' } }; const H2 = { sender: { k: 'human', device: 'd2' } }; const A = { sender: { k: 'ai', agent: 'w1' } };
  for (const seed of [1, 2, 3, 4]) {
    const rng = mulberry32(seed * 977); let a = NEW.createState(INIT); let b = OLD.createState(INIT); let c = NEW.createState(INIT); let k = 0; const ids = []; let nrev = 0; let rebuilt = 0;
    const both = (body, ctx, extra = {}) => {
      const actor = ctx.sender.k === 'human' ? { k: 'human', device: ctx.sender.device } : { k: 'ai', agent: 'w1', task: 't' + (k >> 4) };
      const cmd = { id: `h${seed}-${++k}`, v: body.type === 'prop.set' ? 2 : 1, actor, base: { ...a.doc.revs }, body, ...extra };
      const ra = NEW.applyBatch(a, [cmd], ctx); const rb = OLD.applyBatch(b, [cmd], ctx);
      NEW.revertTuning.noFast = true; NEW.revertTuning.noPrefix = true; const rc = NEW.applyBatch(c, [cmd], ctx); NEW.revertTuning.noFast = false; NEW.revertTuning.noPrefix = false;
      assert.equal(ra.status, rb.status, `${body.type} ${ra.message} / ${rb.message}`); assert.equal(ra.reason, rb.reason); assert.equal(canon(ra.applied), canon(rb.applied)); assert.equal(canon(ra.outcomes), canon(rb.outcomes));
      assert.equal(canon(rc.applied), canon(ra.applied));
      if (process.env.DBG) { DBG[body.type + ':' + ra.status + ':' + (ra.reason || '') + ':' + (ra.message || '')] = (DBG[body.type + ':' + ra.status + ':' + (ra.reason || '') + ':' + (ra.message || '')] || 0) + 1; }
      a = ra.state; b = rb.state; c = rc.state; if (ra.status === 'applied') { if (body.type !== 'revert') ids.push(cmd.id); else { nrev++; for (const o of ra.outcomes) if (o.rebuilt) rebuilt++; } } return ra;
    };
    for (const id of ['n0', 'n1']) both({ type: 'node.add', node: { id, scene: 's1', kind: 'shape', name: id, order: id === 'n0' ? 'i' : 'r', geo: { t: 'rect', size: S([20, 10]), round: S(2) }, xf: { scale: S([1, 1]), rot: S(0) } } }, H2);
    ids.length = 0;   // 部品を足した記録は、戻す相手にしない（部品が無くなると、あとの操作が全部断られる）
    for (let i = 0; i < 2500; i++) {
      const x = rng(); const node = rng() < 0.85 ? 'n0' : 'n1'; const ctx = rng() < 0.3 ? A : rng() < 0.5 ? H : H2; const path = rng() < 0.8 ? 'xf.scale' : 'geo.round';
      if (x < 0.55) both({ type: 'prop.scale', node, path, f: path === 'geo.round' ? [[0.5, 0.8, 1.25, 2, 3, 0.3333][Math.floor(rng() * 6)]] : rng() < 0.5 ? [[0.5, 0.8, 1.25, 2, -1, 0.3333, 3, 1.0001][Math.floor(rng() * 8)]] : [Math.round(rng() * 30000) / 10000, Math.round((rng() * 4 - 2) * 10000) / 10000 || 1] }, ctx);
      else if (x < 0.62) both({ type: 'prop.nudge', node, path: 'geo.round', d: [Math.round(rng() * 100) / 10] }, ctx);   // 足す量は geo.round だけ（xf.scale は掛ける量と置きかえだけ＝組み立て直しが起きる道）
      else if (x < 0.625) both({ type: 'prop.set', node, path, value: path === 'geo.round' ? S(Math.round(rng() * 50) / 10) : S([1.5, 0.75]) }, ctx);
      else if (x < 0.8) { const u = (rng() < 0.6 ? NEW.makeUndo : NEW.makeRedo)(a.log, 'd1', 'x'); if (u) both(u.body, H); }
      else if (x < 0.9) { const t = []; const m = 1 + Math.floor(rng() * 3); for (let q = 0; q < m; q++) t.push(ids[Math.floor(rng() * rng() * ids.length)]); both({ type: 'revert', mode: rng() < 0.7 ? 'units' : undefined, targets: [...new Set(t)] }, rng() < 0.8 ? H : A); }
      else { const t = ids[ids.length - 1 - Math.floor(rng() * Math.min(40, ids.length))]; if (t) both({ type: 'revert', mode: 'units', targets: [t] }, H); }
    }
    assert.equal(canon(a.doc), canon(b.doc)); assert.equal(canon(a.doc), canon(c.doc)); assert.equal(canon(NEW.logItems(a.log)), canon(OLD.logItems(b.log)));
    assert.ok(nrev > 300 && rebuilt > 100, `取り消し ${nrev}・組み立て直し ${rebuilt}`);
  }
});
