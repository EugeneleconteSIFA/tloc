# The Legend of Camille — règles de travail

Mini-jeu d'aventure 3D (Three.js, modules ES). `./lancer.sh` puis `http://localhost:8000` :
un seul serveur (serveur/app.py) sert le jeu ET l'API des comptes et du multi, sans cache.
`python3 -m http.server` ne sert que les fichiers : accueil, comptes et multi n'y marchent pas.

**Depuis le 5 octobre, le travail se fait sur le PC Windows** (`C:\Users\eleconte\Documents\GitHub\tloc\the_legend_of_camille`) :
le Mac ne sert plus pour ce dépôt, ce dossier-ci est le seul exemplaire du travail en cours.
Les scripts `.sh` se lancent dans **Git Bash**, pas dans PowerShell. `python3` et `python` n'y sont
que des raccourcis du Microsoft Store : le vrai Python est `py -3`. Playwright est dans
`..\outils` (hors du dépôt) ; les bancs utilisent le Chrome du PC. Quand ce fichier ou
`PROMPT-REPRISE.md` parlent du Mac (sa puce, sa charge), c'est l'historique : la contrainte des
textures à 512 px reste, pour les petites machines.

## À lire en premier

`PROMPT-REPRISE.md` : l'état du chantier, ce qui reste à faire, et ce que le code a appris.
`PLAN-2026-10-01.md` : le plan du 1er octobre — l'ordre du travail, et ce qu'Eugène autorise
sans redemander (publier sur le dev si le contrôle passe ; déplacer oui, supprimer non).

Pour l'histoire, **`STORY.md` fait foi** ; `docs/SCENARIO.md` et `docs/DIALOGUES-ACTE1.md` en sont le
détail et se corrigent sur lui. `docs/GAME_DESIGN_BRIEF.md` : les règles de fabrication (ton,
langage, palettes, musique, sons, ce qu'il ne faut pas faire).

## Règles

1. **Jamais de `git checkout`, `reset`, `pull` ni de copie globale du dossier.** Il est
   poussé sur GitHub (`EugeneleconteSIFA/tloc`, par `./publier-dev.sh`), mais ce dossier
   reste le seul exemplaire du travail en cours : rien n'y revient jamais de GitHub.
   Trois sessions ont déjà écrasé `carte.js`.
2. **Demander avant d'écrire dans un fichier qu'Eugène a peut-être ouvert.** La liste des
   fichiers verrouillés change tous les jours — la demander en début de session. Eugène peut
   aussi l'écrire dans `.claude/verrous.txt` (un chemin par ligne) : un hook refuse alors
   toute écriture dans ces fichiers, comme il refuse les commandes git checkout, reset, pull,
   stash, clean, restore et switch (`.claude/garde.py`, `.claude/settings.json`).
3. **Pas de système parallèle** : ce qui appartient au jeu s'écrit dans les fichiers du
   jeu, pas dans un module greffé à côté.
4. **Éditer en place**, jamais réécrire un fichier non lu en entier.
5. **Commentaires en français, qui disent POURQUOI.** Le dépôt est écrit comme ça.
6. **Vérifier en rendu**, pas sur lecture de code — les vrais défauts de ce jeu sont
   visuels et ne se voient pas dans le source.
7. Ne pas relancer `carte/ign-recolte.py` (vingt minutes, et la récolte est bonne).
8. **Le chargement passe avant les nouveautés.** Toute évolution se mesure avant et après
   avec `node bancs/charge.mjs` (et `bancs/profil.mjs` pour trouver le coupable). On juge
   sur la **somme des étapes** (le total bouge de ±3 s avec la charge de la machine) : budget
   **17 s** au banc headless (15 à 17 s le 25 septembre), aucune étape nouvelle au-delà de
   300 ms sans le dire, aucun écran figé sans barre qui avance. Ce
   qu'on voit à améliorer se note tout de suite dans `PROMPT-REPRISE.md`, § 4.E.

## Publier sur le dev

`./publier-dev.sh 'message' chemin1 chemin2…` : une session donne TOUJOURS ses chemins, pour
n'envoyer que son lot. Le script passe d'abord `node bancs/controle.mjs` (syntaxe, démarrage
des six pages sans erreur, banc à froid en médiane de 3 ≤ 17 s et ≤ 45 Mo) et n'envoie rien
s'il échoue. Il faut `./lancer.sh`. Réponse « o » à la question : `echo o | ./publier-dev.sh …`.
**Ne pas se fier à `node --check fichier.js`** : sur un module ES, Node 24 répond 0 même
cassé ; le contrôle, lui, vérifie pour de vrai. La prod : jamais — c'est Eugène.

## Repères utiles

- `saveGame()` sérialise toute clé de `state` : une donnée neuve y est sauvegardée seule.
- `bump.py <v>` aligne les `?v=` de toutes les pages et des modules qui importent `engine.js`.
- `window.TLOC` expose `state`, `player`, `menu`, `scene`, `lieux` — de quoi piloter le jeu
  depuis la console ou Playwright.
- Touches prises : `J` journal, `C` arc, `M` carte (`Maj+M` musique), `B` boire,
  `I` poche, `G` manger une gaufre, `T` chat (en instance), `F` épée, `1`–`4` qualité,
  `P` post-traitement, `O` ombres, `Échap` pause. Une touche nouvelle s'inscrit dans
  `TOUCHES` (engine.js) plutôt que par un guetteur de clavier à part, et se montre dans
  l'aide de droite (`majAide`, `AIDE.extra`) seulement quand elle sert.
