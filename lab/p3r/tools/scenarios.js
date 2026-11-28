// 絵を描く作業らしい操作の並びを作り、AI の作業を選んで戻したときに
// 「戻した／上書き済み（何もしない）／聞く」が何件になるかを数える。
// 種つきの乱数なので、何回流しても同じ数字になる。
import { createState, applyBatch, check, SPECS, mulberry32, rankBetween, aiRecordIds, makeUndo } from '../src/index.js';
import { humanWorkIntact } from './oracle.js';

const S = (v) => ({ k: 'static', v }); const hex = (v) => S({ k: 'hex', v });
export const HUMAN = { sender: { k: 'human', device: 'mac' } }; export const AI = { sender: { k: 'ai', agent: 'worker' } };

/** 操作を当てていく小さな台 */
export class Session {
  constructor(seed) { this.rng = mulberry32(seed); this.s = createState({ scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai' } }); this.n = 0; this.rejected = []; }
  R(k) { return Math.floor(this.rng() * k); } pick(a) { return a[this.R(a.length)]; } chance(p) { return this.rng() < p; }
  num(r = 40) { return Math.round((this.rng() * 2 - 1) * r * 10) / 10; } vec(r) { return [this.num(r), this.num(r)]; }
  color() { return hex('#' + this.R(0xffffff).toString(16).padStart(6, '0')); }
  get doc() { return this.s.doc; }
  cmd(body, ctx, extra) { const a = ctx.sender; return { id: `c${++this.n}`, v: SPECS[body.type].v, actor: a.k === 'human' ? { k: 'human', device: a.device } : { k: 'ai', agent: a.agent, task: 'job' }, base: { ...this.s.doc.revs }, body, ...extra }; }
  /** まとまりで当てる。通らなければ rejected に残して先へ進む */
  run(bodies, ctx, extra = {}) {
    if (!bodies.length) return [];
    const r = applyBatch(this.s, bodies.map((b) => this.cmd(b, ctx, extra)), ctx);
    if (r.status !== 'applied') { this.rejected.push({ bodies, status: r.status, reason: r.reason, message: r.message }); return []; }
    this.s = r.state; return r.applied.map((a) => a.cmd.id);
  }
  nodes(f) { return Object.values(this.doc.nodes).filter(f || (() => true)); }
  paths() { return this.nodes((n) => n.geo && n.geo.t === 'path' && n.geo.pts.length > 0); }
  shapeBody(id, parent, order) {
    const k = 4 + this.R(5); const pts = Array.from({ length: k }, (_, i) => { const a = (i / k) * Math.PI * 2; const r = 20 + this.R(15);
      return { id: `p${i}`, p: S([Math.round(Math.cos(a) * r * 10) / 10, Math.round(Math.sin(a) * r * 10) / 10]), in: S(this.vec(6)), out: S(this.vec(6)) }; });
    return { type: 'node.add', node: { id, scene: 's1', kind: 'shape', name: id, parent, order, geo: this.chance(0.8) ? { t: 'path', closed: true, pts } : { t: 'ellipse', size: S([10 + this.R(20), 10 + this.R(20)]) }, fill: { color: this.color() }, xf: { pos: S(this.vec(100)) } } };
  }
}

// ---- AI の作業（1回＝1つのまとまり）
export const JOBS = {
  /** 下組み：まとまり1つ＋形 4〜7個 */
  scaffold(z, tag) {
    const g = `${tag}_g`; const bodies = [{ type: 'node.add', node: { id: g, scene: 's1', kind: 'group', name: '下組み', order: rankBetween(null, null) } }]; let prev = null;
    for (let i = 0, k = 4 + z.R(4); i < k; i++) { prev = rankBetween(prev, null); bodies.push(z.shapeBody(`${tag}_s${i}`, g, prev)); }
    return bodies;
  },
  /** 手直し：点を動かす・取っ手を直す・位置をずらす・色を少し変える・部品を1つ足す */
  tweak(z, tag) {
    const bodies = []; const ps = z.paths(); const all = z.nodes((n) => n.kind !== 'group');
    for (let i = 0, k = 6 + z.R(8); i < k && ps.length; i++) { const n = z.pick(ps); const pt = z.pick(n.geo.pts).id;
      bodies.push(z.chance(0.7) ? { type: 'pt.nudge', node: n.id, pt, d: z.vec(4) } : { type: 'pt.handle', node: n.id, pt, which: z.pick(['in', 'out']), value: S(z.vec(8)) }); }
    for (let i = 0, k = 1 + z.R(3); i < k && all.length; i++) bodies.push({ type: 'prop.nudge', node: z.pick(all).id, path: 'xf.pos', d: z.vec(10) });
    for (let i = 0, k = z.R(3); i < k && all.length; i++) bodies.push({ type: 'prop.set', node: z.pick(all).id, path: 'fill.color', value: z.color() });
    if (z.chance(0.5)) bodies.push(z.shapeBody(`${tag}_new`, null, rankBetween('y', null)));
    return bodies;
  },
  /** 色替え：形の色を全部（か半分）変える */
  recolor(z) { return z.nodes((n) => n.fill).filter(() => z.chance(0.8)).map((n) => ({ type: 'prop.set', node: n.id, path: 'fill.color', value: z.color() })); },
  /** 並べかえ・整列：順番を変える・位置をそろえる（足す量で） */
  arrange(z) {
    const all = z.nodes((n) => n.kind !== 'group'); const bodies = [];
    for (const n of all) { if (z.chance(0.4)) bodies.push({ type: 'node.move', node: n.id, parent: n.parent, order: rankBetween(null, null) + z.pick('abcdefghijklmnopqrstuvwxyz'.split('')) }); if (z.chance(0.6)) bodies.push({ type: 'prop.nudge', node: n.id, path: 'xf.pos', d: z.vec(15) }); }
    return bodies;
  },
  /** なめらかにする：点を足す・取っ手を直す・角を丸める */
  smooth(z, tag) {
    const bodies = []; let k = 0;
    for (const n of z.paths()) { if (!z.chance(0.7)) continue; const pts = n.geo.pts; const a = z.pick(pts);
      bodies.push({ type: 'pt.add', node: n.id, pt: { id: `${tag}_p${k++}`, p: S(z.vec(30)), in: S(z.vec(5)), out: S(z.vec(5)) }, after: a.id });
      for (const p of pts) if (z.chance(0.3)) bodies.push({ type: 'pt.handle', node: n.id, pt: p.id, which: z.pick(['in', 'out']), value: S(z.vec(8)) });
      if (z.chance(0.3)) bodies.push({ type: 'pt.corner', node: n.id, pt: z.pick(pts).id, corner: false }); }
    return bodies;
  },
  /** 動きを付ける：回転・位置を鍵にして、鍵を足す（2つのまとまりに分かれる：種類を変える → 鍵を足す） */
  animate(z, tag) {
    const bodies = []; let k = 0;
    for (const n of z.nodes((x) => x.kind !== 'group')) { if (!z.chance(0.6)) continue; const path = z.pick(['xf.rot', 'xf.pos']); if (n.xf[path.slice(3)].k !== 'static') continue; const v = () => (path === 'xf.rot' ? z.num(90) : z.vec(50));
      bodies.push({ type: 'prop.kind', node: n.id, path, value: { k: 'keys', keys: [{ id: `${tag}_k${k++}`, t: { k: 'sec', s: 0 }, v: v() }, { id: `${tag}_k${k++}`, t: { k: 'sec', s: 1 }, v: v() }] } }); }
    return bodies;
  },
};

// ---- 人の操作（1手ずつ。1回のドラッグ＝1つの命令）
export function humanStep(z, tag) {
  const ps = z.paths(); const all = z.nodes((n) => n.kind !== 'group'); const groups = z.nodes((n) => n.kind === 'group'); const r = z.rng();
  const keyed = []; for (const n of all) for (const p of ['rot', 'pos']) if (n.xf[p].k === 'keys' && n.xf[p].keys.length) keyed.push([n, `xf.${p}`, n.xf[p]]);
  if (r < 0.04 && z.n > 0) { const c = makeUndo(z.s.log, 'mac', `c${++z.n}`); if (c) { const res = applyBatch(z.s, [c], HUMAN); if (res.status === 'applied') z.s = res.state; return; } }
  let b = null;
  if (keyed.length && r < 0.25) { const [n, path, v] = z.pick(keyed); const k = z.pick(v.keys); b = z.chance(0.7) ? { type: 'key.value', node: n.id, path, key: k.id, v: path === 'xf.rot' ? z.num(90) : z.vec(50) } : { type: 'key.retime', node: n.id, path, key: k.id, t: { k: 'sec', s: z.R(30) / 10 } }; }
  else if (r < 0.45 && ps.length) { const n = z.pick(ps); b = { type: 'pt.nudge', node: n.id, pt: z.pick(n.geo.pts).id, d: z.vec(5) }; }                       // 点を動かす
  else if (r < 0.55 && ps.length) { const n = z.pick(ps); b = { type: 'pt.handle', node: n.id, pt: z.pick(n.geo.pts).id, which: z.pick(['in', 'out']), value: S(z.vec(8)) }; } // 取っ手
  else if (r < 0.65 && all.length) b = { type: 'prop.set', node: z.pick(all).id, path: 'fill.color', value: z.color() };                                   // 色を変える
  else if (r < 0.72 && all.length) { const n = z.pick(all); if (n.xf.pos.k === 'static') b = { type: 'prop.nudge', node: n.id, path: 'xf.pos', d: z.vec(12) }; } // 部品を動かす
  else if (r < 0.79 && ps.length) { const n = z.pick(ps); b = { type: 'pt.add', node: n.id, pt: { id: `${tag}_h${z.n}`, p: S(z.vec(30)) }, after: z.pick(n.geo.pts).id }; } // 点を足す
  else if (r < 0.82 && ps.length) { const n = z.pick(ps); if (n.geo.pts.length > 3) b = { type: 'pt.remove', node: n.id, pt: z.pick(n.geo.pts).id }; }       // 点を消す
  else if (r < 0.89) b = z.shapeBody(`${tag}_n${z.n}`, groups.length && z.chance(0.6) ? z.pick(groups).id : null, rankBetween(null, null) + z.pick(['c', 'k', 'w'])); // 部品を足す
  else if (r < 0.95 && all.length) { const n = z.pick(all); b = { type: 'node.move', node: n.id, parent: n.parent, order: rankBetween(null, null) + z.pick('abcdefghijklmnopqrstuvwxyz'.split('')) }; } // 並べかえる
  else if (r < 0.98 && all.length) b = { type: 'node.rename', node: z.pick(all).id, name: `名前${z.n}` };
  else if (all.length > 3) b = { type: 'node.remove', node: z.pick(all).id };                                                                               // 部品を消す
  if (b) z.run([b], HUMAN);
}

/** 筋書き：[名前, 何をするか]。どれも「戻す相手の AI の作業 → 人が H 手なおす → その AI の作業だけ戻す」 */
export const PLOTS = {
  '下組みを丸ごと戻す': { pre: [], job: 'scaffold' },
  '2回めの手直しだけ戻す': { pre: ['scaffold', 12], job: 'tweak' },
  '色替えだけ戻す': { pre: ['scaffold', 12], job: 'recolor' },
  '並べかえ・整列だけ戻す': { pre: ['scaffold', 12], job: 'arrange' },
  'なめらかにした分だけ戻す': { pre: ['scaffold', 12], job: 'smooth' },
  '付けた動きだけ戻す': { pre: ['scaffold', 12], job: 'animate' },
};

/**
 * 筋書きを1回流して数える。
 * @param {string} plot @param {number} seed @param {number} humanSteps 戻したい AI の作業のあとに、人が何手なおすか
 */
export function runPlot(plot, seed, humanSteps) {
  const P = PLOTS[plot]; const z = new Session(seed);
  for (const x of P.pre) { if (typeof x === 'number') for (let i = 0; i < x; i++) humanStep(z, 'pre'); else z.run(JOBS[x](z, `pre_${x}`), AI, { group: `pre_${x}` }); }
  const ids = z.run(JOBS[P.job](z, 'job'), AI, { group: 'job' });
  for (let i = 0; i < humanSteps; i++) humanStep(z, 'h');
  const before = z.s; const c = z.cmd({ type: 'revert', mode: 'select', targets: ids }, HUMAN);
  const dry = check(before, c, HUMAN); const r = applyBatch(before, [c], HUMAN);
  if (!ids.length || r.status !== 'applied') return { plot, seed, humanSteps, empty: true, reason: r.reason };
  const why = {}; const askNodes = new Set();
  for (const o of r.outcomes) if (o.result === 'ask') { why[o.why] = (why[o.why] || 0) + 1; askNodes.add(o.at.split('/').slice(0, 2).join('/')); }
  return { plot, seed, humanSteps, records: ids.length, tally: r.tally, dryTally: dry.tally, why, askNodes: askNodes.size, intact: humanWorkIntact(before, r.state, ids), rejected: z.rejected.length };
}

/** 記録の中の AI の作業を、作業（まとまり）ごとに戻してみて数える（traces 用）。文書は変えない */
export function measureAIReverts(state) {
  const groups = new Map();
  for (const id of aiRecordIds(state.log)) { const i = state.log.store.byId.get(id); const a = state.log.store.items[i]; const g = a.cmd.group || `(1つずつ) ${id}`; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(id); }
  const out = [];
  for (const [group, ids] of groups) {
    const c = { id: `measure-${group}`, v: 1, actor: { k: 'human', device: 'measure' }, body: { type: 'revert', mode: 'select', targets: ids } };
    const r = applyBatch(state, [c], { sender: { k: 'human', device: 'measure' } });
    out.push({ group, records: ids.length, status: r.status, tally: r.tally, asks: (r.outcomes || []).filter((o) => o.result === 'ask').map((o) => ({ at: o.at, why: o.why, choices: o.choices, collateral: o.collateral })),
      intact: r.status === 'applied' ? humanWorkIntact(state, r.state, ids) : null });
  }
  return out;
}
