# L'acte IV — découpage en étapes jouables (version 1, 6 octobre) — **à valider par Eugène**

L'acte IV de `STORY.md` (« La Cloche des Heures »), qui fait foi, découpé en étapes qu'on peut
jouer, vérifier et publier une à une, sur le modèle de `DECOUPAGE-ACTE1.md`. Le détail vient de
`SCENARIO.md` § 13 et de `DECISIONS-RECIT.md` § 1 (Nunzia, Cosimo, la lettre) ; les répliques sont
dans `DIALOGUES-ACTE4.md`. On part de l'île du temps : la porte des Heures s'ouvre dans un trullo
d'Alberobello (`temple.js` : `['alberobello', [6.5, 0, 4.6], …]`).

**Ce qui existe déjà** : les trois villes resserrées et habillées (`pouilles.js`, `matera.js`,
`alberobello.js`, `gallipoli.js`) ; le petit train (la gare de chaque ville mène aux deux autres, en
fondu) ; Nunzia à quinze ans sur la jetée du Colosse ; Cosimo sur le quai d'Alberobello ; le Colosse
figé sur son socle ; le château Tramontano (trois tours et leurs courtines, une cour) sans intérieurs ;
l'arène du multi de Gallipoli (`ARENE_GALLIPOLI`).

## Le fil, en une phrase par étape

| # | étape (`state.acte4`) | ce qui bloque | ce que Camille gagne | où (position du jeu) | qui |
|---|---|---|---|---|---|
| 1 | `arrivee` | rien ne dit où chercher | le temps qui court (on le voit) ; le train ; « la ville de la mer », Gallipoli | le trullo de la porte, Alberobello (6,5 ; 7,6) ; la gare (−80 ; −20) | Cosimo jeune, sur le quai |
| 2 | `arrivee` → `quinze` | le Colosse marche sur la côte, chaque pas un bond du temps | **qui** : l'homme rouge ; le grand-père de Nunzia l'a vu, **dans les Sassi de Matera** ; le ticket et le sifflet (la lettre, 1) | Gallipoli, la jetée du Colosse (272 ; 40), la place de la gare (369 ; 30) | Nunzia, 15 ans |
| 3 | `quinze` → `grandpere` | le grand-père est mort (le temps a couru) | la maison du grand-père vide, son voisin ; au dépôt, **l'apprenti du train envoyé au bout de la ligne** (la lettre, 2) | Matera, les Sassi ; la gare (−415 ; 266) | le voisin, le chef de dépôt |
| 4 | `grandpere` → `trente` | — (on rentre à Gallipoli) | **où** : l'homme rouge est monté au **château Tramontano** ; la lettre, confiée | Gallipoli, la jetée | Nunzia, 30 ans |
| 5 | `trente` → `rythme` | les portes du château n'ont ni serrure ni gonds | le château « ne s'ouvre qu'à un rythme » | Matera, la cour du château (−454 ; 318 : le donjon) | le gardien du château, un vieux des Sassi |
| 6 | `rythme` → `soixante` | — (on rentre à Gallipoli) | **comment** : la pizzica ; **la joueuse de tambourin d'Alberobello**, « c'est ma fille » | Gallipoli, la jetée | Nunzia, 60 ans |
| 7 | `soixante` → `corde` | le tambourin n'a plus de corde : les tarentules l'ont volée | où sont les tarentules : **les grottes sous les remparts de Gallipoli, à marée basse** | Alberobello, le trullo de la joueuse (à poser près de la gare) | la joueuse (Assunta ? — nom à trancher) |
| 8 | `corde` → `tambourin` | la marée remonte vite ; les tarentules | **la corde**, puis **le tambourin** (touche K) | Gallipoli, les grottes sous le rempart (à relever au banc), puis Alberobello | la joueuse |
| 9 | `tambourin` → `chateau` | trois portes à rythme ; les salles qui vieillissent | le vers de la prophétie ; **le Colosse est la clé** : le morceau de cloche est dans sa poitrine | Matera, le château Tramontano | — |
| 10 | `chateau` → `colosse` | le Colosse et ses bonds de temps | le morceau de cloche ; **l'élan** | Gallipoli, la jetée du Colosse et la côte | le Colosse ; Nunzia, 75 ans, qui regarde |
| 11 | `colosse` → `heures` | Camille sait qu'elle aide Phinaert | la Cloche des Heures sonnée ; le temps ralentit | la jetée, devant le socle | Nunzia, vieille |
| — | `heures` → `temple` | — | le retour au Temple (troisième étage, le cadran) | la porte des Heures, Alberobello | (temple.js : demande écrite) |

