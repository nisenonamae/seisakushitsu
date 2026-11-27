// R1：Canvas 2D で「描く物の一覧」を描く部品。
// opt.cpu=true のとき、willReadFrequently を付けて作る（Chrome では GPU を使わず CPU で描く設定になる）。
(function (g) {
  'use strict';
  const BLEND = { normal: 'source-over', multiply: 'multiply', screen: 'screen', add: 'lighter', overlay: 'overlay' };
  const css = c => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] === undefined ? 1 : c[3]) + ')';

  function R1(canvas, assets, opt) {
    opt = opt || {};
    this.canvas = canvas; this.assets = assets; this.cpu = !!opt.cpu;
    this.ctxOpt = { willReadFrequently: this.cpu, colorSpace: 'srgb' };
    this.ctx = canvas.getContext('2d', this.ctxOpt);
    this.layers = [];
    this.filterOK = typeof this.ctx.filter === 'string'; // Safari は無い（ぼかしが描けない）
  }
  // 層（別の canvas）を用意する。r＝使う四角（画素）。その中だけを消して、その中だけに描く
  R1.prototype.layer = function (depth, r) {
    let L = this.layers[depth];
    if (!L) {
      const c = document.createElement('canvas');
      c.width = this.canvas.width; c.height = this.canvas.height;
      L = this.layers[depth] = { c, ctx: c.getContext('2d', this.ctxOpt) };
    }
    L.ctx.setTransform(1, 0, 0, 1, 0, 0);
    L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = 'source-over'; L.ctx.filter = 'none';
    L.ctx.clearRect(r[0], r[1], r[2], r[3]);
    L.ctx.save();
    L.ctx.beginPath(); L.ctx.rect(r[0], r[1], r[2], r[3]); L.ctx.clip();
    return L;
  };
  R1.prototype.paint = function (ctx, p) {
    if (Array.isArray(p)) return css(p);
    let gr;
    if (p.lin) gr = ctx.createLinearGradient(p.lin[0], p.lin[1], p.lin[2], p.lin[3]);
    else gr = ctx.createRadialGradient(p.rad[0], p.rad[1], 0, p.rad[0], p.rad[1], p.rad[2]);
    for (const s of p.stops) gr.addColorStop(s[0], css(s[1]));
    return gr;
  };
  function trace(ctx, d) {
    ctx.beginPath();
    for (const c of d) {
      switch (c[0]) {
        case 'M': ctx.moveTo(c[1], c[2]); break;
        case 'L': ctx.lineTo(c[1], c[2]); break;
        case 'Q': ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]); break;
        case 'C': ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); break;
        case 'Z': ctx.closePath(); break;
      }
    }
  }
  R1.prototype.render = function (scene) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = css(scene.bg);
    ctx.fillRect(0, 0, scene.w, scene.h);
    this.items(ctx, scene.items, 0);
  };
  R1.prototype.items = function (ctx, items, depth) {
    for (const it of items) this.item(ctx, it, depth);
  };
  R1.prototype.item = function (ctx, it, depth) {
    ctx.save();
    if (it.xf) ctx.transform(it.xf[0], it.xf[1], it.xf[2], it.xf[3], it.xf[4], it.xf[5]);
    const op = it.op === undefined ? 1 : it.op;
    if (it.t === 'group') {
      const needLayer = op < 1 || (it.blend && it.blend !== 'normal') || it.blur || it.mask;
      if (!needLayer) {
        if (it.clip) { trace(ctx, it.clip); ctx.clip(); }
        this.items(ctx, it.items, depth);
      } else {
        const m = ctx.getTransform();
        // 層の大きさを、中身の囲みに合わせる（画面いっぱいの層は遅い）
        const W = this.canvas.width, H = this.canvas.height;
        const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
        let lb = g.DL.itemsBox(it.items, scale), r = null;
        if (lb) {
          if (it.clip) { const cb = g.DL.itemsBox([{ t: 'path', d: it.clip }], scale); lb = [Math.max(lb[0], cb[0]), Math.max(lb[1], cb[1]), Math.min(lb[2], cb[2]), Math.min(lb[3], cb[3])]; }
          const db = g.DL.xfBox(lb, [m.a, m.b, m.c, m.d, m.e, m.f]), k = it.blur ? Math.ceil(it.blur * 3) + 2 : 1;
          const x0 = Math.max(0, Math.floor(db[0]) - k), y0 = Math.max(0, Math.floor(db[1]) - k), x1 = Math.min(W, Math.ceil(db[2]) + k), y1 = Math.min(H, Math.ceil(db[3]) + k);
          if (x1 > x0 && y1 > y0) r = [x0, y0, x1 - x0, y1 - y0];
        }
        if (r) {
          const L = this.layer(depth, r);
          L.ctx.setTransform(m);
          if (it.clip) { trace(L.ctx, it.clip); L.ctx.clip(); }
          this.items(L.ctx, it.items, depth + 1);
          L.ctx.restore();
          if (it.mask) {
            const M = this.layer(depth + 1, r);
            M.ctx.setTransform(m);
            this.items(M.ctx, it.mask, depth + 2);
            M.ctx.restore();
            L.ctx.setTransform(1, 0, 0, 1, 0, 0);
            L.ctx.globalCompositeOperation = 'destination-in';
            L.ctx.drawImage(M.c, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]);
            L.ctx.globalCompositeOperation = 'source-over';
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = op;
          ctx.globalCompositeOperation = BLEND[it.blend || 'normal'];
          if (it.blur) ctx.filter = 'blur(' + it.blur + 'px)';
          ctx.drawImage(L.c, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]);
        }
      }
    } else {
      ctx.globalAlpha = op;
      ctx.globalCompositeOperation = BLEND[it.blend || 'normal'];
      if (it.blur) ctx.filter = 'blur(' + it.blur + 'px)';
      if (it.t === 'path') {
        trace(ctx, it.d);
        if (it.fill) { ctx.fillStyle = this.paint(ctx, it.fill); ctx.fill(); }
        if (it.stroke) {
          const s = it.stroke;
          ctx.strokeStyle = this.paint(ctx, s.paint);
          ctx.lineWidth = s.w; ctx.lineCap = s.cap || 'butt'; ctx.lineJoin = s.join || 'miter';
          ctx.miterLimit = s.miter || 4;
          ctx.stroke();
        }
      } else if (it.t === 'image') {
        const im = this.assets.images[it.src].bitmap;
        ctx.imageSmoothingEnabled = it.q !== 'nearest';
        ctx.imageSmoothingQuality = it.q === 'mip' ? 'medium' : 'low';
        ctx.drawImage(im, it.x, it.y, it.w, it.h);
      } else if (it.t === 'text') {
        ctx.font = it.size + 'px ' + (it.font === 'regular' ? 'P1Sans-Regular' : 'P1Sans-Bold');
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = it.align || 'left';
        if ('fontKerning' in ctx) ctx.fontKerning = 'none';
        ctx.fillStyle = css(it.fill);
        ctx.fillText(it.s, it.x, it.y);
      }
    }
    ctx.restore();
  };
  R1.prototype.flush = function () {};
  // 画素を取り出す（RGBA・透明を掛けていない形）
  R1.prototype.readPixels = function () {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
  };
  R1.prototype.dispose = function () { this.layers = []; };
  g.R1 = R1;
})(window);
