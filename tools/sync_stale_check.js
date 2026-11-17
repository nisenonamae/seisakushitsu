// 同期の試験：古い控えを持った端末が制作室・お絵描きを開いても、置き場の制作の中身（肉付け・動画の記録）が消えないか。
// 使い方：リポジトリの上で `python3 -m http.server 8765` を裏で動かしてから `node tools/sync_stale_check.js`（本物の data.json を読むだけ。書き込みはにせの置き場へ）。
// 「置き場」の 段・動画 が 0／null になっていたら不合格。同期の合わせ方（merge）や、開いたときに自動で走る書き換え（migrate…）を直したら必ず流す。
// 2026-11-17 に、番号の付け替え（migrateSteps）が古い控えの更新時刻を「今」にして、「人工の土地」の中身を消した。その再発を見張る。
const {chromium}=require('playwright');const fs=require('fs');
const b64e=s=>Buffer.from(s,'utf8').toString('base64');
async function run(page0,label){const store=new Map();let shaN=1;
 const real=JSON.parse(fs.readFileSync('/home/claude/notion-daily/roadmap/apps/seisakushitsu/data.json','utf8'));
 store.set('d/data.json',{sha:'s0',b64:b64e(JSON.stringify(real))});
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1288,height:675}});
 await ctx.route('https://api.github.com/**',async route=>{const rq=route.request();const u=new URL(rq.url());const m=u.pathname.match(/\/repos\/o\/r\/contents\/(.*)$/);const path=decodeURIComponent(m?m[1]:'');const H={'access-control-allow-origin':'*'};
  if(rq.method()==='GET'){const f=store.get(path);if(!f)return route.fulfill({status:404,body:'{}',headers:H});const acc=rq.headers()['accept']||'';if(acc.includes('raw'))return route.fulfill({status:200,body:Buffer.from(f.b64,'base64'),headers:{...H,'content-type':'application/octet-stream'}});return route.fulfill({status:200,contentType:'application/json',headers:H,body:JSON.stringify({sha:f.sha,content:f.b64})})}
  if(rq.method()==='PUT'){const bd=JSON.parse(rq.postData());const f=store.get(path);if(f&&bd.sha!==f.sha)return route.fulfill({status:409,body:'{}',headers:H});store.set(path,{sha:'s'+(shaN++),b64:bd.content});return route.fulfill({status:200,contentType:'application/json',headers:H,body:'{}'})}
  return route.fulfill({status:204,headers:{...H,'access-control-allow-headers':'*','access-control-allow-methods':'*'}})});
 // 端末の中の古い控え：全部の制作から sv を外し（番号を変える前の時代）、人工の土地は作りかけの空の控え、更新時刻は昔
 const stale=JSON.parse(JSON.stringify(real));delete stale.arts;stale.projects=stale.projects.map(p=>{const q=p.id==='pmwj8x4ghaety'?{id:p.id,candId:p.candId,step:0,refs:[],scriptNotes:'',fixes:[]}:{...p};delete q.sv;q.updatedAt=1794700000000;return q});
 await ctx.addInitScript(([d])=>{if(!localStorage.getItem('gh_o')){localStorage.setItem('gh_o','o');localStorage.setItem('gh_r','r');localStorage.setItem('gh_t','t');localStorage.setItem('gh_p','d/data.json');localStorage.setItem('ss_data',d)}},[JSON.stringify(stale)]);
 const srv=()=>{const D=JSON.parse(Buffer.from(store.get('d/data.json').b64,'base64').toString('utf8'));const p=D.projects.find(x=>x.id==='pmwj8x4ghaety');return{項目:Object.keys(p).length,段:p.flesh?p.flesh.blocks.length:0,動画:p.video?p.video.ver:null,step:p.step,sv:p.sv,arts:(D.arts||[]).length,洗濯板の項目:Object.keys(D.projects.find(x=>x.id==='pmwg08esspq5j')).length}};
 const errs=[];const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://localhost:8765/'+page0);await pg.waitForTimeout(5000);const s1=srv();
 const loc=await pg.evaluate(()=>{const D=JSON.parse(localStorage.getItem('ss_data'));const p=D.projects.find(x=>x.id==='pmwj8x4ghaety');return{段:p.flesh?p.flesh.blocks.length:0,step:p.step,sv:p.sv}});
 const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));await pg2.goto('http://localhost:8765/draw.html');await pg2.waitForTimeout(5000);const s2=srv();
 console.log(label,'| 制作室を開いたあとの置き場',JSON.stringify(s1),'| 端末の中',JSON.stringify(loc),'| お絵描きも開いたあと',JSON.stringify(s2),'| 書き込み',shaN-1,'回 | errs',errs.slice(0,2));await b.close()}
(async()=>{await run('index.html','今の版');
 // 守りの確認：古い空の控えのほうが「新しい」ことになっていても、肉付けは残るか（4ページとも）
 const b=await chromium.launch();for(const f of ['index.html','draw.html','bgm.html','sound.html']){const pg=await b.newPage();await pg.goto('http://localhost:8765/'+f);await pg.waitForTimeout(800);
  const r=await pg.evaluate(()=>{const full={id:'p1',step:4,flesh:{blocks:[1,2,3]},video:{ver:9},updatedAt:100},stub={id:'p1',step:0,fixes:[],updatedAt:200};const m1=merge({projects:[stub]},{projects:[full]}).projects[0],m2=merge({projects:[full]},{projects:[stub]}).projects[0];const j={id:'j1',status:'できた',result:'x',updatedAt:100},j2={id:'j1',status:'待ち',updatedAt:200};const mj=merge({jobs:[j]},{jobs:[j2]}).jobs[0];return{肉付けが残る:!!(m1.flesh&&m2.flesh&&m1.video&&m2.video),新しい方の値:m1.step===0&&m2.step===0,ほかの一覧は今までどおり:mj.status==='待ち'&&!('result' in mj)}});console.log('守り',f,JSON.stringify(r));await pg.close()}await b.close()})();
