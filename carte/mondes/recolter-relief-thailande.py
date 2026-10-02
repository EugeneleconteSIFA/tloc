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
    # le grand piton : l'ellipse qui couvre la colline du Wat Tham Suea
    S = B['morceaux']['suea']; scx, scz = (S['x0'] + S['x1']) / 2, (S['z0'] + S['z1']) / 2
    srx, srz = (S['x1'] - S['x0']) / 2 - 20, (S['z1'] - S['z0']) / 2 - 20

    h, n_cop = [], 0
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
                    e = math.hypot((x - scx) / srx, (z - scz) / srz)
                    if e < 1:
                        k = cop(m, x, z); n_cop += 1
                        # la plaine (23 m) devient le rivage ; la colline, un piton 3,2 fois plus haut
                        v = max(v, (max(0.0, k - 25) * 3.2 + 2.0) * lisse((1 - e) / 0.18) + FOND * (1 - lisse((1 - e) / 0.18)))
                else:
                    k = cop(m, x, z); n_cop += 1
                    bord = min(x - M['x0'], M['x1'] - x, z - M['z0'], M['z1'] - z)
                    if k > 0.3:
                        H = 220.0
                        k = k if k < 2.5 else 2.5 + (H - 2.5) * ((k - 2.5) / (H - 2.5)) ** 0.4
                        # le bord de l'extrait, ondulé (sinon l'île serait un rectangle) : la terre y
                        # plonge plus vite qu'elle ne s'abaisse, pour finir en falaise dans l'eau
                        bord += 40 * (math.sin(x / 71) + math.sin(z / 57 + 1.3) + math.sin((x + z) / 37 + 0.4)) / 3
                        f = lisse((bord - 30) / 110)
                        v = max(v, k * f + (FOND - 40) * (1 - f))
            h.append(round(v, 1))
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
    for bt in B['batiments']:
        xs = [q[0] for q in bt['pts']]; zs = [q[1] for q in bt['pts']]
        i0, i1 = int((min(xs) - x0) / PAS) - 1, int((max(xs) - x0) / PAS) + 2
        j0, j1 = int((min(zs) - z0) / PAS) - 1, int((max(zs) - z0) / PAS) + 2
        noeuds = [(i, j) for j in range(max(0, j0), min(nz, j1 + 1)) for i in range(max(0, i0), min(nx, i1 + 1))]
        vals = sorted(h[j * nx + i] for i, j in noeuds)
        if not vals or vals[-1] - vals[0] < 2.5 or vals[0] < 0.5: continue
        med = vals[len(vals) // 2]
        for i, j in noeuds: h[j * nx + i] = med
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
