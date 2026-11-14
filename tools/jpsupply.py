"""日本語の供給を測る。
使い方: python3 tools/jpsupply.py "検索の言葉" "数える言葉1,数える言葉2"
題名に「数える言葉」のどれかが入り、かなを含む（日本で作られたらしい）動画だけを数える。
"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(__file__))
from yt_common import search

q, keys = sys.argv[1], [k for k in sys.argv[2].split(',') if k]
vs = [v for v in search(q) if re.search(r'[぀-ヿ]', v['title']) and (not keys or any(k in v['title'] for k in keys))]
recent = [v for v in vs if re.search(r'(秒|分|時間|日|週間|か月)前', v['published'])]
res = {'query': q, 'count': len(vs), 'over100k': sum(v['views'] >= 100000 for v in vs),
       'max': max([v['views'] for v in vs], default=0), 'within_year': len(recent),
       'top': sorted(vs, key=lambda v: -v['views'])[:5]}
print(json.dumps(res, ensure_ascii=False, indent=1))
