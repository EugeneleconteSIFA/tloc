# BRIEF DESIGN — The Legend of Camille

Ce fichier est à envoyer à une IA (avec la planche-contact `planche-contact-legend-of-camille.jpg`) pour obtenir de l'aide sur la
direction artistique et la conception : vues caméra, personnage, décors, map. La partie 1 dit ce qu'on attend, la partie 2 fixe la
politique d'assets, la partie 3 est le contexte technique complet du projet (copie de `CONTEXT.md`).

## 1. Ce qu'on attend de toi

**Le projet** : mini-jeu d'aventure 3D façon Zelda, joué au clavier seul, dans la citadelle de Vauban à Lille. Jeu web statique
(Three.js, pas de moteur type Unity/Godot). L'essentiel est généré par le code — personnages articulés en primitives, textures
procédurales, architecture paramétrique — et depuis septembre 2026 une banque d'assets externes vient en complément, sous les
conditions strictes de la partie 2. Toute proposition doit donc être réalisable **soit en primitives Three.js et textures
procédurales, soit avec les assets déjà présents dans `assets_back/`**.

**La DA voulue** : réalisme stylisé, façon *Zelda Skyward Sword* / *Breath of the Wild* — des arbres qui ressemblent à des arbres,
des monstres crédibles, des décors qui font « vrai », mais lisibles et un peu stylisés. On a abandonné le low-poly cartoon (v1) puis
le manga (v2), visibles en bas de la planche-contact : ce sont des contre-exemples. Le ton reste décalé et local (géants Lydéric et
Phinaert, moules mutantes, fantômes de la garnison de Vauban, gaufres qui soignent, estaminet, beffroi).

**Ce qui fait le réalisme ici, dans l'ordre** : l'échelle des matériaux, la variété, la densité de détail, la lumière. Pas le nombre
de polygones. Exemple mesuré (v22) : la brique du village était mappée à 27 cm de long et 27 cm d'assise, le pavé à 30 cm. Remise à
22 cm / 7,5 cm / 12 cm, la même géométrie, la même lumière et les mêmes textures donnent un village nettement plus crédible. Avant de
proposer un asset ou un shader, vérifier l'échelle.

**Sur quoi on veut ton aide** (réponds point par point, avec des propositions concrètes et hiérarchisées : le plus d'impact d'abord) :

1. **Matériaux et échelle** — variation à grande échelle (salissures, traînées de pluie, mousse, différences de teinte d'une maison
   à l'autre) pour que les grandes surfaces de brique ne lisent pas comme un aplat à distance. Usure aux arêtes, flaques, joints.
2. **Vues / caméra** — caméra 3e personne (recul 10,5, hauteur 6,5, contournement des murs). Comment mieux cadrer Camille et le
   décor ? Angles pour les intérieurs (maison, estaminet, galerie), pour le boss, pour l'arrivée dans une zone (« title camera »).
3. **Camille et les PNJ** — héroïne voulue **neutre / peu genrée**, silhouette reconnaissable de loin, tenue cohérente avec le Nord
   et l'époque Vauban revisitée. Attention : les villageois sont aujourd'hui le maillon faible visuel, nettement en dessous de
   l'architecture. Palette, proportions, accessoires, animations clés (idle, course, coup d'épée, roulade, saut).
4. **Décors** — rendre la citadelle, le village flamand, la galerie souterraine et les intérieurs plus crédibles et plus distincts :
   palette par zone, lumière, végétation, détails d'ambiance (linge, charrettes, enseignes, mousse, flaques).
5. **Map / level design** — pentagone (citadelle, rayon 60) entouré d'une plaine fermée par des montagnes, village au sud-est,
   maison à l'ouest du pont. Comment guider le joueur (repères, landmarks, lignes de fuite), rythmer l'exploration, où placer
   secrets et gaufres.
6. **Bestiaire** — rendre les monstres (corbeau, moule mutante, fantôme, rat, chauve-souris, Rat-Roi, Phinaert) plus crédibles et
   plus lisibles en combat (télégraphie des attaques).

**Contraintes à respecter** : clavier seul, performances web (≈10 lumières ponctuelles max par niveau, meshes statiques fusionnés,
ombres 2048), un développeur seul, itérations courtes.

**Format de réponse souhaité** : pour chaque point, 3 à 5 propositions concrètes, chacune avec (a) ce que ça change visuellement,
(b) comment le faire en Three.js / procédural / avec les assets existants, (c) effort estimé (petit / moyen / gros). Pose des
questions si un choix est ambigu.

## 2. Politique d'assets

Sept règles. Elles existent parce qu'un asset mal choisi ne fait pas « un peu moins bien » : il fait rater tout ce qui l'entoure.

