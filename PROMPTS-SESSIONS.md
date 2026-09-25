# Prompts à lancer — un par session Claude

Six secteurs à ouvrir. Le septième (Carte) est tenu par la session qui a écrit ce fichier.
Chaque prompt est autonome : il suffit de le coller dans une nouvelle conversation ayant
accès au dossier `~/Documents/GitHub/the_legend_of_camille`.

**Commun à tous** — c'est déjà dans `ORCHESTRATION.md`, mais ça vaut d'être répété : on
n'écrit que dans les fichiers de son secteur, on relit un fichier juste avant d'y écrire,
on fait des remplacements de chaîne exacts et jamais de réécriture complète, et on vérifie
que le jeu charge avant de rendre la main.

---

## 1 — Secteur CITADELLE

> Tu prends le secteur **Citadelle** du jeu *The Legend of Camille*
> (`~/Documents/GitHub/the_legend_of_camille`). **Lis d'abord `ORCHESTRATION.md`**, puis
> `carte/README.md` et `BRIEF-DESIGN.md`.
>
> **Ton fichier : `citadelle.js`.** Tu ne touches à aucun autre — si tu as besoin d'un
> changement ailleurs, tu le décris au lieu de l'écrire.
>
> La citadelle vient de passer au **1:1 réel** sur le relevé OpenStreetMap : le pentagone
> fait 700 m de pointe à pointe, les courtines 129 à 173 m, et le tracé des cinq bastions
> est le vrai. Conséquence : **l'intérieur est vide**. La place d'Armes est un champ de
> plusieurs hectares avec un donjon au milieu.
>
> Dans l'ordre : (1) bâtir les **casernes** d'après `carte/citadelle.json` — la clé
> `casernes` contient les 38 emprises au sol réelles, en mètres, dans le repère du jeu ;
> (2) rendre la place d'Armes crédible à cette échelle — pavage, esplanade de manœuvre,
> alignements d'arbres, puits, corps de garde ; (3) reprendre les galeries voûtées, qui
> ont été dimensionnées pour un pentagone quatre fois et demie plus petit.
>
> La patine des matériaux existe déjà : `patinerMat()` (exporté par `carte.js`) injecte
> salissure à grande échelle, humidité de pied de mur, mousse et coulures. Sers-t'en.

---

## 2 — Secteur VILLAGE

> Tu prends le secteur **Village** du jeu *The Legend of Camille*
> (`~/Documents/GitHub/the_legend_of_camille`). **Lis d'abord `ORCHESTRATION.md`**, puis
> `BRIEF-DESIGN.md` — en particulier la règle 1 : l'identité flamande prime sur la qualité
> d'un asset, l'architecture du bourg reste procédurale.
>
> **Ton fichier : `village.js`.** Tu ne touches à aucun autre.
>
> Le bourg est fortifié depuis peu : muraille de brique, Porte des Flandres, chemin de
> ronde extérieur, potagers, verger, faubourg hors les murs. L'estaminet s'ouvre enfin.
> Ce qui manque maintenant, c'est la **vie** : des commerces distincts les uns des autres
> (boulanger, brasseur, drapier, forge), des enseignes qui disent quelque chose, du linge,
> des tas, des traces d'usage. Et une place de marché qui ressemble à un marché.
>
> Attention à l'échelle : le groupe `town` est agrandi ×1,5. Toute taille de matériau se
> compte en mètres MONDE, donc ×1,5 — c'est une erreur qui a déjà coûté une brique une
> fois et demie trop grosse sur tout le village.

---

## 3 — Secteur CAMPAGNE

> Tu prends le secteur **Campagne** du jeu *The Legend of Camille*
> (`~/Documents/GitHub/the_legend_of_camille`). **Lis d'abord `ORCHESTRATION.md`.**
>
> **Ton fichier : `campagne.js`.** Tu ne touches à aucun autre.
>
> La carte vient de passer au **1:1 réel**. Tes repères ont été déplacés en conséquence —
> maison de Camille, chaumière du mage, moulin d'Émile et ses champs, route du pont au
> village — mais ils n'ont pas été **redimensionnés** : ce sont toujours des objets isolés
> dans un paysage désormais quatre fois et demie plus vaste. Entre le pont et le village
> il y a maintenant près d'un kilomètre de rien.
>
> Ton travail : rendre ce trajet habité. Haies et fossés le long de la route, bornes,
> croix de chemin, un hameau ou deux, des pâtures avec des murets, un lavoir, un bac.
> L'échelle est flamande et l'époque est celle de Vauban : pas de clôture moderne.
>
> Le relief est donné par `carte.js` (`solPlaine`, `margePlate`) : tu le consommes, tu ne
> le redéfinis pas.

