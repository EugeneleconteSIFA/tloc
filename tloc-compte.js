// tloc-compte.js — compte joueur, parties (slots) et instances multijoueur.
//
// Ce fichier ne connaît rien au jeu : il ne fait que parler au serveur (serveur/app.py)
// et tenir l'inventaire des parties dans le localStorage. Il est partagé par la page
// d'accueil (accueil.js) et par le jeu lui-même (tloc-multi.js).
//
// Le moteur, lui, n'a pas été touché : il écrit toujours sa sauvegarde dans la clé
// `tloc_save_v2`. Une partie (un « slot ») est donc une COPIE de cette clé, rangée sous
// `tloc_save_v2:<id>` ; ouvrir une partie, c'est recopier son contenu dans `tloc_save_v2`,
// et tloc-multi.js se charge de recopier dans l'autre sens pendant qu'on joue.

export const CLE_MOTEUR = 'tloc_save_v2';          // la clé qu'écrit engine.js, inchangée
const CLE_COMPTE = 'tloc_compte';
const CLE_SLOTS = 'tloc_slots';
const CLE_ACTIF = 'tloc_slot';
const CLE_INSTANCE = 'tloc_instance';

export const API = localStorage.getItem('tloc_api') || '';   // même origine, sauf réglage manuel

const lire = (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// =====================================================================
//  Compte
// =====================================================================
export const compte = () => lire(CLE_COMPTE);
export const connecte = () => !!(compte() && compte().jeton);

export async function appel(chemin, opts = {}) {
  const c = compte();
  // Un serveur absent, ou `python3 -m http.server` qui répond une page HTML à la place de
  // l'API : le joueur lisait « Unexpected token '<' ». On lui dit plutôt quoi faire.
  const HORS_API = 'Le serveur du jeu ne répond pas : lance ./lancer.sh puis recharge la page. Tes parties restent jouables sur ce navigateur.';
  let r;
  try {
    r = await fetch(API + chemin, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(c && c.jeton ? { Authorization: 'Bearer ' + c.jeton } : {}),
        ...(opts.headers || {}),
      },
    });
  } catch (e) { throw new Error(HORS_API); }
  const texte = await r.text();
  let data = {};
  try { data = texte ? JSON.parse(texte) : {}; } catch (e) { throw new Error(HORS_API); }
  // 401 avec un jeton = session périmée ; 401 sans jeton = identifiants refusés à la
  // connexion, et c'est le message du serveur qui dit pourquoi
  if (r.status === 401 && c && c.jeton) { deconnexionLocale(); throw new Error('Session expirée, reconnecte-toi.'); }
  if (!r.ok) throw new Error(data.erreur || data.detail || 'Erreur serveur');
  return data;
}

export async function inscription(pseudo, mdp) { return session(await appel('/api/inscription', { method: 'POST', body: JSON.stringify({ pseudo, mdp }) })); }
export async function connexion(pseudo, mdp) { return session(await appel('/api/connexion', { method: 'POST', body: JSON.stringify({ pseudo, mdp }) })); }
function session(d) { ecrire(CLE_COMPTE, { jeton: d.jeton, pseudo: d.pseudo }); return d; }
export function deconnexionLocale() { try { localStorage.removeItem(CLE_COMPTE); localStorage.removeItem(CLE_INSTANCE); } catch (e) {} }
export async function deconnexion() { try { await appel('/api/deconnexion', { method: 'POST' }); } catch (e) {} deconnexionLocale(); }

// =====================================================================
//  Parties locales (slots)
// =====================================================================
export const slots = () => lire(CLE_SLOTS, []);
const poserSlots = (l) => ecrire(CLE_SLOTS, l);
export const slotActif = () => localStorage.getItem(CLE_ACTIF) || null;
export const donneesSlot = (id) => lire(CLE_MOTEUR + ':' + id);

/** Résumé lisible d'une sauvegarde, pour la liste de la page d'accueil. */
export function resumeDe(d) {
  if (!d) return { neuve: true };
  const f = d.flags || {};
  const quetes = ['q_cat', 'q_crows', 'q_ghosts'].filter(q => f[q] >= 3).length;
  return {
    coeurs: Math.round((d.hp || 0) / 2 * 10) / 10, maxCoeurs: Math.round((d.maxHp || 12) / 2),
    tues: d.kills || 0, minutes: Math.round((d.time || 0) / 60), lieu: d.level || 'citadel',
    quetes, arc: !!f.bow, boss: !!f.bossDead, prince: !!f.princeFreed,
  };
}

export const LIEUX = { citadel: 'La citadelle', cave: 'Les galeries', house: 'Chez Camille', tavern: "L'estaminet", mage: 'Le vieux mage', chapelle: 'La chapelle' };

