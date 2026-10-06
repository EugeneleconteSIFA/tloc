# L'acte III — découpage en étapes jouables (version 1, 6 octobre, à valider par Eugène)

L'acte III de `STORY.md` (« ACTE III — THAÏLANDE, la Cloche des Îles »), qui fait foi, découpé en
étapes qu'on peut jouer, vérifier et publier une à une, **dans la baie telle qu'elle est**
(`thailande.js`, resserrée le 4 octobre). Le détail vient de `SCENARIO.md` § 12 ; les répliques
iront dans `DIALOGUES-ACTE3.md` une fois ce découpage validé.

## Ce qui existe déjà (inventaire du 6 octobre)

| lieu | position | ce qu'il y a |
|---|---|---|
| **Ko Panyi** | porte (61,5 ; −71,9), départ (104 ; 10) | le village sur pilotis, le marché flottant et ses marchandes, la mosquée, **Nok** devant l'arche (70 ; −62), qui donne **le gong** (K : six secondes de temps rendu dans 16 m) ; des habitants et des enfants figés, chacun une phrase coupée ; le ponton de **Somsak** (118 ; 7,5) |
| **Khao Phing Kan** | quai (−701 ; 551) | les pitons, Ko Tapu dans l'eau, la barque de **Mali**, une vendeuse figée |
| **le grand piton** (Wat Tham Suea) | grève (985 ; 491), plateau 110–119 m | l'escalier des moines (le replat, l'esplanade), le chedi doré, **l'enquête de la clé** (trois moines aux phrases coupées vers (925 ; 282), trois balayeurs dans la cour du puits (915 ; 334), un seul a la clé dans la manche gauche) ; la barque du **passeur muet** à la grève ; un câble vers le marché flottant |
| **Railay** | quai (−657 ; 1530), village (−500 ; 1700) | les falaises, le village, un sentier jusqu'au câble (−587 ; 1920) qui redescend à la plage |
| **Ton Sai (Phi Phi)** | quai (2187 ; 1927), village (2350 ; 1820) | l'escalier des moines derrière le village, le belvédère (2605 ; 1790) et **le câble vers le grand piton** |
| partout | — | la pluie suspendue (elle tombe au gong), des pêcheurs dans leurs barques qui disent où l'on est ; les cinq barques vont **partout, librement** ; les trois câbles sont libres (pas encore de poulie à gagner) |

Ce qui n'existe pas : un avancement (`state.acte3`), des trajets à rétablir, la poulie, le cloître
bâti, les masques, la grotte de Railay, la corniche des vents, le Yak, la Cloche des Îles, la fin.

## Ce que je propose de garder, et de laisser

**Gardé** (STORY.md) : Nok et le gong ; Somsak, Mali, le passeur muet, et leurs **trajets rétablis un
à un** ; les cinq usages du gong ; le Yak, son rythme, le morceau, **son souffle**, l'écume, « **Tu
sonnes pour lui.** » ; la course des longues barques **en fête**, à la fin.

**De SCENARIO.md, gardé** : l'enquête du cloître (elle est faite), la poulie du moine cuisinier, le
masque du passeur muet et la salle des masques (bombes, lanterne), la corniche des vents et le masque
de Hanuman, la tyrolienne qui ne descend que vers le bas.

**Laissé** (sans lieu dans la baie resserrée, ou un système entier à bâtir) : le lasso et les ponts
de corde (le lasso a été laissé à l'acte II), les gouttes de pluie qui servent de marches, les
cent-huit clochettes, les guirlandes, les quatre masques facultatifs. Questions en fin de fichier.

**Les îles de SCENARIO.md, posées sur la baie réelle** :
- l'île de la porte → **Ko Panyi** ;
- l'île du cloître → **la colline des moines de Ton Sai** (le belvédère, l'escalier des moines) :
  le cloître et sa poulie sont au départ du câble du grand piton, ce qui donne son sens à la
  poulie. L'enquête de la clé y **déménage** (elle est sur le grand piton « provisoirement », dit
  le code) ;
- l'île de la cascade → **Khao Phing Kan** (Mali, la statue, **la force** du Dormeur) ;
- l'île des masques → **Railay** (une grotte dans la falaise : à bâtir) ;
- la corniche des vents → **le belvédère de Ton Sai**, au départ du câble ;
- le grand piton → **le grand piton** : le plateau, le temple, le Yak.

