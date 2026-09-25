// The Legend of Camille — niveau 4 : l'intérieur de l'estaminet du village
import { THREE, rand, TAU, lerpAngle, scene, G, T, mat, pbr, pbrRepeat, phMat, stoneMat, IRON, GOLD, hemi, sun, renderer, bloom,
  mesh, boxG, sphG, capG, world, addCap, addBox, addPlatform, makeTorch, makeLeg, makeArm, eyes, SKIN, SKIN_DARK, SFX, state, player,
  addInteract, showMessage, saveGame, goToLevel, bootLevel, minimapDots, makeSky, spawnGaufre, dialogue, makeHead, makeTorso, makeCat } from './engine.js?v=27';
import { TOWN, townWorld } from './carte.js';
import { makeDoor, makeVolet, LAITON, FERN, VITRE } from './menuiserie.js';
import * as A from './assets.js';
import * as PNJ_E from './engine.js?v=27';
import * as PNJ from './pnj.js';

// Mobilier du Fantasy Props MegaKit. Si la banque manque, l'estaminet garde son mobilier
// procédural : PROPS_OK reste faux et chaque appel à prop() ne fait rien.
const TAVERN_PROPS = ['props:Stool', 'props:Mug', 'props:Chandelier', 'props:Lantern_Wall',
  'props:Barrel', 'props:Barrel_Holder', 'props:Cauldron', 'props:Bottle_1', 'props:SmallBottles_1',
  'props:Shelf_Small_Bottles', 'props:CandleStick_Triple', 'props:Chest_Wood', 'props:Table_Plate',
  'props:Chalice', 'props:Bag', 'props:Pot_1'];
let PROPS_OK = false;
try { await A.preload(TAVERN_PROPS); PROPS_OK = true; }
catch (e) { console.warn('assets_back indisponible, estaminet en mobilier procédural :', e.message); }

// Une unité = un mètre (convention du projet). La salle était bâtie en unités
// « locales » puis agrandie ×1,3 : le comptoir montait à 1,43 m, les tables à 1,30 m
// et la pièce faisait 18 × 13 m pour une façade de 9,75 × 10,50 m. On repasse donc à
// l'échelle 1 et on recale la salle sur l'emprise de la maison du village.
const W = 11, D = 9, H = 4.0, SC = 1;
const EP = 0.36;                                   // épaisseur des murs
const room = new THREE.Group(); room.scale.setScalar(SC);
const cap = (ax, az, bx, bz, r) => addCap(ax * SC, az * SC, bx * SC, bz * SC, r * SC);
const V = (x, y, z) => new THREE.Vector3(x * SC, y * SC, z * SC);
// room est agrandi ×SC : on compense par scale 1/SC pour que les modèles gardent leurs
// dimensions réelles (règle 3 du brief). Renvoie null si la banque n'est pas là.
const prop = (id, x, y, z, rotY = 0, s = 1) => {
  if (!PROPS_OK) return null;
  const o = A.spawn(id, { x, y, z, rotY, scale: s / SC });
  room.add(o);
  return o;
};
const put = (o) => { room.add(o); return o; };
// sortie = TOWN + (EST_X, EST_Z + 2,4) x TOWN.s, soit 2,4 m devant la facade.
// TOWN suit ECH : constante a REPORTER a chaque changement d'echelle du plan.
// Le parvis se calcule depuis TOWN : le bourg a déménagé DANS le vrai quartier et il
// est tourné. Une position monde en dur ne survit pas à ça — celle d'avant pointait
// à des centaines de mètres de la porte. townWorld() fait la conversion.
const [SX, SZ] = townWorld(-11, -6.8);
const EXIT = { level: 'citadel', pos: [SX, 0, SZ], yaw: -TOWN.a };
let fire, patrons = [], barman, braise, chat, flammes = [], raisSoleil = [], poussiere = null;

// Hauteur à laquelle poser un client riggé assis. Le clip Sitting_Idle_Loop ne baisse pas
// la racine : il garde le bassin à hauteur debout (~1,6) et remonte les pieds de 0,78 à
// 0,96 selon la taille — mesuré sur les quatre clients. On descend donc la racine de la
// hauteur moyenne des pieds : ils touchent le plancher, et l'assise tombe sur le tabouret.
const ASSIS_Y = -0.87;

function makePatron(kind, tunicC) {
  const g = new THREE.Group();
  const skinC = [SKIN, 0xd39d7a, 0xe6b898][kind % 3], skin = mat(skinC, { roughness: 0.65 }), tunic = mat(tunicC, { roughness: 0.9 });
  g.add(makeTorso({ top: tunic, bottom: mat(0x3a2a1a), belt: mat(0x2a1a10), width: 1.15 }));
  const headG = makeHead({ skin: skinC, hair: [0x5a3a1a, 0x1a1210, 0xc8a060][kind % 3], style: ['short', 'bald', 'long'][kind % 3], beard: kind === 0 ? 0x5a3a1a : null, moustache: kind === 1 ? 0x1a1210 : null, iris: 0x4a3a2a });
  headG.position.set(0, 2.4, 0); g.add(headG); const head = headG;
  if (kind === 1) { g.add(mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 12), mat(0x2a2a2a), 0, 2.78, 0)); g.add(mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.32, 12), mat(0x2a2a2a), 0, 2.96, 0)); }
  const legs = []; for (const sx of [-1, 1]) { const hip = makeLeg(sx, { cloth: mat(0x3a2a1a), boot: mat(0x2a1a10) }); hip.position.set(sx * 0.17, 0.95, 0); g.add(hip); legs.push(hip); }
  const arms = []; for (const sx of [-1, 1]) { const sh = makeArm(sx, { skin, sleeve: tunic }); sh.position.set(sx * 0.48, 1.95, 0); g.add(sh); arms.push(sh); }
  g.userData = { legs, arms, head, dynamic: true, anim: rand(0, 10) };
  return g;
}

