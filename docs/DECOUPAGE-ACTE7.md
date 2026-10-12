# L'acte VII — découpage en étapes jouables (version 1, 12 octobre) — **validé par Eugène le 12 octobre**

L'acte VII de `STORY.md` (« Le final — le temps arrêté »), qui fait foi, découpé en étapes qu'on peut jouer,
vérifier et publier une à une, sur le modèle des actes I à VI. Le détail vient de `SCENARIO.md` § 5 et § 16 ;
les répliques sont dans `DIALOGUES-ACTE7.md`. On part de la fin de l'acte VI : la Grande Cloche fondue par
maître Cornil, neuve, pas encore sonnée (`state.acte6 === 'cloche'`, `state.grandeCloche`). L'acte finit sur le
noir, après la botte de blé posée devant Lydéric.

**Décidé par Eugène (12 octobre)** : à la fin, au pont de Fin, **Eugène tient la porte** entrouverte, le temps
que Camille repousse Phinaert de l'autre côté ; puis ils la ferment à deux.

**Ce qui existe déjà** : Phinaert en boss (`KINDS.phinaert`, engine.js : la masse, l'onde de choc) ; le Temple et
ses six portes (temple.js), les cinq cloches pendues ; le pont de Fin, Lydéric en osier et la Porte Royale
(quetes.js, le prologue) ; les dons (`state.force`, `souffle`, `elan`, `course`, `lasso`, `sonnaille`…).
**N'existent pas** : le temps arrêté (un état du moteur), l'épée de Lydéric, la cloche qui sonne avec les autres,
le combat qui efface ses blessures, la porte du pont de Fin, l'épilogue.

## Trois questions pour Eugène (avant le code) — **réponses du 12 octobre : les trois propositions** (Phinaert vole la cloche ; les vrais lieux, figés ; un générique, puis on rejoue)

**1. Comment la Grande Cloche arrive-t-elle au Temple ?**
- **Proposé** : **Phinaert vient la prendre**. Quand Camille repasse le pont des géants, la forge est ouverte et la
  cloche n'y est plus. Cornil : « Il est venu cette nuit. Il avait un garçon avec lui. Le garçon m'a regardé
  comme on demande pardon. » Camille a fondu la cloche pour lui : c'est le retournement de `SCENARIO.md` § 5.
- Autre voie : Camille la rapporte elle-même au Temple, sur une charrette, par le pont des géants. Phinaert l'y attend.

**2. Où se passe le combat à travers les mondes ?**
- **Proposé** : **dans les vrais lieux, figés**, un court moment dans chacun (deux minutes environ) : l'Aveyron (le
  lac de Saint-Gervais), la Thaïlande (Ko Panyi), les Pouilles (le port de Gallipoli), la Lozère (le plateau de la
  Garde-Guérin), puis Lille (le pont de Fin). Cinq chargements, mais c'est là que le joueur voit que le temps
  s'est arrêté partout.
- Autre voie : tout se passe au Temple, et les mondes figés ne se voient que par ses portes ouvertes. C'est plus
  court et plus léger, mais on n'y marche pas.

**3. Après le noir ?**
- **Proposé** : un générique court (les noms, sur la musique de Lille), puis l'accueil. La sauvegarde reprend au pont
  de Fin, le temps reparti et la fête en cours : on peut finir les quêtes secondaires.
- Autre voie : la partie s'arrête au noir (« Fin »), et la sauvegarde ne reprend plus.

## Le fil, en une phrase par étape

