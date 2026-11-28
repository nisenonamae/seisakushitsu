// 送る前の箱（追加の検証 BRIEF2 の 4）。取り消し・やり直しの連打を、**まだ送っていない分に限って**、端末の中で畳んでから送る。
//  ・畳むのは「直前の、まだ送っていないまとまりが 取り消し（か、やり直し）で、次のまとまりが、ちょうどそれを戻す やり直し（か、取り消し）」の組だけ。
//    両方とも、効果が全部きれいに戻った（聞く・残すが無い）時だけ。組は、箱から取りのぞく（＝送らない。記録に入らない）。
//  ・もう送った物（台帳に入った物）は、畳まない。記録を消す・書きかえることは、しない。
//  ・手元の文書は「確かめ済みの状態＋まだ送っていない分」を当て直した物。畳んだあとは、版の数字が、畳まなかった場合より小さい（中身は同じ）。
//    ほかの端末は、畳んだあとの並びしか見ないので、端末どうしは食い違わない。
import { applyBatch } from './engine.js';

const kindOf = (cmds) => (cmds.length === 1 && cmds[0].body.type === 'revert' && (cmds[0].body.mode === 'undo' || cmds[0].body.mode === 'redo') ? cmds[0].body.mode : 'do');
const clean = (r) => (r.outcomes || []).every((o) => o.result === 'reverted' && !o.forced);
/** @param {any} confirmed 確かめ済みの状態（台帳に入った所まで）*/
export function makeOutbox(confirmed) {
  let base = confirmed; let local = confirmed; let pending = []; const stats = { pushed: 0, collapsedPairs: 0, sent: 0 };
  const replay = () => { local = base; for (const b of pending) { const r = applyBatch(local, b.cmds, b.ctx); if (r.status !== 'applied') throw new Error('送る前の箱：当て直しで断られた ' + r.message); local = r.state; b.clean = clean(r); } };
  return {
    get local() { return local; }, get base() { return base; }, get pending() { return pending.length; }, stats,
    /** 手元に当てる。畳めたら { status:'collapsed' } */
    push(cmds, ctx) {
      const r = applyBatch(local, cmds, ctx); if (r.status !== 'applied') return r; stats.pushed++;
      const k = kindOf(cmds); const last = pending[pending.length - 1];
      if (k !== 'do' && last && last.kind !== 'do' && last.kind !== k && last.clean && clean(r) && last.ctx.sender.k === 'human' && ctx.sender.k === 'human' && last.ctx.sender.device === ctx.sender.device) {
        const t = cmds[0].body.targets; const ids = last.cmds.map((c) => c.id);
        if (t.length === ids.length && t.every((x) => ids.includes(x))) { pending.pop(); replay(); stats.collapsedPairs++; return { status: 'collapsed', state: local, dropped: [...ids, cmds[0].id] }; }
      }
      pending.push({ cmds, ctx, kind: k, clean: clean(r) }); local = r.state; return r;
    },
    /** 送る：まだ送っていない分を返して、確かめ済みにする（台帳が、この順で受け取ったことにする）*/
    flush() { const out = pending; pending = []; base = local; stats.sent += out.length; return out.map((b) => ({ cmds: b.cmds, sender: b.ctx.sender })); },
  };
}
