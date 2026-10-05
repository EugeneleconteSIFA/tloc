# L'acte I — découpage en étapes jouables (version 1, 2 octobre)

L'acte I de `STORY.md` (« La Grande Cloche »), qui fait foi, découpé en étapes qu'on peut
jouer, vérifier et publier une à une. Le détail vient de `SCENARIO.md` § 9 ; les répliques,
de `DIALOGUES-ACTE1.md` (dont les noms d'étape `grille`, `canne`, `cle`, `lanterne`… sont
repris tels quels). Le prologue est fait (`DECOUPAGE-PROLOGUE.md`) : on part de la fin de
l'enlèvement, Camille relevée sur le pont, Lydéric d'osier, la grande grille tombée.

## Le fil, en une phrase par étape

| # | étape (`state.acte1`) | ce qui bloque | ce que Camille gagne | où (position du jeu) | qui |
|---|---|---|---|---|---|
| 1 | `grille` — la ville inquiète | la grande grille est tombée et ne se relève plus | le premier fil : la crypte de la chapelle, puis la lanterne de Désiré | le pont de Fin (−1 ; 252), le bourg (200 ; 660) | Lydéric d'osier, Houtland, le mage, le crieur |
| 2 | `grille` — l'enquête de Désiré | personne ne sait où est Désiré | **qui** : il est passé à la chapelle ; **où** : le beffroi, la nuit ; **comment** : le petit escalier, dont Émile a la clé | la chapelle Saint-Roch (210 ; 691), le beffroi (194 ; 681), l'estaminet (218 ; 662) | Cornélie, le gardien de la chapelle, l'allumeur, Gustave |
| 3 | `grille` → `canne` | la clé de l'escalier est au fond de l'eau | **les vers**, puis **la canne à pêche** | le champ du nord d'Émile, le quai (au bord de l'eau, devant la maison de Camille : 166 ; 607) | Émile, le vieux pêcheur |
| 4 | `canne` → `cle` | — | **la clé de l'escalier du beffroi**, repêchée | le canal de la Tortue, derrière le moulin (436 ; 12) | Émile (où lancer) |
| 5 | `cle` — la nuit | Désiré ne se montre qu'après minuit | **la nuit** : on dort chez soi « jusqu'au soir » | la maison de Camille (173 ; 611) | Émile (« dors un peu chez toi ») |
| 6 | `cle` → `lanterne` | l'énigme du guetteur | **la lanterne** | le sommet du beffroi, la nuit | Désiré |
| 7 | `lanterne` → `souterrains` | la crypte est noire | le passage | la crypte, derrière l'autel de la chapelle | le gardien de la chapelle |
| 8 | `souterrains` → `arc` → `citadelle` | une grille au levier trop haut ; la porte secrète fermée | **l'arc** (puits aux chauves-souris), **la clé du Rat-Roi** | les galeries de Vauban (cave.html), sortie par la poterne (121 ; 139) | le fantôme de Bastien |
| 9 | `citadelle` → `bombes` → `donjon` | trois cadenas sur la grille du donjon | **les bombes**, puis les **trois clés** | la place d'Armes, l'armurerie (bastion du Roi, −190 ; −12), les fossés, les remparts (la nuit), la pointe de Turenne | les trois soldats, l'armurier ; la Moule-Reine, le Capitaine sans tête, la Grande Corbelle |
| 10 | `donjon` → `temple` | Phinaert | la fin de l'acte : la porte du Temple, le premier vers de la prophétie | le donjon (0 ; −18), puis l'île du temps (temple.html) | Phinaert, Eugène, le vieux mage |

Durée visée (`SCENARIO.md`, « Le chronomètre ») : 16 min pour 1 à 7, 14 pour 8, 20 pour 9,
8 pour 10.

## Les étapes, une à une

### 1. La ville inquiète (`grille`)

