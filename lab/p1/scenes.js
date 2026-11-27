// 試しの場面（どれも 1920×1080）。同じ一覧を R1・R2 の両方に渡す。
// 一致を見る7つ＋絵の質を見る1つ＋速さを見る1つ。絵はすべてこのファイルで組んだ物（他人の絵は写していない）。
(function (g) {
  'use strict';
  const { P, X, rng, hex } = g.DL;
  const W = 1920, H = 1080;
  const WHITE = [255, 255, 255, 1], INK = [26, 28, 44, 1];
  const path = (d, fill, more) => Object.assign({ t: 'path', d, fill }, more || {});
  const stroke = (d, color, w, more) => ({ t: 'path', d, stroke: Object.assign({ paint: color, w }, more || {}) });
  const text = (s, x, y, size, fill, more) => Object.assign({ t: 'text', s, x, y, size, fill, font: 'bold' }, more || {});
  const label = (s, x, y, c) => text(s, x, y, 22, c || [90, 96, 120, 1], { font: 'regular' });

  // ① 字
  function sText() {
    const it = [];
    it.push(path(P.rect(0, 0, W, 430), hex('#1b2340')));
    it.push(text('まあまあな雑学チャンネル', 80, 190, 120, WHITE));
    it.push(text('洗濯板の道はなぜできるのか？', 80, 290, 64, hex('#ffd166')));
    it.push(text('人工の土地、台湾の9割は西側。ABC xyz 0123456789', 80, 370, 44, hex('#9ad1ff'), { font: 'regular' }));
    let y = 490;
    for (const s of [48, 36, 28, 20, 16, 12]) {
      it.push(text('字のふちと詰め方を見る 「下見」と「書き出し」 Wave Type 0123', 80, y, s, INK));
      y += s * 1.3 + 4;
      it.push(text('字のふちと詰め方を見る 「下見」と「書き出し」 Wave Type 0123', 80.5, y + 0.5, s * 0.75, INK, { font: 'regular' }));
      y += s * 1.1 + 4;
    }
    it.push(path(P.rect(0, 860, W, 220), hex('#ef476f')));
    it.push(text('同じ絵になるか', 960, 950, 72, WHITE, { align: 'center' }));
    it.push(text('同じ絵になるか', 1840, 1040, 48, [255, 255, 255, 0.6], { align: 'right' }));
    it.push(text('まあまあな雑学', 120, 1000, 60, hex('#1b2340'), { xf: X.at(120, 1000, -8) }));
    it.push(text('チャンネル', 1560, 640, 90, hex('#06d6a0', 0.85), { xf: X.at(1500, 760, 12, 1.3) }));
    return { w: W, h: H, bg: [246, 241, 231], items: it };
  }

  // ② ふち（細い形・斜めの線・小さな円）
  function sEdges() {
    const it = [];
    // 細い長方形：幅 0.5〜3、置く位置を少しずつずらす
    let x = 60;
    for (const w of [0.5, 1, 1.5, 2, 3]) for (const off of [0, 0.25, 0.5]) {
      it.push(path(P.rect(x + off, 60, w, 300), INK)); x += 24;
    }
    for (let i = 0; i < 12; i++) it.push(path(P.rect(460, 60 + i * 24 + i * 0.1, 300, 0.5 + i * 0.25), INK));
    // 斜めの線の扇（細い四角形）
    for (let i = 0; i < 36; i++) {
      const a = i * 2.5;
      it.push(path(P.rect(0, -0.75, 420, 1.5), hex('#1b2340'), { xf: X.mul(X.tr(820, 380), X.rot(-a)) }));
    }
    for (let i = 0; i < 18; i++) {
      it.push(path(P.rect(0, -3, 380, 6), hex(i % 2 ? '#ef476f' : '#118ab2'), { xf: X.mul(X.tr(1320, 380), X.rot(-i * 5)) }));
    }
    // 小さな円
    x = 60;
    for (const r of [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24]) {
      for (let j = 0; j < 4; j++) it.push(path(P.circle(x + j * 0.25, 440 + j * 60 + j * 0.25, r), hex('#073b4c')));
      x += Math.max(26, r * 2 + 18);
    }
    // 細い三角（針）と星
    for (let i = 0; i < 10; i++) it.push(path(P.poly([[60 + i * 44, 1020], [64 + i * 44 + i * 0.4, 1020], [300 + i * 30, 720]]), hex('#ef476f')));
    for (let i = 0; i < 6; i++) it.push(path(P.star(680 + i * 170, 870, 70, 10 + i * 5, 5 + i, i * 0.2), hex(['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#8338ec', '#fb5607'][i])));
    // 回した四角・重なる丸（となり合う形のすき間）
    for (let i = 0; i < 8; i++) it.push(path(P.rect(-50, -50, 100, 100), hex('#118ab2'), { xf: X.mul(X.tr(700 + i * 150, 600), X.rot(i * 6.5)) }));
    // となり合う 2色（すき間が見えないか）
    for (let i = 0; i < 20; i++) {
      it.push(path(P.poly([[1700, 450 + i * 30], [1880, 460 + i * 30], [1880, 490 + i * 30], [1700, 480 + i * 30]]), hex(i % 2 ? '#ffd166' : '#ef476f')));
    }
    // 輪
    for (let r = 10; r < 130; r += 9) it.push(stroke(P.circle(1560, 880, r), INK, 1 + (r % 2)));
    return { w: W, h: H, bg: [246, 241, 231], items: it };
  }

  // ③ ぼかし
  function sBlur() {
    const it = [];
    it.push(path(P.rect(0, 0, W, H), { lin: [0, 0, 0, H], stops: [[0, hex('#141a33')], [1, hex('#2b2f5a')]] }));
    let x = 130;
    for (const s of [1, 2, 4, 8, 16, 32, 64]) {
      it.push(path(P.circle(x, 170, 90), hex('#ffd166'), { blur: s }));
      it.push(path(P.rrect(x - 90, 320, 180, 120, 24), hex('#ef476f'), { blur: s }));
      it.push(label('σ ' + s, x - 24, 490, [200, 205, 230, 1]));
      x += 270;
    }
    // 重ねた物をまとめてぼかす（層）
    it.push({ t: 'group', blur: 12, items: [
      path(P.circle(220, 720, 120), hex('#06d6a0')), path(P.circle(340, 760, 100), hex('#118ab2')),
      path(P.star(280, 720, 90, 40, 5, 0), WHITE)] });
    // グラデーションの形をぼかす
    it.push(path(P.rrect(520, 600, 380, 260, 40), { lin: [520, 600, 900, 860], stops: [[0, hex('#ef476f')], [1, hex('#ffd166')]] }, { blur: 20 }));
    // 拡大の中のぼかし（太らないこと）
    it.push(path(P.circle(0, 0, 45), hex('#9ad1ff'), { blur: 8, xf: X.mul(X.tr(1100, 730), X.sc(2)) }));
    it.push(path(P.circle(1340, 730, 90), hex('#9ad1ff'), { blur: 8 }));
    // 光（加算＋ぼかし）
    it.push(path(P.circle(1650, 730, 110), hex('#ffb347'), { blur: 40, blend: 'add' }));
    it.push(path(P.circle(1650, 730, 60), hex('#fff3c4'), { blur: 10, blend: 'add' }));
    // 半透明のぼかし・線のぼかし・大きなぼかし
    it.push(path(P.circle(960, 980, 60), [255, 255, 255, 0.5], { blur: 6 }));
    it.push(Object.assign(stroke([['M', 80, 980], ['C', 300, 880, 500, 1080, 760, 960]], hex('#06d6a0'), 10, { cap: 'round' }), { blur: 5 }));
    it.push(path(P.ellipse(1500, 1000, 360, 60), [0, 0, 0, 0.6], { blur: 30 }));
    return { w: W, h: H, bg: [20, 26, 51], items: it };
  }

  // ④ 合成とマスク
  function sBlend() {
    const it = [];
    const cols = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#8338ec', '#f6f1e7', '#1b2340', '#808080'];
    cols.forEach((c, i) => it.push(path(P.rect(i * 240, 0, 240, 620), hex(c))));
    it.push(path(P.rect(0, 0, W, 620), { lin: [0, 0, 0, 620], stops: [[0, [255, 255, 255, 0.35]], [1, [0, 0, 0, 0.35]]] }));
    const modes = ['normal', 'multiply', 'screen', 'add', 'overlay'];
    modes.forEach((m, i) => {
      const y = 70 + i * 115;
      it.push(path(P.rrect(40, y - 40, 1840, 80, 40), hex('#ff9f1c', 0.8), { blend: m }));
      it.push(path(P.circle(300 + i * 320, y, 54), { rad: [300 + i * 320, y, 54], stops: [[0, hex('#ffffff')], [1, hex('#3a86ff')]] }, { blend: m }));
      it.push(text(m, 60, y + 10, 30, WHITE));
    });
    // 層ごとの合成（まとめてから乗算・スクリーン）
    it.push({ t: 'group', blend: 'multiply', items: [path(P.circle(1500, 250, 130), hex('#ffd166')), path(P.circle(1620, 330, 130), hex('#ef476f'))] });
    it.push({ t: 'group', blend: 'screen', op: 0.8, items: [path(P.circle(1500, 470, 90), hex('#118ab2')), path(P.circle(1600, 500, 90), hex('#06d6a0'))] });
    // 切り抜き：丸の中にしま模様
    const stripes = [];
    for (let i = -10; i < 30; i++) stripes.push(path(P.poly([[i * 40, 640], [i * 40 + 20, 640], [i * 40 + 220, 1080], [i * 40 + 200, 1080]]), hex(i % 2 ? '#ef476f' : '#118ab2')));
    it.push({ t: 'group', clip: P.circle(240, 850, 190), items: [path(P.rect(0, 640, 500, 440), hex('#ffd166'))].concat(stripes) });
    it.push({ t: 'group', clip: P.star(660, 850, 200, 90, 6, 0.1), items: [path(P.rect(400, 640, 520, 440), { lin: [460, 0, 860, 0], stops: [[0, hex('#8338ec')], [1, hex('#06d6a0')]] })] });
    // マスク：グラデーションの透明で消していく
    it.push({ t: 'group', items: [path(P.rect(920, 660, 460, 380), hex('#1b2340'))].concat(stripes.map(s => Object.assign({}, s, { xf: X.tr(900, 0) }))),
      clip: P.rect(920, 660, 460, 380),
      mask: [path(P.rect(920, 660, 460, 380), { lin: [920, 0, 1380, 0], stops: [[0, [0, 0, 0, 1]], [1, [0, 0, 0, 0]]] })] });
    // マスク：丸いやわらかいふち
    it.push({ t: 'group', items: [path(P.rect(1420, 660, 460, 380), { lin: [1420, 660, 1880, 1040], stops: [[0, hex('#ef476f')], [0.5, hex('#ffd166')], [1, hex('#06d6a0')]] })],
      mask: [path(P.circle(1650, 850, 200), { rad: [1650, 850, 200], stops: [[0, [0, 0, 0, 1]], [0.6, [0, 0, 0, 1]], [1, [0, 0, 0, 0]]] })] });
    // 層の透明度（重なりが濃くならないこと）と、1つずつの透明度
    it.push({ t: 'group', op: 0.5, items: [path(P.circle(1240, 250, 90), hex('#1b2340')), path(P.circle(1320, 250, 90), hex('#1b2340'))] });
    it.push(path(P.circle(1240, 470, 90), hex('#1b2340'), { op: 0.5 }));
    it.push(path(P.circle(1320, 470, 90), hex('#1b2340'), { op: 0.5 }));
    return { w: W, h: H, bg: [246, 241, 231], items: it };
  }

  // ⑤ グラデーション（ゆるい変化で色の帯が出やすい物を含む）
  function sGrad() {
    const it = [];
    // ゆるい変化：1920 画素で明るさが 10 段ほどしか変わらない
    it.push(path(P.rect(0, 0, W, 200), { lin: [0, 0, W, 0], stops: [[0, hex('#18223f')], [1, hex('#222e52')]] }));
    it.push(path(P.rect(0, 200, W, 200), { lin: [0, 200, 0, 400], stops: [[0, hex('#2a1f4a')], [1, hex('#1c1634')]] }));
    it.push(path(P.rect(0, 400, 960, 300), { rad: [480, 550, 700], stops: [[0, hex('#2f3b6b')], [1, hex('#141a33')]] }));
    it.push(path(P.rect(960, 400, 960, 300), { lin: [960, 400, 1920, 700], stops: [[0, hex('#f6efe0')], [1, hex('#efe4d0')]] }));
    // 多色・急な変化
    it.push(path(P.rect(0, 700, W, 90), { lin: [0, 0, W, 0], stops: [[0, hex('#ef476f')], [0.25, hex('#ffd166')], [0.5, hex('#06d6a0')], [0.75, hex('#118ab2')], [1, hex('#8338ec')]] }));
    it.push(path(P.rect(0, 790, W, 60), { lin: [0, 0, W, 0], stops: [[0, hex('#000000')], [1, hex('#ffffff')]] }));
    // 透明へのグラデーション（色つきの下地の上）
    it.push(path(P.rect(0, 850, W, 230), hex('#118ab2')));
    it.push(path(P.rect(0, 850, 640, 230), { lin: [0, 0, 640, 0], stops: [[0, hex('#ffd166', 1)], [1, hex('#ffd166', 0)]] }));
    it.push(path(P.rect(640, 850, 640, 230), { lin: [640, 0, 1280, 0], stops: [[0, [255, 0, 0, 1]], [1, [0, 0, 255, 0]]] }));
    it.push(path(P.circle(1600, 965, 110), { rad: [1600, 965, 110], stops: [[0, [255, 255, 255, 1]], [0.5, [255, 255, 255, 0.5]], [1, [255, 255, 255, 0]]] }));
    // 線にグラデーション・位置が止めの外
    it.push(stroke([['M', 80, 300], ['C', 500, 100, 900, 500, 1840, 300]], { lin: [80, 0, 1840, 0], stops: [[0, hex('#ffd166')], [1, hex('#ef476f')]] }, 14, { cap: 'round' }));
    it.push(path(P.rrect(1300, 430, 520, 240, 30), { lin: [1500, 0, 1620, 0], stops: [[0, hex('#06d6a0')], [1, hex('#8338ec')]] }));
    return { w: W, h: H, bg: [20, 26, 51], items: it };
  }

  // ⑥ 画像の拡大縮小
  function sImage() {
    const it = [];
    const img = (src, x, y, w, h, q, more) => Object.assign({ t: 'image', src, x, y, w, h, q }, more || {});
    const qs = ['nearest', 'linear', 'mip'];
    qs.forEach((q, i) => {
      const y = 40 + i * 290;
      it.push(label(q, 20, y + 20, INK));
      it.push(img('pattern256', 120, y, 256, 256, q));        // 等倍
      it.push(img('pattern256', 400.5, y + 0.5, 256, 256, q)); // 半画素ずらす
      it.push(img('pattern256', 690, y, 128, 128, q));        // 1/2
      it.push(img('pattern256', 830, y, 85, 85, q));          // 1/3
      it.push(img('pattern256', 930, y, 26, 26, q));          // 1/10
      it.push(img('pattern256', 690, y + 140, 200, 110, q));  // 縦横で違う倍率
      it.push(img('face32', 990, y, 256, 256, q));            // 8倍
      it.push(img('soft512', 1270, y, 256, 256, q));          // 1/2（なめらかな絵）
      it.push(img('soft512', 1550, y, 340, 256, q));
    });
    it.push(img('pattern256', 0, 0, 200, 200, 'linear', { xf: X.mul(X.tr(200, 990), X.rot(-12)) }));
    it.push(img('face32', 0, 0, 96, 96, 'linear', { xf: X.mul(X.tr(520, 930), X.rot(20)), op: 0.7 }));
    it.push(img('soft512', 700, 910, 870, 160, 'linear'));
    it.push(img('face32', 1620, 920, 150, 150, 'mip'));
    it.push(img('face32', 1790, 940, 32, 32, 'linear'));
    it.push(img('face32', 1840, 940, 16, 16, 'mip'));
    return { w: W, h: H, bg: [246, 241, 231], items: it };
  }

  // ⑦ 線（細い・太い・端・角・曲線）
  function sStroke() {
    const it = [];
    let y = 50;
    for (const w of [0.25, 0.5, 1, 1.5, 2, 3, 4, 8, 16, 32]) {
      it.push(stroke(P.line(60, y, 500, y), INK, w));
      it.push(stroke(P.line(540, y - 10, 900, y + 14), INK, w));
      it.push(stroke([['M', 940, y + 12], ['C', 1040, y - 40, 1140, y + 60, 1260, y]], hex('#118ab2'), w));
      y += 26 + w;
    }
    // 端
    ['butt', 'round', 'square'].forEach((c, i) => {
      it.push(stroke(P.line(1360, 70 + i * 60, 1660, 70 + i * 60), hex('#ef476f'), 30, { cap: c }));
      it.push(stroke(P.line(1360, 70 + i * 60, 1660, 70 + i * 60), WHITE, 1));
      it.push(stroke(P.line(1720, 50 + i * 60, 1860, 90 + i * 60), hex('#1b2340'), 14, { cap: c }));
    });
    // 角
    ['miter', 'round', 'bevel'].forEach((j, i) => {
      const x = 80 + i * 620;
      it.push(stroke(P.poly([[x, 620], [x + 120, 440], [x + 200, 620], [x + 300, 440], [x + 330, 620], [x + 400, 440], [x + 410, 620], [x + 520, 520]], true), hex('#073b4c'), 22, { join: j }));
      it.push(stroke(P.poly([[x + 40, 760], [x + 240, 680], [x + 440, 760]]), hex('#8338ec'), 16, { join: j }));
    });
    // 角の限界
    [1, 2, 4, 10].forEach((m, i) => it.push(stroke(P.poly([[1300 + i * 150, 420], [1360 + i * 150, 250], [1420 + i * 150, 420]], true), hex('#fb5607'), 18, { join: 'miter', miter: m })));
    // 曲線：うずまき・S 字・輪
    const sp = [];
    for (let i = 0; i <= 300; i++) { const a = i * 0.12, r = 4 + i * 0.42; sp.push([220 + r * Math.cos(a), 930 + r * Math.sin(a)]); }
    it.push(stroke(P.poly(sp, true), INK, 2, { join: 'round', cap: 'round' }));
    for (let i = 0; i < 6; i++) it.push(stroke([['M', 460, 840 + i * 40], ['C', 700, 740 + i * 40, 760, 1060 - i * 10, 1000, 880 + i * 30]], hex(['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#8338ec', '#1b2340'][i]), 1 + i * 3, { cap: 'round' }));
    it.push(stroke(P.circle(1200, 930, 100), hex('#06d6a0'), 24));
    it.push(stroke(P.rrect(1360, 830, 220, 200, 50), hex('#118ab2'), 12));
    // 半透明の線が自分に重なる・塗り＋線
    it.push(stroke([['M', 1640, 840], ['L', 1860, 1020], ['L', 1860, 840], ['L', 1640, 1020]], [239, 71, 111, 0.5], 30, { join: 'round' }));
    it.push({ t: 'path', d: P.star(1760, 620, 110, 50, 5, 0), fill: hex('#ffd166'), stroke: { paint: hex('#1b2340'), w: 8, join: 'round' } });
    return { w: W, h: H, bg: [246, 241, 231], items: it };
  }

  // ⑧ 絵の質：kurzgesagt 風の小さな場面（空のグラデーション・丸い形の重なり・光の線・控えめなぼかし）
  function hill(y0, amp, seed, color, t) {
    const r = rng(seed), d = [['M', -40, H + 20], ['L', -40, y0]];
    let x = -40, py = y0;
    while (x < W + 40) {
      const dx = 220 + r() * 260, ny = y0 + (r() - 0.5) * amp;
      d.push(['C', x + dx * 0.4, py - amp * 0.5 * r(), x + dx * 0.6, ny - amp * 0.5 * r(), x + dx, ny]);
      x += dx; py = ny;
    }
    d.push(['L', W + 40, H + 20], ['Z']);
    return path(d, color);
  }
  function cloud(x, y, s, col) {
    const c = (dx, dy, r) => path(P.circle(x + dx * s, y + dy * s, r * s), col);
    return [c(0, 0, 60), c(70, -22, 78), c(150, -4, 62), c(215, 14, 44), c(-55, 16, 40), path(P.rrect(x - 95 * s, y + 4 * s, 355 * s, 54 * s, 27 * s), col)];
  }
  function tree(x, y, s, c1, c2) {
    return { t: 'group', xf: X.mul(X.tr(x, y), X.sc(s)), items: [
      path(P.rrect(-7, -70, 14, 80, 6), hex('#2a1b3d')),
      path(P.circle(0, -120, 62), c1), path(P.circle(-38, -88, 44), c1), path(P.circle(40, -90, 46), c1),
      path(P.circle(-14, -136, 40), c2, { op: 0.55 }), path(P.circle(22, -112, 22), c2, { op: 0.35 })] };
  }
  function sKz(t) {
    t = t || 0;
    const it = [];
    it.push(path(P.rect(0, 0, W, H), { lin: [0, 0, 0, H], stops: [[0, hex('#1a1446')], [0.35, hex('#4b2a7a')], [0.62, hex('#c8507a')], [0.82, hex('#ff9e5e')], [1, hex('#ffd58a')]] }));
    const r = rng(11);
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = r() * 520, s = 0.6 + r() * 2.2;
      it.push(path(P.circle(x, y, s), [255, 244, 220, 0.35 + 0.6 * r() * (1 - y / 620)]));
    }
    const sx = 1320, sy = 640 - 20 * Math.sin(t);
    it.push(path(P.circle(sx, sy, 420), { rad: [sx, sy, 420], stops: [[0, [255, 214, 130, 0.55]], [0.4, [255, 150, 100, 0.22]], [1, [255, 120, 110, 0]]] }, { blend: 'add' }));
    // 光の線（扇。外へ消えていく・加算）
    const rays = [];
    for (let i = 0; i < 9; i++) {
      const a = (-170 + i * 20 + 3 * Math.sin(t + i)) * Math.PI / 180, wd = 0.05 + (i % 3) * 0.02, L = 1500;
      rays.push(path(P.poly([[sx, sy], [sx + L * Math.cos(a - wd), sy + L * Math.sin(a - wd)], [sx + L * Math.cos(a + wd), sy + L * Math.sin(a + wd)]]), [255, 226, 160, 1]));
    }
    it.push({ t: 'group', blend: 'add', op: 0.16, blur: 6, items: rays,
      mask: [path(P.circle(sx, sy, 1100), { rad: [sx, sy, 1100], stops: [[0, [0, 0, 0, 1]], [0.25, [0, 0, 0, 0.9]], [1, [0, 0, 0, 0]]] })] });
    it.push(path(P.circle(sx, sy, 150), hex('#ffb86b'), { blur: 28, blend: 'add', op: 0.8 }));
    it.push(path(P.circle(sx, sy, 118), { lin: [sx, sy - 118, sx, sy + 118], stops: [[0, hex('#fff1c2')], [1, hex('#ffc46b')]] }));
    // 雲（丸の重なり。層でまとめて半透明）
    it.push({ t: 'group', op: 0.9, items: cloud(260 + 30 * Math.sin(t * 0.5), 300, 1.25, hex('#e9a3c0')) });
    it.push({ t: 'group', op: 0.75, items: cloud(980 - 20 * Math.sin(t * 0.4), 210, 0.8, hex('#b678b8')) });
    it.push({ t: 'group', op: 0.85, items: cloud(1580 + 16 * Math.sin(t * 0.6), 380, 1.0, hex('#ffb89a')) });
    // 遠い山 → 手前の丘（重ね）。遠いほど空の色に寄せる
    it.push(hill(700, 120, 3, hex('#8a3f86')));
    it.push(path(P.rect(0, 560, W, 300), { lin: [0, 560, 0, 860], stops: [[0, [255, 160, 120, 0]], [1, [255, 170, 120, 0.28]]] }));
    it.push(hill(790, 110, 5, hex('#5d2f7c')));
    for (let i = 0; i < 9; i++) it.push(tree(120 + i * 215 + (i % 2) * 40, 838 + (i % 3) * 14, 0.55 + (i % 3) * 0.08, hex('#3f2468'), hex('#7b3f92')));
    it.push(hill(880, 90, 8, hex('#3a1f63')));
    // 主役：丸い生き物（体・影・ハイライト・輪郭）
    const bx = 620, by = 800 + 8 * Math.sin(t * 2);
    it.push(path(P.ellipse(bx, 905, 150, 20), [20, 8, 50, 0.45], { blur: 8 }));
    it.push({ t: 'group', items: [
      path(P.ellipse(bx, by, 150, 128), { lin: [bx, by - 128, bx, by + 128], stops: [[0, hex('#5ee0c8')], [1, hex('#1e9aa8')]] }),
      { t: 'group', clip: P.ellipse(bx, by, 150, 128), items: [
        path(P.ellipse(bx + 50, by + 60, 170, 120), [10, 60, 110, 0.35], { blend: 'multiply' }),
        path(P.ellipse(bx - 60, by - 70, 90, 50), [255, 255, 255, 0.28]),
        path(P.ellipse(bx, by + 46, 92, 60), hex('#c9fff0', 0.9))] },
      stroke(P.ellipse(bx, by, 150, 128), hex('#12305a'), 7),
      path(P.circle(bx - 52, by - 26, 21), WHITE), path(P.circle(bx + 52, by - 26, 21), WHITE),
      path(P.circle(bx - 48, by - 24, 11), hex('#12305a')), path(P.circle(bx + 56, by - 24, 11), hex('#12305a')),
      path(P.circle(bx - 52, by - 29, 4), WHITE), path(P.circle(bx + 52, by - 29, 4), WHITE),
      stroke([['M', bx - 22, by + 14], ['Q', bx, by + 34, bx + 22, by + 14]], hex('#12305a'), 6, { cap: 'round' }),
      path(P.ellipse(bx - 148, by + 24, 30, 16), hex('#1e9aa8'), { xf: X.at(bx - 148, by + 24, -24 + 10 * Math.sin(t * 3)) }),
      path(P.ellipse(bx + 148, by + 24, 30, 16), hex('#1e9aa8'), { xf: X.at(bx + 148, by + 24, 24 - 10 * Math.sin(t * 3)) }),
    ] });
    // 手前（暗い・少しぼかす）＋ちりの光
    it.push(Object.assign(hill(1010, 60, 13, hex('#1d1040')), { blur: 3 }));
    it.push(Object.assign(tree(1720, 1090, 2.3, hex('#1d1040'), hex('#2a1758')), { blur: 5 }));
    const r2 = rng(29);
    for (let i = 0; i < 26; i++) {
      const x = r2() * W, y = 420 + r2() * 560, s = 2 + r2() * 5;
      it.push(path(P.circle(x + 12 * Math.sin(t + i), y - 10 * Math.cos(t * 0.7 + i), s), [255, 232, 170, 0.55], { blur: 1 + (i % 4), blend: 'add' }));
    }
    // 周りを落とす（乗算）
    it.push(path(P.rect(0, 0, W, H), { rad: [960, 560, 1250], stops: [[0, [255, 255, 255, 1]], [0.55, [255, 255, 255, 1]], [1, [150, 120, 190, 1]]] }, { blend: 'multiply' }));
    return { w: W, h: H, bg: [26, 20, 70], items: it };
  }

  // ⑨ 速さ：重い場面（部品 200・ぼかし・合成・動く）
  function sHeavy(t) {
    t = t || 0;
    const it = [], r = rng(101);
    it.push(path(P.rect(0, 0, W, H), { lin: [0, 0, W, H], stops: [[0, hex('#101638')], [1, hex('#3a1f63')]] }));
    const cols = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#8338ec', '#fb5607', '#9ad1ff'];
    for (let i = 0; i < 200; i++) {
      const bx = r() * W, by = r() * H, rad = 22 + r() * 60, ph = r() * 6.283, sp = 0.5 + r() * 1.5, c = hex(cols[i % cols.length]);
      const x = bx + 90 * Math.sin(t * sp + ph), y = by + 60 * Math.cos(t * sp * 0.8 + ph);
      const items = [
        path(P.circle(0, 0, rad), { lin: [0, -rad, 0, rad], stops: [[0, c], [1, [c[0] * 0.55 | 0, c[1] * 0.55 | 0, c[2] * 0.6 | 0, 1]]] }),
        path(P.ellipse(-rad * 0.3, -rad * 0.38, rad * 0.42, rad * 0.24), [255, 255, 255, 0.3]),
        stroke(P.circle(0, 0, rad), [16, 22, 56, 1], 4),
        path(P.star(0, rad * 0.15, rad * 0.45, rad * 0.2, 5, t * sp), [255, 255, 255, 0.85]),
      ];
      const part = { t: 'group', xf: X.mul(X.tr(x, y), X.rot((t * 40 * sp) % 360)), items };
      if (i % 10 === 0) part.blur = 3 + (i % 30) / 5;               // 20 個：ぼかし
      else if (i % 10 === 1) part.blend = 'screen';                // 20 個：スクリーン
      else if (i % 10 === 2) part.blend = 'multiply';              // 20 個：乗算
      else if (i % 10 === 3) { part.blend = 'add'; part.op = 0.6; } // 20 個：加算＋半透明
      else if (i % 10 === 4) part.op = 0.7;                        // 20 個：層の半透明
      it.push(part);
    }
    it.push(text('部品 200', 60, 1030, 48, [255, 255, 255, 0.8]));
    return { w: W, h: H, bg: [16, 22, 56], items: it };
  }

  g.SCENES = [
    { id: 'text', name: '① 字', make: sText },
    { id: 'edges', name: '② ふち', make: sEdges },
    { id: 'blur', name: '③ ぼかし', make: sBlur },
    { id: 'blend', name: '④ 合成とマスク', make: sBlend },
    { id: 'grad', name: '⑤ グラデーション', make: sGrad },
    { id: 'image', name: '⑥ 画像の拡大縮小', make: sImage },
    { id: 'stroke', name: '⑦ 線', make: sStroke },
    { id: 'kz', name: '⑧ 絵の質（小さな場面）', make: sKz },
    { id: 'heavy', name: '⑨ 速さ（部品200）', make: sHeavy },
  ];
})(window);
