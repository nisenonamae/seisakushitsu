#!/usr/bin/env node
// 順番が違う時の結果を、核を通して確かめる（BRIEF3 の A）。同じ始めの文書に、2つの命令を A→B と B→A の順で当てて比べる。
// あわせて「2つの端末が、同じ版を見て同時に出した」時（あとの命令の前提 base が古い）に、今の核がどうするかも見る。
//   node tools/ordercheck.js
import { createState, applyBatch, canon, content, mulberry32, snap, SPECS } from '../src/index.js';

const S = (v) => ({ k: 'static', v }); const H = (d) => ({ sender: { k: 'human', device: d } });
const INIT = { scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai' } };
function base(rng) {
  let s = createState(INIT); const v = () => snap((rng() * 2 - 1) * 100);
  const node = { id: 'A', scene: 's1', kind: 'shape', name: 'A', order: 'i', xf: { pos: S([v(), v()]), rot: S(v()), scale: S([snap(0.5 + rng() * 2), snap(0.5 + rng() * 2)]) },
    geo: { t: 'path', closed: true, pts: [0, 1, 2].map((i) => ({ id: `p${i}`, p: S([v(), v()]), in: S([v(), v()]) })) }, fill: { color: S({ k: 'hex', v: '#336699' }) } };
  s = applyBatch(s, [{ id: 'c0', v: 1, actor: { k: 'human', device: 'a' }, base: {}, body: { type: 'node.add', node } }], H('a')).state; return s;
}
const cmd = (id, dev, s, body) => ({ id, v: SPECS[body.type].v, actor: { k: 'human', device: dev }, base: { ...s.doc.revs }, body });
const rf = (rng, lo, hi) => snap(lo * Math.pow(hi / lo, rng()));
const KINDS = {
  '足す': (r) => ({ type: 'prop.nudge', node: 'A', path: 'xf.scale', d: [snap(r() * 2 - 1), snap(r() * 2 - 1)] }),
  '掛ける': (r) => ({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [rf(r, 0.5, 2), rf(r, 0.5, 2)] }),
  '反転': () => ({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [-1, 1] }),
  '置きかえ': (r) => ({ type: 'prop.set', node: 'A', path: 'xf.scale', value: S([snap(r() * 3), snap(r() * 3)]) }),
  '種類を変える（固定→鍵）': (r) => ({ type: 'prop.kind', node: 'A', path: 'xf.scale', value: { k: 'keys', keys: [{ id: 'k' + Math.floor(r() * 1e6), t: { k: 'sec', s: 0 }, v: [1, 1] }] } }),
};
const OTHER = {
  '伸ばす（xf.scale に掛ける）× 動かす（xf.pos に足す）＝別の値の道': [(r) => KINDS['掛ける'](r), (r) => ({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [snap(r() * 20), snap(r() * 20)] })],
  '回す（xf.rot に足す）× 伸ばす（xf.scale に掛ける）＝別の値の道': [(r) => ({ type: 'prop.nudge', node: 'A', path: 'xf.rot', d: [snap(r() * 90)] }), (r) => KINDS['掛ける'](r)],
  '点を動かす × 同じ点の取っ手を置きかえる＝別の値の道': [(r) => ({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [snap(r() * 5), snap(r() * 5)] }), (r) => ({ type: 'pt.handle', node: 'A', pt: 'p1', which: 'in', value: S([snap(r() * 5), 0]) })],
  '点を動かす × 別の点を動かす': [(r) => ({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [snap(r() * 5), snap(r() * 5)] }), (r) => ({ type: 'pt.nudge', node: 'A', pt: 'p2', d: [snap(r() * 5), snap(r() * 5)] })],
  '点を足す × 点を足す（同じ点の後ろ）': [() => ({ type: 'pt.add', node: 'A', pt: { id: 'x1', p: S([1, 1]) }, after: 'p0' }), () => ({ type: 'pt.add', node: 'A', pt: { id: 'x2', p: S([2, 2]) }, after: 'p0' })],
  '点を動かす × その点を外す': [(r) => ({ type: 'pt.nudge', node: 'A', pt: 'p1', d: [snap(r() * 5), 1] }), () => ({ type: 'pt.remove', node: 'A', pt: 'p1' })],
  '伸ばす × 形を清書する（geo.set）': [(r) => KINDS['掛ける'](r), () => ({ type: 'geo.set', node: 'A', geo: { t: 'ellipse', size: S([5, 5]) } })],
};
function trial(mkA, mkB, N = 400) {
  const rng = mulberry32(42); const t = { n: 0, differ: 0, failAB: 0, failBA: 0, conc: {} };
  for (let i = 0; i < N; i++) { const s0 = base(rng); const a = mkA(rng); const b = mkB(rng); t.n++;
    const seq = (x, y) => { let s = s0; const r1 = applyBatch(s, [cmd('x', 'a', s, x)], H('a')); if (r1.status !== 'applied') return null; s = r1.state; const r2 = applyBatch(s, [cmd('y', 'b', s, y)], H('b')); return r2.status === 'applied' ? canon(content(r2.state.doc)) : null; };
    const ab = seq(a, b); const ba = seq(b, a); if (ab === null) t.failAB++; if (ba === null) t.failBA++; if (ab !== ba) t.differ++;
    // 同時：どちらも s0 を見て作った命令。先に A、あとから B（B の前提は古い）
    const r1 = applyBatch(s0, [cmd('x', 'a', s0, a)], H('a')); const r2 = applyBatch(r1.state, [cmd('y', 'b', s0, b)], H('b')); const k = r2.status === 'applied' ? '両方当てる' : `断る（${r2.reason}）`; t.conc[k] = (t.conc[k] || 0) + 1; }
  return t;
}
const names = Object.keys(KINDS);
console.log('### 同じ値の道（部品の伸ばし `xf.scale`）に、2つの操作を A→B・B→A の順で当てる（核を通す。400 通りずつ）\n');
console.log('| A × B | 順番で文書が変わった回 | 片方の順では当たらない回 | 同時に出した時の、今の核 |'); console.log('|---|---|---|---|');
for (let i = 0; i < names.length; i++) for (let j = i; j < names.length; j++) { const t = trial(KINDS[names[i]], KINDS[names[j]]);
  console.log(`| ${names[i]} × ${names[j]} | ${t.differ}/${t.n} | ${t.failAB + t.failBA} | ${Object.keys(t.conc).map((k) => `${k} ${t.conc[k]}`).join('・')} |`); }
console.log('\n### 別の値の道・並びの操作\n'); console.log('| A × B | 順番で文書が変わった回 | 片方の順では当たらない回 | 同時に出した時の、今の核 |'); console.log('|---|---|---|---|');
for (const k of Object.keys(OTHER)) { const t = trial(OTHER[k][0], OTHER[k][1]); console.log(`| ${k} | ${t.differ}/${t.n} | ${t.failAB + t.failBA} | ${Object.keys(t.conc).map((c) => `${c} ${t.conc[c]}`).join('・')} |`); }
