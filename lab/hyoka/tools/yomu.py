#!/usr/bin/env python3
"""lab/hyoka：届いた「人の評価_<日付>.json」を読んで、PLAN.md の「読み方の決まり」のとおりに表にする。
使い方：python3 tools/yomu.py <人の評価.json> [--out 結果.md]
        python3 tools/yomu.py --selftest        （作り物の答えで、決まりどおりに動くかを試す）
決まりは PLAN.md のまま（変えない）。PLAN.md に書かれていなくて、ここで決めた読み方は、出す表のいちばん下「この道具が決めた読み方」に全部書く。
AI の評価者の結果は、PLAN.md の表を下の AI に写した物（届いた JSON には入っていない）。"""
import argparse, json, sys

CRIT = [('miryoku', '魅力'), ('kage', '影絵'), ('kao', '顔'), ('tsuriai', '体のつり合い'), ('kansetsu', '関節の自然さ'), ('ugoki', '動かしたときの自然さ'), ('zen_still', '全体（止まった絵）'), ('zen_move', '全体（動かす素材）')]
CN = dict(CRIT); STILL = ['miryoku', 'kage', 'kao', 'tsuriai', 'kansetsu', 'zen_still']; MOVE = ['ugoki', 'zen_move']
NAME = {'P4_AI': 'P4 の AI のみ', 'P4_H': 'P4 の人のみ', 'P4_S': 'P4 の下組み＋人', 'E5_A': 'E5 の A 通常', 'E5_D': 'E5 の D 関節の丸み', 'E5_E': 'E5 の E 組み合わせ', 'E5_F': 'E5 の F 脚のすき間なし',
        'E6_L2': '基準（L2）', 'E6_eye2': '目を 2 倍', 'E6_head121': '頭を 1.21 倍', 'E6_head152': '頭を 1.52 倍', 'E6_legShort': '脚を短く', 'E6_legLong': '脚を長く', 'E6_pillar': '柱', 'E6_zou': 'ゾウ足', 'E6_momo': '丸いもも', 'E6_hiza': 'ひざと足首'}
ORDER = list(NAME)
PAIRN = {1: '基準 対 目を 2 倍', 2: '基準 対 頭を 1.21 倍', 3: '脚を短く 対 脚を長く', 4: '基準 対 ゾウ足', 5: 'E5 の A 対 E（動き）', 6: 'E5 の A 対 F（動き）', 7: 'E5 の E 対 P4 の AI のみ（動き）', 8: 'E5 の E 対 P4 の AI のみ（止まった絵）', 9: 'P4 の AI のみ 対 人のみ', 10: 'P4 の AI のみ 対 下組み＋人'}
LEGS = ['E6_L2', 'E6_legShort', 'E6_legLong', 'E6_pillar', 'E6_zou', 'E6_momo', 'E6_hiza']
# AI の評価者の結果（PLAN.md の表の写し）
AI = {'eye2': '魅力が上がる（2人とも）。全体も上がる（2人とも）', 'head121': '割れた', 'head152': '魅力は上がるが、形とつり合いが下がる（2人とも）', 'legs': '短い方（2人とも）',
      'zou': '基準とほぼ同じ（1人がカバらしさを上げた）', 'worst': 'いちばん悪い（2人とも）', 'ade': '区別がつかない（止まった絵・動かした絵とも）', 'f': '動かした絵でいちばん悪い（2人とも）', 'p4': '止まった絵は P4 が下（2人とも）。動かした絵は割れた'}


def fmt(x):
    return '未測定' if x is None else ('%g' % round(x, 2))


