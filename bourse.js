// bourse.js — l'argent, les gourdes et les potions.
//
// Tout l'état tient dans `state`, et rien n'a été ajouté au système de sauvegarde :
// `saveGame()` sérialise déjà toute clé de `state` qui n'est pas une clé d'exécution, et
// `loadGame()` la remet en place. Une partie d'avant la bourse repart donc de zéro sans
// rien casser (`state.ecus ?? 0`).
//
//   state.bourse        — vrai une fois le coffre de la chambre ouvert
//   state.bourseGrande  — la grande bourse des galeries (plafond 9 999)
//   state.ecus          — le compte
//   state.ecusVus       — le message « il te faudrait une bourse » a déjà été montré
//   state.gourdes       — nombre de gourdes possédées
//   state.fioles        — ce qu'il y a dedans : ['onguent', 'chicoree'], au plus une par gourde
//   state.poche         — { places, objets: [{ id, n }] } : la poche (touche I)
//   state.fleches       — flèches au carquois ; state.carquois — sa contenance (20, 40, 60)
//   state.faux          — la faux d'Émile : on fauche plus large (nature.js)
//   state.coffres       — { id: vrai } : les petits coffres à écus déjà ouverts
//
// L'économie est volontairement tenue à un seul endroit : les niveaux (house.js, mage.js,
// et plus tard quetes.js pour les monstres) appellent `gagner()` et `boutique()`, ils ne
// touchent jamais aux clés directement.

import {
  CROCHETS, SFX, THREE, TOUCHES, addCap, addInteract, burst, camera, cut, hideMenu, makeChest, menu, player,
  resumeGame, saveGame, scene, showMenu, showMessage, spawnGaufre, state,
} from './engine.js?v=27';

export const PLAFOND = 999, PLAFOND_GRAND = 9999;
export const DEPART = 40;              // ce que Camille avait mis de côté chez elle

// =====================================================================
//  Les potions
// =====================================================================
// On ne vend que ce qui marche vraiment aujourd'hui. Les deux autres (dégâts doublés,
// souffle long sous l'eau) demandent d'intercepter les dégâts et la nage : elles
// arriveront avec engine.js, pas avant — vendre une fiole qu'on ne peut pas boire serait
// pire que ne pas la vendre.
export const POTIONS = {
  onguent: {
    nom: 'Onguent de la doyenne', prix: 25, couleur: 0xff5070,
    effet: 'rend 3 cœurs',
    boire: () => {
      player.hp = Math.min(player.maxHp, player.hp + 6);
      burst(player.pos.x, player.pos.y + 1.4, player.pos.z, 0xff5070, 20, 3, 0.9, 2, 1.1);
      showMessage('Onguent de la doyenne : trois cœurs revenus.', 3);
    },
  },
  chicoree: {
    nom: 'Sirop de chicorée', prix: 30, couleur: 0x9ad44a, duree: 30,
    effet: 'course sans fin pendant 30 s',
    boire: () => {
      effet.chicoree = 30;
      burst(player.pos.x, player.pos.y + 1.4, player.pos.z, 0x9ad44a, 20, 3, 0.9, 2, 1.1);
      showMessage('Sirop de chicorée : trente secondes sans jamais souffler.', 3.5);
    },
  },
};

const effet = { chicoree: 0 };

// La jauge d'endurance est remplie par petites touches plutôt qu'à chaque image : le
// moteur la consomme dans updatePlayer(), on la remet à ras bord dix fois par seconde,
// ce qui suffit à ne jamais s'essouffler sans toucher à une ligne d'engine.js.
setInterval(() => {
  if (effet.chicoree <= 0) return;
  effet.chicoree -= 0.1;
  player.energie = 1; player.essouffle = false;
  if (effet.chicoree <= 0) showMessage('Le sirop ne fait plus effet.', 2.5);
}, 100);

// =====================================================================
//  La bourse
// =====================================================================
export const aBourse = () => !!state.bourse;
export const solde = () => state.ecus || 0;
export const plafond = () => (state.bourseGrande ? PLAFOND_GRAND : PLAFOND);

/** Le coffre de la chambre : c'est ici que l'économie commence. */
export function donnerBourse(depart = DEPART) {
  if (state.bourse) return false;
  state.bourse = true;
  state.ecus = Math.min(plafond(), (state.ecus || 0) + depart);
  return true;
}

