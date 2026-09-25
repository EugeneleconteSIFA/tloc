# -*- coding: utf-8 -*-
"""De lille.json (coordonnées géographiques projetées) vers citadelle.json
(coordonnées du JEU) : origine au centre de la citadelle, et carte pivotée pour
amener la Porte Royale plein sud (+z), là où le jeu a toujours placé son entrée.
La forme n'est pas touchée — seulement le repère."""
import json, math

SRC = '/mnt/user-data/outputs/carte/lille.json'
OUT = '/mnt/user-data/outputs/carte/citadelle.json'
d = json.load(open(SRC))

def cen(p):
    q = p[:-1] if len(p) > 2 and p[0] == p[-1] else p
    return (sum(a[0] for a in q) / len(q), sum(a[1] for a in q) / len(q))

ENC = d['fortif']['citadelle'][0]['pts']
CX, CZ = cen(ENC)

# La Demi-lune Royale couvre la Porte Royale : sa direction donne celle de l'entrée.
roy = max((g for g in d['fortif']['demilunes'] if g.get('nom') == 'Demi-lune Royale'), key=lambda g: len(g['pts']))
rc = cen(roy['pts'])
az = math.degrees(math.atan2(rc[0] - CX, -(rc[1] - CZ))) % 360
DELTA = math.radians(180.0 - az)                      # amener cet azimut sur le sud
CO, SI = math.cos(DELTA), math.sin(DELTA)

def T(p):
    x, z = p[0] - CX, p[1] - CZ
    return [round(x * CO - z * SI, 2), round(x * SI + z * CO, 2)]

def Tg(g):
    e = {'pts': [T(p) for p in g['pts']]}
    if 'nom' in g: e['nom'] = g['nom']
    for k in ('k', 'r', 'l'):
        if k in g: e[k] = g[k]
    return e

def aire(p):
    s = 0.0
    for i in range(len(p) - 1):
        s += p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1]
    return s / 2

def ferme(p):
    p = list(p)
    if p[0] != p[-1]: p.append(p[0])
    return p

def sens_direct(p):                                    # orientation constante : normale sortante fiable
    p = ferme(p)
    return p if aire(p) > 0 else p[::-1]

def garder_plus_gros(liste):
    """OSM étiquette parfois un simple tronçon de mur avec le nom de l'ouvrage :
    on ne garde, par nom, que le tracé qui a le plus de points."""
    best = {}
    for g in liste:
        n = g.get('nom', '')
        if n not in best or len(g['pts']) > len(best[n]['pts']): best[n] = g
    return [best[k] for k in sorted(best)]

enceinte = sens_direct([T(p) for p in ENC])

def ouvrage(liste):
    out = []
    for g in garder_plus_gros(liste):
        if len(g['pts']) < 4: continue
        p = sens_direct([T(q) for q in g['pts']])
        c = cen(p)
        out.append({'nom': g.get('nom', ''), 'pts': p, 'c': [round(c[0], 1), round(c[1], 1)]})
    return out

bastions = ouvrage(d['fortif']['bastions'])
# saillant : le sommet du bastion le plus éloigné du centre ; normale sortante = sa direction
for b in bastions:
    s = max(b['pts'], key=lambda q: q[0] * q[0] + q[1] * q[1])
    L = math.hypot(*s) or 1
    b['saillant'] = [round(s[0], 1), round(s[1], 1)]
    b['n'] = [round(s[0] / L, 4), round(s[1] / L, 4)]


# ---------------------------------------------------------------------------
#  Corps de place : le tracé bastionné, reconstruit
# ---------------------------------------------------------------------------
# Le way « Citadelle de Lille » d'OSM est la limite EXTÉRIEURE de l'ouvrage
# (chemin couvert et glacis compris), pas la ligne d'escarpe. Le rempart, lui,
# se déduit des cinq bastions : pour chacun on isole la partie qui regarde
# dehors — faces et flancs, du premier au second épaulement, en passant par le
# saillant — puis on relie chaque épaulement au suivant par une courtine droite.
# C'est exactement la façon dont un tracé à la Vauban se dessine.
def face_exterieure(poly):
    p = poly[:-1] if poly[0] == poly[-1] else list(poly)
    n = len(p)
    rayon = [math.hypot(q[0], q[1]) for q in p]
    # la gorge du bastion est sa corde intérieure : ses deux extrémités sont les
    # deux sommets les plus proches du centre de la place
    ordre = sorted(range(n), key=lambda i: rayon[i])
    a, b = sorted(ordre[:2])
    arc1 = p[a:b + 1]
    arc2 = p[b:] + p[:a + 1]
    # on garde l'arc qui contient le saillant
    s = max(range(n), key=lambda i: rayon[i])
    return arc1 if a <= s <= b else arc2

def angle(q): return math.atan2(q[1], q[0])

