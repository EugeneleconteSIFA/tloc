# L'acte II — découpage en étapes jouables (version 1, 6 octobre, à valider par Eugène)

L'acte II de `STORY.md` (« ACTE II — AVEYRON, la Cloche du Midi »), qui fait foi, découpé en
étapes qu'on peut jouer, vérifier et publier une à une, **dans le lieu tel qu'il est** : le lac de
Saint-Gervais resserré (810 × 820 m, x −290 à 520, z −350 à 470), les trois maisons Roquette où
l'on entre, le barrage, la source des Vergnes, la fontaine, les hameaux de Perpignou et
Fariboules. Le détail vient de `SCENARIO.md` § 11 ; les répliques, de `DIALOGUES-ACTE2.md`.

**Ce que je laisse de côté** (dans `SCENARIO.md`, pas dans `STORY.md`, et sans lieu dans la carte
resserrée) : les rênes et le cheval sauvage, le lasso et le petit frère, le village abandonné, les
gorges, la gare du causse, la mine d'argent en donjon complet, la chaleur qui coûte des cœurs. Le
Dormeur garde son cœur et son combat, dans une seule grande cave (étape 7). Questions en fin de
fichier.

On part de : le prologue et l'acte I passés (`state.acte1 === 'temple'`), Camille arrive par la
porte de l'île (−126 ; 146), à côté du Batut. Elle a l'épée, l'arc, la lanterne, la canne, les
bombes.

## Le fil, en une phrase par étape

| # | étape (`state.acte2`) | ce qui bloque | ce que Camille gagne | où (position du jeu) | qui |
|---|---|---|---|---|---|
| 1 | `guerre` — la guerre de l'eau | on tire sur quiconque approche du lac ; chacun accuse l'autre | le premier fil : « parle au maître de Beauregard » | la porte (−126 ; 146), le Batut (−135 ; 170), le ponton, Beauregard (400 ; 150) | le cavalier du Batut, le cavalier de Beauregard, le pêcheur |
| 2 | `guerre` → `temoins` — les trois témoins | personne ne croit l'autre maison | **qui** : un homme du Batut pris près de l'abreuvoir ; **comment** : des fers marqués d'une étoile ; **où** : la piste part de l'abreuvoir de Beauregard | le maître dans la grande salle de Beauregard ; le prisonnier dans la cave de Beauregard ; le forgeron à Fariboules (283 ; 12) | le maître de Beauregard, le prisonnier du Batut, le forgeron Roquette |
| 3 | `temoins` → `traces` — suivre l'étoile | les traces ne se voient que de près | le chemin jusqu'à l'enclos caché | de l'abreuvoir de Beauregard, le long de la rive est, jusqu'au bois au-dessus de la source des Vergnes (≈ 440 ; 400) | — (les empreintes) |
| 4 | `traces` → `preuve` — les troupeaux cachés | trois brigands de la bande gardent l'enclos | **la preuve** : les bêtes des DEUX maisons ensemble ; les deux colliers marqués | l'enclos caché (≈ 440 ; 400) | la bande à Phinaert |
| 5 | `preuve` → `duel` — le duel du lac | les deux maisons doivent voir la preuve ; le bras droit de Jacques défie Camille | la fin de la guerre | le Batut, Beauregard, puis le barrage (−222 ; −75), à midi (il est toujours midi) | les deux maîtres ; le bras droit de Jacques ; Jacques le Noir s'enfuit vers l'ouest |
| 6 | `duel` → `familles` — chez l'aïeule | — | le premier repas des deux branches ; le chemin du Dormeur | la grande maison du Pouget (185 ; −315), la salle à manger | l'aïeule, les deux maîtres |
| 7 | `familles` → `dormeur` — le cœur du Dormeur | la faille murée par la bande ; le morceau de cloche planté dans le cœur | le morceau de la Grande Cloche ; le deuxième vers | la faille de l'ouest, au bout du barrage (≈ −275 ; −110) → la cave du Dormeur | Jacques le Noir, Phinaert (qui regarde) |
| 8 | `dormeur` → `pluie` — la pluie | — | **la force** ; la Cloche du Midi ; la pluie ; le retour au Temple | la cave, puis tout le lac, puis le Pouget, puis la porte | le Dormeur, l'aïeule, toutes les maisons |

