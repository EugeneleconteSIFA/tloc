# Ce qu'il faut à Eugène fournir pour bâtir toute l'histoire

Relevé du 1er octobre, fait sur le dépôt contre `STORY.md` (qui fait foi). Les boîtes
géographiques sont **approximatives** : à resserrer sur place. Ce qui est déjà là est en fin
de page.

## Constats

- **Hors de Lille, aucune donnée.** Aveyron, Pouget, Villefort, Pouilles, Barletta, les
  Roquette, Nunzia ne figurent que dans `STORY.md`, `docs/SCENARIO.md` et
  `docs/GAME_DESIGN_BRIEF.md`.
- **La chaîne de carte ne sert que Lille** : bornes en dur, lat 50,63634–50,64622,
  lon 3,03506–3,05828 (`carte/ign-recolte.py`, `extraire-osm.py`), 1,7 × 1,2 km. L'IGN
  (BD TOPO, RGE ALTI) ne couvre que la France : la même chaîne peut servir l'Aveyron et la
  Lozère, pas les Pouilles ni la Thaïlande.
- **Une texture manque** : `mage.js:73` appelle `phMat('dirt_floor')`, absente de la banque.
  Le sol de la chaumière du mage retombe sur sa teinte de repli.
- **La musique** : les 13 morceaux de `assets_back/05_audio/musique/` portaient des noms
  de thèmes Zelda ; renommés le 1er octobre à la demande d'Eugène (village-sauve, bourg-jour,
  fanfare, envol, estaminet, campagne, berceuse, ciel, relais, nuit, bord-de-l-eau). Les
  droits sur les morceaux eux-mêmes restent à voir avant une sortie publique.

## Prologue et acte I — d'abord

| quoi | pour quoi | scène |
|---|---|---|
| photos des **vrais géants de Lille** (Lydéric, Phinaert), des fanions, du cortège | la fête, Phinaert ancien géant de procession | prologue, plans 1, 8, 13 |
| une photo de **cloche fendue** | la Grande Cloche qui casse | plan 12 |
| sons : **cloche qui se fend**, murmure de foule, fanfare de procession, herse qui tombe (Freesound CC0 conviendrait) | — | plans 11 à 16 |
| des **enfants** (Émilie, la Corderie) : la banque de personnages n'a que des adultes | — | acte I |
| animations : **tirer une corde de cloche**, poser un objet au sol, salut militaire | Eugène au beffroi, la botte | prologue |
| l'allure de **Houtland**, de Bastien le fantôme, du Capitaine sans tête ; l'armurier, le crieur, l'apothicaire | aucun n'est encore un personnage | acte I |
| la texture Poly Haven **`dirt_floor`** | chaumière du mage | — |

## Cartes et données géographiques

- **Lozère (acte V)** : Villefort, le lac, la Garde-Guérin, la Régordane — env. lat
  44,42–44,48 / lon 3,88–3,96 (≈ 6 km : une copie des scripts de récolte, pas ceux de Lille).
  **Pointer le hameau du Pouget** sur une carte, et des photos : les maisons, le chemin qui
  y monte, la vue d'en haut.
- **Aveyron (acte II)** — fait le 1er octobre (`carte/mondes/aveyron.json`, relief IGN en
  cours) : le lac de Saint-Gervais et Saint-Symphorien ; le Batut, Beauregard, le Pouget,
  le duel, la source et le Dormeur posés à la main autour du lac, validés par Eugène.
  Reste : **une photo ou un dessin de Beauregard.**
- **Pouilles (acte IV)** — Matera, Alberobello et Gallipoli faits le 1er octobre
  (`carte/mondes/*.json`, relief Copernicus GLO-30 récolté) ; Gallipoli complétée le
  2 octobre jusqu'à la gare. **Barletta et Castel del Monte sont retirés** : Eugène et
  Camille n'y sont jamais allés (2 octobre). Matera complétée le 2 octobre (le Sasso
  Barisano). Plus rien à exporter pour les Pouilles.
  - **Le Colosse** : un géant de bronze **inventé**, inspiré de la statue de Barletta, qui
    garde le **port de Gallipoli** (Eugène, 2 octobre).
  - **Le château** de l'acte : le **château Tramontano** de Matera, à la place de Castel del
    Monte (Eugène, 2 octobre). Il est dans `matera.json` (lieux, `chateau`).
  - **À faire** : corriger `docs/SCENARIO.md` sur `STORY.md` — il raconte encore le Colosse
    sur le port de Barletta, Nunzia « jeune fille de Barletta » et le donjon dans Castel del Monte.
