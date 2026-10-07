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
| 9 | `citadelle` → `bombes` → `donjon` | trois cadenas sur la grille du donjon | **les bombes**, puis les **trois clés** | la place d'Armes, l'armurerie (bastion du Roy, 118 ; 212), le fossé de la Porte Royale, les remparts de l'ouest (la nuit), la pointe de Turenne | les trois soldats, l'armurier ; la Moule-Reine, le Capitaine sans tête, la Grande Corbelle |
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

**Comme c'est bâti** (5 octobre, B3, tout dans `citadelle.js`, `ACTE1_CITADELLE`) :
- **Les soldats** se cachent derrière des caisses, devant la porte de la caserne la plus proche de
  la poterne (celle par où l'on sort des galeries) : le caporal (les trois créatures), le tambour
  (la nuit, la lumière), le vieux soldat (l'armurier ; si l'on revient, le tonneau de poudre).
- **L'armurerie** est le magasin du **bastion du Roy** (emprise n° 8, 698 m², 118 ; 212), à deux pas
  de la poterne — et non l'emprise n° 6 (−190 ; −12), que `SCENARIO.md` disait « du Roi » : le relevé
  la met sur le bastion de la Reine. Planches en croix sur la porte, trois tonneaux de poudre contre
  le soubassement (deux empilés : une flèche tirée droit les trouve). Une flèche (ou une bombe) :
  la porte saute, l'armurier sort, il donne **dix bombes** (touche **V** : lancée devant soi,
  mèche de 1,8 s ; il en refait quand le sac est vide).
- **La Moule-Reine** trône dans le fossé, à l'est du pont de la Porte Royale (11 ; 214), à demi
  sortie de l'eau. Fermée, rien ne la blesse. Toutes les trois secondes elle s'ouvre et crache vers
  Camille : une bombe qui arrive dans la coquille ouverte y éclate et la fend ; fendue, deux bombes
  de plus. On l'attaque depuis le pont (les flèches s'arrêtent au garde-corps : c'est l'affaire des
  bombes). Sa clé tombe sur le tablier.
- **Le Capitaine sans tête** ne sort que **la nuit** (`state.nuit`, le lit de Camille) et à la
  lanterne : sa ronde longe la courtine du nord-ouest, à 22 m en dedans (la rue du rempart ; à 12 m,
  elle traversait une caserne), avec ses cinq soldats. « Qui marche sur ma ronde ?… » Tombé, sa ronde
  tombe avec lui. De jour, la ronde est vide et l'objectif renvoie au lit.
