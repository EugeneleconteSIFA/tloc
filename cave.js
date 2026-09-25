import * as PNJ_E from './engine.js?v=27';
import * as PNJ from './pnj.js';
// The Legend of Camille — niveau 2 : les galeries souterraines de la citadelle
import { THREE, clamp, lerp, rand, TAU, distSeg, scene, camera, G, T, mat, pbr, pbrRepeat, phMat, patiner, uvMeters, makeCanvas, tex, stoneMat, IRON, GOLD, hemi, sun, renderer, bloom,
  mesh, boxG, sphG, capG, world, addCap, addBox, getH, blocked, makeChest, makeGrille, makeTorch, makeLever, SFX, state, player, enemies, pickups,
  spawnEnemy, spawnPickup, spawnGaufre, addInteract, showMessage, burst, saveGame, goToLevel, bootLevel, minimapDots, damagePlayer,
  cut, cutscene, dialogue, followActor, makePrince, makeCage, makeKey } from './engine.js?v=27';
import * as LOOK from './look.js';
import * as BOURSE from './bourse.js';
LOOK.veiller();

// =====================================================================
//  Plan des galeries (1 caractère = 1 dalle de 3 m)
//  # mur   n mur à niche   . sol   P fosse   o puits de lumière   x éboulis
//  S entrée/sortie   R rat   K rat-roi   B chauve-souris   L levier
//  G grille   C coffre   g gaufre   E cage du prince
//
//  Quatre quartiers. Chacun a SA matière, SA voûte et SA lumière : c'est ce qui
//  dit où l'on est quand on ne regarde pas la minimap, et ce qui permet de se
//  rappeler d'où l'on vient.
//    entrée      pierre de taille appareillée, voûtes d'arêtes, jour froid
//    salle       brique, nef à piliers et arcades surbaissées, torches chaudes
//    fosses      brique suintante, berceau, eau verte, fosses noires
//    contre-mine roche brute, boisage de charpente, plafond bas, noir et orange
// =====================================================================
const MAP = [
  '############n##################',
  '#S.....#.........#............#',
  '#....o.n..R...B..#..P.P.P...E.#',
  '#..g...#....o....G..P.P.P..C..#',
  '#......n..B...R..#..P.P.P.K...#',
  '#..##..#.........#.........g..#',
  '#.x##..###.#######............#',
  '#..##.....B.......##n#####n####',
  '#..##......R......#',
  '#.g##.........L...#',
  '#..##.....g.....xx#',
  '########n####n#####',
];
const TS = 3, WALL_H = 5;
const ROWS = MAP.length, COLS = Math.max(...MAP.map(r => r.length));
const tile = (c, r) => (r < 0 || r >= ROWS || c < 0 || c >= COLS) ? '#' : (MAP[r][c] || '#');
const toC = (x) => Math.floor(x / TS + 0.5), toR = (z) => Math.floor(z / TS + 0.5);
const isWall = (c, r) => { const t = tile(c, r); return t === '#' || t === 'n'; };
const isPit = (c, r) => tile(c, r) === 'P';
const V4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const V8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
let cage = null, prince = null, cagePos = null;
let gate, gateCap, lever, chest, startPos, lantern, lastSafe = new THREE.Vector3(3, 0, 3), torches = [];

// Élévations de la galerie. Le berceau a exactement la demi-largeur du couloir :
// il retombe sur le cordon d'imposte, à 3,30 m, et sa clé est à 4,80 m. La caméra
// est bridée sous la clé (G.camMaxY), sinon elle sort par le dessus de la voûte.
const SPRING = 3.3, VR = TS / 2, CLEF = SPRING + VR, MINE_H = 4.4;

const Z_ENTREE = 0, Z_SALLE = 1, Z_FOSSES = 2, Z_MINE = 3;
const ZONE_NOMS = ["Galerie d'entrée", 'Salle des rats', 'Galerie des fosses', 'Contre-mine de Vauban'];
function zoneAt(c, r) {
  if (c <= 6 && r <= 5) return Z_ENTREE;
  if (c >= 8 && c <= 16 && r <= 5) return Z_SALLE;
  if (c >= 18 && r <= 6) return Z_FOSSES;
  return Z_MINE;
}
function zoneName(x, z) { return ZONE_NOMS[zoneAt(toC(x), toR(z))]; }

function levelH(x, z) { return isPit(toC(x), toR(z)) ? -9 : 0; }
function levelBlocked(x, z, r) {
  for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) if (isWall(toC(x + ox), toR(z + oz))) return true;
  return false;
}

// L'itinéraire principal, dalle par dalle. Il ne sert pas au déplacement : il sert
// à décider quelle torche est allumée et laquelle est morte. Une galerie éclairée
// est une galerie où l'on va ; une galerie noire est une impasse. C'est le repère
// le plus lisible qu'on puisse donner sans écrire sur la carte.
const ROUTE = new Set();
for (const [c, r] of [
  [1, 1], [2, 1], [3, 1], [4, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7],          // descente par le couloir EST (celui de l'ouest est bouché)
  [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 8], [12, 8], [13, 9], [14, 9], [14, 10], [15, 10],   // la contre-mine jusqu'à la vanne
  [13, 8], [12, 7], [11, 7], [10, 6], [10, 5], [10, 4], [11, 4], [11, 3], [12, 3], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3],
  [18, 3], [19, 2], [20, 1], [21, 2], [23, 2], [25, 2], [26, 3], [27, 3], [28, 2],
]) ROUTE.add(c + ',' + r);
const surRoute = (c, r) => ROUTE.has(c + ',' + r);

