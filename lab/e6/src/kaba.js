/* lab/e6 src/kaba.js — lab/e3/src/kaba.js の写しに、変数を足した物（X0。全部が既定の値なら E3 と同じ形）。
   母カバを、数字（変数）だけで形が変わる作りにした元。
   工程は E2 と同じ順：B 影絵（1色・1枚の輪郭）→ C/D 部品に割って清書 → E 仕上げ。
   元の点は lab/e2 の影絵 r4（59 点）。それぞれの点が「頭・耳・胴の上・しっぽ・脚と腹」のどれかに属し、
   変数は、そのまとまりの動かし方（大きさ・長さ・高さ）だけを決める。部品・線・細部の数は、どの版でも同じ。 */
const U = require('./util.js'), G = U.G, PAL = U.PAL;

/* ---- 変数：全部「実物の比＝1」に対する倍率（＋が付く物は足し算）。REAL が L1 ---- */
const REAL = { head: 1, muz: 1, sq: 0, tL: 1, tH: 1, arch: 0, sag: 1, legLen: 1, legW: 1, ank: 0, ear: 1, eye: 1, eyeDown: 0, tailW: 1, tailL: 1 };
const L3   = { head: 1.30, muz: 1.12, sq: 1, tL: 0.88, tH: 1.15, arch: 0.05, sag: 1.4, legLen: 0.55, legW: 1.12, ank: 0.10, ear: 1.6, eye: 1.7, eyeDown: 0.02, tailW: 1.3, tailL: 0.85 };
const ADD = ['sq', 'arch', 'ank', 'eyeDown'];          /* 足し算の変数（ほかは掛け算＝段のあいだは等比で刻む） */
const GROUPS = { 頭: ['head', 'muz', 'sq'], 胴: ['tL', 'tH', 'arch', 'sag'], 脚: ['legLen', 'legW', 'ank'], 小物: ['ear', 'eye', 'eyeDown', 'tailW', 'tailL'] };
const NAMES = { head: '頭の大きさ', muz: '鼻づらの大きさ（頭に対して）', sq: '鼻づらの角ばり（+）', tL: '胴の長さ', tH: '胴の高さ', arch: '背中のふくらみ（+ 胴の高さに対して）', sag: '腹のたるみ', legLen: '脚の長さ（腹から地面）', legW: '脚の太さ', ank: '足首の絞り（+ 脚の太さに対して）', ear: '耳の大きさ（頭に対して）', eye: '目の大きさ（頭に対して）', eyeDown: '目の位置（+ 下へ・頭の長さに対して）', tailW: 'しっぽの太さ', tailL: 'しっぽの長さ' };
/* ---- E6 で足した変数（既定＝E3 と同じ形になる値） ----
   legPts：脚のふちの途中の点 [[高さ（0＝地面・1＝腹）, 前のふちの内への寄せ, 後ろのふちの内への寄せ], …]（寄せは脚の太さの半分に対して。－は外へ）。null なら [[0.4, ank, ank]]
   footF・footR：足の裏の前・後ろの角を外へ出す量（脚の太さの半分に対して。－は内へ）／cornF・cornR：足の裏の角の丸みの半径
   gapK：手前と奥の脚のあいだ（前 52・後ろ 70）の倍率／nailK：つめの大きさ／nailN：つめの数
   archPos：背中の山のいちばん高い所（0＝首・1＝おしり）／eyeDx：目を後ろへ（頭の長さ 356 に対して）／eyeWhite：目のまわりを白に／lid：まぶた（0＝なし。目の上から、黒目の高さの何割までおおうか）
   earW：耳の幅／earBack：耳を後ろへ（E2 の画素）／mMid・mEnd：口の線の真ん中・奥のはしを下へ（E2 の画素。－は上）／nosDx・nosDy：鼻の穴の位置（E2 の画素） */
