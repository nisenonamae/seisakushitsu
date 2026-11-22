#!/usr/bin/env python3
"""実物帳・好み帳のコマを1枚にまとめる（2026-11-22）。見る役・選ぶ役に渡すときも、これで1枚にする（トークンの節約）。
使い方： python3 tools/refs_sheet.py <出力.png> [--kind カバ,骨] [--tags 真上,群れ] [--book jitsubutsu|liked] [--max 12]
  --tags はどれか1つが合えば入れる。左上に番号、下に「種類・メモ」。番号と出どころの対応は出力.txt に書く"""
import os, sys, json, argparse
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)

def font(sz):
    sys.path.insert(0, os.path.join(HERE, 'vis'))
    try:
        import sspaths
        for nm in ('FONT_BOLD', 'FB', 'FONT'):
            f = getattr(sspaths, nm, None)
            if f and os.path.exists(str(f)): return ImageFont.truetype(str(f), sz)
    except Exception: pass
    for root in ('/usr/share/fonts', '/Library/Fonts', '/System/Library/Fonts'):
        for d, _, fs in os.walk(root):
            for f in fs:
                if any(k in f for k in ('NotoSansCJK', 'NotoSansJP', 'BIZUDGothic', 'Hiragino')):
                    try: return ImageFont.truetype(os.path.join(d, f), sz)
                    except Exception: pass
    return ImageFont.load_default()

def pick(book, kinds, tags, mx):
    B = os.path.join(ROOT, 'docs', 'refs', book); D = json.load(open(os.path.join(B, 'index.json'), encoding='utf-8'))
    it = [x for x in D['items'] if (not kinds or x['kind'] in kinds) and (not tags or set(tags) & set(x.get('tags', [])))]
    return [(os.path.join(B, x['file']), x) for x in it][:mx]

def sheet(items, out, cols=4, w=400):
    h = w * 9 // 16; F = font(15); rows = (len(items) + cols - 1) // cols
    S = Image.new('RGB', (cols * (w + 6), rows * (h + 30)), 'white'); d = ImageDraw.Draw(S); lines = []
    for i, (p, x) in enumerate(items):
        im = Image.open(p).convert('RGB'); im.thumbnail((w, h)); X, Y = (i % cols) * (w + 6), (i // cols) * (h + 30)
        S.paste(im, (X + (w - im.width) // 2, Y + (h - im.height) // 2))
        d.rectangle([X, Y, X + 30, Y + 20], fill='black'); d.text((X + 5, Y + 1), str(i + 1), fill='white', font=F)
        d.text((X + 2, Y + h + 5), f"{x['kind']}・{x.get('note', '')}"[:30], fill='black', font=F)
        lines.append(f"{i + 1}. {x['kind']}｜{x.get('note', '')}｜{x.get('title', x.get('file'))}｜{x.get('license', '')}｜{x.get('src', '')}")
    S.save(out); open(os.path.splitext(out)[0] + '.txt', 'w', encoding='utf-8').write('\n'.join(lines) + '\n'); return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--kind', default=''); ap.add_argument('--tags', default=''); ap.add_argument('--book', default='jitsubutsu'); ap.add_argument('--max', type=int, default=12)
    a = ap.parse_args(); its = pick(a.book, [k for k in a.kind.split(',') if k], [t for t in a.tags.split(',') if t], a.max)
    if not its: sys.exit('合うコマがありません')
    print(sheet(its, a.out), len(its), '枚')
