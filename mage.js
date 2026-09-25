import * as PNJ_E from './engine.js?v=27';
import * as PNJ from './pnj.js';
// The Legend of Camille — niveau 5 : l'intérieur de la chaumière du vieux mage
// =====================================================================
// Une seule pièce, volontairement petite et encombrée : c'est la taille que laissent les
// murs extérieurs (9,4 × 7,6 hors tout, 20 cm d'épaisseur → 9,0 × 7,2 dedans). Rien n'est
// agrandi par un facteur d'échelle comme dans house.js / tavern.js ; tout est déjà en
// mètres monde, ce qui évite d'avoir à compenser quoi que ce soit.
//
// Le plafond n'est pas une dalle : on voit la charpente et le dessous du chaume, jusqu'à
// 5,3 m au faîtage. C'est ce qui fait qu'une pièce de 9 × 7 ne se lit pas comme une boîte.
// =====================================================================
import { THREE, rand, TAU, scene, G, T, mat, pbr, pbrRepeat, phMat, stoneMat, IRON, GOLD, hemi, sun, renderer, bloom,
  mesh, boxG, sphG, capG, rboxG, latheG, world, addCap, addBox, addPlatform, makeTorch, makeCorbeau, makeHeartContainer,
  makeHead, makeTorso, makeLeg, makeArm, SKIN, SFX, state, player, burst,
  addInteract, showMessage, saveGame, goToLevel, bootLevel, minimapDots, makeSky, dialogue } from './engine.js?v=27';
import * as BOURSE from './bourse.js';
import * as LOOK from './look.js';

const W = 9.0, D = 7.2, HM = 3.4, FAITE = 5.3;      // largeur, profondeur, hauteur des murs, faîtage
const DOOR_X = 1.4;                                  // la porte est décalée, comme dehors
// sortie = MAGE + le pas de porte, tourne de YA = -0,38 rad :
//   x = MAGE.x + 1,4 cos(YA) + 6,4 sin(YA)   z = MAGE.z - 1,4 sin(YA) + 6,4 cos(YA)
// MAGE suit ECH : constante a REPORTER a chaque changement d'echelle du plan.
const EXIT = { level: 'citadel', pos: [-460.07, 0, 267.46], yaw: -0.38 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let feu, cristal, corbeau, mage, coeur = null, lampes = [];

// ---------------------------------------------------------------------
//  Le vieux mage
// ---------------------------------------------------------------------
// Même anatomie que les villageois (makeHead/makeTorso/makeArm/makeLeg), en plus voûté :
// robe longue, barbe jusqu'au ventre, bonnet mou, bâton noueux.
function makeMage() {
  const g = new THREE.Group();
  const peau = mat(0xe3c3a4, { roughness: 0.72 }), robe = mat(0x3a4a6a, { roughness: 0.92 }), ceint = mat(0x6a5230, { roughness: 0.8 });
  g.add(makeTorso({ top: robe, bottom: robe, belt: ceint, width: 1.1 }));
  // la robe : un tronc de cône qui tombe des hanches aux chevilles, elle cache les jambes
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.78, 1.5, 14, 1, true), robe, 0, 0.75, 0));
  const tete = makeHead({ skin: 0xe3c3a4, hair: 0xe8e4dc, style: 'long', beard: 0xe8e4dc, moustache: 0xe8e4dc, iris: 0x5a7ab0 });
  tete.position.set(0, 2.32, 0); g.add(tete);
  // barbe longue : trois cônes emboîtés sous le menton
  for (let k = 0; k < 3; k++) g.add(mesh(new THREE.ConeGeometry(0.27 - k * 0.06, 0.55, 9), mat(0xe8e4dc, { roughness: 1 }), 0, 2.02 - k * 0.32, 0.14 - k * 0.02).rotateX(Math.PI));
  // bonnet mou tombant sur le côté
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 12), robe, 0, 2.66, 0));
  { const b = mesh(new THREE.ConeGeometry(0.33, 0.85, 12), robe, 0.16, 2.95, -0.12); b.rotation.z = -0.55; b.rotation.x = 0.25; g.add(b);
    g.add(mesh(sphG(0.08, 8), mat(0xd8b44a, { roughness: 0.4 }), 0.42, 3.22, -0.28)); }
  const bras = [];
  for (const sx of [-1, 1]) { const ep = makeArm(sx, { skin: peau, sleeve: robe, cuff: ceint }); ep.position.set(sx * 0.45, 1.92, 0); g.add(ep); bras.push(ep); }
  const jambes = [];
  for (const sx of [-1, 1]) { const h = makeLeg(sx, { cloth: robe, boot: mat(0x3a2a1a) }); h.position.set(sx * 0.16, 0.95, 0); g.add(h); jambes.push(h); }
  // bâton noueux, appuyé dans la main gauche
  { const bat = new THREE.Group(); bat.position.set(-0.6, 0, 0.1); bat.rotation.z = 0.09; g.add(bat);
    bat.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.5, 8), phMat('tree_trunk', 0.5, 2.5, { color: 0x6a5238 }), 0, 1.25, 0));
    for (let k = 0; k < 3; k++) bat.add(mesh(sphG(0.07, 7), phMat('tree_trunk', 0.3, 0.3, { color: 0x6a5238 }), 0, 0.6 + k * 0.6, 0.04));
    bat.add(mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 14), phMat('tree_trunk', 0.3, 0.3, { color: 0x6a5238 }), 0, 2.6, 0).rotateY(Math.PI / 2));
    bat.add(mesh(sphG(0.11, 12), mat(0x9ad44a, { emissive: 0x7ac030, emissiveIntensity: 1.4 }), 0, 2.6, 0)); }
  g.scale.setScalar(0.92);                         // un vieil homme voûté, un peu plus petit que Camille
  g.userData = { bras, jambes, tete, anim: 0, talk: 0, dynamic: true };
  return g;
}