- **Thaïlande (acte III)** — Eugène les enverra (1er octobre) ; l'extrait reçu sous ce nom
  couvrait les îles Nicobar (Inde), rangé à part. À exporter sur openstreetmap.org (Exporter →
  zone choisie à la main ; Overpass si c'est trop gros) :
  - **Ko Panyi** et les pitons autour (8,33 N ; 98,50 E) — les îles et les passeurs ;
  - **Wat Tham Suea**, le temple de la grotte du Tigre, Krabi (8,13 N ; 98,92 E) — le temple du Yak ;
  - en plus, si besoin : Khao Phing Kan / Ko Tapu (8,27 N ; 98,50 E), Railay (8,01 N ; 98,84 E),
    Ko Phi Phi Don (7,74 N ; 98,77 E).
  Le relief des pitons viendra de Copernicus GLO-30 (OSM ne le donne pas) — à télécharger
  avec l'accord d'Eugène.
- **La Blessure et l'autre rive (acte VI)** : **décision** sur le bord de Lille où passe le
  canyon ; des références pour la forêt du Buc, les ruines, la forge, la tombe.

## Textures (Poly Haven ; les noms entre guillemets sont des pistes)

- Déjà là : `dry_branches_01` (Lydéric d'osier), `withered_grass`, `terre_battue`,
  `rocky_trail`, `roche_cotiere`, `falaise_02`, `marble_rock_02/03`.
- À ajouter : lauzes (« roof_slates », « castle_wall_slates ») pour l'Aveyron et la Lozère ;
  granit en moellons (le Pouget) ; enduit blanc à la chaux et calcaire clair (Pouilles,
  trulli) ; écorce d'olivier et de châtaignier ; sol de jungle ; tuiles vernissées rouges et
  vertes (temples thaïs) ; laiton et bronze (le Colosse, les cloches).
- **Ciels HDRI** : un seul aujourd'hui (`alps_field_2k.hdr`). Il en faudrait pour midi
  d'été, la mousson, la Méditerranée, la brume de montagne, la nuit de Lille.

## Modèles 3D

- **Géants** : le Dormeur (une vraie falaise couchée, à choisir), le Yak (yaksha du Wat
  Arun), le Colosse (géant de bronze inventé ; la statue de Barletta comme modèle d'allure), le loup géant.
- **Animaux** manquants : loup, moutons, vautours, tarentules, chevaux sauvages (déjà là :
  cheval, biche, vache, taureau, âne). Le pack Quaternius d'origine contient peut-être un loup.
- **Personnages en costume** : les Roquette en cavaliers ; moines thaïs, Nok, Somsak, Mali,
  le passeur ; Nunzia à quatre âges ; le berger ; pèlerins, chevaliers, paysans de 1765,
  ouvriers de 1870.
- **Décors** : barques à longue queue, temples thaïs ; trulli ; train à
  vapeur et gare ; viaduc en trois états de chantier, barrage, menhirs.

## Animations

Monter à cheval (acte II), le lasso (II, VI), grimper une corniche (III, VI : seul
`ClimbUp_1m` existe), la tyrolienne (III), frapper un gong (III), le tambourin (IV), la
sonnaille (V), la marche du loup (V), les poses figées des moines (III). Sources : Quaternius
UAL ou Mixamo.

## Musique, sons, voix

- **Décision** : les droits des 13 morceaux actuels avant toute sortie publique.
- Une musique par monde (`GAME_DESIGN_BRIEF.md` § 27) : western rural (Aveyron), percussions
  thaïes, pizzica (Pouilles), cordes graves (Lozère), cloches graves (le Temple).
- Sons : gong, tambourin, sonnaille, train, pluie, vautours, mer.
- **Décision** : des voix, ou non ?

## Décisions de récit

Qui est l'amour de Nunzia, et où il vit (la quête de la lettre) ; le plan des étages du
Temple au fil des retours ; les cinq cloches (formes, tailles).

## Déjà là, rien à fournir

Lille au 1:1 (OSM, IGN, relief cuit, quartier, citadelle, bourg, beffroi et sa chambre des
cloches, Porte Royale, herse) ; Lydéric et Phinaert riggés ; le mage, Séraphin, Gustave,
Émile, Désiré ; 54 textures Poly Haven ; les feuillages en KTX2 ; les chevaux ; 84
animations (nage, épée, lanterne, portage…).
