// 選んで取り消す（9.5節）。巻き戻さない。戻したい記録の効果を新しい順に1つずつ見て、
// 「その後に何が起きたか」で 戻す／何もしない（上書き済み・もう無い）／止まって聞く に分ける。
// 人の直しを黙って壊す道は作らない：迷う場合は ask にし、答え（decisions）が無ければ何もしない。
import { Reject, need, clone, same, relate, akey } from './util.js';
import { getAt, valAt, getNode, addrOf, targetOf, applyEffect, inverse, neighbors, slotsOf, refsOf } from './model.js';
import { logIndexOf, logAt, logTouching, logReverts } from './log.js';
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
      if (same(cur, E.after)) return { result: 'revert', effects: fx() };
      if (same(cur, E.before)) return { result: 'noop', why: 'already' };
      return { result: 'ask', why: 'edited-on-top', choices: ['keep', 'force'], collateral: { records: recIds(later) }, alt: { force: fx } };
    }
    case 'delta': {
      const slot = getAt(doc, E.at); if (slot === undefined) return { result: 'noop', why: 'gone' };
      if (near.some((l) => l.e.k === 'set' && !l.e.kind)) return { result: 'noop', why: 'overwritten' };
      if (slot.k !== 'static' || near.some((l) => l.e.k === 'set' && l.e.kind)) return { result: 'ask', why: 'kind-changed', choices: ['keep'], collateral: { records: recIds(near) } };
      return { result: 'revert', effects: [{ k: 'delta', at: E.at, d: E.d.map((x) => -x) }] };
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
const risky = (e) => e.k !== 'delta' && !(e.k === 'set' && (e.after === null || typeof e.after !== 'object' || e.after.k === 'static'));

/**
 * @param {import('./model.js').Draft} dr 控え（ここに当てていく）
 * @returns {{effects:any[], outcomes:any[], scans:any[], records:any[]}}
 */
export function planRevert(dr, log, body) {
  const idxs = body.targets.map((id) => { const i = logIndexOf(log, id); if (i < 0) throw new Reject('invalid', '戻す記録がない', { missing: id }); return i; });
  const set = new Set(idxs); need(set.size === idxs.length, '同じ記録が2回ある');
  const order = [...idxs].sort((a, b) => b - a); const decisions = body.decisions || {};
  const cover = dr.owned.has('cover') ? clone(dr.doc.cover) : dr.doc.cover; // 始めの時の固定で見る
  const effects = []; const outcomes = []; const scans = []; const ch = chains(log);
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
      const later = [];
      for (const j of logTouching(log, target, from)) {
        if (set.has(j)) continue; const r2 = logAt(log, j);
        r2.effects.forEach((e2, q) => { if (targetOf(e2) !== target || !ch.visible(`${r2.cmd.id}#${q}`)) return; const rel = relate(addr, addrOf(e2)); if (rel) later.push({ rec: r2, e: e2, rel }); });
      }
      let plan = classify(E, later, dr.doc);
      if (plan.result === 'ask') {
        const d = decisions[key];
        if (d === 'keep') plan = { result: 'kept', why: plan.why, collateral: plan.collateral };
        else if (d && plan.choices.includes(d) && plan.alt && plan.alt[d]) plan = { result: 'revert', effects: plan.alt[d](), forced: d, why: plan.why, collateral: plan.collateral };
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
        if (stop) { for (let q = done.length - 1; q >= 0; q--) applyEffect(dr, inverse(done[q])); plan = { result: 'ask', choices: ['keep'], ...stop }; }
        else { out.fx = [effects.length, plan.effects.length]; effects.push(...plan.effects); scans.push(...sc); }
      }
      out.result = plan.result === 'revert' ? 'reverted' : plan.result;
      for (const f of ['why', 'choices', 'collateral', 'forced']) if (plan[f] !== undefined) out[f] = plan[f];
      outcomes.push(out);
    }
  }
  return { effects, outcomes, scans, records: order.map((i) => logAt(log, i)) };
}
/** 結果の数え上げ */
export function tally(outcomes) {
  const t = { reverted: 0, noop: 0, ask: 0, kept: 0 }; for (const o of outcomes) t[o.result]++; return t;
}
