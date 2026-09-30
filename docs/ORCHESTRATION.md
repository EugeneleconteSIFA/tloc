# Orchestration — plusieurs sessions Claude sur le même dépôt

## Le problème, nommé

Nous sommes plusieurs sessions à travailler en parallèle, sans verrou, en
lecture-modification-écriture. Deux écritures qui se croisent perdent du travail pour de
bon. **`game.js` faisait 3 055 lignes et contenait tout** : le tracé de la citadelle, le
village, la campagne, les quêtes, les dialogues, la minimap, les cinématiques. Chaque
session devait y écrire, donc chaque session marchait sur les autres — c'est arrivé trois
fois en une soirée.

Un règlement de bonne conduite n'y aurait rien changé. **Ce qui sépare vraiment deux
sessions, c'est un fichier.** L'orchestration a donc commencé par un découpage en modules.

## Le découpage — FAIT

`game.js` est passé de 3 055 à 88 lignes : il ne fait plus qu'assembler. Chaque module a
un propriétaire, et c'est le fichier — pas un règlement — qui sépare les sessions.

| Module | Lignes | Contenu | Secteur |
|---|---:|---|---|
| `carte.js` | 594 | **source de vérité géométrique** : tracé OSM de la citadelle, relief de la plaine, distances signées, zones, exclusions, repères du monde | Carte |
| `citadelle.js` | 508 | courtines, bastions, Porte Royale, casernes, galeries voûtées, donjon, poterne — et l'orchestration de la construction | Citadelle |
| `village.js` | 950 | bourg flamand, enceinte et Porte des Flandres, estaminet, place et marché, abords, faubourg | Village |
| `campagne.js` | 264 | maison de Camille, chaumière du mage, moulin et champs, route du pont | Campagne |
| `nature.js` | 261 | végétation, herbe, buissons, nuages, montagnes | Nature |
| `quetes.js` | 210 | peuplement, dialogues, journal, objectifs, cinématiques, boucle de niveau | Quêtes |
| `hud.js` | 75 | minimap, compteurs, menu titre | Quêtes |
| `menuiserie.js` | 256 | portes, volets, toiles rayées, enseignes, paravents — **bien commun** | partagé |
| `banque.js` | 71 | tout ce qui dépend de la présence de `assets_back/` | partagé |
| `etat.js` | 23 | les quelques références qui traversent une frontière de secteur | partagé |
| `game.js` | 88 | assemblage : imports, animation, objet `level`, `bootLevel` | — |

Inchangés : `engine.js`, `foret.js`, `geants.js`, `pnj.js`, `locomotion.js`, `assets.js`,
`cave.js`, `house.js`, `tavern.js`, `mage.js`, `chapelle.js`.

Deux primitives ont été remontées dans `engine.js` : `mergeParts` (fusion de géométries)
et `uvMeters` (UV en mètres réels).

## Le contrat entre modules

Trois règles, et elles suffisent.

1. **Un fichier a un seul propriétaire.** On n'écrit jamais dans le fichier d'un autre.
   Si tu as besoin d'un changement chez lui, tu le lui demandes — tu ne l'écris pas.
2. **Les modules ne se parlent que par leurs exports.** Pas de variable globale partagée,
   pas de `window.quelquechose`. Ce qui doit circuler passe par `carte.js`, qui est la
   source de vérité géométrique : `sdCitadelle(x,z)`, `hauteur(x,z)`, `zone(x,z)`,
   `bastions`, `courtines`, `PORTE`, `libreNature(x,z,marge)`.
3. **`engine.js` est un bien commun.** On n'y ajoute que des primitives réutilisables
   (géométrie, matériaux, collisions), jamais du contenu de niveau. Toute modification
   d'`engine.js` est annoncée aux autres sessions avant d'être écrite.

## Conventions, valables partout

- **Une unité = un mètre.** La carte est au 1:1 réel depuis la bascule `ECH = 4,5`.
  Le pentagone fait ~700 m de pointe à pointe, les courtines 129 à 173 m.
- **Origine au centre de la citadelle**, x = est, z = sud. La Porte Royale est au sud
  (+z), à z ≈ 174. Le village est au sud-est, la maison de Camille au sud-ouest.
- **Les élévations ne sont pas à l'échelle du plan** : elles étaient déjà réalistes
  (escarpe 8 m, terre-plein de bastion 3 m). On ne les multiplie pas.
- **Toute coordonnée en dur est suspecte.** Une position écrite à l'ancienne échelle
  atterrit au centre de la carte.
- **Piège avéré** : plusieurs fonctions déclarent un `E` local (un `THREE.Euler` de
  travail) qui masque `import * as E from './engine.js'`. Un `E.machin()` à l'intérieur
  lève « Cannot access 'E' before initialization » et casse tout le chargement, sans
  erreur de syntaxe pour prévenir. Passer par un alias défini en tête de fichier.

## Méthode de travail commune

- **Écrire par remplacement de chaîne exact**, jamais par réécriture complète du fichier.
  Relire le fichier juste avant d'écrire.
- **Vérifier que ça charge** avant de rendre la main : le jeu doit atteindre
  « collisions indexées » et « statiques fusionnés » dans la console, sans `PAGEERROR`.
  Une erreur de syntaxe se voit ; une erreur de portée ne se voit qu'à l'exécution.
- **Annoncer ce qu'on a touché** en fin de tour, fichier par fichier.

## Trois pièges déjà payés

Aucun des trois ne produit d'erreur de syntaxe. Ils ne se voient qu'au chargement.

1. **Un `E` local.** Plusieurs fonctions déclarent `const E = new THREE.Euler()`, qui
   masque `import * as E from './engine.js'`. Un `E.machin()` à l'intérieur lève
   « Cannot access 'E' before initialization » et casse tout le chargement.
2. **Un `S` local.** Idem avec `const S = new THREE.Vector3()` et le facteur d'échelle du
   village. C'est pour ça que l'état partagé s'appelle `PARTAGE` et pas `S`.
3. **La version du moteur dans l'URL d'import.** `./engine.js?v=22` et `./engine.js?v=27`
   sont pour le navigateur **deux modules différents** : deux scènes, deux mondes de
   collision, et la moitié du décor qui n'apparaît jamais. Quand on bump la version, on la
   bump PARTOUT dans le même mouvement.

## Vérifier avant de rendre la main

Le jeu doit atteindre, dans la console et sans `PAGEERROR` :

```
tracé réel de la citadelle : 36 points, 5 bastions
collisions indexées : {capsules: ~61000, ...}
statiques fusionnés : {merged: 167, ...}
```

et le voile de chargement doit disparaître. Une erreur de portée ne se voit pas autrement.

---

## Secteur Carte — ce qui a été livré (point 7)

`BRIEF-CARTE.md` décrit les nouveaux exports de `carte.js` et **remplace toute copie
locale** de ces géométries dans les autres modules :

- le fossé aux cotes relevées (`MOAT_IN`, `MOAT_OUT`) et la constante `GLACIS` ;
- `DEHORS` — les 11 ouvrages avancés, avec `dehorsAt`, `dehorsMorceaux`, `terrassesDehors` ;
- `LILLE` — Deûle, canaux, bois, parcs et jardins relevés, avec `eauAt`, `boisAt`,
  `sousBois`, `sdPoly`, `offsetPoly`, `clipHalf` ;
- trois relevés réels écartés par des lieux inventés du jeu, listés en fin de brief :
  c'est la dernière marche vers le « mapping 100 % as is ».