// =====================================================================
//  Matières
// =====================================================================
// Règle 3 du BRIEF-DESIGN : tout se mappe en mètres réels. Les faces de mur font
// 3 × 5,6 m, les dalles 3 × 3 m, et les voûtes portent leurs UV DÉJÀ en mètres
// (uvMeters), d'où le phMat(slug, 1, 1) qui leur est réservé.
let MAT = null;
function materiaux() {
  if (MAT) return MAT;
  const H = WALL_H + 0.6;
  const pat = (m, o) => patiner(m, { echelle: 10, force: 0.32, humide: 2.4, pluie: 0.26, mousse: 0x49563c, ...o });
  // Les photos Poly Haven sont des albédos SOMBRES (gravier 0,30, ruines 0,20 en
  // sRGB). Les teinter d'un gris moyen les multiplie une seconde fois et donne du
  // noir : c'est l'erreur qui a coûté deux passes ici. On fait donc l'inverse — un
  // GAIN au-delà de 1 sur la couleur du matériau, qui remonte l'albédo à un niveau
  // plausible sans toucher à la lumière.
  const gain = (m, r, g = r, b = r) => { m.color.setRGB(r, g, b); return m; };
  MAT = {
    mur: [
      pat(gain(phMat('chaux_craquelee', TS, H), 0.76, 0.75, 0.7)),           // galerie d'entrée : casemate chaulée, la plus claire du niveau
      pat(gain(phMat('church_bricks_03', TS, H), 1.4, 1.28, 1.16)),         // salle : brique de Lille
      pat(gain(phMat('brique_rouge_06', TS, H), 0.98, 1.0, 0.98), { humide: 3.6, force: 0.42, pluie: 0.4, mousse: 0x37554a }),
      pat(gain(phMat('paroi_rocheuse', TS, H), 1.25, 1.2, 1.12), { echelle: 6, force: 0.42, humide: 1.8 }),
    ],
    sol: [
      gain(phMat('worn_tile_floor', TS, TS), 2.3, 2.2, 2.0),
      gain(phMat('gravier', TS, TS), 2.6, 2.3, 1.85),
      gain(phMat('terre_battue', TS, TS), 0.6, 0.62, 0.66),                 // fosses : terre détrempée, presque noire
      gain(phMat('terre_battue', TS, TS), 0.78, 0.74, 0.66),
    ],
    voute: [
      pat(gain(phMat('church_bricks_03', 1, 1, { side: THREE.BackSide }), 1.35, 1.24, 1.12), { humide: 0.1, force: 0.3, pluie: 0 }),
      pat(gain(phMat('brique_rouge_06', 1, 1, { side: THREE.BackSide }), 1.05, 1.0, 0.96), { humide: 0.1, force: 0.3, pluie: 0 }),
      pat(gain(phMat('brique_rouge_06', 1, 1, { side: THREE.BackSide }), 0.8, 0.84, 0.84), { humide: 0.1, force: 0.4, pluie: 0 }),
      pat(gain(phMat('paroi_rocheuse', 1, 1, { side: THREE.BackSide }), 1.2), { humide: 0.1, force: 0.36, pluie: 0 }),
    ],
    // arcs : UV de tore, u le long de l'arc (π·1,5 m), v autour du boudin
    arc: [
      gain(phMat('church_bricks_03', Math.PI * VR, 0.72), 1.3, 1.2, 1.1),
      gain(phMat('brique_rouge_06', Math.PI * VR, 0.72), 1.0, 0.96, 0.92),
      gain(phMat('brique_rouge_06', Math.PI * VR, 0.72), 0.78, 0.8, 0.8),
      gain(phMat('wood_cabinet_worn_long', Math.PI * VR, 0.72), 2.6, 3.2, 4.8),
    ],
  };
  // Bandeaux, socles, encadrements. La tuile doit être PETITE : un bandeau de 46 cm
  // qui n'affiche que 20 % d'une texture de 2,4 m ne montre qu'une traînée étirée —
  // c'est ce qui faisait des triangles noirs au pied des murs.
  MAT.pierre = gain(phMat('chaux_craquelee', 1.2, 0.5), 0.82, 0.81, 0.78);
  MAT.pilier = pat(gain(phMat('church_bricks_03', 0.64, 3.1), 1.4, 1.28, 1.16), { echelle: 8, humide: 1.6, force: 0.28 });
  MAT.puits = gain(phMat('brique_rouge_06', 2.4, 2.4, { side: THREE.BackSide }), 1.15, 1.1, 1.05);
  MAT.roche = gain(phMat('rock_wall_17', TS, 9, { side: THREE.BackSide }), 1.15, 1.12, 1.15);
  MAT.caillou = gain(phMat('rocher_01', 0.8, 0.8), 0.92, 0.88, 0.8);
  MAT.bois = gain(phMat('wood_cabinet_worn_long', 0.35, 4.4), 2.6, 3.2, 5.0);
  MAT.poutre = gain(phMat('wood_cabinet_worn_long', 4, 0.4), 2.4, 3.0, 4.6);
  MAT.planche = gain(phMat('wood_planks', TS, TS), 1.9, 1.8, 1.65);
  MAT.fer = mat(0x5d5a62, { metalness: 0.25, roughness: 0.55 });   // pas d'env map dans ce niveau : un métal trop métallique y est noir
  MAT.suie = mat(0x141210, { roughness: 1 });
  MAT.cire = mat(0xefe6ce, { roughness: 0.6 });
  MAT.os = mat(0xe2d8bc, { roughness: 0.75 });
  MAT.eau = mat(0x14242a, { roughness: 0.18, metalness: 0.25, transparent: true, opacity: 0.86 });
  MAT.goutte = mat(0xbcd8dc, { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75 });
  MAT.flamme = new THREE.MeshBasicMaterial({ color: 0xff8f2e });
  MAT.jour = new THREE.MeshBasicMaterial({ color: 0xe6eeff });
  MAT.noir = new THREE.MeshBasicMaterial({ color: 0x050608 });
  // eau courante du caniveau : la normale défile, c'est ce qui dit le sens de la pente
  const wn = T.waterN.clone(); wn.wrapS = wn.wrapT = THREE.RepeatWrapping; wn.repeat.set(3, 1); wn.needsUpdate = true;
  MAT.eauVive = new THREE.MeshStandardMaterial({ color: 0x1e2d2a, roughness: 0.26, metalness: 0.2, normalMap: wn, normalScale: new THREE.Vector2(0.8, 0.8) });
  MAT.rais = new THREE.MeshBasicMaterial({ color: 0xa8c4ee, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, alphaMap: degradeVertical() });
  MAT.raisFort = MAT.rais.clone(); MAT.raisFort.opacity = 0.26;
  MAT.tache = new THREE.MeshBasicMaterial({ color: 0xc8d8f4, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, map: disqueFlou() });
  MAT.halo = new THREE.MeshBasicMaterial({ color: 0xff9a44, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: disqueFlou() });
  MAT.haloSprite = new THREE.SpriteMaterial({ color: 0xff8a34, map: disqueFlou(), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  MAT.poussiere = new THREE.PointsMaterial({ color: 0xdce8ff, size: 0.055, sizeAttenuation: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: disqueFlou() });
  return MAT;
}
// dégradé vertical pour le cône de lumière : opaque en haut, effacé au sol
function degradeVertical() {
  const [c, g] = makeCanvas(8, 128);
  const gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, '#0e0e0e'); gr.addColorStop(0.25, '#5a5a5a'); gr.addColorStop(1, '#ffffff');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  return tex(c, 1, false);
}
function disqueFlou() {
  const [c, g] = makeCanvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return tex(c, 1, false);
}

// =====================================================================
//  Voûtes
// =====================================================================
// Une voûte d'arêtes est l'intersection de deux berceaux croisés : sa hauteur vaut
// sqrt(r² − max(|u|,|v|)²). Elle retombe donc sur les QUATRE coins de la travée et
// ouvre un arc sur chacun de ses quatre côtés — c'est ce qui fait qu'une salle
// voûtée ne ressemble pas à une tôle ondulée, contrairement à un berceau étiré.
function vouteAreteGeo(h = VR, seg = 10, trou = 0) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= seg; j++) {
    const u = -h + 2 * h * i / seg, v = -h + 2 * h * j / seg;
    const m = Math.max(Math.abs(u), Math.abs(v));
    pos.push(u, Math.sqrt(Math.max(0, h * h - m * m)), v);
    // UV = DÉVELOPPÉ de l'intrados, pas la projection au sol. Dans chaque quadrant
    // la voûte est un berceau : la direction de plus grande valeur absolue se
    // développe en h·asin(x/h), l'autre reste à l'identique. Sans ça, la brique
    // s'étire en traînées verticales près des reins — c'est ce qu'on voyait.
    const dev = (t) => h * Math.asin(clamp(t / h, -1, 1));
    if (Math.abs(u) >= Math.abs(v)) uv.push(dev(u) + h, v + h);
    else uv.push(u + h, dev(v) + h);
  }
  const pas = 2 * h / seg;
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
    if (trou) {                                // on ôte les travées centrales : c'est par là que passe le puits
      const cu = -h + pas * (i + 0.5), cv = -h + pas * (j + 0.5);
      if (Math.hypot(cu, cv) < trou) continue;
    }
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function vouteBerceauGeo() {
  const g = new THREE.CylinderGeometry(VR, VR, TS, 16, 1, true, 0, Math.PI);
  g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2);      // demi-cylindre ouvert vers le bas, axe z
  return uvMeters(g, Math.PI * VR, TS);
}

// =====================================================================
//  Ambiance sonore : la goutte et son écho
// =====================================================================
// Le moteur ne publie pas son AudioContext, et on n'écrit pas dans engine.js : on
// ouvre donc le sien, très bas, et on s'aligne sur la touche M du moteur pour que
// « musique coupée » coupe aussi les gouttes. Tout est sous try : pas de son =
// pas d'erreur.
const audio = { ctx: null, bus: null, echo: null, coupe: false };
function ambianceAudio() {
  if (audio.ctx !== null) return audio;
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const bus = c.createGain(); bus.gain.value = audio.coupe ? 0 : 0.5; bus.connect(c.destination);
    // l'écho de voûte : un retard rebouclé et très filtré, c'est tout ce qu'il faut
    const del = c.createDelay(1.0); del.delayTime.value = 0.26;
    const fb = c.createGain(); fb.gain.value = 0.45;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
    del.connect(lp); lp.connect(fb); fb.connect(del); lp.connect(bus);
    // souffle d'air : bruit brun continu, sous 200 Hz
    const b = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), d = b.getChannelData(0);
    let v = 0; for (let i = 0; i < d.length; i++) { v = v * 0.986 + (Math.random() * 2 - 1) * 0.055; d[i] = v; }
    const src = c.createBufferSource(); src.buffer = b; src.loop = true;
    const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 210;
    const sg = c.createGain(); sg.gain.value = 0.5;
    src.connect(sf).connect(sg).connect(bus); src.start();
    audio.ctx = c; audio.bus = bus; audio.echo = del;
  } catch (e) { audio.ctx = false; }
  return audio;
}
function sonGoutte(dist) {
  const a = ambianceAudio();
  if (!a.ctx || a.coupe) return;
  try {
    const c = a.ctx; if (c.state === 'suspended') c.resume();
    const o = c.createOscillator(), g = c.createGain(), f = 780 + Math.random() * 1100;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(f * 0.32, c.currentTime + 0.085);
    const vol = 0.055 * clamp(1 - dist / 28, 0, 1);
    if (vol < 0.002) return;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0004, c.currentTime + 0.17);
    o.connect(g); g.connect(a.bus); g.connect(a.echo);
    o.start(); o.stop(c.currentTime + 0.19);
  } catch (e) { /* pas de son */ }
}
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyM') return;                       // même touche que la musique du moteur
  audio.coupe = !audio.coupe;
  try { if (audio.bus) audio.bus.gain.setTargetAtTime(audio.coupe ? 0 : 0.5, audio.ctx.currentTime, 0.2); } catch (x) {}
});