const X0 = { legPts: null, footF: 0, footR: 0, cornF: 14, cornR: 14, gapK: 1, nailK: 1, nailN: 3, archPos: 0.5, eyeDx: 0, eyeWhite: 0, lid: 0, earW: 1, earBack: 0, mMid: 0, mEnd: 0, nosDx: 0, nosDy: 0 };
function at(t) { const o = {}; for (const k in REAL) o[k] = ADD.includes(k) ? REAL[k] + (L3[k] - REAL[k]) * t : Math.pow(L3[k], t); return o; }
function mix(tBase, group, tGroup) { const a = at(tBase), b = at(tGroup); for (const k of GROUPS[group]) a[k] = b[k]; return a; }

/* ---- 元の輪郭（lab/e2 の影絵 r4。頭は左・地面 y=770） ---- */
const R4 = [
  [210, 505], [216, 436], [254, 388], [308, 386], [366, 414], [408, 380], [440, 352], [470, 352],
  [476, 346, 'c'], [466, 318], [478, 298], [494, 318], [496, 340, 'c'],
  [508, 338, 'c'], [506, 300], [528, 280], [548, 304], [548, 334, 'c'],
  [600, 326], [690, 306], [860, 294], [1020, 290], [1170, 306], [1265, 350],
  [1310, 400, 'c'], [1342, 450], [1348, 515], [1338, 548], [1328, 515], [1322, 462, 'c'],
  [1322, 540], [1310, 620], [1288, 700], [1286, 770, 'c'], [1172, 770, 'c'], [1166, 720],
  [1136, 668], [1106, 720], [1102, 770, 'c'], [1008, 770, 'c'], [1002, 720],
  [1000, 662, 'c'], [896, 678], [802, 662, 'c'],
  [796, 720], [792, 770, 'c'], [684, 770, 'c'], [682, 720],
  [658, 666], [634, 720], [632, 770, 'c'], [542, 770, 'c'], [540, 720],
  [560, 646], [538, 616], [470, 626], [380, 618], [296, 606], [230, 572]
];
/* 実物の比（lab/e2 の工程 1 の表から）と、E2 の絵の値とのちがい：
   E2 は 耳 ×1.4（0.12 → 0.17）・目 ×1.3・腹から地面 ×0.72（下の C0）・脚の太さ ×1.07 に崩してあった。L1 ではそれを外す。 */
const GROUND = 770, YB0 = 662, C0 = 150, SAG0 = 14, E2_EAR = 1.4, E2_EYE = 1.3, E2_LEGW = 1.07;
const NECK = [592, 432], MUZ_R = [410, 480], EARF = [486, 352], EARN = [528, 346];
const SQ = { 0: [-4, 0], 1: [-8, -12], 2: [-8, -8], 57: [-8, 6], 58: [-10, 12] };       /* 角ばり 1 のとき、鼻づらの点を外へ出す量 */
const PINCH = { 32: -1, 35: 1, 37: -1, 40: 1, 44: -1, 47: 1, 49: -1, 52: 1 };            /* 足首の点（脚のふちの途中）と、内向きの向き */
const LEGX = [542, 632, 684, 792, 1008, 1102, 1172, 1286, 1322];                          /* E2 の脚のふち（奥前・手前前・奥後・手前後）とおしり */
const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

