// campagne.js — hors les murs.
//
// Secteur Campagne : maison de Camille, chaumière du vieux mage, moulin d'Émile et ses
// champs, route du pont au village.
import * as E from './engine.js?v=27';
import {
  THREE, IRON, Q, STEEL, T, TAU, addBox, addCap, addInteract, addLieu, boxG, brickScaled,
  clamp, corniceAround, distSeg, goToLevel, lerp, makeCanvas, mat, mergeParts, mesh, pbr,
  pbrRepeat, phMat, rand, rboxG, scene, sphG, state, stoneMat, tex, wallBox, world,
} from './engine.js?v=27';
import {
  CHAMPS, ECH, FERME, HOUSE, MAGE, MOAT_OUT, cobbles, levelBlocked, libreNature, margePlate,
  nearTown, patinerMat, roadPts, sdPent, solPlaine, HOUSE_SMOKE_TOP,
} from './carte.js';
import { makeDoor, makeVolet } from './menuiserie.js';
import { PARTAGE } from './etat.js';
import { faucherChamp, meuleFauchable, perf } from './nature.js';
import * as BOURSE from './bourse.js';

export let WHEAT_TEX = null;

export function wheatBladeTexture() {
  const W = 64, H = 128, [c, x] = makeCanvas(W, H);
  x.clearRect(0, 0, W, H);
  for (let k = 0; k < 4; k++) {
    const bx = 8 + k * 16 + rand(-2, 2), lean = rand(-5, 5);
    const g1 = x.createLinearGradient(0, H, 0, 0);
    g1.addColorStop(0, '#8d8a3e'); g1.addColorStop(0.55, '#c9b45c'); g1.addColorStop(1, '#e6cf7d');
    x.strokeStyle = g1; x.lineWidth = 2.2; x.beginPath();
    x.moveTo(bx, H); x.quadraticCurveTo(bx + lean * 0.5, H * 0.5, bx + lean, H * 0.30); x.stroke();
    // grains
    x.fillStyle = '#e8d283';
    for (let e = 0; e < 7; e++) {
      const t = e / 7, yy = H * 0.30 + t * H * 0.16, xx = bx + lean * (1 - t * 0.3);
      x.beginPath(); x.ellipse(xx - 2.6, yy, 2.1, 3.4, -0.35, 0, TAU); x.fill();
      x.beginPath(); x.ellipse(xx + 2.6, yy, 2.1, 3.4, 0.35, 0, TAU); x.fill();
    }
    // barbes
    x.strokeStyle = 'rgba(232,214,150,0.75)'; x.lineWidth = 0.8;
    for (let e = 0; e < 5; e++) { x.beginPath(); x.moveTo(bx + lean, H * 0.30); x.lineTo(bx + lean + rand(-7, 7), H * 0.30 - rand(8, 18)); x.stroke(); }
  }
  return tex(c, 1, true);
}

// Poser au sol ce qu'une fonction a construit à la cote 0. Ces maisons ont été dessinées
// sur une plaine plate ; le relevé IGN, lui, met la maison de Camille 1,8 m plus bas et la
// clairière du mage 0,87 m plus haut : l'une flottait, l'autre était enterrée. Plutôt que
// de reprendre chaque ligne, on décale d'un bloc tout ce qui a été ajouté à la scène.
function poserAuSol(y, bati) {
  const avant = scene.children.length;
  bati();
  for (let i = avant; i < scene.children.length; i++) scene.children[i].position.y += y;
  // la fumée repart du haut de SA cheminée, pas d'une cote absolue (cf. game.js)
  for (let i = avant; i < scene.children.length; i++) { const o = scene.children[i];
    if (o.userData.smoke !== undefined) { o.userData.smokeBase = o.position.y - o.userData.smoke * 0.9; o.userData.smokeTop = o.userData.smokeBase + (HOUSE_SMOKE_TOP - 7.4); } }
}

export function buildHouse() {
  // la cote du seuil, devant la porte (côté est) : le terrain descend d'un demi-mètre vers
  // l'ouest, que le soubassement rattrape
  const Y0 = solPlaine(HOUSE.x + HOUSE.w / 2 + 1.2, HOUSE.z);
  poserAuSol(Y0, () => batirMaison(Y0));
}
function batirMaison(Y0) {
  const Hs = HOUSE, x = Hs.x, z = Hs.z, w = Hs.w, d = Hs.d, wallH = 3.4;
  const wallMat = pbrRepeat(T.stone, 2, 1, { color: 0xe6dccb, roughness: 0.95 });
  // soubassement : il descend à 2,55 m sous le seuil, de quoi rejoindre le bas de la pente
  const base = new THREE.Mesh(rboxG(w + 0.8, 3.0, d + 0.8, 0.1, 2), pbrRepeat(T.stone, 3, 2, { color: 0x8a8078 })); base.position.set(x, -1.05, z); base.receiveShadow = true; scene.add(base);
  { const hg = new THREE.Group(); scene.add(hg); const st = pbr(T.stone, { roughness: 0.9, color: 0x9a9088 });
    corniceAround(hg, x, 0.45, z, w / 2 + 0.4, d / 2 + 0.4, st, 0.16, 0.16, 'ovolo'); corniceAround(hg, x, wallH - 0.35, z, w / 2 + 0.2, d / 2 + 0.2, mat(0x4a3320, { roughness: 0.9 }), 0.35, 0.3, 'cavet');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) hg.add(mesh(new THREE.CylinderGeometry(0.32, 0.4, wallH - 0.35, 10), st, x + sx * (w / 2), 0.45 + (wallH - 0.35) / 2, z + sz * (d / 2))); }
  const walls = [[x - w / 2, z - d / 2, x + w / 2, z - d / 2], [x - w / 2, z + d / 2, x + w / 2, z + d / 2], [x - w / 2, z - d / 2, x - w / 2, z + d / 2], [x + w / 2, z - d / 2, x + w / 2, z + d / 2]];
  for (const sg of walls) { wallBox(sg[0], sg[1], sg[2], sg[3], wallH, 0.4, wallMat); addCap(sg[0], sg[1], sg[2], sg[3], 0.25, wallH + 3); }
  addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, wallH + 2.6);
  for (const sg of walls) { const n = 3; for (let k = 0; k <= n; k++) { const t = k / n; scene.add(mesh(boxG(0.18, wallH, 0.5), mat(0x4a3320), sg[0] + (sg[2] - sg[0]) * t, wallH / 2, sg[1] + (sg[3] - sg[1]) * t)); } }
  for (const sg of walls) { const m = mesh(boxG(Math.hypot(sg[2] - sg[0], sg[3] - sg[1]) + 0.3, 0.2, 0.5), mat(0x4a3320), (sg[0] + sg[2]) / 2, wallH, (sg[1] + sg[3]) / 2); m.rotation.y = -Math.atan2(sg[3] - sg[1], sg[2] - sg[0]); scene.add(m); }
  // porte (côté est) avec auvent, fenêtres à carreaux, jardinières
  const doorX = x + w / 2, doorZ = z;
  // LA PORTE SORT DU MUR. Posée à 6 cm de l'axe d'un mur de 40 cm, elle restait noyée dans
  // la maçonnerie : de dehors, on ne voyait qu'un mur. Et le vantail est en retrait de
  // l'encadrement (l'embrasure, `recess`) : l'encadrement se pose donc DEVANT le cordon du
  // soubassement (qui déborde de 40 cm), et l'embrasure, assez profonde, revient jusqu'au
  // nu du mur — le vantail est au nu, rien ne passe plus devant.
  { const saillie = 0.62, dp = makeDoor(1.35, 2.3, { color: 0x1f4a4a, arc: true, lanterne: true, chaud: true, recess: saillie - 0.2,
      pierre: pbr(T.stone, { roughness: 0.9, color: 0xb8ab99 }) });
    dp.position.set(doorX + saillie, 0, doorZ); dp.rotation.y = Math.PI / 2; scene.add(dp); }
  const awning = mesh(boxG(1.8, 0.15, 2.6), pbrRepeat(T.plank, 2, 2, { color: 0x8a5a3a }), doorX + 0.9, 3.1, doorZ); awning.rotation.z = 0.35; scene.add(awning);
  for (const sx of [-1, 1]) scene.add(mesh(boxG(0.14, 3.0, 0.14), mat(0x4a3320), doorX + 1.5, 1.5, doorZ + sx * 1.1));
  for (const p of [[x - 2, z - d / 2], [x + 2, z - d / 2], [x, z + d / 2], [x - w / 2, z - 1.5], [x - w / 2, z + 1.5]]) {
    const win = mesh(boxG(1.2, 1.2, 0.5), mat(0xffe9b0, { roughness: 0.2, emissive: 0xffd080, emissiveIntensity: 0.5 }), p[0], 2.0, p[1]); if (p[0] === x - w / 2) win.rotation.y = Math.PI / 2; scene.add(win);
    const cross = mesh(boxG(1.25, 0.08, 0.55), mat(0x4a3320), p[0], 2.0, p[1]); if (p[0] === x - w / 2) cross.rotation.y = Math.PI / 2; scene.add(cross);
    const cross2 = mesh(boxG(0.08, 1.25, 0.55), mat(0x4a3320), p[0], 2.0, p[1]); if (p[0] === x - w / 2) cross2.rotation.y = Math.PI / 2; scene.add(cross2);
    const box = mesh(boxG(1.3, 0.3, 0.5), pbrRepeat(T.plank, 1, 1), p[0], 1.3, p[1] + (p[1] < z ? -0.4 : 0.4)); if (p[0] === x - w / 2) { box.rotation.y = Math.PI / 2; box.position.set(p[0] - 0.4, 1.3, p[1]); } scene.add(box);
    for (let f = 0; f < 3; f++) { const fl = mesh(sphG(0.12, 6), mat([0xe04060, 0xffd040, 0xff8040][f]), box.position.x + (box.rotation.y ? 0 : (f - 1) * 0.35), 1.6, box.position.z + (box.rotation.y ? (f - 1) * 0.35 : 0)); scene.add(fl); }
  }
  // toit à deux pans + cheminée fumante
  PARTAGE.houseRoof = new THREE.Group();
  for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 0.3, d / 2 + 1.2), pbrRepeat(T.plank, 4, 2, { color: 0x8a5a3a })); r.position.set(0, wallH + 1.35, sx * (d / 4 + 0.15)); r.rotation.x = sx * 0.62; r.castShadow = true; PARTAGE.houseRoof.add(r); }
  PARTAGE.houseRoof.add(mesh(boxG(w + 1.7, 0.25, 0.5), mat(0x4a3320), 0, wallH + 2.5, 0));
  { const tri = new THREE.Shape(); tri.moveTo(-d / 2 - 0.2, 0); tri.lineTo(d / 2 + 0.2, 0); tri.lineTo(0, 2.55); tri.closePath();
    for (const sx of [-1, 1]) { const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.4, bevelEnabled: false }), wallMat); gable.rotation.y = Math.PI / 2; gable.position.set(sx * w / 2 - 0.2, wallH, 0); gable.castShadow = true; PARTAGE.houseRoof.add(gable); } }
  PARTAGE.houseRoof.add(mesh(boxG(1, 3, 1), brickScaled(1, 3), -3, wallH + 2.2, -1.5));
  PARTAGE.houseRoof.position.set(x, 0, z); scene.add(PARTAGE.houseRoof);
  for (let k = 0; k < 4; k++) { const puff = new THREE.Mesh(sphG(0.35 + k * 0.12, 8), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.35 - k * 0.07 })); puff.position.set(x - 3 + k * 0.3, wallH + 4 + k * 0.9, z - 1.5); puff.userData.smoke = k; scene.add(puff); }
  // chemin, barrière, panneau, potager
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 7), pbrRepeat(T.dirt, 1, 3)); path.rotation.x = -Math.PI / 2; path.position.set(x + w / 2 + 3.5, 0.02, z); path.receiveShadow = true; scene.add(path);
  const sign = mesh(boxG(1.4, 0.5, 0.08), pbrRepeat(T.plank, 1, 1), x + w / 2 + 2.2, 1.6, z - 2.2); scene.add(sign); scene.add(mesh(boxG(0.12, 1.6, 0.12), mat(0x4a3320), x + w / 2 + 2.2, 0.8, z - 2.2));
  for (let k = 0; k < 6; k++) scene.add(mesh(boxG(0.12, 0.9, 0.12), mat(0x6a4a2a), x + w / 2 + 1.5, 0.45, z + 2.5 + k * 0.7));
  for (let k = 0; k < 5; k++) { scene.add(mesh(boxG(0.12, 0.9, 0.12), mat(0x6a4a2a), x + w / 2 + 1.5 + k * 0.7, 0.45, z + 6)); }
  for (let k = 0; k < 8; k++) { const veg = mesh(sphG(0.28, 8), mat(k % 2 ? 0x4a8a3a : 0x7aa040), x + w / 2 + 2.3 + (k % 4) * 0.8, 0.3, z + 3.2 + Math.floor(k / 4) * 1.2); scene.add(veg); }
  addInteract({ pos: new THREE.Vector3(doorX + 1.2, Y0, doorZ), r: 1.8, prompt: () => 'entrer dans la maison', fn: () => goToLevel('house', [0, 0, 4.4], Math.PI, 'Camille rentre chez elle…') });
}
// ---------- la chaumière du vieux mage, cachée au fond du bois ----------
// Rien ne la signale : c'est un client de l'estaminet qui en parle (state.mageIndice),
// et elle n'entre sur la minimap qu'une fois qu'on a mis le pied dans la clairière
// (addLieu + state.decouverts, côté moteur). La clairière est réservée en amont :
// libreNature y interdit les arbres, margePlate y aplanit le sol et écarte les buttes.

