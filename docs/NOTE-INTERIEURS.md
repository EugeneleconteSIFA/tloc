# Note de passation — secteur INTÉRIEURS (`cave.js`, `tavern.js`)

Session du 20-21/09. Fichiers touchés : **`cave.js`** et **`tavern.js`**, rien d'autre.
`house.js`, `mage.js`, `chapelle.js` n'ont pas bougé (vérifiés : ils chargent toujours
sans erreur). `menuiserie.js` a été **utilisé** (porte, volets, quincaillerie) et non
modifié.

---

## 1. Les galeries (`cave.js`)

Le niveau était un couloir de brique rouge uniformément éclairé. Il est maintenant
découpé en **quatre quartiers qui ne se ressemblent pas**, parce que c'est ce qui
permet de savoir où l'on est sans regarder la minimap :

| Quartier | Parement | Couverture | Sol | Lumière |
|---|---|---|---|---|
| Galerie d'entrée | casemate chaulée | voûtes d'arêtes de brique | dalles usées | jour froid (escalier + puits) |
| Salle des rats | brique de Lille | nef à piliers, arcades surbaissées | gravier | puits de lumière + torches |
| Galerie des fosses | brique suintante | berceaux et arêtes | terre détrempée | rai sur la cage, fosses noires |
| Contre-mine | roche brute | **boisage de charpente**, plafond à 4,40 m | terre battue | noir et orange |

