# L'acte V — découpage en étapes jouables (version 1, 7 octobre, à valider par Eugène)

L'acte V de `STORY.md` (« ACTE V — LOZÈRE, la Cloche des Troupeaux »), qui fait foi, découpé en
étapes qu'on peut jouer, vérifier et publier une à une, **dans les trois lieux tels qu'ils sont** :
Villefort (370 × 600 m, le bourg, le pont Saint-Jean, le lavoir, la gare et sa voie), la
Garde-Guérin (le village-forteresse du plateau, la tour carrée de 21 m, l'enceinte, les gorges du
Chassezac), le Pouget (le hameau, le grand enclos des brebis, les châtaigniers), reliés par les
vieux chemins (les poteaux). Le détail vient de `SCENARIO.md` § 14 ; les répliques, de
`DIALOGUES-ACTE5.md`.

**Ce qui n'est pas dans les lieux** (et que je laisse de côté, question 3) : le lac du barrage et la
vallée d'avant (le lac est à 800 m au nord de Villefort, hors de la zone), le viaduc (aucun pont de
la voie dans la zone), le château de Castanet et ses caves sous le lac, le plateau du mont Lozère
et ses menhirs ; le lasso, la poulie, la tyrolienne, la nage.

On part de : les actes passés ou non (les portes de l'île restent ouvertes), Camille avec l'épée, et
peut-être le tambourin (acte IV).

## Le fil, en une phrase par étape

| # | étape (`state.acte5`) | ce qui bloque | ce que Camille gagne | où (position du jeu) | qui |
|---|---|---|---|---|---|
| 1 | `arrivee` — le temps mêlé | le chemin du Pouget se perd dans le brouillard de 1765 | le premier fil : le berger du Pouget a perdu son chien | Villefort, la place du Bosquet (1576 ; −1140) : la porte de l'île (question 1) | le vieux de la place, le cafetier |
| 2 | `arrivee` → `chien` — l'enquête du chien | personne ne sait où est le chien | **qui** l'a vu, **où** il se cache, **comment** l'approcher | la boulangerie, la gare (1458 ; −1272), le pont Saint-Jean et le lavoir (1540 ; −1405) | la boulangère, le chef de gare, les enfants du lavoir |
| 3 | `chien` → `sonnaille` — le Pouget | le brouillard du chemin (sans le chien, on revient à Villefort) | le chien guide ; **la sonnaille** | le poteau de Villefort → le Pouget, la maison du berger, l'enclos | le berger |
| 4 | `sonnaille` → `temoins` — trois époques | les témoins ne vivent pas au présent : il faut sonner deux coups pour les voir | **qui** (un géant rouge, le loup), **où** (la tour de la Garde-Guérin), **comment** (la porte de la tour, au temps où elle n'était pas murée) | la Garde-Guérin (le péage, Moyen Âge) ; le bois du Pouget (1765) ; la gare de Villefort (1870) | le chevalier, la bergère, l'ouvrier |
| 5 | `temoins` → `tour` — la tour de la Garde-Guérin | la porte murée au présent ; dedans, des salles en ruine | les étages de la tour, chaque salle à l'époque qui l'ouvre | la tour (≈ 1817 ; −5362) | — |
| 6 | `tour` → `loup` — le loup | il passe d'une époque à l'autre : on ne le voit qu'une seconde sur deux | le morceau de cloche | le plateau au-dessus des gorges, devant la Garde-Guérin, la nuit | le berger, à la lisière |
| 7 | `loup` → `course` — la fin | — | **la course** ; la Cloche des Troupeaux ; le vers ; les époques se séparent | le plateau, puis le sommet de la tour | le loup, le berger |

**Durée visée** : 35 min en allant vite. 1–2 : 8 min ; 3 : 4 ; 4 : 8 ; 5 : 7 ; 6 : 5 ; 7 : 3.

## Les étapes, une à une

### 1. Le temps mêlé (`arrivee`)

- **On arrive à Villefort**, par une porte de l'île posée place du Bosquet (question 1). L'air tremble
  par endroits : des plaques où l'époque n'est pas la même (une lueur, un son).
- **Le vieux chemin du Pouget est dans le brouillard** : au poteau, « le Pouget » mène à un brouillard
  de 1765, des châtaigniers, un hurlement, et l'on revient au poteau. Les deux autres chemins (la
  Garde-Guérin, et depuis là le reste) sont ouverts.
- **Le fil** : le vieux de la place : le berger du Pouget est descendu chercher son chien, il est
  remonté seul, le chien a fui quand le loup a hurlé.

### 2. L'enquête du chien (trois témoins, `SCENARIO.md` § 7)

| témoin | où | ce qu'il donne |
|---|---|---|
| la boulangère | sa boutique (une devanture nouvelle, au sud de la place du Bosquet) | **qui** et **où** : un chien de berger, noir et blanc ; il a pris un pain ; il dort sous le pont Saint-Jean |
| le chef de gare | là où il attend les trains (1458 ; −1272) | « il s'enfuit dès qu'on approche ; les enfants du lavoir lui donnent à manger » |
| les enfants du lavoir | le lavoir, au pont Saint-Jean | **comment** : il ne revient que si l'on siffle comme le berger (deux notes) — et ils apprennent le sifflet à Camille |

Puis : au pont Saint-Jean, siffler (une interaction) ; le chien sort de sous la voûte et suit Camille.
(7 octobre : il n'y a ni gare ni quai dans la zone de Villefort, la gare est à l'horizon : le chien
se cache sous le pont, à côté du lavoir.) Le chien : `loup.glb` réduit (66 cm à la tête) et assombri (Eugène).

### 3. Le Pouget et la sonnaille (`chien` → `sonnaille`)

- Avec le chien, le chemin du Pouget passe : le chien guide à travers le brouillard (le poteau mène
  au Pouget, une phrase de récit).
- **Le berger**, devant sa maison : le chien lui saute dessus. Il raconte, sans gras d'abord : le loup
  « grand comme une grange », le gardien des troupeaux, qu'il connaît depuis toujours ; Phinaert lui
  a planté un morceau de cloche dans l'épaule ; c'est lui qu'on appelle la Bête du Gévaudan. « Je ne
  veux pas qu'on le tue. Je veux qu'on le libère. »
- Il donne **la sonnaille** (la sonnaille de la brebis de tête, que le loup connaît) : une touche
  (question 4) ; **un coup : le présent ; deux coups : le passé du lieu**, quelques secondes, autour
  de Camille. La première fois, il montre : deux coups devant l'enclos, et l'enclos d'autrefois (des
  claies de bois, un berger de 1765 qui passe) revient un instant.
