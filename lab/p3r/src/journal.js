// 記録の保存と読みこみ（P3r の A-2・3・4）。画面も通信もファイルも触らない：文字列（行）を作る・読むだけ。
//
// ■ 記録（journal）：1行＝1まとまり（1回の apply＝全部入るか、何も入らないか）。足すだけ。
//     <印16字>\t{"n":番号,"p":"前の行の印","s":送り主,"c":[命令…]}\n          （命令だけ＝みんなで共有する形。読む側が計算し直す）
//     <印16字>\t{"n":…,"p":…,"s":…,"c":[…],"a":[当てた記録…]}\n               （効果つき＝自分の端末の控え。計算し直さずに読める）
//   印＝hash64(JSON の部分)。JSON の中に「番号 n」と「前の行の印 p」が入っているので、鎖になる。
//   壊れた行の見つけ方：①印が合わない・JSON でない → 壊れた行 ②n が続いていない・p が前の行の印と違う → 抜け・別の歴史
// ■ 写し（snapshot）：ある番号までを当てた文書の控え。1行めに中身の SHA-256。記録から、いつでも作り直せる（消してよい物）。
// ■ 読みこみ方は4つ（どれも同じ文書になることを試しで確かめる）：
//     loadReplay   記録（命令だけ）を、頭から検査つきで当て直す
//     loadTrusted  記録（効果つき）の効果を、検査なしで当てる
//     loadTail     写し＋その先の記録だけ（頭の記録は持たない。古い記録が要る操作は needs-history で断る）
//     loadIndexed  写し＋効果つきの記録の全部（頭は索引に足すだけで、当てない）
import { applyBatch, createState } from './engine.js';
import { Draft, applyEffect, revOf } from './model.js';
import { emptyLog, appendLog, logItems, logLength, logBase } from './log.js';
import { canon } from './util.js';
import { sha256, hash64 } from './hash.js';

export const GENESIS = '0000000000000000';
/** 文書の印（鍵を並べかえた決まった形の SHA-256）。端末どうしで比べる物 */
export const docHash = (doc) => sha256(canon(doc));

/** 記録の1行を作る。prev＝前の行の印。full なら、当てた記録（効果つき）も入れる */
export function journalLine(n, prev, sender, cmds, applied) {
  const json = JSON.stringify(applied ? { n, p: prev, s: sender, c: cmds, a: applied } : { n, p: prev, s: sender, c: cmds });
  const h = hash64(json); return { h, text: `${h}\t${json}\n` };
}
/** 状態の記録を、行の並びにする（持っている分だけ。写しから始めた状態なら、その先だけ）*/
export function toJournal(log, opt = {}) {
  const lines = []; let prev = opt.prev || GENESIS; let n = opt.n || 0; let cur = null; const groups = [];
  for (const a of logItems(log)) { if (!cur || cur.batch !== a.batch) groups.push((cur = { batch: a.batch, sender: a.sender, list: [] })); cur.list.push(a); }
  for (const g of groups) { const l = journalLine(++n, prev, g.sender, g.list.map((a) => a.cmd), opt.full ? g.list : undefined); lines.push(l.text); prev = l.h; }
  return { lines, last: prev, n };
}

/**
 * 記録を読む。壊れた行・重なった行を見分けて、使える所までを返す。
 * @param {string|string[]} src 全文、または行の並び（行末の \n は有っても無くてもよい）
 * @returns {{entries:{n:number,h:string,sender:any,cmds:any[],applied?:any[]}[], last:string, problems:{line:number,why:string}[], stopped:null|{line:number,why:string}, clean:boolean}}
 *   problems＝読み飛ばした行（壊れた行 broken・同じ行が2回 duplicate）。stopped＝そこから先は使えない（抜け gap・別の歴史 fork）。
 */