**Règle 1 — L'identité flamande prime sur la qualité d'un asset.** L'architecture du village et de la citadelle reste procédurale :
pignons à redents, brique, lucarnes, beffroi, estaminet. C'est ce qui ancre le jeu à Lille, et aucun kit de construction générique
ne le remplace. Un module de mur ou de toit externe n'entre jamais dans une façade du village — même s'il est plus détaillé.

**Règle 2 — Un asset externe entre au niveau du reste, au plus un cran au-dessus.** Un modèle nettement plus fin que son voisin ne
tire pas la scène vers le haut, il désigne le voisin comme inachevé. Avant d'importer, se demander ce que l'asset va rendre moche.

**Règle 3 — Échelle physique obligatoire.** Tout matériau se mappe en mètres réels : brique 22 cm de long et 7,5 cm d'assise
(`brickScaled(largeur, hauteur)` dans engine.js, constante `BRICK_TILE`), pavé 12 cm (`COBBLE_TILE`), planche ≈ 20 cm. Un modèle
importé garde ses dimensions réelles — `assets-browser.html` les affiche — et n'est jamais mis à l'échelle à l'œil.

**Règle 4 — Une seule famille de rendu.** Le jeu est en PBR : couleur + normale + rugosité. Les assets à texture plate ou à couleurs
de sommets sont exclus du décor visible, quelle que soit leur qualité par ailleurs : ils ramènent le jeu à la v1 abandonnée.

**Règle 5 — Personnages et décor montent ensemble.** Interdit de texturer un décor en PBR 1024 à côté de villageois en primitives
non texturées. Tout gain net sur le décor appelle une passe équivalente sur les personnages.

**Règle 6 — Budget.** Textures en WebP 1024 maximum, dans les dossiers `_web` ; statiques fusionnés (`mergeStatics`) ; ≈10 lumières
ponctuelles par niveau. Les PNG 2048 d'origine ne partent jamais dans le navigateur.

**Règle 7 — Licence tracée.** CC0 ou équivalent, licence copiée dans `assets_back/_licences/`.

### Ce que ça donne pour les packs déjà téléchargés

| Pack | Verdict | Usage |
|---|---|---|
| Medieval Village MegaKit (PBR) | **Admis, en bibliothèque** | Props (charrette, caisses, barrières, souches de cheminée, vigne vierge, bordures, escaliers, volets) et textures PBR de référence. **Pas** ses murs ni ses toits : architecture germanique à colombages, incompatible avec le flamand. |
| Fantasy Props MegaKit (PBR) | **Admis, sans réserve** | Même famille que le Medieval Village MegaKit, PBR vérifié (BaseColor / Normal / ORM). Étals et caisses pour le marché, bannières pour la place, mobilier pour l'estaminet et la maison, forge, cage et clés. C'est l'acquisition qui rapporte le plus, surtout sur les intérieurs qui sont aujourd'hui les scènes les plus nues. |
| Matériaux Poly Haven (PBR) | **Admis** | 12 matériaux retenus sur 15. Remplacent progressivement les textures procédurales 256-512 px. Chaque matériau a sa taille de tuile réelle dans `materiaux.json` : la règle 3 s'applique à eux comme au reste. Écartés : `marble_rock_02` et `wool_boucle`, hors sujet. |
| Kenney particle pack | **Admis** | Sprites de particules : feu, fumée, poussière, étincelles, impacts. Aucun conflit de DA. |
| Kenney impact sounds | **Admis** | 130 sons d'impact et de pas. Aucun conflit de DA. |
| Universal Base Characters + Modular Outfits (PBR) | **En réserve** | Cohérents avec la DA et au bon niveau, mais remplacer Camille jetterait tout le système d'anatomie articulée et ses animations. À rouvrir seulement si on décide une passe personnages complète (règle 5). |
| Kenney nature-kit | **Exclu du décor visible** | Couleurs de sommets, arbres de 1,2 m, style cartoon : c'est la v1. Utilisable uniquement en blockout / repérage de volumes. |
| Kenney retro-fantasy-kit | **Exclu** | Textures 64 px, même raison. |
| Kenney retro-textures-fantasy | **Exclu** | Pixel art 64 × 128. |
| Modular Dungeon Pack | **En attente** | Aucun format web, à convertir avant même de pouvoir juger. |
| Free 3D Modular Prototyping | **Blockout seulement** | Formes grises de prototypage, jamais dans une scène livrée. |

## 3. Contexte technique du projet (CONTEXT.md)

# CONTEXT — The Legend of Camille

Fichier de contexte pour reprendre le projet (humain ou IA). Mis à jour à chaque livraison.

