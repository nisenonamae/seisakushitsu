"""部品の直し（parts.html の「直しを写す」「ファイルに書き出す」）を、Claude が読める形にする：
 python3 render_parts.py <素材パック.json> <naoshi_….json> <出力フォルダ>
素材ごとに <id>.png（左＝直す前、右＝直した後＋下描き）と、読む.md（判定・ひとこと・やった直しの記録・部品ごとの点の動き）"""
import sys,os,json,math
from PIL import Image,ImageDraw
def _u(p,q):
    x,y=q[0]-p[0],q[1]-p[1];n=math.hypot(x,y) or 1;return (x/n,y/n)
def smooth(pts,k=.5,n=10):   # parts.html の HND と同じ式（取っ手の長さ＝区間の長さ×0.36。2026-11-26）
    N=len(pts);out=[]
    for i in range(N):
        a,b,c,d=pts[(i-1)%N],pts[i],pts[(i+1)%N],pts[(i+2)%N];kb=0 if len(b)>2 and b[2] else k;kc=0 if len(c)>2 and c[2] else k;L=math.hypot(c[0]-b[0],c[1]-b[1])*.72;ub=_u(a,c);uc=_u(b,d);c1=(b[0]+ub[0]*L*kb,b[1]+ub[1]*L*kb);c2=(c[0]-uc[0]*L*kc,c[1]-uc[1]*L*kc)   # [x,y,1]＝角（parts.html と同じ）
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
    byid={p['id']:p for p in parts}
    def hid(p,n=0):
        while p and n<50:
            if p.get('hide'): return True
            p=byid.get(p.get('parent'));n+=1
        return False
    for p in sorted(parts,key=lambda p:p['z']):
        if p.get('folder') or len(p['pts'])<3 or hid(p): continue   # フォルダ・見せない部品は描かない
        poly=sc(smooth(p['pts'],p.get('k') or .5))
        if p.get('a',1)<1:
            L0=Image.new('RGB',im.size,p['color']);m0=Image.new('L',im.size,0);ImageDraw.Draw(m0).polygon(poly,fill=int(255*p['a']));im.paste(L0,(0,0),m0)
        else: ImageDraw.Draw(im).polygon(poly,fill=p['color'])
        if p.get('strokes'):
            L=Image.new('RGB',im.size);m=Image.new('L',im.size,0);ImageDraw.Draw(m).polygon(poly,fill=255);L.paste(im);strokes(ImageDraw.Draw(L),[dict(s,pts=sc(s['pts']),size=s['size']*S) for s in p['strokes']]);im.paste(L,(0,0),m)
    if sketch: strokes(ImageDraw.Draw(im),[dict(s,pts=sc(s['pts']),size=s['size']*S) for s in sketch])
    return im.resize((w,h),Image.LANCZOS)
VERD={'ok':'合格','fix':'直す','redo':'作り直す','':'まだ見ていない'}
def main(packf,retf,od):
    pack={i['id']:i for i in json.load(open(packf,encoding='utf-8'))['items']};ret=json.load(open(retf,encoding='utf-8'));os.makedirs(od,exist_ok=True);md=[f'# 部品の直し：{ret.get("title","")}（{ret["exported"][:16]}）','']
    for r in ret['items']:
        it=pack[r['id']];md+=[f'## {r["name"]}（{r["id"]}）','- 判定：'+VERD.get(r.get('verdict',''),'?'),'- ひとこと：'+(r.get('memo') or 'なし')]
        if not r.get('log') and not r.get('sketch'): md+=['- 直し：なし',''];continue
        a=render(it,it['parts']);b=render(it,r['parts'],r.get('sketch'));S=Image.new('RGB',(a.width*2+10,a.height),'white');S.paste(a,(0,0));S.paste(b,(a.width+10,0));S.save(os.path.join(od,r['id']+'.png'))
        md+=['- やった直し（順に）：']+['  - '+l.get('text',json.dumps(l,ensure_ascii=False)) for l in r['log']]
        o={p['id']:p for p in it['parts']}
        for p in r['parts']:
            q=o.get(p['id'])
            if not q: md.append(f'  - 新しい{"フォルダ" if p.get("folder") else "部品"}：{p["name"]}'+(f'（中身：'+'・'.join(x["name"] for x in r["parts"] if x.get("parent")==p["id"])+'）' if p.get('folder') else '')+('（見せない）' if p.get('hide') else ''));continue
            ch=[]
            if p.get('parent')!=q.get('parent'): ch.append('入れ物 '+next((x['name'] for x in it['parts'] if x['id']==q.get('parent')),'なし')+'→'+next((x['name'] for x in r['parts'] if x['id']==p.get('parent')),'なし'))
            if p.get('hide'): ch.append('見せない')
            if len(p['pts'])!=len(q['pts']): ch.append(f'点 {len(q["pts"])}→{len(p["pts"])}')
            else:
                mv=max(math.hypot(P[0]-Q[0],P[1]-Q[1]) for P,Q in zip(p['pts'],q['pts']))
                if mv>1: ch.append(f'点が最大 {mv:.0f} 動いた')
            nc=lambda ps:sum(1 for t in ps if len(t)>2 and t[2])
            if nc(p['pts'])!=nc(q['pts']): ch.append(f'角の点 {nc(q["pts"])}→{nc(p["pts"])}')
            if p['color']!=q['color']: ch.append(f'色 {q["color"]}→{p["color"]}')
            if p.get('strokes'): ch.append(f'塗り {len(p["strokes"])} 本')
            if abs(p['z']-q['z'])>1e-6: ch.append(f'重なり {q["z"]}→{p["z"]}')
            if ch: md.append(f'  - 変わった部品：{p["name"]}（'+'・'.join(ch)+'）')
        for q in it['parts']:
            if not any(p['id']==q['id'] for p in r['parts']): md.append(f'  - 消えた部品：{q["name"]}')
        md+=[f'- 絵：`{r["id"]}.png`（左＝直す前、右＝直した後）','']
    open(os.path.join(od,'読む.md'),'w',encoding='utf-8').write('\n'.join(md));print('出力：',od)
if __name__=='__main__': main(*sys.argv[1:4])
