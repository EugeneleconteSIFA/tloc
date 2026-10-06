// Les Pouilles — matera (pouilles.js : la fiche et l'habillage ; monde.js : la recette)
// =====================================================================
// Ce qui n'est qu'à Matera : le château Tramontano, le donjon de l'acte IV (STORY.md ; il
// remplace Castel del Monte, Eugène, 2 octobre). Un château resté inachevé, sur sa colline
// au-dessus des Sassi : trois tours rondes alignées — le grand donjon au milieu, deux tours
// plus basses aux bouts — reliées par des courtines crénelées, et une cour fermée à l'arrière
// par des murs plus bas, jamais montés à leur hauteur. Les centres et les rayons sont lus sur
// l'emprise d'OSM (retirée du plan par carte/mondes/gradins-pouilles.py).
// Et, pour l'acte IV (docs/DECOUPAGE-ACTE4.md, étape 3) : le voisin de Donato, le grand-père de
// Nunzia, devant une porte des Sassi ; le chef de dépôt sur le quai de la gare. Étape 5 : les trois
// portes des tours, sans serrure ni gonds, et le vieux des Sassi qui sait qu'elles s'ouvrent à un rythme.
// =====================================================================
import { ville, GARES, etape4, passe4, passer4, indice4, naitre4, EN_INSTANCE, TEMPS, ECOUTE4 } from './pouilles.js';
import { THREE, TAU, scene, phMat, dialogue, state, showMessage, addInteract, player, G, SFX, saveGame, mesh } from './engine.js?v=41';
import * as PNJ from './pnj.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COUR = { x: 0, z: 0 };       // le centre de la cour : la dalle gravée de l'acte IV
const TOURS = [
  { x: -471.4, z: 288.4, r: 7.6, h: 15 },
  { x: -454.6, z: 318.8, r: 9.8, h: 22 },          // le donjon
  { x: -441.0, z: 349.6, r: 7.8, h: 15 },
];

