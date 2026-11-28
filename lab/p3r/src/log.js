// 記録（足すだけ）。状態は { store, n }＝「この入れ物の、頭から n 個」を見ている、という形で持つ。
// 古い状態から枝分かれして足すときは、入れ物を写してから足す（古い状態から見える物は変わらない）。
//
// P3r で足した物（どれも「記録から計算できる索引」。保存しなくても、記録を頭から足し直せば同じ物になる）：
//  ・取り消しの鎖（どの効果が、いま生きているか）
//  ・値の道ごとの「起点（最後の置きかえ・足した時）」と「足した量・掛けた量の並び」＝組み立て直しの材料
//  ・部品を最初に足した記録／引き取りの記録
//  ・端末ごとの、取り消せる物・やり直せる物の積み重ね
//  ・写しから始めた記録（頭の base 件を持っていない）。古い記録が要る時は、断る（needs-history）→ 呼ぶ側が古い記録を読み足す
//
// 追加の検証（BRIEF2）で変えた物：
//  ・効果ごとの通し番号（eid）と、番地ごとの索引（その番地の効果の並び・生きている効果の数）。
//    → 取り消しの判定（「その後に起きたこと」）を、部品に触れた記録の全部からでなく、その番地の索引から読む
//  ・足した量・掛けた量を、道ごとに数の並びで持つ（記録の本体を読まずに組み立て直せる）
//  ・途中の値の控えを、並びの終わりまで持つ（今の値の確かめに使う。生き死にが変わった所から後ろだけ作り直す）
//  ・記録の本体（効果つき）を、メモリに持たなくてもよい：古い記録は「置き場」（arch）から、要る時に取りに行く。
//    索引は「細い記録」（slimOf。値の中身を抜いた物）だけから作り直せる
// どれも、記録の中身・取り消しの答えを変えない（src0＝前回の核と、突き合わせる。test/same.test.js）。
import { targetOf, addrOf, toGrid } from './model.js';
import { akey } from './util.js';

/** 伸びる数の並び（効果の数だけある物は、型つきの並びで持つ） */
class Grow {
  constructor(T, cap = 1024) { this.T = T; this.a = new T(cap); this.n = 0; }
  push(x) { if (this.n === this.a.length) { const b = new this.T(this.n * 2); b.set(this.a); this.a = b; } this.a[this.n++] = x; }
}
/** 番地1つ分の索引 */
class Path {
  constructor(key, parent) {
    this.key = key; this.parent = parent; this.kids = null;      // 下の番地（「その下に起きたこと」を集める時にたどる）
    this.eids = [];                                              // この番地の効果の通し番号（古い順）
    this.cnt = [0, 0, 0, 0, 0];                                  // 生きている効果の数：[ほか, 置きかえ, 種類の置きかえ, 足す, 掛ける]
    this.anc = -1;                                               // 起点（いちばん新しい 置きかえ・足した・外した 効果の通し番号）
    this.opE = null; this.opA = null; this.opM = null;           // 足した量・掛けた量の並び：通し番号／量（格子の番号を2つずつ）／1＝掛ける・0＝足す
    this.cache = null;                                           // 途中の値の控え
  }
}
export const K_OTHER = 0; export const K_SET = 1; export const K_KIND = 2; export const K_DELTA = 3; export const K_MUL = 4;
const kindOf = (e) => (e.k === 'set' ? (e.kind ? K_KIND : K_SET) : e.k === 'delta' ? K_DELTA : e.k === 'mul' ? K_MUL : K_OTHER);

