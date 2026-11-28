// でたらめな命令を作る（種つきの乱数で、毎回同じ並び）。正しい命令・わざと壊した命令・古い前提・
// 重複・まとまり・取り消し・選んで取り消す・表紙の変更を混ぜる。
import { SPECS, makeUndo, makeRedo, logItems, logLength, rankBetween, planRevert } from '../src/index.js';

const S = (v) => ({ k: 'static', v });
export function makeGen(rng) {
  let n = 0;
  const R = (k) => Math.floor(rng() * k); const pick = (a) => a[R(a.length)]; const chance = (p) => rng() < p;
  const num = () => Math.round((rng() * 200 - 100) * 1000) / 1000; const vec = () => [num(), num()];
  const color = () => S({ k: 'hex', v: '#' + R(0xffffff).toString(16).padStart(6, '0') });
  const rank = () => rankBetween(null, null) + pick(['', 'a', 'k', 'x', '5']).replace(/^$/, pick(['b', 'm', 't']));
  const time = () => (chance(0.8) ? { k: 'sec', s: R(100) / 10 } : { k: 'cue', cue: { token: `tk${R(6)}`, edge: pick(['start', 'end']) } });
  const senders = [{ k: 'human', device: 'd1' }, { k: 'human', device: 'd1' }, { k: 'human', device: 'd2' }, { k: 'ai', agent: 'w1' }, { k: 'ai', agent: 'w1' }];

  function body(doc) {
    const ids = Object.keys(doc.nodes); const nodes = ids.map((id) => doc.nodes[id]);
    const any = () => (ids.length && chance(0.97) ? pick(ids) : 'ghost');
    const groups = nodes.filter((x) => x.kind === 'group').map((x) => x.id); const paths = nodes.filter((x) => x.geo && x.geo.t === 'path');
    const parent = () => (groups.length && chance(0.6) ? pick(groups) : null);
    const slots = (x) => ['xf.pos', 'xf.rot', 'xf.scale', 'opacity', ...(x.fill ? ['fill.color'] : []), ...(x.stroke ? ['stroke.color', 'stroke.w'] : []), ...(x.geo && x.geo.t !== 'path' ? ['geo.size'] : []), ...(x.geo && x.geo.t === 'rect' ? ['geo.round'] : [])];
    const typeOf = (p) => (p.endsWith('color') ? 'color' : ['xf.pos', 'xf.scale', 'geo.size'].includes(p) ? 'vec2' : 'num');
    const val = (t) => (t === 'color' ? color() : t === 'vec2' ? S(vec()) : S(num()));
    const raw = (t) => (t === 'vec2' ? vec() : num());
    const get = (x, p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), x);
    const keyed = []; for (const x of nodes) for (const p of slots(x)) { const v = get(x, p); if (v && v.k === 'keys') keyed.push([x, p, v]); }
    const big = ids.length > 30; const w = [];
    const add = (weight, f) => { for (let i = 0; i < weight; i++) w.push(f); };
    add(big ? 1 : 6, () => {
      const id = `n${++n}`; const kind = pick(['group', 'shape', 'shape', 'shape', 'line']); const base = { id, scene: pick(['s1', 's1', 's2']), kind, name: `部品${n}`, parent: parent(), order: rank() };
      if (kind === 'group') return { type: 'node.add', node: base };
      const pts = Array.from({ length: 1 + R(5) }, (_, i) => ({ id: `p${i}`, p: S(vec()), ...(chance(0.3) ? { in: S(vec()), out: S(vec()) } : {}) }));
      if (kind === 'line') return { type: 'node.add', node: { ...base, geo: { t: 'path', closed: false, pts }, stroke: { color: color(), w: S(2) } } };
      const geo = pick([{ t: 'path', closed: true, pts }, { t: 'ellipse', size: S(vec()) }, { t: 'rect', size: S(vec()), round: S(num()) }]);
      return { type: 'node.add', node: { ...base, geo, fill: { color: color() }, ...(chance(0.5) ? { stroke: { color: color(), w: S(1) } } : {}) } };
    });
    add(big ? 5 : 1, () => ({ type: 'node.remove', node: any() }));
    add(3, () => ({ type: 'node.move', node: any(), parent: chance(0.1) ? any() : parent(), order: rank() }));
    add(2, () => ({ type: 'node.rename', node: any(), name: `名前${R(1000)}` }));
    add(6, () => { const x = doc.nodes[any()]; if (!x) return { type: 'prop.set', node: 'ghost', path: 'xf.pos', value: S(vec()) }; const p = pick(slots(x)); const cur = get(x, p);
      if (cur.k === 'keys') return { type: 'prop.set', node: x.id, path: p, value: { k: 'keys', keys: [{ id: `k${++n}`, t: time(), v: raw(typeOf(p)) }] } };
      return { type: 'prop.set', node: x.id, path: p, value: val(typeOf(p)) }; });
    add(6, () => { const x = doc.nodes[any()]; const p = x ? pick(slots(x).filter((q) => typeOf(q) !== 'color')) : 'xf.pos'; return { type: 'prop.nudge', node: x ? x.id : 'ghost', path: p, d: typeOf(p) === 'vec2' ? vec() : [num()] }; });
    add(3, () => { const x = doc.nodes[any()]; const p = x ? pick(slots(x).filter((q) => typeOf(q) !== 'color')) : 'xf.scale'; const f = () => pick([2, 0.5, -1, 1.5, 0.3333, 3, 1.1, 0, Math.round((rng() * 4 - 2) * 10000) / 10000]);
      return { type: 'prop.scale', node: x ? x.id : 'ghost', path: p, f: typeOf(p) === 'vec2' && chance(0.7) ? [f(), f()] : [f()] }; });
    add(4, () => { const x = doc.nodes[any()]; if (!x) return { type: 'prop.kind', node: 'ghost', path: 'xf.rot', value: S(1) }; const p = pick(slots(x)); const t = typeOf(p); const cur = get(x, p); const other = any();
      const opts = [() => val(t), () => ({ k: 'keys', keys: [{ id: `k${++n}`, t: time(), v: t === 'color' ? color().v : raw(t) }, { id: `k${++n}`, t: time(), v: t === 'color' ? color().v : raw(t) }] }),
        () => (t === 'color' ? { k: 'ref', to: { k: 'prop', node: other, path: pick(['fill.color', 'stroke.color']) } } : { k: 'expr', src: pick([`ref("${other}.${p}")`, 'sin(time) * 3', `wiggle(${R(9)}, 2, 5) + value`, `follow(ref("${other}.xf.rot"), 0.2)`]), ...(chance(0.5) ? { base: val(t) } : {}) }),
        () => ({ k: 'ref', to: { k: 'prop', node: other, path: p } })];
      let v = pick(opts)(); if (v.k === cur.k && chance(0.8)) v = cur.k === 'static' ? opts[1]() : val(t);
      return { type: 'prop.kind', node: x.id, path: p, value: v }; });
    add(5, () => { const x = paths.length ? pick(paths) : null; if (!x) return { type: 'pt.add', node: any(), pt: { id: 'z', p: S(vec()) }, after: null }; const pts = x.geo.pts;
      return { type: 'pt.add', node: x.id, pt: { id: `q${++n}`, p: S(vec()), ...(chance(0.3) ? { out: S(vec()) } : {}) }, after: pts.length && chance(0.8) ? pick(pts).id : null }; });
    add(1, () => { const x = pick(nodes.filter((q) => q.kind === 'shape').concat([null])); return { type: 'geo.set', node: x ? x.id : any(), geo: chance(0.5) ? { t: 'ellipse', size: S(vec()) } : { t: 'path', closed: true, pts: [{ id: `g${++n}`, p: S(vec()) }, { id: `g${++n}`, p: S(vec()) }] } }; });
    const ptOp = (f) => () => { const x = paths.length ? pick(paths) : null; const pt = x && x.geo.pts.length ? pick(x.geo.pts).id : 'nopt'; return f(x ? x.id : any(), pt); };
    add(2, ptOp((node, pt) => ({ type: 'pt.remove', node, pt })));
    add(8, ptOp((node, pt) => ({ type: 'pt.nudge', node, pt, d: vec() })));
    add(3, ptOp((node, pt) => ({ type: 'pt.handle', node, pt, which: pick(['in', 'out']), value: chance(0.3) ? null : S(vec()) })));
    add(2, ptOp((node, pt) => ({ type: 'pt.corner', node, pt, corner: chance(0.5) })));
    const keyOp = (f) => () => { if (!keyed.length) return f('ghost', 'xf.rot', 'k', 'num', null); const [x, p, v] = pick(keyed); return f(x.id, p, v.keys.length ? pick(v.keys).id : 'nokey', typeOf(p), v); };
    add(3, keyOp((node, path, key, t) => ({ type: 'key.add', node, path, key: { id: `k${++n}`, t: time(), v: t === 'color' ? color().v : raw(t) }, after: key === 'nokey' || chance(0.3) ? null : key })));
    add(2, keyOp((node, path, key) => ({ type: 'key.remove', node, path, key })));
    add(2, keyOp((node, path, key) => ({ type: 'key.retime', node, path, key, t: time() })));
    add(3, keyOp((node, path, key, t) => ({ type: 'key.value', node, path, key, v: t === 'color' ? color().v : raw(t) })));
    add(1, () => ({ type: 'mode.set', stage: pick(['art', 'motion', 'script']), mode: pick(['ai', 'ai', 'ai', 'collab', 'human']), ...(chance(0.3) ? { scene: pick(['s1', 's2']) } : {}) }));
    add(1, () => ({ type: 'perms.set', key: pick(['write.shape', 'write.color', 'write.motion', 'create', 'remove', 'cover', 'write.script']), value: pick(['allow', 'allow', 'allow', 'propose', 'deny']) }));
    add(1, () => (doc.cover.locks.length > 2 || chance(0.4) ? { type: 'lock.remove', lock: doc.cover.locks.length ? pick(doc.cover.locks).id : 'nolock' }
      : { type: 'lock.add', lock: { id: `l${++n}`, level: pick(['frozen', 'ask', 'ask']), target: pick([{ node: any() }, { node: any(), path: pick(['fill.color', 'xf.pos', 'geo.pts']) }, { scene: 's2' }, { line: 'ln0' }]) } }));
    add(1, () => { const lines = doc.script.lines; const r = R(3);
      if (r === 0 || !lines.length) return { type: 'line.add', line: { id: `ln${++n}`, text: 'あい', tokens: [{ id: `t${++n}`, text: 'あ' }, { id: `t${++n}`, text: 'い' }] }, after: lines.length ? pick(lines).id : null };
      const l = pick(lines); if (r === 1) return { type: 'line.remove', line: l.id };
      const keep = l.tokens.filter(() => chance(0.7)); const tokens = [...keep, { id: `t${++n}`, text: 'う' }]; return { type: 'line.edit', line: l.id, text: tokens.map((t) => t.text).join(''), tokens }; });
    return pick(w)();
  }
  /** わざと壊す */
  function garbage(b) {
    const r = R(8); const c = JSON.parse(JSON.stringify(b));
    if (r === 0) c.type = 'node.destroyAll'; else if (r === 1) delete c.node; else if (r === 2) c.node = { toString: 1 }; else if (r === 3) c.d = [NaN, 1]; else if (r === 4) c.path = '__proto__.x';
    else if (r === 5) c.value = { k: 'expr', src: 'while(true){}' }; else if (r === 6) c.pt = '../../etc'; else c.extra = { deep: [1, 2, { a: null }] };
    return c;
  }
  /**
   * 次の一手を作る。
   * @returns {{cmds:any[], ctx:{sender:any}, kind:string}}
   */
  function next(state, last) {
    const sender = pick(senders); const ctx = { sender }; const doc = state.doc; const r = rng();
    const actor = sender.k === 'human' ? (chance(0.05) ? { k: 'ai', agent: 'w1' } : { k: 'human', device: sender.device }) : chance(0.2) ? { k: 'human', device: 'd1' } : { k: 'ai', agent: sender.agent, task: 't' };
    // 前提（base）：その命令が触る物の、今の版（本物の画面と同じく、触る物の分だけ運ぶ）
    const baseOf = (b) => { const o = {}; const put = (t) => { if (Object.hasOwn(doc.revs, t)) o[t] = doc.revs[t]; };
      put('cover'); for (const k of ['node', 'parent']) if (typeof b[k] === 'string') put(`node:${b[k]}`); if (typeof b.line === 'string') put(`line:${b.line}`); return o; };
    const wrap = (b, extra = {}) => ({ id: `c${++n}`, v: SPECS[b.type] ? SPECS[b.type].v : 1, actor, base: baseOf(b), body: b, ...extra });
    if (r < 0.03 && last) return { cmds: last.cmds, ctx: last.ctx, kind: 'resend' };
    if (r < 0.035 && last) return { cmds: [{ ...last.cmds[0], group: 'changed' }], ctx: last.ctx, kind: 'id-reuse' };                    // 同じ id で中身が違う
    if (r < 0.04 && last) return { cmds: [last.cmds[0], wrap(body(doc))], ctx: last.ctx, kind: 'partial-resend' };                        // 一部だけ当て済み
    if (r < 0.07 && sender.k === 'human') { const c = (chance(0.7) ? makeUndo : makeRedo)(state.log, sender.device, `c${++n}`); if (c) return { cmds: [c], ctx, kind: 'undo' }; }
    if (r < 0.13 && logLength(state.log)) {
      const items = logItems(state.log); const from = Math.max(0, items.length - 60); const targets = new Set();
      for (let i = 0, k = 1 + R(6); i < k; i++) targets.add(items[from + R(items.length - from)].cmd.id);
      if (chance(0.5)) { // 部品ごとにまとめる取り消し（9.5節②③）。答えは、計画を見て作る／わざと古い ack・でたらめな単位も混ぜる
        const body = { type: 'revert', mode: 'units', targets: [...targets] };
        if (chance(0.5)) { let plan = null; try { plan = planRevert(state, body.targets); } catch { plan = null; }
          if (plan) { body.at = plan.at; body.decisions = {}; body.ack = {};
            for (const u of plan.units) if (u.choices.includes('drop') && chance(0.6)) { body.decisions[u.id] = 'drop'; body.ack[u.id] = chance(0.85) ? u.later.map((l) => l.seq) : u.later.slice(1).map((l) => l.seq); }
            if (chance(0.1)) body.decisions['part:node:ghost'] = 'drop'; } }
        return { cmds: [wrap(body)], ctx, kind: 'revert-units' };
      }
      const decisions = {}; if (chance(0.5)) for (const t of targets) decisions[`${t}#0`] = pick(['keep', 'force', 'root']);
      return { cmds: [wrap({ type: 'revert', mode: 'select', targets: [...targets], decisions, ...(chance(0.1) ? { onAsk: 'abort' } : {}) })], ctx, kind: 'revert' };
    }
    if (r < 0.18) return { cmds: [wrap(garbage(body(doc)))], ctx, kind: 'garbage' };
    if (r < 0.26) { const g = `g${++n}`; return { cmds: Array.from({ length: 2 + R(3) }, () => wrap(body(doc), { group: g })), ctx, kind: 'group' }; }
    const c = wrap(body(doc));
    if (r < 0.34) { for (const t of Object.keys(c.base)) if (chance(0.5)) c.base[t] = Math.max(0, c.base[t] - 1 - R(3)); return { cmds: [c], ctx, kind: 'old-base' }; }
    if (r < 0.36) { c.base = {}; return { cmds: [c], ctx, kind: 'no-base' }; }
    if (r < 0.38 && sender.k === 'human') { c.v = 1; if (c.body.type === 'prop.set' && c.body.value.k === 'static') c.body.value = c.body.value.v; return { cmds: [c], ctx, kind: 'v1' }; }
    return { cmds: [c], ctx, kind: 'plain' };
  }
  return { next };
}
