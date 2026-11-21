"""カット割り（shots）を、決まりごとに照らして機械的に点検する。人に見せる前に必ず走らせ、出た指摘を直してから書き出す。
使い方: python3 lint_shots.py <data.json> <プロジェクトid> [<render_draft が出した .json>]
決まりごと（data.json の rules）は人が読む決まり、ここは「機械で見つけられる分」。新しい直しを受けたら、機械で見つけられるものはここにも足す。"""
import json,sys,re,collections
d=json.load(open(sys.argv[1],encoding='utf-8'));p=[x for x in d['projects'] if x['id']==sys.argv[2]][0]
tl=json.load(open(sys.argv[3])) if len(sys.argv)>3 else None
dur={s['tag']:s['end']-s['start'] for s in tl['shots']} if tl else {}
W=[];seen=collections.Counter();prev=None;k=0;NP=[0];DASH=set();src=''
live=[b for b in p['flesh']['blocks'] if b.get('mark')!='削る']
def kind(sh):
    if sh.get('seq'):return 'seq'
    return f"{sh.get('t')}:{sh.get('page','')}:{sh.get('mode','')}"
def is_photo(sh):return sh.get('t') in('photo','clip')
for k,b in enumerate(live,1):
    sents=b['narr']
    for i,sh in enumerate(b.get('shots') or []):
        tag=f'{k}-{i+1}';kd=kind(sh)
        # 場面の切り替えの言葉（at）と、合わせる言葉（ats）が語りにあるか（語りを直したあとにずれやすい）
        for w in ([sh['at']] if sh.get('at') else [])+list(sh.get('ats') or []):
            if w not in sents:W.append((tag,f'合わせる言葉「{w}」が語りにない（語りを直したら言葉も直す）'))
        # 文字の優先度は低い：部品に文字を渡していないか
        for key in('text','label','labels','name'):
            v=sh.get(key)
            if v and key!='name':W.append((tag,f'文字を出している（{key}={str(v)[:20]}）。図解の文字は最後の手段。絵で伝えられないか'))
        for it in sh.get('items') or []:
            if it.get('label'):W.append((tag,f"絵に文字が付いている（{it['label']}）")) ;break
        for ev in sh.get('events') or []:
            if ev.get('label'):W.append((tag,f"年表に文字（{ev['label']}）"));break
        if any(it.get('icon')=='question' for it in (sh.get('items') or [])+(sh.get('events') or []))or any(q.get('icon','question')=='question' for q in sh.get('pops') or []):W.append((tag,'「？」の絵を使っている（安っぽい）'))
        if sh.get('t') in('bigtext','year'):W.append((tag,'文字だけの画面は禁止'))
        for q in sh.get('punch') or []:
            if q.get('ring'):W.append((tag,'◯で囲んでいる：見せたい所が一か所のときだけ'))
        if sh.get('cam') and sh.get('cam')!='none':W.append((tag,'静止画をゆっくり動かしている（cam）'))
        # 字幕と画面の文字がかぶっていないか
        for key in('text','label'):
            v=str(sh.get(key) or '')
            if len(v)>=4 and v.replace('（イメージ）','') in sents:W.append((tag,f'画面の文字「{v}」が語りとほぼ同じ'))
        # 使い回し
        if kd in seen and not kd.startswith(('clip','photo','seq')):W.append((tag,f'同じ見せ方の使い回し（{kd}）。前にも出ている'))
        seen[kd]+=1
        # 一瞬の写真
        if tl and is_photo(sh) and dur.get(tag,9)<2.5:W.append((tag,f'写真・映像が{dur[tag]:.1f}秒しかない（一瞬の画像よりアニメ）'))
        # 短い場面でイラストと実写が交互
        if prev is not None and tl and dur.get(tag,9)<2.6 and is_photo(sh)!=is_photo(prev):W.append((tag,'短い場面でイラストと実写が入れ替わる（見づらい）'))
        # ブラウザの場面の中で文字を描いていないか（名札・カレンダーなど、文字が要る物は除く）
        if sh.get('t')=='html':
            import os
            src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'vis','html',sh['page']+'.html'),encoding='utf-8').read()
            if sh['page'] not in('person','calendar') and re.search(r"label\([^)]*'[^']*[ぁ-んァ-ヶ一-龠]",src):W.append((tag,f"ページ {sh['page']} の中で文字を描いている所がある（モードによる。目で確かめる）"))
        # 世界地図で寄るのは、1つの国だけに注目するとき
        if sh.get('t')=='map' and sh.get('zoom') and len(sh.get('highlight') or [])>1:W.append((tag,'世界地図で寄っているのに、国が2つ以上ある（寄るのは1つの国のときだけ）'))
        # 一つの画面は3〜6秒が目安：長すぎる場面
        if tl and dur.get(tag,0)>10:W.append((tag,f'場面が {dur[tag]:.0f} 秒続く（目安は3〜6秒。動き続けているか、分けられないか見る）'))
        # ぐいっと寄るのは頻発させない
        NP[0]+=len(sh.get('punch') or [])
        # 飾りの点々の線は使わない（ブラウザの場面のコードに点線があるか。地図の境など要る点線もあるので、目で確かめる）
        if sh.get('t')=='html' and sh['page'] not in DASH:
            DASH.add(sh['page'])
            if 'setLineDash([' in src.replace('setLineDash([])',''):W.append((tag,f"ページ {sh['page']} に点線を描く所がある（飾りの点々の線は使わない。モードによる。目で確かめる）"))
        prev=sh
    # 部品が自分で文字を出すもの（指定しなくても出る）
        if sh.get('t') in('wave','strip') and sh.get('text') is None:W.append((tag,f"{sh['t']} は text を空にしないと決まった文字を出す"))
    # 読み間違えやすい漢字
    for w in ['何なのか','何故','一日','今日は']:
        if w in sents:W.append((f'{k}-語り',f'読み間違えやすい「{w}」はひらがなに'))
    # 章の名前を言う／前の内容を覚えている前提で話す（動画はつなげて見る）
    for pat,why in [(r'第[0-9０-９一二三四五六七八九十]+章','「第○章」と言わない'),(r'冒頭の|先ほど|さっきの|前にお話し|覚えて(い|ま)','視聴者が前の内容を覚えている前提の言い方。中身をもう一度言う'),(r'舞台は','長くその話が続くと思わせる言い方')]:
        m_=re.search(pat,sents)
        if m_:W.append((f'{k}-語り',f'「{m_.group(0)}」：{why}'))
