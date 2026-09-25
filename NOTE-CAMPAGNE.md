# Note du secteur Campagne — la route du pont au village

Écrit par la session **Campagne**. Un seul fichier touché : **`campagne.js`** (264 → 1 260 lignes).
Aucun autre fichier du dépôt n'a été modifié. Deux demandes aux secteurs Carte et Nature
sont en fin de note : **elles ne sont pas décoratives, elles coupent la route en deux.**

## Ce qui a été fait

Le trajet est désormais tenu par un **repère curviligne** : la courbe de `roadPts()` est
échantillonnée une fois, et tout se place en couple (abscisse le long de la route, décalage
latéral), posé sur `solPlaine(x, z)`. Aucune coordonnée de ce secteur n'est écrite en dur.
Si la route bouge, le décor la suit ; si elle change de longueur, la répartition suit aussi,
parce que tout est exprimé en fractions du trajet praticable.

- **Chaussée** refaite en un seul ruban bombé, avec ses deux ornières creusées dans le profil
  et teintées par couleur de sommet, flaques comprises. Elle remplace 36 quads posés à plat.
- **Fossé et talus** des deux côtés (profil en travers complet), eau dormante sur les longs
  tronçons, **ponceaux** de grès aux entrées de champ.
- **Haie d'aubépine** sur le talus : quads croisés instanciés (une seule `InstancedMesh`,
  texture générée), **trognes de saule** tous les 11 à 17 m, **barrière à claire-voie** de
  chêne dans chaque brèche.
