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
| `pouilles-matera-sassi.osm` | **Matera**, le Sasso Barisano et le nord (« map (13) », 2 octobre) | 40,662–40,674 ; 16,599–16,622 | La Cloche des Heures (acte IV) | San Pietro Barisano, la Madonna delle Virtù, Sant'Agostino ; fondu avec le précédent |
| `pouilles-alberobello.osm` | **Alberobello**, les trulli | 40,778–40,790 ; 17,227–17,250 | La Cloche des Heures (acte IV) | la voie Bari–Tarente ; 2 934 bâtiments |
| `pouilles-gallipoli.osm` | **Gallipoli**, la vieille ville sur son île | 40,050–40,062 ; 17,962–17,986 | La Cloche des Heures (acte IV) | le pont, le seno del Canneto, la voie Lecce–Gallipoli |
| `pouilles-gallipoli-gare.osm` | **Gallipoli**, la ville neuve et la gare (« map (12) », 2 octobre) | 40,050–40,062 ; 17,977–18,000 | La Cloche des Heures (acte IV) | la gare, ses quais, le port mercantile ; fondu avec le précédent |
| `lozere-garde-guerin.osm` | **La Garde-Guérin** : la tour, l'église Saint-Michel, la Régordane | 44,476–44,479 ; 3,932–3,938 | La Cloche des Troupeaux (acte V) | 46 bâtiments, le village fortifié entier |
| `thailande-ko-panyi.osm` | **Ko Panyi**, le village sur pilotis (« map (14) », 2 octobre) | 8,332–8,340 ; 98,498–98,510 | La Cloche des Îles (acte III) | passerelles et pontons, la mosquée, le rocher |
| `thailande-ko-tapu.osm` | **Khao Phing Kan et Ko Tapu** (« map (16) ») | 8,273–8,277 ; 98,498–98,504 | La Cloche des Îles | les pitons, le belvédère |
| `thailande-railay.osm` | **Railay** (« map (17) ») | 8,000–8,016 ; 98,830–98,853 | La Cloche des Îles | falaises, grottes de Phra Nang, plages ; 214 bâtiments |
| `thailande-phi-phi.osm` | **Phi Phi** (« map (18) ») | 7,696–7,819 ; 98,678–98,865 | La Cloche des Îles | on n'en garde que l'isthme de Ton Sai (7,731–7,750 ; 98,762–98,784) |
| `thailande-wat-tham-suea.osm` | **Wat Tham Suea**, celui de **Kanchanaburi** (« map (15) ») | 13,952–13,956 ; 99,603–99,609 | La Cloche des Îles | le temple, le chedi — pas celui de Krabi |
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

### Le relief (récolté le 1er octobre)

`recolter-relief-lozere.py` demande à l'IGN l'altitude **aux nœuds de la grille du jeu** —
pas de ré-échantillonnage comme à Lille. Altitudes NGF absolues.

⚠ La ressource `ign_rge_alti_wld` (celle de Lille) rend le point le plus proche d'une grille
d'environ **5 m** : en dessous de ce pas, les valeurs vont par paires et l'ombrage fait des
marches. Les zones fines prennent donc le **LiDAR HD** (`ign_lidar_hd_mnt_mono_wld`, interpolé,
sans trou) ; `ign_rge_alti_par_territoires` (RGE ALTI 1 m) donne la même chose à 10 cm près.

| zone | pas | points | requêtes |
|---|---|---|---|
| `monde` | 10 m | 335 000 | ~1 670 |
| `pouget` | 2 m, LiDAR HD | 91 000 | ~450 |
| `garde` | 2 m, LiDAR HD | 82 000 | ~410 |
| `lac` (facultatif) | 5 m | 418 000 | ~2 090 |

`python3 recolter-relief-lozere.py monde pouget garde` : ~2 500 requêtes, 15 à 25 minutes.

Récolté le 1er octobre, 0 trou : `relief-lozere-monde.json` (496 → 1 437 m),
`relief-lozere-pouget.json` et `relief-lozere-garde.json` (LiDAR HD ; la première récolte à
2 m sur la grille de 5 m est dans `_mauvais/`).
L'ombrage de l'aperçu tombe sous l'Altier et dans la cuvette du lac : relief et plan sont
dans le même repère. Le relief couvre aussi le trou entre les deux extraits OSM.

