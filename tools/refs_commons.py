#!/usr/bin/env python3
"""実物帳に、Wikimedia Commons の写真・映像のコマを足す（2026-11-22）。
使い方：
  python3 tools/refs_commons.py search <言葉> [--video]              … 候補の題名を出す
  python3 tools/refs_commons.py add <種類> "File:…" [--at 0.2,0.5,0.8] [--note 何が写っているか] [--tags 水辺,群れ]
     種類＝docs/refs/jitsubutsu/ の下のフォルダ名（カバ・水辺・水中・草原・骨・空と雲 など）
     映像は --at（長さに対する割合）のところでコマを抜く。写真は1枚
決まり：
  - 使ってよい物だけ（CC0・PD・CC BY・CC BY-SA）。ほかの許諾は自動で断る
  - 置くのは幅 640 のコマだけ（元の映像は置かない）。出どころ・作者・許諾を index.json に必ず残す
  - YouTube などの映像は、ここには置かない（手本帳は言葉だけ。tools/REFS.md）"""
import sys, os, json, re, subprocess, tempfile, urllib.parse, urllib.request, argparse, time
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
BOOK = os.path.join(ROOT, 'docs', 'refs', 'jitsubutsu'); IDX = os.path.join(BOOK, 'index.json')
API = 'https://commons.wikimedia.org/w/api.php'; UA = {'User-Agent': 'seisakushitsu-refs/1.0 (https://github.com/nisenonamae/seisakushitsu)'}
OK = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? ?[0-9.]*|CC-BY(-SA)?-[0-9.]+)', re.I)

def get(params):
    q = API + '?' + urllib.parse.urlencode(dict(params, format='json'))
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(q, headers=UA), timeout=30) as r: return json.load(r)
        except Exception as e:
            if k == 3: raise
            time.sleep(2 + 3 * k)

def fetch(url, path):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(path, 'wb') as f: f.write(r.read())

def strip(h): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h or '')).strip()

def slug(t): return re.sub(r'[^0-9A-Za-z]+', '_', t.replace('File:', ''))[:48].strip('_')

def info(title):
    j = get({'action': 'query', 'titles': title, 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata|mediatype', 'iiurlwidth': 900})
    p = list(j['query']['pages'].values())[0]; ii = p['imageinfo'][0]; m = ii.get('extmetadata', {})
    v = lambda k: strip(m.get(k, {}).get('value', ''))
    return {'url': ii['url'], 'thumb': ii.get('thumburl'), 'mime': ii['mime'], 'size': ii.get('size', 0), 'page': ii.get('descriptionurl'),
            'license': v('LicenseShortName'), 'artist': v('Artist'), 'desc': v('ImageDescription')[:200], 'dur': ii.get('duration')}

def load():
    return json.load(open(IDX, encoding='utf-8')) if os.path.exists(IDX) else {'about': '実物帳。場面の種類ごとの、実物のコマ（Wikimedia Commons の使ってよい物だけ）。tools/REFS.md', 'items': []}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('a'); ap.add_argument('b', nargs='?')
    ap.add_argument('--video', action='store_true'); ap.add_argument('--at', default='0.25,0.5,0.75'); ap.add_argument('--note', default=''); ap.add_argument('--tags', default='')
    o = ap.parse_args()
    if o.cmd == 'search':
        j = get({'action': 'query', 'list': 'search', 'srnamespace': 6, 'srsearch': o.a + (' filetype:video' if o.video else ' filetype:bitmap'), 'srlimit': 20})
        for x in j['query']['search']: print(x['title'])
        return
    kind, title = o.a, o.b; I = info(title)
    if not OK.match(I['license']): sys.exit(f'使えない許諾なので置きません：{I["license"]}（{title}）')
    os.makedirs(os.path.join(BOOK, kind), exist_ok=True); D = load(); made = []
    with tempfile.TemporaryDirectory() as tmp:
        if I['mime'].startswith(('video', 'application/ogg')):
            # 元の映像の取得は Wikimedia に断られる（429）ので、その秒の縮小画像（seek 付きのサムネ）をもらう
            dur = I['dur'] or 10
            for a in [float(x) for x in o.at.split(',')]:
                t = dur * a; out = os.path.join(BOOK, kind, f'{slug(title)}_{t:05.1f}s.jpg')
                j = get({'action': 'query', 'titles': title, 'prop': 'imageinfo', 'iiprop': 'url', 'iiurlparam': f'640px-seek={t:.1f}'})
                u = list(j['query']['pages'].values())[0]['imageinfo'][0]['thumburl']; src = os.path.join(tmp, 'f.jpg'); fetch(u, src)
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=640:-2', '-q:v', '4', out], check=True); made.append((out, round(t, 1))); time.sleep(1.5)
        else:
            src = os.path.join(tmp, 'i'); fetch(I['thumb'] or I['url'], src); out = os.path.join(BOOK, kind, slug(title) + '.jpg')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=640:-2', '-q:v', '4', out], check=True); made.append((out, None))
    for out, t in made:
        rel = os.path.relpath(out, BOOK); D['items'] = [x for x in D['items'] if x['file'] != rel]
        D['items'].append({'file': rel, 'kind': kind, 'tags': [x for x in o.tags.split(',') if x], 'note': o.note, 'title': title, 't': t,
                           'src': I['page'], 'license': I['license'], 'artist': I['artist'] or '要確認', 'added': time.strftime('%Y-%m-%d')})
        print('置いた：', rel, '｜', I['license'], '｜', I['artist'][:40])
    json.dump(D, open(IDX, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__': main()