- **Bornes** de grès tous les huitièmes du trajet, alternées, plus une **borne royale**
  à mi-chemin. (Les anciennes « bornes » se plantaient à `x + 3,9` — donc au milieu de la
  chaussée dès que la route partait vers l'est.)
- **Croix de chemin** : emmarchement, dé, fût, croix de fer forgé, banc de pierre.
- **Poteau indicateur** au sortir du pont.
- **Mare, lavoir, abreuvoir et bac** : bassin de grès sous un toit de tuiles sur quatre
  chênes, pierre à battre inclinée, linge qui sèche, barque à fond plat tirée au sec.
- **Pâture close** : muret de brique sur soubassement de grès, barrière, râtelier, auge,
  claies, tas de fumier.
- **Hameau des Wattines** : deux chaumines (chaume et torchis / tuiles et chaux), une grange
  à porte charretière, le four banal, le pigeonnier sur poteaux, le puits à balancier,
  l'oratoire, le tombereau, le tas de bois. Les cheminées fument : leur souche monte à
  7,25 m, hauteur à laquelle l'animation de fumée du niveau (`HOUSE_SMOKE_TOP`) remet les
  bouffées — elle se réutilise donc telle quelle.

Deux bogues corrigés au passage, tous deux dans `campagne.js` :

1. **Les trois meules du moulin** étaient écrites en coordonnées absolues de l'ancienne
   carte : depuis la bascule 1:1 elles atterrissaient à 400 m du moulin, en plein bois.
   Elles se rapportent maintenant à `FERME`, comme les champs.
2. **Une seule parcelle de blé sur quatre** suivait les paliers de qualité
   (`perf.wheat` ne retient qu'un mesh, et `perf.wheatFull` recevait le compte de la
   dernière parcelle). Les quatre sont maintenant pilotées par un `Q.hooks` local.

## La contrainte qui a commandé tout le reste

`buildCountryside()` passe **après** `buildVegetation()`. Les arbres sont donc déjà plantés
quand ce secteur construit, partout où `libreNature` est vraie — c'est-à-dire partout sauf
un couloir de 7 m de part et d'autre de l'axe. On ne peut ni les déplacer, ni les prévoir.

Plutôt que d'écrire des adresses qui seraient fausses à la prochaine passe de végétation,
le module **relève les capsules déjà posées** et **cherche** ses emplacements : le hameau,
la pâture et le lavoir vont se loger dans la première poche assez large que les arbres ont
laissée, et le muret saute les tronçons qu'un tronc occupe. Si aucune poche n'existe, un
avertissement le dit dans la console plutôt que de poser un bâtiment dans un arbre.

Conséquence pour le secteur Nature : **densifier la forêt ne cassera rien ici**, la campagne
se réarrangera toute seule. C'était le but.

## Deux demandes — la route est coupée en deux

`buildRoute()` se termine par `verifierChaussee()`, qui parcourt l'axe au mètre après que
tout est posé et publie ceci dans la console :

```
campagne : chaussée coupée sur 0–10 m (eau), 23–78 m (eau),
                               87–89 m (obstacle), 95–98 m (obstacle),
                               111–113 m (obstacle), 167–170 m (obstacle)
```

**1. Secteur Carte — les 78 premiers mètres de la route sont dans l'eau.**
`roadPts()` démarre à `APO + MOAT_OUT + 8`, ce qui était juste avant les ouvrages avancés.
Depuis qu'ils existent (11 ouvrages : 5 demi-lunes, 5 contregardes, 1 lunette), `levelBlocked`
répond « fossé » sur presque tout le premier tiers du tracé : la route sort du pont et entre
dans la douve de la demi-lune. Mesuré aussi : deux marches de ±2,6 m à 10 m et 23 m, la route
monte sur un terre-plein puis retombe. Il faut reprendre le tracé — soit en partant plus au
sud, soit en le faisant longer la contrescarpe.

En attendant, ce secteur n'aménage que la partie praticable : le bocage commence à 113 m au
lieu de 40. C'est pour ça qu'il paraît court. **La règle est automatique** : le jour où le
tracé sort de l'eau, la haie, les fossés et les bornes reprendront tout le trajet sans qu'on
touche à `campagne.js`.

**2. Secteur Nature — quatre arbres sont plantés au milieu de la chaussée.**
Aux abscisses 87–89, 95–98, 111–113 et 167–170 m, une capsule de tronc (rayon 0,58 à 0,91,
`top` infini) barre l'axe. Vérifié : ces points sont à **moins de 1,2 m** de la polyligne de
`roadPts()`, donc `nearRoad` les exclut et `libreNature` aurait dû les refuser. La cause est
probablement dans le nouveau chemin de plantation (`libreEtSec` / `marge: margePlate` passés
à `planterForet`) : un semis qui ne consulte plus `libre`. Quatre troncs suffisent à rendre
la route infranchissable — c'est le seul chemin du pont au village.

*(Note : au moment de la vérification, `nature.js` était en cours d'édition et ne chargeait
pas — `libreEtSec` et `MUR` n'y étaient pas définis. Les mesures ci-dessus ont été faites sur
une copie de test où `libreEtSec` a été remplacé par `libreNature` ; le dépôt n'a pas été
touché.)*

## Ce qui reste, et qui n'appartient pas à ce secteur

- **`hud.js` / `citadelle.js`** : `addLieu({ id: 'moulin', x: -46, z: 104 })` et le
  `P(-46, 104)` de la minimap sont restés à l'ancienne échelle (il faut `FERME.x`, `FERME.z`).
  Aucun lieu n'a été ajouté pour le hameau ni pour le lavoir : la minimap ne dessine que les
  identifiants qu'elle connaît, un lieu de plus annoncerait « nouveau lieu sur la carte »
  sans rien y faire apparaître. À ouvrir ensemble si le hameau mérite son repère.
- **`carte.js`** : `zoneName()` renvoie « Bois de Boulogne » sur tout le trajet. « Le Hameau
  des Wattines » et « Le Lavoir » mériteraient leur bandeau.

## Recette

Vérifié en Playwright, page `index.html`, sans `assets_back/` : aucun `PAGEERROR`, une seule
instance du moteur, `tracé réel de la citadelle : 36 points, 5 bastions`,
`collisions indexées : {capsules: 33975, …}`, `statiques fusionnés : {merged: 202, …}`,
voile de chargement masqué. Largeur libre moyenne de la chaussée mesurée au pas de 8 m :
**10,0 m** — la haie guide sans enfermer.

Non vérifié ici : le rendu. Les textures Poly Haven ne sont pas dans l'environnement de test,
tout y sort en blanc. À regarder sur machine réelle.