export function readJournal(src, opt = {}) {
  const lines = typeof src === 'string' ? src.split('\n') : src;
  const entries = []; const problems = []; let stopped = null; let prev = opt.prev || GENESIS; let expect = (opt.n || 0) + 1; let lastOk = null;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]; if (line.endsWith('\n')) line = line.slice(0, -1); if (line === '') continue;
    let o = null; const h = line.slice(0, 16); const json = line.slice(17);
    if (line.length > 18 && line[16] === '\t' && hash64(json) === h) { try { o = JSON.parse(json); } catch { o = null; } }
    if (!o || !Number.isInteger(o.n) || typeof o.p !== 'string' || !Array.isArray(o.c)) { problems.push({ line: i + 1, why: 'broken' }); continue; }
    if (o.n === expect && o.p === prev) { const e = { n: o.n, h, sender: o.s, cmds: o.c }; if (o.a) e.applied = o.a; entries.push(e); prev = h; expect++; lastOk = h; continue; }
    if (o.n === expect - 1 && h === lastOk) { problems.push({ line: i + 1, why: 'duplicate' }); continue; }      // 同じ行が2回書かれた
    stopped = { line: i + 1, why: o.n < expect ? 'fork' : 'gap' }; break;                                        // 抜けた・別の歴史が混ざった → ここから先は使わない
  }
  return { entries, last: prev, problems, stopped, clean: !problems.length && !stopped };
}
/** 壊れた行・重なった行を除いた、きれいな記録に書き直す（中身は readJournal が使えると決めた所まで）*/
export function repairJournal(src) {
  const r = readJournal(src); let prev = GENESIS; const lines = [];
  for (const e of r.entries) { const l = journalLine(e.n, prev, e.sender, e.cmds, e.applied); lines.push(l.text); prev = l.h; }
  return { lines, kept: r.entries.length, problems: r.problems, stopped: r.stopped };
}

// ---- 写し
/** 写しを作る。n＝何まとまりめまでか・h＝その行の印・seq＝記録の件数 */
export function makeSnapshot(state, n, h) {
  const body = JSON.stringify({ v: 1, n, h, seq: logLength(state.log), docHash: docHash(state.doc), doc: state.doc });
  return `P3R-SNAP ${sha256(body)}\n${body}\n`;
}
/** 写しを読む。書く途中で切れた・壊れた写しは null（＝使わない。記録から作り直す）*/
export function readSnapshot(text) {
  if (typeof text !== 'string' || !text.startsWith('P3R-SNAP ')) return null;
  const nl = text.indexOf('\n'); if (nl !== 73) return null; const sum = text.slice(9, 73); const end = text.endsWith('\n') ? text.length - 1 : text.length;
  const body = text.slice(74, end); if (sha256(body) !== sum) return null;
  try { const o = JSON.parse(body); return o && o.v === 1 && Number.isInteger(o.n) && Number.isInteger(o.seq) && o.doc ? o : null; } catch { return null; }
}
/** 写しが、この記録の続きの上にある物か（番号と行の印で見る。中身までは見ない）*/
export function snapshotFits(snap, entries) {
  if (!snap) return false; if (snap.n === 0) return snap.h === GENESIS;
  const e = entries[snap.n - 1]; return !!e && e.n === snap.n && e.h === snap.h;
}

