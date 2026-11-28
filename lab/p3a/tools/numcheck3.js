// 掛ける量・回す量の「取り消しの数の扱い」を、3つの方式で比べる（BRIEF3 の A）。核（engine）は通さない、数だけの模型。
// Node でもブラウザでも同じ物が動く（src/ の toGrid・scaleV だけを使う。時計は速さの表示にしか使わない）。
//   node tools/numcheck3.js          … 表を出す（15 秒ほど）
//   node tools/numcheck3.js --json   … ブラウザと突き合わせる用の印だけ出す
// 誤差の単位は「格子」（1 格子 = 0.0001）。値の並びは、種つきの乱数で作った物（本物の操作ではない）。
//
// 方式：
//   1   逆向きの操作を当てる（割る・引く・逆に回す）。いつでも
//   1b  今の核：上に何も無ければ before へ。あれば割る
//   2a  操作の前の値（before）へ戻す。上にほかの操作が乗っていたら、戻さずに残す
//   2b  before へ戻してから、あとの操作を当て直す（2a を「上に乗っている場合」まで広げた物）
//   3a  記録から組み立て直す：元の値に、残っている操作を、記録の順に1つずつ当て直す（1つごとに格子に丸める＝ふつうに操作した時と同じ計算）
//   3b  記録から組み立て直す：元の値に、残っている操作を、丸めずに全部当ててから、最後に1回だけ丸める（整数の分数で計算）
// 物差し：
//   A「その操作が無かった時の値」＝ 元の値に、残っている操作だけを、記録の順に当てた値（1つごとに丸める）。文書が実際になったはずの値
//   B「数学の上での値」＝ 丸めなしで全部計算して、最後に1回丸めた値
import { toGrid, scaleV, GRID, snap, canon, hash, mulberry32, createState, applyBatch, replay, toEntries, content } from '../src/index.js';

const g = (x) => toGrid(x);
const fmt = (x) => (x === 0 ? '0' : x >= 100 ? x.toFixed(0) : x >= 1 ? x.toFixed(2) : x.toPrecision(2));
const rf = (rng, lo, hi) => snap(lo * Math.pow(hi / lo, rng()));
const pickV = (rng, mag) => snap((rng() * 2 - 1) * mag);
const nz = (r) => (r === 0 ? 0 : r);
const addG = (v, d) => nz((g(v) + g(d)) / GRID);
const D2R = Math.PI / 180;
const rot = (p, deg) => { const c = Math.cos(deg * D2R); const s = Math.sin(deg * D2R); return [snap(p[0] * c - p[1] * s), snap(p[0] * s + p[1] * c)]; };
const isV = Array.isArray;
/** 操作を1つ当てる（1つごとに格子に丸める）。値は数か [x,y]。op = {k:'add'|'mul'|'rot', a} */
export function step(v, op) {
  if (op.k === 'add') return isV(v) ? v.map((x, i) => addG(x, op.a[i])) : addG(v, op.a);
  if (op.k === 'mul') return scaleV(v, isV(op.a) ? op.a : [op.a], false);
  if (op.k === 'rot') return rot(v, op.a);
  throw new Error('op');
}
/** 逆向きの操作を当てる（方式1）。できない時（0 で割る）は null */
export function inv(v, op) {
  if (op.k === 'add') return isV(v) ? v.map((x, i) => addG(x, -op.a[i])) : addG(v, -op.a);
  if (op.k === 'mul') { const f = isV(op.a) ? op.a : [op.a]; if (f.some((x) => g(x) === 0)) return null; return scaleV(v, f, true); }
  if (op.k === 'rot') return rot(v, -op.a);
  throw new Error('op');
}
export const replayOps = (base, ops) => ops.reduce(step, base);
/** 丸めなしで全部計算して、最後に1回丸める（足す・掛けるだけ。数1つ）。整数の分数（BigInt）で */
export function exactOps(base, ops) {
  let n = BigInt(g(base)); let d = 1n;
  for (const op of ops) { if (op.k === 'mul') { n *= BigInt(g(op.a)); d *= 10000n; } else if (op.k === 'add') n += BigInt(g(op.a)) * d; else throw new Error('exact: ' + op.k); }
  const neg = n < 0n; if (neg) n = -n; const q = Number((2n * n + d) / (2n * d)); return nz((neg ? -q : q) / GRID);
}
const eq = (a, b) => (isV(a) ? a[0] === b[0] && a[1] === b[1] : a === b);
const dist = (a, b) => (isV(a) ? Math.max(Math.abs(g(a[0]) - g(b[0])), Math.abs(g(a[1]) - g(b[1]))) : Math.abs(g(a) - g(b)));

