"""Le plan de chaque lieu jouable de la Lozère, découpé dans lozere.json.

Villefort et la Garde-Guérin ne chargent pas les 380 Ko du plan entier : chacun reçoit son
morceau (le cadre du lieu et une marge autour, MARGES). Et ses bâtiments passent sous la clé
`maisons` : `lozere.js` les bâtit lui-même (un toit par aile, le plancher au niveau de la rue,
un terre-plein côté aval), `monde.js` n'en voit aucun (`batiments` vide).

    python3 plans-lieux-lozere.py     → lozere-villefort.json, lozere-garde.json, lozere-lac.json
    python3 plans-lieux-lozere.py lac → le seul lieu nommé (sans récrire les autres)
"""
import json, os, sys

ICI = os.path.dirname(os.path.abspath(__file__))
# les cadres des reliefs fins (relief-lozere-villefort.json, relief-lozere-garde.json).
# Villefort resserré le 5 octobre (PLAN-2026-10-04-CARTES.md, consigne 5, emprise « A » validée
# par Eugène) : le bourg seul, du pont Saint-Jean au sud du bourg, 370 × 600 m jouables (monde.js
# rentre de 8 m) — avant, 1 160 × 2 130 m jusqu'au barrage. La gare et le lac restent au loin.
# Le plan d'avant : complet/lozere-villefort.json.
LIEUX = {
    'villefort': dict(x0=1420.0, x1=1800.0, z0=-1430.0, z1=-820.0),
    'garde': dict(x0=1528.0, x1=2102.0, z0=-5612.0, z1=-5046.0),
    # le lac de Villefort (consigne E4, Eugène, 7 octobre) : le bras de l'Altier, le viaduc de l'Altier,
    # la via ferrata du lac — 870 × 550 m, entre Villefort et Castanet (relief : relief-lac-lozere.py)
    'lac': dict(x0=-420.0, x1=450.0, z0=-2250.0, z1=-1700.0),
}
# ce qu'on garde des rues et des eaux autour du cadre : 400 m pour l'horizon de la Garde-Guérin ;
# 60 m pour Villefort, dont la minicarte ne doit plus tracer des rues qu'on ne parcourt pas
MARGES = {'villefort': 60, 'garde': 400, 'lac': 60}

def dans(c, pts, m):
    return any(c['x0'] - m < x < c['x1'] + m and c['z0'] - m < z < c['z1'] + m for x, z in pts)

def couper(v, c, m):
    """Garde récursivement les objets à `pts` qui touchent le cadre."""
    if isinstance(v, list):
        if v and isinstance(v[0], dict) and 'pts' in v[0]: return [e for e in v if dans(c, e['pts'], m)]
        if v and isinstance(v[0], dict) and 'x' in v[0]: return [e for e in v if c['x0'] - m < e['x'] < c['x1'] + m and c['z0'] - m < e['z'] < c['z1'] + m]
        return v
    if isinstance(v, dict): return {k: couper(w, c, m) for k, w in v.items()}
    return v

# Villefort resserré : ses LIGNES (rues, chemins, Régordane, rivières, voies, murets) sont coupées au
# bord de l'emprise. monde.js et lozere.js posent un ruban sur hauteur(), qui est bornée au relief
# fin : un bout de rue qui dépasse resterait à plat, en l'air ou sous le relief de l'horizon.
COUPER = {'villefort': ('routes', 'chemins', 'regordane', 'eau/cours', 'eau/canaux', 'fer/voies', 'murs'),
          'lac': ('routes', 'chemins', 'regordane', 'eau/cours', 'eau/canaux', 'fer/voies', 'murs')}

def segment_dans(a, b, r):
    """Liang–Barsky : la part du segment ab dans le rectangle r, en (t0, t1), ou None."""
    t0, t1 = 0.0, 1.0; dx, dz = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] - r['x0']), (dx, r['x1'] - a[0]), (-dz, a[1] - r['z0']), (dz, r['z1'] - a[1])):
        if p == 0:
            if q < 0: return None
            continue
        t = q / p
        if p < 0: t0 = max(t0, t)
        else: t1 = min(t1, t)
        if t0 > t1: return None
    return t0, t1

def decouper(pts, r):
    """Les morceaux d'une ligne dans le rectangle r (une ligne qui sort et revient en fait deux)."""
    out, cur = [], []
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]; s = segment_dans(a, b, r)
        if s is None:
            if len(cur) >= 2: out.append(cur)
            cur = []; continue
        p0 = [round(a[0] + (b[0] - a[0]) * s[0], 1), round(a[1] + (b[1] - a[1]) * s[0], 1)]
        p1 = [round(a[0] + (b[0] - a[0]) * s[1], 1), round(a[1] + (b[1] - a[1]) * s[1], 1)]
        if not cur: cur = [p0]
        elif cur[-1] != p0:
            if len(cur) >= 2: out.append(cur)
            cur = [p0]
        cur.append(p1)
        if s[1] < 1:
            if len(cur) >= 2: out.append(cur)
            cur = []
    if len(cur) >= 2: out.append(cur)
    return [m for m in out if sum(((m[i+1][0]-m[i][0])**2 + (m[i+1][1]-m[i][1])**2) ** 0.5 for i in range(len(m) - 1)) > 0.5]

