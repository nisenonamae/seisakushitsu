// 部品ごとにまとめる取り消し（9.5節②③）の測り。筋書きは、こちらで作った物（本物の操作ではない）。種つきなので、何回流しても同じ数字。
import { applyBatch, check, planRevert, rankBetween, makeUndo, logItems } from '../src/index.js';
import { Session, JOBS, humanStep, HUMAN, AI } from './scenarios.js';
import { humanWorkIntact } from './oracle.js';
import { buildProvenance, shareOf } from './provenance.js';

const S = (v) => ({ k: 'static', v }); const AI2 = { sender: { k: 'ai', agent: 'worker2' } };
const nodeOfAt = (at) => (at.startsWith('node/') ? at.split('/')[1] : null);

/** 戻す操作1回を測る。state は変えない */
export function measureRevert(before, ids, n = 0) {
  const T = new Set(ids); const plan = planRevert(before, ids);
  const mk = (body) => ({ id: `m${n}-${body.mode}`, v: 1, actor: { k: 'human', device: 'mac' }, body });
  const old = check(before, mk({ type: 'revert', mode: 'select', targets: ids }), HUMAN);
  const r = applyBatch(before, [mk({ type: 'revert', mode: 'units', targets: ids, at: plan.at })], HUMAN);
  if (r.status !== 'applied') return { failed: r.reason };
  const parts = new Map();
  for (const o of r.outcomes) { const id = nodeOfAt(o.at); if (!id) continue; if (!parts.has(id)) parts.set(id, { kept: 0, reverted: 0, noop: 0 }); parts.get(id)[o.result]++; }
  const pv = buildProvenance(r.state.log); const share = { total: 0, pure: 0, mixed: 0, other: 0, pts: 0, ptsPure: 0 };
  let keptParts = 0; let fullParts = 0; let mixedParts = 0; let untouchedByAnyone = 0;
  const unitNodes = new Set(plan.units.map((u) => u.node)); const contNodes = new Set(plan.containers.map((c) => c.node));
  for (const [id, c] of parts) {
    if (!c.kept) { if (c.reverted) fullParts++; else untouchedByAnyone++; continue; }
    keptParts++; const node = r.state.doc.nodes[id]; if (!node) continue;
    const s = shareOf(pv, node, T); for (const k of Object.keys(share)) share[k] += s[k];
    if (s.pure > 0 && s.other + s.mixed > 0) mixedParts++;
  }
  let humanTouches = 0; let aiTouches = 0; const by = { human: 0, ai: 0, both: 0, none: 0 }; const why = {}; let choosable = 0; let halfShapes = 0;
  for (const u of plan.units) {
    by[u.by]++; why[u.why] = (why[u.why] || 0) + 1; if (u.choices.includes('drop')) choosable++;
    for (const l of u.later) { if (l.sender.k === 'human') humanTouches++; else aiTouches++; }
    // 足した点は残るのに、同じ形の「今ある点」への AI の変更は戻った（＝人も AI も作っていない形になりうる）
    if (u.why === 'ai-added-items' && r.outcomes.some((o) => o.result === 'reverted' && o.at.startsWith(`node/${u.node}/geo/pts/`))) halfShapes++;
  }
  const asks = old.outcomes ? old.outcomes.filter((o) => o.result === 'ask').length : 0;
  const t = r.tally; const live = t.kept + t.reverted;
  return { effects: r.outcomes.length, kept: t.kept, reverted: t.reverted, noop: t.noop, live,
    units: plan.units.length, containers: plan.containers.length, unitParts: unitNodes.size, contParts: contNodes.size, shown: unitNodes.size,
    parts: parts.size, fullParts, keptParts, mixedParts, untouchedByAnyone, share, humanTouches, aiTouches, by, why, choosable, halfShapes, laterAI: plan.laterAI.length,
    oldAsks: asks, oldClicksDefault: asks, oldClicksAll: asks, newScreens: 1, newClicksDefault: 1, newClicksAll: plan.units.length ? 2 + choosable : 1,
    intact: humanWorkIntact(before, r.state, ids), state: r.state, plan };
}

const pre = (z) => { z.run(JOBS.scaffold(z, 'pre_scaffold'), AI, { group: 'pre_scaffold' }); for (let i = 0; i < 12; i++) humanStep(z, 'pre'); };
const steps = (z, h, tag = 'h') => { for (let i = 0; i < h; i++) humanStep(z, tag); };
const job = (z, name, tag = 'job', ctx = AI) => z.run(JOBS[name](z, tag), ctx, { group: tag });

