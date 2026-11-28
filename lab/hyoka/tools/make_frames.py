#!/usr/bin/env python3
"""lab/hyoka：見せる絵（止まった絵・影絵・動きのコマ）を、あらかじめ画像にして img/ に置く。data.js（版と画像の対応）も作る。
使い方：python3 tools/make_frames.py            （全部）
        python3 tools/make_frames.py --probe    （大きさと場所だけ調べる）
描き方：lab/p4/geom.js の写し（vendor/geom.js）を、裏のブラウザ（playwright の Chromium）で動かす（tools/e4lib.py・page.js＝lab/e5/tools の写し）。
動き：付け根で部品を回す。poses()・mats() は lab/e5/tools/motion.py の同じ名前の関数を写した物（測る所は写していない）。
  歩く＝motions.json の式（正弦）を、1歩 10 コマ → WALK_N コマで取り直す（式が同じなので、コマのあいだを補うのと同じ）
  首を振る＝motions.json の 6 コマを、輪にした Catmull-Rom（一様）で 1 コマのあいだを HEAD_SUB に分ける。回してよい幅（range）からはみ出したら、幅の端で止める
大きさと場所：そろえ直さない。どの版も 1600×900 の同じ枠の中に、元のデータのまま描く（調べたら、止まった絵の影絵の広さは 46.6万〜47.6万 画素で、
  差は 1.3% まで・足もとは y=770〜772 だった。値は manifest.js の measured）。同じ CROP で切り出して、幅をそろえる。"""
import argparse, hashlib, json, math, os, random, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *

HY = E4; SRC = os.path.join(HY, 'src'); IMG = os.path.join(HY, 'img')
CROP = (160, 150, 1440, 870)            # 1280×720（16:9）
OUT_W, OUT_H = 1280, 720                # 動きのコマ
BIG_W, BIG_H = 1600, 900                # 止まった絵・影絵（拡大して見る用。CROP を 1.25 倍で描く）
WALK_N = 24; HEAD_SUB = 6               # 首：6 × 6 = 36 コマ
Q_FRAME = 84; Q_BIG = 90
SEED_CODES = 20261129

# 版の表。key＝道具の中の名前（画面には出さない）
VERS = [
 dict(key='P4_AI', set='P4', label='P4 の AI のみ', doc='e5/P4.json', joints='e5/P4.joints.json', motions=['walk', 'head']),
 dict(key='E5_A', set='E5', label='E5 の A 通常', doc='e5/A.json', joints='e5/A.joints.json', motions=['walk', 'head']),
 dict(key='E5_D', set='E5', label='E5 の D 関節の丸み', doc='e5/D.json', joints='e5/D.joints.json', motions=['walk', 'head']),
 dict(key='E5_E', set='E5', label='E5 の E 組み合わせ', doc='e5/E.json', joints='e5/E.joints.json', motions=['walk', 'head']),
 dict(key='E5_F', set='E5', label='E5 の F 脚のすき間なし', doc='e5/F.json', joints='e5/F.joints.json', motions=['walk', 'head']),
 dict(key='E6_L2', set='E6', label='E6 の基準（L2）', doc='e6/L2.json', joints=None, motions=['walk']),
 dict(key='E6_eye2', set='E6', label='E6 目を 2 倍', doc='e6/B4目大_2.json', joints=None, motions=[]),
 dict(key='E6_head121', set='E6', label='E6 頭を 1.21 倍', doc='e6/B1頭大_2.json', joints=None, motions=[]),
 dict(key='E6_head152', set='E6', label='E6 頭を 1.52 倍', doc='e6/B1頭大_4.json', joints=None, motions=[]),
 dict(key='E6_legShort', set='E6', label='E6 脚を短く', doc='e6/A12_脚短.json', joints=None, motions=['walk']),
 dict(key='E6_legLong', set='E6', label='E6 脚を長く（実物の比）', doc='e6/A13_脚長.json', joints=None, motions=['walk']),
 dict(key='E6_pillar', set='E6', label='E6 柱', doc='e6/A01_柱.json', joints=None, motions=['walk']),
 dict(key='E6_zou', set='E6', label='E6 ゾウ足', doc='e6/A05_ゾウ足.json', joints=None, motions=['walk']),
 dict(key='E6_momo', set='E6', label='E6 丸いもも', doc='e6/A06_丸いもも.json', joints=None, motions=['walk']),
 dict(key='E6_hiza', set='E6', label='E6 ひざと足首', doc='e6/A03_ひざと足首.json', joints=None, motions=['walk']),
]


def poses(MO):
    """lab/e5/tools/motion.py の poses() と同じ式。コマの数だけ変えた"""
    w = MO['walk']; out = {'walk': [], 'head': []}
    for k in range(WALK_N):
        t = k / WALK_N; p = {}
        for j, a in w['amp'].items(): p[j] = a * math.sin(2 * math.pi * (t - w['phase'][j]))
        p['頭'] = w['head'] * math.sin(4 * math.pi * t); p['しっぽ'] = w['tail'] * math.sin(2 * math.pi * t)
        out['walk'].append((p, w['bob'] * math.cos(4 * math.pi * t)))
    K = MO['head']['frames']; n = len(K); names = sorted(set().union(*[set(f) for f in K]))
    for i in range(n):
        for s in range(HEAD_SUB):
            u = s / HEAD_SUB; p = {}
            for nm in names:
                p0, p1, p2, p3 = [K[(i + d) % n].get(nm, 0.0) for d in (-1, 0, 1, 2)]
                v = 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
                lo, hi = MO['range'][nm]; p[nm] = max(lo, min(hi, v))
            out['head'].append((p, 0.0))
    return out