- **Seul le Pouget est resté dans son temps** : la sonnaille n'y change rien d'autre (le berger : « Ici,
  il n'y a qu'un temps. Grâce à lui. »).

### 4. Trois témoins, trois époques (`temoins`)

Chaque témoin ne se voit qu'**à deux coups** de sonnaille, à l'endroit de son époque :

| témoin | où, quand | ce qu'il donne |
|---|---|---|
| un chevalier de la Garde-Guérin | à la porte du village, au péage, au Moyen Âge | **qui** : « Un géant rouge a passé la route sans payer le péage. Il menait un loup, grand comme une grange. » |
| une bergère de 1765 | dans le bois de châtaigniers sous le Pouget | **où** : « La Bête dort le jour dans **la tour de la Garde-Guérin**. Elle en sort la nuit, sur le plateau. » |
| un ouvrier de 1870 | sur la voie, à la gare de Villefort, quand on posait les rails | **comment** : « La tour ? Murée depuis longtemps. Mais du temps des chevaliers, **elle avait une porte**. Ta cloche, là — elle fait revenir les portes ? » |

Le carnet du journal par `G.level.indices` (le monde n'a pas de carnet : un module partagé dans
`lozere.js`).

### 5. La tour de la Garde-Guérin (`tour`)

- Au présent, la porte de la tour est murée. **Deux coups** devant elle : la porte du Moyen Âge,
  ouverte — on entre pendant qu'elle est là.
- **Dedans**, trois salles l'une au-dessus de l'autre (bâties comme les caves de l'Aveyron, hors du
  relief) ; chaque salle est en ruine au présent (plancher effondré, escalier coupé) et intacte au
  passé : on sonne pour passer, et l'on doit être de l'autre côté avant que l'époque ne revienne
  (« une pièce du donjon en bon état », STORY.md). Des loups de 1765 (des bêtes ordinaires) dans la
  deuxième salle : ils fuient la sonnaille.
