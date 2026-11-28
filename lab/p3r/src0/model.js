// 文書の最小の形・値（Value）・番地・控え（Draft）。DATA_MODEL 1・3・4・8節の最小版。
//
// Doc = {
//   v:1,
//   scenes: { [id]: { id, name, stage:0..6 } },
//   nodes:  { [id]: Node },                       // 親子は node.parent、順番は node.order（Rank）
//   script: { lines: Line[] },                    // Line = { id, chapter, tokens:[{id,text}] }（本文はトークンをつなげた物）
//   cover:  { stages:{[工程]:Mode}, sceneModes:{['場面~工程']:Mode}, perms:{[鍵]:'allow'|'propose'|'deny'}, locks: Lock[] },
//   revs:   { ['node:<id>'|'line:<id>'|'cover']: number }   // 物ごとの版。外した物の数字も残す
// }
// Node = { id, scene, name, kind:'group'|'shape'|'line', parent:id|null, order:Rank, stage:0..6,
//          xf:{pos,rot,scale}, opacity, geo?, fill?:{color}, stroke?:{color,w} }
// Geo  = {t:'path', closed, pts:Pt[]} | {t:'ellipse', size} | {t:'rect', size, round}
// Pt   = { id, p:Value<vec2>, in?:Value<vec2>, out?:Value<vec2>, corner?:boolean }
import { Reject, need, isId, isObj, isNum, clone, isRank } from './util.js';
import { analyze } from './expr.js';

export const MODES = ['human', 'collab', 'ai'];
export const PERM_KEYS = ['write.shape', 'write.color', 'write.motion', 'write.script', 'create', 'remove', 'cover'];
export const PERM_VALUES = ['allow', 'propose', 'deny'];
export const DEFAULT_PERMS = { 'write.shape': 'allow', 'write.color': 'allow', 'write.motion': 'allow', 'write.script': 'propose', create: 'allow', remove: 'deny', cover: 'deny' };
export const STAGES = ['art', 'motion', 'script']; // 試作での工程の名前（命令の種類から核が決める。policy.js）
export const MAX_KEYS = 2000; export const MAX_PTS = 2000;

/** 空の文書を作る（最初の状態。記録からの作り直しの出発点） */
export function createDoc(init = {}) {
  const doc = { v: 1, scenes: {}, nodes: {}, script: { lines: [] },
    cover: { stages: { art: 'collab', motion: 'collab', script: 'collab' }, sceneModes: {}, perms: { ...DEFAULT_PERMS }, locks: [] }, revs: {} };
  for (const s of init.scenes || []) { if (!isId(s.id)) throw new Error('scene id'); doc.scenes[s.id] = { id: s.id, name: s.name || s.id, stage: s.stage ?? 0 }; }
  if (init.stages) Object.assign(doc.cover.stages, init.stages);
  if (init.perms) Object.assign(doc.cover.perms, init.perms);
  return doc;
}
export const revOf = (doc, target) => (Object.hasOwn(doc.revs, target) ? doc.revs[target] : 0);
export const getNode = (doc, id) => (Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined);

