/* 工程 5（E）配色・影・線の仕上げ：工程 4 の部品の形はそのまま（1点も動かさない）。色を決め、面・線・顔の細部を足す。
   足した物は ADDED に一覧。1部品1色・光と影は別の部品・口やしわは線（太さ一定・両端が丸い）。 */
const U = require('./util.js'), C = require('./c_parts.js'), D = require('./d_seisho.js');
const G = U.G, PAL = U.PAL, P = C.P, v = C.v, V2 = C.V2;
const V = (process.env.E2_REV || 'r9');           /* 直しの回を残すための切り替え */
function build() {
  const base = {}; D.nodes().forEach(n => base[n.id] = n);
  const col = { legHF: PAL.far, legFF: PAL.far, tail: PAL.body, torso: PAL.body, legHN: PAL.body, legFN: PAL.body, earF: PAL.far, jaw: PAL.pink, head: PAL.body, earN: PAL.body };
  for (const k in col) base[k].fill = col[k];
  const ADDED = [];
  const add = (n, why) => { ADDED.push({ id: n.id, name: n.name, kind: n.kind === 'line' ? '線' : (n.geo.t === 'ellipse' ? '図形（長丸）' : '面'), color: n.fill || n.stroke.c, why }); return n; };

  /* 腹：下のふちは、胴の下のふちと同じ点・同じ取っ手（切り抜きが無いので、写して合わせる） */
  const tp = U.explicit(base.torso.geo.pts, true);
  const iA = tp.findIndex(q => q.p[0] === 1240 && q.p[1] === 656);
  const A = JSON.parse(JSON.stringify(tp[iA])); delete A.in; A.corner = true;
  const bel = [A]; let k = iA + 1;
  while (true) { const q = JSON.parse(JSON.stringify(tp[k])); bel.push(q); if (Math.abs(q.p[0] - 802) < 0.5) break; k++; }
  const q43 = bel[bel.length - 1], nx = tp[k + 1];           /* 43 番 → 胸（まっすぐ）の途中で止める。手前の前脚の下に隠れる */
  delete q43.out; q43.corner = true;
  const tB = 0.42, Bp = [G.r2(q43.p[0] + (nx.p[0] - q43.p[0]) * tB), G.r2(q43.p[1] + (nx.p[1] - q43.p[1]) * tB)];
  const upper = v([[Bp[0], Bp[1], 'c'], [800, 641], [950, 616], [1110, 638]], [[Bp[0], Bp[1], 'c'], [800, 641], [950, 616], [1085, 641], [1150, 663]]);   /* v2 指摘 5：右はしを、手前の後ろ脚の前のふちの所で腹の線まで下げる（脚のふちで縦に切れて見えた） */
  void (0);   /* r2：帯に見えたので、両はしが腹の線に寄る弓形に */
  const belly = { id: 'belly', name: '腹（ピンク）', kind: 'shape', parent: null, visible: true, locked: false, fill: PAL.pink, stroke: null, follow: 'torso',
    geo: { t: 'path', closed: true, pts: bel.concat(U.pts('belly.u', upper)).map((q, i) => Object.assign({}, q, { id: 'belly.' + i })) } };

  const N = [];
  N.push(add(U.ellipse('gshadow', '地面の影', PAL.shadow, 770, 772, 1120, 40, 0), '地面に立たせる'));
  N.push(base.legHF, base.legFF, base.tail, base.torso);
  N.push(add(belly, '腹を背中と別の明るい面に［手本帳 絵9］。下のふちは胴と同じ点'));
  const neckSh = add(U.shape('neckSh', '首の影', PAL.dark, v([[597, 336, 'c'], [680, 446], [608, 600, 'c'], [650, 446]], [[597, 336, 'c'], [680, 446], [608, 600, 'c'], [663, 442]]), { follow: 'torso' }), '頭と胴が同じ色なので、頭の後ろに暗い面を置いて分ける［絵3］');
  if (!V2) N.push(neckSh);
  N.push(add(U.line('backHi', '背中の光', PAL.light, 9, v([[672, 325], [860, 309], [1020, 305], [1168, 320], [1252, 356]], [[672, 319], [860, 282], [1020, 276], [1170, 296], [1254, 340]]), { follow: 'torso' }), '背中のふちに細い明るい帯［絵10］'));
  /* 後ろ脚（手前） */
  N.push(U.group('gLegHN', '後ろ脚（手前）のまとまり', { pivot: P.legHN, rigParent: 'torso' }));
  base.legHN.parent = 'gLegHN'; N.push(base.legHN);
  N.push(add(U.line('creaseH', 'ももの線', PAL.dark, 6, [[1158, 648], [1160, 572], [1222, 528]], { parent: 'gLegHN' }), '胴と同じ色の脚の、前のふちを線で'));
  [[1190, 757], [1214, 758], [1238, 757]].forEach((c, i) => N.push(add(U.ellipse('nailH' + i, 'つめ（後ろ' + (i + 1) + '）', PAL.nail, c[0], c[1], 17, 15, 0, { parent: 'gLegHN' }), 'つめ')));
  N.push(U.group('gLegFN', '前脚（手前）のまとまり', { pivot: P.legFN, rigParent: 'torso' }));
  base.legFN.parent = 'gLegFN'; N.push(base.legFN);
  N.push(add(U.line('creaseF', '肩の線', PAL.dark, 6, [[678, 652], [684, 582], [738, 552]], { parent: 'gLegFN' }), '胴と同じ色の脚の、前のふちを線で'));
  [[702, 757], [726, 758], [750, 757]].forEach((c, i) => N.push(add(U.ellipse('nailF' + i, 'つめ（前' + (i + 1) + '）', PAL.nail, c[0], c[1], 17, 15, 0, { parent: 'gLegFN' }), 'つめ')));
  /* 頭 */
  N.push(U.group('gHead', '頭のまとまり', { pivot: P.head, rigParent: 'torso' }));
  N.push(base.earF, base.jaw, base.head);
  N.push(add(U.line('mouth', '口の線', PAL.line, 6, [[236, 575], [340, 591], [452, 580]], { parent: 'gHead' }), '口は線。上くちびるのふち（頭の下のふち）に沿わせる'));
  N.push(add(U.ellipse('eyeRim', '目のまわり', v(PAL.pink, PAL.dark), 443, 379, 40, 36, -15, { parent: 'gHead' }), '目のまわりのピンク（実物の写真 P9・P0）'));
  N.push(add(U.ellipse('eye', '目', PAL.eye, 442, 379, 19, 21, 0, { parent: 'gHead' }), '目（長丸のまま＝まばたきは高さを変えるだけ）'));
  N.push(add(U.ellipse('eyeHi', '目の光', PAL.white, 438.5, 374.5, 6, 6, 0, { parent: 'gHead' }), '目の光'));
  N.push(add(U.ellipse('nostril', '鼻の穴', PAL.line, 266, 412, 22, 11, -24, { parent: 'gHead' }), '鼻の穴（鼻づらの上の面）'));
  N.push(U.group('gEarN', '耳（手前）のまとまり', { parent: 'gHead', pivot: P.earN, rigParent: 'head' }));
  base.earN.parent = 'gEarN'; N.push(base.earN);
  N.push(add(U.ellipse('earIn', '耳の中', PAL.ear, 528, 309, 17, 34, 3, { parent: 'gEarN' }), '耳の中'));
  if (V2) N.push(neckSh);   /* v2 指摘 1：頭の後ろを胴の中へ伸ばしたので、首の影を頭より上に重ねて、伸ばした所を隠す */
  return U.doc(N, { stage: 'E', motion: C.MOTION, parts: C.table(N), added: ADDED, note: '形は工程 4 のまま。色は色の組から' });
}
const WANT = [['頭', 'gHead'], ['前脚（手前）', 'gLegFN'], ['前脚（奥）', 'legFF'], ['後ろ脚（手前）', 'gLegHN'], ['後ろ脚（奥）', 'legHF'], ['耳（手前）', 'gEarN'], ['耳（奥）', 'earF'], ['しっぽ', 'tail']];
module.exports = { build, WANT };
if (require.main === module) {
  const d = build(); U.save(process.argv[2] || v('s5_E_final.json', 'v2_s5_E_final.json'), d);
  const J = require('./joints_of.js'); require('fs').writeFileSync(require('path').join(__dirname, '..', 'stages', v('s5_E_joints_spec.json', 'v2_s5_E_joints_spec.json')), JSON.stringify(J.jointsOf(d, WANT), null, 1));
  console.log('E ok', d.nodes.filter(n => n.kind !== 'group').length);
}
