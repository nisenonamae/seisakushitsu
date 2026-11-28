// 記録（足すだけ）。状態は { store, n }＝「この入れ物の、頭から n 個」を見ている、という形で持つ。
// 古い状態から枝分かれして足すときは、入れ物を写してから足す（古い状態から見える物は変わらない）。
//
// P3r で足した物（どれも「記録から計算できる索引」。保存しなくても、記録を頭から足し直せば同じ物になる）：
//  ・取り消しの鎖（どの効果が、いま生きているか）
//  ・値の道ごとの「起点（最後の置きかえ・足した時）」と「足した量・掛けた量の並び」＝組み立て直しの材料
//  ・部品を最初に足した記録／引き取りの記録
//  ・端末ごとの、取り消せる物・やり直せる物の積み重ね
//  ・写しから始めた記録（頭の base 件を持っていない）。古い記録が要る時は、断る（needs-history）→ 呼ぶ側が古い記録を読み足す
import { targetOf, addrOf } from './model.js';
import { akey } from './util.js';

class Store {
  /** @param {number} base 持っていない頭の件数（写しから始めた時）@param {any} baseRevs 写しの時点の版 */
  constructor(base = 0, baseRevs = null) {
    this.base = base; this.baseRevs = baseRevs;
    this.items = []; if (base) this.items.length = base;
    this.byId = new Map(); this.byTarget = new Map(); this.reverts = [];
    // 取り消しの鎖
    this.spent = new Set(); this.rootOf = new Map(); this.count = new Map(); this.lastOf = new Map();
    // 組み立て直しの材料：番地 → 起点 [記録の位置, 効果の番号]／番地 → 足した量・掛けた量の並び（位置と番号を交互に）
    this.anchors = new Map(); this.ops = new Map();
    // だれの物か：部品 → 最初に足した記録の位置／部品 → 引き取りの記録の位置（古い順）
    this.created = new Map(); this.adopts = new Map();
    // 端末ごとの、取り消し・やり直しの積み重ね
    this.stacks = new Map();
  }
  push(a) {
    const i = this.items.length; this.items.push(a); this.byId.set(a.cmd.id, i);
    const isRevert = a.cmd.body.type === 'revert'; if (isRevert) this.reverts.push(i);
    const seen = new Set();
    for (let q = 0; q < a.effects.length; q++) {
      const e = a.effects[q]; const t = targetOf(e);
      if (!seen.has(t)) { seen.add(t); let l = this.byTarget.get(t); if (!l) this.byTarget.set(t, (l = [])); l.push(i); }
      if (e.k === 'set' || e.k === 'insert' || e.k === 'remove') {
        this.anchors.set(akey(addrOf(e)), [i, q]);
        if (e.k === 'insert' && e.at.length === 1 && e.at[0] === 'node' && !this.created.has(e.id)) this.created.set(e.id, i);
      } else if ((e.k === 'delta' || e.k === 'mul') && !isRevert) {
        const k = akey(e.at); let l = this.ops.get(k); if (!l) this.ops.set(k, (l = [])); l.push(i, q);
      } else if (e.k === 'own' && !isRevert) { let l = this.adopts.get(e.node); if (!l) this.adopts.set(e.node, (l = [])); l.push(i); }
    }
    if (isRevert) for (const o of a.outcomes || []) {
      if (o.result !== 'reverted') continue; this.spent.add(o.key);
      if (o.forced || !o.fx || o.fx[1] !== 1) continue;                    // 人の直しごと外した物などは、打ち消しに数えない
      const root = this.rootOf.get(o.key) || o.key; const mine = `${a.cmd.id}#${o.fx[0]}`;
      this.rootOf.set(mine, root); this.count.set(root, (this.count.get(root) || 1) + 1); this.lastOf.set(root, { idx: i, i: o.fx[0] });
    }
    if (a.sender && a.sender.k === 'human') {
      let s = this.stacks.get(a.sender.device); if (!s) this.stacks.set(a.sender.device, (s = { undo: [], redo: [], batch: -1, cur: null }));
      if (s.batch === a.batch && s.cur) s.cur.push(a.cmd.id);
      else {
        s.batch = a.batch; s.cur = [a.cmd.id]; const mode = isRevert ? a.cmd.body.mode : undefined;
        if (mode === 'undo') { s.undo.pop(); s.redo.push(s.cur); }
        else if (mode === 'redo') { s.redo.pop(); s.undo.push(s.cur); }    // やり直した結果（revert の記録）が、次に取り消す相手になる
        else { s.undo.push(s.cur); s.redo.length = 0; }
      }
    }
  }
}
export const emptyLog = (base = 0, baseRevs = null) => ({ store: new Store(base, baseRevs), n: base });
function fork(log) { const f = new Store(log.store.base, log.store.baseRevs); for (let i = log.store.base; i < log.n; i++) f.push(log.store.items[i]); return f; }
export function appendLog(log, applieds) {
  let st = log.store;
  if (st.items.length !== log.n) st = fork(log);
  for (const a of applieds) st.push(a);
  return { store: st, n: log.n + applieds.length };
}
/** 索引を読むための入れ物。古い状態（n が入れ物より短い）からは、その時点までの索引を作り直して使う */
const views = new WeakMap();
export function view(log) {
  if (log.store.items.length === log.n) return log.store;
  let v = views.get(log); if (!v) views.set(log, (v = fork(log))); return v;
}
export const logLength = (log) => log.n;
/** 持っていない頭の件数（写しから始めた時だけ 0 より大きい） */
export const logBase = (log) => log.store.base;
export const logBaseRevs = (log) => log.store.baseRevs;
export const logAt = (log, i) => (i >= log.store.base && i < log.n ? log.store.items[i] : undefined);
/** 記録の写し（配列）。持っている分だけ */
export const logItems = (log) => log.store.items.slice(log.store.base, log.n);
/** 命令の id から、記録の中の位置。無ければ -1 */
export function logIndexOf(log, cmdId) { const i = log.store.byId.get(cmdId); return i !== undefined && i < log.n ? i : -1; }
function lower(l, x) { let lo = 0; let hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (l[m] <= x) lo = m + 1; else hi = m; } return lo; }
/** その「物」に触れた記録の位置（古い順）。from より後ろだけ */
export function logTouching(log, target, from = -1) {
  const l = log.store.byTarget.get(target); if (!l) return [];
  const out = []; for (let j = lower(l, from); j < l.length; j++) { if (l[j] >= log.n) break; out.push(l[j]); } return out;
}
/** 取り消し（revert）の記録の位置（古い順） */
export function logReverts(log) { const out = []; for (const i of log.store.reverts) if (i < log.n) out.push(i); return out; }

