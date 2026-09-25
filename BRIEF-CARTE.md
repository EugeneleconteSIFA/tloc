# BRIEF-CARTE — le relevé fait foi

**Décision d'Eugène, 21 septembre : c'est la carte OSM qui fait foi.** (Mis à jour le
24 septembre : quartier, bourg, promenade, ponts, eaux, noms de lieux — §§ 3, 6 à 10.) Un lieu inventé du
jeu n'efface plus un relevé ; c'est le lieu inventé qui déménage. Ce document décrit ce que
`carte.js` expose et ce que chaque secteur doit en faire. Rien à recopier : tout est
importable. **Ne redéfinissez aucune de ces géométries dans votre module.**

---

## 1. Le monde couvre tout l'extrait

L'extrait OSM est un rectangle de **1719 × 1180 m**, pivoté de 74,61° comme le reste du
plan, centré en (77, 185). Le monde ne s'arrête plus sur un cercle : il s'arrête là où le
relevé s'arrête.

```js
ENCEINTE     // les 4 coins du rectangle, en coordonnées de jeu
ENCEINTE_C   // [77, 185]
ENCEINTE_H   // 11 m : hauteur de la courtine urbaine
sdEnceinte(x, z)   // distance signée, négative dedans
dansEnceinte(x, z)
PLAINE_R = 1275    // était 900
MARCHE_R = 1230    // filet radial ; l'enceinte est la vraie limite
LISIERE_R0 = 1000, LISIERE_R1 = 1160
```

`levelBlocked` refuse désormais tout point hors de l'enceinte. **À faire côté Citadelle ou
Village : bâtir la muraille urbaine sur `ENCEINTE`** — une courtine de brique d'époque,
`ENCEINTE_H` de haut, qui ferme la carte. C'est ce qui remplace l'ancien mur de forêt.

La grille de relief est passée à 3 m (`RG_PAS`) et le maillage de la plaine à
230 points par côté × 165 anneaux, pour tenir le nouveau rayon sans exploser le budget.

## 2. Le fossé et les ouvrages avancés

Cotes relevées, en distance signée à l'escarpe : gorges des ouvrages à 35,6 m, saillants
des demi-lunes à 141,4 m.

```js
FOSSE_IN = 13.5,  MOAT_IN = 32,  MOAT_OUT = 148
GLACIS = 258      // MOAT_OUT + 110 : la pente rase. Rien n'y pousse, rien ne s'y bâtit.
PONT_HW = 3.6     // le pont TRAVERSE la demi-lune Royale ; plus étroit que le tablier (4 m)
                  // pour que la terre de l'ouvrage recouvre son bord
DEHORS            // 11 ouvrages : 5 demi-lunes, 5 contregardes, la Lunette du Grand Carré
dehorsAt, dehorsMorceaux, terrassesDehors, DEHORS_H
```

Chaque ouvrage porte `kind`, `nom`, `poly`, `c`, `rr`, `n`, `sdMin`, `sdMax`, `h`, `aire`.
`carte.js` n'en pose que la terre.

**À faire côté Citadelle :**
- revêtement de brique des escarpes et cordon de pierre au sommet ;
- **un escalier depuis le pont vers la demi-lune Royale** — on la traverse sans pouvoir y monter ;
- **l'eau du fossé est un miroir** (`roughness: 0.12`, `envMapIntensity: 1.2`). À 116 m de
  large elle brille comme du métal. `carte.js` exporte `eauMat()` : une matière d'eau mate,
  réglée pour une rivière. Utilisez-la, ou reprenez ses valeurs ;
- les grèves de `pentShape(MOAT_IN ± SHORE)` dessinent un liseré clair très visible depuis
  le sol. La berge des nappes de Lille est faite autrement (cf. § 3) : la couleur est dans
  le terrain, il n'y a aucune pièce rapportée, et rien ne peut clignoter.

## 3. La carte élargie

```js
LILLE.eau      // 18 nappes : Deûle, Haute-Deûle, Moyenne-Deûle, Tortue, Quai du Wault, étangs, fossé
LILLE.bois     // 20 : Bois de la Deûle, Bois de Boulogne, bosquets des ouvrages
LILLE.parcs    // 15 : Jardin Vauban, Façade de l'Esplanade, Plaine du Colysée…
LILLE.herbe    // 28 pelouses      LILLE.jardins  // 18 vergers
LILLE.routes   // 404, classées r = 1 desserte / 2 voie / 3 artère
LILLE.chemins  // 439 sentiers, allées du parc, chemins de halage
LILLE.ponts    // 33
LILLE.bati     // 1635 emprises au sol
```