export function buildMaisonMage() {
  const Y0 = solPlaine(MAGE.x, MAGE.z);               // la clairière est plate, à +0,87 m
  poserAuSol(Y0, () => batirMaisonMage(Y0));
}
function batirMaisonMage(Y0) {
  // L'emprise EXTERIEURE commande l'interieur : mage.js batit une salle de 9,0 x 7,2 x 3,4,
  // soit exactement ce que laissent ces murs de 9,4 x 7,6 epais de 20 cm. Pas de piece plus
  // grande que la maison qui la contient (c'est le reproche fait a la chapelle).
  const MX = MAGE.x, MZ = MAGE.z, LW = 9.4, LD = 7.6, HW = 3.4;      // emprise et hauteur des murs
  const YA = -0.38, cs = Math.cos(YA), sn = Math.sin(YA);            // la maison est posée de guingois
  const W2m = (lx, lz) => [MX + lx * cs + lz * sn, MZ - lx * sn + lz * cs];
  const capL = (ax, az, bx, bz, r, top = Infinity) => addCap(...W2m(ax, az), ...W2m(bx, bz), r, top);
  const g = new THREE.Group(); g.position.set(MX, 0, MZ); g.rotation.y = YA; scene.add(g);

  const pierre = phMat('old_stone_wall_02', 2.6, 2.6, { color: 0xa79d8a });
  const torchis = phMat('brown_mud_03', 3.0, 3.0, { color: 0xc3b394 });
  const chaume = phMat('withered_grass', 2.4, 2.4, { color: 0xac9660, roughness: 1 });
  const bois = phMat('wood_cabinet_worn_long', 2.0, 2.0, { color: 0x5b4330 });
  const rondin = phMat('tree_trunk', 1.6, 1.6, { color: 0x6a5744 });
  const mousseM = phMat('mousse', 1.2, 1.2, { color: 0x6d7f4a, roughness: 1 });
  const vitreV = mat(0xd8e8b0, { roughness: 0.15, emissive: 0x9ad44a, emissiveIntensity: 0.85, transparent: true, opacity: 0.9 });

  // ---- clairière : sous-bois piétiné, souches, cercle de champignons ----
  { const sol = new THREE.Mesh(new THREE.CircleGeometry(MAGE.clair + 1.5, 36), phMat('forest_ground_04', 2 * (MAGE.clair + 1.5), 2 * (MAGE.clair + 1.5), { color: 0x9a8f78 }));
    sol.rotation.x = -Math.PI / 2; sol.position.set(MX, 0.02, MZ); sol.receiveShadow = true; scene.add(sol); }
  for (let k = 0; k < 7; k++) { const a = k * TAU / 7 + 0.4, r = rand(7.5, 11.5), sx = MX + Math.cos(a) * r, sz = MZ + Math.sin(a) * r;
    const st = mesh(new THREE.CylinderGeometry(0.55, 0.7, rand(0.5, 0.95), 9), rondin, sx, 0.3, sz); st.rotation.y = rand(0, TAU); scene.add(st);
    scene.add(mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 9), mousseM, sx, 0.62, sz));
    addCap(sx, sz, sx, sz, 0.6, 0.9); }
  // cercle de fées devant la porte : chapeaux rouges à points blancs
  for (let k = 0; k < 11; k++) { const a = k * TAU / 11, r = 3.8 + Math.sin(k * 2.1) * 0.4, mx = MX + Math.cos(a) * r + 2.5, mz = MZ + Math.sin(a) * r + 6.5;
    const h = rand(0.16, 0.3); scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 7), mat(0xf0e6d0, { roughness: 1 }), mx, h / 2, mz));
    { const cha = mesh(sphG(0.17, 9), mat(0xb8302a, { roughness: 0.75 }), mx, h + 0.02, mz); cha.scale.y = 0.62; scene.add(cha); }
    for (let j = 0; j < 4; j++) scene.add(mesh(sphG(0.028, 5), mat(0xf4f0e4), mx + Math.cos(j * 1.7) * 0.1, h + 0.1, mz + Math.sin(j * 1.7) * 0.1)); }

  // ---- soubassement de pierre, murs de torchis, colombage ----
  g.add(mesh(rboxG(LW + 0.55, 0.95, LD + 0.55, 0.1, 2), pierre, 0, 0.45, 0));
  { const m = new THREE.Mesh(rboxG(LW, HW, LD, 0.12, 2), torchis); m.position.y = 0.9 + HW / 2; m.castShadow = m.receiveShadow = true; g.add(m); }
  const murs = [[-LW / 2, -LD / 2, LW / 2, -LD / 2], [-LW / 2, LD / 2, LW / 2, LD / 2], [-LW / 2, -LD / 2, -LW / 2, LD / 2], [LW / 2, -LD / 2, LW / 2, LD / 2]];
  for (const [ax, az, bx, bz] of murs) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.5);
    for (let k = 0; k <= n; k++) { const t = k / n, po = mesh(boxG(0.19, HW, 0.2), bois, ax + (bx - ax) * t, 0.9 + HW / 2, az + (bz - az) * t); po.rotation.y = -Math.atan2(bz - az, bx - ax); g.add(po); }
    for (const yy of [0.9 + 0.08, 0.9 + HW - 0.1]) { const sb = mesh(boxG(len + 0.1, 0.2, 0.22), bois, (ax + bx) / 2, yy, (az + bz) / 2); sb.rotation.y = -Math.atan2(bz - az, bx - ax); g.add(sb); }
    capL(ax, az, bx, bz, 0.32, HW + 6);
  }
  // ---- toit de chaume très pentu, débordant, faîtière arrondie ----
  const PENTE = 0.86, HT = 3.5;
  for (const sx of [-1, 1]) { const pan = new THREE.Mesh(new THREE.BoxGeometry(LW + 1.9, 0.55, LD / 2 + 1.5), chaume);
    pan.position.set(0, 0.9 + HW + HT / 2 - 0.25, sx * (LD / 4 + 0.62)); pan.rotation.x = sx * PENTE; pan.castShadow = true; g.add(pan); }
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, LW + 1.9, 10), chaume, 0, 0.9 + HW + HT - 0.35, 0).rotateZ(Math.PI / 2));
  { const tri = new THREE.Shape(); tri.moveTo(-LD / 2 - 0.15, 0); tri.lineTo(LD / 2 + 0.15, 0); tri.lineTo(0, HT - 0.35); tri.closePath();
    for (const sx of [-1, 1]) { const pg2 = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false }), torchis); pg2.rotation.y = Math.PI / 2; pg2.position.set(sx * (LW / 2) - (sx > 0 ? 0 : 0.3), 0.9 + HW, 0); pg2.castShadow = true; g.add(pg2); } }
  // mousse et courges sur le chaume : un toit de chaume neuf, ça n'existe pas chez un vieux mage
  for (let k = 0; k < 9; k++) { const sx = k % 2 ? 1 : -1, t = rand(0.15, 0.85);
    const pl = mesh(sphG(rand(0.22, 0.4), 7), mousseM, rand(-LW / 2, LW / 2), 0.9 + HW + (1 - t) * (HT - 0.5) + 0.2, sx * t * (LD / 2 + 1.1)); pl.rotation.x = sx * PENTE; g.add(pl); }

  // ---- cheminée de pierre en pignon ouest, fumée verte ----
  { const ch = mesh(rboxG(1.1, 6.4, 1.0, 0.08, 2), pierre, -LW / 2 - 0.25, 3.2, -0.7); ch.castShadow = true; g.add(ch);
    g.add(mesh(rboxG(1.45, 0.3, 1.35, 0.06, 2), pierre, -LW / 2 - 0.25, 6.5, -0.7));
    for (const sx of [-1, 1]) g.add(mesh(boxG(0.16, 0.5, 0.16), IRON(), -LW / 2 - 0.25 + sx * 0.5, 6.85, -0.7));
    g.add(mesh(boxG(1.2, 0.12, 0.12), IRON(), -LW / 2 - 0.25, 7.05, -0.7)); }
  { const [fx, fz] = W2m(-LW / 2 - 0.25, -0.7);
    for (let k = 0; k < 5; k++) { const puff = new THREE.Mesh(sphG(0.3 + k * 0.14, 8), new THREE.MeshBasicMaterial({ color: 0xbfe0a8, transparent: true, opacity: 0.32 - k * 0.05 }));
      puff.position.set(fx + rand(-0.2, 0.2), 7.3 + k * 0.9, fz); puff.userData.smoke = k; scene.add(puff); } }

  // ---- porte en arc (sud) sous un porche de guingois ----
  { const porte = makeDoor(1.3, 2.3, { rustique: true, arc: true, imposte: false, recess: 0.3, lanterne: true, pierre });
    porte.position.set(1.4, 0.9, LD / 2 + 0.02); g.add(porte);
    // le seuil : trois dalles posées à même la terre, pour rattraper les 90 cm de soubassement
    for (let k = 0; k < 3; k++) g.add(mesh(rboxG(2.0 - k * 0.15, 0.3, 0.7, 0.05, 2), pierre, 1.4, 0.75 - k * 0.3, LD / 2 + 0.5 + k * 0.6));
    for (const sx of [-1, 1]) { const po = mesh(new THREE.CylinderGeometry(0.13, 0.17, 2.9, 8), rondin, 1.4 + sx * 1.35, 1.45 + 0.9 - 0.9, LD / 2 + 1.5); po.rotation.z = sx * 0.05; g.add(po); capL(1.4 + sx * 1.35, LD / 2 + 1.5, 1.4 + sx * 1.35, LD / 2 + 1.5, 0.2, 3.2); }
    const auv = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 2.3), chaume); auv.position.set(1.4, 3.35, LD / 2 + 1.1); auv.rotation.x = 0.36; auv.castShadow = true; g.add(auv);
    // bottes d'herbes séchées suspendues sous l'auvent
    for (let k = 0; k < 5; k++) { const hx = 0.2 + k * 0.6, bo = mesh(new THREE.ConeGeometry(0.13, 0.55, 6), mat([0x7a8a3a, 0x9a8a4a, 0x6a7a45][k % 3], { roughness: 1 }), hx, 2.62, LD / 2 + 1.35); bo.rotation.x = Math.PI; g.add(bo);
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), mat(0xcfc0a0), hx, 3.05, LD / 2 + 1.35)); } }
  { const [ix, iz] = W2m(1.4, LD / 2 + 2.6);
    addInteract({ pos: new THREE.Vector3(ix, Y0, iz), r: 2.1, prompt: () => 'entrer chez le vieux mage',
      fn: () => goToLevel('mage', [1.4, 0, 2.9], Math.PI, 'Camille pousse la porte de la chaumière…') }); }

  // ---- fenêtres à petits carreaux, lueur verte du laboratoire ----
  for (const [lx, lz, ry] of [[-1.9, LD / 2 + 0.02, 0], [LW / 2 + 0.02, 1.4, Math.PI / 2], [-LW / 2 - 0.02, 1.6, -Math.PI / 2]]) {
    const wg = new THREE.Group(); wg.position.set(lx, 2.15, lz); wg.rotation.y = ry; g.add(wg);
    wg.add(mesh(boxG(1.05, 1.05, 0.14), vitreV, 0, 0, 0));
    for (const o of [-0.34, 0, 0.34]) { wg.add(mesh(boxG(1.1, 0.06, 0.2), bois, 0, o, 0.02)); wg.add(mesh(boxG(0.06, 1.1, 0.2), bois, o, 0, 0.02)); }
    wg.add(mesh(boxG(1.35, 0.14, 0.4), bois, 0, -0.62, 0.06));
    for (const sx of [-1, 1]) { const vol = mesh(boxG(0.55, 1.2, 0.07), bois, sx * 0.84, 0, 0.16); vol.rotation.y = sx * 0.5; wg.add(vol); }
  }
  { const [lx, lz] = W2m(0, LD / 2 + 1.4); const l = new THREE.PointLight(0xaee36a, 5, 13, 1.7); l.position.set(lx, 2.6, lz); scene.add(l); }

  // ---- puits moussu, tas de bûches, billot, potager de branchages, menhir ----
  { const [px, pz] = W2m(-5.6, 3.6);
    scene.add(mesh(new THREE.CylinderGeometry(1.0, 1.1, 1.0, 16), phMat('rock_moss_01', 2.2, 1.2, { color: 0x8c8a72 }), px, 0.5, pz));
    scene.add(mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.1, 16), new THREE.MeshBasicMaterial({ color: 0x0a1410 }), px, 0.97, pz));
    for (const sx of [-1, 1]) scene.add(mesh(boxG(0.14, 2.0, 0.14), rondin, px + sx * 0.9, 2.0, pz));
    scene.add(mesh(boxG(2.4, 0.16, 0.9), rondin, px, 3.05, pz).rotateZ(0.06));
    scene.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 8), rondin, px, 2.85, pz).rotateZ(Math.PI / 2));
    scene.add(mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.34, 10), bois, px, 2.2, pz)); scene.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), IRON(), px, 2.62, pz));
    addCap(px, pz, px, pz, 1.15, 1.2); }
  { const [bx, bz] = W2m(6.6, 2.4);
    for (let k = 0; k < 14; k++) { const r = 0.14 + (k % 3) * 0.02, bu = mesh(new THREE.CylinderGeometry(r, r, 1.5, 8), rondin, bx + ((k % 5) - 2) * 0.31, 0.16 + Math.floor(k / 5) * 0.3, bz); bu.rotation.z = Math.PI / 2; bu.rotation.y = rand(-0.05, 0.05); scene.add(bu); }
    addCap(bx - 0.8, bz, bx + 0.8, bz, 0.45, 1.1);
    const bil = mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.65, 12), rondin, bx + 1.9, 0.32, bz + 1.4); scene.add(bil); addCap(bx + 1.9, bz + 1.4, bx + 1.9, bz + 1.4, 0.45, 0.8);
    scene.add(mesh(boxG(0.06, 0.8, 0.05), bois, bx + 1.9, 1.0, bz + 1.4).rotateZ(0.25)); scene.add(mesh(boxG(0.26, 0.16, 0.06), STEEL(), bx + 1.95, 1.38, bz + 1.4).rotateZ(0.25)); }
  { const [gx0, gz0] = W2m(-3.0, -5.6);                                     // carré d'herbes, clos de branchages
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, px = gx0 + Math.cos(a) * 2.4, pz = gz0 + Math.sin(a) * 2.0;
      const br = mesh(new THREE.CylinderGeometry(0.035, 0.05, rand(0.8, 1.15), 5), rondin, px, 0.5, pz); br.rotation.z = rand(-0.14, 0.14); scene.add(br); }
    for (let k = 0; k < 18; k++) { const px = gx0 + rand(-1.9, 1.9), pz = gz0 + rand(-1.5, 1.5);
      scene.add(mesh(sphG(rand(0.18, 0.3), 7), mat([0x5a7a3a, 0x7a8a45, 0x466a38, 0x8a7a4a][k % 4], { roughness: 1 }), px, 0.22, pz)); }
    addCap(gx0, gz0, gx0, gz0, 2.3, 1.1); }
  { const [nx, nz] = W2m(7.0, -4.2);                                        // menhir moussu, à demi enfoui
    const me = mesh(rboxG(1.0, 3.2, 0.75, 0.16, 2), phMat('rock_moss_02', 2.0, 3.4, { color: 0x847e68 }), nx, 1.4, nz);
    me.rotation.z = 0.13; me.rotation.y = 0.6; me.castShadow = true; scene.add(me); addCap(nx, nz, nx, nz, 0.7, 3.4); }

  // ---- feux PARTAGE.follets : trois lucioles vertes qui tournent dans la clairière ----
  for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(sphG(0.09, 8), new THREE.MeshBasicMaterial({ color: 0xbdf07a, transparent: true, opacity: 0.85 }));
    f.userData = { dynamic: true, follet: { a: k * 2.1, r: 5.5 + k * 2.2, h: 1.2 + k * 0.5, v: 0.32 + k * 0.08 } }; scene.add(f); PARTAGE.follets.push(f); }

  E.addLieu({ id: 'mage', nom: 'la chaumière du vieux mage', x: MX, z: MZ, r: 15 });
}

// =====================================================================
//  La route du pont au village
// =====================================================================
// Depuis la bascule 1:1 il y a 280 m entre le pied du pont et la Porte des Flandres, et
// le tracé de `carte.js` les traversait à nu. Ce qui suit habite ce trajet sans toucher à
// la géométrie : tout s'exprime en (s, décalage) le long de la courbe de `roadPts()` et se
// pose sur `solPlaine()`. Si la route bouge, le décor la suit.
//
// Deux contraintes commandent tout le reste.
//
// 1. `buildCountryside` passe APRÈS `buildVegetation` : les arbres sont déjà plantés,
//    partout où `libreNature` est vraie, c'est-à-dire partout SAUF un couloir de 7 m de
//    part et d'autre de l'axe. On ne peut ni les déplacer ni les prévoir. On relève donc
//    une fois les capsules déjà posées (`releverObstacles`) et tout ce qui déborde du
//    couloir va se loger dans les trous qu'elles laissent (`placeLibre`). Le hameau, la
//    pâture et le lavoir ne sont donc pas à une adresse écrite en dur : ils sont cherchés.
//
// 2. Le sol n'est plat que dans le couloir (`margePlate` = distance à la route − 6 m).
//    Au-delà il ondule : chaque point se pose à `solPlaine(x, z)`, jamais à y = 0.
//
// Époque : Vauban. Pas de clôture moderne — haie d'aubépine sur talus, fossé, trognes de
// saule, barrière à claire-voie de chêne, muret de brique et de grès.

const RTE = { ech: null, L: 0 };

