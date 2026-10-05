"""
The Legend of Camille — serveur d'instances.

Trois choses, et rien de plus :
  1. des comptes joueurs (pseudo + mot de passe) ;
  2. des parties solo rattachées au compte, pour les reprendre d'une machine à l'autre ;
  3. des instances multijoueur : un code à six caractères, 4 joueurs au plus, un relais
     WebSocket qui fait circuler les positions et les coups.

Le monde reste construit chez le client : le serveur ne connaît ni la carte, ni les
monstres, ni les quêtes. Il ne voit que des joueurs qui bougent et qui se tapent dessus.
Pas d'arbitrage sérieux : c'est un jeu entre amis, le client annonce ses coups et le
serveur se contente de vérifier qu'ils sont plausibles (portée, cadence).

Lancement en local (sert aussi le jeu, pratique pour tester) :
    TLOC_RACINE=.. uvicorn app:app --reload --port 8100
Sur le VPS : voir deploiement.md.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
import random
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

ICI = Path(__file__).resolve().parent
BASE = Path(os.environ.get("TLOC_DB", ICI / "tloc.db"))
RACINE = os.environ.get("TLOC_RACINE")          # dossier du jeu, si le serveur doit aussi le servir

JOUEURS_MAX = 4                 # par instance, chacun pour soi
JOUEURS_MAX_EQUIPES = 8         # en équipes : deux camps de quatre
CAMPS = ("garnison", "bourg")   # la garnison de la citadelle contre les gens du bourg
FETE_DUREE = int(os.environ.get("TLOC_FETE_DUREE", 180))   # la fête de la moisson : trois minutes (réglable pour le banc)
FETE_CADENCE = 40               # plus de 40 plantes par seconde, c'est un tricheur, pas une faux
BOURSE_VIE = 90                 # une bourse tombée reste 90 s au sol
BOURSE_PORTEE = 4.0             # mètres : on ne ramasse pas une bourse depuis l'autre bout du pré
DON_MAX = 999
BANNIERE_PORTEE = 4.0           # mètres pour saisir une bannière
BANNIERE_RETOUR = int(os.environ.get("TLOC_BANNIERE_RETOUR", 30))   # une bannière tombée rentre seule (s)
BANNIERE_POINTS = 3             # rapporter la bannière adverse vaut trois mises à terre
# En balade par équipes, il n'y a pas de manche : le premier camp à VICTOIRE_BALADE points
# l'emporte, on montre le tableau, et points et bannières repartent de zéro (Eugène).
VICTOIRE_BALADE = int(os.environ.get("TLOC_VICTOIRE_BALADE", 10))   # abaissé au banc
# La prise des drapeaux (règle `drapeaux`, en équipes) : des drapeaux aux points forts de la
# citadelle, pris en restant dans leur cercle. À la fin du chrono, le camp qui en tient le
# plus gagne ; à égalité, celui qui les a tenus le plus longtemps (drapeaux × secondes).
# Leur nombre suit la partie (Eugène, 28 septembre) : arrondi supérieur de la moitié des
# joueurs, bots compris, moins un — un de moins que les places à tenir d'un camp, pour
# qu'aucun camp ne puisse tout garder sans jamais bouger. Au moins un.
DRAPEAU_RAYON = 8.0             # mètres : le cercle où l'on prend (ou défend) le drapeau
DRAPEAU_PRISE = float(os.environ.get("TLOC_DRAPEAU_PRISE", 8))   # secondes pour un preneur seul
DRAPEAUX_MAX = 5                # au plus cinq drapeaux en jeu…
EMPLACEMENTS_MAX = 24           # … tirés au sort parmi la vingtaine d'emplacements proposés par le client
DRAPEAU_PAS = 0.25              # le serveur regarde les cercles quatre fois par seconde


def nb_drapeaux(joueurs: int) -> int:
    return max(1, min(DRAPEAUX_MAX, math.ceil(joueurs / 2) - 1))


def tirer_drapeaux(lieux: dict, n: int) -> list:
    """`n` emplacements au hasard, aussi écartés que possible : on exige d'abord 110 m entre
    deux drapeaux, puis on relâche l'écart tant qu'on n'en trouve pas assez."""
    ids = list(lieux)
    random.shuffle(ids)
    d = lambda a, b: math.hypot(lieux[a]["p"][0] - lieux[b]["p"][0], lieux[a]["p"][1] - lieux[b]["p"][1])
    for ecart in (110, 90, 70, 50, 30, 0):
        pris: list = []
        for k in ids:
            if all(d(k, q) >= ecart for q in pris):
                pris.append(k)
                if len(pris) == n:
                    return pris
    return ids[:n]
# L'équipement du multi : une armure et un écu, posés à des lieux fixes de la carte (le
# premier client les propose, le serveur les garde), au premier qui les atteint. L'écu se
# garde ; l'armure se fend sous les coups (le client de celui qui la porte compte, comme
# pour ses cœurs) et, brisée, ne revient qu'à la manche suivante (Eugène, 27 septembre).
# Les niveaux achetés à la forge restent l'affaire du client : ils ne changent rien à
# l'arbitrage. OBJET_RETOUR ne sert plus qu'aux objets qui reviennent seuls.
# Le cheval (27 septembre) : pris à l'écurie par qui le monte, laissé là où l'on descend ;
# mort, il revient à l'écurie après OBJET_RETOUR secondes. Sa vie (pv) suit l'objet.
# Deux exemplaires de certains (Eugène, 27 septembre) : chaque objet a donc son identifiant
# (« armure-1 », « cheval-blanc »…), son type dit ce qu'il fait. L'arc se garde, comme l'écu.
OBJETS = ("armure", "bouclier", "cheval", "arc")
OBJETS_MAX = 10
CHEVAL_PV = 10
OBJET_PORTEE = 4.0
OBJET_RETOUR = int(os.environ.get("TLOC_OBJET_RETOUR", 45))


def places(mode: str) -> int:
    return JOUEURS_MAX_EQUIPES if mode == "equipes" else JOUEURS_MAX


# Les bots : des joueurs sans connexion, que fait vivre le navigateur d'un humain du salon
# (le « pilote », l'hôte de préférence) — lui seul connaît le terrain et les collisions.
# Le serveur les traite comme les autres : même vérification des coups, mêmes scores.
TOTAL_MAX = 12                   # humains et bots ensemble
NIVEAUX = ("recrue", "soldat", "veteran")
NOMS_BOTS = ("Baudouin", "Mahaut", "Firmin", "Aldegonde", "Gaspard", "Philippine", "Wulfran",
             "Ursule", "Anselme", "Clémence", "Lambert", "Bertille")


# Les règles d'une partie, par-dessus le mode (chacun pour soi / en équipes) :
#   balade — on se promène et on se bat, sans fin ni score de manche (l'origine) ;
#   survie — match à mort : une vie par manche, le dernier debout (ou le dernier camp) gagne ;
#   temps  — chrono : une durée choisie, classement sur « mis à terre − tombé », façon Smash.
# Le match à mort se joue en 1 à 5 vies, le chrono de 1 à 15 minutes : choisis à la création.
# L'arbitre est le serveur : c'est lui qui voit passer les coups et les morts.
#   drapeaux — prise des drapeaux, en équipes seulement : chrono, puis le camp qui tient le
#              plus de drapeaux gagne (cf. DRAPEAU_RAYON).
REGLES = ("balade", "survie", "temps", "drapeaux")
MANCHE_COMPTE = int(os.environ.get("TLOC_MANCHE_COMPTE", 10))     # compte à rebours avant une manche
# L'OUVERTURE d'une partie, tous modes, balade comprise (Eugène, 30 septembre) : une minute de
# trêve pour que chacun entre, que les bots apparaissent, que les drapeaux se posent et qu'on
# ramasse de quoi se battre. Aucun coup ne porte pendant un compte à rebours.
MANCHE_OUVERTURE = int(os.environ.get("TLOC_MANCHE_OUVERTURE", 60))
MANCHE_DUREE_BANC = os.environ.get("TLOC_MANCHE_DUREE")            # le banc raccourcit le chrono
MANCHE_PAUSE = int(os.environ.get("TLOC_MANCHE_PAUSE", 30))       # les résultats, avant la suivante
# (12 s ne laissaient pas lire les résultats ; qui veut enchaîner a le bouton « Rejouer »)
MANCHE_RELANCE = 3              # compte à rebours quand tous les humains ont pressé « Rejouer »
SEUIL_FAIBLE = 0.4              # une cible à 40 % de ses cœurs ou moins est « affaiblie »

# LES BADGES (Eugène, 29 septembre). Deux sortes, qui ne disent pas la même chose :
#   - les STYLES DE JEU te caractérisent sur une manche : chacun en reçoit UN par manche, le
#     plus haut rang de ceux qu'il a mérités (Badaud, faute de mieux) — « quel joueur tu as été » ;
#   - les RÉCOMPENSES s'y ajoutent : les exploits de manche (se regagnent), et les hauts
#     faits de voyage, de quêtes et de fidélité (un seuil franchi une fois pour toutes, évalués
#     par hauts_faits() sur les compteurs du compte et ses parties solo).
# Le nom, la phrase, la famille et le rang vivent ici seulement : l'accueil et le jeu les
# lisent au serveur. `but` : (compteur, seuil) pour les hauts faits — la progression s'affiche.
RANGS = ("commun", "rare", "epique", "legendaire")
FAMILLES = {"style": "Styles de jeu", "exploits": "Exploits", "voyage": "Voyage", "quetes": "Quêtes", "fidelite": "Fidélité"}
BADGES = {
    # --- styles de jeu (un par manche)
    "badaud":        ("Badaud", "Est passé voir la bataille, sans trop s'y mêler.", "style", "commun", None),
    "premiere_lame": ("Première lame", "Le premier à mettre quelqu'un à terre dans la manche.", "style", "commun", None),
    "bourrin":       ("Bourrin", "Fonce dans le tas : le plus de cœurs arrachés de la manche.", "style", "commun", None),
    "tete_brulee":   ("Tête brûlée", "Au chrono, le plus souvent à terre… et toujours revenu.", "style", "commun", None),
    "porte_etendard": ("Porte-étendard", "A levé le premier drapeau de la manche.", "style", "commun", None),
    "vengeur":       ("Vengeur", "A mis à terre celui qui venait de l'abattre.", "style", "rare", None),
    "opportuniste":  ("Opportuniste", "N'attaque que les ennemis déjà affaiblis — et les achève.", "style", "rare", None),
    "oeil_de_lynx":  ("Œil de lynx", "Trois adversaires mis à terre à l'arc dans la manche.", "style", "rare", None),
    "chevalier":     ("Chevalier", "Deux adversaires mis à terre du haut de sa selle.", "style", "rare", None),
    "conquerant":    ("Conquérant", "Le plus de drapeaux pris dans la manche (deux au moins).", "style", "rare", None),
    "faucheur":      ("Faucheur", "Trois adversaires à terre d'affilée, sans tomber.", "style", "epique", None),
    "increvable":    ("Increvable", "Une manche au chrono sans jamais tomber.", "style", "epique", None),
    # --- exploits (récompenses de manche, en plus du style)
    "vainqueur":     ("Vainqueur", "A remporté une manche.", "exploits", "rare", None),
    "rempart":       ("Rempart", "Son camp tenait tous les drapeaux (trois au moins) au coup de sifflet.", "exploits", "epique", None),
    "fleau":         ("Fléau des Flandres", "Cinq adversaires à terre d'affilée, sans tomber.", "exploits", "legendaire", None),
    "intouchable":   ("Intouchable", "A gagné un match à mort sans perdre une seule vie.", "exploits", "legendaire", None),
    "globe_trotteur": ("Globe-trotteur", "A pris part à la prise de TOUS les drapeaux de la manche (trois au moins).", "exploits", "legendaire", None),
    # --- voyage (hauts faits : les kilomètres parcourus, en solo et en multi)
    "promeneur":     ("Promeneur", "Cinq kilomètres parcourus.", "voyage", "commun", ("metres", 5000)),
    "pelerin":       ("Pèlerin", "Quinze kilomètres parcourus.", "voyage", "rare", ("metres", 15000)),
    "aventurier":    ("Aventurier", "Un marathon : quarante-deux kilomètres parcourus.", "voyage", "epique", ("metres", 42195)),
    "arpenteur":     ("Arpenteur des Flandres", "Cent kilomètres parcourus.", "voyage", "legendaire", ("metres", 100000)),
    # --- quêtes (hauts faits : l'aventure solo, lue dans les parties rattachées au compte)
    "archere":       ("Archère", "A trouvé l'arc du bastion de Turenne.", "quetes", "commun", ("arc", 1)),
    "ami_des_chats": ("Ami des chats", "A mené à bien la quête du chat.", "quetes", "commun", ("chat", 1)),
    "chasse_corbeaux": ("Chasse-corbeaux", "A mené à bien la quête des corbeaux.", "quetes", "commun", ("corbeaux", 1)),
    "exorciste":     ("Exorciste", "A mené à bien la quête des fantômes.", "quetes", "rare", ("fantomes", 1)),
    "guetteur":      ("Guetteur du beffroi", "A résolu l'énigme du guetteur et gagné la carte.", "quetes", "rare", ("carte", 1)),
    "tombeur":       ("Tombeur de Phinaert", "A vaincu le géant Phinaert dans l'enclos du donjon.", "quetes", "epique", ("boss", 1)),
    "liberateur":    ("Libérateur d'Eugène", "A délivré Eugène des galeries.", "quetes", "legendaire", ("eugene", 1)),
    # --- fidélité (hauts faits : les manches jouées et gagnées en multi)
    "habitue":       ("Habitué", "Dix manches jouées.", "fidelite", "commun", ("manches", 10)),
    "pilier":        ("Pilier de l'estaminet", "Cinquante manches jouées.", "fidelite", "rare", ("manches", 50)),
    "champion":      ("Champion", "Dix manches gagnées.", "fidelite", "epique", ("victoires", 10)),
    "legende":       ("Légende de la Citadelle", "Cinquante manches gagnées.", "fidelite", "legendaire", ("victoires", 50)),
}


def badges_de_manche(ids: list[str]) -> list[str]:
    """UN style de jeu (le plus haut rang, à rang égal le premier de la liste ; Badaud faute de
    mieux), puis les exploits, tous."""
    styles = [b for b in ids if BADGES[b][2] == "style"] or ["badaud"]
    style = max(styles, key=lambda b: (RANGS.index(BADGES[b][3]), -list(BADGES).index(b)))
    return [style] + [b for b in dict.fromkeys(ids) if BADGES[b][2] != "style"]


