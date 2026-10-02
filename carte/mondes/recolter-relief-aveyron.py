#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le relief de l'Aveyron, pris au RGE ALTI de l'IGN — directement en coordonnées de JEU.

Copie de recolter-relief-lozere.py (Eugène l'autorise, 1er octobre). Une seule récolte à la
fois sur data.geopf.fr : on attend que celle de Lozère soit finie. Ne pas confondre avec
carte/ign-recolte.py, réglé pour Lille et qu'on ne relance pas.

Différence avec Lille : là-bas on récoltait une grille lat/lon (altitudes.json), puis
preparer-relief.py la ré-échantillonnait dans le repère du jeu — deux projections, deux
constantes, 0,7 % d'écart. Ici on demande à l'IGN l'altitude AUX nœuds de la grille du jeu
(repere_aveyron.latlon) : le fichier sort prêt, sans ré-échantillonnage.

    python3 recolter-relief-aveyron.py monde   le lac, le trou et le bourg au pas de 10 m  (~370 requêtes)
    python3 recolter-relief-aveyron.py lac     le lac et ses rives au pas de 5 m           (~270 requêtes)
    python3 recolter-relief-aveyron.py bourg   Saint-Symphorien au pas de 2 m              (~455 requêtes)
    python3 recolter-relief-aveyron.py environs 14 × 12 km au pas de 50 m, pour le Dormeur (~340 requêtes)

Le monde couvre AUSSI les 2 km sans plan OSM entre les deux extraits : c'est là que se
cherche le Dormeur (falaise en géant couché), et le jeu y a besoin d'un sol.

Écrit relief-aveyron-<zone>.json. Reprenable : relancer repart où ça s'était arrêté.
Altitudes en mètres NGF, absolues (le jeu choisira son zéro — à Lille, la place d'Armes).
"""
import json, os, shutil, subprocess, sys, time, urllib.parse

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from repere_aveyron import latlon

LOTS = 200                     # points par requête : la limite de l'API altimétrique
UA = 'the-legend-of-camille/1.0 (projet personnel)'
API = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?'

def dit(*a): print(*a, flush=True)

def zones():
    L = json.load(open(os.path.join(ICI, 'aveyron.json')))
    # les cadrages débordent des extraits (250 m de rive autour du lac) : le monde les englobe
    B = L['cadres'] + list(L['cadrages'].values())
    # « ign_rge_alti_wld » rend le point le plus proche d'une grille d'environ 5 m (trouvé par
    # la session Lozère le 1er octobre) : au bourg (2 m), 42 % des voisins étaient égaux, et
    # 12 % encore au lac (5 m) — des marches dans l'ombrage. Il suffit au pas de 10 m ;
    # en dessous, le LiDAR HD (interpolé, sans trou). Les mauvais fichiers sont dans _mauvais/.
    z = {'monde': dict(x0=min(c['x0'] for c in B), x1=max(c['x1'] for c in B),
                       z0=min(c['z0'] for c in B), z1=max(c['z1'] for c in B), pas=10.0, res='ign_rge_alti_wld')}
    z['lac'] = dict(L['cadrages']['lac'], pas=5.0, res='ign_lidar_hd_mnt_mono_wld')   # 2 m ferait 1 700 requêtes
    z['bourg'] = dict(L['cadrages']['bourg'], pas=2.0, res='ign_lidar_hd_mnt_mono_wld')
    # Les environs, grossiers : le monde (5 × 1,4 km) est un plateau doux, sans une falaise
    # pour le Dormeur. On regarde 14 × 12 km autour du lac au pas de 50 m pour trouver les
    # vraies pentes — les gorges de la Truyère sont tout près (2 octobre).
    z['environs'] = dict(x0=-6000, x1=8000, z0=-6000, z1=6000, pas=50.0, res='ign_rge_alti_wld')
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
    sortie = os.path.join(ICI, 'relief-aveyron-%s.json' % nom)
    if os.path.exists(sortie):
        dit('%s est déjà là — je le laisse. Supprime-le pour refaire.' % os.path.basename(sortie)); return
    pas = Z['pas']
    x0, z0 = round(Z['x0'] / pas) * pas, round(Z['z0'] / pas) * pas
    nx = int((Z['x1'] - x0) / pas) + 1
    nz = int((Z['z1'] - z0) / pas) + 1
    total = nx * nz
    dit('%s : %d × %d points au pas de %g m, %d requêtes' % (nom, nx, nz, pas, (total + LOTS - 1) // LOTS))
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
    # -99999 = hors couverture (ne devrait pas arriver en Aveyron) : la médiane bouche les trous
    bons = sorted(v for v in h if v > -1000)
    med = bons[len(bons) // 2]
    trous = sum(1 for v in h if v <= -1000)
    h = [med if v <= -1000 else v for v in h]
    json.dump({'note': "IGN (%s), altitudes NGF absolues, grille en coordonnées de JEU "
                       "(repere_aveyron.py) : h[j*nx+i] est l'altitude en x0+i*pas, z0+j*pas" % Z['res'],
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
