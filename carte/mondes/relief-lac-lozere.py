"""Le relief fin du lieu « le lac de Villefort » (consigne E4, 7 octobre) : découpé dans le cadrage
« lac » déjà récolté (relief-lozere-lac.json, RGE ALTI au pas de 5 m), sur le cadre du lieu et 60 m
tout autour (le débord boisé qu'on ne parcourt pas, comme à Villefort). Rien n'est demandé à l'IGN.

    python3 relief-lac-lozere.py      → relief-lozere-lacvillefort.json
"""
import json, os
ICI = os.path.dirname(os.path.abspath(__file__))
# le cadre de plans-lieux-lozere.py (−420…450, −2250…−1700), plus 60 m
CADRE = dict(x0=-480.0, x1=510.0, z0=-2310.0, z1=-1640.0)
if __name__ == '__main__':
    R = json.load(open(os.path.join(ICI, 'relief-lozere-lac.json')))
    p = R['pas']; i0 = int(round((CADRE['x0'] - R['x0']) / p)); j0 = int(round((CADRE['z0'] - R['z0']) / p))
    nx = int((CADRE['x1'] - CADRE['x0']) / p) + 1; nz = int((CADRE['z1'] - CADRE['z0']) / p) + 1
    assert i0 >= 0 and j0 >= 0 and i0 + nx <= R['nx'] and j0 + nz <= R['nz'], 'le cadre déborde du cadrage « lac »'
    h = [R['h'][(j0 + j) * R['nx'] + i0 + i] for j in range(nz) for i in range(nx)]
    json.dump({'note': "Le lac de Villefort (relief-lac-lozere.py) : découpé dans relief-lozere-lac.json, RGE ALTI au pas de 5 m ; "
                       "altitudes NGF absolues, grille en coordonnées de JEU : h[j*nx+i] en x0+i*pas, z0+j*pas",
               'pas': p, 'x0': R['x0'] + i0 * p, 'z0': R['z0'] + j0 * p, 'nx': nx, 'nz': nz, 'min': min(h), 'max': max(h), 'trous': 0, 'h': h},
              open(os.path.join(ICI, 'relief-lozere-lacvillefort.json'), 'w'))
    print('relief-lozere-lacvillefort.json : %d × %d, de %.0f à %.0f m' % (nx, nz, min(h), max(h)))
