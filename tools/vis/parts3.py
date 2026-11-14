"""部品の追加分（3）：記録映像・道の割合・幹線道路・波形・見比べ・年表・人の声・そぎ落とし・速度計・ブラウザで描く場面
どの部品も、意味のある瞬間にだけ c.sfx に [秒, 種類] を足す（種類：whoosh・pop・thump・tick・puff）"""
import math, os, json, subprocess, tempfile, random
from base import *
from parts2 import icon
HERE=os.path.dirname(os.path.abspath(__file__))
def _label_top(d,text,a=1.0,y=92,size=46):
    if not text or a<=0:return
    f=font(int(size*max(0.3,min(1.1,a))));tw=d.textlength(text,font=f)
    d.rounded_rectangle([W/2-tw/2-24,y-40,W/2+tw/2+24,y+40],14,fill=(10,14,20,int(185*min(1,a))));d.text((W/2,y),text,font=f,fill=WHITE+(int(255*min(1,a)),),anchor='mm')
# ---------- 記録映像（動画ファイルの一部） ----------
def clip_video(s,dur,out,repo=''):
    """s: src（動画のパス）, start（秒）, speed（1＝そのまま。0.8 でゆっくり）, text（上に出す言葉）, credit（右下の小さな出典）"""
    src=s['src'] if os.path.isabs(s['src']) else os.path.join(repo,s['src'])
    sp=float(s.get('speed',1.0));need=dur*sp
    tmp=tempfile.mkdtemp();ov=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(ov,'RGBA')
    if s.get('text'):_label_top(d,s['text'])
    if s.get('credit'):f=font(18,False);d.text((W-16,H-14),s['credit'],font=f,fill=(255,255,255,170),anchor='rd')
    ov.save(f'{tmp}/ov.png')
    vf=f"setpts={1/sp}*PTS,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},tpad=stop_mode=clone:stop_duration={dur}"
    subprocess.run(['ffmpeg','-y','-loglevel','error','-ss',str(s.get('start',0)),'-t',f'{need+0.2:.3f}','-i',src,'-i',f'{tmp}/ov.png','-filter_complex',f'[0:v]{vf}[v];[v][1:v]overlay=0:0','-t',f'{dur:.3f}','-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',out],check=True)
# ---------- 道の割合（3本に1本） / 幹線道路だけ舗装 ----------
def _road(im,y,h,kind,u,x0=420,x1=1180):
    d=ImageDraw.Draw(im,'RGBA');xe=x0+(x1-x0)*u
    if xe<=x0+2:return
    if kind=='paved':
        d.rectangle([x0,y-h/2,xe,y+h/2],fill=(70,74,82));d.line([(x0,y-h/2),(xe,y-h/2)],fill=(200,200,200),width=3);d.line([(x0,y+h/2),(xe,y+h/2)],fill=(200,200,200),width=3)
        for x in range(int(x0+20),int(xe)-30,70):d.rectangle([x,y-3,x+36,y+3],fill=(240,240,230))
    else:
        d.rectangle([x0,y-h/2,xe,y+h/2],fill=SAND)
        for x in range(int(x0+10),int(xe)-8,26):d.rectangle([x,y-h/2+6,x+9,y+h/2-6],fill=(170,138,94))
