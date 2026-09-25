# Prod et dev sur le VPS

```
Mac ──./publier-dev.sh──► GitHub ──« Récupérer de GitHub »──► tloc-dev.kernse.fr ──« Promouvoir »──► tloc.kernse.fr
     (commit + push main)   EugeneleconteSIFA/tloc   (git pull, clé de déploiement)   (porte à mot de passe)         (là où l'on joue)
                                                     base : copie de la prod  ◄──chaque nuit 3 h 30──  base : la vraie
```

| | prod | dev |
|---|---|---|
| adresse | https://tloc.kernse.fr | https://tloc-dev.kernse.fr (mot de passe nginx) |
| fichiers | `/srv/tloc/prod/site` → `releases/AAAAMMJJ-HHMMSS` (5 gardées) | `/srv/tloc/dev/site`, copié de `/srv/tloc/dev/repo` (miroir de GitHub) |
| serveur | `tloc-prod` sur :8100 | `tloc-dev` sur :8101 |
| base | `/var/lib/tloc/prod.db` | `/var/lib/tloc/dev.db` (copie de la nuit) |
| réglages | `/etc/tloc/prod.env` (mot de passe Createur) | `/etc/tloc/dev.env` |

## Une fois : installer

1. **DNS** (zone `kernse.fr`, dans hPanel) : deux enregistrements A, `tloc` et `tloc-dev`, vers `168.231.85.64`.
   `kernse.fr` pointe déjà sur ce VPS et y est servi par nginx : l'installation n'y touche pas.
2. **Clé de déploiement** sur le VPS (lecture seule sur GitHub) : `/root/.ssh/tloc_deploy`, avec
   `Host github-tloc` dans `/root/.ssh/config`. Vérifier : `ssh -T github-tloc`.
3. **Premier envoi** depuis le Mac : `./publier-dev.sh 'premiere_version'`.
4. **Installation**, sur le VPS en root :
   ```bash
   git clone github-tloc:EugeneleconteSIFA/tloc.git /srv/tloc/dev/repo
   bash /srv/tloc/dev/repo/serveur/deploiement/installer-vps.sh
   ```
   Elle demande le mot de passe du compte Createur, puis l'identifiant et le mot de passe de
   la porte du dev ; elle met le dev en ligne, crée la première prod, la base, et HTTPS.

## Au quotidien

- **Envoyer ses modifications** : `./publier-dev.sh 'message_court'` (dépôt, branche et changements
  affichés, confirmation, commit, push). Si la clé du Mac ouvre le VPS, le dev se met à jour tout seul ;
  sinon, sur le dev connecté en **Createur** : bouton « Récupérer de GitHub ».
- **Passer en prod** : bouton « Promouvoir en prod ». La prod bascule d'un coup sur une copie complète
  du dev ; si elle ne répond pas, elle revient seule à l'ancienne.
- **Revenir en arrière** : bouton « Revenir en arrière », ou `tloc-promouvoir revenir` sur le VPS.
- **La base du dev** est remplacée chaque nuit par celle de la prod (et la prod est sauvegardée,
  14 jours, dans `/var/backups/tloc`). Journal : `/var/log/tloc-copie.log`. Tout de suite : `tloc-copier-base`.

## Ce qui ne part jamais

- sur GitHub (`.gitignore`) : les sources d'assets (≈ 9,5 Go), la base locale, `.venv`, `vps.conf` ;
- sur le web (`exclure.txt` + nginx) : en plus, les notes (`*.md`, dont CLAUDE.md), `.git`, et nginx
  refuse de servir `/serveur/`, les `.py`, `.db`, `.sh`, `.md`.
