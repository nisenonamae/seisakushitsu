#!/usr/bin/env python3
"""E4：関節を付け根で回して、動かしたときの質を、部品の大きさにそろえた物差しで測る。
使い方：measure.py <関節の表.json> --out <名前> [--scale 1.0] [--no-sweep] [--no-sheet]
関節の表：{title, doc, joints:[{name, w?, area?, links:[{ids, pivot:[x,y], frac?}]}]}
  links が2つ以上＝つながった関節（例：首の部品 → 頭）。角度 θ を frac の割合で配る。子は親の回転も受ける。
決まり（くわしくは RESULTS.md ②）：
  w＝部品の幅（回す部品の影絵に入るいちばん大きい円の直径）。面積＝回す部品の影絵の面積。割り方を変えた版は、元の版の値を引き継ぐ。
  玉＝付け根を中心に半径 w/2 の円。まわり＝付け根を中心に半径 w の円。
  すき間（意図しない）＝回す前は体だったのに背景になった画素のうち、玉の中にある物。
  はみ出し（意図しない）＝回す前は背景だったのに体になった画素のうち、もとが「重なり代」（回す前に親の影絵の中に隠れていた所）だった物。
  意図した動き＝それ以外の、消えた・増えた画素。
  折れ＝まわりの円の中の輪郭で、幅 0.12w の弦2本のなす角が 25度以上の山のうち、回す前の折れで説明できない分の角度の合計（new_bends）。
"""
import argparse, json, math, os, sys
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *

ANGLES = [-35, -25, -15, -10, -5, 5, 10, 15, 25, 35]
TH_LO, TH_HI, TH_BEND = 0.005, 0.02, 40


def kern(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def dil(m, r): return cv2.dilate(m.astype(np.uint8), kern(r)) > 0
def ero(m, r): return cv2.erode(m.astype(np.uint8), kern(r)) > 0
def opn(m, r): return cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, kern(r)) > 0
def maxdt(m): return float(cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 5).max()) if m.any() else 0.0


def sample(mask, Minv, s, xx, yy):
    """それぞれの画素 p について、mask の Minv(p) の所の値"""
    x = (xx + 0.5) / s; y = (yy + 0.5) / s
    qx = np.floor((Minv[0] * x + Minv[2] * y + Minv[4]) * s).astype(np.int32); qy = np.floor((Minv[1] * x + Minv[3] * y + Minv[5]) * s).astype(np.int32)
    H, W = mask.shape; ok = (qx >= 0) & (qx < W) & (qy >= 0) & (qy < H)
    out = np.zeros(mask.shape, bool); out[ok] = mask[qy[ok], qx[ok]]
    return out


def peaks(mask, w, off=(0, 0)):
    """輪郭の折れの山の一覧 [(x, y, 角度)]。幅 0.12w の弦2本のなす角が 25度以上で、まわりでいちばん大きい所。w＝部品の幅（画素）"""
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    h = max(1.0, 0.03 * w); span = max(4.0, 0.12 * w); m = max(1, int(round(span / h))); sig = max(1.0, 0.03 * w) / h
    pk = []
    for c in cs:
        p = c[:, 0, :].astype(np.float64)
        if len(p) < 8: continue
        d = np.hypot(*(np.roll(p, -1, 0) - p).T); L = d.sum()
        if L < 4 * span: continue
        u = np.concatenate([[0], np.cumsum(d)]); t = np.arange(0, L, h); pc = np.vstack([p, p[:1]])
        q = np.stack([np.interp(t, u, pc[:, 0]), np.interp(t, u, pc[:, 1])], 1)
        k = int(math.ceil(3 * sig)); g = np.exp(-0.5 * (np.arange(-k, k + 1) / sig) ** 2); g /= g.sum()
        q = np.stack([np.convolve(np.concatenate([q[-k:, i], q[:, i], q[:k, i]]), g, 'valid') for i in (0, 1)], 1)
        if len(q) < 4 * m: continue
        v1 = q - np.roll(q, m, 0); v2 = np.roll(q, -m, 0) - q
        a = np.abs(np.degrees(np.arctan2(v1[:, 0] * v2[:, 1] - v1[:, 1] * v2[:, 0], (v1 * v2).sum(1))))
        N = len(a)
        for i in np.where(a >= 25)[0]:
            win = a[np.arange(i - m, i + m + 1) % N]
            if a[i] >= win.max():
                x, y = q[i][0] + off[0], q[i][1] + off[1]
                if any(abs(x - X) + abs(y - Y) < span for X, Y, _ in pk): continue
                pk.append((x, y, float(a[i])))
    return pk