// ---- 値
// 数は 1/10000 の格子に乗せる。← 小数のまま「足す → 引く」をすると元の数に戻らないことがある（0.1+0.5-0.5≠0.1）。
// 格子に乗せておけば、足した量（delta）を引いたときに必ず元に戻る。
export const GRID = 1e4;
// 丸め方（DATA_MODEL 3節・改訂4）：いちばん近い格子へ。ちょうど半分は 0 から遠い方へ。
// Math.round は半分を正の方へ丸める（-0.5 → -0）ので、絶対値で丸めてから符号を戻す。
/** 格子の番号（整数）。x は画素・度・比・秒 */
export const toGrid = (x) => { const r = Math.round(Math.abs(x) * GRID); return x < 0 ? -r : r; };
export const snap = (x) => { const r = toGrid(x) / GRID; return r === 0 ? 0 : r; };
/** 掛ける・割る（結果を格子に丸める）。数でも [x,y] でも。f は長さ 1 か、値と同じ長さ */
export function scaleV(v, f, div) {
  // 格子の番号（整数）どうしで計算する。小数のまま掛けると、ちょうど半分の値が、端数のせいで下に丸まることがある（0.0003×0.5 → 0.0001）
  const one = (x, k) => {
    const a = BigInt(toGrid(x)); const b = BigInt(toGrid(k)); let num = div ? a * 10000n : a * b; let den = div ? b : 10000n;
    if (den < 0n) { num = -num; den = -den; } const neg = num < 0n; if (neg) num = -num;
    const q = Number((2n * num + den) / (2n * den)); const r = (neg ? -q : q) / GRID; return r === 0 ? 0 : r;
  };
  return Array.isArray(v) ? v.map((x, i) => one(x, f.length === 1 ? f[0] : f[i])) : one(v, f[0]);
}
export const snapT = (v, type) => (type === 'num' ? snap(v) : type === 'vec2' ? v.map(snap) : clone(v));
const HEX = /^#[0-9a-fA-F]{6}$/;
export function okT(v, type) {
  switch (type) {
    case 'num': return isNum(v);
    case 'vec2': return Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
    case 'color': return isObj(v) && ((v.k === 'hex' && typeof v.v === 'string' && HEX.test(v.v)) || (v.k === 'palette' && isId(v.name)));
    case 'bool': return typeof v === 'boolean';
    default: return false;
  }
}
const PATH_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+){0,5}$/;
export const isPath = (s) => typeof s === 'string' && s.length <= 200 && PATH_RE.test(s) && s.split('.').every((x) => !(x in Object.prototype));
export function normTime(t) {
  need(isObj(t), '時刻の形');
  if (t.k === 'sec') { need(isNum(t.s) && t.s >= 0, '秒'); return { k: 'sec', s: t.s }; }
  if (t.k === 'cue') { const c = t.cue; need(isObj(c) && isId(c.token) && (c.edge === 'start' || c.edge === 'end') && (c.offset === undefined || isNum(c.offset)), '合図の形');
    const cue = { token: c.token, edge: c.edge }; if (c.offset !== undefined) cue.offset = c.offset; return { k: 'cue', cue }; }
  throw new Reject('invalid', '時刻の種類');
}
export function normEase(e) {
  need(isObj(e), '緩急の形');
  if (e.k === 'preset') { need(['linear', 'in', 'out', 'inout'].includes(e.name), '緩急の名前'); return { k: 'preset', name: e.name }; }
  if (e.k === 'bezier') { need(Array.isArray(e.p) && e.p.length === 4 && e.p.every(isNum), '緩急の曲線'); return { k: 'bezier', p: e.p.slice() }; }
  throw new Reject('invalid', '緩急の種類');
}
export function normKey(k, type) {
  need(isObj(k) && isId(k.id), '鍵の id'); need(okT(k.v, type), '鍵の値');
  const out = { id: k.id, t: normTime(k.t), v: snapT(k.v, type) };
  if (k.ease !== undefined) out.ease = normEase(k.ease);
  if (k.hold !== undefined) { need(typeof k.hold === 'boolean', 'hold'); out.hold = k.hold; }
  return out;
}
/**
 * 送られてきた値を検査して、核の中の形にそろえる（式の参照は核が自分で解いて持つ。送る側の refs は捨てる）。
 * @param {'num'|'vec2'|'color'} type
 */
export function normValue(v, type) {
  need(isObj(v), '値は札つきの形で');
  switch (v.k) {
    case 'static': need(okT(v.v, type), `値の型が違う（${type}）`); return { k: 'static', v: snapT(v.v, type) };
    case 'keys': {
      need(Array.isArray(v.keys) && v.keys.length <= MAX_KEYS, '鍵の並び');
      const ids = new Set(); const keys = v.keys.map((k) => { const n = normKey(k, type); need(!ids.has(n.id), '鍵の id が重なっている'); ids.add(n.id); return n; });
      return { k: 'keys', keys };
    }
    case 'expr': {
      need(type === 'num' || type === 'vec2', '式は数と位置だけ');
      const info = analyze(v.src); const out = { k: 'expr', src: v.src, refs: info.refs };
      if (v.base != null) { need(isObj(v.base) && (v.base.k === 'static' || v.base.k === 'keys'), '式の base は固定か鍵'); out.base = normValue(v.base, type); }
      return out;
    }
    case 'ref': {
      const to = v.to; need(isObj(to), '参照の形');
      if (to.k === 'prop') { need(isId(to.node) && isPath(to.path), '参照の相手'); return { k: 'ref', to: { k: 'prop', node: to.node, path: to.path } }; }
      if (to.k === 'palette') { need(type === 'color' && isId(to.name), '色の名前の参照'); return { k: 'ref', to: { k: 'palette', name: to.name } }; }
      throw new Reject('invalid', '参照の種類');
    }
    default: throw new Reject('invalid', '値の種類の札がない');
  }
}
/** 値が指している参照（部品の値への物だけ） */
export function refsOf(value) {
  if (!value) return [];
  if (value.k === 'ref') return value.to.k === 'prop' ? [value.to] : [];
  if (value.k === 'expr') return value.refs || [];
  return [];
}

