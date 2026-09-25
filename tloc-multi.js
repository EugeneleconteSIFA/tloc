// tloc-multi.js — les parties nommées et le jeu à plusieurs, greffés sur le moteur.
//
// Ce fichier est chargé par index.html APRÈS game.js. Il n'écrit dans aucun fichier du
// moteur : il importe engine.js (le même module, la même instance) en lecture, et fait
// tourner sa propre boucle d'animation à côté de celle du jeu.
//
// Il fait trois choses :
//   1. il recopie la sauvegarde du moteur (`tloc_save_v2`) dans la partie ouverte depuis
//      l'accueil, et la pousse sur le compte si le joueur en a un ;
//   2. il ajoute un bouton « Accueil » discret ;
//   3. si une instance a été rejointe, il connecte le salon : avatars des autres joueurs,
//      coups d'épée et flèches entre joueurs, morts et réapparitions.
//
// Le monde reste local à chacun : les monstres, les coffres et les quêtes ne sont pas
// synchronisés. Ce qui circule, ce sont les joueurs et les coups qu'ils se portent.

import * as C from './tloc-compte.js?v=1';
import * as BOURSE from './bourse.js';
import * as LOOK from './look.js';
import * as ATLAS from './atlas.js';
import * as PNJ from './pnj.js';
import { TOWN, sdEau, townWorld } from './carte.js';
import { PARTAGE } from './etat.js';
import { FAUCHE_DEBUG } from './nature.js';
import {
  AIDE, G, SFX, THREE, TAU, addInteract, arrows, blocked, burst, camera, cut, enemies, getH, lerpAngle, lieux, makeArrow, makeBow, makeCamille,
  hideMenu, menu, player, saveGame, scene, showMenu, showMessage, state, tryMove, world,
} from './engine.js?v=27';

const ENVOIS_PAR_S = 15;
const PORTEE_EPEE = 2.6;
const DEGATS_EPEE = 1;        // un demi-cœur de moins qu'un coup de géant : les duels durent
const DEGATS_FLECHE = 2;
const INVULN = 0.9;

// =====================================================================
//  0. Où l'on joue : une partie solo, ou une instance
// =====================================================================
const inst = C.instance();
const actif = !!(inst && inst.code && C.connecte());
// en instance, le nom du personnage a été choisi à l'entrée ; en solo, c'est le nom de la partie
const monPerso = (actif && inst.perso) || C.nomPersonnage();

// =====================================================================
//  1. Ranger la sauvegarde : dans la partie en solo, à part en instance
// =====================================================================
// Une instance ne touche JAMAIS à une partie solo : elle a sa propre sauvegarde
// (`tloc_save_v2:inst:<CODE>`), qui ne monte pas sur le compte — c'est une balade, pas
// une progression.
const slot = actif ? null : C.slotActif();
let dernierBrut = null, dernierPoussee = 0;

function capturer(forcer = false) {
  const brut = localStorage.getItem(C.CLE_MOTEUR);
  if (!brut || (!forcer && brut === dernierBrut)) return;
  dernierBrut = brut;
  if (actif) { C.capturerInstance(inst.code); return; }
  if (!slot) return;
  C.capturer(slot);
  const t = Date.now();
  if (C.connecte() && (forcer || t - dernierPoussee > 30000)) {
    dernierPoussee = t;
    C.pousser(slot).catch(() => {});
  }
}
if (slot || actif) {
  dernierBrut = localStorage.getItem(C.CLE_MOTEUR);
  setInterval(() => capturer(), 3000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) capturer(true); });
  window.addEventListener('pagehide', () => capturer(true));
}

// =====================================================================
//  1 bis. En instance : la citadelle, les monstres, les duels — rien d'autre
// =====================================================================
// Une instance n'est pas une partie : ni cinématique d'ouverture, ni quête principale,
// ni quêtes secondaires, ni journal. On n'y arrive pas les mains vides pour autant —
// Camille entre avec l'épée de Lydéric, sinon il n'y aurait rien à faire.
//
// Rien de tout cela ne modifie le moteur : on pose des drapeaux dans `state` AVANT que
// le niveau ne se peuple (bootLevel a déjà rangé le niveau dans G.level, mais
// `populate()` attend la fin de la construction), et on remplace deux fonctions du
// niveau — celles que le moteur appelle pour afficher les compteurs et le message
// d'arrivée. L'objet `level` de game.js n'est pas touché sur le disque : seule
// l'instance en mémoire de cette page l'est.
if (actif) {
  Object.assign(state, {
    introSeen: true,          // pas d'enlèvement du prince en ouverture
    sword: true,              // l'épée est déjà au fourreau
    metLyderic: true,         // ... donc plus besoin d'aller la chercher
    q_cat: 3, q_crows: 3, q_ghosts: 3,   // les villageois n'ont rien à demander
    bourse: true, bourseChest: true,     // même équipement pour tout le monde : les duels restent justes
  });

  // l'aide des touches (engine.js) : pas de journal en instance, mais le chat
  AIDE.sansJournal = true;
  AIDE.extra.push(['T', 'écrire aux autres']);
  // le journal n'aurait plus rien à montrer : on intercepte J avant le moteur
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ' && !menu.active) {
      e.stopImmediatePropagation();
      showMessage('Pas de journal en instance : ici, on se balade et on se bat.', 2.5);
    }
  }, true);

  // les compteurs du HUD, sans la ligne « Objectif » de la quête principale
  const comptesInstance = () => {
    const c = { fosses: 0, remparts: 0, bastions: 0 };
    for (const e of enemies) if (!e.dead && c[e.zone] !== undefined) c[e.zone]++;
    const boss = enemies.find(e => e.k && e.k.boss);
    const tenus = [];
    if (state.bow) tenus.push('Arc ✓');
    if (state.key) tenus.push('Clé du donjon ✓');
    return `Monstres vaincus <b>${state.kills}</b> &nbsp; Fossés <b>${c.fosses}</b>`
      + `${state.bow ? '' : ' <small>(arc requis)</small>'} &nbsp; Remparts <b>${c.remparts}</b>`
      + ` &nbsp; Bastions <b>${c.bastions}</b><br>`
      + (tenus.length ? tenus.join(' &nbsp; ') + ' &nbsp; ' : '')
      + (boss ? (boss.dead ? 'Phinaert <b>vaincu</b>'
        : (state.gateOpen ? 'Phinaert <b>libre !</b>' : 'Phinaert <b>enfermé au donjon</b>')) : '')
      + `<br><small>Instance « ${inst.nom} » — balade et duels, pas de quête.</small>`
      + BOURSE.ligneHUD();
  };

  if (G.level) {
    G.level.counts = comptesInstance;
    G.level.start = () => showMessage(
      `${monPerso} entre dans la citadelle. Ici, pas de quête : les monstres, les remparts, et les autres joueurs.`, 6);
    G.level.arriveMessage = () => `De retour dans l\u2019instance « ${inst.nom} ».`;
    G.level.entry = () => null;      // pas de scène d'arrivée scénarisée
  }
}

// =====================================================================
//  2. Retour à l'accueil, et des menus qui répondent à la souris
// =====================================================================
// Le moteur ne pilote ses menus qu'au clavier : `menu.items` est une liste, les flèches
// déplacent `menu.sel`, Entrée appelle `fn()`. On ne touche pas à ce code — on se greffe
// dessus : un clic sur une ligne appelle le même `fn()`, et on ajoute une entrée
// « Accueil » à la liste, qui devient donc navigable au clavier ET à la souris.

function allerAccueil() {
  capturer(true);
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  setTimeout(() => { location.href = 'accueil.html'; }, 120);
}

{
  const ov = document.getElementById('overlay');
  const ovgo = document.getElementById('ovgo');

  const style = document.createElement('style');
  style.textContent = `#ovgo .mitem { cursor:pointer; transition:opacity .12s; }
                       #ovgo .mitem:hover { opacity:1; }`;
  document.head.appendChild(style);

  // même rendu que celui du moteur, pour que l'affichage reste cohérent après un clic
  const rendre = () => {
    if (!ovgo) return;
    ovgo.innerHTML = menu.items
      .map((it, i) => `<div class="mitem${i === menu.sel ? ' sel' : ''}">${i === menu.sel ? '▶ ' : ''}${it.label}</div>`)
      .join('');
  };

  const greffer = () => {
    if (!menu.active || menu.items.some(it => it.accueilTLOC)) return;
    // seulement le menu titre et le menu pause : dans une boutique ou un choix de dialogue,
    // « Accueil » ferait quitter le jeu d'un clic égaré
    if (!menu.items.some(it => /^(Reprendre|Nouvelle partie|Continuer)/.test(it.label))) return;
    menu.items.push({ label: '← Accueil', accueilTLOC: true, fn: allerAccueil });
    rendre();
  };

  if (ovgo) {
    const indice = (cible) => {
      const el = cible && cible.closest ? cible.closest('.mitem') : null;
      return el ? [...ovgo.children].indexOf(el) : -1;
    };
    ovgo.addEventListener('mousemove', (e) => {
      const i = indice(e.target);
      if (i >= 0 && menu.active && i !== menu.sel) { menu.sel = i; rendre(); }
    });
    ovgo.addEventListener('click', (e) => {
      const i = indice(e.target);
      if (i < 0 || !menu.active) return;
      const it = menu.items[i];
      if (!it) return;
      menu.sel = i; rendre();
      it.fn();
    });
    new MutationObserver(greffer).observe(ovgo, { childList: true });
  }
  if (ov) new MutationObserver(greffer).observe(ov, { attributes: true, attributeFilter: ['class'] });
  setInterval(greffer, 600);      // filet : un menu ouvert sans mutation observée
  greffer();

  // bouton de coin, pour sortir sans passer par la pause ; masqué quand la souris est
  // capturée par le jeu, où il ne servirait à rien
  const b = document.createElement('button');
  b.textContent = '← Accueil';
  b.tabIndex = -1;
  b.style.cssText = `position:fixed; left:14px; bottom:12px; z-index:2000; font-family:inherit;
    font-size:14px; padding:9px 16px; border-radius:6px; cursor:pointer; color:#EDE3CC;
    background:rgba(10,14,23,.8); border:1px solid rgba(237,227,204,.28); opacity:.6;
    transition:opacity .2s; pointer-events:auto;`;
  b.onmouseenter = () => { b.style.opacity = '1'; };
  b.onmouseleave = () => { b.style.opacity = '.6'; };
  b.onclick = (e) => { e.preventDefault(); b.blur(); allerAccueil(); };
  document.body.appendChild(b);
  document.addEventListener('pointerlockchange', () => {
    b.style.display = document.pointerLockElement ? 'none' : '';
  });
}

// =====================================================================
//  3. Le salon
// =====================================================================
const autres = new Map();          // id -> { pseudo, mesh, cible, etat, hp, maxHp, frags, plaque }
let ws = null, moi = null, essais = 0, dernierEnvoi = 0, dernierAgresseur = null;
let apparition = null, apparitionT = 0, dernierLook = 0;
let estHote = false, rdv = null;   // le rendez-vous : le premier point choisi par l'hôte

// ---------------------------------------------------------------------
//  Le mode en équipes
// ---------------------------------------------------------------------
// Choisi à la création de l'instance (accueil.js). Deux camps : la garnison de la citadelle
// contre les gens du bourg. Le camp teint la tunique (une zone de look.js imposée : on se
// reconnaît de loin) et la plaque du nom ; le serveur refuse les coups entre alliés et
// compte les mises à terre par camp. Chaque camp a son point de ralliement, posé par le
// premier des siens qui entre.
const CAMPS = {
  garnison: { nom: 'La garnison', tunique: 0, couleur: '#9cc8ff' },
  bourg: { nom: 'Les gens du bourg', tunique: 1, couleur: '#ff9c8c' },
};
let mode = 'libre', enjeu = false, points = { garnison: 0, bourg: 0 }, effectifs = { garnison: 0, bourg: 0 };
const enEquipes = () => mode === 'equipes';
const memeCamp = (a) => enEquipes() && state.camp && a.camp === state.camp;
// le rendez-vous qui me concerne : celui de l'hôte, ou celui de mon camp
const monRdv = () => (enEquipes() ? (rdv && state.camp ? rdv[state.camp] : null) : (rdv && rdv.x !== undefined ? rdv : null));
// l'apparence d'un joueur, avec la tunique de son camp par-dessus
function lookDe(look, camp) {
  const L = LOOK.normaliser(look);
  if (enEquipes() && CAMPS[camp]) L.tunique = CAMPS[camp].tunique;
  return L;
}

const panneau = document.createElement('div');
if (actif) {
  panneau.style.cssText = `position:absolute; right:16px; top:196px; font-size:13px; line-height:1.55;
    text-align:right; color:#fff; text-shadow:0 2px 3px rgba(0,0,0,.8);`;
  (document.getElementById('hud') || document.body).appendChild(panneau);
}

