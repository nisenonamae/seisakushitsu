// 選んで取り消す（9.5節）。巻き戻さない。戻したい記録の効果を新しい順に1つずつ見て、
// 「その後に何が起きたか」で 戻す／何もしない（上書き済み・もう無い）／止まって聞く に分ける。
// 人の直しを黙って壊す道は作らない：迷う場合は ask にし、答え（decisions）が無ければ何もしない。
import { Reject, need, clone, same, relate, akey } from './util.js';
import { getAt, valAt, getNode, addrOf, targetOf, applyEffect, inverse, neighbors, slotsOf, refsOf, scaleV, Draft } from './model.js';
import { logIndexOf, logAt, logTouching, logReverts, logLength } from './log.js';
import { preScan, postScan, lockHits } from './policy.js';
import { checkInvariants } from './invariants.js';

/** prefix の下にある値を、外から参照している置き場 */
function refsInto(doc, prefix, skip) {
  const out = [];
  for (const id of Object.keys(doc.nodes)) {
    if (skip && skip.has(id)) continue;
    for (const [segs, , v] of slotsOf(doc.nodes[id])) for (const r of refsOf(v)) {
      const rel = relate(prefix, ['node', r.node, ...r.path.split('.')]);
      if (rel === 'eq' || rel === 'desc') { out.push(`${id}.${segs.join('.')}`); break; }
    }
  }
  return out;
}
function subtree(doc, id) { // 自分を含む。子が先
  const kids = new Map();
  for (const k of Object.keys(doc.nodes)) { const p = doc.nodes[k].parent; if (p != null) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(k); } }
  const out = []; (function walk(x) { for (const c of (kids.get(x) || []).sort()) walk(c); out.push(x); })(id); return out;
}
const removeNodeFx = (doc, ids) => ids.map((id) => ({ k: 'remove', at: ['node'], id, item: clone(doc.nodes[id]) }));
const recIds = (ls) => [...new Set(ls.map((l) => l.rec.cmd.id))];

