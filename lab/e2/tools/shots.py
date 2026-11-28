#!/usr/bin/env python3
"""E2：工程の JSON から、一覧の画像（仕上がり・影絵・点つき・前の工程との重なり）と数字を出す。
使い方：shots.py <今の.json> [--prev 前の.json] [--out 出す名前（拡張子なし）] [--title 見出し]"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2lib import *

ap = argparse.ArgumentParser(); ap.add_argument('doc'); ap.add_argument('--prev'); ap.add_argument('--out'); ap.add_argument('--title', default='')
ap.add_argument('--zoom', help='x0,y0,x1,y1 を拡大した絵も足す')
a = ap.parse_args()
doc = load(a.doc); out = a.out or os.path.splitext(a.doc)[0]
with Page() as P:
    fin = P.render(doc, 'final', 0.5); sil = P.render(doc, 'sil', 0.5); pts = P.render(doc, 'points', 0.5)
    st = P.stats(doc); m = P.mask(doc); res = dict(parts=st['parts'], points=st['points'], maxPts=st['maxPts'], maxName=st['maxName'], lines=st['lines'], prims=st['prims'], colors=st['colors'], over12=st['over12'], over8=st['over8'])
    ims = [label(fin, a.title + ' 仕上がり'), label(sil, '影絵（地面の影は外す）'), label(pts, '点つき（部品 %d・点 %d・最多 %d「%s」・線 %d）' % (st['parts'], st['points'], st['maxPts'], st['maxName'], st['lines']))]
    if a.prev:
        pm = P.mask(load(a.prev)); v = iou(pm, m); res['iou_prev'] = round(v, 4); res['only_prev_px'] = int((pm & ~m).sum()); res['only_now_px'] = int((~pm & m).sum())
        ims.append(label(diff_img(pm, m), '前の工程との重なり IoU %.4f（赤＝前だけ %d 画素・青＝今だけ %d 画素）' % (v, res['only_prev_px'], res['only_now_px'])))
    elif a.zoom:
        pass
    if a.zoom:
        x0, y0, x1, y1 = [float(v) for v in a.zoom.split(',')]; k = 800 / (x1 - x0)
        z = P.render(doc, 'final', k).crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y0 * k) + 450)); ims.append(label(z, '拡大'))
    grid(ims, 2).save(out + '.png')
    res['per'] = [[p['name'], p['pts'], p['kind']] for p in st['per']]
    json.dump(res, open(out + '.metrics.json', 'w'), ensure_ascii=False, indent=0)
    print({k: v for k, v in res.items() if k != 'per'})
