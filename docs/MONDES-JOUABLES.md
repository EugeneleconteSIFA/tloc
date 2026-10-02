# Les mondes jouables — l'Aveyron et les Pouilles (version 1, 2 octobre)

Demandés par Eugène le 2 octobre (« lance-toi sur la création de l'Aveyron et des Pouilles »).
Bâtis par **`monde.js`**, la recette tirée du Pouget : relief fin (IGN ou Copernicus), horizon,
bâtiments d'OSM fondus en un maillage par matière (murs, toits, cônes de trulli), chemins,
eau, arbres en instances, collisions des bâtiments en grille, portes vers l'île du temps.
Chaque lieu n'est qu'une fiche : `aveyron.js`, `pouilles.js` (+ `matera.js`, `alberobello.js`,
`gallipoli.js`). `pouget.js` reste à part pour l'instant : une autre session l'améliore
(`docs/references/POUGET-PHOTOS.md`) ; on le passera à `monde.js` ensuite.

| lieu | page | depuis l'île | ce qu'il y a |
|---|---|---|---|
| le lac de Saint-Gervais (Aveyron) | `aveyron.html` | la porte du Midi | **version 2 (2 octobre)** : le lac ET le bourg de Saint-Symphorien dans une seule zone de 4,7 × 1,4 km (relief IGN fondu, `carte/mondes/fondre-relief-aveyron.py`) ; la sécheresse — le lac à l'étiage (10 ha d'eau sur 17), une grève de boue fendue, les ruisseaux en lits de cailloux, l'herbe grillée, les puits et les fontaines à sec ; les trois grandes maisons des Roquette (granit, lauzes, tour à poivrière, baies à encadrement de granit, volets à la couleur de chaque famille, porte cintrée, cour murée et puits) ; à Saint-Symphorien, le clocher, le marronnier de la place, le four banal ; les cavaliers du Batut et de Beauregard, l'aïeule du Pouget, des villageois sur la place |
| Gallipoli (Pouilles) | `gallipoli.html` | le petit train | **le cœur seulement** : la vieille ville blanche sur son île, ses remparts sur la mer, le château angevin, le port de pêche et ses barques, **le Colosse** de bronze sur son quai (figé), **Nunzia** ; la gare juste de l'autre côté du pont, sur une place chaleureuse (fontaine, orangers, café, guirlandes) |
| Matera | `matera.html` | le petit train | **le cœur seulement** : les deux Sassi en gradins sur le tuf, la Civita, le **château Tramontano** (trois tours rondes, une cour inachevée) ; la gare sur la place Vittorio Veneto |
| Alberobello | `alberobello.html` | la porte des Heures (Eugène, 2 octobre : la porte débouche dans un trullo), ou le petit train | **le cœur seulement** : le Rione Monti, ses trulli (cônes de pierre sèche en assises, pinacle blanc) ; on arrive via Monte San Michele, la porte du retour adossée au trullo ; la gare à l'est, et **Cosimo** sur le quai |
| la baie des pitons (Thaïlande) | `thailande.html` | la porte des Îles | cinq extraits fondus en une baie : Ko Panyi (village sur pilotis, platelage, ~250 maisons posées le long des passerelles d'OSM), Khao Phing Kan et Ko Tapu (tourné à la main), Railay, Phi Phi, le Wat Tham Suea en grand piton (chedi doré) ; parois de calcaire mêlées au pixel selon la pente, jungle, pluie suspendue, mer de jade ; **les passeurs** (une barque à longue queue par ponton, fondu au noir) |
| Villefort (Lozère) | `villefort.html` | pas encore (les vieux chemins) | le bourg de pierre sombre, la gare et la voie Nîmes–Clermont (ballast, rails, ponts sur piles), la rive sud du lac, le barrage ; relief recousu à 5 m (`carte/mondes/recoudre-relief-lozere.py`) |
| la Garde-Guérin (Lozère) | `garde-guerin.html` | pas encore (les vieux chemins) | le village-forteresse du plateau : la tour carrée crénelée, le château en ruine, l'église Saint-Michel et son clocher-peigne, l'enceinte ouverte à ses portes, la Régordane ; relief LiDAR à 2 m |

**Les vieux chemins** (Lozère, `lozere.js`) : à Villefort (place du Bosquet) et à la
Garde-Guérin (l'entrée nord, sur la Régordane), un poteau indicateur propose les deux autres
lieux de la Lozère, dont le Pouget. Arrivées, dans le repère de `lozere.json` (`ARRIVEES`) :
Villefort (1582, −1132), la Garde-Guérin (1852, −5236), le Pouget (52,6, −104, l'arrivée de
`pouget.js`). L'entrée côté Pouget et la porte de l'île restent à poser.

**Ce que la Thaïlande a gagné le 2 octobre au soir** : les toits thaïs à étages et les chedis du
grand piton ; **Nok et le gong** (K : six secondes de temps rendu autour de Camille — la pluie
tombe, les moines finissent leur geste et leur phrase) et l'enquête de la clé du cloître ; **le
marché flottant** de Ko Panyi (40 barques bord à bord qu'on traverse à pied, `solLieu` de
monde.js) ; **la tyrolienne** (trois câbles, la règle « on ne glisse que vers le bas » tenue par
le code). Praticabilité mesurée par `bancs/lieu-thailande.mjs` (consigne de précision).

**Les passeurs** (Thaïlande) : à chaque ponton, « parler au passeur » propose les quatre autres
îles. Vérifié en jouant (headless) : Ko Panyi → Khao Phing Kan ; chargement 3,5 à 7 s, aucune erreur.

**Le petit train** : la gare de chaque ville des Pouilles propose les deux autres (« Descendre
à Matera »…). Vérifié en jouant (headless) : île → Aveyron → île, île → Gallipoli, Gallipoli →
Matera par le train ; le 2 octobre, île → Alberobello → île par la porte des Heures ; chargement 2 à 6 s par lieu, aucune erreur. Les portes encore fermées de
l'île le disent (« La porte ne s'ouvre pas encore. »).

**Version 1, brute** : maisons sans portes ni fenêtres, murs blanchis trop tachés, toits plats
nus, cônes de trulli mal texturés au sommet, arbres de la forêt de Lille faits pour être vus de
loin, Matera dont les maisons de la falaise ont des murs démesurés. Pas encore d'habitants.

**Pouilles, version 2 (2 octobre au soir)** — `pouilles.js` habille ce que bâtit `monde.js`, par
ses crochets (`toitSur` relève chaque maison, `plus` pose le reste) : portes, fenêtres à volets
peints, appuis, escaliers extérieurs, acrotères et cheminées des toits plats, tout en instances ;
l'enduit de chaux « lavé » (la texture gardée, ses taches à moitié effacées) ; les cônes des
trulli refaits (un cône par trullo d'une emprise multiple, tenu sur son mur, pinacle de chaux).
Chaque ville réduite à **son cœur** (Eugène : « sinon la map sera beaucoup trop grande »), la
gare ramenée au bord. Les plans sont préparés par deux scripts (`carte/mondes/`) :
`gradins-pouilles.py` (le **sol nu** tiré du modèle de surface Copernicus — les toits y étaient ;
les emprises fendues là où une rue les traverse ; les emprises en pente coupées en gradins de
1,3 m de dénivelé au plus, la roche trop raide laissée nue), puis `recadrer-pouilles.py` (le
plan et le relief du cœur ; le relief entier reste en horizon). Le banc
`bancs/lieu-pouilles.mjs` mesure chaque ville : rues praticables, marche réelle jusqu'à la gare,
aux portes et aux habitants, soubassements, chevauchements, cônes, rubans de rue ; planche de
8 vues dans `bancs/resultats/`.
