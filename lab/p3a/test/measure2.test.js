// 部品ごとの取り消しの測り（tools/measure2.js）と、数の検証（tools/numcheck.js）が、筋書きのとおりに動くこと。
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, PLOTS2, runCase, runPlot2, runCase7, runRebase } from '../tools/scenarios2.js';
import { runAll } from '../tools/numcheck.js';

test('場合 1〜6 の筋書き（種 20）：既定の取り消しで人の直しが壊れない。場合ごとの形が合っている', () => {
  const sum = {};
  for (const name of Object.keys(CASES)) { const t = { units: 0, kept: 0, full: 0, old: 0, runs: 0, ai: 0, noDrop: 0 };
    for (let seed = 1; seed <= 20; seed++) { const r = runCase(name, seed); assert.ok(r && !r.failed, `${name} 種${seed}`); assert.deepEqual(r.intact.broken, [], `${name} 種${seed}`);
      assert.ok(r.units <= r.oldAsks || r.oldAsks === 0, '単位の数は、前の方式の聞く回数を超えない');
      t.runs++; t.units += r.units; t.kept += r.kept; t.full += r.fullParts; t.old += r.oldAsks; t.ai += r.by.ai; t.noDrop += r.units - r.choosable; }
    sum[name[0] + name[1]] = t; }
  assert.equal(sum['1 '].units, 0); assert.equal(sum['1 '].kept, 0, '場合1：全部戻る');
  assert.equal(sum['2 '].units, 20, '場合2：1回につき単位は1つ'); assert.ok(sum['3 '].units > sum['2 '].units);
  assert.ok(sum['4 '].ai === sum['4 '].units && sum['4 '].units > 0, '場合4：単位の上に乗っているのは AI だけ');
  assert.equal(sum['5a'].units, 20); assert.equal(sum['5b'].noDrop, 20, '場合5b：参照されている部品は、外せない'); assert.equal(sum['5c'].units, 0);
  assert.ok(sum['6a'].units < sum['6b'].units, '場合6：あとの AI の分だけなら、ほとんど単位にならない');
});
test('筋書き × 人の直しの量（種 8）：人の直しが壊れない・同じ種なら同じ数字', () => {
  for (const name of Object.keys(PLOTS2)) for (const h of [1, 20]) for (let seed = 1; seed <= 8; seed++) { const r = runPlot2(name, seed, h); if (!r) continue; assert.ok(!r.failed); assert.deepEqual(r.intact.broken, [], `${name} 種${seed} 人${h}手`); }
  const a = runPlot2('手直しだけ戻す', 3, 20); const b = runPlot2('手直しだけ戻す', 3, 20); delete a.state; delete b.state; assert.deepEqual(a, b);
});
test('場合7 の筋書き（種 60 × 送る前の直し 0・1・3 手）：新しい直しが、外す部品に入っていたら必ず断られる。通った時に、あとからの直しは壊れない', () => {
  let stale = 0; let ok = 0;
  for (const late of [0, 1, 3]) for (let seed = 1; seed <= 60; seed++) { const r = runCase7(seed, late); if (!r.drops) continue;
    if (r.status === 'applied') { ok++; assert.equal(r.hit, false, `見逃し：種${seed} ${late}手`); assert.deepEqual(r.lostLate, []); }
    else { stale++; assert.equal(r.reason, 'stale'); assert.equal(r.unchanged, true); assert.ok(late > 0, '直しが入っていないのに断られた'); } }
  assert.ok(stale > 30 && ok > 60);
});
test('人の直しを別の下地に当て直す試し：同じ下組みなら全部当たる。出し直した下組みでは一部が当たらない', () => {
  let t = 0; let a = 0; let t2 = 0; let a2 = 0;
  for (let seed = 1; seed <= 20; seed++) { const r = runRebase(seed, 20, true); t += r.total; a += r.applied; const r2 = runRebase(seed, 20, false); t2 += r2.total; a2 += r2.applied; }
  assert.equal(a, t); assert.ok(a2 < t2 && a2 > t2 * 0.4);
});
test('数の検証（短い版）：足す量・そのままの取り消しは誤差 0、記録から同じ文書', () => {
  const r = runAll({ quick: true }); assert.ok(!r.sig.fail);
  for (const m of [1, 1e3, 1e6, 1e9, 1e11]) assert.equal(r.sig[`add${m}`], 0);
  assert.match(r.text, /元と違った回 0/); assert.match(r.text, /合計と違った回 0/);
});