/** 効果1つの扱いを決める。当てる効果は「今の控え」に対して作る */
function classify(E, later, doc) {
  const near = later.filter((l) => l.rel === 'eq' || l.rel === 'anc');
  switch (E.k) {
    case 'set': {
      const par = getAt(doc, E.at.slice(0, -1));
      if (par == null || typeof par !== 'object' || Array.isArray(par)) return { result: 'noop', why: 'gone' };
      const cur = valAt(doc, E.at); const fx = () => { const o = { k: 'set', at: E.at, before: cur, after: clone(E.before) }; if (E.kind) o.kind = true; return [o]; };
      if (E.kind) { // 種類を変えた物は「足した物」と同じ扱い：その後に触られていたら聞く
        const touched = later.filter((l) => l.rel === 'eq' || l.rel === 'desc');
        if (touched.length) return { result: 'ask', why: 'kind-edited', choices: ['keep', 'force'], collateral: { records: recIds(touched) }, alt: { force: fx } };
      } else if (near.some((l) => l.e.k === 'set' && !l.e.kind)) return { result: 'noop', why: 'overwritten' };
      // 行3：置きかえの上に、足した・掛けた（差し引きが、たまたま 0 でも）→ AI の値を足場にした直しなので、核は決めない
      else if (near.some((l) => l.e.k === 'delta' || l.e.k === 'mul')) return { result: 'ask', why: 'edited-on-top', choices: ['keep', 'force'], collateral: { records: recIds(near) }, alt: { force: fx } };
      if (same(cur, E.after)) return { result: 'revert', effects: fx() };
      if (same(cur, E.before)) return { result: 'noop', why: 'already' };
      return { result: 'ask', why: 'edited-on-top', choices: ['keep', 'force'], collateral: { records: recIds(later) }, alt: { force: fx } };
    }
    case 'delta': {
      const slot = getAt(doc, E.at); if (slot === undefined) return { result: 'noop', why: 'gone' };
      if (near.some((l) => l.e.k === 'set' && !l.e.kind)) return { result: 'noop', why: 'overwritten' };
      if (slot.k !== 'static' || near.some((l) => l.e.k === 'set' && l.e.kind)) return { result: 'ask', why: 'kind-changed', choices: ['keep'], collateral: { records: recIds(near) } };
      // 表に無い組：足した量の上に「掛けた」。引く量が (d) か (d×掛けた量) かは、掛けた人の意図で変わる → 残す
      if (near.some((l) => l.e.k === 'mul')) return { result: 'ask', why: 'scaled-on-top', choices: ['keep'], collateral: { records: recIds(near) } };
      return { result: 'revert', effects: [{ k: 'delta', at: E.at, d: E.d.map((x) => -x) }], sub: near.some((l) => l.e.k === 'delta') };
    }
    case 'mul': { // 行 6〜9
      const slot = getAt(doc, E.at); if (slot === undefined) return { result: 'noop', why: 'gone' };
      if (near.some((l) => l.e.k === 'set' && !l.e.kind)) return { result: 'noop', why: 'overwritten' };                                  // 行8
      if (slot.k !== 'static' || near.some((l) => l.e.k === 'set' && l.e.kind)) return { result: 'ask', why: 'kind-changed', choices: ['keep'], collateral: { records: recIds(near) } }; // 行9
      // 表に無い組：掛けた量の上に「足した」→ 残す（(b×f+d) から f を外した答えが b+d か b+d/f か、決まらない）
      if (near.some((l) => l.e.k === 'delta')) return { result: 'ask', why: 'added-on-top', choices: ['keep'], collateral: { records: recIds(near) } };
      const cur = slot.v; const back = (after) => { const o = { k: 'mul', at: E.at, f: E.f, before: clone(cur), after }; if (!E.div) o.div = true; return [o]; };
      if (near.some((l) => l.e.k === 'mul')) return { result: 'revert', effects: back(scaleV(cur, E.f, !E.div)), sub: true };              // 行7：AI の分だけ割る（格子に丸める）
      if (same(cur, E.after)) return { result: 'revert', effects: back(clone(E.before)) };                                                 // 行6：ぴったり戻す
      if (same(cur, E.before)) return { result: 'noop', why: 'already' };
      return { result: 'ask', why: 'edited-on-top', choices: ['keep'], collateral: { records: recIds(near) } };
    }
    case 'insert': {
      const at = [...E.at, E.id]; const item = getAt(doc, at); if (item === undefined) return { result: 'noop', why: 'gone' };
      const isNode = E.at.length === 1 && E.at[0] === 'node'; const list = getAt(doc, E.at);
      const touched = later.filter((l) => l.rel === 'eq' || l.rel === 'desc');
      const sub = isNode ? subtree(doc, E.id) : null; const children = isNode ? sub.slice(0, -1) : [];
      const refs = at[0] === 'node' ? refsInto(doc, at, isNode ? new Set(sub) : null) : [];
      const fx = () => (isNode ? removeNodeFx(doc, sub) : [{ k: 'remove', at: E.at, id: E.id, item: clone(item), ...neighbors(list, E.id) }]);
      if (touched.length || children.length || refs.length) {
        return { result: 'ask', why: refs.length ? 'referenced' : children.length ? 'has-children' : 'edited',
          choices: refs.length ? ['keep'] : ['keep', 'force'], collateral: { records: recIds(touched), children, refs }, alt: { force: fx } };
      }
      return { result: 'revert', effects: fx() };
    }
    case 'remove': {
      const list = getAt(doc, E.at);
      if (list == null || typeof list !== 'object') return { result: 'ask', why: 'container-gone', choices: ['keep'] };
      if (getAt(doc, [...E.at, E.id]) !== undefined) return { result: 'noop', why: 'already-back' };
      if (later.some((l) => l.rel === 'anc' && l.e.k === 'set')) return { result: 'ask', why: 'container-replaced', choices: ['keep'], collateral: { records: recIds(later) } };
      const ins = (item) => [{ k: 'insert', at: E.at, id: E.id, item, after: E.after, next: E.next }];
      if (E.at.length === 1 && E.at[0] === 'node' && E.item.parent != null && !getNode(doc, E.item.parent)) {
        return { result: 'ask', why: 'parent-gone', choices: ['keep', 'root'], collateral: { parent: E.item.parent }, alt: { root: () => ins({ ...clone(E.item), parent: null }) } };
      }
      return { result: 'revert', effects: ins(clone(E.item)) };
    }
    case 'move': {
      const n = getNode(doc, E.node); if (!n) return { result: 'noop', why: 'gone' };
      if (later.some((l) => l.e.k === 'move')) return { result: 'noop', why: 'overwritten' };
      if (n.parent !== (E.to.parent ?? null) || n.order !== E.to.order) return { result: 'noop', why: 'overwritten' };
      const mv = (to) => [{ k: 'move', node: E.node, from: { parent: n.parent, order: n.order }, to }];
      if (E.from.parent != null && !getNode(doc, E.from.parent)) {
        return { result: 'ask', why: 'parent-gone', choices: ['keep', 'root'], collateral: { parent: E.from.parent }, alt: { root: () => mv({ parent: null, order: E.from.order }) } };
      }
      return { result: 'revert', effects: mv({ parent: E.from.parent ?? null, order: E.from.order }) };
    }
  }
  throw new Error('unknown effect');
}
/**
 * 取り消しの鎖を数える。「効果 x を、あとの取り消し y がきれいに戻した（y をさらに z が戻した…）」とき、
 *  ・x と y は打ち消し合っている（鎖の長さが偶数）＝その所には、だれの直しも残っていない → 「その後に起きたこと」に数えない
 *  ・やり直し（z）で鎖が奇数になったら、x が生きている。いま文書に効いているのは鎖の最後の効果
 * こうしないと、人が自分の直しを取り消しただけでも「人が直した」と数えてしまい、聞く回数が増える・人が戻した値を人の値と取り違える。
 */
