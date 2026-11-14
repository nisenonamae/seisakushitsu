"""部品の追加分：絵文字の代わりの絵（ピクト）・人物・土ぼこりの車・ものさし・年号・地図の寄り・円い道の段階"""
import math, random
from base import *
# ---------- ピクト（簡単な絵） ----------
def icon(d,name,x,y,s,col=WHITE):
    k=s/100
    if name=='truck':
        d.rectangle([x-50*k,y-30*k,x+20*k,y+20*k],fill=col);d.rectangle([x+20*k,y-10*k,x+50*k,y+20*k],fill=col)
        for wx in (-30,30):d.ellipse([x+wx*k-12*k,y+12*k,x+wx*k+12*k,y+36*k],fill=(40,40,45),outline=col,width=max(2,int(4*k)))
    elif name=='rain':
        d.ellipse([x-45*k,y-50*k,x+10*k,y-10*k],fill=col);d.ellipse([x-15*k,y-60*k,x+45*k,y-12*k],fill=col);d.rectangle([x-40*k,y-30*k,x+40*k,y-12*k],fill=col)
        for i in range(4):dx=-36+i*24;d.line([(x+dx*k,y+2*k),(x+(dx-8)*k,y+30*k)],fill=BLUE,width=max(3,int(6*k)))
    elif name=='brake':
        d.rounded_rectangle([x-40*k,y-25*k,x+40*k,y+10*k],10*k,fill=col)
        for wx in (-24,24):d.ellipse([x+wx*k-11*k,y+2*k,x+wx*k+11*k,y+24*k],fill=(40,40,45))
        for i in range(3):d.line([(x-48*k-i*14*k,y+24*k),(x-80*k-i*14*k,y+24*k)],fill=RED,width=max(3,int(5*k)))
    elif name=='tread':
        d.rounded_rectangle([x-30*k,y-50*k,x+30*k,y+50*k],12*k,fill=(40,40,45),outline=col,width=max(2,int(4*k)))
        for i in range(5):yy=y-40*k+i*20*k;d.line([(x-22*k,yy),(x,yy+10*k),(x+22*k,yy)],fill=col,width=max(2,int(4*k)))
    elif name=='spring':
        pts=[(x+(18*k if i%2 else -18*k),y-50*k+i*10*k) for i in range(11)];d.line(pts,fill=col,width=max(3,int(5*k)))
        d.rectangle([x-30*k,y-58*k,x+30*k,y-50*k],fill=col);d.rectangle([x-30*k,y+50*k,x+30*k,y+58*k],fill=col)
    elif name=='layers':
        for i,c in enumerate([(200,170,120),(170,140,98),(140,112,78)]):d.rectangle([x-50*k,y-30*k+i*22*k,x+50*k,y-10*k+i*22*k],fill=c)
        d.polygon([(x-20*k,y-55*k),(x+20*k,y-55*k),(x,y-35*k)],fill=RED)
    elif name=='grains':
        rr=random.Random(3)
        for i in range(14):
            big=i<5;r=(12 if big else 5)*k;xx=x+(-40+i*6)*k if big else x+(10+rr.uniform(0,40))*k;yy=y+rr.uniform(-30,30)*k
            d.ellipse([xx-r,yy-r,xx+r,yy+r],fill=col if big else SAND)
    elif name=='question':d.text((x,y),'？',font=font(int(120*k)),fill=col,anchor='mm')
    elif name=='wheel':wheel(d,x,y,45*k,0)
    elif name=='ground':
        d.rectangle([x-55*k,y-5*k,x+55*k,y+40*k],fill=SAND);[d.ellipse([x+(-45+i*13)*k-4*k,y+(5+(i%3)*10)*k-4*k,x+(-45+i*13)*k+4*k,y+(5+(i%3)*10)*k+4*k],fill=SAND_D) for i in range(8)]
    elif name=='speed':
        d.pieslice([x-50*k,y-50*k,x+50*k,y+50*k],180,360,fill=(44,58,74),outline=col,width=max(2,int(4*k)));d.line([(x,y),(x+35*k,y-30*k)],fill=RED,width=max(3,int(6*k)))
