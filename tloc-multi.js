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

import * as C from './tloc-compte.js?v=2';
import * as BOURSE from './bourse.js';
import * as LOOK from './look.js';
import * as ATLAS from './atlas.js';
import * as PNJ from './pnj.js';
// (la géométrie de l'arène — tracé, parc, porte, bastions — vient de sa déclaration, game.js)
import { ENCEINTE, TOWN, sdEau, sdEnceinte, surOuvrage, surPont, townWorld } from './carte.js';
// L'eau, les ouvrages, les ponts et l'enceinte de carte.js sont ceux de Lille : ailleurs (le
// multi se joue aussi à la Garde-Guérin, au Pouget — 5 octobre), ils mentiraient. Le lieu peut
// donner son eau à son arène (`sdEau`) ; sinon, il n'y en a pas.
const aLille = () => !!(G.level && G.level.name === 'citadel');
const eau = (x, z) => (aLille() ? sdEau(x, z) : arene && arene.sdEau ? arene.sdEau(x, z) : 99);
const ouvrage = (x, z, y) => (aLille() ? surOuvrage(x, z, y) : false);
const pont = (x, z) => (aLille() ? surPont(x, z) : null);
const horsEnceinte = (x, z) => (aLille() ? sdEnceinte(x, z) : -99);
import { PARTAGE } from './etat.js';
import { openGate } from './quetes.js';
import { FAUCHE_DEBUG } from './nature.js';
import {
  AIDE, G, SFX, THREE, TAU, addInteract, phMat, arrows, blocked, burst, camera, cut, enemies, getH, lerpAngle, lieux, makeArrow, makeBow, makeCamille,
  CROCHETS, EPEE_SELLE, hideMenu, menu, perfCreateur, player, saveGame, scene, showMenu, showMessage, sourceLumiere, state, tryMove, world,
} from './engine.js?v=41';

const ENVOIS_PAR_S = 15;
const PORTEE_EPEE = 2.6;
const DEGATS_EPEE = 1;        // un demi-cœur de moins qu'un coup de géant : les duels durent
const DEGATS_FLECHE = 1;      // un demi-cœur (Eugène, 27 septembre) : l'arc harcèle, l'épée tranche
const INVULN = 0.9;

// =====================================================================
//  0. Où l'on joue : une partie solo, ou une instance
// =====================================================================
// Le compte Createur voit en permanence l'état de performance (bas à gauche, engine.js) :
// c'est sur sa machine et en jouant qu'on voit ce qui coûte. Hors ligne ou sans compte,
// rien ne s'affiche (F3 reste pour tous).
if (C.connecte()) C.profil().then((p) => { if (p && p.createur) perfCreateur(true); }).catch(() => {});

