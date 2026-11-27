// 試しの土台：素材の読みこみ・描く部品の用意・画素の取り出し・差の計算・PNG・zip。
// 下見のページ（index.html）と、書き出しの側（tools/export.py が裏のブラウザで開く）が、同じこのファイルを使う。
// 決まり：外からは何も読まない（vendor/・fonts/・assets/ だけ）。localStorage は使わない。GitHub は呼ばない。
(function (g) {
  'use strict';
  const W = 1920, H = 1080;
  const KINDS = [
    { id: 'r1', name: 'R1 Canvas 2D（ふつう）' },
    { id: 'r1cpu', name: 'R1 Canvas 2D（CPU で描く設定）' },
    { id: 'r2gpu', name: 'R2 CanvasKit（GPU）' },
    { id: 'r2cpu', name: 'R2 CanvasKit（CPU）' },
  ];
  const P1 = { W, H, KINDS, assets: null, CK: null, load: {}, renderers: {}, errors: {} };

  async function bytes(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('読みこめない：' + url);
    return await r.arrayBuffer();
  }

  // 素材と CanvasKit を読みこむ。かかった時間を P1.load に残す
  P1.init = async function (opt) {
    opt = opt || {};
    if (P1.assets) return P1;
    const t0 = performance.now();
    const assets = { fonts: {}, images: {} };
    for (const [k, f, fam] of [['bold', 'fonts/P1Sans-Bold.otf', 'P1Sans-Bold'], ['regular', 'fonts/P1Sans-Regular.otf', 'P1Sans-Regular']]) {
      const b = await bytes(f);
      const face = new FontFace(fam, b.slice(0));
      await face.load();
      document.fonts.add(face);
      assets.fonts[k] = { bytes: b, family: fam };
    }
    for (const n of ['pattern256', 'face32', 'soft512']) {
      const b = await bytes('assets/' + n + '.png');
      const bitmap = await createImageBitmap(new Blob([b], { type: 'image/png' }), { colorSpaceConversion: 'none' });
      assets.images[n] = { bytes: b, bitmap, w: bitmap.width, h: bitmap.height };
    }
    P1.load.assetsMs = performance.now() - t0;
    if (!opt.noCK) {
      try {
        const t1 = performance.now();
        const CK = await g.CanvasKitInit({ locateFile: f => 'vendor/' + f });
        P1.load.canvaskitMs = performance.now() - t1;
        for (const k in assets.fonts) {
          assets.fonts[k].typeface = CK.Typeface.MakeTypefaceFromData(assets.fonts[k].bytes);
          if (!assets.fonts[k].typeface) throw new Error('CanvasKit が字を読めない：' + k);
        }
        for (const n in assets.images) {
          const im = assets.images[n];
          // 透明を先に掛けた形（premul）の画素にしてから持つ。そのまま渡すと、拡大したとき透明のふちが黒ずむ（確かめた）
          const raw = CK.MakeImageFromEncoded(im.bytes);
          const info = { width: im.w, height: im.h, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Premul, colorSpace: CK.ColorSpace.SRGB };
          im.ck = CK.MakeImage(info, raw.readPixels(0, 0, info), im.w * 4);
          raw.delete();
          im.ckMip = im.ck.makeCopyWithDefaultMipmaps();
        }
        P1.CK = CK;
      } catch (e) { P1.errors.canvaskit = String(e && e.message || e); }
    }
    P1.assets = assets;
    return P1;
  };

  // 描く部品を用意する（1種類につき1つ。canvas は 1920×1080・拡大率 1 に固定）
  P1.renderer = function (kind) {
    if (P1.renderers[kind]) return P1.renderers[kind];
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    let r;
    try {
      if (kind === 'r1') r = new g.R1(c, P1.assets, { cpu: false });
      else if (kind === 'r1cpu') r = new g.R1(c, P1.assets, { cpu: true });
      else if (!P1.CK) throw new Error(P1.errors.canvaskit || 'CanvasKit が無い');
      // R2 は、グラデーションに決まったざらつき（dither）を足す設定をふつうにする（足さないと色の帯が出る。確かめた）
      else if (kind === 'r2gpu') r = new g.R2(P1.CK, c, P1.assets, { gpu: true, dither: true });
      else if (kind === 'r2cpu') r = new g.R2(P1.CK, c, P1.assets, { gpu: false, dither: true });
      else if (kind === 'r2cpu_nodither') r = new g.R2(P1.CK, c, P1.assets, { gpu: false, dither: false });
      else if (kind === 'r2gpu_nodither') r = new g.R2(P1.CK, c, P1.assets, { gpu: true, dither: false });
      else throw new Error('知らない種類：' + kind);
    } catch (e) { P1.errors[kind] = String(e && e.message || e); return null; }
    P1.renderers[kind] = r;
    return r;
  };
  P1.scene = id => g.SCENES.find(s => s.id === id);

  // 1コマ描いて、画素（RGBA）を返す
  P1.renderPixels = function (kind, sceneId, t) {
    const r = P1.renderer(kind);
    if (!r) return null;
    const sc = P1.scene(sceneId).make(t || 0);
    const t0 = performance.now();
    r.render(sc); r.flush();
    const t1 = performance.now();
    const px = r.readPixels();
    const t2 = performance.now();
    return { px, drawMs: t1 - t0, readMs: t2 - t1 };
  };

  // 2枚の差：違う画素の割合・色の差が 8 を超える画素の割合・いちばん大きい色の差・平均の差
  P1.diff = function (a, b) {
    let nd = 0, n8 = 0, mx = 0, sum = 0;
    const n = a.length;
    for (let i = 0; i < n; i += 4) {
      const d0 = Math.abs(a[i] - b[i]), d1 = Math.abs(a[i + 1] - b[i + 1]), d2 = Math.abs(a[i + 2] - b[i + 2]), d3 = Math.abs(a[i + 3] - b[i + 3]);
      const d = Math.max(d0, d1, d2, d3);
      if (d) { nd++; if (d > 8) n8++; if (d > mx) mx = d; sum += d0 + d1 + d2; }
    }
    const np = n / 4;
    return { diffPct: 100 * nd / np, over8Pct: 100 * n8 / np, max: mx, mean: sum / (np * 3) };
  };
  P1.hash = async function (px) {
    if (!(g.crypto && g.crypto.subtle)) return null; // http の遠い所では使えない（https か localhost なら使える）
    const h = await g.crypto.subtle.digest('SHA-256', px);
    return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, '0')).join('');
  };
  let pngCanvas = null;
  P1.toPNG = function (px) { // 画素 → PNG（損なし。透明の無い絵なので、そのまま戻る）
    if (!pngCanvas) { pngCanvas = document.createElement('canvas'); pngCanvas.width = W; pngCanvas.height = H; }
    const ctx = pngCanvas.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, px.length), W, H), 0, 0);
    return new Promise(res => pngCanvas.toBlob(res, 'image/png'));
  };
  P1.b64 = async function (blob) {
    const u = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  // 書き出しの側が呼ぶ：1コマ描いて PNG（base64）・ハッシュ・時間を返す
  P1.renderPNG = async function (kind, sceneId, t) {
    const r = P1.renderPixels(kind, sceneId, t);
    if (!r) return { error: P1.errors[kind] || '描けない' };
    let opaque = true;
    for (let i = 3; i < r.px.length; i += 4) if (r.px[i] !== 255) { opaque = false; break; }
    const blob = await P1.toPNG(r.px);
    return { png: await P1.b64(blob), hash: await P1.hash(r.px), drawMs: r.drawMs, readMs: r.readMs, opaque };
  };

  // 速さ（詰めて描く）：n コマを続けて描き、1コマの「描く」「画素を取り出す」の時間を返す
  P1.bench = async function (kind, sceneId, n, opt) {
    opt = opt || {};
    const r = P1.renderer(kind);
    if (!r) return { error: P1.errors[kind] || '描けない' };
    const make = P1.scene(sceneId).make;
    const draw = [], read = [], enc = [];
    for (let i = 0; i < n + 2; i++) {
      const sc = make(i / 30);
      const t0 = performance.now();
      r.render(sc); r.flush();
      const t1 = performance.now();
      let px = null;
      if (opt.read !== false) px = r.readPixels();
      const t2 = performance.now();
      if (opt.png && px) { await P1.toPNG(px); }
      const t3 = performance.now();
      if (i >= 2) { draw.push(t1 - t0); read.push(t2 - t1); enc.push(t3 - t2); } // はじめの 2コマは慣らし
      if (i % 5 === 4) await new Promise(res => setTimeout(res, 0));
    }
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
    return { n, drawMs: avg(draw), drawMed: med(draw), readMs: avg(read), pngMs: opt.png ? avg(enc) : null };
  };

  // 速さ（画面に出しながら）：rAF で secs 秒動かし、fps と 1コマの描く時間を返す。canvas を host に入れて見せる
  P1.fps = function (kind, sceneId, secs, host) {
    return new Promise(res => {
      const r = P1.renderer(kind);
      if (!r) return res({ error: P1.errors[kind] || '描けない' });
      const make = P1.scene(sceneId).make;
      if (host) { host.textContent = ''; host.appendChild(r.canvas); }
      let n = 0, sum = 0, start = 0, last = 0, worst = 0;
      function step(now) {
        if (!start) { start = now; last = now; }
        const el = (now - start) / 1000;
        if (el >= secs) return res({ fps: n / el, drawMs: sum / Math.max(1, n), worstGapMs: worst, frames: n });
        if (now - last > worst) worst = now - last;
        last = now;
        const t0 = performance.now();
        r.render(make(el)); r.flush();
        sum += performance.now() - t0; n++;
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  };

  // 端末とブラウザの情報
  P1.device = function () {
    const d = {
      userAgent: navigator.userAgent, platform: navigator.platform || null,
      uaData: navigator.userAgentData ? { platform: navigator.userAgentData.platform, brands: navigator.userAgentData.brands } : null,
      dpr: g.devicePixelRatio, screen: [screen.width, screen.height], cores: navigator.hardwareConcurrency || null, memGB: navigator.deviceMemory || null,
      lang: navigator.language, canvasFilter: typeof document.createElement('canvas').getContext('2d').filter === 'string',
      secure: g.isSecureContext, when: new Date().toISOString(),
    };
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      if (gl) {
        const e = gl.getExtension('WEBGL_debug_renderer_info');
        d.gl = { version: gl.getParameter(gl.VERSION), renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : null };
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      } else d.gl = null;
    } catch (e) { d.gl = { error: String(e) }; }
    return d;
  };

  // 小さな zip 書き（圧縮なし。PNG はもう圧縮されているので、そのまま包む）
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  P1.zip = function (files) { // files = [{name, data:Uint8Array}]
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(10, 0x00210000, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint32(12, 0x00210000, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + sz;
    }
    let csz = 0; for (const p of central) csz += p.length;
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csz, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  };

  g.P1 = P1;
})(window);
