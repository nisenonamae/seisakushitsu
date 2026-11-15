"""声の調整室（voice.html）と同じ手順で声を作る。本番の動画の声はこれで作るので、調整室で聞いた音と同じになる。

手順（voice.html の prepQuery / synthSent / renderQs と同じ）:
  1. VOICEVOX エンジンで AudioQuery を作る（または保存した調整の query を使う）
  2. 決まり（vrules）を当てはめる（Claude の案）
  3. 声の型（kata）：高さ（半音）と声の太さ（formant）を、高さの書き換え＋速さの書き換え＋再生速度の変更で行う
  4. 混ぜる相手があれば /synthesis_morphing
  5. 低音（200Hz 棚）・通り（3kHz 山）・明るさ（8kHz 棚）… Web Audio と同じ式の biquad
  6. 響き：同じ乱数（mulberry32, 種 7）で作った残響を畳み込む
  7. 一番大きい所を 0.89 にそろえる

エンジンは bash tools/setup_engine.sh で用意し、起動しておく（http://127.0.0.1:50021）。

使い方（単体で試す）:
  python3 tools/voice_render.py --voice <voice.json> --kata <型のid> --text "りんごは、おいしい。" --out a.wav [--claude]
"""
import json, math, io, wave, urllib.request, urllib.parse, re, copy
import numpy as np
from scipy.signal import lfilter, resample_poly, fftconvolve

ENG = 'http://127.0.0.1:50021'
LN2 = math.log(2)
SR = 48000


