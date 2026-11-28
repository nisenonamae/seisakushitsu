#!/usr/bin/env python3
"""E5：いくつもの関節が一緒に動く動き（歩く・首を振る）を、コマごとに測る。
使い方：motion.py <関節の表.json>… [--tiles /tmp/e5/tiles]
出す物：out/<名前>.motion.json（コマごとの数字と、いちばん悪いコマ・平均）と、コマごとの色つきの影絵（--tiles の下。一覧を作る sheets.py が使う）。
測り方（1関節の物差し＝measure.py を、動きの中の関節ごとに当てる。くわしくは RESULTS.md ③）：
  関節 j について、「その関節だけ 0 度に戻した姿」（親やほかの関節は動かしたまま）を基準にして、
  すき間＝基準では体だったのに背景になった画素のうち、玉（動いたあとの付け根を中心に半径 w/2）の中の物
  はみ出し＝基準では背景だったのに体になった画素のうち、もとが重なり代（止まった絵で、ほかの部品の影絵に隠れていた所）だった物
  形＝まわり（半径 w）の中の、太さ 0.2w までの細いへこみ・とがりが、止まった絵より増えた面積（ほかの関節の動きも入る）
  中の色＝玉の中で、基準でも今も体の画素のうち、色が変わり、しかも「見えていた所が動いた」では説明できない物（隠れていた重なり代が、下の飾りの色の上に出た筋など）
  ぶつかり＝親子でない部品どうしで、止まった絵で見えていた所どうしが重なった面積（小さい方の 1% を超えたら 1 つ）。前脚どうし・後ろ脚どうしが交差するのは歩きでは自然なので、別に数える（脚の交差）
  形（全身）＝全身の影絵で、太さ 20 画素までの細いへこみ・とがりが、止まった絵より増えた面積 ÷ 体の面積
  胴の上下（歩く）は、影絵をそのままずらすだけなので、測るときは入れない（画像には入れる）"""
import argparse, json, math, os, sys
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
from measure import kern, dil, opn, sample

E5 = E4
NAT = [('前脚（手前）', '前脚（奥）'), ('後ろ脚（手前）', '後ろ脚（奥）')]
RK_ALL = 10


def poses(MO):
    """動きの表 → {動き: [(関節ごとの角度, 胴の上下)]}"""
    w = MO['walk']; out = {'歩く': [], '首': []}
    for k in range(w['frames']):
        t = k / w['frames']; p = {}
        for j, a in w['amp'].items(): p[j] = round(a * math.sin(2 * math.pi * (t - w['phase'][j])), 2)
        p['頭'] = round(w['head'] * math.sin(4 * math.pi * t), 2); p['しっぽ'] = round(w['tail'] * math.sin(2 * math.pi * t), 2)
        out['歩く'].append((p, round(w['bob'] * math.cos(4 * math.pi * t), 2)))
    for p in MO['head']['frames']: out['首'].append((dict(p), 0.0))
    return out


