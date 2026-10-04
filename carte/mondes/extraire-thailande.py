#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les cinq extraits OSM de la Thaïlande  →  thailande.json, UNE baie.

Acte III, la Cloche des Îles. Copie d'extraire-pouilles.py (Sutherland-Hodgman sur les
surfaces, Douglas-Peucker sur le bâti, la côte refermée sur sa gauche), mais les cinq
morceaux — Ko Panyi, Khao Phing Kan, le Wat Tham Suea, Railay, Phi Phi — sont fondus dans
une baie inventée : chacun garde sa forme, déplacé par repere_thailande.py (le « mélange »
qu'Eugène a demandé le 2 octobre). Chaque élément porte `m`, le morceau d'où il vient.

    python3 extraire-thailande.py

Bibliothèque standard seulement.
"""
import xml.etree.ElementTree as ET, json, math, os, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import repere_thailande as RT

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

# ---- LES CŒURS (4 octobre) ----------------------------------------------------------------
# Eugène : « c'est l'espace de balade qui est immense, pas la distance entre les îles ». Railay et
# Phi Phi portaient 18 000 des 21 000 points de chemin du banc pour une histoire qui tient en
# quelques endroits. Chaque île garde un CŒUR où l'on marche, autour de ce qui sert
# (thailande.js : quais, Nok, la porte, le marché, les moines, les câbles), et une GARDE autour :
# ce qui reste de l'île, falaise ou jungle où l'on ne passe pas. Au-delà, la mer. Les îles ne
# bougent pas les unes par rapport aux autres (repere_thailande.py est intact).
#   falaise : Railay, Phi Phi — chemins et bâti coupés au cœur ; recolter-relief-thailande.py
#             dresse une falaise au bord, thailande.js bloque la garde (la même ondulation, BORD)
#   pilotis : Ko Panyi — le village coupé au cœur, rendu à l'eau ; le rocher reste, entier
#   ile     : le grand piton — l'île ramenée à son sommet : ses routes finissent dans la mer
# Khao Phing Kan, déjà petite, ne change pas. Les fichiers d'avant : carte/mondes/complet/.
COEURS = {
    'panyi':  {'mode': 'pilotis', 'coeur': (-240, 170, -140, 200), 'garde': (-260, 190, -420, 215)},
    'suea':   {'mode': 'ile', 'coeur': (860, 1130, 215, 470), 'garde': (780, 1210, 140, 545)},
    'railay': {'mode': 'falaise', 'coeur': (-740, -290, 1480, 1930)},
    # jusqu'à z 2060 : les deux pontons de Ton Sai entiers (coupés à 2010, ils finissaient dans l'eau)
    'phiphi': {'mode': 'falaise', 'coeur': (2120, 2620, 1640, 2060)},
}
BANDE = 120          # la garde des îles « falaise » : le cœur élargi d'autant
# L'escalier des moines (Phi Phi) : le câble du grand piton doit partir PLUS HAUT que le sommet où
# il arrive (~105 m), et aucun chemin du cœur de Ton Sai ne monte au-dessus de 38 m. Il part du
# bout des marches d'OSM, au pied de la colline est, et monte en quatre lacets à ~130 m. Les lacets
# sont à 32 m l'un de l'autre : à 27, le relief (pas de 10 m) mêlait leurs hauteurs — des sauts de 19 m.
ESCALIER = [(2512.0, 1777.0), (2528.0, 1850.0), (2560.0, 1700.0), (2592.0, 1850.0), (2605.0, 1790.0)]

def garde_de(m):
    C = COEURS[m]
    if 'garde' in C: return C['garde']
    x0, x1, z0, z1 = C['coeur']
    return (x0 - BANDE, x1 + BANDE, z0 - BANDE, z1 + BANDE)

def dans_r(q, r): return r[0] <= q[0] <= r[1] and r[2] <= q[1] <= r[3]

def couper_ligne(p, r):
    """Une ligne coupée à un rectangle (Liang-Barsky, segment par segment) : les morceaux dedans,
    chacun avec ses deux bouts marqués « coupé » ou non — un bout coupé est là où une rue
    s'arrête au bord du cœur, et le relief doit y dresser quelque chose."""
    out, cur, coupe0 = [], [], False
    def seg(a, b):
        t0, t1 = 0.0, 1.0
        dx, dz = b[0] - a[0], b[1] - a[1]
        for pp, qq in ((-dx, a[0] - r[0]), (dx, r[1] - a[0]), (-dz, a[1] - r[2]), (dz, r[3] - a[1])):
            if pp == 0:
                if qq < 0: return None
                continue
            t = qq / pp
            if pp < 0: t0 = max(t0, t)
            else: t1 = min(t1, t)
        if t0 > t1: return None
        return t0, t1
    for a, b in zip(p, p[1:]):
        s = seg(a, b)
        if s is None:
            if cur: out.append((cur, coupe0, True)); cur = []
            continue
        t0, t1 = s
        A = (round(a[0] + (b[0] - a[0]) * t0, 1), round(a[1] + (b[1] - a[1]) * t0, 1))
        Bq = (round(a[0] + (b[0] - a[0]) * t1, 1), round(a[1] + (b[1] - a[1]) * t1, 1))
        if not cur: cur, coupe0 = [A], t0 > 0
        cur.append(Bq)
        if t1 < 1: out.append((cur, coupe0, True)); cur = []
    if cur: out.append((cur, coupe0, False))
    return [(q, c0, c1) for q, c0, c1 in out if len(q) >= 2 and sum(math.hypot(v[0] - u[0], v[1] - u[1]) for u, v in zip(q, q[1:])) >= 6]

def couper_surface(p, r):
    global CADRE
    sauve = CADRE
    CADRE = {'x0': r[0] + MARGE, 'x1': r[1] - MARGE, 'z0': r[2] + MARGE, 'z1': r[3] - MARGE}
    q = p[:-1] if p[0] == p[-1] else p
    q = decoupe(list(q)) if not all(dans_r(x, r) for x in q) else list(q)
    CADRE = sauve
    if len(q) < 3: return None
    return q + [q[0]]

def resserrer(o, m):
    """Le morceau m ramené à son cœur (voir COEURS). Rend la liste des bouts coupés."""
    if m not in COEURS: return []
    C = COEURS[m]; coeur, garde = C['coeur'], garde_de(m)
    voie = coeur if C['mode'] != 'ile' else garde      # où les rues s'arrêtent
    bouts = []
    def lignes(liste, r, noter, surf=False):
        res = []
        for e in liste:
            # une surface (une place, un ponton dessiné en polygone) se garde entière ou pas du tout
            if e.get('surface') or (surf and len(e['pts']) > 3 and e['pts'][0] == e['pts'][-1]):
                c = centre(e['pts'])
                if dans_r(c, r): res.append(e)
                continue
            for q, c0, c1 in couper_ligne(e['pts'], r):
                res.append(dict(e, pts=q))
                if noter:
                    if c0: bouts.append([q[0][0], q[0][1], q[0][0] - q[1][0], q[0][1] - q[1][1], m])
                    if c1: bouts.append([q[-1][0], q[-1][1], q[-1][0] - q[-2][0], q[-1][1] - q[-2][1], m])
        return res
    for k in ('routes', 'chemins', 'ponts'): o[k] = lignes(o[k], voie, C['mode'] == 'falaise', k == 'ponts')
    for k in ('murs', 'falaises', 'enceinte'): o[k] = lignes(o[k], garde, False)
    for k in ('cours', 'canaux'): o['eau'][k] = lignes(o['eau'][k], garde, False)
    o['batiments'] = [b for b in o['batiments'] if dans_r(centre(b['pts']), voie)]
    def surfaces(liste, r):
        res = []
        for e in liste:
            s = couper_surface(e['pts'], r)
            if s and aire(s) > 4: res.append(dict(e, pts=s))
        return res
    for k in ('plans', 'recifs'): o['eau'][k] = surfaces(o['eau'][k], garde)
    for k in o['verdure']: o['verdure'][k] = surfaces(o['verdure'][k], garde)
    # Ko Panyi : la terre plate (le village sur pilotis) s'arrête au cœur — le reste rendu à l'eau ;
    # le rocher, lui, est une masse boisée (verdure), il reste entier dans la garde
    o['cote']['iles'] = surfaces(o['cote']['iles'], coeur if C['mode'] == 'pilotis' else garde)
    o['lieux'] = [l for l in o['lieux'] if dans_r((l['x'], l['z']), garde)]
    if m == 'phiphi':
        o['chemins'].append({'pts': [list(q) for q in ESCALIER], 'r': 0, 'k': 'steps', 'nom': "l'escalier des moines", 'moines': True, 'm': 'phiphi'})
        o['lieux'].append({'k': 'belvedere', 'm': 'phiphi', 'x': ESCALIER[-1][0], 'z': ESCALIER[-1][1], 'nom': 'le belvédère des moines'})
    return bouts

CLS_ROUTE = {'primary': 3, 'secondary': 3, 'tertiary': 2, 'tertiary_link': 2, 'residential': 2,
             'living_street': 2, 'unclassified': 2, 'pedestrian': 1, 'service': 1}
CLS_CHEMIN = {'track': 1, 'footway': 0, 'path': 0, 'steps': 0}

def extraire(m):
    global CADRE
    M = RT.MORCEAUX[m]
    def jeu(la, lo): return RT.jeu(m, la, lo)
    def tags(el):
        d = {t.get('k'): t.get('v') for t in el.findall('tag')}
        # les noms OSM sont en thaï : on garde l'anglais quand il existe (Eugène lit l'un, pas l'autre)
        if d.get('name:fr') or d.get('name:en'): d['name'] = d.get('name:fr') or d['name:en']
        return d
    N, W, R, bords = {}, {}, {}, []
    for src in [M['src']]:
        root = ET.parse(os.path.join(ICI, src)).getroot()
        b = root.find('bounds')
        if M.get('coupe'):      # Phi Phi : l'extrait fait 20 km, on n'en garde que l'isthme
            b = {'minlat': M['coupe'][0], 'maxlat': M['coupe'][1], 'minlon': M['coupe'][2], 'maxlon': M['coupe'][3]}
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
    CADRE = {'src': M['src'], 'm': m, 'x0': round(min(b[0] for b in bords), 1),
             'x1': round(max(b[1] for b in bords), 1), 'z0': round(min(b[2] for b in bords), 1),
             'z1': round(max(b[3] for b in bords), 1)}

    def ligne(refs):
        out = []
        for i in refs:
            if i in N:
                x, z = jeu(N[i][0], N[i][1]); out.append((round(x, 1), round(z, 1)))
        return out

    out = {
        'cadre': CADRE,
        'lieux': [],
        'batiments': [],
        'routes': [], 'chemins': [], 'ponts': [],
        'enceinte': [], 'murs': [], 'falaises': [],
        'eau': {'plans': [], 'cours': [], 'canaux': [], 'recifs': []},
        'cote': {'terre': [], 'iles': []},
        'verdure': {'bois': [], 'landes': [], 'pres': [], 'champs': [], 'rochers': [], 'jardins': [], 'plages': [], 'mangroves': []},
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
        if d.get('natural') == 'reef' and ferme(p) or False:
            s = surface(p, 0.5)
            if s: out['eau']['recifs'].append({'pts': s})
            continue
        # La Gravina de Matera est un « drain » pour OSM : c'est le torrent du canyon, on le garde comme tel
        if d.get('waterway') in ('river', 'stream') or (d.get('waterway') == 'drain' and 'Torrente' in (nom or '')):
            pose(out['eau']['cours'], refs, 1.5, k='torrent' if 'Torrente' in (nom or '') else 'ruisseau', nom=nom, **flags(d)); continue
        if d.get('waterway') in ('canal', 'ditch', 'drain'):
            pose(out['eau']['canaux'], refs, 1.0, k=d['waterway'], **flags(d)); continue
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
               'jardins' if le in ('garden', 'park') or lu == 'cemetery' else
               'plages' if nat in ('beach', 'sand') else
               'mangroves' if nat == 'wetland' else None)
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
            elif d.get('natural') in ('beach', 'wood', 'bare_rock', 'wetland'):
                s = surface(p, 1.0)
                k = {'beach': 'plages', 'wood': 'bois', 'bare_rock': 'rochers', 'wetland': 'mangroves'}[d['natural']]
                if s: out['verdure'][k].append({'pts': s, 'nom': d.get('name:en') or d.get('name')})
            elif d.get('place') in ('islet', 'island'):
                s = surface(p, 0.5)
                if s: out['cote']['iles'].append({'pts': s, 'nom': d.get('name:en') or d.get('name')})
            elif d.get('highway') in CLS_ROUTE or d.get('highway') in CLS_CHEMIN:
                s = surface(p, 0.5)
                if s: out['routes'].append({'pts': s, 'r': 1, 'surface': True})

    # ---- les lieux : églises, places, portes, châteaux, belvédères, gare, port ----
    vus = set()
    def lieu(k, nom, x, z, **extra):
        if not dedans((x, z), 0): return None
        if nom and (k, nom) in vus: return None
        vus.add((k, nom))
        e = {'k': k, 'm': m, 'x': round(x, 1), 'z': round(z, 1)}
        if nom: e['nom'] = nom
        e.update({a: v for a, v in extra.items() if v})
        out['lieux'].append(e)
        return e

    def genre(d):
        nom = d.get('name') or ''
        if d.get('amenity') == 'ferry_terminal' or d.get('man_made') == 'pier' and nom: return 'embarcadere'
        if d.get('amenity') == 'place_of_worship': return 'temple' if d.get('religion') == 'buddhist' or nom.startswith('Wat') else 'culte'
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
        if d.get('natural') == 'beach' and nom: return 'plage'
        if d.get('man_made') == 'tower' or d.get('building') == 'stupa': return 'chedi'
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
        if k not in ('temple', 'culte', 'quartier', 'plage', 'ile') or not d.get('name'): continue
        pts = [q for (t, r, role) in mem if t == 'way' and r in W for q in ligne(W[r][0])]
        if pts and all(dedans(q) for q in pts):
            x, z = centre(pts); lieu(k, d['name'], x, z)

    for cle in ('batiments', 'routes', 'chemins', 'ponts', 'murs', 'falaises'):
        for e in out[cle]: e['m'] = m
    def n(v): return len(v) if isinstance(v, list) else sum(len(x) for x in v.values() if isinstance(x, list))
    c = CADRE
    print('%s : cadre x %.0f..%.0f z %.0f..%.0f (%.0f × %.0f m)' % (m, c['x0'], c['x1'], c['z0'], c['z1'], c['x1'] - c['x0'], c['z1'] - c['z0']))
    print('  ' + '  '.join('%s %d' % (k, n(out[k])) for k in ('batiments', 'routes', 'chemins', 'ponts', 'murs', 'falaises', 'lieux')))
    print('  eau %s  cote %s  verdure %s' % ({k: len(v) for k, v in out['eau'].items()}, {k: len(v) for k, v in out['cote'].items()},
                                             {k: len(v) for k, v in out['verdure'].items()}))
    return out

if __name__ == '__main__':
    # la baie : les morceaux mis bout à bout, liste par liste ; le cadre est leur enveloppe
    baie = None
    bouts = []
    for m in RT.NOMS:
        o = extraire(m)
        n0 = (len(o['batiments']), len(o['chemins']) + len(o['routes']) + len(o['ponts']))
        bouts += resserrer(o, m)
        if m in COEURS:
            print('  resserré au cœur %s : bâtiments %d → %d, voies %d → %d, %d bouts coupés' % (
                COEURS[m]['coeur'], n0[0], len(o['batiments']), n0[1], len(o['chemins']) + len(o['routes']) + len(o['ponts']), sum(1 for b in bouts if b[4] == m)))
        if baie is None:
            baie = o; baie['morceaux'] = {}
        else:
            for k, v in o.items():
                if isinstance(v, list): baie[k] += v
                elif isinstance(v, dict) and k != 'cadre':
                    for kk, vv in v.items(): baie[k][kk] += vv
        # le morceau, pour le relief, n'est plus l'extrait OSM mais sa garde : l'île s'y arrête
        c = o['cadre']; M = dict(c, lieu=RT.MORCEAUX[m]['lieu'], dx=RT.MORCEAUX[m]['dx'], dz=RT.MORCEAUX[m]['dz'],
                                 extrait=[c['x0'], c['x1'], c['z0'], c['z1']])
        if m in COEURS:
            g = garde_de(m); M.update(x0=g[0], x1=g[1], z0=g[2], z1=g[3], coeur=list(COEURS[m]['coeur']), mode=COEURS[m]['mode'])
        baie['morceaux'][m] = M
    baie['bouts'] = bouts
    cs = baie['morceaux'].values()
    baie['cadre'] = {'x0': min(c['x0'] for c in cs) - 300, 'x1': max(c['x1'] for c in cs) + 300,
                     'z0': min(c['z0'] for c in cs) - 300, 'z1': max(c['z1'] for c in cs) + 300}
    baie = {'note': "La baie de la Cloche des Îles (acte III) — coordonnées de JEU : 1 unité = 1 m, x = est, z = sud, "
                    "pas de pivot. Cinq extraits OSM DÉPLACÉS dans une baie inventée (repere_thailande.py) : `m` dit "
                    "le morceau d'où vient chaque élément. Source : OpenStreetMap (ODbL, © OpenStreetMap et contributeurs).", **baie}
    # la terre ferme refermée sur sa gauche (extraire-pouilles.py) se découpe mal ici : les
    # côtes de Railay et de Phi Phi arrivent en dizaines de brins. C'est le RELIEF qui dit où
    # est la terre (recolter-relief-thailande.py) ; on ne garde que les îles fermées.
    baie['cote'].pop('terre', None)
    path = os.path.join(ICI, 'thailande.json')
    json.dump(baie, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
    c = baie['cadre']
    print('thailande.json : %.0f Ko — baie x %.0f..%.0f z %.0f..%.0f' % (os.path.getsize(path) / 1024, c['x0'], c['x1'], c['z0'], c['z1']))