const inst = C.instance();
const actif = !!(inst && inst.code && C.connecte());
// LE SOLO EST RÉSERVÉ AU CRÉATEUR pendant qu'il le prépare (Eugène, 30 septembre) : hors d'une
// partie à plusieurs, sans le feu vert que l'accueil pose après avoir demandé au serveur
// (tloc_solo_ouvert, cf. accueil.js), on repart à l'accueil — qui dit pourquoi.
// (les bancs d'essai, pilotés par Playwright — navigator.webdriver —, passent : ils mesurent le solo)
if (!actif && !navigator.webdriver) {
  let ouvert = false; try { ouvert = localStorage.getItem('tloc_solo_ouvert') === '1'; } catch (e) {}
  if (!ouvert) { try { (window.top || window).location.replace('accueil.html'); } catch (e) { location.replace('accueil.html'); } }
}
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
let habillerNiveau = () => {};                        // posée ci-dessous en instance
if (actif) {
  Object.assign(state, {
    introSeen: true,          // pas d'enlèvement du prince en ouverture
    sword: true,              // l'épée est déjà au fourreau
    metLyderic: true,         // ... donc plus besoin d'aller la chercher
    q_cat: 3, q_crows: 3, q_ghosts: 3,   // les villageois n'ont rien à demander
    bourse: true, bourseChest: true,     // même équipement pour tout le monde : les duels restent justes
    // la carte du beffroi (M) : en solo, on la gagne au sommet du beffroi ; en instance, on
    // l'a d'office — c'est là qu'on voit les drapeaux et les siens (Eugène)
    // (seulement à Lille : la carte est celle de la châtellenie, M l'ouvrait au Batut)
    carteBeffroi: aLille(),
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

  // Fait une fois, dès que le niveau existe : à Lille, tout de suite (game.js l'a rangé avant
  // ce fichier) ; dans les mondes de monde.js et au Pouget, un peu plus tard — leur niveau naît
  // après l'installation de Camille (cf. assurerArene, appelé à chaque image)
  habillerNiveau = () => {
    if (aLille()) {
      G.level.counts = comptesInstance;
      G.level.start = () => showMessage(
        `${monPerso} entre dans la citadelle. Ici, pas de quête : les monstres, les remparts, et les autres joueurs.`, 6);
    } else {
      G.level.counts = () => `<small>Instance « ${inst.nom} » — ${arene ? arene.nom : 'balade'} : duels, pas de quête.</small>` + BOURSE.ligneHUD();
      G.level.start = () => showMessage(`${monPerso} arrive : ${arene ? arene.nom : 'ici'}. Pas de quête : les autres joueurs.`, 6);
    }
    G.level.arriveMessage = () => `De retour dans l\u2019instance « ${inst.nom} ».`;
    G.level.entry = () => null;      // pas de scène d'arrivée scénarisée
    // Phinaert est un monstre comme les autres (Eugène, 29 septembre) : sa mort ne lance pas
    // la cinématique de la quête (le donjon libéré, la clé au sommet) en pleine partie
    const tuer = G.level.onKill;
    G.level.onKill = (e) => { if (e.k && e.k.boss) { BOURSE.prime(e); showMessage('Phinaert est à terre !', 3); return; } return tuer && tuer(e); };
  };
  // son onde de choc frappe tout le monde : chaque navigateur simule ses monstres, et donc
  // celle de mon Phinaert atteint les bots que je fais vivre (les autres humains encaissent
  // celle du leur). Même chemin qu'un coup reçu : recul, riposte, mise à terre.
  CROCHETS.onde = (s) => {
    if (!s.bots) s.bots = new Set();
    for (const b of bots.values()) {
      if (!b.pos || b.mortT > 0 || s.bots.has(b.id) || b.niveau !== (G.level && G.level.name)) continue;
      const d = Math.hypot(b.pos.x - s.x, b.pos.z - s.z);
      if (Math.abs(d - s.r) < 1.3 && b.pos.y - s.y < 1.2) { s.bots.add(b.id); recevoirPourBot(b.id, { t: 'touche', d: 2, p: [s.x, s.z], de: null }); }
    }
  };
}
// La grille de l'enclos du donjon, ouverte en instance : Phinaert libre, et le portail OUVERT —
// la quête, qui l'anime, ne tourne pas ici (on passait une grille baissée sans collision).
let donjonOuvert = false;
function ouvrirDonjon() {
  if (!actif || donjonOuvert || !G.level || G.level.name !== 'citadel' || !PARTAGE.donjonGate || !enemies.some((e) => e.k && e.k.boss)) return;
  donjonOuvert = true;
  openGate(); PARTAGE.donjonGate.userData.poser(1);
}

// =====================================================================
//  La partie qui se resserre (Eugène, 29 septembre)
// =====================================================================
// Plus la manche avance, plus l'aire de jeu se réduit : on finit par se croiser. Les aires
// sont celles de l'ARÈNE du lieu (G.level.arenes, déclarée dans le fichier du lieu : à Lille,
// game.js), de la plus large à la plus étroite — à Lille, une seule : la citadelle, herse de
// la Porte Royale baissée. Depuis le 5 octobre, on joue toujours dans la première aire, hors
// manche et en balade aussi : « toute la châtellenie » éparpillait les joueurs à des centaines
// de mètres les uns des autres. Le calendrier dépend de la règle (n aires, la dernière la plus
// étroite ; avec une seule, il n'y a pas de resserrement) :
//   chrono      : chaque aire suivante quand il reste 2 min 30 de plus que la suivante (à
//                 Lille : la citadelle à 2 min 30 de la fin) ;
//   match à mort: une aire de plus toutes les 5 min de jeu ;
//   drapeaux    : une aire fixe selon la durée (moins de 5 min la plus étroite, puis une aire
//                 plus large par tranche de 5 min) — la même que celle où tombent les drapeaux.
// Chaque navigateur la calcule sur le chrono de la manche : rien à arbitrer au serveur.
// 50 s avant chaque resserrement, une annonce et un rideau de lumière qui se lève à la
// future limite ; ensuite, hors de l'aire, on perd un demi-cœur toutes les 1,5 s (les bots
// aussi, et ils rentrent d'eux-mêmes).
// Sans arène déclarée (un lieu qui n'en a pas encore), une seule aire sans limite : 'tout'.
// lues à la demande : hors de Lille, le niveau (et son arène) naît après ce fichier
const arenesNiveau = () => (G.level && G.level.arenes) || [];
let arene = arenesNiveau()[0] || null, areneVoulue = null, niveauHabille = false;
const AIRES = { tout: { id: 'tout', r: Infinity, nom: 'toute la carte' } };
const idsAires = () => (arene ? arene.aires.map((a) => a.id) : ['tout']);
// l'instance dit son arène à l'entrée (bienvenue) ; un lieu qui ne la déclare pas prend la sienne
function prendreArene(id) {
  const L = arenesNiveau();
  arene = L.find((a) => a.id === id) || L[0] || null;
  for (const k of Object.keys(AIRES)) if (k !== 'tout') delete AIRES[k];
  if (arene) for (const a of arene.aires) AIRES[a.id] = a;
  for (const r of rideaux.values()) scene.remove(r);
  rideaux.clear();
}
// À chaque image (et à l'entrée dans le salon) : l'arène voulue par l'instance, dès que le
// niveau l'a déclarée ; l'habillage du niveau en instance, une fois ; les noms des camps
function assurerArene() {
  if (!G.level) return;
  if (!niveauHabille) { niveauHabille = true; habillerNiveau(); }
  if (!(arene && (!areneVoulue || arene.id === areneVoulue) && arenesNiveau().includes(arene))) {
    const avant = arene;
    prendreArene(areneVoulue || (arene && arene.id));
    if (arene !== avant) aireEnVigueur = premiereAire();
  }
  // les camps gardent leurs clés (le serveur compte « garnison » et « bourg ») ; l'arène leur
  // donne ses noms — à la Garde-Guérin, la garde de la tour contre les muletiers… Une fois par
  // arène : quand le niveau la portait dès le départ, elle ne « changeait » jamais, et les
  // camps gardaient les noms de Lille.
  const cle = arene ? arene.id : '';
  if (cle !== campsDe) {
    campsDe = cle;
    for (const [k, c] of Object.entries(CAMPS)) Object.assign(c, CAMPS_LILLE[k], (arene && arene.camps && arene.camps[k]) || {});
    campsTexte = (arene && arene.campsTexte) || TEXTE_CAMPS_LILLE;
    peindrePanneau();
  }
}
let campsDe = null;
const PREAVIS = 50;
let debutCours = 0;                                  // pour le match à mort, qui n'a pas de chrono
function calendrierAire() {
  if (!manche) return [];
  const d = manche.duree || 180, ids = idsAires(), n = ids.length;
  if (regle === 'temps') return ids.map((aire, i) => ({ t: i ? d - 150 * (n - i) : 0, aire }));
  if (regle === 'survie') return ids.map((aire, i) => ({ t: 300 * i, aire }));
  if (regle === 'drapeaux') return [{ t: 0, aire: ids[Math.max(0, n - 1 - Math.floor(d / 300))] }];
  return [];
}
// secondes de jeu dans la manche en cours (null hors manche)
function tempsManche() {
  if (!manche || manche.etat !== 'cours') return null;
  if (manche.reste != null && manche.duree) return manche.duree - (manche.reste - (performance.now() - recuManche) / 1000);
  if (manche.depuis != null) return manche.depuis + (performance.now() - recuManche) / 1000;   // donné par le serveur
  return (performance.now() - debutCours) / 1000;
}
// l'aire en vigueur et la prochaine (avec son délai), à l'instant t
function etatAire(t) {
  const cal = calendrierAire();
  let cur = idsAires()[0], suiv = null;
  for (const e of cal) { if (e.t <= t) cur = e.aire; else if (!suiv && e.aire !== cur) suiv = { aire: e.aire, dans: e.t - t }; }
  return { cur, suiv };
}
// une aire peut avoir sa propre mesure (`sd`) : au Batut, le jardin n'est pas le domaine rétréci
const sdAire = (id) => AIRES[id].sd || arene.sd;
const horsAire = (x, z, aire) => AIRES[aire].r !== Infinity && sdAire(aire)(x, z) > AIRES[aire].r;
// Une arène SERRÉE (`serre: true`, l'estaminet : une salle de 11 × 9 m) : l'arrivée et le terrain
// d'un drapeau restent dans sa première aire, et les marges faites pour des quartiers (15 m en deçà
// de la limite, un cercle libre de 8 m autour d'un drapeau) se réduisent à la taille d'une salle —
// sans quoi on les cherchait dans la rue, derrière la porte (6 octobre, C8).
const serre = () => !!(arene && arene.serre);
const premiereAire = () => idsAires()[0];
// Ce qu'une arène a se déclare dans son fichier (`forge`, `bannieres`, `fete`) ; ce qu'elle ne
// déclare pas est éteint : la fête fauche l'herbe de Lille, la forge est celle de son bourg.
const areneA = (k) => !!(arene && arene[k]);
// `depart` : l'identifiant d'un lieu (E.addLieu), ou directement un point { x, z }
const lieuDepart = () => { const d = arene ? arene.depart : 'place'; return d && typeof d === 'object' ? d : lieux.find((l) => l.id === d); };

// le rideau : un ruban vertical le long de la limite, lumière qui monte et ondoie
const rideaux = new Map();
prendreArene(arene && arene.id);
function rideau(aire) {
  if (rideaux.has(aire)) return rideaux.get(aire);
  const R = AIRES[aire].r, C = arene.centre, N = 220, pts = [];
  for (let k = 0; k <= N; k++) {                    // le contour sd = R, pris par dichotomie sur chaque rayon
    const a = k / N * TAU, ux = Math.cos(a), uz = Math.sin(a);
    let lo = 0, hi = 2500;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (sdAire(aire)(C[0] + ux * m, C[1] + uz * m) < R) lo = m; else hi = m; }
    const x = C[0] + ux * lo, z = C[1] + uz * lo; pts.push([x, z, getH(x, z)]);
  }
  const contour = pts.map(([x, z]) => [x, z]);       // pour la minicarte et la carte M (PARTAGE.aires)
  const H = 26, pos = [], uv = [], idx = [];
  let s = 0;
  pts.forEach(([x, z, y], k) => { if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]); pos.push(x, y - 2, z, x, y + H, z); uv.push(s / 12, 0, s / 12, 1); if (k) { const b = 2 * k; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { t: { value: 0 }, a: { value: 0 }, c: { value: new THREE.Color(AIRES[aire].lueur || 0xffc860) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t, a; uniform vec3 c; varying vec2 vUv;
      // des raies franches qui montent (une frontière, pas la lumière du soir) et un liseré vif
      // au ras du sol, qui trace la limite là où l'on marche
      void main(){ float bas = smoothstep(1.0, 0.0, vUv.y), raie = pow(0.5 + 0.5 * sin(vUv.x * 6.2832 - t * 1.7 + vUv.y * 5.0), 3.0);
        float lisere = smoothstep(0.07, 0.0, vUv.y);
        gl_FragColor = vec4(c * (0.25 + 1.1 * raie + 1.5 * lisere), a * (bas * bas * (0.35 + 0.65 * raie) + lisere)); }` });
  const mesh = new THREE.Mesh(g, m); mesh.userData.dynamic = true; mesh.userData.contour = contour; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  rideaux.set(aire, mesh); return mesh;
}

let aireAnnoncee = null, aireEnVigueur = premiereAire(), brulure = 0;
// un point sûr pour réapparaître : l'arrivée choisie si elle est dans l'aire, sinon le lieu de
// départ de l'arène (à Lille, la place d'Armes)
function pointDansAire(p, aire = aireEnVigueur) {
  if (!p || !horsAire(p.x, p.z, aire)) return p;
  const pl = lieuDepart();
  return pl ? { x: pl.x, y: getH(pl.x, pl.z), z: pl.z } : p;
}
// les annonces : « la herse … retombe » quand l'aire en a une, sinon le resserrement tout court
const annonceAire = (id) => (AIRES[id].herse ? `${AIRES[id].herse} retombe : on se bat dans ${AIRES[id].nom} !` : `La partie se resserre sur ${AIRES[id].nom} !`);
const preavisAire = (id, s) => (AIRES[id].herse ? `Dans ${s} s, ${AIRES[id].herse} retombe : rentre dans ${AIRES[id].nom} !`
  : `Dans ${s} s, la partie se resserre sur ${AIRES[id].nom} : rapproche-toi !`);
const couleurAire = (id) => AIRES[id].couleur || '#ffd070';
function tickAire(dt, now) {
  const t = tempsManche();
  // hors manche (la balade, l'attente d'un adversaire), on reste dans la première aire
  const { cur, suiv } = t === null ? { cur: premiereAire(), suiv: null } : etatAire(t);
  // la herse suit l'aire : baissée tant qu'on est resserré sur l'aire qui en a une
  if (PARTAGE.herse) { const h = PARTAGE.herse.userData, but = AIRES[cur].herse ? 1 : 0;
    if (Math.abs(h.f - but) > 0.001) h.poser(but > h.f ? Math.min(but, h.f + dt / 3) : Math.max(but, h.f - dt / 2)); }
  for (const [k, r] of rideaux) r.visible = false;
  // les cartes tracent la limite en vigueur (trait plein) et celle qui s'annonce (tirets)
  PARTAGE.aires = [];
  if (cur !== aireEnVigueur) {
    const avant = aireEnVigueur; aireEnVigueur = cur;
    if (t !== null && AIRES[avant] && AIRES[cur].r < AIRES[avant].r) {
      showMessage(annonceAire(cur), 5);
      G.shake = Math.max(G.shake, 0.6); try { SFX.stomp(); } catch (e) {}
    }
  }
  if (t === null) aireAnnoncee = null;
  // le préavis : l'annonce une fois, le rideau qui se lève à la future limite
  else if (suiv && suiv.dans <= PREAVIS) {
    if (aireAnnoncee !== suiv.aire) {
      aireAnnoncee = suiv.aire;
      showMessage(preavisAire(suiv.aire, Math.round(suiv.dans)), 6);
      try { SFX.roar(); } catch (e) {}
    }
    const r = rideau(suiv.aire); r.visible = true;
    r.material.uniforms.t.value = now / 1000;
    r.material.uniforms.a.value = Math.min(1, (PREAVIS - suiv.dans) / 6) * (0.6 + 0.3 * Math.sin(now / 180));
    PARTAGE.aires.push({ pts: r.userData.contour, couleur: couleurAire(suiv.aire), tirets: true });
  }
  if (AIRES[cur].r !== Infinity) {                   // la limite en vigueur reste visible, plus sage
    const r = rideau(cur); r.visible = true; r.material.uniforms.t.value = now / 1000; r.material.uniforms.a.value = 0.45;   // assez pour se voir de loin (0,28 : on ne le voyait pas)
    PARTAGE.aires.push({ pts: r.userData.contour, couleur: couleurAire(cur), tirets: false });
  }
  // hors de l'aire, ça brûle : moi…
  brulure -= dt;
  if (brulure <= 0) {
    brulure = 1.5;
    const p = player;
    // le coup vient du dehors : le recul pousse vers le centre de l'arène
    const C = arene ? arene.centre : [0, 0];
    // pas avant d'avoir choisi son arrivée : on entre devant la Porte Royale, hors de la citadelle
    if (!elimine && state.apparition && !state.paused && horsAire(p.pos.x, p.pos.z, cur)) {
      const d = Math.hypot(p.pos.x - C[0], p.pos.z - C[1]) || 1;
      encaisser(1, p.pos.x + (p.pos.x - C[0]) / d * 3, p.pos.z + (p.pos.z - C[1]) / d * 3, null, null, 'aire');
      // « hors des abords », « hors de la citadelle » : de + le/les se contractent
      showMessage(`Hors ${AIRES[cur].nom.replace(/^les /, 'des ').replace(/^le /, 'du ').replace(/^(?!des |du )/, 'de ')} ! Rentre, ou tu perds des cœurs.`, 1.4);
    }
    // … et les bots que je fais vivre
    for (const b of bots.values()) if (b.pos && !(b.mortT > 0) && horsAire(b.pos.x, b.pos.z, cur))
      recevoirPourBot(b.id, { t: 'touche', d: 1, p: [C[0] + (b.pos.x - C[0]) * 1.02, C[1] + (b.pos.z - C[1]) * 1.02], de: null });
  }
}
// un bot hors de l'aire (ou de celle qui s'annonce) rentre vers le lieu de départ de l'arène
function botRentre(b) {
  if (!b.pos) return false;
  const t = tempsManche();
  const { cur, suiv } = t === null ? { cur: premiereAire(), suiv: null } : etatAire(t), vise = suiv && suiv.dans <= PREAVIS ? suiv.aire : cur;
  if (!horsAire(b.pos.x, b.pos.z, vise)) return false;
  const pl = lieuDepart(); if (!pl) return false;
  // une aire fermée par une porte ne s'entre que par elle (à Lille, le pont de la Porte
  // Royale) : hors grille de chemins, le bot filait droit et restait au bord du fossé
  const P = AIRES[vise].porte;
  if (P) {
    const sur = P.sur(b.pos.x, b.pos.z), [bx, bz] = sur ? P.dedans : P.dehors;
    b.but = { x: bx, z: bz };
    if (Math.hypot(b.but.x - b.pos.x, b.but.z - b.pos.z) < 3) b.but = sur ? { x: pl.x, z: pl.z } : { x: P.seuil[0], z: P.seuil[1] };
    return true;
  }
  b.but = { x: pl.x, z: pl.z }; return true;
}

// =====================================================================
//  2. Retour à l'accueil depuis les menus
// =====================================================================
// Les menus du moteur (`menu.items`, `menu.sel`, Entrée ou un clic appellent `fn()`) : on
// ajoute une entrée « Accueil » au menu titre et au menu pause, navigable comme les autres.

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

  // survol et clic des lignes : c'est le moteur qui s'en charge désormais (engine.js, après
  // hideMenu), pour toutes les pages — y compris la ligne « Accueil » ajoutée ici
  if (ovgo) new MutationObserver(greffer).observe(ovgo, { childList: true });
  if (ov) new MutationObserver(greffer).observe(ov, { attributes: true, attributeFilter: ['class'] });
  setInterval(greffer, 600);      // filet : un menu ouvert sans mutation observée
  greffer();

  // bouton de coin, pour sortir sans passer par la pause ; masqué quand la souris est
  // capturée par le jeu, où il ne servirait à rien
  const b = document.createElement('button');
  b.id = 'bouton-accueil';                 // caché au doigt (engine.js) : il était sous le pouce du joystick
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
// Les noms sont ceux de Lille ; une autre arène donne les siens (`camps`, cf. assurerArene),
// `court` est celui du score, et `pluriel` accorde le verbe (« la garnison prend », « les gens
// du bourg prennent »).
const CAMPS_LILLE = {
  garnison: { nom: 'La garnison', court: 'Garnison', tunique: 0, couleur: '#9cc8ff', pluriel: false },
  bourg: { nom: 'Les gens du bourg', court: 'Bourg', tunique: 1, couleur: '#ff9c8c', pluriel: true },
};
const CAMPS = { garnison: { ...CAMPS_LILLE.garnison }, bourg: { ...CAMPS_LILLE.bourg } };
const TEXTE_CAMPS_LILLE = 'La garnison de la citadelle contre les gens du bourg.';
let campsTexte = TEXTE_CAMPS_LILLE;
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
    lignes.push(`<b style="color:${G_.couleur}">${G_.court} ${points.garnison}</b> — <b style="color:${B_.couleur}">${points.bourg} ${B_.court}</b>`
      + (CAMPS[state.camp] ? ` <span style="opacity:.7">(tu es avec ${CAMPS[state.camp].nom.charAt(0).toLowerCase() + CAMPS[state.camp].nom.slice(1)})</span>` : ''));
    if (regle === 'balade') lignes.push(`<span style="opacity:.8;font-size:12px">premier camp à ${VICTOIRE_BALADE} points : victoire</span>`);
    if (regle === 'drapeaux' && drapeaux.length) {
      const n = (c) => drapeaux.filter((d) => d.camp === c).length;
      lignes.push(`<span style="opacity:.85;font-size:12px">drapeaux : <span style="color:${CAMPS.garnison.couleur}">${n('garnison')}</span> · <span style="color:${CAMPS.bourg.couleur}">${n('bourg')}</span> sur ${drapeaux.length}</span>`);
    } else if (bannieres && areneA('bannieres')) {
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
// Les portes d'un lieu (le Batut) : le lieu les ouvre et les ferme chez soi, et le dit au salon par
// ce crochet ; le salon le redit aux autres (m.t === 'porte'). Sans instance, il n'y a pas de crochet.
PARTAGE.envoyerPorte = (id, ouverte) => envoyer({ t: 'porte', id, ouverte });

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
      // l'instance se joue ailleurs (un lien, un onglet resté ouvert) : on va à la page de son arène
      const page = C.pageArene(m.arene), ici = location.pathname.split('/').pop() || 'index.html';
      if (m.arene && page !== ici) {
        try { sessionStorage.setItem('tloc_auto', 'instance'); sessionStorage.setItem('tloc_entree', '1'); } catch (e) {}
        ws.onclose = null; ws.close(); location.replace(page); return;
      }
      areneVoulue = m.arene || null; assurerArene();
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
      // les portes que le salon connaît fermées (ou rouvertes) avant notre arrivée
      if (m.portes && G.level && G.level.porte) for (const [id, o] of Object.entries(m.portes)) G.level.porte(id, o);
      if (m.bannieres) bannieres = m.bannieres;
      lieuxDrapeauxServeur = m.lieux_drapeaux || 0;
      if (m.drapeaux) evenementDrapeaux({ drapeaux: m.drapeaux });
      if (m.fete) ouvrirFete(m.fete);
      envoyerLook(true);
      showMessage(`Instance « ${m.nom} » — code ${m.code}. ${m.joueurs.length ? m.joueurs.map(j => j.perso || j.pseudo).join(', ') + ' déjà là.' : 'Tu es seul pour l’instant.'} T pour écrire aux autres.`, 5);
      peindrePanneau();
    } else if (m.t === 'arrivee') {
      creerAutre(m.id, m.pseudo, {}, m.perso);
      showMessage(`${m.perso || m.pseudo} ${aLille() ? 'vient d’entrer dans la citadelle' : 'arrive'}.`, 3);
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
      a.ctx.monte = !!m.ch; a.ctx.selle = SELLE;
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
    } else if (m.t === 'victoire') { afficherVictoire(m);
    } else if (m.t === 'drapeaux') { lieuxDrapeauxServeur = 1; evenementDrapeaux(m);
    } else if (m.t === 'bourse') { poserBourse(m);
    } else if (m.t === 'bourse-prise') { prendreBourse(m);
    } else if (m.t === 'objets') { majObjets(m);
    } else if (m.t === 'porte') { if (G.level && G.level.porte) G.level.porte(m.id, m.ouverte);
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
      noterChat(m.perso || m.pseudo, m.m, moi && m.id === moi.id, !!m.e);
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
    campsTexte + ' Les coups entre alliés ne portent pas ; chaque mise à terre d’un adversaire rapporte un point à ton camp.',
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
      if (serre() && horsAire(px, pz, premiereAire())) continue;
      if (eau(px, pz) < 2) continue;
      const y = world.levelH ? world.levelH(px, pz) : 0;
      if (blocked(px, pz, 0.8, false, y)) continue;
      const nom = world.zoneName ? world.zoneName(px, pz) : '';
      return { x: px, z: pz, nom };
    }
  }
  return null;
}

// le point d'arrivée cliqué sur la carte : praticable ET ouvert (cf. ouvert) — le plus proche
// du clic qui le soit, sans quoi on arrivait dans un recoin entre trois murs. Un clic hors de
// l'aire de départ de l'arène est ramené vers son centre, à 15 m en deçà de la limite : on
// arrive là où les autres jouent (on choisissait sa rue à un kilomètre de tout le monde).
function praticableOuvert(x, z) {
  const a0 = premiereAire();
  const marge = serre() ? 0.5 : 15;
  if (horsAire(x, z, a0) || (AIRES[a0].r !== Infinity && sdAire(a0)(x, z) > AIRES[a0].r - marge)) {
    const [cx, cz] = arene.centre;
    let lo = 0, hi = 1;                               // la part du chemin vers le centre
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (sdAire(a0)(x + (cx - x) * m, z + (cz - z) * m) > AIRES[a0].r - marge) lo = m; else hi = m; }
    x += (cx - x) * hi; z += (cz - z) * hi;
  }
  return praticableOuvertIci(x, z);
}
function praticableOuvertIci(x, z) {
  for (const r of [0, 3, 6, 10, 15]) for (let k = 0; k < (r ? 8 : 1); k++) {
    const a = k / 8 * TAU, q = praticable(x + Math.cos(a) * r, z + Math.sin(a) * r);
    if (q && ouvert(q.x, q.z)) return q;
  }
  return null;
}
// Hors de Lille, pas de carte où cliquer (l'atlas est celui de la châtellenie) : on arrive au
// départ de son camp si l'arène en donne un (`departsCamps` : au Batut ou à Beauregard selon
// son équipe…), sinon au ralliement, sinon au départ de l'arène, sur un point praticable.
function arriveeAuto() {
  const dc = enEquipes() && arene && arene.departsCamps && arene.departsCamps[state.camp];
  const base = dc ? { x: dc[0], z: dc[1] } : (monRdv() || lieuDepart());
  if (!base) return null;
  for (let k = 0; k < 40; k++) {
    // à quelques mètres du point, au hasard : deux joueurs arrivaient l'un dans l'autre ;
    // `dispersion` les garde dans la pièce d'arrivée (au Batut, le vestibule fait 6 m)
    const D = (arene && arene.dispersion) || 8, a = Math.random() * TAU, r = Math.min(D, 1 + Math.random() * (D * 0.6 + k * 0.4));
    const q = praticableOuvertIci(base.x + Math.cos(a) * r, base.z + Math.sin(a) * r);
    if (q && !horsAire(q.x, q.z, premiereAire())) return q;
  }
  return null;
}
async function choisirApparition() {
  const pre = monRdv();
  const p = arene && !arene.carte ? arriveeAuto() : await ATLAS.choisirPoint(praticableOuvert, enEquipes() ? pre : (estHote ? null : pre));
  if (p) {
    player.pos.set(p.x, getH(p.x, p.z, (world.levelH ? world.levelH(p.x, p.z) : 0) + 0.5) + 0.1, p.z);
    player.vy = 0; player.kb.set(0, 0, 0);
    orienterArrivee();
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
  // en bas à gauche, au-dessus du bouton « Accueil » : à droite, sous la liste des joueurs,
  // il finissait sur l'aide des touches dès qu'on était une dizaine
  zoneChat.style.cssText = `position:absolute; left:16px; bottom:64px; width:min(420px, 40vw); font-size:13px; line-height:1.45;
    text-align:left; color:#fff; text-shadow:0 2px 3px rgba(0,0,0,.85); pointer-events:none;`;
  (document.getElementById('hud') || document.body).appendChild(zoneChat);
}

function noterChat(nom, texte, deMoi, equipe = false) {
  journal.push({ nom, texte, deMoi, equipe, t: performance.now() });
  if (journal.length > 6) journal.shift();
  peindreChat();
  if (!deMoi) try { SFX.pickup(); } catch (e) {}
}

function peindreChat() {
  const t = performance.now();
  zoneChat.replaceChildren(...journal.filter((l) => t - l.t < 20000).map((l) => {
    const d = document.createElement('div');
    const b = document.createElement('b');
    b.style.color = l.deMoi ? '#ffe7a3' : (l.equipe && CAMPS[state.camp] ? CAMPS[state.camp].couleur : '#c9e6ff');
    b.textContent = l.nom + ' : ';
    // un message à son camp : marqué, pour ne pas croire que l'adversaire l'a lu
    if (l.equipe) { const e_ = document.createElement('span'); e_.style.cssText = 'opacity:.75;font-size:11px'; e_.textContent = '[camp] '; d.append(e_); }
    d.append(b, document.createTextNode(l.texte));
    return d;
  }));
}

// En équipes, la boîte s'ouvre sur son camp — c'est à lui qu'on parle le plus souvent ; Tab
// bascule vers tout le monde (et retour).
let chatEquipe = false;
function peindreBoite() {
  if (!boite) return;
  const c = CAMPS[state.camp];
  boite.placeholder = chatEquipe && c ? `Message à ${c.nom.toLowerCase()} — Tab : à tous · Entrée pour envoyer, Échap pour annuler`
    : `Message à tous${enEquipes() ? ' — Tab : à ton camp ·' : ' —'} Entrée pour envoyer, Échap pour annuler`;
  boite.style.borderColor = chatEquipe && c ? c.couleur : 'rgba(255,231,163,.45)';
}
function ouvrirChat() {
  if (boite) return;
  boite = document.createElement('input');
  boite.maxLength = 200;
  chatEquipe = enEquipes() && !!CAMPS[state.camp];
  boite.style.cssText = `position:fixed; left:50%; bottom:64px; transform:translateX(-50%); width:min(560px, 86vw);
    z-index:2001; font:inherit; font-size:15px; padding:9px 14px; border-radius:9px; color:#fff;
    background:rgba(10,14,30,.88); border:1px solid rgba(255,231,163,.45); outline:none;`;
  document.body.appendChild(boite);
  peindreBoite();
  boite.focus();
}
function fermerChat(envoi) {
  if (!boite) return;
  const texte = boite.value.trim();
  boite.remove(); boite = null;
  if (!envoi || !texte) return;
  if (texte.startsWith('/')) commande(texte); else envoyer({ t: 'chat', m: texte, e: chatEquipe ? 1 : undefined });
}

// Les commandes du chat : ce qui n'a pas besoin d'un bouton à soi.
function commande(texte) {
  const [c, ...args] = texte.slice(1).trim().split(/\s+/);
  const cle = (c || '').toLowerCase();
  if ((cle === 'fete' || cle === 'fête') && !areneA('fete')) {
    noterChat('✦', 'Pas de fête de la moisson ici : il n’y a rien à faucher.', true);
  } else if (cle === 'fete' || cle === 'fête') {
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
    noterChat('✦', 'Commandes : /donner Nom 20' + (areneA('fete') ? ' · /fete (l’hôte : trois minutes de moisson, le plus gros fauchage gagne)' : ''), true);
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
  if (!areneA('fete')) return;          // le serveur la refuse déjà ; une vieille instance pourrait l'avoir ouverte
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
    corps = `<b style="color:${CAMPS.garnison.couleur}">${CAMPS.garnison.court} ${t.garnison}</b> — <b style="color:${CAMPS.bourg.couleur}">${t.bourg} ${CAMPS.bourg.court}</b><br>` + corps; }
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
  if (regle === 'drapeaux' || !areneA('bannieres')) { for (const h of Object.values(hampes)) h.visible = false; return; }   // les drapeaux remplacent les bannières
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
  // la remise en place d'une manche neuve (« raz ») ne nomme aucun camp : rien à annoncer
  if (!CAMPS[m.camp]) return peindrePanneau();
  // les noms de l'arène : « la bannière de la garnison », « des muletiers », « de ceux d'en bas »
  const leCamp = (c) => CAMPS[c].nom.charAt(0).toLowerCase() + CAMPS[c].nom.slice(1), deMoi = moi && m.id === moi.id;
  const drap = `la bannière ${('de ' + leCamp(m.camp)).replace(/^de les /, 'des ').replace(/^de le /, 'du ')}`;
  if (m.evt === 'prise') showMessage(deMoi ? `Tu portes ${drap} ! Rapporte-la à ton ralliement.` : `${m.perso} s’empare de ${drap} !`, 4);
  else if (m.evt === 'tombe') showMessage(`${m.perso} lâche ${drap}.`, 3);
  else if (m.evt === 'rendue') showMessage(`${m.perso} ramène ${drap} chez elle.`, 3);
  else if (m.evt === 'rentre') showMessage(`${drap.charAt(0).toUpperCase() + drap.slice(1)} rentre à son ralliement.`, 3);
  else if (m.evt === 'marque') {
    const camp = autreCamp(m.camp);
    showMessage(`${m.perso} rapporte ${drap} : trois points pour ${leCamp(camp)} !`, 5);
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
  const lueur = new THREE.PointLight(0xffd070, 2, 4); lueur.position.y = 0.7; g.add(lueur); sourceLumiere(lueur);   // par le réservoir du moteur : sinon, tout se recompile
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
      else if (e.code === 'Tab' && enEquipes() && CAMPS[state.camp]) { e.preventDefault(); chatEquipe = !chatEquipe; peindreBoite(); }
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
//  La prise des drapeaux (règle « drapeaux », en équipes)
// ---------------------------------------------------------------------
// Des drapeaux aux points forts de la citadelle ; on en prend un en restant dans son cercle
// (le serveur compte qui s'y tient, cf. DRAPEAU_RAYON dans app.py). Seul camp dans le
// cercle : la jauge monte — l'étendard grimpe au mât — plus vite à plusieurs ; les deux
// camps : contesté, rien ne bouge. Un drapeau adverse se rabat d'abord (l'étendard descend),
// puis se lève à ses couleurs. À la fin du chrono, le camp qui en tient le plus gagne.
// Leur nombre suit la partie (le serveur le fixe au début de chaque manche) : la place
// d'Armes d'abord, puis, un à un, le point fort le plus éloigné de ceux déjà retenus — à deux
// ou trois drapeaux, ils étaient tous à moins de cent mètres (Eugène : « plus dispersés »).
// Les points forts sont déclarés par l'arène (pointsForts : à Lille, la place, les casernes, la
// poterne et la gorge des bastions), le premier étant le lieu de départ.
const candidatsDrapeaux = () => (arene && arene.pointsForts ? arene.pointsForts(lieux) : []);
const RAYON_DRAPEAU = 8;                       // = DRAPEAU_RAYON (app.py)
const COULEUR_NEUTRE = 0xe6dcc0;
let drapeaux = [], tenue = { garnison: 0, bourg: 0 }, drapeauxProposes = false, lieuxDrapeauxServeur = 0;
const mats = new Map();                         // id -> { g, drap, anneau, jauge, fait }
let marquesObjets = [];
// la minicarte : les objets qui attendent, et les drapeaux à leurs couleurs
// En équipes, les joueurs aussi — bots compris — à la couleur de leur camp (Eugène : on
// doit les voir sur la carte). Les drapeaux en petits drapeaux, hampe et flamme.
function majMarques() {
  const coul = (d) => (d.camp ? CAMPS[d.camp].couleur : '#e6dcc0');
  const gens = !enEquipes() ? [] : [...autres.values()].filter((a) => CAMPS[a.camp] && a.mesh.visible && a.niveau === (G.level && G.level.name))
    .map((a) => ({ x: a.mesh.position.x, z: a.mesh.position.z, fond: CAMPS[a.camp].couleur, bord: '#10141e', forme: 'joueur' }));
  PARTAGE.marques = [...marquesObjets, ...gens,
    ...drapeaux.map((d) => ({ x: d.p[0], z: d.p[1], fond: coul(d), bord: d.conteste ? '#ffffff' : '#1a1a1a', forme: 'drapeau' }))];
}
// Une vingtaine d'emplacements possibles (Eugène) : le serveur en tire au sort, à chaque
// manche, autant qu'il faut de drapeaux, écartés les uns des autres (cf. armer_drapeaux) —
// ainsi chaque recoin de la place finit par servir, et un mauvais emplacement se voit vite.
// On attend la grille des chemins (cf. preparerNav) : un emplacement doit être dégagé (le
// cercle entier libre) et atteignable depuis la place d'Armes — au premier essai, la poterne
// tombait dans une cour fermée, et le donjon est derrière une grille close. On échantillonne
// une zone qui grandit avec la durée de la partie (Eugène, 29 septembre) : l'aire de l'arène
// où se joue la manche (calendrierAire). À Lille : moins de 5 min, la citadelle seule (à 12 m
// de ses courtines) — on s'y croise, c'est plus vif ; au-delà, son parc jusqu'à la Deûle
// (toute la châtellenie n'est plus une aire depuis le 5 octobre). Toujours à ciel ouvert
// (pas sous un porche du quartier). On garde ensuite les
// plus écartés : chacun au plus loin des précédents, ils se répartissent sur toute la zone.
const NB_EMPLACEMENTS = 20;
function nomEmplacement(x, z, pris, place) {
  const l = lieux.filter((q) => q.id !== 'donjon' && Math.hypot(q.x - x, q.z - z) < 40).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
  let nom = l ? l.nom : '';
  if (!nom) {
    // l'article selon le nom de la zone ; certains l'ont déjà (« Les rues de Lille »), et
    // depuis que les drapeaux sortent de la citadelle il faut les noms du parc et de la ville
    const zn = (world.zoneName ? world.zoneName(x, z) : '') || 'Place d\u2019Armes', m = zn.charAt(0).toLowerCase() + zn.slice(1);
    nom = /^(les|la|le|l[’'])\s?/.test(m) ? m
      : /^(remparts|fossés|casernes|galeries|jardins|rues|quais)\b/.test(m) ? 'les ' + m
      : /^[aeiouhéèêâîô]/.test(m) ? 'l\u2019' + m
      : /^(place|porte|poterne|caserne|chapelle|cour|courtine|galerie|façade|plaine|rue|passerelle|citadelle|deûle|prairie|pâture|promenade|voie|route|ferme|maison|chaumière|lisière|berge|rive)\b/.test(m) ? 'la ' + m
      : 'le ' + m;
  }
  if (pris.has(nom)) {                              // deux fois « la place d'Armes » : on dit le côté
    const a = Math.atan2(-(z - place.z), x - place.x), cotes = ['est', 'nord-est', 'nord', 'nord-ouest', 'ouest', 'sud-ouest', 'sud', 'sud-est'];
    const base = nom; nom = `${base}, côté ${cotes[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]}`;
    for (let k = 2; pris.has(nom); k++) nom = `${base} (${k})`;
  }
  pris.add(nom);
  return nom;
}
function proposerDrapeaux() {
  if (regle !== 'drapeaux' || drapeauxProposes || lieuxDrapeauxServeur || (!lieux.length && aLille()) || !state.running || !G.level) return;   // hors de Lille, pas de lieux nommés
  if (!manche || !manche.duree) return;               // la zone dépend de la durée
  if (!nav || nav.fait < nav.nz) return;
  const place = lieuDepart();                         // la place d'Armes à Lille, le départ de l'arène ailleurs
  if (!place) return;
  const p0 = terrainDrapeau(place) || praticable(place.x, place.z);
  if (!p0) return;
  const relie = champ({ id: 'relie', p: [p0.x, p0.z] }), { nx, nz, libre } = nav;
  // un cercle dégagé, lu dans la grille : deux couronnes de cases libres
  const anneaux = [];
  for (const r of [3.5, RAYON_DRAPEAU - 1]) for (let k = 0; k < 16; k++) anneaux.push([Math.round(Math.cos(k / 16 * TAU) * r / NAV_PAS), Math.round(Math.sin(k / 16 * TAU) * r / NAV_PAS)]);
  const zone = calendrierAire()[0].aire, A = AIRES[zone], ids = idsAires(), etroite = zone === ids[ids.length - 1];
  const parc = A.riveDeule ? intraDeule(p0) : null;
  const cands = [];
  for (let j = 0; j < nz; j += 2) for (let i = 0; i < nx; i += 2) {
    const k = j * nx + i;
    if (relie[k] < 0) continue;
    const x = nav.x0 + (i + 0.5) * NAV_PAS, z = nav.z0 + (j + 0.5) * NAV_PAS;
    // à 40 m au moins de la limite du monde : près d'elle, les rues continuent au-delà sans
    // rempart dessiné, et l'on bute contre un « faux mur » en voyant le drapeau (Eugène, 29 sept.)
    // l'aire la plus étroite : à 14 m en deçà de sa limite (12 m des courtines de la citadelle)
    if (A.r === Infinity ? horsEnceinte(x, z) > -40 : etroite ? sdAire(zone)(x, z) > A.r - 14
      : (parc && !parc[k]) || sdAire(zone)(x, z) > A.r || (A.exclut && A.exclut(x, z))) continue;
    if (anneaux.every(([di, dj]) => { const a = i + di, b = j + dj; return a >= 0 && b >= 0 && a < nx && b < nz && libre[b * nx + a]; })) cands.push([x, z]);
  }
  // les plus écartés : la place, puis toujours le point le plus loin de ceux déjà retenus
  const choisis = [[p0.x, p0.z]], dmin = cands.map(([x, z]) => Math.hypot(x - p0.x, z - p0.z));
  while (choisis.length < NB_EMPLACEMENTS && cands.length) {
    let k = 0; for (let i = 1; i < cands.length; i++) if (dmin[i] > dmin[k]) k = i;
    if (dmin[k] < 2.5 * RAYON_DRAPEAU) break;       // plus de place sans que deux cercles se touchent
    const [x, z] = cands[k];
    // sous un toit (porche, galerie) : on l'écarte pour de bon et on cherche le suivant
    if (!BOURSE.aCielOuvert(x, world.levelH ? world.levelH(x, z) : getH(x, z), z)) { dmin[k] = -1; continue; }
    choisis.push([x, z]);
    for (let i = 0; i < cands.length; i++) dmin[i] = Math.min(dmin[i], Math.hypot(cands[i][0] - x, cands[i][1] - z));
  }
  const noms = new Set();
  const liste = choisis.map(([x, z], k) => ({ id: 'd' + k, nom: nomEmplacement(x, z, noms, place), p: [+x.toFixed(2), +z.toFixed(2)],
    y: +(world.levelH ? world.levelH(x, z) : getH(x, z)).toFixed(2), n: G.level.name }));
  drapeauxProposes = liste.length || true;
  console.log('drapeaux (%s) : %d emplacements —', zone, liste.length, liste.map((d) => `${d.nom} (${Math.round(d.p[0])}, ${Math.round(d.p[1])})`).join(' · '));
  if (liste.length) envoyer({ t: 'drapeaux-lieux', drapeaux: liste });
}
// Le parc de la citadelle, c'est ce qu'on atteint depuis la place sans franchir la Deûle :
// on inonde la grille en fermant les ponts du relevé (PONTS, carte.js — ceux des fossés de la
// place n'en font pas partie : citadelle.js les bâtit à part). La frontière suit l'eau telle
// qu'elle est ; mais le relevé ne ferme pas la Deûle tout autour, et l'inondation filait par la
// terre jusque dans les rues de Lille : on la borne aussi au bois du parc (le rayon de l'aire),
// hors du tissu bâti de la ville (son `exclut`, enQuartier) qui l'entame côté Esplanade.
function intraDeule(p0) {
  const { nx, nz, libre } = nav, vu = new Uint8Array(nx * nz), file = new Int32Array(nx * nz);
  const ouvert = (k) => { const i = k % nx, j = (k - i) / nx; return libre[k] && pont(nav.x0 + (i + 0.5) * NAV_PAS, nav.z0 + (j + 0.5) * NAV_PAS) === null; };
  const k0 = caseNav(p0.x, p0.z); if (k0 < 0) return vu;
  let tete = 0, queue = 0; vu[k0] = 1; file[queue++] = k0;
  while (tete < queue) {
    const k = file[tete++], i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const q = b * nx + a; if (vu[q] || !ouvert(q) || !passe(k, q)) continue;
      vu[q] = 1; file[queue++] = q;
    }
  }
  return vu;
}
// Un drapeau veut du champ : son cercle doit être libre (au donjon, le point praticable le
// plus proche collait à la tour, et le cercle passait à travers ses murs). On cherche autour
// du lieu un centre dont le cercle, sondé sur deux couronnes, ne touche ni mur ni eau.
function terrainDrapeau(l, relie = null) {
  const libre = (x, z) => !(world.bounds && world.bounds(x, z)) && eau(x, z) > 2 && !blocked(x, z, 0.9, false, world.levelH ? world.levelH(x, z) : 0);
  for (let r = 0; r <= 40; r += 2) {
    const n = r ? Math.ceil(r * 1.5) : 1;
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, x = l.x + Math.cos(a) * r, z = l.z + Math.sin(a) * r;
      let ok = libre(x, z) && (!relie || relie[caseNav(x, z)] >= 0) && !(serre() && horsAire(x, z, premiereAire()));
      for (const rr of serre() ? [1.2] : [3.5, RAYON_DRAPEAU - 1]) for (let j = 0; j < 12 && ok; j++) ok = libre(x + Math.cos(j / 12 * TAU) * rr, z + Math.sin(j / 12 * TAU) * rr);
      if (ok) return { x, z };
    }
  }
  return null;
}
// Le cercle épouse le terrain : un anneau plat de huit mètres, posé à une hauteur, se
// plantait dans la moindre pente (et flottait au-dessus des creux).
function anneauGeo(cx, cz, r0, r1, frac = 1) {
  const n = Math.max(2, Math.ceil(72 * frac)), pos = [], idx = [];
  const h = (x, z) => (world.levelH ? world.levelH(x, z) : getH(x, z)) + 0.07;
  for (let k = 0; k <= n; k++) {
    const a = -Math.PI / 2 + k / n * frac * TAU, c = Math.cos(a), s_ = Math.sin(a);
    for (const r of [r0, r1]) { const x = cx + c * r, z = cz + s_ * r; pos.push(x, h(x, z), z); }
    if (k) { const i = 2 * k; idx.push(i - 2, i - 1, i, i - 1, i + 1, i); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}
function mat(d) {
  let m = mats.get(d.id);
  if (m) return m;
  const g = new THREE.Group();
  const bois = phMat('wood_cabinet_worn_long', 1, 4, { color: 0x6b4a2a });
  const hampe_ = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.2, 10), bois); hampe_.position.y = 2.6; hampe_.castShadow = true; g.add(hampe_);
  const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.35, 12), phMat('old_stone_wall_02', 0.6, 0.3, { color: 0xd8d0c0 })); pied.position.y = 0.17; g.add(pied);
  const pomme = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.8, roughness: 0.3 }));
  pomme.position.y = 5.28; g.add(pomme);
  const drapGeo = new THREE.PlaneGeometry(1.8, 1.15, 10, 1); drapGeo.translate(0.9, 0, 0);
  const drap = new THREE.Mesh(drapGeo, new THREE.MeshStandardMaterial({ color: COULEUR_NEUTRE, roughness: 0.9, side: THREE.DoubleSide }));
  g.add(drap);
  g.position.set(d.p[0], d.y, d.p[1]); g.userData.dynamic = true;
  scene.add(g);
  const matAnneau = new THREE.MeshBasicMaterial({ color: COULEUR_NEUTRE, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const anneau = new THREE.Mesh(anneauGeo(d.p[0], d.p[1], RAYON_DRAPEAU - 0.3, RAYON_DRAPEAU), matAnneau);
  const jauge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: COULEUR_NEUTRE, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  for (const o of [anneau, jauge]) { o.renderOrder = 2; o.userData.dynamic = true; scene.add(o); }
  m = { g, drap, anneau, jauge, frac: -1 };
  mats.set(d.id, m);
  return m;
}
function peindreDrapeaux() {
  const enJeu = new Set(drapeaux.map((d) => d.id));
  for (const [id, m] of mats) if (!enJeu.has(id)) { for (const o of [m.g, m.anneau, m.jauge]) scene.remove(o); mats.delete(id); }
  for (const d of drapeaux) {
    const m = mat(d), coul = (c) => (c ? COULEUR_DRAP[c] : COULEUR_NEUTRE);
    m.drap.material.color.setHex(coul(d.camp || (d.jauge > 0 ? d.vers : null)));
    m.anneau.material.color.setHex(coul(d.camp));
    m.jauge.material.color.setHex(coul(d.vers));
    // la jauge : un arc intérieur qui fait le tour à mesure qu'on prend (ou qu'on rabat)
    const frac = Math.round(d.jauge * 72) / 72;
    if (frac !== m.frac) {
      m.frac = frac; m.jauge.geometry.dispose();
      m.jauge.geometry = frac > 0 ? anneauGeo(d.p[0], d.p[1], RAYON_DRAPEAU - 1.1, RAYON_DRAPEAU - 0.5, frac) : new THREE.BufferGeometry();
    }
  }
  majMarques();
}
function tickDrapeaux(now) {
  if (regle !== 'drapeaux') return;
  // aussi pendant l'arrivée (titre, armoire, camp, carte : le jeu est figé), et plus vite :
  // c'est là que la grille de toute la carte se remplit sans que personne ne le sente
  if (G.level && !G.sommeil) preparerNav();
  proposerDrapeaux();
  const t = now / 1000;
  for (const d of drapeaux) {
    const m = mats.get(d.id);
    if (!m) continue;
    // l'étendard monte au mât avec la jauge : en haut, il est à son camp
    const cible = 1.3 + (d.camp ? 1 : d.jauge) * 3.3;
    m.drap.position.y += (cible - m.drap.position.y) * 0.1;
    const pa = m.drap.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, Math.sin(t * 3 + x * 2.5 + d.p[0]) * 0.09 * x); }
    pa.needsUpdate = true;
    m.anneau.material.opacity = d.conteste ? 0.35 + 0.35 * Math.abs(Math.sin(t * 5)) : 0.55;
  }
}
// ce que je vois de la prise, dans le bandeau : où j'en suis si je suis dans un cercle
function ligneDrapeau() {
  const moiIci = drapeaux.find((d) => Math.hypot(player.pos.x - d.p[0], player.pos.z - d.p[1]) <= RAYON_DRAPEAU);
  if (!moiIci || !state.camp) return '';
  const nom = ech(moiIci.nom.replace(/^(la |le |les |l[’'])/i, ''));
  if (moiIci.conteste) return `<br><span style="color:#ffb08a">${nom} : contesté — chasse-les du cercle !</span>`;
  if (moiIci.camp === state.camp && moiIci.jauge >= 1) return `<br><span style="opacity:.85">${nom} : à ton camp, tiens-le.</span>`;
  const pct = Math.round(moiIci.jauge * 100);
  if (moiIci.camp && moiIci.camp !== state.camp) return `<br>${nom} : tu le rabats — <b>${pct} %</b>`;
  return `<br>${nom} : prise en cours — <b>${moiIci.vers === state.camp || !moiIci.vers ? pct : 0} %</b>`;
}
function evenementDrapeaux(m) {
  if (m.drapeaux) drapeaux = m.drapeaux;
  if (m.tenue) tenue = m.tenue;
  const d = m.id && drapeaux.find((x) => x.id === m.id);
  if (d && m.evt === 'pris') {
    const noms = (m.noms || []).join(', ');
    showMessage(`${CAMPS[m.camp].nom} ${CAMPS[m.camp].pluriel ? 'prennent' : 'prend'} ${d.nom}${noms ? ' (' + noms + ')' : ''} !`, 4);
    try { if (m.camp === state.camp) SFX.win(); } catch (e) {}
  } else if (d && m.evt === 'neutre') showMessage(`Le drapeau de ${d.nom} est rabattu : ${m.camp === state.camp ? 'reprends-le !' : 'il n’est plus à personne.'}`, 3.5);
  peindreDrapeaux(); peindrePanneau();
}

// En équipes, tout le monde part à égalité (Eugène) : l'arc et un carquois plein pour
// chacun, à l'arrivée, au début de chaque manche et à chaque relève. Les râteliers d'arc de
// la poterne et de la chapelle n'ont donc plus rien à donner : ils s'effacent.
let equipeDonnee = false;
function equiperEquipe(dire) {
  if (!enEquipes()) return;
  state.bow = true; arcPris = false;
  state.fleches = BOURSE.carquois();
  if (dire) showMessage(`En équipes, chacun a son arc et ${state.fleches} flèches : C pour le sortir, clic gauche pour tirer.`, 5);
}

// ---------------------------------------------------------------------
//  L'équipement : armures, écu, arcs, chevaux
// ---------------------------------------------------------------------
// Toujours aux mêmes endroits, pour qu'on apprenne où courir : une lueur, un point sur la
// minicarte, une annonce. Le serveur tranche qui les prend (premier arrivé, un seul objet
// de chaque type par joueur) ; le reste se joue chez celui qui les porte, comme ses
// cœurs : l'écu pare les coups de face tant qu'on le lève (clic droit maintenu, engine.js),
// l'armure encaisse avant les cœurs et se fend, l'arc donne l'arc et un carquois. La forge
// du bourg renforce armure et écu contre des écus. Une manche neuve rend tout à sa place.
// Deux armures, deux arcs, deux chevaux (Eugène, 27 septembre) : chaque objet a son
// identifiant ; son type dit ce qu'il fait.
const PLAN_OBJETS = [
  { id: 'armure-1', type: 'armure', lieu: (L) => L.filter((l) => l.id.startsWith('caserne'))[0], nom: 'aux casernes' },
  { id: 'armure-2', type: 'armure', lieu: (L) => L.filter((l) => l.id.startsWith('caserne'))[1] || L.find((l) => l.id === 'donjon'), nom: 'aux casernes' },
  { id: 'bouclier', type: 'bouclier', lieu: (L) => L.find((l) => l.id === 'place'), nom: 'sur la place d’Armes' },
  { id: 'arc-1', type: 'arc', lieu: (L) => L.find((l) => l.id === 'poterne'), nom: 'à la poterne' },
  { id: 'arc-2', type: 'arc', lieu: (L) => L.find((l) => l.id === 'chapelle'), nom: 'à la chapelle Saint-Roch' },
  { id: 'cheval-beige', type: 'cheval', lieu: (L) => L.find((l) => l.id === 'moulin'), nom: 'à l’écurie du moulin' },
  { id: 'cheval-blanc', type: 'cheval', lieu: (L) => L.find((l) => l.id === 'mage'), nom: 'à l’écurie du vieux mage' },
];
// le lieu d'un objet, pour les messages (« prend l'arc à la poterne ») : celui de l'arène
const LIEU_OBJET = new Proxy({}, { get: (_, id) => (planObjets().find((p) => p.id === id) || PLAN_OBJETS.find((p) => p.id === id) || {}).nom });
// seulement ceux qui tombent dans l'aire de départ de l'arène : depuis que la partie se joue
// dans la citadelle (Eugène, 5 octobre), les chevaux du moulin et du mage et l'arc de la
// chapelle sont dehors — on brûlerait en allant les chercher
// Une arène peut déclarer les siens (`objets` : { id, type, x, z, nom }) : au Batut, l'arc dans
// la bibliothèque, l'armure dans la chambre ; sans quoi, ceux de Lille.
const planObjets = () => (arene && arene.objets
  ? arene.objets.map((o) => ({ id: o.id, type: o.type, nom: o.nom, y: o.y, lieu: () => ({ x: o.x, z: o.z }) }))
  : PLAN_OBJETS.filter((p) => { const l = p.lieu(lieux); return l && !horsAire(l.x, l.z, premiereAire()); }));
const NOM_TYPE = { armure: 'l’armure', bouclier: 'l’écu', arc: 'l’arc', cheval: 'le cheval' };
const COULEUR_TYPE = { armure: '#c9ccd2', bouclier: '#d0463a', arc: '#7fbf5a', cheval: '#b07a3e' };
const ARMURE_PTS = [0, 8, 10, 12];          // demi-cœurs encaissés : cuir clouté (4 cœurs), mailles, plates
const ARMURE_NOM = ['', 'cuir clouté', 'mailles', 'plates'];
const ECU_ANGLE = [0, 1.05, 1.45];           // demi-angle de parade : bois peint, cerclé de fer
let objets = [], objetsProposes = false, demandeObjet = 0, avisParade = 0;
let armure = 0, armurePts = 0, ecu = 0;       // ce que je porte (niveaux), et ce qu'il reste à l'armure
let arcPris = false;                          // l'arc vient d'un présentoir : il repart avec la manche
const presentoirs = new Map();                // id -> le râtelier posé à son lieu
const mien = (type) => objets.find((o) => o.type === type && moi && o.porteur === moi.id);

// Où poser les objets : près du centre d'un lieu nommé, sur un sol praticable. Le premier
// client qui connaît la carte les propose ; le serveur garde ce premier choix pour tous
// (et complète ceux qui manquent, d'un client plus récent).
function proposerObjets() {
  // pas avant d'être entré au salon : au Batut (2,5 s de chargement), la partie tournait avant la
  // réponse du serveur, l'envoi se perdait, et `objetsProposes` interdisait de recommencer
  if (objetsProposes || !moi || !ws || ws.readyState !== 1) return;
  if ((!lieux.length && !(arene && arene.objets)) || !state.running) return;   // le Batut n'a pas de lieux nommés
  const liste = [];
  for (const pl of planObjets()) {
    const l = pl.lieu(lieux);
    if (objets.some((o) => o.id === pl.id)) continue;
    const p = pl.type === 'cheval' ? placeEcurie(l) : praticable(l.x, l.z);
    // `y` : l'étage, quand l'arène le donne (au Batut, sous un plancher, getH rendait l'étage)
    if (p) liste.push({ id: pl.id, type: pl.type, p: [+p.x.toFixed(2), +p.z.toFixed(2)], y: +(pl.y ?? getH(p.x, p.z)).toFixed(2) });
  }
  objetsProposes = true;
  if (liste.length) envoyer({ t: 'objets-lieux', objets: liste });
}

// L'écurie ne tient pas dans un point libre : il lui faut un rectangle de 6 × 5 m hors
// des murs et de l'eau. On en cherche un sur des cercles de 14 à 26 m autour du lieu
// (au centre du moulin, elle mordait dans sa tour).
function placeEcurie(l) {
  const libre = (x, z) => eau(x, z) > 2 && !(world.bounds && world.bounds(x, z)) && !blocked(x, z, 0.6, false, (world.levelH ? world.levelH(x, z) : 0));
  for (let r = 14; r <= 26; r += 3) for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, x = l.x + Math.cos(a) * r, z = l.z + Math.sin(a) * r;
    let ok = true;
    for (let dx = -3; dx <= 3 && ok; dx += 1.5) for (let dz = -2.5; dz <= 2.5 && ok; dz += 1.25) ok = libre(x + dx, z + dz);
    if (ok) return { x, z };
  }
  return praticable(l.x, l.z);
}

function presentoir(type) {
  const g = new THREE.Group();
  const bois = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x6b4a2a });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.14, 12), bois));
  const mat_ = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), bois); mat_.position.y = 0.8; g.add(mat_);
  // les mêmes pièces que celles que portera Camille (pnj.js), à la taille d'un mannequin
  if (type === 'armure') { const c = PNJ.faireCuirasse(1); c.scale.setScalar(1.45); c.position.y = 1.3; g.add(c); }
  else if (type === 'arc') { const a = makeBow(); a.scale.setScalar(0.9); a.position.set(0, 1.25, 0.1); g.add(a); }
  else { const e = PNJ.faireEcu(); e.scale.setScalar(1.9); e.position.set(0, 1.12, 0.08); e.rotation.x = -0.12; g.add(e); }
  const lueur = new THREE.PointLight(0xffd070, 3, 7); lueur.position.y = 1.9; g.add(lueur); sourceLumiere(lueur);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar((G.echelle || 1) / 0.6);     // à l'échelle de Camille (1,80 m dehors)
  g.userData.dynamic = true;
  return g;
}