def eng(path, params=None, body=None, raw=False):
    qs = urllib.parse.urlencode(params or {})
    req = urllib.request.Request(f'{ENG}{path}' + (f'?{qs}' if qs else ''), method='GET' if body is None else 'POST',
                                 data=None if body is None else json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r:
        b = r.read()
    return b if raw else json.loads(b)


# ---------- 文の分け方・強調（voice.html と同じ） ----------
def split_sents(t):
    out, b = [], ''
    for ch in t.strip():
        b += ch
        if ch in '。！？!?':
            if b.strip(): out.append(b.strip())
            b = ''
    if b.strip(): out.append(b.strip())
    return out


def strip_emph(s):
    plain, em, st = '', [], -1
    for ch in s:
        if ch == '《': st = len(plain); continue
        if ch == '》':
            if st >= 0: em.append((st, len(plain)))
            st = -1; continue
        plain += ch
    return plain, em


def kana_of(text, speaker):
    try:
        ap = eng('/accent_phrases', {'text': text, 'speaker': speaker}, {})
        return ''.join(''.join(m['text'] for m in p['moras']) for p in ap)
    except Exception:
        return ''


# ---------- 決まり（voice.html の applyRules と同じ） ----------
def flat(q):
    return [m for ap in q['accent_phrases'] for m in ap['moras']]


def apply_rules(q, text, emk, rules, scene=''):
    for r in rules:
        if r.get('deleted') or r.get('active') is False: continue
        if r.get('scene') and r['scene'] != scene: continue
        p = r.get('p') or {}; op = r.get('op')
        if op == 'global':
            for k in ['speedScale', 'intonationScale', 'volumeScale', 'prePhonemeLength', 'postPhonemeLength']:
                if p.get(k) is not None: q[k] = p[k]
        elif op == 'end_fall':
            fm = [m for m in flat(q) if m['pitch'] > 0]; n = min(p.get('n', 2), len(fm))
            for i in range(n): fm[len(fm) - 1 - i]['pitch'] -= p.get('amt', 0.1) * (n - i) / n
        elif op == 'question':
            if re.search(r'[？?]$', text):
                fm = [m for m in flat(q) if m['pitch'] > 0]
                if fm: fm[-1]['pitch'] += p.get('amt', 0.2)
        elif op == 'comma_pause':
            for ap in q['accent_phrases']:
                if ap.get('pause_mora'): ap['pause_mora']['vowel_length'] += p.get('add', 0.05)
        elif op == 'emph':
            fm = flat(q); kana = ''.join(m['text'] for m in fm)
            for k in emk:
                at = kana.find(k)
                if at < 0: continue
                pos = 0
                for m in fm:
                    if at <= pos < at + len(k):
                        if m['pitch'] > 0: m['pitch'] += p.get('up', 0.15)
                        m['vowel_length'] *= p.get('stretch', 1.1)
                    pos += len(m['text'])
        elif op == 'emph_pause':   # 《》の言葉の直前に間を置く（1本に1〜2回まで）
            aps = q['accent_phrases']; kana = ''.join(m['text'] for ap in aps for m in ap['moras'])
            for k in emk:
                at = kana.find(k)
                if at < 0: continue
                pos = 0; hit = None
                for pi, ap in enumerate(aps):
                    L = sum(len(m['text']) for m in ap['moras'])
                    if pos <= at < pos + L: hit = pi; break
                    pos += L
                if hit and hit > 0:
                    prev = aps[hit - 1]; sec = p.get('sec', 0.45)
                    if prev.get('pause_mora'): prev['pause_mora']['vowel_length'] = max(prev['pause_mora']['vowel_length'], sec)
                    else: prev['pause_mora'] = {'text': '、', 'consonant': None, 'consonant_length': None, 'vowel': 'pau', 'vowel_length': sec, 'pitch': 0}
        elif op == 'first_up':
            if q['accent_phrases']:
                for m in q['accent_phrases'][0]['moras']:
                    if m['pitch'] > 0: m['pitch'] += p.get('amt', 0.05)
    return q


def queries_for(text, kata, rules=None, scene=''):
    """文章 → 文ごとの (文, AudioQuery)。rules があれば Claude の案（決まり）を当てはめる"""
    out = []
    for s in split_sents(text):
        plain, em = strip_emph(s)
        q = eng('/audio_query', {'text': plain, 'speaker': kata['speaker']}, {})
        emk = [k for k in (kana_of(plain[a:b], kata['speaker']) for a, b in em) if k]
        if rules: q = apply_rules(q, s, emk, rules, scene)
        out.append((s, q))
    return out


# ---------- 声の型 ----------
def prep_query(q, kata):
    x = copy.deepcopy(q); r = kata.get('formant') or 1
    sh = (kata.get('pitch') or 0) * LN2 / 12 - math.log(r)
    for ap in x['accent_phrases']:
        for m in ap['moras']:
            if m['pitch'] > 0: m['pitch'] += sh
    x['speedScale'] = q['speedScale'] / r; x['outputSamplingRate'] = 24000; x['outputStereo'] = False
    return x


def synth_sent(q, kata):
    """1文を作って、SR(48000) の float の列で返す（声の太さまで）"""
    x = prep_query(q, kata)
    if kata.get('mixTo') is not None and (kata.get('mixRate') or 0) > 0:
        b = eng('/synthesis_morphing', {'base_speaker': kata['speaker'], 'target_speaker': kata['mixTo'], 'morph_rate': kata['mixRate']}, x, raw=True)
    else:
        b = eng('/synthesis', {'speaker': kata['speaker']}, x, raw=True)
    with wave.open(io.BytesIO(b)) as w:
        y = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
    rate = round(24000 * (kata.get('formant') or 1))   # 再生速度を変える＝声の太さ
    g = math.gcd(SR, rate)
    return resample_poly(y, SR // g, rate // g)


def mora_ends(q):
    """AudioQuery からモーラごとの終わりの時刻（秒・話す速さ込み）。声の太さを変えても時間は変わらない"""
    t = q.get('prePhonemeLength', 0.1); ends = []
    for ap in q['accent_phrases']:
        for m in ap['moras']:
            t += (m.get('consonant_length') or 0) + m['vowel_length']; ends.append(t)
        if ap.get('pause_mora'): t += ap['pause_mora']['vowel_length']
    sp = q.get('speedScale', 1)
    return [e / sp for e in ends]


# ---------- 音の仕上げ（Web Audio の BiquadFilter と同じ式） ----------
def biquad(kind, f0, gain_db, Q=1.0):
    A = 10 ** (gain_db / 40); w0 = 2 * math.pi * f0 / SR; c = math.cos(w0); s = math.sin(w0)
    if kind == 'peaking':
        a = s / (2 * Q)
        b = [1 + a * A, -2 * c, 1 - a * A]; aa = [1 + a / A, -2 * c, 1 - a / A]
    else:
        aS = s / 2 * math.sqrt(2); sq = 2 * math.sqrt(A) * aS
        if kind == 'lowshelf':
            b = [A * ((A + 1) - (A - 1) * c + sq), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sq)]
            aa = [(A + 1) + (A - 1) * c + sq, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sq]
        else:
            b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
            aa = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    return np.array(b) / aa[0], np.array(aa) / aa[0]


def mulberry32(a):
    a &= 0xffffffff
    def f():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xffffffff
        t = ((a ^ (a >> 15)) * (1 | a)) & 0xffffffff
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & 0xffffffff)) & 0xffffffff) ^ t
        return ((t ^ (t >> 14)) & 0xffffffff) / 4294967296
    return f


