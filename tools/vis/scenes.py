"""図解の部品集。make(spec, dur, out) で、spec['t'] の部品を dur 秒の mp4 にする。
部品：photo / bigtext / map / cards / circle / section / loop / graph / steps
（新しい見せ方が要るときは、ここに部品を足していく。足したら tools/vis/README.md にも一行書く）"""
import json, math, os, urllib.request, urllib.parse, io
from base import *
UA={'User-Agent':'seisakushitsu/1.0 (noreply@anthropic.com)'}
CACHE='/home/claude/vv/cache';os.makedirs(CACHE,exist_ok=True)
def fetch(url):
    import hashlib;fn=os.path.join(CACHE,hashlib.md5(url.encode()).hexdigest()+os.path.splitext(urllib.parse.urlparse(url).path)[1][:5])
    if not os.path.exists(fn):
        import time
        for k in range(6):
            try:
                b=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=60).read();open(fn+'.part','wb').write(b);os.replace(fn+'.part',fn);break
            except Exception as e:
                if k==5: raise
                time.sleep(15*(k+1))
    return fn
def commons_img(page):
    """Wikimedia Commons の写真を取る。サムネイルは決まった幅（1920・1280・960・500）でしか頼めないので、元の幅以下で一番大きいものを選ぶ"""
    t=urllib.parse.unquote(page.split('/wiki/')[-1])
    q=lambda w:'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size&format=json'+(f'&iiurlwidth={w}' if w else '')+'&titles='+urllib.parse.quote(t)
    info=list(json.load(open(fetch(q(0))))['query']['pages'].values())[0]['imageinfo'][0]
    w=next((x for x in (1920,1280,960,500) if x<info['width']),500)
    p=list(json.load(open(fetch(q(w))))['query']['pages'].values())[0]['imageinfo'][0]
    return fetch(p['thumburl'])
def load_img(src,repo=''):
    if src.startswith('http'):
        fn=commons_img(src) if 'commons.wikimedia.org/wiki/' in src else fetch(src)
    else: fn=os.path.join(repo,src)
    return Image.open(fn).convert('RGB')
def cover(img,w,h):
    r=max(w/img.width,h/img.height);return img.resize((int(img.width*r+1),int(img.height*r+1)),Image.LANCZOS)
def kenburns(img,u,z0=1.0,z1=1.12,cx=0.5,cy=0.5):
    big=cover(img,int(W*z1)+2,int(H*z1)+2);z=z0+(z1-z0)*u;w,h=W*z1/z,H*z1/z
    x=(big.width-w)*cx;y=(big.height-h)*cy;return big.crop((int(x),int(y),int(x+w),int(y+h))).resize((W,H),Image.BILINEAR)
def label(d,text,x=W/2,y=110,size=50):
    f=font(size);tw=d.textlength(text,font=f);d.rounded_rectangle([x-tw/2-26,y-size*0.8,x+tw/2+26,y+size*0.8],14,fill=(0,0,0,150));d.text((x,y),text,font=f,fill=WHITE,anchor='mm')

def photo(s,dur,c,repo):
    img=load_img(s['src'],repo);N=int(dur*FPS)
    if s.get('punch'):  # ぐいっと寄るときは、細かい絵（2倍）を一枚だけ渡して、カメラ側で切り出す
        big=cover(img,W*2,H*2);x=(big.width-W*2)//2;y=(big.height-H*2)//2;fit=big.crop((x,y,x+W*2,y+H*2))
        for n in range(N):c.add(fit)
        return
    for n in range(N):
        u=n/max(1,N-1);im=(fit if s.get('punch') else kenburns(img,u,1.0,s.get('zoom',1.05),s.get('cx',0.5),s.get('cy',0.55))).convert('RGBA')
        if s.get('fadein'):
            k=ease(n/(FPS*0.8));im=Image.blend(Image.new('RGBA',(W,H),(0,0,0,255)),im,k)
        d=ImageDraw.Draw(im,'RGBA');t=n/FPS
        if s.get('ticks'):
            a=1-ease((t-dur+2.2)/1.5) if s['ticks']=='fadeout' else 1
            k=min(5,int(t/0.6)+1) if s['ticks']!='fadeout' else 5
            for i in range(k):
                x=W*0.30+i*W*0.09;y=H*0.36
                d.line([(x,y-18),(x,y+18)],fill=(255,255,255,int(235*a)),width=5)
            if k>1:d.line([(W*0.30,H*0.36),(W*0.30+(k-1)*W*0.09,H*0.36)],fill=(255,255,255,int(210*a)),width=3)
        if s.get('text') and t>s.get('text_at',1.5): label(d,s['text'])
        c.add(im)

