"""Recoud le relief de Villefort : le bourg, le lac et l'horizon en une seule grille.

Le cadrage « lac » (5 m, RGE ALTI) s'arrête à z = -1 627, juste au nord du bourg ; le cadrage
« bourg » (5 m, même ressource) prend le bourg et la gare ; ce qui reste dans aucun des deux
(l'ouest de la gare) vient du relief « monde » à 10 m, interpolé. Le lieu jouable de Villefort
(villefort.js) est le rectangle CADRE ci-dessous : depuis le 5 octobre, le bourg seul, du pont
Saint-Jean au sud du bourg (il tient tout entier dans le cadrage « bourg », au pas de 5 m). La gare,
le lac et le barrage ne sont plus que dans l'horizon (relief « monde »). Le relief d'avant, qui
allait jusqu'au barrage : complet/relief-lozere-villefort.json.

    python3 recoudre-relief-lozere.py      → relief-lozere-villefort.json

Rien n'est demandé à l'IGN ici : il faut d'abord `recolter-relief-lozere.py lac bourg`.
"""
import json, os

ICI = os.path.dirname(os.path.abspath(__file__))
# l'emprise de plans-lieux-lozere.py (1420…1800, −1430…−820), plus 60 m tout autour : un débord
# qu'on ne parcourt pas (lozere.js le bloque et le boise). Sans lui, le relief de l'horizon, maillé
# à 60 m, remontait en marche sombre juste derrière les derniers murs. À l'est et au sud, au-delà du
# cadrage « bourg », le débord vient du relief « monde » (10 m, interpolé) : on n'y marche pas.
CADRE = dict(x0=1360.0, x1=1860.0, z0=-1490.0, z1=-760.0, pas=5.0)

def charge(nom):
    return json.load(open(os.path.join(ICI, 'relief-lozere-%s.json' % nom)))

def lecteur(R, strict=True):
    """L'altitude en (x, z), bilinéaire ; None hors de la grille si strict."""
    def h(x, z):
        fx, fz = (x - R['x0']) / R['pas'], (z - R['z0']) / R['pas']
        if strict and (fx < -0.01 or fz < -0.01 or fx > R['nx'] - 0.99 or fz > R['nz'] - 0.99): return None
        fx = max(0, min(R['nx'] - 1.001, fx)); fz = max(0, min(R['nz'] - 1.001, fz))
        i, j = int(fx), int(fz); u, v = fx - i, fz - j; H, n = R['h'], R['nx']
        return (H[j*n+i]*(1-u) + H[j*n+i+1]*u)*(1-v) + (H[(j+1)*n+i]*(1-u) + H[(j+1)*n+i+1]*u)*v
    return h

if __name__ == '__main__':
    # l'ordre dit la priorité : le bourg, puis le lac, puis le monde à 10 m
    sources = [(n, lecteur(charge(n), n != 'monde')) for n in ('bourg', 'lac', 'monde')]
    p = CADRE['pas']; nx = int((CADRE['x1'] - CADRE['x0']) / p) + 1; nz = int((CADRE['z1'] - CADRE['z0']) / p) + 1
    h, compte = [], {n: 0 for n, _ in sources}
    for j in range(nz):
        for i in range(nx):
            x, z = CADRE['x0'] + i * p, CADRE['z0'] + j * p
            for n, f in sources:
                v = f(x, z)
                if v is not None: h.append(round(v, 2)); compte[n] += 1; break
    json.dump({'note': "Villefort recousu (recoudre-relief-lozere.py) : bourg et lac au pas de 5 m (RGE ALTI), le reste du "
                       "relief « monde » à 10 m ; altitudes NGF absolues, grille en coordonnées de JEU : h[j*nx+i] en x0+i*pas, z0+j*pas",
               'pas': p, 'x0': CADRE['x0'], 'z0': CADRE['z0'], 'nx': nx, 'nz': nz, 'min': min(h), 'max': max(h), 'trous': 0,
               'sources': compte, 'h': h}, open(os.path.join(ICI, 'relief-lozere-villefort.json'), 'w'))
    print('relief-lozere-villefort.json : %d × %d, de %.0f à %.0f m — %s' % (nx, nz, min(h), max(h), compte))
