#!/usr/bin/env python3
"""E5：結果の一覧の画像を作る（motion.py が /tmp/e5/tiles に出したコマと、out/*.motion.json から）。
  out/歩く.png（版 × 10 コマ）／out/首.png（版 × 6 コマ）／out/悪いコマ.png（版ごとに、歩く・首のいちばん悪いコマの、いちばん悪い関節のまわりの拡大）"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
TILES = '/tmp/e5/tiles'; OUT = os.path.join(E4, 'out'); V = os.path.join(E4, 'variants')
NAMES = [n for n in ['A', 'B', 'C', 'D', 'E', 'F', 'V6', 'P4'] if os.path.exists(os.path.join(OUT, n + '.motion.json'))]
LEG = '灰＝体（濃い灰＝動く部品）　赤＝すき間　橙＝はみ出し　黄＝細いへこみ　紫＝細いとがり　水色＝中の色の筋。　数字＝す：すき間　は：はみ出し　形：細いへこみ＋とがりの増え（どれも、関節ごとの「まわり」の体に対する％の、8 関節の平均）'
zoom = []
for mo, tw in (('歩く', 236), ('首', 300)):
    rows = []
    for n in NAMES:
        M = load(os.path.join(OUT, n + '.motion.json'))['motions'][mo]; s = M['summary']; ts = []
        for i, f in enumerate(M['frames']):
            im = Image.open(os.path.join(TILES, n, '%s_%02d.png' % (mo, i))).convert('RGB')
            t = im.crop((150, 210, 1450, 800)); t = t.resize((tw, int(tw * 590 / 1300)), Image.LANCZOS)
            ts.append(label(t, '%d%s す%.2f は%.2f 形%.2f' % (i, '★' if i == s['worst_frame'] else '', 100 * f['gap'], 100 * f['poke'], 100 * f['shape']), 11, 16))
            if i == s['worst_frame']:
                spec = load(os.path.join(V, n + '.joints.json')); j = next(x for x in spec['joints'] if x['name'] == f['worst_joint']); p = j['links'][0]['pivot']; h = max(110, 1.25 * j['w'])
                z = im.crop((int(p[0] - h), int(p[1] - h), int(p[0] + h), int(p[1] + h))).resize((230, 230), Image.LANCZOS)
                r = f['joints'][f['worst_joint']]
                zoom.append((n, mo, label(label(z, 'す%.1f は%.1f 形%.1f％' % (100 * r['gap'], 100 * r['poke'], 100 * r['shape']), 11, 16), '%s %s コマ%d %s' % (n, mo, i, f['worst_joint']), 12, 18)))
        head = Image.new('RGB', (150, ts[0].height), 'white'); d = ImageDraw.Draw(head)
        for k, t in enumerate([n, '平均 す%.2f は%.2f' % (100 * s['mean']['gap'], 100 * s['mean']['poke']), '　　 形%.2f' % (100 * s['mean']['shape']), '悪いコマ 形%.2f' % (100 * s['worst']['shape']), 'ぶつかり %d' % s['bumps']]): d.text((3, 2 + 18 * k), t, fill='black', font=font(15 if k == 0 else 12))
        strip = Image.new('RGB', (150 + sum(t.width + 2 for t in ts), ts[0].height), 'white'); strip.paste(head, (0, 0)); x = 150
        for t in ts: strip.paste(t, (x, 0)); x += t.width + 2
        rows.append(strip)
    sh = Image.new('RGB', (rows[0].width, sum(r.height + 3 for r in rows)), 'white'); y = 0
    for r in rows: sh.paste(r, (0, y)); y += r.height + 3
    sh = label(sh, mo + '：コマごと（★＝いちばん悪いコマ）。' + LEG, 12)
    sh.convert('P', palette=Image.ADAPTIVE, colors=48).save(os.path.join(OUT, mo + '.png'), optimize=True); print(mo, sh.size)
zs = [z for n in NAMES for (nn, mo, z) in zoom if nn == n]
sh = label(grid(zs, 4 if len(zs) % 4 == 0 else 6), 'いちばん悪いコマの、いちばん悪い関節のまわりの拡大。' + LEG.split('。')[0], 12)
sh.convert('P', palette=Image.ADAPTIVE, colors=48).save(os.path.join(OUT, '悪いコマ.png'), optimize=True); print(sh.size)
