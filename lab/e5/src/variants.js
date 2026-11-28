/* lab/e5 src/variants.js — 版ごとの「影絵の作り方」。座標は、ことわりが無ければ元の座標（lab/e2 の影絵 r4 と同じ。kaba5.js の R4 の番号）。
   どの版も、点の数（影絵 59 点）・部品の数・線の本数・色は同じ。動かすのは点の場所と、角かなめらかか、だけ。 */
const U = require('./util.js'), G = U.G;
const V = {};
const merge = (...fs) => (i, a) => { let o = null; for (const f of fs) { const r = f(i, o || a.slice()); if (r) o = r; } return o; };
const table = T => (i, a) => { const t = T[i]; if (!t) return null; const o = [t[0] == null ? a[0] : t[0], t[1] == null ? a[1] : t[1]]; const c = t.length > 2 ? t[2] : a[2]; if (c) o.push(c); return o; };

/* ---- B：関節の所だけ、輪郭の細かい出入りをならす（動きの表は見ない） ---- */
const B_SRC = {
  47: [684, null], 49: [632, null], 35: [1172, null], 37: [1102, null],   /* 脚のあいだ：足首の点を足の裏の端と同じ x に（脚の内がわをまっすぐ立てる。根元が広がって三角のアーチになるのをやめる） */
  53: [552, 640],                                                          /* 胸の角を浅く */
  24: [1310, 400, 0],                                                      /* しっぽの根の上の角をなめらかに */
  12: [494, 342, 'c'], 13: [510, 340, 'c'],                                /* 耳と耳のあいだの切れこみを少し広く */
};
const B_LOG = ['脚のあいだ（番号 35・37・47・49）：足首の点を、足の裏の端と同じ x に（6・4・2・2 動かす）。脚の内がわがまっすぐ立ち、アーチが三角から逆 U に',
  '胸の角（53）：(560,646) → (552,640)', 'しっぽの根の上（24）：角 → なめらか', '耳のあいだ（12・13）：2 ずつ外へ（切れこみを 12 → 16 に）'];
V.B = { title: '関節の所だけ輪郭を単純に', opt: () => ({ src: table(B_SRC) }), log: B_LOG };

/* ---- C：動きの表（motions.json の range）を先に決めてから作る ----
   頭 −15〜＋12：付け根は首の上のつなぎ目（18）の真下に置いたまま（上のつなぎ目で、輪郭が付け根を中心にした円の向き＝すべるだけ）。
     あごの下は円の向きにできない（あごが垂れた形と両立しない）ので、胴の側に「受け」を持たせる：胴のもぐる側を、あごの下・頭の上の線のすぐ内がわまで前へ伸ばす（頭が上がって あごが離れても、下から同じ線が出る）。
   しっぽ ±25：しっぽとおしりのあいだが、細い切れこみ（幅 6）になっていた。しっぽを先で 16 ほど外へ振り出し、根の股を広い角に（回しても、細い切れこみにならない）。
   脚 ±15／±13：脚のあいだは B と同じ逆 U。脚を回すと足の先が 30〜40 動き、すき間（52・70）は動きの中で必ず細くなる。これは形では防げない（RESULTS ⑥）。
   耳 ±20：耳と耳のあいだを B と同じに広げる。 */
const C_SRC = Object.assign({}, B_SRC, {
  25: [1346, 448], 26: [1362, 512], 27: [1354, 546], 28: [1342, 512], 29: [1322, 458, 'c'],
});
delete C_SRC[24];
const C_INN = { torso: [[520, 606], [452, 536], [444, 440], [490, 366]] };
const C_LOG = ['脚のあいだ・胸の角・耳のあいだ：B と同じ', 'しっぽ（25〜29）：先を外へ振り出す（25 +4、26 +14、27 +16、28 +14。29 は 4 上へ）。おしりとのあいだの幅 6 の切れこみを、広い股に',
  '胴のもぐる側（影絵の外には出ない）：(462,462) の 1 点 → (520,606)・(452,536)・(444,440)・(490,366) の 4 点。あごの下と頭の上を、胴が下から受ける', '付け根：A と同じ'];
V.C = { title: '関節の場所と回す範囲を先に決めて作る', opt: () => ({ src: table(C_SRC), inn: C_INN }), log: C_LOG };

