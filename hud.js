// hud.js — ce que le joueur lit à l'écran.
//
// Secteur Quêtes : minimap, compteurs de progression, menu titre.
import * as E from './engine.js?v=27';
import {
  THREE, TAU, addLieu, enemies, estDecouvert, hasSave, hideMenu, lieux, minimapDots, showMenu,
  startGame, state,
} from './engine.js?v=27';
import {
  APO, DEHORS, ENCEINTE, HOUSE, LILLE, PLAINE_R, PONTS, PONT_Z1, TRACE, bastions,
} from './carte.js';
import { PARTAGE } from './etat.js';
import { KILLS_TO_OPEN, killsDone, objective } from './quetes.js';
import * as BOURSE from './bourse.js';
import './atlas.js';        // la carte du beffroi : installe la touche M
import * as LOOK from './look.js';
LOOK.veiller();

// =====================================================================
//  La carte
// =====================================================================
// Deux changements de principe.
//
// 1. C'EST LA CARTE QUI BOUGE, pas le curseur. Camille reste au centre et le fond défile
//    sous elle : on voit toujours autant de terrain autour de soi, où qu'on soit. Avant,
//    le monde entier tenait dans le disque et le point se promenait dedans — à 1 275 m de
//    rayon, ça ne montrait plus rien d'utile.
//
// 2. LA CARTE EST DESSINÉE DEPUIS LE RELEVÉ, pas depuis des formes écrites à la main.
//    L'ancienne version traçait des pentagones décalés de MOAT_IN / MOAT_OUT, hérités
//    d'une carte qui n'existe plus. Ici : l'eau, les bois, la voirie, les ponts et le bâti
//    viennent de LILLE et de TRACE — ce que la carte montre est ce que le jeu construit.
//
// Le fond est peint UNE FOIS dans un canvas hors écran (plusieurs centaines de polygones,
// impensable à chaque image) ; chaque image ne fait qu'y découper une fenêtre.

export const CARTE_PX = 0.7;          // px par mètre sur le canvas hors écran
const PORTEE = 240;            // rayon de terrain montré autour de Camille, en mètres

export const COUL = {
  prairie: '#5c7a41', bois: '#2c4626', eau: '#2f6f9e', route: '#b59a6c', pont: '#d8c59a',
  bati: '#a9552f', citadelle: '#8d6a55', ouvrage: '#6e7a4a', dehors: '#39402f', jardin: '#6d8b47',
  maison: '#9b4dd8',           // la maison de Camille : le seul point violet de la carte
};

let carteHors = null;