export function grandeBourse() { state.bourseGrande = true; }

/**
 * Crédite des écus. Tant que la bourse n'a pas été trouvée, rien n'est compté : le
 * premier gain manqué explique pourquoi, une seule fois, et envoie le joueur chez lui.
 * `pos` (Vector3, facultatif) fait monter un petit « +3 » doré à cet endroit.
 */
export function gagner(n, pos = null) {
  if (n <= 0) return 0;
  if (!state.bourse) {
    if (!state.ecusVus) {
      state.ecusVus = true;
      showMessage('Une pièce roule dans l’herbe. Tu n’as rien pour l’emporter — ta bourse de gardienne est restée chez toi.', 6);
    }
    return 0;
  }
  const avant = solde();
  state.ecus = Math.min(plafond(), avant + n);
  const gagne = state.ecus - avant;
  if (gagne > 0) {
    flotter('+' + gagne, pos);
    // chaque dizaine franchie a son carillon : on sait où l'on en est sans lire le compteur
    if (Math.floor(state.ecus / 10) > Math.floor(avant / 10)) SFX.dizaine(); else SFX.piece();
  }
  else showMessage('Ta bourse est pleine.', 2);
  return gagne;
}

// =====================================================================
//  Les primes des monstres
// =====================================================================
// Ce que rapporte une mise à terre (cf. REPONSE-EQUIPEMENT.md, § 2). Un intervalle [a, b]
// tire au hasard entre les deux. Les niveaux appellent `prime(e)` depuis leur onKill ;
// monstres et coffres ne sont pas plafonnés — ils ne repoussent pas, la verdure si.
export const PRIMES = { corbeau: [1, 2], chauve: [1, 2], moule: 3, rat: 3, fantome: 4, ratroi: 25, phinaert: 60 };

export function prime(e) {
  const v = PRIMES[e.kind];
  if (v === undefined) return 0;
  const n = Array.isArray(v) ? v[0] + Math.floor(Math.random() * (v[1] - v[0] + 1)) : v;
  const lieu = new THREE.Vector3(e.pos.x, e.pos.y + 1.6, e.pos.z);
  // les corbeaux rendent une ou deux flèches : sans ça, un carquois vide devant les moules
  // des fossés (qu'on n'atteint qu'à l'arc) serait une impasse
  if ((e.kind === 'corbeau' || e.kind === 'chauve') && state.bow) {
    const r = rendreFleches(1 + Math.floor(Math.random() * 2));
    if (r) setTimeout(() => flotter('+' + r + ' flèche' + (r > 1 ? 's' : ''), lieu.clone().setY(lieu.y + 0.6), '#cfe6ff'), 250);
  }
  return gagner(n, lieu);
}

// =====================================================================
//  Le carquois
// =====================================================================
export const carquois = () => state.carquois || 20;
export const fleches = () => (state.fleches ?? carquois());
export function rendreFleches(n) {
  const avant = fleches();
  state.fleches = Math.min(carquois(), avant + n);
  return state.fleches - avant;
}

export const peutPayer = (n) => aBourse() && solde() >= n;

/** Perdre des écus sans rien acheter (la bourse en jeu, en instance). */
export function perdre(n) {
  const k = Math.min(solde(), Math.max(0, n | 0));
  if (!k) return 0;
  state.ecus = solde() - k;
  flotter('−' + k, null, '#ffb0a0');
  return k;
}

export function payer(n) {
  if (!peutPayer(n)) return false;
  state.ecus = solde() - n;
  flotter('−' + n, null, '#ffb0a0');
  return true;
}

// =====================================================================
//  Gourdes et fioles
// =====================================================================
export const gourdes = () => state.gourdes || 0;
export const fioles = () => (Array.isArray(state.fioles) ? state.fioles : (state.fioles = []));
export const gourdesLibres = () => Math.max(0, gourdes() - fioles().length);

export function ajouterGourde() { state.gourdes = gourdes() + 1; }

export function remplir(id) {
  if (!POTIONS[id] || gourdesLibres() <= 0) return false;
  fioles().push(id);
  return true;
}

/** Boire la plus ancienne fiole. Touche B. */
export function boire() {
  const f = fioles();
  if (!f.length) { showMessage(gourdes() ? 'Tes gourdes sont vides.' : 'Tu n’as pas de gourde.', 2.5); return false; }
  const p = POTIONS[f.shift()];
  p.boire();
  SFX.pickup();
  saveGame(true);
  return true;
}

