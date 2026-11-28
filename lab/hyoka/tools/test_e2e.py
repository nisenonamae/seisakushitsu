#!/usr/bin/env python3
"""lab/hyoka：裏のブラウザ（playwright の Chromium）で、最初から最後まで通す試し。
使い方：python3 tools/test_e2e.py [--p4]     （--p4＝途中で、作り物の P4 の「評価.json」を読みこむ）
確かめること：JS のエラー 0／自分のフォルダの外への通信 0／途中で閉じて続きから／ボタンを押してもスクロール位置が戻らない／
  キーボードで点が入る／書き出した JSON が出る（/tmp/hyoka/ に置く。yomu.py で読む）／localStorage は lab:hyoka: だけ"""
import argparse, functools, http.server, json, os, random, sys, threading
from playwright.sync_api import sync_playwright
HY = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); LAB = os.path.dirname(HY); TMP = '/tmp/hyoka'; PORT = 8811
ap = argparse.ArgumentParser(); ap.add_argument('--p4', action='store_true'); ap.add_argument('--seed', type=int, default=7); A = ap.parse_args()
os.makedirs(TMP, exist_ok=True); rnd = random.Random(A.seed)

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class S(http.server.ThreadingHTTPServer):
    def handle_error(self, *a): pass          # ページを閉じたときの切れは気にしない