def e6_joints(doc):
    """E6 の絵：付け根は絵のデータの pivot（lab/e6/tools/legs_measure.py と同じ決まり。E5 の A と同じ場所）"""
    by = {n['id']: n for n in doc['nodes']}
    def leaves(i):
        o = []
        for n in doc['nodes']:
            if n.get('parent') == i: o += leaves(n['id']) if n['kind'] == 'group' else ([n['id']] if n.get('geo') else [])
        return o
    js = []
    for nm, nid in [('頭', 'gHead'), ('前脚（手前）', 'gLegFN'), ('前脚（奥）', 'legFF'), ('後ろ脚（手前）', 'gLegHN'), ('後ろ脚（奥）', 'legHF'), ('しっぽ', 'tail')]:
        n = by[nid]; ids = leaves(nid) if n['kind'] == 'group' else [nid]
        js.append(dict(name=nm, main=nid, par='torso', links=[dict(ids=ids, pivot=n['pivot'], frac=1)]))
    return dict(joints=js)


class Rig:
    """lab/e5/tools/motion.py の Rig から、描くのに要る所（親子・行列・色つきの絵）だけを写した物"""
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

    def mats(self, pose):
        T = {}
        def go(n, Tp):
            T[n] = mul(Tp, rot(self.piv[n], pose.get(n, 0.0)))
            for k in self.kids[n]: go(k, T[n])
        for n in self.J:
            if self.par[n] is None: go(n, [1, 0, 0, 1, 0, 0])
        return T

    def xf(self, pose, bob=0.0):
        T = self.mats({q: v for q, v in pose.items() if q in self.J})
        x = [{'ids': self.own[n], 'M': T[n]} for n in self.J]
        if bob:
            B = [1, 0, 0, 1, 0, bob]; x = [{'ids': t['ids'], 'M': mul(B, t['M'])} for t in x]
            rest = [n['id'] for n in self.doc['nodes'] if n.get('geo') and n['id'] not in self.allids and not ('地面の影' in (n.get('name') or '') or str(n.get('fill')).lower() == '#bcd3a2')]
            x.append({'ids': rest, 'M': B})
        return x


def measure_of(mask):
    """影絵の広さと囲み（記録するだけ。絵は動かさない）"""
    ys, xs = np.nonzero(mask)
    return dict(area=int(mask.sum()), left=int(xs.min()), right=int(xs.max()), top=int(ys.min()), bottom=int(ys.max()) + 1)


def shot(P, opt, w, h):
    sc = w / (CROP[2] - CROP[0])
    im = P.render(dict(opt, scale=sc))
    return im.crop((0, 0, w, h))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--probe', action='store_true'); ap.add_argument('--only'); a = ap.parse_args()
    MO = load(os.path.join(SRC, 'e5', 'motions.json')); PS = poses(MO)
    rnd = random.Random(SEED_CODES); codes = ['%s%02d' % (c, rnd.randrange(10, 100)) for c in rnd.sample('abcdefghkmnpqrstuvwxyz', len(VERS))]
    out = []; total = 0
    for v, code in zip(VERS, codes):
        if a.only and v['key'] != a.only: continue
        doc = load(os.path.join(SRC, v['doc']))
        spec = load(os.path.join(SRC, v['joints'])) if v['joints'] else e6_joints(doc)
        with Page() as P:
            R = Rig(P, spec, doc)
            info = measure_of(P.mask())
            print(v['key'], code, info, flush=True)
            if a.probe: continue
            d = os.path.join(IMG, code); os.makedirs(d, exist_ok=True)
            VM = [1, 0, 0, 1, -CROP[0], -CROP[1]]     # CROP の左上を原点へ（倍率は render の scale）
            def put(im, name, q):
                p = os.path.join(d, name); im.save(p, 'WEBP', quality=q, method=6); return os.path.getsize(p)
            n = put(shot(P, dict(mode='final', post=VM), BIG_W, BIG_H), 's.webp', Q_BIG)
            n += put(shot(P, dict(mode='sil', post=VM), BIG_W, BIG_H), 'k.webp', Q_BIG)
            fr = {}
            for m in v['motions']:
                for i, (pose, bob) in enumerate(PS[m]):
                    n += put(shot(P, dict(mode='final', post=VM, xf=R.xf(pose, bob)), OUT_W, OUT_H), '%s%02d.webp' % (m[0], i), Q_FRAME)
                fr[m] = len(PS[m])
            total += n
            out.append(dict(key=v['key'], set=v['set'], label=v['label'], code=code, frames=fr, src='lab/hyoka/src/' + v['doc'], measured=info, bytes=n,
                            sha=hashlib.sha256(open(os.path.join(SRC, v['doc']), 'rb').read()).hexdigest()[:12]))
    if a.probe or a.only: return
    man = dict(made='tools/make_frames.py', docSize=[1600, 900], crop=CROP, frameSize=[OUT_W, OUT_H], bigSize=[BIG_W, BIG_H], walkN=WALK_N, headN=6 * HEAD_SUB, versions=out, bytes=total)
    open(os.path.join(HY, 'manifest.js'), 'w', encoding='utf-8').write('/* tools/make_frames.py が作る。手で直さない */\nwindow.HYOKA_MANIFEST = ' + json.dumps(man, ensure_ascii=False, indent=1) + ';\n')
    print('合計', round(total / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