// les noms de personnage viennent des autres joueurs : du texte, jamais du HTML
const ech = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function peindrePanneau() {
  if (!actif) return;
  const lignes = [`<b style="color:#ffe7a3">${ech(inst.nom)}</b> <span style="opacity:.7">${ech(inst.code)}</span>`];
  if (enEquipes()) {
    const G_ = CAMPS.garnison, B_ = CAMPS.bourg;
    lignes.push(`<b style="color:${G_.couleur}">Garnison ${points.garnison}</b> — <b style="color:${B_.couleur}">${points.bourg} Bourg</b>`
      + (state.camp ? ` <span style="opacity:.7">(tu es ${state.camp === 'garnison' ? 'de la garnison' : 'du bourg'})</span>` : ''));
    if (bannieres) {
      const etat = (c) => { const b = bannieres[c]; if (!b) return '—';
        if (b.etat === 'base') return 'chez elle'; if (b.etat === 'tombee') return 'à terre';
        return 'portée par ' + ech(moi && b.porteur === moi.id ? 'toi' : ((autres.get(b.porteur) || {}).perso || '…')); };
      lignes.push(`<span style="opacity:.85;font-size:12px">bannières : <span style="color:${CAMPS.garnison.couleur}">${etat('garnison')}</span> · <span style="color:${CAMPS.bourg.couleur}">${etat('bourg')}</span></span>`);
    }
  }
  const tous = [...autres.values()];
  if (!tous.length) lignes.push('<span style="opacity:.7">personne d’autre en ligne</span>');
  for (const a of tous) {
    const vivant = a.hp > 0;
    const compte = a.bot ? ` <span style="opacity:.5;font-size:11px">bot · ${ech(NIVEAUX[a.bot] ? NIVEAUX[a.bot].nom : a.bot)}</span>`
      : (a.perso !== a.pseudo ? ` <span style="opacity:.5;font-size:11px">${ech(a.pseudo)}</span>` : '');
    const teinte = !vivant ? '#8899aa' : (enEquipes() && CAMPS[a.camp] ? CAMPS[a.camp].couleur : '#c9e6ff');
    const sc = scoreManche(a.id);
    lignes.push(`<span style="color:${estElimine(a.id) ? '#8899aa' : teinte}">${ech(a.perso)}</span>${compte}` +
      (estElimine(a.id) ? ' <span style="opacity:.7">éliminé</span>'
        : ` <span style="color:#ff7b6b">${'♥'.repeat(Math.max(0, Math.round(a.hp / 2)))}</span>`) +
      (sc !== null ? ` <b style="color:#ffe7a3">${sc > 0 ? '+' : ''}${sc}</b>`
        : (viesDe(a.id) !== null && !estElimine(a.id) && (manche.vies_max || 1) > 1 ? ` <span style="opacity:.8">${viesDe(a.id)} v.</span>`
          : (a.frags ? ` <span style="opacity:.7">${a.frags}</span>` : ''))));
  }
  panneau.innerHTML = lignes.join('<br>');
}

// ---------------------------------------------------------------------
//  Avatars distants
// ---------------------------------------------------------------------
function plaque(pseudo, couleur = '#ffe7a3') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = 'bold 34px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(10,14,30,.85)'; g.strokeText(pseudo, 128, 34);
  g.fillStyle = couleur; g.fillText(pseudo, 128, 34);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(3.2, 0.8, 1); s.position.y = 3.3; s.renderOrder = 999;
  return s;
}

// Les autres joueurs sont des Camille de la banque, comme la sienne : l'ancienne version
// en primitives ne reste qu'en repli, si la banque d'assets n'a pas pu se charger.
// Chacun porte l'apparence qu'il a choisie à l'armoire — elle arrive par le salon.
function fabriquerAvatar(look, camp = null) {
  let mesh = PNJ.dispo() ? PNJ.buildCamille(makeBow) : null;
  if (!mesh) { mesh = makeCamille(); mesh.userData.sword.visible = true; }
  LOOK.appliquerSur(mesh, lookDe(look, camp));
  return mesh;
}
const couleurPlaque = (camp) => (enEquipes() && CAMPS[camp] ? CAMPS[camp].couleur : '#ffe7a3');

// le camp d'un autre joueur a changé (ou vient d'être connu) : tunique et plaque
function habillerCamp(a) {
  LOOK.appliquerSur(a.mesh, lookDe(a.look, a.camp));
  if (a.plaque) a.mesh.remove(a.plaque);
  a.plaque = plaque(a.perso, couleurPlaque(a.camp)); a.mesh.add(a.plaque);
}

function creerAutre(id, pseudo, etat = {}, perso = '', look = null, camp = null) {
  const mesh = fabriquerAvatar(look, camp);
  const p = etat.p || [0, 0, 0];
  mesh.position.set(p[0], p[1], p[2]);
  const nom = plaque(perso || pseudo, couleurPlaque(camp));
  mesh.add(nom);
  scene.add(mesh);
  const a = {
    id, pseudo, perso: perso || pseudo, mesh, plaque: nom, hp: etat.hp ?? 12, maxHp: etat.mx ?? 12, frags: 0,
    look: LOOK.normaliser(look), act: 0, camp,
    cible: new THREE.Vector3(p[0], p[1], p[2]), yaw: etat.y || 0, yawCible: etat.y || 0,
    niveau: etat.n || 'citadel', marche: 0, anim: Math.random() * 10, vu: etat.p ? performance.now() : -1e9,
    faux: { attackT: -1, rollT: -1, invuln: 0, onGround: true }, rougeur: 0, rougi: false,
    ctx: { walking: false, running: false, epeeSortie: true, arcTrouve: false },
  };
  autres.set(id, a);
  peindrePanneau();
  return a;
}

function refaireAvatar(a) {
  const ancien = a.mesh, neuf = fabriquerAvatar(a.look, a.camp);
  if (!neuf.userData.perso) return;
  neuf.position.copy(ancien.position); neuf.rotation.y = ancien.rotation.y;
  if (a.plaque) neuf.add(a.plaque);
  scene.remove(ancien); scene.add(neuf);
  a.mesh = neuf; a.rougi = false;
}

function retirerAutre(id) {
  const a = autres.get(id);
  if (!a) return;
  scene.remove(a.mesh);
  autres.delete(id);
  peindrePanneau();
}

// ---------------------------------------------------------------------
//  Connexion
// ---------------------------------------------------------------------
function envoyer(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

// L'apparence ne part qu'à l'arrivée et quand elle change : quinze fois par seconde dans
// le message « etat », elle aurait coûté plus que la position pour ne rien dire de neuf.
let lookEnvoye = '';
function envoyerLook(forcer = false) {
  if (!ws || ws.readyState !== 1) return;
  const L = LOOK.look(), sig = JSON.stringify(L);
  if (!forcer && sig === lookEnvoye) return;
  lookEnvoye = sig;
  envoyer({ t: 'look', l: L });
}

function connecter() {
  if (!actif) return;
  ws = new WebSocket(C.urlSalon(inst.code, monPerso));
  ws.onopen = () => { essais = 0; };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'bienvenue') {
      moi = m.moi;
      estHote = !!m.hote; rdv = m.rdv || null;
      mode = m.mode || 'libre'; enjeu = !!m.enjeu; regle = m.regle || 'balade';
      if (m.points) points = m.points;
      if (m.camps) effectifs = m.camps;
      // de retour dans une instance en équipes : on redit son camp au salon
      if (enEquipes() && CAMPS[state.camp]) envoyer({ t: 'camp', camp: state.camp });
      // l'hôte a pu choisir son point avant que le salon ne réponde : on l'annonce maintenant
      if (!enEquipes() && estHote && !rdv && state.apparition) poserRdv(state.apparition);
      for (const j of m.joueurs) { const a = creerAutre(j.id, j.pseudo, j.etat || {}, j.perso, j.look, j.camp); a.frags = j.frags || 0; a.bot = j.bot || null; }
      if (m.pilote && m.pilote.length) prendreBots(m.pilote);
      for (const b of m.bourses || []) poserBourse(b);
      majObjets({ objets: m.objets || [] });
      if (m.bannieres) bannieres = m.bannieres;
      if (m.fete) ouvrirFete(m.fete);
      envoyerLook(true);
      showMessage(`Instance « ${m.nom} » — code ${m.code}. ${m.joueurs.length ? m.joueurs.map(j => j.perso || j.pseudo).join(', ') + ' déjà là.' : 'Tu es seul pour l’instant.'} T pour écrire aux autres.`, 5);
      peindrePanneau();
    } else if (m.t === 'arrivee') {
      creerAutre(m.id, m.pseudo, {}, m.perso);
      showMessage(`${m.perso || m.pseudo} vient d’entrer dans la citadelle.`, 3);
    } else if (m.t === 'depart') {
      retirerAutre(m.id);
      showMessage(`${m.perso || m.pseudo} a quitté la partie.`, 2.5);
    } else if (m.t === 'manche') {
      majManche(m);
    } else if (m.t === 'pilote') {
      prendreBots(m.bots || []);
    } else if (m.t === 'pour-bot') {
      recevoirPourBot(m.b, m.m || {});
    } else if (m.t === 'etat') {
      if (bots.has(m.id)) return;          // mes bots : c'est moi qui sais où ils sont
      const a = autres.get(m.id) || creerAutre(m.id, 'Joueur');
      if (m.p) a.cible.set(m.p[0], m.p[1], m.p[2]);
      if (typeof m.y === 'number') a.yawCible = m.y;
      a.act = m.a | 0;
      if (typeof m.hp === 'number' && m.hp !== a.hp) {
        if (m.hp < a.hp) blesser(a);
        a.hp = m.hp; peindrePanneau();
      }
      if (m.mx) a.maxHp = m.mx;
      a.ctx.armure = m.ar | 0; a.ctx.bouclier = m.bc | 0; a.ctx.garde = !!m.gd;
      a.niveau = m.n || 'citadel';
      a.vu = performance.now();
    } else if (m.t === 'rdv') {
      if (m.camp) rdv = { ...(rdv && rdv.x === undefined ? rdv : {}), [m.camp]: { x: m.x, z: m.z, nom: m.nom } };
      else rdv = { x: m.x, z: m.z, nom: m.nom };
    } else if (m.t === 'look') {
      const a = autres.get(m.id);
      if (a) { a.look = LOOK.normaliser(m.l); LOOK.appliquerSur(a.mesh, lookDe(a.look, a.camp)); }
    } else if (m.t === 'camp') {
      if (m.camps) effectifs = m.camps;
      const a = autres.get(m.id);
      if (a && a.camp !== m.camp) { a.camp = m.camp; habillerCamp(a); }
      peindrePanneau();
    } else if (m.t === 'camp-refuse') {
      effectifs = m.camps || effectifs;
      state.camp = null;
      showMessage('Ce camp a déjà deux joueurs de plus que l’autre : rejoins l’autre, pour que la partie reste juste.', 5);
      choisirCamp(() => {});
    } else if (m.t === 'fete') { ouvrirFete(m);
    } else if (m.t === 'fete-score') { majFete(m);
    } else if (m.t === 'fete-fin') { finirFete(m);
    } else if (m.t === 'banniere') { evenementBanniere(m);
    } else if (m.t === 'bourse') { poserBourse(m);
    } else if (m.t === 'bourse-prise') { prendreBourse(m);
    } else if (m.t === 'objets') { majObjets(m);
    } else if (m.t === 'don') {
      BOURSE.gagner(m.n);
      showMessage(`${m.perso} te donne ${m.n} écus.`, 3.5);
    } else if (m.t === 'touche') {
      dernierAgresseur = m.de;
      encaisser(m.d, m.p ? m.p[0] : player.pos.x, m.p ? m.p[1] : player.pos.z, m.de, m.perso || m.pseudo, m.k);
    } else if (m.t === 'mort') {
      if (m.scores) for (const s of m.scores) { const a = autres.get(s.id); if (a) { a.frags = s.frags; a.hp = s.etat && s.etat.hp != null ? s.etat.hp : a.hp; } }
      if (m.points) points = m.points;
      if (m.id !== (moi && moi.id)) {
        const tombe = m.perso || m.pseudo, tueur = m.parPerso || m.parPseudo;
        showMessage(tueur ? `${tueur} a mis ${tombe} à terre.` : `${tombe} est tombé.`, 3);
      }
      peindrePanneau();
    } else if (m.t === 'chat') {
      noterChat(m.perso || m.pseudo, m.m, moi && m.id === moi.id);
    }
  };
  ws.onclose = (ev) => {
    ws = null;
    bots.clear();
    for (const id of [...autres.keys()]) retirerAutre(id);
    if (ev.code === 4003) return showMessage('Instance complète. Tu joues en solo.', 5);
    if (ev.code === 4009) return showMessage('Cette partie a été reprise dans un autre onglet.', 5);
    if (ev.code === 4001 || ev.code === 4004) return showMessage('Instance inaccessible — repasse par l’accueil.', 5);
    if (essais++ < 20) setTimeout(connecter, Math.min(15000, 1500 * essais));
    else showMessage('Connexion au salon perdue. Tu continues en solo.', 5);
  };
}

// ---------------------------------------------------------------------
//  Entrer dans une instance : l'apparence, puis l'endroit
// ---------------------------------------------------------------------
// À la première entrée (rien dans la sauvegarde de l'instance), on passe par l'armoire —
// chacun sa Camille, c'est elle que les autres verront — puis par la carte, pour choisir
// où l'on apparaît. Ce point est gardé dans `state` : c'est aussi là qu'on se relève.
let entreeFaite = false;
function premiereEntree() {
  if (entreeFaite || !state.running || state.paused || state.over || menu.active || cut.active) return;
  entreeFaite = true;
  // en équipes, le camp se choisit une fois — y compris dans une instance déjà visitée
  // avant qu'elle ne passe en équipes (un point d'apparition, mais pas de camp)
  if (state.apparition) { if (enEquipes() && !CAMPS[state.camp]) choisirCamp(() => {}); return; }
  LOOK.ouvrirArmoire(() => (enEquipes() ? choisirCamp(choisirApparition) : choisirApparition()));
  showMessage('Choisis ton apparence : c’est elle que les autres joueurs verront.', 5);
}

