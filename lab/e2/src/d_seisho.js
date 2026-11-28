/* 工程 4（D）清書：部品ごとに点を減らし、取っ手を整える。形は変えない。
   やり方：外から見える輪郭（影絵の輪郭の一部）は、lab/p4/geom.js の清書（曲線あてはめ）で少ない点に直す（ずれてよい幅 TOL）。
   ほかの部品の下にもぐる側（重なり代）は、少ない点で書き直す（外からは見えない／影絵は変わらない）。 */
const U = require('./util.js'), B = require('./b_silhouette.js'), C = require('./c_parts.js');
const G = U.G, SIL = C.SIL, I4 = B.IDX4;
const cp = q => JSON.parse(JSON.stringify(q));
/* r4 の番号 i〜j の輪郭の点（足の丸みの点も入る） */
function rng(i, j) { const out = [], n = SIL.length; for (let k = I4[i]; ; k = (k + 1) % n) { out.push(cp(SIL[k])); if (k === I4[j]) break; } return out; }
/* 2 つの並びを、角を作らずになめらかにつなぐ（あいだの点は捨てる） */
function bridge(a, b) { const x = a[a.length - 1], y = b[0]; delete x.out; delete x.corner; delete y.in; delete y.corner; return a.concat(b); }
function fit(ptsArr, tol) {
  const a = ptsArr[0], b = ptsArr[ptsArr.length - 1]; delete a.in; delete b.out;
  const r = G.seisho({ geo: { t: 'path', pts: ptsArr, closed: false } }, tol);
  return r.map(q => { const o = { p: q.p }; if (q.in) o.in = q.in; if (q.out) o.out = q.out; if (q.corner) o.corner = true; return o; });
}
/* r3：脚は、足の裏の丸み（4 点）と平らな底をそのまま残し、左右のふちだけをあてはめる（まとめてあてはめると底が波打った） */
function legFit(i0, c1, c2, i1, tol) {
  const n = SIL.length, at = k => cp(SIL[((k % n) + n) % n]), seq = (a, b) => { const o = []; for (let k = a; k <= b; k++) o.push(at(k)); return o; };
  const a = I4[i0], A1 = I4[c1], B1 = I4[c2], b = I4[i1] < a ? I4[i1] + n : I4[i1];
  const s1 = fit(seq(a, A1), tol), s2 = fit(seq(B1 + 1, b), tol);
  const e = s1[s1.length - 1]; e.out = at(A1).out; delete e.corner;
  const f = s2[0]; f.in = at(B1 + 1).in; delete f.corner;
  return s1.concat([at(A1 + 1), at(B1)], s2);
}
const inner = C.inner, P = C.P;
function part(id, name, fill, segs, extra) {
  const ptsArr = [].concat(...segs).map((q, i) => Object.assign({}, q, { id: id + '.' + i }));
  return Object.assign({ id, name, kind: 'shape', parent: null, visible: true, locked: false, geo: { t: 'path', pts: ptsArr, closed: true }, fill, stroke: null }, extra || {});
}
const W = { far: '#6E6075', body: '#8C7B90', a: '#7B6B80', b: '#A796AA' };
function nodes(T) {
  T = T || {};
  const DEF = { legHF: 2, legFF: 2, legHN: 2, legFN: 2, earN: 1.0, earF: 1.0, tail: 1.2 };   /* r2：足の裏が波打ったので脚は幅を 1.2 に。耳・しっぽも細かく */
  const t = k => (T[k] != null ? T[k] : (DEF[k] != null ? DEF[k] : 2.2));
  const N = [];
  N.push(part('legHF', '後ろ脚（奥）', W.far, [legFit(36, 38, 39, 41, t('legHF')), inner([[1040, 580], [1110, 585]])], { pivot: P.legHF, rigParent: 'torso' }));
  N.push(part('legFF', '前脚（奥）', W.far, [legFit(48, 50, 51, 53, t('legFF')), inner([[590, 578], [650, 588]])], { pivot: P.legFF, rigParent: 'torso' }));
  N.push(part('tail', 'しっぽ', W.a, [fit(rng(24, 29), t('tail')), inner([[1297, 430]])], { pivot: P.tail, rigParent: 'torso' }));
  N.push(part('torso', '胴', W.body, [
    fit(bridge(rng(17, 24), rng(29, 31)), t('torso')), inner([[1240, 656]]), fit(rng(41, 43), t('belly')), fit(rng(53, 54), 1.5),
    inner([[462, 462]])], { pivot: null, rigParent: null }));
  N.push(part('legHN', '後ろ脚（手前）', W.a, [legFit(31, 33, 34, 36, t('legHN')), inner([[1160, 545], [1262, 520]])], { pivot: P.legHN, rigParent: 'torso' }));
  N.push(part('legFN', '前脚（手前）', W.a, [legFit(43, 45, 46, 48, t('legFN')), inner([[682, 560], [788, 560]])], { pivot: P.legFN, rigParent: 'torso' }));
  N.push(U.group('gHead', '頭のまとまり', { pivot: P.head, rigParent: 'torso' }));
  N.push(part('earF', '耳（奥）', W.far, [fit(rng(8, 12), t('earF')), inner([[486, 364]])], { parent: 'gHead', pivot: P.earF, rigParent: 'head' }));
  N.push(part('jaw', '下あご', W.a, [fit(rng(54, 58), t('jaw')), inner([[330, 546], [545, 540]])], { parent: 'gHead', pivot: P.jaw, rigParent: 'head' }));
  N.push(part('head', '頭', W.b, [fit(bridge(rng(58, 7), rng(18, 18)), t('head')), inner([[662, 440], [600, 590], [478, 577], [340, 591]])   /* r4（仕上げの段から戻った）：口の線になる下のふちが後ろで上がり、笑った口に見えた → 口の端を下げて水平に近く。影絵は変わらない */], { parent: 'gHead', pivot: P.head, rigParent: 'torso' }));
  N.push(part('earN', '耳（手前）', W.a, [fit(rng(13, 17), t('earN')), inner([[528, 364], [499, 351]])], { parent: 'gHead', pivot: P.earN, rigParent: 'head' }));
  return N;
}
function build(T) { const N = nodes(T); return U.doc(N, { stage: 'D', motion: C.MOTION, parts: C.table(N), tol: T || {}, note: '色は仮。清書：見える輪郭は曲線あてはめ、もぐる側は書き直し' }); }
module.exports = { build, nodes, fit, rng, bridge, part };
if (require.main === module) { const T = process.argv[2] ? JSON.parse(process.argv[2]) : undefined; U.save(process.argv[3] || 's4_D_seisho.json', build(T)); console.log('D ok'); }