Outils : `sdPoly`, `offsetPoly`, `clipHalf`, `coucheAt`, `eauAt`, `boisAt`, `sdEau`,
`sousBois`, `enVille`, `margeVille`, `rubanGeo`, `nappesLille`, `voiriesLille`.

**L'eau est du terrain.** `terrainNaturel` la creuse dans le champ de hauteur — `EAU_FOND`
= 1,9 m sous le niveau de SA nappe, berge en pente sur 22 m —, `margePlate` y coupe le
bruit de relief, la couleur de vase est dans les couleurs de sommet du maillage de la
plaine, et `levelBlocked` noie à partir du vrai trait de rive (`sdEau < -1.5`), pas au bord
du polygone. Chaque nappe a son niveau (`e.y`, médiane de ses berges) ; les nappes qui se
touchent sont nivelées ensemble.

**Un axe de canal n'est pas une surface (24 septembre).** `eau.canaux` du relevé, ce sont
les chemins OSM `waterway=canal` : des LIGNES ouvertes au milieu du chenal. Refermées en
polygone, elles dessinaient des lentilles d'eau fantôme entre le canal et sa corde (74 à
78 % de leur aire en eau ni dans OSM ni dans la BD TOPO ; 39 bâtiments et 1,8 km de rues
noyés). `construireLille` n'en garde plus que les trois qui restent sous `MOAT_OUT` : c'est
de là que le fossé de la place tient son eau, faute de surface relevée. La Deûle vient des
surfaces (`eau.plans`). **Ne réintroduisez pas les axes comme surfaces.**

**`sousBois(x, z)` rend une densité 0→1** d'après les bois relevés. C'est le crochet du
« 100 % as is » côté végétation : plantez selon `sousBois`, pas selon un rayon.

**Terrains de ville et de routes.** Une grille de 8 m marque tout ce qui est bâti ou
carrossable au relevé, une transformée de distance en donne l'éloignement, et `margePlate`
y coupe le relief : `margeVille(x, z) < 0` = terrain plat, prêt à bâtir. C'est là que le
quartier réel doit se poser.

## 4. Ce qui a déménagé, et pourquoi

| Lieu | Avant | Maintenant | Raison |
|---|---|---|---|
| `TOWN` | (207, 531), puis (455, 165) | **(200, 660)**, tourné de −162,5°, échelle 1,5 | posé DANS le quartier réel, sur un îlot, dans l'axe des rues voisines (cf. § 7) |
| `HOUSE` | (−81, 354) | **(173, 611)** | se retrouvait dans le fossé une fois celui-ci à ses vraies cotes |
| `FERME` | (−207, 468) | **(525, 80)** | était dans le Canal de la Haute-Deûle ; se serre maintenant contre le bourg |
| `CHAMPS` | ±150 m | ±55 m, vers l'est | la carte réelle ne laisse plus un seul carré de 140 m libre |
| `roadPts` | 6 points à la main | calculée | elle part du pont royal, contourne le glacis en arc et rejoint la culée du pont relevé le plus proche ; au-delà, ce sont les rues du relevé |

C'est fait : le quartier réel est bâti par `quartier.js` (§ 6), et ce qui reste du bourg
(place, marché, estaminet, beffroi, chapelle) est posé sur UN îlot du quartier (§ 7).

## 5. Deux points pour la session Forêt

- réglé : `foret.js` reçoit `libreNature` par son contexte (`ctx.libre`, passé par
  `nature.js`), qui connaît le bourg, le glacis, l'eau, les ouvrages et l'enceinte.
- la densité doit suivre `sousBois(x, z)`, pas un rayon : le parc de la Citadelle et le
  Bois de Boulogne sont relevés, ils ont une forme.

## 6. Le quartier réel — `quartier.js`

`batirQuartier()` élève les emprises de la BD TOPO (`IGN.bati`, 2 035 emprises, 1 975 avec
leur hauteur) en maisons flamandes : **1 710 bâtiments élevés, 2 954 maisons** après
découpe en parcelles (mesuré le 24 septembre). Tout est fusionné dans une géométrie par
matériau ; la variation passe par la couleur de sommet.

