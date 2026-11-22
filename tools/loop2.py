#!/usr/bin/env python3
"""見直しループの次の段（2026-11-22）：実物帳・手本帳と並べて見る／2案を並べて選ぶ。手順は WORKER.md「見直しループ（次の段）」。
  snap   <設計図.json> <版のフォルダ>                       … 各場面の決まった秒（3つずつ）を止め絵で描く。速い（1版 約1分）。比べるのはこれ
  render <設計図.json> <出力.mp4> [--mode 別のmode]        … 動画にする（約10分。動きを見る周と、作り手に渡す最後だけ）
  pack   <設計図.json> <版> <出力フォルダ> --stage N --look miss|natural|challenge [--scenes 名前,名前]
                                                         … 見る役に渡す物（段 N だけ。つかみと山場が既定）。look＝サイクルの番
                                                           miss＝ミス（乱れ・事実ちがい）／natural＝自然（実物帳と比べる）／challenge＝挑戦（kurzgesagt＝手本帳に近づける）
  pair   <設計図.json> <前> <新> <出力フォルダ> --scene 名前 --stage N --what "直した所" --look natural|challenge
                                                         … 選ぶ役に渡す、2案を並べた一覧（左右はくじ。答えは出力フォルダの外）
  liked  <版のフォルダ> <名前> --what "作り手の言葉"          … 作り手が「いい」と言った版の止め絵を好み帳に足す
  decide <出力フォルダ> <左|右|同じ>                        … 選ぶ役の答えから、どちらが勝ったかを出し、記録に足す
設計図＝docs/refs/plans/*.json（場面ごとの秒・実物帳の種類・手本帳の番号・つかみ/山場）"""
import os, sys, json, random, shutil, subprocess, argparse, time, glob
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'vis'))
import refs_sheet
LOG = os.path.join(ROOT, 'docs', 'notes', 'review_log.md')
LOOK = {'miss': 'ミスの番：乱れ・事実ちがいを探す（指摘帳 B・M・F と調べた記録）。重だけ挙げればよい',
        'natural': '自然の番：実物帳と並べて、実物とちがって不自然な所を探す',
        'challenge': '挑戦の番：kurzgesagt のクオリティに近づける。手本帳のやり方のうち、こちらにない物を探す'}

STAGES = {
 0: '設計：場面の役割・構図・カメラ・切り替えが、話の流れに合っているか',
 1: '大きな形：空・地面・主役・手前の大きな面の配置と明暗。構図（三分割・余白・主役の大きさ）。細部は見ない',
 2: '部品：一つ一つの物の形（主役の体つき・骨・木・草の株・魚）が実物らしいか、使い回しに見えないか、重なりがおかしくないか',
 3: '細部：一本線・部分色分け・目や口・光の当たり方・もよう。図形のままに見えないか',
 4: '動き（大）：カメラ・物の移動・切り替えのタイミング。止まって見える所・急な飛び',
 5: '動き（小）：耳・まばたき・水の輪・草のゆれ。ちらつき・同じ動きのくり返し',
 6: '仕上げ：ぼかし・かすみ・光・色の統一。全体の空気',
}

def plan(p): return json.load(open(p, encoding='utf-8'))

def render(P, out, mode=None):
    import scenes
    spec = {'t': 'html', 'page': P['page'], 'mode': mode or P['mode']}
    scenes.make(spec, P['dur'], out, '')
    print('作った：', out)

def snap(P, od):
    import asyncio
    from playwright.async_api import async_playwright
    os.makedirs(od, exist_ok=True); page = os.path.join(HERE, 'vis', 'html', P['page'] + '.html')
    async def run():
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=['--allow-file-access-from-files']); pg = await b.new_page(viewport={'width': 1280, 'height': 720})
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + page); await pg.evaluate('([s,d])=>setup(s,d)', [{'mode': P['mode']}, P['dur']])
            for s in P['scenes']:
                for t in times_in(s):
                    await pg.evaluate('t=>render(t)', t); await pg.screenshot(path=os.path.join(od, f'{t:06.2f}.png'))
            await b.close()
            if errs: print('要確認：ページのエラー', errs[:3])
    asyncio.run(run()); print('止め絵：', od, len(os.listdir(od)), '枚')

