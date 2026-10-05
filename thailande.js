// The Legend of Camille — la Thaïlande : la baie des pitons (acte III, la Cloche des Îles)
// =====================================================================
// « Petites îles de calcaire très hautes, temples, jungle, eau, mousson. La mer bouge. Les îles
// sont figées. La pluie reste suspendue » (STORY.md). Eugène a envoyé cinq extraits le
// 2 octobre et demandé un mélange : Ko Panyi (le village sur pilotis : le marché flottant, la
// porte de l'île), Khao Phing Kan et Ko Tapu (les pitons), Railay (les falaises et les
// grottes), Phi Phi (Ton Sai), et le Wat Tham Suea, haussé en grand piton. Ils sont fondus
// dans UNE baie inventée (carte/mondes/repere_thailande.py) ; les passeurs vont de l'une à
// l'autre. Le 4 octobre, chaque île est ramenée à son cœur, quelques centaines de mètres autour
// de ce qui sert (Eugène : « les îles sont trop grandes ») ; les plans complets d'avant sont dans
// carte/mondes/complet/.
// =====================================================================
import { monde } from './monde.js';
import { THREE, TAU, rand, phMat, mesh, boxG, showMessage, showMenu, hideMenu, fadeTo, player, state, G, scene, camera, hemi, sun, dialogue, TOUCHES, AIDE, SFX } from './engine.js?v=41';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { especeGeo } from './foret.js';
import * as PNJ from './pnj.js';

// Les embarcadères des passeurs : un par île (les pontons d'OSM ; le grand piton n'en a pas,
// on accoste sur sa grève sud). `ici` : où Camille pose le pied (le relief y est à 1–3 m) ;
// `barque` : où le bateau attend, en eau profonde (relevés sur relief-thailande.json).
const QUAIS = {
  panyi:  { nom: 'Ko Panyi, le village sur pilotis', ici: [118, 7.5], barque: [131, 9] },
  tapu:   { nom: 'Khao Phing Kan, les pitons', ici: [-701, 551], barque: [-689, 552] },
  suea:   { nom: 'le grand piton', ici: [985, 491], barque: [993, 512] },      // la grève sud, recalée le 4 octobre (le flanc a remplacé la plaine)
  railay: { nom: 'Railay, les falaises', ici: [-656.6, 1529.5], barque: [-669, 1535] },
  phiphi: { nom: 'Phi Phi, l’isthme de Ton Sai', ici: [2187, 1927], barque: [2191, 1941] },
};
const PASSEUR = {
  panyi: 'Somsak, le vieux passeur, ne quitte pas son moteur des yeux. « Les îles ne bougent plus. La mer, si. Alors on va sur la mer. »',
  tapu: 'Mali, sa petite-fille, tient la barre debout. « Je te ramène. Mais vite : je n’aime pas rester près des pitons. »',
  suea: 'Le passeur muet ne dit rien. Il regarde le temple tout en haut, puis toi.',
  railay: 'Un passeur attend, assis dans sa barque. Il te fait signe de monter.',
  phiphi: 'Un passeur attend, assis dans sa barque. Il te fait signe de monter.',
};

// ---------- les maisons sur pilotis de Ko Panyi ----------
// OSM ne dessine que les passerelles du village (52 chemins, 24 pontons) : les maisons, on
// les pose de part et d'autre, tous les 9 m, sur pilotis au-dessus de l'eau ou du platelage.
function pilotis({ hauteur, scene, PLAN, inscrire }) {
  const ile = PLAN.cote.iles.find((i) => i.nom === 'Ko Panyi');
  const dansP = (x, z, pts) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };
  // les murs en quatre lots : à Ko Panyi, les planches des maisons sont peintes, et la peinture a
  // passé au sel — bleu, vert d'eau, crème, ou le bois nu
  const murs = [[], [], [], []], toits = [], pieux = [], poses = [];
  const voies = [...PLAN.chemins, ...PLAN.ponts].filter((c) => c.m === 'panyi' && c.pts.length >= 2);
  // toutes les passerelles, segment par segment : une maison ne se pose pas EN TRAVERS d'une autre
  // (banc lieu-thailande, 2 octobre : 195 points de passerelle bloqués par des maisons voisines)
  const segs = voies.flatMap((c) => c.pts.slice(1).map((q, k) => [c.pts[k], q]));
  const dSeg = (x, z, [a, b]) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); };
  for (const c of voies) for (let k = 0; k < c.pts.length - 1; k++) {
    const [a, b] = [c.pts[k], c.pts[k + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (let s = 4; s < L - 3; s += 9) for (const cote of [-1, 1]) {
      const w = rand(5, 7), d = rand(5, 8), off = 1.6 + d / 2;
      const x = a[0] + ux * s - uz * off * cote, z = a[1] + uz * s + ux * off * cote;
      if (hauteur(x, z) > 3 || poses.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6.5)) continue;   // pas sur le rocher, pas l'une dans l'autre
      if (x > 84 && x < 109 && z > 10 && z < 58) continue;      // le marché flottant et ses deux abords restent libres
      if (segs.some((sg) => sg[0] !== a && dSeg(x, z, sg) < Math.max(w, d) / 2 + 1.0)) continue;
      if (ile && !dansP(x, z, ile.pts) && Math.random() < 0.35) continue;
      poses.push([x, z]);
      const ang = Math.atan2(uz, ux), hm = rand(2.6, 3.4), y0 = 1.3;
      const g = new THREE.BoxGeometry(w, hm, d); g.rotateY(-ang); g.translate(x, y0 + hm / 2, z); murs[Math.floor(Math.random() * murs.length)].push(g.toNonIndexed());
      // un toit de tôle à deux pans, faîtage le long de la passerelle
      // (rotateX de −π/2 : avec +π/2, l'arête du prisme pointait vers le BAS — des toits en V, sur
      // toutes les captures de Ko Panyi jusqu'au 5 octobre)
      const t = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w + 0.8, 3, 1); t.rotateZ(Math.PI / 2); t.rotateX(-Math.PI / 2); t.scale(1, 0.45, 1);
      t.rotateY(-ang); t.translate(x, y0 + hm + d * 0.14, z); toits.push(t.toNonIndexed());
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.CylinderGeometry(0.12, 0.14, 4, 5); p.translate(x + px * w * 0.42, y0 - 1.9, z + pz * d * 0.42); pieux.push(p.toNonIndexed()); }
      const ca = Math.cos(ang), sa = Math.sin(ang), coin = (p, q) => [x + p * ca - q * sa, z + p * sa + q * ca];
      const coins = [coin(-w / 2, -d / 2), coin(w / 2, -d / 2), coin(w / 2, d / 2), coin(-w / 2, d / 2)];
      inscrire(coins, x, z);
      BATI.facades.push({ pts: coins, haut: y0 + hm, m: 'panyi', sol: y0 });        // fenêtres et portes : batiIles()
    }
  }
  const uvm = (g) => { g.deleteAttribute('uv'); g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal, uv = [];
    for (let k = 0; k < p.count; k++) uv.push(p.getX(k) * Math.abs(n.getZ(k)) + p.getZ(k) * Math.abs(n.getX(k)) + (Math.abs(n.getY(k)) > 0.7 ? p.getX(k) : 0), Math.abs(n.getY(k)) > 0.7 ? p.getZ(k) : p.getY(k));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; };
  [0x9c8a74, 0x7e98a4, 0x8ea890, 0xcabda0].forEach((c, k) => { if (!murs[k].length) return;
    const m = new THREE.Mesh(mergeGeometries(murs[k].map(uvm)), phMat('hinoki_planks', 1, 1, { color: c })); m.castShadow = m.receiveShadow = true; scene.add(m); });
  // la tôle des toits, rouillée par la mer (l'enduit gris d'avant faisait un toit de ciment)
  if (toits.length) { const m = new THREE.Mesh(mergeGeometries(toits.map(uvm)), tole(0xc8b8a8)); m.castShadow = true; scene.add(m); }
  if (pieux.length) scene.add(new THREE.Mesh(mergeGeometries(pieux), phMat('tree_trunk', 1, 1, { color: 0x5a4838 })));
  // le platelage : partout où le relief de Ko Panyi est à 1,2 m (l'île basse et le long des
  // passerelles, recolter-relief-thailande.py), des planches — le village marche sur l'eau
  const v = [], pas = 2.5, plat = new Set();
  for (let z = -440; z < 420; z += pas) for (let x = -260; x < 200; x += pas) {
    const hs = [hauteur(x, z), hauteur(x + pas, z), hauteur(x, z + pas), hauteur(x + pas, z + pas)];
    // une case dont un coin est sur le platelage : la planche déborde au-dessus de l'eau, comme au bord d'une vraie passerelle
    if (hs.some((h) => h > 1.0 && h < 1.45) && hs.every((h) => h < 1.45)) { v.push(x, 0, z, x, 0, z + pas, x + pas, 0, z, x + pas, 0, z, x, 0, z + pas, x + pas, 0, z + pas); plat.add(x + ',' + z); }
  }
  if (v.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const uv = []; for (let k = 0; k < v.length; k += 3) uv.push(v[k], v[k + 2]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, phMat('wood_planks', 1, 1, { color: 0xb8a080, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })); m.position.y = 1.28; m.receiveShadow = true; scene.add(m); }
  // le bord du platelage, là où il donne sur l'eau : un chant de 35 cm (la poutre de rive) et, tous
  // les 2,5 m, un pieu de béton qui descend dans la mer. Vu d'une barque ou du marché, le village
  // n'était qu'une feuille posée sur l'eau ; un vrai village sur pilotis montre ses jambes.
  const rive = [], pieu = [];
  for (const k of plat) { const [x, z] = k.split(',').map(Number);
    for (const [dx, dz, a, b] of [[0, -pas, [x, z], [x + pas, z]], [0, pas, [x + pas, z + pas], [x, z + pas]], [-pas, 0, [x, z + pas], [x, z]], [pas, 0, [x + pas, z], [x + pas, z + pas]]]) {
      if (plat.has((x + dx) + ',' + (z + dz)) || hauteur((a[0] + b[0]) / 2 + dx * 0.4, (a[1] + b[1]) / 2 + dz * 0.4) > 0.9) continue;     // un voisin de planches, ou la terre : pas de rive
      rive.push(a[0], 1.30, a[1], b[0], 1.30, b[1], b[0], 0.95, b[1], a[0], 1.30, a[1], b[0], 0.95, b[1], a[0], 0.95, a[1]);
      pieu.push([a[0], a[1]]);
    } }
  if (rive.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rive, 3));
    const uv = []; for (let k = 0; k < rive.length; k += 3) uv.push(rive[k] + rive[k + 2], rive[k + 1]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, phMat('hinoki_planks', 1, 1, { color: 0x7a6248, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m); }
  if (pieu.length) { const g = new THREE.CylinderGeometry(0.13, 0.15, 3.2, 6); g.translate(0, -0.65, 0);
    const im = new THREE.InstancedMesh(g, phMat('enduit_gris', 1, 1, { color: 0x8a8a84 }), pieu.length), m4 = new THREE.Matrix4();
    pieu.forEach(([x, z], k) => { im.setMatrixAt(k, m4.makeTranslation(x, 0, z)); }); scene.add(im); }
}

