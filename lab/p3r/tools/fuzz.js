// でたらめな命令（種つき）で、取り消し・選んで取り消す・引き取りの混ざった記録を作る。試しと、端末どうしの突き合わせで使う。
// 命令の作り手は lab/p3a の test/gen.js（写した物）。ここで足したのは、引き取り（node.adopt）と、掛ける量を多めに混ぜること。
import { createState, applyBatch, mulberry32, logItems, ownerOf } from '../src/index.js';
import { makeGen } from '../test/gen.js';
export const INIT = { scenes: [{ id: 's1', stage: 0 }, { id: 's2', stage: 2 }], stages: { art: 'ai', motion: 'ai', script: 'ai' }, perms: { 'write.script': 'allow' } };
/** @returns {{state:any, batches:{sender:any,cmds:any[]}[], stats:any}} batches＝当たったまとまり（当てた順）*/
export function runFuzz(seed, steps, opt = {}) {
  const rng = mulberry32(seed); const gen = makeGen(rng); const rng2 = mulberry32(seed ^ 0x5bd1e995); let state = opt.from || createState(INIT); let last = null; let k = 0;
  const batches = []; const stats = { applied: 0, rejected: 0, adopt: 0, scale: 0, reverts: 0 }; const H = { sender: { k: 'human', device: 'd1' } }; const A = { sender: { k: 'ai', agent: 'w1' } };
  const push = (cmds, ctx) => { const r = applyBatch(state, cmds, ctx); if (r.status === 'applied') { state = r.state; batches.push({ sender: ctx.sender, cmds }); stats.applied++; if (opt.onApplied) opt.onApplied(r, cmds, ctx); return r; } stats.rejected++; return r; };
  for (let i = 0; i < steps; i++) {
    const step = gen.next(state, last); last = step; const r = push(step.cmds, step.ctx); if (r.status === 'applied' && step.cmds.some((c) => c.body.type === 'revert')) stats.reverts++;
    const ids = Object.keys(state.doc.nodes); if (!ids.length) continue; const x = rng2();
    if (x < 0.06) { // 掛ける量（人と AI が同じ道に）
      const id = ids[Math.floor(rng2() * ids.length)]; const n = state.doc.nodes[id]; if (!n.xf || !n.xf.scale || n.xf.scale.k !== 'static') continue; const ctx = rng2() < 0.5 ? A : H;
      const f = [0.5, 0.8, 1.25, 2, -1, 0.3333, 3][Math.floor(rng2() * 7)];
      if (push([{ id: `${opt.tag || 'x'}${seed}-${++k}`, v: 1, actor: ctx.sender.k === 'human' ? { k: 'human', device: 'd1' } : { k: 'ai', agent: 'w1', task: 'tx' }, base: { [`node:${id}`]: state.doc.revs[`node:${id}`] }, body: { type: 'prop.scale', node: id, path: 'xf.scale', f: [f] } }], ctx).status === 'applied') stats.scale++;
    } else if (x < 0.09) { // 引き取り（AI の部品を人が）
      const ai = ids.filter((id) => { const o = ownerOf(state.log, id); return o && o.startsWith('ai:'); }); if (!ai.length) continue; const id = ai[Math.floor(rng2() * ai.length)];
      if (push([{ id: `${opt.tag || 'x'}${seed}-${++k}`, v: 1, actor: { k: 'human', device: 'd1' }, base: { [`node:${id}`]: state.doc.revs[`node:${id}`] }, body: { type: 'node.adopt', node: id } }], H).status === 'applied') stats.adopt++;
    }
  }
  stats.records = logItems(state.log).length; return { state, batches, stats };
}
