/* 工程 3（C）部品に割る：B r4 の影絵の輪郭を、そのまま（取っ手ごと）部品に配る。輪郭は変えない。
   部品の外側のふち＝影絵の輪郭の一部（run）、内側＝ほかの部品の下にもぐる「重なり代」（新しく足す点）。 */
const U = require('./util.js'), B = require('./b_silhouette.js');
const G = U.G;
const SIL = U.explicit(U.pts('sil', B.silPts()), true);
const V2 = B.V2;   /* v2：評価者の指摘 1・2・3（頭の後ろ +70・耳 +10・脚の上 +40・しっぽ +20 を、胴の中へ深く） */
const v = (a, b) => (V2 ? b : a);
/* 輪郭の i〜j 番（一周して戻ってもよい）を写す。端は角にして、外へ出る側の取っ手を外す */
function run(i, j) {   /* i・j は r4 の番号（r5 で点が増えたので、IDX4 で読みかえる） */
  i = B.IDX4[i]; j = B.IDX4[j];
  const n = SIL.length, out = [];
  for (let k = i; ; k = (k + 1) % n) { out.push(JSON.parse(JSON.stringify(SIL[k]))); if (k === j) break; }
  const a = out[0], b = out[out.length - 1];
  delete a.in; a.corner = true; delete b.out; b.corner = true;
  return out;
}
const inner = arr => arr.map(a => ({ p: [a[0], a[1]], ...(a[2] === 'c' ? { corner: true } : {}) }));
function part(id, name, fill, segs, extra) {
  const ptsArr = [].concat(...segs).map((q, i) => Object.assign({}, q, { id: id + '.' + i }));
  return Object.assign({ id, name, kind: 'shape', parent: null, visible: true, locked: false, geo: { t: 'path', pts: ptsArr, closed: true }, fill, stroke: null }, extra || {});
}
/* C r2（関節を回して見て直した）：①頭を下げると耳の後ろにくさび形のすき間 → 胴の上のふちを耳の付け根（17番）まで伸ばす ②首の付け根を上へ（588,470→592,432）③頭の後ろの重なり代を少し下げる。影絵の輪郭は変えていない */
/* 動きの表（先に書く）→ 回る所（付け根）→ 部品 */
const MOTION = [
  { move: '歩く', parts: '4本の脚（肩・腰で振る）', pivot: '前脚＝肩、後ろ脚＝腰', range: '±15度', note: 'ひざ・足首では曲げない（短い脚なので、付け根だけ。部品を増やさない）' },
  { move: '首を振る（うなずく）', parts: '頭のグループ（頭・下あご・耳2つ＋顔の細部）', pivot: '首（胴の中）', range: '±10〜15度', note: '頭の後ろと胴の前を、互いに深くもぐらせる' },
  { move: '口を開ける', parts: '下あご', pivot: 'あごの関節（耳の下）', range: '下へ 0〜25度', note: '下あごは頭の下にもぐる。口の線は頭の下のふち' },
  { move: '耳を振る', parts: '耳（手前・奥）', pivot: '耳の付け根', range: '±20度', note: '付け根を頭の中へ丸くもぐらせる' },
  { move: 'しっぽ', parts: 'しっぽ', pivot: 'しっぽの付け根', range: '±20度', note: '' },
  { move: 'まばたき', parts: '目（工程 5 で足す）', pivot: '—', range: '差し替え／上下につぶす', note: '目は長丸の図形のままにして、高さを変えるだけで閉じられるように' },
  { move: '腹の上下（呼吸）', parts: '胴', pivot: '—', range: '腹の点を上下 ±6', note: '胴の下のふち（腹）の点を動かす。腹の色の面も同じ点を持つ（工程 5）' },
];
const P = {   /* 付け根 */
  head: [592, 432], jaw: [505, 545], earN: [528, 338], earF: [486, 345], tail: [1312, 428],
  legFN: [735, 605], legFF: [615, 605], legHN: [1222, 585], legHF: [1068, 605],
};
const W = { far: '#6E6075', body: '#8C7B90', a: '#7B6B80', b: '#A796AA' };   /* この段の色は、割り方を見るための仮の色（配色は工程 5） */
function nodes() {
  const N = [];
  N.push(part('legHF', '後ろ脚（奥）', W.far, [run(36, 41), inner(v([[1012, 605], [1068, 572], [1132, 612]], [[1010, 585], [1068, 532], [1134, 592]]))], { pivot: P.legHF, rigParent: 'torso' }));
  N.push(part('legFF', '前脚（奥）', W.far, [run(48, 53), inner(v([[572, 596], [618, 568], [664, 612]], [[570, 580], [618, 528], [666, 592]]))], { pivot: P.legFF, rigParent: 'torso' }));
  N.push(part('tail', 'しっぽ', W.a, [run(24, 29), inner(v([[1302, 452], [1296, 412]], [[1282, 456], [1276, 410]]))], { pivot: P.tail, rigParent: 'torso' }));
  N.push(part('torso', '胴', W.body, [
    run(17, 24), run(29, 31), inner([[1282, 664], [1215, 678]]), run(36, 36), inner([[1068, 668]]), run(41, 43), inner([[730, 670]]), run(48, 48), inner([[610, 664]]), run(53, 54),
    inner([[492, 560], [468, 450], [512, 358]])], { pivot: null, rigParent: null }));
  N.push(part('legHN', '後ろ脚（手前）', W.a, [run(31, 36), inner(v([[1140, 590], [1208, 522], [1292, 545]], [[1140, 570], [1208, 482], [1294, 520]]))], { pivot: P.legHN, rigParent: 'torso' }));
  N.push(part('legFN', '前脚（手前）', W.a, [run(43, 48), inner(v([[664, 600], [735, 545], [806, 600]], [[664, 580], [735, 505], [806, 580]]))], { pivot: P.legFN, rigParent: 'torso' }));
  N.push(U.group('gHead', '頭のまとまり', { pivot: P.head, rigParent: 'torso' }));
  N.push(part('earF', '耳（奥）', W.far, [run(8, 12), inner(v([[492, 360], [480, 362]], [[493, 370], [479, 372]]))], { parent: 'gHead', pivot: P.earF, rigParent: 'head' }));
  N.push(part('jaw', '下あご', W.a, [run(54, 58), inner([[300, 558], [420, 522], [520, 522], [566, 572]])], { parent: 'gHead', pivot: P.jaw, rigParent: 'head' }));
  N.push(part('head', '頭', W.b, [run(58, 8), run(12, 13), run(17, 18), inner(v([[648, 368], [672, 480], [610, 580], [545, 592], [470, 558], [400, 580], [325, 590]], [[700, 366], [742, 458], [690, 550], [600, 590], [478, 577], [400, 585], [325, 590]]))], { parent: 'gHead', pivot: P.head, rigParent: 'torso' }));
  N.push(part('earN', '耳（手前）', W.a, [run(13, 17), inner(v([[546, 352], [514, 356]], [[547, 362], [513, 366]]))], { parent: 'gHead', pivot: P.earN, rigParent: 'head' }));
  return N;
}
function table(N) { return N.map((n, z) => ({ z, id: n.id, name: n.name, group: n.parent || null, rigParent: n.rigParent || null, pivot: n.pivot || null })); }
function build() { const N = nodes(); return U.doc(N, { stage: 'C', motion: MOTION, parts: table(N), note: '色は仮（割り方を見るため）。pivot＝付け根、rigParent＝動きの親' }); }
module.exports = { V2, v, build, SIL, run, inner, part, P, MOTION, table };
if (require.main === module) { U.save(v('s3_C_parts.json', 'v2_s3_C_parts.json'), build()); console.log('C ok'); }
