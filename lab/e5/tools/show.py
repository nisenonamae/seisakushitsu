#!/usr/bin/env python3
"""E5：版の絵に、影絵の点の番号（R4 の番号）と付け根（赤）を重ねて見る（作るときの確かめ用）。show.py <版>… [--crop x0,y0,x1,y1] [--k 倍率] --out 名前"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
ap = argparse.ArgumentParser(); ap.add_argument('names', nargs='+'); ap.add_argument('--crop', default='150,200,1450,820'); ap.add_argument('--k', type=float, default=1.0); ap.add_argument('--out', required=True); ap.add_argument('--sil', action='store_true'); ap.add_argument('--cols', type=int, default=1)
a = ap.parse_args(); c = [int(v) for v in a.crop.split(',')]; V = os.path.join(E4, 'variants'); ims = []
with Page() as P:
    for n in a.names:
        doc = load(os.path.join(V, n + '.json')); pt = load(os.path.join(V, n + '.pts.json')); P.setdoc(doc); s = 2 * a.k
        im = P.render(dict(mode='sil' if a.sil else 'final', scale=s))
        if a.sil: im = Image.blend(im, Image.new('RGB', im.size, 'white'), 0.75)
        d = ImageDraw.Draw(im)
        for i, (x, y, cn) in enumerate(pt['src']):
            d.ellipse((x * s - 4, y * s - 4, x * s + 4, y * s + 4), fill=(255, 220, 0) if cn else (0, 200, 255), outline='black'); d.text((x * s + 5, y * s - 16), str(i), fill='black', font=font(15))
        for k, (x, y) in pt['pv'].items(): d.ellipse((x * s - 6, y * s - 6, x * s + 6, y * s + 6), fill=(230, 0, 0))
        im = im.crop([int(v * s) for v in c]); im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
        ims.append(label(im, n, 16))
grid(ims, a.cols).save(a.out, optimize=True); print(a.out)