function rteInit() {
  if (RTE.ech) return;
  const cv = new THREE.CatmullRomCurve3(roadPts().map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const N = 260, ech = [];
  let s = 0, px = 0, pz = 0;
  for (let i = 0; i <= N; i++) {
    const p = cv.getPoint(i / N), t = cv.getTangent(i / N);
    if (i) s += Math.hypot(p.x - px, p.z - pz);
    ech.push({ x: p.x, z: p.z, tx: t.x, tz: t.z, nx: t.z, nz: -t.x, s });
    px = p.x; pz = p.z;
  }
  RTE.ech = ech; RTE.L = s;
}
// point de la route à l'abscisse curviligne s, écarté de `off` mètres sur la normale.
// `off` > 0 = côté gauche en descendant vers le village. Renvoie aussi le lacet de la route :
// l'ancienne version posait les bornes à « x + 3,9 », ce qui les plantait au milieu de la
// chaussée dès que la route partait vers l'est.
function rte(s, off = 0) {
  const A = RTE.ech, n = A.length, sc = clamp(s, 0, RTE.L);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m].s <= sc) lo = m; else hi = m; }
  const a = A[lo], b = A[hi], ds = b.s - a.s, k = ds > 1e-6 ? (sc - a.s) / ds : 0;
  let nx = lerp(a.nx, b.nx, k), nz = lerp(a.nz, b.nz, k);
  const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
  const x = lerp(a.x, b.x, k) + nx * off, z = lerp(a.z, b.z, k) + nz * off;
  return { x, z, y: solPlaine(x, z), nx, nz, ry: Math.atan2(lerp(a.tx, b.tx, k), lerp(a.tz, b.tz, k)) };
}

// ---------- relevé de ce qui est déjà posé ----------
let OBST = null;

function releverObstacles(x0, x1, z0, z1) {
  const CEL = 8, g = new Map(), cle = (a, b) => a * 100003 + b;
  for (const c of world.capsules) {
    if (c.r < 0.45) continue;
    const ax0 = Math.min(c.ax, c.bx) - c.r, ax1 = Math.max(c.ax, c.bx) + c.r;
    const az0 = Math.min(c.az, c.bz) - c.r, az1 = Math.max(c.az, c.bz) + c.r;
    if (ax1 < x0 || ax0 > x1 || az1 < z0 || az0 > z1) continue;
    const a0 = Math.floor(ax0 / CEL), a1 = Math.floor(ax1 / CEL), b0 = Math.floor(az0 / CEL), b1 = Math.floor(az1 / CEL);
    if ((a1 - a0 + 1) * (b1 - b0 + 1) > 4000) continue;
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { let l = g.get(cle(a, b)); if (!l) g.set(cle(a, b), l = []); l.push(c); }
  }
  OBST = { g, CEL, cle };
}
// distance libre autour de (x, z) : marge jusqu'au premier obstacle déjà posé
function degagement(x, z, rMax = 14) {
  if (!OBST) return rMax;
  const { g, CEL, cle } = OBST, p = Math.ceil(rMax / CEL);
  const gx = Math.floor(x / CEL), gz = Math.floor(z / CEL);
  let d = rMax;
  for (let a = gx - p; a <= gx + p; a++) for (let b = gz - p; b <= gz + p; b++) {
    const l = g.get(cle(a, b)); if (!l) continue;
    for (const c of l) { const q = distSeg(x, z, c.ax, c.az, c.bx, c.bz) - c.r; if (q < d) d = q; }
  }
  return d;
}
// meilleure clairière pour un disque de rayon r, cherchée le long de la route
function placeLibre(s0, s1, offs, r, pas = 2) {
  let best = null;
  for (let s = s0; s <= s1; s += pas) for (const off of offs) {
    const p = rte(s, off), d = degagement(p.x, p.z, r + 5);
    if (d < r) continue;
    const note = d - Math.abs(off) * 0.05;                    // à dégagement égal, on reste près de la route
    if (!best || note > best.note) best = { ...p, s, off, d, note };
  }
  return best;
}

// ---------- matières de la campagne ----------
// Une seule palette pour tout le secteur : `mergeStatics` fusionne par matériau, donc
// chaque teinte de plus est un mesh de plus à la fin.
let MATS = null;
function matsCampagne() {
  if (MATS) return MATS;
  MATS = {
    chaussee: phMat('terre_battue', 1, 1, { color: 0xffffff, vertexColors: true }),
    accotement: phMat('withered_grass', 1, 1, { color: 0xa8ab74, vertexColors: true }),
    fosse: phMat('brown_mud_03', 1, 1, { color: 0x9a8161 }),
    talus: phMat('grass_ground', 1, 1, { color: 0x8fae5c }),
    eau: mat(0x33402f, { roughness: 0.12, metalness: 0.25, normalMap: T.waterN, transparent: true, opacity: 0.88 }),
    pierre: phMat('old_stone_wall_02', 2.5, 2.5, { color: 0xa79d8a }),
    gres: phMat('rock_wall_14', 2.5, 2.5, { color: 0x968a76 }),
    dalle: phMat('worn_tile_floor', 1.6, 1.6, { color: 0x9a948a }),
    brique: brickScaled(2.2, 2.2, { color: 0xb4816a }),
    torchis: phMat('brown_mud_03', 3.0, 3.0, { color: 0xc9baa0 }),
    chaux: phMat('chaux_craquelee', 2.4, 2.4, { color: 0xe0d8c4 }),
    chaume: phMat('withered_grass', 2.4, 2.4, { color: 0xa89154, roughness: 1 }),
    tuile: phMat('clay_roof_tiles', 4.2, 4.2, { color: 0x9c5c34 }),
    bois: phMat('wood_cabinet_worn_long', 2.0, 2.0, { color: 0x5b4330 }),
    planche: phMat('wood_planks', 2.0, 2.0, { color: 0x8a6a48 }),
    rondin: phMat('tree_trunk', 1.6, 1.6, { color: 0x6a5744 }),
    mousse: phMat('mousse', 1.2, 1.2, { color: 0x6d7f4a, roughness: 1 }),
    fer: mat(0x3a3a40, { metalness: 0.8, roughness: 0.45 }),
    paille: mat(0xd2b464, { roughness: 1 }),
    fumier: phMat('brown_mud_03', 1.6, 1.6, { color: 0x5d4b34 }),
  };
  return MATS;
}

// ---------- ruban : une bande qui suit la route et épouse le relief ----------
// `lanes` = profil en travers, de gauche à droite : { o } décalage, { dy } altitude
// relative au sol, { c } teinte (couleur de sommet, multipliée sur l'albédo).
function ruban(s0, s1, lanes, m, pas = 3.2) {
  const NS = Math.max(2, Math.ceil((s1 - s0) / pas)), NO = lanes.length;
  const pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const s = s0 + (s1 - s0) * i / NS;
    for (const l of lanes) {
      const p = rte(s, l.o);
      pos.push(p.x, p.y + l.dy, p.z);
      uv.push(l.o, s);                                     // UV en mètres : phMat(slug, 1, 1)
      const c = l.c === undefined ? 1 : l.c; col.push(c, c, c);
    }
  }
  // (a, c, b) puis (b, c, d) : la normale sort vers +Y, vérifié par le produit tangente × normale
  for (let i = 0; i < NS; i++) for (let j = 0; j < NO - 1; j++) {
    const a = i * NO + j, b = a + 1, c = a + NO, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const me = new THREE.Mesh(g, m); me.receiveShadow = true; scene.add(me);
  return me;
}

// ---------- la haie d'aubépine ----------
// Une haie ne se lit pas par ses feuilles mais par son épaisseur et par la déchirure de
// sa silhouette : la texture est donc construite du sombre vers le clair, dense en bas,
// trouée sur le dessus et sur les flancs, avec des baies et quelques épines nues.
export let HAIE_TEX = null;

export function haieTexture() {
  const W = 128, H = 128, [c, x] = makeCanvas(W, H);
  x.clearRect(0, 0, W, H);
  const TONS = ['#25401c', '#2f4f22', '#3d6129', '#507c31', '#6b9038', '#88a648'];
  for (let k = 0; k < 900; k++) {
    const px = rand(0, W), py = rand(0, H);
    const dens = Math.min(1, 0.12 + Math.min(px, W - px) / 15) * Math.min(1, 0.10 + py / 30);
    if (Math.random() > dens) continue;
    const haut = 1 - py / H;                                       // py = 0 : sommet de la haie
    const ton = TONS[clamp(Math.floor(rand(0, 4) + haut * 2.2), 0, 5)];
    x.save(); x.translate(px, py); x.rotate(rand(0, TAU)); x.fillStyle = ton;
    x.beginPath(); x.ellipse(0, 0, rand(3.0, 6.2), rand(1.9, 3.6), 0, 0, TAU); x.fill(); x.restore();
  }
  x.fillStyle = '#9b2c20';                                          // baies d'aubépine
  for (let k = 0; k < 22; k++) { const px = rand(10, W - 10), py = rand(H * 0.2, H * 0.92); x.beginPath(); x.arc(px, py, 1.9, 0, TAU); x.fill(); }
  x.strokeStyle = 'rgba(52,40,28,0.9)'; x.lineWidth = 1.1;          // épines et bois mort
  for (let k = 0; k < 18; k++) { const px = rand(6, W - 6), py = rand(H * 0.45, H); x.beginPath(); x.moveTo(px, py); x.lineTo(px + rand(-10, 10), py - rand(9, 26)); x.stroke(); }
  return tex(c, 1, true);
}

const HAIE = [];                 // instances en attente : une seule InstancedMesh à la fin
let HAIE_MESH = null;
const BLES = [];                 // les champs de blé, pour les paliers de qualité

// sème une haie sur la crête du talus, de s0 à s1, du côté `cote` (±1)
function semerHaie(s0, s1, cote, o = {}) {
  const off = (o.off || 5.9) * cote, ht = o.h || 1.9, pas = o.pas || 0.52;
  for (let s = s0; s < s1; s += pas) {
    const creux = Math.min(1, (s - s0) / 2.5, (s1 - s) / 2.5);     // la haie s'amincit à ses bouts
    if (creux <= 0.02) continue;
    for (const rang of [-0.34, 0.34]) {
      const p = rte(s + rand(-0.13, 0.13), off + rang * cote + rand(-0.12, 0.12));
      const h = ht * creux * rand(0.82, 1.18) * (1 + Math.sin(s * 0.21) * 0.10);
      HAIE.push({ x: p.x, y: p.y + 0.28, z: p.z, h, l: h * rand(0.78, 1.05), ry: rand(0, TAU), t: rand(0, 1) });
    }
  }
  // collision : une seule capsule par tronçon de 6 m, sinon on paie mille capsules pour une haie
  for (let s = s0; s < s1 - 0.5; s += 6) {
    const a = rte(s, off), b = rte(Math.min(s1, s + 6), off);
    addCap(a.x, a.z, b.x, b.z, 0.95, 2.4);
  }
}

function poserHaies() {
  if (!HAIE.length) return;
  HAIE_TEX = HAIE_TEX || haieTexture();
  const q1 = new THREE.PlaneGeometry(1, 1); q1.translate(0, 0.5, 0);
  const q2 = q1.clone(); q2.rotateY(Math.PI / 2);
  const q3 = q1.clone(); q3.rotateY(Math.PI / 4);        // trois plans : de biais, une croix se voit
  const geo = mergeParts([q1, q2, q3]);
  const m = new THREE.MeshStandardMaterial({ map: HAIE_TEX, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1 });
  const im = new THREE.InstancedMesh(geo, m, HAIE.length);
  im.castShadow = im.receiveShadow = true;
  const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), PV = new THREE.Vector3(), SV = new THREE.Vector3(), EU = new THREE.Euler(), CL = new THREE.Color();
  HAIE.forEach((b, i) => {
    PV.set(b.x, b.y, b.z); QT.setFromEuler(EU.set(0, b.ry, 0)); SV.set(b.l, b.h, b.l);
    im.setMatrixAt(i, M4.compose(PV, QT, SV));
    im.setColorAt(i, CL.setHSL(0.26 + b.t * 0.04, 0.30 + b.t * 0.16, 0.42 + b.t * 0.16));
  });
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  scene.add(im); HAIE_MESH = im;
  console.log('bocage :', HAIE.length, 'touffes de haie');
}

// ---------- trogne : le saule têtard, signature du bocage flamand ----------
// Fût court et noueux, tête renflée par des siècles d'étêtage, gerbe de rejets d'un an.
function trogne(x, z, h = 2.5) {
  const M = matsCampagne(), y = solPlaine(x, z), g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = rand(0, TAU); scene.add(g);
  const pente = rand(-0.11, 0.11);
  const fut = mesh(new THREE.CylinderGeometry(0.30, 0.46, h, 9), M.rondin, 0, h / 2, 0);
  fut.rotation.z = pente; fut.castShadow = true; g.add(fut);
  for (let k = 0; k < 4; k++) {                                     // bourrelets d'étêtage
    const r = 0.40 + Math.sin(k * 1.7) * 0.07;
    g.add(mesh(sphG(r, 7), M.rondin, Math.sin(k * 2.3) * 0.12 - pente * h, h - 0.05 + k * 0.10, Math.cos(k * 2.3) * 0.12));
  }
  g.add(mesh(sphG(0.18, 6), M.mousse, 0.26, h * 0.45, 0.20));
  const rejets = [];
  for (let k = 0; k < 16; k++) {
    const a = k * TAU / 16 + rand(-0.2, 0.2), pen = rand(0.20, 0.55), lg = rand(1.5, 2.8);
    const q = new THREE.CylinderGeometry(0.018, 0.045, lg, 4); q.translate(0, lg / 2, 0);
    q.rotateX(Math.cos(a) * pen); q.rotateZ(-Math.sin(a) * pen);
    rejets.push(q.translate(Math.sin(a) * 0.22, h + 0.25, Math.cos(a) * 0.22));
  }
  const gm = new THREE.Mesh(mergeParts(rejets), mat(0x7a6a44, { roughness: 1 })); gm.castShadow = true; g.add(gm);
  HAIE_TEX = HAIE_TEX || haieTexture();
  const feu = new THREE.Mesh(sphG(1.25, 8), new THREE.MeshStandardMaterial({ map: HAIE_TEX, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1 }));
  feu.position.set(0, h + 1.5, 0); feu.scale.set(1, 0.78, 1); feu.castShadow = true; g.add(feu);
  addCap(x, z, x, z, 0.55, h + 3);
}

// ---------- fossé, talus, chaussée ----------
// Profil en travers, de l'axe vers l'extérieur : chaussée bombée avec ses deux ornières,
// accotement d'herbe rase, fossé de 50 cm, talus de curage sur lequel la haie est plantée.
function chausseeEt(s0, s1) {
  const M = matsCampagne();
  ruban(s0, s1, [
    { o: -3.05, dy: 0.020, c: 0.80 }, { o: -2.25, dy: 0.052, c: 0.92 },
    { o: -1.55, dy: 0.036, c: 0.66 }, { o: -1.05, dy: 0.030, c: 0.60 },   // ornière gauche
    { o: -0.55, dy: 0.062, c: 0.96 }, { o: 0.00, dy: 0.075, c: 1.06 }, { o: 0.55, dy: 0.062, c: 0.96 },
    { o: 1.05, dy: 0.030, c: 0.60 }, { o: 1.55, dy: 0.036, c: 0.66 },     // ornière droite
    { o: 2.25, dy: 0.052, c: 0.92 }, { o: 3.05, dy: 0.020, c: 0.80 },
  ], M.chaussee, 2.6);
}