def picto(s,dur,c,repo):
    items=s['items'];mode=s.get('mode','one');N=c.N
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        if mode=='one':
            it=items[0];k=back(t/0.35);sz=230*k
            d.ellipse([W/2-170*k,H*0.42-170*k,W/2+170*k,H*0.42+170*k],fill=(60,76,98))
            icon(d,it['icon'],W/2,H*0.42,sz)
            a=ease((t-0.15)/0.3);d.text((W/2,H*0.78),it['label'],font=font(64),fill=WHITE+(int(255*a),),anchor='mm')
            if it.get('x') and t>0.5:
                u=back((t-0.5)/0.3);d.line([(W/2-120*u,H*0.42-120*u),(W/2+120*u,H*0.42+120*u)],fill=RED,width=18);d.line([(W/2-120*u,H*0.42+120*u),(W/2+120*u,H*0.42-120*u)],fill=RED,width=18)
        else:
            cols=min(4,len(items));rows=math.ceil(len(items)/cols);R=150 if len(items)<=3 else 80
            for i,it in enumerate(items):
                r_,c_=divmod(i,cols);nc=min(cols,len(items)-r_*cols);x=W*(c_+1)/(nc+1);y=H*(0.22+0.36*r_) if rows>1 else H*0.40
                k=back((t-0.12*i)/0.3);
                if k<=0:continue
                d.ellipse([x-R*k,y-R*k,x+R*k,y+R*k],fill=(60,76,98));icon(d,it['icon'],x,y,R*1.25*k)
                d.text((x,y+R+34),it['label'],font=font(44 if R>100 else 32),fill=WHITE,anchor='mm',stroke_width=3,stroke_fill=(0,0,0))
                if s.get('cross') and t>1.0+0.12*i:
                    u=back((t-1.0-0.12*i)/0.25)*R/80;d.line([(x-60*u,y-60*u),(x+60*u,y+60*u)],fill=RED,width=10);d.line([(x-60*u,y+60*u),(x+60*u,y-60*u)],fill=RED,width=10)
        c.add(im)
# ---------- 人物（シルエット＋名前＋地図のピン） ----------
def person(s,dur,c,repo):
    N=c.N
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA');k=back(t/0.4)
        x,y=W*0.30,H*0.52
        d.ellipse([x-170,y-170,x+170,y+170],fill=(60,76,98));d.ellipse([x-55*k,y-110*k,x+55*k,y],fill=(25,30,40));d.pieslice([x-110*k,y+10,x+110*k,y+10+220*max(0.05,k)],180,360,fill=(25,30,40))
        a=ease((t-0.3)/0.4);d.text((W*0.52,H*0.36),s.get('name',''),font=font(64),fill=WHITE+(int(255*a),),anchor='lm')
        d.text((W*0.52,H*0.50),s.get('role',''),font=font(36),fill=GREY+(int(255*a),),anchor='lm')
        if s.get('year'):
            u=back((t-0.6)/0.35);d.text((W*0.52,H*0.68),s['year'],font=font(int(90*max(0.01,u))),fill=(242,194,48,int(255*min(1,max(0,u)))),anchor='lm')
        c.add(im)
