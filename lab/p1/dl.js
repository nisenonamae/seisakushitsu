// 描く物の一覧（display list）の形と、組み立ての小道具。
// 描く部品（r1_canvas.js・r2_canvaskit.js）は、この形だけを読む。部品の独自の形は外に出さない。
//
// 場面   scene = { w, h, bg:[r,g,b], items:[item…] }
// 項目   item  =
//   { t:'path',  d:[命令…], fill:paint, stroke:{paint,w,cap,join,miter}, op, blend, blur, xf }
//   { t:'group', items:[…], xf, op, blend, blur, clip:[命令…], mask:[item…] }
//   { t:'image', src:'名前', x,y,w,h, q:'nearest'|'linear'|'mip', op, blend, xf }
//   { t:'text',  s, x,y, size, font:'bold'|'regular', fill:[r,g,b,a], align:'left'|'center'|'right', op, blend, xf }
// 道の命令  ['M',x,y] ['L',x,y] ['Q',cx,cy,x,y] ['C',c1x,c1y,c2x,c2y,x,y] ['Z']
// 塗り  paint = [r,g,b,a]（r,g,b は 0〜255、a は 0〜1）
//             | { lin:[x0,y0,x1,y1], stops:[[位置0〜1,[r,g,b,a]]…] }
//             | { rad:[cx,cy,r],     stops:[…] }
// 変形  xf = [a,b,c,d,e,f]（Canvas 2D の transform と同じ並び）
// 透明度 op（0〜1。path・image・text は塗りに掛ける。group は重ねた結果に掛ける）
// 合成  blend = 'normal'|'multiply'|'screen'|'add'|'overlay'
// ぼかし blur = シグマ（最終の画素の単位。変形で拡大されても太らせない）
// 線    cap = 'butt'|'round'|'square'、join = 'miter'|'round'|'bevel'、miter = 角の限界（既定 4）
(function (g) {
  'use strict';
  const K = 0.5522847498307936; // 円を 4本のベジェで描く係数
  const P = {
    rect(x, y, w, h) { return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']]; },
    ellipse(cx, cy, rx, ry) {
      const kx = rx * K, ky = ry * K;
      return [['M', cx + rx, cy],
        ['C', cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry],
        ['C', cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy],
        ['C', cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry],
        ['C', cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy], ['Z']];
    },
    circle(cx, cy, r) { return P.ellipse(cx, cy, r, r); },
    rrect(x, y, w, h, r) {
      const k = r * (1 - K);
      return [['M', x + r, y], ['L', x + w - r, y], ['C', x + w - k, y, x + w, y + k, x + w, y + r],
        ['L', x + w, y + h - r], ['C', x + w, y + h - k, x + w - k, y + h, x + w - r, y + h],
        ['L', x + r, y + h], ['C', x + k, y + h, x, y + h - k, x, y + h - r],
        ['L', x, y + r], ['C', x, y + k, x + k, y, x + r, y], ['Z']];
    },
    poly(pts, open) {
      const d = pts.map((p, i) => [i ? 'L' : 'M', p[0], p[1]]);
      if (!open) d.push(['Z']);
      return d;
    },
    line(x0, y0, x1, y1) { return [['M', x0, y0], ['L', x1, y1]]; },
    star(cx, cy, r1, r2, n, rot) {
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = (rot || 0) + Math.PI * i / n, r = i % 2 ? r2 : r1;
        pts.push([cx + r * Math.sin(a), cy - r * Math.cos(a)]);
      }
      return P.poly(pts);
    },
    join() { return [].concat.apply([], arguments); },
  };
  const X = {
    tr(x, y) { return [1, 0, 0, 1, x, y]; },
    sc(sx, sy) { return [sx, 0, 0, sy === undefined ? sx : sy, 0, 0]; },
    rot(deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; },
    // m1 のあとに m2 を内側に掛ける（ctx.transform(m1); ctx.transform(m2) と同じ）
    mul(m1, m2) {
      return [m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5]];
    },
    at(x, y, deg, s) { // (x,y) を中心に回して拡大
      let m = X.tr(x, y);
      if (deg) m = X.mul(m, X.rot(deg));
      if (s !== undefined && s !== 1) m = X.mul(m, X.sc(s));
      return X.mul(m, X.tr(-x, -y));
    },
  };
  // 決まった乱数（毎回同じ並び）
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 囲みの四角（層を小さく作るために使う。少し大きめに見積もる）。scale＝いまの拡大率（ぼかしは最終の画素の単位なので）
  // 返すのは [x0,y0,x1,y1]（その項目の親の座標）。何も無ければ null
  function xfBox(b, m) {
    if (!m) return b;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
      const X1 = m[0] * x + m[2] * y + m[4], Y1 = m[1] * x + m[3] * y + m[5];
      if (X1 < x0) x0 = X1; if (X1 > x1) x1 = X1; if (Y1 < y0) y0 = Y1; if (Y1 > y1) y1 = Y1;
    }
    return [x0, y0, x1, y1];
  }
  function pathBox(d) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of d) for (let i = 1; i < c.length; i += 2) {
      if (c[i] < x0) x0 = c[i]; if (c[i] > x1) x1 = c[i];
      if (c[i + 1] < y0) y0 = c[i + 1]; if (c[i + 1] > y1) y1 = c[i + 1];
    }
    return x0 === Infinity ? null : [x0, y0, x1, y1];
  }
  const grow = (b, k) => [b[0] - k, b[1] - k, b[2] + k, b[3] + k];
  function itemBox(it, scale) {
    const sc = scale * (it.xf ? Math.sqrt(Math.abs(it.xf[0] * it.xf[3] - it.xf[1] * it.xf[2])) || 1 : 1);
    let b = null;
    if (it.t === 'path') {
      b = pathBox(it.d);
      if (b && it.stroke) b = grow(b, it.stroke.w * 0.5 * Math.max(1.5, it.stroke.join && it.stroke.join !== 'miter' ? 1.5 : (it.stroke.miter || 4)));
    } else if (it.t === 'image') b = [it.x, it.y, it.x + it.w, it.y + it.h];
    else if (it.t === 'text') { const w = it.size * 1.1 * it.s.length; b = [it.x - w, it.y - it.size * 1.3, it.x + w, it.y + it.size * 0.6]; }
    else if (it.t === 'group') {
      b = itemsBox(it.items, sc);
      if (b && it.clip) { const c = pathBox(it.clip); b = [Math.max(b[0], c[0]), Math.max(b[1], c[1]), Math.min(b[2], c[2]), Math.min(b[3], c[3])]; if (b[0] >= b[2] || b[1] >= b[3]) b = null; }
    }
    if (!b) return null;
    b = grow(b, 1 / sc + (it.blur ? (it.blur * 3 + 2) / sc : 0));
    return xfBox(b, it.xf);
  }
  function itemsBox(items, scale) {
    let u = null;
    for (const it of items) {
      const b = itemBox(it, scale);
      if (!b) continue;
      u = u ? [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])] : b;
    }
    return u;
  }
  const hex = (h, a) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a === undefined ? 1 : a];
  g.DL = { P, X, rng, hex, itemsBox, xfBox };
})(typeof window !== 'undefined' ? window : globalThis);
