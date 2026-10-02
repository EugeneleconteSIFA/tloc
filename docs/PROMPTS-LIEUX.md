# Consignes pour les sessions parallèles — une par lieu (2 octobre)

À coller dans une NOUVELLE conversation Claude Code ouverte sur le dossier même
(`~/Documents/GitHub/the_legend_of_camille`), pas dans un worktree. **Trois sessions au plus en
même temps** : chacune lance ses Chrome headless, et au-delà le Mac (puce Intel, 8 Go) sature, la
carte graphique lâche et le contrôle de publication échoue.

Qui tient quoi aujourd'hui :
- **Thaïlande** (`thailande.js`, `thailande.html`, `carte/mondes/*thailande*`), **`monde.js`**,
  **`temple.js`** : la session principale.
- **Le Pouget** (`pouget.js`, `pouget-bati.js`, `pouget-arbres.js`, `pouget.html`) : sa session.
- **Pouilles** : la « session des mondes » si elle tourne encore — sinon la consigne ci-dessous.

---

## Aveyron — le lac de Saint-Gervais (acte II)

```
Lis CLAUDE.md, PROMPT-REPRISE.md, STORY.md (acte II), docs/SCENARIO.md (§ Aveyron), docs/MONDES-JOUABLES.md et carte/mondes/README.md (§ Aveyron).
Tu t'occupes de l'Aveyron, le lac de Saint-Gervais, et de rien d'autre. Version 2 du lieu : il est jouable (aveyron.html, par la porte du Midi de l'île du temps) mais brut.
À faire, dans cet ordre, en vérifiant chaque étape en rendu headless (bancs/, Playwright de ~/Documents/Projet-Padel, channel 'chrome') :
1. les trois grandes maisons des Roquette (le Batut, Beauregard, le Pouget) : portes, fenêtres, volets, cour, muret — en PBR Poly Haven (phMat), jamais d'aplats ;
2. le bourg de Saint-Symphorien-de-Thénières (aveyron-saint-symphorien.osm) : l'église, la place du Marronnier, le four ;
3. la grande sécheresse : le lac bas avec une grève craquelée, des puits à sec, l'herbe grillée ;
4. des habitants (pnj.js : buildRole, ROLES — ajoute tes rôles À LA FIN de ROLES sans toucher aux autres) : les Roquette en cavaliers, des chevaux (déjà dans la banque).
Fichiers AUTORISÉS : aveyron.js, aveyron.html, carte/mondes/*aveyron*, docs/MONDES-JOUABLES.md (ta ligne seulement), et la fin de l'objet ROLES de pnj.js.
INTERDITS : monde.js (si la recette commune te manque, passe par les crochets de la fiche — plus(ctx), toitSur(b, geo), anime(now) — ou écris ce qu'il te faut dans PROMPT-REPRISE.md § 4.E), engine.js, temple.js, thailande.js, pouget*.js, pouilles.js et les villes des Pouilles, quetes.js, village.js.
Règles : jamais git checkout/reset/pull/stash ; éditer en place ; commentaires en français qui disent pourquoi ; textures à 512 px au plus (la puce Intel du Mac — engine.js réduit déjà tout) ; publier avec ./publier-dev.sh 'message' <tes chemins seulement>, quand la charge du Mac est sous 3 (sysctl -n vm.loadavg) ; la prod jamais. Fais-moi un point bref toutes les 15 minutes.
```

---

## Lozère — Villefort, le lac et la Garde-Guérin (acte V)

```
Lis CLAUDE.md, PROMPT-REPRISE.md, STORY.md (acte V), docs/SCENARIO.md (§ Lozère), docs/MONDES-JOUABLES.md et carte/mondes/README.md (§ Lozère).
Tu crées deux lieux jouables de la Lozère, sur la recette commune monde.js (comme aveyron.js) : 1) Villefort et son lac (le barrage, la gare, la voie ferrée Nîmes–Clermont), 2) la Garde-Guérin (la tour, l'enceinte, l'église Saint-Michel, la Régordane). Les données sont prêtes : carte/mondes/lozere.json (cadrages « lac » et « garde ») et les reliefs IGN relief-lozere-*.json. Le relief du lac est INCOMPLET (relief-lozere-lac.json.part) : relance la récolte de CE cadrage seulement avec carte/mondes/recolter-relief-lozere.py (jamais carte/ign-recolte.py, réglé pour Lille).
Le Pouget n'est PAS à toi : une autre session l'améliore (pouget.js). Pas de porte de l'île pour l'instant : relie Villefort et la Garde-Guérin entre eux et au Pouget par un chemin de lieu à lieu (un panneau « vers… », comme la gare des Pouilles), et donne-moi les positions — c'est moi qui ajouterai l'entrée côté Pouget et l'île.
Vérifie chaque étape en rendu headless (Playwright de ~/Documents/Projet-Padel, channel 'chrome').
Fichiers AUTORISÉS : villefort.js, villefort.html, garde-guerin.js, garde-guerin.html, lozere.js (la fiche commune, si tu en fais une), carte/mondes/*lozere*, docs/MONDES-JOUABLES.md (tes lignes), et UNE ligne dans engine.js : ajouter tes pages à l'objet PAGES (rien d'autre dans engine.js).
INTERDITS : monde.js (passe par plus(ctx), toitSur, anime ; ce qui manque va dans PROMPT-REPRISE.md § 4.E), pouget*.js, temple.js, thailande.js, aveyron.js, pouilles.js et villes, quetes.js, village.js, pnj.js.
Règles : jamais git checkout/reset/pull/stash ; éditer en place ; commentaires en français qui disent pourquoi ; PBR Poly Haven (phMat), pas d'aplats ; textures à 512 px au plus ; publier avec ./publier-dev.sh 'message' <tes chemins seulement> quand la charge du Mac est sous 3 ; la prod jamais. Un point bref toutes les 15 minutes.
```