function chains(log) {
  const rootOf = new Map(); const count = new Map(); const lastOf = new Map(); const spent = new Set();
  for (const ri of logReverts(log)) {
    const R = logAt(log, ri);
    for (const o of R.outcomes || []) {
      if (o.result !== 'reverted') continue; spent.add(o.key);
      if (o.forced || !o.fx || o.fx[1] !== 1) continue;                    // 人の直しごと外した物などは、打ち消しに数えない
      const root = rootOf.get(o.key) || o.key; const mine = `${R.cmd.id}#${o.fx[0]}`;
      rootOf.set(mine, root); count.set(root, (count.get(root) || 1) + 1); lastOf.set(root, { idx: ri, i: o.fx[0] });
    }
  }
  return { spent, lastOf, parity: (key) => (count.get(key) || 1) % 2,
    /** 「その後に起きたこと」として数える効果か */
    visible: (key) => !rootOf.has(key) && (count.get(key) || 1) % 2 === 1 };
}
// 全体の決まりを壊しうる効果か（固定の数を置きかえる・足すだけなら壊れない）
const risky = (e) => e.k !== 'delta' && e.k !== 'mul' && !(e.k === 'set' && (e.after === null || typeof e.after !== 'object' || e.after.k === 'static'));

// ───────── 決める単位（9.5節②）
// 「聞く」になった効果が、どの単位に入るか。単位の id は「種類:物[:並び]」。
const PART_WHY = new Set(['edited', 'has-children', 'referenced']);
const CLASS_WHY = { 'kind-edited': 'kind', 'kind-changed': 'kind', 'edited-on-top': 'built', 'scaled-on-top': 'built', 'added-on-top': 'built',
  'container-gone': 'lost', 'container-replaced': 'lost', 'parent-gone': 'lost', locked: 'frozen', 'breaks-invariant': 'inv' };
const UNIT_WHY = { part: 'ai-added-part', items: 'ai-added-items', kind: 'kind-changed', built: 'built-on', lost: 'cannot-restore', frozen: 'frozen', inv: 'breaks-invariant' };
const isNodeInsert = (E) => E.k === 'insert' && E.at.length === 1 && E.at[0] === 'node';
/** @returns {{id:string, cls:string, scope:any}} scope＝この単位が「割らずに」抱える効果の範囲 */
function unitOf(E, why) {
  const target = targetOf(E);
  if (E.k === 'insert') {
    const cls = PART_WHY.has(why) ? (isNodeInsert(E) ? 'part' : 'items') : CLASS_WHY[why] || 'inv';
    if (isNodeInsert(E)) return { id: `${cls}:${target}`, cls, scope: { whole: target } };                       // 部品ごと：その部品への効果の全部
    return { id: `${cls}:${target}:${E.at.slice(2).join('.')}`, cls, scope: { list: akey(E.at) } };              // 並びごと：同じ並びに足した物の全部
  }
  const cls = CLASS_WHY[why] || 'inv';
  if (E.k === 'set' && E.kind) return { id: `${cls}:${target}`, cls, scope: { prefix: E.at } };                 // 種類を変えた所と、その下
  return { id: `${cls}:${target}`, cls, scope: {} };
}
/** あとから起きたことの一覧（「外す」と一緒に失われる直し）。部品の id の集まり nodes に触れた、戻す相手でない記録 */
function laterOnNodes(log, nodes, from, set, ch) {
  const seen = new Map();
  for (const id of nodes) for (const j of logTouching(log, `node:${id}`, from)) {
    if (set.has(j) || seen.has(j)) continue; const r = logAt(log, j);
    if (r.effects.some((e, q) => targetOf(e) === `node:${id}` && ch.visible(`${r.cmd.id}#${q}`))) seen.set(j, r);
  }
  return [...seen.keys()].sort((a, b) => a - b).map((j) => seen.get(j));
}
const laterItem = (r) => ({ seq: r.seq, cmd: r.cmd.id, sender: r.sender, what: r.cmd.body.type });

