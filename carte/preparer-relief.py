#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""altitudes.json (grille lat/lon de l'IGN)  →  relief.json (grille en coordonnées de JEU).

Refait exactement la chaîne de projection des deux autres scripts :
  extraire-osm.py     lat/lon → mètres, origine au centroïde de la citadelle
  preparer-citadelle.py  translation au centre du corps de place, puis pivot

La sortie est une grille régulière en x,z du jeu, en mètres RELATIFS : on retranche
l'altitude de la place d'Armes, pour que le niveau zéro du jeu reste le niveau zéro.

    python3 preparer-relief.py
"""
import json, math, os

ICI = os.path.dirname(os.path.abspath(__file__))
PAS = 5.0          # pas de la grille de sortie, en mètres

alt  = json.load(open(os.path.join(ICI, 'altitudes.json')))
lil  = json.load(open(os.path.join(ICI, 'lille.json')))
cit  = json.load(open(os.path.join(ICI, 'citadelle.json')))

# ---- la chaîne de projection, à l'identique -------------------------------
lat0, lon0 = lil['origine']['lat'], lil['origine']['lon']
MLON = 111320.0 * math.cos(math.radians(lat0))
MLAT = 110540.0

def cen(p):
    q = p[:-1] if len(p) > 2 and p[0] == p[-1] else p
    return (sum(a[0] for a in q) / len(q), sum(a[1] for a in q) / len(q))

CX, CZ = cen(lil['fortif']['citadelle'][0]['pts'])
DELTA = math.radians(cit['pivot'])
CO, SI = math.cos(DELTA), math.sin(DELTA)

def jeu_de_latlon(la, lo):
    x = (lo - lon0) * MLON - CX
    z = -(la - lat0) * MLAT - CZ
    return (x * CO - z * SI, x * SI + z * CO)

def latlon_de_jeu(gx, gz):
    x =  gx * CO + gz * SI          # rotation inverse
    z = -gx * SI + gz * CO
    lo = (x + CX) / MLON + lon0
    la = -(z + CZ) / MLAT + lat0
    return (la, lo)

# ---- échantillonnage bilinéaire du MNT ------------------------------------
NX, NZ = alt['nx'], alt['nz']
LAT0, LAT1, LON0, LON1 = alt['lat0'], alt['lat1'], alt['lon0'], alt['lon1']
Z = alt['z']
dLon = (LON1 - LON0) / (NX - 1)
dLat = (LAT1 - LAT0) / (NZ - 1)      # la grille descend du NORD vers le sud

def mnt(la, lo):
    fx = (lo - LON0) / dLon
    fz = (LAT1 - la) / dLat
    fx = min(max(fx, 0), NX - 1.001)
    fz = min(max(fz, 0), NZ - 1.001)
    i, j = int(fx), int(fz)
    u, v = fx - i, fz - j
    a = Z[j * NX + i];       b = Z[j * NX + i + 1]
    c = Z[(j + 1) * NX + i]; d = Z[(j + 1) * NX + i + 1]
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v

# ---- emprise de sortie : le rectangle du relevé, en coordonnées de jeu ----
coins = [jeu_de_latlon(la, lo) for la in (LAT0, LAT1) for lo in (LON0, LON1)]
x0 = math.floor(min(c[0] for c in coins) / PAS) * PAS
x1 = math.ceil( max(c[0] for c in coins) / PAS) * PAS
z0 = math.floor(min(c[1] for c in coins) / PAS) * PAS
z1 = math.ceil( max(c[1] for c in coins) / PAS) * PAS
nx = int((x1 - x0) / PAS) + 1
nz = int((z1 - z0) / PAS) + 1

REF = mnt(*latlon_de_jeu(0, 0))       # la place d'Armes tient lieu de niveau zéro

out, hors = [], 0
for j in range(nz):
    for i in range(nx):
        gx, gz = x0 + i * PAS, z0 + j * PAS
        la, lo = latlon_de_jeu(gx, gz)
        if not (LAT0 - 1e-4 <= la <= LAT1 + 1e-4 and LON0 - 1e-4 <= lo <= LON1 + 1e-4):
            hors += 1
        out.append(round(mnt(la, lo) - REF, 2))

json.dump({'note': 'RGE ALTI ramené au repère du jeu ; 0 = niveau de la place d\'Armes',
           'pas': PAS, 'x0': x0, 'z0': z0, 'nx': nx, 'nz': nz,
           'ref': round(REF, 2), 'min': min(out), 'max': max(out), 'h': out},
          open(os.path.join(ICI, 'relief.json'), 'w'))

print('relief.json : %d × %d au pas de %g m  (x %g→%g, z %g→%g)' % (nx, nz, PAS, x0, x1, z0, z1))
print('  place d\'Armes à %.2f m NGF — le jeu la garde à 0' % REF)
print('  relief relatif de %+.2f à %+.2f m' % (min(out), max(out)))
print('  %d points hors de l\'emprise du MNT (bords, valeur du bord la plus proche)' % hors)
