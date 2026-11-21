#!/usr/bin/env python3
"""本番の書き出しを1つの命令で（作り手・2026-11-21「トークンを節約して書き出したい」）

使い方（Claude は run_in_background で動かし、終わりの知らせを待つ。途中で何度も見に行かない）:
  python3 tools/final_export.py <projId か 題名の一部> [--res 1080] [--items windmill,house] [--no-ending]
                               [--chapters 序,第1章] [--repo /home/claude/notion-daily]

する事（全部この中でやる）:
  1. 準備：字幕のフォント・声のエンジン（2回目からは何もしない）
  2. render_draft.py --final（声・BGM・字幕・チャプター。BGM は音の調整室で決めたもの）
  3. add_ending.py（エンディング20秒。--items か project.endingItems。--no-ending で付けない）
  4. 点検：長さ・音の大きさ（LUFS・最大）・黒い画面・止まったままの画面・声の途切れ
  5. 一覧の画像を1枚（24コマ。目で確かめるのはこの1枚だけでよい）
  6. 字幕（.srt）とチャプターを データの videos/<projId>/ に写す（コミットは Claude がする）
出力は最後の数行だけ。くわしい記録は <出力>.log。最初の行が「OK」か「要確認」。
"""
import argparse, json, os, re, subprocess, sys, glob, shutil, time

# Mac などで tools/setup_mac.sh を流してあれば、その Python（~/.seisaku/venv）で動かし直す（部品がそろっている方を使う）
_VENV = os.path.join(os.environ.get('SS_HOME') or os.path.expanduser('~/.seisaku'), 'venv', 'bin', 'python')
if os.path.exists(_VENV) and os.path.realpath(sys.executable) != os.path.realpath(_VENV) and not os.environ.get('SS_NO_VENV'):
    os.execv(_VENV, [_VENV] + sys.argv)

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('proj')
ap.add_argument('--res', type=int, default=1080)
ap.add_argument('--items', default='')
ap.add_argument('--no-ending', action='store_true')
ap.add_argument('--chapters', default='', help='一部の章だけ（試しに書き出すとき）')
sys.path.insert(0, os.path.join(APP, 'tools/vis')); import sspaths
_rd = os.environ.get('SS_DATA_REPO') or next((p for p in (os.path.join(os.path.dirname(APP), 'notion-daily'), '/home/claude/notion-daily', os.path.expanduser('~/apps/notion-daily')) if os.path.isdir(p)), '/home/claude/notion-daily')
ap.add_argument('--repo', default=_rd, help='データのリポジトリ（ふつうはアプリの隣の notion-daily）')
ap.add_argument('--outdir', default='/home/claude/out/final' if os.path.isdir('/home/claude') else os.path.expanduser('~/seisaku_out/final'))
a = ap.parse_args()

DATA = os.path.join(a.repo, 'roadmap/apps/seisakushitsu/data.json')
D = json.load(open(DATA))
P = [p for p in D.get('projects', []) if not p.get('deleted')]
q = a.proj.strip()
CQ = {c.get('id'): (c.get('q') or '') for c in D.get('candidates', [])}
def tname(p):  # 制作の名前＝題材（候補）の問い。決まった題名があればそれ
    t = next((x.get('text') or x.get('t') for x in (p.get('titles') or []) if x.get('id') == p.get('titleId')), None)
    return t or CQ.get(p.get('candId')) or p.get('name') or p.get('title') or p['id']
cand = [p for p in P if p.get('id') == q] or [p for p in P if q and q in tname(p) + ' ' + CQ.get(p.get('candId'), '')]
if len(cand) != 1:
    print('要確認：制作が' + ('見つかりません' if not cand else f'{len(cand)}件当たります'), '／', ' ・'.join(f"{p['id']}={tname(p)[:16]}" for p in (cand or P)))
    sys.exit(2)
pj = cand[0]; pid = pj['id']
title = tname(pj)
short = re.sub(r'[\s\\/:*?"<>|｜（）()「」]', '', title)[:16] or pid
od = os.path.join(a.outdir, pid); os.makedirs(od, exist_ok=True)
vdir = os.path.join(a.repo, 'roadmap/apps/seisakushitsu/videos', pid)
used = [int(m) for f in glob.glob(os.path.join(od, 'final_v*.mp4')) + glob.glob(os.path.join(vdir, 'final_v*.srt')) for m in re.findall(r'final_v(\d+)', f)]
N = max(used + [0]) + 1
main = os.path.join(od, f'final_v{N}.mp4')
LOG = os.path.join(od, f'final_v{N}.log')
logf = open(LOG, 'w')

