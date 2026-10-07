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