---

## 4 — Secteur NATURE

> Tu prends le secteur **Nature** du jeu *The Legend of Camille*
> (`~/Documents/GitHub/the_legend_of_camille`). **Lis d'abord `ORCHESTRATION.md`.**
>
> **Tes fichiers : `nature.js` et `foret.js`.** Tu ne touches à aucun autre.
>
> La carte vient de passer au **1:1 réel** : la surface de la plaine a été multipliée par
> vingt, mais les compteurs de végétation, eux, n'ont pas bougé. L'herbe, les buissons et
> les arbres sont donc vingt fois plus clairsemés qu'avant. C'est le premier chantier :
> retrouver une densité crédible **sans faire exploser le temps de chargement** — donc par
> instanciation, par tuiles autour du joueur, ou par niveaux de détail, pas en multipliant
> bêtement les compteurs.
>
> Ensuite : la lisière (elle doit devenir un vrai mur végétal infranchissable, c'est le
> bord du monde), les sous-bois, et l'eau — la Deûle et les fossés de la citadelle
> méritent mieux qu'un plan bleu.
>
> `carte.js` te donne le relief et les exclusions (`libreNature`, `margePlate`,
> `solPlaine`). Tu les consommes, tu ne les redéfinis pas.

---

## 5 — Secteur PERSONNAGES

> Tu prends le secteur **Personnages** du jeu *The Legend of Camille*
> (`~/Documents/GitHub/the_legend_of_camille`). **Lis d'abord `ORCHESTRATION.md`**, puis
> **`BRIEF-GEANTS.md`**, qui est ta feuille de route immédiate.
>
> **Tes fichiers : `geants.js`, `pnj.js`, `locomotion.js`.** Tu ne touches à aucun autre.
>
> Trois défauts constatés en jeu sur Phinaert et Lydéric : le gourdin n'est pas dans la
> main, les défenses traversent le crâne, et les géants sont trop grands. Le diagnostic
> complet est dans `BRIEF-GEANTS.md` — la cause des deux premiers est commune :
> `majSockets()` jette l'échelle de l'os alors que `carrure()` l'a gonflée. Le correctif
> exact et les critères de recette y sont.
>
> Ensuite : les villageois sont le maillon faible visuel du jeu, nettement en dessous de
> l'architecture (c'est écrit noir sur blanc dans `BRIEF-DESIGN.md`). Silhouettes,
> proportions, palette, démarche.
>
> Note : leur **déplacement** est déjà corrigé côté village (ils passent par `blocked()`
> et ne traversent plus les murs ni la fontaine). Ne le refais pas.

---

## 6 — Secteur INTÉRIEURS

> Tu prends le secteur **Intérieurs** du jeu *The Legend of Camille*
> (`~/Documents/GitHub/the_legend_of_camille`). **Lis d'abord `ORCHESTRATION.md`.**
>
> **Tes fichiers : `cave.js`, `house.js`, `tavern.js`, `mage.js`, `chapelle.js`.** Tu ne
> touches à aucun autre.
>
> Priorité : **la cave de la citadelle** (`cave.js`), les galeries souterraines de Vauban.
> C'est le niveau le moins abouti du jeu et c'est là que se joue la délivrance du prince.
> Textures de voûte, éclairage aux torches, ambiance d'humidité et d'écho, puits de
> lumière, éboulis, niches — et une lisibilité de parcours qui ne repose pas que sur le
> minimap.
>
> Ensuite l'estaminet (`tavern.js`), qui vient de gagner une vraie porte et une terrasse
> côté rue : l'intérieur doit être à la hauteur.
>
> Une fabrique commune existe pour les portes, volets et enseignes : `menuiserie.js`.
> C'est un bien commun — tu peux t'en servir, tu n'y mets pas de contenu de niveau.
