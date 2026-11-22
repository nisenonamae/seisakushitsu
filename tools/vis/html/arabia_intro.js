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
function hpS(h,t,o={}){const v=h.v||(h.v=hv(h.seed)),s=h.s,jaw=o.jaw||0,tilt=(o.tilt||0)-.52*jaw,fl=(o.fl==null?30:o.fl)-78*jaw,hz=o.hz||0;
 let cb=mix(IC.hb,v.tn>0?'#93706a':'#615a5a',Math.abs(v.tn)*.6),cd=mix(cb,'#2e2626',.42),cl=mix(cb,'#cdbfb6',.42),cp=mix(IC.hp,cb,.15);
 if(hz){cb=mix(cb,'#93a79c',hz);cd=mix(cd,'#93a79c',hz);cl=mix(cl,'#a9bbb0',hz);cp=mix(cp,'#93a79c',hz)}
 const L=v.L,hu=v.hu,fu=flickU(t+h.seed,v.ft),ear=fu<0?0:Math.sin(fu*34)*(1-fu)*1.0,blink=Math.max(...v.bt.map(b=>pulse(t+h.seed*.37,b,.2)))>.5?1:0;
 g.save();g.translate(h.x,h.y);g.scale(s*h.dir,s);
 // 水のにごり・映りこみ・輪
 g.save();g.globalAlpha=.34;ell(-80*L,10,210*L,12,'#b9a876');g.globalAlpha=.3;if(fl<84*hu)ell(-85*L,11,170*L,9,'#3f4530');if(fl<84)ell(185,9,100,8,'#3f4530');g.restore();
 for(const e of (o.ev||[])){const age=e.age;if(age<=0||age>=2.4)continue;for(let j=0;j<2;j++){const k=(age-j*.35)/2.05;if(k<=0||k>=1)continue;g.save();g.globalAlpha=(1-k)*.6;g.strokeStyle='#e9eed8';g.lineWidth=Math.min(6,2.2/s);g.beginPath();g.ellipse(e.x,6,e.w*(1+k*1.3)+k*50,(e.w*(1+k*1.3)+k*50)*.07+3,0,0,7);g.stroke();g.restore()}}
 if(fl<118){g.save();g.beginPath();g.rect(-900,-1200,1800,1200);g.clip();g.translate(0,fl);
  // 胴（背中）
  fill([[-250*L,30,.7],[-236*L,-48*hu,.9],[-150*L,-84*hu,.9],[-40*L,-82*hu,.9],[42,-62*hu,.8],[86,-34,.6],[92,40,.5]],cb);
  fill([[-218*L,-50*hu,.9],[-150*L,-78*hu,.9],[-40*L,-76*hu,.9],[30,-58*hu,.8],[-40*L,-63*hu,.8],[-150*L,-64*hu,.8]],cl);
  
  for(let i=0;i<v.scar;i++){const x=(-200+i*70+v.sx*40)*L;line([[x,-56*hu-i*3],[x+26,-44*hu-i*2]],cl,2.5)}
  if(h.bird)bird3(-120*L,-84*hu,1/Math.max(s,.4)*.5,t+h.seed);
  // 頭
  g.save();g.translate(72,-28);g.rotate(tilt);g.scale(v.head,v.head);g.translate(-72,28);
  const Hg=[128,-8],a1=jaw*.45,a2=jaw*1.02,U=p=>rot([lerp(128,278,p),-6],Hg,-a1),Lw=p=>rot([lerp(128,278,p),-6],Hg,a2);
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
  if(fu>=0){const rr=R(h.seed+9);for(let i=0;i<7;i++){const a=-1.75+(rr()-.5)*2.3,dd=(16+rr()*84)*eout(fu),gv=(60+rr()*120)*fu*fu,sz=(1.6+rr()*3.2)*(1-fu)+.5;ell(108+Math.cos(a)*dd,-92+Math.sin(a)*dd+gv,sz*.8,sz*1.2,'#eef3e0')}}   // 耳をまわして、水をとばす
  if(o.puff>0&&o.puff<1){const u=o.puff;for(let i=0;i<8;i++){const a=-1.05+(i%4-1.5)*.16,dd=(20+i*9)*eout(u);g.save();g.globalAlpha=(1-u)*.8;ell(266+Math.cos(a)*dd,-56+Math.sin(a)*dd,5+u*7,4+u*5,'#f1f4e6');g.restore()}}   // 息つぎ
  g.restore();
  if(jaw>.15&&jaw<1.05)for(let i=0;i<5;i++){const k=((t*1.5+i*.21)%1),q=rot([150+i*27,34],Hg,a2);g.save();g.globalAlpha=clamp(jaw)*(1-k);ell(q[0],q[1]+k*k*130,3,4,'#eef3e0');g.restore()}   // あごから落ちるしずく
  g.restore();g.restore();
  // 水ぎわの白い線
  g.strokeStyle='rgba(238,242,222,0)';g.lineWidth=Math.min(7,2.4/s);g.lineCap='round';
  if(fl<84*hu-3){const w=165*L*Math.sqrt(1-fl/(84*hu));g.beginPath();g.moveTo(-88*L-w,1);g.lineTo(-88*L+w*.96,1);g.stroke()}
  if(false){const w=104*Math.sqrt(1-fl/80);g.beginPath();g.moveTo(182-w,1);g.lineTo(182+w,1);g.stroke()}}
 else{const r=R(h.seed+5);for(let i=0;i<4;i++){const k=((t*.9+r())%1);g.save();g.globalAlpha=(1-k)*.7;g.strokeStyle='#e9eed8';g.lineWidth=2/s;g.beginPath();g.ellipse(120+r()*120,2,6+k*14,2+k*4,0,0,7);g.stroke();g.restore()}}   // もぐっている間のあわ
 g.restore()}
function bird3(x,y,s,t){const hop=pulse(t%3.4,1.2,.28)*9,peck=pulse(t%2.3,.5,.3)*.6;g.save();g.translate(x,y-hop);g.scale(s,s);line([[-2,0],[-3,-12]],'#3b3026',2.5);line([[5,0],[4,-12]],'#3b3026',2.5);
 g.translate(0,-18);g.rotate(peck);fill([[-22,2,.7],[-6,-12,.9],[14,-10,.9],[20,2,.8],[2,10,.9]],'#6b5a45');fill([[-30,6,.4],[-12,-2,.6],[-14,8,.5]],'#54463a');ell(18,-8,9,8,'#6b5a45');fill([[24,-11,.3],[38,-6,.4],[24,-3,.3]],'#d6452e');ell(20,-10,2,2,'#f4d24a');g.restore()}
function egret(x,y,s,t,dir=1){g.save();g.translate(x,y);g.scale(s*dir,s);const nod=Math.sin(t*.8)*.06+pulse(t%5,3,.5)*.5;line([[-4,0],[-2,-40]],'#3a3a32',3);line([[8,0],[6,-40]],'#3a3a32',3);
 fill([[-34,-44,.6],[-14,-72,.9],[20,-70,.9],[30,-48,.8],[0,-36,.8]],'#fbf8ee');g.save();g.translate(20,-66);g.rotate(nod);line([[0,0],[10,-34],[4,-58]],'#fbf8ee',8);ell(8,-62,9,7,'#fbf8ee');fill([[14,-66,.3],[40,-58,.3],[14,-58,.3]],'#e9b23c');ell(10,-64,1.6,1.6,'#222');g.restore();g.restore()}

// 水（横・正面で使う）。沖は空の色、手前はにごった緑茶色。光のすじと、太陽の下のきらめき
function water3(yTop,t,a=1,sunX=1010){g.save();g.globalAlpha=a;const gr=g.createLinearGradient(0,yTop,0,H);gr.addColorStop(0,IC.wFar);gr.addColorStop(.16,IC.wMid);gr.addColorStop(.5,IC.wNear);gr.addColorStop(1,IC.wDark);g.fillStyle=gr;g.fillRect(-400,yTop,W+800,H-yTop+200);
 const r=R(9);for(let i=0;i<34;i++){const d=r(),y=yTop+6+d*d*(H-yTop),x=((r()*1600+t*(6+18*d)*(i%2?1:-1))%1700+1700)%1700-200,w=30+d*170;g.globalAlpha=a*(.06+.1*r());rect(x,y,w,1.5+d*3,i%3?'#c9d4ba':'#5d6645')}
 for(let i=0;i<26;i++){const d=r(),k=(Math.sin(t*(3+r()*4)+i*2.3)+1)/2;g.globalAlpha=a*k*.7;rect(sunX-120+r()*240,yTop+3+d*d*26,6+d*10,1.3,'#fffbe2')}g.restore()}
