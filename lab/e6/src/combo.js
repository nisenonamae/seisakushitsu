/* C 組み合わせ（A・B を自分で見てから決めた。「答え」ではなく、効き目が足し算になるかを見るための物） */
module.exports = (BASE, h) => [
  ['C1_丸い胴と目', 'C組み合わせ', '丸み 2 ＋ 目 ×2.0 ＋ 白目 ＋ 脚：実物型',
    Object.assign({ tL: 0.86, tH: 1.20, arch: 0.055, sag: 1.45, gapK: 0.9 }, h.eyeSet(2.0), { eyeWhite: 1, legPts: [[0.55, 0.03, 0.03], [0.24, 0.14, 0.13]], footF: 0.12, footR: 0.05, cornF: 18, cornR: 16 })],
  ['C2_大きい胴', 'C組み合わせ', '胴大 2 ＋ 腰が高い 1 ＋ 脚：ゾウ足 ＋ 耳 ×1.6',
    Object.assign(h.body(1.15), { arch: 0.07, archPos: 0.72, legW: h.r3(BASE.legW * 1.2), legPts: [[0.4, 0, 0]], footF: 0.07, footR: 0.07, cornF: 26, cornR: 26 }, h.earSet(1.6))],
  ['C3_大きい顔', 'C組み合わせ', '頭大 2 ＋ 鼻づら大 1 ＋ 口まっすぐ ＋ 目半分閉じ ＋ 脚短',
    { head: h.r3(BASE.head * 1.21), muz: 1.15, mMid: -12, mEnd: 0, lid: 0.5, legLen: 0.55 }],
];
