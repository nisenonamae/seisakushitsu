#!/usr/bin/env node
// うまくいかなかった方法の記録（追加の検証 BRIEF2 の 1）：掛ける量を「まとめて」持つと、答えが変わるか。
//  案A：残っている掛ける量の積を先に作り、起点に1回だけ掛けて丸める（途中を飛ばす）
//  案B：並びを 64 個ずつの束にして、束ごとの積を持つ（束の中は丸めない・束の境めだけ丸める）
//  案C：1つずつ丸める計算で、途中の値が「前の控えの値」と同じになったら、そこで止めて控えの終わりの値を使う（答えは変わらない。どのくらい早く止まれるかだけを見る）
// どれも、1つずつ丸める計算（今の決まり＝ふつうに操作した時と同じ計算）と突き合わせる。
import { mulberry32, scaleV } from '../src/index.js';
const rng = mulberry32(9); const FS = [0.5, 0.8, 1.25, 2, 0.3333, 3, 1.1, 0.9]; const out = [];
for (const n of [10, 100, 1000, 10000]) {
  let badA = 0; let badB = 0; let trials = 0; let cStops = 0; let cSaved = 0;
  for (let t = 0; t < 300; t++) {
    const fs = Array.from({ length: n }, () => FS[Math.floor(rng() * FS.length)]); const x0 = Math.round(rng() * 2000000) / 10000; const skip = Math.floor(rng() * n);
    // 正解：skip 番めを除いて、1つずつ丸める
    const vals = []; let v = x0; for (let i = 0; i < n; i++) { v = scaleV(v, [fs[i]], false); vals.push(v); }
    let w = x0; let stopAt = -1; for (let i = 0; i < n; i++) { if (i !== skip) w = scaleV(w, [fs[i]], false); if (i > skip && stopAt < 0 && w === vals[i]) stopAt = i; }
    trials++; if (stopAt >= 0) { cStops++; cSaved += n - stopAt; }
    // 案A：積（桁の長い分数で正確に）→ 1回だけ丸める
    let num = 1n; let den = 1n; for (let i = 0; i < n; i++) if (i !== skip) { num *= BigInt(Math.round(fs[i] * 10000)); den *= 10000n; }
    const a0 = BigInt(Math.round(x0 * 10000)); const qa = Number((2n * a0 * num + den) / (2n * den)) / 10000; if (qa !== w) badA++;
    // 案B：64 個ずつの束の積を、束の境めで丸める
    let b = x0; for (let s = 0; s < n; s += 64) { let nu = 1n; let de = 1n; for (let i = s; i < Math.min(n, s + 64); i++) if (i !== skip) { nu *= BigInt(Math.round(fs[i] * 10000)); de *= 10000n; } b = Number((2n * BigInt(Math.round(b * 10000)) * nu + de) / (2n * de)) / 10000; } if (b !== w) badB++;
  }
  out.push({ n, trials, differA: badA, differB: badB, cConverged: cStops, cSavedShare: +(cSaved / (trials * n)).toFixed(4) });
}
for (const o of out) console.log(JSON.stringify(o));
