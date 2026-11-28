#!/usr/bin/env python3
"""E6：一覧の画像（字入り。自分とまとめ役が見る用）。out/<版>/ の 仕上がり.png・影絵.png から作る。
使い方：python3 tools/sheets.py  →  out/一覧_*.png"""
import json, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import font, load, OUT

def tile(name, text, k, crop=None):
    ims = []
    for f in ('仕上がり.png', '影絵.png'):
        im = Image.open(os.path.join(OUT, name, f)).convert('RGB')
        if crop: im = im.crop(crop)
        ims.append(im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS))
    w, h = ims[0].size; c = Image.new('RGB', (w, 2 * h + 24), 'white'); c.paste(ims[0], (0, 24)); c.paste(ims[1], (0, 24 + h))
    ImageDraw.Draw(c).text((4, 2), text, fill='black', font=font(14)); return c

def sheet(names, fname, cols, k=0.5, crop=None, notes=None):
    ts = [tile(n, n + '：' + notes[n][:26], k, crop) for n in names]; w, h = ts[0].size; rows = (len(ts) + cols - 1) // cols
    sh = Image.new('RGB', (cols * (w + 4) + 4, rows * (h + 4) + 4), 'white')
    for i, t in enumerate(ts): sh.paste(t, (4 + (i % cols) * (w + 4), 4 + (i // cols) * (h + 4)))
    sh.convert('P', palette=Image.ADAPTIVE, colors=128).save(os.path.join(OUT, fname), optimize=True); print(fname, sh.size)

def main():
    V = load(os.path.join(OUT, 'versions.json'))['versions']; notes = {v['name']: v['note'] for v in V}
    g = lambda *gs: [v['name'] for v in V if v['group'] in gs]
    LEG = (0, 200, 800, 450); HEAD = (60, 110, 460, 400)
    sheet(['L2'] + g('A脚', 'A脚長さ'), '一覧_A_脚.png', 5, 0.62, LEG, notes)
    sheet(['L2'] + g('B1頭大') + ['L2'] + g('B1胴大'), '一覧_B1_頭と胴の比.png', 5, 0.5, None, notes)
    sheet(['L2'] + g('B2丸み'), '一覧_B2_胴の丸み.png', 5, 0.5, None, notes)
    sheet(['L2'] + g('B3背中'), '一覧_B3_背中.png', 5, 0.5, None, notes)
    sheet(['L2'] + g('B4目', 'B4耳'), '一覧_B4_目と耳.png', 7, 0.7, HEAD, notes)
    sheet(['L2'] + g('B5表情'), '一覧_B5_表情.png', 5, 0.7, HEAD, notes)
    sheet(['L2'] + g('B6鼻づら'), '一覧_B6_鼻づら.png', 6, 0.7, HEAD, notes)
    if g('C組み合わせ'): sheet(['L2'] + g('C組み合わせ'), '一覧_C_組み合わせ.png', 4, 0.6, None, notes)

if __name__ == '__main__': main()