function model(P) {
  P = Object.assign({}, X0, P);
  const lenK = C0 * P.legLen / (GROUND - YB0), yb = GROUND - C0 * P.legLen, wk = P.legW / E2_LEGW, XR = 1322;
  const Xup = x => XR - (1322 - x) * P.tL;
  /* 脚の並び：おしりから手前の後ろ脚、胸から奥の前脚を置き、脚のあいだのすき間は元のまま。残りが腹の幅 */
  const xc = Xup(560), W = [90, 108, 94, 114].map(w => w * wk);
  const FFf = xc - 18, FFr = FFf + W[0], FNf = FFr + 52 * P.gapK, FNr = FNf + W[1], HNr = XR - 36, HNf = HNr - W[3], HFr = HNf - 70 * P.gapK, HFf = HFr - W[2];
  const KN = [FFf, FFr, FNf, FNr, HFf, HFr, HNf, HNr, XR];
  const Xlow = x => { if (x <= LEGX[0]) return KN[0] + (x - LEGX[0]); for (let i = 1; i < LEGX.length; i++) if (x <= LEGX[i]) return KN[i - 1] + (x - LEGX[i - 1]) / (LEGX[i] - LEGX[i - 1]) * (KN[i] - KN[i - 1]); return XR + (x - 1322); };
  const Ty = y => (y >= YB0 ? GROUND - (GROUND - y) * lenK : yb - (YB0 - y) * P.tH);
  const archAt = x => P.arch * (YB0 - 290) * P.tH * Math.sin(Math.PI * Math.pow(Math.max(0, Math.min(1, (x - 600) / 710)), Math.log(0.5) / Math.log(P.archPos)));
  const up = p => [Xup(p[0]), Ty(p[1])];                               /* 胴の上（背中・おしり） */
  const top = p => [Xup(p[0]), Ty(p[1]) - archAt(p[0])];               /* 背中の線（ふくらみが乗る） */
  const low = p => [Xlow(p[0]), Ty(p[1])];                             /* 脚・腹（脚の並びに合わせる） */
  const N1 = up(NECK);
  const muz = p => { const w = sm((450 - p[0]) / 110), k = 1 + (P.muz - 1) * w; return [MUZ_R[0] + (p[0] - MUZ_R[0]) * k, MUZ_R[1] + (p[1] - MUZ_R[1]) * k]; };
  const head = p => { const q = muz(p); return [N1[0] + (q[0] - NECK[0]) * P.head, N1[1] + (q[1] - NECK[1]) * P.head]; };
  const earOf = b => p => head([b[0] + P.earBack + (p[0] - b[0]) * P.earW * P.ear / E2_EAR, b[1] - 0.2 * P.earBack + (p[1] - b[1]) * P.ear / E2_EAR]);
  const earF = earOf(EARF), earN = earOf(EARN);
  const T24 = up([1310, 400]);
  const tail = p => [T24[0] + 12 + (p[0] - 1322) * P.tailW, T24[1] + (p[1] - 400) * P.tailL];
  const legw = i => (i <= 35 ? W[3] : i <= 40 ? W[2] : i <= 47 ? W[1] : W[0]);
  const sqd = (i, p) => (SQ[i] ? [p[0] + SQ[i][0] * P.sq, p[1] + SQ[i][1] * P.sq] : p);
  const REARC = [33, 38, 45, 50], FRONTC = [34, 39, 46, 51];
  const prof = P.legPts || [[0.4, P.ank, P.ank]];
  /* 輪郭。返す：pts（点）・pos（元の点の番号 → pts の中の場所）・rad（足の裏の角の丸みの半径） */
  function outline() {
    const pts = [], pos = {}, rad = {};
    R4.forEach((a, i) => {
      const add = (q, flag) => { const o = [G.r2(q[0]), i >= 33 && a[1] === GROUND ? GROUND : G.r2(q[1])]; if (flag) o.push(flag); pts.push(o); };
      pos[i] = pts.length;
      if (PINCH[i]) {
        const sgn = PINCH[i], rear = sgn < 0, list = prof.slice().sort((u, v) => (rear ? v[0] - u[0] : u[0] - v[0]));
        for (const pr of list) { const q = [Xlow(a[0]) + sgn * (rear ? pr[2] : pr[1]) * legw(i) / 2, GROUND - pr[0] * C0 * P.legLen]; pts.push([G.r2(q[0]), G.r2(q[1])]); }
        return;
      }
      let q;
      if (i >= 54 || i <= 7) q = head(sqd(i, a));
      else if (i <= 12) q = earF(a);
      else if (i <= 17) q = earN(a);
      else if (i <= 23) q = top(a);
      else if (i === 24) q = T24;
      else if (i <= 29) q = tail(a);
      else if (i <= 31) q = up(a);
      else if (i === 42) q = [Xlow(a[0]), yb + SAG0 * P.sag];
      else if (i === 36 || i === 48) q = [Xlow(a[0]), yb + 5];
      else if (REARC.includes(i)) { q = [Xlow(a[0]) + P.footR * legw(i) / 2, GROUND]; rad[pts.length] = P.cornR; }
      else if (FRONTC.includes(i)) { q = [Xlow(a[0]) - P.footF * legw(i) / 2, GROUND]; rad[pts.length] = P.cornF; }
      else q = low(a);
      add(q, a[2]);
    });
    return { pts, pos, rad };
  }
  return { P, legw, yb, wk, lenK, KN, bellySpan: HFf - FNr, up, top, low, head, earF, earN, tail, N1, outline, Xlow, Xup, Ty };
}