// =====================================================================
//  Matières
// =====================================================================
// Même leçon que dans les galeries : les photos Poly Haven ont un albédo sombre,
// on les remonte par un GAIN sur la couleur plutôt que de les teinter vers le gris.
let MT = null;
function matieres() {
  if (MT) return MT;
  const gain = (m, r, g = r, b = r) => { m.color.setRGB(r, g, b); return m; };
  MT = {
    plancher: gain(phMat('wood_planks', W, D), 1.15, 1.05, 0.92),
    enduit: gain(phMat('chaux_craquelee', 2.2, H * 0.55), 0.78, 0.71, 0.58),
    lambris: gain(phMat('wood_cabinet_worn_long', 2.2, 1.15), 1.55, 1.7, 2.1),
    chene: gain(phMat('wood_cabinet_worn_long', 1.6, 0.5), 1.35, 1.5, 1.9),
    poutre: gain(phMat('wood_cabinet_worn_long', 4, 0.42), 1.15, 1.3, 1.65),
    plafond: gain(phMat('wood_planks', 3, 3), 0.62, 0.56, 0.48),
    brique: gain(phMat('red_bricks_02', 1.8, 1.8), 1.55, 1.05, 0.78),
    dalle: gain(phMat('worn_tile_floor', 2.2, 2.2), 2.0, 1.95, 1.85),
    pierre: gain(phMat('chaux_craquelee', 1.2, 0.5), 0.9, 0.89, 0.85),
    zinc: mat(0xa9a49c, { metalness: 0.12, roughness: 0.42 }),
    fonte: mat(0x2e2c2e, { metalness: 0.3, roughness: 0.6 }),
    laiton: LAITON(),
    suie: mat(0x1a1714, { roughness: 1 }),
    verre: mat(0xdde9ef, { roughness: 0.06, metalness: 0, transparent: true, opacity: 0.17, side: THREE.DoubleSide }),
    braise: new THREE.MeshBasicMaterial({ color: 0xff5a14 }),
    flamme: new THREE.MeshBasicMaterial({ color: 0xffa83c }),
  };
  MT.rais = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, alphaMap: degradeAxe() });
  MT.poussiere = new THREE.PointsMaterial({ color: 0xffe6c0, size: 0.03, sizeAttenuation: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, map: rondFlou() });
  MT.vueRue = new THREE.MeshBasicMaterial({ map: vueDeLaRue() });
  return MT;
}
function rondFlou() {
  const [c, g] = [document.createElement('canvas'), null]; c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}
