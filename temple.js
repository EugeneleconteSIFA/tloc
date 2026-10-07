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
  addCap, addHelix, addInteract, goToLevel, showMessage, bootLevel, minimapDots, makeSky, player, state, dialogue, cutscene, saveGame } from './engine.js?v=41';
import { DONJON } from './carte.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R_ILE = 50, R_COUR = 26, R_TOUR = 10, EP_TOUR = 1.4, H_TOUR = 72;
const MER = -1.3;
const PROPHETIE = { plaque: null, vus: '', rai: null };   // la plaque des vers (graverProphetie, plus bas)                                    // la mer figée, sous le bord de l'île
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

// (5 octobre) DES UV EN MÈTRES. Le sol de l'île et la cour sont des anneaux : leurs UV
// d'origine tendaient UNE tuile de texture sur toute l'île (112 m), d'où l'herbe floue et les
// grandes dalles sombres. Ici, u = x et v = z : phMat(slug, 1, 1) retrouve l'échelle réelle.
function uvMetres(g) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  uv.needsUpdate = true; return g;
}
// Des morceaux d'un même matériau, chacun posé par sa matrice, en UN maillage : la couronne de
// la tour, ses contreforts, les rochers de la rive, le ponton comptent des centaines de pièces.
// `metres` : des UV en mètres, projetées selon l'orientation de chaque face (le dessus en x,z,
// les côtés en longueur, hauteur) — les UV d'une boîte vont de 0 à 1 sur chaque face quelle que
// soit sa taille, et la pierre d'un flanc de jetée de 11 m s'y étirait en fausses planches.
function fusion(morceaux, m, ombre = true, metres = false) {
  const g = mergeGeometries(morceaux.map(([geo, M]) => { const q = geo.index ? geo.toNonIndexed() : geo.clone(); q.deleteAttribute('uv2'); return q.applyMatrix4(M); }));
  if (metres) { const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
      if (ny > 0.6) uv.setXY(i, p.getX(i), p.getZ(i)); else if (nx > nz) uv.setXY(i, p.getZ(i), p.getY(i)); else uv.setXY(i, p.getX(i), p.getY(i)); } }
  const o = new THREE.Mesh(g, m); o.castShadow = ombre; o.receiveShadow = true; scene.add(o); return o;
}
const MAT4 = (x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(sx, sy, sz));

// hauteur du sol : le plateau plat jusqu'à la rive, puis la roche qui plonge dans la mer
function hauteur(x, z) {
  const r = Math.hypot(x, z);
  if (r < R_ILE - 6) return 0;
  const t = Math.min(1, (r - (R_ILE - 6)) / 10);
  return -t * t * 4.2;
}

