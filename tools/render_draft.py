"""仮の動画（ドラフト）を組み立てる。
使い方:
  python3 tools/render_draft.py --data <data.json> --proj <制作のid> --repo <notion-daily の場所> --out <出力.mp4> [--voice 2] [--speed 1.1]
- 肉付け（flesh）があればその語り、なければ構成（outline）の text を読み上げる
- 画面：段に `visual`（データのリポジトリ内の .png か .mp4 のパス）があればそれを使い、なければ「画面の指示」を書いた絵コンテのカードを出す
- 字幕：語りを一文ずつ下に出す
- <出力>.json に、段ごとの開始・終了の秒数を書く（「2:10 ここを直す」を段に結びつけるため）
先に bash tools/setup_voice.sh を一度実行しておく。
"""
import argparse, json, os, re, subprocess, tempfile, wave, math, sys
sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'vis'))
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
    seq=[{'id':b['id'],'oid':b['oid'],'role':b.get('role',''),'text':b.get('narr',''),'screen':b.get('screen',''),'visual':b.get('visual') or ob[oi[b['oid']]].get('visual'),'shots':b.get('shots')} for b in live]
else:
    seq=[{'id':b['id'],'oid':b['id'],'role':b.get('role',''),'text':b.get('text',''),'screen':b.get('show',''),'visual':b.get('visual')} for b in ob if b.get('mark')!='削る']
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile
ort=Onnxruntime.load_once(filename=f'{V}/ort/voicevox_onnxruntime-linux-x64-1.17.3/lib/libvoicevox_onnxruntime.so.1.17.3')
syn=Synthesizer(ort,OpenJtalk(f'{V}/dict/open_jtalk_dic_utf_8-1.11'))
for f in sorted(os.listdir(f'{V}/models')):
    with VoiceModelFile.open(f'{V}/models/{f}') as m: syn.load_voice_model(m)
def _moras(q):
    """AudioQuery から、モーラごとの終わりの時刻（話す速さ込み）を出す"""
    t=q.pre_phoneme_length;ends=[]
    for ap in q.accent_phrases:
        for m in ap.moras:
            g=(lambda k:m.get(k)) if isinstance(m,dict) else (lambda k:getattr(m,k))
            t+=((g('consonant_length') or 0)+g('vowel_length'));ends.append(t)
        pm=ap.pause_mora
        if pm:t+=(pm['vowel_length'] if isinstance(pm,dict) else pm.vowel_length)
    return [e/q.speed_scale for e in ends],(t+q.post_phoneme_length)/q.speed_scale
def nmora(text):
    try:return sum(len(ap.moras) for ap in syn.create_audio_query(text,a.voice).accent_phrases)
    except Exception:return max(1,len(text))
LAST={}
def tts(text,path):
    q=syn.create_audio_query(text,a.voice);q.speed_scale=a.speed;q.post_phoneme_length=0.15
    open(path,'wb').write(syn.synthesis(q,a.voice))
    with wave.open(path) as w: d=w.getnframes()/w.getframerate()
    ends,tot=_moras(q);k=d/max(0.01,tot);LAST['ends']=[e*k for e in ends]
    return d
# ---- 字幕の区切り：語りに合わせて、読みやすい長さ（1行・{MIN}〜{MAX}字）で出す ----
import fugashi
_tg=fugashi.Tagger()
SUB_MAX=21;SUB_MIN=7
def units(text):
    """文節くらいの単位に分ける（助詞・助動詞・句読点のあとで切れる）"""
    ws=list(_tg(text));out=[];cur='';dep=0
    for i,w in enumerate(ws):
        dep+=(w.feature.pos2=='括弧開')-(w.feature.pos2=='括弧閉')
        cur+=w.surface;p=w.feature.pos1;nx=ws[i+1].feature.pos1 if i+1<len(ws) else None;nx2=ws[i+1].feature.pos2 if i+1<len(ws) else None
        if dep>0 or w.feature.pos2=='括弧開' or nx2=='括弧閉':continue          # 「 のすぐ後・」の前では切らない
        if nx2=='数詞' and w.surface=='の':continue                     # 「3分の1」を割らない
        if p in ('助詞','助動詞','補助記号') and nx not in ('助詞','助動詞','補助記号','接尾辞',None):out.append(cur);cur=''
    if cur:out.append(cur)
    return out