function degradeAxe() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#8a8a8a'); gr.addColorStop(1, '#0a0a0a');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  return new THREE.CanvasTexture(c);
}
// Ce qu'on voit par la vitre : la maison d'en face, floue. Sans elle, une fenêtre
// n'est qu'un rectangle lumineux — avec elle, la salle a une rue dehors.
function vueDeLaRue() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const ciel = g.createLinearGradient(0, 0, 0, 88);
  ciel.addColorStop(0, '#8fb6dd'); ciel.addColorStop(1, '#dfe8ee');
  g.fillStyle = ciel; g.fillRect(0, 0, 256, 88);
  g.fillStyle = '#6d4436'; g.beginPath(); g.moveTo(-10, 88); g.lineTo(86, 26); g.lineTo(182, 88); g.closePath(); g.fill();   // pignon d'en face
  g.fillStyle = '#9c6a52'; g.fillRect(0, 84, 256, 132);                                   // façade de brique
  for (let y = 84; y < 216; y += 7) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y, 256, 1); }
  g.fillStyle = '#3a4048'; g.fillRect(30, 104, 46, 56); g.fillRect(152, 104, 46, 56);      // ses fenêtres
  g.fillStyle = '#c8b48c'; g.fillRect(28, 99, 50, 6); g.fillRect(150, 99, 50, 6);
  g.fillStyle = '#8a5a48'; g.fillRect(96, 150, 42, 66);                                    // une porte
  g.fillStyle = '#5b5348'; g.fillRect(0, 216, 256, 40);                                    // la rue
  g.globalAlpha = 0.5; g.filter = 'blur(3px)';
  g.drawImage(c, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// =====================================================================
//  Gros œuvre
// =====================================================================
// Un mur avec ses baies : on ne pose pas une fenêtre SUR un mur plein, on bâtit le
// mur autour du vide — trumeaux, allège, linteau. Sinon le parement passe devant.
function murAvecBaies(ax, az, bx, bz, baies) {
  const M = matieres();
  const L = Math.hypot(bx - ax, bz - az), yaw = -Math.atan2(bz - az, bx - ax);
  const dx = (bx - ax) / L, dz = (bz - az) / L;
  const poser = (u0, u1, y0, y1) => {
    if (u1 - u0 < 0.01 || y1 - y0 < 0.01) return;
    const uc = (u0 + u1) / 2;
    const o = mesh(new THREE.BoxGeometry(u1 - u0, y1 - y0, EP), M.enduit, ax + dx * uc, (y0 + y1) / 2, az + dz * uc);
    o.rotation.y = yaw; o.receiveShadow = true; put(o);
  };
  const tri = (baies || []).slice().sort((p, q) => p.u - q.u);
  let u = 0;
  for (const b of tri) {
    poser(u, b.u - b.w / 2, 0, H);
    poser(b.u - b.w / 2, b.u + b.w / 2, 0, b.y0);
    poser(b.u - b.w / 2, b.u + b.w / 2, b.y0 + b.h, H);
    u = b.u + b.w / 2;
  }
  poser(u, L, 0, H);
}

// Fenêtre à petits bois : dormant, croisillons de plomb, appui, volets intérieurs
// rabattus, rideau bas — et la rue au fond. Le groupe regarde vers l'intérieur.
function fenetre(x, z, yaw, w, h, y0) {
  const M = matieres();
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; put(g);
  const A = (geo, m, px, py, pz) => { const o = mesh(geo, m, px, py, pz); g.add(o); return o; };
  // ébrasement : les tableaux s'évasent vers l'intérieur, c'est ce qui donne l'épaisseur du mur
  for (const sx of [-1, 1]) A(new THREE.BoxGeometry(0.1, h + 0.1, EP), M.pierre, sx * (w / 2 + 0.04), y0 + h / 2, -EP / 2 + 0.02);
  A(new THREE.BoxGeometry(w + 0.2, 0.1, EP), M.pierre, 0, y0 + h + 0.05, -EP / 2 + 0.02);
  A(new THREE.BoxGeometry(w + 0.34, 0.12, EP + 0.16), M.pierre, 0, y0 - 0.06, -EP / 2 + 0.06);         // appui
  // dormant et petits bois
  A(new THREE.BoxGeometry(w + 0.12, 0.09, 0.1), M.chene, 0, y0 + h, -EP + 0.12);
  A(new THREE.BoxGeometry(w + 0.12, 0.09, 0.1), M.chene, 0, y0, -EP + 0.12);
  for (const sx of [-1, 1]) A(new THREE.BoxGeometry(0.09, h, 0.1), M.chene, sx * w / 2, y0 + h / 2, -EP + 0.12);
  A(new THREE.BoxGeometry(0.07, h, 0.09), M.chene, 0, y0 + h / 2, -EP + 0.12);
  for (let k = 1; k <= 3; k++) A(new THREE.BoxGeometry(w, 0.05, 0.08), FERN(), 0, y0 + h * k / 4, -EP + 0.12);
  A(new THREE.PlaneGeometry(w - 0.06, h - 0.06), M.verre, 0, y0 + h / 2, -EP + 0.17);
  // la rue, au fond de la baie
  A(new THREE.PlaneGeometry(w + 0.3, h + 0.3), M.vueRue, 0, y0 + h / 2, -EP - 0.02);
  // volets intérieurs rabattus contre le mur
  for (const sx of [-1, 1]) {
    const v = makeVolet(w * 0.52, h, 0x3f5a46, sx, false);
    v.position.set(sx * (w / 2 + w * 0.27), y0, -EP + 0.2); v.rotation.y = sx * 1.9; g.add(v);
  }
  // rideau bas : une bande de toile tendue sur sa tringle
  A(new THREE.BoxGeometry(w + 0.16, 0.035, 0.035), LAITON(), 0, y0 + h * 0.36, -EP + 0.22);
  A(new THREE.PlaneGeometry(w + 0.06, h * 0.34), mat(0xe8dcc2, { roughness: 1, transparent: true, opacity: 0.72, side: THREE.DoubleSide }), 0, y0 + h * 0.18, -EP + 0.23);
  return g;
}

// Rai de soleil : un prisme ouvert, dégradé sur sa longueur. Le même vocabulaire que
// les puits de lumière des galeries — une pièce éclairée par ses fenêtres se voit.
function raiDeSoleil(x, y, z, cible, larg, haut) {
  const M = matieres();
  const g = new THREE.Group(); g.position.set(x, y, z); g.lookAt(cible[0], cible[1], cible[2]); put(g);
  const L = Math.hypot(cible[0] - x, cible[1] - y, cible[2] - z);
  const p = mesh(new THREE.CylinderGeometry(larg * 0.72, haut * 0.95, L, 4, 1, true), M.rais, 0, 0, L / 2);
  p.rotation.x = Math.PI / 2; p.rotation.y = Math.PI / 4; p.renderOrder = 3; g.add(p);
  raisSoleil.push(g);
  return g;
}

function build() {
  const M = matieres();
  makeSky(0x4a78b8, 0x9fc4e8, 0xe8e2d8, true);
  scene.fog = null;
  hemi.intensity = 0.32; hemi.color.setHex(0xffe0b4); hemi.groundColor.setHex(0x4a3524);
  sun.intensity = 1.6; sun.position.set(-7, 8, 17); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 44 });
  sun.shadow.camera.updateProjectionMatrix(); sun.shadow.mapSize.set(2048, 2048);
  renderer.toneMappingExposure = 1.02; bloom.strength = 0.22;
  G.camBack = 4.4; G.camUp = 2.3; G.camMaxY = H - 0.55;
  scene.add(room);

  // ---------- sol, plafond, poutraison ----------
  const sol = new THREE.Mesh(new THREE.BoxGeometry(W, 0.24, D), M.plancher); sol.position.y = -0.12; sol.receiveShadow = true; put(sol);
  const plaf = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, D), M.plafond); plaf.position.y = H + 0.08; put(plaf);
  // deux maîtresses-poutres dans le sens de la profondeur, solives en travers tous les 55 cm
  for (const px of [-W / 4, W / 4]) put(mesh(new THREE.BoxGeometry(0.28, 0.34, D), M.poutre, px, H - 0.17, 0));
  for (let k = -Math.floor(D / 1.1); k <= Math.floor(D / 1.1); k++) put(mesh(new THREE.BoxGeometry(W, 0.14, 0.13), M.poutre, 0, H - 0.07, k * 0.55));

  // ---------- murs : baies déclarées, le mur se bâtit autour ----------
  const DP = 1.6, FH = 1.5, FY = 1.05;                        // largeur de porte, hauteur/allège des fenêtres
  murAvecBaies(-W / 2, D / 2, W / 2, D / 2, [                 // façade sur rue (sud)
    { u: W / 2, w: DP, y0: 0, h: 2.7 },
    { u: W / 2 - 3.3, w: 1.45, y0: FY, h: FH },
    { u: W / 2 + 3.3, w: 1.45, y0: FY, h: FH },
  ]);
  murAvecBaies(W / 2, -D / 2, W / 2, D / 2, [{ u: D / 2 + 1.3, w: 1.2, y0: FY + 0.15, h: 1.25 }]);   // pignon est : une baie sur la cour
  murAvecBaies(-W / 2, -D / 2, -W / 2, D / 2, []);            // pignon ouest : la cheminée
  murAvecBaies(-W / 2, -D / 2, W / 2, -D / 2, []);            // mur du fond (nord) : le comptoir
  for (const [ax, az, bx, bz] of [[-W / 2, -D / 2, -0.85, D / 2], [0.85, D / 2, W / 2, D / 2], [-W / 2, -D / 2, W / 2, -D / 2], [-W / 2, -D / 2, -W / 2, D / 2], [W / 2, -D / 2, W / 2, D / 2]]) cap(ax, az, bx, bz, EP / 2);
  // lambris d'appui et pans de bois : l'intérieur flamand n'est pas un enduit nu
  const murs = [[-W / 2, -D / 2, W / 2, -D / 2], [-W / 2, D / 2, W / 2, D / 2], [-W / 2, -D / 2, -W / 2, D / 2], [W / 2, -D / 2, W / 2, D / 2]];
  for (const [ax, az, bx, bz] of murs) {
    const len = Math.hypot(bx - ax, bz - az), yaw = -Math.atan2(bz - az, bx - ax);
    const lam = mesh(new THREE.BoxGeometry(len, 1.12, 0.09), M.lambris, (ax + bx) / 2, 0.56, (az + bz) / 2); lam.rotation.y = yaw; put(lam);
    const cim = mesh(new THREE.BoxGeometry(len, 0.09, 0.14), M.chene, (ax + bx) / 2, 1.16, (az + bz) / 2); cim.rotation.y = yaw; put(cim);
    const n = Math.max(2, Math.round(len / 2.1));
    for (let k = 0; k <= n; k++) {
      const t = k / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const po = mesh(new THREE.BoxGeometry(0.17, H - 1.2, 0.1), M.chene, px, 1.2 + (H - 1.2) / 2, pz); po.rotation.y = yaw; put(po);
    }
    const sab = mesh(new THREE.BoxGeometry(len, 0.16, 0.12), M.chene, (ax + bx) / 2, H - 0.32, (az + bz) / 2); sab.rotation.y = yaw; put(sab);
  }

  // ---------- porte sur la rue : la même que sur la façade (menuiserie.js) ----------
  const porte = makeDoor(DP - 0.1, 2.7, { color: 0x6e2b28, recess: 0.24, ouvert: 0.0, sansCale: true });
  porte.position.set(0, 0, D / 2 - EP / 2 + 0.02); porte.rotation.y = Math.PI; porte.scale.setScalar(1 / SC); put(porte);
  put(mesh(new THREE.BoxGeometry(DP + 0.5, 0.1, 0.7), M.pierre, 0, 0.04, D / 2 - 0.3));      // seuil usé
  put(mesh(new THREE.PlaneGeometry(DP, 2.4), M.vueRue, 0, 1.3, D / 2 + 0.02));
  addInteract({ pos: V(0, 0, D / 2 - 1.0), r: 1.6 * SC, prompt: () => "sortir de l'estaminet", fn: () => goToLevel(EXIT.level, EXIT.pos, EXIT.yaw, 'Camille ressort sur la place…') });

  // ---------- fenêtres et lumière du jour ----------
  fenetre(-3.3, D / 2, Math.PI, 1.45, FH, FY);
  fenetre(3.3, D / 2, Math.PI, 1.45, FH, FY);
  fenetre(W / 2, 1.3, -Math.PI / 2, 1.2, 1.25, FY + 0.15);
  for (const fx of [-3.3, 3.3]) {
    raiDeSoleil(fx, FY + FH / 2, D / 2 - EP, [fx + 1.7, 0, D / 2 - EP - 4.6], 1.3, 1.55);
    const l = new THREE.PointLight(0xffe7c0, 7, 9, 1.6); l.position.set(fx, FY + FH * 0.6, D / 2 - 0.9); put(l);
  }
  // poussière dans les rais
  { const n = 150, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = rand(-W / 2 + 1, W / 2 - 1); pos[i * 3 + 1] = rand(0.4, H - 0.6); pos[i * 3 + 2] = rand(-D / 2 + 1, D / 2 - 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    poussiere = new THREE.Points(geo, M.poussiere); poussiere.userData.dynamic = true; put(poussiere); }

  // ---------- comptoir de zinc (mur nord) ----------
  const bx = 1.9, bz = -D / 2 + 1.95, bl = 5.8;
  put(mesh(new THREE.BoxGeometry(bl, 1.02, 0.72), M.lambris, bx, 0.51, bz));
  put(mesh(new THREE.BoxGeometry(bl + 0.24, 0.07, 0.92), M.zinc, bx, 1.06, bz));                 // le zinc
  put(mesh(new THREE.BoxGeometry(bl + 0.24, 0.05, 0.05), M.chene, bx, 1.0, bz + 0.45));
  put(mesh(new THREE.BoxGeometry(bl - 0.4, 0.05, 0.05), LAITON(), bx, 0.16, bz + 0.5));          // barre de pied
  for (const sx of [-1, 1]) put(mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), LAITON(), bx + sx * (bl / 2 - 0.25), 0.1, bz + 0.5));
  cap(bx - bl / 2, bz, bx + bl / 2, bz, 0.55);
  // tireuse à bière et son égouttoir
  put(mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.62, 10), LAITON(), bx + 2.3, 1.4, bz - 0.14));
  put(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.1), LAITON(), bx + 2.3, 1.72, bz - 0.02));
  put(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.3), M.zinc, bx + 2.3, 1.11, bz + 0.06));
  // arrière-bar : étagères, bouteilles, miroir
  put(mesh(new THREE.BoxGeometry(bl + 0.6, 2.45, 0.36), M.lambris, bx, 1.3, -D / 2 + 0.3));
  for (let k = 0; k < 3; k++) put(mesh(new THREE.BoxGeometry(bl + 0.4, 0.06, 0.42), M.chene, bx, 1.35 + k * 0.5, -D / 2 + 0.36));
  for (let k = 0; k < 21; k++) {
    const hh = rand(0.26, 0.4);
    put(mesh(new THREE.CylinderGeometry(0.045, 0.055, hh, 8), mat([0x2a6a3a, 0x8a2a2a, 0xc8a060, 0x2a4a7a][k % 4], { roughness: 0.25, transparent: true, opacity: 0.9 }), bx - 2.6 + (k % 7) * 0.9, 1.38 + Math.floor(k / 7) * 0.5 + hh / 2, -D / 2 + 0.36));
  }
  // chopes d'étain suspendues sous l'étagère du haut
  for (let k = 0; k < 7; k++) {
    put(mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.13, 8), M.zinc, bx - 2.4 + k * 0.8, 2.72, -D / 2 + 0.36));
    put(mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 8), M.zinc, bx - 2.4 + k * 0.8 + 0.07, 2.72, -D / 2 + 0.36));
  }
  // tabourets de comptoir
  for (let k = 0; k < 4; k++) {
    const sx = bx - 2.1 + k * 1.4, sz = bz + 1.05;
    if (!prop('props:Stool', sx, 0, sz, rand(0, TAU))) {
      put(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 10), M.chene, sx, 0.62, sz));
      put(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.6, 6), M.lambris, sx, 0.3, sz));
      put(mesh(new THREE.TorusGeometry(0.16, 0.015, 4, 10), M.chene, sx, 0.2, sz).rotateX(Math.PI / 2));
    }
    cap(sx, sz, sx, sz, 0.26);
  }
  for (const x of [-3.9, -2.9]) {                              // futailles en bout de zinc
    if (!prop('props:Barrel_Holder', x, 0, -D / 2 + 0.95, 0)) {
      put(mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.82, 12), M.lambris, x, 0.41, -D / 2 + 0.95));
      put(mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 14), FERN(), x, 0.24, -D / 2 + 0.95).rotateX(Math.PI / 2));
    }
    cap(x, -D / 2 + 0.95, x, -D / 2 + 0.95, 0.4);
  }

  // ---------- tables ----------
  const tables = [[-3.4, 1.9], [0.2, 2.1], [3.5, 1.9], [-3.3, -1.5]];
  const plateau = M.chene;
  for (const [x, z] of tables) {
    put(mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.07, 16), plateau, x, 0.75, z));
    put(mesh(new THREE.CylinderGeometry(0.09, 0.26, 0.72, 8), M.lambris, x, 0.36, z));
    put(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 10), M.lambris, x, 0.04, z));
    cap(x, z, x, z, 0.72);
    for (let k = 0; k < 2; k++) {
      const mx = x + (k ? 0.3 : -0.26), mz = z + (k ? -0.17 : 0.22);
      if (!prop('props:Mug', mx, 0.79, mz, rand(0, TAU)))
        put(mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.14, 8), mat(0xe8c060, { roughness: 0.2, transparent: true, opacity: 0.85 }), mx, 0.86, mz));
    }
    prop('props:Table_Plate', x + 0.04, 0.79, z - 0.34, rand(0, TAU));
    if (prop('props:CandleStick_Triple', x, 0.79, z, rand(0, TAU))) {
      for (const dx of [-0.11, 0, 0.11]) { const f = mesh(sphG(0.028, 6), M.flamme, x + dx, 1.17, z); f.userData.dynamic = true; put(f); }
    } else {
      put(mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.2, 6), mat(0xf0e8d0), x, 0.88, z));
      const f = mesh(sphG(0.032, 6), M.flamme, x, 1.0, z); f.userData.dynamic = true; put(f);
    }
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + 0.4, tx2 = x + Math.cos(a) * 1.06, tz2 = z + Math.sin(a) * 1.06;
      if (!prop('props:Stool', tx2, 0, tz2, a + Math.PI)) {
        put(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), M.chene, tx2, 0.45, tz2));
        for (let j = 0; j < 3; j++) { const b = j * TAU / 3; put(mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.44, 5), M.lambris, tx2 + Math.cos(b) * 0.13, 0.22, tz2 + Math.sin(b) * 0.13)); }
      }
    }
  }
  const seated = [[-3.4, 1.9, 0, 0x8a3a2a], [0.2, 2.1, 1, 0x2a4a7a], [3.5, 1.9, 2, 0x4a6a3a], [-3.3, -1.5, 1, 0x7a3a6a]];
  seated.forEach(([x, z, kind, col], i) => {
    // riggés comme les villageois, assis par leur clip ; les primitives ne restent qu'en repli
    const rig = PNJ.buildRole(i === 3 ? 'braconnier' : 'client' + kind);
    const pt = rig || makePatron(kind, col); const a = i * 1.9 + 0.4;
    pt.position.set(x + Math.cos(a) * 1.06, 0, z + Math.sin(a) * 1.06);
    pt.rotation.y = Math.atan2(x - pt.position.x, z - pt.position.z);
    if (rig) pt.position.y = ASSIS_Y;
    else {
      pt.userData.legs.forEach(l => { l.rotation.x = -1.4; l.userData.knee.rotation.x = 1.4; });
      pt.position.y = -0.55; pt.userData.arms[1].rotation.x = -0.9; pt.userData.arms[1].userData.elbow.rotation.x = -1.4;
    }
    put(pt); patrons.push(pt); cap(pt.position.x, pt.position.z, pt.position.x, pt.position.z, 0.4);
  });

  // ---------- cheminée (pignon ouest) ----------
  const hx = -W / 2 + EP / 2, hz = 0;
  // On bâtit l'âtre AUTOUR du vide — fond, deux jouées, manteau — comme les niches
  // des galeries. Une boîte pleine avec une boîte noire dedans ne creuse rien.
  const OW = 1.7, OH = 1.65, OP = 0.62;                                                                   // ouverture : largeur, hauteur, profondeur
  put(mesh(new THREE.BoxGeometry(0.26, 2.6, 2.9), M.brique, hx + 0.13, 1.3, hz));                          // fond
  put(mesh(new THREE.PlaneGeometry(2.75, 2.4), M.suie, hx + 0.27, 1.2, hz).rotateY(Math.PI / 2));          // fond suié
  for (const sz of [-1, 1]) {                                                                              // jouées
    put(mesh(new THREE.BoxGeometry(OP, OH, (2.9 - OW) / 2), M.brique, hx + 0.26 + OP / 2, OH / 2, hz + sz * (OW + (2.9 - OW) / 2) / 2));
    put(mesh(new THREE.PlaneGeometry(OP - 0.04, OH - 0.04), M.suie, hx + 0.27 + OP / 2, OH / 2, hz + sz * OW / 2).rotateY(sz > 0 ? Math.PI : 0));
  }
  put(mesh(new THREE.BoxGeometry(OP, 2.6 - OH, 2.9), M.brique, hx + 0.26 + OP / 2, OH + (2.6 - OH) / 2, hz));   // manteau
  put(mesh(new THREE.BoxGeometry(OP + 0.16, 0.2, OW + 0.5), M.pierre, hx + 0.3 + OP / 2, OH + 0.06, hz));      // linteau de pierre
  put(mesh(new THREE.BoxGeometry(OP + 0.34, 0.12, 2.7), M.chene, hx + 0.36 + OP / 2, OH + 0.35, hz));          // tablette de cheminée
  put(mesh(new THREE.BoxGeometry(1.5, 0.08, 2.9), M.dalle, hx + 0.75, 0.04, hz));                              // dalle d'âtre
  // potence, crémaillère et marmite
  put(mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), FERN(), hx + 0.22, 1.2, hz - 0.9));
  put(mesh(new THREE.BoxGeometry(0.04, 0.04, 1.1), FERN(), hx + 0.22, 1.85, hz - 0.35));
  for (let k = 0; k < 5; k++) put(mesh(new THREE.TorusGeometry(0.045, 0.012, 4, 8), FERN(), hx + 0.22, 1.74 - k * 0.09, hz + 0.18));
  if (!prop('props:Cauldron', hx + 0.72, 0.08, hz + 0.55, 0.4)) put(mesh(new THREE.SphereGeometry(0.24, 12, 10, 0, TAU, 0, 1.9), FERN(), hx + 0.72, 0.32, hz + 0.55));
  // bûches, braises, flamme
  for (let k = 0; k < 4; k++) {
    const b = mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.78, 7), M.lambris, hx + 0.6, 0.12 + (k === 3 ? 0.13 : 0), hz - 0.22 + k * 0.16);
    b.rotation.set(0, k * 0.4 - 0.6, Math.PI / 2 + (k === 3 ? 0.2 : 0)); put(b);
  }
  braise = mesh(new THREE.BoxGeometry(0.5, 0.06, 0.9), M.braise, hx + 0.6, 0.09, hz); braise.userData.dynamic = true; put(braise);
  fire = makeTorch(); fire.position.set(hx + 0.6, 0.22, hz);
  fire.children[0].visible = false; fire.children[1].visible = false;
  fire.userData.flame.visible = false;                       // la boule du moteur ne fait pas un feu de bûches
  // six langues de feu additives, de hauteurs et de phases différentes : c'est le
  // décalage entre elles qui donne le mouvement, pas la pulsation d'une seule forme
  for (let k = 0; k < 6; k++) {
    const chaud = k % 2 === 0;
    const m2 = new THREE.MeshBasicMaterial({ color: chaud ? 0xffc451 : 0xff6a1e, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const f = mesh(new THREE.ConeGeometry(0.075 + Math.random() * 0.05, 0.36 + Math.random() * 0.26, 6), m2, rand(-0.2, 0.2), 0.22, rand(-0.34, 0.34));
    f.userData.dynamic = true; f.userData.phase = rand(0, 6); f.userData.h0 = f.scale.y;
    flammes.push(f); put(f);
  }
  fire.userData.light.intensity = 14; fire.userData.light.distance = 13; fire.userData.light.color.setHex(0xff7a28);
  put(fire);
  cap(hx + 0.5, hz - 1.4, hx + 0.5, hz + 1.4, 0.55);
  // chien de foyer, soufflet, seau à charbon, et le chat de la maison
  for (const sz of [-0.45, 0.45]) put(mesh(new THREE.BoxGeometry(0.5, 0.07, 0.05), FERN(), hx + 0.62, 0.16, hz + sz));
  put(mesh(new THREE.BoxGeometry(0.1, 0.34, 0.24), M.lambris, hx + 1.15, 0.2, hz + 1.5));
  chat = makeCat ? makeCat() : null;
  if (chat) { chat.position.set(hx + 1.5, 0, hz + 0.75); chat.rotation.y = -1.1; chat.userData.dynamic = true; put(chat); }

  // ---------- poêle de fonte (pignon est) ----------
  { const px = W / 2 - 0.75, pz = -2.4;
    put(mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.05, 12), M.fonte, px, 0.52, pz));
    put(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.07, 12), M.fonte, px, 1.09, pz));
    put(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8), M.fonte, px, 2.3, pz));
    put(mesh(new THREE.BoxGeometry(0.62, 0.06, 0.62), M.fonte, px, 0.03, pz));
    const porte2 = mesh(new THREE.BoxGeometry(0.06, 0.3, 0.34), M.braise, px - 0.34, 0.5, pz); porte2.userData.dynamic = true; put(porte2);
    cap(px, pz, px, pz, 0.42);
  }

  // ---------- garniture Fantasy Props ----------
  if (PROPS_OK) {
    prop('props:Pot_1', hx + 1.2, 0, hz - 1.5, -0.5);
    for (const sx of [-1, 1]) {
      prop('props:Lantern_Wall', sx * 3.2, 2.15, D / 2 - EP - 0.06, Math.PI);
      const l = new THREE.PointLight(0xffc27a, 2.4, 6, 1.7); l.position.set(sx * 3.2, 2.35, D / 2 - 0.85); put(l);
      put(mesh(sphG(0.04, 6), M.flamme, sx * 3.2, 2.35, D / 2 - 0.72));
    }
    prop('props:Shelf_Small_Bottles', bx - 2.2, 1.85, -D / 2 + 0.36, 0);
    prop('props:SmallBottles_1', bx + 1.9, 1.1, bz - 0.2, 0.4);
    prop('props:Bottle_1', bx + 2.1, 1.1, bz - 0.06, -0.2);
    prop('props:Chalice', bx + 1.3, 1.1, bz + 0.12, 0.8);
    for (let k = 0; k < 3; k++) prop('props:Mug', bx - 1.2 + k * 0.4, 1.1, bz - 0.16, rand(0, TAU));
    prop('props:Chest_Wood', W / 2 - 0.9, 0, -D / 2 + 1.0, -0.35); cap(W / 2 - 0.9, -D / 2 + 1.0, W / 2 - 0.9, -D / 2 + 1.0, 0.45);
    prop('props:Barrel', W / 2 - 0.8, 0, D / 2 - 1.1, 0.2); cap(W / 2 - 0.8, D / 2 - 1.1, W / 2 - 0.8, D / 2 - 1.1, 0.32);
    prop('props:Bag', -W / 2 + 1.0, 0, D / 2 - 1.1, 0.6);
  }

  // ---------- Gustave et les enseignes de la maison ----------
  // riggé, il fait face à la salle : l'ancien, tourné de π, servait le mur
  const gustave = PNJ.buildRole('aubergiste');
  barman = gustave || makePatron(0, 0xf0e6d0); barman.position.set(bx - 0.3, 0, bz - 0.82); barman.rotation.y = gustave ? 0 : Math.PI; put(barman);
  if (barman.userData.arms) { barman.userData.arms[0].rotation.x = -0.6; barman.userData.arms[0].userData.elbow.rotation.x = -1.2; }
  addInteract({ pos: V(bx - 0.3, 0, bz + 1.25), r: 2.0 * SC, prompt: () => 'commander une gaufre au patron', fn: commanderGaufre });
  // lustre à bougies
  const lustre = new THREE.Group(); lustre.position.set(-0.4, H - 1.05, 1.2); put(lustre);
  lustre.add(mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 20), FERN(), 0, 0, 0).rotateX(Math.PI / 2));
  lustre.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.05, 4), FERN(), 0, 0.52, 0));
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8;
    lustre.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.19, 6), mat(0xf0e8d0), Math.cos(a) * 0.62, 0.12, Math.sin(a) * 0.62));
    lustre.add(mesh(sphG(0.033, 6), M.flamme, Math.cos(a) * 0.62, 0.26, Math.sin(a) * 0.62));
  }
  if (PROPS_OK) { const ch = prop('props:Chandelier', -0.4, H - 1.1, 1.2); if (ch) lustre.visible = false; }
  const lamp = new THREE.PointLight(0xffd8a0, 6, 12, 1.6); lamp.position.set(-0.4, H - 1.2, 1.2); put(lamp);
  // jambons et bouquet de houblon à la poutre
  for (let k = 0; k < 3; k++) {
    const jx = -1.4 + k * 1.1;
    put(mesh(capG(0.14, 0.34, 8), mat(0x9a4a3a, { roughness: 0.8 }), jx, H - 0.72, -D / 2 + 1.5));
    put(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 4), mat(0xd0c0a0), jx, H - 0.42, -D / 2 + 1.5));
  }
  // cible de fléchettes et planche de javelot (pignon est)
  { const dx2 = W / 2 - EP / 2 - 0.02;
    const dart = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20), mat(0x2a2a2a), dx2, 1.95, 2.6); dart.rotation.z = Math.PI / 2; put(dart);
    for (let k = 0; k < 3; k++) { const ring = mesh(new THREE.CylinderGeometry(0.27 - k * 0.09, 0.27 - k * 0.09, 0.02, 20), mat(k % 2 ? 0xc22a2a : 0xf0e6d0), dx2 - 0.02, 1.95, 2.6); ring.rotation.z = Math.PI / 2; put(ring); }
    for (let k = 0; k < 3; k++) { const dt = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.26, 4), FERN(), dx2 - 0.14, 1.95 + rand(-0.14, 0.14), 2.6 + rand(-0.14, 0.14)); dt.rotation.z = Math.PI / 2; put(dt); }
  }
  // ardoise du menu, près du zinc
  { const c = document.createElement('canvas'); c.width = 256; c.height = 192;
    const cg = c.getContext('2d'); cg.fillStyle = '#1e2420'; cg.fillRect(0, 0, 256, 192);
    cg.fillStyle = '#f0e6c8'; cg.font = 'bold 21px serif'; cg.textAlign = 'center';
    cg.fillText('— MENU DU JOUR —', 128, 32); cg.font = '19px serif';
    ['Gaufre de Camille ...... 0 fl', 'Carbonnade ................. 3 fl', 'Welsh au maroilles ...... 4 fl', 'Bière de la citadelle .... 1 fl'].forEach((t, i) => cg.fillText(t, 128, 70 + i * 29));
    const menuTex = new THREE.CanvasTexture(c); menuTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.12), new THREE.MeshStandardMaterial({ map: menuTex, roughness: 1 }));
    board.position.set(-3.4, 2.05, -D / 2 + 0.5); put(board);
    put(mesh(new THREE.BoxGeometry(1.64, 1.26, 0.06), M.chene, -3.4, 2.05, -D / 2 + 0.46));
  }
  seraphin();
}

