// 端末をまたいだ一致（P3r の A-6）：同じ記録から、Node でもブラウザでも、届く順が違っても、写しを使っても使わなくても、同じ文書（同じ印）になるか。
// Node でもブラウザでも動く（Node の部品は、いちばん下の「命令として呼ばれた時」だけ）。  使い方：node tools/xcheck.js ／ python3 tools/browser_check.py
import { applyBatch, canon, logItems, logLength, mulberry32, aiRecordIds, makeUndo, toJournal, readJournal, loadReplay, loadTrusted, loadIndexed, makeSnapshot, readSnapshot, open, hydrate, makeInbox, docHash, sha256, ledger, buildProvenance, scaleV, snap, createState } from '../src/index.js';
import { runFuzz, INIT } from './fuzz.js';

const H = { sender: { k: 'human', device: 'd1' } };
const logSig = (state) => sha256(canon(logItems(state.log)));
/** 同じ取り消しを当てた結果の印（古い記録が要ると断られたら、読み足してから） */
function follow(state, entries, ai, undoIds) {
  let s = state; const out = [];
  for (const [id, body] of [['f1', { type: 'revert', mode: 'units', targets: ai.slice(-30) }], ['f2', { type: 'revert', mode: 'units', targets: ai.slice(0, 30) }], ['f3', { type: 'revert', mode: 'undo', targets: undoIds }]]) {
    const cmd = { id, v: 1, actor: { k: 'human', device: 'd1' }, body }; let r = applyBatch(s, [cmd], H);
    if (r.status === 'rejected' && r.reason === 'needs-history') { s = hydrate(INIT, s, entries); r = applyBatch(s, [cmd], H); }
    s = r.state; out.push(r.status, r.applied ? sha256(canon(r.applied)) : r.reason || '');
  }
  out.push(docHash(s.doc)); return sha256(out.join('|'));
}
export function replayText(text) { const rj = readJournal(text); const L = loadReplay(INIT, rj.entries); return { clean: rj.clean, n: rj.entries.length, skipped: L.skipped.length, doc: docHash(L.state.doc), log: logSig(L.state) }; }
export function runAll(opt = {}) {
  const sig = {}; const steps = opt.steps || 2500; let journal1 = '';
  for (const seed of opt.seeds || [1, 2, 3]) {
    const w = runFuzz(seed, steps); const lines = toJournal(w.state.log).lines; const text = lines.join(''); if (!journal1) journal1 = text;
    const ai = aiRecordIds(w.state.log); const u = makeUndo(w.state.log, 'd1', 'x'); const undoIds = u ? u.body.targets : ai.slice(-1);
    const rj = readJournal(text); const rf = readJournal(toJournal(w.state.log, { full: true }).lines);
    sig[`s${seed}_journal`] = sha256(text); sig[`s${seed}_doc`] = docHash(w.state.doc); sig[`s${seed}_log`] = logSig(w.state); sig[`s${seed}_n`] = [lines.length, logLength(w.state.log)];
    sig[`s${seed}_ledger`] = sha256(canon(ledger(w.state))); const pv = buildProvenance(w.state.log); sig[`s${seed}_prov`] = sha256(canon([...pv.prov].map(([t, m]) => [t, [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1))]).sort((a, b) => (a[0] < b[0] ? -1 : 1))));
    const want = follow(w.state, rj.entries, ai, undoIds); sig[`s${seed}_follow`] = want;
    const same = (name, state) => { sig[`s${seed}_${name}`] = [docHash(state.doc) === sig[`s${seed}_doc`], logLength(state.log) === logLength(w.state.log), follow(state, rj.entries, ai, undoIds) === want]; };
    same('replay', loadReplay(INIT, rj.entries).state); same('trusted', loadTrusted(INIT, rf.entries).state);
    // 届く順だけが違う2台（順番は、行の番号＝台帳の順で決まる）
    for (const [name, s2, spread] of [['inboxA', 101, 25], ['inboxB', 202, 400]]) { const rng = mulberry32(seed * 1000 + s2); const order = lines.map((l, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.max(0, i - Math.floor(rng() * spread)); [order[i], order[j]] = [order[j], order[i]]; }
      const box = makeInbox(INIT); for (const i of order) { box.receive(lines[i]); if (rng() < 0.03) box.receive(lines[Math.floor(rng() * lines.length)]); } same(name, box.state); sig[`s${seed}_${name}_n`] = [box.n, box.waiting, box.skipped.length]; }
    // 写しを使う端末（写し＋続きだけ／写し＋索引）と、使わない端末
    for (const at of [Math.floor(rj.entries.length / 2), rj.entries.length - 2]) { const head = loadReplay(INIT, rj.entries.slice(0, at)).state; const snapText = makeSnapshot(head, at, rj.entries[at - 1].h); sig[`s${seed}_snap${at}`] = sha256(snapText);
      const o = open(INIT, text, [snapText]); same(`tail${at}`, o.state); sig[`s${seed}_tail${at}_used`] = o.used ? o.used.n : o.notes.map((x) => x.why);
      same(`indexed${at}`, loadIndexed(readSnapshot(snapText), rf.entries).state); }
  }
  // 掛ける量：1つの値の道に 3000 回（比は 0.0003〜30・反転も）。AI の分を、でたらめな順に 300 回 取り消す・やり直す → 値の並びの印
  { const rng = mulberry32(77); let s = createState({ scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } }); let c = 0; const A = { sender: { k: 'ai', agent: 'w1' } };
    const mk = (ctx, body) => ({ id: `m${++c}`, v: 1, actor: ctx.sender.k === 'human' ? { k: 'human', device: 'd1' } : { k: 'ai', agent: 'w1', task: 't' }, base: { ...s.doc.revs }, body }); const go = (ctx, body) => { const cmd = mk(ctx, body); const r = applyBatch(s, [cmd], ctx); if (r.status !== 'applied') throw new Error(r.message); s = r.state; return r; };
    go(H, { type: 'node.add', node: { id: 'q', scene: 's1', kind: 'shape', name: 'q', order: 'i', geo: { t: 'rect', size: { k: 'static', v: [10, 10] }, round: { k: 'static', v: 0 } }, xf: { scale: { k: 'static', v: [123.4567, -0.0031] } } } });
    const ops = []; for (let i = 0; i < 3000; i++) { const ai = i % 3 === 0; const f = [snap(0.0003 * Math.pow(100000, rng())) * (rng() < 0.05 ? -1 : 1), snap(0.5 * Math.pow(4, rng()))]; const g = i % 2 ? f.map((x) => snap(1 / x) || 1) : f; const r = go(ai ? A : H, { type: 'prop.scale', node: 'q', path: 'xf.scale', f: g }); ops.push({ id: r.applied[0].cmd.id, f: g, ai, alive: true, last: null }); }
    const vals = []; let ok = true; const aiOps = ops.filter((o) => o.ai);
    for (let t = 0; t < 300; t++) { const o = aiOps[Math.floor(rng() * aiOps.length)]; const r = go(H, { type: 'revert', mode: 'select', targets: [o.alive ? o.id : o.last] }); o.alive = !o.alive; o.last = r.applied[0].cmd.id;
      const want = ops.reduce((v, x) => (x.alive ? scaleV(v, x.f, false) : v), [123.4567, -0.0031]); const got = s.doc.nodes.q.xf.scale.v; if (canon(want) !== canon(got)) ok = false; vals.push(got.join(',')); }
    sig.mul_ok = ok; sig.mul_vals = sha256(vals.join('|')); sig.mul_doc = docHash(s.doc); sig.mul_replay = docHash(loadReplay({ scenes: [{ id: 's1' }], stages: { art: 'ai', motion: 'ai', script: 'ai' } }, readJournal(toJournal(s.log).lines).entries).state.doc) === sig.mul_doc; }
  sig.all = sha256(canon(sig)); return { sig, journal1 };
}
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('xcheck.js')) {
  const fs = await import('node:fs'); const i = process.argv.indexOf('--replay');
  if (i > 0) console.log(JSON.stringify(replayText(fs.readFileSync(process.argv[i + 1], 'utf8'))));
  else { const t = Date.now(); const r = runAll(); const j = process.argv.indexOf('--journal'); if (j > 0) fs.writeFileSync(process.argv[j + 1], r.journal1);
    if (process.argv.includes('--json')) console.log(JSON.stringify(r.sig)); else { for (const k of Object.keys(r.sig)) console.log(k, JSON.stringify(r.sig[k])); console.log(`（${((Date.now() - t) / 1000).toFixed(1)} 秒）`); } }
}
