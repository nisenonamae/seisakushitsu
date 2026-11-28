// 部品ごとの取り消しの改善案を、同じ筋書き・同じ物差しで比べる（BRIEF3 の B）。筋書きは作り物（種つきの乱数）。
//   M1   部品を丸ごと残す（今の方式。revert mode:'units'）
//   M1w  M1＋同じ作業が同じ形の「今ある点」に加えた変更も、足した点と一緒に残す（wide。RESULTS2 ⑦の4 の案）
//   M2   人が変えた値だけを保ち、AI の変更を戻す：足した点・鍵の単位を、1つずつに割る（split）。AI が足した部品は「戻す先」が無いので割らない
//   M3   人の変更を別の下地へ移す：元は変えず、「その AI の作業が無かった文書」を横に作って、残りの命令を当て直す（rebaseWithout）
//   M4   AI が足した部品を、人が「自分の物」として引き取る（node.adopt）。引き取った部品は、次からは戻す相手にならない
// どの方式も、人の変更を推し量って消す所は無い（迷う物は残す。M3 は元を変えない）。
import { createState, applyBatch, planRevert, logItems, getAt, canon, content, checkInvariants } from '../src/index.js';
import { Session, JOBS, humanStep, HUMAN, AI } from './scenarios.js';
import { PLOTS2, CASES } from './scenarios2.js';
import { humanWorkIntact } from './oracle.js';
import { buildProvenance, leavesOf } from './provenance.js';

export const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai' } }; // Session と同じ始まり
export const ROPT = { M1: { wide: false }, M1w: {}, M2: { split: true, wide: false }, 'M2w': { split: true, wide: true } };
const leafVal = (doc, a) => { if (a[2] === '@place') { const n = doc.nodes[a[1]]; return n ? [n.parent, n.order] : undefined; } return getAt(doc, a); };
const classOf = (pv, addr, T) => { const x = pv.lookup(addr); if (!x) return null; const ws = [x.w, ...x.on]; const k = ws.filter((w) => T.has(w)).length; return k === ws.length ? 'pure' : k === 0 ? 'other' : 'mixed'; };
/** 文書の値の置き場を、戻したかった作業 T から見て数える：pure＝T だけ／mixed＝T と人が混ざる／other＝T は関わっていない */
export function countLeaves(state, T) { const pv = buildProvenance(state.log); const r = { pure: 0, mixed: 0, other: 0 }; for (const n of Object.values(state.doc.nodes)) for (const a of leavesOf(n)) { const c = classOf(pv, a, T); if (c) r[c]++; } return r; }
const degenerate = (doc) => Object.values(doc.nodes).filter((n) => n.geo && n.geo.t === 'path' && n.geo.pts.length < (n.geo.closed ? 3 : 2)).length;

/**
 * 取り消しの結果を、核とは別のやり方で採点する。
 * @returns 人の直しが壊れた数（2通りの確かめ）・残った AI の値・形が割れた数・全体の決まりの破れ
 */