class R:
    def __init__(self, D):
        if D.get('kind') != 'lab-hyoka-result' or D.get('rater') != 'human': raise SystemExit('このファイルは、人の評価（lab-hyoka-result・rater=human）ではありません')
        self.D = D; self.p1 = {}; self.p2 = {}
        for t in D['part1']['trials']: self.p1.setdefault(t['version'], []).append(t)
        for t in D['part2']['trials']: self.p2.setdefault(t['pair'], []).append(t)
        for v in self.p1.values(): v.sort(key=lambda t: t['index'])
        # ぶれ：同じ絵のくり返しに付いた点の差（項目ごと）
        self.rep = {}; self.jit = {}
        for k, ts in self.p1.items():
            if len(ts) >= 2: self.rep[k] = {c: (abs(ts[0]['scores'][c] - ts[1]['scores'][c]) if c in ts[0]['scores'] and c in ts[1]['scores'] else None) for c, _ in CRIT}
        for c, _ in CRIT:
            ds = [r[c] for r in self.rep.values() if r[c] is not None]; self.jit[c] = max(ds) if ds else None

    def s(self, v, c):
        xs = [t['scores'][c] for t in self.p1.get(v, []) if c in t.get('scores', {})]
        return sum(xs) / len(xs) if xs else None

    def diff(self, a, b, c):
        """1つずつの点：a − b。返すのは（差, 向き）。向き＝'up'（a が上）・'down'・'none'（差があるとは言えない）・None（未測定）"""
        x, y, j = self.s(a, c), self.s(b, c), self.jit[c]
        if x is None or y is None or j is None: return None, None
        d = x - y
        return d, (('up' if d > 0 else 'down') if abs(d) >= 1 and abs(d) > j else 'none')

    def pair(self, n, c):
        """2つを並べる組：左右を入れかえた2回とも同じ版 → その版／2回とも差なし → 'none'／割れた → 'split'／未測定 → None"""
        ts = self.p2.get(n, [])
        if len(ts) < 2 or any(c not in t['picks'] for t in ts[:2]): return None
        a, b = [t['picks'][c]['version'] for t in ts[:2]]
        return a if (a == b and a) else ('none' if a is None and b is None else 'split')


def dir_txt(d, dr, a, b):
    if dr is None: return '未測定'
    return '%s − %s ＝ %+g：%s' % (NAME[a], NAME[b], round(d, 2), {'up': '差がある（%s が上）' % NAME[a], 'down': '差がある（%s が下）' % NAME[a], 'none': '差があるとは言えない'}[dr])


def pair_txt(p):
    return {None: '未測定', 'none': '差なし（2回とも）', 'split': '決まらない（2回で割れた）'}.get(p, '差がある（2回とも %s）' % NAME.get(p, p))


def agree(ai, human):
    """ai・human＝'up'/'down'（向き）・'same'（差なし）・'split'（割れた・決まらない）・None（未測定）"""
    if human is None: return '未測定'
    if ai == 'split': return '比べられない（AI の評価者が割れた）'
    if human == 'split': return '決まらない'
    if ai == 'same': return '同じ（人も差があるとは言えない）' if human == 'same' else '合わなかった（AI は差なし・人は差がある）'
    if human == 'same': return '決まらない（人では差があるとは言えない）'
    return '同じ向き' if ai == human else '逆（合わなかった）'


