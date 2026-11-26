/* 部品で直す用の、本番の動画にまだ無い素材を描く式（cap_art.py が arabia.html の上で読む。2026-11-26）
   NM(名前, まとまり, 頭か) … 次に塗る形の部品名。まとまりの頭（茎・丸太の胴など）を動かすと、同じまとまりの部品がついてくる。
   実物の決まり（調べたこと。要確認のものは書いていない）：
   ・葦（ヨシ）：まっすぐな細い茎に、細長く先のとがった葉が互い違いに斜めに出て、先は垂れる。てっぺんに羽毛のような穂（紫がかった茶）。株で群れて立つ
   ・水しぶき：カバのいる浅い所の水はにごった緑茶色なので、しぶきも白でなく、明るい緑がかった灰色。まん中の盛り上がり＋王冠のような縁＋飛んだ粒（先がとがる）
   ・波紋：上から見ると円、横から見ると平たいだ円。外の輪ほど細く薄い。輪は切れ切れ
   ・泥の雲：水の中で舞い上がる泥は、濃い芯と、ふちのうすいもこもこ
   ・丸太：岸に倒れた木。樹皮のすじ、切り口の年輪、折れた枝の根元 */
var NM=(n,gr,head,root,joint)=>{window.NMX={n,g:gr||'',h:!!head,r:!!root,j:!!joint}};   // joint：描き始めと描き終わりの点が付け根（回す中心・つなぎ目）
function reedClump(x,y,s,seed,o={}){const r=R(seed),n=o.n||7,cS='#6d8a48',cD='#4d6a36',cL='#8aa65a',pl='#9a7f6a',plD='#7a6050',wind=o.wind==null?1:o.wind;
 NM('株の根もと','',false,true);fill([[x-62*s,y,.5],[x-36*s,y-12*s,.8],[x+36*s,y-12*s,.8],[x+62*s,y,.5],[x,y+9*s,.6]],'#5e5a3a');
 for(let i=0;i<n;i++){const bx=x+(i-(n-1)/2)*15*s+(r()-.5)*10*s,h=(320+r()*170)*s*(1-Math.abs(i-(n-1)/2)/n*.5),lean=(r()-.5)*34*s+(i-(n-1)/2)*5*s+wind*14*s,w=3.6*s,gk='s'+i,tx=bx+lean,ty=y-h;
  NM('茎 '+(i+1),gk,true,false,true);poly([[bx+w,y],[tx+w*.4,ty],[tx-w*.4,ty],[bx-w,y]],i%2?cS:cD);
  const nl=3+Math.floor(r()*3);for(let k=0;k<nl;k++){const u=.16+k*.16+r()*.05,px=bx+(tx-bx)*u,py=y-h*u,d=(k+i)%2?1:-1,L=(95+r()*60)*s,lw=2.6*s,ex=px+d*L*.72,ey=py-L*.5,dr=(.12+r()*.22)*L;   // 葉：細長く、根元から斜め上へ。先だけ少し垂れてとがる
   NM('葉 '+(i+1)+'-'+(k+1),gk,false,false,true);g.fillStyle=k%2?cL:cS;g.beginPath();g.moveTo(px,py-lw);g.quadraticCurveTo(px+d*L*.4,py-L*.5-lw,ex,ey);g.lineTo(ex+d*L*.16,ey+dr);g.quadraticCurveTo(px+d*L*.38,py-L*.4+lw,px,py+lw);g.closePath();g.fill()}
  if(r()>.2){const ph=(78+r()*34)*s,pw=(17+r()*7)*s,k2=wind;NM('穂 '+(i+1),gk,false,false,true);g.fillStyle=pl;g.beginPath();g.moveTo(tx-3*s,ty+4*s);   // 穂：大きな羽毛。風下へうなだれ、外のふちは小さくぎざぎざ
   g.quadraticCurveTo(tx-pw*.9,ty-ph*.55,tx+k2*pw*1.3,ty-ph*.9);for(let j=0;j<5;j++){const v=j/5;g.lineTo(tx+k2*pw*(1.6-v*.2)+k2*5*s,ty-ph*(.82-v*.7)-3*s);g.lineTo(tx+k2*pw*(1.35-v*.35),ty-ph*(.74-v*.7))}g.lineTo(tx+3*s,ty+4*s);g.closePath();g.fill();
   NM('穂の影 '+(i+1),gk);g.fillStyle=plD;g.beginPath();g.moveTo(tx,ty+3*s);g.quadraticCurveTo(tx+k2*pw*.9,ty-ph*.4,tx+k2*pw*1.25,ty-ph*.8);g.quadraticCurveTo(tx+k2*pw*.35,ty-ph*.5,tx-1*s,ty);g.closePath();g.fill()}}}
