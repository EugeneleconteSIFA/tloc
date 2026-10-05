// The Legend of Camille — l'Aveyron de la grande sécheresse : le lac de Saint-Gervais
// La Cloche du Midi (STORY.md) : « une grande carte vallonnée et sèche ; le soleil reste au
// sommet du ciel ; l'eau est la richesse ». Le lac, son barrage, et autour les trois grandes
// maisons des Roquette — le Batut, Beauregard, la grande maison du Pouget — posées là où la
// session des mondes les a proposées et Eugène validées (carte/mondes/README.md).
import { monde } from './monde.js';
import { THREE, phMat, mesh, boxG, showMessage, dialogue, G, PH } from './engine.js?v=41';
import { especeGeo } from './foret.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as PNJ from './pnj.js';

// Les toits sont en TUILES CANAL (Eugène, 2 octobre), à faible pente (30 %, 17°) : clay_roof_tiles_02,
// déjà dans PH, ternie par le soleil. Les pierres ne sont pas dans PH (engine.js, tenu par une autre session) :
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
const TUILE = (u, v, extra = {}) => phMat('clay_roof_tiles_02', u, v, { color: 0xd8bca8, roughness: 0.9, side: THREE.DoubleSide, ...extra });
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
//   d'une autre aile ; pente de tuile canal (30 %), toit plafonné à 2,2 m. Une emprise irrégulière
//   (l'abside de l'église) a un toit en pavillon, sans débord.
// - La PENTE : le plancher est au plus 1,5 m au-dessus du point le plus bas de l'emprise ; sur
//   les fortes pentes (14 maisons à plus de 3 m), la maison s'encastre côté amont — la maison de
//   pente du Ségala, qui entre par l'étage.
// - Les RUES : collées au relief (3 à 4,5 cm au-dessus, décalées en profondeur par classe pour
//   ne pas se battre aux carrefours), leur matière d'après le tag surface d'OSM ou leur classe.
const LIEU = { murs: [], toits: [], rubans: [], rues: [], nappes: [] };
const TOIT = { o: 0.4, pente: 0.3, max: 2.2 };

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
      const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length, hl = Math.min(Math.sqrt(ar) * 0.4, TOIT.max), tri = [], uvs = [];
      for (let k = 0; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], l = Math.hypot(bx - ax, bz - az);
        tri.push(ax, haut, az, bx, haut, bz, cx, haut + hl, cz); uvs.push(0, 0, l / 3, 0, l / 6, Math.hypot(Math.hypot(cx - ax, cz - az), hl) / 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
      toits.push(teinter(g, t)); LIEU.toits.push({ bat: i, pts: P });
    }
    inscrire(P, P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length);
  });
  const prep = (g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g.index ? g.toNonIndexed() : g; };
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
    const pos = [], uv = [], col = [], idx = [], nt = Math.max(2, Math.ceil(w) + 1); let s = 0;
    for (let k = 0; k < d.length; k++) { const [x, z] = d[k], [xa, za] = d[Math.max(0, k - 1)], [xb, zb] = d[Math.min(d.length - 1, k + 1)];
      let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; if (k) s += Math.hypot(x - d[k - 1][0], z - d[k - 1][1]);
      const tv = 0.9 + 0.1 * Math.sin(x * 0.013 + z * 0.017) * Math.sin(x * 0.007 - z * 0.011);      // la teinte varie à grande échelle
      for (let q = 0; q < nt; q++) { const cs = -1 + 2 * q / (nt - 1), px = x - dz * w / 2 * cs, pz = z + dx * w / 2 * cs; pos.push(px, hauteur(px, pz) + cls.y, pz); uv.push(cs * w / 2, s); col.push(tv, tv, tv); }
      if (k) for (let q = 0; q < nt - 1; q++) { const b = (k - 1) * nt + q, c = b + nt; idx.push(b, b + 1, c, b + 1, c + 1, c); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const cle = matiereRue(c, sentier) + '|' + cls.off; if (!par.has(cle)) par.set(cle, []); par.get(cle).push(g.toNonIndexed());
    LIEU.rues.push({ pts: d, nom: c.nom }); LIEU.rubans.push({ pts: d.map(([x, z]) => [x, hauteur(x, z) + cls.y, z]) });
  }
  for (const [cle, gs] of par) { const [slug, off] = cle.split('|');
    const m = new THREE.Mesh(mergeGeometries(gs), phMat(slug, 1, 1, { color: slug === 'asphalt_02' ? 0xe2dcd2 : 0xa89c86, roughness: 1, vertexColors: true, polygonOffset: true, polygonOffsetFactor: +off, polygonOffsetUnits: +off }));
    m.receiveShadow = true; scene.add(m); }
  LIEU.nappes.push({ nom: 'rues / relief', ecart: 0.03, decale: true }, { nom: 'rues entre elles (carrefours)', ecart: 0.005, decale: true });
}