// =====================================================================
//  Construction
// =====================================================================
function build() {
  const M = materiaux();
  scene.background = new THREE.Color(0x090a10);
  scene.fog = new THREE.Fog(0x090a10, 12, 54);
  // Sous terre, l'hémisphérique n'est plus le ciel : c'est le rebond des torches.
  // On met donc le CHAUD en haut (il éclaire les sols et les dessus) et le FROID
  // en bas (il éclaire les intrados de voûte, dont la normale pointe vers le sol).
  hemi.intensity = 0.7; hemi.color.setHex(0xd6c3a2); hemi.groundColor.setHex(0x7d8aa2);
  sun.intensity = 0; sun.castShadow = false;
  renderer.toneMappingExposure = 1.3;
  bloom.strength = 0.36;
  G.camBack = 6.2; G.camUp = 3.0; G.camMaxY = CLEF - 0.7;

  // ---------- inventaire des dalles ----------
  const sols = [], fosses = [], murs = [], nichees = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = tile(c, r);
    if (isWall(c, r)) {
      if (!V8.some(([dc, dr]) => !isWall(c + dc, r + dr))) continue;   // mur noyé dans la masse : rien à voir
      if (t === 'n') nichees.push([c, r]); else murs.push([c, r]);
    } else if (t === 'P') fosses.push([c, r]);
    else sols.push([c, r]);
  }
  const dalles = [...sols, ...fosses];

  // ---------- sols ----------
  const solGeo = new THREE.PlaneGeometry(TS, TS);
  for (const [c, r] of dalles) {
    const f = new THREE.Mesh(solGeo, M.sol[zoneAt(c, r)]);
    f.rotation.x = -Math.PI / 2; f.position.set(c * TS, isPit(c, r) ? -9 : 0, r * TS); f.receiveShadow = true; scene.add(f);
  }

  // ---------- murs ----------
  const murGeo = new THREE.BoxGeometry(TS, WALL_H + 0.6, TS);
  for (const [c, r] of murs) {
    const v = V4.find(([dc, dr]) => !isWall(c + dc, r + dr));
    scene.add(mesh(murGeo, M.mur[zoneAt(c + (v ? v[0] : 0), r + (v ? v[1] : 1))], c * TS, (WALL_H + 0.6) / 2, r * TS));
  }
  for (const [c, r] of nichees) construireNiche(c, r, murGeo);

  // plinthe et cordon d'imposte : deux bandeaux de pierre qui donnent au mur son
  // pied et à la voûte sa ligne de retombée. Sans eux, un mur texturé reste une
  // surface ; avec eux, il devient de l'architecture.
  const plinGeo = new THREE.BoxGeometry(TS, 0.46, 0.17), cordGeo = new THREE.BoxGeometry(TS, 0.18, 0.24);
  for (const [c, r] of [...murs, ...nichees]) for (const [dc, dr] of V4) {
    const cc = c + dc, rr = r + dr;
    if (isWall(cc, rr) || isPit(cc, rr)) continue;
    if (zoneAt(cc, rr) === Z_MINE) continue;                            // la contre-mine n'est pas appareillée
    // les bandeaux DÉBORDENT de la face du mur (8 cm) : à fleur, ils se battaient en
    // profondeur avec le parement et laissaient des trous noirs par bandes.
    const rot = dc ? Math.PI / 2 : 0;
    const p = mesh(plinGeo, M.pierre, c * TS + dc * (TS / 2 + 0.06), 0.23, r * TS + dr * (TS / 2 + 0.06)); p.rotation.y = rot; scene.add(p);
    const q = mesh(cordGeo, M.pierre, c * TS + dc * (TS / 2 + 0.08), SPRING - 0.02, r * TS + dr * (TS / 2 + 0.08)); q.rotation.y = rot; scene.add(q);
  }

  // ---------- parois des fosses ----------
  const fosseGeo = new THREE.BoxGeometry(TS, 9, TS);
  for (const [c, r] of fosses) scene.add(mesh(fosseGeo, M.roche, c * TS, -4.5, r * TS));

  // ---------- voûtes ----------
  const areteGeo = vouteAreteGeo(), areteTrouGeo = vouteAreteGeo(VR, 12, 0.8), berceauGeo = vouteBerceauGeo();
  const doubleauGeo = new THREE.TorusGeometry(VR - 0.035, 0.115, 6, 18, Math.PI);
  const areteRibGeo = new THREE.TorusGeometry(VR - 0.02, 0.085, 5, 18, Math.PI); areteRibGeo.scale(Math.SQRT2, 1, 1);
  const plafGeo = new THREE.PlaneGeometry(TS, TS);
  for (const [c, r] of dalles) {
    const z = zoneAt(c, r);
    if (z === Z_MINE) continue;
    const perce = tile(c, r) === 'o' || tile(c, r) === 'E';   // 'E' : la voûte s'est effondrée sur la cage
    // le tympan au-dessus des reins de voûte : de la maçonnerie, sinon on voit
    // un trou noir entre chaque travée
    if (!perce) { const pl = new THREE.Mesh(plafGeo, M.arc[z]); pl.rotation.x = Math.PI / 2; pl.position.set(c * TS, CLEF + 0.03, r * TS); scene.add(pl); }
    const mn = isWall(c, r - 1), ms = isWall(c, r + 1), me = isWall(c + 1, r), mo = isWall(c - 1, r);
    const eo = mn && ms && !(me && mo), ns = me && mo && !(mn && ms);
    if ((eo || ns) && !perce) {
      const v = mesh(berceauGeo, M.voute[z], c * TS, SPRING, r * TS); v.rotation.y = eo ? Math.PI / 2 : 0; scene.add(v);
      const d = mesh(doubleauGeo, M.arc[z], c * TS + (eo ? TS / 2 : 0), SPRING, r * TS + (eo ? 0 : TS / 2)); d.rotation.y = eo ? Math.PI / 2 : 0; scene.add(d);
    } else {
      scene.add(mesh(perce ? areteTrouGeo : areteGeo, M.voute[z], c * TS, SPRING, r * TS));
      for (const sg of [1, -1]) { const a = mesh(areteRibGeo, M.arc[z], c * TS, SPRING, r * TS); a.rotation.y = sg * Math.PI / 4; scene.add(a); }
    }
  }

  // ---------- contre-mine : pas de voûte, du boisage ----------
  for (const [c, r] of dalles) {
    if (zoneAt(c, r) !== Z_MINE) continue;
    const p = new THREE.Mesh(plafGeo, M.planche); p.rotation.x = Math.PI / 2; p.position.set(c * TS, MINE_H, r * TS); scene.add(p);
    if ((c + r) % 2 === 0) scene.add(mesh(new THREE.BoxGeometry(TS, 0.17, 0.24), M.poutre, c * TS, MINE_H - 0.11, r * TS));
  }
  const cadre = (x0, x1, z) => {
    for (const px of [x0, x1]) { scene.add(mesh(new THREE.BoxGeometry(0.26, MINE_H, 0.26), M.bois, px, MINE_H / 2, z)); addCap(px, z, px, z, 0.24); }
    scene.add(mesh(new THREE.BoxGeometry(x1 - x0 + 0.5, 0.26, 0.32), M.poutre, (x0 + x1) / 2, MINE_H - 0.15, z));
  };
  for (const z of [21, 27]) { cadre(1.8, 7.2, z); cadre(13.8, 19.2, z); }   // les deux couloirs de descente
  for (const cx of [7, 10, 13, 16]) for (const rz of [7, 9]) {              // la grande salle basse, étayée
    const px = (cx + 0.5) * TS, pz = (rz + 0.5) * TS;
    scene.add(mesh(new THREE.BoxGeometry(0.28, MINE_H, 0.28), M.bois, px, MINE_H / 2, pz));
    scene.add(mesh(new THREE.BoxGeometry(0.46, 0.22, 0.46), M.poutre, px, MINE_H - 0.13, pz));
    addCap(px, pz, px, pz, 0.26);
  }
  for (const rz of [7, 9]) scene.add(mesh(new THREE.BoxGeometry(31, 0.24, 0.3), M.poutre, 36, MINE_H - 0.16, (rz + 0.5) * TS));

  // ---------- nef de la salle voûtée : deux files de piliers, arcades surbaissées ----------
  const arcadeGeo = new THREE.TorusGeometry(1.3, 0.17, 6, 20, Math.PI); arcadeGeo.scale(3 / 1.3, 1, 1);
  const PX = [28.5, 34.5, 40.5, 46.5], PZ = [4.5, 13.5];
  for (const pz of PZ) {
    for (const px of PX) {
      scene.add(mesh(new THREE.BoxGeometry(0.94, 0.26, 0.94), M.pierre, px, 0.13, pz));
      scene.add(mesh(new THREE.BoxGeometry(0.64, SPRING - 0.5, 0.64), M.pilier, px, 0.26 + (SPRING - 0.5) / 2, pz));
      scene.add(mesh(new THREE.BoxGeometry(0.96, 0.26, 0.96), M.pierre, px, SPRING - 0.11, pz));
      addCap(px, pz, px, pz, 0.46);
    }
    for (let k = 0; k + 1 < PX.length; k++) scene.add(mesh(arcadeGeo, M.arc[Z_SALLE], (PX[k] + PX[k + 1]) / 2, SPRING - 0.02, pz));
  }

  // ---------- caniveau : l'eau descend, et elle descend vers le levier ----------
  // Un fil continu à suivre des yeux depuis l'entrée. Il finit dans un puisard,
  // à deux pas de la vanne de la grille : suivre l'eau, c'est trouver le levier.
  caniveau([[5, 2], [5, 10], [15, 10]]);
  puisard(45, 30.9);                                   // contre le mur sud : on ne marche pas dessus

  // ---------- éboulis ----------
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (tile(c, r) !== 'x') continue;
    const bouche = (c >= 15);                                        // le fond de la contre-mine est bouché pour de bon
    eboulis(c * TS, r * TS, bouche ? 2.1 : 1.5, bouche);
  }

  // ---------- objets et repères du plan ----------
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = tile(c, r), x = c * TS, z = r * TS;
    if (t === 'o') { puitsDeLumiere(x, z); continue; }
    if (t === 'S') {
      startPos = new THREE.Vector3(x, 0, z); lastSafe.copy(startPos);
      escalierDeSortie(x, z);
    } else if (t === 'G') {
      gate = makeGrille(TS - 0.2, 3.2, 6); gate.position.set(x, 0, z); scene.add(gate);
      gateCap = addCap(x, z - TS / 2, x, z + TS / 2, 0.25);
      gate.rotation.y = Math.PI / 2;
      for (const dz of [-1, 1]) {
        scene.add(mesh(new THREE.BoxGeometry(0.66, 3.7, 0.66), M.pierre, x, 1.85, z + dz * 1.32));
        scene.add(mesh(new THREE.BoxGeometry(0.86, 0.2, 0.86), M.pierre, x, 3.8, z + dz * 1.32));
      }
      scene.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 3.3), M.pierre, x, 4.05, z));
      poserTorche(c, r, 0, -1, 'phare', x - 0.55, z - 1.32);
      poserTorche(c, r, 0, 1, 'flamme', x - 0.55, z + 1.32);
      { const pl = mesh(new THREE.PlaneGeometry(1.4, 0.42), plaqueMat('GALERIE DES FOSSES', null), x - 0.36, 2.9, z); pl.rotation.y = -Math.PI / 2; scene.add(pl);
        const cd = mesh(new THREE.BoxGeometry(1.56, 0.56, 0.07), M.pierre, x - 0.31, 2.9, z); cd.rotation.y = -Math.PI / 2; scene.add(cd); }
    } else if (t === 'L') {
      lever = makeLever(); lever.position.set(x, 0, z + 1.0); scene.add(lever);
      scene.add(mesh(new THREE.BoxGeometry(1.5, 0.35, 1.5), M.pierre, x, 0.17, z + 1.0));
      scene.add(mesh(new THREE.BoxGeometry(0.22, 2.6, 0.22), M.fer, x - 0.62, 1.3, z + 1.0));
      scene.add(mesh(new THREE.BoxGeometry(1.4, 0.16, 0.16), M.fer, x - 0.1, 2.55, z + 1.0));
      addCap(x, z + 1.0, x, z + 1.0, 0.5);
      addInteract({ pos: new THREE.Vector3(x, 0, z + 0.4), r: 1.8, prompt: () => state.caveLever ? 'levier déjà actionné' : 'actionner le levier', fn: pullLever, enabled: () => true });
    } else if (t === 'C') {
      // deux petits coffres à écus (bourse.js) : le cul-de-sac de la contre-mine, et le bout
      // de la galerie derrière la cage — on n'y va que si on fouille
      // (le plan n'a qu'une case « C » : ils ne sont posés qu'une fois)
      BOURSE.petitCoffre('galerie-contremine', 1 * TS, 0, 10 * TS, 18, Math.PI / 2, 0.75);
      BOURSE.petitCoffre('galerie-cage', 29 * TS, 0, 5 * TS, 20, -Math.PI / 2, 0.75);
      chest = makeChest(); chest.position.set(x, 0, z); scene.add(chest); addCap(x, z, x, z, 0.9);
      scene.add(mesh(new THREE.BoxGeometry(2.5, 0.34, 2.5), M.pierre, x, 0.17, z));
      scene.add(mesh(new THREE.BoxGeometry(2.1, 0.18, 2.1), M.pierre, x, 0.42, z));
      for (const [dx, dz] of [[-1.55, -1.55], [1.55, -1.55], [-1.55, 1.55], [1.55, 1.55]]) {
        scene.add(mesh(new THREE.CylinderGeometry(0.052, 0.072, 0.52, 8), M.cire, x + dx, 0.85, z + dz));
        const fl = mesh(sphG(0.045, 6), M.flamme, x + dx, 1.14, z + dz); fl.scale.y = 1.5; fl.userData.dynamic = true; scene.add(fl);
        halo(x + dx, 1.14, z + dz, 0.44, 0.35);
      }
      chest.userData.glow.distance = 11; chest.userData.glow.color.setHex(0xffd080);
    } else if (t === 'E') {
      cagePos = new THREE.Vector3(x, 0, z);
      cage = makeCage(1.4, 3.2); cage.position.set(x, 0, z); scene.add(cage); addCap(x, z, x, z, 1.5, 3.5);
      prince = PNJ.buildRole('prince') || makePrince(); prince.scale.setScalar(G.echelle); prince.position.set(x, 0, z); prince.rotation.y = Math.PI; scene.add(prince);
      // la voûte s'est effondrée sur la cage : c'est par là que le jour tombe, et
      // c'est ce rai de lumière qu'on voit du bout de la galerie.
      // le rai enveloppe la cage : c'est le seul endroit du niveau où le jour
      // touche quelqu'un, autant que ça se voie du bout de la galerie.
      puitsDeLumiere(x, z, { r: 0.82, h: 4.4, eboule: true, fort: true, evase: 2.9 });
      for (const dz of [-2.3, 2.3]) scene.add(mesh(new THREE.BoxGeometry(0.9, 0.34, 0.9), M.pierre, x + 2.3, 0.17, z + dz));
      addInteract({ pos: cagePos, r: 3.2, enabled: () => !state.princeFreed, prompt: () => state.cageKey ? 'ouvrir la cage du prince' : 'parler au prince Eugène', fn: talkPrince });
    } else if (t === 'g') spawnGaufre(x, z);
  }

  // ---------- torches : allumées sur l'itinéraire, mortes dans les impasses ----------
  poserTorche(5, 6, -1, 0, 'phare');
  poserTorche(10, 6, -1, 0, 'phare');
  poserTorche(15, 10, 0, 1, 'phare');
  for (const [c, r] of sols) {
    if ((c * 7 + r * 5) % 3 !== 0) continue;
    const v = V4.find(([dc, dr]) => isWall(c + dc, r + dr));
    if (!v) continue;
    if (torches.some(t => Math.hypot(t.position.x - c * TS, t.position.z - r * TS) < 7)) continue;
    poserTorche(c, r, v[0], v[1], surRoute(c, r) ? 'flamme' : 'morte');
  }

  // ---------- signalétique de la garnison ----------
  // Les galeries d'un ouvrage bastionné étaient numérotées et peintes au pochoir.
  // C'est le seul guidage diégétique possible ici, et il vaut mieux qu'une flèche
  // à l'écran : on le lit comme du décor.
  poserPlaque('POTERNE', 'haut', 2, 1, 0, -1);          // au-dessus de l'escalier, on la lit en revenant
  // les deux bouches de couloir sont côte à côte : les plaques sont sur le refend,
  // face au joueur qui arrive du nord, une au-dessus de chaque couloir
  poserPlaque('CONTRE-MINE', 'bas', 4, 4, 0, 1);
  poserPlaque('IMPASSE', null, 3, 4, 0, 1);
  poserPlaque('SALLE VOÛTÉE', 'haut', 10, 6, -1, 0);    // au goulet qui remonte vers la nef
  poserPlaque('VANNE N° 4', null, 15, 10, 0, 1);        // au-dessus du levier

  // ---------- détails : ossements, futailles, chaînes ----------
  for (let i = 0; i < 14; i++) {
    const bx = 8 * TS + rand(0, 8 * TS), bz = TS + rand(0, 4 * TS);
    if (isWall(toC(bx), toR(bz))) continue;
    const os = mesh(capG(0.055, rand(0.35, 0.8), 6), M.os, bx, 0.07, bz);
    os.rotation.set(Math.PI / 2, 0, rand(0, TAU)); scene.add(os);
  }
  scene.add(mesh(sphG(0.28, 10), M.os, 12 * TS + 1, 0.28, 3 * TS + 0.5));
  for (const [cx, cz] of [[19, 5], [24, 6], [27, 6]]) {                 // futailles éventrées des fosses
    const x = cx * TS + rand(-0.7, 0.7), z = cz * TS + rand(-0.7, 0.7);
    const t = mesh(new THREE.CylinderGeometry(0.46, 0.42, 1.1, 12), M.bois, x, 0.55, z);
    t.rotation.z = rand(-0.12, 0.12); scene.add(t);
    scene.add(mesh(new THREE.TorusGeometry(0.46, 0.035, 6, 14), M.fer, x, 0.3, z).rotateX(Math.PI / 2));
    scene.add(mesh(new THREE.TorusGeometry(0.44, 0.035, 6, 14), M.fer, x, 0.85, z).rotateX(Math.PI / 2));
    addCap(x, z, x, z, 0.5);
  }
  for (const [cx, cz] of [[21, 1], [25, 5], [10, 2]]) {                 // chaînes pendues à la voûte
    const x = cx * TS + rand(-1, 1), z = cz * TS + rand(-1, 1), n = 7;
    for (let k = 0; k < n; k++) {
      const an = mesh(new THREE.TorusGeometry(0.075, 0.022, 5, 10), M.fer, x, CLEF - 0.25 - k * 0.13, z);
      an.rotation.x = Math.PI / 2; an.rotation.z = k % 2 ? Math.PI / 2 : 0; scene.add(an);
    }
  }
  creerGouttes();
}

