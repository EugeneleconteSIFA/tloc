#!/usr/bin/env python3
"""Les villes des Pouilles, du plan d'OSM à ce que lit le jeu : <ville>.json →
pouilles-<ville>-gradins.json → pouilles-<ville>-coeur.json (+ les reliefs -sol, -coeur, -loin).

LE CŒUR (Eugène, 4 octobre, après s'être baladé à Alberobello : « c'est beaucoup trop grand » ;
PLAN-2026-10-04-CARTES.md). On ne garde, praticable, qu'un cœur de 250 à 500 m autour de ce qui
sert (CADRES, plus bas) ; au-delà, une TOILE basse : un relief grossier (-loin, au pas de 30 m,
600 m autour du cœur) et les volumes simplifiés des maisons d'alentour (« lointain » dans le
plan du cœur : un rectangle, une hauteur, un cône pour un trullo), sans collisions, que
pouilles.js dessine en un seul maillage. Le recadrage du 2 octobre (recadrer-pouilles.py, cœurs
de 500 à 800 m) est rangé dans complet/, avec les plans qu'il produisait.

POURQUOI. monde.js extrude chaque maison du point le plus BAS de son emprise jusqu'au plus HAUT,
plus la hauteur des murs. Dans les Sassi, une emprise d'OSM descend souvent la pente sur 10 à
30 m de dénivelé : la version 1 en faisait des tours de tuf de 30 m, « des maisons qui descendent
jusqu'au fond » (Eugène, 2 octobre). Les vraies maisons des Sassi sont posées en gradins, chacune
sur le toit de celle d'en dessous.

On coupe donc chaque emprise en pente en bandes parallèles aux courbes de niveau, d'au plus
1,3 m de dénivelé (la consigne de précision du 2 octobre : aucun soubassement de plus de 1,5 m) (et pas plus étroites que 2,2 m : monde.js ignore ce qui est plus mince) ;
chaque bande devient une maison, avec ses murs à elle. On retire aussi l'emprise du château
Tramontano : matera.js le bâtit lui-même (trois tours rondes, un château inachevé).

LE SOL NU D'ABORD. Copernicus GLO-30 est un modèle de SURFACE : les toits y sont. Sous les
îlots, le « terrain » montait à la hauteur des toits et redescendait dans les rues ; chaque
maison sortait de terre sur des mètres de soubassement, et couper en gradins trouait la ville
(75 % du bâti de Gallipoli perdu au premier essai). On en tire un sol nu par une ouverture
morphologique — le minimum sur 50 m, puis le maximum sur 50 m, puis un lissage léger : ce qui
est plus petit qu'un îlot (un toit) disparaît, ce qui est plus grand (la falaise des Sassi,
la Gravina, l'île de Gallipoli) reste. Écrit dans relief-pouilles-<ville>-sol.json, que le
jeu lit (recadré au cœur par recadrer-pouilles.py) ; le relief brut reste l'horizon.

LES RUES ENSUITE (la consigne de précision du 2 octobre : 100 % des points de rue praticables).
Dans les îlots d'OSM, une rue, un passage ou un escalier traverse souvent une emprise (une cour,
un passage voûté) : on s'y cognait à un mur invisible. Avant les gradins, chaque emprise que
coupe une rue est fendue le long de la rue, sur sa largeur dans le jeu (celle des rubans de
monde.js) plus 60 cm de chaque côté (Camille a un demi-mètre de rayon pour le moteur).
Une maison dont un gradin dépasse encore 1,5 m de dénivelé est retirée : c'est la roche nue,
dans laquelle les maisons des Sassi sont creusées.

Le relief lu est celui du jeu (relief-pouilles-<ville>.json, interpolé comme monde.js).
    python3 gradins-pouilles.py alberobello      (une ville ; sans argument, les trois)
"""
import json, math, os, sys
import numpy as np
import scipy.ndimage as ndi