// ---- 値の置き場（道）。決まった名前だけ
/** 部品 n の道 segs にある値の型。無ければ null */
export function slotType(n, segs) {
  const key = segs.join('.');
  switch (key) {
    case 'xf.pos': case 'xf.scale': return 'vec2';
    case 'xf.rot': case 'opacity': return 'num';
    case 'fill.color': return n.fill ? 'color' : null;
    case 'stroke.color': return n.stroke ? 'color' : null;
    case 'stroke.w': return n.stroke ? 'num' : null;
    case 'geo.size': return n.geo && (n.geo.t === 'ellipse' || n.geo.t === 'rect') ? 'vec2' : null;
    case 'geo.round': return n.geo && n.geo.t === 'rect' ? 'num' : null;
  }
  if (segs.length === 4 && segs[0] === 'geo' && segs[1] === 'pts' && n.geo && n.geo.t === 'path' && (segs[3] === 'p' || segs[3] === 'in' || segs[3] === 'out')) {
    const pt = n.geo.pts.find((q) => q.id === segs[2]);
    return pt && pt[segs[3]] != null ? 'vec2' : null;
  }
  return null;
}
/** 部品の値の置き場を全部ならべる：[道の並び, 型, 値] */
export function slotsOf(n) {
  const out = [[['xf', 'pos'], 'vec2', n.xf.pos], [['xf', 'rot'], 'num', n.xf.rot], [['xf', 'scale'], 'vec2', n.xf.scale], [['opacity'], 'num', n.opacity]];
  if (n.fill) out.push([['fill', 'color'], 'color', n.fill.color]);
  if (n.stroke) out.push([['stroke', 'color'], 'color', n.stroke.color], [['stroke', 'w'], 'num', n.stroke.w]);
  if (n.geo) {
    if (n.geo.t === 'ellipse' || n.geo.t === 'rect') out.push([['geo', 'size'], 'vec2', n.geo.size]);
    if (n.geo.t === 'rect') out.push([['geo', 'round'], 'num', n.geo.round]);
    if (n.geo.t === 'path') for (const pt of n.geo.pts) for (const h of ['p', 'in', 'out']) if (pt[h] != null) out.push([['geo', 'pts', pt.id, h], 'vec2', pt[h]]);
  }
  return out;
}
export function normPt(pt) {
  need(isObj(pt) && isId(pt.id), '点の id');
  const out = { id: pt.id, p: normValue(pt.p, 'vec2') };
  if (pt.in != null) out.in = normValue(pt.in, 'vec2');
  if (pt.out != null) out.out = normValue(pt.out, 'vec2');
  if (pt.corner != null) { need(typeof pt.corner === 'boolean', '角の印'); out.corner = pt.corner; }
  return out;
}
const S = (v) => ({ k: 'static', v });
/** 形（Geo）を検査してそろえる */
export function normGeo(g, kind) {
  need(isObj(g), '形');
  if (g.t === 'path') {
    need(Array.isArray(g.pts) && g.pts.length <= MAX_PTS && typeof g.closed === 'boolean', '点の並び');
    const ids = new Set(); return { t: 'path', closed: g.closed, pts: g.pts.map((p) => { const q = normPt(p); need(!ids.has(q.id), '点の id が重なっている'); ids.add(q.id); return q; }) };
  }
  need(kind === 'shape', '線は道だけ');
  if (g.t === 'ellipse') return { t: 'ellipse', size: normValue(g.size, 'vec2') };
  if (g.t === 'rect') return { t: 'rect', size: normValue(g.size, 'vec2'), round: normValue(g.round ?? S(0), 'num') };
  throw new Reject('invalid', '形の種類');
}
/** node.add の中身を検査して、足りない所を既定で埋めた部品にする */
export function normNode(n) {
  need(isObj(n) && isId(n.id), '部品の id'); need(isId(n.scene), '場面の id');
  need(['group', 'shape', 'line'].includes(n.kind), '部品の種類');
  need(typeof n.name === 'string' && n.name.length <= 200, '名前');
  need(n.parent == null || isId(n.parent), '親'); need(isRank(n.order), '順番の印');
  need(n.stage === undefined || (Number.isInteger(n.stage) && n.stage >= 0 && n.stage <= 6), '段');
  const xf = n.xf || {};
  const out = { id: n.id, scene: n.scene, name: n.name, kind: n.kind, parent: n.parent ?? null, order: n.order,
    xf: { pos: normValue(xf.pos ?? S([0, 0]), 'vec2'), rot: normValue(xf.rot ?? S(0), 'num'), scale: normValue(xf.scale ?? S([1, 1]), 'vec2') },
    opacity: normValue(n.opacity ?? S(1), 'num') };
  if (n.stage !== undefined) out.stage = n.stage;
  if (n.kind === 'group') { need(n.geo == null && n.fill == null && n.stroke == null, 'まとまりは形を持たない'); return out; }
  out.geo = normGeo(n.geo, n.kind);
  if (n.fill != null) { need(n.kind === 'shape' && isObj(n.fill), '塗り'); out.fill = { color: normValue(n.fill.color, 'color') }; }
  if (n.stroke != null) { need(isObj(n.stroke), '線'); out.stroke = { color: normValue(n.stroke.color, 'color'), w: normValue(n.stroke.w ?? S(2), 'num') }; }
  if (n.kind === 'line') need(out.stroke && !out.fill, '線は線の色が要る');
  return out;
}

