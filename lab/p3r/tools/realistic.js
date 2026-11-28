// 実際の制作に近い記録の作り手（追加の検証 BRIEF2 の 6）。**作り物**：本物の操作の記録ではない。種つきの乱数で、1本の動画の素材づくりを思い浮かべて並べた物。
//
// 思い浮かべた物：解説動画 1 本の、1つの場面（か、使い回す素材のまとまり）の文書。キャラクターや物（＝「物」）がいくつか並ぶ。
//   ・1つの物＝部品 26・点 約 127（lab/p4 の「AI のみ」の絵＝部品 26・点 127・いちばん多い部品 11 点、に合わせた）。部品 30〜300＝物 1〜12 個
//   ・物ごとの流れ（rounds 回くり返す＝直しの回）：
//       1 AI が下組みを作る（部品を1つずつ足す・色を置く・位置と大きさを合わせる）
//       2 人が直す：部品の 6 割に手を入れる。1部品に 3〜14 手（点を動かす 6 割・取っ手 1 割・色 1 割・伸ばす 1 割・位置 1 割）。点を足す・外す、重なり順、複製、名前、清書（形の置きかえ）が少し
//       3 人の取り消しの連打：手の 8% のあとに、取り消しを 1〜4 回、そのうちいくつかをやり直す
//       4 AI の直しの作業：前に作った物の部品の 3 割を、AI が動かす・伸ばす（人の直しの上に乗る）
//       5 人が、AI の作業を選んで戻す：直前の作業（物の 2 割）・古い作業（物 3 個に 1 回。ずっと前の物が相手）
//       6 引き取り（AI の部品の 5%）・鍵を打つ（部品の 1 割：回転を鍵にして、値を 2〜4 回直す）
//   ・drag='commit'：1 回のドラッグ＝1 命令（指を離した時に送る）。drag='stream'：ドラッグの途中も送る（1 回のドラッグ＝6〜24 命令）。
// 件数の見積もり（commit）：物 1 個・1 回めで 約 330 件（AI 50＋人 約 190＋取り消し 約 30＋AI の直し 約 20＋ほか）。部品 300・2 回で 約 6〜8 千件。stream では、人の手が 約 12 倍になる。
// この割合（何割に手を入れるか・1部品に何手か・取り消しの頻度）は、**根拠のある数字ではなく、担当の見立て**。P4 の作り手の評価（本物の操作の記録）が出たら、置きかえる。
import { mulberry32, makeUndo, makeRedo, rankBetween } from '../src/index.js';
export const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } };
const S = (v) => ({ k: 'static', v }); const H = { sender: { k: 'human', device: 'mac' } }; const A = { sender: { k: 'ai', agent: 'w1' } };
/**
 * @param {{parts?:number, seed?:number, drag?:'commit'|'stream', rounds?:number}} o
 * @param {{apply:(cmds:any[], ctx:any)=>any, state:any}} io 当てる所（メモリの上の核でも、ファイルへ保存する入れ物でもよい）
 */
