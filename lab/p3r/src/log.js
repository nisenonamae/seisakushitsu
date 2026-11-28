// 記録（足すだけ）。状態は { store, n }＝「この入れ物の、頭から n 個」を見ている、という形で持つ。
// 古い状態から枝分かれして足すときは、入れ物を写してから足す（古い状態から見える物は変わらない）。
import { targetOf } from './model.js';

class Store {
  constructor() { this.items = []; this.byId = new Map(); this.byTarget = new Map(); this.reverts = []; }
  push(a) {
    const i = this.items.length; this.items.push(a); this.byId.set(a.cmd.id, i); if (a.cmd.body.type === 'revert') this.reverts.push(i);
    const seen = new Set();
    for (const e of a.effects) { const t = targetOf(e); if (seen.has(t)) continue; seen.add(t); let l = this.byTarget.get(t); if (!l) this.byTarget.set(t, (l = [])); l.push(i); }
  }
}
export const emptyLog = () => ({ store: new Store(), n: 0 });
export function appendLog(log, applieds) {
  let st = log.store;
  if (st.items.length !== log.n) { const f = new Store(); for (let i = 0; i < log.n; i++) f.push(st.items[i]); st = f; }
  for (const a of applieds) st.push(a);
  return { store: st, n: log.n + applieds.length };
}
export const logLength = (log) => log.n;
export const logAt = (log, i) => (i >= 0 && i < log.n ? log.store.items[i] : undefined);
/** 記録の写し（配列） */
export const logItems = (log) => log.store.items.slice(0, log.n);
/** 命令の id から、記録の中の位置。無ければ -1 */
export function logIndexOf(log, cmdId) { const i = log.store.byId.get(cmdId); return i !== undefined && i < log.n ? i : -1; }
/** その「物」に触れた記録の位置（古い順）。from より後ろだけ */
export function logTouching(log, target, from = -1) {
  const l = log.store.byTarget.get(target); if (!l) return [];
  const out = []; for (const i of l) if (i > from && i < log.n) out.push(i); return out;
}
/** 取り消し（revert）の記録の位置（古い順） */
export function logReverts(log) { const out = []; for (const i of log.store.reverts) if (i < log.n) out.push(i); return out; }
