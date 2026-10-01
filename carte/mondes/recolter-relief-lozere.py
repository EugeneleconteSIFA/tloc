#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le relief de Lozère, pris au RGE ALTI de l'IGN — directement en coordonnées de JEU.

PAS ENCORE LANCÉ : Eugène valide d'abord (téléchargement de ~2 600 requêtes à
data.geopf.fr, une vingtaine de minutes). Ne pas confondre avec carte/ign-recolte.py,
réglé pour Lille et qu'on ne relance pas.

Différence avec Lille : là-bas on récoltait une grille lat/lon (altitudes.json), puis
preparer-relief.py la ré-échantillonnait dans le repère du jeu — deux projections, deux
constantes, 0,7 % d'écart. Ici on demande à l'IGN l'altitude AUX nœuds de la grille du jeu
(repere_lozere.latlon) : le fichier sort prêt, sans ré-échantillonnage.

    python3 recolter-relief-lozere.py monde    tout le monde au pas de 10 m  (~1 750 requêtes)
    python3 recolter-relief-lozere.py pouget   le hameau au pas de 2 m      (~ 450 requêtes)
    python3 recolter-relief-lozere.py garde    la Garde-Guérin au pas de 2 m (~ 410 requêtes)

Écrit relief-lozere-<zone>.json. Reprenable : relancer repart où ça s'était arrêté.
Altitudes en mètres NGF, absolues (le jeu choisira son zéro — à Lille, la place d'Armes).
"""
import json, os, shutil, subprocess, sys, time, urllib.parse

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from repere_lozere import latlon

LOTS = 200                     # points par requête : la limite de l'API altimétrique
UA = 'the-legend-of-camille/1.0 (projet personnel)'
API = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?'

def dit(*a): print(*a, flush=True)

def zones():
    L = json.load(open(os.path.join(ICI, 'lozere.json')))
    xs = [c['x0'] for c in L['cadres']] + [c['x1'] for c in L['cadres']]
    zs = [c['z0'] for c in L['cadres']] + [c['z1'] for c in L['cadres']]
    # « ign_rge_alti_wld » rend le point le plus proche d'une grille d'environ 5 m (vérifié le
    # 1er octobre : à 2 m, les valeurs vont par paires et l'ombrage fait des marches). Il suffit
    # au pas de 10 m ; en dessous, on prend le LiDAR HD (interpolé, donc sans trou).
    z = {'monde': dict(x0=min(xs), x1=max(xs), z0=min(zs), z1=max(zs), pas=10.0, res='ign_rge_alti_wld')}
    for k in ('pouget', 'garde', 'lac'):
        z[k] = dict(L['cadrages'][k], pas=2.0 if k != 'lac' else 5.0,
                    res='ign_lidar_hd_mnt_mono_wld' if k != 'lac' else 'ign_rge_alti_wld')
    return z

def get(url, essais=4):
    """curl d'abord : il lit le trousseau macOS, que le Python de python.org ignore
    (cf. le long commentaire de carte/ign-recolte.py sur les proxys qui ré-signent le TLS)."""
    for k in range(essais):
        try:
            if shutil.which('curl'):
                p = subprocess.run(['curl', '-sS', '--fail-with-body', '--max-time', '60', '-A', UA, url],
                                   capture_output=True)
                if p.returncode: raise OSError(p.stderr.decode('utf-8', 'replace')[:200])
                return p.stdout
            import urllib.request
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return r.read()
        except Exception as e:
            if k == essais - 1: raise
            dit('    … %s — nouvel essai dans %d s' % (str(e)[:80], 2 ** k))
            time.sleep(2 ** k)

def recolter(nom, Z):
    sortie = os.path.join(ICI, 'relief-lozere-%s.json' % nom)
    if os.path.exists(sortie):
        dit('%s est déjà là — je le laisse. Supprime-le pour refaire.' % os.path.basename(sortie)); return
    pas = Z['pas']
    x0, z0 = round(Z['x0'] / pas) * pas, round(Z['z0'] / pas) * pas
    nx = int((Z['x1'] - x0) / pas) + 1
    nz = int((Z['z1'] - z0) / pas) + 1
    total = nx * nz
    dit('%s : %d × %d points au pas de %g m, %d requêtes (%s)' % (nom, nx, nz, pas, (total + LOTS - 1) // LOTS, Z['res']))
    part = sortie + '.part'
    h = json.load(open(part)) if os.path.exists(part) else []
    t0, i_dep = time.time(), len(h)
    while len(h) < total:
        i0 = len(h)
        pts = [latlon(x0 + (i % nx) * pas, z0 + (i // nx) * pas) for i in range(i0, min(i0 + LOTS, total))]
        d = json.loads(get(API + urllib.parse.urlencode({
            'lon': '|'.join('%.7f' % p[1] for p in pts), 'lat': '|'.join('%.7f' % p[0] for p in pts),
            'resource': Z['res'], 'delimiter': '|', 'zonly': 'true', 'indent': 'false'})))
        lot = d.get('elevations') or d.get('altitudes') or []
        if lot and isinstance(lot[0], dict):
            lot = [e.get('z', e.get('altitude', -99999)) for e in lot]
        if len(lot) != len(pts):
            dit('!! %d altitudes pour %d points : %s' % (len(lot), len(pts), json.dumps(d)[:400])); sys.exit(1)
        h.extend(round(float(v), 2) for v in lot)
        json.dump(h, open(part, 'w'))
        reste = (time.time() - t0) / max(1, len(h) - i_dep) * (total - len(h))
        dit('    %7d / %d  (%4.1f %%)  reste ~%d s' % (len(h), total, 100 * len(h) / total, reste))
        time.sleep(0.08)
    # -99999 = hors couverture (ne devrait pas arriver en Lozère) : la médiane bouche les trous
    bons = sorted(v for v in h if v > -1000)
    med = bons[len(bons) // 2]
    trous = sum(1 for v in h if v <= -1000)
    h = [med if v <= -1000 else v for v in h]
    json.dump({'note': "IGN (%s), altitudes NGF absolues," % Z['res'] + " grille en coordonnées de JEU "
                       "(repere_lozere.py) : h[j*nx+i] est l'altitude en x0+i*pas, z0+j*pas",
               'pas': pas, 'x0': x0, 'z0': z0, 'nx': nx, 'nz': nz,
               'min': min(h), 'max': max(h), 'trous': trous, 'h': h}, open(sortie, 'w'))
    os.remove(part)
    dit('%s écrit : de %.0f à %.0f m, %d trous' % (os.path.basename(sortie), min(h), max(h), trous))

if __name__ == '__main__':
    Zs = zones()
    demande = sys.argv[1:] or ['monde']
    for n in demande:
        if n not in Zs: sys.exit('zones : ' + ', '.join(Zs))
        recolter(n, Zs[n])
