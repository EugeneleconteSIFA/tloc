# Reprise du chantier — pour Claude Code

Ce fichier est le point d'entrée d'une session Claude Code dans ce dépôt. Il dit où en est
le travail, ce qui a été appris du code, et ce qu'il reste à faire. Lis-le en entier avant
de toucher quoi que ce soit.

---

## 1. Le projet

**The Legend of Camille** — mini-jeu d'aventure 3D façon Zelda dans la citadelle de Lille.
HTML + modules ES + Three.js r160 dans `lib/`, aucune compilation. Pour l'ouvrir :
**`./lancer.sh`** puis `http://localhost:8000` (accueil) ou `/index.html` (jeu direct). Un seul
serveur, `serveur/app.py`, sert les pages ET l'API des comptes et du multi, sans cache
(`python3 -m http.server` ne sert que les fichiers : accueil, comptes et multi n'y marchent
pas). Les modules ES interdisent le `file://`.

Depuis peu, trois choses en plus : une page d'accueil avec comptes et instances
multijoueur, une économie (bourse, écus, potions), et une personnalisation de Camille.

---

## 2. Règles de la maison — non négociables

1. **Ne jamais faire de `git checkout` ni de copie globale du dossier.** Trois sessions
   ont déjà réécrit `carte.js` avec une version périmée. Le dépôt n'est pas sous git :
   il n'y a pas de filet, une écriture de trop est définitive.
2. **Demander avant de toucher un fichier « ouvert ».** Au 21 septembre, étaient
   verrouillés : `carte.js`, `quartier.js`, `citadelle.js`, `village.js`, `game.js`,
   `engine.js`, `nature.js`, `quetes.js`, `chapelle.js`, `tavern.js`. Cette liste bouge —
   **demander à Eugène ce qui est libre aujourd'hui** avant de commencer.
3. **Pas de système parallèle.** Ce qui appartient au jeu s'écrit dans les fichiers du jeu
   (`engine.js`, `quetes.js`, `village.js`…), pas dans un module greffé à côté. Les
   greffes existantes (touches `B` et `M` posées depuis `bourse.js` et `atlas.js`) sont
   des pis-aller assumés, à rapatrier dans le `keydown` d'`engine.js` dès qu'il se libère.
4. **Éditer en place, jamais réécrire un fichier qu'on n'a pas lu en entier.**
5. **Commentaires en français, et qui disent POURQUOI**, pas ce que le code fait déjà. Le
   dépôt est écrit comme ça de bout en bout : s'y tenir.
6. **Vérifier en rendu**, pas sur lecture de code. Trois défauts réels de ce chantier
   (cheveux blancs, caméra dans le meuble, coiffure greffée non teinte) étaient invisibles
   à la lecture.
7. `carte.js` a changé : **`TOWN` a bougé et tourné**, et `TOWN_WALL`, `TOWN_GATE`,
   `townWallR`, `BOURG`, `ABORDS` **n'existent plus** — `townWorld(lx, lz)` les remplace
   tous. Ne s'appuyer sur aucun de ces noms.
8. Ne pas relancer `carte/ign-recolte.py` : la récolte IGN est bonne et prend vingt minutes.

---

## 3. Ce qui a été fait, et ce qui a été vérifié

### Accueil, comptes, multijoueur — **terminé et vérifié**

| fichier | rôle |
|---|---|
| `connexion.html` / `connexion.js` | le portail : connexion, inscription, « jouer sans compte » |
| `accueil.html` / `accueil.js` | l'accueil du compte : parties nommées, instances |
| `tloc-portail.css` | l'habillage commun aux deux pages |
| `tloc-compte.js` | compte, parties (slots), instances, API |
| `tloc-multi.js` | chargé par `index.html` : sauvegarde par partie, bouton Accueil, salon multi |
| `serveur/app.py` | FastAPI : comptes, parties, instances, relais WebSocket |

37 vérifications passées en navigateur réel avec deux joueurs : inscription, partie qui
remonte sur le compte, instance rejointe par code, avatars, coup d'épée, mort et
réapparition, menus cliquables. Voir `NOTE-MULTI.md` et `serveur/deploiement.md`.

**Une instance n'est pas une partie** : ni intro, ni quête principale, ni quêtes
secondaires, ni journal, et une sauvegarde à part (`tloc_save_v2:inst:<CODE>`) pour que la
balade à plusieurs n'écrive jamais dans une progression solo.

### Multijoueur, suite : apparence, point d'arrivée, personnages riggés — **24 septembre, vérifié en rendu**

- **Entrée d'instance** : armoire, puis carte en mode choix (`ATLAS.choisirPoint`) ; le
  point est recalé sur un sol sec et libre, gardé dans `state.apparition`, et sert aussi
  de point de réapparition. Détails dans `NOTE-MULTI.md`.
- **Chacun sa Camille** : les avatars distants sont riggés et portent l'apparence de
  leur joueur (message `look`, filtré par le serveur). Vérifié avec une vraie page et un
  second joueur simulé en WebSocket : avatar riggé, contrôleur chargé, même échelle que
  soi (0,636), coup d'épée joué, apparence reçue dans les deux sens.
- **Maison privée** : `house.html` ne charge pas le salon ; personne n'y entre chez vous.
- **Plus de personnages « cartoon »**, en solo comme à plusieurs : `pnj.js` gagne
  `ROLES` et `buildRole()` (même fabrique que les villageois) pour le prince (couronne,
  cape), le vieux mage (bonnet mou, bâton), Gustave (tablier) et les quatre clients de
  l'estaminet, dont Séraphin. Chaque appelant garde l'ancienne fabrique en repli si la
  banque manque. Vérifié en rendu dans la citadelle, les galeries, l'estaminet et la
  chaumière.
- `look.js` : `appliquerSur(mesh, réglages)`, `normaliser()`, verrou de coiffure porté par
  le personnage, et `ouvrirArmoire(suite)`.
- **Suite (même jour)** : point de rendez-vous posé par l'hôte (colonne `rdv` des
  instances, message `rdv`), avatar qui rougit et joue « touché » quand il perd des
  cœurs, chat sur **T**. Vérifié : 36 matériaux rougis puis rendus, zéro déplacement de
  Camille pendant la frappe, HTML affiché en texte, rendez-vous présélectionné pour un
  nouvel arrivant. À faire plus tard (demandé par Eugène) : une entrée du menu pause pour
  changer d'apparence et de point, et une vraie robe pour le mage.

### Économie et apparence — **terminé et vérifié**

| fichier | rôle |
|---|---|
| `bourse.js` | écus, plafond, gourdes, potions, boutiques, étiquette « +3 », touche **B** |
| `look.js` | apparence de Camille et page de l'armoire |
| `house.js` | **armoire** au pied du lit, **coffre de la bourse sur la mezzanine** |
| `mage.js` | boutique de fioles sur l'établi |
| `hud.js`, `cave.js` | ligne de bourse au HUD, apparence reposée d'un niveau à l'autre |

29 vérifications pour `bourse.js`. L'armoire a été vérifiée **sur la Camille riggée** (celle
de la banque d'assets), y compris la persistance d'un niveau à l'autre.