/** 1つの値の置き場と、その記録。方式ごとに、取り消し・やり直しの計算が違う */
export class Slot {
  constructor(v0, method) { this.base = v0; this.v = v0; this.ops = []; this.m = method; this.kept = 0; this.impossible = 0; }
  live(skip) { return this.ops.filter((o) => o.live && o !== skip); }
  do(op) { op.before = this.v; op.live = true; this.ops.push(op); this.v = this.m === '3b' ? exactOps(this.base, this.live()) : step(this.v, op); op.after = this.v; return op; }
  laterLive(op) { const i = this.ops.indexOf(op); return this.ops.slice(i + 1).filter((o) => o.live); }
  /** 取り消す。戻さずに残した時は false */
  undo(op) {
    if (!op.live) return true; const later = this.laterLive(op);
    switch (this.m) {
      case '1': { const x = inv(this.v, op); if (x === null) { this.impossible++; return false; } this.v = x; break; }
      case '1b': { if (!later.length && eq(this.v, op.after)) this.v = op.before; else { const x = inv(this.v, op); if (x === null) { this.impossible++; return false; } this.v = x; } break; }
      case '2a': if (later.length || !eq(this.v, op.after)) { this.kept++; return false; } this.v = op.before; break;
      case '2b': this.v = replayOps(op.before, later); break;
      case '3a': this.v = replayOps(this.base, this.live(op)); break;
      case '3b': this.v = exactOps(this.base, this.live(op)); break;
    }
    op.live = false; op.undoneFrom = this.v; return true;
  }
  /** 取り消しをやり直す */
  redo(op) {
    if (op.live) return true; const later = this.laterLive(op); op.live = true;
    switch (this.m) {
      case '1': case '1b': this.v = step(this.v, op); break;
      case '2a': if (later.length || !eq(this.v, op.before)) { op.live = false; this.kept++; return false; } this.v = op.after; break;
      case '2b': this.v = replayOps(op.after, later); break;
      case '3a': this.v = replayOps(this.base, this.live()); break;
      case '3b': this.v = exactOps(this.base, this.live()); break;
    }
    return true;
  }
  A() { return replayOps(this.base, this.live()); }
  B() { return exactOps(this.base, this.live()); }
}
export const METHODS = ['1', '1b', '2a', '2b', '3a', '3b'];
const NAME = { 1: '1 逆向きを当てる（いつでも割る）', '1b': '1b 今の核（上に無ければ before・あれば割る）', '2a': '2a before へ戻す（上に乗っていたら残す）', '2b': '2b before へ戻して、あとを当て直す', '3a': '3a 組み立て直す（1つごとに丸める）', '3b': '3b 組み立て直す（最後に1回だけ丸める）' };

