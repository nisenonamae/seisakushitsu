"""全部の段の画面を作る（絵コンテのカードを出さないため）。
使い方: python3 tools/make_scenes.py --data <data.json> --proj <id> --repo <notion-daily> [--speed 1.1] [--force]
- 肉付けの各段の `scene`（部品の指定。tools/vis/scenes.py の make に渡す形 {"t":部品,...}）から、
  その段の語りの長さぶんの動画を作り、visuals/<projId>/scene_<段のid>.mp4 に置いて、構成の段の `visual` にする
- `scene` がない段・すでに `visual` がある段は飛ばす（--force なら作り直す）
- 書き換えた data.json を同じ場所に保存する（push は呼び出す側で）"""
import argparse, json, os, sys
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'vis'))
import scenes
ap=argparse.ArgumentParser();ap.add_argument('--data');ap.add_argument('--proj');ap.add_argument('--repo');ap.add_argument('--speed',type=float,default=1.1);ap.add_argument('--force',action='store_true');ap.add_argument('--only',default='')
a=ap.parse_args();D=json.load(open(a.data,encoding='utf-8'));P=[p for p in D['projects'] if p['id']==a.proj][0]
O={b['id']:b for b in P['outline']['blocks']};V=f'roadmap/apps/seisakushitsu/visuals/{a.proj}/'
os.makedirs(os.path.join(a.repo,V),exist_ok=True)
for b in P['flesh']['blocks']:
    o=O.get(b.get('oid'));sc=b.get('scene')
    if not o or not sc or b.get('mark')=='削る':continue
    if a.only and b['id'] not in a.only.split(','):continue
    if o.get('visual') and not a.force and not a.only:continue
    dur=len(b.get('narr',''))/5.5/a.speed+2.0
    out=V+f"scene_{b['id']}.mp4";scenes.make(sc,dur,os.path.join(a.repo,out),a.repo)
    o['visual']=out;print('made',b['role'],round(dur,1),'s',flush=True)
    json.dump(D,open(a.data,'w',encoding='utf-8'),ensure_ascii=False)
json.dump(D,open(a.data,'w',encoding='utf-8'),ensure_ascii=False)
