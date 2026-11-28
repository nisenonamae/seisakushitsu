// 命令の核。入口は4つ：apply（当てる）・check（当てずに見る）・replay（記録から作り直す）＋ revert は「revert の命令を apply する」。
// どれも「状態＋命令 → 新しい状態＋記録」か「断り＋理由」を返すだけの計算。時計・乱数・通信・画面に触らない。
// 状態 State = { doc, log }。doc は書きかえない（変える所だけ写した新しい doc を返す）。
import { Reject, need, isId, isObj, clone, canon, relate } from './util.js';
import { Draft, applyEffect, targetOf, addrOf, revOf, createDoc } from './model.js';
import { SPECS, migrateBody } from './commands.js';
import { checkInvariants } from './invariants.js';
import { preScan, postScan, judge } from './policy.js';
import { runRevert, tally } from './revert.js';
import { emptyLog, appendLog, logIndexOf, logAt, logTouching, logItems } from './log.js';

/** @typedef {{k:'human', device:string} | {k:'ai', agent:string}} Sender 確かめられた身元（呼び出す側が渡す） */
/** @typedef {{doc:any, log:any}} State */
export const REASONS = ['duplicate', 'invalid', 'forbidden', 'locked', 'stale', 'conflict', 'breaks-invariant'];

export function createState(init) { return { doc: createDoc(init), log: emptyLog() }; }

function checkEnvelope(c) {
  need(isObj(c), '命令の形'); need(typeof c.id === 'string' && c.id.length >= 1 && c.id.length <= 128, '命令の id');
  need(Number.isInteger(c.v) && c.v >= 1, '命令の版');
  need(isObj(c.actor) && (c.actor.k === 'human' || c.actor.k === 'ai'), '送り主の名乗り');
  need(c.group === undefined || typeof c.group === 'string', 'まとまりの id'); need(c.proposal === undefined || typeof c.proposal === 'string', '提案の id');
  need(c.base === undefined || (isObj(c.base) && Object.values(c.base).every((r) => Number.isInteger(r) && r >= 0)), '前提（base）');
  need(isObj(c.body) && typeof c.body.type === 'string' && Object.hasOwn(SPECS, c.body.type), '知らない種類の命令');
  need(c.v <= SPECS[c.body.type].v, 'この核より新しい版の命令');
}
function checkSender(s) { need(isObj(s) && ((s.k === 'human' && isId(s.device)) || (s.k === 'ai' && isId(s.agent))), '確かめられた身元（sender）が要る'); }

/** ④ 前提の検査：base の版が今より古ければ、あいだに入った記録の効果と、値の道ごとに比べる */
function checkBase(state, cmd, effects, draftDoc) {
  const base = cmd.base || {}; const seen = new Set();
  for (const e of effects) {
    const t = targetOf(e); if (seen.has(t)) continue; seen.add(t);
    const cur = revOf(state.doc, t); if (cur === 0) continue;                     // この命令（のまとまり）で初めてできた物
    if (!Object.hasOwn(base, t)) throw new Reject('stale', `前提（base）に ${t} の版がない`, { target: t, why: 'missing-base' });
    const b = base[t];
    if (b > revOf(draftDoc, t)) throw new Reject('stale', `${t}：まだ届いていない版を前提にしている`, { target: t, base: b, now: cur });
    if (b >= cur) continue;
    for (const i of logTouching(state.log, t)) {
      const rec = logAt(state.log, i); const rv = rec.revs.find((r) => r.target === t); if (!rv || rv.from < b) continue;
      for (const e2 of rec.effects) {
        if (targetOf(e2) !== t) continue;
        for (const e1 of effects) {
          if (targetOf(e1) !== t) continue; const rel = relate(addrOf(e1), addrOf(e2)); if (!rel) continue;
          if (rel === 'eq' && e1.k === 'delta' && e2.k === 'delta') continue;      // 足す量どうしは両方生かす
          throw new Reject('conflict', `${t}：同じ所を、あいだに入った変更が変えている`, { target: t, at: addrOf(e1).join('/'), with: rec.cmd.id });
        }
      }
    }
  }
}
function staleByBase(doc, cmd) { const base = cmd.base || {}; return Object.keys(base).some((t) => base[t] < revOf(doc, t)); }

