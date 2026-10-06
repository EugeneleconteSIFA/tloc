// pouilles.js — les trois villes de la Cloche des Heures, et le petit train qui les relie
// =====================================================================
// Eugène, 1er octobre : « des villes fortifiées où, pour passer de l'une à l'autre, il faut
// prendre un petit train (Matera / Gallipoli hyper-centre / Alberobello) ». Chaque ville a sa
// page (matera.html, alberobello.html, gallipoli.html) et sa fiche ici ; la gare de chacune
// mène aux deux autres. Alberobello ouvre sur l'île du temps par la porte des Heures, dans un
// trullo (Eugène, 2 octobre) ; Gallipoli est la ville de Nunzia (docs/DECISIONS-RECIT.md).
// La lumière : midi méditerranéen, blanc, la brume chaude de la mer.
//
// Version 2 (2 octobre, soir) : monde.js bâtit les murs ; ce module les HABILLE par ses
// crochets (toitSur relève chaque bâtiment, plus pose le reste) — portes, fenêtres à volets,
// appuis de pierre, escaliers extérieurs, acrotères et cheminées des toits plats, et les cônes
// des trulli refaits. Tout en instances : 2 000 à 3 000 maisons par ville, une poignée d'appels
// de dessin, et pas une texture de plus que celles déjà chargées.
// =====================================================================
import { monde } from './monde.js';
import { THREE, TAU, scene, phMat, PH, G, state, sun, hemi, sky, SUN_DIR, renderer, showMessage, saveGame, addInteract,
  SFX, KINDS, TOUCHES, AIDE, player, QUESTS } from './engine.js?v=41';
import * as PNJ from './pnj.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Les gares : au BORD du cœur de chaque ville (Eugène, 2 octobre au soir : de petites parties
// des villes, « la gare de l'autre côté du pont, avec une place bien chaleureuse »). Les vraies
// sont loin dans les villes neuves (Gallipoli à 800 m du pont, Matera Centrale sous la ville
// neuve, Alberobello à 600 m) ; le petit train est un train de jeu. `rot` : le sens des voies.
// Chaque gare est posée sur un terrain LIBRE et presque plat (41 × 21 m sans une maison, moins
// de 2,5 m de dénivelé), cherché sur le plan du cœur : posées à l'œil, celles de Matera et
// d'Alberobello tombaient dans un pâté de maisons, et on ne pouvait pas les atteindre
// (bancs/lieu-pouilles.mjs, 2 octobre). La place Vittorio Veneto de Matera est libre mais
// descend de 3,4 m : la gare est entre les Sassi et la colline du château.
export const GARES = {
  matera:      { x: -415, z: 266, rot: 3.665 },       // (4 oct.) au pied du château ; l'ancienne coupait une rue
  // (4 oct.) dans le cœur resserré, le seul terrain sans maison ni rue sous le bâtiment et le
  // quai (gradins-pouilles.py le cherche) : à l'ouest du Rione Monti, à 87 m de la porte des Heures
  alberobello: { x: -80, z: -20, rot: 3.403 },
  gallipoli:   { x: 369, z: 30, rot: 4.451 },        // (4 oct.) retournée : tournée à 1,571, son quai coupait une rue
};
const NOMS = { matera: 'Matera', alberobello: 'Alberobello', gallipoli: 'Gallipoli' };
// on descend du train devant le quai, du côté opposé au bâtiment, face à la ville
const lignes = (ici) => Object.keys(GARES).filter((v) => v !== ici).map((v) => { const g = GARES[v];
  return [`Descendre à ${NOMS[v]}`, v, [g.x - 5 * Math.sin(g.rot), 0, g.z + 5 * Math.cos(g.rot)], g.rot]; });
// Les murs blanchis : la chaux craquelée de la version 1 faisait des façades tachées de brun
// (Eugène : « murs trop tachés ») ; la pierre de Lecce veinée, éclaircie, donne un enduit de
// chaux propre, avec juste assez de relief pour ne pas faire aplat.
// (Une couleur au-delà de 1 éclaircit la texture : l'enduit gris, éclairci et dégrisé, devient
// un lait de chaux propre. La pierre veinée essayée d'abord faisait du marbre de près.)
// Et on la LAVE (lavage, plus bas) : la texture reste, ses taches s'effacent à moitié.
const CHAUX = ['enduit_gris', new THREE.Color(1.68, 1.64, 1.84)];
const LAVAGE = 0.5;
// Les cônes des trulli sont de pierre sèche en plaquettes, la même que les murets du Pouget —
// inscrite par pouget-bati.js quand on vient de là, ici sinon (engine.js est tenu ailleurs).
if (!PH.rustic_stone_wall_02) PH.rustic_stone_wall_02 = { tuile: 1.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a8070 };
const COMMUN = {
  musique: 'jardins', ciel: [0x2f6ab8, 0x9ac4e8, 0xf2ead8], brume: [0xece6da, 420, 4200], soleil: [160, 300, 120, 3.0], soleilCouleur: 0xfff2dc,
  toit: { style: 'plat', slug: 'rocher_01', couleur: 0x8a8884, pente: 0.5 }, hMurs: [5.5, 8.5],
  // les rues dallées de chianche, la pierre calcaire pâle (le carrelage usé de la version 1
  // sortait gris sombre sous ce soleil)
  chemin: ['marble_rock_02', 0xd8ccb8], carteFond: '#c8b890',
};

