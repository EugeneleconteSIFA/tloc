# Brief — Phinaert et Lydéric

Écrit pour la session qui travaille sur `geants.js` / `pnj.js` / `locomotion.js`.
Trois défauts constatés en jeu par Eugène, plus le diagnostic de chacun.

---

## 1. « Il ne tient pas vraiment sa masse dans la main »

**Constat.** Le gourdin de Phinaert (et l'épée de Lydéric) flotte à côté du poing
au lieu d'être empoigné.

**Cause probable — l'échelle des os est jetée deux fois.**
`carrure()` (geants.js) gonfle les os pour donner sa masse au géant :

```js
hand_l: [1.22, 1.1, 1.22], hand_r: [1.22, 1.1, 1.22],
```

Mais `majSockets()` décompose la matrice monde de l'os **et jette son échelle** :

```js
it.os.matrixWorld.decompose(_p, _q, _s);   // l'échelle de l'os est jetée
_s.set(...it.p.toArray()).multiplyScalar(ech);
```

`ech` est l'échelle GLOBALE du personnage (`perso.scale.x`), pas celle de l'os.
Le gourdin est donc posé à la position d'une main **non gonflée**, alors que la main
rendue est 22 % plus large et 10 % plus longue. Décalage d'autant plus visible que
l'objet est petit devant la main.

**Correctif proposé.** Composer l'offset avec l'échelle réelle de l'os, sans
l'appliquer à l'objet lui-même (le gourdin ne doit pas être cisaillé) :

```js
it.os.matrixWorld.decompose(_p, _q, _sOs);          // garder _sOs
_s.copy(it.p).multiply(_sOs);                       // offset dans l'espace gonflé de l'os
_p.add(it.suitRot ? _s.applyQuaternion(_q) : _s);
...
it.obj.scale.setScalar(ech);                        // l'objet, lui, reste isotrope
```

Attention : `_sOs` contient déjà `ech` (il vient de la matrice MONDE), donc il ne faut
plus multiplier par `ech` une deuxième fois.

**Puis** régler la prise à la main : `socket(g, perso, 'hand_r', club, [0, 0.03, 0.02], …)`
pose l'axe du manche au centre du poignet. Un manche de gourdin se tient dans la paume,
doigts refermés : viser le centre de la paume (≈ `[0, 0.06, 0.03]` après le correctif
ci-dessus) et vérifier que le manche traverse bien l'anneau des doigts, pas le dos de
la main. Le clip `Walk_Carry_Loop` ferme la main — le tester avec, pas en `Idle`.

---

## 2. « Ses dents traversent sa tête »

**Constat.** Défenses et cornes disparaissent dans le crâne.

**Même cause.** `carrure()` fait `Head: 1.24` et `neck_01: [1.2, 0.72, 1.2]`.
Les offsets des défenses sont calés sur un crâne de taille 1 :

```js
socket(g, perso, 'Head', d, [sx * 0.033, 0.015, 0.098]);   // défenses inférieures
socket(g, perso, 'Head', h, [sx * 0.085, 0.085, 0.0]);     // cornes
```

À 1,24× le crâne, la surface est ~0,024 unité plus loin que là où la défense est posée :
elle s'enfonce. Le correctif du point 1 règle les deux d'un coup.

**Vérification.** Une fois corrigé, contrôler sur le `demo-personnages.html` en rotation
lente : les défenses doivent sortir de la lèvre inférieure, l'anneau de nez pendre
DEVANT la cloison, les cornes percer le cuir chevelu et non le frôler.

---

## 3. « Il est trop grand — ils ne passent pas la porte de la citadelle »

**Ce qui est déjà réglé, côté architecture.** La Porte Royale n'a plus son linteau plat
(intrados à 7,45 unités, sous les géants). Elle a maintenant un arc en plein cintre :
naissance à 7,5, **clé à 12,5**, ouverture de 10 de large. Phinaert à 10,2 passe donc,
mais avec 2,3 de dégagement seulement et il rase les piédroits d'épaule.

**Ce qui reste à décider.** À 10,2 et 8,8 unités pour un villageois à ~2,85, les géants
font 3,6× et 3,1× l'humain. C'est beaucoup : ils dominent les tours de la porte (13),
ne peuvent entrer nulle part, et l'échelle rend leurs animations molles (un pas de géant
à vitesse d'homme lit comme du ralenti).

**Proposition :** `H = 7.6` pour Phinaert et `6.6` pour Lydéric (2,7× et 2,3× l'humain).
Ils restent écrasants à côté de Camille, passent la porte avec de la marge, tiennent dans
le cadre caméra en combat, et leurs foulées redeviennent crédibles.
`H` est déjà une constante unique dans `buildGeant()` — un seul point à changer.
À vérifier après : la caméra du boss, les hauteurs de frappe, et la cinématique
d'introduction (`cam`/`at` visent `y: 4–6`).

---

## 4. Déplacement

- La foulée doit suivre la taille : vitesse de déplacement et vitesse du clip de marche
  proportionnelles à `H`, sinon le géant patine ou glisse. Viser une longueur de pas
  constante en « hauteurs de jambe ».
- Ajouter un léger tremblement de sol à chaque appui (`G.shake` court, 0,15–0,25) quand
  un géant marche à moins de 25 unités de la caméra.
- Comme les villageois (corrigé dans `game.js`), faire passer le déplacement des géants
  par `blocked()` avec un rayon à leur échelle, et non en interpolation libre.

---

## Critères de recette

1. Le gourdin est empoigné : le manche traverse le poing, pas l'air à côté.
2. Défenses, cornes et anneau de nez sortent du crâne sous tous les angles.
3. Phinaert franchit la Porte Royale sans intersection avec l'arc ni les piédroits.
4. Il ne glisse pas : un pas = un déplacement, à toutes les vitesses.
