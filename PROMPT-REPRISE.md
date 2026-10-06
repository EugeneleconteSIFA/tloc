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
réapparition, menus cliquables. Voir `docs/NOTE-MULTI.md` et `serveur/deploiement.md`.

**Une instance n'est pas une partie** : ni intro, ni quête principale, ni quêtes
secondaires, ni journal, et une sauvegarde à part (`tloc_save_v2:inst:<CODE>`) pour que la
balade à plusieurs n'écrive jamais dans une progression solo.

### Multijoueur, suite : apparence, point d'arrivée, personnages riggés — **24 septembre, vérifié en rendu**

- **Entrée d'instance** : armoire, puis carte en mode choix (`ATLAS.choisirPoint`) ; le
  point est recalé sur un sol sec et libre, gardé dans `state.apparition`, et sert aussi
  de point de réapparition. Détails dans `docs/NOTE-MULTI.md`.
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

`docs/REPONSE-EQUIPEMENT.md` tient la spécification complète (écus, poche, gourdes, atouts,
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

**Chantier du 27 septembre** (Eugène : « le chargement »). Somme des étapes 16,4 → 11-12 s
en local ; à travers une connexion de testeur simulée (20 Mbit/s, 40 ms, cache vide) :
prod 26,5 s / 32 Mo → dev **20,6 s / 22,6 Mo**, et 16,2 s à la visite suivante.
- **Cartes de relief et de rugosité en 512²** (106 fichiers, 23 → 6,5 Mo) : écarts au niveau
  du bruit de relance sur cinq vues. Originaux : `~/Documents/tloc-sauvegardes/textures-normales-1024/`.
  En attente du feu vert d'Eugène (publié sur le dev seulement).
- **Relief cuit d'avance** : `carte/relief-cuit.bin` (Int16 en différences, 1,45 Mo, 379 Ko
  gzippé), `node bancs/cuire-relief.mjs` le refait. 400 points recalculés au chargement :
  s'il a vieilli, le jeu recalcule tout et le dit dans la console. « relief » 2,5 s → 0,12 s.
- **Textures décodées en tâche de fond** (`chargerTexture`, assets.js : ImageBitmapLoader,
  imageOrientation flipY, `texture.flipY = false`) ; la préparation du rendu attend les
  décodages en cours (`texturesEnAttente`).
- **Shaders** : `renderer.debug.checkShaderErrors` coupé (sauf `?debug`) — 1,3 s d'attente.
- **Réseau** : les quatre fichiers de `carte.js` partent ensemble ; `modulepreload` de tous
  les modules dans index.html (APRÈS l'importmap : placés avant, « three » ne se résolvait
  pas et le chargement restait bloqué à 0 %, une fois sur deux). bump.py suit le lien d'engine.js.
- **nginx** (VPS, prod et dev, et `serveur/deploiement/nginx-tloc-*.conf`) : `.js/.css/.json`
  en `no-cache` (revérifiés à chaque visite — ils étaient gardés 7 jours, un module sans
  ?v= pouvait rester périmé une semaine) ; textures et modèles gardés 1 jour ; `.bin` et
  `.glb` compressés.
- 1 281 avertissements `toNonIndexed` supprimés à la source (mergeStatics).
Reste, par ordre de gain : l'envoi des textures (3,5 s — KTX2/Basis, il faut l'outil
`basisu`), « sols » 1,8 s et `sdPoly` (1 s au profil), « quartier » 1,6 s (`tri`).