const FICHES = {
  gallipoli: {
    ...COMMUN, name: 'gallipoli', titre: 'Gallipoli', plan: 'pouilles-gallipoli-coeur.json', fin: 'relief-pouilles-gallipoli-coeur.json', loin: 'relief-pouilles-gallipoli-loin.json', loinSol: ['rocky_trail', 0xd8ccb0], mer: 0,
    // la mer métallique de la version 1 n'avait rien à refléter : elle sortait NOIRE au pied
    // des remparts. Une eau peu métallique, du bleu très franc de la côte ionienne.
    merCouleur: 0x1f78a8, merMetal: 0.15, merPoli: 0.12,
    // (le gravier sortait presque noir : c'est une texture d'asphalte sombre) ; des maisons de
    // deux ou trois étages, pas des immeubles
    sol: ['rocky_trail', 0xece2cc], murs: CHAUX, hMurs: [4.6, 7.2],
    arbres: { espece: 'chene', bois: 0.4, isoles: 0.01, h: [4, 6.5], max: 300 },
    depart: { x: -55, z: 116, yaw: Math.PI },
    portes: [],
    counts: 'Gallipoli, la vieille ville blanche sur son île. La gare, juste de l’autre côté du pont, pour Matera et Alberobello.',
    start: 'Le blanc des murs fait mal aux yeux. La mer monte… vite. Trop vite.',
    entry: { title: 'Gallipoli', sub: 'La Cloche des Heures — les Pouilles', cam: [700, 300, 700], at: [0, 0, 0], cam2: [80, 40, 260], at2: [-40, 0, 100], dur: 6 },
  },
  matera: {
    // le plan EN GRADINS (carte/mondes/gradins-pouilles.py) : les maisons des Sassi coupées en
    // bandes le long de la pente, chacune sur le toit de celle d'en dessous ; et des murs bas —
    // une ou deux pièces sous la voûte, pas des immeubles
    ...COMMUN, name: 'matera', titre: 'Matera', plan: 'pouilles-matera-coeur.json', fin: 'relief-pouilles-matera-coeur.json', loin: 'relief-pouilles-matera-loin.json', loinSol: ['rocky_trail', 0xd8ccb4], hMurs: [3.4, 5.6],
    // le tuf de la Murgia, ocre pâle : la terre battue orangée de la version 1 teignait tout
    sol: ['rocky_trail', 0xe8dcc4], murs: ['old_stone_wall_02', 0xe8dcc0],
    arbres: { espece: 'chene', bois: 0.5, isoles: 0.01, h: [4, 7], max: 500 },
    depart: { x: -40, z: 20, yaw: 0 },
    portes: [],
    counts: 'Matera, les Sassi creusés dans la falaise de tuf. La gare, au pied de la colline du château, pour Alberobello et Gallipoli.',
    start: 'Des maisons creusées dans la roche, les unes sur les toits des autres.',
    entry: { title: 'Matera', sub: 'La Cloche des Heures — les Pouilles', cam: [600, 260, 700], at: [0, 0, 0], cam2: [120, 40, 200], at2: [0, -10, 0], dur: 6 },
  },
  alberobello: {
    ...COMMUN, name: 'alberobello', titre: 'Alberobello', plan: 'pouilles-alberobello-coeur.json', fin: 'relief-pouilles-alberobello-coeur.json', loin: 'relief-pouilles-alberobello-loin.json', loinSol: ['withered_grass', 0xb8b070],
    sol: ['withered_grass', 0xc8b878], murs: CHAUX,
    arbres: { espece: 'chene', bois: 0.5, isoles: 0.012, h: [4, 6], max: 500 },
    // (10, 10) tombait DANS un pâté de trulli d'OSM : on arrive dans la rue, via Monte San
    // Michele, et la porte de l'île s'adosse au mur du trullo qui la borde
    depart: { x: 6.8, z: 1.4, yaw: Math.PI },
    portes: [{ x: 6.5, z: 7.6, rot: 0, prompt: 'repasser la porte de l’île', vers: ['temple', [0, 0, -23.5], 0], label: 'Retour à l’île du temps…' }],
    counts: 'Alberobello, le Rione Monti et ses trulli. La porte de l’île, contre un trullo. La gare, à l’ouest, pour Matera et Gallipoli.',
    start: 'Des cônes de pierre grise sur des murs blancs, à perte de vue.',
    entry: { title: 'Alberobello', sub: 'La Cloche des Heures — les Pouilles', cam: [400, 200, 500], at: [0, 0, 0], cam2: [60, 25, 120], at2: [0, 0, 0], dur: 6 },
  },
};

// =====================================================================
//  L'habillage des maisons
// =====================================================================
// Un hasard FIXE par maison (tiré de sa position) : la même façade garde ses volets verts d'une
// visite à l'autre, et le banc de charge mesure deux fois la même ville.
const hasard = (x, z, k = 0) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
// les couleurs des volets et des portes : vert bouteille, bleu passé, brun, gris-bleu — jamais
// vives, le soleil les a mangées
// (en multiplicateurs des planches claires : la peinture passée laisse voir le bois ; sur le
// bois brun, les mêmes teintes sortaient presque noires)
const VOLETS = [[0.45, 0.85, 0.55], [0.45, 0.7, 1.1], [0.65, 0.85, 1.0], [0.8, 0.6, 0.42], [0.32, 0.56, 0.4], [1.0, 0.82, 0.52]];

let MAISONS = [];          // { b, g (la géométrie que donne monde.js), trullo }
const cones = [], pinacles = [];
// les cônes posés (centre, rayon) : bancs/lieu-pouilles.mjs vérifie qu'ils tiennent sur leur trullo
export const CONES = [];

// Le cône d'un trullo : des lauzes de calcaire gris posées en assises (les chiancarelle), un
// profil légèrement bombé comme les vrais, qui se resserre sur une clé blanche — le pinacle.
// La version 1 posait un cône à 14 pans tiré d'un rocher brun, une boule blanche géante au bout.
function coneTrullo(g) {
  // Une emprise d'OSM couvre souvent plusieurs trulli accolés (une maison de trois ou quatre
  // cônes) : un seul cône sur le tout en faisait un géant. On la découpe en cases d'environ
  // 6,5 m, un cône par case, dont le centre tombe bien dans l'emprise.
  const na = Math.max(1, Math.round(g.L / 6.5)), nb = Math.max(1, Math.round(g.W / 6.5)), ac = (g.a0 + g.a1) / 2, bc = (g.b0 + g.b1) / 2;
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
    const a = ac + (i + 0.5 - na / 2) * g.L / na, c = bc + (j + 0.5 - nb / 2) * g.W / nb;
    const x = g.cx + a * g.ux - c * g.uz, z = g.cz + a * g.uz + c * g.ux;
    if (!dansPoly(x, z, g.pts)) continue;
    // le cône tient sur SON mur : son rayon ne dépasse pas de plus de 20 cm le bord le plus
    // proche de l'emprise (une emprise en L ou ronde débordait chez le voisin)
    let bord = 1e9; const p = g.pts;
    for (let k = 0; k < p.length - 1; k++) { const [ax, az] = p[k], [bx, bz] = p[k + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); bord = Math.min(bord, Math.hypot(x - ax - dx * t, z - az - dz * t)); }
    const r = Math.min(Math.min(g.L / na, g.W / nb) / 2 * 1.04, bord + 0.2); if (r < 0.9) continue;
    unCone(x, z, r, g.haut);
  }
}
function unCone(cx, cz, r, haut) {
  const h = r * 1.55, cou = Math.min(0.24, r * 0.12), prof = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8, rr = cou + (r - cou) * Math.pow(1 - t, 0.78); prof.push(new THREE.Vector2(rr, t * h)); }
  const c = new THREE.LatheGeometry(prof, 18);
  // les UV en mètres : u le long de l'assise (sur le tour de la base), v le long de la pente ;
  // la pierre se resserre vers le haut comme les lauzes, plus petites au sommet
  const p = c.attributes.position, uv = c.attributes.uv; let pente = [0];
  for (let k = 1; k < prof.length; k++) pente.push(pente[k - 1] + prof[k].distanceTo(prof[k - 1]));
  for (let i = 0; i < p.count; i++) { const j = i % prof.length; uv.setXY(i, uv.getX(i) * TAU * r * 0.6, pente[j]); }
  c.translate(cx, haut - 0.05, cz); cones.push(c.toNonIndexed()); CONES.push([cx, cz, r]);
  // le pinacle : un col, un disque, une boule — passé à la chaux comme le haut des murs
  const s = Math.max(0.7, Math.min(1.1, r / 3)), pin = [[cou, 0], [cou * 0.85, 0.12], [0.13, 0.3], [0.3, 0.36], [0.3, 0.42], [0.1, 0.46], [0.15, 0.52], [0.17, 0.6], [0.14, 0.68], [0.06, 0.73], [0, 0.74]];
  const q = new THREE.LatheGeometry(pin.map(([x, y], k) => new THREE.Vector2(k < 2 ? x : x * s, y * s)), 12);
  q.translate(cx, haut - 0.05 + h - 0.02, cz); pinacles.push(q.toNonIndexed());
}

