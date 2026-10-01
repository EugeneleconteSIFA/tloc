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
  { nom: 'LILLE', sous: 'la Grande Cloche', ouverte: true, geant: 'lyderic' },
  { nom: 'LE MIDI', sous: 'l’Aveyron', geant: 'dormeur' },
  { nom: 'LES ÎLES', sous: 'la mousson', geant: 'yak' },
  { nom: 'LES HEURES', sous: 'les Pouilles', geant: 'colosse' },
  { nom: 'LES TROUPEAUX', sous: 'la Lozère', geant: 'loup' },
  { nom: '', sous: '', geant: 'fissure' },            // la rive oubliée : pas encore de nom, une fêlure
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
    // la ligne tient dans la plaque, avec une marge : on réduit la police tant qu'elle déborde
    let tt = t; do { x.font = `${l.italique ? 'italic ' : ''}bold ${tt}px Georgia, serif`; tt -= 4; } while (x.measureText(l.t).width > W * 0.88 && tt > 12);
    x.fillStyle = 'rgba(255,250,235,0.55)'; x.fillText(l.t, W / 2 + 2, y + 2);     // l'arête éclairée
    x.fillStyle = l.couleur || 'rgba(40,32,24,0.92)'; x.fillText(l.t, W / 2, y);   // le creux
  });
  return new THREE.MeshStandardMaterial({ map: tex(c, 1), roughness: 0.9 });
}

