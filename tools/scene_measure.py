#!/usr/bin/env python3
"""動画の「動き」を数字で測る（お手本の録画と、うちの書き出しを同じ物差しで比べる）。

  python3 tools/scene_measure.py <動画> [--from 秒] [--to 秒] [--crop-bottom 0.2] [--json]

出すもの：
  止まっている割合 … 0.5 秒ごとに区切って、その間ずっと絵が動かなかった区切りの割合（お手本＝クルツゲザグトのアリの回は 4%）
  動きの内わけ     … ほぼ動かない／小さく動く／大きく動く、のコマの割合（お手本は 39%／43%／19%）
  ぱっと切り替え   … 1コマで画面がまるごと変わった回数と時刻（お手本は演出の稲妻だけ）
  大きく動いた所   … 画面の広い範囲が動いた区間（つなぎ・カメラの動き）と、その長さの真ん中

字幕を焼き込んだ動画は --crop-bottom 0.2（下の2割を見ない）で測る。
画面の録画（60コマで録った24〜30コマの動画）は同じコマが続くので、「ぱっと切り替え」は当てにしない（目で確かめる）。
"""
import argparse, json, subprocess, sys
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('video')
ap.add_argument('--from', dest='t0', type=float, default=0)
ap.add_argument('--to', dest='t1', type=float, default=0)
ap.add_argument('--crop-bottom', type=float, default=0.0)
ap.add_argument('--json', action='store_true')
a = ap.parse_args()

W, H, FPS = 160, 90, 30
vf = []
if a.crop_bottom > 0:
    vf.append(f'crop=iw:ih*{1 - a.crop_bottom}:0:0')
vf += [f'fps={FPS}', f'scale={W}:{H}']
cmd = ['ffmpeg', '-loglevel', 'error']
if a.t0: cmd += ['-ss', str(a.t0)]
if a.t1: cmd += ['-t', str(a.t1 - a.t0)]
cmd += ['-i', a.video, '-an', '-vf', ','.join(vf), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
prev = None; m = []; cov = []
while True:
    b = p.stdout.read(W * H * 3)
    if len(b) < W * H * 3: break
    f = np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.int16)
    if prev is not None:
        d = np.abs(f - prev).mean(axis=2)
        m.append(float(d.mean())); cov.append(float((d > 12).mean()))
    prev = f
p.wait()
m = np.array(m); cov = np.array(cov)
if len(m) < FPS:
    sys.exit('動画が短すぎるか、読めませんでした')

half = m[:len(m) // 15 * 15].reshape(-1, 15).max(axis=1)
still = float((half < 0.3).mean())
low, mid, high = float((m < 1).mean()), float(((m >= 1) & (m < 6)).mean()), float((m >= 6).mean())
hard = [round(a.t0 + i / FPS, 1) for i in range(1, len(m) - 1)
        if m[i] > 12 and m[i] > 4 * max(m[i - 1], m[i + 1], 0.5)]
# 画面の広い範囲（12%より上）が動いた区間。0.2 秒より短いすき間はつなげる
act = cov > 0.12; bursts = []; i = 0
while i < len(act):
    if act[i]:
        j = i
        while j < len(act) and (act[j] or act[j:j + 6].any()): j += 1
        if (j - i) / FPS >= 0.1: bursts.append((round(a.t0 + i / FPS, 2), round(a.t0 + j / FPS, 2)))
        i = j
    else:
        i += 1
lens = [e - s for s, e in bursts]
res = {'seconds': round(len(m) / FPS, 1), 'still_half_sec': round(still, 3),
       'low': round(low, 3), 'mid': round(mid, 3), 'high': round(high, 3),
       'mean_motion': round(float(m.mean()), 2), 'hard_cuts': hard,
       'big_moves': bursts, 'big_move_median': round(float(np.median(lens)), 2) if lens else 0}
if a.json:
    print(json.dumps(res, ensure_ascii=False))
else:
    print(f"測った長さ：{res['seconds']}秒")
    print(f"止まっている割合（0.5秒ごと）：{still * 100:.0f}%　（お手本 4%）")
    print(f"動きの内わけ：ほぼ動かない {low * 100:.0f}%／小さく動く {mid * 100:.0f}%／大きく動く {high * 100:.0f}%　（お手本 39／43／19）")
    print(f"動きの量（平均）：{res['mean_motion']}　（お手本 3.9）")
    print(f"ぱっと切り替え：{len(hard)}回　{hard[:30]}")
    print(f"大きく動いた所：{len(bursts)}か所・長さの真ん中 {res['big_move_median']}秒　（お手本 0.67秒）")
