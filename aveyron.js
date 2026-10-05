// The Legend of Camille — l'Aveyron de la grande sécheresse : le lac de Saint-Gervais
// La Cloche du Midi (STORY.md) : « une grande carte vallonnée et sèche ; le soleil reste au
// sommet du ciel ; l'eau est la richesse ». Le lac, son barrage, et autour les trois grandes
// maisons des Roquette — le Batut, Beauregard, la grande maison du Pouget — posées là où la
// session des mondes les a proposées et Eugène validées (carte/mondes/README.md).
import { monde } from './monde.js';
import { THREE, phMat, mesh, boxG, showMessage, dialogue, G, PH, addCap, player } from './engine.js?v=41';
import { especeGeo } from './foret.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as PNJ from './pnj.js';

// Les toits sont en LAUZE (Eugène, 5 octobre : « passe tout en lauze ») : le nord de l'Aveyron couvre
// en lauze, la tuile canal (choisie le 2 octobre) est une toiture du sud. La lauze est lourde et veut
// une forte pente : 45° (pente 1) et plus, contre 17° pour la tuile. Les pierres ne sont pas dans PH (engine.js, tenu par une autre session) :
// on les inscrit ici comme le fait pouget-bati.js, avec la boue craquelée du lac à l'étiage
// (Poly Haven, CC0 ; tailles réelles relevées sur l'API de Poly Haven).
Object.assign(PH, {
  stone_wall:           { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a958a },
  rustic_stone_wall_02: { tuile: 1.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a8070 },
  granite_tile_03:      { tuile: 1.8, maps: ['couleur', 'normale'], repli: 0x8a8580 },
  // la route goudronnée : sans elle, phMat retombait sur un gris uni — les rues blanches de la planche
  asphalt_02:           { tuile: 3.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a8a88 },
  // la boue fendue du lac à l'étiage : 1,5 m de motif pour Poly Haven, posée ici sur 4 m — des
  // plaques de 40 cm, celles d'une vase qui sèche depuis des semaines ; à 1,5 m on ne les voyait plus
  mud_cracked_dry_03:   { tuile: 4.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0xb89a74 },
  // le granit gris et la lauze du nord de l'Aveyron (Carladez, Viadène, Aubrac) : ceux de lozere.js,
  // les mêmes pierres de l'autre côté de l'Aubrac, pour le Pouget et Beauregard (5 octobre)
  granit_lozere:        { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a958a },
  lauze_lozere:         { tuile: 3.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6a6866 },
  // la laine des sièges des intérieurs (comme batut.js : le tissu à motifs se lisait en tartan)
  wool_boucle:          { tuile: 0.6, maps: ['couleur', 'normale', 'rugosite'], repli: 0xc8bca8 },
});

// une boîte dont chaque face a sa matière À SA TAILLE : avec une seule matière, la pierre de la
// façade de 20 m et celle du pignon de 10 m n'auraient pas le même moellon
function boite(w, h, d, slug, opt = {}) {
  const f = (u, v) => phMat(slug, u, v, opt);
  return new THREE.Mesh(boxG(w, h, d), [f(d, h), f(d, h), f(w, d), f(w, d), f(w, h), f(w, h)]);
}
const pose = (g, o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };

// ---------------------------------------------------------------------
//  Les grandes maisons des Roquette
// ---------------------------------------------------------------------
// Une maison de maître du Ségala : un corps de logis de schiste et de granit à deux étages, un
// toit de tuiles canal à faible pente, une tour ronde coiffée de tuiles à l'angle, des baies à encadrement de
// granit et des volets de bois. Devant, la cour de terre battue fermée d'un muret de pierre
// sèche, deux piliers à l'entrée — et le puits, à sec. Chaque famille a la couleur de ses
// volets ; au Batut, ils sont fermés au soleil (c'est ce que dit Camille en passant).
const MAISON = { L: 20, W: 10, H: 8, toit: 1.8, cour: 14 };   // le toit : 5,6 m pour moitié de largeur à 30 %
// (le nom est resté : TUILE donne la couverture de toutes les maisons, en lauze désormais)
const TUILE = (u, v, extra = {}) => phMat('lauze_lozere', u, v, { color: 0x8a8984, roughness: 0.92, side: THREE.DoubleSide, ...extra });
function grandeMaison({ hauteur, scene, addInteract, inscrire }, X, Z, rot, nom, mot, { volets, fermes }) {
  const { L, W, H, cour: C } = MAISON;
  const c = Math.cos(rot), s = Math.sin(rot);
  const monde = (lx, lz) => [X + lx * c + lz * s, Z - lx * s + lz * c];          // local → monde (rotation.y)
  // le pied : le point le plus bas de l'emprise, le corps descend 5 m sous terre pour les pentes
  let y0 = 1e9; for (const [a, b] of [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]]) y0 = Math.min(y0, hauteur(...monde(a, b)));
  const g = new THREE.Group(); g.position.set(X, y0, Z); g.rotation.y = rot; scene.add(g);
  const sol = (lx, lz) => hauteur(...monde(lx, lz)) - y0;

  // ---- le corps de logis, le toit, les pignons ----
  pose(g, boite(L, H + 5, W, 'stone_wall', { color: 0xa8a090 }), 0, (H - 5) / 2, 0);
  const tuiles = TUILE(1, 1);
  { const o = 0.6, hl = MAISON.toit, la = L / 2 + o, lb = W / 2 + o, P = [];
    // deux pans, UV en mètres le long de la pente : la tuile garde sa taille réelle, ses rangs dans la pente
    const pan = (sgn) => { const v = [[-la, H, sgn * lb], [la, H, sgn * lb], [la, H + hl, 0], [-la, H + hl, 0]], rampe = Math.hypot(lb, hl);
      for (const k of [0, 1, 2, 0, 2, 3]) P.push(v[k][0], v[k][1], v[k][2]);
      return [0, 0, 2 * la, 0, 2 * la, rampe, 0, 0, 2 * la, rampe, 0, rampe].map((t) => t / 3); };
    const uv = [...pan(1), ...pan(-1)];
    const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gt.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gt.computeVertexNormals();
    g.add(new THREE.Mesh(gt, tuiles));
    // les pignons : deux triangles de la pierre du corps
    const pg = new THREE.BufferGeometry(), q = [], quv = [];
    for (const sx of [-1, 1]) { const x = sx * L / 2; for (const [zz, yy] of [[-W / 2, H], [W / 2, H], [0, H + hl - 0.3]]) { q.push(x, yy, zz); quv.push((zz + W / 2) / 2, yy / 2); } }
    pg.setAttribute('position', new THREE.Float32BufferAttribute(q, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(quv, 2)); pg.computeVertexNormals();
    g.add(new THREE.Mesh(pg, phMat('stone_wall', 1, 1, { color: 0xa8a090, side: THREE.DoubleSide })));
    // une souche de cheminée sur le faîtage
    pose(g, boite(1.2, 2.4, 0.9, 'stone_wall', { color: 0x9a9284 }), -L / 2 + 3, H + hl + 0.2, 0); }

  // ---- la tour ronde et sa poivrière, à l'angle avant droit ----
  const tx = L / 2 - 0.4, tz = W / 2 - 0.4, tr = 2.7, th = H + 3.5;
  pose(g, new THREE.Mesh(new THREE.CylinderGeometry(tr, tr + 0.15, th + 5, 24, 1, true), phMat('stone_wall', 2 * Math.PI * tr, th + 5, { color: 0xa8a090 })), tx, (th - 5) / 2, tz);
  // le toit de la tour : un cône bas de tuiles (35 %), plus de poivrière pointue — c'était la lauze
  pose(g, new THREE.Mesh(new THREE.ConeGeometry(tr + 0.5, 1.1 * (tr + 0.5), 24, 1, true), TUILE(2 * Math.PI * (tr + 0.5) / 2, 3.3)), tx, th + 0.55 * (tr + 0.5), tz);
  // ses deux jours étroits, l'un au-dessus de l'autre (l'escalier à vis)
  for (const y of [3.2, 6.6]) { const a = Math.PI / 4; const fen = pose(g, boite(0.5, 1.0, 0.3, 'granite_tile_03', { color: 0xbab4a8 }), tx + Math.cos(a) * tr, y, tz + Math.sin(a) * tr, -a + Math.PI / 2);
    fen.add(mesh(boxG(0.32, 0.8, 0.32), new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.4, metalness: 0.2 }), 0, 0, 0.02)); }

  // ---- les baies : granit autour, vitre sombre, croisée de bois, volets ----
  const vitre = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.18, metalness: 0.35 });
  const bois = phMat('wood_planks', 0.6, 1.5, { color: volets });
  const croisee = phMat('wood_cabinet_worn_long', 0.1, 1.5, { color: 0xd8d0c0 });
  function baie(face, u, y, w = 1.0, h = 1.5, ferme = fermes) {
    // face : +1 la façade (z = W/2), -1 l'arrière ; u : position le long de la façade
    const z = face * (W / 2), ry = face > 0 ? 0 : Math.PI, f = new THREE.Group(); pose(g, f, u, y, z, ry);
    const gr = (a, b, x, yy) => f.add(mesh(boxG(a, b, 0.32), phMat('granite_tile_03', a, b, { color: 0xbab4a8 }), x, yy, 0.06));
    gr(w + 0.5, 0.28, 0, h / 2 + 0.14); gr(w + 0.6, 0.18, 0, -h / 2 - 0.09);          // le linteau, l'appui
    gr(0.24, h, -w / 2 - 0.12, 0); gr(0.24, h, w / 2 + 0.12, 0);                      // les jambages
    f.add(mesh(boxG(w, h, 0.1), vitre, 0, 0, -0.06));
    f.add(mesh(boxG(0.07, h, 0.06), croisee, 0, 0, 0.0)); f.add(mesh(boxG(w, 0.07, 0.06), croisee, 0, h * 0.15, 0.0));
    if (ferme) { f.add(mesh(boxG(w / 2 - 0.02, h, 0.06), bois, -w / 4, 0, 0.1)); f.add(mesh(boxG(w / 2 - 0.02, h, 0.06), bois, w / 4, 0, 0.1)); }
    else for (const sx of [-1, 1]) f.add(mesh(boxG(w / 2, h, 0.06), bois, sx * (w / 2 + 0.24 + w / 4), 0, 0.2));
  }
  for (const u of [-7.5, -4.2, 4.2]) baie(1, u, 2.3);
  for (const u of [-7.5, -4.2, 0, 4.2]) baie(1, u, 5.9);
  for (const u of [-6, -2, 2, 6]) { baie(-1, u, 2.3, 0.9, 1.3); baie(-1, u, 5.9, 0.9, 1.3); }

  // ---- la porte : un arc de granit, des vantaux de bois cloutés ----
  { const p = new THREE.Group(); pose(g, p, 0, 0, W / 2);
    const gr = phMat('granite_tile_03', 1, 1, { color: 0xbab4a8 });
    p.add(mesh(boxG(0.4, 2.6, 0.4), gr, -1.05, 1.3, 0.1)); p.add(mesh(boxG(0.4, 2.6, 0.4), gr, 1.05, 1.3, 0.1));
    const arc = mesh(new THREE.TorusGeometry(1.05, 0.2, 8, 16, Math.PI), gr, 0, 2.6, 0.1); arc.scale.z = 2; p.add(arc);
    const vant = phMat('wood_cabinet_worn_long', 1.7, 2.6, { color: 0x5a4030 });
    p.add(mesh(boxG(1.7, 2.6, 0.12), vant, 0, 1.3, -0.02));
    const tympan = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16, 0, Math.PI), vant); tympan.position.set(0, 2.6, -0.01); p.add(tympan);
    p.add(mesh(boxG(3.0, 0.3, 1.2), gr, 0, 0.0, 0.7)); }                               // le seuil

  // ---- la cour, le muret, les piliers, le puits ----
  const terre = phMat('terre_battue', 1, 1, { color: 0xb09878, polygonOffset: true, polygonOffsetFactor: -2 });
  { const nx = 12, nz = 8, gx = L + 4, gz = C, geo = new THREE.PlaneGeometry(gx, gz, nx, nz); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let k = 0; k < p.count; k++) { const lx = p.getX(k), lz = p.getZ(k) + W / 2 + gz / 2; p.setXYZ(k, lx, sol(lx, lz) + 0.04, lz); uv.setXY(k, lx / 2, lz / 2); }
    geo.computeVertexNormals(); const m = new THREE.Mesh(geo, terre); m.receiveShadow = true; g.add(m); }
  const muret = (a, b) => {                                    // un muret de a à b (local), par pièces de 2 m posées sur le sol
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)), ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, lx = a[0] + (b[0] - a[0]) * t, lz = a[1] + (b[1] - a[1]) * t, l = Math.hypot(b[0] - a[0], b[1] - a[1]) / n;
      pose(g, boite(0.55, 2.2, l + 0.05, 'rustic_stone_wall_02', { color: 0x9e968a }), lx, sol(lx, lz) + 0.1, lz, ang); }
    const e = 0.35, [ax, az] = a, [bx, bz] = b, ux = (bz - az), uz = -(bx - ax), ul = Math.hypot(ux, uz) || 1;
    inscrire([[ax + ux / ul * e, az + uz / ul * e], [bx + ux / ul * e, bz + uz / ul * e], [bx - ux / ul * e, bz - uz / ul * e], [ax - ux / ul * e, az - uz / ul * e]].map(([x, z]) => monde(x, z)), ...monde((ax + bx) / 2, (az + bz) / 2));
  };
  const xg = L / 2 + 2, zf = W / 2 + C, porte = 1.9;
  muret([-xg, W / 2], [-xg, zf]); muret([xg, W / 2 + 3], [xg, zf]);
  muret([-xg, zf], [-porte, zf]); muret([porte, zf], [xg, zf]);
  for (const sx of [-1, 1]) pose(g, boite(0.8, 2.4, 0.8, 'granite_tile_03', { color: 0xbab4a8 }), sx * (porte + 0.2), sol(sx * (porte + 0.2), zf) + 0.9, zf);
  { const px = -L / 2 + 4, pz = W / 2 + C * 0.55, py = sol(px, pz);
    const pu = new THREE.Group(); pose(g, pu, px, py, pz);
    pu.add(mesh(new THREE.CylinderGeometry(1.0, 1.05, 1.0, 20, 1, true), phMat('stone_wall', 6.3, 1.0, { color: 0xa09888, side: THREE.DoubleSide }), 0, 0.5, 0));
    const fond = new THREE.Mesh(new THREE.CircleGeometry(0.98, 20), new THREE.MeshStandardMaterial({ color: 0x0b0907, roughness: 1 })); fond.rotation.x = -Math.PI / 2; fond.position.y = 0.25; pu.add(fond);
    const mont = phMat('wood_cabinet_worn_long', 0.2, 2.2, { color: 0x6a5440 });
    pu.add(mesh(boxG(0.18, 2.2, 0.18), mont, -0.95, 1.1, 0)); pu.add(mesh(boxG(0.18, 2.2, 0.18), mont, 0.95, 1.1, 0)); pu.add(mesh(boxG(2.3, 0.2, 0.2), mont, 0, 2.2, 0));
    const [wx, wz] = monde(px, pz);
    inscrire(Array.from({ length: 10 }, (_, k) => monde(px + Math.cos(k / 10 * 6.283) * 1.1, pz + Math.sin(k / 10 * 6.283) * 1.1)), wx, wz);
    addInteract({ pos: new THREE.Vector3(wx, y0 + py, wz), r: 2.6, prompt: () => 'regarder dans le puits', fn: () => showMessage('Le puits est à sec. Tout au fond, des pierres sèches, et pas un reflet.', 5) }); }

  // ---- les collisions du logis et de la tour ----
  inscrire([[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]].map(([a, b]) => monde(a, b)), X, Z);
  LIEU.murs.push({ pts: [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]].map(([a, b]) => monde(a, b)), sol: y0 });
  LIEU.toits.push({ bat: LIEU.murs.length - 1, pts: [[-L / 2 - 0.6, -W / 2 - 0.6], [L / 2 + 0.6, -W / 2 - 0.6], [L / 2 + 0.6, W / 2 + 0.6], [-L / 2 - 0.6, W / 2 + 0.6]].map(([a, b]) => monde(a, b)) });
  inscrire(Array.from({ length: 12 }, (_, k) => monde(tx + Math.cos(k / 12 * 6.283) * tr, tz + Math.sin(k / 12 * 6.283) * tr)), ...monde(tx, tz));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const [fx, fz] = monde(0, W / 2 + 2);
  addInteract({ pos: new THREE.Vector3(fx, y0, fz), r: 3, prompt: () => nom, fn: () => showMessage(mot, 6) });
}

// Le LIERRE d'une façade (le Batut, le Pouget) : des cartes de feuillage (le houppier du charme,
// découpé par son alpha) posées à plat contre le mur, qui se chevauchent ; le haut du lierre
// ondule (ali), et il laisse les baies libres. faces : [x0, x1, z de la façade] dans le repère de
// la maison ; libre : [x, y, largeur, hauteur] des baies.
function lierre(g, faces, libre, ali) {
  const esp = especeGeo('charme'); if (!esp) return;
  const pos = [], uv = [];
  for (const [a, b, zf] of faces) for (let x = a + 0.3; x < b - 0.2; x += 0.55) for (let y = 0.2; y < ali(x); y += 0.55) {
    if (libre.some(([wx, wy, ww, wh]) => Math.abs(x - wx) < ww / 2 + 0.55 && Math.abs(y - wy) < wh / 2 + 0.35)) continue;
    const r = 0.55 + 0.25 * Math.abs(Math.sin(x * 3.1 + y * 1.7)), j = 0.12 * Math.sin(x * 5.3 + y * 2.9), z = zf + 0.1 + 0.08 * Math.abs(Math.sin(x * 2 + y));
    const q = [[x - r + j, y - r, z], [x + r + j, y - r, z], [x + r - j, y + r, z], [x - r - j, y + r, z]];
    for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...q[i]); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
  const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gl.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gl.computeVertexNormals();
  const feuilles = esp.matH.clone(); feuilles.color = new THREE.Color(0x5a7040);
  const l = new THREE.Mesh(gl, feuilles); l.receiveShadow = true; g.add(l);
}

// ---------------------------------------------------------------------
//  Les intérieurs : on entre dans les maisons Roquette (5 octobre)
// ---------------------------------------------------------------------
// Eugène : « fais les intérieurs des trois maisons, en exploitant ce qui a été fait pour le mode
// multi ». batut.js (le multi) a appris comment bâtir un dedans où l'on marche : des murs dont la
// collision est une capsule du moteur (addCap) qui s'arrête au linteau, des portes de 2 m (Camille a
// 0,5 m de rayon de collision quelle que soit son échelle, et la capsule d'un mur déborde de sa
// demi-épaisseur), des meubles qui arrêtent, la caméra tenue sous le plafond. On le reprend ici, mais
// DANS les maisons qu'on voit du dehors, à leurs vraies dimensions : on passe la porte, on est dedans.
// Le relief est mis de niveau sous chaque maison (fondre-relief-aveyron.py, « les terre-pleins ») :
// le sol de la maison est le relief, plat — le moteur ne sait pas poser un plancher sous une maison
// tournée. Les maisons ne sont plus inscrites dans la grille de monde.js (on n'y entrerait pas) ;
// leurs emprises sont gardées ici, pour que rien n'y pousse ni ne s'y pose.
const EMPRISES = [], DEDANS = [];             // les emprises (monde), et les pièces où la caméra se tient basse
const dansUneMaison = (x, z, m = 0) => EMPRISES.some((P) => dansPoly(x, z, P) || (m > 0 && P.some(([px, pz]) => Math.hypot(px - x, pz - z) < m)));
function interieur(g, monde, y0) {
  const capW = (ax, az, bx, bz, r, top, bas) => { const [wa, wb] = [monde(ax, az), monde(bx, bz)], c = addCap(wa[0], wa[1], wb[0], wb[1], r, y0 + top); if (bas !== undefined) c.bottom = y0 + bas; return c; };
  return {
    // un mur droit dans le repère de la maison, de (ax, az) à (bx, bz) — sa ligne MÉDIANE —, de
    // 5 m sous terre à h, percé de portes { t (le milieu, en m depuis a), w, h } ; dehors (option),
    // la matière de sa face extérieure ; dedans, un enduit ; le côté intérieur est `cote` (+1 ou −1,
    // à gauche ou à droite en allant de a vers b)
    mur(ax, az, bx, bz, { ep = 0.6, h, slug = 'enduit_gris', opt = { color: 0xeae2d2 }, dedans = null, cote = 1, portes = [], plafond = 3.1 } = {}) {
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, ry = -Math.atan2(bz - az, bx - ax), r = ep / 2 + 0.03;
      const nx = -uz * cote, nz = ux * cote;                         // vers l'intérieur
      const bout = (a, b, ya, yb, dur) => {
        if (b - a < 0.02 || yb - ya < 0.02) return;
        const cx = ax + ux * (a + b) / 2, cz = az + uz * (a + b) / 2;
        pose(g, boite(b - a, yb - ya, ep, slug, opt), cx, (ya + yb) / 2, cz, ry);
        // l'enduit du dedans, jusqu'au plafond seulement (au-dessus, c'est le comble)
        if (dedans && ya < plafond) pose(g, boite(b - a, Math.min(yb, plafond) - Math.max(ya, 0), 0.03, dedans.slug, dedans.opt), cx + nx * (ep / 2 + 0.016), (Math.max(ya, 0) + Math.min(yb, plafond)) / 2, cz + nz * (ep / 2 + 0.016), ry);
        if (dur) capW(ax + ux * a, az + uz * a, ax + ux * b, az + uz * b, r, yb);
      };
      let t0 = 0;
      for (const p of [...portes].sort((a, b) => a.t - b.t)) { const a = p.t - p.w / 2, b = p.t + p.w / 2; bout(t0, a, -5, h, true); bout(a, b, p.h ?? 2.5, h, false); t0 = b; }
      bout(t0, L, -5, h, true);
    },
    // le sol d'une pièce (un parquet, des tomettes) et son plafond, dans le repère de la maison
    sol(x0, x1, z0, z1, slug, color, { plafond = 3.1, poutres = true, nom = null } = {}) {
      pose(g, boite(x1 - x0, 0.05, z1 - z0, slug, { color }), (x0 + x1) / 2, 0.03, (z0 + z1) / 2).castShadow = false;
      pose(g, boite(x1 - x0, 0.12, z1 - z0, 'enduit_gris', { color: 0xe8e0d0 }), (x0 + x1) / 2, plafond + 0.06, (z0 + z1) / 2).castShadow = false;
      if (poutres) for (let x = x0 + 1.2; x < x1 - 0.5; x += 1.4) pose(g, boite(0.2, 0.22, z1 - z0, 'wood_cabinet_worn_long', { color: 0x4a3420 }), x, plafond - 0.11, (z0 + z1) / 2).castShadow = false;
      DEDANS.push({ pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([a, b]) => monde(a, b)), plafond: y0 + plafond, nom });
    },
    // un meuble : sa boîte, et sa collision (une capsule couchée sur son grand côté — les boîtes du
    // moteur sont alignées sur les axes, la maison est tournée)
    meuble(x, z, w, d, h, slug, color, ry = 0, { dur = true, y = 0 } = {}) {
      const m = boite(w, h, d, slug, { color }); pose(g, m, x, y + h / 2, z, ry);
      if (!dur) return m;
      const c = Math.cos(ry), s = Math.sin(ry), R = Math.min(w, d) / 2, l = Math.max(0, Math.max(w, d) / 2 - R), [lx, lz] = w >= d ? [c * l, -s * l] : [s * l, c * l];
      capW(x - lx, z - lz, x + lx, z + lz, R + 0.05, y + h); return m;
    },
    cap: capW,
  };
}
// le feu d'une cheminée : la hotte de pierre, le foyer, les braises (une lueur, pas une lumière)
function cheminee2(I, g, x, z, ry, { w = 2.2 } = {}) {
  const f = new THREE.Group(); pose(g, f, x, 0, z, ry);
  f.add(mesh(boxG(w, 1.25, 0.7), phMat('granite_tile_03', w, 1.25, { color: 0xc8c2b6 }), 0, 0.62, 0));
  f.add(mesh(boxG(w - 0.7, 0.85, 0.72), new THREE.MeshStandardMaterial({ color: 0x0e0b09, roughness: 1 }), 0, 0.45, 0.02));
  f.add(mesh(boxG(w - 0.9, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: 0xc8501e }), 0, 0.1, 0.12));
  f.add(mesh(boxG(w + 0.3, 0.16, 0.85), phMat('granite_tile_03', w + 0.3, 0.85, { color: 0xbab4a8 }), 0, 1.3, 0.02));
  f.add(mesh(boxG(w - 0.2, 1.7, 0.55), phMat('enduit_gris', w, 1.7, { color: 0xe0d8c8 }), 0, 2.25, -0.05));
  const c = Math.cos(ry), s = Math.sin(ry); I.cap(x - c * w / 2, z + s * w / 2, x + c * w / 2, z - s * w / 2, 0.4, 1.4);
}
// les meubles qui reviennent d'une maison à l'autre
function mobilier(I, g) {
  const BOIS = 'wood_cabinet_worn_long', SOMBRE = 0x5a4030, CLAIR = 0x8a6a48;
  return {
    canape(x, z, ry, couleur = 0x7a3e32) { const q = new THREE.Group(); pose(g, q, x, 0, z, ry);
      q.add(mesh(boxG(2.4, 0.45, 0.9), phMat('wool_boucle', 2.4, 0.9, { color: couleur }), 0, 0.225, 0));
      q.add(mesh(boxG(2.4, 0.9, 0.22), phMat('wool_boucle', 2.4, 0.9, { color: couleur }), 0, 0.45, -0.34));
      for (const sx of [-1, 1]) q.add(mesh(boxG(0.2, 0.65, 0.9), phMat('wool_boucle', 0.2, 0.65, { color: couleur }), sx * 1.1, 0.33, 0));
      const c = Math.cos(ry), s = Math.sin(ry); I.cap(x - c * 0.8, z + s * 0.8, x + c * 0.8, z - s * 0.8, 0.5, 0.9); },
    fauteuil(x, z, ry) { const q = new THREE.Group(); pose(g, q, x, 0, z, ry);
      q.add(mesh(boxG(0.85, 0.45, 0.85), phMat('wool_boucle', 0.85, 0.85, { color: 0x6a5a3a }), 0, 0.225, 0)); q.add(mesh(boxG(0.85, 0.95, 0.18), phMat('wool_boucle', 0.85, 0.95, { color: 0x6a5a3a }), 0, 0.48, -0.34));
      I.cap(x, z, x, z, 0.45, 0.95); },
    table(x, z, w, d, ry = 0, chaises = 0) { I.meuble(x, z, w, d, 0.78, BOIS, SOMBRE, ry);
      const c = Math.cos(ry), s = Math.sin(ry), n = chaises / 2;
      for (let k = 0; k < n; k++) for (const sz of [-1, 1]) { const lx = -w / 2 + (k + 0.5) * w / n, lz = sz * (d / 2 + 0.35); const cx = x + lx * c + lz * s, cz = z - lx * s + lz * c;
        const ch = new THREE.Group(); pose(g, ch, cx, 0, cz, ry + (sz > 0 ? Math.PI : 0)); ch.add(mesh(boxG(0.45, 0.06, 0.45), phMat(BOIS, 0.45, 0.45, { color: SOMBRE }), 0, 0.46, 0)); ch.add(mesh(boxG(0.45, 0.55, 0.05), phMat(BOIS, 0.45, 0.55, { color: SOMBRE }), 0, 0.75, -0.2));
        for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) ch.add(mesh(boxG(0.05, 0.46, 0.05), phMat(BOIS, 0.05, 0.46, { color: SOMBRE }), a, 0.23, b)); } },
    buffet(x, z, w, ry, h = 1.0) { I.meuble(x, z, w, 0.55, h, BOIS, SOMBRE, ry); },
    armoire(x, z, ry) { I.meuble(x, z, 1.6, 0.65, 2.3, BOIS, SOMBRE, ry); },
    rayonnage(x, z, w, ry) { const m = I.meuble(x, z, w, 0.45, 2.2, 'wood_planks', 0x4a3424, ry); const livres = [0x6a2a24, 0x2a4a3a, 0x3a3a5a, 0x7a5a2a, 0x4a2a3a];
      const c = Math.cos(ry), s = Math.sin(ry); for (let r = 0; r < 4; r++) { const q = mesh(boxG(w - 0.25, 0.34, 0.06), phMat(BOIS, w, 0.34, { color: livres[(r + Math.round(x)) % 5] }), 0, 0, 0); pose(g, q, x + s * 0.21, 0.4 + r * 0.5, z + c * 0.21, ry); q.castShadow = false; } return m; },
    tapis(x, z, w, d, ry = 0, color = 0x8a3a2e) { const t = mesh(boxG(w, 0.02, d), phMat('fabric_pattern_07', w, d, { color }), 0, 0, 0); pose(g, t, x, 0.065, z, ry); t.castShadow = false; },
    horloge(x, z, ry) { I.meuble(x, z, 0.55, 0.4, 2.1, BOIS, SOMBRE, ry); },
    tonneau(x, z) { pose(g, new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), phMat('wood_planks', 2.6, 1.0, { color: 0x6a4a2a })), x, 0.5, z); I.cap(x, z, x, z, 0.45, 1.0); },
    lit(x, z, ry, color = 0xc8bca8) { I.meuble(x, z, 1.6, 2.1, 0.6, 'wool_boucle', color, ry); I.meuble(x - Math.sin(ry) * 1.0, z - Math.cos(ry) * 1.0, 1.7, 0.15, 1.3, BOIS, SOMBRE, ry, { dur: false }); },
    piano(x, z, ry) { I.meuble(x, z, 1.5, 0.6, 1.3, BOIS, 0x1e1612, ry); },
    BOIS, SOMBRE, CLAIR,
  };
}
// les emprises d'une maison : gardées pour arbres, brebis, gens (rien ne s'y pose), et pour le banc
function emprise(monde, [x0, x1, z0, z1], sol, toitO = null) {
  const emp = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([a, b]) => monde(a, b)); EMPRISES.push(emp);
  LIEU.murs.push({ pts: emp, sol }); if (toitO != null) LIEU.toits.push({ bat: LIEU.murs.length - 1, pts: [[x0 - toitO, z0 - toitO], [x1 + toitO, z0 - toitO], [x1 + toitO, z1 + toitO], [x0 - toitO, z1 + toitO]].map(([a, b]) => monde(a, b)) });
}