// 横から見たときの後ろ（dry＝0 緑 → 1 砂漠）
function sideBack(t,dry=0){const m=(a,b)=>mix(a,b,dry);rect(0,0,W,H,m('#dcebe6','#f4dfb2'));world3(t,316,{dry,noBirds:1});
 if(dry>0){g.save();g.globalAlpha=dry;g.translate(0,30);duneFaces();g.restore()}
 {const r=R(29);for(let i=0;i<14;i++){const x=r()*W,w=40+r()*90,hh=(8+r()*10)*(1-dry);fill([[x,328,.3],[x+w*.2,328-hh,.9],[x+w*.5,328-hh*.6,.9],[x+w*.8,328-hh*1.1,.9],[x+w,328,.3]],m('#3f6f4a','#a8873f'))}}
 rect(0,325,W,9,m('#b99b6c','#c98f4e'));for(const [x,w] of [[380,26],[700,34],[1010,22]])fill([[x,326,.4],[x+w,326,.4],[x+w+8,335,.5],[x-8,335,.5]],m('#9c8258','#c98f4e'));   // 向こう岸の、カバの上がり口
}
function bed3(dry){rect(0,332,W,H-332,mix('#93835c',C.sand,dry));if(dry>.3){g.save();g.globalAlpha=(dry-.3)/.7;fill([[-40,420,.5],[380,392,.9],[760,430,.9],[700,470,.8],[200,468,.8]],'#d79f55');fill([[620,560,.5],[1000,520,.9],[1330,560,.6],[1330,620,.5],[800,610,.8]],'#d79f55');g.restore()}}
function bank3(t,dry=0){const m=(a,b)=>mix(a,b,dry);   // 左の岸：短い芝 → 踏まれた泥。カバの通り道と足あと
 fill([[-40,326,.3],[190,326,.6],[282,340,.8],[236,362,.8],[110,378,.8],[-40,392,.4]],m(IC.mud,'#c98f4e'));fill([[-40,322,.3],[150,322,.6],[200,332,.8],[90,346,.8],[-40,352,.4]],m(IC.lawn,'#d9a45c'));
 
 {const r=R(13);for(let i=0;i<9;i++){const x=228+i*9+r()*6,hh=(26+r()*30)*(1-dry*.8);blade(x,352+i%3*4,hh,7,Math.sin(t*1.1+i)*4+dry*14+(r()-.5)*10,m(i%2?'#4f8648':'#3f6f4a','#a8873f'))}}}

// 群れ（横）。1頭ずつ：場所・大きさ・向き・形の種・浮き方・しぐさ
// ─── カバ（どの向きでも）。体を「だ円の玉」の集まりとして持ち、向き（yaw）で回して描く。0＝右向き・90＝こっち向き・180＝左向き・270＝むこう向き ───
function hp3(h,t,o={}){const v=h.v||(h.v=hv(h.seed)),s=h.s,kp=.2,jaw=o.jaw||0,fl=(o.fl==null?30:o.fl)-34*jaw,hz=o.hz||0,th=(h.yaw||0)*Math.PI/180+(o.dyaw||0),hy=o.hyaw||0,tilt=(o.tilt||0)-.34*jaw,a1=jaw*.55,a2=jaw*1.12;
 let cb=mix(IC.hb,v.tn>0?'#93706a':'#615a5a',Math.abs(v.tn)*.6),cd=mix(cb,'#2e2626',.42),cl=mix(cb,'#cdbfb6',.36),cp=mix(IC.hp,cb,.15),ce=IC.he,cm='#d98f92',ct='#8a3b47',ci='#f4ecd8';
 if(hz){const hc=o.hzc||'#93a79c',z=c=>mix(c,hc,hz);cb=z(cb);cd=z(cd);cl=mix(cl,o.hzc||'#a9bbb0',hz);cp=z(cp);ce=mix(ce,hc,hz*.6)}
 const L=v.L,hu=v.hu,fu=flickU(t+h.seed,v.ft),ew=fu<0?0:Math.sin(fu*34)*(1-fu),blink=Math.max(...v.bt.map(b=>pulse(t+h.seed*.37,b,.2)))>.5;
 const cT=Math.cos(th),sT=Math.sin(th),N=[72,-28],Hg=[128,-8],P=[];
 const tr=(X,Y,Z,grp)=>{let ang=0,yw=th;if(grp){let q=[X,Y];if(grp===2){q=rot(q,Hg,-a1);ang-=a1}if(grp===3){q=rot(q,Hg,a2);ang+=a2}q=rot(q,N,tilt);ang+=tilt;const dx=q[0]-70,c=Math.cos(hy),sn=Math.sin(hy);X=70+dx*c-Z*sn;Z=dx*sn+Z*c;Y=q[1];yw=th+hy}return{X,Y,Z,ang,yw,xs:X*cT-Z*sT,n:X*sT+Z*cT}};
 const add=(X,Y,Z,rx,ry,rz,col,pri=0,grp=0,a0=0)=>{const q=tr(X,Y,Z,grp);q.ang+=a0;const c=Math.cos(q.yw),sn=Math.sin(q.yw),ax=Math.hypot(Math.cos(q.ang)*c,Math.sin(q.ang));
  P.push({xs:q.xs,ys:q.Y+q.n*kp,n:q.n,Y:q.Y,ry,rn:Math.hypot(rx*sn,rz*c),k:q.n+pri,ra:Math.hypot(rx*ax,rz*sn),rb:Math.hypot(ry,Math.hypot(rx*sn,rz*c)*kp*.6),ro:q.ang?Math.atan2(Math.sin(q.ang),Math.cos(q.ang)*c):0,col})};
 add(-95*L,-4,0,165*L,80*hu,78,cb);add(-190*L,6,0,70,62*hu,66,cb);add(30,-8,0,70,58,62,cb);add(-95*L,-56*hu,0,118*L,22*hu,36,cl,1);add(-262*L,-18,0,7,20,6,cd,1);
 add(135,-34,0,62,44,52,cb,0,2);add(118,-6,0,40,34,50,cb,0,1);add(222,-26,0,62,30,60,cb,0,2);add(140,-62,0,28,11,28,cl,1,2);add(226,-42,0,40,11,42,cl,1,2);
 add(210,8,0,72,22,56,cb,0,3);add(214,19,0,60,12,48,cp,1,3);
 for(const d of [-1,1]){add(160,-72,36*d,14,12,12,cb,0,2);add(160,-69,41*d,13,9,7,mix(cp,cb,.45),.5,2);add(165,-74,46*d,5,blink?1.2:5,3.5,ce,1,2);if(!blink)add(167,-76,49*d,1.6,1.6,1.2,'#ffffff',2,2);add(164,-80,45*d,9,1.6,5,cd,1.5,2);
  add(106+ew*8,-72,38*d,7,15*v.ear*(1-Math.abs(ew)*.3),10,cb,0,2);add(109+ew*8,-73,45*d,3.5,9*v.ear,5,cp,1,2);
  add(258,-50,22*d,12,9,12,cb,0,2);add(263,-53,24*d,5,2.6,5,ce,1,2)}
 if(jaw>.1){const k=clamp((jaw-.1)*4);{const bq=rot([128+34,-6],Hg,(a2-a1)/2);add(bq[0],bq[1],0,13*k,17*k,30,ct,-2,1)}add(215,3,0,58,8,50,cm,-1,2);add(205,-9,0,54,8,40,'#dc9a9c',1,3);
  for(const d of [-1,1]){add(262,-30,36*d,6,24*k,6,ci,2,3);add(250,12,40*d,5,10*k,5,ci,1,2);add(284,-10,10*d,11,4,5,ci,2,3)}}
 if(o.full){add(-85*L,30,0,150*L,52,72,cb);add(34,22,0,66,48,64,cb);add(-170*L,24,0,62,50,64,cb);add(-85*L,56,0,118*L,24,54,mix(cp,cb,.35),1);const lg=o.legs||[0,0,0,0];
  [[-168*L,44],[-150*L,-44],[42,46],[58,-46]].forEach(([X,Z],i)=>{const f=lg[i],sx=Math.sin(f),cx=Math.cos(f);add(X+sx*30,40+cx*30,Z,28,46,24,Z<0?cd:cb,0,0,-f);add(X+sx*66,40+cx*66,Z,29,13,24,cd,.5,0,-f)})}
 P.sort((a,b)=>a.k-b.k);
 g.save();g.translate(h.x,h.y);g.scale(s,s);
 if(o.full){for(const q of P){g.save();g.translate(q.xs,q.ys);if(q.ro)g.rotate(q.ro);ell(0,0,q.ra,q.rb,q.col);g.restore()}g.restore();return}
 const wB=Math.hypot(250*L*cT,90*sT),cxB=-40*cT;g.save();g.globalAlpha=.3;ell(cxB,10+16*Math.abs(sT),wB+10,9+20*Math.abs(sT),'#b9a876');g.globalAlpha=.28;if(fl<100)ell(cxB,12+20*Math.abs(sT),wB*.8,8+22*Math.abs(sT),'#3f4530');g.restore();
 for(const e of (o.ev||[])){const age=e.age;if(age<=0||age>=2.4)continue;for(let j=0;j<2;j++){const k=(age-j*.35)/2.05;if(k<=0||k>=1)continue;g.save();g.globalAlpha=(1-k)*.6;g.strokeStyle='#e9eed8';g.lineWidth=Math.min(6,2.2/s);g.beginPath();g.ellipse(e.x*cT,6+(e.x*sT)*kp,e.w*(1+k*1.3)+k*50,(e.w*(1+k*1.3)+k*50)*(.07+.2*Math.abs(sT)*.4)+3,0,0,7);g.stroke();g.restore()}}
 if(fl<118){for(const q of P){const hh=(q.Y+fl)/q.ry,cq=Math.sqrt(Math.max(0,1-hh*hh));g.save();g.beginPath();g.rect(-1200,-1600,2400,1600+q.n*kp);if(cq>.05)g.ellipse(q.xs,q.n*kp,q.ra*cq,Math.max(1,q.rn*cq*kp),0,0,7);g.clip();g.translate(q.xs,q.ys+fl);if(q.ro)g.rotate(q.ro);ell(0,0,q.ra,q.rb,q.col);g.restore()}
  if(h.bird){const q=tr(-120*L,-84*hu,0,0);if(fl<60){if(h.bird===2)egret(q.xs,q.Y+q.n*kp+fl+2,.5/Math.max(s,.45),t+h.seed,cT<0?-1:1);else bird3(q.xs,q.Y+q.n*kp+fl,1/Math.max(s,.4)*.5,t+h.seed)}}
  if(fu>=0){const q=tr(108,-92,0,2),rr=R(h.seed+9);for(let i=0;i<7;i++){const a=-1.6+(rr()-.5)*2.3,dd=(16+rr()*84)*eout(fu),gv=(60+rr()*120)*fu*fu,sz=(1.6+rr()*3.2)*(1-fu)+.5;ell(q.xs+Math.cos(a)*dd,q.Y+q.n*kp+fl+Math.sin(a)*dd+gv,sz*.8,sz*1.2,'#eef3e0')}}
  if(o.puff>0&&o.puff<1){const u=o.puff,q=tr(266,-56,0,2),fx=Math.cos(th+hy);for(let i=0;i<8;i++){const dd=(20+i*9)*eout(u);g.save();g.globalAlpha=(1-u)*.8;ell(q.xs+fx*dd*.5+(i%4-1.5)*6,q.Y+q.n*kp+fl-dd*.9,5+u*7,4+u*5,'#f1f4e6');g.restore()}}
  if(jaw>.2&&jaw<1.05)for(let i=0;i<5;i++){const k=((t*1.5+i*.21)%1),q=tr(150+i*27,34,0,3);g.save();g.globalAlpha=clamp(jaw)*(1-k);ell(q.xs,q.Y+q.n*kp+fl+k*k*130,3,4,'#eef3e0');g.restore()}}
 else if(o.bub){const r=R(h.seed+5);for(let i=0;i<4;i++){const k=((t*.9+r())%1);g.save();g.globalAlpha=(1-k)*.7;g.strokeStyle='#e9eed8';g.lineWidth=2/s;g.beginPath();g.ellipse((60+r()*120)*cT,4,6+k*14,2+k*4,0,0,7);g.stroke();g.restore()}}
 g.restore()}
