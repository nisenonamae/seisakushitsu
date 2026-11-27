/* lab/p4 app.js — 描く画面（試作。捨ててよい物）
   決まり：localStorage は 'lab:p4:' で始まる名前だけ。通信なし。外部のスクリプトなし。 */
(function () {
  'use strict';
  const G = window.P4G, GOAL = window.P4_GOAL, AI = window.P4_AI || {};
  const LS = 'lab:p4:';
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const hitCv = document.createElement('canvas'); hitCv.width = hitCv.height = 4; const hctx = hitCv.getContext('2d');
  const MODES = { h: '① 人のみ', s: '② 下組み＋人', a: '③ AI のみ' };
  const clone = o => JSON.parse(JSON.stringify(o));
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  const st = {
    mode: 'h', doc: null, sel: new Set(), psel: new Set(), tool: 'select',
    view: { x: 0, y: 0, s: 1 }, undo: { h: [], s: [], a: [] }, redo: { h: [], s: [], a: [] },
    fill: GOAL.palette[0].c, stroke: GOAL.palette[7].c, sw: 8, cap: 'round', target: 'fill',
    under: { img: null, x: 0, y: 0, s: 1, a: 0.5, move: false }, ghost: false, see: false,
    pen: null, auto: false, wheelZoom: false, clip: null, pasteN: 0, space: false,
    logs: { h: [], s: [], a: [] }, time: { h: 0, s: 0, a: 0 }, opn: { h: 0, s: 0, a: 0 }
  };
  let drag = null, hover = null, snap = null, lastAct = 0, grpSeq = 0;

  /* ---------- 保存（端末の中） ---------- */
  function lsGet(k, d) { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); return true; } catch (e) { toast('端末の中に保存できませんでした（空きが足りません）。「絵をファイルに書き出す」で残してください'); return false; } }
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 250); }
  function saveNow() {
    clearTimeout(saveT);
    if (st.mode !== 'a') { lsSet('doc:' + st.mode, st.doc); lsSet('log:' + st.mode, st.logs[st.mode]); }
    lsSet('time', st.time); lsSet('ui', { mode: st.mode, auto: st.auto, wheelZoom: st.wheelZoom, capW: +$('capW').value });
  }
  function freshDoc(mode) {
    if (mode === 's' && AI.shitagumi) return clone(AI.shitagumi);
    if (mode === 'a' && AI.ai_only) return clone(AI.ai_only);
    return G.emptyDoc(GOAL);
  }
  function loadDoc(mode) {
    if (mode === 'a') return freshDoc('a');
    const d = lsGet('doc:' + mode, null);
    return G.validDoc(d) ? d : freshDoc(mode);
  }

  /* ---------- 操作の記録・時間 ---------- */
  function tick() {
    const now = Date.now();
    if (lastAct && st.mode !== 'a' && $('cmp').hidden) { const d = now - lastAct; if (d > 0 && d < 30000) st.time[st.mode] += d; }
    lastAct = now;
  }
  function log(type, ids, args, group) {
    const L = st.logs[st.mode]; if (!L) return;
    const e = { n: L.length + 1, at: Date.now(), ms: Math.round(st.time[st.mode]), type: type, ids: ids || [] };
    if (args !== undefined) e.args = args; if (group) e.group = group;
    L.push(e); if (L.length > 30000) L.splice(0, L.length - 30000);
  }
  function fmtTime(ms) { const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); }
  setInterval(() => { $('timeBox').textContent = st.mode === 'a' ? '時間 —' : '時間 ' + fmtTime(st.time[st.mode]); }, 1000);

  /* ---------- 取り消しの土台 ---------- */
  const ro = () => st.mode === 'a';
  function begin() { if (snap == null) snap = JSON.stringify(st.doc); }
  function commit(type, ids, args) {
    if (snap == null) return false;
    const now = JSON.stringify(st.doc);
    if (now === snap) { snap = null; return false; }
    if (ro()) { st.doc = JSON.parse(snap); snap = null; toast('③ は見るだけです（直すのは ① か ②）'); refresh(); return false; }
    const U = st.undo[st.mode]; U.push(snap); if (U.length > 300) U.shift();
    st.redo[st.mode].length = 0; snap = null;
    log(type, ids, args); save(); refresh(); return true;
  }
  function cancel() { if (snap != null) { st.doc = JSON.parse(snap); snap = null; } }
  function cleanSel() {
    const ids = new Set(st.doc.nodes.map(n => n.id)); for (const i of [...st.sel]) if (!ids.has(i)) st.sel.delete(i);
    const pids = new Set(); st.doc.nodes.forEach(n => { if (n.geo && n.geo.t === 'path') n.geo.pts.forEach(q => pids.add(q.id)); });
    for (const i of [...st.psel]) if (!pids.has(i)) st.psel.delete(i);
    if (st.pen && !byId(st.pen.id)) st.pen = null;
  }
  function undo() { const U = st.undo[st.mode]; if (!U.length) return; cancel(); st.redo[st.mode].push(JSON.stringify(st.doc)); st.doc = JSON.parse(U.pop()); cleanSel(); log('undo'); save(); refresh(); }
  function redo() { const R = st.redo[st.mode]; if (!R.length) return; cancel(); st.undo[st.mode].push(JSON.stringify(st.doc)); st.doc = JSON.parse(R.pop()); cleanSel(); log('redo'); save(); refresh(); }

  /* ---------- 部品のたどり方 ---------- */
  const byId = id => st.doc.nodes.find(n => n.id === id);
  const selNodes = () => st.doc.nodes.filter(n => st.sel.has(n.id) && n.kind !== 'group');
  const kids = gid => st.doc.nodes.filter(n => n.parent === gid);
  function leavesOf(n) { if (n.kind !== 'group') return [n]; let o = []; for (const k of kids(n.id)) o = o.concat(leavesOf(k)); return o; }
  function topOf(n) { let q = n, g = 0; while (q.parent && g++ < 20) { const p = byId(q.parent); if (!p) break; q = p; } return q; }
  function usable(n, hs) { return n.kind !== 'group' && n.geo && !hs.hid.has(n.id) && !hs.lock.has(n.id); }
  function fixKind(n) { if (n.kind !== 'group') n.kind = G.isOpen(n) ? 'line' : 'shape'; }
  function nameFor(base) { let k = 1; const names = new Set(st.doc.nodes.map(n => n.name)); while (names.has(base + ' ' + k)) k++; return base + ' ' + k; }

  /* ---------- 画面の座標 ---------- */
  function resize() {
    const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (!r.width || !r.height) return;
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); draw();
  }
  function fit() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const s = Math.min((r.width - 40) / st.doc.w, (r.height - 40) / st.doc.h);
    st.view = { s, x: (r.width - st.doc.w * s) / 2, y: (r.height - st.doc.h * s) / 2 }; draw();
  }
  function zoomAt(cx, cy, f) {
    const v = st.view, ns = Math.max(0.05, Math.min(64, v.s * f)); f = ns / v.s;
    v.x = cx - (cx - v.x) * f; v.y = cy - (cy - v.y) * f; v.s = ns; draw();
  }
  const evPos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const toDoc = s => [(s[0] - st.view.x) / st.view.s, (s[1] - st.view.y) / st.view.s];
  const px = n => n / st.view.s;

  /* ---------- 当たりの判定 ---------- */
  function hitNode(p, onlySel) {
    const hs = G.hiddenSet(st.doc);
    for (let i = st.doc.nodes.length - 1; i >= 0; i--) {
      const n = st.doc.nodes[i]; if (!usable(n, hs)) continue; if (onlySel && !st.sel.has(n.id)) continue;
      const path = G.path2d(n);
      if (n.fill && !G.isOpen(n) && hctx.isPointInPath(path, p[0], p[1])) return n;
      hctx.lineWidth = Math.max(n.stroke ? n.stroke.w : 0, px(10)); hctx.lineCap = 'round'; hctx.lineJoin = 'round';
      if ((n.stroke || !n.fill || G.isOpen(n)) && hctx.isPointInStroke(path, p[0], p[1])) return n;
    }
    return null;
  }
  function selBox() { return G.bboxOf(selNodes()); }
  function xfHandles() {
    const b = selBox(); if (!b) return [];
    const [x0, y0, x1, y1] = b, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    return [
      { k: 'nw', p: [x0, y0], a: [x1, y1] }, { k: 'n', p: [mx, y0], a: [mx, y1] }, { k: 'ne', p: [x1, y0], a: [x0, y1] }, { k: 'e', p: [x1, my], a: [x0, my] },
      { k: 'se', p: [x1, y1], a: [x0, y0] }, { k: 's', p: [mx, y1], a: [mx, y0] }, { k: 'sw', p: [x0, y1], a: [x1, y0] }, { k: 'w', p: [x0, my], a: [x1, my] },
      { k: 'rot', p: [mx, y0 - px(26)], a: [mx, my] }];
  }
  function hitXf(p) { for (const h of xfHandles()) if (G.v.dist(h.p, p) < px(8)) return h; return null; }
  /* 点を直す道具で見せる点と取っ手 */
  function editables() {
    const hs = G.hiddenSet(st.doc);
    return selNodes().filter(n => n.geo.t === 'path' && usable(n, hs));
  }
  function handleList(n) {
    const pts = n.geo.pts, cl = !!n.geo.closed, out = [], N = pts.length;
    pts.forEach((q, i) => {
      if (cl || i < N - 1) { const h = G.hOut(pts, cl, i); if (!(q.corner && h.auto) && N > 1) out.push({ n, q, i, side: 'out', p: h.p, auto: h.auto }); }
      if (cl || i > 0) { const h = G.hIn(pts, cl, i); if (!(q.corner && h.auto) && N > 1) out.push({ n, q, i, side: 'in', p: h.p, auto: h.auto }); }
    });
    return out;
  }
  function hitHandle(p) { for (const n of editables()) for (const h of handleList(n)) if (G.v.dist(h.p, p) < px(7)) return h; return null; }
  function hitPoint(p, nodes) { let best = null; for (const n of (nodes || editables())) n.geo.pts.forEach((q, i) => { const d = G.v.dist(q.p, p); if (d < px(8) && (!best || d < best.d)) best = { n, q, i, d }; }); return best; }
  function hitSeg(p) { let best = null; for (const n of editables()) { const r = G.nearest(n.geo.pts, n.geo.closed, p); if (r.seg >= 0 && r.d < px(7) && (!best || r.d < best.r.d)) best = { n, r }; } return best; }

  /* ---------- 描く ---------- */
  let rafQ = false;
  function draw() { if (rafQ) return; rafQ = true; requestAnimationFrame(() => { rafQ = false; paint(); }); }
  function paint() {
    const d = window.devicePixelRatio || 1, v = st.view, doc = st.doc;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#d5d5da'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(d * v.s, 0, 0, d * v.s, d * v.x, d * v.y);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(4 / v.s, 4 / v.s, doc.w, doc.h);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, doc.w, doc.h); ctx.clip();
    G.draw(ctx, doc, {
      alpha: st.see && st.under.img ? 0.45 : null,
      under: c => { const u = st.under; if (u.img) { c.save(); c.globalAlpha = u.a; c.drawImage(u.img, u.x, u.y, u.img.width * u.s, u.img.height * u.s); c.restore(); } }
    });
    ctx.restore();
    if (st.ghost && st.mode === 's' && AI.shitagumi) {
      ctx.save(); ctx.setLineDash([px(6), px(4)]); ctx.strokeStyle = '#e11d48'; ctx.lineWidth = px(1.3);
      for (const n of AI.shitagumi.nodes) if (n.geo) ctx.stroke(G.path2d(n)); ctx.restore();
    }
    const BL = '#0a6cff';
    /* 選んだ部品の輪郭 */
    const sn = selNodes();
    ctx.lineWidth = px(1.2); ctx.strokeStyle = BL; ctx.setLineDash([]);
    for (const n of sn) ctx.stroke(G.path2d(n));
    if (hover && !st.sel.has(hover) && byId(hover)) { ctx.strokeStyle = 'rgba(10,108,255,.55)'; ctx.lineWidth = px(2); ctx.stroke(G.path2d(byId(hover))); }
    if (st.tool === 'select' && sn.length && !(drag && drag.k === 'move')) {
      const b = selBox();
      if (b) {
        ctx.strokeStyle = BL; ctx.lineWidth = px(1); ctx.setLineDash([px(4), px(3)]); ctx.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); ctx.setLineDash([]);
        const hs = xfHandles(), rh = hs[8];
        ctx.beginPath(); ctx.moveTo(rh.p[0], rh.p[1]); ctx.lineTo(rh.p[0], b[1]); ctx.stroke();
        for (const h of hs) { ctx.fillStyle = '#fff'; ctx.beginPath(); if (h.k === 'rot') ctx.arc(h.p[0], h.p[1], px(5.5), 0, 7); else ctx.rect(h.p[0] - px(4.5), h.p[1] - px(4.5), px(9), px(9)); ctx.fill(); ctx.stroke(); }
      }
    }
    if (st.tool === 'point' || st.tool === 'pen') {
      const hs0 = G.hiddenSet(st.doc);
      for (const n of sn) {
        if (n.geo.t !== 'path' || hs0.hid.has(n.id)) continue;
        if (st.tool === 'point' || (st.pen && st.pen.id === n.id)) {
          for (const h of handleList(n)) {
            ctx.strokeStyle = h.auto ? 'rgba(10,108,255,.45)' : BL; ctx.lineWidth = px(1); ctx.setLineDash(h.auto ? [px(3), px(3)] : []);
            ctx.beginPath(); ctx.moveTo(h.q.p[0], h.q.p[1]); ctx.lineTo(h.p[0], h.p[1]); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = h.auto ? '#fff' : BL; ctx.beginPath(); ctx.arc(h.p[0], h.p[1], px(3.6), 0, 7); ctx.fill(); ctx.stroke();
          }
        }
        n.geo.pts.forEach((q, i) => {
          const on = st.psel.has(q.id), r = px(on ? 5.5 : 4.5);
          ctx.fillStyle = on ? BL : '#fff'; ctx.strokeStyle = BL; ctx.lineWidth = px(1.4); ctx.beginPath();
          if (q.corner) ctx.rect(q.p[0] - r, q.p[1] - r, r * 2, r * 2); else ctx.arc(q.p[0], q.p[1], r, 0, 7);
          ctx.fill(); ctx.stroke();
          if (st.pen && st.pen.id === n.id && i === 0 && n.geo.pts.length > 1) { ctx.strokeStyle = '#e11d48'; ctx.beginPath(); ctx.arc(q.p[0], q.p[1], px(9), 0, 7); ctx.stroke(); }
        });
      }
    }
    /* ペンの先の見こみ線 */
    if (st.tool === 'pen' && st.pen && st.pen.cur && !drag) {
      const n = byId(st.pen.id);
      if (n && n.geo.pts.length) {
        const pts = n.geo.pts.concat([{ id: '_', p: st.pen.cur, corner: !st.auto }]), ss = G.segs(pts, false), s = ss[ss.length - 1];
        ctx.strokeStyle = 'rgba(10,108,255,.7)'; ctx.lineWidth = px(1.2); ctx.setLineDash([px(4), px(3)]); ctx.beginPath(); ctx.moveTo(s.p0[0], s.p0[1]); ctx.bezierCurveTo(s.c1[0], s.c1[1], s.c2[0], s.c2[1], s.p3[0], s.p3[1]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (drag && drag.k === 'marquee' && drag.cur) {
      const a = drag.start, b = drag.cur; ctx.fillStyle = 'rgba(10,108,255,.08)'; ctx.strokeStyle = BL; ctx.lineWidth = px(1);
      ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    }
    $('zoomBox').textContent = Math.round(v.s * 100) + '%';
  }

  /* ---------- 右の欄・一覧 ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function renderList() {
    const el = $('list'), top = el.scrollTop, hs = G.hiddenSet(st.doc), rows = [];
    for (let i = st.doc.nodes.length - 1; i >= 0; i--) {
      const n = st.doc.nodes[i]; let depth = 0, q = n; while (q.parent && depth < 6) { q = byId(q.parent) || {}; depth++; }
      const isG = n.kind === 'group', lv = isG ? leavesOf(n) : null;
      const on = isG ? (lv.length > 0 && lv.every(x => st.sel.has(x.id))) : st.sel.has(n.id), c = isG ? 0 : G.ptCount(n);
      rows.push('<div class="it' + (on ? ' sel' : '') + (isG ? ' grp' : '') + '" data-id="' + n.id + '" style="padding-left:' + (6 + depth * 14) + 'px">' +
        '<button data-act="eye" class="' + (n.visible === false ? 'off' : '') + '" title="見せる／隠す">👁</button>' +
        '<button data-act="lock" class="' + (n.locked ? '' : 'off') + '" title="固定（動かない・選べない）">🔒</button>' +
        (isG ? '<span>▾</span>' : '<span class="sw" style="background:' + (n.fill && !G.isOpen(n) ? n.fill : (n.stroke ? n.stroke.c : '#fff')) + '"></span>') +
        '<span class="nm">' + esc(n.name || '') + '</span>' +
        (isG ? '<span class="n">' + lv.length + '個</span>' : '<span class="n' + (c > 12 ? ' many' : '') + '">' + (G.isPrim(n) ? '図形' : (G.isOpen(n) ? '線 ' : '') + c + '点') + '</span>') + '</div>');
    }
    el.innerHTML = rows.join('') || '<div class="empty">まだ部品がありません。左の「ペン」か「円」「四角」「長丸」で描き始めます。</div>';
    el.scrollTop = top;
  }
  function renderProps() {
    const sn = selNodes(), one = sn.length === 1 ? sn[0] : null;
    $('selInfo').textContent = sn.length ? '（' + sn.length + '個）' : '（なし）';
    const prim = one && G.isPrim(one);
    $('secShape').hidden = !prim;
    if (prim && !$('secShape').contains(document.activeElement)) fillShape(one);
    $('secPoint').hidden = !(st.tool === 'point' && st.psel.size > 0);
    $('ghostRow').hidden = st.mode !== 's';
    if (one) {
      $('cFillOn').checked = !!one.fill && !G.isOpen(one); $('cStrokeOn').checked = !!one.stroke;
      if (one.stroke && document.activeElement !== $('swN') && document.activeElement !== $('sw')) { $('sw').value = one.stroke.w; $('swN').value = one.stroke.w; $('cCap').checked = (one.stroke.cap || 'round') === 'round'; }
    }
    document.querySelectorAll('#pal button').forEach(b => { const cur = st.target === 'fill' ? st.fill : st.stroke; b.classList.toggle('on', b.dataset.c === cur); });
    const cf = $('curFill'), cs = $('curStroke'); cf.style.background = st.fill || ''; cf.className = st.fill ? '' : 'none'; cs.style.background = st.stroke || ''; cs.className = st.stroke ? '' : 'none';
    $('bUndo').disabled = !st.undo[st.mode].length; $('bRedo').disabled = !st.redo[st.mode].length;
    document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === st.tool));
    document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === st.mode));
    document.querySelectorAll('#colTarget button').forEach(b => b.classList.toggle('on', b.dataset.t === st.target));
    $('bUnderMove').classList.toggle('on', st.under.move);
    modeInfo(); hint();
  }
  function fillShape(n) {
    const g = n.geo, xf = n.xf; $('pX').value = G.r2(xf.pos[0]); $('pY').value = G.r2(xf.pos[1]); $('pRot').value = G.r2(xf.rot || 0);
    if (g.t === 'capsule') { $('pW').value = G.r2(g.len); $('pH').value = G.r2(g.w); $('lW').firstChild.textContent = '長さ'; $('lH').firstChild.textContent = '太さ'; $('lR').hidden = true; }
    else { $('pW').value = G.r2(g.size[0]); $('pH').value = G.r2(g.size[1]); $('lW').firstChild.textContent = '幅'; $('lH').firstChild.textContent = '高さ'; $('lR').hidden = g.t !== 'rect'; if (g.t === 'rect') $('pR').value = G.r2(g.round || 0); }
  }
  function diffFromBase() {
    if (!AI.shitagumi) return null;
    const base = {}; AI.shitagumi.nodes.forEach(n => base[n.id] = JSON.stringify(n));
    const cur = {}; let changed = 0, added = 0, removed = 0; const ch = [];
    st.doc.nodes.forEach(n => { cur[n.id] = 1; if (!(n.id in base)) added++; else if (base[n.id] !== JSON.stringify(n)) { changed++; ch.push(n.name); } });
    for (const id in base) if (!cur[id]) removed++;
    return { changed, added, removed, names: ch };
  }
  function modeInfo() {
    const s = G.stats(st.doc); let t = '<b>' + MODES[st.mode] + '</b>　部品 ' + s.parts + '・点 ' + s.points + '・操作 ' + st.logs[st.mode].length + '回';
    if (st.mode === 'h') t += '<br>空の画面から、自分で描きます。';
    if (st.mode === 's') { const d = diffFromBase(); t += '<br>AI の下組みを直します。' + (d ? '下組みから：直した部品 ' + d.changed + '・足した ' + d.added + '・消した ' + d.removed : ''); }
    if (st.mode === 'a') t += '<br>AI だけで仕上げた物です。<b>見るだけ</b>（選んで点の数を見るのは、できます）。';
    $('modeInfo').innerHTML = t;
    const bn = $('banner'); bn.hidden = !(st.mode === 'a' || st.under.move); bn.textContent = st.under.move ? '下敷きを動かしています（引く＝動かす）。終わったら右の「下敷きを動かす」をもう一度押す' : '③ AI のみ：見るだけです';
  }
  const HINTS = {
    select: '部品を押す＝選ぶ（⇧で足す）。引く＝動かす。まわりの□＝大きさ、上の○＝回す（⇧で15度ずつ）。グループの中の1つだけは ⌘ を押しながら押す。2回続けて押す＝点を直す',
    point: '点を引く＝動かす。取っ手（細い線の先の●）を引く＝曲がり方（⌥で片側だけ）。線の上を押す＝点を足す。点を2回続けて押す＝なめらか⇔角。delete＝点を消す',
    pen: '押す＝角の点。押して引く＝なめらかな点。始点（赤い丸）を押す＝閉じる。return か esc＝開いた線のまま終わる',
    ellipse: '引く＝だ円。⇧を押しながら＝まん丸', rect: '引く＝四角（⇧で正方形）。丸みは右の「図形の数値」で変える', capsule: '端から端へ引く＝長丸。太さは右の「長丸の太さ」',
    hand: '引く＝画面を動かす。2本指＝動かす、ピンチ（または ⌘＋ホイール）＝拡大・縮小'
  };
  function hint(t) { $('hint').textContent = t || HINTS[st.tool] || ''; }
  let toastT = 0;
  function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3200); }
  function refresh() { renderList(); renderProps(); draw(); }

  /* ---------- 道具 ---------- */
  function setTool(t) {
    if (st.tool === 'pen' && t !== 'pen') penEnd();
    st.tool = t; if (t !== 'point') st.psel.clear();
    cv.style.cursor = t === 'hand' ? 'grab' : (t === 'select' || t === 'point') ? 'default' : 'crosshair';
    refresh();
  }
  function selectNode(n, e) {
    const add = e && e.shiftKey, solo = e && (e.metaKey || e.ctrlKey);
    const tgt = solo ? [n] : leavesOf(topOf(n)).filter(x => !x.locked);
    if (add) { const all = tgt.every(x => st.sel.has(x.id)); tgt.forEach(x => all ? st.sel.delete(x.id) : st.sel.add(x.id)); }
    else if (!tgt.every(x => st.sel.has(x.id)) || solo) { st.sel = new Set(tgt.map(x => x.id)); }
    st.psel.clear();
  }
  function restore(orig, ids) { for (const id of ids) { const i = st.doc.nodes.findIndex(n => n.id === id); if (i >= 0 && orig[id]) st.doc.nodes[i] = clone(orig[id]); } }
  function origMap(nodes) { const o = {}; nodes.forEach(n => o[n.id] = clone(n)); return o; }
  function applyM(M, ids) { for (const id of ids) { const n = byId(id); if (n) G.transformNode(n, M); } }
  const r3 = x => Math.round(x * 1000) / 1000;

  function penEnd() {
    if (!st.pen) return; const n = byId(st.pen.id); st.pen = null;
    if (n && n.geo.pts.length < 2) { begin(); st.doc.nodes = st.doc.nodes.filter(x => x !== n); st.sel.delete(n.id); commit('node.remove', [n.id], { why: '点が1つだけの線' }); }
    else if (n) log('pen.end', [n.id], { closed: !!n.geo.closed, pts: n.geo.pts.length });
    refresh();
  }
  function addNode(n) { st.doc.nodes.push(n); st.sel = new Set([n.id]); st.psel.clear(); }

  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.button !== 1) return;
    tick(); cv.setPointerCapture(e.pointerId); document.activeElement && document.activeElement.blur && document.activeElement !== document.body && document.activeElement.blur();
    const s = evPos(e), p = toDoc(s);
    if (st.tool === 'hand' || st.space || e.button === 1) { drag = { k: 'pan', s, v: { ...st.view } }; cv.style.cursor = 'grabbing'; return; }
    if (st.under.move && st.under.img) { drag = { k: 'under', p, u: { ...st.under } }; return; }
    if (st.tool === 'select') return downSelect(e, p);
    if (st.tool === 'point') return downPoint(e, p);
    if (st.tool === 'pen') return downPen(e, p);
    if (ro()) { toast('③ は見るだけです（直すのは ① か ②）'); return; }
    drag = { k: 'shape', t: st.tool, start: p, id: null };
  });

  function downSelect(e, p) {
    const h = st.sel.size ? hitXf(p) : null;
    if (h && !ro()) { begin(); const ids = selNodes().map(n => n.id); drag = { k: h.k === 'rot' ? 'rot' : 'scale', h, start: p, ids, orig: origMap(selNodes()), box: selBox(), g: 'g' + (++grpSeq) }; return; }
    const n = hitNode(p);
    if (n) {
      selectNode(n, e); refresh();
      if (!st.sel.has(n.id) || ro()) return;
      begin(); const sn = selNodes(); drag = { k: 'move', start: p, ids: sn.map(x => x.id), orig: origMap(sn), moved: false };
    } else { if (!e.shiftKey) { st.sel.clear(); st.psel.clear(); } drag = { k: 'marquee', start: p, cur: p, base: new Set(st.sel) }; refresh(); }
  }
  function downPoint(e, p) {
    const hh = hitHandle(p);
    if (hh && !ro()) {
      begin(); const pts = hh.n.geo.pts, cl = !!hh.n.geo.closed;
      const other = hh.side === 'out' ? G.hIn(pts, cl, hh.i).p : G.hOut(pts, cl, hh.i).p;
      drag = { k: 'handle', nid: hh.n.id, pid: hh.q.id, side: hh.side, otherVec: G.v.sub(other, hh.q.p), wasCorner: !!hh.q.corner };
      if (!st.psel.has(hh.q.id)) { st.psel = new Set([hh.q.id]); } refresh(); return;
    }
    const hp = hitPoint(p);
    if (hp) {
      if (e.shiftKey) { st.psel.has(hp.q.id) ? st.psel.delete(hp.q.id) : st.psel.add(hp.q.id); }
      else if (!st.psel.has(hp.q.id)) st.psel = new Set([hp.q.id]);
      refresh(); if (ro()) return;
      begin(); const o = {}; editables().forEach(n => n.geo.pts.forEach(q => { if (st.psel.has(q.id)) o[q.id] = q.p.slice(); }));
      drag = { k: 'pts', start: p, orig: o, moved: false }; return;
    }
    const hsg = hitSeg(p);
    if (hsg && !ro()) {
      begin(); const q = G.splitAt(hsg.n.geo.pts, hsg.n.geo.closed, hsg.r.seg, hsg.r.t);
      if (q) { st.psel = new Set([q.id]); commit('pt.add', [hsg.n.id], { pt: q.id, after: hsg.n.geo.pts[hsg.r.i] ? hsg.n.geo.pts[hsg.r.i].id : null, p: q.p.map(G.r2) }); }
      return;
    }
    const n = hitNode(p);
    if (n) { selectNode(n, e); if (G.isPrim(n)) toast('図形は、右の「自由な形に変える」を押すと点を直せます'); refresh(); return; }
    if (!e.shiftKey) st.psel.clear();
    drag = { k: 'pmarquee', start: p, cur: p, base: new Set(st.psel) }; refresh();
  }
  function downPen(e, p) {
    if (ro()) { toast('③ は見るだけです（直すのは ① か ②）'); return; }
    let n = st.pen && byId(st.pen.id);
    if (!n) {
      /* 開いた線の端を押したら、そこから続ける */
      const cand = selNodes().filter(x => G.isOpen(x)), hp = hitPoint(p, cand);
      if (hp && (hp.i === 0 || hp.i === hp.n.geo.pts.length - 1)) {
        begin(); if (hp.i === 0) { hp.n.geo.pts.reverse(); hp.n.geo.pts.forEach(q => { const a = q.in; if (q.out) q.in = q.out; else delete q.in; if (a) q.out = a; else delete q.out; }); }
        st.pen = { id: hp.n.id, cur: p }; commit('pen.continue', [hp.n.id], {}); return;
      }
      begin();
      n = { id: G.newId('n'), name: nameFor('線'), kind: 'line', parent: null, visible: true, locked: false, geo: { t: 'path', pts: [], closed: false }, fill: null, stroke: { c: st.stroke || st.fill || '#333333', w: st.sw, cap: st.cap } };
      addNode(n); st.pen = { id: n.id, cur: p }; log('node.add', [n.id], { via: 'pen', name: n.name });
    } else begin();
    const pts = n.geo.pts;
    if (pts.length >= 2 && G.v.dist(pts[0].p, p) < px(10)) {   /* 始点を押した＝閉じる */
      n.geo.closed = true; n.kind = 'shape'; n.fill = st.fill || st.stroke || '#888888'; n.stroke = null;
      if (/^線 /.test(n.name)) n.name = nameFor('形');
      const id = n.id; st.pen = null; commit('pen.close', [id], { pts: pts.length, fill: n.fill }); setTool('point'); return;
    }
    const q = { id: G.newId('p'), p: [G.r2(p[0]), G.r2(p[1])] }; if (!st.auto) q.corner = true;
    pts.push(q); st.psel = new Set([q.id]);
    drag = { k: 'pen', nid: n.id, pid: q.id, start: p }; draw();
  }

  cv.addEventListener('pointermove', e => {
    const s = evPos(e), p = toDoc(s);
    if (!drag) {
      if (st.tool === 'pen' && st.pen) { st.pen.cur = p; draw(); }
      if (st.tool === 'select' || st.tool === 'point') { const n = hitNode(p), id = n ? n.id : null; if (id !== hover) { hover = id; draw(); } }
      return;
    }
    tick();
    const d = [p[0] - (drag.start ? drag.start[0] : 0), p[1] - (drag.start ? drag.start[1] : 0)];
    if (drag.k === 'pan') { st.view.x = drag.v.x + s[0] - drag.s[0]; st.view.y = drag.v.y + s[1] - drag.s[1]; draw(); }
    else if (drag.k === 'under') { st.under.x = drag.u.x + p[0] - drag.p[0]; st.under.y = drag.u.y + p[1] - drag.p[1]; draw(); }
    else if (drag.k === 'move') {
      if (!drag.moved && Math.hypot(d[0], d[1]) < px(3)) return; drag.moved = true;
      if (e.shiftKey) { if (Math.abs(d[0]) > Math.abs(d[1])) d[1] = 0; else d[0] = 0; }
      restore(drag.orig, drag.ids); applyM([1, 0, 0, 1, d[0], d[1]], drag.ids); drag.M = [1, 0, 0, 1, r3(d[0]), r3(d[1])]; draw();
    }
    else if (drag.k === 'scale') {
      const h = drag.h, b = drag.box, a = e.altKey ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : h.a;
      let sx = Math.abs(h.p[0] - a[0]) > 1e-6 ? (p[0] - a[0]) / (h.p[0] - a[0]) : 1, sy = Math.abs(h.p[1] - a[1]) > 1e-6 ? (p[1] - a[1]) / (h.p[1] - a[1]) : 1;
      if (h.k === 'n' || h.k === 's') sx = e.shiftKey ? sy : 1; else if (h.k === 'e' || h.k === 'w') sy = e.shiftKey ? sx : 1;
      else if (e.shiftKey) { const u = Math.abs(sx) > Math.abs(sy) ? sx : sy; sx = sy = u; }
      const cl = v => (Math.abs(v) < 0.02 ? (v < 0 ? -0.02 : 0.02) : v); sx = cl(sx); sy = cl(sy);
      const M = [sx, 0, 0, sy, a[0] - sx * a[0], a[1] - sy * a[1]];
      restore(drag.orig, drag.ids); applyM(M, drag.ids); drag.M = M.map(r3); draw();
    }
    else if (drag.k === 'rot') {
      const c = drag.h.a; let ang = Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(drag.start[1] - c[1], drag.start[0] - c[0]);
      if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
      const co = Math.cos(ang), si = Math.sin(ang), M = [co, si, -si, co, c[0] - co * c[0] + si * c[1], c[1] - si * c[0] - co * c[1]];
      restore(drag.orig, drag.ids); applyM(M, drag.ids); drag.M = M.map(r3); drag.deg = G.r2(ang * 180 / Math.PI); draw();
    }
    else if (drag.k === 'marquee' || drag.k === 'pmarquee') {
      drag.cur = p; const x0 = Math.min(p[0], drag.start[0]), x1 = Math.max(p[0], drag.start[0]), y0 = Math.min(p[1], drag.start[1]), y1 = Math.max(p[1], drag.start[1]);
      if (drag.k === 'marquee') {
        const hs = G.hiddenSet(st.doc); st.sel = new Set(drag.base);
        if (x1 - x0 > px(3) || y1 - y0 > px(3)) for (const n of st.doc.nodes) { if (!usable(n, hs)) continue; const b = G.bbox(n); if (b && b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1) st.sel.add(n.id); }
      } else { st.psel = new Set(drag.base); for (const n of editables()) for (const q of n.geo.pts) if (q.p[0] >= x0 && q.p[0] <= x1 && q.p[1] >= y0 && q.p[1] <= y1) st.psel.add(q.id); }
      draw();
    }
    else if (drag.k === 'pts') {
      if (!drag.moved && Math.hypot(d[0], d[1]) < px(2)) return; drag.moved = true;
      if (e.shiftKey) { if (Math.abs(d[0]) > Math.abs(d[1])) d[1] = 0; else d[0] = 0; }
      for (const n of editables()) for (const q of n.geo.pts) if (drag.orig[q.id]) q.p = [G.r2(drag.orig[q.id][0] + d[0]), G.r2(drag.orig[q.id][1] + d[1])];
      drag.d = [G.r2(d[0]), G.r2(d[1])]; draw();
    }
    else if (drag.k === 'handle') {
      const n = byId(drag.nid), q = n && n.geo.pts.find(x => x.id === drag.pid); if (!q) return;
      const v = [G.r2(p[0] - q.p[0]), G.r2(p[1] - q.p[1])], os = drag.side === 'out' ? 'in' : 'out';
      q[drag.side] = v; drag.moved = true;
      if (e.altKey || drag.wasCorner) { q.corner = true; if (!q[os]) q[os] = drag.otherVec.map(G.r2); }
      else { delete q.corner; const L = G.v.len(drag.otherVec), u = G.v.norm(v); q[os] = [G.r2(-u[0] * L), G.r2(-u[1] * L)]; }
      draw();
    }
    else if (drag.k === 'pen') {
      const n = byId(drag.nid), q = n && n.geo.pts.find(x => x.id === drag.pid); if (!q) return;
      if (Math.hypot(d[0], d[1]) > px(4)) { delete q.corner; q.out = [G.r2(d[0]), G.r2(d[1])]; q.in = [G.r2(-d[0]), G.r2(-d[1])]; drag.moved = true; }
      draw();
    }
    else if (drag.k === 'shape') {
      if (Math.hypot(d[0], d[1]) < px(3) && !drag.id) return;
      if (!drag.id) {
        begin(); const names = { ellipse: '円', rect: '四角', capsule: '長丸' };
        const n = { id: G.newId('n'), name: nameFor(names[drag.t]), kind: 'shape', parent: null, visible: true, locked: false, xf: { pos: [0, 0], rot: 0 }, geo: null, fill: st.fill || '#888888', stroke: null };
        drag.id = n.id; n.geo = drag.t === 'ellipse' ? { t: 'ellipse', size: [1, 1] } : drag.t === 'rect' ? { t: 'rect', size: [1, 1], round: 0 } : { t: 'capsule', len: 1, w: 1 };
        addNode(n);
      }
      const n = byId(drag.id), a = drag.start;
      if (drag.t === 'capsule') {
        const L = Math.hypot(d[0], d[1]), w = Math.max(4, +$('capW').value || 90); let ang = Math.atan2(d[1], d[0]) * 180 / Math.PI;
        if (e.shiftKey) ang = Math.round(ang / 15) * 15;
        const r = ang * Math.PI / 180; n.xf = { pos: [G.r2(a[0] + Math.cos(r) * L / 2), G.r2(a[1] + Math.sin(r) * L / 2)], rot: G.r2(((ang % 180) + 180) % 180 > 90 ? ((ang % 180) + 180) % 180 - 180 : ((ang % 180) + 180) % 180) };
        n.geo.len = G.r2(L + w); n.geo.w = w;
      } else {
        let w = Math.abs(d[0]), h = Math.abs(d[1]); if (e.shiftKey) w = h = Math.max(w, h);
        const sx = d[0] < 0 ? -1 : 1, sy = d[1] < 0 ? -1 : 1;
        n.xf = { pos: [G.r2(a[0] + sx * w / 2), G.r2(a[1] + sy * h / 2)], rot: 0 }; n.geo.size = [G.r2(Math.max(1, w)), G.r2(Math.max(1, h))];
        if (drag.t === 'rect') n.geo.round = G.r2(Math.min(w, h) * 0.2);
      }
      draw();
    }
  });

  function up(e) {
    if (!drag) return; const d = drag; drag = null; tick();
    try { cv.releasePointerCapture(e.pointerId); } catch (x) { }
    if (d.k === 'pan') { cv.style.cursor = st.tool === 'hand' || st.space ? 'grab' : (st.tool === 'select' || st.tool === 'point') ? 'default' : 'crosshair'; return; }
    if (d.k === 'under') return;
    if (d.k === 'move') { if (d.moved) commit('prop.nudge', d.ids, { what: 'move', m: d.M }); else { cancel(); refresh(); } return; }
    if (d.k === 'scale') { commit('prop.nudge', d.ids, { what: 'scale', m: d.M }); return; }
    if (d.k === 'rot') { commit('prop.nudge', d.ids, { what: 'rotate', deg: d.deg, m: d.M }); return; }
    if (d.k === 'marquee' || d.k === 'pmarquee') { refresh(); return; }
    if (d.k === 'pts') { if (d.moved) commit('pt.nudge', Object.keys(d.orig), { d: d.d }); else { cancel(); refresh(); } return; }
    if (d.k === 'handle') { const n = byId(d.nid), q = n && n.geo.pts.find(x => x.id === d.pid); commit('pt.handle', [d.nid], q ? { pt: d.pid, side: d.side, in: q.in || null, out: q.out || null, corner: !!q.corner } : {}); return; }
    if (d.k === 'pen') { const n = byId(d.nid), q = n && n.geo.pts.find(x => x.id === d.pid); commit('pt.add', [d.nid], q ? { pt: q.id, p: q.p, out: q.out || null, corner: !!q.corner, via: 'pen' } : {}); return; }
    if (d.k === 'shape') { if (d.id) { const n = byId(d.id); commit('node.add', [d.id], { via: d.t, name: n.name, geo: clone(n.geo), xf: clone(n.xf), fill: n.fill }); setTool('select'); } return; }
  }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (hover) { hover = null; draw(); } });

  cv.addEventListener('dblclick', e => {
    const p = toDoc(evPos(e));
    if (st.tool === 'pen') { penEnd(); return; }
    if (st.tool === 'select') { const n = hitNode(p); if (n) { st.sel = new Set([n.id]); if (G.isPrim(n)) { toast('図形は、右の「自由な形に変える」を押すと点を直せます'); refresh(); } else setTool('point'); } return; }
    if (st.tool === 'point') {
      const hp = hitPoint(p); if (!hp || ro()) return;
      begin(); if (hp.q.corner) { delete hp.q.corner; delete hp.q.in; delete hp.q.out; } else { hp.q.corner = true; delete hp.q.in; delete hp.q.out; }
      commit('pt.corner', [hp.n.id], { pt: hp.q.id, corner: !!hp.q.corner });
    }
  });

  /* 拡大・縮小・画面の移動 */
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const s = evPos(e);
    if (st.under.move && st.under.img && (e.ctrlKey || e.metaKey)) { const u = st.under, p = toDoc(s), f = Math.exp(-Math.max(-40, Math.min(40, e.deltaY)) * 0.01); u.x = p[0] - (p[0] - u.x) * f; u.y = p[1] - (p[1] - u.y) * f; u.s *= f; $('uS').value = u.s; draw(); return; }
    if (e.ctrlKey || e.metaKey || st.wheelZoom) zoomAt(s[0], s[1], Math.exp(-Math.max(-40, Math.min(40, e.deltaY)) * 0.012));
    else { st.view.x -= e.deltaX; st.view.y -= e.deltaY; draw(); }
  }, { passive: false });
  let gs = 1;
  cv.addEventListener('gesturestart', e => { e.preventDefault(); gs = st.view.s; });
  cv.addEventListener('gesturechange', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, (gs * e.scale) / st.view.s); });

  /* ---------- 部品への操作 ---------- */
  function delSel() {
    if (st.tool === 'point' && st.psel.size) return delPts();
    const sn = selNodes(); if (!sn.length) return; begin(); const ids = sn.map(n => n.id), S = new Set(ids);
    st.doc.nodes = st.doc.nodes.filter(n => !S.has(n.id)); dropEmptyGroups(); st.sel.clear(); st.psel.clear(); commit('node.remove', ids);
  }
  function dropEmptyGroups() { let ch = true; while (ch) { ch = false; for (const g of st.doc.nodes.filter(n => n.kind === 'group')) if (!kids(g.id).length) { st.doc.nodes = st.doc.nodes.filter(n => n !== g); ch = true; } } }
  function delPts() {
    begin(); const rm = [];
    for (const n of editables()) { const before = n.geo.pts.length; n.geo.pts = n.geo.pts.filter(q => { if (st.psel.has(q.id)) { rm.push(q.id); return false; } return true; }); if (before !== n.geo.pts.length && n.geo.pts.length < (n.geo.closed ? 3 : 2)) { st.doc.nodes = st.doc.nodes.filter(x => x !== n); st.sel.delete(n.id); } }
    dropEmptyGroups(); st.psel.clear(); commit('pt.remove', rm);
  }
  function copyNodes(src, M, suffix) {
    const out = [];
    for (const n of src) { const c = clone(n); c.id = G.newId('n'); c.name = n.name + (suffix || ' の写し'); if (c.geo.t === 'path') c.geo.pts.forEach(q => q.id = G.newId('p')); if (M) G.transformNode(c, M); out.push(c); }
    return out;
  }
  function insertCopies(src, copies) {  /* 写しは、元のすぐ上（手前）に入れる。グループの中なら同じグループ */
    src.forEach((n, k) => { const i = st.doc.nodes.indexOf(n); st.doc.nodes.splice(i + 1, 0, copies[k]); });
    st.sel = new Set(copies.map(c => c.id)); st.psel.clear();
  }
  function dup() { const sn = selNodes(); if (!sn.length) return; begin(); const cs = copyNodes(sn, [1, 0, 0, 1, 20, 20]); insertCopies(sn, cs); commit('node.add', cs.map(c => c.id), { via: 'duplicate', from: sn.map(n => n.id), m: [1, 0, 0, 1, 20, 20] }); }
  function copy() { const sn = selNodes(); if (!sn.length) return; st.clip = clone(sn); st.pasteN = 0; toast(sn.length + '個の部品をコピーしました'); }
  function paste() {
    if (!st.clip || !st.clip.length) return; begin(); st.pasteN++; const o = 20 * st.pasteN;
    const cs = copyNodes(st.clip, [1, 0, 0, 1, o, o]); cs.forEach(c => { c.parent = null; st.doc.nodes.push(c); }); st.sel = new Set(cs.map(c => c.id)); st.psel.clear();
    commit('node.add', cs.map(c => c.id), { via: 'paste', m: [1, 0, 0, 1, o, o] });
  }
  function flip(axis, asCopy) {
    const sn = selNodes(); if (!sn.length) return; const b = G.bboxOf(sn); if (!b) return; begin();
    if (asCopy) { const ax = b[2] + 20, M = [-1, 0, 0, 1, 2 * ax, 0]; const cs = copyNodes(sn, M, '（反転）'); insertCopies(sn, cs); commit('node.add', cs.map(c => c.id), { via: 'mirror-copy', from: sn.map(n => n.id), m: M }); return; }
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, M = axis === 'h' ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy];
    const ids = sn.map(n => n.id); applyM(M, ids); commit('prop.nudge', ids, { what: axis === 'h' ? 'flip-h' : 'flip-v', m: M });
  }
  function seisho() {
    const sn = selNodes(); if (!sn.length) return; begin(); const tol = +$('seiTol').value, res = [];
    for (const n of sn) {
      const before = G.ptCount(n), pts = G.seisho(n, tol); if (!pts || pts.length < 2) continue;
      if (pts.length >= before) continue;
      const closed = G.isPrim(n) ? true : !!n.geo.closed; n.geo = { t: 'path', pts, closed }; delete n.xf; res.push({ id: n.id, before, after: pts.length });
    }
    st.psel.clear();
    if (commit('seisho', res.map(r => r.id), { tol, res })) toast('清書：' + res.map(r => r.before + '点 → ' + r.after + '点').join('、') + '（形が変わりすぎたら ⌘Z で戻して、強さを下げる）');
    else toast('これより減らせませんでした（強さを上げると、もっと減ります）');
  }
  function toPath() { const sn = selNodes().filter(G.isPrim); if (!sn.length) return; begin(); sn.forEach(n => G.toPath(n)); if (commit('convert', sn.map(n => n.id), { to: 'path' })) setTool('point'); }
  function setColor(c) {
    if (st.target === 'fill') st.fill = c; else st.stroke = c;
    const sn = selNodes();
    if (sn.length) {
      begin();
      for (const n of sn) {
        if (st.target === 'fill') { if (G.isOpen(n)) { if (c && n.stroke) n.stroke.c = c; } else n.fill = c; }
        else { if (c) { if (n.stroke) n.stroke.c = c; else n.stroke = { c, w: st.sw, cap: st.cap }; } else if (!G.isOpen(n)) n.stroke = null; }
        if (!n.fill && !n.stroke) n.stroke = { c: '#333333', w: 2, cap: 'round' };
      }
      commit('prop.set', sn.map(n => n.id), { path: st.target === 'fill' ? 'fill' : 'stroke.c', value: c });
    }
    renderProps();
  }
  let swG = false;
  function setSw(w, done) {
    w = Math.max(0.5, +w || 1); st.sw = w; $('sw').value = w; if (document.activeElement !== $('swN')) $('swN').value = w;
    const sn = selNodes().filter(n => n.stroke); if (!sn.length) return;
    if (!swG) { begin(); swG = true; } sn.forEach(n => n.stroke.w = w); draw();
    if (done) { swG = false; commit('prop.set', sn.map(n => n.id), { path: 'stroke.w', value: w }); }
  }
  function ptOp(kind) {
    const es = editables(); if (!st.psel.size) return; begin(); const ids = [];
    for (const n of es) for (const q of n.geo.pts) if (st.psel.has(q.id)) { ids.push(q.id); if (kind === 'smooth') { delete q.corner; delete q.in; delete q.out; } else if (kind === 'corner') { q.corner = true; delete q.in; delete q.out; } else { delete q.in; delete q.out; } }
    commit(kind === 'auto' ? 'pt.handle' : 'pt.corner', ids, { op: kind });
  }
  /* 重なり順 */
  function reorder(dir) {
    const sn = selNodes(); if (!sn.length) return; begin();
    const N = st.doc.nodes, par = sn[0].parent || null, same = sn.every(n => (n.parent || null) === par);
    const inGroup = same && par && kids(par).filter(k => k.kind !== 'group').length > sn.length;
    /* 並べる単位：グループの中なら兄弟、そうでなければ、いちばん外のまとまり */
    let units, isSel, head = [], tail = [];
    if (inGroup) {
      const ks = N.filter(n => n.parent === par), i0 = N.indexOf(ks[0]); head = N.slice(0, i0); tail = N.slice(i0 + ks.length);
      units = ks.map(k => [k]); isSel = u => st.sel.has(u[0].id);
    } else {
      units = []; const seen = new Set();
      for (const n of N) { const t = topOf(n); if (seen.has(t.id)) continue; seen.add(t.id); units.push(t.kind === 'group' ? N.filter(x => topOf(x) === t) : [t]); }
      isSel = u => u.some(x => st.sel.has(x.id));
    }
    const L = units.length;
    if (dir === 'top' || dir === 'bottom') { const a = units.filter(isSel), b = units.filter(u => !isSel(u)); units = dir === 'top' ? b.concat(a) : a.concat(b); }
    else if (dir === 'up') { for (let i = L - 2; i >= 0; i--) if (isSel(units[i]) && !isSel(units[i + 1])) { const t = units[i]; units[i] = units[i + 1]; units[i + 1] = t; } }
    else { for (let i = 1; i < L; i++) if (isSel(units[i]) && !isSel(units[i - 1])) { const t = units[i]; units[i] = units[i - 1]; units[i - 1] = t; } }
    st.doc.nodes = head.concat([].concat(...units), tail);
    commit('node.move', sn.map(n => n.id), { dir, order: st.doc.nodes.map(n => n.id) });
  }
  function group() {
    const sn = selNodes(); if (sn.length < 2) { toast('2つ以上の部品を選んでから押します（⇧ を押しながら押すと足せます）'); return; } begin();
    const g = { id: G.newId('g'), name: nameFor('グループ'), kind: 'group', parent: null, visible: true, locked: false };
    const S = new Set(sn.map(n => n.id)), topIdx = Math.max(...sn.map(n => st.doc.nodes.indexOf(n))), anchor = st.doc.nodes[topIdx];
    sn.forEach(n => n.parent = g.id);
    let rest = st.doc.nodes.filter(n => !S.has(n.id)); const at = rest.indexOf(anchor);
    /* anchor は選んだ物なので rest に無い。元の並びで、anchor より下にあった物の数を数える */
    const below = st.doc.nodes.slice(0, topIdx).filter(n => !S.has(n.id)).length;
    rest.splice(below, 0, ...sn, g); st.doc.nodes = rest; dropEmptyGroups(); void at;
    commit('node.add', [g.id], { via: 'group', name: g.name, children: sn.map(n => n.id) });
  }
  function ungroup() {
    const gs = new Set(); selNodes().forEach(n => { if (n.parent) gs.add(n.parent); }); if (!gs.size) return; begin();
    for (const gid of gs) { const g = byId(gid); kids(gid).forEach(k => k.parent = g.parent || null); st.doc.nodes = st.doc.nodes.filter(n => n.id !== gid); }
    commit('node.remove', [...gs], { via: 'ungroup' });
  }
  function nudge(dx, dy) {
    if (st.tool === 'point' && st.psel.size) { begin(); const ids = []; for (const n of editables()) for (const q of n.geo.pts) if (st.psel.has(q.id)) { q.p = [q.p[0] + dx, q.p[1] + dy]; ids.push(q.id); } commit('pt.nudge', ids, { d: [dx, dy] }); return; }
    const sn = selNodes(); if (!sn.length) return; begin(); const ids = sn.map(n => n.id); applyM([1, 0, 0, 1, dx, dy], ids); commit('prop.nudge', ids, { what: 'move', m: [1, 0, 0, 1, dx, dy] });
  }

  /* ---------- ファイル ---------- */
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  const jsonBlob = o => new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' });
  const modeFile = { h: 'hito', s: 'shitagumi_hito', a: 'ai_only' };
  function pngBlob(doc, scale, cb) { const c = document.createElement('canvas'); c.width = doc.w * (scale || 1); c.height = doc.h * (scale || 1); const x = c.getContext('2d'); x.scale(scale || 1, scale || 1); G.draw(x, doc); c.toBlob(cb, 'image/png'); return c; }
  function loadFile(f) {
    const r = new FileReader(); r.onload = () => {
      let d; try { d = JSON.parse(r.result); } catch (e) { toast('読めませんでした（JSON ではありません）'); return; }
      if (d && d.kind === 'lab-p4-eval' && d.docs) d = d.docs[st.mode];
      if (!G.validDoc(d)) { toast('この画面の絵のファイルではありません'); return; }
      if (ro()) { toast('③ は見るだけです。① か ② に切りかえてから読みこみます'); return; }
      begin(); st.doc = d; st.sel.clear(); st.psel.clear(); st.pen = null; commit('doc.load', [], { name: f.name, parts: d.nodes.length }); fit(); toast('読みこみました（⌘Z で元に戻せます）');
    }; r.readAsText(f);
  }
  function setUnder(img) { const u = st.under, s = Math.min(st.doc.w / img.width, st.doc.h / img.height); u.img = img; u.s = s; u.x = (st.doc.w - img.width * s) / 2; u.y = (st.doc.h - img.height * s) / 2; $('uS').value = s; draw(); toast('下敷きを置きました。位置は「下敷きを動かす」、大きさは「大きさ」で合わせます'); }
  function underFromBlob(b) { const img = new Image(); img.onload = () => setUnder(img); img.onerror = () => toast('画像を読めませんでした'); img.src = URL.createObjectURL(b); }

  /* ---------- 作り方の切りかえ ---------- */
  function setMode(m, quiet) {
    if (st.doc) { penEnd(); cancel(); saveNow(); }
    st.mode = m; st.doc = loadDoc(m); st.sel.clear(); st.psel.clear(); st.pen = null; hover = null; drag = null;
    if (m === 'a' && (st.tool !== 'select' && st.tool !== 'point' && st.tool !== 'hand')) st.tool = 'select';
    lastAct = 0; if (!quiet) saveNow(); refresh(); fit();
  }
  function resetMode() {
    if (ro()) { toast('③ は見るだけなので、やり直す物がありません'); return; }
    if (!confirm(MODES[st.mode] + ' を最初からやり直しますか？\n今の絵・時間・操作の記録が消えます（ほかの作り方は消えません）。')) return;
    st.doc = freshDoc(st.mode); st.undo[st.mode] = []; st.redo[st.mode] = []; st.logs[st.mode] = []; st.time[st.mode] = 0; st.sel.clear(); st.psel.clear(); st.pen = null; snap = null; saveNow(); refresh(); fit();
  }

  /* ---------- つなぐ ---------- */
  function initUI() {
    $('pal').innerHTML = GOAL.palette.map(c => '<button data-c="' + c.c + '" title="' + esc(c.name) + '" style="background:' + c.c + '"></button>').join('');
    $('pal').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { tick(); setColor(b.dataset.c); } });
    $('colFree').addEventListener('change', e => setColor(e.target.value));
    $('bColNone').onclick = () => setColor(null);
    $('colTarget').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { st.target = b.dataset.t; renderProps(); } });
    $('sw').addEventListener('input', e => setSw(e.target.value, false)); $('sw').addEventListener('change', e => setSw(e.target.value, true));
    $('swN').addEventListener('change', e => setSw(e.target.value, true));
    $('cCap').addEventListener('change', e => { st.cap = e.target.checked ? 'round' : 'butt'; const sn = selNodes().filter(n => n.stroke); if (sn.length) { begin(); sn.forEach(n => n.stroke.cap = st.cap); commit('prop.set', sn.map(n => n.id), { path: 'stroke.cap', value: st.cap }); } });
    $('cAuto').addEventListener('change', e => { st.auto = e.target.checked; save(); });
    $('cWheel').addEventListener('change', e => { st.wheelZoom = e.target.checked; save(); });
    $('capW').addEventListener('change', save);
    $('cFillOn').addEventListener('change', e => { const sn = selNodes().filter(n => !G.isOpen(n)); if (!sn.length) return; begin(); sn.forEach(n => { n.fill = e.target.checked ? (st.fill || '#888888') : null; if (!n.fill && !n.stroke) n.stroke = { c: st.stroke || '#333333', w: st.sw, cap: st.cap }; }); commit('prop.set', sn.map(n => n.id), { path: 'fill', value: e.target.checked ? st.fill : null }); });
    $('cStrokeOn').addEventListener('change', e => { const sn = selNodes().filter(n => !G.isOpen(n)); if (!sn.length) return; begin(); sn.forEach(n => { n.stroke = e.target.checked ? { c: st.stroke || '#333333', w: st.sw, cap: st.cap } : null; if (!n.fill && !n.stroke) n.fill = st.fill || '#888888'; }); commit('prop.set', sn.map(n => n.id), { path: 'stroke', value: e.target.checked ? { c: st.stroke, w: st.sw } : null }); });
    for (const id of ['pX', 'pY', 'pW', 'pH', 'pR', 'pRot']) $(id).addEventListener('change', () => {
      const sn = selNodes(), n = sn.length === 1 && G.isPrim(sn[0]) ? sn[0] : null; if (!n) return; begin();
      const num = (k, d) => { const v = parseFloat($(k).value); return isFinite(v) ? v : d; };
      n.xf.pos = [num('pX', n.xf.pos[0]), num('pY', n.xf.pos[1])]; n.xf.rot = num('pRot', n.xf.rot || 0);
      if (n.geo.t === 'capsule') { n.geo.len = Math.max(1, num('pW', n.geo.len)); n.geo.w = Math.max(1, num('pH', n.geo.w)); }
      else { n.geo.size = [Math.max(1, num('pW', n.geo.size[0])), Math.max(1, num('pH', n.geo.size[1]))]; if (n.geo.t === 'rect') n.geo.round = Math.max(0, num('pR', n.geo.round || 0)); }
      commit('prop.set', [n.id], { path: 'geo+xf', value: { geo: clone(n.geo), xf: clone(n.xf) } });
    });
    const B = { bToPath: toPath, bSmooth: () => ptOp('smooth'), bCorner: () => ptOp('corner'), bAutoH: () => ptOp('auto'), bDelPt: delPts, bDup: dup, bCopy: copy, bPaste: paste, bDel: delSel,
      bFlipH: () => flip('h'), bFlipV: () => flip('v'), bMirror: () => flip('h', true), bSeisho: seisho, bUp: () => reorder('up'), bDown: () => reorder('down'), bTop: () => reorder('top'), bBottom: () => reorder('bottom'),
      bGroup: group, bUngroup: ungroup, bUndo: undo, bRedo: redo, bFit: fit, bZoomIn: () => { const r = cv.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); }, bZoomOut: () => { const r = cv.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 0.8); },
      bSaveFile: () => { download('p4_' + modeFile[st.mode] + '.json', jsonBlob(st.doc)); closeMenu(); }, bLoadFile: () => { $('fDoc').click(); closeMenu(); },
      bPng: () => { pngBlob(st.doc, 1, b => download('p4_' + modeFile[st.mode] + '.png', b)); closeMenu(); },
      bLog: () => { download('p4_操作の記録_' + modeFile[st.mode] + '.json', jsonBlob({ kind: 'lab-p4-log', v: 1, mode: st.mode, at: new Date().toISOString(), activeMs: Math.round(st.time[st.mode]), ops: st.logs[st.mode] })); closeMenu(); },
      bReset: () => { closeMenu(); resetMode(); }, bGoal: showGoal, bCompare: () => { penEnd(); saveNow(); window.P4Compare && window.P4Compare.open(); },
      bUnder: () => $('fUnder').click(), bUnderMove: () => { if (!st.under.img) { toast('先に「画像を選ぶ」で下敷きを置きます'); return; } st.under.move = !st.under.move; renderProps(); }, bUnderOff: () => { st.under.img = null; st.under.move = false; refresh(); }
    };
    for (const k in B) $(k).addEventListener('click', e => { tick(); B[k](e); });
    function closeMenu() { $('fileMenu').open = false; }
    $('fDoc').addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; });
    $('fUnder').addEventListener('change', e => { if (e.target.files[0]) underFromBlob(e.target.files[0]); e.target.value = ''; });
    $('uA').addEventListener('input', e => { st.under.a = +e.target.value; draw(); });
    $('uS').addEventListener('input', e => { const u = st.under; if (!u.img) return; const ns = +e.target.value, cx = u.x + u.img.width * u.s / 2, cy = u.y + u.img.height * u.s / 2; u.s = ns; u.x = cx - u.img.width * ns / 2; u.y = cy - u.img.height * ns / 2; draw(); });
    $('cSee').addEventListener('change', e => { st.see = e.target.checked; draw(); });
    $('cGhost').addEventListener('change', e => { st.ghost = e.target.checked; draw(); });
    $('tools').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { tick(); setTool(b.dataset.tool); } });
    $('modes').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.mode !== st.mode) setMode(b.dataset.mode); });
    /* 一覧 */
    const list = $('list');
    list.addEventListener('click', e => {
      const it = e.target.closest('.it'); if (!it || e.target.tagName === 'INPUT') return; tick(); const n = byId(it.dataset.id); if (!n) return;
      const act = e.target.dataset.act;
      if (act === 'eye') { begin(); n.visible = n.visible === false; commit('prop.set', [n.id], { path: 'visible', value: n.visible }); return; }
      if (act === 'lock') { begin(); n.locked = !n.locked; if (n.locked) leavesOf(n).forEach(x => st.sel.delete(x.id)); commit('prop.set', [n.id], { path: 'locked', value: n.locked }); return; }
      const tg = leavesOf(n).map(x => x.id);
      if (e.shiftKey || e.metaKey || e.ctrlKey) { const all = tg.every(i => st.sel.has(i)); tg.forEach(i => all ? st.sel.delete(i) : st.sel.add(i)); } else st.sel = new Set(tg);
      st.psel.clear(); refresh();
    });
    list.addEventListener('dblclick', e => {
      const nm = e.target.closest('.nm'), it = e.target.closest('.it'); if (!nm || !it || nm.querySelector('input')) return; const n = byId(it.dataset.id); if (!n || ro()) return;
      const inp = document.createElement('input'); inp.value = n.name || ''; nm.textContent = ''; nm.appendChild(inp); inp.focus(); inp.select();
      let done = false; const fin = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v && v !== n.name) { begin(); const m = byId(it.dataset.id); m.name = v; commit('node.rename', [m.id], { name: v }); } else renderList(); };
      inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') fin(true); if (ev.key === 'Escape') fin(false); }); inp.addEventListener('blur', () => fin(true));
    });
    $('side').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === 'Escape') && e.target.tagName === 'INPUT' && !e.target.closest('#list')) e.target.blur(); });
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#top button,#tools button,#side button,#bottom button'); if (b) b.blur(); });
    document.querySelectorAll('.dlg').forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.dataset.close != null) d.hidden = true; }));
    document.addEventListener('click', e => { if (!$('fileMenu').contains(e.target)) $('fileMenu').open = false; });
  }
  function showGoal() {
    $('goalBody').innerHTML = '<h2>目標：' + esc(GOAL.subject) + '</h2><p>' + esc(GOAL.note) + '<br>画面の大きさ ' + GOAL.w + '×' + GOAL.h + '・背景 ' + GOAL.bg + '。<b>ほかの人のイラストをなぞる物にはしません。</b>実物の写真を見て、自分の絵として描きます。</p>' +
      '<p class="pal">' + GOAL.palette.map(c => '<span><i style="background:' + c.c + '"></i>' + esc(c.name) + '</span>').join('') + '</p>' +
      '<ol>' + GOAL.items.map(i => '<li><b>' + esc(i.title) + '</b><br><span class="note">' + esc(i.how) + '</span></li>').join('') + '</ol>';
    $('goalDlg').hidden = false;
  }

  function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'range' && t.type !== 'color' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  document.addEventListener('keydown', e => {
    if (!$('cmp').hidden) return; if (typing(e)) return;
    tick(); const cmd = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (e.key === ' ') { if (!st.space) { st.space = true; cv.style.cursor = 'grab'; } e.preventDefault(); return; }
    if (cmd) {
      if (k === 'z') { e.preventDefault(); if (st.pen) { const id = st.pen.id; e.shiftKey ? redo() : undo(); if (!byId(id)) st.pen = null; } else e.shiftKey ? redo() : undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 'c') { copy(); return; }
      if (k === 'x') { copy(); delSel(); return; }
      if (k === 'd') { e.preventDefault(); dup(); return; }
      if (k === 'g') { e.preventDefault(); e.shiftKey ? ungroup() : group(); return; }
      if (k === 'a') { e.preventDefault(); if (st.tool === 'point' && editables().length) { st.psel = new Set(); editables().forEach(n => n.geo.pts.forEach(q => st.psel.add(q.id))); } else { const hs = G.hiddenSet(st.doc); st.sel = new Set(st.doc.nodes.filter(n => usable(n, hs)).map(n => n.id)); } refresh(); return; }
      if (k === 's') { e.preventDefault(); $('bSaveFile').click(); return; }
      if (k === '=' || k === '+') { e.preventDefault(); $('bZoomIn').click(); return; }
      if (k === '-') { e.preventDefault(); $('bZoomOut').click(); return; }
      if (k === '0') { e.preventDefault(); fit(); return; }
      return;
    }
    if (e.key === 'Enter' || e.key === 'Escape') { if (st.pen) { penEnd(); return; } if (e.key === 'Escape') { if (st.psel.size) st.psel.clear(); else st.sel.clear(); refresh(); } return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); if (st.pen) { /* ペンの途中：最後の点を消す */ const n = byId(st.pen.id); if (n && n.geo.pts.length > 1) { begin(); const q = n.geo.pts.pop(); commit('pt.remove', [q.id], { via: 'pen' }); } else penEnd(); return; } delSel(); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); const m = e.shiftKey ? 10 : 1; nudge(arrows[e.key][0] * m, arrows[e.key][1] * m); return; }
    const tk = { v: 'select', a: 'point', p: 'pen', o: 'ellipse', r: 'rect', l: 'capsule', h: 'hand' };
    if (tk[k]) { setTool(tk[k]); return; }
    if (e.key === ']') reorder('up'); else if (e.key === '[') reorder('down');
    else if (e.key === '+' || e.key === '=') $('bZoomIn').click(); else if (e.key === '-') $('bZoomOut').click(); else if (e.key === '0') fit();
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { st.space = false; if (!drag) cv.style.cursor = st.tool === 'hand' ? 'grab' : (st.tool === 'select' || st.tool === 'point') ? 'default' : 'crosshair'; } });
  document.addEventListener('paste', e => {
    if (!$('cmp').hidden || typing(e)) return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) if (it.type && it.type.indexOf('image/') === 0) { const b = it.getAsFile(); if (b) { e.preventDefault(); underFromBlob(b); return; } }
    paste();
  });
  window.addEventListener('resize', resize);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  /* ---------- 始める ---------- */
  function start() {
    st.time = Object.assign({ h: 0, s: 0, a: 0 }, lsGet('time', {}));
    st.logs.h = lsGet('log:h', []); st.logs.s = lsGet('log:s', []);
    const ui = lsGet('ui', {}); st.auto = !!ui.auto; st.wheelZoom = !!ui.wheelZoom; $('cAuto').checked = st.auto; $('cWheel').checked = st.wheelZoom; if (ui.capW) $('capW').value = ui.capW;
    initUI();
    const m = /[?#&]mode=([hsa])/.exec(location.search + location.hash);
    st.mode = m ? m[1] : (ui.mode in MODES ? ui.mode : 'h'); st.doc = loadDoc(st.mode);
    resize(); refresh(); fit(); setTimeout(() => { resize(); fit(); }, 60);
    if (!AI.shitagumi) toast('AI の下組み（ai/data.js）が読めませんでした');
  }

  window.P4App = {
    st, G, fit, refresh, setMode, setTool, toast, download, jsonBlob, fmtTime, esc, saveNow, diffFromBase,
    docs: () => ({ h: st.mode === 'h' ? st.doc : loadDoc('h'), s: st.mode === 's' ? st.doc : loadDoc('s'), a: freshDoc('a') }),
    pngDataURL: (doc, scale, points) => { const c = document.createElement('canvas'), k = scale || 1; c.width = doc.w * k; c.height = doc.h * k; const x = c.getContext('2d'); x.scale(k, k); G.draw(x, doc); if (points) G.drawPoints(x, doc, k); return c.toDataURL('image/png'); },
    lsGet, lsSet
  };
  start();
})();
