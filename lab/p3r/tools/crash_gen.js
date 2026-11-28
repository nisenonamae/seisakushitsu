// 保存の途中で止める試し（tools/crash.js）の操作の作り手。「今の状態」と「何まとまりめか」だけで決まる（止めて立ち上げ直しても、同じ続きになる）。作り物の操作。
import { mulberry32, makeUndo, makeRedo, aiRecordIds } from '../src/index.js';
export const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } };
const S = (v) => ({ k: 'static', v }); const H = { sender: { k: 'human', device: 'mac' } }; const A = { sender: { k: 'ai', agent: 'w1' } };
/** n＝もう入っているまとまりの数。tryNo＝断られた時のやり直しの番号 */
export function genBatch(state, seed, n, tryNo = 0) {
  const rng = mulberry32((seed * 100003 + n * 31 + tryNo * 7919) >>> 0); const ids = Object.keys(state.doc.nodes); const id = `k${seed}-${n}-${tryNo}`;
  const mk = (body, ctx, j = 0) => ({ id: `${id}-${j}`, v: body.type === 'prop.set' ? 2 : 1, actor: ctx.sender.k === 'human' ? { k: 'human', device: 'mac' } : { k: 'ai', agent: 'w1', task: 't' + (n >> 3) }, base: { ...state.doc.revs }, body });
  const x = rng(); const ctx = rng() < 0.3 ? A : H;
  if (ids.length < 12 || x < 0.04) { const nid = `n${seed}x${n}x${tryNo}`; return { ctx, cmds: [mk({ type: 'node.add', node: { id: nid, scene: 's1', kind: 'shape', name: nid, order: 'i' + (n % 1000).toString(36).padStart(3, '1') + 'i', geo: { t: 'path', closed: true, pts: [0, 1, 2, 3, 4].map((j) => ({ id: `p${j}`, p: S([j, n % 50]), in: S([1, 0]), out: S([-1, 0]) })) }, fill: { color: S({ k: 'hex', v: '#888888' }) }, xf: { scale: S([1, 1]) } } }, ctx)] }; }
  const node = ids[Math.floor(rng() * ids.length)];
  if (x < 0.34) return { ctx, cmds: [mk({ type: 'pt.nudge', node, pt: `p${Math.floor(rng() * 5)}`, d: [Math.round(rng() * 200 - 100) / 10, Math.round(rng() * 200 - 100) / 10] }, ctx)] };
  if (x < 0.5) return { ctx, cmds: [mk({ type: 'prop.scale', node, path: 'xf.scale', f: [[0.5, 0.8, 1.25, 2, 0.3333, 3][Math.floor(rng() * 6)]] }, ctx)] };
  if (x < 0.6) return { ctx, cmds: [mk({ type: 'prop.set', node, path: 'fill.color', value: S({ k: 'hex', v: '#' + Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0') }) }, ctx)] };
  if (x < 0.66) { const k = 2 + Math.floor(rng() * 4); const cmds = []; for (let j = 0; j < k; j++) cmds.push(mk({ type: 'pt.nudge', node, pt: `p${j}`, d: [1, -1] }, ctx, j)); return { ctx, cmds }; }   // 1まとまりに命令がいくつか
  if (x < 0.8) { const u = makeUndo(state.log, 'mac', `${id}-0`); if (u) return { ctx: H, cmds: [u] }; }
  if (x < 0.88) { const u = makeRedo(state.log, 'mac', `${id}-0`); if (u) return { ctx: H, cmds: [u] }; }
  if (x < 0.97) { const ai = aiRecordIds(state.log); if (ai.length) { const t = ai[Math.floor(rng() * rng() * ai.length)]; return { ctx: H, cmds: [mk({ type: 'revert', mode: 'units', targets: [t] }, H)] }; } }   // 古い AI の記録を選んで戻す（古い束・写しより前の記録が相手になる）
  return { ctx, cmds: [mk({ type: 'prop.nudge', node, path: 'xf.pos', d: [1, 2] }, ctx)] };
}
export const STORE_OPT = { segSize: 40, snapEvery: 30, hot: 50, cacheSegs: 3 };