export function construireCarte() {
  if (carteHors) return carteHors;
  const R = PLAINE_R, MARGE = Math.ceil(PORTEE * CARTE_PX) + 6;
  const N = Math.ceil(2 * R * CARTE_PX) + MARGE * 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const P = (x, z) => [MARGE + (x + R) * CARTE_PX, MARGE + (z + R) * CARTE_PX];
  const trace = (pts, fermer) => { pts.forEach((q, i) => { const [a, b] = P(q[0], q[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); if (fermer !== false) g.closePath(); };
  const remplir = (pts, coul) => { g.fillStyle = coul; g.beginPath(); trace(pts); g.fill(); };
  const ligne = (pts, coul, m) => {
    g.strokeStyle = coul; g.lineWidth = Math.max(0.8, m * CARTE_PX); g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); trace(pts, false); g.stroke();
  };

  g.fillStyle = COUL.dehors; g.fillRect(0, 0, N, N);
  remplir(ENCEINTE, COUL.prairie);                       // le relevé s'arrête au rectangle

  for (const o of LILLE.parcs) remplir(o.poly, COUL.jardin);
  for (const o of LILLE.herbe) remplir(o.poly, COUL.jardin);
  for (const o of LILLE.bois) remplir(o.poly, COUL.bois);

  // l'eau : les nappes qui ceinturent la place sont percées par la place elle-même,
  // sinon le fort apparaîtrait noyé (cf. le drapeau `ceinture` dans carte.js)
  g.fillStyle = COUL.eau;
  for (const o of LILLE.eau) {
    g.beginPath(); trace(o.poly);
    if (o.ceinture && TRACE) trace(TRACE.off(-2));
    g.fill('evenodd');
  }

  for (const o of LILLE.chemins) ligne(o.pts, COUL.route, 2.4);
  for (const o of LILLE.routes) ligne(o.pts, COUL.route, o.r >= 2 ? 7 : 4.5);
  for (const P2 of PONTS) ligne(P2.pts, COUL.pont, P2.demi * 2 + 1.5);

  for (const p of LILLE.bati) remplir(p, COUL.bati);      // le bâti relevé = la ville

  // la citadelle : corps de place, bastions, ouvrages avancés
  if (TRACE) {
    remplir(TRACE.off(0), COUL.citadelle);
    g.strokeStyle = '#5e453a'; g.lineWidth = Math.max(1, 3 * CARTE_PX);
    g.beginPath(); trace(TRACE.off(0)); g.stroke();
  }
  for (const b of bastions) remplir(b.poly, COUL.citadelle);
  for (const o of DEHORS) remplir(o.poly, COUL.ouvrage);
  // le pont de la Porte Royale
  ligne([[0, APO], [0, PONT_Z1]], COUL.pont, 8);

  carteHors = { cv, MARGE, R };
  return carteHors;
}

export function minimap(g, W) {
  const c = construireCarte();
  const p = E.player.pos;
  const demi = PORTEE * CARTE_PX;
  const sx = c.MARGE + (p.x + c.R) * CARTE_PX - demi;
  const sz = c.MARGE + (p.z + c.R) * CARTE_PX - demi;
  g.save();
  g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 1, 0, TAU); g.clip();
  g.fillStyle = COUL.dehors; g.fillRect(0, 0, W, W);
  g.drawImage(c.cv, sx, sz, demi * 2, demi * 2, 0, 0, W, W);
  // LA MAISON DE CAMILLE. Un point violet, dessiné par-dessus la carte et non dedans :
  // il doit rester lisible quelle que soit la couleur du fond, et garder sa taille quand
  // la carte défile. Il se dessine même hors de la fenêtre — plaqué au bord du disque —
  // pour dire la DIRECTION de la maison quand on s'en est éloigné.
  // Un point posé sur un lieu, plaqué au bord du disque quand il sort de la fenêtre : il
  // dit alors la DIRECTION. La maison de Camille en violet ; et, quand l'histoire en donne
  // un (PARTAGE.repere : le moulin du prologue), le but du moment en or, qui pulse.
  const ech = W / (demi * 2);                      // px d'écran par px de carte
  const point = (x, z, fond, bord, r) => {
    let mx = (c.MARGE + (x + c.R) * CARTE_PX - sx) * ech - W / 2;
    let mz = (c.MARGE + (z + c.R) * CARTE_PX - sz) * ech - W / 2;
    const d = Math.hypot(mx, mz), lim = W / 2 - 7, loin = d > lim;
    if (loin) { mx = mx / d * lim; mz = mz / d * lim; }
    g.save(); g.translate(W / 2 + mx, W / 2 + mz);
    g.fillStyle = fond; g.strokeStyle = bord; g.lineWidth = 1.4;
    g.beginPath(); g.arc(0, 0, loin ? r * 0.77 : r, 0, TAU); g.fill(); g.stroke();
    if (!loin) {                                   // un liseré clair : il se détache du bâti
      g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, r + 1.8, 0, TAU); g.stroke();
    }
    g.restore();
  };
  point(HOUSE.x, HOUSE.z, COUL.maison, '#25123a', 4.4);
  // les objets du multi à prendre (tloc-multi.js : l'armure aux casernes, l'écu sur la place)
  for (const m of PARTAGE.marques || []) point(m.x, m.z, m.fond, m.bord, 4);
  if (PARTAGE.repere) point(PARTAGE.repere.x, PARTAGE.repere.z, '#ffd24a', '#5a3a00', 5 + Math.sin(performance.now() / 180) * 1.2);
  // Camille : toujours au centre, la pointe dans la direction du regard
  g.translate(W / 2, W / 2); g.rotate(-E.player.yaw);
  g.fillStyle = '#ffe7a3'; g.strokeStyle = '#2a1d10'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(0, 7); g.lineTo(-4.6, -5); g.lineTo(0, -2.4); g.lineTo(4.6, -5);
  g.closePath(); g.fill(); g.stroke();
  g.restore();
  // le nord, pour ne pas perdre le sens de la carte
  g.save();
  g.fillStyle = 'rgba(255,231,163,.75)'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center';
  g.fillText('N', W / 2, 12); g.restore();
}

export function counts() {
  const c = { fosses: 0, remparts: 0, bastions: 0 };
  for (const e of enemies) if (!e.dead && c[e.zone] !== undefined) c[e.zone]++;
  const boss = enemies.find(e => e.k.boss);
  const items = [];
  if (state.bow) items.push('Arc ✓');   // la touche est dans l'aide, à droite if (state.key) items.push('Clé du donjon ✓');
  const obj = objective();
  return `Monstres vaincus <b>${killsDone()}</b>${state.gateOpen ? '' : ` / ${KILLS_TO_OPEN}`} &nbsp; Fossés <b>${c.fosses}</b>${state.bow ? '' : ' <small>(arc requis)</small>'} &nbsp; Remparts <b>${c.remparts}</b> &nbsp; Bastions <b>${c.bastions}</b><br>` +
    (items.length ? items.join(' &nbsp; ') + ' &nbsp; ' : '') +
    `Lieux <b>${E.lieux.filter(l => E.estDecouvert(l.id)).length}</b> / ${E.lieux.length} &nbsp; ` +
    (boss ? (boss.dead ? 'Phinaert <b>vaincu</b>' : (state.gateOpen ? 'Phinaert <b>libre !</b>' : 'Phinaert <b>enfermé au donjon</b>')) : '') +
    `<br><small>Objectif : ${obj}</small>` + BOURSE.ligneHUD();
}

export function titleMenu() {
  const items = [{ label: 'Nouvelle partie', fn: () => { hideMenu(); startGame(false); } }];
  if (hasSave()) items.unshift({ label: 'Reprendre la partie', fn: () => { hideMenu(); startGame(true); } });
  // L'écran titre ne fait plus la leçon : une phrase d'histoire, le choix, et c'est tout.
  // Les touches sont en jeu, sur le côté droit, et seulement celles qui servent (engine.js).
  showMenu('THE LEGEND OF CAMILLE', 'La Citadelle de Lille',
    'Phinaert a enlevé Eugène. Camille, gardienne de la citadelle, part le délivrer.', items);
}