/**
 * 戻す記録の効果を、新しい順に1つずつ見て、控えに当てていく（1回の通し）。
 * @param {Draft} dr @param {{unit?:boolean, decisions?:any, drops?:Set<string>, holds?:Map<string,any>, info?:Map<string,any>}} opt
 */
function pass(dr, log, idxs, set, ch, opt) {
  const order = [...idxs].sort((a, b) => b - a); const decisions = opt.decisions || {}; const holds = opt.holds; const drops = opt.drops;
  const cover = dr.owned.has('cover') ? clone(dr.doc.cover) : dr.doc.cover; // 始めの時の固定で見る
  const effects = []; const outcomes = []; const scans = []; const asks = []; const dropFailed = new Set();
  // 戻す相手が足した物（部品・点・鍵）の番地。並びの単位の「同じ作業が足した分」を見分ける
  const setInserted = new Set();
  if (opt.unit) for (const idx of order) for (const e of logAt(log, idx).effects) if (e.k === 'insert') setInserted.add(akey([...e.at, e.id]));
  const heldBy = (E, key, target, addr) => {
    for (const [uid, h] of holds) if (h.whole && h.whole === target) return uid;   // 部品ごとの単位が先（同じ部品の、ほかの単位を飲みこむ）
    for (const [uid, h] of holds) {
      if (h.keys.has(key)) return uid;
      for (const l of h.lists) { const la = l.split('/'); if (addr.length > la.length && relate(la, addr) === 'desc' && setInserted.has(akey(addr.slice(0, la.length + 1)))) return uid; }
      for (const p of h.prefixes) { const rel = relate(p, addr); if (rel === 'eq' || rel === 'desc') return uid; }
    }
    return null;
  };
  const note = (u, E, idx, plan, sub) => { // 単位の中身を覚える（見せる一覧・ack の突き合わせに使う）
    let x = opt.info.get(u.id); if (!x) opt.info.set(u.id, (x = { id: u.id, cls: u.cls, target: targetOf(E), choices: null, later: new Map(), children: new Set(), refs: new Set(), why: new Set() }));
    x.why.add(plan.why); const ch2 = plan.choices.includes('force') && u.cls !== 'lost' && u.cls !== 'frozen' && u.cls !== 'inv';
    x.choices = x.choices === null ? ch2 : x.choices && ch2;
    const c = plan.collateral || {};
    for (const id of c.records || []) { const r = logAt(log, logIndexOf(log, id)); x.later.set(r.seq, laterItem(r)); }
    for (const k of c.children || []) x.children.add(k); for (const r of c.refs || []) x.refs.add(r);
    if (sub) for (const r of laterOnNodes(log, sub, idx, set, ch)) x.later.set(r.seq, laterItem(r));
  };
  for (const idx of order) {
    const rec = logAt(log, idx);
    for (let i = rec.effects.length - 1; i >= 0; i--) {
      const key = `${rec.cmd.id}#${i}`; let E = rec.effects[i]; let from = idx;
      const out = { key, cmd: rec.cmd.id, i, k: E.k, at: akey(addrOf(E)) };
      if (ch.spent.has(key)) {
        // 前に戻された効果。そのあと「やり直し」で生き返っていれば、いま効いている方（鎖の最後）を相手にする
        const last = ch.lastOf.get(key);
        if (!last || ch.parity(key) === 0) { outcomes.push({ ...out, result: 'noop', why: 'already' }); continue; }
        E = logAt(log, last.idx).effects[last.i]; from = last.idx;
      }
      const addr = addrOf(E); const target = targetOf(E);
      if (opt.unit) { // 単位の中は割らない：残すと決まった単位に入る効果は、判定せずにそのまま残す
        const uid = heldBy(E, key, target, addr);
        if (uid) { outcomes.push({ ...out, result: 'kept', why: 'unit', unit: uid }); continue; }
        // 「外す」と決まった AI の部品への、ほかの効果：部品ごと外れるので、1つずつは戻さない
        if (!isNodeInsert(E) && target.startsWith('node:') && drops.has(`part:${target}`) && setInserted.has(`node/${target.slice(5)}`) && getNode(dr.doc, target.slice(5))) { outcomes.push({ ...out, result: 'noop', why: 'unit-dropped', unit: `part:${target}` }); continue; }
      }
      const later = [];
      for (const j of logTouching(log, target, from)) {
        if (set.has(j)) continue; const r2 = logAt(log, j);
        r2.effects.forEach((e2, q) => { if (targetOf(e2) !== target || !ch.visible(`${r2.cmd.id}#${q}`)) return; const rel = relate(addr, addrOf(e2)); if (rel) later.push({ rec: r2, e: e2, rel }); });
      }
      let plan = classify(E, later, dr.doc); let unit = null;
      if (plan.result === 'ask') {
        if (opt.unit) {
          unit = unitOf(E, plan.why);
          // 入れ物：AI が足したまとまりで、だれも直しておらず、残っている子が全部「同じ作業が足して、残すと決まった部品」→ 選ぶ単位にしない（子が残る間だけ残る）
          if (unit.cls === 'part' && plan.why === 'has-children' && !plan.collateral.records.length && plan.collateral.children.every((c) => setInserted.has(`node/${c}`))) unit = { id: `container:${target}`, cls: 'container', scope: unit.scope };
          const sub = unit.cls === 'part' ? subtree(dr.doc, E.id) : null;
          if (unit.cls !== 'container') note(unit, E, from, plan, sub);
          if (drops.has(unit.id)) {
            if (plan.alt && plan.alt.force && opt.info.get(unit.id).choices) plan = { result: 'revert', effects: plan.alt.force(), forced: 'drop', why: plan.why, collateral: plan.collateral };
            else dropFailed.add(unit.id);
          }
        } else {
          const d = decisions[key];
          if (d === 'keep') plan = { result: 'kept', why: plan.why, collateral: plan.collateral };
          else if (d && plan.choices.includes(d) && plan.alt && plan.alt[d]) plan = { result: 'revert', effects: plan.alt[d](), forced: d, why: plan.why, collateral: plan.collateral };
        }
      }
      if (plan.result === 'revert') {
        // 控えに当ててみる。固定に当たる・全体の決まりを壊すなら、この効果の分だけ元に戻して「聞く」にする
        const done = []; const sc = []; let stop = null;
        try {
          for (const e of plan.effects) { const s = preScan(dr.doc, e); applyEffect(dr, e); done.push(e); sc.push(postScan(dr.doc, s)); }
          const frozen = sc.flatMap((s) => lockHits(cover, s).frozen);
          if (frozen.length) stop = { why: 'locked', collateral: { locks: [...new Set(frozen)] } };
          else if (plan.effects.some(risky)) { const bad = checkInvariants(dr.doc); if (bad.length) stop = { why: 'breaks-invariant', collateral: { breaks: bad.slice(0, 10) } }; }
        } catch (err) { if (!(err instanceof Reject)) throw err; stop = { why: 'breaks-invariant', collateral: { breaks: [err.message] } }; }
        if (stop) {
          for (let q = done.length - 1; q >= 0; q--) applyEffect(dr, inverse(done[q]));
          if (opt.unit && plan.forced) dropFailed.add(unit.id);
          plan = { result: 'ask', choices: ['keep'], ...stop };
          if (opt.unit) { unit = unitOf(E, plan.why); note(unit, E, from, plan, null); if (drops.has(unit.id)) dropFailed.add(unit.id); }
        } else { out.fx = [effects.length, plan.effects.length]; effects.push(...plan.effects); scans.push(...sc); if (plan.sub) out.sub = true; }
      }
      out.result = plan.result === 'revert' ? 'reverted' : plan.result;
      for (const f of ['why', 'choices', 'collateral', 'forced']) if (plan[f] !== undefined) out[f] = plan[f];
      if (unit) { out.unit = unit.id; if (out.result === 'ask') asks.push({ unit, key, E }); }
      outcomes.push(out);
    }
  }
  return { effects, outcomes, scans, asks, dropFailed };
}

