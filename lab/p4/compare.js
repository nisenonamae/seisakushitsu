/* lab/p4 compare.js — 見比べの画面と、評価の欄 */
(function () {
  'use strict';
  const A = window.P4App, G = window.P4G, GOAL = window.P4_GOAL, AI = window.P4_AI || {};
  const el = document.getElementById('cmp'), esc = A.esc;
  const KEYS = ['h', 's', 'a'], NAMES = { h: '① 人のみ', s: '② 下組み＋人', a: '③ AI のみ' };
  let docs = null, view = { cx: 800, cy: 450, z: 1 }, showPts = false, ghost = false, only = '', ev = null;

  function loadEv() { const e = A.lsGet('eval', null) || {}; e.scores = e.scores || {}; e.overall = e.overall || {}; return e; }
  function saveEv() { A.lsSet('eval', ev); }
  function statsOf() {
    const o = {}; for (const k of KEYS) o[k] = G.stats(docs[k]);
    return o;
  }
  function diff() {
    if (!AI.shitagumi) return null; const base = {}; AI.shitagumi.nodes.forEach(n => base[n.id] = JSON.stringify(n));
    const cur = {}; let changed = 0, added = 0, removed = 0; const names = [];
    docs.s.nodes.forEach(n => { cur[n.id] = 1; if (!(n.id in base)) added++; else if (base[n.id] !== JSON.stringify(n)) { changed++; names.push(n.name); } });
    for (const id in base) if (!cur[id]) removed++;
    return { changed, added, removed, changedNames: names, base: AI.shitagumi.nodes.length };
  }

  function open() {
    docs = A.docs(); ev = loadEv(); view = { cx: docs.h.w / 2, cy: docs.h.h / 2, z: 1 };
    const S = statsOf(), st = A.st, d = diff();
    const row = (t, f, cls) => '<tr><th>' + t + '</th>' + KEYS.map(k => '<td class="' + (cls || 'num') + '">' + f(k) + '</td>').join('') + '</tr>';
    const sc = (id, k) => { const v = (ev.scores[id] && ev.scores[id][k]) || {}; return '<select data-i="' + id + '" data-k="' + k + '"><option value="">—</option>' + [1, 2, 3, 4, 5].map(n => '<option' + (v.s == n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select><input type="text" data-i="' + id + '" data-k="' + k + '" placeholder="ひとこと" value="' + esc(v.c || '') + '">'; };
    el.innerHTML =
      '<div class="head"><button id="cBack" class="pri">← 描く画面に戻る</button><b>見比べる・評価する</b>' +
      '<label class="chk"><input type="checkbox" id="cPts">点と輪郭を見せる</label>' +
      '<label class="chk"><input type="checkbox" id="cGh">② に元の下組みを赤い線で重ねる</label>' +
      '<span class="seg" id="cOnly"><button data-o="" class="on">3つ並べる</button><button data-o="h">①だけ</button><button data-o="s">②だけ</button><button data-o="a">③だけ</button></span>' +
      '<button id="cOut">−</button><button id="cIn">＋</button><button id="cFit">全体</button><span class="note" style="margin:0">絵の上で：引く＝動かす／ホイール・ピンチ＝拡大（3つ一緒に動きます）</span></div>' +
      '<div class="body"><div class="three" id="cThree">' + KEYS.map(k => '<div class="card" data-k="' + k + '"><h4><span>' + NAMES[k] + '</span><span class="note" style="margin:0">部品 ' + S[k].parts + '・点 ' + S[k].points + '</span></h4><canvas data-k="' + k + '"></canvas></div>').join('') + '</div>' +
      '<h3>数字</h3><table><tr><th></th>' + KEYS.map(k => '<th>' + NAMES[k] + '</th>').join('') + '</tr>' +
      row('部品の数', k => S[k].parts) + row('点の合計', k => S[k].points) + row('1部品あたりの点（平均）', k => S[k].avg) +
      row('点がいちばん多い部品', k => S[k].parts ? esc(S[k].maxName) + '（' + S[k].maxPts + '点）' : '—') +
      row('8点を超える部品', k => S[k].over8) + row('12点を超える部品', k => S[k].over12) +
      row('線の部品', k => S[k].lines) + row('図形のままの部品', k => S[k].prims) +
      row('かかった時間（正味）', k => k === 'a' ? '計っていない（AI）' : A.fmtTime(st.time[k])) +
      row('操作の数', k => k === 'a' ? '—' : st.logs[k].length) +
      row('下組みから変えた所', k => k === 's' && d ? '直した ' + d.changed + '・足した ' + d.added + '・消した ' + d.removed + '（元は ' + d.base + '個）' : '—') + '</table>' +
      '<details style="margin-top:8px"><summary>部品ごとの点の数を見る</summary>' + KEYS.map(k => '<div class="per"><b>' + NAMES[k] + '</b>' + (S[k].per.slice().reverse().map(p => '<div class="' + (p.pts > 12 ? 'many' : '') + '">' + esc(p.name) + '：' + (p.kind === '図形' ? '図形（' + p.pts + '点ぶん）' : p.kind + ' ' + p.pts + '点') + '</div>').join('') || '<div>（部品なし）</div>') + '</div>').join('') + '</details>' +
      '<h3>評価（目標の項目ごとに、1〜5 点とひとこと）</h3><p class="note">5＝目標どおり／3＝まあまあ／1＝だめ。空のままでも書き出せます。入れた物は、この端末の中に自動で残ります。</p>' +
      '<table class="ev"><tr><th style="width:26%">目標</th>' + KEYS.map(k => '<th>' + NAMES[k] + '</th>').join('') + '</tr>' +
      GOAL.items.map(i => '<tr><th style="white-space:normal">' + esc(i.title) + '<div class="how">' + esc(i.how) + '</div></th>' + KEYS.map(k => '<td>' + sc(i.id, k) + '</td>').join('') + '</tr>').join('') + '</table>' +
      '<h3>全体について</h3>' +
      '<p><b>この道具なら質が出る、と思いますか？</b>　<select id="oVerdict"><option value="">—</option>' + ['はい', 'いいえ', 'まだ分からない'].map(v => '<option' + (ev.overall.verdict === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>' +
      '　<b>いちばん良かった作り方</b>　<select id="oBest"><option value="">—</option>' + KEYS.map(k => '<option value="' + k + '"' + (ev.overall.best === k ? ' selected' : '') + '>' + NAMES[k] + '</option>').join('') + '</select></p>' +
      '<p><b>足りない物・困った所</b>（道具の機能／慣れ／AI の下組み／手本、のどれの話かも分かれば）</p><textarea id="oLack">' + esc(ev.overall.lack || '') + '</textarea>' +
      '<p><b>そのほか、感じたこと</b></p><textarea id="oMemo">' + esc(ev.overall.memo || '') + '</textarea>' +
      '<div class="send"><button id="cExport" class="pri">「評価.json」を書き出す</button>　<button id="cPng">3つ並べた画像（PNG）も書き出す</button><p class="note">「評価.json」には、3つの絵・数字・評価・操作の記録が1つにまとまります。書き出したファイルを、Claude とのチャットに添付して送ってください。</p></div></div>';
    el.hidden = false; el.scrollTop = 0;
    el.querySelector('#cBack').onclick = close;
    el.querySelector('#cPts').onchange = e => { showPts = e.target.checked; paint(); };
    el.querySelector('#cGh').onchange = e => { ghost = e.target.checked; paint(); };
    showPts = false; ghost = false; only = '';
    el.querySelector('#cOnly').onclick = e => { const b = e.target.closest('button'); if (!b) return; only = b.dataset.o; el.querySelectorAll('#cOnly button').forEach(x => x.classList.toggle('on', x === b)); el.querySelectorAll('.card').forEach(c => c.hidden = !!only && c.dataset.k !== only); el.querySelector('#cThree').classList.toggle('one', !!only); requestAnimationFrame(paint); };
    el.querySelector('#cFit').onclick = () => { view = { cx: docs.h.w / 2, cy: docs.h.h / 2, z: 1 }; paint(); };
    el.querySelector('#cIn').onclick = () => { view.z = Math.min(40, view.z * 1.5); paint(); };
    el.querySelector('#cOut').onclick = () => { view.z = Math.max(0.5, view.z / 1.5); paint(); };
    el.querySelectorAll('.ev select,.ev input').forEach(x => x.addEventListener('change', () => { const i = x.dataset.i, k = x.dataset.k; ev.scores[i] = ev.scores[i] || {}; ev.scores[i][k] = ev.scores[i][k] || {}; if (x.tagName === 'SELECT') ev.scores[i][k].s = x.value ? +x.value : null; else ev.scores[i][k].c = x.value; saveEv(); }));
    const ov = (id, key) => el.querySelector(id).addEventListener('change', e => { ev.overall[key] = e.target.value; saveEv(); });
    ov('#oVerdict', 'verdict'); ov('#oBest', 'best'); ov('#oLack', 'lack'); ov('#oMemo', 'memo');
    el.querySelector('#cExport').onclick = exportEval; el.querySelector('#cPng').onclick = exportPng;
    el.querySelectorAll('canvas').forEach(bind);
    requestAnimationFrame(paint);
  }
  function close() { el.hidden = true; el.innerHTML = ''; A.refresh(); }

  function paintOne(c) {
    const k = c.dataset.k, doc = docs[k], d = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight; if (!w) return;
    if (c.width !== Math.round(w * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    const x = c.getContext('2d'), s = (w / doc.w) * view.z;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#c9c9cf'; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(d * s, 0, 0, d * s, d * (w / 2 - view.cx * s), d * (h / 2 - view.cy * s));
    x.save(); x.beginPath(); x.rect(0, 0, doc.w, doc.h); x.clip(); G.draw(x, doc); x.restore();
    if (ghost && k === 's' && AI.shitagumi) { x.save(); x.strokeStyle = '#e11d48'; x.lineWidth = 1.3 / s; x.setLineDash([6 / s, 4 / s]); for (const n of AI.shitagumi.nodes) if (n.geo) x.stroke(G.path2d(n)); x.restore(); }
    if (showPts) G.drawPoints(x, doc, s);
    if (!doc.nodes.length) { x.setTransform(d, 0, 0, d, 0, 0); x.fillStyle = '#555'; x.font = '13px sans-serif'; x.textAlign = 'center'; x.fillText('まだ描いていません', w / 2, h / 2); }
  }
  function paint() { el.querySelectorAll('canvas').forEach(paintOne); }
  function bind(c) {
    let dr = null;
    const sc = () => (c.clientWidth / docs.h.w) * view.z;
    c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); dr = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }; c.style.cursor = 'grabbing'; });
    c.addEventListener('pointermove', e => { if (!dr) return; view.cx = dr.cx - (e.clientX - dr.x) / sc(); view.cy = dr.cy - (e.clientY - dr.y) / sc(); paint(); });
    const up = () => { dr = null; c.style.cursor = 'grab'; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', e => {
      if (!(e.ctrlKey || e.metaKey || A.st.wheelZoom) && view.z === 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;   /* 全体表示のあいだは、ふつうのスクロールをじゃましない */
      e.preventDefault(); const r = c.getBoundingClientRect(), s = sc(), mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
      if (e.ctrlKey || e.metaKey || A.st.wheelZoom) { const px = view.cx + mx / s, py = view.cy + my / s, f = Math.exp(-Math.max(-40, Math.min(40, e.deltaY)) * 0.012), nz = Math.max(0.5, Math.min(40, view.z * f)), ns = s * nz / view.z; view.z = nz; view.cx = px - mx / ns; view.cy = py - my / ns; }
      else { view.cx += e.deltaX / s; view.cy += e.deltaY / s; }
      paint();
    }, { passive: false });
    let gz = 1; c.addEventListener('gesturestart', e => { e.preventDefault(); gz = view.z; }); c.addEventListener('gesturechange', e => { e.preventDefault(); view.z = Math.max(0.5, Math.min(40, gz * e.scale)); paint(); });
  }

  function bundle() {
    const st = A.st;
    return {
      kind: 'lab-p4-eval', v: 1, at: new Date().toISOString(), ua: navigator.userAgent, screen: [window.innerWidth, window.innerHeight, window.devicePixelRatio || 1],
      goal: GOAL, eval: ev, stats: statsOf(), diffFromShitagumi: diff(),
      activeMs: { h: Math.round(st.time.h), s: Math.round(st.time.s) }, opCount: { h: st.logs.h.length, s: st.logs.s.length },
      docs: { h: docs.h, s: docs.s, a: docs.a, shitagumi: AI.shitagumi || null }, logs: { h: st.logs.h, s: st.logs.s }
    };
  }
  function exportEval() { A.download('評価.json', A.jsonBlob(bundle())); A.toast('「評価.json」を書き出しました（ダウンロードの中）。チャットに添付して送ってください'); }
  function exportPng() {
    const W = 1600, H = 900, c = document.createElement('canvas'); c.width = W * 3 + 40; c.height = H + 60; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '28px sans-serif'; x.fillStyle = '#222';
    KEYS.forEach((k, i) => { x.save(); x.translate(i * (W + 20), 50); x.beginPath(); x.rect(0, 0, W, H); x.clip(); G.draw(x, docs[k]); x.restore(); x.fillStyle = '#222'; x.fillText(NAMES[k], i * (W + 20) + 8, 34); });
    c.toBlob(b => A.download('p4_見比べ.png', b), 'image/png');
  }
  window.addEventListener('resize', () => { if (!el.hidden) paint(); });
  window.P4Compare = { open, close, bundle };
})();
