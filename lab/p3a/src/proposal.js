// 提案が今も生きているか（9.7節）。reads に書いた物が変わったかどうかだけで決める。
// 命令ごとの生き死には、核の check（前提の検査＝値の道ごとの比べ）にそのまま任せる。
import { applyBatch } from './engine.js';
import { revOf } from './model.js';

/**
 * @param {any} state @param {{commands:any[], reads:{target:string,rev:number}[]}} proposal
 * @param {any} approver 採る人の確かめられた身元（人）
 * @returns {{status:'open'|'partly'|'stale', commands:{id:string,live:boolean,reason?:string}[], changedReads:string[], premiseChanged:boolean}}
 */
export function proposalStatus(state, proposal, approver) {
  const changedReads = (proposal.reads || []).filter((r) => revOf(state.doc, r.target) !== r.rev).map((r) => r.target);
  const commands = proposal.commands.map((c) => {
    const r = applyBatch(state, [c], { sender: approver }, { dry: true });
    return r.status === 'applied' || r.status === 'duplicate' ? { id: c.id, live: true } : { id: c.id, live: false, reason: r.reason };
  });
  const live = commands.filter((c) => c.live).length;
  return { status: live === commands.length ? 'open' : live === 0 ? 'stale' : 'partly', commands, changedReads,
    premiseChanged: changedReads.length > 0 && live > 0 }; // 生きているが、判断に使った物は変わった（採るかは人が決める）
}
