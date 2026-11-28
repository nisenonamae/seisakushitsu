#!/usr/bin/env python3
"""E5：止まった絵の影絵の質を、機械の数字で出す → out/止まった絵.json・out/止まった絵.png（影絵と、A から変わった所）・out/変えた点.png
  A との IoU（P4 は別の絵なので出さない）／曲がり角の数（measure.py の peaks。弦の長さ 12 画素・25度以上）／
  細いへこみ・とがりの面積（太さ 20 画素まで。体の面積に対する％）／脚のあいだのすき間（前脚どうし・後ろ脚どうし：足首の高さの幅・すき間の高さ）・腹の下の空き・耳と耳のあいだ（耳の高さの半分での幅）"""
import os, sys
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
from measure import kern, peaks
V = os.path.join(E4, 'variants'); OUT = os.path.join(E4, 'out')
NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'V6', 'P4']


def runs(row):
    """背景の続き（体と体にはさまれた物だけ）[(x0,x1)]"""
    xs = np.where(row)[0]
    if len(xs) == 0: return []
    out = []; prev = xs[0]
    for a, b in zip(xs[:-1], xs[1:]):
        if b - a > 1: out.append((int(a) + 1, int(b) - 1))
    return out


def gaps(m):
    ys, xs = np.where(m); ground = int(ys.max()); top = int(ys.min()); res = {}
    cols = {}                                           # すき間を、地面の少し上の行から上へたどる
    y0 = ground - 30; base = [r for r in runs(m[y0]) if r[1] - r[0] >= 4]
    for k, (a, b) in enumerate(base):
        cx = (a + b) // 2; y = y0
        while y > top and not m[y, cx]: y -= 1
        cols[k] = dict(x=[a, b], width=b - a + 1, height=ground - y)
    return [cols[k] for k in sorted(cols)]


def ear_gap(P, spec):
    j = {x['name']: x for x in spec['joints']}
    if '耳（手前）' not in j: return None
    a = P.mask(only=j['耳（手前）']['links'][0]['ids']); b = P.mask(only=j['耳（奥）']['links'][0]['ids']); full = P.mask()
    ya = np.where(a)[0]; yb = np.where(b)[0]; top = max(ya.min(), yb.min()); out = {}
    hd = P.mask(**{'except': j['耳（手前）']['links'][0]['ids'] + j['耳（奥）']['links'][0]['ids']})
    base = min(int(np.where(hd[:, int(np.where(a)[1].mean())])[0].min()), int(np.where(hd[:, int(np.where(b)[1].mean())])[0].min()))
    y = (top + base) // 2; xa = np.where(a[y])[0]; xb = np.where(b[y])[0]
    if len(xa) == 0 or len(xb) == 0: return 0
    lo, hi = (xb.max(), xa.min()) if xb.mean() < xa.mean() else (xa.max(), xb.min())
    return int(max(0, hi - lo - 1)) if not full[y, lo + 1:hi].any() else int((~full[y, lo + 1:hi]).sum())