def report(D):
    r = R(D); o = []; P = o.append
    done1 = [t for t in D['part1']['trials'] if t['done']]; done2 = [t for t in D['part2']['trials'] if t['done']]
    P('# 人の目での評価：読んだ結果\n')
    P('- 評価した人：**作り手1人（人）**。この結果は「作り手の好みと目」であり、視聴者の評価ではない。')
    P('- ページの版：%s／書き出した時刻：%s／乱数の種：%s／全部入れ終わったか：%s' % (D.get('page'), D.get('at'), D.get('seed'), 'はい' if D.get('complete') else '**いいえ（途中）**'))
    P('- 入った数：第1部 %d / %d・第2部 %d / %d／かかった時間：第1部 %.1f 分・第2部 %.1f 分' % (len(done1), len(D['part1']['trials']), len(done2), len(D['part2']['trials']), sum(t['ms'] for t in D['part1']['trials']) / 60000, sum(t['ms'] for t in D['part2']['trials']) / 60000))
    P('- 端末：%s／画面 %s・窓 %s・倍率 %s／動きの速さ %s コマ/秒' % (D['device'].get('ua'), D['device'].get('screen'), D['device'].get('window'), D['device'].get('dpr'), D.get('fps')))
    P('- P4 で描いた絵：人のみ＝%s・下組み＋人＝%s\n' % tuple('読みこんだ' if D['p4']['loaded'].get(k) else '無い' for k in 'hs'))

    P('## 1. ぶれ（同じ絵のくり返しに付いた点の差）\n')
    P('| 項目 | ' + ' | '.join('%s：1回め → 2回め（差）' % NAME[k] for k in r.rep) + ' | ぶれ（大きい方） |'); P('|---|' + '---|' * (len(r.rep) + 1))
    for c, n in CRIT:
        cells = []
        for k in r.rep:
            a, b = [t['scores'].get(c) for t in r.p1[k][:2]]; cells.append('未測定' if r.rep[k][c] is None else '%s → %s（%s）' % (a, b, r.rep[k][c]))
        P('| %s | %s | %s |' % (n, ' | '.join(cells), fmt(r.jit[c])))
    if not r.rep: P('（くり返しが入っていない。ぶれは未測定＝1つずつの点では「差がある」と言えない）')
    P('\n「これで動画に出せる」のくり返し：' + ('／'.join('%s＝%s → %s' % (NAME[k], *['はい' if t['ok'] else 'いいえ' if t['ok'] is False else '未測定' for t in r.p1[k][:2]]) for k in r.rep) or '未測定') + '\n')

    P('## 2. 1つずつの点（1〜5。2回見せた絵は、2回の平均）\n')
    P('| 版 | ' + ' | '.join(n for _, n in CRIT) + ' | 動画に出せる | ひとこと |'); P('|---|' + '---|' * (len(CRIT) + 2))
    for k in ORDER:
        if k not in r.p1: continue
        ts = r.p1[k]
        P('| %s | %s | %s | %s |' % (NAME[k], ' | '.join(('—' if r.s(k, c) is None else fmt(r.s(k, c))) for c, _ in CRIT), '・'.join('はい' if t['ok'] else 'いいえ' if t['ok'] is False else '未測定' for t in ts), ' ／ '.join(t['comment'].replace('|', '｜').replace('\n', ' ') for t in ts if t.get('comment'))))
    P('\n「—」＝動きが無い絵なので付けていない（未測定）。\n')

    P('## 3. 2つを並べる組（左右を入れかえて2回。2回とも同じ版を選んだ時だけ「差がある」）\n')
    P('| 組 | 項目 | 1回め（左／右 → 選び） | 2回め | 読み |'); P('|---|---|---|---|---|')
    for n in sorted(PAIRN):
        ts = r.p2.get(n, [])
        if not ts: P('| %d %s | — | — | — | 未測定（出していない） |' % (n, PAIRN[n])); continue
        for c in (MOVE[:1] + ['kansetsu', 'zen_move'] if ts[0]['mode'] == 'motion' else STILL):
            cell = lambda t: '%s／%s → %s' % (NAME[t['left']], NAME[t['right']], ('未測定' if c not in t['picks'] else {'left': '左', 'right': '右', 'none': '差なし'}[t['picks'][c]['side']]))
            P('| %d %s | %s | %s | %s | %s |' % (n, PAIRN[n], CN[c], cell(ts[0]), cell(ts[1]) if len(ts) > 1 else '未測定', pair_txt(r.pair(n, c))))
    P('')

    P('## 4. AI の評価者と合ったか（項目ごと）\n')
    P('| 問い | AI の評価者（PLAN.md の表）| 見た所 | 人（作り手）の結果 | 合ったか |'); P('|---|---|---|---|---|')
    def row1(q, ai_txt, a, b, c, ai):
        d, dr = r.diff(a, b, c); P('| %s | %s | 1つずつ：%s | %s | %s |' % (q, ai_txt, CN[c], dir_txt(d, dr, a, b), agree(ai, {'none': 'same'}.get(dr, dr))))
    def row2(q, ai_txt, n, c, a, ai):
        """a＝AI の向きで「上」に当たる版"""
        p = r.pair(n, c); h = None if p is None else 'same' if p == 'none' else 'split' if p == 'split' else ('up' if p == a else 'down')
        P('| %s | %s | 並べる（組 %d）：%s | %s | %s |' % (q, ai_txt, n, CN[c], pair_txt(p), agree(ai, h)))
    for c in ['miryoku', 'zen_still']: row1('目を 2 倍にすると', AI['eye2'], 'E6_eye2', 'E6_L2', c, 'up'); row2('目を 2 倍にすると', AI['eye2'], 1, c, 'E6_eye2', 'up')
    for c in STILL: row1('頭を 1.21 倍にすると', AI['head121'], 'E6_head121', 'E6_L2', c, 'split')
    for c in STILL: row2('頭を 1.21 倍にすると', AI['head121'], 2, c, 'E6_head121', 'split')
    for c, ai in [('miryoku', 'up'), ('kage', 'down'), ('tsuriai', 'down')]: row1('頭を 1.52 倍にすると', AI['head152'], 'E6_head152', 'E6_L2', c, ai)
    row1('脚を短く 対 長く', AI['legs'], 'E6_legShort', 'E6_legLong', 'zen_still', 'up'); row2('脚を短く 対 長く', AI['legs'], 3, 'zen_still', 'E6_legShort', 'up')
    row1('ゾウ足', AI['zou'], 'E6_zou', 'E6_L2', 'zen_still', 'same'); row2('ゾウ足', AI['zou'], 4, 'zen_still', 'E6_zou', 'same')
    def worst(q, ai_txt, group, targets, c):
        sc = {k: r.s(k, c) for k in group}
        if any(v is None for v in sc.values()) or r.jit[c] is None: return P('| %s | %s | 1つずつ：%s | 未測定 | 未測定 |' % (q, ai_txt, CN[c]))
        tmax = max(sc[k] for k in targets); tmin = min(sc[k] for k in targets); oth = [sc[k] for k in group if k not in targets]; gap = min(oth) - tmax
        line = '、'.join('%s %s' % (NAME[k], fmt(sc[k])) for k in sorted(group, key=lambda k: sc[k]))
        v = '同じ（いちばん下で、差もある）' if gap >= 1 and gap > r.jit[c] else '決まらない（いちばん下だが、差があるとは言えない）' if gap > 0 else '逆（合わなかった。いちばん上）' if tmin > max(oth) else '決まらない（いちばん下ではない・並んでいる）'
        P('| %s | %s | 1つずつ：%s | 低い順：%s | %s |' % (q, ai_txt, CN[c], line, v))
    worst('丸いもも・ひざと足首', AI['worst'], LEGS, ['E6_momo', 'E6_hiza'], 'zen_still')
    for a, b in [('E5_D', 'E5_A'), ('E5_E', 'E5_A'), ('E5_E', 'E5_D')]:
        for c in ['zen_still', 'ugoki', 'zen_move']: row1('E5 の A・D・E', AI['ade'], a, b, c, 'same')
    for c in ['kansetsu', 'ugoki', 'zen_move']: row2('E5 の A・D・E', AI['ade'], 5, c, 'E5_E', 'same')
    for c in MOVE: worst('E5 の F', AI['f'], ['E5_A', 'E5_D', 'E5_E', 'E5_F', 'P4_AI'], ['E5_F'], c)
    for c in MOVE: row2('E5 の F', AI['f'], 6, c, 'E5_A', 'up')
    for b in ['E5_A', 'E5_D', 'E5_E']: row1('P4 の AI のみ 対 E5 の版（止まった絵）', AI['p4'], 'P4_AI', b, 'zen_still', 'down')
    row2('P4 の AI のみ 対 E5 の版（止まった絵）', AI['p4'], 8, 'zen_still', 'P4_AI', 'down')
    for c in MOVE: row1('P4 の AI のみ 対 E5 の版（動かした絵）', AI['p4'], 'P4_AI', 'E5_E', c, 'split'); row2('P4 の AI のみ 対 E5 の版（動かした絵）', AI['p4'], 7, c, 'P4_AI', 'split')
    P('')

    P('## 5. 「プロ級に届いた」か\n')
    P('条件（PLAN.md）：全体（止まった絵）と全体（動かす素材）の両方が 5、または両方が 4 以上で「これで動画に出せる」に はい。\n')
    hit = []; P('| 版 | 見せた回 | 全体（止まった絵）| 全体（動かす素材）| 動画に出せる | 条件 |'); P('|---|---|---|---|---|---|')
    for k in ORDER:
        oks = []
        for i, t in enumerate(r.p1.get(k, [])):
            a, b = t['scores'].get('zen_still'), t['scores'].get('zen_move')
            ok = None if a is None or b is None else bool((a == 5 and b == 5) or (a >= 4 and b >= 4 and t['ok'] is True)); oks.append(ok)
            P('| %s | %d | %s | %s | %s | %s |' % (NAME[k], i + 1, fmt(a), fmt(b), 'はい' if t['ok'] else 'いいえ' if t['ok'] is False else '未測定', '未測定（動かす素材の点が無い）' if ok is None else '満たす' if ok else '満たさない'))
        if oks and all(x is True for x in oks): hit.append(k)
        elif any(x is True for x in oks): P('| %s | — | | | | くり返しで割れた（満たす回と満たさない回がある）→ 届いたとは数えない |' % NAME[k])
    P('\n**結論：%s**\n' % ('届いた版がある（%s）' % '・'.join(NAME[k] for k in hit) if hit else '届いていない'))

    P('## 6. 本番の描く画面・制作方式を決める材料にしてよいか\n')
    three = all(any(t['done'] for t in r.p1.get(k, [])) for k in ['P4_AI', 'P4_H', 'P4_S'])
    P('P4 の3つ（AI のみ・人のみ・下組み＋人）が評価されたか：AI のみ＝%s・人のみ＝%s・下組み＋人＝%s' % tuple('された' if any(t['done'] for t in r.p1.get(k, [])) else 'されていない' for k in ['P4_AI', 'P4_H', 'P4_S']))
    P('\n**結論：%s**\n' % ('材料にしてよい（3つがそろった）' if three else 'その判断は持ちこす（3つがそろっていない）'))
    if three:
        P('| 版 | ' + ' | '.join(CN[c] for c in STILL) + ' |'); P('|---|' + '---|' * len(STILL))
        for k in ['P4_AI', 'P4_H', 'P4_S']: P('| %s | %s |' % (NAME[k], ' | '.join(fmt(r.s(k, c)) for c in STILL)))
        P('')

    miss = ['第1部 No.%s' % t['no'] for t in D['part1']['trials'] if not t['done']] + ['第2部 組 No.%s' % t['no'] for t in D['part2']['trials'] if not t['done']]
    P('## 7. 未測定の物\n')
    P('- 入れ終わっていない物：' + ('・'.join(miss) if miss else 'なし'))
    P('- 止まった絵だけの版（目を 2 倍・頭を 1.21 倍・頭を 1.52 倍・P4 の人のみ・P4 の下組み＋人）の、動きの項目')
    P('- AI の評価者の「カバらしさ」（ゾウ足）に当たる項目は、この評価には無い\n')
    P('## この道具が決めた読み方（PLAN.md に書かれていない所）\n')
    P('- ぶれ＝項目ごとに、2つのくり返し（基準 L2・E5 の A）の差のうち**大きい方**。くり返しが入っていない項目は、ぶれが未測定＝「差がある」と言わない。')
    P('- 2回見せた絵（基準 L2・E5 の A）の点は、2回の**平均**で比べた。')
    P('- 「差がある」＝差の大きさが 1 以上、かつ、ぶれより大きい（同じは入れない）。')
    P('- 「いちばん悪い」＝その版の点が、ほかの全部の版より低く、いちばん近い版との差が「差がある」の条件を満たす時だけ「同じ」。')
    P('- 「プロ級」＝2回見せた絵は、2回とも条件を満たした時だけ数える。')
    P('- E5 の A と基準（L2）は、ほぼ同じ絵（元のデータの点の差は 0.01 まで）だが、PLAN.md のとおり別の版として扱い、ぶれには入れていない。')
    return '\n'.join(o) + '\n'