def new_bends(pk0, pk1, invs, s, ws, in_disc):
    """回したあとの折れ pk1 のうち、回す前の折れ pk0 で説明できない分。
    ①同じ場所（動かない側の角）か、回す前の場所（部品といっしょに回った角）に、回す前の折れがあれば、増えた角度だけ数える
    ②残った折れは、消えた折れ（つなぎ目がすべって場所が変わった角）と 0.6w までの近さで組にして、増えた角度だけ数える
    ③どれとも組にならない折れは、角度をそのまま数える。返す：(合計の角度, 40度以上の数, [(x,y,増えた角度)])"""
    tol = max(3.0, 0.15 * ws); used = set(); rest = []; out = []
    for (x, y, a) in pk1:
        if not in_disc(x, y): continue
        cands = [(x, y)] + [(apply(Mi, [x / s, y / s])[0] * s, apply(Mi, [x / s, y / s])[1] * s) for Mi in invs]
        best = None
        for i, (X, Y, A) in enumerate(pk0):
            if i in used: continue
            d = min(math.hypot(X - cx, Y - cy) for cx, cy in cands)
            if d <= tol and (best is None or d < best[0]): best = (d, i)
        if best: used.add(best[1]); inc = a - pk0[best[1]][2]; out.append((x, y, max(0.0, inc)))
        else: rest.append((x, y, a))
    for (x, y, a) in sorted(rest, key=lambda t: -t[2]):
        best = None
        for i, (X, Y, A) in enumerate(pk0):
            if i in used: continue
            d = math.hypot(X - x, Y - y)
            if d <= 0.6 * ws and (best is None or d < best[0]): best = (d, i)
        if best: used.add(best[1]); out.append((x, y, max(0.0, a - pk0[best[1]][2])))
        else: out.append((x, y, a))
    out = [o for o in out if o[2] >= 10]
    return sum(o[2] for o in out), sum(o[2] >= 40 for o in out), out


