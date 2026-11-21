#!/usr/bin/env python3
"""その頼みごとで「読む決まり」だけを出す（決まりごとが増えても、読む量が増えないように。2026-11-21）。

  python3 tools/rules_for.py <頼みごとの種類> [--tags 地図を使う回,題材：車] [--data <data.json>] [--all]

決まりごと（data.json の rules）には段が付いている：
  tier「部品」… 部品・道具の既定に入れる決まり（tdone が true なら、もう入っているので読まない）
  tier「機械」… 機械で点検する決まり（tdone が true なら lint_shots.py などが見ているので読まない）
  tier「読む」… 判断が要る決まり。tag（読む場面）が合うものだけ読む
  段のない決まり（新しく足されたもの）は、仕分けるまで毎回読む
まだ入っていない部品・機械の決まり（tdone が false）は、入るまでは読む。

読む場面の札（tag）：
  いつも読む … いつも／カット割り／絵を描く／肉付け／構成／サムネ／題名／音／題材探し など、作業の名前
  その回だけ … 「〜回」「題材：〜」「〜を描く（立体・時間の経過 など）」「直すとき」「図解の案を出すとき」。--tags で指定する
"""
import argparse, json, os, sys
ap = argparse.ArgumentParser()
ap.add_argument('kind')
ap.add_argument('--tags', default='')
ap.add_argument('--data', default='')
ap.add_argument('--all', action='store_true', help='段に関係なく、当たる決まりを全部出す')
a = ap.parse_args()
data = a.data
if not data:
    for c in ('/home/claude/notion-daily', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'notion-daily')):
        p = os.path.join(c, 'roadmap/apps/seisakushitsu/data.json')
        if os.path.exists(p): data = p; break
if not data: sys.exit('data.json が見つかりません（--data で指定）')
d = json.load(open(data, encoding='utf-8'))

# 頼みごと → 当たる scope と、いつも読む作業の札
JOB = {
    'video': (['動画', '図解'], ['カット割り', '絵を描く']),
    'visual': (['図解'], ['絵を描く']),
    'flesh': (['肉付け'], ['肉付け']),
    'outline': (['構成'], ['構成']),
    'thumb': (['サムネ'], ['サムネ']),
    'title': (['題名'], ['題名']),
    'sound': (['音'], ['音']),
    'gather': (['参考集め'], ['参考集め']),
    'pick': (['題材探し'], ['題材探し']),
    'summary': ([], []), 'digest': ([], []),
}
ALIAS = {'video_make': 'video', 'video_fix': 'video', 'rebuild': 'video', 'final_render': 'video',
         'visual_ideas': 'visual', 'visual_make': 'visual', 'visual_fix': 'visual', 'visual_redesign': 'visual',
         'flesh_fix': 'flesh', 'flesh_sync': 'flesh', 'outline_fix': 'outline',
         'thumb_ideas': 'thumb', 'thumb_fix': 'thumb', 'title_ideas': 'title', 'title_fix': 'title',
         'sound_ideas': 'sound', 'sound_fix': 'sound'}
k = ALIAS.get(a.kind, a.kind)
if k not in JOB: sys.exit('種類：' + '・'.join(list(JOB) + list(ALIAS)))
scopes, work = JOB[k]
want = set(t for t in a.tags.replace('、', ',').split(',') if t)
def conditional(tag):
    return bool(tag) and (tag.endswith('回') or tag.startswith('題材：') or tag in ('直すとき', '図解の案を出すとき', '立体を描く', '時間の経過を見せる', '真上から見た景色'))
live = [r for r in d.get('rules', []) if not r.get('deleted') and r.get('active', True)]
read = []; skipped = {'部品': 0, '機械': 0}; later = {}
for r in live:
    tag = r.get('tag') or ''
    hit = r.get('scope') in scopes or r.get('scope') == '全部' or (tag and tag in work)
    if not hit: continue
    tier = r.get('tier')
    if not a.all and tier in ('部品', '機械') and r.get('tdone'):
        skipped[tier] += 1; continue
    # 動画の scope に入っている「肉付け」「構成」の決まりは、その作業のときに読む
    if tier and tag and not conditional(tag) and tag != 'いつも' and tag not in work and r.get('scope') != '全部' and not a.all:
        continue
    if conditional(tag) and tag not in want and not a.all:
        later[tag] = later.get(tag, 0) + 1; continue
    read.append(r)
print(f'# {a.kind} で読む決まり：{len(read)} 個（部品に入っている {skipped["部品"]}・機械が見ている {skipped["機械"]} は読まない）')
for i, r in enumerate(read, 1):
    mark = '' if r.get('tier') == '読む' else ('［仕分けまだ］' if not r.get('tier') else f'［{r["tier"]}に入れる予定・まだ］')
    tg = f'〈{r.get("tag")}〉' if r.get('tag') and r.get('tag') not in work and r.get('tag') != 'いつも' else ''
    print(f'{i}. {mark}{tg}{(r.get("when") + " → ") if r.get("when") else ""}{r["do"]}')
if later:
    print('\n# その回だけ読む決まり（当てはまるものを --tags で足す）')
    print('　' + '／'.join(f'{t}（{n}）' for t, n in sorted(later.items())))