def roads(s,dur,c,repo):
    mode=s.get('mode','share');N=c.N
    if mode=='share':
        import scenes
        g=scenes.geo();usa=[f for f in g['features'] if f['properties'].get('ADM0_A3')=='USA'][0]['geometry']['coordinates']
        rings=[r[0] for r in usa if max(p[0] for p in r[0])<-60 and min(p[1] for p in r[0])>20]
        X=lambda lon:60+(lon+125)/(125-66)*300;Y=lambda lat:H*0.5-(lat-37)*6.2
        rows=[('paved',H*0.30),('paved',H*0.48),('dirt',H*0.66)];marks=set()
        for n in range(N):
            t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
            a=ease(t/0.4)
            for r in rings:d.polygon([(X(x),Y(y)) for x,y in r],fill=SAND+(int(255*a),))
            for i,(k,y) in enumerate(rows):
                t0=0.3+i*0.45;u=eout((t-t0)/0.5)
                if u>0 and i not in marks:c.sfx.append([t0,'tick']);marks.add(i)
                _road(im,y,70,k,u)
            d=ImageDraw.Draw(im,'RGBA');tb=0.3+3*0.45+0.4
            if t>tb:
                k=back((t-tb)/0.35);d.rounded_rectangle([410,rows[2][1]-50,1190,rows[2][1]+50],14,outline=(242,194,48,255),width=6)
                if 'b' not in marks:c.sfx.append([tb,'pop']);marks.add('b')
                f=font(int(46*max(0.2,k)));d.text((800,rows[2][1]+92),s.get('text','約3分の1が未舗装'),font=f,fill=WHITE,anchor='mm',stroke_width=4,stroke_fill=(0,0,0))
            d.text((210,H*0.5+130),'アメリカ',font=font(36),fill=WHITE+(int(255*a),),anchor='mm')
            c.add(im)
    else:  # trunk：太い舗装道路が一本通り、そこから土の道が枝分かれして広がる
        rr=random.Random(4);br=[]
        for i in range(14):
            x=120+i*80+rr.uniform(-20,20);up=rr.random()<0.5;L=rr.uniform(120,300);ang=rr.uniform(-0.5,0.5)
            br.append((x,up,L,ang,0.9+i*0.12))
        towns=[(rr.uniform(80,1200),rr.uniform(120,620)) for _ in range(22)]
        for n in range(N):
            t=n/FPS;im=Image.new('RGBA',(W,H),(128,146,96,255));d=ImageDraw.Draw(im,'RGBA')
            for x,y in towns:d.ellipse([x-5,y-5,x+5,y+5],fill=(90,104,66))
            for x,up,L,ang,t0 in br:
                u=eout((t-t0)/0.6)
                if u<=0:continue
                sgn=-1 if up else 1;pts=[(x+math.sin(ang)*L*u*q,H*0.5+sgn*L*u*q*math.cos(ang)) for q in (0,0.5,1)];pts[1]=(pts[1][0]+20*math.sin(x),pts[1][1])
                d.line(pts,fill=SAND,width=9,joint='curve')
            u=eout((t-0.2)/0.7);d.rectangle([0,H*0.5-16,W*u,H*0.5+16],fill=(66,70,78));d.line([(0,H*0.5-16),(W*u,H*0.5-16)],fill=(210,210,210),width=3);d.line([(0,H*0.5+16),(W*u,H*0.5+16)],fill=(210,210,210),width=3)
            for x in range(10,int(W*u)-30,60):d.rectangle([x,H*0.5-2,x+30,H*0.5+2],fill=(240,240,230))
            _label_top(d,s.get('text','舗装されているのは幹線道路だけ'),back((t-1.6)/0.35),y=80)
            c.add(im)
# ---------- 波形（リズムのある波） ----------
def wave(s,dur,c,repo):
    N=c.N;base=430;lam=170;A=34;done=set()
    for n in range(N):
        t=n/FPS;u=min(1,t/max(0.8,dur*0.6));xe=40+(W-80)*u;im=SKY.copy().convert('RGBA')
        top=lambda x:base-A*math.sin(2*math.pi*(x-40)/lam)
        ground(im,top,x1=int(xe));d=ImageDraw.Draw(im,'RGBA')
        for k in range(8):
            xc=40+lam*(k+0.25)
            if xc<xe:
                if k not in done:c.sfx.append([t,'tick']);done.add(k)
                d.line([(xc,base-A-60),(xc,base-A-30)],fill=(242,194,48),width=6)
        _label_top(d,s.get('text','リズムのある波形'),back((t-0.2)/0.35))
        c.add(im)
