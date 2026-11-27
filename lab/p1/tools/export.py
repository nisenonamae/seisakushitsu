#!/usr/bin/env python3
"""書き出しの側：裏で動かすブラウザ（playwright の Chromium）で、全部の場面を R1・R2 で描いて PNG にする。
使い方： python3 lab/p1/tools/export.py [--out /tmp/p1/out] [--configs default,nogpu,…] [--bench] [--write-reference]
- 起動の設定（CONFIGS）を変えて描き、環境が違うときの差の当たりを付ける
- 同じ物を2回描く（同じページの中で2回＋ページを開き直して1回）→ 毎回同じになるか
- --bench：重い場面の 1コマあたりの時間（描く・画素を取り出す・PNG にする）
- --write-reference：default の設定のハッシュを lab/p1/reference.json に書く（下見のページが比べる相手）
手元のサーバーはポート 8801（終わったら止まる）。外とは通信しない。
"""
import sys, os, json, base64, time, argparse, threading, functools, http.server, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PORT = 8801
CONFIGS = {
    'default': [],
    'nogpu': ['--disable-gpu'],
    'swiftshader': ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    'gpuraster': ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-accelerated-2d-canvas', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    'noaccel2d': ['--disable-accelerated-2d-canvas'],
    'headed-new': ['--headless=new'],
}
KINDS = ['r1', 'r1cpu', 'r2gpu', 'r2cpu']
SCENES = ['text', 'edges', 'blur', 'blend', 'grad', 'image', 'stroke', 'kz', 'heavy']


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def serve():
    Quiet.extensions_map = dict(Quiet.extensions_map, **{'.wasm': 'application/wasm', '.js': 'text/javascript'})
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def open_page(browser):
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    outside = []
    page.on('request', lambda r: outside.append(r.url) if not r.url.startswith(('http://127.0.0.1:%d/' % PORT, 'blob:', 'data:')) else None)
    page.goto('http://127.0.0.1:%d/index.html' % PORT)
    page.evaluate('P1.init().then(()=>1)')
    return page, outside


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/p1/out')
    ap.add_argument('--configs', default='default,nogpu,swiftshader,gpuraster,noaccel2d')
    ap.add_argument('--scenes', default=','.join(SCENES))
    ap.add_argument('--kinds', default=','.join(KINDS))
    ap.add_argument('--bench', action='store_true')
    ap.add_argument('--write-reference', action='store_true')
    x = ap.parse_args()
    from playwright.sync_api import sync_playwright
    srv = serve()
    res = {'made': datetime.datetime.now().isoformat(timespec='seconds'), 'configs': {}}
    scenes, kinds = x.scenes.split(','), x.kinds.split(',')
    try:
        with sync_playwright() as pw:
            for cfg in x.configs.split(','):
                d = os.path.join(x.out, cfg); os.makedirs(d, exist_ok=True)
                t0 = time.time()
                try:
                    b = pw.chromium.launch(args=CONFIGS[cfg])
                except Exception as e:
                    res['configs'][cfg] = {'error': str(e)[:300]}; print(cfg, '起動できない', str(e)[:200]); continue
                page, outside = open_page(b)
                c = res['configs'][cfg] = {'args': CONFIGS[cfg], 'browser': b.version, 'device': page.evaluate('P1.device()'),
                                           'load': page.evaluate('P1.load'), 'scenes': {}}
                for s in scenes:
                    c['scenes'][s] = {}
                    for k in kinds:
                        r = page.evaluate('([k,s])=>P1.renderPNG(k,s,0)', [k, s])
                        if 'error' in r:
                            c['scenes'][s][k] = {'error': r['error']}; continue
                        open(os.path.join(d, '%s__%s.png' % (s, k)), 'wb').write(base64.b64decode(r['png']))
                        r2 = page.evaluate('([k,s])=>P1.renderPNG(k,s,0)', [k, s])
                        c['scenes'][s][k] = {'hash': r['hash'], 'sameTwice': r['hash'] == r2['hash'], 'drawMs': r2['drawMs'], 'readMs': r2['readMs'], 'opaque': r['opaque']}
                # ページを開き直して、もう1回（毎回同じになるか）
                page.close()
                page, outside2 = open_page(b)
                for s in scenes:
                    for k in kinds:
                        if 'hash' not in c['scenes'][s][k]:
                            continue
                        r = page.evaluate('([k,s])=>P1.renderPNG(k,s,0)', [k, s])
                        c['scenes'][s][k]['sameReload'] = r.get('hash') == c['scenes'][s][k]['hash']
                c['errors'] = page.evaluate('P1.errors')
                c['outsideRequests'] = outside + outside2
                if x.bench and cfg == 'default':
                    bench = c['bench'] = {}
                    for k in kinds:
                        bench[k] = page.evaluate('([k])=>P1.bench(k,"heavy",20,{png:true})', [k])
                        bench[k]['kz'] = page.evaluate('([k])=>P1.bench(k,"kz",20)', [k])
                        print('  速さ', k, json.dumps(bench[k]))
                    # 生の画素を Python まで運ぶ時間（base64 で 8MB）
                    t1 = time.time()
                    raw = page.evaluate('async()=>{const r=P1.renderPixels("r2cpu","heavy",0);return await P1.b64(new Blob([r.px]))}')
                    bench['rawToPythonMs'] = (time.time() - t1) * 1000
                    bench['rawBytes'] = len(base64.b64decode(raw))
                b.close()
                bad = [(s, k) for s in scenes for k in kinds if c['scenes'][s][k].get('sameTwice') is False or c['scenes'][s][k].get('sameReload') is False]
                print('%s：%.0f秒 GL=%s 毎回同じでない物=%s 外への通信=%d' % (cfg, time.time() - t0, (c['device'].get('gl') or {}).get('renderer'), bad, len(c['outsideRequests'])))
    finally:
        srv.shutdown()
    os.makedirs(x.out, exist_ok=True)
    p = os.path.join(x.out, 'export.json')
    if os.path.exists(p):  # 前の結果に足す
        old = json.load(open(p)); old['configs'].update(res['configs']); old['made'] = res['made']; res = old
    json.dump(res, open(p, 'w'), ensure_ascii=False, indent=1)
    if x.write_reference and 'default' in res['configs']:
        c = res['configs']['default']
        ref = {'made': res['made'], 'browser': c['browser'], 'gl': (c['device'].get('gl') or {}).get('renderer'),
               'note': '作業場（裏で動かす Chromium・default の設定）で書き出した絵のハッシュ（SHA-256・RGBA の画素）',
               'hashes': {s: {k: v.get('hash') for k, v in ks.items()} for s, ks in c['scenes'].items()}}
        json.dump(ref, open(os.path.join(ROOT, 'reference.json'), 'w'), ensure_ascii=False, indent=1)
    print('書いた：', p)


if __name__ == '__main__':
    main()
