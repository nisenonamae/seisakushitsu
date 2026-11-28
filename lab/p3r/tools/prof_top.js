#!/usr/bin/env node
// --cpu-prof の出力から、関数ごとの「自分の時間」を、ある関数（既定：runRevert）の下だけで数える。
import fs from 'node:fs';
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const under = process.argv[3] || 'runRevert';
const byId = new Map(p.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const inside = new Map(); const isIn = (id) => { if (inside.has(id)) return inside.get(id); let x = id; let r = false; while (x !== undefined) { if (byId.get(x).callFrame.functionName === under) { r = true; break; } x = parent.get(x); } inside.set(id, r); return r; };
const self = new Map(); let tot = 0; let all = 0;
for (let i = 0; i < p.samples.length; i++) { const dt = p.timeDeltas[i] / 1000; all += dt; const id = p.samples[i]; if (!isIn(id)) continue; tot += dt; const f = byId.get(id).callFrame; const name = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; self.set(name, (self.get(name) || 0) + dt); }
console.log(`全体 ${all.toFixed(0)} ms／${under} の下 ${tot.toFixed(0)} ms`);
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[4] || 18))) console.log(`${(100 * v / tot).toFixed(1).padStart(5)}%  ${v.toFixed(0).padStart(7)} ms  ${k}`);
