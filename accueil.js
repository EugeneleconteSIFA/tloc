// accueil.js — l'accueil du compte : les parties et les instances.
// La connexion, elle, se fait sur le portail (connexion.html).
import * as C from './tloc-compte.js?v=2';
import * as SOCIAL from './accueil-social.js?v=2';

const $ = (id) => document.getElementById(id);
const ECH = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let partiePrete = null;        // la partie créée qui attend qu'on y entre (cf. montrerPartiePrete)
// LE SOLO, RÉSERVÉ AU CRÉATEUR tant qu'il le prépare (Eugène, 30 septembre). Fermé par défaut,
// il ne s'ouvre qu'une fois que le serveur a dit « c'est le créateur » ; la page de jeu lit le
// même feu vert (tloc_solo_ouvert, cf. tloc-multi.js) et renvoie ici sans lui.
function ouvrirSolo(oui) {
  const t = document.querySelector('.mode-solo'); if (t) t.classList.toggle('solo-bloque', !oui);
  const l = document.getElementById('parties'); if (l) l.classList.toggle('cache', !oui);
  try { localStorage.setItem('tloc_solo_ouvert', oui ? '1' : '0'); } catch (e) {}
}

// Les messages ne s'écrivent plus dans la page : posés sur la vitrine, ils tombaient sur les
// façades et ne se lisaient plus. Ils surgissent en toast ; `el`, lui, reste vide.
function message(el, texte, type = 'erreur') {
  el.className = 'msg'; el.textContent = '';
  if (texte) toast(texte, { erreur: type === 'erreur', duree: type === 'erreur' ? 6000 : 4000 });
}

// Un retour bref, en bas de l'écran. `action` = { libelle, fn } ajoute un bouton (Annuler) ;
// `fin` est appelé quand le toast disparaît sans que l'action ait servi.
function toast(texte, { erreur = false, action = null, duree = 4000, fin = null } = {}) {
  const t = document.createElement('div');
  t.className = 'toast' + (erreur ? ' erreur' : '');
  if (erreur) t.setAttribute('role', 'alert');
  // une erreur se ferme aussi à la main : on ne force personne à attendre qu'elle parte
  if (erreur && !action) action = { libelle: 'Fermer', fn: () => {} };
  t.innerHTML = `${erreur ? '<svg class="toast-icone" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18v.5"/></svg>' : ''}<span></span>${action ? `<button type="button">${ECH(action.libelle)}</button>` : ''}`;
  t.querySelector('span').textContent = texte;
  let fait = false;
  const fermer = (parAction) => {
    if (fait) return; fait = true; t.remove();
    if (!parAction && fin) fin();
  };
  if (action) t.querySelector('button').onclick = () => { fermer(true); action.fn(); };
  $('toasts').appendChild(t);
  setTimeout(() => fermer(false), duree);
  return fermer;
}

// Un bouton qui lance une navigation : on le fige tout de suite, sinon le second clic
// d'un joueur impatient relance tout.
function occuper(b, texte = 'Ouverture…') {
  if (!b) return;
  b.disabled = true; b.setAttribute('aria-busy', 'true');
  b.lastChild.textContent = texte;
}

// Icônes au trait, dessinées ici plutôt qu'en fichiers : elles prennent la couleur du texte
// (currentColor), donc l'état survolé ou désactivé d'un bouton les teinte sans CSS de plus.
const TRAITS = {
  jouer: '<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>',
  crayon: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  poubelle: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  perso: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  arc: '<path d="M6 3c8 3 8 15 0 18"/><path d="M6 3v18"/>',
  epee: '<path d="M14 4h6v6L9 21l-6-6z"/><path d="M5 13l6 6"/>',
  couronne: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
};
const icone = (n, t = 18) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAITS[n]}</svg>`;

// l'écu de brique frappé de l'initiale : on reconnaît une partie d'un coup d'œil, sans lire
const ecu = (nom) => `<div class="ecu" aria-hidden="true"><svg viewBox="0 0 40 46"><path d="M2 2h36v20c0 12-9 19-18 22C11 41 2 34 2 22z" fill="#9C3B28" stroke="#E2B25A" stroke-width="1.5"/><path d="M2 12h36" stroke="#EDE3CC" stroke-opacity=".35"/></svg><span>${ECH((String(nom || '?').trim()[0] || '?').toUpperCase())}</span></div>`;

function coeurs(r) {
  const max = Math.max(1, r.maxCoeurs || 6), pleins = Math.max(0, Math.min(max, Math.round(r.coeurs || 0)));
  const c = '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>';
  let h = '';
  for (let i = 0; i < max; i++) h += `<svg viewBox="0 0 24 24" fill="${i < pleins ? '#E86A55' : 'none'}" stroke="#E86A55" stroke-width="2" aria-hidden="true">${c}</svg>`;
  return `<span class="coeurs" role="img" aria-label="${pleins} cœurs sur ${max}">${h}</span>`;
}

function depuis(t) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} jours`;
}

// =====================================================================
//  Compte
// =====================================================================
// Sans session ouverte et sans choix explicite de jouer en local, on renvoie au portail.
const local = (() => { try { return localStorage.getItem('tloc_local') === '1'; } catch (e) { return false; } })();
if (!C.connecte() && !local) location.replace('connexion.html');
ouvrirSolo(false);
if (C.connecte()) C.profil().then((p) => ouvrirSolo(!!(p && p.createur))).catch(() => {});

