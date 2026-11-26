"""本番の絵（arabia.html の描くコード）を、そのまま部品の素材パックにする：
 python3 cap_art.py /tmp/cap.json          … 描くコードが塗った形を1つずつ記録する（色・点）
 python3 cap_parts.py /tmp/cap.json packs/<名前>.json <パックid> <題>
塗り1つ＝部品1つ（線は太さの分だけふくらませて部品にする）。名前と親子は場所と色から付ける（作り手が名前を変えられる）。
「胴（全体）」「頭（全体）」を動かすと、その子の部品が全部ついてくる"""
import json,sys,math,glob,os
def area(p): return abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p))))/2
def cen(p): return (sum(q[0] for q in p)/len(p),sum(q[1] for q in p)/len(p))
def turn(p,i):
    a,b,c=p[i-1],p[i],p[(i+1)%len(p)];v=(b[0]-a[0],b[1]-a[1]);u=(c[0]-b[0],c[1]-b[1]);d=math.hypot(*v)*math.hypot(*u)
    return 0 if d<1e-9 else math.acos(max(-1,min(1,(v[0]*u[0]+v[1]*u[1])/d)))
def thin(p,n=26,sharp=True,ends=False):
    """点を n 個くらいに減らす。とがった所（向きが 50 度より急に変わる点）は必ず残して角の点 [x,y,1] にする（parts.html で丸くならない）"""
    if len(p)>1 and math.hypot(p[0][0]-p[-1][0],p[0][1]-p[-1][1])<.5: p=p[:-1]
    C=set(i for i in range(len(p)) if sharp and len(p)>3 and turn(p,i)>math.radians(50))
    if len(C)>n*.6: C=set()   # ほとんど全部が角＝ぎざぎざの線。角にしない
    keep=range(len(p)) if len(p)<=n else sorted(C|set(int(i*len(p)/n) for i in range(n)))
    if ends: keep=sorted(set(keep)|{0,len(p)-1})   # つなぎ目の部品は、最初と最後の点（付け根）を必ず残す
    return [(p[i][0],p[i][1],1) if i in C else (p[i][0],p[i][1]) for i in keep]
def fat(p,w):
    L=[];R=[]
    for i,(x,y) in enumerate(p):
        a=p[max(0,i-1)];b=p[min(len(p)-1,i+1)];dx,dy=b[0]-a[0],b[1]-a[1];d=math.hypot(dx,dy) or 1;nx,ny=-dy/d*w/2,dx/d*w/2;L.append((x+nx,y+ny));R.append((x-nx,y-ny))
    return L+R[::-1]
def hexa(c):
    if c.startswith('#') and len(c)==7: return c
    if c.startswith('rgb'):
        v=[float(t) for t in c[c.index('(')+1:c.index(')')].split(',')[:3]];return '#%02x%02x%02x'%tuple(int(t) for t in v)
    return '#888888'
