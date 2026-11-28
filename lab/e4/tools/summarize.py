#!/usr/bin/env python3
"""E4：out/*.json（measure.py の結果）を、版 × 関節 × 角度 の表（out/結果の表.md）にまとめる。"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
O = os.path.join(E4, 'out')
VS = [('v1_e2', '1 今のまま'), ('v2_deep', '2 重なり深く'), ('v3_split', '3 割る場所'), ('v4_round', '4 丸く受ける'), ('v5_pivot_in', '5 付け根を玉の深さへ'), ('v5x_pivot_edge', '5x 付け根を端に'), ('v6_round_in', '6 丸く＋付け根'), ('p4_ai_bbox', 'P4（囲みの決まり）'), ('p4_ai_ball', 'P4（玉の深さ）')]
JS = ['頭', '前脚（手前）', '前脚（奥）', '後ろ脚（手前）', '後ろ脚（奥）', '耳（手前）', '耳（奥）', 'しっぽ']
AN = ['-35', '-25', '-15', '-10', '-5', '+5', '+10', '+15', '+25', '+35']
D = {k: {(j['name'][:1] == '頭' and '頭' or j['name']): j for j in load(os.path.join(O, k + '.json'))['joints']} for k, _ in VS}
h = lambda v: '45超' if v is None else str(v)
hp = lambda d: '%s／%s' % (h(d['-']), h(d['+']))
L = ['# 結果の表（tools/summarize.py が作る。数字の決まりは RESULTS.md ②）', '',
     '角度の＋は、画面で時計回り（頭なら鼻が上がる・脚なら足先が前〔左〕へ）。「−／＋」の順。', '',
     '## 表1　どの角度まで持つか（1度きざみで 45度まで）',
     '面＝すき間＋はみ出しが「まわり」の体の 0.5% を超える最初の角度。形＝細いへこみ・とがりの増えが 0.5% を超えて3度つづく最初の角度。折れ＝新しい折れの合計が 40度を超えて3度つづく最初の角度。「45超」＝45度まで超えない。', '']
for key, ttl in (('hold_lo', '面（0.5%）'), ('hold_hi', '面（2%）'), ('hold_shape', '形'), ('hold_bend', '折れ')):
    L += ['### ' + ttl, '', '| 関節 | ' + ' | '.join(t for _, t in VS) + ' |', '|---|' + '---|' * len(VS)]
    for j in JS + ['ひざ・前脚（手前）', 'ひざ・後ろ脚（手前）']:
        L.append('| %s | ' % j + ' | '.join(hp(D[k][j][key]) if j in D[k] else '—' for k, _ in VS) + ' |')
    L.append('')
L += ['## 表2　版ごとのまとめ（8つの関節 × 10の角度の平均。ひざは入れない）',
      'すき間・はみ出し・形・影絵の差は「まわり」の体の面積に対する％。折れは度。重なり＝回す前の、親との重なりに入るいちばん大きい円の直径 ÷ w。', '',
      '| 版 | すき間 | はみ出し | 形（へこみ＋とがり） | 新しい折れ | すき間＋はみ出しの最大 | 重なり | 影絵の IoU（±35の平均） |', '|---|---|---|---|---|---|---|---|']
SUM = {}
for k, t in VS:
    c = [D[k][j]['angles'][a] for j in JS for a in AN]; m = lambda f: sum(f(x) for x in c) / len(c)
    SUM[k] = dict(gap=m(lambda x: x['gap_disc']), poke=m(lambda x: x['poke_disc_r']), shape=m(lambda x: x['shape']), bend=m(lambda x: x['bend']))
    L.append('| %s | %.2f | %.2f | %.2f | %.0f | %.1f | %.2f | %.3f |' % (t, 100 * SUM[k]['gap'], 100 * SUM[k]['poke'], 100 * SUM[k]['shape'], SUM[k]['bend'], 100 * max(x['D'] for x in c),
             sum(D[k][j]['overlap0'] for j in JS) / 8, sum(D[k][j]['angles'][a]['iou'] for j in JS for a in ('-35', '+35')) / 16))
L += ['', '## 表3　関節ごと・版ごとのまとめ（10の角度の平均）', 'それぞれ「すき間＋はみ出し％／形％／新しい折れ（度）」', '', '| 関節 | ' + ' | '.join(t for _, t in VS) + ' |', '|---|' + '---|' * len(VS)]
for j in JS + ['ひざ・前脚（手前）', 'ひざ・後ろ脚（手前）']:
    cells = []
    for k, _ in VS:
        if j not in D[k]: cells.append('—'); continue
        c = [D[k][j]['angles'][a] for a in AN]; cells.append('%.2f／%.2f／%.0f' % (100 * sum(x['D'] for x in c) / 10, 100 * sum(x['shape'] for x in c) / 10, sum(x['bend'] for x in c) / 10))
    L.append('| %s | ' % j + ' | '.join(cells) + ' |')
L += ['', '## 表4　版 × 関節 × 角度', 'それぞれ「すき間％／はみ出し％／形％／新しい折れ（度）」。％は「まわり」の体の面積に対して。部品の面積に対する割合・IoU・まわりの差・重なりの残りは out/*.json。', '']
for j in JS + ['ひざ・前脚（手前）', 'ひざ・後ろ脚（手前）']:
    L += ['### ' + j, '', '| 版 | w | ' + ' | '.join(a + '°' for a in AN) + ' |', '|---|---|' + '---|' * len(AN)]
    for k, t in VS:
        if j not in D[k]: continue
        q = D[k][j]; L.append('| %s | %d | ' % (t, q['w']) + ' | '.join('%.1f／%.1f／%.1f／%.0f' % (100 * q['angles'][a]['gap_disc'], 100 * q['angles'][a]['poke_disc_r'], 100 * q['angles'][a]['shape'], q['angles'][a]['bend']) for a in AN) + ' |')
    L.append('')
open(os.path.join(O, '結果の表.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n'); print('\n'.join(L[:L.index('## 表4　版 × 関節 × 角度')]))
