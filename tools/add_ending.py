"""できあがった動画の最後に、エンディング（宇宙と地球の画面＋決まった曲）をつなぐ。本編は作り直さない（そのまま写す）。
使い方: python3 tools/add_ending.py <本編.mp4> <出力.mp4> --data <データのリポジトリ>/roadmap/apps/seisakushitsu/data.json --repo <データのリポジトリの根> --items car,speedo,tire
- エンディングの絵：tools/vis/html/ending.html（items＝その回に出てきた物。下の帯を横切る）。本編と同じ大きさ・コマ数で描く
- 曲：data.json の rules「エンディングの曲」＝音の棚の snd-ot20981（They）。出だしの無音を飛ばし、最初と最後をなめらかにして、大きさを --lufs（初期値 −15.5。試作で作り手が聞いた大きさ）に合わせる
- 長さ：--dur（初期値 20 秒。YouTube の終了画面が置けるのは最後の 5〜20 秒）
- 本編の終わりが暗くなって終わっていること（暗転）を前提にしている。つないだあと、全体を一度読み通して壊れていないかを確かめる（だめなら全体を作り直す道に切り替える）
"""
import argparse,json,os,subprocess,sys,tempfile,re
ap=argparse.ArgumentParser();ap.add_argument('main');ap.add_argument('out');ap.add_argument('--data',required=True);ap.add_argument('--repo',required=True)
ap.add_argument('--items',default='');ap.add_argument('--dur',type=float,default=20.0);ap.add_argument('--lufs',type=float,default=-15.5);ap.add_argument('--sound',default='snd-ot20981');ap.add_argument('--skip',type=float,default=1.2,help='曲の出だしを飛ばす秒')
a=ap.parse_args()
def sh(*c,**k):return subprocess.run(c,capture_output=True,text=True,**k)
def probe(f,sel,ent):return sh('ffprobe','-v','error','-select_streams',sel,'-show_entries',ent,'-of','csv=p=0',f).stdout.strip().split('\n')[0]
w,h,fr=probe(a.main,'v:0','stream=width,height,r_frame_rate').split(',')[:3];w,h=int(w),int(h);fps=eval(fr);ar=int(probe(a.main,'a:0','stream=sample_rate').split(',')[0]);md=float(probe(a.main,'v:0','format=duration') or sh('ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',a.main).stdout.strip())
assert abs(fps-30)<0.01,'本編が 30 コマ/秒ではない'
os.environ['SS_SCALE']=str(h/720);sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'vis'));import scenes
D=json.load(open(a.data));snd=[s for s in D['sounds'] if s['id']==a.sound][0];mus=os.path.join(a.repo,snd['file'])
T=tempfile.mkdtemp();ev=T+'/end_v.mp4';ea=T+'/end_a.m4a';em=T+'/end.mp4'
spec={'t':'html','page':'ending','items':[x for x in a.items.split(',') if x]};scenes.make(spec,a.dur,ev,a.repo)
ew,eh=probe(ev,'v:0','stream=width,height').split(',')[:2];assert (int(ew),int(eh))==(w,h),f'エンディングの大きさが本編と違う {ew}x{eh} / {w}x{h}'
# 曲：切り出して、最初と最後をなめらかに → 大きさを測って合わせる
flt=f"afade=t=in:st=0:d=1.0,afade=t=out:st={a.dur-3.5}:d=3.5"
m=sh('ffmpeg','-hide_banner','-nostats','-ss',str(a.skip),'-t',str(a.dur),'-i',mus,'-af',flt+',ebur128=framelog=quiet','-f','null','-').stderr
I=float(re.findall(r'I:\s+(-?[\d.]+) LUFS',m)[-1]);gain=a.lufs-I
r=sh('ffmpeg','-y','-loglevel','error','-ss',str(a.skip),'-t',str(a.dur),'-i',mus,'-af',f"{flt},volume={gain:.2f}dB,alimiter=limit=0.89:level=disabled",'-ar',str(ar),'-ac','2','-c:a','aac','-b:a','192k',ea);assert r.returncode==0,r.stderr
r=sh('ffmpeg','-y','-loglevel','error','-i',ev,'-i',ea,'-map','0:v','-map','1:a','-c','copy','-t',str(a.dur),em);assert r.returncode==0,r.stderr
# つなぐ（本編はそのまま写す）
lst=T+'/list.txt';open(lst,'w').write(f"file '{os.path.abspath(a.main)}'\nfile '{em}'\n")
r=sh('ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',lst,'-c','copy','-movflags','+faststart',a.out);assert r.returncode==0,r.stderr
# 点検：全体を読み通す・長さ・つなぎ目の音
chk=sh('ffmpeg','-v','error','-i',a.out,'-f','null','-').stderr.strip();od=float(sh('ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',a.out).stdout.strip())
ok=(not chk) and abs(od-(md+a.dur))<0.5
print(json.dumps({'ok':ok,'本編の秒':round(md,2),'エンディングの秒':a.dur,'できた動画の秒':round(od,2),'エンディングが始まる秒':round(md,2),'曲':snd['name'],'曲のもとの大きさLUFS':I,'合わせた大きさLUFS':a.lufs,'読み通しの異常':chk[:300],'大きさMB':round(os.path.getsize(a.out)/1e6,1)},ensure_ascii=False))
sys.exit(0 if ok else 1)