function chateau({ hauteur, inscrire }) {
  const tuf = phMat('old_stone_wall_02', 1, 1, { color: 0xe4d8be }), gm = [], merlons = [];
  const sol = (x, z, r) => { let m = 1e9; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; m = Math.min(m, hauteur(x + Math.cos(a) * r, z + Math.sin(a) * r)); } return Math.min(m, hauteur(x, z)); };
  // une tour : le fût, un glacis évasé au pied (le talus des tours du XVe siècle), un cordon
  // sous le parapet ; les UV en mètres sur le tour, pour que les assises gardent leur taille
  for (const T of TOURS) {
    const y0 = sol(T.x, T.z, T.r + 1.5) - 2, H = hauteur(T.x, T.z) - y0 + T.h, r = T.r;
    const prof = [[r * 1.18, 0], [r * 1.12, 3], [r, 6.5], [r, H - 1.6], [r * 1.06, H - 1.4], [r * 1.06, H - 0.9], [r, H - 0.8], [r, H + 0.6], [r - 0.7, H + 0.6], [r - 0.7, H - 0.2], [0, H - 0.2]];
    const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 40), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, uv.getX(i) * TAU * r / 2.5, p.getY(i) / 2.5);
    g.translate(T.x, y0, T.z); gm.push(g.toNonIndexed());
    const n = Math.round(TAU * r / 2.2);
    for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * TAU; merlons.push([T.x + Math.cos(a) * (r - 0.35), y0 + H + 1.25, T.z + Math.sin(a) * (r - 0.35), -a + Math.PI / 2, 1.1, 1.3, 0.7]); }
    // CREUSE (acte IV, étape 9) : on y entre par la porte, tournée vers la ville. La collision est
    // un anneau de 24 secteurs entre le parement intérieur et le pied du glacis, ouvert sur
    // 3,3 m devant la porte (Camille a 0,5 m de rayon : un passage de 2,6 m au moins)
    const dx = -40 - T.x, dz = 20 - T.z, l0 = Math.hypot(dx, dz); T.ux = dx / l0; T.uz = dz / l0;
    T.rin = r - 1.2; T.rout = r * 1.18; const aP = Math.atan2(T.uz, T.ux), N = 24;
    for (let k = 0; k < N; k++) { const a0 = k / N * TAU, a1 = (k + 1) / N * TAU, am = (a0 + a1) / 2;
      if (Math.abs(Math.atan2(Math.sin(am - aP), Math.cos(am - aP))) < 1.7 / T.rin) continue;
      const q = [[Math.cos(a0) * T.rin, Math.sin(a0) * T.rin], [Math.cos(a0) * T.rout, Math.sin(a0) * T.rout], [Math.cos(a1) * T.rout, Math.sin(a1) * T.rout], [Math.cos(a1) * T.rin, Math.sin(a1) * T.rin]].map(([a, b]) => [T.x + a, T.z + b]);
      q.push(q[0]); inscrire(q, T.x + Math.cos(am) * r, T.z + Math.sin(am) * r); }
    // le sol de la salle : au plus haut du rocher qu'elle couvre, qu'il ne perce pas le dallage
    let yf = -1e9; for (let rr = 0; rr <= T.rin; rr += 1) for (let k = 0; k < 16; k++) yf = Math.max(yf, hauteur(T.x + Math.cos(k / 16 * TAU) * rr, T.z + Math.sin(k / 16 * TAU) * rr));
    T.yf = yf + 0.05; T.yPorte = hauteur(T.x + T.ux * (T.rout + 0.8), T.z + T.uz * (T.rout + 0.8));
  }
  // une courtine : un mur épais entre deux points, du pied (sous le sol) au chemin de ronde
  const courtine = (ax, az, bx, bz, h, ep, creneaux = true) => {
    const l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l, nx = -uz, nz = ux, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let y0 = 1e9; for (let t = 0; t <= 1; t += 0.1) y0 = Math.min(y0, hauteur(ax + (bx - ax) * t, az + (bz - az) * t));
    const top = Math.max(hauteur(ax, az), hauteur(bx, bz)) + h, b = new THREE.BoxGeometry(l, top - y0 + 2, ep);
    const p = b.attributes.position, uv = b.attributes.uv, nrm = b.attributes.normal;
    for (let i = 0; i < p.count; i++) { const cote = Math.abs(nrm.getX(i)) > 0.5; uv.setXY(i, (cote ? p.getZ(i) : p.getX(i)) / 2.5, p.getY(i) / 2.5); }
    b.rotateY(-Math.atan2(uz, ux)); b.translate(mx, (top + y0 - 2) / 2, mz); gm.push(b.toNonIndexed());
    if (creneaux) { const n = Math.floor(l / 2.2); for (let k = 0; k < n; k++) { const s = (k + 0.5) / n * l - l / 2; merlons.push([mx + ux * s + nx * (ep / 2 - 0.35), top + 0.65, mz + uz * s + nz * (ep / 2 - 0.35), -Math.atan2(uz, ux), 1.1, 1.3, 0.7]); } }
    inscrire([[ax + nx * ep / 2, az + nz * ep / 2], [bx + nx * ep / 2, bz + nz * ep / 2], [bx - nx * ep / 2, bz - nz * ep / 2], [ax - nx * ep / 2, az - nz * ep / 2], [ax + nx * ep / 2, az + nz * ep / 2]], mx, mz);
  };
  const [A, B, C] = TOURS;
  // (rognées au parement extérieur des tours : du centre au centre, elles coupaient les salles)
  const rogne = (P, Q, d) => { const l = Math.hypot(Q.x - P.x, Q.z - P.z); return [P.x + (Q.x - P.x) * d / l, P.z + (Q.z - P.z) * d / l]; };
  courtine(...rogne(A, B, A.r), ...rogne(B, A, B.r), 11, 3.2); courtine(...rogne(B, C, B.r), ...rogne(C, B, C.r), 11, 3.2);
  // la cour, à l'ouest (dos à la ville) : des murs plus bas, inachevés — le château ne fut
  // jamais fini. Une porte charretière dans le mur du fond.
  const ax = C.x - A.x, az = C.z - A.z, l = Math.hypot(ax, az), ox = az / l * 34, oz = -ax / l * 34;
  const A2 = [A.x + ox, A.z + oz], C2 = [C.x + ox, C.z + oz], mil = [(A2[0] + C2[0]) / 2, (A2[1] + C2[1]) / 2];
  courtine(...rogne(A, { x: A2[0], z: A2[1] }, A.r), A2[0], A2[1], 6.5, 2.4, false); courtine(...rogne(C, { x: C2[0], z: C2[1] }, C.r), C2[0], C2[1], 6.5, 2.4, false);
  COUR.x = (A.x + C.x) / 2 + ox / 2; COUR.z = (A.z + C.z) / 2 + oz / 2;
  const ux = (C2[0] - A2[0]) / l, uz = (C2[1] - A2[1]) / l;
  courtine(A2[0], A2[1], mil[0] - ux * 2.6, mil[1] - uz * 2.6, 6.5, 2.4, false);
  courtine(mil[0] + ux * 2.6, mil[1] + uz * 2.6, C2[0], C2[1], 6.5, 2.4, false);

  const m = new THREE.Mesh(mergeGeometries(gm), tuf); m.castShadow = m.receiveShadow = true; scene.add(m);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), phMat('old_stone_wall_02', 1.1, 1.3, { color: 0xe4d8be }), merlons.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  merlons.forEach(([x, y, z, ry, sx, sy, sz], k) => { q.setFromAxisAngle(Y, ry); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(k, m4); });
  im.castShadow = im.receiveShadow = true; scene.add(im);
}