// ---------------------------------------------------------------------
//  Les tympans sculptés : le géant de chaque monde, en bas-relief
// ---------------------------------------------------------------------
// Pas une image peinte : un RELIEF. On dessine la figure en niveaux de gris (le blanc sort de
// la pierre), on l'adoucit, on en tire une carte de normales, et on la pose sur la pierre
// photographiée — c'est la lumière qui creuse la figure, comme sur un vrai tympan.
// Le demi-disque : (256 ; 256) en bas au milieu, 256 de rayon.
const FIGURES = {
  lyderic(x) {        // le chevalier debout, l'épée levée, le bouclier au bras
    x.beginPath(); x.arc(256, 74, 26, 0, TAU); x.fill();                              // le heaume
    x.beginPath(); x.moveTo(214, 104); x.lineTo(298, 104); x.lineTo(312, 256); x.lineTo(200, 256); x.closePath(); x.fill();
    x.lineWidth = 16; x.lineCap = 'round'; x.beginPath(); x.moveTo(300, 120); x.lineTo(338, 160); x.stroke();   // le bras
    x.lineWidth = 9; x.beginPath(); x.moveTo(336, 168); x.lineTo(410, 20); x.stroke();                        // l'épée
    x.lineWidth = 6; x.beginPath(); x.moveTo(318, 150); x.lineTo(356, 172); x.stroke();                       // la garde
    x.beginPath(); x.ellipse(196, 170, 34, 46, 0, 0, TAU); x.fill();                                         // le bouclier
  },
  dormeur(x) {        // couché comme une falaise : une longue colline qui a un visage
    x.beginPath(); x.moveTo(40, 256); x.bezierCurveTo(90, 180, 170, 200, 230, 186); x.bezierCurveTo(290, 172, 330, 196, 372, 176);
    x.bezierCurveTo(400, 150, 440, 150, 458, 180); x.lineTo(476, 256); x.closePath(); x.fill();
    x.beginPath(); x.arc(424, 156, 26, 0, TAU); x.fill();                                                    // la tête, renversée
    x.beginPath(); x.ellipse(300, 182, 40, 14, -0.15, 0, TAU); x.fill();                                    // le bras replié
  },
  yak(x) {            // le gardien de temple : la couronne en flèche, la massue droite devant lui
    x.beginPath(); x.moveTo(256, 6); x.lineTo(280, 62); x.lineTo(232, 62); x.closePath(); x.fill();          // la couronne
    for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(256, 66 + k * 10, 30 - k * 3, 6, 0, 0, TAU); x.fill(); }
    x.beginPath(); x.arc(256, 104, 26, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(176, 140); x.lineTo(336, 140); x.lineTo(306, 256); x.lineTo(206, 256); x.closePath(); x.fill();
    x.fillStyle = '#ffffff'; x.fillRect(248, 120, 16, 136); x.beginPath(); x.arc(256, 122, 18, 0, TAU); x.fill();   // la massue
  },
  colosse(x) {        // la statue de bronze en robe, le bras levé qui tient la croix
    x.beginPath(); x.arc(250, 70, 24, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(222, 98); x.lineTo(280, 98); x.lineTo(320, 256); x.lineTo(184, 256); x.closePath(); x.fill();
    x.lineWidth = 15; x.lineCap = 'round'; x.beginPath(); x.moveTo(278, 110); x.lineTo(330, 60); x.stroke();
    x.lineWidth = 8; x.beginPath(); x.moveTo(334, 18); x.lineTo(334, 100); x.stroke(); x.beginPath(); x.moveTo(316, 38); x.lineTo(352, 38); x.stroke();
    x.beginPath(); x.arc(206, 168, 16, 0, TAU); x.fill();                                                    // le globe
  },
  loup(x) {           // la tête du loup qui hurle, le cou tendu vers le ciel
    x.beginPath(); x.moveTo(150, 256); x.lineTo(196, 150); x.lineTo(262, 70); x.lineTo(300, 22); x.lineTo(312, 40);
    x.lineTo(296, 74); x.lineTo(326, 96); x.lineTo(318, 118); x.lineTo(286, 120); x.lineTo(300, 150); x.lineTo(332, 256); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(256, 92); x.lineTo(244, 54); x.lineTo(272, 80); x.closePath(); x.fill();          // l'oreille
  },
  fissure(x) {        // la rive oubliée : pas de figure, une fêlure qui traverse la pierre
    x.strokeStyle = '#000000'; x.lineWidth = 10; x.lineJoin = 'miter'; x.beginPath(); x.moveTo(250, 256);
    for (const [px, py] of [[270, 210], [236, 170], [262, 120], [228, 80], [250, 30]]) x.lineTo(px, py); x.stroke();
  },
};
function tympan(nom) {
  const W = 512, H = 256, [c, x] = makeCanvas(W, H);
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);                                     // le fond du tympan, à mi-hauteur
  x.filter = 'blur(6px)'; x.fillStyle = '#ffffff'; x.strokeStyle = '#ffffff';   // adouci : des formes bombées, pas des plateaux
  FIGURES[nom](x); x.filter = 'none';
  // une bordure creusée qui suit l'arc : le tympan est encadré
  x.strokeStyle = '#3a3a3a'; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 244, Math.PI, TAU); x.stroke();
  const h = x.getImageData(0, 0, W, H).data;
  const at = (u, v) => { const i = Math.min(W - 1, Math.max(0, Math.round(u * (W - 1)))), j = Math.min(H - 1, Math.max(0, Math.round((1 - v) * (H - 1))));
    return h[(j * W + i) * 4] / 255; };
  // UN VRAI RELIEF, en géométrie : une carte de normales ne creusait presque rien sous la
  // lumière rasante du crépuscule. Une grille fine, chaque point poussé selon la hauteur
  // dessinée (18 cm au plus), et les points hors du demi-disque ramenés sur l'arc.
  const R = 1.8, g = new THREE.PlaneGeometry(2 * R, R, 150, 75); g.translate(0, R / 2, 0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let k = 0; k < p.count; k++) {
    let px = p.getX(k), py = p.getY(k); const r = Math.hypot(px, py);
    if (r > R) { px *= R / r; py *= R / r; p.setX(k, px); p.setY(k, py); }
    p.setZ(k, (at(px / (2 * R) + 0.5, py / R) - 0.5) * 0.6);
    uv.setXY(k, px / (2 * R) + 0.5, py / R);
  }
  g.computeVertexNormals();
  // la pierre photographiée ; le fond en retrait un peu plus sombre que la figure (l'ombre
  // du ciel y entre moins)
  // le grain et la rugosité d'une pierre photographiée, SANS sa couleur : les joints de la
  // pierre de taille rayaient la figure, les taches de la chaux la brouillaient — sur une
  // teinte unie de grès, c'est le relief seul qui dessine
  const m = phMat('marble_rock_02', 1.2, 0.6, { color: 0xcdbf9f });
  m.map = null; m.needsUpdate = true;
  const ao = x.createImageData(W, H);
  for (let k = 0; k < W * H; k++) { const o = 255 * (0.42 + 0.58 * Math.max(0, Math.min(1, (h[k * 4] / 255 - 0.5) * 2 + 0.5)));
    ao.data[k * 4] = ao.data[k * 4 + 1] = ao.data[k * 4 + 2] = o; ao.data[k * 4 + 3] = 255; }
  { const [c4, x4] = makeCanvas(W, H); x4.putImageData(ao, 0, 0); m.aoMap = tex(c4, 1, false); m.aoMapIntensity = 1; }
  return new THREE.Mesh(g, m);
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
    // le tympan : côté cour, le géant du monde en bas-relief ; côté large, la pierre nue
    { const t = tympan(P.geant); t.position.set(0, 5.2, -0.08); t.rotation.y = Math.PI; g.add(t);
      const dos = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32, 0, Math.PI), taille); dos.position.set(0, 5.2, 0.08); g.add(dos); }
    if (!P.ouverte) for (const y of [1.2, 3.6]) g.add(mesh(boxG(3.5, 0.14, 0.12), mat(0x2a2a2e, { metalness: 0.7, roughness: 0.5 }), 0, y, 0.08));
    // le nom du monde, gravé sur le linteau, côté cour
    if (P.nom) { const n = new THREE.Mesh(boxG(4.2, 0.9, 0.2), [taille, taille, taille, taille, taille, plaqueGravee([{ t: P.nom }, { t: P.sous, italique: true, taille: 70 }], 4.2, 0.9, 120)]);
      // devant l'arc et au-dessus : à 7,75 m, la plaque était noyée dans l'épaisseur de l'arc
      // la face gravée est la face −z de la boîte : celle qui regarde la cour, sans la retourner
      n.position.set(0, 8.75, -1.0); g.add(n); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    for (const s of [-1, 1]) { const x = g.position.x + Math.cos(a) * s * 2.35, z = g.position.z - Math.sin(a) * s * 2.35; addCap(x, z, x, z, 0.85); }
  });

  // ---------- les mondes ouverts : leur rive, et leur silhouette au loin ----------
  for (const [i, P] of PORTES.entries()) if (P.geant !== 'fissure' && ouverts().has(P.geant)) { deborder(i, P.geant); silhouette(i, P.geant); }
}