function peindreCompte() {
  const c = C.compte();
  const barre = $('barreCompte');
  if (c) {
    // « Mon compte » : les badges d'honneur gagnés en manche, et la déconnexion — un geste
    // rare n'a pas à tenir la barre
    barre.innerHTML = `<details class="menu-compte" id="monCompte">
      <summary aria-label="Mon compte, ${ECH(c.pseudo)}"><span class="avatar" id="avatarCompte">${ECH(c.pseudo[0] || '?').toUpperCase()}</span><span class="pseudo">Mon compte</span><span class="compte-total cache" id="nbDemandes" title="Demandes d’ami"></span>${icone('chevron', 16)}</summary>
      <div class="menu compte">
        <!-- l'accueil du compte : qui je suis, en un coup d'œil ; le détail est dans les sections -->
        <div class="compte-accueil" id="compteAccueil"><p class="sous-titre">Chargement…</p></div>
        <nav class="nav-compte" role="tablist" aria-label="Mon compte">
          <button role="tab" aria-selected="false" data-onglet="infos">Infos perso</button>
          <button role="tab" aria-selected="false" data-onglet="amis">Amis</button>
          <button role="tab" aria-selected="false" data-onglet="badges">Badges <span class="compte-total cache" id="totalBadges"></span></button>
          <button role="tab" aria-selected="false" data-onglet="admin" class="cache" id="ongletAdmin">Admin</button>
          <button role="tab" aria-selected="false" data-onglet="version" class="cache" id="ongletVersion">Version</button>
        </nav>
        <section data-panneau="infos" id="panneauInfos" role="tabpanel" hidden></section>
        <section data-panneau="amis" id="panneauAmis" role="tabpanel" hidden></section>
        <section data-panneau="badges" role="tabpanel" hidden>
                    <ul class="badges" id="listeBadges"><li class="vide" style="grid-column:1/-1">Chargement…</li></ul>
        </section>
        <section data-panneau="admin" id="panneauAdmin" role="tabpanel" hidden></section>
        <section data-panneau="version" id="panneauVersion" role="tabpanel" hidden></section>
        <button class="fantome" id="seDeconnecter">Se déconnecter</button>
      </div>
    </details>`;
    $('seDeconnecter').onclick = async () => { await C.deconnexion(); location.href = 'connexion.html'; };
    // Le compte s'ouvre sur son accueil (photo, nom, badges, amis) ; une section se déplie
    // quand on la choisit — et se replie si on la rechoisit. Chacune se charge à l'ouverture :
    // ce qu'on y lit est toujours frais.
    const charger = { infos: SOCIAL.chargerInfos, amis: SOCIAL.chargerAmis, badges: chargerBadges,
                      admin: SOCIAL.chargerAdmin, version: SOCIAL.chargerVersion };
    let onglet = null;
    const montrer = (o) => {
      onglet = onglet === o ? null : o;
      barre.querySelectorAll('[data-onglet]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.onglet === onglet)));
      barre.querySelectorAll('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== onglet; });
      if (onglet) charger[onglet]();
    };
    SOCIAL.surOnglet(montrer);              // les chiffres de l'accueil du compte ouvrent leur section
    barre.querySelectorAll('[data-onglet]').forEach((b) => { b.onclick = () => montrer(b.dataset.onglet); });
    $('monCompte').addEventListener('toggle', () => { if ($('monCompte').open) SOCIAL.chargerAccueilCompte(); });
    chargerBadges();
    if (!document.getElementById('bulleChat')) { SOCIAL.demarrerChat({ toast }); SOCIAL.brancherBandeau(); }
    $('carteInstances').classList.remove('cache');
    $('carteLocale').classList.add('cache');
  } else {
    barre.innerHTML = '<a class="bouton" href="connexion.html">Se connecter</a>';
    $('carteInstances').classList.add('cache');
    $('carteLocale').classList.remove('cache');
  }
  // sans compte, pas d'instance : la liste resterait un titre au-dessus du vide
  $('plusieurs').classList.toggle('cache', !c);
}

// Les badges : leur nom, leur phrase, leur famille et leur rang viennent du serveur (une seule
// source) ; ici, leur médaille. Classés par famille puis du commun au légendaire ; ceux qui
// restent à gagner sont montrés en gris avec ce qu'il faut faire : on sait ce qu'on peut viser.
const MEDAILLES = {
  badaud: '<circle cx="12" cy="7" r="3"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>',
  vainqueur: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  premiere_lame: '<path d="M14 4h6v6L9 21l-6-6z"/><path d="M5 13l6 6"/>',
  faucheur: '<path d="M4 20L14 6"/><path d="M14 6c3-2 6-2 7 1-3 0-5 1-7 3"/>',
  vengeur: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>',
  opportuniste: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  bourrin: '<path d="M6 11V7a2 2 0 0 1 4 0v3M10 10V6a2 2 0 0 1 4 0v4M14 10V7a2 2 0 0 1 4 0v6c0 4-3 7-7 7s-6-3-6-6v-2a2 2 0 0 1 4 0"/>',
  increvable: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  tete_brulee: '<path d="M12 21c-4 0-6-3-6-6 0-4 3-5 3-9 3 2 4 4 4 6 1-1 2-2 2-4 3 2 5 5 5 8 0 3-3 5-8 5z"/>',
  oeil_de_lynx: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  chevalier: '<path d="M7 21l1.5-6.5L5 12l4-7 3 1 5 3 1 4-4-1-1.5 9z"/>',
  fleau: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  intouchable: '<path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
  porte_etendard: '<path d="M5 22V3"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  conquerant: '<path d="M4 21V4"/><path d="M4 5h8l-2 3 2 3H4"/><path d="M14 21V9"/><path d="M14 10h6l-1.5 2.5L20 15h-6"/>',
  rempart: '<path d="M4 21V8h3V5h3v3h4V5h3v3h3v13z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  globe_trotteur: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  promeneur: '<path d="M8 3c2 0 2.5 3 2 6H6c-.5-3 0-6 2-6z"/><path d="M6 12h4v2a2 2 0 0 1-4 0z"/><path d="M16 8c2 0 2.5 3 2 6h-4c-.5-3 0-6 2-6z"/><path d="M14 17h4v2a2 2 0 0 1-4 0z"/>',
  pelerin: '<path d="M9 22L15 3"/><circle cx="15.5" cy="4" r="2"/><path d="M11 14c2 0 4 1 5 3"/>',
  aventurier: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  arpenteur: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  archere: '<path d="M6 3c8 3 8 15 0 18"/><path d="M6 3v18"/><path d="M4 12h14l-3-3M18 12l-3 3"/>',
  ami_des_chats: '<path d="M5 20v-9l-1-6 4 3h8l4-3-1 6v9z"/><path d="M9 13h.01M15 13h.01M10 16h4"/>',
  chasse_corbeaux: '<path d="M2 12c4-1 6-5 10-5 3 0 5 2 5 4l5 1-5 2c-1 3-4 5-8 5l2-4c-4 0-7-1-9-3z"/>',
  exorciste: '<path d="M5 21V10a7 7 0 0 1 14 0v11l-2.5-2-2.5 2-2-2-2 2-2.5-2z"/><path d="M9.5 10h.01M14.5 10h.01"/>',
  guetteur: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  tombeur: '<path d="M5 19L19 5"/><path d="M19 5c0 4-2 7-6 7"/><path d="M5 19l-2 2M8 16l-3-3"/>',
  liberateur: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  habitue: '<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 11h2a2 2 0 0 1 0 4h-2"/><path d="M6 5c1-2 3-2 4 0 1-2 3-2 4 0"/>',
  pilier: '<path d="M4 21h16M5 3h14M7 3v18M17 3v18M12 3v18"/>',
  champion: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>',
  legende: '<path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z"/><path d="M4 21h16"/>',
};
const RANGS = ['commun', 'rare', 'epique', 'legendaire'];
const NOM_RANG = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
// ce qui reste à parcourir, dans l'unité qui parle : les mètres en kilomètres
const avance = (b) => (b.id in { promeneur: 1, pelerin: 1, aventurier: 1, arpenteur: 1 }
  ? `${(Math.min(b.val, b.but) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} / ${Math.round(b.but / 1000)} km`
  : `${Math.min(b.val, b.but)} / ${b.but}`);
async function chargerBadges() {
  let liste;
  try { liste = await C.badges(); } catch (e) { $('listeBadges').innerHTML = `<li style="grid-column:1/-1">${ECH(e.message)}</li>`; return; }
  const total = liste.reduce((t, b) => t + b.n, 0);
  $('totalBadges').textContent = String(total);
  $('totalBadges').classList.toggle('cache', !total);
  const familles = [];
  for (const b of liste) if (!familles.includes(b.famille)) familles.push(b.famille);
  $('listeBadges').innerHTML = familles.map((f) => {
    const siens = liste.filter((b) => b.famille === f).sort((a, b) => RANGS.indexOf(a.rang) - RANGS.indexOf(b.rang));
    const gagnes = siens.filter((b) => b.n).length;
    // les styles de jeu te disent quel joueur tu as été ; le reste, ce sont des récompenses
    const entete = f === 'style' ? '<li class="sorte-badges" style="grid-column:1/-1">Tes styles de jeu<small>Un par manche : ce qui t’a le plus distingué.</small></li>'
      : f === familles.find((x) => x !== 'style') ? '<li class="sorte-badges" style="grid-column:1/-1">Récompenses<small>En plus du style : exploits de manche, et hauts faits qui se débloquent une fois.</small></li>' : '';
    // la famille « styles » a déjà son grand titre : seul le compte s'y ajoute
    return entete + `<li class="famille-badges" style="grid-column:1/-1">${f === 'style' ? '' : ECH(siens[0].nom_famille)} <span>${gagnes} / ${siens.length}</span></li>`
      + siens.map((b) => {
        const multiple = b.but === undefined;          // exploit de manche : se regagne ; haut fait : une fois
        return `<li class="badge rang-${b.rang}${b.n ? '' : ' vide'}" title="${ECH(b.desc)}">
          <span class="medaille"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MEDAILLES[b.id] || ''}</svg></span>
          <span><b>${ECH(b.nom)}</b><span class="rang">${NOM_RANG[b.rang]}</span><small>${ECH(b.desc)}</small>
            ${!multiple && !b.n && b.but > 1 ? `<span class="progres"><i style="width:${Math.min(100, 100 * b.val / b.but)}%"></i></span><span class="avance">${avance(b)}</span>` : ''}</span>
          ${b.n && multiple ? `<span class="fois" aria-label="${b.n} fois">×${b.n}</span>` : ''}
        </li>`;
      }).join('');
  }).join('');
}

// un clic hors du menu du compte le referme, comme tout menu déroulant
document.addEventListener('click', (e) => {
  const m = document.querySelector('.menu-compte[open]');
  if (m && !m.contains(e.target)) m.open = false;
});

// =====================================================================
//  Parties
// =====================================================================
function ligneResume(r) {
  if (!r || r.neuve) return 'Pas encore commencée';
  const bouts = [C.LIEUX[r.lieu] || r.lieu];
  if (r.minutes) bouts.push(`${r.minutes} min`);
  return bouts.join(' · ');
}

// La partie à reprendre : celle qu'on jouait en dernier, sinon la plus récente.
function aReprendre(l) {
  const actif = C.slotActif();
  return l.find(s => s.id === actif) || l[0] || null;
}

function jouerPartie(id, bouton) {
  if (SOCIAL.surMobile) return SOCIAL.montrerOrdinateur();
  occuper(bouton);
  C.activer(id); C.poserInstance(null);
  sessionStorage.setItem('tloc_entree', '1'); location.href = 'index.html';   // cf. index.html : on entre par l'accueil
}

// Une partie qu'on vient de supprimer reste récupérable quelques secondes : elle disparaît
// de la liste tout de suite, mais la sauvegarde n'est effacée qu'à la fin du délai. Si le
// joueur quitte la page avant, rien n'est effacé — c'est l'erreur la moins grave des deux.
const enSuppression = new Set();

function peindreReprendre(s) {
  const zone = $('reprendre');
  // première visite : rien à reprendre, la tuile ne garde que « Nouvelle partie », en or
  $('nouvellePartie').classList.toggle('plein', !s);
  if (SOCIAL.surMobile) $('nouvellePartie').textContent = 'Créer';
  zone.closest('.mode-solo').classList.toggle('premiere', !s);
  if (!s) { zone.innerHTML = '<p class="accroche">Phinaert a enlevé Eugène. Donne un nom à ton personnage et pars le délivrer.</p>'; return; }
  const r = s.resume || {};
  zone.innerHTML = `<div class="reprendre">
    <div class="qui">${ecu(s.nom)}
      <div style="min-width:0"><span class="quand">${s.maj ? depuis(s.maj) : 'Dernière partie'}</span>
        <div class="nom">${ECH(s.nom)}</div>
        <div class="infos">${r.neuve ? '' : coeurs(r)}<span class="aide" style="font-size:14px">${ligneResume(r)}</span></div>
      </div>
    </div>
    <div class="ou">${SOCIAL.surMobile
      // sur téléphone, pas de bouton qui ne mènerait nulle part : on dit où ça se passe
      ? '<span class="a-ordi">À reprendre sur ordinateur</span>'
      : `<button class="plein grand" id="btnReprendre" title="ou Entrée">${icone('jouer', 20)}${r.neuve ? 'Commencer' : 'Reprendre'}</button>`}</div>
  </div>`;
  if ($('btnReprendre')) $('btnReprendre').onclick = () => jouerPartie(s.id, $('btnReprendre'));
}

function peindreParties() {
  const l = C.slots().filter(s => !enSuppression.has(s.id)).sort((a, b) => (b.maj || 0) - (a.maj || 0));
  const actif = C.slotActif();
  const zone = $('listeParties');
  peindreReprendre(aReprendre(l));
  // la limite se voit avant qu'on la heurte : compteur « 2 / 3 », et la tuile « Seul »
  // remplace le champ par une phrase quand les trois places sont prises
  $('compteParties').textContent = `${l.length} / ${C.MAX_SLOTS}`;
  $('nouvellePartie').closest('.mode-solo').classList.toggle('complet', l.length >= C.MAX_SLOTS);
  if (!l.length) { zone.innerHTML = '<p class="vide">Aucune partie pour l’instant.</p>'; return; }
  zone.innerHTML = l.map(s => {
    const r = s.resume || {};
    return `
    <article class="partie${s.id === actif ? ' active' : ''}" data-id="${ECH(s.id)}">
      <div class="tete">${ecu(s.nom)}
        <div class="corps">
          <h3 class="titre">${ECH(s.nom)} ${s.id === actif ? '<span class="pastille">en cours</span>' : ''}</h3>
          ${r.neuve ? '' : coeurs(r)}
          <div class="infos">${ligneResume(r)}</div>
        </div>
      </div>
      <div class="actions">
        <button class="plein" data-act="jouer">${icone('jouer')}Jouer</button>
        <button class="icone" data-act="renommer" aria-label="Renommer ${ECH(s.nom)}" title="Renommer">${icone('crayon')}</button>
        <button class="icone danger" data-act="supprimer" aria-label="Supprimer ${ECH(s.nom)}" title="Supprimer">${icone('poubelle')}</button>
      </div>
    </article>`;
  }).join('');
  zone.querySelectorAll('button').forEach(b => {
    b.onclick = () => actionPartie(b.closest('.partie').dataset.id, b.dataset.act, b);
  });
}

// Renommer sur place : le nom devient un champ. Entrée ou un clic ailleurs enregistre,
// Échap annule — plus de boîte de dialogue du navigateur qui masque la carte.
function renommerSurPlace(id) {
  const s = C.slots().find(x => x.id === id);
  const carte = document.querySelector(`.partie[data-id="${CSS.escape(id)}"]`);
  if (!s || !carte) return;
  const titre = carte.querySelector('.titre');
  titre.innerHTML = `<input maxlength="24" aria-label="Nouveau nom de ${ECH(s.nom)}" value="${ECH(s.nom)}">`;
  const champ = titre.querySelector('input');
  champ.focus(); champ.select();
  let fini = false;
  const finir = async (garder) => {
    if (fini) return; fini = true;
    const nom = champ.value.trim();
    if (garder && nom && nom !== s.nom) {
      C.renommerSlot(id, nom); peindreParties();      // le nouveau nom se voit : pas de toast
      try { await C.pousser(id); } catch (e) {}
    } else peindreParties();
  };
  champ.onkeydown = (e) => {
    // stopPropagation : sans lui, l'Entrée qui valide le nom remonte jusqu'au raccourci
    // « Entrée = Reprendre » et lance le jeu
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finir(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finir(false); }
  };
  champ.onblur = () => finir(true);
}

async function actionPartie(id, act, bouton) {
  const s = C.slots().find(x => x.id === id);
  if (act === 'jouer') {
    jouerPartie(id, bouton);
  } else if (act === 'renommer') {
    renommerSurPlace(id);
  } else if (act === 'supprimer') {
    enSuppression.add(id); peindreParties();
    toast(`Partie de ${s ? s.nom : id} supprimée.`, {
      duree: 7000,
      action: { libelle: 'Annuler', fn: () => { enSuppression.delete(id); peindreParties(); } },
      fin: async () => { enSuppression.delete(id); await C.supprimerPartout(id); peindreParties(); },
    });
  }
}

// Entrée reprend la dernière partie — sauf quand on tape dans un champ ou qu'un bouton a
// le focus : là, Entrée garde son sens habituel.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.repeat) return;
  // la cible de la frappe, pas l'élément actif : un champ retiré du DOM pendant la frappe
  // laisse le focus sur <body>, et la touche passerait pour une Entrée « à vide »
  const f = e.target;
  if (f && f !== document.body && f.matches && f.matches('input, button, a, summary, textarea, select')) return;
  if (!f.isConnected) return;
  const b = $('btnReprendre');
  if (b) { e.preventDefault(); b.click(); }
});