// ---------- l'acte IV : le voisin de Donato, le chef de dépôt ----------
const GENS = { voisin: null, chef: null, vieux: null, portes: null, places: null };
// Devant une porte des Sassi, près de l'arrivée : la première place libre au pied d'une maison,
// en cherchant de plus en plus loin — le plan bouge, une place écrite à la main tomberait un
// jour dans un mur. Tournée dos à la maison.
function placeVoisin({ hauteur, bloque }) {
  const x0 = -40, z0 = 20;
  for (let r = 8; r < 50; r += 2) for (let k = 0; k < 24; k++) {
    const a = k / 24 * TAU, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (bloque(x, z, 1.2)) continue;
    for (let j = 0; j < 8; j++) { const b = j / 8 * TAU;
      if (bloque(x + Math.cos(b) * 1.6, z + Math.sin(b) * 1.6, 0.2) && !bloque(x - Math.cos(b) * 3, z - Math.sin(b) * 3, 0.6))
        return [x, hauteur(x, z), z, Math.atan2(-Math.cos(b), -Math.sin(b))]; }
  }
  return [x0, hauteur(x0, z0), z0, 0];
}
function parlerVoisin() {
  const e = etape4();
  if (e === 'quinze') return dialogue([
    { who: 'Le voisin', text: 'Le vieux Donato ? Mort la semaine dernière. Ici, une semaine…' },
    { who: 'Le voisin', text: 'Il a laissé ça **pour la petite de Gallipoli**. Moi, je ne vais plus jusqu’à la mer.' },
    { text: 'Il te donne un mot plié en quatre.', fn: () => { passer4('grandpere'); indice4('mot'); } },
  ]);
  if (e === 'grandpere') return dialogue([{ who: 'Le voisin', text: 'Porte-le à la petite. **À Gallipoli**, sur le port.' }]);
  dialogue([{ who: 'Le voisin', text: 'À l’ombre des Sassi, on vieillit moins vite. Un peu moins.' }]);
}
function parlerChef() {
  if (passe4('quinze') && state.ind4 && state.ind4.ticket && !state.ind4.apprenti) return dialogue([
    { who: 'Le chef de dépôt', text: 'Une fille de Gallipoli, avec un ticket poinçonné ? Il y avait un apprenti qui regardait toujours vers la mer…' },
    { who: 'Le chef de dépôt', text: '**Envoyé au bout de la ligne, à Alberobello.** Il y a longtemps. Enfin, ici, longtemps…', fn: () => indice4('apprenti') },
  ]);
  dialogue([{ who: 'Le chef de dépôt', text: 'Les trains partent à l’heure. C’est l’heure qui ne tient pas en place.' }]);
}
// ---------- le château fermé (étape 5) ----------
// Une porte de bois par tour, du côté de la ville (vers l'arrivée) : c'est par là qu'on monte des
// Sassi. Sans serrure ni gonds — elles s'ouvriront au tambourin (lot 3).
function portesChateau({ hauteur }) {
  const bois = phMat('wood_cabinet_worn_long', 1.2, 2.2, { color: 0x8a6a4a }), pierre = phMat('old_stone_wall_02', 1, 1, { color: 0xe4d8be });
  return TOURS.map((T, i) => {
    const dx = -40 - T.x, dz = 20 - T.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    // sur la surface du GLACIS : au pied, la tour s'évase jusqu'à 1,18 fois son rayon (le talus) ; posée
    // au rayon du fût, la porte était enterrée dedans et seul le linteau flottait devant (6 octobre)
    const rp = T.r * 1.15 + 0.06, px = T.x + ux * rp, pz = T.z + uz * rp, y = hauteur(T.x + ux * (T.r * 1.25), T.z + uz * (T.r * 1.25));
    const g = new THREE.Group(); g.position.set(px, y, pz); g.rotation.y = Math.atan2(ux, uz);
    const v = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.3), bois); v.position.y = 1.7; v.castShadow = true;
    const arc = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.5), pierre); arc.position.y = 3.65;
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 20), new THREE.MeshStandardMaterial({ color: 0xb08a40, metalness: 0.7, roughness: 0.35, emissive: 0xffc860, emissiveIntensity: 0.05 }));
    anneau.position.set(0, 1.5, 0.2); v.add(anneau);
    const noir = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), new THREE.MeshBasicMaterial({ color: 0x0a0806 })); noir.position.set(0, 1.7, 0.05); noir.visible = false;
    g.add(v, arc, noir); scene.add(g);
    // du dedans, l'embrasure : le jour dans le parement intérieur (un cylindre fermé, sans elle on ne
    // voyait plus par où l'on était entré), seulement quand la porte est ouverte
    const jour = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), new THREE.MeshBasicMaterial({ color: 0xe8eef4, fog: false, side: THREE.DoubleSide }));
    // (à 15 cm du rayon : le parement est un polygone, au milieu de ses faces il passe 3 cm en dedans)
    jour.position.set(T.x + ux * (T.rin - 0.15), T.yf + 1.7, T.z + uz * (T.rin - 0.15)); jour.rotation.y = Math.atan2(-ux, -uz); jour.visible = false; scene.add(jour);
    const ix = T.x + ux * (T.r * 1.15 + 1.4), iz = T.z + uz * (T.r * 1.15 + 1.4);
    const it = addInteract({ pos: new THREE.Vector3(ix, hauteur(ix, iz), iz), r: 3.2, prompt: () => 'pousser la porte', fn: () => toucherPorte(i), enabled: () => !ouverte(i) });
    return { g, it, x: ix, z: iz, y: hauteur(ix, iz), yaw: Math.atan2(ux, uz), vantail: v, noir, anneau, jour };
  });
}
function toucherPorte(i) {
  if (!state.tambourin) return showMessage('Pas de serrure. Pas de gonds.', 3);
  if (i === 1 && !leviers()) return showMessage('La porte du donjon ne répond pas. Quelque chose grince, au fond des deux autres tours.', 4);
  showMessage('Bats la pizzica devant la porte (K) : trois coups, un silence… et frappe dans le silence.', 4.5);
}
const leviers = () => !!(state.levier4 && state.levier4[0] && state.levier4[2]);
const ouverte = (i) => !!(state.portes4 && state.portes4[i]);

