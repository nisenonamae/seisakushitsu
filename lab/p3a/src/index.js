// 命令の核の入口。
export { createState, apply, applyBatch, check, replay, toEntries, REASONS } from './engine.js';
export { makeUndo, makeRedo, undoStacks } from './undo.js';
export { checkInvariants } from './invariants.js';
export { createDoc, revOf, lineText, getNode, getAt, inverse, applyEffect, Draft } from './model.js';
export { logItems, logLength, logAt, logIndexOf } from './log.js';
export { tally } from './revert.js';
export { retoken, danglingCues, cuesOf } from './script.js';
export { proposalStatus } from './proposal.js';
export { analyze as analyzeExpr, LIMITS as EXPR_LIMITS } from './expr.js';
export { rankBetween, canon, same, hash, mulberry32, deepFreeze, clone } from './util.js';
export { SPECS } from './commands.js';

import { logItems } from './log.js';
/** 選んで取り消すための近道：AI 由来の記録（AI が当てた物・提案から採った物）の id を集める */
export function aiRecordIds(log, filter) {
  return logItems(log).filter((a) => (a.sender.k === 'ai' || a.cmd.proposal !== undefined) && a.cmd.body.type !== 'revert' && (!filter || filter(a))).map((a) => a.cmd.id);
}
/** 文書の中身（版の数字を除く）。「元と同じか」を比べるときに使う */
export function content(doc) { const { revs, ...rest } = doc; return rest; }