// Le choix du camp : un menu du moteur, avec les effectifs — on voit où l'on manque.
function choisirCamp(suite) {
  state.paused = true;
  const ligne = (c) => `${CAMPS[c].nom} — ${effectifs[c] || 0} joueur${(effectifs[c] || 0) > 1 ? 's' : ''}`;
  const prendre = (c) => {
    state.camp = c;
    LOOK.look().tunique = CAMPS[c].tunique;          // on porte ses couleurs, soi aussi
    envoyer({ t: 'camp', camp: c });
    hideMenu(); state.paused = false; saveGame(true);
    showMessage(`${CAMPS[c].nom} : ta tunique en porte les couleurs. Pas de coup entre alliés.`, 4);
    peindrePanneau();
    suite();
  };
  showMenu('Choisis ton camp', 'Instance en équipes',
    'La garnison de la citadelle contre les gens du bourg. Les coups entre alliés ne portent pas ; chaque mise à terre d’un adversaire rapporte un point à ton camp.',
    [{ label: ligne('garnison'), fn: () => prendre('garnison') }, { label: ligne('bourg'), fn: () => prendre('bourg') }]);
}

// Un endroit où l'on peut se tenir : ni dans l'eau, ni dans un mur, ni hors des limites.
// Le clic n'a pas à tomber pile — on cherche en spirale autour, jusqu'à trente mètres.
// Le sol est celui du terrain (levelH), pas getH : sinon on apparaîtrait sur un toit.
function praticable(x, z) {
  for (let r = 0; r <= 30; r += 1.5) {
    const n = r ? Math.ceil(r * 2) : 1;
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (world.bounds && world.bounds(px, pz)) continue;
      if (sdEau(px, pz) < 2) continue;
      const y = world.levelH ? world.levelH(px, pz) : 0;
      if (blocked(px, pz, 0.8, false, y)) continue;
      const nom = world.zoneName ? world.zoneName(px, pz) : '';
      return { x: px, z: pz, nom };
    }
  }
  return null;
}

async function choisirApparition() {
  const pre = monRdv();
  const p = await ATLAS.choisirPoint(praticable, enEquipes() ? pre : (estHote ? null : pre));
  if (p) {
    player.pos.set(p.x, getH(p.x, p.z, (world.levelH ? world.levelH(p.x, p.z) : 0) + 0.5) + 0.1, p.z);
    player.vy = 0; player.kb.set(0, 0, 0);
    showMessage(p.nom ? `${monPerso} arrive : ${p.nom}.` : `${monPerso} arrive.`, 4);
  }
  state.apparition = { x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2) };
  apparition = player.pos.clone();
  saveGame(true);
  envoyerLook(true);
  // le premier de son camp (en équipes) ou l'hôte (chacun pour soi) pose le ralliement
  if (enEquipes() ? !monRdv() : (estHote && !rdv)) poserRdv({ ...state.apparition, nom: p && p.nom });
}

function poserRdv(c) {
  const nom = c.nom || (world.zoneName ? world.zoneName(c.x, c.z) : '');
  if (enEquipes()) rdv = { ...(rdv && rdv.x === undefined ? rdv : {}), [state.camp]: { x: c.x, z: c.z, nom } };
  else rdv = { x: c.x, z: c.z, nom };
  envoyer({ t: 'rdv', x: c.x, z: c.z, nom });
}

// ---------------------------------------------------------------------
//  Un coup se voit chez tout le monde
// ---------------------------------------------------------------------
// Le salon ne dit pas « untel est touché » à tout le monde : seule la victime le sait. Mais
// elle renvoie ses cœurs quinze fois par seconde — une baisse suffit donc à le montrer :
// l'avatar rougit, lâche une gerbe, et joue le clip « touché ».
function blesser(a) {
  a.rougeur = 0.35;
  a.faux.invuln = 0.9;
  const p = a.mesh.position;
  burst(p.x, p.y + 1.2 * (G.echelle || 1), p.z, 0xff6060, 10, 4, 0.5);
}

// l'émissif rouge : on ne touche aux matériaux qu'au changement d'état, pas à chaque image
function rougir(a, oui) {
  if (!!a.rougi === oui) return;
  a.rougi = oui;
  // un matériau peut servir à plusieurs maillages : sans ce registre, le second passage
  // relevait comme « couleur d'origine » le rouge posé par le premier, et le gardait
  const vus = new Set();
  a.mesh.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.emissive || vus.has(m)) continue;
      vus.add(m);
      if (oui) { m.userData.emisTLOC = m.emissive.getHex(); m.emissive.setHex(0x8a1010); }
      else if (m.userData.emisTLOC !== undefined) { m.emissive.setHex(m.userData.emisTLOC); delete m.userData.emisTLOC; }
    }
  });
}

// ---------------------------------------------------------------------
//  Le chat : T pour écrire, Entrée pour envoyer
// ---------------------------------------------------------------------
// Les cinq derniers messages sous la liste des joueurs, qui s'effacent au bout de vingt
// secondes. Pendant qu'on écrit, le clavier est à la boîte : sans ça, chaque Z, Q, S, D
// ferait marcher Camille. Les relâchements de touche passent quand même, sinon une touche
// tenue en ouvrant la boîte resterait enfoncée pour le moteur.
const journal = [];
let boite = null;
const zoneChat = document.createElement('div');
if (actif) {
  zoneChat.style.cssText = `position:absolute; right:16px; top:330px; width:320px; font-size:13px; line-height:1.45;
    text-align:right; color:#fff; text-shadow:0 2px 3px rgba(0,0,0,.85); pointer-events:none;`;
  (document.getElementById('hud') || document.body).appendChild(zoneChat);
}

function noterChat(nom, texte, deMoi) {
  journal.push({ nom, texte, deMoi, t: performance.now() });
  if (journal.length > 5) journal.shift();
  peindreChat();
  if (!deMoi) try { SFX.pickup(); } catch (e) {}
}

function peindreChat() {
  const t = performance.now();
  zoneChat.replaceChildren(...journal.filter((l) => t - l.t < 20000).map((l) => {
    const d = document.createElement('div');
    const b = document.createElement('b');
    b.style.color = l.deMoi ? '#ffe7a3' : '#c9e6ff';
    b.textContent = l.nom + ' : ';
    d.append(b, document.createTextNode(l.texte));
    return d;
  }));
}

function ouvrirChat() {
  if (boite) return;
  boite = document.createElement('input');
  boite.maxLength = 200;
  boite.placeholder = 'Message à tous — Entrée pour envoyer, Échap pour annuler';
  boite.style.cssText = `position:fixed; left:50%; bottom:64px; transform:translateX(-50%); width:min(560px, 86vw);
    z-index:2001; font:inherit; font-size:15px; padding:9px 14px; border-radius:9px; color:#fff;
    background:rgba(10,14,30,.88); border:1px solid rgba(255,231,163,.45); outline:none;`;
  document.body.appendChild(boite);
  boite.focus();
}
function fermerChat(envoi) {
  if (!boite) return;
  const texte = boite.value.trim();
  boite.remove(); boite = null;
  if (!envoi || !texte) return;
  if (texte.startsWith('/')) commande(texte); else envoyer({ t: 'chat', m: texte });
}

// Les commandes du chat : ce qui n'a pas besoin d'un bouton à soi.
function commande(texte) {
  const [c, ...args] = texte.slice(1).trim().split(/\s+/);
  const cle = (c || '').toLowerCase();
  if (cle === 'fete' || cle === 'fête') {
    if (!estHote) return noterChat('✦', 'Seul l’hôte de l’instance lance la fête de la moisson.', true);
    if (fete) return noterChat('✦', 'La fête bat déjà son plein.', true);
    envoyer({ t: 'fete' });
  } else if (cle === 'donner') {
    const n = parseInt(args[args.length - 1], 10), nom = args.slice(0, -1).join(' ').toLowerCase();
    const a = [...autres.values()].find((x) => x.perso.toLowerCase() === nom) || [...autres.values()].find((x) => x.perso.toLowerCase().startsWith(nom));
    if (!nom || !(n > 0)) return noterChat('✦', 'Donner : /donner Nom 20', true);
    if (!a) return noterChat('✦', `Personne ne s’appelle « ${nom} » ici.`, true);
    if (!BOURSE.peutPayer(n)) return noterChat('✦', `Il te manque des écus (tu en as ${BOURSE.solde()}).`, true);
    BOURSE.payer(n); saveGame(true);
    envoyer({ t: 'don', a: a.id, n });
  } else {
    noterChat('✦', 'Commandes : /donner Nom 20 · /fete (l’hôte : trois minutes de moisson, le plus gros fauchage gagne)', true);
  }
}

// ---------------------------------------------------------------------
//  La fête de la moisson
// ---------------------------------------------------------------------
// Trois minutes : l'herbe, le blé et les meules comptent, le serveur tient les scores et
// proclame le vainqueur. On annonce au serveur ce qu'on a fauché depuis le dernier envoi
// (le compteur de nature.js), une fois par seconde — il écrête ce qui serait trop pour
// une lame. En équipes, ce sont les camps qui gagnent.
let fete = null, banniere = null, feteBase = 0, feteEnvoi = 0;
const PRIX_FETE = 30, PRIX_FETE_CAMP = 15;
function ouvrirFete(m) {
  fete = { fin: performance.now() + (m.reste || 0) * 1000, scores: m.scores || {}, noms: m.noms || {}, camps: m.camps || {} };
  feteBase = FAUCHE_DEBUG.coupees(); feteEnvoi = performance.now();
  if (!banniere) {
    banniere = document.createElement('div');
    banniere.style.cssText = `position:fixed; left:50%; top:14px; transform:translateX(-50%); z-index:5; pointer-events:none;
      padding:8px 18px; border-radius:10px; background:rgba(10,14,30,.8); border:1px solid rgba(255,231,163,.45);
      color:#fff; font-family:"Trebuchet MS",sans-serif; font-size:14px; text-align:center; text-shadow:0 1px 2px #000`;
    document.body.appendChild(banniere);
  }
  showMessage('La FÊTE DE LA MOISSON commence : trois minutes pour faucher plus que les autres ! Herbe, blé, meules : tout compte.', 5);
  peindreFete();
}
function majFete(m) { if (!fete) return; fete.scores = m.scores || fete.scores; if (m.reste != null) fete.fin = performance.now() + m.reste * 1000; peindreFete(); }
const nomDe = (id) => (moi && String(moi.id) === String(id) ? monPerso : (autres.get(+id) || {}).perso || (fete && fete.noms[id]) || 'un joueur');
const campDe = (id) => (moi && String(moi.id) === String(id) ? state.camp : (autres.get(+id) || {}).camp || (fete && fete.camps[id]));
function totauxCamps(scores) {
  const t = { garnison: 0, bourg: 0 };
  for (const [id, n] of Object.entries(scores)) { const c = campDe(id); if (t[c] !== undefined) t[c] += n; }
  return t;
}
function peindreFete(fin = null) {
  if (!banniere) return;
  const sc = Object.entries((fin || fete).scores).sort((a, b) => b[1] - a[1]);
  const reste = fin ? 0 : Math.max(0, Math.ceil((fete.fin - performance.now()) / 1000));
  const tete = fin ? '<b style="color:#ffe7a3">La fête est finie</b>'
    : `<b style="color:#ffe7a3">Fête de la moisson</b> — ${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, '0')}`;
  let corps = sc.slice(0, 4).map(([id, n], k) => `${k + 1}. ${ech(nomDe(id))} <b>${n}</b>`).join(' &nbsp; ');
  if (enEquipes()) { const t = totauxCamps((fin || fete).scores);
    corps = `<b style="color:${CAMPS.garnison.couleur}">Garnison ${t.garnison}</b> — <b style="color:${CAMPS.bourg.couleur}">${t.bourg} Bourg</b><br>` + corps; }
  banniere.innerHTML = `${tete}<br>${corps || '<span style="opacity:.7">personne n’a encore fauché</span>'}`;
}
function tickFete(now) {
  if (!fete) return;
  if (now - feteEnvoi > 1000) {
    feteEnvoi = now;
    const c = FAUCHE_DEBUG.coupees(), n = c - feteBase;
    if (n > 0) { feteBase = c; envoyer({ t: 'recolte', n }); }
    peindreFete();
  }
}
function finirFete(m) {
  if (banniere) { fete = fete || { scores: {} }; peindreFete(m); }
  fete = null;
  const sc = Object.entries(m.scores || {}).sort((a, b) => b[1] - a[1]);
  let texte;
  if (enEquipes()) {
    const t = totauxCamps(m.scores || {});
    const gagnant = t.garnison === t.bourg ? null : (t.garnison > t.bourg ? 'garnison' : 'bourg');
    texte = gagnant ? `${CAMPS[gagnant].nom} gagne la fête de la moisson (${t[gagnant]} contre ${t[gagnant === 'garnison' ? 'bourg' : 'garnison']}).` : 'Égalité parfaite entre les camps !';
    if (gagnant && gagnant === state.camp) { BOURSE.gagner(PRIX_FETE_CAMP); texte += ` Chacun des vainqueurs reçoit ${PRIX_FETE_CAMP} écus.`; }
  } else if (sc.length && sc[0][1] > 0) {
    const [id, n] = sc[0];
    texte = `${nomDe(id)} gagne la fête de la moisson avec ${n} plantes fauchées.`;
    if (moi && String(moi.id) === String(id)) { BOURSE.gagner(PRIX_FETE); texte += ` Le prix : ${PRIX_FETE} écus.`; }
  } else texte = 'La fête est finie… et personne n’a fauché un brin.';
  showMessage(texte, 7);
  setTimeout(() => { if (banniere && !fete) { banniere.remove(); banniere = null; } }, 9000);
}

