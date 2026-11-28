#!/usr/bin/env python3
"""ブラウザ（Chromium）と Node で、同じ記録から同じ文書（同じハッシュ）・同じ数になるかを突き合わせる。
使い方： python3 tools/browser_check.py    （lab/p3a の中で。ポート 8803 を一時的に使い、終わったら止める）"""
import json, subprocess, sys, os, time, functools, threading, http.server, socketserver
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
which = '3' if '--3' in sys.argv else ''   # --3：掛ける量の戻し方の比べ（numcheck3）を突き合わせる
node = json.loads(subprocess.run(['node', f'tools/numcheck{which}.js', '--json'], cwd=here, capture_output=True, text=True, check=True).stdout)
socketserver.TCPServer.allow_reuse_address = True
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=here)
Handler.log_message = lambda *a, **k: None
srv = socketserver.TCPServer(('127.0.0.1', 8803), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('requestfailed', lambda r: errs.append('failed ' + r.url))
        ext = []; pg.on('request', lambda r: ext.append(r.url) if not r.url.startswith('http://127.0.0.1:8803/') else None)
        pg.goto(f'http://127.0.0.1:8803/tools/numcheck{which}.html'); pg.wait_for_function('window.__p3a', timeout=300000)
        web = pg.evaluate('window.__p3a.sig'); ua = pg.evaluate('navigator.userAgent'); b.close()
finally:
    srv.shutdown(); srv.server_close()
diff = [k for k in sorted(set(node) | set(web)) if json.dumps(node.get(k)) != json.dumps(web.get(k))]
print('ブラウザ：', ua)
print('Node    ：', subprocess.run(['node', '-v'], capture_output=True, text=True).stdout.strip())
print('比べた項目：', len(node), '／違った項目：', len(diff), diff[:10])
if which: print('核を通した印（divide・keep・rebuild）：', [node.get(f'core_{m}') for m in ('divide', 'keep', 'rebuild')], [web.get(f'core_{m}') for m in ('divide', 'keep', 'rebuild')])
else: print('文書の印（でたらめな命令 3000 手 × 種 1・2・3）：', [node.get(f'fuzz{i}') for i in (1, 2, 3)], [web.get(f'fuzz{i}') for i in (1, 2, 3)])
print('全体の印：Node', node.get('all'), '／ブラウザ', web.get('all'))
print('ページの誤り：', errs, '／外への読みこみ：', ext)
sys.exit(1 if diff or errs or ext else 0)
