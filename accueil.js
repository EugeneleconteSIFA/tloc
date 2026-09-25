// accueil.js — l'accueil du compte : les parties et les instances.
// La connexion, elle, se fait sur le portail (connexion.html).
import * as C from './tloc-compte.js?v=1';
import * as SOCIAL from './accueil-social.js?v=1';

const $ = (id) => document.getElementById(id);
const ECH = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

function peindreCompte() {
  const c = C.compte();
  const barre = $('barreCompte');
  if (c) {
    // « Mon compte » : les badges d'honneur gagnés en manche, et la déconnexion — un geste
    // rare n'a pas à tenir la barre
    barre.innerHTML = `<details class="menu-compte" id="monCompte">
      <summary aria-label="Mon compte, ${ECH(c.pseudo)}"><span class="avatar" id="avatarCompte">${ECH(c.pseudo[0] || '?').toUpperCase()}</span><span class="pseudo">Mon compte</span><span class="compte-total cache" id="nbDemandes" title="Demandes d’ami"></span>${icone('chevron', 16)}</summary>
      <div class="menu compte">
        <div class="onglets-compte" role="tablist" aria-label="Mon compte">
          <button role="tab" aria-selected="true" data-onglet="profil">Mon profil</button>
          <button role="tab" aria-selected="false" data-onglet="amis">Amis</button>
          <button role="tab" aria-selected="false" data-onglet="badges">Badges <span class="compte-total cache" id="totalBadges"></span></button>
        </div>
        <section data-panneau="profil" id="panneauProfil" role="tabpanel"><p class="sous-titre">Chargement…</p></section>
        <section data-panneau="amis" id="panneauAmis" role="tabpanel" hidden></section>
        <section data-panneau="badges" role="tabpanel" hidden>
          <p class="sous-titre">Badges d’honneur, gagnés à la fin des manches</p>
          <ul class="badges" id="listeBadges"><li class="vide" style="grid-column:1/-1">Chargement…</li></ul>
        </section>
        <button class="fantome" id="seDeconnecter">Se déconnecter</button>
      </div>
    </details>`;
    $('seDeconnecter').onclick = async () => { await C.deconnexion(); location.href = 'connexion.html'; };
    // un onglet se charge quand on l'ouvre : ce qu'on y lit est toujours frais
    const charger = { profil: SOCIAL.chargerProfil, amis: SOCIAL.chargerAmis, badges: chargerBadges };
    let onglet = 'profil';
    const montrer = (o) => {
      onglet = o;
      barre.querySelectorAll('[data-onglet]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.onglet === o)));
      barre.querySelectorAll('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== o; });
      charger[o]();
    };
    barre.querySelectorAll('[data-onglet]').forEach((b) => { b.onclick = () => montrer(b.dataset.onglet); });
    $('monCompte').addEventListener('toggle', () => { if ($('monCompte').open) montrer(onglet); });
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

// Les badges : leur nom et leur phrase viennent du serveur (une seule source) ; ici, leur
// médaille. Ceux qui restent à gagner sont montrés en gris : on sait ce qu'on peut viser.
const MEDAILLES = {
  vainqueur: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  premiere_lame: '<path d="M14 4h6v6L9 21l-6-6z"/><path d="M5 13l6 6"/>',
  faucheur: '<path d="M4 20L14 6"/><path d="M14 6c3-2 6-2 7 1-3 0-5 1-7 3"/>',
  vengeur: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>',
  opportuniste: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  bourrin: '<path d="M6 11V7a2 2 0 0 1 4 0v3M10 10V6a2 2 0 0 1 4 0v4M14 10V7a2 2 0 0 1 4 0v6c0 4-3 7-7 7s-6-3-6-6v-2a2 2 0 0 1 4 0"/>',
  increvable: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  tete_brulee: '<path d="M12 21c-4 0-6-3-6-6 0-4 3-5 3-9 3 2 4 4 4 6 1-1 2-2 2-4 3 2 5 5 5 8 0 3-3 5-8 5z"/>',
};
async function chargerBadges() {
  let liste;
  try { liste = await C.badges(); } catch (e) { $('listeBadges').innerHTML = `<li style="grid-column:1/-1">${ECH(e.message)}</li>`; return; }
  const total = liste.reduce((t, b) => t + b.n, 0);
  $('totalBadges').textContent = String(total);
  $('totalBadges').classList.toggle('cache', !total);
  // les plus gagnés d'abord, puis ceux qui restent à décrocher
  liste.sort((a, b) => b.n - a.n);
  $('listeBadges').innerHTML = liste.map((b) => `
    <li class="badge${b.n ? '' : ' vide'}" title="${ECH(b.desc)}">
      <span class="medaille"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MEDAILLES[b.id] || ''}</svg></span>
      <span><b>${ECH(b.nom)}</b><small>${b.n ? ECH(b.desc) : 'À gagner'}</small></span>
      ${b.n ? `<span class="fois" aria-label="${b.n} fois">×${b.n}</span>` : ''}
    </li>`).join('');
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
  occuper(bouton);
  C.activer(id); C.poserInstance(null);
  location.href = 'index.html';
}

// Une partie qu'on vient de supprimer reste récupérable quelques secondes : elle disparaît
// de la liste tout de suite, mais la sauvegarde n'est effacée qu'à la fin du délai. Si le
// joueur quitte la page avant, rien n'est effacé — c'est l'erreur la moins grave des deux.
const enSuppression = new Set();

function peindreReprendre(s) {
  const zone = $('reprendre');
  // première visite : rien à reprendre, la tuile ne garde que « Nouvelle partie », en or
  $('nouvellePartie').classList.toggle('plein', !s);
  zone.closest('.mode-solo').classList.toggle('premiere', !s);
  if (!s) { zone.innerHTML = '<p class="accroche">Phinaert a enlevé le prince Eugène. Donne un nom à ton personnage et pars le délivrer.</p>'; return; }
  const r = s.resume || {};
  zone.innerHTML = `<div class="reprendre">
    <div class="qui">${ecu(s.nom)}
      <div style="min-width:0"><span class="quand">${s.maj ? depuis(s.maj) : 'Dernière partie'}</span>
        <div class="nom">${ECH(s.nom)}</div>
        <div class="infos">${r.neuve ? '' : coeurs(r)}<span class="aide" style="font-size:14px">${ligneResume(r)}</span></div>
      </div>
    </div>
    <div class="ou"><button class="plein grand" id="btnReprendre" title="ou Entrée">${icone('jouer', 20)}${r.neuve ? 'Commencer' : 'Reprendre'}</button></div>
  </div>`;
  $('btnReprendre').onclick = () => jouerPartie(s.id, $('btnReprendre'));
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
  b.classList.toggle('plein', !!deja);
  b.textContent = deja ? 'Entrer' : 'Rejoindre';
  $('indiceCode').textContent = deja ? `Déjà dans la partie « ${deja.nom} ». Pour entrer :` : INDICE_CODE;
  b.disabled = code.length !== 6;
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
          ${i.mode === 'equipes' ? '<span class="pastille">en équipes</span>' : ''}${i.regle === 'survie' ? ` <span class="pastille">match à mort · ${i.vies || 1} vie${(i.vies || 1) > 1 ? 's' : ''}</span>` : ''}${i.regle === 'temps' ? ` <span class="pastille">chrono · ${Math.round((i.duree || 180) / 60)} min</span>` : ''}${i.bots ? ` <span class="pastille">${i.bots} bot${i.bots > 1 ? 's' : ''} · ${NOM_NIVEAU[i.niveau] || i.niveau}</span>` : ''}</h4>
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
    location.href = 'index.html';
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

$('nouvellePartie').onclick = async () => {
  // une partie supprimée mais encore annulable occupe toujours sa place : créer, c'est
  // renoncer à l'annulation, donc on achève la suppression avant de compter
  if (C.slotsPleins() && enSuppression.size) {
    for (const id of [...enSuppression]) { enSuppression.delete(id); await C.supprimerPartout(id); }
    document.querySelectorAll('.toast').forEach(t => t.remove());
  }
  if (C.slotsPleins()) return message($('msgParties'), `Trois personnages au plus. Supprimes-en un pour en créer un autre.`);
  occuper($('nouvellePartie'));
  const id = C.creerSlot($('nomPartie').value);
  $('nomPartie').value = '';
  C.activer(id);
  peindreParties();
  try { await C.pousser(id); } catch (e) {}
  location.href = 'index.html';
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
const NOM_REGLE = { balade: 'balade', survie: 'match à mort', temps: 'chrono' };
let nbVies = 1;
const dureeChoisie = () => +((document.querySelector('input[name="dureeManche"]:checked') || {}).value || 180);
// chaque règle a son réglage à elle : les vies pour le match à mort, la durée pour le chrono
const TEXTE_REGLE = {
  balade: () => 'Sans fin ni score : on se promène et on se bat.',
  survie: () => `${nbVies > 1 ? nbVies + ' vies' : 'Une seule vie'} par manche : le dernier debout gagne.`,
  temps: () => `${dureeChoisie() / 60} minutes : mis à terre moins tombé, le meilleur gagne.`,
};
function majBots() {
  nbVies = Math.max(1, Math.min(5, nbVies));
  $('nbVies').value = $('nbVies').textContent = String(nbVies);
  $('viesMoins').disabled = nbVies <= 1; $('viesPlus').disabled = nbVies >= 5;
  $('reglageVies').classList.toggle('cache', regleChoisie() !== 'survie');
  $('reglageDuree').classList.toggle('cache', regleChoisie() !== 'temps');
  $('indiceRegle').textContent = TEXTE_REGLE[regleChoisie()]();
  nbBots = Math.max(0, Math.min(TOTAL_MAX - 1, nbBots));
  $('nbBots').value = $('nbBots').textContent = String(nbBots);
  $('botsMoins').disabled = nbBots === 0;
  $('botsPlus').disabled = nbBots >= TOTAL_MAX - 1;
  $('choixNiveau').disabled = nbBots === 0;
  const amis = Math.max(1, Math.min(PLACES_MODE[modeChoisi()], TOTAL_MAX - nbBots)) - 1;
  $('indiceBots').textContent = !nbBots ? 'Sans bot : rien que tes amis.'
    : `${nbBots} bot${nbBots > 1 ? 's' : ''} ${NOM_NIVEAU[niveauChoisi()]}${nbBots > 1 ? 's' : ''} · `
      + (amis ? `${amis} place${amis > 1 ? 's' : ''} pour tes amis` : 'rien que toi et les bots');
  // avec des bots, on n'attend personne : la partie s'ouvre et on y entre
  $('creerInstance').textContent = nbBots ? 'Créer et jouer' : 'Créer';
}
$('botsMoins').onclick = () => { nbBots--; majBots(); };
$('botsPlus').onclick = () => { nbBots++; majBots(); };
document.querySelectorAll('input[name="modeInstance"], input[name="niveauBots"], input[name="regleInstance"], input[name="dureeManche"]').forEach((r) => { r.onchange = majBots; });
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

$('creerInstance').onclick = async () => {
  if (!C.connecte()) return message($('msgInstances'), 'Il faut un compte pour ouvrir une instance.');
  $('creerInstance').disabled = true;
  try {
    const i = await C.creerInstance($('nomInstance').value || 'Partie entre amis', modeChoisi(), true,   // bourse toujours en jeu dans les duels
      nbBots, niveauChoisi(), regleChoisie(), nbVies, dureeChoisie());
    $('nomInstance').value = '';
    message($('msgInstances'), '');
    // le geste suivant, c'est presque toujours d'envoyer le code aux copains : il est déjà copié
    const copie = await copierCode(i.code, null);
    if (nbBots) {                                  // des bots : on entre tout de suite
      const perso = (C.compte() || {}).pseudo || 'Camille';
      C.activerInstance(i.code);
      C.poserInstance({ code: i.code, nom: i.nom, perso });
      location.href = 'index.html';
      return;
    }
    await chargerInstances();
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
if (/^#[A-Z0-9]{6}$/i.test(location.hash)) {
  poserCode(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
}

majRejoindre();
SOCIAL.brancherEnvironnement();       // sur tloc-dev : le rappel « dev », et la promotion pour le créateur
C.reprendreAncienneSauvegarde();     // sauvegarde d'avant les parties nommées : on la garde
tout();
setInterval(() => { if (C.connecte() && !document.hidden) chargerInstances(); }, 15000);