| # | étape (`state.acte7`) | ce qui se passe | où | qui |
|---|---|---|---|---|
| 1 | `volee` | la cloche n'est plus à la forge (question 1) | `rive.html`, la forge | maître Cornil |
| 2 | `temple` | toutes les portes ouvertes, la Grande Cloche pendue en haut, Phinaert dessous, Eugène avec lui | le Temple, sur l'île | Phinaert, Eugène |
| 3 | `arret` | Phinaert pose la main d'Eugène sur le métal. Toutes les cloches sonnent. **Le temps s'arrête partout.** Camille bouge encore. | le Temple | Phinaert |
| 4 | `efface` | le premier combat : chaque coup de l'épée d'apprentie s'efface (Phinaert remonte le temps de ses blessures) | le Temple | Phinaert |
| 5 | `epee` | Camille frappe **le gong de Nok** près du mage figé : son temps repart, un instant. Il lui donne **l'épée de Lydéric**. | le Temple | le mage |
| 6 | `mondes` | Phinaert blessé pour de bon s'enfuit par les portes. Dans chaque monde figé, une arme du monde ouvre sa garde (voir plus bas), un coup d'épée, il fuit plus loin | Aveyron, Thaïlande, Pouilles, Lozère | Phinaert |
| 7 | `pont` | le dernier combat, au pont de Fin, devant Lydéric figé, là où Lydéric l'a vaincu en 620 | Lille, le pont de Fin | Phinaert, Eugène |
| 8 | `porte` | la porte s'ouvre dans la Porte Royale ; **Eugène la tient** ; Camille repousse Phinaert de l'autre côté ; ils la ferment à deux, le sang de Lydéric (la main d'Eugène) sur la pierre | le pont de Fin | Eugène |
| 9 | `epilogue` | le temps repart : un plan par monde, puis Lille en fête, Lydéric redevenu lui-même | tous les mondes, puis Lille | — |
| 10 | `fin` | Camille pose la première botte de blé devant Lydéric : « Ce que la garde commence, la garde l'achève. » Une dernière cloche. Noir. | le pont de Fin | Camille |

Durée visée (`SCENARIO.md` : ~15 min) : 3 min pour 1 à 3, 3 pour 4 et 5, 6 pour 6, 2 pour 7 et 8, 1 pour 9 et 10.

## Les étapes, une à une

### 1. La cloche volée (`volee`)
De retour de la tombe, après la fonte, au lendemain : la forge est ouverte, le moule cassé, la cloche partie ; des
traces de roues jusqu'au pont des géants. Cornil (question 1). L'objectif : « Le Temple. »

### 2. Le Temple (`temple`)
Sur l'île, les six portes sont ouvertes. Le ciel est blanc, sans soleil. En haut du Temple, la Grande Cloche pend
au-dessus des cinq autres ; Phinaert est dessous, à taille d'homme (comme dans la cave du Dormeur), Eugène à côté
de lui. Le mage est au pied de l'escalier, il n'ose pas monter.

### 3. Le temps arrêté (`arret`)
Une scène : Phinaert prend la main d'Eugène et la pose sur le bronze. La cloche reconnaît le sang de Lydéric. Elle
sonne, et les cinq autres avec elle. Tout s'arrête : les oiseaux en l'air, la fumée, l'eau, le mage la bouche
ouverte. Phinaert rit. Camille fait un pas : elle bouge encore (elle a sonné les cloches des gardiens, leur temps
lui obéit un peu).
**Dans le moteur** : `G.tempsArrete` — les villageois, les bêtes, l'eau, les nuages, les particules ne bougent
plus ; seuls Camille, Phinaert et ce qu'ils touchent bougent. Un voile gris-bleu sur l'image (le post-traitement).

### 4. Les blessures effacées (`efface`)
Phinaert redevient géant (`KINDS.phinaert`). Chaque coup de l'épée d'apprentie le blesse, puis la blessure
s'efface : sa barre de vie se remplit à rebours, une traînée de lumière le remonte d'une seconde. Au bout de
trois coups effacés, Camille comprend : l'objectif dit « Le gong de Nok : relancer le temps autour du mage ».

### 5. L'épée de Lydéric (`epee`)
Le gong, près du mage figé : son temps repart, le temps d'une réplique. « Elle était à lui. Elle est à toi. » Il
lui tend l'épée de Lydéric, qu'il gardait depuis 620 ; puis il se fige de nouveau. L'épée remplace celle de
Camille (`state.epeeLyderic`) : ses coups ne s'effacent plus.

### 6. Les mondes figés (`mondes`)
Au premier coup qui reste, Phinaert hurle et s'enfuit par une porte. On le suit. Dans chaque monde, la même règle :
**il a une garde, l'arme du monde l'ouvre, un coup d'épée, il fuit par la porte suivante** (`SCENARIO.md` § 16 :
« chaque monde rend son arme »). Le monde est figé autour : les gens immobiles, la pluie suspendue.

