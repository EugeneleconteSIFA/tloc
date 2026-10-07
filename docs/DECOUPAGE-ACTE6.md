# L'acte VI — découpage en étapes jouables (version 1, 7 octobre) — **à valider par Eugène**

L'acte VI de `STORY.md` (« La Blessure », la rive oubliée), qui fait foi, découpé en étapes qu'on peut
jouer, vérifier et publier une à une, sur le modèle de `DECOUPAGE-ACTE1.md`. Le détail vient de
`SCENARIO.md` § 15 ; les répliques sont dans `DIALOGUES-ACTE6.md`. On part de la fin de l'acte V : les
quatre cloches des mondes pendues au Temple, la Grande Cloche de Lille seule manque (`state.acte5`
au-delà de `course`). L'acte VI finit quand maître Cornil a refondu la Grande Cloche : neuve, pas encore
sonnée ; l'acte VII (vague 4) part de là.

**Ce qui existe déjà** : la porte de la fêlure sur l'île (`temple.js`, sixième porte, `geant: 'fissure'`,
fermée : « La pierre est fendue ») ; les dons — `state.force` (Aveyron), `state.souffle` (Thaïlande),
`state.elan` (Pouilles), `state.course` (Lozère) ; la cave du Dormeur dans `aveyron.js` (`caveDormeur`,
l'acte II). **N'existent pas** : la Blessure dans la carte de Lille (`carte.js` n'en a pas), le lasso (E4
le fait en même temps), maître Cornil, l'autre rive.

## Deux questions pour Eugène (avant le code)

**1. Où est la Blessure ?** `STORY.md` la veut « visible depuis le début » dans Lille ; mais la carte de
Lille n'a pas de canyon, et ses fichiers (`carte.js`, `game.js`, `quetes.js`…) ne sont pas à E1.
- **Proposé** : **la rive oubliée est un lieu à part** (`rive.html`, `rive.js`), où l'on arrive **par la porte
  de la fêlure de l'île** — et la Blessure est DANS ce lieu : on arrive sur le bord côté Lille (un morceau
  de plaine flamande, le beffroi au loin en silhouette), on descend, on traverse, on remonte sur l'autre
  rive. Une demande pour plus tard (une passe D) : que la carte de Lille montre la Blessure à son bord, et
  qu'Émile y désigne « le vieux sentier des bergers ».
- Autre voie : le canyon dans la carte de Lille, la rive chargée au fond (comme les souterrains) — plus juste
  pour l'histoire, mais il faut `carte.js` (E3 et la carte de Lille sont ailleurs).

**2. De quel relief faire l'autre rive ?** L'Isle de 620 n'a pas de canyon réel.
- **Proposé** : **un relief inventé**, tiré par le code (`rive.js`) : la plaine humide de Flandre, des marais,
  la forêt du Buc, une butte pour les ruines du château — et la Blessure, une entaille de 40 m de fond et
  de 120 m de large, à parois de craie et de grès, une rivière glacée au fond. Rien à récolter, léger à
  charger.
- Autres voies : une récolte IGN d'un vrai canyon (les gorges du Tarn, le Verdon…) collée à un morceau de
  Flandre — plus vrai, mais deux reliefs qui ne se ressemblent pas ; ou la plaine réelle au nord de Lille
  (le vrai Buc) avec un canyon creusé dedans.

## Le fil, en une phrase par étape

| # | étape (`state.acte6`) | ce qui bloque | ce que Camille gagne | où | qui |
|---|---|---|---|---|---|
| 1 | `felure` | la porte fendue de l'île | la porte s'ouvre ; le nom de maître Cornil | l'île du temps, la porte de la fêlure | le mage, devant la porte |
| 2 | `bord` → `descente` | la falaise de la Blessure | **le lasso** (E4) : de corniche en corniche, quatre lancers | `rive.html`, le bord côté Lille | — |
| 3 | `descente` → `riviere` | la rivière glacée du fond : l'eau coupe le souffle | **le souffle** : on traverse à la nage ; sans lui, renvoyée au bord | le fond de la Blessure | — |
| 4 | `riviere` → `escalier` | l'escalier des géants, ses marches tombées | **la force** : trois blocs à pousser et à hisser | la paroi de l'autre rive | — |
| 5 | `escalier` → `rive` | le vieux pont des géants, relevé depuis 620 | le pont abaissé : le retour sans refaire la descente | le haut de l'autre rive | — |
| 6 | `rive` | l'autre rive, inconnue | la fontaine de l'ermite (la biche, Lydéric enfant), les traces de Lydéric enfant, la forêt du Buc | l'autre rive | — |
| 7 | `rive` → `forge` | la forge introuvable dans la forêt | **maître Cornil**, et ce qui manque : le métal du cœur du Dormeur | la forge, au fond de la forêt du Buc | maître Cornil |
| 8 | `forge` → `metal` | la galerie noyée de la mine de l'Aveyron | **le métal du cœur du Dormeur** (le souffle pour nager, la force pour la porte de pierre sous l'eau) | `aveyron.html`, la mine (la cave du Dormeur, plus bas) | — |
| 9 | `metal` → `tombe` | les ruines du château du Buc, et ses bandits | la tombe du prince Salvaert, **le sixième vers** ; « Ce que la garde commence, la garde l'achève. » | les ruines du château de Phinaert | les bandits |
| 10 | `tombe` → `cloche` | — | Cornil refond la Grande Cloche : neuve, pas encore sonnée | la forge | maître Cornil |

