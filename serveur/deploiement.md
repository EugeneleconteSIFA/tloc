# Déploiement de tloc.kernse.fr

> **Remplacé par `deploiement/LISEZMOI.md`** (25 septembre) : prod (tloc.kernse.fr) et dev
> (tloc-dev.kernse.fr), bouton « Promouvoir », copie de la base chaque nuit. Ce qui suit
> décrit l'ancienne installation à un seul site ; les explications (un seul worker, wss://)
> restent vraies.

Le jeu reste **statique** : nginx sert le dossier tel quel. Le serveur Python ne sert
qu'aux comptes, aux parties sauvegardées et au relais multijoueur. Si le service Python
tombe, le jeu solo continue de tourner : seuls la page d'accueil (comptes, instances) et
le multi s'éteignent.

```
navigateur ──► nginx :443  ──┬─► fichiers du jeu (/var/www/tloc)
                             ├─► /api/…  ─► uvicorn 127.0.0.1:8100
                             └─► /ws/…   ─► uvicorn 127.0.0.1:8100 (WebSocket)
```

## 1. DNS

Un enregistrement A `tloc` → l'IP du VPS, dans la zone `kernse.fr`.
Vérifier avant d'aller plus loin : `dig +short tloc.kernse.fr`.

## 2. Les fichiers du jeu

Le VPS reçoit une **copie** du dossier ; rien ne revient jamais vers le Mac.
Toujours dans ce sens, jamais l'inverse (la commande inverse écraserait le travail en cours) :

```bash
# depuis le Mac, dans ~/Documents/GitHub/the_legend_of_camille
rsync -avz --delete \
  --exclude '.DS_Store' --exclude '.Rhistory' --exclude 'Claude outputs/' \
  --exclude 'serveur/.venv' --exclude 'serveur/tloc.db' --exclude 'carte/' \
  --exclude 'outils_*.py' --exclude 'bump.py' --exclude 'demo-*.html' \
  ./ root@VPS:/var/www/tloc/
```

`--delete` nettoie le VPS des fichiers supprimés côté Mac ; il ne touche évidemment
qu'au VPS. Les exclusions gardent le VPS propre : les scripts de récolte IGN, les démos
et les sorties de travail n'ont rien à y faire.

Droits : `chown -R www-data:www-data /var/www/tloc`.

## 3. Le service Python

```bash
apt install -y python3-venv
mkdir -p /var/lib/tloc && chown www-data:www-data /var/lib/tloc   # la base vit ici
cd /var/www/tloc/serveur
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cp tloc.service /etc/systemd/system/tloc.service
systemctl daemon-reload
systemctl enable --now tloc
systemctl status tloc --no-pager
curl -s localhost:8100/api/sante      # {"ok":true,"salons":0,"joueurs":0}
```

La base SQLite est en dehors du dossier web (`/var/lib/tloc/tloc.db`) : un `rsync --delete`
ne peut donc jamais l'effacer. C'est le seul fichier à sauvegarder.

**Un seul worker, c'est voulu** : les salons vivent en mémoire du processus. Avec deux
workers, deux joueurs du même salon peuvent atterrir dans deux processus qui ne se parlent
pas. À quatre joueurs par instance, un worker en tient des dizaines sans transpirer.

## 4. nginx

```bash
cp nginx-tloc.conf /etc/nginx/sites-available/tloc.kernse.fr
ln -s /etc/nginx/sites-available/tloc.kernse.fr /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d tloc.kernse.fr          # HTTPS ; le wss:// du multi en dépend
```

Le multi passe en `wss://` dès que le site est en HTTPS : c'est automatique, le client
dérive l'adresse du salon de celle de la page. Un site en `https` avec un salon en `ws`
serait refusé par le navigateur — d'où le certificat, obligatoire ici.

## 5. Vérifications

```bash
curl -s https://tloc.kernse.fr/api/sante
curl -sI https://tloc.kernse.fr/ | head -1          # 200, le portail de connexion
```

Puis, dans un navigateur : la racine ouvre le **portail** (`connexion.html`) ; une fois
connecté on arrive sur l'**accueil du compte** (`accueil.html`). Créer une partie, entrer
dans la citadelle,
revenir par « ← Accueil », vérifier que la partie affiche des cœurs et des monstres tués.
Pour le multi : ouvrir l'instance dans deux navigateurs **différents** (ou une fenêtre
privée) — deux onglets du même navigateur partagent le même localStorage, donc le même
compte, et le second onglet ferme le premier salon.

## 6. Mises à jour

```bash
# le jeu seul (le plus courant) : rsync, et c'est tout
rsync -avz --delete … ./ root@VPS:/var/www/tloc/

# si serveur/app.py a changé
ssh root@VPS 'systemctl restart tloc'
```

Après un `python3 bump.py 28` côté Mac, les navigateurs rechargent bien les modules :
`bump.py` met aussi à jour `tloc-multi.js` et le `?v=` de `index.html`.

## 7. Réglages

| Où | Quoi |
|---|---|
| `app.py` — `JOUEURS_MAX` | joueurs par instance (4) |
| `app.py` — `PORTEE_COUP`, `CADENCE_COUP` | plausibilité des coups annoncés |
| `app.py` — `INSTANCE_TTL` | péremption d'une instance vide (12 h) |
| `tloc-multi.js` — `DEGATS_EPEE`, `DEGATS_FLECHE` | équilibrage du PvP |
| `tloc-multi.js` — `ENVOIS_PAR_S` | débit réseau (15/s) |

## 8. Sauvegarde

```bash
sqlite3 /var/lib/tloc/tloc.db ".backup '/root/sauvegardes/tloc-$(date +%F).db'"
```

Comptes, parties et instances y sont ; les mots de passe sont hachés en scrypt.
