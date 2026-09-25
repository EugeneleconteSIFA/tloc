#!/bin/bash
# publier-dev.sh — envoie tes modifications sur GitHub (branche main), d'où tloc-dev les
# récupère. La prod (tloc.kernse.fr) n'est pas touchée : elle ne change que par le bouton
# « Promouvoir », sur le dev, une fois la version essayée.
#
# Usage : ./publier-dev.sh 'message_court'        (par défaut : maj)
#
# Jamais de checkout, de reset ni de pull dans ce dossier : c'est le seul exemplaire du
# travail en cours (voir CLAUDE.md). Ce script ne fait qu'ajouter, commiter et pousser.
cd "$(dirname "$0")" || exit 1
MESSAGE=${1:-maj}
BRANCH=$(git branch --show-current)

# ce qui part, et où : on lit avant de valider
echo "→ Dépôt : $(basename "$(git rev-parse --show-toplevel)")  ($(git remote get-url origin 2>/dev/null))"
echo "→ Branche : $BRANCH"
echo "→ Changements :"
git status --short | head -30
if [ "$BRANCH" != "main" ]; then
  echo "❌ Pas sur main (actuellement : $BRANCH). Le dev suit main."
  exit 1
fi
printf "Commiter « %s » et pousser sur GitHub ? [o/N] " "$MESSAGE"
read -r REPONSE
if [ "$REPONSE" != "o" ] && [ "$REPONSE" != "O" ]; then echo "→ Rien envoyé."; exit 0; fi

git add . && \
{ git diff --cached --quiet || git commit -q -m "$MESSAGE"; } && \
git push -q origin main
echo "→ Sur GitHub : $(git log -1 --format='%h %s')"

# Le dev récupère tout de suite si la clé du VPS passe ; sinon, c'est un clic sur le dev.
CONF=serveur/deploiement/vps.conf
if [ -f "$CONF" ] && . "./$CONF" && \
   ssh -i "${TLOC_CLE:-$HOME/.ssh/id_tloc_vps}" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 \
     "$TLOC_VPS" tloc-maj-dev 2>/dev/null; then
  echo "→ Dev à jour : https://tloc-dev.kernse.fr"
else
  echo "→ Sur https://tloc-dev.kernse.fr (connecté en Createur) : bouton « Récupérer de GitHub »."
fi