// =====================================================================
//  Code d'instance : six cases
// =====================================================================
// Six cases plutôt qu'un champ : on voit ce qui manque, et coller un code ou un lien entier
// dans n'importe laquelle le répartit sur toutes.
const cases = [];
for (let i = 0; i < 6; i++) {
  const c = document.createElement('input');
  c.maxLength = 6;                 // 6 et non 1 : sinon le navigateur tronque un collage
  c.autocomplete = 'off'; c.spellcheck = false; c.inputMode = 'text';
  c.setAttribute('aria-label', `Caractère ${i + 1} sur 6`);
  $('codeCases').appendChild(c); cases.push(c);
}
const lireCode = () => cases.map(c => c.value).join('').toUpperCase();
// « Rejoindre » ne s'allume qu'avec un code complet : on voit d'avance qu'il manque un caractère
let mesInstances = [];            // la dernière liste reçue : pour reconnaître un code déjà rejoint
const INDICE_CODE = 'Colle le code ou le lien reçu : tu rejoins tout de suite.';
function majRejoindre() {
  const code = lireCode(), b = $('rejoindreInstance');
  const deja = code.length === 6 && mesInstances.find((x) => x.code === code);
  // un code qu'on a déjà rejoint : inutile de rejoindre encore, on propose d'entrer
  b.dataset.deja = deja ? code : '';
  b.classList.toggle('plein', !!deja && !SOCIAL.surMobile);
  b.textContent = deja ? (SOCIAL.surMobile ? 'Déjà dans ta liste' : 'Entrer') : 'Rejoindre';
  $('indiceCode').textContent = deja ? (SOCIAL.surMobile ? `« ${deja.nom} » est déjà dans ta liste.` : `Déjà dans la partie « ${deja.nom} ». Pour entrer :`) : INDICE_CODE;
  b.disabled = code.length !== 6 || (!!deja && SOCIAL.surMobile);
}
function poserCode(texte, depart = 0) {
  const propre = String(texte).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6 - depart);
  [...propre].forEach((ch, k) => { cases[depart + k].value = ch; });
  majRejoindre();
  const suivante = cases.findIndex(c => !c.value);
  // code complet : le focus passe au bouton, Entrée suffit pour rejoindre
  if (suivante < 0) $('rejoindreInstance').focus(); else cases[suivante].focus();
}
cases.forEach((c, i) => {
  c.addEventListener('input', () => {
    const v = c.value;
    c.value = '';
    if (v) poserCode(v, i);
  });
  c.addEventListener('paste', (e) => {
    const t = (e.clipboardData || window.clipboardData).getData('text') || '';
    e.preventDefault();
    const m = t.match(/#([A-Z0-9]{6})\b/i);          // un lien accueil.html#AB12CD collé
    if (m) { cases.forEach(x => { x.value = ''; }); poserCode(m[1]); } else poserCode(t, i);
    // un code collé en entier, c'est une invitation reçue : on rejoint sans autre clic
    if (lireCode().length === 6 && C.connecte() && !$('rejoindreInstance').dataset.deja) $('rejoindreInstance').click();
  });
  c.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !c.value && i > 0) { cases[i - 1].value = ''; cases[i - 1].focus(); majRejoindre(); e.preventDefault(); }
    else if (e.key === 'Backspace') setTimeout(majRejoindre);
    else if (e.key === 'ArrowLeft' && i > 0) cases[i - 1].focus();
    else if (e.key === 'ArrowRight' && i < 5) cases[i + 1].focus();
    else if (e.key === 'Enter') $('rejoindreInstance').click();
  });
  c.addEventListener('focus', () => c.select());
});

