#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le relief des Pouilles — Copernicus GLO-30 — aux nœuds de la grille de JEU de chaque ville.

Lancé le 1er octobre, avec l'accord d'Eugène (l'IGN ne couvre pas l'Italie). La source :
Copernicus GLO-30 (30 m, tuiles publiques sans compte, sur
le seau AWS ouvert de l'ESA). Il en faut DEUX (taille relevée le 1er octobre par HEAD) :

    Copernicus_DSM_COG_10_N40_00_E016_00_DEM.tif   37,6 Mo   Matera
    Copernicus_DSM_COG_10_N40_00_E017_00_DEM.tif   21,6 Mo   Alberobello, Gallipoli

L'autre source, TINITALY (INGV, 10 m, un vrai modèle de TERRAIN), demande un formulaire
d'inscription : c'est Eugène qui le remplit ; ce script lirait ses tuiles de la même façon
(GeoTIFF), à condition de passer leur projection UTM 32/33 en lat/lon — pas fait.

⚠ GLO-30 est un modèle de SURFACE (DSM) : dans les villes, les toits et les arbres y sont,
lissés à 30 m. Pour les Sassi, ça bombe un peu la Civita ; pour la Gravina (100 m de
profondeur) c'est négligeable. Le jeu pose son bâti sur ce sol, il ne le creuse pas.

Comme en France, le relief est pris AUX nœuds de la grille du jeu (repere_pouilles.latlon) :
pas de ré-échantillonnage d'une grille lat/lon dans une autre ; une interpolation bilinéaire
entre les 4 pixels de 30 m qui entourent chaque nœud, c'est tout.

    python3 recolter-relief-pouilles.py --telecharger   (après l'accord d'Eugène : ~59 Mo)
    python3 recolter-relief-pouilles.py                 lit les tuiles, écrit relief-pouilles-<ville>.json

Lecture : tifffile + imagecodecs (déjà dans le Python d'anaconda de ce Mac ; le Python de
python.org ne les a pas). Pas de GDAL.
"""
import json, os, subprocess, sys, math

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import repere_pouilles as RP

DOSSIER = os.path.join(ICI, 'copernicus')
BASE = 'https://copernicus-dem-30m.s3.amazonaws.com'
PAS = 10.0          # 30 m de source : 10 m suffit à ne rien perdre, sans prétendre à plus

def nom_tuile(lat, lon):
    return 'Copernicus_DSM_COG_10_N%02d_00_E%03d_00_DEM' % (math.floor(lat), math.floor(lon))

def tuiles_utiles():
    t = set()
    for v in RP.VILLES:
        o = RP.ORIGINES[v]
        t.add(nom_tuile(o['lat'], o['lon']))
    return sorted(t)

def telecharger():
    os.makedirs(DOSSIER, exist_ok=True)
    for t in tuiles_utiles():
        f = os.path.join(DOSSIER, t + '.tif')
        if os.path.exists(f): print(t, 'déjà là'); continue
        print('télécharge', t)
        subprocess.run(['curl', '-sS', '--fail', '-o', f + '.part', '%s/%s/%s.tif' % (BASE, t, t)], check=True)
        os.replace(f + '.part', f)

class Tuile:
    """Une tuile GeoTIFF en lat/lon (EPSG:4326) : sa grille, et l'altitude bilinéaire en un point."""
    def __init__(self, f):
        import tifffile
        with tifffile.TiffFile(f) as T:
            p = T.pages[0]
            self.h = p.asarray()
            sx, sy = p.tags['ModelPixelScaleTag'].value[:2]
            tp = p.tags['ModelTiepointTag'].value
            gk = p.tags['GeoKeyDirectoryTag'].value
        # GTRasterTypeGeoKey (1025) : 1 = le point d'attache est le COIN du pixel, 2 = son centre
        cles = {gk[i]: gk[i + 3] for i in range(4, len(gk), 4)}
        demi = 0.5 if cles.get(1025, 1) == 1 else 0.0
        self.lon0 = tp[3] + (demi - tp[0]) * sx     # longitude du CENTRE du pixel de colonne 0
        self.lat0 = tp[4] - (demi - tp[1]) * sy     # latitude du CENTRE du pixel de ligne 0
        self.sx, self.sy = sx, sy
        self.ny, self.nx = self.h.shape

    def alt(self, lat, lon):
        fi = (lon - self.lon0) / self.sx
        fj = (self.lat0 - lat) / self.sy
        i, j = int(math.floor(fi)), int(math.floor(fj))
        if not (0 <= i < self.nx - 1 and 0 <= j < self.ny - 1): return None
        a, b = fi - i, fj - j
        H = self.h
        return float((1 - a) * (1 - b) * H[j, i] + a * (1 - b) * H[j, i + 1]
                     + (1 - a) * b * H[j + 1, i] + a * b * H[j + 1, i + 1])

def recolter(ville, tuiles):
    sortie = os.path.join(ICI, 'relief-pouilles-%s.json' % ville)
    c = json.load(open(os.path.join(ICI, '%s.json' % ville)))['cadre']
    m = 60.0          # comme l'aperçu : 60 m autour du cadre
    x0, z0 = math.floor((c['x0'] - m) / PAS) * PAS, math.floor((c['z0'] - m) / PAS) * PAS
    nx = int((c['x1'] + m - x0) / PAS) + 1
    nz = int((c['z1'] + m - z0) / PAS) + 1
    h, trous = [], 0
    for j in range(nz):
        for i in range(nx):
            la, lo = RP.latlon(ville, x0 + i * PAS, z0 + j * PAS)
            t = tuiles.get(nom_tuile(la, lo))
            v = t.alt(la, lo) if t else None
            if v is None or v < -1000: trous += 1; v = 0.0     # la mer de Gallipoli est à 0
            h.append(round(v, 2))
    json.dump({'note': "Copernicus GLO-30 (DSM, ESA), altitudes au-dessus de l'EGM2008, grille en coordonnées "
                       "de JEU (repere_pouilles.py, ville %s) : h[j*nx+i] est l'altitude en x0+i*pas, z0+j*pas. "
                       "Contient des données Copernicus modifiées." % ville,
               'pas': PAS, 'x0': x0, 'z0': z0, 'nx': nx, 'nz': nz,
               'min': min(h), 'max': max(h), 'trous': trous, 'h': h}, open(sortie, 'w'))
    print('%s : %d × %d nœuds au pas de %g m, de %.0f à %.0f m, %d trous' % (
        os.path.basename(sortie), nx, nz, PAS, min(h), max(h), trous))

if __name__ == '__main__':
    if '--telecharger' in sys.argv:
        telecharger()
    fichiers = {t: os.path.join(DOSSIER, t + '.tif') for t in tuiles_utiles()}
    manque = [t for t, f in fichiers.items() if not os.path.exists(f)]
    if manque:
        sys.exit('tuiles absentes : %s\n(--telecharger, APRÈS l\'accord d\'Eugène)' % ', '.join(manque))
    tuiles = {t: Tuile(f) for t, f in fichiers.items()}
    for v in [a for a in sys.argv[1:] if not a.startswith('-')] or RP.VILLES:
        recolter(v, tuiles)