**Durée visée** : 25 à 30 min en allant vite (l'acte I en fait 58 ; sans mine ni objets nouveaux,
l'acte II est plus court). 1 : 3 min ; 2 : 7 ; 3–4 : 6 ; 5 : 4 ; 6 : 2 ; 7 : 6 ; 8 : 3.

## Les étapes, une à une

### 1. La guerre de l'eau (`guerre`)

- **On arrive à côté du Batut.** Le cavalier du Batut (déjà là, −135 ; 170) : Beauregard prend
  les bêtes. Le cavalier de Beauregard (déjà là, 400 ; 150) : le Batut garde l'eau.
- **On ne s'approche pas du lac.** Sur le ponton et le barrage, un Roquette armé de chaque
  maison : un coup de fusil en l'air, Camille est repoussée de quelques mètres et un mot
  s'affiche (« Pas un pas de plus vers l'eau ! »). Pas de dégâts : c'est un avertissement.
  Le barrage reste fermé jusqu'au duel (étape 5).
- **Le fil** : le cavalier du Batut dit « demande donc à Beauregard ce qu'ils ont fait de notre
  homme » ; celui de Beauregard renvoie à son maître, dans la grande salle.
- **Le journal (J)** et le point d'or de la carte montrent le prochain témoin connu, comme à
  Lille.

**Fini quand** : on a parlé aux deux cavaliers ; le maître de Beauregard est sur la carte.

### 2. Les trois témoins (`SCENARIO.md` § 7 : chaque maison accuse, le troisième tranche)

| témoin | où | ce qu'il donne | le fil vers |
|---|---|---|---|
| le maître de Beauregard | la grande salle de Beauregard, au rez-de-chaussée | « on a trouvé leurs traces à notre abreuvoir ; on en a pris un, il est en bas » | le prisonnier |
| le prisonnier, un Roquette du Batut | la cave de Beauregard (sous la vis ; à bâtir : une pièce basse, une porte à barreaux) | « des cavaliers ; **leurs chevaux ont des fers marqués d'une étoile** ; le forgeron les connaît » | le forgeron |
| le forgeron Roquette | une forge à Fariboules (283 ; 12 : à bâtir, un appentis, l'enclume, le foyer éteint faute de charbon… ou d'eau pour tremper) | « c'est moi qui les fais, pour mon cousin **Jacques** ; **suivez l'étoile dans la poussière**, à l'abreuvoir de Beauregard » | les traces |

`STORY.md` dit « prisonnier du Batut » ; `SCENARIO.md` le met chez le bailli, qui n'est pas dans
la carte. Je le mets **dans la cave de Beauregard** : c'est Beauregard qui l'a pris, et ça
donne une raison d'entrer dans la maison (question 2).

Chaque indice en gras s'écrit au journal (`G.level.indices`).

### 3. Suivre l'étoile (`traces`)

Des empreintes de fers à étoile (des décalques au sol, de petits groupes tous les 6 à 10 m) de
l'abreuvoir de Beauregard (à poser, dans sa cour) jusqu'au bois au-dessus de la source des
Vergnes. Elles ne se voient qu'à 12 m (un `visible` selon la distance), pour qu'on marche le nez
au sol. Elles n'existent qu'à partir de `temoins`. Un mot de Camille à la première (« Une étoile.
»).

### 4. Les troupeaux cachés (`preuve`)

- **L'enclos** : une clairière dans le bois, un parc de claies, une vingtaine de brebis
  (celles de `troupeaux()` déjà chargées), avec **deux marques** : un trait rouge (le Batut) et
  un trait bleu (Beauregard) sur la laine. On le voit avant d'y entrer.
- **Trois brigands de la bande** (créatures de `KINDS`, complétées depuis aveyron.js : des
  hommes au chapeau, au gourdin ou au fusil) : on se bat à l'épée et à l'arc, comme les
  soldats de la citadelle.