// Séraphin, le braconnier attablé au fond — c'est LE seul indice du jeu sur la
// chaumière du vieux mage. Rien d'autre ne la signale : ni la carte, ni le journal,
// ni un chemin. Tant qu'on ne lui a pas parlé, la clairière se trouve au hasard.
function seraphin() {
  const sf = patrons[3];
  addInteract({ pos: V(sf.position.x, 0, sf.position.z), r: 2.0 * SC,
    prompt: () => 'parler au vieux braconnier',
    fn: () => {
      sf.userData.talk = 4;
      const lines = state.mageHeart
        ? [{ who: 'S\u00e9raphin', text: "\u00ab Alors, tu l'as trouv\u00e9, le vieux ? Je te l'avais bien dit qu'il existait. Personne ne me croit, ici. \u00bb" }]
        : state.mageIndice
          ? [{ who: 'S\u00e9raphin', text: "\u00ab Plein ouest, derri\u00e8re la maison de Camille, tout au fond du bois. Une clairi\u00e8re ronde, une chemin\u00e9e qui fume vert. Tu ne peux pas la rater \u2014 si tu la trouves. \u00bb" }]
          : [{ who: 'S\u00e9raphin', text: "\u00ab Moi, je pose mes collets loin. Tr\u00e8s loin \u00e0 l'ouest, au fond du bois, l\u00e0 o\u00f9 les arbres se serrent \u00e0 ne plus passer entre deux troncs. \u00bb" },
             { who: 'S\u00e9raphin', text: "\u00ab Et l'autre matin, j'ai vu une fum\u00e9e. Verte, la fum\u00e9e ! Il y a une chaumi\u00e8re l\u00e0-bas, dans une clairi\u00e8re toute ronde. On dit que c'est le vieux mage, celui qui a connu Vauban. \u00bb" },
             { who: 'S\u00e9raphin', text: "\u00ab Vas-y donc, toi qui n'as peur de rien. Moi, j'ai ramass\u00e9 mes collets et je suis rentr\u00e9 boire. \u00bb",
               fn: () => { state.mageIndice = true; showMessage('Une chaumi\u00e8re au fond du bois, plein ouest : la zone est marqu\u00e9e sur ta carte.', 5); saveGame(true); } }];
      dialogue(lines, () => { sf.userData.talk = 0; });
    } });
}
function commanderGaufre() {
  barman.userData.talk = 4;
  const lines = [];
  if (state.princeFreed) lines.push({ who: 'Gustave', text: "« Le prince est libre ! Ce soir, la tournée est pour la maison. »" });
  else if (!state.metLyderic) lines.push({ who: 'Gustave', text: "« Une gaufre ? Pour la gardienne de la citadelle, c'est offert. Mais file voir Lydéric au pont, il te cherche partout. »" });
  else lines.push({ who: 'Gustave', text: "« Alors, la citadelle ? On dit que Phinaert a enfermé le prince sous les remparts… Tiens, mange, tu es toute pâle. »" });
  if (player.hp >= player.maxHp) lines.push({ who: 'Gustave', text: "« Tu es en pleine forme, Camille ! Reviens quand les fantômes t'auront donné du fil à retordre. »" });
  else lines.push({ who: 'Gustave', text: "« Une gaufre bien chaude, c'est pour la maison. Et bonne chance ! » (+2 cœurs)", fn: () => { player.hp = Math.min(player.maxHp, player.hp + 4); SFX.pickup(); } });
  dialogue(lines, () => { barman.userData.talk = 0; });
}

