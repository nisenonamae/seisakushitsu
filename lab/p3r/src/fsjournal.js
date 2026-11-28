// ファイルへの保存（追加の検証 BRIEF2 の 2・5・7）。**ここだけ Node の fs を使う**（src のほかのファイルは使わない。ブラウザでは別の作りが要る）。
//
// フォルダの中身：
//   seg-00000001.jl   記録の束（1行＝1まとまり・効果つき・印の鎖。束の頭の番号が名前）。足すだけ。1束 segSize まとまり
//   idx-00000001.jl   索引の控え（その束の「細い記録」。記録から作り直せる。無い・短い・合わない時は、束から作り直す）
//   snap-00001000.json 写し（新しい物を2つ残す）。*.tmp に書き → 書き終わりを確かめ（fsync）→ 名前を付けかえて入れかえる
//
// 書く順：①束に1行を足す → ②fsync（ここまで済めば、そのまとまりは残る）→ ③索引の控えに1行（fsync しない。失っても作り直せる）
// 開く時：*.tmp を消す → 最後の束の、切れた終わりを切りつめる（壊れた行が途中にあれば、きれいな束に書き直して入れかえる）→
//   使える写しのうち、いちばん新しい物から始める（無ければ、束を頭から当てる）→ 索引は、索引の控えから（古い記録の本体は読まない）→ 続きを当てる
// 古い記録の本体は、メモリに持たない：要る時に、束を読む（読んだ束は cacheSegs 個まで持つ）。
import fs from 'node:fs';
import path from 'node:path';
import { applyBatch, createState } from './engine.js';
import { emptyLog, appendIndexOnly, evictLog, setArchive, logLength } from './log.js';
import { journalLine, parseLine, GENESIS, makeSnapshot, readSnapshot, docHash, slimLine, parseSlimLine, applyStoredAll } from './journal.js';

const pad = (n) => String(n).padStart(8, '0');
const now = () => Number(process.hrtime.bigint()) / 1e6;

/**
 * @param {string} dir @param {any} init
 * @param {{segSize?:number, snapEvery?:number, hot?:number, cacheSegs?:number, fsync?:boolean, crash?:{point:string, at:number, cut?:number}, keepAll?:boolean, noSnapshot?:boolean, trace?:(p:string)=>void}} opt
 *   hot＝メモリに本体を持つ新しい記録の件数／keepAll＝本体を下ろさない（比べる用）／crash＝試し用：決まった所で自分を止める
 */