// ---------------------------------------------------------------------
//  Le Batut, d'après le dessin de P. Gaillac (docs/SCENARIO.md, « Les trois maisons »)
// ---------------------------------------------------------------------
// Eugène, 5 octobre : « du réalisme au niveau des proportions ». Le Batut n'est pas un bloc de
// granit à tour ronde (la recette des grandes maisons, qu'il partageait avec les deux autres) :
// c'est une maison de PLUSIEURS CORPS accolés, de hauteurs différentes —
// - au centre, le corps haut de trois niveaux (9 × 10 m, 9,6 m à l'égout), pignon sur le lac
//   percé d'un oculus ;
// - à gauche, un corps plus bas (deux niveaux, en retrait de 1,5 m) ;
// - à droite, l'aile aux fenêtres et à la porte CINTRÉES, ses petits oculus, sa lucarne ;
// des murs clairs enduits à la chaux, le lierre jusqu'au premier étage, des volets à persiennes
// ouverts, un très grand hêtre à gauche dont les branches passent au-dessus du toit, et devant,
// un muret bas dans une haie, avec une petite ouverture.
// Les mesures sont celles d'une maison de maître rurale : 3 m par niveau, des baies de 1 × 1,6 m
// au rez-de-chaussée et au premier, plus petites sous le toit, une porte de 1,2 × 2,5 m.
function batut({ hauteur, scene, addInteract, inscrire }, X, Z, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), monde = (lx, lz) => [X + lx * c + lz * s, Z - lx * s + lz * c];
  const CORPS = [
    // (en lauze depuis le 5 octobre : les corps bas à 40°, un peu abaissés, pour que leurs faîtages
    // passent sous le toit du corps central au lieu de le percer)
    { x0: -4.5, x1: 4.5, z0: -5, z1: 5, H: 9.6, faitage: 'z', P: 1.0 },          // le corps central, pignon sur la façade
    { x0: -11.5, x1: -4.5, z0: -4.5, z1: 3.5, H: 5.6, faitage: 'x', P: 0.8 },     // le corps bas, à gauche
    { x0: 4.5, x1: 14.5, z0: -4.5, z1: 4, H: 6.0, faitage: 'x', P: 0.8 },         // l'aile droite
  ];
  let y0 = 1e9; for (const k of CORPS) for (const [a, b] of [[k.x0, k.z0], [k.x1, k.z0], [k.x1, k.z1], [k.x0, k.z1]]) y0 = Math.min(y0, hauteur(...monde(a, b)));
  const g = new THREE.Group(); g.position.set(X, y0, Z); g.rotation.y = rot; scene.add(g);
  // l'enduit à la chaux, lisse et clair : chaux_craquelee se lisait comme des moellons en rendu
  const ENDUIT = { color: 0xf4ecdc }, O = 0.45;
  const piece = (arr, geo, x, y, z, ry = 0, rz = 0) => { geo.rotateZ(rz); geo.rotateY(ry); geo.translate(x, y, z); const gn = geo.index ? geo.toNonIndexed() : geo; gn.computeVertexNormals(); arr.push(gn); };
  const vitres = [], granit = [], bois = [], tuiles = [], pignons = [], jour = [];

  // ---- les corps, leurs toits (tuiles canal, Eugène, 2 octobre), leurs pignons enduits ----
  for (const k of CORPS) {
    const w = k.x1 - k.x0, d = k.z1 - k.z0, cx = (k.x0 + k.x1) / 2, cz = (k.z0 + k.z1) / 2;
    const P = k.P, long = k.faitage === 'x' ? w : d, large = k.faitage === 'x' ? d : w, hl = (large / 2 + O) * P, la = long / 2 + O, lb = large / 2 + O;
    const V = (a, b, y) => k.faitage === 'x' ? [cx + a, y, cz + b] : [cx + b, y, cz + a];
    const pos = [], uv = [], rampe = Math.hypot(lb, hl);
    for (const sg of [1, -1]) { const q = [V(-la, sg * lb, k.H - O * P), V(la, sg * lb, k.H - O * P), V(la, 0, k.H + hl - O * P), V(-la, 0, k.H + hl - O * P)];
      for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...q[i]); uv.push(0, 0, 2 * la / 3, 0, 2 * la / 3, rampe / 3, 0, 0, 2 * la / 3, rampe / 3, 0, rampe / 3); }
    const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gt.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gt.computeVertexNormals(); tuiles.push(gt);
    for (const sg of [1, -1]) { const t = [V(sg * long / 2, -large / 2, k.H), V(sg * long / 2, large / 2, k.H), V(sg * long / 2, 0, k.H + large / 2 * P)], gp = new THREE.BufferGeometry();
      gp.setAttribute('position', new THREE.Float32BufferAttribute(t.flat(), 3)); gp.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, large / 2.4, 0, large / 4.8, large / 2 * P / 2.4], 2)); gp.computeVertexNormals(); pignons.push(gp); }
    // ce que le banc du lieu mesure ; l'emprise, où rien ne pousse (la maison n'est plus un bloc : on y entre)
    emprise(monde, [k.x0, k.x1, k.z0, k.z1], y0, O);
  }
  // deux souches de cheminée, sur le corps central et sur l'aile
  pose(g, boite(1.1, 2.2, 0.8, 'rustic_stone_wall_02', { color: 0x9e968a }), 0, 9.6 + 4.5 + 0.6, -3.2);     // sur le faîtage du corps central
  pose(g, boite(1.0, 1.8, 0.8, 'rustic_stone_wall_02', { color: 0x9e968a }), 12.5, 6.0 + 4.25 * 0.8 + 0.5, -0.5);

  // ---- les ouvertures : la vitre, l'encadrement de pierre, les persiennes ouvertes ----
  // ouverte : la porte d'entrée, ses deux vantaux rabattus contre le mur, dedans ; le jour : un aplat
  // clair sur la face intérieure du mur, à chaque fenêtre (cf. batut.js) — dedans, on voit dehors
  const baie = (x, y, zf, w, h, { cintre = false, porte = false, persiennes = !porte, ouverte = false } = {}) => {
    const z = zf + 0.03;
    if (!ouverte) piece(porte ? bois : vitres, boxG(w, h, 0.06), x, y, z - 0.02);
    else for (const sx of [-1, 1]) piece(bois, boxG(0.06, h, w / 2), x + sx * (w / 2 - 0.03), y, zf - 0.6 - w / 4);
    if (!porte && zf > 0) piece(jour, boxG(w, h, 0.02), x, y, zf - 0.62);         // (les baies de derrière sont dans le mur, à l'étage)
    if (cintre) { const a = new THREE.CircleGeometry(w / 2, 14, 0, Math.PI); piece(porte ? bois : vitres, a, x, y + h / 2, z + (ouverte ? -0.62 : 0.01));
      piece(granit, new THREE.TorusGeometry(w / 2 + 0.1, 0.11, 6, 14, Math.PI), x, y + h / 2, z + 0.04); }
    else piece(granit, boxG(w + 0.36, 0.2, 0.12), x, y + h / 2 + 0.1, z + 0.03);
    for (const sx of [-1, 1]) piece(granit, boxG(0.16, h, 0.12), x + sx * (w / 2 + 0.08), y, z + 0.03);
    if (!porte) piece(granit, boxG(w + 0.4, 0.1, 0.22), x, y - h / 2 - 0.05, z + 0.08);
    if (persiennes && !cintre) for (const sx of [-1, 1]) {            // un battant de chaque côté, à lames inclinées
      const bx = x + sx * (w / 2 + 0.18 + w / 4); piece(bois, boxG(w / 2, 0.06, 0.05), bx, y + h / 2 - 0.03, z + 0.06); piece(bois, boxG(w / 2, 0.06, 0.05), bx, y - h / 2 + 0.03, z + 0.06);
      for (let k = 0; k < Math.floor(h / 0.11) - 1; k++) piece(bois, boxG(w / 2 - 0.06, 0.07, 0.02), bx, y - h / 2 + 0.1 + k * 0.11, z + 0.07, 0, 0, 0); }
  };
  const oculus = (x, y, zf, r) => { const z = zf + 0.03; piece(vitres, new THREE.CircleGeometry(r, 16), x, y, z + 0.01); piece(granit, new THREE.TorusGeometry(r + 0.06, 0.09, 6, 18), x, y, z + 0.04); };
  // le corps central : deux baies par niveau, plus petites sous le toit ; l'oculus du pignon
  for (const x of [-2.1, 2.1]) { baie(x, 1.75, 5, 1.0, 1.6); baie(x, 4.85, 5, 1.0, 1.6); baie(x, 7.9, 5, 0.85, 1.2); }
  oculus(0, 9.6 + 0.75, 5, 0.42);
  for (const x of [-2.1, 2.1]) { baie(x, 4.85, -5, 0.9, 1.4); }                   // derrière, côté coteau
  // le corps bas : une baie et une porte basse au rez-de-chaussée, deux baies à l'étage
  baie(-9.6, 1.75, 3.5, 0.9, 1.4); baie(-6.6, 1.15, 3.5, 1.0, 2.2, { porte: true }); baie(-9.6, 4.6, 3.5, 0.85, 1.2); baie(-6.6, 4.6, 3.5, 0.85, 1.2);
  // l'aile droite : la porte cintrée au milieu, deux fenêtres cintrées, deux petits oculus à l'étage
  baie(9.5, 1.2, 4, 1.9, 2.4, { cintre: true, porte: true, ouverte: true });     // 1,9 m : on y passe (le rayon de Camille) baie(6.6, 1.65, 4, 1.0, 1.7, { cintre: true }); baie(12.4, 1.65, 4, 1.0, 1.7, { cintre: true });
  baie(9.5, 4.7, 4, 0.95, 1.4); oculus(6.6, 4.9, 4, 0.32); oculus(12.4, 4.9, 4, 0.32);
  // sa lucarne, sur le pan avant du toit
  { const ly = 6.0 + 0.6, lz = 4 - 1.4, lu = new THREE.Group(); pose(g, lu, 9.5, ly, lz);
    lu.add(mesh(boxG(1.5, 1.5, 1.6), phMat('enduit_gris', 1.5, 1.5, ENDUIT), 0, 0.5, 0));
    const tl = mesh(boxG(1.9, 0.08, 1.9), TUILE(1.9, 1.9), 0, 1.38, 0.05); tl.rotation.x = 0.12; lu.add(tl);
    lu.add(mesh(boxG(0.7, 0.9, 0.06), new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.18, metalness: 0.35 }), 0, 0.55, 0.82)); }
  const fondre = (arr, mat) => { if (!arr.length) return; const m = new THREE.Mesh(mergeGeometries(arr.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(a)) q.deleteAttribute(a); if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); return q; })), mat); m.castShadow = m.receiveShadow = true; g.add(m); };
  fondre(vitres, new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.18, metalness: 0.35 }));
  fondre(jour, new THREE.MeshBasicMaterial({ color: 0xd6e6f2 }));
  fondre(granit, phMat('granite_tile_03', 1, 1, { color: 0xc8c2b6 }));
  fondre(bois, phMat('wood_cabinet_worn_long', 1, 1, { color: 0x8a9a8c }));        // les persiennes, d'un vert-de-gris passé
  fondre(tuiles, TUILE(1, 1)); fondre(pignons, phMat('enduit_gris', 1, 1, { ...ENDUIT, side: THREE.DoubleSide }));

  // ---- les murs, creux : on entre (5 octobre) ----
  // les lignes médianes des murs de 60 cm (leur face extérieure sur l'emprise) ; les passages d'un
  // corps à l'autre font 1,9 m, la cloison de la cuisine 20 cm et sa porte 1,6 m
  const I = interieur(g, monde, y0), M = mobilier(I, g), E = { slug: 'enduit_gris', opt: ENDUIT, dedans: { slug: 'enduit_gris', opt: { color: 0xece4d4 } } };
  const socle = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az); pose(g, boite(L + 0.1, 0.9, 0.08, 'rustic_stone_wall_02', { color: 0x9e968a }), (ax + bx) / 2 + nx * 0.04, 0.2, (az + bz) / 2 + nz * 0.04, -Math.atan2(bz - az, bx - ax)); };
  I.mur(-4.5, 4.7, 4.5, 4.7, { ...E, h: 9.6, cote: -1 }); I.mur(-4.5, -4.7, 4.5, -4.7, { ...E, h: 9.6, cote: 1 });
  I.mur(-4.2, -5, -4.2, 5, { ...E, h: 9.6, cote: -1, portes: [{ t: 4.5, w: 1.9, h: 2.5 }] }); I.mur(4.2, -5, 4.2, 5, { ...E, h: 9.6, cote: 1, portes: [{ t: 5, w: 1.9, h: 2.5 }] });
  I.mur(-11.5, 3.2, -4.5, 3.2, { ...E, h: 5.6, cote: -1 }); I.mur(-11.5, -4.2, -4.5, -4.2, { ...E, h: 5.6, cote: 1 }); I.mur(-11.2, -4.5, -11.2, 3.5, { ...E, h: 5.6, cote: -1 });
  I.mur(4.5, 3.7, 14.5, 3.7, { ...E, h: 6.0, cote: -1, portes: [{ t: 5, w: 1.9, h: 2.45 }] }); I.mur(4.5, -4.2, 14.5, -4.2, { ...E, h: 6.0, cote: 1 }); I.mur(14.2, -4.5, 14.2, 4, { ...E, h: 6.0, cote: 1 });
  I.mur(11.0, -3.9, 11.0, 3.4, { ep: 0.2, h: 3.1, slug: 'enduit_gris', opt: { color: 0xece4d4 }, portes: [{ t: 2.0, w: 1.6, h: 2.3 }] });
  for (const [ax, az, bx, bz, nx, nz] of [[-4.5, 5, 4.5, 5, 0, 1], [-11.5, 3.5, -4.5, 3.5, 0, 1], [4.5, 4, 8.5, 4, 0, 1], [10.5, 4, 14.5, 4, 0, 1], [-11.5, -4.5, 14.5, -4.5, 0, -1], [-11.5, -4.5, -11.5, 3.5, -1, 0], [14.5, -4.5, 14.5, 4, 1, 0]]) socle(ax, az, bx, bz, nx, nz);
  // ---- le dedans : le grand salon au centre, la bibliothèque dans le corps bas, la salle à manger et la cuisine dans l'aile ----
  I.sol(-3.9, 3.9, -4.4, 4.4, 'wood_planks', 0xa07a52, { nom: 'le grand salon' });
  I.sol(-10.9, -4.5, -3.9, 2.9, 'wood_planks', 0x8a6a4a, { nom: 'la bibliothèque', plafond: 3.0 });
  I.sol(4.5, 10.9, -3.9, 3.4, 'worn_tile_floor', 0xc8b8a4, { nom: 'la salle à manger', plafond: 3.0 });
  I.sol(11.1, 13.9, -3.9, 3.4, 'worn_tile_floor', 0xb89a80, { nom: 'la cuisine', plafond: 3.0 });
  // (les passages entre corps : le sol continue sous l'épaisseur du mur)
  for (const [x0, x1, z0, z1] of [[-4.5, -3.9, -1.45, 0.45], [3.9, 4.5, -0.95, 0.95], [8.55, 10.45, 3.4, 4.0]]) pose(g, boite(x1 - x0, 0.05, z1 - z0, 'wood_planks', { color: 0x9a7650 }), (x0 + x1) / 2, 0.03, (z0 + z1) / 2).castShadow = false;
  cheminee2(I, g, 0, -4.05, 0, { w: 2.4 });
  M.tapis(0, -1.0, 3.6, 2.6); M.canape(0, 1.1, Math.PI); I.meuble(0, -1.1, 1.3, 0.7, 0.45, M.BOIS, M.SOMBRE);
  M.fauteuil(-2.4, -1.6, Math.PI / 2); M.fauteuil(2.4, -1.6, -Math.PI / 2); M.piano(-2.9, 3.8, Math.PI); M.horloge(3.5, 3.9, Math.PI);
  M.rayonnage(-8.1, -3.65, 5.2, 0); M.rayonnage(-10.65, -0.6, 4.2, Math.PI / 2); I.meuble(-7.3, 0.4, 2.0, 1.0, 0.78, M.BOIS, M.SOMBRE); M.fauteuil(-7.3, 1.7, Math.PI);
  { const [bx, bz] = monde(-7.3, 1.1); addInteract({ pos: new THREE.Vector3(bx, y0, bz), r: 2.4, prompt: () => 'les livres du Batut', fn: () => showMessage('Des registres de ferme, des almanachs, une vieille Bible. Sur la table, le registre des bêtes est ouvert.', 6) }); }
  M.table(7.6, -0.6, 2.4, 1.0, Math.PI / 2, 6); M.buffet(7.7, -3.6, 2.4, 0); M.horloge(5.1, 2.9, Math.PI / 2);
  cheminee2(I, g, 12.5, -3.55, 0, { w: 1.8 }); I.meuble(12.5, 0.9, 1.0, 1.8, 0.82, M.BOIS, M.CLAIR); M.buffet(13.6, 2.4, 1.6, -Math.PI / 2, 2.0); M.tonneau(11.6, 2.9);

  // ---- le lierre, du pied jusqu'au premier étage, autour des baies ----
  lierre(g, [[-11.5, -4.5, 3.5], [-4.5, 4.5, 5], [4.5, 14.5, 4]],
    [[-2.1, 1.75, 1.0, 1.6], [2.1, 1.75, 1.0, 1.6], [-2.1, 4.85, 1.0, 1.6], [2.1, 4.85, 1.0, 1.6], [-9.6, 1.75, 0.9, 1.4], [-6.6, 1.15, 1.0, 2.2], [-9.6, 4.6, 0.85, 1.2], [-6.6, 4.6, 0.85, 1.2],
      [9.5, 1.6, 2.1, 3.1], [6.6, 1.9, 1.0, 2.2], [12.4, 1.9, 1.0, 2.2], [9.5, 4.7, 0.95, 1.4], [6.6, 4.9, 0.7, 0.7], [12.4, 4.9, 0.7, 0.7]],
    // (pas au-dessus de 5,2 m : le corps bas n'a que 5,6 m de murs)
    (x) => Math.min(5.2, 3.6 + 2.4 * (0.5 + 0.5 * Math.sin(x * 0.7 + 1.3)) * (0.6 + 0.4 * Math.sin(x * 0.23))));

  // ---- le très grand hêtre, à gauche, ses branches au-dessus du toit ----
  const hetre = especeGeo('hetre');
  if (hetre) { const [hx, hz] = [-16, 1.5], h = 22, a = new THREE.Group(); pose(g, a, hx, hauteur(...monde(hx, hz)) - y0 - 0.2, hz); a.scale.set(h * 1.25, h, h * 1.25);
    a.add(new THREE.Mesh(hetre.tronc, hetre.matT), new THREE.Mesh(hetre.houppier, hetre.matH)); a.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const [wx, wz] = monde(hx, hz); inscrire(Array.from({ length: 8 }, (_, k) => [wx + Math.cos(k / 8 * 6.283) * 0.9, wz + Math.sin(k / 8 * 6.283) * 0.9]), wx, wz); }

  // ---- devant : un muret bas dans une haie, une petite ouverture face à la porte cintrée ----
  const zm = 14, ouv = 9.5, lo = 0.8;
  const muret = (a, b) => { const n = Math.max(1, Math.round((b - a) / 2)), l = (b - a) / n;
    for (let k = 0; k < n; k++) { const x = a + (k + 0.5) * l, y = hauteur(...monde(x, zm)) - y0; pose(g, boite(l + 0.04, 0.85 + 0.6, 0.5, 'rustic_stone_wall_02', { color: 0x9e968a }), x, y + 0.425 - 0.3, zm); }
    inscrire([[a, zm - 0.3], [b, zm - 0.3], [b, zm + 0.3], [a, zm + 0.3]].map(([p, q]) => monde(p, q)), ...monde((a + b) / 2, zm)); };
  muret(-13, ouv - lo); muret(ouv + lo, 16);
  LIEU.haieBatut = []; for (let x = -12.5; x < 15.6; x += 1.6) if (Math.abs(x - ouv) > lo + 0.8) LIEU.haieBatut.push(monde(x, zm - 1.1));
  // l'allée de terre de l'ouverture à la porte
  { const p = [], u = []; for (let k = 0; k <= 10; k++) { const zz = 4.2 + (zm + 0.5 - 4.2) * k / 10; for (const sx of [-0.8, 0.8]) { const [wx, wz] = monde(ouv + sx, zz); p.push(ouv + sx, hauteur(wx, wz) - y0 + 0.03, zz); u.push(sx, zz / 2); } }
    const idx = []; for (let k = 0; k < 10; k++) { const b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    const ga = new THREE.BufferGeometry(); ga.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); ga.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); ga.setIndex(idx); ga.computeVertexNormals();
    const m = new THREE.Mesh(ga.toNonIndexed(), phMat('gravier', 1, 1, { color: 0xc8bea8, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide })); m.receiveShadow = true; g.add(m); }
  g.traverse((o) => { if (o.isMesh && o.material !== undefined && !o.material.alphaTest) { o.castShadow = true; o.receiveShadow = true; } });
  const [fx, fz] = monde(9.5, 6);
  addInteract({ pos: new THREE.Vector3(fx, y0, fz), r: 3.5, prompt: () => 'le Batut', fn: () => showMessage('Le Batut. Le lierre monte jusqu’aux fenêtres du premier ; derrière les persiennes, on parle d’eau.', 6) });
  return { porte: monde(ouv, zm + 2), devant: (d) => monde(ouv, zm + d) };
}

