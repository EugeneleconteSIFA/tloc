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

export const LIEUX = { citadel: 'La citadelle', cave: 'Les galeries', house: 'Chez Camille', tavern: "L'estaminet", mage: 'Le vieux mage', chapelle: 'La chapelle',
  // les mondes de l'histoire (13 octobre : la carte d'une partie disait « thailande », le nom du niveau)
  temple: "L'île du temps", aveyron: 'Le lac de Saint-Gervais', pouget: 'Le Pouget', thailande: 'La baie des pitons', gallipoli: 'Gallipoli',
  matera: 'Matera', alberobello: 'Alberobello', villefort: 'Villefort', gardeguerin: 'La Garde-Guérin', lac: 'Le lac de Villefort', rive: 'La rive oubliée' };

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
    // on entre dans la partie dès le chargement fini : le menu titre (« Nouvelle partie ») n'y
    // avait pas de sens (Eugène, 30 septembre) — cf. engine.js, tloc_auto = 'instance'
    sessionStorage.setItem('tloc_auto', 'instance');
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

// LA REMISE À ZÉRO DU SOLO (15 octobre) : le serveur a effacé les parties et en donne la date
// (/api/env, remise_solo). Ce navigateur vide alors les siennes, celles d'avant — sinon
// synchroniser() les renverrait au compte. Les sauvegardes des instances (:inst:) restent.
// Rend vrai quand il a fallu vider : la page appelante se recharge ou repart à l'accueil.
const CLE_REMISE = 'tloc_remise_solo';
export async function appliquerRemiseSolo() {
  let t = 0; try { t = Number((await env()).remise_solo) || 0; } catch (e) { return false; }
  const vue = Number(localStorage.getItem(CLE_REMISE)) || 0;
  if (!t || t <= vue) return false;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k === CLE_SLOTS || k === CLE_ACTIF || (k.startsWith(CLE_MOTEUR + ':') && !k.startsWith(CLE_MOTEUR + ':inst:'))) localStorage.removeItem(k);
    }
    if (!lire(CLE_INSTANCE)) localStorage.removeItem(CLE_MOTEUR);   // en instance, c'est la copie de l'instance
    localStorage.setItem(CLE_REMISE, String(t));
  } catch (e) {}
  return true;
}

export async function supprimerPartout(id) {
  supprimerSlot(id);
  if (connecte()) { try { await appel('/api/parties/' + id, { method: 'DELETE' }); } catch (e) {} }
}

