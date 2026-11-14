/* 場面を描く共通の道具。効果音の種類：pop・whoosh・thump・tick・puff・boing（ぽよよん）・長さのある rattle・engine・motor・car（走り去る車の音）
   各ページは setup(params,dur) と render(t) を持つ。
   効果音は SFX.push([秒,'pop'|'whoosh'|'thump'|'tick'|'puff']) か、長さのある音 [秒,'rattle'|'engine'|'motor',長さ] */
const W=1280,H=720,cv=document.getElementById('c'),g=cv.getContext('2d');
let P={},DUR=5;window.SFX=[];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),ease=t=>{t=clamp(t);return t*t*(3-2*t)},eout=t=>{t=clamp(t);return 1-Math.pow(1-t,3)},back=(t,s=1.5)=>{t=clamp(t)-1;return 1+(s+1)*t*t*t+s*t*t};
const lerp=(a,b,u)=>a+(b-a)*u;
function R(seed){let s=(seed*7919+12345)%2147483647||1;const f=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646};f();f();f();return f}
const FONT='"Noto Sans CJK JP"';
function T(i,def){return (P.times&&P.times[i]!=null)?P.times[i]:def}   // ats の時刻（i=1 が一つ目の言葉）
function label(x,y,text,k,col='#fff',size=40){if(k<=0||!text)return;g.save();g.globalAlpha=clamp(k);g.font=`900 ${Math.round(size*back(k))}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';const w=g.measureText(text).width;g.fillStyle='rgba(10,14,20,.82)';g.beginPath();g.roundRect(x-w/2-20,y-size*0.8,w+40,size*1.6,14);g.fill();g.fillStyle=col;g.fillText(text,x,y+2);g.restore()}
function sky(top='#8fbde6',bot='#f1dcb5'){const s=g.createLinearGradient(0,0,0,H);s.addColorStop(0,top);s.addColorStop(1,bot);g.fillStyle=s;g.fillRect(0,0,W,H)}
function hills(off,cols=[['#c5b39b',430,40,0.15],['#ad946f',465,30,0.35]]){for(const [col,yy,amp,par] of cols){g.fillStyle=col;g.beginPath();g.moveTo(0,H);for(let x=0;x<=W;x+=16){const wx=x+off*par;g.lineTo(x,yy-amp*(0.5+0.5*Math.sin(wx/170))*(0.6+0.4*Math.sin(wx/57)))}g.lineTo(W,H);g.fill()}}
let _tex=null;function sandPat(base='#c9a46a'){if(_tex&&_tex.b===base)return _tex.p;const c=document.createElement('canvas');c.width=c.height=256;const t=c.getContext('2d');t.fillStyle=base;t.fillRect(0,0,256,256);const r=R(9);for(let i=0;i<2600;i++){const l=r();t.fillStyle=`rgba(${l<.5?110:245},${l<.5?80:220},${l<.5?50:170},${0.25+r()*0.4})`;t.beginPath();t.arc(r()*256,r()*256,0.5+r()*1.8,0,7);t.fill()}_tex={b:base,p:g.createPattern(c,'repeat')};return _tex.p}
// 地面：top(x) が地面の高さ（画面の座標）
function ground(top,x0=-20,x1=W+20,base='#c9a46a',bottom=H){g.beginPath();g.moveTo(x0,bottom);for(let x=x0;x<=x1;x+=4)g.lineTo(x,top(x));g.lineTo(x1,bottom);g.closePath();g.fillStyle=sandPat(base);g.fill();const gr=g.createLinearGradient(0,400,0,H);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(40,25,10,.35)');g.fillStyle=gr;g.fill();g.strokeStyle='rgba(255,236,200,.85)';g.lineWidth=3;g.beginPath();for(let x=x0;x<=x1;x+=4){x===x0?g.moveTo(x,top(x)):g.lineTo(x,top(x))}g.stroke()}
function tire(x,y,r,ang){g.save();g.translate(x,y);g.rotate(ang);g.fillStyle='#1b1d22';g.beginPath();g.arc(0,0,r,0,7);g.fill();for(let i=0;i<16;i++){g.save();g.rotate(i*Math.PI/8);g.fillStyle='#2c2f36';g.fillRect(-r*0.1,-r-2,r*0.2,r*0.16);g.restore()}const rg=g.createRadialGradient(-r*.15,-r*.15,2,0,0,r*.6);rg.addColorStop(0,'#eef1f5');rg.addColorStop(1,'#8f98a4');g.fillStyle=rg;g.beginPath();g.arc(0,0,r*.58,0,7);g.fill();g.strokeStyle='#5b6470';g.lineWidth=r*0.08;for(let i=0;i<5;i++){g.save();g.rotate(i*Math.PI*2/5);g.beginPath();g.moveTo(0,r*.12);g.lineTo(0,r*.52);g.stroke();g.restore()}g.fillStyle='#4b5563';g.beginPath();g.arc(0,0,r*.13,0,7);g.fill();g.restore()}
// 横から見た車（人が乗っている）。x,y＝車体の下の中央、bob＝車体の上下、heads＝頭の揺れ
function car(x,y,s=1,o={}){const bob=o.bob||0,col=o.col||'#d9534f',alpha=o.alpha==null?1:o.alpha;g.save();g.globalAlpha=alpha;g.translate(x,y+bob);g.scale(s,s);
  g.fillStyle='rgba(30,20,10,.25)';g.beginPath();g.ellipse(0,(o.shadowY||0)-bob/s+48,170,14,0,0,7);g.fill();
  // 車体
  g.fillStyle=col;g.beginPath();g.moveTo(-170,-10);g.lineTo(-165,-62);g.quadraticCurveTo(-150,-72,-110,-74);g.lineTo(-70,-122);g.quadraticCurveTo(-60,-130,-40,-130);g.lineTo(60,-130);g.quadraticCurveTo(78,-130,90,-118);g.lineTo(125,-76);g.quadraticCurveTo(165,-72,172,-50);g.lineTo(175,-10);g.closePath();g.fill();
  g.fillStyle='rgba(255,255,255,.12)';g.fillRect(-160,-60,330,8);
  // 窓と人
  const win=()=>{g.beginPath();g.moveTo(-58,-118);g.lineTo(-5,-118);g.lineTo(-5,-78);g.lineTo(-92,-78);g.closePath();g.moveTo(5,-118);g.lineTo(58,-118);g.quadraticCurveTo(70,-118,78,-110);g.lineTo(108,-78);g.lineTo(5,-78);g.closePath()};
  g.fillStyle='#bfe0f2';win();g.fill();
  // 人は窓の中だけに描く（揺れても窓からはみ出さない）
  g.save();win();g.clip();const hd=Math.min(5,o.heads||0);for(const [hx,ph] of [[-40,0],[48,1.7]]){const dy=hd*Math.sin(ph+(o.t||0)*31);g.fillStyle='#2e3440';g.beginPath();g.arc(hx,-96+dy,14,0,7);g.fill();g.beginPath();g.roundRect(hx-18,-82+dy,36,20,8);g.fill()}g.restore();
  g.fillStyle='rgba(255,255,255,.25)';g.beginPath();g.moveTo(-50,-116);g.lineTo(-30,-116);g.lineTo(-60,-80);g.lineTo(-80,-80);g.closePath();g.fill();
  g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=2;g.beginPath();g.moveTo(0,-125);g.lineTo(0,-12);g.moveTo(-100,-70);g.lineTo(-100,-12);g.stroke();g.fillStyle='rgba(0,0,0,.35)';g.fillRect(-30,-62,18,4);g.fillRect(40,-62,18,4)
  if(o.driverArms){g.strokeStyle='#2e3440';g.lineWidth=6;g.beginPath();g.moveTo(48,-84);g.lineTo(72,-88);g.stroke();g.strokeStyle='#111';g.lineWidth=5;g.beginPath();g.moveTo(74,-98);g.lineTo(70,-78);g.stroke()}
  g.fillStyle='#ffe28a';g.beginPath();g.ellipse(170,-42,6,9,0,0,7);g.fill();g.fillStyle='#b23';g.fillRect(-172,-48,6,14);
  g.restore();
  const wr=o.wheelR||34*s;const wa=o.wheelAng||0;const lift=o.wheelLift||[0,0];
  if(!o.noWheels){tire(x-110*s,y+bob*0.15-lift[0],wr,wa);tire(x+112*s,y+bob*0.15-lift[1],wr,wa)}
}
// 本物の車のような速度計。v＝今の速さ, vmax, mark（赤い線を引く値・なしなら null）, hide＝数字を「？」に
function speedo(cx,cy,R,v,o={}){const vmax=o.vmax||60,mark=o.mark;g.save();
  const rim=g.createRadialGradient(cx,cy,R*0.8,cx,cy,R*1.08);rim.addColorStop(0,'#2b2f36');rim.addColorStop(0.6,'#cfd4da');rim.addColorStop(1,'#6b7280');g.fillStyle=rim;g.beginPath();g.arc(cx,cy,R*1.08,0,7);g.fill();
  const face=g.createRadialGradient(cx,cy-R*0.3,R*0.1,cx,cy,R);face.addColorStop(0,'#1c2430');face.addColorStop(1,'#07090d');g.fillStyle=face;g.beginPath();g.arc(cx,cy,R,0,7);g.fill();
  const a0=Math.PI*0.75,a1=Math.PI*2.25,ang=v=>a0+(a1-a0)*clamp(v/vmax);
  if(mark!=null){g.strokeStyle='rgba(230,60,50,.9)';g.lineWidth=R*0.06;g.beginPath();g.arc(cx,cy,R*0.86,ang(mark),a1);g.stroke()}
  const step=o.step||10;for(let k=0;k<=vmax;k+=step/5){const a=ang(k),maj=Math.abs(k/step-Math.round(k/step))<1e-6;g.strokeStyle=maj?'#f2f4f7':'#8a94a3';g.lineWidth=maj?R*0.025:R*0.012;g.beginPath();g.moveTo(cx+Math.cos(a)*R*(maj?0.74:0.8),cy+Math.sin(a)*R*(maj?0.74:0.8));g.lineTo(cx+Math.cos(a)*R*0.9,cy+Math.sin(a)*R*0.9);g.stroke();
    if(maj&&!o.plain){g.fillStyle='#e8ecf1';g.font=`700 ${Math.round(R*0.13)}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';g.fillText(String(k),cx+Math.cos(a)*R*0.6,cy+Math.sin(a)*R*0.6)}}
  g.fillStyle='#9aa3ae';g.font=`700 ${Math.round(R*(o.plain?0.16:0.1))}px ${FONT}`;g.textAlign='center';g.fillText(o.plain?'速さ':'km/h',cx,cy+R*0.32);
  const a=ang(v);g.shadowColor='rgba(255,80,40,.8)';g.shadowBlur=R*0.08;g.strokeStyle='#ff5a36';g.lineWidth=R*0.035;g.lineCap='round';g.beginPath();g.moveTo(cx-Math.cos(a)*R*0.12,cy-Math.sin(a)*R*0.12);g.lineTo(cx+Math.cos(a)*R*0.84,cy+Math.sin(a)*R*0.84);g.stroke();g.shadowBlur=0;
  g.fillStyle='#d1d5db';g.beginPath();g.arc(cx,cy,R*0.07,0,7);g.fill();
  if(o.plain){g.restore();return}
  g.fillStyle='#0b0f14';g.beginPath();g.roundRect(cx-R*0.32,cy+R*0.45,R*0.64,R*0.26,R*0.05);g.fill();g.fillStyle='#7dd3fc';g.font=`800 ${Math.round(R*0.18)}px ${FONT}`;g.fillText(o.scramble!=null?String(10+Math.floor(Math.abs(Math.sin(o.scramble*37.1)*89))):String(Math.round(v)),cx,cy+R*0.585);if(o.scramble!=null&&Math.floor(o.scramble*12)%1===0){}
  g.restore()}
