"""仮の動画（ドラフト）を組み立てる。
使い方:
  python3 tools/render_draft.py --data <data.json> --proj <制作のid> --repo <notion-daily の場所> --out <出力.mp4> [--voice 2] [--speed 1.1]
- 肉付け（flesh）があればその語り、なければ構成（outline）の text を読み上げる
- 画面：段に `visual`（データのリポジトリ内の .png か .mp4 のパス）があればそれを使い、なければ「画面の指示」を書いた絵コンテのカードを出す
- 字幕：語りを一文ずつ下に出す
- <出力>.json に、段ごとの開始・終了の秒数を書く（「2:10 ここを直す」を段に結びつけるため）
先に bash tools/setup_voice.sh を一度実行しておく。
"""
import argparse, json, os, re, subprocess, tempfile, wave, math
from PIL import Image, ImageDraw, ImageFont
W,H,FPS=1280,720,30
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';FR='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
V='/home/claude/vv'
ap=argparse.ArgumentParser();ap.add_argument('--data');ap.add_argument('--proj');ap.add_argument('--repo',default='');ap.add_argument('--out')
ap.add_argument('--voice',type=int,default=2);ap.add_argument('--speed',type=float,default=1.1);a=ap.parse_args()
D=json.load(open(a.data,encoding='utf-8'));P=[p for p in D['projects'] if p['id']==a.proj][0]
ob=(P.get('outline') or {}).get('blocks',[]);fb=(P.get('flesh') or {}).get('blocks',[])
oi={b['id']:i for i,b in enumerate(ob)}
if fb:
    live=[b for b in fb if b.get('mark')!='削る' and b.get('oid') in oi and ob[oi[b['oid']]].get('mark')!='削る']
    live.sort(key=lambda b:(oi[b['oid']],fb.index(b)))
    seq=[{'id':b['id'],'oid':b['oid'],'role':b.get('role',''),'text':b.get('narr',''),'screen':b.get('screen',''),'visual':b.get('visual') or ob[oi[b['oid']]].get('visual')} for b in live]
else:
    seq=[{'id':b['id'],'oid':b['id'],'role':b.get('role',''),'text':b.get('text',''),'screen':b.get('show',''),'visual':b.get('visual')} for b in ob if b.get('mark')!='削る']
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile
ort=Onnxruntime.load_once(filename=f'{V}/ort/voicevox_onnxruntime-linux-x64-1.17.3/lib/libvoicevox_onnxruntime.so.1.17.3')
syn=Synthesizer(ort,OpenJtalk(f'{V}/dict/open_jtalk_dic_utf_8-1.11'))
for f in sorted(os.listdir(f'{V}/models')):
    with VoiceModelFile.open(f'{V}/models/{f}') as m: syn.load_voice_model(m)
def tts(text,path):
    q=syn.create_audio_query(text,a.voice);q.speed_scale=a.speed;q.post_phoneme_length=0.15
    open(path,'wb').write(syn.synthesis(q,a.voice))
    with wave.open(path) as w: return w.getnframes()/w.getframerate()
def wrap(t,n=26):
    out=[];cur=''
    for ch in t:
        cur+=ch
        if len(cur)>=n and ch in '、。！？）」 ' or len(cur)>=n+6: out.append(cur);cur=''
    if cur: out.append(cur)
    return out[-3:]
def card(b,k,n):
    im=Image.new('RGB',(W,H),(28,36,48));d=ImageDraw.Draw(im)
    d.text((40,30),f'{k}/{n}　{b["role"]}',font=ImageFont.truetype(FB,26),fill=(140,170,210))
    d.text((W-40,30),'仮の動画（絵コンテ）',font=ImageFont.truetype(FR,20),fill=(110,120,135),anchor='ra')
    d.rounded_rectangle([140,140,W-140,500],24,outline=(80,96,120),width=3,fill=(36,46,62))
    d.text((170,160),'画面',font=ImageFont.truetype(FB,24),fill=(150,160,175))
    y=210
    for line in wrap(b['screen'] or '（画面の指示なし）',25)[:6]:
        d.text((W/2,y),line,font=ImageFont.truetype(FB,34),fill=(225,232,242),anchor='ma');y+=50
    return im
