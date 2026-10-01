import * as PNJ_E from './engine.js?v=41';
import * as PNJ from './pnj.js';
// The Legend of Camille — l'île du temps : le Temple des Géants (version 1, 1er octobre)
// =====================================================================
// L'idée d'Eugène : une ÎLE DU TEMPS, la passerelle entre les mondes. Elle donne un sol au
// Temple de STORY.md § 6 — la tour creuse hors du temps, la cour ronde, les portes des mondes.
// Le découpage et les choix : docs/TEMPLE-ILE.md.
//
// Rien ne bouge ici : la mer est un miroir, la lumière un crépuscule arrêté. C'est ce qui doit
// changer, retour après retour (docs/DECISIONS-RECIT.md § 3) — cette version pose le lieu tel
// qu'on le découvre à la fin de l'acte I : une seule porte ouverte, celle de Lille, des étages
// vides, et le premier vers de la prophétie.
//
// En mètres, comme la carte (1 unité = 1 m) : Camille y a l'échelle de la ville (0,6).
// =====================================================================
import { THREE, TAU, scene, G, mat, phMat, hemi, sun, renderer, bloom, mesh, boxG, makeCanvas, tex,
  addCap, showMessage, bootLevel, minimapDots, makeSky, player } from './engine.js?v=41';

const R_ILE = 50, R_COUR = 26, R_TOUR = 10, EP_TOUR = 1.4, H_TOUR = 72;
const MER = -1.3;                                    // la mer figée, sous le bord de l'île
// les six portes, en cercle : Lille au sud (+z), là où l'on arrive
const PORTES = [
  { nom: 'LILLE', sous: 'la Grande Cloche', ouverte: true },
  { nom: 'LE MIDI', sous: 'l’Aveyron' },
  { nom: 'LES ÎLES', sous: 'la mousson' },
  { nom: 'LES HEURES', sous: 'les Pouilles' },
  { nom: 'LES TROUPEAUX', sous: 'la Lozère' },
  { nom: '', sous: '' },                              // la rive oubliée : pas encore de nom
];
const angPorte = (i) => i * TAU / PORTES.length;      // 0 = sud (+z), puis dans le sens trigonométrique vu d'en haut
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// hauteur du sol : le plateau plat jusqu'à la rive, puis la roche qui plonge dans la mer
function hauteur(x, z) {
  const r = Math.hypot(x, z);
  if (r < R_ILE - 6) return 0;
  const t = Math.min(1, (r - (R_ILE - 6)) / 10);
  return -t * t * 4.2;
}

// une plaque gravée : lettres creusées (ombre dessous, lumière dessus) dans la pierre claire
function plaqueGravee(lignes, w, h, taille) {
  const W = 1024, H = Math.round(W * h / w), [c, x] = makeCanvas(W, H);
  x.fillStyle = '#b9b1a2'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 2600; k++) { x.fillStyle = `rgba(${60 + Math.random() * 60},${55 + Math.random() * 50},${45 + Math.random() * 40},${Math.random() * 0.12})`;
    x.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 2 + Math.random() * 6); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  lignes.forEach((l, i) => {
    const y = H * (i + 1) / (lignes.length + 1), t = l.taille || taille;
    x.font = `${l.italique ? 'italic ' : ''}bold ${t}px Georgia, serif`;
    x.fillStyle = 'rgba(255,250,235,0.55)'; x.fillText(l.t, W / 2 + 2, y + 2);     // l'arête éclairée
    x.fillStyle = l.couleur || 'rgba(40,32,24,0.92)'; x.fillText(l.t, W / 2, y);   // le creux
  });
  return new THREE.MeshStandardMaterial({ map: tex(c, 1), roughness: 0.9 });
}