class Store {
  /** @param {number} base 持っていない頭の件数（写しから始めた時）@param {any} baseRevs 写しの時点の版 */
  constructor(base = 0, baseRevs = null, baseDoc = null, baseLed = null) {
    this.base = base; this.baseRevs = baseRevs; this.baseDoc = baseDoc; this.baseLed = baseLed;   // baseLed＝写しの時点の「だれの物か」の控え
    this.items = []; if (base) this.items.length = base;
    this.arch = null;                                            // 古い記録の置き場（{ get(i) }）。無ければ、全部 items に持つ
    this.byId = new Map(); this.byTarget = new Map(); this.reverts = [];
    // 取り消しの鎖
    this.spent = new Set(); this.rootOf = new Map(); this.count = new Map(); this.lastOf = new Map();
    // 効果ごと：記録の位置・種類・生きているか・番地の番号。記録ごと：最初の効果の通し番号
    this.recOff = new Grow(Int32Array); this.eRec = new Grow(Int32Array); this.eKind = new Grow(Uint8Array); this.vis = new Grow(Uint8Array); this.ePath = new Grow(Int32Array);
    this.paths = new Map(); this.pathList = [];
    // だれの物か：部品 → 最初に足した記録の位置／部品 → 引き取りの記録の位置（古い順）／その記録の、主体を読むのに要る所だけ
    this.created = new Map(); this.adopts = new Map(); this.meta = new Map();
    // 端末ごとの、取り消し・やり直しの積み重ね
    this.stacks = new Map();
  }
  /** 記録の本体（効果つき）。メモリに無ければ、置き場から取りに行く */
  rec(i) { const a = this.items[i]; if (a !== undefined) return a; return this.arch && i >= this.base && i < this.items.length ? this.arch.get(i) : undefined; }
  pathFor(addr) {
    const key = akey(addr); let p = this.paths.get(key); if (p) return p;
    const par = addr.length > 1 ? this.pathFor(addr.slice(0, -1)) : null;
    p = new Path(key, par); p.idx = this.pathList.length; this.pathList.push(p); this.paths.set(key, p); if (par) (par.kids || (par.kids = [])).push(p); return p;
  }
  setVis(eid, v) { v = v ? 1 : 0; if (this.vis.a[eid] === v) return; this.vis.a[eid] = v; this.pathList[this.ePath.a[eid]].cnt[this.eKind.a[eid]] += v ? 1 : -1; }
  /** 効果の鍵（命令の id#番号）→ 通し番号。その記録を持っていなければ -1 */
  eidOf(key) { const h = key.lastIndexOf('#'); const ri = this.byId.get(key.slice(0, h)); return ri === undefined ? -1 : this.recOff.a[ri - this.base] + Number(key.slice(h + 1)); }
  /** @param {any} a 記録（効果つき）か、細い記録（slimOf）@param {boolean} keep 本体をメモリに持つか */
  push(a, keep = true) {
    const i = this.items.length; this.items.push(keep ? a : undefined); this.byId.set(a.cmd.id, i);
    const isRevert = a.cmd.body.type === 'revert'; if (isRevert) this.reverts.push(i);
    const seen = new Set(); this.recOff.push(this.eRec.n);
    for (let q = 0; q < a.effects.length; q++) {
      const e = a.effects[q]; const t = targetOf(e); const eid = this.eRec.n; const kind = kindOf(e); const p = this.pathFor(addrOf(e));
      this.eRec.push(i); this.eKind.push(kind); this.vis.push(1); this.ePath.push(p.idx); p.eids.push(eid); p.cnt[kind]++;
      if (!seen.has(t)) { seen.add(t); let l = this.byTarget.get(t); if (!l) this.byTarget.set(t, (l = [])); l.push(i); }
      if (e.k === 'set' || e.k === 'insert' || e.k === 'remove') {
        p.anc = eid;
        if (e.k === 'insert' && e.at.length === 1 && e.at[0] === 'node' && !this.created.has(e.id)) { this.created.set(e.id, i); this.meta.set(i, metaOf(a)); }
      } else if ((e.k === 'delta' || e.k === 'mul') && !isRevert) {
        if (!p.opE) { p.opE = []; p.opA = []; p.opM = []; }
        const q2 = e.k === 'mul' ? e.f : e.d; p.opE.push(eid); p.opA.push(toGrid(q2[0]), q2.length > 1 ? toGrid(q2[1]) : NaN); p.opM.push(e.k === 'mul' ? 1 : 0);
      } else if (e.k === 'own' && !isRevert) { let l = this.adopts.get(e.node); if (!l) this.adopts.set(e.node, (l = [])); l.push(i); this.meta.set(i, metaOf(a)); }
    }
    if (isRevert) for (const o of a.outcomes || []) {
      if (o.result !== 'reverted') continue; this.spent.add(o.key);
      if (o.forced || !o.fx || o.fx[1] !== 1) continue;                    // 人の直しごと外した物などは、打ち消しに数えない
      const root = this.rootOf.get(o.key) || o.key; const mine = `${a.cmd.id}#${o.fx[0]}`;
      this.rootOf.set(mine, root); const c = (this.count.get(root) || 1) + 1; this.count.set(root, c); this.lastOf.set(root, { idx: i, i: o.fx[0] });
      this.setVis(this.recOff.a[i - this.base] + o.fx[0], 0);              // 取り消しの効果そのものは「その後に起きたこと」に数えない
      const re = this.eidOf(root);
      if (re >= 0) {
        this.setVis(re, c % 2 === 1);
        const p = this.pathList[this.ePath.a[re]]; const c2 = p.cache;      // 生き死にが変わった操作より後ろの控えは、使えない
        if (c2 && p.opE) { const j = lowerEid(p.opE, re); if (j < p.opE.length && p.opE[j] === re && j - c2.lo < c2.valid) c2.valid = Math.max(0, j - c2.lo); }
      }
    }
    if (a.sender && a.sender.k === 'human') {
      let s = this.stacks.get(a.sender.device); if (!s) this.stacks.set(a.sender.device, (s = { undo: [], redo: [], batch: -1, cur: null }));
      if (s.batch === a.batch && s.cur) s.cur.push(a.cmd.id);
      else {
        s.batch = a.batch; s.cur = [a.cmd.id]; const mode = isRevert ? a.cmd.body.mode : undefined;
        if (mode === 'undo') { s.undo.pop(); s.redo.push(s.cur); }
        else if (mode === 'redo') { s.redo.pop(); s.undo.push(s.cur); }    // やり直した結果（revert の記録）が、次に取り消す相手になる
        else { s.undo.push(s.cur); s.redo.length = 0; }
      }
    }
  }
  /** 効果の鍵 → その値の道の並びの中の位置 { P, j }。足した量・掛けた量でなければ null */
  opPos(key) {
    const eid = this.eidOf(key); if (eid < 0 || eid >= this.eRec.n) return null; const P = this.pathList[this.ePath.a[eid]]; if (!P.opE) return null;
    const j = lowerEid(P.opE, eid); return j < P.opE.length && P.opE[j] === eid ? { P, key: P.key, j } : null;
  }
  /** メモリから、古い記録の本体を下ろす（置き場がある時だけ）。索引は残る */
  evict(upTo) { if (!this.arch) return 0; let k = 0; const from = this.evicted || this.base; for (let i = from; i < upTo && i < this.items.length; i++) if (this.items[i] !== undefined) { this.items[i] = undefined; k++; } this.evicted = Math.max(from, Math.min(upTo, this.items.length)); return k; }
}
function lowerEid(l, x) { let lo = 0; let hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (l[m] < x) lo = m + 1; else hi = m; } return lo; }
/** 部品を足した・引き取った記録の、主体を読むのに要る所だけ（本体をメモリに持たない時のため）*/
const metaOf = (a) => { const cmd = { id: a.cmd.id }; if (a.cmd.actor !== undefined) cmd.actor = a.cmd.actor; if (a.cmd.proposal !== undefined) cmd.proposal = a.cmd.proposal; return { cmd, sender: a.sender, seq: a.seq }; };