### La carte du beffroi — **terminée et vérifiée** (cf. 4.B)

`atlas.js` : carte plein écran à la touche **M**, fond repris du peintre de `hud.js`, lieux
nommés (le test en a compté douze sur la vraie citadelle), Camille et son regard, échelle,
zoom molette et flèches. Plus l'énigme du guetteur : trois devinettes, une tirée par partie,
réponse à trois choix.

Vérification terminée le 24 septembre (cf. 4.B). Les étiquettes ne se chevauchent plus.

### La carte réelle, les ponts, les eaux — **24 septembre, vérifié en rendu**

- **Ponts** (`carte.js`) : ils étaient calés sur un sol plat (voir § 5, `RELIEF`) ; les
  culées suivent maintenant le sol réel, plancher au niveau de la nappe VOISINE. Une voie
  relevée qui croise l'axe sur la berge passe SOUS le tablier : la culée recule de
  `RAMPE_PASSAGE` (11 m) sans enjamber la voie suivante, et la culée est percée d'une arche.
  Deux tracés « pont » qui finissent dans l'étang sont des **pontons** (planches, pieux).
  Jour au-dessus de l'eau : 2,70 à 8,74 m ; au-dessus des chemins : ≥ 2,17 m.
- **Eaux** : les `eau.canaux` du relevé sont des AXES (lignes), pas des surfaces — ils ne
  sont plus élevés en lentilles d'eau, sauf dans le fossé de la place (sdMax < MOAT_OUT),
  seule source d'eau de celui-ci. 39 bâtiments et 1,8 km de rues n'y trempent plus.
- **Collisions dans l'eau** : 31 → 0 (rochers du fossé, galeries hors du mur).
- **`zoneName()`** nomme « Le Lavoir » et « Le Hameau des Wattines » (`PARTAGE.lavoir`,
  `PARTAGE.hameau`, posés par campagne.js).
- **Objets mal posés** (audit headless avant fusion, 46 → 11 signalements, les 11 restants
  vérifiés faux positifs) : bourg, maison de Camille, chaumière du mage, champs et clôtures
  du Moulin, piles de l'entrée du parc (`pose()` écrasait la hauteur des pièces).
- **Camille** : épée, bouclier, foulard et bourse étaient aux hanches dehors (échelle 0,6,
  cf. § 5). Chat Pralin reposé sur le dallage. Ronde de Désiré éloignée de la chapelle.
- **Caméra** : sonde à l'échelle du personnage, évasée depuis la tête ; repli « à l'épaule »
  au lieu de la vue verticale. Seuil de la maison fermé (la caméra sortait par la porte).
- **Interactions** : la MEILLEURE à portée (distance rapportée au rayon + ce que Camille
  regarde), plus la première déclarée.
- **Colimaçons** (beffroi, donjon) : le guidage de l'escalier ne vaut que SUR les marches ;
  au pied de la tour il ramenait Camille vers l'axe et on ne sortait plus.