ICI = os.path.dirname(os.path.abspath(__file__))
CHUTE, LARGEUR_MIN = 1.3, 2.2          # 1,3 : dix centimètres de marge sur le seuil de 1,5 m du banc
R = None
# x0, x1, z0, z1 en mètres, dans le repère de chaque ville (repere_pouilles.py)
CADRES = {
    # le Rione Monti (les trulli de la quête, la porte des Heures) et le Largo Martellotta au
    # nord, où arrive le petit train : 280 × 280 m (4 octobre ; 490 × 515 m avant)
    'alberobello': (-140, 140, -185, 95),
    # Gallipoli garde son ÎLE ENTIÈRE (Eugène, 4 octobre : « garder l'aspect île ») : la vieille
    # ville et ses remparts, la mer tout autour, le château angevin, le port et la jetée du
    # Colosse, le pont et la gare en face ; la ville neuve de la terre ferme sort. 740 × 510 m.
    'gallipoli':   (-320, 420, -170, 340),      # (420 : la place de la gare, 15 m de rayon, tient en dedans du muret)
    # la Civita (la cathédrale, le départ), le Sasso Caveoso et le château Tramontano, le donjon
    # de l'acte, à 480 m de la cathédrale : 540 × 410 m (validé par Eugène le 4 octobre ; le
    # Sasso Barisano sort)
    'matera':      (-490, 50, -30, 380),
}
# la toile : 400 m autour du cœur, et rien à moins de 25 m du muret (Eugène, 4 octobre, sur le
# rendu d'Alberobello : « réduis le lointain » — 600 m de grands blocs blancs serrés contre le
# bord tiraient l'œil hors du cœur)
LOIN, LOIN_MARGE = 400, 25
# où l'on voudrait la gare (pouilles.js, GARES) : le script cherche, au plus près, un terrain
# libre pour elle — 41 × 21 m sans maison NI RUE (la première gare d'Alberobello resserré
# coupait une rue), moins de 2,5 m de dénivelé, dans le cœur. Il l'affiche ; on la recopie.
GARE_CIBLE = {'alberobello': (7, -182), 'matera': (-383, 197), 'gallipoli': (369, 30)}


def hauteur(x, z):
    fx = max(0, min(R['nx'] - 1.001, (x - R['x0']) / R['pas']))
    fz = max(0, min(R['nz'] - 1.001, (z - R['z0']) / R['pas']))
    i, j = int(fx), int(fz); u, v = fx - i, fz - j; h, n = R['h'], R['nx']
    return (h[j * n + i] * (1 - u) + h[j * n + i + 1] * u) * (1 - v) + (h[(j + 1) * n + i] * (1 - u) + h[(j + 1) * n + i + 1] * u) * v


