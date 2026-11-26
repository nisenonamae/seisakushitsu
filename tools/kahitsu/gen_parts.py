"""部品でできた素材パック（v3）を作る： python3 gen_parts.py <出力.json>
素材＝部品の集まり。部品＝{id,name,z（重なり。大きいほど手前）,color,pts（輪郭の点。なめらかにつないで閉じる）,joint（true＝最初と最後の点が親とのつなぎ目）,parent,strokes（部品の中の塗り）}
お絵描きの「部品で直す」（parts.html）で開く。作り手の直しは、この形のまま返ってくる（render_parts.py で前後を絵にする）"""
import json,sys,math,copy
def P(id,name,z,color,pts,joint=False,parent=None): return dict(id=id,name=name,z=z,color=color,pts=[[float(x),float(y)] for x,y in pts],joint=joint,parent=parent,strokes=[])
def circ(cx,cy,rx,ry,n=8): return [(cx+rx*math.cos(2*math.pi*i/n),cy+ry*math.sin(2*math.pi*i/n)) for i in range(n)]
def kids(parts,id):
    out=[id];
    for p in parts:
        if p['parent']==id: out+=kids(parts,p['id'])
    return out
def tf(parts,ids,f):
    for p in parts:
        if p['id'] in ids: p['pts']=[list(f(x,y)) for x,y in p['pts']]
def rot(parts,id,deg,cx,cy):
    a=math.radians(deg);c,s=math.cos(a),math.sin(a);tf(parts,kids(parts,id),lambda x,y:(cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c))
def scale(parts,id,k,cx,cy): tf(parts,kids(parts,id),lambda x,y:(cx+(x-cx)*k,cy+(y-cy)*k))
def hippo(B='#8a7b78',H='#918380',D='#6f6260',J='#7c6e6b'):
    return [
     P('legHF','後ろあし（奥）',1,D,[(315,385),(372,392),(378,500),(364,520),(316,520),(308,500)],True,'body'),
     P('legFF','前あし（奥）',1,D,[(512,388),(560,392),(566,500),(552,520),(508,520),(500,500)],True,'body'),
     P('tail','しっぽ',2,D,[(196,268),(172,286),(162,332),(174,336),(187,302),(204,290)],True,'body'),
     P('body','胴',3,B,[(200,250),(260,190),(380,165),(520,170),(630,200),(680,270),(670,350),(600,410),(460,430),(320,425),(220,390),(180,320)]),
     P('legHN','後ろあし（手前）',4,B,[(266,385),(330,395),(336,500),(322,520),(270,520),(262,500)],True,'body'),
     P('legFN','前あし（手前）',4,B,[(558,390),(612,395),(618,500),(604,520),(558,520),(548,500)],True,'body'),
     P('earF','耳（奥）',5,D,[(668,186),(660,150),(676,132),(694,150),(692,184)],True,'head'),
     P('jaw','下あご',6,J,[(694,346),(800,354),(892,338),(902,366),(850,390),(740,392),(688,376)],True,'head'),
     P('head','頭',7,H,[(620,200),(700,175),(790,185),(860,215),(905,250),(915,300),(895,340),(830,360),(740,365),(640,382)],True,'body'),
     P('earN','耳（手前）',8,H,[(702,182),(696,142),(714,125),(732,146),(728,182)],True,'head'),
     P('eye','目',9,'#2b2523',circ(772,216,9,9,6),False,'head'),
     P('nose','鼻のあな',9,'#5d514f',circ(886,246,7,5,6),False,'head')]
def item(id,name,kind,w,h,parts,bg='#e9e6dc'): return dict(id=id,name=name,kind=kind,w=w,h=h,bg=bg,parts=parts)
def main(out):
    m=hippo()
    o=hippo();o+=[P('mouth','口の中',5.5,'#c98a80',[(700,350),(800,356),(888,344),(880,372),(790,380),(700,372)],False,'head'),P('tusk','きば',5.8,'#f1ead6',[(846,372),(856,330),(870,372)],True,'jaw')]
    rot(o,'jaw',22,694,362);rot(o,'head',-8,630,290)
    c=hippo('#b08f86','#b8968c','#8f7269','#a07f76');scale(c,'body',.62,430,430);scale(c,'head',1.22,560,330)
    for p in c:
        if p['id'].startswith('leg'): p['pts']=[[x,y if y<470 else y-28] for x,y in p['pts']]
    t=[P('trunk','幹',2,'#4f4136',[(385,560),(396,400),(382,300),(412,300),(426,400),(436,560)]),
       P('brL','枝（左）',1,'#4f4136',[(386,332),(300,250),(250,226),(256,214),(312,236),(402,306)],True,'trunk'),
       P('brR','枝（右）',1,'#4f4136',[(404,322),(482,250),(542,220),(550,232),(494,264),(420,338)],True,'trunk'),
       P('canL','葉（左）',3,'#3f7f66',circ(262,214,135,36,10),False,'trunk'),
       P('canM','葉（まん中）',4,'#2f6f5c',circ(404,202,285,56,12),False,'trunk'),
       P('canT','葉（上）',5,'#6fae82',circ(436,158,150,40,10),False,'trunk')]
    its=[item('haha','母カバ（横・全身）','動かす素材',1000,600,m),item('haha_kuchi','母カバ（口を開ける）','差し替え絵',1000,600,o),item('ko','子カバ','動かす素材',1000,600,c),item('acacia','アカシアの木','背景の素材',800,600,t)]
    json.dump(dict(v=3,pack='arabia_parts_001',title='緑のアラビア 序・部品1',items=its),open(out,'w',encoding='utf-8'),ensure_ascii=False);print('作った：',out,len(its))
    import glob,os;d=os.path.dirname(out);L=[]
    for f in sorted(glob.glob(os.path.join(d,'*.json'))):
        if f.endswith('index.json'): continue
        q=json.load(open(f,encoding='utf-8'))
        if q.get('v')==3: L.append(dict(file=os.path.basename(f),pack=q['pack'],title=q.get('title',q['pack']),n=len(q['items'])))
    json.dump(L,open(os.path.join(d,'index.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)   # 一覧（parts.html が自分で読む。作り手がファイルを選ばなくていい）
if __name__=='__main__': main(sys.argv[1])
