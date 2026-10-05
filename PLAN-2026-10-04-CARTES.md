# Plan du 4 octobre — resserrer les cartes

Eugène, après le week-end : les cartes sont trop grandes. La plupart des endroits ne servent
à rien, l'étendue coûte du chargement, ralentit le développement, et en multi les joueurs ne
se croisent pas. Bientôt, des arènes un peu partout dans l'univers.

## 1. Le constat (mesuré le 4 octobre)

| Lieu | Étendue aujourd'hui | Ce qui sert vraiment |
|---|---|---|
| Thaïlande | 5,8 × 3,8 km (22 km²), 5 îles réelles à leurs vraies distances : Ko Panyi (0,0), Tapu (−700, 500), Tham Suea (950, 300), Railay (−700…0, 1 500…2 400), Phi Phi (2 400…3 900, 1 100…2 000) | Railay + Phi Phi = 18 000 des 21 000 points de chemin du banc ; l'histoire tient sur Panyi, le grand piton, la tyrolienne, le cloître |
| Alberobello | cœur 500 × 530 m (1 218 bâtiments) + lointain 2,1 × 1,4 km | les trulli de la quête |
| Matera | cœur 810 × 790 m + lointain 2,1 × 2,2 km (2 161 bâtiments au plan complet) | les Sassi de la quête |
| Gallipoli | cœur 790 × 630 m + lointain 3,3 × 1,5 km (967 bâtiments) | la vieille ville sur son île |
| Lille | la citadelle (700 m, `ECH = 4.5`) est à la bonne taille ; la VILLE (quartier.js) garde les 1 780 bâtiments BD TOPO jusqu'à `PLAINE_R − 25` = 1 250 m du centre | le bourg (place, marché, estaminet, beffroi, chapelle, `TOWN` à (200, 660)) et le chemin depuis la Porte Royale |
| Aveyron (aveyron.js) | une seule grille fine de 4,7 × 1,4 km, avec Saint-Gervais ET Saint-Symphorien à 3,6 km l'un de l'autre, plus des environs de 14 × 12 km | le lac, les trois maisons des Roquette, la porte de l'île |
| Villefort (lozere.js) | 1,2 × 2,1 km au pas de 5 m | le bourg, la Régordane, la gare |
| Garde-Guérin (lozere.js) | 576 × 568 m au pas de 2 m | le hameau fortifié : **OK, on n'y touche pas** (Eugène, 4 octobre) |
| Pouget (pouget.js) | 584 × 584 m (`BORD = 292`) | le hameau et ses enclos : **OK, on n'y touche pas** (Eugène, 4 octobre) |
| Intérieurs (maison, taverne, cave, chapelle, temple, mage) | quelques dizaines de mètres | hors sujet |

Le chargement de Lille a dérivé : **36,8 s** en somme des étapes le 2 octobre
(`bancs/resultats/charge-2026-10-02.json`), contre 15,7 s le 1er et un budget de 17 s.
Les étapes les plus lourdes : quartier 7,2 s, fusion des décors 7,2 s, préparation du rendu
8,7 s, personnages 2,9 s, sols 3,8 s. C'est à remesurer au calme, mais l'ordre de grandeur
est clair : l'étendue coûte.

Retours d'Eugène (4 octobre) :
- **Thaïlande** : c'est l'espace de balade de chaque île qui est immense, pas forcément la
  distance entre les îles. Les îles sont trop grandes.
- **Lille** : la citadelle est maintenant à la bonne taille ; c'est la ville qui est trop
  grande. On ne touche donc pas à `ECH`.
- **Alberobello** : il s'y est baladé, c'est beaucoup trop grand.

## 2. La proposition

**Une règle pour tout l'univers.** La zone où l'on marche tient dans **400 m de côté
environ**, 500 m au plus, sauf raison dite à Eugène (Lille, la citadelle seule exceptée).
Au-delà, il ne reste qu'un décor lointain : relief grossier, sans bâtiments praticables, sans
collisions, chargé en dernier. Chaque rue gardée doit mener quelque part : une quête, un
PNJ, un coffre, un point de vue. Sinon, on la coupe.

**Solo.**
- **Thaïlande → des îles plus petites.** Sur chaque île, on garde un cœur praticable de
  200 à 400 m autour de ce qui sert (Panyi et son marché, le grand piton et les moines, la
  tyrolienne, le cloître…). Le reste de l'île devient une falaise ou une jungle qu'on ne
  parcourt pas, ou disparaît sous la mer. Les distances entre les îles ne bougent pas, sauf
  si une île vide disparaît.