Ce qui est écarté, et pourquoi : abris de moins de 12 m² ; tout ce qui est à moins de
`MOAT_OUT + 10` de l'escarpe (le zoo et le parc d'aujourd'hui, pas 1670) ; les blockhaus ;
l'îlot du bourg (`TOWN_BOITE` + 3 m) ; hors enceinte ; centre à moins de 2 m de l'eau.
Les 7 emprises IGN dont le centre est dans l'eau sont toutes dans le fossé de la place :
elles sont écartées par la règle du fossé. Le relevé n'est pas modifié.

Règles à ne pas casser :
- **les collisions s'émettent depuis l'emprise d'origine**, une fois, avant la découpe en
  parcelles (`addCap`, rayon 0,45) — sinon des murs mitoyens infranchissables ;
- **le faîtage court dans le plus grand sens de la parcelle** — sinon le demi-faîtage est
  négatif, le toit se retourne ;
- hauteur plafonnée à 15,5 m hors églises et tours ; plus de toits-terrasses, plus de béton
  ni de zinc (codes MAJIC relus en brique, pierre, chaux, tuile, ardoise).

`rempartsVille()` bâtit l'enceinte urbaine sur `ENCEINTE` (courtine de 11 m, tour tous les
195 m) : c'est elle qui ferme le monde.

## 7. Le bourg — `village.js`, `TOWN`, `townWorld()`

`TOWN = { x: 200, z: 660, s: 1.5, a: −162,5° }`. L'orientation est la direction dominante
des rues relevées dans un rayon de 140 m. Les coordonnées LOCALES de `village.js` n'ont pas
changé : **tout ce qui pose un objet du bourg depuis l'extérieur passe par
`townWorld(lx, lz)`**, et l'inverse par `townLocal(x, z)`. Plus jamais `TOWN.x + x * S`.
`TOWN_BOITE` (unités locales) est l'emprise que le quartier laisse au bourg.

## 8. La promenade — `promenade.js`

- `voieDesCombattants()` : la boucle autour de la citadelle, tracée par `voieCombattants()`
  (carte.js) à `MOAT_OUT + 24` de l'escarpe, repoussée hors de l'eau et des ouvrages —
  3,46 km, terre battue de 4,20 m, ornières, alignement d'arbres, bancs vers le fossé.
  `cuireAmenage` la garde dégagée (5 m de part et d'autre).
- `entreeDuParc()` : piles, grille, lanternes et cabane, à la culée côté parc du pont
  relevé nommé « Pont de la Citadelle » (repli sur le pont large le plus proche).

## 9. Les ponts relevés — calage (24 septembre)

`preparerPonts()` se fait en deux temps : `listerPonts()` (positions, prolongement sur les
berges) peut tourner n'importe quand ; `calerPonts()` (hauteur des culées, bombement,
plateformes) attend que `RELIEF` existe. **`cuireRelief()` ne publie `RELIEF` qu'une fois
la grille pleine** : `roadPts()` appelle `preparerPonts()` pendant la cuisson, et les ponts
se calaient sur un sol plat (les deux tabliers de l'avenue Léon Jouhaux passaient six
mètres sous la chaussée).

Mesuré après correction : 10 ouvrages, dont 2 **pontons** (un bout au sec, l'autre dans
l'eau, sans voie qui les prolonge : platelage plat à 0,5 m au-dessus de l'eau, garde-corps,
pieux). Pour les 8 ponts : marche de 0,38 m aux culées, jour sous le tablier au-dessus de
l'eau de **2,31 à 6,90 m**. Résiduel : un chemin sans nom passe sous le Pont du Ramponneau,
près de la culée, avec 1,73 m de jour.

## 10. Les noms de lieux — `zoneName()`

Ordre de priorité : bastions, clairière du mage, Porte Royale, chapelle et place du bourg,
Moulin, **Le Lavoir**, **Le Hameau des Wattines**, ouvrages avancés, donjon, galeries,
place d'Armes, remparts, fossés, nappes et bois nommés, **nom de la rue relevée**
(`nomDeVoie`, grille O(1)), voie des combattants, rues de Lille, parcs, Bois de Boulogne.

Le lavoir et le hameau sont posés par `campagne.js` dans la première poche libre entre les
arbres : leur emplacement n'est connu qu'après la pose. `campagne.js` le publie dans
`PARTAGE.lavoir = { x, z, r }` et `PARTAGE.hameau = { pts, demi }` (couloir de 18 m le long
de la chaussée), que `zoneName()` lit.
