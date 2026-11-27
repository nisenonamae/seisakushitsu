#!/usr/bin/env python3
"""結果の一覧の画像を作る（lab/p1/results/ に数枚だけ）。
使い方： python3 lab/p1/tools/sheets.py [--out /tmp/p1/out] [--extra /tmp/p1/out_extra]
  01_scenes_a.jpg / 01_scenes_b.jpg：場面ごとに R1・R2 CPU・差（R1↔R2 CPU）・差（R2 GPU↔R2 CPU）
  02_zoom.png：ふち・字・ぼかし・線・画像を拡大（R1 / R2 GPU / R2 CPU）
  03_gradient.png：ゆるいグラデーションの色の帯（明るさの差を強調）
  04_quality.jpg：小さな場面を R1 と R2 CPU で（本番の大きさの切り抜きつき）
"""
import os, sys, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixdiff import diff_image
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = {'text': '① 字', 'edges': '② ふち', 'blur': '③ ぼかし', 'blend': '④ 合成とマスク', 'grad': '⑤ グラデーション',
         'image': '⑥ 画像', 'stroke': '⑦ 線', 'kz': '⑧ 小さな場面', 'heavy': '⑨ 重い場面'}


def font(sz):
    for p in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc']:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default='/tmp/p1/out'); ap.add_argument('--extra', default='/tmp/p1/out_extra'); x = ap.parse_args()
    D = os.path.join(x.out, 'default')
    R = os.path.join(ROOT, 'results'); os.makedirs(R, exist_ok=True)
    L = lambda s, k, d=D: Image.open(os.path.join(d, '%s__%s.png' % (s, k))).convert('RGB')
    A = lambda im: np.asarray(im, dtype=np.int16)
    f18, f15 = font(18), font(15)

    # 01：場面ごと
    tw, th, hd = 480, 270, 28
    for part, ss in [('a', ['text', 'edges', 'blur', 'blend', 'grad']), ('b', ['image', 'stroke', 'kz', 'heavy'])]:
        sh = Image.new('RGB', (tw * 4, (th + hd) * len(ss)), (28, 28, 34)); dr = ImageDraw.Draw(sh)
        for i, s in enumerate(ss):
            y = i * (th + hd)
            r1, g, c = L(s, 'r1'), L(s, 'r2gpu'), L(s, 'r2cpu')
            cols = [(r1.resize((tw, th), Image.LANCZOS), 'R1 Canvas 2D'), (c.resize((tw, th), Image.LANCZOS), 'R2 CanvasKit CPU'),
                    (diff_image(A(r1), A(c)).resize((tw, th), Image.BOX), '差 R1↔R2 CPU（16倍）'), (diff_image(A(g), A(c)).resize((tw, th), Image.BOX), '差 R2 GPU↔R2 CPU（16倍）')]
            for j, (im, t) in enumerate(cols):
                sh.paste(im, (j * tw, y + hd)); dr.text((j * tw + 6, y + 3), NAMES[s] + '｜' + t, fill=(255, 255, 255), font=f18)
        sh.save(os.path.join(R, '01_scenes_%s.jpg' % part), quality=86)

    # 02：拡大（切り抜きを 5倍・補いなし）
    crops = [('edges', (800, 330, 96, 54), '斜めの細い線（扇の根もと）'), ('edges', (56, 425, 96, 54), '小さな円（半径 0.5〜2）'), ('edges', (56, 56, 96, 54), '細い長方形（幅 0.5〜1）'),
             ('edges', (1690, 440, 96, 54), 'となり合う2色のさかい'), ('text', (76, 660, 96, 54), '小さい字'), ('text', (300, 100, 96, 54), '大きい字のふち'),
             ('blur', (620, 60, 96, 54), 'ぼかし σ4 のふち'), ('stroke', (560, 40, 96, 54), '細い斜めの線（0.25〜1.5）'), ('stroke', (170, 420, 96, 54), '角（とがり）'),
             ('image', (690, 40, 96, 54), '画像 1/2 に縮小（nearest）'), ('image', (990, 330, 96, 54), '画像 8倍に拡大（linear）'), ('blend', (1560, 280, 96, 54), '乗算の重なりのふち')]
    z, cw, chh = 5, 96 * 5, 54 * 5
    sh = Image.new('RGB', (cw * 3 + 8, (chh + 24) * len(crops)), (28, 28, 34)); dr = ImageDraw.Draw(sh)
    for i, (s, (cx, cy, w, h), t) in enumerate(crops):
        y = i * (chh + 24)
        for j, k in enumerate(['r1', 'r2gpu', 'r2cpu']):
            im = L(s, k).crop((cx, cy, cx + w, cy + h)).resize((cw, chh), Image.NEAREST)
            sh.paste(im, (j * (cw + 4), y + 24))
            dr.text((j * (cw + 4) + 4, y + 3), '%s｜%s' % (['R1', 'R2 GPU', 'R2 CPU'][j], t), fill=(255, 255, 255), font=f15)
    sh.quantize(255, method=Image.Quantize.MEDIANCUT).save(os.path.join(R, '02_zoom.png'), optimize=True)

    # 03：ゆるいグラデーションの帯（切り抜いて、明るさの差を 12倍に広げる）
    rows = [('R1 Canvas 2D', L('grad', 'r1'))]
    for k, t in [('r2cpu_nodither', 'R2 CanvasKit CPU（ざらつきなし）'), ('r2gpu_nodither', 'R2 CanvasKit GPU（ざらつきなし）')]:
        p = os.path.join(x.extra, 'default', 'grad__%s.png' % k)
        if os.path.exists(p): rows.append((t, Image.open(p).convert('RGB')))
    rows += [('R2 CanvasKit CPU＋ざらつき（dither。ふつうの設定）', L('grad', 'r2cpu')), ('R2 CanvasKit GPU＋ざらつき（dither。ふつうの設定）', L('grad', 'r2gpu'))]
    boxes = [((0, 20, 960, 180), '横のゆるい変化'), ((0, 420, 960, 680), '丸いゆるい変化（暗い）')]
    bw, bh = 960, 150
    sh = Image.new('RGB', (bw * 2, (bh + 24) * len(rows)), (28, 28, 34)); dr = ImageDraw.Draw(sh)
    for i, (t, im) in enumerate(rows):
        for j, (b, bt) in enumerate(boxes):
            a = A(im.crop(b)).astype(np.float32)
            a = np.clip((a - a.mean(axis=(0, 1))) * 12 + 128, 0, 255).astype(np.uint8)
            sh.paste(Image.fromarray(a).resize((bw, bh), Image.BOX), (j * bw, i * (bh + 24) + 24))
            dr.text((j * bw + 4, i * (bh + 24) + 3), '%s｜%s（差を12倍）' % (t, bt), fill=(255, 255, 255), font=f15)
    sh.save(os.path.join(R, '03_gradient.png'), optimize=True)

    # 04：絵の質（小さな場面）
    r1, c = L('kz', 'r1'), L('kz', 'r2cpu')
    sh = Image.new('RGB', (1920, 540 + 28 + 400 + 28), (28, 28, 34)); dr = ImageDraw.Draw(sh)
    for j, (im, t) in enumerate([(r1, 'R1 Canvas 2D'), (c, 'R2 CanvasKit CPU')]):
        sh.paste(im.resize((960, 540), Image.LANCZOS), (j * 960, 28)); dr.text((j * 960 + 6, 3), '⑧ 小さな場面｜' + t + '（1/2 に縮小）', fill=(255, 255, 255), font=f18)
        sh.paste(im.crop((300, 600, 1260, 1000)), (j * 960, 540 + 56)); dr.text((j * 960 + 6, 540 + 31), t + '｜本番の大きさの切り抜き', fill=(255, 255, 255), font=f18)
    sh.save(os.path.join(R, '04_quality.jpg'), quality=90)
    for n in sorted(os.listdir(R)):
        print(n, os.path.getsize(os.path.join(R, n)))


if __name__ == '__main__':
    main()