export function judgeResult(before, after, ids, outcomes) {
  const T = new Set(ids); const o1 = humanWorkIntact(before, after, ids);
  // 別の確かめ：取り消す前に「T が関わっていない値」（人・ほかの作業だけの値）は、取り消したあとも同じ値のはず
  const pv = buildProvenance(before.log); let checked2 = 0; const broken2 = [];
  for (const n of Object.values(before.doc.nodes)) for (const a of leavesOf(n)) { if (classOf(pv, a, T) !== 'other') continue; checked2++; if (canon(leafVal(before.doc, a) ?? null) !== canon(leafVal(after.doc, a) ?? null)) broken2.push(a.join('/')); }
  const lb = countLeaves(before, T); const la = countLeaves(after, T);
  // 形が割れた：1つの形（geo）への同じ作業の変更のうち、一部は戻り、一部は残った（＝人も AI も作っていない形）
  const geo = new Map(); const part = new Map();
  for (const o of outcomes) { if (!o.at.startsWith('node/')) continue; const seg = o.at.split('/'); const id = seg[1]; if (o.result !== 'kept' && o.result !== 'reverted') continue;
    if (seg[2] === 'geo') { const g = geo.get(id) || { kept: 0, reverted: 0 }; g[o.result]++; geo.set(id, g); }
    const p = part.get(id) || { kept: 0, reverted: 0, ins: false }; p[o.result]++; if (seg.length === 2 && o.k === 'insert' && o.result === 'kept') p.ins = true; part.set(id, p); }
  const splitGeo = [...geo.entries()].filter(([id, g]) => g.kept && g.reverted && after.doc.nodes[id]).length;
  const splitPart = [...part.entries()].filter(([id, p]) => p.ins && p.reverted && after.doc.nodes[id]).length; // AI が足して残した部品なのに、その部品への同じ作業の変更だけ戻った
  const kept = outcomes.filter((o) => o.result === 'kept').length; const reverted = outcomes.filter((o) => o.result === 'reverted').length;
  const keptHasBefore = outcomes.filter((o) => o.result === 'kept' && (o.k === 'set' || o.k === 'delta' || o.k === 'mul') && part.get(o.at.split('/')[1]) && part.get(o.at.split('/')[1]).ins).length; // 残した AI の部品への、戻す先（AI の途中の値）だけはある効果
  return { keptHasBefore, broken1: o1.broken, checked1: o1.checked, broken2, checked2, kept, live: kept + reverted, pureBefore: lb.pure, pureAfter: la.pure, mixedAfter: la.mixed, splitGeo, splitPart,
    invariants: checkInvariants(after.doc).length, degenerate: Math.max(0, degenerate(after.doc) - degenerate(before.doc)) };
}
const mk = (id, body) => ({ id, v: 1, actor: { k: 'human', device: 'mac' }, body });
/** M1・M1w・M2：部品ごとの取り消し（既定＝全部残す）を当てて採点する */
export function runUnits(before, ids, method, tag = 'x') {
  const ropt = ROPT[method]; const plan = planRevert(before, ids, ropt);
  const r = applyBatch(before, [mk(`${tag}-${method}`, { type: 'revert', mode: 'units', targets: ids, at: plan.at, ...ropt })], HUMAN);
  if (r.status !== 'applied') return { failed: r.reason };
  const choosable = plan.units.filter((u) => u.choices.includes('drop')).length;
  return { ...judgeResult(before, r.state, ids, r.outcomes), units: plan.units.length, choosable, screens: 1, clicksDefault: 1, clicksAll: plan.units.length ? 2 + choosable : 1, state: r.state, plan,
    splitOut: r.outcomes.filter((o) => o.split).length };
}
/**
 * M3：「その AI の作業が無かった文書」を横に作り、残りの命令を、記録の順に当て直す。元の文書・記録は変えない。
 * 当たらなかった命令は、当てずに一覧で返す。前提（base）は、新しい文書の今の版に付け直す。
 * @returns {{state:any, carried:number, failed:{cmd:string,type:string,sender:string,reason:string}[], ctxDiff:number, humanTotal:number}}
 */