def fake(over=None):
    """作り物の答え（決まりを試す用）"""
    base = dict(miryoku=3, kage=3, kao=3, tsuriai=3, kansetsu=3, ugoki=3, zen_still=3, zen_move=3)
    mot = {'P4_AI', 'E5_A', 'E5_D', 'E5_E', 'E5_F', 'E6_L2', 'E6_legShort', 'E6_legLong', 'E6_pillar', 'E6_zou', 'E6_momo', 'E6_hiza'}
    sc = {k: dict(base) for k in ORDER if not k.startswith('P4_') or k == 'P4_AI'}; sc.update(over or {})
    t1 = []; i = 0
    for k, s in sc.items():
        for rep in ([False, True] if k in ('E6_L2', 'E5_A') else [False]):
            i += 1; s2 = dict(s if not rep else sc.get(k + '#2', s)); s2 = {c: v for c, v in s2.items() if c in STILL or k in mot}
            t1.append(dict(id='a%d' % i, index=i, no=i + 10, version=k, repeat=rep, done=True, scores=s2, ok=s2.pop('ok', False) if 'ok' in s2 else False, comment='', ms=40000))
    return dict(kind='lab-hyoka-result', v=1, rater='human', page='試し', at='-', seed=1, complete=True, fps=16, device={}, p4=dict(loaded=dict(h=False, s=False)), part1=dict(trials=t1), part2=dict(trials=[]))