// une plaque gravée : lettres creusées (ombre dessous, lumière dessus) dans la pierre claire
// (W : la largeur du canevas ; une gravure faite APRÈS le chargement se fait à 512 px, la taille où le
// moteur ramène les textures — en 1024, elle sortait deux fois, à l'échelle et en grand : banc acte2-temple)
function plaqueGravee(lignes, w, h, taille, W = 1024) {
  const H = Math.round(W * h / w), [c, x] = makeCanvas(W, H);
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

  // (5 octobre) LES TEINTES. Sous le soleil doré du crépuscule, les pierres teintées sable
  // viraient au brun orangé ; Eugène aime le violet pastel de la première planche : les pierres
  // passent au gris lilas, le soleil leur rend la chaleur.
  const roche = phMat('rocher_01', 1, 1, { color: 0x8e8890 });
  const herbe = phMat('grass_ground', 1, 1, { color: 0xb6b69c });
  const pave = phMat('worn_tile_floor', 1, 1, { color: 0xc4bcc2 });
  const pierre = phMat('old_stone_wall_02', 4, 4, { color: 0xc0b8c4 });
  const taille = phMat('old_stone_wall_02', 2, 2, { color: 0xd8d0d6 });
  const bois = phMat('wood_cabinet_worn_long', 2, 2, { color: 0x5a4430 });
  const fer = mat(0x3a3a40, { metalness: 0.8, roughness: 0.45 });

  // ---------- la mer figée : un miroir, qui renvoie le ciel ----------
  mer = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), new THREE.MeshStandardMaterial({ color: 0x4a5878, roughness: 0.04, metalness: 0.92 }));
  mer.rotation.x = -Math.PI / 2; mer.position.y = MER; scene.add(mer);

  // ---------- l'île : le plateau, la rive de roche ----------
  // un anneau maillé en 40 cercles, pas un disque : CircleGeometry n'a que son centre et son
  // bord, et le relief de la rive en faisait un cône qui plongeait sous la mer dès 12 m
  // Deux anneaux sur le même relief : la roche de la rive, d'un bord à l'autre, et l'herbe du
  // plateau par-dessus, qui s'efface sur ses trois derniers mètres (opacité de sommet).
  { const anneau = (r0, r1, nr, dy) => { const g = new THREE.RingGeometry(r0, r1, 120, nr); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
        // la rive n'est pas un cercle : des avancées et des criques, figées comme le reste
        const k = r > R_ILE - 10 ? 1 + 0.05 * Math.sin(a * 5) + 0.03 * Math.sin(a * 13 + 1) : 1;
        p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, hauteur(x, z) - (r > R_ILE + 2 ? 2 : 0) + dy); }
      g.computeVertexNormals(); return uvMetres(g); };
    const rive = new THREE.Mesh(anneau(R_ILE - 9, R_ILE + 6, 16, 0), roche); rive.receiveShadow = true; scene.add(rive);
    const g = anneau(0, R_ILE - 3, 48, 0.02), p = g.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)), a = Math.atan2(p.getZ(i), p.getX(i));
      col.push(1, 1, 1, Math.max(0, Math.min(1, (R_ILE - 3.2 + Math.sin(a * 9) * 0.8 - r) / 3))); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    herbe.transparent = true; herbe.vertexColors = true;
    const sol = new THREE.Mesh(g, herbe); sol.receiveShadow = true; sol.renderOrder = 1; scene.add(sol);
    // LA RIVE : une couronne de rochers à demi noyés. C'étaient des dodécaèdres aplatis — des
    // chapeaux posés sur l'eau ; ce sont des blocs bosselés (un icosaèdre dont chaque sommet
    // est poussé ou rentré), plus enfoncés, tous en un seul maillage.
    const blocs = [];
    for (let k = 0; k < 84; k++) { const a = k / 84 * TAU + Math.sin(k * 7.3) * 0.04, r = R_ILE + 0.5 + Math.sin(k * 3.1) * 2.8;
      if (Math.abs(Math.atan2(Math.sin(a - A_PONTON), Math.cos(a - A_PONTON))) < 0.16) continue;   // le port passe là
      const s = 1.4 + Math.abs(Math.sin(k * 5.7)) * 2.6, ge = new THREE.IcosahedronGeometry(1, 2), q = ge.attributes.position;
      for (let i = 0; i < q.count; i++) { const v = V(q.getX(i), q.getY(i), q.getZ(i)), n = 1 + 0.22 * Math.sin(v.x * 3.1 + k) * Math.sin(v.y * 2.7 + k * 0.7) + 0.12 * Math.sin(v.z * 5.3 + k * 1.3);
        q.setXYZ(i, v.x * n, v.y * n * 0.62, v.z * n); }
      ge.computeVertexNormals();
      blocs.push([ge, MAT4(Math.sin(a) * r, MER - s * 0.32, Math.cos(a) * r, k * 2.1, 0.15 * Math.sin(k), 0.1 * Math.cos(k), s, s, s * 1.25)]); }
    fusion(blocs, roche); }

  // ---------- la cour ronde ----------
  { const gc = new THREE.RingGeometry(R_TOUR, R_COUR + 1.5, 120, 8); gc.rotateX(-Math.PI / 2); uvMetres(gc);
    const c = new THREE.Mesh(gc, pave); c.position.y = 0.03; c.receiveShadow = true; scene.add(c);
    // trois cercles de pierre de taille dans le dallage : la cour se lit comme un plan tracé
    for (const r of [R_TOUR + 4.5, R_TOUR + 9.5]) { const b = new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 4, 120), taille); b.rotation.x = Math.PI / 2; b.position.y = 0.04; b.scale.z = 0.18; b.receiveShadow = true; scene.add(b); }
    const b = new THREE.Mesh(new THREE.TorusGeometry(R_COUR + 1.5, 0.28, 6, 120), taille); b.rotation.x = Math.PI / 2; b.position.y = 0.06; b.scale.z = 0.4; scene.add(b); }

  // ---------- la tour creuse ----------
  { const porte = 0.22;                                       // demi-ouverture de la porte, en radians (côté sud)
    const mur = new THREE.Mesh(new THREE.CylinderGeometry(R_TOUR, R_TOUR + 0.6, H_TOUR, 72, 12, true, porte, TAU - 2 * porte), pierre);
    // la texture court sur tout le tour (63 m) et toute la hauteur : à l'échelle, sinon les pierres s'étirent
    mur.position.y = H_TOUR / 2; mur.material = phMat('old_stone_wall_02', TAU * R_TOUR, H_TOUR, { color: 0xbab2c8, side: THREE.DoubleSide });
    mur.castShadow = mur.receiveShadow = true; scene.add(mur);
    const dedans = new THREE.Mesh(new THREE.CylinderGeometry(R_TOUR - EP_TOUR, R_TOUR - EP_TOUR, H_TOUR, 72, 12, true, porte, TAU - 2 * porte), phMat('old_stone_wall_02', TAU * (R_TOUR - EP_TOUR), H_TOUR, { color: 0xa49eb0, side: THREE.BackSide }));
    dedans.position.y = H_TOUR / 2; dedans.receiveShadow = true; scene.add(dedans);
    // le linteau au-dessus de la porte, et les deux joues
    const lin = new THREE.Mesh(new THREE.CylinderGeometry(R_TOUR + 0.05, R_TOUR + 0.6, H_TOUR - 9, 24, 1, true, -porte, 2 * porte), pierre);
    lin.position.y = 9 + (H_TOUR - 9) / 2; lin.material = phMat('old_stone_wall_02', 2 * porte * R_TOUR, H_TOUR - 9, { color: 0xbab2c8, side: THREE.DoubleSide }); scene.add(lin);
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
    // (5 octobre) CE QUI FAIT UNE TOUR. C'était un cylindre lisse de 72 m, sans pied ni tête :
    // un silo. Elle prend un soubassement à deux degrés, douze contreforts qui montent en
    // s'amincissant, une baie étroite à chaque étage (là où pendront les cloches), et un
    // couronnement sur corbeaux, à créneaux, d'où l'on verrait les six mondes.
    { const ouvert = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < porte + 0.08;
      const socle = [], contreforts = [], baies = [], couronne = [];
      for (const [r, h] of [[R_TOUR + 1.6, 0.55], [R_TOUR + 1.0, 1.25]])
        socle.push([new THREE.CylinderGeometry(r, r + 0.15, h, 72, 1, false, porte + 0.06, TAU - 2 * porte - 0.12), MAT4(0, h / 2, 0)]);
      for (let c = 0; c < 12; c++) { const a = (c + 0.5) / 12 * TAU; if (ouvert(a)) continue;
        for (const [y0, y1, w, d] of [[0, 24, 1.5, 1.2], [24, 48, 1.2, 0.9], [48, H_TOUR - 4, 0.9, 0.6]]) {
          const r = R_TOUR + 0.35 + d / 2; contreforts.push([new THREE.BoxGeometry(w, y1 - y0, d), MAT4(Math.sin(a) * r, (y0 + y1) / 2, Math.cos(a) * r, a)]);
          // le glacis en haut de chaque ressaut : le contrefort s'amincit par une pente, pas une marche
          contreforts.push([new THREE.BoxGeometry(w, 0.9, d * 0.8), MAT4(Math.sin(a) * (r + 0.05), y1 - 0.1, Math.cos(a) * (r + 0.05), a, -0.55)]); } }
      // (entre deux contreforts : à (c + 0,25) / 6, elles tombaient pile dans leur axe, cachées)
      for (let k = 0; k < 6; k++) for (let c = 0; c < 6; c++) { const a = (c + (k % 2) * 0.5) / 6 * TAU; if (ouvert(a)) continue;
        const y = 14 + k * 11 + 1.2, r = R_TOUR + 0.62;
        baies.push([new THREE.PlaneGeometry(0.95, 3.0), MAT4(Math.sin(a) * r, y, Math.cos(a) * r, a)]);
        couronne.push([new THREE.BoxGeometry(1.5, 0.25, 0.45), MAT4(Math.sin(a) * (r + 0.1), y - 1.6, Math.cos(a) * (r + 0.1), a)]);
        couronne.push([new THREE.CylinderGeometry(0.75, 0.75, 0.4, 12, 1, false, -Math.PI / 2, Math.PI), MAT4(Math.sin(a) * (r + 0.05), y + 1.5, Math.cos(a) * (r + 0.05), a, Math.PI / 2, 0, 1, 1, 0.6)]); }
      // le couronnement : quarante-huit corbeaux, un parapet en encorbellement, vingt-quatre merlons
      for (let c = 0; c < 48; c++) { const a = c / 48 * TAU;
        couronne.push([new THREE.BoxGeometry(0.5, 1.4, 1.5), MAT4(Math.sin(a) * (R_TOUR + 0.8), H_TOUR - 2.2, Math.cos(a) * (R_TOUR + 0.8), a)]); }
      couronne.push([new THREE.CylinderGeometry(R_TOUR + 1.6, R_TOUR + 1.6, 2.6, 72, 1, true), MAT4(0, H_TOUR - 0.2, 0)]);
      couronne.push([new THREE.CylinderGeometry(R_TOUR + 1.25, R_TOUR + 1.25, 2.6, 72, 1, true), MAT4(0, H_TOUR - 0.2, 0)]);
      couronne.push([new THREE.RingGeometry(R_TOUR - 0.2, R_TOUR + 1.6, 72, 1), MAT4(0, H_TOUR - 1.5, 0, 0, Math.PI / 2)]);
      for (let c = 0; c < 24; c++) { const a = (c + 0.5) / 24 * TAU;
        couronne.push([new THREE.BoxGeometry(1.5, 1.3, 0.5), MAT4(Math.sin(a) * (R_TOUR + 1.42), H_TOUR + 1.75, Math.cos(a) * (R_TOUR + 1.42), a)]); }
      fusion(socle, phMat('old_stone_wall_02', 1, 1, { color: 0xb8b0ba }), true, true);
      fusion(contreforts, phMat('old_stone_wall_02', 1, 1, { color: 0xc6bec8 }), true, true);
      fusion(couronne, phMat('old_stone_wall_02', 1, 1, { color: 0xd8d0d6, side: THREE.DoubleSide }), true, true);
      // (une pierre teintée presque noire, l'embrasure dans l'ombre : un aplat uni, le moteur le
      // repeint — il n'en veut pas, cf. le style réaliste)
      fusion(baies, phMat('old_stone_wall_02', 1, 1, { color: 0x1c1820, roughness: 1, side: THREE.DoubleSide }), false, true).name = 'baies-de-la-tour'; }
    // collisions : le mur de la tour, sauf la porte
    for (let c = 0; c < 40; c++) { const a = (c + 0.5) / 40 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < porte + 0.05) continue;
      const x = Math.sin(a) * (R_TOUR - EP_TOUR / 2), z = Math.cos(a) * (R_TOUR - EP_TOUR / 2); addCap(x, z, x, z, 1.0); } }

  // ---------- la prophétie, au pied de la tour, à droite de la porte ----------
  { const a = 0.55, r = R_TOUR + 0.75;
    const p = new THREE.Mesh(boxG(5.2, 2.6, 0.25), [taille, taille, taille, taille, plaqueGravee([
      { t: 'Quand la Grande Cloche se fendra,', italique: true }, { t: 'le géant du Buc sortira.', italique: true },
      { t: '· · ·', couleur: 'rgba(40,32,24,0.35)' }, { t: '· · ·', couleur: 'rgba(40,32,24,0.35)' }, { t: '· · ·', couleur: 'rgba(40,32,24,0.35)' }, { t: '· · ·', couleur: 'rgba(40,32,24,0.35)' },
    ], 5.2, 2.6, 54), taille]);
    p.position.set(Math.sin(a) * r, 1.9, Math.cos(a) * r); p.rotation.y = a; p.castShadow = true; scene.add(p);
    // la face qu'on regrave (graverProphetie) : un panneau à part, 1 cm devant la plaque — changer la
    // matière de la boîte laissait l'ancienne gravure par-dessus (banc acte2-temple)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 2.5), mat(0xb9b1a2)); face.userData.dynamic = true;
    face.position.set(Math.sin(a) * (r + 0.135), 1.9, Math.cos(a) * (r + 0.135)); face.rotation.y = a; face.visible = false; scene.add(face); PROPHETIE.plaque = face; }

  // ---------- les six portes ----------
  const PILIER = phMat('old_stone_wall_02', 1.2, 5.2, { color: 0xd8d0d6 });
  PORTES.forEach((P, i) => {
    const a = angPorte(i), g = new THREE.Group(); g.position.set(Math.sin(a) * R_COUR, 0, Math.cos(a) * R_COUR); g.rotation.y = a; scene.add(g);
    // deux piliers, un arc plein cintre, une marche ; le dedans de l'arc : la porte du monde
    // (la pierre des piliers à la taille de leur face : calée sur 2 m, elle s'étirait sur 5,2)
    for (const s of [-1, 1]) { g.add(mesh(boxG(1.1, 5.2, 1.3), PILIER, s * 2.35, 2.6, 0)); g.add(mesh(boxG(1.5, 0.5, 1.6), taille, s * 2.35, 0.25, 0)); }
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
    // la porte des Troupeaux mène à Villefort, place du Bosquet, devant la porte de l'île (acte V,
    // Eugène, 7 octobre : l'acte commence au bourg ; le Pouget se gagne par le vieux chemin)
    if (P.geant === 'loup') addInteract({ pos: g.position.clone().setY(0), r: 3.2, prompt: () => 'pousser la porte des Troupeaux',
      fn: () => goToLevel('villefort', [1568, 0, -1146.5], 0, 'La porte s’ouvre sur un bourg de pierre sombre…') });
    // le Midi mène au lac de Saint-Gervais, les Îles à la baie des pitons, les Heures à Alberobello, dans un trullo (Eugène,
    // 2 octobre, comme docs/SCENARIO.md) — provisoires comme les
    // Troupeaux ; les autres portes disent au moins qu'elles ne s'ouvrent pas encore
    // (5 octobre, Eugène : on n'arrivait pas toujours au portail) On arrive DEVANT LE PORTAIL du
    // monde, à 3 m, du côté où l'on marche, dos à l'arc — relevé au banc dans chaque lieu (ses
    // `portes`, monde.js ; le Pouget, pouget.js). Les anciennes arrivées dataient d'avant le
    // resserrement des lieux : le ponton de Somsak en Thaïlande, à 90 m de la porte ; la place du
    // Pouget, à 160 m. Si une porte bouge dans son lieu, son arrivée bouge ici aussi.
    const VERS = { dormeur: ['aveyron', [-127.9, 0, 143.7], -2.442, 'la porte du Midi', 'La porte s’ouvre sur un soleil qui ne bouge pas…'],
      colosse: ['alberobello', [6.5, 0, 4.6], Math.PI, 'la porte des Heures', 'La porte s’ouvre sous un toit de pierre en cône…'],
      // les Îles mènent à Ko Panyi, au village sur pilotis de la baie des pitons (2 octobre)
      yak: ['thailande', [60.47, 0, -75.24], -2.842, 'la porte des Îles', 'La porte s’ouvre sur une pluie qui ne tombe pas…'] };
    if (VERS[P.geant]) { const [lieu, pos, yaw, nomP, label] = VERS[P.geant];
      addInteract({ pos: g.position.clone().setY(0), r: 3.2, prompt: () => 'pousser ' + nomP, fn: () => goToLevel(lieu, pos, yaw, label) }); }
    else if (!P.ouverte && P.geant !== 'loup') addInteract({ pos: g.position.clone().setY(0), r: 3.2, prompt: () => 'pousser la porte',
      fn: () => showMessage(P.geant === 'fissure' ? 'La pierre est fendue. Rien ne bouge derrière.' : 'La porte ne s’ouvre pas encore.', 4) });
    // la porte de Lille ramène à la dalle du donjon (le passage provisoire, quetes.js)
    if (P.ouverte) addInteract({ pos: g.position.clone().setY(0), r: 3.2, prompt: () => 'repasser la porte de Lille',
      fn: () => goToLevel('citadel', [DONJON.x + 7, 0, DONJON.gateZ + 8.5], 0, 'Retour à Lille…') });
  });

  // ---------- les mondes ouverts : leur rive, et leur silhouette au loin ----------
  for (const [i, P] of PORTES.entries()) if (P.geant !== 'fissure' && ouverts().has(P.geant)) { deborder(i, P.geant); silhouette(i, P.geant); }
  for (const [i, P] of PORTES.entries()) if (i > 0 && P.geant !== 'fissure' && ouverts().has(P.geant)) pendreCloche(i, P.geant);
  if (ouverts().has('colosse')) cadran();
  barque();
}

