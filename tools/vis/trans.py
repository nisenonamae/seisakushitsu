"""場面と場面の「つなぎ」（ぱっと切り替えない）。2026-11-21：餌（クルツゲザグトのアリの回）の学びから。

カット（shots）に "tr" を書くと、その場面の頭の d 秒を使って、前の場面からつなぐ。
場面の長さ・語りとの合わせは変わらない（前の場面の最後のコマを使い、次の場面は自分の時間どおりに動き続ける）。

  {"k":"push","dir":"left"|"right"|"up"|"down","d":0.7}   押し出す。dir＝絵が動いていく向き（up＝前の場面が上へ出て、次が下から入る）
  {"k":"shrink","to":[x,y],"d":0.7}                        前の場面が縮んで、次の場面の中の一点（0〜1）へ吸い込まれる
  {"k":"open","from":[x,y],"d":0.7}                        次の場面が、前の場面の中の一点から丸く広がる
  {"k":"wipe","col":"#3f8fca","dir":"right","d":0.7}       手前の物（色の帯）が横切って、通ったあとが次の場面になる
  {"k":"dive","at":[x,y],"d":0.7}                          飛びこむ：その一点へ加速して寄り、放射状のぼかしと白い光の下で次の場面に替わる（カメラの動きに切り替えを隠す）
  {"k":"slide3","dir":"left","d":0.6}                      3分割（"t":"tri"）の3枚が、つながったまま端から加速して入る（型「3分割の例」の入り方①。dir＝出てくる側の端）

使い分け：同じ動きを続けて使わない。向きや点は話の中身に合わせる（水が流れる向きへ押し出す、地図のその場所へ吸い込まれる など）。
同じ絵が続く所（同じ地図の続きなど）には付けない。効果音は付けない（切り替わりに音を鳴らすだけ、は決まりで禁止）。
"""
import subprocess, json, math
import numpy as np

def _probe(p):
    o = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate',
                        '-of', 'json', p], capture_output=True, text=True, check=True).stdout
    s = json.loads(o)['streams'][0]; a, b = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(a) / float(b)

def _frames(p, w, h):
    pr = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', p, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        b = pr.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    pr.wait()

def _ease(u):
    u = min(1.0, max(0.0, u)); return 2 * u * u if u < 0.5 else 1 - (-2 * u + 2) ** 2 / 2   # ゆっくり出て、ゆっくり止まる（急ぎすぎない）

def _hex(c):
    c = c.lstrip('#'); return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], np.float32)

def _push(A, B, u, dr):
    h, w = A.shape[:2]; out = np.empty_like(A)
    if dr in ('left', 'right'):
        o = int(round(u * w))
        if o <= 0: return A
        if o >= w: return B
        if dr == 'left': out[:, :w - o] = A[:, o:]; out[:, w - o:] = B[:, :o]
        else: out[:, o:] = A[:, :w - o]; out[:, :o] = B[:, w - o:]
    else:
        o = int(round(u * h))
        if o <= 0: return A
        if o >= h: return B
        if dr == 'up': out[:h - o] = A[o:]; out[h - o:] = B[:o]
        else: out[o:] = A[:h - o]; out[:o] = B[h - o:]
    return out

def _shrink(A, B, u, to):
    from PIL import Image
    h, w = A.shape[:2]; s = 1 + (0.03 - 1) * u
    cw, ch = max(2, int(w * s)), max(2, int(h * s))
    cx = w / 2 + (to[0] * w - w / 2) * u; cy = h / 2 + (to[1] * h - h / 2) * u
    x0, y0 = int(round(cx - cw / 2)), int(round(cy - ch / 2))
    small = np.asarray(Image.fromarray(A).resize((cw, ch), Image.BILINEAR))
    out = B.copy(); bd = max(2, int(h * 0.006))          # 白いふち（札のように見せる）
    X0, Y0, X1, Y1 = max(0, x0 - bd), max(0, y0 - bd), min(w, x0 + cw + bd), min(h, y0 + ch + bd)
    al = 1.0 if u < 0.8 else max(0.0, (1 - u) / 0.2)     # 最後は吸い込まれて消える
    reg = out[Y0:Y1, X0:X1].astype(np.float32); card = np.full_like(reg, 255.0)
    sx0, sy0 = max(0, x0), max(0, y0); sx1, sy1 = min(w, x0 + cw), min(h, y0 + ch)
    if sx1 > sx0 and sy1 > sy0:
        card[sy0 - Y0:sy1 - Y0, sx0 - X0:sx1 - X0] = small[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0]
    out[Y0:Y1, X0:X1] = (reg * (1 - al) + card * al).astype(np.uint8)
    return out

