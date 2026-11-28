// ふつうの取り消し（9.4節）：直前の自分の操作を戻す。記録は消さず、revert の命令を足す。やり直しも同じ仕組み。
// ここは「どの記録を戻すか」を読んで、revert の命令を作るだけ（当てるのは engine.apply）。
// P3r：積み重ねは、記録が足されるたびに log.js が足していく（取り消しのたびに記録を頭から数え直さない）。
import { stacksOf, logBase } from './log.js';

/** 端末ごとの、取り消せる物・やり直せる物の積み重ね（操作のまとまり＝1回の apply ごと）。truncated＝写しより前の分は持っていない */
export function undoStacks(log, device) { const s = stacksOf(log, device); return { undo: s.undo.slice(), redo: s.redo.slice(), truncated: logBase(log) > 0 }; }
function make(log, device, id, mode) {
  const s = stacksOf(log, device)[mode]; if (!s.length) return null;
  return { id, v: 1, actor: { k: 'human', device }, body: { type: 'revert', mode, targets: s[s.length - 1].slice() } };
}
/** 直前の自分の操作を戻す命令。戻す物が無ければ null */
export const makeUndo = (log, device, id) => make(log, device, id, 'undo');
/** 取り消しをやり直す命令 */
export const makeRedo = (log, device, id) => make(log, device, id, 'redo');
