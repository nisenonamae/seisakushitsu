/* lab/hyoka app.js — 人の目での評価の画面（1ページ）。
   守ること（lab/README.md）：保存は localStorage の「lab:hyoka:」で始まる名前だけ／gh_ で始まる項目に触らない／通信は自分のフォルダの中の画像だけ。
   版の名前・作り方は、評価が全部終わって書き出すまで、画面に出さない（対応表は manifest.js と、この下の表にある）。 */
(function () {
  'use strict';
  const G = window.P4G, MAN = window.HYOKA_MANIFEST;
  const PAGE_VER = 'hyoka-1（2026-11-29）';
  const LS = 'lab:hyoka:state:v1';
  const CROP = MAN.crop, BIG = MAN.bigSize, DOCW = MAN.docSize[0], DOCH = MAN.docSize[1];
  const V = {}; MAN.versions.forEach(v => { V[v.key] = v; });
  const HUMAN = { P4_H: { which: 'h', label: 'P4 の人のみ' }, P4_S: { which: 's', label: 'P4 の AI の下組み＋人' } };
  const labelOf = k => (V[k] ? V[k].label : HUMAN[k].label);

  /* 項目（PLAN.md のとおり） */
  const CRIT = [
    { id: 'miryoku', label: '魅力', sub: 'キャラクターとして' },
    { id: 'kage', label: '影絵', sub: 'シルエットの良さ（絵の下の「影絵」を押して見る）' },
    { id: 'kao', label: '顔', sub: '表情と個性' },
    { id: 'tsuriai', label: '体のつり合い', sub: '' },
    { id: 'kansetsu', label: '関節の自然さ', sub: '' },
    { id: 'ugoki', label: '動かしたときの自然さ', sub: '動きがある絵だけ', motion: true },
    { id: 'zen_still', label: '全体', sub: '止まった絵として' },
    { id: 'zen_move', label: '全体', sub: '動かす素材として（動きがある絵だけ）', motion: true }
  ];
  const CR = {}; CRIT.forEach(c => { CR[c.id] = c; });
  const PAIR_CRIT = { still: ['miryoku', 'kage', 'kao', 'tsuriai', 'kansetsu', 'zen_still'], motion: ['kansetsu', 'ugoki', 'zen_move'] };
  /* 2つを並べる組（PLAN.md のとおり。それぞれ左右を入れかえて2回） */
  const PAIRS = [
    { n: 1, a: 'E6_L2', b: 'E6_eye2', mode: 'still' },
    { n: 2, a: 'E6_L2', b: 'E6_head121', mode: 'still' },
    { n: 3, a: 'E6_legShort', b: 'E6_legLong', mode: 'still' },
    { n: 4, a: 'E6_L2', b: 'E6_zou', mode: 'still' },
    { n: 5, a: 'E5_A', b: 'E5_E', mode: 'motion' },
    { n: 6, a: 'E5_A', b: 'E5_F', mode: 'motion' },
    { n: 7, a: 'E5_E', b: 'P4_AI', mode: 'motion' },
    { n: 8, a: 'E5_E', b: 'P4_AI', mode: 'still' },
    { n: 9, a: 'P4_AI', b: 'P4_H', mode: 'still', need: 'h' },
    { n: 10, a: 'P4_AI', b: 'P4_S', mode: 'still', need: 's' }
  ];
  const REPEATS = ['E6_L2', 'E5_A'];           /* 同じ絵をもう1回（知らせない） */
  const MODE_NAME = { still: '止まった絵', sil: '影絵', walk: '歩く', head: '首を振る' };
  const SCALE_TEXT = '5＝そのまま動画に使える／4＝少し直せば使える／3＝直せば使える／2＝大きく直す／1＝使えない';

  const $ = (q, r) => (r || document).querySelector(q), $$ = (q, r) => Array.from((r || document).querySelectorAll(q));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const main = $('#main');
  let st = null, P = null, tShown = 0, toastT = 0;

  /* ---- 乱数（種から。mulberry32） ---- */
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function shuffleUntil(a, r, ok) { let s = shuffle(a, r); for (let n = 0; n < 2000 && !ok(s); n++) s = shuffle(a, r); return s; }
  const ok1 = s => REPEATS.every(k => { const i = s.findIndex(x => x.key === k && !x.rep), j = s.findIndex(x => x.key === k && x.rep); return i < 0 || j < 0 || Math.abs(i - j) >= 5; });
  const ok2 = s => s.every((x, i) => s.every((y, j) => i === j || x.pair !== y.pair || Math.abs(i - j) >= 3));

  function newState(seed) {
    const r = rng(seed);
    const items = MAN.versions.map(v => ({ key: v.key, rep: false })).concat(REPEATS.map(k => ({ key: k, rep: true })));
    const o1 = shuffleUntil(items, r, ok1);
    let pl = []; PAIRS.filter(p => !p.need).forEach(p => { pl.push({ pair: p.n }); pl.push({ pair: p.n }); });
    const o2 = shuffleUntil(pl, r, ok2);
    const nums = shuffle(Array.from({ length: 90 }, (_, i) => i + 10), r);
    const t1 = o1.map((x, i) => ({ id: 'a' + (i + 1), no: nums.pop(), key: x.key, rep: x.rep, scores: {}, ok: null, comment: '', ms: 0, viewed: {}, doneAt: null }));
    const seen = {}, t2 = o2.map((x, i) => {
      const p = PAIRS.find(q => q.n === x.pair), first = !(x.pair in seen); if (first) seen[x.pair] = r() < 0.5;
      const flip = first ? seen[x.pair] : !seen[x.pair];
      return { id: 'b' + (i + 1), no: nums.pop(), pair: p.n, pres: first ? 1 : 2, mode: p.mode, left: flip ? p.b : p.a, right: flip ? p.a : p.b, picks: {}, comment: '', ms: 0, viewed: {}, doneAt: null };
    });
    return { v: 1, page: PAGE_VER, seed: seed, startedAt: new Date().toISOString(), screen: 'intro', cur: { part: 1, i: 0 }, midSeen: false, t1: t1, t2: t2, nums: nums, fps: 16, p4: { h: null, s: null, file: null, at: null, added: [] }, exportedAt: null, exportedComplete: false };
  }

  /* ---- 保存（lab:hyoka: だけ） ---- */
  function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { toast('この端末の中に残せませんでした（空きが足りないかもしれません）。このまま続けて、最後に書き出してください'); } }
  function load() { try { const s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s && s.v === 1 && Array.isArray(s.t1) && Array.isArray(s.t2)) return s; } catch (e) { /* こわれていたら新しく始める */ } return null; }
  function freshSeed() { const a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0]; }

  /* ---- 進み具合 ---- */
  const hasMotion = key => !!(V[key] && (V[key].frames.walk || V[key].frames.head));
  const critFor1 = t => CRIT.filter(c => !c.motion || hasMotion(t.key));
  const done1 = t => critFor1(t).every(c => t.scores[c.id] >= 1) && (t.ok === true || t.ok === false);
  const done2 = t => PAIR_CRIT[t.mode].every(c => t.picks[c]);
  const isDone = (part, t) => (part === 1 ? done1(t) : done2(t));
  const list = part => (part === 1 ? st.t1 : st.t2);
  function counts() { const d1 = st.t1.filter(done1).length, d2 = st.t2.filter(done2).length; return { d1, d2, n1: st.t1.length, n2: st.t2.length, left: st.t1.length + st.t2.length - d1 - d2 }; }
  function firstUndone() { let i = st.t1.findIndex(t => !done1(t)); if (i >= 0) return { part: 1, i }; i = st.t2.findIndex(t => !done2(t)); if (i >= 0) return { part: 2, i }; return null; }
  function header() {
    const c = counts(), el = $('#prog');
    if (st.screen === 'intro') el.textContent = '';
    else if (st.screen === 'trial') el.textContent = (st.cur.part === 1 ? '第1部（1つずつ） ' : '第2部（2つを並べる） ') + (st.cur.i + 1) + ' / ' + list(st.cur.part).length + '　・　全部で、あと ' + c.left + ' 個';
    else el.textContent = '第1部 ' + c.d1 + ' / ' + c.n1 + '　第2部 ' + c.d2 + ' / ' + c.n2 + '　・　あと ' + c.left + ' 個';
    $('#barIn').style.width = (100 * (c.d1 + c.d2) / Math.max(1, c.n1 + c.n2)) + '%';
    $('#bList').hidden = st.screen === 'intro';
  }
  function toast(m) { const e = $('#toast'); e.textContent = m; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { e.hidden = true; }, 4200); }

  /* ---- 絵を出す（あらかじめ作った画像／P4 で描いた絵はここで描く） ---- */
  const cache = new Map(), humanCache = {};
  function img(url) {
    if (!cache.has(url)) cache.set(url, new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { cache.delete(url); rej(new Error(url)); }; im.src = url; }));
    return cache.get(url);
  }
  const pad = n => (n < 10 ? '0' : '') + n;
  function silDoc(doc) {                       /* 影絵の決まりは lab/e5/tools/page.js と同じ：地面の影を外し、残りを全部 DARK で */
    const DARK = '#2F2734', SH = '#bcd3a2', d = JSON.parse(JSON.stringify(doc)); d.bg = '#ffffff';
    d.nodes = d.nodes.filter(n => n.kind === 'group' || !((n.fill && String(n.fill).toLowerCase() === SH) || /地面の影/.test(n.name || '')));
    for (const n of d.nodes) { if (n.kind === 'group' || !n.geo) continue; if (n.fill) n.fill = DARK; if (n.stroke) n.stroke.c = DARK; }
    return d;
  }
  function drawDoc(doc, sil) {                 /* P4 の絵：lab/p4/geom.js の写し（vendor/geom.js）の G.draw で、作り置きの画像と同じ切り出しに描く */
    const c = document.createElement('canvas'); c.width = BIG[0]; c.height = BIG[1];
    const x = c.getContext('2d'), d = sil ? silDoc(doc) : doc, k = BIG[0] / (CROP[2] - CROP[0]);
    x.fillStyle = d.bg || '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.scale(k, k); x.translate(-CROP[0], -CROP[1]);
    const f = Math.min(DOCW / (doc.w || DOCW), DOCH / (doc.h || DOCH)); if (Math.abs(f - 1) > 1e-6) x.scale(f, f);
    G.draw(x, d, { noBg: true });
    return c;
  }
  function sources(key, mode) {
    if (HUMAN[key]) {
      const doc = st.p4[HUMAN[key].which], id = key + ':' + mode;
      if (!humanCache[id]) humanCache[id] = [drawDoc(doc, mode === 'sil')];
      return Promise.resolve(humanCache[id]);
    }
    const v = V[key], b = 'img/' + v.code + '/';
    if (mode === 'still') return img(b + 's.webp').then(i => [i]);
    if (mode === 'sil') return img(b + 'k.webp').then(i => [i]);
    const n = v.frames[mode] || 0, a = []; for (let i = 0; i < n; i++) a.push(img(b + mode[0] + pad(i) + '.webp'));
    return Promise.all(a);
  }
  function modesOf(t, part) {
    if (part === 2) return t.mode === 'motion' ? ['walk', 'head'].filter(m => V[t.left].frames[m] && V[t.right].frames[m]) : ['still', 'sil'];
    const m = ['still', 'sil']; if (V[t.key]) { if (V[t.key].frames.walk) m.push('walk'); if (V[t.key].frames.head) m.push('head'); } return m;
  }
  function preload(part, i) {                  /* 次の絵を先に読んでおく（待たされないように） */
    const t = list(part)[i]; if (!t) return;
    const keys = part === 1 ? [t.key] : [t.left, t.right];
    modesOf(t, part).forEach(m => keys.forEach(k => { sources(k, m).catch(() => { }); }));
  }

  function paintSide(s) {
    const c = s.canvas, d = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight; if (!w || !s.frames) return;
    if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    const x = c.getContext('2d'), src = s.frames[P.frame % s.frames.length], sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    const k = (c.width / sw) * P.view.z;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#c9c9cf'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, c.width / 2 - P.view.cx * sw * k, c.height / 2 - P.view.cy * sh * k, sw * k, sh * k);
  }
  function paint() {
    if (!P) return; P.sides.forEach(paintSide);
    const n = frameCount(), fr = $('#cFr'); if (fr) fr.textContent = n > 1 ? pad(P.frame % n + 1) + ' / ' + n : '';
  }
  const isMotion = () => P && (P.mode === 'walk' || P.mode === 'head');
  const ready = () => P && P.sides.every(s => s.frames);
  const frameCount = () => (ready() ? Math.min.apply(null, P.sides.map(s => s.frames.length)) : 1);
  function clampView() { const v = P.view; v.z = Math.max(1, Math.min(8, v.z)); const m = 0.5 / v.z; v.cx = Math.max(m, Math.min(1 - m, v.cx)); v.cy = Math.max(m, Math.min(1 - m, v.cy)); }
  function setMode(m) {
    if (!P) return; const me = P; P.mode = m; P.frame = 0; P.last = 0; P.trial.viewed[m] = true;
    $$('#cMode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    const mo = isMotion(); $$('.mo').forEach(b => { b.disabled = !mo; });
    P.sides.forEach(s => {
      s.frames = null; s.load.hidden = false; s.load.textContent = '絵を読みこんでいます…';
      sources(s.key, m).then(a => { if (P !== me || P.mode !== m) return; s.frames = a; s.load.hidden = true; paint(); })
        .catch(() => { if (P !== me || P.mode !== m) return; s.load.textContent = '絵を読みこめませんでした。通信を確かめて、ページを読みこみ直してください（入れた点は残っています）'; });
    });
    playLabel(); paint();
  }
  function playLabel() { const b = $('#cPlay'); if (b) b.textContent = P.playing ? '止める' : '動かす'; }
  function step(d) { if (!isMotion() || !ready()) return; P.playing = false; playLabel(); const n = frameCount(); P.frame = ((P.frame % n) + d + n) % n; paint(); }
  function tick(ts) {
    if (P && P.playing && isMotion() && ready()) { if (!P.last) P.last = ts; const iv = 1000 / st.fps; if (ts - P.last >= iv) { const k = Math.min(3, Math.floor((ts - P.last) / iv)); P.frame = (P.frame + k) % frameCount(); P.last += k * iv; if (ts - P.last > iv * 3) P.last = ts; paint(); } }
    requestAnimationFrame(tick);
  }
  function bindCanvas(c) {
    let dr = null, gz = 1;
    const zoomAt = (e, nz) => { const r = c.getBoundingClientRect(), v = P.view, fx = (e.clientX - r.left) / r.width - 0.5, fy = (e.clientY - r.top) / r.height - 0.5, px = v.cx + fx / v.z, py = v.cy + fy / v.z; v.z = nz; clampView(); v.cx = px - fx / v.z; v.cy = py - fy / v.z; clampView(); paint(); };
    c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); dr = { x: e.clientX, y: e.clientY, cx: P.view.cx, cy: P.view.cy }; c.style.cursor = 'grabbing'; });
    c.addEventListener('pointermove', e => { if (!dr) return; const r = c.getBoundingClientRect(); P.view.cx = dr.cx - (e.clientX - dr.x) / r.width / P.view.z; P.view.cy = dr.cy - (e.clientY - dr.y) / r.height / P.view.z; clampView(); paint(); });
    const up = () => { dr = null; c.style.cursor = 'grab'; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('dblclick', e => { zoomAt(e, P.view.z > 1.01 ? 1 : 2.5); });
    c.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(e, P.view.z * Math.exp(-Math.max(-40, Math.min(40, e.deltaY)) * 0.012)); }
      else if (P.view.z > 1.01) { e.preventDefault(); const r = c.getBoundingClientRect(); P.view.cx += e.deltaX / r.width / P.view.z; P.view.cy += e.deltaY / r.height / P.view.z; clampView(); paint(); }
    }, { passive: false });
    c.addEventListener('gesturestart', e => { e.preventDefault(); gz = P.view.z; });
    c.addEventListener('gesturechange', e => { e.preventDefault(); P.view.z = gz * e.scale; clampView(); paint(); });
  }
  function ctlHtml(modes) {
    return '<div class="ctl"><span class="seg" id="cMode">' + modes.map(m => '<button data-m="' + m + '">' + MODE_NAME[m] + '</button>').join('') + '</span><span class="gap"></span>' +
      '<button id="cPlay" class="mo">止める</button><button id="cPrev" class="mo" title="1コマ戻す（,）">◀ コマ</button><button id="cNext" class="mo" title="1コマ進める（.）">コマ ▶</button>' +
      '<select id="cFps" class="mo" title="動きの速さ"><option value="12">ゆっくり（12 コマ/秒）</option><option value="16">ふつう（16 コマ/秒）</option><option value="24">速い（24 コマ/秒）</option></select><span class="fr" id="cFr"></span>' +
      '<span class="gap"></span><button id="cOut" title="縮める">−</button><button id="cIn" title="拡大">＋</button><button id="cFit">全体</button><span class="note">絵の上で2回続けて押す＝拡大／引く＝動かす</span></div>';
  }
  function bindCtl() {
    $('#cMode').onclick = e => { const b = e.target.closest('button'); if (b) { setMode(b.dataset.m); save(); } };
    $('#cPlay').onclick = () => { P.playing = !P.playing; P.last = 0; playLabel(); };
    $('#cPrev').onclick = () => step(-1); $('#cNext').onclick = () => step(1);
    $('#cFps').value = String(st.fps); $('#cFps').onchange = e => { st.fps = +e.target.value; P.last = 0; save(); };
    $('#cIn').onclick = () => { P.view.z *= 1.5; clampView(); paint(); };
    $('#cOut').onclick = () => { P.view.z /= 1.5; clampView(); paint(); };
    $('#cFit').onclick = () => { P.view = { z: 1, cx: 0.5, cy: 0.5 }; paint(); };
  }
  const stageHtml = i => '<div class="stage"><canvas data-s="' + i + '"></canvas><div class="load">絵を読みこんでいます…</div></div>';

  /* ---- かかった時間（画面が見えているあいだだけ数える） ---- */
  function flush() { if (st && st.screen === 'trial' && tShown) { const t = list(st.cur.part)[st.cur.i]; if (t) t.ms += Date.now() - tShown; } tShown = 0; }
  function startClock() { tShown = document.hidden ? 0 : Date.now(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { flush(); if (st) save(); } else if (st && st.screen === 'trial') startClock(); });
  window.addEventListener('pagehide', () => { flush(); if (st) save(); });

  /* ---- 画面 ---- */
  function go(screen, cur) { flush(); st.screen = screen; if (cur) st.cur = cur; save(); render(); }
  function render() {
    P = null; header();
    if (st.screen === 'intro') return intro();
    if (st.screen === 'mid') return mid();
    if (st.screen === 'end') return endScreen();
    const t = list(st.cur.part)[st.cur.i]; if (!t) { st.screen = firstUndone() ? 'trial' : 'end'; st.cur = firstUndone() || st.cur; return render(); }
    if (st.cur.part === 1) trial1(t); else trial2(t);
    startClock(); preload(st.cur.part, st.cur.i + 1);
  }
  function p4Box() {
    const p = st.p4, got = [p.h ? '人のみ' : null, p.s ? '下組み＋人' : null].filter(Boolean);
    return '<div class="p4box"><b>P4 で描いた絵を読みこむと、比べる組が2つ増えます。</b>' +
      '<div class="note">P4 の画面（曲線の画面）の「見比べる・評価する」→ いちばん下の「評価.json を書き出す」でできたファイルを、ここで選びます。まだ描いていなければ、読みこまずに進めて大丈夫です（あとからでも読みこめます）。</div>' +
      '<p style="margin:8px 0 0"><button id="bP4">P4 の「評価.json」を選ぶ</button>　' + (got.length ? '<b>読みこみ済み：' + got.join('・') + '</b>（1つずつ見る絵が ' + got.length + ' 個、並べる組が ' + got.length * 2 + ' 回 増えました）' : '<span class="note">まだ読みこんでいません</span>') + '</p></div>';
  }
  function bindP4() { const b = $('#bP4'); if (b) b.onclick = () => { $('#p4file').value = ''; $('#p4file').click(); }; }
  function intro() {
    const c = counts();
    main.innerHTML = '<div class="card"><h2>絵を見て、点を付けてください</h2>' +
      '<p>カバの絵を見て、点を付けます。<b>全部で 30〜40 分</b>のつもりです。途中で閉じても、同じブラウザで開けば続きから始まります。</p>' +
      '<ol class="steps"><li><b>第1部</b>（' + c.n1 + ' 個）：絵を1つずつ見て、項目ごとに <b>1〜5</b> の点を付けます。' + SCALE_TEXT + '</li>' +
      '<li><b>第2部</b>（' + c.n2 + ' 回）：2つの絵を並べて、項目ごとに「左・差なし・右」を選びます。</li>' +
      '<li>最後に「評価を書き出す」を押して、できたファイルを Claude とのチャットに添付します。</li></ol>' +
      '<p class="note">絵には番号だけが付いています。どうやって作った絵かは、全部終わって書き出したあとで、画面に出ます。似た絵が続いても、そのとき見えたとおりに付けてください。</p>' +
      '<h3>キーボードでも入れられます</h3><p class="note"><kbd>1</kbd>〜<kbd>5</kbd>＝点（黄色い枠の行に入り、次の行へ進む）／<kbd>Y</kbd>・<kbd>N</kbd>＝はい・いいえ／<kbd>return</kbd>＝次へ／<kbd>スペース</kbd>＝動きを止める・動かす／<kbd>,</kbd>・<kbd>.</kbd>＝1コマ戻す・進める。第2部は <kbd>←</kbd>＝左・<kbd>↓</kbd>＝差なし・<kbd>→</kbd>＝右。</p>' +
      p4Box() + '<p style="margin-top:14px"><button id="bStart" class="pri big">' + (c.d1 + c.d2 ? '続きから始める' : '始める') + '</button></p>' +
      '<p class="note">入れた点は、この端末のこのブラウザの中にだけ残ります（どこにも送りません）。</p></div>';
    bindP4(); $('#bStart').onclick = () => { const f = firstUndone(); if (f) go('trial', f); else go('end'); };
  }
  function mid() {
    main.innerHTML = '<div class="card"><h2>第1部が終わりました。次は、2つを並べて選びます</h2>' +
      '<p>2つの絵が左右に並びます。項目ごとに、<b>良い方</b>（左・右）か、<b>差なし</b>を押してください。動きの組は、2つが同時に動きます（「歩く」「首を振る」を切りかえて、両方見てください）。</p>' +
      '<p class="note">同じような組が何回か出ます。前にどう答えたかは気にせず、そのとき見えたとおりに選んでください。少し休んでから始めても大丈夫です。</p>' +
      '<p><button id="bGo" class="pri big">第2部を始める</button></p></div>';
    $('#bGo').onclick = () => { st.midSeen = true; const f = firstUndone(); if (f) go('trial', f); else go('end'); };
  }

  function rowsHtml(rows) { return rows.join(''); }
  function navHtml(last) { return '<div class="nav"><button id="bBack">← 戻る</button><span class="sp"></span><span class="note" id="navNote"></span><button id="bNext" class="pri big">' + (last ? '入れ終わった' : '次へ →') + '</button></div>'; }
  function setCur(i) { if (!P) return; P.row = i; $$('.row').forEach((r, k) => r.classList.toggle('cur', k === i)); }
  function nextRow() { const rs = $$('.row'); for (let k = P.row + 1; k < rs.length; k++) if (!rs[k].classList.contains('off') && !rs[k].querySelector('.bt .on')) return setCur(k); for (let k = 0; k < rs.length; k++) if (!rs[k].classList.contains('off') && !rs[k].querySelector('.bt .on')) return setCur(k); setCur(-1); }
  function mark(row, val) { $$('.bt button', row).forEach(b => b.classList.toggle('on', b.dataset.v === String(val))); row.classList.remove('miss'); }

  function trial1(t) {
    const modes = modesOf(t, 1), mo = hasMotion(t.key);
    const rows = CRIT.map(c => '<div class="row' + (c.motion && !mo ? ' off' : '') + '" data-c="' + c.id + '"><div class="lb">' + c.label + (c.sub ? '<small>' + (c.motion && !mo ? 'この絵には動きが無いので、付けません' : c.sub) + '</small>' : '') + '</div><div class="bt">' + [1, 2, 3, 4, 5].map(n => '<button data-v="' + n + '">' + n + '</button>').join('') + '</div></div>');
    rows.push('<div class="row" data-c="ok"><div class="lb">これで動画に出せる<small>このまま、動画に出してよいと思うか</small></div><div class="bt"><button data-v="true">はい</button><button data-v="false">いいえ</button></div></div>');
    main.innerHTML = '<div class="one"><div class="view"><h4><span class="no">No. ' + t.no + '</span><span class="note">' + (mo ? '動きがある絵です。「歩く」などを押して、動きも見てください' : '止まった絵だけです') + '</span></h4>' + stageHtml(0) + ctlHtml(modes) + '</div>' +
      '<div class="panel"><h4>No. ' + t.no + ' に点を付ける</h4><p class="legend">' + SCALE_TEXT + '</p>' + rowsHtml(rows) +
      '<p style="margin:8px 0 2px" class="note">ひとこと（書かなくてもよい）</p><textarea id="cmt" rows="2" placeholder="気づいたこと・直したい所など">' + esc(t.comment) + '</textarea>' + navHtml(false) + '</div></div>';
    P = { trial: t, part: 1, sides: [{ key: t.key, canvas: $('canvas[data-s="0"]'), load: $('.stage .load') }], mode: 'still', frame: 0, playing: true, last: 0, view: { z: 1, cx: 0.5, cy: 0.5 }, row: 0 };
    bindCanvas(P.sides[0].canvas); bindCtl();
    $$('.row').forEach((r, k) => {
      const id = r.dataset.c, cur = id === 'ok' ? t.ok : t.scores[id]; if (cur != null) mark(r, cur);
      r.querySelector('.bt').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (id === 'ok') t.ok = b.dataset.v === 'true'; else t.scores[id] = +b.dataset.v; mark(r, b.dataset.v); P.row = k; nextRow(); stamp(t, 1); save(); header(); };
    });
    $('#cmt').oninput = e => { t.comment = e.target.value; }; $('#cmt').onchange = () => save();
    P.row = -1; nextRow(); bindNav(t, 1); setMode('still');
  }
  function trial2(t) {
    const modes = modesOf(t, 2), ids = PAIR_CRIT[t.mode];
    const rows = ids.map(id => '<div class="row" data-c="' + id + '"><div class="lb">' + CR[id].label + (CR[id].sub ? '<small>' + CR[id].sub.replace('（絵の下の「影絵」を押して見る）', '').replace('（動きがある絵だけ）', '').replace('動きがある絵だけ', '') + '</small>' : '') + '</div><div class="bt"><button data-v="L">← 左</button><button data-v="N">差なし</button><button data-v="R">右 →</button></div></div>');
    main.innerHTML = '<div class="pair"><div class="view"><h4><span class="no">組 No. ' + t.no + '</span><span class="note">' + (t.mode === 'motion' ? '動きを比べます。2つは同時に動きます' : '止まった絵を比べます') + '　どちらが良いかを、項目ごとに選んでください</span></h4>' +
      '<div class="views"><div><div class="note" style="text-align:center"><b>左</b></div>' + stageHtml(0) + '</div><div><div class="note" style="text-align:center"><b>右</b></div>' + stageHtml(1) + '</div></div>' + ctlHtml(modes) + '</div>' +
      '<div class="panel"><div class="rows">' + rowsHtml(rows) + '</div><p style="margin:8px 0 2px" class="note">ひとこと（書かなくてもよい）</p><textarea id="cmt" rows="2" placeholder="気づいたこと">' + esc(t.comment) + '</textarea>' + navHtml(false) + '</div></div>';
    const cs = $$('.stage canvas'), ls = $$('.stage .load');
    P = { trial: t, part: 2, sides: [{ key: t.left, canvas: cs[0], load: ls[0] }, { key: t.right, canvas: cs[1], load: ls[1] }], mode: modes[0], frame: 0, playing: true, last: 0, view: { z: 1, cx: 0.5, cy: 0.5 }, row: 0 };
    cs.forEach(bindCanvas); bindCtl();
    $$('.row').forEach((r, k) => {
      const id = r.dataset.c; if (t.picks[id]) mark(r, t.picks[id]);
      r.querySelector('.bt').onclick = e => { const b = e.target.closest('button'); if (!b) return; t.picks[id] = b.dataset.v; mark(r, b.dataset.v); P.row = k; nextRow(); stamp(t, 2); save(); header(); };
    });
    $('#cmt').oninput = e => { t.comment = e.target.value; }; $('#cmt').onchange = () => save();
    P.row = -1; nextRow(); bindNav(t, 2); setMode(modes[0]);
  }
  function stamp(t, part) { if (isDone(part, t)) t.doneAt = new Date().toISOString(); }
  function bindNav(t, part) {
    $('#bBack').disabled = part === 1 && st.cur.i === 0;
    $('#bBack').onclick = () => { if (st.cur.i > 0) go('trial', { part: part, i: st.cur.i - 1 }); else if (part === 2) go('trial', { part: 1, i: st.t1.length - 1 }); };
    $('#bNext').onclick = () => next(t, part);
  }
  function next(t, part) {
    const cm = $('#cmt'); if (cm) t.comment = cm.value;
    if (!isDone(part, t)) {
      $$('.row').forEach(r => { if (!r.classList.contains('off') && !r.querySelector('.bt .on')) r.classList.add('miss'); });
      return toast('まだ入っていない行があります（赤い行）。全部入れてから「次へ」を押してください');
    }
    const ms = modesOf(t, part).filter(m => m === 'walk' || m === 'head');
    if (ms.length && !ms.some(m => t.viewed[m])) return toast('動きをまだ見ていません。絵の下の「' + MODE_NAME[ms[0]] + '」を押して、動きを見てから進んでください');
    stamp(t, part); const L = list(part);
    if (st.cur.i + 1 < L.length) return go('trial', { part: part, i: st.cur.i + 1 });
    const f = firstUndone();
    if (!f) return go('end');
    if (part === 1 && f.part === 2 && !st.midSeen) return go('mid');
    if (f.part !== part || f.i !== st.cur.i) toast(f.part === 1 ? '第1部に、まだ入れていない絵があります。そこへ進みます' : '次へ進みます');
    go('trial', f);
  }

  /* ---- P4 の絵を読みこむ ---- */
  const leaves = d => d.nodes.filter(n => n.kind !== 'group' && n.geo).length;
  const usable = d => !!(d && G.validDoc(d) && leaves(d) > 0);
  function addHuman(which, doc, fileName) {
    const key = which === 'h' ? 'P4_H' : 'P4_S', had = !!st.p4[which];
    st.p4[which] = doc; st.p4.file = fileName; st.p4.at = new Date().toISOString(); delete humanCache[key + ':still']; delete humanCache[key + ':sil'];
    if (had) return;                              /* 絵だけ入れかえる（出す順は変えない） */
    const r = rng((st.seed ^ (which === 'h' ? 0x9E3779B9 : 0x85EBCA6B)) >>> 0);
    const nextId = (p, L) => p + (L.length + 1);
    /* 第1部：まだ見ていない所の中の、乱数で決めた場所へ */
    let lo = 0; st.t1.forEach((t, i) => { if (done1(t)) lo = i + 1; }); if (st.screen === 'trial' && st.cur.part === 1) lo = Math.max(lo, st.cur.i + 1);
    const at1 = lo + Math.floor(r() * (st.t1.length - lo + 1));
    st.t1.splice(at1, 0, { id: nextId('a', st.t1), no: st.nums.pop(), key: key, rep: false, scores: {}, ok: null, comment: '', ms: 0, viewed: {}, doneAt: null });
    /* 第2部：左右を入れかえて2回。あいだに別の組が2つ以上入る場所を探す（無ければ、できるだけ離す） */
    const p = PAIRS.find(q => q.need === which), flip = r() < 0.5;
    let lo2 = 0; st.t2.forEach((t, i) => { if (done2(t)) lo2 = i + 1; }); if (st.screen === 'trial' && st.cur.part === 2) lo2 = Math.max(lo2, st.cur.i + 1);
    const mk = (pres, f) => ({ id: nextId('b', st.t2), no: st.nums.pop(), pair: p.n, pres: pres, mode: p.mode, left: f ? p.b : p.a, right: f ? p.a : p.b, picks: {}, comment: '', ms: 0, viewed: {}, doneAt: null });
    let best = null;
    for (let n = 0; n < 300; n++) { const i = lo2 + Math.floor(r() * (st.t2.length - lo2 + 1)), j = lo2 + Math.floor(r() * (st.t2.length - lo2 + 2)); const a = Math.min(i, j), b = Math.max(i, j) + (i === j ? 1 : 0), gap = b - a; if (!best || gap > best.gap) best = { a: a, b: b, gap: gap }; if (gap >= 3) { best = { a: a, b: b, gap: gap }; break; } }
    st.t2.splice(best.a, 0, mk(1, flip)); st.t2.splice(Math.min(best.b, st.t2.length), 0, mk(2, !flip));
    st.p4.added.push({ which: which, at: st.p4.at, part1Index: at1, part2Index: [best.a, best.b], gap: best.gap });
    if (st.screen === 'trial' && st.cur.part === 1 && at1 <= st.cur.i) st.cur.i++;
  }
  function readP4(f) {
    const r = new FileReader();
    r.onload = () => {
      let d; try { d = JSON.parse(r.result); } catch (e) { return toast('このファイルは読めませんでした（JSON ではないようです）'); }
      const added = [];
      if (d && d.kind === 'lab-p4-eval' && d.docs) {
        if (usable(d.docs.h)) { addHuman('h', d.docs.h, f.name); added.push('人のみ'); }
        if (usable(d.docs.s)) { addHuman('s', d.docs.s, f.name); added.push('下組み＋人'); }
        if (!added.length) return toast('このファイルには、描いた絵が入っていません（P4 の ①・② が、まだ空のようです）');
      } else if (usable(d)) {
        const w = window.confirm('P4 の絵のファイルです。どちらの作り方で描いた絵ですか？\n\nOK＝① 人のみ（空の画面から描いた）\nキャンセル＝② 下組み＋人（AI の下組みを直した）');
        addHuman(w ? 'h' : 's', d, f.name); added.push(w ? '人のみ' : '下組み＋人');
      } else return toast('P4 の「評価.json」か、P4 の絵のファイル（JSON）を選んでください');
      flush(); save(); closeDrawer(); render(); toast('読みこみました：' + added.join('・') + '。見る絵と、並べる組が増えました');
    };
    r.readAsText(f);
  }
  $('#p4file').addEventListener('change', e => { const f = e.target.files[0]; if (f) readP4(f); });

  /* ---- 書き出し ---- */
  function bundle() {
    flush(); if (st.screen === 'trial') startClock();
    const c = counts(), complete = c.left === 0, map = {};
    st.t1.forEach(t => { map['No. ' + t.no] = { part: 1, version: t.key, label: labelOf(t.key), repeat: !!t.rep }; });
    st.t2.forEach(t => { map['組 No. ' + t.no] = { part: 2, pair: t.pair, left: t.left, right: t.right, leftLabel: labelOf(t.left), rightLabel: labelOf(t.right) }; });
    const vk = k => (k === 'L' ? 'left' : k === 'R' ? 'right' : 'none');
    return {
      kind: 'lab-hyoka-result', v: 1, rater: 'human', raterNote: '評価した人＝作り手1人（人の目）。AI の評価者の結果は入っていない',
      page: PAGE_VER, at: new Date().toISOString(), startedAt: st.startedAt, complete: complete, remaining: c.left,
      seed: st.seed, seedNote: '番号と順番は、この種の乱数（mulberry32）で決めた。P4 の絵をあとから読みこんだ分は、種から作った別の乱数で、まだ見ていない所へ入れた',
      device: { ua: navigator.userAgent, platform: navigator.platform || '', screen: [window.screen.width, window.screen.height], window: [window.innerWidth, window.innerHeight], dpr: window.devicePixelRatio || 1, lang: navigator.language || '' },
      scale: SCALE_TEXT, criteria: CRIT.map(c => ({ id: c.id, label: c.label + (c.sub ? '（' + c.sub + '）' : ''), motionOnly: !!c.motion })), fps: st.fps,
      images: { made: MAN.made, frameSize: MAN.frameSize, bigSize: MAN.bigSize, walkFrames: MAN.walkN, headFrames: MAN.headN, versions: MAN.versions.map(v => ({ key: v.key, label: v.label, src: v.src, sha: v.sha, frames: v.frames })) },
      part1: {
        order: st.t1.map(t => t.id),
        trials: st.t1.map((t, i) => ({ id: t.id, index: i + 1, no: t.no, version: t.key, label: labelOf(t.key), repeat: !!t.rep, hasMotion: hasMotion(t.key), done: done1(t), scores: t.scores, ok: t.ok, comment: t.comment, ms: Math.round(t.ms), viewed: Object.keys(t.viewed), doneAt: t.doneAt }))
      },
      part2: {
        order: st.t2.map(t => t.id),
        trials: st.t2.map((t, i) => {
          const pk = {}; Object.keys(t.picks).forEach(k => { pk[k] = { side: vk(t.picks[k]), version: t.picks[k] === 'L' ? t.left : t.picks[k] === 'R' ? t.right : null }; });
          return { id: t.id, index: i + 1, no: t.no, pair: t.pair, presentation: t.pres, mode: t.mode, left: t.left, right: t.right, leftLabel: labelOf(t.left), rightLabel: labelOf(t.right), done: done2(t), picks: pk, comment: t.comment, ms: Math.round(t.ms), viewed: Object.keys(t.viewed), doneAt: t.doneAt };
        })
      },
      map: map,
      p4: { loaded: { h: !!st.p4.h, s: !!st.p4.s }, file: st.p4.file, at: st.p4.at, added: st.p4.added, docs: { h: st.p4.h, s: st.p4.s } }
    };
  }
  function download(name, text) {
    const u = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000);
  }
  function doExport() {
    const b = bundle(), d = new Date(), day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const name = '人の評価_' + day + (b.complete ? '' : '_途中') + '.json';
    download(name, JSON.stringify(b, null, 1)); window.__hyokaLast = b;
    st.exportedAt = b.at; if (b.complete) st.exportedComplete = true; save();
    toast('「' + name + '」を書き出しました（ダウンロードの中）。Claude とのチャットに添付して送ってください');
    return b;
  }
  function endScreen() {
    const c = counts(), done = c.left === 0;
    let h = '<div class="card"><h2>' + (done ? '全部、入れ終わりました。ありがとうございました' : 'まだ、入れていない絵があります（あと ' + c.left + ' 個）') + '</h2>';
    if (!done) h += '<p><button id="bCont" class="pri big">続きを入れる</button></p>';
    else {
      h += '<ol class="steps"><li>下の <b>「評価を書き出す」</b> を押す → ダウンロードの中に「人の評価_日付.json」ができます。</li><li>そのファイルを、<b>Claude とのチャットに添付して送る</b>。</li></ol>' +
        '<p><button id="bExp" class="pri big">評価を書き出す</button>　<button id="bFix">戻って直す（一覧）</button></p>' +
        (st.p4.h && st.p4.s ? '' : '<p class="note">P4 で描いた絵（' + [st.p4.h ? null : '人のみ', st.p4.s ? null : '下組み＋人'].filter(Boolean).join('・') + '）は、読みこまれていません。あとで描いたら、ここで読みこむと、その分だけ続きが出ます。</p>' + p4Box());
      if (st.exportedComplete) h += '<h3>番号と、絵の作り方の対応（書き出したので、出しています）</h3>' + revealHtml();
      else h += '<p class="note">書き出すと、番号と絵の作り方の対応が、この下に出ます。</p>';
    }
    main.innerHTML = h + '</div>';
    if ($('#bCont')) $('#bCont').onclick = () => go('trial', firstUndone());
    if ($('#bExp')) $('#bExp').onclick = () => { doExport(); render(); };
    if ($('#bFix')) $('#bFix').onclick = openDrawer;
    bindP4();
  }
  function revealHtml() {
    return '<table><tr><th>第1部の番号</th><th>絵</th><th></th></tr>' + st.t1.map(t => '<tr><td>No. ' + t.no + '</td><td>' + esc(labelOf(t.key)) + '</td><td>' + (t.rep ? '同じ絵の2回め' : '') + '</td></tr>').join('') + '</table>' +
      '<table style="margin-top:10px"><tr><th>第2部の番号</th><th>左</th><th>右</th></tr>' + st.t2.map(t => '<tr><td>組 No. ' + t.no + '</td><td>' + esc(labelOf(t.left)) + '</td><td>' + esc(labelOf(t.right)) + '</td></tr>').join('') + '</table>';
  }

  /* ---- 一覧・そのほか ---- */
  function openDrawer() {
    const d = $('#drawer'), f = firstUndone();
    const chips = part => '<div class="chips">' + list(part).map((t, i) => { const dn = isDone(part, t), can = dn || (f && f.part === part && f.i === i), now = st.screen === 'trial' && st.cur.part === part && st.cur.i === i; return '<button data-p="' + part + '" data-i="' + i + '" class="' + (dn ? 'done' : '') + (now ? ' now' : '') + '"' + (can ? '' : ' disabled') + '>' + (dn ? '✓ ' : '') + t.no + '</button>'; }).join('') + '</div>';
    d.innerHTML = '<div style="display:flex;align-items:center"><b>一覧・そのほか</b><span style="flex:1"></span><button id="dClose">閉じる</button></div>' +
      '<p class="note">✓ が付いた番号を押すと、その絵に戻って直せます。まだの番号は、順番が来ると出ます。</p>' +
      '<h3>第1部（1つずつ）</h3>' + chips(1) + '<h3>第2部（2つを並べる）</h3>' + chips(2) +
      '<h3>P4 で描いた絵</h3>' + p4Box() +
      '<h3>そのほか</h3><p><button id="dTop">最初の説明を見る</button>　<button id="dHalf">途中のまま書き出す</button></p>' +
      '<p class="note">「途中のまま書き出す」は、止まってしまったときの控え用です（番号の対応は画面に出ません）。</p>' +
      '<p><button id="dReset">全部消して、最初からやり直す</button></p><p class="note">このページの版：' + esc(PAGE_VER) + '</p>';
    d.hidden = false;
    $('#dClose').onclick = closeDrawer;
    $$('.chips button', d).forEach(b => { b.onclick = () => { closeDrawer(); go('trial', { part: +b.dataset.p, i: +b.dataset.i }); }; });
    $('#bP4', d).onclick = () => { $('#p4file').value = ''; $('#p4file').click(); };
    $('#dTop').onclick = () => { closeDrawer(); go('intro'); };
    $('#dHalf').onclick = () => { doExport(); };
    $('#dReset').onclick = () => { if (!window.confirm('入れた点を全部消して、最初からやり直します。よろしいですか？（読みこんだ P4 の絵も消えます）')) return; flush(); st = newState(freshSeed()); save(); closeDrawer(); render(); };
  }
  function closeDrawer() { $('#drawer').hidden = true; }
  $('#bList').onclick = openDrawer; $('#bMenu').onclick = openDrawer;

  /* ---- キーボード ---- */
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tg = e.target, typing = tg && (tg.tagName === 'TEXTAREA' || tg.tagName === 'INPUT' || tg.tagName === 'SELECT');
    if (e.key === 'Escape') { if (!$('#drawer').hidden) closeDrawer(); else if (typing) tg.blur(); return; }
    if (typing || !$('#drawer').hidden) return;
    if (st.screen !== 'trial' || !P) { if (e.key === 'Enter') { const b = $('#bStart') || $('#bGo') || $('#bCont'); if (b) { e.preventDefault(); b.click(); } } return; }
    const rows = $$('.row'), row = rows[P.row], press = v => { const b = row && row.querySelector('.bt button[data-v="' + v + '"]'); if (b) { e.preventDefault(); b.click(); } };
    if (e.key === ' ') { e.preventDefault(); if (isMotion()) $('#cPlay').click(); return; }
    if (e.key === ',') return step(-1); if (e.key === '.') return step(1);
    if (e.key === 'Enter') { e.preventDefault(); return $('#bNext').click(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' && P.part === 1) { e.preventDefault(); let k = P.row; const d = e.key === 'ArrowUp' ? -1 : 1; do { k += d; } while (rows[k] && rows[k].classList.contains('off')); if (rows[k]) setCur(k); return; }
    if (P.part === 1) {
      if (/^[1-5]$/.test(e.key) && row && row.dataset.c !== 'ok') return press(e.key);
      if ((e.key === 'y' || e.key === 'Y') && row && row.dataset.c === 'ok') return press('true');
      if ((e.key === 'n' || e.key === 'N') && row && row.dataset.c === 'ok') return press('false');
    } else {
      if (e.key === 'ArrowLeft' || e.key === '1') return press('L');
      if (e.key === 'ArrowDown' || e.key === '2') return press('N');
      if (e.key === 'ArrowRight' || e.key === '3') return press('R');
    }
  });
  window.addEventListener('resize', paint);

  /* ---- 始める ---- */
  st = load() || newState(freshSeed());
  if (st.screen === 'trial' && !list(st.cur.part)[st.cur.i]) st.screen = 'intro';
  save(); render(); requestAnimationFrame(tick);
  window.__hyoka = { bundle: bundle, state: () => st, ver: PAGE_VER };   /* 確かめ用（裏のブラウザの試しが使う） */
})();