/**
 * 細い記録：索引を作るのに要る所だけ（値の中身＝足した部品・前の値・あとの値を抜く）。記録の本体の代わりに push に渡せる。
 * 部品を足した・引き取った記録だけ、主体（actor・proposal・seq）も持つ。
 */
export function slimOf(a) {
  const body = { type: a.cmd.body.type }; if (a.cmd.body.mode !== undefined) body.mode = a.cmd.body.mode;
  const cmd = { id: a.cmd.id, body }; let who = false;
  const effects = a.effects.map((e) => {
    const o = { k: e.k }; if (e.at !== undefined) o.at = e.at; if (e.id !== undefined) o.id = e.id; if (e.node !== undefined) o.node = e.node; if (e.kind) o.kind = true;
    if (e.k === 'delta') o.d = e.d; else if (e.k === 'mul') o.f = e.f;
    if (e.k === 'own' || (e.k === 'insert' && e.at.length === 1 && e.at[0] === 'node')) who = true; return o;
  });
  const s = { cmd, batch: a.batch, sender: a.sender, effects };
  if (who) { s.seq = a.seq; if (a.cmd.actor !== undefined) cmd.actor = a.cmd.actor; if (a.cmd.proposal !== undefined) cmd.proposal = a.cmd.proposal; }
  if (body.type === 'revert') { const outs = []; for (const o of a.outcomes || []) if (o.result === 'reverted') { const x = { result: 'reverted', key: o.key }; if (o.forced) x.forced = o.forced; if (o.fx) x.fx = o.fx; outs.push(x); } s.outcomes = outs; }
  return s;
}

