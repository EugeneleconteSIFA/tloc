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

**Trois arènes (5 octobre, l'après-midi)** — choisies à la création (étape « Arène » de
l'accueil, liste `C.ARENES` de tloc-compte.js : nom, page, une phrase) :
- **La citadelle de Lille** (`index.html`, game.js) : ci-dessus. Seule à garder la carte où l'on
  clique son arrivée (`carte: true`).
- **La Garde-Guérin** (`garde-guerin.html`, garde-guerin.js) : le village fortifié (95 m autour
  de la place, l'enceinte et le belvédère), puis son cœur (42 m : la place, l'église, le four).
  En équipes, la garde de la tour (départ au pied de la tour) contre les muletiers de la
  Régordane (départ à l'auberge). Banc : 4 rencontres en 60 s à 2 joueurs et 2 bots, voisin à 10 m.
- **Le Pouget** (`pouget.html`, pouget.js) : le hameau (80 m), puis son cœur (35 m). Ceux
  d'en haut (nord-ouest, 773 m) contre ceux d'en bas (sud-est, 751 m). Banc : 6 rencontres en
  60 s, voisin à 14 m.

**Le socle** : les pages autres qu'index.html ne chargent `tloc-multi.js` qu'en instance (un
petit script en fin de page : sans instance, on s'y promène en solo comme avant). L'accueil
envoie à la page de l'arène (`C.pageArene`) ; une instance ouverte sur la mauvaise page y est
renvoyée dès le `bienvenue`. Hors de Lille, le niveau naît après tloc-multi.js : l'arène est lue
à la demande (`assurerArene`, à chaque image), l'habillage du niveau en instance aussi
(`habillerNiveau`). L'eau, les ponts et l'enceinte de carte.js ne valent qu'à Lille (`eau`,
`pont`, `ouvrage`, `horsEnceinte`) ; ailleurs l'arène peut donner `sdEau`. Sans carte de
choix, l'arrivée est automatique (`arriveeAuto`) : au départ de son camp (`departsCamps`), sinon
au ralliement, sinon au départ de l'arène. Les camps gardent leurs clés (`garnison`, `bourg` :
le serveur les compte) ; l'arène leur donne `nom`, `court` (le score), `pluriel` (l'accord du
verbe) et `campsTexte` (le menu du choix).

**Ajouter une arène** : la déclarer dans le fichier du lieu (`arenes` de l'objet niveau ; pour
un monde de monde.js, après `await lieu(…)`, comme garde-guerin.js), ajouter à sa page le petit
script qui charge le multi en instance, puis l'ouvrir dans `C.ARENES` et
`NouvelleInstance.arene` (app.py). Les objets du multi (`PLAN_OBJETS`), la forge et les
bannières restent ceux de Lille : hors de Lille, aucun objet n'est posé (ils ne tombent pas
dans l'aire), et la fête de la moisson (on fauche l'herbe de Lille) n'a pas de sens. À déclarer
par l'arène quand on en voudra.