// Les touches passent par le registre du moteur (TOUCHES, engine.js) : il ne les laisse
// jouer qu'en jeu, hors menu, hors cinématique et hors pause.
TOUCHES.KeyB = () => boire();
TOUCHES.KeyI = () => ouvrirPoche();
TOUCHES.KeyG = () => mangerGaufre();

// =====================================================================
//  L'affichage
// =====================================================================
/** La ligne que les niveaux ajoutent à leur `counts()`. */
export function ligneHUD() {
  if (!aBourse()) return '';
  const g = gourdes();
  const pleines = fioles().length;
  const gourde = g ? ` &nbsp; Gourdes ${'●'.repeat(pleines)}${'○'.repeat(Math.max(0, g - pleines))}` : '';
  const fl = state.bow ? ` &nbsp; Flèches <b>${fleches()}</b><small>/${carquois()}</small>` : '';
  const g2 = compter('gaufre');
  // les touches (G, B) ne se répètent plus ici : l'aide de droite les montre quand elles servent
  const gauf = g2 ? ` &nbsp; Gaufres <b>${g2}</b>` : '';
  return `<br>Écus <b>${solde()}</b>${fl}${gourde}${gauf}`;
}

// Le gain qui s'élève à l'endroit où il a été gagné : on projette le point du monde sur
// l'écran, et une étiquette monte de 40 px en une seconde. Sans point, elle part du coin
// du compteur.
let couche = null;
function flotter(texte, pos = null, couleur = '#ffe7a3') {
  if (!couche) {
    couche = document.createElement('div');
    couche.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:4; overflow:hidden;';
    document.body.appendChild(couche);
  }
  const el = document.createElement('div');
  let x = 24, y = 120;
  if (pos && camera) {
    const v = pos.clone().project(camera);
    x = (v.x * 0.5 + 0.5) * window.innerWidth;
    y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    if (v.z > 1) { x = 24; y = 120; }                 // derrière la caméra : on rabat au coin
  }
  el.textContent = texte;
  el.style.cssText = `position:absolute; left:${x}px; top:${y}px; transform:translate(-50%,-50%);
    font-family:"Trebuchet MS",sans-serif; font-weight:bold; font-size:22px; color:${couleur};
    text-shadow:0 2px 4px rgba(0,0,0,.85); transition:transform 1s ease-out, opacity 1s ease-out;`;
  couche.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-50%) translateY(-42px)'; el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 1100);
}

// =====================================================================
//  Les boutiques
// =====================================================================
/**
 * Ouvre un menu d'achat. `articles` : [{ label, prix, acheter(), dispo?(), indispo? }].
 * `dispo()` faux grise la ligne ; `indispo` dit pourquoi (« déjà à toi » par défaut).
 * Le menu se reconstruit après chaque achat pour que le solde et les stocks suivent.
 */
export function boutique(titre, sous, intro, articles, onFin = null) {
  const dessiner = () => {
    const items = articles.map((a) => {
      const dispo = !a.dispo || a.dispo();
      const payable = peutPayer(a.prix);
      const etat = !dispo ? ` — ${a.indispo || 'déjà à toi'}` : (payable ? '' : ' — trop cher');
      return {
        label: `${a.label} · ${a.prix} écus${etat}`,
        fn: () => {
          if (!dispo) { showMessage('Tu l’as déjà.', 2); return dessiner(); }
          if (!payable) { showMessage(`Il te manque ${a.prix - solde()} écus.`, 2.5); return dessiner(); }
          payer(a.prix);
          a.acheter();
          saveGame(true);
          dessiner();
        },
      };
    });
    items.push({ label: 'Ne rien acheter', fn: () => { hideMenu(); resumeGame(); if (onFin) onFin(); } });
    const bourse = aBourse() ? `Bourse : ${solde()} écus.` : 'Tu n’as pas encore de bourse.';
    const gourde = gourdes() ? ` Gourdes : ${fioles().length}/${gourdes()} pleines.` : '';
    showMenu(titre, sous, `${intro}\n\n${bourse}${gourde}`, items);
  };
  state.paused = true;
  dessiner();
}