// ---- 番地（at）：['node',id,…] ['cover',…] ['line',id,…]。並び（配列）の中は id でたどる
function rootOf(doc, r) {
  if (r === 'node') return doc.nodes; if (r === 'cover') return doc.cover; if (r === 'line') return doc.script.lines;
  throw new Reject('invalid', `知らない番地 ${r}`);
}
const step = (cur, seg) => (cur == null || typeof cur !== 'object' ? undefined
  : Array.isArray(cur) ? cur.find((x) => x && x.id === seg) : Object.hasOwn(cur, seg) ? cur[seg] : undefined);
/** 番地の中身。無ければ undefined */
export function getAt(doc, at) { let cur = rootOf(doc, at[0]); for (let i = 1; i < at.length; i++) cur = step(cur, at[i]); return cur; }
/** 効果に書く形（無い＝null） */
export const valAt = (doc, at) => { const v = getAt(doc, at); return v === undefined ? null : clone(v); };
/** 効果が属する「物」（版を数える単位） */
export function targetOfAt(at, id) {
  if (at[0] === 'cover') return 'cover';
  const x = at.length > 1 ? at[1] : id; return `${at[0]}:${x}`;
}
export const targetOf = (e) => (e.k === 'move' || e.k === 'own' ? `node:${e.node}` : targetOfAt(e.at, e.id));
/** 効果の番地（比べるための並び）。insert/remove は「並び＋その物の id」、move は「部品の置き場所」 */
export function addrOf(e) {
  if (e.k === 'move') return ['node', e.node, '@place'];
  if (e.k === 'own') return ['node', e.node, '@owner'];   // P3r：持ち主の帳簿（文書の中身ではない）
  if (e.k === 'insert' || e.k === 'remove') return [...e.at, e.id];
  return e.at;
}

/**
 * 控え：元の文書を書きかえずに、変える所だけ写して持つ。
 * 全部うまくいったら doc を新しい文書として使い、だめなら捨てる。
 */
export class Draft {
  constructor(doc) { this.base = doc; this.doc = { ...doc }; this.owned = new Set(); }
  own(at) {
    const d = this.doc; const o = this.owned; const r = at[0];
    if (r === 'node') {
      if (!o.has('nodes')) { d.nodes = { ...d.nodes }; o.add('nodes'); }
      if (at.length > 1 && Object.hasOwn(d.nodes, at[1]) && !o.has('n:' + at[1])) { d.nodes[at[1]] = clone(d.nodes[at[1]]); o.add('n:' + at[1]); }
    } else if (r === 'cover') { if (!o.has('cover')) { d.cover = clone(d.cover); o.add('cover'); }
    } else if (r === 'line') { if (!o.has('script')) { d.script = clone(d.script); o.add('script'); } }
  }
  bump(target) { if (!this.owned.has('revs')) { this.doc.revs = { ...this.doc.revs }; this.owned.add('revs'); } this.doc.revs[target] = revOf(this.doc, target) + 1; }
}