// ---------------------------------------------------------------------
//  Le temps qui repart (docs/DECISIONS-RECIT.md § 2 et 3)
// ---------------------------------------------------------------------
// Chaque monde ouvert pend sa cloche à son étage de la tour — une silhouette par monde, qu'on
// reconnaît pendues ensemble — et remet une chose en marche. Lille seul ouvert : rien ne
// bouge encore. La Grande Cloche, elle, n'a que son crochet vide, tout en haut.
const BOUGE = { cloches: [], aiguille: null };
function pendreCloche(i, monde) {
  const y = 14 + (i - 1) * 11, g = new THREE.Group(); g.position.set(0, y - 0.2, 0); scene.add(g);
  const tourne = (prof, m) => { const l = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, -h)), 32), m); l.material.side = THREE.DoubleSide; l.castShadow = true; return l; };
  if (monde === 'dormeur') {                     // le Midi : une cloche de ferme trapue, en fer rouillé
    g.add(tourne([[0, 0], [0.3, 0.02], [0.42, 0.15], [0.45, 0.6], [0.5, 0.95], [0.56, 1.0]], phMat('metal_plate_02', 0.8, 0.8, { color: 0x9a5a36, roughness: 0.75 })));
  } else if (monde === 'yak') {                  // les Îles : haute et fine, bronze clair et feuilles d'or, frappée de l'extérieur
    g.add(tourne([[0, 0], [0.18, 0.02], [0.3, 0.2], [0.34, 0.8], [0.4, 1.35], [0.44, 1.45]], mat(0xd8b04a, { metalness: 0.85, roughness: 0.3 })));
  } else if (monde === 'colosse') {              // les Heures : une cloche d'horloge plate et large, vert-de-gris
    g.add(tourne([[0, 0], [0.4, 0.02], [0.62, 0.15], [0.68, 0.4], [0.72, 0.55]], phMat('metal_plate_02', 0.8, 0.8, { color: 0x6a9a84, metalness: 0.5, roughness: 0.55 })));
  } else if (monde === 'loup') {                 // les Troupeaux : une sonnaille géante, tôle rivée en tronc de pyramide
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 1.1, 4, 1, true), phMat('metal_plate_02', 0.8, 0.8, { color: 0x8a6a3a, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
    s.rotation.y = Math.PI / 4; s.position.y = -0.55; s.castShadow = true; g.add(s);
  }
  BOUGE.cloches.push({ g, ph: i * 1.7 });
}
// les Heures : un grand cadran sur la tour, au-dessus de la porte, dont l'aiguille va trop vite
function cadran() {
  const a = 0, r = R_TOUR + 0.65, y = 24, x = Math.sin(a) * r, z = Math.cos(a) * r;
  const fond = new THREE.Mesh(new THREE.CircleGeometry(3, 48), plaqueGravee([{ t: 'XII', taille: 90 }, { t: ' ' }, { t: 'VI', taille: 90 }], 3, 3, 90));
  fond.position.set(x, y, z); scene.add(fond);
  const cercle = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.14, 8, 48), mat(0x6a9a84, { metalness: 0.5, roughness: 0.55 })); cercle.position.set(x, y, z + 0.02); scene.add(cercle);
  const ai = new THREE.Group(); ai.position.set(x, y, z + 0.08); scene.add(ai);
  ai.add(mesh(boxG(0.14, 2.5, 0.05), mat(0x2a2a2e, { metalness: 0.7, roughness: 0.4 }), 0, 1.15, 0)); BOUGE.aiguille = ai;
}
// LE PORT DU PASSEUR (5 octobre, Eugène : « améliore le port »). C'était une planche sur
// pilotis, posée 45 cm au-dessus de l'herbe, et une demi-sphère aplatie en guise de barque. Au
// nord-est, dans l'axe A_PONTON : une jetée de pierre de plain-pied avec l'île, sa margelle, un
// escalier qui descend à l'eau et deux bittes d'amarrage ; au bout, un ponton de planches sur
// pieux, sa lanterne ; à quai, la barque — une coque bordée, ses bancs, ses avirons, sa
// lanterne de poupe — et le passeur, qui ne regarde que le large.
const A_PONTON = 2.6, JETEE = [R_ILE - 8, R_ILE + 3, 2.3], PONTON = [R_ILE + 3, R_ILE + 12.5, 1.25];
// on marche sur la jetée et sur le ponton, de plain-pied avec l'île (y = 0)
function surPonton(x, z) {
  const r = x * Math.sin(A_PONTON) + z * Math.cos(A_PONTON), d = x * Math.cos(A_PONTON) - z * Math.sin(A_PONTON);
  return (r > JETEE[0] && r < JETEE[1] && Math.abs(d) < JETEE[2] - 0.3) || (r >= JETEE[1] && r < PONTON[1] && Math.abs(d) < PONTON[2] - 0.15);
}
function barque() {
  const a = A_PONTON, pt = (r, d = 0) => [Math.sin(a) * r + Math.cos(a) * d, Math.cos(a) * r - Math.sin(a) * d];
  // (r : la distance au centre de l'île, y : la hauteur, d : l'écart latéral à l'axe du port)
  const M = (r, y, d, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const [x, z] = pt(r, d); return MAT4(x, y, z, a + ry, rx, rz, sx, sy, sz); };
  const pierreJ = phMat('old_stone_wall_02', 1, 1, { color: 0xb4acb6 }), margelle = phMat('old_stone_wall_02', 1, 1, { color: 0xd8d0d6 });
  const planche = phMat('wood_planks', 2.4, 0.5, { color: 0x8a7c6e }), poutre = phMat('wood_planks', 1, 3, { color: 0x5e5244 });
  const pieu = phMat('tree_trunk', 0.6, 3, { color: 0x5a5048 }), fer = phMat('metal_plate_02', 0.5, 0.5, { color: 0x3a3a42, metalness: 0.8, roughness: 0.5 });
  const corde = phMat('withered_grass', 0.4, 0.4, { color: 0xa08a64 });
  // ---- la jetée : un massif de pierre, de la rive jusqu'à 3 m dans l'eau ----
  { const [r0, r1, w] = JETEE, L = r1 - r0, bas = MER - 1.8;
    fusion([[new THREE.BoxGeometry(2 * w, -bas, L), M((r0 + r1) / 2, bas / 2 - 0.02, 0)]], pierreJ, true, true);
    // le dallage du dessus, aux UV en mètres
    const g = new THREE.PlaneGeometry(2 * w - 0.6, L); g.applyMatrix4(M((r0 + r1) / 2, 0.005, 0, 0, -Math.PI / 2)); uvMetres(g);
    const top = new THREE.Mesh(g, phMat('worn_tile_floor', 1, 1, { color: 0xc4bcc2 })); top.receiveShadow = true; scene.add(top);
    const pieces = [];
    for (const s of [-1, 1]) pieces.push([new THREE.BoxGeometry(0.42, 0.16, L), M((r0 + r1) / 2, 0.06, s * (w - 0.21))]);     // la margelle
    pieces.push([new THREE.BoxGeometry(2 * w, 0.16, 0.42), M(r1 - 0.21, 0.06, 0)]);
    // l'escalier qui descend à l'eau, le long du flanc ouest de la jetée
    for (let k = 0; k < 8; k++) { const y = -0.18 * (k + 1), r = R_ILE - 2.6 + k * 0.62;
      pieces.push([new THREE.BoxGeometry(1.1, y - bas, 0.62), M(r, (y + bas) / 2, -(w + 0.55))]); }
    // les bittes d'amarrage, au bout
    for (const s of [-1, 1]) { pieces.push([new THREE.CylinderGeometry(0.2, 0.26, 0.62, 12), M(r1 - 0.7, 0.31, s * (w - 0.6))]);
      pieces.push([new THREE.CylinderGeometry(0.3, 0.22, 0.14, 12), M(r1 - 0.7, 0.66, s * (w - 0.6))]); }
    fusion(pieces, margelle, true, true);
    for (const s of [-1, 1]) { const [bx, bz] = pt(r1 - 0.7, s * (w - 0.6)); addCap(bx, bz, bx, bz, 0.3, 0.8); } }
  // ---- le ponton : des planches sur deux longerons, des moises, des pieux ----
  { const [r0, r1, w] = PONTON, planches = [], bois = [], pieux = [];
    for (let r = r0 + 0.13, k = 0; r < r1; r += 0.27, k++)
      planches.push([new THREE.BoxGeometry(2 * w, 0.06, 0.24), M(r, -0.03 + Math.sin(k * 2.3) * 0.006, Math.sin(k * 1.7) * 0.03, Math.sin(k * 3.1) * 0.012)]);
    for (const d of [-0.85, 0.85]) bois.push([new THREE.BoxGeometry(0.2, 0.26, r1 - r0), M((r0 + r1) / 2, -0.19, d)]);
    for (let r = r0 + 0.6; r < r1; r += 2.3) { bois.push([new THREE.BoxGeometry(2 * w + 0.3, 0.2, 0.22), M(r, -0.42, 0)]);
      for (const d of [-w, w]) pieux.push([new THREE.CylinderGeometry(0.13, 0.16, 3.6, 8), M(r, MER - 1.2 + 1.8 + (Math.abs(r - r1) < 2.4 ? 0.55 : 0), d)]); }
    fusion(planches, planche); fusion(bois, poutre); fusion(pieux, pieu);
    // la lanterne du bout du ponton : une lueur, pas une lumière (aucune lumière nouvelle)
    const [lx, lz] = pt(r1 - 0.5, w - 0.15);
    scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), fer, lx, 1.3, lz));
    scene.add(mesh(boxG(0.32, 0.44, 0.32), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffb860, emissiveIntensity: 1.5 }), lx, 2.75, lz));
    scene.add(mesh(new THREE.ConeGeometry(0.28, 0.24, 4), fer, lx, 3.08, lz).rotateY(Math.PI / 4));
    addCap(lx, lz, lx, lz, 0.15, 3); }
  // ---- sur la jetée : deux tonneaux, une caisse, un rouleau de cordage ----
  { const tonneaux = [], cercles = [];
    for (const [r, d] of [[R_ILE + 0.6, 1.4], [R_ILE + 1.3, 1.65]]) { tonneaux.push([new THREE.CylinderGeometry(0.34, 0.3, 0.8, 14), M(r, 0.4, d)]);
      for (const y of [0.12, 0.68]) cercles.push([new THREE.TorusGeometry(0.33, 0.025, 5, 16), M(r, y, d, 0, Math.PI / 2)]);
      const [x, z] = pt(r, d); addCap(x, z, x, z, 0.38, 0.85); }
    tonneaux.push([new THREE.BoxGeometry(0.8, 0.6, 0.6), M(R_ILE - 0.6, 0.3, 1.5, 0.3)]);
    { const [x, z] = pt(R_ILE - 0.6, 1.5); addCap(x, z, x, z, 0.45, 0.65); }
    fusion(tonneaux, phMat('wood_planks', 0.8, 0.8, { color: 0x7a6450 })); fusion(cercles, fer);
    const rouleau = []; for (let k = 0; k < 4; k++) rouleau.push([new THREE.TorusGeometry(0.34 - k * 0.02, 0.045, 6, 18), M(JETEE[1] - 1.5, 0.06 + k * 0.08, -(JETEE[2] - 0.75), 0, Math.PI / 2)]);
    fusion(rouleau, corde); }
  // ---- la barque : une coque bordée, tirée de sections, amarrée le long du ponton ----
  const g = new THREE.Group(); { const [bx, bz] = pt(R_ILE + 9.2, PONTON[2] + 1.05); g.position.set(bx, MER, bz); g.rotation.y = a; scene.add(g); }
  { const Lc = 4.6, Wc = 0.78, Dc = 0.62, NS = 22, NP = 13, pos = [], uv = [], idx = [], bord = [[], []];
    for (let i = 0; i <= NS; i++) { const t = i / NS, z = (t - 0.5) * Lc, f = Math.pow(Math.sin(Math.PI * t), 0.55);
      const w = Wc * f + 0.02, d = Dc * (0.55 + 0.45 * Math.sin(Math.PI * t)), tonture = 0.22 * Math.pow(2 * t - 1, 2);
      for (let j = 0; j <= NP; j++) { const u = j / NP * 2 - 1, x = u * w, y = 0.45 + tonture - d * (1 - Math.pow(Math.abs(u), 1.7));
        pos.push(x, y, z); uv.push(z, (u + 1) * 1.1); }
      bord[0].push(V(-w, 0.45 + tonture, z)); bord[1].push(V(w, 0.45 + tonture, z)); }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NP; j++) { const p0 = i * (NP + 1) + j, p1 = p0 + NP + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    ge.setIndex(idx); ge.computeVertexNormals();
    const coque = new THREE.Mesh(ge, phMat('wood_planks', 1, 0.6, { color: 0x6a5848, side: THREE.DoubleSide })); coque.castShadow = coque.receiveShadow = true; g.add(coque);
    // le plat-bord, deux bancs, l'étrave et l'étambot, deux avirons couchés
    const bb = phMat('wood_planks', 1, 1, { color: 0x4e4236 });
    for (const b of bord) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(b), 40, 0.045, 5, false), bb));
    for (const z of [0.7, -0.75]) g.add(mesh(boxG(1.4, 0.06, 0.3), bb, 0, 0.3, z));
    for (const s of [1, -1]) { const e = mesh(boxG(0.08, 0.75, 0.12), bb, 0, 0.42, s * (Lc / 2 - 0.02)); e.rotation.x = -s * 0.25; g.add(e); }
    for (const s of [-1, 1]) { const av = new THREE.Group(); av.position.set(s * 0.32, 0.38, 0.1); av.rotation.set(0, s * 0.06, Math.PI / 2 - 0.06 * s); g.add(av);
      av.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.9, 6), bb, 0, 0, 0).rotateX(Math.PI / 2));
      av.add(mesh(boxG(0.03, 0.16, 0.6), bb, 0, 0, 1.55)); }
    // la lanterne de poupe, sur sa perche
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.4, 6), fer, 0.2, 1.05, -Lc / 2 + 0.35));
    g.add(mesh(boxG(0.2, 0.28, 0.2), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffb860, emissiveIntensity: 1.3 }), 0.2, 1.85, -Lc / 2 + 0.35));
    // l'amarre, de l'étrave à un pieu du ponton
    { const A0 = V(0, 0.65, Lc / 2 - 0.1).applyMatrix4(g.matrixWorld.compose(g.position, g.quaternion, g.scale));
      const [px, pz] = pt(R_ILE + 11.2, PONTON[2]), B0 = V(px, 0.35, pz), mid = A0.clone().lerp(B0, 0.5); mid.y -= 0.35;
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A0, mid, B0), 16, 0.025, 5, false), corde)); } }
  const pas = PNJ.buildVillageois(3);
  if (pas) { pas.scale.setScalar(0.6); pas.position.set(0, 0.0, -1.35); pas.rotation.y = 0; g.add(pas); BOUGE.passeur = pas; }   // à la poupe, tourné vers le large
  const [ix, iz] = pt(R_ILE + 9.2, 0.6);
  addInteract({ pos: new THREE.Vector3(ix, 0, iz), r: 3.2, prompt: () => 'parler au passeur',
    fn: () => showMessage('Le passeur ne se retourne pas. Il regarde le large, la lanterne à la main. « Pas encore. »', 5) });
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
  player.pos.set(0, 0, R_COUR - 2.5); player.yaw = Math.PI; G.camYaw = Math.PI;
}

