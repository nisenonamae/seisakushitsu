import asyncio,json,base64,io
from playwright.async_api import async_playwright
from PIL import Image
H='/home/claude/seisakushitsu/tools/vis/html/arabia.html'
BG="rect(0,0,W,H,'#e9e6dc');"
A=[('haha_yoko','母カバ（横・水の上）','動かす素材',"hpS({x:560,y:380,s:1.5,dir:1,seed:2,v:{...hv(2),tn:-.5}},0,{fl:30})",(140,180,1120,520),['頭','あご','耳','目','背中','胴']),
 ('haha_kuchi','母カバ（口を開ける）','動かす素材',"hpS({x:560,y:400,s:1.5,dir:1,seed:2,v:{...hv(2),tn:-.5}},0,{fl:30,jaw:.2})",(140,150,1120,540),['頭','あご','牙','口の中','耳','目','背中']),
 ('haha_zenshin','母カバ（全身・水の中）','動かす素材',"hp3({x:620,y:330,s:1.5,yaw:10,seed:2,v:{...hv(2),tn:-.5}},0,{full:1,fl:0})",(180,120,1100,620),['頭','あご','耳','目','胴','前あし','後ろあし','しっぽ']),
 ('ko_zenshin','子カバ（全身）','動かす素材',"hp3({x:640,y:340,s:1.3,yaw:12,seed:33,v:{...hv(33),tn:1,L:.8}},0,{full:1,fl:0})",(240,140,1040,600),['頭','耳','目','胴','前あし','後ろあし']),
 ('acacia','アカシアの木','背景の素材',"tree4(640,620,4.2,244,{acacia:1})",(240,100,1040,680),['幹','枝','葉のかさ']),
 ('shomen','カバの顔（正面）','動かす素材',"face3(640,400,1.15,0,{})",(240,120,1040,640),['耳','目','鼻','鼻づら'])]
async def run():
  out=[]
  async with async_playwright() as pw:
    b=await pw.chromium.launch(args=['--allow-file-access-from-files']);p=await b.new_page(viewport={'width':1280,'height':720})
    await p.goto('file://'+H);await p.evaluate('([s,d])=>setup(s,d)',[{'mode':'intro7'},29]);await p.evaluate('render(5)')
    for id,name,kind,js,box,parts in A:
      try: await p.evaluate(BG+js)
      except Exception as e: print('ERR',id,str(e)[:200]);continue
      await p.screenshot(path='/tmp/kh/_s.png');im=Image.open('/tmp/kh/_s.png').convert('RGB').crop(box);im.save(f'/tmp/kh/{id}.png');bio=io.BytesIO();im.save(bio,'PNG')
      out.append(dict(id=id,name=name,kind=kind,scene='序',parts=parts,w=im.width,h=im.height,src='data:image/png;base64,'+base64.b64encode(bio.getvalue()).decode()))
    for t,id,name in [(24.7,'bamen_au','場面：群れと会う'),(13.0,'bamen_shizumu','場面：カメラが沈む')]:
      await p.evaluate('t=>render(t)',t);await p.screenshot(path='/tmp/kh/_s.png');im=Image.open('/tmp/kh/_s.png').convert('RGB').resize((960,540));im.save(f'/tmp/kh/{id}.png');bio=io.BytesIO();im.save(bio,'JPEG',quality=88)
      out.append(dict(id=id,name=name,kind='場面（構図）',scene='序',parts=['母','子','群れ','水面','底','空・木','手前の草'],w=960,h=540,src='data:image/jpeg;base64,'+base64.b64encode(bio.getvalue()).decode()))
    await b.close()
  json.dump(dict(pack='arabia_jo_001',title='緑のアラビア 序・素材1',items=out),open('/tmp/kh/pack.json','w'),ensure_ascii=False);print(len(out))
asyncio.run(run())
