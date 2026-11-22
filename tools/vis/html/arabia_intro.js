/* 緑のアラビア：序（3版・2026-11-22）。mode＝intro3
   実際のカバの映像（ルアングワ川の群れ・南アの川）と文献を見て作り直した版。決めたこと：
   ・水は澄んでいない。カバのいる浅い所は、ふんと泥でにごった緑がかった茶色。沖は空を映して青い。体は水の下が見えない
   ・カバは昼は水の中でほとんど動かない。動くのは耳（くるくる回して水をとばす）・まばたき・ゆっくりした浮き沈み・息つぎ
   ・群れは背中が岩のように並ぶ。1頭ずつ大きさ・背の高さ・色・傷・浮き方を変える（同じ絵を並べない）
   ・岸は、踏まれてはだかの泥。水の近くは食べられて短い草（芝）、離れると背の高い草。草の中に、カバの通り道がある
   ・あくびは力を見せるしぐさ。横から見ると口は V 字に開き、あいだは向こうが見える（口の中を1枚の板でうめない） */
const IC={sky0:'#9fcfe0',sky1:'#dcebe6',hill:'#8aa79a',tree:'#4f7a52',lawn:'#9cc36a',mud:'#a58c62',mudD:'#84704c',
 wFar:'#8ab6c0',wMid:'#7c9f88',wNear:'#7d875a',wDark:'#666e49',hb:'#7c6c68',hd:'#584b4a',hl:'#a59791',hp:'#c29384',he:'#1b1516'};
const hx=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const mix=(a,b,u)=>{const A=hx(a),B=hx(b);return '#'+A.map((x,i)=>Math.round(lerp(x,B[i],clamp(u))).toString(16).padStart(2,'0')).join('')};
function poly(pts,col){g.fillStyle=col;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill()}
function blade(x,yb,h,w,lean,col){g.fillStyle=col;g.beginPath();g.moveTo(x-w/2,yb);g.quadraticCurveTo(x-w*.2+lean*.4,yb-h*.6,x+lean,yb-h);g.quadraticCurveTo(x+w*.4+lean*.4,yb-h*.5,x+w/2,yb);g.closePath();g.fill()}
function star(x,y,r,a=1){g.save();g.globalAlpha=clamp(a);const gr=g.createRadialGradient(x,y,0,x,y,r*2.6);gr.addColorStop(0,'rgba(255,250,225,.9)');gr.addColorStop(1,'rgba(255,250,225,0)');g.fillStyle=gr;g.fillRect(x-r*3,y-r*3,r*6,r*6);
 poly([[x-r*2.2,y],[x,y-r*.22],[x+r*2.2,y],[x,y+r*.22]],'#fffdf0');poly([[x-r*.2,y],[x,y-r*1.5],[x+r*.2,y],[x,y+r*1.5]],'#fffdf0');g.restore()}
// 木（1本ずつ形を変える）
function tree3(x,y,s,seed,col=IC.tree,trunk='#5a4634'){const r=R(seed),ty=r(),w=(46+r()*64)*s,h=(ty<.3?14+r()*16:36+r()*62)*s,lean=(r()-.5)*26*s,flat=ty>.62;
 poly([[x-3*s,y],[x-2*s+lean,y-h],[x+3*s+lean,y-h],[x+4*s,y]],trunk);if(r()>.5)line([[x+lean*.6,y-h*.6],[x+lean+w*.3,y-h*1.02]],trunk,2.5*s);
 if(flat)fill([[x+lean-w,y-h+2*s,.9],[x+lean-w*.5,y-h-16*s,.9],[x+lean+w*.4,y-h-20*s,.9],[x+lean+w,y-h-2*s,.9],[x+lean,y-h+8*s,.7]],col);
 else{ell(x+lean-w*.3,y-h-6*s,w*.5,15*s,col);ell(x+lean+w*.3,y-h-12*s,w*.45,17*s,col);ell(x+lean,y-h-20*s,w*.4,14*s,mix(col,'#7fa862',.3))}}

