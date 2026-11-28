#!/usr/bin/env python3
"""E4：影絵では見えない、体の中の色の変化を数える（つなぎ目に下の色が見える・線がずれる、など）。
玉（付け根から半径 w/2）の中で、回す前も後も体である画素のうち、色が変わった画素 ÷ 玉の中の体の画素。±15・±25度。
玉の中は、回しても同じに見えるのが理想（同じ色の部品どうしなら）。部品といっしょに回る線（肩の線など）の分は、どの版にも同じだけ入る。"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
V = os.path.join(E4, 'variants'); names = ['v1_e2', 'v2_deep', 'v3_split', 'v4_round', 'v5_pivot_in', 'v5x_pivot_edge', 'v6_round_in', 'p4_ai_bbox', 'p4_ai_ball']
out = {}
with Page() as P:
    for n in names:
        spec = load(os.path.join(V, n + '.joints.json')); doc = load(os.path.join(V, spec['doc'])); P.setdoc(doc)
        c0 = np.asarray(P.render(dict(mode='final'))).astype(int); R = P.mask(); H, W = R.shape; yy, xx = np.mgrid[0:H, 0:W]; out[n] = {}
        for j in spec['joints']:
            ball = np.zeros((H, W), bool)
            for l in j['links']: ball |= (xx + .5 - l['pivot'][0]) ** 2 + (yy + .5 - l['pivot'][1]) ** 2 <= (j['w'] / 2) ** 2
            vals = []
            for deg in (-25, -15, 15, 25):
                xf = [{'ids': l['ids'], 'M': T} for l, T in zip(j['links'], link_mats(j['links'], deg))]
                c1 = np.asarray(P.render(dict(mode='final', xf=xf))).astype(int); F = P.mask(xf=xf)
                reg = ball & R & F; vals.append(float(((np.abs(c1 - c0).max(2) > 24) & reg).sum() / max(1, reg.sum())))
            out[n][j['name']] = [round(100 * v, 2) for v in vals]
        print(n, {k: round(sum(v) / 4, 1) for k, v in out[n].items()}, flush=True)
save(os.path.join(E4, 'out', '中の色.json'), dict(rule='玉の中で、回す前も後も体である画素のうち、色が変わった割合（％）。順に −25・−15・＋15・＋25度', data=out))