function fosseEt(s0, s1, cote) {
  const M = matsCampagne(), k = cote;
  ruban(s0, s1, [
    { o: k * 3.00, dy: 0.020, c: 1.0 }, { o: k * 3.90, dy: -0.05, c: 0.92 },
  ], M.accotement, 3.2);
  ruban(s0, s1, [
    { o: k * 3.90, dy: -0.05 }, { o: k * 4.35, dy: -0.50 }, { o: k * 4.95, dy: -0.52 },
    { o: k * 5.35, dy: -0.06 }, { o: k * 5.95, dy: 0.34 }, { o: k * 6.60, dy: 0.30 }, { o: k * 7.20, dy: 0.02 },
  ], M.fosse, 3.2);
  ruban(s0, s1, [{ o: k * 5.55, dy: 0.16 }, { o: k * 6.00, dy: 0.355 }, { o: k * 6.55, dy: 0.315 }, { o: k * 7.00, dy: 0.06 }], M.talus, 3.4);
}
// eau dormante au fond du fossé, sur les tronçons bas
function eauFosse(s0, s1, cote) {
  const M = matsCampagne();
  ruban(s0, s1, [{ o: cote * 4.10, dy: -0.40 }, { o: cote * 4.80, dy: -0.40 }], M.eau, 3.6);
}
// ponceau : deux dalles de grès jetées sur le fossé, à l'entrée d'un champ
function ponceau(s, cote) {
  const M = matsCampagne(), p = rte(s, cote * 4.45), q = rte(s + 0.1, cote * 4.45);
  const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = q.ry; scene.add(g);
  for (const sx of [-1, 1]) g.add(mesh(rboxG(1.0, 0.22, 2.6, 0.04, 2), M.gres, sx * 0.55, 0.10, 0));
  for (const sz of [-1, 1]) g.add(mesh(rboxG(2.4, 0.34, 0.34, 0.06, 2), M.gres, 0, -0.16, sz * 1.25));
  g.add(mesh(new THREE.CylinderGeometry(0.30, 0.30, 2.3, 10, 1, true), mat(0x2a2a26, { side: THREE.DoubleSide, roughness: 1 }), 0, -0.36, 0).rotateX(Math.PI / 2));
}

// ---------- bornes ----------
// Borne de chemin : un dé de grès chanfreiné, planté au ras de l'accotement, usé par les
// moyeux. Tous les quarts de lieue, alternativement d'un côté et de l'autre.
function borne(s, cote, royale = false) {
  const M = matsCampagne(), p = rte(s, cote * 3.45);
  const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.ry + rand(-0.14, 0.14); scene.add(g);
  const h = royale ? 1.45 : 0.98, w = royale ? 0.46 : 0.34;
  g.add(mesh(rboxG(w + 0.24, 0.16, w + 0.24, 0.03, 2), M.gres, 0, 0.06, 0));            // assise affleurante
  const f = mesh(rboxG(w, h, w, 0.055, 2), M.gres, 0, 0.12 + h / 2, 0); f.castShadow = true; g.add(f);
  g.add(mesh(new THREE.CylinderGeometry(w * 0.72, w * 0.72, 0.16, 8), M.gres, 0, 0.12 + h + 0.05, 0));  // chapeau arrondi
  g.add(mesh(boxG(w + 0.02, 0.05, w * 0.35), mat(0x6d6459, { roughness: 1 }), 0, 0.12 + h * 0.66, w / 2 - 0.02));  // filet gravé
  if (royale) {                                                                          // fleur de lys sommaire, taillée en relief
    const l = mat(0x8c8377, { roughness: 1 });
    g.add(mesh(boxG(0.07, 0.34, 0.05), l, 0, 0.12 + h * 0.40, w / 2));
    for (const sx of [-1, 1]) g.add(mesh(boxG(0.055, 0.24, 0.05), l, sx * 0.10, 0.12 + h * 0.40, w / 2).rotateZ(sx * 0.42));
    g.add(mesh(boxG(0.26, 0.055, 0.05), l, 0, 0.12 + h * 0.30, w / 2));
  }
  g.add(mesh(sphG(0.11, 6), M.mousse, -w / 2 + 0.03, 0.22, 0.04));
  addCap(p.x, p.z, p.x, p.z, w * 0.75, h + 0.4);
}

// ---------- croix de chemin ----------
// Emmarchement de trois degrés, dé, fût chanfreiné, croix de fer forgé à fleurons.
// Le talus s'écarte pour lui ménager un replat : c'est là qu'on s'arrête et qu'on souffle.
function croixDeChemin(x, z, ry) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(x, solPlaine(x, z), z); g.rotation.y = ry; scene.add(g);
  for (let k = 0; k < 3; k++) {
    const c = 2.7 - k * 0.56;
    g.add(mesh(rboxG(c, 0.24, c, 0.04, 2), M.gres, 0, 0.12 + k * 0.24, 0));
  }
  g.add(mesh(rboxG(0.78, 0.88, 0.78, 0.045, 2), M.gres, 0, 1.16, 0));
  g.add(mesh(rboxG(0.92, 0.14, 0.92, 0.03, 2), M.gres, 0, 1.67, 0));
  const fut = mesh(new THREE.CylinderGeometry(0.155, 0.215, 2.55, 8), M.gres, 0, 3.01, 0); fut.castShadow = true; g.add(fut);
  g.add(mesh(rboxG(0.46, 0.20, 0.46, 0.04, 2), M.gres, 0, 4.38, 0));
  // croix : barre plate, fleurons en boules, coq minuscule
  const f = M.fer;
  g.add(mesh(boxG(0.085, 1.30, 0.085), f, 0, 5.10, 0));
  g.add(mesh(boxG(0.80, 0.085, 0.085), f, 0, 5.32, 0));
  for (const q of [[0, 5.78], [-0.42, 5.32], [0.42, 5.32], [0, 4.50]]) g.add(mesh(sphG(0.075, 7), f, q[0], q[1], 0));
  for (const sx of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.13, 0.022, 5, 10, Math.PI), f, sx * 0.20, 5.32, 0).rotateZ(sx > 0 ? 0 : Math.PI));
  g.add(mesh(boxG(0.30, 0.26, 0.03), f, 0, 5.62, 0.03));                                 // banderole gravée
  // banc de pierre et bouquet de fleurs des champs
  g.add(mesh(rboxG(1.9, 0.20, 0.44, 0.04, 2), M.gres, 0, 0.62, 1.95));
  for (const sx of [-1, 1]) g.add(mesh(rboxG(0.30, 0.52, 0.40, 0.04, 2), M.gres, sx * 0.72, 0.26, 1.95));
  for (let k = 0; k < 9; k++) {
    const a = rand(0, TAU), r = rand(0.5, 1.35);
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.30, 4), mat(0x5a7a3a), Math.cos(a) * r, 0.90, Math.sin(a) * r - 1.35));
    g.add(mesh(sphG(0.055, 6), mat([0xe8e2d0, 0xd8c04a, 0xc05a6a][k % 3]), Math.cos(a) * r, 1.06, Math.sin(a) * r - 1.35));
  }
  addCap(x, z, x, z, 1.15, 6.2);
}

// ---------- poteau indicateur, au sortir du pont ----------
function poteauIndicateur(x, z, ry) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(x, solPlaine(x, z), z); g.rotation.y = ry; scene.add(g);
  g.add(mesh(rboxG(0.62, 0.22, 0.62, 0.04, 2), M.gres, 0, 0.11, 0));
  const p = mesh(new THREE.CylinderGeometry(0.10, 0.13, 3.1, 7), M.bois, 0, 1.68, 0); p.castShadow = true; g.add(p);
  g.add(mesh(new THREE.ConeGeometry(0.15, 0.26, 7), M.bois, 0, 3.35, 0));
  // deux flèches de chêne, pointe vers la direction annoncée
  const fleche = (y, sens, teinte) => {
    const b = new THREE.Group(); b.position.set(0, y, 0); b.rotation.y = sens; g.add(b);
    const pl = mesh(boxG(1.35, 0.26, 0.05), mat(teinte, { roughness: 0.75 }), 0.68, 0, 0); pl.castShadow = true; b.add(pl);
    b.add(mesh(boxG(0.22, 0.22, 0.055), mat(teinte, { roughness: 0.75 }), 1.40, 0, 0).rotateZ(Math.PI / 4));
    for (let k = 0; k < 7; k++) b.add(mesh(boxG(0.055, 0.115, 0.02), mat(0x2e2418), 0.28 + k * 0.13, 0.015, 0.03));  // lettres gravées, illisibles de près comme il se doit
    b.add(mesh(boxG(0.16, 0.05, 0.07), M.fer, 0.10, 0, 0));
  };
  fleche(2.72, 0, 0xcdbb95);
  fleche(2.36, Math.PI, 0xbfae8c);
  addCap(x, z, x, z, 0.3, 3.6);
}

// ---------- barrière à claire-voie ----------
// Chêne, cinq lisses, une écharpe, gonds à collier : pas un fil, pas un tube.
function barriere(x, z, ry, w = 3.2) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(x, solPlaine(x, z), z); g.rotation.y = ry; scene.add(g);
  for (const sx of [-1, 1]) {
    const po = mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.75, 7), M.rondin, sx * (w / 2 + 0.12), 0.80, 0);
    po.castShadow = true; g.add(po);
    g.add(mesh(new THREE.ConeGeometry(0.135, 0.20, 7), M.rondin, sx * (w / 2 + 0.12), 1.76, 0));
  }
  const bat = new THREE.Group(); bat.position.set(-w / 2, 0, 0.06); bat.rotation.y = rand(-0.16, 0.05); g.add(bat);
  for (let k = 0; k < 5; k++) bat.add(mesh(boxG(w, 0.115, 0.05), M.planche, w / 2, 0.42 + k * 0.28, 0));
  bat.add(mesh(boxG(0.10, 1.30, 0.06), M.planche, 0.07, 1.00, 0));
  bat.add(mesh(boxG(0.10, 1.30, 0.06), M.planche, w - 0.07, 1.00, 0));
  bat.add(mesh(boxG(Math.hypot(w, 1.1), 0.10, 0.045), M.planche, w / 2, 1.00, -0.02).rotateZ(Math.atan2(1.1, w)));
  for (const y of [0.52, 1.50]) bat.add(mesh(boxG(0.20, 0.07, 0.09), M.fer, 0.04, y, 0));
  bat.add(mesh(new THREE.TorusGeometry(0.09, 0.018, 5, 10), M.fer, w - 0.05, 0.95, 0.05));
  addCap(x - Math.cos(ry) * w / 2, z + Math.sin(ry) * w / 2, x + Math.cos(ry) * w / 2, z - Math.sin(ry) * w / 2, 0.22, 1.8);
}

// ---------- muret ----------
// Brique posée sur un soubassement de grès, chaperon sur chant. On le construit tronçon
// par tronçon et on saute ceux qu'un arbre occupe déjà : dans un bocage, un muret qui bute
// sur un tronc s'arrête, il ne le traverse pas. Tous les tronçons font la même longueur,
// pour que la brique reste à son échelle réelle avec un seul matériau — donc un seul mesh
// après fusion.
const MURET_PAS = 1.6;

function muret(pts, h = 0.95, opts = {}) {
  const M = matsCampagne(), briques = [], gres = [], mousses = [];
  let pose = 0, k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / MURET_PAS);
    if (n < 1) continue;
    const ry = Math.atan2(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    const marge = (L - n * MURET_PAS) / 2;
    for (let j = 0; j < n; j++, k++) {
      const d0 = marge + j * MURET_PAS, cx = ax + ux * (d0 + MURET_PAS / 2), cz = az + uz * (d0 + MURET_PAS / 2);
      if (degagement(cx, cz, 2.4) < 0.9) continue;
      if (opts.trou && opts.trou(cx, cz)) continue;
      const y = solPlaine(cx, cz);
      gres.push(boxG(0.52, 0.22, MURET_PAS + 0.03).rotateY(ry).translate(cx, y + 0.11, cz));
      briques.push(boxG(0.42, h, MURET_PAS + 0.01).rotateY(ry).translate(cx, y + 0.22 + h / 2, cz));
      gres.push(boxG(0.50, 0.13, MURET_PAS + 0.01).rotateY(ry).translate(cx, y + 0.28 + h, cz));
      if (k % 4 === 1) mousses.push(sphG(0.15, 6).translate(cx + uz * 0.2, y + 0.34, cz - ux * 0.2));
      addCap(ax + ux * d0, az + uz * d0, ax + ux * (d0 + MURET_PAS), az + uz * (d0 + MURET_PAS), 0.28, h + 0.5);
      pose++;
    }
  }
  const pose1 = (parts, m, ombre) => { if (!parts.length) return; const o = new THREE.Mesh(mergeParts(parts), m); o.castShadow = ombre; o.receiveShadow = true; scene.add(o); };
  pose1(briques, brickScaled(MURET_PAS, h, { color: 0xb07a63 }), true);
  pose1(gres, M.gres, false);
  pose1(mousses, M.mousse, false);
  return pose;
}

// ---------- chercher une place ----------
// Lacet à donner à un bâtiment pour qu'il regarde la route, selon le côté où il est posé.
function ryFace(p, cote) { return p.ry - cote * Math.PI / 2; }

// dégagement minimal sous une emprise rectangulaire (w le long de la façade, d en profondeur)
function libreBati(p, ry, w, d) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  let min = 99;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 3; j++) {
    const lx = -w / 2 + w * i / 4, lz = -d / 2 + d * j / 3;
    min = Math.min(min, degagement(p.x + lx * cs + lz * sn, p.z - lx * sn + lz * cs, 7));
  }
  return min;
}
// meilleure emprise libre le long de la route, entre s0 et s1, aux décalages proposés
function placeBati(s0, s1, offs, w, d, marge = 0.7) {
  let best = null;
  for (let s = s0; s <= s1; s += 1.5) for (const off of offs) {
    const cote = Math.sign(off) || 1, p = rte(s, off), ry = ryFace(p, cote);
    const q = libreBati(p, ry, w, d) - marge;
    if (q <= 0) continue;
    const note = q - Math.abs(off) * 0.08;
    if (!best || note > best.note) best = { ...p, s, off, cote, ry, marge: q, note };
  }
  return best;
}