/**
 * 部品ごとにまとめる取り消し（9.5節②③）。控えを変えずに、計画（当てる効果・単位の一覧）を作る。
 * 「聞く」になった効果の単位を「残す」と決め、その単位に入る効果を全部そのままにして、もう一度通す。新しい「聞く」が出なくなるまで。
 * （残す物は増えるだけなので、必ず止まる。迷ったら残す側に倒れる）
 */
function planUnits(doc, log, idxs, set, ch, drops) {
  const holds = new Map(); const info = new Map(); let res = null;
  for (let round = 0; round < 200; round++) {
    const dr = new Draft(doc); res = pass(dr, log, idxs, set, ch, { unit: true, drops, holds, info });
    let grew = false;
    for (const a of res.asks) {
      let h = holds.get(a.unit.id); if (!h) { holds.set(a.unit.id, (h = { cls: a.unit.cls, whole: null, lists: new Set(), prefixes: [], keys: new Set() })); }
      const sc = a.unit.scope; const before = `${h.whole}|${h.lists.size}|${h.prefixes.length}|${h.keys.size}`;
      if (sc.whole) h.whole = sc.whole; else if (sc.list) h.lists.add(sc.list); else if (sc.prefix) { if (!h.prefixes.some((p) => akey(p) === akey(sc.prefix))) h.prefixes.push(sc.prefix); } else h.keys.add(a.key);
      if (before !== `${h.whole}|${h.lists.size}|${h.prefixes.length}|${h.keys.size}`) grew = true;
    }
    if (!grew) break;
  }
  // まだ「聞く」が残っていれば（上限に当たった時だけ）、残す
  for (const o of res.outcomes) if (o.result === 'ask') { o.result = 'kept'; }
  // 単位の一覧
  const byUnit = new Map();
  for (const o of res.outcomes) if (o.unit && o.result === 'kept') { if (!byUnit.has(o.unit)) byUnit.set(o.unit, []); byUnit.get(o.unit).push({ seq: logAt(log, logIndexOf(log, o.cmd)).seq, i: o.i }); }
  const units = []; const containers = [];
  for (const [uid, effs] of byUnit) {
    const h = holds.get(uid); if (h && h.cls === 'container') { containers.push({ id: uid, node: uid.split(':').slice(2).join(':'), effects: effs }); continue; }
    const x = info.get(uid); if (!x) continue;
    const later = [...x.later.values()].sort((a, b) => a.seq - b.seq); const kinds = new Set(later.map((l) => l.sender.k));
    const id = x.target.split(':').slice(1).join(':'); const n = x.target.startsWith('node:') ? getNode(doc, id) : null;
    const u = { id: uid, node: id, name: n ? n.name : x.target, why: UNIT_WHY[x.cls], detail: [...x.why].sort(), effects: effs, later,
      by: kinds.size === 0 ? 'none' : kinds.size === 2 ? 'both' : [...kinds][0], choices: x.choices && !x.refs.size ? ['keep', 'drop'] : ['keep'] };
    if (x.children.size) u.children = [...x.children].sort(); if (x.refs.size) u.refs = [...x.refs].sort();
    units.push(u);
  }
  // 外した単位（drop）の、失われる直しの一覧。ack と突き合わせる
  const dropped = [];
  for (const uid of drops) { const x = info.get(uid); if (!x || byUnit.has(uid)) continue; dropped.push({ id: uid, later: [...x.later.values()].sort((a, b) => a.seq - b.seq) }); }
  // ほかの AI の作業が上に乗っている所を、作業ごとにまとめる（見せる時は「作業ごとに1つ」）
  const tasks = new Map();
  for (const u of units) for (const l of u.later) if (l.sender.k === 'ai') {
    const r = logAt(log, logIndexOf(log, l.cmd)); const t = r.cmd.group || r.cmd.id; if (!tasks.has(t)) tasks.set(t, { task: t, agent: l.sender.agent, units: new Set(), records: new Set() });
    tasks.get(t).units.add(u.id); tasks.get(t).records.add(l.cmd);
  }
  const laterAI = [...tasks.values()].map((t) => ({ task: t.task, agent: t.agent, units: [...t.units], records: [...t.records] }));
  const auto = { reverted: 0, superseded: 0, subtracted: 0, gone: 0 };
  for (const o of res.outcomes) { if (o.result === 'reverted' && !o.forced) { if (o.sub) auto.subtracted++; else auto.reverted++; } else if (o.result === 'noop') { if (o.why === 'overwritten') auto.superseded++; else auto.gone++; } }
  return { ...res, units, containers, dropped, laterAI, auto };
}

