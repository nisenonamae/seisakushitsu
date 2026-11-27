// R2：CanvasKit（Skia を WebAssembly にした物）で「描く物の一覧」を描く部品。
// opt.gpu=true のとき WebGL で描く。false のとき CPU で描く（WebAssembly の中だけで計算する）。
// CanvasKit の物（Paint・Path・Shader・ImageFilter など）は、使ったら自分で delete する必要がある。
(function (g) {
  'use strict';
  function R2(CK, canvas, assets, opt) {
    opt = opt || {};
    this.CK = CK; this.canvas = canvas; this.assets = assets; this.gpu = !!opt.gpu;
    this.show = opt.show !== false; // CPU のとき、画面の canvas に写すか
    if (this.gpu) {
      this.surface = CK.MakeWebGLCanvasSurface(canvas, CK.ColorSpace.SRGB, { antialias: 0, preserveDrawingBuffer: 1 });
    } else if (this.show) {
      this.surface = CK.MakeSWCanvasSurface(canvas);
    } else {
      this.surface = CK.MakeSurface(canvas.width, canvas.height);
    }
    if (!this.surface) throw new Error('CanvasKit の面を作れなかった（' + (this.gpu ? 'GPU' : 'CPU') + '）');
    this.sk = this.surface.getCanvas();
    this.paint = new CK.Paint();
    this.paint.setAntiAlias(true);
    this.fonts = {};
    this.BLEND = { normal: CK.BlendMode.SrcOver, multiply: CK.BlendMode.Multiply, screen: CK.BlendMode.Screen, add: CK.BlendMode.Plus, overlay: CK.BlendMode.Overlay };
    this.CAP = { butt: CK.StrokeCap.Butt, round: CK.StrokeCap.Round, square: CK.StrokeCap.Square };
    this.JOIN = { miter: CK.StrokeJoin.Miter, round: CK.StrokeJoin.Round, bevel: CK.StrokeJoin.Bevel };
    this.info = { width: canvas.width, height: canvas.height, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB };
    this.dither = !!opt.dither;
  }
  R2.prototype.path = function (d) {
    const CK = this.CK, a = [];
    for (const c of d) {
      switch (c[0]) {
        case 'M': a.push(CK.MOVE_VERB, c[1], c[2]); break;
        case 'L': a.push(CK.LINE_VERB, c[1], c[2]); break;
        case 'Q': a.push(CK.QUAD_VERB, c[1], c[2], c[3], c[4]); break;
        case 'C': a.push(CK.CUBIC_VERB, c[1], c[2], c[3], c[4], c[5], c[6]); break;
        case 'Z': a.push(CK.CLOSE_VERB); break;
      }
    }
    return CK.Path.MakeFromCmds(a);
  };
  const col = (CK, c) => CK.Color4f(c[0] / 255, c[1] / 255, c[2] / 255, c[3] === undefined ? 1 : c[3]);
  // 塗りを paint に入れる。作った Shader を返す（あとで delete する）
  R2.prototype.setPaint = function (p, op) {
    const CK = this.CK, paint = this.paint;
    if (Array.isArray(p)) {
      paint.setShader(null);
      paint.setColor(CK.Color4f(p[0] / 255, p[1] / 255, p[2] / 255, (p[3] === undefined ? 1 : p[3]) * op));
      return null;
    }
    const colors = p.stops.map(s => col(CK, s[1])), pos = p.stops.map(s => s[0]);
    let sh;
    if (p.lin) sh = CK.Shader.MakeLinearGradient([p.lin[0], p.lin[1]], [p.lin[2], p.lin[3]], colors, pos, CK.TileMode.Clamp);
    else sh = CK.Shader.MakeRadialGradient([p.rad[0], p.rad[1]], p.rad[2], colors, pos, CK.TileMode.Clamp);
    paint.setColor(CK.Color4f(0, 0, 0, op));
    paint.setShader(sh);
    return sh;
  };
  R2.prototype.scaleNow = function () {
    const m = this.sk.getTotalMatrix(); // [a,c,e, b,d,f, …]
    return Math.sqrt(Math.abs(m[0] * m[4] - m[1] * m[3])) || 1;
  };
  R2.prototype.blurFilter = function (sigma) {
    const s = sigma / this.scaleNow(); // CanvasKit は変形でぼかしも拡大するので、割って戻す
    return this.CK.ImageFilter.MakeBlur(s, s, this.CK.TileMode.Decal, null);
  };
  R2.prototype.font = function (name, size) {
    const k = name + ':' + size;
    let f = this.fonts[k];
    if (!f) {
      const CK = this.CK;
      f = this.fonts[k] = new CK.Font(this.assets.fonts[name].typeface, size);
      f.setSubpixel(true); f.setLinearMetrics(true);
      f.setHinting(CK.FontHinting.None); f.setEdging(CK.FontEdging.AntiAlias);
    }
    return f;
  };
  R2.prototype.render = function (scene) {
    const CK = this.CK, sk = this.sk;
    sk.restoreToCount(1);
    sk.save();
    sk.clear(CK.Color4f(scene.bg[0] / 255, scene.bg[1] / 255, scene.bg[2] / 255, 1));
    this.items(scene.items);
    sk.restore();
  };
  R2.prototype.items = function (items) { for (const it of items) this.item(it); };
  R2.prototype.item = function (it) {
    const CK = this.CK, sk = this.sk, paint = this.paint;
    sk.save();
    if (it.xf) sk.concat([it.xf[0], it.xf[2], it.xf[4], it.xf[1], it.xf[3], it.xf[5], 0, 0, 1]);
    const op = it.op === undefined ? 1 : it.op;
    if (it.t === 'group') {
      if (it.clip) { const cp = this.path(it.clip); sk.clipPath(cp, CK.ClipOp.Intersect, true); cp.delete(); }
      const needLayer = op < 1 || (it.blend && it.blend !== 'normal') || it.blur || it.mask;
      if (!needLayer) {
        this.items(it.items);
      } else {
        const lp = new CK.Paint();
        lp.setAlphaf(op);
        lp.setBlendMode(this.BLEND[it.blend || 'normal']);
        let f = null;
        if (it.blur) { f = this.blurFilter(it.blur); lp.setImageFilter(f); }
        // 層の大きさを、中身の囲みに合わせる（画面いっぱいの層は遅い）
        const sc = this.scaleNow();
        let lb = g.DL.itemsBox(it.items, sc);
        if (lb && it.blur) { const k = (it.blur * 3 + 2) / sc; lb = [lb[0] - k, lb[1] - k, lb[2] + k, lb[3] + k]; }
        sk.saveLayer(lp, lb || [0, 0, 0, 0]);
        this.items(it.items);
        if (it.mask) {
          const mp = new CK.Paint();
          mp.setBlendMode(CK.BlendMode.DstIn);
          sk.saveLayer(mp, lb || [0, 0, 0, 0]);
          this.items(it.mask);
          sk.restore();
          mp.delete();
        }
        sk.restore();
        lp.delete(); if (f) f.delete();
      }
    } else {
      paint.setBlendMode(this.BLEND[it.blend || 'normal']);
      let f = null;
      if (it.blur) { f = this.blurFilter(it.blur); paint.setImageFilter(f); } else paint.setImageFilter(null);
      paint.setDither(this.dither);
      if (it.t === 'path') {
        const p = this.path(it.d);
        if (it.fill) {
          paint.setStyle(CK.PaintStyle.Fill);
          const sh = this.setPaint(it.fill, op);
          sk.drawPath(p, paint);
          if (sh) { paint.setShader(null); sh.delete(); }
        }
        if (it.stroke) {
          const s = it.stroke;
          paint.setStyle(CK.PaintStyle.Stroke);
          paint.setStrokeWidth(s.w);
          paint.setStrokeCap(this.CAP[s.cap || 'butt']);
          paint.setStrokeJoin(this.JOIN[s.join || 'miter']);
          paint.setStrokeMiter(s.miter || 4);
          const sh = this.setPaint(s.paint, op);
          sk.drawPath(p, paint);
          if (sh) { paint.setShader(null); sh.delete(); }
        }
        p.delete();
      } else if (it.t === 'image') {
        const im = this.assets.images[it.src];
        paint.setStyle(CK.PaintStyle.Fill);
        this.setPaint([0, 0, 0, 1], op);
        const src = [0, 0, im.w, im.h], dst = [it.x, it.y, it.x + it.w, it.y + it.h];
        if (it.q === 'nearest') sk.drawImageRectOptions(im.ck, src, dst, CK.FilterMode.Nearest, CK.MipmapMode.None, paint);
        else if (it.q === 'mip') sk.drawImageRectOptions(im.ckMip, src, dst, CK.FilterMode.Linear, CK.MipmapMode.Linear, paint);
        else sk.drawImageRectOptions(im.ck, src, dst, CK.FilterMode.Linear, CK.MipmapMode.None, paint);
      } else if (it.t === 'text') {
        const font = this.font(it.font === 'regular' ? 'regular' : 'bold', it.size);
        paint.setStyle(CK.PaintStyle.Fill);
        this.setPaint(it.fill, op);
        let x = it.x;
        if (it.align === 'center' || it.align === 'right') {
          const ws = font.getGlyphWidths(font.getGlyphIDs(it.s));
          let w = 0; for (let i = 0; i < ws.length; i++) w += ws[i];
          x -= it.align === 'center' ? w / 2 : w;
        }
        sk.drawText(it.s, x, it.y, paint, font);
      }
      if (f) { paint.setImageFilter(null); f.delete(); }
    }
    sk.restore();
  };
  R2.prototype.flush = function () { this.surface.flush(); };
  R2.prototype.readPixels = function () {
    return this.sk.readPixels(0, 0, this.info);
  };
  R2.prototype.dispose = function () {
    for (const k in this.fonts) this.fonts[k].delete();
    this.paint.delete(); this.surface.delete();
  };
  g.R2 = R2;
})(window);
