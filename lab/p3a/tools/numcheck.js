// 数の検証（1/10000 の格子）。BRIEF2 の B。Node でもブラウザでも同じ物が動く（src/ と test/gen.js だけを使う。時計は速さの表示にしか使わない）。
//   node tools/numcheck.js            … 表を出す
//   node tools/numcheck.js --json     … ブラウザと突き合わせる用の印（ハッシュ）だけ出す
// 誤差の単位は「格子」（1 格子 = 0.0001）。数字は、こちらで作った値の並び（種つきの乱数）での物。
import { createState, applyBatch, replay, toEntries, makeUndo, snap, toGrid, scaleV, GRID, canon, hash, mulberry32, SPECS } from '../src/index.js';
import { makeGen } from '../test/gen.js';

const S = (v) => ({ k: 'static', v });
const stat = () => ({ n: 0, bad: 0, max: 0, sum: 0, first: null, add(e, step) { e = Math.abs(e); this.n++; this.sum += e; if (e > 1e-9) { this.bad++; if (this.first === null) this.first = step; } if (e > this.max) this.max = e; },
  row() { return `${this.n} | ${this.bad}（${(100 * this.bad / (this.n || 1)).toFixed(2)}%）| ${fmt(this.max)} | ${fmt(this.sum / (this.n || 1))} | ${this.first === null ? '出ない' : this.first + ' 回め'}`; } });
const fmt = (x) => (x === 0 ? '0' : x >= 100 ? x.toFixed(0) : x >= 1 ? x.toFixed(2) : x.toPrecision(2));
const g = (x) => toGrid(x); // 格子の番号
const rf = (rng, lo, hi) => snap(lo * Math.pow(hi / lo, rng())); // 対数で一様な比
const pickV = (rng, mag) => snap((rng() * 2 - 1) * mag);

