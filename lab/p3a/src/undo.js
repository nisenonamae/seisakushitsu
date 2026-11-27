// ふつうの取り消し（9.4節）：直前の自分の操作を戻す。記録は消さず、revert の命令を足す。やり直しも同じ仕組み。
// ここは「どの記録を戻すか」を記録から数えて、revert の命令を作るだけ（当てるのは engine.apply）。
import { logItems } from './log.js';

/** 端末ごとの、取り消せる物・やり直せる物の積み重ね（操作のまとまり＝1回の apply ごと） */
export function undoStacks(log, device) {
  const undo = []; const redo = []; let cur = null;
  const units = [];
  for (const a of logItems(log)) {
    if (!a.sender || a.sender.k !== 'human' || a.sender.device !== device) continue;
    if (!cur || cur.batch !== a.batch) units.push((cur = { batch: a.batch, ids: [], mode: a.cmd.body.type === 'revert' ? a.cmd.body.mode : undefined }));
    cur.ids.push(a.cmd.id);
  }
  for (const u of units) {
    if (u.mode === 'undo') { undo.pop(); redo.push(u.ids); }
    else if (u.mode === 'redo') { redo.pop(); undo.push(u.ids); }   // やり直した結果（revert の記録）が、次に取り消す相手になる
    else { undo.push(u.ids); redo.length = 0; }
  }
  return { undo, redo };
}
function make(log, device, id, mode) {
  const s = undoStacks(log, device)[mode]; if (!s.length) return null;
  return { id, v: 1, actor: { k: 'human', device }, body: { type: 'revert', mode, targets: s[s.length - 1] } };
}
/** 直前の自分の操作を戻す命令。戻す物が無ければ null */
export const makeUndo = (log, device, id) => make(log, device, id, 'undo');
/** 取り消しをやり直す命令 */
export const makeRedo = (log, device, id) => make(log, device, id, 'redo');
