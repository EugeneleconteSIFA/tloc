# Écus, bourse, poche et quêtes d'atouts — spécification

Deuxième tour, après tes arbitrages. Rien n'a été codé, et rien ne le sera avant que les
fichiers concernés soient libres : on l'écrit **dans le jeu**, pas à côté.

**Ce qui est tranché**

1. Les écus sont **crédités automatiquement** — pas de pièce à ramasser au sol.
2. Ce qui est tué ou coupé **disparaît vraiment** : la fougère fauchée s'en va.
3. La **bourse se trouve dans un coffre** : avant de l'avoir, on ne compte rien.
4. Pas de second système greffé : tout vit dans `engine.js`, `quetes.js`, `village.js`,
   `nature.js`, comme le reste du jeu.

**Ce qui reste à trancher** est en dernière section (quatre points).

---

## 0. Ce qui existe déjà et qu'il ne faut pas refaire

| déjà là | où | ce qu'il reste |
|---|---|---|
| **Endurance et course** (jauge, essoufflement, reprise) | `engine.js` — `ENDURANCE`, `p.energie` | l'atout « courir plus vite » n'est qu'un jeu de constantes |
| **Le bouclier** rond cerclé de fer, avant-bras gauche | `makeCamille()` — `elbows[0]` | il est **décoratif** : aucune touche, aucun effet. Tout est à écrire |
| **L'arc** et son coffre du bastion de Turenne | `quetes.js`, `state.bow` | il sert la quête principale ; l'atout sera l'arc **long** |
| **Réceptacles de cœur** (+2 PV) | `village.js` — `giveHeart` | trois existent ; on en pose d'autres à l'identique |
| **Coffres** et interactions | `makeChest()`, `addInteract()` | le modèle du coffre de l'arc se recopie tel quel |
| **Le crochet de mise à mort** | `hitEnemy()` appelle déjà `G.level.onKill(e)` | les écus sur les monstres se posent **sans toucher au moteur** |

Et le point qui simplifie tout : **la sauvegarde avale ce qu'on range dans `state`**.
`saveGame()` sérialise chaque clé non-runtime, `loadGame()` fait un `Object.assign` en
retour. `state.ecus`, `state.bourse`, `state.poche`, `state.gourdes` sont donc sauvegardés
et rechargés sans une ligne dans le système de sauvegarde. Une vieille partie qui ne les
connaît pas repart de zéro (`state.ecus ?? 0`).

---

## 1. La bourse

C'est elle qui ouvre l'économie, et elle se trouve.

**Tant que `state.bourse` est faux, aucun écu n'est compté** et le compteur n'existe pas à
l'écran. Au premier monstre qui aurait dû en lâcher, un message, une seule fois :

> Une pièce roule dans l'herbe. Tu n'as rien pour l'emporter — ta bourse de gardienne est
> restée chez toi.

