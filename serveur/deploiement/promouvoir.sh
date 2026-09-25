#!/bin/bash
# promouvoir.sh — installé en /usr/local/bin/tloc-promouvoir. Lancé par le bouton
# « Promouvoir » de tloc-dev (via sudo, pour le seul utilisateur tloc), ou à la main.
#
#   tloc-promouvoir            copie la version du dev en prod
#   tloc-promouvoir revenir    remet la version précédente de la prod
#
# La prod n'est jamais modifiée en place : chaque promotion crée une version complète
# dans releases/, puis le lien « site » bascule dessus d'un coup. Si le serveur de la
# prod ne répond pas après le redémarrage, on rebascule sur l'ancienne version, seul.
# La base de la prod (/var/lib/tloc/prod.db) n'est touchée par rien de tout ça.
set -euo pipefail

DEV=/srv/tloc/dev/site
PROD=/srv/tloc/prod
RELEASES=$PROD/releases
GARDER=5                                   # versions conservées pour revenir en arrière

actuelle() { readlink -f "$PROD/site" 2>/dev/null || true; }
basculer() {                               # le lien change d'un coup : jamais de site à moitié copié
  ln -sfn "$1" "$PROD/site.nouveau"
  mv -T "$PROD/site.nouveau" "$PROD/site"
}
repond() {
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    curl -fsS --max-time 2 http://127.0.0.1:8130/api/sante >/dev/null 2>&1 && return 0
  done
  return 1
}

AVANT=$(actuelle)
echo "→ Prod actuelle : ${AVANT:-(aucune)}"

if [ "${1:-}" = "revenir" ]; then
  PRECEDENTE=$(ls -1dt "$RELEASES"/*/ 2>/dev/null | sed 's#/$##' | grep -vx "$AVANT" | head -1 || true)
  if [ -z "$PRECEDENTE" ]; then echo "❌ Pas de version précédente."; exit 1; fi
  echo "→ Retour à : $PRECEDENTE"
  basculer "$PRECEDENTE"
  systemctl restart tloc-prod
  repond && echo "→ Prod : $(basename "$PRECEDENTE")" || { echo "❌ La prod ne répond pas."; exit 1; }
  exit 0
fi

[ -d "$DEV/serveur" ] || { echo "❌ Le dev est vide : rien à promouvoir."; exit 1; }
NOUVELLE="$RELEASES/$(date +%Y%m%d-%H%M%S)"
echo "→ Copie du dev vers $NOUVELLE"
mkdir -p "$RELEASES"
# --link-dest : les fichiers inchangés sont des liens vers la version d'avant, pas des copies
if [ -n "$AVANT" ] && [ -d "$AVANT" ]; then
  rsync -a --delete --link-dest="$AVANT" "$DEV/" "$NOUVELLE/"
else
  rsync -a --delete "$DEV/" "$NOUVELLE/"
fi
echo "→ Dépendances Python"
/srv/tloc/venv-prod/bin/pip install -q -r "$NOUVELLE/serveur/requirements.txt"

echo "→ Bascule et redémarrage"
basculer "$NOUVELLE"
systemctl restart tloc-prod
if repond; then
  echo "→ Prod : $(basename "$NOUVELLE")"
else
  echo "❌ La nouvelle version ne répond pas : retour à l'ancienne."
  if [ -n "$AVANT" ]; then basculer "$AVANT"; systemctl restart tloc-prod; fi
  exit 1
fi

# on garde les GARDER dernières versions
ls -1dt "$RELEASES"/*/ | tail -n +$((GARDER + 1)) | xargs -r rm -rf
echo "→ Versions gardées : $(ls -1d "$RELEASES"/*/ | wc -l | tr -d ' ')"
