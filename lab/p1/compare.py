#!/usr/bin/env python3
"""作り手の端末から届いた結果のファイルを、書き出しの側の絵と比べる。
使い方： python3 lab/p1/compare.py <届いた p1-result-….zip か .json> [--ref /tmp/p1/out/default] [--out /tmp/p1/compare/<名前>]
- 書き出しの側の絵（--ref）が無ければ、先に tools/export.py を流して作る
- zip：場面ごとに、届いた絵と書き出しの絵の差（違う画素・いちばん大きい差）を出し、差を強調した画像と一覧の画像を作る
- json（数字だけ）：ハッシュが同じかどうかだけを出す
届いたファイルは信用しない：決まった名前の PNG と info.json だけを、中身として読む（展開して実行はしない）。
"""
import os, sys, re, io, json, zipfile, argparse, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'tools'))
from pixdiff import diff_arrays, diff_image, fmt
import numpy as np
from PIL import Image, ImageDraw, ImageFont

NAMES = {'text': '① 字', 'edges': '② ふち', 'blur': '③ ぼかし', 'blend': '④ 合成とマスク', 'grad': '⑤ グラデーション',
         'image': '⑥ 画像', 'stroke': '⑦ 線', 'kz': '⑧ 小さな場面', 'heavy': '⑨ 重い場面'}
KINDS = ['r1', 'r1cpu', 'r2gpu', 'r2cpu']
KN = {'r1': 'R1', 'r1cpu': 'R1(CPU設定)', 'r2gpu': 'R2 GPU', 'r2cpu': 'R2 CPU'}
OK = re.compile(r'^([a-z0-9]+)__([a-z0-9_]+)\.png$')