- **Serveur unique** : `lancer.sh` (journal d'accès coupé : il affichait le jeton du salon).

### Performance — **24 septembre, mesurée**

Vue du bourg, Intel Iris Plus 655, qualité max. Triangles par image **13,4 M → 3,0 M** ;
appels de dessin 2 900 → 1 530 ; GPU ≈ 40 ms ; en jeu **20–22 images/s**, désormais limité
par le processeur (préparation des appels). Ce qui a été fait (`engine.js` sauf mention) :

| changement | gain mesuré |
|---|---|
| fusion des décors **par tuiles de 150 m** (`TUILE`, `cleTuile`) ; quartier idem (`quartier.js`) | le hors-champ n'est plus dessiné |
| **réservoir de lumières** : 6 lumières réelles suivent les 14 sources les plus proches (`poolLumieres`, `majPool`) | −10 à −25 ms GPU |
| le **flou de profondeur réutilise la profondeur** de l'image (DepthTexture) | −19 ms GPU |
| instanciés statiques en **tuiles de 300 m** (`tuilerInstances`) | −12 ms GPU |
| terrain en 72 morceaux ; tapis de sous-bois 380 k → 91 k triangles (`carte.js`) | géométrie et double dessin du sol |
| **lots `BatchedMesh`** (`regrouperLots`), pas d'ombre sous 1 m, animations en liste (`game.js`) | −15 % d'appels |
| **F3** : compteur de rendu à l'écran (img/s, JS, appels, triangles, mémoire, lumières) | — |

Images comparées pixel à pixel avant/après : identiques au bruit près (animations, pavé et
paille tirés au hasard à chaque chargement).

---

## 4. Ce qu'il reste à faire, par ordre

> **Session suivante : lire d'abord « La nuit du 26 septembre » (§ 4.I, en tête)** — le
> prologue, l'armure et l'écu sont faits et en ligne sur le dev, à essayer avec Eugène ;
> puis le cheval. Demander d'abord à Eugène les fichiers verrouillés du jour, et s'il a
> promu la dernière version du dev en prod.

### A. Le beffroi — **terminé et vérifié (24 septembre)**

Tout est dans `village.js`, bloc « beffroi » de `buildTown()` (`bx = tx + 8, bz = tz - 12,
BH = 26` en unités LOCALES du bourg : ×1,5, soit **39 m** et un fût de 7,5 m).

- **Fût creux** : quatre murs de brique, **porte à l'ouest** — c'est la seule face qui donne
  sur une rue ; deux maisons de la rangée nord étaient posées DANS le fût (la dernière de la
  rangée n'a plus que 3,5 de profondeur, l'autre est reculée à `tx + 14.6, tz - 14.8`).
- **Colimaçon** `E.addHelix` en coordonnées MONDE (il ne connaît pas la rotation du bourg) :
  11 tours de 3,61 m, noyau, marches instanciées, deux lanternes ; les quatre coins du fût
  sont bouchés par des capsules (hors de l'hélice, on tombait).
- **Chambre des cloches** : coursive + palier nord-ouest en plateformes `seg` (orientées),
  trémie ouverte sur les trois autres quarts (la tête traversait la dalle), garde-corps en
  capsules à `.bottom` autour du puits et le long de la balustrade.
- **Coffret** sur la coursive ouest → `ATLAS.enigme` ; `E.addLieu('beffroi')` ; Désiré
  envoie Camille là-haut une fois les fantômes chassés, puis la félicite.
- Vérifié en rendu : Camille **monte à pied** (198 points franchis par `player.walkTo`, de
  −1,00 à 38,75 m), invite « ouvrir le coffret » au sommet, répliques de Désiré lues à
  l'écran. Sa ronde a été raccourcie : elle passait devant la porte de la chapelle, et
  Entrée faisait entrer dans la chapelle au lieu de lui parler.

**Deux pièges payés en route, à connaître pour tout ce qui touche au bourg :**
- le bourg est posé à `TOWN.y` (≈ −1,00), calé par `calerBourg()` (carte.js) sur le sol
  relevé — il était à la cote 0 et flottait de 1,4 m, Camille marchait sous les pavés.
  Tout ce qui pose un objet du bourg à une hauteur absolue doit ajouter `TOWN.y` ;
  l'`addCap` local de `buildTown()` le fait déjà ;
- la maison de Camille et la chaumière du mage sont posées au sol par `poserAuSol()`
  (campagne.js), et la fumée repart de SA cheminée (`userData.smokeBase`, lu par game.js).

### B. La vérification d'`atlas.js` — **terminée (24 septembre)**

Faite au vrai clavier (Playwright), page rechargée entre la réponse et l'ouverture :
3 `<canvas>` au repos ; sans carte, `M` n'ouvre rien (il garde son rôle d'origine et coupe
la musique) ; mauvaise réponse → pas de carte, la main est rendue ; bonne réponse →
`state.carteBeffroi` vrai, écrit dans `tloc_save_v2`, retrouvé après rechargement ; `M`
ouvre (4 canvas, jeu en pause, temps figé), `Échap` et `M` referment sans rouvrir la pause.
Les étiquettes de la carte ne se chevauchent plus (placement glouton, par importance).
Attention en test : un `KeyboardEvent` envoyé sur `window` court-circuite l'ordre capture /
bulle et fait croire qu'`Échap` ouvre la pause ; l'envoyer sur `document.body`.

### C. L'apparence dans les deux derniers intérieurs

Une ligne dans `tavern.js` et dans `chapelle.js`, après `installerCamille` :
```js
import * as LOOK from './look.js';
LOOK.veiller();
```
Sans elle, Camille reprend son allure d'origine dans ces deux lieux.

### D. Les vagues suivantes de l'équipement

`REPONSE-EQUIPEMENT.md` tient la spécification complète (écus, poche, gourdes, atouts,
quêtes, prix, courbe). Ordre prévu, chaque étape jouable à la fin :

| étape | fichiers | contenu |
|---|---|---|
| ~~Les écus~~ **fait (25 sept.)** | `bourse.js` (`PRIMES`, `prime()`), `quetes.js` et `cave.js` (`onKill`) | primes sur les monstres — reste : les petits coffres |
| ~~La poche~~ **fait (25 sept.)** | `bourse.js` (écran, `I`, `G`), `engine.js` (`TOUCHES`, `CROCHETS`) | armes et outil, 6 → 12 objets (gaufres par 3), gourdes |
| Le bouclier | `engine.js` | touche `V`, blocage, parade, coût d'endurance |
| ~~La fauche~~ **fait (25 sept.)** | `nature.js` (section LA FAUCHE), `campagne.js` | herbe, touffes, fleurs, buissons, fougères, blé et meules de foin ; écus et gaufres |
| Les quêtes | `village.js`, `quetes.js`, `chapelle.js` | les cinq quêtes et leurs atouts |

**Troisième vague (25 sept.)** — vérifiée au banc sur le vrai jeu :
- **Carquois limité** : 20 flèches, puis 40 et 60 (colporteur) ; les corbeaux et chauves-
  souris en rendent 1 ou 2 ; tir à vide refusé avec un message. Vieille sauvegarde : plein.
- **Poche** (`I`) : une gaufre ramassée en pleine santé se range au lieu d'être perdue ;
  `G` la mange. Entrée utilise, Suppr jette (la gaufre retombe devant Camille).
- **Colporteur** au débouché de la rue du marché (local 6,5 ; 19,5), avec sa charrette :
  places de poche (60/120/240), gourdes 2 et 3 (80/160), dix flèches (8), carquois
  (50/100), un réceptacle de cœur (250).
- **La faux d'Émile** (60 écus, proposée à la fin de chaque conversation avec lui) :
  3,4 m et ±1,7 rad au lieu de 2,4 m et ±1,25 ; une brassée de plus par coup sur les meules.
- **Petits coffres** (`BOURSE.petitCoffre`) : beffroi (20), quatre bastions (12 à 16),
  hameau des Wattines (15), deux dans les galeries (18, 20). Placés sur une dalle libre ET
  à ciel ouvert (`aCielOuvert`, un rayon vertical) : sans ce second test, deux tombaient
  dans des casernes.
- **Buissons dorés** : un sur quarante (hachage de position), 5 écus hors plafond, repousse
  en dix minutes.
- **Ressenti** : `SFX.fauche` une fois par coup qui coupe, brins qui s'envolent (80 plans
  instanciés, couleur de la plante), `SFX.piece` à chaque gain, `SFX.dizaine` à chaque
  dizaine franchie.
- Au passage : l'entrée « ← Accueil » de tloc-multi.js ne se greffe plus que sur les menus
  titre et pause — elle apparaissait dans les boutiques et faisait quitter le jeu.

**La fauche, telle qu'elle est** (vérifiée au banc, en frappant avec F) : la lame coupe dans
2,4 m et ±1,25 rad, pendant la fenêtre de frappe des monstres (0,08 à 0,3 s). Ce qui est
coupé disparaît vraiment (matrice à zéro, 64 octets renvoyés) et repousse au bout de 90 s ;
la table des fauches empêche une tuile re-semée de faire repousser plus tôt. Gains par plante
coupée : herbe 3,5 %, fleurs 12 %, touffes et fougères 25 %, buissons 50 % (1 à 2 écus), blé
3 % ; une gaufre de temps en temps (trois fois plus souvent si Camille est blessée, jamais deux
à moins de 20 s). Une **meule de foin** (4 près du moulin, 1 au champ de foin de la route)
tombe en 3 à 5 coups, rapporte 2 à 5 écus par coup et une gaufre une fois sur cinq, puis
revient au bout de 4 minutes. Plafond : 40 écus de verdure par zone de 80 m et par 10 minutes.
Mesuré : 16 coups dans l'herbe → 24 plantes, 2 à 6 écus ; une meule → 7 à 10 écus ; 4 coups
dans le blé → 78 à 80 épis, 5 écus ; une moule abattue → 3 écus. Les écus ne comptent qu'une
fois la bourse trouvée (coffre de la mezzanine, chez Camille).

### E. Performance — le CHARGEMENT d'abord (règle 8 de CLAUDE.md)

**Mesuré le 25 septembre** (`bancs/charge.mjs`, `bancs/profil.mjs`, headless, serveur local) :
**21,4 s** de chargement froid, 58 Mo en 322 fichiers (46 Mo de textures webp) ; le
réseau finit à 2 s en local, tout le reste est du calcul.

| étape | ms | ce qui coûte |
|---|---|---|
| préparation du rendu | 8 650 | envoi des textures à la carte graphique (`texSubImage2D` 6,5 s) + shaders (2 s) |
| relief | 2 300 | `cuireRelief` : 724 000 points × `terrainNaturel` → `nappeProche` / `sdPoly` |
| quartier | 1 800 | 1 710 bâtiments, `tri()` pousse dans des tableaux JS |
| fusion des décors | 1 400 | `unifierMateriaux` (0,2 s) + `mergeStatics` + lots |
| sols | 1 300 | |
| avant la 1ʳᵉ étape | ~1 700 | téléchargement et compilation des modules |

