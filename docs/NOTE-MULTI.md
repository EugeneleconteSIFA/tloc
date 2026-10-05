# Parties nommées et jeu à plusieurs

## Ce qui a été ajouté (et ce qui n'a pas été touché)

Aucun fichier du moteur n'a été modifié. `engine.js`, `game.js`, `carte.js`, `quartier.js`,
`citadelle.js`, `village.js`, `nature.js`, `quetes.js`, `chapelle.js`, `tavern.js` sont
inchangés. Seul `index.html` reçoit **une ligne** : le chargement de `tloc-multi.js`.

| Fichier | Rôle |
|---|---|
| `connexion.html` / `connexion.js` | le portail : connexion, création de compte |
| `accueil.html` / `accueil.js` | l'accueil du compte : parties et instances |
| `tloc-portail.css` | l'habillage commun aux deux pages |
| `tloc-compte.js` | le compte, les parties (slots) et l'API — partagé accueil ↔ jeu |
| `tloc-multi.js` | chargé par `index.html` : range la sauvegarde, bouton Accueil, salon multi |
| `serveur/app.py` | FastAPI : comptes, parties, instances, relais WebSocket |
| `serveur/deploiement.md` | la mise en ligne sur tloc.kernse.fr |

## Deux pages

`connexion.html` est la porte d'entrée (c'est elle que sert la racine du site) : connexion,
création de compte, ou « jouer sans compte » pour rester en local. Une fois la session
ouverte, tout se passe sur `accueil.html` : les parties et les instances. Un compte déjà
connecté qui arrive sur le portail est redirigé sans rien avoir à cliquer.

