#!/usr/bin/env python3
"""E6：脚の版（A）と基準 L2 に、E4 の物差し（tools/measure.py＝lab/e4/tools/measure.py の写し）を当てる。脚 4 本の付け根を回す。
付け根は絵のデータの pivot（どの版も同じ決まり）。物差し（w＝部品の幅・面積）は、基準 L2 の値を全部の版で使う（E4 の決まり：版が変わっても物差しは変えない）。
使い方：python3 tools/legs_measure.py <版の名前> …  →  out/関節/<版>.json・.png"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure
from e4lib import load, save
E6 = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(E6, 'out'); JD = os.path.join(OUT, '関節'); TMP = '/tmp/e6/joints'
os.makedirs(JD, exist_ok=True); os.makedirs(TMP, exist_ok=True)
LEGS = [('前脚（手前）', 'gLegFN'), ('前脚（奥）', 'legFF'), ('後ろ脚（手前）', 'gLegHN'), ('後ろ脚（奥）', 'legHF')]

def spec(name, ruler=None):
    p = os.path.join(OUT, name, name + '.json'); doc = load(p); by = {n['id']: n for n in doc['nodes']}; js = []
    for nm, nid in LEGS:
        ids = [n['id'] for n in doc['nodes'] if n.get('parent') == nid and n.get('geo')] if by[nid]['kind'] == 'group' else [nid]
        j = dict(name=nm, links=[dict(ids=ids, pivot=by[nid]['pivot'], frac=1)])
        if ruler: j.update(w=ruler[nm]['w'], area=ruler[nm]['area'])
        js.append(j)
    sp = os.path.join(TMP, name + '.joints.json'); save(sp, dict(title=name, doc=p, joints=js)); return sp

if __name__ == '__main__':
    rp = os.path.join(JD, 'L2.json')
    if not os.path.exists(rp): measure.run(spec('L2'), os.path.join(JD, 'L2'))
    ruler = {j['name']: j for j in load(rp)['joints']}
    for name in sys.argv[1:]:
        if name == 'L2': continue
        measure.run(spec(name, ruler), os.path.join(JD, name))