// =====================================================================
//  Instances multijoueur
// =====================================================================
// Les ARÈNES du multi (5 octobre) : où se joue une instance, et la page qui la charge. La
// géométrie de chacune est déclarée par son lieu (`arenes` de l'objet niveau : game.js,
// garde-guerin.js, pouget.js) ; ce catalogue ne dit que le nom et la page. Le serveur n'accepte
// que ces identifiants (NouvelleInstance.arene, app.py).
// `picto` : son emblème, tracé au trait comme les icônes de l'accueil (13 octobre : la vue 3D jurait dans la ligne de
// l'étape, dessinée à plat) ; `vignette` : une vue de l'arène (bancs/multi-vignettes.mjs) ; `pastilles` : sa taille, puis ce qu'elle
// déclare dans son lieu (bannières, fête, forge, portes) et ses bornes (ARENES_MAX, app.py) — redits ici à
// la main, comme le serveur les tient à la main : l'accueil ne charge pas les lieux
export const ARENES = {
  lille: { picto: '<path d="M3 21V8h3V5h3v3h6V5h3v3h3v13"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>', lieu: 'citadel', vignette: 'vignettes/arene-lille.jpg', pastilles: ['quartier', 'bannières', 'fête', 'forge'], nom: 'La citadelle de Lille', page: 'index.html', dit: 'les bastions, la place d’Armes, la herse baissée' },
  gardeguerin: { picto: '<path d="M7 21V6h10v15"/><path d="M7 6V3h2v3M11 6V3h2v3M15 6V3h2v3"/><path d="M11 21v-4h2v4"/><path d="M3 21h18"/>', lieu: 'gardeguerin', vignette: 'vignettes/arene-gardeguerin.jpg', pastilles: ['village', 'bannières'], nom: 'La Garde-Guérin', page: 'garde-guerin.html', dit: 'le village-forteresse : sa tour, ses ruelles, son enceinte' },
  pouget: { picto: '<path d="M12 3c-3 0-5 2-5 4.2C5 7.6 3.5 9.2 3.5 11.2 3.5 13.4 5.3 15 7.5 15h9c2.2 0 4-1.6 4-3.8 0-2-1.5-3.6-3.5-4C17 5 15 3 12 3z"/><path d="M10.5 15v4.5L8.5 21M13.5 15v4.5l2 1.5"/><path d="M12 15v-2.5l-2-1.5M12 12.5l2.2-1.5"/>', lieu: 'pouget', vignette: 'vignettes/arene-pouget.jpg', pastilles: ['hameau', 'bannières'], nom: 'Le Pouget', page: 'pouget.html', dit: 'le hameau de granit sur sa pente, de muret en muret' },
  batut: { picto: '<path d="M2 20v-7l5-4 5 4v7"/><path d="M12 20v-7l5-4 5 4v7"/><path d="M5.5 20v-3h3v3M15.5 20v-3h3v3"/>', lieu: 'aveyron', vignette: 'vignettes/arene-batut.jpg', pastilles: ['maisons', 'portes', 'bannières'], nom: 'Le Batut et Beauregard', page: 'batut.html', dit: 'deux maisons et un jardin : on se bat de pièce en pièce, on se cache' },
  panyi: { picto: '<path d="M5 12h14"/><path d="M6 12V9l6-5 6 5v3"/><path d="M8 12v5M16 12v5"/><path d="M2 20c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0"/>', lieu: 'thailande', vignette: 'vignettes/arene-panyi.jpg', pastilles: ['village sur l’eau'], nom: 'Ko Panyi', page: 'thailande.html', dit: 'le village sur pilotis de la baie des pitons : de passerelle en passerelle, jusqu’au marché flottant' },
  gallipoli: { picto: '<path d="M4 20h16"/><path d="M6 20v-6h12v6"/><path d="M8 14a4 4 0 0 1 8 0"/><path d="M12 10V6M10.5 7.5h3"/>', lieu: 'gallipoli', vignette: 'vignettes/arene-gallipoli.jpg', pastilles: ['vieille ville'], nom: 'Gallipoli', page: 'gallipoli.html', dit: 'la vieille ville sur son île : ses ruelles blanches, ses palais, le parvis du Duomo' },
  alberobello: { picto: '<path d="M6 20v-6h12v6"/><path d="M6 14l6-10 6 10"/><path d="M12 4V2"/><path d="M10.5 20v-3h3v3"/>', lieu: 'alberobello', vignette: 'vignettes/arene-alberobello.jpg', pastilles: ['quartier'], nom: 'Alberobello', page: 'alberobello.html', dit: 'le Rione Monti : des ruelles en pente entre les trulli, cônes de pierre et murs blancs' },
  estaminet: { picto: '<path d="M6 9h9v11H6z"/><path d="M15 12h2a2 2 0 0 1 0 4h-2"/><path d="M6 9c0-2 2-3 4-2 1-2 4-2 5 0"/>', lieu: 'tavern', vignette: 'vignettes/arene-estaminet.jpg', pastilles: ['salle', '4 au plus'], nom: 'L’estaminet', page: 'tavern.html', dit: 'la bagarre de taverne, quatre au plus : le zinc, les tables, l’âtre' },
  roquette: { picto: '<path d="M4 21V10l8-6 8 6v11"/><path d="M10 21v-5h4v5"/><path d="M8 12h2M14 12h2"/>', lieu: 'aveyron', vignette: 'vignettes/arene-roquette.jpg', pastilles: ['maison', '6 au plus'], nom: 'La maison du Batut', page: 'aveyron.html', dit: 'la vraie maison des Roquette, au bord du lac : ses pièces, son étage, sa cour' },
  matera: { picto: '<path d="M3 21h18"/><path d="M3 21v-4h5v-4h5v-4h5V5h3"/><path d="M5 17v-2M10 13v-2M15 9V7"/>', lieu: 'matera', vignette: 'vignettes/arene-matera.jpg', pastilles: ['gradins'], nom: 'Matera', page: 'matera.html', dit: 'les Sassi en gradins : des maisons sur les toits des autres, des ruelles en escalier' },
};
// `lieu` : le niveau du solo qui la découvre (13 octobre, Eugène : on ne choisit que les arènes des lieux déjà vus en
// solo). Les parties solo de ce navigateur (la clé du moteur et ses copies, une par partie) gardent chacune la liste
// des niveaux visités (`levels`) : un lieu vu dans l'une d'elles ouvre son arène. Lille est toujours ouverte.
export function lieuxDecouverts() {
  const vus = new Set(['citadel']);
  try { for (const k of Object.keys(localStorage)) { if (k !== CLE_MOTEUR && !k.startsWith(CLE_MOTEUR + ':')) continue;
    if (k.startsWith(CLE_MOTEUR + ':inst:')) continue;           // (une partie à plusieurs ne découvre rien du solo)
    const d = JSON.parse(localStorage.getItem(k) || 'null'); if (!d) continue; if (d.level) vus.add(d.level); for (const n of Object.keys(d.levels || {})) vus.add(n); } } catch (e) {}
  return vus;
}
export const areneOuverte = (id, vus = lieuxDecouverts()) => !!ARENES[id] && vus.has(ARENES[id].lieu);
export const pageArene = (id) => (ARENES[id] || ARENES.lille).page;
export const instance = () => lire(CLE_INSTANCE);
export const poserInstance = (i) => (i ? ecrire(CLE_INSTANCE, i) : localStorage.removeItem(CLE_INSTANCE));
export const creerInstance = (nom, mode = 'libre', enjeu = false, bots = 0, niveau = 'soldat', regle = 'balade', vies = 1, duree = 180, arene = 'lille') =>
  appel('/api/instances', { method: 'POST', body: JSON.stringify({ nom, mode, enjeu, bots, niveau, regle, vies, duree, arene }) });
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
