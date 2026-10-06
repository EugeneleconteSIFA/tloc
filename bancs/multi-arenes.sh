#!/usr/bin/env bash
# La passe des arènes (consigne C7, 6 octobre) : chaque arène, chaque règle, à deux joueurs sans
# tête et deux bots, par bancs/rencontres.mjs (qui relève erreurs, objets, drapeaux, camps, aire).
# Les drapeaux et la balade se jouent en équipes (bannières, camps nommés), le reste chacun pour soi.
#   bancs/tour.sh bash bancs/multi-arenes.sh      (une heure et demie environ)
cd "$(dirname "$0")/.." || exit 1
for a in ${TLOC_ARENES:-lille gardeguerin pouget batut panyi gallipoli}; do
  for r in balade survie temps drapeaux; do
    m=libre; case $r in balade|drapeaux) m=equipes;; esac
    d=600; [ $r = drapeaux ] && d=300
    echo "== $a $r ($m)"
    TLOC_ARENE=$a TLOC_REGLE=$r TLOC_MODE=$m TLOC_DUREE=$d TLOC_JOUEURS=2 TLOC_BOTS=2 TLOC_FENETRE=${TLOC_FENETRE:-40} \
      TLOC_ETIQUETTE=passe-$a-$r node bancs/rencontres.mjs 2>&1 | grep -E "erreur|objets|vérif|rencontres \(|ne commence"
  done
done
