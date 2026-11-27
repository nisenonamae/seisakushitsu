// 「止まって聞く」の測り・操作の記録の入口・人の直しが残ること（核とは別のやり方で確かめる）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyBatch, logItems, aiRecordIds, mulberry32, createState, checkInvariants } from '../src/index.js';
import { PLOTS, runPlot } from '../tools/scenarios.js';
import { humanWorkIntact } from '../tools/oracle.js';
import { runTrace } from '../tools/run-trace.js';
import { makeGen } from './gen.js';

test('絵を描く作業らしい並び：AI の作業を選んで戻しても、人の直しが残る（6つの筋書き × 種 25 × 人の直し 5・20・60 手）', () => {
  let runs = 0; let checked = 0; const t = { reverted: 0, noop: 0, ask: 0 };
  for (const plot of Object.keys(PLOTS)) for (const h of [5, 20, 60]) for (let seed = 1; seed <= 25; seed++) {
    const r = runPlot(plot, seed, h); if (r.empty) continue; runs++;
    assert.deepEqual(r.intact.broken, [], `${plot} 種${seed} 人${h}手`); assert.deepEqual(r.tally, r.dryTally, '先に見せる一覧と、当てた結果が同じ');
    checked += r.intact.checked; for (const k of Object.keys(t)) t[k] += r.tally[k];
  }
  assert.ok(runs > 400); assert.ok(checked > 3000); assert.ok(t.reverted > 0 && t.noop > 0 && t.ask > 0);
  console.log(`  ${runs} 回・効果 ${t.reverted + t.noop + t.ask} 個：戻した ${t.reverted}／上書き済み ${t.noop}／聞く ${t.ask}。人の直し ${checked} か所を調べて、壊れ 0`);
});

test('測りは、何回流しても同じ数字（種つき）', () => {
  assert.deepEqual(runPlot('2回めの手直しだけ戻す', 7, 20), runPlot('2回めの手直しだけ戻す', 7, 20));
});

test('でたらめな並びのあとで AI の記録をまとめて戻しても、人の直しが残る（答えなし＝聞く所は残す）', () => {
  const INIT = { scenes: [{ id: 's1', stage: 0 }, { id: 's2', stage: 2 }], stages: { art: 'ai', motion: 'ai', script: 'ai' }, perms: { 'write.script': 'allow' } };
  let checked = 0; let effects = 0;
  for (let seed = 100; seed < 130; seed++) {
    const gen = makeGen(mulberry32(seed)); let state = createState(INIT); let last = null;
    for (let i = 0; i < 400; i++) { const st = gen.next(state, last); last = st; state = applyBatch(state, st.cmds, st.ctx).state; }
    const ids = aiRecordIds(state.log).slice(-80); if (!ids.length) continue;
    // 固定されていると「聞く」になるだけなので、どちらでもよい。人が戻す
    const r = applyBatch(state, [{ id: 'final-revert', v: 1, actor: { k: 'human', device: 'd1' }, body: { type: 'revert', mode: 'select', targets: ids } }], { sender: { k: 'human', device: 'd1' } });
    assert.equal(r.status, 'applied', r.message); assert.deepEqual(checkInvariants(r.state.doc), []);
    const o = humanWorkIntact(state, r.state, ids); assert.deepEqual(o.broken, [], `種 ${seed}`); checked += o.checked; effects += r.outcomes.length;
    assert.ok(logItems(r.state.log).at(-1).outcomes.length === r.outcomes.length);
  }
  assert.ok(checked > 1000 && effects > 500);
  console.log(`  種 30 通り：戻そうとした効果 ${effects} 個・人の直し ${checked} か所を調べて、壊れ 0`);
});

test('操作の記録の入口：見本（この試作の形・P4 の形）が流れ、直せない操作は理由つきで数えられる', () => {
  const dir = new URL('../traces/', import.meta.url);
  const a = runTrace(JSON.parse(readFileSync(new URL('sample-steps.json', dir), 'utf8')));
  assert.deepEqual(a.failed, []); assert.equal(a.unmapped.length, 0);
  const job = a.reverts.find((r) => r.group === 'job-tenaoshi'); assert.deepEqual(job.tally, { reverted: 5, noop: 1, ask: 1, kept: 0 }); assert.deepEqual(job.intact.broken, []);
  const raw = JSON.parse(readFileSync(new URL('sample-p4-log.json', dir), 'utf8')); const b = runTrace(raw, { start: raw.start });
  assert.deepEqual(b.failed, []); assert.deepEqual(b.unmapped.map((u) => u.type).sort(), ['convert', 'node.add', 'prop.nudge']);
  assert.equal(b.reverts.length, 1); assert.equal(b.reverts[0].group, 'p4-shitagumi'); assert.deepEqual(b.reverts[0].intact.broken, []);
  assert.ok(b.state.doc.nodes.g_1 && b.state.doc.nodes['s-me'].parent === 'g_1' && !b.state.doc.nodes['s-ashi']);
});