def bigtext(s,dur,c,repo):
    N=int(dur*FPS);flash=s.get('flash')
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        if flash=='gauge8' and t>dur-0.7:
            im=Image.new('RGBA',(W,H),BG+(255,));d=ImageDraw.Draw(im,'RGBA');gauge(d,W/2,H*0.62,230,8.2,big=True);c.add(im);continue
        k=back(t/0.35);size=int(s.get('size',120)*max(0.05,k));a=min(1,max(0,t/0.2))
        d.text((W/2,H*0.45),s['text'],font=font(size),fill=WHITE+(int(255*a),),anchor='mm',stroke_width=4,stroke_fill=(0,0,0,int(160*a)))
        if s.get('sub') and t>0.8:d.text((W/2,H*0.62),s['sub'],font=font(40),fill=GREY+(int(255*ease((t-0.8)/0.5)),),anchor='mm')
        c.add(im)

def gauge(d,x,y,R,v,vmax=30,mark=8,big=False):
    d.pieslice([x-R,y-R,x+R,y+R],180,360,fill=(44,58,74))
    th8=180+mark/vmax*180
    d.arc([x-R,y-R,x+R,y+R],180,th8,fill=GREEN,width=int(R/14));d.arc([x-R,y-R,x+R,y+R],th8,360,fill=RED,width=int(R/14))
    th=math.radians(180+min(v,vmax)/vmax*180);d.line([(x,y),(x+(R-24)*math.cos(th),y+(R-24)*math.sin(th))],fill=WHITE,width=int(R/28)+3);d.ellipse([x-12,y-12,x+12,y+12],fill=WHITE)
    tm=math.radians(th8);d.text((x+(R+30)*math.cos(tm),y+(R+30)*math.sin(tm)),'8',font=font(int(R/5)),fill=GREEN,anchor='mm')
    d.text((x,y+36),'km/h',font=font(int(R/7)),fill=(170,180,195),anchor='mm')

