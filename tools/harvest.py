"""海外の発信元の最新動画から「そのチャンネルの中で特に伸びた動画」を集める。
使い方: python3 tools/harvest.py  → tools/out/raw.json
"""
import json, statistics, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from yt_common import channel_videos, channel_shorts

here = os.path.dirname(__file__)
chs = json.load(open(os.path.join(here, 'channels.json'), encoding='utf-8'))['channels']
items = []
for ch in chs:
    try:
        vs = channel_videos(ch['id'])
        if len(vs) < 5:  # 長い動画がほとんどないチャンネルはショートを見る（並び順は新しい順）
            vs = channel_shorts(ch['id'])[:30]
    except Exception as e:
        print('失敗', ch['name'], e); continue
    base = [v['views'] for v in vs if (v['age_days'] is None or v['age_days'] >= 7) and v['views']]
    med = statistics.median(base) if base else 0
    print(f"{ch['name']}: {len(vs)}本 中央値{med:,.0f}")
    for v in vs:
        if (v['age_days'] is not None and v['age_days'] > 400) or not v['views']:
            continue
        ratio = v['views'] / med if med else 0
        items.append({**v, 'channel': ch['name'], 'lang': ch['lang'], 'channel_median': int(med),
                      'ratio': round(ratio, 2)})
    time.sleep(1)
# そのチャンネルの中で伸びた（中央値の1.5倍以上）か、再生が大きいものを上に
items.sort(key=lambda x: (x['ratio'] >= 1.5, x['ratio'] * min(1, x['views'] / 200000)), reverse=True)
os.makedirs(os.path.join(here, 'out'), exist_ok=True)
json.dump(items, open(os.path.join(here, 'out', 'raw.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'集めた動画 {len(items)}本 → tools/out/raw.json')