let mer = null;
function build() {
  // un crépuscule arrêté : violet en haut, or pâle à l'horizon ; la brume ferme le large
  makeSky(0x2a2f55, 0x8a7a9a, 0xe8cfa0, true);
  scene.fog = new THREE.Fog(0xb8a8a8, 90, 620);
  hemi.intensity = 0.55; hemi.color.setHex(0xd8d0e8); hemi.groundColor.setHex(0x4a4038);
  sun.intensity = 1.6; sun.color.setHex(0xffd2a0); sun.position.set(-60, 38, 90); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.22;
  G.camBack = 7; G.camUp = 3.4;

  const roche = phMat('rocher_01', 4, 4, { color: 0x9a9088 });
  const herbe = phMat('withered_grass', 5, 5, { color: 0xa8a080 });
  const pave = phMat('worn_tile_floor', 4, 4, { color: 0xb0a898 });
  const pierre = phMat('old_stone_wall_02', 4, 4, { color: 0xc8beac });
  const taille = phMat('old_stone_wall_02', 2, 2, { color: 0xddd3c0 });
  const bois = phMat('wood_cabinet_worn_long', 2, 2, { color: 0x5a4430 });
  const fer = mat(0x3a3a40, { metalness: 0.8, roughness: 0.45 });

  // ---------- la mer figée : un miroir, qui renvoie le ciel ----------
  mer = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), new THREE.MeshStandardMaterial({ color: 0x4a5878, roughness: 0.04, metalness: 0.92 }));
  mer.rotation.x = -Math.PI / 2; mer.position.y = MER; scene.add(mer);

  // ---------- l'île : le plateau, la rive de roche ----------
  // un anneau maillé en 40 cercles, pas un disque : CircleGeometry n'a que son centre et son
  // bord, et le relief de la rive en faisait un cône qui plongeait sous la mer dès 12 m
  { const g = new THREE.RingGeometry(0, R_ILE + 6, 96, 40); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      // la rive n'est pas un cercle : des avancées et des criques, figées comme le reste
      const k = r > R_ILE - 10 ? 1 + 0.05 * Math.sin(a * 5) + 0.03 * Math.sin(a * 13 + 1) : 1;
      p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, hauteur(x, z) - (r > R_ILE + 2 ? 2 : 0)); }
    g.computeVertexNormals();
    const sol = new THREE.Mesh(g, herbe); sol.receiveShadow = true; scene.add(sol);
    // la rive : une couronne de rochers à demi noyés
    for (let k = 0; k < 70; k++) { const a = k / 70 * TAU + Math.sin(k * 7.3) * 0.04, r = R_ILE + 1 + Math.sin(k * 3.1) * 2.5;
      const s = 1.6 + Math.abs(Math.sin(k * 5.7)) * 2.6;
      const b = mesh(new THREE.DodecahedronGeometry(s, 1), roche, Math.sin(a) * r, MER - s * 0.25, Math.cos(a) * r);
      b.scale.set(1, 0.55 + Math.abs(Math.sin(k)) * 0.35, 1.2); b.rotation.set(k, k * 2.1, 0); b.castShadow = b.receiveShadow = true; scene.add(b); } }

  // ---------- la cour ronde ----------
  { const c = new THREE.Mesh(new THREE.RingGeometry(R_TOUR, R_COUR + 1.5, 96, 1), pave); c.rotation.x = -Math.PI / 2; c.position.y = 0.03; c.receiveShadow = true; scene.add(c);
    const b = new THREE.Mesh(new THREE.TorusGeometry(R_COUR + 1.5, 0.28, 6, 120), taille); b.rotation.x = Math.PI / 2; b.position.y = 0.06; b.scale.z = 0.4; scene.add(b); }

  // ---------- la tour creuse ----------
  { const porte = 0.22;                                       // demi-ouverture de la porte, en radians (côté sud)
    const mur = new THREE.Mesh(new THREE.CylinderGeometry(R_TOUR, R_TOUR + 0.6, H_TOUR, 72, 12, true, porte, TAU - 2 * porte), pierre);
    // la texture court sur tout le tour (63 m) et toute la hauteur : à l'échelle, sinon les pierres s'étirent
    mur.position.y = H_TOUR / 2; mur.material = phMat('old_stone_wall_02', TAU * R_TOUR, H_TOUR, { color: 0xc8beac, side: THREE.DoubleSide });
    mur.castShadow = mur.receiveShadow = true; scene.add(mur);
    const dedans = new THREE.Mesh(new THREE.CylinderGeometry(R_TOUR - EP_TOUR, R_TOUR - EP_TOUR, H_TOUR, 72, 12, true, porte, TAU - 2 * porte), phMat('old_stone_wall_02', TAU * (R_TOUR - EP_TOUR), H_TOUR, { color: 0xa8a090, side: THREE.BackSide }));
    dedans.position.y = H_TOUR / 2; dedans.receiveShadow = true; scene.add(dedans);
    // le linteau au-dessus de la porte, et les deux joues
    const lin = new THREE.Mesh(new THREE.CylinderGeometry(R_TOUR + 0.05, R_TOUR + 0.6, H_TOUR - 9, 24, 1, true, -porte, 2 * porte), pierre);
    lin.position.y = 9 + (H_TOUR - 9) / 2; lin.material = phMat('old_stone_wall_02', 2 * porte * R_TOUR, H_TOUR - 9, { color: 0xc8beac, side: THREE.DoubleSide }); scene.add(lin);
    for (const s of [-1, 1]) { const a = s * porte;
      const j = mesh(boxG(EP_TOUR + 0.6, 9, 0.9), taille, Math.sin(a) * (R_TOUR - EP_TOUR / 2), 4.5, Math.cos(a) * (R_TOUR - EP_TOUR / 2)); j.rotation.y = a; j.castShadow = true; scene.add(j); }
    // bandeaux de pierre claire à chaque étage, dehors
    for (let k = 1; k < 6; k++) { const b = new THREE.Mesh(new THREE.TorusGeometry(R_TOUR + 0.55 - k * 0.1, 0.35, 6, 96), taille); b.rotation.x = Math.PI / 2; b.position.y = k * 12; b.scale.z = 0.6; scene.add(b); }
    // DEDANS : un étage par cloche à venir, un anneau de corbeaux et deux poutres en croix,
    // et pour chacun un crochet vide ; tout en haut, celui de la Grande Cloche
    for (let k = 0; k < 6; k++) { const y = 14 + k * 11;
      for (let c = 0; c < 16; c++) { const a = c / 16 * TAU; const co = mesh(boxG(1.2, 0.6, 0.8), taille, Math.sin(a) * (R_TOUR - EP_TOUR - 0.5), y, Math.cos(a) * (R_TOUR - EP_TOUR - 0.5)); co.rotation.y = a; scene.add(co); }
      for (const a of [k * 0.5, k * 0.5 + Math.PI / 2]) { const po = mesh(boxG(0.5, 0.6, (R_TOUR - EP_TOUR) * 2), bois, 0, y + 0.5, 0); po.rotation.y = a; po.castShadow = true; scene.add(po); }
      const cr = mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 14, Math.PI * 1.4), fer, 0, y - 0.1, 0); cr.rotation.z = Math.PI * 0.8; scene.add(cr);
      scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), fer, 0, y + 0.15, 0)); }
    // collisions : le mur de la tour, sauf la porte
    for (let c = 0; c < 40; c++) { const a = (c + 0.5) / 40 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < porte + 0.05) continue;
      const x = Math.sin(a) * (R_TOUR - EP_TOUR / 2), z = Math.cos(a) * (R_TOUR - EP_TOUR / 2); addCap(x, z, x, z, 1.0); } }

  // ---------- la prophétie, au pied de la tour, à droite de la porte ----------
  { const a = 0.55, r = R_TOUR + 0.75;
    const p = new THREE.Mesh(boxG(5.2, 2.6, 0.25), [taille, taille, taille, taille, plaqueGravee([
      { t: 'Quand la Grande Cloche se fendra,', italique: true }, { t: 'le géant du Buc sortira.', italique: true },
      { t: '· · ·', couleur: 'rgba(40,32,24,0.35)' }, { t: '· · ·', couleur: 'rgba(40,32,24,0.35)' }, { t: '· · ·', couleur: 'rgba(40,32,24,0.35)' }, { t: '· · ·', couleur: 'rgba(40,32,24,0.35)' },
    ], 5.2, 2.6, 54), taille]);
    p.position.set(Math.sin(a) * r, 1.9, Math.cos(a) * r); p.rotation.y = a; p.castShadow = true; scene.add(p); }

  // ---------- les six portes ----------
  PORTES.forEach((P, i) => {
    const a = angPorte(i), g = new THREE.Group(); g.position.set(Math.sin(a) * R_COUR, 0, Math.cos(a) * R_COUR); g.rotation.y = a; scene.add(g);
    // deux piliers, un arc plein cintre, une marche ; le dedans de l'arc : la porte du monde
    for (const s of [-1, 1]) { g.add(mesh(boxG(1.1, 5.2, 1.3), taille, s * 2.35, 2.6, 0)); g.add(mesh(boxG(1.5, 0.5, 1.6), taille, s * 2.35, 0.25, 0)); }
    const arc = mesh(new THREE.TorusGeometry(2.35, 0.55, 8, 24, Math.PI), taille, 0, 5.2, 0); arc.scale.z = 2.3; g.add(arc);
    g.add(mesh(boxG(5.9, 0.18, 2.2), taille, 0, 0.09, 0));
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.2), P.ouverte
      ? new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffc878, emissiveIntensity: 1.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
      : phMat('wood_cabinet_worn_long', 3.6, 5.2, { color: 0x4a3828, side: THREE.DoubleSide }));
    fond.position.set(0, 2.6, 0); g.add(fond);
    const haut = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24, 0, Math.PI), fond.material); haut.position.set(0, 5.2, 0); g.add(haut);
    if (!P.ouverte) for (const y of [1.2, 3.6]) g.add(mesh(boxG(3.5, 0.14, 0.12), mat(0x2a2a2e, { metalness: 0.7, roughness: 0.5 }), 0, y, 0.08));
    // le nom du monde, gravé sur le linteau, côté cour
    if (P.nom) { const n = new THREE.Mesh(boxG(4.2, 0.9, 0.2), [taille, taille, taille, taille, taille, plaqueGravee([{ t: P.nom }, { t: P.sous, italique: true, taille: 70 }], 4.2, 0.9, 120)]);
      n.position.set(0, 7.75, -0.6); n.rotation.y = Math.PI; g.add(n); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    for (const s of [-1, 1]) { const x = g.position.x + Math.cos(a) * s * 2.35, z = g.position.z - Math.sin(a) * s * 2.35; addCap(x, z, x, z, 0.85); }
  });

  // ---------- au loin, dans la brume : Lille, le seul monde ouvert ----------
  { const d = 430, a = 0.12, g = new THREE.Group(); g.position.set(Math.sin(a) * d, MER, Math.cos(a) * d); scene.add(g);
    const sil = mat(0x6a6070, { roughness: 1 });
    g.add(mesh(new THREE.CylinderGeometry(40, 55, 8, 12), sil, 0, 2, 0));
    for (let k = 0; k < 9; k++) g.add(mesh(boxG(8 + (k % 3) * 3, 10 + (k * 7) % 9, 9), sil, -26 + k * 6.5, 10, (k % 2 ? -6 : 4)));
    g.add(mesh(boxG(7, 42, 7), sil, 4, 27, 0)); g.add(mesh(new THREE.SphereGeometry(5, 12, 6, 0, TAU, 0, Math.PI / 2), sil, 4, 48, 0));
    g.add(mesh(new THREE.ConeGeometry(1.5, 9, 8), sil, 4, 57, 0)); }
}