// =====================================================================
//  Instances
// =====================================================================
function peindreInstances(liste) {
  const zone = $('listeInstances');
  const encours = C.instance();
  // en instance, on ne joue pas une partie solo : juste un nom de personnage
  const defaut = (encours && encours.perso) || (C.compte() || {}).pseudo || 'Camille';
  if (!liste.length) { zone.innerHTML = '<p class="vide">Aucune instance pour l’instant.</p>'; return; }
  zone.innerHTML = liste.map(i => {
    const dedans = i.connectes || [];
    const places = i.places || 4;
    let sieges = '';
    for (let k = 0; k < places; k++) sieges += `<span class="${k < dedans.length ? 'pris' : ''}">${icone('perso')}</span>`;
    return `
    <article class="instance" data-code="${ECH(i.code)}">
      <div class="tete">
        <h4>${ECH(i.nom)} ${encours && encours.code === i.code ? '<span class="pastille vif">rejointe</span>' : ''}
          ${i.mode === 'equipes' ? '<span class="pastille">en équipes</span>' : ''}${i.regle === 'survie' ? ` <span class="pastille">match à mort · ${i.vies || 1} vie${(i.vies || 1) > 1 ? 's' : ''}</span>` : ''}${i.regle === 'temps' ? ` <span class="pastille">chrono · ${Math.round((i.duree || 180) / 60)} min</span>` : ''}${i.regle === 'drapeaux' ? ` <span class="pastille">drapeaux · ${Math.round((i.duree || 180) / 60)} min</span>` : ''}${i.bots ? ` <span class="pastille">${i.bots} bot${i.bots > 1 ? 's' : ''} · ${NOM_NIVEAU[i.niveau] || i.niveau}</span>` : ''}${Object.keys(ARENES).length > 1 && ARENES[i.arene] ? ` <span class="pastille">${ARENES[i.arene]}</span>` : ''}</h4>
        <span class="places" title="${dedans.length ? 'En jeu : ' + ECH(dedans.join(', ')) : 'Personne en ligne'}">
          <span class="sieges" aria-hidden="true">${sieges}</span>
          ${dedans.length}/${places}
        </span>
      </div>
      <div class="ligne">
        <button class="code" data-act="code" title="Copier le code" aria-label="Copier le code ${ECH(i.code)}">${ECH(i.code)}</button>
        <button class="fantome mini" data-act="lien">${icone('lien', 16)}Copier le lien</button>
      </div>
      <div class="actions">
        <div class="champ">
          <label for="perso-${ECH(i.code)}">Personnage</label>
          <input id="perso-${ECH(i.code)}" class="perso" maxlength="24" value="${ECH(defaut)}" placeholder="Camille">
        </div>
        <button class="plein" data-act="jouer">${icone('jouer')}Entrer</button>
        <button class="danger" data-act="quitter">Quitter</button>
      </div>
    </article>`;
  }).join('');
  zone.querySelectorAll('button').forEach(b => {
    b.onclick = () => actionInstance(b.closest('.instance').dataset.code, b.dataset.act, b);
  });
  zone.querySelectorAll('input.perso').forEach(inp => {
    inp.onkeydown = (e) => { if (e.key === 'Enter') inp.closest('.instance').querySelector('[data-act="jouer"]').click(); };
  });
}

