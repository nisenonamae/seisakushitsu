// 全体の決まり（9.3節⑥）：切れた参照・親子の輪・参照の輪・id の重なり。破れていたら、その一覧を返す。
import { getNode, slotsOf, slotType, refsOf, MODES, PERM_VALUES } from './model.js';
import { isRank } from './util.js';

/** @returns {string[]} 破れている決まり（空なら合格） */
export function checkInvariants(doc) {
  const bad = []; const nodes = doc.nodes; const ids = Object.keys(nodes);
  const edges = new Map(); // 値の置き場 → 参照している置き場
  for (const id of ids) {
    const n = nodes[id];
    if (n.id !== id) bad.push(`部品 ${id}：id が合わない`);
    if (!Object.hasOwn(doc.scenes, n.scene)) bad.push(`部品 ${id}：場面 ${n.scene} がない`);
    if (!isRank(n.order)) bad.push(`部品 ${id}：順番の印`);
    if (n.parent != null) {
      const p = getNode(doc, n.parent);
      if (!p) bad.push(`部品 ${id}：親 ${n.parent} がない`);
      else { if (p.kind !== 'group') bad.push(`部品 ${id}：親がまとまりでない`); if (p.scene !== n.scene) bad.push(`部品 ${id}：親と場面が違う`); }
    }
    if (n.geo && n.geo.t === 'path') { const s = new Set(); for (const pt of n.geo.pts) { if (s.has(pt.id)) bad.push(`部品 ${id}：点 ${pt.id} が重なっている`); s.add(pt.id); } }
    for (const [segs, type, v] of slotsOf(n)) {
      if (!v || !['static', 'keys', 'expr', 'ref'].includes(v.k)) { bad.push(`部品 ${id}.${segs.join('.')}：値の札がない`); continue; }
      const vals = v.k === 'expr' && v.base ? [v, v.base] : [v];
      for (const x of vals) if (x.k === 'keys') { const s = new Set(); for (const k of x.keys) { if (s.has(k.id)) bad.push(`部品 ${id}.${segs.join('.')}：鍵 ${k.id} が重なっている`); s.add(k.id); } }
      const rs = refsOf(v); if (!rs.length) continue;
      const from = `${id}.${segs.join('.')}`; const tos = [];
      for (const r of rs) {
        const tn = getNode(doc, r.node); const tt = tn ? slotType(tn, r.path.split('.')) : null;
        if (!tt) { bad.push(`${from}：参照先 ${r.node}.${r.path} がない`); continue; }
        if (v.k === 'ref' && tt !== type) { bad.push(`${from}：参照先の型が違う`); continue; }
        tos.push(`${r.node}.${r.path}`);
      }
      edges.set(from, tos);
    }
  }
  // 親子の輪
  const state = new Map();
  for (const id of ids) {
    let cur = id; const path = [];
    while (cur != null && !state.has(cur)) { state.set(cur, 1); path.push(cur); const n = getNode(doc, cur); cur = n ? n.parent : null; }
    if (cur != null && state.get(cur) === 1) bad.push(`親子が輪になっている（${cur}）`);
    for (const x of path) state.set(x, 2);
  }
  // 参照の輪
  const st = new Map();
  for (const start of edges.keys()) {
    if (st.has(start)) continue;
    const stack = [[start, 0]]; st.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1]; const outs = edges.get(top[0]) || [];
      if (top[1] >= outs.length) { st.set(top[0], 2); stack.pop(); continue; }
      const nx = outs[top[1]++]; const s = st.get(nx);
      if (s === 1) { bad.push(`参照が輪になっている（${nx}）`); continue; }
      if (s === 2) continue;
      st.set(nx, 1); stack.push([nx, 0]);
    }
  }
  // 表紙
  const c = doc.cover; const lk = new Set();
  for (const l of c.locks) { if (lk.has(l.id)) bad.push(`固定 ${l.id} が重なっている`); lk.add(l.id); }
  for (const k of Object.keys(c.stages)) if (!MODES.includes(c.stages[k])) bad.push(`度合い ${k}`);
  for (const k of Object.keys(c.sceneModes)) if (!MODES.includes(c.sceneModes[k])) bad.push(`度合い ${k}`);
  for (const k of Object.keys(c.perms)) if (!PERM_VALUES.includes(c.perms[k])) bad.push(`許可 ${k}`);
  // 語り
  const ls = new Set(); const ts = new Set();
  for (const l of doc.script.lines) {
    if (ls.has(l.id)) bad.push(`行 ${l.id} が重なっている`); ls.add(l.id);
    for (const t of l.tokens) { if (ts.has(t.id)) bad.push(`トークン ${t.id} が重なっている`); ts.add(t.id); }
  }
  return bad;
}