/** 下組みを足し、同じ作業の中で、足した部品の色・点・位置も直す（1つの部品に、同じ作業の効果がいくつも乗る） */
function scaffoldRich(z, tag) {
  const bodies = JOBS.scaffold(z, tag); const parts = bodies.slice(1).map((b) => b.node);
  for (const n of parts) { if (z.chance(0.7)) bodies.push({ type: 'prop.set', node: n.id, path: 'fill.color', value: z.color() }); if (z.chance(0.6)) bodies.push({ type: 'prop.nudge', node: n.id, path: 'xf.pos', d: z.vec(10) });
    if (n.geo.t === 'path') for (const p of n.geo.pts) if (z.chance(0.3)) bodies.push({ type: 'pt.nudge', node: n.id, pt: p.id, d: z.vec(4) }); }
  return bodies;
}
/** 筋書き（作業の種類 × 人の直しの量）。BRIEF2 A-4 */
export const PLOTS2 = {
  '下組み（足して、同じ作業で色・点も直す）を戻す': (z, h) => { const ids = z.run(scaffoldRich(z, 'job'), AI, { group: 'job' }); steps(z, h); return ids; },
  '下組みを丸ごと戻す': (z, h) => { const ids = job(z, 'scaffold'); steps(z, h); return ids; },
  '手直しだけ戻す': (z, h) => { pre(z); const ids = job(z, 'tweak'); steps(z, h); return ids; },
  '足した点（なめらかに）だけ戻す': (z, h) => { pre(z); const ids = job(z, 'smooth'); steps(z, h); return ids; },
  '付けた動きだけ戻す': (z, h) => { pre(z); const ids = job(z, 'animate'); steps(z, h); return ids; },
};
/** 必ず確かめる場合 1〜7（BRIEF2 A-3）。どれも下組み（まとまり＋形 4〜7個）が相手 */
export const CASES = {
  '1 人が変えていない': (z) => job(z, 'scaffold'),
  '2 人が一部だけ変えた（点1つ／色だけ）': (z) => { const ids = job(z, 'scaffold'); const ps = z.paths(); const all = z.nodes((n) => n.kind !== 'group');
    if (z.chance(0.5) && ps.length) { const n = z.pick(ps); z.run([{ type: 'pt.nudge', node: n.id, pt: z.pick(n.geo.pts).id, d: z.vec(5) }], HUMAN); } else z.run([{ type: 'prop.set', node: z.pick(all).id, path: 'fill.color', value: z.color() }], HUMAN);
    return ids; },
  '3 人が大きく変えた（点の大半・形の種類・清書）': (z) => { const ids = job(z, 'scaffold');
    for (const n of z.nodes((x) => x.kind !== 'group')) { if (!z.chance(0.6)) continue; const r = z.rng();
      if (n.geo.t === 'path' && r < 0.5) { for (const p of n.geo.pts) if (z.chance(0.75)) z.run([{ type: 'pt.nudge', node: n.id, pt: p.id, d: z.vec(6) }], HUMAN); }
      else if (r < 0.75) z.run([{ type: 'geo.set', node: n.id, geo: n.geo.t === 'path' ? { t: 'ellipse', size: S([10 + z.R(20), 10 + z.R(20)]) } : { t: 'path', closed: true, pts: [0, 1, 2, 3].map((i) => ({ id: `c${i}`, p: S(z.vec(20)) })) } }], HUMAN);
      else if (n.geo.t === 'path') { z.run([{ type: 'geo.set', node: n.id, geo: { t: 'path', closed: true, pts: n.geo.pts.filter((_, i) => i % 2 === 0).map((p) => ({ id: p.id, p: S(z.vec(30)) })) } }], HUMAN); const m = z.doc.nodes[n.id]; if (m.geo.pts.length) z.run([{ type: 'pt.nudge', node: n.id, pt: m.geo.pts[0].id, d: z.vec(3) }], HUMAN); } }
    return ids; },
  '4 別の AI の変更が乗った': (z) => { const ids = job(z, 'scaffold'); job(z, 'tweak', 'job2', AI2); return ids; },
  '5a 人が子として部品を足した': (z) => { const ids = job(z, 'scaffold'); z.run([z.shapeBody('h_child', 'job_g', rankBetween(null, null) + 'k')], HUMAN); steps5(z, 'h_child'); return ids; },
  '5b 人が参照する部品を足した': (z) => { const ids = job(z, 'scaffold'); const b = z.shapeBody('h_ref', null, rankBetween(null, null) + 'k'); b.node.xf = { pos: { k: 'ref', to: { k: 'prop', node: 'job_s1', path: 'xf.pos' } } }; z.run([b], HUMAN); return ids; },
  '5c 人が関係のない部品を足した': (z) => { const ids = job(z, 'scaffold'); z.run([z.shapeBody('h_free', null, rankBetween(null, null) + 'k')], HUMAN); steps5(z, 'h_free'); return ids; },
  '6a 人→AI→人。あとの AI の分だけ戻す': (z) => { job(z, 'scaffold', 'pre_scaffold'); steps(z, 10); const ids = job(z, 'tweak', 'job2'); steps(z, 10); return ids; },
  '6b 人→AI→人。最初の AI の分を戻す': (z) => { const ids = job(z, 'scaffold'); steps(z, 10); job(z, 'tweak', 'job2'); steps(z, 10); return ids; },
};
function steps5(z, id) { const n = z.doc.nodes[id]; if (n && n.geo.t === 'path') for (let i = 0; i < 3; i++) z.run([{ type: 'pt.nudge', node: id, pt: z.pick(n.geo.pts).id, d: z.vec(4) }], HUMAN); }