// =====================================================================
//  La poche
// =====================================================================
// Trois zones, comme dans la spécification (REPONSE-EQUIPEMENT.md, § 4) : les armes et
// l'outil (qu'on a ou qu'on n'a pas, rien à gérer), les objets (6 places, 12 au plus,
// achetées chez le colporteur), les gourdes. Les objets de quête n'y vont pas : ils restent
// au journal, sinon la poche se remplirait de ce qu'on n'a pas le droit de jeter.
export const OBJETS = {
  gaufre: {
    nom: 'Gaufre de chez Méert', pile: 3, couleur: '#e8b860',
    effet: 'rend deux cœurs',
    utiliser: () => {
      if (player.hp >= player.maxHp) { showMessage('Tu n’as pas faim : garde-la pour plus tard.', 2); return false; }
      player.hp = Math.min(player.maxHp, player.hp + 4);
      burst(player.pos.x, player.pos.y + 1.4, player.pos.z, 0xe8b860, 12, 2.5, 0.7, 2, 1);
      showMessage('Une gaufre de chez Méert : deux cœurs.', 2);
      return true;
    },
  },
};
export const PLACES_DEPART = 6, PLACES_MAX = 12;

export function poche() {
  if (!state.poche || typeof state.poche !== 'object') state.poche = { places: PLACES_DEPART, objets: [] };
  if (!Array.isArray(state.poche.objets)) state.poche.objets = [];
  state.poche.objets = state.poche.objets.filter((o) => o && OBJETS[o.id] && o.n > 0);
  return state.poche;
}
export const compter = (id) => poche().objets.filter((o) => o.id === id).reduce((t, o) => t + o.n, 0);

/** Range un objet : d'abord sur une pile entamée, sinon dans une place libre. */
export function ranger(id, n = 1) {
  const P = poche(), def = OBJETS[id];
  let reste = n;
  for (const o of P.objets) if (o.id === id && o.n < def.pile && reste > 0) { const k = Math.min(reste, def.pile - o.n); o.n += k; reste -= k; }
  while (reste > 0 && P.objets.length < P.places) { const k = Math.min(reste, def.pile); P.objets.push({ id, n: k }); reste -= k; }
  return n - reste;
}
function retirer(id, n = 1) {
  const P = poche();
  for (let i = P.objets.length - 1; i >= 0 && n > 0; i--) {
    const o = P.objets[i]; if (o.id !== id) continue;
    const k = Math.min(n, o.n); o.n -= k; n -= k;
    if (!o.n) P.objets.splice(i, 1);
  }
}

// Le moteur demande, au ramassage d'une gaufre en pleine santé, si on peut la ranger
CROCHETS.gaufre = () => {
  if (!ranger('gaufre')) return false;
  showMessage(`Une gaufre dans la poche (${compter('gaufre')}). G pour la manger quand tu en auras besoin.`, 2.5);
  return true;
};

export function mangerGaufre() {
  if (!compter('gaufre')) { showMessage('Pas de gaufre dans ta poche.', 2); return false; }
  if (!OBJETS.gaufre.utiliser()) return false;
  retirer('gaufre'); SFX.pickup(); saveGame(true);
  return true;
}

