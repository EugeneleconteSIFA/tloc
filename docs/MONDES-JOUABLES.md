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
| Gallipoli (Pouilles) | `gallipoli.html` | la porte des Heures | la vieille ville blanche sur son île, la mer, la gare |
| Matera | `matera.html` | le petit train | les Sassi de tuf sur la falaise, la gare de Matera Centrale |
| Alberobello | `alberobello.html` | le petit train | les maisons blanches et les 472 trulli d'OSM (cônes de pierre grise) |

**Le petit train** : la gare de chaque ville des Pouilles propose les deux autres (« Descendre
à Matera »…). Vérifié en jouant (headless) : île → Aveyron → île, île → Gallipoli, Gallipoli →
Matera par le train ; chargement 2 à 6 s par lieu, aucune erreur. Les portes encore fermées de
l'île le disent (« La porte ne s'ouvre pas encore. »).

**Version 1, brute** : maisons sans portes ni fenêtres, murs blanchis trop tachés, toits plats
nus, cônes de trulli mal texturés au sommet, arbres de la forêt de Lille faits pour être vus de
loin, Matera dont les maisons de la falaise ont des murs démesurés. Pas encore d'habitants.