export function runRealistic(o, io) {
  const parts = o.parts || 120; const rounds = o.rounds || 2; const stream = o.drag === 'stream'; const rng = mulberry32(o.seed || 1); const R = (n) => Math.floor(rng() * n); const r1 = (x) => Math.round(x * 10) / 10;
  const stats = { applied: 0, rejected: 0, byType: {}, undo: 0, redo: 0, selRecent: 0, selOld: 0, aiRecords: 0, humanRecords: 0, drags: 0 }; let c = 0;
  const tasks = []; const objs = []; let taskNo = 0; let curTask = null; let lastOrder = null;
  const send = (body, ctx, extra = {}) => {
    const actor = ctx === A ? { k: 'ai', agent: 'w1', task: `task${curTask}` } : { k: 'human', device: 'mac' }; const node = body.node && typeof body.node === 'string' ? body.node : null;
    const cmd = { id: `r${++c}`, v: body.type === 'prop.set' ? 2 : 1, actor, base: node && io.state.doc.revs[`node:${node}`] !== undefined ? { [`node:${node}`]: io.state.doc.revs[`node:${node}`] } : {}, body, ...extra };
    const r = io.apply([cmd], ctx); const t = body.type === 'revert' ? `revert:${body.mode || 'each'}` : body.type;
    if (r.status === 'applied') { stats.applied++; stats.byType[t] = (stats.byType[t] || 0) + 1; if (ctx === A) { stats.aiRecords++; if (body.type !== 'revert') tasks[curTask].ids.push(cmd.id); } else stats.humanRecords++; } else stats.rejected++;
    return r;
  };
  const hex = () => S({ k: 'hex', v: '#' + R(0xffffff).toString(16).padStart(6, '0') });
  const drag = (fn) => { stats.drags++; const k = stream ? 6 + R(19) : 1; for (let i = 0; i < k; i++) fn(k); };
  const undoBurst = () => { const k = 1 + R(4); let done = 0; for (let i = 0; i < k; i++) { const u = makeUndo(io.state.log, 'mac', `r${c + 1}`); if (!u) break; if (send(u.body, H).status === 'applied') { stats.undo++; done++; } } const back = R(done + 1); for (let i = 0; i < back; i++) { const u = makeRedo(io.state.log, 'mac', `r${c + 1}`); if (!u) break; if (send(u.body, H).status === 'applied') stats.redo++; } };
  const humanEdit = (ob, p) => {
    const n = io.state.doc.nodes[p]; if (!n) return; const pts = n.geo && n.geo.pts ? n.geo.pts.map((q) => q.id) : []; const moves = 3 + R(12);
    for (let m = 0; m < moves; m++) {
      const x = rng();
      if (x < 0.6 && pts.length) { const pt = pts[R(pts.length)]; const tx = r1(rng() * 30 - 15); const ty = r1(rng() * 30 - 15); drag((k) => send({ type: 'pt.nudge', node: p, pt, d: [r1(tx / k) || 0.1, r1(ty / k) || 0.1] }, H)); }
      else if (x < 0.7 && pts.length) send({ type: 'pt.handle', node: p, pt: pts[R(pts.length)], which: rng() < 0.5 ? 'in' : 'out', value: S([r1(rng() * 10 - 5), r1(rng() * 10 - 5)]) }, H);
      else if (x < 0.8) send({ type: 'prop.set', node: p, path: 'fill.color', value: hex() }, H);
      else if (x < 0.9) { const total = [0.8, 0.9, 1.1, 1.25, 1.5][R(5)]; drag((k) => send({ type: 'prop.scale', node: p, path: 'xf.scale', f: [k === 1 ? total : Math.round(Math.pow(total, 1 / k) * 10000) / 10000] }, H)); }
      else { const tx = r1(rng() * 40 - 20); const ty = r1(rng() * 40 - 20); drag((k) => send({ type: 'prop.nudge', node: p, path: 'xf.pos', d: [r1(tx / k) || 0.1, r1(ty / k) || 0.1] }, H)); }
      if (rng() < 0.08) undoBurst();
    }
    const y = rng();
    if (y < 0.06 && pts.length < 11) send({ type: 'pt.add', node: p, pt: { id: `a${c}`, p: S([r1(rng() * 50), r1(rng() * 50)]) } }, H);
    else if (y < 0.09 && pts.length > 3) send({ type: 'pt.remove', node: p, pt: pts[R(pts.length)] }, H);
    else if (y < 0.14) send({ type: 'node.move', node: p, parent: n.parent ?? null, order: (lastOrder = rankBetween(lastOrder, null)) }, H);
    else if (y < 0.17) { const id = `d${c}`; const copy = JSON.parse(JSON.stringify(n)); copy.id = id; copy.name = n.name + 'の写し'; copy.order = (lastOrder = rankBetween(lastOrder, null)); delete copy.parent; if (send({ type: 'node.add', node: copy }, H).status === 'applied') ob.parts.push(id); }
    else if (y < 0.2) send({ type: 'node.rename', node: p, name: `${n.name}'` }, H);
    else if (y < 0.3 && pts.length) send({ type: 'geo.set', node: p, geo: { t: 'path', closed: true, pts: n.geo.pts.map((q) => ({ id: q.id, p: S(q.p.v.map((v) => Math.round(v))), in: S([1, 0]), out: S([-1, 0]) })) } }, H);   // 清書：点をそろえて、取っ手を付け直す
    else if (y < 0.4) { if (send({ type: 'prop.kind', node: p, path: 'xf.rot', value: { k: 'keys', keys: [{ id: 'k1', t: { k: 'sec', s: 0 }, v: 0 }, { id: 'k2', t: { k: 'sec', s: 1 }, v: 10 }] } }, H).status === 'applied') { const m = 2 + R(3); for (let i = 0; i < m; i++) send({ type: 'key.value', node: p, path: 'xf.rot', key: 'k2', v: R(90) }, H); } }
    else if (y < 0.45) send({ type: 'node.adopt', node: p }, H);
  };
  const aiBuild = (oi) => {
    curTask = taskNo++; tasks.push({ ids: [], obj: oi }); const ob = { parts: [], builds: [curTask], revs: [] }; objs.push(ob); const n = Math.min(26, parts - oi * 26);
    for (let i = 0; i < n; i++) { const id = `o${oi}p${i}`; const np = i === 0 ? 11 : 3 + R(6); lastOrder = rankBetween(lastOrder, null);
      if (send({ type: 'node.add', node: { id, scene: 's1', kind: 'shape', name: `物${oi}の部品${i}`, order: lastOrder, geo: { t: 'path', closed: true, pts: Array.from({ length: np }, (_, j) => ({ id: `p${j}`, p: S([r1(rng() * 100), r1(rng() * 100)]), in: S([2, 0]), out: S([-2, 0]) })) }, fill: { color: hex() }, xf: { pos: S([oi * 120, 0]), scale: S([1, 1]), rot: S(0) } } }, A).status === 'applied') ob.parts.push(id); }
    for (const p of ob.parts) { if (rng() < 0.5) send({ type: 'prop.set', node: p, path: 'fill.color', value: hex() }, A); if (rng() < 0.25) send({ type: 'prop.nudge', node: p, path: 'xf.pos', d: [r1(rng() * 20 - 10), r1(rng() * 20 - 10)] }, A); if (rng() < 0.12) send({ type: 'prop.scale', node: p, path: 'xf.scale', f: [[0.8, 1.25, 1.1][R(3)]] }, A); }
    return ob;
  };
  const aiRevise = (ob) => { curTask = taskNo++; tasks.push({ ids: [], obj: objs.indexOf(ob) }); ob.revs.push(curTask);
    for (const p of ob.parts) { if (rng() > 0.3) continue; const n = io.state.doc.nodes[p]; if (!n) continue; const pts = n.geo && n.geo.pts ? n.geo.pts.map((q) => q.id) : [];
      const k = 1 + R(3); for (let i = 0; i < k && pts.length; i++) send({ type: 'pt.nudge', node: p, pt: pts[R(pts.length)], d: [r1(rng() * 10 - 5), r1(rng() * 10 - 5)] }, A);
      if (rng() < 0.3) send({ type: 'prop.scale', node: p, path: 'xf.scale', f: [[0.9, 1.1, 1.2][R(3)]] }, A); if (rng() < 0.2) send({ type: 'prop.set', node: p, path: 'fill.color', value: hex() }, A); } };
  const revertTask = (t, old) => { const ids = tasks[t].ids; if (!ids.length) return; const r = send({ type: 'revert', mode: 'units', targets: ids.slice() }, H); if (r.status === 'applied') { if (old) stats.selOld++; else stats.selRecent++; } };
  const nObj = Math.ceil(parts / 26);
  for (let round = 0; round < rounds; round++) for (let oi = 0; oi < nObj; oi++) {
    const ob = round === 0 ? aiBuild(oi) : objs[oi];
    for (const p of ob.parts.slice()) if (rng() < 0.6) humanEdit(ob, p);
    aiRevise(ob);
    if (rng() < 0.2) revertTask(ob.revs[ob.revs.length - 1], false);
    for (const p of ob.parts.slice()) if (rng() < 0.15) humanEdit(ob, p);
    if (oi % 3 === 2 || (round > 0 && oi % 3 === 0)) { const far = objs[R(Math.max(1, objs.length - 2))]; const pool = far.revs.length && rng() < 0.7 ? far.revs : far.builds; revertTask(pool[R(pool.length)], true); }   // 古い作業を戻す（ずっと前の物）
  }
  stats.tasks = tasks.length; stats.objects = objs.length; return stats;
}
/** メモリの上の核で流す */
export async function realisticInMemory(o) { const { createState, applyBatch } = await import('../src/index.js'); const io = { state: createState(INIT), batches: [], apply(cmds, ctx) { const r = applyBatch(io.state, cmds, ctx); if (r.status === 'applied') { io.state = r.state; io.batches.push({ sender: ctx.sender, cmds }); } return r; } }; const stats = runRealistic(o, io); return { state: io.state, batches: io.batches, stats }; }
if (process.argv[1] && process.argv[1].endsWith('realistic.js')) { const o = { parts: Number(process.argv[2] || 120), drag: process.argv[3] || 'commit', rounds: Number(process.argv[4] || 2), seed: Number(process.argv[5] || 1) }; const t = Date.now(); const w = await realisticInMemory(o); console.log(JSON.stringify({ ...o, ms: Date.now() - t, parts_now: Object.keys(w.state.doc.nodes).length, ...w.stats })); }