- **La grande grille reste baissée.** Le prologue la relevait dans le noir parce que la
  partie entrait encore dans la citadelle par la Porte Royale ; l'acte I la laisse tomber
  pour de bon (`DECOUPAGE-PROLOGUE.md`, « à trancher » n° 1). On n'entre plus dans la place
  qu'à la fin de l'étape 8, par la poterne.
- **Lydéric d'osier** parle encore, sans tourner la tête : la crypte de la chapelle d'abord ;
  la lanterne de Désiré une fois qu'on a essayé la crypte ; « Tu as prêté serment ce matin… ».
- **La ville se vide** : la foule est rentrée (fait au prologue), Houtland reste devant la
  salle de la garde (« Dix hommes poussent encore »), le mage aussi (« Phinaert. Je pensais ne
  plus jamais entendre ce nom » ; il envoie à Cornélie).
- **Le crieur public**, sur la place du bourg : la dernière nouvelle, et ce qu'on attend de la
  garde, à chaque étape.
- **Le journal (J)** suit l'étape ; le point d'or de la carte montre le prochain témoin connu.
- Les anciennes répliques (les fantômes des remparts, les corbeaux…) cèdent la place à
  celles de `DIALOGUES-ACTE1.md` dès que l'acte I a commencé. Une ancienne sauvegarde
  (sans `state.prologueFait`) garde l'ancienne histoire jusqu'au bout.

**Fini quand** : de retour du pont, on sait qu'il faut aller à la chapelle, et la crypte
répond « Trop sombre. Il me faudrait une lumière. »

### 2. L'enquête de Désiré (trois témoins, `SCENARIO.md` § 7)

| témoin | où | ce qu'il donne | le fil vers |
|---|---|---|---|
| Cornélie | la place du bourg | « vers la chapelle, sa lanterne sous le bras » | le gardien |
| le gardien de la chapelle | devant le portail | « voir la ville sans être vu » | Gustave |
| l'allumeur de lanternes | les rues du bourg | **où** et **quand** : le beffroi, seulement la nuit | — |
| Gustave | l'estaminet | **comment** : le petit escalier derrière le beffroi ; **Émile en a la clé** | Émile |

Le petit escalier : une porte basse au pied du beffroi, côté jardin, fermée (« Fermé à
clé »). Chaque indice en gras s'écrit au journal, onglet « Indices ».

### 3. La canne

Émile : la clé lui a glissé de la poche en courant à la fête, **dans le canal de la Tortue,
derrière le moulin** (le moulin est un moulin à vent : la réplique de `DIALOGUES-ACTE1.md`
disait « sous la roue », corrigée). Le vieux pêcheur, sur le quai devant la maison de
Camille, prête sa canne contre des vers : on les trouve dans la terre retournée du champ
d'Émile (là où l'on a fauché au prologue), en frappant le sol à l'épée.

### 4. La clé repêchée

La pêche, le même geste partout (`SCENARIO.md`, « La canne à pêche ») : lancer (Entrée face à
l'eau), attendre que le bouchon plonge, ramener sans tirer trop fort (relâcher quand la
ligne se tend). Au bon endroit, au lieu d'un poisson : la clé de l'escalier.

### 5. La nuit

On dort dans son lit, chez Camille, « jusqu'au soir ». La nuit : ciel et soleil de nuit, la
lune, les fenêtres et quelques lanternes du bourg qui s'allument (une lueur peinte, pas des
centaines de vraies lumières : règle 8), la lumière de Désiré tout en haut du beffroi. On
redort « jusqu'au matin ».

### 6. Désiré et la lanterne

De nuit, la porte basse s'ouvre avec la clé ; le sommet du beffroi (qui existe : la chambre
des cloches, la carte du guetteur). Désiré, l'énigme du guetteur (`atlas.js`, devinettes de
la ville), la lanterne. Il ouvre *La ronde de Désiré* (quête secondaire).

### 7. La crypte

Le gardien : « L'escalier est derrière l'autel. » Dans la chapelle, la dalle derrière l'autel
s'ouvre sur un escalier ; avec la lanterne, on descend : les galeries.

