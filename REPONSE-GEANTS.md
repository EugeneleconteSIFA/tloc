# Réponse au BRIEF-GEANTS — session personnages

État au moment d'écrire. Fichiers touchés : `geants.js`, `pnj.js`, `demo-pnj.html`.
**Ni `game.js` ni `engine.js`** (voir la section « à faire côté carte » en bas).

## 1. La masse dans la main — FAIT

Le diagnostic du brief est le bon (l'échelle de l'os jetée par `majSockets`), mais le
correctif proposé ne suffisait pas. Multiplier l'offset par l'échelle décomposée suppose
que les axes de l'échelle et ceux de l'offset coïncident. Le long d'un bras qui tourne,
ils ne coïncident plus : l'échelle monde de la main de Phinaert vaut **15,4 / 9,1 / 13,3**,
très anisotrope, et la position partait de travers (le gourdin s'est même éloigné :
0,66 → 0,79 du poignet).

Ce qui marche : traiter l'offset comme un **point dans l'espace local de l'os** et le
passer au monde par la matrice complète, rotation et échelle comprises.

```js
it.os.matrixWorld.decompose(_p, _q, _sOs);
if (it.suitRot) _p.copy(it.p).applyMatrix4(it.os.matrixWorld);
else _p.add(_s.copy(it.p).multiplyScalar(ech));   // accessoire qui reste vertical
...
it.obj.scale.setScalar(ech * (it.base || 1));     // l'objet reste isotrope
```

Appliqué dans `geants.js` **et** `pnj.js` (même code dupliqué des deux côtés).
Prise réglée au centre de la paume : `[0, 0.06, 0.03]`.

**Recette, mesurée et non jugée à l'œil** — distance du manche à l'os `middle_01_r`,
rapportée à la largeur de main (`middle_01` → `thumb_01`), clip `Zombie_Walk` (main fermée) :

| mesure | valeur |
|---|---|
| largeur de main | 0,965 |
| manche → majeur | **0,264** |
| manche → pouce | 0,435 |
| manche → index | 0,567 |

Le manche traverse l'anneau des doigts. Critère 1 tenu.

## 2. Les dents qui traversent la tête — FAIT

Même correctif, comme annoncé dans le brief. Cornes, défenses et anneau de nez sont
désormais posés dans l'espace gonflé du crâne. Vérifié visuellement : les défenses sortent,
les cornes percent le cuir chevelu.

## 3. La taille — FAIT, avec une nuance

`H = 7,6` donnait en réalité **6,7** en jeu : `H` est la taille en POSE DE REPOS, or
Phinaert passe sa vie en `Zombie_Idle_Loop`, qui le voûte de ~12 %. Il se retrouvait à la
taille de Lydéric. Corrigé par `H = 8,65` pour l'ogre.

Mesures actuelles (hauteur debout, os de la tête + calotte) :

| | unités | × l'humain |
|---|---|---|
| Camille | 2,85 | 1,0 |
| villageois | 2,68 – 2,98 | 0,94 – 1,05 |
| Lydéric | 6,62 | 2,3 |
| Phinaert | 7,60 | 2,7 |

**Non vérifié : le passage de la Porte Royale.** Je n'arrive pas à faire démarrer la
citadelle complète dans mon environnement de test (rendu logiciel, plus de 4 min et il
lâche). À vérifier côté carte, ou par Eugène en jeu.

## 4. Déplacement — partiellement fait

- **Foulée proportionnelle à la taille : fait.** `animeGeant()` cale `timeScale` du clip de
  marche sur la distance réellement parcourue (`PAS_PAR_HAUTEUR × hauteur` par cycle,
  borné 0,35–2,2). Un pas = un déplacement, à toutes les vitesses.
- **Tremblement de sol : fait.** Deux appuis par cycle, `G.shake` jusqu'à 0,22, atténué
  linéairement au-delà de 25 unités de la caméra.
- **Déplacement par `blocked()` : PAS FAIT — c'est chez vous.** Le déplacement des ennemis
  est dans `updateEnemy()` (`engine.js`), que je ne touche pas. Il faudrait que le rayon
  passé à `tryMove` suive `KINDS[kind].r` à la nouvelle échelle : Phinaert est déclaré
  `r: 2.4` pour une taille qui a changé deux fois depuis.

## À faire côté carte (demandes, pas des écritures)

1. `KINDS.phinaert` : `r` et `barY` datent de la version en primitives (`barY: 10` pour un
   géant qui fait maintenant 7,6). À réaccorder.
2. La cinématique d'introduction vise `y: 4–6` — à revoir pour un Phinaert à 7,6.
3. Deux changements que j'ai déjà écrits dans `engine.js` **avant** votre message de
   coordination, à connaître pour ne pas les défaire :
   - `updatePlayer()` : la branche « Camille riggée » était un `return` anticipé, qui
     sautait le ramassage et **toutes** les interactions (Eugène ne pouvait plus parler à
     Lydéric). C'est maintenant `if (rigge) { … }` puis `if (!rigge) { … }`. **Ne jamais
     remettre un `return` dans cette fonction.**
   - `ud.pivot.rotation.x` (roulade) est désactivé quand Camille est riggée : elle a un
     vrai clip `Roll` depuis l'arrivée du volume 1 de la bibliothèque d'animations.
   - Ajouts : `setPlayerMesh()`, `setCamilleHook()`, `HOOK_CAMILLE`, `animeCreature()`,
     `setMaker()`, `setAnimHook()`, et des poignées de mise au point sur `window.TLOC`.
4. **`house.html` ne finit plus son chargement** chez moi : `#loading` disparaît, aucune
   erreur console, mais `G.level` reste nul et `bootLevel()` n'est jamais atteint. Appelé
   à la main, tout ce que fait `house.js` fonctionne (`prepare()` ✓, `buildCamille()` ✓,
   `setPlayerMesh()` ✓, `bootLevel` est bien une fonction). Ça sent un effet de bord du
   chantier 1:1 en cours. À regarder ensemble.