// 群れ（横の場面）。1頭ずつ：場所・大きさ・向き・形の種・浮き方・しぐさ
const POD=[{x:330,y:356,s:.2,yaw:235,seed:3,fl:52},{x:470,y:362,s:.24,yaw:55,seed:45,fl:40},{x:612,y:366,s:.27,yaw:160,seed:11,fl:26,yawn:5.0},{x:770,y:354,s:.19,yaw:290,seed:17,fl:50},{x:936,y:362,s:.25,yaw:60,seed:5,fl:34},{x:1096,y:374,s:.27,yaw:215,seed:55,fl:44},{x:1222,y:354,s:.2,yaw:120,seed:29,fl:46},
 {x:150,y:420,s:.46,yaw:150,seed:8,fl:36},{x:340,y:432,s:.5,yaw:35,seed:63,fl:46,move:9},{x:640,y:446,s:.56,yaw:78,seed:21,fl:36,sink:[.9,4.3]},{x:820,y:418,s:.48,yaw:12,seed:14,fl:22},{x:752,y:450,s:.26,yaw:20,seed:33,fl:12,calf:1},{x:1080,y:452,s:.54,yaw:318,seed:65,fl:32},
 {x:270,y:556,s:.98,yaw:0,side:1,seed:2,fl:30,yawn:1.5},{x:1050,y:580,s:1.0,yaw:146,seed:19,fl:36,turn:[3.0,5.6]},{x:600,y:676,s:.9,yaw:62,seed:37,fl:56}];
function podState(h,t,tl){let fl=h.fl,jaw=0,tilt=-.04,puff=0,hyaw=0,x=h.x,bub=0;const ev=[],E=(t0,xx,w)=>ev.push({age:tl-t0,x:xx,w});
 if(h.yawn!=null){jaw=yawnK(tl,h.yawn,3);E(h.yawn+.32,60,230);E(h.yawn+2.6,170,150)}
 if(h.sink){const [a,b]=h.sink;fl=lerp(fl,128,ease(tw(tl,a,1.3)));bub=tl>a+1.2&&tl<b;E(a+.3,60,170);if(tl>b){fl=lerp(128,h.fl-12,eout(tw(tl,b,.8)));fl=lerp(fl,h.fl,ease(tw(tl,b+.9,1.4)));puff=tw(tl,b+.55,.7);E(b,60,170);E(b+.9,60,150)}}
 if(h.calf){const k=ease(pulse(tl,2.2,3));fl=h.fl-k*14+Math.sin(tl*5)*2*k;tilt=-.1-k*.22;E(2.3,60,90);E(4.3,60,90)}
 if(h.turn){const k=ease(tw(tl,h.turn[0],1.1))-ease(tw(tl,h.turn[1],1.2));hyaw=-.3*k;tilt-=.1*k;fl-=6*k;E(h.turn[0]+.2,170,100);E(h.turn[1]+.2,170,100)}
 if(h.move){const mt=Math.min(tl,6);x+=h.move*mt;if(tl<6){fl+=Math.sin(tl*2.2)*3;for(let i=0;i<4;i++)E(Math.floor(tl/.8)*.8-i*.8,150,90)}}
 return{fl,jaw,tilt,puff,hyaw,x,bub,ev,hz:h.y<392?.42:h.y<500?.16:0}}
function podDraw(t,tl,pod=POD){for(const h of pod){const st=podState(h,t,tl),hh={...h,x:st.x,v:h.v||(h.v=hv(h.seed))};if(h.side){hh.dir=1;hpS(hh,t,st)}else hp3(hh,t,st)}}
// 骨（どの向きでも）。立った形 → 支えを失って崩れる（tc＝崩れはじめてからの秒。負なら立ったまま）
function bones3(x,y,s,yawDeg,tc,seed){const r0=R(seed+500),BL=.82+r0()*.36,NR=5+Math.floor(r0()*3),RL=.8+r0()*.4,SK=.86+r0()*.3,r=R(seed),th=yawDeg*Math.PI/180,cT=Math.cos(th),sT=Math.sin(th),kp=.2,c='#f7f0e1',GY=64,items=[];
 const pj=(X,Y,Z)=>[X*cT-Z*sT,Y+(X*sT+Z*cT)*kp,X*sT+Z*cT];
 const fall=d=>{const u=clamp((tc-d)/.42),af=tc-d-.42;return{u:u*u,b:af>0?Math.abs(Math.sin(af*13))*14*Math.exp(-af*5):0}};
 const mv=(A,B,f)=>[lerp(A[0],B[0],f.u),lerp(A[1],B[1],f.u)-f.b,lerp(A[2],B[2],f.u)];
 {const f=fall(.18),p1=mv([-205*BL,-82,0],[-215*BL,GY-4,-10],f),p2=mv([70,-84,0],[60,GY-4,14],f);items.push({n:(pj(...p1)[2]+pj(...p2)[2])/2,d:()=>{const a=pj(...p1),b=pj(...p2);line([[a[0],a[1]],[b[0],b[1]]],c,13);for(let j=0;j<=8;j++)ell(lerp(a[0],b[0],j/8),lerp(a[1],b[1],j/8)-(1-f.u)*7,5,6,c)}})}   // 背骨
 for(let i=0;i<NR;i++)for(const d of [-1,1]){const X=(-170+i*(215/(NR-1)))*BL,f=fall(r()*.3),sx=(r()-.5)*70,sz=d*(30+r()*50),w=(1-Math.abs(i/(NR-1)-.45)*.5)*RL,A=[[X,-78,0],[X,-62,d*72*w],[X,-78+58*w,d*52*w]],B=[[X+sx,GY,sz],[X+sx+20,GY,sz+d*30],[X+sx+50,GY,sz+d*36]],P3=A.map((q,k)=>mv(q,B[k],f));   // あばら（左右）
  items.push({n:pj(...P3[1])[2],d:()=>{const q=P3.map(p=>pj(...p));g.strokeStyle=c;g.lineWidth=8;g.lineCap='round';g.beginPath();g.moveTo(q[0][0],q[0][1]);g.quadraticCurveTo(q[1][0],q[1][1],q[2][0],q[2][1]);g.stroke()}})}
 for(const [X,Z] of [[-160*BL,44],[-150*BL,-44],[40,46],[50,-46]]){const f=fall(r()*.3),sx=(r()-.5)*60,ang=r()*6.28,A=[[X,-6,Z],[X,GY,Z]],B=[[X+sx,GY,Z],[X+sx+Math.cos(ang)*70,GY,Z+Math.sin(ang)*70]],P3=A.map((q,k)=>mv(q,B[k],f));   // あし
  items.push({n:pj(...P3[1])[2],d:()=>{const a=pj(...P3[0]),b=pj(...P3[1]);line([[a[0],a[1]],[b[0],b[1]]],c,15);ell(a[0],a[1],11,8,c);ell(b[0],b[1],11,8,c)}})}
 {const f=fall(.34),C0=mv([185,-56,0],[205,GY-24,10],f),e=f.u*.5,yw=th+e,cc=Math.cos(yw),sn=Math.sin(yw);   // 頭の骨と下あご
  const sk=(X,Y,Z)=>pj(C0[0]+X*Math.cos(e)-Z*Math.sin(e),C0[1]+Y,C0[2]+X*Math.sin(e)+Z*Math.cos(e));
  const E=(X,Y,Z,rx,ry,rz,col,pri)=>{const q=sk(X,Y,Z);items.push({n:q[2]+pri,d:()=>ell(q[0],q[1],Math.hypot(rx*cc,rz*sn),Math.hypot(ry,Math.hypot(rx*sn,rz*cc)*kp*.6),col)})};
  E(-10*SK,0,0,52*SK,34*SK,42*SK,c,0);E(58*SK,10,0,46*SK,24*SK,44*SK,c,0);for(const d of [-1,1]){E(-8*SK,-6,36*d*SK,13,12,6,'#b9a98c',1);E(86*SK,2,16*d,6,5,4,'#b9a98c',1)}
  const fj=fall(.1),J1=mv([120,-8,0],[90,GY,-30],fj),J2=mv([262,-4,0],[230,GY,-10],fj);items.push({n:pj(...J2)[2]-2,d:()=>{const a=pj(...J1),b=pj(...J2);line([[a[0],a[1]],[b[0],b[1]]],c,17);for(const k of [.86,.97]){const tx=lerp(a[0],b[0],k),ty=lerp(a[1],b[1],k);fill([[tx-6,ty,.3],[tx-1,ty-34*SK,.6],[tx+7,ty,.3]],c)}}})}
 items.sort((a,b)=>a.n-b.n);g.save();g.translate(x,y);g.scale(s,s);for(const it of items)it.d();g.restore()}