- **La preuve** : sur un piquet, les deux colliers de sonnaille, l'un du Batut, l'autre de
  Beauregard (« Les bêtes des deux maisons. Ensemble. »). Ils vont dans la poche.

### 5. Le duel du lac (`duel`)

- On montre les colliers aux deux maîtres (le cavalier du Batut fait office de maître du
  Batut ; question 3). Chacun reconnaît le sien. Les gardes du ponton et du barrage s'écartent.
- **Au barrage**, sur la crête (le lieu du duel, −222 ; −75) : le bras droit de Jacques attend.
  Un duel à l'épée, en un contre un, la caméra serrée ; les deux maisons regardent de chaque
  bout. Vaincu, il dit qui l'envoie ; **Jacques le Noir** est vu au loin, à cheval, filant vers
  l'ouest, vers le Dormeur.
- **Fini quand** : le bras droit est à terre ; la guerre est finie.

### 6. Chez l'aïeule (`familles`)

- Les deux maîtres sont à la table du Pouget, de chaque côté de l'aïeule. Ils ne se regardent
  pas encore. L'aïeule dit le Dormeur : la falaise à l'ouest, en géant couché, qui ne respire
  plus ; le passage de la bande, au bout du barrage.
- Ce n'est pas encore le repas : il viendra avec la pluie (étape 8).

### 7. Le cœur du Dormeur (`dormeur`)

- **Le Dormeur se voit de partout** : la falaise du mur de l'ouest (−2 592 ; −501, dans les
  environs), son profil de géant couché. Il est à 2,6 km, hors de la zone : on n'y marche pas.
- **La faille** : au bout du barrage, au pied de la pente de l'ouest (≈ −275 ; −110), une fente
  dans la roche murée de pierres par la bande. Une bombe l'ouvre. On entre : la cave est bâtie
  dans aveyron.js, sous le relief, comme les intérieurs des maisons (« les galeries sont creusées
  dans le corps du géant »).
- **La cave** : une galerie qui descend (la lanterne y sert), des fentes où l'air ne souffle
  plus, des parois de plus en plus comme de la chair de pierre ; Jacques le Noir et deux
  brigands à l'entrée de la grande salle.
- **Le cœur** : un cœur de roche qui bat, le morceau planté dedans. Les mains de pierre sortent
  des murs pour frapper ; les veines rouges qui nourrissent le morceau sautent à la bombe ; on
  frappe le cœur à l'épée. Trois fois.
- **Phinaert** est là, derrière, et regarde. Le morceau se brise : il fige Camille deux secondes
  et part. Jacques, à terre : « Le patron a dit de pas te tuer. Il a dit que t'avais du travail. »
- Sur la paroi : **le deuxième vers** — « Une gardienne sonnera les cloches, et chaque cloche le
  servira. »

### 8. La pluie (`pluie`)

- **Le Dormeur parle**, une seule fois, et donne **sa force** (`state.force` : pousser et
  soulever les gros blocs ; dans l'acte II, un bloc devant la sortie de la cave pour l'essayer
  tout de suite). Il redevient falaise. Les fentes soufflent. **La Cloche du Midi** sort de la
  roche (`DECISIONS-RECIT.md` § 2 : cloche de ferme trapue, fer rouillé), avec le morceau.
- **Dehors** : le soleil descend pour la première fois (le soleil et le ciel du soir), des
  nuages de l'ouest, **la pluie** (des traits de pluie autour de Camille, pas sur toute la
  carte), le lac remonte d'un mètre (l'eau du lac relevée), la pelouse du Pouget reverdit la
  première.
- **Au Pouget**, le repas : les deux maîtres, les cavaliers, le forgeron, le prisonnier libéré,
  l'aïeule — tous les Roquette, sauf Jacques. L'aïeule : « Ce que tu as commencé, finis-le. Le
  géant a donné sa vie pour ça. »
- **La porte de l'île** ramène au Temple : la cloche pendue et la révélation sont dans
  `temple.js` (demande dans `PROMPT-REPRISE.md`).

## Comment chaque étape se vérifie