// ---------- les portes à rythme (étape 9) ----------
// Un battement de tambourin devant une porte la fait ÉCOUTER : son anneau de bronze luit trois
// fois, au pas de la pizzica, puis se tait ; on frappe dans le silence. Trop tôt, trop tard :
// « Raté », on recommence. Le donjon n'écoute qu'une fois les deux leviers baissés.
const MESURE = { porte: -1, t0: 0 }, BATTUES = [0.6, 1.2, 1.8], SILENCE = [2.1, 3.0];
function ecouterPorte() {
  if (!GENS.portes || etape4() !== 'tambourin' && !passe4('chateau')) return;
  const p = player.pos, i = GENS.portes.findIndex((d) => Math.hypot(p.x - d.x, p.z - d.z) < 5);
  if (i < 0 || ouverte(i)) return;
  if (i === 1 && !leviers()) return showMessage('La porte du donjon ne répond pas.', 2.5);
  const t = state.time - MESURE.t0;
  if (MESURE.porte === i && t > 0.3 && t < 4) {
    if (t >= SILENCE[0] && t <= SILENCE[1]) return ouvrir(i);
    MESURE.porte = -1; return showMessage('Raté. Écoute : trois coups, un silence.', 2.5);
  }
  MESURE.porte = i; MESURE.t0 = state.time;
}
ECOUTE4.push(ecouterPorte);
function ouvrir(i) {
  state.portes4 = { ...(state.portes4 || {}), [i]: true }; MESURE.porte = -1; saveGame(true); SFX.unlock();
  majPortes(); showMessage(i === 1 ? 'La porte du donjon s’ouvre.' : 'La porte s’ouvre sur une salle ronde.', 3);
}
function majPortes() { for (const [i, d] of (GENS.portes || []).entries()) { d.vantail.visible = !ouverte(i); d.noir.visible = d.jour.visible = ouverte(i); } }
function anneaux() {
  const t = state.time - MESURE.t0;
  (GENS.portes || []).forEach((d, i) => { const on = MESURE.porte === i && BATTUES.some((b) => t > b && t < b + 0.18);
    d.anneau.material.emissiveIntensity = on ? 3 : 0.05;
    if (on && !d.sonne) { d.sonne = true; SFX.step(); } if (!on) d.sonne = false; });
  if (MESURE.porte >= 0 && t > 4) MESURE.porte = -1;
}