- **Alberobello → un cœur de 250 à 300 m** autour des trulli de la quête (contre 500 m
  aujourd'hui), le lointain réduit à une toile basse. Matera et Gallipoli suivent la même
  règle, après Alberobello.
- **Lille → la ville resserrée, la citadelle intacte.** `quartier.js` ne garde plus les
  bâtiments jusqu'à 1 250 m. Il garde le bourg et un rayon de 150 à 250 m autour, plus
  le chemin depuis la Porte Royale. Au-delà, un décor lointain sans collisions (des
  volumes bas, ou rien). Le quartier est la plus grosse étape du chargement (7,2 s).

**Multi.**
- **L'arène devient une notion du jeu.** Chaque lieu peut déclarer une ou plusieurs arènes
  dans son propre fichier (pas de système parallèle) : centre, rayon de 80 à 150 m, points
  d'apparition, emplacements de drapeaux, aires de resserrement. `tloc-multi.js` les lit au
  lieu de supposer la citadelle de Lille.
- **Première arène : la citadelle de Lille**, l'aire de départ ramenée au parc (400 m) au
  lieu de « toute la châtellenie ». Ensuite, une arène par lieu : une place d'Alberobello,
  le marché flottant de Panyi, le Garde-Guérin…
- Le serveur garde l'arène choisie avec l'instance (une colonne `arene`, comme `regle`).

## 3. L'enchaînement

Deux vagues, trois sessions au plus en même temps, chacune sur ses propres fichiers.

- **Vague A**, en parallèle : **1. Thaïlande**, **2. Alberobello** (puis Matera et Gallipoli),
  **3. La ville de Lille**.
- **Vague B**, après Lille : **4. Les arènes du multi**.
- **Vague C**, quand une session de la vague A a fini : **5. Villefort** (Garde-Guérin et
  Pouget restent tels quels), **6. Aveyron**. Matera et Gallipoli sont la fin de la consigne 2.

Chaque session mesure avant et après (`node bancs/charge.mjs`, ou le banc `bancs/lieu-*.mjs`
du lieu), vérifie en rendu, note ce qu'elle a appris dans `PROMPT-REPRISE.md` (§ 4.E pour
le chargement), et publie **seulement ses chemins** au calme (charge sur 1 min < 3).
Déplacer oui, supprimer non : les plans et reliefs complets restent sur le disque
(`carte/mondes/_mauvais/` ou un sous-dossier `complet/`), seul ce que le jeu charge change.

---

## Consigne 1 — Thaïlande : des îles plus petites

```
Lis CLAUDE.md, PROMPT-REPRISE.md et PLAN-2026-10-04-CARTES.md (§ 1 et 2).

Tâche : resserrer les îles de Thaïlande. Eugène : « c'est l'espace de balade qui est
immense, pas forcément la distance entre les îles : les îles sont trop grandes ». Le relief
fait 5,8 × 3,8 km, et Railay + Phi Phi portent 18 000 des 21 000 points de chemin du banc.
Cible : sur chaque île, un cœur praticable de 200 à 400 m autour de ce qui sert. Le reste
est falaise ou jungle infranchissable, ou rendu à la mer. Les distances entre les îles ne
bougent pas, sauf si une île n'a plus rien à offrir (dis-le moi).
1. Inventaire d'abord : les lieux, PNJ, quêtes et objets de thailande.js (Nok et le gong,
   les moines du grand piton, la clé du cloître, la tyrolienne, le marché flottant) avec
   leurs coordonnées, île par île. Propose une emprise par île, sur une capture du plan,
   et attends mon accord avant de toucher au code.
2. Fais le recadrage dans carte/mondes/extraire-thailande.py (plan) et pour le relief,
   pas à la main dans le JSON. Les fichiers complets d'aujourd'hui sont DÉPLACÉS dans
   carte/mondes/complet/, pas supprimés.
3. Au bord du cœur, aucune route ne s'arrête dans le vide : elle finit sur une falaise, une
   plage, un ponton ou un temple. La limite doit avoir l'air naturelle.
4. Mesure avant et après : node bancs/lieu-thailande.mjs (praticabilité ≥ 95 %) et le
   chargement de thailande.html. Vérifie en rendu (captures du banc).
Fichiers AUTORISÉS : thailande.js, thailande.html, carte/mondes/extraire-thailande.py,
carte/mondes/thailande.json, carte/mondes/relief-thailande.json, carte/mondes/complet/,
bancs/lieu-thailande.mjs, bancs/resultats/.
INTERDITS : tout le reste (monde.js compris : si un changement y paraît nécessaire, dis-le
moi au lieu de le faire, la session Pouilles s'en sert).
Note ce que tu as appris dans PROMPT-REPRISE.md, puis publie seulement tes chemins :
echo o | ./publier-dev.sh 'Thaïlande : îles resserrées…' <tes chemins>
```

## Consigne 2 — Alberobello d'abord, puis Matera et Gallipoli

