// accueil-social.js — le social de l'accueil : mon profil, mes amis, et la bulle de chat
// (conversations à deux ou en groupe, parties envoyées dans le chat).
//
// Rangé à part d'accueil.js pour que chacun reste lisible ; il n'est chargé que par
// l'accueil et ne touche pas au jeu. Pas de temps réel : on interroge le serveur toutes
// les quelques secondes quand la bulle est ouverte, toutes les vingt secondes sinon.
import * as C from './tloc-compte.js?v=1';

const $ = (id) => document.getElementById(id);
const ECH = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toast = (t) => console.log(t);
let moiId = null;

// =====================================================================
//  Téléphone et tablette : on gère, on ne joue pas
// =====================================================================
// Le jeu se joue au clavier et à la souris. Sur un écran tactile sans souris, l'accueil
// reste utile — préparer ses personnages, ouvrir une partie, inviter ses amis, discuter —
// mais tout ce qui ouvrirait la citadelle affiche ce message à la place. Un ordinateur à
// écran tactile garde sa souris (hover), il n'est donc pas concerné.
export const surMobile = matchMedia('(hover: none) and (pointer: coarse)').matches;
document.documentElement.classList.toggle('mobile', surMobile);
let dialogueOrdi = null;
export function montrerOrdinateur(precision = '') {
  if (!dialogueOrdi) {
    dialogueOrdi = document.createElement('dialog');
    dialogueOrdi.className = 'dialogue-ordi';
    dialogueOrdi.setAttribute('aria-labelledby', 'titreOrdi');
    document.body.appendChild(dialogueOrdi);
  }
  dialogueOrdi.innerHTML = `
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M1.5 20h21"/><path d="M9 16l-.5 4M15 16l.5 4"/></svg>
    <h2 id="titreOrdi">Le jeu se joue sur ordinateur</h2>
    <p>L’application est adaptée pour jouer sur ordinateur, au clavier et à la souris. Merci de changer d’écran pour jouer.</p>
    ${precision ? `<p class="precision">${ECH(precision)}</p>` : ''}
    <p class="sous-titre">Ici, tu peux préparer tes personnages, ouvrir des parties et inviter tes amis.</p>
    <form method="dialog"><button class="plein large">Compris</button></form>`;
  dialogueOrdi.showModal();
  return false;
}