def corps_de_place(bastions_):
    arcs = []
    for b in bastions_:
        arc = face_exterieure(b['pts'])
        if angle(arc[-1]) - angle(arc[0]) < 0:          # toujours dans le sens direct
            arc = arc[::-1]
        arcs.append((angle(b['saillant']), arc, b['nom']))
    arcs.sort(key=lambda t: t[0])
    trace, courtines = [], []
    for i, (_, arc, nom) in enumerate(arcs):
        trace.extend(arc)
        suiv = arcs[(i + 1) % len(arcs)][1]
        courtines.append({'a': [round(v, 1) for v in arc[-1]], 'b': [round(v, 1) for v in suiv[0]]})
    trace = ferme([[round(q[0], 2), round(q[1], 2)] for q in trace])
    return (trace if aire(trace) > 0 else trace[::-1]), courtines

corps, courtines = corps_de_place(bastions)

demilunes = ouvrage(d['fortif']['demilunes'])
contregardes = ouvrage(d['fortif']['contregardes'])
ouvrages = ouvrage(d['fortif']['ouvrages'])

# ---- la porte : sur la courtine la plus proche de la Demi-lune Royale ----
rcT = T(rc)
def dist_seg(p, a, b):
    vx, vy = b[0] - a[0], b[1] - a[1]
    L2 = vx * vx + vy * vy or 1
    t = max(0, min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2))
    return math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy)), (a[0] + t * vx, a[1] + t * vy)
_, porte = min((dist_seg(rcT, c['a'], c['b']) for c in courtines), key=lambda t: t[0])
porte = [porte[0], porte[1]]
L = math.hypot(*porte) or 1

# ---- fossés : les plans d'eau qui entourent la place ----
fosses = []
for g in d['eau']['plans']:
    c = cen(g['pts'])
    if math.hypot(c[0] - CX, c[1] - CZ) < 620 and len(g['pts']) > 6:
        fosses.append({'pts': sens_direct([T(p) for p in g['pts']])})

# ---- bâti : à l'intérieur de l'enceinte on en fait les casernes ----
def dedans(pt, poly):
    x, z = pt; c = False; n = len(poly) - 1
    for i in range(n):
        a, b = poly[i], poly[i + 1]
        if (a[1] > z) != (b[1] > z) and x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]: c = not c
    return c

casernes, autres = [], []
for b in d['batiments']:
    p = [T(q) for q in b]
    (casernes if dedans(cen(p), enceinte) else autres).append([[round(q[0], 1), round(q[1], 1)] for q in p])

out = {
    'note': "coordonnées du jeu : origine au centre de la citadelle, Porte Royale au sud (+z), 1 unité = 1 m",
    'pivot': round(math.degrees(DELTA), 2),
    'enceinte': enceinte,
    'corps': corps, 'courtines': courtines,
    'porte': {'p': [round(porte[0], 1), round(porte[1], 1)], 'n': [round(porte[0] / L, 4), round(porte[1] / L, 4)]},
    'bastions': bastions, 'demilunes': demilunes, 'contregardes': contregardes, 'ouvrages': ouvrages,
    'fosses': fosses, 'casernes': casernes,
    'eau': {'plans': [Tg(g) for g in d['eau']['plans']], 'canaux': [Tg(g) for g in d['eau']['canaux']]},
    'verdure': {k: [Tg(g) for g in v] for k, v in d['verdure'].items()},
    'routes': [Tg(g) for g in d['routes']], 'chemins': [Tg(g) for g in d['chemins']],
    'ponts': [Tg(g) for g in d['ponts']], 'talus': [Tg(g) for g in d['talus']],
    'murs': [Tg(g) for g in d['fortif']['murs']],
    'batiments': autres,
}
json.dump(out, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)

import os
print('pivot %.2f°  (Porte Royale amenée de %.1f° d\'azimut au sud)' % (math.degrees(DELTA), az))
print('porte  x=%.1f z=%.1f' % (porte[0], porte[1]))
xs = [q[0] for q in enceinte]; zs = [q[1] for q in enceinte]
print('enceinte (limite extérieure) %d pts, %.0f x %.0f m, %.1f ha' % (len(enceinte) - 1, max(xs) - min(xs), max(zs) - min(zs), abs(aire(enceinte)) / 10000))
cxs = [q[0] for q in corps]; czs = [q[1] for q in corps]
print('corps de place  %d pts, %.0f x %.0f m, %.1f ha, %d courtines' % (len(corps) - 1, max(cxs) - min(cxs), max(czs) - min(czs), abs(aire(corps)) / 10000, len(courtines)))
for c in courtines: print('   courtine %7.1f m' % math.hypot(c['b'][0]-c['a'][0], c['b'][1]-c['a'][1]))
for b in bastions: print('  %-22s saillant (%7.1f,%7.1f)' % (b['nom'], *b['saillant']))
print('demi-lunes %d, contregardes %d, ouvrages %d, fossés %d, casernes %d, bâti hors les murs %d'
      % (len(demilunes), len(contregardes), len(ouvrages), len(fosses), len(casernes), len(autres)))
print('taille %.0f Ko' % (os.path.getsize(OUT) / 1024))
