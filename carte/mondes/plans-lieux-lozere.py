"""Le plan de chaque lieu jouable de la Lozère, découpé dans lozere.json.

Villefort et la Garde-Guérin ne chargent pas les 380 Ko du plan entier : chacun reçoit son
morceau (le cadre du lieu + 400 m, pour l'horizon). Et ses bâtiments passent sous la clé
`maisons` : `lozere.js` les bâtit lui-même (un toit par aile, le plancher au niveau de la rue,
un terre-plein côté aval), `monde.js` n'en voit aucun (`batiments` vide).

    python3 plans-lieux-lozere.py     → lozere-villefort.json, lozere-garde.json
"""
import json, os

ICI = os.path.dirname(os.path.abspath(__file__))
# les cadres des reliefs fins (relief-lozere-villefort.json, relief-lozere-garde.json)
LIEUX = {
    'villefort': dict(x0=640.0, x1=1800.0, z0=-2950.0, z1=-820.0),
    'garde': dict(x0=1528.0, x1=2102.0, z0=-5612.0, z1=-5046.0),
}
MARGE = 400

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

def dans_poly(p, pts):
    x, z = p; d = False; j = len(pts) - 1
    for i in range(len(pts)):
        (xi, zi), (xj, zj) = pts[i], pts[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
        j = i
    return d

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
    L = json.load(open(os.path.join(ICI, 'lozere.json')))
    for nom, c in LIEUX.items():
        P = {k: couper(v, c, MARGE) for k, v in L.items() if k not in ('batiments', 'cadres', 'cadrages', 'note')}
        P['note'] = L['note'] + ' — découpé pour le lieu « %s » (plans-lieux-lozere.py) ; les bâtiments sont sous « maisons ».' % nom
        P['cadre'] = c
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
        json.dump(P, open(f, 'w'), ensure_ascii=False, separators=(',', ':'))
        print('%s : %d maisons, %d routes, %d chemins, %.0f Ko' % (os.path.basename(f), len(P['maisons']), len(P['routes']), len(P['chemins']), os.path.getsize(f) / 1024))