// ---------------------------------------------------------------------
//  L'atelier des maisons de granit et de lauze (le Pouget, Beauregard)
// ---------------------------------------------------------------------
// Les pièces se rangent par matière dans un « chantier », fondues à la fin en une maille chacune,
// dans le repère de la maison (façade vers +z, comme grandeMaison et batut).
function chantier() { return { granit: [], lauze: [], vitre: [], blanc: [], volet: [], fer: [], porte: [], jour: [] }; }
function poserPiece(arr, geo, x, y, z, ry = 0) { geo.rotateY(ry); geo.translate(x, y, z); const gn = geo.index ? geo.toNonIndexed() : geo; gn.computeVertexNormals(); arr.push(gn); return gn; }
function finirChantier(g, C, { volet = 0x6f8f9a, porte = 0x4f7690, granit = 0xb8b6ae } = {}) {
  const MAT = {
    granit: () => phMat('granit_lozere', 1, 1, { color: granit }), lauze: () => phMat('lauze_lozere', 1, 1, { color: 0x8a8984, side: THREE.DoubleSide }),
    vitre: () => new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.18, metalness: 0.35 }),
    blanc: () => phMat('wood_cabinet_worn_long', 1, 1, { color: 0xf0ece4 }), volet: () => phMat('wood_planks', 1, 1, { color: volet }),
    fer: () => phMat('metal_plate_02', 1, 1, { color: 0x24221f, metalness: 0.6, roughness: 0.5 }), porte: () => phMat('wood_planks', 1, 1, { color: porte }),
    jour: () => new THREE.MeshBasicMaterial({ color: 0xd6e6f2 }),
  };
  for (const [k, arr] of Object.entries(C)) { if (!arr.length) continue;
    const m = new THREE.Mesh(mergeGeometries(arr.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(a)) q.deleteAttribute(a);
      if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); uvMetres(q); return q; })), MAT[k]());
    m.castShadow = m.receiveShadow = true; g.add(m); }
}
// un toit de lauzes à QUATRE PANS sur un rectangle, très pentu, avec la cassure du bas (le coyau,
// qui rejette l'eau loin du mur) : un premier anneau doux, puis la pente raide jusqu'au faîtage
function toitCroupes(C, cx, cz, L, W, H, { O = 0.5, coyau = 1.2, pente = 1.35 } = {}) {
  const a0 = L / 2 + O, b0 = W / 2 + O, y0 = H - 0.2, a1 = L / 2 - coyau + O * 0.2, b1 = W / 2 - coyau + O * 0.2, y1 = H + coyau * 0.62, y2 = y1 + b1 * pente, ra = Math.max(0.2, a1 - b1);
  const R0 = [[-a0, -b0], [a0, -b0], [a0, b0], [-a0, b0]].map(([a, b]) => [cx + a, y0, cz + b]), R1 = [[-a1, -b1], [a1, -b1], [a1, b1], [-a1, b1]].map(([a, b]) => [cx + a, y1, cz + b]);
  const F = [cx - ra, y2, cz], G = [cx + ra, y2, cz], pos = [];
  const quad = (p, q, r, t) => pos.push(...p, ...q, ...r, ...p, ...r, ...t);
  for (let k = 0; k < 4; k++) quad(R0[k], R0[(k + 1) % 4], R1[(k + 1) % 4], R1[k]);
  quad(R1[0], R1[1], G, F); quad(R1[2], R1[3], F, G); pos.push(...R1[1], ...R1[2], ...G, ...R1[3], ...R1[0], ...F);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); C.lauze.push(geo); geo.computeVertexNormals();
  return y2;
}
// un toit de lauzes à DEUX PANS, faîtage le long de x ; ses pignons de granit
function toit2Pans(C, cx, cz, L, W, H, { O = 0.4, pente = 1.2 } = {}) {
  const la = L / 2 + O, lb = W / 2 + O, hl = lb * pente, pos = [];
  for (const sg of [1, -1]) { const q = [[cx - la, H - O * pente, cz + sg * lb], [cx + la, H - O * pente, cz + sg * lb], [cx + la, H + hl - O * pente, cz], [cx - la, H + hl - O * pente, cz]]; for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...q[i]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); C.lauze.push(geo);
  const t = []; for (const sx of [-1, 1]) t.push(cx + sx * L / 2, H, cz - W / 2, cx + sx * L / 2, H, cz + W / 2, cx + sx * L / 2, H + W / 2 * pente, cz);
  const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute(t, 3)); gp.computeVertexNormals(); C.granit.push(gp);
  return H + W / 2 * pente;
}
// une fenêtre blanche à petits carreaux (six ou huit), son encadrement de granit, ses volets pleins ouverts
function fenetre(C, x, y, zf, w, h, { volets = true, ry = 0, rx = 0, rz = 0 } = {}) {
  const P = (arr, geo, lx, ly, lz) => { const v = new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); poserPiece(arr, geo, x + v.x, y + v.y, zf + v.z, ry); };
  P(C.vitre, boxG(w, h, 0.05), 0, 0, 0.0);
  for (const sx of [-1, 1]) P(C.blanc, boxG(0.07, h, 0.08), sx * (w / 2 - 0.035), 0, 0.03);
  for (const sy of [-1, 1]) P(C.blanc, boxG(w, 0.07, 0.08), 0, sy * (h / 2 - 0.035), 0.03);
  // les petits bois : un montant, et deux traverses (six carreaux) ou une seule (quatre)
  P(C.blanc, boxG(0.04, h, 0.06), 0, 0, 0.04); for (const t of h > 1.3 ? [-h / 6, h / 6] : [0]) P(C.blanc, boxG(w, 0.04, 0.06), 0, t, 0.04);
  P(C.granit, boxG(w + 0.4, 0.24, 0.16), 0, h / 2 + 0.12, 0.05); P(C.granit, boxG(w + 0.5, 0.12, 0.24), 0, -h / 2 - 0.06, 0.09);
  for (const sx of [-1, 1]) P(C.granit, boxG(0.2, h, 0.16), sx * (w / 2 + 0.1), 0, 0.05);
  if (volets) for (const sx of [-1, 1]) P(C.volet, boxG(w / 2, h, 0.05), sx * (w / 2 + 0.22 + w / 4), 0, 0.08);
  P(C.jour, boxG(w, h, 0.02), 0, 0, -0.62);                  // dedans, le jour qui entre (cf. batut.js)
}
// une souche de cheminée de granit, couronnée d'une dalle
function cheminee(C, x, z, y0, y1, w = 1.3, d = 0.8) { poserPiece(C.granit, boxG(w, y1 - y0, d), x, (y0 + y1) / 2, z); poserPiece(C.granit, boxG(w + 0.25, 0.14, d + 0.25), x, y1 + 0.07, z); }
// une lucarne sur un pan de toit : sa face de granit, son capuchon de lauzes à deux pans, sa fenêtre blanche
function lucarne(C, x, y, z, { w = 1.4, h = 1.5 } = {}) {
  poserPiece(C.granit, boxG(w, h, 1.8), x, y + h / 2, z - 0.7);
  const pos = [], hl = 0.7, la = 1.2, lb = w / 2 + 0.2;
  for (const sg of [1, -1]) { const q = [[x + sg * lb, y + h, z + 0.25], [x + sg * lb, y + h, z - la - 0.6], [x, y + h + hl, z - la - 0.6], [x, y + h + hl, z + 0.25]]; for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...q[i]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); C.lauze.push(geo);
  const t = new THREE.BufferGeometry(); t.setAttribute('position', new THREE.Float32BufferAttribute([x - w / 2, y + h, z + 0.21, x + w / 2, y + h, z + 0.21, x, y + h + hl - 0.05, z + 0.21], 3)); t.computeVertexNormals(); C.granit.push(t);
  fenetre(C, x, y + h / 2 + 0.05, z + 0.21, w * 0.55, h * 0.62, { volets: false });
}
// le pied d'une maison : le point le plus bas de ses coins (les murs descendent dessous, dans la pente)
function piedMaison(hauteur, monde, rects) { let y = 1e9; for (const [x0, x1, z0, z1] of rects) for (const [a, b] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) y = Math.min(y, hauteur(...monde(a, b))); return y; }
function inscrireRect({ inscrire }, monde, [x0, x1, z0, z1], sol, toitO = null) {
  const emp = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([a, b]) => monde(a, b)); inscrire(emp, ...monde((x0 + x1) / 2, (z0 + z1) / 2));
  if (sol != null) { LIEU.murs.push({ pts: emp, sol }); if (toitO != null) LIEU.toits.push({ bat: LIEU.murs.length - 1, pts: [[x0 - toitO, z0 - toitO], [x1 + toitO, z0 - toitO], [x1 + toitO, z1 + toitO], [x0 - toitO, z1 + toitO]].map(([a, b]) => monde(a, b)) }); }
}
// des pelouses ou des allées posées sur le relief : un rectangle local, maillé au mètre
function nappe(g, hauteur, monde, y0, [x0, x1, z0, z1], mat, dy = 0.04) {
  const nx = Math.max(1, Math.ceil(x1 - x0)), nz = Math.max(1, Math.ceil(z1 - z0)), pos = [], uv = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const lx = x0 + (x1 - x0) * i / nx, lz = z0 + (z1 - z0) * j / nz; pos.push(lx, hauteur(...monde(lx, lz)) - y0 + dy, lz); uv.push(lx / 2, lz / 2); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m;
}

// ---------------------------------------------------------------------
//  La grande maison du Pouget, d'après les deux photos (docs/SCENARIO.md)
// ---------------------------------------------------------------------
// Eugène, 5 octobre : « rebâtis le Pouget d'après les photos ». Un manoir de granit gris en
// moellons, trois niveaux (rez-de-chaussée, étage, combles), façade symétrique d'une vingtaine de
// mètres ; un toit de lauzes à quatre pans, très pentu, à la légère cassure du bas, deux grandes
// cheminées aux bouts ; au centre, une TOUR CARRÉE qui dépasse du toit, sous un dôme de lauzes en
// cloche et un petit clocheton pointu, avec au niveau des combles une porte-fenêtre bleue sur un
// balcon de fer forgé et un oculus au-dessus ; une lucarne de chaque côté de la tour ; des volets
// bleu-gris, des fenêtres blanches à petits carreaux ; la porte bleue au centre, trois marches,
// des hortensias et des pots au pied de la façade ; le lierre sur la droite et le mur qui la
// prolonge, une aile basse à gauche derrière un arbre ; et l'entrée du domaine : un mur, deux
// grands piliers à boules, une grille de fer, l'allée de gravier droite entre deux pelouses jaunes.
// (La lauze, et non la tuile canal des toits du 2 octobre : c'est ce que montrent les photos.)
const POUGET = { L: 20, W: 10, H: 7, tour: 4.4, allee: 30 };
function pouget(ctx, X, Z, rot) {
  const { hauteur, scene, addInteract } = ctx, { L, W, H, tour: T, allee: A } = POUGET;
  const c = Math.cos(rot), s = Math.sin(rot), monde = (lx, lz) => [X + lx * c + lz * s, Z - lx * s + lz * c];
  const corps = [-L / 2, L / 2, -W / 2, W / 2], tourR = [-T / 2, T / 2, W / 2 - 3.4, W / 2 + 1], aile = [-18, -L / 2, -4.5, 2.5];
  const y0 = piedMaison(hauteur, monde, [corps, aile]);
  const g = new THREE.Group(); g.position.set(X, y0, Z); g.rotation.y = rot; scene.add(g);
  const C = chantier(), GR = { color: 0xb8b6ae };
  // ---- le corps, le toit à quatre pans, les cheminées ----
  const faite = toitCroupes(C, 0, 0, L, W, H);
  for (const sx of [-1, 1]) cheminee(C, sx * (L / 2 - 1.6), 0, H, faite + 1.4, 1.5, 0.9);
  emprise(monde, corps, y0, 0.5);
  // ---- la tour carrée, son dôme en cloche, son clocheton ----
  const Ht = faite + 1.6, tcz = (tourR[2] + tourR[3]) / 2;
  poserPiece(C.granit, boxG(T + 0.3, 0.3, tourR[3] - tourR[2] + 0.3), 0, Ht + 0.15, tcz);                  // la corniche
  { const prof = [[0.01, 3.2], [0.3, 3.05], [0.75, 2.85], [1.35, 2.45], [1.85, 1.85], [2.15, 1.25], [2.4, 0.7], [2.85, 0.25], [3.4, 0]].map(([r, y]) => new THREE.Vector2(r, y)).reverse();
    const dome = new THREE.LatheGeometry(prof, 4); dome.rotateY(Math.PI / 4); dome.scale(1, 1, (tourR[3] - tourR[2]) / T); poserPiece(C.lauze, dome, 0, Ht + 0.3, tcz);
    poserPiece(C.lauze, boxG(0.9, 1.1, 0.9), 0, Ht + 0.3 + 3.2 + 0.4, tcz);                                       // le clocheton
    const fl = new THREE.ConeGeometry(0.75, 2.2, 4); fl.rotateY(Math.PI / 4); poserPiece(C.lauze, fl, 0, Ht + 0.3 + 3.2 + 0.95 + 1.1, tcz);
    poserPiece(C.fer, boxG(0.06, 1.2, 0.06), 0, Ht + 0.3 + 3.2 + 2.05 + 0.6 + 0.4, tcz); }
  emprise(monde, tourR, y0, 0.3);
  // la porte-fenêtre bleue sur son balcon de fer forgé, l'oculus au-dessus
  const zt = tourR[3] + 0.03;
  { const yb = H + 0.35; poserPiece(C.porte, boxG(1.1, 2.2, 0.06), 0, yb + 1.1, zt); for (const sx of [-1, 1]) poserPiece(C.granit, boxG(0.2, 2.3, 0.16), sx * 0.65, yb + 1.15, zt + 0.03); poserPiece(C.granit, boxG(1.6, 0.26, 0.18), 0, yb + 2.4, zt + 0.03);
    poserPiece(C.granit, boxG(2.2, 0.16, 0.95), 0, yb - 0.08, zt + 0.47);
    for (let k = 0; k <= 16; k++) poserPiece(C.fer, boxG(0.03, 0.95, 0.03), -1.05 + k * 0.131, yb + 0.48, zt + 0.92);
    for (const sx of [-1, 1]) for (let k = 1; k <= 6; k++) poserPiece(C.fer, boxG(0.03, 0.95, 0.03), sx * 1.05, yb + 0.48, zt + k * 0.131 + 0.05);
    for (const yy of [0.05, 0.95]) { poserPiece(C.fer, boxG(2.15, 0.04, 0.04), 0, yb + yy, zt + 0.92); for (const sx of [-1, 1]) poserPiece(C.fer, boxG(0.04, 0.04, 0.9), sx * 1.05, yb + yy, zt + 0.47); }
    for (let k = 0; k < 7; k++) { const t = new THREE.TorusGeometry(0.11, 0.015, 4, 10); poserPiece(C.fer, t, -0.9 + k * 0.3, yb + 0.78, zt + 0.92); }      // les volutes
    poserPiece(C.vitre, new THREE.CircleGeometry(0.38, 16), 0, Ht - 1.3, zt + 0.01); const ro = new THREE.TorusGeometry(0.45, 0.09, 6, 18); poserPiece(C.granit, ro, 0, Ht - 1.3, zt + 0.04); }
  // la porte bleue, grande ouverte (1,9 m : on y passe), ses vantaux rabattus dedans ; son encadrement
  // de granit et le seuil. Les trois marches de la photo ne tiennent plus : le sol de la maison est le
  // relief (le terre-plein), et un perron ferait marcher Camille dans le plancher. Un seuil les remplace.
  for (const sx of [-1, 1]) poserPiece(C.porte, boxG(0.08, 2.6, 0.95), sx * 0.91, 1.3, zt - 0.6 - 0.48);
  for (const sx of [-1, 1]) poserPiece(C.granit, boxG(0.3, 2.7, 0.2), sx * 1.1, 1.35, zt + 0.05);
  poserPiece(C.granit, boxG(2.6, 0.36, 0.22), 0, 2.85, zt + 0.05);
  const pied = (lx, lz) => hauteur(...monde(lx, lz)) - y0;
  poserPiece(C.granit, boxG(2.4, 0.66, 0.6), 0, 0.06 - 0.3, zt + 0.25);
  // ---- les fenêtres : trois de chaque côté de la tour, au rez-de-chaussée et à l'étage ----
  const XF = [3.8, 6.2, 8.6];
  for (const sx of [-1, 1]) for (const x of XF) { fenetre(C, sx * x, 1.95, W / 2 + 0.03, 1.0, 1.7); fenetre(C, sx * x, 5.05, W / 2 + 0.03, 1.0, 1.6); }
  for (const x of [-7, -2.5, 2.5, 7]) { fenetre(C, x, 1.95, -W / 2 - 0.03, 0.9, 1.5, { ry: Math.PI }); fenetre(C, x, 5.05, -W / 2 - 0.03, 0.9, 1.4, { ry: Math.PI }); }
  // les deux lucarnes, de part et d'autre de la tour, sur le pan avant
  for (const sx of [-1, 1]) lucarne(C, sx * 5.4, H + 0.15, W / 2 - 0.25);
  // ---- l'aile basse, à gauche ----
  const [ax0, ax1, az0, az1] = aile, aw = ax1 - ax0, ad = az1 - az0, acx = (ax0 + ax1) / 2, acz = (az0 + az1) / 2;
  toit2Pans(C, acx, acz, aw, ad, 4.2, { pente: 1.1 });
  fenetre(C, acx - 1.5, 1.8, az1 + 0.03, 0.9, 1.3); poserPiece(C.porte, boxG(1.1, 2.2, 0.08), acx + 1.8, 1.1, az1 + 0.03);
  emprise(monde, aile, y0, 0.4);
  // ---- les murs, creux : on entre (5 octobre) ----
  // la tour est le vestibule ; derrière elle, le hall dallé ; à gauche le salon, à droite la salle à
  // manger (les flancs de la tour les séparent devant, deux cloisons derrière) ; l'aile basse, la cuisine
  const I = interieur(g, monde, y0), M = mobilier(I, g), Pg = { slug: 'granit_lozere', opt: GR, dedans: { slug: 'enduit_gris', opt: { color: 0xe6dfd0 } } }, Cl = { ep: 0.2, h: 3.2, slug: 'enduit_gris', opt: { color: 0xe6dfd0 } };
  I.mur(-L / 2, W / 2 - 0.3, -T / 2, W / 2 - 0.3, { ...Pg, h: H, cote: -1, plafond: 3.2 }); I.mur(T / 2, W / 2 - 0.3, L / 2, W / 2 - 0.3, { ...Pg, h: H, cote: -1, plafond: 3.2 });
  I.mur(-L / 2, -W / 2 + 0.3, L / 2, -W / 2 + 0.3, { ...Pg, h: H, cote: 1, plafond: 3.2 });
  I.mur(-L / 2 + 0.3, -W / 2, -L / 2 + 0.3, W / 2, { ...Pg, h: H, cote: -1, plafond: 3.2, portes: [{ t: 4, w: 1.9, h: 2.5 }] }); I.mur(L / 2 - 0.3, -W / 2, L / 2 - 0.3, W / 2, { ...Pg, h: H, cote: 1, plafond: 3.2 });
  I.mur(-T / 2 + 0.3, tourR[2], -T / 2 + 0.3, tourR[3], { ...Pg, h: Ht, cote: -1, plafond: 3.2 }); I.mur(T / 2 - 0.3, tourR[2], T / 2 - 0.3, tourR[3], { ...Pg, h: Ht, cote: 1, plafond: 3.2 });
  I.mur(-T / 2, tourR[3] - 0.3, T / 2, tourR[3] - 0.3, { ...Pg, h: Ht, cote: -1, plafond: 3.2, portes: [{ t: T / 2, w: 1.9, h: 2.65 }] });
  I.mur(-T / 2, tourR[2] + 0.1, T / 2, tourR[2] + 0.1, { ...Cl, portes: [{ t: T / 2, w: 2.2, h: 2.6 }] });
  for (const sx of [-1, 1]) I.mur(sx * T / 2, -W / 2 + 0.6, sx * T / 2, tourR[2], { ...Cl, portes: [{ t: 2.4, w: 1.7, h: 2.4 }] });
  I.mur(-18, 2.2, -L / 2, 2.2, { ...Pg, h: 4.2, cote: -1, plafond: 3.0 }); I.mur(-18, -4.2, -L / 2, -4.2, { ...Pg, h: 4.2, cote: 1, plafond: 3.0 }); I.mur(-17.7, -4.5, -17.7, 2.5, { ...Pg, h: 4.2, cote: -1, plafond: 3.0 });
  I.sol(-T / 2 + 0.6, T / 2 - 0.6, tourR[2] + 0.2, tourR[3] - 0.6, 'worn_tile_floor', 0xd0c8bc, { nom: 'le vestibule', poutres: false, plafond: 3.2 });
  I.sol(-T / 2 + 0.1, T / 2 - 0.1, -W / 2 + 0.6, tourR[2], 'worn_tile_floor', 0xd8d0c4, { nom: 'le hall', plafond: 3.2 });
  I.sol(-L / 2 + 0.6, -T / 2 - 0.1, -W / 2 + 0.6, W / 2 - 0.6, 'wood_planks', 0xa8845c, { nom: 'le salon', plafond: 3.2 });
  I.sol(T / 2 + 0.1, L / 2 - 0.6, -W / 2 + 0.6, W / 2 - 0.6, 'wood_planks', 0x9a7650, { nom: 'la salle à manger', plafond: 3.2 });
  I.sol(-17.4, -L / 2, -3.9, 1.9, 'worn_tile_floor', 0xb89a80, { nom: 'la cuisine', plafond: 3.0, poutres: true });
  for (const [x0, x1, z0, z1] of [[-0.95, 0.95, tourR[3] - 0.6, tourR[3] + 0.4], [-L / 2, -L / 2 + 0.6, -1.95, -0.05]]) pose(g, boite(x1 - x0, 0.05, z1 - z0, 'worn_tile_floor', { color: 0xd0c8bc }), (x0 + x1) / 2, 0.03, (z0 + z1) / 2).castShadow = false;
  // le salon : la cheminée sur le mur du fond, le canapé, les fauteuils, le piano devant les fenêtres
  cheminee2(I, g, -6.2, -W / 2 + 0.95, 0, { w: 2.4 }); M.tapis(-6.2, -1.6, 3.6, 2.6, 0, 0x4a5a7a); M.canape(-6.2, 0.4, Math.PI, 0x5a6a8a);
  M.fauteuil(-8.4, -2.4, Math.PI / 2); M.fauteuil(-4.0, -2.4, -Math.PI / 2); M.piano(-8.6, W / 2 - 1.0, Math.PI); I.meuble(-6.2, -1.7, 1.2, 0.6, 0.45, M.BOIS, M.SOMBRE);
  // la salle à manger : la longue table de famille (celle des réconciliations de STORY.md), le buffet, l'horloge
  M.table(6.2, 0, 3.4, 1.1, 0, 8); M.buffet(6.2, -W / 2 + 0.9, 2.6, 0); M.horloge(9.0, W / 2 - 0.9, Math.PI);
  { const [tx, tz2] = monde(6.2, 1.8); addInteract({ pos: new THREE.Vector3(tx, y0, tz2), r: 2.4, prompt: () => 'la table de famille', fn: () => showMessage('La grande table de l’aïeule. Les Batut d’un côté, Beauregard de l’autre, autrefois. Elle met encore tous les couverts.', 6) }); }
  // le hall : une console, un coffre ; le vestibule, un banc
  I.meuble(0, -W / 2 + 0.9, 1.6, 0.45, 0.85, M.BOIS, M.SOMBRE); I.meuble(-1.4, -1.2, 0.5, 1.2, 0.6, M.BOIS, M.CLAIR, Math.PI / 2);
  // la cuisine : la grande cheminée sur le pignon, la table, le vaisselier, des tonneaux
  cheminee2(I, g, -17.05, -1.0, Math.PI / 2, { w: 2.2 }); I.meuble(-13.8, -1.0, 2.2, 1.0, 0.82, M.BOIS, M.CLAIR); M.buffet(-13.8, -3.6, 2.0, 0, 2.0); M.tonneau(-11.0, 1.2); M.tonneau(-11.0, -3.4);

  // ---- le mur qui prolonge la façade à droite, et le lierre sur la droite ----
  pose(g, boite(8, 2.8 + 2, 0.6, 'granit_lozere', GR), L / 2 + 4, (2.8 - 2) / 2, W / 2 - 0.3);
  inscrireRect(ctx, monde, [L / 2, L / 2 + 8, W / 2 - 0.6, W / 2], null);
  lierre(g, [[2.6, L / 2, W / 2], [L / 2, L / 2 + 8, W / 2]], XF.flatMap((x) => [[x, 1.95, 1.0, 1.7], [x, 5.05, 1.0, 1.6]]).concat([[0, 1.3, 2.4, 2.8]]), (x) => x < L / 2 ? 4.2 + 2.3 * (0.5 + 0.5 * Math.sin(x * 0.9)) : 2.6 + 0.3 * Math.sin(x * 2));
  // ---- l'entrée du domaine : le mur, les piliers à boules, la grille ouverte, l'allée, les pelouses ----
  const zm = A, demi = 14, ouv = 1.7;
  for (const [a, b] of [[-demi, -ouv - 0.45], [ouv + 0.45, demi]]) { const n = Math.round((b - a) / 2), l = (b - a) / n;
    for (let k = 0; k < n; k++) { const x = a + (k + 0.5) * l; pose(g, boite(l + 0.04, 2.0 + 0.8, 0.55, 'granit_lozere', GR), x, pied(x, zm) + 0.6, zm); }
    inscrireRect(ctx, monde, [a, b, zm - 0.3, zm + 0.3], null); }
  for (const sx of [-1, 1]) { const x = sx * (ouv + 0.45), y = pied(x, zm);
    pose(g, boite(0.9, 3.0 + 0.5, 0.9, 'granit_lozere', { color: 0xc4c2ba }), x, y + 1.25, zm);
    poserPiece(C.granit, boxG(1.1, 0.2, 1.1), x, y + 3.1, zm); poserPiece(C.granit, boxG(0.5, 0.35, 0.5), x, y + 3.38, zm); poserPiece(C.granit, new THREE.SphereGeometry(0.34, 14, 10), x, y + 3.85, zm);
    inscrireRect(ctx, monde, [x - 0.45, x + 0.45, zm - 0.45, zm + 0.45], null);
    // le battant de la grille, ouvert vers l'intérieur, contre le mur
    const gb = new THREE.Group(); pose(g, gb, sx * ouv, y, zm - 0.1, sx * 1.35);
    for (let k = 0; k <= 11; k++) gb.add(mesh(boxG(0.03, 2.1, 0.03), phMat('metal_plate_02', 0.1, 2, { color: 0x24221f }), -sx * (0.07 + k * 0.14), 1.05 + 0.15 * Math.sin(k / 11 * Math.PI), 0));
    for (const yy of [0.15, 1.6]) gb.add(mesh(boxG(1.65, 0.05, 0.04), phMat('metal_plate_02', 1.6, 0.1, { color: 0x24221f }), -sx * 0.83, yy, 0)); }
  const herbe = phMat('grass_ground', 1, 1, { color: 0xc8b46a, polygonOffset: true, polygonOffsetFactor: -1 });
  nappe(g, hauteur, monde, y0, [-1.4, 1.4, zt + 1.4, zm], phMat('gravier', 1, 1, { color: 0xd0c6b0, polygonOffset: true, polygonOffsetFactor: -2 }), 0.05);
  for (const sx of [-1, 1]) nappe(g, hauteur, monde, y0, sx < 0 ? [-demi + 0.5, -1.4, W / 2 + 2, zm - 0.5] : [1.4, demi - 0.5, W / 2 + 2, zm - 0.5], herbe, 0.03);
  // les hortensias au pied de la façade, les pots de part et d'autre des marches
  const esp = especeGeo('charme');
  if (esp) { const fleurs = esp.matH.clone(); fleurs.color = new THREE.Color(0x8a9ad8); const feuil = esp.matH.clone(); feuil.color = new THREE.Color(0x4a6a3a);
    for (const x of [-9.8, -7.4, -5, -2.6, 2.6, 5, 7.4]) { const b = new THREE.Group(); pose(b, new THREE.Mesh(esp.houppier, feuil), 0, 0, 0); pose(g, b, x, pied(x, W / 2 + 0.9), W / 2 + 0.9); b.scale.set(2.4, 1.4, 1.8);
      const t = new THREE.Mesh(esp.houppier, fleurs); t.scale.set(0.8, 0.75, 0.8); t.position.y = 0.25; b.add(t); }
    LIEU.fourres = (LIEU.fourres || []).concat([-1, 1].flatMap((sx) => [9, 11.5, 14, 16.5, 19, 21.5, 24, 26.5].map((zz) => monde(sx * 2.4, zz)))); }        // la haie basse le long de l'allée
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.6, 14), phMat('brique_rouge_06', 2, 0.6, { color: 0xc87a58 })); pose(g, p, sx * 1.6, pied(sx * 1.6, zt + 1.4) + 0.3, zt + 1.4); }
  finirChantier(g, C, { volet: 0x6f8f9a, porte: 0x4f7690 });
  g.traverse((o) => { if (o.isMesh && !(o.material && o.material.alphaTest)) { o.castShadow = true; o.receiveShadow = true; } });
  // l'arbre derrière l'aile basse : arbres() le plante avec les ombrages
  LIEU.ombrages = (LIEU.ombrages || []).concat([monde(-15, 8)]);
  const [fx, fz] = monde(0, zt + 2.5);
  addInteract({ pos: new THREE.Vector3(fx, y0, fz), r: 3.5, prompt: () => 'la grande maison du Pouget', fn: () => showMessage('Le Pouget, la grande maison. La plus vieille des trois : la pelouse a jauni, mais les hortensias tiennent encore.', 6) });
}