def font(sz):
    for p in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc']:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file'); ap.add_argument('--ref', default='/tmp/p1/out/default'); ap.add_argument('--out')
    x = ap.parse_args()
    name = os.path.splitext(os.path.basename(x.file))[0]
    out = x.out or os.path.join('/tmp/p1/compare', name)
    os.makedirs(out, exist_ok=True)
    refjson = json.load(open(os.path.join(HERE, 'reference.json')))
    imgs = {}
    if x.file.endswith('.json'):
        info = json.load(open(x.file))
    else:
        z = zipfile.ZipFile(x.file)
        info = json.loads(z.read('info.json').decode('utf-8'))
        for n in z.namelist():
            m = OK.match(n)
            if m and z.getinfo(n).file_size < 30_000_000:
                imgs[(m.group(1), m.group(2))] = np.asarray(Image.open(io.BytesIO(z.read(n))).convert('RGB'), dtype=np.int16)
        if not os.path.exists(os.path.join(x.ref, 'kz__r2cpu.png')):
            print('書き出しの側の絵が無いので、先に作ります（2〜4分）…')
            subprocess.run([sys.executable, os.path.join(HERE, 'tools', 'export.py'), '--configs', 'default', '--out', os.path.dirname(x.ref)], check=True)
    d = info.get('device') or {}
    L = ['# 届いた結果と、書き出しの側の比べ：' + name, '',
         '- 端末：`%s`' % d.get('userAgent'), '- 画面の GPU：`%s`' % ((d.get('gl') or {}).get('renderer')),
         '- 拡大率 %s・コア %s・メモリ %s GB・ぼかしの機能 %s' % (d.get('dpr'), d.get('cores'), d.get('memGB'), d.get('canvasFilter')),
         '- CanvasKit の読みこみ：%s ms' % (info.get('load') or {}).get('canvaskitMs'), '- 描けなかった物：%s' % json.dumps(info.get('errors') or {}, ensure_ascii=False), '',
         '## 書き出しの側（作業場）と同じ絵か', '', '同じ描く部品どうしを比べる。数字は「違う画素 % / はっきり違う(>8) % / いちばん大きい差」。', '',
         '| 場面 | ' + ' | '.join(KN[k] for k in KINDS) + ' | 届いた R1 ↔ 書き出しの R2 CPU |', '|---|' + '---|' * (len(KINDS) + 1)]
    cells = {}
    for s in NAMES:
        row = []
        for k in KINDS:
            v = ((info.get('scenes') or {}).get(s) or {}).get('kinds', {}).get(k) or {}
            if 'error' in v or not v: row.append('描けない'); continue
            same = v.get('hash') and v['hash'] == (refjson['hashes'].get(s) or {}).get(k)
            if same:
                row.append('**同じ**')
                rp = os.path.join(x.ref, '%s__%s.png' % (s, k))
                if k == 'r1' and os.path.exists(rp): imgs[(s, k)] = np.asarray(Image.open(rp).convert('RGB'), dtype=np.int16)
                continue
            if v.get('file') and (s, k) not in imgs:  # ほかの描き方と同じ絵だったので、まとめてある
                m = OK.match(v['file'])
                if m and (m.group(1), m.group(2)) in imgs: imgs[(s, k)] = imgs[(m.group(1), m.group(2))]
            if (s, k) in imgs:
                ref = np.asarray(Image.open(os.path.join(x.ref, '%s__%s.png' % (s, k))).convert('RGB'), dtype=np.int16)
                r = diff_arrays(imgs[(s, k)], ref)
                if r.get('diffPct'):
                    diff_image(imgs[(s, k)], ref).save(os.path.join(out, 'diff_%s__%s.png' % (s, k)))
                    cells[(s, k)] = (imgs[(s, k)], ref)
                row.append(fmt(r) + ('' if v.get('sameTwice', True) else '（2回で違う）'))
            else:
                row.append('違う（絵が入っていないので量は不明）')
        if (s, 'r1') in imgs:
            ref = np.asarray(Image.open(os.path.join(x.ref, '%s__r2cpu.png' % s)).convert('RGB'), dtype=np.int16)
            row.append(fmt(diff_arrays(imgs[(s, 'r1')], ref)))
        else:
            row.append('—')
        L.append('| %s | ' % NAMES[s] + ' | '.join(row) + ' |')
    L += ['', '## この端末の中での差（ページが測った物）', '', '| 場面 | R1 ↔ R1(CPU設定) | R2 GPU ↔ R2 CPU | R1(CPU設定) ↔ R2 CPU | R1 ↔ R2 GPU |', '|---|---|---|---|---|']
    for s in NAMES:
        p = ((info.get('scenes') or {}).get(s) or {}).get('pairs', {})
        L.append('| %s | ' % NAMES[s] + ' | '.join(fmt(p.get(a)) for a in ['r1_r1cpu', 'r2gpu_r2cpu', 'r1cpu_r2cpu', 'r1_r2gpu']) + ' |')
    L += ['', '## 速さ（重い場面）', '', '| 描く部品 | 画面に出しながら fps | 1コマを描く ms | いちばん長い止まり ms | 詰めて：描く ms | 詰めて：取り出す ms | 小さな場面 fps |', '|---|---|---|---|---|---|---|']
    for k in KINDS:
        sp = (info.get('speed') or {}).get(k) or {}
        f, b, kz = sp.get('fps') or {}, sp.get('bench') or {}, sp.get('kzFps') or {}
        if 'error' in f or not f: L.append('| %s | 描けない ||||||' % KN[k]); continue
        L.append('| %s | %.1f | %.1f | %.0f | %.1f | %.1f | %s |' % (KN[k], f['fps'], f['drawMs'], f['worstGapMs'], b.get('drawMs', -1), b.get('readMs', -1), ('%.1f' % kz['fps']) if 'fps' in kz else '—'))
    # 一覧の画像：違った物だけ、届いた絵・書き出しの絵・差 を並べる（多いときは先の 12 個）
    if cells:
        keys = list(cells)[:12]; tw, th = 480, 270
        sheet = Image.new('RGB', (tw * 3, (th + 26) * len(keys)), (30, 30, 30)); dr = ImageDraw.Draw(sheet); f = font(18)
        for i, (s, k) in enumerate(keys):
            a, b = cells[(s, k)]; y = i * (th + 26)
            dr.text((6, y + 2), '%s・%s：届いた絵 ／ 書き出しの絵 ／ 差（16倍に強調）' % (NAMES[s], KN[k]), fill=(255, 255, 255), font=f)
            for j, im in enumerate([Image.fromarray(a.astype(np.uint8)), Image.fromarray(b.astype(np.uint8)), diff_image(a, b)]):
                sheet.paste(im.resize((tw, th), Image.LANCZOS if j < 2 else Image.BOX), (j * tw, y + 26))
        sheet.save(os.path.join(out, 'sheet.jpg'), quality=88)
        L += ['', '一覧の画像：`%s`（差の画像は同じフォルダの `diff_*.png`）' % os.path.join(out, 'sheet.jpg')]
    open(os.path.join(out, 'compare.md'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))
    print('\n書いた：', os.path.join(out, 'compare.md'))


if __name__ == '__main__':
    main()
