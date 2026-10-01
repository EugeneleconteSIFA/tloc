#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les deux extraits OSM de Lozère  →  lozere.json, en coordonnées de JEU (1 unité = 1 m).

Sur le modèle de carte/extraire-osm.py (Lille), mais pour un autre monde : chemins relatifs,
repère partagé avec le relief (repere_lozere.py), et deux extraits fondus en un seul plan —
lozere-villefort-pouget.osm (Villefort, le lac, le Pouget) et lozere-garde-guerin.osm
(le village fortifié, 600 m plus au nord, hors du premier cadre).

    python3 extraire-lozere.py          (bibliothèque standard seulement)

Écrit lozere.json, puis lance apercu-lozere.py pour le plan à valider.
"""
import xml.etree.ElementTree as ET, json, math, os, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from repere_lozere import jeu, LAT0, LON0

SOURCES = ['lozere-villefort-pouget.osm', 'lozere-garde-guerin.osm']
OUT = os.path.join(ICI, 'lozere.json')
MARGE = 40.0        # comme à Lille : on garde 40 m au-delà du cadre, pas trois kilomètres

# ---- lecture : les deux fichiers dans un même dictionnaire --------------------------
# Un way présent dans les deux exports (la Régordane traverse les deux) n'est gardé
# qu'une fois ; ses nœuds manquants d'un côté sont souvent présents de l'autre.
N, W, R = {}, {}, {}
CADRES = []          # les emprises déclarées de chaque extrait, en coordonnées de jeu

def tags(el): return {t.get('k'): t.get('v') for t in el.findall('tag')}

for nom in SOURCES:
    root = ET.parse(os.path.join(ICI, nom)).getroot()
    b = root.find('bounds')
    x0, z1 = jeu(float(b.get('minlat')), float(b.get('minlon')))
    x1, z0 = jeu(float(b.get('maxlat')), float(b.get('maxlon')))
    # l'échelle est-ouest varie avec la latitude : on prend le plus large des deux bords
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

# ---- géométrie ----------------------------------------------------------------------
def dp(p, eps):
    """Douglas-Peucker : allège sans déformer (celui de Lille, en itératif — les ruisseaux
    de 480 points font sauter la pile en récursif)."""
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
    """Une ligne qui sort du cadre est coupée en tronçons, comme à Lille."""
    out, cur = [], []
    for q in p:
        if dedans(q): cur.append(q)
        elif cur: out.append(cur); cur = []
    if cur: out.append(cur)
    return [m for m in out if len(m) >= 2]

def cadre_de(p):
    """Le cadre où tombe le centre d'une surface — celui contre lequel on la découpe."""
    cx = sum(q[0] for q in p) / len(p); cz = sum(q[1] for q in p) / len(p)
    for c in CADRES:
        if c['x0'] <= cx <= c['x1'] and c['z0'] <= cz <= c['z1']: return c
    return max(CADRES, key=lambda c: (c['x1'] - c['x0']) * (c['z1'] - c['z0']))

def decoupe(p):
    """Sutherland-Hodgman : une SURFACE qui déborde reste fermée. Lille coupait les surfaces
    comme des lignes ; ici les bois CORINE font des kilomètres, il faut les refermer au bord."""
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
    """Polygone fermé, découpé au cadre, allégé ; None s'il ne reste rien."""
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
    """Recoud les ways d'une relation multipolygone en anneaux fermés. Les morceaux qui ne
    se referment pas (l'export ne livre pas toujours tout le contour) sont abandonnés."""
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
    'note': "Lozère (acte V) — coordonnées de JEU : 1 unité = 1 m, origine au hameau du Pouget, "
            "x = est, z = sud (nord en -z), pas de pivot. Repère : repere_lozere.py. "
            "Source : OpenStreetMap (ODbL, © OpenStreetMap et contributeurs).",
    'origine': {'lat': LAT0, 'lon': LON0, 'lieu': 'Le Pouget (hameau, Pourcharesses)'},
    'cadres': CADRES,
    'lieux': [],
    'batiments': [],
    'routes': [], 'chemins': [], 'ponts': [],
    'regordane': [],
    'eau': {'plans': [], 'cours': [], 'barrages': [], 'canaux': []},
    'fer': {'voies': [], 'quais': [], 'gare': None},
    'garde': {'enceinte': [], 'chateau': [], 'tour': [], 'eglise': []},
    'murs': [], 'falaises': [],
    'verdure': {'bois': [], 'landes': [], 'pres': [], 'rochers': [], 'jardins': []},
}

CLS_ROUTE = {'primary': 3, 'secondary': 3, 'tertiary': 2, 'residential': 2, 'living_street': 2,
             'unclassified': 2, 'pedestrian': 1, 'service': 1}
CLS_CHEMIN = {'track': 1, 'footway': 0, 'path': 0, 'steps': 0, 'via_ferrata': 0}

