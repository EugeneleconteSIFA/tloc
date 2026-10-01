# -*- coding: utf-8 -*-
"""Le repère du monde de Lozère : lat/lon ⇄ coordonnées de JEU (1 unité = 1 m).

Un seul fichier pour la projection, que l'extraction OSM et le relief importent tous deux :
à Lille, extraire-osm.py prenait 111 320 m par degré de latitude et preparer-relief.py
110 540 — 0,7 % d'écart, soit 7 m au bout d'un kilomètre entre le plan et le terrain.
Ici les deux chaînes passent par les mêmes fonctions, elles ne peuvent pas diverger.

Origine : le hameau du Pouget (nœud OSM « Le Pouget », place=hamlet) — c'est le cœur de
l'acte V (l'aïeule, le berger). x = est, z = sud, comme à Lille : le nord est en -z.
Pas de pivot : le nord du jeu est le nord vrai.

L'emprise fait 6 km du Pouget à la Garde-Guérin. Une projection plate à échelle unique
tordrait la largeur de 4 m au bord nord ; on prend donc l'échelle est-ouest à la latitude
de CHAQUE point (projection sinusoïdale centrée sur le Pouget) : les distances locales
restent justes partout, ce qui compte pour poser une maison sur son emprise.
"""
import math

LAT0 = 44.4296343      # Le Pouget (OSM, node place=hamlet)
LON0 = 3.9122511

# Mètres par degré sur l'ellipsoïde WGS84 (et non la sphère de 111 320 m) :
# à 44° de latitude, la sphère se trompe de 0,2 % en nord-sud.
def m_par_deg_lat(lat):
    p = math.radians(lat)
    return 111132.954 - 559.822 * math.cos(2 * p) + 1.175 * math.cos(4 * p)

def m_par_deg_lon(lat):
    p = math.radians(lat)
    return 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)

MLAT = m_par_deg_lat(LAT0)

def jeu(lat, lon):
    """lat/lon → (x est, z sud) en mètres, origine au Pouget."""
    return ((lon - LON0) * m_par_deg_lon(lat), -(lat - LAT0) * MLAT)

def latlon(x, z):
    """(x, z) du jeu → lat/lon ; l'inverse exact de jeu()."""
    lat = LAT0 - z / MLAT
    return (lat, LON0 + x / m_par_deg_lon(lat))
