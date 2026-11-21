"""型「3分割の例」：例を3つ、画面を縦に3つに分けて、それぞれ動くアニメで見せる（作り手が見つけた型・2026-11-21。お手本はクルツゲザグト）。

  {"t":"tri","panels":[場面A,場面B,場面C],          … どれもふつうの場面の指定（html など）。3つとも、最初から最後まで動き続ける
   "cx":[0.5,0.45,0.66],                            … 各場面のどこを切り出すか（横の位置 0〜1）。3分の1の幅で切り出す
   "labels":["雨をためる","水を戻す","海の水"],     … 名札（任意。上に出る）。"cols" で札の色
   "label_at":["@1","@2","@3"],                     … 名札を出す時刻。秒か、"@k"＝ats の k 番目の言葉
   "lead":true, "join":"@1",                        … 入り方②：A を画面いっぱいで見せておき、join の時刻に A が左の1枚に縮み、B・C が右から入る
   "expand":"@4"}                                   … 出方：この時刻に、右の1枚（C）が広がって画面全体になる。そのあとは C の場面が続く
  場面の指定に "tat":["@5","@6"] を付けると、その場面の中の動き（ats で合わせる動き）を、3分割のカットの ats の言葉に合わせられる

入り方①（3枚が端からすっと入る）は、lead を付けずに、カットに "tr":{"k":"slide3"} を付ける（trans.py）。
3つの場面は、背景の色が違うものを選ぶと分かれて見える（同じ色が並ぶときのために、細い白い仕切りを入れている）。
"""
import os, json, math, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def _ease(u):
    u = min(1.0, max(0.0, u)); return 2 * u * u if u < 0.5 else 1 - (-2 * u + 2) ** 2 / 2
def _back(u, s=1.7):
    u = min(1.0, max(0.0, u)) - 1; return 1 + (s + 1) * u * u * u + s * u * u

def _t(v, times, default):
    if v is None: return default
    if isinstance(v, str) and v.startswith('@'):
        k = int(v[1:]); return float(times[k]) if times and k < len(times) else default
    return float(v)

