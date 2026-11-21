#!/usr/bin/env python3
"""段ごとの一覧を1枚にする（2026-11-21）。場面を "stage":N で止めて描き、横に並べる。
使い方： python3 tools/stage_sheet.py <ページ名> [--spec '{"mode":"tree3"}'] [--stages 1,2,3] [--t 1.0] [--out 段の一覧.png]
  ページ名＝tools/vis/html/ の中の .html（例：tree）。作り手が「どの段でおかしくなったか」を指せるように、絵を作るたびに出す。"""
import argparse,asyncio,json,os,sys
from PIL import Image,ImageDraw,ImageFont
HERE=os.path.dirname(os.path.abspath(__file__));HTML=os.path.join(HERE,'vis','html')
NAMES=['0 設計','1 大きな形','2 部品','3 細部','4 動き（大）','5 動き（小）','6 仕上げ']
def font(sz):
    sys.path.insert(0,os.path.join(HERE,'vis'))
    try:
        import sspaths
        for nm in ('FONT_BOLD','FB','FONT'):
            f=getattr(sspaths,nm,None)
            if f and os.path.exists(str(f)):return ImageFont.truetype(str(f),sz)
    except Exception:pass
    for root in ('/usr/share/fonts','/Library/Fonts','/System/Library/Fonts',os.path.expanduser('~/Library/Fonts')):
        for d,_,fs in os.walk(root):
            for f in fs:
                if any(k in f for k in ('NotoSansCJK','NotoSansJP','BIZ-UDGothic','BIZUDGothic','Hiragino','ヒラギノ')) and f.lower().endswith(('.ttc','.otf','.ttf')):
                    try:return ImageFont.truetype(os.path.join(d,f),sz)
                    except Exception:pass
    return ImageFont.load_default()
async def shots(page_name,spec,stages,t,tmp):
    from playwright.async_api import async_playwright
    out=[]
    async with async_playwright() as pw:
        b=await pw.chromium.launch(args=['--allow-file-access-from-files']);p=await b.new_page(viewport={'width':1280,'height':720})
        errs=[];p.on('pageerror',lambda e:errs.append(str(e)))
        await p.goto('file://'+os.path.join(HTML,page_name+'.html'))
        for st in stages:
            sp=dict(spec);sp['stage']=st
            await p.evaluate('([s,d])=>setup(s,d)',[sp,8]);await p.evaluate('t=>render(t)',t)
            f=os.path.join(tmp,f'stage{st}.png');await p.screenshot(path=f);out.append(f)
        await b.close()
        if errs:print('要確認：ページのエラー',errs[:3])
    return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument('page');ap.add_argument('--spec',default='{}');ap.add_argument('--stages',default='1,2,3');ap.add_argument('--t',type=float,default=1.0);ap.add_argument('--out',default='段の一覧.png')
    a=ap.parse_args();stages=[int(x) for x in a.stages.split(',')];import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        fs=asyncio.run(shots(a.page,json.loads(a.spec),stages,a.t,tmp));n=len(fs);cols=min(n,3);rows=(n+cols-1)//cols;w,h=960,540
        sheet=Image.new('RGB',(cols*w+(cols+1)*12,rows*(h+56)+12),(24,28,36));d=ImageDraw.Draw(sheet);fo=font(30)
        for i,f in enumerate(fs):
            x=12+(i%cols)*(w+12);y=12+(i//cols)*(h+56);sheet.paste(Image.open(f).convert('RGB').resize((w,h),Image.LANCZOS),(x,y))
            d.text((x+6,y+h+8),NAMES[stages[i]] if stages[i]<len(NAMES) else f'{stages[i]}',fill=(255,255,255),font=fo)
        sheet.save(a.out);print('段の一覧',a.out,sheet.size)
if __name__=='__main__':main()
