// 試しの小道具
import assert from 'node:assert/strict';
import { createState, applyBatch, SPECS, content, canon } from '../src/index.js';

export const H = (device = 'd1') => ({ sender: { k: 'human', device } });
export const AI = (agent = 'w1') => ({ sender: { k: 'ai', agent } });
export const S = (v) => ({ k: 'static', v });
export const hex = (v) => S({ k: 'hex', v });

/** 状態を持ち歩く小さな台 */
export class Bench {
  constructor(init = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' }, perms: { 'write.script': 'allow' } }) { this.init = init; this.s = createState(init); this.n = 0; }
  get doc() { return this.s.doc; }
  /** 命令を作る（base は「今の全部の版を見ていた」ことにする） */
  cmd(body, ctx = H(), extra = {}) {
    const actor = ctx.sender.k === 'human' ? { k: 'human', device: ctx.sender.device } : { k: 'ai', agent: ctx.sender.agent, task: 't1' };
    return { id: `c${++this.n}`, v: SPECS[body.type] ? SPECS[body.type].v : 1, actor, base: { ...this.s.doc.revs }, body, ...extra };
  }
  /** 当ててみる（通れば状態を進める）。結果を返す */
  try(body, ctx = H(), extra = {}) { const r = applyBatch(this.s, [this.cmd(body, ctx, extra)], ctx); this.s = r.state; return r; }
  /** 当てる（通らなければ試しの失敗） */
  do(body, ctx = H(), extra = {}) { const r = this.try(body, ctx, extra); assert.equal(r.status, 'applied', `${body.type}: ${r.reason} ${r.message} ${JSON.stringify(r.why || '')}`); return r.applied[0]; }
  batch(bodies, ctx = H(), extra = {}) { const cmds = bodies.map((b) => this.cmd(b, ctx, extra)); const r = applyBatch(this.s, cmds, ctx); this.s = r.state; return r; }
  snap() { return canon(content(this.s.doc)); }
}
export const path = (id, pts, more = {}) => ({ id, scene: 's1', kind: 'shape', name: id, order: 'i', geo: { t: 'path', closed: true, pts: pts.map(([pid, x, y]) => ({ id: pid, p: S([x, y]) })) }, fill: { color: hex('#336699') }, stroke: { color: hex('#000000'), w: S(2) }, ...more });

/** よく使う場面：まとまり G の中に、道の形 A・四角 B（回転に鍵）・線 L。外に丸 C */
export function fixture() {
  const b = new Bench();
  b.do({ type: 'node.add', node: { id: 'G', scene: 's1', kind: 'group', name: '体', order: 'i' } });
  b.do({ type: 'node.add', node: path('A', [['p1', 0, 0], ['p2', 10, 0], ['p3', 10, 10]], { parent: 'G', order: 'c' }) });
  b.do({ type: 'node.add', node: { id: 'B', scene: 's1', kind: 'shape', name: '四角', parent: 'G', order: 'i', geo: { t: 'rect', size: S([20, 10]), round: S(2) }, fill: { color: hex('#aa0000') },
    xf: { rot: { k: 'keys', keys: [{ id: 'k1', t: { k: 'sec', s: 0 }, v: 0 }, { id: 'k2', t: { k: 'sec', s: 1 }, v: 90, ease: { k: 'preset', name: 'inout' } }] } } } });
  b.do({ type: 'node.add', node: { id: 'L', scene: 's1', kind: 'line', name: '線', parent: 'G', order: 'r', geo: { t: 'path', closed: false, pts: [{ id: 'q1', p: S([0, 0]) }, { id: 'q2', p: S([5, 5]), in: S([-1, 0]), out: S([1, 0]) }] }, stroke: { color: hex('#111111'), w: S(3) } } });
  b.do({ type: 'node.add', node: { id: 'C', scene: 's1', kind: 'shape', name: '丸', order: 'r', geo: { t: 'ellipse', size: S([8, 8]) }, fill: { color: hex('#00aa00') } } });
  b.do({ type: 'line.add', line: { id: 'ln1', text: 'カバは水の中で暮らす', tokens: [{ id: 'tk1', text: 'カバは' }, { id: 'tk2', text: '水の中で' }, { id: 'tk3', text: '暮らす' }] } });
  return b;
}