// ---------------------------------------------------------------------
//  Beauregard : un manoir du Carladez (choix du 5 octobre)
// ---------------------------------------------------------------------
// Eugène n'a pas de modèle pour Beauregard (« trouve une inspiration aveyronnaise du coin »). Le
// lac de Saint-Gervais est aux confins du Carladez et de la Viadène ; leurs manoirs (Messilhac,
// les maisons fortes de la vallée de la Truyère) ont tous le même air, celui qu'on prend ici :
// - un CORPS DE LOGIS de granit simple et haut (17 × 9 m, deux niveaux et des combles), sous un
//   toit de lauzes très pentu entre deux pignons qui portent les cheminées ;
// - une TOUR D'ESCALIER RONDE hors-œuvre au milieu de la façade, coiffée en poivrière de lauzes,
//   la porte cintrée à son pied, ses jours étroits qui montent en tournant avec la vis ;
// - à l'étage, des CROISÉES À MENEAUX de granit (la marque d'une maison noble, la « branche la plus
//   ancienne » de SCENARIO.md) ; au rez-de-chaussée, des baies plus petites aux volets rouges (la
//   couleur de Beauregard depuis le 2 octobre) ;
// - la cour murée devant, en terrasse sur la pente : « de là, on voit tout le lac » ; son puits à sec ;
// - et le PIGEONNIER carré, à l'angle de la cour, avec sa randière de pierre (le bandeau qui
//   empêche les rats de monter) et son toit de lauzes en pavillon : le droit de colombier était un
//   privilège de seigneur, et l'Aveyron en a gardé des centaines.
function beauregard(ctx, X, Z, rot) {
  const { hauteur, scene, addInteract } = ctx, L = 17, W = 9, H = 7.2, CD = 14, R = 2.5;
  const c = Math.cos(rot), s = Math.sin(rot), monde = (lx, lz) => [X + lx * c + lz * s, Z - lx * s + lz * c];
  // le pigeonnier accolé au muret de la cour, à son angle : décollé de 1,3 m, il laissait une fente où
  // Camille restait coincée (banc, la barrière de l'est hors d'atteinte)
  const corps = [-L / 2, L / 2, -W / 2, W / 2], pig = [10.85, 14.45, 12, 15.6];
  const y0 = piedMaison(hauteur, monde, [corps]), pied = (lx, lz) => hauteur(...monde(lx, lz)) - y0;
  const g = new THREE.Group(); g.position.set(X, y0, Z); g.rotation.y = rot; scene.add(g);
  const C = chantier(), GR = { color: 0xb4ac9e };
  // ---- le corps de logis, ses pignons, ses cheminées ----
  const faite = toit2Pans(C, 0, 0, L, W, H, { pente: 1.25 });
  for (const sx of [-1, 1]) cheminee(C, sx * (L / 2 - 0.55), 0, H, faite + 1.3, 1.1, 1.2);
  emprise(monde, corps, y0, 0.4);
  // ---- la tour d'escalier, sa poivrière, son épi ----
  const tz = W / 2 + R * 0.55, Ht = H + 3.4;
  // la tour en 28 pans de pierre (cf. batut.js) : un cylindre d'un seul tenant fermait la porte à la
  // vue ; chaque pan arrête (une capsule), sauf à la porte et au passage vers le hall, jusqu'au linteau
  const I = interieur(g, monde, y0), M = mobilier(I, g);
  { const N = 28, ep = 0.5, rm = R - ep / 2, larg = 2 * rm * Math.sin(Math.PI / N) + 0.08, pres = (a, b) => Math.abs(((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    for (let k = 0; k < N; k++) { const a = (k + 0.5) / N * 2 * Math.PI, x = Math.sin(a) * rm, z = tz + Math.cos(a) * rm, ouvert = pres(a, 0) < 0.48 || pres(a, Math.PI) < 0.5;
      const pan = (ya, yb) => pose(g, boite(larg, yb - ya, ep, 'granit_lozere', GR), x, (ya + yb) / 2, z, a);
      if (ouvert) pan(2.65, Ht); else pan(-5, Ht);
      if (!ouvert) { const a0 = k / N * 2 * Math.PI, a1 = (k + 1) / N * 2 * Math.PI; I.cap(Math.sin(a0) * rm, tz + Math.cos(a0) * rm, Math.sin(a1) * rm, tz + Math.cos(a1) * rm, ep / 2 + 0.03, Ht); } } }
  emprise(monde, [-R, R, tz - R, tz + R], y0);
  const cone = new THREE.ConeGeometry(R + 0.45, 5.2, 28, 1, true); poserPiece(C.lauze, cone, 0, Ht + 2.6, tz);
  poserPiece(C.granit, new THREE.CylinderGeometry(R + 0.12, R + 0.12, 0.25, 28), 0, Ht, tz);
  poserPiece(C.fer, boxG(0.06, 1.4, 0.06), 0, Ht + 5.2 + 0.6, tz); poserPiece(C.fer, new THREE.SphereGeometry(0.1, 8, 6), 0, Ht + 5.4, tz);
  // la porte cintrée au pied de la tour ; les jours de l'escalier, qui tournent en montant
  // (1,9 m, grande ouverte : on y passe ; ses vantaux rabattus contre la pierre, dedans)
  { const zp = tz + R + 0.02; for (const sx of [-1, 1]) poserPiece(C.porte, boxG(0.08, 2.4, 0.9), sx * 0.9, 1.2, zp - 0.95);
    for (const sx of [-1, 1]) poserPiece(C.granit, boxG(0.3, 2.45, 0.3), sx * 1.1, 1.22, zp); poserPiece(C.granit, new THREE.TorusGeometry(1.1, 0.16, 6, 16, Math.PI), 0, 2.45, zp);
    poserPiece(C.granit, boxG(2.6, 0.3, 1.0), 0, -0.1, zp + 0.4); }
  for (const [a, y] of [[0.55, 3.6], [-0.55, 6.6], [0.15, 9.2]]) { const x = Math.sin(a) * (R + 0.02), z = tz + Math.cos(a) * (R + 0.02);
    poserPiece(C.vitre, boxG(0.32, 0.85, 0.08), x, y, z, a); poserPiece(C.granit, boxG(0.6, 1.15, 0.12), x - Math.sin(a) * 0.04, y, z - Math.cos(a) * 0.04, a); }
  // ---- les croisées à meneaux de l'étage, les baies du rez-de-chaussée ----
  const croisee = (x, y, zf, ry = 0) => { const w = 1.3, h = 1.9, P = (geo, lx, ly, lz) => { const v = new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); poserPiece(C.granit, geo, x + v.x, y + v.y, zf + v.z, ry); };
    poserPiece(C.vitre, boxG(w, h, 0.05), x, y, zf, ry);
    { const v = new THREE.Vector3(0, 0, -0.62).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); poserPiece(C.jour, boxG(w, h, 0.02), x + v.x, y, zf + v.z, ry); }
    P(boxG(0.14, h, 0.2), 0, 0, 0.05); P(boxG(w, 0.14, 0.2), 0, h * 0.12, 0.05);                                       // le meneau, la traverse
    for (const sx of [-1, 1]) P(boxG(0.22, h + 0.2, 0.18), sx * (w / 2 + 0.11), 0, 0.05);
    P(boxG(w + 0.6, 0.28, 0.22), 0, h / 2 + 0.14, 0.05); P(boxG(w + 0.5, 0.14, 0.3), 0, -h / 2 - 0.07, 0.1); };
  for (const sx of [-1, 1]) for (const x of [4.2, 6.9]) { croisee(sx * x, 4.9, W / 2 + 0.03); fenetre(C, sx * x, 1.8, W / 2 + 0.03, 0.95, 1.35); }
  for (const x of [-5.5, -1.5, 2.5, 6]) { croisee(x, 4.9, -W / 2 - 0.03, Math.PI); }
  for (const sx of [-1, 1]) lucarne(C, sx * 5.4, H + 0.25, W / 2 - 0.3);
  // ---- les murs du logis, creux : on entre (5 octobre) ----
  // la tour est le vestibule et la cage de la vis ; derrière, le hall ; à gauche le salon et sa
  // cheminée, à droite la salle à manger
  const Pg = { slug: 'granit_lozere', opt: GR, dedans: { slug: 'enduit_gris', opt: { color: 0xe4ddce } } }, Cl = { ep: 0.2, h: 3.2, slug: 'enduit_gris', opt: { color: 0xe4ddce } };
  I.mur(-L / 2, W / 2 - 0.3, -1.5, W / 2 - 0.3, { ...Pg, h: H, cote: -1, plafond: 3.2 }); I.mur(1.5, W / 2 - 0.3, L / 2, W / 2 - 0.3, { ...Pg, h: H, cote: -1, plafond: 3.2 });
  I.mur(-L / 2, -W / 2 + 0.3, L / 2, -W / 2 + 0.3, { ...Pg, h: H, cote: 1, plafond: 3.2 });
  I.mur(-L / 2 + 0.3, -W / 2, -L / 2 + 0.3, W / 2, { ...Pg, h: H, cote: -1, plafond: 3.2 }); I.mur(L / 2 - 0.3, -W / 2, L / 2 - 0.3, W / 2, { ...Pg, h: H, cote: 1, plafond: 3.2 });
  for (const sx of [-1, 1]) I.mur(sx * 2.5, -W / 2 + 0.6, sx * 2.5, W / 2 - 0.6, { ...Cl, portes: [{ t: 2.9, w: 1.7, h: 2.4 }] });
  I.sol(-2.4, 2.4, -W / 2 + 0.6, W / 2 - 0.6, 'worn_tile_floor', 0xd8d0c4, { nom: 'le hall', plafond: 3.2 });
  I.sol(-L / 2 + 0.6, -2.6, -W / 2 + 0.6, W / 2 - 0.6, 'wood_planks', 0xa8845c, { nom: 'le salon', plafond: 3.2 });
  I.sol(2.6, L / 2 - 0.6, -W / 2 + 0.6, W / 2 - 0.6, 'wood_planks', 0x9a7650, { nom: 'la salle à manger', plafond: 3.2 });
  pose(g, boite(3.0, 0.05, 0.9, 'worn_tile_floor', { color: 0xd8d0c4 }), 0, 0.03, W / 2 - 0.3).castShadow = false;
  // la tour : son dallage, le noyau de la vis, les marches qui montent par la gauche (on passe à droite)
  { pose(g, new THREE.Mesh(new THREE.CylinderGeometry(R - 0.45, R - 0.45, 0.05, 28), phMat('granite_tile_03', 4, 4, { color: 0xb0aa9e })), 0, 0.03, tz).castShadow = false;
    pose(g, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, Ht, 12), phMat('granite_tile_03', 1.9, Ht, { color: 0xa8a294 })), 0, Ht / 2, tz); I.cap(0, tz, 0, tz, 0.35, Ht);
    for (let k = 0; k < 14; k++) { const a = Math.PI + 0.65 + k * 0.155, y = 0.2 * (k + 1), rmm = (0.3 + R - 0.5) / 2;
      pose(g, boite(R - 0.8, 0.18, 0.62, 'granite_tile_03', { color: 0xa8a294 }), Math.sin(a) * rmm, y - 0.09, tz + Math.cos(a) * rmm, a + Math.PI / 2); }
    I.cap(Math.sin(Math.PI + 0.8) * 1.2, tz + Math.cos(Math.PI + 0.8) * 1.2, Math.sin(2 * Math.PI - 0.95) * 1.2, tz + Math.cos(2 * Math.PI - 0.95) * 1.2, 0.75, 1.9);
    DEDANS.push({ pts: [[-R, tz - R], [R, tz - R], [R, tz + R], [-R, tz + R]].map(([a, b]) => monde(a, b)), plafond: y0 + 6, nom: 'la tour' }); }
  cheminee2(I, g, -L / 2 + 0.95, 0, Math.PI / 2, { w: 2.4 }); M.tapis(-5.2, 0, 2.6, 3.4, 0, 0x7a3e32); M.canape(-4.0, 0, -Math.PI / 2, 0x6a3a2e);
  M.fauteuil(-6.0, 2.6, Math.PI); M.fauteuil(-6.0, -2.6, 0); M.rayonnage(-5.4, -W / 2 + 0.85, 3.6, 0);
  M.table(5.4, 0, 2.6, 1.0, Math.PI / 2, 6); M.buffet(5.4, -W / 2 + 0.9, 2.4, 0); M.horloge(7.6, W / 2 - 0.9, Math.PI);
  { const [fx2, fz2] = monde(-6.2, 0); addInteract({ pos: new THREE.Vector3(fx2, y0, fz2), r: 2.4, prompt: () => 'la cheminée de Beauregard', fn: () => showMessage('Le feu couve sous la cendre. Par la croisée, on voit le lac, et le Batut en face.', 6) }); }
  I.meuble(0, -W / 2 + 0.9, 1.6, 0.5, 0.9, M.BOIS, M.SOMBRE);

  // ---- la cour en terrasse : terre battue, le muret garde-corps sur le lac, les piliers, le puits ----
  const xg = L / 2 + 2, zf = W / 2 + CD, porte = 1.9;
  nappe(g, hauteur, monde, y0, [-xg, xg, W / 2, zf], phMat('terre_battue', 1, 1, { color: 0xb09878, polygonOffset: true, polygonOffsetFactor: -2 }), 0.04);
  const muret = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)), ang = Math.atan2(b[0] - a[0], b[1] - a[1]), l = Math.hypot(b[0] - a[0], b[1] - a[1]) / n;
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, lx = a[0] + (b[0] - a[0]) * t, lz = a[1] + (b[1] - a[1]) * t; pose(g, boite(0.6, 1.1 + 0.8, l + 0.05, 'granit_lozere', GR), lx, pied(lx, lz) + 0.15, lz, ang); }
    // la collision dépasse chaque bout de l'épaisseur du mur : sans cela, à l'angle extérieur de la
    // cour, les deux tronçons laissaient une encoche de 35 cm où Camille restait coincée (banc)
    const e = 0.35, ux = b[1] - a[1], uz = -(b[0] - a[0]), ul = Math.hypot(ux, uz) || 1, tx = -uz / ul * e, tz = ux / ul * e, A = [a[0] - tx, a[1] - tz], B = [b[0] + tx, b[1] + tz];
    ctx.inscrire([[A[0] + ux / ul * e, A[1] + uz / ul * e], [B[0] + ux / ul * e, B[1] + uz / ul * e], [B[0] - ux / ul * e, B[1] - uz / ul * e], [A[0] - ux / ul * e, A[1] - uz / ul * e]].map(([x, z]) => monde(x, z)), ...monde((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); };
  muret([-xg, W / 2], [-xg, zf]); muret([xg, W / 2], [xg, zf]); muret([-xg, zf], [-porte, zf]); muret([porte, zf], [xg, zf]);
  for (const sx of [-1, 1]) { pose(g, boite(0.85, 2.6, 0.85, 'granit_lozere', { color: 0xc4c2ba }), sx * (porte + 0.2), pied(sx * (porte + 0.2), zf) + 1.0, zf); poserPiece(C.granit, new THREE.SphereGeometry(0.3, 12, 8), sx * (porte + 0.2), pied(sx * (porte + 0.2), zf) + 2.6, zf); }
  { const px = -L / 2 + 3, pz = W / 2 + CD * 0.6, py = pied(px, pz), pu = new THREE.Group(); pose(g, pu, px, py, pz);
    pu.add(mesh(new THREE.CylinderGeometry(1.0, 1.05, 1.0, 20, 1, true), phMat('granit_lozere', 6.3, 1.0, { ...GR, side: THREE.DoubleSide }), 0, 0.5, 0));
    const fond = new THREE.Mesh(new THREE.CircleGeometry(0.98, 20), new THREE.MeshStandardMaterial({ color: 0x0b0907, roughness: 1 })); fond.rotation.x = -Math.PI / 2; fond.position.y = 0.25; pu.add(fond);
    for (const sx of [-0.95, 0.95]) poserPiece(C.granit, boxG(0.25, 2.2, 0.25), px + sx, py + 1.1, pz); poserPiece(C.granit, boxG(2.3, 0.25, 0.3), px, py + 2.25, pz);
    inscrire12(ctx, monde, px, pz, 1.1);
    const [wx, wz] = monde(px, pz); addInteract({ pos: new THREE.Vector3(wx, y0 + py, wz), r: 2.6, prompt: () => 'regarder dans le puits', fn: () => showMessage('Le puits est à sec. Tout au fond, des pierres sèches, et pas un reflet.', 5) }); }
  // ---- le pigeonnier ----
  { const [p0, p1, q0, q1] = pig, cx = (p0 + p1) / 2, cz = (q0 + q1) / 2, w = p1 - p0, yP = pied(cx, cz) - 0.3, Hp = 7.4;
    pose(g, boite(w, Hp + 3, w, 'granit_lozere', GR), cx, yP + (Hp - 3) / 2, cz);
    poserPiece(C.granit, boxG(w + 0.3, 0.22, w + 0.3), cx, yP + 5.0, cz);                                  // la randière
    toitCroupes(C, cx, cz, w, w, yP + Hp, { O: 0.35, coyau: 0.5, pente: 1.1 });
    for (const sx of [-1, 0, 1]) poserPiece(C.vitre, boxG(0.18, 0.18, 0.06), cx + sx * 0.5, yP + 6.3, q1 + 0.02);              // les trous d'envol
    poserPiece(C.granit, boxG(1.8, 0.1, 0.4), cx, yP + 6.1, q1 + 0.18);                                                          // la planche d'envol
    poserPiece(C.porte, boxG(0.9, 1.9, 0.08), cx, yP + 0.3 + 0.95, q1 + 0.02);
    inscrireRect(ctx, monde, pig, y0 + yP, 0.35); }
  finirChantier(g, C, { volet: 0xb0604a, porte: 0x5a4030, granit: 0xbab4a8 });
  g.traverse((o) => { if (o.isMesh && !(o.material && o.material.alphaTest)) { o.castShadow = true; o.receiveShadow = true; } });
  const [fx, fz] = monde(0, tz + R + 2);
  addInteract({ pos: new THREE.Vector3(fx, y0, fz), r: 3.5, prompt: () => 'Beauregard', fn: () => showMessage('Beauregard, sur sa hauteur : de la terrasse, on voit tout le lac, et ce qu’il en reste.', 6) });
}
// un rond de collision (une tour, un puits)
function inscrire12({ inscrire }, monde, lx, lz, r) { const [x, z] = monde(lx, lz); inscrire(Array.from({ length: 12 }, (_, k) => monde(lx + Math.cos(k / 12 * 6.283) * r, lz + Math.sin(k / 12 * 6.283) * r)), x, z); }