// ─── A：草むら。カバの通り道にそって、背の高い草の中を湖へ進む。湖はまだ光だけ ───
function grass3(t){const F=300,y0=300,cx=640,ZL=22;
 const c=1.45*t+(t>4.4?7*(t-4.4)*(t-4.4):0),hc=.78+.025*Math.sin(t*5.2);
 const Xc=z=>.55*Math.sin(z*.3+1)+.18*Math.sin(z*.8);
 const camX=Xc(c)+.04*Math.sin(t*2.6),pan=-F*(Xc(c+4)-camX)/4;
 const P=(X,h,z)=>{const d=Math.max(z-c,.05);return[cx+pan+F*(X-camX)/d,y0+F*(hc-h)/d]};
 const sp=P(Xc(ZL+2),0,ZL+3.5),Z=1+7*Math.pow(ease(tw(t,4.55,1.0)),2);
 g.save();g.translate(sp[0],sp[1]);g.scale(Z,Z);g.translate(-sp[0],-sp[1]);
 rect(-3000,-3000,7000,3000+y0,IC.sky0);skyG(IC.sky0,IC.sky1,y0);sun(1030+pan*.2,96,30);for(const [x,y,sc,v] of [[260,110,1,7],[640,70,.6,11],[1120,180,.75,5]])cloud(x+t*v+pan*.3,y,sc);
 fill([[-600+pan*.5,y0+2,.4],[100+pan*.5,264,.8],[520+pan*.5,286,.8],[820+pan*.5,250,.6],[1200+pan*.5,262,.6],[1900+pan*.5,y0+2,.4]],IC.hill);
 {const gr=g.createLinearGradient(0,y0,0,H);gr.addColorStop(0,'#b9d07f');gr.addColorStop(.25,'#8fb765');gr.addColorStop(1,'#5d8f4a');g.fillStyle=gr;g.fillRect(-3000,y0,7000,3000)}
 // 湖（細い帯）と向こう岸、手前の芝と泥
 const yl1=P(0,0,ZL)[1],yl2=P(0,0,ZL+16)[1],ylw=P(0,0,ZL-5)[1],ym=P(0,0,ZL-.7)[1];
 {const r=R(41);for(let i=0;i<11;i++)tree3(-500+i*230+r()*120+pan*.8,yl2-1,.34+r()*.2,60+i)}
 rect(-3000,yl2-3,7000,4,'#b99b6c');rect(-3000,yl2,7000,yl1-yl2,IC.wFar);rect(-3000,yl1,7000,ylw-yl1,IC.lawn);rect(-3000,yl1,7000,ym-yl1,IC.mud);
 for(let i=0;i<9;i++){const k=(Math.sin(t*3+i*2.1)+1)/2;rect(sp[0]-90+i*22+Math.sin(i*5)*8,lerp(yl2,yl1,.3+.5*((i*37)%10)/10),10+k*8,1.2,`rgba(255,252,230,${.3+.5*k})`)}
 // 通り道（踏まれた土）
 {const ds=[.22,.4,.6,.9,1.3,1.8,2.5,3.5,5,7,10,14,ZL-.7-c].filter(d=>d<=ZL-.7-c+.001),L=[],Rr=[];for(const d of ds){const z=c+d;const pw=.36+.08*Math.sin(z*1.7);L.push(P(Xc(z)-pw-.05*Math.sin(z*2.9),0,z));Rr.push(P(Xc(z)+pw+.06*Math.sin(z*2.3+1),0,z))}
  poly([[L[0][0]-200,H+900],...L,...Rr.reverse(),[Rr[Rr.length-1][0]+200,H+900]],'#a58c62');
  for(let k=Math.ceil(c/.55);k<c/.55+16;k++){const z=k*.55,d=z-c;if(d<.3)continue;const q=P(Xc(z)+(k%2?.17:-.17),0,z);ell(q[0],q[1],30/d,9/d,'#8c7650')}}
 // 草の列（奥 → 手前）。奥は帯、近くは1本ずつ。カメラが進むと大きくなって、ぼけて、外へたおれて横を抜ける
 for(let i=62;i>=0;i--){const z=.5+i*.28,d=z-c;if(d<.12||z>ZL-.9)continue;const rr=R(300+i),lawn=z>ZL-5,hg=lawn?.1+rr()*.08:1.12+rr()*.4,gap=lawn?-9:.34+.16*rr(),seedy=i%5===2&&!lawn;
  let col=mix(mix('#5d9650','#b3cc80',clamp(d/13)),'#21483a',clamp(1.25-d)*.75);col=mix(col,'#c9c070',.16*rr());if(lawn)col=mix(IC.lawn,'#7fae58',rr()*.6);
  g.save();g.globalAlpha=clamp((d-.12)/.14);if(d<1.15)blurOn((1.15-d)*15);
  for(const sg of [-1,1]){const X0=Xc(z)+sg*gap;
   if(d>2.6||lawn){const n=lawn?40:24,span=lawn?18:8,pts=[P(X0,0,z)];for(let j=0;j<n;j++){const X=X0+sg*span*(j+rr()*.6)/n,h=hg*(.62+.5*rr()),sw=Math.sin(t*1.4+z*2+j)*.035;pts.push(P(X+sw,h,z));pts.push(P(X+sg*span/n*.55,h*(.25+.3*rr()),z))}
    pts.push(P(X0+sg*span,0,z));pts.push([pts[pts.length-1][0],pts[pts.length-1][1]+60/d+4]);pts.push([pts[0][0],pts[0][1]+60/d+4]);poly(pts,col);if(lawn&&sg<0)continue}
   else for(let j=0;j<22;j++){const X=X0+sg*(j*.27+rr()*.2),h=hg*(.6+.55*rr()),b=P(X,0,z),hp=F*h/d,w=F*(.05+.06*rr())/d,in0=j<3?-sg*.22:0,lean=(Math.sin(t*1.4+i+j*1.7)*.05+(rr()-.5)*.25+in0+sg*clamp(1.3-d)*.5)*hp;
     blade(b[0],b[1]+8/d,hp,w,lean,j%3?col:mix(col,'#86b060',.35))}
   if(seedy)for(let j=0;j<5;j++){const X=X0+sg*(.2+j*.8+rr()*.6),h=hg*1.28,b=P(X,0,z),tp=P(X+Math.sin(t*1.2+j+i)*.06+(rr()-.5)*.2,h,z),pw=Math.max(1,5/d);g.strokeStyle=mix(col,'#cdbb80',.5);g.lineWidth=pw*.5;g.beginPath();g.moveTo(b[0],b[1]);g.lineTo(tp[0],tp[1]);g.stroke();
     g.save();g.translate(tp[0],tp[1]);g.rotate(sg*.3+Math.sin(t*1.2+j)*.15);ell(0,-F*.09/d,pw*1.2,F*.11/d,'#dccb92');g.restore()}}
  g.restore();g.filter='none'}
 // ただよう綿毛・小さな虫
 {const r=R(77);for(let i=0;i<14;i++){const z=c+.6+((r()*9+i*.7-c*.2)%9+9)%9,X=(r()-.5)*3+Xc(z),q=P(X+Math.sin(t*.8+i)*.1,.5+r()*.8+Math.sin(t*1.3+i*2)*.06,z),d=z-c;g.save();g.globalAlpha=.75;ell(q[0],q[1],3.2/d+.6,3.2/d+.6,'#fffbe0');g.restore()}}
 // 湖の光
 {const k=.3+.7*Math.max(pulse(t,1.5,.55),pulse(t,2.8,.5),pulse(t,3.7,.45))+ease(tw(t,4.1,.7))*1.6;star(sp[0],sp[1],(5+9*k)/Math.pow(Z,.55),.35+k)}
 g.restore();
 {const k=ease(tw(t,4.75,.8));if(k>0){const r=60+1900*k,gr=g.createRadialGradient(sp[0],sp[1],0,sp[0],sp[1],r);gr.addColorStop(0,'rgba(255,253,240,1)');gr.addColorStop(.45,`rgba(255,253,240,${.6+.4*k})`);gr.addColorStop(1,'rgba(255,253,240,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);
  g.save();g.globalAlpha=tw(t,5.2,.3);rect(0,0,W,H,'#fffdf0');g.restore()}}}

// ─── カバ（横から・水の中）。1頭ずつ形がちがう ───
function hv(seed){const r=R(seed);return{L:.86+.3*r(),hu:.82+.42*r(),tn:r()*2-1,ear:.85+.45*r(),head:.92+.18*r(),scar:Math.floor(r()*4),sx:r(),fl0:r(),ft:[r()*5,5+r()*5,10+r()*5,15+r()*5,20+r()*5,25+r()*4],bt:[r()*4,4+r()*4,9+r()*4,14+r()*4,19+r()*4,24+r()*4]}}
const flickU=(t,ts)=>{for(const t0 of ts){const u=(t-t0)/.75;if(u>0&&u<1)return u}return -1};
const yawnK=(tl,t0,dur=3)=>{const u=(tl-t0)/dur;if(u<=.1||u>=.92)return 0;if(u<.36)return eout((u-.1)/.26);if(u<.62)return 1+Math.sin((u-.36)*70)*.02;return 1-ease((u-.62)/.3)};
function hpS(h,t,o={}){const v=h.v||(h.v=hv(h.seed)),s=h.s,jaw=o.jaw||0,tilt=(o.tilt||0)-.34*jaw,fl=(o.fl==null?30:o.fl)-34*jaw,hz=o.hz||0;
 let cb=mix(IC.hb,v.tn>0?'#93706a':'#615a5a',Math.abs(v.tn)*.6),cd=mix(cb,'#2e2626',.42),cl=mix(cb,'#cdbfb6',.42),cp=mix(IC.hp,cb,.15);
 if(hz){cb=mix(cb,'#93a79c',hz);cd=mix(cd,'#93a79c',hz);cl=mix(cl,'#a9bbb0',hz);cp=mix(cp,'#93a79c',hz)}
 const L=v.L,hu=v.hu,fu=flickU(t+h.seed,v.ft),ear=fu<0?0:Math.sin(fu*34)*(1-fu)*1.0,blink=Math.max(...v.bt.map(b=>pulse(t+h.seed*.37,b,.2)))>.5?1:0;
 g.save();g.translate(h.x,h.y);g.scale(s*h.dir,s);
 // 水のにごり・映りこみ・輪
 g.save();g.globalAlpha=.34;ell(-80*L,10,210*L,12,'#b9a876');g.globalAlpha=.3;if(fl<84*hu)ell(-85*L,11,170*L,9,'#3f4530');if(fl<84)ell(185,9,100,8,'#3f4530');g.restore();
 for(let i=0;i<2;i++){const k=((t*.3+i/2+v.sx)%1);g.save();g.globalAlpha=(1-k)*.55*(fl>100?.5:1);g.strokeStyle='#e9eed8';g.lineWidth=Math.min(6,2.2/s);g.beginPath();g.ellipse(20,3,(150+k*230),(5+k*16),0,0,7);g.stroke();g.restore()}
 if(fl<118){g.save();g.beginPath();g.rect(-900,-1200,1800,1200);g.clip();g.translate(0,fl);
  // 胴（背中）
  fill([[-250*L,30,.7],[-236*L,-48*hu,.9],[-150*L,-84*hu,.9],[-40*L,-82*hu,.9],[42,-62*hu,.8],[86,-34,.6],[92,40,.5]],cb);
  fill([[-218*L,-50*hu,.9],[-150*L,-78*hu,.9],[-40*L,-76*hu,.9],[30,-58*hu,.8],[-40*L,-63*hu,.8],[-150*L,-64*hu,.8]],cl);
  line([[50,-54*hu],[40,-6]],cd,4);line([[-232*L,-30*hu],[-246*L,-6]],cd,3);
  for(let i=0;i<v.scar;i++){const x=(-200+i*70+v.sx*40)*L;line([[x,-56*hu-i*3],[x+26,-44*hu-i*2]],cl,2.5)}
  if(h.bird)bird3(-120*L,-84*hu,1/Math.max(s,.4)*.5,t+h.seed);
  // 頭
  g.save();g.translate(72,-28);g.rotate(tilt);g.scale(v.head,v.head);g.translate(-72,28);
  const Hg=[128,-8],a1=jaw*.55,a2=jaw*1.12,U=p=>rot([lerp(128,278,p),-6],Hg,-a1),Lw=p=>rot([lerp(128,278,p),-6],Hg,a2);
  if(jaw>.04){const bis=(a2-a1)/2,M=[Hg[0]+Math.cos(bis)*46,Hg[1]+Math.sin(bis)*46];   // 口の奥（ちょうつがいの近くだけ。先のほうは向こうが見える）
   const u5=U(.56),l5=Lw(.56);fill([[Hg[0]-8,Hg[1],.3],[u5[0],u5[1],.3],[M[0],M[1],.95],[l5[0],l5[1],.3]],'#8a3b47')}
  g.save();g.translate(Hg[0],Hg[1]);g.rotate(a2);g.translate(-Hg[0],-Hg[1]);                // 下あご
  fill([[98,-8,.6],[140,-14,.5],[184,-6,.5],[232,-4,.6],[276,-8,.8],[285,6,.8],[268,30,.8],[200,40,.7],[130,34,.7],[94,16,.7]],cb);fill([[130,30,.7],[200,36,.7],[262,26,.8],[250,12,.7],[150,14,.7]],cp);
  if(jaw>.12){g.save();g.globalAlpha=clamp((jaw-.12)*5);fill([[142,-9,.5],[262,-6,.6],[256,-20,.8],[190,-26,.9],[150,-18,.8]],'#dc9a9c');     // 舌
   fill([[244,-6,.3],[240,-40,.7],[250,-58,.5],[262,-8,.3]],'#f4ecd8');fill([[270,-6,.3],[292,-24,.5],[284,-2,.3]],'#f4ecd8');fill([[214,-6,.3],[217,-20,.5],[224,-6,.3]],'#f4ecd8');g.restore()}
  g.restore();
  g.save();g.translate(Hg[0],Hg[1]);g.rotate(-a1);g.translate(-Hg[0],-Hg[1]);               // 上の頭
  for(const [ex,ey,rx,ry,k,pk] of [[122,-80,7,11,.8,0],[104,-76,9,14,1,1]]){g.save();g.translate(ex,ey);g.rotate(-.25+ear*k);ell(0,-9*v.ear,rx,ry*v.ear,pk?cb:cd);if(pk)ell(1,-9*v.ear,4,8*v.ear,cp);g.restore()}
  ell(160,-78,14,12,cb);ell(262,-50,13,9,cb);
  fill([[58,-50,.7],[96,-76,.8],[150,-80,.8],[186,-62,.7],[228,-58,.8],[268,-46,.9],[283,-24,.8],[277,-6,.6],[232,-4,.5],[184,-6,.5],[140,-14,.5],[104,12,.6],[62,4,.6]],cb);
  fill([[196,-56,.8],[262,-44,.9],[276,-24,.8],[236,-14,.6],[194,-18,.6],[184,-36,.7]],cl);fill([[188,-10,.5],[236,-8,.5],[276,-12,.7],[278,-22,.7],[236,-16,.6],[190,-19,.6]],cp);
  g.save();g.globalAlpha=.5;ell(160,-74,17,11,cp);g.restore();line([[96,-62],[88,-22],[102,8]],cd,4);
  if(jaw>.12){g.save();g.globalAlpha=clamp((jaw-.12)*5);fill([[150,-7,.5],[262,-7,.6],[250,6,.8],[170,5,.8]],'#d98f92');fill([[248,-6,.3],[254,14,.5],[262,-6,.3]],'#f4ecd8');fill([[268,-6,.3],[272,6,.5],[278,-7,.3]],'#f4ecd8');g.restore()}
  else line([[279,-8],[232,-5],[184,-7],[142,-15]],cd,3.5);
  ell(163,-77,5,5*(1-blink*.9),IC.he);if(!blink)ell(164.5,-78.5,1.5,1.5,'#fff');line([[152,-85],[174,-84]],cd,3);ell(264,-51,4.5,2.6,IC.he);
  for(const [dx,dy] of [[236,-30],[250,-24],[222,-26],[262,-30]])ell(dx,dy,1.5,1.5,cd);
  if(fu>=0)for(let i=0;i<10;i++){const a=-1.75+(i-4.5)*.3,dd=(34+(i*37)%40)*eout(fu)*1.4;ell(108+Math.cos(a)*dd,-92+Math.sin(a)*dd+90*fu*fu,3.4*(1-fu)+.6,3.4*(1-fu)+.6,'#eef3e0')}   // 耳をまわして、水をとばす
  if(o.puff>0&&o.puff<1){const u=o.puff;for(let i=0;i<8;i++){const a=-1.05+(i%4-1.5)*.16,dd=(20+i*9)*eout(u);g.save();g.globalAlpha=(1-u)*.8;ell(266+Math.cos(a)*dd,-56+Math.sin(a)*dd,5+u*7,4+u*5,'#f1f4e6');g.restore()}}   // 息つぎ
  g.restore();
  if(jaw>.15&&jaw<1.05)for(let i=0;i<5;i++){const k=((t*1.5+i*.21)%1),q=rot([150+i*27,34],Hg,a2);g.save();g.globalAlpha=clamp(jaw)*(1-k);ell(q[0],q[1]+k*k*130,3,4,'#eef3e0');g.restore()}   // あごから落ちるしずく
  g.restore();g.restore();
  // 水ぎわの白い線
  g.strokeStyle='rgba(238,242,222,.85)';g.lineWidth=Math.min(7,2.4/s);g.lineCap='round';
  if(fl<84*hu-3){const w=165*L*Math.sqrt(1-fl/(84*hu));g.beginPath();g.moveTo(-88*L-w,1);g.lineTo(-88*L+w*.96,1);g.stroke()}
  if(fl<76&&!jaw){const w=104*Math.sqrt(1-fl/80);g.beginPath();g.moveTo(182-w,1);g.lineTo(182+w,1);g.stroke()}}
 else{const r=R(h.seed+5);for(let i=0;i<4;i++){const k=((t*.9+r())%1);g.save();g.globalAlpha=(1-k)*.7;g.strokeStyle='#e9eed8';g.lineWidth=2/s;g.beginPath();g.ellipse(120+r()*120,2,6+k*14,2+k*4,0,0,7);g.stroke();g.restore()}}   // もぐっている間のあわ
 g.restore()}
function bird3(x,y,s,t){const hop=pulse(t%3.4,1.2,.28)*9,peck=pulse(t%2.3,.5,.3)*.6;g.save();g.translate(x,y-hop);g.scale(s,s);line([[-2,0],[-3,-12]],'#3b3026',2.5);line([[5,0],[4,-12]],'#3b3026',2.5);
 g.translate(0,-18);g.rotate(peck);fill([[-22,2,.7],[-6,-12,.9],[14,-10,.9],[20,2,.8],[2,10,.9]],'#6b5a45');fill([[-30,6,.4],[-12,-2,.6],[-14,8,.5]],'#54463a');ell(18,-8,9,8,'#6b5a45');fill([[24,-11,.3],[38,-6,.4],[24,-3,.3]],'#d6452e');ell(20,-10,2,2,'#f4d24a');g.restore()}
function egret(x,y,s,t,dir=1){g.save();g.translate(x,y);g.scale(s*dir,s);const nod=Math.sin(t*.8)*.06+pulse(t%5,3,.5)*.5;line([[-4,0],[-2,-40]],'#3a3a32',3);line([[8,0],[6,-40]],'#3a3a32',3);
 fill([[-34,-44,.6],[-14,-72,.9],[20,-70,.9],[30,-48,.8],[0,-36,.8]],'#fbf8ee');g.save();g.translate(20,-66);g.rotate(nod);line([[0,0],[10,-34],[4,-58]],'#fbf8ee',8);ell(8,-62,9,7,'#fbf8ee');fill([[14,-66,.3],[40,-58,.3],[14,-58,.3]],'#e9b23c');ell(10,-64,1.6,1.6,'#222');g.restore();g.restore()}

// 水（横・正面で使う）。沖は空の色、手前はにごった緑茶色。光のすじと、太陽の下のきらめき
function water3(yTop,t,a=1,sunX=1010){g.save();g.globalAlpha=a;const gr=g.createLinearGradient(0,yTop,0,H);gr.addColorStop(0,IC.wFar);gr.addColorStop(.16,IC.wMid);gr.addColorStop(.5,IC.wNear);gr.addColorStop(1,IC.wDark);g.fillStyle=gr;g.fillRect(-400,yTop,W+800,H-yTop+200);
 const r=R(9);for(let i=0;i<34;i++){const d=r(),y=yTop+6+d*d*(H-yTop),x=((r()*1600+t*(6+18*d)*(i%2?1:-1))%1700+1700)%1700-200,w=30+d*170;g.globalAlpha=a*(.1+.2*r());rect(x,y,w,1.5+d*3,i%3?'#dfe8d2':'#5d6645')}
 for(let i=0;i<26;i++){const d=r(),k=(Math.sin(t*(3+r()*4)+i*2.3)+1)/2;g.globalAlpha=a*k*.85;rect(sunX-90+r()*180-d*40+d*80*r(),yTop+4+d*150,8+d*22,1.6+d*2,'#fffbe2')}g.restore()}
// 横から見たときの後ろ（dry＝0 緑 → 1 砂漠）
function sideBack(t,dry=0){const m=(a,b)=>mix(a,b,dry);rect(0,0,W,H,m('#dcebe6','#f4dfb2'));skyG(m(IC.sky0,'#f7e6bd'),m(IC.sky1,'#f4dfb2'),332);sun(1010,92,34,m('#fff3c4','#fffbe6'));
 for(const [x,y,sc,v] of [[330,112,1,9],[700,72,.6,14],[1130,172,.8,6]]){if(dry<.95)cloud(x+t*v,y-dry*140,sc*(1-dry))}
 fill([[-40,334,.4],[260,286,.8],[600,308,.8],[820,268,.6],[1120,272,.6],[1330,334,.4]],m(IC.hill,'#d6a868'));
 if(dry>0){g.save();g.globalAlpha=dry;g.translate(0,30);duneFaces();g.restore()}
 rect(0,316,W,10,m('#86b060','#cf9a58'));{const r=R(23);for(let i=0;i<9;i++){const x=40+i*150+r()*80,sc=(.5+r()*.45)*(1-dry);if(sc>.05)tree3(x,318,sc,80+i,m(IC.tree,'#8a7a45'))}}
 {const r=R(29);for(let i=0;i<14;i++){const x=r()*W,w=40+r()*90,hh=(8+r()*10)*(1-dry);fill([[x,326,.3],[x+w*.2,326-hh,.9],[x+w*.5,326-hh*.6,.9],[x+w*.8,326-hh*1.1,.9],[x+w,326,.3]],m('#3f6f4a','#a8873f'))}}
 rect(0,324,W,10,m('#b99b6c','#c98f4e'))}
function bed3(dry){rect(0,332,W,H-332,mix('#93835c',C.sand,dry));if(dry>.3){g.save();g.globalAlpha=(dry-.3)/.7;fill([[-40,420,.5],[380,392,.9],[760,430,.9],[700,470,.8],[200,468,.8]],'#d79f55');fill([[620,560,.5],[1000,520,.9],[1330,560,.6],[1330,620,.5],[800,610,.8]],'#d79f55');g.restore()}}
function bank3(t,dry=0){const m=(a,b)=>mix(a,b,dry);   // 左の岸：短い芝 → 踏まれた泥。カバの通り道と足あと
 fill([[-40,326,.3],[190,326,.6],[282,340,.8],[236,362,.8],[110,378,.8],[-40,392,.4]],m(IC.mud,'#c98f4e'));fill([[-40,322,.3],[150,322,.6],[200,332,.8],[90,346,.8],[-40,352,.4]],m(IC.lawn,'#d9a45c'));
 fill([[96,330,.5],[130,330,.5],[190,372,.6],[130,376,.6]],m(IC.mudD,'#b9793f'));for(const [x,y] of [[150,350],[178,362],[128,362],[206,354],[232,348]])ell(x,y,7,3,m(IC.mudD,'#b9793f'));
 if(dry<.05)egret(60,348,.5,t);{const r=R(13);for(let i=0;i<9;i++){const x=228+i*9+r()*6,hh=(26+r()*30)*(1-dry*.8);blade(x,352+i%3*4,hh,7,Math.sin(t*1.1+i)*4+dry*14+(r()-.5)*10,m(i%2?'#4f8648':'#3f6f4a','#a8873f'))}}}

// 群れ（横）。1頭ずつ：場所・大きさ・向き・形の種・浮き方・しぐさ
const POD=[{x:330,y:356,s:.2,dir:1,seed:3,fl:52},{x:470,y:362,s:.24,dir:-1,seed:45,fl:40},{x:612,y:366,s:.27,dir:-1,seed:11,fl:26,yawn:5.0},{x:770,y:354,s:.19,dir:1,seed:17,fl:56},{x:936,y:362,s:.25,dir:1,seed:5,fl:34,bird:1},{x:1010,y:372,s:.27,dir:-1,seed:55,fl:44},{x:1170,y:356,s:.2,dir:-1,seed:29,fl:50},
 {x:150,y:420,s:.46,dir:-1,seed:8,fl:36,bird:1},{x:330,y:432,s:.5,dir:1,seed:63,fl:48},{x:640,y:446,s:.56,dir:1,seed:21,fl:40,sink:[.9,4.3]},{x:852,y:418,s:.48,dir:1,seed:14,fl:22},{x:955,y:430,s:.26,dir:-1,seed:33,fl:12,calf:1},{x:1010,y:448,s:.54,dir:1,seed:65,fl:34,bird:1},{x:1200,y:436,s:.5,dir:-1,seed:26,fl:58},
 {x:270,y:556,s:.98,dir:1,seed:2,fl:30,yawn:1.5,bird:1},{x:1060,y:576,s:1.0,dir:-1,seed:19,fl:38},{x:600,y:676,s:.9,dir:1,seed:37,fl:60}];
function podState(h,t,tl){const v=h.v||(h.v=hv(h.seed));let fl=h.fl+Math.sin(t*.7+h.seed)*3,jaw=0,tilt=-.04+Math.sin(t*.4+h.seed)*.02,puff=0;
 if(h.yawn!=null){jaw=yawnK(tl,h.yawn,3)}
 if(h.sink){const [a,b]=h.sink;fl=lerp(fl,128,ease(tw(tl,a,1.3)));if(tl>b){fl=lerp(128,h.fl-12,eout(tw(tl,b,.8)));fl=lerp(fl,h.fl,ease(tw(tl,b+.9,1.4)));puff=tw(tl,b+.55,.7)}}
 if(h.calf){fl=h.fl+Math.sin(t*1.6)*5-ease(pulse(tl,2.2,3))*14;tilt=-.1-ease(pulse(tl,2.2,3))*.22}
 return{fl,jaw,tilt,puff,hz:h.s<.3?.42:h.s<.6?.16:0}}
function podDraw(t,tl){for(const h of POD)hpS(h,t,podState(h,t,tl))}
function podBones(t,tc,drain){POD.forEach((h,i)=>{const s=h.s*1.12,y=h.y+h.fl*h.s,drop=ease(drain)*240*h.s;g.save();if(drain<1){g.beginPath();g.rect(0,0,W,h.y+drop);g.clip()}
  if(h.s<.3)g.globalAlpha=.8;bonesFall(h.x-70*h.s*h.dir,y,s,h.dir,tc-((i*37)%10)*.035,40+i);g.restore()})}
function fg3(t,dry=0,kind=0){const sway=Math.sin(t*.9),m=(a)=>mix(a,'#6b4426',dry),k=1-dry*.9;blurOn(10);   // 手前のぼかした草（左右で形を変える）
 if(kind===0){for(const [x,hh,w,ln] of [[-10,330,60,40],[52,250,46,-14],[108,180,36,30]])blade(x,H+30,hh*k,w,(ln+sway*10)*k+dry*60,m('#1f3f35'));
  for(const [x,hh,ln] of [[1210,300,-30],[1262,380,-12]]){const tx=x+(ln+sway*12)*k,ty=H+30-hh*k;g.strokeStyle=m('#1f3f35');g.lineWidth=12;g.lineCap='round';g.beginPath();g.moveTo(x,H+30);g.quadraticCurveTo(x,H-hh*.5*k,tx,ty);g.stroke();g.save();g.translate(tx,ty);g.rotate(-.3+sway*.08);ell(0,-34*k,13,40*k,m('#2c4a3a'));g.restore()}}
 else{for(const [x,hh,w,ln] of [[1300,420,80,-70],[1240,280,50,-20],[1180,170,34,-34]])blade(x,H+30,hh,w,ln+sway*12,'#1f3f35');for(const [x,hh,w,ln] of [[-20,240,70,50],[60,150,40,10]])blade(x,H+30,hh,w,ln+sway*9,'#1f3f35')}
 blurOff()}
function side3(t,tl,st){const dead=st.dead,drain=st.drain||0,dry=st.dry||0,tc=st.tc==null?-9:st.tc;
 sideBack(t,dry);bed3(dry);if(drain<1)water3(332+ease(drain)*30,t,1-ease(drain));bank3(t,dry);
 if(!dead)podDraw(t,tl);else podBones(t,tc,drain);
 if(dead){const f=tw(st.td,.45,1.6),h=POD[14];if(f<1)birdA(lerp(h.x-90,h.x+420,ease(f)),lerp(h.y-90,40,ease(f)),.8,f>0?Math.abs(Math.sin(t*22))*1.2:0)}
 fg3(t,dry,0)}

// ─── C：正面。1頭が主役。ほかは後ろで好きにしている ───
function face3(x,y,s,t,o={}){const ear=o.ear||0,blink=o.blink||0,look=o.look||0,nos=o.nos||0,cb=IC.hb,cl=IC.hl,cd=IC.hd,cp=IC.hp;g.save();g.translate(x,y);g.scale(s,s);
 for(const d of [-1,1]){g.save();g.translate(118*d,-136);g.rotate(d*(.2+ear*(d>0?1:.8)));ell(0,-18,18,27,cb);ell(0,-17,8,16,cp);g.restore()}
 fill([[-130,-60,.9],[-122,-128,.9],[-60,-160,.8],[60,-160,.8],[122,-128,.9],[130,-60,.9],[110,10,.8],[-110,10,.8]],cb);ell(-98,-128,30,27,cb);ell(98,-128,30,27,cb);
 fill([[-202,60,.9],[-172,-30,.9],[-80,-66,.8],[80,-66,.8],[172,-30,.9],[202,60,.9],[182,140,.9],[90,178,.8],[-90,178,.8],[-182,140,.9]],cb);
 fill([[-60,-152,.8],[60,-152,.8],[90,-110,.8],[0,-96,.8],[-90,-110,.8]],cl);
 for(const d of [-1,1]){g.save();g.globalAlpha=.5;ell(98*d,-122,26,20,cp);g.restore();ell(98*d+look*4,-124,10,blink?2:9,IC.he);if(!blink)ell(98*d+3+look*4,-127,2,2,'#fff');line([[98*d-17,-135+blink*6],[98*d+17,-135+blink*6]],cd,blink?8:4)}
 fill([[-150,-24,.9],[-80,-58,.8],[80,-58,.8],[150,-24,.9],[110,-4,.8],[-110,-4,.8]],cl);for(const d of [-1,1]){ell(58*d,-26,26,17,cb);ell(58*d,-24,13+nos*3,4+nos*5,IC.he)}
 fill([[-190,90,.9],[0,70,.5],[190,90,.9],[176,140,.9],[90,174,.8],[-90,174,.8],[-176,140,.9]],cp);line([[-186,88],[0,68],[186,88]],cd,6);
 for(const [dx,dy] of [[-120,30],[-90,44],[-140,56],[120,30],[90,44],[140,56],[-60,24],[60,26]])ell(dx,dy,3,3,cd);g.restore()}
function headF(x,y,s,t,seed){const v=hv(seed),cb=mix(mix(IC.hb,v.tn>0?'#93706a':'#615a5a',Math.abs(v.tn)*.6),'#93a79c',.3),cp=mix(IC.hp,'#93a79c',.3),fu=flickU(t+seed,v.ft),ear=fu<0?0:Math.sin(fu*34)*(1-fu),w=.85+v.L*.2;   // こっちを向いた小さい頭（耳・目・鼻だけ）
 g.save();g.translate(x,y+Math.sin(t*.8+seed)*2);g.scale(s,s);g.save();g.globalAlpha=.5;g.strokeStyle='#e9eed8';g.lineWidth=2/s;const k=(t*.3+v.sx)%1;g.beginPath();g.ellipse(0,2,130+k*150,5+k*12,0,0,7);g.stroke();g.restore();
 for(const d of [-1,1]){g.save();g.translate(70*w*d,-40);g.rotate(d*(.3+ear));ell(0,-12,11*v.ear,17*v.ear,cb);ell(0,-12,5,10,cp);g.restore();ell(58*w*d,-22,17,16,cb)}
 fill([[-86*w,2,.5],[-78*w,-34,.9],[0,-48*v.hu,.9],[78*w,-34,.9],[86*w,2,.5]],cb);for(const d of [-1,1]){ell(58*w*d,-22,5,5,IC.he);ell(30*d,-2,12,7,cb);ell(30*d,-3,5,2.5,IC.he)}
 line([[-84*w,2],[84*w,2]],'rgba(238,242,222,.85)',2.5/s);g.restore()}
const POD2=[{x:176,y:284,s:.2,dir:1,seed:41,fl:54},{x:392,y:300,s:.3,dir:1,seed:43,fl:28,yawn:.3},{x:905,y:288,s:.23,dir:-1,seed:47,fl:36,bird:1},{x:1096,y:304,s:.3,dir:-1,seed:53,fl:40,sink:[.4,2.5]},{x:196,y:352,s:.44,dir:1,seed:59,fl:42},{x:1150,y:372,s:.46,dir:-1,seed:61,fl:60}];
function front3(t,tl){rect(0,0,W,H,IC.sky1);skyG(IC.sky0,IC.sky1,250);sun(260,84,30);cloud(820+t*8,96,.9);cloud(1120+t*5,150,.5);
 fill([[-40,252,.4],[330,206,.8],[760,226,.8],[1040,196,.6],[1330,252,.4]],IC.hill);rect(0,232,W,12,'#86b060');{const r=R(71);for(let i=0;i<7;i++)tree3(70+i*190+r()*90,234,.6+r()*.5,90+i)}rect(0,242,W,10,'#b99b6c');
 water3(250,t,1,260);
 for(const h of POD2){const st=podState(h,t,tl);st.hz=h.s<.35?.4:.22;h.x+=0;hpS({...h,x:h.x+h.dir*tl*(h.s<.3?5:2),v:h.v||(h.v=hv(h.seed))},t,st)}
 headF(742,322,.3,t,67);headF(520,290,.2,t,73);
 // 主役：目だけ出して見ている → ぬっと上がる → 耳をまわす → ゆっくり沈む
 const rise=ease(tw(tl,.9,1.0))-ease(tw(tl,2.9,1.0))*.82,wl=476,y0=lerp(596,424,rise)+Math.sin(t*1.7)*3,fu=(tl-2.05)/.75,ear=fu>0&&fu<1?Math.sin(fu*34)*(1-fu):pulse(tl,.45,.2)*.5;
 g.save();g.globalAlpha=.35;ell(640,wl+14,330,26,'#b9a876');g.restore();
 g.save();g.beginPath();g.rect(0,0,W,wl);g.clip();face3(640,y0,1.25,t,{ear,blink:Math.max(pulse(tl,.6,.2),pulse(tl,3.3,.2))>.5,look:Math.sin(tl*1.2),nos:pulse(tl,1.5,.5)});
 if(fu>0&&fu<1)for(const d of [-1,1])for(let i=0;i<10;i++){const a=-1.57+d*.5+(i-4.5)*.26,dd=(50+(i*37)%60)*eout(fu)*1.5;ell(640+d*150+Math.cos(a)*dd,y0-220+Math.sin(a)*dd+150*fu*fu,5*(1-fu)+1,5*(1-fu)+1,'#eef3e0')}
 {const u=(tl-1.5)/.7;if(u>0&&u<1)for(const d of [-1,1])for(let i=0;i<6;i++){g.save();g.globalAlpha=(1-u)*.8;ell(640+d*(72+i*10*eout(u)),y0-40-(26+i*12)*eout(u),7+u*9,6+u*7,'#f1f4e6');g.restore()}}
 g.restore();
 for(let i=0;i<3;i++){const k=((t*.4+i/3)%1);g.save();g.globalAlpha=(1-k)*.8;g.strokeStyle='#e9eed8';g.lineWidth=3;g.beginPath();g.ellipse(640,wl+6,240+k*340,7+k*40,0,0,7);g.stroke();g.restore()}
 {const hw=lerp(150,255,clamp((wl-(y0-205))/330));line([[640-hw,wl+1],[640-hw*.3,wl-1],[640+hw*.4,wl+1],[640+hw,wl+1]],'rgba(238,242,222,.9)',4)}
 fg3(t,0,1)}

// ─── D：真上。背中が岩のように並ぶ。1頭が水の底をけって進み、泥が舞いあがる ───
function hpTop3(x,y,s,ang,seed,t,o={}){const v=hv(seed),cb=mix(IC.hb,v.tn>0?'#93706a':'#615a5a',Math.abs(v.tn)*.6),cl=mix(cb,'#cdbfb6',.4),cd=mix(cb,'#2e2626',.4),L=v.L,Wd=.8+v.hu*.25,fu=flickU(t+seed,v.ft),ear=fu<0?0:Math.sin(fu*34)*(1-fu),up=o.up==null?1:o.up;
 g.save();g.translate(x,y);g.rotate(ang);g.scale(s,s);
 for(let i=0;i<2;i++){const k=((t*.3+i/2+v.sx)%1);g.save();g.globalAlpha=(1-k)*.22;g.strokeStyle='#e9eed8';g.lineWidth=2/s;g.beginPath();g.ellipse(20,0,(230+k*120),(110+k*90)*Wd,0,0,7);g.stroke();g.restore()}
 g.save();g.globalAlpha=.28;fill([[-205*L,0,.9],[-170*L,-74*Wd,.9],[-40*L,-92*Wd,.9],[90,-74*Wd,.9],[280,0,.8],[90,74*Wd,.9],[-40*L,92*Wd,.9],[-170*L,74*Wd,.9]],'#3d4230');g.restore();   // 水の下の体（にごって、うっすらとしか見えない）
 const k=.78+.22*up;fill([[-170*L*k,0,.9],[-142*L*k,-56*Wd*k,.9],[-40*L,-70*Wd*k,.9],[66*k,-56*Wd*k,.9],[104*k,0,.8],[66*k,56*Wd*k,.9],[-40*L,70*Wd*k,.9],[-142*L*k,56*Wd*k,.9]],cb);
 fill([[-130*L*k,-4,.9],[-100*L*k,-30*Wd*k,.9],[-20*L,-36*Wd*k,.9],[50*k,-22*Wd*k,.8],[40*k,2,.8],[-40*L,8,.8]],cl);line([[-150*L*k,0],[60*k,0]],cd,2.5);
 for(let i=0;i<v.scar;i++){const xx=(-110+i*50)*L*k;line([[xx,20*Wd],[xx+22,30*Wd]],cl,2.5)}
 if(o.bird){g.save();g.translate(-60*L,(v.sx-.5)*40);g.scale(1/s*.5,1/s*.5);ell(0,0,16,9,'#6b5a45');ell(14,0,7,6,'#6b5a45');fill([[19,-3,.3],[30,0,.3],[19,3,.3]],'#d6452e');g.restore()}
 g.save();g.translate(96,0);g.rotate(o.head||0);g.translate(-96,0);
 for(const d of [-1,1]){g.save();g.translate(116,44*d);g.rotate(d*ear);ell(0,d*4,9,12,cb);ell(0,d*4,4,7,IC.hp);g.restore()}
 fill([[92,-38,.8],[150,-48,.8],[214,-44,.8],[256,-28,.9],[262,0,.9],[256,28,.9],[214,44,.8],[150,48,.8],[92,38,.8]],cb);fill([[186,-34,.8],[240,-22,.9],[246,0,.9],[240,22,.9],[186,34,.8],[176,0,.8]],cl);
 for(const d of [-1,1]){ell(150,36*d,11,10,cb);ell(152,36*d,4,4,IC.he);ell(232,14*d,6,4.5,IC.he)}g.restore();
 if(fu>=0)for(const d of [-1,1])for(let i=0;i<6;i++){const a=d*(1.2+i*.2),dd=(20+i*9)*eout(fu)*1.5;ell(116+Math.cos(a)*dd,44*d+Math.sin(a)*dd,3*(1-fu)+.5,3*(1-fu)+.5,'#eef3e0')}
 g.restore()}
const PODT=[[640,250,.5,.15,101],[770,318,.56,.02,103,1],[575,352,.46,.3,107],[905,246,.44,-.25,109],[700,420,.52,-.1,113],[960,372,.5,.22,127],[830,468,.4,.4,131,1],[1040,300,.36,-.5,137],[512,244,.3,.5,139],[1085,452,.46,.05,149]];
function top3(t,tl){rect(0,0,W,H,'#7c8759');
 {const r=R(19);for(let i=0;i<22;i++){const x=r()*W,y=r()*H,w=120+r()*240,dx=Math.sin(t*.25+i)*26;g.save();g.globalAlpha=.1+.12*r();g.strokeStyle=i%3?'#a9a274':'#5f6844';g.lineWidth=10+r()*26;g.lineCap='round';g.beginPath();g.moveTo(x+dx,y);g.quadraticCurveTo(x+w*.5+dx,y+(r()-.5)*90,x+w+dx,y+(r()-.5)*40);g.stroke();g.restore()}}
 // 岸（左上）：芝・泥・通り道・足あと・草の株
 fill([[-40,-40,.3],[470,-40,.5],[410,70,.9],[230,150,.9],[70,170,.9],[-40,210,.5]],IC.mud);fill([[-40,-40,.3],[400,-40,.5],[330,36,.9],[170,92,.9],[-40,130,.5]],IC.lawn);
 fill([[150,-40,.5],[200,-40,.5],[300,112,.7],[250,140,.7]],IC.mudD);for(const [x,y] of [[262,96],[240,60],[284,130],[226,112],[210,30],[236,-6]])ell(x,y,7,5,'#756443');
 {const r=R(31);for(let i=0;i<7;i++){const x=40+r()*330,y=10+r()*90;for(let j=0;j<7;j++){const a=j*.9+r();poly([[x,y],[x+Math.cos(a)*(16+r()*10),y+Math.sin(a)*(16+r()*10)],[x+Math.cos(a+.5)*6,y+Math.sin(a+.5)*6]],j%2?'#4f8648':'#6fa75f')}}}
 for(const [x,y] of [[352,84],[120,150]]){ell(x,y,9,5,'#fbf8ee');ell(x+8,y-2,4,3,'#fbf8ee');g.save();g.globalAlpha=.25;ell(x+10,y+12,9,5,'#333');g.restore()}
 // 歩く1頭：底をけるたびに背中が上がり、うしろに泥のけむり
 const wa=-.42,sp=tl*38,wx=250+Math.cos(wa)*sp,wy=640+Math.sin(wa)*sp,bn=Math.abs(Math.sin(tl*2.6));
 for(let i=0;i<7;i++){const age=tl-i*.6+((tl*1.0)%0.6)-.2;const tt=Math.floor(tl/.6)*.6-i*.6;if(tt<0)continue;const a2=tl-tt,px=250+Math.cos(wa)*tt*38-Math.cos(wa)*60,py=640+Math.sin(wa)*tt*38-Math.sin(wa)*60;g.save();g.globalAlpha=clamp(.5-a2*.11);ell(px,py,30+a2*26,20+a2*18,'#b3a577');ell(px+14,py+10,18+a2*18,12+a2*12,'#beb083');g.restore()}
 for(const [x,y,s,a,seed,b] of PODT)hpTop3(x+Math.sin(t*.5+seed)*3,y+Math.cos(t*.4+seed)*2,s,a,seed,t,{bird:b,head:Math.sin(t*.6+seed)*.12});
 g.save();g.translate(wx,wy);g.rotate(wa);g.globalAlpha=.45;line([[-90,-34],[-230,-96]],'#e9eed8',3);line([[-90,34],[-230,96]],'#e9eed8',3);g.restore();
 hpTop3(wx,wy,.6,wa,151,t,{up:bn,head:Math.sin(tl*1.3)*.15});
 {const bx=lerp(1340,-80,tw(tl,.6,2.6)),by=lerp(520,300,tw(tl,.6,2.6));g.save();g.globalAlpha=.22;ell(bx+50,by+90,26,9,'#222');g.restore();g.save();g.translate(bx,by);g.rotate(-2.9);const fl=Math.sin(t*16);fill([[-10,0,.6],[-2,-30*fl-8,.9],[8,0,.6]],'#fbf8ee');fill([[-10,0,.6],[-2,30*fl+8,.9],[8,0,.6]],'#fbf8ee');ell(0,0,18,7,'#fbf8ee');g.restore()}
 blurOn(12);blade(1210,H+60,330,90,-80+Math.sin(t*.9)*12,'#1f3f35');blade(1290,H+40,220,60,-30+Math.sin(t*.9+1)*10,'#1f3f35');blurOff()}

// ─── 通し ───
SC.intro3=function(t){const TA=5.6,TB=12.8,TC=16.6,TD=20,TX=22.4;
 if(t<TA)grass3(t);
 else if(t<TB){const tl=t-TA,z=1.16-.1*eout(tw(tl,0,1.6))+.03*ease(tw(tl,1.6,5.6));g.translate(600,440);g.scale(z,z);g.translate(-600,-440);side3(t,tl,{dead:false});
  if(tl<.8){g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1-ease(tw(tl,0,.8));rect(0,0,W,H,'#fffdf0');g.restore()}}
 else if(t<TC){const tl=t-TB,z=1.02+.04*ease(tw(tl,0,3.8));g.translate(640,430);g.scale(z,z);g.translate(-640,-430);front3(t,tl)}
 else if(t<TD){const tl=t-TC,z=1.1-.07*ease(tw(tl,0,3.4));g.translate(640,360);g.scale(z,z);g.rotate(-.02+.02*tl/3.4);g.translate(-640,-360);top3(t,tl)}
 else{const tl=t-TD,td=t-TX,dead=td>=0,drain=tw(td,.75,.9),dry=ease(tw(td,.9,1.4)),tc=td-1.75;
  const z=1.09-.07*ease(tw(td,.6,1.4))+.04*ease(tw(td,3.2,2.2));g.translate(600,450);g.scale(z,z);g.translate(-600,-450);
  side3(t,7.2+tl,{dead,drain,dry,tc,td});
  if(dead&&td<.1){g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=.8*(1-td/.1);rect(0,0,W,H,'#fff');g.restore()}
  if(td>2.2){const k=ease(tw(td,2.2,1.6));blurOn(9);fill([[-60,760,.2],[-60,430+300*(1-k),.6],[240,470+300*(1-k),.9],[520,640+200*(1-k),.8],[600,760,.2]],C.sandN);fill([[1340,760,.2],[1340,560+260*(1-k),.6],[1100,640+200*(1-k),.9],[980,760,.2]],C.sandN);blurOff();
   g.save();g.globalAlpha=k*.9;for(let i=0;i<5;i++){const x=((t*60+i*260)%1500)-120;line([[x,650+i*12],[x+90,646+i*12]],'#f0cf93',3)}g.restore()}}};
SC.gape3=function(t){rect(0,0,W,H,'#cfd8c4');rect(0,300,W,60,IC.wNear);rect(0,620,W,100,IC.wNear);
 hpS({x:300,y:300,s:1,dir:1,seed:2},t,{fl:-40,jaw:1});hpS({x:980,y:300,s:1,dir:-1,seed:19},t,{fl:-10,jaw:.5});hpS({x:300,y:620,s:.9,dir:1,seed:8},t,{fl:30});hpS({x:760,y:620,s:.9,dir:1,seed:37},t,{fl:58});hpS({x:1120,y:620,s:.5,dir:-1,seed:33},t,{fl:10})};
