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
| le lac de Saint-Gervais (Aveyron) | `aveyron.html` | la porte du Midi | le lac, le relief IGN, la sécheresse, le soleil au zénith ; les trois grandes maisons des Roquette (le Batut, Beauregard, le Pouget), une tour à poivrière chacune |
| Gallipoli (Pouilles) | `gallipoli.html` | le petit train | la vieille ville blanche sur son île, la mer, la gare |
| Matera | `matera.html` | le petit train | les Sassi de tuf sur la falaise, la gare de Matera Centrale |
| Alberobello | `alberobello.html` | la porte des Heures (Eugène, 2 octobre : la porte débouche dans un trullo), ou le petit train | les maisons blanches et les 472 trulli d'OSM (cônes de pierre grise) ; on arrive via Monte San Michele, la porte du retour adossée au trullo |
| la baie des pitons (Thaïlande) | `thailande.html` | la porte des Îles | cinq extraits fondus en une baie : Ko Panyi (village sur pilotis, platelage, ~250 maisons posées le long des passerelles d'OSM), Khao Phing Kan et Ko Tapu (tourné à la main), Railay, Phi Phi, le Wat Tham Suea en grand piton (chedi doré) ; parois de calcaire mêlées au pixel selon la pente, jungle, pluie suspendue, mer de jade ; **les passeurs** (une barque à longue queue par ponton, fondu au noir) |

**Les passeurs** (Thaïlande) : à chaque ponton, « parler au passeur » propose les quatre autres
îles. Vérifié en jouant (headless) : Ko Panyi → Khao Phing Kan ; chargement 3,5 à 7 s, aucune erreur.

**Le petit train** : la gare de chaque ville des Pouilles propose les deux autres (« Descendre
à Matera »…). Vérifié en jouant (headless) : île → Aveyron → île, île → Gallipoli, Gallipoli →
Matera par le train ; le 2 octobre, île → Alberobello → île par la porte des Heures ; chargement 2 à 6 s par lieu, aucune erreur. Les portes encore fermées de
l'île le disent (« La porte ne s'ouvre pas encore. »).

**Version 1, brute** : maisons sans portes ni fenêtres, murs blanchis trop tachés, toits plats
nus, cônes de trulli mal texturés au sommet, arbres de la forêt de Lille faits pour être vus de
loin, Matera dont les maisons de la falaise ont des murs démesurés. Pas encore d'habitants.