function resolveTargets(log, targets) {
  const idxs = targets.map((id) => { const i = logIndexOf(log, id); if (i < 0) throw new Reject('invalid', '戻す記録がない', { missing: id }); return i; });
  const set = new Set(idxs); need(set.size === idxs.length, '同じ記録が2回ある'); return { idxs, set };
}
/**
 * 戻す計画（文書を変えない計算）。画面は、これを1つの確認の画面にして見せる。
 * @param {{doc:any, log:any}} state @param {string[]} targets 戻す記録の id
 * @returns {{of:number[], at:number, auto:{reverted:number, superseded:number, subtracted:number, gone:number}, units:any[], containers:any[], laterAI:any[], outcomes:any[]}}
 */
export function planRevert(state, targets) {
  const { idxs, set } = resolveTargets(state.log, targets); const p = planUnits(state.doc, state.log, idxs, set, chains(state.log), new Set());
  return { of: idxs.map((i) => logAt(state.log, i).seq), at: logLength(state.log), auto: p.auto, units: p.units, containers: p.containers, laterAI: p.laterAI, outcomes: p.outcomes };
}

/**
 * revert の命令を、控えに当てる（engine から呼ぶ）。
 * @param {Draft} dr 控え（ここに当てていく）@param {{k:'human'|'ai'}} sender 確かめられた送り主
 * @returns {{effects:any[], outcomes:any[], scans:any[], records:any[], units?:any[]}}
 */
