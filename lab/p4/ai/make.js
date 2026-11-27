/* lab/p4/ai/make.js — AI（担当の Claude）が作った2つの絵を、描く画面と同じデータの形で書き出す。
   使い方： node lab/p4/ai/make.js   →  shitagumi.json・ai_only.json・data.js（ファイルを直接開いても読めるように、同じ中身を JS にした物）
   絵は、docs/refs/jitsubutsu/カバ/ の実物の写真を見て、数値で組み立てた。ほかの人のイラストはなぞっていない。 */
'use strict';
const fs = require('fs'), path = require('path');
const G = require('../geom.js');
const C = { body: '#8C7B90', far: '#6E6075', dark: '#7B6B80', light: '#A796AA', pink: '#C99C9F', pink2: '#DDB6B2', ear: '#B0727A', line: '#54465C', eye: '#2F2734', white: '#FFFFFF', nail: '#EFE6D2', shadow: '#BCD3A2' };
const BG = '#DDE9C8';

function builder() {
  const nodes = [];
  const base = (id, name) => ({ id, name, kind: 'shape', parent: null, visible: true, locked: false });
  const pt = (id, i, a) => { const q = { id: id + '.' + i, p: [a[0], a[1]] }; for (const x of a.slice(2)) { if (x === 'c') q.corner = true; else if (x && x.in) q.in = x.in; else if (x && x.out) q.out = x.out; if (x && x.io) { q.in = x.io[0]; q.out = x.io[1]; } } return q; };
  const B = {
    nodes,
    ell(id, name, fill, x, y, w, h, rot) { const n = base(id, name); n.xf = { pos: [x, y], rot: rot || 0 }; n.geo = { t: 'ellipse', size: [w, h] }; n.fill = fill; n.stroke = null; nodes.push(n); return n; },
    rect(id, name, fill, x, y, w, h, round, rot) { const n = base(id, name); n.xf = { pos: [x, y], rot: rot || 0 }; n.geo = { t: 'rect', size: [w, h], round }; n.fill = fill; n.stroke = null; nodes.push(n); return n; },
    cap(id, name, fill, x, y, len, w, rot) { const n = base(id, name); n.xf = { pos: [x, y], rot: rot || 0 }; n.geo = { t: 'capsule', len, w }; n.fill = fill; n.stroke = null; nodes.push(n); return n; },
    shape(id, name, fill, pts) { const n = base(id, name); n.geo = { t: 'path', pts: pts.map((a, i) => pt(id, i, a)), closed: true }; n.fill = fill; n.stroke = null; nodes.push(n); return n; },
    raw(id, name, fill, pts) { const n = base(id, name); n.geo = { t: 'path', pts, closed: true }; n.fill = fill; n.stroke = null; nodes.push(n); return n; },
    line(id, name, color, w, pts) { const n = base(id, name); n.kind = 'line'; n.geo = { t: 'path', pts: pts.map((a, i) => pt(id, i, a)), closed: false }; n.fill = null; n.stroke = { c: color, w, cap: 'round' }; nodes.push(n); return n; },
    group(id, name, list) { const g = { id, name, kind: 'group', parent: null, visible: true, locked: false }; list.forEach(n => n.parent = id); const top = Math.max(...list.map(n => nodes.indexOf(n))); nodes.splice(top + 1, 0, g); return g; },
    doc(note) { return { kind: 'lab-p4-doc', v: 1, w: 1600, h: 900, bg: BG, meta: { by: 'ai', note }, nodes }; }
  };
  return B;
}
/* ある形の i0..i1 の点を、取っ手を数値にして写す（2つの部品で同じ曲線を共有するため） */
function run(node, i0, i1, id) {
  const pts = node.geo.pts, out = [];
  for (let i = i0; i <= i1; i++) {
    const q = { id: id + '.s' + i, p: pts[i].p.slice() };
    if (i > i0) q.in = G.v.sub(G.hIn(pts, true, i).p, pts[i].p).map(G.r2);
    if (i < i1) q.out = G.v.sub(G.hOut(pts, true, i).p, pts[i].p).map(G.r2);
    q.corner = true; out.push(q);
  }
  return out;
}

/* ---------- 下組み：図形だけで、大きな形と主な部品まで ---------- */
function shitagumi() {
  const B = builder();
  B.ell('s-kage', '地面の影', C.shadow, 830, 772, 1100, 46);
  B.cap('s-ashi-oku-ushiro', '奥の後ろ脚', C.far, 1140, 650, 250, 120, 90);
  B.cap('s-ashi-oku-mae', '奥の前脚', C.far, 650, 655, 240, 115, 90);
  B.rect('s-dou', '胴', C.body, 915, 445, 860, 440, 215);
  B.cap('s-ashi-ushiro', '手前の後ろ脚', C.body, 1235, 640, 270, 135, 90);
  B.cap('s-ashi-mae', '手前の前脚', C.body, 735, 650, 250, 125, 90);
  B.ell('s-atama', '頭', C.body, 500, 420, 400, 330, -12);
  B.rect('s-hanazura', '鼻づら', C.body, 320, 455, 290, 270, 110);
  B.ell('s-mimi', '耳', C.body, 590, 262, 58, 84, 18);
  B.ell('s-me', '目', C.eye, 505, 322, 28, 30);
  return B.doc('AI の下組み。図形（円・角丸の四角・長丸）だけで、大きな形と主な部品を置いた。輪郭の調整・あご・口・しわ・光・つめ・しっぽは、人に残してある。');
}

