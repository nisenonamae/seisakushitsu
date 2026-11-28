#!/usr/bin/env python3
"""E4：版を並べて、色つきの絵で関節を回した所を見る一覧。
使い方：poses.py --out 名前 --deg 25 [--joints 頭,前脚（手前）…] <関節の表.json>…
1行＝1つの版。列＝関節ごとに −deg・＋deg。付け根に赤い点。"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *

ap = argparse.ArgumentParser(); ap.add_argument('specs', nargs='+'); ap.add_argument('--out', required=True); ap.add_argument('--deg', type=float, default=25); ap.add_argument('--joints', default=''); ap.add_argument('--size', type=int, default=190); ap.add_argument('--sil', action='store_true')
a = ap.parse_args(); want = [x for x in a.joints.split(',') if x]
rows = []
with Page() as P:
    for sp in a.specs:
        spec = load(sp); doc = load(os.path.join(os.path.dirname(os.path.abspath(sp)), spec['doc'])); P.setdoc(doc)
        tiles = []
        for name in (want or [j['name'] for j in spec['joints']]):
            j = next((x for x in spec['joints'] if x['name'] == name or name in x.get('alias', [])), None)
            for sg in (-1, 1):
                if j is None: tiles.append(Image.new('RGB', (a.size, a.size + 19), (240, 240, 240))); continue
                links = j['links']; mats = link_mats(links, sg * a.deg)
                im = P.render(dict(mode='sil' if a.sil else 'final', xf=[{'ids': l['ids'], 'M': T} for l, T in zip(links, mats)]))
                w = j.get('w', 120); cx = sum(l['pivot'][0] for l in links) / len(links); cy = sum(l['pivot'][1] for l in links) / len(links); half = max(1.5 * w, 60)
                d = ImageDraw.Draw(im)
                for l in links: p = l['pivot']; d.ellipse((p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4), fill=(230, 0, 0))
                t = im.crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half))).resize((a.size, a.size), Image.LANCZOS)
                tiles.append(label(t, '%s %+d°' % (j['name'], sg * a.deg), 12, 19))
        strip = Image.new('RGB', (150 + sum(t.width + 3 for t in tiles), tiles[0].height), 'white'); d = ImageDraw.Draw(strip)
        ttl = spec.get('title', ''); 
        for i in range(0, len(ttl), 10): d.text((3, 4 + 18 * (i // 10)), ttl[i:i + 10], fill='black', font=font(14))
        x = 150
        for t in tiles: strip.paste(t, (x, 0)); x += t.width + 3
        rows.append(strip)
sh = Image.new('RGB', (max(r.width for r in rows), sum(r.height + 4 for r in rows)), 'white'); y = 0
for r in rows: sh.paste(r, (0, y)); y += r.height + 4
sh.save(a.out + '.png', optimize=True); print(a.out + '.png', sh.size)