**Corrigé ce jour** : `aCielOuvert` tirait ses rayons sur toute la scène (4 s perdues à
« personnages ») → index spatial ; les 8 s figées à 100 % après « Prêt » sont devenues
une étape avec barre (`prechaufferRendu`, textures par paquets puis `compileAsync`).
Total : 27 s → 21,4 s.

**Leviers restants, du plus rentable au moins rentable :**
1. **Textures** (6,5 s + 46 Mo à télécharger en ligne) : 330 mégapixels uniques. **Essai
   A/B fait le 25 septembre** : les 51 fichiers en 2048² (18 matières Poly Haven) ramenés
   en 1024² — 36,5 → 13,8 Mo, préparation du rendu 8,7 → 5,6 s, chargement 21,2 → 20,2 s.
   À l'œil : identique au départ, en sous-bois et sur les chemins (0 à 1,2 % de pixels
   changés, bruit de relance compris), sur la place du bourg un pavé à peine plus doux
   (10 % de pixels, écarts faibles). **En attente de la décision d'Eugène** ; les fichiers
   réduits ne sont pas dans le dépôt (conversion : PIL, Lanczos, webp qualité 90).
   **Adopté le 25 septembre** (Eugène : « aucune différence visible ») : les 51 fichiers
   sont en 1024² dans `assets_back/`, les originaux 2048² gardés dans
   `~/Documents/tloc-sauvegardes/textures-2048/` (hors dépôt). Mesuré ensuite : 58 → 46 Mo
   à télécharger, préparation du rendu 8,7 → 5,7-5,9 s, somme des étapes 18,6 → 15-17 s ;
   le total (18 à 23 s) varie surtout avec la charge de la machine. Mieux, à terme : **KTX2 / Basis** (compressées pour la
   carte graphique : envoi quasi instantané, 4 à 8 fois moins de mémoire), avec
   `KTX2Loader` et une conversion hors ligne (`toktx`/`basisu`). Décision d'Eugène.