/**
 * 命令のまとまりを当てる（全部入るか、何も入らないか）。
 * @param {State} state @param {any[]} cmds @param {{sender:Sender}} ctx @param {{dry?:boolean}} [opt]
 * @returns {{status:'applied'|'duplicate'|'proposed'|'rejected', state:State, applied?:any[], reason?:string, detail?:any, message?:string, at?:number, why?:string[], outcomes?:any[], effects?:any[]}}
 */
export function applyBatch(state, cmds, ctx, opt = {}) {
  const fail = (err, at) => ({ status: 'rejected', state, reason: err.reason, message: err.message, detail: err.detail, at });
  let at = 0;
  try {
    need(Array.isArray(cmds) && cmds.length >= 1 && cmds.length <= 10000, '命令の並び'); checkSender(ctx && ctx.sender);
    // ① 重複
    const ids = new Set(); let dup = 0;
    for (at = 0; at < cmds.length; at++) {
      const c = cmds[at]; need(isObj(c) && typeof c.id === 'string', '命令の id'); need(!ids.has(c.id), 'まとまりの中で id が重なっている'); ids.add(c.id);
      const i = logIndexOf(state.log, c.id);
      if (i >= 0) { if (canon(logAt(state.log, i).cmd) !== canon(c)) throw new Reject('duplicate', '同じ id で中身の違う命令', { id: c.id, why: 'id-reused' }); dup++; }
    }
    if (dup === cmds.length) return { status: 'duplicate', state, applied: cmds.map((c) => logAt(state.log, logIndexOf(state.log, c.id))) };
    if (dup > 0) throw new Reject('duplicate', 'まとまりの一部だけが当て済み', { why: 'partial' });

    const dr = new Draft(state.doc); const per = []; const why = []; const n0 = state.log.n; let outcomesAll = null; let planAll = null;
    for (at = 0; at < cmds.length; at++) {
      const cmd = cmds[at];
      // ② 形の検査
      checkEnvelope(cmd); const type = cmd.body.type; const spec = SPECS[type];
      const body = migrateBody(type, cmd.v, cmd.body); spec.check(body);
      const cover = dr.owned.has('cover') ? clone(dr.doc.cover) : dr.doc.cover;   // この命令の前の表紙
      const env = { by: ctx.sender.k === 'human' ? `human:${ctx.sender.device}` : `ai:${ctx.sender.agent}`, seq: n0 + at + 1 };
      let effects; let scans; let outcomes; let revertOf; let cat; let kept;
      if (type === 'revert') {
        cat = spec.cat(body, dr.doc);
        const plan = runRevert(dr, state.log, body, ctx.sender);                   // ⑤ も中で行う
        effects = plan.effects; scans = plan.scans; outcomes = plan.outcomes; revertOf = plan.records;
        if (plan.units) kept = { units: plan.units, containers: plan.containers, dropped: plan.dropped, auto: plan.auto };
        if ((body.onAsk === 'abort' || body.mode === 'undo' || body.mode === 'redo') && outcomes.some((o) => o.result === 'ask')) {
          return { status: 'rejected', state, reason: 'conflict', message: '聞かないと戻せない所がある', detail: { why: 'needs-answer' }, outcomes, at };
        }
        outcomesAll = (outcomesAll || []).concat(outcomes);
      } else {
        cat = spec.cat(body, dr.doc);
        try { effects = spec.run(dr.doc, body, env); } catch (err) {
          if (err instanceof Reject && err.reason === 'invalid' && err.detail && err.detail.missing && staleByBase(dr.doc, cmd)) throw new Reject('stale', err.message, err.detail);
          throw err;
        }
        scans = effects.map((e) => preScan(dr.doc, e));
      }
      // ③ 許しの検査（度合い・許可・固定）。送り主は ctx.sender だけで決める
      // 当てる前には判定できない物（移した先の親の鎖）があるので、控えに当ててから判定する。断るときは控えごと捨てる
      const baseErr = (() => { if (type === 'revert') return null; try { checkBase(state, cmd, effects, dr.doc); return null; } catch (err) { if (err instanceof Reject) return err; throw err; } })();
      if (type !== 'revert') { for (let i = 0; i < effects.length; i++) { applyEffect(dr, effects[i]); postScan(dr.doc, scans[i]); } } // ⑤ 控えの上で当てる
      const j = judge({ cover, sender: ctx.sender, cat, scans, revertOf });
      if (j.verdict === 'reject') throw new Reject(j.reason, '許しの外', j.detail);
      if (baseErr) throw baseErr;                                                  // ④ 前提
      if (j.verdict === 'propose') why.push(...j.why);
      const touched = [...new Set(effects.map(targetOf))];
      const revs = touched.map((t) => { const from = revOf(dr.doc, t); dr.bump(t); return { target: t, from, to: from + 1 }; });
      const a = { cmd: clone(cmd), seq: n0 + at + 1, batch: n0 + 1, sender: clone(ctx.sender), effects, revs, policy: j.policy };
      if (outcomes) { a.outcomes = outcomes; a.tally = tally(outcomes); }
      if (kept) { a.units = kept.units; a.containers = kept.containers; a.dropped = kept.dropped; a.auto = kept.auto; planAll = kept; }  // 残した物の一覧は、記録に残る
      per.push(a);
    }
    at = undefined;
    // ⑥ 全体の決まり
    const bad = checkInvariants(dr.doc);
    if (bad.length) throw new Reject('breaks-invariant', bad[0], { breaks: bad.slice(0, 20) });
    const extra = outcomesAll ? { outcomes: outcomesAll, tally: tally(outcomesAll), ...(planAll ? { plan: planAll } : {}) } : {};
    // 提案に回す：文書は変えない（検査は全部通っている）
    if (why.length) return { status: 'proposed', state, why: [...new Set(why)], effects: per.flatMap((a) => a.effects), ...extra };
    if (opt.dry) return { status: 'applied', state, applied: per, dry: true, ...extra };
    // ⑦ 控えを本物にし、記録に足す
    return { status: 'applied', state: { doc: dr.doc, log: appendLog(state.log, per) }, applied: per, ...extra };
  } catch (err) {
    if (err instanceof Reject) return fail(err, at);
    throw err;
  }
}
/** 命令を1つ当てる */
export const apply = (state, cmd, ctx) => applyBatch(state, [cmd], ctx);
/** 当てずに、通るかだけ見る（選んで取り消す前の一覧も、これで先に出せる） */
export const check = (state, cmds, ctx) => applyBatch(state, Array.isArray(cmds) ? cmds : [cmds], ctx, { dry: true });

/** 記録を、作り直しに使える形（命令と、確かめられた送り主だけ）にする。効果・版は入れない＝読む側が計算し直す */
export function toEntries(log) {
  const out = []; let cur = null;
  for (const a of logItems(log)) { if (!cur || cur.batch !== a.batch) out.push((cur = { batch: a.batch, sender: a.sender, cmds: [] })); cur.cmds.push(a.cmd); }
  return out.map(({ sender, cmds }) => ({ sender, cmds }));
}
/**
 * 記録から文書を作り直す。読むときも同じ検査を通し、通らない命令は当てない（skipped に理由つきで返す）。
 * @param {any} init 最初の文書の作り方（createState と同じ）
 * @param {{sender:Sender, cmds:any[]}[]} entries
 */
export function replay(init, entries) {
  let state = createState(init); const skipped = [];
  for (let i = 0; i < entries.length; i++) {
    const r = applyBatch(state, entries[i].cmds, { sender: entries[i].sender });
    if (r.status === 'applied') state = r.state; else skipped.push({ entry: i, status: r.status, reason: r.reason, why: r.why, message: r.message });
  }
  return { state, skipped };
}