// ---------------------------------------------------------------------
//  Pièces de la galerie
// ---------------------------------------------------------------------
// L'escalier de sortie : quatre volées contre le mur nord, un arc en plein cintre
// et, au-dessus, le jour de la poterne. C'est le seul point du niveau où l'on voit
// la lumière du dehors : il sert de repère absolu.
function escalierDeSortie(x, z) {
  const M = MAT;
  for (let k = 0; k < 6; k++) {
    scene.add(mesh(new THREE.BoxGeometry(2.5, 0.34, 0.62), M.pierre, x, 0.17 + k * 0.32, z - 0.55 - k * 0.56));
    scene.add(mesh(new THREE.BoxGeometry(2.5, 0.06, 0.1), M.pierre, x, 0.35 + k * 0.32, z - 0.86 - k * 0.56));
  }
  const arc = mesh(new THREE.TorusGeometry(1.35, 0.24, 8, 18, Math.PI), M.pierre, x, 2.5, z - 1.25); scene.add(arc);
  for (const sx of [-1, 1]) scene.add(mesh(new THREE.BoxGeometry(0.28, 2.5, 0.5), M.pierre, x + sx * 1.35, 1.25, z - 1.25));
  const jour = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), MAT.jour); jour.position.set(x, 2.5, z - 3.9); jour.rotation.x = -0.35; scene.add(jour);
  const l = new THREE.PointLight(0xbfd6ff, 9, 17, 1.45); l.position.set(x, 3.1, z - 2.4); scene.add(l);
  addInteract({ pos: new THREE.Vector3(x, 0, z), r: 2.2, prompt: () => 'remonter à la surface',
    // POTERNE = (27, 31) × ECH 4,5 = (121,5 ; 139,5) ; l'interaction de citadelle.js
    // est 3,6 m à l'ouest de son centre. Constante à reporter si l'échelle rebouge.
    fn: () => goToLevel('citadel', [117.9, 0, 139.5], -Math.PI / 2, 'Retour vers la lumière du jour…') });
}