## Vision
Mini-jeu d'aventure 3D façon Zelda, clavier seul, dans la citadelle de Vauban à Lille. Héroïne : **Camille** (neutre). Ton : bestiaire local décalé (géants Lydéric/Phinaert, moules mutantes, fantômes de la garnison, corbeaux), décor de plus en plus réaliste par itérations. Site statique (Three.js vendored), joué depuis un `python3 -m http.server` en local ou sur le VPS d'Eugène.

## Architecture
- `engine.js` — moteur commun : rendu (PBR, ACES, ombres, post-traitement bloom/bokeh/vignette), qualité adaptative (`Q`), textures procédurales (`T`), primitives (`mesh/boxG/sphG/capG`), monde générique (`world`, `addCap/addBox/addPlatform/addRamp/addHelix`, `getH`, `blocked`, `tryMove`), personnages (Camille articulée, géants, corbeau, moule, fantôme, rat, chauve-souris, coffres, grilles, torches…), combat, saut, arc, interactions (Entrée), HUD, menus clavier, sauvegarde `localStorage` (`tloc_save_v2`), changement de niveau (`goToLevel` → autre page HTML), musique générée, particules.
- `game.js` — niveau **citadelle** (pentagone, bastions, fossés/eau, galeries à arcades + chemin de ronde, donjon creux avec colimaçon, enclos du boss, poterne, maison (extérieur), village flamand, route, moulin, champs, montagnes).
- `cave.js` — niveau **galerie** (plan en caractères `MAP`, voûtes de briques, fosses, levier/grille, Rat-Roi, coffre du réceptacle de cœur).
- `tavern.js` — **estaminet** du village (même patron que house.js : groupe `room` × `SC`, patrons attablés, Gustave soigne).
- `house.js` — **intérieur de la maison** (groupe `room` agrandi par `SC`, lit = menu dormir/sauvegarder, mezzanine).
- `index.html` / `cave.html` / `house.html` / `tavern.html` — pages identiques (HUD, overlay menus, écran de chargement) avec un `?v=N` sur les scripts (cache-busting ; `python3 bump.py N` incrémente partout).
- `lib/` — three.module.js 0.160 + addons (postprocessing, BufferGeometryUtils, RoundedBoxGeometry).
- Architecture (dans `engine.js`, section « helpers d'architecture ») : `rboxG` (boîte arrondie), `mouldingProfile/mouldingRun/corniceAround` (moulures doucine/ovolo/cavet/filet/tore extrudées), `pilaster`, `archWindow`, `dormer` (lucarne), `oriel` (bow-window), `balcony` (balustres tournés). Utilisés par `makeFlemishHouse`, le beffroi, la chapelle, les casernes, le donjon, la poterne et la maison de Camille.

## Système de cinématiques (engine.js, section « Histoire »)
- `cutscene(steps, onEnd)` : bandes noires, HUD masqué, commandes bloquées (`cut.active`), ennemis figés. Étapes : `{cam,at,cam2?,at2?,dur,text?,who?}` (caméra interpolée), `{say,who,fn?}` (réplique, Entrée pour avancer), `{walk:[x,z],speed}` (Camille marche), `{actor,to,speed}` (PNJ marche, `actorWalk`), `{pose:'lie'|'kneel'|'sit'|'cheer'|null,pos,yaw}`, `{fade:0|1}`, `{shake}`, `{title,sub}` (carton-titre), `{fn}`, `skippable:false`. Entrée saute une étape chronométrée ; `TLOC.cutAdvance(true)` force ; `G.cutSpeed` accélère (tests).
- `dialogue(lines, onEnd)` = suite de `say`. Journal : `openJournal/closeJournal`, `level.objective()` pour la quête principale.
- Entrée dans un lieu : `level.entry()` renvoie `{title,sub,cam,at,cam2,at2,dur,text}` ; joué par `startGame` si `sessionStorage.tloc_arrive` a été posé par `goToLevel`.
- Coucher (`house.js` `sleepScene`) : Camille marche jusqu'au lit, pose `lie` sur le matelas, fondu, lampes baissées, réveil.
- Personnages : `makePrince`, `makeCat`, `makeCage` ; `followActor(a, dt, target, dist, speed)`.

## Conventions
- Coordonnées : x/z au sol, y vers le haut. Citadelle : `R=60` rayon aux sommets, `APO≈48.5`, sommets à −90°+k·72°, gate au sud (z≈APO). Bastion i : `V,u,v,S1,S2,F1,F2,C,poly`.
- Collisions : capsules `{ax,az,bx,bz,r,top?,bottom?}` (bloquent si `bottom<y<top`), boîtes `{x0,x1,z0,z1,top}` (on marche dessus si assez haut), plateformes (`seg`, `ramp`, `helix`, rectangle). `getH(x,z,y)` renvoie la plus haute surface ≤ y+0.6.
- Clavier physique (`e.code`) : KeyW=Z, KeyA=Q sur AZERTY. Une pression = une action (`pressedOnce`) pour roulade, saut, C, F.
- Commandes (v16) : clic dans le canvas = pointer lock (`G.mouseLook`), la souris pilote `G.camYaw`/`G.camPitch` ; clic gauche ou F = épée, ou flèche si `G.bowOut` (C bascule l'arc en main) ; clic droit ou Maj = roulade ; Espace ou X = saut ; ←→ / A E = caméra au clavier ; Q D = pas de côté ; Échap = pause (rend la souris — le navigateur réserve Échap, impossible d'en faire le saut). À la souris, l'épée et l'arc visent dans la direction du regard (`aimYaw`).
- Échelle (v16) : le village est construit en coordonnées locales (demi-largeur 16) dans un groupe `town` agrandi ×`TOWN.s`=1.5 posé en `TOWN.x/z` (46,118) ; dans `buildTown`, `scene/addCap/addBox/addInteract/placeHouse` sont redéfinis localement pour convertir en monde ; les villageois restent dans la vraie scène (coordonnées monde via `W2`). Monde agrandi : limite r<160, montagnes à partir de r=164, sapins r>168. Casernes 22×8,5×6,4. Route 7 m.
- Niveau = objet `{name, getH, blocked, zoneName, build, populate, update, animate, minimap, counts, onKill, onLoad, start, arriveMessage, titleCamera, onFall}` passé à `bootLevel`.
- Sauvegarde : `{v:2, level, pos, yaw, camYaw, hp, maxHp, time, kills, flags{tous les champs de state sauf running/over/won/paused/time/kills/saveT}, levels{citadel|cave|house|tavern:{enemies,pickups}}}`. Une sauvegarde d'avant v14 (pas de `sword`) reçoit `sword/introSeen/metLyderic = true`. `sessionStorage.tloc_auto = new|resume` pour enchaîner après navigation.
- Debug console : `TLOC` (player, enemies, state, getH, blocked, saveGame, G.freeCam={pos,at}, G.snapCam).

## Histoire (v14)
Situation initiale (cinématique) : le prince **Eugène** salue Camille au pied du pont ; **Phinaert** surgit de la Porte Royale, assomme Camille, enlève le prince et referme la herse. Lydéric accourt. Situation finale (cinématique) : Camille ramène le prince à Lydéric près du pont, feu d'artifice, écran FIN.

## Progression du jeu
1. Parler à **Lydéric** (Entrée) : il donne l'épée (`state.sword`, on ne peut pas frapper avant) et le bouclier. 2. Arc dans le coffre du bastion de Turenne. 3. **10 monstres** vaincus → cinématique : la grille de l'enclos se lève, Phinaert apparaît. 4. Phinaert vaincu (cinématique) → colimaçon du donjon → coffre de la clé. 5. Poterne (est de la place) → galerie (`cave.html`, carton-titre) : levier, fosses, **Rat-Roi lâche la clé de la cage** (`state.cageKey`), cage du prince (tuile `E`) → cinématique de libération (`state.princeFreed`), le prince suit Camille (`followActor`). 6. Remonter, rejoindre Lydéric (< 9 m) → `finalScene()` → `endGame(true)`.
Quêtes secondaires (journal **J**, `QUESTS` dans engine.js, `state.q_*` 0/1/2/3, `setQuest`) : le chat de Cornélie (Pralin sur la caisse isolée près de la caserne nord-est, il faut sauter), le champ d'Émile (4 corbeaux zone `champ` près du moulin, à l'ouest de la maison), la ronde de Désiré (5 fantômes zone `remparts`). Chaque récompense = +1 cœur. Gustave (estaminet) soigne. Villageois : dialogues `dialogue([{who,text,fn}])` dépendant de l'état.
Maison de Camille (ouest du pont) : dormir/sauvegarder. Chapelle + cimetière au nord du village (`buildTown`). Trois villageois patrouillent (routes de points dans `buildTown`). Oiseaux dans le ciel, pépiements, bruits de pas. Village (au sud-est, centre (46,118), agrandi ×1.5) : balade, villageois qui parlent. Limite du monde : r<160, montagnes à partir de r=164.