def chunks(sent):
    """一文を字幕の塊に分ける。読点で切り、長い所は文節の切れ目でほぼ等分、短すぎる塊は隣とまとめる"""
    clauses=[c for c in re.split(r'(?<=[、，])',sent) if c.strip()]
    out=[]
    for c in clauses:
        if len(c)<=SUB_MAX:out.append(c);continue
        us=units(c);k=math.ceil(len(c)/SUB_MAX);tgt=len(c)/k;cur=''
        for u in us:
            if cur and (len(cur)+len(u)>SUB_MAX or len(cur)>=tgt*0.85):out.append(cur);cur=''
            cur+=u
        if cur:out.append(cur)
    m=[]
    for c in out:
        if m and (len(c)<SUB_MIN or len(m[-1])<SUB_MIN) and len(m[-1])+len(c)<=SUB_MAX:m[-1]+=c
        else:m.append(c)
    return m
def chunk_times(sent,ends):
    """各塊が話され始める時刻（モーラの数で、文全体の時刻に合わせる）"""
    cs=chunks(sent);ns=[nmora(c) for c in cs];tot=sum(ns) or 1;N=len(ends);ts=[];acc=0
    for c,n in zip(cs,ns):
        i=int(round(acc/tot*N));ts.append(0 if i<=0 else ends[min(N-1,i-1)]);acc+=n
    return [(c.rstrip('、。，'),t) for c,t in zip(cs,ts)]
def wrap(t,n=26):
    out=[];cur=''
    for ch in t:
        cur+=ch
        if len(cur)>=n and ch in '、。！？）」 ' or len(cur)>=n+6: out.append(cur);cur=''
    if cur:
        if out and len(cur)<=2: out[-1]+=cur
        else: out.append(cur)
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
    im=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(im);f=ImageFont.truetype(FB,40)
    if not text:return im
    tw=d.textlength(text,font=f);y=H-78
    d.rounded_rectangle([W/2-tw/2-22,y-10,W/2+tw/2+22,y+58],12,fill=(0,0,0,135))
    d.text((W/2,y),text,font=f,fill=(255,255,255),anchor='ma',stroke_width=3,stroke_fill=(0,0,0))
    return im
tmp=tempfile.mkdtemp();segs=[];auds=[];tl=[];t0=0.0;n=len(seq);cuts=[];pops=[]
for k,b in enumerate(seq,1):
    sents=[s.strip() for s in re.split(r'(?<=[。！？!?])',b['text']) if s.strip()] or ['……']
    vis=b.get('visual');vpath=os.path.join(a.repo,vis) if vis and a.repo else None
    base=None
    if not (vpath and os.path.exists(vpath)): vpath=None
    if vpath and vpath.endswith('.png'): base=Image.open(vpath).convert('RGB').resize((W,H));vpath=None
    elif not vpath: base=card(b,k,n)
    clipdur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',vpath],capture_output=True,text=True).stdout or 10) if vpath and vpath.endswith('.mp4') else 10
    bstart=t0
    # 先に全部の文の声を作る
    durs=[];pads=[];cts=[]
    for j,sx in enumerate(sents):
        wp=f'{tmp}/a{k:03d}_{j:02d}.wav';dur=tts(sx,wp)+(0.25 if j<len(sents)-1 else 0.55);cts.append(chunk_times(sx,LAST['ends']))
        pad=f'{tmp}/p{k:03d}_{j:02d}.wav';subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wp,'-af',f'apad=whole_dur={dur:.3f}','-ar','24000','-ac','1',pad],check=True);durs.append(dur);pads.append(pad)
    # カット（shots）：文の並びをまとまりに分け、まとまりごとに部品で画面を作る
    groups=[]
    if b.get('shots'):
        j=0
        for sh in b['shots']:
            m=int(sh.get('n',1));groups.append((j,min(len(sents),j+m),sh));j+=m
            if j>=len(sents):break
        if j<len(sents):groups.append((j,len(sents),groups[-1][2] if groups else None))
    else: groups=[(0,len(sents),None)]
    for gi,(j0,j1,sh) in enumerate(groups):
        beat=float(sh.get('beat',0)) if sh else 0
        gdur=sum(durs[j0:j1])+beat;gpath=None
        if sh:
            import scenes
            gpath=f'{tmp}/shot{k:03d}_{gi:02d}.mp4';scenes.make({x:y for x,y in sh.items() if x not in('n','beat')},gdur+0.1,gpath,a.repo);cuts.append(t0)
            if os.path.exists(gpath+'.sfx.json'):pops.extend(t0+x for x in json.load(open(gpath+'.sfx.json')))
        elif gi==0 and vpath: cuts.append(t0)
        g0=t0
        if beat>0 and gpath:
            sil=f'{tmp}/b{k:03d}_{gi:02d}.wav';subprocess.run(['ffmpeg','-y','-loglevel','error','-f','lavfi','-i','anullsrc=r=24000:cl=mono','-t',f'{beat:.3f}',sil],check=True);auds.append(sil)
            seg=f'{tmp}/sb{k:03d}_{gi:02d}.mp4';subprocess.run(['ffmpeg','-y','-loglevel','error','-i',gpath,'-t',f'{beat:.3f}','-vf',f'scale={W}:{H},fps={FPS}','-an','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',seg],check=True);segs.append(seg);t0+=beat
        for j in range(j0,j1):
            sx=sents[j];dur=durs[j];auds.append(pads[j])
            seg=f'{tmp}/s{k:03d}_{j:02d}.mp4';ch=cts[j];ovs=[]
            for ci,(ct,cs_) in enumerate(ch):
                ov=f'{tmp}/o{k:03d}_{j:02d}_{ci:02d}.png';sub_overlay(ct).save(ov);ce=ch[ci+1][1] if ci+1<len(ch) else dur+1;ovs.append((ov,cs_,ce))
            src=gpath or vpath
            if src is None:
                fr=f'{tmp}/f{k:03d}_{j:02d}.png';base.convert('RGB').save(fr);inp=['-loop','1','-framerate',str(FPS),'-i',fr]
            else:
                cd_=gdur+0.1 if gpath else clipdur;off=((t0-g0) if gpath else (t0-bstart))%max(0.1,cd_);inp=['-stream_loop','-1','-ss',f'{off:.3f}','-i',src]
            fc=f'[0:v]scale={W}:{H},fps={FPS}[v0]';last='v0'
            for oi,(ov,cs_,ce) in enumerate(ovs):
                inp+=['-i',ov];fc+=f";[{last}][{oi+1}:v]overlay=0:0:enable='between(t,{cs_:.3f},{ce-0.001:.3f})'[v{oi+1}]";last=f'v{oi+1}'
            subprocess.run(['ffmpeg','-y','-loglevel','error',*inp,'-filter_complex',fc,'-map',f'[{last}]','-t',f'{dur:.3f}','-an','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-r',str(FPS),seg],check=True)
            segs.append(seg);t0+=dur
    tl.append({'id':b['id'],'oid':b['oid'],'role':b['role'],'start':round(bstart,2),'end':round(t0,2),'visual':vis or ''})
