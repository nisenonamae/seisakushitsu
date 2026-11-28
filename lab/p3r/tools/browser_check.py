#!/usr/bin/env python3
"""ブラウザ（Chromium）と Node で、同じ記録から同じ文書（同じ印）になるかを突き合わせる（P3r の A-6）。
使い方： python3 tools/browser_check.py    （lab/p3r の中で。ポート 8810 を一時的に使い、終わったら止める。一時ファイルは /tmp/p3r/）
lab/p3a/tools/browser_check.py を写して、P3r の確かめ（tools/xcheck.js）用に直した物。"""
import json, subprocess, sys, os, functools, threading, http.server, socketserver
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('/tmp/p3r', exist_ok=True)
node = json.loads(subprocess.run(['node', 'tools/xcheck.js', '--json', '--journal', '/tmp/p3r/xj-node.txt'], cwd=here, capture_output=True, text=True, check=True).stdout)
node_text = open('/tmp/p3r/xj-node.txt', encoding='utf8').read()
socketserver.TCPServer.allow_reuse_address = True
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass
Handler = functools.partial(Quiet, directory=here)
srv = socketserver.TCPServer(('127.0.0.1', 8810), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('requestfailed', lambda r: errs.append('failed ' + r.url))
        ext = []; pg.on('request', lambda r: ext.append(r.url) if not r.url.startswith('http://127.0.0.1:8810/') else None)
        pg.goto('http://127.0.0.1:8810/tools/xcheck.html'); pg.wait_for_function('window.__p3r', timeout=900000)
        web = pg.evaluate('window.__p3r.sig'); ua = pg.evaluate('navigator.userAgent')
        web_text = pg.evaluate('window.__p3r.journal1')
        web_reads_node = pg.evaluate('(t) => window.__p3r.replayText(t)', node_text)   # Node が書いた記録を、ブラウザが読んで作り直す
        b.close()
finally:
    srv.shutdown(); srv.server_close()
open('/tmp/p3r/xj-web.txt', 'w', encoding='utf8').write(web_text)
node_reads_web = json.loads(subprocess.run(['node', 'tools/xcheck.js', '--replay', '/tmp/p3r/xj-web.txt'], cwd=here, capture_output=True, text=True, check=True).stdout)   # ブラウザが書いた記録を、Node が読む
diff = [k for k in sorted(set(node) | set(web)) if json.dumps(node.get(k)) != json.dumps(web.get(k))]
flags = [k for k, v in node.items() if isinstance(v, list) and v and all(isinstance(x, bool) for x in v) and not all(v)] + [k for k, v in node.items() if v is False]
print('ブラウザ：', ua)
print('Node    ：', subprocess.run(['node', '-v'], capture_output=True, text=True).stdout.strip())
print('比べた項目：', len(node), '／違った項目：', len(diff), diff[:10])
print('Node の中で「同じでない」と出た項目（空なら、読みこみ方・届く順・写しの有り無しで全部同じ）：', flags)
print('文書の印（種 1・2・3）：Node', [node.get(f's{i}_doc', '')[:16] for i in (1, 2, 3)], '／ブラウザ', [web.get(f's{i}_doc', '')[:16] for i in (1, 2, 3)])
print('記録の文字が同じ（種 1）：', node_text == web_text, '／', len(node_text), '字')
print('Node の記録 → ブラウザで作り直した文書：', web_reads_node['doc'][:16], '（Node：', node['s1_doc'][:16], '）同じ＝', web_reads_node['doc'] == node['s1_doc'] and web_reads_node['log'] == node['s1_log'])
print('ブラウザの記録 → Node で作り直した文書：', node_reads_web['doc'][:16], '同じ＝', node_reads_web['doc'] == web['s1_doc'] and node_reads_web['log'] == web['s1_log'])
print('全体の印：Node', node.get('all'), '／ブラウザ', web.get('all'))
print('ページの誤り：', errs, '／外への読みこみ：', ext)
bad = diff or errs or ext or flags or web_reads_node['doc'] != node['s1_doc'] or node_reads_web['doc'] != web['s1_doc']
sys.exit(1 if bad else 0)