const TRAITS = {
  bulle: '<path d="M4 5h16v11H9l-5 4z"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  retour: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  envoyer: '<path d="M4 12l16-8-6 16-3-7z"/>',
  groupe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M17 11v6M14 14h6"/>',
  epees: '<path d="M4 4l11 11"/><path d="M20 4L9 15"/><path d="M12.5 17.5l5-5"/><path d="M6.5 12.5l5 5"/><path d="M16.5 16.5l3 3"/><path d="M7.5 16.5l-3 3"/>',
  ajout: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M19 8v6M16 11h6"/>',
  ok: '<path d="M5 12l5 5 9-10"/>',
  photo: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
};
const icone = (n, t = 18) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAITS[n]}</svg>`;

// la photo si le joueur en a mis une, sinon son initiale sur brique
function avatar(j, t = 36) {
  const init = ECH(((j && j.pseudo) || '?')[0].toUpperCase());
  const point = j && j.en_ligne ? '<span class="point-en-ligne" aria-label="en ligne"></span>' : '';
  return `<span class="avatar-social" style="width:${t}px;height:${t}px;font-size:${Math.round(t * 0.45)}px">${
    j && j.photo ? `<img src="${ECH(j.photo)}" alt="">` : init}${point}</span>`;
}
const quand = (t) => {
  const d = new Date(t * 1000), n = new Date();
  return d.toDateString() === n.toDateString() ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
const NOM_REGLE = { balade: 'balade', survie: 'match à mort', temps: 'chrono' };
function resumePartie(i) {
  const bouts = [i.mode === 'equipes' ? 'en équipes' : 'chacun pour soi', NOM_REGLE[i.regle] || 'balade'];
  if (i.regle === 'survie') bouts.push(`${i.vies} vie${i.vies > 1 ? 's' : ''}`);
  if (i.regle === 'temps') bouts.push(`${Math.round(i.duree / 60)} min`);
  if (i.bots) bouts.push(`${i.bots} bot${i.bots > 1 ? 's' : ''}`);
  return bouts.join(' · ');
}

// Entrer dans une partie reçue : on la rejoint (elle rejoint aussi notre liste), puis on y va
async function entrerPartie(code, nom, bouton) {
  if (surMobile) {                     // on rejoint quand même : la partie attend sur l'ordinateur
    try { await C.rejoindreInstance(code); if (bouton) { bouton.textContent = 'Dans tes parties ✓'; bouton.disabled = true; } }
    catch (e) { toast(e.message, { erreur: true }); return; }
    montrerOrdinateur(`« ${nom} » est dans ta liste : retrouve-la depuis un ordinateur.`);
    return;
  }
  if (bouton) { bouton.disabled = true; bouton.textContent = 'Ouverture…'; }
  try {
    await C.rejoindreInstance(code);
    const perso = (C.compte() || {}).pseudo || 'Camille';
    C.activerInstance(code);
    C.poserInstance({ code, nom, perso });
    location.href = 'index.html';
  } catch (e) {
    toast(e.message, { erreur: true });
    if (bouton) { bouton.disabled = false; bouton.textContent = 'Rejoindre'; }
  }
}

// =====================================================================
//  Mon compte : les onglets Profil et Amis
// =====================================================================
let profilCourant = null;

// ---------- l'accueil du compte : photo, nom, badges, amis ----------
let ouvrirSection = () => {};
export function surOnglet(fn) { ouvrirSection = fn; }

export async function chargerAccueilCompte() {
  const zone = $('compteAccueil');
  if (!zone) return;
  try { profilCourant = await C.profil(); } catch (e) { zone.innerHTML = `<p class="sous-titre">${ECH(e.message)}</p>`; return; }
  const p = profilCourant;
  zone.innerHTML = `${avatar(p, 64)}
    <div class="compte-qui"><h3>${ECH(p.pseudo)}</h3>${p.devise ? `<p class="sous-titre">${ECH(p.devise)}</p>` : ''}
      <div class="compte-chiffres">
        <button type="button" class="chiffre" data-vers="badges"><b>${p.badges}</b> badge${p.badges > 1 ? 's' : ''}</button>
        <button type="button" class="chiffre" data-vers="amis"><b>${p.amis}</b> ami${p.amis > 1 ? 's' : ''}</button>
      </div>
    </div>`;
  zone.querySelectorAll('[data-vers]').forEach((b) => { b.onclick = () => ouvrirSection(b.dataset.vers); });
  if ($('ongletAdmin')) $('ongletAdmin').classList.toggle('cache', !p.createur);
  majAvatarBarre();
}

// ---------- infos perso : photo, devise, depuis quand ----------
export async function chargerInfos() {
  const zone = $('panneauInfos');
  try { profilCourant = await C.profil(); } catch (e) { zone.innerHTML = `<p class="sous-titre">${ECH(e.message)}</p>`; return; }
  const p = profilCourant;
  const depuis = new Date(p.cree * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  zone.innerHTML = `
    <div class="ligne-photo">${avatar(p, 56)}
      <label class="bouton mini" for="fichierPhoto">${icone('photo', 16)}Changer la photo</label>
      <input type="file" id="fichierPhoto" accept="image/*" class="sr">
      ${p.photo ? '<button class="fantome mini" id="retirerPhoto">Retirer</button>' : ''}
    </div>
    <label for="deviseProfil">Ta devise</label>
    <input id="deviseProfil" maxlength="80" placeholder="Pour Lille et la citadelle !" value="${ECH(p.devise || '')}">
    <dl class="infos-liste">
      <div><dt>Pseudo</dt><dd>${ECH(p.pseudo)}</dd></div>
      <div><dt>Inscrit depuis le</dt><dd>${ECH(depuis)}</dd></div>
      <div><dt>Parties en solo</dt><dd>${p.parties}</dd></div>
    </dl>`;
  $('fichierPhoto').onchange = (e) => { const f = e.target.files[0]; if (f) poserPhoto(f); };
  const devise = $('deviseProfil');
  const garder = async () => {
    if (devise.value.trim() === (profilCourant.devise || '')) return;
    try { profilCourant = await C.majProfil({ devise: devise.value }); toast('Devise enregistrée.'); chargerAccueilCompte(); }
    catch (e) { toast(e.message, { erreur: true }); }
  };
  devise.onblur = garder;
  devise.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); devise.blur(); } };
  if ($('retirerPhoto')) $('retirerPhoto').onclick = async () => { await C.majProfil({ photo: '' }); chargerInfos(); chargerAccueilCompte(); };
}

// ---------- la vue admin du créateur : les chiffres du jeu ----------
export async function chargerAdmin() {
  const zone = $('panneauAdmin');
  zone.innerHTML = '<p class="sous-titre">Chargement…</p>';
  let a; try { a = await C.admin(); } catch (e) { zone.innerHTML = `<p class="sous-titre">${ECH(e.message)}</p>`; return; }
  const heures = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`);
  const carte = (chiffre, titre, detail) => `<div class="stat"><b>${chiffre}</b><span>${titre}</span><small>${detail}</small></div>`;
  zone.innerHTML = `<p class="sous-titre">Les autres joueurs — toi exclu</p>
    <div class="stats">
      ${carte(a.joueurs.total, 'joueurs inscrits', `+${a.joueurs.nouveaux_7j} cette semaine · ${a.joueurs.actifs_24h} venus aujourd’hui`)}
      ${carte(heures(a.solo.minutes), 'de jeu en solo', `${a.solo.parties} partie${a.solo.parties > 1 ? 's' : ''} sauvegardée${a.solo.parties > 1 ? 's' : ''}`)}
      ${carte(a.multi.manches, 'manches jouées', `${a.multi.manches_7j} cette semaine · ${a.multi.instances} parties ouvertes · ${a.multi.en_ligne} en ligne`)}
      ${carte(a.retours.messages, 'messages de retour', `de ${a.retours.conversations} testeur${a.retours.conversations > 1 ? 's' : ''}`)}
    </div>
    ${a.derniers.length ? `<p class="sous-titre">Derniers inscrits : ${a.derniers.map((d) => `<b>${ECH(d.pseudo)}</b>`).join(', ')}</p>` : ''}`;
}