def dans(x, z, pts):
    d = False; j = len(pts) - 1
    for i in range(len(pts)):
        xi, zi = pts[i]; xj, zj = pts[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
        j = i
    return d


def couper(pts, gx, gz, s, garder_dessus):
    """Sutherland–Hodgman sur le demi-plan p·g ≥ s (ou ≤ s)."""
    out = []
    f = (lambda p: p[0] * gx + p[1] * gz - s) if garder_dessus else (lambda p: s - (p[0] * gx + p[1] * gz))
    for k in range(len(pts)):
        a, b = pts[k], pts[(k + 1) % len(pts)]; fa, fb = f(a), f(b)
        if fa >= 0: out.append(a)
        if (fa >= 0) != (fb >= 0):
            t = fa / (fa - fb); out.append([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    return out


def echantillons(pts):
    xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs); pas = max(1.0, min(x1 - x0, z1 - z0) / 6)
    l = [(x, z, hauteur(x, z)) for x, z in pts]
    x = x0
    while x <= x1:
        z = z0
        while z <= z1:
            if dans(x, z, pts): l.append((x, z, hauteur(x, z)))
            z += pas
        x += pas
    return l


def pente(l):
    """Le plan des moindres carrés h = a·x + b·z + c : sa pente (a, b)."""
    n = len(l); mx = sum(p[0] for p in l) / n; mz = sum(p[1] for p in l) / n; mh = sum(p[2] for p in l) / n
    sxx = sum((p[0] - mx) ** 2 for p in l); szz = sum((p[1] - mz) ** 2 for p in l); sxz = sum((p[0] - mx) * (p[1] - mz) for p in l)
    sxh = sum((p[0] - mx) * (p[2] - mh) for p in l); szh = sum((p[1] - mz) * (p[2] - mh) for p in l)
    det = sxx * szz - sxz ** 2
    if abs(det) < 1e-9: return 0.0, 0.0
    return (sxh * szz - szh * sxz) / det, (szh * sxx - sxh * sxz) / det


def segments_rues(plan):
    """Les tronçons de rue (ax, az, bx, bz, demi-largeur dégagée), rangés dans une grille de 20 m."""
    g = {}
    for r in plan['routes'] + plan['chemins']:
        w = (6 if r.get('r', 0) >= 3 else 4 if r.get('r') == 2 else 2.6 if r.get('r') == 1 else 1.5) / 2 + 0.6
        for k in range(len(r['pts']) - 1):
            (ax, az), (bx, bz) = r['pts'][k], r['pts'][k + 1]
            if math.hypot(bx - ax, bz - az) < 0.3: continue
            for i in range(int(min(ax, bx) // 20) - 1, int(max(ax, bx) // 20) + 2):
                for j in range(int(min(az, bz) // 20) - 1, int(max(az, bz) // 20) + 2):
                    g.setdefault((i, j), []).append((ax, az, bx, bz, w))
    return g


def croise(pts, seg):
    """Le tronçon passe-t-il DANS l'emprise (un de ses points à l'intérieur, à 2 m près le long) ?"""
    ax, az, bx, bz, w = seg; l = math.hypot(bx - ax, bz - az); n = max(2, int(l / 1.0))
    return any(dans(ax + (bx - ax) * t / n, az + (bz - az) * t / n, pts) for t in range(n + 1))


def fendre(pts, seg):
    """L'emprise moins la bande de la rue : les deux morceaux de part et d'autre."""
    ax, az, bx, bz, w = seg; l = math.hypot(bx - ax, bz - az); nx, nz = -(bz - az) / l, (bx - ax) / l
    d = ax * nx + az * nz
    return [q for q in (couper(pts, nx, nz, d + w, True), couper(pts, nx, nz, d - w, False)) if len(q) >= 3 and aire(q) >= 4]


def aire(pts):
    return abs(sum(pts[k][0] * pts[(k + 1) % len(pts)][1] - pts[(k + 1) % len(pts)][0] * pts[k][1] for k in range(len(pts)))) / 2


def sans_chevauchement(bats):
    """Deux emprises qui se recouvrent (des emprises d'OSM déjà superposées, ou des gradins dont
    les fentes de rue se croisent) faisaient des murs l'un dans l'autre : on garde la plus grande.
    Le test est celui de bancs/lieu-pouilles.mjs — un point de l'intérieur, à 40 cm d'un sommet."""
    def sondes(p):
        cx = sum(q[0] for q in p) / len(p); cz = sum(q[1] for q in p) / len(p); l = [(cx, cz)]
        for x, z in p:
            d = max(0.4, math.hypot(cx - x, cz - z)); l.append((x + (cx - x) * 0.4 / d, z + (cz - z) * 0.4 / d))
        return [q for q in l if dans(q[0], q[1], p)]
    gardes, grille, retires = [], {}, 0
    for b in sorted(bats, key=lambda b: -aire(b['pts'][:-1])):
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


def recadrer(R, c, pas=None):
    """Le relief R réduit au rectangle c (aux nœuds de sa grille), rééchantillonné au pas `pas`."""
    k = max(1, round((pas or R['pas']) / R['pas']))
    i0 = max(0, int((c[0] - R['x0']) // R['pas'])); i1 = min(R['nx'] - 1, int(-(-(c[1] - R['x0']) // R['pas'])))
    j0 = max(0, int((c[2] - R['z0']) // R['pas'])); j1 = min(R['nz'] - 1, int(-(-(c[3] - R['z0']) // R['pas'])))
    I = list(range(i0, i1 + 1, k)); J = list(range(j0, j1 + 1, k))
    S = {kk: v for kk, v in R.items() if kk not in ('h', 'x0', 'z0', 'nx', 'nz', 'pas', 'min', 'max', 'trous')}
    S.update(x0=R['x0'] + i0 * R['pas'], z0=R['z0'] + j0 * R['pas'], nx=len(I), nz=len(J), pas=R['pas'] * k)
    S['h'] = [R['h'][j * R['nx'] + i] for j in J for i in I]
    return S


def bilin(G, x, z):
    fx = max(0, min(G['nx'] - 1.001, (x - G['x0']) / G['pas'])); fz = max(0, min(G['nz'] - 1.001, (z - G['z0']) / G['pas']))
    i, j = int(fx), int(fz); u, v = fx - i, fz - j; h, n = G['h'], G['nx']
    return (h[j * n + i] * (1 - u) + h[j * n + i + 1] * u) * (1 - v) + (h[(j + 1) * n + i] * (1 - u) + h[(j + 1) * n + i + 1] * u) * v


def volume(b, G):
    """Le volume simplifié d'une maison lointaine : son rectangle orienté, sa hauteur, et son
    pied sur la toile (G : le relief brut au pas de 60 m, celui que monde.js dessine au loin)."""
    p = b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else b['pts']
    cx = sum(q[0] for q in p) / len(p); cz = sum(q[1] for q in p) / len(p)
    sxx = sum((q[0] - cx) ** 2 for q in p); szz = sum((q[1] - cz) ** 2 for q in p); sxz = sum((q[0] - cx) * (q[1] - cz) for q in p)
    a = 0.5 * math.atan2(2 * sxz, sxx - szz); ux, uz = math.cos(a), math.sin(a)
    A = [(q[0] - cx) * ux + (q[1] - cz) * uz for q in p]; B = [-(q[0] - cx) * uz + (q[1] - cz) * ux for q in p]
    L, W = max(A) - min(A), max(B) - min(B)
    if L < 2 or W < 1.6: return None
    cx += ux * (max(A) + min(A)) / 2 - uz * (max(B) + min(B)) / 2; cz += uz * (max(A) + min(A)) / 2 + ux * (max(B) + min(B)) / 2
    tr = b.get('k') == 'trullo' or b.get('toit') == 'conical'
    h = 2.4 if tr else ((b.get('niv') or 0) * 3 or (6.5 if L * W > 60 else 5)) * 0.75     # plus bas : une toile, pas une ville
    return [round(cx, 1), round(cz, 1), round(a, 3), round(L, 1), round(W, 1), round(h, 1), 1 if tr else 0, round(bilin(G, cx, cz) - 1, 1)]


for VILLE in (sys.argv[1:] or ['matera', 'gallipoli', 'alberobello']):
    C = CADRES[VILLE]
    PLAN = json.load(open(os.path.join(ICI, VILLE + '.json')))
    # seul le cœur (et 40 m autour, pour les maisons qu'il coupe) passe par les fentes et les gradins
    TOUT = PLAN['batiments']; PLAN['batiments'] = [b for b in TOUT if touche(b['pts'], C, 40)]
    R = json.load(open(os.path.join(ICI, f'relief-pouilles-{VILLE}.json')))
    BRUT = dict(R)
    # le sol nu : ouverture sur 5 × 5 nœuds (50 m au pas de 10 m), puis un flou de 1 nœud
    h = np.array(R['h'], dtype=float).reshape(R['nz'], R['nx'])
    h = ndi.gaussian_filter(ndi.grey_opening(h, size=(5, 5)), 1.0)
    R['h'] = [round(float(v), 2) for v in h.ravel()]
    R['note'] = (R.get('note') or '') + ' — SOL NU (gradins-pouilles.py) : ouverture morphologique 50 m + lissage, les toits du modèle de surface retirés.'
    json.dump(R, open(os.path.join(ICI, f'relief-pouilles-{VILLE}-sol.json'), 'w'), separators=(',', ':'))
    chateau = next((l for l in PLAN['lieux'] if l.get('nom') == 'Castello Tramontano'), None)
    sortie, coupees, bandes, retires, fendues, roche = [], 0, 0, 0, 0, 0
    RUES = segments_rues(PLAN)
    # 1. dégager les rues : on fend tant qu'un tronçon traverse un morceau
    morceaux = []
    for b in PLAN['batiments']:
        pile = [b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else b['pts']]
        # (les trulli aussi : une rue d'Alberobello passait à travers un ensemble de trulli ;
        # chaque morceau reçoit ses cônes)
        if b.get('k') == 'church' or b.get('nom') == 'Castello Tramontano':
            morceaux.append((b, pile[0])); continue
        tours = 0
        while pile and tours < 40:
            q = pile.pop(); tours += 1
            xs = [p[0] for p in q]; zs = [p[1] for p in q]
            cand = {s for i in range(int(min(xs) // 20), int(max(xs) // 20) + 1) for j in range(int(min(zs) // 20), int(max(zs) // 20) + 1) for s in RUES.get((i, j), [])}
            seg = next((s for s in cand if croise(q, s)), None)
            if seg is None: morceaux.append((b, q)); continue
            fendues += 1; pile.extend(fendre(q, seg))
        morceaux.extend((b, q) for q in pile)
    for b, pts in morceaux:
        if chateau and (b.get('nom') == 'Castello Tramontano' or dans(chateau['x'], chateau['z'], pts)):
            retires += 1; continue
        entier = {**b, 'pts': [[round(x, 1), round(z, 1)] for x, z in pts] + [[round(pts[0][0], 1), round(pts[0][1], 1)]]}
        hs = [p[2] for p in echantillons(pts)]
        # les trulli et les églises aussi : un ensemble de trulli en pente (jusqu'à 9 m à
        # Alberobello) reçoit ses cônes morceau par morceau, et une église en pente se pose sur
        # un soubassement en gradins, comme les vraies
        if max(hs) - min(hs) <= CHUTE:
            sortie.append(entier); continue
        # en deux selon SA pente, et encore, jusqu'à 1,3 m de dénivelé : une pente bombée (l'île
        # de Gallipoli) se suit morceau par morceau, ce que des bandes droites ne faisaient pas
        coupees += 1; pile = [pts]
        while pile:
            q = pile.pop(); l = echantillons(q); hq = [p[2] for p in l]
            if max(hq) - min(hq) <= CHUTE:
                r = [[round(x, 1), round(z, 1)] for x, z in q]; r.append(r[0])
                nb = {kk: v for kk, v in b.items() if kk not in ('pts', 'trous', 'h', 'niv')}; nb['pts'] = r; nb['gradin'] = 1
                sortie.append(nb); bandes += 1; continue
            a, c = pente(l); g = math.hypot(a, c)
            gx, gz = (a / g, c / g) if g > 1e-3 else (1.0, 0.0)
            proj = [p[0] * gx + p[1] * gz for p in q]; s0, s1 = min(proj), max(proj)
            if s1 - s0 < 2 * LARGEUR_MIN: roche += 1; continue
            m = (s0 + s1) / 2
            pile.extend(r for r in (couper(q, gx, gz, m, True), couper(q, gx, gz, m, False)) if len(r) >= 3 and aire(r) >= 4)

    # LES ÉCLATS : une fente de rue ou un gradin laisse parfois un morceau mince (moins de
    # 2,2 m de large) — un mur planté au bord du passage, où Camille s'accrochait entre deux
    # pas (Matera, devant la cathédrale, bancs/lieu-pouilles.mjs, 4 octobre). On les retire.
    def largeur(p):
        q = p[:-1] if p[0] == p[-1] else p
        cx = sum(a[0] for a in q) / len(q); cz = sum(a[1] for a in q) / len(q)
        sxx = sum((a[0] - cx) ** 2 for a in q); szz = sum((a[1] - cz) ** 2 for a in q); sxz = sum((a[0] - cx) * (a[1] - cz) for a in q)
        an = 0.5 * math.atan2(2 * sxz, sxx - szz); ux, uz = math.cos(an), math.sin(an)
        B = [-(a[0] - cx) * uz + (a[1] - cz) * ux for a in q]; A = [(a[0] - cx) * ux + (a[1] - cz) * uz for a in q]
        return min(max(A) - min(A), max(B) - min(B))
    avant = len(sortie); sortie = [b for b in sortie if largeur(b['pts']) >= LARGEUR_MIN or b.get('k') in ('trullo', 'church')]
    eclats = avant - len(sortie)
    PLAN['batiments'] = sortie
    PLAN['note'] = (PLAN.get('note') or '') + ' — en gradins (gradins-pouilles.py) : les emprises en pente coupées en bandes de 1,3 m de dénivelé au plus ; le château Tramontano retiré à Matera (matera.js le bâtit).'
    json.dump(PLAN, open(os.path.join(ICI, f'pouilles-{VILLE}-gradins.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{VILLE} : {fendues} fentes de rue ; {coupees} emprises coupées en {bandes} gradins ; {roche} morceaux trop pentus laissés à la roche ; {eclats} éclats retirés ; {retires} retirée(s) pour le château ; {len(sortie)} bâtiments')

    # ---------- le cœur : ce qui touche le cadre (monde.js ferme le jeu aux bords du relief fin) ----------
    COEUR = dict(PLAN)
    for k, v in list(COEUR.items()):
        if isinstance(v, list) and v and isinstance(v[0], dict) and 'pts' in v[0]:
            COEUR[k] = [e for e in v if touche(e['pts'], C, 20)]
        elif k == 'lieux':
            COEUR[k] = [l for l in v if C[0] <= l['x'] <= C[1] and C[2] <= l['z'] <= C[3]]
        elif isinstance(v, dict) and k in ('eau', 'verdure', 'cote'):
            COEUR[k] = {kk: ([e for e in vv if touche(e['pts'] if isinstance(e, dict) else e, C, 20)] if isinstance(vv, list) else vv) for kk, vv in v.items()}
    COEUR['batiments'], doublons = sans_chevauchement(COEUR['batiments'])
    COEUR['cadre_coeur'] = dict(zip(('x0', 'x1', 'z0', 'z1'), C))
    # ---------- la toile du lointain : les maisons d'alentour, en volumes ----------
    L = (C[0] - LOIN, C[1] + LOIN, C[2] - LOIN, C[3] + LOIN)
    G60 = recadrer(BRUT, L, 60)
    COEUR['lointain'] = [v for v in (volume(b, G60) for b in TOUT if touche(b['pts'], L) and not touche(b['pts'], C, LOIN_MARGE)) if v]
    json.dump(COEUR, open(os.path.join(ICI, f'pouilles-{VILLE}-coeur.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(recadrer(R, C), open(os.path.join(ICI, f'relief-pouilles-{VILLE}-coeur.json'), 'w'), separators=(',', ':'))
    json.dump(recadrer(BRUT, L, 30), open(os.path.join(ICI, f'relief-pouilles-{VILLE}-loin.json'), 'w'), separators=(',', ':'))
    # ---------- la gare ----------
    RC = recadrer(R, C); BC = {}
    for b in COEUR['batiments']:
        xs = [p[0] for p in b['pts']]; zs = [p[1] for p in b['pts']]
        for i in range(int(min(xs) // 10), int(max(xs) // 10) + 1):
            for j in range(int(min(zs) // 10), int(max(zs) // 10) + 1): BC.setdefault((i, j), []).append(b['pts'])
    RUESC = segments_rues(COEUR)
    def libre_gare(x, z, rues=True):
        if any(dans(x, z, p) for p in BC.get((int(x // 10), int(z // 10)), ())): return False
        if not rues: return True
        for (ax, az, bx, bz, w) in RUESC.get((int(x // 20), int(z // 20)), ()):
            dx, dz = bx - ax, bz - az; l2 = dx * dx + dz * dz or 1; t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / l2))
            if math.hypot(x - ax - dx * t, z - az - dz * t) < w: return False
        return True
    J = (RC['x0'] + 12, RC['x0'] + RC['pas'] * (RC['nx'] - 1) - 12, RC['z0'] + 12, RC['z0'] + RC['pas'] * (RC['nz'] - 1) - 12)
    tx, tz = GARE_CIBLE[VILLE]; gares = []
    for d in range(0, 400, 4):
        for k in range(max(1, int(2 * math.pi * d / 4))):
            a = k / max(1, int(2 * math.pi * d / 4)) * 2 * math.pi; x0, z0 = round(tx + d * math.cos(a)), round(tz + d * math.sin(a))
            for q in range(24):
                rot = q * math.pi / 12; c, s_ = math.cos(rot), math.sin(rot); hs = []
                # (pas de rue sous le bâtiment ni sous le quai, les seuls obstacles ; la voie,
                # elle, peut croiser une rue, comme un passage à niveau)
                ok = all(J[0] < x < J[1] and J[2] < z < J[3] and libre_gare(x, z, -14 <= b_ <= -2 and -13 <= a_ <= 13) and not hs.append(bilin(RC, x, z))
                         for x, z, a_, b_ in ((x0 + a_ * c - b_ * s_, z0 + a_ * s_ + b_ * c, a_, b_) for a_ in range(-17, 25, 2) for b_ in range(-15, 7, 2)))
                if ok and max(hs) - min(hs) < 2.5: gares.append((d, x0, z0, round(rot, 3), round(max(hs) - min(hs), 1))); break
            if gares: break
        if gares: break
    print(f"   gare : {gares[0] if gares else 'aucun terrain libre'}  (distance à la cible, x, z, rot, dénivelé)")
    print(f"   cœur {C[1] - C[0]} × {C[3] - C[2]} m : {len(COEUR['batiments'])} bâtiments ({doublons} recouvrements retirés) ; lointain : {len(COEUR['lointain'])} volumes")
    