/* ---------- AI のみ：仕上げまで ---------- */
function aiOnly() {
  const B = builder();
  const kage = B.ell('a-kage', '地面の影', C.shadow, 830, 772, 1120, 44);
  const lo2 = B.rect('a-ashi-oku-ushiro', '奥の後ろ脚', C.far, 1135, 655, 122, 232, 46, 0);
  const lo1 = B.rect('a-ashi-oku-mae', '奥の前脚', C.far, 648, 660, 116, 224, 44, 0);
  const mimi2 = B.ell('a-mimi-oku', '奥の耳', C.far, 548, 262, 50, 74, 4);
  const shippo = B.line('a-shippo', 'しっぽ', C.dark, 20, [[1338, 395], [1366, 450], [1362, 512]]);
  const dou = B.shape('a-dou', '胴', C.body, [
    [600, 262], [860, 218], [1140, 240], [1338, 400], [1296, 590], [1010, 664], [720, 648], [548, 520], [530, 370]]);
  const hara = B.raw('a-hara', '腹のピンク', C.pink, run(dou, 4, 6, 'a-hara').concat([
    { id: 'a-hara.u0', p: [860, 622] }, { id: 'a-hara.u1', p: [1130, 600] }]));
  const hikari = B.line('a-hikari', '背中の光', C.light, 14, [[690, 262], [880, 240], [1090, 258]]);
  const l2 = B.rect('a-ashi-ushiro', '手前の後ろ脚', C.body, 1232, 640, 140, 262, 52, 0);
  const l1 = B.rect('a-ashi-mae', '手前の前脚', C.body, 730, 648, 128, 246, 48, 0);
  const t1 = B.ell('a-tsume-1', 'つめ（前脚・前）', C.nail, 690, 756, 30, 20);
  const t2 = B.ell('a-tsume-2', 'つめ（前脚・後ろ）', C.nail, 728, 760, 30, 20);
  const t3 = B.ell('a-tsume-3', 'つめ（後ろ脚・前）', C.nail, 1190, 754, 32, 21);
  const t4 = B.ell('a-tsume-4', 'つめ（後ろ脚・後ろ）', C.nail, 1230, 758, 32, 21);
  const momo = B.line('a-momo', 'ももの線', C.dark, 7, [[1150, 420], [1128, 520], [1168, 600]]);
  const ago = B.shape('a-ago', '下あご', C.pink, [[214, 516], [340, 512], [500, 530], [510, 578], [365, 600], [238, 570]]);
  const atama = B.shape('a-atama', '頭', C.body, [
    [650, 300], [522, 264], [400, 326], [285, 300], [196, 385], [200, 505], [330, 522], [455, 530], [565, 600], [684, 540], [712, 400]]);
  const shiwa1 = B.line('a-shiwa-1', '首のしわ（前）', C.dark, 7, [[676, 318], [712, 420], [690, 520]]);
  const shiwa2 = B.line('a-shiwa-2', '首のしわ（後ろ）', C.dark, 6, [[730, 318], [752, 390], [744, 452]]);
  const kuchi = B.line('a-kuchi', '口', C.line, 7, [[208, 514], [330, 526], [452, 530], [478, 512]]);
  const hana = B.line('a-hana', '鼻の穴', C.line, 9, [[254, 330], [276, 320]]);
  const mimi = B.shape('a-mimi', '耳', C.body, [[588, 222], [618, 262], [592, 304], [562, 262]]);
  const mimiN = B.ell('a-mimi-naka', '耳の中', C.ear, 590, 264, 26, 46, 4);
  const me = B.ell('a-me', '目', C.eye, 508, 320, 26, 28);
  const meH = B.ell('a-me-hikari', '目の光', C.white, 504, 315, 8, 8);
  const mabuta = B.line('a-mabuta', 'まぶた', C.dark, 6, [[484, 304], [508, 294], [532, 304]]);
  B.group('a-g-atama', '頭', [ago, atama, kuchi, hana, mimi, mimiN, me, meH, mabuta]);
  void kage; void lo1; void lo2; void mimi2; void shippo; void hara; void hikari; void l1; void l2; void t1; void t2; void t3; void t4; void momo; void shiwa1; void shiwa2;
  return B.doc('AI だけで仕上げた物。実物の写真を見て数値で組み、描く画面と同じ描き方で画像にして見直した（ai/review.md）。');
}

const out = { shitagumi: shitagumi(), ai_only: aiOnly() };
const dir = __dirname;
fs.writeFileSync(path.join(dir, 'shitagumi.json'), JSON.stringify(out.shitagumi, null, 1));
fs.writeFileSync(path.join(dir, 'ai_only.json'), JSON.stringify(out.ai_only, null, 1));
fs.writeFileSync(path.join(dir, 'data.js'), '/* make.js が作る。shitagumi.json・ai_only.json と同じ中身（ファイルを直接開いても読めるように JS にした物）。手で直さない */\nwindow.P4_AI = ' + JSON.stringify(out) + ';\n');
for (const k in out) { const s = G.stats(out[k]); console.log(k, '部品', s.parts, '点', s.points, '最大', s.maxName, s.maxPts, '12超', s.over12); }