// la photo est recadrée en carré de 160 px dans le navigateur : quelques kilo-octets
// seulement partent au serveur, quelle que soit la taille de l'original
function poserPhoto(fichier) {
  const img = new Image();
  img.onload = async () => {
    const T = 160, cv = document.createElement('canvas'); cv.width = cv.height = T;
    const cote = Math.min(img.width, img.height);
    cv.getContext('2d').drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, T, T);
    URL.revokeObjectURL(img.src);
    try { await C.majProfil({ photo: cv.toDataURL('image/jpeg', 0.85) }); toast('Photo de profil changée.'); chargerInfos(); chargerAccueilCompte(); }
    catch (e) { toast(e.message, { erreur: true }); }
  };
  img.onerror = () => toast('Cette image ne s’ouvre pas.', { erreur: true });
  img.src = URL.createObjectURL(fichier);
}

function majAvatarBarre() {
  const a = $('avatarCompte');
  if (!a || !profilCourant) return;
  a.innerHTML = profilCourant.photo ? `<img src="${ECH(profilCourant.photo)}" alt="">` : ECH(profilCourant.pseudo[0].toUpperCase());
}

// le bouton d'action d'un joueur, selon où on en est avec lui
function actionJoueur(j) {
  if (j.relation === 'ami') return `<button class="mini" data-ecrire="${j.id}">Écrire</button>`;
  if (j.relation === 'envoyee') return '<span class="sous-titre">Demande envoyée</span>';
  if (j.relation === 'recue') return `<button class="plein mini" data-demander="${j.id}">Accepter</button>`;
  return `<button class="mini" data-demander="${j.id}">${icone('ajout', 16)}Ajouter</button>`;
}
function ligneJoueur(j, actions) {
  return `<li class="ligne-joueur">${avatar(j, 34)}<span class="nom">${ECH(j.pseudo)}${j.en_ligne ? ' <small>en ligne</small>' : ''}</span><span class="actions">${actions}</span></li>`;
}
function brancherActions(zone, apres) {
  zone.querySelectorAll('[data-demander]').forEach((b) => { b.onclick = async () => {
    try { const r = await C.demanderAmi(+b.dataset.demander); toast(r.relation === 'ami' ? 'Vous êtes amis.' : 'Demande envoyée.'); apres(); }
    catch (e) { toast(e.message, { erreur: true }); } }; });
  zone.querySelectorAll('[data-refuser]').forEach((b) => { b.onclick = async () => { await C.retirerAmi(+b.dataset.refuser); apres(); }; });
  zone.querySelectorAll('[data-retirer]').forEach((b) => { b.onclick = async () => {
    if (!confirm('Retirer cet ami ?')) return; await C.retirerAmi(+b.dataset.retirer); apres(); }; });
  zone.querySelectorAll('[data-ecrire]').forEach((b) => { b.onclick = () => ecrireA(+b.dataset.ecrire); });
}

// on cherche au fil de la frappe, un quart de seconde après la dernière touche
function champRecherche(input, sortie, apres) {
  let minuteur = null;
  input.oninput = () => {
    clearTimeout(minuteur);
    const q = input.value.trim();
    if (q.length < 2) { sortie.innerHTML = ''; return; }
    minuteur = setTimeout(async () => {
      let r; try { r = await C.chercherJoueurs(q); } catch (e) { sortie.innerHTML = ''; return; }
      sortie.innerHTML = r.length ? `<ul class="liste-joueurs">${r.map((j) => ligneJoueur(j, actionJoueur(j))).join('')}</ul>`
        : '<p class="sous-titre">Personne ne s’appelle comme ça.</p>';
      brancherActions(sortie, () => { input.oninput(); apres(); });
    }, 250);
  };
}

