# Réponse — secteur Personnages (2<sup>e</sup> tour)

Fichiers touchés : **`pnj.js`** et **`geants.js`**. `locomotion.js` n'a pas bougé.
Aucun autre fichier n'a été écrit. Ce qui relève d'ailleurs est en bas, en demandes.

Tout ce qui suit est **mesuré ou vu en rendu**, pas jugé sur lecture de code : il a fallu
monter un banc (voir la dernière section), parce qu'aucun navigateur ne tourne dans
l'environnement où je travaille.

---

## 1. Les géants : trois points sur quatre étaient déjà faits

Le `BRIEF-GEANTS` avait déjà été traité par la session précédente (`REPONSE-GEANTS.md`).
Je l'ai **vérifié en rendu** avant de toucher à quoi que ce soit, et c'est bon :

| critère de recette | état |
|---|---|
| 1. le gourdin est empoigné, le manche traverse le poing | **tenu** |
| 2. défenses, cornes et anneau de nez sortent du crâne | **tenu** |
| 3. Phinaert 7,60 / Lydéric 6,62 unités (2,7× et 2,3× l'humain) | **tenu** |
| 4. il ne glisse pas : un pas = un déplacement | **cassé — voir ci-dessous** |

### Le critère 4 n'a jamais tourné une seule image

Le code de calage de la foulée existait bien dans `animeGeant()`. Il était mort :

```js
jouer(nom, fondu, boucle) {
  const a = this.actions[nom];
  if (!a || a === this.courant) return;      // <- ne renvoie RIEN
  …
}
…
else if (vitesse > 0.4) marche = ctrl.jouer('Zombie_Walk_Fwd_Loop', 0.25);
if (marche) { /* timeScale, tremblement de sol… */ }   // jamais atteint
```

`marche` valait `undefined` à toutes les images : ni la vitesse du clip, ni le tremblement
de sol n'ont jamais été appliqués. Aucune erreur, aucun symptôme dans la console — juste un
géant qui patine. (Le contrôleur de `pnj.js`, lui, renvoie bien son action : c'est celui
écrit à la main dans `geants.js` qui ne le faisait pas.)

**Corrigé**, et pendant que j'y étais, corrigé plus solidement que demandé :

- `jouer()` renvoie l'action, **y compris quand elle tournait déjà**, et retient son nom.
- Le calage est passé de `animeGeant()` à **`ctrl.update()`**. Il vaut donc pour *tout*
  géant animé — y compris Lydéric, que personne ne fait passer par `animeGeant()` : il est
  piloté à la main par les cinématiques de `quetes.js`, et lui aussi glissait.
- La vitesse n'est plus reçue en paramètre mais **mesurée sur le déplacement réel du
  groupe**, avec lissage et rejet des sauts de position (les téléportations de cinématique
  emballaient sinon le clip).
- La longueur de foulée n'est plus une constante. `PAS_PAR_HAUTEUR = 0,62` était réglé à
  l'œil pour tout le monde ; la mesure donne autre chose, et pas la même pour les deux :

  | | clip | foulée mesurée / taille |
  |---|---|---|
  | Lydéric | `Zombie_Walk_Fwd_Loop` | **0,45** |
  | Phinaert | `Zombie_Walk_Fwd_Loop` | **0,54** |

  L'écart vient de la carrure : celle de l'ogre raccourcit ses cuisses de 10 %. Une seule
  constante ne pouvait pas convenir aux deux. `mesurerFoulee()` échantillonne donc le clip
  à la construction (60 images, mixer encore vierge) et stocke le résultat par géant et par
  clip. C'est self-correcting : un nouveau clip ou une carrure retouchée n'auront rien à
  reprendre.

**Recette, mesurée** — glissement du pied porteur rapporté à la vitesse du sol,
Lydéric à 3 u/s : **+17 % avant, −6 % après**.

**Réserve honnête** : à vitesse élevée le `timeScale` reste borné à 2,2, et surtout
`Zombie_Walk_Fwd_Loop` **traîne un pied en permanence** — c'est ce qui fait sa démarche
d'ogre. Sur ce clip-là, « pied planté immobile » n'a pas de sens physique, et aucun réglage
ne mettra le glissement à zéro. En jeu les deux restent dans la plage utile
(`KINDS.phinaert.speed = 3,7` pour une vitesse naturelle de 3,1 → `timeScale` ≈ 1,2 ;
Lydéric à 4 pour 2,25 → ≈ 1,8), donc aucun ne tape la borne.

---

## 2. Les villageois — le maillon faible

Ce que montrait le rendu, avant de toucher à quoi que ce soit : **six fois la même personne
dans six chemises**, toutes sombres. `Claude outputs/villageois-avant-apres.png`.

### Diagnostic

1. **Les pantalons et les bottes étaient noirs chez les six.** Pas un choix : un effet de
   bord. `teindreMaillages()` **multiplie** la couleur par l'atlas — or l'atlas du pack est
   déjà peint, avec un pantalon brun à ~25 % de luminance. Multiplié par `0x8a6f52`, il
   tombe à 13 % : noir. Toutes les couleurs de `bas` et de `chaussures` de la table étaient
   du code mort. Rendu du même personnage avec les matériaux en blanc pur : l'atlas brut
   était **plus beau que le résultat teint**.
2. **Aucune variation de gabarit.** Même maillage, même carrure, ±5 % de taille. Les
   géants ont un `carrure()` qui redimensionne les os ; les villageois, non.
3. **Deux des six n'étaient pas des villageois.** Le n° 5 portait une capuche verte de
   rôdeuse relevée (la règle de teinte `_Head_Hood` ne pouvait pas transformer du vert en
   or) ; le n° 6 jouait `Idle_TalkingPhone_Loop` — il **mimait un téléphone**, main à
   l'oreille, au milieu d'un bourg flamand du XVII<sup>e</sup>.
4. **Rien sur la tête, rien dans les mains.** Pas de coiffe, pas de chapeau, pas de tablier,
   pas de panier. La version en primitives (`makeVillagerProc`) avait des chapeaux et des
   tabliers ; la version riggée les avait perdus en route. C'est pourtant ce qui se lit en
   premier à trente mètres.
5. **Aucun contraste de valeur.** Tout l'atlas est dans les tons moyens et sombres : de
   loin, six taches de la même densité.
6. **Ils marchaient au pas cadencé**, tous sur la même image du même cycle.

### Ce qui a été fait

**a) La palette passe par la teinte, plus par la multiplication.** `recolorerMaillages()`
remplace teinte et saturation en gardant la luminance peinte de l'atlas — c'était déjà le
traitement de Camille, les villageois ne l'avaient pas. J'y ai ajouté une **valeur**
(3<sup>e</sup> terme des règles, 1 par défaut) : garder la luminance est justement ce qui
faisait ressortir une chemise écrue reteintée en prune **en rose bonbon**. La teinte donne
la couleur, la valeur donne le tissu. Palette de teintures naturelles : garance, guède,
gaude, brun de noix, vert-de-gris, brique, ardoise.