```
Lis CLAUDE.md, PROMPT-REPRISE.md et PLAN-2026-10-04-CARTES.md (§ 1 et 2).

Tâche : resserrer Alberobello. Eugène s'y est baladé : « c'est beaucoup trop grand ».
Aujourd'hui, un cœur de 500 × 530 m (1 218 bâtiments) et un lointain de 2,1 × 1,4 km.
Cible : un cœur de 250 à 300 m autour des trulli de la quête, et un lointain réduit à une
toile basse (relief grossier, quelques volumes, ni collisions ni bâtiments praticables).
Une fois Alberobello validé en rendu par Eugène, applique la même règle à Matera et à
Gallipoli.
1. Inventaire d'abord : pour chaque ville, les lieux, PNJ et quêtes (alberobello.js,
   matera.js, gallipoli.js, pouilles.js) avec leurs coordonnées. Propose une emprise par
   ville et montre-la-moi sur une capture du plan avant de toucher au code.
2. Le recadrage passe par carte/mondes/extraire-pouilles.py et gradins-pouilles.py. Les
   fichiers *-coeur.json / *-gradins.json d'aujourd'hui sont DÉPLACÉS dans
   carte/mondes/complet/, pas supprimés.
3. Le bord du cœur ne doit pas se voir comme une coupe : les rues coupées finissent sur un
   mur, un muret, une haie ou une porte.
4. Mesure avant et après : node bancs/lieu-pouilles.mjs et le chargement des trois pages.
   Vérifie en rendu.
Fichiers AUTORISÉS : pouilles.js, alberobello.js, matera.js, gallipoli.js, leurs .html,
carte/mondes/extraire-pouilles.py, carte/mondes/gradins-pouilles.py,
carte/mondes/pouilles-*.json, carte/mondes/relief-pouilles-*.json, carte/mondes/complet/,
bancs/lieu-pouilles.mjs, bancs/resultats/.
INTERDITS : tout le reste (monde.js compris : si un changement y paraît nécessaire, dis-le
moi au lieu de le faire).
ATTENTION : ces fichiers ont des modifications non publiées en cours (git status). Lis-les,
édite en place, ne les écrase pas.
Note ce que tu as appris dans PROMPT-REPRISE.md, puis publie seulement tes chemins.
```

## Consigne 3 — Lille : la ville resserrée, la citadelle intacte

```
Lis CLAUDE.md, PROMPT-REPRISE.md et PLAN-2026-10-04-CARTES.md (§ 1 et 2).

Tâche : resserrer la VILLE de Lille. Eugène : la citadelle est à la bonne taille, la ville
est trop grande. On ne touche ni à ECH ni à la citadelle. Aujourd'hui, quartier.js garde
les 1 780 bâtiments BD TOPO jusqu'à PLAINE_R − 25 = 1 250 m (quartier.js, la ligne
`if (!dansEnceinte(cx, cz) || Math.hypot(cx, cz) > PLAINE_R - 25)`). Le quartier pèse
7,2 s au chargement, et la somme des étapes était à 36,8 s le 2 octobre (budget 17 s).
1. Mesure au calme d'abord (charge sur 1 min < 3) : node bancs/charge.mjs, puis
   bancs/profil.mjs.
2. Inventaire : ce qui sert dans la ville. Le bourg (TOWN à (200, 660) : place, marché,
   estaminet, beffroi, chapelle), le chemin depuis la Porte Royale et le pont de la Deûle,
   les PNJ (pnj.js), les quêtes (quetes.js), les coffres, les lieux de la carte M. Montre-
   moi sur une capture de la carte l'emprise proposée : le bourg et un rayon de 150 à
   250 m, plus le chemin. Attends mon accord.
3. Puis fais-le : au-delà de l'emprise, plus de bâtiments praticables ni de collisions ; un
   décor lointain bas (des volumes simples ou rien) pour que l'horizon ne soit pas vide. Les
   rues coupées finissent sur un mur, une porte ou un canal, pas dans le vide. Le sol maillé
   (PLAINE_R) peut se resserrer lui aussi s'il ne sert plus.
4. Vérifie en rendu : le prologue, l'acte 1 (bancs/sauts.mjs, bancs/acces.mjs), la minicarte
   et la carte M. Le multi joue sur cette carte : vérifie que les aires (AIRES,
   tloc-multi.js) et les emplacements de drapeaux tombent toujours sur du praticable, sans
   modifier tloc-multi.js (la session 4 s'en charge).
5. Mesure après. Note dans PROMPT-REPRISE.md (§ 4.E) ce que la ville coûtait et ce
   qu'elle coûte maintenant.
Fichiers AUTORISÉS : quartier.js, carte.js (PLAINE_R et ce qui borde la ville seulement),
nature.js, campagne.js, bancs/, PROMPT-REPRISE.md.
INTERDITS : la citadelle et ECH, tloc-multi.js, les fichiers des autres lieux, monde.js,
engine.js. village.js, pnj.js et quetes.js ont des modifications non publiées en cours :
si un PNJ ou une quête tombe hors de l'emprise, dis-le moi au lieu de le déplacer.
Publie seulement tes chemins.
```

## Consigne 4 — Les arènes du multi (après la consigne 3)