- **La Grande Corbelle** tourne à 15 m au-dessus de la pointe de Turenne. Seule une bande du
  terre-plein se marche (de la rampe jusqu'au magasin du bastion) : elle tourne au bout de cette
  bande, à portée d'arc ; toutes les six à huit secondes elle pique sur Camille. Trois flèches. Sa clé
  tombe là où l'on se tient.
- **Les clés** se ramassent en passant ; chacune vient avec son billet d'Eugène (n° 4, 5, 6). Les
  **trois cadenas** pendent à la grille du donjon : Entrée devant la grille, chaque clé en ouvre un ;
  au troisième, la grille s'ouvre (`donjon`).
- **Les dix monstres de l'ancienne histoire** (fossés, remparts, bastions) sont retirés dès que
  l'acte I commence : la grille du donjon y tombait au dixième. Les corbeaux du champ d'Émile restent.

### 10. Le donjon et le Temple

Le combat existe (Phinaert, la masse, l'onde de choc). À mi-vie, la cloche du donjon (on
coupe la corde à l'arc) ; à un quart, il s'arrête, pose la main d'Eugène sur la dalle, la
porte de lumière s'ouvre, il y entre avec Eugène. Camille le suit : l'île du temps
(`temple.html`), le mage, le premier vers de la prophétie, la porte du Midi entrouverte.

**Comme c'est bâti** (5 octobre, B3) : Eugène attend, attaché devant la porte du donjon, dès qu'on
entre dans la place. La grille ouverte, Phinaert se tient dans l'enclos ; il parle quand Camille y
entre (« La petite de la garde… »). **À mi-vie**, il va tirer la corde de **la cloche du donjon**
(une potence de chêne au parapet sud, la corde jusqu'au sol, à droite de la porte) : le sol tremble
— une onde toutes les deux secondes, qu'on saute —, et Phinaert ne prend plus de coups. Une flèche
coupe la corde (elle est une cible de l'arc comme une bête) : la cloche se tait, le combat reprend.
**À un quart**, il s'arrête (« Assez… »), va prendre Eugène, pose sa main sur **la dalle gravée**
devant le donjon (« Le sang de Lydéric… ») : une porte de lumière violette, à sa taille (12 m), s'y
lève ; ils y entrent. Phinaert ne meurt pas. Entrée devant la porte : `temple`, et l'île du temps.
**Reste à `temple.js`** (une autre session) : l'arrivée scénarisée — le mage, le premier vers, la
porte du Midi entrouverte (demande écrite dans `PROMPT-REPRISE.md`).

## Qui écrit quoi — les fichiers

| étape | fichiers de cette session | ce qu'il faudrait d'ailleurs |
|---|---|---|
| 1, 2, 3, 4 | `quetes.js` (l'avancement, Lydéric, le crieur, la pêche), `village.js` (les habitants du bourg, la porte basse du beffroi), la fin de `ROLES` (`pnj.js` : le crieur, l'allumeur, le gardien, le pêcheur) | Gustave est dans l'estaminet (`tavern.js`) : ses deux répliques |
| 5 | — | **la nuit** : `engine.js` (ciel, soleil, lune, brouillard) et `house.js` (« jusqu'au soir ») |
| 6 | `village.js` (Désiré au sommet) | l'énigme : `atlas.js` (réutiliser ses devinettes) |
| 7 | — | `chapelle.js` : l'escalier derrière l'autel |
| 8 | — | `cave.js` : Bastien, l'arc au puits, le Rat-Roi et la clé |
| 9, 10 | `citadelle.js` seul (`ACTE1_CITADELLE` : les soldats, l'armurerie, les bombes, les créatures — `KINDS` complété depuis citadelle.js —, les cadenas, la cloche, Phinaert) | `temple.js` : l'arrivée de la fin de l'acte ; `quetes.js` et `hud.js` : appeler `ACTE1_CITADELLE.onKill`, `.objectif`, `.bandeau` (une passerelle les branche en attendant) ; `engine.js` : le `bowBack` de `loadGame` |

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
| 1 | **codée, essayée en headless** (2 octobre au soir) |
| 2 | **codée, jouée en headless** (5 octobre, B1) : Gustave à l'estaminet (`tavern.js`, ses deux répliques, l'indice `escalier`), la porte basse du beffroi fermée (« Fermé à clé. ») ; les témoins replacés et vus en capture (le crieur au pied de la fontaine, le gardien dans l'axe du portail de la chapelle, le pêcheur sur une berge d'où l'on voit l'eau) |
| 3 | **codée, jouée** : quatre mottes de terre retournée au bord du champ du nord, côté moulin ; un coup d'épée → `state.vers` ; le pêcheur donne la canne (`canne`) |
| 4 | **codée, jouée** : la pêche partout face à l'eau (Entrée lance, le bouchon plonge, Entrée ferre, Entrée tenue ramène, la jauge de la ligne, elle casse si l'on tire trop) ; au canal de la Tortue, la clé (`cle`) |
| 5 | **codée, jouée** : le lit de Camille, « jusqu'au soir » / « jusqu'au matin » (`state.nuit`) ; la nuit sur Lille par ce que le moteur exporte (ciel, lune, étoiles, soleil-lune, brume, plus de reflet du jour) ; une fenêtre sur trois et les verres des lanternes qui s'allument (émissifs, aucune lumière de plus) ; les nuages éteints ; la lanterne de Désiré au sommet du beffroi |
| 6 | **codée, jouée** : de nuit, la porte basse s'ouvre avec la clé ; Désiré au sommet (la lumière du haut du colimaçon monte avec lui) ; l'énigme du guetteur posée par lui (`atlas.js`, `enigme({…})`), mauvaise réponse « Regarde encore », bonne → la lanterne (`lanterne`) et la carte du guetteur ; au matin, il redescend dans les rues et ouvre *La ronde de Désiré* |
| 7 – 10 | sessions B2 et B3 (PLAN-2026-10-05-ACTE1.md) |

Banc de B1 : `bancs/acte1-b1.mjs` joue les étapes 2 à 6 de bout en bout dans une seule partie
(23 vérifications, captures `bancs/resultats/acte1-b1*-…`) ; `bancs/acte1-bourg.mjs` filme les
témoins de l'enquête ; `bancs/acte1-outils.mjs`, les gestes communs (une partie au prologue
passé, parler, filmer sans mur devant).
| 7, 8 | **codées, jouées en headless de bout en bout** (5 octobre, B2 : `bancs/acte1-souterrains.mjs` : 26 pas sur 28, les deux autres sont le défaut ci-dessous ; une capture par moment clé) : la crypte, Bastien, l'arc, le levier, le Rat-Roi, la clé, la porte de la poterne ; l'ancienne histoire intacte. **Un défaut hors B2** : avec l'arc en poche, la page de la citadelle se fige au chargement (`loadGame`, engine.js:2687, écrit dans le `bowBack` que la Camille riggée n'a pas) — `cave.js` et `chapelle.js` s'en gardent, `index.html` non |
| 9, 10 | **codées, jouées en headless de bout en bout** (5 octobre, B3 : `bancs/acte1-citadelle.mjs`, 35 vérifications sur 35, une capture par moment clé, `bancs/resultats/acte1-citadelle-…`) : les soldats, la flèche dans la poudre, l'armurier et les bombes, la Moule-Reine à la bombe, la Corbelle à l'arc, le Capitaine la nuit (vide de jour), les clés et les billets, les cadenas, Phinaert, la cloche et la corde, la porte de lumière, l'île du temps (`temple`). Tous les lieux joignables à pied depuis la place (sonde sur une grille de 2 m). La seule erreur de page est le `bowBack` d'`engine.js` ci-dessus, au chargement de l'île (le banc donne l'arc après le chargement de la ville pour l'éviter). **Pas encore** : l'arrivée sur l'île (`temple.js`), les répliques de la ville à l'étape `citadelle` (crieur, Hermès, la marchande : B1), les intérieurs des casernes |

**Les raccords du 6 octobre (matin)** — l'acte I tient de bout en bout :
- `engine.js` (`loadGame`) : la garde du `bowBack` — avec l'arc en poche, toute page qui rechargeait la
  partie plantait (la Camille riggée n'a pas de `bowBack`, son arc au dos est `arcDos`).
- `quetes.js` : `onKill` passe d'abord par `ACTE1_CITADELLE.onKill`, `suiteActe1` par
  `ACTE1_CITADELLE.objectif` (l'objectif et le point d'or jusqu'au Temple) ; la dalle gravée provisoire
  se cache pendant l'acte I, jusqu'à `temple` (elle reste ensuite le chemin du retour vers l'île) ; le
  crieur aux étapes `citadelle` et `donjon` (sans la phrase sur Hermès : le voyage rapide n'existe pas).
- `hud.js` : le bandeau de la citadelle (`ACTE1_CITADELLE.bandeau`) ; avant, pendant l'acte I,
  l'objectif et les lieux — plus de « Monstres vaincus 0 / 10 ». La passerelle de `citadelle.js` part.
- `temple.js` : la fin de l'acte (une fois, `state.templeVu`) — le mage au pied de la prophétie, le
  mythe, le premier vers lu au mur, « La suite est effacée », « **La porte du Midi est ouverte.** » ;
  du sable rouge sous la porte du Midi. Deux plans de caméra (la cour, la plaque).
Vérifié : les trois bancs (`acte1-b1`, `acte1-souterrains` « tout est passé », `acte1-citadelle`
35/35) sans erreur ; une sauvegarde à l'étape `temple`, l'arc en poche, rejoue la scène de l'île et
recharge Lille sans erreur (captures `bancs/resultats/acte1-fin-2026-10-06-*`).
**Fait (E3, 7 octobre)** : Hermès au relais de poste, au bout du pont de Fin, et le voyage rapide (un
menu des lieux de Lille déjà découverts, `quetes.js`) ; la marchande de cartes, rue du Cygne, et les plans
de Vauban (trente écus : les coffres des bastions sur la carte) ; la chambrée de la caserne des soldats
(`citadelle.js` : bâtie au-dessus de la place, une porte sur la façade). **Reste** : une partie complète jouée à la main, chronométrée (58 min visées) ; les
portes de l'île restent toutes ouvertes pour l'exploration (seule celle du Midi devrait l'être après
l'acte I).

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