export function rebaseWithout(state, ids, init = INIT) {
  const T = new Set(ids); let s2 = createState(init); let orig = createState(init); const failed = []; let carried = 0; let ctxDiff = 0; let humanTotal = 0; let cur = null; const batches = [];
  for (const a of logItems(state.log)) { if (!cur || cur.batch !== a.batch) batches.push((cur = { batch: a.batch, sender: a.sender, cmds: [] })); cur.cmds.push(a.cmd); }
  for (const b of batches) {
    const ctx = { sender: b.sender }; const o0 = orig; const ro = applyBatch(orig, b.cmds, ctx); if (ro.status !== 'applied') throw new Error('元の記録が流れない：' + ro.message); orig = ro.state;
    const rest = b.cmds.filter((c) => !T.has(c.id)); if (!rest.length) continue; if (b.sender.k === 'human') humanTotal += rest.length;
    const cmds = rest.map((c) => { const body = { ...c.body }; delete body.at; return { ...c, base: { ...s2.doc.revs }, body }; });
    const r = applyBatch(s2, cmds, ctx);
    if (r.status !== 'applied') { for (const c of rest) failed.push({ cmd: c.id, type: c.body.type, sender: b.sender.k, reason: r.reason }); continue; }
    // 当たった命令のうち、相手の部品の中身が、元の時と違っていた物（＝違う下地の上に当てた直し。値は入ったが、意味が同じとは限らない）
    for (const c of rest) { const id = c.body.node && typeof c.body.node === 'string' ? c.body.node : null; if (id && o0.doc.nodes[id] && canon(o0.doc.nodes[id]) !== canon(s2.doc.nodes[id] ?? null)) ctxDiff++; }
    s2 = r.state; carried += rest.length;
  }
  return { state: s2, carried, failed, ctxDiff, humanTotal };
}
export function runRebaseWithout(before, ids) {
  const v = rebaseWithout(before, ids); const T = new Set(ids); const hf = v.failed.filter((f) => f.sender === 'human');
  const byType = {}; for (const f of hf) byType[f.type] = (byType[f.type] || 0) + 1;
  return { humanTotal: v.humanTotal, humanFailed: hf.length, failedByType: byType, otherFailed: v.failed.length - hf.length, ctxDiff: v.ctxDiff, pureAfter: countLeaves(v.state, T).pure, pureBefore: countLeaves(before, T).pure,
    invariants: checkInvariants(v.state.doc).length, degenerate: degenerate(v.state.doc), state: v.state, screens: 1, clicksDefault: 2 };
}
/** M4：M1 で戻したあと、残った「AI が足した部品」の単位を、人が引き取る（1つの画面の［残して自分の物にする］1回、という置き方） */
export function adoptKept(state, plan, tag = 'x') {
  const nodes = plan.units.filter((u) => u.why === 'ai-added-part').map((u) => u.node).filter((id) => state.doc.nodes[id]); if (!nodes.length) return { state, adopted: 0 };
  const r = applyBatch(state, nodes.map((id, i) => ({ ...mk(`${tag}-adopt${i}`, { type: 'node.adopt', node: id }), base: { ...state.doc.revs } })), HUMAN);
  if (r.status !== 'applied') throw new Error('引き取れない：' + r.message);
  return { state: r.state, adopted: nodes.length };
}

// ───── 筋書き
const steps = (z, h, tag = 'h') => { for (let i = 0; i < h; i++) humanStep(z, tag); };
/** 筋書きを作る：{ z, ids }。name は CASES（場合 1〜6）か PLOTS2（筋書き）の名前 */
const S = (v) => ({ k: 'static', v });
/** 足した筋書き：AI が、1つの形に点を 3〜5 個足し、今ある点の取っ手も直す（方式2＝点の組を割る、の違いが出る所。前回の「なめらかに」は、1つの形に点 1 個だった） */
export const EXTRA = {
  '足した点（1つの形に 3〜5 個）だけ戻す': (z, h) => { z.run(JOBS.scaffold(z, 'pre_scaffold'), AI, { group: 'pre_scaffold' }); steps(z, 12, 'pre');
    const bodies = []; let k = 0;
    for (const n of z.paths()) { if (!z.chance(0.7)) continue; const pts = n.geo.pts;
      for (let i = 0, m = 3 + z.R(3); i < m; i++) bodies.push({ type: 'pt.add', node: n.id, pt: { id: `job_p${k++}`, p: S(z.vec(30)), in: S(z.vec(5)), out: S(z.vec(5)) }, after: z.pick(pts).id });
      for (const p of pts) if (z.chance(0.3)) bodies.push({ type: 'pt.handle', node: n.id, pt: p.id, which: z.pick(['in', 'out']), value: S(z.vec(8)) }); }
    const ids = z.run(bodies, AI, { group: 'job' }); steps(z, h); return ids; },
};
export function build(name, seed, h) { const z = new Session(seed); const ids = (CASES[name] || PLOTS2[name] || EXTRA[name])(z, h); return { z, ids }; }
export const ALL_METHODS = ['M1', 'M1w', 'M2'];
/** 1つの筋書きを、全部の方式で測る */
export function compareOne(name, seed, h) {
  const { z, ids } = build(name, seed, h); if (!ids.length) return null; const out = { M3: runRebaseWithout(z.s, ids) };
  for (const m of ALL_METHODS) out[m] = runUnits(z.s, ids, m, `m${z.n}`);
  // M3 の文書が、M1 の文書（既定で戻した結果）と同じ中身か
  out.M3.sameAsM1 = !out.M1.failed && canon(content(out.M3.state.doc).nodes) === canon(content(out.M1.state.doc).nodes);
  return out;
}
/**
 * 2回めの取り消し（M1 と M4 の違いが出る所）：戻す → 人が続けて直す（h2 手）→ 同じ作業を、もう一度「AI の分だけ戻す」。
 * M1 は、残した部品が毎回また単位として出る。M4 は、1回めに引き取った部品は出ない。
 */
