#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le relief de la baie de Thaïlande — Copernicus GLO-30, RETOUCHÉ en pitons — sur la grille de JEU.

Téléchargé le 2 octobre avec l'accord d'Eugène (« pour le relief je suis ok ») :

    Copernicus_DSM_COG_10_N08_00_E098_00_DEM.tif   33,9 Mo   Ko Panyi, Khao Phing Kan, Railay
    Copernicus_DSM_COG_10_N07_00_E098_00_DEM.tif    2,3 Mo   Phi Phi
    Copernicus_DSM_COG_10_N13_00_E099_00_DEM.tif   49,0 Mo   le Wat Tham Suea (Kanchanaburi)

Copernicus seul ne suffit pas, et on le dit franchement :
- à 30 m, il ne VOIT PAS les petits pitons : Ko Panyi y culmine à 12 m (le vrai rocher
  dépasse 80 m), Khao Phing Kan à 19 m, Ko Tapu (8 m de large) n'existe pas ;
- et il arrondit les falaises de Railay et de Phi Phi en collines.
Alors, morceau par morceau :
- **Ko Panyi, Khao Phing Kan** : le relief est DESSINÉ — un piton par masse boisée d'OSM
  (le rocher est la forêt, le reste est plage ou pilotis), à flancs presque verticaux et
  sommet bombé, à la hauteur de HAUTEURS ci-dessous (photos, ordres de grandeur) ;
- **Railay, Phi Phi** : Copernicus, mais REDRESSÉ (h → H·(h/H)^0,4) : les pentes basses se
  relèvent en falaises, les plages et les villages (sous 2,5 m) ne bougent pas ;
- **le Wat Tham Suea** : sa colline de Kanchanaburi (40 m au-dessus de la plaine) haussée
  ×3,2 et posée dans la mer : c'est le grand piton du Yak, le temple en haut ;
- partout, chaque morceau plonge dans la mer à moins de 120 m du bord de son extrait (il
  devient une île), et la mer de la baie est un fond de -6 m.

Comme ailleurs : le relief est pris AUX nœuds de la grille du jeu (repere_thailande.latlon),
interpolation bilinéaire entre les 4 pixels de 30 m — pas de ré-échantillonnage.

    python3 recolter-relief-thailande.py      lit les tuiles, écrit relief-thailande.json