// ---------------------------------------------------------------------
//  Les bannières (en équipes)
// ---------------------------------------------------------------------
// Chaque camp a sa bannière, plantée à son ralliement. Prendre celle de l'adversaire et la
// rapporter chez soi — pendant que la sienne y est encore — vaut trois points. Son porteur
// mis à terre la lâche sur place ; un allié qui la touche la renvoie chez elle, sinon elle
// y rentre seule au bout de trente secondes. Le serveur tient l'état et vérifie les
// distances ; le client la dessine et demande quand il est assez près.
let bannieres = null;
const autreCamp = (c) => (c === 'garnison' ? 'bourg' : 'garnison');
const COULEUR_DRAP = { garnison: 0x3f6f88, bourg: 0x8a2f3a };
const hampes = {};
function hampe(c) {
  if (hampes[c]) return hampes[c];
  const g = new THREE.Group();
  const bois = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 8), bois); m.position.y = 1.7; g.add(m);
  const pomme = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.8, roughness: 0.3 }));
  pomme.position.y = 3.45; g.add(pomme);
  const drapGeo = new THREE.PlaneGeometry(1.3, 0.85, 8, 1); drapGeo.translate(0.65, 0, 0);
  const drap = new THREE.Mesh(drapGeo, new THREE.MeshStandardMaterial({ color: COULEUR_DRAP[c], roughness: 0.9, side: THREE.DoubleSide }));
  drap.position.y = 2.9; g.add(drap); g.userData.drap = drap;
  // une bande claire au milieu : on distingue une bannière d'un linge qui sèche
  const bande = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.14), new THREE.MeshStandardMaterial({ color: 0xf0e0b0, roughness: 0.9, side: THREE.DoubleSide }));
  bande.geometry.translate(0.65, 0, 0.002); bande.position.y = 2.9; g.add(bande); g.userData.bande = bande;
  g.userData.dynamic = true; g.visible = false;
  scene.add(g);
  hampes[c] = g;
  return g;
}
let demandeBanniere = 0;
function tickBannieres(now) {
  if (!enEquipes() || !bannieres || !rdv || rdv.x !== undefined) return;
  const ech_ = G.echelle || 1;
  for (const c of ['garnison', 'bourg']) {
    const b = bannieres[c], h = hampe(c), base = rdv[c];
    if (!b || !base) { h.visible = false; continue; }
    h.visible = true; h.scale.setScalar(ech_ * 1.25);
    // le drap bat au vent
    const t = now / 1000;
    const pa = h.userData.drap.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, Math.sin(t * 3 + x * 3) * 0.08 * x); }
    pa.needsUpdate = true;
    if (b.etat === 'base') h.position.set(base.x, getH(base.x, base.z), base.z);
    else if (b.etat === 'tombee' && b.p) h.position.set(b.p[0], getH(b.p[0], b.p[1]) - 1.2 * ech_, b.p[1]);   // à moitié couchée
    else if (b.etat === 'portee') {
      const porteur = moi && b.porteur === moi.id ? player.mesh : (autres.get(b.porteur) || {}).mesh;
      if (porteur) h.position.set(porteur.position.x, porteur.position.y + 0.3 * ech_, porteur.position.z);
    }
    h.rotation.z = b.etat === 'tombee' ? 1.2 : 0;
  }
  // demander : au plus toutes les 700 ms
  if (!state.camp || now - demandeBanniere < 700) return;
  const ici = player.pos, d = (x, z) => Math.hypot(ici.x - x, ici.z - z), R = 3.2 * ech_;
  const adv = autreCamp(state.camp), bA = bannieres[adv], bM = bannieres[state.camp];
  const jePorte = moi && bA && bA.porteur === moi.id;
  if (jePorte && rdv[state.camp] && d(rdv[state.camp].x, rdv[state.camp].z) < R + 1) {
    demandeBanniere = now;
    if (bM.etat === 'base') envoyer({ t: 'rapporter' });
    else showMessage('Ta bannière n’est pas chez toi : reprends-la avant de marquer !', 2);
  } else if (!jePorte && bA && rdv[adv] && ((bA.etat === 'base' && d(rdv[adv].x, rdv[adv].z) < R) || (bA.etat === 'tombee' && bA.p && d(bA.p[0], bA.p[1]) < R))) {
    demandeBanniere = now; envoyer({ t: 'saisir', camp: adv });
  } else if (bM && bM.etat === 'tombee' && bM.p && d(bM.p[0], bM.p[1]) < R) {
    demandeBanniere = now; envoyer({ t: 'saisir', camp: state.camp });
  }
}
function evenementBanniere(m) {
  bannieres = m.bannieres || bannieres;
  if (m.points) points = m.points;
  const nomCamp = (c) => (c === 'garnison' ? 'la garnison' : 'du bourg'), deMoi = moi && m.id === moi.id;
  const drap = `la bannière ${m.camp === 'garnison' ? 'de la garnison' : 'du bourg'}`;
  if (m.evt === 'prise') showMessage(deMoi ? `Tu portes ${drap} ! Rapporte-la à ton ralliement.` : `${m.perso} s’empare de ${drap} !`, 4);
  else if (m.evt === 'tombe') showMessage(`${m.perso} lâche ${drap}.`, 3);
  else if (m.evt === 'rendue') showMessage(`${m.perso} ramène ${drap} chez elle.`, 3);
  else if (m.evt === 'rentre') showMessage(`${drap.charAt(0).toUpperCase() + drap.slice(1)} rentre à son ralliement.`, 3);
  else if (m.evt === 'marque') {
    const camp = autreCamp(m.camp);
    showMessage(`${m.perso} rapporte ${drap} : trois points pour ${camp === 'garnison' ? 'la garnison' : 'le bourg'} !`, 5);
    try { if (camp === state.camp) SFX.win(); } catch (e) {}
  }
  peindrePanneau();
}

// ---------------------------------------------------------------------
//  Les bourses tombées (bourse en jeu)
// ---------------------------------------------------------------------
const bourses = new Map();            // id -> { mesh, n, fin, demande }
function poserBourse(b) {
  if (bourses.has(b.id)) return;
  const g = new THREE.Group();
  const cuir = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 });
  const sac = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), cuir); sac.scale.y = 0.85; sac.position.y = 0.26; g.add(sac);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.14, 10), cuir); col.position.y = 0.52; g.add(col);
  const lien = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.8, roughness: 0.3 }));
  lien.rotation.x = Math.PI / 2; lien.position.y = 0.47; g.add(lien);
  const lueur = new THREE.PointLight(0xffd070, 2, 4); lueur.position.y = 0.7; g.add(lueur);
  const y = b.y != null ? b.y : getH(b.p[0], b.p[1]);
  g.position.set(b.p[0], y, b.p[1]); g.scale.setScalar((G.echelle || 1) * 1.4);
  g.userData.dynamic = true;
  scene.add(g);
  bourses.set(b.id, { mesh: g, n: b.n, fin: performance.now() + 90000, demande: 0 });
}
function prendreBourse(m) {
  const b = bourses.get(m.b);
  if (b) { scene.remove(b.mesh); bourses.delete(m.b); }
  if (moi && m.par === moi.id) { BOURSE.gagner(m.n, b ? b.mesh.position.clone().setY(b.mesh.position.y + 1) : null); showMessage(`Tu ramasses une bourse : ${m.n} écus.`, 3); }
  else showMessage(`${m.perso} ramasse la bourse (${m.n} écus).`, 3);
}
function tickBourses(now) {
  for (const [id, b] of bourses) {
    if (now > b.fin) { scene.remove(b.mesh); bourses.delete(id); continue; }
    b.mesh.rotation.y += 0.03;
    const d = Math.hypot(player.pos.x - b.mesh.position.x, player.pos.z - b.mesh.position.z);
    if (d < 1.6 && now - b.demande > 800) { b.demande = now; envoyer({ t: 'ramasser', b: id }); }
  }
}

if (actif) {
  window.addEventListener('keydown', (e) => {
    if (boite) {
      // tout le clavier va à la boîte ; la frappe elle-même se fait quand même, seuls les
      // écouteurs du jeu sont court-circuités
      e.stopImmediatePropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); fermerChat(true); }
      else if (e.code === 'Escape') { e.preventDefault(); fermerChat(false); }
      return;
    }
    if (e.code !== 'KeyT' || menu.active || cut.active || !state.running || state.paused || state.over) return;
    if (!ws || ws.readyState !== 1) return;
    e.stopImmediatePropagation(); e.preventDefault();
    ouvrirChat();
  }, true);
  setInterval(peindreChat, 2000);   // l'effacement des vieux messages
}

// ---------------------------------------------------------------------
//  L'équipement : l'armure et l'écu
// ---------------------------------------------------------------------
// Toujours aux mêmes endroits — l'armure aux casernes, l'écu sur la place d'Armes — pour
// qu'on apprenne où courir : une lueur, un point sur la minicarte, une annonce quand ils
// reviennent. Le serveur tranche qui les prend (premier arrivé) ; le reste se joue chez
// celui qui les porte, comme ses cœurs : l'écu pare les coups de face tant qu'on le lève
// (clic droit maintenu, engine.js), l'armure encaisse avant les cœurs et se fend. La forge
// du bourg les renforce contre des écus. Une manche neuve rend tout à sa place.
const ARMURE_PTS = [0, 4, 6, 8];            // demi-cœurs encaissés : cuir clouté, mailles, plates
const ARMURE_NOM = ['', 'cuir clouté', 'mailles', 'plates'];
const ECU_ANGLE = [0, 1.05, 1.45];           // demi-angle de parade : bois peint, cerclé de fer
const OBJET_LIEU = { armure: 'aux casernes', bouclier: 'sur la place d’Armes' };
let objets = [], objetsProposes = false, demandeObjet = 0, avisParade = 0;
let armure = 0, armurePts = 0, ecu = 0;       // ce que je porte (niveaux), et ce qu'il reste à l'armure
const presentoirs = new Map();                // type -> le râtelier posé à son lieu

// Où poser les objets : près du centre d'un lieu nommé, sur un sol praticable. Le premier
// client qui connaît la carte les propose ; le serveur garde ce premier choix pour tous.
function proposerObjets() {
  if (objetsProposes || !lieux.length || !state.running) return;
  const lieu = (f) => lieux.find(f);
  const caserne = lieu((l) => l.id.startsWith('caserne')), place = lieu((l) => l.id === 'place');
  const liste = [];
  for (const [type, l] of [['armure', caserne], ['bouclier', place]]) {
    if (!l) continue;
    const p = praticable(l.x, l.z);
    if (p) liste.push({ type, p: [+p.x.toFixed(2), +p.z.toFixed(2)], y: +getH(p.x, p.z).toFixed(2) });
  }
  objetsProposes = true;
  if (liste.length) envoyer({ t: 'objets-lieux', objets: liste });
}

function presentoir(type) {
  const g = new THREE.Group();
  const bois = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
  const fer = new THREE.MeshStandardMaterial({ color: 0x8d9096, metalness: 0.6, roughness: 0.45 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.14, 12), bois));
  const mat_ = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), bois); mat_.position.y = 0.8; g.add(mat_);
  if (type === 'armure') {
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.62, 16), fer); pl.scale.z = 0.75; pl.position.y = 1.22; g.add(pl);
    for (const sx of [-1, 1]) { const ep = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), fer); ep.scale.set(1.1, 0.55, 1); ep.position.set(sx * 0.3, 1.5, 0); g.add(ep); }
  } else {
    const forme = new THREE.Shape();
    forme.moveTo(-0.34, 0.4); forme.lineTo(0.34, 0.4); forme.lineTo(0.34, 0.04);
    forme.quadraticCurveTo(0.3, -0.36, 0, -0.54); forme.quadraticCurveTo(-0.3, -0.36, -0.34, 0.04); forme.closePath();
    const ecuM = new THREE.Mesh(new THREE.ExtrudeGeometry(forme, { depth: 0.05, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.75 }));
    ecuM.position.set(0, 1.1, 0.07); g.add(ecuM);
    const bande = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.84, 0.03), new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.7, roughness: 0.35 }));
    bande.position.set(0, 1.07, 0.13); g.add(bande);
  }
  const lueur = new THREE.PointLight(0xffd070, 3, 7); lueur.position.y = 1.9; g.add(lueur);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar((G.echelle || 1) / 0.6);     // à l'échelle de Camille (1,80 m dehors)
  g.userData.dynamic = true;
  return g;
}

