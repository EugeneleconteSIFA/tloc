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
- **L'armure** encaisse avant les cœurs (`absorber`, dans `encaisser`) : 2, 3 ou 4 cœurs
  (cuir clouté, mailles, plates). Brisée, elle part (`objet-casse`) et revient aux casernes
  après `OBJET_RETOUR` (45 s). Sa jauge s'affiche au bout des cœurs.
- **La forge du bourg** (Entrée devant « À l'enclume ») : mailles 40 écus, plates 70,
  réparation 12, écu cerclé 50. Les niveaux restent côté client ; les autres les voient par
  l'état (`ar`, `bc`, `gd` dans le message `etat`) et `PNJ.animeCamille` habille l'avatar.
- **Les bots** ne ramassent rien ; ils subissent la parade et l'armure comme tout le monde.
- Banc : `banc-equip.mjs` (scratchpad) — ramassage, parade de face, armure qui se casse et
  revient, achats à la forge, gros plans de la garde.

