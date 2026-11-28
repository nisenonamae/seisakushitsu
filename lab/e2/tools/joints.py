#!/usr/bin/env python3
"""E2：関節を付け根で ±度 回した一覧の画像と、すき間の数。
使い方：joints.py <絵.json> <関節の表.json> --out 名前 [--deg 15] [--title 見出し]
関節の表：[{name, ids:[部品の id…], pivot:[x,y]}]
すき間の決まり：付け根を中心に、半径＝（回す部品の囲みの長い辺 × 0.35）の円の中で、
  回す前の影絵にはあったのに、回したあと背景になった画素（すき間）と、逆に増えた画素（はみ出し）を数える。
  ただし「消えた画素」には、部品が動いただけの所（耳が動いたあとの空き）も入る。
  そこで「細いすき間（つなぎ目の割れ）」を別に数える：影絵を 10 画素ふくらませてから 10 画素ちぢめ（細い割れ目・くさびだけが埋まる）、
  埋まった画素を円の中で数え、回す前の同じ数を引く（0 より小さければ 0）。表の「割れ」がこれ。"""
import argparse, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2lib import *
from PIL import ImageDraw, ImageFilter

def notch(m, k=10):
    im = Image.fromarray((m * 255).astype('uint8'))
    c = im.filter(ImageFilter.MaxFilter(2 * k + 1)).filter(ImageFilter.MinFilter(2 * k + 1))
    return (np.asarray(c) > 127) & ~m


ap = argparse.ArgumentParser(); ap.add_argument('doc'); ap.add_argument('spec'); ap.add_argument('--out', required=True); ap.add_argument('--deg', type=float, default=15); ap.add_argument('--title', default='')
a = ap.parse_args()
doc = load(a.doc); spec = load(a.spec); S = 0.25
rows = []; tiles = []
with Page() as P:
    rest = P.mask(doc); H, W = rest.shape; yy, xx = np.mgrid[0:H, 0:W]
    for j in spec:
        bb = P.bbox(doc, j['ids']); r = 0.35 * max(bb[2] - bb[0], bb[3] - bb[1]); px, py = j['pivot']
        disc = (xx - px) ** 2 + (yy - py) ** 2 <= r * r
        n0 = notch(rest)
        rec = dict(name=j['name'], pivot=[round(px, 1), round(py, 1)], radius=round(r, 1))
        for sg in (+1, -1):
            d2 = P.rotated(doc, j['ids'], j['pivot'], sg * a.deg); m = P.mask(d2)
            gap = int((rest & ~m & disc).sum()); poke = int((~rest & m & disc).sum())
            nt = notch(m) & disc; crack = max(0, int(nt.sum()) - int((n0 & disc).sum())); rec['crack%+d' % (sg * a.deg)] = crack
            rec['gap%+d' % (sg * a.deg)] = gap; rec['poke%+d' % (sg * a.deg)] = poke
            im = P.render(d2, 'final', S); dr = ImageDraw.Draw(im)
            dr.ellipse(((px - r) * S, (py - r) * S, (px + r) * S, (py + r) * S), outline=(230, 60, 60))
            dr.ellipse((px * S - 3, py * S - 3, px * S + 3, py * S + 3), fill=(230, 60, 60))
            # すき間を赤で重ねる
            if crack:
                arr = np.asarray(im).copy(); gs = (nt & ~n0)[::4, ::4]; arr[gs] = (255, 0, 0); im = Image.fromarray(arr)
            tiles.append(label(im, '%s %+d度 割れ %d（消えた %d・増えた %d）' % (j['name'], sg * a.deg, crack, gap, poke), 13))
        rows.append(rec)
tot = sum(v for r in rows for k, v in r.items() if k.startswith('gap')); totc = sum(v for r in rows for k, v in r.items() if k.startswith('crack')); totp = sum(v for r in rows for k, v in r.items() if k.startswith('poke'))
sh = grid(tiles, 4); sh = label(sh.crop((0, -26, sh.width, sh.height)) if False else sh, '', 1)
sh.save(a.out + '.png')
json.dump(dict(deg=a.deg, rule='付け根を中心に半径（囲みの長い辺×0.35）の円の中で、回す前の影絵から消えた画素＝すき間、増えた画素＝はみ出し', crack_total=totc, gap_total=tot, poke_total=totp, joints=rows), open(a.out + '.json', 'w'), ensure_ascii=False, indent=1)
print(a.title, '割れの合計', totc, '消えた画素の合計', tot, 'はみ出しの合計', totp)