2. **Relief** (2,3 s) : un index spatial des eaux dans `nappeProche`, ou ne l'appeler que
   là où une grille grossière dit l'eau proche. Attention : le terrain des berges en
   dépend (cf. l'eau cachée) — vérifier au banc de l'eau cachée après coup.
3. **Quartier** (1,8 s) : tableaux typés préalloués au lieu de `push`.
4. **En ligne** : cache HTTP long sur `assets_back/` (nginx), le serveur de dev servant
   tout en `no-store`.

### E bis. Performance en jeu, suite possible

**Unification des matériaux — faite le 24 septembre** (`unifierMateriaux()` dans
`engine.js`, juste avant `mergeStatics`). Deux passes, sur les décors immobiles seulement,
sur des COPIES (jamais un matériau ni une texture partagés) :
- les textures répétées : la répétition passe dans les UV, la texture retombe à 1 × 1 et
  devient commune — 544 matériaux texturés deviennent 262 ;
- les matériaux unis (les décors en primitives) : la couleur passe dans les sommets, sous
  un matériau blanc — 1 114 deviennent 55.
Mesuré, même graine, mêmes vues : appels de dessin 2 271 → 2 009 au bourg (−12 %),
1 900 → 1 846 sur la citadelle, 2 794 → 2 676 vers la maison ; 198 ms de plus au
chargement. Image : 0,08 % et 0,03 % de pixels changés sur la citadelle et la maison
(le bruit d'une relance) ; au bourg 0,15 %, une bande de pavés lointains passée dans un
lot qui les échantillonne un peu autrement (moins de moiré qu'avant). Le bilan s'écrit
dans la console au chargement (`matériaux unifiés :`), avec les raisons des écarts.

Ce qui reste : les objets vivants (villageois, torches, monstres), les 410 matériaux à
shader de `nature.js`, et les unis restés seuls de leur matière. Option simple : démarrer
en qualité 2 sur les GPU intégrés (le jeu baisse déjà seul sous 34 images/s).

### F. Mise en ligne — **faite (25 septembre)**

Prod https://tloc.kernse.fr et dev https://tloc-dev.kernse.fr sur le VPS (168.231.85.64,
partagé avec d'autres projets : ne toucher qu'à `/srv/tloc`, `/var/lib/tloc`, aux ports
8130/8131 et aux deux sites nginx `tloc*`). Tout est dans `serveur/deploiement/LISEZMOI.md` :
`./publier-dev.sh 'message'` (commit + push GitHub, le dev se met à jour), puis
« Mon compte → Version → Promouvoir en prod » (compte Createur). Base de la prod recopiée
dans le dev chaque nuit à 3 h 30. Le dev n'admet que le compte Createur.

### G. Le mode de jeu en équipe (plusieurs contre plusieurs)

**Fait le 25 septembre** (voir `NOTE-MULTI.md`) : deux camps à 8 places, tunique et plaque
aux couleurs du camp, pas de tir ami (serveur), points de camp, ralliement par camp,
**bannières à prendre et à rapporter** (3 points), et autour : la bourse en jeu, la fête de la moisson (`/fete`), les dons (`/donner`). Vérifié
de bout en bout avec un vrai navigateur et deux clients WebSocket. L'esquisse d'origine,
pour mémoire : Aujourd'hui une instance est un chacun-pour-soi à
quatre places. Le mode équipe, à l'esquisse :

- **Deux camps** (par exemple la garnison de la citadelle contre les gens du village),
  choisis à l'entrée de l'instance, après l'armoire ; la couleur du camp teint la tunique
  (une zone de `look.js` imposée) et la plaque du nom.
- **Pas de tir ami** : le serveur connaît déjà l'émetteur et la cible de chaque `coup` ;
  il suffit qu'il ignore un coup entre deux joueurs du même camp.
- **Un point d'apparition par camp**, posé par l'hôte comme le point de rendez-vous
  (même carte en mode choix, `ATLAS.choisirPoint`).
- **Un but** : score au nombre de mises à terre (les `frags` existent déjà par joueur, à
  sommer par camp), ou mieux, une bannière à défendre et à prendre — le donjon et la
  place du village s'y prêtent.
- **Côté serveur** : relever `JOUEURS_MAX` (4 aujourd'hui), ranger le camp dans
  `Connecte`, et le diffuser dans `bienvenue`/`arrivee` comme l'apparence.

---

### H. La chasse aux défauts visuels — **en cours, à reprendre en premier**

Méthode (25 septembre) : tous les défauts visuels rencontrés venaient d'un écart entre ce
qu'on DESSINE et ce sur quoi on MARCHE. On ne les cherche plus à l'œil : on les mesure.

**Outil en place** : `node bancs/crawl.mjs` (serveur lancé). Compare `getH` à une vue de
dessus rendue en profondeur, sur 1,4 km², en ~16 s ; sort les zones INVISIBLE (on marche
sur rien) / ENFONCÉ (sol dessiné au-dessus des pieds), nommées, et une planche photo
(`bancs/crawl-<date>.png`, repère rouge). Dernier passage : **1 586 m² suspects**, aucune
zone au-dessus de 200 m² (on partait de 122 000). À relancer après toute retouche du décor
ou du relief, et à comparer au passage précédent.

**À faire, dans cet ordre :**
1. **Le triangle sombre dressé sur la berme du fossé**, près de (135, 165) : repéré sur
   une vue, pas identifié. Lancer un rayon dessus (cf. le diagnostic : `raycaster` vers le
   bas, nom, matériau, parent, nombre de sommets), puis corriger à la source.
2. **Rendre les 0,45 s de chargement** pris par la dernière passe (« sols » 1,3 → 1,8 s ;
   somme des étapes 17,45 s pour un budget de 17) : resserrer les anneaux de la plaine et
   caler `RELIEF` sur le maillage SEULEMENT dans la couronne des fossés (sdPent < 300),
   où les pentes sont raides ; ailleurs, le pas d'origine suffisait.
3. **Les petites zones restantes** du banc : « Donjon » (écart 17,5 m, sans doute le puits
   du colimaçon : à écarter du banc si c'est voulu), « Galeries » (6,9 m : un bout de
   terre-plein encore marchable sans dessin ?), « Façade de l'Esplanade » (3,2 m), « Pont du
   Petit Paradis » (1,5 m).
4. **Nouveau banc : l'ACCESSIBILITÉ.** Depuis le point de départ, inonder la carte avec
   les règles de Camille (`blocked`, marches de 0,5 m, `getH`, eau) et lister les PNJ,
   coffres, portes et interactions (`interactables`) qu'on n'atteint pas. Il aurait trouvé
   seul la mezzanine inaccessible de la maison. À faire aussi dans chaque intérieur.
5. **Nouveau banc : les OBJETS FLOTTANTS OU ENTERRÉS.** Pour chaque décor posé (tonneaux,
   bancs, clôtures, meules, coffres — les maillages non fusionnés et les lots), comparer le
   bas de sa boîte englobante à `getH` sous lui : > 15 cm au-dessus = il flotte, > 30 cm
   dessous = il est enterré. Liste nommée + planche, comme l'arpenteur.
6. **Tournée photo automatique** : une vue par lieu nommé (`lieux`) et par intérieur, sur
   une planche, pour ce que la machine ne juge pas (« ça fait cartoon », « mal placé ») —
   à montrer à Eugène plutôt qu'à lui demander de tout parcourir.

**Idées retenues pour après** (proposées, pas commencées) :
- Multijoueur : équipement égal en mode équipes (arc et carquois plein pour tous), écran
  de fin de manche à 10 points (camp vainqueur, remise à zéro des bannières), trésor
  commun du camp.
- Menu pause : changer d'apparence et de point d'apparition en instance ; une vraie robe
  pour le vieux mage (géométrie, comme la cape du prince).
- Textures : KTX2 / Basis (cf. § 4.E) si le chargement en ligne reste lourd.

### I. Les idées d'Eugène (26 septembre) — **1, 2 (armure, écu) et 4 faits ; le cheval préparé**

**La nuit du 26 septembre — ce qui a été fait en autonomie** (Eugène : « on check ça
demain ensemble »). Tout est sur le dev (`f2691c5` prologue, `7e5bdeb` armure et écu).
- **Le prologue** (point 1, § ci-dessous) : `quetes.js` (`debut`, `prologue`,
  `suivrePrologue`, `introScene(gateau)`, `finPrologue`), l'école Lequeuche = l'enseigne de
  la boulangerie du bourg (`village.js`, lieu `ecole`), le point d'or de la minicarte
  (`PARTAGE.repere`, hud.js), le compteur d'épis fauchés (`bleFauche`, nature.js), et le
  rejeu depuis l'accueil (« Revoir le prologue » → `tloc_auto = 'prologue'` →
  `G.sansSauvegarde` : ni lecture ni écriture de sauvegarde, vérifié au banc). Rien n'est
  sauvegardé pendant le prologue ; une sauvegarde automatique prise en route le relance au
  début (`onLoad`). Les monstres dorment (`caged`) jusqu'à l'enlèvement.
  Vérifié en rendu, étape par étape (captures au banc). Chargement : 16,9 s en somme des
  étapes après (bancs/charge-2026-09-26-apres-prologue.json), dans le budget.
- **Au passage** : Phinaert n'atteignait jamais le pont dans l'intro d'origine (210 m à
  6 m/s, coupés à 8 s) — il part maintenant de 40 m. La réplique de Lydéric disait « Espace
  pour frapper » : c'est clic gauche ou F. Eugène n'a plus ni couronne ni cape (pnj.js).
- **« Prince » retiré** de tous les textes visibles (13 fichiers) ; les noms de code restent.
- **L'armure et l'écu en multi** (point 2) : voir NOTE-MULTI.md, « L'équipement ».
- **Le cheval, préparé seulement** : `assets_back/02_personnages/animaux/cheval.glb`
  (1,5 Mo, 8 clips : Walk, Gallop, Idle, Idle_Headlow, Eating, Death, Idle_HitReact1,
  Attack_Kick ; fait par `glb.py` du même dossier), essayé en jeu à côté de Camille :
  la tête à 2,35 m il a la bonne carrure (échelle calculée sur le maillage DÉFORMÉ par les
  os — la boîte du modèle brut donne 4,8 et un cheval de huit mètres). Style low-poly à
  facettes : à montrer à Eugène. À faire avec lui : l'écurie (près du moulin), monter et
  descendre, la vitesse, la jauge de vie qui remonte en broutant, puis l'épée en selle.
- **L'arc entre joueurs** (point 5) : portée par arme au serveur (`PORTEE_FLECHE` 62 m, une
  flèche vole 60 m ; l'épée garde 7 m). Les **vétérans tirent à l'arc** de 9 à 30 m quand
  rien ne cache leur cible (`tirerFleche`, flèches à part de celles du joueur ; le coup ne
  part qu'à l'arrivée). Banc : 5 flèches tirées, 5 touches reçues, 10 demi-cœurs perdus.
  L'écu levé les pare aussi, de face.
- **À trancher avec Eugène** : les prix de la forge (40 / 70 / 12 / 50 écus), les points
  d'armure (2, 3, 4 cœurs), le délai de retour de l'armure (45 s), le fait que les bots ne
  ramassent rien (ils subissent la parade et l'armure, c'est tout).

**1. Apprendre à jouer, et apprendre la carte.** Deux pistes d'Eugène :
- un **mode tutoriel** à part, à côté du solo et du multi ;
- un **prologue du solo** qui enseigne en racontant (dans le Zelda de référence, on
  apprend à monter le célestrier pour se préparer à un concours).

Avis : la seconde, rejouable depuis l'accueil — le même prologue sert de tuto, sans
système parallèle (règle 3). Une raison qui colle au Nord : **la procession des géants**.
Camille veut entrer dans la garde d'honneur qui escorte les géants à la ducasse ;
Lydéric, le géant de Lille, lui fait passer les épreuves. Chacune est une leçon :
se déplacer et sauter (le parcours des remparts), la roulade (passer sous la hallebarde
qui balaie), l'épée (les mannequins), l'arc (le **tir à la perche**, le vieux jeu des
archers flamands : l'oiseau de bois au sommet d'un mât), et la carte (**la tournée des
corps de garde** : rallier quatre lieux nommés avec la carte du beffroi — le compteur
« Lieux x / 13 » existe). Récompense : l'épée de Lydéric. C'est pendant la procession que
Phinaert enlève le prince — la quête principale s'enchaîne.

**Cadrage avec Eugène (26 septembre) — remplace l'avis ci-dessus.** Prologue du solo, 2 à
3 minutes, proposé à la première partie avec un bouton « Passer », rejouable depuis
l'accueil. L'histoire : Camille étudie la cuisine à **l'école Lequeuche, dans le bourg** ;
avec son ami **Eugène**, elle prépare un gâteau pour l'anniversaire de **Lydéric le géant**.
Les leçons (se déplacer et sauter, la carte, l'épée) viennent de la préparation — un
ingrédient à aller chercher —, puis on porte le gâteau à Lydéric au pont, où Phinaert
enlève Eugène : l'intro actuelle s'enchaîne. **Eugène n'est plus « le prince »** : le mot
disparaît des dialogues et des textes (≈ 70 occurrences dans 14 fichiers, dont des
verrouillés — `quetes.js`, `game.js`, `engine.js`… — à demander avant). Les noms de code
(`state.princeFreed`, `PARTAGE.prince`) restent : ils sont dans les sauvegardes.
L'ingrédient : **le blé, au moulin d'Émile** (campagne.js) — la leçon d'épée est la fauche
du champ (`faucherChamp`, nature.js, existe déjà). **La fête est un secret** : Lydéric ne
se doute de rien. Au pont, au moment où Camille lui tend le gâteau, Phinaert surgit.
Le gâteau **tombe et s'écrase** dans la bousculade — pas de suite, c'est la tristesse du
moment. Le retour du moulin à l'école se fait par un fondu (le gâteau terminé), pour tenir
les 2–3 minutes.

Déroulé : (1) cour de l'école Lequeuche, la farine manque — se déplacer, sauter ;
(2) le chemin du moulin — la carte ; (3) le champ d'Émile — faucher à l'épée, Émile moud ;
(4) fondu, le gâteau fini, Camille et Eugène au pont ; Lydéric ému, Camille lui tend le
gâteau, Phinaert surgit, enlève Eugène, le gâteau s'écrase, la herse tombe → intro actuelle.

**2. En multi, les objets qui font gagner.** Il en faut plus, et il faut qu'on les voie :
- un **cheval**, dans une écurie : plus rapide (et peut-être une charge) ;
- une **armure** : des points de résistance à casser avant de toucher les cœurs
  (côté client de la victime, dans `encaisser`, comme les cœurs) ;
- d'autres pistes : un bouclier qui bloque de face, une arbalète, les potions (existent).
Pour les faire connaître : toujours aux mêmes endroits (écurie, arsenal, poudrière — ça
apprend aussi la carte), une lueur et une icône sur la minimap, une annonce quand ils
réapparaissent, et un écran qui les présente au début d'une manche.

**Cadrage avec Eugène (26 septembre).** Multi seulement. Première vague : **armure,
bouclier, cheval**. On les **ramasse** à des lieux fixes, et on les **améliore avec des
écus chez le forgeron** (en pleine manche : y aller est un risque).
- **Armure** : se fend à force de coups (des points à casser avant les cœurs, dans
  `encaisser`) ; brisée, elle réapparaît à son lieu après un délai, avec une annonce.
- **Bouclier** : se garde, même après une mort. **Clic droit maintenu** pour le lever quand
  on l'a (la roulade reste sur Maj ; sans bouclier, le clic droit ne change pas).
- **Cheval** : plus rapide, **l'épée à cheval** (on frappe depuis la selle — le plus coûteux
  en animation). Sa propre jauge de vie, prise avant celle du cavalier ; elle **remonte quand
  il broute** (l'herbe et les meules de la fauche, nature.js). Mort, il réapparaît à
  l'écurie. Modèle : proposé **Quaternius** (CC0, glTF animé, léger), sinon Poly Pizza ou
  Sketchfab (CC-BY, plus réaliste, plus lourd) — à choisir par Eugène avant tout
  téléchargement.
- Ce qu'on garde en mourant : l'objet et ses améliorations restent au joueur.

**3. La carte.**
- Plus de forêt dans les parcs de la citadelle (le vrai site est très boisé : bois de
  Boulogne, esplanade).
- Monter la qualité des maisons du bourg (cf. BRIEF-DESIGN, règle 5 : décor et
  personnages montent ensemble).

**4. Petites améliorations du multi.**
- La pause entre deux manches est trop courte (`MANCHE_PAUSE`, 12 s) : la porter à 25–30 s.
- Un bouton **Rejouer** sur l'écran des résultats (la manche suivante part quand tous les
  humains l'ont pressé, sans attendre la fin de la pause), et un bouton **Accueil**.

**5. L'arc entre joueurs ne compte pas au-delà de 7 m.** Le serveur refuse tout `coup`
dont l'auteur est à plus de `PORTEE_COUP` (7 m) de sa cible (`serveur/app.py`, `traiter`,
branche « coup »). Une flèche qui touche à 15 m est donc perdue — entre joueurs comme
contre un bot. Corriger : une portée par arme (`k: 'epee'` 7 m, `k: 'fleche'` ~45 m, à
recaler sur la portée réelle des flèches d'`engine.js`), en gardant la vérification de
cadence. Une fois fait, donner l'arc aux bots vétérans (`penserBot` dans tloc-multi.js).

**6. Le temps de chargement.** 41 s pour entrer dans la citadelle depuis la prod, et
≈ 485 Mo au premier envoi (`serveur/deploiement/exclure.txt`). Les deux mégakits
(`assets_back/01_decors/…_megakit`, ≈ 100 Mo chacun) contiennent leurs textures
d'origine à côté des dossiers `_web` que le jeu charge : mesurer ce que le jeu réclame
vraiment (réseau d'un chargement complet, tous niveaux), exclure le reste du site, puis
voir le § 4.E (étapes lentes du chargement, KTX2).

**7. Petites retouches en attente.**
- Le thème sombre de l'accueil garde son ciel bleu nuit (Eugène n'aime pas le bleu en
  clair ; lui demander pour le sombre — piste : un brun nuit).
- Les bastions : au chargement, « 3 courtines percées au niveau du terre-plein » sur 5, et
  3 murs de caserne laissés en travers d'une rampe. Vérifier en jeu qu'on monte bien sur
  les cinq (le banc d'accessibilité du § 4.H, point 4, le dirait).
- Les sauvegardes nocturnes de la prod restent sur le même VPS (`/var/backups/tloc`) :
  en garder une copie ailleurs (Google Drive, ou le Mac).
- Ce fichier, les § 3 : ils ne racontent pas encore le travail des 25–26 septembre (portail
  flamand, bots, manches, badges, social, mise en ligne, vue mobile). Le détail est dans
  `NOTE-MULTI.md` et `serveur/deploiement/LISEZMOI.md`.

**Ordre proposé** : 4 (une heure, ça se sent tout de suite) → 5 (l'arc, utile au multi) →
2 (les objets qui font le multi) → 6 (chargement) → 1 (le prologue : écrire l'histoire
avec Eugène avant de coder) → 3 (la carte).
**Fait au 27 septembre** : 4, 1, 5, 2 (armure, écu, cheval — cf. NOTE-MULTI.md). Retours
d'Eugène le 27 : armure 4 cœurs (forge 5, 6), une armure brisée ne revient plus, flèche à
un demi-cœur, jauge d'armure en cœurs — faits ; armes redessinées (épée, rondache aux armes
de Lille, écu, cuirasse) et la masse de Phinaert enfin dans sa main (`prise()`, geants.js :
la main du géant est gonflée ×15 × 9 × 13, un décalage fixe l'envoyait à 75 cm). Reste :
la frappe en selle, 6, 3, 7.

## 5. Ce que le code a appris — à ne pas redécouvrir

- **`saveGame()` sérialise TOUTE clé de `state`** qui n'est pas une clé d'exécution, et
  `loadGame()` fait un `Object.assign` en retour. Une donnée neuve rangée dans `state`
  (`state.ecus`, `state.look`, `state.carteBeffroi`) est donc sauvegardée sans une ligne
  à ajouter. Une vieille partie repart de zéro : prévoir `state.x ?? défaut`.
- **`bump.py <version>`** aligne le `?v=` de toutes les pages et de tout fichier qui
  importe `engine.js`. Un module neuf qui importe `./engine.js?v=NN` est pris en charge
  automatiquement ; un `<script src="./machin.js">` avec un `./` en tête ne l'est pas.
- **`hitEnemy()` appelle déjà `G.level.onKill(e)`** : les gains à la mort d'un monstre se
  posent dans `quetes.js`, sans toucher au moteur.
- **La végétation est SEMÉE PAR TUILES qui suivent le joueur** (`nature.js`, classe
  `Couche`) : une instance n'est pas une plante, c'est un emplacement recyclé. Faucher
  demande une table des fauches par cellule, sinon la plante repousse dès qu'on tourne le
  dos. `addUpdateRange` (three r160) permet de ne renvoyer que 64 octets par coupe.
- **Camille riggée** (`pnj.js`, `buildCamille`) : ses maillages s'appellent
  `Female_Ranger_Body`, `_Arms_1` (tunique), `_Arms_2` (peau des bras), `_Legs`,
  `_Body_Belt_1/2`, `_Arms_Bracer`, `_Feet`, `_Acc_Pauldrons`, `Superhero_Female_tete`,
  `Eyes_tete`, `Eyebrows_*`, `Hair_*`. Tout le costume partage **un seul matériau**
  d'atlas : teindre par matériau repeint Camille d'un bloc, il faut teindre par maillage.
- **Deux façons de colorer, et il faut les deux** (`look.js`) : remplacer la teinte de
  l'atlas garde la luminance peinte — indispensable pour une tunique peinte en vert,
  inopérant sur des cheveux presque blancs ; la multiplication fait l'inverse. La peau
  demande la teinte plus une valeur tirée de la luminance.
- **Les accessoires riggés vivent dans le repère À L'ÉCHELLE du personnage** (`majSockets`,
  pnj.js) : dehors, Camille et les villageois sont à l'échelle 0,6 (`echelle` du niveau). Un
  calcul en mètres monde doit être divisé par l'échelle monde du groupe, sinon épée,
  bouclier, foulard et bourse glissent à 60 % de la hauteur de leur os — l'épée à la hanche.
  Invisible dans les intérieurs (échelle 1).
- **`A.rebind()` reparente les maillages sous le corps** : après l'appel, l'objet chargé
  est vide. Relever les morceaux AVANT si on doit les teindre.
- **Touches déjà prises** : `J` journal, `C` arc, `M` musique, `P` post-traitement,
  `O` ombres, `Échap` pause. Conventions posées ici : **`M` = carte une fois trouvée,
  `Maj+M` = musique**, `B` = boire. Restent libres pour la suite : `I` (poche), `V` (bouclier).
- **`E.lieux`** (via `addLieu`) est le répertoire des lieux, avec `estDecouvert(id)` :
  c'est ce que la carte dessine. Treize sont posés (le beffroi en plus).
- **`RELIEF` n'est publié qu'une fois cuit** (`cuireRelief`) : pendant la cuisson,
  `margeLieux → roadPts → preparerPonts` lit `solPlaine()` ; une grille assignée mais vide
  calait les ponts sur un sol plat. Les ponts se listent tôt, se calent tard (`calerPonts`).
- **Tout ce qui a été construit « à la cote 0 » est suspect** : le relevé met la plaine de
  l'Esplanade 1 à 2 m plus bas. Poser au `solPlaine()` ou via `poserAuSol()` (campagne.js).
- **Fusion, lots, tuiles** : `userData.dynamic` exclut de toute fusion (ce qui bouge) ;
  `userData.morcele` exclut le terrain (ses morceaux partagent leurs sommets) ;
  `userData.fusionne` / `fusionnable` marquent ce que `regrouperLots` peut réunir. Un
  instancié découpé en tuiles garde l'original comme poignée : `castShadow` et `visible`
  réglés dessus (game.js, qualité) se propagent à ses tuiles (`INSTANCES_TUILEES`).
- **`renderer.info.autoReset = false`** : le compteur est remis à zéro une fois par image
  (sinon il ne gardait que la dernière passe du post-traitement).
- **Mesurer** : la machine chauffe et le même rendu varie du simple au double. Comparer en
  A/B entrelacé dans la même page (minimum de plusieurs séries), chronomètre GPU
  (`EXT_disjoint_timer_query_webgl2`, vérifier `GPU_DISJOINT`) ; après une bascule qui
  change le nombre de lumières, chauffer ~8 images synchronisées — three compile les
  shaders en tâche de fond et ne dessine pas les objets tant qu'ils ne sont pas prêts.
- **Tests légers** : un seul Chrome headless à la fois, arrêté entre deux séances — une
  session oubliée en fond a fait surchauffer le Mac.
- **Le clip assis ne baisse pas la racine** (`Sitting_Idle_Loop`) : le bassin reste à
  hauteur debout (~1,6) et les pieds remontent à ~0,87. Un PNJ assis se pose donc à
  `y = -0,87` (`ASSIS_Y`, estaminet), sinon il flotte au-dessus de la table.
- **Un personnage riggé n'a ni `head`, ni `legs`, ni `arms`** : toute branche « en
  primitives » doit tester `userData.perso` d'abord — le contrôleur (`userData.ctrl`)
  arrive après coup, et tester son retour laissait passer une image sur l'ancienne branche.
- **L'ancien prince n'était jamais mis à l'échelle** : dehors (`echelle` 0,6), il
  dépassait Camille d'une tête. Tout personnage posé dans la citadelle prend `G.echelle`.
- **Le sol marchable doit être dessiné, et rien de dessiné ne doit rester hors du sol
  marchable.** Trois défauts du 25 septembre avaient cette seule cause : les galeries
  couvertes (berceau, dallage et terre-plein posés à `G.DEPTH / 2` au lieu de l'axe `0` :
  une moitié marchable invisible, l'autre dessinée dans le vide), le palier des rampes de
  bastion (sol marchable sur 13,5 m à plat, rien de dessiné : désormais `b.sPalier`,
  mesuré, et un massif de palier), et la maison de Camille (collisions sans hauteur : les
  meubles du rez-de-chaussée bloquaient la mezzanine). Au banc, comparer `levelH`/`getH`
  à un rayon lancé vers le bas (cf. les bancs du 25 septembre) trouve ces écarts d'un coup.
- **Le banc ARPENTEUR (`bancs/crawl.mjs`)** compare, mètre par mètre sur 1,4 km², la hauteur
  marchable (`getH`) à la hauteur dessinée (une vue de dessus rendue en profondeur, 15 s)
  et sort les zones INVISIBLE / ENFONCÉ, nommées et photographiées (repère rouge). Premier
  passage : 122 000 m² suspects → 5 500 après corrections (faux positifs de l'eau écartés,
  terre-plein des galeries borné aux travées, anneaux du maillage de la plaine resserrés
  au pied de la place). Le relancer après toute modification du décor ou du relief.
  Deuxième passe (25 sept.) : 5 500 → 1 586 m². Corrigés : le sol marchable relit le
  maillage dessiné (`calerReliefSurMaillage`, carte.js) ; la berme du fossé descend en pente
  au lieu d'un à-pic de 4,8 m (`terrainNaturel`) ; le sol de la place d'Armes s'arrête à la
  première sortie du tracé (`disqueTrace`) ; chaque bord de voie prend le sol sous lui
  (`rubanGeo`) ; un socle de terre sous toute la boîte du bourg (village.js). Restent des
  zones de moins de 200 m² (dont un « donjon » et des « galeries » à vérifier : sans doute
  des creux d'escalier). À voir aussi : un triangle sombre dressé sur la berme près de
  (135, 165). Coût : l'étape « sols » passe de 1,3 à 1,8 s (somme des étapes 17,45 s,
  budget 17 s) — piste : pixelliser le calage sur la seule couronne des fossés.
- **`makeDoor` pose son vantail en retrait de l'encadrement** (`recess`, 20 cm) : on pose
  l'encadrement sur le NU du mur (et devant les cordons qui débordent), pas dans son axe.
- **Les pignons à redents de `quartier.js` étaient creux** : chaque gradin ne descendait
  qu'au gradin précédent — une diagonale de carrés, vide en dessous, par où l'on voyait le
  ciel (le dessous des toits n'est pas dessiné). Les gradins descendent maintenant tous à
  l'égout, et portent une face arrière (vus de derrière, ils dépassent du toit).
- **Un toit ne va pas sur le rectangle englobant d'une emprise irrégulière** : il couvrait
  les cours et laissait des jours entre murs et rampant. `decouperRectangles()` découpe
  l'emprise en rectangles (coupes fusionnées à 2,5 m : un décrochement plus petit n'est
  pas une aile). Les murs approchent le contour relevé à ±1,25 m ; la collision, elle,
  suit toujours le contour exact.
- **Placer un objet « libre »** : les capsules ne voient que les murs — l'intérieur d'un
  bâtiment passe pour libre. Tester aussi le ciel (`BOURSE.aCielOuvert`). Et un
  `Raycaster` qui peut croiser des sprites demande `raycaster.camera`.
- **Au banc, ne jamais fermer un menu par « le dernier article »** : tloc-multi y greffe
  « ← Accueil » (menus titre et pause). Fermer par le libellé.
- **Le blé en qualité réduite** ne gardait qu'un bout du champ : `count` garde les N
  PREMIÈRES instances, et elles étaient rangées rang par rang. On mêle l'ordre une fois à la
  pose (campagne.js). Toute couche instanciée qu'on éclaircit par `count` doit être mêlée.
- **Au banc, la qualité s'abaisse toute seule** (moins de 34 images/s en headless) : pour
  mesurer ce qui dépend de la densité, `Q.locked = true; Q.apply(0)`.
- **L'eau cachée** : la berge de `terrainNaturel()` (22 m) n'atteignait le fond qu'à 18 m de
  la rive — un canal de moins de 40 m gardait son lit AU-DESSUS de son eau : invisible,
  mais on s'y noyait et elle barrait le passage (4,3 ha, dont le canal de la Tortue près du
  moulin). Le sol est maintenant borné par une rive franche (eau − 30 cm au trait de rive,
  pente de 35 %), et `eauVisible()` conditionne les deux règles d'eau (`levelBlocked`,
  `inWater`) : on ne bute ni ne se noie dans une eau qu'on ne voit pas. Symptôme à
  reconnaître : « il faut sauter pour avancer » — le saut passe au-dessus de la règle
  `y < 0,5`, et on atterrit « dans l'eau ».
- **`addCap(…, top)` prend une cote ABSOLUE**, pas une hauteur au-dessus du sol : sur le
  relevé, où le sol va de −2 à +0,3 m, une clôture à `top = 1,1` barrait trop ou trop
  peu. Toujours `sol + hauteur` (clôtures des champs, moulin corrigés ; bancs de
  `promenade.js` encore en absolu, sans gêne constatée).
- **Les champs du moulin se chevauchaient** : écarts × ECH, tailles en mètres. Replacés par
  balayage sur du terrain libre (`CHAMPS`, carte.js). Pour tout décor posé par écart ×
  ECH, vérifier que la TAILLE suit la même échelle.
- **Tout matériau a un `onBeforeCompile`** (vide, hérité de la classe) : pour savoir si le
  jeu en a posé un, comparer à `THREE.Material.prototype.onBeforeCompile`. Tester sa seule
  présence a d'abord écarté 100 % des matériaux de l'unification.
- **Un décor dont le code anime le matériau porte `userData.dynamic`** : c'est ce qui le
  protège de la fusion ET de l'unification (les braises de l'estaminet, les follets). Les
  transparents sont écartés d'office : les rais de la chapelle animent leur opacité sans
  ce drapeau.
- **Comparer deux rendus** : fixer `Math.random` (addInitScript) et relancer deux fois la
  même version — le ciel varie d'une relance à l'autre (14 % de pixels sur une vue), sans
  quoi on accuse le code d'un écart qui n'est que du bruit.
- **Les avatars distants étaient en primitives, à l'échelle 1** : ils faisaient 1,7 fois
  la taille du joueur local. `appliquerSur` pose désormais `G.echelle × taille`.

---

## 6. Vérifier

- **À la main** : `./lancer.sh`, puis `http://localhost:8000/` (accueil, comptes, multi)
  ou `http://localhost:8000/index.html` (jeu direct). **F3** affiche le coût du rendu.
- **En automatique** : Playwright pilote très bien le jeu (`window.TLOC` expose `state`,
  `player`, `menu`, `scene`, `lieux`…). Sur cette machine le GPU est réel, donc rapide ;
  en rendu logiciel la citadelle met plusieurs minutes à se construire — dans ce cas,
  tester les intérieurs (`house.html`, `mage.html`), qui se chargent en quinze secondes.
- Les tests écrits pendant ce chantier sont dans la session précédente, pas dans le dépôt.
  Les réécrire au besoin ; ils n'ont pas leur place dans un jeu qui se sert tel quel.
