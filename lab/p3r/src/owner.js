// だれの物か（P3r の B）。5つの情報を、別々に持つ。互いに上書きしない。
//  1 操作を行った主体 … 記録に保存する（Applied.sender＝確かめられた送り主。cmd.actor＝書いた主体。提案を採った時は actor=AI・sender=人）
//  2 今の持ち主       … 計算する（最初に足した記録の主体 ＋ 生きている引き取りの記録）
//  3 最初に作った主体 … 計算する（その部品を最初に足した記録。変わらない）
//  4 変更の由来       … 計算する（値の道ごと・点ごとに、今の値を最後に置いた記録と、上に乗っている足す量・掛ける量の記録）
//  5 操作のまとまり   … 記録に保存する（cmd.group・cmd.proposal・actor.task・核が付ける batch）。まとまりの一覧は計算する
// 保存するのは、あとから計算できない物（だれが送ったか・どれが1まとまりか）だけ。
// 計算する物を保存しない理由：保存すると、取り消し・やり直し・引き取りのたびに書きかえることになり、記録と食い違う道ができる。
import { logAt, logItems, logLength, logBase, createdAt, adoptedAt, chainsOf } from './log.js';
import { Reject } from './util.js';

const str = (s) => (s.k === 'human' ? `human:${s.device}` : `ai:${s.agent}`);
/** 記録1件の主体：by＝中身を作った主体／via＝それを文書に入れた主体（提案を人が採った時だけ by と違う）*/
export function makerOf(a) {
  const c = a.cmd; const via = str(a.sender);
  if (c.proposal !== undefined && c.actor && c.actor.k === 'ai' && a.sender.k === 'human') return { by: `ai:${c.actor.agent}`, via, proposal: c.proposal };
  return { by: via, via };
}
/** AI 由来の記録か（AI が当てた物・AI の提案を人が採った物） */
export const isAIRecord = (a) => makerOf(a).by.startsWith('ai:');

/** 3 最初に作った主体。pending＝同じまとまりの中で、先に当てた記録（まだ記録に入っていない）*/
export function creatorOf(log, node, pending = []) {
  const i = createdAt(log, node);
  if (i >= 0) { const a = logAt(log, i); return { ...makerOf(a), seq: a.seq, cmd: a.cmd.id }; }
  for (const a of pending) if (a.effects.some((e) => e.k === 'insert' && e.at.length === 1 && e.at[0] === 'node' && e.id === node)) return { ...makerOf(a), seq: a.seq, cmd: a.cmd.id };
  if (logBase(log) > 0) throw new Reject('needs-history', '写しより前の記録が要る（部品を足した記録を持っていない）', { why: 'creator', node });
  return null;
}
/** 2 今の持ち主（'human:端末' か 'ai:名前'）。引き取りが生きていれば、引き取った人 */
export function ownerOf(log, node, pending = []) {
  for (let j = pending.length - 1; j >= 0; j--) for (const e of pending[j].effects) if (e.k === 'own' && e.node === node) return e.to;
  const ad = adoptedAt(log, node); if (ad >= 0) return str(logAt(log, ad).sender);
  const c = creatorOf(log, node, pending); return c ? c.by : null;
}
/** 部品1つの帳簿（2・3 と、引き取りの記録） */
export function whoOf(log, node) {
  const creator = creatorOf(log, node); if (!creator) return null;
  const ad = adoptedAt(log, node); const a = ad >= 0 ? logAt(log, ad) : null;
  return { creator, owner: a ? str(a.sender) : creator.by, adopted: a ? { by: str(a.sender), seq: a.seq, cmd: a.cmd.id } : null };
}