// ---------------------------------------------------------------------
//  Les domaines : ce qui fait vivre une maison du Ségala
// ---------------------------------------------------------------------
// Eugène, 5 octobre : le Batut paraissait « au milieu de nulle part ». Une maison de maître du
// Ségala ne se tient pas seule dans un pré : un chemin la relie à la route, une grange-étable
// la flanque (le bétail est la richesse de ces fermes, celle qu'on leur vole dans STORY.md), un
// potager clos sèche au soleil, et de grands arbres l'ombragent. Les trois maisons Roquette les
// reçoivent toutes.
// le chemin d'accès : ajouté au plan AVANT rues(), qui le bâtit comme un chemin d'exploitation
// (deux ornières) — de la porte de la maison au point le plus proche d'une route
const DOMAINES = [];
function cheminsDAcces(PLAN, maisons) {
  for (const { nom, X, Z, rot, demi, porteL } of maisons) {
    const c = Math.cos(rot), sn = Math.sin(rot), monde = (lx, lz) => [X + lx * c + lz * sn, Z - lx * sn + lz * c], local = (x, z) => [(x - X) * c - (z - Z) * sn, (x - X) * sn + (z - Z) * c];
    const porte = monde(...porteL);
    let b = null; for (const r of PLAN.rues || []) for (let k = 0; k < r.pts.length - 1; k++) { const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((porte[0] - ax) * dx + (porte[1] - az) * dz) / l)), x = ax + t * dx, z = az + t * dz, d = Math.hypot(x - porte[0], z - porte[1]); if (!b || d < b[2]) b = [x, z, d]; }
    if (!b || b[2] < 3) continue;
    // la route passe derrière la maison : le chemin sort de la cour et en fait le tour par le côté
    // de la route (la ligne droite traversait la maison : banc, 21 points de chemin bloqués)
    const [rx, rz] = local(b[0], b[1]), etapes = [porteL];
    // (le tronçon le long de la cour passe à 1,8 m du muret : à 1 m, il frôlait ses pierres)
    if (rz < porteL[1] - 2) { const sx = rx >= 0 ? 1 : -1, cote = sx * (demi + 6), zc = porteL[1] + 1.8; etapes.push([porteL[0], zc], [cote, zc]); if (rz < -14 || Math.abs(rx) < demi + 6) etapes.push([cote, Math.max(rz, -16)]); }
    etapes.push([rx, rz]);
    // chaque tronçon ondule un peu : un chemin de ferme suit le terrain, pas la règle
    const pts = [];
    for (let e = 0; e < etapes.length - 1; e++) { const [ax, az] = monde(...etapes[e]), [bx, bz] = monde(...etapes[e + 1]), l = Math.hypot(bx - ax, bz - az) || 1, n = Math.max(1, Math.round(l / 10));
      for (let k = e ? 1 : 0; k <= n; k++) { const t = k / n, o = l < 25 ? 0 : Math.sin(t * Math.PI) * Math.sin(t * 7 + ax) * Math.min(3, l / 12); pts.push([ax + (bx - ax) * t - (bz - az) / l * o, az + (bz - az) * t + (bx - ax) / l * o]); } }
    (PLAN.sentiers = PLAN.sentiers || []).push({ pts, r: 1, nom: 'le chemin ' + nom });
  }
}
// la grange-étable : un long volume de moellons sous tuiles canal, le grand portail charretier au
// pignon, des jours étroits ; 16 × 9 m, 5 m à l'égout — les mesures d'une grange de ferme moyenne
function grange({ hauteur, scene, inscrire }, X, Z, rot) {
  const L = 16, W = 9, H = 5, c = Math.cos(rot), s = Math.sin(rot), monde = (lx, lz) => [X + lx * c + lz * s, Z - lx * s + lz * c];
  const coins = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]], emp = coins.map(([a, b]) => monde(a, b));
  let y0 = 1e9; for (const [x, z] of emp) y0 = Math.min(y0, hauteur(x, z));
  const g = new THREE.Group(); g.position.set(X, y0, Z); g.rotation.y = rot; scene.add(g);
  pose(g, boite(L, H + 5, W, 'stone_wall', { color: 0x9e9686 }), 0, (H - 5) / 2, 0);
  const O = 0.4, PG = 1.0, hl = (W / 2 + O) * PG, la = L / 2 + O, lb = W / 2 + O, pos = [], uv = [], rampe = Math.hypot(lb, hl);     // PG : la pente de la lauze
  for (const sg of [1, -1]) { const q = [[-la, H - O * PG, sg * lb], [la, H - O * PG, sg * lb], [la, H + hl - O * PG, 0], [-la, H + hl - O * PG, 0]];
    for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...q[i]); uv.push(0, 0, 2 * la / 3, 0, 2 * la / 3, rampe / 3, 0, 0, 2 * la / 3, rampe / 3, 0, rampe / 3); }
  const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gt.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gt.computeVertexNormals(); g.add(new THREE.Mesh(gt, TUILE(1, 1)));
  const pg = new THREE.BufferGeometry(), t = []; for (const sx of [-1, 1]) t.push(sx * L / 2, H, -W / 2, sx * L / 2, H, W / 2, sx * L / 2, H + W / 2 * PG, 0);
  pg.setAttribute('position', new THREE.Float32BufferAttribute(t, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 4.5, 0, 2.25, 0.7, 0, 0, 4.5, 0, 2.25, 0.7], 2)); pg.computeVertexNormals();
  g.add(new THREE.Mesh(pg, phMat('stone_wall', 1, 1, { color: 0x9e9686, side: THREE.DoubleSide })));
  // le portail charretier au pignon (3,2 × 3,6 m), son linteau de bois ; deux jours sur le long côté
  pose(g, mesh(boxG(0.1, 3.6, 3.2), phMat('wood_planks', 0.1, 3.6, { color: 0x8a7a66 })), L / 2 + 0.03, 1.8, 0);
  pose(g, mesh(boxG(0.25, 0.3, 3.8), phMat('wood_cabinet_worn_long', 0.3, 3.8, { color: 0x6a5440 })), L / 2 + 0.08, 3.75, 0);
  for (const x of [-4, 0, 4]) pose(g, mesh(boxG(0.3, 0.7, 0.08), new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 1 })), x, 3.4, W / 2 + 0.02);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  inscrire(emp, X, Z); LIEU.murs.push({ pts: emp, sol: y0 }); LIEU.toits.push({ bat: LIEU.murs.length - 1, pts: [[-la, -lb], [la, -lb], [la, lb], [-la, lb]].map(([a, b]) => monde(a, b)) });
}
// le potager clos : des planches de terre retournée, sèche, entre des allées, dans un muret bas
function potager({ hauteur, scene, inscrire }, X, Z, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), monde = (lx, lz) => [X + lx * c + lz * s, Z - lx * s + lz * c], Lx = 12, Lz = 9;
  const pos = [], uv = [];
  for (let k = 0; k < 6; k++) { const z0 = -Lz / 2 + 0.6 + k * 1.4, z1 = z0 + 0.9;
    for (let x = -Lx / 2 + 0.6; x < Lx / 2 - 0.6; x += 1) { const q = [[x, z0], [x + 1, z0], [x + 1, z1], [x, z1]].map(([a, b]) => { const [wx, wz] = monde(a, b); return [wx, hauteur(wx, wz) + 0.06, wz]; });
      for (const i of [0, 3, 1, 1, 3, 2]) pos.push(...q[i]); uv.push(...[[0, 0], [0, 0.45], [0.5, 0], [0.5, 0], [0, 0.45], [0.5, 0.45]].flat()); } }
  const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gp.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gp.computeVertexNormals();
  const m = new THREE.Mesh(gp, phMat('brown_mud_03', 1, 1, { color: 0xb8a088, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m);
  // le muret bas, ouvert d'un côté
  const pierres = [];
  for (const [a, b] of [[[-Lx / 2, -Lz / 2], [Lx / 2, -Lz / 2]], [[Lx / 2, -Lz / 2], [Lx / 2, Lz / 2]], [[-Lx / 2, Lz / 2], [-Lx / 2, -Lz / 2]], [[-Lx / 2, Lz / 2], [Lx / 2 - 1.6, Lz / 2]]]) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(l / 1.5));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, [wx, wz] = monde(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), gb = boxG(l / n + 0.03, 0.75 + 0.6, 0.45);
      gb.rotateY(rot + Math.atan2(-(b[1] - a[1]), b[0] - a[0])); gb.translate(wx, hauteur(wx, wz) + 0.075, wz); const gn = gb.toNonIndexed(); gn.computeVertexNormals(); uvMetres(gn); pierres.push(gn); }
    // (allongée de son épaisseur aux deux bouts : pas d'encoche aux angles)
    const nx = -(b[1] - a[1]) / l * 0.25, nz = (b[0] - a[0]) / l * 0.25, ex = (b[0] - a[0]) / l * 0.25, ez = (b[1] - a[1]) / l * 0.25, A = [a[0] - ex, a[1] - ez], B = [b[0] + ex, b[1] + ez];
    inscrire([[A[0] - nx, A[1] - nz], [B[0] - nx, B[1] - nz], [B[0] + nx, B[1] + nz], [A[0] + nx, A[1] + nz]].map(([p, q]) => monde(p, q)), ...monde((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); }
  const mm = new THREE.Mesh(mergeGeometries(pierres), phMat('rustic_stone_wall_02', 1, 1, { color: 0x9e968a })); mm.castShadow = mm.receiveShadow = true; scene.add(mm);
}
// pose les dépendances d'une maison : la grange et le potager sur ses côtés, là où il y a la place
// (ni bâti, ni eau, ni rue) ; les grands arbres, arbres() les plante (LIEU.ombrages)
function domaine(ctx, nom, X, Z, rot, demiLargeur) {
  const { bloque, PLAN } = ctx, c = Math.cos(rot), s = Math.sin(rot), monde = (lx, lz) => [X + lx * c + lz * s, Z - lx * s + lz * c];
  const eaux = [...(PLAN.eau.plans || []).map((p) => p.pts), PLAN.eau.lacPlein ? PLAN.eau.lacPlein.pts : []];
  const surRue = (x, z, r) => LIEU.rues.some((q) => q.pts.some(([px, pz]) => Math.abs(px - x) < r && Math.abs(pz - z) < r && Math.hypot(px - x, pz - z) < r));
  const libre = (lx, lz, rx, rz) => { for (let a = -rx; a <= rx; a += 2) for (let b = -rz; b <= rz; b += 2) { const [x, z] = monde(lx + a, lz + b); if (bloque(x, z, 0.5) || dansUneMaison(x, z, 2) || eaux.some((P) => P.length && dansPoly(x, z, P)) || surRue(x, z, 3)) return false; } return true; };
  const pris = [];
  // la grange, d'un côté ou de l'autre, un peu en arrière
  // (plusieurs places, de la plus naturelle à la moins : sur le côté, plus en arrière, derrière)
  const D = demiLargeur, placeG = [[D + 13, -6], [-D - 13, -6], [D + 13, -20], [-D - 13, -20], [0, -26], [D + 16, 8], [-D - 16, 8]].find(([lx, lz]) => libre(lx, lz, 9, 6));
  if (placeG) { const [x, z] = monde(...placeG); grange(ctx, x, z, rot + Math.PI / 2); pris.push(Math.sign(placeG[0])); }
  // le potager, du côté resté libre, devant
  const placeP = [[D + 9, 10], [-D - 9, 10], [D + 9, 24], [-D - 9, 24], [D + 22, -8], [-D - 22, -8]].find(([lx, lz]) => !pris.includes(Math.sign(lx)) && libre(lx, lz, 7, 6)) || [[-D - 22, -8], [D + 22, -8]].find(([lx, lz]) => libre(lx, lz, 7, 6));
  if (placeP) { const [x, z] = monde(...placeP); potager(ctx, x, z, rot); }
  // trois ou quatre grands arbres autour, derrière et sur les côtés : l'ombre de la cour
  LIEU.ombrages = LIEU.ombrages || [];
  for (const [lx, lz] of [[-demiLargeur - 4, -12], [demiLargeur + 3, -14], [0, -18], [-demiLargeur - 6, 8]]) { const [x, z] = monde(lx, lz); if (libre(lx, lz, 3, 3)) LIEU.ombrages.push([x, z]); }
  // le pré du troupeau, derrière la maison (troupeaux() y pose ce qui reste de brebis)
  DOMAINES.push({ nom, grange: placeG || null, potager: placeP || null, pre: monde(0, -32) }); LIEU.domaines = DOMAINES;
}

// ---------------------------------------------------------------------
//  Le sol : la patine et les affleurements (le réalisme, 5 octobre)
// ---------------------------------------------------------------------
// Le withered_grass seul, partout de la même teinte, se répétait vu d'en haut et ne disait rien
// du pays. Une patine par sommet du relief fin (des couleurs de sommet, multipliées à la texture) :
// - le parcellaire : des prés de 40 à 80 m, chacun sa teinte, comme on les voit d'avion — les
//   uns fauchés, les autres grillés sur pied ;
// - l'eau : plus vert et plus sombre dans les creux et à moins de 20 m du lac plein, où la terre
//   garde un peu d'humidité ;
// - la pente : plus terreuse là où le sol est mince, sur les talus raides.
// monde.js n'a pas encore de crochet pour cela (PROMPT-REPRISE.md, § 4.E : « sol.patine ») : on
// reprend la maille du relief fin qu'il a posée, et on lui ajoute ses couleurs.
// Les AFFLEUREMENTS : le Ségala est un plateau de schiste et de granit ; la roche perce les prés
// pentus en dalles grises. Des blocs posés là où la pente passe 18°, fondus en une maille.
function sol({ hauteur, scene, PLAN, bloque }) {
  const Gc = PLAN.cadres && PLAN.cadres[0]; if (!Gc) return;
  const nx = Math.round((Gc.x1 - Gc.x0) / 5) + 1;
  const m = scene.children.find((o) => o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.widthSegments === nx - 1);
  if (!m) return;
  const lac = PLAN.eau.lacPlein ? PLAN.eau.lacPlein.pts : [];
  const dRive = (x, z) => { let b = 1e9; for (let i = 0, j = lac.length - 1; i < lac.length; j = i++) { const [ax, az] = lac[j], [bx, bz] = lac[i], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)); b = Math.min(b, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return b; };
  const h01 = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  const p = m.geometry.attributes.position, col = new Float32Array(p.count * 3);
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), z = p.getZ(k), y = p.getY(k);
    // le pré : une case de 60 m, tordue pour ne pas faire un damier
    const qx = Math.floor((x + 18 * Math.sin(z * 0.021)) / 60), qz = Math.floor((z + 18 * Math.sin(x * 0.019)) / 60), pre = h01(qx, qz);
    let r = 0.92 + 0.16 * pre, g = 0.92 + 0.16 * pre, b = 0.92 + 0.12 * pre;
    if (pre > 0.72) { r *= 1.05; g *= 1.04; b *= 0.94; }                              // un pré fauché, plus blond
    const pente = Math.hypot(hauteur(x + 2.5, z) - hauteur(x - 2.5, z), hauteur(x, z + 2.5) - hauteur(x, z - 2.5)) / 5;
    if (pente > 0.25) { const t = Math.min(1, (pente - 0.25) * 2); r *= 1 - 0.06 * t; g *= 1 - 0.12 * t; b *= 1 - 0.14 * t; }     // le talus, la terre à nu
    const creux = y - (hauteur(x + 15, z) + hauteur(x - 15, z) + hauteur(x, z + 15) + hauteur(x, z - 15)) / 4;
    const humide = Math.max(0, Math.min(1, -creux / 2.5)) * 0.6 + (lac.length && Math.abs(x) < 700 ? Math.max(0, 1 - dRive(x, z) / 20) * 0.5 : 0);
    if (humide > 0) { r *= 1 - 0.14 * humide; g *= 1 - 0.02 * humide; b *= 1 - 0.12 * humide; }
    col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b;
  }
  m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.material = m.material.clone(); m.material.vertexColors = true; m.material.needsUpdate = true;
  // les affleurements
  const blocs = [], Zn = LIEU.zone || { x0: Gc.x0, x1: Gc.x1, z0: Gc.z0, z1: Gc.z1 };
  for (let k = 0; k < 4000 && blocs.length < 160; k++) {
    const x = Zn.x0 + h01(k, 1) * (Zn.x1 - Zn.x0), z = Zn.z0 + h01(1, k) * (Zn.z1 - Zn.z0);
    const pente = Math.hypot(hauteur(x + 2, z) - hauteur(x - 2, z), hauteur(x, z + 2) - hauteur(x, z - 2)) / 4;
    if (pente < 0.32 || bloque(x, z, 2) || dansUneMaison(x, z, 3) || (lac.length && dansPoly(x, z, lac))) continue;
    // une dalle couchée dans le sens de la pente, deux ou trois éclats autour
    for (let e = 0; e < 3; e++) { const ex = x + (e ? (h01(k, e) - 0.5) * 3 : 0), ez = z + (e ? (h01(e, k) - 0.5) * 3 : 0), r = e ? 0.35 + h01(k, e + 3) * 0.4 : 0.8 + h01(k, 7) * 0.7;
      // un icosaèdre subdivisé, bosselé sommet par sommet : le dodécaèdre lisse faisait un galet noir
      const gb = new THREE.IcosahedronGeometry(r, 1), pp = gb.attributes.position; for (let v = 0; v < pp.count; v++) { const f = 0.8 + 0.4 * h01(Math.round(pp.getX(v) * 40 + k), Math.round(pp.getZ(v) * 40 + pp.getY(v) * 17)); pp.setXYZ(v, pp.getX(v) * f, pp.getY(v) * f, pp.getZ(v) * f); } gb.scale(1.4, 0.45, 1); gb.rotateY(Math.atan2(hauteur(ex, ez + 1) - hauteur(ex, ez - 1), hauteur(ex + 1, ez) - hauteur(ex - 1, ez)));
      gb.translate(ex, hauteur(ex, ez) + r * 0.12, ez); const gn = gb.toNonIndexed(); gn.computeVertexNormals(); uvMetres(gn); blocs.push(gn); }
  }
  if (blocs.length) { const mb = new THREE.Mesh(mergeGeometries(blocs), phMat('rocher_01', 1, 1, { color: 0xc4beb4, roughness: 0.95 })); mb.castShadow = mb.receiveShadow = true; scene.add(mb); }
  LIEU.affleurements = blocs.length;
}

// ---------------------------------------------------------------------
//  Le bâti d'OSM, les rues, les arbres — bâtis ici, au plus juste
// ---------------------------------------------------------------------
// Consigne de précision d'Eugène (2 octobre) : monde.js coiffait chaque bâtiment d'un toit sur
// son rectangle englobant (152 toits sur 159 débordaient, 69 au-dessus d'un voisin : banc
// bancs/lieu-aveyron.mjs), et posait les rues 18 cm au-dessus du relief. Le plan joué ne lui
// donne plus ni bâti ni rues (carte/mondes/fondre-relief-aveyron.py les range sous « bati »,
// « rues », « sentiers ») : on les bâtit ici.
// - Les TOITS : une emprise en L ou en T est découpée en rectangles, un toit à deux pans par
//   aile, faîtage sur son long côté ; débord de 40 cm, ramené à 0 au-dessus d'un voisin ou
//   d'une autre aile ; pente de lauze (45°, depuis le 5 octobre ; tuile canal à 30 % avant), toit plafonné à 4,5 m. Une emprise irrégulière
//   (l'abside de l'église) a un toit en pavillon, sans débord.
// - La PENTE : le plancher est au plus 1,5 m au-dessus du point le plus bas de l'emprise ; sur
//   les fortes pentes (14 maisons à plus de 3 m), la maison s'encastre côté amont — la maison de
//   pente du Ségala, qui entre par l'étage.
// - Les RUES : collées au relief (3 à 4,5 cm au-dessus, décalées en profondeur par classe pour
//   ne pas se battre aux carrefours), leur matière d'après le tag surface d'OSM ou leur classe.
const LIEU = { murs: [], toits: [], rubans: [], rues: [], nappes: [] };
const TOIT = { o: 0.4, pente: 1.0, max: 4.5 };

function dansPoly(x, z, P) { let d = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; }
function aire(P) { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return Math.abs(s) / 2; }

// une emprise découpée en ailes rectangulaires, dans le repère de son plus long mur ; null si
// elle n'est pas faite d'angles droits (à 15° près)
function ailes(P) {
  let best = 0, th = 0, per = 0, droit = 0;
  for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], l = Math.hypot(bx - ax, bz - az); if (l > best) { best = l; th = Math.atan2(bz - az, bx - ax); } }
  const ux = Math.cos(th), uz = Math.sin(th), A = (x, z) => x * ux + z * uz, Bv = (x, z) => -x * uz + z * ux, X = (a, b) => [a * ux - b * uz, a * uz + b * ux];
  const As = [], Bs = [];
  for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], da = A(bx, bz) - A(ax, az), db = Bv(bx, bz) - Bv(ax, az), l = Math.hypot(da, db); if (l < 0.3) continue;
    per += l; const ang = Math.abs(Math.atan2(db, da)) % (Math.PI / 2), dev = Math.min(ang, Math.PI / 2 - ang); if (dev < 0.26) droit += l;
    if (Math.abs(db) < Math.abs(da)) Bs.push((Bv(ax, az) + Bv(bx, bz)) / 2); else As.push((A(ax, az) + A(bx, bz)) / 2); }
  if (droit < per * 0.9) return null;
  const grappes = (v) => { v.sort((p, q) => p - q); const o = []; for (const x of v) { if (o.length && x - o[o.length - 1].m < 0.6) { const g = o[o.length - 1]; g.s += x; g.n++; g.m = x; } else o.push({ s: x, n: 1, m: x }); } return o.map((g) => g.s / g.n); };
  const ga = grappes(As), gb = grappes(Bs); if (ga.length < 2 || gb.length < 2) return null;
  const plein = (i, j) => { const [x, z] = X((ga[i] + ga[i + 1]) / 2, (gb[j] + gb[j + 1]) / 2); return dansPoly(x, z, P); };
  const fusion = (sensA) => { const ni = ga.length - 1, nj = gb.length - 1, runs = [];
    const I = sensA ? ni : nj, J = sensA ? nj : ni, f = (p, q) => sensA ? plein(p, q) : plein(q, p);
    for (let q = 0; q < J; q++) { let p = 0; while (p < I) { if (!f(p, q)) { p++; continue; } const p0 = p; while (p < I && f(p, q)) p++; runs.push([p0, p, q]); } }
    const rects = []; for (const r of runs) { const prev = rects.find((x) => x.p0 === r[0] && x.p1 === r[1] && x.q1 === r[2]); if (prev) prev.q1 = r[2] + 1; else rects.push({ p0: r[0], p1: r[1], q0: r[2], q1: r[2] + 1 }); }
    return rects.map((r) => sensA ? [ga[r.p0], ga[r.p1], gb[r.q0], gb[r.q1]] : [ga[r.q0], ga[r.q1], gb[r.p0], gb[r.p1]]); };
  let ra = fusion(true), rb = fusion(false); const r = rb.length < ra.length ? rb : ra;
  return { ux, uz, X, A, Bv, rects: r.filter(([a0, a1, b0, b1]) => a1 - a0 > 1.2 && b1 - b0 > 1.2) };
}

// UV des murs en mètres, face par face (comme monde.js) : la pierre garde sa taille réelle
function uvMetres(g) { const p = g.attributes.position, uv = g.attributes.uv, n = g.attributes.normal;
  for (let k = 0; k < p.count; k++) { const plat = Math.abs(n.getY(k)) > 0.7; uv.setXY(k, plat ? p.getX(k) / 2 : (p.getX(k) * Math.abs(n.getZ(k)) + p.getZ(k) * Math.abs(n.getX(k))) / 2, plat ? p.getZ(k) / 2 : p.getY(k) / 2); } }
// une teinte par bâtiment, à ±7 % : vingt maisons de la même pierre ne font plus un seul aplat
function teinter(g, t) { const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(t); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }

// Les OUVERTURES du bâti d'OSM (le réalisme, 5 octobre) : les maisons de Perpignou et de
// Fariboules étaient des murs aveugles. Celles du Ségala ont des baies hautes encadrées de granit,
// des volets de bois peints, une porte sur le long côté ; la grange, un grand portail de planches
// et de rares jours. Tout est fondu par matière (vitre, granit, bois), comme le reste du bâti.
const OUV = { vitre: [], granit: [], bois: [] };
const MAT_OUV = {
  vitre: () => new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.18, metalness: 0.35 }),
  granit: () => phMat('granite_tile_03', 1, 1, { color: 0xbab4a8 }),
  bois: () => phMat('wood_planks', 1, 1, { vertexColors: true }),
};
const VOLETS = [[0.71, 0.78, 0.84], [0.78, 0.44, 0.35], [0.69, 0.75, 0.6], [0.55, 0.42, 0.32]];   // gris-bleu, rouge sang-de-bœuf, vert sauge, brun
function ouvertures(P, sol, hm, grange, i, voisin, hauteur) {
  const piece = (cle, w, h, d, cx, y, cz, ang, teinte) => { const g = boxG(w, h, d); g.rotateY(ang); g.translate(cx, y, cz); const gn = g.toNonIndexed(); gn.computeVertexNormals(); uvMetres(gn);
    if (teinte) { const c = new Float32Array(gn.attributes.position.count * 3); for (let k = 0; k < c.length; k += 3) c.set(teinte, k); gn.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    OUV[cle].push(gn); };
  // les niveaux : 4,6 m de murs en font un, 6,4 m deux (au-delà, l'étage passait sous le toit)
  const niveaux = Math.max(1, Math.floor((hm - 0.4) / 2.9)), couleur = VOLETS[i % VOLETS.length];
  let porte = -1, lmax = 0; for (let k = 0; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], l = Math.hypot(bx - ax, bz - az); if (l > lmax) { lmax = l; porte = k; } }
  for (let k = 0; k < P.length; k++) {
    const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], l = Math.hypot(bx - ax, bz - az); if (l < 3) continue;
    const ex = (bx - ax) / l, ez = (bz - az) / l, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let nx = ez, nz = -ex; if (dansPoly(mx + nx * 0.3, mz + nz * 0.3, P)) { nx = -nx; nz = -nz; }       // la normale vers le dehors
    if (voisin(mx + nx * 0.8, mz + nz * 0.8, i)) continue;                                              // un mur mitoyen n'a pas d'ouverture
    const ang = Math.atan2(-ez, ex), at = (t, e) => [ax + ex * t + nx * e, az + ez * t + nz * e];
    const ouvert = (t, y, h) => { const [x, z] = at(t, 0.5); return y - h / 2 > hauteur(x, z) + 0.3; };   // pas d'ouverture enterrée côté amont
    if (grange) {
      // le portail de la grange au milieu du long côté, un jour étroit de part et d'autre
      if (k === porte) { const t = l / 2, h = Math.min(3.2, hm - 0.6); if (ouvert(t, sol + h / 2, h)) { const [x, z] = at(t, 0.05); piece('bois', Math.min(3.4, l - 2), h, 0.12, x, sol + h / 2, z, ang, [0.55, 0.47, 0.4]); const [x2, z2] = at(t, 0.1); piece('granit', Math.min(3.4, l - 2) + 0.5, 0.35, 0.3, x2, sol + h + 0.15, z2, ang); } }
      for (const t of [l * 0.2, l * 0.8]) if (l > 8 && ouvert(t, sol + hm - 1.2, 0.6)) { const [x, z] = at(t, 0.02); piece('vitre', 0.3, 0.6, 0.06, x, sol + hm - 1.2, z, ang); }
      continue; }
    const n = Math.max(1, Math.floor((l - 1.2) / 3.2));
    for (let j = 0; j < n; j++) { const t = (j + 0.5) * l / n;
      for (let v = 0; v < niveaux; v++) {
        const rez = v === 0, estPorte = rez && k === porte && j === Math.floor(n / 2);
        const w = estPorte ? 1.1 : 0.9, h = estPorte ? 2.15 : rez ? 1.3 : 1.2, y = estPorte ? sol + h / 2 : sol + v * 3 + 1.45;
        if (!ouvert(t, y, h)) continue;
        const [x, z] = at(t, 0.02); piece(estPorte ? 'bois' : 'vitre', w, h, 0.06, x, y, z, ang, estPorte ? [0.42, 0.32, 0.25] : null);
        // l'encadrement de granit : linteau, appui (pas sous une porte), jambages
        const [gx, gz] = at(t, 0.06); piece('granit', w + 0.4, 0.22, 0.14, gx, y + h / 2 + 0.11, gz, ang);
        if (!estPorte) piece('granit', w + 0.5, 0.12, 0.2, gx, y - h / 2 - 0.06, gz, ang);
        for (const sx of [-1, 1]) { const [jx, jz] = at(t + sx * (w / 2 + 0.09), 0.06); piece('granit', 0.18, h, 0.14, jx, y, jz, ang); }
        // les volets, ouverts contre le mur, à la couleur de la maison
        if (!estPorte) for (const sx of [-1, 1]) { const [vx, vz] = at(t + sx * (w / 2 + 0.2 + w / 4), 0.05); piece('bois', w / 2, h, 0.05, vx, y, vz, ang, couleur); }
      } }
  }
}