// ---------- la mare, le lavoir, l'abreuvoir et le bac ----------
// Au point bas de la route, le fossé se déverse dans une mare ; la communauté y a bâti son
// lavoir — quatre chênes et un toit de tuiles sur un bassin de grès, la pierre à battre
// inclinée vers l'eau. À côté, l'abreuvoir où l'on mène les bêtes, et le bac à fond plat
// tiré au sec : une barque de marais, pas un bateau.
// Repère local : +z regarde la route, +x est à droite en venant d'elle.
function lavoirEtMare(p, mare = true) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(p.x, p.y, p.z); g.rotation.y = p.ry; scene.add(g);
  const cs = Math.cos(p.ry), sn = Math.sin(p.ry);
  const W2 = (lx, lz) => [p.x + lx * cs + lz * sn, p.z - lx * sn + lz * cs];
  const R = 4.2, MZ = -2.4;

  if (mare) {
    const cu = new THREE.Mesh(new THREE.CircleGeometry(R, 24), M.fosse);
    cu.rotation.x = -Math.PI / 2; cu.position.set(0, -0.46, MZ); cu.receiveShadow = true; g.add(cu);
    const bo = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R - 0.8, 0.52, 24, 1, true), M.fosse);
    bo.material.side = THREE.DoubleSide; bo.position.set(0, -0.22, MZ); g.add(bo);
    const ea = new THREE.Mesh(new THREE.CircleGeometry(R - 0.5, 24), M.eau);
    ea.rotation.x = -Math.PI / 2; ea.position.set(0, -0.32, MZ); g.add(ea);
    for (let k = 0; k < 22; k++) { const a = rand(0, TAU), r = R * rand(0.82, 1.04), hh = rand(0.5, 1.2);
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.03, hh, 4), mat(0x6f8a3e, { roughness: 1 }), Math.cos(a) * r, -0.32 + hh / 2, MZ + Math.sin(a) * r).rotateZ(rand(-0.22, 0.22))); }
    const [ex, ez] = W2(0, MZ); addCap(ex, ez, ex, ez, R - 0.7, 0.4);
    // le bac, tiré au sec sur la rive
    const c = new THREE.Group(); c.position.set(R * 0.72, -0.16, MZ - R * 0.68); c.rotation.y = -0.85; c.rotation.z = 0.07; g.add(c);
    const BW = 1.26, BL = 4.4;
    c.add(mesh(boxG(BW, 0.07, BL), M.planche, 0, 0.07, 0));
    for (const sx of [-1, 1]) { const fl = mesh(boxG(0.07, 0.44, BL), M.planche, sx * BW / 2, 0.29, 0); fl.rotation.z = -sx * 0.13; c.add(fl); }
    for (const sz of [-1, 1]) { const ta = mesh(boxG(BW, 0.46, 0.07), M.planche, 0, 0.31, sz * BL / 2); ta.rotation.x = sz * 0.55; c.add(ta); }
    for (let k = -1; k <= 1; k++) c.add(mesh(boxG(BW + 0.12, 0.07, 0.10), M.bois, 0, 0.49, k * 1.3));
    c.add(mesh(boxG(BW - 0.3, 0.05, 0.28), M.planche, 0, 0.30, 0.85));
    c.add(mesh(new THREE.CylinderGeometry(0.032, 0.048, 4.0, 6), M.bois, 0.28, 0.54, -0.35).rotateX(Math.PI / 2 - 0.1));
    c.add(mesh(new THREE.TorusGeometry(0.15, 0.032, 5, 12), mat(0xa08a62, { roughness: 1 }), -0.32, 0.15, -BL / 2 + 0.45).rotateX(Math.PI / 2));
    const [bx, bz] = W2(R * 0.72, MZ - R * 0.68); addCap(bx, bz, bx, bz, 1.0, 0.7);
  }

  // le lavoir, entre la mare et la route
  const LW = 4.2, LD = 2.6, LZ = 3.0;
  { const b = new THREE.Group(); b.position.set(0, 0, LZ); g.add(b);
    b.add(mesh(rboxG(LW + 0.8, 0.28, LD + 0.8, 0.03, 2), M.dalle, 0, 0.14, 0));
    for (const [w, d, x, z] of [[LW + 0.6, 0.40, 0, -LD / 2 - 0.1], [LW + 0.6, 0.40, 0, LD / 2 + 0.1], [0.40, LD, -LW / 2 - 0.1, 0], [0.40, LD, LW / 2 + 0.1, 0]])
      b.add(mesh(rboxG(w, 0.70, d, 0.035, 2), M.gres, x, 0.35, z));
    b.add(mesh(boxG(LW - 0.15, 0.10, LD - 0.15), M.eau, 0, 0.55, 0));
    b.add(mesh(boxG(LW - 0.2, 0.5, LD - 0.2), mat(0x3b4436, { roughness: 0.9 }), 0, 0.25, 0));
    const bat = mesh(boxG(LW - 0.5, 0.13, 0.92), M.gres, 0, 0.64, LD / 2 - 0.30); bat.rotation.x = -0.27; b.add(bat);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const po = mesh(new THREE.CylinderGeometry(0.105, 0.125, 2.45, 7), M.rondin, sx * (LW / 2 + 0.45), 1.36, sz * (LD / 2 + 0.55));
      po.castShadow = true; b.add(po);
      b.add(mesh(boxG(0.16, 0.48, 0.16), M.gres, sx * (LW / 2 + 0.45), 0.24, sz * (LD / 2 + 0.55)));
    }
    for (const sz of [-1, 1]) b.add(mesh(boxG(LW + 1.25, 0.13, 0.13), M.bois, 0, 2.55, sz * (LD / 2 + 0.55)));
    for (let k = -2; k <= 2; k++) b.add(mesh(boxG(0.09, 0.09, LD + 1.5), M.bois, k * (LW + 0.9) / 5, 2.66, 0).rotateX(-0.22));
    const toit = new THREE.Mesh(new THREE.BoxGeometry(LW + 1.9, 0.15, LD + 2.2), M.tuile);
    toit.position.set(0, 2.86, 0.22); toit.rotation.x = -0.22; toit.castShadow = true; b.add(toit);
    b.add(mesh(boxG(LW + 1.9, 0.11, 0.17), M.bois, 0, 3.08, LD / 2 + 1.05));
    for (let k = 0; k < 3; k++) { const li = mesh(boxG(0.95, 0.70, 0.03), mat([0xf0ece0, 0xe6e6da, 0xdcd9c4][k], { roughness: 1, side: THREE.DoubleSide }), -1.45 + k * 1.45, 2.14, -LD / 2 - 0.52);
      li.rotation.z = rand(-0.05, 0.05); b.add(li); }
    b.add(mesh(boxG(0.60, 0.28, 0.40), M.planche, -LW / 2 + 0.5, 0.42, LD / 2 + 0.55));
    b.add(mesh(boxG(0.10, 0.03, 0.28), M.planche, -LW / 2 + 0.5, 0.58, LD / 2 + 0.55).rotateY(0.4));
    b.add(mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.32, 10), M.planche, LW / 2 - 0.4, 0.44, LD / 2 + 0.6));
    const [q1x, q1z] = W2(-LW / 2 - 0.6, LZ), [q2x, q2z] = W2(LW / 2 + 0.6, LZ);
    addCap(q1x, q1z, q2x, q2z, 1.9, 3.2); }

  // La descente depuis la route. Le lavoir n'est pas à un décalage fixe — il est cherché
  // entre les arbres — donc l'aire de gravier et les marches se calent sur le bord de
  // chaussée calculé (ZR), sinon elles finissaient au milieu de la route quand la poche
  // libre se trouvait près d'elle.
  const ZR = Math.abs(p.off === undefined ? 11 : p.off) - 3.3;
  { const z0 = LZ + 1.7, z1 = ZR - 1.7;
    if (z1 - z0 > 1.2) { const gr = new THREE.Mesh(new THREE.PlaneGeometry(4.4, z1 - z0), phMat('gravier', 1, 1, { color: 0xb2a48a }));
      gr.rotation.x = -Math.PI / 2; gr.position.set(0, 0.05, (z0 + z1) / 2); gr.receiveShadow = true; g.add(gr); }
    for (let k = 0; k < 3; k++) g.add(mesh(rboxG(2.4 - k * 0.1, 0.18, 0.60, 0.03, 2), M.gres, 0, 0.09 + k * 0.05, ZR - 0.25 - k * 0.62)); }
  // l'abreuvoir, au bord de la chaussée
  { const a = new THREE.Group(); a.position.set(-LW / 2 - 2.2, 0, ZR - 0.8); a.rotation.y = 0.22; g.add(a);
    a.add(mesh(rboxG(2.25, 0.2, 0.92, 0.03, 2), M.gres, 0, 0.10, 0));
    for (const [w, d, x, z] of [[2.25, 0.18, 0, -0.37], [2.25, 0.18, 0, 0.37], [0.18, 0.92, -1.03, 0], [0.18, 0.92, 1.03, 0]])
      a.add(mesh(boxG(w, 0.44, d), M.gres, x, 0.42, z));
    a.add(mesh(boxG(1.95, 0.06, 0.62), M.eau, 0, 0.55, 0));
    a.add(mesh(sphG(0.12, 6), M.mousse, -0.98, 0.22, 0.28));
    const [ax, az] = W2(-LW / 2 - 2.2, ZR - 0.8); addCap(ax, az, ax, az, 1.2, 0.8); }
}

// ---------- la pâture close ----------
// Un courtil : l'herbe rase, le muret de brique qui l'enferme, la barrière sur la route, le
// râtelier et l'auge. Le contour est cherché dans ce que les arbres ont laissé libre — si
// l'un d'eux tient la place, le muret s'y interrompt et l'arbre reste dans la pâture.
function pature(p, HW = 8.0, HD = 6.5) {
  const M = matsCampagne(), cs = Math.cos(p.ry), sn = Math.sin(p.ry);
  const W2 = (lx, lz) => [p.x + lx * cs + lz * sn, p.z - lx * sn + lz * cs];
  { const n = 12, pos = [], uv = [], idx = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const [wx, wz] = W2(-HW + 2 * HW * i / n, -HD + 2 * HD * j / n);
      pos.push(wx, solPlaine(wx, wz) + 0.05, wz); uv.push(wx, wz);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
    const ge = new THREE.BufferGeometry();
    ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    ge.setIndex(idx); ge.computeVertexNormals();
    const me = new THREE.Mesh(ge, phMat('withered_grass', 1, 1, { color: 0xa9b478 })); me.receiveShadow = true; scene.add(me); }
  const porte = W2(-HW + 3.2, HD);                                    // la barrière donne sur la route (+z local)
  muret([W2(-HW, -HD), W2(HW, -HD), W2(HW, HD), W2(-HW, HD), W2(-HW, -HD)], 0.95,
    { trou: (x, z) => Math.hypot(x - porte[0], z - porte[1]) < 2.1 });
  barriere(porte[0], porte[1], p.ry, 3.1);
  { const [rx, rz] = W2(HW - 2.8, HD - 1.8), g = new THREE.Group();
    g.position.set(rx, solPlaine(rx, rz), rz); g.rotation.y = p.ry + 0.3; scene.add(g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.085, 1.5, 6), M.rondin, sx * 1.12, 0.75, sz * 0.36));
    for (const sz of [-1, 1]) for (let k = 0; k < 7; k++) g.add(mesh(boxG(0.05, 0.92, 0.05), M.bois, -1.02 + k * 0.34, 1.05, sz * 0.32).rotateX(sz * 0.2));
    for (const sz of [-1, 1]) g.add(mesh(boxG(2.45, 0.085, 0.085), M.bois, 0, 1.50, sz * 0.44));
    const f = mesh(sphG(0.62, 8), M.paille, 0, 1.42, 0); f.scale.set(1.7, 0.48, 0.62); g.add(f);
    addCap(rx, rz, rx, rz, 1.2, 1.6); }
  { const [ax, az] = W2(HW - 2.0, -HD + 2.2), g = new THREE.Group();
    g.position.set(ax, solPlaine(ax, az), az); g.rotation.y = p.ry - 0.5; scene.add(g);
    g.add(mesh(new THREE.CylinderGeometry(0.60, 0.66, 0.44, 12), M.gres, 0, 0.22, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 12), M.eau, 0, 0.43, 0));
    addCap(ax, az, ax, az, 0.7, 0.6); }
  { const [mx, mz] = W2(-HW + 1.9, -HD + 2.0);
    const t = mesh(sphG(1.4, 9), M.fumier, mx, solPlaine(mx, mz) + 0.22, mz); t.scale.y = 0.34; scene.add(t);
    addCap(mx, mz, mx, mz, 1.3, 0.8); }
  for (let k = 0; k < 3; k++) {                                       // claies de coudrier appuyées au muret
    const [hx, hz] = W2(-HW + 0.55, HD - 3.4 - k * 1.8), g = new THREE.Group();
    g.position.set(hx, solPlaine(hx, hz), hz); g.rotation.y = p.ry; g.rotation.z = 0.22; scene.add(g);
    for (let j = 0; j < 6; j++) g.add(mesh(boxG(0.042, 1.5, 0.042), M.bois, 0, 0.78, -0.7 + j * 0.28));
    for (let j = 0; j < 3; j++) g.add(mesh(boxG(0.048, 0.048, 1.6), M.bois, 0, 0.22 + j * 0.54, 0));
  }
}

