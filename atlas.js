// atlas.js — la carte de la châtellenie, trouvée au sommet du beffroi.
//
// Elle ne redessine rien : `hud.js` peint déjà tout le relevé (eau, bois, voirie, ponts,
// bâti, citadelle, ouvrages) dans un canvas hors écran pour la minimap. On en découpe
// ici une vue plein écran, on y pose les lieux répertoriés — ceux que le jeu connaît
// déjà par `addLieu()` — et Camille par-dessus.
//
// La touche M :
//   — sans la carte, elle garde son rôle d'origine (couper la musique) ;
//   — la carte en poche, M l'ouvre et Maj+M coupe toujours la musique.
// Le tout se greffe par un guetteur de touche en phase de capture, sans toucher au
// clavier du moteur. Quand `engine.js` se libérera, une ligne dans son keydown suffira.

import * as HUD from './hud.js';
import { ENCEINTE } from './carte.js';
import {
  SFX, THREE, cut, estDecouvert, hideMenu, lieux, menu, player, resumeGame, saveGame,
  showMenu, showMessage, state,
} from './engine.js?v=27';

export const aLaCarte = () => !!state.carteBeffroi;

// =====================================================================
//  L'énigme du guetteur
// =====================================================================
// Trois devinettes, une par partie : tirée une fois, elle ne change plus — sinon il
// suffirait de ressortir et de rentrer pour tomber sur une question plus facile.
const DEVINETTES = [
  {
    q: 'Cinq pointes, et pourtant je ne suis pas une étoile ; on m’a plantée dans les marais pour que la ville dorme tranquille. Que suis-je ?',
    r: ['La citadelle de Vauban', 'La rose des vents', 'La main de Lydéric'], bonne: 0,
    apres: 'Le guetteur avait raison : d’ici, on voit le pentagone comme sur un plan.',
  },
  {
    q: 'Je sonne sans voix, je veille sans yeux, et je compte les heures depuis plus longtemps que toi. Qui suis-je ?',
    r: ['Le vent des Flandres', 'La cloche du beffroi', 'Le géant Phinaert'], bonne: 1,
    apres: 'La cloche, au-dessus de ta tête, semble approuver.',
  },
  {
    q: 'Je traverse la ville sans jamais marcher, les ponts me passent dessus et les moulins me boivent. Qui suis-je ?',
    r: ['La Deûle', 'La route de Dunkerque', 'La brume du matin'], bonne: 0,
    apres: 'L’eau brille au nord : elle t’a donné la réponse avant lui.',
  },
];

function devinette() {
  if (typeof state.enigmeBeffroi !== 'number') {
    state.enigmeBeffroi = Math.floor(Math.random() * DEVINETTES.length);
  }
  return DEVINETTES[state.enigmeBeffroi];
}

/** L'énigme du sommet du beffroi. À appeler depuis l'interaction, là-haut. */
export function enigme() {
  if (aLaCarte()) {
    showMessage('Tu as déjà la carte du guetteur. Appuie sur M pour l’ouvrir.', 4);
    return;
  }
  const d = devinette();
  state.paused = true;
  const items = d.r.map((texte, i) => ({
    label: texte,
    fn: () => {
      hideMenu(); resumeGame();
      if (i !== d.bonne) { SFX.hurt(); showMessage('« Non. Regarde mieux, et reviens me voir. »', 4); return; }
      state.carteBeffroi = true;
      SFX.win();
      showMessage(`${d.apres} La CARTE DE LA CHÂTELLENIE est à toi : appuie sur M pour l’ouvrir.`, 8);
      saveGame(true);
    },
  }));
  items.push({ label: 'Redescendre sans répondre', fn: () => { hideMenu(); resumeGame(); } });
  showMenu('LA DEVINETTE DU GUETTEUR', 'Au sommet du beffroi',
    `Un coffret de bois est posé sur le rebord, fermé par une planchette gravée.\n\n« ${d.q} »`, items);
}

// =====================================================================
//  La carte plein écran
// =====================================================================
const MARQUE = {                              // de quoi on parle, et comment on le dessine
  // LA MAISON DE CAMILLE, du même violet que sur la minimap (`COUL.maison` dans hud.js) :
  // une seule couleur pour les deux cartes, sinon on cherche un point violet sur la
  // grande carte alors qu'il y est peint en doré comme tout le reste.
  // La valeur est recopiée et non importée : atlas.js et hud.js s'importent l'un l'autre,
  // et lire `HUD.COUL` pendant l'évaluation du module tombe dans la zone morte du const.
  donjon: '#c0392b', poterne: '#8a6a3a', maison: '#9b4dd8', village: '#e0b358',
  estaminet: '#d08a3a', moulin: '#9ad44a', place: '#c9953f', chapelle: '#c9c2b4',
  mage: '#7ad04a', beffroi: '#e8c883',
};
const couleurLieu = (id) => MARQUE[id] || (id.startsWith('caserne') ? '#8d6a55' : '#e0b358');

