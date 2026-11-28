"""E4 の道具の共通部分：裏のブラウザ（playwright）で、lab/p4/geom.js の描き方のまま絵を描く。"""
import base64, io, json, math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
E4 = os.path.dirname(HERE)
LAB = os.path.dirname(E4)
GEOM = os.path.join(LAB, 'p4', 'geom.js')
_F = {}


def font(sz):
    if sz not in _F:
        try:
            p = subprocess.run(['fc-match', '-f', '%{file}', 'Noto Sans CJK JP'], capture_output=True, text=True).stdout.strip()
            _F[sz] = ImageFont.truetype(p, sz)
        except Exception:
            _F[sz] = ImageFont.load_default()
    return _F[sz]


def rot(pivot, deg):
    """付け根のまわりに deg 度回す行列（画面では時計回りが＋）。M=[a,b,c,d,e,f]：x'=a x+c y+e, y'=b x+d y+f"""
    r = math.radians(deg); c, s = math.cos(r), math.sin(r); px, py = pivot
    return [c, s, -s, c, px - c * px + s * py, py - s * px - c * py]


def mul(A, B):
    """A∘B（先に B、あとで A）"""
    return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
            A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]


def inv(M):
    a, b, c, d, e, f = M; D = a * d - b * c
    ia, ib, ic, id_ = d / D, -b / D, -c / D, a / D
    return [ia, ib, ic, id_, -(ia * e + ic * f), -(ib * e + id_ * f)]


def apply(M, p):
    return [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]]


def link_mats(links, deg):
    """つながった関節（親から順）の、それぞれの部品にかかる行列。子は親の回転も受ける"""
    out = []; T = [1, 0, 0, 1, 0, 0]
    for l in links:
        T = mul(T, rot(l['pivot'], deg * l.get('frac', 1.0))); out.append(T)
    return out


class Page:
    def __enter__(self):
        self.pw = sync_playwright().start(); self.br = self.pw.chromium.launch()
        self.pg = self.br.new_page(); self.pg.goto('about:blank')
        self.pg.add_script_tag(path=GEOM); self.pg.add_script_tag(path=os.path.join(HERE, 'page.js'))
        return self

    def __exit__(self, *a):
        self.br.close(); self.pw.stop()

    def setdoc(self, doc):
        self.pg.evaluate('d => { window.__doc = d; }', doc)

    def render(self, opt):
        u = self.pg.evaluate('o => E4.render(window.__doc, o)', opt)
        return Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGB')

    def mask(self, **opt):
        opt['mode'] = 'sil'
        return np.asarray(self.render(opt).convert('L')) < 128

    def flat(self, doc, per=32):
        return self.pg.evaluate('([d,p]) => E4.flat(d,p)', [doc, per])


def iou(a, b):
    u = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum() / u) if u else 1.0


def label(im, text, sz=14, h=None):
    h = h or sz + 8
    out = Image.new('RGB', (im.width, im.height + h), 'white'); out.paste(im, (0, h))
    ImageDraw.Draw(out).text((4, 2), text, fill='black', font=font(sz))
    return out


def grid(ims, cols, pad=3, bg='white'):
    w = max(i.width for i in ims); h = max(i.height for i in ims); rows = (len(ims) + cols - 1) // cols
    sh = Image.new('RGB', (cols * w + (cols + 1) * pad, rows * h + (rows + 1) * pad), bg)
    for k, i in enumerate(ims): sh.paste(i, (pad + (k % cols) * (w + pad), pad + (k // cols) * (h + pad)))
    return sh


def load(p):
    return json.load(open(p, encoding='utf-8'))


def save(p, o):
    json.dump(o, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
