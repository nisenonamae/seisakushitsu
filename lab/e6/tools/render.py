#!/usr/bin/env python3
"""E6：/tmp/e6/raw/<版>.json（node src/make.js が作る）を、影絵の広さ（画素）が基準 L2 と同じになるよう合わせ直し、
out/<版>/ に JSON・仕上がり.png・影絵.png（幅 800。字なし）・数字.json を作る。一覧（字入り）は out/一覧_*.png。
描き方は lab/p4/geom.js の G.draw のまま（tools/page_r.js は lab/e3/tools/page.js の写し＋大きさの合わせ直し）。
使い方：python3 tools/render.py [版の名前の頭 …]（なしで全部）"""
import base64, io, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); E6 = os.path.dirname(HERE); OUT = os.path.join(E6, 'out'); RAW = '/tmp/e6/raw'
GEOM = os.path.join(os.path.dirname(E6), 'p4', 'geom.js')
_F = {}
def font(sz):
    if sz not in _F:
        p = subprocess.run(['fc-match', '-f', '%{file}', 'Noto Sans CJK JP'], capture_output=True, text=True).stdout.strip()
        _F[sz] = ImageFont.truetype(p, sz)
    return _F[sz]
def load(p): return json.load(open(p, encoding='utf-8'))
def save(p, o, ind=None): json.dump(o, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=ind, separators=None if ind else (',', ':'))

class Page:
    def __enter__(self):
        self.pw = sync_playwright().start(); self.br = self.pw.chromium.launch(); self.pg = self.br.new_page(); self.pg.goto('about:blank')
        self.pg.add_script_tag(path=GEOM); self.pg.add_script_tag(path=os.path.join(HERE, 'page_r.js')); return self
    def __exit__(self, *a): self.br.close(); self.pw.stop()
    def render(self, doc, mode='final', scale=1.0):
        u = self.pg.evaluate('([d,m,s]) => E2.render(d,m,s)', [doc, mode, scale]); return Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGB')
    def mask(self, doc): return np.asarray(self.render(doc, 'sil', 1.0).convert('L')) < 128
    def stats(self, doc): return self.pg.evaluate('d => E2.stats(d)', doc)
    def fit(self, doc, s, cx): return self.pg.evaluate('([d,s,c]) => E6fit(d,s,c)', [doc, s, cx])

def main():
    V = load(os.path.join(OUT, 'versions.json')); pre = sys.argv[1:]
    todo = [v for v in V['versions'] if not pre or any(v['name'].startswith(p) for p in pre)]
    with Page() as P:
        base = load(os.path.join(RAW, 'L2.json')); TARGET = int(P.mask(base).sum())
        for v in todo:
            name = v['name']; doc = load(os.path.join(RAW, name + '.json')); s2 = 1.0
            for _ in range(2):          # 画素で数えた影絵の広さを、基準 L2 に合わせる（耳どうしの重なり・目の出っぱりなど、式の広さに入らない分を直す）
                m = P.mask(doc); a = int(m.sum())
                if abs(a / TARGET - 1) < 0.0015: break
                k = (TARGET / a) ** 0.5; xs = np.where(m.any(0))[0]; doc = P.fit(doc, k, (xs.min() + xs.max() + 1) / 2); s2 *= k
            doc.setdefault('e6', {})['scale'] = round(v['scale0'] * s2, 4)
            d = os.path.join(OUT, name); os.makedirs(d, exist_ok=True); save(os.path.join(d, name + '.json'), doc)
            fin = P.render(doc, 'final', 0.5); sil = P.render(doc, 'sil', 0.5)
            fin.save(os.path.join(d, '仕上がり.png'), optimize=True); sil.convert('L').save(os.path.join(d, '影絵.png'), optimize=True)
            st = P.stats(doc); m = P.mask(doc); ys, xs = np.where(m)
            num = dict(name=name, parts=st['parts'], groups=st['groups'], points=st['points'], maxPts=st['maxPts'], maxName=st['maxName'], lines=st['lines'], prims=st['prims'], colors=st['colors'], scale=doc['e6']['scale'],
                       sil_area=int(m.sum()), sil_box=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())])
            save(os.path.join(d, '数字.json'), num, 1)
            print(name, num['parts'], num['points'], num['maxPts'], num['lines'], num['colors'], num['sil_area'], num['scale'], flush=True)

if __name__ == '__main__': main()