open(f'{tmp}/v.txt','w').write(''.join(f"file '{x}'\n" for x in segs));open(f'{tmp}/a.txt','w').write(''.join(f"file '{x}'\n" for x in auds))
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',f'{tmp}/v.txt','-c','copy',f'{tmp}/v.mp4'],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',f'{tmp}/a.txt','-c:a','pcm_s16le',f'{tmp}/a.wav'],check=True)
import numpy as np
SR=24000
with wave.open(f'{tmp}/a.wav') as wv: voice=np.frombuffer(wv.readframes(wv.getnframes()),np.int16).astype(np.float32)/32768;vsr=wv.getframerate()
mix=voice.copy();rng=np.random.default_rng(1)
def whoosh(dur=0.35,amp=0.10):
    m=int(vsr*dur);x=rng.standard_normal(m);X=np.fft.rfft(x);f=np.fft.rfftfreq(m,1/vsr);X[(f<400)|(f>5000)]=0;y=np.fft.irfft(X,m);return amp*y/np.abs(y).max()*np.sin(np.linspace(0,np.pi,m))**2
for ct in cuts:
    i=int(max(0,ct-0.12)*vsr);w_=whoosh();mix[i:i+len(w_)]+=w_[:max(0,len(mix)-i)]
for ct in pops:  # ぐいっと寄るときは少し強めで短いシュッ
    i=int(max(0,ct-0.05)*vsr);w_=whoosh(0.25,0.14);mix[i:i+len(w_)]+=w_[:max(0,len(mix)-i)]
mix=np.clip(mix,-1,1)
with wave.open(f'{tmp}/m.wav','wb') as wv: wv.setnchannels(1);wv.setsampwidth(2);wv.setframerate(vsr);wv.writeframes((mix*32767).astype(np.int16).tobytes())
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'{tmp}/v.mp4','-i',f'{tmp}/m.wav','-c:v','copy','-c:a','aac','-b:a','128k','-shortest',a.out],check=True)
json.dump({'duration':round(t0,2),'voice':a.voice,'speed':a.speed,'blocks':tl},open(os.path.splitext(a.out)[0]+'.json','w',encoding='utf-8'),ensure_ascii=False)
print('ok',round(t0,1),'sec',os.path.getsize(a.out)//1024,'KB')
