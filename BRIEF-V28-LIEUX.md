# v28 — Carte à révéler, chaumière du mage, chapelle jouable, portes, escalier

**Note de passation à la session « carte » (bascule 1:1, `ECH = 4.5`).**
Ce travail était **déjà écrit sur le disque** quand le message de coordination est arrivé :
`engine.js`, `game.js` et `tavern.js` sont modifiés, quatre fichiers sont nouveaux, et
`bump.py 27` est passé. Rien n'a été touché depuis. Ce qui suit est ce qu'il faut savoir
pour que la bascule 1:1 ne casse pas ces ajouts — **toutes les cotes citées sont à
l'ancienne échelle**.

## 1. Ce qui a changé, fichier par fichier

### `engine.js`
- `PAGES` : deux entrées de plus — `mage: 'mage.html'`, `chapelle: 'chapelle.html'`.
- `state` : `decouverts: {}`, `mageIndice`, `mageHeart`, `mageParle`. Ils partent dans
  `flags` comme les autres, le format de sauvegarde ne bouge pas. `loadGame` remet
  `decouverts` à `{}` si la sauvegarde est antérieure.
- Section **« Lieux »** (juste après `addInteract`) : `lieux`, `addLieu`, `estDecouvert`,
  `decouvrir`, et `lieuxTick()` appelé dans la boucle après `updatePlayer`.
- `suivreColimacon(dt)` + `helixSous(x, z, y)` : le repère de déplacement tournant de
  l'escalier en colimaçon (détail en §4).
- `updateCamera` : la caméra se resserre (`camBack ≤ 4.6`, `camUp ≤ 3.2`) quand
  `player.helix` est non nul.
- `window.TLOC` expose en plus `lieux, estDecouvert, decouvrir, helixSous`.

### `game.js`
- `MAGE`, `buildMaisonMage()`, l'exclusion de la clairière dans `libreNature` et
  `margePlate`, la zone nommée, l'appel dans `buildCitadel`.
- La chapelle du village, agrandie et refaite (elle reste **en unités locales du village**,
  donc elle suit `TOWN.s` toute seule) + son portail `makeDoor` et son interaction.
- `makeDoor` refaite (§3).
- Les sept `E.addLieu(...)` en fin de `buildCitadel`, et la `minimap` qui ne dessine un
  bâtiment que s'il est découvert.
- `counts()` affiche `Lieux n/8`.

### `tavern.js`
- Séraphin, le braconnier attablé (`patrons[3]`) : c'est **le seul indice du jeu** sur la
  chaumière. Il pose `state.mageIndice`.

### Nouveaux
`mage.js` / `mage.html`, `chapelle.js` / `chapelle.html`.

## 2. Les cotes à multiplier par `ECH` — et surtout celles à NE PAS multiplier

**À multiplier (coordonnées de plan) :**

| Où | Quoi |
|---|---|
| `game.js` | `const MAGE = { x: -102, z: 58, clair: 13 }` — les trois champs |
| `game.js` | `E.addLieu({ id: 'moulin', … x: -46, z: 104 … })` |
| `game.js` | les rayons `r:` des sept `addLieu` (30, 16, 22, 46, 13, 24, 15) et celui de la chapelle (26) |
| `game.js` | `minimap` : `const sc = 0.6` devient `0.6 / ECH`, et les deux `P(-46, 104)` / `P(MAGE.x + 7, MAGE.z - 6)` suivent |
| `mage.js` | `EXIT.pos = [-102.78, 0, 63.9]` — coordonnées **du niveau citadelle** |
| `chapelle.js` | `EXIT.pos = [44.5, 0, 98.5]` — idem (dérivé de `TOWN + local × 1,5`) |

`MAGE.clair` est le rayon de la clairière : `libreNature` y interdit les arbres,
`margePlate` y aplanit le sol et écarte les buttes. Multiplié par 4,5 il ferait une
clairière de 58 m de rayon pour une maison de 9 m — il faut sans doute le garder autour de
15-20 m plutôt que de le multiplier bêtement, et la chaumière n'aura alors plus l'air
perdue dans une plaine.