function majObjets(m) {
  objets = m.objets || [];
  const moiId = moi && moi.id;
  // ce que je portais et que le serveur ne me donne plus (manche neuve, reprise) : rendu
  if (armure && !objets.some((o) => o.type === 'armure' && o.porteur === moiId)) { armure = 0; armurePts = 0; }
  if (ecu && !objets.some((o) => o.type === 'bouclier' && o.porteur === moiId)) ecu = 0;
  for (const o of objets) {
    let pr = presentoirs.get(o.type);
    if (!pr) { pr = presentoir(o.type); pr.position.set(o.p[0], o.y, o.p[1]); scene.add(pr); presentoirs.set(o.type, pr); }
    pr.visible = o.porteur == null && !o.retour;
  }
  PARTAGE.marques = objets.filter((o) => o.porteur == null && !o.retour)
    .map((o) => ({ x: o.p[0], z: o.p[1], fond: o.type === 'armure' ? '#c9ccd2' : '#d0463a', bord: '#1a1a1a' }));
  const qui = m.par === moiId ? null : (m.perso || 'Quelqu’un');
  const nom = m.o === 'armure' ? 'l’armure' : 'l’écu';
  if (m.evt === 'pris') {
    if (m.par === moiId) {
      if (m.o === 'armure') { armure = 1; armurePts = ARMURE_PTS[1]; showMessage(`Tu endosses l’armure de cuir clouté : elle encaisse ${ARMURE_PTS[1] / 2} cœurs avant les tiens. La forge du bourg la renforce.`, 6); }
      else { ecu = 1; showMessage('Tu prends l’écu ! Clic droit maintenu pour le lever : il pare les coups de face. La forge du bourg le cercle de fer.', 6); }
      try { SFX.pickup(); } catch (e) {}
    } else showMessage(`${qui} prend ${nom} ${OBJET_LIEU[m.o]}.`, 3);
  } else if (m.evt === 'casse' && m.par !== moiId) showMessage(`L’armure de ${qui} vole en éclats.`, 3);
  else if (m.evt === 'retour') showMessage(`Une armure neuve attend ${OBJET_LIEU.armure}.`, 4);
  else if (m.evt === 'raz' && objets.length) showMessage('Nouvelle manche : l’armure est aux casernes, l’écu sur la place d’Armes.', 5);
  peindreArmure();
}

function tickObjets(now) {
  if (!objets.length) proposerObjets();
  G.armure = armure; G.bouclier = ecu;          // le moteur : la garde et l'aide des touches
  for (const [type, pr] of presentoirs) {
    if (!pr.visible) continue;
    pr.rotation.y += 0.01;
    const o = objets.find((x) => x.type === type);
    if (!o || elimine || now - demandeObjet < 800) continue;
    if ((type === 'armure' && armure) || (type === 'bouclier' && ecu)) continue;     // déjà équipée
    if (Math.hypot(player.pos.x - pr.position.x, player.pos.z - pr.position.z) < 2.4) { demandeObjet = now; envoyer({ t: 'objet-prendre', o: type }); }
  }
}