def valeurs_compte(cx: sqlite3.Connection, jid: int) -> dict[str, float]:
    """Les compteurs des hauts faits : ceux du multi (table compteurs) et ce que disent les
    parties solo synchronisées (les drapeaux de quête, les mètres parcourus)."""
    v = {r["cle"]: r["n"] for r in cx.execute("SELECT cle, n FROM compteurs WHERE joueur = ?", (jid,))}
    for r in cx.execute("SELECT donnees FROM parties WHERE joueur = ?", (jid,)):
        try:
            f = (json.loads(r["donnees"]) or {}).get("flags") or {}
        except Exception:
            continue
        v["metres"] = v.get("metres", 0) + float(f.get("distance") or 0)
        for cle, ok in (("arc", f.get("bow")), ("chat", (f.get("q_cat") or 0) >= 3), ("corbeaux", (f.get("q_crows") or 0) >= 3),
                        ("fantomes", (f.get("q_ghosts") or 0) >= 3), ("carte", f.get("carteBeffroi")),
                        ("boss", f.get("bossDead")), ("eugene", f.get("princeFreed"))):
            if ok:
                v[cle] = 1
    return v


def hauts_faits(cx: sqlite3.Connection, jid: int) -> dict[str, float]:
    """Décerne les hauts faits dont le seuil est franchi (une fois pour toutes) ; rend les valeurs."""
    v = valeurs_compte(cx, jid)
    for b, (_, _, _, _, but) in BADGES.items():
        if but and v.get(but[0], 0) >= but[1]:
            cx.execute("INSERT INTO badges (joueur, badge, n) VALUES (?,?,1) ON CONFLICT(joueur, badge) DO NOTHING", (jid, b))
    return v


def compter(cx: sqlite3.Connection, jid: int, cle: str, n: float):
    cx.execute("""INSERT INTO compteurs (joueur, cle, n) VALUES (?,?,?)
                  ON CONFLICT(joueur, cle) DO UPDATE SET n = n + excluded.n""", (jid, cle, n))


def places_humains(mode: str, bots: int) -> int:
    """Les places laissées aux humains : celles du mode, dans la limite de douze en tout."""
    return max(1, min(places(mode), TOTAL_MAX - bots))
PORTEE_COUP = 7.0               # mètres : au-delà, le coup d'épée annoncé est refusé
# Une flèche part à 40 m/s et vit 1,5 s (engine.js) : 60 m au plus. Avec la seule portée de
# l'épée, toute flèche qui touchait au-delà de 7 m était perdue — entre joueurs comme sur un bot.
PORTEE_FLECHE = 62.0
CADENCE_COUP = 0.22             # secondes entre deux coups d'un même joueur
INSTANCE_TTL = 12 * 3600        # une instance sans personne dedans expire au bout de 12 h

RE_PSEUDO = re.compile(r"^[A-Za-z0-9_\-]{3,16}$")
# alphabet sans les caractères qu'on confond à l'oral (0/O, 1/I/L)
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

app = FastAPI(title="The Legend of Camille", docs_url=None, redoc_url=None)
# l'API ne s'appuie sur aucun cookie (jeton porté par l'en-tête) : ouvrir CORS ne coûte
# rien et permet de servir le jeu depuis un simple `python3 -m http.server` en local.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# =====================================================================
#  Base
# =====================================================================
@contextmanager
def db():
    cx = sqlite3.connect(BASE, timeout=10)
    cx.row_factory = sqlite3.Row
    cx.execute("PRAGMA journal_mode=WAL")
    cx.execute("PRAGMA foreign_keys=ON")
    try:
        yield cx
        cx.commit()
    finally:
        cx.close()


def init():
    with db() as cx:
        cx.executescript("""
        CREATE TABLE IF NOT EXISTS joueurs (
            id       INTEGER PRIMARY KEY,
            pseudo   TEXT UNIQUE NOT NULL COLLATE NOCASE,
            mdp      TEXT NOT NULL,
            cree     REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS jetons (
            jeton    TEXT PRIMARY KEY,
            joueur   INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            cree     REAL NOT NULL,
            vu       REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS parties (
            id       TEXT PRIMARY KEY,
            joueur   INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            nom      TEXT NOT NULL,
            donnees  TEXT NOT NULL,
            resume   TEXT NOT NULL DEFAULT '{}',
            maj      REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS parties_joueur ON parties(joueur);
        CREATE TABLE IF NOT EXISTS instances (
            code     TEXT PRIMARY KEY,
            nom      TEXT NOT NULL,
            hote     INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            cree     REAL NOT NULL,
            vu       REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS membres (
            code     TEXT NOT NULL REFERENCES instances(code) ON DELETE CASCADE,
            joueur   INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            rejoint  REAL NOT NULL,
            PRIMARY KEY (code, joueur)
        );
        """)
        # le point de rendez-vous est venu après coup : une base déjà créée n'a pas la
        # colonne, et CREATE TABLE IF NOT EXISTS ne l'ajoute pas
        cols = {r["name"] for r in cx.execute("PRAGMA table_info(instances)")}
        if "rdv" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN rdv TEXT")
        # le mode de jeu (chacun pour soi / en équipes) et la bourse en jeu dans les duels :
        # choisis à la création de l'instance
        if "mode" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN mode TEXT NOT NULL DEFAULT 'libre'")
        if "enjeu" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN enjeu INTEGER NOT NULL DEFAULT 0")
        # les bots, et leur niveau : choisis à la création, comme le mode
        if "bots" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN bots INTEGER NOT NULL DEFAULT 0")
        if "niveau" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN niveau TEXT NOT NULL DEFAULT 'soldat'")
        if "regle" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN regle TEXT NOT NULL DEFAULT 'balade'")
        if "vies" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN vies INTEGER NOT NULL DEFAULT 1")
        if "duree" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN duree INTEGER NOT NULL DEFAULT 180")
        # l'arène (5 octobre) : où se joue l'instance — les instances d'avant jouaient à Lille
        if "arene" not in cols:
            cx.execute("ALTER TABLE instances ADD COLUMN arene TEXT NOT NULL DEFAULT 'lille'")
        # le profil : une photo (petite image en data URL, recadrée par le navigateur) et une devise
        jcols = {r["name"] for r in cx.execute("PRAGMA table_info(joueurs)")}
        if "photo" not in jcols:
            cx.execute("ALTER TABLE joueurs ADD COLUMN photo TEXT")
        if "devise" not in jcols:
            cx.execute("ALTER TABLE joueurs ADD COLUMN devise TEXT NOT NULL DEFAULT ''")
        # les amis : une ligne par paire (a < b), en demande puis acceptée
        cx.execute("""CREATE TABLE IF NOT EXISTS amis (
            a     INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            b     INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            de    INTEGER NOT NULL,
            etat  TEXT NOT NULL DEFAULT 'demande',
            cree  REAL NOT NULL,
            PRIMARY KEY (a, b))""")
        # les conversations : à deux ou en groupe, et leurs messages (dont les invitations)
        cx.executescript("""
        CREATE TABLE IF NOT EXISTS convs (
            id     INTEGER PRIMARY KEY,
            nom    TEXT,
            groupe INTEGER NOT NULL DEFAULT 0,
            cree   REAL NOT NULL,
            maj    REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS conv_membres (
            conv   INTEGER NOT NULL REFERENCES convs(id) ON DELETE CASCADE,
            joueur INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            lu     INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (conv, joueur)
        );
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY,
            conv        INTEGER NOT NULL REFERENCES convs(id) ON DELETE CASCADE,
            auteur      INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            texte       TEXT NOT NULL DEFAULT '',
            invitation  TEXT,
            t           REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS messages_conv ON messages(conv, id);
        """)
        if "retour" not in {r["name"] for r in cx.execute("PRAGMA table_info(convs)")}:
            cx.execute("ALTER TABLE convs ADD COLUMN retour INTEGER NOT NULL DEFAULT 0")
        # les manches jouées (match à mort, chrono) : pour la vue admin du créateur
        cx.execute("""CREATE TABLE IF NOT EXISTS manches (
            id       INTEGER PRIMARY KEY,
            code     TEXT NOT NULL,
            regle    TEXT NOT NULL,
            joueurs  INTEGER NOT NULL,
            humains  INTEGER NOT NULL,
            t        REAL NOT NULL)""")
        # les compteurs des hauts faits : mètres parcourus en multi, manches jouées et gagnées
        cx.execute("""CREATE TABLE IF NOT EXISTS compteurs (
            joueur  INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            cle     TEXT NOT NULL,
            n       REAL NOT NULL DEFAULT 0,
            PRIMARY KEY (joueur, cle))""")
        # les badges d'un compte : combien de fois chacun a été gagné
        cx.execute("""CREATE TABLE IF NOT EXISTS badges (
            joueur  INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
            badge   TEXT NOT NULL,
            n       INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (joueur, badge))""")


init()