/* ---- D：関節の丸みを考える（付け根を中心にした円が影絵に入りきる所に付け根を置き、回る側のもぐる端を、その円にする） ---- */
function geom(K, P, opt) {
  const r = K.build(P, opt), ss = G.segs(r.SIL, true), poly = [];
  for (const s of ss) for (let j = 0; j < 24; j++) poly.push(G.bez(s, j / 24));
  const clear = p => { let d = 1e9; for (const q of poly) d = Math.min(d, Math.hypot(q[0] - p[0], q[1] - p[1])); let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins ? d : -d; };
  const J = i => { const q = r.rf.pts[r.I4[i]]; return [q[0], q[1]]; };
  return { r, clear, J };
}
/* つなぎ目（番号 i0 から i1 へ、影絵の向きに部品の見える輪郭が進む）：真ん中・半分の長さ h・体の中へ向かう向き u */
function seam(g, i0, i1) {
  const a = g.J(i0), b = g.J(i1), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], h = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
  let u = [-(b[1] - a[1]) / (2 * h), (b[0] - a[0]) / (2 * h)];
  if (g.clear([mid[0] + u[0] * h * 0.6, mid[1] + u[1] * h * 0.6]) < g.clear([mid[0] - u[0] * h * 0.6, mid[1] - u[1] * h * 0.6])) u = [-u[0], -u[1]];
  return { a, b, mid, h, u };
}
/* 付け根 p を中心に半径 r の半円（もぐる側）。見える輪郭の終わり b から始まり a へ戻る向き。3 点（取っ手つき） */
function arc(p, r, u, bEnd) {
  const k = 0.5523 * r, n0 = [-u[1], u[0]], sg = ((bEnd[0] - p[0]) * n0[0] + (bEnd[1] - p[1]) * n0[1]) >= 0 ? 1 : -1, n = [n0[0] * sg, n0[1] * sg];
  return [
    { p: [p[0] + n[0] * r, p[1] + n[1] * r], in: [-u[0] * k, -u[1] * k], out: [u[0] * k, u[1] * k] },
    { p: [p[0] + u[0] * r, p[1] + u[1] * r], in: [n[0] * k, n[1] * k], out: [-n[0] * k, -n[1] * k] },
    { p: [p[0] - n[0] * r, p[1] - n[1] * r], in: [u[0] * k, u[1] * k], out: [-u[0] * k, -u[1] * k] }];
}
const D_PARTS = { legFN: [43, 48], legFF: [48, 53], legHN: [31, 36], legHF: [36, 41], tail: [24, 29], earN: [13, 17], earF: [8, 12] };
/* D は影絵の輪郭を動かさない：下の決まりで付け根を置くと、頭のほかは、半径 h の円が影絵に入りきった（h の 1.33〜1.41 倍）ので、直す所が無かった */
const D_SRC = {};
function dOpt(K, P, base, log) {
  const g = geom(K, P, base), pvAbs = {}, innAbs = {};
  for (const key in D_PARTS) {
    const [i0, i1] = D_PARTS[key], s = seam(g, i0, i1);
    let d = s.h, p, c;                                         /* 付け根＝つなぎ目の真ん中から、体の中へ h。そこで半径 h の円が入らなければ、入る所まで（深い方へ探し、だめなら浅い方へ） */
    const at = dd => [s.mid[0] + s.u[0] * dd, s.mid[1] + s.u[1] * dd];
    let best = null;
    for (let dd = s.h; dd <= s.h * 1.8; dd += 1) { const cc = g.clear(at(dd)); if (cc >= s.h) { best = dd; break; } }
    if (best === null) { let m = -1; for (let dd = 0; dd <= s.h * 1.8; dd += 1) { const cc = g.clear(at(dd)); if (cc > m) { m = cc; best = dd; } } }
    d = best; p = at(d); c = g.clear(p);
    const rr = Math.min(s.h, c - 1.5);
    pvAbs[key] = () => p;
    innAbs[key] = () => arc(p, rr, s.u, s.b);
    log.push(key + '：つなぎ目 ' + i0 + '–' + i1 + '（半分の長さ h=' + Math.round(s.h) + '）。付け根＝つなぎ目の真ん中から体の中へ ' + Math.round(d) + '。そこで影絵に入る円の半径 ' + Math.round(c) + '（h の ' + (c / s.h).toFixed(2) + ' 倍）。もぐる端＝半径 ' + Math.round(rr) + ' の半円（3 点）');
  }
  /* 頭：付け根は首の上のつなぎ目（18）の真下（A と同じ）。もぐる端（ほおの線。首の影との境で見える）を、付け根を中心にした円に */
  const pvA = g.r.pv.head, t = g.J(18), R = Math.hypot(t[0] - pvA[0], t[1] - pvA[1]), k = 0.5523 * R, ch = g.clear(pvA), sh = seam(g, 18, 54);
  innAbs.head = (M, pv, f) => [
    { p: [pvA[0] + R, pvA[1]], in: [0, -k], out: [0, k] }].concat([[600, 590], [478, 577], [340, 591]].map(a => ({ p: f(a) })));
  const neckAbs = M => { const a = M.head([597, 336]), b = M.head([608, 600]); return [[a[0], a[1], 'c'], [pvA[0] + R + 20, pvA[1] + 6], [b[0], b[1], 'c'], [pvA[0] + R - 12, pvA[1] + 6]]; };
  log.push('頭：つなぎ目 18–54（h=' + Math.round(sh.h) + '）。付け根は A と同じ（首の上のつなぎ目の真下）。そこで影絵に入る円の半径 ' + Math.round(ch) + '（h の ' + (ch / sh.h).toFixed(2) + ' 倍。h の円が入るのは肩の真ん中だけで、そこを付け根にすると頭の円が肩と手前の前脚を隠すので、採らなかった）。もぐる端（ほおの線）の上半分＝付け根を中心に半径 ' + Math.round(R) + ' の円（下半分は A と同じ点）。首の影も、その円に沿わせた');
  return Object.assign({}, base, { pvAbs, innAbs, neckAbs });
}
const D_LOG0 = ['影絵の輪郭は A のまま（円が入りきらない所は、頭だけ。頭は比を変えないと入らないので、直していない）'];
V.D = { title: '関節の丸みを考える（円が入る所に付け根・もぐる端を円に）', opt: (K, P) => { V.D.log = D_LOG0.slice(); return dOpt(K, P, { src: table(D_SRC) }, V.D.log); }, log: [] };