// Puits de lumière : un évent maçonné qui monte vers le terre-plein, sa grille, son
// rai de poussière et sa flaque au sol. C'est le repère le plus visible du niveau —
// on le voit du bout d'une galerie, et on sait qu'il y a une salle là-bas.
const puits = [];
function puitsDeLumiere(x, z, opts = {}) {
  const M = MAT, R = opts.r || 0.85, h = opts.h || 5.4, evase = opts.evase || 1.45;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.userData.dynamic = true; scene.add(g);
  const base = SPRING + 1.05;   // juste sous la lèvre du trou percé dans la voûte (r = 0,8)
  g.add(mesh(new THREE.CylinderGeometry(R, R, h, 16, 1, true), M.puits, 0, base + h / 2, 0));
  g.add(mesh(new THREE.TorusGeometry(R + 0.14, 0.17, 6, 18), M.pierre, 0, base + 0.05, 0).rotateX(Math.PI / 2));
  const jour = new THREE.Mesh(new THREE.CircleGeometry(R - 0.04, 18), M.jour); jour.rotation.x = Math.PI / 2; jour.position.y = base + h - 0.3; g.add(jour);
  for (const k of [-1, 0, 1]) {
    g.add(mesh(new THREE.BoxGeometry(R * 2, 0.06, 0.06), M.fer, 0, base + h - 0.24, k * 0.42));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.06, R * 2), M.fer, k * 0.42, base + h - 0.24, 0));
  }
  const ht = base + h - 0.35;
  const rais = opts.fort ? M.raisFort : M.rais;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * evase, ht, 20, 1, true), rais);
  cone.position.y = ht / 2; cone.renderOrder = 4; g.add(cone);
  const tache = new THREE.Mesh(new THREE.CircleGeometry(R * evase * 1.45, 22), M.tache);
  tache.rotation.x = -Math.PI / 2; tache.position.y = 0.03; tache.renderOrder = 3; g.add(tache);
  const l = new THREE.PointLight(0xc2d6ff, opts.fort ? 15 : 12, 22, 1.4); l.position.set(0, 2.6, 0); g.add(l);
  // poussières en suspension dans le rai
  const n = 64, pos = new Float32Array(n * 3), vit = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R * 1.5;
    pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = rand(0.2, ht); pos[i * 3 + 2] = Math.sin(a) * d;
    vit[i] = rand(0.06, 0.24);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, M.poussiere); pts.renderOrder = 5; g.add(pts);
  // mousse et herbes folles au pied du rai : rien ne dit mieux « il y a le jour ici »
  for (let i = 0; i < 6; i++) {
    const a = rand(0, TAU), d = rand(0.6, R * 1.9), hh = rand(0.14, 0.3);
    const br = mesh(new THREE.ConeGeometry(0.055, hh, 4), mat(0x4e5a33, { roughness: 1 }), Math.cos(a) * d, hh / 2, Math.sin(a) * d);
    br.rotation.set(rand(-0.25, 0.25), rand(0, TAU), rand(-0.25, 0.25)); g.add(br);
  }
  if (opts.eboule) { eboulis(x + rand(-1.8, 1.8), z + rand(1.4, 2.2), 1.3, false); }
  puits.push({ g, pts, vit, ht, n });
  return g;
}