export function runCase(name, seed) { const z = new Session(seed); const ids = CASES[name](z); if (!ids.length) return null; return measureRevert(z.s, ids, z.n); }
export function runPlot2(name, seed, h) { const z = new Session(seed); const ids = PLOTS2[name](z, h); if (!ids.length) return null; return measureRevert(z.s, ids, z.n); }

/** 場合7：計画を見て「全部外す」を選ぶ → 送る前に人が late 手なおす → 送る。断られたか・人の直しが壊れなかったか */
export function runCase7(seed, late) {
  const z = new Session(seed); const ids = job(z, 'scaffold'); steps(z, 6);
  const plan = planRevert(z.s, ids); const decisions = {}; const ack = {};
  for (const u of plan.units) if (u.choices.includes('drop')) { decisions[u.id] = 'drop'; ack[u.id] = u.later.map((l) => l.seq); }
  const n0 = z.s.log.n; steps(z, late, 'late'); const added = logItems(z.s.log).slice(n0);
  const before = z.s; const c = { id: 'case7-revert', v: 1, actor: { k: 'human', device: 'mac' }, body: { type: 'revert', mode: 'units', targets: ids, at: plan.at, decisions, ack } };
  const r = applyBatch(before, [c], HUMAN);
  // 送ったあとに入った人の記録のうち、外すと決めた部品に触れた物があるか（あれば、断られるのが正しい）
  const dropNodes = new Set(Object.keys(decisions).map((u) => u.split(':')[2]));
  const undone = new Set(added.filter((a) => a.cmd.body.type === 'revert').flatMap((a) => a.cmd.body.targets));
  const hit = added.some((a) => a.cmd.body.type !== 'revert' && !undone.has(a.cmd.id) && a.effects.some((e) => { const id = e.k === 'move' ? e.node : e.at[0] === 'node' ? (e.at.length > 1 ? e.at[1] : e.id) : null; return id && before.doc.nodes[id] && dropNodes.has(id); }));  // 部品ごと人が消した場合は数えない（外す相手がもう無い）。人が自分の直しを取り消しただけの場合も数えない
  return { drops: Object.keys(decisions).length, status: r.status, reason: r.reason, why: r.detail && r.detail.why, hit, unchanged: r.status !== 'applied' ? r.state === before : null,
    lostLate: r.status === 'applied' ? humanWorkIntact(before, r.state, ids).broken.filter((b) => added.some((a) => b.startsWith(a.cmd.id + '#'))) : [] };
}

/**
 * 「人の直しを、別の下地に当て直す」の試し（BRIEF2 A-5）。元の文書・記録は変えない：出し直した下組みの上に、人の命令を順に送り直すだけ。
 * 出し直した下組みは、id の付け方が同じ（job_s0…・p0…）で、部品の数・点の数・値が違う物（＝AI が id を引きついで出し直した、という甘い置き方）。
 */
export function runRebase(seed, h, sameShape) {
  const z = new Session(seed); const ids = job(z, 'scaffold'); steps(z, h);
  const T = new Set(ids); const undone = new Set();
  for (const a of logItems(z.s.log)) if (a.cmd.body.type === 'revert') for (const t of a.cmd.body.targets) undone.add(t);
  const human = logItems(z.s.log).filter((a) => !T.has(a.cmd.id) && a.sender.k === 'human' && a.cmd.body.type !== 'revert' && !undone.has(a.cmd.id));
  const z2 = new Session(sameShape ? seed : seed + 100003); job(z2, 'scaffold'); if (sameShape) z2.rng = () => 0.5;
  const res = { total: 0, applied: 0, byType: {} };
  for (const a of human) { const t = a.cmd.body.type; res.total++; const x = (res.byType[t] = res.byType[t] || [0, 0]); x[1]++;
    const r = applyBatch(z2.s, [z2.cmd(a.cmd.body, HUMAN)], HUMAN); if (r.status === 'applied') { z2.s = r.state; res.applied++; x[0]++; } }
  return res;
}
