#!/usr/bin/env python3
"""E2 工程 1（A）：実物の写真に目印を置き、比の表と、目印と箱だけの図を作る。
目印は作る係（Claude）が画像を見て置いた物。写真が小さい（640px）ので、±5px ほどの誤差がある。
出す物：stages/s1_A_landmarks.json・stages/s1_A_比と箱.png"""
import json, os, subprocess, glob
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
E2 = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(E2))
REF = os.path.join(ROOT, 'docs', 'refs', 'jitsubutsu', 'カバ')
OUT = os.path.join(E2, 'stages')


def font(sz):
    try:
        p = subprocess.run(['fc-match', '-f', '%{file}', 'Noto Sans CJK JP'], capture_output=True, text=True).stdout.strip()
        return ImageFont.truetype(p, sz)
    except Exception:
        return ImageFont.load_default()


# ---- 写真ごとの目印（元の写真の画素。x は右へ、y は下へ）。None＝その写真では見えない ----
PHOTOS = [
    dict(key='P7', file='Hippos_in_the_Hluhluwe_Umfolozi_Game_Reserve_web_004.8s.jpg',
         note='立っている大人・真横・右向き。脚と腹は手前のカバに隠れている',
         crop=(160, 108, 544, 270), zoom=3,
         lm={'鼻先': (335.7, 165.3), '鼻の穴': (330, 160.7), '目': (311.7, 158), '耳の付け根': (302.7, 154),
             '首のしわ（頭の後ろ）': (288.3, 154.7), 'あごの下': (320, 184), '肩（き甲）': (270, 148.7),
             '背中のいちばん高い所': (240, 145.7), '腰': (205, 150), 'しっぽの付け根': (190.7, 161.3),
             'おしりの後ろ': (189.3, 174.7), '胴の下（見える所まで）': (203, 196.3)}),
    dict(key='P0', file='003_Baby_Hippopotamus_in_the_rain_at_Queen_Eliza_001.3s.jpg',
         note='奥の母：左向き・頭と背中の上は画面の外。脚と腹が見える。手前の子はななめ向き（比には使わない）',
         crop=(0, 0, 640, 240), zoom=2,
         lm={'背中の上（画面の端で切れている）': (250, 0), '腹のいちばん低い所': (232, 134), '前脚の前のふち': (97, 150),
             '前脚の後ろのふち': (138, 150), '足首（前脚）': (118, 176), '地面（奥の前脚の足の下）': (182, 192),
             'しっぽの付け根': (466, 12), 'おしりの後ろ': (482, 60), '胸の前': (22, 100)}),
    dict(key='P4', file='Hippopotamus_River_jpg.jpg',
         note='頭の真横（左向き・口を開けている）。上あごの形・目と耳と鼻の穴の位置',
         crop=(250, 20, 640, 330), zoom=2,
         lm={'鼻先': (278, 95), '鼻の穴': (330, 50), '目': (440, 80), '耳の付け根': (497, 96), '耳の先': (505, 74),
             '頭のてっぺん': (470, 64), '首のしわ（頭の後ろ）': (545, 112), '上あごの下（口の線）': (330, 125), '鼻づらの上': (330, 45)}),
    dict(key='P9', file='Hippos_watching_from_the_water_6073670010_jpg.jpg',
         note='頭のななめ横（左向き・水から上だけ）。目・耳・鼻の穴が同じ高さに並ぶこと',
         crop=(250, 120, 640, 260), zoom=3,
         lm={'鼻先': (283, 221), '鼻の穴': (320, 197), '目': (467, 191), '耳の付け根': (507, 177), '耳の先': (500, 148), '頭のてっぺん': (480, 170)}),
]


def d(a, b, ax=None):
    if ax == 'x': return abs(a[0] - b[0])
    if ax == 'y': return abs(a[1] - b[1])
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** .5


