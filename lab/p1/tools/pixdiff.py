#!/usr/bin/env python3
"""画素の差を測る道具。
使い方： python3 lab/p1/tools/pixdiff.py a.png b.png [--out 差の画像.png] [--gain 16]
出す数字：違う画素の割合(%)・色の差が8を超える画素の割合(%)・いちばん大きい色の差(0〜255)・平均の差
"""
import sys, json, argparse
import numpy as np
from PIL import Image


def load(p):
    return np.asarray(Image.open(p).convert('RGB'), dtype=np.int16)


def diff_arrays(a, b):
    if a.shape != b.shape:
        return {'error': '大きさが違う %s / %s' % (a.shape, b.shape)}
    d = np.abs(a - b)
    m = d.max(axis=2)
    n = m.size
    return {'diffPct': float(100.0 * np.count_nonzero(m) / n), 'over8Pct': float(100.0 * np.count_nonzero(m > 8) / n),
            'max': int(m.max()), 'mean': float(d.mean())}


def diff_image(a, b, gain=16):
    """差を強調した画像：差×gain（差が無い所は黒。少しでも違う所は必ず見える明るさにする）"""
    d = np.abs(a - b)
    v = np.clip(d * gain, 0, 255)
    v = np.where(d > 0, np.maximum(v, 60), 0)
    return Image.fromarray(v.astype(np.uint8))


def diff_files(pa, pb, out=None, gain=16):
    a, b = load(pa), load(pb)
    r = diff_arrays(a, b)
    if out and 'error' not in r:
        diff_image(a, b, gain).save(out)
    return r


def fmt(r):
    if r is None:
        return '—'
    if 'error' in r:
        return r['error']
    if r['diffPct'] == 0:
        return '同じ'
    return '%.3f%% / %.4f%% / %d' % (r['diffPct'], r['over8Pct'], r['max'])


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('a'); ap.add_argument('b'); ap.add_argument('--out'); ap.add_argument('--gain', type=int, default=16)
    x = ap.parse_args()
    r = diff_files(x.a, x.b, x.out, x.gain)
    print(json.dumps(r, ensure_ascii=False))
    print('違う画素 / はっきり違う(>8) / いちばん大きい差：', fmt(r))