**La lettre** (la grande quête secondaire, `state.lettre4`) court à côté des étapes 2 à 11 : le ticket
et le sifflet (2), le dépôt de Matera (3), la lettre confiée (4), Cosimo trouvé vieux dans son trullo
avec le tambourin pour que l'encre tienne (8 ou après), la boîte de lettres rapportée, lue sur le quai
(après 11, ou avant le Colosse si l'on veut). Elle ne bloque jamais l'histoire.

Durée visée (`SCENARIO.md` : ~45 min en allant vite) : 8 min pour 1 à 4, 7 pour 5 à 7, 8 pour 8,
12 pour 9, 7 pour 10 et 11, et la lettre en plus.

## Le temps qui court — ce qui se voit dans les trois villes

C'est la règle du monde (`SCENARIO.md`, « Le mal du temps ») et le cœur de l'acte ; tout se fait dans
`pouilles.js`, par les crochets de `monde.js` (`anime`, `plus`) et ce qu'exporte le moteur (`sun`,
`hemi`, `scene`), comme la nuit de Lille (`nuitLille`, `quetes.js`).
- **La journée en deux minutes** : le soleil traverse le ciel, la lumière passe du blanc de midi à
  l'orange puis au bleu de nuit, et revient. Pas une lumière de plus (règle 8) : les guirlandes de la
  place de la gare luisent la nuit (elles le font déjà).
- **La marée** (Gallipoli) : la mer monte et descend de 1,2 m en trois minutes ; les barques suivent.
  À marée basse, l'entrée des grottes est à sec. Il faut que `monde.js` laisse bouger son plan d'eau :
  s'il n'expose pas la mer, on la retrouve dans la scène ; s'il la fusionne, **c'est un crochet à
  demander** (noté au compte rendu).