export function openStore(dir, init, opt = {}) {
  const segSize = opt.segSize || 1000; const snapEvery = opt.snapEvery === undefined ? 1000 : opt.snapEvery; const hot = opt.hot || 2000; const cacheSegs = opt.cacheSegs || 4; const doSync = opt.fsync !== false;
  fs.mkdirSync(dir, { recursive: true });
  const info = { notes: [], ms: {}, used: null, truncated: 0, rewrote: 0, idxRebuilt: 0, tail: 0, segReads: 0 };
  const hits = new Map();
  /** 試し用の止め所。名前ごとに数えて、決めた回で自分を止める（SIGKILL） */
  const cp = (name) => { if (opt.trace) opt.trace(name); if (!opt.crash) return false; const c = (hits.get(name) || 0) + 1; hits.set(name, c); return opt.crash.point === name && c === opt.crash.at; };
  const die = () => { process.kill(process.pid, 'SIGKILL'); for (;;) { /* 止められるのを待つ */ } };
  const syncDir = () => { if (!doSync) return; const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };
  /** 書く：途中で止める試しでは、頭の一部だけを書いて止まる */
  const write = (fd, text, name) => {
    const buf = Buffer.from(text, 'utf8');
    if (cp(`${name}-mid`)) { fs.writeSync(fd, buf, 0, Math.max(1, Math.min(buf.length - 1, Math.floor(buf.length * (opt.crash.cut === undefined ? 0.5 : opt.crash.cut))))); die(); }
    fs.writeSync(fd, buf, 0, buf.length); if (cp(`${name}-written`)) die();
  };
  const sync = (fd, name) => { if (doSync) fs.fsyncSync(fd); if (cp(`${name}-synced`)) die(); };

  // ---- 開く
  let t0 = now();
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.tmp')) { fs.unlinkSync(path.join(dir, f)); info.notes.push({ file: f, why: 'tmp-removed' }); }
  const names = fs.readdirSync(dir);
  const segFirst = names.filter((f) => /^seg-\d{8}\.jl$/.test(f)).map((f) => Number(f.slice(4, 12))).sort((a, b) => a - b);
  const snapNs = names.filter((f) => /^snap-\d{8}\.json$/.test(f)).map((f) => Number(f.slice(5, 13))).sort((a, b) => b - a);
  const segPath = (first) => path.join(dir, `seg-${pad(first)}.jl`); const idxPath = (first) => path.join(dir, `idx-${pad(first)}.jl`); const snapPath = (n) => path.join(dir, `snap-${pad(n)}.json`);

  // 束ごとの目次：まとまりの番号 → 行の印・最初の記録の位置。索引の控えから読む（合わなければ、束から作り直す）
  const lineH = [GENESIS]; const firstSeq = [0, 0];   // lineH[n]＝n 番めの行の印。firstSeq[n]＝n 番めのまとまりの、最初の記録の位置（firstSeq[n+1] まで）
  const cache = new Map();                             // 束の頭の番号 → 読んだ束（まとまりごとの、当てた記録の並び）
  /** 束を読む（印と鎖を確かめる）。壊れた行・切れた終わりは、使える所までを返す */
  const readSeg = (first, prev) => {
    const text = fs.readFileSync(segPath(first), 'utf8'); const lines = text.split('\n'); const ents = []; let p = prev; let n = first; let bytes = 0; let clean = true; let problems = 0; let cleanEnts = 0;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]; const last = i === lines.length - 1; if (last && raw === '') break;
      const o = last ? null : parseLine(raw);                                            // 終わりに改行の無い行は、書く途中で切れた行
      if (o && o.n === n && o.p === p && Array.isArray(o.a)) { ents.push({ n: o.n, h: o.h, sender: o.s, cmds: o.c, applied: o.a }); p = o.h; n++; if (clean) { bytes += Buffer.byteLength(raw, 'utf8') + 1; cleanEnts++; } continue; }
      if (o && o.n === n - 1 && o.h === p) { problems++; clean = false; continue; }      // 同じ行が2回
      if (!o) { problems++; clean = false; continue; }                                    // 壊れた行（読み飛ばす。続きの鎖がつながらなければ、次で止まる）
      clean = false; problems++; break;                                                   // 抜け・別の歴史：ここから先は使わない
    }
    return { ents, last: p, next: n, bytes, prefixOk: cleanEnts === ents.length, problems };   // prefixOk＝使える行が、ファイルの頭からきれいに並んでいる（＝終わりを切りつめるだけでよい）
  };
  const loadSeg = (first) => {
    let s = cache.get(first); if (s) { cache.delete(first); cache.set(first, s); return s; }
    const r = readSeg(first, lineH[first - 1]); info.segReads++; s = r.ents.map((e) => e.applied);
    cache.set(first, s); if (cache.size > cacheSegs) cache.delete(cache.keys().next().value); return s;
  };
  /** 古い記録の置き場：記録の位置 → 束を読んで返す */
  const arch = { get(i) {
    let lo = 1; let hi = lineH.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (firstSeq[m] <= i) lo = m; else hi = m - 1; }
    let k = segFirst.length - 1; while (k > 0 && segFirst[k] > lo) k--; const seg = loadSeg(segFirst[k]); const list = seg[lo - segFirst[k]];
    if (!list) throw new Error(`古い記録が読めない（束 ${segFirst[k]}・まとまり ${lo}）`); return list[i - firstSeq[lo]];
  } };

  // 最後の束：切れた終わりを切りつめる・壊れていれば書き直す。手前の束は、索引の控えを信じて、本体は読まない（読む時に印を確かめる）
  const slimOfSeg = new Map();   // 束の頭 → 細い記録の行（{n,h,r}）
  const readIdx = (first) => { let text; try { text = fs.readFileSync(idxPath(first), 'utf8'); } catch { return []; } const out = []; let n = first; for (const l of text.split('\n')) { if (!l) continue; const o = parseSlimLine(l); if (!o || o.n !== n) break; out.push(o); n++; } return out; };
  const writeIdx = (first, ents) => { const tmp = idxPath(first) + '.tmp'; fs.writeFileSync(tmp, ents.map((e) => slimLine(e.n, e.h, e.applied)).join('')); fs.renameSync(tmp, idxPath(first)); info.idxRebuilt++; };
  let lastEnts = null;
  for (let k = 0; k < segFirst.length; k++) {
    const first = segFirst[k]; const isLast = k === segFirst.length - 1; const expectCount = isLast ? null : segFirst[k + 1] - first;
    if (first !== lineH.length) throw new Error(`束が抜けている：${first}（次は ${lineH.length} のはず）`);
    let idx = readIdx(first);
    if (isLast || idx.length !== expectCount) {   // 最後の束は本体を読む。手前の束は、索引の控えが合わない時だけ
      const r = readSeg(first, lineH[first - 1]);
      if (isLast && r.problems) {
        if (r.prefixOk) { fs.truncateSync(segPath(first), r.bytes); if (doSync) { const tfd = fs.openSync(segPath(first), 'r+'); fs.fsyncSync(tfd); fs.closeSync(tfd); } info.truncated++; }   // 切れた終わりを切りつめる
        else { const tmp = segPath(first) + '.tmp'; const wfd = fs.openSync(tmp, 'w'); let p = lineH[first - 1]; for (const e of r.ents) { const l = journalLine(e.n, p, e.sender, e.cmds, e.applied); fs.writeSync(wfd, l.text); p = l.h; } if (doSync) fs.fsyncSync(wfd); fs.closeSync(wfd); fs.renameSync(tmp, segPath(first)); syncDir(); info.rewrote++; }   // 途中に壊れた行・重なった行：きれいな束に書き直して入れかえる
      }
      if (!isLast && r.ents.length !== expectCount) throw new Error(`手前の束 ${first} が壊れている（${r.ents.length}／${expectCount} まとまり）。台帳から受け取り直す`);
      const ok = idx.length <= r.ents.length && idx.every((o, j) => o.h === r.ents[j].h);
      if (!ok || idx.length !== r.ents.length) { writeIdx(first, r.ents); idx = readIdx(first); }
      if (isLast) lastEnts = r.ents;
    }
    slimOfSeg.set(first, idx);
    for (const o of idx) { lineH.push(o.h); firstSeq.push(firstSeq[firstSeq.length - 1] + o.r.length); }
  }
  const total = lineH.length - 1; info.ms.scan = +(now() - t0).toFixed(1);

  // 写し：新しい順に、読めて・この記録の上にあり・中身の印が合う物
  t0 = now(); let snap = null;
  if (!opt.noSnapshot) for (const n of snapNs) {
    let text; try { text = fs.readFileSync(snapPath(n), 'utf8'); } catch { continue; }
    const s = readSnapshot(text); if (!s) { info.notes.push({ snapshot: n, why: 'broken' }); continue; }
    if (s.n !== n || s.n > total || lineH[s.n] !== s.h || firstSeq[s.n + 1] !== s.seq) { info.notes.push({ snapshot: n, why: 'not-on-this-journal' }); continue; }
    if (docHash(s.doc) !== s.docHash) { info.notes.push({ snapshot: n, why: 'doc-hash' }); continue; }
    snap = s; info.used = { snapshot: n }; break;
  }
  info.ms.snapshot = +(now() - t0).toFixed(1); t0 = now();
  // 索引：写しまでの細い記録を足す（本体は持たない）
  let state; const from = snap ? snap.n : 0;
  {
    let log = emptyLog(); const head = [];
    for (const first of segFirst) { if (first > from) break; for (const o of slimOfSeg.get(first)) { if (o.n > from) break; for (const r of o.r) head.push(r); } }
    if (head.length) log = appendIndexOnly(log, head, arch); else setArchive(log, arch);
    state = { doc: snap ? snap.doc : createState(init).doc, log };
  }
  info.ms.index = +(now() - t0).toFixed(1); t0 = now();
  // 続き：効果つきの記録を当てる（自分の端末の控えなので、検査なし）
  {
    const tail = [];
    for (let k = 0; k < segFirst.length; k++) {
      const first = segFirst[k]; const end = k + 1 < segFirst.length ? segFirst[k + 1] - 1 : total; if (end <= from) continue;
      const ents = k === segFirst.length - 1 && lastEnts ? lastEnts : readSeg(first, lineH[first - 1]).ents;
      for (const e of ents) if (e.n > from) tail.push(e);
    }
    info.tail = tail.length;
    if (tail.length) state = applyStoredAll(state.doc, state.log, tail, 0);
    setArchive(state.log, arch);
  }
  slimOfSeg.clear(); lastEnts = null;
  info.ms.tail = +(now() - t0).toFixed(1);
  if (!opt.keepAll) evictLog(state.log, logLength(state.log) - hot);

  // ---- 書く
  let n = total; let fd = -1; let ifd = -1; let curFirst = segFirst.length ? segFirst[segFirst.length - 1] : 0; let inSeg = segFirst.length ? total - curFirst + 1 : 0; let lastSnap = snap ? snap.n : 0; let sinceSnap = total - lastSnap;
  const openSeg = () => {
    if (fd >= 0 && inSeg < segSize) return;
    if (fd >= 0) { fs.closeSync(fd); fs.closeSync(ifd); fd = -1; if (cp('seg-closed')) die(); }
    if (curFirst && inSeg < segSize) { fd = fs.openSync(segPath(curFirst), 'a'); ifd = fs.openSync(idxPath(curFirst), 'a'); return; }   // 開き直したあと：最後の束に足す
    curFirst = n + 1; inSeg = 0; fd = fs.openSync(segPath(curFirst), 'a'); if (cp('seg-created')) die(); ifd = fs.openSync(idxPath(curFirst), 'a'); syncDir(); segFirst.push(curFirst); if (cp('seg-linked')) die();
  };
  const writeSnapshot = () => {
    const text = makeSnapshot(state, n, lineH[n]); const tmp = snapPath(n) + '.tmp'; const sfd = fs.openSync(tmp, 'w');
    try { write(sfd, text, 'snap'); sync(sfd, 'snap'); } finally { fs.closeSync(sfd); }
    fs.renameSync(tmp, snapPath(n)); if (cp('snap-renamed')) die(); syncDir();
    snapNs.unshift(n); while (snapNs.length > 2) { const old = snapNs.pop(); try { fs.unlinkSync(snapPath(old)); } catch { /* もう無い */ } }
    if (cp('snap-pruned')) die(); lastSnap = n; sinceSnap = 0; return text.length;
  };
  return {
    info, arch,
    get state() { return state; }, get n() { return n; }, get lastHash() { return lineH[n]; }, get lastSnapshot() { return lastSnap; },
    /** 命令のまとまりを当てて、通ったら保存する。戻り値は applyBatch と同じ */
    apply(cmds, ctx) {
      const r = applyBatch(state, cmds, ctx); if (r.status !== 'applied') return r;
      openSeg(); const l = journalLine(n + 1, lineH[n], ctx.sender, cmds, r.applied);
      write(fd, l.text, 'seg'); sync(fd, 'seg');
      fs.writeSync(ifd, slimLine(n + 1, l.h, r.applied)); if (cp('idx-written')) die();
      n++; inSeg++; sinceSnap++; lineH.push(l.h); firstSeq.push(firstSeq[firstSeq.length - 1] + r.applied.length); state = r.state;
      if (!opt.keepAll) evictLog(state.log, logLength(state.log) - hot);
      if (snapEvery && sinceSnap >= snapEvery) writeSnapshot();
      return r;
    },
    snapshot: writeSnapshot,
    close() { if (fd >= 0) { fs.closeSync(fd); fs.closeSync(ifd); fd = -1; } },
    /** 測り用 */
    files() { let seg = 0; let idx = 0; let snapB = 0; for (const f of fs.readdirSync(dir)) { const s = fs.statSync(path.join(dir, f)).size; if (f.startsWith('seg-')) seg += s; else if (f.startsWith('idx-')) idx += s; else if (f.startsWith('snap-')) snapB += s; } return { seg, idx, snap: snapB }; },
  };
}
