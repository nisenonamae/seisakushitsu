// 出どころ（provenance）：文書の今の値の1つ1つ（値の道ごと・点ごと・鍵ごと）について、「だれの命令が置いたか」を記録から数える。
// 読むだけの計算で、文書も記録も変えない。測り（measure2.js）と、将来の画面（「ここはまだ AI の値」を見せる）のための物。
//  ・置きかえ・足した物：その番地（と下の全部）の持ち主が、その命令になる
//  ・足した量・掛けた量：持ち主は変えず、「上に乗せた命令」として足す
//  ・取り消し：きれいに戻した効果（1対1）は、元の効果の前の出どころに戻す（足した量・掛けた量は、乗せた命令を外す）

export { buildProvenance } from '../src/owner.js';   // P3r：由来の計算は核の横（src/owner.js）へ移した
/** 部品の「値の置き場」を全部ならべる（名前・置き場所・変形・色・形・点ごとの位置と取っ手と角・鍵ごとの時刻と値）*/
export function leavesOf(n) {
  const out = [['node', n.id, 'name'], ['node', n.id, '@place']]; const val = (base, v) => { if (v && v.k === 'keys') for (const k of v.keys) out.push([...base, 'keys', k.id, 't'], [...base, 'keys', k.id, 'v']); else out.push(base); };
  val(['node', n.id, 'xf', 'pos'], n.xf.pos); val(['node', n.id, 'xf', 'rot'], n.xf.rot); val(['node', n.id, 'xf', 'scale'], n.xf.scale); val(['node', n.id, 'opacity'], n.opacity);
  if (n.fill) val(['node', n.id, 'fill', 'color'], n.fill.color);
  if (n.stroke) { val(['node', n.id, 'stroke', 'color'], n.stroke.color); val(['node', n.id, 'stroke', 'w'], n.stroke.w); }
  if (n.geo) {
    if (n.geo.t === 'path') { out.push(['node', n.id, 'geo', 'closed']); for (const p of n.geo.pts) { for (const h of ['p', 'in', 'out']) if (p[h] != null) val(['node', n.id, 'geo', 'pts', p.id, h], p[h]); if (p.corner != null) out.push(['node', n.id, 'geo', 'pts', p.id, 'corner']); } }
    else { val(['node', n.id, 'geo', 'size'], n.geo.size); if (n.geo.t === 'rect') val(['node', n.id, 'geo', 'round'], n.geo.round); }
  }
  return out;
}
/**
 * 部品の値を、戻したかった記録の集まり T から見て分ける。
 * @returns {{total:number, pure:number, mixed:number, other:number, pts:number, ptsPure:number}} pure＝置いたのも上に乗せたのも T だけ／mixed＝T とそれ以外が混ざる／other＝T は関わっていない
 */
export function shareOf(pv, node, T) {
  const r = { total: 0, pure: 0, mixed: 0, other: 0, pts: 0, ptsPure: 0 };
  for (const addr of leavesOf(node)) {
    const x = pv.lookup(addr); if (!x) continue; r.total++;
    const ws = [x.w, ...x.on]; const inT = ws.filter((w) => T.has(w)).length; const c = inT === ws.length ? 'pure' : inT === 0 ? 'other' : 'mixed'; r[c]++;
    if (addr[addr.length - 1] === 'p' && addr[3] === 'pts') { r.pts++; if (c === 'pure') r.ptsPure++; }
  }
  return r;
}