_GEO=None
def geo():
    global _GEO
    if _GEO is None:
        _GEO=json.load(open(fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')))
    return _GEO
def map_(s,dur,c,repo):
    """世界地図。highlight の国を塗り、zoom=True ならその国へだんだん寄っていく。labels は国の上に出す文字"""
    g=geo();hl=s.get('highlight',[]);N=int(dur*FPS);ph=s.get('photo_at',dur*0.6);img=load_img(s['photo'],repo) if s.get('photo') else None
    SC=3;X=lambda lon:(lon+180)/360*W*SC;Y=lambda lat:(90-lat)/180*H*SC
    polys={}
    for f in g['features']:
        iso=f['properties'].get('ADM0_A3');gm=f['geometry'];rings=[gm['coordinates']] if gm['type']=='Polygon' else gm['coordinates']
        polys[iso]=[[(X(x),Y(y)) for x,y in r[0]] for r in rings]
    def big(iso):return max(polys[iso],key=len)
    def bbox(ps):xs=[x for p in ps for x,y in p];ys=[y for p in ps for x,y in p];return min(xs),min(ys),max(xs),max(ys)
    full=(0,0,W*SC,H*SC)
    if s.get('zoom') and hl:
        bx=bbox([big(i) for i in hl if i in polys]);cx,cy=(bx[0]+bx[2])/2,(bx[1]+bx[3])/2;w=max((bx[2]-bx[0])*1.8,(bx[3]-bx[1])*1.8*W/H,W*SC*0.22);h=w*H/W
        tgt=(cx-w/2,cy-h/2,cx+w/2,cy+h/2)
    else: tgt=full
    base=Image.new('RGB',(W*SC,H*SC),(30,52,78));bd=ImageDraw.Draw(base)
    for iso,ps in polys.items():
        for p in ps: bd.polygon(p,fill=(78,92,108),outline=(52,66,84))
    hlim={}
    for iso in hl:
        m=Image.new('L',(W*SC,H*SC),0);md=ImageDraw.Draw(m)
        for p in polys.get(iso,[]):md.polygon(p,fill=255)
        hlim[iso]=m
    for n in range(N):
        t=n/FPS;u=ease((t-0.3)/max(0.6,min(2.2,dur*0.5)));box=[full[i]+(tgt[i]-full[i])*u for i in range(4)]
        bi=tuple(int(v) for v in box);fr=base.crop(bi).resize((W,H),Image.BILINEAR)
        for i,iso in enumerate(hl):
            a=ease((t-0.4-i*0.4)/0.5)
            if a>0:fr.paste(SAND,(0,0,W,H),hlim[iso].crop(bi).resize((W,H),Image.BILINEAR).point(lambda v,a=a:int(v*a)))
        im=fr.convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        k=W/(box[2]-box[0]);tr=lambda x,y:((x-box[0])*k,(y-box[1])*k)
        for j,(iso,txt) in enumerate(s.get('labels',{}).items()):
            a=back((t-0.9-j*0.3)/0.4)
            if a>0 and iso in polys:
                b=bbox([big(iso)]);x,y=tr((b[0]+b[2])/2,b[1]);f=font(int(40*max(0.05,a)));tw=d.textlength(txt,font=f)
                x=min(max(x,tw/2+30),W-tw/2-30);y=min(max(y-34,60),H-200)
                d.text((x,y),txt,font=f,fill=WHITE,anchor='mm',stroke_width=5,stroke_fill=(0,0,0))
        for j,(lon,lat,txt) in enumerate(s.get('pins',[])):
            a=back((t-1.0-j*0.3)/0.35)
            if a>0:
                x,y=tr(X(lon),Y(lat));r=16*max(0.05,a);d.ellipse([x-r,y-r,x+r,y+r],fill=RED,outline=WHITE,width=4);d.line([(x,y-r),(x,y-r-30*a)],fill=WHITE,width=4)
                d.text((x,y-r-58*a),txt,font=font(int(38*max(0.05,a))),fill=WHITE,anchor='mm',stroke_width=5,stroke_fill=(0,0,0))
        if img and t>ph:
            q=ease((t-ph)/0.8);p=kenburns(img,(t-ph)/max(0.1,dur-ph),1.0,1.12).convert('RGBA');im=Image.blend(im,p,q);d=ImageDraw.Draw(im,'RGBA')
            if s.get('photo_text') and t>ph+1:label(d,s['photo_text'],y=H*0.5,size=72)
        c.add(im)

def cards(s,dur,c,repo):
    groups=s['groups'];keep=s.get('keep');N=int(dur*FPS);allc=[x for g in groups for x in g]
    pos={};rows=len(groups)
    for r,g in enumerate(groups):
        for i,x in enumerate(g):pos[x]=(W*(i+1)/(len(g)+1),H*(0.32+0.28*r) if rows>1 else H*0.45)
    tk=s.get('keep_at',dur*0.55)
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        if s.get('title'):d.text((W/2,90),s['title'],font=font(44),fill=WHITE,anchor='mm')
        for k,x in enumerate(allc):
            a=ease((t-0.3-k*0.45)/0.35);px,py=pos[x];py+= (1-a)*30
            if keep and t>tk:
                if x in keep:
                    j=keep.index(x);tx,ty=W*(j+1)/(len(keep)+1),H*0.5;u=ease((t-tk-0.6)/0.8);px,py=px+(tx-px)*u,py+(ty-py)*u
                else:
                    u=(t-tk)/0.9;py+=600*u*u;a*=max(0,1-u)
            if a>0:card(d,px,py,x,col=(52,66,86) if not (keep and x in keep and t>tk) else (60,110,90),alpha=int(255*a),size=s.get('size',34))
        c.add(im)

def steps(s,dur,c,repo):
    items=s['items'];N=int(dur*FPS);per=dur/len(items)
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA');cur=min(len(items)-1,int(t/per))
        if s.get('title'):d.text((W/2,80),s['title'],font=font(44),fill=WHITE,anchor='mm')
        for i,x in enumerate(items):
            y=H*0.25+i*(H*0.6/len(items));a=ease((t-i*per)/0.4)
            if a<=0:continue
            on=i==cur;card(d,W/2,y,x,w=860,h=70,col=(70,120,170) if on else (52,66,86),alpha=int(255*(a if on else 0.6*a)),size=36 if on else 32)
        c.add(im)

def loop(s,dur,c,repo):
    N=int(dur*FPS);lab=s.get('labels',['揺れ','波を押す','波が育つ'])
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA');cx,cy,R=W/2,H/2+20,220;turns=t/3.2;w=int(6+4*turns)
        for i in range(3):
            a0=-90+i*120+10;a1=a0+100;d.arc([cx-R,cy-R,cx+R,cy+R],a0,a1,fill=RED,width=min(26,w))
            ae=math.radians(a1);hx,hy=cx+R*math.cos(ae),cy+R*math.sin(ae);ta=ae+math.pi/2;hs=18+min(14,turns*3)
            d.polygon([(hx+hs*math.cos(ta),hy+hs*math.sin(ta)),(hx+hs*math.cos(ta+2.5),hy+hs*math.sin(ta+2.5)),(hx+hs*math.cos(ta-2.5),hy+hs*math.sin(ta-2.5))],fill=RED)
            lm=math.radians(-90+i*120);d.text((cx+(R+70)*math.cos(lm),cy+(R+60)*math.sin(lm)),lab[i],font=font(40),fill=WHITE,anchor='mm',stroke_width=4,stroke_fill=(0,0,0))
        A=10+min(40,turns*9);pts=[(cx-150+x,cy+20-A*math.sin(x/300*4*math.pi)) for x in range(0,301,4)]
        d.line(pts,fill=SAND,width=8)
        c.add(im)

def graph(s,dur,c,repo):
    N=int(dur*FPS);x0,y0,x1,y1=180,600,1150,140
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        d.line([(x0,y0),(x1,y0)],fill=GREY,width=3);d.line([(x0,y0),(x0,y1)],fill=GREY,width=3)
        d.text((x1,y0+36),'車の量 →',font=font(30),fill=GREY,anchor='rm');d.text((x0-20,y1),'お金',font=font(30),fill=GREY,anchor='rm')
        u=ease((t-0.4)/2.0);xe=x0+(x1-x0)*u
        pv=lambda x:y0-260-(x-x0)*0.05;up=lambda x:y0-60-((x-x0)/(x1-x0))**1.6*480
        d.line([(x,pv(x)) for x in range(x0,int(xe)+1,6)],fill=BLUE,width=8);d.line([(x,up(x)) for x in range(x0,int(xe)+1,6)],fill=SAND,width=8)
        if u>0.98:
            d.text((x1-10,pv(x1)-30),'舗装',font=font(34),fill=BLUE,anchor='rm');d.text((x1-10,up(x1)-30),'未舗装',font=font(34),fill=SAND,anchor='rm')
        xc=next(x for x in range(x0,x1) if up(x)<=pv(x))
        a=ease((t-3.0)/0.8)
        if a>0:
            ov=Image.new('RGBA',(W,H),(0,0,0,0));ImageDraw.Draw(ov).rectangle([x0+3,y1,xc,y0-3],fill=(214,186,140,int(55*a)));im.alpha_composite(ov);d=ImageDraw.Draw(im,'RGBA')
            d.line([(x,pv(x)) for x in range(x0,x1+1,6)],fill=BLUE,width=8);d.line([(x,up(x)) for x in range(x0,x1+1,6)],fill=SAND,width=8)
            d.line([(xc,y1),(xc,y0)],fill=(255,255,255,int(200*a)),width=3)
            d.text(((x0+xc)/2,y1+40),'舗装しない方が安い',font=font(34),fill=WHITE+(int(255*a),),anchor='mm')
        c.add(im)

# ---------- 円い道（真上から） ----------
def _track(d,cx,cy,R1,R2,amp,rut,ang,K=40,hand=False,motor=False,spots=None):
    d.ellipse([cx-R2,cy-R2,cx+R2,cy+R2],fill=SAND);d.ellipse([cx-R1,cy-R1,cx+R1,cy+R1],fill=BG)
    rm=(R1+R2)/2
    if rut>0:
        w=(R2-R1)*0.38;d.ellipse([cx-rm-w/2,cy-rm-w/2,cx+rm+w/2,cy+rm+w/2],outline=(int(175-35*rut),int(145-35*rut),int(100-30*rut)),width=int(w))
    for k in range(K):
        a=2*math.pi*k/K;al=amp if spots is None else amp*spots(a)
        if al<=0.01:continue
        for (b0,b1,col) in [(a-0.03,a+0.03,(120,92,60)),(a+0.03,a+0.06,(240,215,170))]:
            p=[(cx+R1*1.02*math.cos(b0),cy+R1*1.02*math.sin(b0)),(cx+R2*0.98*math.cos(b0),cy+R2*0.98*math.sin(b0)),(cx+R2*0.98*math.cos(b1),cy+R2*0.98*math.sin(b1)),(cx+R1*1.02*math.cos(b1),cy+R1*1.02*math.sin(b1))]
            d.polygon(p,fill=col+(int(220*min(1,al)),))
    wx,wy=cx+rm*math.cos(ang),cy+rm*math.sin(ang)
    d.line([(cx,cy),(wx,wy)],fill=(200,205,215),width=8);d.ellipse([cx-16,cy-16,cx+16,cy+16],fill=(90,95,105))
    tx,ty=-math.sin(ang),math.cos(ang);L=34;Wd=14
    d.polygon([(wx+tx*L+math.cos(ang)*Wd,wy+ty*L+math.sin(ang)*Wd),(wx+tx*L-math.cos(ang)*Wd,wy+ty*L-math.sin(ang)*Wd),(wx-tx*L-math.cos(ang)*Wd,wy-ty*L-math.sin(ang)*Wd),(wx-tx*L+math.cos(ang)*Wd,wy-ty*L+math.sin(ang)*Wd)],fill=(30,30,34),outline=(90,90,100))
    if hand:
        hx,hy=cx+rm*0.55*math.cos(ang),cy+rm*0.55*math.sin(ang);d.ellipse([hx-24,hy-24,hx+24,hy+24],fill=(232,190,160),outline=(180,140,110),width=3)
    if motor:d.rectangle([cx-30,cy-30,cx+30,cy+30],outline=(150,160,175),width=4)
def _slider(d,x,y,w,v):
    d.rounded_rectangle([x,y-6,x+w,y+6],6,fill=(70,82,100));p=x+w*min(1,max(0,v))
    d.rounded_rectangle([x,y-6,p,y+6],6,fill=(150,170,200));d.ellipse([p-18,y-18,p+18,y+18],fill=WHITE)
    d.text((x,y+34),'遅い',font=font(26),fill=(170,180,195),anchor='lm');d.text((x+w,y+34),'速い',font=font(26),fill=(170,180,195),anchor='rm')
def circle(s,dur,c,repo):
    mode=s.get('mode','mather');N=int(dur*FPS);ang=0;amp=0;rut=0;spread=0
    for n in range(N):
        t=n/FPS;im=Image.new('RGBA',(W,H),BG+(255,));d=ImageDraw.Draw(im,'RGBA')
        if mode in ('hand','slow','fast'):
            hand=mode=='hand';v=0.2 if hand else (0.18 if mode=='slow' else 0.3+0.6*ease(t/1.2))
            if hand: amp=min(0.35,amp+0.35/max(1,N*0.7))
            elif mode=='slow': rut=min(1,rut+1.0/max(1,N*0.6))
            else: amp=min(1,amp+1.0/max(1,N*0.6))
            ang+=0.05+v*0.12;_track(d,450,370,170,300,amp,rut,ang,hand=hand,motor=not hand)
            if not hand:_slider(d,860,470,320,v)
            d.text((1020,330),{'hand':'手で押して回す','slow':'ゆっくり → 轍だけ','fast':'速くすると → 波'}[mode],font=font(44),fill=WHITE,anchor='mm')
        elif mode=='mather':
            hand=t<dur*0.3;v=0.2 if hand else 0.15+0.75*ease((t-dur*0.62)/1.0)
            if abs(t-dur*0.3)<0.5/FPS:amp=0;rut=0
            if hand: amp=min(0.3,amp+0.003)
            elif v<0.4: rut=min(1,rut+0.006)
            else: amp=min(1,amp+0.01)
            ang+=0.05+v*0.12;_track(d,450,370,170,300,amp,rut,ang,hand=hand,motor=not hand);_slider(d,860,470,320,v)
            d.text((1020,330),'手で押す' if hand else 'モーター',font=font(44),fill=WHITE,anchor='mm')
        elif mode=='2007':
            ang+=0.16;laps=ang/(2*math.pi);spread=max(0,min(1,(laps-3)/(dur*0.35)))
            sp=lambda a,sp=spread:1.0 if (math.cos(a-0.8)>1-2.2*sp) else 0
            amp=min(1,0.3+laps*0.06) if laps>3 else 0
            _track(d,450,370,170,300,amp,0,ang,K=48,spots=sp);d.text((1010,300),f'{int(laps)} 周',font=font(80),fill=WHITE,anchor='mm')
            d.text((1010,400),'1秒に約0.6回転',font=font(32),fill=GREY,anchor='mm')
        elif mode=='speed':
            v=5+19*ease((t-dur*0.4)/1.4)
            if v>8: amp=min(1,amp+0.006*(v-8)/8)
            gauge(d,330,450,210,v)
            x0,y0=600,300;d.rectangle([x0,y0,x0+600,y0+170],fill=SAND)
            if amp>0:
                for x in range(x0+10,x0+590,34):d.rectangle([x,y0+8,x+14,y0+162],fill=(130,100,66,int(230*amp)))
            cx=x0+((t*v*40)%600);d.rounded_rectangle([cx-46,y0+59,cx+46,y0+111],12,fill=(225,228,235),outline=(120,125,135),width=3)
        c.add(im)

# ---------- 道の断面（横から） ----------
def _prof(x,A,lam=230,env=1.0,phase=0):return A*env*math.sin(2*math.pi*(x-20-phase)/lam)
def section(s,dur,c,repo):
    mode=s.get('mode','grow');N=int(dur*FPS);base=470;r=60
    for n in range(N):
        t=n/FPS;u=t/dur;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        if mode=='force':
            top=lambda x:base-(6*math.sin(x/37)+4*math.sin(x/17+1));ground(im,top);d=ImageDraw.Draw(im,'RGBA')
            wx=(t*120)%(W+200)-100;wy=top(wx)-r;wheel(d,wx,wy,r,wx/r)
            for x in range(60,W,90):
                L=40+300*(base-top(x))/10*0.2+ (base-top(x))*4;arrow(d,x,top(x)-L-10,x,top(x)-10,col=(226,58,48,200),w=6,head=16)
        elif mode=='arc':
            v=0.5+0.5*math.sin(t/dur*2*math.pi*1.0-math.pi/2);lam=150+170*v
            top=lambda x:base-_prof(x,30,lam);ground(im,top);d=ImageDraw.Draw(im,'RGBA')
            for k in range(6):
                a=20+lam*(k+0.25);b=a+lam
                for q in [i/16 for i in range(17)]:
                    x=a+(b-a)*q;y=top(x)-r*0.15-90*math.sin(math.pi*q)*(0.5+0.5*v);d.ellipse([x-4,y-4,x+4,y+4],fill=(255,255,255,170))
            _slider(d,860,120,320,v);d.text((1020,70),'車の速さ',font=font(34),fill=WHITE,anchor='mm')
        elif mode=='grow':
            g=ease((t-0.8)/min(dur-2,10));cars=int(3000*g**1.6);spread=150+1300*g;lam=230
            top=lambda x:base-((6*math.exp(-((x-(W-120))/30)**2))*(1-g)+(4+40*g)*max(0,min(1,(x-(W-spread))/260))*math.sin(2*math.pi*(x-20)/lam))
            ground(im,top);d=ImageDraw.Draw(im,'RGBA');ph=(t*0.9)%1;wx=-80+ph*(W+160)
            hop=max(0,math.sin(2*math.pi*(wx-20)/lam))*18*g;wheel(d,wx,top(wx)-r-hop,r,wx/r)
            if g>0.97:
                cr=[20+lam*(k+0.25) for k in range(1,5)];yy=min(top(x) for x in cr)-40
                for x in cr:d.line([(x,yy-14),(x,yy+14)],fill=(255,255,255,235),width=4)
                d.line([(cr[0],yy),(cr[-1],yy)],fill=(255,255,255,200),width=3)
            f=font(104);d.text((72,60),f'{cars}',font=f,fill=WHITE);d.text((72+d.textlength(f"{cars}",font=f)+12,126),'台',font=font(40),fill=WHITE)
        elif mode=='bounce':
            base2=470;rr=70;tt=t%11;B=[(330,46)]
            if tt>=3.0:B.append((600,46*ease((tt-3.0)/0.8)))
            if tt>=7.0:B.append((830,46*ease((tt-7.0)/0.8)))
            top=lambda x:base2-sum(h*math.exp(-((x-cc)/40)**2) for cc,h in B);ground(im,top);d=ImageDraw.Draw(im,'RGBA')
            if tt<1.5:wx,hop=80+(330-80)*tt/1.5,0
            elif tt<3.0:q=(tt-1.5)/1.5;wx,hop=330+(560-330)*q,150*math.sin(math.pi*q)*0.6
            elif tt<5.5:wx,hop=560,0
            elif tt<7.0:q=(tt-5.5)/1.5;wx,hop=560+(790-560)*q,150*math.sin(math.pi*q)*0.6
            else:wx,hop=790+(tt-7)*60,0
            for a,b,t0 in [(330,560,1.5),(560,790,5.5)]:
                if tt>t0:
                    q2=min(1,(tt-t0)/1.5)
                    for k in range(int(q2*14)):
                        q=k/14;x=a+(b-a)*q;y=top(x)-150*math.sin(math.pi*q)*0.6;d.ellipse([x-4,y-4,x+4,y+4],fill=(255,255,255,170))
            for tl,xl in [(3.0,560),(7.0,790)]:
                if tl<=tt<tl+0.9:
                    q=(tt-tl)/0.9;arrow(d,xl+10,base2-12,xl+80,base2-12,col=(226,58,48,int(255*(1-q))),w=7,head=18)
            wheel(d,wx,top(wx)-rr-hop,rr,wx/rr)
        elif mode=='migrate':
            ph=t*14;top=lambda x:base-max(-30,min(34,_prof(x,40,230,1,ph)));ground(im,top);d=ImageDraw.Draw(im,'RGBA')
            arrow(d,W/2-120,190,W/2+120,190,col=(255,255,255),w=6);d.text((W/2,140),'車の進む向き',font=font(34),fill=WHITE,anchor='mm')
        elif mode in ('heavy','dilemma'):
            for row,(yb,lab,hopk,amp) in enumerate([(290,'軽い車輪' if mode=='heavy' else '遅い車',1.0,34),(600,'重い車輪' if mode=='heavy' else '速い車',0.35 if mode=='heavy' else 0.1,10 if mode=='heavy' else 34)]):
                grow=amp*(1 if mode=='heavy' else (1+0.4*u if row==1 else 1))
                top=lambda x,yb=yb,grow=grow:yb-_prof(x,grow,200);ground(im,top,x0=-10,x1=W+10,bottom=yb+60)
                d=ImageDraw.Draw(im,'RGBA');wx=(t*(150 if row==0 or mode=='heavy' else 260))%(W+200)-100
                hop=abs(math.sin(2*math.pi*(wx-20)/200))*40*hopk;rr=48 if mode=='heavy' and row==0 else (60 if mode=='heavy' else 50)
                wheel(d,wx,top(wx)-rr-hop,rr,wx/rr);d.text((40,yb-150),lab,font=font(40),fill=WHITE,anchor='lm')
            # 地面の上の部分を区切る
            im2=im;d=ImageDraw.Draw(im2,'RGBA')
        elif mode=='swap':
            phase=0 if u<0.5 else 1;A=8+28*ease((u%0.5)/0.45)
            top=lambda x:base-_prof(x,A,200)
            tex=None
            if phase==1:
                tex=Image.new('RGB',(W,H),(236,232,214));td=ImageDraw.Draw(tex)
                for k in range(3000):
                    import random;x=random.Random(k).uniform(0,W);y=random.Random(k+9).uniform(0,H);td.ellipse([x-6,y-2.5,x+6,y+2.5],fill=(250,248,236),outline=(205,200,180))
            ground(im,top,tex=tex);d=ImageDraw.Draw(im,'RGBA')
            wx=(t*200)%(W+200)-100;hop=abs(math.sin(2*math.pi*(wx-20)/200))*30*min(1,A/30)
            if phase==0: wheel(d,wx,top(wx)-r-hop,r,wx/r);lab='砂'
            else:
                x,y=wx,top(wx)-30-hop;d.polygon([(x-70,y-40),(x+40,y-40),(x+70,y+25),(x-40,y+25)],fill=(90,95,108),outline=(160,165,175));lab='米粒・斜めの板'
            d.text((60,90),lab,font=font(48),fill=WHITE,anchor='lm')
        elif mode=='japan':
            sq=ease(u/0.35);top=lambda x:base-_prof(x,4+30*ease((u-0.4)/0.55),220)-(-10*sq*math.exp(-((x-W/2)/120)**2) if u<0.4 else 0)
            ground(im,top);d=ImageDraw.Draw(im,'RGBA')
            if u<0.4:
                x=W/2;d.rounded_rectangle([x-150,top(x)-200,x+150,top(x)-100],20,fill=(225,228,235),outline=(120,125,135),width=4)
                for k in range(5):arrow(d,x-120+k*60,top(x)+20,x-120+k*60,top(x)+20+40*sq,col=(226,58,48,200),w=5,head=14)
                d.text((x,top(x)-260),'車の重さで土が縮む',font=font(40),fill=WHITE,anchor='mm')
            else:
                wx=(t*170)%(W+260)-130;bob=12*math.sin(t*9);y=top(wx)-r
                wheel(d,wx-70,y,46,wx/46);wheel(d,wx+70,y,46,wx/46)
                d.rounded_rectangle([wx-130,y-150+bob,wx+130,y-70+bob],18,fill=(225,228,235),outline=(120,125,135),width=4)
                for k in range(4):yy=y-70+bob+ (k+1)*(y-(y-70+bob))/5;d.line([(wx-70-12+ (k%2)*24,yy),(wx-70+12-(k%2)*24,yy+8)],fill=(200,205,215),width=4)
                d.text((W/2,120),'上下に揺れる車が、波を育てる',font=font(40),fill=WHITE,anchor='mm')
        c.add(im)
def make(spec,dur,out,repo=''):
    """spec に seq（部品のリスト）があれば、dur を等分して順につなぐ（長い一文の途中で画面を変えたいとき）"""
    if spec.get('seq'):
        import subprocess,tempfile;tmp=tempfile.mkdtemp();L=spec['seq'];parts=[];sfx=[]
        for i,sp in enumerate(L):
            o=f'{tmp}/q{i}.mp4';make(sp,dur/len(L),o,repo);parts.append(o)
            if os.path.exists(o+'.sfx.json'):sfx+= [i*dur/len(L)+x for x in json.load(open(o+'.sfx.json'))]
            sfx.append(i*dur/len(L)) if i else None
        open(f'{tmp}/l.txt','w').write(''.join(f"file '{x}'\n" for x in parts))
        subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',f'{tmp}/l.txt','-c','copy',out],check=True)
        if sfx:json.dump(sfx,open(out+'.sfx.json','w'))
        return
    import parts2
    c=Clip(out,dur,spec.get('cam','none' if spec['t']=='photo' else 'in'),spec.get('punch'));f={'picto':parts2.picto,'person':parts2.person,'dustcar':parts2.dustcar,'ruler':parts2.ruler,'year':parts2.year,'photo':photo,'bigtext':bigtext,'map':map_,'cards':cards,'steps':steps,'loop':loop,'graph':graph,'circle':circle,'section':section}[spec['t']]
    f(spec,dur,c,repo);c.close()
    if c.sfx:json.dump(c.sfx,open(out+'.sfx.json','w'))