function populate() { player.pos.set(0, 0, D / 2 - 1.6); player.yaw = Math.PI; G.camYaw = Math.PI; }
// La position d'arrivée est écrite dans village.js (0, 0, 4.4) : à la nouvelle
// profondeur, elle tombe dans l'épaisseur du mur de façade. On la rentre.
function onLoad() {
  const p = player.pos, lim = D / 2 - 1.1;
  if (p.z > lim) p.z = lim;
  if (p.z < -D / 2 + 0.8) p.z = -D / 2 + 0.8;
  p.x = Math.max(-W / 2 + 0.8, Math.min(W / 2 - 0.8, p.x));
}
function animate(now, dt) {
  const d = Math.min(0.05, dt || 0.016);
  if (fire) fire.userData.light.intensity = 14 * (0.84 + Math.sin(now / 40) * 0.16 + Math.sin(now / 137) * 0.06);
  for (const f of flammes) {
    const t = now / 190 + f.userData.phase;
    f.scale.set(0.85 + Math.sin(t * 1.7) * 0.15, 0.8 + Math.sin(t) * 0.35 + Math.sin(t * 2.3) * 0.12, 0.85 + Math.cos(t * 1.3) * 0.15);
    f.rotation.z = Math.sin(t * 0.8) * 0.12;
  }
  if (braise) braise.material.color.setRGB(1, 0.32 + Math.sin(now / 320) * 0.06, 0.06);
  if (poussiere) {                                    // la poussière tourne lentement dans les rais
    const pos = poussiere.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + Math.sin(now / 900 + i) * 0.0016 + 0.0008;
      if (y > H - 0.4) y = 0.35;
      pos.setY(i, y); pos.setX(i, pos.getX(i) + Math.sin(now / 1500 + i * 2.1) * 0.0022);
    }
    pos.needsUpdate = true;
  }
  if (chat) { chat.rotation.z = Math.sin(now / 1400) * 0.02; }
  for (const pt of patrons) {
    const u = pt.userData;
    // riggé : le clip fait tout. Pas de clip « parle » pour lui : il est debout, et un
    // client qui parle se lèverait d'un coup au-dessus de son tabouret
    if (u.perso) { u.talk = 0; PNJ.animeVillageois(pt, d, false); continue; }
    u.anim += d; u.head.rotation.y = Math.sin(u.anim * 0.7) * 0.4; u.arms[1].rotation.x = -0.9 + Math.sin(u.anim * 1.3) * 0.25;
  }
  // `perso` et non le retour d'animeVillageois : le contrôleur arrive après coup, et d'ici là
  // un personnage riggé n'a pas les bras que la branche en primitives irait chercher
  if (barman && barman.userData.perso) { PNJ.animeVillageois(barman, d, false); if (barman.userData.talk > 0) barman.userData.talk -= d; }
  else if (barman) { const u = barman.userData; u.anim += d; u.head.rotation.y = Math.sin(u.anim * 0.5) * 0.3; if (u.talk > 0) { u.talk -= d; u.arms[1].rotation.x = -0.9 + Math.sin(u.anim * 8) * 0.3; } }
}
function minimap(g, W2) {
  const sc = 10.5, P = (x, z) => [W2 / 2 + x * sc, W2 / 2 + z * sc];
  const [x0, z0] = P(-W / 2, -D / 2);
  g.fillStyle = '#7a5a3c'; g.fillRect(x0, z0, W * sc, D * sc);
  g.strokeStyle = '#3a2a1c'; g.lineWidth = 2; g.strokeRect(x0, z0, W * sc, D * sc);
  g.fillStyle = '#a8a2a0'; { const [a, b] = P(-0.9, -D / 2 + 1.55); g.fillRect(a, b, 5.9 * sc, 0.8 * sc); }   // le zinc
  g.fillStyle = '#c04a28'; { const [a, b] = P(-W / 2, -1.5); g.fillRect(a, b, 0.6 * sc, 3 * sc); }            // l'âtre
  g.fillStyle = '#ffe07a'; { const [a, b] = P(-0.8, D / 2 - 0.5); g.fillRect(a, b, 1.6 * sc, 0.4 * sc); }      // la porte
  minimapDots(g, P);
}
const level = {
  name: 'tavern', getH: () => 0, zoneName: () => "L'Estaminet", build, populate, animate, minimap, onLoad,
  entry: () => ({ title: "L'Estaminet", sub: 'Gaufres et bière de la citadelle', cam: [3.6, 2.6, 3.4], at: [-1.5, 1.1, -1.5], cam2: [1.2, 2.0, 3.4], at2: [0, 1.3, 0.5], dur: 3.5 }),
  counts: () => `<small>L'estaminet du village — Gustave, au comptoir, offre une gaufre (Entrée). Les clients attablés ont aussi des choses à raconter. Porte derrière toi pour sortir.</small>`,
  start: () => showMessage("L'estaminet : ça sent la gaufre chaude et la bière de la citadelle. Gustave est au comptoir.", 5),
  arriveMessage: () => "L'estaminet : ça sent la gaufre chaude et la bière de la citadelle. Gustave est au comptoir.",
  onKill: () => {},
};
// Camille riggée si la banque est là, sinon la version en primitives
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