function podBones(t,tc,drain){POD.forEach((h,i)=>{const s=h.s*1.1,y=h.y+h.fl*h.s,drop=ease(drain)*240*h.s;g.save();if(drain<1){g.beginPath();g.rect(0,0,W,h.y+drop);g.clip()}
  if(h.s<.3)g.globalAlpha=.85;bones3(h.x,y,s,h.side?10:h.yaw,tc-((i*37)%10)*.035,40+i);g.restore()})}
function fg3(t,dry=0,kind=0){const sway=Math.sin(t*.9),m=(a)=>mix(a,'#6b4426',dry),k=1-dry*.9;blurOn(10);   // 手前のぼかした草（左右で形を変える）
 if(kind===0){for(const [x,hh,w,ln] of [[-10,330,60,40],[52,250,46,-14],[108,180,36,30]])blade(x,H+30,hh*k,w,(ln+sway*10)*k+dry*60,m('#1f3f35'));
  for(const [x,hh,ln] of [[1210,300,-30],[1262,380,-12]]){const tx=x+(ln+sway*12)*k,ty=H+30-hh*k;g.strokeStyle=m('#1f3f35');g.lineWidth=12;g.lineCap='round';g.beginPath();g.moveTo(x,H+30);g.quadraticCurveTo(x,H-hh*.5*k,tx,ty);g.stroke();g.save();g.translate(tx,ty);g.rotate(-.3+sway*.08);ell(0,-34*k,13,40*k,m('#2c4a3a'));g.restore()}}
 else{for(const [x,hh,w,ln] of [[1300,420,80,-70],[1240,280,50,-20],[1180,170,34,-34]])blade(x,H+30,hh,w,ln+sway*12,'#1f3f35');for(const [x,hh,w,ln] of [[-20,240,70,50],[60,150,40,10]])blade(x,H+30,hh,w,ln+sway*9,'#1f3f35')}
 blurOff()}
