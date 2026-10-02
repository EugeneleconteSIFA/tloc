# -*- coding: utf-8 -*-
"""Le repère de la Thaïlande : lat/lon ⇄ coordonnées de JEU (1 unité = 1 m), UNE baie.

Acte III, la Cloche des Îles. Eugène a envoyé cinq extraits le 2 octobre (« map (14) » à
« map (18) ») et demandé « un mélange de tout cela » : Ko Panyi, Ko Tapu et Khao Phing Kan
sont dans la baie de Phang Nga, Railay et Phi Phi à 40 et 60 km au sud, et le Wat Tham Suea
qu'il a choisi est celui de Kanchanaburi, à 700 km au nord. Le scénario veut UNE baie
d'îles qu'on voit les unes depuis les autres (SCENARIO.md § 12) : chaque extrait garde sa
forme et ses mesures, mais il est DÉPLACÉ dans une baie inventée, à quelques centaines de
mètres des autres. Le passeur, en barque, fait le lien.

Chaque morceau a son origine (comme les villes des Pouilles) et son DÉCALAGE dans la baie :
jeu(m, lat, lon) = la position locale + (dx, dz). x = est, z = sud, pas de pivot.
L'extraction et le relief importent CE fichier (une seule projection).
"""
import math

MORCEAUX = {
    # Le village de pêcheurs sur pilotis : le marché flottant, les passeurs, l'île de la
    # porte. Il est au centre de la baie, comme il l'est dans celle de Phang Nga.
    'panyi': {'lat': 8.33560, 'lon': 98.50370, 'dx': 0, 'dz': 0, 'src': 'thailande-ko-panyi.osm',
              'lieu': 'Ko Panyi, le village sur pilotis'},
    # Les pitons : Ko Tapu (le clou) et Khao Phing Kan, l'« île de James Bond ». Vraiment à
    # 7 km au sud de Ko Panyi ; ici à 600 m au sud-ouest, pour qu'on les voie du village.
    'tapu': {'lat': 8.27460, 'lon': 98.50090, 'dx': -650, 'dz': 560, 'src': 'thailande-ko-tapu.osm',
             'lieu': 'Khao Phing Kan et Ko Tapu'},
    # Le grand piton : le temple de la grotte du Tigre (Wat Tham Suea, Kanchanaburi), sa
    # colline haussée en piton (voir recolter-relief-thailande.py) et posée dans la mer.
    'suea': {'lat': 13.95360, 'lon': 99.60560, 'dx': 1000, 'dz': 300, 'src': 'thailande-wat-tham-suea.osm',
             'lieu': 'Wat Tham Suea, le temple de la grotte du Tigre'},
    # Railay : les falaises, les grottes de Phra Nang, les plages — l'île des cascades et des
    # corniches. Au sud.
    'railay': {'lat': 8.00800, 'lon': 98.84160, 'dx': -250, 'dz': 1900, 'src': 'thailande-railay.osm',
               'lieu': 'Railay, les falaises et les grottes de Phra Nang'},
    # Phi Phi Don : seulement l'isthme de Ton Sai et ses belvédères (l'extrait fait 20 km) —
    # le village, l'île des masques. Au sud-est.
    'phiphi': {'lat': 7.74000, 'lon': 98.77400, 'dx': 2550, 'dz': 1750, 'src': 'thailande-phi-phi.osm',
               'lieu': "Phi Phi Don, l'isthme de Ton Sai",
               'coupe': (7.7310, 7.7500, 98.7620, 98.7840)},   # lat min, lat max, lon min, lon max
}
NOMS = tuple(MORCEAUX)

def m_par_deg_lat(lat):
    p = math.radians(lat)
    return 111132.954 - 559.822 * math.cos(2 * p) + 1.175 * math.cos(4 * p)

def m_par_deg_lon(lat):
    p = math.radians(lat)
    return 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)

def jeu(m, lat, lon):
    """lat/lon → (x est, z sud) en mètres dans la baie : le repère du morceau, puis son décalage."""
    o = MORCEAUX[m]
    return ((lon - o['lon']) * m_par_deg_lon(lat) + o['dx'], -(lat - o['lat']) * m_par_deg_lat(o['lat']) + o['dz'])

def latlon(m, x, z):
    """(x, z) de la baie → lat/lon dans le morceau m ; l'inverse exact de jeu()."""
    o = MORCEAUX[m]
    lat = o['lat'] - (z - o['dz']) / m_par_deg_lat(o['lat'])
    return (lat, o['lon'] + (x - o['dx']) / m_par_deg_lon(lat))
