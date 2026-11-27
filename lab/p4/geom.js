/* lab/p4 geom.js — 形の計算（画面なしで動く。ブラウザでも node でも読める）
   データの形は README ではなく RESULTS.md の「データの形」を見る。
   点：{id, p:[x,y], in?:[dx,dy], out?:[dx,dy], corner?:true}   in/out は点からの差。無ければ自動（HND の式）。 */
(function (root) {
  'use strict';
  const G = {};
  G.K = 0.36;               /* 自動の取っ手の長さ＝となりの点までの距離×0.36（parts.html の HND と同じ：0.5×0.72） */
  const KAPPA = 0.5522847498;

  let idSeq = 0;
  G.newId = function (pre) { idSeq++; return (pre || 'n') + Date.now().toString(36).slice(-5) + idSeq.toString(36) + Math.floor(Math.random() * 1296).toString(36); };

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const len = a => Math.hypot(a[0], a[1]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  G.v = { sub, add, mul, len, dist, norm, dot };

  /* ---- となりの点（開いた線の端は、となりでの曲がり方を鏡に映す） ---- */
  function mirrorAcrossBisector(p, a, b) {   /* p を、a-b の垂直二等分線で折り返す */
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], u = norm(sub(b, a)), d = sub(p, m), k = dot(d, u);
    return [p[0] - 2 * k * u[0], p[1] - 2 * k * u[1]];
  }
  function nb(pts, closed, i) {
    const n = pts.length;
    if (closed) return pts[((i % n) + n) % n].p;
    if (i >= 0 && i < n) return pts[i].p;
    if (n < 3) return i < 0 ? pts[0].p : pts[n - 1].p;
    return i < 0 ? mirrorAcrossBisector(pts[2].p, pts[0].p, pts[1].p) : mirrorAcrossBisector(pts[n - 3].p, pts[n - 1].p, pts[n - 2].p);
  }
  /* 点 i の「出る取っ手」「入る取っ手」（絶対の位置）。auto:true＝自動で決めた物 */
  G.hOut = function (pts, closed, i) {
    const b = pts[i];
    if (b.out) return { p: add(b.p, b.out), auto: false };
    if (b.corner) return { p: b.p.slice(), auto: true };
    const n = pts.length;
    if (!closed && i >= n - 1) { /* 開いた線の終点：先が無いので、入る側の反対へ */
      const hi = G.hIn(pts, closed, i); return { p: [2 * b.p[0] - hi.p[0], 2 * b.p[1] - hi.p[1]], auto: true };
    }
    const a = nb(pts, closed, i - 1), c = nb(pts, closed, i + 1), L = dist(b.p, c), u = norm(sub(c, a));
    return { p: [b.p[0] + u[0] * G.K * L, b.p[1] + u[1] * G.K * L], auto: true };
  };
  G.hIn = function (pts, closed, i) {
    const c = pts[i];
    if (c.in) return { p: add(c.p, c.in), auto: false };
    if (c.corner) return { p: c.p.slice(), auto: true };
    if (!closed && i <= 0) { const ho = G.hOut(pts, closed, i); return { p: [2 * c.p[0] - ho.p[0], 2 * c.p[1] - ho.p[1]], auto: true }; }
    const b = nb(pts, closed, i - 1), d = nb(pts, closed, i + 1), L = dist(b, c.p), u = norm(sub(d, b));
    return { p: [c.p[0] - u[0] * G.K * L, c.p[1] - u[1] * G.K * L], auto: true };
  };
  /* 区間の並び：[{i,j,p0,c1,c2,p3}] */
  G.segs = function (pts, closed) {
    const n = pts.length, out = [];
    if (n < 2) return out;
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n;
      out.push({ i, j, p0: pts[i].p, c1: G.hOut(pts, closed, i).p, c2: G.hIn(pts, closed, j).p, p3: pts[j].p });
    }
    return out;
  };
  G.bez = function (s, t) {
    const v = 1 - t, a = v * v * v, b = 3 * v * v * t, c = 3 * v * t * t, d = t * t * t;
    return [a * s.p0[0] + b * s.c1[0] + c * s.c2[0] + d * s.p3[0], a * s.p0[1] + b * s.c1[1] + c * s.c2[1] + d * s.p3[1]];
  };

  /* ---- 図形（数値のまま持つ物）を点の並びに ---- */
  function mkPt(p, i, o, corner) { const q = { id: G.newId('p'), p: p }; if (i) q.in = i; if (o) q.out = o; if (corner) q.corner = true; return q; }
  G.primLocal = function (geo) {      /* 中心が原点・回していない形 */
    if (geo.t === 'ellipse') {
      const a = geo.size[0] / 2, b = geo.size[1] / 2, ka = a * KAPPA, kb = b * KAPPA;
      return [mkPt([0, -b], [-ka, 0], [ka, 0]), mkPt([a, 0], [0, -kb], [0, kb]), mkPt([0, b], [ka, 0], [-ka, 0]), mkPt([-a, 0], [0, kb], [0, -kb])];
    }
    let w, h, r;
    if (geo.t === 'capsule') { w = geo.len; h = geo.w; r = Math.min(w, h) / 2; }
    else { w = geo.size[0]; h = geo.size[1]; r = Math.max(0, Math.min(geo.round || 0, Math.min(w, h) / 2)); }
    const a = w / 2, b = h / 2;
    if (r < 0.01) return [mkPt([-a, -b], null, null, true), mkPt([a, -b], null, null, true), mkPt([a, b], null, null, true), mkPt([-a, b], null, null, true)];
    const k = r * KAPPA, raw = [
      mkPt([-a + r, -b], [-k, 0], null, true), mkPt([a - r, -b], null, [k, 0], true),
      mkPt([a, -b + r], [0, -k], null, true), mkPt([a, b - r], null, [0, k], true),
      mkPt([a - r, b], [k, 0], null, true), mkPt([-a + r, b], null, [-k, 0], true),
      mkPt([-a, b - r], [0, k], null, true), mkPt([-a, -b + r], null, [0, -k], true)];
    /* 同じ場所に重なった点を1つにまとめる（長丸の端など）。まとめた点は、なめらかな点になる */
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const q = raw[i], nx = raw[(i + 1) % raw.length];
      if (dist(q.p, nx.p) < 0.01) { const m = { id: q.id, p: q.p }; if (q.in) m.in = q.in; if (nx.out) m.out = nx.out; out.push(m); i++; }
      else out.push(q);
    }
    if (out.length > 1 && dist(out[0].p, out[out.length - 1].p) < 0.01) { const l = out.pop(); if (l.in) out[0].in = l.in; delete out[0].corner; }
    return out;
  };
  function rotV(v, r) { const c = Math.cos(r), s = Math.sin(r); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }
  /* どの形でも、画面の座標の点の並びにする */
  G.outline = function (node) {
    const g = node.geo;
    if (!g) return { pts: [], closed: false };
    if (g.t === 'path') return { pts: g.pts, closed: !!g.closed };
    const xf = node.xf || { pos: [0, 0], rot: 0 }, r = (xf.rot || 0) * Math.PI / 180;
    const pts = G.primLocal(g).map(q => { const o = { id: q.id, p: add(rotV(q.p, r), xf.pos) }; if (q.in) o.in = rotV(q.in, r); if (q.out) o.out = rotV(q.out, r); if (q.corner) o.corner = true; return o; });
    return { pts, closed: true };
  };
  G.isPrim = node => !!(node.geo && node.geo.t !== 'path');
  G.isOpen = node => !!(node.geo && node.geo.t === 'path' && !node.geo.closed);

  /* 描く道筋の命令（ブラウザでは Path2D にする） */
  G.cmds = function (node) {
    const o = G.outline(node), pts = o.pts, out = [];
    if (!pts.length) return out;
    out.push(['M', pts[0].p[0], pts[0].p[1]]);
    if (pts.length === 1) { out.push(['L', pts[0].p[0] + 0.01, pts[0].p[1]]); return out; }
    for (const s of G.segs(pts, o.closed)) out.push(['C', s.c1[0], s.c1[1], s.c2[0], s.c2[1], s.p3[0], s.p3[1]]);
    if (o.closed) out.push(['Z']);
    return out;
  };
  G.path2d = function (node) {
    const p = new Path2D();
    for (const c of G.cmds(node)) {
      if (c[0] === 'M') p.moveTo(c[1], c[2]); else if (c[0] === 'L') p.lineTo(c[1], c[2]);
      else if (c[0] === 'C') p.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); else p.closePath();
    }
    return p;
  };
  G.flat = function (pts, closed, per) {
    per = per || 16; const out = [];
    const ss = G.segs(pts, closed);
    if (!ss.length) return pts.map(q => q.p.slice());
    for (const s of ss) for (let j = 0; j < per; j++) out.push(G.bez(s, j / per));
    if (!closed) out.push(pts[pts.length - 1].p.slice());
    return out;
  };
  G.bbox = function (node) {
    if (node.kind === 'group' || !node.geo) return null;
    const o = G.outline(node), S = G.flat(o.pts, o.closed, 12);
    if (!S.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of S) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return [x0, y0, x1, y1];
  };
  G.bboxOf = function (nodes) {
    let r = null;
    for (const n of nodes) { const b = G.bbox(n); if (!b) continue; r = r ? [Math.min(r[0], b[0]), Math.min(r[1], b[1]), Math.max(r[2], b[2]), Math.max(r[3], b[3])] : b; }
    return r;
  };
  /* 線の上でいちばん近い所 */
  G.nearest = function (pts, closed, p) {
    let best = { d: 1e9, seg: -1, t: 0, pt: null };
    const ss = G.segs(pts, closed);
    ss.forEach((s, k) => {
      for (let j = 0; j <= 40; j++) { const t = j / 40, q = G.bez(s, t), d = dist(q, p); if (d < best.d) best = { d, seg: k, t, pt: q, i: s.i, j: s.j }; }
    });
    return best;
  };
  /* 区間 seg の t の所に点を足す（形は変えない）。足した点を返す */
  G.splitAt = function (pts, closed, seg, t) {
    const s = G.segs(pts, closed)[seg]; if (!s) return null;
    t = Math.max(0.02, Math.min(0.98, t));
    const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const a1 = L(s.p0, s.c1), a2 = L(s.c1, s.c2), a3 = L(s.c2, s.p3), b1 = L(a1, a2), b2 = L(a2, a3), m = L(b1, b2);
    const A = pts[s.i], B = pts[s.j];
    A.out = sub(a1, A.p); B.in = sub(a3, B.p);
    const q = { id: G.newId('p'), p: m, in: sub(b1, m), out: sub(b2, m) };
    pts.splice(s.i + 1, 0, q);
    return q;
  };

  /* ---- 動かす・回す・大きさ（M=[a,b,c,d,e,f]：x'=a x+c y+e, y'=b x+d y+f） ---- */
  G.apply = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  G.applyV = (M, p) => [M[0] * p[0] + M[2] * p[1], M[1] * p[0] + M[3] * p[1]];
  G.transformNode = function (node, M) {
    const g = node.geo; if (!g) return;
    if (g.t === 'path') {
      for (const q of g.pts) { q.p = G.apply(M, q.p); if (q.in) q.in = G.applyV(M, q.in); if (q.out) q.out = G.applyV(M, q.out); }
      if (M[0] * M[3] - M[1] * M[2] < 0) { /* 裏返したら、回る向きは変わるが in/out の役はそのまま */ }
      const sc = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
      if (node.stroke && node.scaleStroke !== false && Math.abs(sc - 1) > 1e-6) node.stroke.w = Math.max(0.5, Math.round(node.stroke.w * sc * 100) / 100);
      return;
    }
    const xf = node.xf || (node.xf = { pos: [0, 0], rot: 0 }), r = (xf.rot || 0) * Math.PI / 180;
    const ex = G.applyV(M, [Math.cos(r), Math.sin(r)]), ey = G.applyV(M, [-Math.sin(r), Math.cos(r)]);
    const kx = len(ex), ky = len(ey);
    xf.pos = G.apply(M, xf.pos);
    let nr = Math.atan2(ex[1], ex[0]) * 180 / Math.PI;
    nr = ((nr % 180) + 180) % 180; if (nr > 90) nr -= 180;     /* 図形はどれも左右・上下対称なので、-90〜90 にそろえる */
    xf.rot = Math.round(nr * 100) / 100;
    if (g.t === 'capsule') { g.len *= kx; g.w *= ky; }
    else { g.size = [g.size[0] * kx, g.size[1] * ky]; if (g.t === 'rect') g.round = (g.round || 0) * Math.min(kx, ky); }
    const sc = Math.sqrt(kx * ky);
    if (node.stroke && Math.abs(sc - 1) > 1e-6) node.stroke.w = Math.max(0.5, Math.round(node.stroke.w * sc * 100) / 100);
  };
  /* 図形を「自由な形」に変える */
  G.toPath = function (node) {
    if (!G.isPrim(node)) return;
    const o = G.outline(node);
    node.geo = { t: 'path', pts: o.pts, closed: true }; delete node.xf;
  };

  /* ---- 清書：点を減らしてなめらかに（Schneider の曲線あてはめ。Graphics Gems の方法を自前で書いた物） ---- */
  function fitCubic(d, first, last, t1, t2, err, out) {
    const n = last - first + 1;
    if (n === 2) { const L = dist(d[first], d[last]) / 3; out.push([d[first], add(d[first], mul(t1, L)), add(d[last], mul(t2, L)), d[last]]); return; }
    let u = chord(d, first, last), bz = genBez(d, first, last, u, t1, t2), me = maxErr(d, first, last, bz, u);
    if (me.e < err) { out.push(bz); return; }
    if (me.e < err * 16) {
      for (let i = 0; i < 6; i++) {
        u = repar(d, first, last, u, bz); bz = genBez(d, first, last, u, t1, t2); me = maxErr(d, first, last, bz, u);
        if (me.e < err) { out.push(bz); return; }
      }
    }
    let sp = me.i; if (sp <= first) sp = first + 1; if (sp >= last) sp = last - 1;
    const lo = Math.max(first, sp - 2), hi = Math.min(last, sp + 2);
    const tc = norm(sub(d[lo], d[hi]));
    fitCubic(d, first, sp, t1, tc, err, out); fitCubic(d, sp, last, mul(tc, -1), t2, err, out);
  }
  function chord(d, f, l) { const u = [0]; for (let i = f + 1; i <= l; i++) u.push(u[i - f - 1] + dist(d[i], d[i - 1])); const T = u[u.length - 1] || 1; return u.map(x => x / T); }
  function genBez(d, f, l, u, t1, t2) {
    const n = l - f + 1, p0 = d[f], p3 = d[l]; let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
    for (let i = 0; i < n; i++) {
      const t = u[i], v = 1 - t, b0 = v * v * v, b1 = 3 * v * v * t, b2 = 3 * v * t * t, b3 = t * t * t;
      const a1 = mul(t1, b1), a2 = mul(t2, b2);
      c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
      const tmp = sub(d[f + i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
      x0 += dot(a1, tmp); x1 += dot(a2, tmp);
    }
    const det = c00 * c11 - c01 * c01; let al = 0, ar = 0;
    if (Math.abs(det) > 1e-9) { al = (x0 * c11 - x1 * c01) / det; ar = (c00 * x1 - c01 * x0) / det; }
    const L = dist(p0, p3), eps = 1e-6 * L;
    if (al < eps || ar < eps || al > L * 3 || ar > L * 3) { al = ar = L / 3; }
    return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
  }
  const bzAt = (b, t) => G.bez({ p0: b[0], c1: b[1], c2: b[2], p3: b[3] }, t);
  function maxErr(d, f, l, bz, u) { let e = 0, k = Math.floor((f + l) / 2); for (let i = f + 1; i < l; i++) { const q = bzAt(bz, u[i - f]), dd = (q[0] - d[i][0]) ** 2 + (q[1] - d[i][1]) ** 2; if (dd >= e) { e = dd; k = i; } } return { e, i: k }; }
  function repar(d, f, l, u, bz) {
    const q1 = [0, 1, 2].map(i => mul(sub(bz[i + 1], bz[i]), 3)), q2 = [0, 1].map(i => mul(sub(q1[i + 1], q1[i]), 2));
    return u.map((t, k) => {
      const v = 1 - t, q = bzAt(bz, t), d1 = add(add(mul(q1[0], v * v), mul(q1[1], 2 * v * t)), mul(q1[2], t * t)), d2 = add(mul(q2[0], v), mul(q2[1], t));
      const df = sub(q, d[f + k]), num = dot(df, d1), den = dot(d1, d1) + dot(df, d2);
      if (Math.abs(den) < 1e-12) return t; const r = t - num / den; return r < 0 || r > 1 ? t : r;
    });
  }
  /* node の形を清書した点の並びにして返す（node は変えない）。tol：どこまでずれてよいか（画面の単位） */
  G.seisho = function (node, tol) {
    const o = G.outline(node), pts = o.pts, closed = o.closed, n = pts.length;
    if (n < 3 && closed) return null; if (n < 2) return null;
    const per = 24, ss = G.segs(pts, closed);
    /* 角：角の印が付いた点と、取っ手の向きが大きく折れている点 */
    const isCorner = i => {
      if (!closed && (i === 0 || i === n - 1)) return true;
      const hi = G.hIn(pts, closed, i).p, ho = G.hOut(pts, closed, i).p, a = sub(pts[i].p, hi), b = sub(ho, pts[i].p);
      let va = a, vb = b;
      if (len(va) < 0.5) va = sub(pts[i].p, nb(pts, closed, i - 1)); if (len(vb) < 0.5) vb = sub(nb(pts, closed, i + 1), pts[i].p);
      const c = dot(norm(va), norm(vb)); return c < Math.cos(35 * Math.PI / 180);
    };
    const S = [], cornerAt = [];
    ss.forEach((s, k) => { if (isCorner(s.i)) cornerAt.push(S.length); for (let j = 0; j < per; j++) S.push(G.bez(s, j / per)); });
    if (!closed) { cornerAt.push(S.length); S.push(pts[n - 1].p.slice()); }
    const err = tol * tol, out = [];
    const tanAt = (arr, i, dir) => { const j = Math.max(0, Math.min(arr.length - 1, i + dir * 2)); return norm(sub(arr[j], arr[i])); };
    const runs = [];
    if (closed) {
      if (!cornerAt.length) {       /* 角が無い輪：始まりを決めて、そこはなめらかにつなぐ */
        const N = S.length, tc = norm(sub(S[2 % N], S[(N - 2) % N])), arr = S.concat([S[0]]);
        const beziers = []; fitCubic(arr, 0, arr.length - 1, tc, mul(tc, -1), err, beziers);
        return bezToPts(beziers, true, [false]);
      }
      const N = S.length, rot = S.slice(cornerAt[0]).concat(S.slice(0, cornerAt[0])), cs = cornerAt.map(c => c - cornerAt[0]);
      cs.push(N); rot.push(rot[0]);
      for (let k = 0; k < cs.length - 1; k++) runs.push([rot, cs[k], cs[k + 1]]);
    } else for (let k = 0; k < cornerAt.length - 1; k++) runs.push([S, cornerAt[k], cornerAt[k + 1]]);
    const flags = [];
    for (const [arr, a, b] of runs) {
      if (b - a < 1) continue;
      const before = out.length;
      fitCubic(arr, a, b, tanAt(arr, a, 1), tanAt(arr, b, -1), err, out);
      for (let i = before; i < out.length; i++) flags.push(i === before);
    }
    return bezToPts(out, closed, flags);
  };
  function bezToPts(bz, closed, cornerStart) {
    const pts = [];
    bz.forEach((b, k) => {
      const q = { id: G.newId('p'), p: [r2(b[0][0]), r2(b[0][1])], out: r2v(sub(b[1], b[0])) };
      if (cornerStart[k]) q.corner = true;
      if (k > 0) q.in = r2v(sub(bz[k - 1][2], bz[k - 1][3]));
      pts.push(q);
    });
    const last = bz[bz.length - 1];
    if (closed) pts[0].in = r2v(sub(last[2], last[3]));
    else pts.push({ id: G.newId('p'), p: [r2(last[3][0]), r2(last[3][1])], in: r2v(sub(last[2], last[3])), corner: true });
    return pts;
  }
  const r2 = x => Math.round(x * 100) / 100, r2v = v => [r2(v[0]), r2(v[1])];
  G.r2 = r2;

  /* ---- 数える ---- */
  G.ptCount = function (node) { if (node.kind === 'group' || !node.geo) return 0; return node.geo.t === 'path' ? node.geo.pts.length : G.primLocal(node.geo).length; };
  G.stats = function (doc) {
    const parts = doc.nodes.filter(n => n.kind !== 'group' && n.geo);
    const per = parts.map(n => ({ id: n.id, name: n.name, pts: G.ptCount(n), kind: G.isPrim(n) ? '図形' : (G.isOpen(n) ? '線' : '自由な形'), geo: n.geo.t }));
    const total = per.reduce((a, b) => a + b.pts, 0), max = per.reduce((a, b) => (b.pts > a.pts ? b : a), { pts: 0, name: '' });
    return {
      parts: parts.length, groups: doc.nodes.filter(n => n.kind === 'group').length, points: total,
      maxPts: max.pts, maxName: max.name, over12: per.filter(p => p.pts > 12).length, over8: per.filter(p => p.pts > 8).length,
      lines: per.filter(p => p.kind === '線').length, prims: per.filter(p => p.kind === '図形').length,
      avg: parts.length ? Math.round(total / parts.length * 10) / 10 : 0, per
    };
  };

  /* ---- 描く（描く画面・見比べ・PNG・AI の見直し、全部これ） ---- */
  G.hiddenSet = function (doc) {
    const by = {}; doc.nodes.forEach(n => by[n.id] = n);
    const hid = new Set(), lock = new Set();
    for (const n of doc.nodes) {
      let q = n, h = false, l = false, guard = 0;
      while (q && guard++ < 20) { if (q.visible === false) h = true; if (q.locked) l = true; q = q.parent ? by[q.parent] : null; }
      if (h) hid.add(n.id); if (l) lock.add(n.id);
    }
    return { hid, lock, by };
  };
  G.draw = function (ctx, doc, opt) {
    opt = opt || {};
    if (!opt.noBg) { ctx.fillStyle = doc.bg || '#fff'; ctx.fillRect(0, 0, doc.w, doc.h); }
    if (opt.under) opt.under(ctx);
    const { hid } = G.hiddenSet(doc);
    ctx.save(); if (opt.alpha != null) ctx.globalAlpha = opt.alpha;
    for (const n of doc.nodes) {
      if (n.kind === 'group' || !n.geo || hid.has(n.id)) continue;
      const p = G.path2d(n);
      if (n.fill && !G.isOpen(n)) { ctx.fillStyle = n.fill; ctx.fill(p); }
      if (n.stroke && n.stroke.w > 0) { ctx.strokeStyle = n.stroke.c; ctx.lineWidth = n.stroke.w; ctx.lineCap = n.stroke.cap || 'round'; ctx.lineJoin = 'round'; ctx.stroke(p); }
    }
    ctx.restore();
  };
  /* 輪郭と点だけを重ねる（見比べ・見直し用） */
  G.drawPoints = function (ctx, doc, scale, color) {
    const { hid } = G.hiddenSet(doc), s = 1 / (scale || 1);
    for (const n of doc.nodes) {
      if (n.kind === 'group' || !n.geo || hid.has(n.id)) continue;
      const o = G.outline(n);
      ctx.strokeStyle = color || '#0a84ff'; ctx.lineWidth = 1 * s; ctx.stroke(G.path2d(n));
      for (const q of o.pts) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = color || '#0a84ff'; ctx.lineWidth = 1.2 * s;
        ctx.beginPath(); if (q.corner) ctx.rect(q.p[0] - 3 * s, q.p[1] - 3 * s, 6 * s, 6 * s); else ctx.arc(q.p[0], q.p[1], 3.2 * s, 0, 7);
        ctx.fill(); ctx.stroke();
      }
    }
  };

  G.emptyDoc = function (goal) {
    return { kind: 'lab-p4-doc', v: 1, w: goal ? goal.w : 1600, h: goal ? goal.h : 900, bg: goal ? goal.bg : '#ffffff', nodes: [] };
  };
  G.validDoc = function (d) { return d && d.kind === 'lab-p4-doc' && Array.isArray(d.nodes) && d.nodes.every(n => n && n.id && (n.kind === 'group' || (n.geo && n.geo.t))); };

  if (typeof module !== 'undefined' && module.exports) module.exports = G; else root.P4G = G;
})(typeof window !== 'undefined' ? window : globalThis);
