#!/bin/sh
# Lance LE serveur du jeu : les pages ET l'API (comptes, parties, multijoueur) sur un seul port.
#
# Pourquoi : `python3 -m http.server` ne sert que les fichiers. L'accueil, les comptes et le
# salon multi appellent /api/... et /ws/... sur la même origine : ils ne marchaient que sur
# le serveur FastAPI (port 8100), et le jeu seul que sur l'autre (8000). serveur/app.py sait
# servir les deux quand TLOC_RACINE lui donne le dossier du jeu — c'est tout ce que fait ce
# script, sur le port 8000 par défaut : les sauvegardes du navigateur sont attachées à
# l'adresse, on garde ainsi celles déjà faites sur http://localhost:8000.
#
# Usage : ./lancer.sh          (port 8000)
#         ./lancer.sh 8100     (autre port)
cd "$(dirname "$0")/serveur" || exit 1
# Sous Windows (Git Bash), le venv range ses exécutables dans Scripts/ et non bin/, et
# `python3` peut n'être que le raccourci du Microsoft Store, qui répond sans rien lancer :
# on prend le premier Python qui exécute vraiment quelque chose (le PC du 5 octobre).
BIN=.venv/bin; [ -d .venv/Scripts ] && BIN=.venv/Scripts
if [ ! -x $BIN/uvicorn ] && [ ! -x $BIN/uvicorn.exe ]; then
  echo "Première fois : installation de l'environnement du serveur…"
  PY=
  for p in python3 python "py -3"; do $p -c 'pass' >/dev/null 2>&1 && { PY=$p; break; }; done
  [ -n "$PY" ] || { echo "Python 3 introuvable : installe-le d'abord."; exit 1; }
  $PY -m venv .venv || exit 1
  BIN=.venv/bin; [ -d .venv/Scripts ] && BIN=.venv/Scripts
  $BIN/python -m pip install -q -r requirements.txt || exit 1
fi
PORT="${1:-8000}"
echo "The Legend of Camille"
echo "  accueil (comptes, parties, multi) : http://localhost:$PORT/"
echo "  jeu direct                        : http://localhost:$PORT/index.html"
echo "  (Ctrl+C pour arrêter)"
# --no-access-log : une ligne par fichier servi noyait le terminal (des centaines de textures
# à chaque chargement), et la ligne du salon multi affichait le jeton de session en clair
# (/ws/<code>?jeton=…). Les erreurs et les avertissements s'affichent toujours.
exec env TLOC_RACINE=.. $BIN/uvicorn app:app --reload --port "$PORT" --no-access-log