export function runAll(opt = {}) {
  const out = []; const sig = {}; const P = (s) => out.push(s); const N = opt.quick ? 0.2 : 1;
  const rng = mulberry32(20261127);

  // ───── 0. 足す・引く（格子の整数）
  P('### B-0 足す・引く（足す量 delta）\n'); P('| 値の大きさ | 回 | 元に戻らなかった | 最大の誤差（格子）| 平均 | 何回めから |'); P('|---|---|---|---|---|---|');
  for (const mag of [1, 1e3, 1e6, 1e9, 1e11, 1e12]) { const st = stat();
    for (let i = 0; i < 20000 * N; i++) { const v = pickV(rng, mag); const d = pickV(rng, mag); const add = (x, y) => (g(x) + g(y)) / GRID; const back = add(add(v, d), -d); st.add(g(back) - g(v), i + 1);
      const viaBig = Number(BigInt(g(v)) + BigInt(g(d))) ; if (g(add(v, d)) !== viaBig) st.add(1, i + 1); }
    P(`| ±${mag.toExponential(0)} | ${st.row()} |`); sig[`add${mag}`] = st.bad; }

  // ───── 1. 伸ばす・縮める
  P('\n### B-1a 同じ比の往復（×f のあと ×(1/f) の命令。1/f は格子に丸めた比）を 1000 往復\n'); P('| 比 f（1/f の丸め）| 始めの値 | 往復 | ずれた回 | 最大の誤差（格子）| 平均 | 何回めから | 1000 往復のあとの値 |'); P('|---|---|---|---|---|---|---|---|');
  for (const f of [2, 4, 0.5, 3, 1.5, 7, 1.1, 0.3333]) for (const v0 of [0.0003, 1, 123.4567, 99999.9999]) { const inv = snap(1 / f); let v = v0; const st = stat();
    for (let i = 1; i <= 1000; i++) { v = scaleV(scaleV(v, [f]), [inv]); st.add(g(v) - g(v0), i); }
    P(`| ${f}（${inv}）| ${v0} | ${st.row()} | ${v} |`); sig[`rt${f}_${v0}`] = v; }

  P('\n### B-1b 掛けて、そのまま取り消す（効果の before に戻す＝9.5節の行6）\n'); P('| 値の大きさ | 比の幅 | 回 | 元に戻らなかった | 最大の誤差 | 平均 | 何回めから |'); P('|---|---|---|---|---|---|---|');
  for (const mag of [0.01, 1, 1000, 1e6]) { const st = stat(); for (let i = 0; i < 20000 * N; i++) { const v = pickV(rng, mag); const f = rf(rng, 0.0001, 1000); const before = v; scaleV(v, [f]); st.add(g(before) - g(v), i + 1); } P(`| ±${mag} | 0.0001〜1000 | ${st.row()} |`); }

  P('\n### B-1c ほかの掛け算が上に乗ったあとに割る（AI ×f → 人 ×g → AI の分だけ戻す＝行7）。正しい答えは「始めの値 ×g を丸めた数」\n'); P('| AI の比 f | 値の大きさ | 回 | ずれた回 | 最大の誤差（格子）| 平均 | 何回めから |'); P('|---|---|---|---|---|---|---|');
  const fr = [[0.0001, 0.01], [0.01, 0.5], [0.5, 2], [2, 100], [100, 1000]];
  for (const [lo, hi] of fr) for (const mag of [1, 1000]) { const st = stat();
    for (let i = 0; i < 20000 * N; i++) { const v = pickV(rng, mag); const f = rf(rng, lo, hi); const gg = rf(rng, 0.25, 4); const got = scaleV(scaleV(scaleV(v, [f]), [gg]), [f], true); st.add(g(got) - g(scaleV(v, [gg])), i + 1); }
    P(`| ${lo}〜${hi} | ±${mag} | ${st.row()} |`); sig[`c${lo}_${mag}`] = st.max; }

  P('\n### B-1d 積もり方：「AI ×f → 人 ×g → AI の分だけ戻す」をくり返す（人の比は、行って戻る組。正しい答え＝人の掛け算だけを順に当てた値）\n'); P('| AI の比 f | くり返し | 最大の誤差（格子）| 最後の誤差 | 何回めから | 比べ：人の掛け算だけでも、丸めで動く量（最後）|'); P('|---|---|---|---|---|---|');
  for (const [lo, hi] of [[0.5, 2], [0.1, 10], [0.01, 100]]) for (const K of [100, 2000]) { let v = 1; let ideal = 1; let exact = 1; const st = stat(); let prev = null;
    for (let i = 1; i <= K; i++) { const f = rf(rng, lo, hi); const gg = prev === null ? rf(rng, 0.5, 2) : snap(1 / prev); prev = prev === null ? gg : null;
      v = scaleV(scaleV(scaleV(v, [f]), [gg]), [f], true); ideal = scaleV(ideal, [gg]); exact *= gg; st.add(g(v) - g(ideal), i); }
    P(`| ${lo}〜${hi} | ${K} | ${fmt(st.max)} | ${g(v) - g(ideal)} | ${st.first === null ? '出ない' : st.first} | ${fmt(Math.abs(ideal - exact) * GRID)} |`); sig[`d${lo}_${K}`] = v; }

  // ───── 2. 回す
  P('\n### B-2a 回す：角度の値に足す（足す量）\n'); P('| くり返し | 元に戻らなかった | 最大の誤差 |'); P('|---|---|---|');
  { let a = 12.3456; const a0 = a; const ds = []; const st = stat(); const add = (x, y) => (g(x) + g(y)) / GRID;
    for (let i = 0; i < 100000 * N; i++) { const d = pickV(rng, 720); ds.push(d); a = add(a, d); } for (let i = ds.length - 1; i >= 0; i--) a = add(a, -ds[i]); st.add(g(a) - g(a0), 1);
    P(`| ${ds.length} 回足して、逆の順に全部引く | ${st.bad} | ${st.max} |`); sig.rotAdd = a; }
  P('\n### B-2b 回す：回した結果を点の座標に焼く（毎回、格子に丸める）\n'); P('| 回し方 | 点の遠さ | 最大の誤差（格子）| 最後の誤差（格子）| 何回めから |'); P('|---|---|---|---|---|');
  const rot = (p, deg) => { const t = deg * Math.PI / 180; const c = Math.cos(t); const s = Math.sin(t); return [snap(p[0] * c - p[1] * s), snap(p[0] * s + p[1] * c)]; };
  for (const [name, steps, deg] of [['1 度 × 360 回（1周）', 360, 1], ['0.1 度 × 3600 回（1周）', 3600, 0.1], ['90 度 × 4000 回', 4000, 90], ['+7.3 度と −7.3 度を交互に 2000 回', 2000, null], ['37 度 × 360 回（37周）', 360, 37]]) for (const r of [10, 1000]) {
    const p0 = [snap(r * 0.6), snap(r * 0.8)]; let p = p0; const st = stat(); let last = 0;
    for (let i = 1; i <= steps; i++) { const d = deg === null ? (i % 2 ? 7.3 : -7.3) : deg; p = rot(p, d); const tot = deg === null ? (i % 2 ? 7.3 : 0) : deg * i; const t = tot * Math.PI / 180; const ex = [p0[0] * Math.cos(t) - p0[1] * Math.sin(t), p0[0] * Math.sin(t) + p0[1] * Math.cos(t)];
      last = Math.hypot(p[0] - ex[0], p[1] - ex[1]) * GRID; st.add(last > 0.75 ? last : 0, i); }
    P(`| ${name} | ${r} | ${fmt(st.max)} | ${fmt(last)} | ${st.first === null ? '出ない（丸めの半格子以内）' : st.first} |`); sig[`rot${name}${r}`] = p; }

  // ───── 3. 変形と取り消しを交互に（核を通す）
  P('\n### B-3 変形と取り消しを交互にくり返す（命令の核を通す）\n'); P('| 筋書き | くり返し | 結果 |'); P('|---|---|---|');
  const H1 = { sender: { k: 'human', device: 'd1' } }; const H2 = { sender: { k: 'human', device: 'd2' } };
  const mk = () => { let s = createState({ scenes: [{ id: 's1' }] }); let n = 0;
    const cmd = (body, ctx) => ({ id: `n${++n}`, v: SPECS[body.type].v, actor: ctx.sender, base: { ...s.doc.revs }, body });
    const run = (body, ctx = H1) => { const r = applyBatch(s, [cmd(body, ctx)], ctx); if (r.status !== 'applied') throw new Error(`${body.type}: ${r.reason} ${r.message}`); s = r.state; return r; };
    const undo = (dev = 'd1') => { const c = makeUndo(s.log, dev, `n${++n}`); const r = applyBatch(s, [c], dev === 'd1' ? H1 : H2); if (r.status !== 'applied') throw new Error(`undo: ${r.reason} ${r.message}`); s = r.state; return r; };
    run({ type: 'node.add', node: { id: 'A', scene: 's1', kind: 'shape', name: 'A', order: 'i', geo: { t: 'path', closed: true, pts: [{ id: 'p', p: S([12.3456, -7.0001]) }] }, fill: { color: S({ k: 'hex', v: '#000000' }) }, xf: { pos: S([100.5, -3.25]), rot: S(33.3333), scale: S([1.5, 0.75]) } } });
    return { run, undo, get doc() { return s.doc; }, get s() { return s; } }; };
  const K3 = Math.round(3000 * N);
  { const b = mk(); const start = canon(b.doc.nodes.A); let bad = 0;
    for (let i = 0; i < K3; i++) { const r = rng(); if (r < 0.3) b.run({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [pickV(rng, 500), pickV(rng, 500)] }); else if (r < 0.5) b.run({ type: 'prop.nudge', node: 'A', path: 'xf.rot', d: [pickV(rng, 720)] });
      else if (r < 0.8) b.run({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [rf(rng, 0.001, 100) * (rng() < 0.2 ? -1 : 1), rf(rng, 0.001, 100)] }); else b.run({ type: 'pt.nudge', node: 'A', pt: 'p', d: [pickV(rng, 50), pickV(rng, 50)] });
      b.undo(); if (canon(b.doc.nodes.A) !== start) bad++; }
    P(`| 1人で：動かす・回す・伸ばす（比 0.001〜100・反転あり）・点を動かす → すぐ取り消す | ${K3} | 元と違った回 ${bad} |`); sig.b3a = hash(canon(b.doc)); }
  { const b = mk(); let sum = [g(100.5), g(-3.25)]; let bad = 0;
    for (let i = 0; i < K3; i++) { b.run({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d: [pickV(rng, 500), pickV(rng, 500)] }); const d = [pickV(rng, 30), pickV(rng, 30)]; b.run({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d }, H2); sum = [sum[0] + g(d[0]), sum[1] + g(d[1])]; b.undo('d1');
      const v = b.doc.nodes.A.xf.pos.v; if (g(v[0]) !== sum[0] || g(v[1]) !== sum[1]) bad++; }
    P(`| 動かす → 別の端末が同じ値を動かす → 自分の分だけ取り消す（残るのは、別の端末の分の合計）| ${K3} | 合計と違った回 ${bad} |`); sig.b3b = hash(canon(b.doc)); }
  for (const [lo, hi] of [[0.5, 2], [0.01, 100]]) { const b = mk(); let ideal = [1.5, 0.75]; const st = stat(); let prev = null;
    for (let i = 1; i <= K3; i++) { b.run({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [rf(rng, lo, hi)] }); const gg = prev === null ? rf(rng, 0.5, 2) : snap(1 / prev); prev = prev === null ? gg : null;
      b.run({ type: 'prop.scale', node: 'A', path: 'xf.scale', f: [gg] }, H2); ideal = scaleV(ideal, [gg]); b.undo('d1'); const v = b.doc.nodes.A.xf.scale.v; st.add(Math.max(Math.abs(g(v[0]) - g(ideal[0])), Math.abs(g(v[1]) - g(ideal[1]))), i); }
    P(`| 伸ばす（比 ${lo}〜${hi}）→ 別の端末が同じ値を伸ばす → 自分の分だけ取り消す（＝割る）| ${K3} | ずれた回 ${st.bad}・最大 ${fmt(st.max)} 格子・最後 ${fmt(Math.abs(g(b.doc.nodes.A.xf.scale.v[0]) - g(ideal[0])))} 格子・${st.first === null ? '出ない' : st.first + ' 回めから'} |`); sig[`b3c${lo}`] = hash(canon(b.doc)); }

  // ───── 4. 順番
  P('\n### B-4 順番を変える\n'); P('| 比べる物 | 回 | 結果が違った | 最大の違い（格子）| 平均 | 何回めから |'); P('|---|---|---|---|---|---|');
  { const st = stat(); for (let i = 0; i < 50000 * N; i++) { const v = pickV(rng, 1000); const a = rf(rng, 0.01, 100); const c = rf(rng, 0.01, 100); st.add(g(scaleV(scaleV(v, [a]), [c])) - g(scaleV(scaleV(v, [c]), [a])), i + 1); } P(`| 掛ける量どうし：×a→×c と ×c→×a（比 0.01〜100）| ${st.row()} |`); sig.ord1 = st.bad; }
  { const st = stat(); for (let i = 0; i < 50000 * N; i++) { const v = pickV(rng, 1000); const a = rf(rng, 0.5, 2); const c = rf(rng, 0.5, 2); st.add(g(scaleV(scaleV(v, [a]), [c])) - g(scaleV(scaleV(v, [c]), [a])), i + 1); } P(`| 掛ける量どうし（比 0.5〜2）| ${st.row()} |`); sig.ord2 = st.bad; }
  { const st = stat(); for (let i = 0; i < 50000 * N; i++) { const v = pickV(rng, 1000); const a = pickV(rng, 100); const c = pickV(rng, 100); st.add((g(v) + g(a) + g(c)) - (g(v) + g(c) + g(a)), i + 1); } P(`| 足す量どうし：+a→+c と +c→+a | ${st.row()} |`); }
  { const b1 = mk(); const b2 = mk(); let bad = 0; const K = Math.round(500 * N);
    for (let i = 0; i < K; i++) { const f = [rf(rng, 0.1, 10)]; const d = [pickV(rng, 100), pickV(rng, 100)]; b1.run({ type: 'prop.scale', node: 'A', path: 'xf.scale', f }); b1.run({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d }); b2.run({ type: 'prop.nudge', node: 'A', path: 'xf.pos', d }); b2.run({ type: 'prop.scale', node: 'A', path: 'xf.scale', f }); if (canon(b1.doc.nodes.A) !== canon(b2.doc.nodes.A)) bad++; }
    P(`| 部品を「伸ばす→動かす」と「動かす→伸ばす」（別の値の道：xf.scale と xf.pos。核を通す）| ${K} | ${bad} | 0 | 0 | ${bad ? '-' : '出ない'} |`); }
  { const st = stat(); for (let i = 0; i < 50000 * N; i++) { const v = pickV(rng, 1000); const a = rf(rng, 0.5, 2); const d = pickV(rng, 100); st.add(g(snap(scaleV(v, [a]) + d)) - g(scaleV(snap(v + d), [a])), i + 1); } P(`| 同じ値の道に「掛ける→足す」と「足す→掛ける」（もともと別の計算。丸めのせいではない）| ${st.row()} |`); }

  // ───── 5. 保存して読みこむ・記録から作り直す
  P('\n### B-5 保存して読みこむ（JSON）・記録からの作り直し\n');
  { const INIT = { scenes: [{ id: 's1', stage: 0 }, { id: 's2', stage: 2 }], stages: { art: 'ai', motion: 'ai', script: 'ai' }, perms: { 'write.script': 'allow' } }; const rows = [];
    for (const seed of [1, 2, 3]) { const gen = makeGen(mulberry32(seed)); let state = createState(INIT); let last = null; const steps = Math.round(3000 * N);
      for (let i = 0; i < steps; i++) { const st = gen.next(state, last); last = st; state = applyBatch(state, st.cmds, st.ctx).state; }
      const h = hash(canon(state.doc)); const json = JSON.stringify(state.doc); const h2 = hash(canon(JSON.parse(json))); const entries = JSON.parse(JSON.stringify(toEntries(state.log))); const rp = replay(INIT, entries); const h3 = hash(canon(rp.state.doc));
      let off = 0; let nums = 0; JSON.stringify(state.doc, (k, v) => { if (typeof v === 'number' && k !== 'at' && !Number.isInteger(v)) { nums++; if (snap(v) !== v) off++; } return v; });
      rows.push(`| 種 ${seed}・でたらめな命令 ${steps} 手（掛ける量を含む）| ${h} | ${h2 === h ? '同じ' : '違う ' + h2} | ${h3 === h && !rp.skipped.length ? '同じ' : '違う ' + h3} | ${off}/${nums} |`); sig[`fuzz${seed}`] = h; sig[`fuzzlog${seed}`] = hash(canon(entries)); if (h2 !== h || h3 !== h || off) sig.fail = true; }
    P('| 記録 | 文書の印（ハッシュ）| JSON にして戻す | 記録（JSON にして戻した物）から作り直す | 格子に乗っていない小数 |'); P('|---|---|---|---|---|'); rows.forEach(P); }

  // ───── 7. 別の持ち方の比べ
  P('\n### B-7 別の持ち方の比べ（「AI ×f → 人 ×g → AI の分だけ戻す」を 2000 回。始めの値 1。正しい答え＝人の比だけの積〔倍精度の小数で計算。丸めなし〕。誤差は、半格子を超えた分だけ数える）\n'); P('| 持ち方 | AI の比 0.5〜2：最大の誤差（格子）・最後 | AI の比 0.01〜100：最大・最後 | 逆向きがぴったりか | 困る所 |'); P('|---|---|---|---|---|');
  { const res = {}; const K = Math.round(2000 * N); const KF = 200;
    for (const [lo, hi] of [[0.5, 2], [0.01, 100]]) { const r2 = mulberry32(777);
      let A = 1; let E = 1; const G8 = 1e8; const snap8 = (x) => Math.sign(x) * Math.round(Math.abs(x) * G8) / G8; let L = 0; let Lideal = 0; let Rn = 1n; let Rd = 1n; let digits = 0; let list = []; let listMax = 0;
      const mA = stat(); const mE = stat(); const mD = stat(); const mB = stat(); const mC = stat(); let exact = 1; let prev = null;
      for (let i = 1; i <= K; i++) { const f = rf(r2, lo, hi); const gg = prev === null ? rf(r2, 0.5, 2) : snap(1 / prev); prev = prev === null ? gg : null;
        A = scaleV(scaleV(scaleV(A, [f]), [gg]), [f], true);                                   // 今の持ち方
        E = snap8(snap8(snap8(E * f) * gg) / f);                                                // 比だけ格子を 1/1億 に
        const lf = Math.round(Math.log(f) * 1e8); const lg = Math.round(Math.log(gg) * 1e8); L = L + lf + lg - lf; Lideal += Math.log(gg); // 対数で持つ（対数の格子 1/1億）
        const F = BigInt(g(f)); const Gg = BigInt(g(gg)); const gc = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; }; if (i <= KF) { Rn = Rn * F * Gg * 10000n; Rd = Rd * 10000n * 10000n * F; const c = gc(Rn, Rd); Rn /= c; Rd /= c; digits = Math.max(digits, Rd.toString().length); } // 分数（桁が伸びて遅いので、始めの KF 回だけ）
        list.push(['ai', f]); list.push(['h', gg]); list = list.filter((x) => x[0] !== 'ai'); listMax = Math.max(listMax, list.length);                 // 掛けた量の並び
        exact *= gg;
        mA.add((A - exact) * GRID > 0.5 || (exact - A) * GRID > 0.5 ? (A - exact) * GRID : 0, i); mE.add(Math.abs(E - exact) * GRID > 0.5 ? (E - exact) * GRID : 0, i); mD.add(Math.abs(Math.exp(L / 1e8) - exact) * GRID > 0.5 ? (Math.exp(L / 1e8) - exact) * GRID : 0, i);
        mB.add(Math.abs(list.reduce((a, x) => a * x[1], 1) - exact) * GRID > 0.5 ? 1 : 0, i); if (i <= KF) mC.add(Math.abs(Number(Rn * 1000000000000n / Rd) / 1e12 - exact) * GRID > 0.5 ? 1 : 0, i);
        res[lo] = { A: [mA.max, Math.abs(A - exact) * GRID], E: [mE.max, Math.abs(E - exact) * GRID], D: [mD.max, Math.abs(Math.exp(L / 1e8) - exact) * GRID], B: [mB.max, listMax], C: [mC.max, digits] }; }
      sig[`alt${lo}`] = [A, E, L]; }
    const c = (k, lo) => `${fmt(res[lo][k][0])}・${fmt(res[lo][k][1])}`;
    P(`| 今のまま（値を 1/10000 の格子に丸め、戻す時は割る）| ${c('A', 0.5)} | ${c('A', 0.01)} | 上に何も乗っていなければ、ぴったり（before）。乗っていれば、ずれる | 小さい比を掛けると桁が落ち、割っても戻らない |`);
    P(`| 比の値だけ、格子を 1/1億 にする | ${c('E', 0.5)} | ${c('E', 0.01)} | 同じ（ずれが 1万分の1 に小さくなるだけ）| 画素・角度と格子が2種類になる。小さい比では、まだずれる |`);
    P(`| 対数で持つ（ln の格子 1/1億。掛ける＝足す）| ${c('D', 0.5)} | ${c('D', 0.01)} | いつでもぴったり（整数の足し引き）| 2 倍・0.5 倍などの「きれいな比」が、きれいな数で保存されない。反転（負）と 0 を別に持つ必要 |`);
    P(`| 掛けた量の並びで持つ（元の値＋[だれが・何倍]。見せる時に掛ける）| ${fmt(res[0.5].B[0])}・0（並びの長さ 最大 ${res[0.5].B[1]}）| ${fmt(res[0.01].B[0])}・0（最大 ${res[0.01].B[1]}）| いつでもぴったり（並びから外すだけ）| 並びが伸びる（人の掛け算の数だけ。置きかえで 1 つに畳める）。値の形が変わる |`);
    P(`| 分数で持つ（分子/分母の整数。始めの ${KF} 回だけ）| ${fmt(res[0.5].C[0])}・0（${KF} 回で、分母 ${res[0.5].C[1]} 桁）| ${fmt(res[0.01].C[0])}・0（${KF} 回で ${res[0.01].C[1]} 桁）| いつでもぴったり | 桁が伸びうる（約分しても）。JSON の数に入らないので文字で持つ |`); }
  sig.all = hash(canon(sig));
  return { text: out.join('\n'), sig };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('numcheck.js')) {
  const r = runAll({ quick: process.argv.includes('--quick') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(r.sig)); else { console.log(r.text); console.log(`\n突き合わせ用の印：${r.sig.all}`); }
  if (r.sig.fail) process.exitCode = 1;
}