// LA FIN DE L'ACTE I (6 octobre ; STORY.md acte I, DIALOGUES-ACTE1.md « Le mage, au Temple ») :
// Camille arrive derrière Phinaert par la porte de lumière (citadelle.js). Le vieux mage
// l'attend au pied de la prophétie : le mythe (SCENARIO.md § 1), le premier vers lu au mur, la
// suite « effacée » (elle ne l'est pas), et la porte du Midi, par où Phinaert est passé, du sable
// rouge dessous. Une fois (state.templeVu) ; le mage reste ensuite près du mur.
let MAGE = null, finFaite = false, finPosee = false;   // posés une fois la partie lancée : populate passe avant la sauvegarde (state.acte1 inconnu)
function finActeIPoser() {
  // le sable rouge du Midi, sous la porte entrouverte (porte 1)
  { const a = angPorte(1), x = Math.sin(a) * (R_COUR - 1.6), z = Math.cos(a) * (R_COUR - 1.6);
    const sable = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), phMat('terre_battue', 3.4, 3.4, { color: 0xc0623e }));
    sable.rotation.x = -Math.PI / 2; sable.position.set(x, hauteur(x, z) + 0.03, z); sable.receiveShadow = true; scene.add(sable); }
  // le mage, au pied de la prophétie (à droite de la porte de la tour), tourné vers la cour
  MAGE = PNJ.buildRole('mage');
  if (MAGE) { const a = 0.55, r = R_TOUR + 3.2, x = Math.sin(a) * r, z = Math.cos(a) * r;
    MAGE.scale.setScalar(G.echelle); MAGE.position.set(x, hauteur(x, z), z); MAGE.rotation.y = Math.atan2(-x, R_COUR - 2.5 - z); scene.add(MAGE);
    addInteract({ pos: MAGE.position.clone(), r: 3, prompt: () => 'parler au vieux mage',
      fn: () => dialogue([{ who: 'Le vieux mage', text: '« **La porte du Midi est ouverte.** C’est par là qu’il est passé. »' }]) }); }
}
function finActeIScene() {
  if (finFaite || state.templeVu || state.acte1 !== 'temple' || !state.running || state.paused) return;
  finFaite = true;
  // deux plans : la cour, le mage devant le mur ; puis la plaque, pour le vers (sans plan donné,
  // la scène gardait la caméra du moment, mal placée, et l'image sortait délavée)
  const am = 0.55, mx = Math.sin(am) * (R_TOUR + 3.2), mz = Math.cos(am) * (R_TOUR + 3.2), px = Math.sin(am) * (R_TOUR + 0.75), pz = Math.cos(am) * (R_TOUR + 0.75);
  const cour = { cam: [mx - 4.5, 2.6, mz + 7], at: [mx, 1.5, mz] }, mur = { cam: [px - 1.6, 2.1, pz + 4.2], at: [px, 1.9, pz] };
  const L = (who, say, plan = cour) => ({ ...plan, who, say });
  cutscene([
    L('Le vieux mage', '« Je t’attendais depuis longtemps. »'),
    L('Le vieux mage', '« Au commencement, chaque terre avait son géant. Ils ne régnaient pas : ils gardaient. Chacun veillait sur une cloche, et les cloches pendaient ensemble ici, au Temple des Géants. »'),
    L('Le vieux mage', '« Phinaert voulut toutes les heures de tous les mondes. Lydéric l’a vaincu au pont de Fin, et l’ermite l’a enfermé dans la Grande Cloche. Tant qu’elle sonnait, il dormait. »'),
    L('Le vieux mage', '« Lis le mur. »'),
    L('Le mur', '« Quand la Grande Cloche se fendra, le géant du Buc sortira. »', mur),
    L('Camille', '« Et la suite ? »', mur),
    L('Le vieux mage', '« La suite est effacée. »'),
    L('Le vieux mage', '« **La porte du Midi est ouverte.** C’est par là qu’il est passé. »'),
  ], () => { state.templeVu = true; saveGame(true); });
}
// LE RETOUR DE L'ACTE IV (6 octobre ; DECISIONS-RECIT.md § 3, « après les Pouilles ») : la Cloche
// des Heures sonnée à Gallipoli (state.acte4 === 'heures'), elle pend au troisième étage ; un grand
// cadran sur la tour, dont l'aiguille va trop vite ; un tic-tac. Posé après le lancement, comme la
// fin de l'acte I (build passe avant la sauvegarde). La première fois, le mage ; puis `temple`.
let heuresPosees = false, heuresFaite = false, ticT = 0;
const heuresSonnees = () => state.acte4 === 'heures' || state.acte4 === 'temple';
function heuresPoser() {
  const i = PORTES.findIndex((P) => P.geant === 'colosse');
  if (i < 0 || ouverts().has('colosse')) return;            // (l'aperçu ?mondes=tous l'a déjà fait)
  deborder(i, 'colosse'); silhouette(i, 'colosse'); pendreCloche(i, 'colosse'); cadran();
}
function heuresScene() {
  if (heuresFaite || state.acte4 !== 'heures' || !state.running || state.paused) return;
  heuresFaite = true;
  const pl = { cam: [9, 9, R_COUR - 1], at: [0, 24, R_TOUR] };
  cutscene([
    { ...pl, who: '', say: 'Au troisième étage de la tour, la Cloche des Heures pend à son crochet. Elle ne vieillit plus.' },
    { ...pl, who: '', say: 'Sur la tour, un grand cadran est apparu. L’aiguille tourne beaucoup trop vite. Tic, tac.' },
    // (SCENARIO.md § 13, la fin de l'acte IV : rien de plus que ce que le scénario dit)
    { ...pl, who: '', say: 'Une autre porte s’entrouvre : une odeur de châtaigne et de pierre mouillée, et le son d’une cloche de mouton.' },
    { ...pl, who: 'Le vieux mage', say: '« **La Lozère**, à côté de l’Aveyron. On y a entendu parler de la pluie revenue chez les voisins. »' },
  ], () => { state.acte4 = 'temple'; saveGame(true); });
}