# 場面の切り替えの間：字幕がとぎれる所（作り手の決まり・2026-11-17「字幕が常に続くぐらいのテンポ」。止まった画面で待たない）
import os
_srt=sys.argv[3][:-5]+'.srt' if len(sys.argv)>3 else ''
GAPS=[]
if tl and os.path.exists(_srt):
    _t=lambda x:int(x[0:2])*3600+int(x[3:5])*60+int(x[6:8])+int(x[9:12])/1000
    cues=[(_t(m.group(1)),_t(m.group(2))) for m in re.finditer(r'(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})',open(_srt,encoding='utf-8').read())]
    _only=set((sys.argv[4] if len(sys.argv)>4 else '').split(','))-{''}   # 4つ目に章の名前（コンマ区切り）を書くと、その章だけ見る
    for (a0,a1),(b0,b1) in zip(cues,cues[1:]):
        if b0-a1>=0.6:
            sh=[x for x in tl['shots'] if x['start']-0.01<=a1<x['end']+0.01]
            tag=sh[-1]['tag'] if sh else '?';role=(sh[-1].get('role') or '') if sh else ''
            if _only and not any(role.startswith(c) for c in _only):continue
            GAPS.append((tag,b0-a1));W.append((tag,f'字幕が {b0-a1:.1f} 秒とぎれる（{int(a1//60)}分{a1%60:04.1f}秒〜）。待ち（hold）をやめ、アニメは語りの中で終わらせる'))
_total=(tl['shots'][-1]['end'] if tl and tl.get('shots') else 0)
if _total and NP[0]>max(1,_total/20):W.append(('全体',f'ぐいっと寄る所が {NP[0]} 回（{_total:.0f} 秒の動画。数十秒に一度より少なく）'))
for tag,msg in W:print(f'場面 {tag}: {msg}')
print(f'— 指摘 {len(W)} 件'+(f'（うち字幕のとぎれ {len(GAPS)} か所・合わせて {sum(x for _,x in GAPS):.0f} 秒）' if GAPS else ''))