function bati({ hauteur, scene, PLAN, inscrire, CADRE }) {
  const B = (PLAN.bati || []).filter((b) => b.pts.length >= 3 && b.pts.every(([x, z]) => x > CADRE.x0 && x < CADRE.x1 && z > CADRE.z0 && z < CADRE.z1));
  const murs = [], toits = [], alea = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const grille = new Map(); B.forEach((b, i) => { for (const [x, z] of b.pts) { const k = Math.floor(x / 20) + ',' + Math.floor(z / 20); if (!grille.has(k)) grille.set(k, new Set()); grille.get(k).add(i); } });
  const voisin = (x, z, moi) => { for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (const i of grille.get((Math.floor(x / 20) + a) + ',' + (Math.floor(z / 20) + c)) || []) if (i !== moi && dansPoly(x, z, B[i].pts)) return true; return false; };
  B.forEach((b, i) => {
    const P = b.pts.slice(0, b.pts[0][0] === b.pts[b.pts.length - 1][0] && b.pts[0][1] === b.pts[b.pts.length - 1][1] ? -1 : undefined);
    let lo = 1e9, hi = -1e9; for (const [x, z] of P) { const h = hauteur(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    const sol = lo + Math.min(1.5, hi - lo), ar = aire(P), hm = b.niv ? b.niv * 3 : b.h ? Math.max(3, b.h - 2) : ar > 60 ? 6.4 : 4.6, haut = sol + hm;
    const t = 0.93 + alea(i) * 0.14;
    // les murs : l'emprise extrudée du point le plus bas (moins 60 cm, dans le sol) au haut des murs
    const sh = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z))), base = lo - 0.6;
    const gm = new THREE.ExtrudeGeometry(sh, { depth: haut - base, bevelEnabled: false, steps: 1 }); gm.rotateX(-Math.PI / 2); gm.translate(0, base, 0); gm.clearGroups();
    const gn = gm.toNonIndexed(); gn.computeVertexNormals(); uvMetres(gn); murs.push(teinter(gn, t));
    LIEU.murs.push({ pts: P, sol });
    ouvertures(P, sol, hm, b.k === 'barn', i, voisin, hauteur);
    // le toit
    let D = ailes(P);
    // des ailes calées sur des murs presque d'équerre (à 10–15° près) sortent un peu de l'emprise :
    // plus d'1 m² dehors, et le bâtiment prend un toit en pavillon (banc : 7 toits débordaient)
    if (D) { let dehors = 0; for (const [a0, a1, b0, b1] of D.rects) for (let a = a0 + 0.25; a < a1; a += 0.5) for (let bq = b0 + 0.25; bq < b1; bq += 0.5) { const [x, z] = D.X(a, bq); if (!dansPoly(x, z, P)) dehors += 0.25; } if (dehors > 1) D = null; }
    if (D && D.rects.length) for (const [a0, a1, b0, b1] of D.rects) {
      const longA = a1 - a0 >= b1 - b0, Lr = longA ? a1 - a0 : b1 - b0, Wr = longA ? b1 - b0 : a1 - a0, hl = Math.min(Wr / 2 * TOIT.pente, TOIT.max);
      // le débord de chaque côté : 40 cm, 0 s'il tomberait sur un voisin ou dans une autre aile
      const cote = (aa, bb, na, nb) => { for (let s = 0; s <= 1; s += 0.25) { const [x, z] = D.X(aa(s) + na * (TOIT.o + 0.15), bb(s) + nb * (TOIT.o + 0.15)); if (voisin(x, z, i) || dansPoly(x, z, P)) return 0; } return TOIT.o; };
      const oA0 = cote(() => a0, (s) => b0 + (b1 - b0) * s, -1, 0), oA1 = cote(() => a1, (s) => b0 + (b1 - b0) * s, 1, 0);
      const oB0 = cote((s) => a0 + (a1 - a0) * s, () => b0, 0, -1), oB1 = cote((s) => a0 + (a1 - a0) * s, () => b1, 0, 1);
      const A0 = a0 - oA0, A1 = a1 + oA1, B0 = b0 - oB0, B1 = b1 + oB1, Am = (a0 + a1) / 2, Bm = (b0 + b1) / 2;
      const V = (a, bq, y) => { const [x, z] = D.X(a, bq); return [x, y, z]; };
      const tri = [], uvs = [], push = (p, q, r, uvp) => { tri.push(...p, ...q, ...r); uvs.push(...uvp); };
      if (longA) {      // faîtage le long de a
        const r0 = V(A0, Bm, haut + hl), r1 = V(A1, Bm, haut + hl), e00 = V(A0, B0, haut - oB0 * TOIT.pente), e01 = V(A1, B0, haut - oB0 * TOIT.pente), e10 = V(A0, B1, haut - oB1 * TOIT.pente), e11 = V(A1, B1, haut - oB1 * TOIT.pente);
        const lp = Math.hypot(Bm - B0, hl);
        push(e00, e01, r1, [0, 0, A1 - A0, 0, A1 - A0, lp]); push(e00, r1, r0, [0, 0, A1 - A0, lp, 0, lp]);
        push(e11, e10, r0, [A1 - A0, 0, 0, 0, 0, lp]); push(e11, r0, r1, [A1 - A0, 0, 0, lp, A1 - A0, lp]);
        for (const aa of [a0, a1]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...V(aa, b0, haut), ...V(aa, b1, haut), ...V(aa, Bm, haut + hl)], 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute([0, haut / 2, (b1 - b0) / 2, haut / 2, (Bm - b0) / 2, (haut + hl) / 2], 2)); g.computeVertexNormals(); murs.push(teinter(g, t)); }
      } else {          // faîtage le long de b
        const r0 = V(Am, B0, haut + hl), r1 = V(Am, B1, haut + hl), e00 = V(A0, B0, haut - oA0 * TOIT.pente), e01 = V(A0, B1, haut - oA0 * TOIT.pente), e10 = V(A1, B0, haut - oA1 * TOIT.pente), e11 = V(A1, B1, haut - oA1 * TOIT.pente);
        const lp = Math.hypot(Am - A0, hl);
        push(e00, r0, r1, [0, 0, 0, lp, B1 - B0, lp]); push(e00, r1, e01, [0, 0, B1 - B0, lp, B1 - B0, 0]);
        push(e10, e11, r1, [0, 0, B1 - B0, 0, B1 - B0, lp]); push(e10, r1, r0, [0, 0, B1 - B0, lp, 0, lp]);
        for (const bb of [b0, b1]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...V(a0, bb, haut), ...V(a1, bb, haut), ...V(Am, bb, haut + hl)], 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute([0, haut / 2, (a1 - a0) / 2, haut / 2, (Am - a0) / 2, (haut + hl) / 2], 2)); g.computeVertexNormals(); murs.push(teinter(g, t)); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.map((v) => v / 3), 2)); g.computeVertexNormals();
      toits.push(teinter(g, t)); LIEU.toits.push({ bat: i, pts: [[A0, B0], [A1, B0], [A1, B1], [A0, B1]].map(([a, bq]) => D.X(a, bq)) });
    } else {             // un toit en pavillon sur l'emprise elle-même, la pointe au-dessus du centre
      const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length, hl = Math.min(Math.sqrt(ar) * 0.9, TOIT.max), tri = [], uvs = [];
      for (let k = 0; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], l = Math.hypot(bx - ax, bz - az);
        tri.push(ax, haut, az, bx, haut, bz, cx, haut + hl, cz); uvs.push(0, 0, l / 3, 0, l / 6, Math.hypot(Math.hypot(cx - ax, cz - az), hl) / 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
      toits.push(teinter(g, t)); LIEU.toits.push({ bat: i, pts: P });
    }
    inscrire(P, P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length);
  });
  const prep = (g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g.index ? g.toNonIndexed() : g; };
  for (const [cle, gs] of Object.entries(OUV)) if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs.map(prep)), MAT_OUV[cle]()); m.castShadow = m.receiveShadow = true; scene.add(m); OUV[cle] = []; }
  if (murs.length) { const m = new THREE.Mesh(mergeGeometries(murs.map(prep)), phMat('stone_wall', 1, 1, { color: 0xa8a090, vertexColors: true, side: THREE.DoubleSide })); m.castShadow = m.receiveShadow = true; scene.add(m); }
  if (toits.length) { const m = new THREE.Mesh(mergeGeometries(toits.map(prep)), TUILE(1, 1, { vertexColors: true })); m.castShadow = m.receiveShadow = true; scene.add(m); }
}

// les rues et les chemins, collés au relief ; matière d'après surface d'OSM, sinon d'après la classe
// de 1,5 à 3 cm au-dessus du relief : la profondeur les sépare (polygonOffset), pas la hauteur
const RUE = { 3: { l: 6, y: 0.03, off: -4 }, 2: { l: 4.5, y: 0.025, off: -3 }, 1: { l: 3, y: 0.02, off: -2 }, 0: { l: 1.6, y: 0.015, off: -1 } };
function matiereRue(c, sentier) {
  const s = c.surface;
  if (s === 'asphalt' || s === 'paved' || s === 'concrete') return 'asphalt_02';
  if (s === 'ground' || s === 'dirt' || s === 'earth' || s === 'grass') return 'terre_battue';
  if (s === 'gravel' || s === 'compacted' || s === 'fine_gravel' || s === 'unpaved') return 'gravier';
  if (c.k === 'steps') return 'granite_tile_03';
  if (!sentier) return c.r >= 2 ? 'asphalt_02' : 'gravier';
  return c.r === 1 ? 'rocky_trail' : 'terre_battue';
}
// la terre des chemins grisée vers l'herbe grillée : rousse, elle se lisait comme une piste de
// cendrée (planche du regard, 5 octobre) ; l'accotement en gravier sortait presque noir
const TEINTE_RUE = { asphalt_02: 0xe2dcd2, terre_battue: 0xb0a690, gravier: 0xc8bea8 };
function rues({ hauteur, scene, PLAN, CADRE, bloque }) {
  const dedans = (x, z) => x > CADRE.x0 - 10 && x < CADRE.x1 + 10 && z > CADRE.z0 - 10 && z < CADRE.z1 + 10;
  const par = new Map();
  for (const [liste, sentier] of [[PLAN.rues || [], false], [PLAN.sentiers || [], true]]) for (const c of liste) {
    if (c.tunnel || !c.pts.some(([x, z]) => dedans(x, z))) continue;
    const cls = RUE[sentier ? 0 : Math.min(3, c.r)] || RUE[1], w = sentier && c.r === 1 ? 2.6 : cls.l;
    const d = []; for (let k = 0; k < c.pts.length - 1; k++) { const [ax, az] = c.pts[k], [bx, bz] = c.pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * 2)); for (let t = 0; t < n; t++) d.push([ax + (bx - ax) * t / n, az + (bz - az) * t / n]); }
    d.push(c.pts[c.pts.length - 1]); if (d.length < 2) continue;
    // la rue d'OSM frôle parfois un mur (la rue le Carrierou à 26 cm d'une façade, dans une ruelle
    // de 3 m) : le ruban passe là où l'on marche, décalé d'au plus 1,5 m sur le côté libre
    for (let k = 0; k < d.length; k++) { const [x, z] = d[k]; if (!bloque(x, z, 0.45)) continue;
      const [xa, za] = d[Math.max(0, k - 1)], [xb, zb] = d[Math.min(d.length - 1, k + 1)], l = Math.hypot(xb - xa, zb - za) || 1, nx = -(zb - za) / l, nz = (xb - xa) / l;
      for (const e of [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.5, -1.5]) if (!bloque(x + nx * e, z + nz * e, 0.45)) { d[k] = [x + nx * e, z + nz * e]; break; } }
    // un sommet par mètre EN TRAVERS aussi (une rue de 6 m sur un bombement s'y enfonçait), et les
    // faces tournées vers le ciel : l'ordre de monde.js (b, b+2, b+1) les tournait vers le bas, et les
    // rubans étaient invisibles d'en haut (PROMPT-REPRISE.md, § 4.E)
    // Le réalisme (consigne de nuit, 5 octobre) : le chemin rural du Ségala est une chaussée étroite
    // et bombée, posée sur un accotement de gravier et de terre qui mange l'herbe de travers ; le
    // chemin d'exploitation, deux ornières de terre et l'herbe au milieu ; le sentier, une trace dont
    // la largeur varie. Plus de ruban de largeur fixe à bord franc.
    const seme = c.pts[0][0] * 0.37 + c.pts[0][1] * 0.11, onde = (s, f) => 0.5 * Math.sin(s * 0.21 * f + seme) + 0.5 * Math.sin(s * 0.57 * f + seme * 2);
    const poser = (slug, off, larg, centre, y, bombe = 0, bord = 1) => {
      const pos = [], uv = [], col = [], idx = [], nt = Math.max(2, Math.ceil(larg(0)) + 2); let s = 0;
      for (let k = 0; k < d.length; k++) { const [x, z] = d[k], [xa, za] = d[Math.max(0, k - 1)], [xb, zb] = d[Math.min(d.length - 1, k + 1)];
        let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; if (k) s += Math.hypot(x - d[k - 1][0], z - d[k - 1][1]);
        const tv = 0.9 + 0.1 * Math.sin(x * 0.013 + z * 0.017) * Math.sin(x * 0.007 - z * 0.011), W = larg(s), cc = centre(s);      // la teinte varie à grande échelle
        for (let q = 0; q < nt; q++) { const cs = -1 + 2 * q / (nt - 1), e = cc + W / 2 * cs, px = x - dz * e, pz = z + dx * e, t = tv * (Math.abs(cs) > 0.99 ? bord : 1);
          pos.push(px, hauteur(px, pz) + y + bombe * (1 - cs * cs), pz); uv.push(e, s); col.push(t, t, t); }
        if (k) for (let q = 0; q < nt - 1; q++) { const b = (k - 1) * nt + q, c2 = b + nt; idx.push(b, b + 1, c2, b + 1, c2 + 1, c2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const cle = slug + '|' + off; if (!par.has(cle)) par.set(cle, []); par.get(cle).push(g.toNonIndexed()); };
    const slug = matiereRue(c, sentier), droit = () => 0;
    if (!sentier) {
      // l'accotement d'abord, sous la chaussée (décalé en profondeur d'un cran de moins) : 0,4 à 1,1 m de
      // chaque côté, irrégulier ; puis la chaussée, bombée de 1,5 cm au milieu
      poser('terre_battue', cls.off + 1, (s) => w + 1.5 + 0.7 * onde(s, 1), (s) => 0.25 * onde(s, 0.6), cls.y - 0.006, 0, 0.82);
      poser(slug, cls.off, (s) => w * (0.97 + 0.03 * onde(s, 2)), droit, cls.y, 0.015);
    } else if (c.r === 1 && c.k !== 'steps' && !c.surface) {
      // deux ornières de 55 cm, espacées comme les roues d'un tracteur, l'herbe entre les deux
      for (const sg of [-1, 1]) poser('terre_battue', cls.off, (s) => 0.55 + 0.15 * onde(s + sg * 7, 1.5), (s) => sg * (0.8 + 0.06 * onde(s, 0.8)), cls.y, 0, 0.88);
    } else if (c.k !== 'steps') {
      poser(slug, cls.off, (s) => w * (0.7 + 0.55 * (0.5 + 0.5 * onde(s, 1.3))), (s) => 0.3 * onde(s, 0.5), cls.y, 0, 0.92);
    } else poser(slug, cls.off, () => w, droit, cls.y);
    LIEU.rues.push({ pts: d, nom: c.nom, w }); LIEU.rubans.push({ pts: d.map(([x, z]) => [x, hauteur(x, z) + cls.y + (sentier ? 0 : 0.015), z]) });
  }
  for (const [cle, gs] of par) { const [slug, off] = cle.split('|');
    const m = new THREE.Mesh(mergeGeometries(gs), phMat(slug, 1, 1, { color: TEINTE_RUE[slug] || 0xa89c86, roughness: 1, vertexColors: true, polygonOffset: true, polygonOffsetFactor: +off, polygonOffsetUnits: +off }));
    m.receiveShadow = true; scene.add(m); }
  LIEU.nappes.push({ nom: 'rues / relief', ecart: 0.03, decale: true }, { nom: 'rues entre elles (carrefours)', ecart: 0.005, decale: true });
}

// ---------------------------------------------------------------------
//  La lisière : là où l'on ne marche plus (le resserrement du 5 octobre)
// ---------------------------------------------------------------------
// On ne marche plus que sur le lac et ses rives (PLAN.zone, carte/mondes/fondre-relief-aveyron.py).
// La limite est celle du pays : le Ségala est clos de murets de pierre sèche doublés de haies de
// chênes ; un chemin qui sort passe une barrière de pré, fermée, et file dans le bois. Là où la
// limite tombe dans l'eau (le réservoir de Montézic, à l'ouest du barrage), l'eau suffit.
// Au-delà, la grille fine continue sur 60 m (la campagne qu'on voit derrière la haie) : on y
// inscrit une bande que la marche ne passe pas, et arbres() y plante un bois.
function lisiere({ hauteur, scene, PLAN, inscrire, addInteract }) {
  const Z = PLAN.zone; if (!Z) return;
  LIEU.zone = Z;
  const eaux = (PLAN.eau.plans || []).map((p) => p.pts), dansEau = (x, z) => eaux.some((P) => dansPoly(x, z, P));
  // la bande hors zone, en quatre rectangles : bloque() de monde.js la refuse désormais
  const L = 400;
  for (const P of [[[Z.x0 - L, Z.z0 - L], [Z.x0, Z.z0 - L], [Z.x0, Z.z1 + L], [Z.x0 - L, Z.z1 + L]], [[Z.x1, Z.z0 - L], [Z.x1 + L, Z.z0 - L], [Z.x1 + L, Z.z1 + L], [Z.x1, Z.z1 + L]],
    [[Z.x0, Z.z0 - L], [Z.x1, Z.z0 - L], [Z.x1, Z.z0], [Z.x0, Z.z0]], [[Z.x0, Z.z1], [Z.x1, Z.z1], [Z.x1, Z.z1 + L], [Z.x0, Z.z1 + L]]])
    inscrire(P, (P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2);
  // les quatre côtés : origine, direction, longueur, normale vers l'extérieur
  const cotes = [[Z.x0, Z.z0, 1, 0, Z.x1 - Z.x0, 0, -1], [Z.x1, Z.z0, 0, 1, Z.z1 - Z.z0, 1, 0], [Z.x1, Z.z1, -1, 0, Z.x1 - Z.x0, 0, 1], [Z.x0, Z.z1, 0, -1, Z.z1 - Z.z0, -1, 0]];
  // où les rues franchissent la limite : une barrière à la place du muret
  const barrieres = [];
  for (const r of LIEU.rues) for (let k = 0; k < r.pts.length - 1; k++) { const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1];
    for (const [ox, oz, dx, dz, l] of cotes) { const sa = (ax - ox) * dz - (az - oz) * dx, sb = (bx - ox) * dz - (bz - oz) * dx; if ((sa < 0) === (sb < 0) || sa === sb) continue;
      const t = sa / (sa - sb), x = ax + (bx - ax) * t, z = az + (bz - az) * t, s = (x - ox) * dx + (z - oz) * dz;
      if (s > -1 && s < l + 1 && !barrieres.some((b) => Math.hypot(b.x - x, b.z - z) < 6)) barrieres.push({ x, z, s, dx, dz, w: r.w + 1.2, nom: r.nom }); } }
  // le muret : des pierres de 2 m posées sur le relief, sauf dans l'eau et au droit des barrières
  const pierres = [], E = 0.45;
  for (const [ox, oz, dx, dz, l, nx, nz] of cotes) for (let s = 1; s < l; s += 2) {
    const x = ox + dx * s + nx * E, z = oz + dz * s + nz * E;
    if (dansEau(x, z) || barrieres.some((b) => Math.hypot(b.x - x, b.z - z) < b.w / 2 + 1)) continue;
    const y = Math.min(hauteur(x - dx, z - dz), hauteur(x + dx, z + dz)), hm = 0.95 + 0.25 * Math.sin(s * 0.37 + ox * 0.01);
    const g = boxG(2.08, hm + 0.6, 0.6 + 0.1 * Math.sin(s * 1.3)); g.rotateY(Math.atan2(-dz, dx)); g.translate(x, y + (hm - 0.6) / 2, z);
    const gn = g.toNonIndexed(); gn.computeVertexNormals(); uvMetres(gn); pierres.push(gn); }
  if (pierres.length) { const m = new THREE.Mesh(mergeGeometries(pierres), phMat('rustic_stone_wall_02', 1, 1, { color: 0x9e968a })); m.castShadow = m.receiveShadow = true; scene.add(m); }
  // les barrières de pré : deux piliers de granit, cinq lisses de bois grisé et une écharpe, fermées
  const gr = phMat('granite_tile_03', 1, 1, { color: 0xbab4a8 }), bo = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x8a7a68 });
  for (const b of barrieres) {
    const y = hauteur(b.x, b.z), g = new THREE.Group(); g.position.set(b.x, y, b.z); g.rotation.y = Math.atan2(-b.dz, b.dx); scene.add(g);
    for (const sx of [-1, 1]) g.add(mesh(boxG(0.5, 1.9, 0.5), gr, sx * (b.w / 2 + 0.25), 0.55, 0));
    for (let k = 0; k < 5; k++) g.add(mesh(boxG(b.w, 0.11, 0.07), bo, 0, 0.3 + k * 0.24, 0));
    for (const sx of [-1, 1]) g.add(mesh(boxG(0.1, 1.15, 0.08), bo, sx * (b.w / 2 - 0.1), 0.78, 0));
    const ec = mesh(boxG(Math.hypot(b.w, 0.96), 0.1, 0.06), bo, 0, 0.78, 0.05); ec.rotation.z = Math.atan2(0.96, b.w); g.add(ec);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    addInteract({ pos: new THREE.Vector3(b.x, y, b.z), r: 3, prompt: () => 'la barrière', fn: () => showMessage('La barrière est fermée au fil de fer. Au-delà, des prés grillés, des bois, et la route qui s’en va.', 5) }); }
  // la haie de chênes, de 2 à 9 m derrière le muret ; arbres() les plante avec le reste
  LIEU.haie = [];
  for (const [ox, oz, dx, dz, l, nx, nz] of cotes) for (let s = 2; s < l; s += 5 + Math.random() * 4) {
    const e = 2 + Math.random() * 7, x = ox + dx * s + nx * e, z = oz + dz * s + nz * e;
    if (!dansEau(x, z) && Math.random() < 0.8) LIEU.haie.push([x, z]); }     // des trous, comme une vraie haie
  LIEU.barrieres = barrieres.map(({ x, z, nom }) => ({ x, z, nom }));
}

