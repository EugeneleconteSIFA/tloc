# Le Pouget — premier lieu de la Lozère (version 1, 2 octobre)

Le premier monde jouable hors de Lille : **le hameau du Pouget** (Pourcharesses, Lozère), dans
la Cloche des Troupeaux de `STORY.md`. Demandé par Eugène le 2 octobre (« vas-y »), sur les
données préparées par la session des mondes (`carte/mondes/README.md`, « La Lozère »).

## Ce qui est là

- **La pente** : le relief LiDAR de l'IGN, à 2 m, sur 600 × 600 m autour du hameau ; au-delà,
  les crêtes des Cévennes (RGE ALTI à 10 m, éclairci à 60 m) jusqu'à l'horizon.
- **Les 19 maisons d'OSM**, en granit à moellons, enterrées côté pente, sous des toits de
  lauzes à deux pans (le toit suit l'axe le plus long de l'emprise).
- **Les chemins** de la carte (la route qui monte au hameau, les pistes, les sentiers) et
  **les ruisseaux**, posés sur le relief.
- **La châtaigneraie** : les bois de la carte plantés d'arbres de la forêt de Lille (l'espèce
  « chêne », écorce photographiée), quelques arbres isolés ailleurs.
- **La porte de l'île** : un arc de pierre seul sur le chemin, qui luit du violet de l'île.

## Y aller (provisoire)

Place d'Armes → la dalle gravée → l'île du temps → **la porte des Troupeaux** (« pousser la
porte des Troupeaux »). Retour par l'arc de pierre (« repasser la porte de l'île »). Dans
l'histoire, cette porte ne s'ouvre qu'à l'acte V ; c'est le premier monde bâti.
Vérifié en jouant (headless) : aller, arrivée sur la route face au hameau, retour sur l'île,
aucune erreur. Planche : `docs/planches/pouget-v1.jpg`.

## Version 2 (2 octobre) — d'après les photos d'Eugène

Planche avant/après : `docs/planches/pouget-v2.jpg`. Le code : `pouget.js` (le lieu),
`pouget-bati.js` (maisons, terrasses, potagers, murets, panneau, piquets), `pouget-arbres.js`
(les arbres de près).

- **Les maisons** : chaque emprise OSM est découpée en corps accolés (tranches de 50 cm le long
  de son orientation), chacun avec sa hauteur et son toit : des rangées, comme sur la vue
  aérienne. Granit en gros moellons (`stone_wall`), toits de lauzes épaisses (`roof_slates_02`,
  16 cm, 50 cm de débord), faîtage de lauzes debout, cheminées, porte côté pente, fenêtres à
  linteau, piédroits et appui de granit, volets.
- **La route d'arrivée** : Camille arrive par la route du nord-est (Street View), goudron gris
  clair, murets de pierre sèche continus et couronnés, panneau bleu émaillé à gauche, piquets
  et lisses sur le pré à droite, bouleaux.
- **Terrasses dallées** de granit devant les façades (une table et ses bancs) et **potagers en
  terrasses** au sud-ouest ; on y marche au-dessus du relief (`level.getH`).
- **Arbres de près** : châtaigniers et bouleaux ramifiés, feuilles par bouquets ; au-delà de
  95 m, les arbres de la forêt de Lille ; **sapinière** dans la vallée et sur les pentes d'en face.
- Le hasard est **fixé** (graines) : le hameau est le même à chaque visite.
- Six matières Poly Haven nouvelles (CC0) dans `assets_back/03_textures/polyhaven/`, inscrites
  dans `PH` par `pouget-bati.js` : à remonter dans `engine.js` quand il sera libre.

**Les noms des maisons** : à poser avec Eugène, d'après son plan des gîtes
(`docs/references/pouget-plan-gites.webp`). Le code est prêt (`LIEUX` dans `pouget.js`, le nom
s'affiche quand Camille passe devant) ; un premier essai de correspondance était faux, la liste
est vide. Pas encore dessinés : le bassin, le parking sous le village.

**Inventé, à remplacer** : le relief au sud de z = +300 m (le RGE ALTI récolté s'arrête là,
juste où la vallée descend) est une suite inventée — une pente qui descend puis remonte en
crête. À remplacer par la vraie tuile IGN.

## À reprendre

- Les maisons : portes en arc de granit, fenêtres, murets de pierre sèche (OSM n'en a pas
  ici), les toits de près (la lauze la plus proche est encore striée).
- Les châtaigniers de près : les arbres de la forêt de Lille sont faits pour être vus de loin.
- Les personnages du Pouget, le berger, la sonnaille ; le lac de Villefort et la
  Garde-Guérin (les données sont prêtes).
