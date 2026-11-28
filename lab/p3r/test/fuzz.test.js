// 種を決めた乱数で、でたらめな命令の並びを大量に当てる。
//  ・いつでも全体の決まりが保たれる　・断られた命令は何も変えない　・同じ記録からは同じ文書
//  ・核は元の状態を書きかえない（毎回凍らせる）　・同じ種なら、何回流しても同じ結果
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyBatch, replay, toEntries, checkInvariants, canon, same, hash, mulberry32, deepFreeze, logItems, logLength, REASONS } from '../src/index.js';
import { makeGen } from './gen.js';

const INIT = { scenes: [{ id: 's1', stage: 0 }, { id: 's2', stage: 2 }], stages: { art: 'ai', motion: 'ai', script: 'ai' }, perms: { 'write.script': 'allow' } };
const STEPS = Number(process.env.P3A_FUZZ_STEPS || 12000);
const SEEDS = (process.env.P3A_FUZZ_SEEDS || '1,2,3,20261127').split(',').map(Number);

export function runFuzz(seed, steps, opt = {}) {
  const rng = mulberry32(seed); const gen = makeGen(rng); let state = createState(INIT); let last = null;
  const stats = { steps: 0, cmds: 0, status: {}, reason: {}, kind: {}, outcomes: { reverted: 0, noop: 0, ask: 0, kept: 0 }, maxNodes: 0, replays: 0 };
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (let i = 0; i < steps; i++) {
    const step = gen.next(state, last); last = step; stats.steps++; stats.cmds += step.cmds.length; inc(stats.kind, step.kind);
    const r = applyBatch(state, step.cmds, step.ctx);
    inc(stats.status, r.status); if (r.reason) { inc(stats.reason, r.reason); assert.ok(REASONS.includes(r.reason), r.reason); }
    if (r.status !== 'applied') assert.equal(r.state, state, '当たらなかった命令は、状態を変えない');
    else {
      if (opt.freeze) { deepFreeze(r.state.doc); for (const a of r.applied) deepFreeze(a); }
      if (r.tally) for (const k of Object.keys(r.tally)) stats.outcomes[k] += r.tally[k];
    }
    state = r.state;
    const bad = checkInvariants(state.doc); if (bad.length) assert.fail(`種 ${seed} の ${i} 手め（${step.kind}）で決まりが破れた：${bad[0]}\n${JSON.stringify(step.cmds).slice(0, 600)}`);
    const nn = Object.keys(state.doc.nodes).length; if (nn > stats.maxNodes) stats.maxNodes = nn;
    if (opt.replayEvery && (i + 1) % opt.replayEvery === 0) {
      const rp = replay(INIT, toEntries(state.log)); stats.replays++;
      assert.deepEqual(rp.skipped, [], '当たった記録は、読み直しても全部当たる'); assert.ok(same(rp.state.doc, state.doc), `種 ${seed} の ${i} 手め：記録から同じ文書にならない`);
    }
  }
  return { state, stats };
}

for (const seed of SEEDS) {
  test(`でたらめな命令 ${STEPS} 手（種 ${seed}）：決まりが保たれる・記録から同じ文書`, () => {
    const { state, stats } = runFuzz(seed, STEPS, { freeze: true, replayEvery: 3000 });
    // 最後に：記録（命令と送り主だけ）を文字にして読み直し、文書も効果も同じになること
    const entries = JSON.parse(JSON.stringify(toEntries(state.log))); const rp = replay(INIT, entries);
    assert.deepEqual(rp.skipped, []); assert.equal(canon(rp.state.doc), canon(state.doc));
    assert.equal(canon(logItems(rp.state.log)), canon(logItems(state.log)), '効果・版・方針・取り消しの一覧も同じ');
    // 試しが薄くないこと：全部の種類の結果・全部の断りの札が出ている
    for (const s of ['applied', 'duplicate', 'proposed', 'rejected']) assert.ok(stats.status[s] > 0, `${s} が1回も出ていない`);
    for (const rs of REASONS.filter((x) => x !== 'needs-history')) assert.ok(stats.reason[rs] > 0, `断りの札 ${rs} が1回も出ていない`);
    assert.ok(stats.status.applied > STEPS * 0.3, '通った命令が少なすぎる'); assert.ok(stats.outcomes.reverted > 50 && stats.outcomes.ask > 5 && stats.outcomes.noop > 20);
    console.log(`  種 ${seed}：${stats.steps} 手（命令 ${stats.cmds} 個）→ 記録 ${logLength(state.log)} 件／${JSON.stringify(stats.status)}／断り ${JSON.stringify(stats.reason)}／取り消しの効果 ${JSON.stringify(stats.outcomes)}／部品は最大 ${stats.maxNodes} 個／文書の印 ${hash(canon(state.doc))}`);
  });
}

test('同じ種なら、2回流しても同じ文書・同じ記録（核に時計も乱数も無い）', () => {
  const a = runFuzz(77, 1500); const b = runFuzz(77, 1500);
  assert.equal(canon(a.state.doc), canon(b.state.doc)); assert.equal(canon(logItems(a.state.log)), canon(logItems(b.state.log)));
});

test('記録の順番を1か所入れかえると、違いは検査で見つかるか同じ文書になる（落ちない）', () => {
  const { state } = runFuzz(5, 800); const entries = toEntries(state.log);
  for (let i = 10; i < entries.length - 1; i += 37) {
    const e = entries.slice(); [e[i], e[i + 1]] = [e[i + 1], e[i]];
    const rp = replay(INIT, e); assert.deepEqual(checkInvariants(rp.state.doc), []);
  }
});