def measure_joint(P, j, s, sweep=True, tiles=None):
    links = j['links']; ids_all = sorted({i for l in links for i in l['ids']})
    M0k = [P.mask(only=l['ids'], scale=s) for l in links]
    S = P.mask(**{'except': ids_all, 'scale': s})
    M0 = np.any(M0k, 0); R = S | M0; H, W = R.shape
    w = j.get('w') or 2 * maxdt(M0) / s; area = j.get('area') or float(M0.sum()) / s / s
    ws = w * s
    piv = [np.array(l['pivot'], float) * s for l in links]
    # 切り出す箱（速くするため）
    ys, xs = np.nonzero(M0); reach = max(np.hypot(xs - p[0], ys - p[1]).max() for p in piv) + 4
    reach = max(reach, 1.6 * ws)
    x0 = int(max(0, min(p[0] for p in piv) - reach)); x1 = int(min(W, max(p[0] for p in piv) + reach)); y0 = int(max(0, min(p[1] for p in piv) - reach)); y1 = int(min(H, max(p[1] for p in piv) + reach))
    sl = (slice(y0, y1), slice(x0, x1)); yy, xx = np.mgrid[0:H, 0:W]
    ball = np.zeros((H, W), bool); disc = np.zeros((H, W), bool)
    for p in piv:
        d2 = (xx + 0.5 - p[0]) ** 2 + (yy + 0.5 - p[1]) ** 2; ball |= d2 <= (ws / 2) ** 2; disc |= d2 <= ws ** 2
    A_disc = float((R & disc).sum()); tol = max(1, int(round(1.5 * s)))
    excl = []
    for k in range(len(links)):
        other = S.copy()
        for kk in range(len(links)):
            if kk != k: other |= M0k[kk]
        excl.append(dil(M0k[k] & ~other, tol))
    def crop(m): return m[y0:y1, x0:x1]
    pk0 = peaks(crop(R), ws, (x0, y0))
    rk = max(2, int(round(0.1 * ws))); dc = crop(disc)
    def thin(m):
        """細いへこみ（ふくらませて ちぢめると埋まる所）と、細いとがり（ちぢめて ふくらませると消える所）。太さ 0.2w まで。まわりの円の中"""
        c = np.pad(crop(m), rk + 2); u = c.astype(np.uint8)
        no = (cv2.morphologyEx(u, cv2.MORPH_CLOSE, kern(rk)) > 0) & ~c; sp = c & ~(cv2.morphologyEx(u, cv2.MORPH_OPEN, kern(rk)) > 0)
        cut = lambda a: a[rk + 2:-rk - 2, rk + 2:-rk - 2] & dc
        return cut(no), cut(sp)
    no0, sp0 = thin(R); n0 = float(no0.sum()); s0 = float(sp0.sum())
    def in_disc(x, y): return any((x - p[0]) ** 2 + (y - p[1]) ** 2 <= ws * ws for p in piv)
    ov0 = 2 * maxdt(M0 & S) / ws

    def at(deg, full):
        mats = link_mats(links, deg)
        Mt = P.mask(only=ids_all, xf=[{'ids': l['ids'], 'M': T} for l, T in zip(links, mats)], scale=s)
        F = S | Mt; lost = R & ~F; gain = F & ~R
        gi = np.zeros((H, W), bool)
        if gain.any():
            for k, T in enumerate(mats): gi |= sample(excl[k], inv(T), s, xx, yy)
        pokeD = opn(gain & ~gi, tol); gapD = opn(lost & ball, tol)
        r = dict(gap=float(gapD.sum()), poke=float(pokeD.sum()), poke_disc=float((pokeD & disc).sum()))
        r['D'] = (r['gap'] + r['poke_disc']) / A_disc
        b = new_bends(pk0, peaks(crop(F), ws, (x0, y0)), [inv(T) for T in mats], s, ws, in_disc)
        r['bend'] = round(b[0], 1); r['corners'] = int(b[1])
        no1, sp1 = thin(F); r['notch'] = max(0.0, float(no1.sum()) - n0) / A_disc; r['spur'] = max(0.0, float(sp1.sum()) - s0) / A_disc; r['shape'] = r['notch'] + r['spur']
        if not full: return r
        r.update(lost=float(lost.sum()), gain=float(gain.sum()),
                 gap_part=r['gap'] / (area * s * s), poke_part=r['poke'] / (area * s * s),
                 gap_disc=r['gap'] / A_disc, poke_disc_r=r['poke_disc'] / A_disc,
                 iou=iou(R, F), xor_disc=float(((R ^ F) & disc).sum()) / A_disc,
                 overlap=2 * maxdt(Mt & S) / ws)
        if tiles is not None:
            im = np.full((H, W, 3), 255, np.uint8)
            im[S] = (212, 212, 212); im[Mt] = (160, 160, 168); im[Mt & S] = (186, 186, 190)
            sub = im[y0:y1, x0:x1]; sub[no1 & ~no0] = (255, 235, 90); sub[sp1 & ~sp0] = (120, 60, 200)
            im[lost] = (170, 205, 255); im[gain] = (165, 215, 165); im[gapD] = (235, 25, 25); im[pokeD] = (255, 135, 0)
            tiles.append((deg, im, b[2]))
        return r

    res = dict(name=j['name'], w=round(w, 1), area=round(area), A_disc=round(A_disc / s / s), pivots=[l['pivot'] for l in links], overlap0=round(ov0, 3), angles={})
    for a in ANGLES: res['angles']['%+d' % a] = at(a, True)
    if sweep:
        for key in ('hold_lo', 'hold_hi', 'hold_bend', 'hold_shape'): res[key] = {}
        for sg in (+1, -1):
            lo = hi = hb = hs = None; bs = []; ss = []
            for a in range(1, 46):
                q = at(sg * a, False); D = q['D']; bs.append(q['bend']); ss.append(q['shape'])
                if lo is None and D >= TH_LO: lo = a
                if hi is None and D >= TH_HI: hi = a
            for i in range(len(bs)):      # 折れ：40度以上が3度つづいた最初の角度（1度だけの跳ねは数えない）
                if all(b >= TH_BEND for b in bs[i:i + 3]) and len(bs[i:i + 3]) == 3: hb = i + 1; break
            for i in range(len(ss)):
                if all(v >= TH_LO for v in ss[i:i + 3]) and len(ss[i:i + 3]) == 3: hs = i + 1; break
            k = '+' if sg > 0 else '-'; res['hold_shape'][k] = hs
            res['hold_lo'][k] = lo; res['hold_hi'][k] = hi; res['hold_bend'][k] = hb
    res['_view'] = dict(piv=[p.tolist() for p in piv], ws=ws)
    return res


