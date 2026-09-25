import * as PNJ_E from './engine.js?v=27';
import * as PNJ from './pnj.js';
// The Legend of Camille — niveau 6 : l'intérieur de la chapelle Saint-Roch
// =====================================================================
// COHÉRENCE AVEC L'EXTÉRIEUR — c'est la raison d'être de l'agrandissement fait dans
// game.js. La nef extérieure mesure 9 × 14 × 6,4 en unités du village, et le groupe
// « town » est agrandi ×1,5 : soit 13,5 × 21 × 9,6 m. Des murs de 55 cm laissent donc
// 12,4 × 19,9 m dedans, et c'est exactement ce qu'on bâtit ici — en mètres monde, sans
// facteur d'échelle, pour qu'aucune conversion ne vienne fausser les cotes.
// L'abside (demi-cylindre de rayon 6,3 dehors) se prolonge de 5,75 m au nord.
//
// Le volume vient de la charpente apparente : bas-côtés sous les arcades, nef centrale
// qui monte à 12,4 m au faîtage. Un plafond plat à 9,6 m aurait donné un hangar.
// =====================================================================
import { THREE, rand, TAU, scene, G, T, mat, pbr, pbrRepeat, phMat, stoneMat, IRON, GOLD, hemi, sun, renderer, bloom,
  mesh, boxG, sphG, capG, rboxG, latheG, corniceAround, pilaster, archWindow, makeCanvas, tex,
  world, addCap, addBox, addPlatform, makeTorch, SFX, state, player,
  addInteract, showMessage, saveGame, goToLevel, bootLevel, minimapDots, makeSky, dialogue } from './engine.js?v=27';
import { TOWN, townWorld } from './carte.js';

const HW = 6.2, HD = 9.95, HM = 9.6, FAITE = 12.4;   // demi-largeur, demi-profondeur, hauteur des murs, faîtage
const AR = 5.75, AZ = -HD;                            // abside : rayon et centre
const PX = -1.5;                                      // axe du portail et de la rosace (le clocher occupe l'est)
const COL_X = 3.6, COL_Z = [-6, -2, 2, 6];            // arcades : colonnes des bas-côtés
// parvis : (tx-1, tz-22+9) en unités du village, soit TOWN + local×1,5 = (44,5 ; 98,5)
// Le parvis se calcule depuis TOWN : le bourg a déménagé DANS le vrai quartier et il
// est tourné. Une position monde en dur ne survit pas à ça — celle d'avant pointait
// à des centaines de mètres de la porte. townWorld() fait la conversion.
const [SX, SZ] = townWorld(-1.5, -13.0);
const EXIT = { level: 'citadel', pos: [SX, 0, SZ], yaw: -TOWN.a };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let cierges = [], lustres = [], rais = [];

// ---------------------------------------------------------------------
//  Vitrail : un vrai verre coloré au plomb, fabriqué au canvas
// ---------------------------------------------------------------------
// Un aplat bleu translucide ne fait pas un vitrail : ce qui le fait, ce sont les pièces
// de verre irrégulières, les plombs noirs entre elles et les barlotières horizontales.
function vitrailTexture(teinte, motif = 0) {
  const W = 192, H = 384, [c, x] = makeCanvas(W, H);
  const COUL = [
    ['#2b4f9e', '#3f76c8', '#7fa8de', '#1d3570'],       // bleus
    ['#8e2320', '#c8452e', '#e08a4a', '#5d1a18'],       // rouges et ors
    ['#2c6b3e', '#4f9a55', '#9ac86a', '#1b4428'],       // verts
  ][teinte % 3];
  x.fillStyle = '#12141c'; x.fillRect(0, 0, W, H);
  // médaillon central, bordure et fond en petites pièces losangées
  const piece = (px, py, pw, ph, col) => {
    x.fillStyle = col; x.beginPath();
    x.moveTo(px + pw / 2, py); x.lineTo(px + pw, py + ph / 2); x.lineTo(px + pw / 2, py + ph); x.lineTo(px, py + ph / 2); x.closePath(); x.fill();
    x.strokeStyle = '#0b0d12'; x.lineWidth = 3; x.stroke();
  };
  for (let j = 0; j < 14; j++) for (let i = 0; i < 6; i++) {
    const px = i * (W / 6) - (j % 2 ? W / 12 : 0), py = j * (H / 14);
    piece(px, py, W / 6, H / 14, COUL[(i + j) % 2 === 0 ? 2 : 3]);
  }
  // médaillon : un rond central avec une figure simple (croix, étoile, coquille)
  x.save(); x.translate(W / 2, H * 0.42);
  x.fillStyle = COUL[0]; x.beginPath(); x.arc(0, 0, 62, 0, TAU); x.fill();
  x.strokeStyle = '#0b0d12'; x.lineWidth = 5; x.stroke();
  x.fillStyle = COUL[1];
  if (motif % 3 === 0) { x.fillRect(-9, -44, 18, 88); x.fillRect(-34, -17, 68, 18); }
  else if (motif % 3 === 1) { x.beginPath(); for (let k = 0; k < 12; k++) { const a = k * TAU / 12, r = k % 2 ? 20 : 46; k ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }
  else { x.beginPath(); x.arc(0, 8, 40, Math.PI, TAU); x.fill(); for (let k = 0; k < 5; k++) { x.strokeStyle = '#0b0d12'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 8); const a = Math.PI + (k + 1) * Math.PI / 6; x.lineTo(Math.cos(a) * 40, 8 + Math.sin(a) * 40); x.stroke(); } }
  x.strokeStyle = '#0b0d12'; x.lineWidth = 4; x.stroke(); x.restore();
  // barlotières : trois barres de fer en travers
  x.fillStyle = '#0b0d12'; for (const f of [0.2, 0.5, 0.8]) x.fillRect(0, H * f, W, 5);
  return tex(c, 1);
}
// un vitrail par couple (teinte, motif), pas un par baie : sinon on fabrique une
// quarantaine de canvas 192×384 au chargement pour vingt-deux ouvertures
const VITRAUX = new Map();
function vitrailMat(teinte, motif) {
  const k = teinte + '|' + motif;
  if (!VITRAUX.has(k)) {
    const t = vitrailTexture(teinte, motif);
    VITRAUX.set(k, new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.35, roughness: 0.35, metalness: 0, side: THREE.DoubleSide }));
  }
  return VITRAUX.get(k);
}

