#!/usr/bin/env python3
"""E3：全部の版（out/versions.json）と、比べる相手（P4 の AI のみ・E2 の直す前）に、同じ道具で 3 枚（仕上がり・影絵・点つき）と数字を作り、一覧の画像を作る。
版ごとの画像には字を入れない。一覧（out/一覧_*.png）には版の名前が入る。描き方は lab/p4/geom.js の G.draw のまま（tools/page.js は lab/e2 の写し）。"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2lib import *

E3 = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(E3, 'out'); LAB = os.path.dirname(E3)
V = load(os.path.join(OUT, 'versions.json'))
items = [(v['name'], os.path.join(OUT, v['name'], v['name'] + '.json')) for v in V['versions']]
OTHERS = [('p4ai', os.path.join(LAB, 'p4', 'ai', 'ai_only.json')), ('e2', os.path.join(LAB, 'e2', 'compare', 'e2_final.json'))]
res = {}
with Page() as P:
    for name, src in items + OTHERS:
        d = os.path.join(OUT, name); os.makedirs(d, exist_ok=True); doc = load(src)
        if name in ('p4ai', 'e2'): json.dump(doc, open(os.path.join(d, name + '.json'), 'w'), ensure_ascii=False, indent=1)
        fin = P.render(doc, 'final', 1); sil = P.render(doc, 'sil', 1); pts = P.render(doc, 'points', 1)
        fin.save(os.path.join(d, '仕上がり.png'), optimize=True); sil.save(os.path.join(d, '影絵.png'), optimize=True); pts.save(os.path.join(d, '点つき.png'), optimize=True)
        st = P.stats(doc); m = P.mask(doc); ys, xs = np.where(m)
        num = dict(name=name, parts=st['parts'], groups=st['groups'], points=st['points'], maxPts=st['maxPts'], maxName=st['maxName'], over12=st['over12'], lines=st['lines'], prims=st['prims'], colors=st['colors'],
                   sil_area=int(m.sum()), sil_box=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], per=[[p['name'], p['pts'], p['kind']] for p in st['per']])
        json.dump(num, open(os.path.join(d, '数字.json'), 'w'), ensure_ascii=False, indent=1)
        res[name] = (fin, sil, pts, num)
        print(name, {k: num[k] for k in ('parts', 'points', 'maxPts', 'lines', 'colors', 'sil_area', 'sil_box')})

def tile(im, text, k=0.5):
    t = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS); c = Image.new('RGB', (t.width, t.height + 30), 'white'); c.paste(t, (0, 30))
    ImageDraw.Draw(c).text((6, 3), text, fill='black', font=font(18)); return c

note = {v['name']: v['note'] for v in V['versions']}; note.update(p4ai='P4 の AI のみ', e2='E2 の直す前')
def sheet(names, fname, k=0.5):
    ims = [tile(res[n][0], n + '：' + note[n], k) for n in names] + [tile(res[n][1], n + '：影絵', k) for n in names]
    grid(ims, len(names)).save(os.path.join(OUT, fname), optimize=True)
lv = [n for n in note if n.startswith('L') and '+' not in n]
sheet(lv, '一覧_段.png', 0.4)
sheet(['L2'] + [n for n in note if '+' in n] + ['L3'], '一覧_分ける版.png', 0.4)
sheet(['p4ai', 'e2', 'L1', 'L2', 'L3'], '一覧_比べる相手.png', 0.4)
grid([tile(res[n][2], n + '：点つき', 0.4) for n in note], 4).save(os.path.join(OUT, '一覧_点つき.png'), optimize=True)
