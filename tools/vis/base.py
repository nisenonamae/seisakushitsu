"""図解の部品集の土台：色・文字・砂の地面・車輪・書き出し"""
import math, os, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
W,H,FPS=1280,720,30
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc';FM='/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'
SAND=(214,186,140);SAND_D=(150,118,78);WHITE=(245,245,240);RED=(226,58,48);GREEN=(90,190,130);BLUE=(110,170,230);BG=(34,44,58);GREY=(150,165,180)
_F={}
def font(n,b=True):
    n=max(4,int(n))
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
def back(t,s=1.7):
    t=max(0,min(1,t))-1;return max(0.0,1+(s+1)*t**3+s*t**2)
class Clip:
    """フレームを ffmpeg に直接流して mp4 にする。
    cam：カメラの動き（"in"＝ほんの少し寄る／"out"＝引く／"left"・"right"＝横に流れる／"none"）
    punch：見てほしい所へ「ぐいっ」と寄る。[{"at": 秒, "x": 0〜1, "y": 0〜1, "z": 倍率, "ring": true, "text": "…"}]
           z を 1 にすると全体へ戻る。寄った先で丸印（ring）と短い文字（text）を出せる。寄るたびに効果音の時刻を sfx に残す
    anim 秒ぶん描いたら、残りは最後の絵で止めて dur 秒にする（止める間もカメラは動き続ける）"""
    def __init__(s,out,dur,cam='in',punch=None):
        s.out=out;s.dur=dur;s.cam=cam;s.N=max(1,int(round(dur*FPS)));os.makedirs(os.path.dirname(out) or '.',exist_ok=True)
        s.p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE);s.n=0;s.last=None
        s.punch=sorted(punch or [],key=lambda q:q['at']);s.sfx=[[q['at'],'whoosh'] for q in s.punch if q['at']<dur and q.get('z',2)>1.01]
    def _view(s,t):
        """今の倍率と中心（0〜1）。ぐいっと 0.28 秒で寄り、少し行き過ぎて戻る。寄ったあとはごくわずかに寄り続ける"""
        z,x,y=1.0,0.5,0.5;cur=None
        for q in s.punch:
            if t<q['at']:break
            k=back((t-q['at'])/0.28,1.2);nz,nx,ny=q.get('z',2.2),q.get('x',0.5),q.get('y',0.5)
            if nz<=1.01:nx,ny=0.5,0.5
            z,x,y=z+(nz-z)*k,x+(nx-x)*min(1,k),y+(ny-y)*min(1,k);cur=q if k>=0.999 else cur
            if k>=0.999:z*=1+0.025*min(1,(t-q['at']-0.28)/2.5)
        return z,x,y,cur
    def _cam(s,im):
        t=s.n/FPS
        if s.punch:
            z,px,py,cur=s._view(t);w,h=W/z,H/z;cx=min(max(px*W,w/2),W-w/2);cy=min(max(py*H,h/2),H-h/2);k=im.width/W  # 大きい絵が来たら、その細かさのまま切り出す
            out=im.crop((int((cx-w/2)*k),int((cy-h/2)*k),int((cx+w/2)*k),int((cy+h/2)*k))).resize((W,H),Image.LANCZOS if k>1 else Image.BILINEAR)
            if cur and (cur.get('ring') or cur.get('text')):
                out=out.convert('RGBA');d=ImageDraw.Draw(out,'RGBA');sx,sy=(cur['x']*W-(cx-w/2))*z,(cur['y']*H-(cy-h/2))*z;a=back((t-cur['at']-0.2)/0.25)
                if cur.get('ring'):
                    r=cur.get('r',0.08)*W*a;d.ellipse([sx-r,sy-r*0.75,sx+r,sy+r*0.75],outline=(242,194,48,255),width=8)
                if cur.get('text') and a>0:
                    f=font(int(54*max(0.2,min(1.1,a))));tw=d.textlength(cur['text'],font=f);ty=max(70,min(H-230,sy-cur.get('r',0.08)*W*0.75-60)) if cur.get('ring') else 110;tx=min(max(sx,tw/2+40),W-tw/2-40)
                    d.rounded_rectangle([tx-tw/2-24,ty-44,tx+tw/2+24,ty+44],16,fill=(0,0,0,170));d.text((tx,ty),cur['text'],font=f,fill=WHITE,anchor='mm')
                out=out.convert('RGB')
            return out
        if s.cam=='none':return im
        u=s.n/max(1,s.N-1);e=u*u*(3-2*u)*0.6+u*0.4
        z={'in':1.0+0.04*e,'out':1.04-0.04*e}.get(s.cam,1.03);dx={'left':-0.02+0.04*e,'right':0.02-0.04*e}.get(s.cam,0)
        w,h=W/z,H/z;cx=W/2+dx*W;cy=H/2
        return im.crop((int(cx-w/2),int(cy-h/2),int(cx+w/2),int(cy+h/2))).resize((W,H),Image.BILINEAR)
    def add(s,im):
        if s.n>=s.N:return
        s.lastim=im.convert('RGB');b=s._cam(s.lastim).tobytes();s.p.stdin.write(b);s.n+=1
    def full(s):return s.n>=s.N
    def close(s):
        while s.n<s.N:s.p.stdin.write(s._cam(s.lastim).tobytes());s.n+=1
        s.p.stdin.close();s.p.wait()
