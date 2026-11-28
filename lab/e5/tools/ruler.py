#!/usr/bin/env python3
"""E5：物差し（部品の幅 w・面積）を、版 A の測った値から、ほかの版の関節の表へ写す（版が変わっても物差しを変えない。E4 と同じ決まり）。A を測ったあとに流す。"""
import glob, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
A = {j['name']: j for j in load(os.path.join(E4, 'out', 'A.json'))['joints']}
for p in sorted(glob.glob(os.path.join(E4, 'variants', '*.joints.json'))):
    if os.path.basename(p).startswith('P4'): continue
    s = load(p)
    for j in s['joints']:
        if j['name'] in A: j['w'] = A[j['name']]['w']; j['area'] = A[j['name']]['area']
    save(p, s); print(os.path.basename(p), [(j['name'], j.get('w')) for j in s['joints']][:3])
