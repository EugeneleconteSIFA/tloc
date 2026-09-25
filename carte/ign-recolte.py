#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Récolte les données IGN de la Géoplateforme sur l'emprise du jeu.

À LANCER DANS TON PROPRE TERMINAL, pas depuis Claude : les machines de Claude
n'ont pas le droit de sortir vers data.geopf.fr, la tienne si.

    cd ~/Documents/GitHub/the_legend_of_camille/carte
    python3 ign-recolte.py

Ne dépend que de la bibliothèque standard de Python 3 (rien à installer).
Le script est REPRENABLE : s'il s'interrompt, relance-le, il repart où il en était.

Il écrit, à côté de lui :
    altitudes.json          le modèle de terrain, au pas de 5 m
    ign-haies.geojson       le référentiel des haies
    ign-hydrographie.geojson
    ign-foret.geojson       l'inventaire forestier
"""
import json, math, os, shutil, ssl, subprocess, sys, time, urllib.parse, urllib.request

# Emprise : exactement celle de l'extrait OSM qui sert déjà de carte au jeu
# (cf. carte/README.md). Tout ce qui est récolté ici se superpose donc au relevé.
LAT0, LAT1 = 50.63634, 50.64622
LON0, LON1 = 3.03506, 3.05828

PAS_M = 5.0                      # pas de la grille d'altitude, en mètres
LOTS  = 200                      # points par requête (limite de l'API)
ICI   = os.path.dirname(os.path.abspath(__file__))
UA    = 'the-legend-of-camille/1.0 (projet personnel)'


def dit(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------------
#  Transport
# ---------------------------------------------------------------------
# Sur un poste derrière un proxy qui ré-signe le TLS (« self signed certificate
# in certificate chain »), urllib échoue là où Safari et curl passent : le Python
# de python.org embarque son propre magasin de certificats et ignore le trousseau
# du système, qui est le seul à connaître le certificat du proxy.
# On choisit donc le transport UNE FOIS, en le testant, et on prend le premier
# qui répond vraiment.

CA_PERSO = None        # --ca /chemin/vers/bundle.pem
SANS_VERIF = False     # --sans-verification : dernier recours, cf. --aide
_TRANSPORT = None


def _ctx():
    if SANS_VERIF:
        c = ssl.create_default_context()
        c.check_hostname = False
        c.verify_mode = ssl.CERT_NONE
        return c
    if CA_PERSO:
        return ssl.create_default_context(cafile=CA_PERSO)
    try:                       # magasin du système (macOS : le trousseau)
        import truststore
        return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    except Exception:
        return None            # contexte par défaut


def _urllib(url, timeout):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    c = _ctx()
    with urllib.request.urlopen(req, timeout=timeout, context=c) if c \
            else urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _curl(url, timeout):
    cmd = ['curl', '-sS', '--fail-with-body', '--max-time', str(timeout),
           '-A', UA, '-H', 'Accept: */*']
    if CA_PERSO:
        cmd += ['--cacert', CA_PERSO]
    if SANS_VERIF:
        cmd += ['-k']
    p = subprocess.run(cmd + [url], capture_output=True)
    if p.returncode != 0:
        raise OSError('curl %d : %s' % (p.returncode, p.stderr.decode('utf-8', 'replace')[:200]))
    return p.stdout


def _choisir_transport():
    """Un vrai appel d'essai : on ne se fie pas à ce qui est installé, mais à ce qui répond."""
    essai = ('https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?'
             'lon=3.0417&lat=50.6431&resource=ign_rge_alti_wld&zonly=true&indent=false')
    voies = []
    if shutil.which('curl'):
        voies.append(('curl (trousseau du système)', _curl))
    voies.append(('python (magasin intégré)', _urllib))
    for nom, fn in voies:
        try:
            d = json.loads(fn(essai, 20))
            if d.get('elevations') or d.get('altitudes'):
                dit('Transport : %s' % nom)
                return fn
        except Exception as e:
            dit('Transport %s : %s' % (nom, str(e).strip()[:120]))
    dit('')
    dit("Aucun transport ne joint data.geopf.fr. Ta machine est derrière un proxy qui")
    dit("ré-signe le TLS. Trois sorties, de la meilleure à la moins bonne :")
    dit("  1)  python3 -m pip install truststore      (Python utilise alors le trousseau macOS)")
    dit("  2)  exporte le certificat du proxy depuis Trousseau d'accès en .pem, puis")
    dit("      python3 ign-recolte.py --ca /chemin/vers/proxy.pem")
    dit("  3)  python3 ign-recolte.py --sans-verification")
    dit("      Ça désactive la vérification du certificat pour CE script seulement.")
    dit("      L'API est publique et en lecture seule, donc le risque se limite à")
    dit("      récupérer des altitudes falsifiées — mais c'est un vrai renoncement,")
    dit("      à ne prendre que si les deux premières ne marchent pas.")
    sys.exit(1)


