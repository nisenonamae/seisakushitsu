// 許しの検査（9.3節③・AUTOMATION_DESIGN 3節）。度合い・許可・固定を、核が強制する。
// 送り主（sender）は、呼び出す側が渡す「確かめられた身元」。命令の中の actor（名乗り）は見ない。
import { getNode, STAGES } from './model.js';
import { relate, hash, canon } from './util.js';

const RANK = { ai: 0, collab: 1, human: 2 };
export function modeFor(doc, scene, stage) {
  const c = doc.cover; const k = `${scene}~${stage}`;
  if (scene != null && Object.hasOwn(c.sceneModes, k)) return c.sceneModes[k];
  return Object.hasOwn(c.stages, stage) ? c.stages[stage] : 'collab';
}
function chainOf(doc, id) { const out = []; const seen = new Set(); let cur = id; while (cur != null && !seen.has(cur)) { seen.add(cur); out.push(cur); const n = getNode(doc, cur); cur = n ? n.parent : null; } return out; }

/** 効果を当てる前に見ておく物（当てたあとでは分からなくなる：親の鎖・段） */
export function preScan(doc, e) {
  const addr = e.k === 'move' || e.k === 'own' ? ['node', e.node] : e.k === 'insert' || e.k === 'remove' ? [...e.at, e.id] : e.at;
  if (addr[0] === 'cover') return { kind: 'cover' };
  if (addr[0] === 'line') return { kind: 'line', id: addr[1] };
  const id = addr[1]; const n = getNode(doc, id) || (e.k === 'insert' && e.at.length === 1 ? e.item : null);
  const scene = n ? n.scene : null; const sc = scene != null && Object.hasOwn(doc.scenes, scene) ? doc.scenes[scene] : null;
  const exists = !!getNode(doc, id);
  const chain = exists ? chainOf(doc, id) : n ? [id, ...chainOf(doc, n.parent)] : [id];
  return { kind: 'node', id, path: addr.slice(2), scene, chain, rework: !!(exists && sc && n.stage !== undefined && n.stage < sc.stage) };
}
/** 当てたあとの親の鎖も足す（固定されたまとまりの中へ入れる・外へ出す、の両方を見つける） */
export function postScan(doc, s) {
  if (s.kind !== 'node') return s; const set = new Set(s.chain);
  if (getNode(doc, s.id)) for (const x of chainOf(doc, s.id)) set.add(x);
  s.chain = [...set]; return s;
}
/** この効果に当たる固定 */
export function lockHits(cover, s) {
  const frozen = []; const ask = [];
  for (const l of cover.locks) {
    const t = l.target; let hit = false;
    if (t.line !== undefined) hit = s.kind === 'line' && s.id === t.line;
    else if (s.kind === 'node') {
      if (t.node === undefined) hit = t.scene === s.scene;
      else if (t.path === undefined) hit = s.chain.includes(t.node);
      else hit = t.node === s.id && relate(t.path.split('.'), s.path) !== null;
    }
    if (hit) (l.level === 'frozen' ? frozen : ask).push(l.id);
  }
  return { frozen, ask };
}

/**
 * 命令1つの判定。
 * @param {{cover:any, doc:any, sender:{k:'human'|'ai'}, cat:{perm:string,stage:string|null}, scans:any[], revertOf?:any[]}} a
 *   cover＝この命令の前の表紙／scans＝効果ごとの preScan+postScan／revertOf＝revert が戻す記録
 * @returns {{verdict:'pass'|'propose'|'reject', reason?:string, detail?:any, why?:string[], policy:any}}
 */
export function judge(a) {
  const { cover, sender, cat, scans } = a; const frozen = new Set(); const ask = new Set(); const scenes = new Set(); let rework = false;
  for (const s of scans) {
    const h = lockHits(cover, s); h.frozen.forEach((x) => frozen.add(x)); h.ask.forEach((x) => ask.add(x));
    if (s.kind === 'node') { if (s.scene != null) scenes.add(s.scene); if (s.rework) rework = true; }
  }
  // 度合い：触る場面×工程のうち、いちばん人寄りの物
  const stages = cat.stage ? [cat.stage] : cat.perm === 'revert' ? STAGES : [];
  let mode = null; const fake = { cover };
  for (const st of stages) for (const sc of scenes.size ? scenes : [null]) { const m = modeFor(fake, sc, st); if (mode === null || RANK[m] > RANK[mode]) mode = m; }
  const policy = { mode, perms: hash(canon(cover.perms)), locks: [...frozen, ...ask].sort() };
  const reject = (reason, detail) => ({ verdict: 'reject', reason, detail, policy });
  const isAI = !sender || sender.k !== 'human'; // 人と確かめられた物だけが人。ほかは全部 AI として扱う
  if (!isAI) return frozen.size ? reject('locked', { locks: [...frozen] }) : { verdict: 'pass', policy };

  if (cat.perm === 'cover') return reject('forbidden', { why: 'cover', msg: 'AI は度合い・許可・固定を変えられない' });
  let perm = 'allow';
  if (cat.perm === 'revert') { if ((a.revertOf || []).some((r) => !r.sender || r.sender.k === 'human')) return reject('forbidden', { why: 'revert-human', msg: 'AI が戻せるのは AI の記録だけ' }); }
  else { perm = Object.hasOwn(cover.perms, cat.perm) ? cover.perms[cat.perm] : 'deny'; if (perm === 'deny') return reject('forbidden', { why: 'perm', perm: cat.perm }); }
  if (frozen.size) return reject('locked', { locks: [...frozen] });
  if (mode === 'human') return reject('forbidden', { why: 'mode-human' });
  const why = [];
  if (cat.perm === 'remove') why.push('remove');          // 消すのは人が決める（提案にしかならない）
  if (perm === 'propose') why.push('perm-propose');
  if (rework) why.push('previous-stage');                 // 前の段の物を作り替える
  if (mode === 'collab') why.push('collab');
  if (ask.size) why.push('lock-ask');
  return why.length ? { verdict: 'propose', why, policy } : { verdict: 'pass', policy };
}
