// 「人の直しが残っているか」を、核とは別のやり方で確かめる（試しと測りで使う）。
// 人の記録の効果のうち「その後だれにも触られていない物」（＝取り消す直前に、文書に生きていた人の直し）が、
// 取り消したあとも、そのままの形で文書にあるかを見る。
import { logItems, getAt, same } from '../src/index.js';

const addr = (e) => (e.k === 'own' ? ['node', e.node, '@owner'] : e.k === 'move' ? ['node', e.node, '@place'] : e.k === 'insert' || e.k === 'remove' ? [...e.at, e.id] : e.at);
const related = (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false; return true; };
const val = (doc, at) => { const v = getAt(doc, at); return v === undefined ? null : v; };

/**
 * @param {any} before 取り消す直前の状態 @param {any} after 取り消したあとの状態 @param {string[]} targets 戻した記録の id
 * @returns {{checked:number, skipped:number, broken:string[]}} broken が空なら、人の直しは全部残っている
 */
export function humanWorkIntact(before, after, targets) {
  const items = logItems(before.log); const set = new Set(targets); const flat = [];
  items.forEach((a, i) => a.effects.forEach((e, j) => flat.push({ a, i, j, e, at: addr(e) })));
  let checked = 0; let skipped = 0; const broken = [];
  for (let x = 0; x < flat.length; x++) {
    const f = flat[x]; if (f.a.sender.k !== 'human' || f.a.cmd.proposal !== undefined || set.has(f.a.cmd.id)) continue;
    if (f.a.cmd.body.type === 'revert' || f.e.k === 'own') continue; // 取り消しで戻った値は「人が決めた値」ではない（元へ戻しただけ）
    let live = true; for (let y = x + 1; y < flat.length && live; y++) if (related(f.at, flat[y].at)) live = false;
    if (!live) continue;
    const e = f.e; const doc = after.doc; let ok = true;
    if (e.k === 'set') ok = same(val(doc, e.at), e.after);
    else if (e.k === 'insert') ok = getAt(doc, f.at) !== undefined;
    else if (e.k === 'remove') ok = getAt(doc, f.at) === undefined;
    else if (e.k === 'move') { const n = getAt(doc, ['node', e.node]); ok = !!n && n.parent === (e.to.parent ?? null) && n.order === e.to.order; }
    else { skipped++; continue; } // 足した量（delta）は、ここでは数えない（別の試しで数字を確かめている）
    checked++; if (!ok) broken.push(`${f.a.cmd.id}#${f.j} ${e.k} ${f.at.join('/')}`);
  }
  return { checked, skipped, broken };
}