Lecture : tifffile (le Python d'anaconda de ce Mac).
"""
import json, os, sys, math, importlib.util

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import repere_thailande as RT
_s = importlib.util.spec_from_file_location('rp', os.path.join(ICI, 'recolter-relief-pouilles.py'))
RP = importlib.util.module_from_spec(_s); _s.loader.exec_module(RP)       # Tuile, nom_tuile : les mêmes

PAS = 10.0
FOND = -6.0
# La hauteur des pitons dessinés, par masse boisée (l'ordre d'OSM, de l'ouest vers l'est).
HAUTEURS = {'panyi': 85.0, 'tapu': 62.0}

def dans(x, z, pts):
    d = False
    for i in range(len(pts)):
        (xi, zi), (xj, zj) = pts[i], pts[i - 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
    return d

def dist_bord(x, z, pts):
    m = 1e9
    for i in range(len(pts) - 1):
        (ax, az), (bx, bz) = pts[i], pts[i + 1]
        dx, dz = bx - ax, bz - az; L = dx * dx + dz * dz or 1e-9
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / L))
        m = min(m, math.hypot(x - ax - t * dx, z - az - t * dz))
    return m

def lisse(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def bord_coeur(x, z):
    """À combien de mètres du cœur se dresse la falaise (0 à 16) : la même formule que BORD()
    dans thailande.js, qui y bloque le passage."""
    return 8 + 4 * (math.sin(x / 23) + math.sin(z / 17 + 1.3))

def main():
    B = json.load(open(os.path.join(ICI, 'thailande.json')))
    c = B['cadre']
    x0, z0 = math.floor(c['x0'] / PAS) * PAS, math.floor(c['z0'] / PAS) * PAS
    nx, nz = int((c['x1'] - x0) / PAS) + 1, int((c['z1'] - z0) / PAS) + 1
    tuiles = {}
    def cop(m, x, z):
        la, lo = RT.latlon(m, x, z); n = RP.nom_tuile(la, lo)
        if n not in tuiles: tuiles[n] = RP.Tuile(os.path.join(ICI, 'copernicus', n + '.tif'))
        v = tuiles[n].alt(la, lo)
        return 0.0 if v is None or v < -100 else v
    # les pitons dessinés : les masses boisées de Ko Panyi et de Khao Phing Kan
    pitons = [b['pts'] for b in B['verdure']['bois'] if any(abs(b['pts'][0][0] - RT.MORCEAUX[m]['dx']) < 900 and abs(b['pts'][0][1] - RT.MORCEAUX[m]['dz']) < 600 for m in HAUTEURS)]
    def piton_h(x, z):
        for p in pitons:
            xs = [q[0] for q in p]; zs = [q[1] for q in p]
            if not (min(xs) <= x <= max(xs) and min(zs) <= z <= max(zs)) or not dans(x, z, p): continue
            m = min(HAUTEURS, key=lambda k: math.hypot(p[0][0] - RT.MORCEAUX[k]['dx'], p[0][1] - RT.MORCEAUX[k]['dz']))
            d = dist_bord(x, z, p)
            # la paroi : 70 % de la hauteur dans les 14 premiers mètres, puis le dôme de jungle
            r = math.sqrt(abs(sum(p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1] for i in range(len(p) - 1))) / 2 / math.pi)
            return HAUTEURS[m] * (0.7 * lisse(d / 14) + 0.3 * lisse(d / max(20, r * 0.8)))
        return None
    iles = [i['pts'] for i in B['cote']['iles']]
    def terre_plate(x, z):     # les plages et les pilotis de Ko Panyi : à 1,2 m
        return any(dans(x, z, p) for p in iles)
    # le grand piton : l'ellipse qui couvre la colline du Wat Tham Suea — depuis le 4 octobre,
    # celle qui passe juste au-delà des coins du cœur (extraire-thailande.py, COEURS) : l'île
    # n'est plus que son sommet et ses temples, ses routes finissent dans la mer
    S = B['morceaux']['suea']
    if S.get('coeur'):
        cx0, cx1, cz0, cz1 = S['coeur']
        scx, scz = (cx0 + cx1) / 2, (cz0 + cz1) / 2
        srx, srz = (cx1 - cx0) / 2 * 1.15 + 35, (cz1 - cz0) / 2 * 1.15 + 20
        srz_nord = (cz1 - cz0) / 2 * 1.35 + 20      # au nord, le temple est à 43 m : il faut de la place pour descendre à la mer
    else:
        scx, scz = (S['x0'] + S['x1']) / 2, (S['z0'] + S['z1']) / 2
        srx, srz = (S['x1'] - S['x0']) / 2 - 20, (S['z1'] - S['z0']) / 2 - 20
        srz_nord = srz

    h, n_cop, brut = [], 0, {}
    for j in range(nz):
        for i in range(nx):
            x, z = x0 + i * PAS, z0 + j * PAS
            v = FOND
            for m, M in B['morceaux'].items():
                if not (M['x0'] <= x <= M['x1'] and M['z0'] <= z <= M['z1']): continue
                if m in HAUTEURS:
                    p = piton_h(x, z)
                    if p is not None: v = max(v, p)
                    elif terre_plate(x, z): v = max(v, 1.2)
                elif m == 'suea':
                    e = math.hypot((x - scx) / srx, (z - scz) / (srz_nord if z < scz else srz))
                    if e < 1:
                        k = cop(m, x, z); n_cop += 1
                        # la colline devient un piton 3,2 fois plus haut. La plaine autour (23 m), elle,
                        # tombait toute à 2 m : un disque de grève grise autour de l'île, vu d'avion
                        # (Eugène, 4 octobre). Elle devient le flanc de l'île — 2 m au bord, en pente
                        # douce jusqu'à 16 m sous la colline — et la grève n'est plus qu'un liseré.
                        # La plongée dans la mer se fait sur 8 % du rayon (10 à 15 m), pas 18 % : plus
                        # douce, elle laissait une bande de 20 m entre 0 et 3 m, que les parois peignent en grève.
                        flanc = 2.0 + 14.0 * lisse((1 - e - 0.08) / 0.38)
                        v = max(v, (max(0.0, k - 25) * 3.2 + flanc) * lisse((1 - e) / 0.08) + FOND * (1 - lisse((1 - e) / 0.08)))
                else:
                    k = cop(m, x, z); n_cop += 1
                    bord = min(x - M['x0'], M['x1'] - x, z - M['z0'], M['z1'] - z)
                    if k > 0.3:
                        H = 220.0
                        kb = k               # Copernicus tel quel : on y revient le long des sentiers (plus bas)
                        k = k if k < 2.5 else 2.5 + (H - 2.5) * ((k - 2.5) / (H - 2.5)) ** 0.4
                        # le bord de l'extrait, ondulé (sinon l'île serait un rectangle) : la terre y
                        # plonge plus vite qu'elle ne s'abaisse, pour finir en falaise dans l'eau
                        # (4 octobre) le bord est celui de la GARDE, à BANDE = 120 m du cœur : la terre doit y
                        # être entière au bord du cœur — l'ondulation et la plongée tiennent dans 115 m
                        bord += 25 * (math.sin(x / 71) + math.sin(z / 57 + 1.3) + math.sin((x + z) / 37 + 0.4)) / 3
                        f = lisse((bord - 5) / 85)
                        v = max(v, k * f + (FOND - 40) * (1 - f))
                        brut[len(h)] = max(FOND, kb * f + (FOND - 40) * (1 - f))
            h.append(round(v, 1))
    # LES SENTIERS DE RAILAY ET DE PHI PHI (banc lieu-thailande, 2 octobre : 2 916 points trop
    # raides sur 24 231). Le redressement en falaises relevait aussi les pentes que les
    # sentiers gravissent : à moins de 6 m d'un chemin d'OSM, on reprend Copernicus tel quel
    # (les vraies pentes, que les vrais sentiers savent monter), et on fond sur 8 m de plus.
    poids = {}
    for c in B['chemins'] + B['routes']:
        # l'escalier des moines n'est pas un vrai sentier : il doit garder la hauteur de la colline
        # redressée (le câble du grand piton part de son sommet), pas retomber sur Copernicus
        if c.get('m') not in ('railay', 'phiphi') or c.get('surface') or c.get('moines'): continue
        for (ax, az), (bx, bz) in zip(c['pts'], c['pts'][1:]):
            for j in range(max(0, int((min(az, bz) - 15 - z0) / PAS)), min(nz, int((max(az, bz) + 15 - z0) / PAS) + 1)):
                for i in range(max(0, int((min(ax, bx) - 15 - x0) / PAS)), min(nx, int((max(ax, bx) + 15 - x0) / PAS) + 1)):
                    n = j * nx + i
                    if n not in brut: continue
                    w = 1 - lisse((dist_bord(x0 + i * PAS, z0 + j * PAS, [(ax, az), (bx, bz)]) - 6) / 8)
                    if w > poids.get(n, 0): poids[n] = w
    for n, w in poids.items(): h[n] = round(h[n] * (1 - w) + brut[n] * w, 1)
    # les pontons de TOUTE la baie (Phi Phi, Railay) : comme les passerelles de Ko Panyi, à 1,2 m
    for c in B['ponts']:
        if c.get('k') != 'pier' or c.get('m') == 'panyi' or len(c['pts']) < 2: continue
        for (ax, az), (bx, bz) in zip(c['pts'], c['pts'][1:]):
            for j in range(max(0, int((min(az, bz) - 6 - z0) / PAS)), min(nz, int((max(az, bz) + 6 - z0) / PAS) + 1)):
                for i in range(max(0, int((min(ax, bx) - 6 - x0) / PAS)), min(nx, int((max(ax, bx) + 6 - x0) / PAS) + 1)):
                    if dist_bord(x0 + i * PAS, z0 + j * PAS, [(ax, az), (bx, bz)]) < 5 and h[j * nx + i] < 1.2: h[j * nx + i] = 1.2
    # les passerelles et les pontons de Ko Panyi : le village marche AU-DESSUS de l'eau, sur
    # des planches — à 1,2 m, sur 7 m de part et d'autre de chaque passerelle d'OSM
    for c in B['chemins'] + B['ponts']:
        if c.get('m') != 'panyi': continue
        for (ax, az), (bx, bz) in zip(c['pts'], c['pts'][1:]):
            for j in range(max(0, int((min(az, bz) - 8 - z0) / PAS)), min(nz, int((max(az, bz) + 8 - z0) / PAS) + 1)):
                for i in range(max(0, int((min(ax, bx) - 8 - x0) / PAS)), min(nx, int((max(ax, bx) + 8 - x0) / PAS) + 1)):
                    x, z = x0 + i * PAS, z0 + j * PAS
                    if dist_bord(x, z, [(ax, az), (bx, bz)]) < 7 and h[j * nx + i] < 1.2: h[j * nx + i] = 1.2
    # les bâtiments sur la pente (le Wat Tham Suea, haussé ×3,2) : un terre-plein sous chacun,
    # à l'altitude médiane de son emprise — sinon leurs murs descendent de dix mètres côté vallée
    # un nœud déjà aplani pour un bâtiment ne l'est pas une seconde fois pour son voisin : sinon
    # le dernier terre-plein creusait le premier, et un temple du grand piton se retrouvait
    # sur une marche, ses murs descendant de vingt mètres comme une tour
    aplanis = set()
    for bt in sorted(B['batiments'], key=lambda b: -abs(sum(b['pts'][i][0] * b['pts'][i + 1][1] - b['pts'][i + 1][0] * b['pts'][i][1] for i in range(len(b['pts']) - 1)))):
        xs = [q[0] for q in bt['pts']]; zs = [q[1] for q in bt['pts']]
        i0, i1 = int((min(xs) - x0) / PAS) - 1, int((max(xs) - x0) / PAS) + 2
        j0, j1 = int((min(zs) - z0) / PAS) - 1, int((max(zs) - z0) / PAS) + 2
        noeuds = [(i, j) for j in range(max(0, j0), min(nz, j1 + 1)) for i in range(max(0, i0), min(nx, i1 + 1)) if (i, j) not in aplanis]
        vals = sorted(h[j * nx + i] for i, j in noeuds)
        if not vals or vals[-1] - vals[0] < 2.5 or vals[0] < 0.5: continue
        med = vals[len(vals) // 2]
        for i, j in noeuds: h[j * nx + i] = med; aplanis.add((i, j))
    # LE PROFIL DE CHAQUE SENTIER, EN DERNIER (banc, 2e passe : encore 2 690 points trop raides ;
    # posé avant les terre-pleins, il était recreusé par eux au bord des rues). Copernicus
    # est un modèle de SURFACE : dans Ton Sai et à Railay, il compte les toits et les arbres —
    # des marches de 5 m au milieu de la rue. On relève donc chaque chemin tous les 5 m, on
    # lisse son profil (moyenne glissante sur 35 m), on borne sa pente à 50 % (27°) dans les deux
    # sens, et on pose le sol sur ce profil à moins de 8 m du chemin (la grille est au pas de 10 m :
    # plus étroit, le chemin tombait entre deux nœuds tirés vers le relief brut), fondu jusqu'à 15 m.
    def hgrille(x, z):
        fx = min(max((x - x0) / PAS, 0), nx - 1.001); fz = min(max((z - z0) / PAS, 0), nz - 1.001)
        i, j = int(fx), int(fz); u, v = fx - i, fz - j
        return (h[j * nx + i] * (1 - u) + h[j * nx + i + 1] * u) * (1 - v) + (h[(j + 1) * nx + i] * (1 - u) + h[(j + 1) * nx + i + 1] * u) * v
    # (4 octobre) Là où deux chemins se croisent, le premier imposait sa hauteur au nœud partagé :
    # des marches de 3 à 19 m dans Ton Sai et sur le grand piton, que le resserrement a mises en
    # évidence (moins de points, autant de marches). Le nœud prend maintenant la MOYENNE des
    # chemins qui le réclament, pondérée par leur proximité, et on repasse une seconde fois : le
    # second profil se lit sur un sol déjà calé.
    for passe in range(2):
     poids2 = {}
     for c in B['chemins'] + B['routes']:
         if c.get('m') == 'panyi' or c.get('surface') or len(c['pts']) < 2: continue
         q = []
         for (ax, az), (bx, bz) in zip(c['pts'], c['pts'][1:]):
             n = max(1, int(math.hypot(bx - ax, bz - az) / 5))
             q += [(ax + (bx - ax) * t / n, az + (bz - az) * t / n) for t in range(n)]
         q.append(tuple(c['pts'][-1]))
         prof = [hgrille(x, z) for x, z in q]
         if max(prof) < 0.5: continue                          # tout en mer
         lis = [sum(prof[max(0, k - 3):k + 4]) / len(prof[max(0, k - 3):k + 4]) for k in range(len(prof))]
         if c.get('moines'):
             # l'escalier des moines : une pente constante, du pied (le bout des marches d'OSM) au
             # sommet de la colline — lissé comme un sentier, il perdait 15 m en haut, sous le câble
             L = [0.0]
             for k in range(1, len(q)): L.append(L[-1] + math.hypot(q[k][0] - q[k - 1][0], q[k][1] - q[k - 1][1]))
             lis = [prof[0] + (prof[-1] - prof[0]) * l / L[-1] for l in L]
         for k in range(1, len(lis)):                          # la pente bornée, aller…
             d = math.hypot(q[k][0] - q[k - 1][0], q[k][1] - q[k - 1][1]) * 0.5
             lis[k] = min(max(lis[k], lis[k - 1] - d), lis[k - 1] + d)
         for k in range(len(lis) - 2, -1, -1):                 # … et retour
             d = math.hypot(q[k][0] - q[k + 1][0], q[k][1] - q[k + 1][1]) * 0.5
             lis[k] = min(max(lis[k], lis[k + 1] - d), lis[k + 1] + d)
         for (x, z), y in zip(q, lis):
             if y < 0.3: continue                              # le chemin finit dans la mer : on n'y touche pas
             for j in range(max(0, int((z - 16 - z0) / PAS)), min(nz, int((z + 16 - z0) / PAS) + 1)):
                 for i in range(max(0, int((x - 16 - x0) / PAS)), min(nx, int((x + 16 - x0) / PAS) + 1)):
                     w = 1 - lisse((math.hypot(x0 + i * PAS - x, z0 + j * PAS - z) - 8) / 7)
                     n = j * nx + i
                     if w <= 0: continue
                     a = poids2.setdefault(n, [0.0, 0.0, 0.0]); a[0] = max(a[0], w); a[1] += w ** 3; a[2] += w ** 3 * y
     # Les chemins passent AVANT les terre-pleins : les garder faisait retomber la baie à 89,9 %
     # praticable. Le bâtiment qui en perd son assise prend un soubassement de pierre (monde.js, socleMax).
     for n, (w, sw, swy) in poids2.items(): h[n] = round(h[n] * (1 - w) + swy / sw * w, 1)
    # LE BORD DU CŒUR (4 octobre) : Railay et Phi Phi sont coupés à leur cœur ; une rue coupée ne
    # doit pas s'arrêter dans le vide. Tout autour, à BORD() mètres du cœur (une ondulation, pour
    # que la limite ne soit pas une règle), la terre se dresse en falaise de calcaire de 24 m sur
    # 14 m — comme les murs des pitons de la baie, et le shader des parois la peint en roche. Les
    # plages et la mer (sous 1,5 m) ne bougent pas : là, c'est la grève qui finit la rue.
    # thailande.js (garde) bloque le passage à BORD() + 3 m : le pied de la falaise, pas avant.
    for m, M in B['morceaux'].items():
        if M.get('mode') != 'falaise': continue
        cx0, cx1, cz0, cz1 = M['coeur']
        for j in range(max(0, int((M['z0'] - z0) / PAS)), min(nz, int((M['z1'] - z0) / PAS) + 1)):
            for i in range(max(0, int((M['x0'] - x0) / PAS)), min(nx, int((M['x1'] - x0) / PAS) + 1)):
                x, z = x0 + i * PAS, z0 + j * PAS
                d = math.hypot(max(cx0 - x, 0, x - cx1), max(cz0 - z, 0, z - cz1))
                if d <= 0: continue
                n = j * nx + i
                h[n] = round(h[n] + 24 * lisse((d - bord_coeur(x, z)) / 14) * lisse((h[n] - 1.5) / 2.5), 1)
    out = os.path.join(ICI, 'relief-thailande.json')
    json.dump({'note': "Copernicus GLO-30 (DSM, ESA) RETOUCHÉ (voir recolter-relief-thailande.py : pitons dessinés à Ko Panyi "
                       "et Khao Phing Kan, falaises redressées à Railay et Phi Phi, colline du Wat Tham Suea haussée), grille en "
                       "coordonnées de JEU de la baie (repere_thailande.py) : h[j*nx+i] est l'altitude en x0+i*pas, z0+j*pas ; "
                       "la mer est à 0, son fond à -6. Contient des données Copernicus modifiées.",
               'pas': PAS, 'x0': x0, 'z0': z0, 'nx': nx, 'nz': nz, 'min': min(h), 'max': max(h), 'h': h},
              open(out, 'w'), separators=(',', ':'))
    print('relief-thailande.json : %d × %d nœuds, %.0f Ko, de %.0f à %.0f m (%d lus dans Copernicus)' % (
        nx, nz, os.path.getsize(out) / 1024, min(h), max(h), n_cop))

if __name__ == '__main__':
    main()