// les arbres, plantés APRÈS le bâti et les rues : monde.js les semait avant, jusque dans les maisons
function arbres({ hauteur, scene, PLAN, bloque, CADRE, H0 }) {
  // La végétation du Ségala (le réalisme, 5 octobre) : un seul chêne, partout et à la même taille,
  // faisait un parc. Le pays mêle le chêne (le plus commun), le hêtre dans les creux frais, le
  // bouleau sur les sols maigres de schiste, et les fourrés bas (le charme, faute du genêt et du
  // châtaignier, qui manquent à foret.js) au bord des prés et des murets. Chaque essence a sa taille.
  const ESS = { chene: { h: [8, 14] }, hetre: { h: [12, 19] }, bouleau: { h: [8, 13] }, charme: { h: [5, 8] }, fourre: { h: [1.6, 3.2], de: 'charme' } };
  for (const [k, e] of Object.entries(ESS)) e.geo = especeGeo(e.de || k);
  if (!ESS.chene.geo) return;
  const hasard = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };
  // l'essence d'un arbre isolé ou d'un bois, d'après sa place : le hêtre dans les creux, le bouleau
  // sur les crêtes sèches, le chêne ailleurs
  const essence = (x, z) => { const r = hasard(x, z), creux = hauteur(x, z) - (hauteur(x + 20, z) + hauteur(x - 20, z) + hauteur(x, z + 20) + hauteur(x, z - 20)) / 4;
    if (creux < -1.2 && r < 0.55) return 'hetre'; if (creux > 1.2 && r < 0.4) return 'bouleau'; return r < 0.12 ? 'hetre' : r < 0.2 ? 'bouleau' : r < 0.28 ? 'charme' : 'chene'; };
  const pres = new Set(); for (const r of LIEU.rues) for (let k = 0; k < r.pts.length - 1; k++) { const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let t = 0; t <= n; t++) pres.add(Math.floor((ax + (bx - ax) * t / n) / 4) + ',' + Math.floor((az + (bz - az) * t / n) / 4)); }
  const lac = PLAN.eau && PLAN.eau.lacPlein ? PLAN.eau.lacPlein.pts : null;
  const bois = (PLAN.verdure.bois || []), pos = [];
  const libre = (x, z, r = 3) => !bloque(x, z, r) && !dansUneMaison(x, z, 4) && !pres.has(Math.floor(x / 4) + ',' + Math.floor(z / 4)) && !(lac && dansPoly(x, z, lac)) && Math.hypot(x + 120, z - 135) > 8;
  // l'écart entre deux arbres, tenu par une grille de cases de 4 m (la haie et le bois de la
  // lisière font plus de 2 000 arbres : comparer chacun à tous coûtait trop)
  const cle = (i, j) => i + ',' + j;
  const cases = new Map(), loin = (x, z, e = 4) => { const i = Math.floor(x / 4), j = Math.floor(z / 4);
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (const [px, pz] of cases.get(cle(i + a, j + c)) || []) if (Math.abs(px - x) <= e && Math.abs(pz - z) <= e) return false; return true; };
  const planter = (x, z, sp = essence(x, z), y = null, taille = 1) => { const k = cle(Math.floor(x / 4), Math.floor(z / 4)); if (!cases.has(k)) cases.set(k, []); cases.get(k).push([x, z]); pos.push([x, z, y, sp, taille]); };
  // la lisière (le resserrement du 5 octobre) : la haie derrière le muret, puis le bois de la bande
  // hors zone, où l'on ne marche pas — bloque() y est vrai partout, on n'y regarde que les rues et l'eau
  const Zn = LIEU.zone, dehors = (x, z) => Zn && (x < Zn.x0 || x > Zn.x1 || z < Zn.z0 || z > Zn.z1);
  const eaux = (PLAN.eau.plans || []).map((p) => p.pts), dansEau = (x, z) => eaux.some((P) => dansPoly(x, z, P)) || (lac && dansPoly(x, z, lac));
  const libreDehors = (x, z) => !pres.has(Math.floor(x / 4) + ',' + Math.floor(z / 4)) && !dansEau(x, z);
  // la haie de la lisière : des chênes, et entre eux le fourré
  for (const [x, z] of LIEU.haie || []) if (libreDehors(x, z) && loin(x, z)) planter(x, z, hasard(x, z) < 0.6 ? 'chene' : 'charme');
  for (const [x, z] of LIEU.haie || []) { const xx = x + 2.5 * Math.sin(z), zz = z + 2.5 * Math.cos(x); if (libreDehors(xx, zz) && loin(xx, zz, 2)) planter(xx, zz, 'fourre'); }
  // le bois de la bande, par taches (un bruit de 50 m) : uniforme, il dessinait un cadre vu d'avion
  const tache = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.043 + Math.sin(z * 0.031) * 2) + 0.25 * Math.sin(z * 0.037 + Math.sin(x * 0.029) * 2);
  if (Zn) for (let k = 0, n = 0; k < 8000 && n < 1200; k++) { const x = CADRE.x0 + Math.random() * (CADRE.x1 - CADRE.x0), z = CADRE.z0 + Math.random() * (CADRE.z1 - CADRE.z0);
    if (dehors(x, z) && Math.random() < 0.15 + tache(x, z) && libreDehors(x, z) && loin(x, z)) { planter(x, z); n++; } }
  // l'horizon : la campagne en bocage au-delà de la grille fine, chaque arbre à son altitude
  // (carte/mondes/fondre-relief-aveyron.py, « les arbres de l'horizon ») ; le chêne et le hêtre
  for (const [x, z, y] of (PLAN.horizon && PLAN.horizon.arbres) || []) pos.push([x, z, y - H0 - 0.6, hasard(x, z) < 0.75 ? 'chene' : 'hetre', 1]);
  // les grands arbres des domaines (l'ombre des cours), plus grands que ceux des bois : des arbres
  // de cent ans, qu'on n'a jamais coupés ; et la haie basse du Batut, derrière son muret
  for (const [x, z] of LIEU.ombrages || []) if (loin(x, z, 6)) planter(x, z, hasard(x, z) < 0.5 ? 'chene' : 'hetre', null, 1.35);
  for (const [x, z] of LIEU.haieBatut || []) planter(x, z, 'fourre');
  // la haie basse de l'allée du Pouget : taillée à hauteur de hanche, elle ne cache pas la façade
  for (const [x, z] of LIEU.fourres || []) planter(x, z, 'fourre', null, 0.4);
  const n0 = pos.length;
  for (let k = 0; k < 9000 && pos.length - n0 < 700; k++) { const x = CADRE.x0 + Math.random() * (CADRE.x1 - CADRE.x0), z = CADRE.z0 + Math.random() * (CADRE.z1 - CADRE.z0); if (dehors(x, z)) continue;
    const dans = bois.some((b) => dansPoly(x, z, b.pts));
    if ((dans ? Math.random() < 0.6 : Math.random() < 0.012) && libre(x, z) && loin(x, z)) planter(x, z); }
  // les fourrés au bord des rues et des chemins, là où la faux ne passe pas
  for (const r of LIEU.rues) for (let k = 0; k < r.pts.length; k += 14) { const [x, z] = r.pts[k], [xb, zb] = r.pts[Math.min(r.pts.length - 1, k + 1)], l = Math.hypot(xb - x, zb - z) || 1;
    if (hasard(x, z) > 0.45) continue; const sg = hasard(z, x) < 0.5 ? -1 : 1, e = (r.w || 3) / 2 + 2.2, px = x - (zb - z) / l * e * sg, pz = z + (xb - x) / l * e * sg;
    if (!dehors(px, pz) && libre(px, pz, 1.2) && loin(px, pz, 2.5)) planter(px, pz, 'fourre'); }
  // une InstancedMesh par essence : le tronc et le houppier
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (const [nom, e] of Object.entries(ESS)) { if (!e.geo) continue; const mien = pos.filter((p) => p[3] === nom); if (!mien.length) continue;
    const tr = new THREE.InstancedMesh(e.geo.tronc, e.geo.matT, mien.length), hp = new THREE.InstancedMesh(e.geo.houppier, e.geo.matH, mien.length);
    mien.forEach(([x, z, y, , taille], k) => { const h = (e.h[0] + hasard(x, z) * (e.h[1] - e.h[0])) * taille, l = nom === 'fourre' ? 1.5 : 1; q.setFromAxisAngle(Y, hasard(z, x) * 6.283);
      sc.set(h * l * (0.85 + hasard(x + 1, z) * 0.35), h, h * l * (0.85 + hasard(x, z + 1) * 0.35)); m4.compose(v.set(x, y ?? hauteur(x, z) - 0.2, z), q, sc); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
    tr.castShadow = hp.castShadow = true; scene.add(tr, hp); LIEU.essences = { ...(LIEU.essences || {}), [nom]: mien.length }; }
}

// ---------------------------------------------------------------------
//  Le bourg de Saint-Symphorien-de-Thénières
// ---------------------------------------------------------------------
// Depuis le resserrement du 5 octobre, le bourg n'est plus dans la zone jouable (STORY.md ne le
// nomme pas ; Eugène : « seulement au loin ») : le clocher, le marronnier et le four ne trouvent
// plus rien à bâtir dans le plan joué. Restent les FONTAINES, dont celle du lac. Le code reste,
// pour la version complète (carte/mondes/complet/).
// Les maisons viennent d'OSM (monde.js les bâtit) ; on y ajoute ce qu'OSM ne dessine pas.
// - le CLOCHER : la nef est dans OSM, pas son clocher. Une tour carrée sous un pavillon de tuiles au
//   bout ouest de la nef, le clocher le plus courant du Ségala — à reprendre sur une photo de
//   l'église (docs/BESOINS-HISTOIRE.md) ;
// - le MARRONNIER de la place qui porte son nom ;
// - le FOUR banal : OSM n'a que la « Rue du Four » (carte/mondes/README.md) ; on le pose au
//   bord de cette rue, sur la première place libre ;
// - les FONTAINES d'OSM, à sec.
function bourg({ hauteur, scene, PLAN, bloque, inscrire, addInteract }) {
  const libre = (x, z, r) => !bloque(x, z, r) && [[r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => !bloque(x + a, z + b, 0.3));
  const rect = (cx, cz, a, l, w) => { const ux = Math.cos(a), uz = Math.sin(a); return [[-l, -w], [l, -w], [l, w], [-l, w]].map(([p, q]) => [cx + p / 2 * ux - q / 2 * uz, cz + p / 2 * uz + q / 2 * ux]); };
  const ombres = (g) => g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ---- le clocher ----
  const eg = (PLAN.bati || PLAN.batiments).find((b) => b.k === 'church' && /Symphorien/.test(b.nom || ''));
  if (eg) {
    const P = eg.pts, cx = P.reduce((t, p) => t + p[0], 0) / P.length, cz = P.reduce((t, p) => t + p[1], 0) / P.length;
    let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
    let a = 0.5 * Math.atan2(2 * sxz, sxx - szz); if (Math.cos(a) > 0) a += Math.PI;          // l'axe de la nef, tourné vers l'ouest
    let bout = 0; for (const [x, z] of P) bout = Math.max(bout, (x - cx) * Math.cos(a) + (z - cz) * Math.sin(a));
    const tx = cx + Math.cos(a) * (bout - 2), tz = cz + Math.sin(a) * (bout - 2), T = 5.2, HT = 17;
    const y = Math.min(...rect(tx, tz, a, T, T).map(([x, z]) => hauteur(x, z)));
    const g = new THREE.Group(); g.position.set(tx, y, tz); g.rotation.y = -a; scene.add(g);
    pose(g, boite(T, HT + 3, T, 'stone_wall', { color: 0xa8a090 }), 0, (HT - 3) / 2, 0);
    // les abat-sons : une baie géminée sur chaque face, sous la flèche
    for (let k = 0; k < 4; k++) { const f = new THREE.Group(); pose(g, f, 0, HT - 2.2, 0, k * Math.PI / 2);
      for (const sx of [-0.7, 0.7]) { f.add(mesh(boxG(0.9, 2.0, 0.3), new THREE.MeshStandardMaterial({ color: 0x0f0d0b, roughness: 1 }), sx, 0, T / 2 - 0.1));
        f.add(mesh(boxG(1.1, 0.2, 0.4), phMat('granite_tile_03', 1.1, 0.2, { color: 0xbab4a8 }), sx, 1.1, T / 2)); } }
    pose(g, boite(T + 0.5, 0.4, T + 0.5, 'granite_tile_03', { color: 0xbab4a8 }), 0, HT, 0);               // la corniche
    const fl = new THREE.Mesh(new THREE.ConeGeometry(T * 0.78, 2.4, 4, 1, true), TUILE(T * 1.6, 3.2));
    fl.rotation.y = Math.PI / 4; pose(g, fl, 0, HT + 0.2 + 1.2, 0);
    pose(g, mesh(boxG(0.08, 1.6, 0.08), phMat('metal_plate_02', 0.2, 1.6, { color: 0x2e2b28 })), 0, HT + 3.3, 0);
    pose(g, mesh(boxG(0.8, 0.08, 0.08), phMat('metal_plate_02', 0.8, 0.1, { color: 0x2e2b28 })), 0, HT + 3.6, 0);
    ombres(g); inscrire(rect(tx, tz, a, T, T), tx, tz);
    addInteract({ pos: new THREE.Vector3(cx, y, cz), r: 12, prompt: () => 'l’église de Saint-Symphorien', fn: () => showMessage('L’église de Saint-Symphorien. Sur la porte, une affiche à demi effacée : « Prières pour la pluie, chaque dimanche ».', 6) });
  }

  // ---- le marronnier de la place ----
  const place = (PLAN.lieux || []).find((l) => l.k === 'place' && /Marronnier/.test(l.nom || ''));
  const esp = especeGeo('hetre');
  if (place && esp) {
    let pos = null;
    for (let r = 0; r < 30 && !pos; r += 1.5) for (let k = 0; k < 16 && !pos; k++) { const x = place.x + Math.cos(k / 16 * 6.283) * r, z = place.z + Math.sin(k / 16 * 6.283) * r; if (libre(x, z, 5)) pos = [x, z]; }
    if (pos) { const [x, z] = pos, h = 17, o = new THREE.Group(); o.position.set(x, hauteur(x, z) - 0.2, z); o.scale.set(h * 1.6, h, h * 1.6); scene.add(o);
      // le feuillage roussi par la sécheresse : une COPIE de la matière, celle des forêts reste verte
      const feuilles = esp.matH.clone(); feuilles.color = feuilles.color.clone().multiply(new THREE.Color(0xd8a060));
      o.add(new THREE.Mesh(esp.tronc, esp.matT), new THREE.Mesh(esp.houppier, feuilles)); ombres(o);
      // un banc de pierre au pied, l'ombre la plus recherchée du bourg
      const banc = boite(2.4, 0.45, 0.6, 'granite_tile_03', { color: 0xbab4a8 }); banc.position.set(x + 2.6, hauteur(x + 2.6, z) + 0.22, z); scene.add(banc);
      inscrire(Array.from({ length: 8 }, (_, k) => [x + Math.cos(k / 8 * 6.283) * 0.8, z + Math.sin(k / 8 * 6.283) * 0.8]), x, z);
      addInteract({ pos: new THREE.Vector3(x, hauteur(x, z), z), r: 6, prompt: () => 'la place du Marronnier', fn: () => showMessage('La place du Marronnier. Ses feuilles sont déjà rousses, en plein été.', 5) }); }
  }

  // ---- le four banal, au bord de la rue du Four ----
  const rue = (PLAN.rues || PLAN.routes || []).find((r) => r.nom === 'Rue du Four');
  if (rue) {
    let lieu = null;
    for (let k = rue.pts.length - 2; k >= 0 && !lieu; k--) {             // en partant du bas, près de la place
      const [ax, az] = rue.pts[k], [bx, bz] = rue.pts[k + 1], a = Math.atan2(bz - az, bx - ax), n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3));
      for (let t = 0; t <= n && !lieu; t++) for (const cote of [1, -1]) {
        const x = ax + (bx - ax) * t / n - Math.sin(a) * 6.5 * cote, z = az + (bz - az) * t / n + Math.cos(a) * 6.5 * cote;
        if (rect(x, z, a, 7, 6).every(([p, q]) => !bloque(p, q, 0.3)) && !bloque(x, z, 0.3)) { lieu = [x, z, a, cote]; break; } } }
    if (lieu) {
      const [x, z, a, cote] = lieu, y = Math.min(...rect(x, z, a, 6, 4.5).map(([p, q]) => hauteur(p, q)));
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = -a + (cote > 0 ? Math.PI : 0); scene.add(g);
      pose(g, boite(6, 3.4 + 2, 4.5, 'stone_wall', { color: 0xa09888 }), 0, (3.4 - 2) / 2, 0);
      const lz = TUILE(1, 1);
      for (const sg of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.75), TUILE(6.8, 2.75)); p.rotation.x = -Math.PI / 2 + sg * 0.29; p.position.set(0, 3.4 + 0.33, sg * 1.25); g.add(p); }
      // l'abside du four, ronde, sous son chapeau de tuiles, à l'arrière
      pose(g, new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 2.6 + 2, 16, 1, false, 0, Math.PI), phMat('stone_wall', 6, 4.6, { color: 0x9a9284 })), 0, (2.6 - 2) / 2, -2.25, -Math.PI / 2);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 8, 0, Math.PI, 0, Math.PI / 2), lz); cap.scale.y = 0.6; pose(g, cap, 0, 2.6, -2.25, -Math.PI / 2);
      // la porte du fournil, et la gueule du four, noire de suie
      pose(g, mesh(boxG(1.3, 2.2, 0.15), phMat('wood_cabinet_worn_long', 1.3, 2.2, { color: 0x5a4030 }), 0, 1.1, 2.27));
      pose(g, mesh(boxG(1.8, 0.25, 0.4), phMat('granite_tile_03', 1.8, 0.25, { color: 0xbab4a8 }), 0, 2.35, 2.3));
      ombres(g); inscrire(rect(x, z, a, 6.6, 4.8), x, z);
      addInteract({ pos: new THREE.Vector3(x, y, z), r: 5, prompt: () => 'le four du village', fn: () => showMessage('Le four banal. Froid : sans eau, plus personne ne pétrit.', 5) });
    }
  }

  // ---- les fontaines, à sec ----
  for (const l of (PLAN.lieux || []).filter((l) => l.k === 'fontaine')) {
    // le point d'OSM tombe parfois entre deux murs (la fontaine de la rue des Fontaines était
    // enfermée : banc du lieu) — on la pose au bord de la rue la plus proche, du côté libre
    let { x, z } = l, best = null;
    for (const r of LIEU.rues) for (const [px, pz] of r.pts) { const d = Math.hypot(px - x, pz - z); if (d < 25 && (!best || d < best[2])) best = [px, pz, d]; }
    if (best) { let ok = false; const surRue = (cx, cz) => LIEU.rues.some((r) => r.pts.some(([px, pz]) => Math.hypot(px - cx, pz - cz) < 3.6));
      for (const rr of [4.5, 6, 7.5]) for (let a = 0; a < 6.283 && !ok; a += 0.39) { const cx = best[0] + Math.cos(a) * rr, cz = best[1] + Math.sin(a) * rr; if (!bloque(cx, cz, 1.9) && !surRue(cx, cz)) { x = cx; z = cz; ok = true; } } if (!ok) continue; }
    else if (bloque(x, z, 1.6)) continue;
    const y = hauteur(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    g.add(mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.8, 8, 1, true), phMat('stone_wall', 9.5, 0.8, { color: 0xa8a090, side: THREE.DoubleSide }), 0, 0.4, 0));
    const fond = new THREE.Mesh(new THREE.CircleGeometry(1.45, 8), phMat('mud_cracked_dry_03', 3, 3, { color: 0xc8baa4 })); fond.rotation.x = -Math.PI / 2; fond.position.y = 0.15; g.add(fond);
    g.add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.8, 8), phMat('granite_tile_03', 1.6, 1.8, { color: 0xbab4a8 }), 0, 0.9, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), phMat('metal_plate_02', 0.2, 0.4, { color: 0x6a5a40 }), 0, 1.45, 0.3));
    ombres(g); inscrire(Array.from({ length: 8 }, (_, k) => [x + Math.cos(k / 8 * 6.283) * 1.6, z + Math.sin(k / 8 * 6.283) * 1.6]), x, z);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 3, prompt: () => 'la fontaine', fn: () => showMessage('La fontaine ne coule plus. Le fond du bassin s’est fendu au soleil.', 5) });
  }
}

// ---------------------------------------------------------------------
//  La grande sécheresse
// ---------------------------------------------------------------------
// « Les rivières sont à sec. L'eau est la richesse. » (STORY.md, acte II). Le lac est à l'étiage
// (carte/mondes/fondre-relief-aveyron.py a creusé sa cuvette et ne garde que l'eau de plus de
// 4 m de fond) : tout ce que l'eau a quitté devient une GRÈVE de boue fendue, posée sur le relief
// maille par maille ; les ruisseaux ne sont plus que des lits de cailloux.
function secheresse({ hauteur, scene, PLAN }) {
  const plein = PLAN.eau && PLAN.eau.lacPlein; if (!plein) return;
  const P = plein.pts, dans = (x, z) => { let d = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const rive = (x, z) => { let b = null, bd = 1e9;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)), px = ax + t * dx, pz = az + t * dz, d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; b = [px, pz]; } } return b; };
  // la grève : les mailles de 3 m dont un coin est dans le lac plein ; UV en mètres
  const S = 3, pos = [], uv = [];
  for (let x = x0 - S; x < x1 + S; x += S) for (let z = z0 - S; z < z1 + S; z += S) {
    if (!(dans(x, z) || dans(x + S, z) || dans(x, z + S) || dans(x + S, z + S))) continue;
    // un coin hors du lac plein est ramené sur sa rive : sans cela, le bord de la grève faisait des
    // marches de 3 m, très visibles en plongée (planche du regard, 5 octobre)
    const c = [[x, z], [x + S, z], [x + S, z + S], [x, z + S]].map(([a, b]) => dans(a, b) ? [a, b] : rive(a, b)).map(([a, b]) => [a, hauteur(a, b) + 0.05, b]);
    for (const k of [0, 3, 1, 1, 3, 2]) { pos.push(...c[k]); uv.push(c[k][0] / 2, c[k][2] / 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const greve = new THREE.Mesh(g, phMat('mud_cracked_dry_03', 2, 2, { color: 0xc8baa4, polygonOffset: true, polygonOffsetFactor: -1 }));
  greve.receiveShadow = true; scene.add(greve);
  // les lits à sec : un ruban de cailloux là où couraient les ruisseaux
  const lits = (PLAN.eau.lits || []).map((c) => {
    const p = [], u = []; let l = 0; const pts = c.pts;
    for (let k = 0; k < pts.length; k++) { const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
      let dx = xb - xa, dz = zb - za; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n; if (k) l += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
      for (const sg of [-1, 1]) { const px = x - dz * 1.1 * sg, pz = z + dx * 1.1 * sg; p.push(px, hauteur(px, pz) + 0.12, pz); u.push(sg, l / 2); } }
    const idx = []; for (let k = 0; k < pts.length - 1; k++) { const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }   // faces vers le ciel
    const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); gl.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); gl.setIndex(idx); gl.computeVertexNormals(); return gl.toNonIndexed(); });
  for (const gl of lits) { const m = new THREE.Mesh(gl, phMat('rocks_ground_08', 2, 2, { color: 0xb8a890, polygonOffset: true, polygonOffsetFactor: -2 })); m.receiveShadow = true; scene.add(m); }
}

// ---------------------------------------------------------------------
//  La source des Vergnes (le jouable, 5 octobre)
// ---------------------------------------------------------------------
// Un repère de la minicarte ne doit pas pointer vers le vide : à la source posée par Eugène (carte/
// mondes/README.md, « bouchée par la bande, le lac baisse »), un griffon de pierre sèche à demi
// enterré dans la pente, sa bouche murée de pierres entassées, et le lit à sec qui en part.
// STORY.md (« Les sources : rouvrir des sources bouchées par la bande ») : on la MONTRE bouchée,
// la quête n'est pas écrite ici.
function source({ hauteur, scene, inscrire, addInteract, bloque }) {
  let [x, z] = [470, 440];
  for (let r = 0; r < 20 && bloque(x, z, 1.6); r += 1) for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; if (!bloque(470 + Math.cos(a) * r, 440 + Math.sin(a) * r, 1.6)) { x = 470 + Math.cos(a) * r; z = 440 + Math.sin(a) * r; break; } }
  // tournée vers le bas de la pente : la source sort du coteau
  const gx = hauteur(x + 1, z) - hauteur(x - 1, z), gz = hauteur(x, z + 1) - hauteur(x, z - 1), rot = Math.atan2(-gx, -gz);
  const y = hauteur(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; scene.add(g);
  const pierre = phMat('rustic_stone_wall_02', 1, 1, { color: 0x9e968a });
  pose(g, boite(2.6, 2.2, 2.0, 'rustic_stone_wall_02', { color: 0x9e968a }), 0, 0.5, -0.6);                 // le griffon, à demi dans la pente
  pose(g, boite(1.2, 0.18, 0.5, 'granite_tile_03', { color: 0xbab4a8 }), 0, 1.15, 0.45);                     // le linteau de la bouche
  for (let k = 0; k < 9; k++) { const r = 0.22 + 0.12 * ((k * 37) % 5) / 5, p = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), pierre);
    p.position.set(-0.45 + (k % 3) * 0.45, 0.15 + Math.floor(k / 3) * 0.32, 0.55 + 0.1 * (k % 2)); p.rotation.set(k, k * 2, 0); g.add(p); }      // la bouche murée
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const c = Math.cos(rot), sn = Math.sin(rot), m = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  inscrire([[-1.3, -1.6], [1.3, -1.6], [1.3, 0.9], [-1.3, 0.9]].map(([a, b]) => m(a, b)), x, z);
  const [fx, fz] = m(0, 2.2);
  addInteract({ pos: new THREE.Vector3(fx, hauteur(fx, fz), fz), r: 3, prompt: () => 'la source des Vergnes', fn: () => showMessage('La source des Vergnes. Sa bouche est murée de pierres entassées, trop bien rangées pour être tombées seules.', 6) });
  LIEU.source = [x, z];
}