**Le lac attend** (Eugène, 1er octobre) : arrêté à 1 % — `relief-lozere-lac.json.part`
garde ce qui est fait, et `python3 recolter-relief-lozere.py lac` reprend là (~35 min).
Pour plus tard : le barrage a englouti un village, que la sonnaille (« la vallée avant le
barrage », STORY.md) pourrait faire revenir. Le RGE ALTI donne la surface de l'eau, pas le
fond de la vallée noyée : il faudra une autre source (cartes d'avant la mise en eau) pour
le dessiner.

## L'Aveyron : la chaîne de préparation (1er octobre)

Les deux extraits (`aveyron-saint-gervais.osm`, `aveyron-saint-symphorien.osm`) fondus en un
seul plan, **en coordonnées de jeu : 1 unité = 1 m, origine au centre du lac de
Saint-Gervais** (barycentre de sa surface OSM : 44,733144 N ; 2,680749 E), **x = est, z = sud**,
sans pivot. Mêmes choix que la Lozère, scripts copiés et non partagés (règle « pas de
système parallèle » : chaque monde a sa chaîne, lisible seule).

| fichier | rôle |
|---|---|
| `repere_aveyron.py` | LA projection (WGS84, échelle est-ouest à la latitude de chaque point), importée par l'extraction et le relief |
| `extraire-aveyron.py` | OSM → `aveyron.json`, puis lance l'aperçu. Bibliothèque standard seule. Les lieux **posés à la main** (ci-dessous) y sont écrits en clair, dans `POSES` |
| `apercu-aveyron.py` | `aveyron.json` → `aveyron-apercu.svg` et `.png` : le monde en haut, le lac et le bourg dessous ; les lieux posés à la main en orange |
| `recolter-relief-aveyron.py` | le relief IGN (RGE ALTI), aux nœuds de la grille du jeu — lancé à la suite de celui de Lozère |

`aveyron.json` (≈ 47 Ko) :

| clé | contenu |
|---|---|
| `cadres` | les deux emprises ; **un trou de 2,1 km** les sépare (le lac s'arrête à x = 1 476, le bourg commence à x = 3 620). Rien n'y est cartographié ; le relief le couvre |
| `cadrages` | `lac` (1 104 × 1 206 m : le lac, le barrage, 250 m de rive) et `bourg` (Saint-Symphorien, 600 × 600 m autour de l'église) |
| `lieux` | 38 points : Saint-Gervais et son église, Perpignau, Perpignou, la Jordie, Fariboules, Prat del Mas ; Saint-Symphorien, son église, la mairie, l'école, la place du Marronnier, les Cazelles, la Mauve ; croix, fontaines, monuments aux morts, cimetières, le barrage — **et 6 lieux posés à la main** (`pose: 'Eugène'`) |
| `batiments` | 159 emprises (0,4 m) |
| `routes`, `chemins`, `ponts` (le ponton de la baignade) | comme en Lozère |
| `eau` | `plans` : le lac (**17,4 ha**), le bord du réservoir de Montézic (à l'ouest du barrage, découpé au cadre), une mare ; `cours` : le ruisseau des Vergnes, qui **entre par le sud-est et sort au barrage** ; `barrages` ; `baignade` (la plage surveillée, rive nord) |
| `verdure` | bois, prés, cimetières |

### Les lieux posés à la main (validés par Eugène le 1er octobre)

OSM ne connaît ni les Roquette, ni le duel, ni le Dormeur. Ces six points ont été proposés
sur le plan, puis **validés par Eugène le 1er octobre** — « on déplacera plus tard si
besoin ». Ils portent `pose: 'Eugène'` et une `note` qui dit pourquoi là ; ils restent **en
orange sur l'aperçu**, pour qu'on sache toujours qu'ils ne viennent pas d'OSM.

| lieu | x, z | pourquoi là |
|---|---|---|
| **Le Batut** | -135, 170 | rive ouest, dans le bois entre la route et l'eau, à 300 m du barrage : il tient le côté de la retenue — ce dont Beauregard l'accuse |
| **Beauregard** | 400, 150 | rive est, sur la pente au-dessus du bras sud-est : il « regarde » le lac et le Batut en face |
| **Le Pouget** (la grande maison) | 185, -315 | rive nord-est, dans les prés, à égale distance des deux autres : là où les familles se retrouvent chez l'aïeule |
| **Le duel du lac** | -222, -75 | sur la crête du barrage : un passage étroit entre l'eau et le vide, au point même de la querelle |
| **La source des Vergnes** | 470, 440 | sur le ruisseau qui nourrit le lac : bouchée par la bande, le lac baisse. Les autres sources de la quête peuvent être des points d'OSM : la fontaine du lac (-269, -339), les deux fontaines de Saint-Symphorien |
| **Le Dormeur** | -2 592, -501 (zone -2 900 à -2 300 × -1 100 à 50) | aucune falaise dans OSM ni sur le plateau : le mur de la vallée à l'ouest du lac, 400 m de haut (candidat A des environs, choisi par Eugène le 2 octobre) |

Ce qu'OSM n'a pas : **le four** de Saint-Symphorien (aucun `baking_oven`, seulement la
« Rue du Four »), aucune falaise, aucune source. Le « lavoir » n'existe que par la rue du
Lavoir et le chemin des Lavandières, à Saint-Gervais.

### Le relief

`recolter-relief-aveyron.py`, copie de celui de Lozère (RGE ALTI, altitudes NGF absolues,
requêtes de 200 points). Eugène l'autorise ; une seule récolte à la fois sur data.geopf.fr.
Récoltée le 1er octobre, après celle de Lozère ; reprend où elle s'arrête si on la coupe.

| zone | pas, ressource | points | requêtes |
|---|---|---|---|
| `monde` (le lac, le trou, le bourg : 5,1 × 1,4 km) | 10 m, `ign_rge_alti_wld` | 73 660 | 369 |
| `lac` | 5 m, LiDAR HD | 53 482 | 268 |
| `bourg` | 2 m, LiDAR HD | 90 601 | 454 |

⚠ Le piège trouvé par la session Lozère : `ign_rge_alti_wld` rend le point le plus proche
d'une grille d'environ 5 m. La première récolte du lac et du bourg l'a pris (12 % et 42 % de
voisins égaux, des marches dans l'ombrage) : refaite au LiDAR HD (`ign_lidar_hd_mnt_mono_wld`),
l'ancienne est dans `_mauvais/`. Le monde, au pas de 10 m, n'est pas touché.

`python3 recolter-relief-aveyron.py monde lac bourg` : 1 091 requêtes.

**Le relief et le plan JOUÉS (2 octobre, version 2 du lieu).** `monde.js` prend la zone
jouable dans l'emprise du relief « fin » : avec `relief-aveyron-lac.json`, Saint-Symphorien
restait hors du jeu. `fondre-relief-aveyron.py` fond le bourg (LiDAR 2 m), le lac (LiDAR 5 m),
le monde (10 m) et les environs (50 m) en **une grille de 5 m** de -525 à 4 200 en x et de -730
à 625 en z (`relief-aveyron-jeu.json`, 946 × 272 nœuds, 1,7 Mo). Il y creuse la **sécheresse** :
le LiDAR voit la surface du lac (702,9 m) ; on y creuse une cuvette (pente 1/8, 9 m au plus) et
l'eau ne reste que là où elle a plus de 4 m de fond — 10,1 ha sur 17,4. `aveyron-jeu.json` est
`aveyron.json` pendant la sécheresse : le contour d'étiage à la place du lac, les ruisseaux à
sec (`eau.lits`), le lac plein gardé pour la grève (`eau.lacPlein`). `aveyron.json` ne change pas.

**Les environs, pour le Dormeur (2 octobre).** Le monde est un plateau doux (698 à 826 m) :
aucune falaise pour le géant couché. `python3 recolter-relief-aveyron.py environs` récolte
14 × 12 km autour du lac au pas de 50 m (339 requêtes, `relief-aveyron-environs.json`, de 279
à 947 m) : une vallée profonde longe le lac au nord-ouest, à 400 m sous le plateau —
probablement la Truyère, en contrebas de Montézic (à confirmer). `apercu-aveyron.py` en tire
`aveyron-environs.png` : les pentes de plus de 33° et deux candidats. **Eugène a choisi A**
(2 octobre) : le Dormeur est posé sur le mur de l'ouest dans `aveyron.json`, hors des extraits OSM.

| candidat | x, z | lat, lon | ce que c'est |
|---|---|---|---|
| **A — le mur de l'ouest** | -2 592, -501 | 44,7377 N ; 2,6480 E | un mur nord-sud de 1,1 km, de 300 à 700 m (400 m de haut sur 900 m), 2,6 km à l'ouest du lac : un géant couché qu'on voit depuis le fond de la vallée |
| **B — l'escarpement du nord** | 562, -3 174 | 44,7617 N ; 2,6879 E | 1,7 km de long, 235 m de haut, 3,2 km au nord du lac | Ensuite,
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
| `apercu-pouilles.py` | `pouilles-apercu.svg` et `.png` : les trois villes l'une sous l'autre, **à la même échelle** (0,71 px/m depuis que Gallipoli fait 3,2 km) |
| `recolter-relief-pouilles.py` | le relief Copernicus, voir plus bas |

| ville | origine (+) | cadre | contenu | la gare |
|---|---|---|---|---|
| **Matera** | la Civita : la cathédrale, entre les deux Sassi | 2 010 × 2 092 m : deux extraits fondus | 2 161 bâtiments, 396 escaliers, 235 murs, 37 falaises, la Gravina (un « drain » pour OSM, gardé comme torrent) ; 121 lieux : 33 églises et 7 églises rupestres, 28 places, 26 belvédères, le château Tramontano, les **deux Sassi** (Barisano et Caveoso) | **Matera Centrale** (x -850, z 56), souterraine : la ligne Bari–Matera (voie étroite) y arrive en tunnel ; Matera Sud aussi |
| **Alberobello** | le Rione Monti : barycentre de ses 96 trulli (OSM ne nomme pas le rione) | 1 974 × 1 305 m | 2 882 bâtiments dont **472 trulli** (`k: trullo`) ; 24 lieux : la basilique des Saints-Côme-et-Damien, Sant'Antonio, Santa Lucia, 9 places, 7 belvédères | **Alberobello** (x 491, z -560), ligne Bari–Tarente, 2 quais |
| **Gallipoli** | le barycentre de l'île de la vieille ville | 3 202 × 1 365 m : deux extraits fondus (l'enveloppe ; 40 m d'écart de latitude aux coins) | la **mer** (la côte OSM refermée sur sa gauche en terre ferme, `cote.terre`), 3 îles, 3 récifs, les remparts (`enceinte`), 967 bâtiments (dans la vieille ville, souvent des îlots entiers), 22 jetées et ponts ; 51 lieux : 15 églises, le château angevin, Portaterra, la fontaine grecque, 8 ports, les deux « seni » | **Gallipoli** (x 1 020, z -219), dans le cadre depuis le second extrait, avec 4 quais ; l'arrêt « Gallipoli Via Salento » au sud-est. Le dernier tronçon de la voie, désaffecté (`desaffectee`), passe le viaduc jusqu'au pied de l'île |

### Ce qui manque

- **Barletta et Castel del Monte ne font pas partie du monde** (Eugène, 2 octobre : « nous
  n'y avons jamais été »). Le Colosse, inspiré de la statue de Barletta, et le « château à
  huit tours » de `STORY.md` restent à loger dans les trois villes — une décision de récit.
- **Matera** : le premier extrait s'arrêtait au pied de la cathédrale ; « map (13) »
  (2 octobre) ramène le Sasso Barisano. Les deux envoyés avant (« map (10) » et « (11) »,
  40,672–40,691 N ; 16,566–16,598 E) tombaient sur les quartiers modernes du nord-ouest
  (Spine Bianche, Villa Longo, Serra Rifusa) : laissés de côté, pas copiés ici.
- À Alberobello, le **Rione Monti** et l'**Aia Piccola** n'existent pas comme lieux dans OSM ;
  le Rione Monti est posé à l'origine, `propose: true`.

### Le relief (Copernicus GLO-30, récolté le 1er octobre)

L'IGN ne couvre pas l'Italie. Ce Mac lit le GeoTIFF sans rien installer : le Python
d'anaconda (`python3`) a `tifffile`, `imagecodecs` et `numpy` (pas de GDAL). Deux sources :

| source | pas | accès | fichiers |
|---|---|---|---|
| **Copernicus GLO-30** (ESA) — proposée | 30 m | public, sans compte (seau AWS ouvert) | `Copernicus_DSM_COG_10_N40_00_E016_00_DEM.tif` (37,6 Mo, Matera) et `…_N40_00_E017_00_DEM.tif` (21,6 Mo, Alberobello et Gallipoli), `…_N40_00_E018_00_DEM.tif` (10,0 Mo, l'est de Gallipoli, 2 octobre) : **69 Mo** |
| TINITALY (INGV) | 10 m | formulaire d'inscription — **c'est Eugène qui le remplit** | tuiles en UTM ; le script ne sait pas encore les reprojeter |

GLO-30 est un modèle de **surface** : les toits et les arbres y sont, lissés à 30 m. Pour la
Gravina (100 m de profondeur) ou la pente de l'île, c'est sans conséquence ; pour poser une
maison au mètre près, TINITALY serait meilleur.

`recolter-relief-pouilles.py --telecharger` (après l'accord) range les tuiles dans
`copernicus/` (ignoré par git), puis écrit `relief-pouilles-<ville>.json` au pas de 10 m,
aux nœuds de la grille de chaque ville (interpolation bilinéaire, même format que la
Lozère). Sans `--telecharger`, il ne télécharge rien et dit ce qui manque.

Eugène a donné son accord le 1er octobre ; les deux tuiles sont dans `copernicus/`, et le
résultat est le suivant :

| fichier | nœuds (pas de 10 m) | altitudes |
|---|---|---|
| `relief-pouilles-matera.json` | 214 × 223 | 243 à 448 m — la Gravina, 200 m sous la Murgia |
| `relief-pouilles-alberobello.json` | 210 × 143 | 376 à 446 m |
| `relief-pouilles-gallipoli.json` | 333 × 150 | -2 à 43 m (18° E passe dans la ville neuve : deux tuiles, cousues au bord) |

Vérifié sur l'aperçu : à Matera, le versant sombre de la Gravina court au pied des Sassi,
juste à l'ouest du torrent d'OSM ; à Gallipoli, la bosse de l'île tombe sur l'île. Le plan
et le relief sont dans le même repère.

## La Thaïlande : une baie, cinq morceaux (2 octobre)

Eugène : « on va faire un mélange de tout cela ». Les cinq extraits sont DÉPLACÉS dans une baie
inventée de 5,8 × 3,8 km (`repere_thailande.py` : une origine et un décalage par morceau),
pour qu'on voie les îles les unes depuis les autres (SCENARIO.md § 12). Ko Panyi au centre
(le marché flottant, la porte de l'île), Khao Phing Kan au sud-ouest, le Wat Tham Suea au
nord-est (le grand piton du Yak), Railay au sud, Phi Phi au sud-est.

| fichier | rôle |
|---|---|
| `extraire-thailande.py` | les cinq OSM → `thailande.json` (chaque élément porte `m`, son morceau) |
| `recolter-relief-thailande.py` | Copernicus GLO-30 (3 tuiles, 85 Mo, dans `copernicus/`, non versionnées) → `relief-thailande.json`, RETOUCHÉ : pitons dessinés à Ko Panyi et Khao Phing Kan (Copernicus ne les voit pas), falaises redressées à Railay et Phi Phi, colline du Wat Tham Suea ×3,2, terre-pleins sous les bâtiments en pente, passerelles de Ko Panyi à 1,2 m |

Le jeu : `thailande.html` / `thailande.js` (sur `monde.js`), par la porte des Îles de l'île du temps.