| monde | où | sa garde | l'arme du monde |
|---|---|---|---|
| l'Aveyron | le lac de Saint-Gervais, à la porte du Midi | il fige une zone autour de lui (acte II) | **le lasso** : on l'attrape de loin, on le tire hors de sa zone |
| la Thaïlande | Ko Panyi, à la porte des Îles | il se met hors de portée, sur l'eau figée | **le gong** : l'eau repart sous lui, il tombe |
| les Pouilles | Alberobello, à la porte des Heures (codé ainsi : la porte de l'île y mène) | il frappe trop vite pour qu'on approche | **le tambourin** : il ralentit |
| la Lozère | Villefort, à la porte des Troupeaux (codé ainsi : la porte de l'île y mène) | il saute d'une époque à l'autre et n'est jamais là | **la sonnaille** : un coup, il revient au présent |
| Lille | le pont de Fin | (le dernier combat) | **la force** : on le renverse |

### 7. Le pont de Fin (`pont`)
Lille figée, en fête : les fanions arrêtés dans le vent, la foule immobile sur les quais, Lydéric en osier au
milieu du pont. Eugène est là : Phinaert l'a ramené avec lui. Le dernier combat (une version plus dure de celui
de l'acte I : l'onde de choc, la zone figée, la masse). À terre, Phinaert ouvre la porte pour fuir.

### 8. La porte (`porte`)
La Porte Royale s'ouvre sur un autre temps : une lumière blanche, un vent qui aspire. Phinaert recule vers elle.
**Eugène met la main sur le battant et la tient** (le sang de Lydéric l'ouvre et la ferme). Camille, l'épée de
Lydéric en main, repousse Phinaert de l'autre côté : trois coups, il recule d'un pas à chaque coup. Le vent prend
Eugène par la manche, la porte veut l'emporter ; Camille lui prend la main. Ils poussent le battant à deux. La
porte se ferme. **Phinaert reste de l'autre côté.**

### 9. L'épilogue (`epilogue`)
Le temps repart : un plan par monde (la pluie qui retombe en Aveyron, les barques de Ko Panyi, Nunzia sur le quai
de Gallipoli, vieille, qui sourit quand même, le berger et le loup endormi), puis Lille : la foule reprend son
geste, les fanions claquent, Lydéric bouge, redevenu lui-même.

### 10. La fin (`fin`)
Camille revient au pont de Fin, la première botte de blé dans les bras (Émile la lui donne en passant). Elle la
pose devant Lydéric. « **Ce que la garde commence, la garde l'achève.** » Une dernière cloche sonne. Noir.
(Question 3.)

## Qui écrit quoi — les fichiers

| étape | fichiers |
|---|---|
| 1 | `rive.js` (la forge vide) |
| 2 à 5 | `temple.js` (le Temple de la fin, le mage figé, l'épée) ; `engine.js` (`G.tempsArrete`, les blessures effacées de `KINDS.phinaert`, l'épée de Lydéric) ; `pnj.js` (l'épée dans la main de Camille) |
| 6 | une arène par monde, dans le fichier du monde : `aveyron.js`, `thailande.js`, `pouilles.js`, `lozere.js` ; le geste de chaque arme existe déjà (le lasso est au moteur depuis la passe D3) |
| 7, 8 | `quetes.js` (le pont de Fin, la porte) ; `citadelle.js` si la Porte Royale doit s'ouvrir |
| 9, 10 | `quetes.js` (l'épilogue, la botte), et un plan par monde (une caméra posée, sans recharger : des images fixes prises au banc si un chargement par monde est trop lourd) |

## Comment chaque étape est vérifiée
En headless, `bancs/acte7-*.mjs` : une partie posée à la fin de l'acte VI, chaque étape jouée de bout en bout, une
capture par moment clé, aucune pageerror. Le temps arrêté se vérifie en rendu (deux captures à une seconde d'écart :
rien ne bouge sauf Camille). Le chargement de chaque page touchée est mesuré avant et après (règle 8).

## Les lots
1. La cloche volée, le Temple, le temps arrêté, les blessures effacées, l'épée (étapes 1 à 5) — `acte7-temple.mjs`.
2. Les mondes figés (6) — `acte7-mondes.mjs`.
3. Le pont de Fin, la porte (7, 8) — `acte7-pont.mjs`.
4. L'épilogue et la fin (9, 10) — `acte7-fin.mjs`.