class Rig:
    def __init__(self, P, spec, doc, skip=('下あご',)):
        self.P = P; self.doc = doc; P.setdoc(doc)
        self.J = {j['name']: j for j in spec['joints'] if j['name'] not in skip}
        main = {j['main']: n for n, j in self.J.items()}
        self.par = {n: main.get(j['par']) for n, j in self.J.items()}
        self.kids = {n: [m for m in self.J if self.par[m] == n] for n in self.J}
        self.ids = {n: set(j['links'][0]['ids']) for n, j in self.J.items()}
        self.own = {n: sorted(self.ids[n] - set().union(*[self.ids[k] for k in self.kids[n]])) for n in self.J}
        self.allids = sorted(set().union(*self.ids.values()))
        self.piv = {n: j['links'][0]['pivot'] for n, j in self.J.items()}
        self.G0 = P.mask(**{'except': self.allids}); self.H, self.W = self.G0.shape
        self.M0 = {n: P.mask(only=self.own[n]) for n in self.J}
        self.R0 = self.G0 | np.any(list(self.M0.values()), 0); self.body = float(self.R0.sum())
        self.yy, self.xx = np.mgrid[0:self.H, 0:self.W]
        self.vis0 = {}; self.rest = {}
        for n in self.J:
            sub = self.sub(n); S0 = self.G0.copy()
            for k in self.J:
                if k not in sub: S0 |= self.M0[k]
            for k in sub: self.vis0[(n, k)] = dil(self.M0[k] & ~S0, 2)
        # 止まった絵で見えていた所（全部のほかの部品に対して）
        self.vis = {n: self.M0[n] & ~(self.G0 | np.any([self.M0[k] for k in self.J if k != n and k not in self.sub(n) and n not in self.sub(k)], 0)) for n in self.J}
        for n, j in self.J.items():
            w = j['w']; p = self.piv[n]; d2 = (self.xx + 0.5 - p[0]) ** 2 + (self.yy + 0.5 - p[1]) ** 2
            no, sp = self.thin(self.R0, p, w); self.rest[n] = dict(A_disc=float((self.R0 & (d2 <= w * w)).sum()), A_ball=float((self.R0 & (d2 <= (w / 2) ** 2)).sum()), n0=float(no.sum()), s0=float(sp.sum()))
        self.all0 = self.thin_all(self.R0)

    def sub(self, n):
        o = [n]
        for k in self.kids[n]: o += self.sub(k)
        return o

    def mats(self, pose):
        T = {}
        def go(n, Tp):
            T[n] = mul(Tp, rot(self.piv[n], pose.get(n, 0.0)))
            for k in self.kids[n]: go(k, T[n])
        for n in self.J:
            if self.par[n] is None: go(n, [1, 0, 0, 1, 0, 0])
        return T

    def box(self, p, r):
        return slice(int(max(0, p[1] - r)), int(min(self.H, p[1] + r))), slice(int(max(0, p[0] - r)), int(min(self.W, p[0] + r)))

    def thin(self, m, p, w):
        """付け根 p のまわり（半径 w）の中の、細いへこみ・とがり（太さ 0.2w まで）。全体の大きさの絵で返す"""
        rk = max(2, int(round(0.1 * w))); sl = self.box(p, w + 2 * rk + 4); c = m[sl]; u = c.astype(np.uint8)
        u = np.pad(u, rk + 2); cc = u > 0
        no = (cv2.morphologyEx(u, cv2.MORPH_CLOSE, kern(rk)) > 0) & ~cc; sp = cc & ~(cv2.morphologyEx(u, cv2.MORPH_OPEN, kern(rk)) > 0)
        d2 = (self.xx[sl] + 0.5 - p[0]) ** 2 + (self.yy[sl] + 0.5 - p[1]) ** 2 <= w * w
        N = np.zeros((self.H, self.W), bool); S = np.zeros((self.H, self.W), bool)
        N[sl] = no[rk + 2:-rk - 2, rk + 2:-rk - 2] & d2; S[sl] = sp[rk + 2:-rk - 2, rk + 2:-rk - 2] & d2
        return N, S

    def thin_all(self, m):
        rk = RK_ALL; u = np.pad(m.astype(np.uint8), rk + 2); cc = u > 0
        no = (cv2.morphologyEx(u, cv2.MORPH_CLOSE, kern(rk)) > 0) & ~cc; sp = cc & ~(cv2.morphologyEx(u, cv2.MORPH_OPEN, kern(rk)) > 0)
        return float(no.sum()), float(sp.sum())

    def xf(self, T):
        return [{'ids': self.own[n], 'M': T[n]} for n in self.J]

    def color(self, T, bob=0.0, scale=1):
        x = self.xf(T)
        if bob:
            B = [1, 0, 0, 1, 0, bob]; x = [{'ids': t['ids'], 'M': mul(B, t['M'])} for t in x]
            rest = [n['id'] for n in self.doc['nodes'] if n.get('geo') and n['id'] not in self.allids and not ('地面の影' in (n.get('name') or '') or str(n.get('fill')).lower() == '#bcd3a2')]
            x.append({'ids': rest, 'M': B})
        return self.P.render(dict(mode='final', xf=x, scale=scale))

    def silimg(self, T, bob=0.0):
        x = self.xf(T)
        if bob:
            B = [1, 0, 0, 1, 0, bob]; x = [{'ids': t['ids'], 'M': mul(B, t['M'])} for t in x]
            x.append({'ids': [n['id'] for n in self.doc['nodes'] if n.get('geo') and n['id'] not in self.allids], 'M': B})
        return self.P.render(dict(mode='sil', xf=x))

    def frame(self, pose, tile=None):
        P = self.P; T = self.mats(pose); tol = 2
        G = {n: P.mask(only=self.own[n], xf=[{'ids': self.own[n], 'M': T[n]}]) for n in self.J}
        F = self.G0 | np.any(list(G.values()), 0)
        Fc = np.asarray(self.color(T)).astype(np.int16)
        res = {}; gapA = np.zeros_like(F); pokeA = np.zeros_like(F); noA = np.zeros_like(F); spA = np.zeros_like(F); inA = np.zeros_like(F)
        for n, j in self.J.items():
            w = j['w']; r0 = self.rest[n]; sub = self.sub(n)
            pp = apply(T[self.par[n]], self.piv[n]) if self.par[n] else self.piv[n]
            no1, sp1 = self.thin(F, pp, w)
            r = dict(deg=pose.get(n, 0.0), gap=0.0, poke=0.0, inner=0.0, notch=max(0.0, float(no1.sum()) - r0['n0']) / r0['A_disc'], spur=max(0.0, float(sp1.sum()) - r0['s0']) / r0['A_disc'])
            r['shape'] = r['notch'] + r['spur']; noA |= no1; spA |= sp1
            if abs(pose.get(n, 0.0)) > 1e-6:
                p2 = dict(pose); p2[n] = 0.0; T2 = self.mats(p2)
                S = self.G0.copy()
                for k in self.J:
                    if k not in sub: S |= G[k]
                Mref = np.any([P.mask(only=self.own[k], xf=[{'ids': self.own[k], 'M': T2[k]}]) for k in sub], 0)
                R = S | Mref; lost = R & ~F; gain = F & ~R
                d2 = (self.xx + 0.5 - pp[0]) ** 2 + (self.yy + 0.5 - pp[1]) ** 2; ball = d2 <= (w / 2) ** 2; disc = d2 <= w * w
                visP = np.any([sample(self.vis0[(n, k)], inv(T[k]), 1, self.xx, self.yy) for k in sub], 0)
                visR = np.any([sample(self.vis0[(n, k)], inv(T2[k]), 1, self.xx, self.yy) for k in sub], 0)
                gapD = opn(lost & ball, tol); pokeD = opn(gain & ~visP, tol) & disc
                Rc = np.asarray(P.render(dict(mode='final', xf=self.xf(T2)))).astype(np.int16)
                inn = opn((np.abs(Fc - Rc).max(2) > 24) & ball & F & R & ~visP & ~visR, tol)
                r.update(gap=float(gapD.sum()) / r0['A_disc'], poke=float(pokeD.sum()) / r0['A_disc'], inner=float(inn.sum()) / max(1.0, r0['A_ball']))
                gapA |= gapD; pokeA |= pokeD; inA |= inn
            r['D'] = r['gap'] + r['poke']; res[n] = r
        # ぶつかり
        vp = {n: sample(self.vis[n], inv(T[n]), 1, self.xx, self.yy) for n in self.J}; bumps = []; cross = 0.0
        names = list(self.J)
        for a in range(len(names)):
            for b in range(a + 1, len(names)):
                k, l = names[a], names[b]
                if k in self.sub(l) or l in self.sub(k): continue
                ov = float((vp[k] & vp[l]).sum())
                if ov <= 0: continue
                sm = min(float(self.vis[k].sum()), float(self.vis[l].sum())) or 1.0
                if (k, l) in NAT or (l, k) in NAT: cross += ov / self.body
                elif ov / sm > 0.01: bumps.append([k, l, round(100 * ov / sm, 1)])
        na, sa = self.thin_all(F)
        vals = list(res.values())
        fr = dict(pose=pose, joints=res, gap=float(np.mean([v['gap'] for v in vals])), poke=float(np.mean([v['poke'] for v in vals])), shape=float(np.mean([v['shape'] for v in vals])), inner=float(np.mean([v['inner'] for v in vals])),
                  D_max=max(v['D'] for v in vals), shape_max=max(v['shape'] for v in vals), inner_max=max(v['inner'] for v in vals),
                  worst_joint=max(res, key=lambda n: res[n]['D'] + res[n]['shape']),
                  gap_px=int(gapA.sum()), poke_px=int(pokeA.sum()), shape_all=(max(0.0, na - self.all0[0]) + max(0.0, sa - self.all0[1])) / self.body,
                  iou=iou(F, self.R0), bumps=bumps, cross=cross)
        fr['bad'] = fr['gap'] + fr['poke'] + fr['shape']
        if tile:
            im = np.full((self.H, self.W, 3), 255, np.uint8); im[F] = (200, 200, 204); im[self.G0] = (216, 216, 216)
            im[noA & ~F] = (255, 225, 60); im[spA & F] = (120, 60, 200); im[inA] = (40, 170, 220); im[dil(gapA, 2)] = (235, 25, 25); im[dil(pokeA, 2)] = (255, 135, 0)
            Image.fromarray(im).save(tile)
        return fr