**b) Six gabarits, par redimensionnement d'os** (`carrure()` + table `GABARITS`) : trapu,
sec, charpenté, rond, mince, droit. Piège traité : **l'échelle d'un os se propage à ses
enfants** — élargir `spine_01` grossit la tête et les mains. Chaque table compense au cou et
au crâne pour que le produit des facteurs y reste à 1 ± 0,03 (le calcul est en commentaire
sur chaque ligne).

**c) Les tailles s'étalent enfin** : 1,58 m → 1,86 m, soit **2,62 → 3,08 unités** au lieu
de 2,69 → 2,99.

**d) Des accessoires en géométrie, accrochés aux os** : coiffe de lin, chapeau de feutre à
large bord, bonnet de laine, tablier (toile ou cuir), châle, panier d'osier, besace,
lanterne, hache. Ils portent aussi **la valeur** : une coiffe de lin ou un tablier écru sont
les seules taches claires possibles sur cette base. Coût mesuré : **+620 triangles et
+9 appels de rendu par villageois**, soit 2,5 % sur un personnage à 24 500 triangles.

**e) Un métier par habitant, et l'objet qui va avec le clip.** La banque contient des clips
que personne n'utilisait : `Farm_Watering`, `TreeChopping_Loop`, `Idle_Lantern_Loop`,
`Idle_Talking_Loop`, `Idle_No_Loop`, `Idle_FoldArms_Loop`. Et quand un clip mime un objet,
l'objet existe maintenant : le guetteur tient **une vraie lanterne**, le bûcheron **une
vraie hache**. `Idle_TalkingPhone_Loop` et `ReposGarde` (idle d'épée) sont sortis.

| | métier | gabarit | taille | idle | ce qui le fait reconnaître |
|---|---|---|---|---|---|
| 0 | marchande | rond | 1,58 m | `Idle_Talking_Loop` | coiffe de lin, tablier écru, panier |
| 1 | brasseur | trapu | 1,79 m | `Idle_FoldArms_Loop` | chapeau bas, tablier de cuir, guède |
| 2 | lavandière | mince | 1,66 m | `Farm_Watering` | châle clair, coiffe, panier |
| 3 | guetteur | sec | 1,70 m | `Idle_Lantern_Loop` | large bord, barbe grise, lanterne |
| 4 | garde champêtre | droit | 1,74 m | `Idle_No_Loop` | tenue de rôdeuse, capuche **baissée**, besace |
| 5 | bûcheron | charpenté | 1,86 m | `TreeChopping_Loop` | bonnet, hache, drap brique foncé |

**f) Ils ne marchent plus au pas.** Chacun a son rythme (±10 %), sa phase de départ
(`mixer.setTime` aléatoire à la construction), et surtout une **cadence proportionnelle à sa
taille** : à 1,6 u/s pour tout le monde, un villageois de 2,6 unités qui joue le même cycle
qu'un de 3,1 glisse d'un bon quart.