def dans_poly(p, pts):
    x, z = p; d = False; j = len(pts) - 1
    for i in range(len(pts)):
        (xi, zi), (xj, zj) = pts[i], pts[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
        j = i
    return d

def rogner(poly, r):
    """Le polygone coupé au rectangle r (Sutherland–Hodgman) : le lac de Villefort fait 3 km, le lieu du
    lac n'en montre qu'un bras ; monde.js calcule la grille de son eau profonde sur l'emprise du contour
    entier (787 × 684 cases, 8 s de chargement), on ne lui donne que ce qui est dans le lieu."""
    def clip(pts, axe, val, garde):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]; ia, ib = garde(a[axe]), garde(b[axe])
            if ia != ib:
                t = (val - a[axe]) / (b[axe] - a[axe]); q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; q[axe] = val; out.append([round(q[0], 1), round(q[1], 1)])
            if ib: out.append(b)
        return out
    pts = poly
    for axe, val, garde in ((0, r['x0'], lambda v: v >= r['x0']), (0, r['x1'], lambda v: v <= r['x1']), (1, r['z0'], lambda v: v >= r['z0']), (1, r['z1'], lambda v: v <= r['z1'])):
        if len(pts) < 3: return []
        pts = clip(pts, axe, val, garde)
    # monde.js pose l'eau au 30e centile des hauteurs du CONTOUR : les points de la coupe, sur le bord du
    # cadre, tombent au-dessus de l'eau, où le relief IGN est bien plus bas que la rive (6 m au lieu de
    # 30) ; on resserre la vraie rive (un point tous les 2 m) pour qu'elle l'emporte
    bord = lambda q: abs(q[0] - r['x0']) < 0.05 or abs(q[0] - r['x1']) < 0.05 or abs(q[1] - r['z0']) < 0.05 or abs(q[1] - r['z1']) < 0.05
    out = []
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]; out.append(a)
        if bord(a) and bord(b): continue
        L = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        for k in range(1, int(L / 2)): t = k * 2 / L; out.append([round(a[0] + (b[0] - a[0]) * t, 1), round(a[1] + (b[1] - a[1]) * t, 1)])
    return out

def recouper(pts, poly):
    """Raccourcit la ligne par sa fin jusqu'à 60 cm avant d'entrer dans le polygone."""
    dens = []
    for k in range(len(pts) - 1):
        (ax, az), (bx, bz) = pts[k], pts[k + 1]; n = max(1, int(((bx - ax) ** 2 + (bz - az) ** 2) ** 0.5 / 0.2))
        dens += [[ax + (bx - ax) * t / n, az + (bz - az) * t / n] for t in range(n)]
    dens.append(pts[-1])
    k = next(i for i, p in enumerate(dens) if dans_poly(p, poly))
    k = max(1, k - 3)                     # trois pas de 20 cm en arrière : 60 cm devant le mur
    out = []
    for p in pts:
        if dans_poly(p, poly): break
        out.append(p)
    out.append(dens[k])
    return out if len(out) >= 2 else pts[:1] + [dens[k]]

if __name__ == '__main__':
    # UTF-8 dit tout haut : sous Windows, open() lit et écrit en cp1252 et abîmait les accents
    L = json.load(open(os.path.join(ICI, 'lozere.json'), encoding='utf-8'))
    for nom, c in LIEUX.items():
        if sys.argv[1:] and nom not in sys.argv[1:]: continue
        P = {k: couper(v, c, MARGES[nom]) for k, v in L.items() if k not in ('batiments', 'cadres', 'cadrages', 'note')}
        P['note'] = L['note'] + ' — découpé pour le lieu « %s » (plans-lieux-lozere.py) ; les bâtiments sont sous « maisons ».' % nom
        P['cadre'] = c
        # à l'ouest et au nord, 5 m dans l'emprise : 3 m derrière le mur qui ferme la rue (lozere.js,
        # lisiere) et rien au-delà, dans le débord boisé ; à l'est et au sud, au bord du relief fin
        r = dict(x0=c['x0'] + 5, x1=c['x1'] - 6, z0=c['z0'] + 5, z1=c['z1'] - 6)
        for chemin in COUPER.get(nom, ()):
            *haut, cle = chemin.split('/'); d = P
            for h in haut: d = d[h]
            d[cle] = [dict(e, pts=m) for e in d[cle] for m in decouper(e['pts'], r)]
        if nom == 'lac':                  # le lac entier, rogné au lieu et à sa marge
            m = MARGES[nom]; rr = dict(x0=c['x0'] - m, x1=c['x1'] + m, z0=c['z0'] - m, z1=c['z1'] + m)
            P['eau']['plans'] = [dict(e, pts=q) for e in P['eau']['plans'] for q in [rogner(e['pts'], rr)] if len(q) >= 3]
        P['maisons'] = [b for b in L['batiments'] if dans(c, b['pts'], 0)]
        P['batiments'] = []
        # un sentier qui finit DANS un bâtiment (l'entrée de la tour de la Garde-Guérin) s'arrête
        # 60 cm devant son mur : la porte n'est pas dessinée, la rue ne doit pas buter dedans
        for cle in ('routes', 'chemins'):
            for ligne in P[cle]:
                for bout in (0, -1):
                    for b in P['maisons']:
                        if dans_poly(ligne['pts'][bout], b['pts']) and len(ligne['pts']) >= 2:
                            ligne['pts'] = recouper(ligne['pts'] if bout == -1 else ligne['pts'][::-1], b['pts'])
                            if bout == 0: ligne['pts'] = ligne['pts'][::-1]
                            break
        f = os.path.join(ICI, 'lozere-%s.json' % nom)
        json.dump(P, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print('%s : %d maisons, %d routes, %d chemins, %.0f Ko' % (os.path.basename(f), len(P['maisons']), len(P['routes']), len(P['chemins']), os.path.getsize(f) / 1024))