// toitSur : monde.js le demande pour chaque bâtiment, après en avoir monté les murs. On relève
// tout ; on ne coiffe soi-même que les trulli (les toits plats, monde.js les laisse nus).
function toitPouilles(b, g) {
  const trullo = b.k === 'trullo' || b.toit === 'conical';
  MAISONS.push({ b, g, trullo });
  if (trullo) { coneTrullo({ ...g, pts: b.pts }); return true; }
  return false;
}

// LE LAVAGE DE LA CHAUX : la couleur de la texture, ramenée vers sa moyenne et en partie
// désaturée — un mur blanchi garde son grain et ses reprises, plus ses grandes taches vertes.
// Un shader de plus par matière lavée (la clé de cache les sépare des autres enduits).
function laver(m, k) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include map_fragment', `#include map_fragment
    { vec3 c = diffuseColor.rgb, moy = diffuse * 0.56; c = mix(moy, c, ${(1 - k).toFixed(2)}); float l = dot(c, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(vec3(l), c, ${(1 - k * 1.2).toFixed(2)}); }`); };
  m.customProgramCacheKey = () => 'chaux-lavee-' + k;
  return m;
}

function dansPoly(x, z, pts) {
  let d = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; }
  return d;
}

// Les instances d'une même pièce : une boîte unité, étirée, tournée, teintée par instance.
function lot(materiau, ombre = false) {
  const L = { m: materiau, mats: [], couls: [], ombre };
  L.mettre = (x, y, z, ry, sx, sy, sz, c = 0xffffff) => { L.mats.push([x, y, z, ry, sx, sy, sz]); L.couls.push(c); };
  return L;
}
const UNITE = new THREE.BoxGeometry(1, 1, 1);
function poserLot(L) {
  if (!L.mats.length) return null;
  const im = new THREE.InstancedMesh(UNITE, L.m, L.mats.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  L.mats.forEach(([x, y, z, ry, sx, sy, sz], k) => { q.setFromAxisAngle(Y, ry); m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz)); im.setMatrixAt(k, m4); const t = L.couls[k]; im.setColorAt(k, Array.isArray(t) ? c.setRGB(...t) : c.setHex(t)); });
  im.castShadow = L.ombre; im.receiveShadow = true; scene.add(im); return im;
}

/**
 * Habille toutes les maisons relevées : `murs` est la matière des murs du lieu (pour les
 * acrotères, les cheminées et les escaliers, du même enduit que la façade).
 */
function habiller({ hauteur, inscrire, scene: sc, PLAN }, murs, lavage) {
  // les murs de monde.js : on lave leur matière en place (c'est la seule du lieu à porter
  // la texture des murs sur un maillage simple)
  if (lavage) sc.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material && o.material.userData && o.material.userData.ph === murs[0]) laver(o.material, lavage); });
  // une grille à soi des emprises (celle de monde.js ne sort pas) : une façade est « libre »
  // si, à un mètre devant elle, on n'est dans aucune autre maison — les murs mitoyens des
  // îlots n'ont ni porte ni fenêtre. La mer compte pour libre : on y voit depuis Gallipoli.
  const grille = new Map(), cle = (x, z) => Math.floor(x / 16) + ',' + Math.floor(z / 16);
  MAISONS.forEach((m, i) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of m.b.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let gx = Math.floor(x0 / 16); gx <= Math.floor(x1 / 16); gx++) for (let gz = Math.floor(z0 / 16); gz <= Math.floor(z1 / 16); gz++) { const k = gx + ',' + gz; if (!grille.has(k)) grille.set(k, []); grille.get(k).push(i); } });
  const occupe = (x, z, sauf) => (grille.get(cle(x, z)) || []).some((i) => i !== sauf && dansPoly(x, z, MAISONS[i].b.pts));
  // les rues d'OSM, à leur largeur dans le jeu (celle des rubans de monde.js) + 60 cm
  const rues = new Map();
  for (const r of [...PLAN.routes, ...PLAN.chemins]) { const w = (r.r >= 3 ? 6 : r.r === 2 ? 4 : r.r === 1 ? 2.6 : 1.5) / 2 + 0.6;
    for (let k = 0; k < r.pts.length - 1; k++) { const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1];
      for (let i = Math.floor(Math.min(ax, bx) / 16) - 1; i <= Math.floor(Math.max(ax, bx) / 16) + 1; i++) for (let j = Math.floor(Math.min(az, bz) / 16) - 1; j <= Math.floor(Math.max(az, bz) / 16) + 1; j++) {
        const c = i + ',' + j; if (!rues.has(c)) rues.set(c, []); rues.get(c).push([ax, az, bx, bz, w]); } } }
  const surRue = (x, z) => (rues.get(cle(x, z)) || []).some(([ax, az, bx, bz, w]) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); return Math.hypot(x - ax - dx * t, z - az - dz * t) < w; });

  const bois = phMat('wood_cabinet_worn_long', 1.1, 2.3, { color: 0xffffff, roughness: 0.8 });
  const persienne = phMat('hinoki_planks', 0.5, 1.3, { color: 0xffffff, roughness: 0.75 });
  const pierre = phMat('marble_rock_02', 1.2, 0.3, { color: 0xf4f0e8 });
  const vitre = new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.18, metalness: 0.35 });
  const enduit = phMat(murs[0], 2, 1, { color: murs[1] }); if (lavage) laver(enduit, lavage);
  const portes = lot(bois), volets = lot(persienne), vitres = lot(vitre), appuis = lot(pierre), acroteres = lot(enduit), marches = lot(enduit, true);

  MAISONS.forEach((m, i) => {
    const pts = m.b.pts, n = pts.length - (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? 1 : 0); if (n < 3) return;
    let aire = 0; for (let k = 0; k < n; k++) { const [x1, z1] = pts[k], [x2, z2] = pts[(k + 1) % n]; aire += x1 * z2 - x2 * z1; }
    const sens = aire > 0 ? 1 : -1, haut = m.g.haut, eglise = m.b.k === 'church' || m.b.k === 'cathedral' || m.b.k === 'chapel';
    // les façades libres, la plus longue d'abord : elle reçoit la porte
    const faces = [];
    for (let k = 0; k < n; k++) {
      const [x1, z1] = pts[k], [x2, z2] = pts[(k + 1) % n], dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz); if (l < 1.3) continue;
      const ux = dx / l, uz = dz / l, nx = uz * sens, nz = -ux * sens, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      if (occupe(mx + nx * 1.1, mz + nz * 1.1, i)) continue;
      faces.push({ x1, z1, ux, uz, nx, nz, l, ry: Math.atan2(nx, nz) });
    }
    if (!faces.length) return;
    faces.sort((a, b) => b.l - a.l);
    const pt = (f, s, avant = 0) => [f.x1 + f.ux * s + f.nx * avant, f.z1 + f.uz * s + f.nz * avant];
    const couleur = VOLETS[Math.floor(hasard(pts[0][0], pts[0][1], 1) * VOLETS.length)];

    // ---------- la porte, sur la plus longue façade libre ----------
    const fp = faces[0], sp = fp.l * (0.3 + hasard(fp.x1, fp.z1, 2) * 0.4), [px, pz] = pt(fp, sp), py = hauteur(px, pz);
    const lp = m.trullo ? 0.9 : eglise ? 2.0 : 1.05, hp = m.trullo ? 1.85 : eglise ? 3.4 : 2.2;
    if (fp.l > lp + 0.5 && haut - py > hp + 0.3) {
      const [qx, qz] = pt(fp, sp, 0.03); portes.mettre(qx, py + hp / 2, qz, fp.ry, lp, hp, 0.08, eglise ? 0x8a6a4a : hasard(px, pz, 3) < 0.5 ? couleur : 0x9a7a5a);
      // l'encadrement de pierre et la marche du seuil
      const [ex, ez] = pt(fp, sp, 0.06); appuis.mettre(ex, py + hp + 0.12, ez, fp.ry, lp + 0.4, 0.24, 0.14);
      const [sx, sz] = pt(fp, sp, 0.22); appuis.mettre(sx, py + 0.06, sz, fp.ry, lp + 0.3, 0.12, 0.44);
    }

    // ---------- les fenêtres, à volets ouverts, par étage ----------
    for (const f of faces) {
      if (eglise || m.trullo) { if (m.trullo && f !== fp && f.l > 1.6) { const [x, z] = pt(f, f.l / 2, 0.03), y = hauteur(x, z) + 1.2; if (y + 0.6 < haut) vitres.mettre(x, y, z, f.ry, 0.45, 0.55, 0.06); } continue; }
      const nb = Math.floor((f.l - 0.6) / 3.1); if (nb < 1) continue;
      for (let w = 0; w < nb; w++) {
        const s = (w + 0.5) * f.l / nb, [x, z] = pt(f, s), y0 = hauteur(x, z);
        for (let e = 0; e < 4; e++) {
          const yb = y0 + 1.1 + e * 3.1, hw = e ? 1.35 : 1.15; if (yb + hw > haut - 0.5) break;
          if (e === 0 && f === fp && Math.abs(s - sp) < 1.5) continue;           // pas sur la porte
          // une fenêtre sur quatre manque (un mur plein, une pièce aveugle) : une grille
          // complète faisait des immeubles d'aujourd'hui
          if (hasard(x, z, 6 + e) < 0.27) continue;
          const yc = yb + hw / 2, [vx, vz] = pt(f, s, 0.025); vitres.mettre(vx, yc, vz, f.ry, 0.82, hw, 0.05);
          for (const c of [-1, 1]) { const [ox, oz] = pt(f, s + c * 0.66, 0.045); volets.mettre(ox, yc, oz, f.ry, 0.44, hw + 0.04, 0.035, couleur); }
          const [ax, az] = pt(f, s, 0.08); appuis.mettre(ax, yb - 0.04, az, f.ry, 1.08, 0.08, 0.2);
        }
      }
    }

    // ---------- l'escalier extérieur (une maison sur six, assez haute, façade assez longue) ----------
    const fe = faces.find((f) => f !== fp && f.l >= 5.8) || (fp.l >= 9 ? fp : null);
    if (fe && !m.trullo && !eglise && hasard(pts[0][0], pts[0][1], 4) < 0.17) {
      const debut = fe === fp ? (sp > fe.l / 2 ? 0.4 : fe.l - 5.6) : 0.4, [x0s, z0s] = pt(fe, debut), y0 = hauteur(x0s, z0s);
      // ni sur une rue : l'escalier est un obstacle, et posé sur une façade qui donne sur la
      // grand-rue d'Alberobello il coupait la chaussée (bancs/lieu-pouilles.mjs, 4 octobre)
      const [xf, zf] = pt(fe, debut + 5.2), libre = [1.4, 2.6].every((a) => !occupe(...pt(fe, debut + 2.6, a), -1))
        && [0.4, 2.6, 4.8].every((s) => [0.3, 1.0].every((a) => !surRue(...pt(fe, debut + s, a))));
      if (libre && haut - y0 > 6 && Math.abs(hauteur(xf, zf) - y0) < 0.8) {
        for (let k = 0; k < 15; k++) { const top = y0 + 0.2 * (k + 1), [x, z] = pt(fe, debut + 0.14 + k * 0.28, 0.5);
          marches.mettre(x, (top + y0 - 0.4) / 2, z, fe.ry, 0.28, top - y0 + 0.4, 1.0);
          const [rx, rz] = pt(fe, debut + 0.14 + k * 0.28, 0.95); marches.mettre(rx, top + 0.45, rz, fe.ry, 0.29, 0.9, 0.12); }
        const [lx, lz] = pt(fe, debut + 4.7, 0.5); marches.mettre(lx, (y0 + 3 + y0 - 0.4) / 2, lz, fe.ry, 1.0, 3.4, 1.0);
        const [dx, dz] = pt(fe, debut + 4.7, 0.03); portes.mettre(dx, y0 + 3 + 1.05, dz, fe.ry, 0.95, 2.1, 0.08, couleur);
        // on ne traverse pas l'escalier : son emprise compte comme un mur
        const c0 = pt(fe, debut), c1 = pt(fe, debut + 5.2), c2 = pt(fe, debut + 5.2, 1.0), c3 = pt(fe, debut, 1.0);
        inscrire([c0, c1, c2, c3, c0], (c0[0] + c2[0]) / 2, (c0[1] + c2[1]) / 2);
      }
    }

    // ---------- le toit plat : l'acrotère tout autour, une cheminée ----------
    if (!m.trullo && !(m.b.toit === 'gabled') && !eglise) {
      for (let k = 0; k < n; k++) { const [x1, z1] = pts[k], [x2, z2] = pts[(k + 1) % n], l = Math.hypot(x2 - x1, z2 - z1); if (l < 0.6) continue;
        const ux = (x2 - x1) / l, uz = (z2 - z1) / l, nx = uz * sens, nz = -ux * sens;
        acroteres.mettre((x1 + x2) / 2 - nx * 0.12, haut + 0.32, (z1 + z2) / 2 - nz * 0.12, Math.atan2(nx, nz), l + 0.04, 0.64, 0.24); }
      if (hasard(pts[0][0], pts[0][1], 5) < 0.45) { const { cx, cz, ux, uz, a1 } = m.g, a = a1 * 0.55;
        marches.mettre(cx + ux * a, haut + 0.8, cz + uz * a, Math.atan2(ux, uz), 0.6, 1.6, 0.6);
        appuis.mettre(cx + ux * a, haut + 1.66, cz + uz * a, Math.atan2(ux, uz), 0.8, 0.12, 0.8); }
    }
  });

  for (const L of [portes, volets, vitres, appuis, acroteres, marches]) poserLot(L);
  // les cônes et leurs pinacles, chacun fondu en un maillage
  if (cones.length) { const m = new THREE.Mesh(mergeGeometries(cones), phMat('rustic_stone_wall_02', 1, 1, { color: new THREE.Color(0.98, 1.02, 1.12), roughness: 0.95 })); m.castShadow = m.receiveShadow = true; scene.add(m); }
  if (pinacles.length) { const pm = phMat(murs[0], 1, 1, { color: murs[1] }); if (lavage) laver(pm, lavage); const m = new THREE.Mesh(mergeGeometries(pinacles), pm); m.castShadow = true; scene.add(m); }
  MAISONS = []; cones.length = 0; pinacles.length = 0; window.__pouilles = { cones: CONES };
}

// La petite gare : un bâtiment de voyageurs blanchi, toit de tuiles à deux pans, une marquise
// sur le quai, et un bout de voie qui finit sur un heurtoir (le train, lui, est une
// transition : on ne le voit qu'au fondu). Chaque ville la pose au bord de son cœur.
// ---------- le bord du cœur et la toile du lointain (4 octobre) ----------
// Le cœur praticable s'arrête net aux bords du relief fin (monde.js). Pour que le bord ne se
// voie pas comme une coupe, un MURET de pierre sèche (ceux de la campagne des Pouilles) court
// à 50 cm en dedans, interrompu là où une maison fait déjà mur : chaque rue coupée finit sur
// lui. Au-delà, les maisons d'alentour en simples volumes blanchis (et le cône gris des
// trulli), posés sur la toile du relief lointain : un maillage pour tout, sans collisions,
// sans ombres portées — on ne fait que les voir.
function bord({ CADRE, hauteur }) {
  const segs = [], pierre = phMat('rustic_stone_wall_02', 1, 1, { color: 0xd8d0c0 });
  const occupe = (x, z) => BORD_MAISONS.some((p) => dansPoly(x, z, p));
  const cotes = [[CADRE.x0 + 0.5, CADRE.z0 + 0.5, CADRE.x1 - 0.5, CADRE.z0 + 0.5], [CADRE.x1 - 0.5, CADRE.z0 + 0.5, CADRE.x1 - 0.5, CADRE.z1 - 0.5],
    [CADRE.x1 - 0.5, CADRE.z1 - 0.5, CADRE.x0 + 0.5, CADRE.z1 - 0.5], [CADRE.x0 + 0.5, CADRE.z1 - 0.5, CADRE.x0 + 0.5, CADRE.z0 + 0.5]];
  for (const [ax, az, bx, bz] of cotes) { const l = Math.hypot(bx - ax, bz - az), n = Math.ceil(l);
    for (let k = 0; k < n; k++) { const x = ax + (bx - ax) * (k + 0.5) / n, z = az + (bz - az) * (k + 0.5) / n; if (occupe(x, z)) continue;
      const y = hauteur(x, z), b = new THREE.BoxGeometry(l / n + 0.02, 1.6, 0.6), p = b.attributes.position, uv = b.attributes.uv, nn = b.attributes.normal;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.abs(nn.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) + k * (l / n), p.getY(i) + (Math.abs(nn.getY(i)) > 0.5 ? p.getZ(i) : 0));
      b.rotateY(-Math.atan2(bz - az, bx - ax)); b.translate(x, y + 0.45, z); segs.push(b.toNonIndexed()); } }
  if (segs.length) { const m = new THREE.Mesh(mergeGeometries(segs), pierre); m.castShadow = m.receiveShadow = true; scene.add(m); }
}
let BORD_MAISONS = [];
function lointain({ PLAN, H0 }, murs, lavage) {
  const vol = PLAN.lointain; if (!vol || !vol.length) return;
  const blancs = [], gris = [];
  for (const [cx, cz, a, L, W, h, tr, sol] of vol) {
    // les UV en mètres sur chaque face (une boîte unité étirait l'enduit sur toute la façade)
    const b = new THREE.BoxGeometry(L, h + 1, W), p = b.attributes.position, uv = b.attributes.uv, n = b.attributes.normal;
    for (let i = 0; i < p.count; i++) uv.setXY(i, Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i), Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) : p.getY(i));
    b.rotateY(-a); b.translate(cx, sol - H0 + (h + 1) / 2, cz); blancs.push(b.toNonIndexed());
    // un cône par trullo lointain, pas plus grand qu'un vrai (une emprise d'ensemble coiffée
    // d'un seul cône en faisait un géant)
    if (tr) { const r = Math.min(Math.min(L, W) / 2, 3.2), c = new THREE.ConeGeometry(r, r * 1.55, 10); c.translate(cx, sol - H0 + h + 1 + r * 0.775, cz); gris.push(c.toNonIndexed()); }
  }
  // un ton un peu éteint : la brume de chaleur du lointain, et l'œil reste sur le cœur
  const enduit = phMat(murs[0], 3, 3, { color: murs[1].clone ? murs[1].clone().multiplyScalar(0.86) : murs[1] }); if (lavage) laver(enduit, lavage);
  scene.add(new THREE.Mesh(mergeGeometries(blancs), enduit));
  if (gris.length) scene.add(new THREE.Mesh(mergeGeometries(gris), phMat('rustic_stone_wall_02', 1.5, 1.5, { color: 0xb8b6b0 })));
}

function gare({ hauteur, inscrire }, Gr, murs, lavage) {
  const c = Math.cos(Gr.rot), s = Math.sin(Gr.rot), P = (a, b) => [Gr.x + a * c - b * s, Gr.z + a * s + b * c];
  // LA PENTE (consigne de précision : rien ne flotte, rien ne s'enfonce) : le terrain choisi
  // descend encore d'un ou deux mètres. Le bâtiment et le quai se posent au plus HAUT du sol
  // sous eux, et leurs fondations descendent jusqu'au plus bas ; la voie suit le terrain,
  // traverse par traverse.
  const sol = (a, b) => hauteur(...P(a, b)); let haut = -1e9, bas = 1e9;
  for (let a = -13; a <= 13; a += 1) for (let b = -14; b <= -2; b += 1) { const h = sol(a, b); haut = Math.max(haut, h); bas = Math.min(bas, h); }
  const y = haut, F = y - bas + 0.5, g = new THREE.Group(); Gr.y = y;     // (le dessus du quai : y + 0,9 — Cosimo s'y tient) g.position.set(Gr.x, y, Gr.z); g.rotation.y = -Gr.rot; scene.add(g);
  const enduit = phMat(murs[0], 2, 2, { color: murs[1] }); if (lavage) laver(enduit, lavage);
  const tuiles = phMat('clay_roof_tiles_02', 6, 3, { color: 0xe0b090, side: THREE.DoubleSide });
  const pierre = phMat('marble_rock_02', 2, 2, { color: 0xf0e8dc }), bois = phMat('wood_cabinet_worn_long', 1, 2, { color: 0x6a8a6a });
  const B = (w, h, d, m, x, yy, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, yy, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  // le bâtiment (12 × 6 m), derrière le quai : de -2 à -8 en b
  B(12, 6.5 + F, 6, enduit, 0, 2.25 - F / 2, -11);
  for (const sx of [-1, 1]) { const t = B(13, 0.25, 3.9, tuiles, 0, 6.2, -11 + sx * 1.6); t.rotation.x = sx * 0.5; }
  for (const a of [-4, 0, 4]) { B(1.3, 2.6, 0.1, bois, a, 1.3, -7.95); B(1.7, 0.2, 0.2, pierre, a, 2.75, -7.9); }
  // le quai, sa marquise sur colonnettes de fonte
  B(26, 0.9 + F, 6, pierre, 0, 0.45 - F / 2, -5);
  const fonte = new THREE.MeshStandardMaterial({ color: 0x3a4a40, roughness: 0.5, metalness: 0.4 });
  for (const a of [-9, -3, 3, 9]) B(0.16, 3.6, 0.16, fonte, a, 2.7, -3.2);
  B(22, 0.12, 4.2, tuiles, 0, 4.55, -4.6).rotation.x = 0.08;
  // la voie : deux rails sur traverses, un heurtoir au bout
  const rail = new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 0.35, metalness: 0.7 }), trav = phMat('wood_planks', 2.4, 0.3, { color: 0x8a7a68 });
  for (let a = -15; a <= 23; a += 0.9) { const ya = sol(a, 0) - y, yb = sol(a + 0.9, 0) - y;
    B(0.25, 0.12, 2.4, trav, a, ya - 0.02, 0);
    if (a + 0.9 <= 23) for (const b of [-0.72, 0.72]) { const r = B(0.92, 0.16, 0.08, rail, a + 0.45, (ya + yb) / 2 + 0.08, b); r.rotation.z = Math.atan2(yb - ya, 0.9); } }
  B(0.6, 1.0, 2.4, phMat('wood_planks', 2.4, 1, { color: 0x8a3a2a }), -16.2, sol(-16.2, 0) - y + 0.5, 0);
  // on ne traverse ni le bâtiment ni le quai
  const r = (a0, a1, b0, b1) => { const q = [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)]; q.push(q[0]); inscrire(q, ...P((a0 + a1) / 2, (b0 + b1) / 2)); };
  r(-6, 6, -14, -8); r(-13, 13, -7.9, -2.1);
}

/**
 * Lance une ville. `propre` : ce que la page ajoute à sa fiche (le château de Matera, le port
 * de Gallipoli) — son `plus` passe après l'habillage, son `anime` à chaque image.
 */
export function ville(nom, propre = {}) {
  const f = { ...FICHES[nom], ...propre };
  const lieu = monde({ ...f, gare: { ...GARES[nom], lignes: lignes(nom) },
    // le temps qui court passe avant ce qui est propre à la ville (Nunzia lit son âge)
    anime: (now) => { tempsQuiCourt(now, nom); if (propre.anime) propre.anime(now); },
    toitSur: (b, g) => toitPouilles(b, g) || (propre.toitSur ? propre.toitSur(b, g) : false),
    plus: (ctx) => { const lav = f.murs === CHAUX ? LAVAGE : 0;
      // (les emprises du cœur, pour le muret du bord : relevées avant que habiller ne les oublie)
      BORD_MAISONS = ctx.PLAN.lointain ? MAISONS.map((m) => m.b.pts) : [];
      habiller(ctx, f.murs, lav); gare(ctx, GARES[nom], f.murs, lav);
      if (ctx.PLAN.lointain) { bord(ctx); lointain(ctx, f.murs, lav); }
      BORD_MAISONS = [];
      if (propre.plus) propre.plus(ctx); } });
  // le niveau naît dans monde() : l'objectif, le bandeau et le carnet de l'acte s'y branchent
  lieu.then(() => { if (!G.level || G.level.name !== nom || EN_INSTANCE) return;
    G.level.objective = objectif4; G.level.indices = carnet4;
    G.level.counts = () => `<small>${FICHES[nom].titre}</small><br><small>Objectif : ${objectif4()}</small>`; });
  return lieu;
}

// =====================================================================
//  L'ACTE IV — la Cloche des Heures (docs/DECOUPAGE-ACTE4.md, docs/DIALOGUES-ACTE4.md)
// =====================================================================
// L'acte passe d'une ville à l'autre : son avancement (state.acte4), le carnet du journal et le
// temps qui court sont ici, une fois pour les trois villes. Ce qui se passe dans une ville
// (Nunzia, le voisin, le Colosse) est dans son fichier, qui lit l'étape ici.

// Une instance du multi ne joue pas l'histoire : tloc-multi.js y tient le bandeau et l'arrivée
// (la même lecture que la page, avant que tloc-multi.js ne se charge)
export const EN_INSTANCE = (() => { try { const i = JSON.parse(localStorage.getItem('tloc_instance') || 'null'); return !!(i && i.code); } catch (e) { return false; } })();

const ETAPES4 = ['arrivee', 'quinze', 'grandpere', 'trente', 'rythme', 'soixante', 'corde', 'tambourin', 'chateau', 'colosse', 'heures', 'temple'];
export const etape4 = () => (EN_INSTANCE ? null : state.acte4 || null);
/** vrai si l'acte est arrivé à `e` (ou plus loin) */
export const passe4 = (e) => { const a = etape4(); return !!a && ETAPES4.indexOf(a) >= ETAPES4.indexOf(e); };
export function passer4(e) {
  if (passe4(e)) return;
  state.acte4 = e; saveGame(true);
}
// les indices de l'acte : écrits au carnet quand un témoin les donne, barrés quand c'est fait
const INDICES4 = {
  grandpere: { txt: 'Le grand-père de Nunzia a vu l’homme rouge. Il vit dans les Sassi de Matera.', qui: 'Nunzia, 15 ans', fait: () => passe4('grandpere') },
  ticket: { txt: 'Nunzia garde un ticket de train poinçonné, et tourne la tête au sifflet.', qui: 'Nunzia', fait: () => !!state.lettre4 },
  mot: { txt: 'Donato est mort. Son voisin m’a donné un mot pour Nunzia.', qui: 'le voisin, à Matera', fait: () => passe4('trente') },
  apprenti: { txt: 'L’apprenti du train qui regardait la mer a été envoyé au bout de la ligne, à Alberobello.', qui: 'le chef de dépôt, à Matera', fait: () => state.lettre4 === 'lettre' },
  chateau: { txt: 'L’homme rouge est monté au château de Matera, le Tramontano.', qui: 'Nunzia, 30 ans', fait: () => passe4('rythme') },
  rythme: { txt: 'Le château ne s’ouvre pas avec une clé, mais avec un rythme.', qui: 'un vieux des Sassi', fait: () => passe4('soixante') },
  joueuse: { txt: 'Le rythme, c’est la pizzica. La joueuse de tambourin d’Alberobello l’apprendra — la fille de Nunzia.', qui: 'Nunzia, 60 ans', fait: () => passe4('corde') },
  colosse: { txt: 'Le morceau de la Cloche des Heures est planté dans la poitrine du Colosse de Gallipoli.', qui: 'le sommet du donjon', fait: () => passe4('heures') },
  vers4: { txt: '« Chaque heure sauvée coûtera des années, et nul ne les rendra. »', qui: 'la dalle de la cour du château', fait: () => false },
  tarentules: { txt: 'Les tarentules ont volé la corde du tambourin. Elles viennent des grottes sous les remparts de Gallipoli, à marée basse.', qui: 'Assunta', fait: () => !!state.corde4 },
};
export function indice4(k) {
  state.ind4 = state.ind4 || {};
  if (state.ind4[k]) return;
  state.ind4[k] = true; showMessage('Indice noté au journal (J)', 3); saveGame(true);
}
function carnet4() {
  if (!state.ind4) return '';
  const l = Object.keys(INDICES4).filter((k) => state.ind4[k]).map((k) => { const i = INDICES4[k], f = i.fait();
    return `<div style="margin:4px 0;${f ? 'opacity:.5;text-decoration:line-through' : ''}">${i.txt} <span style="opacity:.6">— ${i.qui}</span></div>`; });
  return l.length ? `<h3 style="margin:18px 0 6px;color:#9fd0ff;font-size:16px;letter-spacing:1px">INDICES</h3><div style="padding:8px 14px;border-left:4px solid #9fd0ff;background:rgba(255,255,255,.06);border-radius:6px">${l.join('')}</div>` : '';
}
export function objectif4() {
  const ici = G.level && G.level.name;
  switch (etape4()) {
    case 'arrivee': return ici === 'gallipoli' ? 'Parle à la jeune fille de la jetée, au pied du géant de bronze'
      : 'Prends le petit train pour Gallipoli, la ville de la mer : le géant de bronze du port s’est mis à marcher';
    case 'quinze': return 'Trouve le grand-père de Nunzia, dans les Sassi de Matera (le petit train)';
    case 'grandpere': return 'Rapporte le mot de Donato à Nunzia, sur la jetée de Gallipoli';
    case 'trente': return 'Monte au château Tramontano, sur sa colline, à Matera';
    case 'rythme': return 'Retourne voir Nunzia, à Gallipoli : le château ne s’ouvre qu’à un rythme';
    case 'soixante': return 'Trouve la joueuse de tambourin, à Alberobello, près de la gare';
    case 'corde': return state.corde4 ? 'Rapporte la corde à Assunta, à Alberobello'
      : 'Va chercher la corde du tambourin dans la grotte sous le château de Gallipoli, à marée basse (par la jetée du Colosse)';
    case 'tambourin': return !(state.levier4 && state.levier4[0] && state.levier4[2])
      ? 'Château Tramontano, à Matera : ouvre les tours au tambourin (K devant une porte : trois coups, un silence), et trouve leurs leviers'
      : 'Ouvre la porte du donjon au tambourin, et monte au sommet';
    case 'chateau': return state.ind4 && state.ind4.vers4 ? 'Libère le Colosse, sur la jetée de Gallipoli : ralentis-le au tambourin'
      : 'Lis la dalle gravée, dans la cour du château, puis va libérer le Colosse à Gallipoli';
    case 'colosse': return 'Sonne la Cloche des Heures, sur la jetée de Gallipoli';
    case 'heures': return 'Retourne au Temple par la porte des Heures, à Alberobello (le petit train)';
    default: return 'Les Pouilles : ici, le temps court.';
  }
}

// ---------- les gens de l'acte : complètent PNJ.ROLES sans toucher pnj.js ----------
// Nunzia vieillit à chaque retour (STORY.md : « elle ne rajeunit jamais ») : les cheveux noirs
// grisonnent puis blanchissent, la blouse de lin devient le noir des veuves du Sud, le dos se
// voûte (le gabarit des vieux)
{ const N = PNJ.ROLES.nunzia, V = PNJ.ROLES.pecheur, C = PNJ.ROLES.cosimo;
  Object.assign(PNJ.ROLES, {
    nunzia30: N && { ...N, metier: 'nunzia30', gabarit: 'droite', h: N.h * 1.04, cheveuxC: 0x2a1e18, bas: 0x24425a },
    nunzia60: N && { ...N, metier: 'nunzia60', gabarit: 'droite', h: N.h * 1.02, cheveuxC: 0x8a8580, haut: 0x3a3634, valeur: 0.8, bas: 0x2a2a2e },
    nunzia75: N && { ...N, metier: 'nunzia75', gabarit: 'sec', h: N.h * 0.97, cheveuxC: 0xe8e4dc, haut: 0x262426, valeur: 0.8, bas: 0x1e1e22 },
    // le voisin de Donato, dans les Sassi : un vieux comme le pêcheur de Lille, debout, sans canne
    voisin_sassi: V && { ...V, metier: 'voisin_sassi', idle: 'Idle_FoldArms_Loop', tete: undefined, dos: undefined, haut: 0x6a5a48 },
    // le chef de dépôt de Matera : le bleu de Cosimo, plus vieux et barbu
    chef_depot: C && { ...C, metier: 'chef_depot', gabarit: 'droite', cheveuxC: 0x7a7470, barbe: 'coiffures_r:Hair_Beard', idle: 'Idle_Loop' },
    // l'apprenti qui a remplacé Cosimo sur le quai d'Alberobello
    apprenti: C && { ...C, metier: 'apprenti', cheveuxC: 0x5a3a20, idle: 'Idle_Loop' },
    // Cosimo vieux, devant son trullo : les cheveux blancs, le bleu de travail passé
    cosimo_vieux: C && { ...C, metier: 'cosimo_vieux', gabarit: 'sec', h: C.h * 0.97, cheveuxC: 0xdedad2, haut: 0x5a6a7a, valeur: 0.85, idle: 'Idle_Loop' },
    // le vieux des Sassi, contre la courtine du château
    vieux_sassi: V && { ...V, metier: 'vieux_sassi', idle: 'Idle_Loop', tete: undefined, dos: undefined, haut: 0x4a4038, bas: 0x3a3430 },
    // Assunta, la joueuse de tambourin : la fille de Nunzia, quarante ans, les cheveux noirs de
    // sa mère noués, la jupe rouge de la pizzica
    joueuse: N && { ...N, metier: 'joueuse', gabarit: 'droite', h: N.h * 1.03, cheveuxC: 0x1e1612, haut: 0xe8dcc4, bas: 0x8a2a24, valeurBas: 0.9 },
  }); }
// La lettre de Nunzia, la grande quête secondaire de l'acte (DECISIONS-RECIT.md § 1) : au journal
// avec les autres (setQuest : 1 la lettre confiée, 2 la boîte de Cosimo, 3 rendue sur le quai)
QUESTS.lettre = { title: 'La lettre de Nunzia', steps: [
  'Nunzia m’a confié une lettre pour l’apprenti du petit train, au bout de la ligne, à Alberobello. L’encre pâlit vite, ici.',
  'Cosimo m’a donné une boîte : toutes les lettres qu’il n’a jamais envoyées. Les porter à Nunzia, à Gallipoli.',
  'Terminée — Nunzia a lu les lettres sur le quai. Cette vie a eu lieu.'] };

/** le rôle de Nunzia selon l'étape : on la retrouve plus âgée à chaque retour */
export function roleNunzia() {
  return passe4('chateau') ? 'nunzia75' : passe4('rythme') ? 'nunzia60' : passe4('grandpere') ? 'nunzia30' : 'nunzia';
}

// =====================================================================
//  Le temps qui court (SCENARIO.md § 13, « le mal du temps »)
// =====================================================================
// La journée en deux minutes : le soleil fait le tour du ciel, la lumière passe du blanc de midi à
// l'orange puis au bleu de nuit. Tout par ce que le moteur exporte, comme la nuit de Lille
// (quetes.js) : SUN_DIR (que le ciel et l'ombre relisent à chaque image), sun, hemi, les couleurs
// du ciel, la brume. Pas une lumière de plus, et surtout pas de scene.environment basculé :
// chaque bascule recompile tous les shaders (une image figée deux fois par journée).
// À Gallipoli, la marée monte et descend de 1,2 m en trois minutes.
export const TEMPS = { maree: 0, lent: 1, jour: 1, phase: 0.3, tMaree: 0 };
const JOURNEE = 120, MAREE = 180;
let T4 = null;
const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const NUIT4 = { top: new THREE.Color(0x050a18), mid: new THREE.Color(0x0e1a34), bot: new THREE.Color(0x1c2840), soleil: new THREE.Color(0x9cb4e8), ciel: new THREE.Color(0x30426e), sol: new THREE.Color(0x0b0d14), brume: new THREE.Color(0x0c1220) };
const ORANGE = new THREE.Color(0xff9a50), cTmp = new THREE.Color();
function tempsQuiCourt(now, nom) {
  if (!state.running) return;
  if (!EN_INSTANCE && !state.acte4) passer4('arrivee');
  if (state.tambourin && !EN_INSTANCE && !AIDE.extra.some(([k]) => k === 'K')) AIDE.extra.push(['K', 'battre le tambourin']);
  const u = sky && sky.material.uniforms;
  if (!T4) {
    if (!u) return;
    T4 = { t: state.time, dir: SUN_DIR.clone(), top: u.top.value.clone(), mid: u.mid.value.clone(), bot: u.bot.value.clone(), cirrus: u.cirrus.value,
      sc: sun.color.clone(), si: sun.intensity, hc: hemi.color.clone(), hg: hemi.groundColor.clone(), hi: hemi.intensity,
      brume: scene.fog ? scene.fog.color.clone() : null, expo: renderer.toneMappingExposure, mer: null, merY: 0 };
    scene.traverse((o) => { if (!T4.mer && o.isMesh && o.geometry.type === 'CircleGeometry' && o.geometry.parameters.radius === 6000) { T4.mer = o; T4.merY = o.position.y; } });
  }
  // le temps reprend son pas quand la cloche des Heures a sonné ; en instance, il n'a jamais couru
  const court = !EN_INSTANCE && !passe4('heures');
  const dt = Math.max(0, Math.min(0.1, state.time - T4.t)); T4.t = state.time;
  if (!court) {
    // la cloche sonnée : le soleil finit de descendre, lentement, jusqu'au couchant, puis s'y tient
    // (en instance, le midi de la fiche)
    const but = EN_INSTANCE ? 0.3 : 0.46;
    if (T4.fige && TEMPS.phase === but) return;
    if (EN_INSTANCE || TEMPS.phase > but || TEMPS.phase < 0.2) TEMPS.phase = but; else TEMPS.phase = Math.min(but, TEMPS.phase + dt / 400);
    T4.fige = TEMPS.phase === but; TEMPS.maree = 0;
  }
  else { TEMPS.phase = (TEMPS.phase + dt * TEMPS.lent / JOURNEE) % 1; TEMPS.tMaree += dt * TEMPS.lent; }
  tambourinTick();
  const a = TEMPS.phase * TAU, s = Math.sin(a), j = lisse(-0.12, 0.22, s);
  TEMPS.jour = j;
  // la direction : le soleil le jour, la lune (à l'opposé) la nuit — toujours un peu levée, pour
  // que l'ombre reste sous les choses
  const c = s >= 0 ? 1 : -1;
  SUN_DIR.set(Math.cos(a) * c * 0.9, Math.max(0.14, Math.abs(s)), T4.dir.z).normalize();
  const bas = (1 - lisse(0.08, 0.5, s)) * j;          // l'orange du soleil bas
  u.top.value.copy(NUIT4.top).lerp(T4.top, j); u.mid.value.copy(NUIT4.mid).lerp(T4.mid, j).lerp(ORANGE, bas * 0.25); u.bot.value.copy(NUIT4.bot).lerp(T4.bot, j).lerp(ORANGE, bas * 0.45);
  u.cirrus.value = T4.cirrus * (0.2 + 0.8 * j);
  sun.color.copy(NUIT4.soleil).lerp(cTmp.copy(T4.sc).lerp(ORANGE, bas * 0.7), j); sun.intensity = 0.45 + (T4.si - 0.45) * j * (1 - bas * 0.4);
  hemi.color.copy(NUIT4.ciel).lerp(T4.hc, j); hemi.groundColor.copy(NUIT4.sol).lerp(T4.hg, j); hemi.intensity = 0.4 + (T4.hi - 0.4) * j;
  // la carte d'environnement du jour reste (la basculer recompile tout) : elle éclairait encore
  // les murs blancs et la mer en pleine nuit — c'est l'exposition qui baisse, un simple réglage
  renderer.toneMappingExposure = T4.expo * (0.45 + 0.55 * j);
  if (scene.fog && T4.brume) scene.fog.color.copy(NUIT4.brume).lerp(T4.brume, j).lerp(ORANGE, bas * 0.2);
  // la marée (Gallipoli) : le plan d'eau de monde.js monte et descend ; la règle de la mer
  // (bloque) reste celle du plan, à 60 cm près — on ne marche pas plus loin à marée basse
  if (T4.mer && court) { TEMPS.maree = Math.sin(TEMPS.tMaree * TAU / MAREE) * 0.6; T4.mer.position.y = T4.merY + TEMPS.maree; }
  else if (T4.mer) T4.mer.position.y = T4.merY;
}

/** un habitant de l'acte, né après le chargement (règle 8), posé, tourné, et sa parole */
export function naitre4(role, x, y, z, yaw, prompt, fn, r = 3.5) {
  const v = PNJ.buildRole(role); if (!v) return null;
  v.scale.setScalar(G.echelle); v.position.set(x, y, z); v.rotation.y = yaw; scene.add(v);
  addInteract({ pos: v.position, r, prompt: () => prompt, fn, enabled: () => v.visible });
  return v;
}

// =====================================================================
//  Le tambourin (acte IV, étape 8) — touche K, comme le gong de Thaïlande : un objet par monde
// =====================================================================
// La pizzica (trois coups, un silence) ralentit le temps autour de Camille pendant huit secondes :
// la journée et la marée presque arrêtées, les bêtes au ralenti. Un cercle de poussière dorée au
// sol dit jusqu'où. Les portes du château de Matera (lot 3) lisent le battement par `battu4`.
const LENT = 0.12, DUREE_LENT = 8;
export const TAMBOURIN = { jusqua: -1, cercle: null, battu: -1e9 };
const VITESSES = {};          // les vitesses des bêtes, rangées le temps du ralenti
export const battu4 = () => state.time - TAMBOURIN.battu;
// ce qui écoute le tambourin (les portes du château de Matera) : appelé à chaque battement compté
export const ECOUTE4 = [];
function battre() {
  if (!state.tambourin || EN_INSTANCE || !state.running || state.paused) return;
  if (state.time - TAMBOURIN.battu < 1.2) return;            // on finit sa mesure
  for (const f of ECOUTE4) f();
  TAMBOURIN.battu = state.time;
  // trois coups, les grelots du cercle : le son des écus est le plus proche
  [0, 180, 360].forEach((t) => setTimeout(() => SFX.piece(), t));
  TAMBOURIN.jusqua = state.time + DUREE_LENT; TEMPS.lent = LENT;
  for (const k of ['tarentule']) if (KINDS[k] && VITESSES[k] === undefined) { VITESSES[k] = KINDS[k].speed; KINDS[k].speed *= 0.25; }
  if (!TAMBOURIN.cercle) {
    const m = new THREE.Mesh(new THREE.RingGeometry(5.5, 7, 48), new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.userData.dynamic = true; scene.add(m); TAMBOURIN.cercle = m;
  }
}
TOUCHES.KeyK = battre;
// à chaque image (tempsQuiCourt) : le ralenti qui finit, le cercle qui suit Camille et s'éteint
function tambourinTick() {
  const reste = TAMBOURIN.jusqua - state.time;
  if (reste <= 0 && TEMPS.lent !== 1) { TEMPS.lent = 1; for (const k in VITESSES) { KINDS[k].speed = VITESSES[k]; delete VITESSES[k]; } }
  const c = TAMBOURIN.cercle; if (!c) return;
  c.visible = reste > 0;
  if (reste > 0) { c.position.set(player.pos.x, player.pos.y + 0.08, player.pos.z); c.material.opacity = 0.35 * Math.min(1, reste) * (0.8 + 0.2 * Math.sin(state.time * 6)); }
}
/** Assunta recorde le tambourin et le donne (alberobello.js) */
export function donnerTambourin() { state.tambourin = true; passer4('tambourin'); SFX.pickup(); }
