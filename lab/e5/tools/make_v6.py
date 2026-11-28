#!/usr/bin/env python3
"""E4：同じ母カバ（variants/v1_e2.json＝lab/e2/compare/e2_final.json の写し）から、割る場所・関節の作りだけを変えた版を作る。
影絵の輪郭は変えない。形の足し引きは shapely（折れ線の多角形）でやり、できた形は「角の点だけの自由な形」で持たせる（清書していない）。
使い方：make_variants.py   → variants/v2…v6 の .json と .joints.json、P4 の関節の表
言葉：親＝受ける側（胴か頭）。つなぎ目＝親の輪郭のうち、回す部品の中を通る所。h＝つなぎ目の両端の距離の半分。c＝つなぎ目の両端の真ん中。
  R＝影絵ぜんたい。玉が入る深さ＝その点から影絵の外までの距離。"""
import copy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4lib import *
from shapely.geometry import Polygon, LineString, Point, MultiPoint, box
from shapely.ops import unary_union
from shapely.affinity import translate

V = os.path.join(E4, 'variants')
DEEP = {'頭': 70, '前脚（手前）': 40, '前脚（奥）': 40, '後ろ脚（手前）': 40, '後ろ脚（奥）': 40, '耳（手前）': 10, '耳（奥）': 10, 'しっぽ': 20}   # E2 v2 と同じ深さ


def polys(P, doc):
    out = {}
    for f in P.flat(doc, 32):
        if f['shadow']: continue
        if f['closed'] and f['fill']: g = Polygon(f['pts']).buffer(0)
        else: g = LineString(f['pts']).buffer((f['stroke'] or 1) / 2)
        out[f['id']] = g
    return out


def nodes_of(g, id, name, fill, **extra):
    gs = [g] if g.geom_type == 'Polygon' else [x for x in getattr(g, 'geoms', []) if x.geom_type == 'Polygon']
    gs = sorted([x for x in gs if x.area > 6], key=lambda x: -x.area); out = []
    for i, x in enumerate(gs):
        c = list(x.simplify(0.15).exterior.coords)[:-1]; nid = id if i == 0 else '%s.%d' % (id, i)
        n = dict(id=nid, name=name, kind='shape', parent=None, visible=True, locked=False,
                 geo=dict(t='path', closed=True, pts=[dict(id='%s.%d' % (nid, k), p=[round(a, 2), round(b, 2)], corner=True) for k, (a, b) in enumerate(c)]), fill=fill, stroke=None)
        n.update(extra); out.append(n)
    return out