function majObjets(m) {
  objets = m.objets || [];
  const moiId = moi && moi.id;
  // ce que je portais et que le serveur ne me donne plus (manche neuve, reprise) : rendu
  if (armure && !mien('armure')) { armure = 0; armurePts = 0; }
  if (ecu && !mien('bouclier')) ecu = 0;
  if (arcPris && !mien('arc')) { arcPris = false; state.bow = false; G.bowOut = false; }
  majChevaux();
  for (const o of objets) {
    if (o.type === 'cheval') continue;              // le cheval a son écurie, pas de présentoir
    let pr = presentoirs.get(o.id);
    if (!pr) { pr = presentoir(o.type); pr.position.set(o.p[0], o.y, o.p[1]); scene.add(pr); presentoirs.set(o.id, pr); }
    pr.visible = o.porteur == null && !o.retour && !o.brise && !(o.type === 'arc' && enEquipes());
  }
  marquesObjets = objets.filter((o) => o.porteur == null && !o.retour && !o.brise && !(o.type === 'arc' && enEquipes()))
    .map((o) => ({ x: o.p[0], z: o.p[1], fond: COULEUR_TYPE[o.type], bord: '#1a1a1a' }));
  majMarques();
  const qui = m.par === moiId ? null : (m.perso || 'Quelqu’un');
  if (m.o === 'cheval') { annonceCheval(m, qui); peindreArmure(); return; }
  if (m.evt === 'pris') {
    if (m.par === moiId) {
      if (m.o === 'armure') { armure = 1; armurePts = ARMURE_PTS[1]; showMessage(`Tu endosses l’armure de cuir clouté : elle encaisse ${ARMURE_PTS[1] / 2} cœurs avant les tiens. ${areneA('forge') ? ' La forge du bourg la renforce.' : ''}`, 6); }
      else if (m.o === 'arc') { if (!state.bow) { state.bow = true; arcPris = true; } state.fleches = Math.max(state.fleches ?? 0, 20); showMessage('Tu prends un arc et vingt flèches : C pour le sortir, clic gauche pour tirer.', 6); }
      else { ecu = 1; showMessage('Tu prends l’écu ! Clic droit maintenu pour le lever : il pare les coups de face.' + (areneA('forge') ? ' La forge du bourg le cercle de fer.' : ''), 6); }
      try { SFX.pickup(); } catch (e) {}
    } else showMessage(`${qui} prend ${NOM_TYPE[m.o]} ${LIEU_OBJET[m.id] || ''}.`, 3);
  } else if (m.evt === 'casse' && m.par !== moiId) showMessage(`L’armure de ${qui} vole en éclats.`, 4);
  else if (m.evt === 'raz' && objets.length) {
    // ce que l'arène garde (planObjets), un type par ligne : « l'armure aux casernes, l'écu … »
    const vus = new Set(), dits = planObjets().filter((p) => !(enEquipes() && p.type === 'arc') && !vus.has(p.type) && vus.add(p.type)).map((p) => `${NOM_TYPE[p.type]} ${p.nom}`);
    showMessage(`Nouvelle manche : ${dits.join(', ')}.`, 6);
  }
  peindreArmure();
}

