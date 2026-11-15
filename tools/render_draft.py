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
ap.add_argument('--voice',type=int,default=2);ap.add_argument('--speed',type=float,default=1.1)
ap.add_argument('--final',action='store_true',help='本番用：場面の番号を出さない')
ap.add_argument('--subfont',type=int,default=1,help='字幕の見た目（1〜10。見本は字幕フォントの見本の画像）');a=ap.parse_args()
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
# 声の型（.vvm）は全部読むとメモリが足りないので、使う声が入っているものだけ読む
for f in sorted(os.listdir(f'{V}/models')):
    with VoiceModelFile.open(f'{V}/models/{f}') as m:
        if any(s.id==a.voice for c in m.metas for s in c.styles): syn.load_voice_model(m);break
else: raise SystemExit(f'声 {a.voice} の型が {V}/models にない（bash tools/setup_voice.sh を見直す）')
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
_FD='/home/claude/vv/fonts/'
SUBST={1:(FB,44,'white',3,(0,0,0),(0,0,0,135),False),2:(_FD+'Zen_Maru_Gothic_wght_700.ttf',48,'white',5,(0,0,0),None,False),3:(_FD+'M_PLUS_Rounded_1c_wght_800.ttf',48,'white',6,(20,30,60),None,False),
 4:(_FD+'BIZ_UDPGothic_wght_700.ttf',48,'white',1,(0,0,0),None,True),5:(_FD+'Zen_Kaku_Gothic_New_wght_700.ttf',48,(255,224,90),5,(0,0,0),None,False),6:(_FD+'Noto_Serif_JP_wght_700.ttf',46,'white',2,(0,0,0),None,True),
 7:(_FD+'RocknRoll_One.ttf',48,'white',7,(0,0,0),None,False),8:(_FD+'Murecho_wght_700.ttf',46,'white',0,(0,0,0),(10,14,20,175),False),9:(_FD+'Kiwi_Maru_wght_500.ttf',48,'white',6,(70,45,20),None,False),10:(_FD+'Dela_Gothic_One.ttf',46,'white',6,(0,0,0),None,False)}
def sub_overlay(text):
    """字幕：1行。--subfont の番号の見た目で（見本の画像と同じ番号）"""
    from PIL import ImageFilter
    im=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(im)
    if not text:return im
    fp,size,fill,stroke,sc,box,shadow=SUBST.get(a.subfont,SUBST[1])
    if not os.path.exists(fp):fp,size,fill,stroke,sc,box,shadow=SUBST[1]
    f=ImageFont.truetype(fp,size);tw=d.textlength(text,font=f);y=H-86
    if box:d.rounded_rectangle([W/2-tw/2-22,y-10,W/2+tw/2+22,y+size+14],12,fill=box)
    if shadow:
        sh=Image.new('RGBA',(W,H),(0,0,0,0));ImageDraw.Draw(sh).text((W/2+3,y+4),text,font=f,fill=(0,0,0,220),anchor='ma');im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4)));d=ImageDraw.Draw(im)
    d.text((W/2,y),text,font=f,fill=fill,anchor='ma',stroke_width=stroke,stroke_fill=sc)
    return im

import numpy as np
SR=24000
def wav_np(path):
    with wave.open(path) as w:return np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
def enc(args,out):subprocess.run(['ffmpeg','-y','-loglevel','error',*args,'-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-r',str(FPS),out],check=True)
def tag_overlay(text):
    im=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(im);f=ImageFont.truetype(FB,26);tw=d.textlength(text,font=f)
    d.rounded_rectangle([14,12,14+tw+24,12+44],8,fill=(220,40,40,200));d.text((26,16),text,font=f,fill=(255,255,255));return im
def char_time(sx,i,ends):
    """文 sx の i 文字目が話され始める時刻（モーラの数で文の声に合わせる）"""
    if i<=0 or not ends:return 0.0
    tot=nmora(sx) or 1;m=int(round(nmora(sx[:i])/tot*len(ends)));return 0.0 if m<=0 else ends[min(len(ends)-1,m-1)]