```
Lis CLAUDE.md, PROMPT-REPRISE.md, PLAN-2026-10-04-CARTES.md et docs/NOTE-MULTI.md.

Tâche : faire de l'arène une notion du jeu, pour que les joueurs se croisent plus et qu'on
puisse bientôt jouer un peu partout dans l'univers.
1. Aujourd'hui, tloc-multi.js suppose la citadelle de Lille (AIRES tout / parc / citadelle,
   la place, la Porte Royale, les casernes pour les drapeaux). Fais-en l'inventaire.
2. Propose une description d'arène que chaque lieu DÉCLARE dans son propre fichier (pas de
   module greffé à côté, CLAUDE.md règle 3) : id, nom, centre, rayon (80 à 150 m), aires de
   resserrement, points d'apparition, emplacements de drapeaux, porte éventuelle (la herse).
   tloc-multi.js lit l'arène du lieu courant au lieu de ses constantes de Lille.
3. Première arène : Lille, avec l'aire de départ ramenée au parc (plus de « toute la
   châtellenie », d'autant que la ville aura été resserrée par la session 3) et les bots
   recalés dessus. Mesure : sur une manche de 3 min à 4 joueurs
   + bots, le nombre de rencontres (deux joueurs à moins de 30 m) avant et après.
4. Serveur : l'instance retient son arène (colonne `arene`, comme `regle`) et le choix se
   fait à la création. Seule l'arène de Lille est proposée tant qu'une autre n'est pas prête.
5. Dis-moi ensuite quelles arènes ajouter en premier (place d'Alberobello, marché de Panyi,
   Garde-Guérin…) une fois les sessions 1 et 2 publiées.
Fichiers AUTORISÉS : tloc-multi.js, serveur/app.py, accueil.js, accueil-social.js,
carte.js (la déclaration de l'arène seulement), docs/NOTE-MULTI.md, bancs/.
INTERDITS : les autres lieux, engine.js.
Vérifie en rendu à deux onglets (une instance, deux joueurs) avant de publier.
```

## Consigne 5 — Lozère : Villefort seulement

```
Lis CLAUDE.md, PROMPT-REPRISE.md et PLAN-2026-10-04-CARTES.md (§ 1 et 2).

Tâche : resserrer Villefort (lozere.js, villefort.html). Aujourd'hui, 1,2 × 2,1 km au pas
de 5 m. Règle : une zone où l'on marche d'environ 400 m de côté, 500 m au plus.
Garde-Guérin et le Pouget appartiennent au MÊME univers (la Lozère, le relief monde de
5,7 km) et Eugène les juge à la bonne taille : on n'y touche pas. Ce qui relie Villefort
à eux (routes, Régordane, passages, panneaux, retours de carte) doit continuer de marcher,
et la vue lointaine depuis chacun des trois lieux ne doit pas changer.
1. Inventaire d'abord : les PNJ, quêtes, objets et lieux de Villefort, avec leurs
   coordonnées, ET tout ce qui le relie à Garde-Guérin et au Pouget. Propose une emprise,
   sur une capture du plan, et attends mon accord avant de toucher au code.
2. Le recadrage passe par carte/mondes/plans-lieux-lozere.py, extraire-lozere.py et
   recolter-relief-lozere.py (sans relancer de récolte réseau : on découpe ce qu'on a). Les
   fichiers complets sont DÉPLACÉS dans carte/mondes/complet/, pas supprimés.
3. Au-delà de l'emprise : le relief monde au pas de 10 m, sans collisions. La limite doit
   avoir l'air naturelle (ravin, rivière, muret, forêt dense).
4. Mesure avant et après : node bancs/lieu-lozere.mjs et le chargement de villefort.html.
   Vérifie en rendu Villefort, ET que Garde-Guérin et le Pouget démarrent et se présentent
   comme avant (mêmes captures du banc).
Fichiers AUTORISÉS : lozere.js (la partie Villefort), villefort.js, villefort.html,
carte/mondes/lozere-villefort.json, carte/mondes/relief-lozere-villefort.json,
carte/mondes/plans-lieux-lozere.py, carte/mondes/extraire-lozere.py,
carte/mondes/recolter-relief-lozere.py, carte/mondes/complet/, bancs/lieu-lozere.mjs,
bancs/resultats/.
INTERDITS : garde-guerin.js, pouget.js, pouget-*.js et leurs fichiers de carte, monde.js,
tout le reste. carte/mondes/recolter-relief-lozere.py a des modifications non publiées en
cours : lis-le, édite en place.
Note ce que tu as appris dans PROMPT-REPRISE.md, puis publie seulement tes chemins.
```

## Consigne 6 — Aveyron : le lac de Saint-Gervais