function build() {
  makeSky(0x1a2740, 0x3a4f70, 0x8a94a0, true);
  scene.fog = null;
  hemi.intensity = 0.26; hemi.color.setHex(0xc8d4e8); hemi.groundColor.setHex(0x3a3830);
  sun.intensity = 0.5; sun.position.set(9, 12, 7); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  renderer.toneMappingExposure = 1.05; bloom.strength = 0.26;
  G.camBack = 6.4; G.camUp = 3.4; G.camMaxY = FAITE - 1.2;

  const dalle = phMat('worn_tile_floor', 3.2, 3.2, { color: 0x9a938a });
  const dalleAxe = phMat('rocky_trail', 3.0, 3.0, { color: 0xa9a094 });
  const mur = phMat('church_bricks_03', 2.75, 2.75, { color: 0xbdb3a2 });
  const taille = phMat('old_stone_wall_02', 2.6, 2.6, { color: 0xd5cdbc });     // pierre de taille, plus claire
  const chene = phMat('wood_cabinet_worn_long', 2.0, 2.0, { color: 0x6b4c31 });
  const charp = phMat('tree_trunk', 2.2, 2.2, { color: 0x5d4a35 });
  const orM = mat(0xd8b44a, { metalness: 0.85, roughness: 0.3 });

  // ---------- sol : dalles, allée centrale, pierres tombales ----------
  { const s = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.2, HD * 2), dalle); s.position.y = -0.1; s.receiveShadow = true; scene.add(s);
    const ap = new THREE.Mesh(new THREE.CylinderGeometry(AR, AR, 0.2, 26, 1, false, Math.PI / 2, Math.PI), dalle); ap.position.set(0, -0.1, AZ); ap.receiveShadow = true; scene.add(ap);
    const allee = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.04, HD * 2 - 1), dalleAxe); allee.position.set(0, 0.01, 0.5); allee.receiveShadow = true; scene.add(allee);
    // trois dalles funéraires dans l'allée, gravées d'une croix et d'une épée
    for (let k = 0; k < 3; k++) { const dz = -4 + k * 5.5;
      const d = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 2.6), phMat('rock_wall_14', 1.6, 2.7, { color: 0x8e877c })); d.position.set(0, 0.035, dz); d.receiveShadow = true; scene.add(d);
      scene.add(mesh(boxG(0.16, 0.02, 1.7), taille, 0, 0.07, dz)); scene.add(mesh(boxG(0.8, 0.02, 0.16), taille, 0, 0.07, dz - 0.4)); } }

  // ---------- murs, pilastres, corniche ----------
  const murs = [[-HW, HD, HW, HD], [-HW, -HD, -HW, HD], [HW, -HD, HW, HD]];   // au nord, c'est l'abside
  for (const [ax, az, bx, bz] of murs) {
    const len = Math.hypot(bx - ax, bz - az), yaw = -Math.atan2(bz - az, bx - ax);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, HM, 0.5), mur); m.position.set((ax + bx) / 2, HM / 2, (az + bz) / 2); m.rotation.y = yaw; m.receiveShadow = true; scene.add(m);
    const so = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.62), taille); so.position.set((ax + bx) / 2, 0.55, (az + bz) / 2); so.rotation.y = yaw; scene.add(so);
    const ba = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.68), taille); ba.position.set((ax + bx) / 2, 4.2, (az + bz) / 2); ba.rotation.y = yaw; scene.add(ba);
    addCap(ax, az, bx, bz, 0.3, FAITE + 4);
  }
  // l'abside et son cul-de-four sont des surfaces ouvertes : elles se voient du dedans,
  // donc DoubleSide — sur une COPIE du matériau, sinon tous les murs y passent
  const murIn = mur.clone(); murIn.side = THREE.DoubleSide;
  const tailleIn = taille.clone(); tailleIn.side = THREE.DoubleSide;
  { const ap = new THREE.Mesh(new THREE.CylinderGeometry(AR + 0.5, AR + 0.5, HM, 26, 1, true, Math.PI / 2, Math.PI), murIn);
    ap.position.set(0, HM / 2, AZ); ap.receiveShadow = true; scene.add(ap);
    for (let k = 0; k < 14; k++) { const a = Math.PI / 2 + (k + 0.5) / 14 * Math.PI; addCap(Math.cos(a) * AR + 0.0, AZ + Math.sin(a) * AR, Math.cos(a + 0.24) * AR, AZ + Math.sin(a + 0.24) * AR, 0.25, FAITE); } }
  // cul-de-four de l'abside : demi-coupole nervurée
  { const four = new THREE.Mesh(new THREE.SphereGeometry(AR + 0.4, 24, 12, Math.PI / 2, Math.PI, 0, Math.PI / 2), tailleIn);
    four.position.set(0, HM - 2.2, AZ); scene.add(four);
    for (let k = 0; k < 5; k++) { const a = Math.PI / 2 + (k + 0.5) / 5 * Math.PI;
      const cur = new THREE.Mesh(new THREE.TorusGeometry(AR + 0.15, 0.13, 6, 16, Math.PI / 2), taille);
      cur.position.set(0, HM - 2.2, AZ); cur.rotation.y = -a + Math.PI / 2; cur.rotation.x = 0; scene.add(cur); } }
  corniceAround(scene, 0, HM - 0.5, 0.0, HW, HD, taille, 0.42, 0.34, 'cyma');

  // ---------- arcades des bas-côtés : huit colonnes à chapiteau et arcs en plein cintre ----------
  for (const sx of [-1, 1]) {
    for (const cz of COL_Z) {
      const x = sx * COL_X;
      scene.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 16), taille, x, 2.75, cz));
      scene.add(mesh(rboxG(1.1, 0.45, 1.1, 0.08, 2), taille, x, 0.22, cz));                       // base
      scene.add(mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.22, 16), taille, x, 0.55, cz));      // tore
      scene.add(mesh(new THREE.CylinderGeometry(0.42, 0.62, 0.55, 16), taille, x, 5.32, cz));     // chapiteau à corbeille
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8;                                        // crochets de feuillage
        scene.add(mesh(sphG(0.13, 7), taille, x + Math.cos(a) * 0.55, 5.5, cz + Math.sin(a) * 0.55)); }
      scene.add(mesh(rboxG(1.25, 0.28, 1.25, 0.05, 2), taille, x, 5.72, cz));                     // tailloir
      addCap(x, cz, x, cz, 0.55, FAITE);
    }
    // arcs entre les colonnes, et retombées sur les murs pignons
    const pts = [-HD + 0.5, ...COL_Z, HD - 0.5];
    for (let i = 0; i < pts.length - 1; i++) {
      const z0 = pts[i], z1 = pts[i + 1], r = (z1 - z0) / 2, zc = (z0 + z1) / 2;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.34, 8, 20, Math.PI), taille);
      arc.position.set(sx * COL_X, 5.86, zc); arc.rotation.y = Math.PI / 2; arc.castShadow = true; scene.add(arc);
      scene.add(mesh(boxG(0.7, 1.6, z1 - z0), mur, sx * COL_X, 5.86 + r + 0.8, zc));              // mur au-dessus de l'arcade
    }
    // bas-côté : plafond en berceau rampant
    { const w = HW - COL_X, cxm = sx * (COL_X + w / 2);
      const pan = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.26, HD * 2 - 0.4), chene);
      pan.position.set(cxm, 6.6, 0); pan.rotation.z = sx * 0.34; pan.receiveShadow = true; scene.add(pan);
      for (let k = -8; k <= 8; k++) { const ch = mesh(boxG(w + 0.5, 0.16, 0.2), charp, cxm, 6.42, k * (HD * 2 - 1) / 17); ch.rotation.z = sx * 0.34; scene.add(ch); } }
  }

  // ---------- charpente apparente de la nef centrale : fermes à entrait et poinçon ----------
  for (const sx of [-1, 1]) { const L = Math.hypot(COL_X + 0.6, FAITE - 7.4);
    const pan = new THREE.Mesh(new THREE.BoxGeometry(L + 0.4, 0.3, HD * 2), chene);
    pan.position.set(sx * (COL_X + 0.6) / 2, (7.4 + FAITE) / 2, 0); pan.rotation.z = -sx * Math.atan2(FAITE - 7.4, COL_X + 0.6); pan.receiveShadow = true; scene.add(pan); }
  scene.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, HD * 2, 8), charp, 0, FAITE - 0.2, 0).rotateX(Math.PI / 2));
  for (let k = -3; k <= 3; k++) { const z = k * 2.8;
    scene.add(mesh(boxG(COL_X * 2 + 1.2, 0.3, 0.32), charp, 0, 7.4, z));                           // entrait
    scene.add(mesh(boxG(0.28, FAITE - 7.6, 0.3), charp, 0, (7.4 + FAITE) / 2, z));                 // poinçon
    for (const sx of [-1, 1]) { const L = Math.hypot(COL_X + 0.6, FAITE - 7.4);
      const arb = mesh(boxG(L, 0.24, 0.26), charp, sx * (COL_X + 0.6) / 2, (7.4 + FAITE) / 2 - 0.22, z);
      arb.rotation.z = -sx * Math.atan2(FAITE - 7.4, COL_X + 0.6); scene.add(arb);
      const jam = mesh(boxG(1.7, 0.2, 0.22), charp, sx * (COL_X - 0.2), 6.9, z); jam.rotation.z = sx * 0.8; scene.add(jam); } }

  // ---------- vitraux : quatre par bas-côté, trois à l'abside, une rosace en façade ----------
  const poseVitrail = (x, y, z, ry, w, h, teinte, motif) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    g.add(mesh(boxG(w, h, 0.08), vitrailMat(teinte, motif), 0, 0, 0));
    g.add(mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 18, 1, false, 0, Math.PI), vitrailMat(teinte, motif + 1), 0, h / 2, 0).rotateX(Math.PI / 2));
    // ébrasement de pierre : le mur est épais, la lumière arrive par un entonnoir
    for (const sx of [-1, 1]) { const eb = mesh(boxG(0.5, h + w / 2, 0.34), taille, sx * (w / 2 + 0.22), h / 4, -0.22); eb.rotation.y = -sx * 0.32; g.add(eb); }
    g.add(mesh(boxG(w + 1.1, 0.3, 0.42), taille, 0, -h / 2 - 0.15, -0.1));
    return g;
  };
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const z = -6.75 + k * 4.5;
    poseVitrail(sx * (HW - 0.2), 3.3, z, sx * Math.PI / 2, 1.7, 3.4, (k + (sx > 0 ? 1 : 0)) % 3, k);
    // rai de lumière colorée tombant en biais sur les dalles : c'est ce qui fait la chapelle
    const geo = new THREE.CylinderGeometry(1.2, 2.0, 7.4, 10, 1, true);
    const couleurs = [0x4f80d8, 0xd87a4a, 0x6ac07a];
    const rai = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: couleurs[(k + (sx > 0 ? 1 : 0)) % 3], transparent: true, opacity: 0.075, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    rai.position.set(sx * (HW - 2.6), 3.6, z + 1.2); rai.rotation.z = sx * 0.34; rai.rotation.x = 0.16; scene.add(rai); rais.push(rai);
  }
  for (let k = -1; k <= 1; k++) { const a = Math.PI + k * Math.PI / 3.2;
    poseVitrail(Math.sin(a) * (AR - 0.15), 4.0, AZ + Math.cos(a) * (AR - 0.15), a + Math.PI, 1.3, 2.9, (k + 3) % 3, k + 1); }
  // rosace de la façade sud, dans l'axe du portail
  { const ro = new THREE.Group(); ro.position.set(PX, 7.4, HD - 0.22); ro.rotation.y = Math.PI; scene.add(ro);
    ro.add(mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.1, 26), vitrailMat(1, 0), 0, 0, 0).rotateX(Math.PI / 2));
    ro.add(mesh(new THREE.TorusGeometry(1.42, 0.18, 8, 26), taille, 0, 0, 0));
    for (let k = 0; k < 8; k++) ro.add(mesh(boxG(0.12, 2.7, 0.12), taille, 0, 0, 0.02).rotateZ(k * TAU / 8));
    ro.add(mesh(new THREE.TorusGeometry(0.46, 0.12, 6, 18), taille, 0, 0, 0.03)); }

  // ---------- portail : on le repousse pour sortir, et la petite porte du clocher ----------
  { const dz = HD - 0.3;
    scene.add(mesh(boxG(3.4, 0.4, 0.7), taille, PX, 4.6, dz)); for (const sx of [-1, 1]) scene.add(mesh(boxG(0.4, 4.6, 0.7), taille, PX + sx * 1.5, 2.3, dz));
    for (let k = 0; k < 3; k++) scene.add(mesh(new THREE.TorusGeometry(1.5 + k * 0.22, 0.14, 8, 18, Math.PI), taille, PX, 4.6, dz - 0.05 - k * 0.12));
    for (const sx of [-1, 1]) { const v = mesh(boxG(1.25, 4.2, 0.14), chene, PX + sx * 0.66, 2.1, dz - 0.3); scene.add(v);
      for (const yy of [1.0, 3.2]) scene.add(mesh(boxG(1.15, 0.16, 0.05), IRON(), PX + sx * 0.66, yy, dz - 0.38));
      scene.add(mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 14), IRON(), PX + sx * 0.28, 2.0, dz - 0.4)); }
    addInteract({ pos: V(PX, 0, HD - 1.6), r: 2.0, prompt: () => 'sortir de la chapelle',
      fn: () => goToLevel(EXIT.level, EXIT.pos, EXIT.yaw, 'Camille ressort sur le parvis…') });
    // porte du clocher (condamnée) : elle explique le volume qu'on voit dehors
    const pc = mesh(boxG(1.05, 2.3, 0.12), chene, 4.35, 1.15, dz - 0.18); scene.add(pc);
    scene.add(mesh(new THREE.TorusGeometry(0.42, 0.16, 8, 14, Math.PI), taille, 4.35, 2.3, dz - 0.1));
    for (let k = 0; k < 4; k++) scene.add(mesh(boxG(0.95, 0.12, 0.05), IRON(), 4.35, 0.35 + k * 0.6, dz - 0.25));
    addInteract({ pos: V(4.35, 0, HD - 1.4), r: 1.6, prompt: () => "monter au clocher",
      fn: () => dialogue([{ text: "La porte du clocher est fermée par une barre de fer et un cadenas rouillé. Sur l'ardoise pendue au clou : « Escalier condamné — la cloche a fêlé son bâti. Désiré. »" }]) }); }

  // ---------- chœur surélevé, autel, retable, croix ----------
  { for (let k = 0; k < 2; k++) { const zz = AZ + AR - 0.4 + (2 - k) * 1.3;
      const m = new THREE.Mesh(new THREE.BoxGeometry(HW * 1.6, 0.22, 1.3), taille); m.position.set(0, 0.11 + k * 0.22, zz); m.receiveShadow = true; scene.add(m);
      addPlatform(-HW * 0.8, HW * 0.8, zz - 0.65, zz + 0.65, 0.22 + k * 0.22); }
    const CH = 0.44;                                                   // hauteur du chœur
    { const p = new THREE.Mesh(new THREE.CylinderGeometry(AR - 0.3, AR - 0.3, CH, 26, 1, false, Math.PI / 2, Math.PI), taille); p.position.set(0, CH / 2, AZ); p.receiveShadow = true; scene.add(p);
      addPlatform(-(AR - 0.3), AR - 0.3, AZ - (AR - 0.3), AZ + 0.6, CH); }
    // autel : table de pierre sur quatre colonnettes, nappe, chandeliers
    const az2 = AZ + 1.6;
    scene.add(mesh(rboxG(2.9, 0.26, 1.35, 0.05, 2), taille, 0, CH + 1.05, az2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) scene.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.0, 12), taille, sx * 1.15, CH + 0.5, az2 + sz * 0.45));
    scene.add(mesh(boxG(2.7, 0.9, 1.2), mat(0xf2ece0, { roughness: 0.95 }), 0, CH + 0.72, az2));
    scene.add(mesh(boxG(2.75, 0.14, 1.25), mat(0xc8a03a, { roughness: 0.6 }), 0, CH + 0.3, az2));
    addCap(-1.45, az2, 1.45, az2, 0.8, CH + 1.4);
    for (let k = 0; k < 6; k++) { const cx2 = -1.15 + k * 0.46;
      scene.add(mesh(latheG([[0, 0], [0.09, 0.02], [0.05, 0.06], [0.035, 0.28], [0.07, 0.32], [0.035, 0.36]], 10), orM, cx2, CH + 1.18, az2 - 0.42));
      const ci = mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.3, 8), mat(0xf4efe0), cx2, CH + 1.69, az2 - 0.42); scene.add(ci);
      const fl = mesh(sphG(0.045, 8), new THREE.MeshBasicMaterial({ color: 0xffd48a }), cx2, CH + 1.87, az2 - 0.42); scene.add(fl); cierges.push(fl); }
    // retable : trois panneaux peints sous des arcatures, et la croix
    { const re = new THREE.Group(); re.position.set(0, CH, AZ + 0.4); scene.add(re);
      re.add(mesh(boxG(4.2, 0.35, 0.5), chene, 0, 1.35, 0));
      for (let k = -1; k <= 1; k++) { re.add(mesh(boxG(1.2, 2.1, 0.22), chene, k * 1.35, 2.6, 0));
        re.add(mesh(boxG(1.0, 1.75, 0.08), mat([0x3a5a8a, 0x8a5a2a, 0x4a6a4a][k + 1], { roughness: 0.8 }), k * 1.35, 2.62, 0.1));
        re.add(mesh(new THREE.TorusGeometry(0.52, 0.09, 6, 14, Math.PI), orM, k * 1.35, 3.5, 0.12));
        re.add(mesh(sphG(0.3, 12), mat(0xe8c9a8, { roughness: 0.85 }), k * 1.35, 3.0, 0.14)); }
      for (const sx of [-1, 1]) re.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.5, 10), orM, sx * 2.1, 2.5, 0.05));
      re.add(mesh(boxG(4.6, 0.3, 0.55), chene, 0, 4.4, 0));
      re.add(mesh(boxG(0.22, 1.9, 0.22), orM, 0, 5.4, 0)); re.add(mesh(boxG(1.1, 0.22, 0.22), orM, 0, 5.6, 0)); }
    { const l = new THREE.PointLight(0xffd8a0, 6, 16, 1.5); l.position.set(0, CH + 3.4, AZ + 2.2); scene.add(l); }
    addInteract({ pos: V(0, 0, az2 + 2.4), r: 2.6, prompt: () => "lire le retable",
      fn: () => dialogue([
        { text: "Le panneau de gauche montre un homme au bâton, la jambe découverte, un chien tenant un pain dans la gueule : saint Roch, invoqué contre la peste, patron de la chapelle." },
        { text: "Celui du milieu montre deux géants qui se battent au bord d'une rivière. L'un tient une épée, l'autre une massue. Sous leurs pieds, quelqu'un a écrit à la pointe : « LYDERICUS · PHINAERTUS · ANNO 640 »." },
        { text: "Celui de droite est resté vide. Le bois n'a jamais été peint." },
      ]) }); }

  // ---------- bancs de la nef ----------
  for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) { const z = -4.2 + k * 1.5, x = sx * 1.9;
    const b = new THREE.Group(); b.position.set(x, 0, z); scene.add(b);
    b.add(mesh(boxG(2.4, 0.11, 0.42), chene, 0, 0.45, 0));                      // assise
    b.add(mesh(boxG(2.4, 0.75, 0.09), chene, 0, 0.72, -0.24));                  // dossier
    b.add(mesh(boxG(2.4, 0.1, 0.3), chene, 0, 0.16, 0.34));                     // agenouilloir
    for (const sz of [-1, 1]) b.add(mesh(boxG(0.09, 0.95, 0.5), chene, sz * 1.15, 0.48, 0));
    addCap(x - 1.2, z, x + 1.2, z, 0.35, 0.55); }

  // ---------- fonts baptismaux, lutrin, tronc des pauvres ----------
  { const fx = -4.9, fz = HD - 2.6;
    scene.add(mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.3, 16), taille, fx, 0.15, fz));
    scene.add(mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 14), taille, fx, 0.7, fz));
    scene.add(mesh(latheG([[0, 0], [0.62, 0.05], [0.7, 0.3], [0.66, 0.46], [0.56, 0.44], [0.58, 0.1], [0, 0.08]], 18), taille, fx, 1.15, fz));
    scene.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16), mat(0x2a4a5a, { roughness: 0.1, metalness: 0.3 }), fx, 1.48, fz));
    scene.add(mesh(new THREE.ConeGeometry(0.66, 0.5, 14), chene, fx, 1.9, fz)); scene.add(mesh(sphG(0.09, 8), orM, fx, 2.2, fz));
    addCap(fx, fz, fx, fz, 0.8, 1.6); }
  { const lx = 1.9, lz = AZ + AR + 0.4;
    scene.add(mesh(new THREE.CylinderGeometry(0.14, 0.3, 1.25, 10), chene, lx, 0.62, lz));
    const pu = mesh(boxG(0.7, 0.06, 0.55), chene, lx, 1.28, lz); pu.rotation.x = -0.45; scene.add(pu);
    scene.add(mesh(boxG(0.6, 0.05, 0.42), mat(0xf0e8d4, { roughness: 1 }), lx, 1.34, lz - 0.02).rotateX(-0.45));
    addCap(lx, lz, lx, lz, 0.35, 1.4); }
  { const tx = -4.0, tz = HD - 4.4;
    scene.add(mesh(boxG(0.55, 1.0, 0.45), chene, tx, 0.5, tz)); for (const yy of [0.25, 0.8]) scene.add(mesh(boxG(0.6, 0.09, 0.5), IRON(), tx, yy, tz));
    scene.add(mesh(boxG(0.22, 0.04, 0.05), IRON(), tx, 1.01, tz));
    scene.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), IRON(), tx, 0.7, tz - 0.3));
    addCap(tx, tz, tx, tz, 0.4, 1.1);
    addInteract({ pos: V(tx + 1.0, 0, tz), r: 1.5, prompt: () => 'regarder le tronc des pauvres',
      fn: () => dialogue([{ text: "Un tronc de chêne cerclé de fer, vissé au pilier. La fente est large comme une pièce. À côté, sur une ardoise : « Pour les toits de la rue Basse. » La craie est presque effacée." }]) }); }

  // ---------- ex-voto : la herse de cierges du bas-côté ouest ----------
  { const vx = -HW + 1.2, vz = -1.0;
    scene.add(mesh(boxG(0.5, 0.12, 2.6), IRON(), vx, 0.95, vz)); for (const sz of [-1, 1]) scene.add(mesh(boxG(0.4, 0.95, 0.09), IRON(), vx, 0.48, vz + sz * 1.2));
    for (let r = 0; r < 3; r++) { scene.add(mesh(boxG(0.34, 0.06, 2.5), IRON(), vx, 1.0 + r * 0.26, vz));
      for (let k = 0; k < 9; k++) { if ((k + r) % 4 === 3) continue; const cz2 = vz - 1.1 + k * 0.275;
        scene.add(mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.16 + rand(0, 0.1), 8), mat(0xf4e8cc), vx, 1.11 + r * 0.26, cz2));
        const fl = mesh(sphG(0.04, 7), new THREE.MeshBasicMaterial({ color: 0xffc870 }), vx, 1.26 + r * 0.26, cz2); scene.add(fl); cierges.push(fl); } }
    const l = new THREE.PointLight(0xffb060, 4.5, 11, 1.7); l.position.set(vx + 0.5, 1.7, vz); scene.add(l);
    addCap(vx, vz - 1.3, vx, vz + 1.3, 0.45, 1.6);
    // les petites plaques de marbre vissées au mur au-dessus
    for (let k = 0; k < 8; k++) { const p = mesh(boxG(0.06, 0.34, 0.5), mat(0xe8e4dc, { roughness: 0.35 }), vx - 0.55, 2.4 + Math.floor(k / 4) * 0.55, vz - 0.8 + (k % 4) * 0.55); scene.add(p);
      scene.add(mesh(boxG(0.03, 0.05, 0.3), orM, vx - 0.59, 2.4 + Math.floor(k / 4) * 0.55, vz - 0.8 + (k % 4) * 0.55)); }
    addInteract({ pos: V(vx + 1.4, 0, vz), r: 2.0, prompt: () => 'regarder les cierges',
      fn: () => dialogue([
        { text: "Trente cierges, la moitié allumés. Au-dessus, des petites plaques de marbre vissées au mur : « MERCI », « POUR MON FILS REVENU », « À SAINT ROCH, 1708 »." },
        { text: state.princeFreed
          ? "Une plaque toute neuve, encore brillante : « POUR CAMILLE, QUI A RAMENÉ LE PRINCE. » La vis du bas n'est même pas serrée."
          : "Le dernier cierge est posé de travers, allumé il y a peu. Sous lui, une bande de papier pliée : « Pour Eugène. Et pour la petite qui est partie le chercher. »" },
      ]) }); }

  // ---------- statue de saint Roch et plaque de la garnison, bas-côté est ----------
  { const sx2 = HW - 1.3, sz2 = -2.0;
    scene.add(mesh(rboxG(1.3, 1.5, 1.3, 0.06, 2), taille, sx2, 0.75, sz2));
    scene.add(mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.2, 14), taille, sx2, 1.6, sz2));
    { const st = new THREE.Group(); st.position.set(sx2, 1.7, sz2); st.rotation.y = -Math.PI / 2 - 0.3; scene.add(st);
      const pl = mat(0xe4dfd2, { roughness: 0.75 });
      st.add(mesh(new THREE.CylinderGeometry(0.34, 0.5, 1.5, 14), pl, 0, 0.75, 0));               // robe de pèlerin
      st.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12), pl, 0, 1.68, 0));               // buste
      st.add(mesh(sphG(0.22, 14), pl, 0, 2.06, 0));                                               // tête
      st.add(mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.1, 14), pl, 0, 2.2, -0.04));            // chapeau de pèlerin
      st.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), pl, 0.3, 1.0, 0.06).rotateZ(-0.12));  // bourdon
      st.add(mesh(sphG(0.2, 10), pl, 0.42, 0.6, 0.3));                                            // le chien, à ses pieds
      st.add(mesh(sphG(0.13, 10), pl, 0.42, 0.78, 0.48)); st.add(mesh(boxG(0.16, 0.09, 0.12), mat(0xc8a25a, { roughness: 0.9 }), 0.42, 0.78, 0.62)); }
    addCap(sx2, sz2, sx2, sz2, 0.8, 2.2);
    // plaque de la garnison, gravée, vissée au mur du bas-côté
    const px2 = HW - 0.4, pz2 = 3.4;
    scene.add(mesh(boxG(0.08, 1.9, 1.5), mat(0x2a2f38, { roughness: 0.4, metalness: 0.25 }), px2, 2.5, pz2));
    scene.add(mesh(boxG(0.05, 2.05, 1.65), orM, px2 + 0.02, 2.5, pz2));
    for (let k = 0; k < 9; k++) scene.add(mesh(boxG(0.02, 0.035, 1.0), orM, px2 - 0.05, 3.1 - k * 0.17, pz2));
    addInteract({ pos: V(px2 - 1.4, 0, pz2), r: 2.0, prompt: () => 'lire la plaque de la garnison',
      fn: () => dialogue([
        { text: "Une plaque de fonte, lettres dorées, vissée dans la pierre." },
        { text: "« À LA MÉMOIRE DES HOMMES DE LA GARNISON DE LA CITADELLE — 1670-1789 — QUI ONT MONTÉ LA GARDE SUR LES CINQ BASTIONS ET N'ONT JAMAIS VU L'ENNEMI. »" },
        { text: "En dessous, plus petit, gravé bien plus tard : « ET À CEUX QUI LA MONTENT ENCORE. »" },
        { text: state.q_ghosts >= 3
          ? "Le métal est tiède sous la main. Depuis que les remparts se sont tus, on dirait que la plaque respire."
          : "Le métal est glacé. Désiré dit qu'on les entend encore gémir sur le chemin de ronde, les nuits sans lune." },
      ]) }); }

  // ---------- deux couronnes de lumière suspendues à la charpente ----------
  for (const z of [-3.2, 3.2]) {
    const lu = new THREE.Group(); lu.position.set(0, 5.4, z); scene.add(lu);
    lu.add(mesh(new THREE.TorusGeometry(1.25, 0.07, 6, 28), IRON(), 0, 0, 0).rotateX(Math.PI / 2));
    lu.add(mesh(new THREE.TorusGeometry(1.25, 0.04, 6, 28), orM, 0, 0.16, 0).rotateX(Math.PI / 2));
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12, cx2 = Math.cos(a) * 1.25, cz2 = Math.sin(a) * 1.25;
      lu.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 8), mat(0xf4e8cc), cx2, 0.22, cz2));
      const fl = mesh(sphG(0.05, 8), new THREE.MeshBasicMaterial({ color: 0xffd48a }), cx2, 0.42, cz2); lu.add(fl); cierges.push(fl); }
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4; const ch = mesh(new THREE.CylinderGeometry(0.014, 0.014, 6.6, 4), IRON(), Math.cos(a) * 0.62, 3.3, Math.sin(a) * 0.62); ch.rotation.z = -Math.cos(a) * 0.1; ch.rotation.x = Math.sin(a) * 0.1; lu.add(ch); }
    const l = new THREE.PointLight(0xffc880, 5.5, 15, 1.6); l.position.y = 0.4; lu.add(l); lustres.push(lu);
  }
  // bannière de procession et gonfalon, accrochés aux colonnes
  for (const [sx, z, col] of [[-1, -6, 0x8a2a2a], [1, -6, 0x2a4a7a]]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.9, 4, 4), mat(col, { roughness: 0.9, side: THREE.DoubleSide }));
    b.position.set(sx * (COL_X - 0.6), 3.4, z); b.rotation.y = sx * Math.PI / 2; b.userData.flag = true; scene.add(b);
    scene.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 6), orM, sx * (COL_X - 0.6), 4.4, z).rotateX(Math.PI / 2));
  }
}