**À ne PAS multiplier (cotes de bâtiment, déjà en mètres réels) :**
- tout l'intérieur de `buildMaisonMage()` : `LW = 9.4`, `LD = 7.6`, `HW = 3.4`, et toutes
  les positions locales passées à `W2m(...)` (puits, tas de bûches, potager, menhir…) ;
- toute la chapelle intérieure (`chapelle.js`) et toute la chaumière intérieure
  (`mage.js`) : ces niveaux sont bâtis en mètres monde, sans facteur d'échelle ;
- les positions passées à `goToLevel('mage', [1.4, 0, 2.9], …)` et
  `goToLevel('chapelle', [-1.5, 0, 9.0], …)` : ce sont des coordonnées **du niveau
  d'arrivée**, pas du plan de la citadelle.

**Cohérence à tenir :** la nef extérieure fait 9 × 14 × 6,4 en unités du village (×1,5 =
13,5 × 21 × 9,6 m) et `chapelle.js` bâtit exactement 12,4 × 19,9 m dedans. Même règle pour
la chaumière : 9,4 × 7,6 hors tout dehors → 9,0 × 7,2 dedans. Si la bascule 1:1 change la
taille du village, il faut reporter la cote dans le niveau intérieur, sinon on retombe sur
le défaut que ce chantier venait corriger (une pièce plus grande que la maison).

## 3. Portes — `makeDoor` dans `game.js`

Deux vrais défauts corrigés, en plus du décor :
- **les gonds étaient du côté de la poignée** et la poignée du côté des gonds ;
- **la quincaillerie vivait dans le dormant** : une porte ouverte (le donjon) laissait son
  heurtoir flotter en l'air au milieu de l'embrasure.

Tout ce qui appartient au battant est désormais dans le groupe pivot. Ajouté : chant et
tranche haute, panneaux sur les deux faces (une porte ouverte montre son dos), barres et
écharpe au revers des portes rustiques, plinthe de bas de porte, poignée de tirage au
revers, filet d'ombre au fond de l'embrasure, cale de pierre et piton pour les portes
maintenues ouvertes. Nouvelles options : `sansCale`. Le fond des panneaux est peint un ton
au-dessus et le chant un ton en dessous, sinon une porte peinte reste une planche unie.

## 4. Escalier en colimaçon — le vrai sujet

Le reproche était : « c'est un enfer d'avancer quand on fait des tours et des tours ».
Cause : `p.moveBasis` est figée au moment où l'on pousse la touche, donc « tout droit »
envoie Camille dans la colonne centrale et il faut relâcher/rappuyer à chaque quart de
tour. `suivreColimacon(dt)` fait tourner la base **et** la caméra du même angle que celui
parcouru autour de l'axe de l'hélice.

Deux pièges rencontrés, tous deux mesurés :
1. **Le signe.** Une direction `(dx, dz)` a pour lacet `atan2(dx, dz)`, un point à l'angle
   `a = atan2(dz, dx)` a pour tangente le lacet `-a` : le lacet **décroît** quand l'angle
   croît. Avec `+d`, Camille part vers l'extérieur et se colle au garde-corps au tiers du
   premier tour.
2. **La dérive.** Le repère tourne *après* le pas, donc chaque pas part un poil vers
   l'extérieur et l'erreur s'accumule — collé à la rambarde aux deux tiers du tour. D'où le
   recentrage doux, actif seulement hors de la bande centrale des marches (±45 % de la
   demi-largeur), à 1,2 m/s au plus : on peut toujours longer la colonne ou la rambarde.