```
Lis CLAUDE.md, PROMPT-REPRISE.md et PLAN-2026-10-04-CARTES.md (§ 1 et 2).

Tâche : resserrer l'Aveyron. Aujourd'hui, une grille fine de 4,7 × 1,4 km au pas de 5 m
(relief-aveyron-jeu.json) qui tient Saint-Gervais ET Saint-Symphorien, à 3,6 km l'un de
l'autre, plus des environs de 14 × 12 km. Règle : une zone où l'on marche d'environ
400 m de côté, 500 m au plus. Le Dormeur sur le mur de l'ouest (choisi par Eugène) reste
visible, au loin.
1. Inventaire d'abord : les PNJ, quêtes, objets et lieux de aveyron.js (le lac, les trois
   maisons des Roquette, la porte de l'île…) avec leurs coordonnées. Dis-moi si
   Saint-Symphorien sert à quelque chose dans l'histoire (STORY.md fait foi). S'il ne sert
   pas, il quitte la zone jouable et ne reste qu'au lointain. Propose une emprise, sur une
   capture du plan, et attends mon accord.
2. Le recadrage passe par carte/mondes/extraire-aveyron.py et fondre-relief-aveyron.py.
   Les fichiers complets sont DÉPLACÉS dans carte/mondes/complet/, pas supprimés.
3. Au-delà de l'emprise : le relief des environs, sans collisions. La limite doit avoir
   l'air naturelle (le lac, une falaise, un bois).
4. Mesure avant et après : node bancs/lieu-aveyron.mjs et le chargement de aveyron.html.
   Vérifie en rendu.
Fichiers AUTORISÉS : aveyron.js, aveyron.html, carte/mondes/*aveyron*,
carte/mondes/complet/, bancs/lieu-aveyron.mjs, bancs/resultats/.
INTERDITS : tout le reste (monde.js compris). aveyron.js, aveyron.json et
extraire-aveyron.py ont des modifications non publiées en cours : lis-les, édite en place.
Note ce que tu as appris dans PROMPT-REPRISE.md, puis publie seulement tes chemins.
```

## 4. La nuit du 4 au 5 octobre — le réalisme (consigne commune aux trois sessions)

Eugène part dormir ; les trois sessions de la vague A tournent seules. Consigne envoyée
telle quelle à chacune, ci-dessous (« Consigne de nuit »).

### Consigne de nuit

```
Je pars dormir : tu travailles seul jusqu'à demain matin. Relis CLAUDE.md, ta consigne et
PLAN-2026-10-04-CARTES.md.

D'ABORD, FINIS LE RESSERREMENT. Si tu attendais mon accord sur l'emprise, prends ta propre
proposition en restant du côté LARGE de la fourchette : rien ne doit manquer à une quête,
à un PNJ ou à un coffre. Tout reste réversible (fichiers complets DÉPLACÉS dans
carte/mondes/complet/). Pour Alberobello, ne passe pas à Matera ni à Gallipoli cette nuit :
je veux d'abord voir Alberobello en jeu. Publie le resserrement seul, avant la suite.

ENSUITE, LE RÉALISME. Je veux de la cohérence entre le vrai lieu et le jeu. Les routes, les
bordures et les chemins ne sont pas réalistes ; les bâtiments et le reste des éléments
graphiques peuvent être nettement meilleurs. Dans TON lieu, et seulement là :
1. Regarde avant de toucher. Fais des captures au banc à hauteur d'yeux (1,6 m) et en
   plongée sur 4 ou 5 endroits que le joueur traverse vraiment. Puis compare avec le vrai
   lieu : les données OSM et BD TOPO qu'on a déjà (type de voie, largeur, revêtement,
   trottoirs, matériaux, hauteurs) et ce que tu sais du lieu (une recherche web pour des
   descriptions est permise ; pas de téléchargement d'images). Écris la liste des écarts,
   du plus visible au moins visible.
2. Corrige dans l'ordre de cette liste. Ce qui compte d'abord, c'est ce qu'on a sous les pieds :
   - les routes : la bonne largeur par type, un bombé ou un dévers, un revêtement qui
     change selon le lieu (pavés, asphalte usé, terre battue, dalles), des raccords propres
     aux carrefours et au relief (ni marche, ni rive qui flotte, ni route qui plonge sous
     le sol) ;
   - les bordures : trottoirs et caniveaux là où il y en a vraiment, avec une hauteur réelle
     (12 à 15 cm), des seuils de porte, et des pieds de mur qui touchent le sol ;
   - les chemins : une largeur irrégulière, des bords qui se fondent dans l'herbe ou la
     terre au lieu d'un ruban net, un tracé qui suit la pente.
   Puis les bâtiments : proportions, ouvertures (fenêtres, portes, volets, balcons), toits,
   soubassements, matériaux selon le lieu et l'époque. Puis le reste : mobilier urbain,
   végétation, détails d'usure.
3. Règles de fabrication, sans exception :
   - Style réaliste : PBR Poly Haven via phMat (normal et roughness), jamais d'aplat
     mat(0x…) ni de canevas peint seul (c'est « cartoon » pour moi). Une texture Poly Haven
     manquante (CC0) peut être ajoutée en 512 px max dans assets_back/03_textures/polyhaven/,
     licence notée.
   - Le Mac a une puce Intel avec 1,5 Go de mémoire graphique : textures à 512 px, géométries
     fusionnées par matériau, pas de nouvelle lumière ni de nouvelle ombre.
   - Chargement : mesure avant et après chaque lot (ton banc de lieu, et
     node bancs/charge.mjs pour Lille). Aucune étape nouvelle au-delà de 300 ms ; si un lot
     coûte trop pour ce qu'il apporte, retire-le.
   - Vérifie en rendu, à hauteur d'yeux. Garde les captures avant/après dans
     bancs/resultats/ et nomme-les clairement : je les regarderai demain matin.
   - Les bancs passent par bancs/tour.sh (un Chrome de test à la fois). Publie par petits
     lots cohérents dès que le contrôle passe, seulement tes chemins ; si le contrôle échoue
     à cause de la charge du Mac, réessaie plus tard, ne force jamais.
4. Fichiers : ceux de ta consigne, et en plus :
   - session Pouilles : monde.js. C'est elle qui le POSSÈDE cette nuit (routes, bordures,
     bâtiments génériques de Thaïlande, des Pouilles, de l'Aveyron et de la Lozère). Chaque
     changement est vérifié en rendu sur thailande.html, aveyron.html et villefort.html
     aussi, pas seulement sur les Pouilles ;
   - session Thaïlande : PAS monde.js. Ce qui est propre à la Thaïlande passe par les
     crochets du lieu (solLieu, toitSur…) dans thailande.js. Ce qui manque dans monde.js,
     écris-le dans PROMPT-REPRISE.md sous « Demandes pour monde.js » ;
   - session Lille : quartier.js et carte.js (routes, quais, trottoirs de la ville). PAS
     village.js : il porte des modifications non publiées d'une autre session, et les
     publier mêlerait deux travaux. Ce qui manque au bourg, écris-le dans PROMPT-REPRISE.md.
     Ni la citadelle, ni ECH, ni tloc-multi.js.
   Jamais : engine.js, pnj.js, quetes.js, les fichiers d'un autre lieu.
5. Avant de t'arrêter, écris dans PROMPT-REPRISE.md (relis-le juste avant, ajoute sans
   réécrire) un compte rendu de nuit court : ce qui est fait et publié (commits), les
   captures avant/après à regarder, les mesures de chargement, ce qui reste, et tes
   questions pour moi. Arrête-toi plutôt que d'improviser sur ce qui touche à l'histoire.
```