Durée visée (`SCENARIO.md` : ~40 min en allant vite) : 10 min pour 1 à 5, 8 pour 6 et 7, 8 pour 8, 8
pour 9, 4 pour 10.

## Les étapes, une à une

### 1. La fêlure (`felure`)
La fin de l'acte V faite (`state.acte5` à `course` ou au-delà), la porte de la fêlure n'est plus fendue :
la fêlure s'ouvre d'un trait de lumière froide. **Le mage**, devant elle : « Le dernier fondeur de cloches
s'appelait **maître Cornil**. Sa famille a fondu la Grande Cloche, en 620. Il est parti **de l'autre côté
de la Blessure**. » Entrée : `rive.html`, sur le bord côté Lille. (`temple.js` : la porte et son arrivée
SEULEMENT, le tableau `VERS`.) **Les portes de l'île restent toutes ouvertes** pour l'exploration : la
fêlure aussi, mais son texte suit l'acte.

### 2. La descente (`bord` → `descente`)
Le bord : une prairie, une croix de chemin, le vent ; au loin, la silhouette du beffroi. La falaise : quatre
corniches, chacune avec un point d'ancrage (un vieux pieu, une racine) ; « lancer le lasso » (le geste d'E4)
fait descendre à la corniche suivante. Sans lasso : « Trop haut. Il me faudrait une corde. » **Pour tester**,
le banc pose `state.lasso` (ce qu'E1 attend d'E4 : le nom de l'état et le geste, écrits dans PROMPT-REPRISE).

### 3. La rivière (`descente` → `riviere`)
Le fond : une rivière glacée, rapide, de 20 m. Sans le souffle : on y entre, le froid coupe le souffle, on
est rendue au bord (pas de noyade). Avec : on nage de l'autre côté (la nage de Thaïlande, `nageIci` du
niveau).

### 4. L'escalier des géants (`riviere` → `escalier`)
Taillé dans la paroi : des marches de 1,5 m, trois tombées. Trois blocs à pousser au pied (la force, comme
les blocs du Dormeur) puis à hisser : chacun refait une marche.

### 5. Le pont des géants (`escalier` → `rive`)
En haut, le pont-levis de pierre relevé depuis 620 : un treuil géant, la force. Il s'abaisse sur la
Blessure : désormais, de la porte de la fêlure on peut traverser à pied.

### 6. L'autre rive (`rive`)
- **La fontaine de l'ermite** : une source sous un chêne ; à l'eau, un souvenir — l'ermite qui berce un
  enfant, une biche qui boit.
- **Trois traces de Lydéric enfant** : une petite épée de bois plantée, un nom gravé maladroitement (« LIDERIC »)
  sur une pierre, une cabane d'enfant dans un arbre. Chacune au journal.
