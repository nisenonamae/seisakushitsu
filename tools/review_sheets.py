#!/usr/bin/env python3
"""見直しループ用：動画（またはコマの入ったフォルダ）から、見る役に渡す一覧と、機械で測った気になる所を作る。
使い方： python3 tools/review_sheets.py <動画.mp4 か コマのフォルダ> <出力フォルダ> [--fps 24] [--cuts 2.8,10.4,…]
出る物： overview_N.png（1秒ごとの一覧）／ scene_NN_zoom.png（場面のまん中のコマを4分割して拡大）／
        scene_NN_motion.png（いちばん動いている所の連続8コマ）／ report.txt（場面の切れ目・ちらつき・急な飛び・止まっている所）
決まり：見る役（別の Claude）は tools/REVIEW.md のとおりに、これらと docs/notes/review_points.md（指摘帳）を見る。"""
import sys, os, glob, subprocess, statistics, argparse
from PIL import Image, ImageChops, ImageStat, ImageDraw

def frames_of(src, tmp, fps):
    if os.path.isdir(src):
        fs = sorted(glob.glob(os.path.join(src, 'f*.jpg')) + glob.glob(os.path.join(src, 'f*.png')))
        if fs: return fs
    os.makedirs(tmp, exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf', f'fps={fps}', os.path.join(tmp, 'f%04d.jpg')], check=True)
    return sorted(glob.glob(os.path.join(tmp, 'f*.jpg')))

def diff(a, b): return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]

