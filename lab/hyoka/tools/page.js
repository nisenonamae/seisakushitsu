/* （lab/e5/tools/page.js の写し。足した所：o.post＝絵ぜんたいに掛ける行列〔大きさと場所をそろえる〕。背景は先に全面を塗る）
   lab/e4 tools/page.js — 裏のブラウザで絵を描く（描き方は lab/p4/geom.js の G.draw のまま）。
   影絵の決まりは E2 と同じ：地面の影（塗りが #BCD3A2 か、名前に「地面の影」）を外し、残りを全部 DARK で描く。 */
(function () {
  const G = window.P4G, DARK = '#2F2734', SHADOW = '#bcd3a2';
  const isShadow = n => (n.fill && String(n.fill).toLowerCase() === SHADOW) || /地面の影/.test(n.name || '');
  function prep(doc, o) {
    const d = JSON.parse(JSON.stringify(doc));
    for (const t of (o.xf || [])) for (const n of d.nodes) if (t.ids.includes(n.id) && n.geo) { const sw = n.stroke ? n.stroke.w : null; G.transformNode(n, t.M); if (n.stroke) n.stroke.w = sw; }
    if (o.mode === 'sil') {
      d.bg = '#ffffff';
      d.nodes = d.nodes.filter(n => n.kind === 'group' || !isShadow(n));
      for (const n of d.nodes) { if (n.kind === 'group' || !n.geo) continue; if (n.fill) n.fill = DARK; if (n.stroke) n.stroke.c = DARK; }
    }
    if (o.only) d.nodes = d.nodes.filter(n => n.kind === 'group' || o.only.includes(n.id));
    if (o.except) d.nodes = d.nodes.filter(n => n.kind === 'group' || !o.except.includes(n.id));
    return d;
  }
  window.E4 = {
    /* o: {mode:'final'|'sil', only:[id], except:[id], xf:[{ids,M}], scale} */
    render(doc, o) {
      o = o || {}; const s = o.scale || 1, d = prep(doc, o);
      const c = document.createElement('canvas'); c.width = Math.round(d.w * s); c.height = Math.round(d.h * s);
      const x = c.getContext('2d'); x.scale(s, s);
      if (o.post) { x.fillStyle = d.bg || '#fff'; x.fillRect(0, 0, d.w, d.h); x.transform.apply(x, o.post); G.draw(x, d, { noBg: true }); }
      else G.draw(x, d);
      return c.toDataURL('image/png');
    },
    /* 部品ごとの、折れ線にした輪郭（割り方の版を作るときに使う） */
    flat(doc, per) {
      return doc.nodes.filter(n => n.kind !== 'group' && n.geo).map(n => {
        const o = G.outline(n);
        return { id: n.id, name: n.name, closed: !!o.closed, pts: G.flat(o.pts, o.closed, per || 32), fill: n.fill || null, stroke: n.stroke ? n.stroke.w : null, shadow: isShadow(n) };
      });
    }
  };
})();