/**
 * 取り消しの鎖。「効果 x を、あとの取り消し y がきれいに戻した（y をさらに z が戻した…）」とき、
 *  ・x と y は打ち消し合っている（鎖の長さが偶数）＝その所には、だれの直しも残っていない → 「その後に起きたこと」に数えない
 *  ・やり直し（z）で鎖が奇数になったら、x が生きている。いま文書に効いているのは鎖の最後の効果
 * 記録が1件足されるたびに足していく（取り消しのたびに記録を頭から数え直さない）。
 */
export function chainsOf(log) {
  const s = view(log);
  return { spent: s.spent, lastOf: s.lastOf, root: (key) => s.rootOf.get(key) || key, parity: (key) => (s.count.get(key) || 1) % 2,
    /** 「その後に起きたこと」として数える効果か（＝取り消しの効果でなく、いま生きている） */
    visible: (key) => !s.rootOf.has(key) && (s.count.get(key) || 1) % 2 === 1 };
}
/**
 * 組み立て直しの材料：番地の「起点」（いちばん新しい置きかえ・足した・外した効果）と、そのあとの足した量・掛けた量。
 * @returns {{anchor:[number,number]|null, ops:[number,number][]}} 位置と効果の番号
 */
export function pathOps(log, addr) {
  const s = view(log); let best = null;
  for (let n = 1; n <= addr.length; n++) { const a = s.anchors.get(akey(addr.slice(0, n))); if (a && (!best || a[0] > best[0] || (a[0] === best[0] && a[1] > best[1]))) best = a; }
  const l = s.ops.get(akey(addr)) || []; const ops = [];
  let lo = 0; let hi = l.length >> 1; const after = (j) => !best || l[2 * j] > best[0] || (l[2 * j] === best[0] && l[2 * j + 1] > best[1]);
  while (lo < hi) { const m = (lo + hi) >> 1; if (after(m)) hi = m; else lo = m + 1; }
  for (let j = lo; j < l.length >> 1; j++) ops.push([l[2 * j], l[2 * j + 1]]);
  return { anchor: best, ops };
}
/** 部品を最初に足した記録の位置（無ければ -1） */
export function createdAt(log, node) { const i = view(log).created.get(node); return i === undefined ? -1 : i; }
/** 部品の、いま生きている引き取りの記録の位置（いちばん新しい物。無ければ -1） */
export function adoptedAt(log, node) {
  const s = view(log); const l = s.adopts.get(node); if (!l) return -1;
  for (let j = l.length - 1; j >= 0; j--) { const key = `${s.items[l[j]].cmd.id}#0`; if ((s.count.get(key) || 1) % 2 === 1) return l[j]; }
  return -1;
}
/** 端末ごとの積み重ね（読むだけ） */
export function stacksOf(log, device) { const s = view(log).stacks.get(device); return s ? { undo: s.undo, redo: s.redo } : { undo: [], redo: [] }; }