export const emptyLog = (base = 0, baseRevs = null, baseDoc = null, baseLed = null) => ({ store: new Store(base, baseRevs, baseDoc, baseLed), n: base });
function fork(log) { const f = new Store(log.store.base, log.store.baseRevs, log.store.baseDoc, log.store.baseLed); for (let i = log.store.base; i < log.n; i++) f.push(log.store.rec(i)); return f; }
export function appendLog(log, applieds) {
  let st = log.store;
  if (st.items.length !== log.n) st = fork(log);
  for (const a of applieds) st.push(a);
  return { store: st, n: log.n + applieds.length };
}
/** 索引だけを足す（本体は持たない。あとで置き場から取りに行く）。slims＝細い記録（か、記録の本体）*/
export function appendIndexOnly(log, slims, arch) {
  let st = log.store; if (st.items.length !== log.n) st = fork(log);
  if (arch) st.arch = arch; if (!st.arch) throw new Error('置き場が無いのに、本体を持たない記録は足せない');
  for (const a of slims) st.push(a, false);
  return { store: st, n: log.n + slims.length };
}
/** 置き場を付ける・古い本体を下ろす（upTo より前）。下ろした件数 */
export function setArchive(log, arch) { log.store.arch = arch; return log; }
export function evictLog(log, upTo) { return log.store.evict(upTo); }
/** 索引を読むための入れ物。古い状態（n が入れ物より短い）からは、その時点までの索引を作り直して使う */
const views = new WeakMap();
export function view(log) {
  if (log.store.items.length === log.n) return log.store;
  let v = views.get(log); if (!v) views.set(log, (v = fork(log))); return v;
}
export const logLength = (log) => log.n;
/** 持っていない頭の件数（写しから始めた時だけ 0 より大きい） */
export const logBase = (log) => log.store.base;
export const logBaseRevs = (log) => log.store.baseRevs;
export const logBaseLed = (log) => log.store.baseLed;
export const logAt = (log, i) => (i >= log.store.base && i < log.n ? log.store.rec(i) : undefined);
/** 部品を足した・引き取った記録の主体（{cmd:{id,actor,proposal}, sender, seq}）。本体を読まない */
export const logMeta = (log, i) => (i >= log.store.base && i < log.n ? log.store.meta.get(i) || log.store.rec(i) : undefined);
/** 記録の写し（配列）。持っている分だけ */
export const logItems = (log) => { const out = []; for (let i = log.store.base; i < log.n; i++) out.push(log.store.rec(i)); return out; };
/** 命令の id から、記録の中の位置。無ければ -1 */
export function logIndexOf(log, cmdId) { const i = log.store.byId.get(cmdId); return i !== undefined && i < log.n ? i : -1; }
function lower(l, x) { let lo = 0; let hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (l[m] <= x) lo = m + 1; else hi = m; } return lo; }
/** その「物」に触れた記録の位置（古い順）。from より後ろだけ */
export function logTouching(log, target, from = -1) {
  const l = log.store.byTarget.get(target); if (!l) return [];
  const out = []; for (let j = lower(l, from); j < l.length; j++) { if (l[j] >= log.n) break; out.push(l[j]); } return out;
}
/** その「物」に触れた記録のうち、k 番め（0 から）より後ろの位置。版は、触れた記録1件ごとに 1 進むので、「版 b より後の記録」をじかに引ける */
export function logTouchingFromCount(log, target, k) {
  const l = log.store.byTarget.get(target); if (!l) return [];
  const out = []; for (let j = Math.max(0, k); j < l.length; j++) { if (l[j] >= log.n) break; out.push(l[j]); } return out;
}
/** 取り消し（revert）の記録の位置（古い順） */
export function logReverts(log) { const out = []; for (const i of log.store.reverts) if (i < log.n) out.push(i); return out; }

/**
 * 取り消しの鎖。「効果 x を、あとの取り消し y がきれいに戻した（y をさらに z が戻した…）」とき、
 *  ・x と y は打ち消し合っている（鎖の長さが偶数）＝その所には、だれの直しも残っていない → 「その後に起きたこと」に数えない
 *  ・やり直し（z）で鎖が奇数になったら、x が生きている。いま文書に効いているのは鎖の最後の効果
 * 記録が1件足されるたびに足していく（取り消しのたびに記録を頭から数え直さない）。
 */
export function chainsOf(log) {
  const s = view(log);
  return { spent: s.spent, lastOf: s.lastOf, root: (key) => s.rootOf.get(key) || key, parity: (key) => (s.count.get(key) || 1) % 2,
    /** 「その後に起きたこと」として数える効果か（＝取り消しの効果でなく、いま生きている） */
    visible: (key) => !s.rootOf.has(key) && (s.count.get(key) || 1) % 2 === 1 };
}
/**
 * 組み立て直しの材料：番地の「起点」（いちばん新しい置きかえ・足した・外した効果）と、そのあとの足した量・掛けた量。
 * @returns {{key:string, anchor:[number,number]|null, aE:number, P:any, lo:number, n:number, store:any}} P＝その番地の索引（opE・opA・opM）。lo 番めから n 個が、起点のあとの操作
 */