**Codé le 5 octobre (B2)** : la dalle (`chapelle.js`) propose « descendre dans la crypte » quand on
a la lanterne ; un mot, puis `passerActe1('souterrains')` et les galeries, au pied de l'escalier de
la crypte (case 17 ; 7 du plan de `cave.js`, dans la contre-mine). L'escalier se remonte : on
reparaît dans la chapelle à côté de la dalle, sans le plan d'entrée par le portail.

### 8. Les souterrains

Les galeries de Vauban existent (`cave.html` : rats, chauves-souris, fosses, levier, grille,
Rat-Roi). Elles changent de rôle : Eugène n'y est plus (il est au donjon) ; **le fantôme de
Bastien** près de la citerne ; **l'arc** au fond du puits aux chauves-souris (le coffre
actuel) ; la grille au levier qu'on touche **à l'arc** ; **le Rat-Roi** avale la clé de la
porte secrète (« une flèche dans les tonneaux pendus ») ; la sortie par la poterne.

**Codé le 5 octobre (B2)**, tout dans `cave.js`, et seulement pour une partie de l'acte I (la
cave lit `prologueFait` dans la sauvegarde avant de bâtir : une ancienne partie garde la vanne, la
cage et Eugène) :
- **le chemin** : l'escalier de la crypte (contre-mine) → **la citerne** et **Bastien** (fantôme
  translucide ; la première fois, il interpelle : « Halte ! ») → à droite après la citerne, le
  goulet qui monte à la salle voûtée → **le puits aux chauves-souris** (le puits de lumière de la
  salle : chauves-souris pendues, deux de plus en vol) et le coffre de l'intendant : **l'arc**
  (`passerActe1('arc')`, et `bowChest` : l'arc de la place d'Armes n'est plus à prendre) →
  **le levier**, scellé à 3 m sur le refend de la grille : une flèche le fait basculer → les
  fosses → **le terrier** : trois trous au pied du mur est, le Rat-Roi y montre le museau
  (intouchable : `caged`, et sa position hors du plan pour que la visée ne le vise pas), trois
  tonneaux pendus à une même corde au-dessus → une flèche, ils tombent devant les trous, le Rat-Roi
  sort → vaincu, il recrache **la clé de la poterne** (`state.clePoterne`) → retour à l'entrée :
  **la porte de la poterne** en haut des marches (« Fermé à clé. » sans la clé) → elle s'ouvre
  sur le jour : `state.galleryOpen` (la grille de la poterne, côté place, s'ouvre aussi),
  `passerActe1('citadelle')`, et la citadelle, devant la poterne.
- **les billets d'Eugène** n° 2 (au pied du puits de l'arc) et n° 3 (juste passé la grille, avant
  le Rat-Roi) ; lus, ils s'inscrivent dans `state.billets` (`{ 2: true, 3: true }`).
- **le trône du Rat-Roi**, sous la voûte effondrée : la planche gravée (une tour, des cloches, une
  grande silhouette).
- les répliques de Bastien suivent l'étape (`souterrains`, `arc`, puis `citadelle` dès qu'on a la
  clé) ; ses indices posent `state.ind.bastien` et `state.ind.ratRoi` (le journal de Lille peut
  les reprendre : `INDICES`, `quetes.js`).
- **le levier et les tonneaux arrêtent les flèches** (`arrowBlocked`) : le point rouge de la
  visée s'y pose, ce qui dit qu'on les vise ; la fenêtre en hauteur est large, la flèche partie
  à hauteur d'épaule (sans la souris) touche aussi.

### 9. La citadelle

La place d'Armes habitée : trois soldats cachés dans une caserne (le caporal, le tambour, le
vieux soldat) donnent les trois créatures et l'armurier. L'armurerie barricadée (une flèche
dans le tonneau de poudre) → **les bombes**. Les trois créatures, dans l'ordre qu'on veut :
la Moule-Reine (les fossés, à la bombe), le Capitaine sans tête (les remparts, la nuit, à la
lanterne, avec cinq soldats), la Grande Corbelle (pointe de Turenne, trois flèches). Chacune
lâche une clé de cadenas et un billet d'Eugène.

