// 語りのトークンと合図（6節）。語りを直したとき、変わっていないトークンは同じ id のまま残す。
// 消えたトークンを指す合図は「宙に浮いた合図」。勝手に付け替えず、候補だけ出す。
import { logItems } from './log.js';
import { slotsOf } from './model.js';

/**
 * 前のトークンと新しい区切りを比べて、新しいトークンの並びを作る（同じ言葉が同じ順で残っていれば同じ id）。
 * @param {{id:string,text:string}[]} old @param {string[]} texts 新しい区切り @param {string} prefix 新しい id の頭（送る側が決める）
 */
export function retoken(old, texts, prefix) {
  const n = old.length; const m = texts.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = old[i].text === texts[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0; let j = 0; let k = 0;
  while (j < m) {
    if (i < n && old[i].text === texts[j]) { out.push({ id: old[i].id, text: texts[j] }); i++; j++; }
    else if (i < n && L[i + 1][j] >= L[i][j + 1]) i++;
    else { out.push({ id: `${prefix}${k++}`, text: texts[j] }); j++; }
  }
  return out;
}
/** 文書の中の合図（鍵の時刻が語りのトークンを指している物） */
export function cuesOf(doc) {
  const out = [];
  for (const id of Object.keys(doc.nodes)) for (const [segs, , v] of slotsOf(doc.nodes[id])) {
    const vals = v.k === 'expr' && v.base ? [v.base] : [v];
    for (const x of vals) if (x.k === 'keys') for (const k of x.keys) if (k.t.k === 'cue') out.push({ node: id, path: segs.join('.'), key: k.id, token: k.t.cue.token });
  }
  return out;
}
/**
 * 宙に浮いた合図と、付け替えの候補（消える前の行で隣だった、今も残っているトークン）。
 * @returns {{node:string,path:string,key:string,token:string,line?:string,candidates:string[]}[]}
 */
export function danglingCues(state) {
  const live = new Set(); for (const l of state.doc.script.lines) for (const t of l.tokens) live.add(t.id);
  const out = []; const items = logItems(state.log);
  for (const c of cuesOf(state.doc)) {
    if (live.has(c.token)) continue;
    const d = { ...c, candidates: [] };
    for (let i = items.length - 1; i >= 0 && !d.line; i--) for (const e of items[i].effects) {
      const before = e.k === 'set' && e.at[0] === 'line' && e.at[2] === 'tokens' ? e.before : e.k === 'remove' && e.at[0] === 'line' && e.at.length === 1 ? e.item.tokens : null;
      const j = before ? before.findIndex((t) => t.id === c.token) : -1; if (j < 0) continue;
      d.line = e.k === 'set' ? e.at[1] : e.id;
      for (let q = j - 1; q >= 0; q--) if (live.has(before[q].id)) { d.candidates.push(before[q].id); break; }
      for (let q = j + 1; q < before.length; q++) if (live.has(before[q].id)) { d.candidates.push(before[q].id); break; }
      break;
    }
    out.push(d);
  }
  return out;
}