srv = S(('127.0.0.1', PORT), functools.partial(H, directory=os.path.dirname(LAB)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/lab/hyoka/' % PORT
errs = []; outside = []; reqs = [0]; fails = []

def check(ok, msg):
    print(('  ○ ' if ok else '  × ') + msg)
    if not ok: fails.append(msg)

def fake_p4():
    """作り物の P4 の「評価.json」：人のみ＝AI の下組みを少しずらした物、下組み＋人＝AI のみを少しずらした物（形だけ本物と同じ）"""
    a = json.load(open(os.path.join(LAB, 'p4', 'ai', 'ai_only.json'), encoding='utf-8')); s = json.load(open(os.path.join(LAB, 'p4', 'ai', 'shitagumi.json'), encoding='utf-8'))
    p = os.path.join(TMP, '作り物_評価.json'); json.dump(dict(kind='lab-p4-eval', v=1, docs=dict(h=s, s=a, a=a, shitagumi=s)), open(p, 'w', encoding='utf-8'), ensure_ascii=False); return p

def attach(pg):
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    def rq(r):
        reqs[0] += 1
        if not (r.url.startswith(URL) or r.url.startswith('blob:') or r.url.startswith('data:')): outside.append(r.url)
    pg.on('request', rq)

def fill1(pg, keyboard):
    """第1部の1つを入れる。動きがあれば見る"""
    pg.wait_for_selector('.one .row')
    modes = pg.eval_on_selector_all('#cMode button', 'bs => bs.map(b => b.dataset.m)')
    for m in modes:
        pg.click('#cMode button[data-m="%s"]' % m); pg.wait_for_function('() => [...document.querySelectorAll(".stage .load")].every(e => e.hidden)')
    n = pg.eval_on_selector_all('.row:not(.off)', 'r => r.length')
    if keyboard:
        for _ in range(n + 2):                      # 黄色い枠の行に、キーで入れていく
            c = pg.evaluate('(document.querySelector(".row.cur") || {dataset: {}}).dataset.c || ""')
            if not c: break
            pg.keyboard.press(rnd.choice('yn') if c == 'ok' else str(rnd.randint(1, 5)))
    else:
        for r in pg.query_selector_all('.row:not(.off)'):
            bs = r.query_selector_all('.bt button'); rnd.choice(bs).click()
    return modes

def fill2(pg, keyboard):
    pg.wait_for_selector('.pair .row')
    for m in pg.eval_on_selector_all('#cMode button', 'bs => bs.map(b => b.dataset.m)'):
        pg.click('#cMode button[data-m="%s"]' % m); pg.wait_for_function('() => [...document.querySelectorAll(".stage .load")].every(e => e.hidden)')
    n = pg.eval_on_selector_all('.row', 'r => r.length')
    if keyboard:
        for _ in range(n): pg.keyboard.press(rnd.choice(['ArrowLeft', 'ArrowDown', 'ArrowRight']))
    else:
        for r in pg.query_selector_all('.row'): rnd.choice(r.query_selector_all('.bt button')).click()

with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport=dict(width=1440, height=820), accept_downloads=True)
    pg = ctx.new_page(); attach(pg); pg.goto(URL); pg.wait_for_selector('#bStart')
    n1 = pg.evaluate('__hyoka.state().t1.length'); n2 = pg.evaluate('__hyoka.state().t2.length'); seed = pg.evaluate('__hyoka.state().seed')
    check(n1 == 17 and n2 == 16, '最初の数：第1部 %d（17 のはず）・第2部 %d（16 のはず）' % (n1, n2))
    txt = pg.inner_text('body'); bad = [w for w in ['E5', 'E6', 'L2', 'ゾウ足', '関節の丸み', '組み合わせ', '脚を短く', '柱', 'AI のみ', '目を 2 倍'] if w in txt]
    check(not bad, '最初の画面に、版の名前が出ていない %s' % bad)
    pg.screenshot(path=os.path.join(TMP, 's0_intro.png'))
    pg.click('#bStart')
    # 1つめ：押してもスクロール位置が戻らない（窓を低くして、下へ送ってから押す）
    pg.set_viewport_size(dict(width=1100, height=520)); pg.wait_for_selector('.one .row'); pg.evaluate('window.scrollTo(0, 260)'); y0 = pg.evaluate('window.scrollY')
    pg.evaluate('''() => { for (const q of ['.row[data-c="kao"] .bt button[data-v="3"]', '#cIn', '#cMode button[data-m="sil"]']) document.querySelector(q).click(); }'''); pg.wait_for_timeout(200); y1 = pg.evaluate('window.scrollY')
    check(y0 > 0 and y0 == y1, 'ボタンを押してもスクロール位置が戻らない（%s → %s）' % (y0, y1))
    pg.set_viewport_size(dict(width=1440, height=820)); pg.click('#cFit')
    # 入れずに「次へ」→ 進まない
    pg.click('#bNext'); check(pg.evaluate('__hyoka.state().cur.i') == 0 and pg.eval_on_selector_all('.row.miss', 'r => r.length') > 0, '入れていない行があると進まない（赤い行が出る）')
    shot = {}
    for i in range(6):
        ms = fill1(pg, keyboard=(i % 2 == 0))
        if 'walk' in ms and 'one' not in shot:
            pg.click('#cMode button[data-m="walk"]'); pg.wait_for_timeout(400); f0 = pg.inner_text('#cFr'); pg.wait_for_timeout(500); f1 = pg.inner_text('#cFr')
            check(f0 != f1, '動きが進む（%s → %s）' % (f0, f1))
            pg.keyboard.press(' '); a = pg.inner_text('#cFr'); pg.wait_for_timeout(300); b = pg.inner_text('#cFr'); pg.keyboard.press('.'); c = pg.inner_text('#cFr')
            check(a == b and b != c, '止める・コマ送り（%s・%s → %s）' % (a, b, c))
            pg.screenshot(path=os.path.join(TMP, 's1_one.png')); shot['one'] = 1
        pg.keyboard.press('Enter') if i % 2 == 0 else pg.click('#bNext')
    check(pg.evaluate('__hyoka.state().cur.i') == 6, '6 個入れて、7 個めにいる')
    # 途中で閉じて、続きから
    keys = pg.evaluate('Object.keys(localStorage)'); check(all(k.startswith('lab:hyoka:') for k in keys) and keys, 'localStorage は lab:hyoka: だけ %s' % keys)
    pg.close(); pg = ctx.new_page(); attach(pg); pg.goto(URL); pg.wait_for_selector('.one .row')
    s = pg.evaluate('({i: __hyoka.state().cur.i, seed: __hyoka.state().seed, d: __hyoka.state().t1.filter(t => t.doneAt).length})')
    check(s['i'] == 6 and s['seed'] == seed and s['d'] == 6, '閉じて開き直すと、続き（7 個め）から・種も同じ %s' % s)
    # 戻って直す
    pg.click('#bBack'); pg.wait_for_selector('.one .row'); before = pg.evaluate('__hyoka.state().t1[5].scores.miryoku')
    pg.click('.row[data-c="miryoku"] .bt button[data-v="%d"]' % (1 if before != 1 else 2)); pg.click('#bNext')
    check(pg.evaluate('__hyoka.state().t1[5].scores.miryoku') != before and pg.evaluate('__hyoka.state().cur.i') == 6, '戻って直せる')
    if A.p4:
        pg.click('#bList'); pg.set_input_files('#p4file', fake_p4()); pg.wait_for_function('() => __hyoka.state().t1.length === 19')
        check(pg.evaluate('__hyoka.state().t2.length') == 20, 'P4 を読みこむと、第1部 19・第2部 20 になる')
    N1 = pg.evaluate('__hyoka.state().t1.length')
    for i in range(6, N1):
        fill1(pg, keyboard=(i % 2 == 0)); pg.click('#bNext')
    pg.wait_for_selector('#bGo'); pg.click('#bGo')
    N2 = pg.evaluate('__hyoka.state().t2.length')
    for i in range(N2):
        fill2(pg, keyboard=(i % 2 == 0))
        if pg.evaluate('__hyoka.state().t2[%d].mode' % i) == 'motion' and 'pair' not in shot: pg.wait_for_timeout(300); pg.screenshot(path=os.path.join(TMP, 's2_pair.png')); shot['pair'] = 1
        if A.p4 and pg.evaluate('__hyoka.state().t2[%d].pair' % i) >= 9 and 'p4' not in shot: pg.screenshot(path=os.path.join(TMP, 's3_p4pair.png')); shot['p4'] = 1
        pg.click('#bNext')
    pg.wait_for_selector('#bExp')
    txt = pg.inner_text('#main'); check('E5 の' not in txt and 'E6' not in txt, '書き出す前は、対応が出ていない')
    with pg.expect_download() as d: pg.click('#bExp')
    out = os.path.join(TMP, '人の評価_試し%s.json' % ('_p4' if A.p4 else '')); d.value.save_as(out); name = d.value.suggested_filename
    pg.wait_for_selector('table'); txt = pg.inner_text('#main'); check('E5 の A 通常' in txt and '同じ絵の2回め' in txt, '書き出したあとは、番号と版の対応が出る')
    pg.screenshot(path=os.path.join(TMP, 's4_end.png'), full_page=True)
    R = json.load(open(out, encoding='utf-8'))
    check(name.startswith('人の評価_') and name.endswith('.json') and '途中' not in name, 'ファイルの名前：' + name)
    check(R['rater'] == 'human' and R['complete'] and R['seed'] == seed and len(R['part1']['trials']) == N1 and len(R['part2']['trials']) == N2, '書き出した JSON：人の印・種・数')
    check(all(t['done'] and t['ms'] > 0 for t in R['part1']['trials'] + R['part2']['trials']), '全部に点と時間が入っている')
    ok = True
    for p in set(t['pair'] for t in R['part2']['trials']):
        a, b = [t for t in R['part2']['trials'] if t['pair'] == p]; ok &= a['left'] == b['right'] and a['right'] == b['left'] and abs(a['index'] - b['index']) >= 3
    check(ok, '組は左右を入れかえて2回・あいだに別の組が2つ以上')
    rp = [t for t in R['part1']['trials'] if t['repeat']]; check(len(rp) == 2 and all(abs(t['index'] - [u for u in R['part1']['trials'] if u['version'] == t['version'] and not u['repeat']][0]['index']) >= 5 for t in rp), '同じ絵のくり返しが2つ・5 個以上はなれている')
    check(not any(k.lower().startswith('ai') for k in R), 'JSON の頭の項目に、AI の評価者の結果が無い')
    if A.p4: check(R['p4']['loaded'] == dict(h=True, s=True) and R['p4']['docs']['h'] and R['p4']['docs']['s'], 'P4 の絵のデータが JSON に入っている')
    br.close()
check(not errs, 'JS のエラー 0 %s' % errs[:3]); check(not outside, '外への通信 0（全部で %d 回の読みこみ）%s' % (reqs[0], outside[:3]))
print('書き出した物：', out); print('失敗 %d' % len(fails)); sys.exit(1 if fails else 0)
