// 命令の種類（9.2節）。種類ごとに：形の版 v・形の検査 check・許しの分類 cat・効果を作る run。
// run は「今の文書」を読んで効果（Effect）の並びを返すだけ。文書は変えない（変えるのは model.applyEffect）。
// 取り消しに要る before・item は、ここ（核）が今の文書から取る。送る側の物は使わない。
import { Reject, need, isId, isObj, isNum, clone, isRank } from './util.js';
import { getNode, getAt, valAt, slotType, normValue, normNode, normGeo, normPt, normKey, normTime, isPath, neighbors, snap, scaleV,
  MODES, PERM_KEYS, PERM_VALUES, MAX_KEYS, MAX_PTS, revOf } from './model.js';

const missing = (what, target) => new Reject('invalid', `${what}がない`, { missing: target });
function nodeOf(doc, id) { const n = getNode(doc, id); if (!n) throw missing(`部品 ${id} `, `node:${id}`); return n; }
/** 値の置き場を引く */
function slot(doc, nodeId, path) {
  const n = nodeOf(doc, nodeId); const segs = path.split('.'); const type = slotType(n, segs);
  if (!type) throw missing(`部品 ${nodeId} の値 ${path} `, `node:${nodeId}`);
  const at = ['node', nodeId, ...segs]; return { n, type, at, cur: getAt(doc, at) };
}
function ptOf(doc, nodeId, ptId) {
  const n = nodeOf(doc, nodeId); need(n.geo && n.geo.t === 'path', '点を持つ形でない');
  const pt = n.geo.pts.find((q) => q.id === ptId); if (!pt) throw missing(`点 ${ptId} `, `node:${nodeId}`);
  return { n, pt, list: ['node', nodeId, 'geo', 'pts'] };
}
function keysOf(doc, nodeId, path) {
  const s = slot(doc, nodeId, path); need(s.cur.k === 'keys', '鍵を持つ値でない（先に prop.kind で鍵にする）'); return s;
}
function keyOf(doc, nodeId, path, keyId) {
  const s = keysOf(doc, nodeId, path); const key = s.cur.keys.find((k) => k.id === keyId);
  if (!key) throw missing(`鍵 ${keyId} `, `node:${nodeId}`); return { ...s, key, list: [...s.at, 'keys'] };
}
const COLOR_PATHS = new Set(['fill.color', 'stroke.color']);
const art = (perm) => ({ perm, stage: 'art' });
const B = { node: (b) => need(isId(b.node), '部品の id'), path: (b) => need(isPath(b.path), '道') };