### Complément de nuit — des lieux jouables

Constat du 4 octobre : dans les mondes bâtis par monde.js (Thaïlande, Pouilles, Aveyron,
Lozère), la minicarte (`minimap`, monde.js) ne montre que les arbres, les bâtiments, les
monstres et les objets. Aucun lieu n'est nommé, et rien n'est inscrit par `addLieu` :
le journal et la carte ne comptent donc aucun lieu découvert. Lille, elle, déclare ses lieux
(`E.addLieu({ id, nom, x, z, r })`, village.js).

```
Complément à la consigne de nuit, aussi important que le réalisme : je veux que TON lieu
soit JOUABLE, pas seulement beau. Une fois le resserrement publié, mène les deux de front.

1. Des gens à qui parler. Que dans chaque coin qui compte, quelqu'un vive et réponde :
   marchands, habitants, pêcheurs, moines, enfants, selon le vrai lieu. Utilise ce qui
   existe : PNJ.buildRole / PNJ.buildVillageois, addInteract, dialogue (comme Nok et les
   vendeurs dans thailande.js). Les répliques : courtes, mots simples, ancrées dans le
   vrai lieu et dans le ton de docs/GAME_DESIGN_BRIEF.md. Elles orientent le joueur (« le
   passeur est au ponton », « la fontaine est en haut des marches ») ou racontent le lieu.
   STORY.md fait foi : n'invente ni quête ni secret ni personnage de l'histoire. Les gens
   de passage, oui ; le scénario, non (une idée, note-la dans PROMPT-REPRISE.md).
   pnj.js reste interdit : avec les rôles et villageois qui existent, ça suffit. Un rôle qui
   manque, note-le dans PROMPT-REPRISE.md.
2. Les endroits importants visibles sur la minicarte en haut à droite, et comptés comme
   lieux découverts. La forme, la même pour tous les mondes : dans la description du lieu
   (l'objet passé à monde()), un tableau
     reperes: [{ id, nom, x, z, r, type }]      type : 'lieu' | 'pnj' | 'quete' | 'passage'
   - session Pouilles (elle possède monde.js) : monde.js lit f.reperes, appelle addLieu pour
     chacun (id préfixé du nom du monde, pour ne pas croiser ceux de Lille), et les dessine
     sur la minicarte : un repère par type, le nom du lieu le plus proche, et aussi les rues
     et les chemins en traits clairs, pour s'orienter. Lisible sur le petit carré. Vérifié en
     rendu sur les Pouilles, la Thaïlande, l'Aveyron et Villefort. Fais-le EN PREMIER, avant
     le réalisme, et publie-le seul : la session Thaïlande en dépend.
   - session Thaïlande : déclare tes reperes dans thailande.js dès maintenant, avec cette
     forme. Ils s'afficheront quand monde.js de la session Pouilles sera publié ; vérifie-les
     en rendu à ce moment-là.
   - session Lille : la minicarte et les lieux existent déjà. Vérifie que tout ce qui sert
     dans la ville resserrée y figure, et que plus rien ne pointe vers une rue coupée.
3. Jouable, c'est aussi : on arrive quelque part (le départ face à quelque chose qui donne
   envie d'y aller), on ne se coince nulle part (ton banc de lieu, praticabilité), et chaque
   rue gardée mène à quelqu'un ou à quelque chose. Parcours ton lieu au banc comme un
   joueur, du départ à chaque repère, et note ce qui manque.
Dans ton compte rendu de nuit, ajoute la liste des PNJ posés (où, qui, ce qu'ils disent en
une ligne) et une capture de la minicarte.
```