# ---------- 二つを見比べる（写真と写真） ----------
def compare(s,dur,c,repo):
    from scenes import load_img,cover
    L=s['items'];N=c.N;ims=[]
    for it in L:
        im=load_img(it['src'],repo);im=cover(im,620,560);x=(im.width-620)//2;y=(im.height-560)//2;ims.append(im.crop((x,y,x+620,y+560)))
    for n in range(N):
        t=n/FPS;fr=SKY.copy().convert('RGBA');d=ImageDraw.Draw(fr,'RGBA')
        for i,(it,im) in enumerate(zip(L,ims)):
            t0=0.1+i*0.6;u=eout((t-t0)/0.45)
            if u<=0:continue
            if n==int(t0*FPS):c.sfx.append([t0,'whoosh'])
            x=(20 if i==0 else 640)+(1-u)*(-300 if i==0 else 300);fr.paste(im,(int(x),60))
            d=ImageDraw.Draw(fr,'RGBA');f=font(40);tw=d.textlength(it['label'],font=f);cx=x+310
            d.rounded_rectangle([cx-tw/2-20,580,cx+tw/2+20,640],12,fill=(10,14,20,200));d.text((cx,610),it['label'],font=f,fill=WHITE,anchor='mm')
        if s.get('eq') and t>1.4:k=back((t-1.4)/0.3);d.text((W/2,330),'＝',font=font(int(110*max(.1,k))),fill=(242,194,48),anchor='mm',stroke_width=6,stroke_fill=(0,0,0))
        c.add(fr)
# ---------- 年表 ----------
def timeline(s,dur,c,repo):
    ev=s['events'];N=c.N;x0,x1,y=140,1140,H*0.55;per=max(0.5,(dur*0.7)/len(ev));hl=s.get('highlight',len(ev)-1)
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        u=eout(t/0.5);d.line([(x0,y),(x0+(x1-x0)*u,y)],fill=GREY,width=6)
        for i,e in enumerate(ev):
            t0=0.4+i*per;k=back((t-t0)/0.35)
            if k<=0:continue
            if n==int(t0*FPS):c.sfx.append([t0,'pop'])
            x=x0+(x1-x0)*(i/(max(1,len(ev)-1)));on=i==hl
            r=(26 if on else 18)*k;d.ellipse([x-r,y-r,x+r,y+r],fill=(242,194,48) if on else (200,210,220))
            if e.get('icon'):d.ellipse([x-62*k,y-200-62*k,x+62*k,y-200+62*k],fill=(60,76,98));icon(d,e['icon'],x,y-200,78*k)
            d.text((x,y+52),e['year'],font=font(40 if on else 34),fill=(242,194,48) if on else WHITE,anchor='mm')
            if e.get('label'):d.text((x,y+100),e['label'],font=font(30),fill=GREY if not on else WHITE,anchor='mm')
        c.add(im)
# ---------- 人の声（いろいろな説） ----------
def _person(d,x,y,s,coat=False,col=(25,30,40)):
    d.ellipse([x-26*s,y-110*s,x+26*s,y-58*s],fill=col);d.pieslice([x-56*s,y-50*s,x+56*s,y+60*s],180,360,fill=(235,238,242) if coat else col)
    if coat:d.line([(x,y-50*s),(x,y+5*s)],fill=(160,165,175),width=3);d.ellipse([x-18*s,y-92*s,x-4*s,y-80*s],outline=(200,210,220),width=2);d.ellipse([x+4*s,y-92*s,x+18*s,y-80*s],outline=(200,210,220),width=2)
def voices(s,dur,c,repo):
    its=s['items'];N=c.N;coat=s.get('who')=='research';n_=len(its)
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        for i,it in enumerate(its):
            x=W*(i+1)/(n_+1);y=H*0.80;_person(d,x,y,1.4,coat)
            t0=(s['times'][i] if s.get('times') and i<len(s['times']) else 0.25+i*min(0.55,dur*0.6/n_));k=back((t-t0)/0.3)
            if k<=0:continue
            if n==int(t0*FPS):c.sfx.append([t0,'pop'])
            bx,by=x,H*0.38;r=95*k
            d.ellipse([bx-r,by-r*0.85,bx+r,by+r*0.85],fill=(245,245,240));d.polygon([(bx-14*k,by+r*0.78),(bx+14*k,by+r*0.78),(x,y-170)],fill=(245,245,240))
            icon(d,it['icon'],bx,by,110*k,col=(50,60,75))
            if it.get('label'):d.text((bx,by+r*0.85+30),it['label'],font=font(28),fill=WHITE,anchor='mm',stroke_width=3,stroke_fill=(0,0,0))
        c.add(im)
