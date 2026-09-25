# -*- coding: utf-8 -*-
"""Extrait de l'OSM de Lille les couches utiles au jeu, projetées en mètres,
origine au centre de la citadelle, x = est, z = sud (nord = -z)."""
import xml.etree.ElementTree as ET, json, math, sys

SRC = '/root/.claude/uploads/9c35d8c5-e862-5d12-86ef-4af09eb8afb8/036594a8-map.osm'
OUT = '/mnt/user-data/outputs/carte/lille.json'

root = ET.parse(SRC).getroot()
N = {}
for n in root.findall('node'):
    N[n.get('id')] = (float(n.get('lat')), float(n.get('lon')))

def tags(el): return {t.get('k'): t.get('v') for t in el.findall('tag')}

ways = {}
for w in root.findall('way'):
    ways[w.get('id')] = ([nd.get('ref') for nd in w.findall('nd')], tags(w))

# --- origine : centroïde de la citadelle ---
cit = next(wid for wid, (r_, d) in ways.items() if d.get('name') == 'Citadelle de Lille' and d.get('historic') == 'castle')
pts = [N[i] for i in ways[cit][0] if i in N]
lat0 = sum(p[0] for p in pts) / len(pts)
lon0 = sum(p[1] for p in pts) / len(pts)
MLAT = 111320.0
MLON = 111320.0 * math.cos(math.radians(lat0))

def proj(ref):
    la, lo = N[ref]
    return (round((lo - lon0) * MLON, 1), round(-(la - lat0) * MLAT, 1))   # x est, z sud

def poly(wid):
    r_, _ = ways[wid]
    return [proj(i) for i in r_ if i in N]

def dp(p, eps):
    """Douglas-Peucker : allège sans déformer."""
    if len(p) < 3: return p
    a, b = p[0], p[-1]
    dx, dz = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dz * dz
    im, dm = 0, -1
    for i in range(1, len(p) - 1):
        px, pz = p[i][0] - a[0], p[i][1] - a[1]
        d = abs(px * dz - pz * dx) / math.sqrt(L2) if L2 > 1e-9 else math.hypot(px, pz)
        if d > dm: im, dm = i, d
    if dm > eps:
        return dp(p[:im + 1], eps)[:-1] + dp(p[im:], eps)
    return [a, b]

# L'export OSM livre les ways ENTIERS, même ceux qui sortent du cadre : la Deûle
# partait à trois kilomètres. On découpe sur les bornes déclarées de l'extrait.
B = root.find('bounds')
BX0 = (float(B.get('minlon')) - lon0) * MLON - 40
BX1 = (float(B.get('maxlon')) - lon0) * MLON + 40
BZ0 = -(float(B.get('maxlat')) - lat0) * MLAT - 40
BZ1 = -(float(B.get('minlat')) - lat0) * MLAT + 40
def dedans(p): return BX0 <= p[0] <= BX1 and BZ0 <= p[1] <= BZ1
def morceaux(p):
    out, cur = [], []
    for q in p:
        if dedans(q): cur.append(q)
        elif cur: out.append(cur); cur = []
    if cur: out.append(cur)
    return out

def add(dst, wid, eps=1.0, nom=None, extra=None):
    p = poly(wid)
    if len(p) < 2: return
    if not all(dedans(q) for q in p):
        for m in morceaux(p):
            if len(m) >= 2:
                e = {'pts': dp(m, eps)}
                if nom: e['nom'] = nom
                if extra: e.update(extra)
                dst.append(e)
        return
    p = dp(p, eps)
    e = {'pts': p}
    if nom: e['nom'] = nom
    if extra: e.update(extra)
    dst.append(e)

out = {
    'origine': {'lat': round(lat0, 7), 'lon': round(lon0, 7), 'note': 'x = est, z = sud, en mètres'},
    'fortif': {'citadelle': [], 'bastions': [], 'demilunes': [], 'contregardes': [], 'ouvrages': [], 'murs': []},
    'eau': {'plans': [], 'canaux': []},
    'verdure': {'parcs': [], 'bois': [], 'herbe': [], 'jardins': []},
    'routes': [], 'chemins': [], 'ponts': [], 'talus': [], 'batiments': [],
}

