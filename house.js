import * as PNJ_E from './engine.js?v=27';
import * as PNJ from './pnj.js';
// The Legend of Camille — niveau 3 : l'intérieur de la maison de Camille
import { THREE, rand, TAU, scene, G, T, mat, pbr, pbrRepeat, stoneMat, IRON, GOLD, hemi, sun, renderer, bloom,
  mesh, boxG, sphG, capG, world, addCap, addBox, addPlatform, addRamp, makeChest, makeTorch, SFX, state, player, enemies,
  addInteract, showMessage, showMenu, hideMenu, saveGame, resumeGame, goToLevel, fadeTo, bootLevel, minimapDots, makeSky, cutscene,
  burst, lerp } from './engine.js?v=27';
import * as BOURSE from './bourse.js';
import * as LOOK from './look.js';

const W = 12, D = 9, H = 5.2;              // pièce (unités de construction) ; tout est agrandi par SC pour être à l'échelle de Camille
const SC = 1.3;
const room = new THREE.Group(); room.scale.setScalar(SC);
// top / bas en unités de construction comme le reste : un meuble posé SOUS la mezzanine
// doit s'arrêter sous son plancher, un meuble posé DESSUS doit commencer au-dessus — sans
// cela, le tonneau et l'armoire d'en bas bloquaient la mezzanine, et le bureau d'en haut
// bloquait le rez-de-chaussée.
const cap = (ax, az, bx, bz, r, top = Infinity, bas = null) => {
  const c = addCap(ax * SC, az * SC, bx * SC, bz * SC, r * SC, top * SC);
  if (bas !== null) c.bottom = bas * SC;
  return c;
};
const plat = (x0, x1, z0, z1, h) => addPlatform(x0 * SC, x1 * SC, z0 * SC, z1 * SC, h * SC);
const ramp = (x, z, dx, dz, len, w, h0, h1) => addRamp(x * SC, z * SC, dx, dz, len * SC, w * SC, h0 * SC, h1 * SC);
const V = (x, y, z) => new THREE.Vector3(x * SC, y * SC, z * SC);
// sortie = HOUSE + 6,6 m a l'est de son centre (la porte est a l'est). HOUSE suit ECH,
// donc cette constante est a REPORTER a chaque changement d'echelle du plan.
const EXIT = { level: 'citadel', pos: [-74.4, 0, 398.4], yaw: Math.PI / 2 };
let fire, lamps = [], cat, coffre, armoire;