/** @type {Record<string,{v:number, check:(b:any)=>void, cat:(b:any,doc:any)=>{perm:string,stage:string|null}, run:(doc:any,b:any,env:any)=>any[]}>} */
export const SPECS = {
  'node.add': { v: 1,
    check(b) { need(isObj(b.node), '部品'); },
    cat: () => art('create'),
    run(doc, b) {
      const n = normNode(b.node);
      need(revOf(doc, `node:${n.id}`) === 0 && !getNode(doc, n.id), 'その id は使われたことがある');
      need(Object.hasOwn(doc.scenes, n.scene), '場面がない');
      if (n.parent != null) { const p = getNode(doc, n.parent); if (!p) throw missing(`親 ${n.parent} `, `node:${n.parent}`); need(p.kind === 'group' && p.scene === n.scene, '親にできない'); }
      if (n.stage === undefined) n.stage = doc.scenes[n.scene].stage;
      return [{ k: 'insert', at: ['node'], id: n.id, item: n }];
    } },
  'node.remove': { v: 1, check: B.node, cat: () => art('remove'),
    run(doc, b) {
      nodeOf(doc, b.node); const kids = new Map();
      for (const id of Object.keys(doc.nodes)) { const p = doc.nodes[id].parent; if (p != null) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(id); } }
      const out = []; // 子が先・親が後（戻すときは逆に、親から）
      (function walk(id) { for (const c of (kids.get(id) || []).sort()) walk(c); out.push({ k: 'remove', at: ['node'], id, item: clone(doc.nodes[id]) }); })(b.node);
      return out;
    } },
  'node.move': { v: 1,
    check(b) { B.node(b); need(b.parent == null || isId(b.parent), '親'); need(isRank(b.order), '順番の印'); },
    cat: () => art('write.shape'),
    run(doc, b) {
      const n = nodeOf(doc, b.node); const parent = b.parent ?? null;
      if (parent != null) { const p = getNode(doc, parent); if (!p) throw missing(`親 ${parent} `, `node:${parent}`); need(p.kind === 'group' && p.scene === n.scene, '親にできない'); }
      if (n.parent === parent && n.order === b.order) return [];
      return [{ k: 'move', node: b.node, from: { parent: n.parent, order: n.order }, to: { parent, order: b.order } }];
    } },
  'node.rename': { v: 1,
    check(b) { B.node(b); need(typeof b.name === 'string' && b.name.length <= 200, '名前'); },
    cat: () => art('write.shape'),
    run(doc, b) { const n = nodeOf(doc, b.node); return n.name === b.name ? [] : [{ k: 'set', at: ['node', b.node, 'name'], before: n.name, after: b.name }]; } },

  // v2：値は必ず札つき（{k:'static',v:…}）。v1 は裸の値も受けていた → migrate で札を付ける
  'prop.set': { v: 2,
    migrate: { 1: (b) => ({ ...b, value: isObj(b.value) && typeof b.value.k === 'string' && ['static', 'keys', 'expr', 'ref'].includes(b.value.k) ? b.value : { k: 'static', v: b.value } }) },
    check(b) { B.node(b); B.path(b); need(isObj(b.value), '値'); },
    cat(b, doc) { const n = getNode(doc, b.node); const cur = n && slotType(n, b.path.split('.')) ? getAt(doc, ['node', b.node, ...b.path.split('.')]) : null;
      const perm = COLOR_PATHS.has(b.path) ? 'write.color' : cur && cur.k !== 'static' ? 'write.motion' : 'write.shape';
      return { perm, stage: perm === 'write.motion' ? 'motion' : 'art' }; },
    run(doc, b) {
      const s = slot(doc, b.node, b.path); const v = normValue(b.value, s.type);
      need(v.k === s.cur.k, '値の種類を変えるのは prop.kind で');
      return [{ k: 'set', at: s.at, before: clone(s.cur), after: v }];
    } },
  'prop.nudge': { v: 1,
    check(b) { B.node(b); B.path(b); need(Array.isArray(b.d) && b.d.length >= 1 && b.d.length <= 2 && b.d.every(isNum), '足す量'); },
    cat: () => art('write.shape'),
    run(doc, b) {
      const s = slot(doc, b.node, b.path);
      need(s.cur.k === 'static' && (s.type === 'num' || s.type === 'vec2'), '足せるのは固定の数だけ（鍵のある値は鍵ごとに key.value で）');
      need(b.d.length === (s.type === 'num' ? 1 : 2), '足す量の数が合わない');
      return [{ k: 'delta', at: s.at, d: b.d.map(snap) }];
    } },
  // 伸ばす・反転＝掛ける量（9.2節・改訂4）。0 を掛ける命令は断る（逆向きにできない）。比も格子に丸める
  'prop.scale': { v: 1,
    check(b) { B.node(b); B.path(b); need(Array.isArray(b.f) && b.f.length >= 1 && b.f.length <= 2 && b.f.every(isNum), '掛ける量'); need(b.f.every((x) => snap(x) !== 0), '0 は掛けられない'); },
    cat: () => art('write.shape'),
    run(doc, b) {
      const s = slot(doc, b.node, b.path);
      need(s.cur.k === 'static' && (s.type === 'num' || s.type === 'vec2'), '掛けられるのは固定の数だけ（鍵のある値は鍵ごとに key.value で）');
      need(b.f.length === 1 || s.type === 'vec2', '掛ける量の数が合わない');
      const f = b.f.map(snap); const after = scaleV(s.cur.v, f, false);
      return [{ k: 'mul', at: s.at, f, before: clone(s.cur.v), after }];
    } },
  'prop.kind': { v: 1,
    check(b) { B.node(b); B.path(b); need(isObj(b.value), '値'); },
    cat: () => ({ perm: 'write.motion', stage: 'motion' }),
    run(doc, b) {
      const s = slot(doc, b.node, b.path); const v = normValue(b.value, s.type);
      need(v.k !== s.cur.k, '種類が同じ（中身だけ変えるのは prop.set で）');
      return [{ k: 'set', at: s.at, before: clone(s.cur), after: v, kind: true }];
    } },

  // 形そのものを置きかえる（図形 → 自由な形・清書など）。9.5節の「種類を変える命令」＝足した物と同じ扱い（kind の印）
  'geo.set': { v: 1,
    check(b) { B.node(b); need(isObj(b.geo), '形'); },
    cat: () => art('write.shape'),
    run(doc, b) {
      const n = nodeOf(doc, b.node); need(n.kind !== 'group', 'まとまりは形を持たない'); const geo = normGeo(b.geo, n.kind);
      return JSON.stringify(geo) === JSON.stringify(n.geo) ? [] : [{ k: 'set', at: ['node', b.node, 'geo'], before: clone(n.geo), after: geo, kind: true }];
    } },

  'pt.add': { v: 1,
    check(b) { B.node(b); need(isObj(b.pt), '点'); need(b.after == null || isId(b.after), 'どの点の後ろか'); },
    cat: () => art('write.shape'),
    run(doc, b) {
      const n = nodeOf(doc, b.node); need(n.geo && n.geo.t === 'path', '点を持つ形でない');
      const pt = normPt(b.pt); const pts = n.geo.pts; need(pts.length < MAX_PTS, '点が多すぎる');
      need(!pts.some((q) => q.id === pt.id), '点の id が重なっている');
      let next = pts.length ? pts[0].id : null;
      if (b.after != null) { const j = pts.findIndex((q) => q.id === b.after); if (j < 0) throw missing(`点 ${b.after} `, `node:${b.node}`); next = j + 1 < pts.length ? pts[j + 1].id : null; }
      return [{ k: 'insert', at: ['node', b.node, 'geo', 'pts'], id: pt.id, item: pt, after: b.after ?? null, next }];
    } },
  'pt.remove': { v: 1, check(b) { B.node(b); need(isId(b.pt), '点の id'); }, cat: () => art('write.shape'),
    run(doc, b) { const { n, pt, list } = ptOf(doc, b.node, b.pt); return [{ k: 'remove', at: list, id: b.pt, item: clone(pt), ...neighbors(n.geo.pts, b.pt) }]; } },
  'pt.nudge': { v: 1,
    check(b) { B.node(b); need(isId(b.pt), '点の id'); need(Array.isArray(b.d) && b.d.length === 2 && b.d.every(isNum), '足す量'); },
    cat: () => art('write.shape'),
    run(doc, b) { const { pt, list } = ptOf(doc, b.node, b.pt); need(pt.p.k === 'static', '足せるのは固定の位置だけ'); return [{ k: 'delta', at: [...list, b.pt, 'p'], d: b.d.map(snap) }]; } },
  'pt.handle': { v: 1,
    check(b) { B.node(b); need(isId(b.pt), '点の id'); need(b.which === 'in' || b.which === 'out', 'どちらの取っ手か'); need(b.value === null || isObj(b.value), '値（null＝自動に戻す）'); },
    cat: () => art('write.shape'),
    run(doc, b) {
      const { pt, list } = ptOf(doc, b.node, b.pt); const after = b.value === null ? null : normValue(b.value, 'vec2'); const before = pt[b.which] != null ? clone(pt[b.which]) : null;
      return [{ k: 'set', at: [...list, b.pt, b.which], before, after }];
    } },
  'pt.corner': { v: 1,
    check(b) { B.node(b); need(isId(b.pt), '点の id'); need(typeof b.corner === 'boolean', '角かどうか'); },
    cat: () => art('write.shape'),
    run(doc, b) { const { pt, list } = ptOf(doc, b.node, b.pt); const before = pt.corner != null ? pt.corner : null; return before === b.corner ? [] : [{ k: 'set', at: [...list, b.pt, 'corner'], before, after: b.corner }]; } },

  'key.add': { v: 1,
    check(b) { B.node(b); B.path(b); need(isObj(b.key), '鍵'); need(b.after == null || isId(b.after), 'どの鍵の後ろか'); },
    cat: () => ({ perm: 'write.motion', stage: 'motion' }),
    run(doc, b) {
      const s = keysOf(doc, b.node, b.path); const key = normKey(b.key, s.type); const ks = s.cur.keys; need(ks.length < MAX_KEYS, '鍵が多すぎる');
      need(!ks.some((k) => k.id === key.id), '鍵の id が重なっている');
      let next = ks.length ? ks[0].id : null;
      if (b.after != null) { const j = ks.findIndex((k) => k.id === b.after); if (j < 0) throw missing(`鍵 ${b.after} `, `node:${b.node}`); next = j + 1 < ks.length ? ks[j + 1].id : null; }
      return [{ k: 'insert', at: [...s.at, 'keys'], id: key.id, item: key, after: b.after ?? null, next }];
    } },
  'key.remove': { v: 1, check(b) { B.node(b); B.path(b); need(isId(b.key), '鍵の id'); }, cat: () => ({ perm: 'write.motion', stage: 'motion' }),
    run(doc, b) { const s = keyOf(doc, b.node, b.path, b.key); return [{ k: 'remove', at: s.list, id: b.key, item: clone(s.key), ...neighbors(s.cur.keys, b.key) }]; } },
  'key.retime': { v: 1, check(b) { B.node(b); B.path(b); need(isId(b.key), '鍵の id'); need(isObj(b.t), '時刻'); }, cat: () => ({ perm: 'write.motion', stage: 'motion' }),
    run(doc, b) { const s = keyOf(doc, b.node, b.path, b.key); return [{ k: 'set', at: [...s.list, b.key, 't'], before: clone(s.key.t), after: normTime(b.t) }]; } },
  'key.value': { v: 1, check(b) { B.node(b); B.path(b); need(isId(b.key), '鍵の id'); }, cat: () => ({ perm: 'write.motion', stage: 'motion' }),
    run(doc, b) { const s = keyOf(doc, b.node, b.path, b.key); const v = normKey({ id: b.key, t: s.key.t, v: b.v }, s.type).v; return [{ k: 'set', at: [...s.list, b.key, 'v'], before: clone(s.key.v), after: v }]; } },

  'mode.set': { v: 1,
    check(b) { need(isId(b.stage), '工程'); need(MODES.includes(b.mode), '度合い'); need(b.scene == null || isId(b.scene), '場面'); },
    cat: () => ({ perm: 'cover', stage: null }),
    run(doc, b) {
      if (b.scene != null) need(Object.hasOwn(doc.scenes, b.scene), '場面がない');
      const at = b.scene != null ? ['cover', 'sceneModes', `${b.scene}~${b.stage}`] : ['cover', 'stages', b.stage]; const before = valAt(doc, at);
      return before === b.mode ? [] : [{ k: 'set', at, before, after: b.mode }];
    } },
  'perms.set': { v: 1,
    check(b) { need(PERM_KEYS.includes(b.key), '許可の名前'); need(PERM_VALUES.includes(b.value), '許可の値'); },
    cat: () => ({ perm: 'cover', stage: null }),
    run(doc, b) { const at = ['cover', 'perms', b.key]; const before = valAt(doc, at); return before === b.value ? [] : [{ k: 'set', at, before, after: b.value }]; } },
  'lock.add': { v: 1,
    check(b) {
      const l = b.lock; need(isObj(l) && isId(l.id), '固定の id'); need(l.level === 'frozen' || l.level === 'ask', '固定の強さ');
      need(l.why === undefined || (typeof l.why === 'string' && l.why.length <= 500), '理由'); const t = l.target; need(isObj(t), '固定の相手');
      if (t.line !== undefined) need(isId(t.line), '行');
      else { need(t.scene !== undefined || t.node !== undefined, '固定の相手'); need(t.scene === undefined || isId(t.scene), '場面'); need(t.node === undefined || isId(t.node), '部品'); need(t.path === undefined || (t.node !== undefined && isPath(t.path)), '道'); }
    },
    cat: () => ({ perm: 'cover', stage: null }),
    run(doc, b, env) {
      const l = b.lock; const locks = doc.cover.locks; need(!locks.some((x) => x.id === l.id), '固定の id が重なっている');
      if (l.target.node !== undefined) nodeOf(doc, l.target.node);
      if (l.target.scene !== undefined) need(Object.hasOwn(doc.scenes, l.target.scene), '場面がない');
      const item = { id: l.id, target: clone(l.target), level: l.level, by: env.by, at: env.seq }; if (l.why !== undefined) item.why = l.why;
      return [{ k: 'insert', at: ['cover', 'locks'], id: l.id, item, after: locks.length ? locks[locks.length - 1].id : null, next: null }];
    } },
  'lock.remove': { v: 1,
    check(b) { need(isId(b.lock), '固定の id'); need(b.why === undefined || typeof b.why === 'string', '理由'); },
    cat: () => ({ perm: 'cover', stage: null }),
    run(doc, b) { const locks = doc.cover.locks; const l = locks.find((x) => x.id === b.lock); if (!l) throw missing(`固定 ${b.lock} `, 'cover'); return [{ k: 'remove', at: ['cover', 'locks'], id: b.lock, item: clone(l), ...neighbors(locks, b.lock) }]; } },

  // ---- 語り（余力の分。トークンの対応は送る側が script.retoken で作り、核は「id を使い回してよいか」を検査する）
  'line.add': { v: 1,
    check(b) { const l = b.line; need(isObj(l) && isId(l.id) && typeof l.text === 'string' && Array.isArray(l.tokens), '行'); need(b.after == null || isId(b.after), 'どの行の後ろか'); },
    cat: () => ({ perm: 'write.script', stage: 'script' }),
    run(doc, b) {
      const lines = doc.script.lines; const l = b.line; need(revOf(doc, `line:${l.id}`) === 0 && !lines.some((x) => x.id === l.id), '行の id が使われている');
      const tokens = normTokens(doc, l.tokens, l.text, null);
      let next = lines.length ? lines[0].id : null;
      if (b.after != null) { const j = lines.findIndex((x) => x.id === b.after); if (j < 0) throw missing(`行 ${b.after} `, `line:${b.after}`); next = j + 1 < lines.length ? lines[j + 1].id : null; }
      return [{ k: 'insert', at: ['line'], id: l.id, item: { id: l.id, chapter: typeof l.chapter === 'string' ? l.chapter : '', tokens }, after: b.after ?? null, next }];
    } },
  'line.edit': { v: 1,
    check(b) { need(isId(b.line) && typeof b.text === 'string' && Array.isArray(b.tokens), '行の直し'); },
    cat: () => ({ perm: 'write.script', stage: 'script' }),
    run(doc, b) {
      const l = doc.script.lines.find((x) => x.id === b.line); if (!l) throw missing(`行 ${b.line} `, `line:${b.line}`);
      const tokens = normTokens(doc, b.tokens, b.text, l);
      // 本文はトークンをつなげた物（別には持たない）。だから効果は1つで済み、取り消しの途中で本文とトークンが食い違わない
      return JSON.stringify(l.tokens) === JSON.stringify(tokens) ? [] : [{ k: 'set', at: ['line', b.line, 'tokens'], before: clone(l.tokens), after: tokens }];
    } },
  'line.remove': { v: 1, check(b) { need(isId(b.line), '行の id'); }, cat: () => ({ perm: 'remove', stage: 'script' }),
    run(doc, b) { const lines = doc.script.lines; const l = lines.find((x) => x.id === b.line); if (!l) throw missing(`行 ${b.line} `, `line:${b.line}`); return [{ k: 'remove', at: ['line'], id: b.line, item: clone(l), ...neighbors(lines, b.line) }]; } },

  // revert は engine／revert.js が特別に扱う（効果は、今の文書と記録から核が作る）
  revert: { v: 1,
    check(b) {
      need(Array.isArray(b.targets) && b.targets.length >= 1 && b.targets.length <= 5000 && b.targets.every((t) => typeof t === 'string'), '戻す記録の一覧');
      need(b.mode === undefined || ['select', 'units', 'undo', 'redo'].includes(b.mode), '取り消しの種類');
      need(b.at === undefined || (Number.isInteger(b.at) && b.at >= 0), '計画を作った時点（at）');
      need(b.ack === undefined || (isObj(b.ack) && Object.values(b.ack).every((a) => Array.isArray(a) && a.length <= 100000 && a.every((x) => Number.isInteger(x) && x >= 0))), '見た直しの一覧（ack）');
      if (b.mode === 'units') { need(b.decisions === undefined || (isObj(b.decisions) && Object.values(b.decisions).every((d) => d === 'keep' || d === 'drop')), '答え（部品ごと：keep か drop）'); return; }
      need(b.ack === undefined, 'ack は部品ごとの取り消し（mode:units）だけ');
      need(b.onAsk === undefined || b.onAsk === 'keep' || b.onAsk === 'abort', '聞く所の扱い');
      need(b.decisions === undefined || (isObj(b.decisions) && Object.values(b.decisions).every((d) => ['keep', 'force', 'root'].includes(d))), '答え');
    },
    cat: () => ({ perm: 'revert', stage: null }), run() { throw new Error('revert は engine が扱う'); } },
};