const lienInstance = (code) => location.origin + location.pathname.replace(/[^/]*$/, 'accueil.html') + '#' + code;

// Copie le lien ; le bouton dit lui-même « Copié », là où le regard est déjà.
async function copierLien(code, bouton) {
  const lien = lienInstance(code);
  try { await navigator.clipboard.writeText(lien); }
  catch (e) { toast('Lien à partager : ' + lien, { duree: 12000 }); return false; }
  if (bouton) {
    const avant = bouton.innerHTML;
    bouton.textContent = 'Copié ✓';
    setTimeout(() => { if (bouton.isConnected) bouton.innerHTML = avant; }, 2000);
  }
  return true;
}

async function actionInstance(code, act, bouton) {
  if (act === 'lien') { copierLien(code, bouton); return; }
  if (act === 'code') { copierCode(code, bouton); return; }
  if (act === 'jouer' && SOCIAL.surMobile) return SOCIAL.montrerOrdinateur();
  if (act === 'jouer') occuper(bouton);
  const liste = await C.mesInstances().catch(() => []);
  const i = liste.find(x => x.code === code) || { code, nom: code };
  if (act === 'jouer') {
    const champ = document.querySelector(`.instance[data-code="${code}"] input.perso`);
    const perso = ((champ && champ.value) || '').trim().slice(0, 24)
      || (C.compte() || {}).pseudo || 'Camille';
    // une instance a sa propre sauvegarde : les parties solo ne bougent pas d'un pouce
    C.activerInstance(i.code);
    C.poserInstance({ code: i.code, nom: i.nom, perso });
    sessionStorage.setItem('tloc_entree', '1'); location.href = 'index.html';   // cf. index.html : on entre par l'accueil
  } else if (act === 'quitter') {
    if (!confirm('Quitter cette instance ? Si tu en es l’hôte, elle est fermée pour tout le monde.')) return;
    await C.quitterInstance(code).catch(() => {});
    C.oublierInstance(code);                         // et sa sauvegarde de balade
    const inst = C.instance(); if (inst && inst.code === code) C.poserInstance(null);
    await chargerInstances();
  }
}

