# The Legend of Camille — règles de travail

Mini-jeu d'aventure 3D (Three.js, modules ES). `./lancer.sh` puis `http://localhost:8000` :
un seul serveur (serveur/app.py) sert le jeu ET l'API des comptes et du multi, sans cache.
`python3 -m http.server` ne sert que les fichiers : accueil, comptes et multi n'y marchent pas.

## À lire en premier

`PROMPT-REPRISE.md` : l'état du chantier, ce qui reste à faire, et ce que le code a appris.

## Règles

1. **Jamais de `git checkout`, `reset`, `pull` ni de copie globale du dossier.** Il est
   poussé sur GitHub (`EugeneleconteSIFA/tloc`, par `./publier-dev.sh`), mais ce dossier
   reste le seul exemplaire du travail en cours : rien n'y revient jamais de GitHub.
   Trois sessions ont déjà écrasé `carte.js`.
2. **Demander avant d'écrire dans un fichier qu'Eugène a peut-être ouvert.** La liste des
   fichiers verrouillés change tous les jours — la demander en début de session.
3. **Pas de système parallèle** : ce qui appartient au jeu s'écrit dans les fichiers du
   jeu, pas dans un module greffé à côté.
4. **Éditer en place**, jamais réécrire un fichier non lu en entier.
5. **Commentaires en français, qui disent POURQUOI.** Le dépôt est écrit comme ça.
6. **Vérifier en rendu**, pas sur lecture de code — les vrais défauts de ce jeu sont
   visuels et ne se voient pas dans le source.
7. Ne pas relancer `carte/ign-recolte.py` (vingt minutes, et la récolte est bonne).
8. **Le chargement passe avant les nouveautés.** Toute évolution se mesure avant et après
   avec `node bancs/charge.mjs` (et `bancs/profil.mjs` pour trouver le coupable). On juge
   sur la **somme des étapes** (le total bouge de ±3 s avec la charge du Mac) : budget
   **17 s** au banc headless (15 à 17 s le 25 septembre), aucune étape nouvelle au-delà de
   300 ms sans le dire, aucun écran figé sans barre qui avance. Ce
   qu'on voit à améliorer se note tout de suite dans `PROMPT-REPRISE.md`, § 4.E.

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