def pose(dst, refs, eps, **extra):
    p = ligne(refs)
    if len(p) < 2: return
    morc = [p] if all(dedans(q) for q in p) else morceaux(p)
    for m in morc:
        e = {'pts': dp(m, eps)}
        # « is » et non « in » : r = 0 (sentier) vaut False pour Python, et disparaissait
        e.update({k: v for k, v in extra.items() if not (v is None or v is False or v == '')})
        dst.append(e)

def flags(d):
    """Pont, tunnel, viaduc : ce que le jeu doit savoir pour ne pas poser la route sur le sol."""
    return {'pont': 'viaduc' if d.get('bridge') == 'viaduct' else ('oui' if d.get('bridge') in ('yes', 'aqueduct') else None),
            'tunnel': d.get('tunnel') if d.get('tunnel') in ('yes', 'culvert', 'flooded') else None}

def niveaux(d):
    try: return float(d.get('building:levels'))
    except (TypeError, ValueError): return None

def hauteur(d):
    try: return float(str(d.get('height', '')).replace('m', '').strip())
    except ValueError: return None

def batiment(p, d, trous=None):
    s = surface(p, 0.4)        # 0,4 m et non 1,2 : une maison du Pouget fait 6 m de côté
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
    # ---- la Garde-Guérin : la forteresse ----
    if d.get('historic') == 'castle':
        s = surface(p, 0.3)
        if s: out['garde']['chateau'].append({'pts': s, 'nom': nom})
    if d.get('historic') == 'tower' or (nom or '').startswith('Tour de La Garde'):
        s = surface(p, 0.2)
        if s: out['garde']['tour'].append({'pts': s, 'nom': nom})
    if d.get('barrier') == 'city_wall' or d.get('historic') == 'citywalls':
        pose(out['garde']['enceinte'], refs, 0.3, nom=nom); continue
    # ---- bâti ----
    if 'building' in d and ferme(p):
        batiment(p, d)
        continue
    # ---- eau ----
    if d.get('natural') == 'water' and ferme(p):
        s = surface(p, 1.0)
        if s: out['eau']['plans'].append({'pts': s, 'nom': nom, 'k': d.get('water')} if nom else {'pts': s})
        continue
    if d.get('waterway') == 'dam':
        pose(out['eau']['barrages'], refs, 0.5, nom=nom); continue
    if d.get('waterway') in ('river', 'stream'):
        pose(out['eau']['cours'], refs, 2.0 if d['waterway'] == 'stream' else 1.2,
             k='riviere' if d['waterway'] == 'river' else 'ruisseau', nom=nom, **flags(d)); continue
    if d.get('waterway') in ('canal', 'ditch', 'pressurised'):
        pose(out['eau']['canaux'], refs, 1.5, k=d.get('usage') or d['waterway'], **flags(d)); continue
    # ---- fer ----
    if d.get('railway') in ('rail', 'abandoned'):
        pose(out['fer']['voies'], refs, 1.0, nom=nom, triage=d.get('service') in ('yard', 'siding', 'spur'),
             abandonnee=d['railway'] == 'abandoned', **flags(d)); continue
    if d.get('railway') == 'platform':
        if ferme(p):
            s = surface(p, 0.3)
            if s: out['fer']['quais'].append({'pts': s, 'nom': nom})
        else:
            pose(out['fer']['quais'], refs, 0.3, nom=nom)
        continue
    # ---- voirie ----
    h = d.get('highway')
    if h in CLS_ROUTE:
        pose(out['routes'], refs, 1.2, r=CLS_ROUTE[h], nom=nom, **flags(d)); continue
    if h in CLS_CHEMIN:
        pose(out['chemins'], refs, 1.5, r=CLS_CHEMIN[h], k=h if h in ('steps', 'via_ferrata') else None,
             nom=nom, **flags(d)); continue
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

# ---- relations : multipolygones et la Régordane ----
for rid, (mem, d) in R.items():
    if d.get('type') == 'multipolygon':
        ext = [r for (t, r, role) in mem if t == 'way' and role == 'outer']
        inn = [r for (t, r, role) in mem if t == 'way' and role == 'inner']
        for a in anneaux(ext):
            p = ligne(a)
            if 'building' in d:
                trous = [s for s in (surface(ligne(i), 0.3) for i in anneaux(inn)) if s]
                batiment(p, d, trous); continue
            nat, lu = d.get('natural'), d.get('landuse')
            cle = 'bois' if nat == 'wood' or lu == 'forest' else 'landes' if nat in ('heath', 'scrub') else None
            if cle:
                s = surface(p, 3.0)
                # CORINE Land Cover : tracé au 1:100 000, à prendre comme une ambiance, pas une limite
                if s: out['verdure'][cle].append(dict({'pts': s}, **({'src': 'CORINE'} if d.get('CLC:code') else {})))
    # La Régordane : la voie des pèlerins et des muletiers, de Langogne à Alès par la Garde-Guérin
    # et Villefort — les « vieux chemins » de STORY.md. Ses tronçons sont déjà dans routes et
    # chemins ; on la redonne ici d'un seul trait, pour que le jeu sache la suivre.
    if d.get('route') == 'hiking' and ('Régordane' in d.get('name', '') or d.get('name', '').startswith('Ancienne Route')):
        for (t, r, role) in mem:
            if t == 'way' and r in W:
                pose(out['regordane'], W[r][0], 1.5, nom=d['name'])

