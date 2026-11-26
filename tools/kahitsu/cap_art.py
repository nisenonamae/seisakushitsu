import asyncio,json,sys
from playwright.async_api import async_playwright
import os
D0=os.path.dirname(os.path.abspath(__file__));H=os.path.join(D0,'..','vis','html','arabia.html');EXTRA=os.path.join(D0,'extra_art.js')   # 本番に無い素材の式（葦・しぶき…）
REC=r'''
(()=>{const P=CanvasRenderingContext2D.prototype,o={};['beginPath','moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','ellipse','rect','closePath','fill','stroke','fillRect','roundRect','arcTo'].forEach(k=>o[k]=P[k]);
window.CAP=null;let subs=[],cur=null,last=null;
const T=(c,x,y)=>{const m=c.getTransform();return[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]};
const add=(c,x,y)=>{if(!cur){cur=[];subs.push(cur)}const q=T(c,x,y);cur.push(q);last=[x,y]};
P.beginPath=function(){subs=[];cur=null;last=null;return o.beginPath.call(this)};
P.moveTo=function(x,y){if(CAP){cur=[];subs.push(cur);add(this,x,y)}return o.moveTo.call(this,x,y)};
P.lineTo=function(x,y){if(CAP)add(this,x,y);return o.lineTo.call(this,x,y)};
P.closePath=function(){cur=null;return o.closePath.call(this)};
P.bezierCurveTo=function(a,b,c,d,x,y){if(CAP&&last){const[p,q]=last;for(let i=1;i<=10;i++){const t=i/10,u=1-t;add(this,u*u*u*p+3*u*u*t*a+3*u*t*t*c+t*t*t*x,u*u*u*q+3*u*u*t*b+3*u*t*t*d+t*t*t*y)}}return o.bezierCurveTo.call(this,a,b,c,d,x,y)};
P.quadraticCurveTo=function(a,b,x,y){if(CAP&&last){const[p,q]=last;for(let i=1;i<=8;i++){const t=i/8,u=1-t;add(this,u*u*p+2*u*t*a+t*t*x,u*u*q+2*u*t*b+t*t*y)}}return o.quadraticCurveTo.call(this,a,b,x,y)};
P.ellipse=function(x,y,rx,ry,rot,a0,a1,ccw){if(CAP){let d=a1-a0;if(ccw&&d>0)d-=2*Math.PI;if(!ccw&&d<0)d+=2*Math.PI;if(Math.abs(d)>2*Math.PI)d=2*Math.PI*Math.sign(d);const n=Math.max(6,Math.ceil(Math.abs(d)/(Math.PI/10)));if(Math.abs(d)>=2*Math.PI-1e-6){cur=[];subs.push(cur)}for(let i=0;i<=n;i++){const a=a0+d*i/n,ex=rx*Math.cos(a),ey=ry*Math.sin(a);add(this,x+ex*Math.cos(rot)-ey*Math.sin(rot),y+ex*Math.sin(rot)+ey*Math.cos(rot))}}return o.ellipse.call(this,x,y,rx,ry,rot,a0,a1,ccw)};
P.arc=function(x,y,r,a0,a1,ccw){if(CAP){let d=a1-a0;if(ccw&&d>0)d-=2*Math.PI;if(!ccw&&d<0)d+=2*Math.PI;if(Math.abs(d)>2*Math.PI)d=2*Math.PI*Math.sign(d);const n=Math.max(6,Math.ceil(Math.abs(d)/(Math.PI/10)));if(Math.abs(d)>=2*Math.PI-1e-6){cur=[];subs.push(cur)}for(let i=0;i<=n;i++){const a=a0+d*i/n;add(this,x+r*Math.cos(a),y+r*Math.sin(a))}}return o.arc.call(this,x,y,r,a0,a1,ccw)};
P.rect=function(x,y,w,h){if(CAP){cur=[];subs.push(cur);add(this,x,y);add(this,x+w,y);add(this,x+w,y+h);add(this,x,y+h);cur=null}return o.rect.call(this,x,y,w,h)};
const col=s=>typeof s==='string'?s:'grad';
P.fill=function(...a){if(CAP&&!(a[0] instanceof Path2D))for(const s of subs)if(s.length>2)CAP.push({k:'fill',c:col(this.fillStyle),a:this.globalAlpha,pts:s.map(q=>q.slice()),nm:window.NMX||null});return o.fill.apply(this,a)};
P.stroke=function(...a){if(CAP&&!(a[0] instanceof Path2D)){const m=this.getTransform(),sc=Math.sqrt(Math.abs(m.a*m.d-m.b*m.c));for(const s of subs)if(s.length>1)CAP.push({k:'stroke',c:col(this.strokeStyle),a:this.globalAlpha,w:this.lineWidth*sc,pts:s.map(q=>q.slice()),nm:window.NMX||null})}return o.stroke.apply(this,a)};
P.fillRect=function(x,y,w,h){if(CAP)CAP.push({k:'fill',c:col(this.fillStyle),a:this.globalAlpha,pts:[T(this,x,y),T(this,x+w,y),T(this,x+w,y+h),T(this,x,y+h)],nm:window.NMX||null});return o.fillRect.call(this,x,y,w,h)};
})()'''
A={'haha':"hp3({x:640,y:330,s:1.6,yaw:10,seed:2,v:{...hv(2),tn:-.5}},0,{full:1,fl:0})",
   'haha_kuchi':"hp3({x:640,y:330,s:1.6,yaw:10,seed:2,v:{...hv(2),tn:-.5}},0,{full:1,fl:0,jaw:.2})",
   'ko':"hp3({x:640,y:340,s:1.4,yaw:12,seed:33,v:{...hv(33),tn:1,L:.8}},0,{full:1,fl:0})",
   'acacia':"tree4(640,640,4.2,244,{acacia:1})",'shomen':"face3(640,400,1.15,0,{})",
   # 2026-11-26 足した素材（extra_art.js）
   'ashi':"reedClump(640,650,1,7)",'shibuki':"splash(640,440,1.35,5)",'hamon':"ripples(640,380,1.5,3,false)",'hamon_ue':"ripples(640,360,1.15,4,true)",
   'doro':"mudCloud(640,400,1.35,11)",'maruta':"logWood(640,380,1.55,9)",'zugaikotsu':"skullSide(600,330,2.6,{})",'zugaikotsu_hiraku':"skullSide(600,300,2.6,{open:1})"}
WANT=sys.argv[2:]   # 素材の id を並べると、それだけ記録する
async def run():
  async with async_playwright() as pw:
    b=await pw.chromium.launch(args=['--allow-file-access-from-files']);p=await b.new_page(viewport={'width':1280,'height':720});await p.add_init_script(REC)
    await p.goto('file://'+H);await p.add_script_tag(path=EXTRA);await p.evaluate('([s,d])=>setup(s,d)',[{'mode':'intro7'},29]);await p.evaluate('render(5)');out={}
    for k,js in A.items():
      if WANT and k not in WANT: continue
      r=await p.evaluate("(js)=>{g.setTransform(1,0,0,1,0,0);rect(0,0,W,H,'#e9e6dc');window.CAP=[];window.NMX=null;try{eval(js)}catch(e){return 'ERR '+e.message}const c=CAP;window.CAP=null;return c}",js)
      if isinstance(r,str): print(k,r);continue
      out[k]=r;print(k,len(r),sum(1 for x in r if x['k']=='fill'),set(x['c'] for x in r if x['c']=='grad' or x['a']<1) )
    json.dump(out,open(sys.argv[1] if len(sys.argv)>1 else '/tmp/cap/cap.json','w'));await b.close()
asyncio.run(run())