// ---- 読みこみ
/** 記録（命令だけ）を、頭から検査つきで当て直す。当たらなかったまとまりは skipped に */
export function loadReplay(init, entries, from) {
  let state = from || createState(init); const skipped = [];
  for (const e of entries) {
    const r = applyBatch(state, e.cmds, { sender: e.sender });
    if (r.status === 'applied') state = r.state; else skipped.push({ n: e.n, status: r.status, reason: r.reason, message: r.message });
  }
  return { state, skipped };
}
function applyStored(state, list, doApply) {
  if (doApply) {
    const dr = new Draft(state.doc);
    for (const a of list) { for (const e of a.effects) applyEffect(dr, e); for (const r of a.revs) { if (revOf(dr.doc, r.target) !== r.from) throw new Error(`記録の版が合わない：${r.target}`); dr.bump(r.target); } }
    return { doc: dr.doc, log: appendLog(state.log, list) };
  }
  return { doc: state.doc, log: appendLog(state.log, list) };
}
/** 記録（効果つき）の効果を、検査なしで当てる（自分の端末の控えを読む時だけ。人から受け取った記録には使わない）*/
export function loadTrusted(init, entries) {
  let state = createState(init);
  for (const e of entries) { if (!e.applied) throw new Error('効果つきの記録でない'); state = applyStored(state, e.applied, true); }
  return { state, skipped: [] };
}
/** 写し＋その先の記録だけ。頭の記録は持たない（写しより前の操作を戻す・古い前提の命令は needs-history）*/
export function loadTail(snap, tail) {
  const start = { doc: snap.doc, log: emptyLog(snap.seq, snap.doc.revs, snap.doc) };
  return loadReplay(null, tail, start);
}
/** 写し＋効果つきの記録の全部：写しより前は索引に足すだけ（当てない）、先は効果を当てる。全部の取り消しができる */
export function loadIndexed(snap, entries) {
  let state = { doc: null, log: emptyLog() }; let i = 0;
  for (; i < entries.length && entries[i].n <= snap.n; i++) { if (!entries[i].applied) throw new Error('効果つきの記録でない'); state = applyStored(state, entries[i].applied, false); }
  if (logLength(state.log) !== snap.seq) throw new Error('写しと記録の件数が合わない');
  state = { doc: snap.doc, log: state.log };
  for (; i < entries.length; i++) state = applyStored(state, entries[i].applied, true);
  return { state, skipped: [] };
}
/**
 * 開く時の決まり（立ち直り）：記録を読む → 写しが使えれば使う → だめなら記録だけから作り直す。
 * @param {any} init @param {string|string[]} journal @param {(string|null)[]} snapshots 新しい順（書く途中で切れた物・壊れた物が混ざっていてよい）
 * @param {{verify?:boolean, mode?:'tail'|'indexed'}} opt verify＝写しの中身を、記録から作り直した文書と突き合わせる（食い違えば写しを捨てる）
 */
export function open(init, journal, snapshots = [], opt = {}) {
  const j = readJournal(journal); const notes = [];
  for (let k = 0; k < snapshots.length; k++) {
    const snap = readSnapshot(snapshots[k]);
    if (!snap) { notes.push({ snapshot: k, why: 'broken' }); continue; }
    if (!snapshotFits(snap, j.entries)) { notes.push({ snapshot: k, why: 'not-on-this-journal' }); continue; }
    if (docHash(snap.doc) !== snap.docHash) { notes.push({ snapshot: k, why: 'doc-hash' }); continue; }
    if (opt.verify) { const full = loadReplay(init, j.entries.slice(0, snap.n)); if (docHash(full.state.doc) !== snap.docHash || logLength(full.state.log) !== snap.seq) { notes.push({ snapshot: k, why: 'differs-from-journal' }); continue; } }
    const r = opt.mode === 'indexed' ? loadIndexed(snap, j.entries) : loadTail(snap, j.entries.slice(snap.n));
    // 写しの先の記録に、写しより前の記録を相手にする物（ほかの端末が古い操作を戻した、など）があった → 写しでは足りない。記録の全部から作り直す
    if (r.skipped.some((x) => x.reason === 'needs-history')) { notes.push({ snapshot: k, why: 'tail-needs-history' }); break; }
    return { ...r, journal: j, used: { snapshot: k, n: snap.n }, notes };
  }
  const r = loadReplay(init, j.entries);
  return { ...r, journal: j, used: null, notes };
}
/** 写しから始めた状態に、古い記録を読み足す（さかのぼる）：記録の全部から作り直し、同じ文書になることを確かめて返す */
export function hydrate(init, state, entries) {
  if (!logBase(state.log)) return state;
  const full = entries.every((e) => e.applied) ? loadTrusted(init, entries) : loadReplay(init, entries);
  if (canon(full.state.doc) !== canon(state.doc) || logLength(full.state.log) !== logLength(state.log)) throw new Error('読み足した記録から、同じ文書にならない');
  return full.state;
}