function tickObjets(now) {
  if (planObjets().some((pl) => !objets.some((o) => o.id === pl.id))) proposerObjets();
  tickChevaux(now);
  G.armure = armure; G.bouclier = ecu;          // le moteur : la garde et l'aide des touches
  for (const [id, pr] of presentoirs) {
    if (!pr.visible) continue;
    pr.rotation.y += 0.01;
    const o = objets.find((x) => x.id === id);
    if (!o || elimine || now - demandeObjet < 800) continue;
    if ((o.type === 'armure' && armure) || (o.type === 'bouclier' && ecu) || (o.type === 'arc' && state.bow)) continue;   // déjà équipée
    if (Math.hypot(player.pos.x - pr.position.x, player.pos.z - pr.position.z) < 2.4) { demandeObjet = now; envoyer({ t: 'objet-prendre', o: id }); }
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

// l'armure prend d'abord ; brisée, elle ne revient qu'à la manche suivante
function absorber(degats) {
  if (!armure || armurePts <= 0) return degats;
  const pris = Math.min(armurePts, degats);
  armurePts -= pris;
  const p = player;
  burst(p.pos.x, p.pos.y + 1.3, p.pos.z, 0xc9ccd2, 8, 4, 0.4);
  if (armurePts <= 0) {
    const o = mien('armure');
    armure = 0; if (o) envoyer({ t: 'objet-casse', o: o.id });
    showMessage('Ton armure vole en éclats ! Il n’y en aura plus à son râtelier avant la prochaine manche.', 4);
    try { SFX.stomp(); } catch (e) {}
  }
  peindreArmure();
  return degats - pris;
}

// La jauge d'armure : des cœurs d'acier au bout des cœurs rouges, du même dessin (Eugène
// voulait y lire des cœurs, pas des plaques). Un cœur d'acier = deux demi-cœurs encaissés.
let jaugeArmure = null, jaugeCheval = null;
function coeur(g, x, y, s, couleur) {        // le cœur d'engine.js (drawHearts), trait pour trait
  g.fillStyle = couleur; g.beginPath();
  g.moveTo(x + s / 2, y + s * 0.95);
  g.bezierCurveTo(x - s * 0.15, y + s * 0.5, x + s * 0.05, y - s * 0.05, x + s / 2, y + s * 0.3);
  g.bezierCurveTo(x + s * 0.95, y - s * 0.05, x + s * 1.15, y + s * 0.5, x + s / 2, y + s * 0.95);
  g.fill();
}
function peindreArmure() {
  if (!actif) return;
  if (!jaugeArmure) {
    jaugeArmure = document.createElement('canvas');
    jaugeArmure.width = 240; jaugeArmure.height = 40;
    jaugeArmure.style.cssText = 'position:absolute; top:14px; pointer-events:none;';
    (document.getElementById('hud') || document.body).appendChild(jaugeArmure);
  }
  jaugeArmure.style.left = `${18 + (player.maxHp / 2) * 34 + 4}px`;
  jaugeArmure.style.display = armure ? '' : 'none';
  peindreJaugeCheval();
  if (!armure) return;
  const g = jaugeArmure.getContext('2d'), n = ARMURE_PTS[armure] / 2;
  g.clearRect(0, 0, 240, 40);
  const acier = g.createLinearGradient(0, 6, 0, 32);           // un reflet d'acier poli
  acier.addColorStop(0, '#f2f4f7'); acier.addColorStop(0.5, '#aab0b8'); acier.addColorStop(1, '#6d737c');
  for (let i = 0; i < n; i++) {
    const x = 6 + i * 34, y = 6, plein = armurePts >= (i + 1) * 2, demi = !plein && armurePts >= i * 2 + 1;
    coeur(g, x - 1.5, y - 1.5, 29, '#15181d');                  // le liseré sombre
    coeur(g, x, y, 26, '#2c3038');
    if (plein) coeur(g, x, y, 26, acier);
    else if (demi) { g.save(); g.beginPath(); g.rect(x, y - 2, 13, 34); g.clip(); coeur(g, x, y, 26, acier); g.restore(); }
  }
}

// ---------------------------------------------------------------------
//  Les chevaux
// ---------------------------------------------------------------------
// Deux chevaux par partie, chacun dans son écurie : le beige au moulin d'Émile, le blanc
// près de la chaumière du vieux mage, à l'autre bout de la carte. On en monte un (Entrée),
// il galope 1,7 fois plus vite ; on en descend (Entrée) et il reste où on l'a laissé,
// pour qui le prendra. Il a sa propre vie, prise avant l'armure et les cœurs du cavalier,
// et elle remonte quand il broute (à l'arrêt). Mort, un cheval frais revient à son écurie
// (le serveur, après 45 s). Les modèles (Quaternius, CC0 ; animaux/glb.py) ne se chargent
// qu'en instance, à l'arrivée des chevaux : le solo ne les paie pas.
// SELLE : de combien la pose assise (bassin à hauteur de chaise) monte pour tomber sur le dos
// du cheval. Le modèle regarde vers +z, comme le joueur. SELLE_AV : de combien le cheval
// est avancé sous Camille pour qu'elle tombe au creux du dos (réglé au banc, de profil :
// à 0, elle était déjà un peu sur la croupe).
const CHEVAL_PV = 10, CHEVAL_VITESSE = 1.7, SELLE = 0.62, SELLE_AV = -0.1;
const ROBE = { 'cheval-blanc': 'cheval_blanc.glb' };      // les autres : cheval.glb, la robe beige
const chevaux = new Map();                                  // id -> { vis, ecurie }
let monte = null, chevalPv = CHEVAL_PV;                     // l'id du cheval que je monte
let vitessePied = 0, arretT = 0, brouteT = 0, posePied = null;
const modeles = new Map();                                  // fichier -> promesse du modèle

function chargerCheval(fichier) {
  if (!modeles.has(fichier)) modeles.set(fichier, Promise.all([import('./lib/addons/loaders/GLTFLoader.js'), import('./lib/addons/utils/SkeletonUtils.js'), import('./lib/addons/utils/BufferGeometryUtils.js')])
    // ?v : les .glb restent un jour en cache (nginx) ; le 30 septembre ils ont gagné Gallop_Jump
    .then(([L, S, U]) => new L.GLTFLoader().loadAsync('assets_back/02_personnages/animaux/' + fichier + '?v=2').then((g) => {
      // LISSER LES FACETTES. Le modèle (Quaternius) est ombré à plat, une normale par face :
      // à côté des murs photographiés, il faisait jouet. On soude les sommets que les faces
      // partagent et on recalcule des normales lissées — la silhouette ne bouge pas, c'est
      // la lumière qui glisse sur la robe au lieu de casser à chaque arête.
      g.scene.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        let ge = o.geometry.clone(); ge.deleteAttribute('normal');
        ge = U.mergeVertices(ge, 1e-4); ge.computeVertexNormals(); o.geometry = ge;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m.flatShading = false; m.roughness = 0.82; m.metalness = 0; m.needsUpdate = true; }
      });
      // la hauteur vraie : celle du maillage DÉFORMÉ par les os (la boîte brute donne 4,8 m)
      g.scene.updateMatrixWorld(true);
      const b = new THREE.Box3(); g.scene.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); b.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
      return { g, S, echelle: 2.35 / (b.max.y - b.min.y) };
    })));
  return modeles.get(fichier);
}
function faireCheval(modele) {
  const c = modele.S.clone(modele.g.scene);
  c.scale.setScalar(modele.echelle);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const mix = new THREE.AnimationMixer(c), actions = {};
  for (const clip of modele.g.animations) actions[clip.name] = mix.clipAction(clip);
  const g = new THREE.Group(); g.add(c); g.userData.dynamic = true; scene.add(g);
  const ch = { g, mix, actions, courant: null,
    jouer(n, fondu = 0.25, boucle = true) {
      const a = actions[n]; if (!a || a === this.courant) return;
      a.reset(); a.setLoop(boucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !boucle;
      if (this.courant) a.crossFadeFrom(this.courant, fondu, false); else a.fadeIn(fondu);
      a.play(); this.courant = a;
    } };
  ch.jouer('Idle');
  return ch;
}
// L'écurie : un appentis comme les granges de la campagne — poteaux et sablières de chêne
// patiné, toit de chaume à deux pans (celui de la chaumière du mage), fond et joue de
// planches, litière de paille, râtelier et auge. Les matières sont celles des maisons de
// campagne.js (Poly Haven, déjà chargées) : les couleurs unies faisaient jouet.
function batirEcurie(o) {
  const g = new THREE.Group();
  const bois = phMat('wood_cabinet_worn_long', 2.0, 2.0, { color: 0x5b4330 });
  const planche = phMat('wood_planks', 2.0, 2.0, { color: 0x8a6a48 });
  const chaume = phMat('withered_grass', 2.4, 2.4, { color: 0xac9660, roughness: 1 });
  const paille = phMat('withered_grass', 1.2, 1.2, { color: 0xd8bd72, roughness: 1 });
  const boite = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const L = 5.2, P = 4.0, H = 2.6;
  for (const [x, z] of [[-L / 2, -P / 2], [L / 2, -P / 2], [-L / 2, P / 2], [L / 2, P / 2], [0, -P / 2]]) boite(0.24, H, 0.24, bois, x, H / 2, z);
  for (const z of [-P / 2, P / 2]) boite(L + 0.4, 0.22, 0.26, bois, 0, H, z);          // les sablières
  for (const x of [-L / 2, 0, L / 2]) boite(0.2, 0.2, P + 0.3, bois, x, H + 0.05, 0);    // les entraits
  // le chaume, deux pans épais qui débordent, et le faîtage arrondi
  for (const sz of [-1, 1]) {
    const pan = boite(L + 1.2, 0.38, P / 2 + 1.0, chaume, 0, H + 0.75, sz * (P / 4 + 0.35));
    pan.rotation.x = sz * 0.52;
  }
  const faite = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, L + 1.2, 10), chaume);
  faite.rotation.z = Math.PI / 2; faite.position.set(0, H + 1.33, 0); g.add(faite);
  boite(L, 1.9, 0.1, planche, 0, 0.95, -P / 2 + 0.06);                                   // le fond de planches
  boite(0.1, 1.5, P, planche, -L / 2 + 0.06, 0.75, 0);                                    // une joue, côté vent
  boite(L - 0.3, 0.04, P - 0.3, paille, 0, 0.03, 0);                                      // la litière
  // le râtelier : des barreaux en biais sur le fond, le foin dedans
  const rat = new THREE.Group(); rat.position.set(-0.8, 1.45, -P / 2 + 0.3); rat.rotation.x = -0.35; g.add(rat);
  for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), bois); b.position.set(-0.9 + k * 0.225, 0, 0); rat.add(b); }
  for (const y of [-0.35, 0.35]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.07), bois); b.position.y = y; rat.add(b); }
  const foin = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), paille); foin.scale.set(1.6, 0.6, 0.55); foin.position.set(0, 0.15, -0.12); rat.add(foin);
  // l'auge : un bac de planches sur deux tréteaux
  boite(1.5, 0.3, 0.5, planche, 1.4, 0.55, -P / 2 + 0.45);
  for (const x of [0.8, 2.0]) boite(0.08, 0.4, 0.45, bois, x, 0.2, -P / 2 + 0.45);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.position.set(o.maison.p[0], o.maison.y, o.maison.p[1]);     // ouverte vers +z : le cheval y attend tête dehors
  g.userData.dynamic = true; scene.add(g);
  return g;
}

