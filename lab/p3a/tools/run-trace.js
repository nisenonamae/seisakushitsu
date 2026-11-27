#!/usr/bin/env node
// 操作の記録（traces/*.json）を核に流し、AI の作業を選んで戻したときの「戻した／上書き済み／聞く」を数える。
// 使い方：node tools/run-trace.js [記録.json …] [--start 下組み.json]   （何も書かなければ traces/ の全部）
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { createState, applyBatch, SPECS, makeUndo, makeRedo, logLength } from '../src/index.js';
import { fromAny } from '../traces/adapter.js';
import { measureAIReverts } from './scenarios.js';

/** 直した手順を核に流す */
export function runTrace(raw, opt = {}) {
  const t = fromAny(raw, opt); let state = createState(t.init); let n = 0; const failed = []; let cmds = 0;
  t.steps.forEach((st, i) => {
    const sender = st.by === 'ai' ? { k: 'ai', agent: st.agent || 'worker' } : { k: 'human', device: st.device || 'mac' }; const ctx = { sender };
    let batch;
    if (st.undo || st.redo) { const c = (st.undo ? makeUndo : makeRedo)(state.log, sender.device, `t${++n}`); if (!c) return; batch = [c]; }
    else {
      const bodies = typeof st.ops === 'function' ? st.ops(state.doc) : st.ops; if (!bodies || !bodies.length) return;
      batch = bodies.map((body) => ({ id: `t${++n}`, v: SPECS[body.type] ? SPECS[body.type].v : 1, actor: st.by === 'ai' || st.proposal ? { k: 'ai', agent: 'worker' } : { k: 'human', device: 'mac' },
        base: { ...state.doc.revs }, body, ...(st.group ? { group: st.group } : {}), ...(st.proposal ? { proposal: st.proposal } : {}) }));
    }
    const r = applyBatch(state, batch, ctx); cmds += batch.length;
    if (r.status === 'applied') state = r.state; else failed.push({ step: i, note: st.note, status: r.status, reason: r.reason, message: r.message, why: r.why });
  });
  return { state, steps: t.steps.length, cmds, failed, unmapped: t.unmapped, reverts: measureAIReverts(state) };
}

function report(name, res) {
  console.log(`\n■ ${name}\n  手順 ${res.steps}・命令 ${res.cmds} → 記録 ${logLength(res.state.log)} 件／当たらなかった手順 ${res.failed.length}／直せなかった操作 ${res.unmapped.length}`);
  const by = {}; for (const u of res.unmapped) by[`${u.type}：${u.why}`] = (by[`${u.type}：${u.why}`] || 0) + 1;
  for (const k of Object.keys(by)) console.log(`    直せず ${by[k]} 件　${k}`);
  for (const f of res.failed.slice(0, 5)) console.log(`    当たらず　${f.note || f.step}：${f.status} ${f.reason || ''} ${f.message || ''} ${f.why || ''}`);
  if (!res.reverts.length) console.log('  AI の作業が無いので、選んで戻す物はありません');
  for (const r of res.reverts) {
    const t = r.tally || {}; const n = (t.reverted || 0) + (t.noop || 0) + (t.ask || 0);
    console.log(`  AI の作業「${r.group}」（記録 ${r.records} 件・効果 ${n} 個）を戻すと：戻した ${t.reverted}／上書き済み・もう無い ${t.noop}／聞く ${t.ask}` + (r.intact ? `　人の直しの確かめ：壊れ ${r.intact.broken.length}／調べた数 ${r.intact.checked}` : ''));
    for (const a of r.asks.slice(0, 8)) console.log(`    聞く　${a.at}（${a.why}）→ 選べる答え ${a.choices.join('・')}${a.collateral && a.collateral.children && a.collateral.children.length ? `　一緒に消える子 ${a.collateral.children.join(',')}` : ''}${a.collateral && a.collateral.records ? `　あとからの直し ${a.collateral.records.length} 件` : ''}`);
    if (r.asks.length > 8) console.log(`    …ほか ${r.asks.length - 8} 件`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const si = args.indexOf('--start'); let start = null;
  if (si >= 0) { start = JSON.parse(readFileSync(args[si + 1], 'utf8')); args.splice(si, 2); }
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'traces');
  const files = args.length ? args : readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f));
  for (const f of files) { const raw = JSON.parse(readFileSync(f, 'utf8')); report(basename(f), runTrace(raw, { start: start || raw.start })); }
}