def _card(txt, col, size, font):
    f = ImageFont.truetype(font, size); d0 = ImageDraw.Draw(Image.new('RGB', (8, 8)))
    l, t, r, b = d0.textbbox((0, 0), txt, font=f); w = r - l + int(size * 0.9); h = int(size * 1.55); sh = max(4, size // 8)
    im = Image.new('RGBA', (w + sh, h + sh), (0, 0, 0, 0)); d = ImageDraw.Draw(im); rad = int(size * 0.2)
    d.rounded_rectangle((sh, sh, w + sh - 1, h + sh - 1), rad, fill=(20, 24, 40, 84))      # ぼかさない影
    d.rounded_rectangle((0, 0, w - 1, h - 1), rad, fill=col)
    d.text((w / 2, h / 2 - size * 0.03), txt, font=f, fill='#fff', anchor='mm')
    return im

def _crop(fr, cx, wd):
    H, W = fr.shape[:2]; wd = int(max(2, min(W, round(wd)))); x0 = int(min(max(0, round(cx * W - wd / 2)), W - wd))
    return fr[:, x0:x0 + wd]

def _put(out, img, x):
    W = out.shape[1]; w = img.shape[1]; x = int(round(x)); a, b = max(0, x), min(W, x + w)
    if b > a: out[:, a:b] = img[:, a - x:b - x]

def make(spec, dur, out, repo, make_scene, fps, scale, font):
    tmp = tempfile.mkdtemp(); P = spec['panels']; assert len(P) == 3, '3分割は場面を3つ'
    clips = []
    times0 = spec.get('times')
    for i, sp in enumerate(P):
        if sp.get('tat'):   # その場面の中の動きを、語りの言葉に合わせる："tat":["@5","@6"] → その場面の times（ats の時刻）になる
            sp = dict(sp); sp['times'] = [0.0] + [_t(x, times0, 2.0 + j) for j, x in enumerate(sp.pop('tat'))]
        o = f'{tmp}/p{i}.mp4'; make_scene(sp, dur, o, repo); clips.append(o)
    pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', clips[0]], capture_output=True, text=True, check=True)
    st = json.loads(pr.stdout)['streams'][0]; W, H = int(st['width']), int(st['height'])
    rd = [subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', c, '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE) for c in clips]
    enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264',
                            '-preset', 'veryfast', '-crf', '16' if scale > 1 else '20', '-pix_fmt', 'yuv420p', '-r', str(fps), out], stdin=subprocess.PIPE)
    times = spec.get('times'); cx = spec.get('cx') or [0.5, 0.5, 0.5]; pw = W / 3.0; g = max(2, int(round(H * 0.004)))
    lead = bool(spec.get('lead')); DJ, DE = 0.75, 0.95
    tj = _t(spec.get('join'), times, 1.2) if lead else -9.0
    te = _t(spec.get('expand'), times, None) if spec.get('expand') is not None else None
    labels = spec.get('labels') or []; cols = spec.get('cols') or ['#1f6fb0', '#2e8b57', '#c0503a']
    lat = spec.get('label_at') or []; t_hold = (tj + DJ) if lead else 0.0
    lt = [_t(lat[i] if i < len(lat) else None, times, t_hold + 0.15 + 0.14 * i) for i in range(len(labels))]
    cards = [_card(t_, cols[i % len(cols)], int(H * 0.058), font) for i, t_ in enumerate(labels)]
    n = max(1, int(round(dur * fps))); last = [None, None, None]
    for k in range(n):
        t = k / fps; F = []
        for i, r in enumerate(rd):
            b = r.stdout.read(W * H * 3)
            if len(b) == W * H * 3: last[i] = np.frombuffer(b, np.uint8).reshape(H, W, 3)
            F.append(last[i])
        A, B, C = F
        if te is not None and t >= te + DE: frame = C
        elif t < tj: frame = A
        else:
            frame = np.empty_like(A); frame[:] = 255
            if te is not None and t >= te:                       # 出方：右の1枚が広がる。左と真ん中は左へ押し出される
                u = _ease((t - te) / DE); wC = pw + (W - pw) * u; xC = W - wC
                _put(frame, _crop(C, cx[2], wC), xC); _put(frame, _crop(B, cx[1], pw - g), xC - pw); _put(frame, _crop(A, cx[0], pw - g), xC - 2 * pw)
                xs = [xC - 2 * pw, xC - pw, xC]; la = 1 - min(1, (t - te) / 0.25)
            else:
                u = _ease((t - tj) / DJ) if lead else 1.0
                wA = W + (pw - W) * u                              # 入り方②：見ていた画面が左の1枚に縮む
                _put(frame, _crop(A, cx[0], wA - (g if u > 0 else 0)), 0)
                xB = wA; xC = wA + pw                              # B・C が右から入る
                _put(frame, _crop(B, cx[1], pw - g), xB); _put(frame, _crop(C, cx[2], pw), xC)
                xs = [0, xB, xC]; la = 1.0
            if cards and la > 0:
                im = Image.fromarray(frame)
                for i, cd in enumerate(cards):
                    q = (t - lt[i]) / 0.32
                    if q <= 0: continue
                    s = _back(q) * (0.6 + 0.4 * la); cw, ch = max(2, int(cd.width * s)), max(2, int(cd.height * s))
                    c2 = cd.resize((cw, ch), Image.BILINEAR)
                    if la < 1: c2.putalpha(c2.getchannel('A').point(lambda v: int(v * la)))
                    im.paste(c2, (int(xs[i] + pw / 2 - cw / 2), int(H * 0.115 - ch / 2)), c2)
                frame = np.asarray(im)
        enc.stdin.write(np.ascontiguousarray(frame).tobytes())
    enc.stdin.close(); enc.wait()
    for r in rd: r.kill()
    if enc.returncode: raise RuntimeError('3分割の書き出しに失敗')