**g) Un correctif partagé, à connaître.** Dans `majSockets()`, un accessoire posé sans
suivre la rotation de l'os (`suitRot = false`) recevait son décalage **en axes MONDE** :
« devant » voulait dire « vers le nord », et un tablier serait passé dans le dos dès que le
villageois se retourne. Le décalage est maintenant pris dans le repère du personnage.
Ça corrige au passage **la bourse de Camille**, qui changeait de hanche quand elle tournait.

Camille a été repassée au banc après ce changement : épée, bouclier, foulard, baudrier,
tout tient. Rien d'autre n'a été touché chez elle.

---

## 3. Ce que je n'ai pas fait, et pourquoi

- **Le pantalon de Camille est noir**, pour exactement la raison du point 2.a : la teinte
  `TOILE` est appliquée sur un atlas presque noir dont on conserve la luminance. Le
  correctif tient en un chiffre maintenant que `recolorerMaillages()` prend une valeur —
  mais changer l'allure de l'héroïne sans qu'on me l'ait demandé, non. **Dis-moi et c'est
  fait en une ligne.**
- **`locomotion.js` n'a pas bougé.** Ses cycles fabriqués ne servent plus que de repli
  depuis l'arrivée du volume 1 ; les villageois jouent tous de vrais clips. Y toucher
  n'aurait rien changé à l'écran.
- **Le déplacement des villageois** : pas touché, comme demandé.

## 4. Demandes aux autres secteurs (je n'écris pas chez vous)

1. **`demo-pnj.html` est cassé, discrètement.** Un commentaire a avalé la fin d'une ligne :
   ```js
   window.BANC = {
     E,        // le module moteur, pour que les scripts de test
               // n'aient pas à deviner le ?v= courant gens, scene, camera,
     mode: …
   ```
   `gens`, `scene` et `camera` sont dans le commentaire : `BANC.gens` est `undefined`. Pas
   d'erreur de syntaxe, le banc s'ouvre, mais aucun script de test ne peut s'en servir.
2. **`KINDS.phinaert`** (engine.js) : `barY: 10` et `r: 2.4` datent de la version en
   primitives, pour un géant qui fait maintenant 7,6. À réaccorder. (Déjà demandé dans
   `REPONSE-GEANTS.md`, toujours valable.)
3. **La cinématique d'introduction** vise `y: 4–6` — à revoir pour un Phinaert à 7,6.
4. **`house.html` ne finit pas son chargement** : signalé par la session précédente, je n'ai
   pas pu le reproduire sans le décor complet.

## 5. Le banc, pour que ce soit reproductible

Aucun navigateur n'est installable dans l'environnement où tourne cette session : la
vérification « ça charge, et voilà à quoi ça ressemble » est donc passée par un banc monté à
part — Chromium en rendu logiciel, les `.js` du secteur, `lib/`, et le sous-ensemble
`02_personnages` des assets (15 Mo en tout, le reste du dépôt n'est pas nécessaire). Il
construit les six villageois, les deux géants et Camille, avance les mixers d'un temps
donné, capture sous n'importe quel angle, et sait mesurer : hauteur debout sur l'os de la
tête, boîte d'un maillage dans le repère d'un os, longueur de foulée, glissement du pied
porteur, appels de rendu et triangles.

C'est ce banc qui a donné **les placements mesurés au lieu d'être devinés** — par exemple le
repère de l'os `Head` : sommet du crâne à `y ≈ 0,24`, face vers `z ≈ 0`, nuque à
`z ≈ −0,20`. Les premières coiffes, posées à `y = 0,055` au jugé, tombaient **sur les yeux**
comme un bandeau.

**Aucun `PAGEERROR`, aucune erreur console** sur `pnj.js`, `geants.js` et `locomotion.js`
au chargement, à la construction et en animation. Ce que le banc ne couvre pas : le niveau
complet (`game.js` + le décor), qui demande le reste des assets.