// ---------- l'écran de la poche ----------
let ecranPoche = null, selPoche = 0;
function cellules() {
  const P = poche(), c = [];
  for (let i = 0; i < P.places; i++) c.push({ zone: 'objets', i, o: P.objets[i] || null });
  for (let i = 0; i < gourdes(); i++) c.push({ zone: 'gourdes', i, f: fioles()[i] || null });
  return c;
}
function peindrePoche() {
  if (!ecranPoche) return;
  const P = poche(), C = cellules();
  selPoche = Math.max(0, Math.min(selPoche, C.length - 1));
  const case_ = (html, sel, titre) => `<div title="${titre}" style="width:74px;height:74px;border-radius:10px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:2px;font-size:12px;text-align:center;
    background:${sel ? 'rgba(255,231,163,.22)' : 'rgba(255,255,255,.05)'};border:1px solid ${sel ? '#ffe7a3' : 'rgba(255,231,163,.18)'}">${html}</div>`;
  const armes = [
    state.sword ? case_('<b style="font-size:22px">⚔</b>Épée', false, 'épée de Lydéric') : '',
    state.bow ? case_(`<b style="font-size:22px">➶</b>Arc<small>${fleches()}/${carquois()} flèches</small>`, false, 'arc de la garnison') : '',
    state.faux ? case_('<b style="font-size:22px">⚒</b>Faux<small>d’Émile</small>', false, 'faux d’Émile : on fauche plus large') : '',
  ].filter(Boolean).join('') || '<div style="opacity:.6;font-size:13px">Rien encore.</div>';
  let k = 0;
  const objets = C.filter((c) => c.zone === 'objets').map((c) => {
    const sel = k++ === selPoche, d = c.o && OBJETS[c.o.id];
    return case_(d ? `<b style="font-size:24px;color:${d.couleur}">▦</b>${d.nom.split(' ')[0]}<small>×${c.o.n}</small>` : '<span style="opacity:.3">—</span>', sel, d ? d.nom : 'place libre');
  }).join('');
  const gourdesH = C.filter((c) => c.zone === 'gourdes').map((c) => {
    const sel = k++ === selPoche, p = c.f && POTIONS[c.f];
    return case_(p ? `<b style="font-size:24px;color:#${p.couleur.toString(16).padStart(6, '0')}">●</b>${p.nom.split(' ')[0]}` : '<b style="font-size:24px;opacity:.4">○</b>vide', sel, p ? p.nom : 'gourde vide');
  }).join('') || '<div style="opacity:.6;font-size:13px">Pas de gourde — le vieux mage en vend une, le colporteur deux autres.</div>';
  const cs = C[selPoche];
  let detail = '';
  if (cs && cs.zone === 'objets' && cs.o) { const d = OBJETS[cs.o.id]; detail = `<b>${d.nom}</b> — ${d.effet}. <b>Entrée</b> l’utiliser · <b>Suppr</b> en jeter une`; }
  else if (cs && cs.zone === 'gourdes' && cs.f) { const pp = POTIONS[cs.f]; detail = `<b>${pp.nom}</b> — ${pp.effet}. <b>Entrée</b> la boire`; }
  else detail = 'Une place libre.';
  ecranPoche.innerHTML = `
    <div style="font-size:22px;letter-spacing:3px;color:#ffe7a3;font-weight:bold">LA POCHE DE CAMILLE</div>
    <div style="font-size:13px;color:#9aa4bd;margin:4px 0 16px">Flèches pour choisir · Entrée utiliser · Suppr jeter · I ou Échap refermer
      &nbsp;·&nbsp; Écus <b style="color:#ffe7a3">${aBourse() ? solde() : '—'}</b></div>
    <div style="font-size:12px;letter-spacing:1.5px;color:#9aa4bd;margin-bottom:6px">ARMES ET OUTIL</div>
    <div style="display:flex;gap:8px;margin-bottom:16px">${armes}</div>
    <div style="font-size:12px;letter-spacing:1.5px;color:#9aa4bd;margin-bottom:6px">OBJETS (${P.objets.length}/${P.places})</div>
    <div style="display:grid;grid-template-columns:repeat(6,74px);gap:8px;margin-bottom:16px">${objets}</div>
    <div style="font-size:12px;letter-spacing:1.5px;color:#9aa4bd;margin-bottom:6px">GOURDES</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">${gourdesH}</div>
    <div style="font-size:14px;min-height:20px">${detail}</div>`;
}
function clavierPoche(e) {
  if (!ecranPoche) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const n = cellules().length, nObj = poche().places;
  if (e.code === 'Escape' || e.code === 'KeyI') { fermerPoche(); return; }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') selPoche = (selPoche + 1) % n;
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') selPoche = (selPoche + n - 1) % n;
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') selPoche = selPoche < nObj ? Math.min(n - 1, selPoche + 6) : selPoche;
  else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyZ') selPoche = selPoche >= 6 ? selPoche - 6 : selPoche;
  else if (e.code === 'Enter' || e.code === 'Space') {
    const c = cellules()[selPoche];
    if (c && c.zone === 'objets' && c.o && OBJETS[c.o.id].utiliser()) { retirer(c.o.id); SFX.pickup(); saveGame(true); }
    else if (c && c.zone === 'gourdes' && c.f) {
      const f = fioles(); f.splice(c.i, 1); POTIONS[c.f].boire(); SFX.pickup(); saveGame(true);
    }
  } else if (e.code === 'Delete' || e.code === 'Backspace') {
    const c = cellules()[selPoche];
    // on la pose deux mètres devant soi : jetée, elle reste au monde, on peut la reprendre
    if (c && c.zone === 'objets' && c.o) {
      retirer(c.o.id);
      if (c.o.id === 'gaufre') spawnGaufre(player.pos.x + Math.sin(player.yaw) * 2.2, player.pos.z + Math.cos(player.yaw) * 2.2);
      saveGame(true);
    }
  }
  peindrePoche();
}
export function ouvrirPoche() {
  if (ecranPoche) return;
  state.paused = true;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  ecranPoche = document.createElement('div');
  ecranPoche.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;width:min(560px,94vw);
    max-height:92vh;overflow:auto;padding:20px 24px;border-radius:14px;color:#e8ecf6;font-family:"Trebuchet MS",sans-serif;
    background:linear-gradient(180deg,rgba(12,17,33,.97),rgba(8,11,22,.99));border:1px solid rgba(255,231,163,.3);
    box-shadow:0 18px 50px rgba(0,0,0,.6)`;
  document.body.appendChild(ecranPoche);
  selPoche = 0;
  peindrePoche();
  window.addEventListener('keydown', clavierPoche, true);
}
export function fermerPoche() {
  if (!ecranPoche) return;
  window.removeEventListener('keydown', clavierPoche, true);
  ecranPoche.remove(); ecranPoche = null;
  state.paused = false;
}

// =====================================================================
//  Les petits coffres à écus
// =====================================================================
// Une douzaine dans le monde (remparts, bastions, beffroi, galeries, hameau) : 12 à 20
// écus chacun, ouverts une fois pour toutes (state.coffres). Les niveaux les posent par
// `petitCoffre()` ; le coffre ouvert au chargement se montre ouvert.
// Un coffre ne se cache pas DANS une caserne : les collisions ne voient que les murs, et
// l'intérieur d'un bâtiment passe pour libre. On regarde donc d'en haut — un rayon qui
// descend et doit toucher le sol, pas un toit. La végétation instanciée ne compte pas
// (un coffre sous un arbre reste un coffre qu'on trouve).
//
// UN INDEX, PAS LA SCÈNE ENTIÈRE. La première version lançait chaque rayon sur toute la
// scène, triangle par triangle : la recherche des coffres de bastion en tirait des
// centaines, et le chargement y perdait QUATRE SECONDES (mesuré au profileur). On range
// donc une fois les maillages dans une grille de 16 m par leur sphère englobante ; un
// rayon ne teste plus que les quelques objets au-dessus du point.
const _rayon = new THREE.Raycaster(), _haut = new THREE.Vector3(), _bas = new THREE.Vector3(0, -1, 0);
const CASE_CIEL = 16;
let indexCiel = null, indexCielT = -1e9;
function casesCiel() {
  // l'index vaut pour une salve de requêtes (le peuplement d'un niveau) ; au-delà de trois
  // secondes on le refait, la scène a pu changer
  if (indexCiel && performance.now() - indexCielT < 3000) return indexCiel;
  scene.updateMatrixWorld();
  const g = new Map(), sph = new THREE.Sphere();
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite || !o.visible || !o.geometry) return;
    if (o.material && o.material.transparent) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
    if (!Number.isFinite(sph.radius) || sph.radius > 400) return;      // le ciel, pas un toit
    const i0 = Math.floor((sph.center.x - sph.radius) / CASE_CIEL), i1 = Math.floor((sph.center.x + sph.radius) / CASE_CIEL);
    const j0 = Math.floor((sph.center.z - sph.radius) / CASE_CIEL), j1 = Math.floor((sph.center.z + sph.radius) / CASE_CIEL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i * 100003 + j; let l = g.get(k); if (!l) g.set(k, l = []); l.push(o);
    }
  });
  indexCiel = g; indexCielT = performance.now();
  return g;
}
export function aCielOuvert(x, y, z) {
  const l = casesCiel().get(Math.floor(x / CASE_CIEL) * 100003 + Math.floor(z / CASE_CIEL));
  if (!l) return true;
  _rayon.camera = camera; _rayon.far = 80;
  _rayon.set(_haut.set(x, y + 40, z), _bas);
  const h = _rayon.intersectObjects(l, false)
    .find((i) => !(i.object.material && i.object.material.transparent));
  return !h || h.point.y < y + 0.6;
}

export function petitCoffre(id, x, y, z, montant, rotY = 0, echelle = 0.6) {
  const g = makeChest();
  g.position.set(x, y, z); g.rotation.y = rotY; g.scale.setScalar(echelle);
  scene.add(g);
  const ouvert = () => !!(state.coffres && state.coffres[id]);
  if (ouvert()) g.userData.lid.rotation.x = -1.9;
  addCap(x, z, x, z, 0.55 * echelle / 0.6, y + 0.9 * echelle / 0.6);
  addInteract({
    pos: new THREE.Vector3(x, y, z), r: 1.9, enabled: () => !ouvert(),
    prompt: () => 'ouvrir le petit coffre',
    fn: () => {
      state.coffres = { ...(state.coffres || {}), [id]: true };
      // le couvercle s'ouvre en un tiers de seconde, la lueur monte et retombe
      let t = 0; const lid = g.userData.lid, glow = g.userData.glow;
      const iv = setInterval(() => { t += 0.05; lid.rotation.x = -1.9 * Math.min(1, t / 0.35); glow.intensity = 3 * Math.max(0, 1 - Math.abs(t - 0.4) / 0.6); if (t > 1.1) clearInterval(iv); }, 50);
      burst(x, y + 0.8, z, 0xffe070, 20, 3, 1, 2, 1.1);
      const eu = gagner(montant, new THREE.Vector3(x, y + 1.2, z));
      showMessage(aBourse() ? `Un petit coffre : ${eu} écus.` : 'Un petit coffre plein d’écus… que tu ne peux pas emporter sans ta bourse.', 3);
      if (!aBourse()) state.coffres[id] = false;          // il reste plein, on reviendra
      saveGame(true);
    },
  });
  return g;
}

// =====================================================================
//  Le colporteur
// =====================================================================
// Il vend ce qui ne se mérite pas (§ 4 de la spécification) : de la place, des gourdes,
// des flèches, et le dernier réceptacle de cœur. Les atouts, eux, ne s'achètent pas.
export function colporteur(onFin = null) {
  const P = () => poche();
  const prixPlaces = () => [60, 120, 240][(P().places - PLACES_DEPART) / 2] ?? 0;
  boutique('Le colporteur', 'Sous les arcades du marché',
    '« De la place dans la poche, des gourdes, des flèches… et un cœur, pour qui a de quoi. »',
    [
      { label: '+2 places dans la poche', get prix() { return prixPlaces(); },
        dispo: () => P().places < PLACES_MAX, indispo: 'la poche est au plus grand',
        acheter: () => { P().places += 2; showMessage(`Ta poche compte ${P().places} places.`, 3); } },
      { label: 'Une gourde de plus', get prix() { return gourdes() >= 2 ? 160 : 80; },
        dispo: () => gourdes() >= 1 && gourdes() < 3, indispo: gourdes() < 1 ? 'la première se prend chez le mage' : 'trois, c’est le plus',
        acheter: () => { ajouterGourde(); showMessage(`${gourdes()} gourdes à la ceinture. Le mage les remplit.`, 3); } },
      { label: 'Dix flèches', prix: 8,
        dispo: () => state.bow && fleches() < carquois(), indispo: state.bow ? 'carquois plein' : 'il te faut un arc',
        acheter: () => { const r = rendreFleches(10); showMessage(`+${r} flèches (${fleches()}/${carquois()}).`, 2.5); } },
      { label: 'Un carquois plus grand', get prix() { return carquois() >= 40 ? 100 : 50; },
        dispo: () => state.bow && carquois() < 60, indispo: state.bow ? 'le plus grand est à toi' : 'il te faut un arc',
        acheter: () => { state.carquois = carquois() + 20; rendreFleches(20); showMessage(`Un carquois de ${carquois()} flèches, rempli.`, 3); } },
      { label: 'Un réceptacle de cœur', prix: 250,
        dispo: () => !state.coeurColporteur, indispo: 'il n’en avait qu’un',
        acheter: () => { state.coeurColporteur = true; player.maxHp += 2; player.hp = player.maxHp; SFX.win(); showMessage('Un RÉCEPTACLE DE CŒUR : un cœur de plus, et toute ta vie.', 4); } },
    ], onFin);
}
