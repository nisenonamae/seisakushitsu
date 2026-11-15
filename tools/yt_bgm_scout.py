"""伸びている動画の概要欄から、使われている BGM の出どころ（クレジット）を集める。
使い方: python3 tools/yt_bgm_scout.py "なぜ 解説 アニメ" "地理 なぜ 解説" ... > out.json
- YouTube の検索（再生回数順）から動画を拾い、YouTube の公開の情報（innertube の next）で概要欄を読む
- 「BGM・音楽・Music・素材・♪」を含む行と、音楽サイトへのリンクを抜き出す
- 出どころ（サイト名）ごとに、使っている動画の数と合計の再生回数でまとめる
※ YouTube の動画から音を取ることはしない。見つけた出どころは、公式の配布元で使い方の条件を確かめてから音楽の棚に入れる
"""
import re, json, sys, urllib.parse, subprocess, time
from collections import defaultdict
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
SITES = {'dova-s.jp': 'OpenTracks（旧DOVA-SYNDROME）', 'opentracks.com': 'OpenTracks（旧DOVA-SYNDROME）', 'amachamusic': '甘茶の音楽工房', 'maou.audio': '魔王魂', '魔王魂': '魔王魂',
         'bgmer.net': 'BGMer', 'BGMer': 'BGMer', 'BGM大統領': 'BGM大統領', 'bgmdaitouryou': 'BGM大統領', 'peritune': 'PeriTune', 'PeriTune': 'PeriTune', 'chosic.com': 'Chosic',
         'incompetech': 'Kevin MacLeod', 'Kevin MacLeod': 'Kevin MacLeod', 'ncs.io': 'NCS', 'NoCopyrightSounds': 'NCS', 'falcom.co.jp/music_use': 'ファルコム音楽フリー宣言',
         'audiostock': 'Audiostock（有料）', 'musmus': 'MusMus', 'otologic': 'OtoLogic', 'nash-music': 'Nash Music Library', 'H/MIX': 'H/MIX GALLERY', 'hmix': 'H/MIX GALLERY',
         'senses-circuit': 'Senses Circuit', 'pocket-se': 'ポケットサウンド', 'springin': 'Springin’ Sound Stock', 'bgm-labo': 'BGMラボ', 'MusicMaterial': 'MusicMaterial',
         'commons.nicovideo': 'ニコニ・コモンズ', 'YouTube Audio Library': 'YouTube オーディオライブラリ', 'オーディオライブラリ': 'YouTube オーディオライブラリ'}
def get(url):
    return subprocess.run(['curl', '-sL', '-A', UA, '-H', 'Accept-Language: ja', '-b', 'CONSENT=YES+cb.20210328-17-p0.ja+FX+000; SOCS=CAI', url], capture_output=True).stdout.decode('utf-8', 'ignore')
def search(q, n=15):
    s = get('https://www.youtube.com/results?search_query=' + urllib.parse.quote(q) + '&sp=CAM%253D')
    ids = []
    for i in re.findall(r'"videoId":"([\w-]{11})"', s):
        if i not in ids: ids.append(i)
    return ids[:n]
def details(v):
    """next（視聴ページの横の情報）から、題名・チャンネル・再生回数・概要欄を読む（player は bot 確認で止められやすい）"""
    r = subprocess.run(['curl', '-s', '-X', 'POST', 'https://www.youtube.com/youtubei/v1/next?prettyPrint=false', '-H', 'Content-Type: application/json', '-A', 'Mozilla/5.0',
                        '-d', json.dumps({"videoId": v, "context": {"client": {"clientName": "WEB", "clientVersion": "2.20241101.00.00", "hl": "ja"}}})], capture_output=True)
    s = r.stdout.decode('utf-8', 'ignore')
    def js(m): return json.loads('"' + m.group(1) + '"') if m else ''
    desc = js(re.search(r'"attributedDescription":\{"content":"((?:[^"\\]|\\.)*)"', s))
    title = js(re.search(r'"videoPrimaryInfoRenderer":\{"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"', s))
    ch = js(re.search(r'"videoOwnerRenderer":\{.*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"', s))
    vc = re.search(r'"viewCount":\{"simpleText":"([\d,]+)', s)
    return {'id': v, 'title': title, 'ch': ch, 'views': int(vc.group(1).replace(',', '')) if vc else 0, 'desc': desc}
PAT = re.compile(r'(BGM|ＢＧＭ|音楽|Music|楽曲|♪|素材|曲)', re.I)
def credits(desc):
    lines = [l.strip() for l in desc.split('\n')]
    out = []
    for i, l in enumerate(lines):
        if PAT.search(l) or any(k in l for k in SITES):
            out.append(l)
            # 見出し（「使用素材」など）のすぐ下の数行も拾う
            if PAT.search(l) and len(l) < 20: out += [x for x in lines[i + 1:i + 6] if x]
    return list(dict.fromkeys(out))
if __name__ == '__main__':
    vids = {}
    for q in sys.argv[1:]:
        for v in search(q):
            if v in vids: continue
            try: vids[v] = details(v); time.sleep(1.0)
            except Exception: pass
    by = defaultdict(lambda: {'videos': 0, 'views': 0, 'examples': [], 'links': set()})
    for x in vids.values():
        cr = credits(x['desc']); x['credits'] = cr; txt = '\n'.join(cr)
        for k, name in SITES.items():
            if k in txt:
                b = by[name]; b['videos'] += 1; b['views'] += x['views']
                b['examples'].append({'video': x['id'], 'title': x['title'], 'ch': x['ch'], 'views': x['views'], 'lines': [l for l in cr if k in l or PAT.search(l)][:6]})
                b['links'] |= set(re.findall(r'https?://[^\s　]+', '\n'.join(l for l in cr if k in l)))
    # まだ一覧にない出どころ: クレジットの行にあるリンクのドメインを数える
    skip = ('youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'amzn', 'amazon', 'line.me', 'note.com', 'bit.ly', 'google', 'discord', 'facebook', 'voicevox', 'irasutoya', 'pixabay.com/ja/images', 'shutterstock')
    new = defaultdict(lambda: {'videos': 0, 'views': 0, 'lines': []})
    for x in vids.values():
        for l in x['credits']:
            if not PAT.search(l): continue
            for u in re.findall(r'https?://([^/\s　]+)', l):
                d = u.lower().removeprefix('www.')
                if any(k in d for k in skip) or any(k.lower() in d for k in SITES): continue
                n = new[d]; n['videos'] += 1; n['views'] += x['views']; n['lines'].append(l[:120])
    res = {'queries': sys.argv[1:], 'sources': sorted([{'name': n, 'videos': b['videos'], 'views': b['views'], 'links': sorted(b['links'])[:10], 'examples': sorted(b['examples'], key=lambda e: -e['views'])[:5]} for n, b in by.items()], key=lambda s: -s['views']),
           'new_domains': sorted([{'domain': d, **v, 'lines': v['lines'][:4]} for d, v in new.items()], key=lambda z: -z['views']),
           'videos': sorted(vids.values(), key=lambda x: -x['views'])}
    json.dump(res, sys.stdout, ensure_ascii=False, indent=1)