/** 効果を控えに当てる。文書を変える所は、ここ1つ */
export function applyEffect(dr, e) {
  const doc = dr.doc;
  switch (e.k) {
    case 'set': {
      dr.own(e.at); const par = getAt(doc, e.at.slice(0, -1)); const seg = e.at[e.at.length - 1];
      if (par == null || typeof par !== 'object' || Array.isArray(par)) throw new Reject('invalid', '置きかえる場所がない', { at: e.at });
      if (e.after === null) delete par[seg]; else par[seg] = clone(e.after);
      return;
    }
    case 'delta': {
      dr.own(e.at); const slot = getAt(doc, e.at);
      if (!slot || slot.k !== 'static') throw new Reject('invalid', '足せる値（固定の数）でない', { at: e.at });
      // 足す・引くは、格子の番号（整数）どうしで行う（3節）。だから、足した量を引けば必ず元に戻る
      const add = (x, d) => { const r = (toGrid(x) + toGrid(d)) / GRID; return r === 0 ? 0 : r; };
      if (typeof slot.v === 'number' && e.d.length === 1) slot.v = add(slot.v, e.d[0]);
      else if (Array.isArray(slot.v) && slot.v.length === e.d.length) slot.v = slot.v.map((x, i) => add(x, e.d[i]));
      else throw new Reject('invalid', '足す量の形が合わない', { at: e.at });
      return;
    }
    case 'mul': { // 掛けた量。after は核が作った物（before × f を格子に丸めた数）。当てる時は、今の値が before と同じであること
      dr.own(e.at); const slot = getAt(doc, e.at);
      if (!slot || slot.k !== 'static') throw new Reject('invalid', '掛けられる値（固定の数）でない', { at: e.at });
      if (JSON.stringify(slot.v) !== JSON.stringify(e.before)) throw new Reject('invalid', '掛ける前の値が合わない', { at: e.at });
      slot.v = clone(e.after); return;
    }
    case 'insert': {
      dr.own(e.at); const list = getAt(doc, e.at);
      if (list == null || typeof list !== 'object') throw new Reject('invalid', '足す場所がない', { at: e.at });
      if (Array.isArray(list)) {
        if (list.some((x) => x.id === e.id)) throw new Reject('invalid', '同じ id がもうある', { at: e.at, id: e.id });
        let i = -1;
        if (e.after != null) { const j = list.findIndex((x) => x.id === e.after); if (j >= 0) i = j + 1; }
        else if (e.after === null) i = 0;
        if (i < 0 && e.next != null) { const j = list.findIndex((x) => x.id === e.next); if (j >= 0) i = j; }
        if (i < 0) i = list.length;
        list.splice(i, 0, clone(e.item));
      } else {
        if (Object.hasOwn(list, e.id)) throw new Reject('invalid', '同じ id がもうある', { at: e.at, id: e.id });
        list[e.id] = clone(e.item); if (e.at[0] === 'node' && e.at.length === 1) dr.owned.add('n:' + e.id);
      }
      return;
    }
    case 'remove': {
      dr.own(e.at); const list = getAt(doc, e.at);
      if (Array.isArray(list)) { const j = list.findIndex((x) => x.id === e.id); if (j < 0) throw new Reject('invalid', '外す物がない', { at: e.at, id: e.id }); list.splice(j, 1); }
      else if (list && Object.hasOwn(list, e.id)) delete list[e.id];
      else throw new Reject('invalid', '外す物がない', { at: e.at, id: e.id });
      return;
    }
    case 'move': {
      dr.own(['node', e.node]); const n = getNode(doc, e.node); if (!n) throw new Reject('invalid', '動かす部品がない');
      n.parent = e.to.parent ?? null; n.order = e.to.order; return;
    }
    case 'own': { // P3r：引き取り。文書の中身は1つも変えない（持ち主は、記録から計算する）。部品があることだけ確かめる
      if (!getNode(doc, e.node)) throw new Reject('invalid', '引き取る部品がない'); return;
    }
    default: throw new Reject('invalid', '知らない効果');
  }
}
/** 効果の逆向き */
export function inverse(e) {
  switch (e.k) {
    case 'set': { const o = { k: 'set', at: e.at, before: e.after, after: e.before }; if (e.kind) o.kind = true; return o; }
    case 'delta': return { k: 'delta', at: e.at, d: e.d.map((x) => -x) };
    case 'mul': { const o = { k: 'mul', at: e.at, f: e.f, before: e.after, after: e.before }; if (!e.div) o.div = true; return o; } // before を持つので、ぴったり戻る
    case 'insert': return { ...e, k: 'remove' };
    case 'remove': return { ...e, k: 'insert' };
    case 'move': return { k: 'move', node: e.node, from: e.to, to: e.from };
    case 'own': return { k: 'own', node: e.node, from: e.to, to: e.from };
  }
  throw new Error('unknown effect');
}
/** 並びの中で、id の前と後ろの物の id */
export function neighbors(list, id) { const j = list.findIndex((x) => x.id === id); return { after: j > 0 ? list[j - 1].id : null, next: j >= 0 && j < list.length - 1 ? list[j + 1].id : null }; }
/** 行の本文（トークンをつなげた物） */
export const lineText = (line) => line.tokens.map((t) => t.text).join('');