function majChevaux() {
  const moiId = moi && moi.id, etaitMonte = monte;
  const o = objets.find((x) => x.type === 'cheval' && moiId != null && x.porteur === moiId);
  monte = o ? o.id : null;
  if (monte && monte !== etaitMonte) {                 // en selle : vitesse, vie, et Camille se pose dans son axe
    chevalPv = o.pv || CHEVAL_PV; vitessePied = vitessePied || player.speed; player.speed = vitessePied * CHEVAL_VITESSE;
    const y = o.yaw || 0;
    player.pos.set(o.p[0] - Math.sin(y) * SELLE_AV, player.pos.y, o.p[1] - Math.cos(y) * SELLE_AV);
    player.yaw = G.camYaw = y;
  }
  if (!monte && etaitMonte) player.speed = vitessePied || player.speed;
  G.monte = !!monte; G.selle = SELLE;
  for (const c of objets.filter((x) => x.type === 'cheval')) {
    chargerCheval(ROBE[c.id] || 'cheval.glb').then((modele) => {
      let ch = chevaux.get(c.id);
      if (!ch) { ch = { vis: faireCheval(modele), ecurie: null }; chevaux.set(c.id, ch); }
      if (!ch.ecurie && c.maison) ch.ecurie = batirEcurie(c);
      const cur = objets.find((x) => x.id === c.id) || c;
      if (cur.porteur == null && !cur.retour) { ch.vis.g.position.set(cur.p[0], cur.y, cur.p[1]); ch.vis.g.rotation.y = cur.yaw || 0; }
    });
  }
  peindreArmure();
}
function annonceCheval(m, qui) {
  const moiId = moi && moi.id, ou = LIEU_OBJET[m.id] || 'à son écurie';
  if (m.evt === 'pris') showMessage(m.par === moiId ? 'En selle ! Il galope bien plus vite que toi ; arrêté, il broute et reprend des forces. Entrée pour descendre.' : `${qui} monte le cheval ${m.id === 'cheval-blanc' ? 'blanc' : 'beige'}.`, m.par === moiId ? 6 : 3);
  else if (m.evt === 'casse') showMessage(m.par === moiId ? `Ton cheval s’effondre ! Un cheval frais attendra ${ou}.` : `Le cheval de ${qui} s’effondre.`, 4);
  else if (m.evt === 'retour') showMessage(`Un cheval frais attend ${ou}.`, 4);
}
function descendre() {
  if (!monte) return;
  const p = player, dx = Math.cos(p.yaw), dz = -Math.sin(p.yaw);     // on met pied à terre sur la gauche
  const cx = p.pos.x + Math.sin(p.yaw) * SELLE_AV, cz = p.pos.z + Math.cos(p.yaw) * SELLE_AV;     // là où est le cheval
  envoyer({ t: 'objet-poser', o: monte, p: [+cx.toFixed(2), +cz.toFixed(2)], y: +p.pos.y.toFixed(2), pv: chevalPv, yaw: +p.yaw.toFixed(2) });
  // On mettait pied à terre 1,4 m à gauche SANS regarder : contre un parapet, une caisse, le
  // bord d'un terre-plein, Camille restait perchée au-dessus du sol (Eugène, 30 septembre, sur
  // un bastion). On descend du côté libre — gauche, droite, sinon en arrière — par petits pas
  // qui respectent les collisions et les marches, puis on se pose sur le vrai sol.
  const y0 = p.pos.y;
  for (const [ex, ez] of [[dx, dz], [-dx, -dz], [-Math.sin(p.yaw), -Math.cos(p.yaw)]]) {
    const q = { x: p.pos.x, y: y0, z: p.pos.z };
    let ok = true;
    for (let k = 0; k < 7 && ok; k++) { ok = tryMove(q, ex * 0.2, ez * 0.2, 0.4, false); q.y = getH(q.x, q.z, q.y + 0.5); }
    if (ok && Math.abs(q.y - y0) < 0.6) { p.pos.x = q.x; p.pos.z = q.z; break; }
  }
  p.pos.y = getH(p.pos.x, p.pos.z, y0 + 0.5); p.vy = 0;
}
// le cheval prend les coups avant son cavalier
function blesserCheval(degats) {
  if (!monte || chevalPv <= 0) return degats;
  const pris = Math.min(chevalPv, degats), ch = chevaux.get(monte);
  chevalPv -= pris;
  if (ch) { try { ch.vis.jouer('Idle_HitReact1', 0.08, false); } catch (e) {} }
  if (chevalPv <= 0) {
    envoyer({ t: 'objet-casse', o: monte });
    if (ch) { ch.vis.jouer('Death', 0.1, false); ch.vis.mortT = performance.now(); }
    player.speed = vitessePied || player.speed; monte = null; G.monte = false;
  }
  peindreArmure();
  return degats - pris;
}
function tickChevaux(now) {
  for (const [id, ch] of chevaux) {
    const v = ch.vis, o = objets.find((x) => x.id === id);
    // le vrai temps écoulé : compté en images, le broutage s'étirait quand l'image ralentit
    const dt = Math.min(0.1, (now - (v.t || now)) / 1000);
    v.mix.update(dt); v.t = now;
    if (v.mortT && now - v.mortT < 1800) continue;           // on le laisse tomber avant de le cacher
    v.mortT = 0;
    v.g.visible = !!o && !o.retour && G.level && G.level.name === 'citadel';
    if (!o || o.retour) continue;
    let qui = null, vitesse = 0;
    const moiLe = monte === id;
    if (moiLe) {
      qui = { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw };
      const avant = posePied || qui; vitesse = Math.hypot(qui.x - avant.x, qui.z - avant.z) / Math.max(dt, 1e-3); posePied = qui;
    } else if (o.porteur != null) {
      const a = autres.get(o.porteur);
      if (a) { qui = { x: a.mesh.position.x, y: a.mesh.position.y, z: a.mesh.position.z, yaw: a.yaw }; vitesse = a.marche * 12; }
    }
    if (qui) { v.g.position.set(qui.x + Math.sin(qui.yaw) * SELLE_AV, qui.y, qui.z + Math.cos(qui.yaw) * SELLE_AV); v.g.rotation.y = qui.yaw; }
    // les allures : galop, pas, et à l'arrêt il broute — et reprend des forces
    // en l'air, il saute pour de bon (Gallop_Jump, gardé dans cheval.glb depuis le 30 septembre) :
    // le mien le sait par onGround, celui d'un autre par sa hauteur au-dessus du sol
    const enLair = qui && (moiLe ? !player.onGround : qui.y - getH(qui.x, qui.z, qui.y + 0.5) > 0.35);
    if (enLair) {
      // le clip dure 1,47 s, un saut 0,75 s en l'air : accéléré, la détente tombe sur la réception
      if (v.actions.Gallop_Jump) v.actions.Gallop_Jump.timeScale = 1.9;
      v.jouer('Gallop_Jump', 0.1, false);
    }
    else if (vitesse > 9) v.jouer('Gallop', 0.2);
    else if (vitesse > 0.8) v.jouer('Walk', 0.25);
    else if (moiLe) {
      arretT += dt;
      if (arretT > 1.2) {
        v.jouer('Eating', 0.4);
        if (chevalPv < CHEVAL_PV && (brouteT += dt) > 2.5) { brouteT = 0; chevalPv++; peindreArmure(); }
      } else v.jouer('Idle', 0.3);
    } else if (o.porteur == null) v.jouer(Math.floor(now / 9000 + id.length) % 2 ? 'Eating' : 'Idle', 0.6);
    else v.jouer('Idle', 0.3);
    if (moiLe && vitesse > 0.8) arretT = 0;
  }
}
function poserInteractionsCheval() {
  if (!actif || poserInteractionsCheval.fait) return;
  poserInteractionsCheval.fait = true;
  // une seule invite pour tous les chevaux : celui qu'on a devant soi, à 3,2 m au plus
  const pos = new THREE.Vector3(); let vise = null;
  addInteract({ pos, r: 3.2, prompt: () => 'monter à cheval', fn: () => { if (vise && !monte) envoyer({ t: 'objet-prendre', o: vise }); },
    enabled: () => {
      if (monte || elimine) return false;
      let mieux = 3.2; vise = null;
      for (const [id, ch] of chevaux) {
        const o = objets.find((x) => x.id === id);
        if (!o || o.porteur != null || o.retour) continue;
        const d = Math.hypot(ch.vis.g.position.x - player.pos.x, ch.vis.g.position.z - player.pos.z);
        if (d < mieux) { mieux = d; vise = id; pos.copy(ch.vis.g.position); }
      }
      return !!vise;
    } });
  addInteract({ pos: player.pos, r: 1.5, prompt: () => 'descendre de cheval', fn: descendre, enabled: () => !!monte });
}

// la vie du cheval, sous les cœurs : de petits cœurs fauves, tant qu'on est en selle
function peindreJaugeCheval() {
  if (!jaugeCheval) {
    jaugeCheval = document.createElement('canvas'); jaugeCheval.width = 260; jaugeCheval.height = 26;
    jaugeCheval.style.cssText = 'position:absolute; top:22px; pointer-events:none;';
    (document.getElementById('hud') || document.body).appendChild(jaugeCheval);
  }
  // sur la ligne des cœurs, après ceux de l'armure : dessous, il y a les compteurs du HUD
  jaugeCheval.style.left = `${18 + (player.maxHp / 2) * 34 + 8 + (armure ? (ARMURE_PTS[armure] / 2) * 34 + 6 : 0)}px`;
  jaugeCheval.style.display = monte ? '' : 'none';
  if (!monte) return;
  const g = jaugeCheval.getContext('2d'); g.clearRect(0, 0, 260, 26);
  g.font = 'bold 11px sans-serif'; g.fillStyle = '#f3e3c3'; g.textBaseline = 'middle'; g.fillText('CHEVAL', 6, 13);
  for (let i = 0; i < CHEVAL_PV / 2; i++) {
    const x = 62 + i * 22, plein = chevalPv >= (i + 1) * 2, demi = !plein && chevalPv >= i * 2 + 1;
    coeur(g, x - 1, 2, 20, '#1d130a'); coeur(g, x, 3, 18, '#3b2a1a');
    if (plein) coeur(g, x, 3, 18, '#c98a45');
    else if (demi) { g.save(); g.beginPath(); g.rect(x, 1, 9, 24); g.clip(); coeur(g, x, 3, 18, '#c98a45'); g.restore(); }
  }
}