function splash(x,y,s,seed){const r=R(seed),W='#c8d1ae',L='#e9eedc',D='#9aa47c';
 NM('しぶきの土台','',false,true);fill([[x-120*s,y,.6],[x-70*s,y-16*s,.8],[x+70*s,y-16*s,.8],[x+120*s,y,.6],[x+50*s,y+14*s,.8],[x-50*s,y+14*s,.8]],D);
 NM('水の柱','c',true);g.fillStyle=W;g.beginPath();g.moveTo(x-34*s,y-6*s);g.quadraticCurveTo(x-14*s,y-70*s,x-12*s,y-150*s);g.quadraticCurveTo(x,y-176*s,x+12*s,y-150*s);g.quadraticCurveTo(x+14*s,y-70*s,x+34*s,y-6*s);g.closePath();g.fill();   // まん中の細い柱（落ちた所から立つ）
 NM('柱の先のしずく','c');ell(x,y-196*s,11*s,13*s,W);
 NM('柱の光','c');g.fillStyle=L;g.beginPath();g.moveTo(x-16*s,y-14*s);g.quadraticCurveTo(x-6*s,y-80*s,x-5*s,y-146*s);g.quadraticCurveTo(x+2*s,y-80*s,x-2*s,y-14*s);g.closePath();g.fill();
 for(const d of[-1,1]){NM(d<0?'王冠（左）':'王冠（右）','e'+d,true);g.fillStyle=W;g.beginPath();g.moveTo(x+d*30*s,y-4*s);   // 王冠：外へ反って開く細いとげ
  for(let k=0;k<3;k++){const bx=x+d*(50+k*24)*s,h=(78-k*18+r()*14)*s;g.quadraticCurveTo(bx-d*2*s,y-h*.5,bx+d*(10+k*5)*s,y-h);g.lineTo(bx+d*9*s,y-h*.3)}g.lineTo(x+d*122*s,y-3*s);g.closePath();g.fill()}
 for(let k=0;k<9;k++){const a=-Math.PI/2+(k/8-.5)*2.5+(r()-.5)*.2,dd=(140+r()*90)*s,px=x+Math.cos(a)*dd,py=y-40*s+Math.sin(a)*dd*.9,sz=(5+r()*6)*s,ta=a+Math.PI;   // 粒：飛んできた方へ尾を引くしずく（尾の先は角）
  NM('粒 '+(k+1));g.fillStyle=k%3?W:L;g.beginPath();g.moveTo(px+Math.cos(ta)*sz*2.8,py+Math.sin(ta)*sz*2.8);g.arc(px,py,sz,ta+Math.PI/2,ta+Math.PI*1.5);g.closePath();g.fill()}}
function ripples(x,y,s,seed,top){const r=R(seed),ky=top?1:.32,C=['#b4bc92','#a6af84','#99a379'];
 NM('水面のかげり','',false,true);ell(x,y,60*s,60*s*ky,'#7a8458');
 for(let i=0;i<3;i++){const R0=(70+i*62)*s,w=(9-i*2.4)*s,n=3+i,gap=.38-i*.06,off=r()*6.28;   // 外の輪ほど細く・切れ目が多い
  for(let k=0;k<n;k++){const a0=off+k*6.2832/n,a1=a0+6.2832/n-gap;NM('輪 '+(i+1)+'-'+(k+1),'r'+i,k===0);g.strokeStyle=C[i];g.lineWidth=w;g.lineCap='round';g.beginPath();g.ellipse(x,y,R0,R0*ky,0,a0,a1);g.stroke()}}}
function mudCloud(x,y,s,seed){const r=R(seed),C=['#8c7b50','#9c8a5e','#ad9b6e','#bcab80'];   // 水の中なので向こうが透ける。芯は濃く、ふちほどうすい
 const puff=(cx,cy,rr,col,a,k)=>{const P=[];for(let j=0;j<7;j++){const t=j/7*6.283;P.push([cx+Math.cos(t)*rr*(1.25+(r()-.5)*.5),cy+Math.sin(t)*rr*(.85+(r()-.5)*.35),.9])}g.globalAlpha=a;fill(P,col);g.globalAlpha=1};
 NM('泥の芯','',false,true);puff(x,y-10*s,80*s,C[0],.85);
 for(let i=0;i<7;i++){const a=-.3-i*.45+(r()-.5)*.3,d=(80+r()*40)*s,rr=(40+r()*26)*s;NM('もこもこ '+(i+1));puff(x+Math.cos(a)*d*1.3,y-10*s+Math.sin(a)*d*.75,rr,C[1+(i%2)],.7)}
 for(let i=0;i<5;i++){NM('うすい煙 '+(i+1));puff(x+(r()-.5)*320*s,y-110*s-r()*60*s,(26+r()*22)*s,C[3],.42)}}