let ecran = null, cv = null, ctx = null;
const vue = { zoom: 0.55, cx: 0, cz: 0, suivre: true };   // zoom : pixels d'écran par pixel de carte
// Choisir où apparaître : la même carte, où un clic pose un point au lieu de rien faire.
// `valider(x, z)` dit si l'endroit est praticable (et le recale au besoin) ; `fin` rend la
// main à l'appelant avec le point retenu, ou null si le joueur refuse de choisir.
let choix = null;               // { valider, fin, point, refus, rdv }

function fermer() {
  if (!ecran) return;
  window.removeEventListener('resize', redimensionner);
  ecran.remove(); ecran = null; cv = null; ctx = null;
  state.paused = false;
  if (choix) { const c = choix; choix = null; c.fin(c.retenu || null); }
}

function redimensionner() {
  if (!cv) return;
  const d = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.floor(window.innerWidth * d); cv.height = Math.floor(window.innerHeight * d);
  cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
  ctx.setTransform(d, 0, 0, d, 0, 0);
  peindre();
}

function peindre() {
  if (!ctx) return;
  const c = HUD.construireCarte();
  const W = window.innerWidth, H = window.innerHeight;
  const PX = HUD.CARTE_PX;
  if (vue.suivre) { vue.cx = player.pos.x; vue.cz = player.pos.z; }
  // monde -> écran
  const k = vue.zoom;
  const ax = (x) => W / 2 + (x - vue.cx) * PX * k;
  const az = (z) => H / 2 + (z - vue.cz) * PX * k;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);

  // le fond : le canvas hors écran, découpé et mis à l'échelle. Le relevé est un rectangle
  // penché (ENCEINTE, dans carte.js) posé dans un carré : on ne montre que lui, et le cadre
  // en suit le bord — encadrer le carré laissait une carte de travers flotter dans un fond
  // olive qui n'est pas de la carte.
  const x0 = ax(-c.R), z0 = az(-c.R), taille = 2 * c.R * PX * k;
  const contour = () => { ctx.beginPath(); ENCEINTE.forEach(([x, z], i) => (i ? ctx.lineTo(ax(x), az(z)) : ctx.moveTo(ax(x), az(z)))); ctx.closePath(); };
  ctx.save();
  contour(); ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c.cv, c.MARGE, c.MARGE, 2 * c.R * PX, 2 * c.R * PX, x0, z0, taille, taille);
  ctx.restore();

  // cadre parcheminé, au bord du relevé
  contour();
  ctx.strokeStyle = 'rgba(255,231,163,.55)'; ctx.lineWidth = 2; ctx.stroke();

  // les lieux répertoriés
  // ÉTIQUETTES SANS CHEVAUCHEMENT. Chacune était posée 14 px au-dessus de son point, sans
  // regarder ses voisines : au bourg, le village, l'estaminet, le beffroi et la chapelle
  // tiennent dans trente mètres, et leurs quatre noms s'écrivaient les uns sur les autres.
  // Les points d'abord, tous ; puis les noms par ordre d'importance, chacun essayant huit
  // places autour de son point — la première libre gagne. Un nom qui ne trouve pas de
  // place n'est pas écrit : il revient en zoomant. Et « Les casernes », trois fois côte à
  // côte, ne s'écrit qu'une fois.
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const IMPORTANCE = { maison: 0, village: 1, beffroi: 2, donjon: 2, place: 3, chapelle: 4, estaminet: 4, moulin: 4, mage: 4, poterne: 5 };
  const pts = [];
  for (const l of lieux) {
    const x = ax(l.x), y = az(l.z);
    if (x < -80 || x > W + 80 || y < -40 || y > H + 40) continue;
    // sa propre maison, Camille la connaît : elle n'a pas à la « découvrir »
    const vu = estDecouvert(l.id) || l.id === 'maison';
    pts.push({ l, x, y, vu, rang: (vu ? 0 : 10) + (IMPORTANCE[l.id] ?? (l.id.startsWith('caserne') ? 6 : 5)) });
  }
  for (const p of pts) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.vu ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = p.vu ? couleurLieu(p.l.id) : 'rgba(180,190,210,.5)'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(10,14,30,.85)'; ctx.stroke();
  }
  const pris = pts.map((p) => [p.x - 7, p.y - 7, p.x + 7, p.y + 7]);      // les points eux-mêmes
  const ecrits = [];
  const libre = (r) => pris.every((q) => r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]);
  pts.sort((a, b) => a.rang - b.rang);
  for (const p of pts) {
    const nom = p.l.nom.charAt(0).toUpperCase() + p.l.nom.slice(1);
    if (ecrits.some((e) => e.nom === nom && Math.hypot(e.x - p.x, e.y - p.y) < 160)) continue;
    ctx.font = (p.vu ? 'bold ' : '') + '13px "Trebuchet MS", sans-serif';
    const w = ctx.measureText(nom).width, h = 15;
    const places = [[0, -15], [0, 16], [w / 2 + 11, 0], [-w / 2 - 11, 0], [w / 2 + 6, -13], [-w / 2 - 6, -13], [w / 2 + 6, 14], [-w / 2 - 6, 14]];
    for (const [dx, dy] of places) {
      const cx = p.x + dx, cy = p.y + dy, r = [cx - w / 2 - 2, cy - h / 2, cx + w / 2 + 2, cy + h / 2];
      if (!libre(r)) continue;
      pris.push(r); ecrits.push({ nom, x: p.x, y: p.y });
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(8,11,22,.9)'; ctx.strokeText(nom, cx, cy);
      ctx.fillStyle = p.vu ? '#ffe7a3' : 'rgba(210,216,230,.75)'; ctx.fillText(nom, cx, cy);
      break;
    }
  }

  // le rendez-vous posé par l'hôte : une étoile, toujours visible, même quand on a
  // cliqué ailleurs — c'est un repère, pas seulement une proposition
  if (choix && choix.rdv) {
    const qx = ax(choix.rdv.x), qy = az(choix.rdv.z);
    ctx.save(); ctx.translate(qx, qy); ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = '#ffd24a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#2a1d10'; ctx.stroke(); ctx.restore();
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(8,11,22,.9)'; ctx.strokeText('Rendez-vous', qx, qy + 26);
    ctx.fillStyle = '#ffd24a'; ctx.fillText('Rendez-vous', qx, qy + 26);
  }
  // le point d'apparition proposé, ou le refus du dernier clic
  if (choix && choix.point) {
    const qx = ax(choix.point.x), qy = az(choix.point.z);
    ctx.beginPath(); ctx.arc(qx, qy, 11, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffe7a3'; ctx.stroke();
    ctx.beginPath(); ctx.arc(qx, qy, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffe7a3'; ctx.fill();
  }
  if (choix && choix.refus) {
    const qx = ax(choix.refus.x), qy = az(choix.refus.z);
    ctx.strokeStyle = '#ff7b6b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(qx - 7, qy - 7); ctx.lineTo(qx + 7, qy + 7);
    ctx.moveTo(qx + 7, qy - 7); ctx.lineTo(qx - 7, qy + 7); ctx.stroke();
  }

  // Camille, et son regard
  const px = ax(player.pos.x), pz = az(player.pos.z);
  ctx.save(); ctx.translate(px, pz); ctx.rotate(-player.yaw);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a1d10'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-6.5, -7); ctx.lineTo(0, -3.4); ctx.lineTo(6.5, -7);
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();

  // l'échelle, mesurée sur le terrain
  // en bas à droite : en bas à gauche, le bouton « Accueil » du multi passait dessus
  const metres = 200, longueur = metres * PX * k;
  const bx = W - 28 - longueur, by = H - 30;
  ctx.strokeStyle = '#ffe7a3'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + longueur, by);
  ctx.moveTo(bx, by - 5); ctx.lineTo(bx, by + 5);
  ctx.moveTo(bx + longueur, by - 5); ctx.lineTo(bx + longueur, by + 5); ctx.stroke();
  ctx.font = '13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe7a3'; ctx.fillText(metres + ' m', bx, by - 14);

  // le nord
  ctx.textAlign = 'center'; ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.fillStyle = 'rgba(255,231,163,.85)'; ctx.fillText('N', W - 40, 34);
  ctx.beginPath(); ctx.moveTo(W - 40, 44); ctx.lineTo(W - 44, 58); ctx.lineTo(W - 36, 58);
  ctx.closePath(); ctx.fill();
}