// ---------- bâtir : une chaumine ----------
// Longue et basse, un seul niveau, pignons pleins : c'est la maison de journalier des
// Flandres, à l'opposé des pignons à redents du bourg. Soubassement de brique contre les
// remontées d'eau, torchis entre les bois, chaume ou tuiles selon l'aisance du ménage.
// La façade regarde vers +z local ; poser le groupe face à la route.
function chaumine(x, z, ry, o = {}) {
  const M = matsCampagne();
  const w = o.w || 8.0, d = o.d || 5.2, h = o.h || 2.65;
  const mur = o.mur === 'chaux' ? M.chaux : o.mur === 'brique' ? M.brique : M.torchis;
  const chaume = o.toit !== 'tuile';
  const couv = chaume ? M.chaume : M.tuile, PEN = chaume ? 0.80 : 0.62, HT = chaume ? 3.4 : 2.7;
  const y0 = solPlaine(x, z), cs = Math.cos(ry), sn = Math.sin(ry);
  const W2 = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry; scene.add(g);

  g.add(mesh(rboxG(w + 0.5, 0.5, d + 0.5, 0.05, 2), M.brique, 0, 0.25, 0));                // soubassement
  { const m = new THREE.Mesh(rboxG(w, h, d, 0.06, 2), mur); m.position.y = 0.5 + h / 2; m.castShadow = m.receiveShadow = true; g.add(m); }
  // colombage : poteaux, sablières, décharges d'angle
  { const bois = [], n = Math.max(3, Math.round(w / 1.45));
    for (const sz of [-1, 1]) {
      for (let k = 0; k <= n; k++) bois.push(boxG(0.16, h, 0.19).translate(-w / 2 + k * w / n, 0.5 + h / 2, sz * (d / 2)));
      for (const yy of [0.5 + 0.09, 0.5 + h - 0.11]) bois.push(boxG(w + 0.06, 0.20, 0.21).translate(0, yy, sz * (d / 2)));
      for (const sx of [-1, 1]) bois.push(boxG(1.5, 0.15, 0.19).rotateZ(sx * 0.72).translate(sx * (w / 2 - 0.5), 0.5 + h - 0.62, sz * (d / 2)));
    }
    for (const sx of [-1, 1]) for (const yy of [0.5 + 0.09, 0.5 + h - 0.11]) bois.push(boxG(0.21, 0.20, d + 0.06).translate(sx * (w / 2), yy, 0));
    const bm = new THREE.Mesh(mergeParts(bois), M.bois); bm.castShadow = true; g.add(bm); }
  // toiture : deux pans débordants, faîtière, pignons pleins
  for (const sz of [-1, 1]) {
    const pan = new THREE.Mesh(new THREE.BoxGeometry(w + 1.3, chaume ? 0.5 : 0.22, d / 2 + 1.25), couv);
    pan.position.set(0, 0.5 + h + HT / 2 - 0.3, sz * (d / 4 + 0.5)); pan.rotation.x = sz * PEN; pan.castShadow = true; g.add(pan);
  }
  if (chaume) g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, w + 1.3, 9), couv, 0, 0.5 + h + HT - 0.42, 0).rotateZ(Math.PI / 2));
  else { g.add(mesh(boxG(w + 1.35, 0.20, 0.36), M.tuile, 0, 0.5 + h + HT - 0.34, 0));
         for (const sz of [-1, 1]) g.add(mesh(boxG(w + 1.35, 0.14, 0.14), M.bois, 0, 0.5 + h - 0.02, sz * (d / 2 + 0.60))); }
  { const tri = new THREE.Shape(); tri.moveTo(-d / 2 - 0.12, 0); tri.lineTo(d / 2 + 0.12, 0); tri.lineTo(0, HT - 0.38); tri.closePath();
    for (const sx of [-1, 1]) { const pg = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.28, bevelEnabled: false }), mur);
      pg.rotation.y = Math.PI / 2; pg.position.set(sx * w / 2 - (sx > 0 ? 0 : 0.28), 0.5 + h, 0); pg.castShadow = true; g.add(pg); } }
  // cheminée : la souche monte à 7,25 m, hauteur à laquelle l'animation de fumée du niveau
  // remet les bouffées (HOUSE_SMOKE_TOP) — c'est ce qui permet de la réutiliser telle quelle
  { const cx0 = -w / 2 + 0.85;
    g.add(mesh(rboxG(0.95, 7.25, 0.95, 0.04, 2), M.brique, cx0, 3.62, -0.3));
    g.add(mesh(rboxG(1.25, 0.24, 1.25, 0.04, 2), M.gres, cx0, 7.32, -0.3));
    const [fx, fz] = W2(cx0, -0.3);
    for (let k = 0; k < 3; k++) { const pu = new THREE.Mesh(sphG(0.34 + k * 0.16, 8), new THREE.MeshBasicMaterial({ color: 0xd8d4cc, transparent: true, opacity: 0.30 - k * 0.07 }));
      pu.position.set(fx, y0 + 7.6 + k * 1.1, fz); pu.userData.smoke = k; pu.userData.smokeBase = y0 + 7.4; pu.userData.smokeTop = y0 + HOUSE_SMOKE_TOP; scene.add(pu); } }
  // porte et fenêtres à petits carreaux, volets pleins
  { const dp = makeDoor(1.1, 2.05, { rustique: true, recess: 0.22, pierre: M.gres, sansCale: true });
    dp.position.set(o.dx === undefined ? -w / 4 : o.dx, 0.5, d / 2 + 0.02); g.add(dp);
    g.add(mesh(rboxG(1.7, 0.22, 0.9, 0.03, 2), M.gres, o.dx === undefined ? -w / 4 : o.dx, 0.4, d / 2 + 0.5)); }
  const vitre = mat(0xf0e2bc, { roughness: 0.25, emissive: 0xffc878, emissiveIntensity: o.chaud ? 0.55 : 0.12 });
  for (const lx of o.fen || [w * 0.17, w * 0.37]) {
    if (Math.abs(lx) > w / 2 - 0.7) continue;
    g.add(mesh(boxG(0.92, 0.82, 0.14), vitre, lx, 1.72, d / 2 + 0.04));
    for (const oy of [-0.2, 0.2]) g.add(mesh(boxG(0.96, 0.05, 0.18), M.bois, lx, 1.72 + oy, d / 2 + 0.06));
    g.add(mesh(boxG(0.05, 0.86, 0.18), M.bois, lx, 1.72, d / 2 + 0.06));
    g.add(mesh(boxG(1.22, 0.14, 0.26), M.gres, lx, 1.24, d / 2 + 0.06));
    // volet rabattu au mur : le vantail se construit vers +x depuis son gond, donc sg = -sx,
    // et le lacet de 0,94 π le couche vers l'extérieur de la baie et non dans la façade
    for (const sx of [-1, 1]) { const vo = makeVolet(0.50, 0.90, o.volet || 0x4a5a3e, -sx, false);
      vo.position.set(lx + sx * 0.48, 1.72, d / 2 + 0.09); vo.rotation.y = sx * 2.953; g.add(vo); }
  }
  // usages : banc, tas de bûches sous l'auvent, tonneau d'eau de pluie, balai
  g.add(mesh(boxG(1.5, 0.11, 0.35), M.planche, w / 4 + 1.0, 0.62, d / 2 + 0.55));
  for (const sx of [-1, 1]) g.add(mesh(boxG(0.13, 0.55, 0.28), M.bois, w / 4 + 1.0 + sx * 0.6, 0.30, d / 2 + 0.55));
  { const buches = [];
    for (let k = 0; k < 15; k++) { const r = 0.10 + (k % 3) * 0.018;
      buches.push(new THREE.CylinderGeometry(r, r, 1.15, 7).rotateZ(Math.PI / 2).translate(-w / 2 + 0.9 + ((k % 5) - 2) * 0.24, 0.62 + Math.floor(k / 5) * 0.22, d / 2 + 0.62)); }
    g.add(new THREE.Mesh(mergeParts(buches), M.rondin)); }
  g.add(mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.7, 12), M.planche, w / 2 - 0.7, 0.35, d / 2 + 0.55));
  g.add(mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.07, 12), M.fer, w / 2 - 0.7, 0.55, d / 2 + 0.55));
  // collisions : les quatre murs
  const C = [W2(-w / 2, -d / 2), W2(w / 2, -d / 2), W2(w / 2, d / 2), W2(-w / 2, d / 2)];
  for (let k = 0; k < 4; k++) addCap(...C[k], ...C[(k + 1) % 4], 0.35, 0.5 + h + HT);
  return g;
}

// ---------- la grange ----------
function grange(x, z, ry, o = {}) {
  const M = matsCampagne(), w = o.w || 10.5, d = o.d || 6.6, h = o.h || 3.9, HT = 3.2;
  const y0 = solPlaine(x, z), cs = Math.cos(ry), sn = Math.sin(ry);
  const W2 = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry; scene.add(g);
  g.add(mesh(rboxG(w + 0.5, 1.5, d + 0.5, 0.05, 2), M.brique, 0, 0.75, 0));                 // haut soubassement de brique
  { const m = new THREE.Mesh(rboxG(w, h - 1.5, d, 0.05, 2), M.planche); m.position.y = 1.5 + (h - 1.5) / 2; m.castShadow = m.receiveShadow = true; g.add(m); }
  { const bois = [], n = Math.round(w / 1.3);                                                // bardage vertical à couvre-joints
    for (const sz of [-1, 1]) for (let k = 0; k <= n; k++) bois.push(boxG(0.13, h - 1.5, 0.12).translate(-w / 2 + k * w / n, 1.5 + (h - 1.5) / 2, sz * (d / 2 + 0.02)));
    g.add(new THREE.Mesh(mergeParts(bois), M.bois)); }
  for (const sz of [-1, 1]) { const pan = new THREE.Mesh(new THREE.BoxGeometry(w + 1.1, 0.22, d / 2 + 1.0), M.tuile);
    pan.position.set(0, h + HT / 2 - 0.25, sz * (d / 4 + 0.42)); pan.rotation.x = sz * 0.66; pan.castShadow = true; g.add(pan); }
  g.add(mesh(boxG(w + 1.15, 0.20, 0.34), M.tuile, 0, h + HT - 0.32, 0));
  { const tri = new THREE.Shape(); tri.moveTo(-d / 2 - 0.1, 0); tri.lineTo(d / 2 + 0.1, 0); tri.lineTo(0, HT - 0.36); tri.closePath();
    for (const sx of [-1, 1]) { const pg = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.26, bevelEnabled: false }), M.planche);
      pg.rotation.y = Math.PI / 2; pg.position.set(sx * w / 2 - (sx > 0 ? 0 : 0.26), h, 0); pg.castShadow = true; g.add(pg); } }
  // grande porte charretière, à deux vantaux entrebâillés, et la lucarne à poulie du fenil
  for (const sx of [-1, 1]) { const v = new THREE.Group(); v.position.set(sx * 2.1, 0, d / 2 + 0.06); v.rotation.y = -sx * 0.30; g.add(v);
    const pl = [];
    for (let k = 0; k < 6; k++) pl.push(boxG(0.33, 3.0, 0.07).translate(-sx * (0.2 + k * 0.34), 1.5, 0));
    for (const yy of [0.35, 2.7]) pl.push(boxG(2.1, 0.15, 0.09).translate(-sx * 1.1, yy, 0.02));
    pl.push(boxG(3.0, 0.13, 0.09).rotateZ(-sx * 0.9).translate(-sx * 1.1, 1.5, 0.02));
    const pm = new THREE.Mesh(mergeParts(pl), M.planche); pm.castShadow = true; v.add(pm);
    v.add(mesh(new THREE.TorusGeometry(0.12, 0.022, 5, 10), M.fer, -sx * 2.0, 1.35, 0.08)); }
  g.add(mesh(boxG(4.6, 0.26, 0.4), M.gres, 0, 3.15, d / 2 + 0.1));
  g.add(mesh(boxG(1.5, 1.3, 0.12), mat(0x23201a, { roughness: 1 }), 0, h + 0.9, d / 2 - 0.05));
  g.add(mesh(boxG(0.16, 0.16, 1.5), M.bois, 0, h + 1.85, d / 2 + 0.5));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.10, 10), M.bois, 0, h + 1.78, d / 2 + 1.1).rotateZ(Math.PI / 2));
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 4), mat(0xa08a62), 0, h + 0.7, d / 2 + 1.1));
  const C = [W2(-w / 2, -d / 2), W2(w / 2, -d / 2), W2(w / 2, d / 2), W2(-w / 2, d / 2)];
  for (let k = 0; k < 4; k++) addCap(...C[k], ...C[(k + 1) % 4], 0.35, h + HT);
  return g;
}

// ---------- le four banal ----------
// Au hameau, on ne cuit pas chez soi : le four est commun, sous son petit toit, avec sa
// réserve de fagots et sa pelle. C'est le seul bâtiment entièrement de brique.
function fourBanal(x, z, ry) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(x, solPlaine(x, z), z); g.rotation.y = ry; scene.add(g);
  g.add(mesh(rboxG(3.0, 0.85, 2.6, 0.05, 2), M.brique, 0, 0.42, 0));                       // massif
  { const d = mesh(sphG(1.15, 12), M.brique, 0, 0.85, -0.1); d.scale.set(1, 0.72, 1); d.castShadow = true; g.add(d); }
  g.add(mesh(boxG(0.85, 0.55, 0.5), mat(0x241c14, { roughness: 1 }), 0, 1.05, 1.25));      // gueule
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.5, 12, 1, false, 0, Math.PI), M.gres, 0, 1.30, 1.25).rotateX(Math.PI / 2));
  g.add(mesh(rboxG(0.5, 2.6, 0.5, 0.04, 2), M.brique, -1.0, 2.1, -0.9));                   // souche
  g.add(mesh(rboxG(0.72, 0.18, 0.72, 0.03, 2), M.gres, -1.0, 3.45, -0.9));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.095, 0.115, 2.5, 7), M.rondin, sx * 1.75, 1.25, sz * 1.5));
  { const t = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.15, 4.0), M.tuile); t.position.set(0, 2.72, 0.3); t.rotation.x = -0.28; t.castShadow = true; g.add(t); }
  g.add(mesh(boxG(4.3, 0.12, 0.16), M.bois, 0, 3.10, -1.7));
  { const fag = [];                                                                         // fagots empilés
    for (let k = 0; k < 9; k++) fag.push(new THREE.CylinderGeometry(0.19, 0.19, 1.0, 6).rotateZ(Math.PI / 2).translate(1.5, 0.22 + Math.floor(k / 3) * 0.37, -1.1 + (k % 3) * 0.4));
    g.add(new THREE.Mesh(mergeParts(fag), mat(0x8a7850, { roughness: 1 }))); }
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 5), M.bois, 1.55, 1.35, 1.35).rotateZ(0.2));   // pelle à enfourner
  g.add(mesh(boxG(0.52, 0.05, 0.42), M.planche, 1.30, 2.55, 1.35));
  addCap(x, z, x, z, 2.1, 3.1);
}

// ---------- le pigeonnier ----------
function pigeonnier(x, z, ry) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(x, solPlaine(x, z), z); g.rotation.y = ry; scene.add(g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.4, 7), M.rondin, sx * 0.85, 1.2, sz * 0.85));
    g.add(mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.09, 12), M.gres, sx * 0.85, 2.46, sz * 0.85));   // capels anti-rats
  }
  { const c = new THREE.Mesh(rboxG(2.5, 2.1, 2.5, 0.05, 2), M.chaux); c.position.y = 3.6; c.castShadow = true; g.add(c); }
  for (const sz of [-1, 1]) for (let k = 0; k < 6; k++) g.add(mesh(boxG(0.16, 0.20, 0.1), mat(0x241c14, { roughness: 1 }), -0.75 + (k % 3) * 0.75, 3.35 + Math.floor(k / 3) * 0.55, sz * 1.27));
  g.add(mesh(boxG(2.7, 0.09, 0.28), M.planche, 0, 3.05, 1.35));                            // planche d'envol
  { const t = mesh(new THREE.ConeGeometry(2.25, 1.35, 4), M.tuile, 0, 5.35, 0); t.rotation.y = Math.PI / 4; t.castShadow = true; g.add(t); }
  g.add(mesh(sphG(0.18, 8), M.gres, 0, 6.06, 0));
  { const ec = [];                                                                          // échelle appuyée
    for (let k = 0; k < 7; k++) ec.push(boxG(0.5, 0.05, 0.05).translate(0, 0.35 + k * 0.42, 0));
    for (const sx of [-1, 1]) ec.push(boxG(0.06, 3.2, 0.06).translate(sx * 0.25, 1.6, 0));
    const em = new THREE.Mesh(mergeParts(ec), M.bois); em.position.set(1.4, 0, 1.15); em.rotation.x = 0.28; em.rotation.z = -0.12; g.add(em); }
  addCap(x, z, x, z, 1.5, 6.2);
}

// ---------- le puits à balancier ----------
function puitsBalancier(x, z, ry) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(x, solPlaine(x, z), z); g.rotation.y = ry; scene.add(g);
  g.add(mesh(new THREE.CylinderGeometry(0.78, 0.88, 0.9, 14), M.gres, 0, 0.45, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 14), new THREE.MeshBasicMaterial({ color: 0x0a1410 }), 0, 0.88, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.80, 0.80, 0.12, 14), M.dalle, 0, 0.95, 0));
  const mat2 = mesh(new THREE.CylinderGeometry(0.14, 0.19, 3.9, 8), M.rondin, -2.1, 1.95, 0); mat2.castShadow = true; g.add(mat2);
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8), M.bois, -2.1, 3.75, 0).rotateX(Math.PI / 2));
  { const fl = mesh(new THREE.CylinderGeometry(0.075, 0.13, 5.6, 7), M.bois, -0.6, 3.35, 0);
    fl.rotation.z = -0.44; fl.castShadow = true; g.add(fl); }
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.3, 4), mat(0xa08a62), 0.72, 2.25, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.30, 10), M.planche, 0.72, 1.00, 0));
  g.add(mesh(new THREE.TorusGeometry(0.19, 0.022, 5, 12), M.fer, 0.72, 1.16, 0).rotateX(Math.PI / 2));
  g.add(mesh(sphG(0.24, 7), M.gres, -2.1, 0.22, 0));                                        // contrepoids
  g.add(mesh(sphG(0.14, 6), M.mousse, 0.58, 0.55, 0.42));
  addCap(x, z, x, z, 0.95, 1.2); addCap(x - 2.1 * Math.cos(ry), z + 2.1 * Math.sin(ry), x - 2.1 * Math.cos(ry), z + 2.1 * Math.sin(ry), 0.3, 4.2);
}