def ratios():
    L = {p['key']: p['lm'] for p in PHOTOS}
    R = []   # (名前, {写真: 値}, 説明)
    p7, p0, p4, p9 = L['P7'], L['P0'], L['P4'], L['P9']
    tot7 = d(p7['鼻先'], p7['おしりの後ろ'], 'x')
    R.append(('頭の長さ（鼻先→首のしわ）÷ 全長', {'P7': d(p7['鼻先'], p7['首のしわ（頭の後ろ）'], 'x') / tot7}, '全長＝鼻先→おしりの後ろ'))
    R.append(('目の位置（鼻先0→耳の付け根1）', {k: d(l['鼻先'], l['目'], 'x') / d(l['鼻先'], l['耳の付け根'], 'x') for k, l in (('P7', p7), ('P4', p4), ('P9', p9))}, '目は耳のすぐ前'))
    R.append(('鼻の穴の位置（鼻先0→耳の付け根1）', {k: d(l['鼻先'], l['鼻の穴'], 'x') / d(l['鼻先'], l['耳の付け根'], 'x') for k, l in (('P7', p7), ('P4', p4), ('P9', p9))}, '鼻の穴は鼻づらの上の面'))
    R.append(('鼻づらの高さ（鼻の穴→あごの下）÷ 頭の長さ（鼻先→耳）', {'P7': d(p7['鼻の穴'], p7['あごの下'], 'y') / d(p7['鼻先'], p7['耳の付け根'], 'x')}, 'P4 は口を開けているので測らない'))
    R.append(('上あごだけの高さ ÷ 頭の長さ（鼻先→耳）', {'P4': d(p4['鼻づらの上'], p4['上あごの下（口の線）'], 'y') / d(p4['鼻先'], p4['耳の付け根'], 'x')}, '口の線は、鼻づらの高さの半分より下'))
    R.append(('耳の高さ ÷ 頭の長さ（鼻先→耳）', {'P4': d(p4['耳の付け根'], p4['耳の先']) / d(p4['鼻先'], p4['耳の付け根'], 'x'), 'P9': d(p9['耳の付け根'], p9['耳の先']) / d(p9['鼻先'], p9['耳の付け根'], 'x')}, '耳は小さい'))
    R.append(('胴の高さ（背中→胴の下）÷ 全長', {'P7': d(p7['背中のいちばん高い所'], p7['胴の下（見える所まで）'], 'y') / tot7}, '下は隠れているので「これ以上」'))
    R.append(('背中のいちばん高い所（おしり0→鼻先1）', {'P7': d(p7['背中のいちばん高い所'], p7['おしりの後ろ'], 'x') / tot7}, '真ん中より後ろ寄り'))
    R.append(('肩の落ち（背中の高い所→肩）÷ 胴の高さ', {'P7': d(p7['背中のいちばん高い所'], p7['肩（き甲）'], 'y') / d(p7['背中のいちばん高い所'], p7['胴の下（見える所まで）'], 'y')}, '背中はほぼ水平'))
    R.append(('しっぽの付け根の高さ（背中0→胴の下1）', {'P7': d(p7['背中のいちばん高い所'], p7['しっぽの付け根'], 'y') / d(p7['背中のいちばん高い所'], p7['胴の下（見える所まで）'], 'y')}, 'おしりの上の方'))
    clr = d(p0['腹のいちばん低い所'], p0['地面（奥の前脚の足の下）'], 'y')
    R.append(('腹から地面 ÷ 立った高さ（背中→地面）', {'P0': clr / d(p0['背中の上（画面の端で切れている）'], p0['地面（奥の前脚の足の下）'], 'y')}, '背中が切れているので「これ以下」。見立ては 0.27 前後'))
    R.append(('脚の太さ ÷ 腹から地面', {'P0': d(p0['前脚の前のふち'], p0['前脚の後ろのふち'], 'x') / clr}, '脚は、見えている長さに近い太さ'))
    return R


