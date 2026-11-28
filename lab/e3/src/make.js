/* lab/e3 src/make.js — 全部の版を作る：node src/make.js → out/<版>/（JSON）と out/versions.json */
const fs = require('fs'), path = require('path'), K = require('./kaba.js'), U = require('./util.js'), G = U.G;
const OUT = path.join(__dirname, '..', 'out');
const VERS = [
  ['L1', '実物の比（誇張 0）', K.at(0)], ['L1.5', '誇張 0.25', K.at(0.25)], ['L2', 'ほどよい誇張（0.5）', K.at(0.5)], ['L2.5', '誇張 0.75', K.at(0.75)], ['L3', 'キャラクター寄り（1.0）', K.at(1)], ['L4', '行きすぎ（1.5）', K.at(1.5)],
  ['L2+頭', 'L2 で、頭の組だけ L3', K.mix(0.5, '頭', 1)], ['L2+胴', 'L2 で、胴の組だけ L3', K.mix(0.5, '胴', 1)], ['L2+脚', 'L2 で、脚の組だけ L3', K.mix(0.5, '脚', 1)], ['L2+小物', 'L2 で、耳・目・しっぽだけ L3', K.mix(0.5, '小物', 1)],
];
const TARGET = Number(process.env.E3_AREA || 0);
const list = [];
for (const [name, note, P] of VERS) {
  const r = K.build(P), area = K.areaOf(r.SIL), s = TARGET ? Math.sqrt(TARGET / area) : 1;
  const xs = r.SIL.map(q => q.p[0]), ys = r.SIL.map(q => q.p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
  const w = (f, d) => { const dd = K.fitDoc(d, s, cx); dd.e3.version = name; dd.e3.scale = G.r2(s * 1000) / 1000; if (!G.validDoc(dd)) throw new Error(name + f); fs.writeFileSync(path.join(dir, f), JSON.stringify(dd, null, 1)); return dd; };
  w('B_影絵.json', r.docB); w('D_清書.json', r.docD); w(name + '.json', r.docE);
  const len = Math.max(...xs) - Math.min(...xs), ht = K.GROUND - Math.min(...ys);
  list.push({ name, note, vars: P, scale: G.r2(s * 1000) / 1000, model: { area: Math.round(area), length: Math.round(len), height: Math.round(ht), bellySpan: Math.round(r.M.bellySpan), clearance: Math.round(K.GROUND - r.M.yb - 14 * P.sag) } });
  console.log(name, 'area', Math.round(area), 'len', Math.round(len), 'h', Math.round(ht), 'belly', Math.round(r.M.bellySpan), 's', s.toFixed(3));
}
fs.writeFileSync(path.join(OUT, 'versions.json'), JSON.stringify({ names: K.NAMES, add: K.ADD, groups: K.GROUPS, target_area: TARGET, versions: list }, null, 1));