/** トークンの並びを検査する：つなげると本文になる・id は台本の中で1つ・使い回せるのは同じ行の前の id だけ */
function normTokens(doc, tokens, text, oldLine) {
  need(tokens.length <= 2000, 'トークンが多すぎる');
  const mine = new Set(oldLine ? oldLine.tokens.map((t) => t.id) : []); const others = new Set();
  for (const l of doc.script.lines) if (l !== oldLine) for (const t of l.tokens) others.add(t.id);
  const seen = new Set(); const out = [];
  for (const t of tokens) {
    need(isObj(t) && isId(t.id) && typeof t.text === 'string' && t.text.length > 0, 'トークンの形');
    need(!seen.has(t.id) && !others.has(t.id), 'トークンの id が重なっている'); seen.add(t.id);
    if (mine.has(t.id)) need(oldLine.tokens.find((x) => x.id === t.id).text === t.text, '中身が変わったトークンに、前の id は使えない');
    out.push({ id: t.id, text: t.text });
  }
  need(out.map((t) => t.text).join('') === text, 'トークンをつなげても本文にならない');
  return out;
}

/** 古い版の命令の中身を、今の形に移す。記録そのものは書きかえない（読むたびに移す） */
export function migrateBody(type, v, body) {
  const spec = SPECS[type]; let b = body;
  for (let x = v; x < spec.v; x++) { const f = spec.migrate && spec.migrate[x]; if (!f) throw new Reject('invalid', `${type} の v${x} は移せない`); b = f(b); }
  return b;
}