// LA PROPHÉTIE QUI SE GRAVE (passe D, 6 octobre) : la plaque du pied de la tour ne montrait que le
// premier vers, et des points. Chaque vers trouvé dans un monde (gravé au cœur du Dormeur, sous la
// Cloche des Îles, au sommet du château de Matera) y apparaît à son rang ; les autres restent des
// points. STORY.md § 7 : six vers.
const VERS_PROPHETIE = [
  [() => true, 'Quand la Grande Cloche se fendra,', 'le géant du Buc sortira.'],
  [() => state.acte2 === 'pluie', 'Une gardienne sonnera les cloches,', 'et chaque cloche le servira.'],
  [() => state.clocheIles === true, 'Chaque géant donnera ce qu’il est,', 'et ne le reprendra pas.'],
  [() => state.acte4 === 'heures' || state.acte4 === 'temple', 'Chaque heure sauvée coûtera des années,', 'et nul ne les rendra.'],
  [() => state.acte5 === 'course', 'Toutes les heures seront mêlées,', 'et la dernière sera la sienne.'],
];
function graverProphetie() {
  const P = PROPHETIE.plaque; if (!P) return;
  const vus = VERS_PROPHETIE.map(([c]) => (c() ? 1 : 0)).join(''); if (vus === PROPHETIE.vus) return; PROPHETIE.vus = vus;
  // une ligne par vers trouvé (petite : il en tient six), des points pour ceux qui manquent
  const l = []; for (const [c, a, b] of VERS_PROPHETIE) if (c()) l.push({ t: a + ' ' + b, italique: true });
  while (l.length < 6) l.push({ t: '· · ·', couleur: 'rgba(40,32,24,0.35)' });
  P.material = plaqueGravee(l, 5.1, 2.5, 20, 512); P.visible = vus !== '1000';   // (le premier vers seul : la plaque d'origine suffit)
}