// Quels mondes sont ouverts : Lille seul pour l'instant (le prologue joué). L'aperçu
// `temple.html?mondes=tous` les ouvre tous, pour juger l'île telle qu'elle sera.
function ouverts() {
  if (/[?&]mondes=tous\b/.test(location.search)) return new Set(PORTES.map((p) => p.geant));
  return new Set(['lyderic']);
}
let FONDU = null;
// un point de la rive, en face de la porte i : à r mètres du centre, décalé de da radians
const rive = (i, r, da = 0) => { const a = angPorte(i) + da; return [Math.sin(a) * r, Math.cos(a) * r]; };

// LE DÉBORDEMENT : chaque monde ouvert passe un peu de lui-même sur la rive d'en face (docs/TEMPLE-ILE.md)
function deborder(i, monde) {
  // une plaque de sol posée sur le plateau, dans l'axe de la porte, entre deux rayons ; ses
  // bords se FONDENT dans l'herbe (un dégradé d'opacité) : une plaque à bord net faisait un
  // aplat posé là, pas un sol qui déborde
  const tache = (m, r0, r1, da, y = 0.05) => {
    const g = new THREE.PlaneGeometry(1, 1, 24, 10), p = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < p.count; k++) { const u = uv.getX(k), v = uv.getY(k), r = r0 + (r1 - r0) * v, [x, z] = rive(i, r, (u - 0.5) * 2 * da);
      p.setXYZ(k, x, hauteur(x, z) + y, z); }
    g.computeVertexNormals();
    if (!FONDU) { const [c, x] = makeCanvas(128, 128), gr = x.createRadialGradient(64, 64, 18, 64, 64, 64);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#b0b0b0'); gr.addColorStop(1, '#000000'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); FONDU = tex(c, 1, false); }
    m.alphaMap = FONDU; m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.side = THREE.DoubleSide;
    const t = new THREE.Mesh(g, m); t.receiveShadow = true; t.renderOrder = 1; scene.add(t); return t; };
  if (monde === 'lyderic') {
    // Lille : des pavés de grès et un réverbère, au bout du chemin de la porte
    tache(phMat('worn_tile_floor', 4, 6, { color: 0xc8beb0 }), 31, 40, 0.13);
    const [x, z] = rive(i, 38, 0.1), fer = mat(0x22252a, { metalness: 0.7, roughness: 0.5 });
    scene.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 8), fer, x, hauteur(x, z) + 1.7, z));
    scene.add(mesh(boxG(0.36, 0.5, 0.36), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffb860, emissiveIntensity: 1.4 }), x, hauteur(x, z) + 3.6, z));
  } else if (monde === 'dormeur') {
    // le Midi : la terre rouge craquelée de la sécheresse, des touffes d'herbe brûlée
    tache(phMat('terre_battue', 8, 10, { color: 0xd07a52 }), 30, 47, 0.2);
    for (let k = 0; k < 18; k++) { const [x, z] = rive(i, 33 + (k * 7) % 13, -0.17 + (k % 9) * 0.04);
      const t = mesh(new THREE.ConeGeometry(0.35, 0.5, 6), phMat('withered_grass', 0.5, 0.5, { color: 0xc8a860 }), x, hauteur(x, z) + 0.2, z); scene.add(t); }
  } else if (monde === 'yak') {
    // les Îles : la pluie de la mousson, arrêtée en l'air — des gouttes qui ne tombent plus
    tache(phMat('mousse', 6, 8, { color: 0x8aa874 }), 31, 46, 0.17);
    const n = 900, gt = new THREE.CylinderGeometry(0.012, 0.012, 0.28, 4), im = new THREE.InstancedMesh(gt,
      new THREE.MeshStandardMaterial({ color: 0xc8d8e8, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.2 }), n);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < n; k++) { const [x, z] = rive(i, 31 + Math.random() * 15, (Math.random() - 0.5) * 0.34);
      im.setMatrixAt(k, m4.makeRotationZ(0.08).setPosition(x, hauteur(x, z) + 0.4 + Math.random() * 9, z)); }
    scene.add(im);
  } else if (monde === 'colosse') {
    // les Heures : le sable mouillé d'une marée qui monte trop vite, figée en pleine montée
    tache(phMat('gravier', 6, 8, { color: 0xe0cca0 }), 33, 49, 0.17);
    const vague = tache(new THREE.MeshStandardMaterial({ color: 0x6a8aa8, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.6 }), 43, 49, 0.17, 0.25);
    vague.renderOrder = 2;
  } else if (monde === 'loup') {
    // les Troupeaux : un muret de pierre sèche, une sonnaille au piquet, la brume des Cévennes
    tache(phMat('rocky_trail', 6, 8, { color: 0xb8b4a4 }), 32, 46, 0.15);
    for (let k = 0; k < 14; k++) { const [x, z] = rive(i, 41, -0.12 + k * 0.018);
      const b = mesh(boxG(0.7, 0.35 + (k % 3) * 0.12, 0.5), phMat('old_stone_wall_02', 0.7, 0.4, { color: 0x9a948a }), x, hauteur(x, z) + 0.3, z); b.rotation.y = angPorte(i) + Math.PI / 2 + (k % 2) * 0.1; b.castShadow = true; scene.add(b); }
    const [x, z] = rive(i, 37, 0.08);
    scene.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.4, 6), phMat('wood_cabinet_worn_long', 0.2, 1.4, { color: 0x5a4430 }), x, hauteur(x, z) + 0.7, z));
    scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.24, 4), mat(0x8a6a3a, { metalness: 0.7, roughness: 0.5 }), x, hauteur(x, z) + 1.2, z + 0.12));
    for (let k = 0; k < 5; k++) { const [bx, bz] = rive(i, 34 + k * 3, (k - 2) * 0.06);
      const br = new THREE.Mesh(new THREE.PlaneGeometry(9, 3), new THREE.MeshBasicMaterial({ color: 0xe8e4f0, transparent: true, opacity: 0.18, depthWrite: false }));
      br.position.set(bx, hauteur(bx, bz) + 1.2 + k * 0.3, bz); br.rotation.y = angPorte(i); scene.add(br); }
  }
}