Un banc par étape, `bancs/acte2-<étape>.mjs`, comme `bancs/acte1-*.mjs` : l'état de départ posé
(`state.acte1 = 'temple'`, `state.acte2 = …`), la partie jouée en headless jusqu'au bout de
l'étape (marcher, parler, se battre, ramasser), une capture par moment clé dans
`bancs/resultats/acte2-<étape>-<date>-*.jpg`, aucune `pageerror`. Le chargement du lieu
(`bancs/lieu-aveyron.mjs`) avant et après chaque lot : rien de nouveau au-delà de 300 ms, les
gens nouveaux et la cave nés après le chargement.

## L'ordre du code (une étape publiée à la fois)

A. Étapes 1 et 2 (l'état, le journal, les gardes du lac, le maître, la cave de Beauregard, la
forge). — B. Étapes 3, 4, 5 (traces, enclos, duel). — C. Étapes 6, 7, 8 (l'aïeule, la cave du
Dormeur, la pluie). Les grandes quêtes secondaires après, découpées seulement.

## Questions pour Eugène

1. **Le Dormeur** : une cave bâtie dans aveyron.js, entrée par une faille au bout du barrage —
   d'accord ? (la vraie falaise est à 2,6 km, hors de la zone.)
2. **Le prisonnier** dans la cave de Beauregard (pas de bailli dans la carte) ?
3. **Les noms** : le maître de Beauregard, le maître du Batut, le forgeron, le bras droit de
   Jacques — je ne les invente pas. Des noms, ou « le maître de Beauregard », « le bras droit » ?
4. **Les rênes, le lasso, la mine** (`SCENARIO.md`, pas `STORY.md`) : on les laisse de côté
   comme je le propose ?
5. **La force** essayée tout de suite sur un bloc à la sortie de la cave ?

---

# Les grandes quêtes secondaires de l'acte II (version 1, 6 octobre, à valider par Eugène)