_GRID = {}
def _grid(h, w):
    if (h, w) not in _GRID: _GRID[(h, w)] = np.mgrid[0:h, 0:w].astype(np.float32)
    return _GRID[(h, w)]

def _open(A, B, u, fr):
    h, w = A.shape[:2]; yy, xx = _grid(h, w); fx, fy = fr[0] * w, fr[1] * h
    rmax = max(math.hypot(fx, fy), math.hypot(w - fx, fy), math.hypot(fx, h - fy), math.hypot(w - fx, h - fy))
    r = u * rmax * 1.02; d = np.hypot(xx - fx, yy - fy)
    out = np.where((d < r)[..., None], B, A); ring = (d >= r) & (d < r + h * 0.008)   # 広がるふちに白い輪
    out[ring] = 255
    return out

def _wipe(A, B, u, col, dr, i):
    h, w = A.shape[:2]; yy, xx = _grid(h, w); bw = w * 0.30; c = _hex(col)
    if dr == 'left': xx = w - 1 - xx
    lead = -bw * 0.1 + (w + bw * 1.2 + h * 0.25) * u            # 帯の先頭（斜め・波打つふち）
    edge = lead - (yy / h) * h * 0.25 + h * 0.02 * np.sin(yy / (h * 0.07) + i * 0.7)
    behind = xx < edge - bw; band = (xx >= edge - bw) & (xx < edge)
    out = np.where(behind[..., None], B, A).astype(np.float32)
    t = np.clip((edge - xx) / bw, 0, 1)[..., None]              # 帯の中：先頭が明るく、後ろへ濃く
    shade = c * (0.82 + 0.3 * (1 - t)) + 255 * 0.10 * (1 - t)
    foam = ((edge - xx) < h * 0.012) & band                    # 先頭の白い線
    out = np.where(band[..., None], np.clip(shade, 0, 255), out)
    out[foam] = 245
    return out.astype(np.uint8)

def _slide3(A, B, t, D, dr):
    """3分割の3枚が、つながったまま、端から加速して入る（作り手の直し・2026-11-21。ばらばらに・一定の速さで入れない）。
    お手本を1コマずつ見ると：3枚はつながった1つのかたまりで、端からのびるように広がる（どの枚も最初は細く、いっしょに太くなる）。
    出だしはゆっくり加速し、着く前に速さをなめらかに落とす（急に止めない）。全体で約0.6秒。t＝今の秒、D＝全体の秒"""
    h, w = A.shape[:2]; pw = w / 3.0; out = A.copy()
    x = min(1.0, max(0.0, t / D)); X0, V0, PW = 0.55, 0.6, 2.6   # 前半は加速、後半はなめらかに速さを落として着く（どんと止めない。作り手の直し）
    u = V0 * (x / X0) ** PW if x < X0 else 1 - (1 - V0) * ((1 - x) / (1 - X0)) ** (PW * V0 / X0 * (1 - X0) / (1 - V0))
    bw = w * u; q = bw / 3.0                              # かたまり全体の幅と、1枚の幅
    if q < 1: return out
    for p in range(3):
        c = (p + 0.5) * pw; s0 = int(round(c - q / 2)); s1 = int(round(c + q / 2))   # 各枚のまん中を、細く切り出す
        x = int(round(p * q)) if dr == 'left' else int(round(w - bw + p * q))
        seg = B[:, s0:s1]; a2, b2 = max(0, x), min(w, x + seg.shape[1])
        if b2 > a2: out[:, a2:b2] = seg[:, a2 - x:b2 - x]
    return out

