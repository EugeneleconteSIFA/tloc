# The Legend of Camille — La Citadelle de Lille

Mini-jeu d'aventure 3D façon Zelda, dans la citadelle de Vauban et la ville de Lille **telles
que la carte les relève** (IGN, cadastre, BD TOPO). Phinaert, le géant brigand, a enlevé le
**prince Eugène** et s'est retranché dans la citadelle : Camille, la jeune gardienne, part le
délivrer — remparts, bastions, donjon, galeries souterraines — pendant que le bourg, le moulin
et les hameaux ont besoin d'elle. On y joue seul, ou à plusieurs dans des instances en ligne,
chacun pour soi ou en équipes.

---

## Lancer le jeu

```bash
./lancer.sh            # puis http://localhost:8000
```

Un seul serveur (`serveur/app.py`, FastAPI) sert **les pages et l'API** : comptes, parties,
instances et salon multijoueur (WebSocket). Le premier lancement installe son environnement
Python. `python3 -m http.server` ne sert que les fichiers : le jeu tourne, mais pas l'accueil,
les comptes ni le multi. Mise en ligne : `serveur/deploiement.md` (nginx, certificat — le
multi passe en `wss://`).

- `http://localhost:8000/` — le portail : connexion, inscription, ou jouer sans compte ;
- l'**accueil** : ses parties solo (nommées, sauvegardées dans le navigateur et, avec un
  compte, sur le serveur), ses instances multijoueur, la création d'une instance ;
- `index.html` — le jeu directement.

---

## Contrôles (clavier AZERTY + souris)

