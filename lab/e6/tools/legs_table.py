#!/usr/bin/env python3
"""E6：out/関節/<版>.json から、脚の版の比べの表（out/関節/脚の比べ.md）を作る。％は「まわり」（付け根を中心に半径 w の円）の中の体の面積に対して。"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import load
JD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'out', '関節')
names = sorted(f[:-5] for f in os.listdir(JD) if f.endswith('.json')); names.remove('L2'); names = ['L2'] + names
h = lambda v: '45超' if v is None else str(v)
L = ['| 版 | すき間 | はみ出し | 形（へこみ＋とがり） | すき間＋はみ出しの最大 | 形：前脚（手前）／前脚（奥）／後ろ脚（手前）／後ろ脚（奥） | 形が 0.5% を超えて 3 度つづく最初の角度（4 本の −／＋） | 回す前の重なり（4 本） |', '|---|---|---|---|---|---|---|---|']
for n in names:
    J = load(os.path.join(JD, n + '.json'))['joints']; A = [a for j in J for a in j['angles'].values()]
    m = lambda k: 100 * sum(a[k] for a in A) / len(A)
    per = ['%.2f' % (100 * sum(a['shape'] for a in j['angles'].values()) / 10) for j in J]
    L.append('| %s | %.2f | %.2f | **%.2f** | %.1f | %s | %s | %s |' % (n, m('gap_disc'), m('poke_disc_r'), m('shape'), 100 * max(a['D'] for a in A), '／'.join(per),
             '　'.join(h(j['hold_shape']['-']) + '／' + h(j['hold_shape']['+']) for j in J), '・'.join('%.2f' % j['overlap0'] for j in J)))
open(os.path.join(JD, '脚の比べ.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n'); print('\n'.join(L))