# ---------- そぎ落とす（車から車輪と砂だけを残す） ----------
def strip(s,dur,c,repo):
    N=c.N;parts=['body','engine','spring','rear'];per=max(0.45,dur*0.55/len(parts));gy=560
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');top=lambda x:gy;ground(im,top);d=ImageDraw.Draw(im,'RGBA');cx=640
        def gone(i):
            t0=0.4+i*per;u=(t-t0)/0.6
            if n==int(t0*FPS):c.sfx.append([t0,'whoosh'])
            return max(0,u)
        g=gone(0)
        if g<1:o=-g*500;a=int(255*(1-g));d.rounded_rectangle([cx-260,gy-230+o,cx+260,gy-110+o],28,fill=(225,228,235,a),outline=(120,125,135,a),width=4);d.rounded_rectangle([cx-140,gy-310+o,cx+120,gy-220+o],22,fill=(225,228,235,a),outline=(120,125,135,a),width=4)
        g=gone(1)
        if g<1:o=-g*600;a=int(255*(1-g));d.rectangle([cx+120+g*300,gy-200+o,cx+230+g*300,gy-130+o],fill=(110,112,120,a));d.text((cx+175+g*300,gy-165+o),'エンジン',font=font(20),fill=(255,255,255,a),anchor='mm')
        g=gone(2)
        if g<1:
            o=-g*500;a=int(255*(1-g))
            for sx in (cx-170,cx+170):d.line([(sx+(-12 if k%2 else 12),gy-110+o+k*9) for k in range(8)],fill=(200,205,215,a),width=5)
        g=gone(3)
        if g<1:wheel(d,cx+170+g*700,gy-62,62,t*3)
        wheel(d,cx-170+min(1,ease((t-0.4-4*per)/0.6))*170,gy-62,62,t*3)
        if t>0.4+4*per+0.4:_label_top(d,s.get('text','車輪と、ゆるい砂だけ'),back((t-0.4-4*per-0.4)/0.35))
        c.add(im)
# ---------- 速度計（答えはまだ伏せる） ----------
def gauge_q(s,dur,c,repo):
    N=c.N;cx,cy,R=W/2,H*0.62,250
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        d.pieslice([cx-R,cy-R,cx+R,cy+R],180,360,fill=(44,58,74));d.arc([cx-R,cy-R,cx+R,cy+R],180,360,fill=(150,165,180),width=10)
        for k in range(11):
            a=math.radians(180+k*18);d.line([(cx+(R-30)*math.cos(a),cy+(R-30)*math.sin(a)),(cx+(R-8)*math.cos(a),cy+(R-8)*math.sin(a))],fill=WHITE,width=5)
        v=0.5+0.45*math.sin(t*2.2)*math.exp(-t*0.3)
        a=math.radians(180+180*v);d.line([(cx,cy),(cx+(R-40)*math.cos(a),cy+(R-40)*math.sin(a))],fill=RED,width=10);d.ellipse([cx-16,cy-16,cx+16,cy+16],fill=WHITE)
        k=back((t-0.5)/0.35)
        if n==int(0.5*FPS):c.sfx.append([0.5,'pop'])
        d.rounded_rectangle([cx-120,cy+30,cx+120,cy+110],16,fill=(10,14,20))
        d.text((cx,cy+70),'？ km/h',font=font(int(52*max(0.2,k))),fill=(242,194,48),anchor='mm')
        c.add(im)
# ---------- ブラウザで描く場面（tools/vis/html/<page>.html の render(t) を一コマずつ撮る） ----------
def html_scene(s,dur,out,repo=''):
    import asyncio,base64
    from playwright.async_api import async_playwright
    page=os.path.join(HERE,'html',s['page']+'.html');params={k:v for k,v in s.items() if k not in('t','page','cam')}
    async def run():
        async with async_playwright() as p:
            b=await p.chromium.launch();pg=await b.new_page(viewport={'width':W,'height':H});await pg.goto('file://'+page)
            await pg.evaluate(f"window.setup&&setup({json.dumps(params)},{dur})")
            ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-c:v','mjpeg','-r',str(FPS),'-i','-','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE)
            for n in range(max(1,int(round(dur*FPS)))):
                u=await pg.evaluate(f"(render({n/FPS}),document.getElementById('c').toDataURL('image/jpeg',0.93))");ff.stdin.write(base64.b64decode(u.split(',')[1]))
            sfx=await pg.evaluate("window.SFX||[]");ff.stdin.close();ff.wait();await b.close();return sfx
    sfx=asyncio.run(run())
    if sfx:json.dump(sfx,open(out+'.sfx.json','w'))
