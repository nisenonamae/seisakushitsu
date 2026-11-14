"""図解の部品集の土台：色・文字・砂の地面・車輪・書き出し"""
import math, os, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
W,H,FPS=1280,720,30
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc';FM='/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'
SAND=(214,186,140);SAND_D=(150,118,78);WHITE=(245,245,240);RED=(226,58,48);GREEN=(90,190,130);BLUE=(110,170,230);BG=(34,44,58);GREY=(150,165,180)
_F={}
def font(n,b=True):
    k=(n,b)
    if k not in _F:_F[k]=ImageFont.truetype(FB if b else FM,n)
    return _F[k]
def ease(t):t=max(0,min(1,t));return t*t*(3-2*t)
def eout(t):t=max(0,min(1,t));return 1-(1-t)**3
def sky():
    a=np.zeros((H,W,3),np.uint8);t=np.linspace(1,0,H)[:,None]
    a[...,0]=(40+30*t);a[...,1]=(56+34*t);a[...,2]=(74+40*t);return Image.fromarray(a)
SKY=sky()
def _sand():
    rng=np.random.default_rng(3);a=np.zeros((H,W,3),np.float32);a[:]=SAND
    n=rng.uniform(.82,1.0,(H,W,1));m=(rng.random((H,W))<0.08)[...,None]
    a=a*np.where(m,n,1.0);y=np.linspace(0,1,H)[:,None,None];a=a*(1-0.25*y)
    return Image.fromarray(a.clip(0,255).astype(np.uint8))
SANDTEX=_sand()
def ground(im,top,line=True,x0=-10,x1=W+10,step=4,tex=None,bottom=H):
    pts=[(x,top(x)) for x in range(x0,x1+1,step)]
    m=Image.new('L',(W,H),0);ImageDraw.Draw(m).polygon(pts+[(x1,bottom),(x0,bottom)],fill=255)
    im.paste(tex or SANDTEX,(0,0),m)
    if line:ImageDraw.Draw(im).line(pts,fill=SAND_D,width=5)
    return pts
def wheel(d,cx,cy,r,ang=0,col=(28,28,32)):
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=col,outline=(85,85,95),width=max(2,int(r/10)))
    d.ellipse([cx-r*.45,cy-r*.45,cx+r*.45,cy+r*.45],fill=(150,150,160))
    for k in range(5):
        a=ang+k*2*math.pi/5;d.line([(cx,cy),(cx+r*.4*math.cos(a),cy+r*.4*math.sin(a))],fill=(90,90,100),width=max(2,int(r/15)))
    d.ellipse([cx-r*.13,cy-r*.13,cx+r*.13,cy+r*.13],fill=(60,60,70))
def arrow(d,x1,y1,x2,y2,col=RED,w=8,head=22):
    d.line([(x1,y1),(x2,y2)],fill=col,width=w);a=math.atan2(y2-y1,x2-x1)
    p=[(x2,y2),(x2-head*math.cos(a-0.45),y2-head*math.sin(a-0.45)),(x2-head*math.cos(a+0.45),y2-head*math.sin(a+0.45))];d.polygon(p,fill=col)
def card(d,x,y,text,w=None,h=78,col=(52,66,86),fg=WHITE,size=34,alpha=255):
    f=font(size);tw=d.textlength(text,font=f);w=w or tw+56
    d.rounded_rectangle([x-w/2,y-h/2,x+w/2,y+h/2],16,fill=col+(alpha,) if len(col)==3 else col,outline=(120,140,165,alpha),width=3)
    d.text((x,y),text,font=f,fill=fg+(alpha,) if len(fg)==3 else fg,anchor='mm')
class Clip:
    """フレームを ffmpeg に直接流して mp4 にする。anim 秒ぶん描いたら、残りは最後の絵で止めて dur 秒にする"""
    def __init__(s,out,dur):
        s.out=out;s.dur=dur;os.makedirs(os.path.dirname(out) or '.',exist_ok=True)
        s.p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE);s.n=0;s.last=None
    def add(s,im):b=im.convert('RGB').tobytes();s.p.stdin.write(b);s.last=b;s.n+=1
    def close(s):
        while s.n<int(s.dur*FPS):s.p.stdin.write(s.last);s.n+=1
        s.p.stdin.close();s.p.wait()
