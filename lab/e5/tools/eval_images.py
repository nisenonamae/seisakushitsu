#!/usr/bin/env python3
"""E5：評価者に見せる用の画像（out/eval/。字なし・1600×900）と、色つきの絵の一覧（out/動きの絵.png）を作る。
  <記号>_止.png／<記号>_止_影絵.png／<記号>_歩1〜3.png（歩きのコマ 1・4・7。全部の版で同じ角度）／<記号>_首.png（首を振るコマ 0）。記号と版の対応は out/eval/対応.json"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
from motion import Rig, poses
V = os.path.join(E4, 'variants'); OUT = os.path.join(E4, 'out'); EV = os.path.join(OUT, 'eval'); os.makedirs(EV, exist_ok=True)
CODE = {'A': 'M', 'B': 'T', 'C': 'H', 'D': 'R', 'E': 'K', 'F': 'W', 'V6': 'Q', 'P4': 'Z'}      # 記号は、版の順と関係のない字を決め打ちで
MO = load(os.path.join(E4, 'motions.json')); PS = poses(MO); rows = []; mp = {}


def put(im, name):
    im.convert('P', palette=Image.ADAPTIVE, colors=160).save(os.path.join(EV, name), optimize=True)


for n, c in CODE.items():
    sp = os.path.join(V, n + '.joints.json')
    if not os.path.exists(sp): continue
    spec = load(sp); doc = load(os.path.join(V, spec['doc'])); tl = []
    with Page() as P:
        R = Rig(P, spec, doc); z = R.mats({})
        a = R.color(z); put(a, c + '_止.png'); b = R.silimg(z); put(b, c + '_止_影絵.png'); tl += [a, b]
        for k, i in enumerate(MO['walk']['eval']):
            pose, bob = PS['歩く'][i]; pose = {q: v for q, v in pose.items() if q in R.J}; im = R.color(R.mats(pose), bob); put(im, '%s_歩%d.png' % (c, k + 1)); tl.append(im)
        pose, bob = PS['首'][MO['head']['eval'][0]]; pose = {q: v for q, v in pose.items() if q in R.J}; im = R.color(R.mats(pose)); put(im, c + '_首.png'); tl.append(im)
    mp[c] = dict(version=n, title=spec.get('title'))
    ts = [label(t.crop((150, 200, 1450, 810)).resize((390, 183), Image.LANCZOS), '%s（%s）%s' % (n, c, lab), 12) for t, lab in zip(tl, ['止まった絵', '影絵', '歩く コマ1', '歩く コマ4', '歩く コマ7', '首を振る コマ0'])]
    rows.append(grid(ts, 6)); print(n, c)
save(os.path.join(EV, '対応.json'), dict(note='記号 → 版。画像には字を入れていない。歩1〜3＝歩きのコマ 1・4・7（motions.json）、首＝首を振るコマ 0', map=mp))
sh = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), 'white'); y = 0
for r in rows: sh.paste(r, (0, y)); y += r.height
sh.convert('P', palette=Image.ADAPTIVE, colors=128).save(os.path.join(OUT, '動きの絵.png'), optimize=True); print(sh.size)