On part de : le prologue, l'acte I et l'acte II passés (`state.acte2 === 'pluie'`). Camille a l'épée,
l'arc, la lanterne, la canne, les bombes, **la force**. Elle arrive par la porte des Îles (61,5 ; −71,9).

## Le fil, en une phrase par étape

| # | étape (`state.acte3`) | ce qui bloque | ce que Camille gagne | où | qui |
|---|---|---|---|---|---|
| 1 | `gong` — la baie figée | rien ne bouge ; les passeurs ne vont plus nulle part | **le gong** ; le premier trajet : Somsak, vers Ton Sai | Ko Panyi : la porte, Nok (70 ; −62), le ponton (118 ; 7,5) | Nok, Somsak |
| 2 | `cloitre` — la clé du cloître | la porte du cloître ; quel moine a la clé ? | **la clé**, puis **la poulie** (le moine cuisinier) et **le masque de bois** | Ton Sai : l'escalier des moines, le cloître et la cour du puits, au belvédère (≈ 2600 ; 1790) | trois moines, trois balayeurs, le moine cuisinier |
| 3 | `mali` — le deuxième trajet | Somsak ne va pas aux pitons ; Mali ne parle qu'à qui la bat | Mali reprend la mer : Khao Phing Kan ↔ Ko Panyi ↔ Ton Sai | Khao Phing Kan (−701 ; 551) ; la statue de la montée, la cascade figée | Mali, Somsak |
| 4 | `masques` — le troisième trajet | le passeur muet n'emmène que qui lui montre un masque | le muet vers Railay ; dans la grotte, **le masque de Hanuman** | la grève du grand piton (985 ; 491) → Railay : la grotte des masques, mur fendu (bombes), salle noire (lanterne) | le passeur muet |
| 5 | `corniche` — la corniche des vents | la mousson jette dans le vide au bord du belvédère | le câble vers le grand piton | Ton Sai, le belvédère (2605 ; 1790) → le plateau du grand piton (915 ; 362) | — |
| 6 | `yak` — le Yak figé | ses coups arrivent avant qu'on les voie | le morceau de la Grande Cloche ; **le souffle** | le plateau du grand piton, devant le temple | le Yak, Phinaert absent |
| 7 | `fete` — la pluie tombe | — | la Cloche des Îles, le troisième vers, la course des barques en fête, le retour | toute la baie, puis la porte | Nok, Somsak, Mali, le muet, les moines |

**Durée visée : 35 à 40 min en allant vite** (SCENARIO dit ~40). 1 : 3 min ; 2 : 8 ; 3 : 6 ; 4 : 7 ;
5 : 3 ; 6 : 6 ; 7 : 4.

## Les étapes, une à une

### 1. La baie figée (`gong`)

- **On arrive dans la grotte de la porte.** La pluie en l'air (elle y est), le plan d'arrivée
  (il y est).