**Les voûtes.** Une voûte d'arêtes est l'intersection de deux berceaux : sa hauteur vaut
`sqrt(r² − max(|u|,|v|)²)`. Elle retombe sur les quatre coins de la travée et ouvre un arc
sur chacun de ses côtés — c'est ce qui fait qu'une salle voûtée ne ressemble pas à de la
tôle ondulée, ce qu'était le berceau étiré précédent. Les couloirs gardent un berceau et
leurs doubleaux ; les salles ont leurs arêtes et leurs nervures diagonales (une demi-ellipse,
pas un demi-cercle : la diagonale d'une travée carrée est surbaissée).

**Repères de parcours, tous diégétiques :**
- **les torches allumées marquent l'itinéraire, les torches mortes les impasses** ;
- un **caniveau** part du puits de lumière de l'entrée, descend le couloir est et finit
  dans un puisard, à deux pas de la vanne : suivre l'eau, c'est trouver le levier ;
- des **plaques peintes au pochoir** au refend qui sépare les deux couloirs de descente —
  `CONTRE-MINE ▼` d'un côté, `IMPASSE` de l'autre ;
- deux **puits de lumière** (évents maçonnés, grille, rai de poussière, flaque et herbes
  folles au sol) : un dans la nef, un **sur la cage du prince**, qui enveloppe la cage.
  C'est le seul endroit du niveau où le jour touche quelqu'un.

**Piège de plan corrigé :** l'itinéraire que j'avais d'abord écrit passait par le couloir
ouest (c1-c2), qui est **bouché** — le refend c3-c4 descend jusqu'au mur sud. Les torches,
le caniveau et la signalétique envoyaient donc le joueur dans l'impasse. Tout passe
maintenant par le couloir est (c5-c6). Une gaufre récompense qui explore quand même
l'impasse.

**Ambiance.** Gouttes qui tombent de la clé de voûte, onde à l'impact, flaques, brume,
poussières dans les rais ; et un **écho** — un contexte audio propre au niveau (celui du
moteur n'est pas exporté), aligné sur la touche `M` du moteur pour que « musique coupée »
coupe aussi les gouttes. Tout sous `try` : pas de son ⇒ pas d'erreur.

**Budget tenu :** 10 lumières ponctuelles (lanterne, escalier, 2 puits, 4 torches-phares,
coffre, cage), 803 meshes fusionnés en 26.

---

## 2. L'estaminet (`tavern.js`)

**L'échelle était fausse.** La salle était bâtie en unités « locales » puis agrandie ×1,3 :
comptoir à 1,43 m, tables à 1,30 m, pièce de 18 × 13 m pour une façade de 9,75 × 10,50 m.
On est repassé à **une unité = un mètre** (convention du projet) : salle 11 × 9 × 4 m,
zinc à 1,06 m, tables à 0,75 m, tabourets à 0,45 m. Le mobilier de la banque (`prop()`)
est désormais à sa taille réelle dans une pièce à sa taille réelle.

Le reste : murs **bâtis autour de leurs baies** (trumeaux, allège, linteau) au lieu de
fenêtres plaquées sur un mur plein ; la **vraie porte de `menuiserie.js`**, la même que sur
la façade (rouge 0x6e2b28) ; fenêtres à petits bois avec volets intérieurs, rideau bas,
appui, et **la maison d'en face peinte au fond de la baie** — sans elle, une fenêtre n'est
qu'un rectangle lumineux ; **rais de soleil** et poussière en suspension ; lambris d'appui
et pans de bois ; plafond à maîtresses-poutres et solives ; **âtre bâti autour du vide**
(fond suié, jouées, manteau, linteau de pierre, tablette, potence et crémaillère) avec six
langues de feu additives déphasées ; comptoir de zinc avec barre de pied en laiton, chopes
d'étain suspendues ; poêle de fonte et son tuyau ; le chat de la maison près du feu.

---

## 3. Ce que ces deux chantiers ont coûté — utile à tout le monde

1. **Une teinte sombre sur une photo sombre donne du noir.** Les albédos Poly Haven sont
   bas (gravier 0,30, `ruines_02` 0,20 en sRGB). Les teinter d'un gris moyen les multiplie
   une seconde fois : la salle était illisible à 0,95 d'hémisphérique. Le remède n'est pas
   plus de lumière, c'est un **gain au-delà de 1 sur `material.color`**
   (`m.color.setRGB(2.5, 2.45, 2.3)`), qui remonte l'albédo sans toucher à l'éclairage.
2. **Un bandeau de 46 cm ne doit pas porter une texture de 2,40 m.** Il n'en affiche que
   20 % : on obtient une traînée étirée, et au pied des murs ça faisait des triangles
   noirs. Prendre une tuile petite (1,2 m) pour les petits éléments.
3. **Les UV d'une voûte se calculent sur le DÉVELOPPÉ, pas sur la projection au sol.**
   `h·asin(x/h)` dans la direction de plus grande valeur absolue. Sinon la brique s'étire
   en traînées verticales près des reins.
4. **`patiner()` et `InstancedMesh` ne vont pas ensemble** : le shader calcule `vPatPos`
   après `begin_vertex`, donc avant que `instanceMatrix` soit appliquée — toutes les
   instances reçoivent la salissure du même point du monde. On a laissé tomber
   l'instanciation au profit de meshes simples à matériau partagé : `mergeStatics` les
   fusionne en un seul draw call **et** cuit les matrices monde, donc la patine redevient
   juste. Même coût, un piège en moins.
5. **Un métal sans carte d'environnement est noir, ou bleu.** Le zinc du comptoir à
   `metalness: 0.45` renvoyait le ciel et virait au bleu roi ; le fer des galeries était
   noir. En intérieur, `metalness ≤ 0.25` et on laisse la couleur faire le travail.
6. **Le rendu headless ment sur la lumière.** Quand la qualité auto retombe à 2 ou 3,
   `G.postFX` passe à faux et l'image devient beaucoup plus sombre (le rendu direct
   n'applique pas la même chaîne que le composer). Pour juger une ambiance en capture,
   forcer `TLOC.G.postFX = true` juste avant la photo, sinon on passe son temps à
   rattraper une obscurité qui n'existe pas en jeu.

---

## 4. Trois demandes aux autres secteurs (je ne les écris pas moi-même)

- **`village.js`** — l'entrée de l'estaminet appelle
  `goToLevel('tavern', [0, 0, 4.4], …)`. La salle fait maintenant 9 m de profondeur : 4,4
  tombe dans l'épaisseur du mur de façade. Je rentre la position dans un `onLoad()` de mon
  côté, mais le propre serait **`[0, 0, 3.4]`**.
- **`citadelle.js`** — la sortie des galeries était restée à l'ancienne échelle
  (`[22,5 ; 31]`). Je l'ai recalée sur la poterne : `[117.9, 0, 139.5]`, lacet `-π/2`,
  soit `POTERNE − 3,6 m` vers l'ouest, avec la formule en commentaire. À confirmer en jeu.
- **`engine.js`** (bien commun, rien écrit) — deux points si quelqu'un y repasse :
  `patiner()` gagnerait à lire `instanceMatrix` quand elle existe (cf. point 4) ; et
  `SFX` ne publie pas son `AudioContext`, ce qui oblige chaque niveau qui veut un son
  d'ambiance à en ouvrir un second et à réécouter la touche `M`.

---

## 5. État de la recette

Vérifié en headless (Playwright + Chromium, page servie en local) : **les cinq intérieurs
chargent sans aucune erreur JS**, le voile disparaît, `collisions indexées` et
`statiques fusionnés` passent. Galeries : 34 capsules, 10 lumières, 803 meshes → 26 après
fusion. Estaminet : 22 capsules, 849 meshes. L'itinéraire complet des galeries a été testé
dalle par dalle avec `blocked()` : rien ne coince, ni aux piliers de la nef, ni aux poteaux
de boisage, ni au puisard.

**Pas vérifiable en headless, à regarder sur machine réelle :** la tenue des rais de
lumière en mouvement (poussières et cône sont animés), le confort de la caméra sous la
clé de voûte à 4,80 m (`G.camMaxY` est bridé à 4,10), le rendu du mobilier de la banque
dans l'estaminet — `assets_back/` n'était pas monté dans mon bac d'essai, c'est donc la
**version procédurale de secours** qui a été photographiée, jamais les props Fantasy.