function shake(t,amp){return [amp*(Math.sin(t*71)+0.6*Math.sin(t*113)),amp*(Math.sin(t*89+1)+0.5*Math.sin(t*131))]}
function sfxOnce(key,t,kind,dur){window._done=window._done||{};if(window._done[key])return;window._done[key]=1;window.SFX.push(dur?[t,kind,dur]:[t,kind])}
function arrowLine(x1,y1,x2,y2,col='#ffd36a',w=6){g.strokeStyle=col;g.fillStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();const a=Math.atan2(y2-y1,x2-x1);g.beginPath();g.moveTo(x2+Math.cos(a)*12,y2+Math.sin(a)*12);g.lineTo(x2-Math.cos(a-0.6)*18,y2-Math.sin(a-0.6)*18);g.lineTo(x2-Math.cos(a+0.6)*18,y2-Math.sin(a+0.6)*18);g.fill()}
window.setup=(p,d)=>{P=Object.assign({},window.DEF||{},p);DUR=d;window.SFX=[];window._done={};if(window.init)init()};
// 画像を読み込む（読み終わるまで撮影を待つ）
const IMG={};function loadImg(key,src){window.READY=false;const im=new Image();im.onload=()=>{IMG[key]=im;window._pend--;if(!window._pend)window.READY=true};window._pend=(window._pend||0)+1;im.src=src.startsWith('/')?'file://'+src:src}
