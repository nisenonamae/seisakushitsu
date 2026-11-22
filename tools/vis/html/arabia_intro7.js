// 緑のアラビア：序の7版（2026-11-22）。arabia.html から arabia_intro.js のあとに読む。
// 作り手の指摘（6版）：
//  ・鳴き方を本物のカバのように … ウィーズ（高い音がふくらむ）→ 低いホンクを数回（喉から出る笑い声のよう）。体を水から乗り出す。群れは合唱のように鳴く
//  ・水の中へは「場面の切り替え」でなく、カメラを沈める … カメラが下がると、見下ろしていた水面がだんだん水平になって1本の線に縮む
//    （遠近）→ その高さから、景色（空・岸・群れ）が上へ流れていき、カメラが水の中へ入る
//  ・水の中の動きが機械的 … けって → のびてすべる → あしを戻して着く、の1歩ずつ。体の傾き・頭のゆれ・着くたびの泥。子は小さく速い歩みで母の横に
//  ・浮かぶのが「ただの移動」… かがむ → 後ろあしで底をける → 鼻を上に体を傾け、あしは後ろへ流れる → 速く上がって水面の手前でゆるむ → 鼻が先に出て息をふき出す
//  ・群れに合流する話が消えていた … 群れが母に向き直る → 1頭が寄ってくる → 子と鼻を合わせる → 子は母のうしろへ → みんなで鳴く → 身を寄せて休む → 引いて、その場で骨に
//  ・背景が使い回し … 世界を横に広く（群れのいる右側は別の景色）。水の底も場所ごとにちがう物（草・石・沈んだ木・踏みならされた泥）
(function(){
const SURF=338,FLOOR=880;
// ─ 鳴く（ウィーズホンク）。u＝鳴きはじめからの秒 ─
function honk(u,D){D=D||5.6;if(u<0||u>D)return null;
 const lean=ease(clamp((u-.25)/1.1))*(1-ease(clamp((u-(D-1.2))/1.2)));          // 体を水から乗り出す
 const wz=u>=1.0&&u<2.3?ease(clamp((u-1.0)/.9)):0;                                // ウィーズ：口をゆっくり開けて、ふくらむ
 const hs=2.3,he=D-1.2,hp=.5;let hk=0;if(u>=hs&&u<he){const k=((u-hs)%hp)/hp;hk=Math.exp(-k*5.5)}   // ホンク：0.5秒ごと。笑うように頭が小さくゆれる
 const inh=u<1.0?Math.sin(clamp(u/1.0)*Math.PI):0;                                // 鳴く前に息を吸う（鼻の穴がひらく）
 return{jaw:clamp(.05*lean+.1*wz+(u>=hs&&u<he?.05+.1*hk:0),0,.22),tilt:-.16*lean-.05*wz+(u>=hs&&u<he?.06*hk:0),fl:-12*lean+(u>=hs&&u<he?5*hk:0),lean:.09*lean+.02*hk,hk,inh,honkAt:u>=hs&&u<he?Math.floor((u-hs)/hp):-1}}
function honkRings(h0,u,D,out){if(u<0)return;D=D||5.6;out.push({age:u-1.0,x:180,w:140});for(let j=0;j<8;j++){const a=u-(2.3+j*.5);if(2.3+j*.5<D-1.2)out.push({age:a,x:200,w:90})}}
// ─ 水の中の歩み：1歩＝けって → のびてすべる → あしを戻して着く ─
function gait(tl,T,stride){const n=Math.floor(tl/T),c=((tl/T)%1+1)%1,adv=(n+.55*eout(clamp((c-.06)/.7))+.45*c)*stride;   /* けった直後に強く進み、すべる間もゆっくり進み続ける（止まって見えた・7版挑戦の番） */
 return{c,adv,hop:Math.sin(Math.PI*clamp((c-.1)/.72))*1,pitch:kf(c,[[0,.05],[.12,-.13],[.45,-.05],[.82,.07],[1,.05]]),
  ff:kf(c,[[0,.5],[.2,-.6],[.32,-.95],[.74,-.95],[1,.5]]),fh:kf(c,[[0,.1],[.2,-1.0],[.32,-1.35],[.76,-1.3],[1,.1]]),touch:c>.9||c<.04,n}}
// ─ 世界：左（母子）と右（群れ）で景色をかえる ─
const TREES_A=[[70,.62,241],[200,.4,242],[452,.5,243],[905,.66,244],[1010,.42,245],[1235,.74,246]],TREES_B=[[90,.5,261],[300,.82,262],[520,.36,263],[760,.6,264],[980,.9,265],[1180,.44,266]];
function sky7(dry){rect(-2000,-2000,7000,2000+SURF+60,mix('#dcebe6','#f4dfb2',dry))}
function panel(t,px,B,dry){g.save();g.translate(px,0);if(B){g.translate(W/2,0);g.scale(-1,1);g.translate(-W/2,0)}   // 右側は左右を反転して丘の形を変え、木を別に置く
 world3(t,316,{dry,noBirds:1,sunX:B?-99999:1010,trees:B?TREES_B:TREES_A,acacia:1});g.restore()}
function banks(t,dry){bank3(t,dry);   // 左の岸（母子の側）
 const m=(a,b)=>mix(a,b,dry);g.save();g.translate(1880,0);   // 右の岸（群れの側）：砂の州と高い葦。遠い景色が切れる右はしをふさぐ
 fill([[-260,330,.3],[-60,326,.6],[120,330,.6],[300,326,.4],[300,372,.4],[-40,366,.8],[-220,352,.8]],m('#b29a6a','#d0a060'));
 {const r=R(77);for(let i=0;i<30;i++){const x=-120+i*16+r()*10,hh=(60+r()*120)*(1-dry*.8);blade(x,340+i%3*5,hh,8,Math.sin(t*1.2+i)*5+(r()-.5)*12,m(i%2?'#4f8648':'#3f6f4a','#a8873f'))}}g.restore()}
function water7(t,dry){if(dry>=1)return;bed3(0);g.save();g.translate(W,0);bed3(0);g.restore();water3(332,t,1-dry);g.save();g.beginPath();g.rect(2080,300,3000,800);g.clip();g.translate(1600,0);water3(332,t,1-dry);g.restore()}
// 水の下（横から）：場所ごとにちがう底
function under7(t){const gr=g.createLinearGradient(0,SURF,0,FLOOR+80);gr.addColorStop(0,'#a9b27a');gr.addColorStop(.45,'#7f8a58');gr.addColorStop(1,'#4c5536');g.fillStyle=gr;g.fillRect(-900,SURF,5200,FLOOR+600-SURF);
 for(let i=0;i<14;i++){const x0=-600+i*300+Math.sin(t*.3+i)*30;g.save();g.globalAlpha=.06+.03*Math.sin(t*1.2+i);poly([[x0,SURF],[x0+70,SURF],[x0-80,FLOOR],[x0-200,FLOOR]],'#f2f0c4');g.restore()}
 const fy=FY7;   // 底の高さ：母子のいた左は深く、群れのいる右は浅い（立つと背中が水面に出る深さ。調べた記録 1.5〜2m）
 {g.fillStyle='#5d5e3d';g.beginPath();g.moveTo(-900,FLOOR+600);for(let x=-900;x<=4300;x+=40)g.lineTo(x,fy(x));g.lineTo(4300,FLOOR+600);g.closePath();g.fill()}
 const r=R(71);
 for(let i=0;i<40;i++){const x=-500+r()*900,y=fy(x);for(let j=0;j<3;j++)blade(x+j*9,y+4,40+r()*60,9,Math.sin(t*1.2+i+j)*10-14,'#667f48')}   // 左：水草の多い浅い所
 for(let i=0;i<14;i++){const x=400+r()*700,y=fy(x);ell(x,y,14+r()*26,8+r()*9,mix('#44472f','#6a6a4a',r()))}                          // 中：石の多い所
 {const x=640,y=fy(640)-10;g.save();g.translate(x,y);g.rotate(-.08);fill([[-160,0,.6],[-150,-26,.8],[150,-20,.8],[170,4,.6],[0,14,.6]],'#4f4632');for(let k=0;k<5;k++)line([[-120+k*55,-14],[-90+k*55,-6]],'#3c3526',3);line([[120,-18],[190,-70]],'#4f4632',9);g.restore()}   // 沈んだ木
 for(let i=0;i<26;i++){const x=1350+r()*1300,y=fy(x);ell(x,y-2,22+r()*30,5+r()*4,'#55553a')}                                          // 右：群れの足で踏みならされた泥のくぼみ
 for(let i=0;i<60;i++){const x=-600+r()*4400,y=SURF+20+r()*520+Math.sin(t+i)*6;g.save();g.globalAlpha=.25+.3*r();ell(x,y,1.5+r()*2,1.5+r()*2,'#ecebbd');g.restore()}
 return fy}
// 群れ（右）。y はふだん（見下ろした時）の奥行き。目の高さでは、水面の線に寄る
const HERD=[{x:1180,y:520,s:.74,yaw:200,seed:45,fl:36,c:.4},{x:1330,y:560,s:.9,yaw:170,seed:11,fl:30,c:1.1,F:1},{x:1520,y:500,s:.7,yaw:210,seed:17,fl:40},{x:1700,y:574,s:.95,yaw:160,seed:5,fl:32,c:.9},
 {x:1470,y:520,s:.78,yaw:190,seed:55,fl:38},{x:1560,y:600,s:.86,yaw:230,seed:29,fl:34,c:1.5},{x:1400,y:420,s:.46,yaw:120,seed:8,fl:40},{x:1610,y:400,s:.42,yaw:60,seed:14,fl:44},{x:1340,y:430,s:.5,yaw:300,seed:65,fl:40}];
const yv=(y,f)=>SURF+(y-SURF)*f;
const FY7=x=>{const deep=FLOOR-14*Math.sin(x*.004)-26*Math.sin(x*.0013+1),sh=484+6*Math.sin(x*.01);const k=clamp((x-860)/220);return lerp(deep,sh,k*k*(3-2*k))};
SC.intro7=function(t){const TA=2.8;if(t<TA){grass4(t);return}
 const tl=t-TA,K=(a,b,u)=>lerp(a,b,ease(clamp(u)));
 // ─ カメラ ─
 let cx=640,cy=360,z=1,lv=0;
 if(tl>=8.6&&tl<10.6){const u=(tl-8.6)/2.0;lv=ease(clamp(u));cx=lerp(640,560,ease(u));cy=lerp(360,SURF,ease(u));z=lerp(1,1.15,ease(u))}
 else if(tl>=10.6&&tl<13.6){lv=1}
 else if(tl>=15.4&&tl<26.0){lv=1}
 else if(tl>=26.0){lv=1-ease(clamp((tl-26.0)/2.2))}
 // 母の水の中の道すじ
 const g1=gait(Math.max(0,tl-9.6),1.9,150);
 let mx=360+(tl>=9.6?g1.adv:0),my=FLOOR-120,mp=0,mlegs=null;
 if(tl<9.6){const s=clamp((tl-7.3)/2.3);my=lerp(SURF+40,FY7(330)-120,eout(s));mx=lerp(300,360,s);mp=-.05;mlegs=[-.3+Math.sin(tl*2)*.1,-.2,.3,.35]}   // 沈む：あしをたらして、ゆっくり底へ
 else{my=FY7(mx)-120-g1.hop*34;mp=g1.pitch;mlegs=[g1.fh,g1.fh+.12,g1.ff,g1.ff+.14]}
 const atHerd=tl>=15.4;   // 真下のあとは群れの近く（間の道のりは真下のつなぎで省く）
 if(atHerd){const cr=clamp((tl-15.5)/.5),pu=clamp((tl-16.0)/1.6);mx=1000+90*eout(pu);
  my=lerp(FY7(1000)-120+16*cr*(1-pu),SURF+29,eout(pu));mp=lerp(.06*cr,-.5,clamp(pu*3))*(1-ease(clamp((pu-.6)/.4)))-.1*ease(clamp((pu-.6)/.4));mlegs=[lerp(.3*cr,-1.4,clamp(pu*4)),lerp(.3*cr,-1.3,clamp(pu*4)),lerp(.2,-.7,pu)+Math.sin(tl*7)*.25*pu,lerp(.2,-.6,pu)+Math.sin(tl*7+1)*.25*pu]}
 if(tl>=10.6&&tl<13.6){const u=clamp((tl-10.6)/1.4);cy=lerp(SURF,FLOOR-215,ease(u));cx=lerp(560,mx+170,ease(u));z=lerp(1.15,1.3,ease(u))}
 if(atHerd&&tl<26){const pu=clamp((tl-15.6)/2.0),cl=ease(clamp((tl-17.6)/1.6)),pi=ease(clamp((tl-19.0)/5.0));cx=lerp(lerp(mx+150,1130,ease(clamp((tl-17.6)/2.4))),1105,pi);cy=lerp(lerp(lerp(FY7(1000)-150,SURF+40,eout(pu)),SURF-40,cl),SURF-30,pi);z=lerp(1.3,1.6,cl)+.32*pi}   /* 再会：子とFのほうへゆっくり寄りつづける（止まって見えた・どこを見ればいいか分からなかった。7版2周目挑戦） */   /* 再会は母に寄る（線は画面の下の方：水の上の顔が大きく見える） */
 if(tl>=26){const u=ease(clamp((tl-26)/2.2));cx=lerp(1130,1120,u);cy=lerp(SURF-40,360,u);z=lerp(1.6,1.08,u)+.06*clamp((tl-28.4)/5)}   /* 引いても絵の外が写らない広さ／骨の場面はゆっくり寄る */
 // 真下（動きつなぎ：母は同じ画面の位置・向き・速さのまま、見え方だけ変わる）
 if(tl>=13.6&&tl<15.4){botUp5(t,(tl-13.6)+1.1);return}
 const dead=tl>=28.4,td=tl-28.4,dry=dead?1:0,f=1-.98*lv,yb=yv(720,f);
 g.save();g.translate(W/2,H/2);g.scale(z,z);g.translate(-cx,-cy);
 // 1) 水の上：空・遠くの景色はそのまま、水面より下（見下ろした水面）は目の高さに近づくほど縦に縮む
 sky7(dry);panel(t,0,0,dry);   /* 景色は1枚（継ぎ目なし）。カメラが動けば見える場所が変わる */
 g.save();g.beginPath();g.rect(-2000,SURF,8000,4000);g.clip();g.translate(0,SURF);g.scale(1,f);g.translate(0,-SURF);
 if(dead){rect(-2000,SURF,8000,800,'#e0b06a');for(const dx of [0,W-40]){g.save();g.translate(dx,30);duneFaces();g.restore()}}else water7(t,0);
 g.restore();banks(t,dry);
 // 2) 水の下：見下ろした水面の帯より下に見える（目の高さでは、線から下がすべて水の中）
 let fy=null;if(!dead&&yb<720*z+cy){g.save();g.beginPath();g.rect(-2000,yb,8000,4000);g.clip();fy=under7(t);
  // 水の上にいるカバの、水の下の体（にごってうすい）
  const surfAll=[];
  for(const h of HERD)surfAll.push(h);
  for(const h of surfAll){if(h.s<.6)continue;const hz=.5;hp3({x:h.x,y:SURF+h.fl*h.s,s:h.s,yaw:h.yaw,seed:h.seed,v:hv(h.seed)},t,{full:1,fl:0,hz,hzc:'#8a9460',tilt:-.04})}
  // 母と子（水の中）
  if(tl>=7.4){const gc=gait(Math.max(0,tl-9.7),1.25,84),cxk=atHerd?mx-170-30*Math.sin(tl*2):mx-200+Math.sin(tl*.8)*30,cyk=atHerd?lerp(FLOOR-60,SURF+30,eout(clamp((tl-16.2)/1.6))):(tl<9.6?lerp(SURF+40,FLOOR-70,eout(clamp((tl-7.7)/2))):FLOOR-70-gc.hop*30);
   hp3({x:cxk,y:cyk,s:.42,yaw:12,seed:33,v:hv(33)},t,{full:1,fl:0,hz:.15,hzc:'#8a9460',tilt:tl<9.6?-.05:gc.pitch*1.2,legs:tl<9.6?[-.3,-.2,.3,.3]:[gc.fh,gc.fh+.1,gc.ff,gc.ff+.12]});
   hp3({x:mx,y:my,s:.95,yaw:10,seed:2,v:hv(2)},t,{full:1,fl:0,hz:.1,hzc:'#8a9460',tilt:mp,legs:mlegs});
   if(!atHerd&&tl>=9.6&&g1.touch){}   // 着いた所の泥（下）
   for(let k=0;k<4;k++){const tk=(g1.n-k)*1.9+9.6+1.75;const age=tl-tk;if(tl<9.6||age<0||age>1.8||atHerd)continue;const px=360+(g1.n-k+1)*128-40;g.save();g.globalAlpha=clamp(.6-age*.33);ell(px,FLOOR-2-age*8,22+age*50,7+age*10,'#8f8a5c');g.restore()}
   if(atHerd&&tl>16.7){for(let i=0;i<10;i++){const k=((tl*1.4+i*.1)%1);g.save();g.globalAlpha=(1-k)*.7;g.strokeStyle='#f3f5d4';g.lineWidth=2;g.beginPath();g.arc(mx+250+Math.sin(k*9+i)*8,my-60-k*(my-SURF-40),3+i%3*2,0,7);g.stroke();g.restore()}}}   // 浮かぶ前に、鼻から息をはく
  g.restore()}
 // 3) 水の上のカバ（見下ろす高さに合わせて y を縮める。体の大きさはそのまま）
 const ev=[];
 if(!dead){
  // 群れ：母を呼ぶ（合唱）→ 浮かんだ母に向き直る → 1頭（F）が寄って子と鼻を合わせる → みんなで鳴く → 身を寄せる
  const meet=tl>=17.2;const order=HERD.map((h,i)=>({h,i})).sort((a,b)=>a.h.s-b.h.s);
  for(const {h,i} of order){let st={fl:h.fl,jaw:0,tilt:-.04,ev:[]},yaw=h.yaw,x=h.x;
   if(h.c!=null){const hn=honk(tl-h.c,5.0);if(hn){st.jaw=hn.jaw;st.tilt+=hn.tilt;st.fl=h.fl+hn.fl;honkRings(h,tl-h.c,5.0,st.ev)}}
   if(meet){const turn=ease(clamp((tl-17.6-i*.12)/1.2));yaw=lerp(h.yaw,h.x>mx?175:10,turn*.8);
    const hn=honk(tl-(22.6+(i%3)*.35),4.8);if(hn&&h.s>.6){st.jaw=hn.jaw;st.tilt+=hn.tilt;st.fl=h.fl+hn.fl;honkRings(h,tl-(22.6+(i%3)*.35),4.8,st.ev)}}
   if(h.F&&meet){const ap=ease(clamp((tl-18.6)/2.0)),sn=clamp((tl-20.6)/1.4);x=lerp(h.x,1150,ap);yaw=lerp(170,190,ap);st.tilt+=.12*Math.sin(Math.PI*sn)}   // 寄ってきて、子のにおいをかぐ
   if(tl>=25.0&&h.x<1700){x+=(1050-x)*.08*ease(clamp((tl-25)/1.5))}   // 身を寄せる
   hp3({x,y:yv(h.y,f),s:h.s,yaw,seed:h.seed,v:hv(h.seed)},t,st)}
  // 母と子（水の上）
  if(tl<8.4){const hn=honk(tl-1.9,5.6),sk=clamp((tl-7.2)/1.0);const o=hn?{jaw:hn.jaw,tilt:hn.tilt,fl:30+hn.fl,lean:hn.lean,ev:[]}:{fl:30,ev:[]};o.fl=lerp(o.fl,140,ease(sk));if(hn)honkRings(null,tl-1.9,5.6,o.ev);
   hpS({x:270,y:yv(556,f),s:.98,dir:1,seed:2,v:hv(2)},t,o);
   const ck=clamp((tl-7.4)/.9),nz=Math.sin(Math.PI*clamp((tl-3.2)/1.6));   // 子：母の鳴き声のあいだ、母の顔に寄る
   hp3({x:540-60*nz,y:yv(588,f),s:.4,yaw:14+30*nz,seed:33,v:hv(33)},t,{fl:lerp(22,140,ease(ck)),tilt:-.04})}
  if(atHerd&&my<=SURF+150){const up=clamp((tl-17.4)/.6),turn=ease(clamp((tl-18.0)/1.6)),cl=ease(clamp((tl-25)/1.5));
   const hn=honk(tl-22.9,4.8);const o={fl:Math.max(28,Math.min(120,(my-SURF)/.95))+(hn?hn.fl:0),jaw:hn?hn.jaw:0,tilt:(hn?hn.tilt:0)-.04,puff:clamp((tl-18.05)/.9),ev:[]};if(hn)honkRings(null,tl-22.9,4.8,o.ev);
   hp3({x:mx+30*cl,y:SURF+2,s:.95,yaw:lerp(10,40,turn),seed:2,v:hv(2)},t,o);
   const cu=clamp((tl-18.0)/.6),hide=ease(clamp((tl-21.3)/.9)),go=ease(clamp((tl-19.6)/1.0))*(1-hide);   // 子：浮かんで、Fと鼻を合わせに出て、母のうしろへもどる
   hp3({x:870+170*go-30*hide+40*cl,y:yv(640,f),s:.42,yaw:lerp(20,10,hide),seed:33,v:hv(33)},t,{fl:lerp(80,20,eout(cu)),puff:clamp((tl-18.1)/.7),tilt:-.04+.1*go*Math.sin(tl*6)})}
 }else{podBones(t,td-.45,1,[...HERD.map(h=>({...h,x:h.x<1700?h.x+(1050-h.x)*.08:h.x})),{x:1030,y:620,s:.95,yaw:40,seed:2,fl:28},{x:900,y:640,s:.42,yaw:10,seed:33,fl:20}])}
 g.restore();
 if(!dead&&cy<SURF+150){g.save();if(tl>=17.6){const sp=ease(clamp((tl-17.6)/1.5));g.translate(W/2,H/2);g.scale(1+.25*sp,1+.25*sp);g.translate(-W/2,-H/2)}fg3(t,dry,0);g.restore()}   /* 手前の葦は画面に固定（カメラと一緒に動かない）。再会では少し大きくして画面のふちへ寄せ、真ん中を空ける */
 if(dead&&td<.14){g.save();g.globalAlpha=1-td/.14;rect(0,0,W,H,'#fff');g.restore()}
 if(tl<.8){g.save();g.globalAlpha=1-ease(tw(tl,0,.8));rect(0,0,W,H,'#fffdf0');g.restore()}};
})();
