#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le relief et le plan JOUÉS de l'Aveyron : relief-aveyron-jeu.json et aveyron-jeu.json.

monde.js prend la zone jouable dans l'emprise du relief « fin » : avec relief-aveyron-lac.json
(1,1 × 1,2 km), Saint-Symphorien, 3,8 km à l'est, restait hors du jeu. On fond donc en UNE
grille de 5 m, dans le repère de repere_aveyron.py, les reliefs récoltés :
le bourg (LiDAR HD, 2 m) > le lac (LiDAR HD, 5 m) > le monde (RGE ALTI, 10 m) > les environs (50 m),
chaque nœud prenant la source la plus fine qui le couvre (bilinéaire, comme monde.js).

Et la grande sécheresse (STORY.md, acte II : « les rivières sont à sec, l'eau est la richesse ») :
le LiDAR voit la SURFACE du lac, plate. On y creuse une cuvette (pente de 1 pour 8, 9 m au plus)
et l'eau ne reste que là où elle a plus de 4 m de fond : le lac « bas ». Le plan joué garde ce
contour d'étiage à la place du lac plein, et perd les ruisseaux (à sec). aveyron.json, lui, ne
change pas : c'est la carte vraie.

    python3 fondre-relief-aveyron.py
"""
import json, math, os, sys

ICI = os.path.dirname(os.path.abspath(__file__))
PAS = 5.0
X0, X1, Z0, Z1 = -525.0, 4200.0, -730.0, 625.0     # le lac, le plateau, le bourg
PENTE, FOND, ETIAGE = 8.0, 9.0, 4.0                # cuvette 1/8, 9 m au plus ; eau là où > 4 m

def charge(n):
    R = json.load(open(os.path.join(ICI, 'relief-aveyron-%s.json' % n)))
    return R

SOURCES = [charge(n) for n in ('bourg', 'lac', 'monde', 'environs')]

def alt(x, z):
    for R in SOURCES:
        fx, fz = (x - R['x0']) / R['pas'], (z - R['z0']) / R['pas']
        if 0 <= fx <= R['nx'] - 1 and 0 <= fz <= R['nz'] - 1:
            i, j = min(int(fx), R['nx'] - 2), min(int(fz), R['nz'] - 2)
            u, v, h, n = fx - i, fz - j, R['h'], R['nx']
            return (h[j * n + i] * (1 - u) + h[j * n + i + 1] * u) * (1 - v) + (h[(j + 1) * n + i] * (1 - u) + h[(j + 1) * n + i + 1] * u) * v
    return None

def dans(x, z, pts):
    d = False
    for i in range(len(pts)):
        (xi, zi), (xj, zj) = pts[i], pts[i - 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
    return d

def dist_bord(x, z, pts):
    best = 1e9
    for i in range(len(pts) - 1):
        (ax, az), (bx, bz) = pts[i], pts[i + 1]
        dx, dz = bx - ax, bz - az; L = dx * dx + dz * dz
        t = 0 if L == 0 else max(0, min(1, ((x - ax) * dx + (z - az) * dz) / L))
        best = min(best, math.hypot(x - ax - t * dx, z - az - t * dz))
    return best

A = json.load(open(os.path.join(ICI, 'aveyron.json')))
lac = next(p for p in A['eau']['plans'] if (p.get('nom') or '').startswith('Lac de Saint-Gervais'))
LP = lac['pts']

nx, nz = int(round((X1 - X0) / PAS)) + 1, int(round((Z1 - Z0) / PAS)) + 1
h, D = [], [0.0] * (nx * nz)          # D : distance à la rive, dans le lac
for j in range(nz):
    for i in range(nx):
        x, z = X0 + i * PAS, Z0 + j * PAS
        h.append(alt(x, z))
# la surface du lac plein : la médiane des nœuds DANS le lac (le LiDAR y voit l'eau, plate) —
# pas celle des sommets du contour, qui tombent sur la berge, 4 m plus haut
dedans_h = sorted(h[j * nx + i] for j in range(nz) for i in range(nx) if dans(X0 + i * PAS, Z0 + j * PAS, LP))
NIVEAU = dedans_h[len(dedans_h) // 2]
creuses = 0
for j in range(nz):
    for i in range(nx):
        x, z = X0 + i * PAS, Z0 + j * PAS
        if dans(x, z, LP):
            d = dist_bord(x, z, LP); D[j * nx + i] = d
            h[j * nx + i] = min(h[j * nx + i], NIVEAU - min(FOND, d / PENTE)); creuses += 1

# ---- le contour d'étiage : la courbe D = PENTE × ETIAGE, par les carrés qui marchent ----
SEUIL = PENTE * ETIAGE
def g(i, j): return D[j * nx + i] - SEUIL
segs = []
for j in range(nz - 1):
    for i in range(nx - 1):
        c = [g(i, j), g(i + 1, j), g(i + 1, j + 1), g(i, j + 1)]
        if all(v < 0 for v in c) or all(v >= 0 for v in c): continue
        P = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
        pts = []
        for k in range(4):
            a, b = c[k], c[(k + 1) % 4]
            if (a < 0) != (b < 0):
                t = a / (a - b); (pi, pj), (qi, qj) = P[k], P[(k + 1) % 4]
                pts.append((round(X0 + (pi + t * (qi - pi)) * PAS, 2), round(Z0 + (pj + t * (qj - pj)) * PAS, 2)))
        if len(pts) == 2: segs.append(tuple(pts))
        elif len(pts) == 4: segs += [(pts[0], pts[1]), (pts[2], pts[3])]
# recoudre les segments en anneaux
voisins = {}
for a, b in segs:
    voisins.setdefault(a, []).append(b); voisins.setdefault(b, []).append(a)
vus, anneaux = set(), []
for a, b in segs:
    if (a, b) in vus: continue
    boucle, prec, cur = [a], a, b; vus.add((a, b)); vus.add((b, a))
    while cur != a and len(boucle) < 100000:
        boucle.append(cur)
        suiv = [n for n in voisins[cur] if (cur, n) not in vus]
        if not suiv: break
        n = suiv[0]; vus.add((cur, n)); vus.add((n, cur)); prec, cur = cur, n
    if cur == a and len(boucle) >= 4: anneaux.append(boucle + [a])

def aire(p): return abs(sum(p[k][0] * p[k + 1][1] - p[k + 1][0] * p[k][1] for k in range(len(p) - 1))) / 2
anneaux = [p for p in anneaux if aire(p) > 150]      # pas de flaques de quelques mètres

# ---- les fichiers ----
json.dump({'note': "relief JOUÉ de l'Aveyron (fondre-relief-aveyron.py) : bourg LiDAR 2 m > lac LiDAR 5 m > "
                   "monde RGE ALTI 10 m > environs 50 m, ré-échantillonnés au pas de 5 m dans le repère de "
                   "repere_aveyron.py ; le lac creusé pour la sécheresse (cuvette 1/8, 9 m au plus)",
           'pas': PAS, 'x0': X0, 'z0': Z0, 'nx': nx, 'nz': nz, 'niveauPlein': round(NIVEAU, 2),
           'niveauBas': round(NIVEAU - ETIAGE, 2), 'min': round(min(h), 2), 'max': round(max(h), 2),
           'h': [round(v, 2) for v in h]}, open(os.path.join(ICI, 'relief-aveyron-jeu.json'), 'w'), separators=(',', ':'))
J = json.loads(json.dumps(A))
J['note'] = ("plan JOUÉ de l'Aveyron (fondre-relief-aveyron.py) : aveyron.json pendant la grande sécheresse — "
             "le lac de Saint-Gervais réduit à son contour d'étiage (eau.plans), les ruisseaux à sec (eau.lits), "
             "le lac plein gardé pour la grève (eau.lacPlein). La carte vraie reste aveyron.json.")
J['eau']['lacPlein'] = {'pts': LP, 'niveau': round(NIVEAU, 2)}
J['eau']['plans'] = [p for p in J['eau']['plans'] if p is not lac and not (p.get('nom') or '').startswith('Lac de Saint-Gervais')] + \
                    [{'pts': [[round(x, 1), round(z, 1)] for x, z in p], 'nom': 'Lac de Saint-Gervais (étiage)'} for p in anneaux]
J['eau']['lits'] = J['eau']['cours']; J['eau']['cours'] = []
# le bâti, les rues et les chemins : aveyron.js les bâtit lui-même (un toit par aile, terre-plein
# sous chaque maison, rues collées au relief — consigne de précision d'Eugène, 2 octobre) ; on les
# range sous d'autres clés pour que monde.js ne les bâtisse pas une seconde fois
J['bati'], J['batiments'] = J['batiments'], []
J['rues'], J['routes'] = J['routes'], []
J['sentiers'], J['chemins'] = J['chemins'], []
json.dump(J, open(os.path.join(ICI, 'aveyron-jeu.json'), 'w'), separators=(',', ':'), ensure_ascii=False)

print('relief-aveyron-jeu.json : %d × %d nœuds au pas de %g m, %.0f Ko, de %.0f à %.0f m' % (
    nx, nz, PAS, os.path.getsize(os.path.join(ICI, 'relief-aveyron-jeu.json')) / 1024, min(h), max(h)))
print('lac : surface %.2f m, %d nœuds creusés ; étiage à %.2f m : %d nappes, %.1f ha d’eau sur %.1f'
      % (NIVEAU, creuses, NIVEAU - ETIAGE, len(anneaux), sum(aire(p) for p in anneaux) / 1e4, aire(LP) / 1e4))
