#!/bin/bash
# publier-dev.sh — envoie tes modifications sur GitHub (branche main), d'où tloc-dev les
# récupère. La prod (tloc.kernse.fr) n'est pas touchée : elle ne change que par le bouton
# « Promouvoir », sur le dev, une fois la version essayée.
#
# Usage : ./publier-dev.sh 'message_court'                  tout ce qui a changé
#         ./publier-dev.sh 'message_court' chemin1 chemin2   seulement ces fichiers-là
#
# Avec des chemins, n'envoie QUE ceux-là : le 30 septembre, « tout ce qui a changé » a failli
# embarquer le travail d'une autre session. Une session Claude donne toujours ses chemins.
#
# Avant d'envoyer, le CONTRÔLE (bancs/controle.mjs : syntaxe, démarrage de chaque page, banc
# de chargement ≤ 17 s) doit passer — il faut ./lancer.sh. Des notes seules (.md) n'y passent
# pas. TLOC_SANS_CONTROLE=1 le saute : réservé à Eugène, pour une urgence, et ça se voit.
#
# Jamais de checkout, de reset ni de pull dans ce dossier : c'est le seul exemplaire du
# travail en cours (voir CLAUDE.md). Ce script ne fait qu'ajouter, commiter et pousser.
cd "$(dirname "$0")" || exit 1
MESSAGE=${1:-maj}
[ $# -gt 0 ] && shift
CHEMINS=("$@")
BRANCH=$(git branch --show-current)

# ce qui part, et où : on lit avant de valider
echo "→ Dépôt : $(basename "$(git rev-parse --show-toplevel)")  ($(git remote get-url origin 2>/dev/null))"
echo "→ Branche : $BRANCH"
echo "→ Changements :"
if [ ${#CHEMINS[@]} -gt 0 ]; then git status --short -- "${CHEMINS[@]}" | head -40
  AUTRES=$(git status --short | wc -l | tr -d ' '); LOT=$(git status --short -- "${CHEMINS[@]}" | wc -l | tr -d ' ')
  [ "$AUTRES" -gt "$LOT" ] && echo "   (et $((AUTRES - LOT)) autre(s) changement(s) hors du lot : ils restent sur le Mac)"
else git status --short | head -30; fi
if [ -z "$(git status --short -- "${CHEMINS[@]:-.}")" ]; then echo "→ Rien à envoyer."; exit 0; fi
if [ "$BRANCH" != "main" ]; then
  echo "❌ Pas sur main (actuellement : $BRANCH). Le dev suit main."
  exit 1
fi
# le contrôle, sauf pour des notes seules
if git status --porcelain -- "${CHEMINS[@]:-.}" | sed 's/^...//; s/.* -> //' | grep -qvE '\.md$'; then
  if [ -n "$TLOC_SANS_CONTROLE" ]; then echo "⚠️  CONTRÔLE SAUTÉ (TLOC_SANS_CONTROLE) — personne n'a vérifié ce qui part."
  else
    echo "→ Contrôle (syntaxe, démarrage des pages, banc de chargement — quelques minutes)…"
    node bancs/controle.mjs || { echo "❌ Rien envoyé : le contrôle a échoué (détail ci-dessus)."; exit 1; }
  fi
fi

printf "Commiter « %s » et pousser sur GitHub ? [o/N] " "$MESSAGE"
read -r REPONSE
if [ "$REPONSE" != "o" ] && [ "$REPONSE" != "O" ]; then echo "→ Rien envoyé."; exit 0; fi

# avec des chemins, le commit ne prend qu'eux — même si autre chose attendait déjà dans l'index
if [ ${#CHEMINS[@]} -gt 0 ]; then git add -A -- "${CHEMINS[@]}"; else git add -A .; fi && \
{ git diff --cached --quiet -- "${CHEMINS[@]:-.}" || git commit -q -m "$MESSAGE" -- "${CHEMINS[@]:-.}"; } && \
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
