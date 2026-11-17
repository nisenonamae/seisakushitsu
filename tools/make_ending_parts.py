"""エンディングの絵（作り手がお絵描きで描いたレイヤー）から、場面 ending.html で使う部品を作る。
使い方: python3 tools/make_ending_parts.py <データのリポジトリ>/roadmap/apps/seisakushitsu/data.json <データのリポジトリの根> [絵の id]
  → tools/vis/html/img/end_*.png を作り直す（絵を描き直したら流す）
部品：end_back（宇宙・光の輪・星）／end_sea（海の円。ふちの形はこの絵のまま使う）／end_land_*・end_cloud_*（ぐるっと一周ぶんの帯。前半分＝描いた絵、後ろ半分＝左右を返したもの。f＝平ら・m＝少し球・s＝球）／end_msg・end_lab1・end_lab2（文字）
どのレイヤーが何か（ROLE）は、今の絵（2026-11-17）のレイヤーの並びで決めている。**レイヤーを足したり並べ替えたりしたら ROLE を直す**。地球の位置（EB）と色は ending.html にも書いてあるので、変えたら両方を直す。
吹き出しは絵のものを使わず、ending.html が描き直す（雲と同じレイヤーに描いてあるので、地球の外の白は捨てる）。
"""
import sys,json,math,os,numpy as np
from PIL import Image
ROLE={'back':[0,1,2,3,8],'sea':4,'land':5,'cloud':6,'msg':12,'lab1':9,'lab2':7}   # レイヤーの番号（下から 0）
D=json.load(open(sys.argv[1]));root=sys.argv[2];E=[x for x in D.get('arts',[]) if x.get('kind')=='ending' and not x.get('deleted') and (len(sys.argv)<4 or x['id']==sys.argv[3])];E.sort(key=lambda x:x.get('updatedAt',0));a=E[-1]
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'vis','html','img');W,H=a['w'],a['h']
def L(i):
    p=a['files'].get(a['layers'][i]['id']);return Image.open(os.path.join(root,p)).convert('RGBA') if p and os.path.exists(os.path.join(root,p)) else Image.new('RGBA',(W,H),(0,0,0,0))
# 背景：宇宙＋光の輪（L00〜L03）＋星（L08）＋メッセージのレイヤーにまぎれた星
back=Image.new('RGBA',(W,H),a['bg'])
for i in ROLE['back']:back=Image.alpha_composite(back,L(i))
m12=L(ROLE['msg']);star=m12.copy();px=np.array(star);px[:250]=0;back=Image.alpha_composite(back,Image.fromarray(px))
back.convert('RGB').save(out+'/end_back.png')
msg=np.array(m12);msg[250:]=0;msg=Image.fromarray(msg);bb=msg.getbbox();msg.crop(bb).save(out+'/end_msg.png')
info={'msg':bb}
for key,i in (('lab1',ROLE['lab1']),('lab2',ROLE['lab2'])):
    im=L(i);bb=im.getbbox();im.crop(bb).save(out+f'/end_{key}.png');info[key]=bb
# 地球
EB=(840,430,1096,672);sea=np.array(L(ROLE['sea']).crop(EB));land=np.array(L(ROLE['land']).crop(EB)).astype(float);cloud=np.array(L(ROLE['cloud']).crop(EB)).astype(float)
ys,xs=np.where(sea[:,:,3]>128);cx=(xs.min()+xs.max())/2;cy=(ys.min()+ys.max())/2;rx=(xs.max()-xs.min()+1)/2;ry=(ys.max()-ys.min()+1)/2
info.update(EB=EB,cx=float(cx),cy=float(cy),rx=float(rx),ry=float(ry))
Image.fromarray(sea).save(out+'/end_sea.png')     # 形（ふち）はこの絵のまま使う
# 帯：横＝経度（-180〜180度を TW 点）、縦＝絵の縦のまま。S＝球らしさ（0＝平らに横へ流す、1＝球）
def strip(layer,S,TW=720):
    h,w=layer.shape[:2];al=layer[:,:,3]/255.0;T=np.zeros((h,TW),float)
    lam=(np.arange(TW)+0.5)/TW*2*math.pi-math.pi          # 帯の横の位置 → 経度
    front=np.abs(lam)<=math.pi/2;lf=np.where(front,lam,np.sign(lam)*math.pi-lam)   # 後ろ半分は、前半分を左右に返して使う（つなぎ目が切れない）
    for y in range(h):
        c2=1-((y-cy)/ry)**2
        if c2<=0:continue
        c=math.sqrt(c2)
        # 経度 → 絵の横の位置（flat と sphere を S で混ぜた対応を、逆に引く）
        xsamp=np.linspace(-1,1,801)                       # u＝(x-cx)/(rx*c)
        lam_of_u=(1-S)*(xsamp*c*math.pi/2)+S*np.arcsin(xsamp)
        u=np.interp(lf,lam_of_u,xsamp,left=np.nan,right=np.nan)
        x=cx+u*rx*c;ok=~np.isnan(x);x0=np.clip(np.floor(x[ok]).astype(int),0,w-2);fx=x[ok]-x0
        T[y,ok]=al[y,x0]*(1-fx)+al[y,x0+1]*fx
    return T
for S,tag in ((0.0,'f'),(0.55,'m'),(1.0,'s')):
    for nm,layer in (('land',land),('cloud',cloud)):
        T=strip(layer,S);im=np.zeros(T.shape+(4,),np.uint8);im[:,:,:3]=255;im[:,:,3]=np.clip(T*255,0,255).astype(np.uint8);Image.fromarray(im).save(out+f'/end_{nm}_{tag}.png')
print(a['id'],'rev',a.get('rev'),info)
