#!/usr/bin/env python3
"""書き出しの側の結果（export.py が作った /tmp/p1/out）から、数字の表（Markdown）を出す。
使い方： python3 lab/p1/tools/report.py [--out /tmp/p1/out]
"""
import os, sys, json, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixdiff import diff_files, fmt

NAMES = {'text': '① 字', 'edges': '② ふち', 'blur': '③ ぼかし', 'blend': '④ 合成とマスク', 'grad': '⑤ グラデーション',
         'image': '⑥ 画像', 'stroke': '⑦ 線', 'kz': '⑧ 小さな場面', 'heavy': '⑨ 重い場面'}
KN = {'r1': 'R1', 'r1cpu': 'R1(CPU設定)', 'r2gpu': 'R2 GPU', 'r2cpu': 'R2 CPU'}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default='/tmp/p1/out'); x = ap.parse_args()
    res = json.load(open(os.path.join(x.out, 'export.json')))
    cfgs = [c for c in res['configs'] if 'scenes' in res['configs'][c]]
    d0 = res['configs']['default']
    P = lambda c, s, k: os.path.join(x.out, c, '%s__%s.png' % (s, k))
    print('### 描く部品どうしの差（default の設定。違う画素 % / はっきり違う(>8) % / いちばん大きい差）\n')
    pairs = [('r1', 'r1cpu'), ('r1', 'r2cpu'), ('r1', 'r2gpu'), ('r2gpu', 'r2cpu')]
    print('| 場面 | ' + ' | '.join('%s ↔ %s' % (KN[a], KN[b]) for a, b in pairs) + ' |\n|---|' + '---|' * len(pairs))
    for s in d0['scenes']:
        print('| %s | ' % NAMES[s] + ' | '.join(fmt(diff_files(P('default', s, a), P('default', s, b))) for a, b in pairs) + ' |')
    print('\n### 起動の設定を変えたときの差（default の絵と比べる。同じ描く部品どうし）\n')
    for c in cfgs:
        g = res['configs'][c]['device'].get('gl') or {}
        print('- `%s`：%s ／ WebGL＝%s' % (c, ' '.join(res['configs'][c]['args']) or '（なし）', g.get('renderer')))
    others = [c for c in cfgs if c != 'default']
    for k in ['r1', 'r1cpu', 'r2gpu', 'r2cpu']:
        print('\n**%s**\n\n| 場面 | ' % KN[k] + ' | '.join(others) + ' |\n|---|' + '---|' * len(others))
        for s in d0['scenes']:
            row = []
            for c in others:
                a, b = d0['scenes'][s][k], res['configs'][c]['scenes'][s][k]
                if 'hash' not in a or 'hash' not in b: row.append('描けない'); continue
                row.append('同じ' if a['hash'] == b['hash'] else fmt(diff_files(P('default', s, k), P(c, s, k))))
            print('| %s | ' % NAMES[s] + ' | '.join(row) + ' |')
    print('\n### 毎回同じになったか（同じページで2回＋ページを開き直して1回）\n')
    bad = []
    n = 0
    for c in cfgs:
        for s, ks in res['configs'][c]['scenes'].items():
            for k, v in ks.items():
                if 'hash' not in v: continue
                n += 1
                if not v.get('sameTwice') or not v.get('sameReload'): bad.append((c, s, k))
    print('%d 通り（設定×場面×描く部品）のうち、違ったのは %d 通り %s' % (n, len(bad), bad if bad else ''))
    print('\n### 読みこみの時間（手元のサーバーから・裏のブラウザ）\n')
    for c in cfgs:
        l = res['configs'][c]['load']
        print('- %s：CanvasKit %.0f ms ／ 字と画像 %.0f ms' % (c, l.get('canvaskitMs', -1), l.get('assetsMs', -1)))
    if 'bench' in d0:
        print('\n### 速さ（default。1コマあたり ms。20コマの平均）\n')
        print('| 描く部品 | 重い場面：描く | 画素を取り出す | 合わせて | PNG にする | 小さな場面：描く＋取り出す |\n|---|---|---|---|---|---|')
        for k in ['r1', 'r1cpu', 'r2gpu', 'r2cpu']:
            b = d0['bench'][k]
            if 'error' in b: print('| %s | 描けない |||||' % KN[k]); continue
            print('| %s | %.0f | %.0f | **%.0f** | %.0f | %.0f |' % (KN[k], b['drawMs'], b['readMs'], b['drawMs'] + b['readMs'], b['pngMs'], b['kz']['drawMs'] + b['kz']['readMs']))
        print('\n生の画素（%d バイト）を Python まで運ぶ：%.0f ms（base64 で）' % (d0['bench']['rawBytes'], d0['bench']['rawToPythonMs']))


if __name__ == '__main__':
    main()
