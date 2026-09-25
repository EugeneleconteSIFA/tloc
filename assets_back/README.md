# assets_back — banque d'assets

Rangement par **typologie d'asset** (niveau 1) puis **pack d'origine** (niveau 2).
Tout ce qui est directement exploitable en Three.js est dans les dossiers numérotés.
Rien n'a été supprimé : les formats inutilisables sur le web (FBX, OBJ/MTL, BLEND, STL, DAE,
.unitypackage) sont regroupés tels quels dans `_sources/`.

## Arborescence

```
00_previews/     planches de contact et vignettes, un dossier par pack
01_decors/       modèles d'environnement
  nature/                 kenney_nature-kit ............ 329 .glb
  retro_fantasy/          kenney_retro-fantasy-kit ..... 105 .glb (+ models/Textures/)
  village_medieval/       medieval_village_megakit ..... 176 .gltf + .bin, textures PBR
  props_fantasy/          fantasy_props_megakit ........ 94 .gltf + .bin, 4 trim sets PBR
02_personnages/  modèles de personnages
  base/                   universal_base_characters .... corps + coiffures (.gltf)
  tenues/                 modular_character_outfits .... parties modulaires + tenues (.gltf)
03_textures/     matériaux et textures autonomes
  polyhaven/              23 matériaux PBR CC0 ......... couleur / normale / rugosité / métal, WebP 1024
  retro_fantasy/          kenney_retro-textures-fantasy  119 .png (écarté, cf. politique d'assets)
04_vfx/          particules
  particules/             kenney_particle-pack ......... 192 .png (transparent + fond noir)
05_audio/        sons
  impacts/                kenney_impact-sounds ......... 130 .ogg
_licences/       une licence par pack, copiée et renommée
_sources/        packs d'origine, allégés de ce qui a été extrait ci-dessus (423 Mo)
```

## Format par pack

| Pack | Format web | Textures | État |
|---|---|---|---|
| kenney_nature-kit | .glb | aucune (couleurs de sommets) | prêt, autonome |
| kenney_retro-fantasy-kit | .glb | `models/Textures/*.png` | prêt, ne pas déplacer le dossier `Textures` |
| medieval_village_megakit | .gltf + .bin | `textures/` (PBR 2K) | chemins réécrits, voir ci-dessous |
| fantasy_props_megakit | .gltf + .bin | `textures/` (4 trim sets PBR) | chemins réécrits |
| universal_base_characters | .gltf + .bin | `textures/` | chemins réécrits |
| modular_character_outfits | .gltf + .bin | `textures/` | chemins réécrits |
| modular_dungeon_pack | aucun | — | seulement FBX/OBJ/BLEND → `_sources/`, à convertir |
| free_modular_prototyping | aucun | — | seulement FBX → `_sources/`, à convertir |

## Variantes web (`*_web`)

À côté de chaque dossier de modèles `.gltf` se trouve un dossier `<nom>_web` : mêmes modèles,
mais leurs textures pointent vers `textures_web/` — du WebP 1024 au lieu du PNG 2048.

| Pack | PNG d'origine | WebP 1024 |
|---|---|---|
| medieval_village_megakit | 75,3 Mo | 1,34 Mo |
| fantasy_props_megakit | 38,3 Mo | 0,93 Mo |
| universal_base_characters | 33,0 Mo | 0,77 Mo |
| modular_character_outfits | 76,3 Mo | 0,77 Mo |

Les `.bin` ne sont pas dupliqués : les gltf `_web` pointent vers ceux du dossier `models/`.
C'est la variante `_web` qu'il faut charger dans le jeu ; les PNG d'origine restent là pour
refaire une passe d'optimisation si besoin.

## Ce qui a été corrigé

- Les 218 fichiers `.gltf` référençaient leurs textures **par nom nu**, dans un dossier qui
  n'existait pas à côté d'eux : aucun n'aurait chargé sa texture tel quel. Les URI pointent
  maintenant vers `../textures/<fichier>`, vérifiées une par une.
- Les .png livrés en double à côté des modèles ont été regroupés dans `_sources/_doublons_textures/`.
- `T_VineLeaf_png.png` : le nom référencé n'existait pas, alias créé depuis `T_VineLeaf.png`.

## Limites connues