// Niche : on ne plaque pas un creux sur un mur plein, on bâtit le mur AUTOUR du
// creux — fond, deux jambages, linteau, allège. Autrement le mur passe devant.
function construireNiche(c, r, murGeo) {
  const M = MAT;
  const v = V4.find(([dc, dr]) => !isWall(c + dc, r + dr));
  if (!v) { scene.add(mesh(murGeo, M.mur[Z_MINE], c * TS, (WALL_H + 0.6) / 2, r * TS)); return; }
  const [dc, dr] = v, z = zoneAt(c + dc, r + dr), H = WALL_H + 0.6;
  const LW = 1.15, LH = 1.5, Y0 = 0.95, P = 0.6, mm = M.mur[z];
  const g = new THREE.Group(); g.position.set(c * TS, 0, r * TS); g.rotation.y = Math.atan2(dc, dr); scene.add(g);
  g.add(mesh(new THREE.BoxGeometry(TS, H, TS - P), mm, 0, H / 2, -P / 2));
  for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry((TS - LW) / 2, H, P), mm, sx * (TS + LW) / 4, H / 2, TS / 2 - P / 2));
  g.add(mesh(new THREE.BoxGeometry(LW, H - Y0 - LH, P), mm, 0, (Y0 + LH + H) / 2, TS / 2 - P / 2));
  g.add(mesh(new THREE.BoxGeometry(LW, Y0, P), mm, 0, Y0 / 2, TS / 2 - P / 2));
  g.add(mesh(new THREE.BoxGeometry(LW + 0.34, 0.17, 0.15), M.pierre, 0, Y0 + LH + 0.07, TS / 2 + 0.04));
  g.add(mesh(new THREE.BoxGeometry(LW + 0.34, 0.15, 0.22), M.pierre, 0, Y0 - 0.04, TS / 2 + 0.03));
  const zi = TS / 2 - P + 0.16;                                        // fond du creux
  if (z === Z_MINE) {                                                  // poudre : surtout pas de flamme
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.5, 10), M.bois, 0, Y0 + 0.25, zi + 0.1));
    g.add(mesh(new THREE.TorusGeometry(0.28, 0.025, 5, 12), M.fer, 0, Y0 + 0.4, zi + 0.1).rotateX(Math.PI / 2));
    for (let k = 0; k < 8; k++) g.add(mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 8), M.fer, 0.34, Y0 + 0.06, zi + 0.05 + k * 0.03));
  } else {
    const nOs = z === Z_SALLE ? 1 : 0;
    if (nOs) { g.add(mesh(sphG(0.19, 10), M.os, -0.3, Y0 + 0.19, zi)); g.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.16), M.os, -0.3, Y0 + 0.06, zi + 0.1)); }
    for (let k = 0; k < 2; k++) {
      const bx = 0.22 + k * 0.26, hh = rand(0.16, 0.32);
      g.add(mesh(new THREE.CylinderGeometry(0.055, 0.075, hh, 8), M.cire, bx, Y0 + hh / 2, zi));
      const fl = mesh(sphG(0.045, 6), M.flamme, bx, Y0 + hh + 0.06, zi); fl.userData.dynamic = true; g.add(fl);
      const h2 = new THREE.Sprite(M.haloSprite); h2.scale.set(0.55, 0.55, 1); h2.position.set(bx, Y0 + hh + 0.06, zi); g.add(h2);
    }
    g.add(mesh(new THREE.PlaneGeometry(0.7, 0.55), M.suie, 0.3, Y0 + 1.2, zi - 0.14));   // le noir de fumée au-dessus des bougies
  }
}

// Éboulis : un tas de blocs et de voussoirs tombés. Quand il bouche, il bouche
// pour de vrai — une impasse qui se lit comme une impasse vaut mieux qu'un mur.
function eboulis(x, z, rr, bouche) {
  const M = MAT;
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  for (let i = 0; i < 24; i++) {
    const sc = rand(0.16, 0.6), a = rand(0, TAU), d = Math.pow(Math.random(), 0.55) * rr;
    const b = mesh(new THREE.DodecahedronGeometry(sc, 0), M.caillou, Math.cos(a) * d, sc * 0.5 + (1 - d / rr) * rand(0, 1.1), Math.sin(a) * d);
    b.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU)); b.scale.y = rand(0.55, 1);
    g.add(b);
  }
  for (let i = 0; i < 5; i++) {                                        // voussoirs de brique tombés de la voûte
    const a = rand(0, TAU), d = rand(0.4, rr + 0.5);
    const v = mesh(new THREE.BoxGeometry(0.42, 0.2, 0.28), M.arc[Z_FOSSES], Math.cos(a) * d, 0.1, Math.sin(a) * d);
    v.rotation.set(rand(-0.3, 0.3), rand(0, TAU), rand(-0.3, 0.3)); g.add(v);
  }
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(rand(0.4, 0.9), 10), MAT.eau);
    p.rotation.x = -Math.PI / 2; p.position.set(rand(-rr, rr), 0.02, rand(-rr, rr)); g.add(p);
  }
  if (bouche) addCap(x, z, x, z, rr * 0.8);
  return g;
}

// Caniveau : une rigole pavée, l'eau qui y court, et ses margelles. Le défilement
// de la normale donne le SENS de la pente — c'est ça qui en fait un guide.
const rigoles = [];
function caniveau(sommets) {
  const M = MAT;
  for (let i = 0; i + 1 < sommets.length; i++) {
    const [c0, r0] = sommets[i], [c1, r1] = sommets[i + 1];
    const x0 = c0 * TS, z0 = r0 * TS, x1 = c1 * TS, z1 = r1 * TS;
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.5, yaw = -Math.atan2(z1 - z0, x1 - x0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const lit = mesh(new THREE.BoxGeometry(len, 0.18, 0.62), M.pierre, mx, -0.07, mz); lit.rotation.y = yaw; scene.add(lit);
    const eau = mesh(new THREE.BoxGeometry(len - 0.1, 0.07, 0.46), M.eauVive, mx, 0.015, mz); eau.rotation.y = yaw; eau.userData.dynamic = true; scene.add(eau);
    rigoles.push(eau);
    for (const sg of [-1, 1]) {
      const b = mesh(new THREE.BoxGeometry(len, 0.15, 0.17), M.pierre, mx, 0.06, mz);
      b.rotation.y = yaw; b.translateZ(sg * 0.39); scene.add(b);   // translateZ APRÈS la rotation : la margelle suit le tracé
    }
  }
}
function puisard(x, z) {
  const M = MAT;
  scene.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.4, 16), M.pierre, x, 0.05, z));
  scene.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.6, 16, 1, true), M.suie, x, -0.1, z));
  const e = new THREE.Mesh(new THREE.CircleGeometry(0.72, 16), M.eau); e.rotation.x = -Math.PI / 2; e.position.set(x, 0.12, z); scene.add(e);
  for (const k of [-1, 0, 1]) scene.add(mesh(new THREE.BoxGeometry(1.5, 0.05, 0.07), M.fer, x, 0.24, z + k * 0.34));
  addCap(x, z, x, z, 0.7);
}

// Torche. Trois états, et c'est le troisième qui fait le niveau : une torche morte
// dit « pas par là » sans une ligne de texte. Seules quatre portent une vraie
// lumière (budget : ~10 ponctuelles), les autres vendent leur halo avec un sprite.
function poserTorche(c, r, dc, dr, etat, px, pz) {
  const t = makeTorch();
  const x = px !== undefined ? px : c * TS + dc * (TS / 2 - 0.32);
  const z = pz !== undefined ? pz : r * TS + dr * (TS / 2 - 0.32);
  const bas = zoneAt(c, r) === Z_MINE;
  t.position.set(x, bas ? 2.2 : 2.5, z);
  t.rotation.z = -dc * 0.36; t.rotation.x = dr * 0.36;
  scene.add(mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), MAT.fer, x + dc * 0.16, (bas ? 2.2 : 2.5) - 0.2, z + dr * 0.16));
  t.userData.flame.material = MAT.flamme; t.userData.flame.scale.set(0.8, 1.4, 0.8);
  if (etat === 'morte') {
    t.userData.flame.visible = false; t.remove(t.userData.light); t.userData.light = null;
    t.userData.morte = true;
    t.children[0].material = MAT.suie;
  } else if (etat === 'phare') {
    const l = t.userData.light; l.intensity = 36; l.distance = 27; l.decay = 1.3; l.color.setHex(0xff9a44);
    const sp = new THREE.Sprite(MAT.haloSprite); sp.scale.set(1.9, 1.9, 1); sp.position.set(0, 0.62, 0); t.add(sp);
  } else {
    t.remove(t.userData.light); t.userData.light = null;
    const sp = new THREE.Sprite(MAT.haloSprite); sp.scale.set(1.15, 1.15, 1); sp.position.set(0, 0.62, 0); t.add(sp);
  }
  scene.add(t); torches.push(t);
  return t;
}
function halo(x, y, z, taille, op) {
  const sp = new THREE.Sprite(MAT.haloSprite.clone()); sp.material.opacity = op;
  sp.scale.set(taille, taille, 1); sp.position.set(x, y, z); scene.add(sp); return sp;
}