// La forge du bourg : on y renforce ce qu'on porte, contre des écus. Y aller est un risque
// — c'est loin des casernes et de la place, et on s'y arrête.
function poserForge() {
  // `forge: true` : celle du bourg de Lille (carte.js) ; une autre arène donnerait { x, z }
  if (!actif || poserForge.fait || !arene) return;
  const f = arene.forge;
  if (!f) { poserForge.fait = true; return; }
  if (f === true && (!TOWN || TOWN.y === undefined)) return;
  poserForge.fait = true;
  const [x, z] = f === true ? townWorld(4.4, 14) : [f.x, f.z], y = f === true ? TOWN.y : (f.y ?? getH(x, z));
  if (horsAire(x, z, premiereAire())) return;        // le bourg est hors de l'arène (5 octobre)
  addInteract({ pos: new THREE.Vector3(x, y, z), r: 3.2, prompt: () => 'la forge : renforcer ton équipement', fn: () => {
    const peu = (n) => `il faut d’abord ${n}`;
    BOURSE.boutique('La forge', 'À l’enclume', 'Le forgeron renforce ce que tu portes. Ce qui est brisé ne se répare pas : il faut en reprendre.', [
      { label: 'Armure de mailles (5 cœurs à encaisser)', prix: 40, dispo: () => armure === 1, indispo: armure ? 'déjà renforcée' : peu('l’armure des casernes'),
        acheter: () => { armure = 2; armurePts = ARMURE_PTS[2]; peindreArmure(); showMessage('Mailles neuves : 5 cœurs d’armure.', 3); } },
      { label: 'Armure de plates (6 cœurs à encaisser)', prix: 70, dispo: () => armure === 2, indispo: armure === 3 ? 'déjà en plates' : peu('les mailles'),
        acheter: () => { armure = 3; armurePts = ARMURE_PTS[3]; peindreArmure(); showMessage('Plates d’acier : 6 cœurs d’armure.', 3); } },
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
  degats = blesserCheval(degats);
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
  const ici = pointDansAire(apparition);             // jamais hors de l'aire : on y mourrait en boucle
  if (ici) {
    const a = Math.random() * TAU, r = 1 + Math.random() * 3;
    p.pos.set(ici.x + Math.cos(a) * r, ici.y, ici.z + Math.sin(a) * r);
    p.pos.y = getH(p.pos.x, p.pos.z) + 0.1;
    orienterArrivee();
  }
  p.vy = 0; p.kb.set(0, 0, 0); p.hp = p.maxHp; p.invuln = 3; p.attackT = -1; p.rollT = -1;
  equiperEquipe(false);
  // match à mort : une seule vie par manche — on regarde la fin, à l'abri, sans frapper
  const reste = viesDe(moi && moi.id);
  if (regle === 'survie' && manche && manche.etat === 'cours' && reste !== null && reste > 1) {
    showMessage(`${pseudo ? pseudo + ' t’a mise à terre. ' : ''}Plus que ${reste - 1} vie${reste - 1 > 1 ? 's' : ''}.`, 4);
    return;
  }
  if (regle === 'survie' && manche && manche.etat === 'cours') {
    elimine = true; p.invuln = 1e9;
    showMessage((pseudo ? `${pseudo} t’a éliminée.` : 'Éliminée !') + ' Tu suis ceux qui restent — clic : le suivant.', 5);
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
    const portee = monte ? EPEE_SELLE.portee : PORTEE_EPEE, arc = monte ? EPEE_SELLE.arc : 1.25;   // en selle : plus loin, plus large
    if (d > portee + 0.6 || Math.abs(a.mesh.position.y - p.pos.y) > 3) continue;
    const da = ((Math.atan2(dx, dz) - p.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    if (Math.abs(da) > arc && d > 1.2) continue;
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
  if (apparition) return { x: apparition.x, z: apparition.z };
  return pointDeDepart();
}
// sans ralliement ni point d'arrivée choisi : la place d'Armes (ou là où l'on est)
function pointDeDepart() {
  const pl = lieux.find((l) => l.id === 'place');
  return pl ? { x: pl.x, z: pl.z } : (G.level ? { x: player.pos.x, z: player.pos.z } : null);
}
function placerBot(b) {
  const base = pointDansAire(baseDe(b));             // jamais hors de l'aire en vigueur
  if (!base) return false;
  let p = null;
  for (let k = 0; k < 12 && !p; k++) {
    const an = Math.random() * TAU, r = 5 + Math.random() * (12 + k * 3);
    p = praticable(base.x + Math.cos(an) * r, base.z + Math.sin(an) * r);
    if (p && !relieAuJeu(p.x, p.z)) p = null;
  }
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
    // pas dans l'eau — sauf sur un ouvrage qui la franchit (pont, tablier, bastion : la règle
    // du moteur, surOuvrage). Sans cette exception, les bots s'arrêtaient au bout de chaque
    // pont (au banc du 29 septembre, tous plantés devant le pont de la Porte Royale).
    const ax = b.pos.x + dx * 4, az = b.pos.z + dz * 4;
    // (à la hauteur qu'il aura LÀ-BAS : la rampe d'un pont monte, et jugé à la hauteur de ses
    // pieds le tablier lui paraissait trop haut pour être le sien)
    if (eau(ax, az) < 1.2 && !ouvrage(ax, az, getH(ax, az, b.pos.y + 0.5))) continue;
    if (tryMove(b.pos, dx, dz, 0.45, false)) {
      b.pos.y = getH(b.pos.x, b.pos.z, b.pos.y + 0.5);
      b.yaw = lerpAngle(b.yaw, an, Math.min(1, dt * 10));
      return true;
    }
  }
  return false;
}

// LE GRAPHE d'une arène à pièces et à étages (`graphe` : { n: [[x, z, y], …], a: [[i, j], …] }) :
// des points (les pièces, les seuils des portes, les escaliers marche à marche) reliés quand on
// passe à pied de l'un à l'autre. Le bot part du point qu'il voit, va au point qui voit sa cible,
// par le plus court chemin ; arrivé, il reprend la poursuite ordinaire. Le chemin se refait
// toutes les 2 s (la cible bouge) ; coincé 3 s sur un point, il le saute.
const ligneLibre = (ax, az, bx, bz, y) => {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.5));
  for (let k = 1; k < n; k++) { const t = k / n; if (blocked(ax + (bx - ax) * t, az + (bz - az) * t, 0.45, false, y + 0.1)) return false; }
  return true;
};
// le point du graphe le plus proche qu'on voit d'ici, à cet étage (les plus proches d'abord)
function noeudVu(Gr, x, z, y) {
  const l = Gr.n.map((q, i) => [i, Math.hypot(q[0] - x, q[1] - z), q]).filter(([, d, q]) => Math.abs(q[2] - y) < 1.6 && d < 45).sort((a, b) => a[1] - b[1]);
  for (const [i, , q] of l.slice(0, 12)) if (ligneLibre(x, z, q[0], q[1], Math.min(y, q[2]))) return i;
  return -1;
}
function cheminGraphe(Gr, s, t) {
  if (!Gr.voisins) { Gr.voisins = Gr.n.map(() => []); for (const [i, j] of Gr.a) { const d = Math.hypot(Gr.n[i][0] - Gr.n[j][0], Gr.n[i][1] - Gr.n[j][1], Gr.n[i][2] - Gr.n[j][2]); Gr.voisins[i].push([j, d]); Gr.voisins[j].push([i, d]); } }
  // un tas binaire : le graphe tiré tout seul (grapheAuto) a des milliers de points, et la
  // recherche du plus proche non traité, en n², coûtait des dizaines de ms par bot
  const dist = Gr.n.map(() => Infinity), prec = Gr.n.map(() => -1), fait = Gr.n.map(() => false); dist[s] = 0;
  const tas = [[0, s]];
  const pousser = (e) => { tas.push(e); for (let i = tas.length - 1; i > 0;) { const p = (i - 1) >> 1; if (tas[p][0] <= tas[i][0]) break; [tas[p], tas[i]] = [tas[i], tas[p]]; i = p; } };
  const tirer = () => { const h = tas[0], f = tas.pop(); if (tas.length) { tas[0] = f; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < tas.length && tas[l][0] < tas[m][0]) m = l; if (r < tas.length && tas[r][0] < tas[m][0]) m = r; if (m === i) break; [tas[m], tas[i]] = [tas[i], tas[m]]; i = m; } } return h; };
  while (tas.length) {
    const [, u] = tirer();
    if (fait[u]) continue; if (u === t) break; fait[u] = true;
    for (const [v, d] of Gr.voisins[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prec[v] = u; pousser([dist[v], v]); }
  }
  if (dist[t] === Infinity) return null;
  const ch = []; for (let u = t; u >= 0; u = prec[u]) ch.unshift(u);
  return ch;
}
// LE GRAPHE TIRÉ TOUT SEUL, pour une arène de plain-pied qui n'en déclare pas (la Garde-Guérin,
// le Pouget, Ko Panyi, Gallipoli) : sans lui, un bot qui ne voyait pas sa cible fonçait droit
// sur elle et restait collé au mur d'une ruelle. On part des départs de l'arène et l'on avance
// de case en case (3 m, huit voisines) comme Camille marche : pas de 0,5 m, une marche de
// 0,6 m au plus, rien dans un rayon de 0,5 m (blocked, getH du moteur). Ce qu'on atteint
// devient un point, chaque pas réussi une arête : les toits et les cours closes n'y entrent
// pas. Dans une case, on essaie le centre puis quatre points autour — une ruelle de 2 m entre
// deux centres de case passerait entre les mailles. Quelques ms par image, jamais d'écran figé.
const GA_PAS = 3, GA_ESSAIS = [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]];
// on marche de a vers (x, z) : la hauteur d'arrivée, ou null si l'on bute ou si l'on saute
function marcheVers(ax, az, ay, x, z) {
  const L = Math.hypot(x - ax, z - az), n = Math.max(1, Math.ceil(L / 0.5));
  let y = ay;
  for (let k = 1; k <= n; k++) {
    const t = k / n, px = ax + (x - ax) * t, pz = az + (z - az) * t, yy = getH(px, pz, y + 0.6);
    if (!Number.isFinite(yy) || Math.abs(yy - y) > 0.6 || blocked(px, pz, 0.5, false, yy + 0.1)) return null;
    y = yy;
  }
  return y;
}
function grapheAuto() {
  const A = arene;
  // G.sansGrapheAuto : pour le banc (bancs/multi-graphe.mjs), qui compare avec et sans
  if (!A || A.graphe || aLille() || !G.level || !A.aires.length || G.sansGrapheAuto) return null;
  const G_ = A.grapheAuto || (A.grapheAuto = { fait: false });
  if (G_.fait) return G_;
  if (!document.getElementById('loading')?.classList.contains('hidden')) return null;
  if (!G_.n) {
    const a0 = A.aires[0], R = a0.r + 6, sd = a0.sd || A.sd, [cx, cz] = A.centre;
    // l'aire de départ est un cercle autour du centre (toutes celles de plain-pied) : la boîte
    // en est tirée, puis on borne par sa propre mesure
    G_.x0 = cx - R - 10; G_.z0 = cz - R - 10; G_.nx = Math.ceil((2 * R + 20) / GA_PAS); G_.dans = (x, z) => sd(x, z) <= R;
    G_.n = []; G_.a = []; G_.cell = new Int32Array(G_.nx * G_.nx).fill(-1); G_.file = []; G_.cles = new Set(); G_.t0 = performance.now();
    const graines = [A.centre, ...(A.departsCamps ? Object.values(A.departsCamps) : []), ...(A.objets || []).map((o) => [o.x, o.z])];
    for (const [x, z] of graines) {
      const i = Math.floor((x - G_.x0) / GA_PAS), j = Math.floor((z - G_.z0) / GA_PAS), k = j * G_.nx + i;
      if (i < 0 || j < 0 || i >= G_.nx || j >= G_.nx || G_.cell[k] >= 0) continue;
      const y = getH(x, z);
      if (!Number.isFinite(y) || blocked(x, z, 0.5, false, y + 0.1)) continue;
      G_.cell[k] = G_.n.length; G_.n.push([x, z, y]); G_.file.push(k);
    }
  }
  const t0 = performance.now(), budget = state.running && !state.paused ? NAV_BUDGET_MS : NAV_BUDGET_FIGE_MS, nx = G_.nx;
  while (G_.file.length && performance.now() - t0 < budget) {
    const k = G_.file.shift(), i = k % nx, j = (k - i) / nx, u = G_.cell[k], [ax, az, ay] = G_.n[u];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nx) continue;
      const q = b * nx + a, v = G_.cell[q];
      if (v >= 0) {                          // déjà un point : une arête si l'on y va à pied (une fois par paire)
        if (v > u && !G_.cles.has(u * 65536 + v) && marcheVers(ax, az, ay, G_.n[v][0], G_.n[v][1]) !== null) { G_.a.push([u, v]); G_.cles.add(u * 65536 + v); }
        continue;
      }
      for (const [ox, oz] of GA_ESSAIS) {
        const x = G_.x0 + (a + 0.5) * GA_PAS + ox, z = G_.z0 + (b + 0.5) * GA_PAS + oz;
        if (!G_.dans(x, z) || (world.bounds && world.bounds(x, z))) continue;
        const y = marcheVers(ax, az, ay, x, z);
        if (y === null) continue;
        G_.cell[q] = G_.n.length; G_.n.push([x, z, y]); G_.a.push([u, G_.n.length - 1]); G_.cles.add(u * 65536 + G_.n.length - 1); G_.file.push(q);
        break;
      }
    }
  }
  G_.cpu = (G_.cpu || 0) + performance.now() - t0;
  if (G_.file.length) return null;
  G_.fait = true; G_.cpu = Math.round(G_.cpu); G_.ms = Math.round(performance.now() - G_.t0);
  delete G_.cell; delete G_.file; delete G_.cles;
  return G_;
}
function suivreGraphe(b, c, dt, now) {
  const Gr = arene && (arene.graphe || grapheAuto());
  if (!Gr) return false;
  const cy = c.y ?? b.pos.y, memeEtage = Math.abs(cy - b.pos.y) < 2;
  // même étage, rien entre eux : la poursuite ordinaire (la vue se relit toutes les 0,6 s)
  if (memeEtage) {
    if (!(b.vueT > now)) { b.vueT = now + 600; b.vu = ligneLibre(b.pos.x, b.pos.z, c.x, c.z, b.pos.y); }
    if (b.vu || Math.hypot(c.x - b.pos.x, c.z - b.pos.z) < 3) { b.chemin = null; return false; }
  }
  if (!b.chemin || now > b.chemin.refait) {
    // Le chemin se cherche comme si les portes du lieu étaient ouvertes (G.level.sansPortes, le
    // Batut) : le bot les ouvre en arrivant devant. Derrière des portes fermées, aucun point du graphe
    // ne « voyait » la cible, le chemin manquait, et le bot filait tout droit jusqu'au bassin (7 octobre).
    const chercher = () => [noeudVu(Gr, b.pos.x, b.pos.z, b.pos.y), noeudVu(Gr, c.x, c.z, cy)];
    const [s, t] = G.level && G.level.sansPortes ? G.level.sansPortes(chercher) : chercher();
    // la cible n'a pas changé de point du graphe : on garde le chemin en cours — le refaire depuis
    // le point le plus proche ramenait le bot à l'étape 0, et il oscillait devant une façade
    if (b.chemin && t === b.chemin.t && t >= 0) b.chemin.refait = now + 2000;
    else {
      const ch = s >= 0 && t >= 0 ? cheminGraphe(Gr, s, t) : null;
      if (!ch) { b.chemin = null; return false; }
      b.chemin = { pts: ch.map((i) => Gr.n[i]), k: 0, t, refait: now + 2000, coince: 0, dPrec: Infinity };
    }
  }
  const C = b.chemin;
  let q = C.pts[C.k];
  if (Math.hypot(q[0] - b.pos.x, q[1] - b.pos.z) < 0.8 || C.coince > 3) {
    C.coince = 0; C.dPrec = Infinity;
    if (++C.k >= C.pts.length) { b.chemin = null; return false; }
    q = C.pts[C.k];
  }
  const d = Math.hypot(q[0] - b.pos.x, q[1] - b.pos.z);
  avancer(b, q[0] - b.pos.x, q[1] - b.pos.z, b.P.vitesse, dt);
  if (d > C.dPrec - b.P.vitesse * dt * 0.2) C.coince += dt; else C.coince = Math.max(0, C.coince - dt);
  C.dPrec = Math.min(C.dPrec, d);
  return true;
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

// Les chemins des bots. Entre un bot et son drapeau, il y a les murs de la citadelle : le
// détour de quelques mètres de la poursuite ne suffit pas (au banc, la moitié du camp restait
// collée à une courtine). Une grille de praticabilité (les règles de `praticable`) couvre
// toute la châtellenie, puisque les drapeaux y sont semés ; elle se remplit quelques lignes
// par image — jamais d'écran figé — puis chaque drapeau reçoit un champ de distances
// (parcours en largeur depuis son cercle) : un bot n'a plus qu'à descendre la pente.
// Pas de 2 m (1,5 m quand elle ne couvrait que la citadelle) : 5,5 µs par case, il y en a
// 500 000 dans le relevé (hors du rectangle penché, rien n'est testé), soit ~2,8 s de calcul
// étalées à 6 ms par image — les drapeaux sont posés une quinzaine de secondes après l'arrivée.
const NAV_PAS = 2, NAV_BUDGET_MS = 6, NAV_BUDGET_FIGE_MS = 14;   // en jeu / jeu figé (arrivée, pause)
// peut-on passer de la case k à sa voisine q ? (les deux libres, et rien entre elles)
const passe = (k, q) => (q === k + 1 ? nav.est[k] : q === k - 1 ? nav.est[q] : q === k + nav.nx ? nav.sud[k] : nav.sud[q]) === 1;
let nav = null;
const caseNav = (x, z) => {
  const i = Math.floor((x - nav.x0) / NAV_PAS), j = Math.floor((z - nav.z0) / NAV_PAS);
  return i < 0 || j < 0 || i >= nav.nx || j >= nav.nz ? -1 : j * nav.nx + i;
};
// la grille couvre toute la châtellenie : elle sert aussi à choisir où planter les drapeaux
// l'attente estimée avant les drapeaux, à la vitesse où la grille se remplit (null : on ne sait pas encore)
const navVitesse = { t0: 0, f0: 0 };
function attenteDrapeaux() {
  if (!nav) return null;
  if (nav.fait >= nav.nz) return 1;
  const dt = (performance.now() - navVitesse.t0) / 1000, fait = nav.fait - navVitesse.f0;
  const e = dt > 0.5 && fait > 0 ? (nav.nz - nav.fait) / (fait / dt) : null;
  // la vitesse change (14 ms par image à l'arrivée, 6 ms en jeu) : on la reprend toutes les 3 s
  if (dt > 3) { navVitesse.t0 = performance.now(); navVitesse.f0 = nav.fait; navVitesse.e = e; }
  return e ?? navVitesse.e ?? null;
}
function preparerNav() {
  if ((!lieux.length && aLille()) || !G.level) return;   // hors de Lille, pas de lieux nommés : la grille se fait quand même
  // pas avant la fin du chargement : les lieux existent pendant la construction, les murs pas encore tous
  if (!nav && !document.getElementById('loading')?.classList.contains('hidden')) return;
  if (!nav) {
    // partie courte : les drapeaux restent dans l'aire la plus étroite, la grille n'en couvre
    // que les abords (une vingtaine de fois moins de cases) ; sinon l'aire de la manche, prise
    // à son contour (à Lille, le parc : quatre fois moins de cases que toute la châtellenie)
    if (!manche || !manche.duree) return;
    const zone = calendrierAire()[0], ids = idsAires(), courte = manche.duree < 300 || !zone || zone.aire === ids[ids.length - 1];
    const pts = courte ? candidatsDrapeaux().map((l) => [l.x, l.z])
      : AIRES[zone.aire].r === Infinity ? ENCEINTE : rideau(zone.aire).userData.contour;
    if (!pts.length) return;
    const marge = courte ? 90 : 10;
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
    const x0 = Math.min(...xs) - marge, z0 = Math.min(...zs) - marge;
    const nx = Math.ceil((Math.max(...xs) + marge - x0) / NAV_PAS), nz = Math.ceil((Math.max(...zs) + marge - z0) / NAV_PAS);
    navVitesse.t0 = performance.now(); navVitesse.f0 = 0;
    nav = { x0, z0, nx, nz, libre: new Uint8Array(nx * nz), haut: new Float32Array(nx * nz), est: new Uint8Array(nx * nz), sud: new Uint8Array(nx * nz), fait: 0, champs: new Map() };
  }
  if (nav.fait >= nav.nz) return;
  const t0 = performance.now();
  const budget = state.running && !state.paused ? NAV_BUDGET_MS : NAV_BUDGET_FIGE_MS;
  while (nav.fait < nav.nz && performance.now() - t0 < budget) {
    const j = nav.fait++, z = nav.z0 + (j + 0.5) * NAV_PAS;
    for (let i = 0; i < nav.nx; i++) {
      const x = nav.x0 + (i + 0.5) * NAV_PAS;
      if (horsEnceinte(x, z) >= 0 || (world.bounds && world.bounds(x, z))) { nav.libre[j * nav.nx + i] = 0; continue; }
      // Au-dessus de l'eau, on ne passe que sur un ouvrage (surOuvrage, la règle du moteur), à
      // la hauteur de son tablier (getH la rend). Tester le fond rendait tous les ponts
      // infranchissables : la citadelle était une île dans la grille, et aucun drapeau ne
      // pouvait se poser au-delà des fossés. Ne tester que la hauteur ouvrait au contraire
      // l'eau voisine du pont de la Porte Royale : les bots y butaient contre le parapet.
      const sol = world.levelH ? world.levelH(x, z) : 0;
      const k = j * nav.nx + i;
      // à la hauteur où l'on MARCHE (getH : chaussée gravée, dalles, plateformes), pas au relief
      // brut : un obstacle qui ne vaut qu'au-dessus d'une hauteur (`.bottom`, parapets des ponts
      // relevés) échappait à la grille, et le bot, 30 cm plus haut sur les pavés, y butait
      // Sous un pont relevé, on se place sur son TABLIER : c'est là que passent les bots (sur
      // l'avenue Léon Jouhaux, à 8 m), et ses parapets ne valent qu'à cette hauteur — vue du
      // sol en dessous, la grille ouvrait des chemins qui les traversaient
      const tab = pont(x, z);
      if (eau(x, z) > 1.5) { const yh = tab !== null ? tab : getH(x, z, sol + 0.5); nav.libre[k] = !blocked(x, z, 0.6, false, yh) ? 1 : 0; nav.haut[k] = yh; continue; }
      const y = getH(x, z, sol + 15);
      nav.libre[k] = ouvrage(x, z, y) && !blocked(x, z, 0.6, false, y) ? 1 : 0; nav.haut[k] = y;
    }
    // LES PASSAGES entre cases voisines, testés à mi-chemin : un mur mince (parapet de pont,
    // ravelin de la Porte Royale) tombe entre deux centres distants de 2 m sans toucher ni
    // l'un ni l'autre, et le chemin le traversait — les bots piétinaient contre (29 sept.).
    const { nx, libre, haut } = nav, zj = nav.z0 + (j + 0.5) * NAV_PAS;
    for (let i = 0; i < nx - 1; i++) { const k = j * nx + i;
      if (libre[k] && libre[k + 1]) nav.est[k] = !blocked(nav.x0 + (i + 1) * NAV_PAS, zj, 0.45, false, Math.max(haut[k], haut[k + 1])) ? 1 : 0; }
    if (j > 0) for (let i = 0; i < nx; i++) { const k = j * nx + i, u = k - nx;
      if (libre[k] && libre[u]) nav.sud[u] = !blocked(nav.x0 + (i + 0.5) * NAV_PAS, nav.z0 + j * NAV_PAS, 0.45, false, Math.max(haut[k], haut[u])) ? 1 : 0; }
  }
}
function champ(d) {
  if (!nav || nav.fait < nav.nz) return null;
  let c = nav.champs.get(d.id);
  if (c) return c;
  const { nx, nz, libre } = nav, dist = new Int32Array(nx * nz).fill(-1), file = new Int32Array(nx * nz);
  let tete = 0, queue = 0;
  const r = Math.ceil((RAYON_DRAPEAU - 1) / NAV_PAS), ci = Math.floor((d.p[0] - nav.x0) / NAV_PAS), cj = Math.floor((d.p[1] - nav.z0) / NAV_PAS);
  for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
    if (i < 0 || j < 0 || i >= nx || j >= nz || (i - ci) ** 2 + (j - cj) ** 2 > r * r) continue;
    const k = j * nx + i; if (!libre[k]) continue;
    dist[k] = 0; file[queue++] = k;
  }
  while (tete < queue) {
    const k = file[tete++], i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const q = b * nx + a; if (!libre[q] || dist[q] >= 0 || !passe(k, q)) continue;
      dist[q] = dist[k] + 1; file[queue++] = q;
    }
  }
  nav.champs.set(d.id, dist);
  return dist;
}
// Un bot ne saute pas : posé dans un parterre clos de grilles (la place d'Armes en a
// plusieurs), il n'en sortait plus de la manche. En prise des drapeaux, un bot ne naît, ne
// se relève et ne pose son ralliement que sur une case reliée aux drapeaux.
function relieAuJeu(x, z) {
  if (regle !== 'drapeaux' || !drapeaux.length || !nav || nav.fait < nav.nz) return true;
  const k = caseNav(x, z), ch = champ(drapeaux[0]);
  return k < 0 || ch[k] >= 0;                     // hors de la grille : on ne sait pas, on laisse faire
}
// le prochain point sur le chemin du bot vers le drapeau : quatre cases plus bas sur la pente
function pasVers(b, d) {
  const dist = champ(d);
  if (!dist) return null;
  const { nx, nz } = nav;
  let i = Math.floor((b.pos.x - nav.x0) / NAV_PAS), j = Math.floor((b.pos.z - nav.z0) / NAV_PAS);
  if (i < 0 || j < 0 || i >= nx || j >= nz) return null;
  // une case qu'il peut rejoindre en ligne droite, sans rien heurter
  const joignable = (a, c) => { const x = nav.x0 + (a + 0.5) * NAV_PAS, z = nav.z0 + (c + 0.5) * NAV_PAS;
    for (const t of [0.25, 0.5, 0.75, 1]) if (blocked(b.pos.x + (x - b.pos.x) * t, b.pos.z + (z - b.pos.z) * t, 0.45, false, b.pos.y)) return false;
    return true; };
  if (dist[j * nx + i] < 0) {                      // posé sur une case pleine (contre un mur) : la voisine libre
    // … joignable : la plus proche du but était souvent DERRIÈRE le mur qu'il frôlait (le
    // garde-corps du pont de la Porte Royale), et il y poussait sans fin
    let best = -1;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= nx || c >= nz) continue;
      const v = dist[c * nx + a]; if (v >= 0 && (best < 0 || v < dist[best]) && joignable(a, c)) best = c * nx + a;
    }
    if (best < 0) return null;
    i = best % nx; j = (best - i) / nx;
  }
  for (let pas = 0; pas < 4; pas++) {
    const k = j * nx + i; if (dist[k] === 0) break;
    let mi = i, mj = j;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= nx || c >= nz) continue;
      const v = dist[c * nx + a]; if (v >= 0 && v < dist[mj * nx + mi] && passe(k, c * nx + a)) { mi = a; mj = c; }
    }
    if (mi === i && mj === j) break;
    // viser plus loin sur le chemin, oui, mais pas en coupant un coin : au bout du garde-corps,
    // la ligne droite vers la quatrième case passait à travers son extrémité. Si même la
    // première n'est pas joignable (le bot frôle le mur, loin du centre de sa case), il vise
    // d'abord le centre de la sienne, d'où le passage est dégagé.
    if (!joignable(mi, mj)) break;
    i = mi; j = mj;
  }
  return { x: nav.x0 + (i + 0.5) * NAV_PAS, z: nav.z0 + (j + 0.5) * NAV_PAS };
}

// Les bots disent à leur camp ce qu'ils font (Eugène) : où ils vont, ce qu'ils défendent,
// quand ils sont débordés. Pas plus d'une phrase par bot toutes les dix secondes, ni plus
// d'une par camp toutes les trois : au-delà, le chat n'est plus lisible. Rien n'est dit à un
// camp sans humain — personne pour le lire.
const dernierMotCamp = {};
function annoncer(b, cle, texte, delai = 10000) {
  const camp = (autres.get(b.id) || {}).camp, now = performance.now();
  if (!camp || !enEquipes() || b.dernierCle === cle) return;
  if (now - (b.dernierMot || -1e9) < delai || now - (dernierMotCamp[camp] || -1e9) < 3000) return;
  if (state.camp !== camp && ![...autres.values()].some((o) => !o.bot && o.camp === camp)) return;
  b.dernierMot = now; b.dernierCle = cle; dernierMotCamp[camp] = now;
  parler(b, { t: 'chat', m: typeof texte === 'function' ? texte() : texte, e: 1 });   // le salon le rend aux humains du camp, pilote compris
}
const PHRASES = {
  prendre: ['Je fonce prendre {d} !', 'Je m’occupe {de}.', '{D} est libre, j’y vais.'],
  reprendre: ['Je vais leur reprendre {d}.', 'J’attaque {d}, suivez-moi !', 'On leur arrache {d} ?'],
  defendre: ['Ils touchent à {d}, j’y retourne !', 'Je défends {d}.', 'Je garde {d}, on ne le lâche pas.'],
  aide: ['Ils sont {n} sur {d}, venez m’aider !', 'Besoin de renfort {à}, ils sont {n} !'],
  tenir: ['{D} est à nous, je reste pour le tenir.'],
};
const phrase = (genre, d, n = 0) => {
  const l = PHRASES[genre], t = l[Math.floor(Math.random() * l.length)];
  // « de le donjon » : les articles se contractent (du, des, au, aux)
  const [art, ...reste] = d.nom.split(' '), suite = reste.join(' ');
  const de = art === 'le' ? 'du ' + suite : art === 'les' ? 'des ' + suite : 'de ' + d.nom;
  const a = art === 'le' ? 'au ' + suite : art === 'les' ? 'aux ' + suite : 'à ' + d.nom;
  return t.replace('{D}', d.nom.charAt(0).toUpperCase() + d.nom.slice(1)).replace('{d}', d.nom).replace('{de}', de).replace('{à}', a).replace('{n}', n);
};