let erreurListe = '';
async function chargerInstances() {
  if (!C.connecte()) return;
  // relancé toutes les 15 s : la même erreur ne resurgit pas à chaque tour
  try { mesInstances = await C.mesInstances(); peindreInstances(mesInstances); majRejoindre(); erreurListe = ''; }
  catch (e) { if (e.message !== erreurListe) { erreurListe = e.message; message($('msgInstances'), e.message); } }
}

// =====================================================================
//  Démarrage
// =====================================================================
async function tout() {
  peindreCompte();
  peindreParties();
  if (C.connecte()) {
    try { await C.synchroniser(); peindreParties(); } catch (e) { message($('msgParties'), e.message); }
    await chargerInstances();
  }
}

$('nomPartie').onkeydown = (e) => { if (e.key === 'Enter') $('nouvellePartie').click(); };
$('nomInstance').onkeydown = (e) => { if (e.key === 'Enter') $('creerInstance').click(); };

// Le prologue se rejoue à part : le jeu le lance sans lire ni écrire aucune sauvegarde
// (engine.js, tloc_auto = 'prologue'), puis ramène ici.
$('revoirPrologue').onclick = () => {
  if (SOCIAL.surMobile) return SOCIAL.montrerOrdinateur();
  C.poserInstance(null);
  sessionStorage.setItem('tloc_auto', 'prologue');
  sessionStorage.setItem('tloc_entree', '1'); location.href = 'index.html';   // cf. index.html : on entre par l'accueil
};

$('nouvellePartie').onclick = async () => {
  // une partie supprimée mais encore annulable occupe toujours sa place : créer, c'est
  // renoncer à l'annulation, donc on achève la suppression avant de compter
  if (C.slotsPleins() && enSuppression.size) {
    for (const id of [...enSuppression]) { enSuppression.delete(id); await C.supprimerPartout(id); }
    document.querySelectorAll('.toast').forEach(t => t.remove());
  }
  if (C.slotsPleins()) return message($('msgParties'), `Trois personnages au plus. Supprimes-en un pour en créer un autre.`);
  if (!SOCIAL.surMobile) occuper($('nouvellePartie'));
  const id = C.creerSlot($('nomPartie').value);
  $('nomPartie').value = '';
  C.activer(id);
  peindreParties();
  try { await C.pousser(id); } catch (e) {}
  // sur téléphone, le personnage est créé (et monte sur le compte) ; on y jouera sur ordinateur
  if (SOCIAL.surMobile) { toast(`${(C.slots().find((s) => s.id === id) || {}).nom || 'Ton personnage'} est prêt : joue-le sur ordinateur.`); return; }
  sessionStorage.setItem('tloc_entree', '1'); location.href = 'index.html';   // cf. index.html : on entre par l'accueil
};