// LE RETOUR DE L'ACTE II (passe D, 6 octobre ; DECISIONS-RECIT.md § 3, « après l'Aveyron ») : la Cloche
// du Midi rapportée du cœur du Dormeur (state.acte2 === 'pluie', aveyron.js), elle pend au premier
// étage ; un escalier de pierre monte jusqu'à elle, dans la tour ; un rai de soleil fixe sur la cour ;
// une cigale, qui ne s'arrête pas. On la sonne. Le deuxième vers apparaît sur la plaque. La porte des
// Îles s'entrouvre. Une fois (state.midiVu) ; `state.acte2` reste à « pluie » (aveyron.js le lit).
let midiPosees = false, midiFaite = false, CIGALE = null;
const midiSonne = () => state.acte2 === 'pluie';
function midiPoser() {
  const i = PORTES.findIndex((P) => P.geant === 'dormeur');
  if (i < 0) return;
  if (!ouverts().has('dormeur')) { deborder(i, 'dormeur'); silhouette(i, 'dormeur'); pendreCloche(i, 'dormeur'); }
  const yC = 14 + (i - 1) * 11;
  // l'escalier : une vis de pierre contre le mur intérieur de la tour, jusqu'au palier sous la cloche
  // (addHelix : on y monte vraiment, comme la vis de Beauregard)
  { const r0 = R_TOUR - EP_TOUR - 2.2, r1 = R_TOUR - EP_TOUR - 0.1, tours = yC / 7.5, n = Math.round(yC / 0.25), morceaux = [];
    addHelix(0, 0, r0, r1, 0, 7.5, tours, 0, false);
    for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * tours * TAU, y = (k + 1) * yC / n, rm = (r0 + r1) / 2;
      // (le même angle que addHelix : a mesuré depuis +x, vers z croissant)
      const gm = boxG(r1 - r0, 0.22, rm * tours * TAU / n * 1.15); gm.rotateY(-a); gm.translate(Math.cos(a) * rm, y - 0.11, Math.sin(a) * rm); morceaux.push(gm); }
    const m = new THREE.Mesh(mergeGeometries(morceaux), phMat('old_stone_wall_02', 1, 1, { color: 0xb8b0a4 })); m.castShadow = m.receiveShadow = true; scene.add(m);
    // le palier, sous la cloche
    const pal = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 32), phMat('old_stone_wall_02', 4, 4, { color: 0xb8b0a4, side: THREE.DoubleSide })); pal.rotation.x = -Math.PI / 2; pal.position.y = yC + 0.02; scene.add(pal);
    addInteract({ pos: new THREE.Vector3(r0 + 1, yC, 0), r: 4, prompt: () => 'sonner la Cloche du Midi', fn: () => { PNJ_E.SFX.cloche && PNJ_E.SFX.cloche(); showMessage('La Cloche du Midi sonne. Elle ne fait pas d’ombre : le soleil est toujours au-dessus d’elle.', 5); } }); }
  // le rai de soleil : une colonne de lumière qui tombe du ciel sur la cour, et n'en bouge plus
  { const a = angPorte(i) + 0.5, r = (R_TOUR + R_COUR) / 2, x = Math.sin(a) * r, z = Math.cos(a) * r;
    const rai = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    rai.position.set(x, hauteur(x, z) + 30, z); scene.add(rai);
    const tache = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffe8a8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    tache.rotation.x = -Math.PI / 2; tache.position.set(x, hauteur(x, z) + 0.04, z); scene.add(tache); PROPHETIE.rai = [x, z]; }
}
// la cigale : un grésillement aigu, par salves, très bas — qui ne s'arrête pas (DECISIONS-RECIT.md § 3)
function cigale() {
  if (CIGALE) return;
  try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), mod = c.createOscillator(), gm = c.createGain(), g = c.createGain(), salve = c.createOscillator(), gs = c.createGain();
    o.type = 'square'; o.frequency.value = 4300; mod.frequency.value = 55; gm.gain.value = 0.5;
    mod.connect(gm.gain); salve.type = 'square'; salve.frequency.value = 0.6; salve.connect(gs.gain); gs.gain.value = 0.5;
    g.gain.value = 0.012; o.connect(gm); gm.connect(gs); gs.connect(g); g.connect(c.destination); o.start(); mod.start(); salve.start(); CIGALE = c; } catch (e) { CIGALE = 'muette'; }
}
function midiScene() {
  if (midiFaite || state.midiVu || !midiSonne() || !state.running || state.paused) return;
  midiFaite = true;
  const i = PORTES.findIndex((P) => P.geant === 'dormeur'), yC = 14 + (i - 1) * 11;
  const tour = { cam: [6, yC - 4, R_COUR - 2], at: [0, yC, 0] }, cour = { cam: [10, 5, R_COUR - 2], at: PROPHETIE.rai ? [PROPHETIE.rai[0], 0, PROPHETIE.rai[1]] : [0, 0, R_TOUR] };
  const am = 0.55, px = Math.sin(am) * (R_TOUR + 0.75), pz = Math.cos(am) * (R_TOUR + 0.75), mur = { cam: [px - 1.6, 2.1, pz + 4.2], at: [px, 1.9, pz] };
  const ai = PORTES.findIndex((P) => P.geant === 'yak'), a = angPorte(ai), porte = { cam: [Math.sin(a) * (R_COUR - 9), 2.2, Math.cos(a) * (R_COUR - 9)], at: [Math.sin(a) * R_COUR, 2, Math.cos(a) * R_COUR] };
  cutscene([
    { ...tour, who: '', say: 'Au premier étage de la tour, la Cloche du Midi pend à son crochet. Un escalier de pierre est apparu, qui monte jusqu’à elle.', fn: () => { PNJ_E.SFX.cloche && PNJ_E.SFX.cloche(); } },
    { ...cour, who: '', say: 'Sur la cour, un rai de soleil s’est posé, et il n’en bouge plus. Une cigale chante. Elle ne s’arrête pas.', fn: cigale },
    { ...mur, who: 'Le mur', say: 'Sous le premier vers, un deuxième : « Une gardienne sonnera les cloches, et chaque cloche le servira. »' },
    { ...porte, who: '', say: 'Une autre porte s’entrouvre : derrière, une pluie qui ne tombe pas.' },
  ], () => { state.midiVu = true; saveGame(true); });
}