---

## Pouilles — Matera, Alberobello, Gallipoli (acte IV)

```
Lis CLAUDE.md, PROMPT-REPRISE.md, STORY.md (acte IV), docs/SCENARIO.md (§ Pouilles), docs/DECISIONS-RECIT.md, docs/MONDES-JOUABLES.md et carte/mondes/README.md (§ Pouilles).
Tu t'occupes des Pouilles et de rien d'autre : les trois villes reliées par le petit train sont jouables mais brutes (version 1). Version 2, dans cet ordre, chaque étape vérifiée en rendu headless :
1. les maisons blanches : portes, fenêtres, escaliers extérieurs, murs moins tachés ; les cônes des trulli bien finis au sommet ;
2. Matera : les maisons de la falaise ont des murs démesurés (elles descendent jusqu'au fond) — les poser en gradins sur le tuf, et le château Tramontano ;
3. Gallipoli : le port, les remparts sur la mer, et la place du Colosse (un géant de bronze inventé, qui garde le port — figé pour l'instant) ;
4. des habitants (pnj.js : ajoute tes rôles À LA FIN de ROLES) : Nunzia, Cosimo l'apprenti mécanicien du train.
Fichiers AUTORISÉS : pouilles.js, matera.js, alberobello.js, gallipoli.js et leurs .html, carte/mondes/*pouilles*, matera.json, alberobello.json, gallipoli.json, docs/MONDES-JOUABLES.md (tes lignes), la fin de ROLES dans pnj.js.
INTERDITS : monde.js (crochets plus/toitSur/anime ; le reste dans PROMPT-REPRISE.md § 4.E), engine.js, temple.js, thailande.js, aveyron.js, pouget*.js, quetes.js, village.js.
Règles : jamais git checkout/reset/pull/stash ; éditer en place ; commentaires en français qui disent pourquoi ; PBR Poly Haven, pas d'aplats ; textures à 512 px au plus ; publier avec ./publier-dev.sh 'message' <tes chemins seulement> quand la charge du Mac est sous 3 ; la prod jamais. Un point bref toutes les 15 minutes.
```

---

## Lille — l'acte I (après le prologue)

```
Lis CLAUDE.md, PROMPT-REPRISE.md, PLAN-2026-10-01.md, STORY.md (prologue et acte I), docs/SCENARIO.md, docs/DIALOGUES-ACTE1.md et docs/DECOUPAGE-PROLOGUE.md.
Tu t'occupes de l'acte I à Lille, qui suit le prologue (déjà jouable : la fête, la Grande Cloche qui se fend, Phinaert, la herse). Commence par écrire dans docs/ le découpage de l'acte I en étapes jouables (lieux de Lille, personnages, ce que Camille gagne), sur STORY.md qui fait foi, puis bâtis-le étape par étape, chaque étape vérifiée en rendu headless et mesurée au banc (node bancs/charge.mjs : budget 17 s, rien de nouveau au-delà de 300 ms sans le dire).
Fichiers AUTORISÉS : quetes.js, village.js, citadelle.js, docs/ (tes nouveaux fichiers, et DIALOGUES-ACTE1.md), la fin de ROLES dans pnj.js.
INTERDITS : engine.js sauf accord (dis-moi ce qu'il te faut), monde.js, temple.js, thailande.js, aveyron.js, pouilles.js et villes, pouget*.js, carte.js, carte/ign-recolte.py (ne jamais le relancer).
Règles : jamais git checkout/reset/pull/stash ; éditer en place ; commentaires en français qui disent pourquoi ; PBR Poly Haven, pas d'aplats ; textures à 512 px au plus ; publier avec ./publier-dev.sh 'message' <tes chemins seulement> quand la charge du Mac est sous 3 ; la prod jamais. Un point bref toutes les 15 minutes.
```
