"""E2 の道具の共通部分：裏のブラウザ（playwright）で、lab/p4/geom.js の描き方のまま絵を描く。"""
import base64, io, json, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
E2 = os.path.dirname(HERE)
GEOM = os.path.join(os.path.dirname(E2), 'p4', 'geom.js')


def font(sz):
    try:
        p = subprocess.run(['fc-match', '-f', '%{file}', 'Noto Sans CJK JP'], capture_output=True, text=True).stdout.strip()
        return ImageFont.truetype(p, sz)
    except Exception:
        return ImageFont.load_default()


class Page:
    def __enter__(self):
        self.pw = sync_playwright().start(); self.br = self.pw.chromium.launch()
        self.pg = self.br.new_page(); self.pg.goto('about:blank')
        self.pg.add_script_tag(path=GEOM); self.pg.add_script_tag(path=os.path.join(HERE, 'page.js'))
        return self

    def __exit__(self, *a):
        self.br.close(); self.pw.stop()

    def render(self, doc, mode='final', scale=1.0):
        u = self.pg.evaluate('([d,m,s]) => E2.render(d,m,s)', [doc, mode, scale])
        return Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGB')

    def mask(self, doc):
        a = np.asarray(self.render(doc, 'sil', 1.0).convert('L'))
        return a < 128

    def stats(self, doc):
        return self.pg.evaluate('d => E2.stats(d)', doc)

    def bbox(self, doc, ids):
        return self.pg.evaluate('([d,i]) => E2.bbox(d,i)', [doc, ids])

    def rotated(self, doc, ids, pivot, deg):
        return self.pg.evaluate('([d,i,p,a]) => E2.rotated(d,i,p,a)', [doc, ids, pivot, deg])


def iou(a, b):
    u = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum() / u) if u else 1.0


def diff_img(a, b, scale=0.5):
    """a だけ＝赤、b だけ＝青、両方＝灰"""
    h, w = a.shape; im = np.full((h, w, 3), 255, np.uint8)
    im[a & b] = (200, 200, 200); im[a & ~b] = (230, 40, 40); im[~a & b] = (40, 80, 230)
    r = Image.fromarray(im)
    return r.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


def label(im, text, sz=18):
    d = ImageDraw.Draw(im); f = font(sz)
    d.rectangle((0, 0, im.width, sz + 10), fill=(255, 255, 255)); d.text((6, 3), text, fill='black', font=f)
    return im


def grid(ims, cols, pad=4, bg='white'):
    w = max(i.width for i in ims); h = max(i.height for i in ims); rows = (len(ims) + cols - 1) // cols
    sh = Image.new('RGB', (cols * w + (cols + 1) * pad, rows * h + (rows + 1) * pad), bg)
    for k, i in enumerate(ims): sh.paste(i, (pad + (k % cols) * (w + pad), pad + (k // cols) * (h + pad)))
    return sh


def load(p):
    return json.load(open(p, encoding='utf-8'))