def get(url, essais=4, timeout=60):
    global _TRANSPORT
    if _TRANSPORT is None:
        _TRANSPORT = _choisir_transport()
    for k in range(essais):
        try:
            return _TRANSPORT(url, timeout)
        except Exception as e:
            if k == essais - 1:
                raise
            dit('    ... %s — nouvel essai dans %d s' % (type(e).__name__, 2 ** k))
            time.sleep(2 ** k)


# =====================================================================
#  1. le modèle de terrain
# =====================================================================
def metres_par_degre(lat):
    """Combien de mètres fait un degré, ici. Suffisant sur 2 km."""
    return 111320.0 * math.cos(math.radians(lat)), 110540.0


def recolter_altitudes():
    sortie = os.path.join(ICI, 'altitudes.json')
    if os.path.exists(sortie):
        dit('altitudes.json est déjà là — je le laisse. Supprime-le pour refaire.')
        return
    mlon, mlat = metres_par_degre((LAT0 + LAT1) / 2)
    larg = (LON1 - LON0) * mlon
    haut = (LAT1 - LAT0) * mlat
    nx = int(larg / PAS_M) + 1
    nz = int(haut / PAS_M) + 1
    total = nx * nz
    dit('MNT : %d × %d points au pas de %g m  (%.0f × %.0f m, %d points)'
        % (nx, nz, PAS_M, larg, haut, total))
    dit('     soit %d requêtes. Compte quelques minutes.' % ((total + LOTS - 1) // LOTS))

    part = sortie + '.part'
    z = []
    if os.path.exists(part):
        with open(part) as f:
            z = json.load(f)
        dit('     reprise : %d points déjà récoltés' % len(z))

    t0 = time.time()
    while len(z) < total:
        i0 = len(z)
        pts = []
        for i in range(i0, min(i0 + LOTS, total)):
            # i parcourt la grille ligne par ligne, du NORD au SUD
            # (même sens que l'axe z du jeu, qui pointe vers le sud)
            ix, iz = i % nx, i // nx
            pts.append((LON0 + ix * PAS_M / mlon, LAT1 - iz * PAS_M / mlat))
        url = ('https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?'
               + urllib.parse.urlencode({
                   'lon': '|'.join('%.7f' % p[0] for p in pts),
                   'lat': '|'.join('%.7f' % p[1] for p in pts),
                   'resource': 'ign_rge_alti_wld',
                   'delimiter': '|',
                   'zonly': 'true',
                   'indent': 'false',
               }))
        d = json.loads(get(url))
        lot = d.get('elevations') or d.get('altitudes') or []
        if isinstance(lot, list) and lot and isinstance(lot[0], dict):
            lot = [e.get('z', e.get('altitude', -99999)) for e in lot]
        if len(lot) != len(pts):
            dit('!! l’API a renvoyé %d altitudes pour %d points. Réponse brute :'
                % (len(lot), len(pts)))
            dit(json.dumps(d)[:600])
            sys.exit(1)
        z.extend(round(float(v), 2) for v in lot)
        with open(part, 'w') as f:
            json.dump(z, f)
        fait = len(z)
        reste = (time.time() - t0) / max(1, fait - i0) * (total - fait)
        dit('     %6d / %d  (%4.1f %%)  reste ~%d s' % (fait, total, 100 * fait / total, reste))
        time.sleep(0.08)

    # -99999 = hors couverture : on les remplace par la médiane, le jeu n'aime pas les trous
    bons = sorted(v for v in z if v > -1000)
    med = bons[len(bons) // 2] if bons else 0.0
    trous = sum(1 for v in z if v <= -1000)
    z = [med if v <= -1000 else v for v in z]
    with open(sortie, 'w') as f:
        json.dump({'note': 'RGE ALTI (IGN) — grille régulière, du nord-ouest vers le sud-est',
                   'lat0': LAT0, 'lat1': LAT1, 'lon0': LON0, 'lon1': LON1,
                   'pas': PAS_M, 'nx': nx, 'nz': nz,
                   'min': min(z), 'max': max(z), 'trous': trous, 'z': z}, f)
    os.remove(part)
    dit('MNT écrit : altitudes.json — de %.2f à %.2f m, %d trous comblés'
        % (min(z), max(z), trous))


# =====================================================================
#  2. les couches vectorielles
# =====================================================================
def couches_wfs():
    """On ne devine aucun nom de couche : on lit les capacités et on cherche."""
    dit('WFS : lecture des capacités…')
    xml = get('https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities',
              timeout=180).decode('utf-8', 'replace')
    noms = []
    for bloc in xml.split('<FeatureType')[1:]:
        n = bloc.split('<Name>')[1].split('</Name>')[0] if '<Name>' in bloc else ''
        t = bloc.split('<Title>')[1].split('</Title>')[0] if '<Title>' in bloc else ''
        if n:
            noms.append((n, t))
    dit('       %d couches publiées' % len(noms))
    return noms


def choisir(noms, voulus):
    """On ne cherche plus par mot-clé : la première correspondance vague donnait
    « accessibilité des engins forestiers » pour la forêt et la carte d'état-major de
    1866 pour l'hydrographie. On nomme les couches, dans l'ordre de préférence, et on
    ne garde que celles que le serveur publie vraiment."""
    dispo = {n for n, _ in noms}
    titres = dict(noms)
    return [(v, titres.get(v, '')) for v in voulus if v in dispo]


def recolter_wfs(nom_couche, fichier):
    chemin = os.path.join(ICI, fichier)
    if os.path.exists(chemin):
        dit('  %s est déjà là — je le laisse.' % fichier)
        return True
    # WFS 2.0 en EPSG:4326 attend lat,lon ; certains serveurs veulent lon,lat.
    for bbox in ('%f,%f,%f,%f,EPSG:4326' % (LAT0, LON0, LAT1, LON1),
                 '%f,%f,%f,%f,EPSG:4326' % (LON0, LAT0, LON1, LAT1)):
        url = ('https://data.geopf.fr/wfs/ows?' + urllib.parse.urlencode({
            'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature',
            'TYPENAMES': nom_couche, 'SRSNAME': 'EPSG:4326', 'BBOX': bbox,
            'OUTPUTFORMAT': 'application/json', 'COUNT': '20000'}))
        try:
            d = json.loads(get(url, essais=2, timeout=120))
        except Exception as e:
            dit('  %s : %s' % (nom_couche, type(e).__name__))
            continue
        n = len(d.get('features', []))
        if n:
            with open(chemin, 'w') as f:
                json.dump(d, f)
            dit('  %s : %d objets → %s' % (nom_couche, n, fichier))
            return True
    dit('  %s : aucun objet sur l’emprise' % nom_couche)
    return False


def main():
    global CA_PERSO, SANS_VERIF
    av = sys.argv[1:]
    if '--aide' in av or '-h' in av or '--help' in av:
        dit(__doc__)
        dit('Options :')
        dit('  --ca FICHIER           bundle de certificats à utiliser (proxy d’entreprise)')
        dit('  --sans-verification    dernier recours si le TLS est intercepté')
        return
    if '--ca' in av:
        CA_PERSO = av[av.index('--ca') + 1]
        dit('Certificats : %s' % CA_PERSO)
    if '--sans-verification' in av:
        SANS_VERIF = True
        dit('!! vérification du certificat désactivée pour ce script')
    dit('Emprise : lat %.5f→%.5f  lon %.5f→%.5f' % (LAT0, LAT1, LON0, LON1))
    recolter_altitudes()
    dit('')
    try:
        noms = couches_wfs()
    except Exception as e:
        dit('WFS injoignable (%s) — le MNT seul suffit pour commencer.' % type(e).__name__)
        return
    # Une couche par fichier, nommée, dans l'ordre de préférence.
    groupes = [
        ('haies', 'ign-haies.geojson', [
            'HAIES.BOCAGES:haie',            # le référentiel national, celui de hedge.hedge
            'BDTOPO_V3:haie',
        ]),
        ('surfaces en eau', 'ign-eau-surfaces.geojson', [
            'BDTOPO_V3:surface_hydrographique',
            'BDTOPO_V3:plan_d_eau',
            'BDCARTO_V5:plan_d_eau',
        ]),
        ("cours d'eau", 'ign-eau-cours.geojson', [
            'BDTOPO_V3:cours_d_eau',
            'BDTOPO_V3:troncon_hydrographique',
            'BDCARTO_V5:cours_d_eau',
        ]),
        ('inventaire forestier', 'ign-foret.geojson', [
            'LANDCOVER.FORESTINVENTORY.V2:formation_vegetale',   # BD Forêt v2
            'LANDCOVER.FORESTINVENTORY.V1:resu_bdv1_shape',
        ]),
        ('bâti', 'ign-bati.geojson', [
            'BDTOPO_V3:batiment',
        ]),
    ]
    for titre, fichier, voulus in groupes:
        cands = choisir(noms, voulus)
        if not cands:
            dit('%s : aucune des couches attendues n’est publiée' % titre)
            dit('    cherchées : %s' % ', '.join(voulus))
            continue
        dit('%s :' % titre)
        for n, t in cands:
            dit('    %s   « %s »' % (n, t[:70]))
        for n, _ in cands:
            if recolter_wfs(n, fichier):
                break
    dit('')
    dit('Terminé. Dis à Claude ce que tu vois ci-dessus, et dépose les fichiers.')


if __name__ == '__main__':
    main()