- **La forêt du Buc** : dense, sombre, des cerfs ; on s'y perd sans la carte.
- (Les chevaux sauvages et les rênes de `SCENARIO.md` : laissés pour plus tard, les rênes n'existent pas.)

### 7. Maître Cornil (`rive` → `forge`)
La forge au fond de la forêt, la fumée qu'on voit de loin. Cornil, vieux, seul, qui attendait : il garde le
moule de la Grande Cloche. Il a les morceaux ? Camille les a (le pont, le Dormeur, le Yak, le Colosse, le
loup). Il manque **le métal du cœur du Dormeur** : « Le cœur d'un géant ne fond pas comme le bronze. »

### 8. Le métal du Dormeur (`forge` → `metal`)
Retour en Aveyron (par la porte du Midi). Dans la cave du Dormeur (`aveyron.js`, l'acte II), plus bas : la
**galerie noyée** — une eau noire ; le souffle pour nager sous la voûte ; au fond, **une porte de pierre sous
l'eau** qu'on pousse avec la force ; derrière, une poche d'air, et le métal du cœur (un éclat rouge sombre,
encore chaud). Dans `aveyron.js` : la mine SEULEMENT, rien de l'acte II ne change (`acte2-*.mjs` passent).

### 9. La tombe de Salvaert (`metal` → `tombe`)
Les ruines du château du Buc, sur leur butte : des bandits de la bande de Phinaert s'y sont installés (un
petit combat, cinq bandits et leur chef). Au cœur des ruines, la tombe du prince Salvaert, père de Lydéric.
Gravé : **« Le sang de Lydéric fermera la porte, et de l'autre côté restera. »** Camille ne comprend pas
encore qui restera de l'autre côté — le joueur non plus (le doute est voulu). Elle pose la main sur la pierre :
**« Ce que la garde commence, la garde l'achève. »** (`SCENARIO.md` : la première fois qu'elle le dit elle-même.)

### 10. La Grande Cloche (`tombe` → `cloche`)
Retour à la forge : Cornil fond la cloche (une scène : le métal, le moule, la nuit, le bronze qui coule). Elle
est neuve. Elle n'a pas encore sonné. Cornil : « Elle sonnera une fois. Une seule. Choisis bien le moment. »
L'acte VII commence là (vague 4).

## Les conséquences des retours — découpées, à écrire par d'autres (PROMPT-REPRISE.md)

« Les habitants reconnaissent Camille. Les mondes se souviennent. » Ce sont des répliques dans les fichiers
des autres mondes (E1 ne les code pas) ; proposées dans `DIALOGUES-ACTE6.md`, § « Les mondes se souviennent » :
Lille (Houtland, Gustave, Émile, le crieur), l'Aveyron (les deux maîtres, l'aïeule), la Thaïlande (Nok,
Somsak, Mali), les Pouilles (Nunzia, Assunta), la Lozère (le berger).

## Qui écrit quoi — les fichiers

| étape | fichiers d'E1 | d'ailleurs (PROMPT-REPRISE.md) |
|---|---|---|
| 1 | `temple.js` (la porte de la fêlure et son arrivée SEULEMENT) | — |
| 2 – 7, 9, 10 | `rive.js`, `rive.html` (un lieu neuf, sur le modèle de `pouget.js` : `bootLevel`, pas d'arène) | le lasso et son geste (E4) ; la Blessure au bord de la carte de Lille (une passe D) |
| 8 | `aveyron.js` (la mine SEULEMENT) | — |
| conséquences | — | les fichiers de chaque monde |

## Comment chaque étape est vérifiée
En headless, `bancs/acte6-*.mjs` : une partie posée à la fin de l'acte V (avec `state.lasso` posé par le banc),
chaque étape jouée de bout en bout, une capture par moment clé, aucune pageerror. `acte2-*.mjs` doivent
passer après la mine. Le chargement de `rive.html` mesuré (rien de nouveau au-delà de 300 ms sans le dire).

## Les lots
1. La fêlure, le bord, la descente, la rivière, l'escalier, le pont (étapes 1 à 5) — `acte6-traversee.mjs`.
2. L'autre rive, Cornil (6, 7) — `acte6-rive.mjs`.
3. La mine de l'Aveyron (8) — `acte6-metal.mjs`.
4. La tombe, la cloche (9, 10) — `acte6-cloche.mjs`.

## Ce que le lot 1 attend d'ailleurs (à reporter dans PROMPT-REPRISE.md, § 4.E, quand il sera libre)

- **Le lasso (E4)** : l'état `state.lasso` (vrai quand Camille l'a). `rive.js` n'attend rien d'autre : ses
  pieux d'ancrage portent l'invite « descendre au lasso » / « remonter au lasso » et refusent sans lui
  (« Trop haut. Il me faudrait une corde. »). Si E4 donne au lasso un geste à lui (une touche, un lancer
  visé), les pieux de `rive.js` (`ANCRES`) sont ses points d'ancrage.
- **La passe D3 (engine.js)** : inscrire `rive: 'rive.html'` dans `PAGES` — `rive.js` et `temple.js` le
  complètent à leur chargement, mais une partie sauvée sur la rive et reprise depuis l'accueil
  retomberait à Lille.
- **La carte de Lille** : montrer la Blessure à son bord, et la réplique d'Émile (le sentier des bergers).
- **Les conséquences des retours** : les répliques de `DIALOGUES-ACTE6.md`, § « Les mondes se souviennent »,
  chacune dans le fichier de son monde, après `state.acte6`.
