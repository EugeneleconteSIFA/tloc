#!/bin/bash
# installer-vps.sh — prépare le VPS, une seule fois, en root (Ubuntu 22.04 ou 24.04).
# On le lance depuis le miroir du dépôt GitHub, cloné avec la clé de déploiement du VPS
# (Host github-tloc dans /root/.ssh/config) :
#
#     git clone github-tloc:EugeneleconteSIFA/tloc.git /srv/tloc/dev/repo
#     bash /srv/tloc/dev/repo/serveur/deploiement/installer-vps.sh
#
# Il installe : les paquets, l'utilisateur tloc, les deux serveurs (prod :8130, dev :8131 — le VPS a déjà 8100 à 8104 pris),
# nginx pour tloc.kernse.fr et tloc-dev.kernse.fr (avec la porte du dev), la copie de la
# base chaque nuit, le droit pour le dev de promouvoir, puis la première prod et HTTPS.
# Relançable : ce qui existe déjà n'est pas écrasé (sauf les fichiers de config, remis à jour).
set -euo pipefail
ICI=$(cd "$(dirname "$0")" && pwd)
REPO=/srv/tloc/dev/repo

echo "→ Serveur   : $(hostname) ($(hostname -I 2>/dev/null | awk '{print $1}'))"
echo "→ Système   : $(. /etc/os-release && echo "$PRETTY_NAME")"
echo "→ Dépôt    : $(git -C "$REPO" remote get-url origin 2>/dev/null || echo 'NON CLONÉ')"
echo "→ Sites nginx déjà là : $(ls /etc/nginx/sites-enabled 2>/dev/null | tr '\n' ' ')(on n'y touche pas)"
[ "$(id -u)" = 0 ] || { echo "❌ À lancer en root."; exit 1; }
[ -d "$REPO/.git" ] || { echo "❌ Clone d'abord le dépôt dans $REPO (voir l'en-tête de ce script)."; exit 1; }
read -r -p "Continuer l'installation ? [o/N] " r; [ "$r" = o ] || [ "$r" = O ] || { echo "Rien fait."; exit 0; }

echo "→ Paquets"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx python3-venv sqlite3 rsync curl \
  certbot python3-certbot-nginx apache2-utils >/dev/null
timedatectl set-timezone Europe/Paris          # la copie de la nuit se règle à l'heure de Paris

echo "→ Utilisateur et dossiers"
id tloc >/dev/null 2>&1 || useradd --system --home /srv/tloc --shell /usr/sbin/nologin tloc
mkdir -p /srv/tloc/prod/releases /srv/tloc/dev/site /var/lib/tloc /etc/tloc /var/backups/tloc
chown tloc:tloc /var/lib/tloc
chmod 755 /srv/tloc /srv/tloc/dev /srv/tloc/prod

echo "→ Environnements Python"
for e in dev prod; do
  [ -x /srv/tloc/venv-$e/bin/uvicorn ] || python3 -m venv /srv/tloc/venv-$e
  /srv/tloc/venv-$e/bin/pip install -q -r "$REPO/serveur/requirements.txt"
done

echo "→ Réglages des deux serveurs"
if [ ! -f /etc/tloc/prod.env ]; then
  # le compte Createur naît avec ce mot de passe au premier démarrage de la prod
  read -r -s -p "Mot de passe du compte Createur (6 caractères au moins) : " MDP; echo
  [ ${#MDP} -ge 6 ] || { echo "❌ Trop court."; exit 1; }
  umask 077
  cat > /etc/tloc/prod.env <<CONF
TLOC_ENV=prod
TLOC_DB=/var/lib/tloc/prod.db
TLOC_SITE=/srv/tloc/prod/site
TLOC_CREATEUR_MDP=$MDP
CONF
  umask 022
fi
cat > /etc/tloc/dev.env <<CONF
TLOC_ENV=dev
TLOC_DB=/var/lib/tloc/dev.db
TLOC_SITE=/srv/tloc/dev/site
TLOC_PROD_SITE=/srv/tloc/prod/site
TLOC_PROMOUVOIR=/usr/local/bin/tloc-promouvoir
TLOC_MAJ_DEV=/usr/local/bin/tloc-maj-dev
CONF

echo "→ Scripts, cron, sudo"
install -m 755 "$ICI/promouvoir.sh" /usr/local/bin/tloc-promouvoir
install -m 755 "$ICI/copier-base.sh" /usr/local/bin/tloc-copier-base
install -m 755 "$ICI/maj-dev.sh" /usr/local/bin/tloc-maj-dev
install -m 644 "$ICI/tloc.cron" /etc/cron.d/tloc
install -m 440 "$ICI/tloc.sudoers" /etc/sudoers.d/tloc
visudo -cf /etc/sudoers.d/tloc >/dev/null

echo "→ Services"
install -m 644 "$ICI/tloc-prod.service" /etc/systemd/system/tloc-prod.service
install -m 644 "$ICI/tloc-dev.service" /etc/systemd/system/tloc-dev.service
systemctl daemon-reload
systemctl enable tloc-prod tloc-dev >/dev/null 2>&1
echo "→ Le dev : récupération de GitHub et démarrage"
/usr/local/bin/tloc-maj-dev

echo "→ nginx"
if [ ! -f /etc/nginx/tloc-dev.htpasswd ]; then
  read -r -p "Identifiant de la porte du dev : " QUI
  htpasswd -c /etc/nginx/tloc-dev.htpasswd "$QUI"
fi
install -m 644 "$ICI/nginx-tloc-prod.conf" /etc/nginx/sites-available/tloc.kernse.fr
install -m 644 "$ICI/nginx-tloc-dev.conf" /etc/nginx/sites-available/tloc-dev.kernse.fr
ln -sfn /etc/nginx/sites-available/tloc.kernse.fr /etc/nginx/sites-enabled/tloc.kernse.fr
ln -sfn /etc/nginx/sites-available/tloc-dev.kernse.fr /etc/nginx/sites-enabled/tloc-dev.kernse.fr
nginx -t && systemctl reload nginx

if [ ! -L /srv/tloc/prod/site ]; then
  echo "→ Première prod : copie du dev"
  /usr/local/bin/tloc-promouvoir
  echo "→ Première copie de la base vers le dev"
  /usr/local/bin/tloc-copier-base
fi

echo "→ HTTPS (les deux noms doivent déjà pointer sur ce serveur)"
certbot --nginx -d tloc.kernse.fr -d tloc-dev.kernse.fr --redirect || \
  echo "❌ Certificat pas obtenu : vérifie les DNS, puis relance ce script."

echo "→ État"
for p in 8130 8131; do echo "   :$p $(curl -fsS http://127.0.0.1:$p/api/sante || echo 'ne répond pas')"; done
echo "→ Prod : https://tloc.kernse.fr    Dev : https://tloc-dev.kernse.fr"
