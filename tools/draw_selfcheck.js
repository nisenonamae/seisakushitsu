// お絵描き（draw.html）の「速く描き直すための控え」が古いまま残らないかの試験。
// 使い方：リポジトリの上で `python3 -m http.server 8765` を裏で動かしてから `node tools/draw_selfcheck.js`（細かく見るなら末尾に v）。
// いろいろな操作（描く・消す・戻す・レイヤーの操作・補正・文字・変形・拡大）のたびに、速い描き方と、全部のレイヤーを描き直す描き方を比べる。
// 最後の行が「fails 0」ならよい。draw.html の描き直し（render・drawLayers・fastLayer）や、レイヤーの絵を書き換える処理を直したら必ず流す。
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1288,height:675},deviceScaleFactor:2});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/draw.html');await pg.waitForTimeout(1200);
await pg.evaluate(async()=>{if($('gal').open){newPending=true;$('gal').close()}await startNew('ending');newPending=false;
 let seed=11;const R=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<6;i++){LA.new();const c=g2(act().cv);for(let j=0;j<5;j++){c.fillStyle=`hsla(${(i*55+j*20)%360},70%,${40+j*6}%,${0.5+R()*0.5})`;c.beginPath();c.arc(R()*art.w,R()*art.h,40+R()*200,0,7);c.fill()}}
 layers[3].opacity=0.6;markAll();activeId=layers[3].id;setTool('brush');OPT.brush.size=36;OPT.brush.smooth=0;OPT.eraser.size=50;OPT.eraser.smooth=0;showGuide=false;renderLayers();renderOpts();need();
 window.refDiff=()=>{cursor=null;render();render();const W=view.width,H=view.height;const a=vctx.getImageData(0,0,W,H).data.slice();const f=drawLayers;drawLayers=function(c){compositeTo(c)};render();const r=vctx.getImageData(0,0,W,H).data;drawLayers=f;render();
  const k=dpr*V.s,ox=Math.round(dpr*V.tx),oy=Math.round(dpr*V.ty);const ex=Math.floor(ox+art.w*k)-1,ey=Math.floor(oy+art.h*k)-1;let n8=0,n40=0,mx=0;
  for(let y=0;y<H;y++){if(y>=ey&&y<=ey+2)continue;for(let x=0;x<W;x++){if(x>=ex&&x<=ex+2)continue;const i=(y*W+x)*4;const d=Math.max(Math.abs(a[i]-r[i]),Math.abs(a[i+1]-r[i+1]),Math.abs(a[i+2]-r[i+2]));if(d>8)n8++;if(d>40)n40++;if(d>mx)mx=d}}return{n8,n40,mx}}});