| Touche | Action |
|---|---|
| Z Q S D ou flèches | se déplacer (relatif à la caméra) ; **Z + S** : courir (jauge d'endurance) |
| Souris | un clic capture la souris : elle oriente le regard (Échap la rend) |
| Clic gauche ou **F** | coup d'épée — il **fauche** aussi l'herbe, le blé et les meules ; tir à l'arc quand l'arc est en main |
| **C** | sortir / ranger l'arc |
| Clic droit ou Maj | roulade (invincible pendant la roulade) |
| Espace ou X | sauter |
| **Entrée** | parler, ouvrir, entrer, dormir ; avancer les dialogues |
| **J** | journal des quêtes |
| **M** | la carte de la châtellenie (une fois trouvée au beffroi) ; **Maj + M** : musique |
| **I** | la poche : armes et outil, objets, gourdes |
| **G** | manger une gaufre de la poche |
| **B** | boire la plus ancienne gourde |
| **T** | écrire aux autres joueurs (en instance) ; `/aide` pour les commandes |
| 1 à 4 | qualité graphique (elle baisse seule si le jeu rame) |
| P / O | post-traitement / ombres (gain de fluidité) |
| F3 | compteur de rendu : images/s, appels de dessin, triangles |
| Échap | pause : reprendre, sauvegarder, quitter, retour à l'accueil |

---

## L'aventure (solo)

1. **Ouverture** : Phinaert enlève le prince au pied du pont. Lydéric, le géant ami, donne
   l'épée.
2. **La citadelle** : remparts, cinq bastions, fossés en eau. Les moules des fossés ne se
   touchent qu'à l'**arc**, dans un coffre du bastion de Turenne.
3. Dix monstres vaincus : la grille du donjon se lève, **Phinaert** sort. Vaincu, il libère
   l'escalier en colimaçon du donjon et la clé de la poterne.
4. **Les galeries de Vauban** (sous la poterne) : fosses, levier, rats, chauves-souris, et le
   **Rat-Roi** qui garde la clé de la cage du prince. Libéré, le prince suit Camille jusqu'à
   Lydéric : fin de l'histoire.
5. **Le bourg** : six villageois riggés, dont trois qui font leur tournée ; quêtes
   secondaires (le chat Pralin, les corbeaux d'Émile, les fantômes de Désiré), chacune pour
   un cœur. Le **beffroi** se monte (onze tours de colimaçon) : au sommet, une énigme ouvre
   la **carte** de la châtellenie (touche M).
6. **Les lieux où l'on entre** : l'estaminet de Gustave (gaufres, clients attablés), la
   chapelle Saint-Roch, la maison de Camille (le lit soigne et sauvegarde, l'armoire habille,
   le coffre de la mezzanine donne la bourse), la chaumière du vieux mage (au fond du bois,
   on ne la trouve qu'en écoutant Séraphin à l'estaminet).
7. **La campagne** : le moulin d'Émile et ses quatre champs de blé, les meules de foin, le
   lavoir, le hameau des Wattines, la voie des combattants.

**La carte fait foi** : la Deûle, les canaux, les étangs, les ponts relevés (culées sur le
sol réel, arches au-dessus des chemins), 1 710 bâtiments du quartier élevés depuis la BD TOPO
avec leurs pignons à redents, les haies et les bois relevés.

La partie se sauvegarde seule (toutes les 20 s, et aux moments clés) dans le navigateur ;
avec un compte, elle remonte aussi sur le serveur.

---

## Les écus, la poche, l'équipement

- **La bourse** se trouve chez Camille (coffre de la mezzanine) : avant, aucun écu ne compte.
- **Gagner** : les monstres ont une prime (corbeau 1–2, moule 3, fantôme 4, Rat-Roi 25,
  Phinaert 60) ; l'épée **fauche** l'herbe, les touffes, les fougères, les buissons et le
  blé (un écu de temps en temps) et les **meules de foin** (2 à 5 écus par brassée) ; un
  buisson sur quarante est **doré** et paie 5 écus ; **huit petits coffres** sont cachés
  (beffroi, bastions, galeries, hameau). La verdure est plafonnée à 40 écus par zone et par
  dix minutes ; ce qui est fauché repousse en 90 s (les meules en 4 min).
- **Les gaufres** tombent parfois de la verdure (plus souvent quand Camille est blessée) et
  rendent deux cœurs ; en pleine santé, elles vont dans la **poche** (touche I, G pour en
  manger une).
- **Dépenser** : le vieux mage (une gourde, onguent, sirop de chicorée), le **colporteur** au
  bout du marché (places de poche, gourdes 2 et 3, flèches, carquois, un réceptacle de cœur),
  **Émile** et sa **faux** (on fauche plus large, les meules donnent plus).
- **Le carquois** compte ses flèches (20, puis 40 et 60) ; les corbeaux en rendent.
- **L'armoire** (chez Camille) : teint, cheveux, coiffure, yeux, tunique, toile, cuir,
  épaulières, carrure, taille — sur le personnage réel, qu'on fait tourner.

---

## À plusieurs (instances)

Une **instance** est une balade partagée, avec un code à six caractères : pas de quête
principale, une sauvegarde à part qui ne touche jamais aux parties solo.

- **À l'entrée** : l'armoire (c'est cette Camille que les autres verront), puis la **carte**
  pour choisir où l'on apparaît — le premier point de l'hôte devient le **rendez-vous**,
  présélectionné pour les suivants.
- **Chacun sa Camille** : les autres joueurs sont riggés, animés, habillés de leurs réglages ;
  un coup reçu les fait rougir chez tout le monde.
- **Chat** (T) et commandes : `/donner Nom 20` (donner des écus), `/fete` (l'hôte lance la
  **fête de la moisson** : trois minutes, le plus gros fauchage gagne), `/aide`.
- **Options à la création** : le **mode** et la **bourse en jeu** (mis à terre par un joueur,
  on lâche le cinquième de ses écus ; le premier arrivé les ramasse).
- **Mode en équipes** (8 joueurs) : la garnison contre les gens du bourg, tunique et plaque
  aux couleurs du camp, pas de tir ami, un point par adversaire mis à terre, un ralliement
  par camp, et une **bannière** à prendre chez l'adversaire et à rapporter chez soi (3
  points).
- La maison de chacun reste privée : on n'y croise personne.

---

## Bestiaire

| Monstre | Coups | Où | Prime |
|---|---|---|---|
| Corbeau de la citadelle | 2 | champs, remparts | 1–2 écus, 1–2 flèches |
| Moule mutante | 4 | fossés (à l'arc) | 3 |
| Fantôme de la garnison | 5 | remparts | 4 |
| Rat des galeries / chauve-souris | 3 / 2 | galeries | 3 / 1–2 |
| Rat-Roi | 12 | galeries | 25 |
| **Phinaert** | 28, onde de choc à esquiver en roulade | donjon | 60 |

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `engine.js` | moteur commun : rendu, chargement par étapes, combat, HUD, menus, sauvegarde, fusion des décors, unification des matériaux, préparation du rendu |
| `carte.js` | la carte réelle : relief, eaux, ponts, voies, bourg, bastions, zones nommées |
| `game.js` / `citadelle.js` / `quetes.js` | le niveau citadelle, sa construction, sa quête |
| `quartier.js` / `village.js` / `campagne.js` / `nature.js` / `foret.js` / `promenade.js` | la ville relevée, le bourg, la campagne, la végétation semée par tuiles et la fauche |
| `cave.js`, `house.js`, `tavern.js`, `chapelle.js`, `mage.js` | les intérieurs (une page chacun) |
| `pnj.js`, `geants.js`, `look.js` | personnages riggés, géants, apparence et armoire |
| `bourse.js` | l'économie : écus, primes, poche, gourdes, carquois, coffres, boutiques |
| `atlas.js`, `hud.js` | la carte plein écran (et le choix du point d'apparition), la minicarte |
| `tloc-compte.js`, `tloc-multi.js`, `accueil.*`, `connexion.*` | comptes, parties, instances, salon multijoueur |
| `serveur/app.py` | le serveur : pages, API, WebSocket (équipes, fête, bourses, bannières) |
| `bancs/` | les bancs de mesure du chargement (`charge.mjs`, `profil.mjs`) |
| `lib/` | Three.js r160 et ses modules (embarqués, pas de CDN) |
| `bump.py` | aligne les `?v=` après une modification d'`engine.js` |

Bancs d'essai visuels : `demo-bestiaire.html`, `demo-pnj.html`, `demo-animations.html`,
`demo-personnages.html`, `demo-decors.html`, `assets-browser.html`.

---

## Performance

Le chargement passe avant les nouveautés (règle 8 de `CLAUDE.md`) : **21,4 s** à froid au
banc (25 septembre), dont 8,6 s de préparation du rendu, toujours avec une barre qui avance.
En jeu : fusion des décors par tuiles de 150 m, lots (`BatchedMesh`), instances en tuiles,
matériaux unifiés, réserve de lumières, qualité adaptative. Les chiffres et les leviers
restants sont dans `PROMPT-REPRISE.md`, § 4.E.

---

## Documentation

| Fichier | Pour quoi |
|---|---|
| `CLAUDE.md` | les règles de travail (à lire en premier) |
| `PROMPT-REPRISE.md` | l'état du chantier, ce qui reste, ce que le code a appris |
| `NOTE-MULTI.md` | le multijoueur en détail |
| `REPONSE-EQUIPEMENT.md` | la spécification de l'économie et de l'équipement |
| `BRIEF-CARTE.md`, `NOTE-CAMPAGNE.md`, `NOTE-INTERIEURS.md` | la carte, la campagne, les intérieurs |
| `CONTEXT.md`, `BRIEF-DESIGN.md`, `REPONSE-PERSONNAGES.md`, `REPONSE-GEANTS.md` | l'histoire technique et la direction artistique |
