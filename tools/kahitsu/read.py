"""作り手が書き出した加筆ファイルを、Claude が読める形にほどく：
 python3 read.py <素材パック.json> <kahitsu_….json> <出力フォルダ>
素材ごとに：<id>_塗り.png（塗った色のまま）・<id>_属性.png（属性の色＋番号）・<id>_<番号>.png（線1本ずつのまわりを拡大）と、読む.md"""
import sys,os,json,base64,io
from PIL import Image,ImageDraw,ImageFont
COL={'fine':'#2c7a4b','shape':'#1f6fb2','redo':'#b23b3b','erase':'#77736a','place':'#8a4fb5'}
NAME={'fine':'細かい直し（描いたとおりに）','shape':'形を変える（輪郭をこの線へ寄せる）','redo':'作り直す（この下描きから学ぶ）','erase':'消す','place':'置き方・構図'}
VERD={'ok':'合格','fix':'直す','redo':'作り直す','':'まだ見ていない'}
def img(src): return Image.open(io.BytesIO(base64.b64decode(src.split(',',1)[1]))).convert('RGB')
def font(n):
    for f in ('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f,n)
    return ImageFont.load_default()
def line(d,s,c):
    pts=[tuple(p) for p in s['pts']];r=s['size']/2
    if len(pts)>1: d.line(pts,fill=c,width=int(s['size']),joint='curve')
    for p in (pts[0],pts[-1]): d.ellipse([p[0]-r,p[1]-r,p[0]+r,p[1]+r],fill=c)
def main(packf,retf,od):
    pack={i['id']:i for i in json.load(open(packf,encoding='utf-8'))['items']};ret=json.load(open(retf,encoding='utf-8'));os.makedirs(od,exist_ok=True)
    if ret.get('kahitsu')==2: return main2(pack,ret,od)
    md=[f'# 加筆の読み取り：{ret.get("title","")}（{ret["exported"][:16]}）','','属性の意味：']+[f'- {v}' for v in NAME.values()]+['']
    for it in ret['items']:
        src=it.get('src') or pack.get(it['id'],{}).get('src')
        md+=[f'## {it["name"]}（{it["id"]}）','- 判定：'+VERD.get(it.get('verdict',''),'?'),'- ひとこと：'+(it.get('note') or 'なし')]
        if not src: md.append('- （元の絵が見つからない）');continue
        if not it['strokes']: md.append('- 線：なし');md.append('');continue
        base=img(src);a=base.copy();b=base.copy();da=ImageDraw.Draw(a);db=ImageDraw.Draw(b);F=font(18)
        for k,s in enumerate(it['strokes']):
            line(da,s,'#ffffff' if s['attr']=='erase' else s['color']);line(db,s,COL[s['attr']])
            x,y=s['pts'][0];db.text((x+6,y-22),str(k+1),fill='white',font=F,stroke_width=3,stroke_fill='black')
            xs=[p[0] for p in s['pts']];ys=[p[1] for p in s['pts']];m=60;box=(max(0,min(xs)-m),max(0,min(ys)-m),min(base.width,max(xs)+m),min(base.height,max(ys)+m))
            w=box[2]-box[0];h=box[3]-box[1];z=max(1,min(4,420//max(w,h,1)));one=base.copy();line(ImageDraw.Draw(one),s,'#ffffff' if s['attr']=='erase' else s['color'])
            S=Image.new('RGB',(2*w*z+8,h*z),'white');S.paste(base.crop(box).resize((w*z,h*z),Image.LANCZOS),(0,0));S.paste(one.crop(box).resize((w*z,h*z),Image.LANCZOS),(w*z+8,0));S.save(os.path.join(od,f'{it["id"]}_{k+1}.png'))
            md.append(f'- 線{k+1}：**{NAME[s["attr"]]}**／部品：{s.get("part") or "決めていない"}／色 {s["color"]}・太さ {s["size"]}／場所 x{box[0]}〜{box[2]} y{box[1]}〜{box[3]}／ひとこと：{s.get("note") or "なし"}　→ `{it["id"]}_{k+1}.png`（左＝元、右＝加筆）')
        a.save(os.path.join(od,f'{it["id"]}_塗り.png'));b.save(os.path.join(od,f'{it["id"]}_属性.png'));md+=[f'- 全体：`{it["id"]}_塗り.png`・`{it["id"]}_属性.png`','']
    open(os.path.join(od,'読む.md'),'w',encoding='utf-8').write('\n'.join(md));print('出力：',od)
def main2(pack,ret,od):
    """お絵描き（draw.html の「直し」）から。線ではなく、直しの種類ごとのレイヤー（透明な PNG）で来る"""
    md=[f'# 加筆の読み取り：{ret.get("title","")}（{ret["exported"][:16]}）','','属性の意味：']+[f'- {v}' for v in NAME.values()]+['- 種類なし＝作り手が種類を付けずに描いたレイヤー（何の直しかを聞く）','']
    for it in ret['items']:
        src=pack.get(it['id'],{}).get('src');md+=[f'## {it["name"]}（{it["id"]}）','- 判定：'+VERD.get(it.get('verdict',''),'?'),'- ひとこと：'+(it.get('memo') or 'なし')]
        if not it.get('layers'): md+=['- 直しのレイヤー：なし',''];continue
        base=img(src).convert('RGBA') if src else Image.new('RGBA',(it['w'],it['h']),'white');allc=base.copy()
        for k,l in enumerate(it['layers']):
            L=Image.open(io.BytesIO(base64.b64decode(l['png'].split(',',1)[1]))).convert('RGBA')
            if L.size!=base.size: L=L.resize(base.size)
            if l.get('opacity',1)<1: L.putalpha(L.getchannel('A').point(lambda a:int(a*l['opacity'])))
            allc=Image.alpha_composite(allc,L);box=L.getchannel('A').getbbox() or (0,0)+base.size;m=50;box=(max(0,box[0]-m),max(0,box[1]-m),min(base.width,box[2]+m),min(base.height,box[3]+m))
            w=box[2]-box[0];h=box[3]-box[1];z=max(1,min(3,520//max(w,h,1)));one=Image.alpha_composite(base,L);S=Image.new('RGB',(2*w*z+8,h*z),'white')
            S.paste(base.crop(box).convert('RGB').resize((w*z,h*z),Image.LANCZOS),(0,0));S.paste(one.crop(box).convert('RGB').resize((w*z,h*z),Image.LANCZOS),(w*z+8,0));f=f'{it["id"]}_{k+1}_{l.get("fix") or "none"}.png';S.save(os.path.join(od,f))
            md.append(f'- レイヤー{k+1}「{l["name"]}」：**{NAME.get(l.get("fix"),"種類なし")}**／部品：{l.get("part") or "決めていない"}／場所 x{box[0]}〜{box[2]} y{box[1]}〜{box[3]}　→ `{f}`（左＝元、右＝加筆）')
        allc.convert('RGB').save(os.path.join(od,f'{it["id"]}_全部.png'));md+=[f'- 全体：`{it["id"]}_全部.png`','']
    open(os.path.join(od,'読む.md'),'w',encoding='utf-8').write('\n'.join(md));print('出力：',od)
if __name__=='__main__': main(*sys.argv[1:4])
