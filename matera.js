// Les Pouilles — matera (pouilles.js : la fiche et l'habillage ; monde.js : la recette)
// =====================================================================
// Ce qui n'est qu'à Matera : le château Tramontano, le donjon de l'acte IV (STORY.md ; il
// remplace Castel del Monte, Eugène, 2 octobre). Un château resté inachevé, sur sa colline
// au-dessus des Sassi : trois tours rondes alignées — le grand donjon au milieu, deux tours
// plus basses aux bouts — reliées par des courtines crénelées, et une cour fermée à l'arrière
// par des murs plus bas, jamais montés à leur hauteur. Les centres et les rayons sont lus sur
// l'emprise d'OSM (retirée du plan par carte/mondes/gradins-pouilles.py).
// =====================================================================
import { ville } from './pouilles.js';
import { THREE, TAU, scene, phMat } from './engine.js?v=41';
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

ville('matera', { plus: chateau });