Le **nom de la partie est le nom du personnage** : c'est lui qui s'affiche au-dessus de la
tête, dans les messages de mort et dans le panneau du salon ; le pseudo du compte
n'apparaît qu'en petit, pour savoir qui est qui. En instance, le nom se saisit à l'entrée
(champ « Ton personnage » sur la ligne de l'instance), puisqu'on n'y emmène pas de partie.

## Les menus du jeu à la souris

Le moteur ne pilote ses menus qu'au clavier. `tloc-multi.js` se greffe dessus sans le
modifier : un clic (ou le survol) sur une ligne de menu agit sur `menu.sel` et appelle le
même `fn()`, et une entrée « ← Accueil » est ajoutée à la liste — donc accessible au clavier
comme à la souris, sur l'écran titre comme dans la pause. Un bouton de coin fait la même
chose, masqué quand la souris est capturée par le jeu.

## Les parties, sans toucher au moteur

Le moteur écrit toujours dans la clé `tloc_save_v2`, comme avant. Une partie nommée est
une **copie** rangée sous `tloc_save_v2:<id>` :

- l'accueil recopie la partie choisie dans `tloc_save_v2`, puis ouvre `index.html` ;
- en jeu, `tloc-multi.js` surveille cette clé toutes les trois secondes et recopie dans
  l'autre sens dès qu'elle change (et à chaque fois que l'onglet passe en arrière-plan) ;
- si le joueur a un compte, la partie est poussée sur le serveur au plus toutes les
  30 secondes, et à la fermeture de l'onglet.

Une sauvegarde d'avant ce système est récupérée à la première visite de l'accueil, sous le
nom « Partie de test » : rien n'est perdu.

## Le multi

Une instance, c'est un code à six caractères et quatre places. Le monde n'est **pas**
synchronisé : chacun a ses monstres et ses coffres. Ce qui circule, ce sont les joueurs
(position, regard, cœurs, quinze fois par seconde) et les coups qu'ils se portent.

### Une instance n'est pas une partie

C'est le point à garder en tête. Une instance ne joue **ni l'intro, ni la quête
principale, ni les quêtes secondaires, ni le journal** : on entre l'épée déjà au côté,
dans la citadelle peuplée de ses monstres, pour se balader et se battre. Le HUD y montre
les compteurs de monstres et l'état de Phinaert, plus le nom de l'instance — pas
d'objectif.

En pratique, `tloc-multi.js` pose quatre drapeaux dans `state` avant que le niveau ne se
peuple (`introSeen`, `sword`, `metLyderic`, et les trois quêtes de village marquées
rendues, ce qui fait que les villageois n'ont plus rien à demander), remplace `counts`,
`start`, `arriveMessage` et `entry` sur l'objet niveau **en mémoire**, et intercepte la
touche J avant le moteur. Aucun fichier du moteur n'est modifié.

Et surtout : **une instance a sa propre sauvegarde**, sous `tloc_save_v2:inst:<CODE>`,
qui ne monte jamais sur le compte. Une balade à plusieurs ne peut donc pas venir écrire
dans une partie solo — c'était le vrai risque, puisque les drapeaux ci-dessus ruineraient
une progression. Le nom du personnage se choisit à l'entrée de l'instance, ligne par
ligne, et n'a rien à voir avec les parties solo.

Quitter une instance depuis l'accueil efface aussi sa sauvegarde de balade.

Le client annonce ses coups ; le serveur vérifie seulement qu'ils sont plausibles (moins de
7 m, pas plus d'un coup toutes les 0,22 s, dégâts bornés) et prévient la victime, qui
applique elle-même les dégâts. Entre amis, ça suffit ; ce n'est pas à l'épreuve de la triche.

### Entrer : l'armoire, puis la carte

À la première entrée dans une instance (rien dans sa sauvegarde), `tloc-multi.js` ouvre
l'armoire (`LOOK.ouvrirArmoire(suite)`) : chacun choisit sa Camille, c'est elle que les
autres verront. En refermant, la carte s'ouvre en mode choix (`ATLAS.choisirPoint`) : un
clic désigne un endroit, `praticable()` le recale en spirale (jusqu'à 30 m) sur un sol sec
(`sdEau ≥ 2`), libre (`blocked`) et dans les limites — la carte fait foi, on n'apparaît pas
dans le fossé. Le point est gardé dans `state.apparition`, donc dans la sauvegarde de
l'instance : les entrées suivantes reprennent là où l'on était, sans rien redemander.

### Chacun sa Camille

Les autres joueurs sont des Camille **riggées** (`PNJ.buildCamille`), habillées de leurs
propres réglages par `LOOK.appliquerSur(mesh, réglages)` et animées par les vrais clips
(`PNJ.animeCamille`, avec un « joueur » fictif : allure mesurée, coup, roulade). La
version en primitives ne reste qu'en repli, et un avatar né avant que la banque soit prête
est refait dès qu'elle l'est.

L'apparence circule dans un message à part, `{t:'look', l}` : envoyé à l'arrivée puis
seulement quand il change. Le serveur ne garde que des entiers 0–31 sous les dix clés
connues (`look_propre`), et le client recale le reste sur les palettes (`LOOK.normaliser`).
Elle figure aussi dans `bienvenue`, pour les joueurs déjà là.

### Le rendez-vous de l'hôte

Le premier point choisi par l'hôte devient le rendez-vous de l'instance (colonne `rdv` de
la table `instances`, ajoutée d'office aux bases existantes). Il part au serveur dans un
message `{t:'rdv', x, z, nom}` — refusé s'il ne vient pas de l'hôte — et arrive aux autres
dans `bienvenue` ou en direct. À leur première entrée, la carte l'affiche en étoile et le
présélectionne : Entrée suffit pour rejoindre les autres, un clic ailleurs pour s'en écarter.

### Voir les coups, se parler

La victime seule apprend qu'elle est touchée, mais elle renvoie ses cœurs quinze fois par
seconde : chez les autres, une baisse fait rougir son avatar un instant (émissif, rendu
matériau par matériau), lâcher une gerbe et jouer le clip « touché ».

**T** ouvre la boîte de chat, Entrée envoie, Échap annule. Le serveur relaie à tout le
salon, expéditeur compris ; les cinq derniers messages s'affichent sous la liste des
joueurs et s'effacent au bout de vingt secondes. Tout ce qui vient des autres joueurs
(noms, messages, nom du rendez-vous) est écrit en texte, jamais en HTML.

### Le mode en équipes (25 septembre)

Choisi à la création de l'instance (accueil : liste « Mode »), avec l'option **bourse en
jeu**. Colonnes `mode` et `enjeu` de `instances`, ajoutées d'office aux bases existantes.

- **Deux camps**, la garnison (bleu de garde) et les gens du bourg (rouge de Flandre),
  **8 places**. Le camp se choisit à l'entrée, entre l'armoire et la carte ; il est gardé
  dans la sauvegarde de l'instance (`state.camp`) et redit au salon à chaque reconnexion.
  Le serveur refuse un camp qui aurait deux joueurs de plus que l'autre.
- Le camp **impose la tunique** (zone `tunique` de look.js) et la couleur de la plaque.
- **Pas de tir ami** : le serveur ignore un `coup` entre alliés (et le client ne l'envoie pas).
- **Points de camp** : une mise à terre d'un adversaire = un point (`salon.points`, dans
  `mort` et `bienvenue`).
- **Un ralliement par camp** : le premier des siens qui choisit son point le pose
  (`rdv` devient `{ garnison: {...}, bourg: {...} }`).

### Les bannières (en équipes)

Chaque camp a sa bannière, plantée à son ralliement. Prendre celle de l'adversaire
(`saisir`, à moins de 4 m) et la rapporter chez soi pendant que la sienne y est
(`rapporter`) vaut **3 points**. Porteur mis à terre ou parti : la bannière tombe sur
place ; un allié qui la touche la renvoie chez elle, sinon elle y rentre seule au bout
de 30 s (`TLOC_BANNIERE_RETOUR` au banc). Le serveur tient l'état et vérifie les
distances (position annoncée dans `etat`) ; le client dessine la hampe, le drap qui bat
au vent, et demande quand il est assez près — on n'a aucune touche à presser. L'état
des deux bannières est dans le panneau.

### La bourse en jeu

Option d'instance. Mis à terre par un joueur, on lâche le cinquième de ses écus (retirés
chez la victime, `BOURSE.perdre`). Le serveur pose la bourse (`bourse`, 90 s au sol) et
la donne au **premier** qui l'atteint à moins de 4 m (`ramasser` → `bourse-prise`) : ce
sont les clients qui demandent, le serveur qui tranche.

### La fête de la moisson

`/fete` dans le chat (T), par l'hôte : trois minutes, bannière en haut de l'écran. Chaque
client annonce ce qu'il a fauché depuis la seconde précédente (`recolte`, compteur de
nature.js) ; le serveur écrête à 40 plantes par seconde, tient les scores et proclame la
fin (`fete-fin`). Chacun pour soi : 30 écus au premier. En équipes : le camp qui a le plus
fauché gagne, 15 écus à chacun des siens. `TLOC_FETE_DUREE` raccourcit la fête au banc.

### Les dons

`/donner Nom 20` : retiré de sa bourse, porté par le serveur (borné à 999), crédité chez
l'autre, et annoncé dans le chat. `/aide` rappelle les commandes.

### La maison de chacun

La maison de Camille est une page à part (`house.html`) qui ne charge pas `tloc-multi.js` :
on n'y voit jamais les autres joueurs, et chacun y a la sienne, à la même place sur la
carte. Dehors, le monde étant local, chaque joueur ne voit que sa propre maison.

Mourir sous les coups d'un joueur ne termine pas la partie : Camille réapparaît près du
point choisi à l'entrée, tous cœurs rendus. Mourir sous les coups d'un monstre garde la règle du
solo — la fin de partie normale du moteur.

Les intérieurs (galeries, estaminet, maisons) sont des pages à part : le salon s'y
déconnecte et se reconnecte au retour dans la citadelle. Les autres joueurs restent
visibles uniquement s'ils sont sur la même carte que soi.

## Essayer en local

```bash
./lancer.sh
```

Puis `http://localhost:8000/` (l'accueil) — le même serveur sert le jeu et l'API.
Pour un banc sans deuxième navigateur : un client WebSocket nu (Node 22+ l'a en natif)
qui envoie `look` puis des `etat` joue très bien le second joueur. Pour
tester à deux sur une seule machine : un navigateur normal et une fenêtre privée, sinon les
deux onglets partagent le même compte.

### Les bots (25 septembre)

Choisis à la création de l'instance (tuile « Ouvrir une partie ») : un nombre, un niveau —
**recrue**, **soldat**, **vétéran**. Douze joueurs au plus, bots compris : chaque bot prend une
place, et les humains gardent au plus 4 (chacun pour soi) ou 8 (en équipes). Avec onze bots,
c'est la partie « contre l'ordinateur ». Avec des bots, « Créer » devient « Créer et jouer ».

- **Qui les fait vivre.** Le serveur ne connaît pas le terrain : les bots tournent dans le
  navigateur d'un humain du salon, leur *pilote* (l'hôte s'il est là, sinon le premier
  arrivé ; repris par un autre si le pilote part). Côté serveur, un bot est un `Connecte`
  sans websocket, d'identifiant négatif, avec un `pilote`.
- **Comment ils parlent.** `{ t: 'bot', b: id, m: <message> }` : le serveur le traite par la
  même fonction `traiter()` que les messages des joueurs — portée et cadence des coups,
  pas de coup entre alliés, scores, bannières. Ce qui est adressé à un bot (un coup reçu)
  arrive au pilote en `{ t: 'pour-bot', b, m }`.
- **Les niveaux** (`NIVEAUX` dans tloc-multi.js) : vitesse, temps de réaction, portée du
  regard, élan du coup, cadence, probabilité d'esquive (roulade), seuil de repli, envie
  d'aller chercher la bagarre. Les vétérans (et un soldat sur deux) vont prendre la
  bannière adverse en équipes.
- **En équipes**, les bots comblent le camp le plus faible, et s'écartent quand un humain
  choisit un camp. Un camp sans humain voit son ralliement posé par un de ses bots, à 70 m
  de l'autre.
- Mesuré au banc : 3 soldats viennent au contact et frappent ; 11 vétérans en équipes
  (6 contre 6) se battent entre camps, roulent, emportent la bannière ; pas de coup sur les
  alliés. La console expose `TLOC_MULTI.bots` pour le débogage.

### Les règles, les manches et les badges (25 septembre)

Par-dessus le mode (chacun pour soi / en équipes), une **règle** choisie à la création :
**balade** (l'origine, sans fin), **match à mort** (`survie`, 1 à 5 vies, le dernier debout —
ou le dernier camp — gagne), **chrono** (`temps`, 2 à 10 min à l'accueil, 1 à 15 côté serveur,
classement « mis à terre − tombé »).

- **L'arbitre est le serveur** (`Salon.preparer / commencer / terminer`) : compte à rebours
  dès qu'on est deux (bots compris), scores tenus à partir des `coup` et `mort` relayés,
  résultats, puis nouvelle manche. Un retardataire entre au chrono, regarde en match à mort.
- **Côté jeu** (tloc-multi.js, « Les manches ») : bandeau en haut (chrono, vies, en lice),
  remise à zéro au début d'une manche, élimination (on ne se relève plus, à l'abri, sans
  frapper), écran de résultats. Les bots suivent les mêmes règles.
- **Badges d'honneur** (`BADGES` dans app.py, seule source des noms et des phrases) :
  vainqueur, première lame, faucheur (3 d'affilée), vengeur, opportuniste (≥ 60 % des coups
  sur des cibles à ≤ 40 % de cœurs, ≥ 2 mises à terre), bourrin (le plus de cœurs arrachés,
  ≥ 3), increvable (chrono sans tomber), tête brûlée (le plus souvent à terre, ≥ 3). Comptés
  dans la table `badges` pour les humains ; `GET /api/badges`.
- Au banc : `TLOC_MANCHE_COMPTE`, `TLOC_MANCHE_DUREE`, `TLOC_MANCHE_PAUSE` raccourcissent tout.

### Le social de l'accueil (25 septembre)

`accueil-social.js`, chargé par accueil.js seulement. « Mon compte » (en haut à droite) a
trois onglets : **Mon profil** (photo recadrée à 160 px dans le navigateur, devise, infos),
**Amis** (recherche par pseudo, demande, acceptation), **Badges**. La **bulle de chat** (en
bas à droite) : conversations à deux (retrouvées, jamais en double) ou en groupe, entre
amis seulement ; le bouton ⚔ crée une partie et l'envoie dans la conversation, ou envoie
une partie existante ; la carte d'invitation a un bouton « Rejoindre » qui entre en jeu.
Pas de temps réel : lecture toutes les 3 s conversation ouverte, 20 s sinon
(`/api/non-lus`). Tables `amis`, `convs`, `conv_membres`, `messages` ; colonnes `photo`,
`devise` sur `joueurs`.

### Les retours des testeurs (25 septembre)

Bandeau « Accès anticipé » sous le titre de l'accueil : « faites tous vos retours au
créateur » — le lien ouvre une conversation avec le compte **Createur**, sans demande
d'ami (`convs.retour = 1`). Ce compte est réservé (inscription refusée sous ce pseudo) et
ne naît qu'au démarrage du serveur, avec le mot de passe de `TLOC_CREATEUR_MDP`
(`assurer_createur()` ; une seule fois, ensuite la variable est inutile). Connecté en
Createur, le bandeau compte les retours et la bulle les range en tête de liste.

### L'équipement : l'armure et l'écu (26 septembre)

Deux objets, posés à des lieux fixes pour qu'on apprenne où courir : **l'armure aux
casernes**, **l'écu sur la place d'Armes** (le premier client propose un point praticable
près du lieu nommé, `objets-lieux` ; le serveur garde ce premier choix). Un présentoir
lumineux et un point sur la minicarte (`PARTAGE.marques`, hud.js) tant qu'ils attendent.
- **Qui les prend** : le serveur tranche (`objet-prendre`, 4 m, premier arrivé), et
  annonce `objets` avec `evt: 'pris' | 'casse' | 'retour' | 'raz'`. Une manche neuve rend
  tout à sa place (`raz_objets` dans `commencer`) ; celui qui s'en va rend ce qu'il portait.
- **L'écu** se garde, même après une mort. **Clic droit maintenu** (engine.js,
  `mouse.garde` → `player.garde`) : Camille ralentit (×0,4), fait face au regard, ne frappe
  plus, et pare tout coup venu de face (±60°, ±83° cerclé de fer). Clip `Sword_Block`, et
  un second écu tenu devant la poitrine pendant la garde (pnj.js, `ecuGarde`).
- **L'armure** encaisse avant les cœurs (`absorber`, dans `encaisser`) : 4, 5 ou 6 cœurs
  (cuir clouté, mailles, plates — Eugène, 27 septembre). Brisée, elle ne revient qu'à la
  manche suivante (`brise`, remis à zéro par `raz_objets`). Sa jauge : des cœurs d'acier au
  bout des cœurs rouges.
- **La forge du bourg** (Entrée devant « À l'enclume ») : mailles 40 écus, plates 70,
  réparation 12, écu cerclé 50. Les niveaux restent côté client ; les autres les voient par
  l'état (`ar`, `bc`, `gd` dans le message `etat`) et `PNJ.animeCamille` habille l'avatar.
- **Les bots** ne ramassent rien ; ils subissent la parade et l'armure comme tout le monde.
- Banc : `banc-equip.mjs` (scratchpad) — ramassage, parade de face, armure qui se casse et
  revient, achats à la forge, gros plans de la garde.
- **Le dessin** (27 septembre, pnj.js, « Les armes et les armures de Camille ») : épée à
  gouttière et garde courbe ; rondache peinte aux armes de Lille (lys d'argent sur gueules) ;
  écu aux trois lys d'or de la garnison ; cuirasse galbée (LatheGeometry) en trois matières
  peintes sur canevas. Les présentoirs réutilisent les mêmes pièces (`PNJ.faireEcu`,
  `PNJ.faireCuirasse`). La flèche fait un demi-cœur (`DEGATS_FLECHE = 1`).

### Le cheval (27 septembre)

Un cheval par partie, dans une écurie (auvent, râtelier, auge) posée sur un rectangle libre
à 14–26 m du moulin d'Émile (`placeEcurie`). Entrée pour monter, Entrée pour descendre : il
reste là où on l'a laissé, avec la vie qui lui reste (`objet-poser`, le serveur garde `p`,
`y`, `pv`, `yaw`). En selle : vitesse ×1,7, ni roulade ni saut (`G.monte`, engine.js) ; le
cheval encaisse avant l'armure et les cœurs (`blesserCheval`, 5 cœurs fauves après les
autres) ; arrêté plus d'une seconde, il broute et regagne un demi-cœur toutes les 2,5 s.
Mort : un cheval frais revient à l'écurie après `OBJET_RETOUR` (45 s). Manche neuve : il
rentre à l'écurie, reposé. Les autres voient le cavalier en selle (`ch` dans `etat`).
- Modèle : `assets_back/02_personnages/animaux/cheval.glb` (Quaternius, CC0 ; `glb.py`),
  chargé à la demande en instance seulement ; échelle calculée sur le maillage déformé
  (tête à 2,35 m) ; il regarde vers −z (`DOS_CHEVAL`).
- Camille en selle : la pose assise (`Sitting_Idle_Loop`), remontée de `SELLE` (0,62 m) par
  le pivot, cuisses écartées et jambes le long des flancs par `enfourcher()` (pnj.js,
  réglages `MONTE`, choisis au banc entre une quinzaine d'essais). Les bots ne montent pas.
- **La frappe en selle (29 septembre)** : le coup se donne au galop (90 % de la vitesse au
  lieu de 25 % à pied) et porte plus loin et plus large (`EPEE_SELLE`, engine.js : 3,4 m et
  ±1,7 rad au lieu de 2,6 m et ±1,25), contre monstres, joueurs et bots. Le buste se penche
  vers le côté de l'épée et un peu en avant le temps du coup (`SELLE_PENCHE`, pnj.js : X de
  ces os = côté, Z = avant, lus à l'image) ; la pose d'avant l'inclinaison est retenue et
  rendue si le mixeur ne réécrit pas l'os — sans quoi l'inclinaison s'accumulait et Camille
  finissait retournée derrière le cheval. Vérifié : une moule à 3,8 m est touchée à cheval,
  pas à pied.

### Deux de chaque, et l'arc (27 septembre)

Eugène : deux enclos à chevaux, deux spots d'arc, deux d'armure. Chaque objet a donc un
identifiant (`PLAN_OBJETS`, tloc-multi.js) et un type ; le serveur refuse qu'un joueur
porte deux objets du même type. Où ils sont :
- `armure-1`, `armure-2` : deux casernes (à défaut de la seconde, le donjon) ;
- `bouclier` : la place d'Armes ;
- `arc-1` : la poterne ; `arc-2` : la chapelle Saint-Roch. L'arc donne l'arc (s'il manque)
  et vingt flèches ; il repart avec la manche (`arcPris`), pas celui du coffre de Turenne ;
- `cheval-beige` (cheval.glb) : l'écurie du moulin ; `cheval-blanc` (cheval_blanc.glb) :
  l'écurie de la chaumière du vieux mage, à l'autre bout de la carte.
Sur la carte du beffroi, « LE VILLAGE » s'écrit maintenant en nom de quartier (atlas.js) :
comme simple point, il perdait toujours la place au beffroi, à l'estaminet, à la chapelle
et à l'école, et ne s'écrivait jamais.

### La prise des drapeaux (28 septembre)

Une quatrième règle, en équipes seulement (l'accueil ne la montre qu'en équipes ; le
serveur force le mode) : **Drapeaux**, sur la durée du chrono.
- **Combien** : arrondi supérieur(joueurs, bots compris ÷ 2) − 1, au moins un, au plus cinq
  (Eugène ; `nb_drapeaux`, fixé au début de chaque manche).
- **Où — tirés au sort** (Eugène : « aléatoirement entre une vingtaine de positions ») : le
  premier client, une fois sa grille des chemins prête, propose 20 emplacements
  (`drapeaux-lieux`) : des cases de l'intérieur de l'enceinte (à 12 m des courtines), au
  cercle de 8 m entièrement libre, reliées à la place d'Armes, retenues de proche en proche
  par la plus grande distance aux précédentes. Chacun reçoit un nom (le lieu le plus proche,
  sinon la zone, « côté nord-est » s'il se répète). À chaque manche, le serveur en tire
  `n` au hasard, écartés d'au moins 110 m — l'écart se relâche s'il n'en trouve pas assez
  (`tirer_drapeaux`). Jamais le donjon : son enclos a une grille fermée (Phinaert).
- **Prendre** : le serveur compte les vivants de chaque camp dans chaque cercle, quatre
  fois par seconde (`veiller_drapeaux`). Un camp seul : la jauge monte (8 s seul, jusqu'à
  deux fois plus vite à trois) ; deux camps : contesté, rien ne bouge. Un drapeau adverse
  se rabat (neutre) avant de se lever à ses couleurs. `TLOC_DRAPEAU_PRISE` au banc.
- **Gagner** : à la fin du chrono, le plus de drapeaux ; à égalité, le plus long temps de
  tenue cumulé. Classement sur les drapeaux pris ; badge **Conquérant** (le plus, deux au
  moins). Les bannières sont rangées pendant cette règle.
- **Le dessin** : mât de chêne sur un socle de pierre, étendard qui grimpe avec la jauge,
  cercle qui épouse le terrain et un arc de jauge à l'intérieur, qui clignote contesté ;
  points à leurs couleurs sur la minicarte ; bandeau (chrono, ⚑ par drapeau, ce que je
  suis en train de prendre) ; écran de fin avec le décompte.
- **Les bots** vont au drapeau le plus proche qui n'est pas à eux, un sur trois garde ceux
  qu'on entame, et un drapeau déjà visé par un allié est moins tentant (sinon, mêlée au
  centre). En route, ils ne se battent que contre qui barre le chemin ou tient le cercle.
  Leurs chemins : une grille de praticabilité de 1,5 m sur les points forts (≈ 70 000
  cases, 400 ms en tout, remplie 3 ms par image — jamais d'écran figé), puis un champ de
  distances par drapeau ; ils décrochent sur l'ancien contournement si la grille se trompe.
  Ils ne naissent plus dans les parterres clos de grilles de la place (ils n'en sortaient
  pas : un joueur saute la grille, pas un bot).
- **Les bots dès l'arrivée** : ils vivent dès que la citadelle est bâtie, sans attendre que
  l'humain ait choisi apparence, camp et point d'arrivée (la manche, elle, a déjà commencé),
  et la pause du pilote ne les fige plus. Sans ralliement ni point choisi, ils partent de
  la place d'Armes.
- **Sur les cartes** : en instance, la carte du beffroi (M) est donnée d'office. Minicarte,
  carte M et carte du choix d'arrivée montrent les drapeaux en petits drapeaux à la couleur
  de leur camp, et, en équipes, chaque joueur (bots compris) en point à la couleur du sien
  (`PARTAGE.marques`, `forme: 'drapeau' | 'joueur'`, dessinés par `glyphe` de hud.js).

### Équipement égal en équipes (28 septembre)

En équipes, chacun a l'arc et un carquois plein à l'arrivée, au début de chaque manche et à
chaque relève (`equiperEquipe`) ; les râteliers d'arc s'effacent, et tous les bots tirent.

### Parler à son camp (28 septembre)

En équipes, la boîte du chat (T) s'ouvre sur son camp — bordure à ses couleurs — et **Tab**
bascule vers tout le monde. Le serveur ne remet un message `e: 1` qu'aux humains du camp ;
il s'affiche marqué « [camp] ». Les bots n'ont que ce canal : ils y disent leurs intentions
(« Je m'occupe du donjon. », « Ils sont 3 sur la poterne, venez m'aider ! », « J'ai leur
bannière ! Couvrez-moi… », « Je suis à bout, je décroche un instant ! ») — une phrase par
bot toutes les dix secondes au plus, une par camp toutes les trois, et rien à un camp sans
humain pour la lire. Le chat est en bas à gauche, au-dessus du bouton « Accueil » : à
droite, sous la liste des joueurs, il finissait sur l'aide des touches à dix joueurs.

### L'armoire qui mettait six secondes (28 septembre)

Mesuré (profileur, `armoire.mjs` du scratchpad) : 5,8 s entre « Entrée » et l'armoire en
instance, dont 3,4 s d'un bloc — la compilation de shaders. Trois causes, trois corrections :
- l'armoire coupait tout le post-traitement pour une Camille nette : la scène se dessinait
  alors droit à l'écran, et three.js recompile chaque matériau pour cette sortie. Elle
  n'éteint plus que le flou (`bokeh`, look.js) ;
- la précompilation du chargement (`prechaufferRendu`, engine.js) visait l'écran, pas
  l'image du post-traitement où le jeu dessine : rien ne servait, tout se recompilait au
  lancement — en solo aussi (0 programme recompilé au départ maintenant) ;
- les lueurs des présentoirs et des bourses étaient de vraies lumières ajoutées après le
  démarrage : chacune change le nombre de lumières, donc la variante de TOUS les
  matériaux. Elles passent par le réservoir du moteur (`sourceLumiere`, engine.js).
Résultat : 71 programmes recompilés au lancement → 2 ; l'armoire en 1,7 à 2,3 s.

Banc : `banc-drapeaux.mjs` (scratchpad) — compte d'essai, instance à 7 bots vétérans sur un
serveur à part (port 8120, `TLOC_DB` à part), suivi des drapeaux et des bots toutes les 5 s,
message de camp tapé, captures (bandeau, cercles vus d'en haut, résultats).


### Les arènes (5 octobre)

Eugène : en multi, on ne se croise pas. « Toute la châtellenie » (1,2 km d'un coin à l'autre)
était l'aire de départ de presque toutes les manches. L'arène est maintenant une notion du
jeu : **chaque lieu la déclare dans son propre fichier**, sous `arenes` de son objet niveau
(à Lille, `game.js`, `ARENE_LILLE`), et `tloc-multi.js` la lit au lieu de ses constantes.

    { id, nom,
      sd(x, z),          // distance signée qui mesure les aires (négative dedans) — Lille : sdPent
      centre: [x, z],    // d'où partent le rideau, le recul de la brûlure, le recalage de l'arrivée
      depart: 'place',   // le lieu (E.addLieu) où l'on revient quand rien d'autre n'est sûr
      aires: [           // de la plus large à la plus étroite ; la manche part de la première
        { id, nom, r,    // nom avec son article : « Hors des abords… », « rentre dans la citadelle »
          couleur, lueur,          // trait des cartes, rideau de lumière
          eparpille,               // rayon des départs de manche des bots
          herse,                   // « la herse de la Porte Royale » : elle retombe sur cette aire
          porte: { sur(x, z), dehors, seuil, dedans },   // le seul chemin des bots pour y entrer
          riveDeule, exclut(x, z) }],                     // bornes des drapeaux dans cette aire
      pointsForts(lieux) }   // d'où partent les drapeaux ; le premier est le lieu de départ

Lille : **la citadelle seule** (Eugène, 5 octobre), herse de la Porte Royale baissée toute
la partie. Le banc des rencontres l'a décidé : « toute la châtellenie » (1,6 × 2 km) donnait
2 rencontres en 3 minutes, voisin le plus proche d'un joueur à 220 m ; le parc et le bourg
(440 m du tracé, 1,4 km de large) exactement autant (2 rencontres, 243 m). La citadelle fait
530 × 500 m. Le bourg, sa forge, les chevaux du moulin et du mage et l'arc de la chapelle
sortent du multi (`planObjets` ne pose que ce qui tombe dans l'aire de départ). On joue
toujours dans la première aire, hors manche et en balade aussi : on y brûle au-dehors (pas
avant d'avoir choisi son arrivée — on entre devant la Porte Royale). Le point d'arrivée cliqué
au loin est ramené vers le centre, 15 m en deçà de la limite. Le calendrier se déduit du
nombre d'aires (`calendrierAire`) : le chrono passe à l'aire suivante 2 min 30 avant la fin,
le match à mort toutes les 5 min, les drapeaux de moins de 5 min se jouent dans la plus
étroite. La grille des chemins ne couvre plus que l'aire de la manche.

L'instance retient son arène : colonne `arene` (app.py, comme `regle`), choisie à la création
(`creerInstance(…, arene)`), redite dans le `bienvenue`. Le serveur n'accepte que les arènes
prêtes (`NouvelleInstance.arene`, aujourd'hui `^(lille)$`) ; l'accueil n'affiche pas de choix
tant qu'il n'y en a qu'une (`ARENES`, accueil.js).

**Ajouter une arène** : la déclarer dans le fichier du lieu, charger `tloc-multi.js` dans sa
page (aujourd'hui, seul `index.html` le charge), puis l'ouvrir dans `NouvelleInstance.arene`
et `ARENES`. Les objets du multi (`PLAN_OBJETS`), la forge et les camps restent ceux de Lille :
à déclarer aussi par l'arène le jour où une deuxième existe.

Banc : `bancs/rencontres.mjs` — comptes de test sur le serveur LOCAL, quatre joueurs sans tête
qui marchent au hasard, quatre bots, chrono de 10 min observé sur ses 3 premières minutes ; il
compte les rencontres (deux personnages à moins de 30 m).
