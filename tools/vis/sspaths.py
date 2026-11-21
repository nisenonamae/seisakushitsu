"""置き場所とフォントを、この作業場（Linux）でも Mac でも同じ書き方で探す（2026-11-21・Mac で書き出せるように）

- SS_HOME：声の型・フォント・控え（キャッシュ）の置き場所。
  ふつうは、この作業場なら /home/claude/vv、Mac などなら ~/.seisaku
- フォント：Linux は /usr/share/fonts の Noto Sans CJK、無ければ SS_HOME/fonts の Noto Sans JP（tools/setup_fonts.sh が入れる）
"""
import os, glob

HOME = os.environ.get('SS_HOME') or ('/home/claude/vv' if os.path.isdir('/home/claude') else os.path.expanduser('~/.seisaku'))
FONTS = os.path.join(HOME, 'fonts')
CACHE = os.path.join(HOME, 'cache')
for _d in (HOME, FONTS, CACHE):
    os.makedirs(_d, exist_ok=True)

_SYS = ['/usr/share/fonts/opentype/noto/NotoSansCJK-{w}.ttc', '/usr/share/fonts/noto-cjk/NotoSansCJK-{w}.ttc']
_MAC = ['/Library/Fonts/NotoSansCJKjp-{w}.otf', os.path.expanduser('~/Library/Fonts/NotoSansCJKjp-{w}.otf'),
        os.path.expanduser('~/Library/Fonts/NotoSansJP-{w}.ttf'), '/Library/Fonts/NotoSansJP-{w}.ttf']


def jpfont(weight='Bold'):
    """Noto Sans の日本語フォントのファイル（Regular・Medium・Bold・Black）"""
    cand = [p.format(w=weight) for p in _SYS] + [os.path.join(FONTS, f'NotoSansJP-{weight}.ttf')] + [p.format(w=weight) for p in _MAC]
    for p in cand:
        if os.path.exists(p):
            return p
    # 太さが無ければ近い太さで
    for w in {'Black': ['Bold'], 'Medium': ['Regular', 'Bold'], 'Regular': ['Medium'], 'Bold': ['Black', 'Medium']}.get(weight, []):
        for p in [q.format(w=w) for q in _SYS] + [os.path.join(FONTS, f'NotoSansJP-{w}.ttf')]:
            if os.path.exists(p):
                return p
    raise SystemExit(f'日本語のフォント（Noto Sans {weight}）がありません。bash tools/setup_fonts.sh を先に流してください')