/* 足の裏の角を半径 14 の丸みに（lab/e2 の r5 と同じ） */
function roundFeet(src, rad) {
  const n = src.length, KA = 0.5523, out = [], IDX = [];
  const unit = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]); return [d[0] / l, d[1] / l]; };
  const r1 = x => Math.round(x * 10) / 10;
  src.forEach((p, i) => {
    IDX[i] = out.length;
    if (!(p[2] === 'c' && p[1] === GROUND)) { out.push(p); return; }
    const R = rad[i] || 14;
    const pa = src[(i - 1 + n) % n], pb = src[(i + 1) % n], a = unit(p, pa), b = unit(p, pb);
    const A = [r1(p[0] + a[0] * R), r1(p[1] + a[1] * R)], Bp = [r1(p[0] + b[0] * R), r1(p[1] + b[1] * R)];
    const la = Math.hypot(pa[0] - A[0], pa[1] - A[1]) * 0.3, lb = Math.hypot(pb[0] - Bp[0], pb[1] - Bp[1]) * 0.3;
    out.push([A[0], A[1], { in: [r1(a[0] * la), r1(a[1] * la)], out: [r1(-a[0] * R * KA), r1(-a[1] * R * KA)] }]);
    out.push([Bp[0], Bp[1], { in: [r1(-b[0] * R * KA), r1(-b[1] * R * KA)], out: [r1(b[0] * lb), r1(b[1] * lb)] }]);
  });
  return { pts: out, IDX };
}