**Le Batut et Beauregard (5 octobre, le soir)** — la bataille dans la maison (Eugène : « c'est
surtout le gameplay inside house que j'aime, pas mal pour se cacher »). Un niveau à lui, comme
l'estaminet : `batut.html`, `batut.js`, bâti de zéro d'après les grandes maisons d'aveyron.js
sans en dépendre (aveyron.js ne fait que des façades, et une autre session le tenait). Un domaine
clos de 124 × 68 m : le Batut à l'ouest, Beauregard à l'est, la même maison en miroir (une
arène d'équipes se veut juste), le jardin entre les deux (l'allée, le bassin à sec, quatre
parterres de buis d'1,40 m, deux rangs de hêtres). Chaque maison : sept pièces au
rez-de-chaussée (vestibule, grand salon, salle à manger, galerie, bibliothèque à trois
rayonnages de 2,20 m, cuisine, chambre), six issues (porte, porte-fenêtre, deux bouts de
galerie, cuisine, et le vestibule ouvert sur la galerie). L'étage est plein (on n'y monte pas).
Dedans, la caméra reste sous le plafond (`G.camMaxY`) et se rapproche. En équipes, chacun
arrive dans son vestibule (`departsCamps`, `dispersion: 2.5`) ; l'aire se resserre ensuite sur
le jardin : il faut sortir. Les pierres de l'Aveyron s'inscrivent au registre (PH) dans le
fichier même, comme aveyron.js — sans quoi phMat rendait un gris uni. Charge en 2,5 s.
Banc : 3 rencontres en 60 s à 2 joueurs et 2 bots, voisin à 16 m. À faire : un étage où l'on
monte, des meubles moins carrés, des portes qu'on ferme.

**Le Batut, deuxième version (5 octobre, le soir)** — Eugène, sur une capture : les salles
« beaucoup trop petites pour être des salles de manoir », l'étage par l'escalier de la tour, et
des portes où l'on n'entre pas. La cause des portes : Camille a 0,5 m de rayon de collision
quelle que soit son échelle (engine.js, `tryMove`) ; une porte de 1,20 m entre deux murs dont la
capsule déborde de 0,18 m ne laissait rien. Les portes font 2 à 2,4 m. Le corps de logis passe à
30 × 36 m sur deux niveaux (4,20 m sous plafond en bas, 3,60 m en haut ; voir l'en-tête de
batut.js) ; la tour ronde, collée au fond, porte une vis (`addHelix`, trois quarts de tour) de
la cuisine et de la cour à la galerie haute ; l'escalier droit du vestibule (`addRamp`) fait le
second chemin. Pièges payés : à l'étage, une boîte du moteur (`addBox`) n'a pas de dessous — les
meubles d'en haut sont des capsules à plancher (`bottom`) ; les murs d'étage aussi ; un pan de la
tour voisin d'une porte décentrée barrait le seuil (ouverture élargie à ±0,45 rad) ; entre le
palier de la tour et le plancher de l'étage, l'épaisseur du mur n'avait pas de sol (on tombait).
Vérifié par une sonde qui marche avec `tryMove` et `getH` du moteur : jardin → vestibule → salon
→ galerie → cuisine → tour → vis → galerie haute → grande chambre → escalier droit → vestibule,
sans un blocage. Une aire peut avoir sa propre mesure (`sd` d'aire, tloc-multi.js : `sdAire`) :
le jardin n'est pas le domaine rétréci. Un objet d'arène peut donner son étage (`y`).

**Les bots dans les maisons, Ko Panyi, Gallipoli (5 octobre, le soir)** :
- Hors de Lille, les bots NE PENSAIENT PAS : `tickBots` ne les animait que si le niveau avait des
  lieux nommés (`lieux.length`), ce qui n'est vrai qu'à Lille. Au Batut et au Pouget, ils restaient
  où la manche les posait ; la grille des chemins et les drapeaux étaient bloqués de même. Levé
  hors de Lille (`aLille()`) ; les drapeaux partent du départ de l'arène (`lieuDepart`).
- LE GRAPHE (`graphe` : { n: [[x, z, y]…], a: [[i, j]…] }, `suivreGraphe`) : une cible à un autre
  étage, ou derrière un mur, et le bot va du point du graphe qu'il voit au point qui voit sa
  cible, par le plus court chemin (Dijkstra), puis reprend la poursuite. Au Batut, 75 points par
  maison : les pièces, les seuils, la vis marche à marche, l'escalier droit. Banc (un joueur posté
  dans la grande chambre, trois bots, 90 s) : avant, aucun bot à l'étage ; après, les trois y
  sont en 40 s, au contact. Chaque arête vérifiée aux collisions du moteur (rayon 0,5 m) : elles
  ont révélé la statue qui bouchait la galerie (40 cm de chaque côté), un banc devant la porte de
  la salle d'armes, et la porte du billard donnant sur 70 cm entre la cage et le mur.
- Les portes du Batut à 2,6 m (3 m l'entrée) : à 2 m, il ne restait que 70 cm de passage.
- Les noms des camps de l'arène ne s'appliquaient que si l'arène « changeait » : quand le niveau la
  portait dès le départ, les camps gardaient les noms de Lille. Appliqués une fois par arène.
- **Ko Panyi** (`thailande.html` ; l'arène est dans `thailande-arene.js`, À REPLIER dans
  thailande.js : une autre session le tenait) : le village sur pilotis (92 m), puis le marché
  flottant ; les pêcheurs du ponton contre les marchands du haut du village. Banc : 10 rencontres
  en 45 s à 2 joueurs et 2 bots, voisin à 3 m.
- **Gallipoli** (`gallipoli.html`, gallipoli.js) : la vieille ville (95 m), puis le parvis du
  Duomo ; les pêcheurs du port contre les mouliniers des pressoirs à huile. Banc : 8 rencontres en
  45 s, voisin à 4 m.

**Les objets par arène (5 octobre, fin d'après-midi)** : une arène peut déclarer `objets`
({ id, type, x, z, nom }) au lieu de ceux de Lille (`PLAN_OBJETS`). Le Batut : l'armure dans
chaque chambre, l'arc dans chaque bibliothèque, l'écu au bord du bassin ; la Garde-Guérin et le
Pouget en ont aussi. La pose attend d'être entré au salon (`moi`, ws ouvert) : au Batut, qui
charge en 2,5 s, la partie tournait avant la réponse du serveur, l'envoi se perdait et
`objetsProposes` interdisait de recommencer. La carte M (`state.carteBeffroi`) n'est plus
donnée hors de Lille : c'est l'atlas de la châtellenie. Les minicartes du Batut et du Pouget
tracent la limite de l'aire (PARTAGE.aires) ; celle de Garde-Guérin (monde.js) pas encore.

**Reste à faire, dans l'ordre** :
1. Jouer les quatre arènes pour de vrai, à deux onglets (les bancs n'ont que des marcheurs au hasard).
2. Le Batut : un étage où l'on monte (l'escalier de la tour), des portes qu'on ferme, des
   meubles moins carrés (armoire, lit, buffet) ; la pénombre des pièces du fond.
3. En équipes, une arrivée relevée en (33, 2), devant la façade de Beauregard au lieu du
   vestibule, sur un banc : pas reproduit à un joueur seul — à surveiller.
4. La minicarte de Garde-Guérin (monde.js, partagé : à faire avec la session qui le tient).
5. Hors de Lille : la forge, les bannières et la fête de la moisson restent ceux de Lille.

Banc : `bancs/rencontres.mjs` — comptes de test sur le serveur LOCAL, quatre joueurs sans tête
qui marchent au hasard, quatre bots, chrono de 10 min observé sur ses 3 premières minutes ; il
compte les rencontres (deux personnages à moins de 30 m).

### Ce que chaque arène déclare, et les chemins des bots (6 octobre, C7)

**Ce qu'une arène a se déclare** dans son fichier : `forge` (`true` : celle du bourg de Lille ;
ailleurs `{ x, z, y? }`), `bannieres`, `fete`. Ce qu'elle ne déclare pas est éteint
(`areneA`, tloc-multi.js) : la forge n'est pas posée et les messages n'en parlent plus,
les bannières ne sont ni dessinées ni comptées, `/fete` répond qu'il n'y a rien à faucher. Le
serveur tient la même liste à la main (`ARENES_FETE`, `ARENES_BANNIERES`, app.py : il ne lit
pas le JS). Lille déclare les trois. Les bannières ont été gardées au Batut, au Pouget et à la
Garde-Guérin (Eugène) ; Ko Panyi et Gallipoli n'en ont pas.

**Le graphe tiré tout seul** (`grapheAuto`) : pour une arène de plain-pied sans `graphe`, on
avance de case en case (3 m, huit voisines) depuis le centre, les départs et les objets, comme
Camille marche (pas de 0,5 m, marche de 0,6 m au plus, rayon 0,5 m : `blocked`, `getH`). Ce
qu'on atteint devient un point, chaque pas réussi une arête : les toits et les cours closes n'y
entrent pas. Dans une case on essaie le centre puis quatre points autour, pour les ruelles de
2 m. Le plus court chemin passe par un tas (Dijkstra en n² coûtait des dizaines de ms par bot).
Calcul : 0,7 s à Gallipoli, réparti à 6 ms par image (7 s d'horloge en headless, ~2 s à 60 i/s) ;
avant, les bots poursuivent comme avant.

Banc `bancs/multi-graphe.mjs` : un bot vétéran seul (à plusieurs, en chacun pour soi, ils se
chassent entre eux), un joueur posté invulnérable sur le point au plus long détour à pied depuis
le centre, 90 s par essai :

| arène | graphe | cachette (vol → à pied) | sans graphe | avec |
|---|---|---|---|---|
| la Garde-Guérin | 3 139 points | 58 m → 271 m | 1/3 | **3/3** (47–52 s) |
| le Pouget | 2 454 | 23 m → 55 m | 1/2 (66 s) | **2/2** (11–12 s) |
| Ko Panyi | ~1 570 | 22 m → 86 m | 0/2 | **2/2** (15–16 s) |
| Gallipoli | 1 008 | 20 m → 101 m | 0/2 | **2/2** (10–20 s) |

**La passe des arènes** (`bancs/multi-arenes.sh`, qui lance `rencontres.mjs` : deux joueurs
sans tête, deux bots, 40 s de manche ; balade et drapeaux en équipes, le reste chacun pour
soi). Aucune pageerror sur les 24 parties. Partout : les objets posés (4 à Lille, 5 ailleurs),
les camps nommés par l'arène, l'aire tracée (une), un drapeau en prise des drapeaux (le
serveur en met `ceil(joueurs/2) − 1`, au moins un : quatre personnages, un drapeau). La balade
n'a pas de manche (« la manche ne commence pas » y est normal).

| arène | forge · bannières · fête | graphe | rencontres en 40 s (balade / survie / chrono / drapeaux) |
|---|---|---|---|
| Lille | oui · oui · oui | (grille de Lille) | 0 / 1 / 1 / 0 |
| la Garde-Guérin | — · oui · — | auto, 3 139 | 3 / 4 / 6 / 9 |
| le Pouget | — · oui · — | auto, 2 454 | 6 / 11 / 8 / 9 |
| le Batut | — · oui · — | déclaré | 4 / 5 / 6 / 6 |
| Ko Panyi | — · — · — | auto, ~1 570 | 6 / 7 / 3 / 6 |
| Gallipoli | — · — · — | auto, 1 008 | 1 / 6 / 6 / 6 |

Trouvé par la passe :
- **La Garde-Guérin n'avait jamais de drapeau, ni de ralliement** : le serveur refusait tout
  point au-delà de 5 km de l'origine, et elle est à z = −5 340 (repère des mondes). Borne
  portée à 50 km (`COORD_MAX`, app.py).
- **La remise des bannières d'une manche neuve** (`raz`, sans camp) levait une exception à
  chaque manche en équipes : `evenementBanniere` s'arrête maintenant au panneau.
- **Le serveur local ne se recharge pas sous Windows** : `uvicorn --reload` du 5 octobre
  tournait encore le 6 avec le app.py de la veille. Après une modification d'app.py, relancer
  `./lancer.sh` (sous `bancs/tour.sh`, pour ne couper le banc de personne).
- Lille : 0 ou 1 rencontre en 40 s à quatre (la citadelle fait 530 m ; c'était connu).

**Le serveur, vérifié après sa relance** (`bancs/multi-serveur.mjs` : il envoie lui-même la fête et la
saisie d'une bannière, posté au ralliement adverse, et relève ce que le serveur répond) : les
ralliements sont acceptés dans les six arènes ; la fête seulement à Lille ; la bannière à Lille, à
la Garde-Guérin, au Pouget et au Batut, refusée à Ko Panyi et à Gallipoli. Aucune pageerror.

### Trois arènes nouvelles : Alberobello, Matera, l'estaminet (6 octobre, C8)

**La sonde de terrain** (`bancs/multi-sonde.mjs page x z rayon "x1,z1;…"`) : depuis un point, ce
qu'on atteint à pied aux règles du moteur (case de 1 m — `TLOC_PAS=0.5` dans un intérieur encombré —,
huit voisines, `blocked` au rayon 0,5 m, marche de 0,6 m au plus). Elle rend la surface, l'étendue,
les hauteurs, le centre marchable, deux points éloignés (les départs des camps), et recale sur le sol
atteint les points qu'on lui donne (départs, objets, points forts). Les intérieurs n'ont pas de
`blocked` à eux : la sonde prend celui du moteur.

| arène | page | relevé | aires | camps | objets |
|---|---|---|---|---|---|
| Alberobello, le Rione Monti | `alberobello.html` | 1,1 ha à moins de 90 m de l'arrivée, de −11 à 6 m | le Rione Monti (80 m), le cœur du quartier (30 m, autour de la porte de l'île) | les trullari, les paysans de la Murgia | 2 armures, 2 arcs, l'écu à la porte de l'île |
| Matera, les Sassi | `matera.html` | 2,1 ha à moins de 140 m, de −39 à 5 m ; centre (−67 ; 62) | les Sassi (85 m), le cœur (30 m) | ceux du Barisano (nord-ouest), ceux du Caveoso (sud-est) | 2 armures, 2 arcs, l'écu au cœur |
| L'estaminet | `tavern.html` | la salle de 11 × 9 m (147 m² atteints, dehors compris par la porte) | la salle | les habitués du zinc, les joueurs de cartes | l'écu au milieu |

**L'estaminet se joue à quatre au plus, bots compris** : `ARENES_MAX` (app.py) borne les places des
humains (`places_humains(mode, bots, arene)`) et le nombre de bots à la création (il reste au moins une
place à un humain). Aucune n'a de forge, de bannières ni de fête. Alberobello et Matera portent l'acte IV
(C3) : en instance, rien de l'histoire (`EN_INSTANCE`, pouilles.js) — ni Assunta, ni l'oliveraie, ni le
soleil qui court, ni les salles du château.

**La passe** (`TLOC_ARENES="alberobello matera" bancs/multi-arenes.sh`) : aucune pageerror ; 5 objets
posés ; les camps nommés ; l'aire tracée ; un drapeau en prise des drapeaux ; le graphe des bots tiré
tout seul (1 431 points à Alberobello, 2 055 à Matera).

| arène | rencontres en 40 s (balade / survie / chrono / drapeaux) |
|---|---|
| Alberobello | 3 / 6 / 7 / 6 |
| Matera | 6 / 7 / 6 / 5 |

- **Appris** : `bancs/rencontres.mjs` a sa table des pages par arène (`PAGE`) : une arène qu'on y oublie
  charge `undefined` et le banc attend cinq minutes avant de tomber — sans une ligne de résultat dans
  `multi-arenes.sh`, qui filtre la sortie.

**L'estaminet, joué** (`TLOC_ARENES=estaminet bancs/multi-arenes.sh`) : 6 rencontres en 40 s à chaque
règle, un drapeau posé dans la salle, aucune pageerror. Trois choses trouvées en le jouant :
- **la porte** donnait sur un dehors sans bord, hors de l'aire : en instance, le seuil est fermé (une
  capsule) et l'invite « sortir de l'estaminet » éteinte ;
- **l'arrivée et le terrain du drapeau** étaient cherchés dans la rue (15 m de marge sous la limite, un
  cercle libre de 8 m autour du drapeau : des mesures de quartier). Une arène peut se dire **`serre: true`** :
  tout reste dans sa première aire, la marge tombe à 0,5 m et le cercle libre à 1,2 m (tloc-multi.js) ;
- **un pan de mur de la salle** (la façade à gauche de la porte) partait du coin nord-ouest : une capsule
  en diagonale à travers la salle. Remis le long de la façade (le solo aussi ; `acte1-b1.mjs` sans erreur).

### Le Batut : les portes qu'on ferme (6 octobre, C8)

Les 30 portes des cloisons (15 par maison, rez-de-chaussée et étage) ont un vantail de chêne sur
charnière : ouvert, rabattu contre le mur ; fermé, il bouche l'ouverture, et une capsule arrête qui
passe. Le moteur ne compte pas une capsule de rayon nul (`blocked`) : on bascule son rayon, sans
rien toucher au moteur. Invite « ouvrir / fermer la porte ». Toutes ouvertes au départ.
- **Le salon les partage** : message `porte` { id, ouverte } (app.py retient `salon.portes`, les
  relaie, et les redonne au `bienvenue`) ; tloc-multi.js passe au niveau (`G.level.porte`) et prête
  `PARTAGE.envoyerPorte` au lieu. Banc `bancs/multi-portes-salon.mjs` (trois joueurs) : fermée par A,
  vue fermée par B, trouvée fermée par C arrivé après, rouverte par B pour tous — tout passé.
- **Les bots** ouvrent la porte fermée qu'ils trouvent devant eux (à 1,8 m ; `G.level.portesFermees`,
  `tickBots`). Pas encore mesuré : un bot qui poursuit derrière une porte fermée.