// =====================================================================
//  Les bots : combien, et de quel niveau
// =====================================================================
// Douze joueurs au plus, bots compris : chaque bot prend une place. Avec onze bots, il ne
// reste que la sienne — c'est la partie « contre l'ordinateur ».
const NOM_NIVEAU = { recrue: 'recrue', soldat: 'soldat', veteran: 'vétéran' };
const PLACES_MODE = { libre: 4, equipes: 8 }, TOTAL_MAX = 12;
let nbBots = 0;
const modeChoisi = () => (document.querySelector('input[name="modeInstance"]:checked') || {}).value || 'libre';
const niveauChoisi = () => (document.querySelector('input[name="niveauBots"]:checked') || {}).value || 'soldat';
const regleChoisie = () => (document.querySelector('input[name="regleInstance"]:checked') || {}).value || 'balade';
const NOM_REGLE = { balade: 'balade', survie: 'match à mort', temps: 'chrono', drapeaux: 'prise des drapeaux' };
// Les arènes prêtes (5 octobre) : chacune est déclarée par son lieu (`arenes`, game.js pour
// Lille) et acceptée par le serveur (NouvelleInstance.arene). Une seule pour l'instant : pas
// de choix à montrer, on la dit seulement sur la partie. La deuxième amènera le sélecteur.
const ARENES = { lille: 'la citadelle de Lille' };
const areneChoisie = () => 'lille';
let nbVies = 1;
// la durée se règle à la minute près (5 par défaut) : quatre cases figées ne laissaient pas
// le choix (Eugène, 29 septembre). Le serveur accepte d'une à quinze minutes.
let nbMinutes = 5;
const dureeChoisie = () => nbMinutes * 60;
// chaque règle a son réglage à elle : les vies pour le match à mort, la durée pour le chrono
const TEXTE_REGLE = {
  balade: () => 'Sans fin ni score : on se promène et on se bat.',
  survie: () => `${nbVies > 1 ? nbVies + ' vies' : 'Une seule vie'} par manche : le dernier debout gagne.`,
  temps: () => `${dureeChoisie() / 60} minutes : mis à terre moins tombé, le meilleur gagne.`,
  drapeaux: () => `${dureeChoisie() / 60} minutes, en équipes : des drapeaux aux points forts de la carte, pris en tenant leur cercle. Le camp qui en tient le plus à la fin gagne.`,
};
function majBots() {
  // La prise des drapeaux se joue à deux camps (le serveur l'impose) : on la choisit
  // d'abord, elle coche « En équipes » et fige « Chacun pour soi ». Une version à chacun
  // pour soi reste à inventer.
  const drapeaux = regleChoisie() === 'drapeaux';
  if (drapeaux) document.querySelector('input[name="modeInstance"][value="equipes"]').checked = true;
  document.querySelector('input[name="modeInstance"][value="libre"]').disabled = drapeaux;
  $('choixLibre').classList.toggle('fige', drapeaux);
  $('petitLibre').textContent = drapeaux ? 'pas pour les drapeaux' : "jusqu'à 4 joueurs";
  nbVies = Math.max(1, Math.min(5, nbVies));
  $('nbVies').value = $('nbVies').textContent = String(nbVies);
  $('viesMoins').disabled = nbVies <= 1; $('viesPlus').disabled = nbVies >= 5;
  nbMinutes = Math.max(1, Math.min(15, nbMinutes));
  $('nbDuree').value = $('nbDuree').textContent = nbMinutes + ' min';
  $('dureeMoins').disabled = nbMinutes <= 1; $('dureePlus').disabled = nbMinutes >= 15;
  // la bande sous les modes montre le réglage du mode choisi (CSS : fondu, rien ne bouge)
  const reglage = regleChoisie() === 'survie' ? 'vies' : ['temps', 'drapeaux'].includes(regleChoisie()) ? 'duree' : '';
  $('modeLigne').dataset.reglage = reglage;
  for (const [id, cle] of [['reglageVies', 'vies'], ['reglageDuree', 'duree']]) {
    $(id).setAttribute('aria-hidden', String(reglage !== cle));
    $(id).querySelectorAll('button').forEach((b) => { b.tabIndex = reglage === cle ? 0 : -1; });
  }
  $('descRegle').textContent = TEXTE_REGLE[regleChoisie()]();
  nbBots = Math.max(0, Math.min(TOTAL_MAX - 1, nbBots));
  $('nbBots').value = $('nbBots').textContent = String(nbBots);
  $('botsMoins').disabled = nbBots === 0;
  $('botsPlus').disabled = nbBots >= TOTAL_MAX - 1;
  $('choixNiveau').disabled = nbBots === 0;
  const amis = Math.max(1, Math.min(PLACES_MODE[modeChoisi()], TOTAL_MAX - nbBots)) - 1;
  // sans bot, rien à dire : la ligne disparaît et la tuile reste courte
  $('indiceBots').textContent = !nbBots ? ''
    : `${nbBots} bot${nbBots > 1 ? 's' : ''} ${NOM_NIVEAU[niveauChoisi()]}${nbBots > 1 ? 's' : ''} · `
      + (amis ? `${amis} place${amis > 1 ? 's' : ''} pour tes amis` : 'rien que toi et les bots');
  // on entre dans la partie en la lançant, bots ou pas : les amis la rejoignent par son code
  $('creerInstance').textContent = partiePrete ? 'Entrer dans la partie' : SOCIAL.surMobile ? 'Créer' : 'Lancer la partie';
}
$('botsMoins').onclick = () => { nbBots--; majBots(); };
$('botsPlus').onclick = () => { nbBots++; majBots(); };
document.querySelectorAll('input[name="modeInstance"], input[name="niveauBots"], input[name="regleInstance"]').forEach((r) => { r.onchange = majBots; });
$('dureeMoins').onclick = () => { nbMinutes--; majBots(); };
$('dureePlus').onclick = () => { nbMinutes++; majBots(); };
$('viesMoins').onclick = () => { nbVies--; majBots(); };
$('viesPlus').onclick = () => { nbVies++; majBots(); };
majBots();

// le code seul, pas le lien : c'est ce qu'on tape ou qu'on dicte à un ami
async function copierCode(code, bouton) {
  try { await navigator.clipboard.writeText(code); } catch (e) { return false; }
  if (bouton) {
    const avant = bouton.textContent;
    bouton.textContent = 'Copié ✓';
    setTimeout(() => { if (bouton.isConnected) bouton.textContent = avant; }, 1500);
  }
  return true;
}