- **Les gens vieillissent** : Nunzia change à chaque étape de l'enquête (15, 30, 60, 75 ans) — des
  rôles `nunzia30`, `nunzia60`, `nunzia75` ajoutés à `PNJ.ROLES` depuis `pouilles.js` (cheveux qui
  grisonnent, puis blancs ; la silhouette qui se voûte : `gabarit`, `idle`), sans toucher `pnj.js`.
  Cosimo de même (jeune sur le quai à l'étape 1, absent ensuite, vieux dans son trullo).
- **Le tambourin** (touche **K**, la même que le gong de Thaïlande : un objet du monde par monde) : un
  battement ralentit le temps autour de Camille pendant huit secondes — le soleil presque arrêté, la
  marée tenue, les tarentules et le Colosse au ralenti, une pierre qui ne s'effrite plus. Un cercle de
  poussière dorée au sol dit jusqu'où.

## Les étapes, une à une

### 1. L'arrivée (`arrivee`)

La porte des Heures débouche dans le trullo. Dehors, le soleil bouge à vue d'œil : la première fois,
un plan de caméra sur le ciel qui tourne, et Camille : « Le soleil… il court. » La gare est à
l'ouest, à 87 m. Cosimo, jeune, attend sur le quai : il descend à Gallipoli tous les jours, « une
minute ». L'objectif : prendre le train pour Gallipoli (« la ville de la mer », où les gens du
quai disent que le géant de bronze s'est mis à marcher). Les gens d'Alberobello : ambiance (tout le
monde court).

**Fini quand** : on descend du train à Gallipoli.

### 2. Nunzia à quinze ans (`quinze`)

Le Colosse **marche** le long de la côte (l'aller-retour de la jetée au château angevin), lentement ;
à chacun de ses pas, un éclair blanc, la mer saute d'un mètre, le soleil fait un bond. Il ne s'en
prend pas à Camille ; s'en approcher, c'est se faire bousculer par le temps (repoussée, rien de plus).
Nunzia, sur la jetée : **qui** — l'homme rouge ; son grand-père l'a vu, **il vit dans les Sassi de
Matera, à l'ombre** (les vieux s'y sont réfugiés pour vieillir moins vite). Elle serre un ticket
poinçonné, tourne la tête au sifflet (`state.ind.ticket`).

**Fini quand** : Nunzia a parlé du grand-père. Le journal : « Le grand-père de Nunzia a vu l'homme
rouge. Il vit dans les Sassi de Matera. »

### 3. Le grand-père (`grandpere`)

À Matera, la maison du grand-père (une porte des Sassi qu'on marque d'un repère d'or) est fermée.
Son voisin, assis devant : « Le vieux Donato ? Mort la semaine dernière. Ici, une semaine… » Il a
laissé un mot « pour la petite » — on ne le lit pas, on le porte (il sert à l'étape 4 : c'est ce que
Nunzia « a appris depuis »). Au dépôt (la gare), le chef : l'apprenti qui regardait toujours vers la
mer ? **Envoyé au bout de la ligne, à Alberobello** (`state.lettre4 = 'ou'`).

**Fini quand** : on a le mot du grand-père. (Le dépôt est facultatif : c'est la lettre.)

### 4. Nunzia à trente ans (`trente`)

De retour à Gallipoli, Nunzia a trente ans. Elle reconnaît Camille (« Tu n'as pas changé. Pas d'un
jour. ») ; elle lit le mot : **où** — l'homme rouge est monté **au château de Matera, le
Tramontano**. Si Camille sait où est Cosimo, Nunzia lui confie **la lettre** (`lettre4 = 'lettre'`).

### 5. Le château fermé (`rythme`)

À Matera, la cour du château (le côté ville, au pied du donjon) : trois portes de bois, une par tour,
sans serrure ni gonds. Entrée : « Pas de serrure. » Un vieux des Sassi, assis contre la courtine :
« On ne l'ouvre pas avec une clé. On l'ouvre avec un rythme. Ma mère le savait. » Camille ne peut
rien de plus : retour à Gallipoli.

### 6. Nunzia à soixante ans (`soixante`)

Les cheveux gris, un châle. **Comment** : « Le château ne s'ouvre qu'au rythme de la pizzica. **La
vieille joueuse de tambourin d'Alberobello** te l'apprendra. C'est ma fille. » (`SCENARIO.md`.)
Le Colosse passe derrière elle ; elle ne se retourne plus.

### 7. La joueuse et la corde (`corde`)

À Alberobello, un trullo près de la gare : la joueuse (une femme de quarante ans, la fille de Nunzia).
Son tambourin n'a plus de corde (le cerclage de cuir qui tient la peau) : **les tarentules** sont
montées des grottes de Gallipoli et l'ont emportée. **Les grottes sous les remparts, à marée basse.**

### 8. Les grottes, la corde, le tambourin (`tambourin`)

Sous le rempart de Gallipoli, une entrée qu'on n'atteint qu'à marée basse (une minute et demie de mer
basse sur trois) : une grotte marine (un intérieur bâti dans `gallipoli.js`, ou une poche de rocher
contre le rempart — **à trancher à la construction**, on cherche le moins cher au chargement : rien
ne naît avant qu'on y entre). Trois à cinq **tarentules** (`KINDS` complété depuis `pouilles.js`,
comme `citadelle.js` le fait) ; une morsure fait « perdre le rythme » (on ralentit), qu'on retrouve en
frappant le sol. Au fond, la corde. Si la mer remonte, l'eau envahit l'entrée : on ressort mouillée,
repoussée dehors (pas de noyade, l'acte III n'a pas encore donné le souffle). Retour à Alberobello :
la joueuse recorde le tambourin, apprend la pizzica (trois battements, un silence) : **le tambourin**
(touche K).

### 9. Le château Tramontano (`chateau`)

Le donjon de l'acte. Devant chaque porte, le tambourin : la porte s'ouvre au rythme (K frappé dans la
cadence d'un battement qu'on entend — un petit jeu de rythme de quatre coups ; raté, on recommence).
Dans chaque tour, **une salle** qui vieillit et rajeunit en boucle (le même lieu neuf, puis en ruine) :
on bat le tambourin pour la figer à l'âge qu'il faut —
- **la tour sud** : un plancher qui s'effondre en ruine ; figé neuf, on traverse jusqu'à l'escalier ;
- **la tour nord** : une porte murée quand la salle est neuve, éboulée quand elle est vieille ;
  figée vieille, on passe par la brèche ;
- **le donjon** : les deux tours donnent chacune un levier (ou un contrepoids) ; les deux ensemble
  ouvrent l'escalier du donjon ; au sommet, le cadran de la tour, et la vue sur la mer au loin.
Au centre de la cour, **le morceau de la prophétie de l'acte IV** (« Chaque heure sauvée coûtera des années, et nul ne les rendra. » — `SCENARIO.md` § 2 ; § 13 dit « le cinquième », la liste en fait le quatrième), gravé dans la dalle, se lit une fois
le donjon ouvert. Sur le cadran (ou au mur du sommet), ce que Phinaert a fait : le morceau de la
Cloche des Heures planté dans la poitrine du géant.

Les intérieurs n'existent pas : ce sont trois salles rondes simples (le rayon de chaque tour,
`TOURS` de `matera.js`), bâties à l'entrée — pas au chargement. **Le lasso et la poulie** de
`SCENARIO.md` (la tour la plus haute, d'une tour à l'autre) viennent de l'acte II et de rien encore :
on monte par l'escalier intérieur (**à trancher**, ci-dessous).

### 10. Le Colosse (`colosse`)

À Gallipoli, marée descendante. Le Colosse marche sur la jetée et la plage ; chaque pas : la mer monte
d'un coup, des rochers paraissent et disparaissent, le soleil saute. Il ne frappe pas — **il pousse le
temps** : à chaque pas près de Camille, une onde qu'on saute (comme la cloche de Phinaert), sinon on
est rejetée. Au tambourin, il ralentit (huit secondes) : il pose un genou, la main au sol ; Camille
monte par sa main et son bras jusqu'à la poitrine, frappe le morceau de cloche à l'épée (trois fois,
un battement de tambourin chaque fois : il se relève entre deux). Nunzia, 75 ans, regarde du quai.

### 11. La Cloche des Heures (`heures`)

Libéré, le Colosse revient à sa place, sur le socle, et **redevient statue** face à la mer. Il donne
**son élan** (`state.elan` : un grand saut — le saut plus long, une touche de plus sur Espace tenue ;
**à trancher** : le moteur, `engine.js`, n'est pas à cette conversation — demande écrite). La Cloche des
Heures sort de sa poitrine (la cloche d'horloge plate, vert-de-gris, `DECISIONS-RECIT.md` § 2) ; elle
vieillit à vue d'œil tant qu'on ne la sonne pas. Camille hésite (« Je sais pour qui elle sonne. »),
elle sonne. Le temps ralentit : le soleil se couche, lentement, sur la mer (la journée reprend son
pas normal dans les trois villes, la marée aussi). Nunzia, assise sur le quai à côté du Colosse :
« J'ai eu une vie, Camille. Elle est passée vite, voilà tout. Va. Ce que tu as commencé… »

Le retour : la porte des Heures, à Alberobello (le train y mène) ; `temple`.

## Les quêtes secondaires — découpées, codées seulement quand l'histoire est publiée

| quête | où | ce qu'il faut | gagne |
|---|---|---|---|
| **La lettre de Nunzia** (grande) | les trois villes | la lettre (4), Cosimo vieux dans son trullo près de la gare d'Alberobello, le tambourin pour que l'encre ne pâlisse pas en route ; la boîte de lettres rapportée | la dernière réplique de Nunzia change |
| La récolte | une ferme d'oliviers (le bord d'Alberobello ?) | le tambourin | l'huile, une potion |
| Les signes des trulli | douze toits d'Alberobello | marcher, regarder | un morceau de cœur |
| Les oursins | les rochers de Gallipoli, à marée basse | la canne | des écus |
| La fête de la pizzica | la place d'Alberobello | le tambourin (le jeu de rythme du château) | une tenue |

## À trancher par Eugène (avant le code)

1. **Les objets des actes II et III** (le souffle, le lasso, la poulie) ne sont pas encore codés, et
   `SCENARIO.md` s'en sert ici (plonger dans les grottes, monter sur la jambe du Colosse, passer d'une
   tour à l'autre). Proposition : **l'acte IV se joue sans eux** — les grottes à marée basse, le Colosse
   par sa main posée au sol, le château par ses escaliers ; quand les actes II et III seront là, on
   ajoutera des raccourcis qui s'en servent (une grotte noyée, la tour au lasso).
2. **Pourquoi l'on quitte Gallipoli entre deux âges de Nunzia** : j'ai donné à chaque âge une course
   ailleurs (le grand-père à Matera, le château fermé à Matera, la joueuse à Alberobello). Nunzia
   vieillit **au retour par le train**, pas au simple aller-retour dans la ville : on ne la voit pas
   vieillir « par erreur ».
3. **Le grand-père de Nunzia (Donato)** et **le vieux des Sassi** sont des personnages nouveaux,
   petits ; **la joueuse de tambourin** n'a pas de nom dans `SCENARIO.md`. Des noms à donner (je
   propose Donato, et Assunta pour la joueuse) — ou pas de nom.
4. **La fille de Nunzia** : elle n'est pas la fille de Cosimo (ils ne se sont jamais parlé). Je n'écris
   rien là-dessus ; à garder ainsi ?
5. **L'élan** demande au moteur un saut plus long (`engine.js`, à personne pendant la vague 1) : je
   pose `state.elan` et le moment, et j'écris la demande. D'accord ?
6. **Le Colosse marche** dès l'arrivée (STORY.md : « chaque pas produit un bond du temps ») ; il est
   figé aujourd'hui. Dans l'arène du multi, il reste figé (aucune histoire en instance).

## Qui écrit quoi — les fichiers

| étape | fichiers de cette conversation | ce qu'il faudrait d'ailleurs |
|---|---|---|
| temps, 1 – 11 | `pouilles.js` (l'avancement `state.acte4`, le temps qui court, le tambourin, le carnet `G.level.indices`, les rôles neufs dans `PNJ.ROLES`, les tarentules dans `KINDS`) ; `gallipoli.js` (Nunzia aux quatre âges, le Colosse qui marche, les grottes, le combat, la cloche) ; `matera.js` (le voisin, le dépôt, le château et ses trois salles) ; `alberobello.js` (Cosimo, la joueuse, le trullo de la porte) | `temple.js` : le retour (la Cloche des Heures au troisième étage, le cadran) ; `engine.js` : l'élan ; peut-être `monde.js` : la mer qui bouge |

**Une instance du multi ne déclenche rien** : `tloc-multi.js` pose `G.level.counts/start` en instance ;
`pouilles.js` ne lance l'acte que hors instance (et le Colosse reste figé dans l'arène de Gallipoli).

## Comment chaque étape est vérifiée

- **En headless**, Playwright (`window.TLOC`), un banc par lot : `bancs/acte4-*.mjs` part d'un état posé
  (le prologue, l'acte I faits ; `state.acte4` à l'étape voulue), va au témoin par un chemin cherché
  sur `blocked`, parle, prend le train, vérifie l'étape suivante ; une capture par moment clé ; aucune
  `pageerror`. Les bancs passent par `bancs/tour.sh`.
- **Au banc de charge** : `node bancs/charge.mjs` et `bancs/lieu-pouilles.mjs`, avant et après ; rien de
  nouveau au-delà de 300 ms ; les habitants, les salles du château et la grotte naissent après le
  chargement (ou à l'entrée).
- **La règle du gras** relue réplique par réplique.

## Les lots, dans l'ordre de publication

1. Le temps qui court (soleil, marée) + étapes 1 à 4 (`acte4-enquete.mjs`).
2. Étapes 5 à 8 : le château fermé, Nunzia à soixante ans, la joueuse, la grotte, le tambourin
   (`acte4-tambourin.mjs`).
3. Étape 9 : le château Tramontano (`acte4-chateau.mjs`).
4. Étapes 10 et 11 : le Colosse, la cloche (`acte4-colosse.mjs`).
5. La lettre ; puis les petites quêtes si tout est publié.

## Avancement

Accord d'Eugène sur les six propositions (6 octobre) : l'acte se joue sans le souffle, le lasso ni
la poulie ; Nunzia vieillit au retour par le train ; Donato et Assunta ; rien sur le père de la fille
de Nunzia ; l'élan posé dans `state.elan`, le saut demandé à `engine.js` ; le Colosse figé en instance.

| lot | état |
|---|---|
| 1 — le temps qui court, étapes 1 à 4 | **codé, joué en headless de bout en bout** (6 octobre, `bancs/acte4-enquete.mjs`, 22 pas sur 22, captures `bancs/resultats/acte4-enquete-…`) : la journée en deux minutes (soleil, lune, couleurs, brume, exposition), la marée de Gallipoli (le plan d'eau et les barques), Camille à l'arrivée, Cosimo, le train, Nunzia à 15 puis 30 ans (née après le chargement, à l'âge de l'étape), le voisin de Donato devant une porte des Sassi (atteignable à pied depuis l'arrivée), le chef de dépôt, la lettre confiée, le carnet du journal, l'objectif. Chargement (`bancs/acte4-charge.mjs`, A/B entrelacé) : Σ des trois villes 5,8–6,2 s avant, 5,7–5,9 s après. |
| 2 — étapes 5 à 8 | **codé, joué en headless de bout en bout** (6 octobre, `bancs/acte4-tambourin.mjs`, tout passé) : les trois portes du château (atteintes à pied depuis l'arrivée), le vieux des Sassi, Nunzia à 60 ans, Assunta devant son trullo près de la gare d'Alberobello (son tambourin en main), la grotte : un banc de rochers au pied du mur nord du château angevin, découvert à marée basse (`solLieu`), de la jetée du Colosse à une bouche noire ; six tarentules (`KINDS.tarentule`, leurs pattes animées) ; la corde ; la mer qui remonte rejette Camille sur la jetée ; le tambourin (K : huit secondes de ralenti, la journée, la marée et les tarentules). |
| 3 — étape 9, le château | **codé, joué en headless de bout en bout** (6 octobre, `bancs/acte4-chateau.mjs`, 17 pas sur 17) : les tours CREUSES (un anneau de collision de 24 secteurs, ouvert de 3,3 m devant la porte ; un sol à la cote la plus haute du rocher couvert, une rampe au seuil ; parement intérieur et voûte), les courtines rognées au pied des tours ; les portes à rythme (`ECOUTE4` : K, l'anneau de bronze luit trois fois, on frappe dans le silence) ; la tour sud (le plancher neuf ou en ruine, en boucle : figé neuf au tambourin), la tour nord (murée ou éboulée : figée en ruine), leurs leviers ; le donjon, son sommet (`chateau`) ; la dalle de la cour et le vers. La règle des salles est tenue par matera.js à chaque image (monde.js ne sait pas bloquer puis rouvrir un passage). |
| 4 et 5 — le Colosse, la cloche ; la lettre | **codés, joués en headless de bout en bout** (6 octobre, `bancs/acte4-colosse.mjs`, 18 pas sur 18) : le Colosse arpente la jetée en U, chaque pas un bond du temps (la lumière, la marée), il repousse Camille sans la blesser ; Nunzia à 75 ans ; ralenti au tambourin, il met un genou à terre, trois coups sur le morceau de cloche ; statue, l'élan (`state.elan`), la Cloche des Heures qui noircit tant qu'on ne la sonne pas ; sonnée : `heures`, le soleil descend au couchant et s'y tient. La lettre au journal (`QUESTS.lettre`) : Cosimo vieux devant son trullo, l'encre qui pâlit sans le tambourin, la boîte de lettres, lue par Nunzia sur le quai. |

À reprendre (le bronze du Colosse est corrigé le 6 octobre : `marble_rock_03` n'existait pas, phMat rendait un gris de repli ; le genou à terre est le clip `Fixing_Kneeling`, il s'enfonçait de 3 m dans la jetée) : le retour au Temple (`temple.js`, demande écrite) ; les petites quêtes.

À reprendre : au loin, la nuit, la mer reste pâle (le reflet du ciel à l'horizon).

**Les cinq points du 6 octobre au soir** (demande d'Eugène) :
- **Le retour au Temple** (`temple.js`, avec l'accord d'Eugène — le fichier n'était à personne pendant la
  vague 1) : la Cloche des Heures pendue au troisième étage, le grand cadran dont l'aiguille va trop vite, un
  tic-tac, la rive des Pouilles ; une scène une fois (la porte qui s'entrouvre, la Lozère : SCENARIO.md § 13),
  puis `state.acte4 = 'temple'`. `bancs/acte4-temple.mjs`, tout passé.
- **Les petites quêtes** (`bancs/acte4-quetes.mjs`, tout passé), au journal : la récolte (un fermier, trois
  oliviers près de la gare d'Alberobello, six grappes mûres une seconde et demie — huit fois plus au tambourin ;
  l'huile, une potion qui rend toute la vie) ; les douze signes peints à la chaux sur les cônes (le dernier, le
  Temple ; un cœur de plus) ; la fête de la pizzica (quatre mesures avec Assunta ; la tenue : tunique rouge et
  foulard safran, des couleurs que l'armoire connaît déjà) ; les oursins sur le banc de rochers à marée basse
  (trois écus ; à la main, la canne n'existant qu'à Lille).
- **La mer, la nuit** : son reflet du ciel suit le jour (`envMapIntensity`, sans recompilation).
- **La marée après la cloche** : elle continue à son pas d'avant le mal (dix minutes) — arrêtée, le banc de
  rochers ne se découvrait plus.
- **Le chargement** avec le clip à genoux : Σ des trois villes 7,1 / 6,7 s avant, 7,2 / 7,1 s après (la
  machine plus chargée qu'au matin) : rien de mesurable.

À reprendre : un des trois oliviers tombe dans la maison voisine (la place se cherche au pied d'un mur).
