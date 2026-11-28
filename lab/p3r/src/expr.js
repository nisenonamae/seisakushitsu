// 式（小さな専用の言葉）の読み取りと上限の検査。DATA_MODEL 3節。
// ここでは「読めるか・大きさ・深さ・follow の重なり・参照の一覧」だけを見る。計算（評価）はしない。
import { Reject, isId } from './util.js';

export const LIMITS = { nodes: 200, depth: 16, follow: 4, src: 4000 };
const FUNCS = { sin: [1, 1], cos: [1, 1], abs: [1, 1], floor: [1, 1], min: [2, 8], max: [2, 8], clamp: [3, 3], lerp: [3, 3],
  noise: [2, 2], loop: [2, 2], wiggle: [3, 3], spring: [3, 3], follow: [2, 2], ref: [1, 1] };
const VARS = new Set(['time', 'index', 'value']);
const PATH_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;

function lex(src) {
  const out = []; let i = 0;
  const bad = (m) => { throw new Reject('invalid', `式が読めない：${m}（${i}文字め）`); };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i)); const v = Number(m[0]);
      if (!Number.isFinite(v)) bad('数'); out.push({ t: 'num', v }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)); out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    if (c === '"') { const j = src.indexOf('"', i + 1); if (j < 0) bad('閉じていない文字列'); out.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/<>?:(),!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    bad(`使えない文字 ${JSON.stringify(c)}`);
  }
  return out;
}

/**
 * 式を読み、大きさなどを返す。読めなければ invalid、上限を越えたら breaks-invariant で断る。
 * @returns {{nodes:number, depth:number, follow:number, refs:{k:'prop',node:string,path:string}[]}}
 */
export function analyze(src) {
  if (typeof src !== 'string' || src.length === 0) throw new Reject('invalid', '式が空');
  if (src.length > LIMITS.src) throw new Reject('breaks-invariant', '式が長すぎる', { limit: 'src' });
  const tk = lex(src); let p = 0; const refs = [];
  if (tk.length > LIMITS.nodes * 4) throw new Reject('breaks-invariant', '式が大きすぎる', { limit: 'nodes' });
  const peek = () => tk[p]; const isOp = (v) => tk[p] && tk[p].t === 'op' && tk[p].v === v;
  const bad = (m) => { throw new Reject('invalid', `式が読めない：${m}`); };
  const eat = (v) => { if (!isOp(v)) bad(`${v} が要る`); p++; };
  let guard = 0; // 読み取りそのものの深さの守り（かっこの重ねすぎ）
  const enter = () => { if (++guard > 400) throw new Reject('breaks-invariant', '式が深すぎる', { limit: 'depth' }); };
  // 木：{ f?:関数名, a:子[] }
  // 同じ強さの演算の並び（a+b+c+…）は、1つの節にまとめて数える（長い足し算で深さの上限に当たらないように）
  const bin = (ops, next) => () => { const l = next(); let n = null; while (tk[p] && tk[p].t === 'op' && ops.includes(tk[p].v)) { p++; if (!n) n = { a: [l] }; n.a.push(next()); } return n || l; };
  function primary() {
    const t = peek(); if (!t) bad('途中で終わっている');
    if (t.t === 'num') { p++; return { a: [] }; }
    if (t.t === 'op' && t.v === '(') { p++; enter(); const e = ternary(); guard--; eat(')'); return e; }
    if (t.t === 'id') {
      p++;
      if (isOp('(')) {
        if (!Object.hasOwn(FUNCS, t.v)) bad(`知らない関数 ${t.v}`);
        p++; enter(); const a = [];
        if (t.v === 'ref') {
          const s = peek(); if (!s || s.t !== 'str' || !PATH_RE.test(s.v)) bad('ref("部品id.道") の形でない');
          const dot = s.v.indexOf('.'); const nid = s.v.slice(0, dot);
          if (!isId(nid)) bad('ref の部品 id');
          refs.push({ k: 'prop', node: nid, path: s.v.slice(dot + 1) }); p++; a.push({ a: [] });
        } else if (!isOp(')')) { for (;;) { a.push(ternary()); if (isOp(',')) { p++; continue; } break; } }
        guard--; eat(')'); const [lo, hi] = FUNCS[t.v]; if (a.length < lo || a.length > hi) bad(`${t.v} の引数の数`);
        return { f: t.v, a };
      }
      if (!VARS.has(t.v)) bad(`知らない名前 ${t.v}`);
      return { a: [] };
    }
    bad('値が要る所に別の物がある');
  }
  function unary() { if (isOp('-') || isOp('!')) { p++; enter(); const e = { a: [unary()] }; guard--; return e; } return primary(); }
  const mul = bin(['*', '/'], unary); const add = bin(['+', '-'], mul);
  const cmp = bin(['<', '>', '<=', '>=', '==', '!='], add); const and = bin(['&&'], cmp); const or = bin(['||'], and);
  function ternary() { const c = or(); if (isOp('?')) { p++; enter(); const x = ternary(); eat(':'); const y = ternary(); guard--; return { a: [c, x, y] }; } return c; }
  const tree = ternary();
  if (p < tk.length) bad('余分な物が残っている');
  // 大きさ・深さ・follow の重なり（木をたどる。再帰の深さは上の guard で守られている）
  let nodes = 0; let depth = 0; let follow = 0;
  (function walk(n, d, f) {
    nodes++; if (d > depth) depth = d; const nf = n.f === 'follow' ? f + 1 : f; if (nf > follow) follow = nf;
    for (const c of n.a) walk(c, d + 1, nf);
  })(tree, 1, 0);
  if (nodes > LIMITS.nodes) throw new Reject('breaks-invariant', '式が大きすぎる', { limit: 'nodes', nodes });
  if (depth > LIMITS.depth) throw new Reject('breaks-invariant', '式が深すぎる', { limit: 'depth', depth });
  if (follow > LIMITS.follow) throw new Reject('breaks-invariant', 'follow の重なりが多すぎる', { limit: 'follow', follow });
  return { nodes, depth, follow, refs };
}
