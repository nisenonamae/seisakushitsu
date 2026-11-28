/* lab/e6 src/make.js — 全部の版を作る：node src/make.js → /tmp/e6/raw/<版>.json（大きさは式でそろえた物。render.py が画素で合わせ直す）と out/versions.json */
const fs = require('fs'), path = require('path'), K = require('./kaba.js'), U = require('./util.js'), G = U.G, VS = require('./versions.js');
const OUT = path.join(__dirname, '..', 'out'), RAW = '/tmp/e6/raw', TARGET = 470000;
fs.mkdirSync(RAW, { recursive: true });
const NAMES = Object.assign({}, K.NAMES, { legPts: '脚のふちの途中の点［高さ, 前の寄せ, 後ろの寄せ］', footF: '足の裏の前の角を外へ', footR: '足の裏の後ろの角を外へ', cornF: '足の裏の前の角の丸み', cornR: '足の裏の後ろの角の丸み', gapK: '手前と奥の脚のあいだ', nailK: 'つめの大きさ', nailN: 'つめの数', archPos: '背中の山の場所（0 首…1 おしり）', eyeDx: '目を後ろへ（+ 頭の長さに対して）', eyeWhite: '白目', lid: 'まぶた（黒目をおおう割合）', earW: '耳の幅', earBack: '耳を後ろへ（+ 画素）', earSep: '手前の耳だけを後ろへ（+ 画素）', mMid: '口の線の真ん中を下へ（+ 画素）', mEnd: '口の線の奥のはしを下へ（+ 画素）', nosDx: '鼻の穴を後ろへ（+ 画素）', nosDy: '鼻の穴を下へ（+ 画素）' });
const list = [];
for (const [name, group, note, ch] of VS.V) {
  const P = Object.assign({}, VS.BASE, ch), r = K.build(P), area = K.areaOf(r.SIL), s = Math.sqrt(TARGET / area);
  const xs = r.SIL.map(q => q.p[0]), ys = r.SIL.map(q => q.p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const dd = K.fitDoc(r.docE, s, cx); dd.e3 = undefined; dd.e6 = { version: name, vars: P };
  if (!G.validDoc(dd)) throw new Error(name);
  fs.writeFileSync(path.join(RAW, name + '.json'), JSON.stringify(dd));
  const changed = {};
  for (const k in ch) { const b = VS.BASE[k], v = ch[k]; changed[k] = { 名前: NAMES[k], 値: v, 基準: b, 倍率: typeof v === 'number' && typeof b === 'number' && b !== 0 && !K.ADD.includes(k) && !/^(m|nos|eyeD|earB|arch|corn|foot|lid|eyeW)/.test(k) ? Math.round(v / b * 1000) / 1000 : null }; }
  list.push({ name, group, note, changed, vars: P, scale0: Math.round(s * 1000) / 1000, model: { length: Math.round(Math.max(...xs) - Math.min(...xs)), height: Math.round(K.GROUND - Math.min(...ys)), bellySpan: Math.round(r.M.bellySpan), clearance: Math.round(K.GROUND - r.M.yb - 14 * P.sag) } });
  console.log(name, 'belly', Math.round(r.M.bellySpan), 's', s.toFixed(3));
}
fs.writeFileSync(path.join(OUT, 'versions.json'), JSON.stringify({ base: 'L2（lab/e3 の L2 と同じ絵）', names: NAMES, add: K.ADD, target_area: TARGET, note: '倍率＝値 ÷ 基準（掛け算の変数だけ。足し算・場所・形の変数は null）。vars は、その版の変数の全部', versions: list }, null, 1));
