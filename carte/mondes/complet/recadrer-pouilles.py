#!/usr/bin/env python3
"""Le cœur de chaque ville des Pouilles : un plan et un relief recadrés, ce que lit le jeu.

POURQUOI (Eugène, 2 octobre au soir) : « concentrer Gallipoli, Alberobello, Matera à de petites
parties de chacune de ces villes, sinon la map sera beaucoup trop grande — par exemple
restreindre Gallipoli à la vieille ville, et directement la gare de l'autre côté du pont, avec
une place bien chaleureuse ». Les extraits faisaient 2 à 3 km de côté, villes neuves comprises.

monde.js tire le cadre jouable des bords du relief fin (`fin`) : recadrer le relief suffit à
fermer la ville ; le relief entier reste, en horizon (`loin`), pour qu'on voie la campagne et
la mer au-delà. Le plan est recadré aussi (moins à charger) : on garde ce qui touche le cadre.

    python3 recadrer-pouilles.py       (après gradins-pouilles.py)

Entrées : pouilles-<ville>-gradins.json et relief-pouilles-<ville>-sol.json (gradins-pouilles.py).
Sorties : pouilles-<ville>-coeur.json (le plan) et relief-pouilles-<ville>-coeur.json.
"""
import json, os

ICI = os.path.dirname(os.path.abspath(__file__))
# x0, x1, z0, z1 en mètres, dans le repère de chaque ville (repere_pouilles.py)
CADRES = {
    # la vieille ville sur son île, le pont, le château angevin, et la place de la fontaine
    # grecque en face, sur la terre ferme, où l'on pose la gare
    'gallipoli':   {'plan': 'pouilles-gallipoli-gradins.json', 'cadre': (-330, 450, -270, 345)},
    # les deux Sassi, la Civita et la cathédrale, le château Tramontano et la place Vittorio
    # Veneto au-dessus, où l'on pose la gare (la vraie, Matera Centrale, est sous la ville neuve)
    'matera':      {'plan': 'pouilles-matera-gradins.json', 'cadre': (-530, 270, -290, 490)},
    # le Rione Monti (les trulli), la place du Peuple et la rue des Morea au-dessus ; la gare
    # posée au bout de la place du 27-Mai
    'alberobello': {'plan': 'pouilles-alberobello-gradins.json', 'cadre': (-230, 260, -345, 170)},
}


def dans(x, z, p):
    d = False; j = len(p) - 1
    for i in range(len(p)):
        xi, zi = p[i]; xj, zj = p[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
        j = i
    return d


def sans_chevauchement(bats):
    """Deux emprises qui se recouvrent (des emprises d'OSM déjà superposées, ou des gradins dont
    les fentes de rue se croisent) faisaient des murs l'un dans l'autre : on garde la plus grande.
    Le test est celui de bancs/lieu-pouilles.mjs — un point de l'intérieur, à 40 cm d'un sommet."""
    import math
    def aire(p): return abs(sum(p[k][0] * p[k + 1][1] - p[k + 1][0] * p[k][1] for k in range(len(p) - 1))) / 2
    def sondes(p):
        cx = sum(q[0] for q in p) / len(p); cz = sum(q[1] for q in p) / len(p); l = [(cx, cz)]
        for x, z in p:
            d = max(0.4, math.hypot(cx - x, cz - z)); l.append((x + (cx - x) * 0.4 / d, z + (cz - z) * 0.4 / d))
        return [q for q in l if dans(q[0], q[1], p)]
    gardes, grille, retires = [], {}, 0
    for b in sorted(bats, key=lambda b: -aire(b['pts'])):
        p = b['pts']; xs = [q[0] for q in p]; zs = [q[1] for q in p]
        cases = [(i, j) for i in range(int(min(xs) // 20), int(max(xs) // 20) + 1) for j in range(int(min(zs) // 20), int(max(zs) // 20) + 1)]
        voisins = {k for c in cases for k in grille.get(c, ())}
        mes = sondes(p)
        if any(any(dans(x, z, gardes[k]['pts']) for x, z in mes) or any(dans(x, z, p) for x, z in sondes(gardes[k]['pts'])) for k in voisins):
            retires += 1; continue
        for c in cases: grille.setdefault(c, []).append(len(gardes))
        gardes.append(b)
    return gardes, retires


def touche(pts, c, m=0):
    x0, x1, z0, z1 = c
    return any(x0 - m <= x <= x1 + m and z0 - m <= z <= z1 + m for x, z in pts)


for ville, d in CADRES.items():
    c = d['cadre']
    plan = json.load(open(os.path.join(ICI, d['plan'])))
    for k, v in list(plan.items()):
        if isinstance(v, list) and v and isinstance(v[0], dict) and 'pts' in v[0]:
            plan[k] = [e for e in v if touche(e['pts'], c, 20)]
        elif k == 'lieux':
            plan[k] = [l for l in v if c[0] <= l['x'] <= c[1] and c[2] <= l['z'] <= c[3]]
        elif isinstance(v, dict) and k in ('eau', 'verdure', 'cote'):
            plan[k] = {kk: ([e for e in vv if touche(e['pts'] if isinstance(e, dict) else e, c, 20)] if isinstance(vv, list) else vv) for kk, vv in v.items()}
    plan['batiments'], doublons = sans_chevauchement(plan['batiments'])
    plan['cadre_coeur'] = dict(zip(('x0', 'x1', 'z0', 'z1'), c))
    json.dump(plan, open(os.path.join(ICI, f'pouilles-{ville}-coeur.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

    R = json.load(open(os.path.join(ICI, f'relief-pouilles-{ville}-sol.json')))        # le sol nu (gradins-pouilles.py)
    i0 = max(0, int((c[0] - R['x0']) // R['pas'])); i1 = min(R['nx'] - 1, int(-(-(c[1] - R['x0']) // R['pas'])))
    j0 = max(0, int((c[2] - R['z0']) // R['pas'])); j1 = min(R['nz'] - 1, int(-(-(c[3] - R['z0']) // R['pas'])))
    S = {k: v for k, v in R.items() if k not in ('h', 'x0', 'z0', 'nx', 'nz')}
    S.update(x0=R['x0'] + i0 * R['pas'], z0=R['z0'] + j0 * R['pas'], nx=i1 - i0 + 1, nz=j1 - j0 + 1)
    S['h'] = [R['h'][j * R['nx'] + i] for j in range(j0, j1 + 1) for i in range(i0, i1 + 1)]
    json.dump(S, open(os.path.join(ICI, f'relief-pouilles-{ville}-coeur.json'), 'w'), separators=(',', ':'))
    print(f"{ville} : {len(plan['batiments'])} bâtiments ({doublons} recouvrements retirés) ; relief {S['nx']} × {S['nz']} (x {S['x0']:.0f}…, z {S['z0']:.0f}…)")
