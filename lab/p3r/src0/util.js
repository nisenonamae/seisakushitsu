// 小道具：写し・比べる・ハッシュ・種つき乱数・順番の印（Rank）。時計も Math.random も使わない。

/** 断り。reason は 9.3節の札のどれか */
export class Reject extends Error {
  constructor(reason, msg, detail) { super(msg || reason); this.reason = reason; this.detail = detail; }
}
export function need(cond, msg, detail) { if (!cond) throw new Reject('invalid', msg, detail); }

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** id として使える文字列か（Object.prototype にある名前は使わせない） */
export function isId(s) { return typeof s === 'string' && ID_RE.test(s) && !(s in Object.prototype); }
export const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
export const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** JSON の値の深い写し */
export function clone(x) {
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) { const a = new Array(x.length); for (let i = 0; i < x.length; i++) a[i] = clone(x[i]); return a; }
  const o = {}; for (const k of Object.keys(x)) { const v = x[k]; if (v !== undefined) o[k] = clone(v); } return o;
}
/** 鍵を並べかえた決まった形の文字列（同じ中身なら同じ文字列） */
export function canon(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x === undefined ? null : x);
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  const ks = Object.keys(x).filter((k) => x[k] !== undefined).sort();
  return '{' + ks.map((k) => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
}
export const same = (a, b) => a === b || canon(a) === canon(b);
/** FNV-1a 32bit（中身の見分け用。暗号ではない） */
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function deepFreeze(x) {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); for (const k of Object.keys(x)) deepFreeze(x[k]); }
  return x;
}
/** 種つきの乱数（試し用。核の中では使わない） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Rank：あいだに挟める順番の印（0-9a-z の文字列。辞書順。末尾は 0 にしない）
const A = '0123456789abcdefghijklmnopqrstuvwxyz';
export const isRank = (s) => typeof s === 'string' && /^[0-9a-z]{1,64}$/.test(s) && !s.endsWith('0');
/** a と b のあいだの印を作る（a=null は一番前、b=null は一番後ろ） */
export function rankBetween(a, b) {
  let out = '';
  for (let i = 0; i < 64; i++) {
    const lo = a && i < a.length ? A.indexOf(a[i]) : 0;
    const hi = b && i < b.length ? A.indexOf(b[i]) : 36;
    if (hi - lo > 1) return out + A[(lo + hi) >> 1];
    out += A[lo];
    if (hi - lo === 1) b = null;
  }
  throw new Error('rank too deep');
}
/** 子の並び：order → id の順 */
export function cmpPlace(x, y) { return x.order < y.order ? -1 : x.order > y.order ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0; }

// ---- 番地（効果の at）を文字列の鍵にする。区切りは '/'（id に '/' は入らない）
export const akey = (at) => at.join('/');
/** 2つの番地の関係：'eq' 同じ／'anc' b が a の上（b は a を含む）／'desc' b が a の下／null 無関係 */
export function relate(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return null;
  return a.length === b.length ? 'eq' : b.length < a.length ? 'anc' : 'desc';
}