## 5. Le 5 octobre, sur le PC — Villefort, Aveyron, Lille

Le travail passe sur le PC Windows (CLAUDE.md, encadré du 5 octobre). Où en est le plan : la
Thaïlande, Lille (resserrement) et les trois villes des Pouilles sont publiées (`9eb4a4d`) ;
les Pouilles n'ont pas de compte rendu dans PROMPT-REPRISE.md. `monde.js` lit déjà les
`reperes` (minicarte et lieux découverts). Les arènes du multi (consigne 4) attendent.

Trois sessions en même temps, chacune ouverte sur le dossier du jeu lui-même (pas de
worktree) : **V. Villefort**, **A. Aveyron**, **L. Lille, le réalisme et les passants**.
Personne ne touche à `monde.js`, `engine.js`, `pnj.js`, `quetes.js` ni `tloc-multi.js` :
ce qui y manque s'écrit dans PROMPT-REPRISE.md, sous « Demandes pour monde.js » ou
« Demandes pour d'autres fichiers ».

### Début commun aux trois consignes

```
Tu es sur le PC Windows : lis d'abord CLAUDE.md (encadré du 5 octobre), PROMPT-REPRISE.md
et PLAN-2026-10-04-CARTES.md (§ 1, 2, 4 et 5). Trois sessions tournent en même temps
(Villefort, Aveyron, Lille), chacune sur ses fichiers : n'écris que dans les tiens.
- Les scripts .sh se lancent dans Git Bash ; Python, c'est `py -3`.
- Le serveur : vérifie s'il répond déjà (curl -s -o /dev/null -w "%{http_code}"
  http://127.0.0.1:8000/index.html). S'il répond, ne lance pas de second serveur ; sinon,
  ./lancer.sh en arrière-plan.
- Chaque banc Chrome passe par bancs/tour.sh (un Chrome de test à la fois pour les trois
  sessions) : bancs/tour.sh node bancs/lieu-….mjs
- Publie par petits lots cohérents, seulement tes chemins :
  echo o | ./publier-dev.sh 'message' <tes chemins>. Si le contrôle échoue parce que
  les autres sessions chargent la machine, réessaie plus tard, ne force jamais.
- Point d'avancement bref toutes les 15 minutes : fait / mesuré / reste.
- Avant de t'arrêter, ajoute (sans réécrire) ton compte rendu dans PROMPT-REPRISE.md :
  commits, captures à regarder, mesures, ce qui reste, questions pour Eugène.
```

### Consigne V — Villefort

```
(début commun ci-dessus)

Tâche : la consigne 5 du plan (Villefort seulement), puis la consigne de nuit (§ 4 :
réalisme, et le complément « des lieux jouables ») dans Villefort seulement.
1. Le resserrement d'abord, exactement comme la consigne 5 : inventaire, emprise proposée
   sur une capture du plan, et ATTENDS MON ACCORD avant de toucher au code. Garde-Guérin et
   le Pouget sont à la bonne taille : on n'y touche pas, et ce qui les relie à Villefort
   (routes, Régordane, passages, panneaux, retours de carte) doit continuer de marcher.
2. Publie le resserrement seul, avant la suite.
3. Puis le réalisme et le jouable dans Villefort : des gens à qui parler (rôles et
   villageois existants), et des `reperes` déclarés dans lozere.js pour la partie Villefort
   (monde.js les affiche déjà). Les règles de fabrication de la consigne de nuit
   s'appliquent toutes (Poly Haven via phMat, textures 512 px, rien de nouveau au-delà de
   300 ms au chargement).
Fichiers AUTORISÉS : lozere.js (la partie Villefort), villefort.js, villefort.html,
carte/mondes/lozere-villefort.json, carte/mondes/relief-lozere-villefort.json,
carte/mondes/plans-lieux-lozere.py, carte/mondes/extraire-lozere.py,
carte/mondes/recolter-relief-lozere.py (sans relancer de récolte réseau : on découpe ce
qu'on a), carte/mondes/recoudre-relief-lozere.py, carte/mondes/complet/,
bancs/lieu-lozere.mjs, bancs/resultats/ (tes fichiers), PROMPT-REPRISE.md (ajouts).
INTERDITS : garde-guerin.js, pouget.js, pouget-*.js et leurs fichiers de carte,
monde.js, et tout ce qui n'est pas dans la liste.
Vérifie en rendu Villefort, ET que Garde-Guérin et le Pouget démarrent et se présentent
comme avant (mêmes captures du banc).
```

