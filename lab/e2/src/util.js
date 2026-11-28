/* lab/e2 src/util.js — 絵のデータ（lab/p4 の形）を作る小さな道具。id は決め打ち（作り直しても同じになるように） */
const path = require('path'), fs = require('fs');
const G = require(path.join(__dirname, '..', '..', 'p4', 'geom.js'));
const BG = '#DDE9C8';
const PAL = { body: '#8C7B90', far: '#6E6075', dark: '#7B6B80', light: '#A796AA', pink: '#C99C9F', pink2: '#DDB6B2', ear: '#B0727A', line: '#54465C', eye: '#2F2734', white: '#FFFFFF', nail: '#EFE6D2', shadow: '#BCD3A2' };
/* 点：[x,y]＝なめらか（取っ手は自動）、[x,y,'c']＝角、[x,y,{in:[dx,dy],out:[dx,dy],corner:true}]＝取っ手を指定 */
function pts(id, arr) {
  return arr.map((a, i) => {
    const q = { id: id + '.' + i, p: [a[0], a[1]] };
    if (a[2] === 'c') q.corner = true;
    else if (a[2] && typeof a[2] === 'object') { if (a[2].in) q.in = a[2].in; if (a[2].out) q.out = a[2].out; if (a[2].corner) q.corner = true; }
    return q;
  });
}
function shape(id, name, fill, arr, extra) { return Object.assign({ id, name, kind: 'shape', parent: null, visible: true, locked: false, geo: { t: 'path', pts: pts(id, arr), closed: true }, fill, stroke: null }, extra || {}); }
function line(id, name, color, w, arr, extra) { return Object.assign({ id, name, kind: 'line', parent: null, visible: true, locked: false, geo: { t: 'path', pts: pts(id, arr), closed: false }, fill: null, stroke: { c: color, w, cap: 'round' } }, extra || {}); }
function ellipse(id, name, fill, cx, cy, w, h, rot, extra) { return Object.assign({ id, name, kind: 'shape', parent: null, visible: true, locked: false, xf: { pos: [cx, cy], rot: rot || 0 }, geo: { t: 'ellipse', size: [w, h] }, fill, stroke: null }, extra || {}); }
function group(id, name, extra) { return Object.assign({ id, name, kind: 'group', parent: null, visible: true, locked: false }, extra || {}); }
function doc(nodes, meta) { return Object.assign({ kind: 'lab-p4-doc', v: 1, w: 1600, h: 900, bg: BG, nodes }, meta ? { e2: meta } : {}); }
/* 自動の取っ手を、はっきりした取っ手に直す（形は同じ。切り出しても形が変わらないように） */
function explicit(ptsArr, closed) {
  return ptsArr.map((q, i) => {
    const o = { id: q.id, p: q.p.slice() };
    const hi = G.hIn(ptsArr, closed, i).p, ho = G.hOut(ptsArr, closed, i).p;
    o.in = [G.r2(hi[0] - q.p[0]), G.r2(hi[1] - q.p[1])]; o.out = [G.r2(ho[0] - q.p[0]), G.r2(ho[1] - q.p[1])];
    if (q.corner) o.corner = true;
    return o;
  });
}
function save(name, d) { const p = path.join(__dirname, '..', 'stages', name); fs.writeFileSync(p, JSON.stringify(d, null, 1)); if (!G.validDoc(d)) throw new Error('P4 の形ではない：' + name); return p; }
module.exports = { G, BG, PAL, pts, shape, line, ellipse, group, doc, explicit, save };