def run(cmd, label):
    t = time.time(); logf.write(f'\n$ {" ".join(cmd)}\n'); logf.flush()
    r = subprocess.run(cmd, stdout=logf, stderr=subprocess.STDOUT, cwd=APP)
    logf.write(f'[{label}] {r.returncode} {time.time()-t:.0f}s\n'); logf.flush()
    if r.returncode != 0:
        logf.close(); tail = open(LOG, encoding='utf-8', errors='replace').read().strip().split('\n')[-12:]
        print(f'要確認：{label}で止まりました（記録 {LOG}）'); print('\n'.join(x[:200] for x in tail)); sys.exit(1)

def sh(*c):
    return subprocess.run(c, capture_output=True, text=True)

def dur(f):
    return float(sh('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f).stdout.strip() or 0)

def mmss(s):
    s = max(0, s); return f'{int(s//60)}:{s%60:04.1f}'

T0 = time.time()
# 1. 準備
run(['bash', 'tools/setup_fonts.sh'], 'フォントの用意')
run(['bash', 'tools/setup_engine.sh'], '声のエンジンの用意')
try:
    import voicevox_core  # noqa: F401  render_draft.py が使う（無い環境では先に入れる・2026-11-21）
except ImportError:
    run(['bash', 'tools/setup_voice.sh'], '声の部品の用意')
try:
    import pyloudnorm  # noqa: F401  音量をそろえるのに要る（無いと声の合成のあとで止まる・2026-11-21）
except ImportError:
    run(['pip', 'install', '--break-system-packages', '-q', 'pyloudnorm'], '音量の部品の用意')
# 2. 本編
cmd = [sys.executable, 'tools/render_draft.py', '--data', DATA, '--proj', pid, '--repo', a.repo, '--out', main,
       '--kata', 'main', '--vrules', '--lead', '0.3', '--bgm', 'proj', '--res', str(a.res), '--final']
if a.chapters: cmd += ['--chapters', a.chapters]
run(cmd, '本編の書き出し')
md = dur(main)
# 3. エンディング
final = main; ending_note = 'なし（--no-ending）'; warn = []
if not a.no_ending:
    items = a.items or ','.join(pj.get('endingItems') or [])
    if not items:
        spr = open(os.path.join(APP, 'tools/vis/html/ending.html'), encoding='utf-8').read()
        names = re.findall(r'(\w+):\{r:', spr[spr.find('SPR='):spr.find('SPR=') + 4000])
        warn.append('エンディングの流れる物が決まっていないので、付けていません（--items で指定。使える名前：' + ','.join(names) + '）')
        ending_note = 'なし（物が未指定）'
    else:
        final = os.path.join(od, f'final_v{N}_end.mp4')
        run([sys.executable, 'tools/add_ending.py', main, final, '--data', DATA, '--repo', a.repo, '--items', items], 'エンディング')
        ending_note = f'{mmss(md)} から（{items}）'
fd = dur(final)
# 4. 点検（1回読み通すだけで全部測る）
ESKIP = 0 if final == main else 20.5
r = sh('ffmpeg', '-hide_banner', '-nostats', '-i', final,
       '-vf', 'scale=320:-2,blackdetect=d=1.0:pix_th=0.10,freezedetect=n=-60dB:d=8',
       '-af', 'ebur128=peak=true,silencedetect=n=-45dB:d=2.5', '-f', 'null', '-')
e = r.stderr
I = re.findall(r'I:\s+(-?[\d.]+) LUFS', e); TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)
lufs = float(I[-1]) if I else None; tp = float(TP[-1]) if TP else None
body_end = fd - ESKIP
def spans(a_, b_):
    s = [float(x) for x in re.findall(a_, e)]; t = [float(x) for x in re.findall(b_, e)]
    out = []
    for i, x in enumerate(s):
        y = t[i] if i < len(t) else fd
        if x > 0.5 and x < body_end - 1.5: out.append((x, y))
    return out
blk = [(float(s), float(t)) for s, t in re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', e) if 0.5 < float(s) < body_end - 1.5]
frz = spans(r'freeze_start: ([\d.]+)', r'freeze_end: ([\d.]+)')
sil = spans(r'silence_start: ([\d.]+)', r'silence_end: ([\d.]+)')
fmt = lambda L: 'なし' if not L else f'{len(L)}か所（' + '・'.join(f'{mmss(x)}〜{mmss(y)}' for x, y in L[:4]) + ('…' if len(L) > 4 else '') + '）'
if lufs is None or abs(lufs - (-14)) > 1.5: warn.append(f'音の大きさが目当て（-14 LUFS）から離れています：{lufs}')
if tp is not None and tp > -0.5: warn.append(f'音の最大が大きすぎます：{tp} dBFS')
if blk: warn.append('黒い画面 ' + fmt(blk))
if frz: warn.append('8秒以上止まったままの画面 ' + fmt(frz))
if sil: warn.append('2.5秒以上の無音 ' + fmt(sil))
# 5. 一覧の画像（24コマ）
sheet = os.path.join(od, f'final_v{N}_sheet.png')
try:
    from PIL import Image, ImageDraw, ImageFont
    fp = (glob.glob(os.path.join(sspaths.FONTS, 'BIZ_UDPGothic*.ttf')) + glob.glob(os.path.join(sspaths.FONTS, '*.ttf')) + [None])[0]
    font = ImageFont.truetype(fp, 18) if fp else ImageFont.load_default()
    n = 24; W, H = 320, 180; img = Image.new('RGB', (W * 6, H * 4), (20, 20, 20)); dr = ImageDraw.Draw(img)
    tmp = os.path.join(od, '_f.jpg')
    for i in range(n):
        t = fd * (i + 0.5) / n
        sh('ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t:.2f}', '-i', final, '-frames:v', '1', '-vf', f'scale={W}:{H}', tmp)
        if os.path.exists(tmp):
            img.paste(Image.open(tmp).convert('RGB'), ((i % 6) * W, (i // 6) * H))
        dr.rectangle([(i % 6) * W, (i // 6) * H, (i % 6) * W + 70, (i // 6) * H + 24], fill=(0, 0, 0))
        dr.text(((i % 6) * W + 4, (i // 6) * H + 2), mmss(t)[:-2], fill=(255, 255, 255), font=font)
    img.save(sheet)
    if os.path.exists(tmp): os.remove(tmp)
except Exception as ex:
    warn.append(f'一覧の画像を作れませんでした：{ex}'); sheet = '（なし）'
# 6. 字幕とチャプターをデータへ写す・渡す名前の動画を作る
if not a.chapters: os.makedirs(vdir, exist_ok=True)   # 一部の章だけの試しは、データに写さない
srt_src = os.path.splitext(main)[0] + '.srt'; ch_src = os.path.splitext(main)[0] + '.chapters.txt'
srt_rel = ''
if os.path.exists(srt_src) and not a.chapters:
    shutil.copy(srt_src, os.path.join(vdir, f'final_v{N}.srt')); srt_rel = f'videos/{pid}/final_v{N}.srt'
if os.path.exists(ch_src) and os.path.getsize(ch_src) and not a.chapters:
    shutil.copy(ch_src, os.path.join(vdir, f'final_v{N}.chapters.txt'))
give = os.path.join(od, f'{short}_{a.res}p.mp4')
shutil.copy(final, give)
mb = os.path.getsize(give) / 1e6
res = {'ok': not warn, 'file': give, 'name': os.path.basename(give), 'version': N, 'duration': round(fd, 2), 'main_duration': round(md, 2),
       'size_mb': round(mb, 1), 'lufs': lufs, 'true_peak': tp, 'ending': ending_note, 'srt': srt_rel,
       'chapters': open(ch_src, encoding='utf-8').read() if os.path.exists(ch_src) else '', 'sheet': sheet, 'warn': warn, 'log': LOG,
       'minutes': round((time.time() - T0) / 60, 1)}
json.dump(res, open(os.path.join(od, f'final_v{N}_result.json'), 'w'), ensure_ascii=False, indent=1)
logf.close()
print(('OK' if not warn else '要確認') + f'：{give}（{mmss(fd)}・{mb:.0f}MB・{res["minutes"]}分かかった）')
print(f'音：{lufs} LUFS（目当て -14）・最大 {tp} dBFS／エンディング：{ending_note}')
print(f'黒い画面：{fmt(blk)}／止まったまま：{fmt(frz)}／無音：{fmt(sil)}')
print(f'一覧の画像（目で見るのはこの1枚）：{sheet}')
print(f'字幕：{srt_rel or "なし"}（データに写した・コミットはまだ）／チャプター：{os.path.join(od, f"final_v{N}_result.json")} の chapters')
for w in warn: print('！', w)
print('次：' + ('一部の章だけの試し（データには写していない）' if a.chapters else ('チャットで送る（SendUserFile）' + ('。100MB を超えるので GitHub には置かない' if mb > 100 else '')) + ' → project.final と publish を書く（WORKER.md「本番の書き出し」の 3）'))