export async function chargerAmis() {
  const zone = $('panneauAmis');
  let a; try { a = await C.amis(); } catch (e) { zone.innerHTML = `<p class="sous-titre">${ECH(e.message)}</p>`; return; }
  $('nbDemandes').textContent = String(a.recues.length);
  $('nbDemandes').classList.toggle('cache', !a.recues.length);
  zone.innerHTML = `
    <label for="chercherAmi">Ajouter un ami</label>
    <input id="chercherAmi" placeholder="Son pseudo" autocomplete="off">
    <div id="resultatsAmi"></div>
    ${a.recues.length ? `<h4>Demandes reçues</h4><ul class="liste-joueurs">${a.recues.map((j) => ligneJoueur(j,
      `<button class="plein mini" data-demander="${j.id}">Accepter</button><button class="fantome mini" data-refuser="${j.id}">Refuser</button>`)).join('')}</ul>` : ''}
    <h4>Mes amis <small>${a.amis.length}</small></h4>
    ${a.amis.length ? `<ul class="liste-joueurs">${a.amis.map((j) => ligneJoueur(j,
      `<button class="mini" data-ecrire="${j.id}">Écrire</button><button class="fantome mini icone" data-retirer="${j.id}" aria-label="Retirer ${ECH(j.pseudo)}" title="Retirer">${icone('fermer', 14)}</button>`)).join('')}</ul>`
      : '<p class="sous-titre">Pas encore d’ami : cherche un pseudo juste au-dessus.</p>'}
    ${a.envoyees.length ? `<h4>En attente</h4><ul class="liste-joueurs">${a.envoyees.map((j) => ligneJoueur(j,
      `<button class="fantome mini" data-refuser="${j.id}">Annuler</button>`)).join('')}</ul>` : ''}`;
  champRecherche($('chercherAmi'), $('resultatsAmi'), chargerAmis);
  brancherActions(zone, chargerAmis);
}

// =====================================================================
//  La bulle de chat
// =====================================================================
let panneau = null, vue = 'liste', convOuverte = null, dernierId = 0, minuteurConv = null;
let convsCache = [], amisCache = [];

export function demarrerChat(opts) {
  toast = opts.toast || toast;
  moiId = null;
  C.profil().then((p) => { moiId = p.id; profilCourant = profilCourant || p; majAvatarBarre();
    if ($('ongletAdmin')) $('ongletAdmin').classList.toggle('cache', !p.createur); }).catch(() => {});
  const bouton = document.createElement('button');
  bouton.className = 'bulle-chat'; bouton.id = 'bulleChat';
  bouton.setAttribute('aria-label', 'Messages');
  bouton.innerHTML = `${icone('bulle', 26)}<span class="compte-total cache" id="nonLusChat"></span>`;
  bouton.onclick = () => (panneau ? fermerChat() : ouvrirChat());
  document.body.appendChild(bouton);
  compterNonLus();
  setInterval(() => { if (!document.hidden) compterNonLus(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) compterNonLus(); });
}

async function compterNonLus() {
  try {
    const n = await C.nonLus();
    const el = $('nonLusChat');
    el.textContent = String(n.messages); el.classList.toggle('cache', !n.messages);
    const d = $('nbDemandes');
    if (d) { d.textContent = String(n.demandes); d.classList.toggle('cache', !n.demandes); }
  } catch (e) { /* hors ligne : la bulle attend */ }
}

function ouvrirChat() {
  panneau = document.createElement('section');
  panneau.className = 'panneau-chat'; panneau.setAttribute('aria-label', 'Messages');
  document.body.appendChild(panneau);
  vue = 'liste'; peindreListe();
  document.addEventListener('keydown', echapChat);
}
function fermerChat() {
  clearInterval(minuteurConv); minuteurConv = null;
  if (panneau) panneau.remove(); panneau = null; convOuverte = null;
  document.removeEventListener('keydown', echapChat);
  compterNonLus();
}
function echapChat(e) {
  if (e.key !== 'Escape' || !panneau) return;
  if (vue === 'liste') fermerChat(); else { vue = 'liste'; peindreListe(); }
}
const tete = (titre, retour = false, extra = '') => `<header class="chat-tete">
  ${retour ? `<button class="fantome mini icone" data-retour aria-label="Retour">${icone('retour', 18)}</button>` : ''}
  <h3>${titre}</h3>${extra}
  <button class="fantome mini icone" data-fermer aria-label="Fermer">${icone('fermer', 18)}</button></header>`;