// Plaque peinte au pochoir : le guidage diégétique de la garnison.
function plaqueMat(texte, fleche) {
  const [cv, g] = makeCanvas(320, 96);
  g.fillStyle = '#6a6052'; g.fillRect(0, 0, 320, 96);
  for (let i = 0; i < 1400; i++) { g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.12).toFixed(3) + ')'; g.fillRect(Math.random() * 320, Math.random() * 96, 3, 2); }
  g.fillStyle = '#efc65c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 30px "Trebuchet MS", serif';
  g.fillText(texte, 160, fleche ? 38 : 48);
  if (fleche) {
    g.beginPath();
    const yb = 72, s = 13;
    if (fleche === 'bas') { g.moveTo(160, yb + s); g.lineTo(160 - s, yb - s); g.lineTo(160 + s, yb - s); }
    else { g.moveTo(160, yb - s); g.lineTo(160 - s, yb + s); g.lineTo(160 + s, yb + s); }
    g.closePath(); g.fill();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(30,26,20,' + (Math.random() * 0.5).toFixed(3) + ')'; g.fillRect(Math.random() * 320, Math.random() * 96, 4, 3); }
  return new THREE.MeshStandardMaterial({ map: tex(cv), roughness: 0.96 });
}
function poserPlaque(texte, fleche, c, r, dc, dr, y = 2.45) {
  const m = plaqueMat(texte, fleche);
  // la plaque est sur la face du mur, tournée vers la dalle d'où on la lit
  const x = c * TS + dc * (TS / 2 - 0.05), z = r * TS + dr * (TS / 2 - 0.05), yaw = Math.atan2(-dc, -dr);
  const p = mesh(new THREE.PlaneGeometry(1.5, 0.45), m, x, y, z); p.rotation.y = yaw; scene.add(p);
  const cad = mesh(new THREE.BoxGeometry(1.66, 0.6, 0.07), MAT.pierre, x, y, z); cad.rotation.y = yaw;
  cad.translateZ(-0.05); scene.add(cad);
}

// Gouttes : la clé de voûte suinte, la goutte tombe, l'onde part, l'écho répond.
const gouttes = [];
function creerGouttes() {
  const pts = [[19, 1], [22, 1], [26, 1], [20, 5], [24, 5], [28, 5], [3, 2], [5, 4], [12, 5], [15, 2], [8, 8], [12, 9], [16, 7]];
  for (const [c, r] of pts) {
    if (isWall(c, r) || isPit(c, r)) continue;
    const x = c * TS + rand(-0.9, 0.9), z = r * TS + rand(-0.9, 0.9);
    const haut = zoneAt(c, r) === Z_MINE ? MINE_H - 0.12 : CLEF - 0.12;
    const d = mesh(sphG(0.045, 6), MAT.goutte, x, haut, z); d.scale.set(1, 2.2, 1); d.userData.dynamic = true; d.visible = false; scene.add(d);
    const o = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 18), new THREE.MeshBasicMaterial({ color: 0x9fc4c8, transparent: true, opacity: 0, depthWrite: false }));
    o.rotation.x = -Math.PI / 2; o.position.set(x, 0.035, z); o.userData.dynamic = true; scene.add(o);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(rand(0.55, 1.0), 14), MAT.eau);
    fl.rotation.x = -Math.PI / 2; fl.position.set(x, 0.025, z); scene.add(fl);
    gouttes.push({ x, z, haut, d, o, t: rand(0, 5), y: haut, v: 0, onde: 0 });
  }
}