def ptrial(n, i, left, right, mode, pick):
    cs = MOVE + ['kansetsu'] if mode == 'motion' else STILL
    return dict(id='b%d' % i, index=i, no=50 + i, pair=n, presentation=1, mode=mode, left=left, right=right, done=True, comment='', ms=30000,
                picks={c: dict(side=pick, version=left if pick == 'left' else right if pick == 'right' else None) for c in cs})


def selftest():
    f = 0
    def ck(ok, m):
        nonlocal f; print(('  ○ ' if ok else '  × ') + m); f += 0 if ok else 1
    hi = lambda **k: dict(dict(miryoku=3, kage=3, kao=3, tsuriai=3, kansetsu=3, ugoki=3, zen_still=3, zen_move=3), **k)
    # ① ぶれ 1（L2 の魅力 3 → 4）。目 2 倍の魅力 5：平均 3.5 との差 1.5 ＞ ぶれ 1 → 差がある。全体は 4：差 1 ＝ ぶれ 0 より大きい → 差がある
    D = fake({'E6_L2#2': hi(miryoku=4), 'E6_eye2': hi(miryoku=5, zen_still=4), 'E6_head152': hi(miryoku=4), 'E6_momo': hi(zen_still=1), 'E6_hiza': hi(zen_still=2), 'E5_F': hi(ugoki=1, zen_move=1), 'E5_E': hi(zen_still=5, zen_move=5)})
    D['part2']['trials'] = [ptrial(1, 1, 'E6_L2', 'E6_eye2', 'still', 'right'), ptrial(3, 2, 'E6_legShort', 'E6_legLong', 'still', 'left'), ptrial(4, 3, 'E6_L2', 'E6_zou', 'still', 'none'), ptrial(1, 4, 'E6_eye2', 'E6_L2', 'still', 'left'),
                            ptrial(3, 5, 'E6_legLong', 'E6_legShort', 'still', 'left'), ptrial(4, 6, 'E6_zou', 'E6_L2', 'still', 'none')]
    r = R(D)
    ck(r.jit['miryoku'] == 1 and r.jit['kage'] == 0, 'ぶれ：魅力 1・影絵 0')
    ck(r.diff('E6_eye2', 'E6_L2', 'miryoku') == (1.5, 'up'), '差 1.5・ぶれ 1 → 差がある（上）')
    ck(r.diff('E6_head152', 'E6_L2', 'miryoku')[1] == 'none', '差 0.5 → 差があるとは言えない')
    ck(r.diff('E6_eye2', 'E6_L2', 'zen_still')[1] == 'up', '差 1・ぶれ 0 → 差がある')
    ck(r.diff('E6_eye2', 'E6_L2', 'ugoki')[1] is None, '動きの無い版の動きの項目 → 未測定')
    ck(r.pair(1, 'miryoku') == 'E6_eye2', '組：左右を入れかえて2回とも同じ版 → 差がある')
    ck(r.pair(3, 'zen_still') == 'split', '組：2回とも「左」＝版は割れた → 決まらない')
    ck(r.pair(4, 'zen_still') == 'none' and r.pair(5, 'ugoki') is None, '組：2回とも差なし／出していない組は未測定')
    t = report(D)
    ck('| 目を 2 倍にすると | 魅力が上がる（2人とも）。全体も上がる（2人とも） | 1つずつ：魅力 | 目を 2 倍 − 基準（L2） ＝ +1.5：差がある（目を 2 倍 が上） | 同じ向き |' in t, '表：AI と同じ向き')
    ck('並べる（組 3）：全体（止まった絵） | 決まらない（2回で割れた） | 決まらない |' in t, '表：割れた組は「決まらない」')
    ck('並べる（組 4）：全体（止まった絵） | 差なし（2回とも） | 同じ（人も差があるとは言えない） |' in t, '表：ゾウ足は差なしで AI と同じ')
    ck('| 丸いもも・ひざと足首 |' in t and '同じ（いちばん下で、差もある）' in t, '表：いちばん悪い')
    ck('届いた版がある（E5 の E 組み合わせ）' in t, 'プロ級：両方 5 の版がある')
    ck('その判断は持ちこす' in t, 'P4 の3つがそろわない → 持ちこす')
    # ② ぶれが大きいと、同じ差でも「差がある」と言わない／プロ級が無い／逆向き
    D = fake({'E6_L2#2': hi(miryoku=5), 'E6_eye2': hi(miryoku=5), 'E6_legShort': hi(zen_still=2), 'E6_legLong': hi(zen_still=4), 'E5_A': hi(zen_still=4, zen_move=4, ok=True), 'E5_A#2': hi(zen_still=4, zen_move=4, ok=False)})
    r = R(D); t = report(D)
    ck(r.jit['miryoku'] == 2 and r.diff('E6_eye2', 'E6_L2', 'miryoku')[1] == 'none', 'ぶれ 2・差 1 → 差があるとは言えない')
    ck('脚を短く − 脚を長く ＝ -2：差がある（脚を短く が下） | 逆（合わなかった） |' in t, '表：AI と逆なら「合わなかった」と書く')
    ck('**結論：届いていない**' in t and 'くり返しで割れた' in t, 'プロ級：くり返しで割れたら数えない')
    try: R(dict(D, rater='ai')); ck(False, 'rater が human でないと読まない')
    except SystemExit: ck(True, 'rater が human でないと読まない')
    print('失敗 %d' % f); return f


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('file', nargs='?'); ap.add_argument('--out'); ap.add_argument('--selftest', action='store_true'); a = ap.parse_args()
    if a.selftest: sys.exit(1 if selftest() else 0)
    if not a.file: ap.error('読むファイルを指定してください')
    t = report(json.load(open(a.file, encoding='utf-8')))
    if a.out: open(a.out, 'w', encoding='utf-8').write(t); print('書いた：', a.out)
    else: print(t)
