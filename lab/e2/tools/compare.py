#!/usr/bin/env python3
"""E2：2 つの絵（P4 の AI のみ／E2 の最後）に、同じ道具・同じ決まりで、比べるための物を作る。
使い方：compare.py <札> <絵.json> <部品の割り当て.json> --out compare/名前
部品の割り当て：{"torso":[胴の部品の id…], "joints":{"頭":[id…], "前脚（手前）":[…], …}, "pivots":{"頭":[x,y]…（絵のデータに付け根があるときだけ）}}
付け根の決まり：pivots にあればそれ。無ければ「回す部品の囲みの4辺の真ん中のうち、胴の囲みの中心にいちばん近い物」
  （＝部品の囲みの、体につながる側の辺の真ん中）。--bbox-rule を付けると、pivots があってもこの決まりを使う。
出す物：_仕上がり.png・_影絵.png・_点つき.png・_ばらし.png・_関節.png（joints.py）・_数字.json"""
import argparse, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2lib import *
from PIL import ImageDraw

ap = argparse.ArgumentParser(); ap.add_argument('tag'); ap.add_argument('doc'); ap.add_argument('assign'); ap.add_argument('--out', required=True); ap.add_argument('--bbox-rule', action='store_true')
a = ap.parse_args()
doc = load(a.doc); asg = load(a.assign); out = a.out
with Page() as P:
    P.render(doc, 'final', 1).save(out + '_仕上がり.png')
    P.render(doc, 'sil', 1).save(out + '_影絵.png')
    P.render(doc, 'points', 1).save(out + '_点つき.png')
    st = P.stats(doc)
    # ばらし：重ね順（下から）に、1つずつ
    tiles = []; f = font(13); z = 0
    for n in doc['nodes']:
        if n.get('kind') == 'group' or not n.get('geo'): continue
        z += 1
        one = dict(doc); one['nodes'] = [n]; bb = P.bbox(doc, [n['id']])
        sw = (n.get('stroke') or {}).get('w', 0) or 0; m = 6 + sw
        w = bb[2] - bb[0] + 2 * m; h = bb[3] - bb[1] + 2 * m; k = min(196 / w, 120 / h, 1.5)
        im = P.render(one, 'final', k).crop((max(0, int((bb[0] - m) * k)), max(0, int((bb[1] - m) * k)), int((bb[2] + m) * k), int((bb[3] + m) * k)))
        t = Image.new('RGB', (200, 150), doc.get('bg', '#fff')); t.paste(im, ((200 - im.width) // 2, 26 + (124 - im.height) // 2))
        d = ImageDraw.Draw(t); d.rectangle((0, 0, 200, 22), fill='white'); pc = next(p for p in st['per'] if p['id'] == n['id'])
        d.text((3, 3), '%d %s（%s・%d点）' % (z, (n.get('name') or '')[:9], pc['kind'][:2], pc['pts']), fill='black', font=f)
        tiles.append(t)
    grid(tiles, 8).save(out + '_ばらし.png')
    # 付け根
    tb = P.bbox(doc, asg['torso']); tc = [(tb[0] + tb[2]) / 2, (tb[1] + tb[3]) / 2]
    spec = []; how = {}
    for name, ids in asg['joints'].items():
        pv = None if a.bbox_rule else (asg.get('pivots') or {}).get(name)
        if pv: how[name] = '絵のデータの付け根'
        else:
            b = P.bbox(doc, ids); mids = [[(b[0] + b[2]) / 2, b[1]], [(b[0] + b[2]) / 2, b[3]], [b[0], (b[1] + b[3]) / 2], [b[2], (b[1] + b[3]) / 2]]
            pv = min(mids, key=lambda q: (q[0] - tc[0]) ** 2 + (q[1] - tc[1]) ** 2); how[name] = '囲みの辺の真ん中（胴に近い側）'
        spec.append(dict(name=name, ids=ids, pivot=pv))
    json.dump(spec, open(out + '_関節の表.json', 'w'), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'joints.py'), a.doc, out + '_関節の表.json', '--out', out + '_関節', '--title', a.tag], check=True)
J = load(out + '_関節.json')
num = dict(tag=a.tag, parts=st['parts'], groups=st['groups'], points=st['points'], avgPts=st['avg'], maxPts=st['maxPts'], maxName=st['maxName'], over8=st['over8'], over12=st['over12'],
           colors=st['colors'], lines=st['lines'], prims=st['prims'], crack_total=J['crack_total'], vanished_total=J['gap_total'], poke_total=J['poke_total'], pivot_how=how,
           joints=J['joints'], per=[[p['name'], p['pts'], p['kind']] for p in st['per']])
json.dump(num, open(out + '_数字.json', 'w'), ensure_ascii=False, indent=1)
print({k: v for k, v in num.items() if k not in ('per', 'joints', 'pivot_how')})