def _zoom(F, z, cx, cy):
    """F を (cx,cy)（0〜1）を止めたまま z 倍に寄せる"""
    from PIL import Image
    h, w = F.shape[:2]; cw, ch = w / z, h / z; x0 = min(max(0, cx * w - cw * cx), w - cw); y0 = min(max(0, cy * h - ch * cy), h - ch)
    return np.asarray(Image.fromarray(F).resize((w, h), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch)))

def _dive(A, B, x, at):
    """飛びこむ：前の場面の一点へ加速して寄り、いちばん速い所で放射状のぼかしと白い光でおおい、次の場面が少し寄った所から落ち着く。
    目線の点（at）は動かない。次の場面の主役は、同じ点の近くに置く（餌「木の回」の学び）"""
    cx, cy = at; h, w = A.shape[:2]
    if x < 0.55:
        u = (x / 0.55) ** 2.2; z = 1 + 2.2 * u; acc = np.zeros(A.shape, np.float32); n = 5
        for k in range(n): acc += _zoom(A, z * (1 + 0.10 * u * k), cx, cy)       # 寄りの向きに重ねて、放射状にぼかす
        F = acc / n; wh = u ** 1.6
    else:
        v = (x - 0.55) / 0.45; e = 1 - (1 - v) ** 2.4; z = 1.22 - 0.22 * e; acc = np.zeros(B.shape, np.float32); n = 4; bl = (1 - e) * 0.07
        for k in range(n): acc += _zoom(B, z * (1 + bl * k), cx, cy)
        F = acc / n; wh = (1 - v) ** 1.8
    yy, xx = _grid(h, w); d = np.hypot((xx - cx * w) / w, (yy - cy * h) / h); glow = np.clip(1.15 - d * 1.5, 0.25, 1)[..., None]   # まん中ほど白い
    return np.clip(F + (255 - F) * wh * glow, 0, 255).astype(np.uint8)

def apply(prev, cur, out, tr, crf='20'):
    """prev の最後のコマから、cur の頭の d 秒でつなぐ。out に書く（cur と同じ長さ）"""
    w, h, fps = _probe(cur); k = tr.get('k', 'push'); n = max(2, int(round(float(tr.get('d', 0.7)) * fps)))
    last = None
    for f in _frames(prev, *_probe(prev)[:2]): last = f
    if last is None: raise RuntimeError('前の場面が読めない：' + prev)
    if last.shape[:2] != (h, w):
        from PIL import Image
        last = np.asarray(Image.fromarray(last).resize((w, h)))
    enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-',
                            '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', str(crf), '-pix_fmt', 'yuv420p', '-r', str(fps), out], stdin=subprocess.PIPE)
    for i, B in enumerate(_frames(cur, w, h)):
        if i < n:
            u = _ease((i + 1) / (n + 1))
            if k == 'push': F = _push(last, B, u, tr.get('dir', 'left'))
            elif k == 'shrink': F = _shrink(last, B, u, tr.get('to', [0.5, 0.5]))
            elif k == 'open': F = _open(last, B, u, tr.get('from', [0.5, 0.5]))
            elif k == 'slide3': F = _slide3(last, B, (i + 1) / fps, n / fps, tr.get('dir', 'left'))
            elif k == 'dive': F = _dive(last, B, (i + 1) / (n + 1), tr.get('at', [0.5, 0.5]))
            elif k == 'wipe': F = _wipe(last, B, u, tr.get('col', '#3f8fca'), tr.get('dir', 'right'), i)
            else: F = B
        else: F = B
        enc.stdin.write(np.ascontiguousarray(F).tobytes())
    enc.stdin.close(); enc.wait()
    if enc.returncode: raise RuntimeError('つなぎの書き出しに失敗：' + out)
