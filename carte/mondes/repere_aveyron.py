# -*- coding: utf-8 -*-
"""Le repère du monde de l'Aveyron : lat/lon ⇄ coordonnées de JEU (1 unité = 1 m).

Copie de repere_lozere.py, pour la même raison : l'extraction OSM et le relief importent
CE fichier, ils ne peuvent pas prendre deux constantes différentes (à Lille, 0,7 % d'écart
entre le plan et le terrain).

Origine : le centre du lac de Saint-Gervais (barycentre de sa surface OSM, way 106843080).
C'est le cœur de l'acte II — la dernière réserve d'eau, le duel du lac, les trois maisons
Roquette sur sa rive. x = est, z = sud (nord en -z), comme à Lille. Pas de pivot.

L'emprise fait 5 km du lac à Saint-Symphorien : comme en Lozère, l'échelle est-ouest est
prise à la latitude de CHAQUE point (sinusoïdale centrée sur le lac), pour que les distances
locales restent justes jusqu'au bourg.
"""
import math

LAT0 = 44.7331440      # barycentre du lac de Saint-Gervais (OSM, natural=water)
LON0 = 2.6807491

# Mètres par degré sur l'ellipsoïde WGS84 (la sphère se trompe de 0,2 % en nord-sud à 44°).
def m_par_deg_lat(lat):
    p = math.radians(lat)
    return 111132.954 - 559.822 * math.cos(2 * p) + 1.175 * math.cos(4 * p)

def m_par_deg_lon(lat):
    p = math.radians(lat)
    return 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)

MLAT = m_par_deg_lat(LAT0)

def jeu(lat, lon):
    """lat/lon → (x est, z sud) en mètres, origine au centre du lac."""
    return ((lon - LON0) * m_par_deg_lon(lat), -(lat - LAT0) * MLAT)

def latlon(x, z):
    """(x, z) du jeu → lat/lon ; l'inverse exact de jeu()."""
    lat = LAT0 - z / MLAT
    return (lat, LON0 + x / m_par_deg_lon(lat))