tmp=tempfile.mkdtemp();tl=[];T=0.0;n=len(seq);bvids=[];voice=[];sfx=[];allshots=[]
for k,b in enumerate(seq,1):
    sents=[s.strip() for s in re.split(r'(?<=[。！？!?])',b['text']) if s.strip()] or ['……']
    vis=b.get('visual');vpath=os.path.join(a.repo,vis) if vis and a.repo else None
    if not (vpath and os.path.exists(vpath)): vpath=None
    # 1) 声：文ごとに作り、文の間に少し間を置いてつなぐ
    arrs=[];offs=[];endsL=[];vend=[];t=0.0
    for j,sx in enumerate(sents):
        wp=f'{tmp}/a{k:03d}_{j:02d}.wav';d0=tts(sx,wp);x=wav_np(wp);gap=0.25 if j<len(sents)-1 else 0.55
        arrs.append(np.concatenate([x,np.zeros(int(gap*SR),np.float32)]));offs.append(t);endsL.append(LAST['ends']);vend.append(t+d0);t+=len(arrs[-1])/SR
    A=np.concatenate(arrs)
    # 2) カットの始まり：shots[].at（語りの中の言葉）が話され始める瞬間。at がなければ n（文の数）で区切る
    shots=b.get('shots') or []
    full=''.join(sents);cum=[0];[cum.append(cum[-1]+len(x)) for x in sents]
    def t_of_char(ci):
        j=max(jj for jj in range(len(sents)) if cum[jj]<=ci);return offs[j]+char_time(sents[j],ci-cum[j],endsL[j])
    starts=[];pos=0;sj=0
    for si,sh in enumerate(shots):
        if si==0:starts.append(0.0)
        elif sh.get('at'):
            ci=full.find(sh['at'],pos)
            if ci<0:raise SystemExit(f'見つからない言葉：場面 {k} の at「{sh["at"]}」が語りにない（語りを直したら at も直す）')
            pos=ci;starts.append(t_of_char(ci))
        else:starts.append(offs[min(sj,len(sents)-1)])
        sj+=int(sh.get('n',1)) if not sh.get('at') else 0
        if sh.get('at'):sj=max(jj for jj in range(len(sents)) if cum[jj]<=pos)+1
    # 3) 間（beat）：カットの頭で語りを止める
    # beat：カットの頭で語りを止める（動きを見せる）／hold：カットの終わりで語りを止める（アニメが終わるのを待つ）
    tot0=len(A)/SR
    sil=[(starts[i],float(sh['beat']),'beat',i) for i,sh in enumerate(shots) if float(sh.get('beat',0))>0]
    sil+=[((starts[i+1] if i+1<len(shots) else tot0),float(sh['hold']),'hold',i) for i,sh in enumerate(shots) if float(sh.get('hold',0))>0]
    for bt,L,_,_ in sorted(sil,key=lambda x:-x[0]):
        ix=min(len(A),int(bt*SR));A=np.concatenate([A[:ix],np.zeros(int(L*SR),np.float32),A[ix:]])
    beats=[(bt,L) for bt,L,_,_ in sil]
    sh_=lambda t,incl=True:t+sum(L for bt,L in beats if (bt<=t if incl else bt<t))
    def vstart_of(i,st):  # 同じ時刻に hold（前のカットの待ち）と beat（このカットの間）があれば、hold のあとから始まる
        return st+sum(L for bt,L,kd,ow in sil if bt<st)+sum(L for bt,L,kd,ow in sil if bt==st and kd=='hold' and ow!=i)
    # 長さをコマ（1/30秒）の目に合わせる：声の後ろを少し伸ばし、カットの境目もコマの目に置く（ずれが積もらないように）
    nf=int(math.ceil(len(A)/SR*FPS));A=np.concatenate([A,np.zeros(int(round(nf/FPS*SR))-len(A),np.float32)]) if int(round(nf/FPS*SR))>len(A) else A[:int(round(nf/FPS*SR))]
    D=nf/FPS;voice.append(A)
    vstarts=[round(vstart_of(i,st)*FPS)/FPS for i,st in enumerate(starts)]
    # 4) 字幕：塊ごとに、話し始める時刻から次の塊まで（文の終わりの長い間・カットの間には出さない）
    subs=[]
    for j,sx in enumerate(sents):
        ch=chunk_times(sx,endsL[j])
        for ci,(ct,rt) in enumerate(ch):
            st=sh_(offs[j]+rt);en=sh_(offs[j]+ch[ci+1][1]) if ci+1<len(ch) else sh_(vend[j])+0.25
            for bt,L in beats:
                b0=sh_(bt,False)
                if st<b0+0.01 and b0<en:en=max(st+0.3,b0)
            subs.append((ct,st,en))
    # 5) 画面：カットごとに部品で作ってつなぐ
    clips=[]
    if shots:
        import scenes
        for i,sh in enumerate(shots):
            d_=round(((vstarts[i+1] if i+1<len(shots) else D)-vstarts[i])*FPS)/FPS
            if d_<=0.05:continue
            spec={x:y for x,y in sh.items() if x not in('n','beat','at','ats')}
            if sh.get('ats'):
                ps=full.find(sh['at'],0) if sh.get('at') else 0;tms=[float(sh.get('beat',0))]
                for w_ in sh['ats']:
                    ci=full.find(w_,max(0,ps))
                    if ci<0:print('見つからない言葉:',k,w_,file=sys.stderr);tms.append(tms[-1]+1);continue
                    ps=ci;tms.append(round(sh_(t_of_char(ci))-vstarts[i],3))
                spec['times']=tms
            cp=f'{tmp}/c{k:03d}_{i:02d}.mp4';scenes.make(spec,d_,cp,a.repo);clips.append(cp)
            if os.path.exists(cp+'.sfx.json'):
                for e in json.load(open(cp+'.sfx.json')):
                    e=[e,'whoosh'] if isinstance(e,(int,float)) else list(e);sfx.append((T+vstarts[i]+e[0],*e[1:]))
            allshots.append({'tag':f'{k}-{i+1}','block':b['id'],'role':b['role'],'start':round(T+vstarts[i],2),'end':round(T+vstarts[i]+d_,2),'t':sh.get('t') or 'seq','at':sh.get('at','')})
    else:
        cp=f'{tmp}/c{k:03d}_00.mp4'
        if vpath and vpath.endswith('.mp4'):enc(['-stream_loop','-1','-i',vpath,'-t',f'{D:.3f}','-vf',f'scale={W}:{H},fps={FPS}'],cp)
        else:
            fr=f'{tmp}/f{k:03d}.png';(Image.open(vpath).convert('RGB').resize((W,H)) if vpath else card(b,k,n)).save(fr)
            enc(['-loop','1','-framerate',str(FPS),'-i',fr,'-t',f'{D:.3f}'],cp)
        clips.append(cp);allshots.append({'tag':f'{k}-1','block':b['id'],'role':b['role'],'start':round(T,2),'end':round(T+D,2),'t':'visual'})
    open(f'{tmp}/l{k}.txt','w').write(''.join(f"file '{x}'\n" for x in clips))
    raw=f'{tmp}/raw{k:03d}.mp4';subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',f'{tmp}/l{k}.txt','-c','copy',raw],check=True)
    # 6) 字幕と場面の番号を重ねる
    inp=['-i',raw];fc=f'[0:v]scale={W}:{H},fps={FPS},tpad=stop_mode=clone:stop_duration=2[v0]';last='v0';q=1
    lays=[(sub_overlay(tx),st,en) for tx,st,en in subs]
    if not a.final:lays+=[(tag_overlay(f'場面 {k}-{i+1}'),vstarts[i],(vstarts[i+1] if i+1<len(vstarts) else D)) for i in range(len(vstarts) or 1)] if shots else [(tag_overlay(f'場面 {k}-1'),0,D)]
    for li,(im,st,en) in enumerate(lays):
        pth=f'{tmp}/ov{k:03d}_{li:03d}.png';im.save(pth);inp+=['-i',pth]
        fc+=f";[{last}][{q}:v]overlay=0:0:enable='between(t,{st:.3f},{max(st,en-0.001):.3f})'[v{q}]";last=f'v{q}';q+=1
    bv=f'{tmp}/b{k:03d}.mp4';enc([*inp,'-filter_complex',fc,'-map',f'[{last}]','-t',f'{D:.3f}'],bv);bvids.append(bv)
    tl.append({'id':b['id'],'oid':b['oid'],'role':b['role'],'start':round(T,2),'end':round(T+D,2),'visual':vis or ''});T+=D
