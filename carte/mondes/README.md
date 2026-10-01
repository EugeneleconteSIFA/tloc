# Les extraits OpenStreetMap des autres mondes

Fournis par Eugène le 1er octobre (export openstreetmap.org, « map (n).osm »), copiés ici
sous des noms qui disent le lieu. La Lozère, l'Aveyron et les Pouilles ont leur chaîne (ci-dessous) ; Nicobar attend la sienne, sur le modèle de celle de Lille (`carte/`, mais une COPIE des scripts — ne
pas relancer `carte/ign-recolte.py`, réglé pour Lille).

OSM donne le plan (bâtiments, rues, eau, voies ferrées), **pas le relief**. Le relief vient
d'ailleurs : l'IGN (RGE ALTI) pour la France, comme à Lille ; un modèle numérique public
(Copernicus GLO-30, ou TINITALY pour l'Italie) pour le reste.

| fichier | lieu | emprise (lat ; lon) | monde de `STORY.md` | contenu notable |
|---|---|---|---|---|
| `lozere-villefort-pouget.osm` | Villefort, le lac, **le Pouget** (Pourcharesses) | 44,427–44,471 ; 3,871–3,943 | La Cloche des Troupeaux (acte V) | le Pouget, le lac de Villefort, la Régordane, la voie ferrée Nîmes–Clermont ; 1 236 bâtiments |
| `aveyron-saint-gervais.osm` | Saint-Amans-des-Cots, **lac de Saint-Gervais** | 44,729–44,740 ; 2,676–2,699 | La Cloche du Midi (acte II) | le lac, l'église, Perpignau ; 90 bâtiments |
| `aveyron-saint-symphorien.osm` | **Saint-Symphorien-de-Thénières** | 44,735–44,741 ; 2,726–2,738 | La Cloche du Midi (acte II) | le bourg, l'église, les Cazelles ; 74 bâtiments |
| `pouilles-matera.osm` | **Matera**, les Sassi | 40,655–40,667 ; 16,598–16,622 | La Cloche des Heures (acte IV) | Casalnuovo, Malve, Pianelle, la Murgia ; 1 353 bâtiments |
| `pouilles-alberobello.osm` | **Alberobello**, les trulli | 40,778–40,790 ; 17,227–17,250 | La Cloche des Heures (acte IV) | la voie Bari–Tarente ; 2 934 bâtiments |
| `pouilles-gallipoli.osm` | **Gallipoli**, la vieille ville sur son île | 40,050–40,062 ; 17,962–17,986 | La Cloche des Heures (acte IV) | le pont, le seno del Canneto, la voie Lecce–Gallipoli |
| `lozere-garde-guerin.osm` | **La Garde-Guérin** : la tour, l'église Saint-Michel, la Régordane | 44,476–44,479 ; 3,932–3,938 | La Cloche des Troupeaux (acte V) | 46 bâtiments, le village fortifié entier |
| `iles-nicobar.osm` | **îles Nicobar** (Inde) : Nancowry, Kamorta, Katchall, Trinkat | 7,912–8,158 ; 93,421–93,795 | La Cloche des Îles (acte III) ? | ⚠ pas la Thaïlande : à confirmer avec Eugène |

## Les Pouilles : trois villes et un petit train (Eugène, 1er octobre)

Trois villes fortifiées — Matera, le cœur de Gallipoli, Alberobello — et, pour passer de
l'une à l'autre, **un petit train**. Les trois extraits ont chacun leur bout de voie ferrée
(Bari–Tarente à Alberobello, Lecce–Gallipoli, la ligne de Matera) : de quoi poser les gares
au bon endroit.

## L'Aveyron : les trois maisons autour du lac (Eugène, 1er octobre)

Les maisons du **Batut**, du **Pouget** (la grande maison de l'Aveyron, à ne pas confondre avec
le hameau de Lozère) et de **Beauregard** se posent autour du **lac de Saint-Gervais**
(`aveyron-saint-gervais.osm`) — Eugène laissait le choix entre le lac et Saint-Symphorien ;
le lac l'emporte, parce qu'il relie les trois maisons par l'eau et la rive.
**Saint-Symphorien-de-Thénières** (`aveyron-saint-symphorien.osm`, à 4 km à l'est) est le
bourg voisin : l'église, le four, la place du Marronnier. (OSM n'a pas le four lui-même,
seulement la rue du Four : voir « L'Aveyron : la chaîne de préparation ».)

## La Garde-Guérin

Le premier envoi (« map (8) ») tombait sur « Chez Guérin », à Montlieu-la-Garde (Charente-
Maritime) ; le bon extrait est arrivé juste après : `lozere-garde-guerin.osm`.

## La Lozère : la chaîne de préparation (1er octobre)

Les deux extraits (`lozere-villefort-pouget.osm`, `lozere-garde-guerin.osm`) fondus en un
seul plan, **en coordonnées de jeu : 1 unité = 1 m, origine au hameau du Pouget, x = est,
z = sud** (nord en -z, comme Lille), sans pivot.

| fichier | rôle |
|---|---|
| `repere_lozere.py` | LA projection, importée par tous les scripts ci-dessous — à Lille, l'extraction et le relief prenaient deux constantes différentes (111 320 et 110 540 m/°, 0,7 % d'écart) ; ici c'est impossible |
| `extraire-lozere.py` | OSM → `lozere.json`, puis lance l'aperçu. Bibliothèque standard seule |
| `apercu-lozere.py` | `lozere.json` → `lozere-apercu.svg` et `.png` (Chrome sans tête) |
| `recolter-relief-lozere.py` | le relief IGN — **pas encore lancé**, voir plus bas |

`lozere.json` (≈ 380 Ko) :

| clé | contenu |
|---|---|
| `cadres` | les emprises des deux extraits ; **un trou de ~600 m** les sépare (Villefort s'arrête à z = -4 620, la Garde-Guérin commence à -5 199) |
| `cadrages` | les trois vues proposées : `pouget` (600 × 600 m), `lac` (3,4 × 3 km), `garde` (574 × 566 m) |
| `lieux` | 83 points nommés : hameaux, mas, gare, barrage, églises, château de Castanet, tour, four banal, sommets, sources, croix |
| `batiments` | 1 279 emprises (allégées à 0,4 m, pas 1,2 comme à Lille : une maison du Pouget fait 6 m) ; `k` le type, `niv`, `h`, `nom`, `trous` quand OSM les donne |
| `routes` (`r` 3/2/1), `chemins` (`r` 1 piste, 0 sentier ; `k` steps, via_ferrata) | avec `pont` (oui / viaduc) et `tunnel` |
| `regordane` | la voie Régordane et l'ancienne route des Vans d'un seul trait — les « vieux chemins » ; ses tronçons sont aussi dans routes et chemins |
| `eau` | `plans` (le lac : 128 ha), `cours` (l'Altier, Palhères, Morangiès, 240 ruisseaux), `barrages`, `canaux` |
| `fer` | `voies` (ligne Nîmes–Clermont, tunnels, viaduc ; `triage` à la gare), `quais`, `gare` |
| `garde` | l'enceinte, le château, la tour, l'église Saint-Michel |
| `murs`, `falaises`, `verdure` | murs et soutènements ; bois, landes, prés, rochers, jardins (`src: CORINE` = tracé au 1:100 000, une ambiance, pas une limite) |

Ce qu'OSM n'a pas : **les menhirs** (aucun nœud), le détail des châtaigneraies du Pouget,
les murets de pierre sèche hors du bourg. À poser à la main ou à prendre à la BD TOPO.

### Le relief (proposé, en attente de l'accord d'Eugène)

`recolter-relief-lozere.py` demande au RGE ALTI de l'IGN l'altitude **aux nœuds de la grille
du jeu** — pas de ré-échantillonnage comme à Lille. Altitudes NGF absolues.

| zone | pas | points | requêtes |
|---|---|---|---|
| `monde` | 10 m | 335 000 | ~1 670 |
| `pouget` | 2 m | 91 000 | ~450 |
| `garde` | 2 m | 82 000 | ~410 |
| `lac` (facultatif) | 5 m | 418 000 | ~2 090 |

`python3 recolter-relief-lozere.py monde pouget garde` : ~2 500 requêtes, 15 à 25 minutes.

## L'Aveyron : la chaîne de préparation (1er octobre)

Les deux extraits (`aveyron-saint-gervais.osm`, `aveyron-saint-symphorien.osm`) fondus en un
seul plan, **en coordonnées de jeu : 1 unité = 1 m, origine au centre du lac de
Saint-Gervais** (barycentre de sa surface OSM : 44,733144 N ; 2,680749 E), **x = est, z = sud**,
sans pivot. Mêmes choix que la Lozère, scripts copiés et non partagés (règle « pas de
système parallèle » : chaque monde a sa chaîne, lisible seule).

| fichier | rôle |
|---|---|
| `repere_aveyron.py` | LA projection (WGS84, échelle est-ouest à la latitude de chaque point), importée par l'extraction et le relief |
| `extraire-aveyron.py` | OSM → `aveyron.json`, puis lance l'aperçu. Bibliothèque standard seule. Les **propositions** (ci-dessous) y sont écrites en clair, dans `PROPOSES` |
| `apercu-aveyron.py` | `aveyron.json` → `aveyron-apercu.svg` et `.png` : le monde en haut, le lac et le bourg dessous ; les propositions en orange |
| `recolter-relief-aveyron.py` | le relief IGN (RGE ALTI), aux nœuds de la grille du jeu — lancé à la suite de celui de Lozère |

`aveyron.json` (≈ 47 Ko) :

| clé | contenu |
|---|---|
| `cadres` | les deux emprises ; **un trou de 2,1 km** les sépare (le lac s'arrête à x = 1 476, le bourg commence à x = 3 620). Rien n'y est cartographié ; le relief le couvre |
| `cadrages` | `lac` (1 104 × 1 206 m : le lac, le barrage, 250 m de rive) et `bourg` (Saint-Symphorien, 600 × 600 m autour de l'église) |
| `lieux` | 38 points : Saint-Gervais et son église, Perpignau, Perpignou, la Jordie, Fariboules, Prat del Mas ; Saint-Symphorien, son église, la mairie, l'école, la place du Marronnier, les Cazelles, la Mauve ; croix, fontaines, monuments aux morts, cimetières, le barrage — **et 6 propositions** (`propose: true`) |
| `batiments` | 159 emprises (0,4 m) |
| `routes`, `chemins`, `ponts` (le ponton de la baignade) | comme en Lozère |
| `eau` | `plans` : le lac (**17,4 ha**), le bord du réservoir de Montézic (à l'ouest du barrage, découpé au cadre), une mare ; `cours` : le ruisseau des Vergnes, qui **entre par le sud-est et sort au barrage** ; `barrages` ; `baignade` (la plage surveillée, rive nord) |
| `verdure` | bois, prés, cimetières |

### Les propositions, à valider par Eugène

OSM ne connaît ni les Roquette, ni le duel, ni le Dormeur. Rien n'est posé en silence : ces
six points portent `propose: true` et une `note` qui dit pourquoi ; ils sont **en orange sur
l'aperçu**. Le jeu ne doit pas les tenir pour acquis.

| proposition | x, z | pourquoi là |
|---|---|---|
| **Le Batut** | -135, 170 | rive ouest, dans le bois entre la route et l'eau, à 300 m du barrage : il tient le côté de la retenue — ce dont Beauregard l'accuse |
| **Beauregard** | 400, 150 | rive est, sur la pente au-dessus du bras sud-est : il « regarde » le lac et le Batut en face |
| **Le Pouget** (la grande maison) | 185, -315 | rive nord-est, dans les prés, à égale distance des deux autres : là où les familles se retrouvent chez l'aïeule |
| **Le duel du lac** | -222, -75 | sur la crête du barrage : un passage étroit entre l'eau et le vide, au point même de la querelle |
| **La source des Vergnes** | 470, 440 | sur le ruisseau qui nourrit le lac : bouchée par la bande, le lac baisse. Les autres sources de la quête peuvent être des points d'OSM : la fontaine du lac (-269, -339), les deux fontaines de Saint-Symphorien |
| **Le Dormeur** | 2 550, -150 (zone 1 700–3 400 × -750–450) | aucune falaise dans OSM ; dans les 2 km sans plan entre le lac et le bourg, où rien ne gêne un géant. **À affiner sur le relief** quand il sera récolté |

Ce qu'OSM n'a pas : **le four** de Saint-Symphorien (aucun `baking_oven`, seulement la
« Rue du Four »), aucune falaise, aucune source. Le « lavoir » n'existe que par la rue du
Lavoir et le chemin des Lavandières, à Saint-Gervais.

### Le relief

`recolter-relief-aveyron.py`, copie de celui de Lozère (RGE ALTI, altitudes NGF absolues,
requêtes de 200 points). Eugène l'autorise ; une seule récolte à la fois sur data.geopf.fr,
donc elle attend que celle de Lozère soit finie, puis reprend où elle s'arrête si on la coupe.

| zone | pas | points | requêtes |
|---|---|---|---|
| `monde` (le lac, le trou, le bourg : 5,1 × 1,4 km) | 10 m | 73 660 | 369 |
| `lac` | 5 m | 53 482 | 268 |
| `bourg` | 2 m | 90 601 | 454 |

`python3 recolter-relief-aveyron.py monde lac bourg` : 1 091 requêtes. Ensuite,
`python3 apercu-aveyron.py` pose l'ombrage : il doit tomber dans le vallon des Vergnes et
sous le lac, pas à côté.

## Les Pouilles : la chaîne de préparation (1er octobre)

Les trois villes sont à 50–100 km l'une de l'autre : **un repère par ville**, pas de carte
commune. Le petit train est une transition de jeu : de lui, chaque ville ne garde que sa
voie ferrée et **sa gare**, le point où le train dépose Camille. 1 unité = 1 m, x = est,
z = sud, sans pivot.

| fichier | rôle |
|---|---|
| `repere_pouilles.py` | les trois origines et `jeu(ville, lat, lon)` / `latlon(ville, x, z)` (WGS84) |
| `extraire-pouilles.py` | les trois OSM → `matera.json`, `alberobello.json`, `gallipoli.json` ; `python3 extraire-pouilles.py gallipoli` pour une seule |
| `apercu-pouilles.py` | `pouilles-apercu.svg` et `.png` : les trois villes l'une sous l'autre, **à la même échelle** (1,12 px/m) |
| `recolter-relief-pouilles.py` | le relief Copernicus — **pas lancé**, voir plus bas |

| ville | origine (+) | cadre | contenu | la gare |
|---|---|---|---|---|
| **Matera** | la Civita : la cathédrale, entre les deux Sassi | 1 978 × 1 307 m | 1 288 bâtiments, 268 escaliers, 146 murs, 19 falaises, la Gravina (un « drain » pour OSM, gardé comme torrent) ; 71 lieux : 15 églises et 3 églises rupestres, 17 places, 20 belvédères, le château Tramontano, les Sassi | **Matera Centrale** (x -850, z 56), souterraine : la ligne Bari–Matera (voie étroite) y arrive en tunnel ; Matera Sud aussi |
| **Alberobello** | le Rione Monti : barycentre de ses 96 trulli (OSM ne nomme pas le rione) | 1 974 × 1 305 m | 2 882 bâtiments dont **472 trulli** (`k: trullo`) ; 24 lieux : la basilique des Saints-Côme-et-Damien, Sant'Antonio, Santa Lucia, 9 places, 7 belvédères | **Alberobello** (x 491, z -560), ligne Bari–Tarente, 2 quais |
| **Gallipoli** | le barycentre de l'île de la vieille ville | 1 996 × 1 319 m | la **mer** (la côte OSM refermée sur sa gauche en terre ferme, `cote.terre`), 3 îles, 3 récifs, les remparts (`enceinte`), 175 bâtiments (souvent des îlots entiers), 15 jetées et ponts ; 44 lieux : 12 églises, le château angevin, Portaterra, la fontaine grecque, 7 ports, les deux « seni » | **Gallipoli** : **221 m hors du cadre**, à l'est (x 1 020, z -219), `hors_cadre: true`. La voie Lecce–Gallipoli entre dans le cadre ; son dernier tronçon, désaffecté (`desaffectee`), passe le viaduc jusqu'au pied de l'île |

### Ce qui manque

- **Le Colosse de Barletta** (le gardien de l'acte IV) et **Castel del Monte** (le château à
  huit tours de `STORY.md`) ne sont dans **aucun** extrait. Il faut deux exports de plus :
  Barletta, autour de la basilique du Saint-Sépulcre (41,316–41,322 ; 16,278–16,288), et
  Castel del Monte (41,082–41,088 ; 16,267–16,274).
- **Matera est coupée au nord** : l'extrait s'arrête 3 m au sud de la cathédrale. Le
  **Sasso Barisano**, la moitié nord des Sassi, est presque entièrement dehors. Un nouvel
  export jusqu'à 40,672 N le rattraperait, sans rien changer au repère.
- **La gare de Gallipoli** est juste hors du cadre (221 m) : on a sa position, pas ses quais.
  Un export poussé à 17,990 E les donnerait.
- À Alberobello, le **Rione Monti** et l'**Aia Piccola** n'existent pas comme lieux dans OSM ;
  le Rione Monti est posé à l'origine, `propose: true`.

### Le relief (proposé, en attente de l'accord d'Eugène)

L'IGN ne couvre pas l'Italie. Ce Mac lit le GeoTIFF sans rien installer : le Python
d'anaconda (`python3`) a `tifffile`, `imagecodecs` et `numpy` (pas de GDAL). Deux sources :

| source | pas | accès | fichiers |
|---|---|---|---|
| **Copernicus GLO-30** (ESA) — proposée | 30 m | public, sans compte (seau AWS ouvert) | `Copernicus_DSM_COG_10_N40_00_E016_00_DEM.tif` (37,6 Mo, Matera) et `…_N40_00_E017_00_DEM.tif` (21,6 Mo, Alberobello et Gallipoli) : **59 Mo** |
| TINITALY (INGV) | 10 m | formulaire d'inscription — **c'est Eugène qui le remplit** | tuiles en UTM ; le script ne sait pas encore les reprojeter |

GLO-30 est un modèle de **surface** : les toits et les arbres y sont, lissés à 30 m. Pour la
Gravina (100 m de profondeur) ou la pente de l'île, c'est sans conséquence ; pour poser une
maison au mètre près, TINITALY serait meilleur.

`recolter-relief-pouilles.py --telecharger` (après l'accord) range les tuiles dans
`copernicus/` (ignoré par git), puis écrit `relief-pouilles-<ville>.json` au pas de 10 m,
aux nœuds de la grille de chaque ville (interpolation bilinéaire, même format que la
Lozère). Sans `--telecharger`, il ne télécharge rien et dit ce qui manque.