`STORY.md` en nomme quatre : **la course des maisons**, **l'arbre des Roquette**, **les sources**,
**le train** — « elles doivent donner une vie à l'Aveyron après la quête principale ». Elles
s'ouvrent donc à l'étape `pluie` (l'histoire finie, la pluie revenue), et chacune se joue seule,
dans l'ordre qu'on veut. `SCENARIO.md` en ajoute deux (les avis de recherche, la belote de
l'auberge) : l'auberge et le bailli ne sont pas dans la carte resserrée, je les laisse de côté.

L'avancement : `state.q2` (`{ sources: 0..3, arbre: [...], train: 0..3, course: 0..3 }`), le
carnet du journal comme pour l'histoire. Durée visée : 5 à 8 minutes chacune.

## Le fil

| quête | qui la donne | ce qu'on fait | où (position du jeu) | ce qu'on gagne | ce qui manque |
|---|---|---|---|---|---|
| **Les sources** | la femme à la fontaine (« Moi, je n'y crois pas ») | rouvrir trois sources bouchées par la bande : à la bombe, à la force | la source des Vergnes (470 ; 440), la fontaine du lac (−269 ; −339), le puits de Perpignou (≈ 460 ; −230) | trois points d'eau où l'on boit (B) ; un ruisseau qui coule de nouveau | rien |
| **L'arbre des Roquette** | l'aïeule, au repas | retrouver huit Roquette dispersés par la guerre, leur demander leur maison, les renvoyer chez eux | toute la carte | un morceau de cœur ; l'arbre de famille peint au mur du Pouget | les **noms** (question 1) |
| **Le train** | le colporteur (« la paie du train de Saint-Gervais a été volée ») | retrouver la paie, cachée en trois endroits par la bande | l'enclos caché, une barque échouée, la maisonnette de la vanne | des écus | **pas de voie ferrée** dans la carte (question 2) |
| **La course des maisons** | un vieux Roquette, assis à l'ombre à Fariboules (pas d'auberge) | la course à cheval de Beauregard au Batut par la rive sud, contre le cavalier de Beauregard ; la gagner fait parler le vieux | Beauregard (400 ; 150) → le Batut (−135 ; 170), des portes de passage sur la route du lac | une selle plus rapide ; la vérité sur la course d'autrefois | **monter à cheval en solo** (question 3) et **ce que dit le vieux** (question 4) |

## Les quêtes, une à une

### Les sources (la plus simple : tout ce qu'il faut est là)

- **La source des Vergnes** : sa bouche est murée de pierres entassées (déjà montrée en jeu) → une
  bombe posée, comme la faille. L'eau sort : une nappe qui coule vers le lac (le ruisseau des Vergnes).
- **La fontaine du lac** : un gros bloc roulé dans le bassin par la bande → la **force** du Dormeur
  (pousser le bloc), comme à la sortie de la cave.
- **Le puits de Perpignou** (« ne donne plus que de la vase ») : le seau coincé au fond sous des
  pierres → une bombe dans le puits, puis on remonte le seau.
- Chaque source rouverte : un point où boire (B), la réplique de ses voisins qui change, une ligne
  au carnet. Les trois : la femme à la fontaine remercie, `state.q2.sources = 3`.
- **Se vérifie** : `bancs/acte2-sources.mjs` (les trois rouvertes, l'eau visible, boire possible).

### L'arbre des Roquette

- L'aïeule, au repas : « Ils sont tous partis à cause de cette guerre. Ramène-les-moi. » Elle donne
  une liste de huit, par maison (trois du Batut, trois de Beauregard, deux du Pouget).
- Les huit sont posés hors de chez eux : à Perpignou, à Fariboules, au barrage, sur la grève, au bout
  du ponton… On leur parle : ils disent qui ils sont et pourquoi ils sont partis (une réplique
  chacun). « Rentre chez toi » : ils repartent vers leur maison (marche, puis on les retrouve dans la
  cour).
- Les huit rentrés : l'arbre de famille, peint au mur de la salle à manger du Pouget, un **morceau de
  cœur**.
- **Se vérifie** : `bancs/acte2-arbre.mjs`.

### Le train

- Le colporteur, qui descend de Saint-Gervais : la paie des ouvriers de la voie a été volée dans le
  train, la bande l'a partagée en trois.
- Trois caches dans le lieu tel qu'il est : sous la paille de l'enclos caché, sous une barque échouée
  (qu'on soulève avec la force), derrière la maisonnette de la vanne. Chaque cache : une bourse.
- Rapportées au colporteur : des écus (l'économie existante).
- **Se vérifie** : `bancs/acte2-train.mjs`.

### La course des maisons

- Le vieux Roquette de Fariboules : la réplique de `SCENARIO.md` (« Moi, j'y étais. Et je te dirai
  rien »), puis « le jour où quelqu'un refera la course, je parlerai ».
- Le cavalier de Beauregard prête un cheval ; départ devant Beauregard, des portes de passage le long
  de la rive sud jusqu'au Batut ; le cavalier court contre Camille (un chemin suivi à vitesse fixe,
  un peu moins vite qu'un cheval au galop).
- Gagnée : une selle plus rapide ; le vieux parle enfin.
- **Se vérifie** : `bancs/acte2-course.mjs`.

## L'ordre du code

Les sources d'abord (rien ne manque), puis le train (si la question 2 est tranchée), l'arbre (avec
les noms), la course (avec le cheval et la réplique du vieux).

## Questions pour Eugène

1. **L'arbre des Roquette** : un arbre de famille sans prénoms se lit mal. Tu me donnes huit prénoms
   (ou les vrais Roquette que tu veux y voir), ou je garde des fonctions (« le fils cadet du Batut ») ?
2. **Le train** : il n'y a pas de voie ferrée dans la zone du lac. Le colporteur qui en parle, et
   des caches dans le lieu, ça te va ? Ou faut-il une gare au bord de la zone ?
3. **La course** : on ne monte à cheval qu'en multi (`tloc-multi.js`, à C7 pendant cette vague). Il
   faut un « monter à cheval » du solo — à demander pour engine.js ou tloc-multi.js. Je la garde pour
   après la vague ?
4. **La course d'autrefois** : qui avait gagné, et ce que dit le vieux, c'est à écrire avec toi
   (`SCENARIO.md`).