def frame(src, t, path, w=640):
    """src が止め絵のフォルダならその秒の絵、動画なら抜き出す"""
    if os.path.isdir(src):
        Image.open(os.path.join(src, f'{t:06.2f}.png')).convert('RGB').resize((w, w * 9 // 16), Image.LANCZOS).save(path, quality=92); return path
    return grab(src, t, path, w)

def grab(video, t, path, w=640):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', f'scale={w}:-2', '-q:v', '3', path], check=True)
    return path

def strip(paths, out, labels, w=640):
    ims = [Image.open(p).convert('RGB') for p in paths]; h = ims[0].height
    S = Image.new('RGB', (len(ims) * (w + 6), h + 26), 'white'); d = ImageDraw.Draw(S); F = refs_sheet.font(16)
    for i, (im, lb) in enumerate(zip(ims, labels)):
        S.paste(im.resize((w, h)), (i * (w + 6), 26)); d.text((i * (w + 6) + 4, 3), lb, fill='black', font=F)
    S.save(out); return out

def times_in(sc, n=3):
    a, b = sc['t']; return [a + (b - a) * k for k in ([.5] if n == 1 else [.2, .5, .85][:n])]

def tehon_lines(keys):
    out = []
    for ln in open(os.path.join(ROOT, 'docs', 'refs', 'tehon.md'), encoding='utf-8'):
        if ln.startswith('- [') and any(ln[3:].startswith(k) for k in keys): out.append(ln.rstrip())
    return out

def t_points():
    s = open(os.path.join(ROOT, 'docs', 'notes', 'review_points.md'), encoding='utf-8').read()
    return s[s.index('## T'):].strip()

def liked_sheet(out):
    try: return refs_sheet.sheet(refs_sheet.pick('liked', [], [], 8), out)
    except Exception: return None

def pack(P, video, od, stage, names, look='natural'):
    os.makedirs(od, exist_ok=True)
    scs = [s for s in P['scenes'] if (s['name'] in names if names else s.get('role'))]
    brief = [f'# 見る役に渡す物（段{stage}：{STAGES[stage]}）', '', f'**今回の番：{LOOK[look]}**', '',
             '手順は tools/REVIEW.md の「次の段：サイクルの番ごとに見る」。今回は**この段・この番のことだけ**を見る。ほかの気づきは最後に1行ずつ「ほかの段・ほかの番」として書くだけ。', '']
    for s in scs:
        tag = s['name']; ts = times_in(s)
        ours = [frame(video, t, os.path.join(od, f'_{tag}_{i}.jpg')) for i, t in enumerate(ts)]
        strip(ours, os.path.join(od, f'{tag}_作った絵.png'), [f'作った絵 {t:.1f}秒' for t in ts])
        for f in ours: os.remove(f)
        its = refs_sheet.pick('jitsubutsu', s['kinds'], s['tags'], 8) if look != 'challenge' else []
        if its: refs_sheet.sheet(its, os.path.join(od, f'{tag}_実物.png'))
        brief += [f'## {tag}（{s["t"][0]}〜{s["t"][1]}秒・{s.get("role") or "ふつう"}）', f'- 作った絵：`{tag}_作った絵.png`']
        if look != 'challenge': brief.append(f'- 実物：`{tag}_実物.png`（出どころは同じ名前の .txt）' if its else '- 実物：まだない（実物帳に足す）')
        if look == 'challenge': brief += ['- 手本（kurzgesagt）のやり方：'] + (['  ' + x for x in tehon_lines(s.get('tehon', []))] or ['  （まだない：手本帳に足してから挑戦する）'])
        brief.append('')
    if look == 'miss': brief += ['## 指摘帳（B・M・F）', open(os.path.join(ROOT, 'docs', 'notes', 'review_points.md'), encoding='utf-8').read().split('## T')[0].split('## B', 1)[1].join(['## B', '']), '']
    if look != 'miss' and liked_sheet(os.path.join(od, '好み_作り手がいいと言った版.png')): brief.append('- 作り手が「いい」と言った版：`好み_作り手がいいと言った版.png`（ここから離れる直しは慎重に）')
    brief += ['', '## 作り手の好み（指摘帳 T）', t_points(), '']
    if P.get('facts'): shutil.copy(os.path.join(ROOT, P['facts']), os.path.join(od, '調べた記録.md')); brief.append('- 調べた記録：`調べた記録.md`（描いた物が事実に合っているかも見る）')
    open(os.path.join(od, 'brief.md'), 'w', encoding='utf-8').write('\n'.join(brief) + '\n')
    print('出力：', od); print('\n'.join(sorted(os.listdir(od))))

def pair(P, va, vb, od, scene, stage, what, look='natural'):
    os.makedirs(od, exist_ok=True); s = [x for x in P['scenes'] if x['name'] == scene][0]
    flip = random.random() < .5; L, R = (vb, va) if flip else (va, vb)
    ts = times_in(s); rows = []
    for i, t in enumerate(ts):
        a = frame(L, t, os.path.join(od, f'_l{i}.jpg')); b = frame(R, t, os.path.join(od, f'_r{i}.jpg'))
        rows.append(strip([a, b], os.path.join(od, f'_row{i}.png'), [f'左 {t:.1f}秒', f'右 {t:.1f}秒']))
    ims = [Image.open(r) for r in rows]; S = Image.new('RGB', (ims[0].width, sum(i.height for i in ims)), 'white'); y = 0
    for im in ims: S.paste(im, (0, y)); y += im.height
    S.save(os.path.join(od, f'{scene}_左右.png'))
    for f in glob.glob(os.path.join(od, '_*')): os.remove(f)
    its = refs_sheet.pick('jitsubutsu', s['kinds'], s['tags'], 8)
    if its: refs_sheet.sheet(its, os.path.join(od, f'{scene}_実物.png'))
    key = od.rstrip('/') + '.key.json'   # 選ぶ役に渡すフォルダの外に置く
    json.dump({'左': 'B' if flip else 'A', '右': 'A' if flip else 'B', 'A': va, 'B': vb, 'scene': scene, 'stage': stage, 'what': what, 'look': look}, open(key, 'w'), ensure_ascii=False)
    brief = [f'# 2案を並べて選ぶ（{scene}・段{stage}：{STAGES[stage]}）', '', f'今回の直しは「{LOOK[look].split("：")[0]}」で入れた物（{LOOK[look].split("：")[1]}）。', '', '手順は tools/JUDGE.md。`' + scene + '_左右.png` の左と右は、同じ場面・同じ秒の2つの版。',
             f'- 今回ちがうのは、この段の1か所だけ：**{what}**（どちらが前の版かは教えない）',
             f'- 実物：`{scene}_実物.png`' if its else '- 実物：なし', '- 手本のやり方：'] + ['  ' + x for x in tehon_lines(s.get('tehon', []))]
    if P.get('facts'): shutil.copy(os.path.join(ROOT, P['facts']), os.path.join(od, '調べた記録.md')); brief.append('- 調べた記録：`調べた記録.md`')
    brief += ['', '## 作り手の好み（指摘帳 T）', t_points()]
    open(os.path.join(od, 'brief.md'), 'w', encoding='utf-8').write('\n'.join(brief) + '\n')
    print('出力：', od, '（答えの鍵は', key, '・選ぶ役に見せない）')

def liked(sd, name, said):
    B = os.path.join(ROOT, 'docs', 'refs', 'liked'); I = os.path.join(B, 'index.json'); D = json.load(open(I, encoding='utf-8'))
    for f in sorted(glob.glob(os.path.join(sd, '*.png')))[1::3]:   # 場面ごとに1枚（まん中）
        out = f'{name}_{os.path.basename(f)[:-4]}s.jpg'; Image.open(f).convert('RGB').resize((640, 360), Image.LANCZOS).save(os.path.join(B, out), quality=88)
        D['items'].append({'file': out, 'kind': name, 'tags': [], 'note': name, 'said': said, 'added': time.strftime('%Y-%m-%d')})
    json.dump(D, open(I, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('好み帳に足した：', name)

def decide(od, ans):
    K = json.load(open(od.rstrip('/') + '.key.json')); win = K.get(ans, '同じ') if ans in ('左', '右') else '同じ'
    res = {'B': '新しい版の勝ち → 残す', 'A': '前の版の勝ち → 戻す', '同じ': '差がない → 安い方（前の版）に戻す。ただし事実の直しなら残す'}[win]
    look = K.get('look', 'natural'); nm = {'natural': '自然', 'challenge': '挑戦'}.get(look, look)
    line = f"- {time.strftime('%Y-%m-%d')} {K['scene']}・段{K['stage']}・{nm}：{K['what']} → {res}"
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    if not os.path.exists(LOG): open(LOG, 'w', encoding='utf-8').write('# 2案比べの記録（tools/loop2.py decide が足す）\n\n負けた直しも残す（同じ直しをくり返さないため）。\n\n')
    open(LOG, 'a', encoding='utf-8').write(line + '\n'); print(line)
    # 止め時：同じ場面・同じ段の挑戦が2回続けて負け（前の版の勝ち・同じ）なら止める。勝った挑戦は5回で作り手に見せる
    pre = f"{K['scene']}・段{K['stage']}・挑戦："; ch = [l for l in open(LOG, encoding='utf-8') if pre in l]
    lose = 0
    for l in reversed(ch):
        if '新しい版の勝ち' in l: break
        lose += 1
    wins = sum('新しい版の勝ち' in l for l in ch)
    if lose >= 2: print(f'→ 止め時：この段の挑戦が{lose}連敗。今の実力の限界として、動画にして乱れ探し → 作り手へ')
    elif wins and wins % 5 == 0 and win == 'B': print(f'→ 挑戦が{wins}回勝った。いったん作り手に見せて、方向を確かめる')
    else: print(f'→ 次はミスの番（挑戦の連敗 {lose}・勝ち {wins}）')
    return win

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('args', nargs='*')
    ap.add_argument('--stage', type=int, default=2); ap.add_argument('--scenes', default=''); ap.add_argument('--scene', default=''); ap.add_argument('--what', default=''); ap.add_argument('--mode', default=None); ap.add_argument('--look', default='natural', choices=['miss', 'natural', 'challenge'])
    a = ap.parse_args()
    if a.cmd == 'snap': snap(plan(a.args[0]), a.args[1])
    elif a.cmd == 'render': render(plan(a.args[0]), a.args[1], a.mode)
    elif a.cmd == 'pack': pack(plan(a.args[0]), a.args[1], a.args[2], a.stage, [x for x in a.scenes.split(',') if x], a.look)
    elif a.cmd == 'pair': pair(plan(a.args[0]), a.args[1], a.args[2], a.args[3], a.scene, a.stage, a.what, a.look)
    elif a.cmd == 'liked': liked(a.args[0], a.args[1], a.what)
    elif a.cmd == 'decide': decide(a.args[0], a.args[1])
    else: sys.exit(__doc__)