open(f'{tmp}/v.txt','w').write(''.join(f"file '{x}'\n" for x in bvids))
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',f'{tmp}/v.txt','-c','copy',f'{tmp}/v.mp4'],check=True)
# 7) 効果音：部品が「ここで鳴らす」と決めた所だけ（切り替わりのたびには鳴らさない）
mix=np.concatenate(voice);rng=np.random.default_rng(1)
def _noise(m,lo,hi):
    x=rng.standard_normal(m);X=np.fft.rfft(x);f=np.fft.rfftfreq(m,1/SR);X[(f<lo)|(f>hi)]=0;y=np.fft.irfft(X,m);return y/np.abs(y).max()
def snd(kind):
    if kind=='whoosh':m=int(SR*0.3);return 0.13*_noise(m,400,5000)*np.sin(np.linspace(0,np.pi,m))**2
    if kind=='pop':m=int(SR*0.09);tt=np.arange(m)/SR;return 0.16*np.sin(2*np.pi*(900-3000*tt)*tt)*np.exp(-tt*40)
    if kind=='thump':m=int(SR*0.25);tt=np.arange(m)/SR;return 0.32*np.sin(2*np.pi*(95-120*tt)*tt)*np.exp(-tt*18)
    if kind=='tick':m=int(SR*0.03);tt=np.arange(m)/SR;return 0.12*np.sin(2*np.pi*2200*tt)*np.exp(-tt*160)
    if kind=='boing':m=int(SR*0.7);tt=np.arange(m)/SR;f=220+90*np.sin(2*np.pi*7*tt)*np.exp(-tt*3)+120*np.exp(-tt*4);return 0.16*np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*4.5)
    if kind=='puff':m=int(SR*0.35);return 0.10*_noise(m,150,1500)*np.exp(-np.linspace(0,6,m))*np.sin(np.linspace(0,np.pi/2,m))
    return np.zeros(1)