// l'écu levé pare ce qui vient de face (le demi-angle grandit avec les ferrures)
function parer(fx, fz) {
  const p = player;
  if (!ecu || !p.garde) return false;
  const da = ((Math.atan2(fx - p.pos.x, fz - p.pos.z) - p.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (Math.abs(da) > ECU_ANGLE[ecu]) return false;
  burst(p.pos.x + Math.sin(p.yaw) * 0.6, p.pos.y + 1.2, p.pos.z + Math.cos(p.yaw) * 0.6, 0xffe7a3, 12, 5, 0.3);
  try { SFX.hit(); } catch (e) {}
  if (performance.now() - avisParade > 8000) { avisParade = performance.now(); showMessage('Paré !', 1.2); }
  return true;
}

// l'armure prend d'abord ; brisée, elle retourne aux casernes (le serveur la fera revenir)
function absorber(degats) {
  if (!armure || armurePts <= 0) return degats;
  const pris = Math.min(armurePts, degats);
  armurePts -= pris;
  const p = player;
  burst(p.pos.x, p.pos.y + 1.3, p.pos.z, 0xc9ccd2, 8, 4, 0.4);
  if (armurePts <= 0) {
    armure = 0; envoyer({ t: 'objet-casse', o: 'armure' });
    showMessage('Ton armure vole en éclats ! Une neuve reviendra aux casernes.', 4);
    try { SFX.stomp(); } catch (e) {}
  }
  peindreArmure();
  return degats - pris;
}

// la jauge d'armure, au bout des cœurs : une plaque par cœur encaissable
let jaugeArmure = null;
function peindreArmure() {
  if (!actif) return;
  if (!jaugeArmure) {
    jaugeArmure = document.createElement('div');
    jaugeArmure.style.cssText = 'position:absolute; top:19px; display:flex; gap:4px; align-items:center; pointer-events:none;';
    (document.getElementById('hud') || document.body).appendChild(jaugeArmure);
  }
  jaugeArmure.style.left = `${18 + 6 + (player.maxHp / 2) * 34 + 6}px`;
  jaugeArmure.style.display = armure ? 'flex' : 'none';
  if (!armure) return;
  const n = ARMURE_PTS[armure] / 2, plein = armurePts / 2;
  let h = `<span style="font-size:11px; letter-spacing:1px; color:#dfe3ea; margin-right:2px">${ARMURE_NOM[armure].toUpperCase()}</span>`;
  for (let i = 0; i < n; i++) {
    const r = Math.max(0, Math.min(1, plein - i));
    h += `<span style="width:14px; height:18px; border-radius:3px 3px 7px 7px; border:1.5px solid #1a1d22; background:linear-gradient(90deg, #c9ccd2 ${r * 100}%, #3a3f48 ${r * 100}%)"></span>`;
  }
  jaugeArmure.innerHTML = h;
}

// La forge du bourg : on y renforce ce qu'on porte, contre des écus. Y aller est un risque
// — c'est loin des casernes et de la place, et on s'y arrête.
function poserForge() {
  if (!actif || poserForge.fait || !TOWN || TOWN.y === undefined) return;
  poserForge.fait = true;
  const [x, z] = townWorld(4.4, 14);
  addInteract({ pos: new THREE.Vector3(x, TOWN.y, z), r: 3.2, prompt: () => 'la forge : renforcer ton équipement', fn: () => {
    const peu = (n) => `il faut d’abord ${n}`;
    BOURSE.boutique('La forge', 'À l’enclume', 'Le forgeron renforce ce que tu portes. Ce qui est brisé ne se répare pas : il faut en reprendre.', [
      { label: 'Armure de mailles (3 cœurs à encaisser)', prix: 40, dispo: () => armure === 1, indispo: armure ? 'déjà renforcée' : peu('l’armure des casernes'),
        acheter: () => { armure = 2; armurePts = ARMURE_PTS[2]; peindreArmure(); showMessage('Mailles neuves : 3 cœurs d’armure.', 3); } },
      { label: 'Armure de plates (4 cœurs à encaisser)', prix: 70, dispo: () => armure === 2, indispo: armure === 3 ? 'déjà en plates' : peu('les mailles'),
        acheter: () => { armure = 3; armurePts = ARMURE_PTS[3]; peindreArmure(); showMessage('Plates d’acier : 4 cœurs d’armure.', 3); } },
      { label: 'Réparer l’armure', prix: 12, dispo: () => armure > 0 && armurePts < ARMURE_PTS[armure], indispo: armure ? 'elle est intacte' : peu('une armure'),
        acheter: () => { armurePts = ARMURE_PTS[armure]; peindreArmure(); } },
      { label: 'Cercler l’écu de fer (pare plus large)', prix: 50, dispo: () => ecu === 1, indispo: ecu ? 'déjà cerclé' : peu('l’écu de la place d’Armes'),
        acheter: () => { ecu = 2; showMessage('L’écu cerclé de fer pare les coups de biais.', 3); } },
    ]);
  } });
}

// ---------------------------------------------------------------------
//  Encaisser, mourir, réapparaître
// ---------------------------------------------------------------------
// On n'appelle pas damagePlayer() du moteur : à zéro cœur, il déclenche la fin de partie.
// Entre joueurs, on veut une réapparition. Les monstres, eux, gardent les règles du solo.
function encaisser(degats, fx, fz, de, pseudo, kind) {
  const p = player;
  if (elimine || !state.running || state.paused || state.over || p.invuln > 0 || p.rollT >= 0 || p.sleeping > 0) return;
  const dx = p.pos.x - fx, dz = p.pos.z - fz, d = Math.hypot(dx, dz) || 1;
  if (parer(fx, fz)) { p.kb.set(dx / d * 3, 0, dz / d * 3); return; }
  degats = absorber(degats);
  p.invuln = INVULN;
  if (degats <= 0) { p.kb.set(dx / d * 4, 0, dz / d * 4); return; }
  p.hp = Math.max(0, p.hp - degats);
  p.kb.set(dx / d * (kind === 'fleche' ? 5 : 9), 0, dz / d * (kind === 'fleche' ? 5 : 9));
  burst(p.pos.x, p.pos.y + 1.3, p.pos.z, 0xff6060, 10, 4, 0.5);
  try { SFX.hurt(); } catch (e) {}
  G.shake = Math.max(G.shake, 0.4);
  if (p.hp <= 0) mourir(de, pseudo);
}

function mourir(de, pseudo) {
  // la bourse en jeu : mis à terre par un joueur, on lâche le cinquième de ses écus, qui
  // tombent là où l'on est tombé (le serveur les garde, le premier arrivé les prend)
  let perdu = 0;
  if (enjeu && de && BOURSE.aBourse()) { perdu = Math.floor(BOURSE.solde() * 0.2); if (perdu > 0) BOURSE.perdre(perdu); }
  envoyer({ t: 'mort', par: de, perdu });
  const p = player;
  burst(p.pos.x, p.pos.y + 1, p.pos.z, 0xb0a0ff, 18, 6, 0.8, 8, 1.4);
  try { SFX.dead(); } catch (e) {}
  if (apparition) {
    const a = Math.random() * TAU, r = 1 + Math.random() * 3;
    p.pos.set(apparition.x + Math.cos(a) * r, apparition.y, apparition.z + Math.sin(a) * r);
    p.pos.y = getH(p.pos.x, p.pos.z) + 0.1;
  }
  p.vy = 0; p.kb.set(0, 0, 0); p.hp = p.maxHp; p.invuln = 3; p.attackT = -1; p.rollT = -1;
  // match à mort : une seule vie par manche — on regarde la fin, à l'abri, sans frapper
  const reste = viesDe(moi && moi.id);
  if (regle === 'survie' && manche && manche.etat === 'cours' && reste !== null && reste > 1) {
    showMessage(`${pseudo ? pseudo + ' t’a mise à terre. ' : ''}Plus que ${reste - 1} vie${reste - 1 > 1 ? 's' : ''}.`, 4);
    return;
  }
  if (regle === 'survie' && manche && manche.etat === 'cours') {
    elimine = true; p.invuln = 1e9;
    showMessage(pseudo ? `${pseudo} t’a éliminée. Tu regardes la fin de la manche.` : 'Éliminée ! Tu regardes la fin de la manche.', 5);
    return;
  }
  showMessage(pseudo ? `${pseudo} t’a mise à terre. ${monPerso} se relève un peu plus loin.`
    : `${monPerso} est tombée. Elle se relève un peu plus loin.`, 4);
}

// ---------------------------------------------------------------------
//  Porter des coups
// ---------------------------------------------------------------------
let swingEnCours = false;
const touchesDuSwing = new Set();

function coupsEpee() {
  const p = player;
  if (elimine) return;
  if (p.attackT < 0) { swingEnCours = false; return; }
  if (!swingEnCours) { swingEnCours = true; touchesDuSwing.clear(); }
  if (p.attackT <= 0.08 || p.attackT >= 0.3) return;
  for (const a of autres.values()) {
    if (touchesDuSwing.has(a.id) || a.hp <= 0 || a.niveau !== G.level.name || memeCamp(a) || estElimine(a.id)) continue;
    const dx = a.mesh.position.x - p.pos.x, dz = a.mesh.position.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > PORTEE_EPEE + 0.6 || Math.abs(a.mesh.position.y - p.pos.y) > 3) continue;
    const da = ((Math.atan2(dx, dz) - p.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    if (Math.abs(da) > 1.25 && d > 1.2) continue;
    touchesDuSwing.add(a.id);
    envoyer({ t: 'coup', c: a.id, d: DEGATS_EPEE, k: 'epee' });
    burst(a.mesh.position.x, a.mesh.position.y + 1.3, a.mesh.position.z, 0xfff0a0, 8, 5, 0.35);
    try { SFX.hit(); } catch (e) {}
  }
}

function coupsFleche() {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i], pos = a.mesh.position;
    for (const o of autres.values()) {
      if (elimine || o.hp <= 0 || o.niveau !== G.level.name || memeCamp(o) || estElimine(o.id)) continue;
      const d = Math.hypot(o.mesh.position.x - pos.x, o.mesh.position.z - pos.z);
      const dy = pos.y - o.mesh.position.y;
      if (d < 0.9 && dy > -0.4 && dy < 2.8) {
        envoyer({ t: 'coup', c: o.id, d: DEGATS_FLECHE, k: 'fleche' });
        burst(pos.x, pos.y, pos.z, 0xfff0a0, 8, 5, 0.35);
        try { SFX.hit(); } catch (e) {}
        scene.remove(a.mesh); arrows.splice(i, 1);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------
//  Les bots
// ---------------------------------------------------------------------
// Le serveur ne connaît ni le terrain ni les murs : les bots vivent donc dans le navigateur
// d'un humain du salon, leur « pilote » (l'hôte s'il est là). Ils parlent au salon par sa
// bouche — { t: 'bot', b: id, m: <message> } — et le serveur leur applique les règles des
// joueurs : portée et cadence des coups, pas de coup entre alliés, scores. Pour les autres,
// un bot n'est qu'un joueur de plus ; ses avatars sont ceux de tout le monde.
//
// Trois niveaux. Ce qui les sépare, c'est ce qui sépare un débutant d'un habitué : le temps
// de réaction, la vitesse, la portée du regard, l'esquive, et le sens du repli.
const NIVEAUX = {
  recrue:  { nom: 'recrue',  vitesse: 4.4, reflexe: 0.9,  vue: 16, elan: 0.45, cadence: 1.5, esquive: 0,    fuite: 0,    pv: 8,  chasse: 0.25 },
  soldat:  { nom: 'soldat',  vitesse: 5.8, reflexe: 0.5,  vue: 24, elan: 0.3,  cadence: 1.0, esquive: 0.25, fuite: 0.2,  pv: 12, chasse: 0.6 },
  // le vétéran tire aussi à l'arc, de 9 à 30 m, quand rien ne cache sa cible
  veteran: { nom: 'vétéran', vitesse: 6.8, reflexe: 0.25, vue: 34, elan: 0.2,  cadence: 0.7, esquive: 0.55, fuite: 0.3,  pv: 12, chasse: 0.9, arc: true },
};
const PORTEE_BOT = 2.1, ENVOIS_BOT = 8;
const bots = new Map();            // id -> l'état simulé d'un bot que je pilote
const PALETTES_LOOK = { peau: LOOK.PEAU, cheveux: LOOK.CHEVEUX, coiffure: LOOK.COIFFURES, tunique: LOOK.TUNIQUE,
  toile: LOOK.TOILE, cuir: LOOK.CUIR, foulard: LOOK.FOULARD, yeux: LOOK.YEUX, carrure: LOOK.CARRURE, taille: LOOK.TAILLE };
const hasard = (n) => Math.floor(Math.random() * n);
function lookAuHasard() {
  const L = {};
  for (const [k, P] of Object.entries(PALETTES_LOOK)) if (P && P.length) L[k] = hasard(P.length);
  return L;
}
const parler = (b, m) => envoyer({ t: 'bot', b: b.id, m });

function prendreBots(liste) {
  for (const v of liste) {
    if (bots.has(v.id)) continue;
    const a = autres.get(v.id) || creerAutre(v.id, v.pseudo, v.etat || {}, v.perso, v.look, v.camp);
    a.bot = v.bot; a.camp = v.camp;
    const P = NIVEAUX[v.bot] || NIVEAUX.soldat;
    const e = v.etat || {};
    bots.set(v.id, {
      id: v.id, P, niveau: e.n || null, pos: e.p ? new THREE.Vector3(e.p[0], e.p[1], e.p[2]) : null,
      yaw: e.y || 0, hp: e.hp || P.pv, mx: P.pv, act: 0, but: null, cible: null, reflexe: 0,
      attaqueT: -1, coupParti: false, cooldown: 0, roulade: -1, rouladeDir: 0, invuln: 2, mortT: 0,
      fuiteT: 0, calme: 0, envoi: 0, coince: 0, look: v.look && Object.keys(v.look).length ? v.look : null,
      porteur: v.bot === 'veteran' || (v.bot === 'soldat' && Math.abs(v.id) % 2 === 1), demande: 0,
    });
  }
  peindrePanneau();
}

// l'endroit d'où partent les bots : le ralliement de leur camp, sinon celui de l'hôte,
// sinon là où le pilote est entré
function baseDe(b) {
  const a = autres.get(b.id);
  if (enEquipes() && rdv && rdv.x === undefined && a && rdv[a.camp]) return rdv[a.camp];
  if (!enEquipes() && rdv && rdv.x !== undefined) return rdv;
  return apparition ? { x: apparition.x, z: apparition.z } : null;
}
function placerBot(b) {
  const base = baseDe(b);
  if (!base) return false;
  const an = Math.random() * TAU, r = 5 + Math.random() * 12;
  const p = praticable(base.x + Math.cos(an) * r, base.z + Math.sin(an) * r);
  if (!p) return false;
  const y = getH(p.x, p.z, (world.levelH ? world.levelH(p.x, p.z) : 0) + 0.5);
  b.pos = new THREE.Vector3(p.x, y, p.z);
  b.niveau = G.level.name; b.hp = b.mx; b.invuln = 2; b.act = 0; b.but = null; b.cible = null;
  return true;
}

// ceux qu'un bot peut viser : moi, les autres joueurs, les autres bots — pas son camp
function ennemisDe(b) {
  const a = autres.get(b.id), camp = a && a.camp, liste = [];
  if (moi && !elimine && state.running && !state.over && G.level.name === b.niveau && player.hp > 0 && !(enEquipes() && camp && state.camp === camp))
    liste.push({ id: moi.id, x: player.pos.x, z: player.pos.z, y: player.pos.y, act: player.attackT >= 0 ? 1 : 0, hp: player.hp });
  for (const o of autres.values()) {
    if (o.id === b.id || o.hp <= 0 || o.niveau !== b.niveau || estElimine(o.id) || (enEquipes() && camp && o.camp === camp)) continue;
    if (!bots.has(o.id) && performance.now() - o.vu > 3000) continue;
    const ob = bots.get(o.id);
    if (ob && (ob.mortT > 0 || !ob.pos)) continue;
    const p = ob ? ob.pos : o.mesh.position;
    liste.push({ id: o.id, x: p.x, z: p.z, y: p.y, act: ob ? ob.act : o.act, hp: ob ? ob.hp : o.hp });
  }
  return liste;
}

// un pas, en contournant : droit devant, puis en biais, puis de côté
function avancer(b, dirX, dirZ, vitesse, dt) {
  const n = Math.hypot(dirX, dirZ) || 1, pas = vitesse * dt;
  const base = Math.atan2(dirX / n, dirZ / n);
  for (const dev of [0, 0.6, -0.6, 1.3, -1.3, 2, -2]) {
    const an = base + dev, dx = Math.sin(an) * pas, dz = Math.cos(an) * pas;
    if (sdEau(b.pos.x + dx * 4, b.pos.z + dz * 4) < 1.2) continue;       // pas dans l'eau
    if (tryMove(b.pos, dx, dz, 0.45, false)) {
      b.pos.y = getH(b.pos.x, b.pos.z, b.pos.y + 0.5);
      b.yaw = lerpAngle(b.yaw, an, Math.min(1, dt * 10));
      return true;
    }
  }
  return false;
}

function butAuHasard(b) {
  const base = baseDe(b) || { x: b.pos.x, z: b.pos.z };
  for (let k = 0; k < 6; k++) {
    const an = Math.random() * TAU, r = 10 + Math.random() * 35;
    const p = praticable(base.x + Math.cos(an) * r, base.z + Math.sin(an) * r);
    if (p) return { x: p.x, z: p.z };
  }
  return { x: base.x, z: base.z };
}

// ce que le bot veut faire de la bannière (en équipes) : un point où aller, et une demande
function objectifBanniere(b, camp) {
  if (!enEquipes() || !bannieres || !rdv || rdv.x !== undefined || !camp) return null;
  const adv = autreCamp(camp), bA = bannieres[adv], bM = bannieres[camp];
  if (!bA || !bM || !rdv[camp] || !rdv[adv]) return null;
  if (bA.porteur === b.id) return { x: rdv[camp].x, z: rdv[camp].z, dire: bM.etat === 'base' ? { t: 'rapporter' } : null };
  if (bM.etat === 'tombee' && bM.p) return { x: bM.p[0], z: bM.p[1], dire: { t: 'saisir', camp } };
  if (!b.porteur) return null;
  if (bA.etat === 'base') return { x: rdv[adv].x, z: rdv[adv].z, dire: { t: 'saisir', camp: adv } };
  if (bA.etat === 'tombee' && bA.p) return { x: bA.p[0], z: bA.p[1], dire: { t: 'saisir', camp: adv } };
  return null;
}

function penserBot(b, dt, now) {
  const P = b.P, a = autres.get(b.id), camp = a && a.camp;
  b.cooldown -= dt; b.reflexe -= dt; b.invuln -= dt; b.fuiteT -= dt; b.arcCd = (b.arcCd ?? 1.5) - dt;
  // la roulade : vite, de côté, intouchable
  if (b.roulade >= 0) {
    b.roulade += dt; b.act = 2;
    avancer(b, Math.sin(b.rouladeDir), Math.cos(b.rouladeDir), P.vitesse * 1.9, dt);
    if (b.roulade > 0.5) { b.roulade = -1; b.act = 0; }
    return;
  }
  // le coup : l'élan, puis la lame part — une seule fois par coup
  if (b.attaqueT >= 0) {
    b.attaqueT += dt; b.act = 1;
    const c = b.cible && ennemisDe(b).find((e) => e.id === b.cible);
    if (!b.coupParti && b.attaqueT >= P.elan) {
      b.coupParti = true;
      if (c && Math.hypot(c.x - b.pos.x, c.z - b.pos.z) < PORTEE_BOT + 0.8) {
        parler(b, { t: 'coup', c: c.id, d: DEGATS_EPEE, k: 'epee' });
        burst(c.x, c.y + 1.2, c.z, 0xfff0a0, 6, 4, 0.3);
      }
    }
    if (b.attaqueT > P.elan + 0.3) { b.attaqueT = -1; b.act = 0; b.cooldown = P.cadence * (0.8 + Math.random() * 0.4); }
    return;
  }
  b.act = 0;

  // voir : on ne réévalue qu'au rythme de ses réflexes — c'est ce qui fait une recrue lente
  const ennemis = ennemisDe(b);
  if (b.reflexe <= 0) {
    b.reflexe = P.reflexe * (0.7 + Math.random() * 0.6);
    let proche = null, dmin = Infinity;
    // un humain compte comme s'il était plus près : les bots sont là pour jouer avec les joueurs
    for (const e of ennemis) { const d = Math.hypot(e.x - b.pos.x, e.z - b.pos.z) - (e.id > 0 ? 8 : 0); if (d < dmin) { dmin = d; proche = e; } }
    if (proche) dmin = Math.hypot(proche.x - b.pos.x, proche.z - b.pos.z);
    b.cible = proche && dmin < P.vue ? proche.id : null;
    // loin de tout, un bot aguerri va chercher la bagarre ; une recrue flâne
    b.chasse = !b.cible && proche && Math.random() < P.chasse ? proche.id : null;
    // un coup qui vient : l'esquive, selon le niveau
    const c = proche && dmin < 3.2 ? proche : null;
    if (c && c.act === 1 && Math.random() < P.esquive) {
      b.roulade = 0;
      b.rouladeDir = Math.atan2(b.pos.x - c.x, b.pos.z - c.z) + (Math.random() < 0.5 ? 1.2 : -1.2);
      return;
    }
  }
  const cible = b.cible && ennemis.find((e) => e.id === b.cible);
  // à bout de cœurs, les plus malins décrochent un moment
  if (cible && P.fuite && b.hp <= b.mx * P.fuite && b.fuiteT < -6) b.fuiteT = 2.5;
  if (cible && b.fuiteT > 0) {
    avancer(b, b.pos.x - cible.x, b.pos.z - cible.z, P.vitesse, dt);
    return;
  }

  // la bannière d'abord pour le porteur ; les autres ne la ramassent que s'ils passent dessus
  const obj = objectifBanniere(b, camp);
  const porte = obj && bannieres && bannieres[autreCamp(camp)] && bannieres[autreCamp(camp)].porteur === b.id;
  if (obj && (porte || !cible || Math.hypot(cible.x - b.pos.x, cible.z - b.pos.z) > 6)) {
    const d = Math.hypot(obj.x - b.pos.x, obj.z - b.pos.z);
    if (d > 2.2) avancer(b, obj.x - b.pos.x, obj.z - b.pos.z, P.vitesse, dt);
    if (d < 3 && obj.dire && now - b.demande > 700) { b.demande = now; parler(b, obj.dire); }
    return;
  }

  if (cible) {
    b.calme = 0;
    const dx = cible.x - b.pos.x, dz = cible.z - b.pos.z, d = Math.hypot(dx, dz);
    if (P.arc && d > 9 && d < 30 && b.arcCd <= 0 && vueDegagee(b.pos, cible)) {
      b.arcCd = 2.5 + Math.random() * 2;
      b.yaw = Math.atan2(dx, dz);
      tirerFleche(b, cible);
      return;
    }
    if (b.detour && now < b.detour.fin && Math.hypot(b.detour.x - b.pos.x, b.detour.z - b.pos.z) > 1.5) {
      avancer(b, b.detour.x - b.pos.x, b.detour.z - b.pos.z, P.vitesse, dt);
    } else if (d > PORTEE_BOT * 0.85) {
      b.detour = null;
      avancer(b, dx, dz, P.vitesse, dt);
      // une haie, un mur entre lui et sa cible : la distance ne baisse plus. Il contourne
      // par le côté, quelques mètres, puis reprend la poursuite.
      if (d > (b.dPrec ?? Infinity) - P.vitesse * dt * 0.3) b.bloque = (b.bloque || 0) + dt; else b.bloque = 0;
      if (b.bloque > 1.1) {
        b.bloque = 0;
        const cap = Math.atan2(dx, dz) + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.8);
        const q = praticable(b.pos.x + Math.sin(cap) * 9, b.pos.z + Math.cos(cap) * 9);
        if (q) b.detour = { x: q.x, z: q.z, fin: now + 2500 };
      }
    } else {
      b.yaw = lerpAngle(b.yaw, Math.atan2(dx, dz), Math.min(1, dt * 12));
      if (b.cooldown <= 0) { b.attaqueT = 0; b.coupParti = false; }
    }
    b.dPrec = d;
    return;
  }

  // personne en vue : on se refait une santé, et on se promène (ou on chasse)
  if ((b.calme += dt) > 5 && b.hp < b.mx && regle === 'balade') { b.hp = Math.min(b.mx, b.hp + 1); b.calme = 3; }
  const traque = b.chasse && ennemis.find((e) => e.id === b.chasse);
  if (traque) b.but = { x: traque.x, z: traque.z };
  if (!b.but || Math.hypot(b.but.x - b.pos.x, b.but.z - b.pos.z) < 2.5) b.but = butAuHasard(b);
  const avant = b.pos.clone();
  avancer(b, b.but.x - b.pos.x, b.but.z - b.pos.z, P.vitesse * (traque ? 1 : 0.6), dt);
  // coincé contre un mur : autre destination
  if (avant.distanceTo(b.pos) < P.vitesse * 0.6 * dt * 0.2) { if ((b.coince += dt) > 1) { b.but = butAuHasard(b); b.coince = 0; } }
  else b.coince = 0;
}

// L'arc des bots. Les flèches des joueurs (engine.js, `arrows`) touchent les monstres et
// passent par coupsFleche() comme celles du pilote : celles d'un bot volent à part, et
// c'est à l'arrivée seulement, si la cible est encore là, que le coup part au salon.
const flechesBots = [];
function vueDegagee(de, a) {
  for (let k = 1; k < 10; k++) {
    const t = k / 10, x = de.x + (a.x - de.x) * t, z = de.z + (a.z - de.z) * t;
    if (blocked(x, z, 0.1, true, de.y + 1.4 + ((a.y || 0) - de.y) * t)) return false;
  }
  return true;
}
function tirerFleche(b, c) {
  const m = makeArrow(), de = new THREE.Vector3(b.pos.x, b.pos.y + 1.4, b.pos.z);
  const dir = new THREE.Vector3(c.x - de.x, (c.y || 0) + 1.1 - de.y, c.z - de.z);
  const d = dir.length(); dir.normalize();
  m.position.copy(de); m.lookAt(de.clone().add(dir)); scene.add(m);
  flechesBots.push({ mesh: m, vel: dir.multiplyScalar(40), vie: d / 40 + 0.15, b, cible: c.id });
  try { SFX.swing(); } catch (e) {}
}
function tickFlechesBots(dt) {
  for (let i = flechesBots.length - 1; i >= 0; i--) {
    const f = flechesBots[i], p = f.mesh.position;
    p.addScaledVector(f.vel, dt); f.vie -= dt;
    const c = ennemisDe(f.b).find((e) => e.id === f.cible);
    const touche = c && Math.hypot(c.x - p.x, c.z - p.z) < 1.2 && p.y > (c.y || 0) - 0.4 && p.y < (c.y || 0) + 2.6;
    if (touche) { parler(f.b, { t: 'coup', c: c.id, d: DEGATS_FLECHE, k: 'fleche' }); burst(p.x, p.y, p.z, 0xfff0a0, 6, 4, 0.3); }
    if (touche || f.vie <= 0 || blocked(p.x, p.z, 0.05, true, p.y)) { scene.remove(f.mesh); flechesBots.splice(i, 1); }
  }
}

// un coup, un refus : ce que le salon adresse à un de mes bots
function recevoirPourBot(id, m) {
  const b = bots.get(id), a = autres.get(id);
  if (!b || !a) return;
  if (m.t === 'touche') {
    if (b.mortT > 0 || !b.pos || b.invuln > 0 || b.roulade >= 0) return;
    b.hp = Math.max(0, b.hp - (m.d || 1)); b.invuln = 0.6; b.calme = 0;
    blesser(a);
    if (m.p) {                               // le recul, à l'opposé du coup
      const dx = b.pos.x - m.p[0], dz = b.pos.z - m.p[1], d = Math.hypot(dx, dz) || 1;
      tryMove(b.pos, dx / d * 1.2, dz / d * 1.2, 0.45, false);
      b.pos.y = getH(b.pos.x, b.pos.z, b.pos.y + 0.5);
    }
    b.cible = m.de; b.reflexe = Math.min(b.reflexe, b.P.reflexe * 0.5);     // il se retourne contre son agresseur
    if (b.hp <= 0) {
      // en match à mort, un bot tombé attend la manche suivante
      const vies = viesDe(id);
      b.mortT = regle === 'survie' && manche && manche.etat === 'cours' && (vies === null || vies <= 1) ? Infinity : 3;
      b.act = 0; b.attaqueT = -1; b.roulade = -1;
      burst(b.pos.x, b.pos.y + 1, b.pos.z, 0xb0a0ff, 18, 6, 0.8, 8, 1.4);
      parler(b, { t: 'mort', par: m.de, perdu: 0 });
      envoyerEtatBot(b);
    }
  }
}

function envoyerEtatBot(b) {
  if (!b.pos) return;
  parler(b, { t: 'etat', p: [+b.pos.x.toFixed(2), +b.pos.y.toFixed(2), +b.pos.z.toFixed(2)],
    y: +b.yaw.toFixed(2), a: b.act, hp: b.hp, mx: b.mx, n: b.niveau });
}

// En équipes, un camp sans humain n'a personne pour poser son ralliement : un de ses bots
// le pose, loin de l'autre camp — sans quoi il n'y aurait pas de bannière à prendre.
let rdvBotsT = 0;
function ralliementDesBots(now) {
  if (!enEquipes() || now - rdvBotsT < 2000 || !apparition) return;
  rdvBotsT = now;
  for (const c of ['garnison', 'bourg']) {
    if (rdv && rdv.x === undefined && rdv[c]) continue;
    const b = [...bots.values()].find((x) => (autres.get(x.id) || {}).camp === c);
    if (!b) continue;
    const humains = [...autres.values()].some((o) => !o.bot && o.camp === c) || state.camp === c;
    if (humains && now - (b.depuis || (b.depuis = now)) < 25000) continue;     // on laisse aux humains le temps de choisir
    const autre = rdv && rdv.x === undefined && rdv[autreCamp(c)];
    const depart = autre || { x: apparition.x, z: apparition.z };
    const an0 = Math.random() * TAU;
    for (let k = 0; k < 8; k++) {
      const an = an0 + k * TAU / 8, p = praticable(depart.x + Math.cos(an) * 70, depart.z + Math.sin(an) * 70);
      if (p) {
        rdv = { ...(rdv && rdv.x === undefined ? rdv : {}), [c]: { x: p.x, z: p.z, nom: p.nom } };
        parler(b, { t: 'rdv', x: p.x, z: p.z, nom: p.nom });
        break;
      }
    }
  }
}

function tickBots(dt, now) {
  if (!bots.size || !ws || ws.readyState !== 1) return;
  // les bots ne vivent que là où le pilote a le terrain : dans son niveau, jeu lancé
  const actifs = state.running && !state.paused && apparition && G.level;
  if (actifs) ralliementDesBots(now);
  tickFlechesBots(dt);
  for (const b of bots.values()) {
    const a = autres.get(b.id);
    if (!a) continue;
    if (!b.look) { b.look = lookAuHasard(); parler(b, { t: 'look', l: b.look }); a.look = LOOK.normaliser(b.look); LOOK.appliquerSur(a.mesh, lookDe(a.look, a.camp)); }
    if (actifs && !b.pos && !placerBot(b)) continue;
    if (!b.pos) continue;
    if (actifs && b.niveau === G.level.name) {
      if (b.mortT > 0) { if ((b.mortT -= dt) <= 0) placerBot(b); }
      else if (!estElimine(b.id)) penserBot(b, dt, now);
    }
    // l'avatar suit la simulation ; le lissage de la boucle fait le reste
    a.cible.copy(b.pos); a.yawCible = b.yaw; a.act = b.act; a.niveau = b.niveau; a.vu = now;
    if (a.hp !== b.hp) { a.hp = b.hp; peindrePanneau(); }
    if (now - b.envoi > 1000 / ENVOIS_BOT) { b.envoi = now; envoyerEtatBot(b); }
  }
}

// ---------------------------------------------------------------------
//  Les manches : match à mort et chrono
// ---------------------------------------------------------------------
// Le serveur arbitre (compte à rebours, scores, fin, badges) ; ici on l'affiche, et on
// applique ce qu'il décide : la remise à zéro au début d'une manche, l'élimination.
let regle = 'balade', manche = null, elimine = false, recuManche = 0;
const NOM_REGLE = { survie: 'Match à mort', temps: 'Chrono' };
const estElimine = (id) => !!(regle === 'survie' && manche && manche.etat === 'cours' && manche.elimines && manche.elimines.includes(id));
// les vies qui restent (match à mort) ; null hors manche
const viesDe = (id) => (regle === 'survie' && manche && manche.vies && manche.vies[id] != null ? manche.vies[id] : null);
const scoreManche = (id) => {
  if (regle !== 'temps' || !manche || !manche.scores || !manche.scores[id]) return null;
  const [k, m] = manche.scores[id]; return k - m;
};

let bandeauManche = null, resultats = null;
function majManche(m) {
  const avant = manche ? manche.etat : null;
  manche = m; recuManche = performance.now();
  if (m.etat === 'cours' && avant !== 'cours') debutManche();
  elimine = estElimine(moi && moi.id);
  if (m.etat === 'fin' && avant !== 'fin') afficherResultats(m);
  else if (m.etat === 'fin') majBoutonsResultats(m);
  if (m.etat !== 'fin' && resultats) { resultats.remove(); resultats = null; }
  peindreManche(); peindrePanneau();
}

// tout le monde repart à égalité : cœurs pleins, au point d'arrivée, quelques secondes à l'abri
function debutManche() {
  const p = player;
  elimine = false;
  p.hp = p.maxHp; p.invuln = 2; p.attackT = -1; p.rollT = -1; p.vy = 0; p.kb.set(0, 0, 0);
  if (apparition) {
    const a = Math.random() * TAU, r = 1 + Math.random() * 3;
    p.pos.set(apparition.x + Math.cos(a) * r, apparition.y, apparition.z + Math.sin(a) * r);
    p.pos.y = getH(p.pos.x, p.pos.z) + 0.1;
  }
  for (const b of bots.values()) { b.mortT = 0; if (b.pos || apparition) placerBot(b); }
  const v = manche.vies_max || 1, min = Math.round((manche.duree || 180) / 60);
  showMessage(regle === 'survie' ? `Match à mort : ${v > 1 ? v + ' vies' : 'une seule vie'}. Le dernier debout gagne !`
    : `Chrono : ${min} minute${min > 1 ? 's' : ''}. Chaque mise à terre compte, chaque chute se paie !`, 4);
  try { SFX.win(); } catch (e) {}
}

function peindreManche() {
  if (regle === 'balade' || !manche) { if (bandeauManche) { bandeauManche.remove(); bandeauManche = null; } return; }
  if (!bandeauManche) {
    bandeauManche = document.createElement('div');
    bandeauManche.style.cssText = `position:fixed; left:50%; top:14px; transform:translateX(-50%); z-index:5; pointer-events:none;
      padding:8px 20px; border-radius:10px; background:rgba(10,14,30,.82); border:1px solid rgba(255,231,163,.45);
      color:#fff; font-family:"Trebuchet MS",sans-serif; font-size:15px; text-align:center; text-shadow:0 1px 2px #000; min-width:260px`;
    document.body.appendChild(bandeauManche);
  }
  const reste = manche.reste != null ? Math.max(0, Math.ceil(manche.reste - (performance.now() - recuManche) / 1000)) : null;
  const mmss = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const titre = `<b style="color:#ffe7a3; letter-spacing:1px">${NOM_REGLE[regle]}</b>`;
  let ligne = '';
  if (manche.etat === 'attente') ligne = 'En attente d’un adversaire…';
  else if (manche.etat === 'compte') ligne = `Début dans <b style="font-size:20px">${reste}</b> s`;
  else if (manche.etat === 'cours' && regle === 'temps') {
    const moiSc = scoreManche(moi && moi.id);
    ligne = `<b style="font-size:20px">${mmss(reste || 0)}</b>${moiSc !== null ? ` &nbsp; toi : <b style="color:#ffe7a3">${moiSc > 0 ? '+' : ''}${moiSc}</b>` : ''}`;
  } else if (manche.etat === 'cours') {
    const enLice = Object.keys(manche.scores || {}).filter((id) => !manche.elimines.includes(+id)).length;
    const mesVies = viesDe(moi && moi.id);
    ligne = elimine ? `Éliminée — ${enLice} encore en lice`
      : `${enLice} encore en lice${mesVies !== null && (manche.vies_max || 1) > 1 ? ` &nbsp; toi : <b style="color:#ffe7a3">${mesVies} vie${mesVies > 1 ? 's' : ''}</b>` : ''}`;
  } else if (manche.etat === 'fin') ligne = `Prochaine manche dans ${reste} s`;
  bandeauManche.innerHTML = `${titre}<br>${ligne}`;
}

// L'écran des résultats : le cadre du portail (pierre, brique et or), le classement, les
// badges, et deux boutons. « Rejouer » compte les prêts — la manche suivante part quand
// tous les humains l'ont pressé, sans attendre la fin de la pause ; « Accueil » s'en va.
// La souris est rendue au joueur : sans ça, les boutons ne se cliquent pas.
let styleResultats = false;
function poserStyleResultats() {
  if (styleResultats) return; styleResultats = true;
  const st = document.createElement('style');
  st.textContent = `
  .resultats-manche { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:7; width:min(560px, 92vw);
    max-height:88vh; overflow:auto; padding:0 0 18px; border-radius:14px; background:#1A2030; color:#EDE3CC;
    border:1px solid rgba(237,227,204,.3); box-shadow:0 24px 70px rgba(0,0,0,.65); font-family:"Alegreya Sans","Trebuchet MS",sans-serif; }
  .resultats-manche .frise { height:10px; border-radius:14px 14px 0 0; background:repeating-linear-gradient(180deg,#9C3B28 0 3px,#EDE3CC 3px 4px,#6B281B 4px 7px,#EDE3CC 7px 8px); }
  .resultats-manche .regle { margin:14px 0 0; text-align:center; font-size:12px; letter-spacing:3px; text-transform:uppercase; color:#C4BBA6; }
  .resultats-manche h2 { margin:4px 20px 14px; text-align:center; font-family:"Grenze Gotisch",Georgia,serif; font-weight:700; font-size:34px; line-height:1.1; color:#FFE3A1; text-shadow:0 3px 0 #6B281B; }
  .resultats-manche ol { list-style:none; margin:0 18px; padding:0; display:flex; flex-direction:column; gap:6px; }
  .resultats-manche li { display:grid; grid-template-columns:26px 1fr auto; align-items:center; gap:4px 10px; padding:8px 12px; border-radius:8px; background:#0F1420; border:1px solid transparent; }
  .resultats-manche li.moi { border-color:#E2B25A; background:rgba(226,178,90,.1); }
  .resultats-manche li.gagne .rang { color:#FFE3A1; }
  .resultats-manche .rang { font-family:Grenze,Georgia,serif; font-size:20px; font-weight:600; color:#C4BBA6; text-align:center; }
  .resultats-manche .nom { font-weight:700; font-size:16px; }
  .resultats-manche .score { font-family:Grenze,Georgia,serif; font-size:20px; font-weight:600; color:#FFE3A1; text-align:right; }
  .resultats-manche .score small { font-family:"Alegreya Sans",sans-serif; font-size:12px; color:#C4BBA6; font-weight:400; margin-left:4px; }
  .resultats-manche .badges { grid-column:2 / -1; display:flex; flex-wrap:wrap; gap:4px; }
  .resultats-manche .badge { padding:1px 9px; border-radius:10px; background:rgba(226,178,90,.18); color:#FFE3A1; font-size:12px; }
  .resultats-manche .miens { margin:14px 18px 0; text-align:center; font-size:15px; }
  .resultats-manche .boutons { display:flex; gap:10px; margin:16px 18px 0; }
  .resultats-manche button { flex:1; height:48px; border-radius:8px; font:inherit; font-size:17px; font-weight:700; cursor:pointer; }
  .resultats-manche .rejouer { background:#E2B25A; color:#2A1808; border:1px solid #FFE3A1; box-shadow:0 3px 0 #8A6424; }
  .resultats-manche .rejouer[aria-pressed="true"] { background:#3F7F5A; color:#fff; border-color:#6FC498; box-shadow:0 3px 0 #23513A; }
  .resultats-manche .accueil { flex:0 0 auto; padding:0 18px; background:transparent; color:#EDE3CC; border:1px solid rgba(237,227,204,.35); }
  .resultats-manche .suite { margin:10px 18px 0; text-align:center; font-size:13px; color:#C4BBA6; }`;
  document.head.appendChild(st);
}
let jePrets = false;
function afficherResultats(m) {
  poserStyleResultats();
  if (resultats) resultats.remove();
  jePrets = false;
  const nomDe_ = (e) => (moi && e.id === moi.id ? `${ech(monPerso)} (toi)` : ech(e.perso));
  const noms = m.noms_badges || {};
  let titre;
  if (m.camp_gagnant) titre = `${CAMPS[m.camp_gagnant].nom} l’emporte !`;
  else if (m.gagnants && m.gagnants.length === 1) {
    const g = m.classement.find((e) => e.id === m.gagnants[0]);
    titre = regle === 'survie' ? `${g ? nomDe_(g) : '?'} reste le dernier debout !` : `${g ? nomDe_(g) : '?'} gagne la manche !`;
  } else titre = m.gagnants && m.gagnants.length ? 'Égalité en tête !' : 'Personne ne l’emporte';
  const lignes = (m.classement || []).slice(0, 12).map((e, k) => {
    const sc = regle === 'temps' ? `${e.k - e.m > 0 ? '+' : ''}${e.k - e.m}<small>${e.k} / ${e.m}</small>` : `${e.k}<small>à terre</small>`;
    const couleur = enEquipes() && CAMPS[e.camp] ? `color:${CAMPS[e.camp].couleur}` : '';
    const cls = [moi && e.id === moi.id ? 'moi' : '', (m.gagnants || []).includes(e.id) ? 'gagne' : ''].join(' ');
    return `<li class="${cls}"><span class="rang">${k + 1}</span><span class="nom" style="${couleur}">${nomDe_(e)}</span><span class="score">${sc}</span>
      ${e.badges.length ? `<span class="badges">${e.badges.map((b) => `<span class="badge">${ech(noms[b] || b)}</span>`).join('')}</span>` : ''}</li>`;
  }).join('');
  const miens = ((m.classement || []).find((e) => moi && e.id === moi.id) || { badges: [] }).badges;
  resultats = document.createElement('section');
  resultats.className = 'resultats-manche';
  resultats.setAttribute('role', 'dialog'); resultats.setAttribute('aria-label', 'Résultats de la manche');
  resultats.innerHTML = `<div class="frise"></div>
    <p class="regle">${ech(NOM_REGLE[regle] || '')} · fin de la manche</p>
    <h2>${titre}</h2>
    <ol>${lignes}</ol>
    <p class="miens">${miens.length
      ? `Tes badges : ${miens.map((b) => `<b style="color:#FFE3A1">${ech(noms[b] || b)}</b>`).join(', ')} — ils rejoignent ton compte.`
      : '<span style="opacity:.75">Pas de badge cette fois.</span>'}</p>
    <div class="boutons">
      <button type="button" class="rejouer" aria-pressed="false">Rejouer</button>
      <button type="button" class="accueil">Accueil</button>
    </div>
    <p class="suite"></p>`;
  document.body.appendChild(resultats);
  resultats.querySelector('.rejouer').onclick = rejouer;
  resultats.querySelector('.accueil').onclick = () => allerAccueil();
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  majBoutonsResultats(m);
  try { if (m.gagnants && moi && m.gagnants.includes(moi.id)) SFX.win(); } catch (e) {}
}
function rejouer() {
  if (jePrets || !manche || manche.etat !== 'fin') return;
  jePrets = true;
  envoyer({ t: 'rejouer' });
  if (manche) majBoutonsResultats(manche);
}
function majBoutonsResultats(m) {
  if (!resultats) return;
  const b = resultats.querySelector('.rejouer'), prets = (m.prets || []).length, n = m.humains || 1;
  if (moi && (m.prets || []).includes(moi.id)) jePrets = true;
  b.setAttribute('aria-pressed', String(jePrets));
  b.textContent = jePrets ? (n > 1 ? `Prêt ✓ · ${prets}/${n}` : 'Prêt ✓') : (n > 1 ? `Rejouer · ${prets}/${n} prêts` : 'Rejouer');
  const reste = m.reste != null ? Math.max(0, Math.ceil(m.reste - (performance.now() - recuManche) / 1000)) : null;
  resultats.querySelector('.suite').textContent = reste != null
    ? `La manche suivante part dans ${reste} s${n > 1 ? ', ou dès que tout le monde est prêt' : ''}. Entrée : rejouer.` : '';
}
// Entrée rejoue tant que les résultats sont affichés (le moteur ne la voit pas : il
// l'interpréterait comme « parler »)
window.addEventListener('keydown', (e) => {
  if (!resultats || !manche || manche.etat !== 'fin') return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // le chat garde son Entrée
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.stopImmediatePropagation(); e.preventDefault(); rejouer(); }
}, true);

// ---------------------------------------------------------------------
//  Boucle propre au multi (à côté de celle du moteur)
// ---------------------------------------------------------------------
let precedent = performance.now();

function boucle(now) {
  requestAnimationFrame(boucle);
  const dt = Math.min(0.05, (now - precedent) / 1000); precedent = now;

  if (actif) premiereEntree();
  // point de réapparition : celui choisi sur la carte ; à défaut, là où la partie a
  // démarré, relevé une fois lancée
  if (state.running && !apparition) {
    const c = state.apparition;
    if (c && Number.isFinite(c.x)) apparition = new THREE.Vector3(c.x, c.y, c.z);
    else if ((apparitionT += dt) > 2) apparition = player.pos.clone();
  }
  if (!actif) return;
  if (now - dernierLook > 1000) { dernierLook = now; envoyerLook(); }
  tickFete(now);
  tickBourses(now);
  tickObjets(now); poserForge();
  tickBannieres(now);
  tickBots(dt, now);
  if (bandeauManche && now - (peindreManche.t || 0) > 500) { peindreManche.t = now; peindreManche(); if (resultats && manche) majBoutonsResultats(manche); }

  if (state.running && !state.paused && now - dernierEnvoi > 1000 / ENVOIS_PAR_S) {
    dernierEnvoi = now;
    envoyer({
      t: 'etat', p: [+player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2)],
      y: +player.yaw.toFixed(2), a: player.attackT >= 0 ? 1 : (player.rollT >= 0 ? 2 : 0),
      hp: player.hp, mx: player.maxHp, n: G.level.name,
      ar: armure || undefined, bc: ecu || undefined, gd: player.garde ? 1 : undefined,
    });
    coupsEpee(); coupsFleche();
  }

  // avatars : on glisse vers la dernière position annoncée plutôt que de sauter dessus
  for (const a of autres.values()) {
    // arrivé avant que la banque ne soit prête, un avatar est né en primitives : on le
    // refait dès qu'elle l'est, sinon il resterait « cartoon » toute la partie
    if (!a.mesh.userData.perso && PNJ.dispo()) refaireAvatar(a);
    const m = a.mesh, k = 1 - Math.exp(-11 * dt);
    const avant = m.position.x, avantZ = m.position.z;
    m.position.lerp(a.cible, k);
    a.yaw = lerpAngle(a.yaw, a.yawCible, k);
    m.rotation.y = a.yaw;
    const v = Math.hypot(m.position.x - avant, m.position.z - avantZ) / Math.max(dt, 1e-3);
    a.marche = a.marche * 0.85 + Math.min(1, v / 4) * 0.15;
    a.anim += dt * (2 + a.marche * 9);
    const ud = m.userData;
    if (a.rougeur > 0) a.rougeur -= dt;
    rougir(a, a.rougeur > 0);
    if (a.faux.invuln > 0) a.faux.invuln -= dt;
    if (ud.ctrl) {
      // la Camille riggée joue les vrais clips : on lui prête un « joueur » fait de ce que
      // le salon transmet — l'allure mesurée, et l'action en cours (1 coup, 2 roulade)
      a.faux.attackT = a.act === 1 ? 0 : -1; a.faux.rollT = a.act === 2 ? 0 : -1;
      a.ctx.walking = a.marche > 0.12; a.ctx.running = a.marche > 0.7;
      PNJ.animeCamille(m, a.faux, dt, a.ctx);
    } else if (ud.legs) {
      const sw = Math.sin(a.anim) * 0.55 * a.marche;
      ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw;
      ud.knees[0].rotation.x = Math.max(0, sw); ud.knees[1].rotation.x = Math.max(0, -sw);
      ud.arms[0].rotation.x = -sw * 0.5; ud.arms[1].rotation.x = sw * 0.5;
      ud.pivot.position.y = 1.1 + Math.sin(a.anim * 2) * 0.03 * a.marche;
    }
    // un bot à terre disparaît le temps de se relever ailleurs (un joueur, lui, se relève aussitôt)
    m.visible = a.niveau === G.level.name && (performance.now() - a.vu) < 12000 && !(a.bot && a.hp <= 0) && !estElimine(a.id);
    if (a.plaque) a.plaque.material.opacity = m.position.distanceTo(camera.position) > 90 ? 0 : 1;
  }
}

if (actif) { connecter(); setInterval(() => envoyer({ t: 'ping' }), 25000); }
requestAnimationFrame(boucle);

// le moteur expose déjà window.TLOC : on s'y range, ça aide au débogage depuis la console
window.TLOC_MULTI = { autres, bots, envoyer, encaisser, etat: () => ({ instance: inst, moi, connectes: autres.size, bots: bots.size, regle, manche, elimine }),
  equipement: () => ({ armure, armurePts, ecu, objets }) };