function build() {
  makeSky(0x4a78b8, 0x9fc4e8, 0xe8e2d8, true);
  scene.fog = null;
  hemi.intensity = 0.45; hemi.color.setHex(0xfff0dc); hemi.groundColor.setHex(0x6a5030);
  sun.intensity = 1.4; sun.position.set(6, 9, 8); sun.castShadow = true; Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.12;
  G.camBack = 4.8; G.camUp = 2.5; G.camMaxY = H * SC - 0.5;
  scene.add(room);
  const plank = pbrRepeat(T.plank, 5, 4), plaster = pbrRepeat(T.stone, 3, 1.5, { color: 0xeadfcc, roughness: 0.95 }), wood = mat(0x4a3320, { roughness: 0.8 }), oak = pbrRepeat(T.plank, 1, 1);
  // sol, plafond à poutres, murs
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, D), plank); floor.position.y = -0.1; floor.receiveShadow = true; room.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, D), pbrRepeat(T.plank, 5, 4, { color: 0xb08a5a })); ceil.position.y = H + 0.1; room.add(ceil);
  for (let k = -2; k <= 2; k++) room.add(mesh(boxG(W, 0.35, 0.35), wood, 0, H - 0.17, k * 2.1));
  const walls = [[-W / 2, -D / 2, W / 2, -D / 2, 0], [-W / 2, D / 2, -0.9, D / 2, 0], [0.9, D / 2, W / 2, D / 2, 0], [-W / 2, -D / 2, -W / 2, D / 2, 1], [W / 2, -D / 2, W / 2, D / 2, 1]];
  for (const [ax, az, bx, bz] of walls) {
    const len = Math.hypot(bx - ax, bz - az), m = new THREE.Mesh(new THREE.BoxGeometry(len, H, 0.4), plaster); m.position.set((ax + bx) / 2, H / 2, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax); m.receiveShadow = true; room.add(m);
    cap(ax, az, bx, bz, 0.25);
  }
  for (const [ax, az, bx, bz] of walls) { const n = Math.round(Math.hypot(bx - ax, bz - az) / 2.5); for (let k = 0; k <= n; k++) { const t = k / n; room.add(mesh(boxG(0.16, H, 0.46), wood, ax + (bx - ax) * t, H / 2, az + (bz - az) * t)); } }
  // porte d'entrée (sud), ouverte vers l'extérieur
  room.add(mesh(boxG(2.2, 0.3, 0.5), wood, 0, 2.7, D / 2)); for (const sx of [-1, 1]) room.add(mesh(boxG(0.2, 2.6, 0.5), wood, sx * 1.0, 1.3, D / 2));
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.12), oak); door.position.set(0.6, 1.25, D / 2 + 0.55); door.rotation.y = -0.9; room.add(door);
  const outside = mesh(boxG(2.0, 2.7, 0.1), new THREE.MeshBasicMaterial({ color: 0xbfe0ff }), 0, 1.35, D / 2 + 0.5); room.add(outside);
  // Le seuil est fermé pour les collisions : on ne sort pas à pied (c'est l'interaction qui
  // fait sortir), et par ce trou la caméra reculait DEHORS — à l'arrivée, on voyait le mur
  // extérieur et la porte au lieu de Camille.
  cap(-0.9, D / 2, 0.9, D / 2, 0.25);
  // la portée ne touche plus le point d'arrivée : Camille entrait, appuyait sur Entrée pour
  // passer la scène d'arrivée… et ressortait aussitôt
  addInteract({ pos: V(0, 0, D / 2 - 0.4), r: 1.0 * SC, prompt: () => 'sortir de la maison', fn: () => goToLevel(EXIT.level, EXIT.pos, EXIT.yaw, 'Camille sort dans le bois…') });
  // fenêtres lumineuses (nord et ouest) avec croisillons et rideaux
  const winMat = mat(0xfff4d8, { roughness: 0.15, emissive: 0xffe0a0, emissiveIntensity: 0.7 });
  for (const [x, z, rot] of [[-3, -D / 2, 0], [3, -D / 2, 0], [-W / 2, -1.2, Math.PI / 2]]) {
    const g = new THREE.Group(); g.position.set(x, 2.2, z); g.rotation.y = rot;
    g.add(mesh(boxG(1.6, 1.6, 0.2), winMat, 0, 0, 0)); g.add(mesh(boxG(1.7, 0.08, 0.3), wood, 0, 0, 0)); g.add(mesh(boxG(0.08, 1.7, 0.3), wood, 0, 0, 0)); g.add(mesh(boxG(1.9, 0.12, 0.5), wood, 0, -0.9, 0));
    for (const sx of [-1, 1]) { const cur = mesh(boxG(0.5, 2.0, 0.12), mat(0x8a3a4a, { roughness: 1 }), sx * 1.15, 0.05, 0.3); g.add(cur); }
    room.add(g);
    const l = new THREE.PointLight(0xffe8c0, 4, 9, 1.6); l.position.set(x + (rot ? (x < 0 ? 0.8 : -0.8) : 0), 2.4, z + (rot ? 0 : 0.8)); room.add(l);
  }
  // lit (nord-ouest) + table de nuit + chat
  const bed = new THREE.Group(); bed.position.set(-4.2, 0, -2.6);
  bed.add(mesh(boxG(2.3, 0.5, 3.4), oak, 0, 0.25, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bed.add(mesh(boxG(0.2, 0.9, 0.2), wood, sx * 1.05, 0.45, sz * 1.6));
  bed.add(mesh(boxG(2.1, 0.35, 3.2), mat(0xeee6d8, { roughness: 1 }), 0, 0.65, 0));
  bed.add(mesh(boxG(2.1, 0.28, 2.1), mat(0x8a3a4a, { roughness: 1 }), 0, 0.86, 0.5));
  bed.add(mesh(boxG(2.1, 0.06, 0.4), mat(0xc8a060, { roughness: 1 }), 0, 1.0, 0.1));
  bed.add(mesh(boxG(1.6, 0.3, 0.7), mat(0xffffff, { roughness: 1 }), 0, 0.92, -1.2));
  bed.add(mesh(boxG(2.4, 1.5, 0.15), oak, 0, 1.0, -1.72)); bed.add(mesh(boxG(2.4, 0.25, 0.2), wood, 0, 1.75, -1.72));
  room.add(bed); cap(bed.position.x - 1, bed.position.z - 1.3, bed.position.x + 1, bed.position.z + 1.3, 0.75);
  const night = mesh(boxG(0.7, 0.8, 0.7), oak, -2.6, 0.4, -3.9); room.add(night); room.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 8), mat(0xe8e0c0), -2.6, 0.97, -3.9)); room.add(mesh(sphG(0.07, 6), new THREE.MeshBasicMaterial({ color: 0xffc060 }), -2.6, 1.22, -3.9));
  const candle = new THREE.PointLight(0xffb060, 2, 5); candle.position.set(-2.6, 1.4, -3.9); room.add(candle); lamps.push(candle);
  cat = new THREE.Group(); cat.position.set(-3.6, 1.05, -2.0); cat.userData.dynamic = true;
  const fur = mat(0x8a7a6a, { roughness: 1 }); const catBody = mesh(capG(0.24, 0.35, 10), fur, 0, 0, 0); catBody.rotation.x = Math.PI / 2; cat.add(catBody);
  cat.add(mesh(sphG(0.2, 10), fur, 0, 0.12, 0.42)); for (const sx of [-1, 1]) cat.add(mesh(new THREE.ConeGeometry(0.07, 0.16, 4), fur, sx * 0.1, 0.32, 0.4)); for (const sx of [-1, 1]) cat.add(mesh(sphG(0.03, 6), mat(0x40ff80, { emissive: 0x20a050, emissiveIntensity: 0.8 }), sx * 0.07, 0.15, 0.6));
  const tail = mesh(capG(0.04, 0.6, 6), fur, 0.2, 0.1, -0.4); tail.rotation.z = -0.8; tail.rotation.x = 0.5; cat.add(tail); cat.userData.tail = tail; room.add(cat);
  addInteract({ pos: V(bed.position.x + 1.3, 0, bed.position.z), r: 1.8 * SC, prompt: () => 'se coucher', fn: bedMenu });
  // ---------- l'armoire, au pied du lit : la tenue et l'allure ----------
  // Une glace sur la porte de gauche : c'est devant elle que Camille se change. Le
  // réglage lui-même est dans look.js, et se voit sur elle en direct.
  armoire = new THREE.Group(); armoire.position.set(-3.4, 0, -0.5); room.add(armoire);
  armoire.add(mesh(boxG(1.7, 2.5, 0.78), oak, 0, 1.25, 0));
  armoire.add(mesh(boxG(1.86, 0.14, 0.92), wood, 0, 2.55, 0));            // corniche
  armoire.add(mesh(boxG(1.84, 0.12, 0.9), wood, 0, 0.06, 0));             // socle
  for (const sx of [-1, 1]) {
    const porte = mesh(boxG(0.8, 2.16, 0.07), pbrRepeat(T.plank, 1, 2), sx * 0.42, 1.3, 0.4);
    armoire.add(porte);
    armoire.add(mesh(boxG(0.86, 0.09, 0.09), wood, sx * 0.42, 2.3, 0.44));
    armoire.add(mesh(sphG(0.07, 8), GOLD(), sx * 0.07, 1.3, 0.47));       // poignées
    for (const sy of [0.45, 2.1]) armoire.add(mesh(boxG(0.1, 0.1, 0.1), IRON(), sx * 0.8, sy, 0.42));  // gonds
  }
  // la glace
  armoire.add(mesh(boxG(0.58, 1.5, 0.02), mat(0xdfe8f0, { roughness: 0.06, metalness: 0.95 }), -0.42, 1.5, 0.445));
  armoire.add(mesh(boxG(0.66, 1.58, 0.015), mat(0x6a4a2a, { roughness: 0.7 }), -0.42, 1.5, 0.438));
  cap(-4.15, -0.5, -2.65, -0.5, 0.5);
  addInteract({ pos: V(-3.4, 0, 0.9), r: 1.7 * SC, prompt: () => 'ouvrir l\u2019armoire', fn: LOOK.ouvrirArmoire });
  // cheminée (mur ouest) avec feu, bûches, marmite
  const hx = -W / 2 + 0.45, hz = 1.2;
  room.add(mesh(boxG(0.9, 2.8, 2.4), pbrRepeat(T.stone, 1, 1), hx, 1.4, hz)); room.add(mesh(boxG(0.6, H - 2.8, 1.4), pbrRepeat(T.brick, 1, 2), hx, 2.8 + (H - 2.8) / 2, hz));
  room.add(mesh(boxG(0.5, 1.6, 1.5), new THREE.MeshBasicMaterial({ color: 0x150a05 }), hx + 0.3, 0.9, hz)); room.add(mesh(boxG(1.4, 0.12, 2.8), stoneMat, hx + 0.6, 0.06, hz));
  room.add(mesh(boxG(1.2, 0.2, 2.6), oak, hx + 0.1, 2.9, hz));
  for (const [ox, oy, rz] of [[0.35, 0.25, 0.3], [0.5, 0.42, -0.4], [0.2, 0.5, 1.2]]) { const log = mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.0, 7), pbrRepeat(T.bark, 1, 1), hx + ox, oy, hz); log.rotation.z = Math.PI / 2 + rz * 0.2; log.rotation.y = rz; room.add(log); }
  fire = makeTorch(); fire.position.set(hx + 0.4, 0.2, hz); fire.children[0].visible = false; fire.children[1].visible = false; fire.userData.light.intensity = 8; fire.userData.light.distance = 12; fire.userData.light.color.setHex(0xff8a30); fire.userData.flame.scale.set(2.2, 2.4, 2.2); room.add(fire);
  room.add(mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.5, 10), IRON(), hx + 0.45, 1.1, hz)); room.add(mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 12, Math.PI), IRON(), hx + 0.45, 1.4, hz).rotateZ(0));
  cap(hx + 0.4, hz - 1.2, hx + 0.4, hz + 1.2, 0.7);
  // table, chaises, vaisselle, pain, chandelier
  // LA TABLE NE BARRE PLUS LA PIÈCE. 2,6 m de long avec une chaise devant et une derrière,
  // au milieu du passage entre la porte, le lit et l'escalier : on ne passait qu'au ras des
  // murs. Plus courte, les chaises à ses deux bouts (dans l'axe, donc hors du passage), et
  // rangée contre le coin cuisine ; les collisions serrent le plateau au lieu de l'arrondir
  // d'un large cylindre.
  const tx = 2.2, tz = 1.0;
  room.add(mesh(boxG(1.9, 0.12, 1.0), oak, tx, 0.95, tz)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) room.add(mesh(boxG(0.12, 0.9, 0.12), wood, tx + sx * 0.82, 0.45, tz + sz * 0.38));
  cap(tx - 0.6, tz, tx + 0.6, tz, 0.5);
  for (const sx of [-1, 1]) { const ch = new THREE.Group(); ch.position.set(tx + sx * 1.3, 0, tz); ch.rotation.y = sx * Math.PI / 2; ch.add(mesh(boxG(0.55, 0.08, 0.55), oak, 0, 0.5, 0)); for (const a of [-1, 1]) for (const b of [-1, 1]) ch.add(mesh(boxG(0.07, 0.5, 0.07), wood, a * 0.23, 0.25, b * 0.23)); ch.add(mesh(boxG(0.55, 0.7, 0.07), oak, 0, 0.9, 0.25)); room.add(ch); cap(ch.position.x, ch.position.z, ch.position.x, ch.position.z, 0.3); }
  room.add(mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.05, 12), mat(0xe8e0d0, { roughness: 0.4 }), tx - 0.6, 1.04, tz - 0.2)); room.add(mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.05, 12), mat(0xe8e0d0, { roughness: 0.4 }), tx + 0.6, 1.04, tz + 0.2));
  room.add(mesh(capG(0.14, 0.4, 8), mat(0xc8903a, { roughness: 1 }), tx, 1.12, tz - 0.3).rotateZ(Math.PI / 2)); room.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8), mat(0xd0d8e0, { metalness: 0.8, roughness: 0.3 }), tx + 0.9, 1.15, tz + 0.4));
  room.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 6), mat(0xf0e8d0), tx, 1.16, tz + 0.25)); room.add(mesh(sphG(0.05, 6), new THREE.MeshBasicMaterial({ color: 0xffc060 }), tx, 1.36, tz + 0.25));
  const tl = new THREE.PointLight(0xffb060, 1.5, 5); tl.position.set(tx, 1.6, tz + 0.25); room.add(tl); lamps.push(tl);
  // cuisine : étagères, pots, herbes suspendues, tonneau, panier
  for (let k = 0; k < 2; k++) room.add(mesh(boxG(2.6, 0.08, 0.5), oak, 3.6, 1.7 + k * 0.9, D / 2 - 0.45));
  for (let k = 0; k < 8; k++) { const y = 1.74 + Math.floor(k / 4) * 0.9, x = 2.6 + (k % 4) * 0.65; room.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, rand(0.28, 0.45), 10), mat([0x8a5a3a, 0x4a6a8a, 0xc8a060, 0x6a8a5a][k % 4], { roughness: 0.6 }), x, y + 0.2, D / 2 - 0.45)); }
  for (let k = 0; k < 5; k++) { const herb = mesh(new THREE.ConeGeometry(0.16, 0.6, 6), mat(0x5a7a3a, { roughness: 1 }), 1.2 + k * 0.5, H - 0.75, -D / 2 + 0.5); herb.rotation.x = Math.PI; room.add(herb); room.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), mat(0xd0c0a0), 1.2 + k * 0.5, H - 0.25, -D / 2 + 0.5)); }
  room.add(mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.1, 12), pbrRepeat(T.plank, 2, 1), 5.2, 0.55, -3.2)); cap(5.2, -3.2, 5.2, -3.2, 0.5, 2.7 - 0.4);   // sous la mezzanine
  room.add(mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.35, 10, 1, true), mat(0xb08a50, { roughness: 1, side: THREE.DoubleSide }), 5.2, 1.28, -3.2));
  for (let k = 0; k < 4; k++) room.add(mesh(sphG(0.12, 8), mat(0xd04030), 5.2 + (k % 2) * 0.15 - 0.07, 1.32, -3.2 + Math.floor(k / 2) * 0.15 - 0.07));
  // coffre, tapis, armoire, carte de Lille au mur
  const trunk = makeChest(); trunk.position.set(-4.8, 0, 3.4); trunk.rotation.y = Math.PI / 2; room.add(trunk); cap(-4.8, 3.4, -4.8, 3.4, 0.9);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), mat(0x9a3a3a, { roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.5, 0.01, -0.5); rug.receiveShadow = true; room.add(rug);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.35, 24), mat(0xd8b060, { roughness: 1 })); ring.rotation.x = -Math.PI / 2; ring.position.set(0.5, 0.015, -0.5); room.add(ring);
  const wardrobe = mesh(boxG(1.6, 2.4, 0.8), oak, 4.6, 1.2, -D / 2 + 0.6); room.add(wardrobe); cap(3.8, -D / 2 + 0.6, 5.4, -D / 2 + 0.6, 0.5, 2.7 - 0.2);   // sous la mezzanine
  for (const sx of [-1, 1]) room.add(mesh(sphG(0.05, 6), GOLD(), 4.6 + sx * 0.2, 1.3, -D / 2 + 1.02));
  const map = mesh(boxG(1.8, 1.3, 0.05), mat(0xe8dcb8, { roughness: 1 }), W / 2 - 0.3, 2.6, 1.8); map.rotation.y = -Math.PI / 2; room.add(map);
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * TAU / 5; const pt = mesh(boxG(0.05, 0.05, 0.05), mat(0x8a3a2a), W / 2 - 0.34, 2.6 + Math.sin(a) * 0.4, 1.8 + Math.cos(a) * 0.5); room.add(pt); }
  // mezzanine (nord-est) avec escalier de bois le long du mur est, bureau et bibliothèque
  const MZ = 2.7, mz0 = -D / 2, mz1 = -1.6, mx0 = -0.5, mx1 = W / 2;
  room.add(mesh(boxG(mx1 - mx0, 0.25, mz1 - mz0), plank, (mx0 + mx1) / 2, MZ - 0.12, (mz0 + mz1) / 2)); plat(mx0, mx1, mz0, mz1, MZ);
  for (const x of [mx0 + 0.3, mx1 - 3.5]) room.add(mesh(boxG(0.25, MZ - 0.25, 0.25), wood, x, (MZ - 0.25) / 2, mz1 - 0.3));
  const rail = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.5); for (let k = 0; k <= n; k++) { const t = k / n; room.add(mesh(boxG(0.06, 0.9, 0.06), wood, ax + (bx - ax) * t, MZ + 0.45, az + (bz - az) * t)); } const top = mesh(boxG(len, 0.08, 0.1), wood, (ax + bx) / 2, MZ + 0.92, (az + bz) / 2); top.rotation.y = -Math.atan2(bz - az, bx - ax); room.add(top); const c = cap(ax, az, bx, bz, 0.12); c.bottom = MZ - 0.5; };
  // L'ESCALIER ÉTAIT UN COULOIR DE TRENTE CENTIMÈTRES : 1,2 m de marches entre le
  // garde-corps et le mur, moins l'épaisseur des collisions de chacun et le rayon de Camille.
  // Il fait maintenant 1,6 m, et l'ouverture de la mezzanine suit.
  const SW = 1.6, sx0 = W / 2 - 0.2 - SW / 2, sz0 = 3.0, len = sz0 - mz1, xr = sx0 - SW / 2 - 0.05;
  rail(mx0, mz1, xr - 0.1, mz1); rail(mx0, mz0 + 0.3, mx0, mz1);
  ramp(sx0, sz0, 0, -1, len, SW, 0, MZ);
  for (let k = 0; k < 12; k++) { const t = (k + 0.5) / 12; room.add(mesh(boxG(SW, 0.18, len / 12), oak, sx0, t * MZ - 0.09, sz0 - t * len)); room.add(mesh(boxG(SW, t * MZ, 0.05), oak, sx0, t * MZ / 2, sz0 - t * len + len / 24)); }
  const rc = cap(xr, sz0, xr, mz1, 0.06); rc.bottom = -1; // garde-corps de l'escalier
  for (let k = 0; k <= 6; k++) { const t = k / 6; room.add(mesh(boxG(0.06, 0.9, 0.06), wood, xr, t * MZ + 0.45, sz0 - t * len)); }
  const hr = mesh(boxG(0.06, 0.08, Math.hypot(len, MZ)), wood, xr, MZ / 2 + 0.92, (sz0 + mz1) / 2); hr.rotation.x = Math.atan2(MZ, len); room.add(hr);
  // bureau + carte + bibliothèque sur la mezzanine
  // (décalé vers l'est et raccourci : le coffre de la bourse a pris le coin ouest)
  const bxD = 2.5;
  room.add(mesh(boxG(1.5, 0.1, 0.9), oak, bxD, MZ + 0.8, -D / 2 + 0.75)); for (const sx of [-1, 1]) room.add(mesh(boxG(0.1, 0.8, 0.8), oak, bxD + sx * 0.65, MZ + 0.4, -D / 2 + 0.75));
  room.add(mesh(boxG(0.7, 0.02, 0.5), mat(0xf0e8d0, { roughness: 1 }), bxD, MZ + 0.86, -D / 2 + 0.75)); room.add(mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.35, 5), mat(0x202020), bxD + 0.4, MZ + 1.0, -D / 2 + 0.6).rotateX(0.6));
  cap(bxD - 0.55, -D / 2 + 0.75, bxD + 0.55, -D / 2 + 0.75, 0.5, Infinity, MZ - 0.5);   // sur la mezzanine seulement
  const shelf = mesh(boxG(2.4, 2.2, 0.5), oak, 4.6, MZ + 1.1, -D / 2 + 0.45); room.add(shelf); cap(3.5, -D / 2 + 0.45, 5.7, -D / 2 + 0.45, 0.4, Infinity, MZ - 0.5);
  // ---------- le coffre de la mezzanine : la bourse de gardienne ----------
  // C'est lui qui ouvre l'économie du jeu. Tant qu'il n'est pas ouvert, aucun écu n'est
  // compté nulle part (cf. bourse.js) : le premier gain manqué renvoie le joueur ici.
  // Il était collé au garde-corps, face au vide : il ne restait pas la place de se tenir
  // devant, et son interaction tombait hors de la mezzanine. Il est au fond, côté ouest,
  // le couvercle vers la pièce.
  coffre = makeChest(); coffre.position.set(0.5, MZ, -3.75); room.add(coffre);
  cap(0.0, -3.75, 1.0, -3.75, 0.5, Infinity, MZ - 0.5);
  addInteract({
    pos: V(0.5, MZ, -2.6), r: 1.5 * SC,
    prompt: () => (state.bourseChest ? 'le coffre est ouvert' : 'ouvrir le coffre'),
    fn: ouvrirCoffre,
  });
  for (let row = 0; row < 3; row++) for (let k = 0; k < 9; k++) { const bk = mesh(boxG(0.18, rand(0.35, 0.55), 0.35), mat([0x8a3a2a, 0x2a4a7a, 0x6a7a3a, 0xc8a060, 0x4a2a5a][(k + row) % 5], { roughness: 0.9 }), 3.55 + k * 0.24, MZ + 0.35 + row * 0.7, -D / 2 + 0.55); room.add(bk); }
  // lampe pendue
  const lamp = new THREE.PointLight(0xffdca0, 5, 14, 1.6); lamp.position.set(0.5, H - 0.9, 0.5); room.add(lamp); lamps.push(lamp);
  room.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), IRON(), 0.5, H - 0.6, 0.5)); room.add(mesh(new THREE.ConeGeometry(0.45, 0.4, 12, 1, true), mat(0x3a2a1a, { side: THREE.DoubleSide }), 0.5, H - 1.1, 0.5)); room.add(mesh(sphG(0.12, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), 0.5, H - 1.15, 0.5));
}
function ouvrirCoffre() {
  if (state.bourseChest) {
    showMessage(BOURSE.aBourse()
      ? `Le coffre est vide : tu as déjà ta bourse (${BOURSE.solde()} écus).`
      : 'Le coffre est vide.', 3);
    return;
  }
  state.bourseChest = true;
  BOURSE.donnerBourse();
  SFX.win();
  burst(player.pos.x, player.pos.y + 1.3, player.pos.z, 0xffd070, 26, 3, 1.2, 2, 1.2);
  showMessage(`Dans le coffre de la mezzanine : ta bourse de gardienne, et les ${BOURSE.DEPART} écus `
    + 'que tu avais mis de côté. Désormais, ce que tu abats et ce que tu fauches rapporte.', 7);
  saveGame(true);
}
function bedMenu() {
  state.paused = true;
  showMenu('LE LIT DE CAMILLE', 'La maison est calme', 'Le feu crépite, le chat ronronne, et la citadelle attend dehors.', [
    { label: 'Dormir (récupérer tous les cœurs et sauvegarder)', fn: () => { hideMenu(); state.paused = false; sleepScene(); } },
    { label: 'Sauvegarder', fn: () => { saveGame(); resumeGame(); } },
    { label: 'Sauvegarder et quitter', fn: () => { saveGame(true); sessionStorage.removeItem('tloc_auto'); location.href = 'index.html'; } },
    { label: 'Se relever', fn: resumeGame },
  ]);
}
// cinématique du coucher : Camille s'allonge vraiment dans le lit, la nuit tombe, elle se réveille
function sleepScene() {
  const bx = -4.2 * SC, bz = -2.6 * SC, top = 0.83 * SC; // lit en coordonnées monde
  cutscene([
    { cam: [bx + 4.5, 2.8 * SC, bz + 3.5], at: [bx, 1.0, bz], dur: 2.2, walk: [bx + 1.6, bz + 0.3], speed: 3, text: 'Camille souffle la lampe…' },
    { cam: [bx + 4.5, 2.8 * SC, bz + 3.5], at: [bx, 1.0, bz], cam2: [bx + 3.2, 2.6 * SC, bz + 2.8], at2: [bx, 0.9, bz - 0.4], dur: 4, pose: 'lie', pos: [bx, top, bz + 1.3], yaw: 0, text: '…et s\'allonge dans le lit. Le feu crépite, le chat ronronne.', fn: () => { lamps.forEach(l => { l.userData.base = l.intensity; }); } },
    { cam: [bx + 3.2, 2.6 * SC, bz + 2.8], at: [bx, 0.9, bz - 0.4], dur: 2.5, fade: 1, fn: () => { let k = 0; const iv = setInterval(() => { lamps.forEach(l => l.intensity *= 0.7); if (++k > 8) clearInterval(iv); }, 200); } },
    { cam: [bx + 3.2, 2.6 * SC, bz + 2.8], at: [bx, 0.9, bz - 0.4], dur: 2.2, text: 'Camille dort profondément. La nuit passe sur la citadelle…', fn: () => { SFX.chirp(); } },
    { cam: [bx + 3.5, 2.6 * SC, bz + 3], at: [bx, 0.9, bz], cam2: [bx + 4.5, 2.8 * SC, bz + 3.5], at2: [bx, 1.0, bz], dur: 3, fade: 0, text: 'Le matin. Camille se réveille en pleine forme.', fn: () => { player.hp = player.maxHp; lamps.forEach(l => { l.intensity = l.userData.base || l.intensity; }); saveGame(true); SFX.win(); } },
    { pose: null, dur: 0.6, cam: [bx + 4.5, 2.8 * SC, bz + 3.5], at: [bx, 1.0, bz], fn: () => { player.pos.set(bx + 1.6, 0, bz + 0.3); player.yaw = Math.PI / 2; } },
  ], () => { showMessage('Tous les cœurs sont récupérés. Partie sauvegardée.', 3.5); });
}
function populate() { player.pos.set(0, 0, 2.9 * SC); player.yaw = Math.PI; G.camYaw = Math.PI; }
function animate(now, dt) {
  if (coffre) coffre.userData.lid.rotation.x = lerp(coffre.userData.lid.rotation.x, state.bourseChest ? -1.9 : 0, 1 - Math.exp(-6 * dt));
  if (fire) { fire.userData.flame.scale.y = 2.2 + Math.sin(now / 55) * 0.5; fire.userData.light.intensity = 8 * (0.85 + Math.sin(now / 40) * 0.15); }
  if (cat) cat.userData.tail.rotation.z = -0.8 + Math.sin(now / 600) * 0.4;
}
function minimap(g, W2) {
  const sc = 9 / SC, P = (x, z) => [W2 / 2 + x * sc, W2 / 2 + z * sc];
  g.fillStyle = '#7a5a3a'; const [x0, z0] = P(-W / 2 * SC, -D / 2 * SC); g.fillRect(x0, z0, W * SC * sc, D * SC * sc);
  g.fillStyle = '#a08060'; const [mx, mz] = P(-0.5 * SC, -D / 2 * SC); g.fillRect(mx, mz, 6.5 * SC * sc, 2.9 * SC * sc);
  g.fillStyle = '#8a3a4a'; const [bx, bz] = P(-5.3 * SC, -4.3 * SC); g.fillRect(bx, bz, 2.2 * SC * sc, 3.4 * SC * sc);
  minimapDots(g, P);
}
const level = {
  name: 'house', getH: () => 0, zoneName: () => 'Maison de Camille', build, populate, animate, minimap,
  counts: () => `<small>Chez Camille — Entrée devant le lit pour dormir, devant l'armoire pour se changer, devant la porte pour sortir. Le coffre est sur la mezzanine.</small>`
    + BOURSE.ligneHUD(),
  start: () => showMessage('La maison de Camille. Le lit est au fond à gauche.', 4),
  arriveMessage: () => 'La maison de Camille. Le lit est au fond à gauche, la porte derrière toi.',
  entry: () => ({ title: 'La maison de Camille', sub: 'Au bord du bois de Boulogne', cam: [3 * SC, 3.6 * SC, 3.5 * SC], at: [0, 1.2, 0], cam2: [1.5 * SC, 2.6 * SC, 5 * SC], at2: [0, 1.4, 2 * SC], dur: 3.5 }),
  onKill: () => {},
};
// Camille riggée si la banque est là, sinon la version en primitives
await PNJ.installerCamille(PNJ_E);
LOOK.veiller();          // l'apparence choisie devant l'armoire se repose sur le maillage
bootLevel(level, null);