# ---------- 土ぼこりを上げて走る車（横から） ----------
def dustcar(s,dur,c,repo):
    N=c.N;puffs=[];close=s.get('close',False);rr=random.Random(5)
    for n in range(N):
        t=n/FPS;im=Image.new('RGBA',(W,H),(0,0,0,255));d=ImageDraw.Draw(im,'RGBA')
        for y in range(H):
            q=y/H;d.line([(0,y),(W,y)],fill=(int(120+80*(1-q)),int(160+60*(1-q)),int(200+40*(1-q))) if y<H*0.55 else (int(196-30*q),int(102-20*q),int(56-10*q)))
        off=(t*260)%400
        for i in range(-1,5):
            bx=i*400-off+100;d.ellipse([bx,H*0.50,bx+90,H*0.56],fill=(86,104,60))
        sc=2.2 if close else 1.0;cx=W*0.48;gy=H*0.80;bump=abs(math.sin(t*9))*10*sc
        if not close:
            d.rounded_rectangle([cx-120,gy-120-bump,cx+120,gy-40-bump],22,fill=(225,228,235),outline=(120,125,135),width=4)
            d.rounded_rectangle([cx-60,gy-160-bump,cx+80,gy-110-bump],16,fill=(225,228,235),outline=(120,125,135),width=4)
        for wx in ((-70,70) if not close else (0,)):
            r=34*sc;wheel(d,cx+wx*sc,gy-r-(bump if (int(t*9/math.pi)%2==0) else 0),r,-t*12)
        if s.get('puffs',True) and n%int(FPS*0.45)==0:puffs.append([cx-90*sc,gy-10,t])
        for p in puffs:
            age=t-p[2];x=p[0]-age*260;rad=30+age*90
            if age<2.2:d.ellipse([x-rad,p[1]-rad*0.8,x+rad,p[1]+rad*0.3],fill=(210,150,100,int(150*(1-age/2.2))))
        if s.get('text') and t>0.4:d.text((W/2,90),s['text'],font=font(56),fill=WHITE,anchor='mm',stroke_width=5,stroke_fill=(0,0,0))
        c.add(im)
# ---------- 断面にものさし ----------
def ruler(s,dur,c,repo):
    N=c.N;base=470;lam=300
    top=lambda x:base-26*math.sin(2*math.pi*(x-40)/lam)
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');ground(im,top);d=ImageDraw.Draw(im,'RGBA')
        a=W/2-lam/2+35;b=a+lam;u=ease((t-0.3)/0.8);yy=top(a+lam*0.25)-110 if False else base-120
        x2=a+(b-a)*u
        d.line([(a,yy),(x2,yy)],fill=(242,194,48),width=8)
        for x in (a,x2):d.line([(x,yy-24),(x,yy+24)],fill=(242,194,48),width=6)
        for x in (a,b):
            if u>0.95:d.line([(x,yy+28),(x,top(x)-8)],fill=(255,255,255,120),width=3)
        if u>0.9:k=back((t-1.1)/0.35);d.text(((a+b)/2,yy-70),s.get('text','約30cm'),font=font(int(80*max(0.01,k))),fill=WHITE,anchor='mm',stroke_width=5,stroke_fill=(0,0,0))
        c.add(im)
# ---------- 年号と時の流れ ----------
def year(s,dur,c,repo):
    N=c.N;y0,y1=s.get('from'),s.get('to')
    for n in range(N):
        t=n/FPS;im=SKY.copy().convert('RGBA');d=ImageDraw.Draw(im,'RGBA')
        if y1:
            u=ease((t-0.2)/1.4);yr=int(y0+(y1-y0)*u)
            d.line([(200,H*0.68),(W-200,H*0.68)],fill=GREY,width=6);xx=200+(W-400)*u;d.ellipse([xx-16,H*0.68-16,xx+16,H*0.68+16],fill=(242,194,48))
            d.text((200,H*0.68+50),str(y0),font=font(34),fill=GREY,anchor='mm');d.text((W-200,H*0.68+50),str(y1),font=font(34),fill=GREY,anchor='mm')
            d.text((W/2,H*0.40),str(yr),font=font(170),fill=WHITE,anchor='mm')
        else:
            k=back(t/0.35);d.text((W/2,H*0.45),s['text'],font=font(int(170*max(0.01,k))),fill=WHITE,anchor='mm')
        if s.get('sub') and t>0.6:d.text((W/2,H*0.85),s['sub'],font=font(40),fill=GREY,anchor='mm')
        c.add(im)