function build() {
  makeSky(0x2a3a5a, 0x50708c, 0x9aa88c, true);
  scene.fog = null;
  hemi.intensity = 0.3; hemi.color.setHex(0xcfe0b0); hemi.groundColor.setHex(0x3a3020);
  sun.intensity = 0.55; sun.position.set(-5, 8, 7); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  renderer.toneMappingExposure = 1.02; bloom.strength = 0.32;    // le bloom porte la lueur verte
  G.camBack = 4.0; G.camUp = 2.3; G.camMaxY = FAITE - 0.5;

  const terre = phMat('dirt_floor', 6, 6, { color: 0x9a8a70 });
  const planche = phMat('wood_planks', 4, 4, { color: 0xa07f56 });
  const torchis = phMat('brown_mud_03', 4, 3, { color: 0xc8b896 });
  const pierre = phMat('old_stone_wall_02', 3, 3, { color: 0xa79d8a });
  const bois = phMat('wood_cabinet_worn_long', 2, 2, { color: 0x5b4330 });
  const rondin = phMat('tree_trunk', 1.6, 1.6, { color: 0x6a5744 });
  const chaumeIn = phMat('withered_grass', 2.4, 2.4, { color: 0x8a7848, roughness: 1 });
  const verre = mat(0x9fd070, { roughness: 0.12, transparent: true, opacity: 0.55, emissive: 0x4a8020, emissiveIntensity: 0.4 });
  const laiton = mat(0xb9913f, { metalness: 0.85, roughness: 0.33 });

  // ---------- sol, murs de torchis à colombage, plinthe de pierre ----------
  const sol = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, D), terre); sol.position.y = -0.1; sol.receiveShadow = true; scene.add(sol);
  const murs = [[-W / 2, -D / 2, W / 2, -D / 2], [-W / 2, D / 2, W / 2, D / 2], [-W / 2, -D / 2, -W / 2, D / 2], [W / 2, -D / 2, W / 2, D / 2]];
  for (const [ax, az, bx, bz] of murs) {
    const len = Math.hypot(bx - ax, bz - az), yaw = -Math.atan2(bz - az, bx - ax);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, HM, 0.3), torchis); m.position.set((ax + bx) / 2, HM / 2, (az + bz) / 2); m.rotation.y = yaw; m.receiveShadow = true; scene.add(m);
    const pl = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.36), pierre); pl.position.set((ax + bx) / 2, 0.27, (az + bz) / 2); pl.rotation.y = yaw; scene.add(pl);
    const n = Math.round(len / 1.5);
    for (let k = 0; k <= n; k++) { const t = k / n, po = mesh(boxG(0.17, HM, 0.34), bois, ax + (bx - ax) * t, HM / 2, az + (bz - az) * t); po.rotation.y = yaw; scene.add(po); }
    for (const yy of [0.58, HM - 0.12]) { const sb = mesh(boxG(len, 0.2, 0.36), bois, (ax + bx) / 2, yy, (az + bz) / 2); sb.rotation.y = yaw; scene.add(sb); }
    addCap(ax, az, bx, bz, 0.22, FAITE + 2);
  }
  // ---------- charpente et dessous du chaume : deux pans, pannes, chevrons, entraits ----------
  const PENTE = Math.atan2(FAITE - HM, D / 2);
  for (const sz of [-1, 1]) {
    const pan = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.22, Math.hypot(D / 2, FAITE - HM) + 0.2), chaumeIn);
    pan.position.set(0, (HM + FAITE) / 2, sz * D / 4); pan.rotation.x = sz * PENTE; pan.receiveShadow = true; scene.add(pan);
    for (let k = -3; k <= 3; k++) { const ch = mesh(boxG(0.1, 0.13, Math.hypot(D / 2, FAITE - HM)), rondin, k * (W / 7.4), (HM + FAITE) / 2 - 0.16, sz * D / 4); ch.rotation.x = sz * PENTE; scene.add(ch); }
  }
  scene.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, W, 8), rondin, 0, FAITE - 0.15, 0).rotateZ(Math.PI / 2));   // faîtière
  for (const x of [-2.6, 0.9]) { scene.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, D, 8), rondin, x, HM + 0.1, 0).rotateX(Math.PI / 2));  // entraits
    scene.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.7, 7), rondin, x, HM + 0.9, 0)); }
  // pignons triangulaires (est et ouest)
  { const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, FAITE - HM); tri.closePath();
    for (const sx of [-1, 1]) { const pg = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.25, bevelEnabled: false }), torchis); pg.rotation.y = Math.PI / 2; pg.position.set(sx * W / 2 + (sx > 0 ? 0 : 0.25), HM, 0); scene.add(pg); } }

  // ---------- porte (sud) : on la pousse pour ressortir ----------
  { const dz = D / 2 - 0.16;
    scene.add(mesh(boxG(1.7, 0.22, 0.4), bois, DOOR_X, 2.4, dz)); for (const sx of [-1, 1]) scene.add(mesh(boxG(0.2, 2.4, 0.4), bois, DOOR_X + sx * 0.75, 1.2, dz));
    const vant = mesh(boxG(1.35, 2.25, 0.1), phMat('wood_cabinet_worn_long', 1.4, 2.3, { color: 0x6b4d33 }), DOOR_X - 0.42, 1.13, dz - 0.45); vant.rotation.y = 0.85; scene.add(vant);
    for (const yy of [0.5, 1.8]) { const p = mesh(boxG(1.25, 0.11, 0.04), IRON(), DOOR_X - 0.42, yy, dz - 0.4); p.rotation.y = 0.85; scene.add(p); }
    const jour = mesh(boxG(1.3, 2.2, 0.06), new THREE.MeshBasicMaterial({ color: 0x9fc8a0 }), DOOR_X, 1.1, dz + 0.02); scene.add(jour);
    addInteract({ pos: V(DOOR_X, 0, D / 2 - 1.0), r: 1.5, prompt: () => 'sortir dans la clairière',
      fn: () => goToLevel(EXIT.level, EXIT.pos, EXIT.yaw, 'Camille ressort dans la clairière…') }); }

  // ---------- fenêtres à petits carreaux (mêmes emplacements que dehors) ----------
  for (const [x, z, ry] of [[-1.9, D / 2 - 0.1, 0], [W / 2 - 0.1, 1.4, Math.PI / 2], [-W / 2 + 0.1, 1.6, -Math.PI / 2]]) {
    const g = new THREE.Group(); g.position.set(x, 2.0, z); g.rotation.y = ry; scene.add(g);
    g.add(mesh(boxG(1.0, 1.0, 0.1), verre, 0, 0, 0));
    for (const o of [-0.33, 0, 0.33]) { g.add(mesh(boxG(1.05, 0.05, 0.16), bois, 0, o, -0.02)); g.add(mesh(boxG(0.05, 1.05, 0.16), bois, o, 0, -0.02)); }
    g.add(mesh(boxG(1.25, 0.14, 0.34), bois, 0, -0.6, -0.08));
    const l = new THREE.PointLight(0xbfe0a0, 2.2, 6, 1.8); l.position.set(x * 0.8, 2.1, z * 0.8); scene.add(l); lampes.push(l);
  }

  // ---------- l'âtre (pignon ouest), feu vert et chaudron ----------
  const hx = -W / 2 + 0.5, hz = -0.7;
  scene.add(mesh(boxG(1.0, 2.5, 2.4), pierre, hx - 0.1, 1.25, hz));
  scene.add(mesh(boxG(0.7, HM - 2.5, 1.5), pierre, hx - 0.1, 2.5 + (HM - 2.5) / 2, hz));
  // fond d'âtre en pierre suiée — surtout PAS un MeshBasicMaterial noir, il avalerait
  // tout ce qu'on pose dedans (la leçon de l'estaminet, v24)
  scene.add(mesh(boxG(0.45, 1.5, 1.5), phMat('rock_wall_17', 1.5, 1.5, { color: 0x3a342c }), hx + 0.32, 0.85, hz));
  scene.add(mesh(boxG(1.3, 0.14, 2.7), pierre, hx + 0.5, 0.07, hz));                                  // dalle de foyer
  scene.add(mesh(boxG(1.15, 0.22, 2.5), bois, hx + 0.15, 2.6, hz));                                   // poutre de cheminée
  for (const [ox, oy, rz] of [[0.42, 0.22, 0.3], [0.58, 0.4, -0.4], [0.3, 0.5, 1.2]]) {
    const b = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.95, 7), rondin, hx + ox, oy, hz); b.rotation.z = Math.PI / 2 + rz * 0.2; b.rotation.y = rz; scene.add(b); }
  feu = makeTorch(); feu.position.set(hx + 0.45, 0.18, hz); feu.children[0].visible = false; feu.children[1].visible = false;
  feu.userData.light.intensity = 7; feu.userData.light.distance = 12; feu.userData.light.color.setHex(0x7ad04a);
  feu.userData.flame.material = mat(0xaaf060, { emissive: 0x7ad04a, emissiveIntensity: 2.2 });
  feu.userData.flame.scale.set(2.0, 2.3, 2.0); scene.add(feu);
  // crémaillère et chaudron qui bout
  scene.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), IRON(), hx + 0.45, 1.9, hz));
  scene.add(mesh(latheG([[0, 0], [0.34, 0.06], [0.42, 0.26], [0.38, 0.46], [0.4, 0.5], [0.36, 0.5]], 16), IRON(), hx + 0.45, 0.85, hz));
  scene.add(mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 14, Math.PI), IRON(), hx + 0.45, 1.35, hz));
  { const bouillon = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 16), mat(0x8ae040, { emissive: 0x6ac020, emissiveIntensity: 1.6 }), hx + 0.45, 1.29, hz); scene.add(bouillon); }
  addCap(hx + 0.4, hz - 1.2, hx + 0.4, hz + 1.2, 0.7);

  // ---------- paillasse du mage, sous la pente nord ----------
  { const bx = -3.2, bz = -D / 2 + 1.0;
    scene.add(mesh(boxG(2.0, 0.35, 1.1), bois, bx, 0.18, bz));
    scene.add(mesh(boxG(1.9, 0.3, 1.0), phMat('withered_grass', 1.9, 1.0, { color: 0xbfa878 }), bx, 0.5, bz));
    scene.add(mesh(boxG(1.9, 0.14, 0.9), mat(0x6a4a6a, { roughness: 1 }), bx, 0.68, bz + 0.05));
    scene.add(mesh(boxG(0.7, 0.2, 0.4), mat(0xe8e0d0, { roughness: 1 }), bx - 0.55, 0.72, bz));
    addCap(bx - 0.9, bz, bx + 0.9, bz, 0.6); }

  // ---------- l'établi d'alchimie, le long du mur nord ----------
  { const tz = -D / 2 + 0.55;
    scene.add(mesh(boxG(4.0, 0.12, 0.85), bois, 1.6, 0.95, tz));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) scene.add(mesh(boxG(0.12, 0.9, 0.12), bois, 1.6 + sx * 1.85, 0.45, tz + sz * 0.32));
    addCap(-0.3, tz, 3.5, tz, 0.5, 1.1);
    // alambic : cucurbite, chapiteau, serpentin, réchaud
    const vg = mat(0xcfe4d8, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45 });
    scene.add(mesh(latheG([[0, 0], [0.22, 0.03], [0.26, 0.18], [0.18, 0.3], [0.09, 0.36], [0.07, 0.46], [0, 0.46]], 16), vg, 0.5, 1.01, tz));
    scene.add(mesh(latheG([[0, 0], [0.13, 0.04], [0.15, 0.16], [0.05, 0.3], [0.04, 0.34], [0, 0.34]], 14), vg, 0.5, 1.47, tz));
    { const serp = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 6, 16), vg); serp.position.set(0.82, 1.35, tz); serp.rotation.y = Math.PI / 2; scene.add(serp); }
    scene.add(mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.16, 12), IRON(), 0.5, 1.03, tz));
    scene.add(mesh(sphG(0.11, 10), mat(0x9ad44a, { emissive: 0x7ac030, emissiveIntensity: 1.3 }), 0.5, 1.12, tz));
    // fioles alignées, de toutes les couleurs
    const COUL = [0x8a3ad0, 0x3ad0a0, 0xd0a03a, 0xd03a5a, 0x3a7ad0, 0x9ad44a];
    for (let k = 0; k < 8; k++) { const fx = 1.5 + k * 0.26, h = rand(0.16, 0.3);
      scene.add(mesh(latheG([[0, 0], [0.06, 0.01], [0.07, h * 0.7], [0.03, h], [0.035, h + 0.05], [0, h + 0.05]], 10), vg, fx, 1.01, tz - 0.12));
      scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, h * 0.55, 10), mat(COUL[k % 6], { roughness: 0.25, emissive: COUL[k % 6], emissiveIntensity: 0.35 }), fx, 1.04 + h * 0.27, tz - 0.12)); }
    // mortier, balance, grimoire ouvert et sa chandelle
    scene.add(mesh(latheG([[0, 0], [0.13, 0.02], [0.15, 0.13], [0.12, 0.14], [0.1, 0.04], [0, 0.04]], 12), pierre, 3.0, 1.01, tz + 0.15));
    scene.add(mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 6), bois, 3.05, 1.18, tz + 0.15).rotateZ(0.5));
    { const bal = new THREE.Group(); bal.position.set(3.55, 1.01, tz - 0.1); scene.add(bal);
      bal.add(mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.45, 8), laiton, 0, 0.22, 0));
      bal.add(mesh(boxG(0.5, 0.02, 0.02), laiton, 0, 0.45, 0));
      for (const sx of [-1, 1]) { bal.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), laiton, sx * 0.24, 0.38, 0)); bal.add(mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.02, 12), laiton, sx * 0.24, 0.31, 0)); } }
    { const gr = new THREE.Group(); gr.position.set(-0.05, 1.02, tz + 0.05); gr.rotation.y = -0.3; scene.add(gr);
      for (const sx of [-1, 1]) { const p = mesh(boxG(0.34, 0.03, 0.42), mat(0xf0e8d4, { roughness: 1 }), sx * 0.17, 0.02, 0); p.rotation.z = sx * -0.06; gr.add(p); }
      gr.add(mesh(boxG(0.74, 0.035, 0.46), mat(0x5a2a2a, { roughness: 0.8 }), 0, 0, 0));
      for (let k = 0; k < 5; k++) gr.add(mesh(boxG(0.16, 0.002, 0.24), mat(0x30281e), -0.16, 0.04, -0.14 + k * 0.07)); }
    scene.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 8), mat(0xf0e8d0), -0.55, 1.16, tz + 0.1));
    scene.add(mesh(sphG(0.05, 8), new THREE.MeshBasicMaterial({ color: 0xffc860 }), -0.55, 1.34, tz + 0.1));
    { const l = new THREE.PointLight(0xffb060, 2.0, 5); l.position.set(-0.55, 1.5, tz + 0.1); scene.add(l); lampes.push(l); } }

  // ---------- bibliothèque du mur est, du sol au chevron, avec son échelle ----------
  { const ex = W / 2 - 0.42;
    for (let r = 0; r < 5; r++) { scene.add(mesh(boxG(0.7, 0.06, 4.4), bois, ex, 0.55 + r * 0.6, -0.4));
      for (let k = 0; k < 16; k++) { const lz = -2.45 + k * 0.27 + rand(-0.02, 0.02), hh = rand(0.28, 0.46);
        if (Math.random() < 0.12) continue;
        const li = mesh(boxG(0.34, hh, 0.19), mat([0x7a3a2a, 0x2a4a6a, 0x4a6a3a, 0xa08a4a, 0x4a2a5a, 0x2a3a3a][k % 6], { roughness: 0.92 }), ex, 0.58 + r * 0.6 + hh / 2, lz);
        li.rotation.z = Math.random() < 0.12 ? 0.22 : 0; scene.add(li); } }
    for (const sz of [-2.6, 1.8]) scene.add(mesh(boxG(0.72, 3.2, 0.1), bois, ex, 1.6, sz));
    addCap(ex, -2.7, ex, 1.9, 0.42, 3.4);
    // échelle appuyée contre les rayonnages
    { const ec = new THREE.Group(); ec.position.set(ex - 0.55, 0, 0.9); ec.rotation.x = 0.0; ec.rotation.z = 0; scene.add(ec);
      for (const sz of [-0.22, 0.22]) { const m = mesh(boxG(0.07, 3.0, 0.07), rondin, 0, 1.5, sz); m.rotation.x = 0.16; ec.add(m); }
      for (let k = 0; k < 7; k++) ec.add(mesh(boxG(0.07, 0.05, 0.5), rondin, 0, 0.3 + k * 0.4, -0.22 + 0.22 - (0.3 + k * 0.4) * 0.16));
      addCap(ex - 0.55, 0.9, ex - 0.55, 0.9, 0.3, 3.0); } }

  // ---------- la table ronde, le globe céleste et le cercle de runes ----------
  { scene.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 18), phMat('wood_cabinet_worn_long', 1.9, 1.9, { color: 0x6b4d33 }), -0.4, 0.92, 1.9));
    scene.add(mesh(new THREE.CylinderGeometry(0.16, 0.38, 0.92, 10), bois, -0.4, 0.46, 1.9));
    addCap(-0.4, 1.9, -0.4, 1.9, 0.95, 1.05);
    // globe céleste : sphère bleu nuit constellée, dans son cercle de laiton
    const gl = new THREE.Group(); gl.position.set(-0.4, 1.32, 1.9); gl.userData.dynamic = true; scene.add(gl);
    gl.add(mesh(sphG(0.26, 18), mat(0x1c2748, { roughness: 0.55, emissive: 0x18224a, emissiveIntensity: 0.4 }), 0, 0, 0));
    for (let k = 0; k < 26; k++) { const a = rand(0, TAU), b = Math.acos(rand(-1, 1));
      gl.add(mesh(sphG(0.012, 5), new THREE.MeshBasicMaterial({ color: 0xffeaa0 }), 0.265 * Math.sin(b) * Math.cos(a), 0.265 * Math.cos(b), 0.265 * Math.sin(b) * Math.sin(a))); }
    gl.add(mesh(new THREE.TorusGeometry(0.3, 0.014, 6, 26), laiton, 0, 0, 0).rotateY(Math.PI / 2));
    gl.add(mesh(new THREE.TorusGeometry(0.3, 0.014, 6, 26), laiton, 0, 0, 0).rotateX(Math.PI / 2));
    scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.14, 12), laiton, -0.4, 1.02, 1.9));
    // cercle de runes tracé à la craie, et le cristal qui flotte au-dessus
    const cercle = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.36, 40), mat(0xd8e8c0, { emissive: 0x88c040, emissiveIntensity: 0.6, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    cercle.rotation.x = -Math.PI / 2; cercle.position.set(2.6, 0.03, 2.1); scene.add(cercle);
    const cercle2 = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 40), cercle.material); cercle2.rotation.x = -Math.PI / 2; cercle2.position.set(2.6, 0.03, 2.1); scene.add(cercle2);
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12;
      const ru = mesh(boxG(0.09, 0.012, 0.22), cercle.material, 2.6 + Math.cos(a) * 1.14, 0.032, 2.1 + Math.sin(a) * 1.14); ru.rotation.y = -a; scene.add(ru); }
    cristal = new THREE.Group(); cristal.position.set(2.6, 1.15, 2.1); cristal.userData.dynamic = true; scene.add(cristal);
    cristal.add(mesh(new THREE.OctahedronGeometry(0.26, 0), mat(0xb6f06a, { roughness: 0.1, metalness: 0.2, emissive: 0x7ad030, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 }), 0, 0, 0));
    { const l = new THREE.PointLight(0x8ae040, 4.5, 9, 1.6); cristal.add(l); lampes.push(l); } }

  // ---------- suspensions : herbes, oignons, un corbeau empaillé sur son perchoir ----------
  for (let k = 0; k < 9; k++) { const x = -3.4 + k * 0.78, bo = mesh(new THREE.ConeGeometry(0.13, 0.5, 6), mat([0x7a8a3a, 0x9a8a4a, 0x6a7a45, 0x8a6a3a][k % 4], { roughness: 1 }), x, HM - 0.45, D / 2 - 1.0);
    bo.rotation.x = Math.PI; bo.rotation.z = rand(-0.12, 0.12); scene.add(bo);
    scene.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), mat(0xcfc0a0), x, HM - 0.08, D / 2 - 1.0)); }
  for (let k = 0; k < 5; k++) { const x = -3.6 + k * 0.5; scene.add(mesh(sphG(0.11, 8), mat(0xc8a25a, { roughness: 0.95 }), x, HM - 0.4, -D / 2 + 1.3));
    scene.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4), mat(0xcfc0a0), x, HM - 0.14, -D / 2 + 1.3)); }
  { corbeau = makeCorbeau(); corbeau.position.set(3.4, 2.32, 2.6); corbeau.rotation.y = -2.2; corbeau.scale.setScalar(0.8); corbeau.userData.dynamic = true; scene.add(corbeau);
    scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), rondin, 3.4, 2.2, 2.6).rotateX(Math.PI / 2));
    for (const sz of [-0.5, 0.5]) scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 7), rondin, 3.4, 1.1, 2.6 + sz));
    addCap(3.4, 2.1, 3.4, 3.1, 0.2, 2.4); }

  // ---------- le socle du réceptacle de cœur, au fond à gauche ----------
  { const px = -3.9, pz = 2.5;
    scene.add(mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.16, 14), pierre, px, 0.08, pz));
    scene.add(mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.85, 14), pierre, px, 0.56, pz));
    scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.14, 14), pierre, px, 1.05, pz));
    addCap(px, pz, px, pz, 0.45, 1.2);
    if (!state.mageHeart) { coeur = makeHeartContainer(); coeur.position.set(px, 1.1, pz); coeur.scale.setScalar(0.8); scene.add(coeur); } }

  // ---------- le mage, debout près de l'âtre ----------
  mage = PNJ.buildRole('mage') || makeMage(); mage.position.set(-2.3, 0, -0.9); mage.rotation.y = 1.9; scene.add(mage);
  addCap(-2.3, -0.9, -2.3, -0.9, 0.5);
  addInteract({ pos: V(-1.4, 0, -0.5), r: 2.3, prompt: () => 'parler au vieux mage', fn: parler });
  // l'établi d'alchimie fait comptoir : c'est là qu'on achète les fioles
  addInteract({ pos: V(1.6, 0, -D / 2 + 1.5), r: 1.9, prompt: () => 'regarder les fioles du mage', fn: ouvrirBoutique });

  addBox(-W / 2 - 1, W / 2 + 1, -D / 2 - 1, -D / 2 - 0.4, 0.1);   // rien dehors : la pièce est close
}