- **En haut**, la chambre du loup, vide : sa litière, les marques de ses griffes, du sang ancien. Il
  est sorti. Il fait nuit (la nuit tombe quand on ressort).

### 6. Le loup (`loup`)

- **Sur le plateau**, devant la Garde-Guérin, au-dessus des gorges du Chassezac, la nuit. Le berger est
  monté avec son chien, il reste à la lisière et ne regarde pas.
- **Le loup** (`loup.glb`, grand comme une grange : × 4) **passe d'une époque à l'autre** : visible
  et touchable une seconde sur deux. **Un coup de sonnaille** le ramène au présent pour cinq
  secondes ; le tambourin (s'il est en poche) le ralentit. On frappe **le morceau dans son épaule**
  (trois fois), pas le loup.

### 7. La fin (`course`)

- Le morceau sort. Le loup vient poser la tête sur les genoux du berger. Il donne **sa course**
  (`state.course` ; courir très vite : à brancher dans le moteur, demande pour la passe D) et
  **s'endort sous la montagne**.
- **Au sommet de la tour**, la Cloche des Troupeaux (une sonnaille géante, tôle rivée,
  `DECISIONS-RECIT.md` § 2) et, gravé dessous, le vers (question 5).
- **Les époques se séparent** : plus de plaques ; la porte de la tour redevient murée ; le brouillard du
  chemin du Pouget est levé.
- Le berger : « Il a gardé mes bêtes toute ma vie. Garde les tiennes. Ce que tu as commencé… » Il
  redescend au Pouget avec son chien.
- **Le retour au Temple** (« il ne manque plus que la Grande Cloche de Lille ») : dans `temple.js`,
  demande pour une passe D (`PROMPT-REPRISE.md`).

## La porte de l'île (point 3 de la consigne)

Aujourd'hui, la porte des Troupeaux du Temple mène au Pouget, qui a déjà sa porte de l'île.
**Je propose de la déplacer à Villefort** (place du Bosquet, à côté du poteau) : l'acte commence
au bourg, « l'endroit où l'on parle aux gens », et le Pouget, refuge, se gagne (SCENARIO § 14).
Dans `temple.js`, seulement l'arrivée de la porte des Troupeaux (Villefort au lieu du Pouget). La
porte du Pouget reste, pour en revenir.

## Comment chaque étape se vérifie

Un banc par lot (`bancs/acte5-*.mjs`), comme ceux des actes II et IV : l'état posé, la partie jouée
en headless d'un lieu à l'autre (par les poteaux), une capture par moment clé, aucune `pageerror`.
Le chargement de chaque lieu avant et après (`bancs/lieu-lozere.mjs`) : rien au-delà de 300 ms, les
gens et les bêtes nés après le chargement. Les arènes de la Garde-Guérin et du Pouget : une instance
ne déclenche rien (`bancs/rencontres.mjs`).

## L'ordre du code

A. 1–3 (Villefort, le chien, le berger, la sonnaille). — B. 4–5 (les témoins, la tour). — C. 6–7 (le
loup, la fin). Les quêtes secondaires après, découpées seulement.

## Questions pour Eugène

1. **La porte de l'île à Villefort** (place du Bosquet), et la porte des Troupeaux du Temple qui y
   mène ? La porte du Pouget reste pour revenir.
2. **Le chien** : il n'y a pas de modèle de chien sur le PC (cheval, âne, brebis, vache, cerf,
   loup). Un chien Quaternius (CC0) à récupérer, ou je réduis `loup.glb` noir et blanc ?
3. **Ce qui manque aux lieux** (le lac et la vallée d'avant, le viaduc, Castanet, le mont Lozère et
   ses menhirs, le lasso, la poulie) : je fais avec ce qui est là, comme ci-dessus — d'accord ?
4. **La touche de la sonnaille** : `N` (libre) ? Un appui : un coup ; deux appuis rapprochés :
   deux coups.
5. **Le vers** : `SCENARIO.md` dit « le sixième morceau » ; dans l'ordre des actes, c'est le
   cinquième : « Toutes les heures seront mêlées, et la dernière sera la sienne. » — le cinquième ?
