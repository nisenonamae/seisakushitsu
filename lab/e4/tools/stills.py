#!/usr/bin/env python3
"""E4：割り方を変えた版の、止まった絵が元（v1）と同じかを確かめる。影絵の重なり（IoU）と、色つきの絵で色が変わった画素の数。"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
V = os.path.join(E4, 'variants'); names = ['v1_e2', 'v2_deep', 'v3_split', 'v4_round', 'v5_pivot_in', 'v5x_pivot_edge', 'v6_round_in']
rows = []; tiles = []
with Page() as P:
    base = None
    for n in names:
        doc = load(os.path.join(V, n + '.json')); P.setdoc(doc)
        m = P.mask(); c = np.asarray(P.render(dict(mode='final'))).astype(int)
        if base is None: base = (m, c)
        diff = (np.abs(c - base[1]).max(2) > 24)
        parts = [x for x in doc['nodes'] if x.get('geo')]; pts = sum(len(x['geo'].get('pts', [])) or 4 for x in parts)
        rows.append(dict(name=n, iou=round(iou(m, base[0]), 5), sil_diff=int((m ^ base[0]).sum()), color_diff=int(diff.sum()), parts=len(parts), points=pts))
        im = Image.fromarray(c.astype(np.uint8)); a = np.asarray(im).copy(); a[diff] = (255, 0, 0)
        tiles.append(label(Image.fromarray(a).crop((180, 250, 1400, 800)).resize((610, 275), Image.LANCZOS), '%s　影絵の重なり %.4f　色が変わった画素 %d（赤）' % (n, rows[-1]['iou'], rows[-1]['color_diff']), 13))
        print(rows[-1])
save(os.path.join(E4, 'out', '止まった絵.json'), rows); grid(tiles, 2).save(os.path.join(E4, 'out', '止まった絵.png'), optimize=True)