def sub_overlay(text):
    im=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(im);f=ImageFont.truetype(FB,34)
    lines=wrap(text,30);y=H-40-46*len(lines)
    d.rectangle([0,y-14,W,H],fill=(0,0,0,120))
    for ln in lines: d.text((W/2,y),ln,font=f,fill=(255,255,255),anchor='ma',stroke_width=3,stroke_fill=(0,0,0));y+=46
    return im
tmp=tempfile.mkdtemp();segs=[];auds=[];tl=[];t0=0.0;n=len(seq)
for k,b in enumerate(seq,1):
    sents=[s.strip() for s in re.split(r'(?<=[。！？!?])',b['text']) if s.strip()] or ['……']
    vis=b.get('visual');vpath=os.path.join(a.repo,vis) if vis and a.repo else None
    base=None
    if not (vpath and os.path.exists(vpath)): vpath=None
    if vpath and vpath.endswith('.png'): base=Image.open(vpath).convert('RGB').resize((W,H))
    clipdur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',vpath],capture_output=True,text=True).stdout or 10) if vpath and vpath.endswith('.mp4') else 10
    elif not vpath: base=card(b,k,n)
    bstart=t0
    for j,s in enumerate(sents):
        wp=f'{tmp}/a{k:03d}_{j:02d}.wav';dur=tts(s,wp)+(0.25 if j<len(sents)-1 else 0.55)
        pad=f'{tmp}/p{k:03d}_{j:02d}.wav';subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wp,'-af',f'apad=whole_dur={dur:.3f}','-ar','24000','-ac','1',pad],check=True);auds.append(pad)
        ov=f'{tmp}/o{k:03d}_{j:02d}.png';sub_overlay(s).save(ov);seg=f'{tmp}/s{k:03d}_{j:02d}.mp4'
        if base is not None:
            fr=f'{tmp}/f{k:03d}_{j:02d}.png';im=base.copy().convert('RGBA');im.alpha_composite(Image.open(ov));im.convert('RGB').save(fr)
            subprocess.run(['ffmpeg','-y','-loglevel','error','-loop','1','-framerate',str(FPS),'-i',fr,'-t',f'{dur:.3f}','-c:v','libx264','-preset','veryfast','-tune','stillimage','-pix_fmt','yuv420p','-r',str(FPS),seg],check=True)
        else:
            off=(t0-bstart)%max(0.1,clipdur);subprocess.run(['ffmpeg','-y','-loglevel','error','-stream_loop','-1','-ss',f'{off:.3f}','-i',vpath,'-i',ov,'-filter_complex',f'[0:v]scale={W}:{H},fps={FPS}[v];[v][1:v]overlay=0:0','-t',f'{dur:.3f}','-an','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',seg],check=True)
        segs.append(seg);t0+=dur
    tl.append({'id':b['id'],'oid':b['oid'],'role':b['role'],'start':round(bstart,2),'end':round(t0,2),'visual':vis or ''})
open(f'{tmp}/v.txt','w').write(''.join(f"file '{x}'\n" for x in segs));open(f'{tmp}/a.txt','w').write(''.join(f"file '{x}'\n" for x in auds))
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',f'{tmp}/v.txt','-c','copy',f'{tmp}/v.mp4'],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',f'{tmp}/a.txt','-c:a','pcm_s16le',f'{tmp}/a.wav'],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'{tmp}/v.mp4','-i',f'{tmp}/a.wav','-c:v','copy','-c:a','aac','-b:a','96k','-shortest',a.out],check=True)
json.dump({'duration':round(t0,2),'voice':a.voice,'speed':a.speed,'blocks':tl},open(os.path.splitext(a.out)[0]+'.json','w',encoding='utf-8'),ensure_ascii=False)
print('ok',round(t0,1),'sec',os.path.getsize(a.out)//1024,'KB')