// les arbres, plantés APRÈS le bâti et les rues : monde.js les semait avant, jusque dans les maisons
function arbres({ hauteur, scene, PLAN, bloque, CADRE }) {
  const esp = especeGeo('chene'); if (!esp) return;
  const pres = new Set(); for (const r of LIEU.rues) for (let k = 0; k < r.pts.length - 1; k++) { const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let t = 0; t <= n; t++) pres.add(Math.floor((ax + (bx - ax) * t / n) / 4) + ',' + Math.floor((az + (bz - az) * t / n) / 4)); }
  const lac = PLAN.eau && PLAN.eau.lacPlein ? PLAN.eau.lacPlein.pts : null;
  const bois = (PLAN.verdure.bois || []), pos = [];
  const libre = (x, z) => !bloque(x, z, 3) && !pres.has(Math.floor(x / 4) + ',' + Math.floor(z / 4)) && !(lac && dansPoly(x, z, lac)) && Math.hypot(x + 120, z - 135) > 8;
  for (let k = 0; k < 9000 && pos.length < 700; k++) { const x = CADRE.x0 + Math.random() * (CADRE.x1 - CADRE.x0), z = CADRE.z0 + Math.random() * (CADRE.z1 - CADRE.z0), dans = bois.some((b) => dansPoly(x, z, b.pts));
    if ((dans ? Math.random() < 0.6 : Math.random() < 0.012) && libre(x, z) && pos.every((p) => Math.abs(p[0] - x) > 4 || Math.abs(p[1] - z) > 4)) pos.push([x, z]); }
  const n = pos.length, tr = new THREE.InstancedMesh(esp.tronc, esp.matT, n), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  pos.forEach(([x, z], k) => { const h = 7 + Math.random() * 5; q.setFromAxisAngle(Y, Math.random() * 6.283); s.set(h * (0.85 + Math.random() * 0.35), h, h * (0.85 + Math.random() * 0.35)); m4.compose(v.set(x, hauteur(x, z) - 0.2, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
  tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
}

// ---------------------------------------------------------------------
//  Le bourg de Saint-Symphorien-de-Thénières
// ---------------------------------------------------------------------
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
  // la grève : les mailles de 3 m dont un coin est dans le lac plein ; UV en mètres
  const S = 3, pos = [], uv = [];
  for (let x = x0 - S; x < x1 + S; x += S) for (let z = z0 - S; z < z1 + S; z += S) {
    if (!(dans(x, z) || dans(x + S, z) || dans(x, z + S) || dans(x + S, z + S))) continue;
    const c = [[x, z], [x + S, z], [x + S, z + S], [x, z + S]].map(([a, b]) => [a, hauteur(a, b) + 0.05, b]);
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
//  Les habitants : les Roquette à cheval, l'aïeule, le bourg
// ---------------------------------------------------------------------
// Les chevaux de la banque (Quaternius, CC0) se chargent ici comme dans tloc-multi.js, dont le
// chargeur est privé : mêmes fichiers, même lissage des facettes, même hauteur de 2,35 unités
// de Lille — puis l'échelle des gens du lieu (G.echelle), pour qu'un cavalier tienne en selle.
// SELLE et SELLE_AV : ceux de tloc-multi.js (la pose assise posée au creux du dos).
const SELLE = 0.62, SELLE_AV = -0.1;
const chevaux = [], gens = [];
let tAvant = 0;
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
function habitants({ hauteur, scene, inscrire, addInteract, bloque }) {
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
  { const X = 185, Z = -315, rot = Math.atan2(-X, -Z), [x, z] = devant(X, Z, rot, MAISON.W / 2 + 1.6), y = hauteur(x, z);
    personne(scene, 'aieule_pouget', x, y, z, rot); rond(x, z, 0.5);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 3.5, prompt: () => 'parler à l’aïeule', fn: () => dialogue([
      { who: 'L’aïeule', text: 'Le Batut, Beauregard… Ce sont mes petits-enfants, les uns comme les autres.' },
      { who: 'L’aïeule', text: 'Avant, on se retrouvait tous ici, à la Saint-Jean. Maintenant ils se regardent par-dessus le lac.' }]) });
    const [hx, hz] = devant(X, Z, rot, MAISON.W / 2 + 9, -6); cheval(scene, 'cheval.glb', hx, hauteur(hx, hz), hz, rot + 1.9, 'Eating'); rond(hx, hz, 1.3); }
  // le bourg : quelques villageois à l'ombre du marronnier, sur la place
  if (PNJ.buildVillageois) {
    const place = { x: 3814, z: -434 };
    for (let k = 0, n = 0; k < 40 && n < 4; k++) {
      const a = k * 2.4, r = 5 + (k % 5) * 1.6, x = place.x + Math.cos(a) * r, z = place.z + Math.sin(a) * r;
      if (bloque(x, z, 0.8)) continue;
      const v = PNJ.buildVillageois(n * 3 + 1); if (!v) break;
      v.scale.setScalar(G.echelle); v.position.set(x, hauteur(x, z), z); v.rotation.y = Math.atan2(place.x - x, place.z - z); scene.add(v); gens.push(v); n++;
      rond(x, z, 0.4);
      addInteract({ pos: new THREE.Vector3(x, hauteur(x, z), z), r: 2.5, prompt: () => 'parler', fn: () => showMessage(['Le puits du bourg ne donne plus que de la vase.', 'On dit que les sources se sont bouchées toutes seules. Moi, je n’y crois pas.', 'Le soleil ne bouge plus. Ça fait des jours que c’est midi.', 'Les Roquette vont finir par se battre, pour ce lac.'][n - 1], 5) });
    }
  }
}

monde({
  name: 'aveyron', titre: 'Le lac de Saint-Gervais', musique: 'campagne',
  // le relief et le plan JOUÉS (carte/mondes/fondre-relief-aveyron.py) : le lac ET le bourg de
  // Saint-Symphorien dans une seule grille de 5 m — monde.js prend la zone jouable dans
  // l'emprise du relief fin — et le lac à l'étiage de la grande sécheresse. L'horizon : les
  // environs (14 × 12 km), avec la vallée où se couche le Dormeur.
  plan: 'aveyron-jeu.json', fin: 'relief-aveyron-jeu.json', loin: 'relief-aveyron-environs.json', h0: 702.9,
  // le soleil au sommet du ciel, qui ne bouge pas : la lumière de midi, la brume chaude
  ciel: [0x4f86c8, 0xb8d0e2, 0xf2e6c8], brume: [0xe8dcc0, 380, 3200], soleil: [20, 400, 30, 3.2], soleilCouleur: 0xfff4dc,
  // l'herbe grillée : la paille, pas le sable — teintée plus grise qu'en version 1, qui lisait désert
  sol: ['withered_grass', 0xa49a6c], loinSol: ['withered_grass', 0x948a64],
  // le bâti d'OSM dans la pierre et la tuile des maisons Roquette : old_stone_wall_02, étirée sur
  // les grandes façades, se lisait comme du bois en rendu
  murs: ['stone_wall', 0xa8a090], toit: { style: 'deuxPans', slug: 'clay_roof_tiles_02', couleur: 0xd8bca8, pente: 0.3 }, hMurs: [4.6, 6.4],
  // les rues plus sombres que l'herbe grillée : de même teinte, on ne les voyait pas
  chemin: ['rocky_trail', 0x8a7c66],
  arbres: null,           // plantés par arbres(), après le bâti (monde.js les semait avant, jusque dans les maisons)
  depart: { x: -120, z: 135, yaw: Math.atan2(120, -135) },
  portes: [{ x: -126, z: 146, rot: 0.7, prompt: 'repasser la porte de l’île', vers: ['temple', [20.35, 0, 11.75], Math.atan2(-20.35, -11.75)], label: 'Retour à l’île du temps…' }],
  counts: 'Le lac de Saint-Gervais, dans l’Aveyron de la grande sécheresse. Les trois grandes maisons des Roquette sont autour. La porte de l’île, derrière toi.',
  start: 'Le soleil est au sommet du ciel, et il n’en bouge pas. Le lac est bas.',
  entry: { title: 'Le lac de Saint-Gervais', sub: 'La Cloche du Midi — Aveyron', cam: [520, 260, 620], at: [0, 0, 0], cam2: [-60, 30, 260], at2: [0, 0, 0], dur: 6 },
  plus(ctx) {
    // le bâti et les rues d'abord : tout ce qui suit cherche sa place libre avec bloque()
    const t0 = performance.now(), duree = (n, t) => { LIEU.durees = LIEU.durees || {}; LIEU.durees[n] = Math.round(performance.now() - t); return performance.now(); };
    let t = t0; bati(ctx); t = duree('bâti', t); rues(ctx); t = duree('rues', t);
    secheresse(ctx);
    // chaque maison tourne sa façade et sa cour vers le lac : c'est l'eau qu'elles se disputent
    const versLac = (x, z) => Math.atan2(-x, -z);
    grandeMaison(ctx, -135, 170, versLac(-135, 170), 'la grande maison du Batut', 'Le Batut. Les volets sont fermés au soleil ; derrière, on entend parler d’eau.', { volets: 0xb4c8d6, fermes: true });
    grandeMaison(ctx, 400, 150, versLac(400, 150), 'Beauregard', 'Beauregard, sur sa hauteur : de là, on voit tout le lac, et ce qu’il en reste.', { volets: 0xc8705a, fermes: false });
    bourg(ctx);
    habitants(ctx);
    grandeMaison(ctx, 185, -315, versLac(185, -315), 'la grande maison du Pouget', 'Le Pouget, la grande maison. La plus vieille des trois.', { volets: 0xb0c09a, fermes: false });
    t = duree('le reste (maisons Roquette, bourg, gens, sécheresse)', t);
    arbres(ctx); duree('arbres', t);
    // ce qui a été bâti, pour le banc du lieu (bancs/lieu-aveyron.mjs) : il mesure ce qui EST là
    LIEU.nappes.push({ nom: 'grève / relief', ecart: 0.05, decale: true }, { nom: 'cours des maisons / relief', ecart: 0.04, decale: true });
    window.__lieu = LIEU;
  },
  // les chevaux et les gens : leurs animations, à chaque image
  anime(now) {
    const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
    for (const m of chevaux) m.update(dt);
    for (const g of gens) if (g.userData.ctrl) PNJ.animeVillageois(g, dt, false);
  },
});
