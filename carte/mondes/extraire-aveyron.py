#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les deux extraits OSM de l'Aveyron  →  aveyron.json, en coordonnées de JEU (1 unité = 1 m).

Copie d'extraire-lozere.py (mêmes choix : un repère partagé avec le relief, Sutherland-Hodgman
sur les surfaces, Douglas-Peucker à 0,4 m sur le bâti), pour l'acte II — la Cloche du Midi :
aveyron-saint-gervais.osm (le lac, Saint-Gervais, Perpignau) et aveyron-saint-symphorien.osm
(le bourg, 4 km à l'est) fondus dans un seul plan. Un trou de ~2 km les sépare : le plan ne
l'invente pas, le relief (recolter-relief-aveyron.py) le couvre.

    python3 extraire-aveyron.py          (bibliothèque standard seulement)

Écrit aveyron.json, puis lance apercu-aveyron.py pour le plan à valider.
"""
import xml.etree.ElementTree as ET, json, math, os, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from repere_aveyron import jeu, LAT0, LON0

SOURCES = ['aveyron-saint-gervais.osm', 'aveyron-saint-symphorien.osm']
OUT = os.path.join(ICI, 'aveyron.json')
MARGE = 40.0        # comme à Lille et en Lozère : 40 m au-delà du cadre

# ---- lecture : les deux fichiers dans un même dictionnaire --------------------------
N, W, R = {}, {}, {}
CADRES = []

def tags(el): return {t.get('k'): t.get('v') for t in el.findall('tag')}

for nom in SOURCES:
    root = ET.parse(os.path.join(ICI, nom)).getroot()
    b = root.find('bounds')
    x0, z1 = jeu(float(b.get('minlat')), float(b.get('minlon')))
    x1, z0 = jeu(float(b.get('maxlat')), float(b.get('maxlon')))
    xa, _ = jeu(float(b.get('maxlat')), float(b.get('minlon')))
    xb, _ = jeu(float(b.get('minlat')), float(b.get('maxlon')))
    CADRES.append({'src': nom, 'x0': round(min(x0, xa), 1), 'x1': round(max(x1, xb), 1),
                   'z0': round(z0, 1), 'z1': round(z1, 1)})
    for n in root.findall('node'):
        N[n.get('id')] = (float(n.get('lat')), float(n.get('lon')), tags(n))
    for w in root.findall('way'):
        W.setdefault(w.get('id'), ([nd.get('ref') for nd in w.findall('nd')], tags(w)))
    for r in root.findall('relation'):
        R.setdefault(r.get('id'), ([(m.get('type'), m.get('ref'), m.get('role')) for m in r.findall('member')], tags(r)))

def proj(ref):
    la, lo, _ = N[ref]
    x, z = jeu(la, lo)
    return (round(x, 1), round(z, 1))

def ligne(refs):
    return [proj(i) for i in refs if i in N]

# ---- géométrie (celle d'extraire-lozere.py, inchangée) ---------------------------------
def dp(p, eps):
    """Douglas-Peucker itératif : allège sans déformer."""
    if len(p) < 3: return p
    garde = [False] * len(p); garde[0] = garde[-1] = True
    pile = [(0, len(p) - 1)]
    while pile:
        i0, i1 = pile.pop()
        a, b = p[i0], p[i1]
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz)
        im, dm = -1, -1.0
        for i in range(i0 + 1, i1):
            px, pz = p[i][0] - a[0], p[i][1] - a[1]
            d = abs(px * dz - pz * dx) / L if L > 1e-9 else math.hypot(px, pz)
            if d > dm: im, dm = i, d
        if dm > eps:
            garde[im] = True
            pile += [(i0, im), (im, i1)]
    return [q for q, g in zip(p, garde) if g]

def dedans(q, m=MARGE):
    return any(c['x0'] - m <= q[0] <= c['x1'] + m and c['z0'] - m <= q[1] <= c['z1'] + m for c in CADRES)

def morceaux(p):
    out, cur = [], []
    for q in p:
        if dedans(q): cur.append(q)
        elif cur: out.append(cur); cur = []
    if cur: out.append(cur)
    return [m for m in out if len(m) >= 2]

def cadre_de(p):
    cx = sum(q[0] for q in p) / len(p); cz = sum(q[1] for q in p) / len(p)
    for c in CADRES:
        if c['x0'] <= cx <= c['x1'] and c['z0'] <= cz <= c['z1']: return c
    return min(CADRES, key=lambda c: math.hypot(cx - (c['x0'] + c['x1']) / 2, cz - (c['z0'] + c['z1']) / 2))

def decoupe(p):
    """Sutherland-Hodgman : une SURFACE qui déborde reste fermée."""
    c = cadre_de(p)
    bords = [(lambda q: q[0] >= c['x0'] - MARGE, 0, c['x0'] - MARGE),
             (lambda q: q[0] <= c['x1'] + MARGE, 0, c['x1'] + MARGE),
             (lambda q: q[1] >= c['z0'] - MARGE, 1, c['z0'] - MARGE),
             (lambda q: q[1] <= c['z1'] + MARGE, 1, c['z1'] + MARGE)]
    for dans, ax, v in bords:
        if not p: break
        res = []
        for i in range(len(p)):
            a, b = p[i - 1], p[i]
            if dans(b):
                if not dans(a): res.append(coupe(a, b, ax, v))
                res.append(b)
            elif dans(a):
                res.append(coupe(a, b, ax, v))
        p = res
    return p

def coupe(a, b, ax, v):
    t = (v - a[ax]) / (b[ax] - a[ax])
    q = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
    return (round(q[0], 1), round(q[1], 1))

def ferme(p): return len(p) > 3 and p[0] == p[-1]

def surface(p, eps):
    if len(p) < 4: return None
    q = p[:-1] if p[0] == p[-1] else p
    if not all(dedans(x, 0) for x in q):
        q = decoupe(q)
    if len(q) < 3: return None
    q = dp(q + [q[0]], eps)
    return q if len(q) >= 4 else None

def aire(p):
    return abs(sum(p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1] for i in range(len(p) - 1))) / 2

def centre(p):
    q = p[:-1] if p[0] == p[-1] else p
    return (round(sum(a[0] for a in q) / len(q), 1), round(sum(a[1] for a in q) / len(q), 1))

def anneaux(refs_ways):
    brins = [list(W[w][0]) for w in refs_ways if w in W]
    out = []
    while brins:
        a = brins.pop()
        while a[0] != a[-1]:
            for i, b in enumerate(brins):
                if b[0] == a[-1]: a += b[1:]
                elif b[-1] == a[-1]: a += b[::-1][1:]
                elif b[-1] == a[0]: a = b + a[1:]
                elif b[0] == a[0]: a = b[::-1] + a[1:]
                else: continue
                brins.pop(i); break
            else:
                break
        if a[0] == a[-1] and len(a) >= 4: out.append(a)
    return out

# ---- la sortie ----------------------------------------------------------------------
out = {
    'note': "Aveyron (acte II, la Cloche du Midi) — coordonnées de JEU : 1 unité = 1 m, origine au "
            "centre du lac de Saint-Gervais, x = est, z = sud (nord en -z), pas de pivot. "
            "Repère : repere_aveyron.py. Source : OpenStreetMap (ODbL, © OpenStreetMap et contributeurs). "
            "Les lieux marqués propose: true ne viennent PAS d'OSM : ce sont des propositions à valider par Eugène.",
    'origine': {'lat': LAT0, 'lon': LON0, 'lieu': 'centre du lac de Saint-Gervais (Saint-Amans-des-Cots)'},
    'cadres': CADRES,
    'lieux': [],
    'batiments': [],
    'routes': [], 'chemins': [], 'ponts': [],
    'eau': {'plans': [], 'cours': [], 'barrages': [], 'canaux': [], 'baignade': []},
    'murs': [], 'falaises': [],
    'verdure': {'bois': [], 'landes': [], 'pres': [], 'rochers': [], 'jardins': []},
}

CLS_ROUTE = {'primary': 3, 'secondary': 3, 'tertiary': 2, 'residential': 2, 'living_street': 2,
             'unclassified': 2, 'pedestrian': 1, 'service': 1}
CLS_CHEMIN = {'track': 1, 'footway': 0, 'path': 0, 'steps': 0}

def pose(dst, refs, eps, **extra):
    p = ligne(refs)
    if len(p) < 2: return
    morc = [p] if all(dedans(q) for q in p) else morceaux(p)
    for m in morc:
        e = {'pts': dp(m, eps)}
        e.update({k: v for k, v in extra.items() if not (v is None or v is False or v == '')})
        dst.append(e)

def flags(d):
    return {'pont': 'viaduc' if d.get('bridge') == 'viaduct' else ('oui' if d.get('bridge') in ('yes', 'aqueduct') else None),
            'tunnel': d.get('tunnel') if d.get('tunnel') in ('yes', 'culvert', 'flooded') else None}

def niveaux(d):
    try: return float(d.get('building:levels'))
    except (TypeError, ValueError): return None

def hauteur(d):
    try: return float(str(d.get('height', '')).replace('m', '').strip())
    except ValueError: return None

def batiment(p, d, trous=None):
    s = surface(p, 0.4)        # 0,4 m : une grange du Ségala fait 8 m, une maison 6
    if not s or not all(dedans(q, 0) for q in s[:-1]): return
    e = {'pts': s}
    if d.get('building') not in (None, 'yes'): e['k'] = d['building']
    for cle, v in (('niv', niveaux(d)), ('h', hauteur(d)), ('nom', d.get('name'))):
        if v: e[cle] = v
    if d.get('roof:material'): e['toit'] = d['roof:material']
    if trous: e['trous'] = trous
    out['batiments'].append(e)

for wid, (refs, d) in W.items():
    nom = d.get('name')
    p = ligne(refs)
    if len(p) < 2: continue
    if 'building' in d and ferme(p):
        batiment(p, d)
        continue
    # ---- eau ----
    if d.get('natural') == 'water' and ferme(p):
        s = surface(p, 1.0)
        if s: out['eau']['plans'].append({'pts': s, 'nom': nom} if nom else {'pts': s})
        continue
    if d.get('leisure') == 'swimming_area' and ferme(p):
        s = surface(p, 0.5)            # la baignade surveillée du lac : la plage du jeu
        if s: out['eau']['baignade'].append({'pts': s})
        continue
    if d.get('waterway') == 'dam':
        pose(out['eau']['barrages'], refs, 0.5, nom=nom); continue
    if d.get('waterway') in ('river', 'stream'):
        pose(out['eau']['cours'], refs, 2.0 if d['waterway'] == 'stream' else 1.2,
             k='riviere' if d['waterway'] == 'river' else 'ruisseau', nom=nom, **flags(d)); continue
    if d.get('waterway') in ('canal', 'ditch', 'drain', 'pressurised'):
        pose(out['eau']['canaux'], refs, 1.5, k=d.get('usage') or d['waterway'], **flags(d)); continue
    # ---- voirie ----
    h = d.get('highway')
    if h in CLS_ROUTE:
        pose(out['routes'], refs, 1.2, r=CLS_ROUTE[h], nom=nom, **flags(d)); continue
    if h in CLS_CHEMIN:
        pose(out['chemins'], refs, 1.5, r=CLS_CHEMIN[h], k=h if h == 'steps' else None, nom=nom, **flags(d)); continue
    if d.get('man_made') == 'bridge' and ferme(p):
        s = surface(p, 0.5)
        if s: out['ponts'].append({'pts': s, 'nom': nom})
        continue
    if d.get('man_made') in ('pier', 'groyne'):
        pose(out['ponts'], refs, 0.5, k=d['man_made']); continue
    # ---- murs, falaises ----
    if d.get('barrier') in ('wall', 'retaining_wall'):
        pose(out['murs'], refs, 0.5, k=d['barrier'], nom=nom); continue
    if d.get('natural') == 'cliff':
        pose(out['falaises'], refs, 1.5); continue
    # ---- verdure ----
    if not ferme(p): continue
    nat, lu, le = d.get('natural'), d.get('landuse'), d.get('leisure')
    cle = ('bois' if nat == 'wood' or lu == 'forest' else
           'landes' if nat in ('heath', 'scrub') else
           'pres' if nat == 'grassland' or lu in ('meadow', 'grass') else
           'rochers' if nat == 'bare_rock' else
           'jardins' if le in ('garden', 'park') or lu == 'cemetery' else None)
    if cle:
        s = surface(p, 2.0)
        if s: out['verdure'][cle].append({'pts': s, 'nom': nom} if nom else {'pts': s})

# ---- relations : multipolygones (le réservoir de Montézic, les bois) ----
for rid, (mem, d) in R.items():
    if d.get('type') != 'multipolygon': continue
    ext = [r for (t, r, role) in mem if t == 'way' and role == 'outer']
    inn = [r for (t, r, role) in mem if t == 'way' and role == 'inner']
    for a in anneaux(ext):
        p = ligne(a)
        if 'building' in d:
            trous = [s for s in (surface(ligne(i), 0.3) for i in anneaux(inn)) if s]
            batiment(p, d, trous); continue
        if d.get('natural') == 'water':
            s = surface(p, 1.5)
            if s: out['eau']['plans'].append({'pts': s, 'nom': d.get('name')})
            continue
        nat, lu = d.get('natural'), d.get('landuse')
        cle = 'bois' if nat == 'wood' or lu == 'forest' else 'landes' if nat in ('heath', 'scrub') else None
        if cle:
            s = surface(p, 3.0)
            if s: out['verdure'][cle].append(dict({'pts': s}, **({'src': 'CORINE'} if d.get('CLC:code') else {})))

# ---- les lieux : ce qu'un dialogue ou une quête peut nommer ----
K_LIEU = {'village', 'hamlet', 'isolated_dwelling', 'locality', 'quarter', 'neighbourhood'}
vus = set()
for nid, (la, lo, d) in N.items():
    k = d.get('place') if d.get('place') in K_LIEU else (
        'sommet' if d.get('natural') == 'peak' else
        'source' if d.get('natural') == 'spring' else
        'croix' if 'wayside_cross' in (d.get('historic') or '') or d.get('man_made') == 'cross' else
        'monument' if d.get('historic') == 'memorial' else
        'fontaine' if d.get('amenity') in ('fountain', 'drinking_water') else
        'ecole' if d.get('amenity') == 'school' else
        'reservoir' if d.get('man_made') == 'reservoir_covered' else
        'seuil' if d.get('waterway') == 'weir' else
        'belvedere' if d.get('tourism') == 'viewpoint' else
        'four' if d.get('amenity') == 'baking_oven' else None)
    if not k: continue
    x, z = jeu(la, lo)
    if not dedans((x, z), 0): continue
    nom = d.get('name')
    if nom and (nom, k) in vus: continue
    vus.add((nom, k))
    e = {'k': k, 'x': round(x, 1), 'z': round(z, 1)}
    if nom: e['nom'] = nom
    if 'memorial' in (d.get('historic') or ''): e['note'] = 'monument aux morts'
    out['lieux'].append(e)

# Les bâtiments nommés ou utiles (églises, mairie) deviennent des lieux, à leur centre ;
# les « Place … » de la voirie aussi (la place du Marronnier est une voie de service dans OSM).
for wid, (refs, d) in W.items():
    p = ligne(refs)
    if len(p) < 2 or not all(dedans(q, 0) for q in p): continue
    x, z = centre(p)
    if d.get('amenity') == 'place_of_worship':
        out['lieux'].append({'k': 'eglise', 'nom': d.get('name', 'église'), 'x': x, 'z': z})
    elif d.get('amenity') == 'townhall':
        out['lieux'].append({'k': 'mairie', 'nom': d.get('name', 'Mairie'), 'x': x, 'z': z})
    elif d.get('landuse') == 'cemetery':
        out['lieux'].append({'k': 'cimetiere', 'nom': d.get('name', 'Cimetière'), 'x': x, 'z': z})
    elif d.get('highway') and (d.get('name') or '').startswith('Place'):
        if ('place', d['name']) in vus: continue
        vus.add(('place', d['name']))
        out['lieux'].append({'k': 'place', 'nom': d['name'], 'x': x, 'z': z})
    elif d.get('waterway') == 'dam':
        out['lieux'].append({'k': 'barrage', 'nom': d.get('name') or 'Barrage du lac de Saint-Gervais', 'x': x, 'z': z})

# ---- ce qu'OSM ne donne pas : des PROPOSITIONS, à valider par Eugène ----------------
# README (« les trois maisons autour du lac ») et STORY.md (acte II) posent les maisons
# Roquette, le duel du lac, les sources et le Dormeur ; aucun n'est dans OSM. On les propose
# ici, à des endroits choisis sur le plan et dits dans la note — rien n'est posé en silence.
# Le jeu ne doit pas les prendre pour acquis tant que « propose » est là.
PROPOSES = [
    # Les deux branches rivales sur les deux rives opposées, l'aïeule entre elles au nord :
    # la géographie dit la querelle avant le premier dialogue.
    {'k': 'maison', 'nom': 'Le Batut', 'x': -135.0, 'z': 170.0,
     'note': "rive ouest, dans le bois entre la route et le lac, à 300 m du barrage : le Batut "
             "tient le côté de la retenue — la dernière réserve d'eau que Beauregard l'accuse de garder"},
    {'k': 'maison', 'nom': 'Beauregard', 'x': 400.0, 'z': 150.0,
     'note': "rive est, sur la pente au-dessus du bras sud-est : il « regarde » le lac et le Batut en face"},
    {'k': 'maison', 'nom': 'Le Pouget (la grande maison)', 'x': 185.0, 'z': -315.0,
     'note': "rive nord-est, dans les prés entre le lac et Perpignou, à égale distance des deux autres : "
             "c'est là que les familles se retrouvent chez l'aïeule"},
    {'k': 'duel', 'nom': 'Le duel du lac', 'x': -222.0, 'z': -75.0,
     'note': "sur la crête du barrage (OSM, way 695976753) : un passage étroit entre l'eau et le vide, "
             "au point même que les deux familles se disputent"},
    {'k': 'source', 'nom': 'La source des Vergnes', 'x': 470.0, 'z': 440.0,
     'note': "sur le ruisseau des Vergnes, qui NOURRIT le lac par le sud-est (il en sort au barrage) : "
             "la bande l'a bouchée, le lac baisse. Les autres sources de la quête : la fontaine du lac "
             "(OSM, x -269 z -339) et les deux fontaines de Saint-Symphorien (OSM)"},
    {'k': 'dormeur', 'nom': 'Le Dormeur', 'x': 2550.0, 'z': -150.0,
     'zone': [[1700, -750], [3400, -750], [3400, 450], [1700, 450], [1700, -750]],
     'note': "aucune falaise dans OSM : le géant couché se cherche sur le relief (pas encore récolté), "
             "dans les 2 km sans plan entre le lac et le bourg — rien n'y gêne un géant de 300 m"},
]
for e in PROPOSES:
    out['lieux'].append(dict(e, propose=True))

# ---- les cadrages proposés : le jeu ne chargera pas 5 km d'un coup ----
def boite(pts, m):
    xs = [q[0] for q in pts]; zs = [q[1] for q in pts]
    return {'x0': round(min(xs) - m), 'z0': round(min(zs) - m), 'x1': round(max(xs) + m), 'z1': round(max(zs) + m)}

lac = max(out['eau']['plans'], key=lambda e: aire(e['pts']) if e.get('nom', '').startswith('Lac') else 0)
eglise_ss = next(l for l in out['lieux'] if l['k'] == 'eglise' and 'Symphorien' in l['nom'])
out['cadrages'] = {
    'lac':   dict(boite(lac['pts'], 250), nom='Lac de Saint-Gervais',
                  note="le lac, le barrage et 250 m de rive : la place des trois maisons Roquette"),
    'bourg': dict(boite([(eglise_ss['x'], eglise_ss['z'])], 300), nom='Saint-Symphorien-de-Thénières',
                  note="le bourg, 600 × 600 m autour de l'église"),
}

json.dump(out, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)

# ---- bilan ----
def n(v): return len(v) if isinstance(v, list) else sum(len(x) for x in v.values() if isinstance(x, list))
print('aveyron.json : %.0f Ko' % (os.path.getsize(OUT) / 1024))
for c in CADRES:
    print('  cadre %-30s x %6.0f..%6.0f  z %6.0f..%6.0f  (%.0f × %.0f m)' % (c['src'], c['x0'], c['x1'], c['z0'], c['z1'], c['x1'] - c['x0'], c['z1'] - c['z0']))
print('  trou entre les cadres : %.0f m' % (CADRES[1]['x0'] - CADRES[0]['x1']))
for k in ('batiments', 'routes', 'chemins', 'ponts', 'murs', 'falaises', 'lieux'):
    print('  %-10s %d' % (k, n(out[k])))
for g in ('eau', 'verdure'):
    print('  %-10s %s' % (g, {k: len(v) for k, v in out[g].items()}))
print('  lac : %.1f ha' % (aire(lac['pts']) / 1e4))
for k, c in out['cadrages'].items():
    print('  cadrage %-6s x %6d..%6d  z %6d..%6d' % (k, c['x0'], c['x1'], c['z0'], c['z1']))

if '--sans-apercu' not in sys.argv:
    subprocess.run([sys.executable, os.path.join(ICI, 'apercu-aveyron.py')], check=False)