function brancherTete() {
  panneau.querySelectorAll('[data-fermer]').forEach((b) => { b.onclick = fermerChat; });
  panneau.querySelectorAll('[data-retour]').forEach((b) => { b.onclick = () => { clearInterval(minuteurConv); vue = 'liste'; peindreListe(); }; });
}

// ---------- la liste des conversations ----------
async function peindreListe() {
  clearInterval(minuteurConv); convOuverte = null; vue = 'liste';
  panneau.innerHTML = `${tete('Messages', false, `<button class="mini" data-groupe>${icone('groupe', 16)}Groupe</button>`)}
    <div class="chat-corps">
      <input id="chercherChat" placeholder="Chercher une conversation ou un joueur" autocomplete="off" aria-label="Chercher">
      <div id="joueursChat"></div>
      <div class="amis-en-ligne" id="amisEnLigne"></div>
      <ul class="liste-convs" id="listeConvs"><li class="sous-titre">Chargement…</li></ul>
    </div>`;
  brancherTete();
  panneau.querySelector('[data-groupe]').onclick = peindreNouveauGroupe;
  const input = $('chercherChat');
  input.focus();
  try { [convsCache, amisCache] = await Promise.all([C.convs(), C.amis().then((a) => a.amis)]); }
  catch (e) { if ($('listeConvs')) $('listeConvs').innerHTML = `<li class="sous-titre">${ECH(e.message)}</li>`; return; }
  // entre-temps, on a pu ouvrir une conversation (« Écrire à… ») : la liste n'est plus à l'écran
  if (!panneau || vue !== 'liste' || !$('listeConvs')) return;
  const peindreConvs = () => {
    const q = input.value.trim().toLowerCase();
    const l = convsCache.filter((c) => !q || c.nom.toLowerCase().includes(q))
      .sort((a, b) => (b.retour - a.retour) || (b.maj - a.maj));
    const nRetours = l.filter((c) => c.retour).length;
    $('listeConvs').innerHTML = l.length ? l.map((c, k) => `${
      nRetours && k === 0 ? `<li class="sous-titre">${profilCourant && profilCourant.createur ? 'Retours des testeurs' : 'Ton retour au créateur'}</li>` : ''}${
      nRetours && k === nRetours ? '<li class="sous-titre">Conversations</li>' : ''}
      <li><button class="conv" data-conv="${c.id}">
        ${c.groupe ? `<span class="avatar-social groupe" style="width:40px;height:40px">${icone('groupe', 20)}</span>` : avatar(c.membres[0], 40)}
        <span class="conv-texte"><b>${ECH(c.nom)}${c.retour ? ' <span class="pastille">retour</span>' : ''}</b><small>${c.dernier ? ECH((c.groupe ? c.dernier.pseudo + ' : ' : '') + c.dernier.texte) : 'Pas encore de message'}</small></span>
        <span class="conv-meta">${c.dernier ? `<small>${quand(c.dernier.t)}</small>` : ''}${c.non_lus ? `<span class="compte-total">${c.non_lus}</span>` : ''}</span>
      </button></li>`).join('')
      : `<li class="sous-titre">${convsCache.length ? 'Aucune conversation ne correspond.' : 'Pas encore de conversation : écris à un ami, ou crée un groupe.'}</li>`;
    $('listeConvs').querySelectorAll('[data-conv]').forEach((b) => { b.onclick = () => ouvrirConv(convsCache.find((c) => c.id === +b.dataset.conv)); });
  };
  // les amis en ligne d'abord : un clic, et on leur écrit
  const enLigne = amisCache.filter((a) => a.en_ligne);
  $('amisEnLigne').innerHTML = amisCache.length ? `<div class="sous-titre">${enLigne.length ? 'En ligne' : 'Tes amis'}</div><div class="rangee-amis">${
    (enLigne.length ? enLigne : amisCache).slice(0, 8).map((a) => `<button class="ami-rond" data-ecrire="${a.id}" title="Écrire à ${ECH(a.pseudo)}">${avatar(a, 44)}<small>${ECH(a.pseudo)}</small></button>`).join('')}</div>` : '';
  $('amisEnLigne').querySelectorAll('[data-ecrire]').forEach((b) => { b.onclick = () => ecrireA(+b.dataset.ecrire); });
  peindreConvs();
  // la même barre cherche aussi des joueurs : on ajoute un ami sans quitter le chat
  let minuteur = null;
  input.oninput = () => {
    peindreConvs();
    clearTimeout(minuteur);
    const q = input.value.trim();
    if (q.length < 2) { $('joueursChat').innerHTML = ''; return; }
    minuteur = setTimeout(async () => {
      let r; try { r = await C.chercherJoueurs(q); } catch (e) { return; }
      $('joueursChat').innerHTML = r.length ? `<div class="sous-titre">Joueurs</div><ul class="liste-joueurs">${r.map((j) => ligneJoueur(j, actionJoueur(j))).join('')}</ul>` : '';
      brancherActions($('joueursChat'), () => input.oninput());
    }, 250);
  };
}