- Banc solo `bancs/multi-portes.mjs` : fermée, elle arrête Camille qui marche vers elle ; rouverte, on
  repasse ; le vantail au milieu de l'ouverture fermé, à 1,84 m ouvert.
- **Appris** : ce qui bouge dans un niveau doit porter `userData.dynamic` (la fusion des décors l'avait
  fondu, figé ouvert) ; et le moteur fige les matrices du décor (`matrixAutoUpdate = false`) : après une
  rotation, `updateMatrix()` et `updateMatrixWorld(true)` à la main.
- Passe du Batut, quatre règles : aucune pageerror, 5 objets, 3 à 12 rencontres en 40 s.

### Le Batut : des meubles moins carrés, la pénombre du fond (6 octobre, C8)

- **Les meubles composés** (batut.js : `table`, `chaise`, `armoire`, `buffet`, `lit`) : un plateau sur ses
  pieds et sa ceinture, des chaises tout autour (assise, dossier, pieds, leur propre obstacle), l'armoire
  à plinthe, corniche et deux vantaux à boutons de laiton, le buffet à tiroirs, le lit à tête et à pied,
  matelas et traversin de laine — Poly Haven partout. La même emprise et le même obstacle que les boîtes
  d'avant (`obstacle` : une boîte au rez-de-chaussée, une capsule à plancher à l'étage). La salle à
  manger a ses dix chaises, la cuisine ses huit.
- **La pénombre des pièces du fond** (bibliothèque, cuisine, cellier) : leurs sols et leurs cloisons
  assombris (`PENOMBRE`), aucune lumière de plus ; le jour des fenêtres reste clair. `THREE.Color`
  multiplie en linéaire : 0,3 y fait environ 0,58 à l'écran (0,55 ne se voyait pas).
- **Les bots** : `bancs/multi-batut.mjs` vérifie que les 152 points du graphe restent libres et que ses 166
  arêtes se parcourent sans heurter un meuble (rayon 0,45 m, à la hauteur de l'étage) — tout passé.
- **L'arrivée en équipes « devant la façade de Beauregard »** (relevée une fois le 5 octobre) : deux parties
  à quatre en équipes, les huit arrivées dans le vestibule (x 41–44, z −3–0). Non reproduite.