class Fig:
    def __init__(self, P, doc, spec):
        self.P = P; self.doc = copy.deepcopy(doc); self.spec = copy.deepcopy(spec); self.pg = polys(P, self.doc)
        self.R = unary_union(list(self.pg.values())).buffer(0); self.log = []

    def idx(self, id): return next(i for i, n in enumerate(self.doc['nodes']) if n['id'] == id)
    def node(self, id): return self.doc['nodes'][self.idx(id)]
    def depth(self, p): pt = Point(p); return self.R.boundary.distance(pt) if self.R.contains(pt) else 0.0

    def seam(self, j):
        m = self.pg[j['main']]; par = self.pg[j['par']]; s = par.boundary.intersection(m)
        pts = []
        for g in getattr(s, 'geoms', [s]):
            if hasattr(g, 'coords'): pts += list(g.coords)
        a, b = max(((p, q) for p in pts for q in pts), key=lambda t: math.dist(*t))
        return s, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], math.dist(a, b) / 2

    def pivot_ball(self, j):
        """付け根を「半径 h の玉が影絵の中に入りきる所のうち、つなぎ目の真ん中 c にいちばん近い、親の中の点」に置く。無ければ、c から 2h までで、いちばん深い点"""
        s, c, h = self.seam(j); par = self.pg[j['par']]; st = max(1.0, h / 16); best = None; deep = None
        n = int(3 * h / st)
        for iy in range(-n, n + 1):
            for ix in range(-n, n + 1):
                p = [c[0] + ix * st, c[1] + iy * st]; d = math.dist(p, c)
                if d > 3 * h or not par.contains(Point(p)): continue
                dp = self.depth(p)
                if dp >= h and (best is None or d < best[0]): best = (d, p)
                if d <= 2 * h and (deep is None or dp > deep[0]): deep = (dp, p)
        p = best[1] if best else deep[1]
        return [round(p[0], 1), round(p[1], 1)], bool(best)

    def add_moving(self, j, new_ids):
        for jj in self.spec['joints']:
            for l in jj['links']:
                if j['main'] in l['ids']: l['ids'] += [i for i in new_ids if i not in l['ids']]

    def insert_after(self, id, nodes):
        i = self.idx(id) + 1; self.doc['nodes'][i:i] = nodes

    def set_main(self, j, g):
        old = self.node(j['main']); ns = nodes_of(g, old['id'], old['name'], old['fill'], parent=old.get('parent'), pivot=old.get('pivot'), rigParent=old.get('rigParent'))
        i = self.idx(j['main']); self.doc['nodes'][i:i + 1] = ns; self.add_moving(j, [n['id'] for n in ns])

    def over(self, j): return self.idx(j['main']) > self.idx(j['par'])

    def keep(self, j):
        """上に重なる部品を削るとき、下にある別の色の物（腹のピンク・首の影・線など）を隠している所は残す"""
        a, b = self.idx(j['par']), self.idx(j['main']); fill = self.node(j['main'])['fill']; gs = []
        for n in self.doc['nodes'][a + 1:b]:
            if n['id'] in self.pg and (n.get('fill') != fill or n.get('stroke')): gs.append(self.pg[n['id']].buffer(1.5))
        return unary_union(gs).intersection(self.pg[j['main']]) if gs else Polygon()

    def deep(self, j, d):
        m = self.pg[j['main']]; par = self.pg[j['par']]; P = j['links'][0]['pivot']; c = m.difference(par).centroid
        L = math.dist(P, (c.x, c.y)); u = ((P[0] - c.x) / L, (P[1] - c.y) / L); ov = m.intersection(par)
        sw = unary_union([translate(ov, u[0] * t, u[1] * t) for t in range(0, d + 1, 2)]).intersection(par.buffer(-2))
        if self.over(j):
            ns = nodes_of(sw, j['main'] + '.root', self.node(j['main'])['name'] + 'の重なり代', self.node(j['par'])['fill'])
            self.insert_after(j['par'], ns); self.add_moving(j, [n['id'] for n in ns])
        else: self.set_main(j, m.union(sw))
        self.log.append('%s：重なり代を付け根の向きへ %d 深く' % (j['name'], d))

    def round(self, j):
        m = self.pg[j['main']]; par = self.pg[j['par']]; P = j['links'][0]['pivot']; s, c, h = self.seam(j)
        r = max(2.0, min(self.depth(P) - 1.0, 1.2 * h)); disc = Point(P).buffer(r, 48)
        root = unary_union([disc, unary_union([disc, s]).convex_hull]).intersection(par.buffer(-1.5))
        vis = m.difference(par.buffer(-3))
        if self.over(j):
            ext = disc.intersection(m.difference(par))
            self.set_main(j, unary_union([vis, self.keep(j)]))
            ns = nodes_of(root, j['main'] + '.root', self.node(j['main'])['name'] + 'の丸い付け根', self.node(j['par'])['fill'])
            ex = nodes_of(ext, j['main'] + '.sock', self.node(j['par'])['name'] + 'の受け', self.node(j['par'])['fill']) if ext.area > 6 else []
            self.insert_after(j['par'], ex + ns); self.add_moving(j, [n['id'] for n in ns])
        else: self.set_main(j, unary_union([vis, root]))
        self.log.append('%s：付け根 (%.0f,%.0f)・玉の半径 %.0f（つなぎ目の半分 h=%.0f・玉が入る深さ %.0f）%s' % (j['name'], P[0], P[1], r, h, self.depth(P), '' if self.over(j) else '・下に重なる部品なので受けは足せない'))

    def out(self, name, title):
        self.spec['title'] = title; self.spec['doc'] = name + '.json'; self.spec['log'] = self.log
        save(os.path.join(V, name + '.json'), self.doc); save(os.path.join(V, name + '.joints.json'), self.spec)
        print(name, title); [print('   ', l) for l in self.log]


def main():
    """E5：E4 の版6 のやり方（割ったあとで、丸い形で受ける＋付け根を玉が入りきる深さへ）を、E5 の版 A に当てる → variants/V6.json"""
    base = load(os.path.join(V, 'A.json')); bspec = load(os.path.join(V, 'A.joints.json'))
    jaw = [j for j in bspec['joints'] if j['name'] == '下あご']; bspec['joints'] = [j for j in bspec['joints'] if j['name'] != '下あご']; bspec.pop('log', None)
    with Page() as P:
        f = Fig(P, base, bspec); ball = {}
        for j in f.spec['joints']:
            p, ok = f.pivot_ball(j); s, c, h = f.seam(j); old = j['links'][0]['pivot']; ball[j['name']] = p
        f = Fig(P, base, bspec)
        for j in f.spec['joints']:
            old = j['links'][0]['pivot']; j['links'][0]['pivot'] = ball[j['name']]; f.log.append('%s：付け根 (%.0f,%.0f) → (%.0f,%.0f)' % (j['name'], old[0], old[1], ball[j['name']][0], ball[j['name']][1]))
        for j in f.spec['joints']: f.round(j)
        f.spec['joints'] += jaw
        f.out('V6', 'V6 割ったあとで直す（E4 の版6 のやり方を A に）')


if __name__ == '__main__':
    main()