- **Nok** donne le gong (c'est fait). Elle dit, en plus : les passeurs ne se parlent plus depuis
  que tout s'est arrêté ; chacun reste à son ponton.
- **Les barques ne vont plus partout.** Aujourd'hui elles vont toutes partout : il faut une table
  des trajets ouverts (`state.trajets`), qui grandit à chaque étape. Au départ : **Somsak, Ko Panyi
  ↔ Ton Sai, contre des écus** (SCENARIO) — « je conduisais les moines chaque matin ; depuis, plus
  personne ne descend de la colline ».
- **Le gong** sert une première fois sur un habitant figé de Ko Panyi (une phrase finie : ils y
  sont déjà).

**Fini quand** : on a le gong et l'on débarque à Ton Sai. **Se vérifie** : `bancs/acte3-baie.mjs`,
la porte → Nok → K près d'un figé → Somsak → Ton Sai ; une barque vers une île fermée refuse.

### 2. La clé du cloître (`cloitre`)

- **L'escalier des moines** de Ton Sai mène au belvédère. On y **bâtit le cloître** : un mur
  d'enceinte bas, une porte fermée, une cour du puits, la cuisine (une petite salle, le moine
  cuisinier figé au-dessus d'une marmite).
- **L'enquête déménage du grand piton** : les trois moines aux phrases coupées sur l'escalier, les
  trois balayeurs dans la cour du puits **devant** la porte (on la voit, on ne l'ouvre pas). Les
  répliques sont celles du code et de SCENARIO.
- **Le gong fait tomber la clé** (usage : « faire tomber une clé »). La porte s'ouvre.
- **Le moine cuisinier**, ranimé, **finit son geste** (« terminer une action » : il pose la marmite)
  et donne **la poulie** : « On ne monte pas mille marches pour les redescendre à pied. »
- **Le masque de bois** (le premier masque, SCENARIO) est accroché dans la cour : on le prend.
- Sans la poulie, plus aucun câble ne se prend (aujourd'hui ils sont libres).

**Fini quand** : on a la poulie et le masque. Somsak, en redescendant : « Les moines… ils sont
toujours là-haut ? » — il ouvre le deuxième trajet : **Ko Panyi ↔ Khao Phing Kan**, « là où ma
petite-fille s'est arrêtée ». **Se vérifie** : `bancs/acte3-cloitre.mjs`.

### 3. Mali (`mali`)

- **Khao Phing Kan** : Mali, debout dans sa barque. Elle n'aime pas rester près des pitons ; son
  prix, dans SCENARIO, est **une course à la rame autour du marché**. (Question 1 : le jeu n'a pas
  de barque qu'on mène.)
- **La statue** : la montée de Khao Phing Kan est fermée par une statue de pierre tombée en
  travers ; **la force** la pousse (comme le bloc de l'acte II).
- **La cascade figée** en haut : le gong la remet en marche (« une chose suspendue tombe ») ; elle
  emporte une barque coincée, ou dégage le passage — ce qu'elle débloque est la question 2.
- Mali vaincue (ou aidée) **reprend la mer** : ses trajets s'ouvrent (Khao Phing Kan ↔ Ko Panyi ↔
  Ton Sai) ; elle dit où est le passeur muet : à la grève du grand piton, il n'en bouge plus.

**Fini quand** : Mali navigue ; le muet est sur la carte. **Se vérifie** : `bancs/acte3-mali.mjs`.

### 4. Le passeur muet et les masques (`masques`)

- **Le muet** à la grève du grand piton (on y va avec Mali). Il ne dit rien ; on lui **montre le
  masque de bois** : il hoche la tête et emmène à **Railay**.
- **La grotte des masques**, dans la falaise de Railay (à bâtir : une entrée, une salle) : **un mur
  fendu** (une bombe), puis **une salle noire** (la lanterne). Au fond, sur un présentoir, **le masque
  de Hanuman**, le roi singe.
- Un combat dans la salle : des ennemis **figés, donc invincibles** ; le gong les **remet en
  mouvement** quelques secondes pour qu'on les frappe (usage : « remettre un ennemi en
  mouvement »).

**Fini quand** : on a le masque de Hanuman ; le muet ouvre ses trajets (Railay ↔ grand piton ↔ Ton
Sai). **Se vérifie** : `bancs/acte3-masques.mjs`.

### 5. La corniche des vents (`corniche`)

- Au belvédère de Ton Sai, au départ du câble, **la mousson** : un vent qui pousse Camille vers le
  vide dès qu'elle approche du câble (une poussée de côté, de plus en plus forte ; elle tombe,
  revient au dernier palier, perd un cœur).
- **Le masque de Hanuman** porté : le vent ne la pousse plus (« il est roi des vents »).
- La poulie, le câble : **le grand piton**, le plateau (915 ; 362).

**Fini quand** : on est sur le plateau. **Se vérifie** : `bancs/acte3-yak.mjs` (première partie).

### 6. Le Yak (`yak`)

- **Devant la porte vide du temple** du plateau, dans la pluie figée. Le Yak : un géant gardien
  (≈ 6 m, faïence et verre colorés, une épée), le morceau de cloche **planté au front**. Phinaert
  n'est pas là.
- **Hors du temps** : ses coups arrivent avant qu'on les voie (une attaque sans élan, impossible à
  esquiver sans le gong). **Le gong met Camille à son rythme** six secondes : ses coups ralentissent,
  on voit l'élan ; on frappe le morceau (à l'arc, ou à l'épée quand il se penche).
- Entre deux, il **fige des paquets de pluie** et les lance comme des pierres.
- Trois touches au morceau. Il tombe à genoux.

**Fini quand** : le morceau est retiré. **Se vérifie** : `bancs/acte3-yak.mjs`.

### 7. La pluie tombe (`fete`)

- Le Yak retourne devant sa porte, plante son épée, donne **son souffle** (`state.souffle` : nager
  en eau profonde ; dans la baie, la mer ne bloque plus), dit « **Tu sonnes pour lui.** », **devient
  écume**.
- **La pluie tombe d'un coup** sur toute la baie (la pluie suspendue part), les figés reprennent,
  les clochettes du chedi tintent, le gong sonne seul. Nok : « Ce que tu as commencé… » (elle ne
  finit pas).
- **La Cloche des Îles** descend du toit du temple : haute, fine, bronze clair couvert de feuilles
  d'or, sans battant (`DECISIONS-RECIT.md` § 2) ; le troisième morceau de la Grande Cloche, et le
  **troisième vers** dessous : « **Chaque géant donnera ce qu'il est, et ne le reprendra pas.** »
- **La course des longues barques** devient une fête : en redescendant (le câble du marché), les
  barques des trois passeurs et des pêcheurs font la course autour du marché, puis une haie
  jusqu'à la porte. Une cinématique, pas une épreuve.
- Le retour au Temple (la cloche des Îles au deuxième étage, l'eau des rigoles qui coule vers le
  haut, la pluie très loin) : **dans temple.js, qui n'est pas à moi** → PROMPT-REPRISE.md.

**Se vérifie** : `bancs/acte3-fin.mjs`, et l'acte de bout en bout (`bancs/acte3-tout.mjs`).

## Le journal

`G.level.indices` (comme `aveyron.js`) : un carnet par étape — « Somsak va à Ton Sai, contre des
écus » ; les trois bouts de phrase ; « la clé est dans la manche gauche » ; « Mali sait où est le
muet » ; « le muet n'emmène que qui lui montre un masque » ; « le vent du belvédère »…

## Une instance ne déclenche pas l'histoire

L'arène de Ko Panyi (repliée de `thailande-arene.js` dans `thailande.js`, consigne C2 point 3) : en
instance, ni `state.acte3`, ni trajets fermés, ni Nok qui parle de l'histoire.

## L'ordre du code

D'abord **le repli de l'arène** (petit, indépendant, vérifié au banc des rencontres). Puis les étapes
1 à 7 dans l'ordre, chacune jouée en headless et publiée.

## Questions pour Eugène

1. **La course de Mali** (« la battre à la rame autour du marché ») : le jeu n'a pas de barque
   qu'on mène. Trois choix : (a) une vraie course en barque (un nouveau mode de déplacement : le
   plus long) ; (b) une course **à pied**, de passerelle en passerelle autour du marché, Mali en
   barque à côté ; (c) pas de course : Mali repart quand Camille a ouvert la montée (la statue, la
   cascade) — elle « n'aime pas rester près des pitons » parce qu'ils sont figés. Je propose **(b)**.
