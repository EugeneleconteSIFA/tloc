#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les trois extraits OSM des Pouilles  →  matera.json, alberobello.json, gallipoli.json.

Acte IV, la Cloche des Heures. Copie d'extraire-lozere.py (Sutherland-Hodgman sur les
surfaces, Douglas-Peucker à 0,4 m sur le bâti, repère importé), mais trois villes à 50–100 km
l'une de l'autre : UN REPÈRE PAR VILLE (repere_pouilles.py), pas de carte commune. Le petit
train qui les relie est une transition de jeu : de lui, on ne garde que la voie ferrée et
la gare de chaque ville — là où le train dépose Camille.

    python3 extraire-pouilles.py              les trois villes
    python3 extraire-pouilles.py gallipoli    une seule

Bibliothèque standard seulement. Lance apercu-pouilles.py à la fin.

Barletta et Castel del Monte n'en sont pas : Eugène et Camille n'y sont jamais allés
(Eugène, 2 octobre). Le monde, ce sont les trois villes.
"""
import xml.etree.ElementTree as ET, json, math, os, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import repere_pouilles as RP

# Une ville peut avoir plusieurs extraits, fondus comme en Lozère : à Gallipoli, le second
# (2 octobre) pousse 1,1 km plus à l'est, jusqu'à la gare que le premier laissait dehors.
SOURCES = {'matera': ['pouilles-matera.osm'], 'alberobello': ['pouilles-alberobello.osm'],
           'gallipoli': ['pouilles-gallipoli.osm', 'pouilles-gallipoli-gare.osm']}
# La gare où le train dépose Camille : celle du centre, quand la ville en a deux (Matera Sud
# est à 1 km des Sassi, Matera Centrale sous la piazza Matteotti, au bord du Piano).
GARES = {'matera': 'Matera Centrale', 'alberobello': 'Alberobello', 'gallipoli': 'Gallipoli'}
MARGE = 40.0

# ---- géométrie (celle d'extraire-lozere.py ; CADRE change à chaque ville) --------------
CADRE = None

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
    c = CADRE
    return c['x0'] - m <= q[0] <= c['x1'] + m and c['z0'] - m <= q[1] <= c['z1'] + m

def morceaux(p):
    out, cur = [], []
    for q in p:
        if dedans(q): cur.append(q)
        elif cur: out.append(cur); cur = []
    if cur: out.append(cur)
    return [m for m in out if len(m) >= 2]

def decoupe(p):
    """Sutherland-Hodgman contre le cadre (+ marge) : une SURFACE qui déborde reste fermée."""
    c = CADRE
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

def anneaux(W, refs_ways):
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

def terre_ferme(p):
    """Le trait de côte OSM laisse la terre à sa GAUCHE. Une côte ouverte (elle file hors du
    cadre des deux côtés) est refermée loin sur sa gauche, puis découpée au cadre : on obtient
    la terre ferme comme une surface, et la mer est le reste. Sans ça, Gallipoli n'aurait
    pas de mer — OSM ne dessine jamais la mer elle-même."""
    (xa, za), (xb, zb) = p[0], p[-1]
    dx, dn = xb - xa, -(zb - za)                 # en (est, nord) : z est vers le sud
    L = math.hypot(dx, dn) or 1.0
    gx, gn = -dn / L * 1e5, dx / L * 1e5         # la gauche, à 100 km
    q = list(p) + [(xb + gx, zb - gn), (xa + gx, za - gn)]
    return decoupe(q)

CLS_ROUTE = {'primary': 3, 'secondary': 3, 'tertiary': 2, 'tertiary_link': 2, 'residential': 2,
             'living_street': 2, 'unclassified': 2, 'pedestrian': 1, 'service': 1}
CLS_CHEMIN = {'track': 1, 'footway': 0, 'path': 0, 'steps': 0}

def extraire(ville):
    global CADRE
    def jeu(la, lo): return RP.jeu(ville, la, lo)
    def tags(el): return {t.get('k'): t.get('v') for t in el.findall('tag')}
    N, W, R, bords = {}, {}, {}, []
    for src in SOURCES[ville]:
        root = ET.parse(os.path.join(ICI, src)).getroot()
        b = root.find('bounds')
        x0, z1 = jeu(float(b.get('minlat')), float(b.get('minlon')))
        x1, z0 = jeu(float(b.get('maxlat')), float(b.get('maxlon')))
        xa, _ = jeu(float(b.get('maxlat')), float(b.get('minlon')))
        xb, _ = jeu(float(b.get('minlat')), float(b.get('maxlon')))
        bords.append((min(x0, xa), max(x1, xb), z0, z1))
        for n in root.findall('node'):
            N[n.get('id')] = (float(n.get('lat')), float(n.get('lon')), tags(n))
        for w in root.findall('way'):
            W.setdefault(w.get('id'), ([nd.get('ref') for nd in w.findall('nd')], tags(w)))
        for r in root.findall('relation'):
            R.setdefault(r.get('id'), ([(m.get('type'), m.get('ref'), m.get('role')) for m in r.findall('member')], tags(r)))
    # Un seul cadre, l'enveloppe des extraits : à Gallipoli ils ont presque la même latitude
    # (40 m d'écart aux coins), donc l'enveloppe ne promet rien qu'OSM n'ait pas livré.
    CADRE = {'src': ' + '.join(SOURCES[ville]), 'x0': round(min(b[0] for b in bords), 1),
             'x1': round(max(b[1] for b in bords), 1), 'z0': round(min(b[2] for b in bords), 1),
             'z1': round(max(b[3] for b in bords), 1)}

    def ligne(refs):
        out = []
        for i in refs:
            if i in N:
                x, z = jeu(N[i][0], N[i][1]); out.append((round(x, 1), round(z, 1)))
        return out

    o = RP.ORIGINES[ville]
    out = {
        'note': "%s (acte IV, la Cloche des Heures) — coordonnées de JEU : 1 unité = 1 m, origine : %s, "
                "x = est, z = sud (nord en -z), pas de pivot. Repère : repere_pouilles.py (un par ville). "
                "Source : OpenStreetMap (ODbL, © OpenStreetMap et contributeurs)." % (ville.capitalize(), o['lieu']),
        'origine': dict(o),
        'cadre': CADRE,
        'lieux': [],
        'batiments': [],
        'routes': [], 'chemins': [], 'ponts': [],
        'enceinte': [], 'murs': [], 'falaises': [],
        'eau': {'plans': [], 'cours': [], 'canaux': [], 'recifs': []},
        'cote': {'terre': [], 'iles': []},
        'fer': {'voies': [], 'quais': [], 'gare': None},
        'verdure': {'bois': [], 'landes': [], 'pres': [], 'champs': [], 'rochers': [], 'jardins': []},
    }

    def pose(dst, refs, eps, **extra):
        p = ligne(refs)
        if len(p) < 2: return
        for m in ([p] if all(dedans(q) for q in p) else morceaux(p)):
            e = {'pts': dp(m, eps)}
            e.update({k: v for k, v in extra.items() if not (v is None or v is False or v == '')})
            dst.append(e)

    def flags(d):
        return {'pont': 'viaduc' if d.get('bridge') == 'viaduct' else ('oui' if d.get('bridge') in ('yes', 'aqueduct') else None),
                'tunnel': d.get('tunnel') if d.get('tunnel') in ('yes', 'culvert', 'flooded') else None}

    def batiment(p, d, trous=None):
        s = surface(p, 0.4)        # 0,4 m : un trullo fait 4 à 5 m de diamètre
        if not s or not all(dedans(q, 0) for q in s[:-1]): return
        e = {'pts': s}
        if d.get('building') not in (None, 'yes'): e['k'] = d['building']
        try:
            if d.get('building:levels'): e['niv'] = float(d['building:levels'])
        except ValueError: pass
        try:
            if d.get('height'): e['h'] = float(str(d['height']).replace('m', '').replace(',', '.').strip())
        except ValueError: pass
        if d.get('name'): e['nom'] = d['name']
        if d.get('roof:shape'): e['toit'] = d['roof:shape']
        if trous: e['trous'] = trous
        out['batiments'].append(e)

    cotes_ouvertes = []
    for wid, (refs, d) in W.items():
        nom = d.get('name')
        p = ligne(refs)
        if len(p) < 2: continue
        # ---- la côte (Gallipoli) : les îlots sont des anneaux fermés, la terre ferme un trait ouvert ----
        if d.get('natural') == 'coastline':
            if ferme(p):
                s = surface(p, 0.5)
                if s: out['cote']['terre'].append(s)
            else:
                cotes_ouvertes.append(refs)
            if d.get('place') not in ('islet', 'island'): continue
        if d.get('place') in ('islet', 'island') and ferme(p):
            s = surface(p, 0.5)
            if s: out['cote']['iles'].append({'pts': s, 'nom': nom})
            continue
        if d.get('barrier') == 'city_wall' or d.get('historic') == 'citywalls':
            pose(out['enceinte'], refs, 0.3, nom=nom); continue
        if 'building' in d and ferme(p):
            batiment(p, d); continue
        # ---- eau ----
        if d.get('natural') == 'water' and ferme(p):
            s = surface(p, 0.5)
            if s: out['eau']['plans'].append({'pts': s, 'nom': nom} if nom else {'pts': s})
            continue
        if d.get('natural') == 'reef' and ferme(p):
            s = surface(p, 0.5)
            if s: out['eau']['recifs'].append({'pts': s})
            continue
        # La Gravina de Matera est un « drain » pour OSM : c'est le torrent du canyon, on le garde comme tel
        if d.get('waterway') in ('river', 'stream') or (d.get('waterway') == 'drain' and 'Torrente' in (nom or '')):
            pose(out['eau']['cours'], refs, 1.5, k='torrent' if 'Torrente' in (nom or '') else 'ruisseau', nom=nom, **flags(d)); continue
        if d.get('waterway') in ('canal', 'ditch', 'drain'):
            pose(out['eau']['canaux'], refs, 1.0, k=d['waterway'], **flags(d)); continue
        # ---- fer : la voie et la gare, c'est tout ----
        if d.get('railway') in ('rail', 'narrow_gauge', 'disused', 'abandoned'):
            pose(out['fer']['voies'], refs, 1.0, nom=nom, triage=d.get('service') in ('yard', 'siding', 'spur'),
                 desaffectee=d['railway'] in ('disused', 'abandoned'), etroite=d['railway'] == 'narrow_gauge', **flags(d))
            continue
        if d.get('railway') == 'platform' or (d.get('highway') == 'platform' and d.get('railway')):
            if ferme(p):
                s = surface(p, 0.3)
                if s: out['fer']['quais'].append({'pts': s})
            else:
                pose(out['fer']['quais'], refs, 0.3)
            continue
        # ---- voirie ----
        h = d.get('highway')
        if h in CLS_ROUTE:
            if d.get('area') == 'yes' and ferme(p):   # une piazza dessinée en surface
                s = surface(p, 0.5)
                if s: out['routes'].append({'pts': s, 'r': 1, 'surface': True, 'nom': nom} if nom else {'pts': s, 'r': 1, 'surface': True})
                continue
            pose(out['routes'], refs, 0.8, r=CLS_ROUTE[h], nom=nom, **flags(d)); continue
        if h in CLS_CHEMIN:
            # les escaliers sont la moitié des rues des Sassi : on les garde marqués
            pose(out['chemins'], refs, 0.8, r=CLS_CHEMIN[h], k=h if h == 'steps' else None, nom=nom, **flags(d)); continue
        if d.get('man_made') == 'bridge' and ferme(p):
            s = surface(p, 0.5)
            if s: out['ponts'].append({'pts': s, 'nom': nom})
            continue
        if d.get('man_made') in ('pier', 'groyne', 'breakwater'):
            if ferme(p):
                s = surface(p, 0.5)
                if s: out['ponts'].append({'pts': s, 'k': d['man_made']})
            else:
                pose(out['ponts'], refs, 0.5, k=d['man_made'])
            continue
        if d.get('barrier') in ('wall', 'retaining_wall'):
            pose(out['murs'], refs, 0.4, k=d['barrier'], nom=nom); continue
        if d.get('natural') == 'cliff':
            pose(out['falaises'], refs, 1.0); continue
        # ---- verdure ----
        if not ferme(p): continue
        nat, lu, le = d.get('natural'), d.get('landuse'), d.get('leisure')
        cle = ('bois' if nat == 'wood' or lu == 'forest' else
               'landes' if nat in ('heath', 'scrub') else
               'pres' if nat == 'grassland' or lu in ('meadow', 'grass') else
               'champs' if lu in ('farmland', 'orchard', 'vineyard') else
               'rochers' if nat == 'bare_rock' else
               'jardins' if le in ('garden', 'park') or lu == 'cemetery' else None)
        if cle:
            s = surface(p, 1.0)
            if s: out['verdure'][cle].append({'pts': s, 'nom': nom} if nom else {'pts': s})

    # la terre ferme : les traits ouverts recousus bout à bout, puis refermés sur leur gauche
    brins = [list(r) for r in cotes_ouvertes]
    while brins:
        a = brins.pop()
        for i, b_ in enumerate(brins):
            if b_[0] == a[-1]: a += b_[1:]; brins.pop(i); break
            if b_[-1] == a[0]: a = b_ + a[1:]; brins.pop(i); break
        s = terre_ferme(ligne(a))
        if len(s) >= 3: out['cote']['terre'].append(dp(s + [s[0]], 0.5))

    # ---- relations : les bâtiments en multipolygone (nombreux à Gallipoli), le château ----
    for rid, (mem, d) in R.items():
        if d.get('type') != 'multipolygon': continue
        ext = [r for (t, r, role) in mem if t == 'way' and role == 'outer']
        inn = [r for (t, r, role) in mem if t == 'way' and role == 'inner']
        for a in anneaux(W, ext):
            p = ligne(a)
            if 'building' in d:
                trous = [s for s in (surface(ligne(i), 0.3) for i in anneaux(W, inn)) if s]
                batiment(p, d, trous)
            elif d.get('highway') in CLS_ROUTE or d.get('highway') in CLS_CHEMIN:
                s = surface(p, 0.5)
                if s: out['routes'].append({'pts': s, 'r': 1, 'surface': True})

    # ---- les lieux : églises, places, portes, châteaux, belvédères, gare, port ----
    vus = set()
    def lieu(k, nom, x, z, **extra):
        if not dedans((x, z), 0) and k != 'gare': return None
        if nom and (k, nom) in vus: return None
        vus.add((k, nom))
        e = {'k': k, 'x': round(x, 1), 'z': round(z, 1)}
        if nom: e['nom'] = nom
        e.update({a: v for a, v in extra.items() if v})
        out['lieux'].append(e)
        return e

    def genre(d):
        nom = d.get('name') or ''
        if d.get('railway') in ('station', 'halt') or (d.get('railway') == 'stop' and d.get('public_transport') == 'stop_position'):
            return 'gare'
        if d.get('amenity') == 'place_of_worship': return 'eglise'
        if d.get('archaeological_site') == 'church' or d.get('historic') in ('church', 'deconsectrated church'): return 'eglise_rupestre' if d.get('building') == 'cave' else 'eglise'
        if d.get('historic') in ('castle', 'fort'): return 'chateau'
        # une porte : l'étiquette OSM, ou un nœud qui ne porte QUE son nom (« Portaterra » à
        # Gallipoli) — pas « Porta Pepice », une boutique de Matera
        if d.get('historic') == 'city_gate' or d.get('barrier') == 'city_gate' or (nom.startswith('Porta') and len(d) == 1): return 'porte'
        if d.get('tourism') == 'viewpoint': return 'belvedere'
        if d.get('leisure') == 'marina' or d.get('harbour') or d.get('landuse') == 'harbour': return 'port'
        if d.get('place') in ('town', 'suburb', 'neighbourhood', 'quarter', 'locality') or d.get('historic') == 'district': return 'quartier'
        if d.get('place') == 'square' or (d.get('highway') == 'pedestrian' and nom.startswith(('Piazza', 'Piazzetta', 'Largo'))): return 'place'
        if nom.startswith(('Piazza ', 'Piazzetta ', 'Largo ')) and len(d) <= 2: return 'place'
        if d.get('place') in ('islet', 'island'): return 'ile'
        if d.get('natural') == 'bay': return 'baie'
        if d.get('amenity') == 'fountain': return 'fontaine'
        if d.get('natural') == 'peak': return 'sommet'
        if d.get('building') == 'cave' or d.get('natural') == 'cave_entrance': return 'grotte'
        if d.get('historic') in ('monument', 'memorial', 'manor', 'house'): return 'monument'
        return None

    for nid, (la, lo, d) in N.items():
        k = genre(d)
        if not k or k == 'grotte' and not d.get('name'): continue
        x, z = jeu(la, lo)
        lieu(k, d.get('name'), x, z)
    for wid, (refs, d) in W.items():
        k = genre(d)
        if not k or not d.get('name'): continue
        p = ligne(refs)
        if len(p) < 2 or not all(dedans(q) for q in p): continue
        x, z = centre(p)
        lieu(k, d['name'], x, z)
    for rid, (mem, d) in R.items():
        k = genre(d)
        if k not in ('chateau', 'eglise', 'quartier') or not d.get('name'): continue
        pts = [q for (t, r, role) in mem if t == 'way' and r in W for q in ligne(W[r][0])]
        if pts and all(dedans(q) for q in pts):
            x, z = centre(pts); lieu(k, d['name'], x, z)

    # la gare du petit train : celle du centre, même un peu hors du cadre (Gallipoli : 220 m)
    g = [l for l in out['lieux'] if l['k'] == 'gare' and l.get('nom') == GARES[ville]]
    if g:
        g = g[0]
        if not dedans((g['x'], g['z']), 0):
            g['hors_cadre'] = True
            g['note'] = "à %.0f m du bord du cadre : l'extrait s'arrête avant la gare" % max(
                CADRE['x0'] - g['x'], g['x'] - CADRE['x1'], CADRE['z0'] - g['z'], g['z'] - CADRE['z1'])
        out['fer']['gare'] = g
    # des lieux qui sortent du cadre sans être la gare ne restent pas
    out['lieux'] = [l for l in out['lieux'] if l['k'] != 'gare' or l is out['fer']['gare'] or dedans((l['x'], l['z']), 0)]

    # Alberobello : OSM ne nomme pas les deux rioni de trulli ; l'origine EST le Rione Monti
    if ville == 'alberobello':
        lieu('quartier', 'Rione Monti', 0.0, 0.0, propose=True,
             note="pas un nœud OSM : le barycentre de ses 96 trulli (repere_pouilles.py)")

    path = os.path.join(ICI, '%s.json' % ville)
    json.dump(out, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)

    def n(v): return len(v) if isinstance(v, list) else sum(len(x) for x in v.values() if isinstance(x, list))
    c = CADRE
    print('%s.json : %.0f Ko — cadre x %.0f..%.0f z %.0f..%.0f (%.0f × %.0f m)' % (
        ville, os.path.getsize(path) / 1024, c['x0'], c['x1'], c['z0'], c['z1'], c['x1'] - c['x0'], c['z1'] - c['z0']))
    print('  ' + '  '.join('%s %d' % (k, n(out[k])) for k in ('batiments', 'routes', 'chemins', 'ponts', 'enceinte', 'murs', 'falaises', 'lieux')))
    print('  eau %s  cote %s  verdure %s' % ({k: len(v) for k, v in out['eau'].items()}, {k: len(v) for k, v in out['cote'].items()},
                                             {k: len(v) for k, v in out['verdure'].items()}))
    gr = out['fer']['gare']
    print('  fer : %d voies, %d quais, gare %s' % (len(out['fer']['voies']), len(out['fer']['quais']),
          '%s (x %.0f, z %.0f)%s' % (gr['nom'], gr['x'], gr['z'], ' HORS CADRE' if gr.get('hors_cadre') else '') if gr else 'ABSENTE'))
    return out

if __name__ == '__main__':
    villes = [v for v in sys.argv[1:] if not v.startswith('-')] or list(SOURCES)
    for v in villes:
        if v not in SOURCES: sys.exit('villes : ' + ', '.join(SOURCES))
        extraire(v)
    if '--sans-apercu' not in sys.argv:
        subprocess.run([sys.executable, os.path.join(ICI, 'apercu-pouilles.py')], check=False)