rows = []; tiles = []; base = None
with Page() as P:
    for n in NAMES:
        sp = os.path.join(V, n + '.joints.json')
        if not os.path.exists(sp): continue
        spec = load(sp); doc = load(os.path.join(V, spec['doc'])); P.setdoc(doc)
        m = P.mask(); body = float(m.sum())
        if base is None: base = m
        u = np.pad(m.astype(np.uint8), 14); cc = u > 0
        no = (cv2.morphologyEx(u, cv2.MORPH_CLOSE, kern(10)) > 0) & ~cc; sp_ = cc & ~(cv2.morphologyEx(u, cv2.MORPH_OPEN, kern(10)) > 0)
        pk = peaks(m, 100); g = gaps(m)
        parts = [x for x in doc['nodes'] if x.get('geo')]
        r = dict(name=n, title=spec.get('title'), iou_A=None if n == 'P4' else round(iou(m, base), 4), changed_px=None if n == 'P4' else int((m ^ base).sum()), area=int(body),
                 corners=len(pk), corners_40=sum(a >= 40 for _, _, a in pk), notch=round(100 * no.sum() / body, 3), spur=round(100 * sp_.sum() / body, 3),
                 gaps=g, ear_gap=ear_gap(P, spec), parts=len(parts), lines=sum(x['kind'] == 'line' for x in parts), points=sum(len(x['geo'].get('pts', [])) for x in parts))
        rows.append(r); print(r)
        im = np.full(m.shape + (3,), 255, np.uint8); im[m] = (47, 39, 52)
        if n != 'P4': im[m & ~base] = (40, 170, 60); im[base & ~m] = (230, 60, 60)
        nn = no[14:-14, 14:-14]; ss = sp_[14:-14, 14:-14]; im[nn] = (255, 215, 60); im[ss] = (150, 90, 230)
        t = Image.fromarray(im).crop((170, 230, 1430, 800)).resize((630, 285), Image.LANCZOS)
        gs = '・'.join('%d×%d' % (q['width'], q['height']) for q in g)
        tiles.append(label(t, '%s　A との重なり %s　角 %d　細いへこみ %.2f％ とがり %.2f％　すき間（幅×高さ）%s　耳のあいだ %s' % (n, '—' if r['iou_A'] is None else '%.4f' % r['iou_A'], r['corners'], r['notch'], r['spur'], gs, r['ear_gap']), 12))
    save(os.path.join(OUT, '止まった絵.json'), rows)
    sh = grid(tiles, 2); sh = label(sh, '止まった絵の影絵。緑＝A より増えた所　赤＝A より減った所　黄＝細いへこみ（太さ 20 画素まで）　紫＝細いとがり　すき間＝脚と脚のあいだ・腹の下（左から。足首の高さでの幅 × 地面からの高さ）', 13)
    sh.convert('P', palette=Image.ADAPTIVE, colors=64).save(os.path.join(OUT, '止まった絵.png'), optimize=True)
    # 変えた点：A の点（灰）から、版の点（赤）へ。動いた点だけ番号を書く
    tl = []; A = load(os.path.join(V, 'A.pts.json'))
    for n in ['B', 'C', 'D', 'E']:
        pt = load(os.path.join(V, n + '.pts.json')); P.setdoc(load(os.path.join(V, n + '.json'))); s = 2
        im = Image.blend(P.render(dict(mode='sil', scale=s)), Image.new('RGB', (3200, 1800), 'white'), 0.8); d = ImageDraw.Draw(im); moved = []
        for i, ((x0, y0, c0), (x1, y1, c1)) in enumerate(zip(A['src'], pt['src'])):
            if abs(x0 - x1) + abs(y0 - y1) > 0.3 or c0 != c1:
                moved.append(i); d.line((x0 * s, y0 * s, x1 * s, y1 * s), fill=(230, 0, 0), width=3)
                d.ellipse((x0 * s - 5, y0 * s - 5, x0 * s + 5, y0 * s + 5), outline=(90, 90, 90), width=2); d.ellipse((x1 * s - 6, y1 * s - 6, x1 * s + 6, y1 * s + 6), fill=(230, 0, 0)); d.text((x1 * s + 8, y1 * s - 24), str(i), fill=(160, 0, 0), font=font(24))
        for k in pt['pv']:
            (x0, y0), (x1, y1) = A['pv'][k], pt['pv'][k]
            d.ellipse((x0 * s - 6, y0 * s - 6, x0 * s + 6, y0 * s + 6), outline=(0, 90, 200), width=2)
            if abs(x0 - x1) + abs(y0 - y1) > 0.3: d.line((x0 * s, y0 * s, x1 * s, y1 * s), fill=(0, 90, 200), width=3); d.ellipse((x1 * s - 7, y1 * s - 7, x1 * s + 7, y1 * s + 7), fill=(0, 90, 200))
        t = im.crop((340, 460, 2860, 1600)).resize((840, 380), Image.LANCZOS)
        tl.append(label(t, '%s　動かした影絵の点：%s' % (n, '・'.join(map(str, moved)) or 'なし'), 13))
    sh = label(grid(tl, 2), '変えた点。赤＝影絵の点（灰の丸＝A の場所 → 赤の丸＝この版）　青＝付け根（輪＝A の場所 → 丸＝この版）　番号は kaba5.js の R4 の番号', 13)
    sh.convert('P', palette=Image.ADAPTIVE, colors=64).save(os.path.join(OUT, '変えた点.png'), optimize=True)
