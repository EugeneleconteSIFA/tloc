#!/bin/zsh
# bancs/tour.sh — chacun son tour : UN seul Chrome de test à la fois sur le Mac.
#
#   bancs/tour.sh node bancs/controle.mjs
#   bancs/tour.sh node mon-rendu.mjs …
#
# Pourquoi (2 octobre) : Eugène lance plusieurs conversations Claude en même temps ; chacune
# ouvrait ses Chrome sans tête, tous sur la même petite puce Intel (1,5 Go de mémoire
# graphique) et les 8 Go du Mac. La charge montait à 100–450, la carte graphique lâchait dans
# le navigateur d'Eugène, et le contrôle de publication échouait pour tout le monde (banc
# au-delà de 17 s). Ici, on attend son tour : un verrou (un dossier, que mkdir crée ou refuse
# d'un seul geste), puis que la charge retombe sous 4, puis on lance.
# Un verrou dont le propriétaire est mort est repris. On n'attend pas plus de 30 minutes
# (TOUR_ATTENTE=5400 pour la publication : 90).
# le verrou dans le dépôt même, pas dans /tmp : chaque session a peut-être le sien
V=${0:A:h}/.tour.lock
debut=$(date +%s); dit=0
# on attend plus longtemps pour publier (le contrôle) que pour un rendu : 90 minutes contre 30
ATTENTE=${TOUR_ATTENTE:-1800}
while ! mkdir $V 2>/dev/null; do
  p=$(cat $V/pid 2>/dev/null)
  # propriétaire mort ? `ps -p`, pas `kill -0` : une session dans son bac à sable n'a pas le droit
  # de signaler les processus des autres, et `kill -0` les croyait tous morts
  if [[ -n $p ]] && ! ps -p $p >/dev/null 2>&1; then rm -rf $V; continue; fi
  (( dit )) || { echo "⏳ Un autre banc tourne (pid $p, $(cat $V/quoi 2>/dev/null)) : j'attends mon tour…"; dit=1; }
  (( $(date +%s) - debut > ATTENTE )) && { echo "⌛ $((ATTENTE / 60)) minutes d'attente : j'abandonne."; exit 3; }
  sleep 10
done
echo $$ > $V/pid; echo "$*" > $V/quoi
trap 'rm -rf $V' EXIT INT TERM
dit=0
while (( $(sysctl -n vm.loadavg | awk '{print int($2)}') >= 4 )); do
  (( dit )) || { echo "⏳ Le Mac est chargé ($(sysctl -n vm.loadavg | awk '{print $2}')) : j'attends qu'il retombe sous 4…"; dit=1; }
  (( $(date +%s) - debut > ATTENTE )) && { echo "⌛ $((ATTENTE / 60)) minutes d'attente : je lance quand même."; break; }
  sleep 15
done
"$@"
