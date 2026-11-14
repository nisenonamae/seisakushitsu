"""YouTube の公開ページから数字を読むための共通部品（API キー不要）。"""
import re, json, subprocess, urllib.parse

def _get(url, hl='en', gl='US'):
    r = subprocess.run(['curl', '-s', '-A', 'Mozilla/5.0', '-H', f'Accept-Language: {hl}',
                        '--cookie', f'PREF=hl={hl}&gl={gl}', url], capture_output=True)
    return r.stdout.decode('utf-8', 'replace')

def _initial(html):
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', html)
    return json.loads(m.group(1)) if m else {}

def _find(o, key):
    if isinstance(o, dict):
        if key in o:
            yield o[key]
        for x in o.values():
            yield from _find(x, key)
    elif isinstance(o, list):
        for x in o:
            yield from _find(x, key)

def parse_views(label):
    """'5.6 million views' / '123,456 views' / '12K' のような英語表記を数にする。"""
    s = (label or '').lower().replace(',', '')
    m = re.search(r'([\d.]+)\s*(thousand|million|billion|k|m|b)?', s)
    if not m:
        return 0
    n = float(m.group(1))
    mul = {'thousand': 1e3, 'k': 1e3, 'million': 1e6, 'm': 1e6, 'billion': 1e9, 'b': 1e9}.get(m.group(2) or '', 1)
    return int(n * mul)

def parse_age_days(label):
    """'3 weeks ago' → 21。分からなければ None。"""
    s = (label or '').lower()
    m = re.search(r'(\d+)\s*(second|minute|hour|day|week|month|year)', s)
    if not m:
        return None
    n = int(m.group(1))
    return n * {'second': 0, 'minute': 0, 'hour': 0, 'day': 1, 'week': 7, 'month': 30, 'year': 365}[m.group(2)]

def channel_videos(channel_id):
    """チャンネルの最新の長い動画（約30本）を、題名・再生・経過日数で返す。"""
    d = _initial(_get(f'https://www.youtube.com/channel/{channel_id}/videos'))
    out = []
    for lk in _find(d, 'lockupViewModel'):
        vid = lk.get('contentId')
        md = lk.get('metadata', {}).get('lockupMetadataViewModel', {})
        title = md.get('title', {}).get('content', '')
        parts = [p for row in md.get('metadata', {}).get('contentMetadataViewModel', {}).get('metadataRows', [])
                 for p in row.get('metadataParts', [])]
        labels = [p.get('accessibilityLabel') or p.get('text', {}).get('content', '') for p in parts]
        views = next((parse_views(x) for x in labels if 'view' in (x or '').lower()), 0)
        age = next((parse_age_days(x) for x in labels if 'ago' in (x or '').lower()), None)
        if vid and title:
            out.append({'id': vid, 'title': title, 'views': views, 'age_days': age,
                        'url': f'https://www.youtube.com/watch?v={vid}'})
    return out

def search(q, hl='ja', gl='JP'):
    """検索の上位（約20本）を返す。"""
    url = 'https://www.youtube.com/results?search_query=' + urllib.parse.quote(q) + '&sp=EgIQAQ%253D%253D'
    d = _initial(_get(url, hl, gl))
    out = []
    for v in _find(d, 'videoRenderer'):
        title = ''.join(r.get('text', '') for r in v.get('title', {}).get('runs', []))
        vc = v.get('viewCountText', {})
        vc = vc.get('simpleText', '') or ''.join(r.get('text', '') for r in vc.get('runs', []))
        out.append({'id': v.get('videoId'), 'title': title,
                    'channel': ''.join(r.get('text', '') for r in v.get('ownerText', {}).get('runs', [])),
                    'views': int(re.sub(r'\D', '', vc) or 0),
                    'published': v.get('publishedTimeText', {}).get('simpleText', ''),
                    'length': v.get('lengthText', {}).get('simpleText', ''),
                    'url': f"https://www.youtube.com/watch?v={v.get('videoId')}"})
    return out

def channel_shorts(channel_id):
    """ショートの一覧（約48本）。経過日数は取れないので None。"""
    d = _initial(_get(f'https://www.youtube.com/channel/{channel_id}/shorts'))
    out = []
    for s in _find(d, 'shortsLockupViewModel'):
        om = s.get('overlayMetadata', {})
        vid = s.get('onTap', {}).get('innertubeCommand', {}).get('reelWatchEndpoint', {}).get('videoId')
        title = om.get('primaryText', {}).get('content', '')
        if vid and title:
            out.append({'id': vid, 'title': title, 'views': parse_views(om.get('secondaryText', {}).get('content', '')),
                        'age_days': None, 'short': True, 'url': f'https://www.youtube.com/shorts/{vid}'})
    return out