// ---- 4 変更の由来（lab/p3a/tools/provenance.js を写して、引き取り〔own〕を由来に数えないようにした物）
const addrOfE = (e) => (e.k === 'move' ? ['node', e.node, '@place'] : e.k === 'insert' || e.k === 'remove' ? [...e.at, e.id] : e.at);
const tOf = (a) => (a[0] === 'cover' ? 'cover' : `${a[0]}:${a[1]}`);
const K = (a) => a.join('/');
/** @returns {{prov:Map<string, Map<string,{w:string,on:string[]}>>, lookup:(addr:string[])=>{w:string,on:string[]}|null}} 物ごと → 番地 → { w:置いた命令, on:上に足した・掛けた命令 } */
export function buildProvenance(log) {
  const prov = new Map(); const prev = new Map();
  const mapOf = (t) => { let m = prov.get(t); if (!m) prov.set(t, (m = new Map())); return m; };
  const under = (m, key) => [...m.keys()].filter((k) => k === key || k.startsWith(key + '/'));
  const lookup = (m, addr) => { for (let n = addr.length; n >= 2; n--) { const x = m.get(K(addr.slice(0, n))); if (x) return x; } return null; };
  for (const a of logItems(log)) {
    const back = new Map(); // revert の効果の番号 → 元の効果
    if (a.cmd.body.type === 'revert') for (const o of a.outcomes || []) if (o.result === 'reverted' && !o.forced && o.fx && o.fx[1] === 1) back.set(o.fx[0], o.key);
    a.effects.forEach((e, i) => {
      if (e.k === 'own') return;                                   // 引き取りは、由来を変えない
      const addr = addrOfE(e); const m = mapOf(tOf(addr)); const key = K(addr); const mine = `${a.cmd.id}#${i}`; const orig = back.get(i);
      const snap = under(m, key).map((k) => [k, { w: m.get(k).w, on: m.get(k).on.slice() }]);
      prev.set(mine, { snap, cover: snap.some(([k]) => k === key) ? null : lookup(m, addr) });
      if (orig !== undefined && prev.has(orig)) {
        const cmd = orig.slice(0, orig.lastIndexOf('#'));
        if (e.k === 'delta' || e.k === 'mul') { const x = m.get(key) || lookup(m, addr); if (x) { const j = x.on.indexOf(cmd); if (j >= 0) x.on.splice(j, 1); else x.on.push(cmd); } return; }
        for (const k of under(m, key)) m.delete(k);
        for (const [k, v] of prev.get(orig).snap) m.set(k, { w: v.w, on: v.on.slice() });
        return;
      }
      if (e.k === 'delta' || e.k === 'mul') { let x = m.get(key); if (!x) { const c = lookup(m, addr); x = { w: c ? c.w : '?', on: c ? c.on.slice() : [] }; m.set(key, x); } x.on.push(a.cmd.id); return; }
      for (const k of under(m, key)) m.delete(k);
      if (e.k !== 'remove') m.set(key, { w: a.cmd.id, on: [] });
    });
  }
  return { prov, lookup: (addr) => { const m = prov.get(tOf(addr)); return m ? lookup(m, addr) : null; } };
}
/** 番地1つの由来を、人が読める形に：置いた記録の主体（AI が作り人が採った、も分かる）と、上に乗っている操作の主体 */
export function originOf(log, pv, addr, idx) {
  const x = pv.lookup(addr); if (!x) return null;
  const who = (cmd) => { const i = idx(cmd); if (i < 0) return { cmd }; const a = logAt(log, i); return { cmd, seq: a.seq, ...makerOf(a) }; };
  return { set: who(x.w), on: x.on.map(who) };
}

// ---- 5 取り消しの相手になる、操作のまとまり
/** 記録1件が属するまとまりの鍵：提案 ＞ AI の作業（task）＞ group ＞ 1回の apply（batch） */
export function bundleKey(a) {
  const c = a.cmd;
  if (c.proposal !== undefined) return `proposal:${c.proposal}`;
  if (a.sender.k === 'ai' && c.actor && c.actor.task !== undefined) return `task:${a.sender.agent}:${c.actor.task}`;
  if (c.group !== undefined) return `group:${c.group}`;
  return `batch:${a.batch}`;
}
/** まとまりの一覧（取り消し〔revert〕の記録は、相手にしないので入れない）*/
export function bundles(log) {
  const m = new Map();
  for (const a of logItems(log)) {
    if (a.cmd.body.type === 'revert') continue; const k = bundleKey(a);
    let b = m.get(k); if (!b) m.set(k, (b = { key: k, kind: k.slice(0, k.indexOf(':')), by: makerOf(a).by, via: makerOf(a).via, ids: [], from: a.seq, to: a.seq }));
    b.ids.push(a.cmd.id); b.to = a.seq;
  }
  return [...m.values()];
}
/** 文書に今ある部品の全部の帳簿（写しに入れる「控え」にも使う。記録から作り直せる）*/
export function ledger(state) {
  const out = {}; for (const id of Object.keys(state.doc.nodes).sort()) out[id] = whoOf(state.log, id); return out;
}
export { chainsOf, logLength };