// ---------- l'oratoire ----------
// La chapelle de carrefour : une niche de brique, une statuette, deux bouquets. Pas de
// lumière ponctuelle — le budget du niveau est déjà tenu, la statuette est émissive.
function oratoire(x, z, ry) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(x, solPlaine(x, z), z); g.rotation.y = ry; scene.add(g);
  g.add(mesh(rboxG(1.5, 0.24, 1.2, 0.03, 2), M.gres, 0, 0.12, 0));
  { const f = new THREE.Mesh(rboxG(1.15, 2.3, 0.95, 0.04, 2), M.brique); f.position.y = 1.35; f.castShadow = true; g.add(f); }
  g.add(mesh(boxG(0.62, 0.85, 0.42), mat(0x2b2318, { roughness: 1 }), 0, 1.80, 0.36));      // fond de niche
  g.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.42, 10, 1, false, 0, Math.PI), mat(0x2b2318, { roughness: 1 }), 0, 2.22, 0.36).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.12, 10, 1, false, 0, Math.PI), M.gres, 0, 2.22, 0.50).rotateX(Math.PI / 2));
  { const st = mesh(new THREE.ConeGeometry(0.16, 0.62, 8), mat(0xe8e0cc, { roughness: 0.7, emissive: 0xffe0a0, emissiveIntensity: 0.2 }), 0, 1.72, 0.42);
    g.add(st); g.add(mesh(sphG(0.085, 8), mat(0xe8e0cc, { roughness: 0.7 }), 0, 2.08, 0.42)); }
  g.add(mesh(rboxG(1.35, 0.16, 1.15, 0.03, 2), M.gres, 0, 2.58, 0));
  { const t = mesh(new THREE.ConeGeometry(0.95, 0.65, 4), M.tuile, 0, 2.98, 0); t.rotation.y = Math.PI / 4; t.castShadow = true; g.add(t); }
  g.add(mesh(boxG(0.07, 0.42, 0.07), M.fer, 0, 3.45, 0));
  g.add(mesh(boxG(0.26, 0.07, 0.07), M.fer, 0, 3.55, 0));
  for (const sx of [-1, 1]) { g.add(mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.26, 9), M.planche, sx * 0.48, 0.37, 0.52));
    for (let k = 0; k < 4; k++) g.add(mesh(sphG(0.05, 6), mat([0xd8c04a, 0xc05a6a, 0xe8e2d0][k % 3]), sx * 0.48 + rand(-0.09, 0.09), 0.58, 0.52 + rand(-0.07, 0.07))); }
  addCap(x, z, x, z, 0.8, 3.6);
}

// ---------- charrette, tas de cailloux, meule ----------
function tombereau(x, z, ry) {
  const M = matsCampagne(), g = new THREE.Group();
  g.position.set(x, solPlaine(x, z), z); g.rotation.y = ry; scene.add(g);
  const cai = new THREE.Group(); cai.position.y = 1.0; g.add(cai);
  cai.add(mesh(boxG(2.5, 0.09, 1.35), M.planche, 0, 0, 0));
  for (const sx of [-1, 1]) { const c = mesh(boxG(0.07, 0.62, 1.35), M.planche, sx * 1.25, 0.31, 0); c.rotation.z = -sx * 0.14; cai.add(c); }
  for (const sz of [-1, 1]) { const c = mesh(boxG(2.5, 0.58, 0.07), M.planche, 0, 0.29, sz * 0.67); c.rotation.x = sz * 0.12; cai.add(c); }
  for (let k = 0; k < 5; k++) cai.add(mesh(boxG(0.09, 0.66, 1.4), M.bois, -1.0 + k * 0.5, 0.30, 0));
  for (const sx of [-1, 1]) {
    const r = new THREE.Group(); r.position.set(sx * 0.82, 0.62, 0); r.rotation.y = Math.PI / 2; g.add(r);
    r.add(mesh(new THREE.TorusGeometry(0.60, 0.07, 6, 16), M.bois, 0, 0, 0));
    r.add(mesh(new THREE.TorusGeometry(0.62, 0.035, 5, 18), M.fer, 0, 0, 0));
    for (let k = 0; k < 8; k++) r.add(mesh(boxG(0.06, 1.16, 0.06), M.bois, 0, 0, 0).rotateZ(k * Math.PI / 8));
    r.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 8), M.bois, 0, 0, 0).rotateX(Math.PI / 2));
  }
  g.add(mesh(boxG(0.09, 0.09, 2.6), M.bois, -0.35, 0.82, 1.5).rotateX(0.22));
  g.add(mesh(boxG(0.09, 0.09, 2.6), M.bois, 0.35, 0.82, 1.5).rotateX(0.22));
  g.add(mesh(boxG(0.8, 0.07, 0.07), M.bois, 0, 0.55, 2.7));
  { const fo = mesh(sphG(0.7, 8), M.paille, 0, 1.35, -0.1); fo.scale.set(1.6, 0.5, 0.85); g.add(fo); }
  addCap(x, z, x, z, 1.4, 1.7);
}

function tasDeCailloux(x, z) {
  const M = matsCampagne(), y = solPlaine(x, z), parts = [];
  for (let k = 0; k < 26; k++) {
    const a = rand(0, TAU), r = rand(0, 1.35), h = 0.35 * (1 - r / 1.6);
    parts.push(sphG(rand(0.09, 0.17), 6).translate(Math.cos(a) * r, y + 0.06 + rand(0, h), Math.sin(a) * r));
  }
  const m = new THREE.Mesh(mergeParts(parts), M.gres); m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  // la hotte et le marteau du cantonnier
  const g = new THREE.Group(); g.position.set(x + 1.7, y, z + 0.5); g.rotation.y = rand(0, TAU); scene.add(g);
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.55, 10), mat(0x7a6440, { roughness: 1 }), 0, 0.28, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), M.bois, 0.45, 0.5, 0).rotateZ(0.5));
  g.add(mesh(boxG(0.22, 0.10, 0.10), M.fer, 0.70, 0.98, 0));
  addCap(x, z, x, z, 1.5, 0.5);
}

function meuleDeFoin(x, z) {
  const M = matsCampagne(), y = solPlaine(x, z), g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = rand(0, TAU); scene.add(g);
  for (let k = 0; k < 5; k++) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 6), M.rondin, Math.cos(k * 1.25) * 1.3, 0.17, Math.sin(k * 1.25) * 1.3));
  g.add(mesh(new THREE.CylinderGeometry(1.75, 1.55, 1.9, 14), M.paille, 0, 1.28, 0));
  const co = mesh(new THREE.ConeGeometry(1.95, 1.7, 14), M.paille, 0, 3.05, 0); co.castShadow = true; g.add(co);
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 5), M.bois, 0, 4.05, 0));
  // la collision au-dessus du SOL de la meule (addCap prend une cote absolue), et la meule
  // se fauche : cinq coups d'épée pour une grosse meule de champ
  meuleFauchable(g, x, z, 1.85, addCap(x, z, x, z, 1.85, y + 4.2), 5);
}

// ---------- le hameau des Wattines ----------
// Un hameau-rue : tout se tient le long de la chaussée, parce que la chaussée est la seule
// chose qui existait avant lui. Deux chaumines, une grange, le four banal, le pigeonnier,
// le puits à balancier et l'oratoire. Aucune adresse n'est écrite en dur : chaque bâtiment
// est posé dans la première poche assez large que les arbres aient laissée.
function hameau(s0, s1) {
  const M = matsCampagne(), occupe = [];
  const libreS = (s, demi, cote) => !occupe.some(o => o[2] === cote && s - demi < o[1] && s + demi > o[0]);
  const poser = (w, d, demi, offs, sA, sB, fn) => {
    let best = null;
    for (let s = sA; s <= sB; s += 1.5) for (const off of offs) {
      const cote = off < 0 ? -1 : 1;
      if (!libreS(s, demi, cote)) continue;
      const p = rte(s, off), ry = ryFace(p, cote), q = libreBati(p, ry, w, d) - 0.5;
      if (q <= 0) continue;
      const note = q - Math.abs(off) * 0.08;
      if (!best || note > best.note) best = { ...p, s, off, cote, ry, note };
    }
    if (best) { fn(best); occupe.push([best.s - demi, best.s + demi, best.cote]); }
    return best;
  };
  // l'aire de terre battue du hameau, sous la chaussée et débordant sur les deux accotements
  ruban(s0 - 3, s1 + 3, [{ o: -6.4, dy: 0.012, c: 0.82 }, { o: -3.2, dy: 0.014, c: 0.95 }, { o: 3.2, dy: 0.014, c: 0.95 }, { o: 6.4, dy: 0.012, c: 0.82 }], M.chaussee, 3.0);

  const L = s1 - s0, D = [8.8, 10.2, 11.6];
  const g1 = D.map(v => v), d1 = D.map(v => -v);
  const pris = [];
  pris.push(poser(9.0, 5.6, 6.0, [...g1, ...d1], s0 + 4, s0 + L * 0.42,
    (p) => chaumine(p.x, p.z, p.ry, { w: 8.2, d: 5.2, toit: 'chaume', mur: 'torchis', volet: 0x4a5a3e, chaud: true, dx: -2.0 })));
  const cote1 = pris[0] ? pris[0].cote : 1;
  pris.push(poser(11.4, 7.2, 7.5, (cote1 > 0 ? g1 : d1).map(v => v + cote1 * 1.6), s0 + L * 0.30, s1 - 4,
    (p) => grange(p.x, p.z, p.ry, { w: 10.5, d: 6.6 })));
  pris.push(poser(8.4, 5.4, 5.6, (cote1 > 0 ? d1 : g1), s0 + L * 0.22, s1 - 6,
    (p) => chaumine(p.x, p.z, p.ry, { w: 7.4, d: 5.0, toit: 'tuile', mur: 'chaux', volet: 0x5a3f2e, fen: [1.4, 3.0], dx: -1.6 })));
  poser(5.0, 4.6, 3.4, [...g1, ...d1], s0 + L * 0.45, s1 - 3, (p) => fourBanal(p.x, p.z, p.ry));
  poser(3.4, 3.4, 2.6, [7.4, -7.4, 9.0, -9.0], s0 + 2, s1 - 2, (p) => pigeonnier(p.x, p.z, p.ry));
  poser(5.4, 2.8, 3.2, [6.6, -6.6], s0 + 3, s1 - 3, (p) => puitsBalancier(p.x, p.z, p.ry));
  poser(2.0, 1.8, 1.6, [5.1, -5.1], s0 + 1, s1 - 1, (p) => oratoire(p.x, p.z, p.ry));
  { const p = rte(s0 + L * 0.5, cote1 * 4.9); tombereau(p.x, p.z, p.ry + 0.22); }
  { const p = rte(s0 + L * 0.72, -cote1 * 4.7);                                            // le tas de bois du hameau
    const b = [], y = solPlaine(p.x, p.z);
    for (let k = 0; k < 18; k++) { const r = 0.11 + (k % 3) * 0.02;
      b.push(new THREE.CylinderGeometry(r, r, 1.3, 7).rotateZ(Math.PI / 2).rotateY(p.ry).translate(p.x + ((k % 6) - 2.5) * 0.26 * Math.cos(p.ry), y + 0.13 + Math.floor(k / 6) * 0.24, p.z - ((k % 6) - 2.5) * 0.26 * Math.sin(p.ry))); }
    const bm = new THREE.Mesh(mergeParts(b), M.rondin); bm.castShadow = true; scene.add(bm);
    addCap(p.x, p.z, p.x, p.z, 0.9, 0.9); }
  return cote1;
}

// =====================================================================
//  Le chef d'orchestre
// =====================================================================
export function buildRoute() {
  rteInit(); matsCampagne();
  releverObstacles(-70, 235, 225, 605);

  // Bornes du trajet aménagé. En amont, deux conditions : le glacis reste dégagé — on ne
  // bâtit pas sous le canon de la citadelle, c'est la règle qui écarte déjà les buttes —
  // et la route doit être PRATICABLE. Depuis l'ajout des ouvrages avancés, son premier
  // tronçon passe dans l'eau (cf. l'avertissement de `verifierChaussee`) : y planter une
  // haie ne ferait que décorer une douve. En aval, la ceinture maraîchère du bourg
  // appartient au secteur Village, on s'arrête avant.
  let A = 16, B = RTE.L - 10;
  for (let s = 0; s < RTE.L; s += 2) {
    const p = rte(s);
    if (levelBlocked(p.x, p.z, 0.6, false, 0.3)) continue;
    if (sdPent(p.x, p.z) < MOAT_OUT + 18) continue;
    A = s + 3; break;
  }
  for (let s = RTE.L - 2; s > 20; s -= 2) { const p = rte(s); if (!nearTown(p.x, p.z, 5)) { B = s - 2; break; } }
  A = clamp(A, 12, RTE.L * 0.55); B = clamp(B, A + 60, RTE.L);
  const at = (t) => A + (B - A) * t;

  chausseeEt(0, RTE.L);                                          // la chaussée va d'un bout à l'autre
  const trous = [[], []];                                        // tronçons où fossé et haie s'interrompent
  const cle = (c) => (c < 0 ? 0 : 1);
  const trou = (c, s0, s1) => trous[cle(c)].push([s0, s1]);
  const entrees = [];                                            // brèches de haie : entrées de champ

  // --- le poteau indicateur, au sortir du pont
  { const p = rte(Math.max(5, A - 12), -4.8); poteauIndicateur(p.x, p.z, p.ry + 0.35); }

  // --- la croix de chemin, au premier coude
  { const s = at(0.15);
    let cote = -1, mieux = -9;
    for (const c of [-1, 1]) { const q = rte(s, c * 7.6), v = degagement(q.x, q.z, 6); if (v > mieux) { mieux = v; cote = c; } }
    const p = rte(s, cote * (mieux > 2.6 ? 7.6 : 6.2));
    croixDeChemin(p.x, p.z, ryFace(p, cote));
    trou(cote, s - 7.5, s + 7.5); }

  // --- la mare, le lavoir et le bac
  { let pl = placeBati(at(0.22), at(0.36), [-13, -11.5, -10, 10, 11.5, 13], 13, 15, 0.4), mare = true;
    if (!pl) { pl = placeBati(at(0.20), at(0.38), [-8.6, -7.6, 7.6, 8.6], 8, 8.5, 0.3); mare = false; }
    if (pl) { lavoirEtMare(pl, mare); const w = mare ? 11 : 7.5; trou(pl.cote, pl.s - w, pl.s + w);
      // zoneName() est dans carte.js et ne peut pas deviner où la poche libre s'est trouvée :
      // on lui laisse l'emplacement réel (le rayon couvre la mare, le bassin et la descente)
      PARTAGE.lavoir = { x: pl.x, z: pl.z, r: w + 1 }; }
    else console.warn('campagne : pas de place pour le lavoir entre les arbres'); }

  // --- la pâture close
  { const pl = placeBati(at(0.40), at(0.56), [-13.5, -12, 12, 13.5], 17, 14, 0.4);
    if (pl) { pature(pl, 8.0, 6.5); trou(pl.cote, pl.s - 10.5, pl.s + 10.5); }
    else console.warn('campagne : pas de place pour la pâture entre les arbres'); }

  // --- le hameau
  { const h0 = at(0.62), h1 = at(0.84);
    hameau(h0, h1);
    trou(-1, h0 - 5, h1 + 5); trou(1, h0 - 5, h1 + 5);
    // Le hameau est un hameau-rue : sa zone est un couloir le long de la chaussée, pas un
    // cercle. Dix-huit mètres de part et d'autre couvrent la grange, la plus reculée des
    // bâtisses (décalage 13,2 m + demi-profondeur 3,6 m).
    const pts = [];
    for (let s = h0 - 5; s <= h1 + 5; s += 6) { const q = rte(s); pts.push([q.x, q.z]); }
    PARTAGE.hameau = { pts, demi: 18 };
    // un petit coffre à écus (bourse.js), dans l'herbe entre deux bâtisses, à l'écart de la
    // chaussée : on le trouve en faisant le tour du hameau, pas en le traversant
    { const m = Math.floor(pts.length / 2), [ax, az] = pts[m], [bx2, bz2] = pts[Math.min(pts.length - 1, m + 1)];
      const L = Math.hypot(bx2 - ax, bz2 - az) || 1, nx = -(bz2 - az) / L, nz = (bx2 - ax) / L;
      trouve: for (const d of [7, 9, 11, 13, 15]) for (const c of [1, -1]) for (const g of [0, 3, -3, 6, -6]) {
        const x = ax + nx * d * c + (bx2 - ax) / L * g, z = az + nz * d * c + (bz2 - az) / L * g, y = solPlaine(x, z);
        if (E.blocked(x, z, 1.4, false, y + 0.1) || !BOURSE.aCielOuvert(x, y, z)) continue;
        BOURSE.petitCoffre('hameau', x, y, z, 15, Math.atan2(-nx * c, -nz * c));
        break trouve;
      } } }

  // --- les meules du champ de foin, et le tas de cailloux du cantonnier
  { const pl = placeBati(at(0.56), at(0.62), [-10.5, 10.5], 6, 6, 0.3);
    if (pl) { meuleDeFoin(pl.x, pl.z); trou(pl.cote, pl.s - 5, pl.s + 5); } }
  { const p = rte(at(0.90), -4.6); tasDeCailloux(p.x, p.z); }

  // --- les bornes, tous les huitièmes du trajet, alternées
  for (let k = 0; k < 8; k++) borne(at(0.07 + k * 0.122), k % 2 ? 1 : -1, false);
  borne(at(0.50), -1, true);

  // --- fossés, talus et haies sur ce que les trous laissent
  for (const c of [-1, 1]) {
    const gaps = trous[cle(c)].slice().sort((a, b) => a[0] - b[0]);
    let s = A + 2;
    const runs = [];
    for (const [g0, g1] of gaps) { if (g0 > s + 6) runs.push([s, g0]); s = Math.max(s, g1); }
    if (B - 2 > s + 6) runs.push([s, B - 2]);
    for (const [r0, r1] of runs) {
      fosseEt(r0, r1, c);
      // Un tronçon de plus de 34 m gagne son entrée de champ : brèche dans la haie, ponceau
      // sur le fossé, barrière à claire-voie. C'est ce qui donne à la haie une raison d'être
      // interrompue, et au fossé une raison d'être franchi.
      const coupe = r1 - r0 > 34 ? (r0 + r1) / 2 : null;
      if (coupe === null) semerHaie(r0 + 0.8, r1 - 0.8, c);
      else {
        semerHaie(r0 + 0.8, coupe - 2.3, c); semerHaie(coupe + 2.3, r1 - 0.8, c);
        const q = rte(coupe, c * 6.7);
        ponceau(coupe, c); barriere(q.x, q.z, q.ry, 3.4);   // la barrière bouche la brèche : elle suit la haie
        entrees.push(Math.round(coupe));
      }
      if (r1 - r0 > 26) eauFosse(r0 + 6, r0 + (r1 - r0) * 0.55, c);       // eau dormante sur les tronçons longs
      for (let t = r0 + 6; t < r1 - 4; t += rand(11, 17)) {                // les trognes de saule
        if (coupe !== null && Math.abs(t - coupe) < 4) continue;
        const p = rte(t, c * 7.7);
        if (degagement(p.x, p.z, 4) > 1.5) trogne(p.x, p.z, rand(2.1, 3.0));
      }
    }
  }
  poserHaies();

  // --- flaques dans les ornières
  for (let k = 0; k < 9; k++) {
    const s = at(rand(0.05, 0.95)), o = (k % 2 ? 1 : -1) * rand(0.95, 1.5), p = rte(s, o);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(rand(0.5, 1.15), 12), matsCampagne().eau);
    fl.rotation.x = -Math.PI / 2; fl.rotation.z = rand(0, TAU); fl.scale.set(1, 2.4, 1);
    fl.position.set(p.x, p.y + 0.036, p.z); scene.add(fl);
  }
  console.log('campagne : route habitée de', Math.round(A), 'à', Math.round(B), 'm sur', Math.round(RTE.L),
    '—', entrees.length, 'entrées de champ');
  verifierChaussee();
}

