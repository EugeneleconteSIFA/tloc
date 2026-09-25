#!/bin/bash
# copier-base.sh — installé en /usr/local/bin/tloc-copier-base, lancé chaque nuit par cron
# (/etc/cron.d/tloc). La base du dev redevient une copie fraîche de celle de la prod : ce
# qu'on a fait sur le dev pendant la journée disparaît, c'est voulu — le dev teste la
# version nouvelle sur les vraies données, il ne les garde pas.
# Au passage, une sauvegarde datée de la prod (quatorze jours gardés).
set -euo pipefail
BASES=/var/lib/tloc
SAUVE=/var/backups/tloc
mkdir -p "$SAUVE"

# « .backup » de sqlite3 : une copie cohérente, même si la prod écrit au même moment
sqlite3 "$BASES/prod.db" ".backup '$SAUVE/prod-$(date +%F).db'"
cp "$SAUVE/prod-$(date +%F).db" "$BASES/dev.db.nouvelle"

systemctl stop tloc-dev
mv "$BASES/dev.db.nouvelle" "$BASES/dev.db"
rm -f "$BASES/dev.db-wal" "$BASES/dev.db-shm"
chown tloc:tloc "$BASES/dev.db"
systemctl start tloc-dev

find "$SAUVE" -name 'prod-*.db' -mtime +14 -delete
echo "$(date '+%F %T') → base du dev recopiée depuis la prod"