**Recette, mesurée** (Playwright, `updatePlayer(0.025)` pas à pas, une seule pression sur
Z jamais relâchée, 400 images — le rendu headless est à moins d'une image par seconde,
inutile d'essayer en temps réel) : montée de **0,15 m à 16,10 m, soit 3,54 tours**, à
vitesse rigoureusement constante (3,15 m par tranche de 80 images). Avant correction :
0,42 m, c'est-à-dire une marche.

## 5. Découverte des lieux

Choix d'Eugène : **carte à révéler pour tous les lieux**. Le terrain — douves, glacis,
remparts, bastions, allée — reste toujours dessiné, c'est le repère ; seuls les
**bâtiments** apparaissent, une fois approchés. Huit lieux : donjon, poterne, maison de
Camille, village, estaminet, moulin, chapelle, chaumière du mage.

La chaumière est le seul lieu que rien n'indique. Séraphin, à l'estaminet, pose
`state.mageIndice` : la minimap affiche alors un cercle pointillé jaune avec un « ? » sur
une **zone** (décalée de 7 m), pas une adresse. C'est seulement en entrant dans la
clairière que la maison prend sa place sur la carte.

Vérifié : `lieuxAPortee` correct au point d'essai, `decouvrir` persiste bien dans
`flags.decouverts` de `tloc_save_v2`.

## 6. État de la recette

Les six pages (`index`, `cave`, `house`, `tavern`, `mage`, `chapelle`) chargent et
démarrent sans **aucune** erreur JS, une seule instance du moteur, `window.TLOC` présent
partout. Ce qui n'a **pas** pu être vérifié headless (moins d'une image par seconde) et
reste à regarder sur machine réelle : le rendu des vitraux, les rais de lumière colorée de
la nef, la lisibilité de la clairière depuis le sous-bois, et le confort réel de la caméra
resserrée dans la cage d'escalier.

---

## 7. État constaté après votre bascule 1:1 (relu à 19h20)

Bonne nouvelle : vous avez lu ma version, rien n'est perdu. `ECH` est en place et vous avez
déjà traité `MAGE` (`{ x: -102 * ECH, z: 58 * ECH, clair: 13 * 2.5 }` — le choix de ne pas
multiplier la clairière par 4,5 est le bon) et `minimap` (`sc = 0.6 / ECH`).

**Restent à traiter dans `game.js`, je n'y ai pas touché :**

1. `E.addLieu({ id: 'moulin', … x: -46, z: 104 … })` — les deux coordonnées sont restées à
   l'ancienne échelle. À passer en `-46 * ECH, 104 * ECH`, ou mieux, à faire dériver de la
   constante du moulin si vous en créez une (il est encore écrit en dur dans
   `buildCountryside` et dans la `minimap`).
2. Les rayons `r:` des huit `addLieu` (30, 16, 22, 46, 13, 24, 15, 26). Ce sont des rayons
   de plan : à `ECH = 4.5`, un rayon de découverte de 30 m autour du donjon se déclenche
   quasiment dessus. Sans les multiplier, la carte ne se révélera presque plus.
3. Dans la `minimap`, le `P(-46, 104)` du moulin et le `P(MAGE.x + 7, MAGE.z - 6)` du
   cercle d'indice : le décalage de 7 m qui servait à ne pas donner l'adresse exacte est
   devenu invisible à la nouvelle échelle, il faut le reprendre (30-40 m).

**Ce que j'ai recalé moi-même** (constantes d'une ligne, hors `game.js` / `engine.js`) : la
sortie des **quatre** intérieurs. Elles pointaient toutes à l'ancienne échelle depuis la
bascule — `house.js` et `tavern.js` compris, qui ne sont pas de mon chantier mais qui
renvoyaient Camille à 400 m du village. Chaque constante porte maintenant en commentaire la
formule qui la produit.

**Proposition, à faire quand la bascule sera figée :** ces quatre constantes sont fragiles
par construction, elles redeviendront fausses au prochain changement d'échelle. Le remède
tient en deux lignes : que chaque interaction d'entrée de `game.js` pose la position réelle
de Camille dans `sessionStorage` (`tloc_dehors`) avant d'appeler `goToLevel`, et que chaque
niveau intérieur la relise pour sa sortie, avec la constante en repli. Plus aucune
coordonnée du plan ne serait alors écrite en dur dans un niveau intérieur. Je peux le faire
dès que vous me rendez la main sur `game.js`.