// LE RETOUR DE L'ACTE V (passe D2, 7 octobre ; DECISIONS-RECIT.md § 3, « après la Lozère » ; SCENARIO.md
// § 14, la fin) : le loup endormi sous la montagne (state.acte5 === 'course', lozere.js), la Cloche des
// Troupeaux pend au quatrième étage ; toutes les cloches se balancent seules, très peu ; on entend les
// sonnailles, toutes ensemble. Le mage, pâle : il ne manque plus que la Grande Cloche. Le cinquième vers
// sur la plaque. Une fois (state.troupeauxVu) ; `state.acte5` reste à « course » (lozere.js le lit).
let troupeauxPosees = false, troupeauxFaite = false, sonnT = 0;
const troupeauxSonne = () => state.acte5 === 'course';
function troupeauxPoser() {
  const i = PORTES.findIndex((P) => P.geant === 'loup');
  if (i < 0 || ouverts().has('loup')) return;                // (l'aperçu ?mondes=tous l'a déjà fait)
  deborder(i, 'loup'); silhouette(i, 'loup'); pendreCloche(i, 'loup');
}
function troupeauxScene() {
  if (troupeauxFaite || state.troupeauxVu || !troupeauxSonne() || !state.running || state.paused) return;
  troupeauxFaite = true;
  if (!finPosee) { finPosee = true; finActeIPoser(); }          // le mage, même sans la fin de l'acte I vue
  const haut = { cam: [9, 9, R_COUR - 1], at: [0, 40, 0] }, am = 0.55, mx = Math.sin(am) * (R_TOUR + 3.2), mz = Math.cos(am) * (R_TOUR + 3.2);
  const mage = { cam: [mx - 4.5, 2.6, mz + 7], at: [mx, 1.5, mz] }, px = Math.sin(am) * (R_TOUR + 0.75), pz = Math.cos(am) * (R_TOUR + 0.75), mur = { cam: [px - 1.6, 2.1, pz + 4.2], at: [px, 1.9, pz] };
  cutscene([
    { ...haut, who: '', say: 'Au quatrième étage de la tour, la Cloche des Troupeaux pend à son crochet. Toutes les cloches se balancent, très peu, toutes seules.', fn: () => { PNJ_E.SFX.cloche && PNJ_E.SFX.cloche(); } },
    { ...haut, who: '', say: 'On entend des sonnailles, toutes ensemble, comme un troupeau qui passe très loin.', fn: sonnailles },
    { ...mur, who: 'Le mur', say: 'Sous les autres vers, un cinquième : « Toutes les heures seront mêlées, et la dernière sera la sienne. »' },
    // (SCENARIO.md § 14, la fin de l'acte V : les mots du mage, tels quels)
    { ...mage, who: 'Le vieux mage', say: '(pâle) « Il ne manque plus que la Grande Cloche de Lille. Qu’on la refonde, et elle sonnera avec les autres — et Phinaert aura ce qu’il veut. »' },
    { ...mage, who: 'Le vieux mage', say: '« Qu’on ne la refonde pas, et Phinaert ne pourra jamais être enfermé. »' },
  ], () => { state.troupeauxVu = true; saveGame(true); });
}
// les sonnailles, toutes ensemble : trois grelots décalés (le son des écus, le plus proche), de temps en temps
function sonnailles() { [0, 140, 330, 520].forEach((t) => setTimeout(() => PNJ_E.SFX.piece && PNJ_E.SFX.piece(), t)); }