// ---------- les voies : ce qu'on a sous les pieds ----------
// Le vrai lieu (OSM, 4 octobre) : pas une route à Railay ni à Phi Phi, des allées piétonnes — en
// béton à Railay (avec du sable et quelques pavés), en carrelage, en enrobé ou en pavés dans les
// ruelles de Ton Sai ; sur le grand piton, des rues revêtues et les escaliers du temple. monde.js
// les dessinait toutes d'une même matière (et ses rubans, tournés vers le bas, ne se voient pas
// d'en haut) : ici, chaque voie prend son revêtement, sa largeur et sa forme.
//   dalle    béton, enrobé, carrelage : une dalle de 6 cm posée sur le sol, son chant visible,
//            un bombé de 2 cm au milieu ;
//   souple   sable, terre : une largeur qui varie, des bords qui se fondent dans l'herbe ;
//   marches  les escaliers : des marches de 15 à 18 cm, posées sur la pente.
// Les hauteurs sont celles du MAILLAGE du sol (ses deux triangles par case), pas l'interpolation
// bilinéaire : sur une pente, l'écart entre les deux enfonçait le ruban de 10 à 30 cm.
const PAS_R = 10;
function solMaille(hauteur, CADRE) {
  const x0 = CADRE.x0 - 8, z0 = CADRE.z0 - 8;          // le coin du relief (monde.js : CADRE = relief + 8 m)
  return (x, z) => {
    const fx = (x - x0) / PAS_R, fz = (z - z0) / PAS_R, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const X = x0 + i * PAS_R, Z = z0 + j * PAS_R, a = hauteur(X, Z), b = hauteur(X, Z + PAS_R), c = hauteur(X + PAS_R, Z + PAS_R), d = hauteur(X + PAS_R, Z);
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };
}
function genreVoie(c) {
  const s = c.s || '';
  if (c.k === 'steps') return 'marches';
  if (['sand', 'dirt', 'grass', 'ground', 'earth', 'fine_gravel', 'gravel', 'unpaved'].includes(s)) return 'souple';
  if (['tiles', 'paving_stones', 'unhewn_cobblestone'].includes(s)) return 'carreaux';
  if (['concrete', 'paved', 'asphalt', 'wood'].includes(s)) return 'dalle';
  // sans revêtement dit : dans un village (Railay, Ton Sai, le temple), la dalle de béton des
  // allées thaïes ; ailleurs, un sentier de terre
  return c.r >= 1 || c.m === 'suea' ? 'dalle' : 'souple';
}
function voies({ hauteur, PLAN, CADRE, scene }) {
  // les rubans de monde.js sont retirés : sinon, le jour où ils se verront d'en haut, deux voies
  // l'une sur l'autre
  for (const o of [...scene.children]) if (o.isMesh && o.material && o.material.userData.ph === 'rocky_trail' && o.material.polygonOffset) scene.remove(o);
  const H = solMaille(hauteur, CADRE), G = { dalle: [], carreaux: [], souple: [], marches: [], beton: [], planches: [] };
  // Ko Panyi : les ruelles du village sont des dalles de béton coulées sur pilotis, larges de deux
  // mètres (OSM : 1,3 km de béton, 110 m de planches). Le platelage (pilotis()) est à 1,28 m : la
  // ruelle s'y pose, 4 cm plus haut — sans elle, le village n'était qu'un plancher brun d'un
  // seul tenant, sans une rue où marcher.
  const HP = (x, z) => Math.max(1.28, H(x, z));
  for (const c of [...PLAN.chemins, ...PLAN.routes]) {
    if (c.surface || c.pts.length < 2) continue;
    if (c.m === 'panyi') {
      const g = c.s === 'wood' ? 'planches' : 'beton', pts = [];
      for (let k = 0; k < c.pts.length - 1; k++) { const [a, b] = [c.pts[k], c.pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
        for (let t = 0; t < n; t++) pts.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
      pts.push(c.pts[c.pts.length - 1]);
      let cur = []; const fin = () => { if (cur.length > 1) G[g].push(ruban3(cur, g === 'planches' ? 1.6 : 2.0, g, HP)); cur = []; };
      for (const q of pts) { if (hauteur(q[0], q[1]) > 0.9) cur.push(q); else fin(); }
      fin(); continue;
    }
    const g = genreVoie(c), w0 = c.r >= 2 ? 4.2 : c.r === 1 ? 2.6 : c.k === 'steps' ? 2.2 : g === 'souple' ? 1.6 : 1.9;
    // un point tous les mètres (35 cm pour les marches), sur la terre seulement
    const pas = g === 'marches' ? 0.35 : 1;          // les marches : assez de points pour marquer chaque contremarche
    const pts = []; for (let k = 0; k < c.pts.length - 1; k++) { const [a, b] = [c.pts[k], c.pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
      for (let t = 0; t < n; t++) pts.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
    pts.push(c.pts[c.pts.length - 1]);
    let cur = []; const fin = () => { if (cur.length > 1) G[g].push(ruban3(cur, w0, g, H)); cur = []; };
    for (const q of pts) { if (hauteur(q[0], q[1]) > 0.15) cur.push(q); else fin(); }
    fin();
  }
  const M = {
    dalle: phMat('enduit_gris', 2, 2, { color: 0xc8c2b4, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    carreaux: phMat('worn_tile_floor', 1, 1, { color: 0xc8b8a0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    souple: phMat('gravier', 2, 2, { color: 0xd8c098, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    marches: phMat('old_stone_wall_02', 1, 1, { color: 0xb8b0a0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // le béton des ruelles de Ko Panyi : gris clair, taché d'eau ; les planches, plus pâles que le
    // platelage, posées en travers (les UV : le long de la ruelle, s)
    beton: phMat('enduit_gris', 2, 2, { color: 0xb4b2aa, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    planches: phMat('wood_planks', 1.2, 1.2, { color: 0xa89070, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
  for (const [k, l] of Object.entries(G)) if (l.length) { const m = new THREE.Mesh(mergeGeometries(l), M[k]); m.receiveShadow = true; if (k === 'souple') m.renderOrder = 1; scene.add(m); }
}
// un ruban qui regarde vers le haut, sa coupe faite de cinq points (bord, épaule, milieu, épaule, bord)
function ruban3(pts, w0, genre, H) {
  const pos = [], uv = [], col = [], idx = []; let s = 0, prec = null;
  const coupe = genre === 'souple' ? [[-1.25, -0.02, 0], [-0.6, 0.03, 1], [0, 0.04, 1], [0.6, 0.03, 1], [1.25, -0.02, 0]]
    // sur le platelage de Ko Panyi : une dalle mince, à plat (on y marche à 1,2 m ; plus épaisse, les pieds s'y enfonçaient)
    : genre === 'beton' || genre === 'planches' ? [[-1, -0.01, 1], [-1, 0.04, 1], [0, 0.045, 1], [1, 0.04, 1], [1, -0.01, 1]]
    : [[-1, -0.04, 1], [-1, 0.06, 1], [0, 0.08, 1], [1, 0.06, 1], [1, -0.04, 1]];     // la dalle : chant, dessus bombé, chant
  const n = coupe.length;
  for (let k = 0; k < pts.length; k++) {
    const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
    let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
    // la largeur : régulière pour une dalle, irrégulière (deux sinus) pour un sentier
    const w = genre === 'souple' ? w0 * (1 + 0.22 * Math.sin(s * 0.37 + x * 0.05) + 0.12 * Math.sin(s * 1.3)) : w0;
    // les marches : la hauteur du sol arrondie à 16 cm le long de la pente
    const yc = H(x, z), ym = genre === 'marches' ? Math.round(yc / 0.16) * 0.16 : null;
    for (const [c, dy, a] of coupe) {
      const px = x - dz * w / 2 * c, pz = z + dx * w / 2 * c;
      pos.push(px, (ym != null && Math.abs(dy) < 0.07 ? Math.max(ym, H(px, pz)) : H(px, pz)) + dy, pz);
      uv.push(c * w / 2, s); col.push(1, 1, 1, a);
    }
    if (k) { const b = (k - 1) * n; for (let q = 0; q < n - 1; q++) idx.push(b + q, b + q + 1, b + n + q, b + q + 1, b + n + q + 1, b + n + q); }   // vers le haut : (B−A)×(C−A) a un y positif
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed();
}

// ---------- la roche à nu et le sable ----------
// Un seul sol couvre la baie (l'herbe de la jungle) ; son matériau est retouché pour y fondre
// le calcaire là où la pente se redresse — les parois des pitons — et le sable sur les grèves,
// juste au-dessus de la mer. Le mélange se fait au pixel, selon la normale et l'altitude :
// des cases de 5 m posées par-dessus faisaient des créneaux sur chaque paroi.
function parois() {
  const sol = scene.children.find((o) => o.isMesh && o.material && o.material.userData.ph === 'grass_ground');
  if (!sol) return;
  const roche = phMat('roche_cotiere', 1, 1).map, sable = phMat('gravier', 1, 1).map;
  if (!roche || !sable) return;
  for (const t of [roche, sable]) t.repeat.set(1, 1);
  const m = sol.material;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tRoche = { value: roche }; sh.uniforms.tSable = { value: sable };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMonde; varying vec3 vNMonde;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMonde = (modelMatrix * vec4(transformed, 1.0)).xyz; vNMonde = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tRoche; uniform sampler2D tSable; varying vec3 vMonde; varying vec3 vNMonde;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 n = normalize(vNMonde), a = abs(n); a /= (a.x + a.y + a.z);
        // le calcaire, en projection sur les trois plans (une paroi verticale n'étire pas sa texture)
        vec3 r = texture2D(tRoche, vMonde.zy / 6.0).rgb * a.x + texture2D(tRoche, vMonde.xz / 6.0).rgb * a.y + texture2D(tRoche, vMonde.xy / 6.0).rgb * a.z;
        r *= vec3(1.18, 1.12, 1.04);                 // le calcaire de Phang Nga : pâle, un peu chaud
        // des coulures sombres et rousses le long des parois, comme sur les vrais pitons
        float coul = smoothstep(0.55, 0.9, sin(vMonde.x * 0.21 + sin(vMonde.y * 0.05) * 2.0) * sin(vMonde.z * 0.17 + vMonde.x * 0.03));
        r = mix(r, r * vec3(0.55, 0.5, 0.45), coul * 0.6);
        float paroi = smoothstep(0.82, 0.6, n.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, r, paroi);
        float greve = smoothstep(3.2, 1.6, vMonde.y) * (1.0 - paroi) * step(-1.5, vMonde.y);
        // le sable des plages de Phang Nga est clair et doré : le gravier tel quel était gris (le
        // « disque gris » du grand piton, Eugène, 4 octobre)
        diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(tSable, vMonde.xz / 3.0).rgb * vec3(1.32, 1.17, 0.9), greve);`);
  };
  m.customProgramCacheKey = () => 'sol-thailande';
  m.needsUpdate = true;
}

// ---------- la jungle ----------
// Partout où la terre monte au-dessus des grèves et où la pente tient un arbre : un semis
// serré (tous les 7 m, décalé au hasard), qui laisse à nu les parois et les villages.
function jungle({ hauteur, bloque, CADRE, PLAN }) {
  const esp = especeGeo('charme'); if (!esp) return;
  const pts = [], pas = 7;
  // les chemins restent dégagés : leurs points tous les 2 m, rangés par case de 4 m (on teste
  // la case de l'arbre et ses voisines) — des troncs se dressaient au milieu des rues de Ton Sai
  const chemin = new Set();
  for (const c of [...PLAN.chemins, ...PLAN.routes]) { if (c.surface) continue;
    for (let k = 0; k < c.pts.length - 1; k++) { const [a, b] = [c.pts[k], c.pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
      for (let t = 0; t <= n; t++) chemin.add(Math.floor((a[0] + (b[0] - a[0]) * t / n) / 4) + ',' + Math.floor((a[1] + (b[1] - a[1]) * t / n) / 4)); } }
  const surChemin = (x, z) => { const i = Math.floor(x / 4), j = Math.floor(z / 4); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (chemin.has((i + a) + ',' + (j + b))) return true; return false; };
  for (let z = CADRE.z0; z < CADRE.z1; z += pas) for (let x = CADRE.x0; x < CADRE.x1; x += pas) {
    const px = x + rand(-3, 3), pz = z + rand(-3, 3), h = hauteur(px, pz); if (h < 3.5) continue;
    const pente = Math.max(Math.abs(hauteur(px + 2, pz) - hauteur(px - 2, pz)), Math.abs(hauteur(px, pz + 2) - hauteur(px, pz - 2))) / 4;
    if (pente > 0.75 || (pente > 0.5 && Math.random() < 0.5) || bloque(px, pz, 3) || surChemin(px, pz)) continue;
    // ni dans l'escalier du grand piton, ni à moins de 4 m (seuls ses parapets sont inscrits dans les collisions)
    if ([[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]].some(([a, b]) => solEscalier(px + a, pz + b) != null)) continue;
    pts.push([px, pz, h]);
  }
  const n = pts.length, tr = new THREE.InstancedMesh(esp.tronc, esp.matT, n), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  esp.matH.color.setHex(0x8ab070);          // le vert gorgé d'eau de la mousson, plus franc que la charmille
  pts.forEach(([x, z, h], k) => { const t = rand(6, 11); q.setFromAxisAngle(Y, rand(0, TAU)); s.set(t * rand(0.9, 1.3), t, t * rand(0.9, 1.3));
    m4.compose(v.set(x, h - 0.3, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
  tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
}

// ---------- Ko Tapu, le clou : trop fin pour le relief (8 m à la base), on le tourne ----------
function koTapu({ scene }) {
  const pr = [[0, -6], [3.2, -6], [2.6, 0], [3.0, 4], [4.2, 9], [5.6, 14], [6.4, 19], [6.0, 23], [4.6, 26], [2.0, 27.5], [0, 28]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pr, 18); const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), y = p.getY(k), b = 1 + 0.18 * Math.sin(y * 0.9 + Math.atan2(z, x) * 3) + 0.1 * Math.sin(y * 2.3); p.setX(k, x * b); p.setZ(k, z * b * 0.8); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, phMat('paroi_rocheuse', 8, 8, { color: 0xb0a490 })); m.position.set(-684, 0, 468); m.castShadow = true; scene.add(m);
  // la touffe de jungle au sommet
  const t = new THREE.Mesh(new THREE.SphereGeometry(5.6, 10, 6, 0, TAU, 0, Math.PI / 2), phMat('forest_leaves_02', 4, 4, { color: 0x4a6a3a }));
  t.scale.set(1, 0.45, 0.8); t.position.set(-684, 27, 468); scene.add(t);
}

// ---------- le grand piton : le chedi doré du Wat Tham Suea, et ses temples ----------
function chedi({ hauteur, scene, addInteract }) {
  const x = 982.7, z = 343.9, y = hauteur(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.28 }), blanc = phMat('chaux_craquelee', 3, 3, { color: 0xf0ece0 });
  // trois terrasses blanches, la cloche dorée, les anneaux, la flèche
  [[9, 1.4], [7.4, 1.4], [6, 1.4]].forEach(([r, h], k) => g.add(mesh(new THREE.CylinderGeometry(r, r + 0.3, h, 24), blanc, 0, 0.7 + k * 1.4, 0)));
  const cl = new THREE.LatheGeometry([[0, 0], [5.4, 0], [5.6, 1], [5.2, 3.4], [4.2, 5.6], [2.6, 7.2], [1.2, 7.8], [0, 7.9]].map(([r, h]) => new THREE.Vector2(r, h)), 28);
  g.add(mesh(cl, or, 0, 4.2, 0));
  for (let k = 0; k < 7; k++) { const a = mesh(new THREE.TorusGeometry(1.25 - k * 0.12, 0.22, 6, 18), or, 0, 12.4 + k * 0.55, 0); a.rotation.x = Math.PI / 2; g.add(a); }
  g.add(mesh(new THREE.ConeGeometry(0.55, 7, 12), or, 0, 19.6, 0));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // le chedi coiffe une seconde bosse du sommet, qu'un ravin de 30 m sépare du plateau : on le
  // regarde depuis le bord du plateau, en face (parcours du 5 octobre : à son pied, on n'arrivait pas)
  addInteract({ pos: new THREE.Vector3(946, hauteur(946, 340), 340), r: 7, prompt: () => 'regarder le chedi doré', fn: () => showMessage('Le chedi du grand piton. Les clochettes de ses anneaux sont arrêtées en plein tintement.', 6) });
}

// ---------- l'escalier du grand piton ----------
// Eugène, 5 octobre : « fais l'escalier ». Le replat des moines (47 m, devant le Wat Tham Suea) et
// le plateau du sommet (114 m) sont séparés par une falaise de 67 m sur 10 : on n'y montait que par
// le câble de Phi Phi. SCENARIO.md : « escaliers de centaines de marches », comme celui du vrai
// temple de la grotte du Tigre. Le relief ne peut pas le porter (sa grille de 10 m mêlerait des
// lacets serrés, et les tuiles Copernicus ne sont pas sur le PC) : c'est un OUVRAGE, maçonné contre
// la falaise — trois volées et deux paliers qui se replient sur eux-mêmes, chacune un peu plus
// près de la paroi que la précédente (en plan, rien ne se recouvre : un sol par point suffit), puis
// un pont de 18 m jusqu'au bord du plateau. 117 m de marches pour 67 m : 30°, sous les 35° du banc.
// On y marche par solLieu (solEscalier) ; des parapets inscrits dans les collisions en font un
// couloir — on n'en tombe pas. Les parapets sont les nagas des escaliers thaïs, en écailles vertes.
const ESC = [];             // { x0, x1, z0, z1, h(x), rampe, parapets: [[côté, de, à]] }
function solEscalier(x, z) {
  if (x < 897.5 || x > 958 || z < 287.5 || z > 314.5) return null;
  for (const E of ESC) if (x >= E.x0 && x <= E.x1 && z >= E.z0 && z <= E.z1) return E.h(x);
  return null;
}
function escalier({ hauteur, inscrire, scene }) {
  const h0 = hauteur(901, 290), haut = hauteur(929, 314), s = (haut - h0) / 117;
  const F = (x0, x1, z0, z1, h, rampe, parapets) => ESC.push({ x0, x1, z0, z1, h, rampe, parapets });
  // les côtés : 's' (z0), 'n' (z1), 'o' (x0), 'e' (x1), avec la portion bordée [de, à] (null : tout le côté)
  F(904, 952, 288, 291.5, (x) => h0 + (x - 904) * s, true, [['s'], ['n']]);                       // 1re volée, vers l'est
  F(952, 957.5, 288, 295.5, () => h0 + 48 * s, false, [['s'], ['n'], ['e']]);                     // le palier est
  F(904, 952, 292, 295.5, (x) => h0 + 48 * s + (952 - x) * s, true, [['s'], ['n']]);              // 2e volée, vers l'ouest
  F(898, 904, 292, 299.5, () => h0 + 96 * s, false, [['s'], ['n'], ['o']]);                       // le palier ouest
  F(904, 925, 296, 299.5, (x) => h0 + 96 * s + (x - 904) * s, true, [['s'], ['n']]);              // 3e volée, vers l'est
  F(925, 933, 296, 314, () => haut, false, [['s'], ['e'], ['o', 299.5, 314]]);                    // le pont, jusqu'au plateau
  // les collisions : un mur de 30 cm sur chaque bord qui n'ouvre pas sur la suite du chemin
  const mur = (x0, x1, z0, z1) => inscrire([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], (x0 + x1) / 2, (z0 + z1) / 2);
  mur(904, 957.8, 287.7, 288); mur(957.5, 957.8, 288, 295.5); mur(898, 952, 291.5, 292); mur(904, 957.8, 295.5, 296);
  mur(897.7, 898, 292, 299.5); mur(898, 925, 299.5, 299.8); mur(924.7, 925, 299.5, 314); mur(933, 933.3, 296, 314);
  // la géométrie, en mètres pour les UV
  const pierre = { p: [], u: [] }, marche = { p: [], u: [] }, naga = { p: [], u: [] };
  const quad = (G, a, b, c, d, uv) => { G.p.push(...a, ...b, ...c, ...a, ...c, ...d); G.u.push(...uv[0], ...uv[1], ...uv[2], ...uv[0], ...uv[2], ...uv[3]); };
  // une face verticale le long de x (en z fixe) entre deux lignes de hauteur, ou le long de z (en x fixe)
  const faceX = (G, z, xa, xb, ya0, yb0, ya1, yb1) => quad(G, [xa, ya0, z], [xb, yb0, z], [xb, yb1, z], [xa, ya1, z], [[xa, ya0], [xb, yb0], [xb, yb1], [xa, ya1]]);
  const faceZ = (G, x, za, zb, y0, y1) => quad(G, [x, y0, za], [x, y0, zb], [x, y1, zb], [x, y1, za], [[za, y0], [zb, y0], [zb, y1], [za, y1]]);
  const P = 0.35, HP = 0.85;          // le parapet : 35 cm d'épais, 85 cm au-dessus des marches
  for (const E of ESC) {
    let bas = 1e9; for (const x of [E.x0, E.x1]) for (const z of [E.z0, E.z1]) bas = Math.min(bas, hauteur(x, z) - 1);
    const ya = E.h(E.x0), yb = E.h(E.x1);
    // la maçonnerie : quatre faces, du pied au dessus des marches
    faceX(pierre, E.z0, E.x0, E.x1, bas, bas, ya, yb); faceX(pierre, E.z1, E.x0, E.x1, bas, bas, ya, yb);
    faceZ(pierre, E.x0, E.z0, E.z1, bas, ya); faceZ(pierre, E.x1, E.z0, E.z1, bas, yb);
    // le dessus : des marches de 30 cm (la hauteur prise au milieu de chaque marche : on marche sur la
    // rampe, les pieds ne s'écartent pas des marches de plus de 9 cm), ou le dallage d'un palier
    if (E.rampe) {
      const n = Math.round((E.x1 - E.x0) / 0.3), w = (E.x1 - E.x0) / n;
      for (let k = 0; k < n; k++) { const xa = E.x0 + k * w, xb = xa + w, y = E.h(xa + w / 2);
        quad(marche, [xa, y, E.z0], [xa, y, E.z1], [xb, y, E.z1], [xb, y, E.z0], [[xa, E.z0], [xa, E.z1], [xb, E.z1], [xb, E.z0]]);
        if (k < n - 1) { const y2 = E.h(xb + w / 2); faceZ(marche, xb, E.z0, E.z1, Math.min(y, y2), Math.max(y, y2)); } }
    } else quad(marche, [E.x0, ya, E.z0], [E.x0, ya, E.z1], [E.x1, ya, E.z1], [E.x1, ya, E.z0], [[E.x0, E.z0], [E.x0, E.z1], [E.x1, E.z1], [E.x1, E.z0]]);
    // les parapets
    for (const [c, de, a] of E.parapets) {
      if (c === 's' || c === 'n') { const z = c === 's' ? E.z0 : E.z1, zi = c === 's' ? E.z0 + P : E.z1 - P;
        faceX(naga, z, E.x0, E.x1, ya, yb, ya + HP, yb + HP); faceX(naga, zi, E.x0, E.x1, ya - 0.2, yb - 0.2, ya + HP, yb + HP);
        quad(naga, [E.x0, ya + HP, z], [E.x1, yb + HP, z], [E.x1, yb + HP, zi], [E.x0, ya + HP, zi], [[E.x0, 0], [E.x1, 0], [E.x1, P], [E.x0, P]]);
      } else { const x = c === 'o' ? E.x0 : E.x1, xi = c === 'o' ? E.x0 + P : E.x1 - P, za = de ?? E.z0, zb = a ?? E.z1, y = E.h(x);
        faceZ(naga, x, za, zb, y, y + HP); faceZ(naga, xi, za, zb, y - 0.2, y + HP);
        quad(naga, [x, y + HP, za], [x, y + HP, zb], [xi, y + HP, zb], [xi, y + HP, za], [[za, 0], [zb, 0], [zb, P], [za, P]]); }
    }
  }
  const pose = (G, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.u, 2)); g.computeVertexNormals();
    const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; scene.add(o); };
  pose(pierre, phMat('chaux_craquelee', 3, 3, { color: 0xf0ece0, side: THREE.DoubleSide }));
  pose(marche, phMat('worn_tile_floor', 1, 1, { color: 0xc4baa8, side: THREE.DoubleSide }));
  pose(naga, phMat('clay_roof_tiles_02', 0.8, 0.8, { color: 0x4e8a5a, side: THREE.DoubleSide }));
  // les deux têtes de naga au pied de la 1re volée : le corps se relève et finit en tête dorée
  const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.3 }), ecailles = phMat('clay_roof_tiles_02', 0.4, 0.4, { color: 0x4e8a5a });
  for (const z of [288 + P / 2, 291.5 - P / 2]) {
    const y = h0 + HP, c = new THREE.CatmullRomCurve3([new THREE.Vector3(905, y, z), new THREE.Vector3(903.6, y + 0.5, z), new THREE.Vector3(903, y + 1.5, z)]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.2, 8), ecailles));
    const t = mesh(new THREE.ConeGeometry(0.28, 0.9, 8), or, 902.8, y + 1.9, z); t.rotation.z = 0.5; t.castShadow = true; scene.add(t);
  }
}

// ---------- les temples du grand piton : toits thaïs, chedis ----------
// OSM ne dit que l'emprise. Un bâtiment rond devient un chedi (la cloche blanche et dorée sur
// son socle) ; les autres prennent le toit des temples thaïs : deux ou trois pans superposés,
// très pentus, rouges bordés de vert, les pignons dorés et les chofa — les cornes dorées —
// aux bouts du faîtage. Les maillages sont fondus par matière, comme le reste du bâti.
const TEMPLE = { rouge: [], vert: [], or: [], blanc: [] };
// ---------- le bâti de Railay et de Ton Sai ----------
// Le vrai lieu : à Railay, des bungalows et des hôtels de un à trois niveaux, presque tous à toit à
// QUATRE pans (OSM : 42 « hipped » sur 48 toits dits) ; à Ton Sai, des compartiments serrés de deux
// ou trois niveaux, terrasse de béton à acrotère ou tôle à faible pente. monde.js coiffait tout
// d'un toit de tuiles à deux pans. Ici, le toit, et les ouvertures que monde.js ne fait pas :
// fenêtres à cadre de bois et volets, portes, rideaux de fer des boutiques.
// (5 octobre, Eugène : « oui pour les bungalows de bois ») Railay n'est plus d'enduit blanc sous la tuile —
// l'air provençal des captures — mais de planches sous la tôle : `toleRailay`, et le bardage de batiIles().
const BATI = { tuiles: [], tole: [], toleRailay: [], dalle: [], facades: [] };
// La tôle des toits : metal_plate_02 porte une carte de métal, qui en fait un métal PUR — sans rien à
// refléter, il sortait noir vu d'en haut (Ko Panyi, Railay, Ton Sai). Une tôle galvanisée ou peinte
// diffuse : on garde son grain, sa couleur et ses rayures, pas la carte de métal.
function tole(couleur, extra = {}) { const m = phMat('metal_plate_02', 1, 1, { color: couleur, roughness: 0.7, ...extra }); m.metalnessMap = null; m.metalness = 0.15; return m; }
function quad(dst, a, b, c, d) { dst.push(...a, ...b, ...c, ...a, ...c, ...d); }
function toitIle(b, { cx, cz, ux, uz, a0, a1, b0, b1, L, W, haut }) {
  if (b.m !== 'railay' && b.m !== 'phiphi') return false;
  const ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
  const P = (a, c, y) => [cx + (ac + a) * ux - (bc + c) * uz, haut + y, cz + (ac + a) * uz + (bc + c) * ux];
  BATI.facades.push({ pts: b.pts, haut, m: b.m });
  if (b.m === 'railay' || (b.toit === 'hipped')) {
    // quatre pans : le faîtage court le long du grand côté, à 0,45 de pente ; 60 cm de débord
    const o = 0.6, la = L / 2 + o, lb = W / 2 + o, hf = lb * 0.55, lf = Math.max(0, la - lb);
    const v = [P(-la, -lb, 0), P(la, -lb, 0), P(la, lb, 0), P(-la, lb, 0), P(-lf, 0, hf), P(lf, 0, hf)];
    const t = b.m === 'railay' ? BATI.toleRailay : BATI.tuiles;
    quad(t, v[0], v[4], v[5], v[1]); quad(t, v[2], v[5], v[4], v[3]);          // les deux longs pans
    t.push(...v[1], ...v[5], ...v[2], ...v[3], ...v[4], ...v[0]);                 // les deux croupes
    return true;
  }
  if (L * W > 110) {
    // la terrasse de béton et son acrotère de 90 cm
    const la = L / 2, lb = W / 2, d = BATI.dalle, e = 0.25;
    quad(d, P(-la, -lb, 0.02), P(-la, lb, 0.02), P(la, lb, 0.02), P(la, -lb, 0.02));
    for (const [p0, p1] of [[[-la, -lb], [la, -lb]], [[la, -lb], [la, lb]], [[la, lb], [-la, lb]], [[-la, lb], [-la, -lb]]]) {
      quad(d, P(p0[0], p0[1], 0), P(p1[0], p1[1], 0), P(p1[0], p1[1], 0.9), P(p0[0], p0[1], 0.9));
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, ix = -Math.sign(mx) * e * (Math.abs(mx) > 0.01), iy = -Math.sign(my) * e * (Math.abs(my) > 0.01);
      quad(d, P(p0[0] + ix, p0[1] + iy, 0.9), P(p1[0] + ix, p1[1] + iy, 0.9), P(p1[0] + ix, p1[1] + iy, 0), P(p0[0] + ix, p0[1] + iy, 0));
      quad(d, P(p0[0], p0[1], 0.9), P(p1[0], p1[1], 0.9), P(p1[0] + ix, p1[1] + iy, 0.9), P(p0[0] + ix, p0[1] + iy, 0.9));
    }
    return true;
  }
  // la tôle : un seul pan à 15 %, 50 cm de débord
  const la = L / 2 + 0.5, lb = W / 2 + 0.5;
  quad(BATI.tole, P(-la, -lb, 0), P(la, -lb, 0), P(la, lb, W * 0.15), P(-la, lb, W * 0.15));
  return true;
}
function dansP(x, z, pts) { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; }
function batiIles({ hauteur, scene }) {
  const cadres = [], vitres = [], volets = [], portes = [], rideaux = [], balcons = [], bardage = [[], [], []], boisBalcons = [];
  // une boîte posée contre le mur, sa face avant à `ep` du mur : ses cinq faces visibles (le dos est
  // contre le mur) poussées droit dans un tableau. Une BoxGeometry par boîte, convertie puis fondue,
  // coûtait 1 s au chargement pour les 9 000 boîtes de Railay et de Ton Sai (banc du 5 octobre).
  const boite = (dst, cx, y, cz, ux, uz, nx, nz, w, h, ep) => {
    if (ux * nz - uz * nx < 0) { ux = -ux; uz = -uz; }       // (u, haut, n) direct : les faces regardent dehors
    const v = (a, b, c) => [cx + ux * a + nx * c, y + b, cz + uz * a + nz * c], a = w / 2;
    const A = v(-a, 0, 0), B = v(a, 0, 0), C = v(a, h, 0), D = v(-a, h, 0), E = v(-a, 0, ep), F = v(a, 0, ep), G = v(a, h, ep), Hh = v(-a, h, ep);
    for (const [p, q, r, t] of [[E, F, G, Hh], [Hh, G, C, D], [A, B, F, E], [B, C, G, F], [A, E, Hh, D]]) dst.push(...p, ...q, ...r, ...p, ...r, ...t);
  };
  for (const F of BATI.facades) {
    const P = F.pts[0][0] === F.pts[F.pts.length - 1][0] && F.pts[0][1] === F.pts[F.pts.length - 1][1] ? F.pts.slice(0, -1) : F.pts;
    let sol = 1e9; for (const [x, z] of P) sol = Math.min(sol, hauteur(x, z));
    let solMax = -1e9; for (const [x, z] of P) solMax = Math.max(solMax, hauteur(x, z));
    if (F.sol != null) solMax = F.sol;          // sur pilotis : le plancher, pas la mer en dessous
    const niveaux = Math.max(1, Math.round((F.haut - solMax) / 3)), hN = (F.haut - solMax) / niveaux;
    // le bardage d'un bungalow de Railay : des planches à 2 cm devant le mur de monde.js (enduit
    // blanc pour toute la baie), du plancher au toit ; une teinte par maison, du bois clair au teck
    const bard = F.m === 'railay' ? bardage[Math.floor(Math.random() * 3)] : null;
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az); if (L < 2.2) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L; let nx = uz, nz = -ux;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (dansP(mx + nx * 0.3, mz + nz * 0.3, P)) { nx = -nx; nz = -nz; }   // la normale vers dehors
      if (bard) boite(bard, mx, solMax - 0.15, mz, ux, uz, nx, nz, L + 0.04, F.haut - solMax + 0.15, 0.02);
      const n = Math.max(1, Math.floor(L / 3.2)), pas = L / n;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) * pas, cx = ax + ux * t, cz = az + uz * t, yb = Math.max(hauteur(cx, cz), solMax - 0.2);
        for (let e = 0; e < niveaux; e++) {
          const y0 = solMax + e * hN;
          if (e === 0 && F.m === 'phiphi' && L > 4) {
            // le rez-de-chaussée de Ton Sai : des boutiques, rideau de fer à demi relevé
            boite(rideaux, cx, y0, cz, ux, uz, nx, nz, pas * 0.86, 2.5, 0.06); boite(cadres, cx, y0 + 2.5, cz, ux, uz, nx, nz, pas * 0.9, 0.18, 0.1); continue;
          }
          if (e === 0 && k === Math.floor(n / 2) && i % 2 === 0) {
            boite(portes, cx, Math.max(y0, yb), cz, ux, uz, nx, nz, 1.0, 2.1, 0.07); boite(cadres, cx, Math.max(y0, yb) + 2.1, cz, ux, uz, nx, nz, 1.2, 0.12, 0.1); continue;
          }
          // la fenêtre : vitre, appui, linteau — sans volets (des volets battants faisaient la Provence)
          const ys = y0 + 0.95;
          boite(vitres, cx, ys, cz, ux, uz, nx, nz, 1.1, 1.3, 0.03);
          boite(cadres, cx, ys - 0.08, cz, ux, uz, nx, nz, 1.3, 0.08, 0.12);
          boite(cadres, cx, ys + 1.3, cz, ux, uz, nx, nz, 1.3, 0.1, 0.1);
          boite(cadres, cx, ys, cz, ux, uz, nx, nz, 0.06, 1.3, 0.06);                 // le meneau
        }
      }
      // les balcons des étages, un par façade et par niveau : une dalle d'un mètre, une lisse, des
      // barreaux — les chambres d'hôtel de Railay, les logements au-dessus des boutiques de Ton Sai
      if (L > 4.5) for (let e = 1; e < niveaux; e++) {
        const y0 = solMax + e * hN, lb = L - 1.2, dal = bard ? boisBalcons : balcons, gc = bard ? boisBalcons : volets;     // à Railay, la véranda et sa rambarde sont de bois
        boite(dal, mx, y0 - 0.12, mz, ux, uz, nx, nz, lb, 0.12, 1.0);
        boite(gc, mx + nx * 0.96, y0 + 0.95, mz + nz * 0.96, ux, uz, nx, nz, lb, 0.06, 0.06);
        for (let t = -lb / 2; t <= lb / 2 + 0.01; t += 1.1) boite(gc, mx + ux * t + nx * 0.96, y0, mz + uz * t + nz * 0.96, ux, uz, nx, nz, 0.05, 0.95, 0.05);
      }
    }
  }
  // les UV en mètres : x + z le long de la façade, y en hauteur
  const fondre = (v) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const uv = new Float32Array(v.length / 3 * 2);
    for (let k = 0, j = 0; k < v.length; k += 3, j += 2) { uv[j] = v[k] + v[k + 2]; uv[j + 1] = v[k + 1]; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  const pose = (l, m, ombre = false) => { if (!l.length) return; const o = new THREE.Mesh(fondre(l), m); o.receiveShadow = true; o.castShadow = ombre; scene.add(o); };
  pose(cadres, phMat('hinoki_planks', 1, 1, { color: 0x8a6a4a }));
  pose(volets, phMat('metal_plate_02', 1, 1, { color: 0x4a4a46, roughness: 0.6 }));            // les garde-corps de fer peint
  pose(balcons, phMat('enduit_gris', 1, 1, { color: 0xc8c0b0 }), true);
  pose(portes, phMat('wood_cabinet_worn_long', 1, 1, { color: 0x7a5a3a }));
  pose(vitres, phMat('metal_plate_02', 1, 1, { color: 0x2a3236, roughness: 0.18, metalness: 0.6 }));
  pose(rideaux, phMat('metal_plate_02', 1, 1, { color: 0x9a9c98, roughness: 0.55 }));
  [0xb08a62, 0x8a6a4a, 0x6e5440].forEach((c, k) => pose(bardage[k], phMat('hinoki_planks', 1, 1, { color: c }), true));
  pose(boisBalcons, phMat('wood_planks', 1, 1, { color: 0x8a6a4a }), true);
  // les toits : les UV en mètres, sur le plan (la tuile suit la pente, à peu près)
  const geo = (v) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const uv = [];
    for (let k = 0; k < v.length; k += 3) uv.push(v[k] / 2, v[k + 2] / 2); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  const toit = (v, m) => { if (!v.length) return; const o = new THREE.Mesh(geo(v), m); o.castShadow = o.receiveShadow = true; scene.add(o); };
  toit(BATI.tuiles, phMat('clay_roof_tiles', 1.2, 1.2, { color: 0x9a6a50, side: THREE.DoubleSide }));
  toit(BATI.tole, tole(0x9aa6b0, { side: THREE.DoubleSide }));
  // la tôle des bungalows : un peu rouillée, plus claire que celle de Ton Sai
  toit(BATI.toleRailay, tole(0xb8a490, { side: THREE.DoubleSide }));
  toit(BATI.dalle, phMat('enduit_gris', 2, 2, { color: 0xc8c0b0, side: THREE.DoubleSide }));
}

function toitThai(b, geo) {
  if (toitIle(b, geo)) return true;
  const { cx, cz, ux, uz, a0, a1, b0, b1, L, W, haut } = geo;
  if (b.m !== 'suea') return false;
  const ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
  const P = (a, c, y) => [cx + (ac + a) * ux - (bc + c) * uz, y, cz + (ac + a) * uz + (bc + c) * ux];
  const tri = (dst, ...v) => dst.push(...v.flat());
  if (b.pts.length > 12 && Math.max(L, W) / Math.min(L, W) < 1.25) {
    // un chedi : la cloche, les anneaux, la flèche (même profil que celui du sommet)
    const r = Math.min(L, W) / 2 * 0.9, g = new THREE.LatheGeometry([[0, 0], [r, 0], [r * 1.02, r * 0.18], [r * 0.95, r * 0.62], [r * 0.76, r * 1.0], [r * 0.48, r * 1.3], [r * 0.22, r * 1.42], [0, r * 1.45]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    g.translate(cx, haut, cz); TEMPLE.blanc.push(g.toNonIndexed());
    const fl = new THREE.ConeGeometry(r * 0.16, r * 1.6, 10); fl.translate(cx, haut + r * 1.45 + r * 0.8, cz); TEMPLE.or.push(fl.toNonIndexed());
    return true;
  }
  // les étages du toit : chacun plus court, posé un peu plus haut que le précédent
  const n = L > 18 ? 3 : 2;
  for (let k = 0; k < n; k++) {
    const la = L / 2 + 1.2 - k * L * 0.14, lb = W / 2 + 1.0 - k * 0.6, y0 = haut + k * 1.6, hf = lb * 1.35;
    const v = [P(-la, -lb, y0), P(la, -lb, y0), P(la, 0, y0 + hf), P(-la, 0, y0 + hf), P(-la, lb, y0), P(la, lb, y0)];
    const dst = k === 0 ? TEMPLE.vert : TEMPLE.rouge;
    tri(dst, v[0], v[1], v[2]); tri(dst, v[0], v[2], v[3]); tri(dst, v[4], v[3], v[2]); tri(dst, v[4], v[2], v[5]);
    if (k === n - 1) {
      tri(TEMPLE.or, v[0], v[3], v[4]); tri(TEMPLE.or, v[1], v[5], v[2]);             // les pignons dorés
      for (const s of [-1, 1]) { const c = new THREE.ConeGeometry(0.22, 2.2, 6); c.rotateZ(-s * 0.5); const q = P(s * la, 0, y0 + hf); c.translate(q[0], q[1] + 0.9, q[2]); TEMPLE.or.push(c.toNonIndexed()); }
    }
  }
  return true;
}
function templesThai({ scene }) {
  const geo = (v) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const p = g.attributes.position, uv = []; for (let k = 0; k < p.count; k++) uv.push(p.getX(k) + p.getZ(k), p.getY(k)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; };
  const fondre = (l) => mergeGeometries(l.map((g) => { if (!g.attributes.uv) { const p = g.attributes.position, uv = []; for (let k = 0; k < p.count; k++) uv.push(p.getX(k) + p.getZ(k), p.getY(k)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); } for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }));
  const tuiles = (c) => phMat('clay_roof_tiles_02', 1, 1, { color: c, side: THREE.DoubleSide });
  for (const [v, m] of [[TEMPLE.rouge, tuiles(0xc04a2a)], [TEMPLE.vert, tuiles(0x5a9a5a)]]) if (v.length) { const x = new THREE.Mesh(geo(v), m); x.castShadow = x.receiveShadow = true; scene.add(x); }
  const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
  const pignons = [], autres = []; for (const g of TEMPLE.or) (Array.isArray(g) || typeof g === 'number' ? pignons : autres).push(g);
  if (pignons.length) scene.add(new THREE.Mesh(geo(pignons), or));
  if (autres.length) scene.add(new THREE.Mesh(fondre(autres), or));
  if (TEMPLE.blanc.length) { const x = new THREE.Mesh(fondre(TEMPLE.blanc), phMat('chaux_craquelee', 3, 3, { color: 0xf2eee4 })); x.castShadow = true; scene.add(x); }
}

// ---------- le marché flottant de Ko Panyi ----------
// SCENARIO.md § 12 : les passeurs vivent sur l'eau, « au marché flottant : barques chargées
// de fruits, de riz, de fleurs, qu'on enjambe d'une à l'autre ». Il remplit le bassin abrité
// que les passerelles de Ko Panyi enferment au sud du ponton (x 75–125, z 22–60) : deux files
// de barques bord à bord, qui relient la passerelle du nord à celle du sud. On y marche
// (solLieu) ; la mer, elle, bouge encore — les barques tanguent un peu.
const MARCHE = [];        // { x, z, rot, L, W }
let HAUT = null;
function solMarche(x, z) {
  for (const b of MARCHE) {
    const dx = x - b.x, dz = z - b.z, c = Math.cos(b.rot), s = Math.sin(b.rot);
    const long = dx * s + dz * c, trav = dx * c - dz * s;          // la barque a sa longueur sur son z local
    if (Math.abs(long) < b.L / 2 && Math.abs(trav) < b.W / 2) return Math.max(0.55, HAUT ? HAUT(x, z) : 0);
  }
  return null;
}
function marche({ hauteur, addInteract }) {
  HAUT = hauteur;
  const bois = phMat('wood_planks', 1.2, 1.2, { color: 0x8a6a48 }), coques = [], fruits = { jaune: [], orange: [], rose: [], vert: [], blanc: [] }, paniers = [], baches = [], perches = [];
  const COUL = { jaune: 0xe8c040, orange: 0xe07820, rose: 0xd84878, vert: 0x6aa040, blanc: 0xf2eee0 };
  for (const x of [92, 100.4]) for (let k = 0; k < 20; k++) {
    const z = 21.5 + k * 2.0 + rand(-0.08, 0.08), rot = Math.PI / 2 + rand(-0.04, 0.04);
    // le rectangle où l’on marche déborde un peu la coque : entre deux barques bord à bord, pas de fente où tomber
    const b = { x, z, rot, L: 8.7, W: 2.3 }; MARCHE.push(b);
    // la coque : un fuseau de bois, le pont à 0,5 m au-dessus de l'eau
    const h = new THREE.LatheGeometry([[0, -0.35], [0.7, -0.3], [0.95, 0.15], [1.0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
    h.scale(1, 1, 4.2); h.rotateY(rot); h.translate(x, 0, z); coques.push(h.toNonIndexed());
    // le plancher : sans lui, la coque ouverte montrait la mer à l'intérieur, comme une barque coulée
    const pl = new THREE.BoxGeometry(1.75, 0.08, 7.4); pl.rotateY(rot); pl.translate(x, 0.47, z); coques.push(pl.toNonIndexed());
    // le chargement : deux paniers d'osier pleins de fruits ou de fleurs, posés aux bouts
    for (const bout of [-2.2, 2.2]) { if (Math.random() < 0.25) continue;
      const px = x + Math.sin(rot) * bout, pz = z + Math.cos(rot) * bout;
      const p = new THREE.CylinderGeometry(0.42, 0.32, 0.32, 10, 1, true); p.translate(px, 0.7, pz); paniers.push(p.toNonIndexed());
      const sorte = ['jaune', 'orange', 'rose', 'vert', 'blanc'][Math.floor(Math.random() * 5)];
      for (let f = 0; f < 7; f++) { const g = new THREE.SphereGeometry(sorte === 'blanc' ? 0.07 : 0.11, 6, 4); g.translate(px + rand(-0.25, 0.25), 0.86 + rand(0, 0.08), pz + rand(-0.25, 0.25)); fruits[sorte].push(g.toNonIndexed()); } }
    // une barque sur trois a sa bâche contre la pluie (arrêtée, elle aussi, au-dessus)
    if (k % 3 === 1) { const t = new THREE.PlaneGeometry(2.6, 2.2); t.rotateX(-Math.PI / 2 + 0.12); t.rotateY(rot); t.translate(x, 2.3, z); baches.push(t);
      for (const [a, c] of [[-1.1, -0.9], [1.1, -0.9], [-1.1, 0.9], [1.1, 0.9]]) { const p = new THREE.CylinderGeometry(0.03, 0.03, 1.9, 5); p.translate(x + c * Math.cos(rot) + a * Math.sin(rot), 1.4, z - c * Math.sin(rot) + a * Math.cos(rot)); perches.push(p.toNonIndexed()); } }
  }
  const ajoute = (l, m, ombre = true) => { if (!l.length) return null; const g = mergeGeometries(l.map((x) => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal'].includes(k)) x.deleteAttribute(k); x.computeVertexNormals(); return x; }));
    const p = g.attributes.position, uv = []; for (let k = 0; k < p.count; k++) uv.push(p.getX(k) + p.getZ(k), p.getY(k) * 2); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const o = new THREE.Mesh(g, m); o.castShadow = ombre; o.receiveShadow = true; scene.add(o); return o; };
  MARCHE.coques = ajoute(coques, bois);
  ajoute(paniers, phMat('dry_branches_01', 1, 1, { color: 0xc8a060, side: THREE.DoubleSide }));
  for (const [k, l] of Object.entries(fruits)) ajoute(l, new THREE.MeshStandardMaterial({ color: COUL[k], roughness: 0.55 }), false);
  ajoute(baches, phMat('fabric_pattern_07', 2, 2, { color: 0x3a6aa0, side: THREE.DoubleSide }));
  ajoute(perches, bois);
  // les marchandes et les passeurs du marché, dans leurs barques : eux ne sont pas figés — ils
  // vivent sur l'eau, où le temps passe encore. Ce sont les gens à qui l'on parle dans ce monde
  // (SCENARIO.md § 12). Des rôles de la baie (4 octobre) : les villageois de Lille portaient une
  // lanterne, une hache, une coiffe flamande.
  MARCHANDES.forEach(({ col, k, role, haut, qui, dit }) => {
    const b = MARCHE[col * 20 + k], v = gensDeLeau(role, haut); if (!v) return;
    v.position.set(b.x + rand(-1.2, 1.2), 0.5, b.z); v.rotation.y = rand(0, TAU); scene.add(v);
    addInteract({ pos: v.position, r: 3, prompt: () => 'parler ' + (qui === 'Le marchand' ? 'au marchand' : 'à la marchande'), fn: () => dialogue(dit().map((text) => ({ who: qui, text }))) });
  });
}
// une femme de la baie : le rôle de Nok, recoloré, sous le chapeau conique de feuilles ; un
// homme : le vieux pêcheur, recoloré (il a son chapeau de paille)
const CHAPEAU = () => { const g = new THREE.Group(); g.add(mesh(new THREE.ConeGeometry(0.26, 0.13, 14, 1, true), phMat('dry_branches_01', 1, 1, { color: 0xd8c08a, side: THREE.DoubleSide }), 0, 0, 0)); return g; };
function gensDeLeau(role, haut) {
  const v = PNJ.buildRole(role, haut); if (!v) return null;
  if (role === 'nok') PNJ.socket(v, v.userData.perso, 'Head', CHAPEAU(), [0.027, 0.2, -0.055]);
  VENDEURS.push(v); return v;
}
// Ce qu'ils disent : court, en habitants, et ça mène quelque part (le passeur, Nok, le câble).
const MARCHANDES = [
  { col: 0, k: 2, role: 'nok', haut: 0xc0503a, qui: 'La marchande', dit: () => ['Des mangues, du riz gluant, des fleurs de lotus !', 'Sur l’eau, le temps passe encore. Alors on vend.'] },
  { col: 1, k: 5, role: 'nok', haut: 0x3a7a5a, qui: 'La marchande', dit: () => ['Tu veux aller sur une autre île ? Somsak attend au ponton, au bout du marché.', 'Il est vieux, mais il connaît toutes les passes.'] },
  { col: 0, k: 8, role: 'nok', haut: 0xd8a040, qui: 'La marchande', dit: () => state.gongThai
    ? ['Tu as le gong de Nok ! Frappe-le près des moines du grand piton.', 'Ils finiront leurs phrases. Un peu.']
    : ['Là-haut, devant l’arche de pierre, il y a la petite Nok.', 'C’est la seule qui bouge encore sur l’île. Va la voir.'] },
  { col: 1, k: 11, role: 'pecheur', haut: 0x5a6a8a, qui: 'Le marchand', dit: () => ['Ce câble descend du grand piton jusqu’à nos barques.', 'Les moines y faisaient passer le riz. Maintenant, plus personne.'] },
  { col: 0, k: 12, role: 'nok', haut: 0x8a4a7a, qui: 'La marchande', dit: () => ['Marche doucement, d’une barque à l’autre. Elles bougent.', 'Nous aussi, on bouge. Les îles, non.'] },
];
const VENDEURS = [];

// ---------- la tyrolienne ----------
// SCENARIO.md § 12 : les moines font passer leurs vivres d'un sommet à l'autre sur des câbles,
// avec une poulie. LA règle, tenue par la machine : on ne glisse que vers le BAS — un câble
// dont l'arrivée n'est pas plus basse que le départ n'est pas posé. Le grand piton s'atteint
// ainsi depuis le belvédère des moines de Phi Phi (aucun passeur n'y accoste, dans l'histoire), et
// de lui un câble immense plonge jusqu'au marché flottant. (La poulie du moine cuisinier viendra
// avec le cloître ; d'ici là, la tyrolienne est libre.)
// Les îles resserrées (4 octobre) : les anciens départs, le belvédère 2 de Phi Phi et celui de
// Railay, sont hors des cœurs. Phi Phi part du haut de l'escalier des moines (extraire-thailande.py,
// ESCALIER) ; Railay, du haut du sentier qui monte au sud du village.
// Le 5 octobre, le parcours au banc (une recherche de chemin depuis le départ) : l'arrivée en
// (976, 322) était à mi-falaise (74 m, une pente de 4,8 m par mètre) et le départ vers le marché au
// bord du plateau — le sommet, ses balayeurs et la clé du cloître ne s'atteignaient qu'en grimpant
// la paroi. Les deux sont sur le plateau (110–119 m) ; l'arrivée au nord, pour que la corde passe
// à 49 m du second chedi (Phra Chedi Khiri, (997, 383)) au lieu de le traverser.
const CABLES = [
  { nom: 'vers le grand piton', de: [2605, 1790], a: [915, 362] },          // le belvédère des moines, Phi Phi (~131 m) → le nord du plateau du sommet (~113 m)
  { nom: 'vers le marché flottant', de: [948, 322], a: [96, 32] },          // le plateau, au sud de la cour du puits (~112 m) → les barques de Ko Panyi
  { nom: 'vers la plage de Railay', de: [-587, 1920], a: [-650, 1534] },     // le haut du sentier de Railay (51 m) → Ao Rai Le
];
const PENDU = 2.1;            // de la poulie aux pieds de Camille
let GLISSE = null;
function cablePoint(c, t) {
  // une chaînette approchée : la corde, et une flèche de 2 % de la portée au milieu
  return new THREE.Vector3(c.p0.x + (c.p1.x - c.p0.x) * t, c.p0.y + (c.p1.y - c.p0.y) * t - c.fleche * 4 * t * (1 - t), c.p0.z + (c.p1.z - c.p0.z) * t);
}
function tyroliennes({ hauteur, addInteract }) {
  const acier = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: 0.7, roughness: 0.45 }), bois = phMat('tree_trunk', 1, 1, { color: 0x6a5038 });
  for (const c of CABLES) {
    const y0 = hauteur(...c.de), y1 = Math.max(hauteur(...c.a), 0.55);
    if (!(y1 < y0 - 2)) { console.warn('tyrolienne refusée (elle monterait) :', c.nom); continue; }       // la règle
    c.p0 = new THREE.Vector3(c.de[0], y0 + 4.2, c.de[1]); c.p1 = new THREE.Vector3(c.a[0], y1 + 3.6, c.a[1]);
    c.long = c.p0.distanceTo(c.p1); c.fleche = c.long * 0.02;
    c.p0.y += c.fleche * 0.3;                     // que la corde ne frôle pas la crête au départ
    const pts = []; for (let k = 0; k <= 60; k++) pts.push(cablePoint(c, k / 60));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.05, 5), acier));
    // les deux potences : un poteau, une traverse, le câble y est noué
    for (const [p, y] of [[c.p0, y0], [c.p1, y1]]) {
      const g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.y = Math.atan2(c.p1.x - c.p0.x, c.p1.z - c.p0.z); scene.add(g);
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, p.y - y + 0.6, 7), bois, 0, (p.y - y + 0.6) / 2, 0));
      g.add(mesh(boxG(1.6, 0.18, 0.18), bois, 0, p.y - y, 0));
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    c.duree = Math.min(28, Math.max(7, c.long / 55));
    addInteract({ pos: new THREE.Vector3(c.de[0], y0, c.de[1]), r: 4, prompt: () => 's’accrocher au câble — ' + c.nom, fn: () => glisser(c) });
  }
}
function glisser(c) {
  if (GLISSE) return;
  GLISSE = { c, t: 0 };
  player.yaw = Math.atan2(c.p1.x - c.p0.x, c.p1.z - c.p0.z); G.camYaw = player.yaw;
  showMessage('Tu passes la sangle dans la poulie des moines, et tu te laisses aller…', 3);
  SFX.roll && SFX.roll();
}
function animeGlisse(dt) {
  if (!GLISSE) return;
  const g = GLISSE; g.t = Math.min(1, g.t + dt / g.c.duree);
  // la poulie part doucement, file au milieu, freine au bout (sinon on s'écrase sur la potence)
  const s = g.t * g.t * (3 - 2 * g.t);
  const q = cablePoint(g.c, Math.min(1, Math.max(0, s)));
  player.pos.set(q.x, q.y - PENDU, q.z); player.vy = 0; player.fallFrom = player.pos.y;
  if (g.t >= 1) {
    const [x, z] = g.c.a, y = HAUT ? HAUT(x, z) : 0; player.pos.set(x, Math.max(y, 0.55), z); player.fallFrom = player.pos.y; player.vy = 0;
    GLISSE = null; showMessage('Les pieds touchent. ' + g.c.nom.replace('vers ', '').replace(/^./, (l) => l.toUpperCase()) + '.', 3);
  }
}

// ---------- Nok, le gong, les moines figés ----------
// SCENARIO.md § 12 : sur les îles, tout s'est arrêté au milieu d'un geste et d'une phrase ;
// seule Nok bouge encore — elle frappait le gong du temple quand le temps s'est arrêté. Elle
// donne le gong : K le frappe, et le temps repart six secondes autour de Camille (la pluie
// tombe, les moines finissent leur geste et leur phrase). L'enquête du cloître est celle du
// scénario : trois moines, chacun un bout de phrase, puis trois balayeurs dans la cour du
// puits — un seul a quelque chose dans la manche gauche. Le cloître, provisoirement, est le
// grand piton, faute d'avoir encore bâti l'île du cloître.
const GONG = { fin: -1, r: 16 };
const FIGES = [];        // { g, x, z, texte, fini, cle, mauvais }
let NOK = null;
const gongActif = () => performance.now() < GONG.fin;
function frapperGong() {
  if (!state.gongThai || gongActif()) return;
  SFX.gong(); GONG.fin = performance.now() + 6000; GONG.x = player.pos.x; GONG.z = player.pos.z;
  showMessage('Le gong résonne. Autour de toi, le temps repart.', 3);
}
function poserLibre(bloque, hauteur, x0, z0) {
  for (let r = 0; r < 30; r += 1) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (!bloque(x, z, 0.8) && hauteur(x, z) > 1) return [x, z]; }
  return [x0, z0];
}
function balai() {
  const g = new THREE.Group(), bois = new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.9 });
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), bois, 0, -0.5, 0));
  g.add(mesh(new THREE.ConeGeometry(0.14, 0.4, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xb89a5a, roughness: 1, side: THREE.DoubleSide }), 0, -1.25, 0));
  return g;
}
function cle() { const g = new THREE.Group(), or = new THREE.MeshStandardMaterial({ color: 0xd8b050, metalness: 0.9, roughness: 0.25, emissive: 0x3a2a08 });
  g.add(mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), or, 0, 0.05, 0)); g.add(mesh(boxG(0.012, 0.1, 0.012), or, 0, -0.02, 0)); return g; }
function figer(role, x, z, yaw, texte, extra = {}) {
  const g = PNJ.buildRole(role, extra.haut ?? null); if (!g) return null;
  g.position.set(x, 0, z); g.rotation.y = yaw; scene.add(g);
  // un enfant : pnj.js n'en a pas (Demandes pour pnj.js) ; le rôle de Nok ramené à 1,1 m
  if (extra.enfant) g.scale.setScalar(0.72);
  const F = { g, x, z, texte, t0: rand(0.3, 2.5), pose: false, ...extra };
  if (role === 'balayeur') PNJ.socket(g, g.userData.perso, 'hand_r', balai(), [0, 0.05, 0.02], [0.3, 0, 0]);
  if (extra.cle) { F.objetCle = cle(); PNJ.socket(g, g.userData.perso, 'hand_l', F.objetCle, [0, 0.12, 0.03], [0, 0, 0]); }
  FIGES.push(F); return F;
}
// le point de chemin (OSM) le plus proche, à 25 m au plus : un passant posé « à peu près là » finissait
// dans une cour fermée ou au milieu des fourrés (le parcours du 5 octobre : deux figés de Railay
// hors d'atteinte). À la même hauteur seulement : un moine du plateau ne descend pas au pied de la falaise.
function surChemin(PLAN, hauteur, x0, z0) {
  let b = [x0, z0], d = 25; const h0 = hauteur(x0, z0);
  for (const c of [...PLAN.chemins, ...PLAN.routes]) for (const [x, z] of c.pts) { const e = Math.hypot(x - x0, z - z0); if (e < d && Math.abs(hauteur(x, z) - h0) < 4) { d = e; b = [x, z]; } }
  return b;
}
function habitants({ hauteur, bloque, addInteract, PLAN }) {
  // Nok, devant la grotte de la porte, au pied du rocher de Ko Panyi
  { const [x, z] = poserLibre(bloque, hauteur, 70, -62);
    NOK = PNJ.buildRole('nok');
    if (NOK) { NOK.position.set(x, hauteur(x, z), z); NOK.rotation.y = Math.atan2(104 - x, 10 - z); scene.add(NOK);
      addInteract({ pos: new THREE.Vector3(x, hauteur(x, z), z), r: 3.5, prompt: () => 'parler à Nok', fn: parlerNok }); } }
  // les trois moines de l'enquête, devant le Wat Tham Suea, et les balayeurs de la cour
  const M = [
    // (5 octobre) entre le temple et l'escalier, qui a pris la place où ils étaient
    [912, 281, '« …la clé du cloître, c’est le balayeur qui l’avait… »'],
    [926, 282, '« …Somchai balaie toujours la cour du puits… »'],
    [938, 285, '« …il cache la clé dans sa manche gauche… »'],
  ];
  for (const [ax, az, texte] of M) { const [x, z] = poserLibre(bloque, hauteur, ax, az); figer('moine', x, z, rand(0, TAU), texte); }
  const B = [[905, 335, false], [915, 345, true], [898, 350, false]];
  for (const [ax, az, bon] of B) { const [x, z] = poserLibre(bloque, hauteur, ax, az); figer('balayeur', x, z, rand(0, TAU), null, { cle: bon && !state.cleCloitre, balayeur: true, bon }); }
  // les habitants des îles, figés comme les moines au milieu d'un geste et d'une phrase : le gong
  // la leur fait finir. Ce qu'ils disaient mène quelque part (un quai, un câble, un temple).
  for (const [role, haut, ax, az, desc, texte, enfant] of HABITANTS) { const [x, z] = poserLibre(bloque, hauteur, ...surChemin(PLAN, hauteur, ax, az));
    figer(role, x, z, rand(0, TAU), texte, { haut, desc, enfant, qui: enfant ? 'L’enfant' : role === 'nok' ? 'La femme' : haut == null ? 'Le moine' : 'L’homme' }); }
  for (const F of FIGES) { F.g.position.y = hauteur(F.x, F.z);
    addInteract({ pos: F.g.position, r: 3, prompt: () => F.balayeur ? 'regarder le balayeur' : F.desc ? 'regarder ' + ({ 'La femme': 'la femme figée', 'L’enfant': 'l’enfant figé', 'Le moine': 'le moine figé' }[F.qui] || 'l’homme figé') : 'écouter le moine', fn: () => parlerFige(F) }); }
  if (state.gongThai) AIDE.extra.push(['K', 'frapper le gong']);
  TOUCHES.KeyK = frapperGong;
}
const HABITANTS = [
  ['moine', 0x3a5a7a, -95, -50, 'Un homme figé devant la mosquée, la main tendue vers la mer.', '« …les passeurs ? Ils vivent sur l’eau, maintenant. Ils n’osent plus accoster… »'],
  ['nok', 0xb04a3a, -578, 1627, 'Une femme figée sur le seuil de sa boutique, un sac de riz sur l’épaule.', '« …les barques accostent à la plage de l’ouest, au ponton… »'],
  ['moine', 0x6a5a3a, -572, 1845, 'Un homme figé au pied du sentier, le pied levé sur une marche.', '« …ce sentier monte jusqu’au câble des moines, au-dessus du village… »'],
  ['nok', 0x3a7a8a, 2320, 1830, 'Une femme figée au milieu de la rue, un panier de noix de coco dans les bras.', '« …l’escalier des moines, derrière le village, tout en haut de la colline… »'],
  ['moine', 0x7a3a3a, 2205, 1905, 'Un homme figé près du ponton, une corde à la main.', '« …de là-haut, on voit toutes les îles de la baie… »'],
  // le 5 octobre : les enfants de Ko Panyi, un moine à chaque bout de câble, une vendeuse devant
  // Ko Tapu. Des gens de passage : ils disent le lieu, ou mènent quelque part ; aucun secret.
  ['nok', 0xd8b040, 66, 44, 'Un enfant figé au bord de la passerelle, les bras en l’air, prêt à sauter dans l’eau.', '« …le dernier dans l’eau a perdu !… »', true],
  ['nok', 0x5a7aa0, -186, -52, 'Un enfant figé devant l’école, les mains sur les yeux.', '« …quatre-vingt-dix-huit, quatre-vingt-dix-neuf, cent ! J’arrive !… »', true],
  ['nok', 0xc06a3a, -676, 562, 'Une vendeuse figée sur la grève, un collier de coquillages tendu vers le large.', '« …Ko Tapu, le clou ! Un jour, la mer le fera tomber, mais pas aujourd’hui… »'],
  ['moine', null, 944, 327, 'Un moine figé près du câble, une corbeille de riz à ses pieds.', '« …le câble descend jusqu’au marché flottant. On n’y monte jamais : on ne fait que descendre… »'],
  ['moine', null, 2596, 1796, 'Un moine figé au bout de l’escalier, la main sur la poulie.', '« …accroche-toi bien : le câble porte jusqu’au grand piton… »'],
];
function parlerNok() {
  if (!state.gongThai) dialogue([
    { who: 'Nok', text: 'Tu bouges ! Toi aussi, tu bouges !' },
    { who: 'Nok', text: 'Je frappais le gong du temple quand tout s’est arrêté. La pluie, les moines, les clochettes. Moi, je suis restée.' },
    { who: 'Nok', text: 'Les passeurs ont peur d’accoster. Ils disent que les îles mangent le temps.' },
    { who: 'Nok', text: 'Prends le petit gong. Frappe-le près de ce qui est figé : ça repart, un peu. Pas longtemps.' },
    { text: 'Nok te donne le petit gong du temple. (K : frapper le gong)', fn: () => { state.gongThai = true; AIDE.extra.push(['K', 'frapper le gong']); SFX.gong(); } },
    { who: 'Nok', text: 'Les moines du grand piton parlaient de la clé du cloître. Ils ne finissent plus leurs phrases.' },
  ]);
  else dialogue([{ who: 'Nok', text: state.cleCloitre ? 'La clé du cloître ! Ce que tu as commencé…' : 'Frappe le gong près des moines. Ils finiront leurs phrases.' }]);
}
function parlerFige(F) {
  const vivant = gongActif() && Math.hypot(F.x - GONG.x, F.z - GONG.z) < GONG.r;
  if (!F.balayeur) {
    if (!vivant) return showMessage((F.desc || 'Le moine est figé, la bouche ouverte, au milieu d’un mot.') + (state.gongThai ? ' (K : le gong)' : ''), 3.5);
    F.fini = true; return showMessage((F.qui || 'Le moine') + ' finit sa phrase : ' + F.texte, 6);
  }
  if (!vivant) return showMessage('Un moine figé, le balai levé. Sa manche ' + (F.bon && !state.cleCloitre ? 'gauche est pliée bizarrement.' : 'pend, toute droite.'), 3.5);
  if (F.bon && !state.cleCloitre) {
    state.cleCloitre = true; if (F.objetCle) F.objetCle.visible = false; SFX.dizaine();
    return showMessage('Le balai repart, la manche se déplie : une clé tombe sur les dalles. La clé du cloître !', 6);
  }
  showMessage('Le balai repart, deux coups sur les dalles… rien ne tombe de ses manches.', 4);
}
function animeHabitants(dt) {
  if (NOK && NOK.userData.ctrl) PNJ.animeVillageois(NOK, dt, false);
  const actif = gongActif();
  for (const F of FIGES) { const c = F.g.userData.ctrl; if (!c) continue;
    // figé : la pose d'un instant choisi au hasard, une fois pour toutes ; le gong le relance
    if (!F.pose) { c.jouer(F.g.userData.idle, 0); c.update(F.t0); F.pose = true; }
    else if (actif && Math.hypot(F.x - GONG.x, F.z - GONG.z) < GONG.r) c.update(dt); }
  if (actif) PLUIE.chute = (PLUIE.chute + dt * 9) % PLUIE.pas;
}

// ---------- la garde : là où l'on ne passe plus ----------
// Les îles sont ramenées à leur cœur (extraire-thailande.py, COEURS : PLAN.morceaux[m].coeur). Le
// reste de l'île est une falaise (le relief la dresse à BORD() du cœur) ou de la jungle ; on y
// bloque le passage à BORD() + 3 m — au pied de la falaise, pas avant, que la rue coupée y mène.
// Posé APRÈS la jungle, qui évite ce qui est bloqué : la garde garde ses arbres.
const BORD = (x, z) => 8 + 4 * (Math.sin(x / 23) + Math.sin(z / 17 + 1.3));     // la même que bord_coeur(), recolter-relief-thailande.py
function garde({ hauteur, inscrire, PLAN }) {
  const pas = 4;
  for (const M of Object.values(PLAN.morceaux || {})) {
    if (!M.coeur || M.mode === 'ile') continue;          // le grand piton : la mer fait la limite
    const [cx0, cx1, cz0, cz1] = M.coeur;
    const hors = (x, z) => Math.hypot(Math.max(cx0 - x, 0, x - cx1), Math.max(cz0 - z, 0, z - cz1)) > BORD(x, z) + 3 && hauteur(x, z) > 0.2;
    // par rangées de 4 m, les cases bloquées bout à bout ne font qu'un rectangle
    for (let z = M.z0; z < M.z1; z += pas) {
      let debut = null;
      for (let x = M.x0; x <= M.x1; x += pas) {
        const b = x < M.x1 && hors(x + pas / 2, z + pas / 2);
        if (b && debut === null) debut = x;
        if (!b && debut !== null) { inscrire([[debut, z], [x, z], [x, z + pas], [debut, z + pas]], (debut + x) / 2, z + pas / 2); debut = null; }
      }
    }
  }
}

// ---------- la pluie suspendue ----------
// Des gouttes immobiles autour de Camille : un pavé de 40 m répété en 3 × 3 × 2, recalé tous
// les 40 m — la même goutte reste au même endroit du monde, elle ne suit pas Camille.
const PLUIE = { tuiles: [], pas: 40, chute: 0 };
function pluie({ scene }) {
  const v = [], N = 900;
  for (let k = 0; k < N; k++) { const x = Math.random() * 40, y = Math.random() * 40, z = Math.random() * 40, l = rand(0.25, 0.5); v.push(x, y, z, x, y - l, z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const m = new THREE.LineBasicMaterial({ color: 0xd8e4f0, transparent: true, opacity: 0.4, depthWrite: false });
  for (let k = 0; k < 18; k++) { const l = new THREE.LineSegments(g, m); l.frustumCulled = false; scene.add(l); PLUIE.tuiles.push(l); }
}
function placerPluie() {
  const P = PLUIE.pas, bx = Math.floor(player.pos.x / P), by = Math.floor(player.pos.y / P), bz = Math.floor(player.pos.z / P);
  let k = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let e = 0; e <= 1; e++) PLUIE.tuiles[k++].position.set((bx + i) * P, (by + e - 0.5) * P - PLUIE.chute, (bz + j) * P);
}

// ---------- les passeurs ----------
const BARQUES = [], ANIME = {};
// qui tient la barque de chaque quai (STORY.md : Somsak, Mali, le passeur muet ; ailleurs, un
// batelier sans nom). Ils sont DANS la barque, et tanguent avec elle.
const BATELIERS = { panyi: ['pecheur', 0x6a7a5a], tapu: ['nok', 0x3a6aa0], suea: ['pecheur', 0x3a3a38], railay: ['pecheur', 0x8a5a3a], phiphi: ['pecheur', 0x4a5a7a] };
function barque(x, z, rot, pilote) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
  if (pilote) { const v = gensDeLeau(...pilote); if (v) { v.position.set(0, 0.45, 5.6); v.rotation.y = Math.PI; g.add(v); } }
  const bois = phMat('wood_planks', 1.5, 1.5, { color: 0x7a5a3a });
  const coque = new THREE.LatheGeometry([[0, 0], [0.75, 0.05], [0.95, 0.5], [1.0, 0.9]].map(([r, h]) => new THREE.Vector2(r, h)), 12);
  coque.scale(1, 1, 7.5); const c = mesh(coque, bois, 0, -0.3, 0); g.add(c);
  // la proue relevée, enrubannée comme le veut la coutume, et le long arbre du moteur
  const proue = mesh(new THREE.CylinderGeometry(0.08, 0.2, 2.6, 6), bois, 0, 1.1, -7.4); proue.rotation.x = -0.6; g.add(proue);
  g.add(mesh(new THREE.ConeGeometry(0.22, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xc83a5a, roughness: 0.8 }), 0, 2.2, -8.1));
  const arbre = mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 5), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.6, roughness: 0.4 }), 0, 0.4, 8.4); arbre.rotation.x = 1.35; g.add(arbre);
  g.add(mesh(boxG(0.7, 0.6, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a4a48, metalness: 0.5, roughness: 0.5 }), 0, 0.9, 6.4));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  BARQUES.push({ g, x, z, rot, ph: Math.random() * TAU });
}
function passeurs({ hauteur, addInteract }) {
  for (const [m, Q] of Object.entries(QUAIS)) {
    barque(Q.barque[0], Q.barque[1], Math.atan2(Q.barque[0] - Q.ici[0], Q.barque[1] - Q.ici[1]), BATELIERS[m]);   // la proue vers le large
    addInteract({ pos: new THREE.Vector3(Q.ici[0], hauteur(...Q.ici), Q.ici[1]), r: 9, prompt: () => 'parler au passeur',
      fn: () => showMenu('LE PASSEUR', Q.nom, PASSEUR[m], [
        ...Object.entries(QUAIS).filter(([n]) => n !== m).map(([n, D]) => ({ label: 'Vers ' + D.nom, fn: () => traverser(D, hauteur) })),
        { label: 'Rester ici', fn: () => { hideMenu(); state.paused = false; } }]) });
  }
}
// Les pêcheurs : une barque près de la grève, à portée de voix. Sur l'eau, ils vivent ; ils
// disent où l'on est et où aller (les îles, elles, ne répondent plus).
const PECHEURS = [
  { nom: 'Railay', barque: [-294, 1760], rive: [-302, 1763], dit: ['Railay. On n’y vient qu’en barque : les falaises ferment tout le reste.', 'Le sentier au sud du village monte jusqu’au câble des moines. Il redescend sur la plage de l’ouest, au ponton.'] },
  { nom: 'Ko Panyi', pres: [-30, 140], dit: ['Ko Panyi. Tout le village tient sur des pieux, au-dessus de l’eau.', 'Les maisons ne bougent plus. Nous, on pêche quand même : la mer, elle, n’a rien vu.', 'La porte de pierre est au pied du rocher, au nord. La petite Nok traîne par là.'] },
  { nom: 'Khao Phing Kan', pres: [-668, 545], dit: ['Le clou de pierre, là, dans l’eau ? C’est Ko Tapu.', 'Mali n’aime pas rester près des pitons. Elle dit qu’ils mangent le temps. Moi, je reste dans ma barque.'] },
  { nom: 'Ton Sai', barque: [2126, 1927], rive: [2130, 1919], dit: ['Ton Sai. Avant, ça criait partout : les bateaux, le marché. Maintenant, plus rien.', 'L’escalier des moines est derrière le village, sur la colline de l’est. En haut, un câble part vers le grand piton.'] },
];
function pecheurs({ hauteur, bloque, addInteract }) {
  for (const P of PECHEURS) {
    // sans place relevée : le premier bord praticable près de `pres` qui a de l'eau à 8 m
    if (!P.barque) trouve: for (let r = 0; r < 45; r += 1.5) for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU, x = P.pres[0] + Math.cos(a) * r, z = P.pres[1] + Math.sin(a) * r;
      if (bloque(x, z, 0.6) || hauteur(x, z) < 0.9) continue;
      for (let q = 0; q < 12; q++) { const b = q / 12 * TAU, bx = x + Math.cos(b) * 8, bz = z + Math.sin(b) * 8;
        if (hauteur(bx, bz) < -0.3 && hauteur(x + Math.cos(b) * 4, z + Math.sin(b) * 4) < 0.3) { P.rive = [x, z]; P.barque = [bx, bz]; break trouve; } }
    }
    if (!P.barque) continue;
    barque(P.barque[0], P.barque[1], Math.atan2(P.barque[0] - P.rive[0], P.barque[1] - P.rive[1]) + 1.2, ['pecheur', 0x6a5a48]);
    addInteract({ pos: new THREE.Vector3(P.rive[0], hauteur(...P.rive), P.rive[1]), r: 7, prompt: () => 'parler au pêcheur', fn: () => dialogue(P.dit.map((text) => ({ who: 'Le pêcheur', text }))) });
  }
}

// La traversée : un fondu au noir, et Camille est sur l'autre quai. Le passeur ne s'attarde pas.
function traverser(D, hauteur) {
  hideMenu();
  fadeTo(1, () => {
    const [x, z] = D.ici; player.pos.set(x, hauteur(x, z), z);
    player.yaw = Math.atan2(D.ici[0] - D.barque[0], D.ici[1] - D.barque[1]); G.camYaw = player.yaw;
    placerPluie(); state.paused = false; fadeTo(0, null);
    showMessage('La barque file entre les pitons. ' + D.nom.charAt(0).toUpperCase() + D.nom.slice(1) + '.', 4);
  });
}

monde({
  name: 'thailande', titre: 'La baie des pitons', musique: 'eau', h0: 0,
  plan: 'thailande.json', fin: 'relief-thailande.json',
  // la mousson arrêtée : un ciel bas et laiteux, une lumière sans ombre franche, la brume chaude.
  // La brume ne commence qu'à 700 m : à 260, la vue d'ensemble de la baie (îles à 1,5–2,5 km) n'était
  // plus qu'un voile blanc. Elle finit à 3 200 m, là où la caméra coupe (engine.js) : rien ne s'y
  // découpe net.
  ciel: [0x6a7884, 0xaab4b4, 0xd4d8cc], brume: [0xbcc6c0, 700, 3200], soleil: [-120, 260, 80, 2.2], soleilCouleur: 0xf4ecdc,
  sol: ['grass_ground', 0x8aa070], mer: 0, merCouleur: 0x2e7a78, merPoli: 0.12, merMetal: 0.55,
  murs: ['chaux_craquelee', 0xe4dccc], toit: { style: 'deuxPans', slug: 'clay_roof_tiles_02', couleur: 0xa84a2a, pente: 0.9, hMax: 4.5 }, hMurs: [3.2, 4.6],
  chemin: ['rocky_trail', 0xb8a888],
  socleMax: 2.5, socle: ['old_stone_wall_02', 0xb0a490],
  arbres: null,       // la jungle se plante ici (jungle()), sur le relief, pas sur les polygones de bois
  depart: { x: 104, z: 10.4, yaw: -0.27 },      // face au marché flottant, ses barques et ses marchandes (avant : le mur d'une maison sur pilotis)
  portes: [{ x: 61.5, z: -71.9, rot: 0.3, prompt: 'repasser la porte de l’île', vers: ['temple', [20.35, 0, -11.75], Math.atan2(-20.35, 11.75)], label: 'Retour à l’île du temps…' }],
  counts: 'La baie des pitons : Ko Panyi et son village sur pilotis, Khao Phing Kan, Railay, Phi Phi, et le grand piton du temple. Les passeurs attendent aux pontons.',
  start: 'La pluie ne tombe pas. Elle est là, en l’air, goutte par goutte. Seule la mer bouge encore.',
  entry: { title: 'La baie des pitons', sub: 'La Cloche des Îles — Thaïlande', cam: [700, 260, 900], at: [0, 20, 0], cam2: [180, 30, 80], at2: [40, 10, -40], dur: 6 },
  toitSur: toitThai, solLieu: (x, z) => solMarche(x, z) ?? solEscalier(x, z),
  // les endroits qui comptent, pour la minicarte et les lieux découverts (la forme commune à tous
  // les mondes, lue par monde.js) — type : 'lieu' | 'pnj' | 'quete' | 'passage'
  reperes: [
    { id: 'marche', nom: 'le marché flottant', x: 96, z: 40, r: 25, type: 'lieu' },
    { id: 'quai-panyi', nom: 'le ponton de Somsak', x: 118, z: 7.5, r: 15, type: 'passage' },
    { id: 'nok', nom: 'Nok, devant l’arche', x: 70, z: -62, r: 15, type: 'pnj' },
    { id: 'porte', nom: 'la porte de l’île', x: 61.5, z: -71.9, r: 10, type: 'passage' },
    { id: 'mosquee', nom: 'la mosquée de Ko Panyi', x: -117, z: -75, r: 25, type: 'lieu' },
    { id: 'quai-tapu', nom: 'Khao Phing Kan, le quai de Mali', x: -701, z: 551, r: 25, type: 'passage' },
    { id: 'ko-tapu', nom: 'Ko Tapu, le clou', x: -684, z: 468, r: 95, type: 'lieu' },        // il est dans l'eau : on le découvre depuis la grève, à 75–95 m
    { id: 'quai-suea', nom: 'le grand piton, la grève', x: 985, z: 491, r: 20, type: 'passage' },
    { id: 'chedi', nom: 'le chedi doré', x: 983, z: 344, r: 20, type: 'lieu' },
    { id: 'moines', nom: 'les moines du grand piton', x: 925, z: 282, r: 25, type: 'quete' },
    { id: 'escalier-piton', nom: 'l’escalier du grand piton', x: 901, z: 290, r: 10, type: 'passage' },
    { id: 'cour-puits', nom: 'la cour du puits', x: 915, z: 334, r: 22, type: 'quete' },      // le centre, hors des bâtiments (il était dans l'un d'eux)
    { id: 'quai-railay', nom: 'Railay, la plage de l’ouest', x: -657, z: 1530, r: 25, type: 'passage' },
    { id: 'cable-railay', nom: 'le câble de Railay', x: -587, z: 1920, r: 15, type: 'passage' },
    { id: 'railay', nom: 'le village de Railay', x: -500, z: 1700, r: 60, type: 'lieu' },
    { id: 'quai-tonsai', nom: 'Ton Sai, le ponton', x: 2187, z: 1927, r: 25, type: 'passage' },
    { id: 'tonsai', nom: 'le village de Ton Sai', x: 2350, z: 1820, r: 70, type: 'lieu' },
    { id: 'belvedere-moines', nom: 'le belvédère des moines', x: 2605, z: 1790, r: 15, type: 'passage' },
    // les pêcheurs dans leur barque, à portée de voix (pecheurs()) : ceux dont la place est relevée
    { id: 'pecheur-railay', nom: 'le pêcheur de Railay', x: -302, z: 1763, r: 12, type: 'pnj' },
    { id: 'pecheur-tonsai', nom: 'le pêcheur de Ton Sai', x: 2130, z: 1919, r: 12, type: 'pnj' },
  ],
  plus(ctx) {
    // la mousson : un ciel couvert éclaire de partout, le soleil ne fait qu'une ombre molle —
    // sans ça, les parois tournées au nord sont noires
    hemi.intensity = 1.25; hemi.color.setHex(0xe4ecf0); hemi.groundColor.setHex(0x5a6a50);
    // chaque morceau chronométré : le banc (bancs/lieu-thailande.mjs) les lit dans window.__lieu
    const durees = {}, chrono = (nom, fn) => { const t = performance.now(); fn(ctx); durees[nom] = Math.round(performance.now() - t); };
    for (const [nom, fn] of [['parois', parois], ['voies', voies], ['escalier', escalier], ['jungle', jungle], ['pilotis', pilotis], ['temples', templesThai], ['ko tapu', koTapu], ['chedi', chedi],
      ['passeurs', passeurs], ['pluie', pluie], ['habitants', habitants], ['marché', marche], ['pêcheurs', pecheurs], ['tyroliennes', tyroliennes], ['bâti', batiIles], ['garde', garde]]) chrono(nom, fn);
    placerPluie();
    // les quais et les câbles : le parcours du banc (TLOC_PARCOURS=1) s'en sert pour passer d'une île à l'autre
    window.__lieu = { durees, quais: Object.values(QUAIS).map((Q) => Q.ici), cables: CABLES.filter((c) => c.p0).map((c) => [c.de, c.a]) };
  },
  anime(now) {
    const t = now / 1000, dt = Math.min(0.1, (now - (ANIME.t || now)) / 1000); ANIME.t = now;
    animeHabitants(dt);
    for (const v of VENDEURS) PNJ.animeVillageois(v, dt, false);
    animeGlisse(dt);
    if (MARCHE.coques) MARCHE.coques.position.y = Math.sin(t * 1.1) * 0.04;
    if (gongActif()) placerPluie();
    for (const b of BARQUES) { b.g.position.y = Math.sin(t * 1.3 + b.ph) * 0.12; b.g.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.03; }
    if (PLUIE.tuiles.length && (t * 4 | 0) % 2 === 0) placerPluie();
    // vue de loin (le plan d'arrivée), la pluie ne serait qu'un pavé blanc posé sur la baie
    const proche = camera.position.distanceTo(player.pos) < 90; for (const l of PLUIE.tuiles) l.visible = proche;
  },
});