6. **La course** (le don du loup) demande le moteur (`engine.js`, interdit pendant la vague) : je
   pose `state.course` et la demande, d'accord ?

---

# Les restes de la Lozère (version 1, 7 octobre, consigne E4 de `PLAN-2026-10-07-VAGUE3.md`, à valider par Eugène)

Ce que l'acte V a laissé de côté (question 3 ci-dessus) et les quêtes secondaires de `SCENARIO.md`
§ 14. Tout se joue **après** l'acte V (`state.acte5 === 'course'`) ou en marge, jamais à sa place : les
trois bancs de l'acte V doivent toujours passer. Une instance du multi n'en voit rien (`EN_INSTANCE`).

## Ce que les relevés permettent, sans récolte réseau

L'extrait OSM local (`carte/mondes/lozere-villefort-pouget.osm`) et le relief du lac
(`relief-lozere-lac.json`, IGN 5 m, x −1690…1755, z −4655…−1630) ont ce qui manque aux trois lieux :

| ce qui manque | où il est (coordonnées du jeu) | |
|---|---|---|
| le lac de Villefort | un long lac, x −1540…1600, z −4510…−1780 | relevé |
| le barrage | (1568 ; −2704), 1,3 km au nord de Villefort | relevé |
| **le viaduc de l'Altier** (la voie des Cévennes) | x 354…449, z −2060…−1840, au-dessus d'un bras du lac | relevé |
| **la via ferrata du lac** (ponts de singe, passerelle, **une tyrolienne**) | x −400…−230, z −2000…−1915 | relevé |
| le château de Castanet | (−1329 ; −2365), 1,3 km plus à l'ouest | relevé, loin |
| le mont Lozère, ses menhirs | — | **rien** dans les relevés |

## Le fil des restes

| # | quoi | où | ce qu'il faut | ce que ça donne |
|---|---|---|---|---|
| R1 | **un lieu neuf : le lac de Villefort** (question 1) | x −420…450, z −2250…−1700 (870 × 550 m) : le bras du lac, le viaduc de l'Altier, la via ferrata | un quatrième poteau des vieux chemins (« le lac ») | le lieu de R3, R4, R6, Q4, Q5 |
| R2 | **le lasso** (question 2) | le Pouget (le berger) | la transhumance (Q2) | `state.lasso` — l'acte VI l'attend |
| R3 | **la vallée d'avant** | le lac | la sonnaille, deux coups au bord : l'eau se retire, le fond sec et ses vieux chemins, un pont de pierre noyé | la traversée à pied du bras du lac (au présent : à la nage, avec le souffle) |
| R4 | **le viaduc de 1870** | le viaduc de l'Altier | un coup : le viaduc d'aujourd'hui ; deux coups : en construction, échafaudages, la travée du milieu manquante | Q5 |
| R5 | **la tour par le dehors, et la poulie** | la Garde-Guérin | le lasso : un anneau de fer au sommet de la tour, on y monte par le mur ; la poulie : de là-haut, un câble vers Villefort (on ne glisse que vers le bas) | un retour rapide de la Garde-Guérin à Villefort |
| R6 | **la via ferrata** | le lac | le lasso (les ponts de singe : un anneau de l'autre côté), la poulie (sa tyrolienne, au-dessus du lac) | un morceau de cœur au bout |

Castanet et ses caves sous le lac : laissés (question 1). Le mont Lozère n'est pas dans les relevés : ses
menhirs vont **sur le plateau de la Garde-Guérin**, celui du combat du loup (Q3, question 3).

## Le geste du lasso, et celui de la poulie

- **Le lasso** s'accroche à ce qui est fait pour : des **anneaux de fer** scellés (le sommet de la tour, les
  rochers de la via ferrata), visibles de loin (un éclat de métal). Devant un anneau à portée (12 m),
  l'invite « lancer le lasso » : la corde file, Camille se hisse — ou se laisse descendre — jusqu'à lui, en une
  ou deux secondes. Ni balancement ni combat au lasso ici (SCENARIO les met ailleurs).