def snd_long(kind,dur,rise=None,amt=1.0):
    m=int(SR*dur);tt=np.arange(m)/SR
    if kind=='rattle':
        y=np.zeros(m);r=np.random.default_rng(5);k=0
        while k<m:
            L=int(SR*0.03);seg=r.standard_normal(min(L,m-k))*np.exp(-np.linspace(0,8,min(L,m-k)));y[k:k+len(seg)]+=seg*0.5;k+=int(SR*r.uniform(0.05,0.11))
        low=0.6*np.sin(2*np.pi*55*tt)*(0.5+0.5*np.sign(np.sin(2*np.pi*9*tt)))
        return 0.09*amt*(y+low*0.4)*np.minimum(1,np.minimum(tt/0.15,(dur-tt)/0.2))
    if kind=='car':  # 遠くを通り過ぎる車（小さく、近づいて遠ざかる）
        env=np.exp(-((tt-dur/2)/(dur/4))**2);return 0.05*amt*_noise(m,80,1200)*env
    if kind in('engine','motor'):
        f0,f1=(45,110) if kind=='engine' else (150,420);r0=(rise if rise is not None else 0);f=f0+(f1-f0)*np.clip((tt-r0)/max(0.1,(dur-r0)*0.8),0,1);ph=2*np.pi*np.cumsum(f)/SR   # rise 秒まではゆっくり（低い音のまま）
        y=np.sign(np.sin(ph))*0.5+np.sin(2*ph)*0.3+_noise(m,80,900)*0.15
        return (0.08 if kind=='engine' else 0.05)*amt*y*np.minimum(1,np.minimum(tt/0.2,(dur-tt)/0.3))
    return np.zeros(1)
for e in sfx:
    tt,kd=e[0],e[1]
    w_=snd_long(kd,e[2],e[3] if len(e)>3 else None) if len(e)>2 else snd(kd);i=int(max(0,tt-(0.08 if kd=='whoosh' else 0))*SR);mix[i:i+len(w_)]+=w_[:max(0,len(mix)-i)]
mix=np.clip(mix,-1,1)
with wave.open(f'{tmp}/m.wav','wb') as wv: wv.setnchannels(1);wv.setsampwidth(2);wv.setframerate(SR);wv.writeframes((mix*32767).astype(np.int16).tobytes())
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'{tmp}/v.mp4','-i',f'{tmp}/m.wav','-c:v','copy','-c:a','aac','-b:a','128k','-shortest',a.out],check=True)
json.dump({'duration':round(T,2),'voice':a.voice,'speed':a.speed,'blocks':tl,'shots':allshots},open(os.path.splitext(a.out)[0]+'.json','w',encoding='utf-8'),ensure_ascii=False)
print('ok',round(T,1),'sec',os.path.getsize(a.out)//1024,'KB')