- **`T_MetalOrnaments_BaseColor.png` et `T_MetalOrnaments_Roughness.png` sont absents du pack
  Medieval Village d'origine.** Les modèles concernés chargeront avec un matériau sans texture
  (avertissement console, pas d'erreur bloquante).
- Les textures d'origine sont en 2048×2048 PNG et pèsent 185 Mo au total : ne jamais les charger
  directement dans le jeu, utiliser les dossiers `_web` décrits plus haut.
- `modular_dungeon_pack` et `free_modular_prototyping` n'ont **aucun** format lisible par le
  navigateur. Il faut convertir leurs .obj/.fbx en .glb (Blender en ligne de commande) avant usage.

## Licences

Voir `_licences/`. Les packs Kenney sont en CC0 (usage libre, y compris commercial, sans
attribution obligatoire). Les packs « [Standard] » ont une licence propre, à relire avant toute
diffusion publique du jeu.

## Outils

- `assets-browser.html` (à la racine du dépôt) — catalogue navigable des 644 modèles :
  vignettes rendues à la volée, recherche, filtre par pack, dimensions réelles en mètres,
  visionneuse 3D avec compte de triangles et chemin à copier. Se sert de `manifest.json`.
- `manifest.json` — un objet par modèle : `pack`, `name`, `path`, `size` (dimensions en mètres).
  Régénérable si tu ajoutes des packs.

## Matériaux Poly Haven (`03_textures/polyhaven/`)

23 matériaux CC0, livrés en 4K avec des cartes EXR linéaires. Ils ont été normalisés :
chaque matériau est un dossier avec `couleur.webp`, `normale.webp`, `rugosite.webp` et parfois
`metal.webp`, tous en 1024. Les EXR ont été converties sans double correction gamma — vérifié :
une carte de normale ressort à une moyenne de (128, 128, 250), ce qu'on attend. Les cartes de
déplacement, de spéculaire et d'anisotropie sont restées dans `_sources/polyhaven/` : elles ne
servent pas au rendu du jeu. **9,4 Mo au total** contre 1,2 Go d'origine.

`materiaux.json` décrit chaque matériau : libellé, usage prévu dans le jeu, `tuile_m` (la taille
réelle du motif, indispensable pour la règle 3 du brief) et la liste des cartes.

Les `tuile_m` ont été estimées en comptant les motifs — pour les briques, nombre d'assises × 7,5 cm.
La valeur exacte est sur la fiche du matériau sur polyhaven.com si tu veux l'affiner.

Trois matériaux sont marqués `retenu: false` : `marble_rock_02` (marbre lisse, rien de flamand),
`wool_boucle` (prince-de-galles, hors époque) et `marble_rock_03` (gardé pour les montagnes du fond).

### Ce qui manque encore côté matériaux

Pavés de rue, tuiles et ardoises de toit, enduit / plâtre, écorce. Ce sont les quatre surfaces
les plus visibles du jeu qui n'ont pas encore de matériau photographique.

### Passe du 20/09/2026 — 8 matériaux ajoutés

Téléchargés en `.blend` 4K sur Poly Haven, normalisés par le même chemin que les précédents
(EXR linéaires converties sans correction de gamma, normales vérifiées à (128, 128, ~230), WebP 1024).
Les téléchargements d'origine sont rangés dans `_sources/polyhaven/`, licence dans `_licences/polyhaven.txt`.

| Matériau | Tuile réelle | Pour quoi |
|---|---|---|
| `clay_roof_tiles` | 4,2 m | tuiles canal brun sombre — toits du village |
| `clay_roof_tiles_02` | 3,9 m | tuiles canal orangées — variante claire |
| `old_stone_wall_02` | 2,5 m | pierre de taille à assises fines — escarpe, chapelle |
| `rock_wall_14` | 2,5 m | galets au mortier — soubassements, moulin |
| `rock_wall_17` | 2,5 m | moellons sombres — galeries de Vauban, caves |
| `rocky_trail` | 2,0 m | terre caillouteuse — routes et sentiers |
| `forest_leaves_02` | 1,8 m | feuilles mortes et mousse — sous-bois, cimetière |
| `withered_grass` | 2,0 m | herbe sèche paille — champ d'Émile, chaume |

Les tuiles réelles sont calibrées par comptage de périodes sur la texture (FFT du profil), puis
multipliées par la taille réelle de l'élément : tuile canal ≈ 16 cm de large, assise de pierre ≈ 11 cm.
`+6,7 Mo` de WebP. Planche de contact : `00_previews/planche_textures_polyhaven_v2.png`.

## 02_personnages/animations/
`ual2.glb` — Universal Animation Library 2 (Quaternius, CC0), 42 clips, allégée pour le web
(8,09 Mo → 1,50 Mo) par `outils_prune_anims.py` à la racine du dépôt : maillages et matériaux
retirés, pistes d'échelle supprimées, translations gardées pour `root` et `pelvis` seulement.
Le rig est **identique** au mannequin UE5 des packs de personnages (65 os, mêmes noms, bind pose
en T) ; `assets.js` recale malgré tout chaque piste en delta sur la pose de repos du personnage,
les proportions différant de 1 à 2 %.

Les sources d'origine restent dans `Universal Animation Library 2[Standard]/`.
**Manque la volume 1**, qui porte la locomotion de base (Idle, Walk, Run, Jump).