### 10. Le donjon et le Temple

Le combat existe (Phinaert, la masse, l'onde de choc). À mi-vie, la cloche du donjon (on
coupe la corde à l'arc) ; à un quart, il s'arrête, pose la main d'Eugène sur la dalle, la
porte de lumière s'ouvre, il y entre avec Eugène. Camille le suit : l'île du temps
(`temple.html`), le mage, le premier vers de la prophétie, la porte du Midi entrouverte.

## Qui écrit quoi — les fichiers

| étape | fichiers de cette session | ce qu'il faudrait d'ailleurs |
|---|---|---|
| 1, 2, 3, 4 | `quetes.js` (l'avancement, Lydéric, le crieur, la pêche), `village.js` (les habitants du bourg, la porte basse du beffroi), la fin de `ROLES` (`pnj.js` : le crieur, l'allumeur, le gardien, le pêcheur) | Gustave est dans l'estaminet (`tavern.js`) : ses deux répliques |
| 5 | — | **la nuit** : `engine.js` (ciel, soleil, lune, brouillard) et `house.js` (« jusqu'au soir ») |
| 6 | `village.js` (Désiré au sommet) | l'énigme : `atlas.js` (réutiliser ses devinettes) |
| 7 | — | `chapelle.js` : l'escalier derrière l'autel |
| 8 | — | `cave.js` : Bastien, l'arc au puits, le Rat-Roi et la clé |
| 9, 10 | `citadelle.js` (les intérieurs, l'armurerie, les créatures), `quetes.js` | `engine.js` : trois ennemis nouveaux (Moule-Reine, Capitaine, Corbelle) ; `temple.js` (interdit à cette session) : l'arrivée de la fin de l'acte |

## Comment chaque étape est vérifiée

- **En rendu**, headless (Playwright, `window.TLOC`) : l'étape jouée de bout en bout par
  script (se rendre au témoin, Entrée, lire la réplique), une capture par moment clé,
  aucune `pageerror`.
- **Au banc** : `node bancs/charge.mjs` avant et après, sur la somme des étapes (budget 17 s),
  rien de nouveau au-delà de 300 ms sans le dire. Les habitants nouveaux naissent après le
  chargement (comme la foule du prologue) : le banc ne doit rien en payer.
- **La règle du gras** : relue réplique par réplique à chaque étape.

## Avancement

| étape | état |
|---|---|
| 1 | **codée, essayée en headless** (2 octobre au soir) — rien de publié |
| 2 | **codée, essayée en headless** (sauf Gustave, dans `tavern.js`) — rien de publié |
| 3 | codée en partie (répliques d'Émile et du pêcheur, la canne donnée) ; **les vers ne se ramassent pas encore** |
| 4 | à faire (la pêche) |
| 5 – 10 | à faire. **Eugène a autorisé le 2 octobre** : `tavern.js`, `atlas.js`, `engine.js`, `house.js`, `chapelle.js`, `cave.js` |
| 7, 8 | **codées, jouées en headless de bout en bout** (5 octobre, B2 : `bancs/acte1-souterrains.mjs` : 26 pas sur 28, les deux autres sont le défaut ci-dessous ; une capture par moment clé) : la crypte, Bastien, l'arc, le levier, le Rat-Roi, la clé, la porte de la poterne ; l'ancienne histoire intacte. **Un défaut hors B2** : avec l'arc en poche, la page de la citadelle se fige au chargement (`loadGame`, engine.js:2687, écrit dans le `bowBack` que la Camille riggée n'a pas) — `cave.js` et `chapelle.js` s'en gardent, `index.html` non |

## Bilan du 2 octobre au soir — arrêté en cours d'étape 2, à reprendre ici

**Rien n'est publié ni commité.** Les changements sont en local, dans ces fichiers :

- `quetes.js` — tout le bloc « L'ACTE I » (avant « situation finale ») : `acte1()`, les étapes
  (`state.acte1`), le carnet (`state.ind`, `INDICES`, section « Indices » du journal), les
  habitants nés après le chargement (`A1`, un par image : crieur, allumeur, gardien,
  pêcheur ; Houtland et le mage restent devant la salle de la garde), les répliques
  (`repliques()`, exposées par `PARTAGE.repliquesActe1`), Lydéric d'osier (`lydericActe1`),
  l'objectif et le point d'or (`suiteActe1`). La grille reste **baissée** après le prologue
  joué et après « Passer » ; « Passer » donne l'épée.
- `village.js` — `PARTAGE.desire` (Désiré caché tant qu'on n'a pas la lanterne) ; les
  habitants du bourg demandent d'abord leur réplique à l'acte I ; `enabled` sur leur
  interaction.
- `pnj.js` — fin de `ROLES` : `crieur`, `allumeur`, `gardien`, `pecheur`.
- `chapelle.js` — la dalle de la crypte derrière l'autel : sans lanterne, « Trop sombre »
  (`state.ind.crypteNoire`) ; avec, un message d'attente (la descente est l'étape 7).
- `engine.js` — le gras `**…**` dans les sous-titres (texte échappé d'abord) ; le crochet
  `G.level.indices` dans le journal. **Attention** : `engine.js` porte aussi une ligne non
  publiée d'une autre session (les pages `villefort`, `gardeguerin` dans `PAGES`) — ne pas
  l'envoyer à sa place sans le lui dire.

**Vérifié** (headless, Playwright, partie neuve + « Passer ») : aucune erreur ; la grille
reste baissée ; Lydéric, Houtland, le mage, le crieur, Cornélie, le gardien, l'allumeur, le
pêcheur, Aldegonde, Émile disent la bonne réplique de l'étape `grille`, gras compris ; les
indices s'écrivent (`crypte`, `cornelie`, `gustave`, `nuit`) et l'objectif suit. Script :
`a1/etape12.mjs` (dossier de travail de la session ; à refaire dans `bancs/` si on le garde).

**Pas encore vérifié** : la dalle de la crypte en rendu (dans `chapelle.html`) ; le journal
(onglet Indices) à l'écran ; **le banc** (`charge.mjs` : le 2 au soir, le Mac était à une
charge de 60, mesure de 52,9 s inutilisable — refaire au calme, avant/après).

**Défauts vus sur les captures, à corriger d'abord :**
1. **Le vieux pêcheur n'est pas au bord de l'eau** : il est posé dans une cour fermée de
   murs de brique, et sa ligne descend trop bas. La recherche de berge (`lieuxActe1`, autour
   de 166 ; 607) trouve un point « à 1–2 m d'une nappe » qui n'est pas une berge visible. Le
   placer sur une vraie rive dégagée, vérifiée en capture.
2. **Le crieur** est caché derrière un étal du marché : le mettre au bord de la place, en vue.
3. **L'allumeur** : la caméra d'essai était dans un mur, on ne l'a pas vu — refaire la prise.
4. Le gardien est bien placé, sur le parvis.

**Répliques ajoutées** (ambiance, à recopier dans `DIALOGUES-ACTE1.md`) : Aldegonde (« Les
volets sont fermés partout… »), Baptiste (« Personne n'a mangé une gaufre depuis midi… »),
Fernande (« Mon homme est des dix qui poussent la grille… »), le pêcheur à `grille` avant
qu'on lui parle de canne (« La cloche s'est tue, et les poissons aussi… »). Émile dit
désormais « le canal de la Tortue, derrière le moulin » (le moulin est à vent : « sous la
roue » ne tenait pas).

**La suite, dans l'ordre** : les trois défauts ci-dessus → Gustave (`tavern.js`) et la
petite porte fermée du beffroi → les vers (frapper la terre du champ du nord) → la pêche
(étape 4) → le banc au calme → publier (`quetes.js village.js pnj.js chapelle.js
docs/DECOUPAGE-ACTE1.md`, et `engine.js` en accord avec la session des mondes) → la nuit
(étape 5).
