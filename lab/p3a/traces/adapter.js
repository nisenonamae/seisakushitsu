// 外から来た操作の記録を、核の命令の並びに直す所（読みこむ変換は、このファイル1つにまとめる）。
// 受ける形は2つ：
//  ① 'p3a-steps'    … この試作の素直な形（traces/README.md）
//  ② 'lab-p4-log'   … P4（曲線の画面）の「操作の記録」v1。P4 の記録には、核の命令に直すための情報が足りない操作がある
//                      （複製・貼り付け・清書・図形→自由な形のあとの点、など）。直せなかった操作は unmapped に理由つきで返す。
// 返す物：{ init, steps:[{ by:'human'|'ai', group?, proposal?, note?, ops:(doc)=>body[] | body[] }], unmapped:[{n,type,why}] }
//   ops が関数のときは、その時点の文書を見て命令を作る（P4 の記録は「点の id だけ」で、どの部品かを文書から探す必要があるため）。
import { rankBetween } from '../src/index.js';

const S = (v) => ({ k: 'static', v }); const hex = (c) => S({ k: 'hex', v: c });
const isHex = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

export function fromAny(raw, opt = {}) {
  if (raw && raw.format === 'p3a-steps') return { init: raw.init || { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai' } }, steps: raw.steps.map((s) => ({ ...s })), unmapped: [] };
  if (raw && raw.kind === 'lab-p4-log') return fromP4(raw, opt);
  throw new Error('知らない形の記録です（format:"p3a-steps" か kind:"lab-p4-log"）');
}

// ---- P4 の文書（lab-p4-doc）の部品 → 核の node.add の中身
function p4Geo(g) {
  if (g.t === 'path') return { t: 'path', closed: !!g.closed, pts: (g.pts || []).map(p4Pt) };
  if (g.t === 'ellipse') return { t: 'ellipse', size: S(g.size) };
  if (g.t === 'rect') return { t: 'rect', size: S(g.size), round: S(g.round || 0) };
  if (g.t === 'capsule') return { t: 'rect', size: S([g.len, g.w]), round: S(g.w / 2) }; // 長丸は、核の最小の形に無いので、角丸の四角で代える（数える用）
  throw new Error('形 ' + g.t);
}
function p4Pt(q) { const o = { id: q.id, p: S(q.p) }; if (q.in) o.in = S(q.in); if (q.out) o.out = S(q.out); if (q.corner) o.corner = true; return o; }
function p4Node(n, order) {
  const o = { id: n.id, scene: 's1', name: n.name || n.id, parent: n.parent || null, order };
  if (n.kind === 'group') return { ...o, kind: 'group' };
  const open = n.geo.t === 'path' && !n.geo.closed; const fill = isHex(n.fill) ? n.fill : null; const st = n.stroke && isHex(n.stroke.c) ? n.stroke : null;
  o.kind = open && !fill ? 'line' : 'shape'; o.geo = p4Geo(n.geo);
  if (n.xf) o.xf = { pos: S(n.xf.pos || [0, 0]), rot: S(n.xf.rot || 0) };
  if (fill) o.fill = { color: hex(fill) };
  if (st || o.kind === 'line') o.stroke = { color: hex(st ? st.c : '#333333'), w: S(st ? st.w : 2) };
  return o;
}
/** P4 の文書（AI の下組みなど）を、部品を足す命令の並びにする。まとまりを先に */
export function p4DocToAdds(doc) {
  const nodes = doc.nodes.slice().sort((a, b) => (a.kind === 'group' ? 0 : 1) - (b.kind === 'group' ? 0 : 1)); let prev = null;
  return nodes.map((n) => { prev = rankBetween(prev, null); return { type: 'node.add', node: p4Node(n, prev) }; });
}

/**
 * P4 の操作の記録を直す。
 * @param {{mode:'h'|'s'|'a', ops:any[]}} raw @param {{start?:any}} opt start＝始めの文書（②「AI の下組み＋人」なら下組みの lab-p4-doc）。AI の作業として入れる
 */
export function fromP4(raw, opt = {}) {
  const steps = []; const unmapped = [];
  // 取り消し・やり直しが、直せなかった操作に当たるときは流さない（流すと、1つ前の別の操作を取り消してしまう）
  const U = []; const R = [];
  const skip = (e, why) => { unmapped.push({ n: e.n, type: e.type, why }); U.push(false); R.length = 0; };
  if (opt.start) steps.push({ by: 'ai', group: 'p4-shitagumi', note: 'AI の下組み', ops: p4DocToAdds(opt.start) });
  const nodeOfPt = (doc, pid) => Object.values(doc.nodes).find((n) => n.geo && n.geo.t === 'path' && n.geo.pts.some((q) => q.id === pid));
  const last = (doc, parent) => Object.values(doc.nodes).filter((n) => (n.parent || null) === (parent || null)).map((n) => n.order).sort().pop() || null;
  for (const e of raw.ops || []) {
    const a = e.args || {}; const ids = e.ids || []; const step = (ops, extra) => { U.push(true); R.length = 0; steps.push({ by: 'human', note: `#${e.n} ${e.type}`, ...(ids.length > 1 || typeof ops === 'function' ? { group: `p4-${e.n}` } : {}), ops, ...extra }); };
    switch (e.type) {
      case 'node.add':
        if (a.geo) step((doc) => [{ type: 'node.add', node: p4Node({ id: ids[0], name: a.name, kind: 'shape', geo: a.geo, xf: a.xf, fill: a.fill, stroke: a.stroke }, rankBetween(last(doc, null), null)) }]);
        else if (a.via === 'group') step((doc) => { let r = last(doc, null); const g = rankBetween(r, null); let c = null;
          return [{ type: 'node.add', node: { id: ids[0], scene: 's1', kind: 'group', name: a.name || 'グループ', order: g } }, ...(a.children || []).filter((id) => doc.nodes[id]).map((id) => { c = rankBetween(c, null); return { type: 'node.move', node: id, parent: ids[0], order: c }; })]; });
        else skip(e, `部品の中身（形・点）が記録に無い（${a.via || '?'}）`);
        break;
      case 'node.remove':
        if (a.via === 'ungroup') step((doc) => ids.flatMap((g) => [...Object.values(doc.nodes).filter((n) => n.parent === g).map((n) => ({ type: 'node.move', node: n.id, parent: doc.nodes[g].parent, order: n.order })), { type: 'node.remove', node: g }]));
        else step((doc) => ids.filter((id) => doc.nodes[id]).map((id) => ({ type: 'node.remove', node: id })));
        break;
      case 'node.rename': step([{ type: 'node.rename', node: ids[0], name: String(a.name) }]); break;
      case 'node.move': step((doc) => { // 並びの順（下から上）→ あいだに挟める印に直す。動かした物だけ付け替える
        const moved = new Set(ids); const out = [];
        for (const id of ids) { const n = doc.nodes[id]; if (!n) continue; const sib = (a.order || []).filter((x) => doc.nodes[x] && (doc.nodes[x].parent || null) === (n.parent || null)); const i = sib.indexOf(id);
          let lo = null; for (let j = i - 1; j >= 0; j--) if (!moved.has(sib[j])) { lo = doc.nodes[sib[j]].order; break; }
          let hi = null; for (let j = i + 1; j < sib.length; j++) if (!moved.has(sib[j])) { hi = doc.nodes[sib[j]].order; break; }
          if (lo !== null && hi !== null && lo >= hi) hi = null;
          out.push({ type: 'node.move', node: id, parent: n.parent, order: rankBetween(lo, hi) }); }
        return out; }); break;
      case 'prop.set':
        if (a.path === 'fill' && isHex(a.value)) step((doc) => ids.filter((id) => doc.nodes[id] && doc.nodes[id].fill).map((id) => ({ type: 'prop.set', node: id, path: 'fill.color', value: hex(a.value) })));
        else if (a.path === 'stroke.c' && isHex(a.value)) step((doc) => ids.filter((id) => doc.nodes[id] && doc.nodes[id].stroke).map((id) => ({ type: 'prop.set', node: id, path: 'stroke.color', value: hex(a.value) })));
        else if (a.path === 'stroke.w') step((doc) => ids.filter((id) => doc.nodes[id] && doc.nodes[id].stroke).map((id) => ({ type: 'prop.set', node: id, path: 'stroke.w', value: S(a.value) })));
        else if (a.path === 'geo+xf' && a.value) step((doc) => { const n = doc.nodes[ids[0]]; if (!n) return []; const g = p4Geo(a.value.geo); const out = [];
          if (g.size && n.geo.size) out.push({ type: 'prop.set', node: n.id, path: 'geo.size', value: g.size }); if (a.value.xf) out.push({ type: 'prop.set', node: n.id, path: 'xf.pos', value: S(a.value.xf.pos) }, { type: 'prop.set', node: n.id, path: 'xf.rot', value: S(a.value.xf.rot || 0) }); return out; });
        else if (a.path === 'locked') step((doc) => (a.value ? [{ type: 'lock.add', lock: { id: `p4lock-${ids[0]}-${e.n}`, target: { node: ids[0] }, level: 'frozen' } }] : doc.cover.locks.filter((l) => l.target.node === ids[0]).map((l) => ({ type: 'lock.remove', lock: l.id }))));
        else skip(e, `核の最小の形に無い値（${a.path}）`);
        break;
      case 'prop.nudge':
        if (a.what === 'move' && a.m) step(ids.map((id) => ({ type: 'prop.nudge', node: id, path: 'xf.pos', d: [a.m[4], a.m[5]] })));
        else if (a.what === 'rotate') step(ids.map((id) => ({ type: 'prop.nudge', node: id, path: 'xf.rot', d: [a.deg || 0] })));
        else skip(e, `足す量に直せない変形（${a.what}）。大きさ・反転は掛け算なので、核の「足す量」に乗らない`);
        break;
      case 'pt.add':
        if (a.pt && a.p) step((doc) => { const n = doc.nodes[ids[0]]; const pt = p4Pt({ id: a.pt, p: a.p, out: a.out, corner: a.corner });
          if (!n) return [{ type: 'node.add', node: { id: ids[0], scene: 's1', kind: 'line', name: 'ペンの線', order: rankBetween(last(doc, null), null), geo: { t: 'path', closed: false, pts: [pt] }, stroke: { color: hex('#333333'), w: S(2) } } }];
          const pts = n.geo && n.geo.pts ? n.geo.pts : []; const after = a.via === 'pen' ? (pts.length ? pts[pts.length - 1].id : null) : (() => { const j = pts.findIndex((q) => q.id === a.after); return j > 0 ? pts[j - 1].id : j === 0 ? null : pts.length ? pts[pts.length - 1].id : null; })();
          return [{ type: 'pt.add', node: ids[0], pt, after }]; });
        else skip(e, '点の中身が記録に無い');
        break;
      case 'pt.remove': step((doc) => ids.map((pid) => [nodeOfPt(doc, pid), pid]).filter(([n]) => n).map(([n, pid]) => ({ type: 'pt.remove', node: n.id, pt: pid }))); break;
      case 'pt.nudge': step((doc) => ids.map((pid) => [nodeOfPt(doc, pid), pid]).filter(([n]) => n).map(([n, pid]) => ({ type: 'pt.nudge', node: n.id, pt: pid, d: a.d }))); break;
      case 'pt.handle':
        if (a.pt) step([{ type: 'pt.handle', node: ids[0], pt: a.pt, which: 'in', value: a.in ? S(a.in) : null }, { type: 'pt.handle', node: ids[0], pt: a.pt, which: 'out', value: a.out ? S(a.out) : null }]);
        else step((doc) => ids.map((pid) => [nodeOfPt(doc, pid), pid]).filter(([n]) => n).flatMap(([n, pid]) => [{ type: 'pt.handle', node: n.id, pt: pid, which: 'in', value: null }, { type: 'pt.handle', node: n.id, pt: pid, which: 'out', value: null }]));
        break;
      case 'pt.corner':
        if (a.pt) step([{ type: 'pt.corner', node: ids[0], pt: a.pt, corner: !!a.corner }]);
        else step((doc) => ids.map((pid) => [nodeOfPt(doc, pid), pid]).filter(([n]) => n).map(([n, pid]) => ({ type: 'pt.corner', node: n.id, pt: pid, corner: a.op === 'corner' })));
        break;
      case 'undo': if (U.length) { const x = U.pop(); R.push(x); if (x) steps.push({ by: 'human', note: `#${e.n} undo`, undo: true }); } break;
      case 'redo': if (R.length) { const x = R.pop(); U.push(x); if (x) steps.push({ by: 'human', note: `#${e.n} redo`, redo: true }); } break;
      case 'pen.end': case 'pen.continue': break; // 文書は変わらない
      case 'pen.close': skip(e, '道を閉じる命令が、核（と設計の一覧）に無い'); break;
      case 'seisho': skip(e, '清書のあとの点の並びが記録に無い（あれば geo.set に直せる）'); break;
      case 'convert': skip(e, '図形→自由な形のあとの点の並びが記録に無い（あれば geo.set に直せる）'); break;
      default: skip(e, '直し方を決めていない操作');
    }
  }
  return { init: { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai' } }, steps, unmapped };
}