# ---- les lieux : ce qu'un dialogue ou une quête peut nommer ----
K_LIEU = {'village', 'hamlet', 'isolated_dwelling', 'locality', 'quarter', 'neighbourhood'}
vus = set()
for nid, (la, lo, d) in N.items():
    k = d.get('place') if d.get('place') in K_LIEU else (
        'sommet' if d.get('natural') == 'peak' else
        'gare' if d.get('railway') in ('station', 'halt') else
        'source' if d.get('natural') == 'spring' else
        'croix' if d.get('historic') == 'wayside_cross' else
        'belvedere' if d.get('tourism') == 'viewpoint' else
        'four' if d.get('amenity') == 'baking_oven' else None)
    if not k: continue
    x, z = jeu(la, lo)
    if not dedans((x, z), 0): continue
    nom = d.get('name')
    if (nom, k) in vus and nom: continue      # « La Garde Guérin » et « La Garde-Guérin » : un seul
    vus.add((nom, k))
    e = {'k': k, 'x': round(x, 1), 'z': round(z, 1)}
    if nom: e['nom'] = nom
    out['lieux'].append(e)
    if k == 'gare': out['fer']['gare'] = e

# Les bâtiments nommés (églises, château, four banal) deviennent aussi des lieux, à leur centre.
for wid, (refs, d) in W.items():
    if not d.get('name') or not ('building' in d or d.get('historic') or d.get('amenity') in ('place_of_worship', 'baking_oven')):
        continue
    p = ligne(refs)
    if len(p) < 3 or not all(dedans(q, 0) for q in p): continue
    x, z = centre(p)
    k = ('eglise' if d.get('amenity') == 'place_of_worship' else
         'chateau' if d.get('historic') in ('castle', 'building') and 'Château' in d['name'] else
         'tour' if d.get('historic') == 'tower' else
         'four' if d.get('amenity') == 'baking_oven' else 'batiment')
    out['lieux'].append({'k': k, 'nom': d['name'], 'x': x, 'z': z})
    if k == 'eglise' and 'Michel' in d['name']:
        out['garde']['eglise'].append({'pts': surface(p, 0.2), 'nom': d['name']})
for wid, (refs, d) in W.items():
    if d.get('waterway') == 'dam' and d.get('name'):
        p = ligne(refs)
        out['lieux'].append({'k': 'barrage', 'nom': d['name'], 'x': centre(p)[0], 'z': centre(p)[1]})

# ---- les cadrages proposés à Eugène : le jeu ne chargera pas 6 km d'un coup ----
def boite(pts, m):
    xs = [q[0] for q in pts]; zs = [q[1] for q in pts]
    return {'x0': round(min(xs) - m), 'z0': round(min(zs) - m), 'x1': round(max(xs) + m), 'z1': round(max(zs) + m)}

lac = max(out['eau']['plans'], key=lambda e: aire(e['pts']))
gg = out['garde']['enceinte']
out['cadrages'] = {
    'pouget': dict(boite([(0, 0)], 300), nom='Le Pouget', note="le hameau et sa pente, 600 × 600 m autour du nœud OSM"),
    'lac':    dict(boite(lac['pts'], 150), nom='Lac de Villefort', note='le lac entier, le barrage et 150 m de rive'),
    'garde':  dict(boite([q for e in gg for q in e['pts']], 200), nom='La Garde-Guérin', note="l'enceinte et 200 m autour"),
}

json.dump(out, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)

# ---- bilan ----
def n(v): return len(v) if isinstance(v, list) else sum(len(x) for x in v.values() if isinstance(x, list))
print('lozere.json : %.0f Ko' % (os.path.getsize(OUT) / 1024))
for c in CADRES:
    print('  cadre %-28s x %6.0f..%6.0f  z %6.0f..%6.0f  (%.0f × %.0f m)' % (c['src'], c['x0'], c['x1'], c['z0'], c['z1'], c['x1'] - c['x0'], c['z1'] - c['z0']))
for k in ('batiments', 'routes', 'chemins', 'ponts', 'regordane', 'murs', 'falaises', 'lieux'):
    print('  %-10s %d' % (k, n(out[k])))
for g in ('eau', 'fer', 'garde', 'verdure'):
    print('  %-10s %s' % (g, {k: (len(v) if isinstance(v, list) else ('oui' if v else '—')) for k, v in out[g].items()}))
print('  lac : %.0f ha' % (aire(lac['pts']) / 1e4))
for k, c in out['cadrages'].items():
    print('  cadrage %-7s x %6d..%6d  z %6d..%6d' % (k, c['x0'], c['x1'], c['z0'], c['z1']))

if '--sans-apercu' not in sys.argv:
    subprocess.run([sys.executable, os.path.join(ICI, 'apercu-lozere.py')], check=False)