// La partie créée attend qu'on y entre (Eugène, 30 septembre : « je dois d'abord envoyer le
// code à mes amis ») : le code est copié et s'affiche à la place du nom, le bouton devient
// « Entrer dans la partie ». La croix revient à la création d'une autre partie.
function montrerPartiePrete(i, copie) {
  partiePrete = i;
  let z = $('partiePrete');
  if (!z) { z = document.createElement('div'); z.id = 'partiePrete'; z.className = 'partie-prete'; $('nomInstance').closest('.champ').after(z); }
  z.innerHTML = `<span>Code <b>${ECH(i.code)}</b> · « ${ECH(i.nom)} »</span>
    <button type="button" class="mini" id="recopierCode">${copie ? 'Copié ✓' : 'Copier'}</button>
    <button type="button" class="fantome mini" id="annulerPartie" aria-label="Créer une autre partie">✕</button>`;
  z.classList.remove('cache'); $('nomInstance').closest('.champ').classList.add('cache');
  $('creerInstance').textContent = 'Entrer dans la partie';
  $('recopierCode').onclick = (e) => copierCode(i.code, e.currentTarget);
  $('annulerPartie').onclick = () => {
    partiePrete = null; z.classList.add('cache'); $('nomInstance').closest('.champ').classList.remove('cache');
    majBots(); $('nomInstance').focus();
  };
}
function entrerDansPartie(i) {
  const perso = (C.compte() || {}).pseudo || 'Camille';
  C.activerInstance(i.code);
  C.poserInstance({ code: i.code, nom: i.nom, perso });
  sessionStorage.setItem('tloc_entree', '1'); location.href = 'index.html';   // cf. index.html : on entre par l'accueil
}
$('creerInstance').onclick = async () => {
  if (partiePrete) return entrerDansPartie(partiePrete);
  if (!C.connecte()) return message($('msgInstances'), 'Il faut un compte pour ouvrir une instance.');
  // Le nom est obligatoire, même pour jouer seul contre des bots : c'est lui que les amis
  // voient quand on leur partage la partie (Eugène, 29 septembre).
  const nom = $('nomInstance').value.trim();
  if (!nom) {
    $('nomInstance').classList.remove('manque'); void $('nomInstance').offsetWidth; $('nomInstance').classList.add('manque');
    $('nomInstance').focus();
    return message($('msgInstances'), 'Donne un nom à ta partie : c’est lui que tes amis verront.');
  }
  $('creerInstance').disabled = true;
  try {
    const i = await C.creerInstance(nom, modeChoisi(), true,   // bourse toujours en jeu dans les duels
      nbBots, niveauChoisi(), regleChoisie(), nbVies, dureeChoisie(), areneChoisie());
    $('nomInstance').value = '';
    message($('msgInstances'), '');
    // le geste suivant, c'est presque toujours d'envoyer le code aux copains : il est déjà copié
    const copie = await copierCode(i.code, null);
    await chargerInstances();
    if (!SOCIAL.surMobile) { montrerPartiePrete(i, copie); return; }   // sur ordinateur : on y entre au clic suivant
    toast(copie ? `Partie créée — code ${i.code} copié, envoie-le à tes amis.` : `Partie créée : code ${i.code}.`, { duree: 6000 });
  } catch (e) { message($('msgInstances'), e.message); }
  finally { $('creerInstance').disabled = false; }
};

$('rejoindreInstance').onclick = async () => {
  const code = lireCode();
  if ($('rejoindreInstance').dataset.deja === code && code) return actionInstance(code, 'jouer', $('rejoindreInstance'));
  if (code.length !== 6) { message($('msgInstances'), 'Un code fait six caractères.'); poserCode('', code.length); return; }
  if (!C.connecte()) return message($('msgInstances'), 'Connecte-toi d’abord : le multi passe par le compte.');
  try {
    $('rejoindreInstance').disabled = true;
    const i = await C.rejoindreInstance(code);
    cases.forEach(c => { c.value = ''; });
    message($('msgInstances'), '');
    toast(`Tu as rejoint « ${i.nom} ». Choisis ton personnage et entre.`);
    await chargerInstances();
    const champ = document.querySelector(`.instance[data-code="${CSS.escape(i.code || code)}"] input.perso`);
    if (champ) { champ.focus(); champ.select(); }
  } catch (e) {
    message($('msgInstances'), e.message);
    // un code refusé : les cases tremblent et se vident, le curseur revient au début
    const z = $('codeCases');
    z.classList.remove('faux'); void z.offsetWidth; z.classList.add('faux');
    cases.forEach(c => { c.value = ''; }); cases[0].focus();
  }
  finally { majRejoindre(); }
};

// lien partagé : accueil.html#AB12CD
// venu du jeu sur un téléphone : index.html l'a renvoyé ici, on dit pourquoi
if (location.hash === '#ordinateur') { history.replaceState(null, '', location.pathname); setTimeout(() => SOCIAL.montrerOrdinateur(), 300); }
if (/^#[A-Z0-9]{6}$/i.test(location.hash)) {
  poserCode(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
}

majRejoindre();
SOCIAL.brancherEnvironnement();       // sur tloc-dev : le rappel « dev », et la promotion pour le créateur
C.reprendreAncienneSauvegarde();     // sauvegarde d'avant les parties nommées : on la garde
tout();
setInterval(() => { if (C.connecte() && !document.hidden) chargerInstances(); }, 15000);

// la pastille « Toutes tes parties » : visible tant qu'on est en haut et que la liste est hors de l'écran
{
  // la liste visée : les personnages, ou les parties à plusieurs quand le solo est fermé
  const fl = $('flecheParties'), cible = () => (!$('parties').classList.contains('cache') ? $('parties') : $('plusieurs'));
  const maj = () => { const c = cible(); fl.classList.toggle('cache', scrollY > 60 || c.classList.contains('cache') || c.getBoundingClientRect().top < innerHeight - 40); };
  addEventListener('scroll', maj, { passive: true }); addEventListener('resize', maj); maj();
  document.querySelectorAll('a[href="#parties"]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); cible().scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
}