Et elle y est : **dans le coffre au pied du lit, chez Camille** (`house.js`, qui est libre
aujourd'hui). L'ouvrir donne la bourse, fait apparaître le compteur et crédite d'emblée
**20 écus** (ce qu'elle avait mis de côté). Trois raisons de la mettre là plutôt qu'au bout
d'un rempart : le message envoie le joueur chez lui, donc il apprend le lit (qui soigne et
sauvegarde) ; c'est atteignable tôt sans combat ; et ça raconte quelque chose.

Plus tard, une **grande bourse** dans un coffre des galeries fait passer le plafond de
**999 à 9 999** — de quoi finir la partie sans jamais buter dessus.

| | plafond | où |
|---|---|---|
| Bourse de gardienne | 999 écus | coffre de la chambre, chez Camille |
| Grande bourse | 9 999 écus | coffre des galeries de Vauban, derrière le Rat-Roi |

---

## 2. Les écus

### Ce qui en donne

| source | montant | remarque |
|---|---|---|
| Corbeau | 1–2 | le plus courant |
| Moule mutante | 3 | coriace, à l'arc |
| Fantôme de la garnison | 4 | |
| Rat des galeries | 3 | |
| Rat-Roi | 25 | |
| Phinaert | 60 | une fois dans la partie |
| Fougère, blé, touffe haute fauchés | 1 écu une fois sur quatre | l'appoint, pas le revenu |
| Petit coffre (une douzaine) | 12–20 | remparts, bastions, galeries, toits |
| Coffre de quête | 60–100 | |

Revenu d'une première heure jouée normalement : **250 à 350 écus**. Deux ou trois achats,
pas dix.

### Crédit direct, et ce qu'on voit

Pas d'objet au sol : le monstre meurt, le compteur monte, un petit `+3` doré s'élève à
l'endroit de la mort et s'efface en une seconde. Même chose sur une touffe fauchée. C'est
plus lisible qu'une pièce à courir après quand on vient de nettoyer un fossé, et le
retour visuel reste immédiat.

Si un jour tu veux la pièce qui roule, le crédit direct n'empêche rien : il suffira de
faire passer le gain par un `spawnPickup('ecu', …)` — le système de ramassage existe déjà
pour les gaufres.

### Anti-farm

Sans garde-fou, on fauche le champ d'Émile en boucle : **40 écus au maximum par zone et
par tranche de dix minutes** sur la seule végétation. Au-delà, la gerbe de brins part
toujours, l'écu ne tombe plus. Monstres et coffres ne sont pas plafonnés — ils ne
repoussent pas.

---

## 3. Faucher la végétation : ce que le code impose

J'avais supposé des plantes posées une fois pour toutes. **C'est faux**, et ça change le
plan. Dans `nature.js`, herbe, touffes, blé et fougères sont semés par la classe `Couche` :
un semis **par tuiles, qui suit le joueur**. Les tuiles sorties de portée sont recyclées et
ré-semées ailleurs — l'instance numéro 8 412 n'est pas une plante, c'est un emplacement
qui change de plante au fil des déplacements.

Trois conséquences, et la bonne nouvelle en dernier.

**a. Couper une instance, c'est immédiat et pas cher.** Les matrices sont déjà en
`DynamicDrawUsage`, et three r160 (celui de `lib/`) sait envoyer un morceau de tampon :

```js
poseur(im, i, 0, -999, 0, 0, 0, 0, 0);   // l'instance s'en va
im.instanceMatrix.addUpdateRange(i * 16, 16);
im.instanceMatrix.needsUpdate = true;    // 64 octets remontent, pas 2,5 Mo
```

Sans `addUpdateRange`, chaque coup d'épée renverrait tout le tampon d'herbe à la carte
graphique : c'est précisément ce qu'il faut éviter sur un portable.

**b. Il faut une table des fauches, sinon la plante repousse en tournant le dos.** Comme
la tuile sera ré-semée, on tient un registre par position : une `Map` dont la clé est la
cellule d'un mètre (`(x|0) * 100000 + (z|0)`) et la valeur l'instant de la fauche. Le
semeur saute les cellules fauchées depuis moins de **90 secondes** ; passé ce délai,
l'entrée est oubliée et la plante revient. Trois lignes dans la boucle de semis, une
entrée par touffe coupée, et la repousse devient un comportement voulu plutôt qu'un bug.

**c. Trouver les brins dans l'arc de l'épée est déjà résolu.** `Couche` range ses
instances par blocs de tuile (`parTuile` instances consécutives par bloc) : on calcule la
tuile sous Camille, on balaie ce bloc et ses huit voisins, quelques centaines de matrices
au plus, au lieu des quarante mille du tampon.

**Ce qui est fauchable** : les fougères, le blé et les touffes hautes — ce qui se coupe
dans un Zelda. Le tapis d'herbe rase, lui, ne se fauche pas : il est dix fois plus dense
et on ne verrait pas la différence.

---

## 4. La poche

Trois zones, comme tu l'as décrite :

```
┌─ ARMES ──────────┐  ┌─ OBJETS (6 → 12) ─────────────────┐  ┌─ GOURDES (1 → 3) ─┐
│ épée   │ arc     │  │ gaufre ×3 │ planche │ corne │ …   │  │ ●  ○  ○           │
└────────┴─────────┘  └───────────────────────────────────┘  └───────────────────┘
```

- **Deux armes, pas trois.** L'épée et l'arc tiennent les deux emplacements. Une
  troisième arme force un choix — je propose **la masse du Rat-Roi** : lente, lourde, et
  seule à briser les murs fendus des galeries. La prendre, c'est laisser l'arc.
- **Objets : 6 emplacements**, 12 au maximum. Les gaufres s'empilent par trois.
- **Les objets de quête ne vont pas dans la poche.** Clé du donjon, clé de la cage,
  Pralin : tout ça reste au journal. Sinon la poche se remplit de choses qu'on n'a pas le
  droit de jeter, et la contrainte devient une corvée.
- **Écran poche : `I`**, jeu en pause, même habillage que le journal. Flèches pour
  naviguer, `Entrée` pour équiper ou boire, `Suppr` pour jeter.

### Gourdes et potions

Une gourde = une dose. On boit avec **`B`**, on remplit chez le vendeur.

| potion | effet | prix |
|---|---|---|
| Onguent de la doyenne | rend 3 cœurs | 25 |
| Sirop de chicorée | course sans fin pendant 30 s | 30 |
| Lait ribot de Phalempin | dégâts doublés pendant 60 s | 45 |
| Eau de la Deûle | souffle long sous l'eau | 40 |

**Le vendeur, c'est le vieux mage** : sa maison existe (`mage.html`), elle est à l'écart,
et un alchimiste qui vend des fioles est plus juste qu'un épicier. L'enseigne de bois se
fabrique en une ligne (`makeEnseigne`, dans `menuiserie.js`).

### Le colporteur

Sous les arcades de la place d'Armes, il vend ce qui ne se mérite pas :

| chez le colporteur | prix |
|---|---|
| +2 emplacements de poche | 60, puis 120, puis 240 |
| Deuxième gourde | 80 · troisième : 160 |
| Carquois renforcé (+10 flèches) | 20 |
| Dernier réceptacle de cœur | 250 |

---

## 5. Les atouts et les quêtes qui les donnent

Le principe à tenir : **les quêtes donnent les verbes** (bloquer, courir, viser, boire),
**les écus n'achètent que des capacités et des consommables**. Un atout ne s'achète pas,
sinon on fauche une demi-heure et le jeu est fini.

Trois quêtes existent (Pralin, les corbeaux, les fantômes) et donnent un cœur chacune. En
voici cinq, accrochées à des personnages et des lieux déjà construits :

| # | quête | donneur / lieu | à faire | atout |
|---|---|---|---|---|
| 4 | **Les cierges de la chapelle** | Aldegonde → la chapelle | rallumer cinq cierges, dont deux dans les galeries | **le bouclier devient utilisable** |
| 5 | **Les bottes du guetteur** | Désiré, après ses fantômes | les reprendre sur le bastion de Turenne, gardé par trois moules | **420 m de course par jauge au lieu de 253** |
| 6 | **L'arc long de Fernande** | Fernande, la doyenne | trois cornes de moule et 40 écus | **arc long** : deux flèches, 3 de dégâts |
| 7 | **La gourde de Gustave** | l'estaminet | rapporter un sac de farine du moulin sans se faire toucher | **première gourde** |
| 8 | **Le trésor du beffroi** | une carte trouvée en coffre | trois indices, trois lieux de la carte | 150 écus et le dernier réceptacle |

**L'arc reste dans son coffre** : il est sur le chemin de la quête principale (les moules
des fossés, la grille à dix monstres). Fernande donne l'arc long, pas l'arc.
**Les quêtes 4 et 5 s'ouvrent après la première heure** : bloquer n'a d'intérêt que quand
les coups font mal.