# ---- 崩し方（倍率）と、決めた箱（1600×900 の画面の上） ----
KUZUSHI = [
    ('頭の長さ ÷ 全長', 0.32, 0.95, '頭を大きくしすぎない（目標 7）。写真とほぼ同じ'),
    ('鼻づらの高さ ÷ 頭の長さ', 0.71, 0.95, '大きく角ばった鼻づらは残す。前の面をほぼ垂直に立てる'),
    ('腹から地面 ÷ 立った高さ', 0.27, 0.9, '脚を少し短く。腹を地面に近づける（目標 6）'),
    ('脚の太さ ÷ 腹から地面', 0.68, 1.25, '脚は太く短い柱に。棒にしない（ひざ・足首でくびれを少し）'),
    ('耳の高さ ÷ 頭の長さ', 0.14, 1.3, '耳は影絵で読めるよう少し大きく'),
    ('目の大きさ', 1, 1.3, '目は少しだけ大きく（かわいさ）。大きくしすぎない'),
    ('胴の高さ ÷ 全長', 0.33, 1.0, '樽の胴はそのまま'),
    ('しわ・線', None, None, '線は口・首のしわ・目の上など 6 本まで。皮ふのぶつぶつ・ひげは省く'),
    ('つめ', None, None, '足1つに 3 つまで（実物は 4 本指）。奥の脚は省く'),
]
# 箱（x0,y0,x1,y1）：頭は左向き。地面 y=770
GROUND = 770
BOX = {
    '胴': (560, 296, 1330, 656), '頭': (222, 330, 560, 608), '鼻づら': (222, 388, 380, 590),
    '前脚（手前）': (668, 630, 778, 770), '前脚（奥）': (556, 620, 652, 770),
    '後ろ脚（手前）': (1150, 600, 1282, 770), '後ろ脚（奥）': (1036, 630, 1132, 770),
    '耳（手前）': (502, 280, 552, 332), 'しっぽ': (1318, 420, 1354, 545),
}
MARK = {
    '鼻先': (222, 480), '鼻の穴': (272, 402), '目': (436, 372), '耳の付け根': (520, 326), '肩（き甲）': (680, 308),
    '背中のいちばん高い所': (990, 296), '腰': (1180, 318), 'しっぽの付け根': (1320, 425), '腹のいちばん低い所': (900, 656),
    'ひざ（前脚）': (722, 690), '足首（前脚）': (722, 738), 'ひざ（後ろ脚）': (1205, 672), '足首（後ろ脚）': (1222, 735), '地面': (722, 770),
    'あごの下': (330, 590), '首のしわ（頭の後ろ）': (560, 340), 'おしりの後ろ': (1330, 500),
}