// Le drapeau qu'un bot va prendre : le plus proche qui n'est pas à son camp. Un sur trois
// garde plutôt ceux des siens qu'on entame ; quand tout est à son camp, il va tenir le plus
// menacé. Chacun vise un point à lui dans le cercle : sans ça, ils s'empilaient sur le mât.
function objectifDrapeau(b, camp) {
  if (regle !== 'drapeaux' || !manche || manche.etat !== 'cours' || !camp || !drapeaux.length) return null;
  const dist = (d) => Math.hypot(d.p[0] - b.pos.x, d.p[1] - b.pos.z);
  const menace = (d) => d.camp === camp && (d.conteste || d.jauge < 1);
  let d = drapeaux.find((x) => dist(x) < RAYON_DRAPEAU * 0.8 && (x.camp !== camp || menace(x)));   // on y est : on y reste
  if (!d) {
    const garde = b.id % 3 === 0;
    // les alliés qui visent déjà un drapeau le rendent moins tentant : sans ça, tout le camp
    // courait au plus proche et la partie se réduisait à une mêlée au centre
    const deja = (x) => [...bots.values()].filter((o) => o !== b && o.visee === x.id && (autres.get(o.id) || {}).camp === camp).length;
    const cout = (x) => dist(x) + 45 * deja(x) + (x.camp !== camp ? (garde ? 120 : 0) : (menace(x) ? (garde ? -80 : 60) : 600));
    d = drapeaux.reduce((a, x) => (cout(x) < cout(a) ? x : a));
  }
  // redemandé à chaque pensée : si le camp vient de parler, la phrase attend son tour
  annoncer(b, 'va-' + d.id, () => phrase(d.camp === camp ? (menace(d) ? 'defendre' : 'tenir') : d.camp ? 'reprendre' : 'prendre', d));
  b.visee = d.id;
  // dans le cercle, en nombre inférieur : on appelle les siens
  if (dist(d) < RAYON_DRAPEAU) {
    const ici = (x, z) => Math.hypot(x - d.p[0], z - d.p[1]) < RAYON_DRAPEAU + 2;
    const adv = ennemisDe(b).filter((e) => ici(e.x, e.z)).length;
    const nous = 1 + [...bots.values()].filter((o) => o !== b && o.pos && (autres.get(o.id) || {}).camp === camp && ici(o.pos.x, o.pos.z)).length
      + (state.camp === camp && ici(player.pos.x, player.pos.z) ? 1 : 0);
    if (adv > nous) annoncer(b, 'aide-' + d.id, () => phrase('aide', d, adv), 8000);
  }
  if (!b.decal) { const an = Math.random() * TAU, r = 1.5 + Math.random() * 3.5; b.decal = [Math.cos(an) * r, Math.sin(an) * r]; }
  return { x: d.p[0] + b.decal[0], z: d.p[1] + b.decal[1], dire: null, drapeau: d };
}