### Le bouclier

- **Maintenir `V`** : Camille lève le bouclier (le maillage est là, il suffit de le faire
  pivoter sur l'avant-bras). Elle marche au ralenti, ne court ni ne frappe.
- **Bloqué de face** : dégâts annulés, recul conservé — on est repoussé, pas blessé.
- **Parade** : dans les 0,25 s qui suivent la levée, le monstre est déséquilibré une
  seconde et la flèche repart d'où elle vient. C'est la récompense du bon moment.
- **Coût** : l'endurance descend pendant le blocage (0,06 par seconde) ; à sec, le
  bouclier tombe.
- **Ne bloque pas** l'onde de choc de Phinaert : contre lui, c'est la roulade. Un boss ne
  doit pas devenir trivial parce qu'on a fini une quête secondaire.

### La course

L'atout ne touche qu'aux constantes déjà écrites :

| | aujourd'hui | avec les bottes |
|---|---|---|
| `gain` | 2,2 → 25,3 m/s | 2,4 → 27,6 m/s |
| `conso` | 0,10 → 10 s | 0,065 → 15 s |
| distance par jauge | 253 m | **420 m** |

---

## 6. La courbe

| moment | ce qu'on a | ce qu'on vise |
|---|---|---|
| 0–20 min | épée, 3 cœurs, pas de bourse | l'arc, la bourse, la grille du donjon |
| 20–60 min | arc, ~5 cœurs, ~250 écus | une gourde, une potion, deux emplacements |
| 1–2 h | bouclier, bottes, 7 cœurs | l'arc long, la poche pleine, Phinaert |
| après | 9 cœurs, poche à 12, grande bourse | le trésor du beffroi, la masse du Rat-Roi |

---

## 7. En instance (le multi)

Une instance n'a ni quête ni progression. Pour que les duels restent justes, **tout le
monde entre avec le même équipement** : épée, arc, bouclier, une gourde, six emplacements,
et la bourse déjà en poche. Les écus tombent, le mage vend ses potions — c'est du sel, pas
de la progression —, aucun atout ne s'y gagne, et la poche d'instance ne sort pas de
l'instance. Elle est déjà rangée à part (`tloc_save_v2:inst:<CODE>`), donc rien à inventer.

---

## 8. L'ordre d'implémentation, fichier par fichier

Rien ne commence avant que le fichier soit libre. Dans cet ordre, chaque étape est jouable
à la fin :

| étape | fichiers | contenu | jouable ? |
|---|---|---|---|
| **1. La bourse** | `house.js` *(libre aujourd'hui)*, `quetes.js` | le coffre de la chambre, `state.bourse`, le message du premier écu | on trouve la bourse, elle ne sert encore à rien |
| **2. Les écus** | `quetes.js` (`onKill`), `hud.js` | gains sur les monstres et les coffres, compteur au HUD, le `+3` qui s'élève | on s'enrichit en jouant |
| **3. La poche** | `hud.js`, `engine.js` (touche `I`) | les trois zones, l'écran, équiper, jeter, empiler | on gère son barda |
| **4. Les boutiques** | `mage.js` *(libre)*, `village.js` | le mage et le colporteur, les prix, les gourdes, boire avec `B` | les écus servent |
| **5. Le bouclier** | `engine.js` | touche `V`, blocage, parade, coût d'endurance | le combat change de nature |
| **6. La fauche** | `nature.js` | table des fauches, repousse à 90 s, balayage par tuile | la citadelle réagit à l'épée |
| **7. Les quêtes** | `village.js`, `quetes.js`, `chapelle.js` | les cinq quêtes, dialogues, journal, atouts | le jeu prend sa saveur |

Les étapes 1 et 4 peuvent démarrer tout de suite : `house.js` et `mage.js` ne sont pas dans
ta liste de fichiers ouverts. Dis-moi quand les autres se libèrent.

---

## 9. Ce qu'il reste à trancher

1. **La bourse chez Camille**, ou ailleurs (cave de l'estaminet, premier bastion) ?
2. **La masse du Rat-Roi** comme troisième arme — ça t'intéresse, ou on reste à deux armes
   qui n'entrent jamais en concurrence ?
3. **Les prix** conviennent-ils pour une partie de trois heures, ou tu veux une économie
   plus serrée (tout au double, on choisit vraiment) ?
4. **Les touches** `I` (poche), `B` (boire), `V` (bouclier) — le clavier commence à être
   chargé, et elles doivent rester atteignables la main gauche sur ZQSD.

---

## 11. Deuxième vague (25 septembre) : les primes et la fauche

- **Primes des monstres** : la table du § 2 est dans `bourse.js` (`PRIMES`), et `prime(e)`
  est appelé en tête des `onKill` de `quetes.js` et de `cave.js`. Le « +3 » s'élève au-dessus
  du monstre.
- **La fauche** : dans `nature.js`, comme prévu au § 3 — table des fauches par cellule d'un
  mètre, repousse à 90 s, balayage des seules tuiles sous la lame. Se fauchent : herbe,
  touffes, fleurs, buissons, fougères (pas les ronces : elles font le mur du fourré), le blé
  des champs du moulin et les meules de foin (`campagne.js` les inscrit). Le tapis d'herbe
  rase, finalement, se fauche aussi — à la demande d'Eugène — mais ne rapporte presque rien.
- **Des gaufres** tombent de la verdure et surtout des meules, plus souvent quand Camille
  est blessée.
- **Anti-farm** : 40 écus de verdure par zone de 80 m et par 10 minutes, comme prévu.
- Reste de la vague : les petits coffres (§ 2) — ils demandent de choisir leurs cachettes.

## 10. Ce qui est fait (première vague)

Dans les fichiers libres uniquement. `engine.js`, `quetes.js`, `village.js`, `nature.js`
n'ont pas été touchés.

| fichier | état |
|---|---|
| `bourse.js` *(neuf)* | écus, plafond, gourdes, potions, boutiques, étiquette « +3 », touche **B** |
| `look.js` *(neuf)* | l'apparence de Camille et la page de l'armoire |
| `house.js` | **armoire** au pied du lit, **coffre de la bourse sur la mezzanine** |
| `mage.js` | la boutique de fioles sur l'établi, et le mage qui en parle |
| `hud.js`, `cave.js` | la ligne de bourse au HUD, et l'apparence qui suit d'un niveau à l'autre |

### La bourse

Le coffre est **sur la mezzanine**, en haut de l'escalier. Tant qu'il n'est pas ouvert,
aucun écu n'est compté : au premier gain manqué, un message, une seule fois, renvoie le
joueur chez lui. L'ouvrir donne la bourse et 40 écus.

### Les fioles du mage

Sur l'établi d'alchimie. Un bol d'onguent bu sur place (25), une gourde de cuir (80), et
de quoi la remplir d'onguent (25) ou de sirop de chicorée (30). Le sirop tient la jauge
d'endurance pleine trente secondes — il marche **sans toucher au moteur**, en remplissant
`player.energie` dix fois par seconde.

Ne sont pas vendus : le lait ribot (dégâts doublés) et l'eau de la Deûle, qui demandent
d'intercepter les dégâts et la nage. Vendre une fiole inutilisable serait pire que ne pas
la vendre.

### L'armoire

À la place de l'ancien coffre, avec une glace sur la porte de gauche. L'ouvrir met le jeu
en pause, plante la caméra devant Camille et ouvre le panneau de réglages : teint,
cheveux, coiffure (six), yeux, tunique (huit), jupe, cuir, foulard, carrure, taille — plus
« Au hasard » et « D'origine ».

**On tourne autour d'elle** : ← → la font pivoter, ↑ ↓ approchent, et les boutons
*Face / Profil / Dos* la placent d'un coup. Une ligne dit sous quel angle on la regarde.
Chaque réglage se voit tout de suite sur le personnage réel — pas sur un aperçu à part.

L'apparence est rangée dans `state.look` (donc sauvegardée), et un veilleur la repose sur
le maillage à chaque niveau. **Il manque une ligne dans `tavern.js` et `chapelle.js`**
quand tu les libéreras :

```js
import * as LOOK from './look.js';
LOOK.veiller();
```

Sans elle, Camille reprend son apparence d'origine dans ces deux intérieurs.

### Vérifié sur la vraie Camille, celle de la banque

La première passe avait été photographiée sur la Camille en primitives — pas celle du jeu.
La banque d'assets a donc été rapatriée dans le bac à sable (tenue, corps, coiffures,
animations) et tout a été repris sur le **personnage riggé**, avec les noms de maillages
relevés dans le modèle lui-même :

| réglage | maillages touchés |
|---|---|
| Tunique | `Female_Ranger_Body`, `_Arms_1` |
| Épaulières (le foulard n'existe pas sur ce modèle) | `Female_Ranger_Acc_Pauldrons` |
| Jupe et toile | `Female_Ranger_Legs`, `_Head_Hood` |
| Cuir | `_Body_Belt_1`, `_Belt_2`, `_Arms_Bracer`, `_Feet` |
| Teint | `Female_Ranger_Arms_2`, `Superhero_Female_tete` |
| Cheveux, sourcils, yeux | `Hair_*`, `Eyebrows_*`, `Eyes_tete` |

Trois choses n'ont été trouvées qu'en regardant le rendu, et aucune ne se serait vue à la
lecture du code :

1. **Deux façons de colorer, pas une.** Remplacer la teinte de l'atlas (la méthode de
   `pnj.js`) garde la luminance peinte : indispensable pour rendre bleue une tunique
   peinte en vert, inopérant sur les cheveux, dont la texture est presque blanche — du
   blanc teinté reste blanc. Les cheveux et les sourcils se colorent donc par
   multiplication, la tenue par remplacement de teinte, et la peau par les deux : la
   teinte donne le ton, une valeur tirée de la luminance éclaircit ou assombrit, sans quoi
   « Clair » et « Ébène » rendraient la même chose.
2. **`A.rebind` reparente les maillages sous le corps** : après l'appel, l'objet qu'on
   vient de charger est vide. La nouvelle coiffure restait donc blanche — un défaut
   invisible tant qu'on ne changeait pas de niveau, puisque le premier réglage suivant la
   recolorait au passage.
3. **Le blond était trop clair** pour une texture déjà claire : il partait en blanc sous
   la lumière de la fenêtre. La palette a été resserrée.

Vérifié en rendu : le personnage riggé change de tunique, d'épaulières, de teint, d'yeux
et de coiffure (les cinq de la banque : *SimpleParted, BuzzedFemale, Long, Buns, Buzzed*),
et **l'apparence suit d'un niveau à l'autre** — réglée chez Camille, retrouvée intacte
chez le vieux mage après sauvegarde et changement de page.