def design_ratios():
    m = MARK; tot = m['おしりの後ろ'][0] - m['鼻先'][0]; hl = m['耳の付け根'][0] - m['鼻先'][0]
    return {
        '頭の長さ（鼻先→首のしわ）÷ 全長': (m['首のしわ（頭の後ろ）'][0] - m['鼻先'][0]) / tot,
        '目の位置（鼻先0→耳の付け根1）': (m['目'][0] - m['鼻先'][0]) / hl,
        '鼻の穴の位置（鼻先0→耳の付け根1）': (m['鼻の穴'][0] - m['鼻先'][0]) / hl,
        '鼻づらの高さ（鼻の穴→あごの下）÷ 頭の長さ（鼻先→耳）': (m['あごの下'][1] - m['鼻の穴'][1]) / hl,
        '耳の高さ ÷ 頭の長さ（鼻先→耳）': (BOX['耳（手前）'][3] - BOX['耳（手前）'][1]) / hl,
        '胴の高さ（背中→胴の下）÷ 全長': (m['腹のいちばん低い所'][1] - m['背中のいちばん高い所'][1]) / tot,
        '背中のいちばん高い所（おしり0→鼻先1）': (m['おしりの後ろ'][0] - m['背中のいちばん高い所'][0]) / tot,
        '肩の落ち（背中の高い所→肩）÷ 胴の高さ': (m['肩（き甲）'][1] - m['背中のいちばん高い所'][1]) / (m['腹のいちばん低い所'][1] - m['背中のいちばん高い所'][1]),
        'しっぽの付け根の高さ（背中0→胴の下1）': (m['しっぽの付け根'][1] - m['背中のいちばん高い所'][1]) / (m['腹のいちばん低い所'][1] - m['背中のいちばん高い所'][1]),
        '腹から地面 ÷ 立った高さ（背中→地面）': (GROUND - m['腹のいちばん低い所'][1]) / (GROUND - m['背中のいちばん高い所'][1]),
        '脚の太さ ÷ 腹から地面': (BOX['前脚（手前）'][2] - BOX['前脚（手前）'][0]) / (GROUND - m['腹のいちばん低い所'][1]),
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    R = ratios(); D = design_ratios()
    table = []
    for name, vals, memo in R:
        vs = list(vals.values())
        table.append(dict(name=name, photos={k: round(v, 3) for k, v in vals.items()}, min=round(min(vs), 3), max=round(max(vs), 3), design=(round(D[name], 3) if name in D else None), memo=memo))
    json.dump(dict(kind='lab-e2-stageA', note='目印は作る係が画像を見て置いた（±5px）。写真は docs/refs/jitsubutsu/カバ/',
                   photos=[dict(key=p['key'], file=p['file'], note=p['note'], landmarks=p['lm']) for p in PHOTOS],
                   ratios=table, kuzushi=[dict(what=a, photo=b, mult=c, why=e) for a, b, c, e in KUZUSHI],
                   design=dict(ground=GROUND, boxes=BOX, marks=MARK)),
              open(os.path.join(OUT, 's1_A_landmarks.json'), 'w'), ensure_ascii=False, indent=1)

    # ---- 画像：上＝写真と目印、下＝目印と箱だけの図 ----
    f12, f14, f18 = font(12), font(15), font(20)
    W = 1600; top_h = 545
    sheet = Image.new('RGB', (W, top_h + 900), 'white'); dr = ImageDraw.Draw(sheet)
    x = 8; y = 30; rowh = 0
    dr.text((8, 4), '工程 1（A）実物の写真に置いた目印（赤い点）。数字は表（s1_A_landmarks.json・RESULTS.md）', fill='black', font=f14)
    for p in PHOTOS:
        im = Image.open(os.path.join(REF, p['file'])).convert('RGB')
        c = p['crop']; z = p['zoom']; cw = (c[2] - c[0]) * z; chh = (c[3] - c[1]) * z
        k = min(1, 790 / cw, 230 / chh); z2 = z * k
        t = im.crop(c).resize((int((c[2] - c[0]) * z2), int((c[3] - c[1]) * z2)), Image.LANCZOS)
        if x + t.width > W: x = 8; y += rowh + 22; rowh = 0
        sheet.paste(t, (x, y)); dr.text((x, y + t.height + 1), p['key'] + '：' + p['note'], fill='black', font=f12)
        for i, (nm, q) in enumerate(p['lm'].items()):
            px = x + (q[0] - c[0]) * z2; py = y + (q[1] - c[1]) * z2
            dr.ellipse((px - 4, py - 4, px + 4, py + 4), fill='#ff2020', outline='white')
            dr.text((px + 5, py - 14 + (i % 2) * 12), nm[:6], fill='#ffff00', font=f12, stroke_width=2, stroke_fill='black')
        x += t.width + 10; rowh = max(rowh, t.height)
    # 箱の図
    oy = top_h
    dr.rectangle((0, oy, W - 1, oy + 899), fill='#DDE9C8')
    dr.text((10, oy + 8), '目印と箱だけの図（崩したあと・1600×900）。青＝箱、赤＝目印、茶＝地面', fill='black', font=f18)
    dr.line((0, oy + GROUND, W, oy + GROUND), fill='#8a6a3a', width=2)
    for nm, b in BOX.items():
        dr.rectangle((b[0], oy + b[1], b[2], oy + b[3]), outline='#2060d0', width=2)
        dr.text((b[0] + 4, oy + b[1] + 3), nm, fill='#2060d0', font=f14)
    for i, (nm, q) in enumerate(MARK.items()):
        dr.ellipse((q[0] - 5, oy + q[1] - 5, q[0] + 5, oy + q[1] + 5), fill='#e02020')
        dr.text((q[0] + 7, oy + q[1] - 20), nm, fill='#a01010', font=f12)
    # 比の表（右上の空き）
    ty = oy + 40; tx = 760
    dr.text((tx, ty), '比（写真の幅 → 決めた値）', fill='black', font=f14); ty += 20
    for r in table:
        if r['design'] is None: continue
        rng = ('%.2f' % r['min']) if r['min'] == r['max'] else ('%.2f〜%.2f' % (r['min'], r['max']))
        dr.text((tx, ty), '・' + r['name'] + '：' + rng + ' → ' + ('%.2f' % r['design']), fill='#303030', font=f12); ty += 16
    sheet.save(os.path.join(OUT, 's1_A_比と箱.png'))
    for r in table: print(r['name'], r['photos'], '→', r['design'])


if __name__ == '__main__':
    main()
