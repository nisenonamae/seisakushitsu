/* lab/e2 tools/page.js — 裏のブラウザで絵を描く（描き方は lab/p4/geom.js の G.draw そのまま）。
   影絵の決まり：地面の影（塗りが #BCD3A2 か、名前に「地面の影」）を外し、残りの部品を全部 DARK で塗る・線も DARK。 */
(function () {
  const G = window.P4G, DARK = '#2F2734', SHADOW = '#bcd3a2';
  const isShadow = n => (n.fill && String(n.fill).toLowerCase() === SHADOW) || /地面の影/.test(n.name || '');
  function silDoc(doc) {
    const d = JSON.parse(JSON.stringify(doc)); d.bg = '#ffffff';
    d.nodes = d.nodes.filter(n => n.kind === 'group' || !isShadow(n));
    for (const n of d.nodes) { if (n.kind === 'group' || !n.geo) continue; if (n.fill) n.fill = DARK; if (n.stroke) n.stroke.c = DARK; }
    return d;
  }
  function canvas(doc, scale) { const c = document.createElement('canvas'); c.width = Math.round(doc.w * scale); c.height = Math.round(doc.h * scale); const x = c.getContext('2d'); x.scale(scale, scale); return [c, x]; }
  window.E2 = {
    silDoc,
    render(doc, mode, scale) {
      scale = scale || 1;
      if (mode === 'sil') doc = silDoc(doc);
      const [c, x] = canvas(doc, scale);
      if (mode === 'points') { G.draw(x, doc, { alpha: 0.35 }); G.drawPoints(x, doc, scale, '#0a50d0'); }
      else G.draw(x, doc);
      return c.toDataURL('image/png');
    },
    stats(doc) {
      const s = G.stats(doc), cols = new Set();
      for (const n of doc.nodes) { if (n.kind === 'group' || !n.geo) continue; if (n.fill && !G.isOpen(n)) cols.add(String(n.fill).toLowerCase()); if (n.stroke && n.stroke.w > 0) cols.add(String(n.stroke.c).toLowerCase()); }
      return { parts: s.parts, groups: s.groups, points: s.points, maxPts: s.maxPts, maxName: s.maxName, over12: s.over12, over8: s.over8, lines: s.lines, prims: s.prims, avg: s.avg, colors: cols.size, per: s.per };
    },
    bbox(doc, ids) { return G.bboxOf(doc.nodes.filter(n => ids.includes(n.id))); },
    /* ids の部品を、pivot のまわりに deg 度回した写しを返す */
    rotated(doc, ids, pivot, deg) {
      const d = JSON.parse(JSON.stringify(doc)), r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      const M = [c, s, -s, c, pivot[0] - c * pivot[0] + s * pivot[1], pivot[1] - s * pivot[0] - c * pivot[1]];
      for (const n of d.nodes) if (ids.includes(n.id) && n.geo) { const sw = n.stroke ? n.stroke.w : null; G.transformNode(n, M); if (n.stroke) n.stroke.w = sw; }
      return d;
    }
  };
})();
