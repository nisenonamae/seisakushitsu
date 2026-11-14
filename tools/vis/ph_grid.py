"""写真の見どころの位置を決めるための見本：16:9 に切り抜いた写真に 0.1 刻みの格子を重ねて並べる。
使い方: python3 ph_grid.py <出力.png> <写真のパス>... （meta.json の代わりにパスを直接渡す）"""
import json,sys
from PIL import Image,ImageDraw,ImageFont
M=json.load(open('ph/meta.json'));keys=sys.argv[2:] or list(M)
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',14)
tiles=[]
for i,k in enumerate(keys):
    im=Image.open(M[k]['file']).convert('RGB');r=max(480/im.width,270/im.height);im=im.resize((int(im.width*r)+1,int(im.height*r)+1));x=(im.width-480)//2;y=(im.height-270)//2;im=im.crop((x,y,x+480,y+270))
    d=ImageDraw.Draw(im)
    for g in range(1,10):
        d.line([(g*48,0),(g*48,270)],fill=(255,255,0),width=1);d.line([(0,g*27),(480,g*27)],fill=(255,255,0),width=1)
    d.rectangle([0,0,480,20],fill=(0,0,0));d.text((4,2),f'{i}: {k[5:60]}',font=F,fill=(255,255,255))
    tiles.append(im)
cols=3;rows=(len(tiles)+cols-1)//cols;o=Image.new('RGB',(480*cols,270*rows))
for i,t in enumerate(tiles):o.paste(t,((i%cols)*480,(i//cols)*270))
o.save(sys.argv[1]);json.dump(keys,open(sys.argv[1]+'.keys.json','w'))