- **La poulie** (gagnée en Thaïlande, `state.poulie`) : la même tyrolienne qu'en Thaïlande (la règle :
  l'arrivée plus basse que le départ). Sans poulie, le câble ne se prend pas.
- Le geste s'écrit dans `lozere.js` ; l'acte VI (la Blessure, E1) en aura besoin aussi : **demande pour la
  passe D3** de le monter dans le moteur, pour les deux.

## Les quêtes secondaires (`SCENARIO.md` § 14)

| quête | où | quoi | récompense |
|---|---|---|---|
| **Q1. Les châtaignes** | le Pouget | ramasser vingt châtaignes sous les châtaigniers du hameau, les porter au séchoir (une clède : petite maison de pierre, la fumée par le toit — à bâtir) | une **farine de châtaigne** : en manger rend des cœurs (comme les gaufres) |
| **Q2. La transhumance** | du Pouget au plateau de la Garde-Guérin, par les vieux chemins | le berger confie le troupeau ; les brebis suivent la sonnaille ; le poteau les emmène ; sur le plateau, les mener jusqu'à l'enclos d'estive | une **sonnaille plus forte** (le passé dure 12 s au lieu de 8) ; et **le lasso** (R2), « la corde des brebis tombées » |
| **Q3. Les menhirs** | le plateau de la Garde-Guérin | onze menhirs ; deux coups devant chacun : une époque, une phrase | un **morceau de cœur** ; le onzième montre le loup endormi |
| **Q4. La pêche au lac** | le lac | pêcher à la canne (acte I) au présent ; à deux coups, dans la rivière d'avant le barrage | **la truite d'avant**, « qui n'existe plus » |
| **Q5. Le train de 1870** | le viaduc de l'Altier | à deux coups, aider les ouvriers à poser la dernière travée (trois poutres à pousser, avec la force) avant que leur époque ne s'efface | le train du présent s'arrête : **un voyage rapide** vers la porte de l'île (Villefort) |

## L'ordre du code

1. **Le lasso d'abord** (l'acte VI l'attend) : le geste, l'anneau du sommet de la tour, la tyrolienne de la
   tour vers Villefort (R5) ; la transhumance (Q2), qui donne le lasso. — 2. **Le lac** (R1) : son plan tiré
   du relevé local, son relief, ses gens ; R3, R4, R6. — 3. Q1, Q3, Q4, Q5.
Un banc par lot (`bancs/acte5-lasso.mjs`, `acte5-lac.mjs`, `acte5-quetes.mjs`), et les trois de l'acte V à
chaque lot ; les arènes de la Garde-Guérin et du Pouget au banc des rencontres.

## Questions pour Eugène (les restes)

1. **Le lac de Villefort, un lieu neuf** (x −420…450, z −2250…−1700 : le bras du lac, le viaduc, la via
   ferrata), atteint par un quatrième poteau ? Il faut deux fichiers neufs (`lac.js`, `lac.html`) et un plan
   tiré des relevés locaux (`carte/mondes/lozere-lac.json`) — **la consigne ne les prévoit pas**. Castanet
   (1,3 km plus loin) : laissé, ou un second lieu plus tard ?
2. **Qui donne le lasso** : je propose **le berger**, sa « corde des brebis tombées », au retour de la
   transhumance (personne de nouveau). Ou un muletier de la Régordane à l'auberge de la Garde-Guérin
   (quelqu'un de nouveau) ? Si E1 en a besoin vite, il peut venir avant, sans la transhumance.
3. **Les menhirs sur le plateau de la Garde-Guérin** (le mont Lozère n'est pas dans les relevés) : d'accord ?
   Et leurs onze époques : une liste dans `DIALOGUES-ACTE5.md`, à relire.
4. **La tyrolienne de la tour vers Villefort** traverse 4 km entre deux lieux : on glisse quelques secondes,
   puis un fondu, et l'on arrive à Villefort. D'accord ?

## Réponses d'Eugène (7 octobre)

Tout est accepté : le lac de Villefort, lieu neuf (`lac.js`, `lac.html`, à créer) ; Castanet laissé ; **le
lasso donné par le berger**, au retour de la transhumance ; les menhirs sur le plateau de la Garde-Guérin ;
la tyrolienne de la tour vers Villefort (la glisse, un fondu, Villefort).
