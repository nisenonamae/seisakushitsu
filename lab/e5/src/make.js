/* lab/e5 src/make.js — 影絵の作り方だけを変えた版（A〜E）を作る：node src/make.js → variants/<版>.json（仕上げ）・<版>.sil.json（影絵）・<版>.joints.json（関節の表）
   比（L2＝K.at(0.5)）・大きさ（E3 と同じ倍率 1.02665。A の左右の真ん中を x=800 に）・部品の数・線の本数・色は、全部の版で同じ。 */
const fs = require('fs'), path = require('path'), K = require('./kaba5.js'), U = require('./util.js'), G = U.G;
const VARS = require('./variants.js');
const OUT = path.join(__dirname, '..', 'variants'); fs.mkdirSync(OUT, { recursive: true });
const P = K.at(0.5), S = 1.02665;
const JN = [['頭', 'gHead', 'head'], ['前脚（手前）', 'gLegFN', 'legFN'], ['前脚（奥）', 'legFF', 'legFF'], ['後ろ脚（手前）', 'gLegHN', 'legHN'], ['後ろ脚（奥）', 'legHF', 'legHF'], ['耳（手前）', 'gEarN', 'earN'], ['耳（奥）', 'earF', 'earF'], ['しっぽ', 'tail', 'tail'], ['下あご', 'jaw', 'jaw']];
let cx = null; const sum = {};
for (const name of Object.keys(VARS.V)) {
  const v = VARS.V[name], r = K.build(P, v.opt(K, P));
  const xs = r.SIL.map(q => q.p[0]); if (cx === null) cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const w = (f, d) => { const dd = K.fitDoc(d, S, cx); dd.e3.version = name; if (!G.validDoc(dd)) throw new Error(name + f); fs.writeFileSync(path.join(OUT, f), JSON.stringify(dd, null, 1)); return dd; };
  const dB = w(name + '.sil.json', r.docB), dE = w(name + '.json', r.docE);
  const kids = id => { const o = []; for (const n of dE.nodes) if (n.parent === id) { o.push(n.id); o.push(...kids(n.id)); } return o; };
  const joints = JN.map(([nm, id, main]) => { const n = dE.nodes.find(x => x.id === id); return { name: nm, main, par: n.rigParent, links: [{ ids: n.kind === 'group' ? kids(id) : [id], pivot: n.pivot, frac: 1 }] }; });
  fs.writeFileSync(path.join(OUT, name + '.joints.json'), JSON.stringify({ title: name + ' ' + v.title, doc: name + '.json', joints, log: v.log || [] }, null, 1));
  const X = x => G.r2(800 + (x - cx) * S), Y = y => G.r2(K.GROUND + (y - K.GROUND) * S);
  fs.writeFileSync(path.join(OUT, name + '.pts.json'), JSON.stringify({ src: K.R4.map((a, i) => { const q = r.rf.pts[r.I4[i]]; return [X(q[0]), Y(q[1]), a[2] === 'c' ? 1 : 0]; }), pv: Object.fromEntries(Object.entries(r.pv).map(([k, p]) => [k, [X(p[0]), Y(p[1])]])) }));
  const parts = dE.nodes.filter(n => n.geo), pts = parts.reduce((a, n) => a + (n.geo.pts ? n.geo.pts.length : 0), 0);
  sum[name] = { title: v.title, parts: parts.length, lines: parts.filter(n => n.kind === 'line').length, points: pts, silPoints: dB.nodes[0].geo.pts.length, colors: [...new Set(parts.map(n => n.fill || n.stroke.c))].length };
  console.log(name, JSON.stringify(sum[name]));
}
fs.writeFileSync(path.join(OUT, 'versions.json'), JSON.stringify({ vars: P, scale: S, cx, versions: sum }, null, 1));
