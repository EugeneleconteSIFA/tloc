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

Le RESSERREMENT (Eugène, 5 octobre : emprise « A ») : on ne marche plus que sur le lac et ses
rives — les trois maisons des Roquette, le barrage du duel, la source des Vergnes et la fontaine
du lac, 810 × 820 m (ZONE). Saint-Symphorien ne sert pas à l'histoire (STORY.md ne le nomme
pas) : il quitte la zone jouable et ne reste qu'au loin, dans le relief des environs, comme
le village de Saint-Gervais. La grille fine déborde de BANDE mètres autour de la zone : c'est
la campagne qu'on voit derrière la haie (aveyron.js y plante le bois et y ferme la marche), et
le relief y glisse vers celui des environs, pour que la couture avec l'horizon ne se voie pas.
La version complète (4,7 × 1,4 km, jusqu'au bourg) est dans complet/.

    py -3 fondre-relief-aveyron.py
"""
import json, math, os, sys

ICI = os.path.dirname(os.path.abspath(__file__))
PAS = 5.0
# x0, x1, z0, z1 : là où l'on marche. 520 et non 500 à l'est : le chemin de Roubiliergues longe ce
# bord, à 2 m près, et le franchissait trois fois (trois barrières à la suite)
ZONE = (-290.0, 520.0, -350.0, 470.0)
BANDE = 60.0                                       # la campagne derrière la haie
X0, X1, Z0, Z1 = ZONE[0] - BANDE, ZONE[1] + BANDE, ZONE[2] - BANDE, ZONE[3] + BANDE
PENTE, FOND, ETIAGE = 8.0, 9.0, 4.0                # cuvette 1/8, 9 m au plus ; eau là où > 4 m

def charge(n):
    R = json.load(open(os.path.join(ICI, 'relief-aveyron-%s.json' % n), encoding='utf-8'))
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

def alt_loin(x, z):
    # le relief des environs seul (50 m) : monde.js en fait l'horizon, maillé à ses nœuds ;
    # entre deux nœuds, la maille passe à peu près par l'interpolation bilinéaire
    R = SOURCES[-1]
    fx, fz = (x - R['x0']) / R['pas'], (z - R['z0']) / R['pas']
    i, j = min(int(fx), R['nx'] - 2), min(int(fz), R['nz'] - 2); u, v, h, n = fx - i, fz - j, R['h'], R['nx']
    return (h[j * n + i] * (1 - u) + h[j * n + i + 1] * u) * (1 - v) + (h[(j + 1) * n + i] * (1 - u) + h[(j + 1) * n + i + 1] * u) * v

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

# (encoding='utf-8' partout : sous Windows, open() lit et écrit en cp1252 — les accents du plan sortaient cassés)
A = json.load(open(os.path.join(ICI, 'aveyron.json'), encoding='utf-8'))
lac = next(p for p in A['eau']['plans'] if (p.get('nom') or '').startswith('Lac de Saint-Gervais'))
LP = lac['pts']

nx, nz = int(round((X1 - X0) / PAS)) + 1, int(round((Z1 - Z0) / PAS)) + 1
h, D = [], [0.0] * (nx * nz)          # D : distance à la rive, dans le lac
for j in range(nz):
    for i in range(nx):
        x, z = X0 + i * PAS, Z0 + j * PAS
        # dans la bande, le relief fin glisse vers celui des environs (l'horizon de monde.js) :
        # au bord de la grille, les deux reliefs se rejoignent
        d = max(ZONE[0] - x, x - ZONE[1], ZONE[2] - z, z - ZONE[3], 0.0)
        w = min(1.0, d / (BANDE - 10)); w = w * w * (3 - 2 * w)
        h.append(alt(x, z) * (1 - w) + alt_loin(x, z) * w if w else alt(x, z))
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

# ---- les terre-pleins des trois maisons Roquette (5 octobre : on entre dans les maisons) ----
# Une maison sur la pente repose sur un terre-plein : son rez-de-chaussée est plat. Le jeu en a
# besoin pour de bon — on y marche, et le moteur ne sait pas poser un plancher sous une maison
# tournée (ses planchers sont alignés sur les axes). Le relief est mis de niveau sous l'emprise de
# chaque maison et une maille autour (le relief est au pas de 5 m : sans elle, l'interpolation
# remontait dans la maison), à la médiane du terrain d'origine, puis raccordé sur 7 m.
# Les emprises sont celles d'aveyron.js (batut(), beauregard(), pouget()), dans le repère de chaque
# maison : façade vers +z, tournée vers le lac — rot = atan2(−X, −Z).
MAISONS = [  # X, Z, [x0, x1, z0, z1] de l'emprise, tours et ailes comprises
    (-135, 170, (-11.5, 14.5, -5.0, 5.0)),     # le Batut : les trois corps
    (400, 150, (-8.5, 8.5, -4.5, 8.4)),        # Beauregard : le logis et sa tour d'escalier
    (185, -315, (-18.0, 10.0, -5.0, 6.0)),     # le Pouget : le corps, la tour carrée, l'aile basse
]
REPLATS = []
for X_, Z_, (a0, a1, b0, b1) in MAISONS:
    rot = math.atan2(-X_, -Z_); c, s = math.cos(rot), math.sin(rot)
    local = lambda x, z: ((x - X_) * c - (z - Z_) * s, (x - X_) * s + (z - Z_) * c)
    hors = lambda lx, lz: max(a0 - lx, lx - a1, b0 - lz, lz - b1, 0.0)      # distance à l'emprise
    sous = sorted(h[j * nx + i] for j in range(nz) for i in range(nx) if hors(*local(X0 + i * PAS, Z0 + j * PAS)) == 0)
    F = sous[len(sous) // 2] if sous else None
    if F is None: continue
    for j in range(nz):
        for i in range(nx):
            d = hors(*local(X0 + i * PAS, Z0 + j * PAS))
            if d <= PAS: h[j * nx + i] = F
            elif d < PAS + 7: w = (d - PAS) / 7; w = w * w * (3 - 2 * w); h[j * nx + i] = F * (1 - w) + h[j * nx + i] * w
    REPLATS.append({'x': X_, 'z': Z_, 'niveau': round(F, 2)})

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
           'h': [round(v, 2) for v in h]}, open(os.path.join(ICI, 'relief-aveyron-jeu.json'), 'w', encoding='utf-8'), separators=(',', ':'))
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

# ---- le plan recadré sur la grille : ce qui est au-delà n'est plus qu'horizon ----
G0, G1, H0_, H1_ = X0 + 2, X1 - 2, Z0 + 2, Z1 - 2
dans_grille = lambda x, z: G0 <= x <= G1 and H0_ <= z <= H1_
dans_zone = lambda x, z: ZONE[0] <= x <= ZONE[1] and ZONE[2] <= z <= ZONE[3]
def couper(c):
    """Une ligne coupée au bord de la grille : ses tronçons dedans. Là où elle sort, le bout est
    cherché à 2 m près (une rue ne s'arrête pas au sommet d'OSM d'avant, mais au bord même)."""
    out, cur, pts = [], [], c['pts']
    for k, (x, z) in enumerate(pts):
        de = k and dans_grille(*pts[k - 1]); ici = dans_grille(x, z)
        if k and de != ici:            # on franchit le bord : le dernier point dedans, à 2 m près
            (px, pz) = pts[k - 1]; n = max(1, math.ceil(math.hypot(x - px, z - pz) / 2))
            seg = [(px + (x - px) * t / n, pz + (z - pz) * t / n) for t in range(n + 1)]
            bord = [q for q in seg if dans_grille(*q)]
            q = bord[-1] if de else bord[0]
            if de: cur.append([round(q[0], 2), round(q[1], 2)]); out.append(cur); cur = []
            else: cur = [[round(q[0], 2), round(q[1], 2)]]
        if ici: cur.append([x, z])
    if cur: out.append(cur)
    return [dict(c, pts=t) for t in out if len(t) >= 2]
for cle in ('rues', 'sentiers'):
    J[cle] = [t for c in J[cle] for t in couper(c)]
J['eau']['lits'] = [t for c in J['eau']['lits'] for t in couper(c)]
J['bati'] = [b for b in J['bati'] if all(dans_zone(x, z) for x, z in b['pts'])]
J['lieux'] = [l for l in J['lieux'] if dans_zone(l['x'], l['z']) or l.get('k') == 'dormeur']
touche = lambda p: any(dans_grille(x, z) for x, z in p['pts'])
for k in J['verdure']: J['verdure'][k] = [p for p in J['verdure'][k] if touche(p)]
J['eau']['plans'] = [p for p in J['eau']['plans'] if touche(p)]
J['cadres'] = [{'src': 'fondre-relief-aveyron.py', 'x0': X0, 'x1': X1, 'z0': Z0, 'z1': Z1}]
J['zone'] = {'x0': ZONE[0], 'x1': ZONE[1], 'z0': ZONE[2], 'z1': ZONE[3],
             'note': "là où l'on marche (Eugène, 5 octobre : emprise A) ; la grille déborde de %g m : la campagne derrière la haie" % BANDE}
J['cadrages'] = {'lac': J['cadrages']['lac']}

# ---- les arbres de l'horizon : la campagne autour, en bocage ----
# Vue d'avion, la zone jouable se lisait comme un rectangle de chênes posé sur une plaine nue :
# l'horizon de monde.js n'a pas d'arbres. On y sème donc des bosquets (le bois d'OSM, là où les
# extraits en ont, et ailleurs des taches de bois) et des haies le long d'un parcellaire
# irrégulier, jusqu'à 1 km de la zone. Chaque arbre porte son altitude (celle de l'horizon) :
# aveyron.js les plante avec les autres, sans relief fin pour les y poser.
import random
rnd = random.Random(5)
def bruit(x, z, c):
    """bruit de valeur lissé, cases de c mètres, 0 à 1"""
    def v(i, j): return random.Random(i * 7919 + j * 104729 + int(c)).random()
    fx, fz = x / c, z / c; i, j = math.floor(fx), math.floor(fz); u, w = fx - i, fz - j
    u, w = u * u * (3 - 2 * u), w * w * (3 - 2 * w)
    return (v(i, j) * (1 - u) + v(i + 1, j) * u) * (1 - w) + (v(i, j + 1) * (1 - u) + v(i + 1, j + 1) * u) * w
BOIS_OSM = [b['pts'] for b in A['verdure'].get('bois', [])]
EAUX = [p['pts'] for p in A['eau']['plans']]
LOIN, horizon, cases = 1000.0, [], set()
for k in range(120000):
    if len(horizon) >= 8000: break
    x = X0 - LOIN + rnd.random() * (X1 - X0 + 2 * LOIN); z = Z0 - LOIN + rnd.random() * (Z1 - Z0 + 2 * LOIN)
    if X0 - 5 <= x <= X1 + 5 and Z0 - 5 <= z <= Z1 + 5: continue          # la grille fine : aveyron.js
    if any(dans(x, z, P) for P in EAUX): continue
    # les haies : le long des lignes d'un parcellaire de 90 à 140 m, tordu par le bruit
    q = 110 + 30 * bruit(x, z, 400); hx, hz = (x + 40 * bruit(z, x, 170)) % q, (z + 40 * bruit(x + 9, z, 170)) % q
    haie = min(hx, q - hx, hz, q - hz) < 3 and bruit(x, z, 60) > 0.35
    p = 0.55 if any(dans(x, z, P) for P in BOIS_OSM) else 0.5 if bruit(x, z, 220) > 0.72 else 0.6 if haie else 0.004
    if rnd.random() > p: continue
    c = (math.floor(x / 6), math.floor(z / 6))
    if any((c[0] + a, c[1] + b) in cases for a in (-1, 0, 1) for b in (-1, 0, 1)): continue
    cases.add(c); horizon.append([round(x, 1), round(z, 1), round(alt_loin(x, z), 1)])
J['horizon'] = {'arbres': horizon}
J['replats'] = REPLATS          # le niveau du rez-de-chaussée de chaque maison Roquette
json.dump(J, open(os.path.join(ICI, 'aveyron-jeu.json'), 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)

print('horizon : %d arbres' % len(horizon))
print('terre-pleins : %s' % REPLATS)
print('relief-aveyron-jeu.json : %d × %d nœuds au pas de %g m, %.0f Ko, de %.0f à %.0f m' % (
    nx, nz, PAS, os.path.getsize(os.path.join(ICI, 'relief-aveyron-jeu.json')) / 1024, min(h), max(h)))
print('lac : surface %.2f m, %d nœuds creusés ; étiage à %.2f m : %d nappes, %.1f ha d’eau sur %.1f'
      % (NIVEAU, creuses, NIVEAU - ETIAGE, len(anneaux), sum(aire(p) for p in anneaux) / 1e4, aire(LP) / 1e4))