def label(im, text):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 8 + 7 * len(text), 15], fill=(0, 0, 0)); d.text((4, 2), text, fill=(255, 255, 255)); return im

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--fps', type=float, default=24); ap.add_argument('--cuts', default='')
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True); fps = a.fps
    fs = frames_of(a.src, os.path.join(a.out, '_frames'), fps); n = len(fs)
    if n < 3: sys.exit('コマが足りません')
    small = [Image.open(f).convert('L').resize((160, 90)) for f in fs]
    d1 = [diff(small[i], small[i + 1]) for i in range(n - 1)]
    med = statistics.median(d1) or 0.01
    # 場面の切れ目：指定があればそれを使う。なければ、差が急に大きいコマ（白い光でつなぐ所は拾えないので、分かっていれば --cuts で渡す）
    if a.cuts: cuts = [int(round(float(x) * fps)) for x in a.cuts.split(',') if x]
    else: cuts = [i + 1 for i in range(n - 1) if d1[i] > max(18, 8 * med)]
    cuts = [c for j, c in enumerate(cuts) if 0 < c < n and (j == 0 or c - cuts[j - 1] > fps * .4)]
    bounds = [0] + cuts + [n]; scenes = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1) if bounds[i + 1] - bounds[i] >= 3]
    cutset = set(cuts)
    # ちらつき：となりのコマとは違うのに、1つ飛ばすと元に戻る動き（行って戻る）。なめらかな動きでは 0 に近い
    fl = [0.0] * n
    for i in range(n - 2):
        if i + 1 in cutset or i + 2 in cutset: continue
        fl[i + 1] = max(0.0, (d1[i] + d1[i + 1] - diff(small[i], small[i + 2])) / 2)
    rep = [f'コマ {n}枚・{n / fps:.1f}秒・{fps:g}fps', '', '■ 場面（始まり〜終わり）']
    for j, (s0, s1) in enumerate(scenes): rep.append(f'  場面{j + 1:02d}： {s0 / fps:5.1f}〜{s1 / fps:5.1f}秒（{(s1 - s0) / fps:.1f}秒）')
    rep += ['', '■ 1秒ごと（動き＝となりのコマとの差の平均／ちらつき＝行って戻る動き／率＝ちらつき÷動き）', '  ※ 目安：ちらつき 0.5 以上 かつ 率 0.3 以上 → 「ちらついて落ち着かない」疑い。動き 0.05 以下 → 止まっている疑い']
    flags = []
    for sec in range(int(n / fps) + 1):
        i0, i1 = int(sec * fps), min(n - 1, int((sec + 1) * fps))
        if i1 - i0 < 2: continue
        mv = [d1[i] for i in range(i0, i1) if i + 1 not in cutset]; ff = fl[i0:i1]
        m = sum(mv) / max(1, len(mv)); f = sum(ff) / max(1, len(ff)); r = f / m if m > .01 else 0
        mark = ''
        if f >= .5 and r >= .3: mark = '  ← ちらつきの疑い'; flags.append(f'{sec}秒台：ちらつき {f:.2f}（率 {r:.2f}）')
        elif m <= .05: mark = '  ← 止まっている疑い'; flags.append(f'{sec}秒台：ほとんど動いていない（動き {m:.2f}）')
        rep.append(f'  {sec:3d}秒  動き {m:5.2f}  ちらつき {f:5.2f}  率 {r:4.2f}{mark}')
    # 急な飛び：切れ目でもないのに、前後より急に差が大きいコマ
    for i in range(2, n - 3):
        if i + 1 in cutset or i in cutset: continue
        loc = statistics.median(d1[max(0, i - 6):i] + d1[i + 1:i + 7]) or .01
        if d1[i] > 6 * loc and d1[i] > 3: flags.append(f'{(i + 1) / fps:.2f}秒：急な飛び（差 {d1[i]:.1f}、まわりは {loc:.1f}）')
    rep += ['', '■ 機械が見つけた気になる所'] + (['  ' + x for x in flags] or ['  なし'])
    open(os.path.join(a.out, 'report.txt'), 'w').write('\n'.join(rep) + '\n')
    # 1) 全体の一覧（1秒ごと。6列×6段で1枚）
    secs = list(range(int(n / fps) + 1)); per = 36; made = []
    for k in range(0, len(secs), per):
        part = [s for s in secs[k:k + per] if int(s * fps) < n]; cols = 6; rows = (len(part) + cols - 1) // cols
        sh = Image.new('RGB', (cols * 324, rows * 184), 'white')
        for j, s in enumerate(part): sh.paste(label(Image.open(fs[int(s * fps)]).convert('RGB').resize((320, 180)), f'{s}s'), ((j % cols) * 324, (j // cols) * 184))
        p = os.path.join(a.out, f'overview_{k // per + 1}.png'); sh.save(p); made.append(p)
    # 2) 場面ごと：まん中のコマを4分割して拡大（細かいバグを見る）／ 3) いちばん動いている所の連続8コマ（動きを見る）
    for j, (s0, s1) in enumerate(scenes):
        mid = Image.open(fs[(s0 + s1) // 2]).convert('RGB'); w, h = mid.size; sh = Image.new('RGB', (w + 4, h + 4), 'white')
        for q, (qx, qy) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
            sh.paste(label(mid.crop((qx * w // 2, qy * h // 2, (qx + 1) * w // 2, (qy + 1) * h // 2)).resize((w // 2, h // 2), Image.LANCZOS) if False else mid.crop((qx * w // 2, qy * h // 2, (qx + 1) * w // 2, (qy + 1) * h // 2)), f'{((s0 + s1) // 2) / fps:.1f}s ' + ['左上', '右上', '左下', '右下'][q]), (qx * (w // 2 + 4), qy * (h // 2 + 4)))
        big = sh.resize((sh.width * 3 // 2, sh.height * 3 // 2), Image.LANCZOS); p = os.path.join(a.out, f'scene_{j + 1:02d}_zoom.png'); big.save(p); made.append(p)
        step = max(1, int(round(fps / 8))); span = step * 7; best = s0
        if s1 - s0 > span + 2: best = max(range(s0, s1 - span - 1), key=lambda i: sum(d1[i:i + span]))
        idx = [min(s1 - 1, best + k * step) for k in range(8)]
        box = None
        for k in range(7):
            bb = ImageChops.difference(small[idx[k]], small[idx[k + 1]]).point(lambda v: 255 if v > 14 else 0).getbbox()
            if bb: box = bb if not box else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
        fw, fh = Image.open(fs[idx[0]]).size; sx, sy = fw / 160, fh / 90
        if box and (box[2] - box[0]) * (box[3] - box[1]) < 160 * 90 * .55:
            cx, cy = (box[0] + box[2]) / 2 * sx, (box[1] + box[3]) / 2 * sy; cw = max((box[2] - box[0]) * sx * 1.3, fw * .34); ch = cw * 9 / 16
            x0 = min(max(0, cx - cw / 2), fw - cw); y0 = min(max(0, cy - ch / 2), fh - ch); crop = (int(x0), int(y0), int(x0 + cw), int(y0 + ch))
        else: crop = (0, 0, fw, fh)
        st = Image.new('RGB', (4 * 484, 2 * 274), 'white')
        for k, i in enumerate(idx): st.paste(label(Image.open(fs[i]).convert('RGB').crop(crop).resize((480, 270), Image.LANCZOS), f'{i / fps:.2f}s'), ((k % 4) * 484, (k // 4) * 274))
        p = os.path.join(a.out, f'scene_{j + 1:02d}_motion.png'); st.save(p); made.append(p)
    print(open(os.path.join(a.out, 'report.txt')).read().split('■ 機械が見つけた気になる所')[1].strip() or 'なし')
    print('出力：', a.out, '（', len(made), '枚＋ report.txt ）')

if __name__ == '__main__': main()