CLS_ROUTE = {'primary': 3, 'secondary': 3, 'tertiary': 2, 'residential': 2,
             'unclassified': 2, 'pedestrian': 1, 'service': 1, 'living_street': 2}

for wid, (refs, d) in ways.items():
    nom = d.get('name', '')
    nl = nom.lower()
    # ---- fortifications nommées ----
    if nom == 'Citadelle de Lille' and d.get('historic') == 'castle':
        add(out['fortif']['citadelle'], wid, 0.6, nom); continue
    if nl.startswith('bastion'):
        add(out['fortif']['bastions'], wid, 0.6, nom); continue
    if nl.startswith('demi-lune'):
        add(out['fortif']['demilunes'], wid, 0.6, nom); continue
    if nl.startswith('contregarde'):
        add(out['fortif']['contregardes'], wid, 0.6, nom); continue
    if nl.startswith('lunette') or nl.startswith('tenaille') or 'mur de communication' in nl or nl.startswith('porte'):
        add(out['fortif']['ouvrages'], wid, 0.8, nom); continue
    if d.get('barrier') in ('city_wall', 'wall', 'retaining_wall'):
        add(out['fortif']['murs'], wid, 1.0, nom or None, {'k': d['barrier']}); continue
    # ---- eau ----
    if d.get('natural') == 'water' or d.get('water'):
        add(out['eau']['plans'], wid, 1.2, nom or None); continue
    if d.get('waterway') in ('canal', 'river', 'stream'):
        add(out['eau']['canaux'], wid, 1.2, nom or None, {'k': d['waterway'], 'l': float(d.get('width', 0) or 0)}); continue
    # ---- verdure ----
    if d.get('leisure') in ('park', 'nature_reserve'):
        add(out['verdure']['parcs'], wid, 1.5, nom or None); continue
    if d.get('natural') in ('wood', 'scrub') or d.get('landuse') == 'forest':
        add(out['verdure']['bois'], wid, 1.5, nom or None); continue
    if d.get('leisure') in ('garden', 'pitch', 'playground') or d.get('landuse') in ('grass', 'meadow', 'allotments', 'orchard'):
        add(out['verdure']['jardins' if d.get('leisure') == 'garden' else 'herbe'], wid, 1.5, nom or None); continue
    if d.get('man_made') == 'embankment':
        add(out['talus'], wid, 1.2); continue
    if d.get('bridge') == 'yes' or d.get('man_made') == 'bridge':
        add(out['ponts'], wid, 1.0, nom or None); continue
    # ---- voirie ----
    h = d.get('highway')
    if h in CLS_ROUTE:
        add(out['routes'], wid, 1.5, nom or None, {'r': CLS_ROUTE[h]}); continue
    if h in ('footway', 'path', 'cycleway', 'track', 'steps'):
        add(out['chemins'], wid, 1.8, None, {'r': 0}); continue
    # ---- bâti ----
    if 'building' in d:
        p0 = poly(wid)
        if not all(dedans(q) for q in p0): continue
        p = dp(p0, 1.2)
        if len(p) >= 4:
            out['batiments'].append(p)
        continue

json.dump(out, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)

import os
xs = [p[0] for g in out['fortif']['citadelle'] for p in g['pts']]
zs = [p[1] for g in out['fortif']['citadelle'] for p in g['pts']]
print('citadelle : x %.0f..%.0f (%.0f m)  z %.0f..%.0f (%.0f m)' % (min(xs), max(xs), max(xs)-min(xs), min(zs), max(zs), max(zs)-min(zs)))
for k, v in out['fortif'].items(): print(' fortif.%-13s %d' % (k, len(v)))
for k, v in out['eau'].items(): print(' eau.%-16s %d' % (k, len(v)))
for k, v in out['verdure'].items(): print(' verdure.%-12s %d' % (k, len(v)))
print(' routes %d  chemins %d  ponts %d  talus %d  batiments %d' % (len(out['routes']), len(out['chemins']), len(out['ponts']), len(out['talus']), len(out['batiments'])))
print(' taille %.0f Ko' % (os.path.getsize(OUT)/1024))
print(' noms bastions :', [g['nom'] for g in out['fortif']['bastions']])
print(' demi-lunes    :', sorted(set(g['nom'] for g in out['fortif']['demilunes'])))