// LA SILHOUETTE : le monde ouvert sort de la brume, au large, dans l'axe de sa porte
function silhouette(i, monde) {
  const d = 430, a = angPorte(i) + 0.12, g = new THREE.Group(); g.position.set(Math.sin(a) * d, MER, Math.cos(a) * d); g.rotation.y = a; scene.add(g);
  const sil = mat(0x6a6070, { roughness: 1 });
  if (monde === 'lyderic') {                      // Lille et son beffroi
    g.add(mesh(new THREE.CylinderGeometry(40, 55, 8, 12), sil, 0, 2, 0));
    for (let k = 0; k < 9; k++) g.add(mesh(boxG(8 + (k % 3) * 3, 10 + (k * 7) % 9, 9), sil, -26 + k * 6.5, 10, (k % 2 ? -6 : 4)));
    g.add(mesh(boxG(7, 42, 7), sil, 4, 27, 0)); g.add(mesh(new THREE.SphereGeometry(5, 12, 6, 0, TAU, 0, Math.PI / 2), sil, 4, 48, 0));
    g.add(mesh(new THREE.ConeGeometry(1.5, 9, 8), sil, 4, 57, 0));
  } else if (monde === 'dormeur') {               // le causse, et le Dormeur couché sur l'horizon
    g.add(mesh(new THREE.CylinderGeometry(90, 110, 22, 16), sil, 0, 10, 0));
    const c = mesh(new THREE.SphereGeometry(30, 16, 8), sil, -20, 22, 0); c.scale.set(2.2, 0.5, 1); g.add(c);
    g.add(mesh(new THREE.SphereGeometry(12, 12, 8), sil, 45, 28, 0));
  } else if (monde === 'yak') {                   // les pitons de calcaire
    for (let k = 0; k < 7; k++) { const h = 40 + (k * 17) % 45; g.add(mesh(new THREE.CylinderGeometry(6 + k % 3 * 2, 12 + k % 2 * 4, h, 9), sil, -60 + k * 20, h / 2, (k % 2 ? 15 : -10))); }
  } else if (monde === 'colosse') {               // la ville blanche et ses remparts
    g.add(mesh(new THREE.CylinderGeometry(55, 60, 10, 14), sil, 0, 4, 0));
    for (let k = 0; k < 12; k++) g.add(mesh(boxG(7, 8 + (k * 5) % 9, 7), sil, -36 + k * 6.5, 12, (k % 3) * 5 - 5));
    g.add(mesh(boxG(9, 30, 9), sil, 10, 22, 0));
  } else if (monde === 'loup') {                  // la montagne, et la tour de la Garde-Guérin
    const m = mesh(new THREE.ConeGeometry(110, 70, 10), sil, 0, 35, 0); m.scale.z = 0.6; g.add(m);
    g.add(mesh(boxG(6, 22, 6), sil, 30, 52, 0));
  }
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