**À faire dans `monde.js`** (noté le 2 octobre par la session de la Lozère, qui n'a pas le droit
d'y écrire) : les chemins de `ruban()` sont INVISIBLES d'en haut dans tous les mondes (Aveyron,
Pouilles, Thaïlande) — l'ordre `b, b+2, b+1` tourne leurs faces vers le bas et le matériau n'a
qu'une face. Corriger en `b, b+1, b+2, b+1, b+3, b+2`, et mettre des sommets tous les mètres en
travers (sinon la route s'enfonce sous un dos d'âne). `lozere.js` et `pouget.js` dessinent leurs
rues eux-mêmes en attendant. Autre manque : `monde.js` ne sait pas recoudre plusieurs reliefs fins
(Villefort a dû passer par `carte/mondes/recoudre-relief-lozere.py`).

**À faire dans `monde.js`, suite** (noté le 2 octobre par la session de l'Aveyron, même raison) :
`aveyron.js` bâtit lui-même son bâti, ses rues et ses arbres (le plan joué ne les passe plus à
`monde.js`), parce que la recette commune 1) coiffe chaque emprise d'un toit sur son rectangle
englobant — 152 toits sur 159 débordaient, 69 au-dessus d'un voisin (`bancs/lieu-aveyron.mjs`) ;
la fiche découpe les emprises en ailes rectangulaires (un toit par aile, débord ramené à 0 au-dessus
d'un voisin), à reprendre dans `batir()` pour tous les mondes ; 2) pose le plancher au point le plus
haut de l'emprise (49 soubassements de plus de 1,5 m) ; 3) sème les arbres AVANT que le lieu ait
bâti ce que lui fait `plus()`, d'où des arbres dans les maisons ; 4) ne varie pas la teinte du sol à
grande échelle : le motif de `withered_grass` se répète vu d'avion, et la fiche ne peut rien y faire
sans une patine dans le relief fin. Les crochets qui manquent : un `apresBati(ctx)` appelé avant les
arbres, et une option `sol.patine`.

**La Thaïlande resserrée (4 octobre)** : `thailande.html` se charge en 3,4 s (somme des étapes 2,6 s ;
3,9 s avant), 1,33 M triangles contre 7,2 M, 6 700 instances de jungle contre 67 700, relief 677 Ko
contre 1,1 Mo. Mesure : `bancs/lieu-thailande.mjs`, qui relève maintenant le chargement. À savoir :
`engine.js` ne range la durée des étapes (`tloc_poids_charge`) qu'à partir de HUIT, et un monde de
`monde.js` n'en a que six. `bancs/charge.mjs` ne voit donc rien sur les mondes, et
`lieu-thailande.mjs` lit l'étiquette de la barre à la place. L'étape « Chargement… » (fetch du plan et
du relief, puis `build()` du monde) fait 1,7 s à elle seule, sans sous-étapes : à découper dans
`monde.js` si un monde grossit. Les autres pages des mondes n'ont pas de barre (`#loadbar`), seulement
un rouet : thailande.html l'a reçue le 4 octobre ; aveyron, lozère, pouilles, à faire.

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

**Fait le 25 septembre** (voir `docs/NOTE-MULTI.md`) : deux camps à 8 places, tunique et plaque
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
(`bancs/resultats/crawl-<date>.png`, repère rouge). Dernier passage : **1 586 m² suspects**, aucune
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
  étapes après (bancs/resultats/charge-2026-09-26-apres-prologue.json), dans le budget.
- **Au passage** : Phinaert n'atteignait jamais le pont dans l'intro d'origine (210 m à
  6 m/s, coupés à 8 s) — il part maintenant de 40 m. La réplique de Lydéric disait « Espace
  pour frapper » : c'est clic gauche ou F. Eugène n'a plus ni couronne ni cape (pnj.js).
- **« Prince » retiré** de tous les textes visibles (13 fichiers) ; les noms de code restent.
- **L'armure et l'écu en multi** (point 2) : voir docs/NOTE-MULTI.md, « L'équipement ».
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
**Fait le 27 septembre.**
- **Le bois du parc** (`boisDuParc`, carte.js ; nature.js le passe au semeur) : l'anneau
  du pied du glacis à `PARC_BOIS_R` (400 m du tracé) est boisé de feuillus, sauf pelouses,
  prairies et jardins relevés et les allées. La nature poussait à partir du bout du glacis
  (110 m) ; elle pousse dès `LISIERE_GLACIS` (40 m, derrière la voie des combattants).
  5 021 → 8 167 arbres ; végétation +0,2 s au chargement ; images/s comparables.
- **Les rues de Lille** (Eugène : façades plates, rues vides), quartier.js : appuis et
  linteaux de pierre en saillie sous et sur chaque baie, marche et encadrement aux portes
  (500 000 triangles, par tuile, sous LOD : rien au-delà de 140 m) ; une maison sur quatre
  donnant sur une rue ouvre boutique (330 : devanture peinte, vitrine garnie — pain, bière,
  drap, fer —, enseigne en potence), 793 lanternes, tonneaux et caisses instanciés, avec
  collision. « quartier » 1,6 → 2,3 s (les triangles poussés un à un : à optimiser avec
  des tableaux typés si le budget se tend). Reste possible : des passants.

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
  `docs/NOTE-MULTI.md` et `serveur/deploiement/LISEZMOI.md`.

**Ordre proposé** : 4 (une heure, ça se sent tout de suite) → 5 (l'arc, utile au multi) →
2 (les objets qui font le multi) → 6 (chargement) → 1 (le prologue : écrire l'histoire
avec Eugène avant de coder) → 3 (la carte).
**Fait au 27 septembre** : 4, 1, 5, 2 (armure, écu, cheval — cf. docs/NOTE-MULTI.md). Retours
d'Eugène le 27 : armure 4 cœurs (forge 5, 6), une armure brisée ne revient plus, flèche à
un demi-cœur, jauge d'armure en cœurs — faits ; armes redessinées (épée, rondache aux armes
de Lille, écu, cuirasse) et la masse de Phinaert enfin dans sa main (`prise()`, geants.js :
la main du géant est gonflée ×15 × 9 × 13, un décalage fixe l'envoyait à 75 cm). Reste :
la frappe en selle, 6, 3, 7.

### J. Le style : réaliste, pas cartoon (Eugène, 27 septembre)

« Tu as tendance à créer des choses avec un thème cartoon alors que le thème avec les
textures est plus réaliste. » Règle : tout objet neuf prend une matière Poly Haven
(`phMat`) ; un objet qui porte un DESSIN (armoiries, enseigne) passe par `phPeint`
(engine.js) : le dessin remplace la couleur, le relief et la rugosité de la matière
restent. Couleurs passées et usure plutôt que teintes pures. Repris le 27 : épée (plaque
de métal), rondache et écu (peints sur planches, usés), cuirasse (cuir sur bois patiné,
mailles et plates sur métal), devantures et enseignes (bois patiné), lanternes et potences
(fer), présentoirs, bonnet (tissu), gâteau (relief sans couleur), cheval (normales
lissées au chargement : il était ombré par facette). Reste à reprendre : ce qui date
d'avant (bestiaire en primitives, quelques décors du bourg) si Eugène le relève.

### K. Le bourg praticable (26 septembre)

Eugène : « des routes libres d'accès mais impossible d'avancer, comme s'il y avait un mur ».
**Nouveau banc `node bancs/murs.mjs [origine] [demi-côté, 170 m] [--photos]`** (5 s de
mesure, ~45 s avec le chargement) : autour du bourg, case de 0,5 m par case, il cherche les
collisions sans rien de dessiné (MUR, avec la ligne de code de chaque capsule), les marches
≥ 0,5 m entre deux cases libres de la rue (MARCHE : `tryMove` ne les monte pas), et inonde
depuis la place aux règles de Camille (rayon 0,5) pour lister la rue qu'on n'atteint pas.
Carte en couleurs : `bancs/resultats/murs-<date>.png` (gris rue atteinte, orange coupée, rouge mur).
Pièges du banc : un objet mince (poteau, rame) ne se voit pas d'en haut — on prend le plus
haut dessiné à une case près ; les voies relevées passent SOUS les maisons du bourg et sous
l'eau des fossés — une case sous un toit n'est plus « rue », et les MUR « levelBlocked » des
fossés sont de l'eau, pas des murs ; les « marches » sur les ponts sont les rives du tablier.

Ce qu'il a trouvé, et ce qui est corrigé (Camille rejouée au `tryMove` dans les deux sens
avant/après : 2 entrées sur 6 passaient, 6 sur 6 maintenant) :
- **Le bord du bourg était une marche** : dallage à plat à `TOWN.y`, relevé 0,74 m plus bas au
  bout ouest de la grand-rue, 0,51 m au sud — on sortait du bourg, on n'y rentrait plus.
  `solBourg()` (carte.js) rejoint le relevé en pente sur `RAMPE_BOURG` (5 unités, 7,5 m) ;
  le socle, les pavés et le fondu de terre sont DRAPÉS sur le sol marchable (`draper`,
  village.js). Les pavés de la grand-rue et de la rue du marché vont jusqu'au bord de la
  boîte et rejoignent le boulevard ; le bord du socle s'efface sur 4 unités (plus de
  rectangle franc sur la pelouse de l'Esplanade), un cœur opaque reste dessous.
- **Le séchoir du drapier barrait le bout est de la grand-rue** : rames déplacées dans la
  cour, contre le pignon de la dernière maison sud. Collision des paravents à leur taille.
- **Maisons du bourg** : un stade inscrit laissait entrer de 1,9 m dans chaque angle →
  quatre capsules minces par maison (`addBox` local). Toits en **tuiles** (pans en UV
  mètres, lucarnes posées sur les pans, tournées de côté) au lieu de planches presque
  noires ; chapelle en moellon photographié et tuiles teintées ardoise.
- **Quartier** : les capsules suivaient le contour relevé, les murs les parcelles (±1,25 m,
  redans < 1,6 m abandonnés) ; et elles étaient centrées sur le mur (0,45 + 0,5 : arrêt à
  près d'un mètre). Elles suivent maintenant les murs DESSINÉS, rentrées de leur rayon
  (`RMUR`, 17 800 capsules). Rue atteinte depuis la place (1 km²) : 95,2 → 96,9 %.
- **Campagne** : haies et fossés de la route du pont coupaient les voies relevées (avenue
  du 43e, voie des combattants, allées du bois) → un trou à chaque croisement ; la capsule
  de haie s'arrête avant les bouts amincis.
- Chargement : somme des étapes 11,9 à 15,1 s sur trois passages (bruit de la machine),
  dans le budget ; « quartier » sans écart net au-delà du bruit.

**Suite du même jour : ce qui restait, fait.**
- **Les cours enfermées** (Corderie, Cygne, Cado, Soubespin) : le relevé fait passer ses cours
  et sentiers À TRAVERS 130 emprises — des porches. Tout lot de maison traversé par l'axe
  d'une cour n'est pas élevé (`traverseCour`, quartier.js ; 162 lots) ; un bout de cour que
  le relevé arrête à moins de 12 m d'une autre voie est prolongé jusqu'à elle ; les lots qui
  la bordent reculent pour lui laisser 1,2 m de chaque côté (`degagerCour` ; 109 lots, un
  lot qui y perdrait près de la moitié de sa profondeur n'est pas élevé). Piège : tester le
  LOT, pas le contour — un rectangle d'approximation déborde du relevé jusque sur la cour.
  La Corderie se traverse de bout en bout (Camille rejouée au `tryMove`).
- **Les ponts** : les 10 ponts relevés se traversent dans les deux sens (test de marche le
  long de leur tracé). Deux étaient barrés : le pont Napoléon (Esplanade) par un saule planté
  sur sa culée — les saules de berge échappaient à `libreNature` (`surLeChemin`, nature.js :
  ni tablier, ni voie relevée à moins de 2 m) — et la passerelle de Soubise par une maison du
  quartier en travers (`barrePont`, quartier.js). La « marche » du pont du Ramponneau était
  la rive du tablier : on y monte par le bout.
- **Le rempart de la Porte Royale** : la capsule de courtine dépassait de 5,5 m le bout du
  mur, au pied du bastion du Roy ; elle part maintenant d'un rayon en deçà de l'épaule.
- **Les pignons à redents** (quartier.js) : chaque gradin s'arrêtait au toit à son bord
  extérieur, le pan de tuiles dépassait en dents de scie entre les marches (la « bande de
  tuiles en diagonale »). Le gradin monte au toit à son bord intérieur.
- **L'if du cimetière** : l'arbre de la forêt (`especeGeo('sapin')`, foret.js) au lieu du
  cône uni.
Mesures : rue atteinte depuis la place (1 km²) 96,5 % (les restes : des îles de la
citadelle, le bout du monde rue de l'Arc, l'arrière des étals) ; arpenteur 1 603 m² suspects
(1 586 avant, bruit) ; chargement, somme des étapes 12,0 à 13,2 s.

### L. Le design du bourg et des rues (26 septembre, suite)

Eugène : « fais tout » (marché et place, sol du quartier, bestiaire, façades), puis « le
design des routes : des trottoirs, des rues homogènes ».
- **Plus d'aplats dans le bourg** : `UNI` (village.js, 53 usages) multiplie le grain d'un
  enduit photographié (`enduit_gris`, teinte ×1,8) ; `TERRE` (terre cuite, grès) sur
  `terre_battue` ; `PIERRE_TAILLE` (chaux craquelée éclaircie ; le marbre veiné lisait comme
  du marbre) ; `ECORCE`, `BRONZE`. Toiles (`TOILE`) et fer forgé (`FERN`) de menuiserie.js
  sur photo. **`IRON`, `STEEL`, `GOLD`** (engine.js, 86 usages dans tout le jeu) sur la tôle
  photographiée `metal_plate_02`, teintée ×2,6 — toujours un matériau neuf par appel (l'éclair
  rouge d'un coup modifie le matériau de la créature). `marble_rock_02` ajouté à la table PH.
- **Place et marché** : lanternes de fer à vitres chaudes, bancs de chêne sur dés de pierre,
  charrette à vraies roues chargée de sacs, terrasse de l'estaminet (chope de grès), fontaine
  maçonnée et moulures en pierre blanche, beffroi (pierre, dôme de plomb, cloche de bronze),
  chapelle (bordures, faîtage, tombes en moellon).
- **Façades** : parement par maison (`opts.mur` de `makeFlemishHouse` : brique, rouge,
  flamande, enduit badigeonné crème/ocre, pierre), pignons assortis.
- **Bestiaire** : le fantôme n'est plus un bonhomme de neige (linceul évasé en lambeaux,
  habit à épaules, crâne d'os, orbites sombres, tricorne de feutre, mousquet de bois et fer) ;
  dents de la moule, bernacles, coffre, arc, gaufre, torche en matières photo.
- **Sol du quartier** (`solVille`, carte.js) : deux nappes sur la terre — la dalle du trottoir
  du bord des voies jusqu'aux façades, des jardins herbus au cœur des îlots (loin des voies, ou
  jardin/herbe relevés).
- **Routes** (`voiriesLille`) : toute voie de ville est pavée (les petites étaient en terre,
  la rue changeait de sol à chaque carrefour) ; les voies de campagne restent en terre. De
  chaque côté d'une rue de ville : **bordure** de pierre (0,26 m) et **trottoir** de dalles
  (1,6 m, `MAT_DALLE`, `bandesGeo`), au ras de la chaussée et juste sous elle — aux
  carrefours la chaussée transversale passe par-dessus. Pas de trottoir sur l'eau, un pont,
  ni loin du bâti.
Mesures : chargement 12,6 à 13,1 s (somme des étapes, trois passages) ; arpenteur 1 603 m² ;
murs 0,75 m² sur la rue, 97,3 % de rue atteinte.

### M. Revue des liaisons citadelle – forêt – parc – bourg (27 septembre) — **faite**

Demande d'Eugène : que les routes entre la citadelle, la forêt, le parc et le bourg soient
bien.
- **Praticabilité mesurée** (plus court chemin à pied aux règles de Camille, depuis la sortie
  de la Porte Royale) : bourg, pont de la Citadelle, voie des combattants (quatre points),
  maison de Camille, moulin, mage — tout est joignable ; détours 1,0 à 1,7 (fossé, Deûle).
- **Obstacles sur l'axe des chemins** (revue : capsules à moins de 0,3 m de l'axe des voies
  relevées, de la voie des combattants et de la route du pont, avec leur ligne d'origine) :
  - arbres d'alignement de la voie des combattants sur les allées qui la croisent, sur la
    route du pont et dans ses propres virages (`bordVoie`, promenade.js : 480 → 365 arbres) ;
    bancs idem ; ornières moins noires ; bancs et claire-voie de l'entrée du parc en bois
    photographié ; **pavés de l'entrée du parc** à la bonne échelle (un seul motif étalé sur
    20 m : des pavés ronds d'un mètre et demi) ;
  - haies de la route du pont : un trou aussi au croisement de la voie des combattants ;
  - murets et bâtisses (hameau) écartés des chemins (`bordVoieC` dans `libreBati` et la pose
    des murets, campagne.js) ; le lavoir et la pâture en sont exemptés (`placeBati(…, false)`)
    — sans quoi ils ne trouvent plus de place ; les murets de la pâture s'ouvrent au passage ;
  - saules : ni sur un tablier ni près d'une voie, voie des combattants comprise (nature.js) ;
  - quartier : le dégagement des cours s'étend à TOUTES les rues (demi-chaussée dessinée) et
    à la voie des combattants — elle traversait deux maisons ; tonneaux et caisses ne se
    posent plus dans les cours (`dansCour`) ;
  - citadelle : les voies relevées (le parc d'aujourd'hui) ne se dessinent plus dans l'emprise
    de la place et des fossés (`rubanGeo`, `bandesGeo`) ; le pont de la Porte Royale en
    planches et chêne photographiés.
- Puis : les contours irréguliers reculent aussi (`degagerCour`, chaque sommet à
  l'intersection des deux murs voisins déplacés) — cour Notre-Dame et une ruelle près du
  bourg dégagées ; et la haie s'interrompt là où la voie des combattants longe la route à
  moins de 3,5 m (elle y était coincée entre les deux). Reste le bout du monde rue de l'Arc
  (`foret.js:530`), voulu.
- Chargement : A/B entrelacé de l'étape « quartier », ancien contre nouveau : minimum 2 630
  contre 2 385 ms (le filtre par boîte avant le test de polygone). Somme des étapes 12,5 à
  18,6 s sur quatre passages, la machine chargée (la préparation du rendu, inchangée, variait
  de 3,3 à 6,5 s). Murs 0,25 m² sur la rue, 97,4 % de rue atteinte ; arpenteur 1 596 m².

### N. Les intérieurs sans recharger la ville (27 septembre)

Eugène : « les chargements du jeu une fois le jeu déjà chargé ». Chaque intérieur est une
page ; entrer dans l'estaminet puis en ressortir RECONSTRUISAIT toute la ville (15 à 20 s à
chaque porte). Désormais (`goToLevel`, engine.js) :
- depuis la ville, l'intérieur s'ouvre dans un cadre plein écran (`ouvrirInterieur`) ; la
  ville s'endort (`G.sommeil` : la boucle ne fait plus rien ; `SFX.veille` suspend le son) ;
- en ressortant, l'intérieur appelle `TLOC.rentrerEnVille()` de la page hôte : le cadre est
  retiré, la ville relit la sauvegarde que l'intérieur vient d'écrire (état, cœurs, écus,
  position à la porte), rejoue `onLoad` des quêtes (grille, prince, chat…) et se réveille ;
  monstres et objets de la ville n'ont pas bougé ;
- `naviguer(url)` : « Sauvegarder et quitter », « Nouvelle partie », la reprise après une
  mort et « Retour à l'accueil » partent de la page principale, jamais du seul cadre ;
- au passage : la cave ressortait sur l'ancienne poterne relevée (dans le fossé) ; c'est la
  ville qui pose Camille devant la grille de la poterne bâtie (`onLoad`, quetes.js).
Mesuré au banc (aller-retour réel, état vérifié au retour, zéro erreur) : retour en ville
0,5 à 1,6 s (fondu compris) au lieu de 15 à 20 s ; entrée 3,7 à 7 s selon l'intérieur (sa
propre construction, comme avant). Maison, estaminet, chapelle, mage, cave.
**Reste** : un rechargement complet de la page (F5, retour de l'accueil) refait tous les
calculs (~13 s en somme des étapes : préparation du rendu 3,4, quartier 2, sols 1,8, fusion
1,4, végétation 1). Piste : garder en IndexedDB, par version, les géométries calculées du
quartier et des sols (déterministes), et KTX2 pour l'envoi des textures (§ 4.E).

### O. Points 3, 4 et 5 du § 4.H (28 septembre)

- **Point 4, le triangle sombre de la berme** (135, 165) : introuvable aujourd'hui, ni aux
  rayons verticaux ni sur huit vues à hauteur d'œil. Ce qu'on y voyait de dessous était
  vraisemblablement le toit marchable des galeries (point 5). Clos.
- **Point 5, les zones du banc arpenteur** (1 593 → 923 m² suspects, plus aucune INVISIBLE en tête) :
  - galeries (6 zones à 6,89 m) et murets de la place d'Armes (3 zones à 0,98 m) : leur dessus
    marchable est un segment à bouts RONDS, qui débordait d'une demi-largeur au-delà de ce qui
    est dessiné (4 m au bout de chaque palier de galerie). `seg.carre` (engine.js, getH) : bouts
    carrés, sans marge — posé sur ces deux-là seulement (la coursive du beffroi compte sur ses
    bouts ronds pour couvrir ses angles) ;
  - donjon (17,5 m) : le puits du colimaçon — getH y rend la plus haute marche. Voulu :
    `crawl.mjs` écarte désormais les puits d'hélice ;
  - façade de l'Esplanade : la maison de Camille avait une boîte pleine par-dessus ses quatre
    murs, dont le dessus était un sol invisible au-dessus des bords du toit — retirée ;
  - pont du Petit Paradis : les **parapets des ponts relevés n'avaient pas de collision** (on
    entrait dans la pierre jusqu'à la taille) — une capsule par tronçon, qui ne vaut qu'à
    hauteur du tablier (`.bottom`) ; et **plus de ruban de voirie sur un tablier maçonné**
    (le pont a son pavage : une voie de campagne y posait sa terre brune, d'autres une
    chaussée plus large que le tablier) ; une voie est « de ville » dès qu'un de ses points
    est à moins de 12 m du bâti. Les 8 ponts relevés se traversent dans les deux sens.
- **Point 3, nouveau banc `node bancs/objets.mjs`** : chaque décor, un par un, AVANT la fusion
  (crochet `window.__avantFusion` dans bootLevel), comparé au sol sous lui (flotte de 15 cm à
  1,2 m ; enterré de 30 cm à 2 m et plus d'un quart de sa hauteur). Filtres appris : un
  bâtiment (5 à 60 m) n'est pas testé pièce par pièce ; une pièce élancée (lisse, barreau),
  une pièce posée sur une autre (appui) ou contenue dans une plus grosse (cercle de tonneau)
  en fait partie ; rien sous un tablier ; rien d'enterré au-delà de 3 m de haut (fondations).
  Résultat : 10 cas, tous des pièces encastrées (poteaux des puits, de la maison) — les
  décors posés à la main reposent bien. Les instances (tonneaux, caisses, lanternes des rues)
  ne sont pas testées : raisonné sur le code, tonneaux et caisses du quartier s'enfonçaient
  de 8 à 15 cm dans la dalle des trottoirs — remontés de 10 cm.
- **Les pieds dans les pavés** (feu vert d'Eugène) : les chaussées étaient dessinées 13 à 19 cm
  AU-DESSUS du sol marchable (le décalage qui évite que le relief perce le ruban). Chaque ruban
  (voiries, trottoirs, bordures, chemins, voie des combattants, route de campagne) grave
  maintenant sa surépaisseur réelle, triangle par triangle, dans une grille d'un mètre
  (`graverVoie`, `epaisseurVoie`, carte.js ; 6,5 Mo) que `levelH` ajoute au relief. Mesuré :
  sol marchable = dessin au centimètre sur l'axe des rues (0 à 7 cm au bord d'une cellule).
  Seules les surépaisseurs comptent (un fossé en creux ne creuse pas le sol). ≈ +50 ms au
  chargement. Entrées du bourg, 8 ponts, murs 97,3 %, arpenteur 872 m² : rien ne régresse.
Mesures : murs 97,3 % de rue atteinte, marches sur la rue 44 → 3 ; chargement 13,3–13,7 s.

### P. Sauter par-dessus ce qui est bas (28 septembre)

« Je dois pouvoir sauter au-dessus de tout ce qui est censé se sauter. » Le saut monte à
1,53 m (JUMP_V 8,2, GRAV 22) : de quoi franchir 1,35 m en pratique.
- **Banc `bancs/sauts.mjs`** : rend la profondeur au-dessus de chaque capsule et compare au
  haut de la collision. Signale ce qu'on voit à ≤ 1,1 m mais qui bloque au-delà de 1,4 m.
  59 cas au départ, 28 restants, tous voulus (garde-corps de l'anneau du donjon, parapet des
  galeries, poterne : `citadelle.js:425, 1391, 1459`).
- **Capsules trop hautes corrigées** : rochers (haut = sommet réel, nature.js), tonneaux et
  caisses du quartier (`o.y + 0,95`), décors du bourg (haut tiré de la boîte du modèle,
  matrices mises à jour avant), bancs 0,65 m, chasse-roues 0,8 m (village.js).
- **Le dessus d'un obstacle bas est un sol** (fin de `getH`, engine.js) : sinon Camille
  passait au-dessus d'un gros rocher sans pouvoir s'y poser et retombait contre lui. Ne vaut
  que pour une capsule PONCTUELLE (ax = bx), d'au moins 25 cm de rayon, sans `.bottom`, à
  ≤ 1,6 m du terrain. Un segment (muret, parapet de bastion) en est exclu : la première
  version sans ce filtre faisait marcher sur les parapets des bastions (arpenteur 872 →
  3 595 m², marches sur la rue 3 → 327). `surObstacle(x, z)` le dit aux bancs, qui ne
  prennent plus ce dessus pour un sol mal dessiné.
Mesures : simulation de course et saut sur 89 obstacles isolés, 89 franchis (71 avant) ;
arpenteur 872 m², marches sur la rue 3, entrées 6/6, ponts 8/8 ; chargement 15,4–15,8 s
(somme des étapes). Vu en rendu : Camille debout sur un tonneau du quartier.

### Q. Multi en équipes : drapeaux, arc pour tous, chat de camp (28 septembre) — **fait**

Eugène a remplacé le « trésor commun » par une **prise des drapeaux** (nombre =
arrondi supérieur(joueurs ÷ 2) − 1), puis demandé un **chat de camp** où les bots disent
leurs intentions. Tout est décrit dans docs/NOTE-MULTI.md (« La prise des drapeaux », « Équipement
égal », « Parler à son camp »). Mesuré au banc (7 bots vétérans) : les trois drapeaux
changent de mains, la garnison l'emporte 3 à 0 avec badge Conquérant, les phrases des bots
arrivent au camp seulement ; chargement 14,9 s (somme des étapes).
- **À voir** : une manche démarre dès qu'on est deux, bots compris — donc pendant que
  l'humain charge et choisit son camp ; en chrono ou en drapeaux, il arrive en cours de
  manche. Attendre que tous les humains soient en jeu avant le compte à rebours ?
- **Idée restante** : l'écran de fin de manche à 10 points en balade par équipes.
- **Retours d'Eugène (même jour)**, faits : drapeaux tirés au sort parmi 20 emplacements
  répartis dans l'enceinte (plus le donjon, grille fermée) ; bots vivants dès l'arrivée ;
  drapeaux et joueurs sur la minicarte, la carte M (donnée d'office en instance) et la carte
  du choix d'arrivée ; armoire en ~2 s au lieu de 5,8 (cf. § 5, shaders).

### R. La fluidité en jeu (28 septembre, soir) — **en cours, rien de publié**

Eugène : « améliorer les performances par deux », pour lui (Mac, Iris Plus 655, Retina) et
pour les testeurs. **Nouveau banc `node bancs/fluidite.mjs [1-4|auto] [étiquette]`** : six
lieux, quatre caps, 1440 × 900 Retina, sans vsync ; `TLOC_ENGINE=f.js` pour un A/B contre
`git show HEAD:engine.js`, `TLOC_ECHELLE` pour fixer la définition calculée.
- **Diagnostic** : sur le Mac c'est la CARTE qui limite, pixel par pixel (éclairage PBR : un
  matériau sans lumière irait 2,4 fois plus vite ; ombres, reflets du ciel, feuillages pèsent
  chacun 15–20 %). En 1× c'est le processeur (préparation des appels, 93 % du fil principal).
- **Défauts trouvés** (engine.js) : le compositeur gardait son ratio de pixels de création
  (1,5) — baisser la résolution ne faisait RIEN avec le post-traitement ; les touches 1–4
  n'avaient plus de gestionnaire ; la qualité auto-abaissée était gardée à vie
  (`tloc_quality`, remplacée par `tloc_qualite`, écrite seulement par un choix au clavier) ;
  l'automate mesurait sur le dt borné à 50 ms ; les instanciés partageaient un VAO (2 866
  `vertexAttribPointer` par image → 0, `separerGeometries`) ; nature.js dessinait les plantes
  « clairsemées » absentes (matrices nulles : triangles identiques à tous les niveaux →
  `Couche.pas`, `refaire()` resserre).
- **Fait** : ombre du soleil une image sur deux (`OMBRE_PAS`) ; image calculée plus petite
  puis agrandie, FXAA à basse définition et netteté adaptative à la sortie (`sortie`,
  `antiCrenelage`, `echelleRendu`) ; automate : l'échelle d'abord (plancher 0,7 pixel par
  point), les effets ensuite ; post-traitement jamais éteint par la qualité (sa bascule
  recompilait tout) ; au-delà de `OMBRE_NETTE` (35 m) ombre à 4 texels au lieu de 16, lampes
  hors de portée sautées (ShaderChunk patché au démarrage, +11–12 % en A/B) ; **panneau de
  performance du compte Createur** en bas à gauche (tloc-multi.js → `perfCreateur`), F3 pour
  tous, `?perf` dans l'adresse.
- **Mesuré** (machine chaude) : qualité 1, 9,9 → 16,1 img/s (18 à froid), image calculée
  à 0,75 point, un peu plus douce (captures comparées au bourg et au moulin) ; mode auto
  20,6 → 25,1 img/s, pire image 50–95 → 57–96 ms. **Pas encore ×2 en auto** : il reste un
  plafond géométrique (~2,5 M de triangles près de Camille : bâti fusionné 1,2 M, herbe,
  arbres) qu'aucun niveau ne réduit.
- **Retour d'Eugène** : « c'est super mieux ». **Pont infranchissable à cheval** : tous les
  ponts relevés commençaient par une marche de 45 à 52 cm (les 38 cm du tablier posés d'un
  coup au bout) — `hauteurPont` (carte.js) les fait monter sur 3 m. Mesuré sur les 16 bouts,
  cinq trajectoires chacun : marche ≤ 0,12 m, tout passe (sauf au ras des parapets de la
  Passerelle Edmond Ory, 3,6 m de large : normal). Pas encore revu en rendu.
- **Demandé par Eugène le 28 au soir, À FAIRE demain** : (1) la carte (M et le choix
  d'arrivée, atlas.js) sur presque tout l'écran — elle n'en occupe qu'un tiers ; (2) les
  drapeaux du mode équipes tirés sur TOUTE la carte, pas seulement dans l'enceinte
  (tloc-multi.js, les 20 emplacements).
- **Reprise du 30 septembre (autonomie)** — mesures en A/B alterné contre la version publiée
  (`TLOC_ENGINE`), six lieux, 1440 × 900 Retina :
  - **Le banc mesurait à côté** : bancs/*.mjs importaient `engine.js?v=29`, un SECOND moteur
    quand la page est en v33. Ils importent maintenant l'adresse chargée (ressources de la page).
  - **Le goulot est la carte graphique** (avec ANGLE/Metal, le coût fixe de chaque appel de
    dessin tombe aussi dans son chrono) : le temps « rendu » du processeur égale celui du GPU,
    il attend. Enlever 30 % des appels n'a rapporté que +3 %.
  - **Fait** (engine.js) : petits objets animés (monstres, coffres, torches, oiseaux, rayon
    < 4 m) sur le calque lointain au-delà de 80 / 130 m (`trierPersonnages`, `vivantsLoin`) —
    2 655 → 1 517 appels au bourg ; matrices figées des produits de la fusion (`figerMatrices`,
    1 880 objets) ; troncs d'arbres au-delà de 450 m (`TRONC_LOIN`) ; **plus de MSAA sur le
    canevas** (il ne lissait rien : la scène passe par les images du post-traitement ; +9 %),
    FXAA toujours actif (auparavant rien ne lissait à pleine définition).
  - **Résultat** : qualité auto 26,9 → 29,9 img/s (+11 %), qualité 1 12,8 → 14,1 (+10 %) ;
    au bourg à réglage figé (q4, ×0,7) 24,6 → 32,4. Chargement inchangé (13,0 s).
  - **Essayé, abandonné** : feuillages en Lambert (+2,5 %, dans le bruit ; il faut compenser
    `scene.environment` que le Lambert ne lit pas).
  - **Ce qui reste pour aller plus loin** : (1) un plancher de définition plus bas (0,6 au lieu
    de 0,7 : la carte est limitée par les pixels) — à décider avec Eugène, l'image s'adoucit ;
    (2) fusionner les morceaux IMMOBILES de chaque monstre (un oiseau : 41 appels) ;
    (3) des niveaux de détail pour la forêt (silhouettes au-delà de ~300 m).
- **Suite proposée** : niveaux de détail du bâti fusionné et des arbres par distance ;
  chargement à remesurer machine froide (18,8 s en somme des étapes à chaud, « quartier »
  non modifié +35 % : la chaleur) ; `bump.py` avant de publier.

### S. Les demandes d'Eugène du 29 septembre (multi, carte, accueil) — **faites le 29, rien de publié**

Notées telles quelles, par thème.

**Mode drapeaux**
- Écran des scores : le compte de drapeaux PAR ÉQUIPE, avec le détail de chaque équipe à côté.
  **Fait** : deux colonnes (`afficherResultats`, `.en-camps`), compte en gros, tenue, joueurs
  et badges du camp ; le camp gagnant cerclé d'or. Vu en capture sur une manche d'une minute.
- La zone où les drapeaux peuvent apparaître grandit avec la durée de la partie :
  2 à 3 min → la citadelle seule (le reste de la carte fermé : plus fluide) ; 5 min → plus
  le parc de la citadelle ; 10 min → toute la carte. **Fait le 29** (et l'aire de jeu est
  fermée au-delà, cf. « la partie qui se resserre » ci-dessous) : `proposerDrapeaux` (tloc-multi.js) choisit la
  zone sur `manche.duree` (< 5 min citadelle, < 10 min parc, sinon tout) ; le parc = ce
  qu'on atteint sans franchir un pont du relevé (`intraDeule`), à moins de `PARC_BOIS_R` du
  tracé et hors du tissu bâti (`enQuartier`) — le relevé ne ferme pas la Deûle tout autour.
  Vérifié au banc (instance locale, 7 bots vétérans) : 3 min → 20 emplacements dans la
  citadelle, grille en 4 s ; 5 min → parc, bois, fossés, Esplanade ; 10 min → toute la
  carte, et en vraie partie les bots font 300 m, prennent, repartent (drapeaux changés de
  mains). **Restes** : la grille de toute la carte met 30 à 50 s à se remplir (6 ms par
  image) — les drapeaux n'apparaissent qu'après ; un bot virtuel qui suit la grille atteint
  13 emplacements sur 20 (les vrais ont un repli de contournement) ; un bot sur sept est
  resté immobile au banc.
- **Corrigé en route** (bots et grille) : la grille ne franchissait aucun pont (citadelle =
  île) ; `avancer` refusait tout pas au-dessus de l'eau (règle d'eau partagée désormais :
  `surOuvrage`, carte.js, pour le moteur ET les bots) ; progression jugée à vol d'oiseau
  (les bots lâchaient la grille au premier détour) ; murs minces entre deux cases (bits de
  passage `est`/`sud`) ; grille au ras du relief au lieu de la hauteur marchée, et au sol
  SOUS les ponts relevés au lieu du tablier ; coins coupés dans `pasVers` ; report derrière
  le mur frôlé ; noms d'emplacements (« le les rues de Lille »).
- La carte (M et choix d'arrivée) couvre l'écran (`couvrir`, atlas.js) — fait le 29.

**La carte qui rétrécit, dans les autres modes**
- Chrono : à 5 min de la fin, on se resserre sur le parc de la citadelle (l'intra-Deûle) ; à
  2 min 30, le pont de la citadelle se referme.
- Match à mort : un resserrement au bout de 5 min de jeu, un autre au bout de 10 min.
- Une animation et une annonce 50 secondes avant chaque changement de taille.
- **Fait** (tloc-multi.js, « La partie qui se resserre ») : trois aires mesurées au tracé
  (`sdPent`) — tout, parc (`PARC_BOIS_R`), citadelle (2 m) ; calendrier par règle
  (`calendrierAire`), sur le chrono de la manche (le serveur envoie désormais `depuis`,
  le temps écoulé, pour le match à mort qui n'a pas de chrono). 50 s avant : annonce, compte
  à rebours au bandeau, rideau de lumière à la future limite (`rideau`) ; ensuite, hors de
  l'aire, un demi-cœur toutes les 1,5 s (`encaisser`, bots par `recevoirPourBot`),
  réapparition toujours dans l'aire (`pointDansAire`), bots qui rentrent (par le pont de la
  Porte Royale pour la citadelle). La **herse de la Porte Royale** est mobile
  (`PARTAGE.herse.poser`, citadelle.js : un seul maillage, collision seulement baissée).
  Vérifié : chrono de 200 s, herse baissée à 50 s, les trois bots et moi dans la citadelle.
  Les deux cartes (minicarte, M) tracent l'aire en vigueur en trait plein et la prochaine en
  tirets (`PARTAGE.aires`, hud.js, atlas.js) — vu en capture.

**Multijoueur, tous modes**
- La grille du donjon ouverte ; Phinaert est un monstre comme les autres : l'onde de choc de
  sa masse frappe tout le monde.
- La porte du donjon est ouverte, mais son dessin ne l'est pas : à mettre d'accord.
- Bug : en choisissant l'apparence (armoire) en multijoueur, le personnage ne s'affiche plus.
- **Faits** : en instance, `ouvrirDonjon` (tloc-multi.js) ouvre l'enclos (`openGate` de la
  quête) ; la mort de Phinaert n'y lance plus la cinématique ; `CROCHETS.onde` (engine.js)
  fait encaisser les bots à son onde (vérifié 12 → 10). Le portail de l'enclos est un
  PORTAIL sur gonds qui pivote (`donjonGate.userData.poser`, citadelle.js) au lieu d'une
  grille levée de 3,3 m qui flottait en l'air — en solo aussi. La barre de Phinaert n'est
  plus affichée qu'à moins de 60 m de lui. L'armoire : le clignotement d'invincibilité figé
  sur « éteint » à l'écran titre cachait Camille (on arrive invincible en équipes) — il ne
  clignote plus que si le temps passe, et l'armoire rallume Camille.

**Accueil**
- Des icônes à côté des règles : balade (marcheur ou chemin), match à mort (pierre tombale),
  chrono (horloge).
- Des titres de sous-sections dans l'encadré multijoueur.
- Réagencer les trois encadrés : les deux premiers prennent trop de place ; toutes les infos
  du multijoueur doivent se voir sans défiler sur un écran d'ordinateur ordinaire.
- **Faits** (accueil.html, tloc-portail.css) : icônes chemin, pierre tombale, horloge,
  drapeau ; sous-sections « Mode de jeu / Règle / Déroulé / Bots » en deux colonnes ; « Seul »
  et « Rejoindre » compacts à gauche, « Ouvrir une partie » à droite ; le titre se tasse sous
  820 px de haut. Pire cas (équipes, chrono, bots) vu sans défiler en 1440 × 800 et
  1366 × 680, clair et sombre ; une colonne sur téléphone.

Chargement après tout ça : 13,7 s en somme des étapes (froid), 15,0 s (relance) —
`bancs/resultats/charge-2026-09-29-multi-aires.json`.

**Publié sur le dev le 29 (`00d3ce9`, version 28)** — à essayer par Eugène avant « Promouvoir ».
Depuis, en local (non publié) :
- **Personnages lointains** (engine.js, `trierPersonnages`) : au-delà de 140 m, un riggé passe
  sur un calque que ni la caméra ni l'ombre ne voient (squelette non recalculé) ; les géants
  restent. 112 personnages sur 129 écartés au moulin. Banc, qualité 1 à ×0,75 : 19,6 img/s
  (16,1 avant, machine chaude) — ×2 depuis le départ (9,9).
- **Mesure qui clôt une piste** : 82 % des triangles de décor sont dans des objets de plus de
  20 m (quartier, remparts, sols) ; les petits objets (< 2 m) n'en font que 13 %. Un niveau
  de détail des petits décors rapporterait peu.
- **Drapeaux** : la grille des chemins se remplit aussi pendant l'arrivée (titre, armoire,
  carte : 14 ms par image, jeu figé) — drapeaux posés 18 s après l'entrée en jeu au lieu de
  30 à 50. Le bot immobile du banc précédent n'a pas été reproduit (7 bots sur 7 en route).
- **Rideau de l'aire** : raies franches et liseré au sol (il passait pour la lumière du soir).
  Piège : une variable GLSL accentuée (`liseré`) casse le shader sans bruit — ASCII seulement.
- Ponts revus en image : les bouts de tablier sont au ras du sol.

**Reprise du 29 au soir — les quatre points d'Eugène, dans l'ordre** (rien de publié) :
- Bandeau des drapeaux : « ⚑ Les drapeaux arrivent dans ~N s » tant que la grille se remplit
  (`attenteDrapeaux`, tloc-multi.js). Fait, vu.
- **1. Frappe en selle** : faite et vérifiée (docs/NOTE-MULTI.md, « La frappe en selle »).
- **2. Textures KTX2** : ESSAI FAIT (accord d'Eugène), NON ACTIVÉ par défaut — décision
  d'Eugène. `KTX2Loader` et le transcodeur Basis de three r160 sont dans lib/addons ;
  `?ktx2` dans l'adresse fait lire les .ktx2 à la place des .webp (assets.js,
  `TextureKTX2` : niveaux et format lus sur la source commune, sans quoi les copies faites
  avant la fin du chargement restaient vides). `node outils_ktx2.mjs` (encodeur Basis
  Universal hors dépôt, `BASIS_ENCODER=…/basis_encoder.js`) convertit les 176 textures
  (Poly Haven, forêt) en ETC1S qualité 255, en 7 min ; les .ktx2 sont ignorés par git.
  Mesures : sur 10 textures, ETC1S 128 −58 % / 255 −34 % pour les grandes couleurs mais les
  petites cartes (512²) grossissent — **23,0 Mo → 23,0 Mo au total** ; UASTC 3× plus lourd
  (écarté). Fidélité ETC1S 255 : 26–34 dB, léger adoucissement à taille réelle, rien de
  visible en jeu (captures du bourg). Chargement : préparation du rendu −1 à −1,5 s
  (entrelacé, bruité) ; mémoire graphique ÷ 4 (BC7) ; **cadence en jeu inchangée**
  (15,7 → 15,4 img/s). Intérêt surtout pour des cartes graphiques à court de mémoire.
- **3. Banc d'accessibilité** `node bancs/acces.mjs [page]` : FAIT (1 min 40 pour tout).
  Inondation aux règles de Camille (marche 0,5, saut 1,3 ; 1 m dehors avec sous-pas de 25 cm,
  25 cm dedans), puis une passe fine à 25 cm et à étages illimités (un colimaçon empile onze
  tours) autour de chaque interaction non atteinte ; le rapport donne la case atteinte la plus
  proche. Trois pièges du banc lui-même, chacun démasqué par une vraie marche de Camille
  (`tryMove`) : escaliers raides, colimaçons, départ dans une collision. **Vrai défaut
  trouvé et corrigé** : le petit coffre du bastion du Dauphin était posé au-delà de son
  parapet (1,4 m), inatteignable — `quetes.js` exige maintenant une ligne droite dégagée
  depuis l'arrivée de la rampe (ou le centre) jusqu'au coffre. Résultat : 21 interactions sur
  21 dehors, tout atteint dans les intérieurs ; à la cave, Eugène et le coffre de la galerie
  sont derrière la grille du levier (voulu).
- **4. Écran de victoire en balade par équipes** : FAIT. Le serveur (`victoire_balade`,
  `VICTOIRE_BALADE` = 10, `TLOC_VICTOIRE_BALADE` pour le banc) donne la victoire au premier
  camp à 10 points (mise à terre 1, bannière 3), diffuse `victoire` avec l'apport de chacun,
  puis remet points et bannières à zéro. Le client (`afficherVictoire`) montre les deux camps
  côte à côte ; « Continuer », Entrée ou Échap, ou 15 s. Le panneau dit l'objectif. Vérifié
  avec 7 bots et un objectif abaissé à 2.

### T. Retours d'Eugène sur ses captures (29 septembre, soir) — **faits, rien de publié**

- **Les « trucs noirs » du moulin** : les haies IGN (`haiesIGN`, carte.js) étaient deux plans
  continus tendus de `forest_leaves_04` — une texture de SOL, sans transparence. Ce sont
  maintenant des touffes détourées (la carte `buisson` des buissons de nature.js), une tous
  les 1,1 m, teinte sombre (la carte seule jaunit au soleil).
- **Score en miroir** (`scoreMiroir`, tloc-multi.js) : « La garnison 0 – 2 Les gens du
  bourg » en tête de la fin de manche aux drapeaux et de la victoire en balade ; les colonnes
  de chaque camp restent dessous, sans leur gros chiffre.
- **Accueil** : à 1000 × 536 (l'écran d'Eugène), « Rejoindre » est entier. Le grand titre
  part sous 640 px de haut, les sous-titres des tuiles aussi ; les réglages de « Ouvrir une
  partie » restent sur deux colonnes jusqu'à 820 px (ils passaient en une seule dès 1080 px :
  c'était le vide) ; la seconde rangée prend le surplus, « Rejoindre » colle à « Seul ». Au
  pire (équipes, drapeaux, bots), seul le bouton « Créer » dépasse de 18 px.
- **Icônes de règle** : Balade = deux empreintes de pas ; Drapeaux = un drapeau planté dans
  son cercle (on le tient pour le prendre). *À confirmer : « l'icône capture » était-elle
  bien celle-là ?*
- **Carte plein écran, tournée** (`couvrir`, `versEcran`/`versMonde`, atlas.js) : le relevé
  couche son grand côté sur celui de l'écran (−75° en paysage) et le couvre ; clic, glissé,
  flèches passent par l'inverse exact. La flèche du nord tourne avec, les noms restent droits.
- **Drapeau « derrière un faux mur »** : les emplacements restent à 40 m de l'enceinte
  (le mur de fin du monde coupe des rues ; il ne se voit pas là où elles le traversent — à
  rendre visible un jour).
- **Les ouvrages avancés deviennent des reliefs** (`talusDehors`, `talusMaillage`, carte.js) :
  côté terre ferme, un talus de 7 m, arrondi en haut, descend du terre-plein au pré ; côté
  fossé l'escarpe reste droite. Maillé en jupe depuis le bord même (une grille à cheval sur
  le bord laissait voir l'escarpe). Marche simulée depuis 11 m dehors : tous les côtés secs
  des 9 demi-lunes et contregardes se gravissent (pas max 0,09 m) ; la lunette du Grand Carré
  touche la limite du monde. Chargement inchangé (≈ 14,4 s de somme d'étapes).
- **Repris le 30 septembre** (Eugène, 29 au soir : « problème avec les nouvelles zones
  surélevées »). Vu en rendu, au ras du sol, autour des onze ouvrages : le talus décidait
  point par point s'il était au bord de l'eau (`sdEau`) ; le long d'une rive la réponse
  alternait, et la crête sortait en dents de scie, avec des pans d'escarpe debout entre deux
  bouts de pente. Désormais un verdict par CÔTÉ (`cotesSecs`, carte.js : sec si la majorité de
  neuf points, 3 m dehors, est hors de l'eau), partagé par le sol et le maillage ; une bande
  du maillage n'est posée qu'entre deux rayons vivants. Les roseaux ne poussent plus sur les
  talus (nature.js). Marche simulée : tous les côtés secs se gravissent (pas max 0,46 m, coin
  de la demi-lune Dauphine). *Si Eugène voyait autre chose : lui demander une capture.*
- **La fosse sans issue** (Eugène, 30 septembre : « entre la rampe et le talus, un espace
  où l'on tombe sans jamais pouvoir ressortir »). Trouvée par une double inondation aux règles
  de Camille (pas de 0,5 m ; aller depuis le pré, retour vers le pré — script de session
  `fosses.mjs`, à reprendre en banc si besoin) puis confirmée par de vraies marches : la
  berme sèche au pied de la contregarde de Turenne, entre la paroi et l'eau (224 m², ~100 m
  de long), où l'on descendait par son bout, depuis le pré, sans remonter. Chaque côté mouillé
  a désormais deux limites invisibles (`terrassesDehors`) : un garde-fou en haut du
  terre-plein, et la berme elle-même occupée sur 2,4 m. Plus aucune fosse atteignable autour
  des onze ouvrages ; les montées restent toutes possibles.
- **Talus validés par Eugène le 30 septembre** (version 33 en ligne) : chantier clos.

### U. Accueil refait, badges classés, page admin (29 septembre, nuit) — **faits, rien de publié**

- **Accueil** : « Rejoindre des amis » est une barre fine sur toute la largeur (visible même
  avec une partie en cours) ; dessous, « L'Épopée du Plat Pays » (le solo, renommé) et
  « Ouvrir une partie » en trois étapes empilées de hauteur fixe : mode de jeu (Balade, Match
  à mort, Chrono, Drapeaux ; le réglage — vies, durée à la minute, 5 min par défaut — se
  glisse dans la même ligne pendant que les autres modes se replient en icônes ; description
  en bulle au survol), seul ou en équipes (Drapeaux fige « Chacun pour soi »), bots. Nom de
  partie obligatoire ; « Lancer la partie » crée et fait entrer. Tout tient à 1000 × 536.
  *Reste ouvert* : une prise des drapeaux à chacun pour soi (le serveur l'impose en équipes).
- **Badges, deux sortes** (serveur : `BADGES`, `badges_de_manche`, `hauts_faits`) : un STYLE
  DE JEU par manche (12, du Badaud au Faucheur : le plus haut rang mérité) et des
  RÉCOMPENSES en plus — 5 exploits de manche (Vainqueur, Rempart, Fléau des Flandres,
  Intouchable, Globe-trotteur) et 15 hauts faits une fois pour toutes : voyage (5 / 15 / 42 /
  100 km — mètres comptés par le serveur sur les positions en multi, par `state.distance` en
  solo), quêtes (lues dans les parties solo synchronisées), fidélité (manches jouées et
  gagnées, table `compteurs`). Quatre rangs : commun, rare, épique, légendaire. Onglet Badges
  classé par famille et par rang, avec la progression. Vérifié par une vraie manche de chrono
  contre 5 bots : un style chacun, « Vainqueur » en plus pour le gagnant.
- **Cavaliers distants** : le serveur retirait `ch` (à cheval) de l'état relayé ; les autres ne
  voyaient pas le cavalier en selle. Relayé désormais (et sert au badge Chevalier).
- **Page admin** (`admin.html`, `admin.js`, `/api/admin/detail`, créateur seul ; `/admin` en
  local) : tableau de bord, joueurs triables (dernière visite, solo, quêtes, km, manches,
  badges), parties en cours, manches, parties ouvertes, répartition des badges, retours des
  testeurs. Les comptes des bancs (`banc` + 6 hex) sont masqués par défaut. En production,
  le lien pointe `admin.html` (l'adresse `/admin` dépend de nginx).
- « Se déconnecter » cerclé de rouge.
- **Accueil, 30 septembre** : deux tuiles. « Mode Solo : Pursuit of Prince Eugène » (sans
  sous-titre) ; « Mode Multi » porte le nom de la partie et « Lancer la partie » sur sa ligne
  de titre, et « Rejoindre une partie » en bas de la même tuile, encadré terracotta. Les modes
  ne se replient plus (Eugène : ça perdait l'œil) : quatre cases fixes, et dessous une bande
  de hauteur fixe — description du mode, réglage (vies, durée) à droite, en fondu seul —
  comme les règles de combat de Smash Bros. ou les onglets de Rocket League. Tout tient à
  1000 × 536, partie solo en cours comprise. Au passage : les boutons de la barre du haut
  glissaient au milieu quand le bandeau des testeurs est masqué (grille à trois colonnes) —
  épinglés à droite. *Reste* : la bulle du chat (fixe, en bas à droite) recouvre en partie
  « Rejoindre » à 1000 px de large.
  Puis : icônes une personne (Solo) / un groupe (Multi), une porte pour « Rejoindre » ;
  seul l'encadré « Rejoindre » est plein (terracotta), les tuiles gardent leur transparence ;
  un fléchage vers l'historique — lien « Toutes tes parties ↓ » dans la tuile Solo et
  pastille fixe en bas à gauche, qui s'efface dès qu'on descend.

### V. Retours d'Eugène du 30 septembre, après la version 34 — **faits en local, rien de publié**

- **Écran blanc en solo** (compteur « appels 0 », jeu qui tourne) : contexte WebGL perdu que
  le jeu ignorait. `webglcontextlost` (engine.js) : on sauvegarde, on le dit, on recharge sur
  la partie en cours (`tloc_auto`). Vérifié en provoquant la perte (`WEBGL_lose_context`).
  Pas de fuite mémoire mesurée (tas 1,5 Go qui redescend à 750 Mo).
- **Multi** : plus de menu titre après le chargement (`tloc_auto = 'instance'`, posé par
  `activerInstance`) ; « Lancer la partie » crée la partie, copie le code et attend un second
  clic, « Entrer dans la partie » (`montrerPartiePrete`, accueil.js).
- **Trêve d'une minute** au début de toute partie à plusieurs, balade comprise
  (`MANCHE_OUVERTURE`, app.py) : aucun coup ne porte pendant un compte à rebours, les bots ne
  voient pas d'ennemi (`treve()`), le bandeau dit « La partie commence dans 0:58 — trêve ».
- **Descendre de cheval** : on met pied à terre du côté libre, en respectant les collisions,
  puis sur le vrai sol (`descendre`, tloc-multi.js). *Pas revérifié en jeu (il faut un cheval).*
- **Rampes des bastions** (banc de session `rampes.mjs`) : à Turenne, le mur de soutènement
  d'une galerie coupait la rampe à mi-hauteur — `murPerce` (citadelle.js) l'arrête au bord de
  la rampe, ou le perce d'une arche s'il la traverse de part en part ; au Dauphin, un bout de
  courtine de longueur nulle (5,5 m de rayon) bouchait le haut de la rampe (`percerCouloir`
  laisse tomber les tronçons de moins d'un mètre). *Reste* : quelques accrocs en bordure de
  rampe (Reine, Anjou : chute latérale du palier) — le milieu passe partout.
- **Match à mort, retours du 30 au soir** (version 35 en ligne) :
  - l'armoire ne montrait pas Camille : entrée directe en partie, le jeu se met en pause avant
    d'avoir posé le modèle à la position (resté à l'origine) — `ouvrirArmoire` le pose d'abord ;
  - arrivé « dans une zone bloquée entre trois murs » : `praticable` ne disait pas qu'on pouvait
    en SORTIR — `ouvert` (tloc-multi.js : inondation au mètre, pas de 0,5 m, il faut s'éloigner
    de 25 m) valide le point d'arrivée de la carte (`praticableOuvert`) et celui de la manche ;
  - tous les bots au même endroit que le joueur : en manche, `pointEparpille` les disperse
    dans l'aire, ouverts, à 25 m les uns des autres, dans 200 m autour du joueur (100–190 m
    mesurés) ;
  - éliminé : l'invincibilité infinie faisait clignoter Camille sans fin et on errait —
    SPECTATEUR (`G.spectateur`, engine.js : caméra sur un participant en lice, Camille cachée et
    immobile ; clic : le suivant). Vérifié par deux morts via `encaisser` (instance à 2 vies) ;
  - les parapets du toit des galeries (1,05 m) se sautent : collision arrêtée à leur hauteur
    (banc `sauts.mjs` : 30 → 24, le reste voulu).
  - **on saute à cheval** (engine.js : le saut n'exclut plus `G.monte` ; la roulade si). Le
    cheval suit la hauteur de la cavalière (tickChevaux). `cheval.glb` et `cheval_blanc.glb`
    refaits avec `Gallop_Jump` (`glb.py`, +120 Ko chacun) : joué une fois au décollage, accéléré
    ×1,9 (1,47 s de clip pour 0,75 s en l'air) ; pour le cheval d'un autre, « en l'air » se lit à
    sa hauteur au-dessus du sol. Clip vu en rendu isolé ; *pas encore vu en partie*. Le clip
    soulève un peu le corps : à juger en jeu (double hauteur ?).
  - **« enfoncée » au bout d'un bastion** (arrivée en partie) : pas un défaut de sol — apparue
    contre le parapet (1,3 m) et tournée vers l'intérieur, Camille avait la caméra au-dessus du
    fossé, qui la filmait par-dessus le parapet. `orienterArrivee` (tloc-multi.js) la tourne vers
    le côté où, jusqu'à 7,5 m derrière elle, le sol est praticable et au même niveau ; appelé au
    point d'arrivée choisi, au début de manche et à la relève. (Le relevé « on marche sous le
    dessin » des bastions compte le parapet, que sa capsule rend inaccessible : faux positif.)

### W. Le solo réservé au créateur (30 septembre, soir)

Eugène : « à part pour le créateur, rends le mode solo inaccessible — en préparation ».
- **Accueil** (`ouvrirSolo`, accueil.js) : la tuile Solo est FERMÉE par défaut (« Le mode solo
  est en préparation. Patience : attends de voir ce que le créateur mijote… ») et la liste des
  personnages cachée ; elle ne s'ouvre que si `/api/profil` répond `createur`. Le résultat est
  mémorisé (`tloc_solo_ouvert`).
- **Page de jeu** (tloc-multi.js, en tête) : hors d'une partie à plusieurs et sans ce feu vert,
  on repart à l'accueil avant tout chargement. Les bancs (Playwright, `navigator.webdriver`)
  passent. Vérifié : compte ordinaire renvoyé, créateur (serveur de test isolé) accepté.
- *Pour rouvrir le solo à tous* : `ouvrirSolo(true)` inconditionnel et retirer la garde.
- **On entre par l'accueil, pour tous** (index.html, script de tête) : ouvert directement,
  index.html renvoie à l'accueil — sauf un rechargement (`performance` navigation `reload`), une
  arrivée depuis l'accueil (`tloc_entree`, posé par accueil.js et accueil-social.js juste avant
  la navigation, consommé à l'arrivée) ou une navigation du jeu (`tloc_auto`, `tloc_arrive`).
  Vérifié sur les quatre cas.

### X. Le point rouge de l'arc (30 septembre, soir)

Eugène : « quand je tire à l'arc, un point rouge / une cible qui indique où je vais tirer ».
`viseeArc` (engine.js) fait la visée, commune au tir et au viseur (regard + inclinaison à la
souris, ou ajustement sur un monstre à < 34 m et < 0,6 rad) ; `majViseur` fait voler une flèche
fantôme exactement comme `updateArrows` (40 m/s, retombée 2,5, 1,5 s) jusqu'au sol, à un mur ou
à un monstre, et pose là un point rouge (sprite de taille constante, vu à travers l'herbe).
*Limite* : en multi, il ne s'arrête pas sur les autres joueurs (la flèche, elle, les touche par
proximité, tloc-multi.js `coupsFleche`).

### X. La musique, et le rangement du dépôt (30 septembre, soir) — **faits, vérifiés**

- **Musique** : 13 morceaux (`assets_back/05_audio/musique/`, m4a, lus en flux, rien au
  chargement). Le lecteur est dans `SFX` (engine.js) : fondu de 3 s, changement après 3 s dans
  la nouvelle zone, reprise là où l'on en était. Chaque niveau dit son ambiance : la ville par
  `ambiance(zone)` (carte.js, d'après les noms de `zoneName`), un intérieur par `musique:`.
  La cave garde la nappe synthétisée. **La fanfare** (« Ralis sauvé ») : `SFX.fanfare(duree)`
  aux quêtes terminées, au prince libéré, à la herse (jusqu'au bout) et à la victoire.
  *Pas encore écouté par Eugène : volume (0,3) à juger.*
- **Rangement** : notes dans `docs/`, relevés dans `bancs/resultats/` (les bancs y écrivent).
  Liste des suppressions possibles : `PLAN-2026-10-01.md`, § 2.

### Y. Garde-fous et mobile (30 septembre, nuit) — **faits, publiés sur le dev**

- **Garde-fous** : `bancs/controle.mjs` (syntaxe en module, démarrage des six pages, banc en
  médiane de 3, mémoire affichée) ; `publier-dev.sh 'msg' chemins…` le passe et n'envoie que
  les chemins donnés ; hook `.claude/garde.py` (git interdits, `.claude/verrous.txt`).
  **`node --check x.js` ne voit pas les erreurs d'un module ES** (Node 24) : `--input-type=module`.
- **Mobile en bêta** (`?mobile=1`) : tout est dans `PLAN-2026-10-01.md`, § 3, avec l'essai à
  faire sur un vrai téléphone et le risque mémoire mesuré.
- **Mémoire, 1er octobre** : les grands lots (`regrouperLots`) rendent leurs tableaux après
  l'envoi à la carte — tas JS 780 → 582 Mo, rayons du ciel et image inchangés. Détail et
  mesures : `PLAN-2026-10-01.md`, § 3.
- **Le prologue (1er octobre)** : joué de bout en bout d'après `STORY.md` (`quetes.js` pour
  presque tout ; la cloche dans `village.js`, ses sons dans `engine.js`, Houtland dans
  `pnj.js`). `docs/DECOUPAGE-PROLOGUE.md` dit ce qui est fait, plan par plan, et ce qui
  reste ; `PLAN-2026-10-01.md` ce qu'Eugène doit trancher. *Code mort* : la branche
  « sans serment » d'`introScene` (l'ancienne intro) ne sert plus, « Passer » joue `rappel()`. Ce qu'Eugène doit fournir pour toute l'histoire : `docs/BESOINS-HISTOIRE.md`.
  *À regarder* : de part et d'autre du pont, des touffes de roseaux semblent posées sur
  l'eau des douves (visibles sur `docs/planches/prologue-v2.jpg`) — pas touché.
- **L'île du temps (1er octobre)** : le Temple des Géants, `temple.html` / `temple.js`,
  passage provisoire par la dalle de la place d'Armes. Tout dans `docs/TEMPLE-ILE.md`.
  `temple.html?mondes=tous` ouvre tous les mondes pour l'aperçu.
  *Banc* : dans Playwright, `keyboard.press('z')` ou `'w'` ne fait pas marcher Camille ;
  on la déplace par `TLOC.player.pos`. Le poids réseau du banc varie de 35 à 42 Mo pour le
  même code : `response.body()` échoue parfois (le 1er, `Male_Ranger.bin` manquait au
  relevé alors que Lydéric le portait à l'écran). Juger le poids sur plusieurs passes.

### Z. Les îles de Thaïlande resserrées (4 octobre) — **faites, vérifiées en rendu**

Eugène : « c'est l'espace de balade qui est immense, pas la distance entre les îles ». Chaque île
garde un cœur où l'on marche (`COEURS`, `carte/mondes/extraire-thailande.py`) : Ko Panyi 410 × 340,
le grand piton 270 × 255, Railay 450 × 450 (l'isthme entre ses deux plages), Phi Phi 500 × 420 (Ton
Sai entre ses deux baies, avec les pontons) ; Khao Phing Kan ne change pas. Les îles ne bougent pas
les unes par rapport aux autres. Plans et reliefs complets d'avant : `carte/mondes/complet/`.
- **Trois manières de finir une île.** `falaise` (Railay, Phi Phi) : rues et bâti coupés au cœur, une
  garde de 120 m, puis la mer ; `recolter-relief-thailande.py` dresse une paroi de 24 m à `bord_coeur()`
  du cœur (une ondulation de 0 à 16 m) ; `thailande.js` (`garde()`) bloque à `BORD()` + 3 m — la même
  formule des deux côtés, à changer ensemble. `pilotis` (Ko Panyi) : le village coupé au cœur, la terre
  plate aussi, rendue à l'eau ; le rocher reste entier. `ile` (le grand piton) : l'ellipse de l'île
  passe juste au-delà des coins du cœur ; ses routes finissent dans la mer.
- **Les bouts coupés sont dans le plan** (`PLAN.bouts` : x, z, direction, morceau). Le banc filme trois
  rues coupées dans leur axe : chacune bute sur une paroi de calcaire et de jungle.
- **Deux câbles déplacés.** Railay part du haut du sentier au sud du village (−587, 1920, 48 m).
  Phi Phi part du **belvédère des moines** (2605, 1790, 131 m), au sommet d'un escalier ajouté au plan
  (`ESCALIER`, quatre lacets à 32 m l'un de l'autre ; à 27 m, la grille de 10 m mêlait leurs
  hauteurs). Le relief lui donne une pente constante (il n'est pas recalé sur Copernicus).
- **Praticabilité 95,9 → 98,1 %** (Ko Panyi 97,4, Khao Phing Kan 100, le grand piton 97,1, Railay
  98,7, Phi Phi 97,8), sur 7 400 points de chemin au lieu de 21 200. Le gain vient du relief : là
  où deux chemins se croisaient, le premier imposait sa hauteur au nœud (des marches de 3 à 19 m). Le
  nœud prend maintenant la moyenne pondérée des chemins, en deux passes. Restent 40 points bloqués à
  Ko Panyi (une passerelle sous une maison, à (34, 26)) et 22 à Phi Phi (une rue sous un bâtiment, à
  (2349, 1918)) : déjà là avant.
- **Le disque gris du grand piton (corrigé le soir même, Eugène)** : la plaine de Kanchanaburi (23 m)
  tombait toute à 2 m, un anneau de grève grise autour de l'île. Elle devient un flanc (2 m au bord,
  16 m sous la colline), l'île plonge sur 8 % de son rayon au lieu de 18, l'ellipse est resserrée au
  sud (le quai recalé en (985, 491)) et gardée large au nord (le temple y est à 43 m), et le sable
  des grèves est réchauffé (`parois()`, thailande.js). Captures : `bancs/resultats/lieu-thailande-
  2026-10-04-grand-piton-disque-avant.png` et `-apres.png`.
- **Défauts vus et pas corrigés** : la vue d'ensemble de la baie est mangée par la brume
  (`brume: [.., 260, 3200]`) ; deux 404 au chargement, sans requête visible (sans doute l'icône).

### Lille — la ville resserrée (nuit du 4 au 5 octobre) — **faite et vérifiée, publiée le 5 octobre (c7ef2e9, envoyé avec 9eb4a4d depuis le PC)**

**Ce qui est fait** (en local, `carte.js` et `quartier.js`) :
- **L'emprise** (`VILLE`, `sdVille`, `dansVille`, carte.js) : le bourg et 200 m autour (accord
  d'Eugène), la rive du quai du Wault (70 m de part et d'autre) et un cercle de 200 m à sa droite,
  centré en (60 ; 770). Les trois se touchent : une seule ville. 546 bâtiments gardés sur 1 981.
- **Au-delà** (quartier.js) : le premier rang (35 m) reste en vraies maisons, sans collision — en
  volumes nus, il montrait des pignons aveugles au bout des rues ; puis, jusqu'à 260 m, des volumes
  bas (quatre murs, deux pans, sans ombre portée) ; plus loin, rien. 694 volumes lointains.
- **Les rues coupées** finissent sur un mur de brique à chaperon de pierre et une porte cochère
  fermée (`portesDeVille`) : 162 murs. **Le tissu coupé ne se parcourt plus** (`horsVille`, grille de
  6 m, lue par `levelBlocked`) : à moins de 30 m d'un bâtiment ôté et à moins de 420 m de
  l'emprise. Épargnés : le moulin d'Émile (110 m), la chaumière du mage (200 m), la maison de
  Camille, le petit coffre de l'ouest (−91 ; 539).
- **(a) choisi** : PLAINE_R (1 275 m) et l'enceinte de 1858 ne bougent pas.

**Vérifié** : banc d'accès (`acces.mjs index`) 23 interactions, 0 hors d'atteinte. Le premier essai
fermait le chemin de la chaumière du mage ; corrigé par la limite des 420 m. Banc des sauts sur
la ville : 2 capsules signalées, sur la voie des combattants (campagne.js:462, en (−7 ; 421)), sans
rapport avec la ville. Prologue joué en headless sans erreur, minicarte comprise. Le multi : les
drapeaux sont proposés à chaque partie par le client, d'après la grille des chemins, qui passe par
`blocked` ; le tissu coupé en est donc exclu tout seul. Les aires (parc, citadelle) se mesurent
depuis la citadelle, intacte.

**§ 4.E — ce que la ville coûtait, ce qu'elle coûte** (`charge.mjs` au calme, somme des étapes à froid) :
avant **14,4 s** (quartier 2,2 s, fusion des décors 1,8 s, préparation du rendu 3,8 s, tas 346 Mo) ;
après **11,5 s** (quartier 1,0 s, fusion 1,3 s, préparation du rendu 2,9 s, tas 294 Mo).
Relevés : `bancs/resultats/charge-2026-10-04-ville-avant.json` et `-ville-apres.json`. Les 36,8 s du
2 octobre venaient surtout d'un Mac saturé, pas du code.

**Pourquoi rien n'est publié** : le premier contrôle (4 octobre, 23 h) a mesuré 27,0 s en médiane
(27,4 / 27,0 / 25,8) avec les bancs des autres sessions dans la même fenêtre. Je l'ai remis en file
avec des seuils de calme trop stricts (5 min < 3,5) : la nuit est passée sans qu'il parte. Il est
relancé le 5 au matin avec la règle d'Eugène (1 min < 3).
- Les correctifs du **réalisme** (trottoirs montés de 14 cm avec leur bordure visible, caniveau de
  grès, trottoir coupé au droit des carrefours) et des **passants** (une lavandière au quai du
  Wault, une marchande, un brasseur rue du Gros Gérard, un garde du guet à une porte coupée ; le
  quai du Wault devient un lieu découvert) sont **écrits, pas encore appliqués** : ils touchent
  les fichiers du lot à publier, qu'il faut d'abord envoyer seul. Ils sont dans le dossier de
  travail de la session (`patch-routes.py`, `patch-passants.py`).
- **Seul appliqué en plus** : `nature.js` — plus de roseaux, de saules ni de nénuphars dans le
  bassin du quai du Wault (un bassin de ville bordé de quais de pierre, pas une mare). Non publié.

**Captures à regarder** : `bancs/resultats/ville-avant-*-yeux.jpg` et `-plongee.jpg` (garde, place,
chemin, rue, wault) — l'état avant les corrections de réalisme. Le banc qui les prend :
`bancs/regard-ville.mjs` (Camille y est maintenant placée hors du champ ; sur ces premières
captures, son corps se voit encore devant l'objectif).

**Écarts relevés, du plus visible au moins visible** :
1. Le dallage du bourg (rue de la salle de la garde) : une texture de pierre floue, étirée —
   **c'est village.js** (interdit cette nuit) : à faire par la session qui le possède.
2. Les rues de la ville : trottoir au ras de la chaussée (3 cm sous elle), ni bordure, ni caniveau,
   ni bombé ; au cœur des îlots, un sol brun uni.
3. Le chemin du pont au bourg : un ruban brun à bords francs dans le bois.
4. Le quai du Wault : une berge à roseaux (corrigé, non publié) et pas de quai de pierre ; les
   façades de pierre trop blanches et toutes pareilles.

**Demandes pour d'autres fichiers** :
- `hud.js` (minicarte et carte M) trace encore toutes les rues et tout le bâti relevé, coupé
  compris : les rues coupées y paraissent ouvertes. Il faudrait griser ce qui est hors de
  `dansVille`, ou n'y dessiner que l'emprise.
- `village.js` : le dallage flou du bourg (écart n° 1).

**Questions pour Eugène** :
1. « Le bourg doit être enlevé et les bâtiments faire partie à part entière de cette nouvelle
   ville » : je ne l'ai pas fait. Le bourg (village.js) porte la place, le beffroi, la chapelle,
   l'estaminet, la salle de la garde et tous les personnages du prologue et de l'acte I, et
   village.js était interdit. Pour l'instant, le bourg est fondu dans la ville resserrée. Veux-tu
   qu'il disparaisse au profit des bâtiments relevés (il faudrait reloger beffroi, chapelle,
   estaminet et salle de la garde dans des emprises réelles) ?
2. Le cercle « à droite du quai du Wault » est centré en (60 ; 770), son bord ouest touche le quai.
   Est-ce bien là que tu le voulais ?

Sources de la recherche sur le quai du Wault (dernier bassin portuaire de Lille, aménagé vers 1750,
fermé en 1865, remis en eau en 1994, quais pavés, couvent des Minimes) : fr.wikipedia.org/wiki/Quai_du_Wault,
caue-nord.com (observatoire, le quai du Wault), lilledantan.com.

### Lille — le réalisme et les passants (5 octobre, sur le PC, consigne L) — **faits, vérifiés en rendu, publiés (66f7999 puis c7e6820)**

Les correctifs restés sur le Mac (`patch-routes.py`, `patch-passants.py`) ont été refaits de zéro.

**Lot 1 — 66f7999** (carte.js, quartier.js, campagne.js) :
- **La rue en travers** (`voiriesLille`, `profilGeo`, carte.js) : chaussée de ville à +0,12, bombée par-dessus
  (+7 cm à l'axe) ; caniveau de grès de 45 cm ; bordure de 14 cm avec sa face vue de la rue ; trottoir de
  dalles jusqu'à la façade quand elle est à moins de 5 m (sinon 1,6 m et un glacis vers le sol du quartier),
  2 % de dévers. Le trottoir et sa bordure s'interrompent sur la chaussée d'une autre rue (le carrefour) et
  ferment leur bout. On marche dessus sans rien de plus : `graverVoie` lit déjà les surépaisseurs.
- **Les seuils** (quartier.js) : portes, devantures, tonneaux et caisses se posent sur ce qui est dessiné
  devant eux (`epaisseurVoie`), plus sur le relief.
- **Le cœur des îlots** (`solVille`) : plus d'aplat brun — pavé le long des voies, jardin au-delà de 5 m,
  quelques plaques de terre battue ; tout le pourtour du Wault pavé jusqu'aux façades.
- **Le quai du Wault** (`quaiDuWault`, carte.js) : tout le tour du bassin, une bande d'eau qui rejoint le
  mur, un fond de vase, un mur de pierre au trait de rive, une margelle de 45 cm, puis le quai pavé de
  niveau jusqu'à ce que la berge le rejoigne (9 m au plus). `graverVoie(ge, 1.5)` : il monte jusqu'à 1,5 m
  au-dessus de la berge en pente.
- **Les façades** (quartier.js) : la pierre déclarée passe pour moitié à la brique (rang-de-Lille), le reste
  en pierre de Lezennes plus ou moins patinée ; l'enduit (le « 30 » du relevé, la longue rangée blanche du
  Wault) reçoit un badigeon ocre, crème ou gris rosé.
- **Les bords fondus** : les sentiers relevés (`rubanGeo(…, fondu)`) et la route du pont au village
  (`chausseeEt`, campagne.js) s'effacent dans l'herbe, bord ondulé.

**Lot 2 — c7e6820** (quartier.js, hud.js, village.js, carte.js) :
- **Les passants** (`passantsDeVille`, quartier.js), sur le chemin du bourg au Wault :
  - **la lavandière**, sur le quai du Wault (−150 ; 736) : « Les bateaux déchargent le grain au bout du
    bassin… » ; elle indique le bourg ;
  - **la marchande**, au carrefour Léonard Danel / Gros Gérard (62 ; 746) : beurre, œufs, maroilles ;
    elle indique le Wault (vers le couchant) et le bourg (vers le beffroi) ;
  - **le brasseur**, rue du Gros Gérard (−6 ; 770) : la bière de garde ; « au bout des rues, les portes sont
    fermées, le guet y veille » (ce qui dit les rues coupées sans inventer d'histoire) ;
  - **le garde du guet**, devant la porte coupée la plus proche (−88 ; 907) : « Halte ! Cette porte reste
    fermée. » ; il indique le bourg et le Wault.
  Aucun n'est de l'histoire, aucun ne donne de quête. **Le quai du Wault est un lieu découvert**
  (`addLieu`, id `wault` : le compteur passe à 15).
- **Minicarte et carte M** (hud.js ; atlas.js réutilise `construireCarte`) : rues et bâti du tissu coupé
  (`horsVille`) tracés éteints, en gris.
- **Écart n° 1, « le dallage flou »** : ce n'était pas le dallage. Le point « garde » du banc tombait sur le
  soubassement d'une maison du bourg, et la caméra filmait son dessus : une pierre de taille calée sur 1,2 m,
  étirée sur toute la façade. Corrigé dans village.js, une ligne (le soubassement prend `phLocal` à la taille
  de sa face). Le dallage lui-même (pavés `paved`) est net ; ses bords restent des rectangles francs sur le
  socle de terre, vus d'en haut.

**Vérifié** : `acces.mjs index` 27 interactions, 0 hors d'atteinte (les passants compris) ; prologue joué en
headless (« Jouer le prologue », Entrée toutes les 1,5 s pendant 90 s) sans erreur, minicarte comprise ;
carte M rendue.

**§ 4.E — le chargement** : mesuré en **A/B entrelacé** (version publiée puis la nouvelle, deux fois, sous le
même verrou de banc), parce que la machine variait du simple au double dans la matinée (la même version
publiée : 8,1 s à 9 h, 12,6 s à 10 h, avec les bancs des autres sessions). Lot 1 : 12,56 / 12,84 s → 12,73 /
13,06 s (+0,2 s ; « ouvrages et eaux », qui porte les rues et les sols, +140 ms). Lot 2 : 8,25 / 7,50 s →
7,61 / 7,72 s, pas d'écart mesurable ; tas +5 Mo. Relevés : `bancs/resultats/charge-2026-10-05-ab-*.json` et
`-ab2-*.json`. Dans la page, `voiriesLille` coûte ~200 ms et `solVille` ~300 ms (appelés à chaud).

**Captures à regarder** : `bancs/resultats/ville-L-avant-*.jpg` (ce matin, sur le PC), `ville-L-lot1-*.jpg`,
`ville-L-lot2-*.jpg` — garde, place, chemin, rue, carrefour, wault ; à hauteur d'yeux et en plongée.
`bancs/regard-ville.mjs` a été recalé : la vue « rue » est sur l'axe de la rue du Gros Gérard (elle filmait
une cour), « garde » est dans la grand-rue face à la salle de la garde (elle filmait un soubassement), la
hauteur d'yeux se prend au sol DESSINÉ (un rayon : le dallage du bourg est un mètre au-dessus de `getH`), et
une vue « carrefour » est ajoutée.

**Ce qui reste, et demandes pour d'autres fichiers** :
- **promenade.js — la voie des combattants** : c'est ELLE, le « ruban brun à bords francs dans le bois » de la
  capture « chemin » (le banc l'a identifiée au rayon : maillage `voie-des-combattants`). Hors de mes
  fichiers. Il lui faut le même traitement que les sentiers : `rubanGeo(lignes, 4.2, 0.17, 5, 0.9)` et un
  matériau `transparent, vertexColors` (l'option `fondu` existe maintenant dans carte.js), et des ornières
  moins tracées au cordeau.
- **pnj.js — des silhouettes** : les quatre passants reprennent les silhouettes des villageois du bourg
  (marchande, brasseur, lavandière, guetteur : Aldegonde, Baptiste, Cornélie et Désiré ont les mêmes). Il
  faudrait des variantes (couleurs de tunique, coiffes) pour les gens de passage.
- **village.js — les bords du dallage** : les nappes de pavés du bourg sont des rectangles francs sur le socle
  de terre ; un fondu ou une bordure les raccorderait (hors de ce qui m'était ouvert).
- **Les passants ne marchent pas** : ils se tiennent à leur poste ; une `route` (comme les villageois du
  bourg) les ferait circuler sur le trottoir.
- `campagne : chaussée coupée sur 331–359 m (eau)` s'affiche au chargement : à vérifier s'il date d'avant
  (rien dans ce lot ne change l'eau ni les collisions de la route).

**Questions pour Eugène** :
1. ~~Les répliques des passants te vont-elles ?~~ Oui (Eugène, 5 octobre).
2. Le garde du guet est à (−88 ; 907), à la porte coupée la plus proche de la rue du Gros Gérard, un peu au
   nord. Veux-tu qu'il garde plutôt une porte sur le chemin même (au bout de la rue Saint-Martin) ?
3. Les deux questions de la nuit restent posées : le bourg doit-il disparaître au profit des bâtiments
   relevés, et le cercle « à droite du Wault » est-il au bon endroit ?

### L'Aveyron resserré (5 octobre, PC) — **fait, vérifié au banc**

Eugène a choisi l'emprise **A** et « Saint-Symphorien seulement au loin » (STORY.md ne nomme pas le
bourg). On marche sur le lac et ses rives : **810 × 820 m** (x −290 à 520, z −350 à 470), avec les trois
maisons Roquette, le barrage du duel, la source des Vergnes et la fontaine du lac. Ce n'est pas la
règle des 400–500 m : le lac fait à lui seul 600 × 700 m, et ses trois maisons sont sur ses rives.
- `carte/mondes/fondre-relief-aveyron.py` recadre : grille fine de 187 × 189 nœuds (1,7 Mo → 237 Ko),
  plus large de 60 m que la zone. Dans cette bande, le relief glisse vers celui des environs, pour que la
  couture avec l'horizon ne se voie pas. Le plan est coupé au bord de la grille : 8 bâtiments au lieu de
  159, 11 rues au lieu de 64. Une clé `zone` donne la zone jouable, une clé `horizon.arbres` porte
  7 000 arbres de bocage jusqu'à 1 km, chacun avec son altitude. Les fichiers complets sont dans
  `carte/mondes/complet/`.
- `aveyron.js`, `lisiere()` : la bande hors zone est inscrite comme bloquée (`inscrire`). Le long de la
  limite : un muret de pierre sèche, une haie de chênes à trous, et une barrière de pré fermée là où un
  chemin sort (5 barrières). Le muret s'interrompt dans le réservoir de Montézic. `arbres()` plante la
  haie, le bois de la bande par taches, et l'horizon.
- **Appris** : vu d'avion, une lisière uniforme et un horizon sans arbres dessinaient un rectangle. Il a
  fallu le bocage de l'horizon, et un `loinSol` plus clair que le sol (`0xb0a676`), parce que la
  texture étirée sur des kilomètres paraît plus sombre.
- **Appris (PC)** : sous Windows, `open()` de Python lit et écrit en cp1252. Le JSON sortait avec ses
  accents cassés. Il faut `encoding='utf-8'` partout. `bancs/lieu-aveyron.mjs` est passé sous Windows
  comme `charge.mjs`.
- Mesures (`bancs/tour.sh node bancs/lieu-aveyron.mjs`, `bancs/resultats/lieu-aveyron-2026-10-05-*`) :
  chargement 4,3 → 3,1–3,8 s ; rues praticables 100 % (8 649 points) ; 18 cibles sur 18 atteintes en
  marchant. Aucun toit qui déborde ni ruban qui flotte. L'étape « lisière » prend 73–92 ms, « arbres »
  70–87 ms.
- Reste : les villageois de la place de Saint-Symphorien ne sont plus posés (hors zone), il faut les
  remettre au bord du lac (le « jouable »). Le réservoir de Montézic est coupé net au bord de la grille.

### Villefort resserré (5 octobre, PC, consigne V) — **fait, vérifié en rendu**

Emprise « A », validée par Eugène sur `bancs/resultats/villefort-2026-10-05-emprise-proposee.png` : le
bourg seul, du pont Saint-Jean au sud du bourg, **364 × 594 m où l'on marche** (x 1428 → 1792,
z −1422 → −828). Avant : 1 160 × 2 130 m jusqu'au barrage. Le bourg est un village-rue le long de la
Régordane et de l'Altier : on dépasse un peu les 500 m de long, mais la surface vaut un carré de 470 m.
La gare (640 m à l'ouest) et le lac (800 m au nord) ne sont plus qu'à l'horizon. Plan et relief
d'avant : `carte/mondes/complet/lozere-villefort.json`, `complet/relief-lozere-villefort.json`.
- **Le découpage** : `plans-lieux-lozere.py` (cadre de Villefort, marge de 60 m au lieu de 400, et les
  LIGNES coupées : rues, chemins, Régordane, rivières, voies, murets) et `recoudre-relief-lozere.py`
  (tout le relief vient maintenant du cadrage « bourg », au pas de 5 m). `lozere-garde.json` en sort
  identique à l'octet près.
- **Pourquoi couper les lignes** : `hauteur()` de monde.js est bornée au relief fin. Un bout de rue qui
  dépasse reste à plat, à la hauteur du bord.
- **Le bord naturel** : le relief fin DÉBORDE de 60 m à l'ouest et au nord de l'emprise. Le débord est
  bloqué par `inscrire` (`lisiere`, lozere.js) et boisé de chênes serrés : la ripisylve de l'Altier au
  nord, le bois de la pente à l'ouest. Sans ce débord, le relief de l'horizon (`relief-lozere-monde.json`,
  maillé à 60 m par monde.js, plus sombre) remontait en marche juste derrière les derniers murs. Les
  quatre rues coupées (avenue de la Gare, impasse du Lavoir, rue de la Vignette et la Régordane, route
  de Mende) butent sur un mur de clôture de 2,3 m et son portail fermé, 4 m avant la fin de la rue.
  L'emprise est dans la fiche (`emprise`) ; `grille` est celle du relief, débord compris. L'est et le
  sud sont les bords d'avant : vus d'avion, on y voit encore la couture entre le relief fin et l'horizon.
- **Mesures** (`bancs/tour.sh node bancs/lieu-lozere.mjs villefort`, `bancs/resultats/lieu-villefort-
  2026-10-05-avant-resserrement.*` et `-apres-resserrement.*`) : chargement 3,6 → 2,7–2,8 s ; plan 176 →
  57 Ko, relief 788 → 95 Ko ; 542 → 332 bâtiments ; soubassements de plus de 1,5 m 16 → 9 ; rues
  praticables 100 → 99,73 % (les 4 points bloqués sont les quatre murs des rues coupées). Le poteau,
  l'église, Chez Fernand et le pont Saint-Jean sont atteints en marchant. Avant, la cible de l'église
  était DANS le bâti : elle est maintenant sur la rue, devant la porte, et la gare sort des cibles.
  Captures des bords : `bancs/resultats/villefort-2026-10-05-bord-*.jpg`.
- **Garde-Guérin et le Pouget, inchangés** : Garde-Guérin donne les mêmes mesures au banc avant et après
  (68 corps, 99,85 %, quatre cibles sur quatre, même planche). Le Pouget ne charge aucun des fichiers
  touchés ; il démarre sans erreur (`bancs/resultats/pouget-2026-10-05-apres-resserrement-villefort-depart.jpg`).
  Le poteau des vieux chemins et l'arrivée de Villefort sont dans l'emprise.
- **Appris (PC)** : `bancs/lieu-lozere.mjs` est passé sous Windows comme `charge.mjs` (Playwright des
  outils, `fileURLToPath`, Direct3D 11). Un Chrome sans tête du PC ne fait pas la capture d'une page
  SVG locale (délai dépassé) : PyMuPDF (`py -3`, `import pymupdf`) rend un SVG en PNG sans navigateur.
  Le chemin du dossier temporaire des sessions dépasse la limite de 260 caractères de Windows :
  passer par un dossier court.
- **Défaut du banc, corrigé** : `ecartMax` valait toujours 0. Dans `bancs/lieu-lozere.mjs`, l'affectation
  était restée derrière un commentaire `//` sur la même ligne. Les mesures ci-dessus datent d'avant la
  correction.
- **Reste** : le réalisme et le jouable de Villefort (consigne V, point 3) : des gens à qui parler, et
  des `reperes`.

#### Compte rendu de la session Aveyron (5 octobre, PC)

**Publié** : `4ef658d` (le resserrement seul), puis `b7b4fa1` (le réalisme et le jouable). Ce compte
rendu n'est pas publié : PROMPT-REPRISE.md porte aussi des ajouts d'une autre session.

**Réalisme, fait (dans aveyron.js seulement).** La planche du regard, `bancs/tour.sh node bancs/lieu-aveyron.mjs
http://127.0.0.1:8000 regard <étiquette>`, montre 8 vues à hauteur d'yeux et en plongée (Beauregard, le
Pouget, le barrage, Perpignou, la rive nord). Les écarts, du plus visible au moins visible :
1. le bord de la grève en marches de 3 m : les coins hors du lac plein sont ramenés sur la rive ;
2. des routes en rubans à bord franc : la chaussée est bombée de 1,5 cm et posée sur un accotement de terre
   irrégulier (0,4 à 1,1 m de chaque côté) ;
3. le chemin d'exploitation : deux ornières de terre, l'herbe au milieu. Le sentier a une largeur qui
   varie, et sa terre est grisée vers l'herbe grillée ;
4. les maisons d'OSM aveugles : `ouvertures()` ajoute des baies encadrées de granit, des volets à la
   couleur de chaque maison (gris-bleu, sang-de-bœuf, sauge, brun) et une porte sur le long côté. Les
   granges ont un portail de planches. Un mur mitoyen ou une baie enterrée côté amont n'ont pas
   d'ouverture.

Captures avant/après : `bancs/resultats/lieu-aveyron-2026-10-05-regard-avant-vues.png`,
`…-regard-apres-2-vues.png`, la minicarte `…-regard-apres-2-minicarte.png`, et l'aérienne dans
`…-apres-resserrement-3-vues.png` (vue 1).

**Le jouable.** 11 `reperes` dans `aveyron.js` : le Batut, Beauregard, la grande maison du Pouget, le
barrage, la source des Vergnes, la fontaine du lac, Perpignou, Fariboules, le pêcheur, le colporteur et la
porte de l'île. La source des Vergnes existe maintenant en jeu : un griffon de pierre sèche, la bouche
murée de pierres entassées. On la MONTRE bouchée, la quête « Les sources » n'est pas écrite. Les gens posés
(`window.__lieu.gens`) :
- **le pêcheur** (rôle `pecheur`), sur la rive près du départ (−66 ; 97) : « Le lac a perdu plus d'un
  mètre… » ; le barrage est au nord-ouest ;
- **le colporteur** (rôle `colporteur`), à la sortie vers Saint-Gervais (−175 ; −325) : « Là-haut aussi,
  les puits sont à sec » ; le Pouget est à l'est ;
- **deux habitants de Perpignou** (villageois), vers (452 ; −228) et (462 ; −212) : le puits à vase, le
  soleil qui ne bouge plus ;
- **un homme de Fariboules**, vers (290 ; 30) : Beauregard est sur la pente, au sud-est ;
- **une femme à la fontaine du lac**, vers (−262 ; −330) : les sources bouchées, celle des Vergnes ;
- **un homme sur le barrage**, vers (−205 ; −55) : « Les Roquette vont finir par se battre, pour ce lac. »

Ces répliques sont celles des villageois de Saint-Symphorien, plus des indications de direction. Rien sur
les Roquette au-delà de STORY.md.

**Mesures** (`bancs/lieu-aveyron.mjs`) : chargement de 3,1 à 3,8 s (4,3 s avant le resserrement) ;
étapes du lieu : bâti 37 ms, rues 57 ms, lisière 68 ms, le reste 205 ms, arbres 76 ms. Aucune étape
nouvelle au-delà de 300 ms. Rues praticables 100 %, 26 cibles sur 26 atteintes en marchant, 0 toit qui
déborde, rubans flottants 0,1 %. Contrôle de publication : somme 8,7 s sur 17.

**Demandes pour monde.js** (pas le droit d'y écrire) :
- la minicarte ne trace pas les rues de l'Aveyron : `TRAITS` ne lit que `PLAN.routes` et
  `PLAN.chemins`, alors que l'Aveyron les range sous `rues` et `sentiers` pour les bâtir lui-même. Il
  faudrait lire aussi `PLAN.rues` / `PLAN.sentiers`, ou un crochet `f.traits` ;
- l'eau des lacs (`eau.plans`) ne bloque pas la marche : on entre dans le lac jusqu'au fond. Il faudrait
  un `bloque` sur l'eau profonde (le lac d'étiage), comme `f.mer` ;
- le réservoir de Montézic est coupé net au bord de la grille fine (`dansCadre` le dessine en entier, à
  plat, mais le relief s'arrête) ;
- toujours valables : `apresBati(ctx)` et `sol.patine` (§ 4.E, « suite »).

**Reste** : le sol (`withered_grass` uniforme : des prés clos, des murets de parcelles, des
affleurements de schiste) ; la végétation (chênes seuls : des châtaigniers et des genêts, typiques du
Ségala) ; les maisons Roquette, déjà soignées.

**Questions pour Eugène** :
1. La zone fait 810 × 820 m : j'ai repoussé le bord est de 20 m pour que le chemin de Roubiliergues ne
   sorte pas trois fois. Ça te va ?
2. La lisière (muret, haie de chênes, barrières de pré fermées) se lit-elle comme naturelle en jeu ?
3. Faut-il que la fontaine du lac ou la source des Vergnes deviennent une quête (« Les sources ») ? Je n'ai
   rien écrit de l'histoire.

### Lille — le bourg cède la place au bâti relevé (5 octobre, après-midi) — **fait, vérifié en rendu, publié (1a828a4, 85feb37)**

Réponses d'Eugène aux questions du matin : les répliques des passants et le poste du garde du guet lui
vont ; le cercle « à droite du Wault » est au bon endroit ; **le bourg disparaît au profit des bâtiments
relevés, et ses éléments s'insèrent dans le vrai quartier** ; beffroi et chapelle restent sur place.
- **La voie des combattants** (promenade.js, 1a828a4) : bords fondus (`rubanGeo`, `fondu`), ornières moins
  rectilignes, teintes adoucies.
- **Le bâti relevé revient dans l'îlot du bourg** (quartier.js) : il ne cède plus qu'aux monuments gardés —
  beffroi, chapelle avec porche et parvis, cimetière (`MONUMENTS`, village.js ; `PARTAGE.batiBourg`). Le
  cimetière a reculé de 1,6 unité vers le nord, le chantier de la chapelle est passé entre le cimetière et la
  nef. Au passage, deux grands bâtiments relevés qui traversaient déjà la chapelle et le cimetière ne sont
  plus élevés.
- **Les douze maisons inventées sont parties.** Le relevé dit pourquoi le bourg avait deux rangées : il n'en
  a qu'une. La « Façade de l'Esplanade » est une rangée de maisons au nord, l'Esplanade ouverte au sud.
- **Les commerces dans les façades** (`COMMERCES`, `poserCommerce`, village.js) : en élevant chaque mur,
  quartier.js demande s'il est réservé (`PARTAGE.facadeBourg`) ; si oui, pas de rez-de-chaussée percé, et le
  commerce se pose sur ce mur tel qu'il est DESSINÉ (le relevé et les murs diffèrent d'un mètre par
  endroits), dans un repère tourné (`cadre`). Un commerce qu'aucun mur ne porte se pose quand même sur
  l'ancien plan, avec un avertissement (`facadeBourgFin`).
  - **la salle de la garde** passe à la façade relevée de l'ouest (lx −21,2), puisqu'il n'y a pas de maison
    relevée sur l'Esplanade ; le prologue la suit (tout y part de `PARTAGE.ecole`) ;
  - **l'estaminet** est à lx −4,3 : en −11, une courée relevée traverse l'îlot et quartier.js y laisse le
    passage ouvert, et le seul mur qui regarde la rue entre elle et la rue du beffroi va de −6,9 à −1,7. Sa
    porte, sa terrasse resserrée, son enseigne ; **sa sortie passe par la sauvegarde**
    (`state.sortieEstaminet`, lue par tavern.js) : l'estaminet s'ouvre dans sa propre page et ne voit pas
    `PARTAGE` ;
  - **le brasseur** (lx 10,5) et **le drapier** (lx 17) sur la façade relevée à l'est ;
  - **la forge** garde sa place sur l'Esplanade (le multi y pose un objet) et s'adosse à un mur de brique
    qui porte l'étal du forgeron.
- Recalés : l'étal aux légumes, le poids public, deux bannières et des caisses, qui tombaient dans les
  maisons relevées ; un réverbère et la roue, qui bouchaient la porte de l'estaminet. Le linge part des
  façades et finit sur un mât. Les fanions du prologue finissent sur des mâts de fête (quetes.js), et
  l'objectif « Gustave, à l'estaminet » suit la vraie porte. Le lieu « l'estaminet » de la carte aussi.

**Vérifié** : prologue joué en headless sans erreur, il part de la nouvelle salle de la garde (foule,
fanions et mâts) ; aller-retour dans l'estaminet (on ressort devant la porte, face à la place) ; accès 27
interactions, 0 hors d'atteinte. **A/B** (`charge-2026-10-05-ab3-*.json`) : 13,8 / 13,8 s → 12,5 / 14,0 s,
pas d'écart ; fusion des décors −0,45 s, tas −25 Mo. Captures : `bancs/resultats/bourg-releve-2026-10-05-*.jpg`
(vue d'ensemble, garde, estaminet, brasseur et drapier, forge, place, nord, prologue, sortie de l'estaminet).

**Ce qui reste** :
- ~~La moitié sud de la boîte du bourg reste un grand socle de terre battue.~~ **Fait (95c8399)** : le socle
  est en deux nappes, l'herbe de l'Esplanade partout et la terre battue seulement sous la grand-rue, le
  marché, la forge, le séchoir et le colporteur (`terreBourg`, village.js) ; la rue nord-sud est pavée
  jusqu'au bout du marché. Le sol marchable (`solBourg`) n'a pas bougé. Captures :
  `bancs/resultats/bourg-esplanade-2026-10-05-*.jpg`.
- Les rez-de-chaussée réservés sont aveugles derrière les étals : entre deux baies d'un étal, on voit le mur
  nu de la maison relevée.

#### Aveyron, suite (5 octobre, PC) : le Batut, les domaines, le sol, la végétation

Eugène : « oui pour le bord est », puis le sol et la végétation, et deux remarques sur le Batut :
« des proportions réalistes » et « un peu au milieu de nulle part ». Le dépôt ne dit nulle part que le
Batut est « impressionnant par sa taille ». Le jeu bâtissait les trois maisons Roquette sur la même
recette (granit, tour ronde), alors que SCENARIO.md décrit le Batut d'après le dessin de P. Gaillac.
- **Le Batut** (`batut()`) est bâti d'après ce dessin :
  - trois corps accolés : au centre 9 × 10 m, trois niveaux, 9,6 m à l'égout, avec un oculus au pignon ;
    à gauche un corps bas, en retrait ; à droite l'aile aux baies et à la porte cintrées, avec ses
    oculus et sa lucarne ;
  - un enduit clair (`enduit_gris` éclairci : `chaux_craquelee` se lisait comme des moellons), du
    lierre jusqu'au premier, des persiennes ouvertes ;
  - le grand hêtre à gauche, le muret bas dans sa haie, une allée de gravier.

  Mesures : 3 m par niveau, baies de 1 × 1,6 m, porte de 1,2 × 2,3 m. Le banc compte 3 « toits sur
  un voisin » : c'est le toit haut du corps central qui déborde au-dessus des toits bas, comme sur une
  vraie maison.
- **Les domaines** (`domaine()`, `cheminsDAcces()`) : chaque maison reçoit
  - un chemin d'accès en ornières vers la route la plus proche. Il contourne la maison par le côté :
    tracé droit, il la traversait (21 points de chemin bloqués) ;
  - une grange-étable de 16 × 9 m, un potager clos et quatre grands arbres. Les places sont dans
    `window.__lieu.domaines`.
- **Le sol** (`sol()`) : une patine par sommet sur la maille du relief fin de monde.js :
  - des prés de 60 m, chacun sa teinte ;
  - plus vert et plus sombre dans les creux et à moins de 20 m du lac ;
  - plus terreux sur les talus.

  À cela s'ajoutent 162 affleurements de roche claire sur les pentes de plus de 18°. C'est un
  palliatif : il reste à faire `sol.patine` dans monde.js.
- **La végétation** (`arbres()`) : 6 166 chênes (horizon compris), 1 970 hêtres (dans les creux),
  129 bouleaux (sur les crêtes), 223 charmes et 451 fourrés, au bord des chemins et dans les haies.
  **Demande pour foret.js** : le châtaignier et le genêt, les deux essences du Ségala qui manquent.
- Mesures : chargement 3,9 s ; étapes du lieu : maisons 186 ms, domaines 67 ms, arbres 90 ms,
  sol 115 ms. Rues praticables 100 % (9 350 points), 26 cibles sur 26 atteintes. Planche :
  `bancs/resultats/lieu-aveyron-2026-10-05-regard-sol-batut-3-vues.png`.
- Reste : Beauregard et le Pouget ont encore la recette commune. SCENARIO.md décrit le Pouget
  d'après photos : une tour carrée au centre sous un dôme de lauzes, un toit de lauzes à quatre pans,
  une grille et une allée de gravier. Beauregard attend une description d'Eugène.

#### Aveyron, suite (5 octobre, PC) : le Pouget et Beauregard

Eugène : « rebâtis le Pouget d'après les photos », puis pour Beauregard, « je n'ai aucune inspiration
précise, trouve une inspiration aveyronnaise du coin ; une heure, en prenant des décisions ».
- **L'atelier** (`aveyron.js`) : le granit gris et la lauze sont inscrits dans `PH`
  (`granit_lozere`, `lauze_lozere`, les fichiers de la Lozère). Pièces communes : `chantier()` et
  `finirChantier()` (une maille par matière), `toitCroupes()` (quatre pans et coyau), `toit2Pans()`,
  `fenetre()` (blanche à petits carreaux, volets pleins), `cheminee()`, `lucarne()`, `nappe()`
  (pelouse, allée ou cour posée sur le relief), `lierre()` (partagé avec le Batut).
- **Le Pouget** (`pouget()`), d'après les photos décrites dans SCENARIO.md :
  - un corps de 20 × 10 m, 7 m à l'égout, sous un toit de lauzes à quatre pans, cassé en bas,
    avec deux grandes cheminées ;
  - la tour carrée centrale, plus haute que le faîtage, sous un dôme de lauzes en cloche et un
    clocheton ; la porte-fenêtre bleue sur son balcon de fer forgé et l'oculus au-dessus ;
  - deux lucarnes ; trois fenêtres par étage de chaque côté ; des volets bleu-gris ;
  - la porte bleue, trois marches qui descendent dans la pente, des hortensias et deux pots ;
  - le lierre sur la droite et le mur qui la prolonge ; l'aile basse à gauche, derrière un arbre ;
  - l'entrée : le mur, deux piliers à boules, la grille ouverte, l'allée de gravier entre deux pelouses
    grillées, bordée d'une haie basse.

  L'aïeule est maintenant au pied des marches.
- **Beauregard** (`beauregard()`), une décision de la session : un manoir du Carladez, voisin du lac
  (Messilhac, les maisons fortes de la Truyère). C'est :
  - un corps de logis de granit de 17 × 9 m, sous un toit de lauzes très pentu entre deux pignons à
    cheminée ;
  - une tour d'escalier ronde hors-œuvre en poivrière, avec sa porte cintrée et des jours qui
    tournent avec la vis ;
  - des croisées à meneaux à l'étage (la maison noble), des baies aux volets rouges au
    rez-de-chaussée ;
  - la cour en terrasse sur le lac, avec son puits à sec ;
  - un pigeonnier carré à randière, accolé à l'angle de la cour (le droit de colombier, privilège du
    seigneur).
- **Les toits** : la lauze pour le Pouget (les photos) et pour Beauregard (le nord de l'Aveyron couvre
  en lauze ; la tuile canal est une toiture du sud). Le Batut, les granges et le bâti d'OSM gardent la
  tuile canal choisie le 2 octobre. **Question pour Eugène** : tout passer en lauze, par cohérence ?
- **Collisions, appris** : un muret fait d'un tronçon par côté laisse une encoche de 35 cm à l'angle
  extérieur. Chaque tronçon dépasse maintenant ses bouts de l'épaisseur du mur. Le banc, lui,
  traversait un muret de 70 cm vu en biais entre deux cases de 2 m (il ne testait que le milieu) :
  il teste trois points par pas, et dit où la marche s'arrête (`arreteeA`).
- Mesures : chargement 4,0 s ; étape « maisons Roquette » 255 ms (au plus près des 300 ms) ; rues
  praticables 100 % (9 409 points), 25 cibles sur 25 atteintes. Le banc compte 6 « toits sur un
  voisin » : ce sont les grands toits qui débordent au-dessus des toits bas, de la tour et des ailes,
  comme sur les vraies maisons. Planche : `bancs/resultats/lieu-aveyron-2026-10-05-regard-maisons-5-vues.png`.
- `grandeMaison()` ne sert plus que pour la version complète : les trois maisons ont chacune leur
  recette.

### Villefort — le réalisme et le jouable (5 octobre, PC, consigne V, point 3) — **faits, vérifiés en rendu, publiés**

Tout est dans `lozere.js`, pour Villefort seul. Le code commun (`batirMaisons`, `rues`, `Lot.bloc`)
n'a reçu que des options facultatives (`enduit`, `mats`, `fondu`, `sansFond`) : la Garde-Guérin donne
les mêmes mesures au banc avant et après (`lieu-gardeguerin-2026-10-05-apres-facades.*`).

**Les commits, dans l'ordre** : `4e36f77` le resserrement ; `a94bf46` le jouable ; `de2f8aa` le sol ;
`9cdc4df` les façades ; `4dc5a97` les chemins ; `4a46b63` la lisière sur les quatre bords ;
`c21afd8` le mobilier.

**Les écarts relevés** (`bancs/resultats/villefort-2026-10-05-regard-avant-*.jpg`, à hauteur d'yeux
et en plongée : Bosquet, Bourgade, Portalet, église, pont), du plus visible au moins visible, tous traités :
1. **De l'herbe jusqu'au pied des façades**, en plein bourg. → `solDuBourg` : un enrobé de mur à
   mur dans le bourg dense (3,5 m autour du bâti, 3 m le long des rues, pas dans les jardins d'OSM).
   Son contour est découpé au pas de 1,25 m (marching squares). Hors du bourg, un accotement de 1,6 m
   le long des routes et des rues.
2. **Les rues** : le « gravier » se lisait comme un ruban noir, et la rue de la Bourgade comme un
   chemin de terre. → Enrobé usé (`asphalt_02`) pour r ≥ 2 ; ruelles du bourg dallées de granit
   (`granite_tile_03`) ; trottoirs de 14 cm et 1,6 m, avec leur bordure, le long de la départementale
   seule (route de Mende, avenue des Cévennes), coupés aux carrefours. On y marche à leur hauteur
   (`solLieu`).
3. **Les façades aveugles, le granit trop clair.** → `facades` : 3 814 fenêtres (vitrage, encadrement
   de granit, volets de planches gris-bleu, vert, brun ou gris, un sur cinq fermé) et 203 portes côté
   rue. Rien sur les murs mitoyens ni sous le terrain. Pierre plus sombre (`0x9c9a94`), et quatre
   maisons sur dix du bourg crépies (`enduit_gris`).
4. **Les chemins en ruban net.** → Hors du bourg, largeur qui ondule et frange de 70 cm fondue dans
   l'herbe (alpha aux sommets, `fondu`).
5. **Rien sur les places.** → Le bosquet de charmes de la place du Bosquet ; l'ormeau de la place de
   l'Ormeau (un chêne : la forêt du jeu n'a pas d'orme) ; six bancs ; cinquante lanternes de fer, au
   verre à peine lumineux, sans lumière nouvelle.

**Les bords** : la lisière (débord de 60 m bloqué et boisé, mur et portail au bout de chaque rue
coupée) est maintenant sur les quatre côtés. À l'est et au sud, le relief du débord vient du relief
« monde », interpolé (`recoudre-relief-lozere.py`). Captures : `villefort-2026-10-05-bord4-*.jpg`.

**Les gens** (huit passants, rôles et villageois existants, `GENS_VILLEFORT`) :
- le vieux de la place du Bosquet, près du poteau : « Ce poteau, c'est le départ des vieux chemins. »
- le cafetier de Chez Fernand : « Chez Fernand, tout le bourg passe un jour ou l'autre. »
- le sacristain de Saint-Victorin : « On l'a bâtie avec le granit de la vallée, comme tout le bourg. »
- une femme au lavoir du pont Saint-Jean : « L'eau de l'Altier est froide, même en plein été. »
- le pêcheur du pont, sur son banc de granit : « Plus haut, il y a le lac du barrage. Avant, il n'y
  avait que la rivière. »
- l'hôtelière du Balme : les voyageurs du train et les marcheurs de la Régordane.
- un homme de la place de l'Ormeau : « La rue de la Bourgade, c'est l'ancienne Régordane. »
- un homme de la place du Portalet : le granit et les lauzes.
Huit `reperes` (Bosquet, poteau, Portalet, église, Ormeau, pont et lavoir, Chez Fernand, le Balme).
Captures : `villefort-2026-10-05-jouable-minicarte.jpg` (la minicarte nomme le poteau),
`-jouable-dialogue.jpg`, `-jouable-pecheur.jpg`.

**Mesures** (`bancs/tour.sh node bancs/lieu-lozere.mjs villefort <étape>`, `lieu-villefort-2026-10-05-*`) :
chargement 2,6 à 3,4 s (3,6 avant le resserrement) ; étapes nouvelles, chronométrées dans `BILAN` :
passants 20 ms, sol 140–165 ms, façades 105–115 ms, mobilier 10 ms (toutes sous 300 ms). Rues
praticables 100 % ; le poteau, l'église, Chez Fernand et le pont sont atteints en marchant.

**Appris** :
- **Un maillage aux normales nulles noircit TOUT l'écran** (NaN au shader, étalé par le flou du
  post-traitement). C'est arrivé avec deux faces opposées sur les mêmes sommets (la bordure), et c'est
  un risque avec les triangles plats d'un découpage. Pour trouver le coupable : masquer les maillages
  par moitiés jusqu'au noir.
- `PNJ.buildRole('pecheur')` est un rôle ASSIS : il lui faut quelque chose sous lui. Son origine est
  à la hanche, pas aux pieds.
- Le serveur a été arrêté et relancé par une autre session pendant le travail : un banc qui échoue
  sur `ERR_CONNECTION_REFUSED`, on revérifie le serveur avant de chercher plus loin.

**Reste, et questions pour Eugène** :
- La boulangère, le chef de gare et les enfants près du lac (l'enquête du chien, SCENARIO § 14) ne
  sont PAS posés : ils appartiennent à l'histoire. La gare et le lac sont hors de l'emprise : où les
  veux-tu ? Un chef de gare « descendu au bourg », ou la gare remise dans le lieu ?
- 9 points de rue à plus de 35° : des bords de terre-plein sur des sentiers (149 avant le resserrement).
- Une lanière d'herbe reste entre deux rues près du pont Saint-Jean (un jardin d'OSM, sans doute).
- Les rez-de-chaussée n'ont pas de vitrines (Chez Fernand, le Balme) : un café et un hôtel devraient
  se reconnaître de la rue.
- Pas encore de barre de chargement sur villefort.html (le § 4.E le note pour les mondes).

**Suite, le 5 après-midi (Eugène : « fais les vitrines de Chez Fernand et du Balme ; je veux un café, Le
National » ; « un chef de gare descendu au bourg, c'est bien »)** — `lozere.js`, `BOUTIQUES` :
- Trois devantures au rez-de-chaussée, sur le mur le plus proche d'une rue. Chaque boutique est
  désignée par un point dans son bâtiment d'OSM. La devanture a ses pilastres, son allège de bois
  peint, des vitrines en baies et une porte vitrée, un bandeau du nom peint (canvas) et une enseigne
  en drapeau à l'étage. Derrière le verre, une salle peinte (lampes, comptoir, chaises), à peine
  lumineuse. `facades` saute les fenêtres et la porte de ce mur (`c.vitrine`).
- **Le café Le National** : la maison qui regarde le poteau, de l'autre côté de la rue (n° 319 du
  plan), en vert bouteille. Il a une terrasse (trois guéridons de marbre, six chaises de fer) sous un
  store de toile rouge. Le cafetier y passe.
- **Chez Fernand** (bordeaux, « Restaurant ») a son patron ; **l'hôtel Balme** (bleu nuit, « Hôtel –
  Restaurant ») a son hôtelière.
- **Le chef de gare**, descendu au bourg au bas de l'avenue de la Gare (rôle `cosimo`, casquette et
  bleu de travail) : « Les trains ne passent plus à l'heure. Alors je monte au bourg, et je les
  attends ici. » Il ne dit rien du chien : l'enquête reste à écrire.
- Corrigé au passage : `buildVillageois(n)` prend le modèle `n % 6` (0 la marchande, 1 le brasseur,
  2 la lavandière, 3 le vieux garde, 4 la garde champêtre, 5 le bûcheron). L'hôtelière et la femme
  du lavoir étaient des hommes.
- Appris : un panneau orienté par `makeBasis(x, haut, z)` doit avoir x = haut × z, sinon la base est
  indirecte et la boîte sort en miroir, de travers.
- Mesures : devantures et mobilier 24 ms ; chargement 3,2 s ; rues praticables 100 %, quatre cibles sur
  quatre. Captures : `bancs/resultats/villefort-2026-10-05-vitrines-*.jpg`.

**Suite (Eugène : « une barre de chargement sur villefort.html » ; « assure-toi qu'un lien entre le
Pouget, la Garde-Guérin et Villefort est possible »)** :
- `villefort.html` a la barre de thailande.html (`#loadbar`, que `peindreCharge` fait avancer).
- **Le Pouget n'avait pas de poteau** : on n'en repartait que par la porte de l'île. `poteau` est
  maintenant exporté par lozere.js, et pouget.js le plante sur le bas-côté de son arrivée, devant
  le muret (`ARRIVEES.pouget.poteau`). C'est le même poteau que dans les deux autres lieux, pas un
  système à part.
- **Vérifié en vrai**, par les menus des poteaux : Villefort → le Pouget → la Garde-Guérin →
  Villefort, sans erreur, chaque fois à la place d'arrivée. Captures :
  `bancs/resultats/vieux-chemins-2026-10-05-*.jpg`.

**La vie de la Garde-Guérin et du Pouget (Eugène : « ça manque d'éléments de déco : bancs, tonneaux,
fleurs, oiseaux, animaux et troupeaux »)** — `decorDeHameau`, exporté par lozere.js, appelé par la
fiche de la Garde-Guérin et par pouget.js. Une seule fabrique pour les deux lieux :
- **Devant les maisons** (`seuils` : le mur le plus proche d'une rue, s'il reste au moins 1,2 m de
  libre) : un banc de granit et de planches pour une maison sur trois, un ou deux tonneaux cerclés pour
  une sur trois, des pots de géraniums rouges, roses ou blancs pour une sur deux. Bancs et tonneaux ont
  leur collision (`addCap`). `poserBanc` sert aussi aux places de Villefort.
- **Les prés** : des touffes de fleurs d'une couleur (une fleur seule se perdait dans l'herbe) ; des
  brebis en trois groupes (26 sur le plateau de la Garde-Guérin, 12 au Pouget hors de l'enclos), avec
  `modeleBrebis`, désormais exporté par pouget-enclos.js.
- **Les oiseaux** (`vol`, trois maillages en instances par vol, animés par la fiche) : 14 choucas
  autour de la tour de la Garde-Guérin, des hirondelles au ras des toits dans les deux lieux, une buse
  très haut au-dessus de la vallée du Pouget.
- **Les chevaux** : celui d'un muletier de la Régordane au repos à l'entrée de la Garde-Guérin
  (cheval.glb, « Eating ») ; un cheval blanc sur un pré du Pouget.
- **Mesures** : décor 164 ms à la Garde-Guérin, 103 ms au Pouget ; banc de la Garde-Guérin inchangé
  (99,85 %, quatre cibles sur quatre), Villefort 100 %. Captures : `deco-gardeguerin-2026-10-05-*.jpg`,
  `deco-pouget-2026-10-05-*.jpg`.
- **Ce qui manque** : pas de vaches, d'ânes, de chèvres ni de poules. Le pack Quaternius
  (Cow, Bull, Donkey…) était sur le Mac, en .gltf écartés par le .gitignore : il n'est pas sur le PC.
  Avec lui (assets_back/02_personnages/animaux/ et glb.py), des vaches d'Aubrac et l'âne du muletier
  se poseraient par le même `chevalAuRepos`. Pas de chien du berger non plus (il appartient à l'histoire).
  → **Fait le soir même (Eugène : « tu peux télécharger »)** : Cow, Bull et Donkey repris du dossier
  Drive partagé (« Ultimate Animated Animals - July 2021 », sous-dossier glTF, lien public), allégés par
  `glb.py` en vache.glb, taureau.glb et ane.glb (Idle, Idle_2, Eating, Idle_Headlow, Walk ; 1,3 à
  1,4 Mo). `chevalAuRepos` est devenu `beteAuRepos` : un chargement par fichier, la taille et les
  teintes du pays dans `BETES` (la vache et le taureau d'Aubrac, froment, mufle sombre ; l'âne gris).
  La Garde-Guérin : l'âne du muletier près de son cheval, six vaches et le taureau sur le plateau. Le
  Pouget : quatre vaches sur le pré. Le décor n'est plus attendu au Pouget (il arrive pendant la
  cinématique), comme à la Garde-Guérin : les chargements restent à 2,2 et 2,5 s. `BILAN.decor.ou` dit
  où sont les bêtes. Captures : `deco-gardeguerin-2026-10-05-vaches-*.jpg`, `-betes-ane.jpg`,
  `deco-pouget-2026-10-05-vaches-*.jpg`.
- **Chèvres et poules au Pouget (6 octobre, Eugène)** : aucun modèle libre au style des autres bêtes.
  Le pack Quaternius n'a ni l'une ni l'autre. Les poules de Poly Pizza (Quaternius, CC0) sont un monstre
  à gros yeux et un cube à la Minecraft, et les chèvres de Poly by Google sont fixes et en CC-BY. La
  biche du pack (Deer.gltf, rapatriée pour l'essai, non utilisée) se lit comme une biche.
  - **La chèvre** est l'âne transformé (`BETES.chevre`) : 75 cm au garrot, robe de l'Alpine chamoisée,
    oreilles et queue raccourcies (l'échelle de leurs os, reposée après chaque image), cornes en arc
    accrochées à l'os `Head` (`cornes`, réglées dans le repère de la bête). Six sur un pré à part.
    `chargerBete` a une clé par SORTE : même fichier que l'âne, autres teintes.
  - **Les poules** sont faites à la main (`geoPoule`, `basseCour`, cinq maillages en instances) : 12 en
    quatre robes, sous la première maison. Elles picorent (la tête pivote au bas du cou) et trottinent
    autour de leur cour. Le plumage est le relief de `wool_boucle` SANS son image : teinte, l'image
    donnait un tissu écossais.
  - Captures : `bancs/resultats/basse-cour-pouget-2026-10-06-*.jpg`. La boucle des vieux chemins passe
    toujours.
- **Appris** : un nom de capture avec des espaces casse `$(ls …)` dans l'appel à publier-dev.sh (le
  commit échoue, la sortie filtrée ne le montre pas) ; ne jamais mettre d'espace dans un nom de fichier.

#### Lille, suite en autonomie (5 octobre, pause de midi d'Eugène) — **publié (f49035f, a9d9381, puis la bordure)**
- **Une porte au milieu de chaque boutique** (garde, brasseur, drapier) : l'étal encadrait la porte de la
  maison inventée ; sur la façade relevée, il ne restait qu'un mur nu entre ses deux baies.
- **Les bords des pavés du bourg s'effritent** sur un mètre dans la terre battue (`paved`, alpha de sommet
  et bord bruité) : d'en haut, ce n'est plus un plan de géomètre.
- **La marchande et le brasseur font les cent pas** sur leur trottoir rue du Gros Gérard (`va`,
  `userData.route` : game.js les anime comme les villageois du bourg) ; vérifié, ~7 m en 12 s chacun.
- **Le caniveau en petits pavés de grès** (`pbrRepeat(cobbles(), 1/0.62…)`, teinte sombre) : la photo de
  rocaille lisait comme de la terre semée de cailloux. **Les badigeons plus soutenus** : la longue rangée
  enduite du Wault lisait encore gris-blanc à l'ombre.
- **Plus de bordure sud** en travers du marché ; la bordure nord en pierre de bordure (marble_rock_02).
- Vérifié : accès 27 interactions, 0 hors d'atteinte ; prologue sans erreur ; A/B
  (`charge-2026-10-05-ab4-*.json`) 8,2 / 8,7 → 8,5 / 8,5 s, pas d'écart. Captures :
  `bourg-portes-2026-10-05-*.jpg`, `ville-L-midi-*.jpg` et `ville-L-midi2-*.jpg`.
- **« chaussée coupée sur 331–359 m (eau) »** : vérifié en A/B, il existait déjà avant le 5 octobre
  (34fa442). C'est la vieille route de campagne du pont « au village » (campagne.js, `roadPts`), qui file
  vers l'ouest jusqu'à (−171 ; 554) et finit dans un canal : elle date du bourg d'avant, et ne mène plus au
  bourg (200 ; 660). **Recalée (Eugène)** : `roadPts` choisit maintenant le pont dont le détour jusqu'au
  bourg est le plus court — le pont du Ramponneau, entrée (25 ; 623) — au lieu de la culée la plus proche du
  pont royal ; l'avertissement a disparu. Les voies relevées qu'elle recouvre, ou qu'elle longe à moins de
  10 m dans le même sens, lui cèdent la place (`sansLaRoute`, carte.js) : devant le pont, il y avait trois
  routes côte à côte. Un plus court chemin sur le réseau relevé a été essayé : le glacis devant le pont royal
  n'est relié à aucune voie relevée, et depuis le pont du Ramponneau la ligne droite reste la plus courte.
  Hameau, lavoir, pâture et bornes se reposent seuls le long du tracé. Captures :
  `route-pont-bourg-2026-10-05-*.jpg` ; A/B `charge-2026-10-05-ab5-*.json`, sans écart.

#### Aveyron : tout en lauze (5 octobre)

Eugène : « oui, passe tout en lauze ». `TUILE()` donne maintenant la lauze (`lauze_lozere`), et les pentes
suivent, puisque la lauze veut 45° et plus :
- le bâti d'OSM : `TOIT.pente` passe de 0,3 à 1,0, plafonné à 4,5 m ;
- les granges : pente 1,0 ;
- le Batut : le corps central à 45°, les corps bas à 40° et abaissés (5,6 et 6,0 m à l'égout), pour que
  leurs faîtages passent sous le toit central au lieu de le percer.

Au banc : rues praticables 100 %, 25 cibles sur 25, étape « maisons » 206 ms. Planche :
`…-regard-lauze-1-vues.png`. Publication : le contrôle a d'abord échoué deux fois sur le banc à froid
de Lille (23 s, avec une mesure à 8,9 s : la charge des autres sessions). Publié ensuite avec le lot
suivant, `58f667b` (somme 13,3 s).

**Le lac qui se retire (même commit)** :
- `barrage()` : la route de crête passe entre deux parapets de béton, ouverts au carrefour du Moulin du
  Prieur (fermés, ils barraient la route : banc). La maisonnette de la vanne est posée à l'écart des
  rues ; sur la route, elle bloquait 10 points.
- `grevesEchouees()` : le ponton de la baignade, à hauteur du lac plein, sur des pieux qui descendent
  jusqu'à la vase (on passe dessous, les pieux sont des collisions) ; quatre barques peintes échouées,
  entre 3 et 15 m de l'eau qui reste.
- `troupeaux()` : 19 brebis (le modèle de `pouget-enclos.js`, chargé ici à part), par petits groupes
  dans le pré derrière chaque domaine, et deux égarées. « Nos bêtes disparaissent » : on en voit peu.
- Mesures : rues praticables 100 %, 27 cibles sur 27 ; « barrage, ponton, barques » 71 ms.

### Thaïlande — la nuit du 4 au 5 octobre (arrivée du Mac dans ba002ab, sans compte rendu) — **relue et vérifiée le 5 octobre sur le PC (consigne T)**

Ce que la session de nuit avait fait, d'après le diff de `ba002ab` (thailande.js +300 lignes, monde.js,
extraire-thailande.py, thailande.json, bancs/lieu-thailande.mjs) :
- **Sous les pieds** (`voies()`, thailande.js) : chaque voie de Railay, Ton Sai et du grand piton prend son
  revêtement d'OSM (clé `s`, ajoutée par extraire-thailande.py) — dalle de béton à chant visible, carrelage,
  sentier de terre à bords fondus et largeur irrégulière, marches de 16 cm sur la pente. Les rubans de
  monde.js (`rocky_trail`) sont retirés. Hauteurs prises sur le MAILLAGE du sol (`solMaille`), pas sur
  l'interpolation bilinéaire (10 à 30 cm d'écart sur une pente).
- **Le bâti de Railay et de Ton Sai** (`toitIle`, `batiIles`) : toits à quatre pans à Railay, terrasses à
  acrotère ou tôle à Ton Sai ; fenêtres à cadre de bois, portes, rideaux de fer des boutiques au
  rez-de-chaussée de Ton Sai, balcons à garde-corps aux étages. Faces poussées à la main (9 000 boîtes : 1 s
  avec des BoxGeometry).
- **Des gens** : les cinq marchandes du marché flottant parlent (répliques qui mènent à Somsak, à Nok, au
  câble) ; un batelier DANS chaque barque de passeur ; deux pêcheurs (Railay, Ton Sai) ; cinq habitants
  figés qui finissent leur phrase au gong (comme les moines).
- **Les repères** : 17 `reperes` déclarés ; monde.js (session Pouilles, même transfert) les inscrit
  (`addLieu`, id préfixé `thailande:`) et les dessine sur la minicarte avec les rues en traits clairs.
- **Le départ** tourné vers le marché flottant (il regardait le mur d'une maison) ; chaque morceau de
  `plus()` chronométré (`window.__lieu.durees`, lu par le banc).
- Le banc : `TLOC_VUES=realisme` (12 vues à hauteur d'yeux et en plongée) et la planche de minicarte.

Vérifié sur le PC avant d'y toucher (`…-2026-10-05-point*` et `…-realisme-point*`) : praticabilité
**98,1 %** (inchangée par la nuit), chargement **3,5 s**, somme des étapes 2,5 s, bâti 94 ms (347 sur le Mac
chargé). La minicarte montre repères et tracés. Mais le parcours (ci-dessous) a trouvé ce que les planches
ne montraient pas.

### Thaïlande — la consigne T (5 octobre, PC) — **faite, vérifiée en rendu et au banc, publiée (f0ba26c)**

**Le parcours d'un joueur** (`TLOC_PARCOURS=1 bancs/tour.sh node bancs/lieu-thailande.mjs`) : une recherche
de chemin sur une grille de 1 m depuis le départ, avec `level.blocked` au rayon de Camille et la pente de
confort du banc (35°), les passeurs reliant les quais et les câbles descendant de leur départ à leur
arrivée (`window.__lieu.quais`, `.cables`). Il rend chaque repère (découvrable ?) et chaque interaction
(atteinte à sa portée ET à moins de 3 m de hauteur, comme engine.js). Il a trouvé :
- **Le sommet du grand piton n'était pas jouable.** C'est un plateau (110–119 m) entouré de falaises ; le
  câble de Phi Phi arrivait à mi-falaise (976 ; 322, à 74 m, une pente de 4,8 m par mètre), le câble vers le
  marché partait du bord du plateau. Les trois balayeurs — **la clé du cloître** —, la cour du puits et le
  chedi ne s'atteignaient qu'en escaladant la paroi. Arrivée et départ sont maintenant SUR le plateau
  (915 ; 362 et 948 ; 322) ; l'arrivée au nord, pour que la corde passe à 49 m du second chedi (Phra Chedi
  Khiri) au lieu de le traverser. Le chedi doré coiffe une seconde bosse, qu'un ravin de 30 m sépare du
  plateau : on le regarde depuis le bord du plateau, en face.
- Le repère de la cour du puits avait son centre dans un bâtiment ; Ko Tapu (dans l'eau) ne se découvrait
  de nulle part (r 40 → 95 : depuis la grève) ; deux figés de Railay avaient été posés à 30 et 65 m de haut
  dans la jungle (remis au pied du sentier du câble et devant une boutique ; les figés s'accrochent
  maintenant au chemin le plus proche, à la même hauteur, `surChemin`).
- Après : **19 repères sur 19 découvrables, 36 interactions sur 36 atteintes.**

**Les défauts connus** :
- les deux 404 : thailande.html n'avait pas d'icône, le navigateur demandait `/favicon.ico`. Corrigé (plus
  aucune erreur au chargement) ;
- les points bloqués : une impasse de Ton Sai tout entière dans un hôtel, et une passerelle de Ko Panyi sous
  le bâtiment « Panyee » (47 × 28 m). `sous_bati()` dans extraire-thailande.py retire une voie dont 80 % des
  points tombent dans un même bâtiment, et a été appliquée au thailande.json en place (CORRIGÉ le soir : les
  .osm de la Thaïlande SONT sur le PC, dans carte/mondes/ : `PYTHONIOENCODING=utf-8 py -3 extraire-thailande.py`
  redonne le même plan à l'octet près, depuis qu'il écrit en UTF-8 — en cp1252, le plan devenait illisible ;
  c'est le relief qui ne peut pas se refaire ici — ni les tuiles Copernicus, ni tifffile) ;
- la brume : 260 → **700 m** (elle finit à 3 200 m, là où la caméra coupe). La vue d'arrivée montre les îles ;
  la vue de très haut (900 m) reste voilée au-delà de 2 km, c'est voulu (la mousson).

**Le réalisme, sous les pieds puis les maisons** (Ko Panyi, où la nuit n'était pas passée) :
- les ruelles du village : dalles de béton de 2 m (1,3 km d'OSM) et planches (110 m) posées sur le platelage,
  4 cm plus haut, à plat ; avant, le village n'était qu'un plancher brun d'un seul tenant ;
- le platelage a une rive : un chant de bois de 35 cm et un pieu de béton tous les 2,5 m là où il donne sur
  l'eau (InstancedMesh) — vu d'une barque, le village a des jambes ;
- **les toits des maisons sur pilotis étaient à l'envers** depuis leur création (le prisme tourné de +π/2 :
  l'arête en bas, des toits en V sur toutes les captures). Remis à l'endroit, en tôle (`metal_plate_02`) ;
- les murs en quatre teintes de planches peintes passées au sel ; portes et fenêtres par `batiIles`
  (`BATI.facades` avec `sol` : le plancher à 1,3 m, pas la mer dessous).

**Les gens** (rôles existants ; rien sur l'histoire, aucun secret) :

| où | qui | ce qu'il dit, en une ligne |
|---|---|---|
| Ko Panyi, la passerelle du marché | un enfant figé (Nok à 0,72) | « …le dernier dans l'eau a perdu !… » |
| Ko Panyi, devant l'école | un enfant figé, les mains sur les yeux | « …quatre-vingt-dix-neuf, cent ! J'arrive !… » |
| Ko Panyi, le bout sud | un pêcheur dans sa barque (vivant) | le village sur pieux ; la mer n'a rien vu ; la porte de pierre au nord, Nok par là |
| Khao Phing Kan, la grève | une vendeuse de coquillages figée | « …Ko Tapu, le clou ! Un jour, la mer le fera tomber… » |
| Khao Phing Kan | un pêcheur (vivant) | c'est Ko Tapu ; Mali dit que les pitons mangent le temps |
| le plateau du grand piton | un moine figé près du câble | « …le câble descend jusqu'au marché. On ne fait que descendre… » |
| Phi Phi, le belvédère | un moine figé, la main sur la poulie | « …le câble porte jusqu'au grand piton… » |

Avec ceux de la nuit : 5 marchandes, 5 bateliers, 4 pêcheurs, 8 habitants figés, Nok, 3 moines et 3
balayeurs de l'enquête. Repères ajoutés : les pêcheurs de Railay et de Ton Sai (`pnj`).

**Mesures** : A/B entrelacé, 3 + 3 à froid (A = HEAD servi par interception réseau, B = le dossier) :
chargement 2,2 → 2,3 s, **somme des étapes 1 888 → 1 998 ms (+110 ms)**, triangles 1,96 → 2,22 M ; pilotis
56 → 78 ms, habitants 23 → 41 ms. Praticabilité **98,1 → 98,4 %** (Ko Panyi 97,4 → 98,5, Phi Phi 97,8 → 98,3).

**Captures** : `bancs/resultats/lieu-thailande-2026-10-05-realisme-point-vues.png` (avant) et
`…-realisme-apres-T-vues.png` (après ; trois vues ajoutées en 13–15 : une ruelle de Ko Panyi, le village vu
d'une barque, le plateau du sommet) ; la baie : `…-point-vues.png` / `…-apres-T-vues.png` ; la minicarte :
`…-realisme-apres-T-minicarte.png`.

**Ce qui reste** :
- Railay a l'air provençal (enduit blanc à la chaux, tuiles rouges, rangées de fenêtres égales) : les
  bungalows de Railay sont de bois, de béton peint, sous des toits de tôle ou de feuilles. À reprendre avec
  le bâti de la nuit (`toitIle`, `batiIles`) ;
- les temples du plateau : murs blancs bas sans toit visible sous la jungle, des arbres sur le plateau et
  contre les temples ;
- la barque d'un passeur ou d'un pêcheur, vue de près par la proue, ne montre que la proue et le batelier
  (la coque, basse, se perd dans l'eau) ;
- la vendeuse de Khao Phing Kan était, comme la grève, sur une crête plus fine que la grille du sol (10 m) :
  le relief jouable dit « terre », le maillage montre l'eau. Remontée sur le sable sec ;
- un escalier entre la terrasse des moines (47 m) et le plateau (113 m) : on n'y monte que par le câble de
  Phi Phi. SCENARIO.md parle d'« escaliers de centaines de marches » ; c'est un lot de relief
  (recolter-relief-thailande.py, comme l'escalier des moines de Phi Phi) ;
- 22 points bloqués à Ko Panyi (le ponton qui part du coin du bâtiment Panyee) et 11 à Phi Phi (pontons).

**Demandes pour monde.js** :
- la minicarte ne dessine pas la mer : à Ko Panyi tout est vert, le village sur pilotis semble sur l'herbe.
  Un fond de mer (`f.merCouleur`) là où `hauteur < f.mer`, sur une grille grossière précalculée ;
- `addLieu` d'un repère de type `pnj` dont la place est calculée au chargement (les pêcheurs de Ko Panyi et
  de Khao Phing Kan posent leur barque eux-mêmes) : accepter un repère ajouté dans `plus()`.

**Demandes pour d'autres fichiers** :
- pnj.js : un rôle d'enfant (les enfants sont ici le rôle de Nok à l'échelle 0,72) ;
- assets_back : une tôle ondulée Poly Haven (`corrugated_iron`, CC0, 512 px) pour les toits de Ko Panyi et
  de Ton Sai, faits de `metal_plate_02` ;
- les tuiles Copernicus de la Thaïlande (`carte/mondes/copernicus/`, 85 Mo) et `tifffile` à installer sur le PC,
  pour pouvoir relancer recolter-relief-thailande.py (les .osm, eux, y sont).

**Questions pour Eugène** : Railay en bungalows de bois sous la tôle, ça te va ? Et l'escalier du grand piton
(la terrasse des moines → le plateau) : le veux-tu, ou le câble suffit-il pour le sommet ?

### Thaïlande — l'escalier du grand piton et les bungalows de Railay (5 octobre, soir) — **faits, vérifiés en rendu et au banc, publiés (06be33a)**

Eugène : « oui pour les bungalows de bois, et fais l'escalier ».
- **L'escalier** (`escalier()`, thailande.js) : le relief ne pouvait pas le porter (grille de 10 m, lacets
  trop serrés ; et ni les tuiles Copernicus ni tifffile ne sont sur le PC). C'est un ouvrage maçonné contre
  la falaise sud, entre le temple et la paroi : trois volées et deux paliers qui se replient, chacune plus
  près de la paroi que la précédente (rien ne se recouvre en plan : `solEscalier` donne un seul sol par
  point), puis un pont de 18 m jusqu'au bord du plateau. 117 m de marches de 30 cm pour 67 m : 30°.
  Parapets de nagas (écailles vertes, `clay_roof_tiles_02`), deux têtes dorées au pied ; les bords sont
  inscrits dans les collisions (`inscrire`) : on n'en tombe pas. Le parcours SANS le câble de Phi Phi atteint
  le plateau, la cour du puits et les balayeurs. Les trois moines de l'enquête sont descendus au pied de
  l'escalier (leur place était sous les volées) ; un repère `passage` au pied. La jungle s'écarte de 4 m.
- **Railay** : bardage de planches à 2 cm devant les murs de monde.js (trois teintes, du bois clair au
  teck), toits à quatre pans en tôle, vérandas et rambardes de bois aux étages.
- **La tôle des toits** (Ko Panyi, Railay, Ton Sai) sortait noire vue d'en haut : `metal_plate_02` porte une
  carte de métal qui en fait un métal pur, sans rien à refléter. `tole()` garde sa couleur et son grain, sans
  la carte.
- **extraire-thailande.py écrit en UTF-8** : sous Windows, `open(path, 'w')` écrivait le plan en cp1252, et le
  jeu ne l'aurait plus lu. Relancée sur le PC, l'extraction redonne le plan à l'octet près.

Mesures : parcours 20 repères sur 20, 36 interactions sur 36 ; praticabilité 98,4 % ; A/B entrelacé (3 + 3,
machine chargée) sans écart, 2 984 → 2 989 ms ; l'escalier coûte 6 ms. Captures :
`bancs/resultats/lieu-thailande-2026-10-05-realisme-escalier-vues.png` (vues 16 et 17 : le pied de l'escalier,
la 1re volée).

Reste : thailande.html porte depuis ce soir les lignes du multi d'une autre session (l'arène de Thaïlande,
`thailande-arene.js`), pas publiées : laissées à cette session. Le haut de l'escalier ne se voit pas bien
depuis la mer.

**Les temples du sommet dégagés** (Eugène, même soir) : les houppiers (4 à 6 m de rayon) mordaient les toits,
`bloque(…, 3)` ne les écartait que de 3 m. `jungle()` ne plante plus rien au-dessus de 100 m sur le grand piton
(le plateau et la bosse du chedi : une esplanade, comme au vrai temple), ni à moins de 12 m d'un bâtiment du
grand piton. Banc : 20/20, 36/36, 3,2 s, jungle 61 → 49 ms. Planche : `…-realisme-temples-degages-vues.png`.
**L'esplanade dallée** (Eugène, même soir : « oui dalle la ») : `esplanade()`, des dalles claires sur tout le
sommet au-dessus de 100 m où la pente reste sous 0,6 (les bords de falaise gardent leur roche), posées sur
le maillage du sol. worn_tile_floor a le bon dessin mais il est sombre (le plateau faisait une tache noire
d'en haut) : éclairci dans le shader, comme parois() ; le marbre, essayé, n'avait pas de joints. 18 ms au
chargement, A/B sans surcoût ; parcours 20/20 et 36/36. Planche : `…-realisme-esplanade-vues.png`.

**Le haut de l'escalier, vu de la mer** (Eugène, même soir). Attention au repère : z croît vers le SUD.
L'escalier est sur la face NORD du plateau ; depuis la grève sud des passeurs, il est de l'autre côté du
sommet, il ne peut pas se voir. Du nord, il ne montrait qu'un pan de maçonnerie beige. Fait : une **sala** au
bout du pont (six colonnes blanches, poutres laquées rouges, le toit des temples en travers du pont pour
présenter ses pans rouge et vert au nord, flèche dorée de 12 m) et une **crête dorée** sur chaque parapet de
naga. De la mer, au nord, au nord-ouest, au nord-est : la sala se voit en haut de la maçonnerie, mais petite
(15 m à 200 m) ; les crêtes, trop fines à cette distance. Le vrai obstacle au nord est le **dôme blanc** du
replat : le bâtiment « Wat Tham Suea » d'OSM (13 sommets, presque carré) que la règle des chedis de toitThai
(plus de 12 sommets, côtés à moins de 1,25) transforme en chedi de 48 m, juste devant l'escalier. Question
pour Eugène : le rendre en temple (un toit à étages), ce qui dégagerait l'escalier depuis la mer du nord ?
Une toiture sur les volées (bandes rouges en zigzag) a été écartée : la caméra monte à 4–7 m au-dessus des
pieds et passerait au-dessus. Planche : `…-realisme-sala-vues.png`.

**Le dôme rendu en temple** (Eugène, 6 octobre : « oui rends le dôme en temple »). La règle des chedis de
`toitThai` exige maintenant moins de 40 m (Phra Chedi Khiri en fait 30) ; l'enclos du Wat Tham Suea prend un
toit de temple, à pente 0,55 au lieu de 1,35 au-delà de 30 m de large (à 1,35, 38 m de toit refaisaient le
mur). De la mer, au nord : l'escalier se lit au-dessus du temple, la rampe blanche en diagonale et la sala en
haut. Le débord nord du toit vient s'appuyer contre la maçonnerie de la 1re volée (rien ne dépasse dans la
volée). Banc : 20/20, 36/36. Planche : `…-realisme-temple-vues.png`.

#### Aveyron : les intérieurs des trois maisons (5 octobre, `c6735bc`)

Eugène : « fais les intérieurs des trois maisons, en exploitant ce qui a été fait pour le mode multi ».
`batut.js` (le multi) est un niveau à part, avec deux manoirs de 30 × 36 m. On y a repris ses leçons, sans
y toucher, mais DANS les maisons d'aveyron.js, à leurs vraies dimensions : on passe la porte qu'on voit.
- **Pourquoi pas une page à part** : `PAGES` (engine.js) ne la connaîtrait pas, et une sauvegarde faite
  dedans ramènerait à Lille à la reprise.
- **Les terre-pleins** (`fondre-relief-aveyron.py`, `J['replats']`) : le relief est mis de niveau sous
  chaque maison, plus une maille de 5 m (sans elle, l'interpolation remontait dans la maison), puis
  raccordé sur 7 m. Le moteur ne sait pas poser un plancher sous une maison tournée (`addPlatform` est
  aligné sur les axes) : le sol de la maison est le relief.
- **`interieur()`** : des murs creux de 60 cm (la face extérieure sur l'emprise), percés de portes. Leur
  collision est une capsule du moteur (`addCap`) qui s'arrête au linteau. S'y ajoutent l'enduit du
  dedans, les sols et les plafonds à poutres (3 à 3,2 m), et les meubles (capsules couchées : la
  maison est tournée). `mobilier()` fournit canapé, fauteuil, table et chaises, buffet, armoire,
  rayonnage, tapis, horloge, tonneau, lit, piano ; `cheminee2()` la cheminée.
- **Les maisons ne sont plus inscrites dans la grille de monde.js** (on n'y entrerait pas). Leurs emprises
  (`EMPRISES`, `dansUneMaison`) écartent arbres, rochers, brebis, passants et dépendances.
- **Les portes d'entrée font 1,9 m**, vantaux ouverts dedans : Camille a 0,5 m de rayon. La porte
  cintrée du Batut, la porte bleue du Pouget et celle de la tour de Beauregard ont été élargies. Les
  trois marches du Pouget sont devenues un seuil : un perron ferait marcher Camille dans le plancher.
- **Le plan** :
  - le Batut : le grand salon et sa cheminée au centre, la bibliothèque dans le corps bas, la salle à
    manger et la cuisine dans l'aile ;
  - le Pouget : le vestibule dans la tour carrée, le hall dallé, le salon, la salle à manger et sa
    longue table de famille, la cuisine dans l'aile basse ;
  - Beauregard : la tour d'escalier (28 pans de pierre, le noyau et les marches de la vis, on passe à
    droite), le hall, le salon et sa cheminée, la salle à manger.
- **La caméra** (`anime`) : dans une pièce (`DEDANS`), elle reste sous le plafond et se rapproche ;
  dehors, elle reprend le champ de monde.js. **Le jour** : un aplat clair sur la face intérieure de
  chaque fenêtre.
- **Le banc** voit trois objets à regarder au fond des pièces (les livres du Batut, la table de famille
  du Pouget, la cheminée de Beauregard) : 30 cibles sur 30 atteintes en marchant depuis le départ. Les
  rues restent praticables à 100 %. « Maisons Roquette » 238 ms. Planche :
  `…-regard-interieurs-2-vues.png` (vues 6 à 8 : les trois intérieurs).
- **Reste** : les étages (escaliers praticables, `addRamp` et `addHelix` comme au Batut du multi :
  sans plancher tourné, il faudra des capsules à plancher) ; les portes qu'on ferme ; la pénombre ;
  l'aïeule dans sa salle à manger.

#### Aveyron : les étages, les portes, les cours (5 octobre, `b8b4644`)

Eugène : « fais les trois points qui restent (étages, portes qu'on ferme, pénombre ; l'aïeule) et ajoute
de la végétation, des éléments (animaux, arbres, bancs, tonneaux) ».
- **Les étages** : le moteur a un plancher qui suit une maison tournée, le « segment à bouts carrés »
  (`world.platforms.push({ seg: true, carre: true, … })`, comme citadelle.js et village.js), et des
  rampes dans n'importe quelle direction (`addRamp`). `interieur().etage()` pose les planchers,
  `.escalier()` la rampe, ses marches, les deux limons (des capsules dès 60 cm de haut, qui font
  garde-corps en haut) et une barre sous la marche haute, à 2 m (rez-de-chaussée seulement). Les
  capsules de l'étage ont un plancher (`interieur(g, monde, y, -0.4)`) : elles n'arrêtent pas qui
  passe dessous.
  - le Batut : l'escalier longe le mur de la bibliothèque (5,4 m, 31°), la chambre du maître ;
  - le Pouget : l'escalier au milieu du hall (3,6 m, 42°), le palier, la chambre de l'aïeule (ses
    deux portraits, un Batut et un Beauregard) et la chambre bleue ; un mur ferme le haut de la tour ;
  - Beauregard : l'escalier au milieu du hall, la chambre et le bureau. La vis de la tour reste un
    décor : tous les tracés essayés barraient le passage du bas, de la porte au hall.
- **Appris (Camille a 0,5 m de rayon)** : au pied d'un escalier, il faut, entre le mur et le bout du
  limon, la place d'y monter de côté ; en haut, un palier d'au moins 1,2 m avant tout mur ; une barre
  sous la marche haute arrête aussi celui qui arrive en haut si elle monte au-delà de 2 m.
- **La sonde** (`bancs/lieu-aveyron.mjs`, `sonde`) marche avec `tryMove` (rayon 0,5) et `getH` à la
  hauteur où l'on est, de la porte de chaque maison à sa chambre de l'étage : les trois arrivent
  (3,22, 3,32 et 3,32 m). Le banc de grille ne juge plus ce qui est dans une maison, puisqu'il ne
  connaît pas les étages.
- **Les portes qu'on ferme** (`.porte()`) : le battant pivote ; fermée, une capsule barre le passage ;
  ouverte, son rayon passe à 0 (« grille ouverte », engine.js). Une interaction « ouvrir / fermer » à
  chaque porte intérieure. La cuisine du Batut est fermée au départ.
- **La pénombre** : des plafonds et des murs plus sombres dans la bibliothèque, les cuisines et le bureau,
  des chandelles qui luisent. Aucune lumière nouvelle.
- **L'aïeule** est au bout de sa table, dans la salle à manger du Pouget.
- **Le tissu** : la laine bouclée est à carreaux ; on garde son relief et sa rugosité, sans son image de
  couleur (`drap()`).
- **Les cours et les prés** (`garnir()`) : 3 charrettes, 3 tas de bois, 9 tonneaux, 6 bancs de pierre
  (devant chaque maison, à la fontaine, au ponton, au barrage, au pêcheur), 3 abreuvoirs à sec,
  6 meules de foin, 3 chevaux blancs qui broutent ; chacun a sa capsule. Dans `arbres()`, 2 345 touffes
  d'herbe sèche (au bord des chemins, au pied de la lisière, par plaques dans les prés).
- Mesures : chargement 4,4 s ; étapes « maisons Roquette » 266 ms, « cours et prés » 32 ms ; rues
  praticables 100 %, 26 cibles sur 26 hors des maisons. Planche : `…-regard-garnir-5-vues.png`.
- **Reste** : la vis de Beauregard praticable ; les étages des corps bas du Batut ; des animaux de
  basse-cour (le jeu n'a pas de modèle de poule ni de chien) ; le châtaignier et le genêt (`foret.js`).

#### Aveyron : la vis de Beauregard, l'étage du Batut (5 octobre, `c6750bc`)

- **Défaut publié puis corrigé** : dans `b8b4644`, un commentaire `//` ajouté au bout d'une ligne
  a avalé l'appel qui suivait sur la même ligne. Le mur entre le grand salon du Batut et l'aile
  manquait (à la vue et à la marche). **À retenir : jamais deux instructions sur une ligne dont la
  première porte un commentaire de fin.**
- **La vis de Beauregard**, en deux volées `addHelix` (dans la maison tournée, l'angle et le sens se
  convertissent en angle du monde : `th(a)`, `cw`) :
  - la première part à gauche du passage vers le hall, tourne par la gauche et passe au-dessus de la
    porte à 2,65 m ;
  - la seconde, douce, tourne par la droite au-dessus de qui passe et arrive à 3,32 m côté hall. La
    tour s'y ouvre à l'étage, et un palier rejoint celui du hall par-dessus le mur.

  Au rez-de-chaussée, on passe à droite, sous la vis. Sous les marches de 1,35 à 1,8 m, des butées
  de 35 cm de rayon, 1 m sous la marche : plus larges et plus hautes, elles arrêtaient Camille au bas
  de la vis. Au-dessus de la porte d'entrée, la tour est fermée par une capsule à plancher (2,6 m).
  L'escalier droit du hall reste : on monte par l'un et on redescend par l'autre, comme au Batut du
  multi.
- **L'étage des corps bas du Batut** : la chambre des enfants au-dessus de la bibliothèque (2,2 m sous
  plafond, sous la pente), la chambre d'amis au-dessus de la salle à manger, le grenier au-dessus de la
  cuisine (cloison et porte). Le rez-de-chaussée des corps bas passe à 3,10 m de plafond, pour que tous
  les étages soient au même niveau (3,22 m). Les murs se percent aussi à l'étage : option
  `etage: { y, h }` d'une porte de `interieur().mur()`, la même porte au-dessus de celle du bas.
- **La caméra dans la tour** : son entrée de `DEDANS` n'avait pas de `bas`, et la caméra ne s'y tenait
  jamais basse.
- **La sonde** a six parcours, tous arrivés : les trois maisons jusqu'à leur chambre, la vis de
  Beauregard, la chambre des enfants et le grenier du Batut. Rues praticables 100 %, 26 cibles sur 26.
  Planche : `…-regard-vis-4-vues.png` (vue 4 : la vis ; vue 5 : l'étage de l'aile du Batut).

#### Acte I, B3 : la citadelle et Phinaert (5 octobre au soir, `e901032`)

Consigne B3 de `PLAN-2026-10-05-ACTE1.md`. Tout est dans `citadelle.js` (`ACTE1_CITADELLE`, en fin de
fichier) ; le détail est dans `docs/DECOUPAGE-ACTE1.md` § 9 et § 10.
- **Fait** : les soldats cachés (caporal, tambour, vieux soldat) ; l'armurerie du bastion du Roy, la
  flèche dans la poudre, l'armurier et les bombes (touche **V**, `TOUCHES.KeyV`, dix dans le sac) ; la
  Moule-Reine, le Capitaine sans tête (la nuit), la Grande Corbelle, leurs clés et les billets 4 à 6 ;
  les trois cadenas ; Phinaert (la cloche à mi-vie, la corde coupée à l'arc, la dalle et la porte de
  lumière à un quart) ; `temple`. Les créatures complètent `KINDS` et `BOURSE.PRIMES` depuis
  citadelle.js (`setMaker`, `setAnimHook`), sans toucher à engine.js.
- **Vérifié** : `bancs/acte1-citadelle.mjs`, 35/35, une capture par moment clé ; tous les lieux de
  l'acte joignables à pied depuis la place (sonde sur une grille de 2 m). Chargement : 19,2 s avant
  (Σ 13,8 s, machine chargée par les autres bancs), 11,0 s après (Σ 7,6 s) ; l'étape « personnages »
  (où naît le décor de l'acte) 820 → 561 ms : rien de mesurable.
- **Reste** : l'arrivée sur l'île (`temple.js`, ci-dessous) ; les intérieurs des casernes (SCENARIO.md,
  « on entre partout ») ; l'atelier de l'armurier et les murs fendus (leurs répliques en gras attendent).

**Demandes pour d'autres fichiers** (B3) :
1. **`engine.js:2687`, urgent** : `if (state.bow) player.mesh.userData.bowBack.visible = true;` plante
   `loadGame` dès qu'une sauvegarde a l'arc — la Camille riggée (pnj.js) n'a pas de `bowBack` (elle a
   `arcDos`). La partie ne démarre plus : à la citadelle, à l'île du temps, partout. Garde :
   `if (state.bow && player.mesh.userData.bowBack) …`. B2 l'avait vu aussi.
2. **`quetes.js`** : au début d'`onKill`, `if (ACTE1_CITADELLE.onKill(e)) return;` ; dans `objective`
   (ou `suiteActe1`), `const o = ACTE1_CITADELLE.objectif(); if (o) return o[0]` (le point d'or :
   `o[1]`). Après quoi la **passerelle** de `ACTE1_CITADELLE.populate` (qui enveloppe
   `G.level.onKill`, `.objective` et `.counts`) se retire. Aussi : la **dalle gravée provisoire** de
   `populate` (devant la grille de l'enclos) mène à l'île sans condition — à cacher pendant l'acte I
   jusqu'à `temple` (la vraie porte est dans citadelle.js). Et les répliques de la ville à l'étape
   `citadelle` (le crieur, Hermès, la marchande) : B1.
3. **`hud.js`, `counts()`** : prendre `ACTE1_CITADELLE.bandeau()` quand il n'est pas `null` (les clés
   des cadenas et les bombes) ; pendant les étapes du bourg, le bandeau dit encore « Monstres vaincus
   0 / 10 », qui ne veut plus rien dire.
4. **`temple.js`** : l'arrivée de la fin de l'acte I, quand `state.acte1 === 'temple'` et la première
   fois : le mage (« Je t'attendais depuis longtemps. »), le mythe, le premier vers lu au mur, « La
   suite est effacée », « **La porte du Midi est ouverte.** » (DIALOGUES-ACTE1.md, « Le mage, au
   Temple ») ; la porte du Midi entrouverte, du sable rouge dessous. On y arrive par
   `goToLevel('temple', [0, 0, 23.5], Math.PI, …)`.

**Appris** (B3) :
- `updateEnemy` pose toute bête volante (`fly > 1`) sur un sol à 0 au moins : une bête au ras d'une
  eau en contrebas (la Reine) flotte en l'air. On tient sa hauteur soi-même après le moteur.
- Le garde-corps du pont de la Porte Royale arrête les flèches : on n'atteint pas le fossé à l'arc
  depuis le pont. Les bombes passent par-dessus (citadelle.js ne teste le mur qu'au ras du sol).
- `getH(x, z)` sans hauteur, près de la Porte Royale, rend le dessus d'une maçonnerie (3,5 m) au-dessus
  de l'eau : donner la hauteur cherchée (`getH(x, z, EAU_Y)`).
- Une bête qu'on sort de `enemies` (Phinaert pendant la cloche et la fin) n'est plus animée ni
  « dé-rougie » par le moteur : la sortir pendant un coup reçu la laissait rouge.
- Le terre-plein de Turenne ne se marche que sur une bande (de la rampe au magasin, 117 cases de
  2 m sur 2 097) ; à 12 m de la courtine du nord-ouest, la rue du rempart traverse une caserne
  (les fantômes de l'ancienne histoire y étaient) — à 22 m, 134 m de rue droite.
- `SCENARIO.md` met l'armurerie sur l'emprise n° 6 « du bastion du Roi » : le relevé la met sur le
  bastion de la Reine. Le vrai bastion du Roy a son magasin (emprise n° 8), près de la poterne.

#### Acte I, B1 — le bourg et la nuit (5 octobre au soir, `b02b8c2`)

Étapes 2 à 6 de `docs/DECOUPAGE-ACTE1.md`, de la fin du prologue à la lanterne en main. Le banc
`bancs/acte1-b1.mjs` les joue de bout en bout dans une seule partie (23 vérifications, aucune erreur) ;
`bancs/acte1-bourg.mjs` filme les témoins ; `bancs/acte1-outils.mjs` donne les gestes communs aux bancs
de l'acte (une partie au prologue passé, parler, entrer dans un intérieur, filmer sans mur devant).
- **Les témoins replacés** (le bourg relevé les avait déplacés) : le gardien dans l'axe du portail de la
  chapelle (il se tenait à la porte du beffroi), le crieur au pied de la fontaine, tourné vers la
  grand-rue, le pêcheur sur une berge d'où l'on voit l'eau (`rive()`, par `eauVisible`).
- **Gustave** (`tavern.js`), ses deux répliques, l'indice `escalier`. **La porte basse** du beffroi :
  un vantail bâti par `village.js` (`PARTAGE.porteBeffroi`), ouvert par défaut pour une ancienne partie,
  fermé à clé par l'acte I jusqu'à la nuit où l'on a la clé (`state.porteBeffroi`).
- **Les vers** : quatre mottes au bord du champ du nord, côté moulin (au milieu, le blé debout les
  cachait ; de l'autre côté, le bois). **La pêche** : partout face à l'eau ; la clé au canal de la Tortue.
- **La nuit** (`state.nuit`, posée par le lit de `house.js`) : `nuitLille()` dans `quetes.js`, par ce
  que le moteur exporte. Une fenêtre sur trois s'allume : un tirage par baie sur le centre de son
  quadrilatère, retrouvé dans le shader par les dérivées de l'écran (les baies sont fusionnées).
  Pas de lumière ajoutée : celle du haut du colimaçon monte avec Désiré.
- **Désiré** : le jour nulle part, la nuit au sommet, la lanterne donnée dans les rues. L'énigme
  passe par `ATLAS.enigme({titre, sous, intro, gagne, perd})` ; la bonne réponse donne aussi la carte.
- **Chargement** : rien de nouveau ne naît au chargement (14,3 s avant, 7,7 s après : la machine).

**Demandes pour d'autres fichiers (B1)** :
- `engine.js` : sur tactile, le bouton Agir envoie un appui de 80 ms (`envoyerTouche`) ; pour ramener
  la ligne, il faudrait que la touche reste enfoncée tant qu'on appuie.
- Pour B3 : la nuit existe (`state.nuit`, `nuitLille`) ; le Capitaine sans tête peut la lire.

### Acte I, B2 — sous la ville (5–6 octobre, PC, `PLAN-2026-10-05-ACTE1.md`) — **fait, joué en headless, publié (05f72fd)**

Étapes 7 et 8 de `docs/DECOUPAGE-ACTE1.md` (le détail y est, § 7 et § 8). La dalle de la crypte
(`chapelle.js`) descend aux galeries avec la lanterne (`souterrains`) ; dans `cave.js`, pour une partie
de l'acte I seulement : Bastien près d'une citerne neuve, l'arc au puits aux chauves-souris (`arc`), le
levier de la grille scellé haut et touché d'une flèche, le Rat-Roi terré que trois tonneaux pendus font
sortir, la clé de la poterne, la porte de la poterne puis la citadelle (`citadelle`, `galleryOpen`). Les
billets d'Eugène 2 et 3, le trône du Rat-Roi. L'ancienne histoire (vanne, cage, Eugène) intacte.
Banc : `bancs/acte1-souterrains.mjs` (26 pas sur 28 ; il importe `bancs/acte1-outils.mjs` de B1) ;
captures `acte1-souterrains-2026-10-05-*.jpg`. Charge : rien de changé (index.html ne charge pas la cave).

- **Appris** : la cave lit `prologueFait` dans la SAUVEGARDE (`readSave`) avant de bâtir : `build` et
  `populate` passent avant que `startGame` ne charge l'état, et la sauvegarde retrouve les monstres par
  leur rang — les deux histoires ne pondent pas les mêmes, l'ordre doit rester stable.
- **Appris** : `G.level.arrowBlocked(p)` est appelé pour chaque flèche ET pour le point rouge de la
  visée ; une cible qui y répond vrai accroche le point rouge. Pour ne déclencher qu'à une vraie flèche :
  `arrows.some((a) => a.mesh.position === p)`. Et `viseeArc` vise tout monstre non mort, même `caged` :
  un monstre caché doit avoir sa position hors du plan (le Rat-Roi terré est en 500 ; 500, seul son
  maillage montre le museau).
- **Appris** : une futaille posée à ± 70 cm au hasard barre une marche en ligne droite un essai sur
  deux ; les bancs marchent par un chemin cherché sur la grille de `blocked`, Camille invulnérable
  (morte, la boucle s'arrête et les flèches restent en l'air).

**Demandes pour d'autres fichiers** :
- **`engine.js` (urgent, bloque la suite de l'acte)** : `loadGame` (l. 2687) fait
  `player.mesh.userData.bowBack.visible = true` ; la Camille riggée (`pnj.js`, `installerCamille`)
  n'a pas de `bowBack` : avec l'arc en poche, toute page qui recharge la partie lève une exception,
  `startGame` s'interrompt et **la boucle ne démarre pas** (page figée). Cela touche l'acte I en sortant
  des galeries (index.html), et l'ancienne histoire à chaque rechargement avec l'arc. Remède d'une
  ligne : `if (state.bow && player.mesh.userData.bowBack) …`. `cave.js` et `chapelle.js` s'en gardent
  en posant un `bowBack` invisible avant `bootLevel` ; `game.js` (B1) pourrait faire de même en attendant.
- **`quetes.js` (B1)** : `INDICES` peut reprendre `state.ind.bastien` (« L'arc de l'intendant est au
  puits aux chauves-souris, à droite après la citerne » — Bastien, fait : `state.bow`) et
  `state.ind.ratRoi` (« Le Rat-Roi a avalé une clé ; une flèche dans les tonneaux pendus » — Bastien,
  fait : `state.clePoterne`).
- **B3 (`citadelle.js`)** : on arrive de la poterne avec `acte1 = 'citadelle'`, `galleryOpen`, `bow`,
  `bowChest` (le coffre de l'arc du bastion de Turenne est donc déjà ouvert), `clePoterne`, et
  `state.billets = { 2: true, 3: true }` si on les a lus — les billets 4 à 6 peuvent suivre la même
  convention. Le placement devant la poterne est déjà fait par `quetes.js` (`onLoad`, arrivée de `cave`).

## 5. Ce que le code a appris — à ne pas redécouvrir

- **Un plan de cinématique qui suit un acteur (`actor`, `to`) s'achève QUAND L'ACTEUR ARRIVE**
  (`cutTick`), pas à `dur`. Un `setTimeout` lancé dans son `fn` peut donc tomber dans le plan
  suivant, ou dans le noir : donner à l'événement un plan à lui (la herse du prologue).
- **Un `addCap` en cours de partie fait réindexer toute la grille** au test suivant : en
  ajouter plusieurs, c'est d'un coup (la foule du prologue).

- **Libérer un tableau de géométrie après l'envoi** (`attribute.onUpload`) : y mettre un
  tableau VIDE du même type, jamais `null` — `BatchedMesh.onBeforeRender` (three r160) relit
  `index.array.BYTES_PER_ELEMENT` à chaque image. Et seulement pour ce qu'aucun rayon ne vise :
  `Mesh.raycast` relit positions, UV et normales.

- **Un écran figé juste après un geste, c'est souvent des shaders recompilés.** three.js
  compile une variante par matériau selon : le NOMBRE de lumières de la scène (ajouter une
  `PointLight` en cours de jeu recompile tout — passer par `sourceLumiere`, le réservoir
  d'engine.js), et la cible de rendu (écran ou image du post-traitement : couper `G.postFX`
  recompile tout ; `compileAsync` doit viser `composer.renderTarget1`). Pour le voir :
  compter `renderer.info.programs` avant et après le geste.
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
- **Une marche de 0,5 m est un mur** (`tryMove`, `maxStep` 0,5) : tout sol posé à plat sur
  un relevé qui ondule (bourg, socles, terrasses) doit rejoindre le terrain en pente, et le
  sol DESSINÉ doit suivre la même fonction que le sol marchable (cf. `draper`, village.js).
- **Une capsule centrée sur un mur double la distance d'arrêt** : rayon de la capsule plus
  rayon de Camille (0,5). Poser la capsule sur le mur, rentrée de son rayon.
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
- **`material.clone()` ne copie pas `onBeforeCompile`** : un clone de `eauMat()` perd son shader et
  rend une eau turquoise unie. Pour qu'un ruban d'eau se voie quel que soit le sens de son contour, on
  pose ses triangles dans les deux sens plutôt que de cloner en `DoubleSide` (quaiDuWault, 5 octobre).
- **`distBati` compte aussi le bâti relevé qu'on n'élève pas** (abris, annexes, emprises écartées) : il ne
  dit pas « près d'une façade dessinée ». Il pavait tout le cœur des îlots.
- **Un point de banc se vérifie au rayon** avant d'en tirer un écart : trois des cinq vues de
  `regard-ville.mjs` filmaient autre chose que ce qu'elles nommaient (une cour, le dessus d'un
  soubassement, la voie des combattants au lieu du chemin du bourg). La sonde : un `Raycaster` lancé de la
  caméra du banc, qui donne le nom du maillage et de son groupe.
- **Mesurer en A/B entrelacé quand la machine est partagée** : remettre le temps d'un banc la version publiée
  (`git show HEAD:fichier > fichier`), mesurer, restaurer, mesurer la nouvelle — deux fois, sous le même
  verrou `bancs/tour.sh`, les fichiers sauvegardés à part et restaurés par un `trap`. Avec les bancs des
  autres sessions, la même version a varié de 8 à 13 s dans la matinée du 5 octobre.
- **Ne rien éditer pendant `publier-dev.sh`** : le contrôle prend plusieurs minutes, et le commit prend les
  fichiers tels qu'ils sont À LA FIN. Un fichier du lot modifié entre-temps partirait sans avoir été contrôlé.
- **Une planche de vues ne dit pas si un lieu est jouable** : le sommet du grand piton était beau sur toutes
  les captures, et inatteignable sans escalader la falaise. Un parcours (recherche de chemin depuis le départ,
  `TLOC_PARCOURS=1` de `bancs/lieu-thailande.mjs`) le voit tout de suite. Le moteur, lui, ne refuse presque
  aucune pente (`tryMove` : 0,5 m par pas de trame) ; la règle des 35° est celle du confort, pas du jeu. Une
  interaction exige la portée ET moins de 3 m d'écart de hauteur (engine.js) : un objet au sommet d'une bosse
  ne se prend pas d'en dessous.

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

### Acte II, l'Aveyron (6 octobre, PC, vague 1, consigne C1) — **fait, joué en headless, publié**

Découpage et répliques validés par Eugène (« d'accord sur les cinq, garde les fonctions ») :
`docs/DECOUPAGE-ACTE2.md`, `docs/DIALOGUES-ACTE2.md`. Tout le code est dans `aveyron.js`, section
« L'ACTE II » : `state.acte2` (guerre → temoins → traces → preuve → duel → familles → dormeur →
pluie), `state.ind2` (le carnet, branché par `G.level.indices`), `state.colliers`, `state.force`.
L'acte commence dès qu'on arrive au lac (les portes de l'île restent ouvertes).
- **Étapes 1–2** : les gardes du lac (un coup en l'air, Camille repoussée tant que la preuve n'est
  pas montrée), le maître de Beauregard dans le salon, la cave de Beauregard et le prisonnier derrière
  sa grille, la forge de Fariboules et le forgeron.
- **Étapes 3–5** : l'abreuvoir de Beauregard, la piste de l'étoile (41 groupes de fers, cherchée sur
  une grille de 3 m, visibles à 12 m seulement), l'enclos caché (≈ 440 ; 395, réservé aux arbres par
  `RESERVES`), 16 brebis aux deux raies, trois brigands (`KINDS.brigand`, corps riggés de pnj.js par
  `setMaker`/`setAnimHook`), les colliers, la preuve montrée aux deux maisons, le duel sur la crête du
  barrage (`KINDS.brasdroit`), Jacques qui file vers l'ouest à cheval.
- **Étapes 6–8** : les maîtres à la table de l'aïeule, la faille (−240 ; −135) murée qu'une bombe
  ouvre (bombe POSÉE, `state.bombes`/`nbBombes` ; le lancer reste dans citadelle.js), la cave du
  Dormeur (Jacques `KINDS.jacques` et deux hommes, trois veines à la bombe, trois coups au cœur, les
  mains de pierre), Phinaert qui fige Camille deux secondes, Jacques à terre, la force, la Cloche du
  Midi, le deuxième vers gravé, le bloc poussé, la pluie (SUN_DIR, ciel, brume, 2 000 gouttes autour
  de Camille), le repas au Pouget.
- **Appris** : les caves sont bâties à y = 600 au-dessus du lac et n'ont de sol et de murs
  (`addBox`, capsules à `bottom`) que pendant qu'on y est (`entrerSous`/`sortirSous`) : la grille de
  relief ne se creuse pas. Les interactions y sont sûres (le moteur compare la hauteur à 3 m près).
  Une créature laissée dans une cave tomberait de 600 m : on la retire en sortant.
- **Bancs** : `bancs/acte2-temoins.mjs`, `acte2-preuve.mjs`, `acte2-dormeur.mjs`, tous réussis
  (captures `bancs/resultats/acte2-*-2026-10-06-*.jpg`). Le seul 404 de la page est `favicon.ico`,
  absent du site entier (les bancs le comptent à part).
- **Mesure** (`bancs/lieu-aveyron.mjs`, machine chargée par les autres bancs) : chargé en 4,7 s
  (3,1–3,8 s le 5 octobre) ; l'étape « le reste (bourg, gens, sécheresse) », qui porte l'acte, 147 ms ;
  les gens de l'acte naissent un par image après le chargement ; 41 cibles sur 41 atteintes en marchant.
- **Sans l'acte I**, il faut l'épée (`state.sword`) pour les combats et les bombes pour la faille :
  une partie neuve ouverte droit sur le lac ne peut pas finir l'acte.

#### Demandes pour d'autres fichiers (acte II)
- **temple.js** : au retour de l'Aveyron (`state.acte2 === 'pluie'`), la Cloche du Midi au premier
  étage (cloche de ferme trapue, fer rouillé, DECISIONS-RECIT.md § 2), un escalier de pierre jusqu'à
  elle, un rai de soleil fixe sur la cour, une cigale ; on la sonne ; la deuxième révélation (le vers :
  « Une gardienne sonnera les cloches, et chaque cloche le servira. »).
- **monde.js** : un crochet pour hausser l'eau d'un lac après coup (« le lac remonte » n'est pas
  fait) et pour reverdir un sol (la pelouse du Pouget) ; toujours : l'eau profonde qui bloque.
- **engine.js** : le favicon (un 404 à chaque page) ; un lancer de bombe hors de la citadelle.
- **Reste** : les grandes quêtes secondaires (course des maisons, arbre des Roquette, sources,
  train) ne sont ni découpées ni codées ; le point d'or de la carte ne suit pas l'acte II.

### Multi, C7 — ce que chaque arène déclare, les chemins des bots (6 octobre, PC, `PLAN-2026-10-06-VAGUE1.md`) — **fait, vérifié au banc, publié**

Le détail et les tableaux : `docs/NOTE-MULTI.md`, « Ce que chaque arène déclare, et les chemins des bots ».
- Les arènes déclarent `forge`, `bannieres`, `fete` ; ce qui n'est pas déclaré est éteint (client et
  serveur). Lille garde tout ; bannières au Batut, au Pouget, à la Garde-Guérin. Publié 1bd6d84.
- `grapheAuto` (tloc-multi.js) : le graphe des bots tiré tout seul pour la Garde-Guérin, le Pouget, Ko Panyi
  et Gallipoli. Banc `bancs/multi-graphe.mjs` : un bot rejoint un joueur caché 9 fois sur 9 avec, 2 sur 9 sans.
- Passe des six arènes × quatre règles (`bancs/multi-arenes.sh`) : aucune pageerror. Corrigés en route : la
  Garde-Guérin sans drapeau ni ralliement (borne de 5 km au serveur), l'exception de la remise des bannières.

- **Appris** : **`uvicorn --reload` ne recharge pas sous Windows** (le serveur du 5 octobre tournait le 6 avec
  l'ancien app.py) : après toute modification d'`app.py`, relancer `./lancer.sh`, sous `bancs/tour.sh`.
- **Appris** : en chacun pour soi, les bots se chassent entre eux : un banc qui mesure une poursuite n'en met qu'un.
- **Appris** : les mondes de monde.js sont loin de l'origine (la Garde-Guérin à z = −5 340) : toute borne de
  coordonnées au serveur doit le savoir.

**Demandes pour d'autres fichiers** :
- **`gallipoli.js` (C3)** : rien d'obligatoire — Gallipoli prend le graphe automatique. Si l'on veut des
  bannières à Gallipoli : `bannieres: true` dans `ARENE_GALLIPOLI`, et `"gallipoli"` dans `ARENES_BANNIERES` (app.py).
- **`monde.js`** : la minicarte de la Garde-Guérin ne trace toujours pas la limite de l'aire (`PARTAGE.aires`).
- **`thailande.js` (vague 2)** : y replier `thailande-arene.js` ; ajouter `bannieres: true` si on en veut à Ko Panyi.

### Acte IV, les Pouilles (6 octobre, PC, consigne C3 de `PLAN-2026-10-06-VAGUE1.md`) — **lots 1 à 3 faits, joués en headless, publiés (74ab02f, a8ab9d1, 3282a84)**

Découpage et répliques validés par Eugène (`docs/DECOUPAGE-ACTE4.md`, `docs/DIALOGUES-ACTE4.md` ; les six
propositions acceptées : sans souffle, lasso ni poulie ; Nunzia vieillit au retour par le train ; Donato et
Assunta ; rien sur le père de la fille de Nunzia ; l'élan demandé à `engine.js` ; le Colosse figé en instance).
- **Fait** : le temps qui court dans les trois villes (la journée en deux minutes, la marée de Gallipoli,
  `TEMPS` dans `pouilles.js`) ; l'avancement `state.acte4` (de `arrivee` à `chateau`), le carnet
  (`G.level.indices`), l'objectif ; Nunzia à 15, 30, 60 ans (rôles ajoutés à `PNJ.ROLES` depuis pouilles.js) ;
  Cosimo, l'apprenti, le voisin de Donato, le chef de dépôt, le vieux des Sassi, Assunta ; la grotte à marée
  basse sous le château angevin (banc de rochers par `solLieu`, six tarentules, la corde) ; le tambourin
  (touche K, huit secondes de ralenti) ; le château Tramontano (tours creuses, portes à rythme, deux salles
  qui vieillissent en boucle, leviers, sommet du donjon, dalle et vers). Rien de l'acte ne naît au chargement.
- **Vérifié** : `bancs/acte4-enquete.mjs` (22/22), `acte4-tambourin.mjs` (tout passé), `acte4-chateau.mjs`
  (17/17), aucune pageerror ; chargement des trois villes en A/B (`bancs/acte4-charge.mjs`) : Σ 5,8–6,2 s
  avant, 5,7–5,9 s après.
- **Reste** : lot 4 (le Colosse qui marche, le combat, l'élan, la Cloche des Heures, Nunzia à 75 ans) ; lot 5
  (la lettre : Cosimo vieux, la boîte de lettres) ; les petites quêtes. La nuit, la mer reste pâle à
  l'horizon. Les portes du château ne sont pas encore filmées ouvertes (cadrage à reprendre).

**Demandes pour d'autres fichiers** (C3) :
1. **`engine.js`** : l'élan du Colosse (`state.elan`, posé au lot 4) — un saut plus long quand il est acquis.
2. **`temple.js`** : le retour de l'acte IV quand `state.acte4 === 'heures'` (puis `temple`) — la Cloche des
   Heures au troisième étage, le grand cadran dont l'aiguille tourne trop vite, un tic-tac
   (`DECISIONS-RECIT.md` § 3) ; la porte suivante (la Lozère) entrouverte.
3. **`monde.js`** : rien d'obligatoire. La marée retrouve le plan d'eau dans la scène (un disque de 6 000 m) :
   un `G.level.mer` exposé serait plus sûr. Et un crochet pour bloquer ou rouvrir un passage (`bloqueLieu`)
   remplacerait la règle des salles du château, tenue à chaque image dans `matera.js`.

**Appris** :
- Changer `scene.environment` recompile tous les shaders : la nuit des Pouilles baisse l'exposition
  (`renderer.toneMappingExposure`) au lieu de couper la carte d'environnement.
- `SUN_DIR` est lu à chaque image par le ciel et l'ombre : le muter suffit à faire tourner le soleil.
- La caméra sonde `blocked` : un anneau de collision la garde dans une tour creuse.
- `publier-dev.sh` attend son tour dans la file des bancs ; une attente de 30 minutes ne suffit pas quand
  trois conversations tournent (`TOUR_ATTENTE=5400`). Préparer le lot suivant sur des copies pendant ce temps.
- Complément (C7) : `bancs/multi-serveur.mjs` vérifie le serveur relancé — ralliements partout, fête à Lille
  seulement, bannières là où l'arène en déclare : conforme dans les six arènes. Le serveur relancé depuis une
  commande de Claude meurt avec elle : le relancer détaché (`Start-Process` de PowerShell sur Git Bash).

#### Acte II, suite (6 octobre) : les grandes quêtes secondaires — **faites, jouées en headless, publiées**

Découpées dans `docs/DECOUPAGE-ACTE2.md` (seconde partie) ; Eugène : « garde les fonctions, ok pour
le colporteur, course après la vague ». Codées dans `aveyron.js`, section « Les grandes quêtes
secondaires », ouvertes à l'étape `pluie`, avancement dans `state.q2` :
- **les sources** (la femme de la fontaine) : la source des Vergnes à la bombe (un ruisseau en ruban
  qui suit le relief), la fontaine du lac à la force (un bloc dans le bassin), le puits de Perpignou
  (une bombe, puis le seau) ; on y boit (vie pleine) ;
- **l'arbre des Roquette** (l'aïeule) : huit Roquette désignés par leur fonction, chacun hors de chez
  lui ; on leur parle, ils rentrent dans leur cour ; les huit rentrés : un cœur de plus et l'arbre de
  famille peint au mur le plus proche de l'aïeule (trouvé au rayon) ;
- **le train** (le colporteur) : la paie volée en trois caches (la paille de l'enclos, la barque
  soulevée à la force, derrière la maisonnette de la vanne), 60 écus (`bourse.js`, `gagner`).
- **La course des maisons** attend un « monter à cheval » du solo (aujourd'hui dans tloc-multi.js)
  et ce que dit le vieux Roquette (à écrire avec Eugène).
- **Appris, à ne pas redécouvrir** : tout ce qu'un lieu cache, montre ou déplace après coup doit
  porter `userData.dynamic` (sur lui ou un parent). Sinon la fusion du moteur le copie au chargement
  dans les grands maillages de la scène, et la copie reste là quoi qu'on fasse du groupe : les
  pierres du puits restaient visibles une fois le puits rouvert. La publication `7a151c0` avait le
  même défaut pour les caves (bâties à 600 m au-dessus du lac) et les empreintes : corrigé ici.
  Et `garnir()` fusionne ses tas de bois sans collision : une place libre se cherche aussi contre
  les boîtes de ce qui est déjà posé.
- Banc : `bancs/acte2-quetes.mjs`, réussi ; `acte2-preuve` et `acte2-dormeur` repassés après le
  correctif, réussis.

#### Acte IV, suite (6 octobre au soir, C3) — **lots 4 et 5, bronze, genou, petites quêtes, retour au Temple**
- **Publiés** : lots 4 et 5 (071dfce), le bronze du Colosse (`marble_rock_03` n'existe pas : `phMat` rendait un
  gris de repli), son genou à terre (`Fixing_Kneeling`, entré dans les clips des PNJ par un rôle
  `colosse_genou` de `PNJ.ROLES`) ; puis les petites quêtes, la mer de nuit, la marée après la cloche et le
  retour au Temple (`temple.js`, à la demande d'Eugène) — détail dans `docs/DECOUPAGE-ACTE4.md`.
- **La demande pour `temple.js` (n° 2 ci-dessus) est faite.** Restent : l'élan dans `engine.js` (n° 1), et
  pour `monde.js` le plan d'eau exposé et un crochet `bloqueLieu` (n° 3).
- **Appris** : `phMat` d'un nom inconnu ne plante pas, il rend un gris uni (`mat(0x888888)`) et un
  avertissement en console — chercher `matériau Poly Haven inconnu` dans la console d'un banc.
- **L'élan est fait** (demande n° 1, `engine.js`, à la demande d'Eugène) : sauter en courant avec `state.elan` —
  `p.elanSaut`, vitesse montante × 1,3, vitesse en l'air × 1,5 jusqu'à l'atterrissage. Ne reste pour `monde.js`
  que le plan d'eau exposé et `bloqueLieu`.
- **Les demandes pour `monde.js` sont faites** (à la demande d'Eugène) : `G.level.mer`, le plan d'eau (la marée
  des Pouilles le prend là, plus en fouillant la scène) ; `bloqueLieu(x, z, r)` dans la fiche d'un lieu, un
  obstacle à soi qui peut aller et venir (les salles du château de Matera s'en servent). Les neuf mondes de
  monde.js chargent sans erreur (`bancs/acte4-mondes.mjs`). **Il ne reste aucune demande de C3.**

### Acte III, la Thaïlande (6 octobre, PC, consigne C2 de `PLAN-2026-10-06-VAGUE2.md`) — **fait, joué en headless, publié**

Découpage validé par Eugène (`docs/DECOUPAGE-ACTE3.md`, ses réponses en bas : une vraie course en barque, la
cascade, le cloître à Ton Sai, le souffle sans usage dans l'acte, le Yak en volumes Poly Haven). Répliques :
`docs/DIALOGUES-ACTE3.md`. Tout dans `thailande.js` (`state.acte3` : gong → cloitre → mali → masques →
corniche → yak → fete ; le carnet `state.ind3` par `G.level.indices`). Lots publiés : cfbfd17 (découpage, arène
repliée), e2362ba (1, les trajets des passeurs), ea7963c (2, le cloître de Ton Sai, la poulie, le masque de bois),
9db8daf (3, Mali : statue, cascade, course autour de Ko Tapu), 15e1b3a (4, le muet, la grotte de Railay, le masque
de Hanuman), 9ba7873 (5–6, la mousson du belvédère, le Yak), 103840e (7, la fin).
- **L'arène de Ko Panyi** est repliée dans thailande.js (`ARENE_PANYI`) ; `thailande-arene.js` est vidé (un
  commentaire) et n'est plus chargé — **à supprimer par Eugène s'il le veut** (je ne supprime pas).
- Bancs : `bancs/acte3-{baie,cloitre,mali,masques,yak,fin}.mjs`, et `bancs/acte3-tout.mjs` qui les rejoue l'un
  après l'autre (ce n'est pas une seule partie continue) et donne le coût des morceaux au chargement : les
  nouveaux font 2 à 8 ms. Ko Panyi en instance : `TLOC_ARENE=panyi bancs/rencontres.mjs`, sans erreur.
- **Une adaptation** : la barque de Mali est prise DANS la cascade figée (à mi-hauteur), pas au-dessus — le moteur
  laisse grimper presque toutes les pentes, une barque en haut de la falaise ne demandait rien ; le gong la fait
  tomber (« une chose suspendue »), la statue écartée par la force lui ouvre la mer.

- **Appris** : **ne jamais poser l'état d'un acte (ni sauvegarder) dans le `.then` de `monde()`** : le monde est
  bâti AVANT que la partie ne se charge, et `saveGame` y écrasait la sauvegarde qu'on rechargeait (vu au banc de
  la fin : rechargée, l'acte repartait à « gong »). On le pose à la première image où `state.running` (comme
  aveyron.js, `A2.pret`).
- **Appris** : `inscrire()` (monde.js) garde le tableau de points tel quel : le vider (`pts.length = 0`) ôte un
  obstacle sans toucher à la grille (la porte du cloître, la statue de Khao Phing Kan).
- **Appris** : `e.caged = true` (engine.js) rend une créature intouchable, aveugle et immobile : c'est l'état
  « figé » (les danseurs du khon ; le gong le lève).
- **Appris** : pour tenir Camille sur ce qui bouge (la barque de la course), un `solLieu` qui rend le pont de la
  barque : sans sol sous elle, le moteur la croit en chute et lui donne la pose de la chute.
- **Appris** : `G.camBack` est multiplié par `G.echelle` (0,6 dehors) : pour reculer de 11 m, donner 18.

**Demandes pour d'autres fichiers** :
- **`temple.js` — le retour de l'acte III** (sur le modèle de `finActeIPoser` / `finActeIScene`) : quand
  `state.clocheIles` (ou `state.acte3 === 'fete'`) et pas encore vu : la Cloche des Îles pendue au **deuxième
  étage** (haute et fine, bronze clair, feuilles d'or, sans battant : `faireClocheIles()` de thailande.js peut
  être recopiée ou exportée), des **rigoles d'eau autour de la cour dont l'eau coule vers le haut**, **la pluie,
  très loin** (DECISIONS-RECIT.md § 3) ; on la sonne ; la porte suivante (les Pouilles) s'entrouvre, « une odeur
  de mer et d'olivier » ; le mage ne dit rien ; Camille, pour la première fois, hésite devant une porte
  (SCENARIO.md § 12). Le troisième vers est gravé sous la cloche (« Chaque géant donnera ce qu'il est, et ne le
  reprendra pas. »). Les portes restent ouvertes.
- **`pnj.js`** : un rôle d'enfant (Ko Panyi ramène celui de Nok à 0,72) — déjà demandé, toujours utile.
- **Le souffle** (`state.souffle`) n'a encore d'usage nulle part : nager en eau profonde et froide (SCENARIO.md
  § 17) — à brancher dans le moteur (engine.js) ou dans les mondes qui ont de l'eau profonde.