// ---------------------------------------------------------------------
//  Le dialogue : c'est tout le contenu du lieu. Lore, puis le réceptacle.
// ---------------------------------------------------------------------
function parler() {
  mage.userData.talk = 5;
  const fin = () => { mage.userData.talk = 0; };
  if (state.mageHeart) {
    dialogue([
      { who: 'Le vieux mage', text: "« Reviens quand tu voudras, petite. Le feu est vert, la soupe est verte, mais elle nourrit. »" },
      { who: 'Le vieux mage', text: state.princeFreed
        ? "« Le prince est rentré, dis-tu ? Alors la citadelle peut se rendormir. Moi, je reste ici : les arbres font moins de bruit que les hommes. »"
        : "« Et souviens-toi : Phinaert est plus bête que méchant. C'est ce qui le rend dangereux. »" },
      { who: 'Le vieux mage', text: BOURSE.aBourse()
        ? "« Et si tu as des écus qui traînent : mes fioles sont sur l'établi. L'onguent remet trois cœurs, le sirop de chicorée fait courir sans souffler. »"
        : "« Tu n'as même pas de bourse. Va donc voir dans le coffre de ta mezzanine, petite. »" },
    ], fin);
    return;
  }
  if (!state.mageParle) {
    dialogue([
      { text: 'Le vieil homme ne lève même pas les yeux de son chaudron.' },
      { who: 'Le vieux mage', text: "« Trois cents ans que personne ne pousse cette porte, et voilà une gamine avec une épée. Assieds-toi, tu me fais de l'ombre. »" },
      { who: 'Le vieux mage', text: "« J'ai vu passer l'ingénieur du roi, celui qu'on appelle Vauban. Il a planté son pentagone dans nos marais et il a dit : voilà, c'est fait. Il n'a jamais su ce qu'il y avait dessous. »" },
      { who: 'Le vieux mage', text: "« Sous les bastions, il y a des galeries plus vieilles que la citadelle. Plus vieilles que Lille. Lydéric et Phinaert s'y sont battus, il y a mille ans, et ils ne se sont jamais vraiment arrêtés. »" },
      { who: 'Le vieux mage', text: "« Lydéric a gagné. Phinaert a pourri sous la terre en ruminant. Un géant qui rumine mille ans, ça ne devient pas plus intelligent — ça devient patient. »", fn: () => { state.mageParle = true; saveGame(true); } },
      { who: 'Le vieux mage', text: "« Tu veux mon conseil ? Ne le combats pas là où il t'attend. Et ne descends jamais dans les galeries sans lumière. »" },
      { who: 'Le vieux mage', text: "« Sur l'établi, là, mes fioles. Onguent pour les côtes cassées, sirop de chicorée pour les jambes. Ça se paie — je suis vieux, pas généreux. »" },
      { who: 'Le vieux mage', text: "« Tiens. Ceci traînait sur mon socle depuis que l'ingénieur du roi l'y a oublié. Prends-le : mon cœur à moi bat encore très bien, merci. »", fn: donnerCoeur },
    ], fin);
    return;
  }
  dialogue([
    { who: 'Le vieux mage', text: "« Tu es revenue. Bien. Le socle, derrière toi : sers-toi. Je n'en ai plus l'usage. »", fn: donnerCoeur },
  ], fin);
}
// ---------------------------------------------------------------------
//  Les fioles : la seule boutique du jeu pour l'instant
// ---------------------------------------------------------------------
// On ne vend que ce qui se boit vraiment aujourd'hui. Le lait ribot (dégâts doublés) et
// l'eau de la Deûle (souffle long) attendent engine.js : vendre une fiole inutilisable
// serait pire que ne pas la vendre.
function ouvrirBoutique() {
  if (!BOURSE.aBourse()) {
    dialogue([
      { who: 'Le vieux mage', text: "« Tu regardes mes fioles avec des yeux de merlan frit, mais je ne vois pas de bourse à ta ceinture. »" },
      { who: 'Le vieux mage', text: "« Reviens quand tu auras de quoi payer. La tienne doit dormir chez toi, dans le coffre de ta mezzanine — c'est là que les gardiennes rangent leurs sous depuis toujours. »" },
    ]);
    return;
  }
  const O = BOURSE.POTIONS.onguent, C = BOURSE.POTIONS.chicoree;
  BOURSE.boutique(
    'LES FIOLES DU MAGE', "L'établi d'alchimie",
    'Le vieil homme pousse trois fioles vers toi sans lever les yeux de son chaudron.',
    [
      { label: `Un bol d'${O.nom.toLowerCase()}, bu sur place (${O.effet})`, prix: O.prix,
        dispo: () => player.hp < player.maxHp, indispo: 'tu n\u2019as pas une égratignure',
        acheter: () => O.boire() },
      { label: 'Gourde de cuir (pour emporter une fiole)', prix: 80,
        dispo: () => BOURSE.gourdes() < 1, indispo: 'il n\u2019en a qu\u2019une',
        acheter: () => { BOURSE.ajouterGourde(); showMessage('Une gourde de cuir à la ceinture. Remplis-la, et bois avec B.', 5); } },
      { label: `Remplir une gourde — ${O.nom} (${O.effet})`, prix: O.prix,
        dispo: () => BOURSE.gourdesLibres() > 0, indispo: 'aucune gourde vide',
        acheter: () => { BOURSE.remplir('onguent'); showMessage('Gourde remplie d\u2019onguent. B pour boire.', 4); } },
      { label: `Remplir une gourde — ${C.nom} (${C.effet})`, prix: C.prix,
        dispo: () => BOURSE.gourdesLibres() > 0, indispo: 'aucune gourde vide',
        acheter: () => { BOURSE.remplir('chicoree'); showMessage('Gourde remplie de sirop. B pour boire.', 4); } },
    ],
    () => showMessage('« Referme la porte en sortant, il y a un courant d\u2019air. »', 3),
  );
}