# =====================================================================
#  Comptes
# =====================================================================
def hacher(mdp: str) -> str:
    sel = secrets.token_bytes(16)
    h = hashlib.scrypt(mdp.encode(), salt=sel, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt${sel.hex()}${h.hex()}"


def verifier(mdp: str, stocke: str) -> bool:
    try:
        _, sel, h = stocke.split("$")
        calc = hashlib.scrypt(mdp.encode(), salt=bytes.fromhex(sel), n=2 ** 14, r=8, p=1, dklen=32)
        return secrets.compare_digest(calc.hex(), h)
    except Exception:
        return False


def joueur_du_jeton(jeton: str | None) -> sqlite3.Row | None:
    if not jeton:
        return None
    with db() as cx:
        r = cx.execute(
            "SELECT j.id, j.pseudo FROM jetons t JOIN joueurs j ON j.id = t.joueur WHERE t.jeton = ?",
            (jeton,)).fetchone()
        # Le dev est réservé au créateur. Sa base est une copie de la prod, jetons compris :
        # la session encore ouverte d'un joueur y serait valable. On la refuse ici, et c'est
        # ce qui ferme aussi l'API et le salon — pas seulement le formulaire de connexion.
        if r and os.environ.get("TLOC_ENV") == "dev" and r["pseudo"].lower() != CREATEUR.lower():
            return None
        if r:
            cx.execute("UPDATE jetons SET vu = ? WHERE jeton = ?", (time.time(), jeton))
        return r


def porteur(authorization: str = Header(default="")) -> sqlite3.Row:
    jeton = authorization[7:] if authorization.lower().startswith("bearer ") else None
    j = joueur_du_jeton(jeton)
    if not j:
        raise HTTPException(401, "connexion requise")
    return j


def assurer_createur():
    """Crée le compte du créateur s'il manque, avec TLOC_CREATEUR_MDP. Sans ce mot de passe,
    rien ne se passe : un compte créé ici ne peut pas être volé par une inscription."""
    mdp = os.environ.get("TLOC_CREATEUR_MDP")
    if not mdp:
        return
    with db() as cx:
        if not cx.execute("SELECT 1 FROM joueurs WHERE pseudo = ?", (CREATEUR,)).fetchone():
            cx.execute("INSERT INTO joueurs (pseudo, mdp, cree) VALUES (?,?,?)", (CREATEUR, hacher(mdp), time.time()))



class Identifiants(BaseModel):
    pseudo: str = Field(max_length=32)
    mdp: str = Field(max_length=128)


def ouvrir_session(joueur_id: int, pseudo: str) -> dict:
    jeton = secrets.token_urlsafe(32)
    with db() as cx:
        cx.execute("INSERT INTO jetons (jeton, joueur, cree, vu) VALUES (?,?,?,?)",
                   (jeton, joueur_id, time.time(), time.time()))
    return {"jeton": jeton, "pseudo": pseudo}


@app.post("/api/inscription")
def inscription(ids: Identifiants):
    if os.environ.get("TLOC_ENV") == "dev":
        raise HTTPException(403, "tloc-dev est réservé au créateur : les inscriptions se font sur tloc.kernse.fr.")
    pseudo = ids.pseudo.strip()
    if not RE_PSEUDO.match(pseudo):
        raise HTTPException(400, "Pseudo : 3 à 16 caractères, lettres, chiffres, - et _ seulement.")
    if len(ids.mdp) < 6:
        raise HTTPException(400, "Mot de passe : 6 caractères au minimum.")
    if pseudo.lower() == CREATEUR.lower():
        raise HTTPException(409, "Ce pseudo est réservé au créateur du jeu.")
    with db() as cx:
        if cx.execute("SELECT 1 FROM joueurs WHERE pseudo = ?", (pseudo,)).fetchone():
            raise HTTPException(409, "Ce pseudo est déjà pris.")
        cur = cx.execute("INSERT INTO joueurs (pseudo, mdp, cree) VALUES (?,?,?)",
                         (pseudo, hacher(ids.mdp), time.time()))
        jid = cur.lastrowid
    return ouvrir_session(jid, pseudo)


@app.post("/api/connexion")
def connexion(ids: Identifiants):
    with db() as cx:
        r = cx.execute("SELECT id, pseudo, mdp FROM joueurs WHERE pseudo = ?", (ids.pseudo.strip(),)).fetchone()
    if not r or not verifier(ids.mdp, r["mdp"]):
        raise HTTPException(401, "Pseudo ou mot de passe incorrect.")
    if os.environ.get("TLOC_ENV") == "dev" and r["pseudo"].lower() != CREATEUR.lower():
        raise HTTPException(403, "tloc-dev est réservé au créateur. Le jeu est sur tloc.kernse.fr.")
    return ouvrir_session(r["id"], r["pseudo"])


@app.post("/api/deconnexion")
def deconnexion(authorization: str = Header(default="")):
    if authorization.lower().startswith("bearer "):
        with db() as cx:
            cx.execute("DELETE FROM jetons WHERE jeton = ?", (authorization[7:],))
    return {"ok": True}


@app.get("/api/moi")
def moi(j: sqlite3.Row = Depends(porteur)):
    return {"pseudo": j["pseudo"], "id": j["id"]}


@app.get("/api/badges")
def mes_badges(j: sqlite3.Row = Depends(porteur)):
    """Tous les badges, gagnés ou non : l'accueil montre aussi ceux qui restent à décrocher."""
    with db() as cx:
        v = hauts_faits(cx, j["id"])
        n = {r["badge"]: r["n"] for r in cx.execute("SELECT badge, n FROM badges WHERE joueur = ?", (j["id"],))}
    return [{"id": b, "nom": nom, "desc": desc, "famille": fam, "nom_famille": FAMILLES[fam], "rang": rang,
             "n": n.get(b, 0), **({"val": round(v.get(but[0], 0)), "but": but[1]} if but else {})}
            for b, (nom, desc, fam, rang, but) in BADGES.items()]


# =====================================================================
#  Le profil, les amis, les conversations
# =====================================================================
# Le social de l'accueil. Pas de temps réel : l'accueil interroge toutes les quelques
# secondes quand la bulle est ouverte — à l'échelle d'une bande d'amis, c'est largement
# assez, et ça ne demande rien de plus au serveur qu'une requête de lecture.
EN_LIGNE = 120                  # secondes : vu depuis moins que ça, on est « en ligne »
# Le créateur du jeu : un compte à part, « Createur », qui reçoit les retours des testeurs.
# N'importe quel joueur peut lui écrire sans être son ami, et lui voit tous ces retours réunis.
# Personne ne peut s'inscrire sous ce pseudo : le compte naît au démarrage du serveur, avec
# le mot de passe donné dans TLOC_CREATEUR_MDP (voir assurer_createur, plus bas).
CREATEUR = os.environ.get("TLOC_CREATEUR", "Createur")


def id_createur(cx: sqlite3.Connection) -> int | None:
    r = cx.execute("SELECT id FROM joueurs WHERE pseudo = ?", (CREATEUR,)).fetchone()
    return r["id"] if r else None


assurer_createur()           # ici, une fois CREATEUR connu
PHOTO_MAX = 200_000             # octets de data URL — une photo recadrée en 160 px pèse ~15 Ko
RE_PHOTO = re.compile(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")


def carte_joueur(r: sqlite3.Row, cx: sqlite3.Connection) -> dict:
    vu = cx.execute("SELECT MAX(vu) AS v FROM jetons WHERE joueur = ?", (r["id"],)).fetchone()["v"] or 0
    return {"id": r["id"], "pseudo": r["pseudo"], "photo": r["photo"], "en_ligne": time.time() - vu < EN_LIGNE}


def paire(x: int, y: int) -> tuple[int, int]:
    return (x, y) if x < y else (y, x)


def relation(cx: sqlite3.Connection, moi_: int, autre: int) -> str:
    r = cx.execute("SELECT de, etat FROM amis WHERE a = ? AND b = ?", paire(moi_, autre)).fetchone()
    if not r:
        return "aucune"
    if r["etat"] == "ami":
        return "ami"
    return "envoyee" if r["de"] == moi_ else "recue"


def sont_amis(cx: sqlite3.Connection, x: int, y: int) -> bool:
    return relation(cx, x, y) == "ami"


class Profil(BaseModel):
    photo: str | None = Field(default=None, max_length=PHOTO_MAX)
    devise: str | None = Field(default=None, max_length=80)


@app.get("/api/profil")
def lire_profil(j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        r = cx.execute("SELECT id, pseudo, photo, devise, cree FROM joueurs WHERE id = ?", (j["id"],)).fetchone()
        badges = cx.execute("SELECT COALESCE(SUM(n), 0) AS n FROM badges WHERE joueur = ?", (j["id"],)).fetchone()["n"]
        n_amis = cx.execute("SELECT COUNT(*) AS n FROM amis WHERE (a = ? OR b = ?) AND etat = 'ami'", (j["id"], j["id"])).fetchone()["n"]
        parties = cx.execute("SELECT COUNT(*) AS n FROM parties WHERE joueur = ?", (j["id"],)).fetchone()["n"]
        createur = id_createur(cx) == j["id"]
        retours = cx.execute("""SELECT COUNT(*) AS n FROM convs c JOIN conv_membres m ON m.conv = c.id
                                WHERE c.retour = 1 AND m.joueur = ?""", (j["id"],)).fetchone()["n"] if createur else 0
    return {"id": r["id"], "pseudo": r["pseudo"], "photo": r["photo"], "devise": r["devise"], "cree": r["cree"],
            "badges": badges, "amis": n_amis, "parties": parties, "createur": createur, "retours": retours}


@app.get("/api/createur")
def le_createur(j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        r = cx.execute("SELECT id, pseudo, photo FROM joueurs WHERE pseudo = ?", (CREATEUR,)).fetchone()
        if not r:
            raise HTTPException(404, "Le créateur n'a pas encore de compte ici.")
        return carte_joueur(r, cx)


@app.put("/api/profil")
def ecrire_profil(p: Profil, j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        if p.photo is not None:
            if p.photo and not RE_PHOTO.match(p.photo):
                raise HTTPException(400, "Cette image n'est pas lisible : JPEG, PNG ou WebP seulement.")
            cx.execute("UPDATE joueurs SET photo = ? WHERE id = ?", (p.photo or None, j["id"]))
        if p.devise is not None:
            cx.execute("UPDATE joueurs SET devise = ? WHERE id = ?", (re.sub(r"\s+", " ", p.devise).strip(), j["id"]))
    return lire_profil(j)


@app.get("/api/joueurs")
def chercher_joueurs(q: str = "", j: sqlite3.Row = Depends(porteur)):
    q = q.strip()
    if len(q) < 2:
        return []
    motif = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    with db() as cx:
        rs = cx.execute("""SELECT id, pseudo, photo FROM joueurs WHERE pseudo LIKE ? ESCAPE '\\' AND id != ?
                           ORDER BY LENGTH(pseudo), pseudo LIMIT 10""", (motif, j["id"])).fetchall()
        return [{**carte_joueur(r, cx), "relation": relation(cx, j["id"], r["id"])} for r in rs]


@app.get("/api/amis")
def mes_amis(j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        rs = cx.execute("""SELECT x.de, x.etat, p.id, p.pseudo, p.photo FROM amis x
                           JOIN joueurs p ON p.id = CASE WHEN x.a = ? THEN x.b ELSE x.a END
                           WHERE x.a = ? OR x.b = ? ORDER BY p.pseudo""", (j["id"], j["id"], j["id"])).fetchall()
        out = {"amis": [], "recues": [], "envoyees": []}
        for r in rs:
            c = carte_joueur(r, cx)
            if r["etat"] == "ami":
                out["amis"].append(c)
            elif r["de"] == j["id"]:
                out["envoyees"].append(c)
            else:
                out["recues"].append(c)
        out["amis"].sort(key=lambda c: (not c["en_ligne"], c["pseudo"].lower()))
    return out


@app.post("/api/amis/{autre}")
def demander_ami(autre: int, j: sqlite3.Row = Depends(porteur)):
    """Demande — ou accepte, si l'autre avait déjà demandé : le même bouton fait les deux."""
    if autre == j["id"]:
        raise HTTPException(400, "On est déjà son propre ami.")
    with db() as cx:
        if not cx.execute("SELECT 1 FROM joueurs WHERE id = ?", (autre,)).fetchone():
            raise HTTPException(404, "Ce joueur n'existe pas.")
        rel = relation(cx, j["id"], autre)
        a, b = paire(j["id"], autre)
        if rel == "aucune":
            cx.execute("INSERT INTO amis (a, b, de, etat, cree) VALUES (?,?,?,?,?)", (a, b, j["id"], "demande", time.time()))
        elif rel == "recue":
            cx.execute("UPDATE amis SET etat = 'ami' WHERE a = ? AND b = ?", (a, b))
        return {"relation": relation(cx, j["id"], autre)}


@app.delete("/api/amis/{autre}")
def retirer_ami(autre: int, j: sqlite3.Row = Depends(porteur)):
    """Refuse une demande, l'annule, ou retire un ami."""
    with db() as cx:
        cx.execute("DELETE FROM amis WHERE a = ? AND b = ?", paire(j["id"], autre))
    return {"relation": "aucune"}


class NouvelleConv(BaseModel):
    membres: list[int] = Field(min_length=1, max_length=11)
    nom: str | None = Field(default=None, max_length=40)


class NouveauMessage(BaseModel):
    texte: str = Field(default="", max_length=1000)
    invitation: str | None = Field(default=None, max_length=6)    # le code d'une instance


def membre(cx: sqlite3.Connection, conv: int, jid: int) -> bool:
    return bool(cx.execute("SELECT 1 FROM conv_membres WHERE conv = ? AND joueur = ?", (conv, jid)).fetchone())


def vue_conv(cx: sqlite3.Connection, c: sqlite3.Row, jid: int) -> dict:
    ms = cx.execute("""SELECT p.id, p.pseudo, p.photo FROM conv_membres m JOIN joueurs p ON p.id = m.joueur
                       WHERE m.conv = ? ORDER BY p.pseudo""", (c["id"],)).fetchall()
    autres = [carte_joueur(r, cx) for r in ms if r["id"] != jid]
    der = cx.execute("""SELECT m.texte, m.invitation, m.t, p.pseudo FROM messages m JOIN joueurs p ON p.id = m.auteur
                        WHERE m.conv = ? ORDER BY m.id DESC LIMIT 1""", (c["id"],)).fetchone()
    lu = cx.execute("SELECT lu FROM conv_membres WHERE conv = ? AND joueur = ?", (c["id"], jid)).fetchone()["lu"]
    non_lus = cx.execute("SELECT COUNT(*) AS n FROM messages WHERE conv = ? AND id > ? AND auteur != ?",
                         (c["id"], lu, jid)).fetchone()["n"]
    nom = c["nom"] or (", ".join(a["pseudo"] for a in autres) if autres else "Conversation")
    return {"id": c["id"], "nom": nom, "groupe": bool(c["groupe"]), "retour": bool(c["retour"]), "membres": autres,
            "maj": c["maj"], "non_lus": non_lus,
            "dernier": {"texte": der["texte"] if not der["invitation"] else "⚔ Invitation à une partie",
                        "pseudo": der["pseudo"], "t": der["t"]} if der else None}


@app.get("/api/convs")
def mes_convs(j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        cs = cx.execute("""SELECT c.* FROM convs c JOIN conv_membres m ON m.conv = c.id
                           WHERE m.joueur = ? ORDER BY c.maj DESC""", (j["id"],)).fetchall()
        return [vue_conv(cx, c, j["id"]) for c in cs]


@app.post("/api/convs")
def creer_conv(n: NouvelleConv, j: sqlite3.Row = Depends(porteur)):
    membres = sorted({m for m in n.membres if m != j["id"]})
    if not membres:
        raise HTTPException(400, "Choisis au moins un ami.")
    with db() as cx:
        crea = id_createur(cx)
        # écrire au créateur (ou, pour lui, répondre à un testeur) ne demande pas d'être amis
        retour = len(membres) == 1 and not n.nom and crea is not None and crea in (j["id"], membres[0])
        for m in membres:
            if not retour and not sont_amis(cx, j["id"], m):
                raise HTTPException(403, "On n'écrit qu'à ses amis : envoie d'abord une demande.")
        groupe = len(membres) > 1 or bool(n.nom)
        if not groupe:                     # à deux : on retrouve la conversation existante
            r = cx.execute("""SELECT c.* FROM convs c
                              JOIN conv_membres a ON a.conv = c.id AND a.joueur = ?
                              JOIN conv_membres b ON b.conv = c.id AND b.joueur = ?
                              WHERE c.groupe = 0""", (j["id"], membres[0])).fetchone()
            if r:
                if retour and crea != j["id"] and not r["retour"]:     # un ami qui écrit « au créateur » : c'est un retour aussi
                    cx.execute("UPDATE convs SET retour = 1 WHERE id = ?", (r["id"],))
                    r = cx.execute("SELECT * FROM convs WHERE id = ?", (r["id"],)).fetchone()
                return vue_conv(cx, r, j["id"])
        t = time.time()
        cid = cx.execute("INSERT INTO convs (nom, groupe, retour, cree, maj) VALUES (?,?,?,?,?)",
                         ((n.nom or "").strip() or None, int(groupe), int(retour), t, t)).lastrowid
        for m in [j["id"], *membres]:
            cx.execute("INSERT INTO conv_membres (conv, joueur) VALUES (?,?)", (cid, m))
        return vue_conv(cx, cx.execute("SELECT * FROM convs WHERE id = ?", (cid,)).fetchone(), j["id"])


@app.get("/api/convs/{cid}/messages")
def lire_messages(cid: int, apres: int = 0, j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        if not membre(cx, cid, j["id"]):
            raise HTTPException(404, "Conversation introuvable.")
        rs = cx.execute("""SELECT m.id, m.texte, m.invitation, m.t, p.id AS auteur, p.pseudo, p.photo FROM messages m
                           JOIN joueurs p ON p.id = m.auteur WHERE m.conv = ? AND m.id > ?
                           ORDER BY m.id DESC LIMIT 200""", (cid, apres)).fetchall()
        out = [{"id": r["id"], "texte": r["texte"], "t": r["t"], "auteur": r["auteur"], "pseudo": r["pseudo"],
                "photo": r["photo"], "invitation": json.loads(r["invitation"]) if r["invitation"] else None}
               for r in reversed(rs)]
        if out:        # ce qu'on vient de lire est lu
            cx.execute("UPDATE conv_membres SET lu = MAX(lu, ?) WHERE conv = ? AND joueur = ?", (out[-1]["id"], cid, j["id"]))
    return out


@app.post("/api/convs/{cid}/messages")
def ecrire_message(cid: int, n: NouveauMessage, j: sqlite3.Row = Depends(porteur)):
    texte = n.texte.strip()
    with db() as cx:
        if not membre(cx, cid, j["id"]):
            raise HTTPException(404, "Conversation introuvable.")
        invitation = None
        if n.invitation:
            # une partie envoyée dans le chat : on joint ce qu'il faut pour la reconnaître d'un
            # coup d'œil, et le serveur vérifie qu'elle existe
            r = cx.execute("SELECT code, nom, mode, regle, bots, niveau, vies, duree FROM instances WHERE code = ?",
                           (n.invitation.upper(),)).fetchone()
            if not r:
                raise HTTPException(404, "Cette partie n'existe plus.")
            invitation = {k: r[k] for k in r.keys()}
        if not texte and not invitation:
            raise HTTPException(400, "Message vide.")
        t = time.time()
        mid = cx.execute("INSERT INTO messages (conv, auteur, texte, invitation, t) VALUES (?,?,?,?,?)",
                         (cid, j["id"], texte, json.dumps(invitation) if invitation else None, t)).lastrowid
        cx.execute("UPDATE convs SET maj = ? WHERE id = ?", (t, cid))
        cx.execute("UPDATE conv_membres SET lu = ? WHERE conv = ? AND joueur = ?", (mid, cid, j["id"]))
    return {"id": mid}


# =====================================================================
#  Prod et dev : la version en ligne, et le bouton « Promouvoir »
# =====================================================================
# Sur le VPS tournent deux serveurs : la prod (tloc.kernse.fr, où l'on joue) et le dev
# (tloc-dev.kernse.fr, où arrivent les modifications du Mac). Le dev sait lire la version
# de la prod et, pour le seul compte Createur, lancer la promotion (serveur/deploiement/
# promouvoir.sh, via sudo). En local, rien de tout ça : TLOC_ENV vaut « local ».
TLOC_ENV = os.environ.get("TLOC_ENV", "local")
SITE = os.environ.get("TLOC_SITE") or RACINE
PROD_SITE = os.environ.get("TLOC_PROD_SITE")
PROMOUVOIR = os.environ.get("TLOC_PROMOUVOIR")
MAJ_DEV = os.environ.get("TLOC_MAJ_DEV")          # git pull de GitHub vers le dev
promotion_en_cours = asyncio.Lock()


def lire_version(racine: str | None) -> dict | None:
    try:
        return json.loads((Path(racine) / "VERSION.json").read_text())
    except Exception:
        return None


def est_createur(authorization: str) -> bool:
    jeton = authorization[7:] if authorization.lower().startswith("bearer ") else None
    j = joueur_du_jeton(jeton)
    if not j:
        return False
    with db() as cx:
        return id_createur(cx) == j["id"]


@app.get("/api/env")
def environnement(authorization: str = Header(default="")):
    v = {"env": TLOC_ENV, "version": lire_version(SITE)}
    if TLOC_ENV == "dev":
        v["prod"] = lire_version(PROD_SITE)
        v["peut_promouvoir"] = bool(PROMOUVOIR) and est_createur(authorization)
    return v


class Promotion(BaseModel):
    action: str = Field(default="promouvoir", pattern="^(promouvoir|revenir|maj)$")


@app.post("/api/promotion")
async def promouvoir(p: Promotion, authorization: str = Header(default="")):
    script = MAJ_DEV if p.action == "maj" else PROMOUVOIR
    if TLOC_ENV != "dev" or not script:
        raise HTTPException(404, "La promotion ne se lance que depuis tloc-dev.")
    if not est_createur(authorization):
        raise HTTPException(403, "Seul le compte Createur peut promouvoir.")
    if promotion_en_cours.locked():
        raise HTTPException(409, "Une promotion est déjà en cours.")
    async with promotion_en_cours:
        args = ["sudo", "-n", script] + (["revenir"] if p.action == "revenir" else [])
        proc = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
        try:
            sortie, _ = await asyncio.wait_for(proc.communicate(), timeout=600)
        except asyncio.TimeoutError:
            proc.kill()
            raise HTTPException(504, "La promotion a pris plus de dix minutes : regarde le serveur.")
    lignes = sortie.decode(errors="replace").strip().splitlines()[-30:]
    return {"ok": proc.returncode == 0, "sortie": lignes, "prod": lire_version(PROD_SITE), "version": lire_version(SITE)}


@app.get("/api/admin")
def vue_admin(j: sqlite3.Row = Depends(porteur)):
    """Les chiffres du jeu, pour le créateur : les autres joueurs seulement (lui-même exclu)."""
    with db() as cx:
        crea = id_createur(cx)
        if crea != j["id"]:
            raise HTTPException(403, "Réservé au créateur.")
        t = time.time()
        un = lambda q, *a: cx.execute(q, a).fetchone()[0] or 0
        joueurs = un("SELECT COUNT(*) FROM joueurs WHERE id != ?", crea)
        nouveaux = un("SELECT COUNT(*) FROM joueurs WHERE id != ? AND cree > ?", crea, t - 7 * 86400)
        actifs_7 = un("SELECT COUNT(DISTINCT joueur) FROM jetons WHERE joueur != ? AND vu > ?", crea, t - 7 * 86400)
        actifs_1 = un("SELECT COUNT(DISTINCT joueur) FROM jetons WHERE joueur != ? AND vu > ?", crea, t - 86400)
        parties = un("SELECT COUNT(*) FROM parties WHERE joueur != ?", crea)
        minutes = un("SELECT SUM(COALESCE(json_extract(resume, '$.minutes'), 0)) FROM parties WHERE joueur != ?", crea)
        instances = un("SELECT COUNT(*) FROM instances WHERE hote != ?", crea)
        manches = un("SELECT COUNT(*) FROM manches")
        manches_7 = un("SELECT COUNT(*) FROM manches WHERE t > ?", t - 7 * 86400)
        retours = un("SELECT COUNT(*) FROM convs WHERE retour = 1")
        messages_retour = un("""SELECT COUNT(*) FROM messages m JOIN convs c ON c.id = m.conv
                                WHERE c.retour = 1 AND m.auteur != ?""", crea)
        derniers = [{"pseudo": r["pseudo"], "cree": r["cree"]} for r in
                    cx.execute("SELECT pseudo, cree FROM joueurs WHERE id != ? ORDER BY cree DESC LIMIT 5", (crea,))]
    return {
        "joueurs": {"total": joueurs, "nouveaux_7j": nouveaux, "actifs_7j": actifs_7, "actifs_24h": actifs_1},
        "solo": {"parties": parties, "minutes": minutes},
        "multi": {"instances": instances, "manches": manches, "manches_7j": manches_7,
                  "en_ligne": sum(len(s.humains()) for s in SALONS.values())},
        "retours": {"conversations": retours, "messages": messages_retour},
        "derniers": derniers,
    }


DEMARRE = time.time()


@app.get("/api/admin/detail")
def vue_admin_detail(j: sqlite3.Row = Depends(porteur)):
    """La page /admin du créateur (admin.html) : tout, joueur par joueur. Réservée au créateur,
    lui compris cette fois — il y cherche aussi ses propres chiffres."""
    with db() as cx:
        crea = id_createur(cx)
        if crea != j["id"]:
            raise HTTPException(403, "Réservé au créateur.")
        t = time.time()
        badges_de = {}
        for r in cx.execute("SELECT joueur, badge, n FROM badges"):
            badges_de.setdefault(r["joueur"], {})[r["badge"]] = r["n"]
        joueurs = []
        for r in cx.execute("""SELECT j.id, j.pseudo, j.cree,
                                      (SELECT MAX(vu) FROM jetons WHERE joueur = j.id) AS vu,
                                      (SELECT COUNT(*) FROM parties WHERE joueur = j.id) AS parties,
                                      (SELECT SUM(COALESCE(json_extract(resume, '$.minutes'), 0)) FROM parties WHERE joueur = j.id) AS minutes,
                                      (SELECT COUNT(*) FROM instances WHERE hote = j.id) AS instances
                               FROM joueurs j ORDER BY vu DESC"""):
            v = valeurs_compte(cx, r["id"])
            b = badges_de.get(r["id"], {})
            joueurs.append({
                "id": r["id"], "pseudo": r["pseudo"], "cree": r["cree"], "vu": r["vu"], "createur": r["id"] == crea,
                "parties": r["parties"], "minutes": r["minutes"] or 0, "instances": r["instances"],
                "km": round(v.get("metres", 0) / 1000, 2), "manches": int(v.get("manches", 0)), "victoires": int(v.get("victoires", 0)),
                "quetes": [k for k in ("arc", "chat", "corbeaux", "fantomes", "carte", "boss", "eugene") if v.get(k)],
                "badges": sum(b.values()), "distincts": len(b),
                "meilleur": max(b, key=lambda x: (RANGS.index(BADGES[x][3]), b[x]), default=None) if b else None,
                "en_ligne": any(jid == r["id"] for s_ in SALONS.values() for jid in s_.joueurs),
            })
        pseudo = {r["id"]: r["pseudo"] for r in cx.execute("SELECT id, pseudo FROM joueurs")}
        instances = [{"code": r["code"], "nom": r["nom"], "hote": pseudo.get(r["hote"], "?"), "mode": r["mode"],
                      "regle": r["regle"], "bots": r["bots"], "niveau": r["niveau"], "vies": r["vies"], "duree": r["duree"],
                      "cree": r["cree"], "vu": r["vu"],
                      "membres": [pseudo.get(m["joueur"], "?") for m in cx.execute("SELECT joueur FROM membres WHERE code = ?", (r["code"],))]}
                     for r in cx.execute("SELECT * FROM instances ORDER BY vu DESC LIMIT 60")]
        manches = [dict(r) for r in cx.execute("SELECT code, regle, joueurs, humains, t FROM manches ORDER BY t DESC LIMIT 60")]
        par_regle = {r["regle"]: r["n"] for r in cx.execute("SELECT regle, COUNT(*) AS n FROM manches GROUP BY regle")}
        repartition = {r["badge"]: {"porteurs": r["p"], "total": r["n"]} for r in
                       cx.execute("SELECT badge, COUNT(*) AS p, SUM(n) AS n FROM badges WHERE n > 0 GROUP BY badge")}
        retours = [{"pseudo": r["pseudo"], "messages": r["n"], "dernier": r["t"], "extrait": (r["texte"] or "")[:140]} for r in cx.execute(
            """SELECT jo.pseudo, COUNT(m.id) AS n, MAX(m.t) AS t,
                      (SELECT texte FROM messages WHERE conv = c.id AND auteur != ? ORDER BY id DESC LIMIT 1) AS texte
               FROM convs c JOIN conv_membres cm ON cm.conv = c.id AND cm.joueur != ?
               JOIN joueurs jo ON jo.id = cm.joueur
               LEFT JOIN messages m ON m.conv = c.id AND m.auteur = cm.joueur
               WHERE c.retour = 1 GROUP BY c.id ORDER BY t DESC""", (crea, crea))]
    salons = [{"code": c, "regle": s_.regle, "equipes": s_.equipes,
               "humains": [h.pseudo for h in s_.humains()], "bots": len(s_.bots()),
               "manche": s_.manche["etat"] if s_.manche else None, "points": s_.points}
              for c, s_ in SALONS.items() if s_.joueurs]
    try:
        poids = os.path.getsize(BASE)
    except OSError:
        poids = 0
    return {
        "maintenant": t, "demarre": DEMARRE, "version": lire_version(SITE), "base_octets": poids,
        "joueurs": joueurs, "salons": salons, "instances": instances, "manches": manches, "par_regle": par_regle,
        "badges": [{"id": b, "nom": v[0], "famille": FAMILLES[v[2]], "rang": v[3], **repartition.get(b, {"porteurs": 0, "total": 0})}
                   for b, v in BADGES.items()],
        "retours": retours,
    }


@app.get("/api/non-lus")
def non_lus(j: sqlite3.Row = Depends(porteur)):
    """Le petit chiffre de la bulle, et les demandes d'ami en attente."""
    with db() as cx:
        n = cx.execute("""SELECT COUNT(*) AS n FROM messages m JOIN conv_membres c ON c.conv = m.conv AND c.joueur = ?
                          WHERE m.id > c.lu AND m.auteur != ?""", (j["id"], j["id"])).fetchone()["n"]
        d = cx.execute("SELECT COUNT(*) AS n FROM amis WHERE (a = ? OR b = ?) AND etat = 'demande' AND de != ?",
                       (j["id"], j["id"], j["id"])).fetchone()["n"]
    return {"messages": n, "demandes": d}


# =====================================================================
#  Parties solo rattachées au compte
# =====================================================================
class Partie(BaseModel):
    nom: str = Field(max_length=40)
    donnees: dict[str, Any]
    resume: dict[str, Any] = {}


@app.get("/api/parties")
def lister_parties(j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        rs = cx.execute("SELECT id, nom, resume, maj FROM parties WHERE joueur = ? ORDER BY maj DESC",
                        (j["id"],)).fetchall()
    return [{"id": r["id"], "nom": r["nom"], "resume": json.loads(r["resume"] or "{}"), "maj": r["maj"]} for r in rs]


@app.get("/api/parties/{pid}")
def lire_partie(pid: str, j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        r = cx.execute("SELECT id, nom, donnees, resume, maj FROM parties WHERE id = ? AND joueur = ?",
                       (pid, j["id"])).fetchone()
    if not r:
        raise HTTPException(404, "partie introuvable")
    return {"id": r["id"], "nom": r["nom"], "donnees": json.loads(r["donnees"]),
            "resume": json.loads(r["resume"] or "{}"), "maj": r["maj"]}


@app.put("/api/parties/{pid}")
def ecrire_partie(pid: str, p: Partie, j: sqlite3.Row = Depends(porteur)):
    if not re.match(r"^[A-Za-z0-9_\-]{1,40}$", pid):
        raise HTTPException(400, "identifiant de partie invalide")
    with db() as cx:
        cx.execute("""INSERT INTO parties (id, joueur, nom, donnees, resume, maj) VALUES (?,?,?,?,?,?)
                      ON CONFLICT(id) DO UPDATE SET nom=excluded.nom, donnees=excluded.donnees,
                          resume=excluded.resume, maj=excluded.maj
                      WHERE parties.joueur = excluded.joueur""",
                   (pid, j["id"], p.nom, json.dumps(p.donnees), json.dumps(p.resume), time.time()))
        hauts_faits(cx, j["id"])          # une quête finie, des kilomètres de plus : le badge tombe ici
    return {"ok": True}


@app.delete("/api/parties/{pid}")
def supprimer_partie(pid: str, j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        cx.execute("DELETE FROM parties WHERE id = ? AND joueur = ?", (pid, j["id"]))
    return {"ok": True}


# =====================================================================
#  Instances multijoueur
# =====================================================================
def nouveau_code() -> str:
    with db() as cx:
        for _ in range(50):
            c = "".join(secrets.choice(ALPHABET) for _ in range(6))
            if not cx.execute("SELECT 1 FROM instances WHERE code = ?", (c,)).fetchone():
                return c
    raise HTTPException(503, "impossible de tirer un code libre")


def purger_instances():
    limite = time.time() - INSTANCE_TTL
    with db() as cx:
        vivantes = tuple(SALONS.keys())
        q = "DELETE FROM instances WHERE vu < ?"
        args: list[Any] = [limite]
        if vivantes:
            q += f" AND code NOT IN ({','.join('?' * len(vivantes))})"
            args += list(vivantes)
        cx.execute(q, args)


class NouvelleInstance(BaseModel):
    nom: str = Field(default="Partie entre amis", max_length=40)
    mode: str = Field(default="libre", pattern="^(libre|equipes)$")
    enjeu: bool = False
    bots: int = Field(default=0, ge=0, le=TOTAL_MAX - 1)
    niveau: str = Field(default="soldat", pattern="^(recrue|soldat|veteran)$")
    regle: str = Field(default="balade", pattern="^(balade|survie|temps|drapeaux)$")
    vies: int = Field(default=1, ge=1, le=5)
    duree: int = Field(default=180, ge=60, le=900)
    # les arènes prêtes (déclarées par leur lieu, cf. `arenes` dans game.js) : une seule pour
    # l'instant ; en ajouter une, c'est l'ajouter ici et dans ARENES (accueil.js)
    arene: str = Field(default="lille", pattern="^(lille)$")


def vue_instance(r: sqlite3.Row, pseudo_hote: str) -> dict:
    salon = SALONS.get(r["code"])
    return {
        "code": r["code"], "nom": r["nom"], "hote": pseudo_hote,
        "cree": r["cree"], "vu": r["vu"],
        "connectes": [p.perso for p in salon.humains()] if salon else [],
        "places": places_humains(r["mode"], r["bots"]), "mode": r["mode"], "enjeu": bool(r["enjeu"]),
        "bots": r["bots"], "niveau": r["niveau"], "regle": r["regle"], "vies": r["vies"], "duree": r["duree"],
        "arene": r["arene"],
    }


@app.post("/api/instances")
def creer_instance(n: NouvelleInstance, j: sqlite3.Row = Depends(porteur)):
    purger_instances()
    if n.regle == "drapeaux":                 # deux camps, sinon il n'y a rien à prendre à personne
        n.mode = "equipes"
    code = nouveau_code()
    t = time.time()
    with db() as cx:
        cx.execute("INSERT INTO instances (code, nom, hote, cree, vu, mode, enjeu, bots, niveau, regle, vies, duree, arene) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (code, n.nom.strip() or "Partie entre amis", j["id"], t, t, n.mode, int(n.enjeu), n.bots, n.niveau, n.regle, n.vies, n.duree, n.arene))
        cx.execute("INSERT OR IGNORE INTO membres (code, joueur, rejoint) VALUES (?,?,?)", (code, j["id"], t))
        r = cx.execute("SELECT * FROM instances WHERE code = ?", (code,)).fetchone()
    return vue_instance(r, j["pseudo"])


@app.get("/api/instances")
def mes_instances(j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        rs = cx.execute("""SELECT i.*, h.pseudo AS ph FROM instances i
                           JOIN joueurs h ON h.id = i.hote
                           JOIN membres m ON m.code = i.code
                           WHERE m.joueur = ? ORDER BY i.vu DESC""", (j["id"],)).fetchall()
    return [vue_instance(r, r["ph"]) for r in rs]


@app.get("/api/instances/{code}")
def voir_instance(code: str, j: sqlite3.Row = Depends(porteur)):
    with db() as cx:
        r = cx.execute("""SELECT i.*, h.pseudo AS ph FROM instances i JOIN joueurs h ON h.id = i.hote
                          WHERE i.code = ?""", (code.upper(),)).fetchone()
    if not r:
        raise HTTPException(404, "Aucune instance avec ce code.")
    return vue_instance(r, r["ph"])


@app.post("/api/instances/{code}/rejoindre")
def rejoindre_instance(code: str, j: sqlite3.Row = Depends(porteur)):
    code = code.upper()
    with db() as cx:
        r = cx.execute("""SELECT i.*, h.pseudo AS ph FROM instances i JOIN joueurs h ON h.id = i.hote
                          WHERE i.code = ?""", (code,)).fetchone()
        if not r:
            raise HTTPException(404, "Aucune instance avec ce code.")
        cx.execute("INSERT OR IGNORE INTO membres (code, joueur, rejoint) VALUES (?,?,?)",
                   (code, j["id"], time.time()))
    return vue_instance(r, r["ph"])


@app.delete("/api/instances/{code}")
def quitter_instance(code: str, j: sqlite3.Row = Depends(porteur)):
    code = code.upper()
    with db() as cx:
        r = cx.execute("SELECT hote FROM instances WHERE code = ?", (code,)).fetchone()
        if r and r["hote"] == j["id"]:
            cx.execute("DELETE FROM instances WHERE code = ?", (code,))     # l'hôte ferme le salon
        else:
            cx.execute("DELETE FROM membres WHERE code = ? AND joueur = ?", (code, j["id"]))
    return {"ok": True}


@app.get("/api/sante")
def sante():
    return {"ok": True, "salons": len(SALONS), "joueurs": sum(len(s.humains()) for s in SALONS.values()),
            "bots": sum(len(s.bots()) for s in SALONS.values())}


@app.exception_handler(HTTPException)
async def erreur_lisible(_, exc: HTTPException):
    return JSONResponse({"erreur": exc.detail}, status_code=exc.status_code)


# =====================================================================
#  Relais WebSocket : le salon d'une instance
# =====================================================================
# Le serveur ne simule rien. Il tient, par salon, la dernière position annoncée par
# chaque joueur — juste assez pour refuser un coup porté à trente mètres — et recopie
# les messages aux autres. À quatre joueurs et quinze envois par seconde, c'est de
# l'ordre de 60 petits messages JSON par seconde et par salon : inutile d'optimiser.

class Connecte:
    """Un joueur connecté. Deux noms, et ils ne servent pas à la même chose :
    `pseudo` est le compte (qui c'est), `perso` est le personnage de la partie ouverte
    (ce que les autres lisent au-dessus de sa tête)."""
    __slots__ = ("ws", "id", "pseudo", "perso", "etat", "dernier_coup", "frags", "morts", "look", "camp",
                 "pilote", "niveau", "touche_par", "metres")

    def __init__(self, ws: WebSocket | None, jid: int, pseudo: str, perso: str = ""):
        self.ws = ws
        self.id = jid
        self.pseudo = pseudo
        self.perso = perso or pseudo
        self.etat: dict[str, Any] = {}
        self.dernier_coup = 0.0
        self.frags = 0
        self.morts = 0
        self.look: dict[str, int] = {}
        self.camp: str | None = None
        self.pilote: int | None = None           # un bot : l'humain dont le navigateur le fait vivre
        self.niveau: str | None = None
        self.touche_par: tuple | None = None     # (qui, arme, à cheval, quand) : le dernier coup reçu
        self.metres = 0.0                        # chemin parcouru pas encore versé au compte

    @property
    def est_bot(self) -> bool:
        return self.ws is None

    def vue(self) -> dict:
        v = {"id": self.id, "pseudo": self.pseudo, "perso": self.perso, "etat": self.etat,
             "frags": self.frags, "morts": self.morts, "look": self.look, "camp": self.camp}
        if self.est_bot:
            v["bot"] = self.niveau
        return v


# L'apparence choisie à l'armoire : des indices de palette, rien d'autre. Le serveur ne
# connaît pas les palettes (elles vivent dans look.js) ; il garde seulement des petits
# entiers sous des clés connues, et le client recale ce qui dépasse.
CLES_LOOK = ("peau", "cheveux", "coiffure", "tunique", "toile", "cuir", "foulard", "yeux",
             "carrure", "taille")


def look_propre(l: Any) -> dict[str, int]:
    if not isinstance(l, dict):
        return {}
    return {k: v for k in CLES_LOOK
            if isinstance(v := l.get(k), int) and not isinstance(v, bool) and 0 <= v < 32}


class Salon:
    def __init__(self, code: str):
        self.code = code
        self.joueurs: dict[int, Connecte] = {}
        self.verrou = asyncio.Lock()
        self.points = {c: 0 for c in CAMPS}     # mises à terre d'un camp sur l'autre
        self.fete: dict | None = None             # { fin, scores: {id: n}, compte: {id: (t, n)} }
        self.bourses: dict[str, dict] = {}        # id -> { p: [x, z], n, fin }
        self.objets: dict[str, dict] = {}         # id -> { type, p: [x, z], y, porteur, retour }
        # les bannières des camps : au ralliement (base), portées par un adversaire, ou
        # tombées là où leur porteur a été mis à terre
        self.bannieres = {c: {"etat": "base", "porteur": None, "p": None, "t": 0.0} for c in CAMPS}
        self.regle = "balade"                     # posés à l'entrée du premier joueur
        self.equipes = False
        # ce que chacun a apporté à son camp depuis la dernière victoire de balade
        self.apport: dict[int, dict] = {}           # id -> { "mises": n, "bannieres": n }
        self.vies = 1
        self.duree = 180
        # la manche en cours (survie, temps) : { etat: compte|cours|fin, fin, stats, elimines, ... }
        self.manche: dict | None = None
        self.ouverte = False                      # la minute d'ouverture a-t-elle déjà été lancée ?
        # la prise des drapeaux : les points forts proposés par le premier client (id -> lieu),
        # et, pendant une manche, l'état de ceux en jeu : à qui (camp), où en est la prise
        # (jauge 0 → 1, vers un camp), et le temps de tenue cumulé par camp
        self.lieux_drapeaux: dict[str, dict] = {}
        self.drapeaux: dict[str, dict] = {}
        self.tenue = {c: 0.0 for c in CAMPS}

    # ------------------------------------------------------------------
    #  Les manches : match à mort (survie) et chrono (temps)
    # ------------------------------------------------------------------
    # Le serveur est l'arbitre : il lance le compte à rebours dès qu'on est deux (bots
    # compris), tient les scores de la manche à partir des coups et des morts qu'il relaie,
    # proclame le vainqueur, décerne les badges, puis relance une manche.
    @staticmethod
    def nouvelles_stats() -> dict:
        return {"k": 0, "m": 0, "coups": 0, "degats": 0.0, "faibles": 0, "serie": 0, "serie_max": 0, "venge": 0, "cap": 0,
                "arc": 0, "cheval": 0, "drap": []}

    def vue_manche(self) -> dict:
        m = self.manche
        if not m:
            return {"etat": "attente", "regle": self.regle}
        v = {"etat": m["etat"], "regle": self.regle,
             "reste": max(0, round(m["fin"] - time.time())) if m.get("fin") else None,
             # le temps de jeu écoulé : le match à mort n'a pas de chrono, et c'est sur lui que
             # la partie se resserre (5 et 10 min) — le même pour tous, même arrivé en cours
             "depuis": round(time.time() - m["debut"], 1) if m["etat"] == "cours" and m.get("debut") else None,
             "elimines": sorted(m["elimines"]), "vies_max": self.vies, "duree": self.duree,
             "vies": {str(i): max(0, self.vies - s["m"]) for i, s in m["stats"].items()} if self.regle == "survie" else {},
             "scores": {str(i): [s["k"], s["m"]] for i, s in m["stats"].items()}}
        if self.regle == "drapeaux":
            v["drapeaux"] = self.vue_drapeaux()
            v["tenue"] = {c: round(t) for c, t in self.tenue.items()}
        if m["etat"] == "fin":
            v.update(m["resultat"])
            # « Rejouer » : qui est prêt, sur combien d'humains présents
            v["prets"] = sorted(m.get("prets", set()))
            v["humains"] = len(self.humains())
        return v

    async def annoncer_manche(self):
        await self.diffuser({"t": "manche", **self.vue_manche()})

    def stats(self, jid: int) -> dict | None:
        """Les compteurs de la manche d'un joueur ; un retardataire au chrono y entre, en
        survie il regarde (il n'a pas de vie dans cette manche)."""
        m = self.manche
        if not m or m["etat"] != "cours":
            return None
        if jid not in m["stats"]:
            if self.regle == "survie":
                return None
            m["stats"][jid] = self.nouvelles_stats()
        return m["stats"][jid]

    def en_lice(self, jid: int) -> bool:
        m = self.manche
        if not m or m["etat"] != "cours" or self.regle != "survie":
            return True
        return jid in m["stats"] and jid not in m["elimines"]

    def noter_nom(self, j: "Connecte"):
        if self.manche:
            self.manche.setdefault("noms", {})[j.id] = j.perso
            self.manche.setdefault("camps", {})[j.id] = j.camp

    async def rejouer(self, qui: "Connecte"):
        """Un humain presse « Rejouer » sur l'écran des résultats. Quand tous les humains
        présents l'ont fait, la manche suivante part sans attendre la fin de la pause."""
        m = self.manche
        if qui.est_bot or not m or m["etat"] != "fin":
            return
        m.setdefault("prets", set()).add(qui.id)
        if {h.id for h in self.humains()} <= m["prets"]:
            self.manche = None                    # la tâche de fin de pause verra un autre jeton
            await self.preparer(MANCHE_RELANCE)
        else:
            await self.annoncer_manche()

    async def preparer(self, compte: int = MANCHE_COMPTE):
        balade = self.regle == "balade"
        if (balade and self.ouverte) or (self.manche and self.manche["etat"] in ("compte", "cours", "fin")):
            return
        if not balade and len(self.joueurs) < 2:   # seul : on attend un adversaire
            self.manche = None
            await self.annoncer_manche()
            return
        if not self.ouverte:                       # la toute première : la minute d'ouverture
            compte, self.ouverte = MANCHE_OUVERTURE, True
        jeton = object()                           # une tâche d'une manche passée ne touche à rien
        self.manche = {"etat": "compte", "fin": time.time() + compte, "stats": {}, "elimines": set(), "jeton": jeton}
        await self.annoncer_manche()

        async def suite():
            await asyncio.sleep(compte)
            m = self.manche
            if m and m["jeton"] is jeton and m["etat"] == "compte":
                if balade:                         # la balade n'a pas de manche : la trêve finie, on se bat
                    self.manche = None
                    await self.annoncer_manche()
                elif len(self.joueurs) < 2:
                    self.manche = None
                    await self.annoncer_manche()
                else:
                    await self.commencer()
        asyncio.create_task(suite())

    async def commencer(self):
        m = self.manche
        m.update(etat="cours", stats={i: self.nouvelles_stats() for i in self.joueurs}, elimines=set(),
                 ordre=[], premier=None, tueurs={}, noms={}, camps={}, debut=time.time(),
                 fin=time.time() + self.duree if self.regle in ("temps", "drapeaux") else None)
        for j in self.joueurs.values():
            self.noter_nom(j)
        if self.regle == "drapeaux":
            self.armer_drapeaux()
        await self.annoncer_manche()
        await self.raz_objets()
        if self.regle == "drapeaux":
            asyncio.create_task(self.veiller_drapeaux(m["jeton"]))
        if self.regle in ("temps", "drapeaux"):
            jeton = m["jeton"]

            async def chrono():
                await asyncio.sleep(self.duree)
                if self.manche and self.manche["jeton"] is jeton and self.manche["etat"] == "cours":
                    await self.terminer()
            asyncio.create_task(chrono())

    async def noter_coup(self, auteur: "Connecte", cible: "Connecte", degats: float):
        s = self.stats(auteur.id)
        if not s:
            return
        s["coups"] += 1
        s["degats"] += degats
        hp, mx = cible.etat.get("hp"), cible.etat.get("mx") or 12
        if isinstance(hp, (int, float)) and hp <= SEUIL_FAIBLE * mx:
            s["faibles"] += 1

    async def noter_mort(self, victime: "Connecte", tueur: "Connecte | None"):
        m = self.manche
        if not m or m["etat"] != "cours" or not self.en_lice(victime.id):
            return
        sv = self.stats(victime.id)
        if sv:
            sv["m"] += 1
            sv["serie"] = 0
        if tueur and tueur.id != victime.id:
            st = self.stats(tueur.id)
            if st:
                st["k"] += 1
                st["serie"] += 1
                st["serie_max"] = max(st["serie_max"], st["serie"])
                if m["premier"] is None:
                    m["premier"] = tueur.id
                if m["tueurs"].get(tueur.id) == victime.id:      # il abat celui qui l'avait abattu
                    st["venge"] += 1
                # l'arme du dernier coup reçu de ce tueur (dix secondes au plus) : l'arc, la selle
                tp = victime.touche_par
                if tp and tp[0] == tueur.id and time.time() - tp[3] < 10:
                    if tp[1] == "fleche":
                        st["arc"] += 1
                    if tp[2]:
                        st["cheval"] += 1
            m["tueurs"][victime.id] = tueur.id
        if self.regle == "survie" and (not sv or sv["m"] >= self.vies):
            m["elimines"].add(victime.id)
            m["ordre"].append(victime.id)
        await self.annoncer_manche()
        await self.verifier_survie()

    async def verifier_survie(self):
        m = self.manche
        if self.regle != "survie" or not m or m["etat"] != "cours":
            return
        vivants = [j for j in self.joueurs.values() if j.id in m["stats"] and j.id not in m["elimines"]]
        restants = {j.camp for j in vivants} if self.equipes else vivants
        if len(restants) <= 1:
            await self.terminer()

    async def terminer(self):
        m = self.manche
        if not m or m["etat"] != "cours":
            return
        m["etat"] = "fin"
        m["fin"] = time.time() + MANCHE_PAUSE
        for j in self.joueurs.values():
            self.noter_nom(j)
        st = m["stats"]
        score = lambda i: st[i]["k"] - st[i]["m"]
        camp_gagnant = None
        if self.regle == "survie":
            vivants = [i for i in st if i not in m["elimines"] and i in self.joueurs]
            classement = vivants + [i for i in reversed(m["ordre"]) if i in st]
            classement += [i for i in st if i not in classement]
            if self.equipes:
                camp_gagnant = m["camps"].get(vivants[0]) if vivants else None
                gagnants = [i for i in st if camp_gagnant and m["camps"].get(i) == camp_gagnant]
            else:
                gagnants = vivants[:1]
        elif self.regle == "drapeaux":
            # le camp qui tient le plus de drapeaux ; à égalité, celui qui les a tenus le plus longtemps
            classement = sorted(st, key=lambda i: (st[i]["cap"], score(i), st[i]["k"]), reverse=True)
            tiens = {c: sum(1 for d in self.drapeaux.values() if d["camp"] == c) for c in CAMPS}
            cle = lambda c: (tiens[c], round(self.tenue[c]))
            if cle(CAMPS[0]) != cle(CAMPS[1]):
                camp_gagnant = max(CAMPS, key=cle)
            gagnants = [i for i in st if camp_gagnant and m["camps"].get(i) == camp_gagnant]
        else:
            classement = sorted(st, key=lambda i: (score(i), st[i]["k"]), reverse=True)
            if self.equipes:
                tot = {c: sum(score(i) for i in st if m["camps"].get(i) == c) for c in CAMPS}
                if tot[CAMPS[0]] != tot[CAMPS[1]] and any(st[i]["k"] for i in st):
                    camp_gagnant = max(tot, key=tot.get)
                gagnants = [i for i in st if camp_gagnant and m["camps"].get(i) == camp_gagnant]
            elif any(st[i]["k"] for i in st):              # personne à terre : personne ne gagne
                meilleur = score(classement[0])
                gagnants = [i for i in classement if score(i) == meilleur]
            else:
                gagnants = []
        badges: dict[int, list[str]] = {i: [] for i in st}
        for i in gagnants:
            badges[i].append("vainqueur")
        if m["premier"] in badges:
            badges[m["premier"]].append("premiere_lame")
        for i, s_ in st.items():
            if s_["serie_max"] >= 3:
                badges[i].append("faucheur")
            if s_["venge"]:
                badges[i].append("vengeur")
            if s_["k"] >= 2 and s_["coups"] >= 3 and s_["faibles"] / s_["coups"] >= 0.6:
                badges[i].append("opportuniste")
            if self.regle == "temps" and s_["m"] == 0 and s_["k"] >= 1:
                badges[i].append("increvable")
        deg = max((s_["degats"] for s_ in st.values()), default=0)
        if deg >= 6:                                   # trois cœurs au moins, sinon ce n'est pas un bourrin
            for i, s_ in st.items():
                if s_["degats"] == deg:
                    badges[i].append("bourrin")
        if self.regle == "drapeaux":
            cm = max((s_["cap"] for s_ in st.values()), default=0)
            if cm >= 2:
                for i, s_ in st.items():
                    if s_["cap"] == cm:
                        badges[i].append("conquerant")
        if self.regle == "temps":
            mm = max((s_["m"] for s_ in st.values()), default=0)
            if mm >= 3:
                for i, s_ in st.items():
                    if s_["m"] == mm:
                        badges[i].append("tete_brulee")
        for i, s_ in st.items():
            if s_["serie_max"] >= 5:
                badges[i].append("fleau")
            if s_["arc"] >= 3:
                badges[i].append("oeil_de_lynx")
            if s_["cheval"] >= 2:
                badges[i].append("chevalier")
            if self.regle == "survie" and i in gagnants and s_["m"] == 0 and s_["k"] >= 2:
                badges[i].append("intouchable")
        if self.regle == "drapeaux":
            for i in m.get("premier_drapeau") or []:
                if i in badges:
                    badges[i].append("porte_etendard")
            nd = len(self.drapeaux)
            if nd >= 3:
                for i, s_ in st.items():
                    if len(s_["drap"]) >= nd and set(s_["drap"]) >= set(self.drapeaux):
                        badges[i].append("globe_trotteur")
                if camp_gagnant and all(d["camp"] == camp_gagnant for d in self.drapeaux.values()):
                    for i in gagnants:
                        badges[i].append("rempart")
        # un style de jeu par manche, et les exploits en plus
        badges = {i: badges_de_manche(bs) for i, bs in badges.items()}
        # au compte des humains ; les bots gagnent leurs badges pour la gloire seulement
        with db() as cx:
            cx.execute("INSERT INTO manches (code, regle, joueurs, humains, t) VALUES (?,?,?,?,?)",
                       (self.code, self.regle, len(st), sum(1 for i in st if i > 0), time.time()))
            for i, bs in badges.items():
                if i > 0:
                    for b in bs:
                        cx.execute("""INSERT INTO badges (joueur, badge, n) VALUES (?,?,1)
                                      ON CONFLICT(joueur, badge) DO UPDATE SET n = n + 1""", (i, b))
                    compter(cx, i, "manches", 1)
                    if i in gagnants:
                        compter(cx, i, "victoires", 1)
                    hauts_faits(cx, i)
        m["resultat"] = {
            "classement": [{"id": i, "perso": m["noms"].get(i, "?"), "camp": m["camps"].get(i),
                            "k": st[i]["k"], "m": st[i]["m"], "cap": st[i]["cap"], "badges": badges[i]} for i in classement],
            "gagnants": gagnants, "camp_gagnant": camp_gagnant,
            "noms_badges": {b: v[0] for b, v in BADGES.items()},
            "rangs_badges": {b: v[3] for b, v in BADGES.items()},
        }
        await self.annoncer_manche()
        jeton = m["jeton"]

        async def ensuite():
            await asyncio.sleep(MANCHE_PAUSE)
            if self.manche and self.manche["jeton"] is jeton and self.manche["etat"] == "fin":
                self.manche = None
                await self.preparer()
        asyncio.create_task(ensuite())

    # ------------------------------------------------------------------
    #  La prise des drapeaux
    # ------------------------------------------------------------------
    # Le serveur connaît les positions (message `etat`) : c'est lui qui compte, dans chaque
    # cercle, les vivants de chaque camp. Un camp seul fait monter la jauge (plus vite à
    # plusieurs, jusqu'au double à trois) ; deux camps dans le cercle, elle se fige (contesté).
    # Un drapeau adverse se prend en deux temps : on le rabat (jauge qui redescend à zéro,
    # il redevient neutre), puis on le lève à ses couleurs.
    def vue_drapeaux(self) -> list:
        return [{"id": k, "nom": d["nom"], "p": d["p"], "y": d["y"], "camp": d["camp"],
                 "jauge": round(d["jauge"], 2), "vers": d["vers"], "conteste": d["conteste"]}
                for k, d in self.drapeaux.items()]

    def armer_drapeaux(self):
        """Une manche neuve : les drapeaux en jeu (leur nombre suit les joueurs), tous neutres."""
        n = nb_drapeaux(len(self.joueurs))
        self.drapeaux = {k: {**self.lieux_drapeaux[k], "camp": None, "jauge": 0.0, "vers": None, "conteste": False}
                         for k in tirer_drapeaux(self.lieux_drapeaux, n)}
        self.tenue = {c: 0.0 for c in CAMPS}

    def presents(self, d: dict) -> dict[str, list["Connecte"]]:
        ici = {c: [] for c in CAMPS}
        for j in self.joueurs.values():
            p, hp = j.etat.get("p"), j.etat.get("hp")
            if j.camp not in CAMPS or not p or not isinstance(hp, (int, float)) or hp <= 0:
                continue
            if d.get("n") and j.etat.get("n") != d["n"]:       # dans un intérieur, ailleurs
                continue
            if ((p[0] - d["p"][0]) ** 2 + (p[2] - d["p"][1]) ** 2) ** 0.5 <= DRAPEAU_RAYON:
                ici[j.camp].append(j)
        return ici

    async def veiller_drapeaux(self, jeton):
        dernier = 0.0
        while self.manche and self.manche["jeton"] is jeton and self.manche["etat"] == "cours":
            await asyncio.sleep(DRAPEAU_PAS)
            if not self.drapeaux and self.lieux_drapeaux:       # les lieux sont arrivés après le début
                self.armer_drapeaux()
            evts, bouge = [], False
            for k, d in self.drapeaux.items():
                if d["camp"]:
                    self.tenue[d["camp"]] += DRAPEAU_PAS
                ici = self.presents(d)
                camps_la = [c for c in CAMPS if ici[c]]
                conteste = len(camps_la) == 2
                if conteste != d["conteste"]:
                    d["conteste"] = conteste
                    bouge = True
                if len(camps_la) != 1:
                    continue
                c = camps_la[0]
                pas = DRAPEAU_PAS / DRAPEAU_PRISE * min(2.0, 1 + 0.5 * (len(ici[c]) - 1))
                if d["camp"] == c:                               # chez soi : on remet la jauge à plein
                    if d["jauge"] < 1:
                        d.update(jauge=min(1.0, d["jauge"] + pas), vers=c)
                        bouge = True
                    continue
                if d["camp"] or (d["vers"] and d["vers"] != c):  # adverse (ou entamé par l'autre) : on rabat
                    d["jauge"] = max(0.0, d["jauge"] - pas)
                    if d["jauge"] <= 0:
                        if d["camp"]:
                            evts.append({"evt": "neutre", "id": k, "camp": d["camp"], "par": c})
                        d.update(camp=None, vers=c)
                else:                                            # neutre : on le lève
                    d.update(vers=c, jauge=min(1.0, d["jauge"] + pas))
                    if d["jauge"] >= 1:
                        d["camp"] = c
                        noms = [j.perso for j in ici[c]]
                        if self.manche.get("premier_drapeau") is None:
                            self.manche["premier_drapeau"] = [j.id for j in ici[c]]
                        for j in ici[c]:
                            s = self.stats(j.id)
                            if s:
                                s["cap"] += 1
                                if k not in s["drap"]:
                                    s["drap"].append(k)
                        evts.append({"evt": "pris", "id": k, "camp": c, "noms": noms})
                bouge = True
            maintenant = time.time()
            for e in evts:
                await self.diffuser({"t": "drapeaux", "drapeaux": self.vue_drapeaux(),
                                     "tenue": {c: round(t) for c, t in self.tenue.items()}, **e})
            if bouge and not evts and maintenant - dernier > 0.45:   # la jauge : deux fois par seconde
                dernier = maintenant
                await self.diffuser({"t": "drapeaux", "drapeaux": self.vue_drapeaux(),
                                     "tenue": {c: round(t) for c, t in self.tenue.items()}})

    def vue_objets(self) -> list:
        maintenant = time.time()
        return [{"id": k, "type": o["type"], "p": o["p"], "y": o["y"], "porteur": o["porteur"],
                 "retour": max(0, round(o["retour"] - maintenant)) if o["retour"] else None,
                 "brise": bool(o.get("brise")), "maison": o.get("maison"), "pv": o.get("pv"), "yaw": o.get("yaw", 0)}
                for k, o in self.objets.items()]

    async def annoncer_objets(self, **evt):
        await self.diffuser({"t": "objets", "objets": self.vue_objets(), **evt})

    async def lacher_objets(self, qui: "Connecte"):
        """Celui qui s'en va rend ce qu'il portait : l'objet revient à son lieu."""
        rendus = [k for k, o in self.objets.items() if o["porteur"] == qui.id]
        p = qui.etat.get("p")
        for k in rendus:
            self.objets[k]["porteur"] = None
            if self.objets[k]["type"] == "cheval" and p:   # le cheval reste là où son cavalier l'a quitté
                self.objets[k].update(p=[p[0], p[2]], y=p[1])
        if rendus:
            await self.annoncer_objets()

    async def raz_objets(self):
        """Une manche neuve : tout le monde repart les mains nues, les objets à leur lieu."""
        if not self.objets:
            return
        for o in self.objets.values():
            o.update(porteur=None, retour=None, brise=False)
            if o.get("maison"):                      # le cheval rentre à l'écurie, reposé
                o.update(p=list(o["maison"]["p"]), y=o["maison"]["y"], pv=CHEVAL_PV)
        await self.annoncer_objets(evt="raz")

    async def victoire_balade(self):
        """En balade par équipes : un camp à VICTOIRE_BALADE points l'emporte. On diffuse le
        tableau (qui a apporté quoi), puis tout repart : points à zéro, bannières au ralliement."""
        if self.regle != "balade" or not self.equipes:
            return
        gagnant = next((c for c in CAMPS if self.points[c] >= VICTOIRE_BALADE), None)
        if not gagnant:
            return
        joueurs = [{"id": c.id, "perso": c.perso, "camp": c.camp, **self.apport.get(c.id, {"mises": 0, "bannieres": 0})}
                   for c in self.joueurs.values() if c.camp in CAMPS]
        joueurs.sort(key=lambda j: (j["camp"] != gagnant, -(j["mises"] + BANNIERE_POINTS * j["bannieres"])))
        await self.diffuser({"t": "victoire", "camp": gagnant, "points": dict(self.points), "joueurs": joueurs,
                             "objectif": VICTOIRE_BALADE})
        self.points = {c: 0 for c in CAMPS}
        self.apport = {}
        for b in self.bannieres.values():
            b.update(etat="base", porteur=None, p=None)
        await self.diffuser({"t": "banniere", "bannieres": self.vue_bannieres(), "evt": "raz", "points": self.points})

    def vue_bannieres(self) -> dict:
        return {c: {k: v for k, v in b.items() if k != "t"} for c, b in self.bannieres.items()}

    async def faire_tomber(self, porteur: "Connecte"):
        # le porteur tombe (ou s'en va) : la bannière reste là où il était
        for c, b in self.bannieres.items():
            if b["porteur"] == porteur.id:
                p = porteur.etat.get("p") or [0, 0, 0]
                quand = time.time()
                b.update(etat="tombee", porteur=None, p=[p[0], p[2]], t=quand)
                await self.diffuser({"t": "banniere", "bannieres": self.vue_bannieres(),
                                     "evt": "tombe", "camp": c, "perso": porteur.perso})

                async def rentrer(b=b, c=c, quand=quand):
                    await asyncio.sleep(BANNIERE_RETOUR)
                    if b["etat"] == "tombee" and b["t"] == quand:     # personne n'y a touché
                        b.update(etat="base", porteur=None, p=None)
                        await self.diffuser({"t": "banniere", "bannieres": self.vue_bannieres(), "evt": "rentre", "camp": c})
                asyncio.create_task(rentrer())

    def camps(self) -> dict:
        return {c: sum(1 for j in self.joueurs.values() if j.camp == c) for c in CAMPS}

    def humains(self) -> list["Connecte"]:
        return [j for j in self.joueurs.values() if not j.est_bot]

    def bots(self) -> list["Connecte"]:
        return [j for j in self.joueurs.values() if j.est_bot]

    def creer_bots(self, n: int, niveau: str, equipes: bool):
        noms = list(NOMS_BOTS)
        for k in range(n):
            b = Connecte(None, -(k + 1), f"bot {niveau}", noms[k % len(noms)])
            b.niveau = niveau
            if equipes:              # dans le camp le moins garni : les bots font l'équilibre
                n_ = self.camps()
                b.camp = min(CAMPS, key=lambda c: (n_[c], CAMPS.index(c)))
            self.joueurs[b.id] = b

    async def confier_bots(self, hote: int | None):
        """Donne les bots à un humain du salon — l'hôte s'il est là — et le lui dit."""
        bots = self.bots()
        hs = self.humains()
        if not bots or not hs:
            return
        pilote = next((h for h in hs if h.id == hote), hs[0])
        for b in bots:
            b.pilote = pilote.id
        await self.envoyer(pilote.id, {"t": "pilote", "bots": [b.vue() for b in bots]})

    async def equilibrer_pour(self, humain: "Connecte", camp: str):
        """Un humain entre dans `camp` : des bots passent en face tant que le camp aurait
        un joueur de plus que l'autre. Les humains choisissent, les bots s'adaptent."""
        autre = CAMPS[1] if camp == CAMPS[0] else CAMPS[0]
        while True:
            n = self.camps()
            en_trop = n[camp] - (1 if humain.camp == camp else 0) + 1 - n[autre]
            b = next((x for x in self.bots() if x.camp == camp), None)
            if en_trop < 2 or not b:
                return
            b.camp = autre
            await self.faire_tomber(b)
            await self.diffuser({"t": "camp", "id": b.id, "camp": autre, "camps": self.camps()})

    def vue_fete(self) -> dict | None:
        if not self.fete:
            return None
        return {"reste": max(0, round(self.fete["fin"] - time.time())), "scores": self.fete["scores"],
                "noms": {str(j.id): j.perso for j in self.joueurs.values()},
                "camps": {str(j.id): j.camp for j in self.joueurs.values()}}

    async def diffuser(self, msg: dict, sauf: int | None = None):
        mort = []
        texte = json.dumps(msg, separators=(",", ":"))
        for c in list(self.joueurs.values()):
            if c.id == sauf or c.est_bot:
                continue
            try:
                await c.ws.send_text(texte)
            except Exception:
                mort.append(c.id)
        for i in mort:
            self.joueurs.pop(i, None)

    async def envoyer(self, jid: int, msg: dict):
        c = self.joueurs.get(jid)
        if not c:
            return
        if c.est_bot:
            # ce qui arrive à un bot (un coup, un refus) va à son pilote, qui le fait vivre
            if c.pilote is not None and c.pilote in self.joueurs:
                await self.envoyer(c.pilote, {"t": "pour-bot", "b": jid, "m": msg})
            return
        try:
            await c.ws.send_text(json.dumps(msg, separators=(",", ":")))
        except Exception:
            self.joueurs.pop(jid, None)


SALONS: dict[str, Salon] = {}


def distance_etat(a: dict, b: dict) -> float:
    pa, pb = a.get("p"), b.get("p")
    if not pa or not pb:
        return 0.0                                  # pas encore de position : on laisse passer
    return ((pa[0] - pb[0]) ** 2 + (pa[2] - pb[2]) ** 2) ** 0.5


@app.websocket("/ws/{code}")
async def salon_ws(ws: WebSocket, code: str, jeton: str = "", perso: str = ""):
    code = code.upper()
    j = joueur_du_jeton(jeton)
    if not j:
        await ws.close(code=4001, reason="connexion requise")
        return
    with db() as cx:
        inst = cx.execute("SELECT code, nom, hote, rdv, mode, enjeu, bots, niveau, regle, vies, duree, arene FROM instances WHERE code = ?", (code,)).fetchone()
        if not inst:
            await ws.close(code=4004, reason="instance introuvable")
            return
        cx.execute("INSERT OR IGNORE INTO membres (code, joueur, rejoint) VALUES (?,?,?)",
                   (code, j["id"], time.time()))
        cx.execute("UPDATE instances SET vu = ? WHERE code = ?", (time.time(), code))

    salon = SALONS.setdefault(code, Salon(code))
    # même compte déjà connecté (onglet resté ouvert) : on ferme l'ancienne connexion
    ancien = salon.joueurs.get(j["id"])
    if ancien:
        try:
            await ancien.ws.close(code=4009, reason="connecté ailleurs")
        except Exception:
            pass
        salon.joueurs.pop(j["id"], None)
    equipes = inst["mode"] == "equipes"
    if len(salon.humains()) >= places_humains(inst["mode"], inst["bots"]):
        await ws.close(code=4003, reason="instance complète")
        return

    await ws.accept()
    moi = Connecte(ws, j["id"], j["pseudo"], re.sub(r"\s+", " ", perso).strip()[:24])
    salon.joueurs[moi.id] = moi
    salon.regle, salon.equipes = inst["regle"], equipes
    salon.vies = inst["vies"]
    salon.duree = int(MANCHE_DUREE_BANC) if MANCHE_DUREE_BANC else inst["duree"]
    # le premier humain arrivé fait naître les bots ; s'ils n'ont plus de pilote, il le devient
    if inst["bots"] and not salon.bots():
        salon.creer_bots(inst["bots"], inst["niveau"], equipes)
    sans_pilote = [b for b in salon.bots() if b.pilote not in salon.joueurs]
    if sans_pilote:
        for b in sans_pilote:
            b.pilote = moi.id
    await ws.send_text(json.dumps({
        "t": "bienvenue", "code": code, "nom": inst["nom"], "places": places_humains(inst["mode"], inst["bots"]),
        "moi": {"id": moi.id, "pseudo": moi.pseudo, "perso": moi.perso},
        "hote": moi.id == inst["hote"], "rdv": json.loads(inst["rdv"]) if inst["rdv"] else None,
        "mode": inst["mode"], "enjeu": bool(inst["enjeu"]), "arene": inst["arene"], "camps": salon.camps(), "points": salon.points,
        "fete": salon.vue_fete(), "bannieres": salon.vue_bannieres(),
        "bourses": [{"id": k, **{c: v for c, v in b.items() if c != "fin"}} for k, b in salon.bourses.items()],
        "objets": salon.vue_objets(),
        "joueurs": [c.vue() for c in salon.joueurs.values() if c.id != moi.id],
        "pilote": [b.vue() for b in salon.bots() if b.pilote == moi.id],
        "regle": salon.regle,
        "drapeaux": salon.vue_drapeaux(), "lieux_drapeaux": len(salon.lieux_drapeaux),
    }, separators=(",", ":")))
    # l'apparence n'est pas encore connue : elle suit, dans un message « look » du client
    await salon.diffuser({"t": "arrivee", "id": moi.id, "pseudo": moi.pseudo, "perso": moi.perso}, sauf=moi.id)
    # la manche : un retardataire regarde la fin (survie) ou y entre (temps) ; à deux, on lance
    if salon.manche and salon.manche["etat"] == "cours":
        salon.noter_nom(moi)
        if salon.regle == "survie":
            salon.manche["elimines"].add(moi.id)
        else:
            salon.stats(moi.id)
    await salon.preparer()
    await salon.envoyer(moi.id, {"t": "manche", **salon.vue_manche()})

    async def traiter(moi: Connecte, m: dict):
        """Un message du salon. `moi` est son auteur : le joueur de cette connexion, ou un
        bot qu'il pilote — les règles (portée, cadence, camps) sont les mêmes pour les deux."""
        t = m.get("t")
        if t == "rejouer":
            await salon.rejouer(moi)
            return
        if moi.est_bot and t in ("fete", "recolte", "don", "ramasser"):
            return                      # la fête et l'argent restent aux humains

        if t == "etat":
            # ar / bc : niveaux d'armure et d'écu portés, gd : écu levé — pour que les autres le voient
            # Le chemin parcouru, pour les badges de voyage : mesuré ici, sur les positions
            # annoncées, et pas cru sur parole. Un saut de plus de 30 m entre deux annonces
            # (apparition, retour au camp) ne compte pas. Versé au compte par 100 m.
            av, ap = (moi.etat or {}).get("p"), m.get("p")
            if not moi.est_bot and isinstance(av, list) and isinstance(ap, list) and len(av) == 3 == len(ap):
                try:
                    d = math.hypot(float(ap[0]) - float(av[0]), float(ap[2]) - float(av[2]))
                except (TypeError, ValueError):
                    d = 0.0
                if 0 < d < 30:
                    moi.metres += d
                    if moi.metres >= 100:
                        with db() as cx:
                            compter(cx, moi.id, "metres", moi.metres)
                        moi.metres = 0.0
            # ch : à cheval — le client sait asseoir un cavalier distant (tloc-multi.js), encore
            # fallait-il le lui dire
            moi.etat = {"p": m.get("p"), "y": m.get("y"), "a": m.get("a"),
                        "hp": m.get("hp"), "mx": m.get("mx"), "n": m.get("n"),
                        "ar": m.get("ar"), "bc": m.get("bc"), "gd": m.get("gd"), "ch": m.get("ch")}
            await salon.diffuser({"t": "etat", "id": moi.id, **moi.etat}, sauf=moi.id)

        elif t == "look":
            moi.look = look_propre(m.get("l"))
            await salon.diffuser({"t": "look", "id": moi.id, "l": moi.look}, sauf=moi.id)

        elif t == "rdv":
            # le point de rendez-vous. Chacun pour soi : seul l'hôte le pose (c'est son
            # premier point d'apparition). En équipes : un par camp, posé par le premier
            # du camp qui choisit — c'est le camp de base.
            try:
                rdv = {"x": round(float(m["x"]), 2), "z": round(float(m["z"]), 2),
                       "nom": str(m.get("nom") or "")[:60]}
            except (KeyError, TypeError, ValueError):
                return
            if not (abs(rdv["x"]) < 5000 and abs(rdv["z"]) < 5000):
                return
            with db() as cx:
                actuel = cx.execute("SELECT rdv FROM instances WHERE code = ?", (code,)).fetchone()["rdv"]
                actuel = json.loads(actuel) if actuel else None
                if equipes:
                    if moi.camp not in CAMPS:
                        return
                    tous = actuel if isinstance(actuel, dict) and "x" not in actuel else {}
                    if tous.get(moi.camp):
                        return
                    tous[moi.camp] = rdv
                    cx.execute("UPDATE instances SET rdv = ? WHERE code = ?", (json.dumps(tous), code))
                    await salon.diffuser({"t": "rdv", "camp": moi.camp, **rdv}, sauf=moi.id)
                    return
                if moi.id != inst["hote"]:
                    return
                cx.execute("UPDATE instances SET rdv = ? WHERE code = ?", (json.dumps(rdv), code))
            await salon.diffuser({"t": "rdv", **rdv}, sauf=moi.id)

        elif t == "camp":
            # le camp se choisit à l'entrée ; on le garde pour la partie (la sauvegarde
            # de l'instance le renvoie à chaque reconnexion). Un camp qui aurait deux
            # joueurs de plus que l'autre est refusé : l'équilibre fait le jeu.
            c = m.get("camp")
            if not equipes or c not in CAMPS:
                return
            if not moi.est_bot:
                await salon.equilibrer_pour(moi, c)
            n = salon.camps()
            autre = CAMPS[1] if c == CAMPS[0] else CAMPS[0]
            if moi.camp != c and n[c] - (1 if moi.camp == c else 0) >= n[autre] + 2:
                await salon.envoyer(moi.id, {"t": "camp-refuse", "camp": c, "camps": n})
                return
            moi.camp = c
            await salon.diffuser({"t": "camp", "id": moi.id, "camp": c, "camps": salon.camps()})

        elif t == "fete":
            # la fête de la moisson : l'hôte la lance, trois minutes, et chacun annonce
            # ce qu'il fauche. Le serveur tient les comptes et proclame le vainqueur.
            if moi.id != inst["hote"] or salon.fete:
                return
            salon.fete = {"fin": time.time() + FETE_DUREE, "scores": {str(i): 0 for i in salon.joueurs}, "compte": {}}
            await salon.diffuser({"t": "fete", **salon.vue_fete()})

            async def clore(sa=salon):
                await asyncio.sleep(FETE_DUREE)
                f = sa.fete
                if not f:
                    return
                sa.fete = None
                vue = {"scores": f["scores"], "noms": {str(j.id): j.perso for j in sa.joueurs.values()},
                       "camps": {str(j.id): j.camp for j in sa.joueurs.values()}}
                await sa.diffuser({"t": "fete-fin", **vue})
            asyncio.create_task(clore())

        elif t == "recolte":
            f = salon.fete
            if not f or time.time() > f["fin"]:
                return
            try:
                n = int(m.get("n", 0))
            except (TypeError, ValueError):
                return
            # plausibilité : pas plus de FETE_CADENCE plantes par seconde depuis le
            # dernier envoi — au-delà, on écrête (le banc envoie une fois par seconde)
            t0, _ = f["compte"].get(moi.id, (time.time() - 1, 0))
            maintenant = time.time()
            n = max(0, min(n, int(FETE_CADENCE * max(0.5, min(3.0, maintenant - t0)))))
            f["compte"][moi.id] = (maintenant, n)
            f["scores"][str(moi.id)] = f["scores"].get(str(moi.id), 0) + n
            await salon.diffuser({"t": "fete-score", "scores": f["scores"],
                                  "reste": max(0, round(f["fin"] - maintenant))})

        elif t == "don":
            # donner des écus : le donneur les a déjà retirés de sa bourse ; le serveur
            # ne fait que porter le don, borné, à un joueur présent
            cible = salon.joueurs.get(m.get("a"))
            try:
                n = int(m.get("n", 0))
            except (TypeError, ValueError):
                return
            if not cible or cible.id == moi.id or cible.est_bot or not 0 < n <= DON_MAX:
                return
            await salon.envoyer(cible.id, {"t": "don", "de": moi.id, "perso": moi.perso, "n": n})
            await salon.diffuser({"t": "chat", "id": 0, "pseudo": "", "perso": "✦",
                                  "m": f"{moi.perso} donne {n} écus à {cible.perso}."})

        elif t in ("saisir", "rapporter") and equipes and moi.camp in CAMPS and salon.regle != "drapeaux":
            # la bannière : le serveur vérifie les distances à partir de la position que
            # le client lui a annoncée, et c'est lui qui change l'état
            p = moi.etat.get("p")
            if not p:
                return
            with db() as cx:
                r = cx.execute("SELECT rdv FROM instances WHERE code = ?", (code,)).fetchone()["rdv"]
            bases = json.loads(r) if r else {}
            if not isinstance(bases, dict) or "x" in bases:
                bases = {}
            d = lambda x, z: ((p[0] - x) ** 2 + (p[2] - z) ** 2) ** 0.5
            maintenant = time.time()
            for c, b in salon.bannieres.items():      # une bannière tombée depuis trop longtemps rentre
                if b["etat"] == "tombee" and maintenant - b["t"] > BANNIERE_RETOUR:
                    b.update(etat="base", porteur=None, p=None)
            if t == "saisir":
                c = m.get("camp")
                if c not in CAMPS or not bases.get(c):
                    return
                b = salon.bannieres[c]
                if c != moi.camp:
                    # la bannière adverse : à son ralliement, ou tombée
                    if any(x["porteur"] == moi.id for x in salon.bannieres.values()):
                        return
                    lieu = (bases[c]["x"], bases[c]["z"]) if b["etat"] == "base" else (b["p"] if b["etat"] == "tombee" else None)
                    if not lieu or d(*lieu) > BANNIERE_PORTEE:
                        return
                    b.update(etat="portee", porteur=moi.id, p=None)
                    evt = "prise"
                else:
                    # la sienne, tombée : on la touche, elle rentre
                    if b["etat"] != "tombee" or d(*b["p"]) > BANNIERE_PORTEE:
                        return
                    b.update(etat="base", porteur=None, p=None)
                    evt = "rendue"
                await salon.diffuser({"t": "banniere", "bannieres": salon.vue_bannieres(), "evt": evt,
                                      "camp": c, "perso": moi.perso, "id": moi.id})
            else:
                # rapporter : on porte l'adverse, on est à son ralliement, la sienne y est
                autre = CAMPS[1] if moi.camp == CAMPS[0] else CAMPS[0]
                b = salon.bannieres[autre]
                base = bases.get(moi.camp)
                if b["porteur"] != moi.id or not base or d(base["x"], base["z"]) > BANNIERE_PORTEE + 1:
                    return
                if salon.bannieres[moi.camp]["etat"] != "base":
                    return
                b.update(etat="base", porteur=None, p=None)
                salon.points[moi.camp] += BANNIERE_POINTS
                salon.apport.setdefault(moi.id, {"mises": 0, "bannieres": 0})["bannieres"] += 1
                await salon.diffuser({"t": "banniere", "bannieres": salon.vue_bannieres(), "evt": "marque",
                                      "camp": autre, "perso": moi.perso, "id": moi.id, "points": salon.points})
                await salon.victoire_balade()

        elif t == "ramasser":
            # la bourse est au premier qui l'atteint : le serveur tranche, pas les clients
            b = salon.bourses.get(str(m.get("b")))
            p = moi.etat.get("p")
            if not b or not p or time.time() > b["fin"]:
                return
            if ((p[0] - b["p"][0]) ** 2 + (p[2] - b["p"][1]) ** 2) ** 0.5 > BOURSE_PORTEE:
                return
            salon.bourses.pop(str(m.get("b")), None)
            await salon.diffuser({"t": "bourse-prise", "b": m.get("b"), "par": moi.id, "perso": moi.perso, "n": b["n"]})

        elif t == "objets-lieux":
            # le premier client qui connaît la carte pose les objets ; les suivants les trouvent
            # (et complètent ceux qui manquent : un salon ouvert avant l'arrivée du cheval)
            if moi.est_bot:
                return
            for o in (m.get("objets") or [])[:OBJETS_MAX]:
                try:
                    oid, typ, x, z, y = str(o["id"]), o["type"], float(o["p"][0]), float(o["p"][1]), float(o.get("y", 0))
                except (KeyError, TypeError, ValueError, IndexError):
                    continue
                if typ in OBJETS and re.fullmatch(r"[a-z]+(-[a-z0-9]+)?", oid) and oid not in salon.objets and len(salon.objets) < OBJETS_MAX:
                    salon.objets[oid] = {"type": typ, "p": [x, z], "y": y, "porteur": None, "retour": None}
                    if typ == "cheval":
                        salon.objets[oid].update(maison={"p": [x, z], "y": y}, pv=CHEVAL_PV)
            await salon.annoncer_objets()

        elif t == "drapeaux-lieux":
            # comme les objets : le premier client qui connaît la carte propose les points forts
            if moi.est_bot or salon.lieux_drapeaux:
                return
            for d in (m.get("drapeaux") or [])[:EMPLACEMENTS_MAX]:
                try:
                    did, x, z, y = str(d["id"]), float(d["p"][0]), float(d["p"][1]), float(d.get("y", 0))
                except (KeyError, TypeError, ValueError, IndexError):
                    continue
                if re.fullmatch(r"[a-z0-9]{1,16}", did) and abs(x) < 5000 and abs(z) < 5000:
                    salon.lieux_drapeaux[did] = {"nom": str(d.get("nom") or did)[:40], "p": [x, z], "y": y,
                                                 "n": str(d.get("n") or "")[:40]}
            if salon.manche and salon.manche["etat"] == "cours" and not salon.drapeaux:
                salon.armer_drapeaux()
            await salon.diffuser({"t": "drapeaux", "drapeaux": salon.vue_drapeaux(),
                                  "tenue": {c: round(t) for c, t in salon.tenue.items()}})

        elif t == "objet-prendre":
            o = salon.objets.get(str(m.get("o")))
            p = moi.etat.get("p")
            if not o or not p or o["porteur"] is not None or o["retour"] or o.get("brise") or moi.est_bot:
                return
            if any(v["porteur"] == moi.id and v["type"] == o["type"] for v in salon.objets.values()):
                return                                      # une armure, un cheval… à la fois
            if ((p[0] - o["p"][0]) ** 2 + (p[2] - o["p"][1]) ** 2) ** 0.5 > OBJET_PORTEE:
                return
            o["porteur"] = moi.id
            await salon.annoncer_objets(evt="pris", o=o["type"], id=str(m.get("o")), par=moi.id, perso=moi.perso)

        elif t == "objet-poser":
            # descendre de cheval : il reste où il est, avec la vie qu'il lui reste
            o = salon.objets.get(str(m.get("o")))
            if not o or o["porteur"] != moi.id or o["type"] != "cheval":
                return
            try:
                o.update(p=[float(m["p"][0]), float(m["p"][1])], y=float(m.get("y", 0)),
                         pv=max(1, min(CHEVAL_PV, int(m.get("pv", CHEVAL_PV)))), yaw=float(m.get("yaw", 0)))
            except (KeyError, TypeError, ValueError, IndexError):
                pass
            o["porteur"] = None
            await salon.annoncer_objets(evt="pose", o="cheval", id=str(m.get("o")), par=moi.id, perso=moi.perso)

        elif t == "objet-casse":
            o = salon.objets.get(str(m.get("o")))
            if not o or o["porteur"] != moi.id:
                return
            if o["type"] != "cheval":
                o.update(porteur=None, brise=True)      # jusqu'à la manche suivante (raz_objets)
                await salon.annoncer_objets(evt="casse", o=o["type"], id=str(m.get("o")), par=moi.id, perso=moi.perso)
                return
            # le cheval tombe : un cheval frais revient à l'écurie
            o.update(porteur=None, retour=time.time() + OBJET_RETOUR, p=list(o["maison"]["p"]), y=o["maison"]["y"], pv=CHEVAL_PV)
            oid = str(m.get("o"))
            await salon.annoncer_objets(evt="casse", o="cheval", id=oid, par=moi.id, perso=moi.perso)
            marque = o["retour"]

            async def revenir():
                await asyncio.sleep(OBJET_RETOUR)
                if o["retour"] == marque:
                    o["retour"] = None
                    await salon.annoncer_objets(evt="retour", o="cheval", id=oid)
            asyncio.create_task(revenir())

        elif t == "coup":
            cible = salon.joueurs.get(m.get("c"))
            maintenant = time.time()
            if not cible or cible.id == moi.id:
                return
            if equipes and moi.camp and moi.camp == cible.camp:
                return                                      # pas de tir ami
            if not salon.en_lice(moi.id) or not salon.en_lice(cible.id):
                return                                      # éliminé : on regarde, on ne frappe plus
            if salon.manche and salon.manche["etat"] == "compte":
                return                                      # la trêve d'avant-manche (MANCHE_OUVERTURE)
            if maintenant - moi.dernier_coup < CADENCE_COUP:
                return
            if distance_etat(moi.etat, cible.etat) > (PORTEE_FLECHE if m.get("k") == "fleche" else PORTEE_COUP):
                return
            moi.dernier_coup = maintenant
            cible.touche_par = (moi.id, m.get("k", "epee"), bool(moi.etat.get("ch")), maintenant)
            degats = max(0.5, min(4.0, float(m.get("d", 1))))
            await salon.noter_coup(moi, cible, degats)
            pos = moi.etat.get("p") or [0, 0, 0]
            await salon.envoyer(cible.id, {"t": "touche", "de": moi.id, "pseudo": moi.pseudo,
                                           "perso": moi.perso,
                                           "d": degats, "k": m.get("k", "epee"),
                                           "p": [pos[0], pos[2]]})

        elif t == "mort":
            tueur = salon.joueurs.get(m.get("par"))
            await salon.noter_mort(moi, tueur)
            moi.morts += 1
            if tueur and tueur.id != moi.id:
                tueur.frags += 1
                if equipes and tueur.camp in CAMPS and tueur.camp != moi.camp:
                    salon.points[tueur.camp] += 1
                    salon.apport.setdefault(tueur.id, {"mises": 0, "bannieres": 0})["mises"] += 1
            await salon.faire_tomber(moi)
            await salon.diffuser({
                "t": "mort", "id": moi.id, "pseudo": moi.pseudo, "perso": moi.perso,
                "par": tueur.id if tueur else None,
                "parPseudo": tueur.pseudo if tueur else None,
                "parPerso": tueur.perso if tueur else None,
                "scores": [c.vue() for c in salon.joueurs.values()],
                "points": salon.points,
            })
            await salon.victoire_balade()
            # la bourse en jeu : la victime a déjà retiré ce qu'elle perd ; la bourse
            # tombe là où elle est tombée, et reste BOURSE_VIE secondes
            try:
                perdu = int(m.get("perdu", 0))
            except (TypeError, ValueError):
                perdu = 0
            p = moi.etat.get("p")
            if inst["enjeu"] and tueur and 0 < perdu <= 9999 and p:
                bid = secrets.token_hex(4)
                salon.bourses[bid] = {"p": [p[0], p[2]], "y": p[1], "n": perdu, "fin": time.time() + BOURSE_VIE}
                await salon.diffuser({"t": "bourse", "id": bid, "p": [p[0], p[2]], "y": p[1], "n": perdu})

        elif t == "chat":
            # `e` : un message à son camp seulement (en équipes). Les bots n'ont que celui-là :
            # ils y disent leurs intentions — « je vais prendre la poterne » — à leurs alliés.
            texte = str(m.get("m", ""))[:200].strip()
            equipe = bool(m.get("e")) and equipes and moi.camp in CAMPS
            if not texte or (moi.est_bot and not equipe):
                return
            msg = {"t": "chat", "id": moi.id, "pseudo": moi.pseudo, "perso": moi.perso, "m": texte}
            if equipe:
                msg.update(e=1, camp=moi.camp)
                for c in list(salon.joueurs.values()):
                    if c.camp == moi.camp and not c.est_bot:
                        await salon.envoyer(c.id, msg)
            else:
                await salon.diffuser(msg)


    try:
        while True:
            brut = await ws.receive_text()
            if len(brut) > 4000:
                continue
            try:
                m = json.loads(brut)
            except Exception:
                continue
            t = m.get("t")
            if t == "bot":
                # un bot parle par la bouche de son pilote, et de personne d'autre
                b_ = salon.joueurs.get(m.get("b"))
                if b_ and b_.est_bot and b_.pilote == moi.id and isinstance(m.get("m"), dict):
                    await traiter(b_, m["m"])
            elif t == "ping":
                await ws.send_text('{"t":"pong"}')
            else:
                await traiter(moi, m)


    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # une connexion remplacée (même compte, autre onglet) : la nouvelle a déjà pris la place
        if moi.metres > 1 and not moi.est_bot:           # le reste du chemin parcouru
            with db() as cx:
                compter(cx, moi.id, "metres", moi.metres)
                hauts_faits(cx, moi.id)
            moi.metres = 0.0
        if salon.joueurs.get(moi.id) is moi:
            salon.joueurs.pop(moi.id, None)
            await salon.faire_tomber(moi)
            await salon.lacher_objets(moi)
            await salon.diffuser({"t": "depart", "id": moi.id, "pseudo": moi.pseudo, "perso": moi.perso})
            if any(b.pilote == moi.id for b in salon.bots()) and salon.humains():
                await salon.confier_bots(inst["hote"])
            mc = salon.manche
            if mc and mc["etat"] == "cours" and salon.regle == "survie" and moi.id in mc["stats"] and moi.id not in mc["elimines"]:
                mc["elimines"].add(moi.id)
                mc["ordre"].append(moi.id)
                await salon.annoncer_manche()
                await salon.verifier_survie()
            elif mc and mc["etat"] == "compte" and len(salon.joueurs) < 2:
                salon.manche = None
                await salon.annoncer_manche()
        with db() as cx:
            cx.execute("UPDATE instances SET vu = ? WHERE code = ?", (time.time(), code))
        if not salon.humains():
            SALONS.pop(code, None)


# =====================================================================
#  En local, le serveur peut aussi servir le jeu (TLOC_RACINE=..)
# =====================================================================
if RACINE:
    from fastapi.responses import RedirectResponse
    from fastapi.staticfiles import StaticFiles

    @app.get("/")
    def _racine():
        return RedirectResponse("/accueil.html")

    @app.get("/admin")
    def _admin():
        return RedirectResponse("/admin.html")

    class Statique(StaticFiles):
        async def get_response(self, path: str, scope):           # pas de cache en dev
            r = await super().get_response(path, scope)
            r.headers["Cache-Control"] = "no-store"
            return r

    app.mount("/", Statique(directory=RACINE, html=True), name="jeu")
