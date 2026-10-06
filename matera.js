// Les Pouilles — matera (pouilles.js : la fiche et l'habillage ; monde.js : la recette)
// =====================================================================
// Ce qui n'est qu'à Matera : le château Tramontano, le donjon de l'acte IV (STORY.md ; il
// remplace Castel del Monte, Eugène, 2 octobre). Un château resté inachevé, sur sa colline
// au-dessus des Sassi : trois tours rondes alignées — le grand donjon au milieu, deux tours
// plus basses aux bouts — reliées par des courtines crénelées, et une cour fermée à l'arrière
// par des murs plus bas, jamais montés à leur hauteur. Les centres et les rayons sont lus sur
// l'emprise d'OSM (retirée du plan par carte/mondes/gradins-pouilles.py).
// Et, pour l'acte IV (docs/DECOUPAGE-ACTE4.md, étape 3) : le voisin de Donato, le grand-père de
// Nunzia, devant une porte des Sassi ; le chef de dépôt sur le quai de la gare.
// =====================================================================
import { ville, GARES, etape4, passe4, passer4, indice4, naitre4, EN_INSTANCE } from './pouilles.js';
import { THREE, TAU, scene, phMat, dialogue, state } from './engine.js?v=41';
import * as PNJ from './pnj.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
    const c = []; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; c.push([T.x + Math.cos(a) * r * 1.15, T.z + Math.sin(a) * r * 1.15]); } c.push(c[0]);
    inscrire(c, T.x, T.z);
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
  courtine(A.x, A.z, B.x, B.z, 11, 3.2); courtine(B.x, B.z, C.x, C.z, 11, 3.2);
  // la cour, à l'ouest (dos à la ville) : des murs plus bas, inachevés — le château ne fut
  // jamais fini. Une porte charretière dans le mur du fond.
  const ax = C.x - A.x, az = C.z - A.z, l = Math.hypot(ax, az), ox = az / l * 34, oz = -ax / l * 34;
  const A2 = [A.x + ox, A.z + oz], C2 = [C.x + ox, C.z + oz], mil = [(A2[0] + C2[0]) / 2, (A2[1] + C2[1]) / 2];
  courtine(A.x, A.z, A2[0], A2[1], 6.5, 2.4, false); courtine(C.x, C.z, C2[0], C2[1], 6.5, 2.4, false);
  const ux = (C2[0] - A2[0]) / l, uz = (C2[1] - A2[1]) / l;
  courtine(A2[0], A2[1], mil[0] - ux * 2.6, mil[1] - uz * 2.6, 6.5, 2.4, false);
  courtine(mil[0] + ux * 2.6, mil[1] + uz * 2.6, C2[0], C2[1], 6.5, 2.4, false);

  const m = new THREE.Mesh(mergeGeometries(gm), tuf); m.castShadow = m.receiveShadow = true; scene.add(m);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), phMat('old_stone_wall_02', 1.1, 1.3, { color: 0xe4d8be }), merlons.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  merlons.forEach(([x, y, z, ry, sx, sy, sz], k) => { q.setFromAxisAngle(Y, ry); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(k, m4); });
  im.castShadow = im.receiveShadow = true; scene.add(im);
}

// ---------- l'acte IV : le voisin de Donato, le chef de dépôt ----------
const GENS = { voisin: null, chef: null, places: null };
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
let tAvant = 0;
ville('matera', {
  plus(ctx) { chateau(ctx);
    const g = GARES.matera, c = Math.cos(g.rot), s = Math.sin(g.rot), a = 7, b = -2.6;
    // (la place du voisin se cherche après le chargement : 0,3 s de plus à Matera sinon)
    GENS.ctx = ctx; GENS.chef0 = [g.x + a * c - b * s, g.y + 0.9, g.z + a * s + b * c, -g.rot + Math.PI / 2]; },
  anime(now) {
    const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
    if (!state.running || EN_INSTANCE || !GENS.ctx) return;
    if (!GENS.places) { GENS.places = { voisin: placeVoisin(GENS.ctx), chef: GENS.chef0 }; return; }
    // nés après le chargement, un par image
    if (!GENS.voisin) GENS.voisin = naitre4('voisin_sassi', ...GENS.places.voisin, 'parler au voisin', parlerVoisin);
    else if (!GENS.chef) GENS.chef = naitre4('chef_depot', ...GENS.places.chef, 'parler au chef de dépôt', parlerChef);
    for (const v of [GENS.voisin, GENS.chef]) if (v && v.userData.ctrl) PNJ.animeVillageois(v, dt, false);
  },
});
window.__matera = GENS;      // pour les bancs (bancs/acte4-*.mjs) : où se tiennent les gens