export function runAll(opt = {}) {
  const out = []; const sig = {}; const P = (s) => out.push(s); const N = opt.quick ? 0.1 : 1;
  const RANGES = [['0.5〜2', 0.5, 2], ['0.01〜100', 0.01, 100], ['0.0001〜0.01', 0.0001, 0.01]];
  const mk = () => ({ runs: 0, badA: 0, maxA: 0, badB: 0, maxB: 0, kept: 0, imp: 0, add(s, wantA, wantB) { this.runs++; const a = dist(s.v, wantA); if (a) this.badA++; if (a > this.maxA) this.maxA = a; if (wantB !== undefined) { const b = dist(s.v, wantB); if (b) this.badB++; if (b > this.maxB) this.maxB = b; } } });
  const cell = (t) => `${t.badA}/${t.runs}・最大 ${fmt(t.maxA)}`; const cellB = (t) => `${t.badB}/${t.runs}・最大 ${fmt(t.maxB)}`;

  // ───── A-1 ほかの操作が乗らない場合：n 回伸ばして、新しい順に全部取り消す
  P('### A-1 ほかの人の操作が乗らない：伸ばす・縮めるを n 回くり返し、新しい順に全部取り消す（元の値に戻るか。値 ±1000）\n');
  P('| 方式 | 比 0.5〜2・20 回：戻らなかった回・最大（格子）| 比 0.01〜100・20 回 | 比 0.0001〜0.01・5 回 | 残した（戻さなかった）回 |'); P('|---|---|---|---|---|');
  for (const m of METHODS) { const cells = []; let kept = 0;
    for (const [, lo, hi] of RANGES) { const rng = mulberry32(31); const t = mk(); const n = hi <= 0.01 ? 5 : 20;
      for (let r = 0; r < 2000 * N; r++) { const v0 = pickV(rng, 1000); const s = new Slot(v0, m); const ops = []; for (let i = 0; i < n; i++) ops.push(s.do({ k: 'mul', a: rf(rng, lo, hi) }));
        for (let i = n - 1; i >= 0; i--) s.undo(ops[i]); t.add(s, v0); kept += s.kept; }
      cells.push(cell(t)); sig[`a1_${m}_${lo}`] = [t.badA, t.maxA]; }
    P(`| ${NAME[m]} | ${cells.join(' | ')} | ${kept} |`); }

  // ───── A-2 ほかの人の操作が乗る場合
  P('\n### A-2 ほかの人の操作が乗る：AI ×f と 人 ×g を交互に n 組 → AI の分だけ、新しい順に全部取り消す（値 ±1000・人の比 0.5〜2）\n');
  P('物差し A＝「AI の操作が無かった時の値」（人の操作だけを、記録の順に当てた値）。物差し B＝丸めなしの数学の値。\n');
  P('| 方式 | AI の比 | 組 | A と違った回・最大（格子）| B と違った回・最大（格子）| 残した AI の操作（戻せなかった数）|'); P('|---|---|---|---|---|---|');
  for (const m of METHODS) for (const [label, lo, hi] of RANGES) for (const n of [1, 10]) { const rng = mulberry32(57); const t = mk(); let kept = 0; let total = 0;
    for (let r = 0; r < 2000 * N; r++) { const v0 = pickV(rng, 1000); const s = new Slot(v0, m); const ai = []; const hu = [];
      for (let i = 0; i < n; i++) { ai.push(s.do({ k: 'mul', a: rf(rng, lo, hi), who: 'ai' })); hu.push(s.do({ k: 'mul', a: rf(rng, 0.5, 2), who: 'h' })); }
      for (let i = n - 1; i >= 0; i--) { total++; if (!s.undo(ai[i])) kept++; }
      // 物差しは「人の操作だけ」。残した方式（2a）は、戻さなかった分も「違い」に数える
      t.add(s, replayOps(v0, hu), exactOps(v0, hu)); }
    P(`| ${NAME[m]} | ${label} | ${n} | ${m === '2a' ? '（戻していないので、比べない）' : cell(t)} | ${m === '2a' ? '—' : cellB(t)} | ${kept}/${total} |`); sig[`a2_${m}_${lo}_${n}`] = [t.badA, t.maxA, t.badB, t.maxB, kept]; }

  // ───── A-3 取り消し → やり直し → 取り消し を何千回
  P('\n### A-3 取り消し → やり直し を 5000 回くり返す（AI ×f の上に 人 ×g が1つ。値 ±1000。相手は AI の操作）\n');
  P('| 方式 | AI の比 | やり直したあとの値が、始めと違った回（100 通り × 5000 回）・最大（格子）| 取り消したあとの値が、物差し A と違った回・最大 | 最後の値の動き |'); P('|---|---|---|---|---|');
  for (const m of METHODS) for (const [label, lo, hi] of RANGES) { const rng = mulberry32(91); let badR = 0; let maxR = 0; let badU = 0; let maxU = 0; let n = 0; let drift = 0; const K = Math.round(5000 * N);
    for (let r = 0; r < 100 * N; r++) { const v0 = pickV(rng, 1000); const s = new Slot(v0, m); const x = s.do({ k: 'mul', a: rf(rng, lo, hi) }); const h = s.do({ k: 'mul', a: rf(rng, 0.5, 2) }); const full = s.v; const wantU = replayOps(v0, [h]);
      for (let i = 0; i < K; i++) { n++; if (s.undo(x)) { const d = dist(s.v, wantU); if (d) badU++; if (d > maxU) maxU = d; } s.redo(x); const e = dist(s.v, full); if (e) badR++; if (e > maxR) maxR = e; }
      drift = Math.max(drift, dist(s.v, full)); }
    P(`| ${NAME[m]} | ${label} | ${badR}/${n}・最大 ${fmt(maxR)} | ${m === '2a' ? '（残すので、取り消していない）' : `${badU}/${n}・最大 ${fmt(maxU)}`} | ${drift ? `始めから ${fmt(drift)} 格子ずれたまま` : '始めと同じ'} |`); sig[`a3_${m}_${lo}`] = [badR, maxR, badU, maxU]; }

  // ───── A-4 でたらめな順番で、でたらめな操作を取り消す・やり直す
  P('\n### A-4 12 個の掛け算（AI 6・人 6 が交互）のうち、AI の物を、でたらめな順番で 3000 回 取り消す・やり直す（値 ±1000・比 0.5〜2）\n');
  P('| 方式 | 途中の値が、物差し A（その時に残っている操作だけの値）と違った回・最大（格子）| 全部やり直したあと、始めの値と違った回（200 通り）| 残した回 | 見つかった誤り |'); P('|---|---|---|---|---|');
  for (const m of METHODS) { const rng = mulberry32(123); let bad = 0; let max = 0; let n = 0; let endBad = 0; let kept = 0; let ghost = 0; const K = Math.round(3000 * N); const runs = Math.max(20, Math.round(200 * N));
    for (let r = 0; r < runs; r++) { const v0 = pickV(rng, 1000); const s = new Slot(v0, m); const ai = [];
      for (let i = 0; i < 6; i++) { ai.push(s.do({ k: 'mul', a: rf(rng, 0.5, 2) })); s.do({ k: 'mul', a: rf(rng, 0.5, 2) }); }
      const full = s.v;
      for (let i = 0; i < K; i++) { const x = ai[Math.floor(rng() * 6)]; if (x.live) s.undo(x); else s.redo(x); n++; const d = dist(s.v, s.A()); if (d) { bad++; if (d > 50) ghost++; } if (d > max) max = d; }
      kept += s.kept; for (const x of ai) s.redo(x); if (m !== '2a' && dist(s.v, full)) endBad++; }
    P(`| ${NAME[m]} | ${bad}/${n}・最大 ${fmt(max)} | ${m === '2a' ? '—' : endBad + '/' + runs} | ${kept} | ${m === '2b' && ghost ? `取り消した操作が生き返る（${ghost} 回。先の操作を取り消したあとで、あとの操作の before を使うと、before の中に先の操作が入っている）` : m === '3b' ? 'なし（物差し A とは、丸め方の違いの分だけ違う。積もらない）' : bad ? '丸めのずれが積もる' : 'なし'} |`); sig[`a4_${m}`] = [bad, max, endBad, kept]; }

  // ───── A-5 回す
  P('\n### A-5 回す\n');
  P('**角度に足す**（`xf.rot` に足す量）：足し引きは格子の整数。\n'); P('| 方式 | AI が n 回足し、人も n 回足す → AI の分だけ取り消す（2000 通り・n=50）：物差し A と違った回 | 取り消し → やり直しを 5000 回：違った回 |'); P('|---|---|---|');
  for (const m of ['1', '2a', '2b', '3a']) { const rng = mulberry32(5); let bad = 0; let kept = 0; let bad2 = 0;
    for (let r = 0; r < 2000 * N; r++) { const v0 = pickV(rng, 360); const s = new Slot(v0, m); const ai = []; const hu = []; for (let i = 0; i < 50; i++) { ai.push(s.do({ k: 'add', a: pickV(rng, 720) })); hu.push(s.do({ k: 'add', a: pickV(rng, 720) })); }
      for (let i = 49; i >= 0; i--) if (!s.undo(ai[i])) kept++; if (dist(s.v, replayOps(v0, hu))) bad++; }
    { const s = new Slot(12.3456, m); const x = s.do({ k: 'add', a: 33.3333 }); s.do({ k: 'add', a: -7.7777 }); const full = s.v; for (let i = 0; i < 5000 * N; i++) { s.undo(x); s.redo(x); if (dist(s.v, full)) bad2++; } }
    P(`| ${NAME[m]} | ${m === '2a' ? `残した ${kept} 個（上に人の足した量があるので、全部残る）` : bad} | ${bad2} |`); sig[`a5add_${m}`] = [bad, bad2]; }
  P('\n**点に焼く**（回した結果を、点の座標に書く。点 ±500・原点まわり）：\n'); P('| 方式 | 上に何も無い：n 回まわして新しい順に全部取り消す（元に戻らなかった回・最大〔格子〕）1度×360 | 7.3度×50 | 上に人の「点を動かす」が乗る：AI が回す → 人が動かす を 10 組 → AI の分だけ取り消す。物差し A と違った回・最大 | 取り消し → やり直し 5000 回：始めと違った回・最大 |'); P('|---|---|---|---|---|');
  for (const m of ['1', '1b', '2a', '2b', '3a']) { const cells = [];
    for (const [deg, n] of [[1, 360], [7.3, 50]]) { const rng = mulberry32(8); const t = mk(); for (let r = 0; r < 300 * N; r++) { const v0 = [pickV(rng, 500), pickV(rng, 500)]; const s = new Slot(v0, m); const ops = []; for (let i = 0; i < n; i++) ops.push(s.do({ k: 'rot', a: deg })); for (let i = n - 1; i >= 0; i--) s.undo(ops[i]); t.add(s, v0); } cells.push(cell(t)); sig[`a5rot_${m}_${deg}`] = [t.badA, t.maxA]; }
    { const rng = mulberry32(9); const t = mk(); let kept = 0; for (let r = 0; r < 1000 * N; r++) { const v0 = [pickV(rng, 500), pickV(rng, 500)]; const s = new Slot(v0, m); const ai = []; const hu = [];
        for (let i = 0; i < 10; i++) { ai.push(s.do({ k: 'rot', a: pickV(rng, 180) })); hu.push(s.do({ k: 'add', a: [pickV(rng, 20), pickV(rng, 20)] })); }
        for (let i = 9; i >= 0; i--) if (!s.undo(ai[i])) kept++; t.add(s, replayOps(v0, hu)); }
      cells.push(m === '2a' ? `残した ${kept} 個（全部）` : cell(t)); sig[`a5rotmix_${m}`] = [t.badA, t.maxA, kept]; }
    { const s = new Slot([123.4567, -89.0123], m); const x = s.do({ k: 'rot', a: 33.3 }); s.do({ k: 'add', a: [5, -3] }); const full = s.v; let bad = 0; let max = 0; for (let i = 0; i < 5000 * N; i++) { s.undo(x); s.redo(x); const d = dist(s.v, full); if (d) bad++; if (d > max) max = d; } cells.push(m === '2a' ? '（残す）' : `${bad}・最大 ${fmt(max)}`); sig[`a5rotur_${m}`] = [bad, max]; }
    P(`| ${NAME[m]} | ${cells.join(' | ')} |`); }
  P('\n- 点に焼いた回転の上に「点を動かす」が乗った時、方式1 の答え（逆に回す＝人の動かした量も一緒に回る）と、方式3 の答え（人の動かした量は、そのままの向きで残る）は、**丸めの分ではなく、意味として違う**。下の A-6 の「回す × 足す」。');

  // ───── A-6 順番
  P('\n### A-6 順番が違う時の結果（同じ値の道に、2つの操作を、順番を入れかえて当てる。2 万通り。違い＝2つの結果の差）\n');
  P('| 組 | 違った回 | 最大の違い（格子）| 違いの大きさ | 分類 |'); P('|---|---|---|---|---|');
  const pairs = [
    ['足す × 足す', () => ({ k: 'add', a: 0 }), (r) => [{ k: 'add', a: pickV(r, 100) }, { k: 'add', a: pickV(r, 100) }], 'num'],
    ['掛ける × 掛ける（比 0.5〜2）', null, (r) => [{ k: 'mul', a: rf(r, 0.5, 2) }, { k: 'mul', a: rf(r, 0.5, 2) }], 'num'],
    ['掛ける × 掛ける（比 0.01〜100）', null, (r) => [{ k: 'mul', a: rf(r, 0.01, 100) }, { k: 'mul', a: rf(r, 0.01, 100) }], 'num'],
    ['掛ける × 掛ける（比 0.0001〜0.01 と 100〜10000）', null, (r) => [{ k: 'mul', a: rf(r, 0.0001, 0.01) }, { k: 'mul', a: rf(r, 100, 10000) }], 'num'],
    ['反転（−1）× 掛ける', null, (r) => [{ k: 'mul', a: -1 }, { k: 'mul', a: rf(r, 0.01, 100) }], 'num'],
    ['反転（−1）× 足す', null, (r) => [{ k: 'mul', a: -1 }, { k: 'add', a: pickV(r, 100) }], 'num'],
    ['掛ける × 足す（伸ばす→動かす／動かす→伸ばす。同じ値の道）', null, (r) => [{ k: 'mul', a: rf(r, 0.5, 2) }, { k: 'add', a: pickV(r, 100) }], 'num'],
    ['回す（点に焼く）× 回す（点に焼く）', null, (r) => [{ k: 'rot', a: pickV(r, 180) }, { k: 'rot', a: pickV(r, 180) }], 'vec'],
    ['回す（点に焼く）× 足す（点を動かす）', null, (r) => [{ k: 'rot', a: pickV(r, 180) }, { k: 'add', a: [pickV(r, 20), pickV(r, 20)] }], 'vec'],
    ['回す（点に焼く）× 掛ける（縦横同じ比）', null, (r) => [{ k: 'rot', a: pickV(r, 180) }, { k: 'mul', a: [rf(r, 0.5, 2)] }], 'vec'],
    ['回す（点に焼く）× 掛ける（縦横で違う比）', null, (r) => [{ k: 'rot', a: pickV(r, 180) }, { k: 'mul', a: [rf(r, 0.5, 2), rf(r, 0.5, 2)] }], 'vec'],
  ];
  for (const [label, , make, type] of pairs) { const rng = mulberry32(2026); let bad = 0; let max = 0; let n = 0;
    for (let i = 0; i < 20000 * N; i++) { const v = type === 'num' ? pickV(rng, 1000) : [pickV(rng, 500), pickV(rng, 500)]; const [a, b] = make(rng); n++; const d = dist(step(step(v, a), b), step(step(v, b), a)); if (d) bad++; if (d > max) max = d; }
    const cls = bad === 0 ? '**変わらない**' : /足す|違う比/.test(label.split('×')[1]) ? '**意味として変わる**（丸めなしでも違う）' : max > 200 ? '丸めの分だけ変わる（桁が落ちるので大きい）' : '丸めの分だけ変わる';
    P(`| ${label} | ${bad}/${n}（${(100 * bad / n).toFixed(1)}%）| ${fmt(max)} | ${max === 0 ? '—' : max < 1000 ? `${(max / GRID).toPrecision(2)} まで（画素・比・度）` : `${(max / GRID).toFixed(1)} まで`} | ${cls} |`); sig[`a6_${label}`] = [bad, max]; }
  P('\n- 「置きかえ」が入る組（置きかえ × 足す・置きかえ × 掛ける・置きかえ × 置きかえ）は、計算するまでもなく、あとの物が勝つ（順番で結果が変わる）。核を通した表は `tools/ordercheck.js`。');
  P('- 3b（最後に1回だけ丸める）で持つと、「掛ける × 掛ける」の違いは 0 になる（下）。');
  { const rng = mulberry32(2027); let bad = 0; for (let i = 0; i < 20000 * N; i++) { const v = pickV(rng, 1000); const a = { k: 'mul', a: rf(rng, 0.01, 100) }; const b = { k: 'mul', a: rf(rng, 0.01, 100) }; if (exactOps(v, [a, b]) !== exactOps(v, [b, a])) bad++; } P(`  - 3b で「掛ける × 掛ける（比 0.01〜100）」の順番を入れかえた違い：${bad} 回`); sig.a6_3b = bad; }

  // ───── A-7 0・とても小さい比・反転
  P('\n### A-7 0・とても小さい比・反転\n');
  P('「AI ×f → 人 ×g（0.5〜2）→ AI の分だけ取り消す」。物差し A＝始めの値 ×g。値 ±10（小さい値ほど桁が落ちやすい）。2 万通り。\n');
  P('| 方式 | f=0（今の核は、命令の所で断る）| f=0.0001 | f=0.001 | f=0.3333 | f=−1（反転）| f=−0.0001 |'); P('|---|---|---|---|---|---|---|');
  for (const m of METHODS) { const cells = [];
    for (const f of [0, 0.0001, 0.001, 0.3333, -1, -0.0001]) { const rng = mulberry32(64); const t = mk(); let kept = 0; let imp = 0;
      for (let r = 0; r < 20000 * N; r++) { const v0 = pickV(rng, 10); const s = new Slot(v0, m); const x = s.do({ k: 'mul', a: f }); const h = s.do({ k: 'mul', a: rf(rng, 0.5, 2) }); if (!s.undo(x)) { kept += s.kept; imp += s.impossible; } t.add(s, replayOps(v0, [h])); }
      cells.push(imp ? `できない（0 で割れない）${imp}` : kept ? `残した ${kept}` : cell(t)); sig[`a7_${m}_${f}`] = [t.badA, t.maxA, kept, imp]; }
    P(`| ${NAME[m]} | ${cells.join(' | ')} |`); }
  P('\n反転（−1）を n 回掛けたあと、人が ×g、AI の反転を全部取り消す（2000 通り。物差し A＝始めの値 ×g）：\n'); P('| 方式 | 奇数回（7 回）：違った回 | 偶数回（8 回）：違った回 | 0 の符号（−0）が出た回 |'); P('|---|---|---|---|');
  for (const m of METHODS) { const cells = []; let negz = 0;
    for (const n of [7, 8]) { const rng = mulberry32(77); let bad = 0; let kept = 0;
      for (let r = 0; r < 2000 * N; r++) { const v0 = r % 10 === 0 ? 0 : pickV(rng, 1000); const s = new Slot(v0, m); const fl = []; for (let i = 0; i < n; i++) fl.push(s.do({ k: 'mul', a: -1 })); const h = s.do({ k: 'mul', a: rf(rng, 0.5, 2) });
        for (let i = n - 1; i >= 0; i--) if (!s.undo(fl[i])) kept++; if (Object.is(s.v, -0)) negz++; if (dist(s.v, replayOps(v0, [h]))) bad++; }
      cells.push(m === '2a' ? `残した ${kept}` : String(bad)); sig[`a7flip_${m}_${n}`] = [bad, kept]; }
    P(`| ${NAME[m]} | ${cells.join(' | ')} | ${negz} |`); }

  // ───── A-8 記録の大きさ・計算の重さ
  P('\n### A-8 記録の大きさ・計算の重さ\n');
  P('| 方式 | 効果1つに要る数（数1つの値／[x,y] の値）| 取り消し1回の計算 | 記録からの作り直し（replay）との相性 |'); P('|---|---|---|---|');
  P('| 1 逆向きを当てる | 比だけ：1／2 | 割り算1回 | 作り直しでも同じ割り算をするので合う。ただし、ずれた値も同じように作り直される |');
  P('| 2 before へ戻す | 比＋前の値＋後の値：3／6（今の核の `mul` と同じ）| 置くだけ（2b は、あとの操作の数だけ掛け算）| 合う。before は、作り直しの時に核が計算し直す（記録には入れない）|');
  P('| 3a 組み立て直す（1つごとに丸める）| 比だけでよい：1／2（核は、当てる時の検査のために before・after も持つ）| その値の道の「最後の置きかえ」から今までの、残っている操作の数だけ掛け算 | **合う**：取り消したあとの値＝「その操作を抜いた記録から作り直した値」と同じ計算になる |');
  P('| 3b 組み立て直す（最後に1回丸める）| 比だけ：1／2 | 同じ数だけの、桁の長い整数の掛け算。**ふつうの掛ける操作も毎回これをする** | 合うが、文書の値が「今の値＋命令」では決まらず、記録が要る（核の「文書＋命令 → 結果」が崩れる）|');
  if (!opt.quick && typeof performance !== 'undefined') { P('\n取り消し1回にかかる時間の目安（同じ値の道に、残っている操作が k 個）：\n'); P('| k | 3a（1つごとに丸める）| 3b（最後に1回丸める）| 3b の途中の整数の桁 |'); P('|---|---|---|---|');
    for (const k of [10, 100, 1000, 10000]) { const rng = mulberry32(1); const ops = []; for (let i = 0; i < k; i++) ops.push({ k: 'mul', a: rf(rng, 0.5, 2) }); const reps = k >= 10000 ? 3 : k >= 1000 ? 20 : 300;
      let t0 = performance.now(); for (let i = 0; i < reps; i++) replayOps(123.4567, ops); const ta = (performance.now() - t0) / reps;
      t0 = performance.now(); for (let i = 0; i < Math.max(1, reps / 10); i++) exactOps(123.4567, ops); const tb = (performance.now() - t0) / Math.max(1, reps / 10);
      let n = 1n; for (const o of ops) n *= BigInt(g(o.a)); P(`| ${k} | ${ta.toFixed(3)} ms | ${tb.toFixed(3)} ms | 約 ${n.toString().length} 桁 |`); } }

  // ───── A-9 核を通す（revert の scale:'rebuild'）。ブラウザと Node の突き合わせにも使う
  P('\n### A-9 核を通す：AI ×f と 人 ×g を交互に 6 組 → AI の分を1つずつ `scale` を変えて戻す（60 通り。比 0.01〜100）\n'); P('| revert の scale | 人の操作だけの文書と同じになった回 | 戻さずに残した効果 | 記録から作り直して同じ文書 | 文書の印 |'); P('|---|---|---|---|---|');
  { const S = (v) => ({ k: 'static', v }); const HU = { sender: { k: 'human', device: 'mac' } }; const AI = { sender: { k: 'ai', agent: 'w' } }; const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai' } };
    for (const mode of ['divide', 'keep', 'rebuild']) { const rng = mulberry32(404); let okN = 0; let kept = 0; let rp = 0; const hs = []; const runs = Math.max(6, Math.round(60 * N));
      for (let t = 0; t < runs; t++) { let n = 0; const v0 = [pickV(rng, 100), pickV(rng, 100)];
        const mkS = () => { const st = createState(INIT); return applyBatch(st, [{ id: 'n', v: 1, actor: { k: 'human', device: 'mac' }, base: {}, body: { type: 'node.add', node: { id: 'A', scene: 's1', kind: 'shape', name: 'A', order: 'i', geo: { t: 'ellipse', size: S([4, 4]) }, xf: { scale: S(v0) } } } }], HU).state; };
        const run = (st, body, ctx) => { const a = ctx.sender; const r = applyBatch(st, [{ id: `c${++n}`, v: 1, actor: a.k === 'human' ? { k: 'human', device: a.device } : { k: 'ai', agent: a.agent, task: 't' }, base: { ...st.doc.revs }, body }], ctx); if (r.status !== 'applied') throw new Error(r.message); return r; };
        let a = mkS(); let b = mkS(); const ai = [];
        for (let i = 0; i < 6; i++) { const f = [rf(rng, 0.01, 100)]; const gq = [rf(rng, 0.5, 2), rf(rng, 0.5, 2)]; let r = run(a, { type: 'prop.scale', node: 'A', path: 'xf.scale', f }, AI); a = r.state; ai.push(r.applied[0].cmd.id); a = run(a, { type: 'prop.scale', node: 'A', path: 'xf.scale', f: gq }, HU).state; b = run(b, { type: 'prop.scale', node: 'A', path: 'xf.scale', f: gq }, HU).state; }
        for (const id of ai.slice().reverse()) { const r = run(a, { type: 'revert', mode: 'select', targets: [id], scale: mode }, HU); a = r.state; kept += r.tally.ask; }
        if (canon(a.doc.nodes.A.xf.scale) === canon(b.doc.nodes.A.xf.scale)) okN++; const back = replay(INIT, JSON.parse(JSON.stringify(toEntries(a.log)))); if (!back.skipped.length && canon(back.state.doc) === canon(a.doc)) rp++; hs.push(hash(canon(content(a.doc)))); }
      const h = hash(hs.join()); P(`| ${mode === 'divide' ? 'divide（方式1：割る。今の既定）' : mode === 'keep' ? 'keep（方式2：上に掛け算があれば残す）' : 'rebuild（方式3：記録から組み立て直す）'} | ${okN}/${runs} | ${kept} | ${rp}/${runs} | ${h} |`); sig[`core_${mode}`] = [okN, kept, rp, h]; } }

  sig.all = hash(canon(sig));
  return { text: out.join('\n'), sig };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('numcheck3.js')) {
  const r = runAll({ quick: process.argv.includes('--quick') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(r.sig)); else { console.log(r.text); console.log(`\n突き合わせ用の印：${r.sig.all}`); }
}