// ---------------------------------------------------------------------
//  Le barrage, le ponton, les barques : le lac qui se retire (5 octobre)
// ---------------------------------------------------------------------
// Le barrage n'était qu'une route entre deux eaux. C'est un ouvrage de béton : la route passe sur
// sa crête entre deux parapets, et le duel de STORY.md s'y joue « entre l'eau et le vide »
// (carte/mondes/README.md). Une maisonnette de vanne à son bout nord, celle du garde.
function barrage({ hauteur, scene, PLAN, inscrire, addInteract }) {
  const B = PLAN.eau.barrages && PLAN.eau.barrages[0]; if (!B) return;
  const beton = phMat('enduit_gris', 1, 1, { color: 0xc8c6be }), pieces = [];
  // les tronçons de rue posés sur le barrage : des parapets de part et d'autre
  for (const r of LIEU.rues) { let run = [];
    const finir = () => { if (run.length > 4) for (const sg of [-1, 1]) for (let k = 0; k < run.length - 1; k += 2) {
      const [ax, az] = run[k], [bx, bz] = run[Math.min(run.length - 1, k + 2)], l = Math.hypot(bx - ax, bz - az); if (l < 0.3) continue;
      const nx = -(bz - az) / l, nz = (bx - ax) / l, e = (r.w || 4.5) / 2 + 0.45, x = (ax + bx) / 2 + nx * e * sg, z = (az + bz) / 2 + nz * e * sg, y = hauteur(x, z);
      // au carrefour du bout du barrage, le parapet s'ouvre : il barrait la route du Moulin du Prieur (banc)
      if (LIEU.rues.some((o) => o !== r && o.pts.some(([px, pz]) => Math.abs(px - x) < 6 && Math.hypot(px - x, pz - z) < (o.w || 3) / 2 + 1.2))) continue;
      const g = boxG(l + 0.04, 1.0 + 0.6, 0.35); g.rotateY(Math.atan2(-(bz - az), bx - ax)); g.translate(x, y + 0.2, z); const gn = g.toNonIndexed(); gn.computeVertexNormals(); uvMetres(gn); pieces.push(gn);
      inscrire([[ax + nx * (e - 0.25) * sg, az + nz * (e - 0.25) * sg], [bx + nx * (e - 0.25) * sg, bz + nz * (e - 0.25) * sg], [bx + nx * (e + 0.25) * sg, bz + nz * (e + 0.25) * sg], [ax + nx * (e + 0.25) * sg, az + nz * (e + 0.25) * sg]], x, z); }
      run = []; };
    for (const p of r.pts) { if (dansPoly(p[0], p[1], B.pts)) run.push(p); else finir(); } finir(); }
  if (pieces.length) { const m = new THREE.Mesh(mergeGeometries(pieces), beton); m.castShadow = m.receiveShadow = true; scene.add(m); }
  // la maisonnette de vanne, au bout nord, hors de la route
  let best = null; for (const [x, z] of B.pts) if (!best || z < best[1]) best = [x, z];
  // à l'écart des rues (posée 6 m à l'ouest du bout du barrage, elle tombait sur la route : banc) et hors de l'eau
  const eaux = (PLAN.eau.plans || []).map((p) => p.pts), loinDesRues = (x, z) => !LIEU.rues.some((o) => o.pts.some(([px, pz]) => Math.abs(px - x) < 9 && Math.hypot(px - x, pz - z) < (o.w || 3) / 2 + 3));
  if (best) { let p = null; for (let r = 4; r < 30 && !p; r += 2) for (let k = 0; k < 16; k++) { const x = best[0] + Math.cos(k / 16 * 6.283) * r, z = best[1] + Math.sin(k / 16 * 6.283) * r; if (loinDesRues(x, z) && !eaux.some((P) => dansPoly(x, z, P)) && !dansPoly(x, z, B.pts)) { p = [x, z]; break; } }
    best = p; }
  if (best) { const [x, z] = best;
    const y = hauteur(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    pose(g, boite(3.2, 2.8 + 1, 2.6, 'enduit_gris', { color: 0xc8c6be }), 0, (2.8 - 1) / 2, 0);
    const t = new THREE.ConeGeometry(2.6, 1.3, 4, 1, true); t.rotateY(Math.PI / 4); t.scale(1.15, 1, 0.95); pose(g, new THREE.Mesh(t, TUILE(1, 1)), 0, 2.8 + 0.65, 0);
    pose(g, mesh(boxG(0.9, 1.9, 0.08), phMat('metal_plate_02', 0.9, 1.9, { color: 0x5a6a68 })), 0, 0.95, 1.33);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    inscrire([[x - 1.6, z - 1.3], [x + 1.6, z - 1.3], [x + 1.6, z + 1.3], [x - 1.6, z + 1.3]], x, z);
    addInteract({ pos: new THREE.Vector3(x, y, z + 2), r: 3, prompt: () => 'la maisonnette de la vanne', fn: () => showMessage('La vanne est fermée, et la chaîne cadenassée. On garde ce qu’il reste d’eau.', 5) }); }
}
// le ponton de la baignade, resté au-dessus de la boue, et les barques échouées sur la grève
function grevesEchouees({ hauteur, scene, PLAN, inscrire, addInteract }) {
  const plein = PLAN.eau.lacPlein && PLAN.eau.lacPlein.pts, etiage = (PLAN.eau.plans || []).filter((p) => /tiage/.test(p.nom || '')).map((p) => p.pts); if (!plein) return;
  const bois = phMat('wood_planks', 1, 1, { color: 0x8a7a66 }), pieux = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x5a4a3a });
  // le ponton : un platelage de 1,8 m à hauteur du lac plein (60 cm au-dessus), sur des pieux qui
  // descendent jusqu'à la vase ; ses pieux sont des collisions, on passe dessous
  for (const pt of PLAN.ponts || []) { if (pt.k !== 'pier') continue; const [[ax, az], [bx, bz]] = pt.pts, l = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax), yp = (PLAN.eau.lacPlein.niveau || 702.9) - 702.9 + 0.6;
    const g = new THREE.Group(); g.position.set(ax, 0, az); g.rotation.y = ang; scene.add(g);
    g.add(mesh(boxG(l + 2, 0.1, 1.8), bois, (l + 2) / 2 - 1, yp, 0));
    for (let s = 0; s <= l + 1; s += 2) for (const sz of [-0.8, 0.8]) { const wx = ax + Math.cos(ang) * s + Math.sin(ang) * sz, wz = az - Math.sin(ang) * s + Math.cos(ang) * sz, yb = hauteur(wx, wz) - 0.3;
      g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, yp - yb, 6), pieux, s, (yp + yb) / 2, sz)); inscrire(Array.from({ length: 6 }, (_, k) => [wx + Math.cos(k) * 0.2, wz + Math.sin(k) * 0.2]), wx, wz); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
  // les barques : dans la vase, entre 3 et 15 m de l'eau qui reste
  const dEau = (x, z) => { let b = 1e9; for (const P of etiage) for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)); b = Math.min(b, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return b; };
  const vase = (x0, z0) => { for (let r = 0; r < 40; r += 2) for (let k = 0; k < 16; k++) { const x = x0 + Math.cos(k / 16 * 6.283) * r, z = z0 + Math.sin(k / 16 * 6.283) * r, d = dEau(x, z);
    if (dansPoly(x, z, plein) && !etiage.some((P) => dansPoly(x, z, P)) && d > 3 && d < 15) return [x, z]; } return null; };
  const coque = () => { const pos = [], idx = [], uv = [], NL = 12, NS = 8, L = 4.2, W = 1.3, D = 0.55;
    for (let i = 0; i <= NL; i++) { const t = -1 + 2 * i / NL, lw = W / 2 * Math.sqrt(Math.max(0, 1 - t * t * 0.92)), tonture = 0.12 * t * t;
      for (let j = 0; j <= NS; j++) { const a = Math.PI * j / NS; pos.push(t * L / 2, D + tonture - Math.sin(a) * D * Math.sqrt(1 - t * t * 0.5), -Math.cos(a) * lw); uv.push(t * L / 2, j / NS * 1.6); } }
    for (let i = 0; i < NL; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j; idx.push(a, a + 1, a + NS + 1, a + 1, a + NS + 2, a + NS + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const geoC = coque(), peinte = [0x6a8a9a, 0x9a5a40, 0x7a8a6a];
  [[-215, -300], [-55, 100], [210, 205], [120, -230]].forEach(([x0, z0], k) => { const p = vase(x0, z0); if (!p) return; const [x, z] = p;
    const b = new THREE.Group(), a = k * 1.7 + 0.4; b.position.set(x, hauteur(x, z) - 0.15, z); b.rotation.set(0, a, 0.12 * (k % 2 ? 1 : -1)); scene.add(b);
    b.add(new THREE.Mesh(geoC, phMat('wood_planks', 4.2, 1.6, { color: peinte[k % 3], side: THREE.DoubleSide })));
    for (const t of [-0.6, 0.5]) b.add(mesh(boxG(0.22, 0.05, 1.1), bois, t, 0.42, 0));                               // les bancs de nage
    const rame = mesh(boxG(2.4, 0.05, 0.1), pieux, 0.2, 0.5, 0.35); rame.rotation.y = 0.1; b.add(rame);                  // une rame
    b.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    inscrire(Array.from({ length: 8 }, (_, i) => { const t = i / 8 * 6.283; return [x + Math.cos(t) * 2.1 * Math.cos(a) + Math.sin(t) * 0.6 * Math.sin(a), z - Math.cos(t) * 2.1 * Math.sin(a) + Math.sin(t) * 0.6 * Math.cos(a)]; }), x, z);
    if (k === 1) addInteract({ pos: new THREE.Vector3(x, hauteur(x, z), z), r: 3, prompt: () => 'la barque', fn: () => showMessage('Une barque posée dans la vase, à dix mètres de l’eau. On l’avait amarrée au bord.', 5) }); });
}
// les brebis : l'Aveyron est le pays de la brebis (la Lacaune, celle du Roquefort). Il en reste
// peu dans les prés : STORY.md, « nos bêtes disparaissent, une à une ». Le modèle est celui du
// Pouget de Lozère (« Animated Sheep » d'igor-lir, CC BY 4.0, assets_back/_licences/), chargé ici
// comme le font les chevaux : immobile, en instances.
async function troupeaux({ hauteur, scene, bloque, PLAN }) {
  let modele = null;
  try { const [L] = await Promise.all([import('./lib/addons/loaders/GLTFLoader.js')]); const g = await new L.GLTFLoader().loadAsync('assets_back/02_personnages/animaux/brebis.glb');
    let m = null; g.scene.updateMatrixWorld(true); g.scene.traverse((o) => { if (o.isMesh && !m) m = o; });
    const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); geo.computeBoundingBox(); const b = geo.boundingBox, k = 1.2 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.scale(k, k, k); m.material.roughness = 1; m.material.metalness = 0; modele = { geo, mat: m.material }; } catch (e) { return; }
  const lac = PLAN.eau.lacPlein ? PLAN.eau.lacPlein.pts : [], ps = [], h01 = (a, b) => { const v = Math.sin(a * 91.7 + b * 47.3) * 43758.5453; return v - Math.floor(v); };
  // un petit groupe derrière chaque domaine (là où était le troupeau), et deux brebis égarées
  for (const [cx, cz, n] of [...DOMAINES.map((d) => [d.pre[0], d.pre[1], 5]), [330, -60, 2], [-60, -300, 2]])
    for (let k = 0, m = 0; k < 80 && m < n; k++) { const a = h01(k, cx), r = 1.5 + h01(cz, k) * 9, x = cx + Math.cos(a * 6.283) * r, z = cz + Math.sin(a * 6.283) * r;
      if (bloque(x, z, 0.8) || dansUneMaison(x, z, 2) || (lac.length && dansPoly(x, z, lac)) || ps.some((p) => Math.hypot(p[0] - x, p[1] - z) < 1.4)) continue; ps.push([x, z, h01(x, z) * 6.283]); m++; }
  const im = new THREE.InstancedMesh(modele.geo, modele.mat, ps.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  ps.forEach(([x, z, a], k) => { const e = 0.9 + h01(z, x) * 0.18; q.setFromAxisAngle(Y, a); m4.compose(new THREE.Vector3(x, hauteur(x, z) - 0.03, z), q, s.set(e, e, e)); im.setMatrixAt(k, m4); });
  im.castShadow = im.receiveShadow = true; scene.add(im); LIEU.brebis = ps.length;
}

// ---------------------------------------------------------------------
//  Les habitants : les Roquette à cheval, l'aïeule, le bourg
// ---------------------------------------------------------------------
// Les chevaux de la banque (Quaternius, CC0) se chargent ici comme dans tloc-multi.js, dont le
// chargeur est privé : mêmes fichiers, même lissage des facettes, même hauteur de 2,35 unités
// de Lille — puis l'échelle des gens du lieu (G.echelle), pour qu'un cavalier tienne en selle.
// SELLE et SELLE_AV : ceux de tloc-multi.js (la pose assise posée au creux du dos).
const SELLE = 0.62, SELLE_AV = -0.1;
const chevaux = [], gens = [];
let tAvant = 0, camDedans = false;
const modeles = new Map();
function chargerCheval(fichier) {
  if (!modeles.has(fichier)) modeles.set(fichier, Promise.all([import('./lib/addons/loaders/GLTFLoader.js'), import('./lib/addons/utils/SkeletonUtils.js'), import('./lib/addons/utils/BufferGeometryUtils.js')])
    .then(([L, S, U]) => new L.GLTFLoader().loadAsync('assets_back/02_personnages/animaux/' + fichier + '?v=2').then((g) => {
      g.scene.traverse((o) => { if (!o.isSkinnedMesh) return; let ge = o.geometry.clone(); ge.deleteAttribute('normal'); ge = U.mergeVertices(ge, 1e-4); ge.computeVertexNormals(); o.geometry = ge;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m.flatShading = false; m.roughness = 0.82; m.metalness = 0; m.needsUpdate = true; } });
      g.scene.updateMatrixWorld(true);
      const b = new THREE.Box3(); g.scene.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); b.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
      return { g, S, echelle: 2.35 / (b.max.y - b.min.y) };
    })).catch(() => null));
  return modeles.get(fichier);
}
async function cheval(scene, fichier, x, y, z, yaw, clip) {
  const m = await chargerCheval(fichier); if (!m) return null;
  const c = m.S.clone(m.g.scene); c.scale.setScalar(m.echelle * G.echelle);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  c.position.set(x, y, z); c.rotation.y = yaw; scene.add(c);
  const mix = new THREE.AnimationMixer(c), a = m.g.animations.find((k) => k.name === clip) || m.g.animations.find((k) => k.name === 'Idle');
  if (a) { const act = mix.clipAction(a); act.time = Math.random() * a.duration; act.play(); }
  chevaux.push(mix); return c;
}
function personne(scene, role, x, y, z, yaw) {
  const g = PNJ.buildRole(role); if (!g) return null;
  g.scale.setScalar(G.echelle); g.position.set(x, y, z); g.rotation.y = yaw; scene.add(g); gens.push(g); return g;
}
function habitants({ hauteur, scene, inscrire, addInteract, bloque, PLAN }) {
  const devant = (X, Z, rot, d, cote = 0) => [X + Math.sin(rot) * d + Math.cos(rot) * cote, Z + Math.cos(rot) * d - Math.sin(rot) * cote];
  const rond = (x, z, r) => inscrire(Array.from({ length: 8 }, (_, k) => [x + Math.cos(k / 8 * 6.283) * r, z + Math.sin(k / 8 * 6.283) * r]), x, z);
  // un cavalier Roquette devant le portail de sa maison, le cheval tourné vers le lac
  const cavalier = (role, fichier, X, Z, mots) => {
    const rot = Math.atan2(-X, -Z), [x, z] = devant(X, Z, rot, MAISON.W / 2 + MAISON.cour + 5, 3), y = hauteur(x, z);
    cheval(scene, fichier, x + Math.sin(rot) * SELLE_AV * G.echelle, y, z + Math.cos(rot) * SELLE_AV * G.echelle, rot, 'Idle');
    personne(scene, role, x, y + SELLE * G.echelle, z, rot);
    rond(x, z, 1.4);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 4, prompt: () => 'parler au cavalier', fn: () => dialogue(mots) });
  };
  // STORY.md, acte II : « Beauregard accuse le Batut. Le Batut accuse Beauregard. »
  cavalier('roquette_batut', 'cheval.glb', -135, 170, [
    { who: 'Le Batut', text: 'Tu viens de l’île ? Alors tu ne sais pas. Il n’y a plus d’eau que dans ce lac.' },
    { who: 'Le Batut', text: 'Et nos bêtes disparaissent, une à une. Beauregard nous les prend, et il nous accuse de garder l’eau.' }]);
  cavalier('roquette_beauregard', 'cheval_blanc.glb', 400, 150, [
    { who: 'Beauregard', text: 'D’ici, on voit tout le lac. Et on voit le Batut, de l’autre côté, qui le garde pour lui.' },
    { who: 'Beauregard', text: 'Nos troupeaux fondent comme l’eau. Ce sont eux, j’en suis sûr.' }]);
  // l'aïeule, sur le seuil de la grande maison du Pouget, et un cheval qui broute dans sa cour
  { const X = 185, Z = -315, rot = Math.atan2(-X, -Z), [x, z] = devant(X, Z, rot, POUGET.W / 2 + 3.4), y = hauteur(x, z);     // au pied des trois marches
    personne(scene, 'aieule_pouget', x, y, z, rot); rond(x, z, 0.5);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 3.5, prompt: () => 'parler à l’aïeule', fn: () => dialogue([
      { who: 'L’aïeule', text: 'Le Batut, Beauregard… Ce sont mes petits-enfants, les uns comme les autres.' },
      { who: 'L’aïeule', text: 'Avant, on se retrouvait tous ici, à la Saint-Jean. Maintenant ils se regardent par-dessus le lac.' }]) });
    const [hx, hz] = devant(X, Z, rot, MAISON.W / 2 + 9, -6); cheval(scene, 'cheval.glb', hx, hauteur(hx, hz), hz, rot + 1.9, 'Eating'); rond(hx, hz, 1.3); }
  // Les gens du lac (le jouable, 5 octobre) : les villageois de la place de Saint-Symphorien, hors
  // de la zone depuis le resserrement, sont reposés au bord du lac, avec un pêcheur et un colporteur
  // de passage. Leurs mots orientent ou racontent le lieu ; rien sur l'histoire que STORY.md ne dise.
  // Chacun cherche la place libre la plus proche de la sienne (le plan peut bouger).
  // (l'eau ne bloque pas la marche dans monde.js : on n'y pose personne)
  const eaux = ((PLAN && PLAN.eau.plans) || []).map((p) => p.pts), sec = (x, z) => !eaux.some((P) => dansPoly(x, z, P));
  const placer = (x0, z0) => { for (let r = 0; r < 30; r += 1.5) for (let k = 0; k < 16; k++) { const x = x0 + Math.cos(k / 16 * 6.283) * r, z = z0 + Math.sin(k / 16 * 6.283) * r; if (!bloque(x, z, 0.9) && !dansUneMaison(x, z, 1) && sec(x, z)) return [x, z]; } return null; };
  const parler = (o, x, z, qui, mots) => { const y = hauteur(x, z); o.scale.setScalar(G.echelle); o.position.set(x, y, z); scene.add(o); gens.push(o); rond(x, z, 0.4);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 2.6, prompt: () => 'parler', fn: () => dialogue(mots.map((text) => ({ who: qui, text }))) }); };
  const GENS = [
    // [rôle ou n° de villageois, x, z, regarde vers, qui, répliques]
    ['pecheur', -66, 97, [0, 60], 'Le pêcheur', ['Le lac a perdu plus d’un mètre. Les poissons se serrent au fond, là où il reste de l’eau.', 'Le barrage est au nord-ouest, au bout de la rive. On y passe à pied, sur la crête.']],
    ['colporteur', -175, -325, [-175, -300], 'Le colporteur', ['Je descends de Saint-Gervais, en haut. Là-haut aussi, les puits sont à sec.', 'Le Pouget est à l’est, dans les prés. L’aïeule y reçoit tout le monde.']],
    [1, 452, -228, [470, -240], 'Une femme de Perpignou', ['Le puits du hameau ne donne plus que de la vase.']],
    [4, 462, -212, [470, -240], 'Un homme de Perpignou', ['Le soleil ne bouge plus. Ça fait des jours que c’est midi.']],
    [7, 290, 30, [400, 150], 'Un homme de Fariboules', ['Beauregard, c’est la grande maison sur la pente, au sud-est. De chez eux, on voit tout le lac.']],
    [10, -262, -330, [-269, -339], 'Une femme, à la fontaine', ['On dit que les sources se sont bouchées toutes seules. Moi, je n’y crois pas.', 'Celle des Vergnes, au bout du lac, au sud-est, ne coule plus non plus.']],
    [13, -205, -55, [-222, -75], 'Un homme, sur le barrage', ['Les Roquette vont finir par se battre, pour ce lac.']],
  ];
  for (const [qui0, x0, z0, [lx, lz], qui, mots] of GENS) {
    const p = placer(x0, z0); if (!p) continue; const [x, z] = p;
    const o = typeof qui0 === 'string' ? PNJ.buildRole(qui0) : PNJ.buildVillageois && PNJ.buildVillageois(qui0); if (!o) continue;
    o.rotation.y = Math.atan2(lx - x, lz - z); parler(o, x, z, qui, mots);
    LIEU.gens = LIEU.gens || []; LIEU.gens.push({ qui, x: +x.toFixed(1), z: +z.toFixed(1), dit: mots[0] });
  }
}

monde({
  name: 'aveyron', titre: 'Le lac de Saint-Gervais', musique: 'campagne',
  // le relief et le plan JOUÉS (carte/mondes/fondre-relief-aveyron.py) : depuis le resserrement
  // du 5 octobre (emprise A, Eugène), le lac et ses rives seuls, 810 × 820 m où l'on marche, dans
  // une grille de 5 m qui déborde de 60 m — et le lac à l'étiage de la grande sécheresse.
  // Saint-Symphorien et Saint-Gervais ne sont plus qu'à l'horizon : les environs (14 × 12 km),
  // avec la vallée où se couche le Dormeur. La version complète : carte/mondes/complet/.
  plan: 'aveyron-jeu.json', fin: 'relief-aveyron-jeu.json', loin: 'relief-aveyron-environs.json', h0: 702.9,
  // le soleil au sommet du ciel, qui ne bouge pas : la lumière de midi, la brume chaude
  ciel: [0x4f86c8, 0xb8d0e2, 0xf2e6c8], brume: [0xe8dcc0, 380, 3200], soleil: [20, 400, 30, 3.2], soleilCouleur: 0xfff4dc,
  // l'herbe grillée : la paille, pas le sable — teintée plus grise qu'en version 1, qui lisait désert
  // l'horizon un peu PLUS clair que le sol joué : sa texture étirée sur des kilomètres paraît plus
  // sombre, et depuis le resserrement (5 octobre) la zone jouable s'y découpait en rectangle clair
  sol: ['withered_grass', 0xa49a6c], loinSol: ['withered_grass', 0xb0a676],
  // le bâti d'OSM dans la pierre et la tuile des maisons Roquette : old_stone_wall_02, étirée sur
  // les grandes façades, se lisait comme du bois en rendu
  murs: ['stone_wall', 0xa8a090], toit: { style: 'deuxPans', slug: 'lauze_lozere', couleur: 0x8a8984, pente: 1.0 }, hMurs: [4.6, 6.4],
  // les rues plus sombres que l'herbe grillée : de même teinte, on ne les voyait pas
  chemin: ['rocky_trail', 0x8a7c66],
  arbres: null,           // plantés par arbres(), après le bâti (monde.js les semait avant, jusque dans les maisons)
  depart: { x: -120, z: 135, yaw: Math.atan2(120, -135) },
  // les repères de la minicarte, comptés comme lieux découverts (monde.js, 4 octobre)
  reperes: [
    { id: 'batut', nom: 'Le Batut', x: -135, z: 170, r: 30, type: 'lieu' },
    { id: 'beauregard', nom: 'Beauregard', x: 400, z: 150, r: 30, type: 'lieu' },
    { id: 'pouget', nom: 'La grande maison du Pouget', x: 185, z: -315, r: 30, type: 'lieu' },
    { id: 'barrage', nom: 'Le barrage', x: -230, z: -95, r: 30, type: 'lieu' },
    { id: 'vergnes', nom: 'La source des Vergnes', x: 470, z: 440, r: 15, type: 'lieu' },
    { id: 'fontaine', nom: 'La fontaine du lac', x: -269, z: -339, r: 15, type: 'lieu' },
    { id: 'perpignou', nom: 'Perpignou', x: 462, z: -232, r: 30, type: 'lieu' },
    { id: 'fariboules', nom: 'Fariboules', x: 283, z: 12, r: 22, type: 'lieu' },
    { id: 'pecheur', nom: 'Le pêcheur', x: -66, z: 97, r: 8, type: 'pnj' },
    { id: 'colporteur', nom: 'Le colporteur', x: -175, z: -325, r: 8, type: 'pnj' },
    { id: 'porte', nom: 'La porte de l’île', x: -126, z: 146, r: 8, type: 'passage' },
  ],
  portes: [{ x: -126, z: 146, rot: 0.7, prompt: 'repasser la porte de l’île', vers: ['temple', [20.35, 0, 11.75], Math.atan2(-20.35, -11.75)], label: 'Retour à l’île du temps…' }],
  counts: 'Le lac de Saint-Gervais, dans l’Aveyron de la grande sécheresse. Les trois grandes maisons des Roquette sont autour. La porte de l’île, derrière toi.',
  start: 'Le soleil est au sommet du ciel, et il n’en bouge pas. Le lac est bas.',
  entry: { title: 'Le lac de Saint-Gervais', sub: 'La Cloche du Midi — Aveyron', cam: [520, 260, 620], at: [0, 0, 0], cam2: [-60, 30, 260], at2: [0, 0, 0], dur: 6 },
  plus(ctx) {
    // le bâti et les rues d'abord : tout ce qui suit cherche sa place libre avec bloque()
    const t0 = performance.now(), duree = (n, t) => { LIEU.durees = LIEU.durees || {}; LIEU.durees[n] = Math.round(performance.now() - t); return performance.now(); };
    // chaque maison tourne sa façade et sa cour vers le lac : c'est l'eau qu'elles se disputent
    const versLac = (x, z) => Math.atan2(-x, -z), local = (X, Z, rot, lx, lz) => [X + lx * Math.cos(rot) + lz * Math.sin(rot), Z - lx * Math.sin(rot) + lz * Math.cos(rot)];
    const MAISONS = [{ nom: 'du Batut', X: -135, Z: 170, porte: [9.5, 15], demi: 16 }, { nom: 'de Beauregard', X: 400, Z: 150, porte: [0, 20], demi: 16 }, { nom: 'du Pouget', X: 185, Z: -315, porte: [0, 31.5], demi: 18 }]
      .map((m) => ({ ...m, rot: versLac(m.X, m.Z), porteL: m.porte }));
    // les chemins d'accès des maisons entrent au plan AVANT que rues() le bâtisse
    cheminsDAcces(ctx.PLAN, MAISONS);
    let t = t0; bati(ctx); t = duree('bâti', t); rues(ctx); t = duree('rues', t);
    // la lisière APRÈS les rues (ses barrières se posent où elles sortent) et avant tout ce qui
    // cherche sa place avec bloque() : la bande hors zone y devient interdite
    lisiere(ctx); t = duree('lisière', t);
    secheresse(ctx);
    batut(ctx, -135, 170, versLac(-135, 170));
    // chacune bâtie d'après ce qu'on sait d'elle (5 octobre) : le dessin du Batut, les photos du
    // Pouget, un manoir du Carladez pour Beauregard ; grandeMaison() reste pour la version complète
    beauregard(ctx, 400, 150, versLac(400, 150));
    pouget(ctx, 185, -315, versLac(185, -315));
    t = duree('maisons Roquette', t);
    for (const m of MAISONS) domaine(ctx, m.nom, m.X, m.Z, m.rot, m.demi);
    t = duree('domaines', t);
    barrage(ctx); grevesEchouees(ctx); t = duree('barrage, ponton, barques', t);
    troupeaux(ctx);       // le modèle se charge en tâche de fond : les brebis arrivent après
    bourg(ctx);
    source(ctx);
    habitants(ctx);
    t = duree('le reste (bourg, gens, sécheresse)', t);
    arbres(ctx); t = duree('arbres', t);
    sol(ctx); duree('sol', t);
    // ce qui a été bâti, pour le banc du lieu (bancs/lieu-aveyron.mjs) : il mesure ce qui EST là
    LIEU.nappes.push({ nom: 'grève / relief', ecart: 0.05, decale: true }, { nom: 'cours des maisons / relief', ecart: 0.04, decale: true });
    window.__lieu = LIEU;
  },
  // les chevaux et les gens : leurs animations, à chaque image
  anime(now) {
    const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
    // dans une maison, la caméra reste sous le plafond et se rapproche (cf. batut.js) ; dehors, elle
    // reprend le champ que monde.js lui donne
    { const p = player.pos, ici = DEDANS.find((d) => dansPoly(p.x, p.z, d.pts));
      if (ici) { G.camMaxY = ici.plafond - 0.3; G.camBack = 3.6; G.camUp = 1.9; camDedans = true; }
      else if (camDedans) { G.camMaxY = Infinity; G.camBack = 7; G.camUp = 3.4; camDedans = false; } }
    for (const m of chevaux) m.update(dt);
    for (const g of gens) if (g.userData.ctrl) PNJ.animeVillageois(g, dt, false);
  },
});