## Décisions / historique
- v1 low-poly toon → v3 réaliste PBR (demande d'Eugène : « plus de réalisme », Camille « moins genrée »).
- Fossés inaccessibles à pied : voulu, ils se nettoient à l'arc.
- Seuil du boss ramené de « tous les monstres » à 10 (un monstre était introuvable).
- Galerie/maison sur des pages séparées pour libérer la mémoire (demande d'Eugène).
- Caméra : parcourt le segment tête→position idéale, contourne les murs en testant des angles voisins, plafond par niveau (`G.camMaxY`).
- v13 : bâtiments « moins carrés » (demande d'Eugène) — angles arrondis, soubassements, bandeaux, corniches, pilastres, fenêtres en arc, lucarnes, oriels, balcons, dôme en bulbe du beffroi, abside/contreforts/rosace de la chapelle, mâchicoulis du donjon.
- v14 : refonte de l'histoire (demande d'Eugène : sauver le prince Eugène, parler aux gens, quêtes secondaires, situation initiale/finale, effets « vidéo »). Bug corrigé : une grille ouverte (`cap.r = 0`) bloquait encore le joueur (`blocked` ignore maintenant les capsules de rayon 0). Moulin et champs déplacés dans la plaine (ils étaient dans les fossés).
- v17 : garde-corps hélicoïdal dans le donjon + anneau de collision invisible (rayon R1+0.32, 28 segments) autour du colimaçon, ouvert au sol et en haut du côté de la porte (`bottom`/`top` des capsules) : on ne peut plus tomber de l'escalier.
- v18 : éclairage du donjon (6 torches à 7, lumière de jour par le puits). v19 : terrasse du donjon en anneau plein côté collisions (`levelH`) + palier ; caméra qui se replace derrière Camille en marchant (demi-tour compris), base de déplacement figée pendant l'appui (`p.moveBasis`), souris prioritaire 0,7 s (`G.mouseT`).
- v20/v21 : anatomie détaillée (engine.js, section « Anatomie ») : `eyes()` (globe, iris, pupille, reflet, paupières, cils, sourcils), `makeHead({skin,hair,style:'spiky'|'short'|'long'|'bun'|'bonnet'|'bald',beard,moustache,iris,female,bonnet})`, `makeArm` (deltoïde, biceps, coude, avant-bras, poignet, paume, 4 doigts × 2 phalanges, pouce, `cuff`), `makeLeg` (hanche, cuisse, rotule, mollet, cheville, botte semelle/talon/lacets), `makeTorso({top,bottom,belt,female,width})`, `latheG(points)`. Utilisés par Camille, villageois (`makeVillager`), prince, clients de l'estaminet ; visages des géants détaillés. Retour d'Eugène v20 : « la tête fait peur » → v21 front dégagé, cheveux petits, bouche fermée, nez fin, pas de pommettes. Galeries : indice pour le levier (message près de la grille, point jaune sur la carte, objectif).
- Perf : `mergeStatics()` fusionne les meshes statiques par matériau au démarrage (marquer `userData.dynamic = true` sur tout ce qui bouge/s'anime, sinon il sera fusionné et figé) ; pixelRatio ≤1.5, ombres 2048 suivant le joueur, qualité auto (touches 1-4), lumières ponctuelles limitées (≈10 max par niveau).


## Assets externes (v22)
- `assets_back/` — banque de modèles et de matériaux rangée par typologie puis par pack (voir son `README.md`).
  Ajouts du 18/09 : **Fantasy Props MegaKit** (94 props PBR : étals `Stall_Empty` et `Stall_Cart_Empty`,
  bannières, mobilier d'estaminet, forge, cage, clés, torches — la meilleure prise du lot, surtout pour
  les intérieurs) et **15 matériaux Poly Haven** normalisés en WebP 1024 dans `03_textures/polyhaven/`
  avec leur taille de tuile réelle dans `materiaux.json`.
  Les décors utilisables : **Medieval Village MegaKit** (176 modules PBR, grille de 2 m,
  murs 2,00 × 3,12 m — c'est celui qui colle à la DA), Kenney nature-kit (329 .glb low-poly à
  couleurs de sommets, **hors DA**, trees ≈ 1,2 m donc à agrandir ×4-5), Kenney retro-fantasy
  (105 .glb, hors DA), 130 sons d'impact .ogg et 192 sprites de particules (eux sans conflit de DA).
- `lib/addons/loaders/GLTFLoader.js` — loader three 0.160, ajouté pour ces modèles.
- `assets.js` — module autonome de chargement : `preload(ids)`, `spawn(id, {x,y,z,rotY,scale,height})`,
  `footprint(obj)` (boîte au format des collisions de engine.js), `mergeStatics(root)`.
  Identifiant = `pack:Nom_Du_Modele` ; les gabarits sont recentrés en X/Z avec la base sur y = 0,
  et les matériaux sont dédupliqués pour que la fusion des statiques fonctionne.
- `assets-browser.html` — catalogue des 644 modèles (vignettes, recherche, dimensions réelles).
- `demo-decors.html` — démo d'assemblage : 3 maisons flamandes en modules MegaKit, mêmes réglages
  de lumière que engine.js. Touches C (collisions), W (fil de fer), M (fusion des statiques).
  Mesuré : 505 draw calls avant fusion, 37 après, à triangles constants (116 881).
- Textures : toujours charger les variantes `_web` (WebP 1024). Les PNG 2048 d'origine
  représentent 185 Mo et ne doivent jamais partir dans le navigateur.
- **Arbitrage rendu (v22, tranché)** : le MegaKit sert de bibliothèque de **props et de textures**, pas de kit
  de construction — son architecture est germanique à colombages et détruirait l'identité flamande du village,
  qui elle reste procédurale. Les kits Kenney low-poly sont exclus du décor visible. Règles complètes dans
  BRIEF-DESIGN.md, partie 2 « Politique d'assets ».


## Échelle des matériaux (v22)
- Les textures sont mappées en **mètres réels**, pas à l'oeil. `BRICK_TILE = {w:1.76, h:0.60}` dans engine.js :
  la tuile de `T.brick` contient 8 briques × 8 assises, soit une brique de 22 cm et une assise de 7,5 cm.
  Utiliser `brickScaled(largeur, hauteur, extra)` partout — jamais `pbrRepeat(T.brick, ...)` à la main.
  `wallBox` applique la même règle automatiquement quand le jeu de textures est `T.brick`.
- Pavés du village : `COBBLE_TILE = 0.96` (8 × 8 pavés de 12 cm) dans `buildTown`.
- Avant v22 la brique était à 27 cm et le pavé à 30 cm : c'était le principal facteur de rendu « pas fini ».
- Reste à faire de ce côté : variation à grande échelle (salissures, teintes par maison, mousse) — à cette
  échelle de brique, les grandes surfaces lisent un peu plates à distance.


## Matériaux photographiques et densité (v23)
- `engine.js` expose `PH` (catalogue Poly Haven : tuile réelle, cartes, teinte de repli) et
  `phMat(slug, uSize, vSize, extra)`. **uSize/vSize = la taille réelle en mètres que couvre
  l'intervalle UV 0..1 de la géométrie** : `(largeur, hauteur)` pour une BoxGeometry,
  `(1, 1)` pour une ExtrudeGeometry (UV déjà en unités monde), `(100, 100)` pour `flatMesh`.
  `wallBox` accepte un identifiant Poly Haven en 9e argument.
- Tuiles calibrées en mesurant la période verticale de la texture × 7,5 cm d'assise :
  church_bricks_03 = 2,75 m, stacked_brick_wall = 1,75 m, red_bricks_02 = 2,05 m.
- Appliqué : remparts et courtines + flancs des bastions en `church_bricks_03`, façades du
  village en `stacked_brick_wall` (la teinte par maison est éclaircie à 55 % vers le blanc,
  elle multiplie une photo et non un aplat), plaine en `grass_ground` teinté `0x9cc267`,
  place d'Armes en `rocks_ground_08`.
- **Bug corrigé dans `mergeStatics`** : la fusion supprimait l'attribut `color` en laissant
  `vertexColors = true`, ce qui rendait noir tout modèle à couleurs de sommets (c'est ce qui
  arrivait aux props du Fantasy Props MegaKit). L'attribut est maintenant conservé quand le
  matériau l'utilise, et rempli en blanc pour les géométries qui n'en ont pas.
- Marché du village : étals, cageots, tonneaux et bannières du Fantasy Props MegaKit, avec
  repli sur les étals procéduraux si `assets_back/` est absent.

## Relief et densité végétale (v23)
- `buildNature()` (appelée AVANT `buildVegetation`, l'herbe se pose sur le relief) crée :
  58 buttes, 3 400 touffes d'herbe haute en bouquets, 1 400 buissons en quads croisés texturés.
- **Buttes** : dômes analytiques `h(t) = H·(1−t²)²` avec `t = d/R`. Le même profil sert au
  maillage (`moundGeometry`) et à la hauteur de collision (`moundH`, branchée dans `levelH`) :
  le sol visible et le sol marchable ne peuvent pas diverger. Vérifié : centre 3,45 m,
  mi-rayon 1,94 m, bord 0,01 m — exactement la courbe. `TLOC.MOUNDS` pour inspecter.
- Herbe 4 200 → 11 000 brins, roseaux 900 → 2 600, sapins 320 → 760 (couronne inchangée,
  r = 168..216 : au-delà, l'index du maillage de montagne sort de la table et les arbres flottent).
- Champs de blé : 4 parcelles près du moulin, épis instanciés avec `wheatBladeTexture()`
  (texture dorée générée dans game.js — teinter le brin d'herbe vert donnait de l'olive),
  teinte variable par instance via `setColorAt`.
- Tout est branché sur les paliers de qualité `Q.hooks` (`perf.tufts`, `perf.bushes`, `perf.wheat`).
- Mesure après fusion : 115 meshes statiques pour 4 192 fusionnés.


## Profil des douves (v23.1)
- Le bord d'herbe tombait droit dans l'eau : la paroi verticale de la berge se trouve exactement
  sous la silhouette de la pelouse, donc elle n'est jamais visible depuis la rive où l'on se tient.
  Profil corrigé : l'herbe s'arrête à `MOAT_OUT + SHORE` (SHORE = 2,2 m) côté extérieur et à
  `MOAT_IN − SHORE` côté intérieur, deux banquettes de terre (`brown_mud_03`) comblent à y = −0,12,
  un fond de douve boueux est posé à y = −1,62 et le plan d'eau est resserré de 1,3 m sur chaque rive.
- Les berges extrudées passent en `THREE.DoubleSide` : les normales de l'anneau pointent vers
  l'extérieur du fossé, en face simple la berge côté joueur était invisible.
- Le fossé sec utilise la même herbe photographique que la plaine, teinte `0x86a858`, pour supprimer
  la bande vert vif qui tranchait le long des remparts.
- **Règle de placement des buttes** : le glacis reste dégagé. On teste le BORD de la butte, pas son
  centre : `sdPent(x, z) − R > MOAT_OUT + 12`, et de même 30 m autour du village. Sans ça une grande
  ondulation venait se poser entre le joueur et les douves et masquait la citadelle.
- La boucle des roseaux était restée à 900 alors que la capacité était montée : corrigée, 1 800.


## Sols et dégagement (v23.2)
- **Citadelle** : l'intérieur est en sable tassé (`rocks_ground_08` teinté `0xeadcbc`) jusqu'au pied
  des remparts — plus d'herbe autour des casernes — et la place d'Armes est pavée, comme l'allée
  qui monte de la Porte Royale.
- **Village** : un sol de terre battue couvre tout le bourg (disque de 27 unités locales au bord
  irrégulier, sinon il se lit comme un plateau posé sur la pelouse). Les pavés se posent par-dessus.
- **Pavés** : `cobbleTextures()` refaite — report des galets sur les quatre bords (elle ne se
  raccordait qu'horizontalement, ce qui donnait une couture tous les mètres, très visible depuis
  qu'elle couvre la place d'Armes), positions et rotations jitterées, variation lente par-dessus.
  Une seule constante `COBBLE_M = 0.96` (8 × 8 pavés de 12 cm) sert à la citadelle et au village.
- **Échelle des pavés du village corrigée** : le groupe `town` est agrandi ×S, la tuile était
  exprimée en mètres monde sans diviser par S — les pavés sortaient à 18 cm au lieu de 12.
  `COBBLE_TILE = COBBLE_M / S`.
- **Dégagement du bourg** : une seule constante `RUE = 4.4` pilote la demi-largeur de chaussée
  (trottoirs, pavage, recul des deux rangées de maisons). Les rangées est-ouest sont écartées de
  2 unités, la place passe de 15 à 18. Mesuré au pas de 50 cm sur les collisions :
  surface libre sur la place 63 % → 79 %, coeur du bourg 47 % → 58 %, plus large traversée
  est-ouest 35,5 m → 45,5 m.
- La charrette procédurale de la rue ouest avait une capsule ronde de 2,1 m pour un véhicule de
  1,4 de large, et son brancard traversait la chaussée : garée le long du trottoir, brancard dans
  l'axe, capsule allongée de rayon 0,7. Les étals sont passés de 1,2 à 0,85 m de rayon et bordent
  la place au nord et au sud, hors des deux couloirs qui longent la fontaine.


## Estaminet (v24)
- `tavern.js` importe `assets.js` et précharge 16 props du Fantasy Props MegaKit, avec le même
  garde-fou que le village : si `assets_back/` manque, `PROPS_OK` reste faux, chaque `prop()`
  renvoie null et le mobilier procédural d'origine reprend la main (les appels sont écrits
  `if (!prop(...)) { ancien mobilier }`).
- Le groupe `room` est agrandi ×SC : `prop()` compense par `scale: 1/SC` pour que les modèles
  gardent leurs dimensions réelles, comme `town` avec ×S.
- Remplacés par des modèles : tabourets du comptoir et des tables, chopes, bougeoirs
  (`CandleStick_Triple`, la flamme reste une sphère émissive au-dessus), assiettes, tonneaux
  du comptoir (`Barrel_Holder`), lustre (`Chandelier`).
- Ajoutés : chaudron et marmite à l'âtre, bûches, étagère à bouteilles derrière le zinc,
  service sur le comptoir, coffre, tonneaux et besace en fond de salle, deux appliques murales
  (`Lantern_Wall`) avec leur point light — soit 3 lumières ponctuelles dans le niveau.
- Matériaux : plancher en `wood_planks`, plateaux de tables en `wood_cabinet_worn_long`,
  âtre et fond d'âtre en `red_bricks_02`.
- **Le fond d'âtre était une boîte noire en `MeshBasicMaterial`** : elle avalait tout ce qu'on
  posait dans la cheminée. Remplacée par de la pierre suiée, et la flamme, les bûches et le
  chaudron ont été ramenés dans la gueule de l'âtre, devant ce fond.
- Reste à faire côté intérieurs : `house.js` (maison de Camille) et `cave.js` (galeries) n'ont
  pas encore reçu le même traitement ; le comptoir de l'estaminet garde ses verres procéduraux.


## Personnages riggés (v25 — banc d'essai)
- Les packs `02_personnages` sont **riggés sur le squelette du mannequin Unreal Engine 5** :
  65 os, `root / pelvis / spine_01..03 / neck_01 / Head / clavicle,upperarm,lowerarm,hand _l|_r /
  thigh,calf,foot,ball _l|_r`. Un seul clip livré (`Jog_Fwd_Loop` dans `Female_Peasant_Body`).
- `lib/addons/utils/SkeletonUtils.js` ajouté. **`Object3D.clone()` casse un SkinnedMesh** : le clone
  continue de pointer sur le squelette de l'original, donc tous les exemplaires bougent ensemble.
  `assets.js` détecte les modèles skinnés et passe par `SkeletonUtils.clone`.
- `assets.js` ne recentre plus les modèles skinnés : leur origine est déjà aux pieds, et déplacer
  la racine décalerait le maillage sans décaler les os.
- `spawn()` expose `userData.os` (os par nom) et `userData.repos` (quaternion de repos par os).
  **L'animation doit se composer SUR la pose de repos** (`quaternion.copy(repos).multiply(delta)`) :
  l'écraser fait replier les membres sur les axes locaux et le personnage part en morceaux.
- Axes, mesurés sur le banc : depuis la pose en croix, **Z** fait descendre le bras le long du corps
  (≈ 1,26 rad), **X** donne le balancement d'avant en arrière des bras et la foulée des jambes.
  Z sur une jambe ne fait que l'écarter sur le côté.
- `rebind(source, cible)` attache une coiffure ou des sourcils skinnés au squelette d'un personnage,
  en les reparentant dans le même espace local — sinon leur propre transformation s'ajoute au
  skinning et la pièce part de travers.
- `greffeTete(base, cible)` : le Readme des tenues dit que seule la TÊTE du corps de base est
  nécessaire (le corps entier provoque des interpénétrations). Comme le maillage est skinné, chaque
  sommet porte le poids de l'os qui le pilote : on garde les triangles dont les trois sommets
  dépendent de `Head` ou `neck_01`, on jette le reste. Les yeux et les sourcils, entièrement sur la
  tête, sont gardés tels quels.
- `demo-personnages.html` : trois personnages (paysanne, paysan, rôdeuse) au repos, en marche et en
  course, sous l'éclairage du jeu. **24 500 triangles par personnage** — à surveiller si le village
  en compte beaucoup.
- **Manque pour aller plus loin : des animations.** Un seul clip est livré avec les packs.

## Pistes / à faire
- Vérifier sur machine réelle : saut, combat, fluidité (les tests headless tournent à ~1 image/s ; le test e2e `t17` demande ≥4 s d'attente autour des interactions).
- Matériaux manquants (2e temps) : pavés de rue, tuiles et ardoises de toit, enduit/plâtre, écorce.
- Idées : plus de quêtes (Baptiste, Fernande, Aldegonde), doublage/musique par scène, cinématique à l'ouverture du coffre de la clé.
- Suite possible du travail « volume » : porte Royale (tours rondes moulurées), tourelles des bastions, moulin, intérieurs (maison, estaminet).
- Intérieur possible pour l'estaminet ; PNJ qui se déplacent ; quêtes secondaires au village.
- Sons : tout est synthétisé (WebAudio), pas de fichiers audio.
