"""部品の直し（parts.html の「直しを写す」「ファイルに書き出す」）を、Claude が読める形にする：
 python3 render_parts.py <素材パック.json> <naoshi_….json> <出力フォルダ>
素材ごとに <id>.png（左＝直す前、右＝直した後＋下描き）と、読む.md（判定・ひとこと・やった直しの記録・部品ごとの点の動き）"""
import sys,os,json,math
from PIL import Image,ImageDraw
def smooth(pts,k=.5,n=10):
    N=len(pts);out=[]
    for i in range(N):
        a,b,c,d=pts[(i-1)%N],pts[i],pts[(i+1)%N],pts[(i+2)%N];c1=(b[0]+(c[0]-a[0])*k/3,b[1]+(c[1]-a[1])*k/3);c2=(c[0]-(d[0]-b[0])*k/3,c[1]-(d[1]-b[1])*k/3)
        for j in range(n):
            t=j/n;u=1-t;out.append((u**3*b[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t**3*c[0],u**3*b[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t**3*c[1]))
    return out
def strokes(d,ss):
    for s in ss:
        p=[tuple(q) for q in s['pts']];r=s['size']/2
        if len(p)>1: d.line(p,fill=s['color'],width=max(1,int(s['size'])),joint='curve')
        for q in (p[0],p[-1]): d.ellipse([q[0]-r,q[1]-r,q[0]+r,q[1]+r],fill=s['color'])
def render(it,parts,sketch=None,S=2):
    w,h=it['w'],it['h'];im=Image.new('RGB',(w*S,h*S),it.get('bg','#e9e6dc'))
    sc=lambda ps:[(x*S,y*S) for x,y in ps]
    for p in sorted(parts,key=lambda p:p['z']):
        poly=sc(smooth(p['pts']));ImageDraw.Draw(im).polygon(poly,fill=p['color'])
        if p.get('strokes'):
            L=Image.new('RGB',im.size);m=Image.new('L',im.size,0);ImageDraw.Draw(m).polygon(poly,fill=255);L.paste(im);strokes(ImageDraw.Draw(L),[dict(s,pts=sc(s['pts']),size=s['size']*S) for s in p['strokes']]);im.paste(L,(0,0),m)
    if sketch: strokes(ImageDraw.Draw(im),[dict(s,pts=sc(s['pts']),size=s['size']*S) for s in sketch])
    return im.resize((w,h),Image.LANCZOS)
VERD={'ok':'合格','fix':'直す','redo':'作り直す','':'まだ見ていない'}
def main(packf,retf,od):
    pack={i['id']:i for i in json.load(open(packf,encoding='utf-8'))['items']};ret=json.load(open(retf,encoding='utf-8'));os.makedirs(od,exist_ok=True);md=[f'# 部品の直し：{ret.get("title","")}（{ret["exported"][:16]}）','']
    for r in ret['items']:
        it=pack[r['id']];md+=[f'## {r["name"]}（{r["id"]}）','- 判定：'+VERD.get(r.get('verdict',''),'?'),'- ひとこと：'+(r.get('memo') or 'なし')]
        if not r.get('log'): md+=['- 直し：なし',''];continue
        a=render(it,it['parts']);b=render(it,r['parts'],r.get('sketch'));S=Image.new('RGB',(a.width*2+10,a.height),'white');S.paste(a,(0,0));S.paste(b,(a.width+10,0));S.save(os.path.join(od,r['id']+'.png'))
        md+=['- やった直し（順に）：']+['  - '+l.get('text',json.dumps(l,ensure_ascii=False)) for l in r['log']]
        o={p['id']:p for p in it['parts']}
        for p in r['parts']:
            q=o.get(p['id'])
            if not q: md.append(f'  - 新しい部品：{p["name"]}');continue
            ch=[]
            if len(p['pts'])!=len(q['pts']): ch.append(f'点 {len(q["pts"])}→{len(p["pts"])}')
            else:
                mv=max(math.hypot(x-u,y-v) for (x,y),(u,v) in zip(p['pts'],q['pts']))
                if mv>1: ch.append(f'点が最大 {mv:.0f} 動いた')
            if p['color']!=q['color']: ch.append(f'色 {q["color"]}→{p["color"]}')
            if p.get('strokes'): ch.append(f'塗り {len(p["strokes"])} 本')
            if abs(p['z']-q['z'])>1e-6: ch.append(f'重なり {q["z"]}→{p["z"]}')
            if ch: md.append(f'  - 変わった部品：{p["name"]}（'+'・'.join(ch)+'）')
        md+=[f'- 絵：`{r["id"]}.png`（左＝直す前、右＝直した後）','']
    open(os.path.join(od,'読む.md'),'w',encoding='utf-8').write('\n'.join(md));print('出力：',od)
if __name__=='__main__': main(*sys.argv[1:4])
