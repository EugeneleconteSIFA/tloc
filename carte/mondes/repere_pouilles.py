# -*- coding: utf-8 -*-
"""Les repères des Pouilles : lat/lon ⇄ coordonnées de JEU (1 unité = 1 m), UN PAR VILLE.

Matera, Alberobello et Gallipoli sont à 50–100 km l'une de l'autre : une carte commune
mettrait 100 km de rien entre elles, et une projection plate s'y tordrait. Le petit train
qui les relie est une transition de jeu, pas un trajet : chaque ville a son origine, et
rien ne mesure la distance de l'une à l'autre.

Comme repere_lozere.py : l'extraction et le relief importent CE fichier (une seule
projection), ellipsoïde WGS84, échelle est-ouest prise à la latitude de chaque point.
x = est, z = sud (nord en -z), pas de pivot.
"""
import math

# L'origine de chaque ville : son centre historique.
ORIGINES = {
    # Les Sassi : la Civita, l'éperon de la cathédrale entre le Sasso Barisano (au nord) et
    # le Sasso Caveoso (au sud) — barycentre de la cathédrale (OSM, way 145667236).
    # ⚠ l'extrait s'arrête 3 m au sud d'elle : tout Matera est en z > 0 (cf. README).
    'matera':      {'lat': 40.6668029, 'lon': 16.6113278, 'lieu': 'la Civita, cathédrale (Sassi)'},
    # Le Rione Monti : OSM ne le nomme pas ; c'est le barycentre de ses 96 trulli
    # (lat 40,7802–40,7828, lon 17,2335–17,2392, entre Sant'Antonio et Largo Martellotta).
    'alberobello': {'lat': 40.7816341, 'lon': 17.2363695, 'lieu': 'le Rione Monti (barycentre des trulli)'},
    # La vieille ville sur son île : barycentre de « Isola di Gallipoli » (way 439773988).
    'gallipoli':   {'lat': 40.0557351, 'lon': 17.9764318, 'lieu': "l'île de la vieille ville"},
}
VILLES = tuple(ORIGINES)

def m_par_deg_lat(lat):
    p = math.radians(lat)
    return 111132.954 - 559.822 * math.cos(2 * p) + 1.175 * math.cos(4 * p)

def m_par_deg_lon(lat):
    p = math.radians(lat)
    return 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)

def jeu(ville, lat, lon):
    """lat/lon → (x est, z sud) en mètres, origine au centre historique de la ville."""
    o = ORIGINES[ville]
    return ((lon - o['lon']) * m_par_deg_lon(lat), -(lat - o['lat']) * m_par_deg_lat(o['lat']))

def latlon(ville, x, z):
    """(x, z) du jeu → lat/lon ; l'inverse exact de jeu()."""
    o = ORIGINES[ville]
    lat = o['lat'] - z / m_par_deg_lat(o['lat'])
    return (lat, o['lon'] + x / m_par_deg_lon(lat))