function majSlot(id, champs) {
  const l = slots(); const i = l.findIndex(s => s.id === id);
  if (i < 0) l.push({ id, nom: 'Partie', maj: Date.now(), ...champs }); else l[i] = { ...l[i], ...champs };
  poserSlots(l); return l;
}

// Trois personnages par joueur : au-delà, la liste de l'accueil ne tient plus d'un coup
// d'œil et le compte stocke des parties qu'on ne rouvre jamais.
export const MAX_SLOTS = 3;
export const slotsPleins = () => slots().length >= MAX_SLOTS;

/** Crée une partie vierge et la rend active. Renvoie null quand les trois places sont prises. */
export function creerSlot(nom) {
  if (slotsPleins()) return null;
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  majSlot(id, { nom: (nom || '').trim().slice(0, 24) || (compte() || {}).pseudo || 'Camille',
                maj: Date.now(), resume: { neuve: true } });
  try { localStorage.removeItem(CLE_MOTEUR + ':' + id); } catch (e) {}
  return id;
}

export function renommerSlot(id, nom) { majSlot(id, { nom: nom.trim() || 'Partie', maj: Date.now() }); }

export function supprimerSlot(id) {
  poserSlots(slots().filter(s => s.id !== id));
  try { localStorage.removeItem(CLE_MOTEUR + ':' + id); } catch (e) {}
  if (slotActif() === id) { try { localStorage.removeItem(CLE_ACTIF); localStorage.removeItem(CLE_MOTEUR); } catch (e) {} }
}

/** Range la sauvegarde du moteur dans le slot (appelé pendant la partie). */
export function capturer(id) {
  const brut = localStorage.getItem(CLE_MOTEUR);
  if (!brut) return null;
  try { localStorage.setItem(CLE_MOTEUR + ':' + id, brut); } catch (e) { return null; }
  let d = null; try { d = JSON.parse(brut); } catch (e) {}
  majSlot(id, { maj: Date.now(), resume: resumeDe(d) });
  return brut;
}

// ---------------------------------------------------------------------
//  Les instances ont leur propre sauvegarde
// ---------------------------------------------------------------------
// Une instance n'est pas une partie : on n'y joue ni l'intro ni les quêtes, et on ne
// veut surtout pas que la balade à plusieurs vienne écrire dans la progression solo.
// Chaque instance garde donc sa propre sauvegarde, sous `tloc_save_v2:inst:<CODE>`.
export const cleInstance = (code) => CLE_MOTEUR + ':inst:' + String(code).toUpperCase();

export function activerInstance(code) {
  const brut = localStorage.getItem(cleInstance(code));
  try {
    localStorage.removeItem(CLE_ACTIF);              // aucune partie solo n'est ouverte
    if (brut) localStorage.setItem(CLE_MOTEUR, brut); else localStorage.removeItem(CLE_MOTEUR);
  } catch (e) {}
}

export function capturerInstance(code) {
  const brut = localStorage.getItem(CLE_MOTEUR);
  if (!brut) return;
  try { localStorage.setItem(cleInstance(code), brut); } catch (e) {}
}

export function oublierInstance(code) { try { localStorage.removeItem(cleInstance(code)); } catch (e) {} }

/** Ouvre une partie : sa sauvegarde devient celle que le moteur lira. */
export function activer(id) {
  const brut = localStorage.getItem(CLE_MOTEUR + ':' + id);
  try {
    localStorage.setItem(CLE_ACTIF, id);
    if (brut) localStorage.setItem(CLE_MOTEUR, brut); else localStorage.removeItem(CLE_MOTEUR);
  } catch (e) {}
}

/** Première visite : récupère la sauvegarde d'avant les slots plutôt que de la perdre. */
export function reprendreAncienneSauvegarde() {
  renommerAncienne();
  if (slots().length) return null;
  const brut = localStorage.getItem(CLE_MOTEUR);
  if (!brut) return null;
  const id = creerSlot('Partie de test');
  try { localStorage.setItem(CLE_MOTEUR + ':' + id, brut); } catch (e) {}
  let d = null; try { d = JSON.parse(brut); } catch (e) {}
  majSlot(id, { maj: Date.now(), resume: resumeDe(d) });
  return id;
}

/** Une seule fois : l'ancienne sauvegarde reprise s'appelait « Ma partie », ce qui ne
 *  disait pas qu'elle vient d'avant les parties nommées. */
function renommerAncienne() {
  try {
    if (localStorage.getItem('tloc_nom_ancienne') === '1') return;
    localStorage.setItem('tloc_nom_ancienne', '1');
    const l = slots(); const s = l.find(x => x.nom === 'Ma partie');
    if (s) { s.nom = 'Partie de test'; poserSlots(l); }
  } catch (e) {}
}