export function pathOps(log, addr) {
  const s = view(log); let aE = -1;
  for (let n = 1; n <= addr.length; n++) { const p = s.paths.get(akey(addr.slice(0, n))); if (p && p.anc > aE) aE = p.anc; }
  const key = akey(addr); const P = s.paths.get(key) || null; const l = P && P.opE ? P.opE : [];
  const lo = aE < 0 ? 0 : lowerEid(l, aE + 1);
  const ai = aE < 0 ? -1 : s.eRec.a[aE];
  return { key, anchor: aE < 0 ? null : [ai, aE - s.recOff.a[ai - s.base]], aE, P, lo, n: l.length - lo, store: s };
}
/**
 * 「その後に起きたこと」を、番地の索引から数える（足す量・掛ける量の取り消しの判定に使う）。
 * addr と同じ番地・上の番地にある、from より後ろの・生きている・戻す相手でない効果に、置きかえ／種類の置きかえ／足す／掛ける が有るか。
 * 生きている効果の数（cnt）が 0 の種類は、並びを見ない。
 */
export function nearFlags(log, addr, from, set) {
  const s = view(log); const f = [false, false, false, false, false]; const eRec = s.eRec.a; const eKind = s.eKind.a; const vis = s.vis.a;
  for (let n = 1; n <= addr.length; n++) {
    const p = s.paths.get(akey(addr.slice(0, n))); if (!p) continue;
    let need = 0; for (let k = 1; k <= 4; k++) if (p.cnt[k] > 0 && !f[k]) need++;
    if (!need) continue;
    const l = p.eids; let lo = 0; let hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (eRec[l[m]] <= from) lo = m + 1; else hi = m; }
    for (let j = lo; j < l.length && need > 0; j++) { const e = l[j]; if (!vis[e]) continue; const k = eKind[e]; if (k === 0 || f[k] || set.has(eRec[e])) continue; f[k] = true; if (p.cnt[k] > 0) need--; }
  }
  return f;
}
/**
 * 「その後に起きたこと」の一覧を、番地の索引から集める：addr と同じ・上・下の番地の、from より後ろの・生きている・戻す相手でない効果（古い順）。
 * @returns {{i:number, q:number}[]} 記録の位置と、効果の番号
 */
export function relatedAfter(log, addr, from, set) {
  const s = view(log); const eRec = s.eRec.a; const vis = s.vis.a; const out = [];
  const take = (p) => { const l = p.eids; let lo = 0; let hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (eRec[l[m]] <= from) lo = m + 1; else hi = m; } for (let j = lo; j < l.length; j++) { const e = l[j]; if (vis[e] && !set.has(eRec[e])) out.push(e); } };
  for (let n = 1; n < addr.length; n++) { const p = s.paths.get(akey(addr.slice(0, n))); if (p) take(p); }
  const top = s.paths.get(akey(addr)); if (top) { const stack = [top]; while (stack.length) { const p = stack.pop(); take(p); if (p.kids) for (const k of p.kids) stack.push(k); } }
  out.sort((a, b) => a - b);
  return out.map((e) => { const i = eRec[e]; return { i, q: e - s.recOff.a[i - s.base] }; });
}
/** 部品を最初に足した記録の位置（無ければ -1） */
export function createdAt(log, node) { const i = view(log).created.get(node); return i === undefined ? -1 : i; }
/** 部品の、いま生きている引き取りの記録の位置（いちばん新しい物。無ければ -1） */
export function adoptedAt(log, node) {
  const s = view(log); const l = s.adopts.get(node); if (!l) return -1;
  for (let j = l.length - 1; j >= 0; j--) { const key = `${s.meta.get(l[j]).cmd.id}#0`; if ((s.count.get(key) || 1) % 2 === 1) return l[j]; }
  return -1;
}
/** 端末ごとの積み重ね（読むだけ） */
export function stacksOf(log, device) { const s = view(log).stacks.get(device); return s ? { undo: s.undo, redo: s.redo } : { undo: [], redo: [] }; }
/** 索引の大きさの目安（測り用） */
export function indexStats(log) { const s = log.store; return { records: s.items.length - s.base, effects: s.eRec.n, paths: s.pathList.length, inMemory: s.items.reduce((a, x) => a + (x !== undefined ? 1 : 0), 0) }; }