// ---------- tloc-dev : le rappel, et le bouton « Promouvoir » ----------
// Sur le dev, chacun doit savoir qu'il n'est pas sur le vrai jeu (ce qu'on y fait est
// effacé chaque nuit par la copie de la prod). Le créateur y voit en plus les deux
// versions, et promeut la nouvelle d'un clic — ou revient à la précédente.
const dateVersion = (v) => (v && v.date ? new Date(v.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  + (v.commit ? ` (${v.commit})` : '') : 'inconnue');
// Sur tloc-dev : une puce « Dev » dans l'en-tête, et, pour le créateur, la section
// « Version » de son compte (les deux versions, récupérer, promouvoir, revenir en arrière).
let envCourant = null;
export async function brancherEnvironnement() {
  let e; try { e = await C.env(); } catch (er) { return; }
  if (e.env !== 'dev') return;
  // le dev est réservé au créateur : pas de mode « sans compte » ici
  if (!C.connecte()) { try { localStorage.removeItem('tloc_local'); } catch (er) {} location.replace('connexion.html'); return; }
  document.title = '[DEV] ' + document.title;
  envCourant = e;
  if ($('puceDev')) $('puceDev').classList.remove('cache');
  if (e.peut_promouvoir && $('ongletVersion')) $('ongletVersion').classList.remove('cache');
}

export function chargerVersion() {
  const zone = $('panneauVersion'), e = envCourant;
  if (!zone || !e) return;
  zone.innerHTML = `
    <dl class="infos-liste">
      <div><dt>Dev (ici)</dt><dd>${ECH(dateVersion(e.version))}${e.version && e.version.message ? ` — ${ECH(e.version.message)}` : ''}</dd></div>
      <div><dt>Prod (les joueurs)</dt><dd>${ECH(dateVersion(e.prod))}${e.prod && e.prod.message ? ` — ${ECH(e.prod.message)}` : ''}</dd></div>
    </dl>
    <div class="actions-version">
      <button class="mini" id="majDev" title="git pull de GitHub vers le dev">Récupérer de GitHub</button>
      <button class="plein mini" id="promouvoir">Promouvoir en prod</button>
      <button class="fantome mini" id="revenirProd" title="Remettre la version précédente de la prod">Revenir en arrière</button>
    </div>
    <p class="sous-titre">La base du dev est recopiée de la prod chaque nuit à 3 h 30. <a href="https://tloc.kernse.fr/">Aller au vrai jeu</a></p>`;
  const lancer = async (action, bouton) => {
    const question = action === 'maj' ? 'Récupérer la dernière version poussée sur GitHub ?'
      : action === 'revenir' ? 'Remettre la version précédente de la prod ?'
      : `Envoyer la version du ${dateVersion(e.version)} en prod ? Les joueurs l'auront au prochain chargement.`;
    if (!confirm(question)) return;
    bouton.disabled = true; bouton.textContent = { maj: 'Récupération…', revenir: 'Retour…' }[action] || 'Promotion…';
    try {
      const r = await C.promotion(action);
      toast(r.ok ? ({ maj: 'Le dev a la dernière version : recharge la page.', revenir: 'La prod est revenue à la version précédente.' }[action] || 'C’est en prod !')
        : `Échec : ${(r.sortie || []).slice(-1)[0] || 'voir le serveur'}`, { erreur: !r.ok, duree: 8000 });
      e.prod = r.prod || e.prod; e.version = r.version || e.version;
    } catch (er) { toast(er.message, { erreur: true }); }
    chargerVersion();
  };
  $('majDev').onclick = () => lancer('maj', $('majDev'));
  $('promouvoir').onclick = () => lancer('promouvoir', $('promouvoir'));
  $('revenirProd').onclick = () => lancer('revenir', $('revenirProd'));
}

// ---------- le bandeau des testeurs, et le créateur ----------
// Un testeur voit « faites vos retours au créateur » : le nom ouvre une conversation avec
// lui, sans passer par une demande d'ami. Le créateur, lui, voit combien de retours l'attendent.
let createur = null;
export async function brancherBandeau() {
  const lien = $('lienCreateur'), texte = $('texteTesteurs');
  let p;
  try { [p, createur] = await Promise.all([C.profil(), C.createur().catch(() => null)]); } catch (e) { return; }
  if (p.createur) {
    texte.innerHTML = `Tu es le créateur : <b>${p.retours}</b> retour${p.retours > 1 ? 's' : ''} de testeurs.
      <button type="button" class="lien-createur" id="lireRetours">Les lire</button>`;
    $('lireRetours').onclick = () => { if (!panneau) ouvrirChat(); };
    return;
  }
  if (!createur) { $('bandeauTesteurs').classList.add('cache'); return; }
  lien.title = 'Écrire au créateur du jeu';
  lien.onclick = (e) => { e.preventDefault(); ecrireA(createur.id, true); };
}

// écrire à un ami : on retrouve (ou crée) la conversation à deux
export async function ecrireA(id, retour = false) {
  try {
    const c = await C.creerConv([id]);
    c.retour = c.retour || retour;
    const menuCompte = document.getElementById('monCompte');
    if (menuCompte) menuCompte.open = false;          // on passe du compte à la conversation
    if (!panneau) ouvrirChat();
    ouvrirConv(c);
  } catch (e) { toast(e.message, { erreur: true }); }
}

// ---------- un nouveau groupe ----------
async function peindreNouveauGroupe() {
  vue = 'groupe';
  panneau.innerHTML = `${tete('Nouveau groupe', true)}
    <div class="chat-corps">
      <label for="nomGroupe">Nom du groupe</label>
      <input id="nomGroupe" maxlength="40" placeholder="La garnison du dimanche">
      <p class="sous-titre">Avec qui ?</p>
      <ul class="liste-joueurs" id="choixMembres"><li class="sous-titre">Chargement…</li></ul>
      <button class="plein large" id="creerGroupe" disabled>Créer le groupe</button>
    </div>`;
  brancherTete();
  let a; try { a = (await C.amis()).amis; } catch (e) { return; }
  $('choixMembres').innerHTML = a.length ? a.map((j) => `<li><label class="ligne-joueur choix-membre">${avatar(j, 34)}<span class="nom">${ECH(j.pseudo)}</span><input type="checkbox" value="${j.id}"></label></li>`).join('')
    : '<li class="sous-titre">Il faut des amis pour faire un groupe : ajoute-en depuis « Mon compte ».</li>';
  const choisis = () => [...$('choixMembres').querySelectorAll('input:checked')].map((i) => +i.value);
  $('choixMembres').onchange = () => { $('creerGroupe').disabled = choisis().length < 1; };
  $('creerGroupe').onclick = async () => {
    try { const c = await C.creerConv(choisis(), $('nomGroupe').value.trim() || null); ouvrirConv(c); }
    catch (e) { toast(e.message, { erreur: true }); }
  };
}

// ---------- une conversation ----------
async function ouvrirConv(c) {
  if (!c || !panneau) return;
  vue = 'conv'; convOuverte = c; dernierId = 0;
  panneau.innerHTML = `${tete(ECH(c.nom), true, c.groupe ? `<small class="membres">${c.membres.length + 1} membres</small>` : '')}
    <ol class="fil" id="filMessages" aria-live="polite"></ol>
    <div class="menu-partie cache" id="menuPartie"></div>
    <form class="chat-saisie" id="formMessage">
      <button type="button" class="mini icone" id="boutonPartie" aria-label="Lancer une partie" title="Lancer ou envoyer une partie">${icone('epees', 18)}</button>
      <input id="texteMessage" maxlength="1000" placeholder="${c.retour && !(profilCourant && profilCourant.createur)
        ? 'Ton retour : un bug, une idée, une envie…' : `Écrire à ${ECH(c.nom)}…`}" autocomplete="off" aria-label="Message">
      <button type="submit" class="plein mini icone" aria-label="Envoyer">${icone('envoyer', 18)}</button>
    </form>`;
  brancherTete();
  $('formMessage').onsubmit = async (e) => {
    e.preventDefault();
    const t = $('texteMessage').value.trim();
    if (!t) return;
    $('texteMessage').value = '';
    try { await C.envoyerMessage(c.id, t); await suivre(); } catch (er) { toast(er.message, { erreur: true }); }
  };
  $('boutonPartie').onclick = basculerMenuPartie;
  $('texteMessage').focus();
  await suivre();
  clearInterval(minuteurConv);
  minuteurConv = setInterval(() => { if (!document.hidden) suivre(); }, 3000);
}

async function suivre() {
  const c = convOuverte;
  if (!c) return;
  let ms; try { ms = await C.messages(c.id, dernierId); } catch (e) { return; }
  if (!ms.length || convOuverte !== c) return;
  const fil = $('filMessages');
  const enBas = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 40;
  for (const m of ms) {
    dernierId = Math.max(dernierId, m.id);
    const mien = m.auteur === moiId;
    const li = document.createElement('li');
    li.className = 'message' + (mien ? ' mien' : '');
    const qui = !mien && c.groupe ? `<small class="auteur">${ECH(m.pseudo)}</small>` : '';
    let corps = m.texte ? `<p>${ECH(m.texte)}</p>` : '';
    if (m.invitation) {
      const i = m.invitation;
      corps += `<div class="invitation"><div class="inv-tete">${icone('epees', 16)}<b>${ECH(i.nom)}</b></div>
        <small>${ECH(resumePartie(i))} · code ${ECH(i.code)}</small>
        <button class="plein mini" data-entrer="${ECH(i.code)}" data-nom="${ECH(i.nom)}">${surMobile ? 'Ajouter à mes parties' : (mien ? 'Entrer' : 'Rejoindre')}</button></div>`;
    }
    li.innerHTML = `${!mien ? avatar({ pseudo: m.pseudo, photo: m.photo }, 28) : ''}<div class="bulle">${qui}${corps}<time>${quand(m.t)}</time></div>`;
    fil.appendChild(li);
  }
  fil.querySelectorAll('[data-entrer]').forEach((b) => { b.onclick = () => entrerPartie(b.dataset.entrer, b.dataset.nom, b); });
  compterNonLus();                     // ce qu'on vient de lire ne compte plus sur la bulle
  if (enBas || ms.length) fil.scrollTop = fil.scrollHeight;
}

// ---------- lancer une partie depuis le chat ----------
async function basculerMenuPartie() {
  const zone = $('menuPartie');
  if (!zone.classList.contains('cache')) { zone.classList.add('cache'); return; }
  zone.classList.remove('cache');
  zone.innerHTML = `
    <div class="sous-titre">Lancer une partie avec ${ECH(convOuverte.nom)}</div>
    <div class="choix-niveau">
      <label><input type="radio" name="regleChat" value="balade" checked><span>Balade</span></label>
      <label><input type="radio" name="regleChat" value="survie"><span>Match à mort</span></label>
      <label><input type="radio" name="regleChat" value="temps"><span>Chrono</span></label>
    </div>
    <div class="choix-niveau" style="grid-template-columns:1fr 1fr">
      <label><input type="radio" name="modeChat" value="libre" checked><span>Chacun pour soi</span></label>
      <label><input type="radio" name="modeChat" value="equipes"><span>En équipes</span></label>
    </div>
    <button class="plein large" id="lancerPartieChat">Créer et envoyer</button>
    <div id="mesPartiesChat"></div>`;
  $('lancerPartieChat').onclick = async () => {
    const regle = zone.querySelector('input[name="regleChat"]:checked').value;
    const mode = zone.querySelector('input[name="modeChat"]:checked').value;
    try {
      const i = await C.creerInstance(`Partie de ${(C.compte() || {}).pseudo || 'Camille'}`.slice(0, 40), mode, true, 0, 'soldat', regle, 1, 180);
      await C.envoyerMessage(convOuverte.id, '', i.code);
      zone.classList.add('cache');
      await suivre();
      toast(`Partie envoyée — code ${i.code}. Clique « Entrer » quand tu es prêt.`);
    } catch (e) { toast(e.message, { erreur: true }); }
  };
  // ou envoyer une partie déjà ouverte
  try {
    const l = await C.mesInstances();
    if (l.length) {
      $('mesPartiesChat').innerHTML = `<div class="sous-titre">Ou envoyer une de tes parties</div><ul class="liste-joueurs">${l.slice(0, 5).map((i) =>
        `<li class="ligne-joueur"><span class="nom">${ECH(i.nom)}<small>${ECH(resumePartie(i))}</small></span><span class="actions"><button class="mini" data-envoyer="${ECH(i.code)}">Envoyer</button></span></li>`).join('')}</ul>`;
      $('mesPartiesChat').querySelectorAll('[data-envoyer]').forEach((b) => { b.onclick = async () => {
        try { await C.envoyerMessage(convOuverte.id, '', b.dataset.envoyer); zone.classList.add('cache'); await suivre(); }
        catch (e) { toast(e.message, { erreur: true }); } }; });
    }
  } catch (e) { /* la liste est un plus */ }
}
