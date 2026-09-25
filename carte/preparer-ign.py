#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les GeoJSON de l'IGN (WGS84) → ign.json, en coordonnées de JEU.

Même chaîne de projection que preparer-relief.py. On ne garde que ce qui sert au
jeu : la forme, et les attributs qui changent quelque chose à l'écran.

    python3 preparer-ign.py
"""
import json, math, os

ICI = os.path.dirname(os.path.abspath(__file__))
lil = json.load(open(os.path.join(ICI, 'lille.json')))
cit = json.load(open(os.path.join(ICI, 'citadelle.json')))

lat0, lon0 = lil['origine']['lat'], lil['origine']['lon']
MLON = 111320.0 * math.cos(math.radians(lat0))
MLAT = 110540.0

def cen(p):
    q = p[:-1] if len(p) > 2 and p[0] == p[-1] else p
    return (sum(a[0] for a in q) / len(q), sum(a[1] for a in q) / len(q))

CX, CZ = cen(lil['fortif']['citadelle'][0]['pts'])
DELTA = math.radians(cit['pivot'])
CO, SI = math.cos(DELTA), math.sin(DELTA)

def T(lo, la):
    x = (lo - lon0) * MLON - CX
    z = -(la - lat0) * MLAT - CZ
    return [round(x * CO - z * SI, 1), round(x * SI + z * CO, 1)]

def simplifie(pts, eps):
    """Douglas-Peucker : le relevé IGN est beaucoup plus fin que ce que le jeu affiche."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dz)
    pire, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dx * (a[1] - p[1]) - (a[0] - p[0]) * dz) / L if L > 1e-9 else math.dist(a, p)
        if d > pire:
            pire, idx = d, i
    if pire <= eps:
        return [a, b]
    return simplifie(pts[:idx + 1], eps)[:-1] + simplifie(pts[idx:], eps)

def anneaux(geo, eps):
    """Toutes les couronnes extérieures d'une géométrie, projetées et allégées."""
    t, c = geo['type'], geo['coordinates']
    brut = []
    if t == 'Polygon':          brut = [c[0]]
    elif t == 'MultiPolygon':   brut = [g[0] for g in c]
    elif t == 'LineString':     brut = [c]
    elif t == 'MultiLineString':brut = list(c)
    out = []
    for r in brut:
        p = [T(q[0], q[1]) for q in r]
        p = simplifie(p, eps)
        if len(p) >= 2:
            out.append(p)
    return out

def lire(nom):
    f = os.path.join(ICI, nom)
    return json.load(open(f))['features'] if os.path.exists(f) else []

def nz(v, d=None):
    return v if v not in (None, '') else d

# ---- bâti : c'est la couche qui apporte le plus, grâce aux hauteurs ----------
bati = []
for f in lire('ign-bati.geojson'):
    p = f['properties']
    for r in anneaux(f['geometry'], 0.7):
        bati.append({
            'p': r,
            'h': round(float(nz(p.get('hauteur'), 0)) or 0, 1),
            'e': int(nz(p.get('nombre_d_etages'), 0) or 0),
            'n': nz(p.get('nature'), ''),
            'u': nz(p.get('usage_1'), ''),
            'm': nz(p.get('materiaux_des_murs'), ''),
            't': nz(p.get('materiaux_de_la_toiture'), ''),
        })

haies = [{'p': r} for f in lire('ign-haies.geojson') for r in anneaux(f['geometry'], 0.8)]

foret = []
for f in lire('ign-foret.geojson'):
    p = f['properties']
    for r in anneaux(f['geometry'], 1.2):
        foret.append({'p': r, 'essence': nz(p.get('essence'), ''), 'tfv': nz(p.get('tfv_g11'), '')})

eau = []
for f in lire('ign-eau-surfaces.geojson'):
    p = f['properties']
    for r in anneaux(f['geometry'], 0.8):
        eau.append({'p': r, 'nature': nz(p.get('nature'), '')})

cours = []
for f in lire('ign-eau-cours.geojson'):
    p = f['properties']
    for r in anneaux(f['geometry'], 1.0):
        cours.append({'p': r, 'nom': nz(p.get('toponyme'), ''), 'i': int(nz(p.get('importance'), 5) or 5)})

out = {'note': 'IGN BD TOPO / BD Forêt / référentiel haies, ramenés au repère du jeu',
       'bati': bati, 'haies': haies, 'foret': foret, 'eau': eau, 'cours': cours}
json.dump(out, open(os.path.join(ICI, 'ign.json'), 'w'))

hs = [b['h'] for b in bati if b['h'] > 0]
print('ign.json écrit')
print('  bâti   %5d emprises, %d avec hauteur (%.1f → %.1f m, médiane %.1f)'
      % (len(bati), len(hs), min(hs), max(hs), sorted(hs)[len(hs) // 2]))
print('  haies  %5d tronçons' % len(haies))
print('  forêt  %5d parcelles (%s)' % (len(foret), ', '.join(sorted({f['essence'] for f in foret}))))
print('  eau    %5d surfaces, %d cours' % (len(eau), len(cours)))