// La chaussée doit rester praticable d'un bout à l'autre : c'est le seul chemin du pont au
// village. On la parcourt au mètre après avoir tout posé, et on dit à voix haute où elle est
// coupée — le décor de ce secteur ne doit jamais fermer la route, et si la route elle-même
// passe dans l'eau, cela se voit ici plutôt qu'en jouant.
function verifierChaussee() {
  const coupes = [];
  let debut = null, cause = '';
  for (let s = 0; s <= RTE.L; s += 1) {
    const p = rte(s);
    // deux causes bien différentes, et deux propriétaires différents : « eau » veut dire que
    // le tracé de carte.js traverse une douve, « obstacle » qu'une capsule barre la chaussée
    // (jusqu'ici, toujours un tronc planté par le secteur Nature dans le couloir de la route).
    const eau = levelBlocked(p.x, p.z, 0.5, false, 0.3);
    const mur = eau || E.blocked(p.x, p.z, 0.5, false, 0.3);
    if (mur && debut === null) { debut = s; cause = eau ? 'eau' : 'obstacle'; }
    if (!mur && debut !== null) { coupes.push(Math.round(debut) + '–' + Math.round(s) + ' m (' + cause + ')'); debut = null; }
  }
  if (debut !== null) coupes.push(Math.round(debut) + '–' + Math.round(RTE.L) + ' m (' + cause + ')');
  if (coupes.length) console.warn('campagne : chaussée coupée sur', coupes.join(', '));
}

// ---------- éléments qui rendent le saut utile ----------

export function buildCountryside() {
  // La route et tout ce qui la borde : cf. la section « La route du pont au village ».
  // Elle remplace 36 quads posés à plat à y = 0,03 et des « bornes » plantées à x + 3,9 —
  // c'est-à-dire au milieu de la chaussée dès que la route partait vers l'est.
  buildRoute();
  // moulin à vent
  { const mx = FERME.x, mz = FERME.z; // dans la plaine, à l'ouest de la maison de Camille (hors des fossés)
    // Le moulin était bâti à la cote 0, ses caisses aussi : il se pose maintenant sur le
    // relevé, comme ses champs — c'est le pied de la tour qui donne la cote de la cour.
    const my = solPlaine(mx, mz);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 11, 14), patinerMat(brickScaled(2 * Math.PI * 2.7, 11, { color: 0xd8c8b0 }), { echelle: 14, force: 0.26, humide: 2.4, basY: my })); tower.position.set(mx, my + 5.5, mz); tower.castShadow = tower.receiveShadow = true; scene.add(tower);
    scene.add(mesh(new THREE.ConeGeometry(2.8, 3, 14), pbrRepeat(T.plank, 3, 1, { color: 0x5a4030 }), mx, my + 12.4, mz));
    scene.add(mesh(boxG(1.4, 2.4, 0.15), pbrRepeat(T.plank, 1, 2), mx, solPlaine(mx, mz + 3.15) + 1.2, mz + 3.15)); scene.add(mesh(boxG(0.9, 0.9, 0.2), mat(0x8fb0d0, { roughness: 0.2 }), mx, my + 6, mz + 2.6));
    const hub = new THREE.Group(); hub.position.set(mx, my + 10.5, mz + 2.9); hub.userData.dynamic = true; scene.add(hub);
    hub.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8), mat(0x4a3320), 0, 0, 0).rotateX(Math.PI / 2));
    for (let k = 0; k < 4; k++) { const bl = new THREE.Group(); bl.rotation.z = k * Math.PI / 2; bl.add(mesh(boxG(0.25, 8, 0.25), mat(0x4a3320), 0, 4, 0)); bl.add(mesh(boxG(1.6, 6.5, 0.06), mat(0xf0e6d0, { roughness: 1, side: THREE.DoubleSide }), 0.9, 4.6, 0)); for (let j = 0; j < 5; j++) bl.add(mesh(boxG(1.7, 0.06, 0.1), mat(0x4a3320), 0.9, 1.6 + j * 1.5, 0)); hub.add(bl); }
    PARTAGE.windmillBlades = hub;
    addCap(mx, mz, mx, mz, 3.3, my + 14);
    // champs labourés avec rangs de cultures, meules de foin, clôtures
    // La terre labourée passe DEVANT l'herbe : maillée tous les deux mètres, elle ne suit pas
    // le maillage du terrain entre ses sommets, et le terrain perçait en plaques vertes au
    // travers. Huit centimètres au-dessus du sol et un décalage de profondeur y suffisent.
    const fieldMat = pbrRepeat(T.dirt, 3, 2, { color: 0x8a6a48, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const [dx, dz, fw, fd] of CHAMPS) { const fx = FERME.x + dx * ECH, fz = FERME.z + dz * ECH;
      // LES CHAMPS ÉPOUSENT LE RELEVÉ. Ils étaient posés à plat à la cote 0 ; le terrain, lui,
      // descend jusqu'à −1,97 m sous les parcelles de l'est : la terre labourée, le blé et les
      // clôtures flottaient jusqu'à deux mètres au-dessus de l'herbe. La parcelle est maillée
      // tous les deux mètres et chaque sommet, chaque épi et chaque poteau prend le sol réel.
      const gf = new THREE.PlaneGeometry(fw, fd, Math.ceil(fw / 2), Math.ceil(fd / 2)); gf.rotateX(-Math.PI / 2);
      { const pa = gf.getAttribute('position');
        for (let i = 0; i < pa.count; i++) pa.setY(i, solPlaine(fx + pa.getX(i), fz + pa.getZ(i)) + 0.08);
        gf.computeVertexNormals(); }
      const f = new THREE.Mesh(gf, fieldMat); f.position.set(fx, 0, fz); f.receiveShadow = true; scene.add(f);
      // blé : quads croisés en rangs serrés, teinte dorée variable
      const ep1 = new THREE.PlaneGeometry(0.42, 1.15); ep1.translate(0, 0.575, 0);
      const ep2 = ep1.clone(); ep2.rotateY(Math.PI / 2);
      const earGeo = mergeParts([ep1, ep2]);
      WHEAT_TEX = WHEAT_TEX || wheatBladeTexture();
      const earMat = new THREE.MeshStandardMaterial({ map: WHEAT_TEX, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1, color: 0xffffff });
      const rows = Math.floor(fd / 0.55), perRow = Math.floor((fw - 1.0) / 0.42);
      const wI = new THREE.InstancedMesh(earGeo, earMat, rows * perRow);
      const M = new THREE.Matrix4(), Q2 = new THREE.Quaternion(), P2 = new THREE.Vector3(), S2 = new THREE.Vector3(), E2 = new THREE.Euler(), C2 = new THREE.Color();
      let wi = 0;
      for (let k = 0; k < rows; k++) for (let j = 0; j < perRow; j++) {
        P2.set(fx - (fw - 1.0) / 2 + j * 0.42 + rand(-0.1, 0.1), 0, fz - fd / 2 + 0.5 + k * 0.55 + rand(-0.08, 0.08));
        P2.y = solPlaine(P2.x, P2.z) + 0.08;
        Q2.setFromEuler(E2.set(rand(-0.08, 0.08), rand(0, TAU), rand(-0.06, 0.06)));
        const s = rand(0.85, 1.2); S2.set(s, s * rand(0.85, 1.15), s);
          wI.setColorAt(wi, C2.setHSL(0.115 + rand(-0.02, 0.02), rand(0.26, 0.46), rand(0.50, 0.68)));
        wI.setMatrixAt(wi++, M.compose(P2, Q2, S2));
      }
      // BRASSER L'ORDRE DES ÉPIS. La qualité réduite garde les `count` premiers (game.js, Q) :
      // semés rang par rang, c'était tout un bout du champ qui restait, et l'autre, nu. Mêlés
      // une fois ici, les garder « les premiers » éclaircit le champ partout à la fois.
      { const m0 = wI.instanceMatrix.array.slice(0, wi * 16), c0 = wI.instanceColor ? wI.instanceColor.array.slice(0, wi * 3) : null;
        const ordre = [...Array(wi).keys()];
        for (let k = wi - 1; k > 0; k--) { const j = Math.floor(rand(0, k + 1)); const t = ordre[k]; ordre[k] = ordre[j]; ordre[j] = t; }
        for (let k = 0; k < wi; k++) {
          wI.instanceMatrix.array.set(m0.subarray(ordre[k] * 16, ordre[k] * 16 + 16), k * 16);
          if (c0) wI.instanceColor.array.set(c0.subarray(ordre[k] * 3, ordre[k] * 3 + 3), k * 3);
        } }
      wI.count = wi; wI.instanceMatrix.needsUpdate = true; if (wI.instanceColor) wI.instanceColor.needsUpdate = true;
      wI.castShadow = true; wI.receiveShadow = true; scene.add(wI);
      wI.userData.plein = wi; BLES.push(wI);
      faucherChamp(wI, fx, fz, Math.hypot(fw, fd) / 2);   // le blé se fauche à l'épée (nature.js)
      if (!perf.wheat) { perf.wheat = wI; perf.wheatFull = wi; }   // game.js ne pilote que la première parcelle…
      // clôture : poteaux au sol, une lisse par travée, inclinée comme le terrain
      for (const sx of [-1, 1]) { const n = Math.round(fw / 2), zc = fz + sx * (fd / 2 + 0.3), bois = mat(0x6a4a2a);
        const pied = (k) => { const x = fx - fw / 2 + k * fw / n; return [x, solPlaine(x, zc)]; };
        for (let k = 0; k <= n; k++) { const [x, y] = pied(k); scene.add(mesh(boxG(0.14, 1.0, 0.14), bois, x, y + 0.5, zc)); }
        for (let k = 0; k < n; k++) { const [x0, y0] = pied(k), [x1, y1] = pied(k + 1), L = Math.hypot(x1 - x0, y1 - y0);
          const lisse = mesh(boxG(L, 0.08, 0.08), bois, (x0 + x1) / 2, (y0 + y1) / 2 + 0.85, zc); lisse.rotation.z = Math.atan2(y1 - y0, x1 - x0); scene.add(lisse); }
        // une capsule par travée, à la hauteur de SA lisse : une seule, à la cote absolue
        // 1,1 m, barrait le passage même là où le terrain descend de deux mètres, et
        // laissait passer par-dessus là où il monte
        for (let k = 0; k < n; k++) { const [x0, y0] = pied(k), [x1, y1] = pied(k + 1);
          addCap(x0, zc, x1, zc, 0.15, Math.max(y0, y1) + 1.1); } }
    }
    // Les trois meules étaient écrites en coordonnées ABSOLUES de l'ancienne carte : depuis
    // la bascule 1:1 elles atterrissaient à 400 m du moulin, en plein bois. Elles se
    // rapportent maintenant à FERME, comme les champs, et se posent sur le relief.
    for (const [dx, dz] of [[-6, -20], [-3, -18], [-20, -3]]) {
      const hx = FERME.x + dx * ECH, hz = FERME.z + dz * ECH, hy = solPlaine(hx, hz);
      // la meule a son pied à la cote du sol : c'est lui qui s'affaisse sous les coups
      const cone = new THREE.ConeGeometry(1.5, 2.4, 10); cone.translate(0, 1.2, 0);
      const meule = mesh(cone, mat(0xd8b860, { roughness: 1 }), hx, hy, hz); scene.add(meule);
      meuleFauchable(meule, hx, hz, 1.4, addCap(hx, hz, hx, hz, 1.4, hy + 2.5), 3);
    }
    scene.add(mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.9, 10), pbrRepeat(T.plank, 2, 1), mx + 4, solPlaine(mx + 4, mz - 2) + 0.45, mz - 2)); scene.add(mesh(boxG(1.2, 0.6, 1.6), pbrRepeat(T.plank, 1, 1), mx + 4.5, solPlaine(mx + 4.5, mz + 2.5) + 0.3, mz + 2.5)); }
  // …les quatre le sont ici, et la haie perd son ombre portée dès le premier palier.
  Q.hooks.push((l) => {
    for (const w of BLES) w.count = Math.round(w.userData.plein * [1, 0.7, 0.4, 0.2][l]);
    if (HAIE_MESH) HAIE_MESH.castShadow = l < 1;
  });
}

// =====================================================================
//  Peuplement
// =====================================================================