function logWood(x,y,s,seed){const r=R(seed),B='#6a5644',BD='#4b3c2f',BL='#85705a',E='#c2a57c',ER='#9e8261';
 NM('丸太の胴','w',true,true);g.fillStyle=B;g.beginPath();g.moveTo(x-260*s,y-58*s);g.quadraticCurveTo(x,y-72*s,x+250*s,y-50*s);g.lineTo(x+262*s,y+44*s);g.quadraticCurveTo(x,y+58*s,x-252*s,y+48*s);g.closePath();g.fill();
 NM('下の影','w');g.fillStyle=BD;g.beginPath();g.moveTo(x-252*s,y+14*s);g.quadraticCurveTo(x,y+26*s,x+258*s,y+12*s);g.lineTo(x+262*s,y+44*s);g.quadraticCurveTo(x,y+58*s,x-252*s,y+48*s);g.closePath();g.fill();
 NM('上の明るい所','w');g.fillStyle=BL;g.beginPath();g.moveTo(x-240*s,y-50*s);g.quadraticCurveTo(x,y-64*s,x+236*s,y-44*s);g.lineTo(x+236*s,y-30*s);g.quadraticCurveTo(x,y-46*s,x-240*s,y-34*s);g.closePath();g.fill();
 for(let k=0;k<5;k++){const yy=y+(-22+k*13)*s,x0=x-200*s+r()*120*s,L=(90+r()*140)*s;NM('樹皮のすじ '+(k+1),'w');line([[x0,yy],[x0+L*.5,yy+(r()-.5)*6*s],[x0+L,yy+(r()-.5)*4*s]],BD,4*s)}   // 樹皮のすじ（横に長い割れ目）
 NM('切り口のふち','e',true);ell(x+262*s,y-3*s,29*s,52*s,BD);NM('切り口','e');ell(x+262*s,y-3*s,25*s,47*s,E);for(let k=3;k>=1;k--){NM('年輪 '+(4-k),'e');ell(x+262*s-(3-k)*1.5*s,y-3*s,25*s*k/4,47*s*k/4,k%2?ER:E)}   // 年輪は塗りを重ねる（線にすると部品にしにくい）
 NM('折れた枝','b',true);poly([[x-60*s,y-56*s],[x-30*s,y-60*s],[x-6*s,y-128*s],[x-14*s,y-134*s],[x-24*s,y-122*s],[x-30*s,y-140*s],[x-44*s,y-132*s]],B);   // 折れた先はぎざぎざ（角）
 NM('枝の影','b');poly([[x-60*s,y-56*s],[x-44*s,y-58*s],[x-36*s,y-128*s],[x-44*s,y-132*s]],BD)}
/* 頭の骨（横）。bones3（arabia_intro.js）の頭の骨と下あごを、そのまま1つの素材にしたもの（見直しループで実物帳「骨」に合わせた形。2026-11-22） */
function skullSide(x,y,s,o={}){const c='#f7f0e1',dk='#d8cbb0',hole='#6a5a46',tusk='#efe2c2',P=pts=>{g.beginPath();blob(pts)};
 g.save();g.translate(x,y);g.scale(s,s);
 NM('頭の骨','k',true,true);g.fillStyle=c;P([[-76,8,.5],[-74,-26,.7],[-52,-38,.8],[-24,-56,.9],[4,-54,.9],[16,-32,.8],[56,-26,.8],[92,-38,.8],[118,-34,.7],[128,-6,.6],[118,18,.6],[60,22,.7],[-30,26,.7]]);g.fill();
 NM('下側の影','k');g.fillStyle=dk;P([[-60,10,.6],[-20,6,.7],[40,10,.7],[96,14,.6],[96,22,.5],[-30,26,.6]]);g.fill();
 NM('目の穴','k');g.fillStyle=hole;P([[-18,-36,.9],[-2,-40,.9],[6,-28,.9],[-10,-24,.9]]);g.fill();
 NM('目のうしろのくぼみ','k');P([[-66,-22,.8],[-36,-34,.8],[-26,-22,.8],[-58,-10,.8]]);g.fill();
 NM('上の牙','k');g.fillStyle=tusk;P([[82,14,.5],[90,12,.5],[88,40,.6],[82,44,.4]]);g.fill();
 for(let k=0;k<5;k++){NM('奥歯 '+(k+1),'k');rect(22+k*12,13,9,8,k%2?'#e8dcc0':'#ded1b4')}NM('歯ぐきの線','k');rect(20,21,62,2,dk);
 g.translate(-60,20);g.rotate(o.open?.3:0);g.translate(60,0);   // 下あごはうしろ（x=−60）のちょうつがいで回る。閉じた時は頭の骨にぴったり
 NM('下あご','j',true);g.fillStyle=c;P([[-60,-2,.6],[-20,0,.7],[60,2,.7],[118,0,.6],[122,14,.6],[96,22,.7],[40,18,.7],[-20,26,.8],[-50,50,.9],[-70,40,.8],[-72,14,.6]]);g.fill();
 NM('下あごの影','j');g.fillStyle=dk;P([[-56,30,.7],[-20,24,.7],[40,16,.7],[96,20,.6],[96,22,.5],[-50,50,.8]]);g.fill();
 NM('下の牙','j');g.fillStyle=tusk;P([[94,8,.5],[110,2,.5],[114,-24,.7],[104,-54,.8],[92,-60,.6],[98,-28,.7],[88,-4,.5]]);g.fill();
 NM('切歯','j');P([[116,2,.5],[146,0,.5],[146,6,.5],[118,10,.5]]);g.fill();
 g.restore()}