function populate() { player.pos.set(PX, 0, HD - 2.2); player.yaw = Math.PI; G.camYaw = Math.PI; }
function animate(now, dt) {
  for (let i = 0; i < cierges.length; i++) { const f = cierges[i]; const s = 1 + Math.sin(now / (48 + (i % 7) * 9) + i) * 0.22; f.scale.set(s, 1 + (s - 1) * 1.8, s); }
  for (const lu of lustres) lu.rotation.y = Math.sin(now / 5200 + lu.position.z) * 0.05;
  for (const r of rais) r.material.opacity = 0.06 + Math.sin(now / 2600 + r.position.z) * 0.02;
  scene.traverse(o => { if (o.userData.flag) o.rotation.z = Math.sin(now / 900) * 0.03; });
}
function minimap(g, W2) {
  const sc = 4.2, P = (x, z) => [W2 / 2 + x * sc, W2 / 2 + z * sc * 0.82];
  g.fillStyle = '#6b6357'; const [x0, z0] = P(-HW, -HD); g.fillRect(x0, z0, HW * 2 * sc, HD * 2 * sc * 0.82);
  { const [ax, az] = P(0, AZ); g.beginPath(); g.arc(ax, az, AR * sc, Math.PI, TAU); g.fill(); }
  g.fillStyle = '#8d8474'; const [a0, a1] = P(-1.5, -HD + 0.5); g.fillRect(a0, a1, 3 * sc, (HD * 2 - 1) * sc * 0.82);
  g.fillStyle = '#d8c070'; const [t0, t1] = P(0, AZ + 1.6); g.fillRect(t0 - 5, t1 - 2, 10, 4);
  g.fillStyle = '#4a3a2a'; for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) { const [bx, bz] = P(sx * 1.9, -4.2 + k * 1.5); g.fillRect(bx - 5, bz - 1, 10, 2); }
  g.fillStyle = '#ffb060'; { const [vx, vz] = P(-HW + 1.2, -1.0); g.fillRect(vx - 1.5, vz - 4, 3, 8); }
  minimapDots(g, P);
}
const level = {
  name: 'chapelle', getH: () => 0, zoneName: () => 'Chapelle Saint-Roch', build, populate, animate, minimap,
  counts: () => `<small>La chapelle Saint-Roch — le retable, la plaque de la garnison et les cierges se lisent (Entrée). Le portail, derrière toi, pour ressortir.</small>`,
  start: () => showMessage('Il fait frais. La lumière des vitraux traverse la nef en biais et tombe sur les dalles.', 5),
  arriveMessage: () => 'La chapelle Saint-Roch.',
  entry: () => ({ title: 'La chapelle Saint-Roch', sub: 'Au bout de la rue nord', cam: [PX + 1.2, 2.2, HD - 3.6], at: [0, 3.0, AZ + 1.6], cam2: [0.4, 3.6, 2.0], at2: [0, 2.6, AZ + 1.6], dur: 4.5 }),
  onKill: () => {},
};
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