function build(P) {
  P = Object.assign({}, X0, P);
  const M = model(P), ol = M.outline(), rf = roundFeet(ol.pts, ol.rad), I4 = {};
  for (const k in ol.pos) I4[k] = rf.IDX[ol.pos[k]];
  /* ---- B 影絵 ---- */
  const docB = U.doc([U.shape('sil', '影絵', PAL.eye, rf.pts)], { stage: 'B', vars: P });
  const SIL = U.explicit(U.pts('sil', rf.pts), true), n = SIL.length;
  const cp = q => JSON.parse(JSON.stringify(q));
  /* ---- C・D 部品に割って清書（lab/e2 の d_seisho.js と同じやり方。もぐる側の点は、属するまとまりの動かし方で動かす） ---- */
  const rng = (i, j) => { const out = []; for (let k = I4[i]; ; k = (k + 1) % n) { out.push(cp(SIL[k])); if (k === I4[j]) break; } return out; };
  const bridge = (a, b) => { const x = a[a.length - 1], y = b[0]; delete x.out; delete x.corner; delete y.in; delete y.corner; return a.concat(b); };
  const fit = (ptsArr, tol) => { const a = ptsArr[0], b = ptsArr[ptsArr.length - 1]; delete a.in; delete b.out; return G.seisho({ geo: { t: 'path', pts: ptsArr, closed: false } }, tol).map(q => { const o = { p: q.p }; if (q.in) o.in = q.in; if (q.out) o.out = q.out; if (q.corner) o.corner = true; return o; }); };
  const legFit = (i0, c1, c2, i1, tol) => {
    const atk = k => cp(SIL[((k % n) + n) % n]), seq = (a, b) => { const o = []; for (let k = a; k <= b; k++) o.push(atk(k)); return o; };
    const a = I4[i0], A1 = I4[c1], B1 = I4[c2], b = I4[i1] < a ? I4[i1] + n : I4[i1];
    const s1 = fit(seq(a, A1), tol), s2 = fit(seq(B1 + 1, b), tol);
    const e = s1[s1.length - 1]; e.out = atk(A1).out; delete e.corner;
    const f = s2[0]; f.in = atk(B1 + 1).in; delete f.corner;
    return s1.concat([atk(A1 + 1), atk(B1)], s2);
  };
  const inn = (f, arr) => arr.map(a => { const q = f(a); return Object.assign({ p: [G.r2(q[0]), G.r2(q[1])] }, a[2] === 'c' ? { corner: true } : {}); });
  const part = (id, name, fill, segs, extra) => Object.assign({ id, name, kind: 'shape', parent: null, visible: true, locked: false, geo: { t: 'path', pts: [].concat(...segs).map((q, i) => Object.assign({}, q, { id: id + '.' + i })), closed: true }, fill, stroke: null }, extra || {});
  const pv = { head: M.N1, jaw: M.head([505, 545]), earN: M.earN([528, 338]), earF: M.earF([486, 345]), tail: M.up([1312, 428]), legFN: M.low([735, 605]), legFF: M.low([615, 605]), legHN: M.low([1222, 585]), legHF: M.low([1068, 605]) };
  for (const k in pv) pv[k] = pv[k].map(G.r2);
  const tailIn = p => { const q = M.tail(p); return [q[0], q[1]]; };
  const b = {};
  b.legHF = part('legHF', '後ろ脚（奥）', PAL.far, [legFit(36, 38, 39, 41, 2), inn(M.low, [[1040, 580], [1110, 585]])], { pivot: pv.legHF, rigParent: 'torso' });
  b.legFF = part('legFF', '前脚（奥）', PAL.far, [legFit(48, 50, 51, 53, 2), inn(M.low, [[590, 578], [650, 588]])], { pivot: pv.legFF, rigParent: 'torso' });
  b.tail = part('tail', 'しっぽ', PAL.body, [fit(rng(24, 29), 1.2), inn(tailIn, [[1297, 430]])], { pivot: pv.tail, rigParent: 'torso' });
  const tSeg = [fit(bridge(rng(17, 24), rng(29, 31)), 2.2), inn(M.low, [[1240, 656]]), fit(rng(41, 43), 2.2), fit(rng(53, 54), 1.5), inn(M.head, [[462, 462]])];
  b.torso = part('torso', '胴', PAL.body, tSeg, { pivot: null, rigParent: null });
  b.legHN = part('legHN', '後ろ脚（手前）', PAL.body, [legFit(31, 33, 34, 36, 2), inn(M.low, [[1160, 545], [1262, 520]])], { parent: 'gLegHN' });
  b.legFN = part('legFN', '前脚（手前）', PAL.body, [legFit(43, 45, 46, 48, 2), inn(M.low, [[682, 560], [788, 560]])], { parent: 'gLegFN' });
  b.earF = part('earF', '耳（奥）', PAL.far, [fit(rng(8, 12), 1.0), inn(M.earF, [[486, 364]])], { parent: 'gHead', pivot: pv.earF, rigParent: 'head' });
  b.jaw = part('jaw', '下あご', PAL.pink, [fit(rng(54, 58), 2.2), inn(M.head, [[330, 546], [545, 540]])], { parent: 'gHead', pivot: pv.jaw, rigParent: 'head' });
  b.head = part('head', '頭', PAL.body, [fit(bridge(rng(58, 7), rng(18, 18)), 2.2), inn(M.head, [[662, 440], [600, 590], [478, 577 + P.mEnd], [340, 591 + P.mMid]])], { parent: 'gHead', pivot: pv.head, rigParent: 'torso' });
  b.earN = part('earN', '耳（手前）', PAL.body, [fit(rng(13, 17), 1.0), inn(M.earN, [[528, 364], [499, 351]])], { parent: 'gEarN' });
  const docD = U.doc([b.legHF, b.legFF, b.tail, b.torso, b.legHN, b.legFN, b.earF, b.jaw, b.head, b.earN].map(cp).map(x => { x.parent = null; return x; }), { stage: 'D', vars: P });
  /* ---- E 仕上げ（lab/e2 の e_finish.js の直す前の版と同じ物を、同じ数だけ） ---- */
  const tp = U.explicit(b.torso.geo.pts, true), iA = tSeg[0].length, iEnd = iA + tSeg[2].length;
  const A = cp(tp[iA]); delete A.in; A.corner = true;
  const bel = [A]; for (let k = iA + 1; k <= iEnd; k++) bel.push(cp(tp[k]));
  const q43 = bel[bel.length - 1], nx = tp[iEnd + 1]; delete q43.out; q43.corner = true;
  const Bp = [G.r2(q43.p[0] + (nx.p[0] - q43.p[0]) * 0.42), G.r2(q43.p[1] + (nx.p[1] - q43.p[1]) * 0.42)];
  const L = (f, arr) => arr.map(a => { const q = f(a); return a[2] ? [G.r2(q[0]), G.r2(q[1]), a[2]] : [G.r2(q[0]), G.r2(q[1])]; });
  const upper = [[Bp[0], Bp[1], 'c']].concat(L(M.low, [[800, 641], [950, 616], [1110, 638]]));
  const belly = { id: 'belly', name: '腹（ピンク）', kind: 'shape', parent: null, visible: true, locked: false, fill: PAL.pink, stroke: null, follow: 'torso', geo: { t: 'path', closed: true, pts: bel.concat(U.pts('belly.u', upper)).map((q, i) => Object.assign({}, q, { id: 'belly.' + i })) } };
  const xs = SIL.map(q => q.p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const hs = P.head, ell = (id, name, fill, c, w, h, rot, extra) => U.ellipse(id, name, fill, G.r2(c[0]), G.r2(c[1]), G.r2(w), G.r2(h), rot, extra);
  const eyeK = hs * P.eye / E2_EYE, eyeDy = P.eyeDown * 356, earK = hs * P.ear / E2_EAR, sqm = (i, p) => [p[0] + SQ[i][0] * P.sq, p[1] + SQ[i][1] * P.sq];
  const nailY = GROUND - 13 * P.nailK, nSp = { 3: [18, 24], 4: [15, 20.5], 2: [26, 30] }[P.nailN] || [18, 24];
  const nails = (f, x0n, wleg, id, nm, par) => Array.from({ length: P.nailN }, (_, i) => ell(id + i, 'つめ（' + nm + (i + 1) + '）', PAL.nail, [f([x0n + (nSp[0] + nSp[1] * i) * (P.nailK > 1 ? 1 + (P.nailK - 1) * 0.7 : 1), 757])[0] - P.footF * wleg / 2 * 0.9, nailY + (i === 1 ? 1 : 0)], 17 * P.nailK, 15 * P.nailK, 0, { parent: par }));
  const N = [];
  N.push(ell('gshadow', '地面の影', PAL.shadow, [(x0 + x1) / 2, 772], (x1 - x0) * 0.985, 40, 0));
  N.push(b.legHF, b.legFF, b.tail, b.torso, belly);
  N.push(U.shape('neckSh', '首の影', PAL.dark, L(M.head, [[597, 336, 'c'], [680, 446], [608, 600, 'c'], [650, 446]]), { follow: 'torso' }));
  N.push(U.line('backHi', '背中の光', PAL.light, 9, L(p => { const q = M.top(p); return [q[0], q[1] + 0]; }, [[672, 325], [860, 309], [1020, 305], [1168, 320], [1252, 356]]), { follow: 'torso' }));
  N.push(U.group('gLegHN', '後ろ脚（手前）のまとまり', { pivot: pv.legHN, rigParent: 'torso' }), b.legHN);
  N.push(U.line('creaseH', 'ももの線', PAL.dark, 6, L(M.low, [[1158, 648], [1160, 572], [1222, 528]]), { parent: 'gLegHN' }));
  N.push(...nails(M.low, 1172, M.legw(34), 'nailH', '後ろ', 'gLegHN'));
  N.push(U.group('gLegFN', '前脚（手前）のまとまり', { pivot: pv.legFN, rigParent: 'torso' }), b.legFN);
  N.push(U.line('creaseF', '肩の線', PAL.dark, 6, L(M.low, [[678, 652], [684, 582], [738, 552]]), { parent: 'gLegFN' }));
  N.push(...nails(M.low, 684, M.legw(46), 'nailF', '前', 'gLegFN'));
  N.push(U.group('gHead', '頭のまとまり', { pivot: pv.head, rigParent: 'torso' }), b.earF, b.jaw, b.head);
  N.push(U.line('mouth', '口の線', PAL.line, 6, L(M.head, [sqm(58, [236, 575]), [340, 591 + P.mMid], [452, 580 + P.mEnd]]), { parent: 'gHead' }));
  const eDx = P.eyeDx * 356, eyeC = [442 + eDx, 379 + eyeDy];
  N.push(ell('eyeRim', '目のまわり', P.eyeWhite ? PAL.white : PAL.pink, M.head([443 + eDx, 379 + eyeDy]), 40 * eyeK, 36 * eyeK, -15, { parent: 'gHead' }));
  N.push(ell('eye', '目', PAL.eye, M.head(eyeC), 19 * eyeK, 21 * eyeK, 0, { parent: 'gHead' }));
  const ec = M.head(eyeC); N.push(ell('eyeHi', '目の光', PAL.white, [ec[0] - 3.5 * eyeK, ec[1] - 4.5 * eyeK], 6 * eyeK, 6 * eyeK, 0, { parent: 'gHead' }));
  if (P.lid) { const er = P.eye / E2_EYE, rx = 20 * er, ry = 18 * er, cx = eyeC[0] + 1, cy = eyeC[1], yc = cy + (P.lid * 2 - 1) * 10.5 * er - 0.5;
    N.push(U.shape('lid', 'まぶた', PAL.body, L(M.head, [[cx - 1.14 * rx, yc + 4 * er, 'c'], [cx - 0.92 * rx, cy - 0.95 * ry], [cx, cy - 1.25 * ry], [cx + 0.95 * rx, cy - 0.9 * ry], [cx + 1.16 * rx, yc - 3 * er, 'c']]), { parent: 'gHead' })); }
  N.push(ell('nostril', '鼻の穴', PAL.line, M.head((q => [q[0] + P.nosDx, q[1] + P.nosDy])(sqm(2, [266, 412]))), 22 * hs * P.muz, 11 * hs * P.muz, -24, { parent: 'gHead' }));
  N.push(U.group('gEarN', '耳（手前）のまとまり', { parent: 'gHead', pivot: pv.earN, rigParent: 'head' }), b.earN);
  N.push(ell('earIn', '耳の中', PAL.ear, M.earN([528, 309]), 17 * earK, 34 * earK, 3, { parent: 'gEarN' }));
  const docE = U.doc(N, { stage: 'E', vars: P });
  return { M, docB, docD, docE, SIL };
}

/* 輪郭の中の広さ（曲線を細かく刻んで） */
function areaOf(SIL) {
  const ss = G.segs(SIL, true); let a = 0, prev = null, first = null;
  for (const s of ss) for (let j = 0; j < 16; j++) { const q = G.bez(s, j / 16); if (prev) a += prev[0] * q[1] - q[0] * prev[1]; else first = q; prev = q; }
  a += prev[0] * first[1] - first[0] * prev[1]; return Math.abs(a) / 2;
}
/* 大きさをそろえる：地面（y=770）はそのまま、全体を s 倍して、左右の真ん中を x=800 に。線の太さ・長丸も同じ倍率 */
function fitDoc(doc, s, cx) {
  const d = JSON.parse(JSON.stringify(doc)), X = x => G.r2(800 + (x - cx) * s), Y = y => G.r2(GROUND + (y - GROUND) * s), V = v => [G.r2(v[0] * s), G.r2(v[1] * s)];
  for (const nd of d.nodes) {
    if (nd.pivot) nd.pivot = [X(nd.pivot[0]), Y(nd.pivot[1])];
    if (!nd.geo) continue;
    if (nd.geo.t === 'path') for (const q of nd.geo.pts) { q.p = [X(q.p[0]), Y(q.p[1])]; if (q.in) q.in = V(q.in); if (q.out) q.out = V(q.out); }
    else { nd.xf.pos = [X(nd.xf.pos[0]), Y(nd.xf.pos[1])]; nd.geo.size = V(nd.geo.size); }
    if (nd.stroke) nd.stroke.w = G.r2(nd.stroke.w * s);
  }
  return d;
}
module.exports = { X0, REAL, L3, ADD, GROUPS, NAMES, at, mix, model, build, areaOf, fitDoc, GROUND };