export function runRevert(dr, log, body, sender) {
  const { idxs, set } = resolveTargets(log, body.targets); const ch = chains(log);
  const records = [...idxs].sort((a, b) => b - a).map((i) => logAt(log, i));
  const decisions = body.decisions || {}; const isHuman = !!sender && sender.k === 'human';
  // 「人の直しごと外す」などの、既定（残す）でない答えを選べるのは、確かめられた送り主が人のときだけ（9.5節③の3）
  if (!isHuman && Object.values(decisions).some((d) => d !== 'keep')) throw new Reject('forbidden', 'AI は「外す」を選べない（既定の「残す」だけ）', { why: 'revert-drop-ai' });
  if (body.mode !== 'units') { const p = pass(dr, log, idxs, set, ch, { decisions }); return { effects: p.effects, outcomes: p.outcomes, scans: p.scans, records }; }

  if (body.at !== undefined && body.at > logLength(log)) throw new Reject('invalid', '計画を作った時点（at）が、今の記録より先');
  const drops = new Set(Object.keys(decisions).filter((u) => decisions[u] === 'drop'));
  const p = planUnits(dr.doc, log, idxs, set, ch, drops);                       // 当てる時に、計画を作り直す
  // 送られた答えと突き合わせる：外せなくなった単位・見ていない直しが増えた単位があれば、断る（計画を作り直して、もう一度見せる）
  for (const uid of drops) {
    const kept = p.units.find((u) => u.id === uid);
    if (p.dropFailed.has(uid) || kept) throw new Reject('stale', '計画が変わった：この単位は、いまは外せない', { why: 'plan-changed', unit: uid, choices: kept ? kept.choices : ['keep'] });
  }
  const ack = body.ack || {};
  for (const d of p.dropped) {
    const seen = new Set(Object.hasOwn(ack, d.id) ? ack[d.id] : []); const unseen = d.later.filter((l) => !seen.has(l.seq));
    if (unseen.length) throw new Reject('stale', '見ていない直しがある：計画を作り直して、もう一度確かめる', { why: 'unseen-edits', unit: d.id, unseen });
  }
  // 当てる（控えに。効果の並びは計画と同じ）
  const scans = [];
  for (const e of p.effects) { const s = preScan(dr.doc, e); applyEffect(dr, e); scans.push(postScan(dr.doc, s)); }
  return { effects: p.effects, outcomes: p.outcomes, scans, records, units: p.units, containers: p.containers, dropped: p.dropped, auto: p.auto };
}
/** 結果の数え上げ */
export function tally(outcomes) {
  const t = { reverted: 0, noop: 0, ask: 0, kept: 0 }; for (const o of outcomes) t[o.result]++; return t;
}