def make_ir(length):
    n = max(1, round(length * SR)); rnd = mulberry32(7); d = np.empty(n)
    for i in range(n):
        t = i / SR; d[i] = (rnd() * 2 - 1) * math.exp(-6.9 * t / length) * (t / 0.004 if t < 0.004 else 1)
    return d / math.sqrt(float((d * d).sum()))


_IR = {}
def finish(y, kata, tail=True, norm=0.89):
    """低音・通り・明るさ・響きをかけ、大きさをそろえる"""
    n = len(y); L = (kata.get('reverbLen') or 0.6) if (kata.get('reverb') or 0) > 0 else 0
    x = np.concatenate([y, np.zeros(int(round(L * SR)) + 1 if tail else 0)])
    for kind, f0, g, Q in [('lowshelf', 200, kata.get('low') or 0, 1), ('peaking', 3000, kata.get('mid') or 0, 1), ('highshelf', 8000, kata.get('high') or 0, 1)]:
        if g: b, a = biquad(kind, f0, g, Q); x = lfilter(b, a, x)
    if L:
        key = round(L, 4)
        if key not in _IR: _IR[key] = make_ir(L)
        x = x + kata['reverb'] * fftconvolve(x, _IR[key])[:len(x)]
    pk = np.abs(x).max()
    return x * (norm / pk) if pk > 0 and norm else x


def render_text(text, kata, rules=None, scene='', gap=0.0):
    """文章をまるごと作る（調整室の「▶ いまの声」と同じ）。戻り値：48kHz の float 列"""
    parts = [synth_sent(q, kata) for _, q in queries_for(text, kata, rules, scene)]
    g = np.zeros(int(gap * SR))
    y = np.concatenate([p for x in parts for p in (x, g)]) if parts else np.zeros(1)
    return finish(y, kata)


def render_take(take):
    """保存した調整（voice.json の takes[]）をそのまま作り直す"""
    kata = take['kata']
    y = np.concatenate([synth_sent(s['q'], kata) for s in take['sents']])
    return finish(y, kata)


def write_wav(path, y, sr=SR):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())


def load_voice(path):
    V = json.load(open(path, encoding='utf-8'))
    return V


def pick_kata(V, kid=None):
    ks = [k for k in V.get('kata', []) if not k.get('deleted')]
    if kid:
        for k in ks:
            if k['id'] == kid or k.get('name') == kid: return k
        raise SystemExit(f'型 {kid} が voice.json にない')
    for k in ks:
        if k.get('main'): return k
    return ks[0]


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice'); ap.add_argument('--kata'); ap.add_argument('--text'); ap.add_argument('--out', default='voice.wav')
    ap.add_argument('--claude', action='store_true', help='決まり（vrules）を当てはめる'); ap.add_argument('--scene', default='')
    a = ap.parse_args()
    V = load_voice(a.voice) if a.voice else {'kata': [{'id': 'k', 'speaker': 2}], 'vrules': []}
    k = pick_kata(V, a.kata)
    write_wav(a.out, render_text(a.text, k, V.get('vrules') if a.claude else None, a.scene))
    print('wrote', a.out)