// LE RETOUR DE L'ACTE III (6 octobre ; DECISIONS-RECIT.md § 3, « après la Thaïlande » ; SCENARIO.md
// § 12, la fin) : la Cloche des Îles rapportée de la baie (state.clocheIles, thailande.js), elle pend
// au deuxième étage ; des rigoles autour du pied de la tour, dont l'eau coule vers le HAUT ; la pluie,
// très loin. La porte des Heures s'entrouvre. Le mage ne dit rien ; Camille hésite, pour la première
// fois, devant une porte. Une fois (state.ilesVu) ; `state.acte3` reste à « fete » (thailande.js le lit).
let ilesPosees = false, ilesFaite = false;
const ilesSonnees = () => state.clocheIles === true;
const RIGOLES = [];
function ilesPoser() {
  const i = PORTES.findIndex((P) => P.geant === 'yak');
  if (i < 0 || ouverts().has('yak')) return;                 // (l'aperçu ?mondes=tous l'a déjà fait)
  deborder(i, 'yak'); silhouette(i, 'yak'); pendreCloche(i, 'yak'); rigoles();
}
// les rigoles : un anneau de pierre au pied de la tour, et six filets d'eau qui MONTENT le long du
// mur (une texture de traînées claires qui défile vers le haut) — le temps de la mousson, à l'envers
function rigoles() {
  // la rigole juste hors du socle à gradins (R_TOUR + 1,6) ; les filets sur le mur, au-dessus du socle (1,25 m)
  const r = R_TOUR + 2.0, pierre = phMat('old_stone_wall_02', 6, 0.3, { color: 0x9a9284 });
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 6, 64), pierre); anneau.rotation.x = Math.PI / 2; anneau.position.y = hauteur(0, r) + 0.08; anneau.receiveShadow = true; scene.add(anneau);
  const eauSol = new THREE.Mesh(new THREE.RingGeometry(r - 0.16, r + 0.16, 64), mat(0x5a9aa8, { metalness: 0.2, roughness: 0.05 })); eauSol.rotation.x = -Math.PI / 2; eauSol.position.y = hauteur(0, r) + 0.1; scene.add(eauSol);
  const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g = c.getContext('2d');
  for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.55).toFixed(2)})`; g.fillRect(Math.random() * 32, Math.random() * 128, 1 + Math.random() * 2, 5 + Math.random() * 18); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2); RIGOLES.push(t);
  const m = new THREE.MeshStandardMaterial({ color: 0xcfeef2, map: t, transparent: true, opacity: 0.7, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  // cinq filets, loin de la porte de la tour (angle 0) et de la plaque du premier vers (0,55 rad)
  for (let k = 0; k < 5; k++) { const a = 1.2 + k * 1.0, rr = R_TOUR + 0.64, f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), m);
    f.position.set(Math.sin(a) * rr, 4.3, Math.cos(a) * rr); f.rotation.y = a; f.userData.dynamic = true; scene.add(f); }
}
function ilesScene() {
  if (ilesFaite || state.ilesVu || !ilesSonnees() || !state.running || state.paused) return;
  ilesFaite = true;
  // la cloche pend DANS la tour creuse (y ≈ 24,8) : on la filme de l'intérieur, d'un peu plus bas ; les filets, du côté où ils sont
  const haut = { cam: [4, 21, 4], at: [0, 24.2, 0] }, af = 2.2, pied = { cam: [Math.sin(af) * (R_TOUR + 8), 3, Math.cos(af) * (R_TOUR + 8)], at: [Math.sin(af) * R_TOUR, 3.5, Math.cos(af) * R_TOUR] };
  const a = angPorte(PORTES.findIndex((P) => P.geant === 'colosse')), porte = { cam: [Math.sin(a) * (R_COUR - 9), 2.2, Math.cos(a) * (R_COUR - 9)], at: [Math.sin(a) * R_COUR, 2, Math.cos(a) * R_COUR] };
  cutscene([
    { ...haut, who: '', say: 'Au deuxième étage de la tour, la Cloche des Îles pend à son crochet. On la sonne : elle n’a pas de battant, elle se frappe du dehors.', fn: () => { PNJ_E.SFX.cloche && PNJ_E.SFX.cloche(); } },
    { ...pied, who: '', say: 'Au pied de la tour, des rigoles se sont remplies. L’eau y coule vers le haut. Très loin, on entend la pluie.' },
    // (SCENARIO.md § 12, la fin de l'acte III : rien de plus que ce que le scénario dit)
    { ...porte, who: '', say: 'Une autre porte s’entrouvre : une odeur de mer et d’olivier.' },
    { ...porte, who: '', say: 'Le vieux mage ne dit rien. Camille, pour la première fois, hésite devant une porte.' },
  ], () => { state.ilesVu = true; saveGame(true); });
}

// rien ne bouge sur l'île, sauf ce que les mondes ouverts ont remis en marche
// à l'arrivée par une porte, la sauvegarde rend l'angle de caméra du niveau qu'on quitte : on
// la remet une fois dans le dos de Camille, face à la tour
let camPosee = false;
function animate(now, dt) {
  if (!camPosee && state.running && !state.paused) { G.camYaw = player.yaw; camPosee = true; }   // camYaw = yaw : la caméra est dans le dos
  if (!finPosee && state.running && state.acte1 === 'temple') { finPosee = true; finActeIPoser(); }
  finActeIScene();                                                                                   // la fin de l'acte I, une fois
  if (!midiPosees && state.running && midiSonne()) { midiPosees = true; midiPoser(); if (state.midiVu) cigale(); }
  midiScene();                                                                                       // le retour de l'acte II, une fois
  if (state.running) graverProphetie();                                                             // les vers trouvés, sur la plaque
  if (!heuresPosees && state.running && heuresSonnees()) { heuresPosees = true; heuresPoser(); }
  heuresScene();                                                                                     // le retour de l'acte IV, une fois
  if (!ilesPosees && state.running && ilesSonnees()) { ilesPosees = true; ilesPoser(); }
  ilesScene();                                                                                       // le retour de l'acte III, une fois
  if (!troupeauxPosees && state.running && troupeauxSonne()) { troupeauxPosees = true; troupeauxPoser(); }
  troupeauxScene();                                                                                  // le retour de l'acte V, une fois
  if (state.troupeauxVu && state.running && (sonnT += dt) > 9) { sonnT = 0; sonnailles(); }          // les sonnailles, de loin en loin
  for (const t of RIGOLES) t.offset.y -= dt * 0.8;                                                  // l'eau des rigoles monte
  // le tic-tac du cadran, une fois les Heures pendues
  if (BOUGE.aiguille && state.running && (ticT += dt) > 1) { ticT = 0; PNJ_E.SFX.step(); }
  const t = now / 1000, troupeaux = ouverts().has('loup') || troupeauxSonne();
  for (const c of BOUGE.cloches) c.g.rotation.z = troupeaux ? Math.sin(t * 0.9 + c.ph) * 0.05 : 0;   // les cloches se balancent seules, très peu
  if (BOUGE.aiguille) BOUGE.aiguille.rotation.z -= dt * 1.6;                                       // l'heure qui passe trop vite
  if (BOUGE.passeur) PNJ.animeVillageois(BOUGE.passeur, dt, false);
  if (MAGE) PNJ.animeVillageois(MAGE, dt, false);
}
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
  name: 'temple', echelle: 0.6, musique: 'mage', getH: (x, z) => surPonton(x, z) ? 0 : hauteur(x, z), zoneName: () => 'L’île du temps',
  // la rive : on ne marche pas sur la mer, sauf sur le ponton du passeur
  blocked: (x, z) => Math.hypot(x, z) > R_ILE - 3 && !surPonton(x, z),
  build, populate, animate, minimap,
  counts: () => '<small>L’île du temps — le Temple des Géants. Six portes, une seule ouverte.</small>',
  start: () => showMessage('Rien ne bouge. Ni la mer, ni les nuages. Même le vent s’est arrêté.', 6),
  arriveMessage: () => 'L’île du temps.',
  entry: () => ({ title: 'L’île du temps', sub: 'Le Temple des Géants', cam: [70, 40, 120], at: [0, 20, 0], cam2: [8, 4, R_COUR + 10], at2: [0, 14, 0], dur: 6 }),
  onKill: () => {},
};
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