function populate() {
  // Camille passe la porte de Lille : dans la cour, face à la tour
  player.pos.set(0, 0, R_COUR - 2.5); player.yaw = Math.PI; G.camYaw = 0;
}
function animate() { /* rien ne bouge sur l'île : c'est ce qui changera, retour après retour */ }
function minimap(g, W2) {
  const sc = 1.45, P = (x, z) => [W2 / 2 + x * sc, W2 / 2 + z * sc];
  g.fillStyle = '#4a5878'; g.fillRect(0, 0, W2, W2);
  g.fillStyle = '#8a8466'; g.beginPath(); g.arc(W2 / 2, W2 / 2, R_ILE * sc, 0, TAU); g.fill();
  g.fillStyle = '#b0a898'; g.beginPath(); g.arc(W2 / 2, W2 / 2, (R_COUR + 1.5) * sc, 0, TAU); g.fill();
  g.fillStyle = '#6a6458'; g.beginPath(); g.arc(W2 / 2, W2 / 2, R_TOUR * sc, 0, TAU); g.fill();
  PORTES.forEach((p, i) => { const a = angPorte(i), [x, z] = P(Math.sin(a) * R_COUR, Math.cos(a) * R_COUR); g.fillStyle = p.ouverte ? '#ffd48a' : '#3a3028'; g.fillRect(x - 3, z - 3, 6, 6); });
  minimapDots(g, P);
}
const level = {
  name: 'temple', echelle: 0.6, musique: 'mage', getH: (x, z) => hauteur(x, z), zoneName: () => 'L’île du temps',
  // la rive : on ne marche pas sur la mer
  blocked: (x, z) => Math.hypot(x, z) > R_ILE - 3,
  build, populate, animate, minimap,
  counts: () => '<small>L’île du temps — le Temple des Géants. Six portes, une seule ouverte.</small>',
  start: () => showMessage('Rien ne bouge. Ni la mer, ni les nuages. Même le vent s’est arrêté.', 6),
  arriveMessage: () => 'L’île du temps.',
  entry: () => ({ title: 'L’île du temps', sub: 'Le Temple des Géants', cam: [70, 40, 120], at: [0, 20, 0], cam2: [8, 4, R_COUR + 10], at2: [0, 14, 0], dur: 6 }),
  onKill: () => {},
};
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