function pullLever() {
  if (state.caveLever) return;
  state.caveLever = true; SFX.hit(); setTimeout(() => SFX.stomp(), 300);
  showMessage('Le levier grince… au loin, une grille se lève dans la salle des rats.', 4);
  gateCap.r = 0; saveGame(true);
}
function talkPrince() {
  prince.rotation.y = Math.atan2(player.pos.x - prince.position.x, player.pos.z - prince.position.z);
  if (!state.cageKey) { dialogue([{ who: 'Prince Eugène', text: "« Camille ! Tu es venue jusqu'ici ! Cette cage est fermée à clé… et c'est le Rat-Roi qui garde la clé, dans la galerie des fosses. Méfie-toi de lui. »" }]); return; }
  freePrince();
}
// cinématique : la cage s'ouvre, le prince sort
function freePrince() {
  const x = cagePos.x, z = cagePos.z;
  cutscene([
    { cam: [x + 4, 2.5, z + 4], at: [x, 1.6, z], cam2: [x + 3, 2.2, z + 3.5], at2: [x, 1.6, z], dur: 3, text: 'La clé du Rat-Roi tourne dans la serrure de la cage…', fn: () => { SFX.pickup(); cage.userData.opening = true; prince.rotation.y = Math.PI / 4; } },
    { cam: [x + 3, 2.2, z + 3.5], at: [x, 1.6, z], dur: 2.5, actor: prince, to: [x + 1.8, z + 1.6], speed: 2.5, fn: () => { state.princeFreed = true; state.caveDone = true; SFX.win(); } },
    { say: "« Camille… je savais que tu viendrais. Phinaert m'a traîné ici en riant, il disait que personne ne passerait ses monstres. »", who: 'Prince Eugène', cam: [x + 4, 2.4, z + 4.5], at: [x + 1.2, 1.6, z + 1] },
    { say: "« Sortons d'ici. Reste devant, je te suis : je n'ai pas ton épée… ni ton courage. »", who: 'Prince Eugène' },
  ], () => { saveGame(true); showMessage('Ramène le prince à la surface : l\'escalier de l\'entrée, puis Lydéric près du pont.', 6); });
}
function populate() {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = tile(c, r);
    if (t === 'R') spawnEnemy('rat', c * TS, r * TS, 'cave');
    else if (t === 'B') spawnEnemy('chauve', c * TS, r * TS, 'cave');
    else if (t === 'K') spawnEnemy('ratroi', c * TS, r * TS, 'cave');
  }
  player.pos.copy(startPos); player.yaw = 0; G.camYaw = 0;
  // La lanterne de Camille est la vraie lumière du niveau : c'est elle qui rend le
  // reste jouable une fois l'ambiance descendue à 0,18 d'hémisphérique.
  lantern = new THREE.PointLight(0xffc088, 24, 22, 1.3); scene.add(lantern);
}
function onLoad() {
  if (state.caveLever) { gateCap.r = 0; gate.position.y = 3.2; lever.userData.arm.rotation.x = 0.9; }
  if (state.princeFreed && prince) { cage.userData.door.rotation.y = 1.4; prince.position.set(player.pos.x + 1.5, 0, player.pos.z + 1.5); }
  if (state.caveHeart && chest) chest.userData.lid.rotation.x = -1.9;
  if (isWall(toC(player.pos.x), toR(player.pos.z)) || isPit(toC(player.pos.x), toR(player.pos.z))) player.pos.copy(startPos);
  lastSafe.copy(player.pos);
}
let gateHintT = 0;
function update(dt) {
  const p = player;
  gateHintT -= dt; if (gate && !state.caveLever && gateHintT <= 0 && Math.hypot(gate.position.x - p.pos.x, gate.position.z - p.pos.z) < 4) { gateHintT = 12; showMessage("La grille est verrouillée : sa vanne est en bas, dans la contre-mine. Redescends et suis le caniveau — l'eau y va.", 5); }
  if (lantern) lantern.position.set(p.pos.x, p.pos.y + 2.4, p.pos.z);
  if (p.onGround && p.pos.y >= -0.1 && !isPit(toC(p.pos.x), toR(p.pos.z))) {
    // position sûre = dalle de sol entourée de sol (pas au bord d'une fosse)
    const c = toC(p.pos.x), r = toR(p.pos.z);
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => isPit(c + dc, r + dr))) lastSafe.copy(p.pos);
  }
  gate.position.y = lerp(gate.position.y, state.caveLever ? 3.2 : 0, 1 - Math.exp(-2 * dt));
  if (lever) lever.userData.arm.rotation.x = lerp(lever.userData.arm.rotation.x, state.caveLever ? 0.9 : -0.9, 1 - Math.exp(-6 * dt));
  if (chest && !state.caveHeart && Math.hypot(chest.position.x - p.pos.x, chest.position.z - p.pos.z) < 2.2) {
    state.caveHeart = true; chest.userData.glow.intensity = 3; SFX.pickup(); burst(chest.position.x, 1, chest.position.z, 0xffe070, 24, 3, 1.2, 2, 1.2);
    spawnPickup('heart', chest.position.x, chest.position.z + 1.6);
    showMessage("Le trésor des galeries : un RÉCEPTACLE DE CŒUR laissé par la garnison de Vauban ! Ramasse-le.", 6);
    saveGame(true);
  }
  if (chest) { chest.userData.lid.rotation.x = lerp(chest.userData.lid.rotation.x, state.caveHeart ? -1.9 : 0, 1 - Math.exp(-6 * dt)); chest.userData.glow.intensity = lerp(chest.userData.glow.intensity, state.caveHeart ? 0.9 : 0, 1 - Math.exp(-2 * dt)); }
  if (cage && (cage.userData.opening || state.princeFreed)) cage.userData.door.rotation.y = lerp(cage.userData.door.rotation.y, 1.4, 1 - Math.exp(-3 * dt));
  if (prince && state.princeFreed && !cut.active) followActor(prince, dt, p.pos, 2.4, 5.5);
  else if (prince && !state.princeFreed && !cut.active && prince.userData.head) { prince.userData.head.rotation.y = Math.sin(state.time * 0.8) * 0.4; }
  if (prince) PNJ.animeVillageois(prince, dt, !!prince.userData.walkTo);
}
function onFall() {
  damagePlayer(2, player.pos.x + 0.01, player.pos.z);
  player.pos.copy(lastSafe); player.pos.y = 0; player.vy = 0; player.kb.set(0, 0, 0);
  showMessage('Camille tombe dans la fosse… et se hisse hors du trou.', 2.5);
}
function animate(now, dt) {
  const d = Math.min(0.05, dt || 0.016), p = player.pos;
  for (const t of torches) {
    if (t.userData.morte) continue;
    const f = 1.4 + Math.sin(now / 60 + t.userData.seed) * 0.3;
    t.userData.flame.scale.set(1 + (f - 1.4) * 0.3, f, 1 + (f - 1.4) * 0.3);
    if (t.userData.light) t.userData.light.intensity = 36 * (0.87 + Math.sin(now / 45 + t.userData.seed) * 0.13);
  }
  // l'eau du caniveau descend : c'est le défilement qui donne le sens
  for (const e of rigoles) if (e.material.normalMap) e.material.normalMap.offset.x = (now / 9000) % 1;
  // poussières dans les rais de lumière
  for (const q of puits) {
    const pos = q.pts.geometry.attributes.position;
    for (let i = 0; i < q.n; i++) {
      let y = pos.getY(i) - q.vit[i] * d;
      if (y < 0.1) y = q.ht;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(now / 1400 + i) * 0.0016);
    }
    pos.needsUpdate = true;
  }
  // gouttes : chute, onde, écho
  for (const g of gouttes) {
    if (g.onde > 0) {
      g.onde -= d * 1.4;
      const k = clamp(1 - g.onde, 0, 1);
      g.o.scale.setScalar(0.4 + k * 3.4); g.o.material.opacity = Math.max(0, g.onde) * 0.5;
      if (g.onde <= 0) g.o.material.opacity = 0;
    }
    if (g.t > 0) { g.t -= d; if (g.t <= 0) { g.y = g.haut; g.v = 0; g.d.visible = true; } continue; }
    g.v += 9.2 * d; g.y -= g.v * d;
    g.d.position.y = g.y;
    if (g.y <= 0.06) {
      g.d.visible = false; g.onde = 1; g.t = rand(2.2, 7.5);
      if (state.running) sonGoutte(Math.hypot(g.x - p.x, g.z - p.z));
    }
  }
}
function minimap(g, W) {
  const sc = W / (COLS * TS) * 0.92, ox = 6, oz = W / 2 - ROWS * TS * sc / 2;
  const P = (x, z) => [ox + (x + TS / 2) * sc, oz + (z + TS / 2) * sc];
  const TEINTE = ['#7a7468', '#7d6450', '#4e5a58', '#5a4b38'];   // une couleur par quartier, comme au sol
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = tile(c, r); if (isWall(c, r)) continue;
    g.fillStyle = t === 'P' ? '#0c0c12' : TEINTE[zoneAt(c, r)];
    const [px, pz] = P(c * TS - TS / 2, r * TS - TS / 2); g.fillRect(px, pz, TS * sc + 0.5, TS * sc + 0.5);
    if (t === 'o') { g.fillStyle = '#dbe8ff'; g.beginPath(); g.arc(px + TS * sc / 2, pz + TS * sc / 2, 2.4, 0, TAU); g.fill(); }
    if (t === 'x') { g.fillStyle = '#3a342c'; g.fillRect(px + 1, pz + 1, TS * sc - 1.5, TS * sc - 1.5); }
  }
  if (gate && !state.caveLever) { g.fillStyle = '#c0c0ff'; const [px, pz] = P(gate.position.x, gate.position.z); g.fillRect(px - 2, pz - 4, 4, 8); }
  if (lever && !state.caveLever) { const [px, pz] = P(lever.position.x, lever.position.z); g.fillStyle = '#ffe066'; g.beginPath(); g.arc(px, pz, 3.5, 0, TAU); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); }
  minimapDots(g, (x, z) => P(x, z));
}
function counts() {
  const rats = enemies.filter(e => !e.dead && (e.kind === 'rat' || e.kind === 'ratroi')).length, bats = enemies.filter(e => !e.dead && e.kind === 'chauve').length;
  return `Rats <b>${rats}</b> &nbsp; Chauves-souris <b>${bats}</b> &nbsp; Levier <b>${state.caveLever ? '✓' : '✗'}</b> &nbsp; Clé de la cage <b>${state.cageKey ? '✓' : '?'}</b>${state.bow ? ' &nbsp; Arc <b>C</b>' : ''}<br><small>Objectif : ${objective()}</small>`;
}
function objective() {
  return state.princeFreed ? "remonte à la surface avec le prince : l'escalier de l'entrée, sous le rai de jour, puis Lydéric au pont"
    : state.cageKey ? 'ouvre la cage du prince Eugène, sous le puits de lumière au bout de la galerie des fosses'
    : state.caveLever ? 'franchis la grille, saute les fosses et vaincs le Rat-Roi qui garde la clé de la cage'
    : "descends dans la contre-mine en suivant le caniveau, et tire la vanne n° 4 qui ouvre la grille";
}
const level = {
  name: 'cave', getH: levelH, blocked: levelBlocked, zoneName, build, populate, update, animate, minimap, counts, onLoad, onFall, objective,
  start: () => showMessage("Les galeries de Vauban. Ça suinte, ça résonne. Les torches allumées marquent le chemin ; le caniveau descend vers la contre-mine.", 6),
  arriveMessage: () => state.princeFreed ? "Les galeries. Le prince te suit : remonte par l'escalier, sous le rai de jour." : "Les galeries de Vauban. Suis les torches allumées : celles qui sont mortes ne mènent nulle part.",
  entry: () => state.princeFreed ? null : { title: 'Les galeries de Vauban', sub: 'Sous la citadelle', cam: [startPos.x + 13, 3.6, startPos.z + 9], at: [startPos.x + 2, 1.4, startPos.z + 1], cam2: [startPos.x + 3.5, 2.5, startPos.z + 4.5], at2: [startPos.x, 1.5, startPos.z], dur: 4.5, text: 'Quelque part au bout de ces galeries, le prince Eugène attend…' },
  onKill: (e) => { BOURSE.prime(e); if (e.kind === 'ratroi' && !state.cageKey) { state.cageKey = true; saveGame(true);
    setTimeout(() => cutscene([
      { cam: [e.pos.x + 3, 2.5, e.pos.z + 3], at: [e.pos.x, 0.8, e.pos.z], dur: 2.5, text: 'Le Rat-Roi s\'effondre… et lâche une petite clé de fer.', fn: () => { const k = makeKey(); k.position.set(e.pos.x, 1.0, e.pos.z); k.userData.dynamic = true; scene.add(k); burst(e.pos.x, 1, e.pos.z, 0xffe070, 20, 3, 1, 3, 1.2); SFX.pickup(); setTimeout(() => scene.remove(k), 2400); } },
      { cam: [cagePos.x + 4, 2.5, cagePos.z + 4], at: [cagePos.x, 1.6, cagePos.z], cam2: [cagePos.x + 3, 2.2, cagePos.z + 3], at2: [cagePos.x, 1.6, cagePos.z], dur: 3.5, text: 'La clé de la cage du prince ! Il est tout près, au bout de la galerie des fosses.' },
    ]), 800); } },
};
// Camille riggée si la banque est là, sinon la version en primitives
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