function ouvrir() {
  if (ecran) { fermer(); return; }
  state.paused = true;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  vue.suivre = true; vue.zoom = 0.55;

  ecran = document.createElement('div');
  ecran.style.cssText = 'position:fixed; inset:0; z-index:8; background:#0b1020; cursor:grab;';
  cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute; inset:0;';
  ctx = cv.getContext('2d');
  ecran.appendChild(cv);

  const bandeau = document.createElement('div');
  bandeau.style.cssText = `position:absolute; left:0; right:0; top:0; padding:14px 20px; pointer-events:none;
    font-family:"Trebuchet MS",sans-serif; color:#ffe7a3; text-shadow:0 2px 6px rgba(0,0,0,.9);
    background:linear-gradient(180deg, rgba(8,11,22,.85), rgba(8,11,22,0));`;
  bandeau.innerHTML = choix
    ? `<div style="font-size:20px; letter-spacing:3px; font-weight:bold">OÙ VEUX-TU APPARAÎTRE ?</div>
    <div style="font-size:13px; color:#c9d2e6; margin-top:3px">
      <b>Clique</b> un endroit de la carte &nbsp;·&nbsp; glisser ou <b>flèches</b> : se déplacer &nbsp; molette : zoom
      &nbsp; <b>Entrée</b> valider &nbsp; <b>Échap</b> rester où tu es</div>
    <div id="choixTLOC" style="font-size:14px; margin-top:8px; min-height:18px"></div>`
    : `<div style="font-size:20px; letter-spacing:3px; font-weight:bold">CARTE DE LA CHÂTELLENIE</div>
    <div style="font-size:13px; color:#c9d2e6; margin-top:3px">
      Relevée au sommet du beffroi &nbsp;·&nbsp; <b>flèches</b> déplacer &nbsp; <b>+ −</b> ou molette : zoom
      &nbsp; <b>C</b> recentrer sur Camille &nbsp; <b>M</b> ou <b>Échap</b> refermer</div>`;
  ecran.appendChild(bandeau);
  if (choix) {
    // le bouton vit dans le bandeau, qui laisse passer la souris partout ailleurs
    const ok = document.createElement('button');
    ok.textContent = 'Apparaître ici';
    ok.disabled = true;
    ok.style.cssText = `position:absolute; right:20px; top:16px; pointer-events:auto; font:inherit;
      font-size:15px; font-weight:bold; padding:9px 18px; border-radius:9px; cursor:pointer;
      border:1px solid #e8c883; background:linear-gradient(180deg,#e0b358,#c9953f); color:#2a1d10;`;
    ok.onmousedown = (e) => e.stopPropagation();
    ok.onclick = (e) => { e.stopPropagation(); valider(); };
    ok.id = 'okTLOC';
    ecran.appendChild(ok);
  }

  document.body.appendChild(ecran);
  redimensionner();
  window.addEventListener('resize', redimensionner);

  // se promener sur la carte à la souris
  // un clic sans glisser, en mode choix, désigne un endroit : on retient d'où part le
  // geste, et on ne le traite comme un clic que s'il n'a presque pas bougé
  let tire = null, depart = null;
  ecran.addEventListener('mousedown', (e) => { tire = { x: e.clientX, y: e.clientY }; depart = { ...tire }; vue.suivre = false; ecran.style.cursor = 'grabbing'; });
  window.addEventListener('mouseup', (e) => {
    if (choix && depart && ecran && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < 5) designer(e.clientX, e.clientY);
    tire = null; depart = null; if (ecran) ecran.style.cursor = 'grab';
  });
  ecran.addEventListener('mousemove', (e) => {
    if (!tire) return;
    const k = HUD.CARTE_PX * vue.zoom;
    vue.cx -= (e.clientX - tire.x) / k; vue.cz -= (e.clientY - tire.y) / k;
    tire = { x: e.clientX, y: e.clientY };
    peindre();
  });
  ecran.addEventListener('wheel', (e) => { e.preventDefault(); zoomer(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
}

// écran -> monde, l'inverse exact de `ax`/`az` dans peindre()
function designer(sx, sy) {
  const k = HUD.CARTE_PX * vue.zoom;
  const x = vue.cx + (sx - window.innerWidth / 2) / k, z = vue.cz + (sy - window.innerHeight / 2) / k;
  const p = choix.valider(x, z);
  const el = ecran.querySelector('#choixTLOC'), ok = ecran.querySelector('#okTLOC');
  if (p) {
    choix.point = p; choix.refus = null;
    el.innerHTML = `<span style="color:#ffe7a3">${p.nom ? 'Près de : <b>' + p.nom + '</b>' : 'Endroit retenu.'}</span> Entrée ou « Apparaître ici » pour valider.`;
  } else {
    choix.refus = { x, z };
    el.innerHTML = '<span style="color:#ff9b8b">Pas là : de l’eau, un mur, ou hors de la châtellenie. Essaie à côté.</span>';
  }
  if (ok) ok.disabled = !choix.point;
  SFX.pickup();
  peindre();
}
function valider() {
  if (!choix || !choix.point) return;
  choix.retenu = choix.point;
  fermer();
}

/**
 * Ouvre la carte pour choisir un point d'apparition. Renvoie une promesse du point
 * retenu `{ x, z, nom? }`, ou null si le joueur ferme sans choisir. Ne demande pas la
 * carte du beffroi : choisir où l'on arrive n'est pas explorer.
 */
// le nom du rendez-vous vient d'un autre joueur, par le serveur : texte, jamais du HTML
const ech = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function choisirPoint(valider, rdv = null) {
  if (ecran) fermer();
  return new Promise((fin) => {
    // le rendez-vous de l'hôte est présélectionné : Entrée suffit pour rejoindre les autres
    const pre = rdv ? valider(rdv.x, rdv.z) : null;
    choix = { valider, fin, point: pre, refus: null, retenu: null, rdv: pre ? rdv : null };
    ouvrir();
    cadrer();                      // la châtellenie entière, au centre, sous le bandeau
    if (pre) {
      const el = ecran.querySelector('#choixTLOC'), ok = ecran.querySelector('#okTLOC');
      el.innerHTML = `<span style="color:#ffd24a">Le rendez-vous de l’hôte${rdv.nom ? ' : <b>' + ech(rdv.nom) + '</b>' : ''}.</span> Entrée pour y aller, ou clique ailleurs.`;
      if (ok) ok.disabled = false;
    }
    peindre();
  });
}

// Toute la carte dans l'écran : centrée dans la place que laisse le bandeau du haut, avec
// une marge. Pour choisir où l'on arrive, il faut voir l'ensemble d'un coup d'œil.
function cadrer() {
  const PX = HUD.CARTE_PX, W = window.innerWidth, H = window.innerHeight;
  const HAUT = 120, MARGE = 40;                  // le bandeau, puis de l'air autour
  const xs = ENCEINTE.map((q) => q[0]), zs = ENCEINTE.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  vue.suivre = false;
  vue.zoom = Math.min(4, Math.max(0.16, Math.min((W - 2 * MARGE) / ((x1 - x0) * PX), (H - HAUT - 2 * MARGE) / ((z1 - z0) * PX))));
  vue.cx = (x0 + x1) / 2;
  // le centre de la zone libre est HAUT/2 plus bas que celui de l'écran
  vue.cz = (z0 + z1) / 2 - (HAUT / 2) / (PX * vue.zoom);
  peindre();
}

function zoomer(f) { vue.zoom = Math.min(4, Math.max(0.16, vue.zoom * f)); peindre(); }
function deplacer(dx, dz) {
  vue.suivre = false;
  const k = HUD.CARTE_PX * vue.zoom;
  vue.cx += dx / k; vue.cz += dz / k;
  peindre();
}

// =====================================================================
//  La touche M
// =====================================================================
window.addEventListener('keydown', (e) => {
  if (ecran) {                                  // carte ouverte : elle prend le clavier
    e.stopImmediatePropagation(); e.preventDefault();
    if (choix && (e.code === 'Enter' || e.code === 'NumpadEnter')) valider();
    else if (e.code === 'KeyM' || e.code === 'Escape') fermer();
    else if (e.code === 'ArrowLeft') deplacer(-90, 0);
    else if (e.code === 'ArrowRight') deplacer(90, 0);
    else if (e.code === 'ArrowUp') deplacer(0, -90);
    else if (e.code === 'ArrowDown') deplacer(0, 90);
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomer(1.25);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomer(1 / 1.25);
    else if (e.code === 'KeyC') { vue.suivre = true; peindre(); }
    return;
  }
  if (e.code !== 'KeyM' || e.shiftKey) return;   // Maj+M reste la musique
  if (!aLaCarte()) return;                       // sans carte, M garde son rôle d'origine
  if (menu.active || cut.active || !state.running || state.over) return;
  e.stopImmediatePropagation(); e.preventDefault();
  ouvrir();
}, true);