// ---------- les salles des tours (étape 9) ----------
// Le temps y court en boucle : la même salle neuve, puis en ruine, puis neuve. Le tambourin la fige
// (TEMPS.lent). Tour sud (0) : un plancher qui tombe en ruine — on ne le traverse que neuf. Tour
// nord (2) : une porte murée quand la salle est neuve, éboulée quand elle est vieille — on ne passe
// que par la brèche. Au fond de chacune, un levier ; les deux baissés, le donjon écoute.
// La bande qu'on ne passe pas est un obstacle de monde.js (bloqueLieu) : Camille, les bêtes et la caméra
// s'y arrêtent. Si l'état change pendant qu'on est dedans, la règle de chaque image reprend la main
// (sallesTick : le plancher qui tombe, le mur qui revient).
const SALLES = { c: 0, cote: {} };
const neuve = (i) => { const c = SALLES.c % 2.4; return i === 0 ? c < 0.5 : c > 0.5; };
function salles({ hauteur }) {
  const bois = phMat('wood_planks', 1, 1, { color: 0x9a7a58 }), tuf = phMat('old_stone_wall_02', 1, 1, { color: 0xd8ccb2 }), sol = phMat('marble_rock_02', 2, 2, { color: 0xcfc2a8 });
  const fer = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.5, metalness: 0.6 });
  for (const [i, T] of TOURS.entries()) {
    const g = new THREE.Group(); g.position.set(T.x, T.yf, T.z); g.rotation.y = Math.atan2(T.ux, T.uz); scene.add(g); T.salle = g;
    // le parement intérieur (vu du dedans), la voûte, le dallage
    const mur = new THREE.Mesh(new THREE.CylinderGeometry(T.rin, T.rin, 9, 32, 1, true), phMat('old_stone_wall_02', 6, 3, { color: 0xc8bca2, side: THREE.BackSide }));
    mur.position.y = 4.5; g.add(mur);
    const voute = new THREE.Mesh(new THREE.CircleGeometry(T.rin, 32), tuf); voute.rotation.x = Math.PI / 2; voute.position.y = 9; g.add(voute);
    const dalle = new THREE.Mesh(new THREE.CircleGeometry(T.rin, 32), sol); dalle.rotation.x = -Math.PI / 2; dalle.position.y = 0.02; dalle.receiveShadow = true; g.add(dalle);
    if (i === 1) continue;
    // le levier, au fond (à l'opposé de la porte)
    const lv = new THREE.Group(); lv.position.set(0, 0, -(T.rin - 0.6)); g.add(lv);
    lv.add(mesh(new THREE.BoxGeometry(0.5, 0.9, 0.3), tuf, 0, 0.45, 0)); const bras = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), fer, 0, 1.2, 0); bras.rotation.x = 0.6; lv.add(bras); T.bras = bras;
    const lp = new THREE.Vector3(); lv.getWorldPosition(lp);
    addInteract({ pos: lp, r: 2.2, prompt: () => 'baisser le levier', enabled: () => !(state.levier4 && state.levier4[i]),
      fn: () => { state.levier4 = { ...(state.levier4 || {}), [i]: true }; bras.rotation.x = -0.6; SFX.unlock(); saveGame(true);
        showMessage(leviers() ? 'Le second levier tombe. Au loin, le donjon gronde.' : 'Le levier tombe. Quelque part, une chaîne se tend.', 3.5); } });
    if (state.levier4 && state.levier4[i]) bras.rotation.x = -0.6;
    // la bande qui vieillit : en travers de la salle, à mi-chemin de la porte et du levier
    const neuf = new THREE.Group(), vieux = new THREE.Group(); g.add(neuf, vieux); T.neuf = neuf; T.vieux = vieux;
    if (i === 0) {
      for (let k = -Math.ceil(T.rin / 0.45); k <= Math.ceil(T.rin / 0.45); k++) neuf.add(mesh(new THREE.BoxGeometry(0.42, 0.08, 4.4), bois, k * 0.45, 0.06, 0));
      vieux.add(mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ color: 0x080604 }), 0, 0.04, 0));
      vieux.children[0].rotation.x = -Math.PI / 2; vieux.children[0].scale.set(T.rin / 2.4, 1, 1);
      for (const k of [-5, 4]) { const p = mesh(new THREE.BoxGeometry(0.42, 0.08, 1.2), bois, k * 0.45, 0.06, 1.6); p.rotation.y = 0.3; vieux.add(p); }
    } else {
      neuf.add(mesh(new THREE.BoxGeometry(T.rin * 2, 4, 0.7), tuf, 0, 2, 0));
      for (const [a, r] of [[-1.5, 0.6], [1.2, 0.7], [-3, 0.8], [3, 0.6], [0, 0.5]]) vieux.add(mesh(new THREE.DodecahedronGeometry(r), tuf, a, r * 0.45, (a % 2) * 0.3));        // à demi enfoncés dans le dallage
      vieux.add(mesh(new THREE.BoxGeometry(T.rin * 0.7, 4, 0.7), tuf, -T.rin * 0.65, 2, 0), mesh(new THREE.BoxGeometry(T.rin * 0.7, 4, 0.7), tuf, T.rin * 0.65, 2, 0));
    }
  }
  // le donjon : l'escalier du sommet, au fond de sa salle
  const D = TOURS[1], ep = new THREE.Vector3(D.x - D.ux * (D.rin - 1.2), D.yf, D.z - D.uz * (D.rin - 1.2));
  addInteract({ pos: ep, r: 2.6, prompt: () => 'monter au sommet du donjon', enabled: () => ouverte(1), fn: sommet });
  // la dalle gravée, au centre de la cour
  const yc = hauteur(COUR.x, COUR.z), dc = mesh(new THREE.BoxGeometry(2.4, 0.12, 1.6), phMat('marble_rock_02', 2.4, 1.6, { color: 0xe8dcc8 }), COUR.x, yc + 0.06, COUR.z);
  dc.receiveShadow = true; scene.add(dc);
  addInteract({ pos: new THREE.Vector3(COUR.x, yc, COUR.z), r: 2.6, prompt: () => 'lire la dalle gravée', fn: lireDalle });
}
function sommet() {
  dialogue([
    { text: 'Tu montes l’escalier du donjon. Les marches s’usent sous tes pieds, puis redeviennent neuves.' },
    { text: 'Au sommet, le cadran de la tour. L’aiguille tourne, tourne, beaucoup trop vite.' },
    { text: 'Une main rouge a gravé ici un géant, et une cloche dans sa poitrine.' },
    { who: 'Camille', text: 'Le Colosse.', fn: () => { passer4('chateau'); indice4('colosse'); } },
  ]);
}
function lireDalle() {
  if (!ouverte(1)) return showMessage('Une dalle gravée, couverte de poussière. Les lettres ne se lisent pas : le temps les ronge à mesure.', 4);
  dialogue([
    { text: 'La poussière s’envole d’un coup. Les lettres sont neuves, comme taillées ce matin.' },
    { text: '« Chaque heure sauvée coûtera des années, et nul ne les rendra. »', fn: () => indice4('vers4') },
  ]);
}
// à chaque image : la boucle des salles, et la règle de leur bande
function sallesTick(dt) {
  SALLES.c += dt * TEMPS.lent;
  const p = player.pos;
  for (const i of [0, 2]) { const T = TOURS[i]; if (!T.neuf) continue;
    const n = neuve(i); T.neuf.visible = n; T.vieux.visible = !n;
    const dx = p.x - T.x, dz = p.z - T.z; if (Math.hypot(dx, dz) > T.rin) { delete SALLES.cote[i]; continue; }
    const s = dx * T.ux + dz * T.uz;            // + côté porte, − côté levier
    const bande = Math.abs(s) < (i === 0 ? 2.2 : 0.85), passe = i === 0 ? n : !n;
    if (!bande) { SALLES.cote[i] = Math.sign(s); continue; }
    if (passe) continue;
    if (i === 0) { const x = T.x + T.ux * (T.rin - 0.8), z = T.z + T.uz * (T.rin - 0.8); p.set(x, T.yf, z); player.walkTo = null; showMessage('Le plancher tombe en poussière sous tes pieds ! Tu te rattrapes à la porte.', 3); }
    // le mur muré : on reste du côté d'où l'on venait
    else { const c = SALLES.cote[i] || 1, d = s - c * 1.0; p.x -= T.ux * d; p.z -= T.uz * d; }
  }
  // dans une salle, la caméra se rapproche : 10 m de recul la plaquaient au parement
  const dedans = TOURS.some((T) => Math.hypot(p.x - T.x, p.z - T.z) < T.rin);
  G.camBack = dedans ? 5.5 : 10.5;
}
// l'obstacle des salles pour monde.js : la bande, quand elle n'est pas dans l'état qui laisse passer
function bloqueChateau(x, z, r = 0.4) {
  for (const i of [0, 2]) { const T = TOURS[i]; if (!T.neuf) continue;
    const dx = x - T.x, dz = z - T.z; if (Math.hypot(dx, dz) > T.rin) continue;
    const s = dx * T.ux + dz * T.uz, n = neuve(i);
    if (Math.abs(s) < (i === 0 ? 2.2 : 0.85) + r && !(i === 0 ? n : !n)) return true; }
  return false;
}
// le sol des salles (et la rampe du seuil) pour monde.js
function solChateau(x, z) {
  for (const T of TOURS) { if (T.yf === undefined) continue;
    const dx = x - T.x, dz = z - T.z, d = Math.hypot(dx, dz);
    if (d < T.rin) return T.yf;
    if (d < T.rout + 0.8 && (dx * T.ux + dz * T.uz) / d > 0.85) { const t = (d - T.rin) / (T.rout + 0.8 - T.rin); return T.yf + (T.yPorte - T.yf) * t; } }
  return null;
}
function parlerVieux() {
  const e = etape4();
  if (e === 'trente') return dialogue([
    { who: 'Le vieux', text: 'Tu veux entrer là-dedans ? Personne n’y entre plus.' },
    { who: 'Le vieux', text: 'On ne l’ouvre pas avec une clé. On l’ouvre avec **un rythme**. Ma mère le savait.', fn: () => { passer4('rythme'); indice4('rythme'); } },
  ]);
  if (passe4('tambourin')) return dialogue([{ who: 'Le vieux', text: 'Tiens… J’entends la pizzica. Ça faisait longtemps.' }]);
  if (passe4('rythme')) return dialogue([{ who: 'Le vieux', text: 'Un rythme, petite. Ma mère le savait. À Gallipoli, on danse encore, peut-être.' }]);
  dialogue([{ who: 'Le vieux', text: 'Ce château, on ne l’a jamais fini. On n’a jamais eu le temps.' }]);
}
// le vieux s'adosse à la courtine, à quelques pas de la porte du donjon
function placeVieux({ hauteur, bloque }, p) {
  for (let r = 3; r < 16; r += 1) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    if (!bloque(x, z, 0.9) && Math.abs(hauteur(x, z) - p.y) < 1.5) return [x, hauteur(x, z), z, Math.atan2(p.x - x, p.z - z)]; }
  return [p.x, p.y, p.z, p.yaw];
}
let tAvant = 0;
ville('matera', {
  solLieu: solChateau, bloqueLieu: bloqueChateau,
  plus(ctx) { chateau(ctx);
    const g = GARES.matera, c = Math.cos(g.rot), s = Math.sin(g.rot), a = 7, b = -2.6;
    // (la place du voisin se cherche après le chargement : 0,3 s de plus à Matera sinon)
    GENS.ctx = ctx; GENS.chef0 = [g.x + a * c - b * s, g.y + 0.9, g.z + a * s + b * c, -g.rot + Math.PI / 2]; },
  anime(now) {
    const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
    if (!state.running || EN_INSTANCE || !GENS.ctx) return;
    if (!GENS.places) { GENS.portes = portesChateau(GENS.ctx); salles(GENS.ctx); majPortes();
      GENS.places = { voisin: placeVoisin(GENS.ctx), chef: GENS.chef0, vieux: placeVieux(GENS.ctx, GENS.portes[1]) }; return; }
    // nés après le chargement, un par image
    if (!GENS.voisin) GENS.voisin = naitre4('voisin_sassi', ...GENS.places.voisin, 'parler au voisin', parlerVoisin);
    else if (!GENS.chef) GENS.chef = naitre4('chef_depot', ...GENS.places.chef, 'parler au chef de dépôt', parlerChef);
    else if (!GENS.vieux) GENS.vieux = naitre4('vieux_sassi', ...GENS.places.vieux, 'parler au vieux', parlerVieux);
    anneaux(); sallesTick(dt);
    for (const v of [GENS.voisin, GENS.chef, GENS.vieux]) if (v && v.userData.ctrl) PNJ.animeVillageois(v, dt, false);
  },
});
window.__matera = GENS; GENS.TOURS = TOURS; GENS.COUR = COUR; GENS.neuve = neuve;      // pour les bancs (bancs/acte4-*.mjs) : où se tiennent les gens