2. **La cascade de Khao Phing Kan** : il n'y en a pas encore (la carte n'a que les pitons). Je la
   bâtis (une chute figée sur la falaise, qui repart au gong) — mais pour débloquer quoi ? Je
   propose : **elle porte Camille jusqu'à une corniche** où la barque de Mali est restée coincée
   depuis l'arrêt du temps (c'est pour ça que Mali ne navigue plus). La raison est inventée : à toi
   de dire oui.
3. **Le cloître à Ton Sai** plutôt que sur le grand piton : d'accord ? (Les moines, l'escalier et le
   câble y sont déjà ; le grand piton garde le Yak seul.)
4. **Le souffle** : en Thaïlande, nager en eau profonde change peu (on passe déjà en barque). Je le
   donne à la fin, sans qu'il serve dans l'acte ; il servira ailleurs (SCENARIO § 17). D'accord ?
5. **Le Yak** : il n'y a pas de géant de 6 m modélisé. Je le compose en primitives habillées Poly
   Haven (faïence, verre coloré, or) — pas d'aplats — ou tu as un modèle en tête ?

## Réponses d'Eugène (6 octobre)

1. **La course de Mali : une vraie course en barque** (« ça me plaît, on développe ça »). Camille
   mène une longue barque (un mode de déplacement nouveau, dans thailande.js) ; la course fait le
   tour du marché flottant, contre Mali. La même barque sert à la fête de la fin.
2. La cascade qui porte Camille jusqu'à la barque coincée de Mali : oui.
3. Le cloître à Ton Sai : oui.
4. Le souffle donné sans servir dans l'acte : oui.
5. Le Yak composé en volumes habillés Poly Haven : oui.