// =====================================================================
//  Synchronisation avec le compte
// =====================================================================
export async function pousser(id) {
  if (!connecte()) return;
  const s = slots().find(x => x.id === id); if (!s) return;
  const brut = localStorage.getItem(CLE_MOTEUR + ':' + id); if (!brut) return;
  await appel('/api/parties/' + id, {
    method: 'PUT',
    body: JSON.stringify({ nom: s.nom, donnees: JSON.parse(brut), resume: s.resume || {} }),
  });
}

/** Rapatrie les parties du compte et fusionne avec les parties locales (la plus récente gagne). */
export async function synchroniser() {
  if (!connecte()) return slots();
  const distantes = await appel('/api/parties');
  const locales = slots();
  for (const d of distantes) {
    const l = locales.find(s => s.id === d.id);
    const majD = d.maj * 1000;
    if (!l || majD > (l.maj || 0) + 2000) {
      const p = await appel('/api/parties/' + d.id);
      try { localStorage.setItem(CLE_MOTEUR + ':' + d.id, JSON.stringify(p.donnees)); } catch (e) {}
      majSlot(d.id, { nom: p.nom, maj: majD, resume: p.resume || resumeDe(p.donnees) });
    }
  }
  const ids = new Set(distantes.map(d => d.id));
  for (const l of slots()) {
    if (!ids.has(l.id) && localStorage.getItem(CLE_MOTEUR + ':' + l.id)) { try { await pousser(l.id); } catch (e) {} }
  }
  return slots();
}

export async function supprimerPartout(id) {
  supprimerSlot(id);
  if (connecte()) { try { await appel('/api/parties/' + id, { method: 'DELETE' }); } catch (e) {} }
}

// =====================================================================
//  Instances multijoueur
// =====================================================================
export const instance = () => lire(CLE_INSTANCE);
export const poserInstance = (i) => (i ? ecrire(CLE_INSTANCE, i) : localStorage.removeItem(CLE_INSTANCE));
export const creerInstance = (nom, mode = 'libre', enjeu = false, bots = 0, niveau = 'soldat', regle = 'balade', vies = 1, duree = 180) =>
  appel('/api/instances', { method: 'POST', body: JSON.stringify({ nom, mode, enjeu, bots, niveau, regle, vies, duree }) });
/** Les badges d'honneur : tous, avec le nombre de fois où le compte les a gagnés. */
export const badges = () => appel('/api/badges');

// =====================================================================
//  Le social : profil, amis, conversations
// =====================================================================
const corps = (o) => ({ body: JSON.stringify(o) });
export const profil = () => appel('/api/profil');
export const majProfil = (champs) => appel('/api/profil', { method: 'PUT', ...corps(champs) });
export const chercherJoueurs = (q) => appel('/api/joueurs?q=' + encodeURIComponent(q));
export const amis = () => appel('/api/amis');
export const demanderAmi = (id) => appel('/api/amis/' + id, { method: 'POST', ...corps({}) });
export const retirerAmi = (id) => appel('/api/amis/' + id, { method: 'DELETE' });
export const convs = () => appel('/api/convs');
export const creerConv = (membres, nom = null) => appel('/api/convs', { method: 'POST', ...corps({ membres, nom }) });
export const messages = (cid, apres = 0) => appel(`/api/convs/${cid}/messages?apres=${apres}`);
export const envoyerMessage = (cid, texte, invitation = null) =>
  appel(`/api/convs/${cid}/messages`, { method: 'POST', ...corps({ texte, invitation }) });
export const nonLus = () => appel('/api/non-lus');
export const createur = () => appel('/api/createur');
/** Prod, dev ou local — et, sur le dev, les deux versions et le droit de promouvoir. */
export const env = () => appel('/api/env');
/** Les chiffres du jeu (créateur seulement). */
export const admin = () => appel('/api/admin');
export const promotion = (action = 'promouvoir') => appel('/api/promotion', { method: 'POST', body: JSON.stringify({ action }) });
export const mesInstances = () => appel('/api/instances');
export const voirInstance = (code) => appel('/api/instances/' + encodeURIComponent(code.toUpperCase()));
export const rejoindreInstance = (code) => appel('/api/instances/' + encodeURIComponent(code.toUpperCase()) + '/rejoindre', { method: 'POST' });
export const quitterInstance = (code) => appel('/api/instances/' + encodeURIComponent(code.toUpperCase()), { method: 'DELETE' });

export function urlSalon(code, perso) {
  const base = API || location.origin;
  return base.replace(/^http/, 'ws') + '/ws/' + code.toUpperCase()
    + '?jeton=' + encodeURIComponent((compte() || {}).jeton || '')
    + '&perso=' + encodeURIComponent(perso || nomPersonnage());
}

/** Le nom de la partie ouverte EST le nom du personnage : c'est lui que les autres
 *  joueurs lisent au-dessus de sa tête. À défaut, le pseudo du compte. */
export function nomPersonnage(id = slotActif()) {
  const s = slots().find(x => x.id === id);
  return (s && s.nom) || (compte() || {}).pseudo || 'Camille';
}