const st=await pg.evaluate(()=>{const r=$('stage').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}});
let fails=0,steps=0;const chk=async(name,tol8=400,tol40=40)=>{const r=await pg.evaluate(()=>refDiff());steps++;const bad=r.n8>tol8||r.n40>tol40;if(bad)fails++;if(bad||process.argv[2]==='v')console.log((bad?'NG ':'ok ')+name,JSON.stringify(r))};
const E=(f,a)=>pg.evaluate(f,a);
const strokeMid=async(dy)=>{await pg.mouse.move(st.x-260,st.y+dy);await pg.mouse.down();for(let i=0;i<30;i++)await pg.mouse.move(st.x-260+i*16,st.y+dy+Math.sin(i/4)*70)};
await chk('idle');
for(const [tool,dy] of [['brush',-100],['eraser',-40],['brush',30]]){await E(t=>setTool(t),tool);await strokeMid(dy);await chk(tool+' mid');await pg.mouse.up();await chk(tool+' done')}
// 別のレイヤーを選ぶ → 描く → 戻す（選んでいないレイヤーの絵が戻る）
for(const i of [1,5,2,6,0]){await E(i=>{activeId=layers[i].id;need()},i);await chk('active '+i);await E(()=>setTool('brush'));await strokeMid(i*25-60);await chk('stroke on '+i+' mid');await pg.mouse.up();await chk('stroke on '+i+' done')}
for(let i=0;i<4;i++){await E(()=>undo());await chk('undo '+i)}
for(let i=0;i<2;i++){await E(()=>redo());await chk('redo '+i)}
// 目・不透明度・重ね方（選んでいないレイヤーも）
await E(()=>{const l=layers[2];structOp('x',()=>{l.visible=false})});await chk('hide 2');
await E(()=>{layers[5].opacity=0.3;need()});await chk('opacity of static 5 (直接)');
await E(()=>{layers[5].blend='multiply';need()});await chk('blend of static 5');
await E(()=>{layers[1].blend='screen';need()});await chk('blend of static 1');
await E(()=>{activeId=layers[3].id;need()});await strokeMid(60);await chk('stroke between blends mid');await pg.mouse.up();await chk('done');
await E(()=>{layers[5].blend='source-over';layers[1].blend='source-over';layers[2].visible=true;need()});await chk('reset');
// レイヤーの操作
for(const op of ['new','dup','up','down','clip','clip','merge','del','mergeVis']){await E(op=>LA[op](),op);await chk('LA.'+op);}
await E(()=>undo());await chk('undo mergeVis');await E(()=>undo());await chk('undo del');
await E(()=>{activeId=layers[2].id;LA.clip()});await chk('clip 2');await strokeMid(-20);await chk('clip stroke mid');await pg.mouse.up();await chk('clip stroke done');
await E(()=>{activeId=layers[1].id;need()});await strokeMid(-80);await chk('clip base stroke mid');await pg.mouse.up();await E(()=>{activeId=layers[2].id;LA.clip()});await chk('unclip');
// 塗り・消去・反転
await E(()=>{activeId=layers[4].id;renderLayers();ACT.fillFg()});await chk('fillFg');await E(()=>undo());await chk('undo fill');
await E(()=>ACT.flipH());await chk('flipH');await E(()=>ACT.cflipH&&ACT.cflipH());await chk('cflipH');await E(()=>ACT.clear());await chk('clear');await E(()=>undo());await chk('undo clear');
// 補正（全部のレイヤーに）
await E(()=>{adjScope='all';openAdj('hs')});await chk('adj open');await E(()=>{const k=Object.keys(adj.v)[0];adj.v[k]=60;computeAdj()});await chk('adj changed');await E(()=>{applyAdj();try{$('dlg').close()}catch(e){}});await chk('adj applied');await E(()=>undo());await chk('adj undo');
await E(()=>{adjScope='one';openAdj('bc')});await E(()=>{const k=Object.keys(adj.v)[0];adj.v[k]=50;computeAdj()});await chk('adj one changed');await E(()=>{adj=null;try{$('dlg').close()}catch(e){};need()});await chk('adj cancel');
// 文字
await E(()=>setTool('text'));await pg.mouse.click(st.x-100,st.y-50);await E(()=>{textEdit.str='まあまあ';textEdit.size=120;drawTextLayer()});await pg.waitForTimeout(300);await chk('text editing');await E(()=>commitText());await pg.waitForTimeout(300);await chk('text done');await E(()=>undo());await chk('text undo');
await pg.mouse.click(st.x-100,st.y-50);await E(()=>{if(textEdit){textEdit.str='abc';drawTextLayer()}});await chk('text 2 editing');await E(()=>cancelText());await chk('text cancel');
// 変形（1枚・組・選択範囲）＋拡大
await E(()=>{activeId=layers[3].id;grpOn=false;renderLayers();setTool('move');startXform()});await pg.mouse.move(st.x,st.y);await pg.mouse.down();await pg.mouse.move(st.x+120,st.y+40,{steps:4});await chk('xf one mid',6000,600);await pg.mouse.up();await E(()=>{float.sx=.7;float.rot=.2;need()});await chk('xf one scaled',9000,900);await E(()=>commitFloat());await chk('xf one done');
await E(()=>{layers.slice(2,6).forEach(l=>l.grp='g');grpOn=true;markAll();renderLayers();startXform()});await pg.mouse.move(st.x,st.y);await pg.mouse.down();await pg.mouse.move(st.x-320,st.y+140,{steps:4});await chk('xf grp mid',9000,2500);await pg.mouse.up();await E(()=>commitFloat());await chk('xf grp done');await E(()=>undo());await chk('xf grp undo');
await E(()=>{zoomAt(2.5/V.s)});await chk('zoom 250');await E(()=>{startXform()});await pg.mouse.move(st.x,st.y);await pg.mouse.down();await pg.mouse.move(st.x+60,st.y+30,{steps:3});await chk('xf grp z250 mid');await pg.mouse.up();await E(()=>cancelFloat());await chk('xf cancel');
await E(()=>{setTool('brush')});await strokeMid(0);await chk('z250 stroke mid');await pg.mouse.up();await E(()=>{V.tx+=211.3;V.ty-=77.7;need()});await chk('z250 pan');
await E(()=>{zoomAt(0.62/V.s)});await chk('zoom 62');await strokeMid(40);await chk('z62 stroke mid');await pg.mouse.up();await E(()=>{V.tx-=91.3;V.ty+=47.7;need()});await chk('z62 pan');await strokeMid(-40);await chk('z62 pan stroke mid');await pg.mouse.up();
await E(()=>{fit()});await chk('fit');
// 選択範囲つきの消しゴム・透明の保護
await E(()=>{setTool('marquee')});await pg.mouse.move(st.x-200,st.y-120);await pg.mouse.down();await pg.mouse.move(st.x+150,st.y+80,{steps:4});await pg.mouse.up();await E(()=>setTool('eraser'));await strokeMid(-30);await chk('sel erase mid');await pg.mouse.up();await chk('sel erase done');await E(()=>{ACT.deselect();act().lockAlpha=true;setTool('brush')});await strokeMid(50);await chk('lock mid');await pg.mouse.up();await E(()=>{act().lockAlpha=false});await chk('lock done');
// 大きさを変える・回す
await E(()=>ACT.rot90());await pg.waitForTimeout(200);await chk('rot90');await strokeMid(0);await chk('rot90 stroke mid');await pg.mouse.up();await E(()=>undo());await E(()=>undo());await pg.waitForTimeout(200);await chk('rot90 undo');
await E(()=>LA.flatten());await chk('flatten');await E(()=>undo());await chk('flatten undo');
// ぼかし（レイヤーの設定）・影と光（クリップした乗算・スクリーン）・形に沿って明暗（2026-11-20）
await E(()=>{activeId=layers[2].id;act().blur=12;renderLayers();need()});await chk('layer blur');await strokeMid(20);await chk('blur stroke mid');await pg.mouse.up();await chk('blur stroke done');
await E(()=>{activeId=layers[1].id;renderLayers();addShade('dark');setTool('brush')});await strokeMid(-20);await chk('shade mid');await pg.mouse.up();await chk('shade done');
await E(()=>{act().blur=8;renderLayers();need()});await chk('shade blur');
await E(()=>{activeId=layers.find(l=>!l.clip&&!l.trace&&maskBBox(l.cv)).id;renderLayers();autoShade()});await pg.waitForTimeout(150);if(!await pg.evaluate(()=>$('dlg').open)){fails++;console.log('FAIL auto shade dialog')}await chk('auto shade preview');await E(()=>$('dlgOk').click());await chk('auto shade ok');await E(()=>undo());await chk('auto shade undo');
await E(()=>{activeId=layers.find(l=>!l.clip&&!l.trace&&maskBBox(l.cv)).id;renderLayers();toneBrush('-1')});await strokeMid(30);await chk('tone dark mid');await pg.mouse.up();await chk('tone dark done');
await E(()=>{LA.new();LA.clip();toneBrush('1')});await strokeMid(-30);await chk('tone clip mid');await pg.mouse.up();await chk('tone clip done');await E(()=>{OPT.brush.tone='0'});
// 写真を平らな絵に（小さな作り物の写真で）・なぞる画像を上に透かす（2026-11-20）
await E(()=>{const c=mk(300,200),x=g2(c);x.fillStyle='#4a7';x.fillRect(0,0,300,200);x.fillStyle='#e94';x.beginPath();x.arc(150,100,60,0,7);x.fill();const A=flatAnalyze(c,{k:4,lv:3,simp:2,sat:20,pur:30});return flatBuild(A,c,{fit:'contain'})});await chk('flat build');await E(()=>undo());await chk('flat undo');
await E(()=>{toggleTraceTop();toggleTraceTop()});await chk('trace top');
// 後ろを暗く（l.glow）・周りを暗く（2026-11-20）
await E(()=>{activeId=layers.find(l=>!l.clip&&!l.trace&&maskBBox(l.cv)).id;act().glow=40;renderLayers();need()});await chk('glow');await strokeMid(10);await chk('glow stroke mid');await pg.mouse.up();await chk('glow stroke done');await E(()=>{act().glow=0;addVignette()});await chk('vignette');await E(()=>undo());await chk('vignette undo');
// 移動の道具のつまみで大きさを変える（2026-11-20）
await E(()=>{activeId=layers.find(l=>!l.clip&&!l.trace&&maskBBox(l.cv)).id;setTool('move');renderLayers();need()});await chk('move box');
{const h=await pg.evaluate(()=>{const b=moveBox();const r=view.getBoundingClientRect();return{x:r.left+V.tx+(b.x+b.w)*V.s,y:r.top+V.ty+(b.y+b.h)*V.s,ok:!!b}});if(!h.ok){fails++;console.log('FAIL no move box')}else{await pg.mouse.move(h.x,h.y);await pg.mouse.down();await pg.mouse.move(h.x-40,h.y-30,{steps:4});await chk('move scale mid');await pg.mouse.up();await chk('move scale done');const f=await pg.evaluate(()=>!!float);if(f){fails++;console.log('FAIL float left')}}}
await E(()=>undo());await chk('move scale undo');await E(()=>setTool('brush'));
// 曲げる（ワープ・2026-11-20）
await E(()=>{activeId=layers.find(l=>!l.clip&&!l.trace&&maskBBox(l.cv)).id;setTool('move');renderLayers();ACT.warpStart()});await chk('warp start');
{const q=await pg.evaluate(()=>{const P=float.warp.P;const c=warpAt(P,.5,.5);const r=view.getBoundingClientRect();return{x:r.left+V.tx+c.x*V.s,y:r.top+V.ty+c.y*V.s}});await pg.mouse.move(q.x,q.y);await pg.mouse.down();await pg.mouse.move(q.x+30,q.y+40,{steps:4});await chk('warp drag');await pg.mouse.up()}
await E(()=>ACT.xfOk());await chk('warp ok');await E(()=>undo());await chk('warp undo');await E(()=>setTool('brush'));
console.log('steps',steps,'fails',fails,'errs',errs.slice(0,5));await b.close()})();