def tile_img(im, pk, piv, ws, size=132):
    """付け根を中心に、1辺 3.2w の正方形を切り出す"""
    cx = sum(p[0] for p in piv) / len(piv); cy = sum(p[1] for p in piv) / len(piv); half = 1.6 * ws + (max(abs(p[0] - cx) for p in piv) if len(piv) > 1 else 0)
    H, W = im.shape[:2]; pad = int(half) + 2
    big = np.full((H + 2 * pad, W + 2 * pad, 3), 255, np.uint8); big[pad:pad + H, pad:pad + W] = im
    x0 = int(round(cx - half)) + pad; y0 = int(round(cy - half)) + pad; n = int(round(2 * half))
    t = Image.fromarray(big[y0:y0 + n, x0:x0 + n]).resize((size, size), Image.LANCZOS if n > size else Image.NEAREST)
    k = size / n; d = ImageDraw.Draw(t)
    for p in piv:
        px = (p[0] + pad - x0) * k; py = (p[1] + pad - y0) * k
        for r, col in ((ws / 2, (200, 60, 60)), (ws, (120, 120, 120))): d.ellipse((px - r * k, py - r * k, px + r * k, py + r * k), outline=col)
        d.ellipse((px - 2, py - 2, px + 2, py + 2), fill=(200, 0, 0))
    for x, y, a in pk:
        if a >= 25: X = (x + pad - x0) * k; Y = (y + pad - y0) * k; d.rectangle((X - 2, Y - 2, X + 2, Y + 2), outline=(0, 60, 220))
    return t


def pct(x): return '%.1f' % (100 * x)
def hold(v): return '45超' if v is None else '%d' % v


def run(spec_path, out, scale=1.0, sweep=True, sheet=True):
    spec = load(spec_path); doc = load(os.path.join(os.path.dirname(os.path.abspath(spec_path)), spec['doc']))
    rows = []; ims = []
    with Page() as P:
        P.setdoc(doc)
        for j in spec['joints']:
            tl = [] if sheet else None
            r = measure_joint(P, j, scale, sweep, tl); v = r.pop('_view'); rows.append(r)
            if sheet:
                T = 132
                head = Image.new('RGB', (T + 40, T), 'white'); d = ImageDraw.Draw(head)
                txt = [j['name'], '幅 w=%d' % r['w'], '重なり %.2f' % r['overlap0']]
                if sweep: txt += ['面 −%s／＋%s度' % (hold(r['hold_lo']['-']), hold(r['hold_lo']['+'])), '形 −%s／＋%s度' % (hold(r['hold_shape']['-']), hold(r['hold_shape']['+'])), '折れ −%s／＋%s度' % (hold(r['hold_bend']['-']), hold(r['hold_bend']['+']))]
                for i, t in enumerate(txt): d.text((2, 2 + i * 19), t, fill='black', font=font(13 if i else 15))
                row = [head]
                for deg, im, pk in tl:
                    a = r['angles']['%+d' % deg]
                    row.append(label(tile_img(im, pk, v['piv'], v['ws'], T), '%+d°す%s は%s 形%s 折%d' % (deg, pct(a['gap_disc']), pct(a['poke_disc_r']), pct(a['shape']), a['bend']), 11, 17))
                hh = max(i.height for i in row); strip = Image.new('RGB', (sum(i.width for i in row) + 3 * len(row), hh), 'white'); x = 0
                for i in row: strip.paste(i, (x, 0)); x += i.width + 3
                ims.append(strip)
            print(' ', j['name'], 'w', r['w'], '面', r.get('hold_lo'), r.get('hold_hi'), '折れ', r.get('hold_bend'), '形', r.get('hold_shape'), [round(100 * r['angles'][k]['shape'], 1) for k in r['angles']], flush=True)
    save(out + '.json', dict(title=spec.get('title'), scale=scale, th_lo=TH_LO, th_hi=TH_HI, joints=rows))
    if sheet:
        Wd = max(i.width for i in ims); cap = 44
        sh = Image.new('RGB', (Wd, cap + sum(i.height + 3 for i in ims)), 'white'); d = ImageDraw.Draw(sh)
        d.text((4, 2), spec.get('title', ''), fill='black', font=font(17))
        d.text((4, 25), '赤＝すき間（玉の中で体が消えた）　橙＝はみ出し（隠れていた重なり代が外へ）　水色＝動いて空いた所　緑＝動いて増えた所　赤い円＝玉（半径 w/2）　灰の円＝まわり（半径 w）　青い四角＝新しい折れ（25度以上）　す・は・形（細いへこみ＋とがりの増え）＝「まわり」の体の面積に対する％　折＝新しい折れの角度の合計　左の「面」「折れ」＝壊れ始める角度', fill='black', font=font(12))
        y = cap
        for i in ims: sh.paste(i, (0, y)); y += i.height + 3
        sh.convert('P', palette=Image.ADAPTIVE, colors=64).save(out + '.png', optimize=True)
    return rows


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('spec'); ap.add_argument('--out', required=True); ap.add_argument('--scale', type=float, default=1.0); ap.add_argument('--no-sweep', action='store_true'); ap.add_argument('--no-sheet', action='store_true')
    a = ap.parse_args(); run(a.spec, a.out, a.scale, not a.no_sweep, not a.no_sheet)