export function secondRevert(name, seed, h, h2 = 5) {
  const { z, ids } = build(name, seed, h); if (!ids.length) return null; const r1 = runUnits(z.s, ids, 'M1', `a${z.n}`); if (r1.failed) return null;
  const go = (state, tag) => { const z2 = Object.assign(Object.create(Session.prototype), z, { s: state, n: z.n + 1000, rejected: [] }); z2.rng = (() => { let a = seed * 7919 + 17; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x80000000; }; })(); steps(z2, h2, tag);
    const plan = planRevert(z2.s, ids); const r = applyBatch(z2.s, [mk(`${tag}-second`, { type: 'revert', mode: 'units', targets: ids, at: plan.at })], HUMAN);
    return { units: plan.units.length, ok: r.status === 'applied', broken: r.status === 'applied' ? humanWorkIntact(z2.s, r.state, ids).broken.length : 0, pure: r.status === 'applied' ? countLeaves(r.state, new Set(ids)).pure : 0 }; };
  const ad = adoptKept(r1.state, r1.plan, `a${z.n}`);
  return { first: r1.units, adopted: ad.adopted, m1: go(r1.state, 'p'), m4: go(ad.state, 'q'), sameDoc: canon(content(ad.state.doc)) === canon(content(r1.state.doc)) };
}
/** 場合7：計画を見て、選べる単位を全部「外す」→ 送る前に人が late 手なおす → 送る */
export function case7(seed, late, method) {
  const ropt = ROPT[method]; const z = new Session(seed); const ids = z.run(JOBS.scaffold(z, 'job'), AI, { group: 'job' }); steps(z, 6);
  const plan = planRevert(z.s, ids, ropt); const decisions = {}; const ack = {};
  for (const u of plan.units) if (u.choices.includes('drop')) { decisions[u.id] = 'drop'; ack[u.id] = u.later.map((l) => l.seq); }
  const n0 = z.s.log.n; steps(z, late, 'late'); const added = logItems(z.s.log).slice(n0); const before = z.s;
  const r = applyBatch(before, [mk('case7', { type: 'revert', mode: 'units', targets: ids, at: plan.at, decisions, ack, ...ropt })], HUMAN);
  const lost = r.status === 'applied' ? humanWorkIntact(before, r.state, ids).broken.filter((b) => added.some((a) => b.startsWith(a.cmd.id + '#'))).length : 0;
  // M3：送る前の直しも、当て直しに入る（計画を作り直すだけ。断りは無い）
  const v = rebaseWithout(before, ids); const lateIds = new Set(added.filter((a) => a.sender.k === 'human').map((a) => a.cmd.id));
  return { drops: Object.keys(decisions).length, status: r.status, reason: r.reason, unchanged: r.status !== 'applied' ? r.state === before : null, lost, late: lateIds.size, lateFailed: v.failed.filter((f) => lateIds.has(f.cmd)).length };
}