/* ---- E：B＋C＋D ---- */
const E_SRC = C_SRC;
V.E = { title: '組み合わせ（B＋C＋D）', opt: (K, P) => { V.E.log = ['影絵：C の直し（B を含む）', '胴のもぐる側：C と同じ', '付け根・もぐる端：D の決まり（C の影絵の上で置き直す）']; return dOpt(K, P, { src: table(E_SRC), inn: C_INN }, V.E.log); }, log: [] };
V.A = { title: '通常の影絵（E3 の L2 のまま）', opt: () => ({}), log: ['E3 の L2 のまま。付け根は絵のデータの pivot（E4 の版1 と同じ決まり）'] };
/* ---- F（参考）：E の上で、奥の脚を手前の脚の後ろへ寄せて、脚のあいだのすき間をなくす（P4 と同じ考え）。
   腹の下の空きの幅と、胸の角の場所が変わる＝止まった絵をはっきり変える版。「両立しない所」を数字で見るための物 ---- */
const F_POST = (i, q) => { if (i >= 49 && i <= 52) return [q[0] + 58, q[1]]; if (i === 53) return [q[0] + 40, q[1] + 6]; if (i >= 37 && i <= 41) return [q[0] + 76, q[1]]; return null; };
V.F = { title: '（参考）E＋脚のあいだのすき間をなくす', opt: (K, P) => { V.F.log = ['影絵：E と同じ直し＋奥の前脚（49〜52）を 58 後ろへ・胸の角（53）を 40 後ろへ 6 下へ／奥の後ろ脚（37〜41）を 76 後ろへ（当てはめたあとの座標で）', '胴のもぐる側・付け根・もぐる端：E と同じ決まり']; return dOpt(K, P, { src: table(E_SRC), inn: C_INN, post: F_POST }, V.F.log); }, log: [] };
module.exports = { V: { A: V.A, B: V.B, C: V.C, D: V.D, E: V.E, F: V.F } };