function donnerCoeur() {
  if (state.mageHeart) return;
  state.mageHeart = true;
  player.maxHp += 2; player.hp = player.maxHp;
  SFX.win(); burst(player.pos.x, player.pos.y + 1.5, player.pos.z, 0xff5070, 26, 3, 1.3, 2, 1.2);
  if (coeur) { scene.remove(coeur); coeur = null; }
  showMessage('Réceptacle de cœur : un cœur de plus, et tous les cœurs sont remplis.', 4);
  saveGame(true);
}

function populate() { player.pos.set(DOOR_X, 0, D / 2 - 1.6); player.yaw = Math.PI; G.camYaw = Math.PI; }
function animate(now, dt) {
  if (feu) { feu.userData.flame.scale.y = 2.0 + Math.sin(now / 55) * 0.5; feu.userData.light.intensity = 7 * (0.85 + Math.sin(now / 40) * 0.15); }
  if (cristal) { cristal.rotation.y += dt * 0.6; cristal.rotation.x = Math.sin(now / 1400) * 0.3; cristal.position.y = 1.15 + Math.sin(now / 900) * 0.12; }
  if (corbeau) corbeau.rotation.y = -2.2 + Math.sin(now / 1700) * 0.35;
  if (coeur) { coeur.rotation.y += dt * 1.1; coeur.position.y = 1.1 + Math.sin(now / 700) * 0.06; }
  // le mage riggé parle et respire par ses clips ; l'ancien, par ses bras en primitives
  if (mage && mage.userData.perso) { PNJ.animeVillageois(mage, dt, false); if (mage.userData.talk > 0) mage.userData.talk -= dt; }
  else if (mage) { const u = mage.userData; u.anim += dt;
    u.tete.rotation.y = u.talk > 0 ? Math.sin(u.anim * 5) * 0.22 : Math.sin(u.anim * 0.4) * 0.28;
    u.bras[1].rotation.x = (u.talk > 0 ? -0.7 + Math.sin(u.anim * 7) * 0.35 : -0.15 + Math.sin(u.anim * 0.6) * 0.08);
    if (u.talk > 0) u.talk -= dt; }
}
function minimap(g, W2) {
  const sc = 11, P = (x, z) => [W2 / 2 + x * sc, W2 / 2 + z * sc];
  g.fillStyle = '#6a5a42'; const [x0, z0] = P(-W / 2, -D / 2); g.fillRect(x0, z0, W * sc, D * sc);
  g.fillStyle = '#8a7a58'; const [b0, b1] = P(-0.3, -D / 2); g.fillRect(b0, b1, 4.0 * sc, 0.9 * sc);      // établi
  g.fillStyle = '#7ad04a'; const [c0, c1] = P(2.6, 2.1); g.beginPath(); g.arc(c0, c1, 1.3 * sc, 0, TAU); g.fill();
  minimapDots(g, P);
}
const level = {
  name: 'mage', getH: () => 0, zoneName: () => 'Chaumière du vieux mage', build, populate, animate, minimap,
  counts: () => `<small>La chaumière du vieux mage — Entrée devant lui pour l'écouter, Entrée devant l'établi pour ses fioles, Entrée devant la porte pour ressortir.</small>`
    + BOURSE.ligneHUD(),
  start: () => showMessage('Ça sent la fumée verte et le vieux papier. Un homme très vieux remue son chaudron.', 5),
  arriveMessage: () => 'La chaumière du vieux mage.',
  entry: () => ({ title: 'La chaumière du vieux mage', sub: 'Au fond du bois', cam: [3.4, 2.6, 4.0], at: [-1.6, 1.3, 0], cam2: [2.2, 2.1, 2.6], at2: [-2.2, 1.4, -0.6], dur: 4 }),
  onKill: () => {},
};
await PNJ.installerCamille(PNJ_E);
LOOK.veiller();
bootLevel(level, null);