def lum(c): return (int(c[1:3],16)*.3+int(c[3:5],16)*.59+int(c[5:7],16)*.11)
def pinkish(c): r,g,b=int(c[1:3],16),int(c[3:5],16),int(c[5:7],16);return r-g>28
def build(id,name,kind,shapes,mode):
    S=[]
    for s in shapes:
        p=[tuple(q) for q in s['pts']]
        st=s['k']=='stroke'
        if st: p=fat(p,max(2,s['w']))
        p=thin(p,sharp=not st,ends=bool((s.get('nm') or {}).get('j')))   # 線をふくらませた形は、端が丸い（lineCap round）ので角にしない
        if len(p)<3 or area(p)<2: continue
        S.append(dict(pts=p,color=hexa(s['c']),a=s.get('a',1),nm=s.get('nm')))
    xs=[q[0] for s in S for q in s['pts']];ys=[q[1] for s in S for q in s['pts']];m=40;x0,y0=min(xs)-m,min(ys)-m;w,h=int(max(xs)-min(xs)+2*m),int(max(ys)-min(ys)+2*m)
    for s in S: s['pts']=[[round(q[0]-x0,1),round(q[1]-y0,1)]+([1] if len(q)>2 else []) for q in s['pts']]
    W,Hh=max(xs)-min(xs),max(ys)-min(ys);parts=[];cnt={}
    if mode=='named':   # 描く式が名前とまとまりを付けた素材（extra_art.js の NM）。まとまりの頭を動かすと、同じまとまりがついてくる
        heads={};root=None
        for i,s in enumerate(S):
            m=s['nm'] or {};q=dict(id=f'p{i}',name=m.get('n') or f'部品 {i+1}',z=i,color=s['color'],pts=s['pts'],joint=bool(m.get('j')),parent=None,strokes=[],**({'a':round(s['a'],2)} if s['a']<1 else {}))
            if m.get('r') and root is None: root=q
            if m.get('h') and m.get('g') and m['g'] not in heads: heads[m['g']]=q
            q['_g']=m.get('g','');parts.append(q)
        seen={}
        for q in parts:
            seen[q['name']]=seen.get(q['name'],0)+1
            if seen[q['name']]>1: q['name']+=f' {seen[q["name"]]}'   # 同じ名前（年輪を2度塗った等）は番号で分ける
            hd=heads.get(q['_g'])
            q['parent']=None if q is root else (hd['id'] if hd and hd is not q else (root['id'] if root else None))
            del q['_g']
        if root: root['name']+='（全体）'
        return dict(id=id,name=name,kind=kind,w=w,h=h,bg='#e9e6dc',parts=parts)
    def nm(b):
        cnt[b]=cnt.get(b,0)+1;return b if cnt[b]==1 else f'{b} {cnt[b]}'
    for i,s in enumerate(S):
        cx,cy=cen(s['pts']);u,v=(cx-m)/W,(cy-m)/Hh;c=s['color'];ar=area(s['pts'])/(W*Hh);g='body'
        if mode=='hippo':
            if c in('#ffffff','#1b1516'): b,g='目','head'
            elif c=='#f4ecd8': b,g='きば・歯','head'
            elif u>.6 and c in('#d98f92','#dc9a9c','#7c3640'): b,g='口の中','head'
            elif u>.57 and v<.34 and u<.7: b,g=('耳の中' if pinkish(c) else '耳'),'head'
            elif u>.6:
                g='head';b='あごの下' if pinkish(c) and v>.5 else '目のまわり' if pinkish(c) else '鼻のあな' if u>.86 and v<.42 and ar<.004 else 'まぶた・こぶ' if ar<.004 else '下あご' if v>.52 else '頭の明るい所' if lum(c)>128 else '頭'
            elif v>.7 and ar<.05: b='足先' if lum(c)<95 and ar<.012 else 'あし（奥）' if lum(c)<95 else 'あし'
            elif pinkish(c): b='腹'
            elif lum(c)>128: b='背中の明るい所'
            elif u>.42 and ar<.12: b='肩・胸'
            else: b='胴'
        elif mode=='face':
            b='目' if c in('#ffffff','#1b1516') else '耳の中・目のまわり' if pinkish(c) else '鼻のあな' if lum(c)<80 else '明るい所' if lum(c)>135 else '線' if ar<.004 else '顔'
        else:
            b='影' if i==0 else '幹・枝' if lum(c)<70 and not (int(c[3:5],16)>int(c[1:3],16)+15) else '葉'
        parts.append(dict(id=f'p{i}',name=nm(b),z=i,color=c,pts=s['pts'],joint=False,parent=None,strokes=[],_g=g,_a=area(s['pts']),**({'a':round(s['a'],2)} if s['a']<1 else {})))
    root=max((p for p in parts if p['_g']=='body'),key=lambda p:p['_a'])
    root['name']={'hippo':'胴（全体）','face':'顔（全体）'}.get(mode,root['name']+'（全体）')
    for p in parts:
        if p is not root: p['parent']=root['id']
    hd=[p for p in parts if p['_g']=='head']
    if hd:
        hr=max(hd,key=lambda p:p['_a']);hr['name']='頭（全体）';hr['parent']=root['id']
        for p in hd:
            if p is not hr: p['parent']=hr['id']
    for p in parts: del p['_g'],p['_a']
    return dict(id=id,name=name,kind=kind,w=w,h=h,bg='#e9e6dc',parts=parts)
ITEMS=[('haha','母カバ（全身）','動かす素材','hippo'),('haha_kuchi','母カバ（口を開ける）','差し替え絵','hippo'),('ko','子カバ（全身）','動かす素材','hippo'),('shomen','カバの顔（正面）','動かす素材','face'),('acacia','アカシアの木','背景の素材','tree')]
ITEMS+=[('ashi','葦の株','背景の素材','named'),('shibuki','水しぶき','動かす素材','named'),('hamon','波紋（横から）','動かす素材','named'),('hamon_ue','波紋（上から）','動かす素材','named'),
 ('doro','泥の雲（水の中）','動かす素材','named'),('maruta','丸太','背景の素材','named'),('zugaikotsu','カバの頭の骨（横）','動かす素材','named'),('zugaikotsu_hiraku','カバの頭の骨（下あごが外れる）','差し替え絵','named')]
def main(capf,out,pack,title):
    C=json.load(open(capf));its=[build(k,n,kd,C[k],md) for k,n,kd,md in ITEMS if k in C]
    json.dump(dict(v=3,pack=pack,title=title,items=its),open(out,'w',encoding='utf-8'),ensure_ascii=False)
    d=os.path.dirname(out);L=[]
    for f in sorted(glob.glob(os.path.join(d,'*.json'))):
        if f.endswith('index.json'): continue
        q=json.load(open(f,encoding='utf-8'))
        if q.get('v')==3: L.append(dict(file=os.path.basename(f),pack=q['pack'],title=q.get('title',q['pack']),n=len(q['items'])))
    json.dump(L,open(os.path.join(d,'index.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    for i in its: print(i['name'],len(i['parts']),i['w'],i['h'],sorted(set(p['name'].split(' ')[0] for p in i['parts'])))
if __name__=='__main__': main(*sys.argv[1:5])