### Consigne A — Aveyron

```
(début commun ci-dessus)

Tâche : la consigne 6 du plan (le lac de Saint-Gervais), puis la consigne de nuit (§ 4 :
réalisme, et le complément « des lieux jouables ») dans l'Aveyron seulement.
1. Le resserrement d'abord, exactement comme la consigne 6 : inventaire (dis-moi si
   Saint-Symphorien sert à l'histoire, STORY.md fait foi), emprise proposée sur une capture
   du plan, et ATTENDS MON ACCORD avant de toucher au code. Le Dormeur sur le mur de l'ouest
   reste visible au loin.
2. Publie le resserrement seul, avant la suite.
3. Puis le réalisme et le jouable dans l'Aveyron : des gens à qui parler (rôles et
   villageois existants ; les Roquette appartiennent à l'histoire, n'invente rien sur eux),
   et des `reperes` déclarés dans aveyron.js (monde.js les affiche déjà). PROMPT-REPRISE.md
   note que aveyron.js bâtit lui-même son bâti, ses rues et ses arbres, et que ses toits
   débordaient (§ 4.E, « À faire dans monde.js, suite ») : corrige ce qui est dans
   aveyron.js, note le reste pour monde.js. Les règles de fabrication de la consigne de nuit
   s'appliquent toutes.
Fichiers AUTORISÉS : aveyron.js, aveyron.html, carte/mondes/*aveyron* (dont
extraire-aveyron.py, fondre-relief-aveyron.py, recolter-relief-aveyron.py sans relancer de
récolte réseau), carte/mondes/complet/, bancs/lieu-aveyron.mjs, bancs/resultats/ (tes
fichiers), PROMPT-REPRISE.md (ajouts).
INTERDITS : monde.js, et tout ce qui n'est pas dans la liste.
```

### Consigne L — Lille : le réalisme et les passants

```
(début commun ci-dessus)

Tâche : finir Lille après son resserrement (publié le 5 au matin, c7ef2e9). Lis dans
PROMPT-REPRISE.md la section « Lille — la ville resserrée » : les correctifs de réalisme et
de passants qu'elle décrit étaient écrits (patch-routes.py, patch-passants.py) mais sont
restés sur le Mac et sont PERDUS. Refais-les, puis continue la liste des écarts.
1. Regarde avant de toucher : bancs/regard-ville.mjs (à hauteur d'yeux et en plongée : garde,
   place, chemin, rue, wault) ; les captures « avant » de la nuit sont dans bancs/resultats/.
2. Les rues de la ville : trottoirs montés de 14 cm avec une bordure visible, caniveau de
   grès, trottoir coupé au droit des carrefours, bombé de chaussée ; le cœur des îlots
   n'est plus un sol brun uni.
3. Le chemin du pont au bourg : plus de ruban brun à bords francs dans le bois.
4. Le quai du Wault : un quai de pierre (bassin de ville du XVIIIe, quais pavés), des
   façades moins blanches et moins pareilles.
5. Le dallage flou et étiré du bourg (écart n° 1, village.js) : village.js t'est ouvert
   POUR CELA SEULEMENT. Le bourg ne disparaît pas (question encore posée à Eugène).
6. Les passants : une lavandière au quai du Wault, une marchande, un brasseur rue du Gros
   Gérard, un garde du guet à une porte coupée (rôles et villageois existants, addInteract,
   dialogue ; répliques courtes qui orientent ou racontent le lieu ; STORY.md fait foi).
   Le quai du Wault devient un lieu découvert (E.addLieu).
7. La minicarte et la carte M (hud.js) tracent encore les rues coupées comme ouvertes :
   n'y dessine que l'emprise (dansVille), ou grise ce qui est hors d'elle.
Mesure le chargement avant et après chaque lot (bancs/tour.sh node bancs/charge.mjs, somme
des étapes, budget 17 s), et vérifie l'accès (bancs/acces.mjs index : 0 hors d'atteinte) et
le prologue en headless.
Fichiers AUTORISÉS : quartier.js, carte.js (ce qui borde et dessine la ville seulement),
nature.js, campagne.js, village.js (le dallage seulement), hud.js (le tracé de la ville sur
la minicarte et la carte M seulement), bancs/regard-ville.mjs, bancs/charge.mjs,
bancs/acces.mjs, bancs/sauts.mjs, bancs/resultats/ (tes fichiers), PROMPT-REPRISE.md
(ajouts).
INTERDITS : la citadelle et ECH, tloc-multi.js, engine.js, pnj.js, quetes.js, monde.js,
les fichiers des autres lieux.
```
