"""カット割り（shots）を、決まりごとに照らして機械的に点検する。人に見せる前に必ず走らせ、出た指摘を直してから書き出す。
使い方: python3 lint_shots.py <data.json> <プロジェクトid> [<render_draft が出した .json>]
決まりごと（data.json の rules）は人が読む決まり、ここは「機械で見つけられる分」。新しい直しを受けたら、機械で見つけられるものはここにも足す。"""
import json,sys,re,collections
d=json.load(open(sys.argv[1],encoding='utf-8'));p=[x for x in d['projects'] if x['id']==sys.argv[2]][0]
tl=json.load(open(sys.argv[3])) if len(sys.argv)>3 else None
dur={s['tag']:s['end']-s['start'] for s in tl['shots']} if tl else {}
W=[];seen=collections.Counter();prev=None;k=0
live=[b for b in p['flesh']['blocks'] if b.get('mark')!='削る']
def kind(sh):
    if sh.get('seq'):return 'seq'
    return f"{sh.get('t')}:{sh.get('page','')}:{sh.get('mode','')}"
def is_photo(sh):return sh.get('t') in('photo','clip')
for k,b in enumerate(live,1):
    sents=b['narr']
    for i,sh in enumerate(b.get('shots') or []):
        tag=f'{k}-{i+1}';kd=kind(sh)
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
        prev=sh
    # 部品が自分で文字を出すもの（指定しなくても出る）
        if sh.get('t') in('wave','strip') and sh.get('text') is None:W.append((tag,f"{sh['t']} は text を空にしないと決まった文字を出す"))
    # 読み間違えやすい漢字
    for w in ['何なのか','何故','一日','今日は']:
        if w in sents:W.append((f'{k}-語り',f'読み間違えやすい「{w}」はひらがなに'))
    # 章の名前を言う／前の内容を覚えている前提で話す（動画はつなげて見る）
    for pat,why in [(r'第[0-9０-９一二三四五六七八九十]+章','「第○章」と言わない'),(r'冒頭の|先ほど|さっきの|前にお話し|覚えて(い|ま)','視聴者が前の内容を覚えている前提の言い方。中身をもう一度言う')]:
        m_=re.search(pat,sents)
        if m_:W.append((f'{k}-語り',f'「{m_.group(0)}」：{why}'))
for tag,msg in W:print(f'場面 {tag}: {msg}')
print(f'— 指摘 {len(W)} 件')