def summarize(frs):
    keys = ['gap', 'poke', 'shape', 'inner', 'D_max', 'shape_max', 'inner_max', 'shape_all', 'bad']
    worst = max(range(len(frs)), key=lambda i: frs[i]['bad'])
    return dict(mean={k: float(np.mean([f[k] for f in frs])) for k in keys}, worst_frame=worst, worst={k: frs[worst][k] for k in keys}, worst_joint=frs[worst]['worst_joint'],
                max={k: max(f[k] for f in frs) for k in keys}, iou_min=min(f['iou'] for f in frs), bumps=sum(len(f['bumps']) for f in frs), bump_list=[[i] + b for i, f in enumerate(frs) for b in f['bumps']], cross_max=max(f['cross'] for f in frs))


def run(spec_path, tiles):
    spec = load(spec_path); name = os.path.basename(spec_path).replace('.joints.json', '')
    doc = load(os.path.join(os.path.dirname(os.path.abspath(spec_path)), spec['doc'])); MO = load(os.path.join(E5, 'motions.json')); out = dict(title=spec.get('title'), motions={})
    with Page() as P:
        R = Rig(P, spec, doc)
        for mo, frames in poses(MO).items():
            frs = []
            for i, (pose, bob) in enumerate(frames):
                pose = {k: v for k, v in pose.items() if k in R.J}; t = None
                if tiles: os.makedirs(os.path.join(tiles, name), exist_ok=True); t = os.path.join(tiles, name, '%s_%02d.png' % (mo, i))
                frs.append(R.frame(pose, t)); frs[-1]['bob'] = bob
            out['motions'][mo] = dict(frames=frs, summary=summarize(frs)); s = out['motions'][mo]['summary']
            print(name, mo, '平均 す%.2f は%.2f 形%.2f 中%.2f 全身形%.3f｜悪いコマ %d（%s）す＋は最大 %.2f 形最大 %.2f｜ぶつかり %d 交差最大 %.2f%%' % (100 * s['mean']['gap'], 100 * s['mean']['poke'], 100 * s['mean']['shape'], 100 * s['mean']['inner'], 100 * s['mean']['shape_all'], s['worst_frame'], s['worst_joint'], 100 * s['max']['D_max'], 100 * s['max']['shape_max'], s['bumps'], 100 * s['cross_max']), flush=True)
    save(os.path.join(E5, 'out', name + '.motion.json'), out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('specs', nargs='+'); ap.add_argument('--tiles', default='/tmp/e5/tiles')
    a = ap.parse_args()
    for s in a.specs: run(s, a.tiles)