// ce que le bot veut faire de la bannière (en équipes) : un point où aller, et une demande
function objectifBanniere(b, camp) {
  if (!enEquipes() || !bannieres || !rdv || rdv.x !== undefined || !camp) return null;
  const adv = autreCamp(camp), bA = bannieres[adv], bM = bannieres[camp];
  if (!bA || !bM || !rdv[camp] || !rdv[adv]) return null;
  if (bA.porteur === b.id) { annoncer(b, 'porte', 'J’ai leur bannière ! Couvrez-moi jusqu’au ralliement.', 0); return { x: rdv[camp].x, z: rdv[camp].z, dire: bM.etat === 'base' ? { t: 'rapporter' } : null }; }
  if (bM.etat === 'tombee' && bM.p) { annoncer(b, 'rendre', 'Notre bannière est à terre, je vais la relever !'); return { x: bM.p[0], z: bM.p[1], dire: { t: 'saisir', camp } }; }
  if (!b.porteur) return null;
  if (bA.etat === 'base') { annoncer(b, 'chercher', 'Je pars chercher leur bannière.'); return { x: rdv[adv].x, z: rdv[adv].z, dire: { t: 'saisir', camp: adv } }; }
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
  // pendant la trêve d'avant-manche, personne n'est un ennemi : le serveur refuserait le coup
  const ennemis = treve() ? [] : ennemisDe(b);
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
  // Une cible à un autre étage, ou derrière un mur (le Batut) : le graphe de l'arène, plutôt
  // que de tourner sous elle — au banc, en 90 s, aucun bot n'était jamais monté, et celui qui
  // visait restait collé à la cloison de la salle à manger. Sans cible, une flânerie sur
  // quatre va à un point du graphe pris au hasard (b.flane), à un autre étage le plus souvent.
  const vise = cible || (b.chasse && ennemis.find((e) => e.id === b.chasse)) || b.flane;
  if (vise && suivreGraphe(b, vise, dt, now)) return;
  if (b.flane && (vise === b.flane) && !b.chemin) b.flane = null;
  if (b.flane && cible) b.flane = null;
  // à bout de cœurs, les plus malins décrochent un moment
  if (cible && P.fuite && b.hp <= b.mx * P.fuite && b.fuiteT < -6) { b.fuiteT = 2.5; annoncer(b, 'repli', 'Je suis à bout, je décroche un instant !', 20000); }
  if (cible && b.fuiteT > 0) {
    avancer(b, b.pos.x - cible.x, b.pos.z - cible.z, P.vitesse, dt);
    return;
  }

  // la bannière d'abord pour le porteur ; les autres ne la ramassent que s'ils passent dessus
  // hors de l'aire (ou de celle qui s'annonce) : il rentre d'abord, le reste attendra
  if (botRentre(b)) { b.act = 0; avancer(b, b.but.x - b.pos.x, b.but.z - b.pos.z, P.vitesse, dt); return; }
  const obj = regle === 'drapeaux' ? objectifDrapeau(b, camp) : objectifBanniere(b, camp);
  const porte = obj && regle !== 'drapeaux' && bannieres && bannieres[autreCamp(camp)] && bannieres[autreCamp(camp)].porteur === b.id;
  // en route vers un drapeau, on ne se bat que contre qui barre le chemin (4 m) ou tient le
  // cercle qu'on veut : les autres, on les laisse — le drapeau d'abord
  const seBat = cible && (obj && obj.drapeau
    ? Math.hypot(cible.x - b.pos.x, cible.z - b.pos.z) < 4 || Math.hypot(cible.x - obj.drapeau.p[0], cible.z - obj.drapeau.p[1]) < RAYON_DRAPEAU + 2
    : Math.hypot(cible.x - b.pos.x, cible.z - b.pos.z) <= 6);
  if (obj && (porte || !seBat)) {
    const d = Math.hypot(obj.x - b.pos.x, obj.z - b.pos.z);
    // loin du cercle, le chemin de la grille ; dedans, droit sur sa place
    const via = obj.drapeau && Math.hypot(obj.drapeau.p[0] - b.pos.x, obj.drapeau.p[1] - b.pos.z) > RAYON_DRAPEAU - 1 ? pasVers(b, obj.drapeau) : null;
    // la grille voit les murs au sol, pas tout : si le bot n'avance plus sur son chemin
    // (une terrasse, un recoin que la grille croit ouvert), il décroche et contourne à l'ancienne
    if (via && !(b.sansGrille > now)) {
      b.detour = null; avancer(b, via.x - b.pos.x, via.z - b.pos.z, P.vitesse, dt);
      // la progression se lit LE LONG DU CHEMIN (la distance de la grille), pas à vol d'oiseau :
      // pour un drapeau au nord, le chemin part d'abord vers le sud (la Porte Royale), et le
      // bot, se croyant bloqué au bout d'1,5 s, lâchait la grille et tournait sur la place
      const ch = champ(obj.drapeau), kc = caseNav(b.pos.x, b.pos.z);
      const dd = ch && kc >= 0 && ch[kc] >= 0 ? ch[kc] * NAV_PAS : Math.hypot(obj.drapeau.p[0] - b.pos.x, obj.drapeau.p[1] - b.pos.z);
      if (dd > (b.dVia ?? Infinity) - P.vitesse * dt * 0.3) b.bloqueVia = (b.bloqueVia || 0) + dt; else b.bloqueVia = 0;
      b.dVia = dd;
      if (b.bloqueVia > 1.5) { b.bloqueVia = 0; b.sansGrille = now + 3000; b.bloqueObj = 2; }
      b.dObj = d; return;
    }
    // sans grille (pas encore prête, ou hors de ses bords) : un mur entre lui et le but, il
    // contourne par le côté, comme à la poursuite
    if (b.detour && now < b.detour.fin && Math.hypot(b.detour.x - b.pos.x, b.detour.z - b.pos.z) > 1.5) {
      avancer(b, b.detour.x - b.pos.x, b.detour.z - b.pos.z, P.vitesse, dt);
      return;
    }
    if (d > 2.2) {
      avancer(b, obj.x - b.pos.x, obj.z - b.pos.z, P.vitesse, dt);
      if (d > (b.dObj ?? Infinity) - P.vitesse * dt * 0.3) b.bloqueObj = (b.bloqueObj || 0) + dt; else b.bloqueObj = 0;
      if (b.bloqueObj > 1.1) {
        b.bloqueObj = 0;
        const cap = Math.atan2(obj.x - b.pos.x, obj.z - b.pos.z) + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.8);
        const q = praticable(b.pos.x + Math.sin(cap) * 9, b.pos.z + Math.cos(cap) * 9);
        if (q) b.detour = { x: q.x, z: q.z, fin: now + 2500 };
      }
    }
    b.dObj = d;
    if (d < 3 && obj.dire && now - b.demande > 700) { b.demande = now; parler(b, obj.dire); }
    return;
  }

  if (cible) {
    b.calme = 0;
    const dx = cible.x - b.pos.x, dz = cible.z - b.pos.z, d = Math.hypot(dx, dz);
    if ((P.arc || enEquipes()) && d > 9 && d < 30 && b.arcCd <= 0 && vueDegagee(b.pos, cible)) {
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
  // coincé il y a peu : la destination de rechange tient trois secondes (la traque la réécrivait à
  // chaque image, et le bot restait collé au bassin du Batut)
  if (traque && !(b.repitT > now)) b.but = { x: traque.x, z: traque.z };
  if (!b.but || Math.hypot(b.but.x - b.pos.x, b.but.z - b.pos.z) < 2.5) {
    b.but = butAuHasard(b);
    const Gr = arene && (arene.graphe || grapheAuto());
    if (Gr && Math.random() < 0.25) { const ailleurs = Gr.n.filter((q) => Math.abs(q[2] - b.pos.y) > 2), l = ailleurs.length ? ailleurs : Gr.n, q = l[Math.floor(Math.random() * l.length)]; b.flane = { x: q[0], z: q[1], y: q[2] }; }
  }
  const avant = b.pos.clone();
  avancer(b, b.but.x - b.pos.x, b.but.z - b.pos.z, P.vitesse * (traque ? 1 : 0.6), dt);
  // coincé contre un mur : autre destination
  if (avant.distanceTo(b.pos) < P.vitesse * 0.6 * dt * 0.2) { if ((b.coince += dt) > 1) { b.but = butAuHasard(b); b.coince = 0; b.repitT = now + 3000; } }
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
  if (!enEquipes() || now - rdvBotsT < 2000) return;
  rdvBotsT = now;
  for (const c of ['garnison', 'bourg']) {
    if (rdv && rdv.x === undefined && rdv[c]) continue;
    const b = [...bots.values()].find((x) => (autres.get(x.id) || {}).camp === c);
    if (!b) continue;
    const humains = [...autres.values()].some((o) => !o.bot && o.camp === c) || state.camp === c;
    if (humains && now - (b.depuis || (b.depuis = now)) < 25000) continue;     // on laisse aux humains le temps de choisir
    const autre = rdv && rdv.x === undefined && rdv[autreCamp(c)];
    const depart = autre || (apparition ? { x: apparition.x, z: apparition.z } : pointDeDepart());
    if (!depart) continue;
    const an0 = Math.random() * TAU;
    for (let k = 0; k < 8; k++) {
      const an = an0 + k * TAU / 8, p = praticable(depart.x + Math.cos(an) * 70, depart.z + Math.sin(an) * 70);
      if (p && relieAuJeu(p.x, p.z)) {
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
  // Les bots vivent dès que la citadelle est bâtie : la manche part pendant que l'humain
  // choisit son apparence, son camp et son point d'arrivée — ils l'attendaient pour naître,
  // et l'humain entrait dans une partie vide (Eugène). La pause du pilote ne les fige pas
  // non plus : les autres joueurs, eux, jouent.
  // (`lieux.length` : à Lille, les lieux nommés disent que la carte est bâtie ; le Batut et le
  // Pouget n'en ont pas — leurs bots ne pensaient pas du tout, figés où la manche les posait)
  const actifs = G.level && (lieux.length || !aLille()) && document.getElementById('loading')?.classList.contains('hidden');
  if (actifs) ralliementDesBots(now);

  tickFlechesBots(dt);
  for (const b of bots.values()) {
    const a = autres.get(b.id);
    if (!a) continue;
    if (!b.look) { b.look = lookAuHasard(); parler(b, { t: 'look', l: b.look }); a.look = LOOK.normaliser(b.look); LOOK.appliquerSur(a.mesh, lookDe(a.look, a.camp)); }
    if (actifs && !b.pos && !placerBot(b)) continue;
    if (!b.pos) continue;
    if (actifs && b.niveau === G.level.name) {
      // une porte fermée devant lui : le bot l'ouvre (son graphe passe par elle)
      if (G.level.portesFermees) for (const d of G.level.portesFermees()) if (Math.hypot(b.pos.x - d.x, b.pos.z - d.z) < 1.8 && Math.abs((b.pos.y || 0) - d.y) < 2) {
        G.level.porte(d.id, true); envoyer({ t: 'porte', id: d.id, ouverte: true }); }
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
const NOM_REGLE = { balade: 'Balade', survie: 'Match à mort', temps: 'Chrono', drapeaux: 'Prise des drapeaux' };
// la trêve : un compte à rebours d'avant-manche (MANCHE_OUVERTURE, app.py) — aucun coup ne porte
const treve = () => !!(manche && manche.etat === 'compte');
// LE SPECTATEUR. Éliminée au match à mort, Camille clignotait sans fin (l'invincibilité
// infinie la faisait clignoter) et errait dans le décor (Eugène, 30 septembre : « je me déplace
// mais je suis inexistant »). Elle disparaît, ne bouge plus, et la caméra suit un participant
// encore en lice (G.spectateur, engine.js) ; un clic passe au suivant.
let suiviIdx = 0;
function enLice() {
  const l = [];
  for (const b of bots.values()) if (b.pos && !(b.mortT > 0) && !estElimine(b.id)) l.push({ id: b.id, pos: b.pos });
  for (const a of autres.values()) if (!bots.has(a.id) && a.mesh && a.mesh.visible && !estElimine(a.id)) l.push({ id: a.id, pos: a.mesh.position });
  return l;
}
function majSpectateur() {
  const actif = elimine && regle === 'survie' && manche && manche.etat === 'cours';
  if (!actif) { if (G.spectateur) G.spectateur = null; return; }
  const l = enLice();
  G.spectateur = l.length ? l[((suiviIdx % l.length) + l.length) % l.length].pos : null;
}
addEventListener('mousedown', (e) => { if (G.spectateur && e.button === 0) suiviIdx++; });
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
  if (m.drapeaux) evenementDrapeaux({ drapeaux: m.drapeaux, tenue: m.tenue });
  if (m.etat === 'cours' && avant !== 'cours') debutManche();
  elimine = estElimine(moi && moi.id);
  if (m.etat === 'fin' && avant !== 'fin') afficherResultats(m);
  else if (m.etat === 'fin') majBoutonsResultats(m);
  if (m.etat !== 'fin' && resultats) { resultats.remove(); resultats = null; }
  peindreManche(); peindrePanneau();
}

// tout le monde repart à égalité : cœurs pleins, au point d'arrivée, quelques secondes à l'abri
// UN ENDROIT D'OÙ L'ON PEUT PARTIR. `praticable` dit qu'on tient debout ; pas qu'on en sort :
// un recoin entre trois murs passait (Eugène, 30 septembre : « j'ai atterri dans une zone
// bloquée entre trois murs »). On inonde, au mètre, aux règles de Camille (collision, marche
// de 0,5 m) : il faut pouvoir s'éloigner de 25 m.
function ouvert(x, z) {
  const PAS = 1, R = 26, N = 2 * R + 1, vu = new Uint8Array(N * N), file = [[R, R]];
  vu[R * N + R] = 1;
  const h = (i, j) => { const px = x + (i - R) * PAS, pz = z + (j - R) * PAS; return world.levelH ? world.levelH(px, pz) : 0; };
  while (file.length) {
    const [i, j] = file.pop(), y = h(i, j);
    if (Math.hypot(i - R, j - R) >= 25) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N || vu[b * N + a]) continue;
      const px = x + (a - R) * PAS, pz = z + (b - R) * PAS, y2 = h(a, b);
      if (y2 - y > 0.5 || (eau(px, pz) < 1 && !ouvrage(px, pz, y2)) || blocked(px, pz, 0.4, false, y2)) continue;
      vu[b * N + a] = 1; file.push([a, b]);
    }
  }
  return false;
}
// LE REGARD À L'ARRIVÉE. Apparue contre le parapet d'un bastion, tournée vers l'intérieur,
// Camille avait la caméra dans son dos au-dessus du fossé : on la voyait par-dessus le
// parapet, « enfoncée » jusqu'à la taille (Eugène, 30 septembre). On la tourne vers le côté
// où, six mètres derrière elle, le sol est praticable et à la même hauteur : la caméra y reste.
function orienterArrivee() {
  const p = player.pos, y = p.y;
  let mieux = null, score = -1;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, sx = Math.sin(a), sz = Math.cos(a);
    let n = 0;                                            // combien de pas libres derrière elle
    for (let d = 1.5; d <= 7.5; d += 1.5) {
      const bx = p.x - sx * d, bz = p.z - sz * d, h = world.levelH ? world.levelH(bx, bz) : 0;
      if (Math.abs(h - y) > 1 || blocked(bx, bz, 0.5, false, h) || (eau(bx, bz) < 1 && !ouvrage(bx, bz, h))) break;
      n++;
    }
    if (n > score) { score = n; mieux = a; }
    if (n >= 5) break;
  }
  if (mieux !== null) { player.yaw = mieux; G.camYaw = mieux; }
}
// Un point de départ de manche ÉPARPILLÉ dans l'aire en vigueur, loin des autres (≥ 25 m) :
// tous les bots partaient du point d'arrivée du joueur et se retrouvaient sur lui.
function pointEparpille(aire, loin, autour = null) {
  // autour du joueur quand on le sait (les bots doivent le trouver en une minute), sinon la place
  const pl = autour || lieuDepart() || { x: 0, z: 0 };
  const R = AIRES[aire].eparpille || 200;            // assez près pour se trouver en une minute
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * TAU, r = R * Math.sqrt(Math.random());
    const q = praticable(pl.x + Math.cos(a) * r, pl.z + Math.sin(a) * r);
    if (!q || horsAire(q.x, q.z, aire) || loin.some((o) => Math.hypot(o.x - q.x, o.z - q.z) < 25)) continue;
    if (!relieAuJeu(q.x, q.z) || !ouvert(q.x, q.z)) continue;
    return q;
  }
  return null;
}
function debutManche() {
  const p = player;
  elimine = false; G.spectateur = null; suiviIdx = 0; debutCours = performance.now(); aireAnnoncee = null;
  p.hp = p.maxHp; p.invuln = 2; p.attackT = -1; p.rollT = -1; p.vy = 0; p.kb.set(0, 0, 0);
  const aire = etatAire(0).cur, ici = pointDansAire(apparition, aire);   // en drapeaux courts, l'aire est déjà la citadelle
  if (ici) {
    // près du point choisi, mais sur un endroit praticable ET ouvert
    let q = null;
    for (let k = 0; k < 16 && !q; k++) {
      const a = Math.random() * TAU, r = k ? 2 + k * 1.5 : 0, c = praticable(ici.x + Math.cos(a) * r, ici.z + Math.sin(a) * r);
      if (c && ouvert(c.x, c.z)) q = c;
    }
    q = q || pointEparpille(aire, []) || ici;
    p.pos.set(q.x, getH(q.x, q.z) + 0.1, q.z);
    orienterArrivee();
  }
  const occupes = [{ x: p.pos.x, z: p.pos.z }];
  for (const b of bots.values()) {
    b.mortT = 0; b.decal = null;
    const q = regle !== 'balade' ? pointEparpille(aire, occupes, occupes[0]) : null;
    if (q) {
      b.pos = new THREE.Vector3(q.x, getH(q.x, q.z, (world.levelH ? world.levelH(q.x, q.z) : 0) + 0.5), q.z);
      b.niveau = G.level.name; b.hp = b.mx; b.invuln = 2; b.act = 0; b.but = null; b.cible = null;
      occupes.push(q);
    } else if (b.pos || apparition) placerBot(b);
  }
  equiperEquipe(false);
  const v = manche.vies_max || 1, min = Math.round((manche.duree || 180) / 60), nd = (manche.drapeaux || []).length;
  showMessage(regle === 'survie' ? `Match à mort : ${v > 1 ? v + ' vies' : 'une seule vie'}. Le dernier debout gagne !`
    : regle === 'drapeaux' ? `Prise des drapeaux : ${min} minute${min > 1 ? 's' : ''}, ${nd || 'des'} drapeau${nd > 1 || !nd ? 'x' : ''} sur la carte. Tiens-toi dans leur cercle pour les prendre ; le camp qui en tient le plus à la fin gagne !`
    : `Chrono : ${min} minute${min > 1 ? 's' : ''}. Chaque mise à terre compte, chaque chute se paie !`, 6);
  try { SFX.win(); } catch (e) {}
}

function peindreManche() {
  // la balade n'a de bandeau que pendant sa minute d'ouverture
  if (!manche || (regle === 'balade' && manche.etat !== 'compte')) { if (bandeauManche) { bandeauManche.remove(); bandeauManche = null; } return; }
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
  else if (manche.etat === 'compte') ligne = (reste || 0) > 15
    ? `La partie commence dans <b style="font-size:20px">${mmss(reste)}</b><br><span style="color:#ffe7a3">Trêve : pas de combat avant le départ. Ramasse armes et équipement !</span>`
    : `Début dans <b style="font-size:20px">${reste}</b> s`;
  else if (manche.etat === 'cours' && regle === 'drapeaux') {
    const n = (c) => drapeaux.filter((d) => d.camp === c).length;
    const puces = drapeaux.map((d) => `<span style="color:${d.camp ? CAMPS[d.camp].couleur : '#e6dcc0'};${d.conteste ? 'text-shadow:0 0 6px #fff' : ''}">⚑</span>`).join(' ');
    ligne = `<b style="font-size:20px">${mmss(reste || 0)}</b> &nbsp; <b style="color:${CAMPS.garnison.couleur}">${n('garnison')}</b> ${puces} <b style="color:${CAMPS.bourg.couleur}">${n('bourg')}</b>${ligneDrapeau()}`;
    // tant que les drapeaux ne sont pas posés (la grille des chemins se remplit : jusqu'à une
    // vingtaine de secondes sur toute la carte), on dit combien de temps il reste — sinon on
    // croit la partie cassée
    if (!drapeaux.length) { const e = attenteDrapeaux();
      ligne += `<br><span style="color:#ffe7a3">⚑ Les drapeaux arrivent${e != null ? ` dans ~${Math.max(1, Math.ceil(e))} s` : '…'}</span>`; }
  } else if (manche.etat === 'cours' && regle === 'temps') {
    const moiSc = scoreManche(moi && moi.id);
    ligne = `<b style="font-size:20px">${mmss(reste || 0)}</b>${moiSc !== null ? ` &nbsp; toi : <b style="color:#ffe7a3">${moiSc > 0 ? '+' : ''}${moiSc}</b>` : ''}`;
  } else if (manche.etat === 'cours') {
    const enLice = Object.keys(manche.scores || {}).filter((id) => !manche.elimines.includes(+id)).length;
    const mesVies = viesDe(moi && moi.id);
    ligne = elimine ? `Éliminée — ${enLice} encore en lice`
      : `${enLice} encore en lice${mesVies !== null && (manche.vies_max || 1) > 1 ? ` &nbsp; toi : <b style="color:#ffe7a3">${mesVies} vie${mesVies > 1 ? 's' : ''}</b>` : ''}`;
  } else if (manche.etat === 'fin') ligne = `Prochaine manche dans ${reste} s`;
  // le préavis du resserrement, compté à rebours
  { const t = tempsManche(), e = t === null ? null : etatAire(t);
    if (e && e.suiv && e.suiv.dans <= PREAVIS) ligne += `<br><b style="color:${couleurAire(e.suiv.aire)}">⚠ ${AIRES[e.suiv.aire].herse ? 'La herse retombe' : 'Resserrement sur ' + AIRES[e.suiv.aire].nom} dans ${mmss(Math.max(0, Math.ceil(e.suiv.dans)))}</b>`; }
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
  .resultats-manche .badge { padding:1px 9px; border-radius:10px; background:rgba(237,227,204,.1); color:#EDE3CC; font-size:12px; }
  .resultats-manche .badge.recompense { background:rgba(226,178,90,.22); color:#FFE3A1; box-shadow:0 0 0 1px rgba(226,178,90,.5) inset; }
  .resultats-manche .miens { margin:14px 18px 0; text-align:center; font-size:15px; }
  .resultats-manche .boutons { display:flex; gap:10px; margin:16px 18px 0; }
  .resultats-manche button { flex:1; height:48px; border-radius:8px; font:inherit; font-size:17px; font-weight:700; cursor:pointer; }
  .resultats-manche .rejouer { background:#E2B25A; color:#2A1808; border:1px solid #FFE3A1; box-shadow:0 3px 0 #8A6424; }
  .resultats-manche .rejouer[aria-pressed="true"] { background:#3F7F5A; color:#fff; border-color:#6FC498; box-shadow:0 3px 0 #23513A; }
  .resultats-manche .accueil { flex:0 0 auto; padding:0 18px; background:transparent; color:#EDE3CC; border:1px solid rgba(237,227,204,.35); }
  .resultats-manche .suite { margin:10px 18px 0; text-align:center; font-size:13px; color:#C4BBA6; }
  .resultats-manche.en-camps { width:min(820px, 94vw); }
  .resultats-manche .camps { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:0 18px; }
  .resultats-manche .camp { border-radius:10px; background:#0F1420; border:1px solid rgba(237,227,204,.14); padding:10px 10px 12px; }
  .resultats-manche .camp.gagne { border-color:#E2B25A; box-shadow:0 0 0 1px rgba(226,178,90,.35) inset; }
  .resultats-manche .camp header { display:flex; align-items:baseline; justify-content:space-between; gap:8px; padding:0 4px 8px; border-bottom:1px solid rgba(237,227,204,.14); margin-bottom:8px; }
  .resultats-manche .camp header b { font-size:17px; }
  .resultats-manche .camp .compte { font-family:Grenze,Georgia,serif; font-size:40px; font-weight:700; line-height:1; color:#FFE3A1; }
  .resultats-manche .camp .compte small { font-family:"Alegreya Sans",sans-serif; font-size:13px; font-weight:400; color:#C4BBA6; margin-left:4px; }
  .resultats-manche .camp .tenue { padding:0 4px 8px; font-size:13px; color:#C4BBA6; }
  .resultats-manche .camp ol { margin:0; }
  .resultats-manche .camp li { background:#161C2B; }
  .resultats-manche .miroir { display:grid; grid-template-columns:1fr auto auto auto 1fr; align-items:center; gap:0 14px; margin:0 18px 14px; }
  .resultats-manche .miroir b { font-size:19px; }
  .resultats-manche .miroir b:first-child { text-align:right; }
  .resultats-manche .miroir .compte { font-family:Grenze,Georgia,serif; font-size:48px; font-weight:700; line-height:1; color:#FFE3A1; }
  .resultats-manche .miroir .tiret { font-family:Grenze,Georgia,serif; font-size:34px; color:#C4BBA6; }
  .resultats-manche .miroir .unite { grid-column:1 / -1; text-align:center; font-size:13px; color:#C4BBA6; }
  @media (max-width: 620px) { .resultats-manche .camps { grid-template-columns:1fr; } .resultats-manche .miroir b { font-size:15px; } }`;
  document.head.appendChild(st);
}
// Le score des deux camps en miroir, comme au stade : « La Garnison 0 – 2 Les gens du
// bourg » (Eugène, 29 septembre). Il se lisait mal en deux gros chiffres dans deux en-têtes
// de colonne. Les colonnes restent dessous, pour le détail de chacun.
function scoreMiroir(pts, unite) {
  const [a, b] = Object.keys(CAMPS);
  return `<div class="miroir"><b style="color:${CAMPS[a].couleur}">${ech(CAMPS[a].nom)}</b>`
    + `<span class="compte">${pts[a] || 0}</span><span class="tiret">–</span><span class="compte">${pts[b] || 0}</span>`
    + `<b style="color:${CAMPS[b].couleur}">${ech(CAMPS[b].nom)}</b>${unite ? `<span class="unite">${unite}</span>` : ''}</div>`;
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
  const ligne = (e, k) => {
    const sc = regle === 'drapeaux' ? `${e.cap || 0}<small>drapeau${(e.cap || 0) > 1 ? 'x' : ''} · ${e.k} / ${e.m}</small>` : regle === 'temps' ? `${e.k - e.m > 0 ? '+' : ''}${e.k - e.m}<small>${e.k} / ${e.m}</small>` : `${e.k}<small>à terre</small>`;
    const couleur = enEquipes() && CAMPS[e.camp] ? `color:${CAMPS[e.camp].couleur}` : '';
    const cls = [moi && e.id === moi.id ? 'moi' : '', (m.gagnants || []).includes(e.id) ? 'gagne' : ''].join(' ');
    return `<li class="${cls}"><span class="rang">${k + 1}</span><span class="nom" style="${couleur}">${nomDe_(e)}</span><span class="score">${sc}</span>
      ${e.badges.length ? `<span class="badges">${e.badges.map((b, k) => `<span class="badge${k ? ' recompense' : ''}">${ech(noms[b] || b)}</span>`).join('')}</span>` : ''}</li>`;
  };
  const lignes = (m.classement || []).slice(0, 12).map(ligne).join('');
  // Prise des drapeaux en équipes : le compte PAR CAMP, et le détail de chaque camp à côté
  // (Eugène, 29 septembre) — deux colonnes, le camp gagnant cerclé d'or
  const parCamps = regle === 'drapeaux' && enEquipes() && m.drapeaux;
  const blocCamps = !parCamps ? '' : (() => {
    const t = m.tenue || {}, pts = {};
    for (const c of Object.keys(CAMPS)) pts[c] = m.drapeaux.filter((d) => d.camp === c).length;
    return scoreMiroir(pts, 'drapeaux tenus à la fin') + '<div class="camps">' + Object.keys(CAMPS).map((c) => {
      const siens = (m.classement || []).filter((e) => e.camp === c);
      return `<section class="camp${m.camp_gagnant === c ? ' gagne' : ''}"><header><b style="color:${CAMPS[c].couleur}">${ech(CAMPS[c].nom)}</b></header>`
        + `<div class="tenue">Tenus ${t[c] || 0} s en tout</div>`
        + `<ol>${siens.map(ligne).join('') || '<li><span></span><span class="nom" style="opacity:.6">personne</span><span></span></li>'}</ol></section>`;
    }).join('') + '</div>';
  })();
  const miens = ((m.classement || []).find((e) => moi && e.id === moi.id) || { badges: [] }).badges;
  resultats = document.createElement('section');
  resultats.className = 'resultats-manche' + (parCamps ? ' en-camps' : '');
  resultats.setAttribute('role', 'dialog'); resultats.setAttribute('aria-label', 'Résultats de la manche');
  resultats.innerHTML = `<div class="frise"></div>
    <p class="regle">${ech(NOM_REGLE[regle] || '')} · fin de la manche</p>
    <h2>${titre}</h2>
    ${!parCamps && regle === 'drapeaux' && m.drapeaux ? (() => {
      const n = (c) => m.drapeaux.filter((d) => d.camp === c).length, t = m.tenue || {};
      return `<p class="miens" style="margin-top:-6px"><b style="color:${CAMPS.garnison.couleur}">${n('garnison')}</b> drapeau${n('garnison') > 1 ? 'x' : ''} à <b style="color:${CAMPS.bourg.couleur}">${n('bourg')}</b>`
        + (n('garnison') === n('bourg') ? ` <span style="opacity:.75">— départagés par le temps de tenue : ${t.garnison || 0} s contre ${t.bourg || 0} s</span>` : '') + '</p>';
    })() : ''}
    ${parCamps ? blocCamps : `<ol>${lignes}</ol>`}
    <p class="miens">${miens.length
      // le premier est le style de jeu (un par manche), les suivants des récompenses (serveur, badges_de_manche)
      ? `Ton style : <b style="color:#FFE3A1">${ech(noms[miens[0]] || miens[0])}</b>${miens.length > 1 ? ` · récompense${miens.length > 2 ? 's' : ''} : ${miens.slice(1).map((b) => `<b style="color:#FFE3A1">${ech(noms[b] || b)}</b>`).join(', ')}` : ''} — ils rejoignent ton compte.`
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
// Balade par équipes : le premier camp à VICTOIRE_BALADE points l'emporte (le serveur tranche,
// cf. victoire_balade). Le même cadre que la fin de manche, les deux camps côte à côte ; la
// balade continue derrière, points et bannières remis à zéro. « Continuer » ferme, ou 15 s.
let VICTOIRE_BALADE = 10;                        // = VICTOIRE_BALADE (app.py) ; le serveur le redit à chaque victoire
let victoireT = null;
function afficherVictoire(m) {
  if (m.objectif) VICTOIRE_BALADE = m.objectif;
  poserStyleResultats();
  if (resultats) resultats.remove();
  clearTimeout(victoireT);
  const nom = (j) => (moi && j.id === moi.id ? `${ech(monPerso)} (toi)` : ech(j.perso));
  const colonnes = Object.keys(CAMPS).map((c) => {
    const siens = (m.joueurs || []).filter((j) => j.camp === c);
    const li = siens.map((j, k) => `<li class="${moi && j.id === moi.id ? 'moi' : ''}"><span class="rang">${k + 1}</span><span class="nom" style="color:${CAMPS[c].couleur}">${nom(j)}</span>`
      + `<span class="score">${j.mises + 3 * j.bannieres}<small>${j.mises} à terre · ${j.bannieres} bannière${j.bannieres > 1 ? 's' : ''}</small></span></li>`).join('');
    return `<section class="camp${m.camp === c ? ' gagne' : ''}"><header><b style="color:${CAMPS[c].couleur}">${ech(CAMPS[c].nom)}</b></header>`
      + `<ol>${li || '<li><span></span><span class="nom" style="opacity:.6">personne</span><span></span></li>'}</ol></section>`;
  }).join('');
  resultats = document.createElement('section');
  resultats.className = 'resultats-manche en-camps'; resultats.dataset.victoire = '1';
  resultats.setAttribute('role', 'dialog'); resultats.setAttribute('aria-label', 'Victoire de camp');
  resultats.innerHTML = `<div class="frise"></div>
    <p class="regle">Balade par équipes · premier à ${m.objectif || VICTOIRE_BALADE} points</p>
    <h2>${ech(CAMPS[m.camp].nom)} l’emporte !</h2>
    ${scoreMiroir(m.points || {}, 'points')}
    <div class="camps">${colonnes}</div>
    <p class="miens">${state.camp === m.camp ? 'Victoire de ton camp !' : 'Ce sera pour la prochaine.'} <span style="opacity:.75">Les points et les bannières repartent de zéro.</span></p>
    <div class="boutons"><button type="button" class="rejouer">Continuer</button></div>`;
  document.body.appendChild(resultats);
  const fermer = () => { clearTimeout(victoireT); if (resultats) { resultats.remove(); resultats = null; } };
  resultats.querySelector('.rejouer').onclick = fermer;
  victoireT = setTimeout(fermer, 15000);
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  try { if (state.camp === m.camp) SFX.win(); } catch (e) {}
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
  // l'écran de victoire de la balade : Entrée ou Échap le ferment
  if (resultats && resultats.dataset.victoire && /^(Enter|NumpadEnter|Escape)$/.test(e.code)) { e.stopImmediatePropagation(); e.preventDefault(); resultats.querySelector('.rejouer').click(); return; }
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

  if (actif) { assurerArene(); premiereEntree(); ouvrirDonjon(); tickAire(dt, now); grapheAuto(); }
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
  tickObjets(now); poserForge(); poserInteractionsCheval();
  tickBannieres(now);
  tickDrapeaux(now);
  if (now - (majMarques.t || 0) > 400) { majMarques.t = now; majMarques(); }
  if (enEquipes() && state.running && !equipeDonnee && state.apparition) { equipeDonnee = true; equiperEquipe(true); }
  tickBots(dt, now);
  if (bandeauManche && now - (peindreManche.t || 0) > 500) { peindreManche.t = now; peindreManche(); if (resultats && manche) majBoutonsResultats(manche); }

  if (state.running && !state.paused && now - dernierEnvoi > 1000 / ENVOIS_PAR_S) {
    dernierEnvoi = now;
    envoyer({
      t: 'etat', p: [+player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2)],
      y: +player.yaw.toFixed(2), a: player.attackT >= 0 ? 1 : (player.rollT >= 0 ? 2 : 0),
      hp: player.hp, mx: player.maxHp, n: G.level.name,
      ar: armure || undefined, bc: ecu || undefined, gd: player.garde ? 1 : undefined, ch: monte ? 1 : undefined,
    });
    coupsEpee(); coupsFleche();
  }

  majSpectateur();
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
window.TLOC_MULTI = { autres, bots, envoyer, encaisser, orienterArrivee, etat: () => ({ instance: inst, moi, connectes: autres.size, bots: bots.size, regle, manche, elimine, drapeaux, tenue, arene: arene && arene.id, aire: aireEnVigueur }),
  nav: () => nav && { nx: nav.nx, nz: nav.nz, fait: nav.fait, champs: nav.champs.size }, pasVers, champ, grille: () => nav, candidatsDrapeaux, terrainDrapeau,
  equipement: () => ({ armure, armurePts, ecu, objets, monte, chevalPv }),
  // pour la passe des arènes (bancs/rencontres.mjs) : les camps nommés, l'aire tracée, ce qui est allumé
  verif: () => ({ camps: { garnison: CAMPS.garnison.nom, bourg: CAMPS.bourg.nom }, aires: PARTAGE.aires.length, bannieres: areneA('bannieres'), fete: areneA('fete'), forge: areneA('forge'),
    diag: { proposes: drapeauxProposes, serveur: lieuxDrapeauxServeur, nav: nav && nav.fait + '/' + nav.nz, p0: (() => { const l = lieuDepart(); return l && (terrainDrapeau(l) || praticable(l.x, l.z)); })() },
    graphe: arene && (arene.graphe ? 'déclaré' : arene.grapheAuto && arene.grapheAuto.fait ? arene.grapheAuto.n.length + ' points' : null) }) };