function side3(t,tl,st){const dead=st.dead,drain=st.drain||0,dry=st.dry||0,tc=st.tc==null?-9:st.tc;
 sideBack(t,dry);bed3(dry);if(drain<1)water3(332+ease(drain)*30,t,1-ease(drain));bank3(t,dry);
 if(!dead)podDraw(t,tl);else podBones(t,tc,drain);
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
const POD2=[{x:176,y:284,s:.2,yaw:20,seed:41,fl:50},{x:300,y:296,s:.3,yaw:340,seed:43,fl:28,yawn:.3},{x:968,y:338,s:.32,yaw:70,seed:67,fl:40,turn:[1.4,3.2]},{x:905,y:288,s:.23,yaw:200,seed:47,fl:36},{x:1096,y:304,s:.3,yaw:150,seed:53,fl:40},{x:186,y:356,s:.44,yaw:40,seed:59,fl:42,move:7},{x:1150,y:376,s:.46,yaw:250,seed:61,fl:50}];
function front3(t,tl){rect(0,0,W,H,IC.sky1);world3(t,234,{sunX:260,noBirds:1,trees:[[90,.9,251],[330,.6,252],[560,.8,253],[820,1.0,254],[1010,.6,255],[1200,.85,256]]});rect(0,242,W,10,'#b99b6c');
 water3(250,t,1,260);
 for(const h of POD2){const st=podState(h,t,tl);st.hz=h.s<.35?.4:.22;hp3({...h,x:st.x,v:h.v||(h.v=hv(h.seed))},t,st)}
 // 主役：目だけ出して見ている → ぬっと上がる → 耳をまわす → ゆっくり沈む
 const rz=u=>ease(tw(u,.9,1.0))-ease(tw(u,2.9,1.0))*.82,rise=rz(tl),mv=clamp(Math.abs(rz(tl+.06)-rz(tl-.06))*14+(tl>1.9&&tl<3?.5-Math.abs(tl-2.45)*.9:0)),wl=476,y0=lerp(596,424,rise),fu=(tl-2.05)/.75,ear=fu>0&&fu<1?Math.sin(fu*34)*(1-fu):pulse(tl,.45,.2)*.5;
 g.save();g.globalAlpha=.35;ell(640,wl+14,330,26,'#b9a876');g.restore();
 g.save();g.beginPath();g.rect(0,0,W,wl);g.ellipse(640,wl,lerp(150,262,clamp((wl-(y0-205))/330)),16,0,0,7);g.clip();face3(640,y0,1.25,t,{ear,blink:Math.max(pulse(tl,.6,.2),pulse(tl,3.3,.2))>.5,look:Math.sin(tl*1.2),nos:pulse(tl,1.5,.5)});
 if(fu>0&&fu<1){const rr=R(77);for(const d of [-1,1])for(let i=0;i<7;i++){const a=-1.57+d*.5+(rr()-.5)*2.2,dd=(24+rr()*130)*eout(fu),sz=(2+rr()*4.5)*(1-fu)+.8;ell(640+d*150+Math.cos(a)*dd,y0-220+Math.sin(a)*dd+(90+rr()*160)*fu*fu,sz*.8,sz*1.2,'#eef3e0')}}
 g.restore();
 for(let i=0;i<3;i++){const k=((t*.4+i/3)%1);g.save();g.globalAlpha=(1-k)*.8*mv;g.strokeStyle='#e9eed8';g.lineWidth=3;g.beginPath();g.ellipse(640,wl+6,240+k*340,7+k*40,0,0,7);g.stroke();g.restore()}

 fg3(t,0,1)}

// ─── D：真上。背中が岩のように並ぶ。1頭が水の底をけって進み、泥が舞いあがる ───
function hpTop3(x,y,s,ang,seed,t,o={}){const v=hv(seed),cb=mix(IC.hb,v.tn>0?'#93706a':'#615a5a',Math.abs(v.tn)*.6),cl=mix(cb,'#cdbfb6',.4),cd=mix(cb,'#2e2626',.4),L=v.L,Wd=.8+v.hu*.25,fu=flickU(t+seed,v.ft),ear=fu<0?0:Math.sin(fu*34)*(1-fu),up=o.up==null?1:o.up;
 g.save();g.translate(x,y);g.rotate(ang);g.scale(s,s);
 if(o.ring)for(let i=0;i<2;i++){const k=((t*.5+i/2+v.sx)%1);g.save();g.globalAlpha=(1-k)*.5;g.strokeStyle='#e9eed8';g.lineWidth=2/s;g.beginPath();g.ellipse(20,0,(230+k*120),(110+k*90)*Wd,0,0,7);g.stroke();g.restore()}
 g.save();g.globalAlpha=.28;fill([[-205*L,0,.9],[-170*L,-74*Wd,.9],[-40*L,-92*Wd,.9],[90,-74*Wd,.9],[280,0,.8],[90,74*Wd,.9],[-40*L,92*Wd,.9],[-170*L,74*Wd,.9]],'#3d4230');g.restore();   // 水の下の体（にごって、うっすらとしか見えない）
 const k=.78+.22*up;fill([[-170*L*k,0,.9],[-142*L*k,-56*Wd*k,.9],[-40*L,-70*Wd*k,.9],[66*k,-56*Wd*k,.9],[104*k,0,.8],[66*k,56*Wd*k,.9],[-40*L,70*Wd*k,.9],[-142*L*k,56*Wd*k,.9]],cb);
 fill([[-130*L*k,-4,.9],[-100*L*k,-30*Wd*k,.9],[-20*L,-36*Wd*k,.9],[50*k,-22*Wd*k,.8],[40*k,2,.8],[-40*L,8,.8]],cl);line([[-150*L*k,0],[60*k,0]],cd,2.5);
 for(let i=0;i<v.scar;i++){const xx=(-110+i*50)*L*k;line([[xx,20*Wd],[xx+22,30*Wd]],cl,2.5)}
 if(o.bird){g.save();g.translate(-60*L,(v.sx-.5)*40);g.scale(1/s*.5,1/s*.5);ell(0,0,16,9,'#6b5a45');ell(14,0,7,6,'#6b5a45');fill([[19,-3,.3],[30,0,.3],[19,3,.3]],'#d6452e');g.restore()}
 g.save();g.translate(96,0);g.rotate(o.head||0);g.translate(-96,0);
 for(const d of [-1,1]){g.save();g.translate(116,44*d);g.rotate(d*ear);ell(0,d*4,9,12,cb);ell(0,d*4,4,7,IC.hp);g.restore()}
 fill([[92,-38,.8],[150,-48,.8],[214,-44,.8],[256,-28,.9],[262,0,.9],[256,28,.9],[214,44,.8],[150,48,.8],[92,38,.8]],cb);fill([[186,-34,.8],[240,-22,.9],[246,0,.9],[240,22,.9],[186,34,.8],[176,0,.8]],cl);
 for(const d of [-1,1]){ell(150,36*d,13,11,cb);ell(151,37*d,9.5,7.5,mix(IC.hp,cb,.35));ell(153,38*d,3.4,3.2,IC.he);ell(154.4,38*d-1.4,1.2,1.2,'#fff');g.strokeStyle=cd;g.lineWidth=2.4;g.lineCap='round';g.beginPath();g.arc(150,36*d,11.5,d>0?.35:-2.2,d>0?2.2:-.35);g.stroke();
  ell(230,14*d,10,8,cl);g.save();g.translate(233,14*d);g.rotate(d*.5);ell(0,0,5.5,1.9,mix(cd,cb,.25));g.restore()}g.restore();
 if(fu>=0){const rr=R(seed+9);for(const d of [-1,1])for(let i=0;i<4;i++){const a=d*(.7+rr()*1.5),dd=(14+rr()*60)*eout(fu),sz=(1.4+rr()*2.4)*(1-fu)+.4;ell(116+Math.cos(a)*dd,44*d+Math.sin(a)*dd,sz,sz,'#eef3e0')}}
 g.restore()}
const PODT=[[640,250,.5,.15,101],[770,318,.56,.02,103,1],[575,352,.46,.3,107],[905,246,.44,-.25,109],[700,420,.52,-.1,113],[960,372,.5,.22,127],[830,468,.4,.4,131,1],[1040,300,.36,-.5,137],[512,244,.3,.5,139],[1085,452,.46,.05,149]];
function top3(t,tl){rect(0,0,W,H,'#7c8759');
 {const r=R(19);for(let i=0;i<22;i++){const x=r()*W,y=r()*H,w=120+r()*240,dx=Math.sin(t*.25+i)*26;g.save();g.globalAlpha=.1+.12*r();g.strokeStyle=i%3?'#a9a274':'#5f6844';g.lineWidth=10+r()*26;g.lineCap='round';g.beginPath();g.moveTo(x+dx,y);g.quadraticCurveTo(x+w*.5+dx,y+(r()-.5)*90,x+w+dx,y+(r()-.5)*40);g.stroke();g.restore()}}
 // 岸（左上）：芝・泥・通り道・足あと・草の株
 fill([[-40,-40,.3],[470,-40,.5],[410,70,.9],[230,150,.9],[70,170,.9],[-40,210,.5]],IC.mud);fill([[-40,-40,.3],[400,-40,.5],[330,36,.9],[170,92,.9],[-40,130,.5]],IC.lawn);
 fill([[150,-40,.5],[200,-40,.5],[300,112,.7],[250,140,.7]],IC.mudD);for(const [x,y] of [[262,96],[240,60],[284,130],[226,112],[210,30],[236,-6]])ell(x,y,7,5,'#756443');
 {const r=R(31);for(let i=0;i<7;i++){const x=40+r()*330,y=10+r()*90;for(let j=0;j<7;j++){const a=j*.9+r();poly([[x,y],[x+Math.cos(a)*(16+r()*10),y+Math.sin(a)*(16+r()*10)],[x+Math.cos(a+.5)*6,y+Math.sin(a+.5)*6]],j%2?'#4f8648':'#6fa75f')}}}
 // 歩く1頭：底をけるたびに背中が上がり、うしろに泥のけむり
 const wa=-.42,sp=tl*38,wx=250+Math.cos(wa)*sp,wy=640+Math.sin(wa)*sp,bn=Math.abs(Math.sin(tl*2.6));
 for(let i=0;i<7;i++){const age=tl-i*.6+((tl*1.0)%0.6)-.2;const tt=Math.floor(tl/.6)*.6-i*.6;if(tt<0)continue;const a2=tl-tt,px=250+Math.cos(wa)*tt*38-Math.cos(wa)*60,py=640+Math.sin(wa)*tt*38-Math.sin(wa)*60;g.save();g.globalAlpha=clamp(.5-a2*.11);ell(px,py,30+a2*26,20+a2*18,'#b3a577');ell(px+14,py+10,18+a2*18,12+a2*12,'#beb083');g.restore()}
 for(const [x,y,s,a,seed,b] of PODT){const mvk=seed%3===0?Math.sin(tl*1.3+seed):0;hpTop3(x+mvk*5*Math.cos(a),y+mvk*5*Math.sin(a),s,a,seed,t,{head:Math.sin(t*.6+seed)*.14,up:mvk?.8+.2*mvk:1,ring:mvk&&Math.abs(Math.cos(tl*1.3+seed))>.5})}
 
 hpTop3(wx,wy,.6,wa,151,t,{up:bn,head:Math.sin(tl*1.3)*.15,ring:1});
}

// ─── A（4版）：草むら。短く（約3秒）。大きな面＋まばらな株＋手前の黒っぽい草。奥へ寄ると、手前の草が左右に開く ───
function tuft(x,y,s,seed,c1,c2,t,o={}){const r=R(seed),n=5+Math.floor(r()*4),wind=Math.sin(t*1.6-x*.006)*.1+(o.lean||0),B=[];
 for(let i=0;i<n;i++){const a=((i+.5)/n-.5)*1.5+(r()-.5)*.25;B.push({a,len:s*(62+44*r())*(1-Math.abs(a)*.38),w:s*(7+5*r()),bx:(i-n/2)*4.5*s,c:i%2?c1:c2,hd:o.head&&r()>.55})}
 B.sort((p,q)=>Math.abs(q.a)-Math.abs(p.a));
 for(const b of B){const a=b.a+wind*(1+Math.abs(b.a)),bend=b.a*.9+wind*1.5,tx=x+b.bx+Math.sin(a)*b.len+bend*b.len*.35,ty=y-Math.cos(a)*b.len*(1-Math.abs(bend)*.18),c1x=x+b.bx+Math.sin(a)*b.len*.25,c1y=y-b.len*.62;
  g.fillStyle=b.c;g.beginPath();g.moveTo(x+b.bx-b.w/2,y);g.quadraticCurveTo(c1x-b.w*.4,c1y,tx,ty);g.quadraticCurveTo(c1x+b.w*.6,c1y+b.len*.08,x+b.bx+b.w/2,y);g.closePath();g.fill();
  if(b.hd){g.save();g.translate(tx,ty);g.rotate(bend*.9);ell(0,-s*7,s*3.2,s*10,o.headCol||'#ead9a0');g.restore()}}}
function band(top,yb,c0,c1){const ys=top.map(p=>p[1]),gr=g.createLinearGradient(0,Math.min(...ys),0,yb);gr.addColorStop(0,c0);gr.addColorStop(1,c1);g.fillStyle=gr;g.beginPath();g.moveTo(top[0][0],yb);g.lineTo(top[0][0],top[0][1]);
 for(let i=1;i<top.length-1;i++){const mx=(top[i][0]+top[i+1][0])/2,my=(top[i][1]+top[i+1][1])/2;g.quadraticCurveTo(top[i][0],top[i][1],mx,my)}const e=top[top.length-1];g.lineTo(e[0],e[1]);g.lineTo(e[0],yb);g.closePath();g.fill()}
function canopy(x,y,s,seed){const r=R(seed),n=2+Math.floor(r()*3),w=(30+r()*26)*s;poly([[x-3*s,y],[x-2*s,y-26*s],[x+3*s,y-26*s],[x+4*s,y]],'#3f5a4a');for(let i=0;i<n;i++)ell(x+(i-(n-1)/2)*w*.7,y-(30+r()*16)*s,w*(.6+r()*.3),(18+r()*10)*s,'#2f7566');ell(x+w*.2,y-(44+r()*8)*s,w*.5,12*s,'#4a9a7c')}
function dashes(x,y,s,col){return;for(let i=0;i<2;i++){g.strokeStyle=col;g.lineWidth=3.2*s;g.lineCap='round';g.beginPath();g.moveTo(x+i*13*s,y);g.lineTo(x+i*13*s+7*s,y);g.stroke()}}
function grass4(t){const F=[700,324],push=ease(tw(t,0,2.4))*.42+Math.pow(tw(t,1.75,1.05),2)*1.2;
 const Ly=(p,fn)=>{const z=1+push*p;g.save();g.translate(F[0],F[1]);g.scale(z,z);g.translate(-F[0],-F[1]);fn();g.restore()};
 world3(t,300,{L:Ly,sunX:990,trees:[[120,.8,261],[210,.5,262],[420,.44,263],[930,.72,264],[1020,.46,265],[1230,.9,266]]});
 Ly(.09,()=>{const gr=g.createLinearGradient(0,304,0,336);gr.addColorStop(0,'#e8f8f4');gr.addColorStop(1,'#a9dbe0');g.fillStyle=gr;g.fillRect(-300,304,1900,34);for(let i=0;i<14;i++){const k=(Math.sin(t*4+i*2.1)+1)/2;rect(F[0]-150+i*22+Math.sin(i*5)*9,310+((i*37)%18),12+k*10,1.6,`rgba(255,255,255,${.35+.6*k})`)}});
 Ly(.16,()=>{band([[-300,316],[-100,312],[260,310],[520,316],[640,336],[760,337],[880,318],[1120,308],[1500,314],[1500,314]],470,'#cfe487','#a3cd62');for(const [x,y,sc,sd] of [[330,326,.34,11],[980,322,.3,12],[1220,326,.36,13],[90,330,.3,14]])tuft(x,y,sc,sd,'#8fc058','#b7d874',t)});
 Ly(.32,()=>{band([[-300,372],[-60,366],[240,380],[520,372],[800,384],[1060,368],[1500,380],[1500,380]],560,'#b3d868','#7fb650');
  for(const [x,y,sc,sd,hd] of [[150,392,.6,21,1],[214,400,.42,22,0],[900,388,.5,23,0],[1140,392,.66,24,1],[1196,402,.4,25,0],[520,384,.36,26,0]])tuft(x,y,sc,sd,'#6fae4c','#9dcd62',t,{head:hd})});
 Ly(.62,()=>{band([[-400,470],[-80,452],[260,486],[560,500],[860,492],[1120,462],[1600,474],[1600,474]],900,'#8cc255','#4f9647');
  for(const [x,y,c] of [[330,540,'#fff7d6'],[352,556,'#ffe27a'],[980,532,'#fff7d6'],[1004,548,'#fff7d6'],[1090,560,'#ffe27a'],[236,566,'#fff7d6']])ell(x,y,4,4,c);
  for(const [x,y,sc,sd,hd] of [[90,488,1.1,31,1],[188,502,.7,32,0],[1030,486,.9,33,1],[1206,480,1.2,34,1],[1120,500,.6,35,0],[430,506,.6,36,0]])tuft(x,y,sc,sd,'#3f8a45','#6fb24e',t,{head:hd})});
 {const r=R(7);for(let i=0;i<12;i++){const x=(r()*W+t*(14+r()*20))%W,y=180+r()*330+Math.sin(t*1.4+i)*10;g.save();g.globalAlpha=.5+.4*r();ell(x,y,1.6+r()*2,1.6+r()*2,'#fffbe0');g.restore()}}
 {const k=.25+.75*Math.max(pulse(t,.5,.5),pulse(t,1.25,.45))+ease(tw(t,1.7,.6))*1.6;star(F[0],F[1]-2,7+10*k,.4+k)}
 Ly(1.5,()=>{blurOn(5);tuft(40,790,6.2,41,'#18433b','#245a45',t,{lean:-.12});tuft(330,800,4.2,42,'#1c4a40','#2b6349',t,{lean:-.05,head:1,headCol:'#3f7a55'});tuft(1130,800,5.0,43,'#18433b','#245a45',t,{lean:.1});tuft(1290,780,6.4,44,'#1c4a40','#2b6349',t,{lean:.16});blurOff()});
 Ly(3.2,()=>{blurOn(16);tuft(-60,900,10,51,'#123a35','#123a35',t,{lean:-.2});tuft(1360,900,11,52,'#123a35','#123a35',t,{lean:.22});blurOff()});
 {const k=ease(tw(t,1.95,.75));if(k>0){const rr=40+1900*k,gr=g.createRadialGradient(F[0],F[1],0,F[0],F[1],rr);gr.addColorStop(0,'rgba(255,253,240,1)');gr.addColorStop(.45,`rgba(255,253,240,${.6+.4*k})`);gr.addColorStop(1,'rgba(255,253,240,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);g.save();g.globalAlpha=tw(t,2.45,.3);rect(0,0,W,H,'#fffdf0');g.restore()}}}
// ─── 遠くの世界（空・雲・丘・木）を、奥行きの層に分けて描く。草むら・横・正面で共通。o.L＝層ごとの寄り（草むらで使う）、o.dry＝0 緑 → 1 砂漠 ───
function wisp(x,y,s,seed,a=1,dir=1){const r=R(seed);g.save();g.translate(x,y);g.scale(dir,1);g.globalAlpha=a;   // 雲：大きく・うすく・ななめに流れる。やわらかい土台＋上側のもこもこ＋下へ流れるすじ
 blurOn(11*s);for(let i=0;i<9;i++){const u=i/8,cx=(u-.5)*430*s+(r()-.5)*40*s,cy=-(u-.5)*120*s+(r()-.5)*36*s;g.save();g.translate(cx,cy);g.rotate(-.28);ell(0,0,(64+r()*70)*s,(20+r()*22)*s,'rgba(255,255,255,.5)');g.restore()}
 for(let i=0;i<4;i++){const cx=(-230+r()*200)*s,cy=(40+r()*50)*s;g.save();g.translate(cx,cy);g.rotate(-.42);ell(0,0,(90+r()*80)*s,(7+r()*8)*s,'rgba(255,255,255,.28)');g.restore()}
 blurOn(3*s);for(let i=0;i<8;i++){const u=(i+r()*.6)/8,cx=(u-.5)*380*s,cy=-(u-.5)*110*s-(14+r()*18)*s;ell(cx,cy,(24+r()*32)*s,(13+r()*13)*s,'rgba(255,255,255,.55)')}blurOff();g.restore()}
function tree4(x,y,s,seed,o={}){const r=R(seed),ty=r(),pale=o.pale||0,dry=o.dry||0,z=c=>mix(mix(c,'#a9cdbf',pale),'#b08a4a',dry),c1=z('#2f6f5c'),c2=z('#4c9070'),c3=z('#6fae7c'),tk=z('#4a4034'),lean=(r()-.5)*24*s;
 if(!o.noShadow){g.save();g.globalAlpha=.16*(1-pale);ell(x+10*s,y+2*s,(44+r()*20)*s,6*s,'#1f3f35');g.restore()}
 if(ty<.5){const h=(54+r()*40)*s,w=(48+r()*34)*s;line([[x,y],[x+lean*.4,y-h*.55],[x+lean,y-h]],tk,5*s);line([[x+lean*.4,y-h*.55],[x+lean+w*.5,y-h*.96]],tk,3*s);line([[x+lean*.3,y-h*.45],[x+lean-w*.55,y-h*.9]],tk,3*s);   // かさ形（枝分かれした幹に、平たい葉の層）
  for(const [dx,dy,ww,c] of [[-w*.5,-h*.9,w*.55,c1],[w*.5,-h*.98,w*.6,c1],[0,-h*1.06,w*.85,c1],[-w*.3,-h*1.0,w*.4,c2],[w*.25,-h*1.14,w*.55,c2],[w*.3,-h*1.2,w*.28,c3]])fill([[x+lean+dx-ww,y+dy+4*s,.9],[x+lean+dx-ww*.5,y+dy-9*s,.9],[x+lean+dx+ww*.5,y+dy-10*s,.9],[x+lean+dx+ww,y+dy+4*s,.9]],c)}
 else if(ty<.8){const h=(34+r()*30)*s,w=(26+r()*20)*s;line([[x,y],[x+lean*.5,y-h]],tk,5*s);for(const [dx,dy,rr,c] of [[-w*.6,-h-4*s,w*.75,c1],[w*.6,-h-8*s,w*.8,c1],[0,-h-22*s,w*.9,c1],[w*.2,-h-26*s,w*.6,c2],[w*.4,-h-34*s,w*.32,c3]])ell(x+lean*.5+dx,y+dy,rr,rr*.82,c)}   // 丸い木
 else{const w=(30+r()*26)*s;for(const [dx,rr,c] of [[-w*.5,w*.55,c1],[w*.4,w*.6,c1],[0,w*.7,c1],[w*.15,w*.42,c2]])ell(x+dx,y-rr*.55,rr,rr*.62,c)}}   // しげみ
function world3(t,yh,o={}){const dry=o.dry||0,L=o.L||((p,fn)=>fn()),m=(a,b)=>mix(a,b,dry),sx=o.sunX||1010,sy=yh-200,k=1-dry;
 L(.02,()=>{rect(-600,-600,W+1200,600+yh+40,m('#7cc8e4','#f3dcae'));const gr=g.createLinearGradient(0,0,0,yh+10);gr.addColorStop(0,m('#74c2e2','#f3dcae'));gr.addColorStop(.7,m('#bfe4e6','#f6e3ba'));gr.addColorStop(1,m('#e8f5df','#f4dfb2'));g.fillStyle=gr;g.fillRect(-600,0,W+1200,yh+10);
  const gl=g.createRadialGradient(sx,sy,0,sx,sy,340);gl.addColorStop(0,'rgba(255,248,214,.9)');gl.addColorStop(1,'rgba(255,246,205,0)');g.fillStyle=gl;g.fillRect(-600,-200,W+1200,yh+240);ell(sx,sy,27,27,'#fffef4')});
 L(.04,()=>band([[-400,yh],[-150,yh-22],[120,yh-46],[380,yh-26],[640,yh-36],[900,yh-58],[1150,yh-30],[1420,yh-40],[1700,yh-10],[1700,yh]],yh+40,m('#b9d8cf','#e6c690'),m('#cfe6d8','#e9cf9c')));
 L(.05,()=>{for(const [x,y,s,sd,v,d] of [[230,yh-150,.78,211,5,1],[1090,yh-176,.86,212,4,1],[690,yh-262,.36,213,7,1]])wisp(x+t*v,y,s,sd,k,d);if(dry<.3&&!o.noBirds)birds(t,yh-150,6,20)});
 L(.06,()=>{band([[-400,yh+2],[-100,yh-10],[200,yh-34],[470,yh-12],[700,yh-4],[940,yh-30],[1200,yh-16],[1500,yh-4],[1700,yh+2],[1700,yh+2]],yh+40,m('#93c0a8','#d9ad6c'),m('#b3d6b6','#e0bb80'));
  const r=R(203);for(let i=0;i<16;i++){const x=-80+i*96+r()*60,y=yh-4-18*Math.max(0,Math.sin((x-40)/150))*(.4+r()*.5);if(k>.1)tree4(x,y,(.2+r()*.14)*k,220+i,{pale:.55,dry,noShadow:1})}});   // 遠い木の列（小さく・うすく）
 L(.08,()=>{band([[-400,yh+6],[-60,yh-2],[260,yh+2],[560,yh+8],[860,yh+2],[1160,yh-4],[1500,yh+4],[1700,yh+8],[1700,yh+8]],yh+40,m('#86b77e','#cf9a58'),m('#a6cf86','#d9a45c'));
  for(const [x,sc,sd] of (o.trees||[[70,.62,241],[200,.4,242],[452,.5,243],[905,.66,244],[1010,.42,245],[1235,.74,246]]))if(k>.1)tree4(x,yh+4,sc*k,sd,{pale:.22,dry})});   // 中くらいの木
 {const gr=g.createLinearGradient(0,yh-50,0,yh+12);gr.addColorStop(0,'rgba(240,248,232,0)');gr.addColorStop(1,`rgba(240,248,232,${(.5*k).toFixed(2)})`);g.fillStyle=gr;g.fillRect(-600,yh-50,W+1200,62)}   // 地平線のかすみ
}
function antl(x,y,s,seed){const r=R(seed),c='#b58d5c',d='#8d6a40',dn=r()>.4;g.save();g.translate(x,y);g.scale(s*(r()>.5?1:-1),s);for(const lx of [-14,-9,10,15])line([[lx,-20],[lx+(r()-.5)*3,0]],d,3);ell(0,-26,20,10,c);   // 水を飲みに来たレイヨウ（遠くに小さく）
 const hx=dn?30:26,hy=dn?-8:-48;line([[16,-28],[hx-4,hy]],c,7);ell(hx,hy,7,4.5,c);line([[hx-3,hy-3],[hx-12,hy-22]],'#5d4a34',1.6);line([[hx-1,hy-3],[hx-7,hy-23]],'#5d4a34',1.6);fill([[-20,-28,.4],[-25,-20,.4],[-20,-22,.4]],d);g.restore()}
// ─── U：水の中から。深さは2mほど（立てば背中のすぐ上が水面）。カバは底をけって、ゆっくりはねるように進む。まわりの魚は、カバの皮ふをつつく魚（ラベオのなかま）を手本にした ───
function fishL(x,y,s,dir,wag,col='#5f6a4a',fat=1){g.save();g.translate(x,y);g.scale(s*dir,s*fat);const c2=mix(col,'#d9d7a6',.45);poly([[-20,0],[-34,-10+wag],[-30,wag*.4],[-34,10+wag]],col);   // 細長い体・ふたまたの尾・背びれ・下向きの口
 fill([[-22,0,.6],[-6,-8,.9],[14,-7,.9],[25,0,.5],[14,6,.9],[-6,7,.9]],col);fill([[-18,2,.6],[0,3,.8],[18,3,.7],[12,6,.9],[-6,7,.9]],c2);poly([[-4,-7],[4,-15],[10,-7]],col);poly([[4,5],[8,11],[11,5]],col);ell(17,-2,2,2,'#1b1b16');g.restore()}
const kf=(u,K)=>{for(let i=0;i<K.length-1;i++)if(u<=K[i+1][0])return lerp(K[i][1],K[i+1][1],ease((u-K[i][0])/(K[i+1][0]-K[i][0])));return K[K.length-1][1]};
function under3(t,tl){const v=92,sc=tl*v,SY=250,BY=612,MK='#8a9460';
 {const gr=g.createLinearGradient(0,SY,0,H);gr.addColorStop(0,'#c3c888');gr.addColorStop(.35,'#939f66');gr.addColorStop(1,'#59643f');g.fillStyle=gr;g.fillRect(-200,-200,W+400,H+400)}
 // 水面より上：明るい空がゆがんで見える
 {const gr=g.createLinearGradient(0,0,0,SY);gr.addColorStop(0,'#d5ecf0');gr.addColorStop(1,'#e9f3d6');g.fillStyle=gr;g.beginPath();g.moveTo(-200,-200);g.lineTo(-200,SY);for(let x=-200;x<=W+200;x+=10)g.lineTo(x,SY+Math.sin(x*.018+t*1.8)*7+Math.sin(x*.05-t*2.6)*3);g.lineTo(W+200,-200);g.closePath();g.fill()}
 for(let i=0;i<7;i++){const k=(Math.sin(t*1.7+i*1.9)+1)/2,x=((i*230-sc*.3)%1600+1600)%1600-150;g.save();g.globalAlpha=.25+.35*k;g.fillStyle='#fbfbdc';g.beginPath();g.ellipse(x,SY-16-(i%3)*22,70+k*40,7,0,0,7);g.fill();g.restore()}
 for(let i=0;i<6;i++){const x0=((i*260-sc*.15)%1560+1560)%1560-140,w=50+((i*53)%60);g.save();g.globalAlpha=.08+.04*Math.sin(t*1.3+i);poly([[x0,SY],[x0+w,SY],[x0+w-170,720],[x0-250,720]],'#f6f4c4');g.restore()}
 // 底
 fill([[-200,BY,.3],[200,BY-12,.8],[620,BY+4,.8],[1000,BY-10,.8],[1480,BY+2,.3],[1480,900,.2],[-200,900,.2]],'#5f603f');fill([[-200,650,.3],[400,640,.8],[900,660,.8],[1480,646,.3],[1480,900,.2],[-200,900,.2]],'#505337');
 // なかまのカバ：底に立っている全身を、にごりでかすませて描く（1頭ずつ向き・大きさ・あしの位置がちがう）。水面より上は見えない
 g.save();g.beginPath();g.rect(-400,SY+6,W+800,H);g.clip();
 for(const [bx,by,s,yaw,seed,hz,lg] of [[150,596,.44,30,81,.7,[.1,-.15,.2,-.1]],[1120,600,.52,205,83,.6,[0,0,.05,-.05]],[1250,604,.3,190,87,.6,[.2,-.1,-.2,.1]]]){const x=bx-sc*.1;hp3({x,y:by-119*s,s,yaw,seed,v:hv(seed)},t,{full:1,fl:0,hz,hzc:MK,legs:lg,tilt:-.18})}
 g.restore();
 {const r=R(61);for(let i=0;i<16;i++){const wx=r()*2600,x=((wx-sc)%2600+2600)%2600-200,y=BY+10+r()*70,k=r();if(k<.4)ell(x,y,10+r()*16,5+r()*5,'#44472f');else if(k<.7){for(let j=0;j<3;j++)blade(x+j*9,y,40+r()*50,9,Math.sin(t*1.2+i+j)*10-14,'#667f48')}else line([[x,y],[x+40+r()*40,y-2]],'#6a6d4e',3)}}
 {const r=R(63);for(let i=0;i<40;i++){const x=((r()*1500-sc*(.4+r()*.8))%1500+1500)%1500-100,y=SY+20+r()*340+Math.sin(t+i)*6;g.save();g.globalAlpha=.25+.3*r();ell(x,y,1.5+r()*2.5,1.5+r()*2.5,'#ecebbd');g.restore()}}
 // 主役：けって浮く → ふわっと下りる。最後は大きくけって、鼻を水面に出して息つぎ
 const T=1.9,G=474,HY=u=>{const c=((u/T)%1+1)%1,up=ease(tw(u,2.85,.65));return G-(c>.14&&c<.86?Math.sin((c-.14)/.72*Math.PI)*38:0)*(1-up)-up*118},c=(tl/T)%1,p=tl*3.1,up=ease(tw(tl,2.85,.65)),hx=590+Math.sin(tl*.9)*20,hy=HY(tl),hop=G-hy,
  ff=lerp(kf(c,[[0,.5],[.2,-.6],[.32,-.95],[.74,-.95],[1,.5]]),-.5,up),fh=lerp(kf(c,[[0,.1],[.2,-1.0],[.32,-1.35],[.76,-1.3],[1,.1]]),-.9,up);
 for(let k=0;k<5;k++){const tk=(Math.floor(tl/T)-k)*T+.16*T;if(tk<0)continue;const age=tl-tk,px=hx-190-age*v;if(age<0||age>1.8)continue;g.save();g.globalAlpha=clamp(.7-age*.4);ell(px,BY-2-age*6,22+age*44,7+age*9,'#8f8a5c');ell(px+26,BY+2-age*3,14+age*30,5+age*6,'#9c9768');g.restore()}
 g.save();g.globalAlpha=.3;ell(hx+10,BY+2,250-hop*1.2,17-hop*.1,'#33361f');g.restore();
 // 魚：それぞれ自分で動く。群れは奥を通りすぎ、底の2匹は泥をつつき、4匹はカバの体に寄ってはつつき、ときどき離れる（カバの上下にはすぐには付いていかない）
 {const r=R(65);for(let i=0;i<7;i++){const x=((r()*1700-sc*.55+tl*(30+r()*30))%1700+1700)%1700-200,y=330+r()*130+Math.sin(tl*1.3+i*2)*12;fishL(x,y,.42+r()*.4,i%4==3?-1:1,Math.sin(tl*11+i*2)*4,mix(i%2?'#5f6a4a':'#6f6a4f',MK,.4+r()*.2),.8+r()*.5)}
  for(const [bx,ph] of [[380,0],[960,2]]){const x=((bx-sc*.9)%1700+1700)%1700-200,pk=Math.sin(tl*6+ph)*5;g.save();g.translate(x,BY-14+pk);g.rotate(.7);fishL(0,0,.8,1,Math.sin(tl*9+ph)*3);g.restore()}
  [[-200,6,.95,0],[-70,78,.7,1.3],[50,74,.8,2.6],[-130,-74,.6,3.9]].forEach(([ax,ay,fs,ph],i)=>{const hl=HY(tl-.45-i*.1),away=Math.pow(Math.max(0,Math.sin(tl*1.5+ph)),6),nib=Math.sin(tl*9+ph)*4*(1-away),x=hx+ax*1.12-away*(70+i*12)+nib,y=lerp(G,hl,.6)+ay*1.12-22+away*(34-i*22)+Math.sin(tl*2.3+ph)*5;fishL(x,y,fs,i==2?-1:1,Math.sin(tl*13+ph)*4,['#5f6a4a','#6b6448','#566a52','#6f6a4f'][i],.8+i*.13)})}
 hp3({x:hx,y:hy,s:1.12,yaw:16,seed:21,v:hv(21)},t,{full:1,fl:0,tilt:-.05-.05*Math.sin(c*6.283)*(1-up)-.34*up,legs:[fh,fh+.12,ff,ff+.14]});
 if(up>.9){const a=tl-3.44;for(let j=0;j<2;j++){const k=(a-j*.12)/.5;if(k>0&&k<1){g.save();g.globalAlpha=(1-k)*.8;g.strokeStyle='#fdfde6';g.lineWidth=3;g.beginPath();g.ellipse(hx+272,SY+2,30+k*120,3+k*7,0,0,7);g.stroke();g.restore()}}}   // 鼻が水面を割る
 else{const u=(tl%1.5)/1.5;for(let i=0;i<4;i++){const k=(u+i*.25)%1,by=hy-70-k*(hy-70-SY);g.save();g.globalAlpha=(1-k)*.7;g.strokeStyle='#f3f5d4';g.lineWidth=2;g.beginPath();g.arc(hx+290+Math.sin(k*9+i)*8,by,3+i%3*2+k*3,0,7);g.stroke();g.restore()}}
 g.save();g.globalAlpha=.14;rect(-200,SY,W+400,H+400,MK);g.restore();
 {const gr=g.createRadialGradient(640,380,320,640,380,840);gr.addColorStop(0,'rgba(40,48,30,0)');gr.addColorStop(1,'rgba(40,48,30,.45)');g.fillStyle=gr;g.fillRect(-200,-200,W+400,H+400)}}
// ─── 通し（4版）───
SC.intro4=function(t){const TA=2.8,TB=10.4,TC=14.2,TU=17.2,TD=20.8,TX=23.2;
 if(t<TA)grass4(t);
 else if(t<TB){const tl=t-TA,z=1.16-.1*eout(tw(tl,0,1.6))+.03*ease(tw(tl,1.6,6));g.translate(600,440);g.scale(z,z);g.translate(-600,-440);side3(t,tl,{dead:false});
  if(tl<.8){g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1-ease(tw(tl,0,.8));rect(0,0,W,H,'#fffdf0');g.restore()}}
 else if(t<TC){const tl=t-TB,z=1.02+.04*ease(tw(tl,0,3.8));g.translate(640,430);g.scale(z,z);g.translate(-640,-430);front3(t,tl)}
 else if(t<TU){const tl=t-TC,z=1.1-.07*ease(tw(tl,0,3.4));g.translate(640,360);g.scale(z,z);g.rotate(-.02+.02*tl/3.4);g.translate(-640,-360);top3(t,tl)}
 else if(t<TD){const tl=t-TU,z=1.06-.04*ease(tw(tl,0,3.6));g.translate(640,400);g.scale(z,z);g.translate(-640,-400);under3(t,tl)}
 else{const tl=t-TD,td=t-TX,dead=td>=0,drain=dead?1:0,dry=dead?1:0,tc=td-1.0;
  const z=1.05+.04*clamp(tl/2.4)-.07*ease(tw(td,.1,1.2))+.05*tw(td,1.2,4.6);g.translate(600,450);g.scale(z,z);g.translate(-600,-450);
  side3(t,7.6+tl,{dead,drain,dry,tc,td});
  if(dead&&td<.14){g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1-td/.14;rect(0,0,W,H,'#fff');g.restore()}
  if(td>1.8){const k=ease(tw(td,1.8,1.6));blurOn(9);fill([[-60,760,.2],[-60,430+300*(1-k),.6],[240,470+300*(1-k),.9],[520,640+200*(1-k),.8],[600,760,.2]],C.sandN);fill([[1340,760,.2],[1340,560+260*(1-k),.6],[1100,640+200*(1-k),.9],[980,760,.2]],C.sandN);blurOff();
   g.save();g.globalAlpha=k*.9;for(let i=0;i<5;i++){const x=((t*60+i*260)%1500)-120;line([[x,650+i*12],[x+90,646+i*12]],'#f0cf93',3)}g.restore()}}};
SC.turn3=function(t){rect(0,0,W,H,'#cfd8c4');for(const [y] of [[230],[470],[700]])rect(0,y,W,60,IC.wNear);   // 向きの見本
 [0,45,90,135,180].forEach((a,i)=>hp3({x:140+i*250,y:230,s:.5,yaw:a,seed:2},t,{fl:8}));[225,270,315,30,60].forEach((a,i)=>hp3({x:140+i*250,y:470,s:.5,yaw:a,seed:19},t,{fl:34}));
 [[14,1],[60,1],[110,.6],[90,1],[300,0]].forEach(([a,j],i)=>hp3({x:150+i*250,y:700,s:.5,yaw:a,seed:8+i},t,{fl:i===4?56:0,jaw:j}))};
SC.gape3=function(t){rect(0,0,W,H,'#cfd8c4');rect(0,300,W,60,IC.wNear);rect(0,620,W,100,IC.wNear);
 hpS({x:300,y:300,s:1,dir:1,seed:2},t,{fl:-40,jaw:1});hpS({x:980,y:300,s:1,dir:-1,seed:19},t,{fl:-10,jaw:.5});hpS({x:300,y:620,s:.9,dir:1,seed:8},t,{fl:30});hpS({x:760,y:620,s:.9,dir:1,seed:37},t,{fl:58});hpS({x:1120,y:620,s:.5,dir:-1,seed:33},t,{fl:10})};
