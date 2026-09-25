#!/bin/bash
# maj-dev.sh — installé en /usr/local/bin/tloc-maj-dev. Récupère la dernière version poussée
# sur GitHub (branche main) et la met en ligne sur tloc-dev. Lancé par le bouton « Récupérer
# de GitHub » du dev (via sudo, pour le seul utilisateur tloc), ou à la main.
#
# /srv/tloc/dev/repo est un simple miroir du dépôt : on n'y travaille jamais, il suit
# origin/main à l'identique. Le site (/srv/tloc/dev/site) en est une copie sans ce qui ne
# doit pas être servi (exclure.txt : notes, sources d'assets, .git).
set -euo pipefail
REPO=/srv/tloc/dev/repo
SITE=/srv/tloc/dev/site
BRANCHE=main

cd "$REPO"
echo "→ Dépôt : $(git remote get-url origin)"
AVANT=$(git rev-parse --short HEAD 2>/dev/null || echo aucun)
git fetch -q origin "$BRANCHE"
git reset -q --hard "origin/$BRANCHE"
APRES=$(git rev-parse --short HEAD)
echo "→ Version : $AVANT → $APRES  ($(git log -1 --format=%s))"

mkdir -p "$SITE"
rsync -a --delete --exclude-from="$REPO/serveur/deploiement/exclure.txt" --exclude VERSION.json "$REPO/" "$SITE/"
# l'empreinte de la version : le dev l'affiche, la promotion l'emporte en prod
printf '{"date":"%s","commit":"%s","message":%s}\n' \
  "$(git log -1 --format=%cI)" "$APRES" "$(git log -1 --format=%s | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')" \
  > "$SITE/VERSION.json"

/srv/tloc/venv-dev/bin/pip install -q -r "$SITE/serveur/requirements.txt"
systemctl restart tloc-dev
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if curl -fsS --max-time 2 http://127.0.0.1:8101/api/sante >/dev/null 2>&1; then echo "→ Dev en ligne : $APRES"; exit 0; fi
done
echo "❌ Le serveur du dev ne répond pas après la mise à jour."
exit 1
