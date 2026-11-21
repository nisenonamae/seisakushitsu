/* 半径が負になると描けずに止まるので、0 にそろえる（声の長さが変わって動きの時間がずれても落ちないように） */
(()=>{const A=CanvasRenderingContext2D.prototype.arc;CanvasRenderingContext2D.prototype.arc=function(x,y,r,...a){return A.call(this,x,y,Math.max(0,r||0),...a)};const E=CanvasRenderingContext2D.prototype.ellipse;CanvasRenderingContext2D.prototype.ellipse=function(x,y,rx,ry,...a){return E.call(this,x,y,Math.max(0,rx||0),Math.max(0,ry||0),...a)}})();
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
// 動くもの（車・車輪・重機）の画面上の四角を記録する。撮影側で「画面の中でいきなり現れる・消える」を見つけるため
function track(x0,y0,x1,y1){const m=g.getTransform();const pts=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(([x,y])=>[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]);const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);(window._trk=window._trk||[]).push([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys),g.globalAlpha])}
function tire(x,y,r,ang){g.save();g.translate(x,y);track(-r,-r,r,r);g.rotate(ang);g.fillStyle='#1b1d22';g.beginPath();g.arc(0,0,r,0,7);g.fill();for(let i=0;i<16;i++){g.save();g.rotate(i*Math.PI/8);g.fillStyle='#2c2f36';g.fillRect(-r*0.1,-r-2,r*0.2,r*0.16);g.restore()}const rg=g.createRadialGradient(-r*.15,-r*.15,2,0,0,r*.6);rg.addColorStop(0,'#eef1f5');rg.addColorStop(1,'#8f98a4');g.fillStyle=rg;g.beginPath();g.arc(0,0,r*.58,0,7);g.fill();g.strokeStyle='#5b6470';g.lineWidth=r*0.08;for(let i=0;i<5;i++){g.save();g.rotate(i*Math.PI*2/5);g.beginPath();g.moveTo(0,r*.12);g.lineTo(0,r*.52);g.stroke();g.restore()}g.fillStyle='#4b5563';g.beginPath();g.arc(0,0,r*.13,0,7);g.fill();g.restore()}
// 横から見た車（人が乗っている）。x,y＝車体の下の中央、bob＝車体の上下、heads＝頭の揺れ
function car(x,y,s=1,o={}){const bob=o.bob||0,col=o.col||'#d9534f',alpha=o.alpha==null?1:o.alpha;g.save();g.globalAlpha=alpha;g.translate(x,y+bob);g.scale(s,s);track(-175,-135,178,50);
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
function sfxOnce(key,t,kind,dur,rise){window._done=window._done||{};if(window._done[key])return;window._done[key]=1;window.SFX.push(dur?(rise!=null?[t,kind,dur,rise]:[t,kind,dur]):[t,kind])}
function arrowLine(x1,y1,x2,y2,col='#ffd36a',w=6){g.strokeStyle=col;g.fillStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();const a=Math.atan2(y2-y1,x2-x1);g.beginPath();g.moveTo(x2+Math.cos(a)*12,y2+Math.sin(a)*12);g.lineTo(x2-Math.cos(a-0.6)*18,y2-Math.sin(a-0.6)*18);g.lineTo(x2-Math.cos(a+0.6)*18,y2-Math.sin(a+0.6)*18);g.fill()}
// いつも何かが小さく動いているように（止まった画面を作らない。2026-11-21・餌の学びから）。場面の指定に amb:1 を付けたときだけ、各ページが呼ぶ
// 地図の上を、雲の影がゆっくり流れる
function cloudShadows(t,a=0.17,sp=50){const r=R(77);for(let i=0;i<5;i++){const y=60+r()*(H-120),sz=120+r()*110,x=((t*sp*(0.8+r()*0.5)+i*380+r()*300)%(W+700))-350;for(const[dx,dy,k] of [[0,0,1],[sz*0.7,sz*0.18,0.75],[-sz*0.6,sz*0.1,0.6]]){const gr=g.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,sz*k);gr.addColorStop(0,`rgba(40,48,70,${a})`);gr.addColorStop(0.6,`rgba(40,48,70,${a*0.75})`);gr.addColorStop(1,'rgba(40,48,70,0)');g.fillStyle=gr;g.beginPath();g.ellipse(x+dx,y+dy,sz*k,sz*k*0.62,0,0,7);g.fill()}}}
// 空を、雲がゆっくり流れる（y0〜y1 の高さ）
function skyClouds(t,y0=30,y1=220,n=4,sp=36){const r=R(31);for(let i=0;i<n;i++){const y=y0+r()*(y1-y0),sz=34+r()*30,x=((t*sp*(0.7+r()*0.6)+i*(W+400)/n+r()*200)%(W+400))-200;g.fillStyle='rgba(255,255,255,.88)';g.beginPath();for(const[dx,dy,k] of [[0,0,1],[sz*0.9,sz*0.12,0.78],[-sz*0.85,sz*0.16,0.7],[sz*0.2,-sz*0.42,0.72]]){g.moveTo(x+dx+sz*k,y+dy);g.arc(x+dx,y+dy,sz*k,0,7)}g.fill();g.fillStyle='rgba(255,255,255,.88)';g.fillRect(x-sz*1.5,y+sz*0.1,sz*3.1,sz*0.62)}}
// 鳥が何羽か、空を横切る
function birds(t,y=130,n=3,sp=70){const r=R(53);g.strokeStyle='rgba(50,55,70,.75)';g.lineWidth=2.5;g.lineCap='round';for(let i=0;i<n;i++){const x=((t*sp+i*46+r()*30)%(W+300))-150,yy=y+i*16*(i%2?1:-1)+6*Math.sin(t*1.7+i),fl=0.35+0.3*Math.sin(t*9+i*1.3),w=9;g.beginPath();g.moveTo(x-w,yy-w*fl);g.quadraticCurveTo(x-w*0.4,yy-w*fl*0.2,x,yy);g.quadraticCurveTo(x+w*0.4,yy-w*fl*0.2,x+w,yy-w*fl);g.stroke()}g.lineCap='butt'}
// 札：話題の色の札に白い字、ぼかさない影（紙を重ねたように）。k＝0→1 で、行きすぎて戻りながら少し傾いて出る。o.fall＝0→1 で、下へ落ちて出ていく（薄くして消さない）
function card(x,y,txt,k,o={}){if(k<=0||!txt)return;const size=o.size||54,col=o.col||'#1f6fb0',f=clamp(o.fall||0);g.save();g.translate(x+f*30,y+f*f*(H+200-y));g.rotate((1-ease(clamp(k)))*-0.14+f*0.5);const s=back(clamp(k),1.9);g.scale(s,s);g.font=`900 ${size}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';const w=g.measureText(txt).width+size*0.9,h=size*1.55;g.fillStyle='rgba(20,24,40,.32)';g.beginPath();g.roundRect(-w/2+7,-h/2+8,w,h,size*0.2);g.fill();g.fillStyle=col;g.beginPath();g.roundRect(-w/2,-h/2,w,h,size*0.2);g.fill();g.fillStyle='rgba(255,255,255,.14)';g.beginPath();g.roundRect(-w/2,-h/2,w,h*0.46,size*0.2);g.fill();g.fillStyle='#fff';g.fillText(txt,0,3);g.restore()}
// 奥行き：ぼかし（手前の物・奥の物に）。書き出しの大きさに合わせる
function blurOn(px){const m=g.getTransform();g.filter=`blur(${(px*Math.hypot(m.a,m.b)).toFixed(1)}px)`}
function blurOff(){g.filter='none'}
// 手前の草（画面の下の両すみ。大きく・ぼかして・ゆれる）
function fgGrass(t,col='#5d7a3c',col2='#7d9a4e'){blurOn(7);for(const[bx,dir,n] of [[40,1,9],[W-50,-1,8]]){for(let i=0;i<n;i++){const x=bx+dir*i*34-dir*60,hh=170+((i*53)%90),sw=Math.sin(t*1.5+i*0.9)*16+dir*30;g.strokeStyle=i%2?col:col2;g.lineWidth=20-(i%3)*4;g.lineCap='round';g.beginPath();g.moveTo(x,H+30);g.quadraticCurveTo(x+sw*0.3,H-hh*0.5,x+sw,H-hh);g.stroke()}}g.lineCap='butt';blurOff()}
// 手前のヤシの葉（画面の上のすみから下がる。大きく・ぼかして・ゆれる）
function fgFrond(t,x=W-120,col='#3f6f3d'){blurOn(8);g.strokeStyle=col;g.lineCap='round';for(let i=0;i<6;i++){const a=Math.PI*0.55+i*0.2+Math.sin(t*1.3+i)*0.05,len=330+(i%2)*60;const ex=x+Math.cos(a)*len,ey=-40+Math.sin(a)*len;g.lineWidth=26;g.beginPath();g.moveTo(x+80,-60);g.quadraticCurveTo(x+Math.cos(a)*len*0.5+40,-60+Math.sin(a)*len*0.35,ex,ey);g.stroke()}g.lineCap='butt';blurOff()}
// 話題ごとの色：場面の指定に tint:{col,a,mode} を付けると、描いたあとに色を重ねる（mode は soft-light が基本）
function tintOver(){const q=P.tint;if(!q)return;g.save();g.globalCompositeOperation=q.mode||'soft-light';g.globalAlpha=q.a==null?0.4:q.a;g.fillStyle=q.col||'#5b4a8a';g.fillRect(0,0,W,H);g.restore()}
// 段（2026-11-21）：場面を「大きな形 → 部品 → 細部 → 動き（大）→ 動き（小）→ 仕上げ」の段に分けて作る。指定に "stage":N を足すと、N 段めまでで止めて描く（無ければ全部）。
//   場面の中では stg(n) で「n 段めを描いてよいか」を聞く。後ろの段は、前の段の形を作り替えない（足すだけ）。くわしくは docs/notes/composition.md「段を分けて作る」
const STAGES=['0 設計','1 大きな形','2 部品','3 細部','4 動き（大）','5 動き（小）','6 仕上げ'];let STG=99;const stg=n=>STG>=n;
window.setup=(p,d)=>{P=Object.assign({},window.DEF||{},p);DUR=d;STG=P.stage==null?99:P.stage;window.SFX=[];window._done={};if(window.init)init();if(!window._tw&&window.render){const r0=window.render;window.render=t=>{r0(t);tintOver();if(P.guide&&window.compGuide){g.setTransform(1,0,0,1,0,0);compGuide(P.guide)}};window._tw=1}};
// 画像を読み込む（読み終わるまで撮影を待つ）
const IMG={};function loadImg(key,src){window.READY=false;const im=new Image();im.onload=()=>{IMG[key]=im;window._pend--;if(!window._pend)window.READY=true};window._pend=(window._pend||0)+1;im.src=src.startsWith('/')?'file://'+src:src}

// 点で輪郭を描く（図形にしない）：pts＝[x,y,丸み(0＝角〜1＝なめらか)] を時計回りに。dx,dy＝ずらす量（ずらした形で明るい面・暗い面を作る）
// 遠近（見上げる・見下ろす）：PERSP＝{x,y,g} を入れると、blob・pline・ptaper で描く点が、消える点 (x,y) へ向かって寄る（g＝地面の高さ。そこより下は動かさない）。
// 縦の線が上の一点へ集まるので、見上げた絵になる。使い終わったら PERSP=null に戻す
let PERSP=null;const pk=y=>(!PERSP||y>=PERSP.g)?1:(y-PERSP.y)/(PERSP.g-PERSP.y),pw=(x,y)=>{if(!PERSP||y>=PERSP.g)return[x,y];const k=pk(y);return[PERSP.x+(x-PERSP.x)*k,y]};
function blob(pts,dx=0,dy=0){if(PERSP){pts=pts.map(p=>{const q=pw(p[0]+dx,p[1]+dy);return[q[0],q[1],p[2]]});dx=dy=0}const n=pts.length,L=(a,b,u)=>[a[0]+(b[0]-a[0])*u+dx,a[1]+(b[1]-a[1])*u+dy];for(let i=0;i<n;i++){const p=pts[i],a=pts[(i+n-1)%n],b=pts[(i+1)%n],r=p[2]==null?0.5:p[2];const A=L(p,[(a[0]+p[0])/2,(a[1]+p[1])/2],r),B=L(p,[(b[0]+p[0])/2,(b[1]+p[1])/2],r);i?g.lineTo(A[0],A[1]):g.moveTo(A[0],A[1]);g.quadraticCurveTo(p[0]+dx,p[1]+dy,B[0],B[1])}g.closePath()}
