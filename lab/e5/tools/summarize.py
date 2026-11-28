#!/usr/bin/env python3
"""E5：結果の表（out/結果の表.md）を、out/*.json から作る。"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
OUT = os.path.join(E4, 'out'); NAMES = [n for n in ['A', 'B', 'C', 'D', 'E', 'F', 'V6', 'P4'] if os.path.exists(os.path.join(OUT, n + '.motion.json')) and os.path.exists(os.path.join(OUT, n + '.json'))]
J8 = ['頭', '前脚（手前）', '前脚（奥）', '後ろ脚（手前）', '後ろ脚（奥）', '耳（手前）', '耳（奥）', 'しっぽ']
S = {r['name']: r for r in load(os.path.join(OUT, '止まった絵.json'))}; M1 = {n: {j['name']: j for j in load(os.path.join(OUT, n + '.json'))['joints']} for n in NAMES}; MO = {n: load(os.path.join(OUT, n + '.motion.json'))['motions'] for n in NAMES}
p = lambda x, d=2: ('%.' + str(d) + 'f') % (100 * x)
hold = lambda v: '45超' if v is None else str(v)
L = ['# E5 結果の表（tools/summarize.py が作る）', '', '％は、ことわりが無ければ「まわり」（付け根を中心に半径 w の円）の中の体の面積に対して。版：' + '／'.join('%s＝%s' % (n, (S[n]['title'] or '').split(' ', 1)[-1]) for n in NAMES), '']
L += ['## 表1 止まった絵の影絵', '', '| 版 | A との重なり（IoU） | 変わった画素 | 曲がり角の数（うち 40度以上） | 細いへこみ ％（体に対して） | 細いとがり ％ | 前脚のあいだ（幅×高さ） | 腹の下 | 後ろ脚のあいだ | 耳のあいだ | 部品 | 線 | 点 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
for n in NAMES:
    r = S[n]; g = r['gaps']; gs = ['%d×%d' % (q['width'], q['height']) for q in g]
    if len(g) == 3: f, b, h = gs
    elif len(g) == 1: f, b, h = '0（重なる）', gs[0], '0（重なる）'
    else: f = b = h = '・'.join(gs)
    L.append('| %s | %s | %s | %d（%d） | %.2f | %.2f | %s | %s | %s | %s | %d | %d | %d |' % (n, '—' if r['iou_A'] is None else '%.4f' % r['iou_A'], '—' if r['changed_px'] is None else r['changed_px'], r['corners'], r['corners_40'], r['notch'], r['spur'], f, b, h, r['ear_gap'], r['parts'], r['lines'], r['points']))
def stat(n, key, angs=None, joints=J8):
    v = [a[key] for j in joints if j in M1[n] for k, a in M1[n][j]['angles'].items() if angs is None or abs(int(k)) <= angs]
    return float(np.mean(v)) if v else float('nan')
L += ['', '## 表2 関節を1つずつ回す（8 関節の平均。下あごは入れない）', '', '| 版 | すき間（10 角度） | はみ出し | 形 | すき間＋はみ出しの最大 | 形：±15度まで（動きの表の幅に近い 6 角度） | 形：±25・±35度 |', '|---|---|---|---|---|---|---|']
for n in NAMES:
    mx = max(a['gap_disc'] + a['poke_disc_r'] for j in J8 for a in M1[n][j]['angles'].values())
    far = float(np.mean([a['shape'] for j in J8 for k, a in M1[n][j]['angles'].items() if abs(int(k)) > 15]))
    L.append('| %s | %s | %s | %s | %s | %s | %s |' % (n, p(stat(n, 'gap_disc')), p(stat(n, 'poke_disc_r')), p(stat(n, 'shape')), p(mx, 1), p(stat(n, 'shape', 15)), p(far)))
L += ['', '## 表3 形（細いへこみ＋とがりの増え）：関節ごと（10 角度の平均 ％／かっこ内は ±15度までの平均）', '', '| 関節 | ' + ' | '.join(NAMES) + ' |', '|---|' + '---|' * len(NAMES)]
for j in J8 + ['下あご']:
    L.append('| %s | ' % j + ' | '.join(('%s（%s）' % (p(stat(n, 'shape', None, [j])), p(stat(n, 'shape', 15, [j])))) if j in M1[n] else '—' for n in NAMES) + ' |')
L += ['', '## 表4 どの角度まで持つか（面＝すき間＋はみ出しが 0.5% を超える最初の角度／形が 0.5% を超えて3度つづく最初の角度。「−／＋」）', '', '| 関節 | ' + ' | '.join(NAMES) + ' |', '|---|' + '---|' * len(NAMES)]
for j in J8 + ['下あご']:
    L.append('| %s | ' % j + ' | '.join(('面 %s／%s・形 %s／%s' % (hold(M1[n][j]['hold_lo']['-']), hold(M1[n][j]['hold_lo']['+']), hold(M1[n][j]['hold_shape']['-']), hold(M1[n][j]['hold_shape']['+']))) if j in M1[n] else '—' for n in NAMES) + ' |')
for mo, ttl in (('歩く', '表5 歩く（10 コマ）'), ('首', '表6 首を振って耳としっぽが動く（6 コマ）')):
    L += ['', '## ' + ttl, '', '平均＝コマの平均（コマの値は 8 関節の平均）。悪いコマ＝すき間＋はみ出し＋形 がいちばん大きいコマ。', '', '| 版 | すき間 平均 | はみ出し 平均 | 形 平均 | 形（全身・体に対して）平均 | 中の色 平均 | 悪いコマ（番号・関節） | 悪いコマ：すき間＋はみ出し／形 | 1関節での最大：すき間＋はみ出し／形 | 影絵の変わり方（止まった絵との IoU の最小） | ぶつかり | 脚の交差（最大・体に対して） |', '|---|---|---|---|---|---|---|---|---|---|---|---|']
    for n in NAMES:
        s = MO[n][mo]['summary']; m = s['mean']; w = s['worst']
        L.append('| %s | %s | %s | %s | %s | %s | %d・%s | %s／%s | %s／%s | %.3f | %d | %s |' % (n, p(m['gap']), p(m['poke']), p(m['shape']), p(m['shape_all'], 3), p(m['inner']), s['worst_frame'], s['worst_joint'], p(w['gap'] + w['poke']), p(w['shape']), p(s['max']['D_max']), p(s['max']['shape_max']), s['iou_min'], s['bumps'], p(s['cross_max'])))
    L += ['', '関節ごとの形（コマの平均 ％）：', '', '| 関節 | ' + ' | '.join(NAMES) + ' |', '|---|' + '---|' * len(NAMES)]
    for j in J8:
        L.append('| %s | ' % j + ' | '.join(p(float(np.mean([f['joints'][j]['shape'] for f in MO[n][mo]['frames']]))) for n in NAMES) + ' |')
open(os.path.join(OUT, '結果の表.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n'); print('\n'.join(L))
