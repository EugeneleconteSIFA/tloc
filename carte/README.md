# carte/ — la citadelle de Lille au 1:1

Source : extrait OpenStreetMap (`lille-source.osm`, ODbL, © OpenStreetMap et contributeurs),
bornes lat 50,63634–50,64622 / lon 3,03506–3,05828, soit **1717 × 1179 m**.

`extraire-osm.py` en tire `lille.json` : les couches utiles au jeu, **projetées en mètres**,
origine au centroïde de la citadelle, **x = est, z = sud** (le nord est donc en -z, ce qui
met le nord en haut quand on regarde la carte d'au-dessus). Les tracés sont allégés par
Douglas-Peucker — 0,6 m sur les fortifications, 1,2 m sur le bâti — et découpés aux bornes
de l'extrait, sinon la Deûle partait à trois kilomètres.

## Ce qu'il y a dedans

| Couche | Contenu |
|---|---|
| `fortif.citadelle` | le pentagone du corps de place — **713 × 690 m** |
| `fortif.bastions` | les cinq : du Roy, de la Reine, du Dauphin, de Turenne, d'Anjou |
| `fortif.demilunes` | Sainte-Barbe, Royale, Saint-Georges, Dauphine, Saint-Sébastien |
| `fortif.contregardes` | du Roy, de la Reine, du Dauphin, de Turenne, d'Anjou |
| `fortif.ouvrages` | Lunette du Grand Carré, murs de communication |
| `fortif.murs` | 256 tronçons de `city_wall` / `wall` / `retaining_wall` |
| `eau` | fossés en eau, Deûle, canaux de la Moyenne et de la Haute-Deûle, canal de la Tortue |
| `verdure` | parc de la Citadelle, Bois de Boulogne, Jardin Vauban, pelouses, vergers |
| `routes` / `chemins` | voirie classée, allées et sentiers du parc |
| `ponts`, `talus` | ponts, glacis et remblais |
| `batiments` | 1713 emprises au sol |

`lille-preview.png` rend tout ça d'un coup : c'est ce qu'il faut comparer au plan de la ville
avant de coder quoi que ce soit.

## Convention de coordonnées du jeu

Un mètre du monde = une unité du jeu. La constante `ECH` de `game.js` (4,5) a été choisie
pour que le pentagone procédural existant tombe sur ces 700 m ; quand le tracé OSM
remplacera le pentagone régulier, `ECH` n'aura plus lieu d'être.

Régénérer : `python3 extraire-osm.py` (dépend seulement de la bibliothèque standard).

## citadelle.json — le tracé en coordonnées de JEU

`preparer-citadelle.py` transforme `lille.json` en `citadelle.json` : origine au centre de la
citadelle, et carte pivotée de **74,61°** pour amener la Porte Royale plein sud (+z), là où le
jeu a toujours mis son entrée. La forme n'est pas touchée, seulement le repère — tout pivote
ensemble, la Deûle et les parcs compris.

Après pivot, le plan tombe remarquablement droit : Turenne au nord, la Reine à l'ouest, le
Dauphin à l'est, Anjou et le Roy encadrant la porte au sud.

**`corps`** est la pièce maîtresse : le way « Citadelle de Lille » d'OSM est la limite
*extérieure* de l'ouvrage (chemin couvert et glacis compris), pas la ligne d'escarpe. Le
rempart se reconstruit donc à partir des cinq bastions — pour chacun on isole la partie qui
regarde dehors (faces et flancs, d'un épaulement à l'autre en passant par le saillant), puis on
relie chaque épaulement au suivant par une courtine droite. Résultat : 36 points, cinq
courtines de 129 à 173 m, la Porte Royale sur celle du sud.

| Clé | Contenu |
|---|---|
| `corps` | le tracé bastionné — c'est la ligne d'escarpe |
| `courtines` | les cinq segments droits entre épaulements |
| `bastions` | polygone réel, centre, `saillant`, normale sortante `n` |
| `porte` | point et direction de la Porte Royale, sur la courtine sud |
| `enceinte` | limite extérieure OSM (chemin couvert, glacis) |
| `demilunes`, `contregardes`, `ouvrages` | les dehors |
| `fosses` | les plans d'eau qui ceignent la place |
| `casernes` | les 38 emprises de bâtiments dans les murs |
| `eau`, `verdure`, `routes`, `chemins`, `ponts`, `talus`, `murs`, `batiments` | le reste de la carte, pivoté |
