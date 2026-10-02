// The Legend of Camille — la Thaïlande : la baie des pitons (acte III, la Cloche des Îles)
// =====================================================================
// « Petites îles de calcaire très hautes, temples, jungle, eau, mousson. La mer bouge. Les îles
// sont figées. La pluie reste suspendue » (STORY.md). Eugène a envoyé cinq extraits le
// 2 octobre et demandé un mélange : Ko Panyi (le village sur pilotis : le marché flottant, la
// porte de l'île), Khao Phing Kan et Ko Tapu (les pitons), Railay (les falaises et les
// grottes), Phi Phi (Ton Sai), et le Wat Tham Suea, haussé en grand piton. Ils sont fondus
// dans UNE baie inventée (carte/mondes/repere_thailande.py) ; les passeurs vont de l'une à
// l'autre.
// =====================================================================
import { monde } from './monde.js';
import { THREE, TAU, rand, phMat, mesh, boxG, showMessage, showMenu, hideMenu, fadeTo, player, state, G, scene, camera, hemi, sun } from './engine.js?v=41';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { especeGeo } from './foret.js';

// Les embarcadères des passeurs : un par île (les pontons d'OSM ; le grand piton n'en a pas,
// on accoste sur sa grève sud). `ici` : où Camille pose le pied (le relief y est à 1–3 m) ;
// `barque` : où le bateau attend, en eau profonde (relevés sur relief-thailande.json).
const QUAIS = {
  panyi:  { nom: 'Ko Panyi, le village sur pilotis', ici: [118, 7.5], barque: [131, 9] },
  tapu:   { nom: 'Khao Phing Kan, les pitons', ici: [-701, 551], barque: [-689, 552] },
  suea:   { nom: 'le grand piton', ici: [985, 458], barque: [995, 474] },
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
  const murs = [], toits = [], pieux = [], poses = [];
  const voies = [...PLAN.chemins, ...PLAN.ponts].filter((c) => c.m === 'panyi' && c.pts.length >= 2);
  for (const c of voies) for (let k = 0; k < c.pts.length - 1; k++) {
    const [a, b] = [c.pts[k], c.pts[k + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (let s = 4; s < L - 3; s += 9) for (const cote of [-1, 1]) {
      const w = rand(5, 7), d = rand(5, 8), off = 1.6 + d / 2;
      const x = a[0] + ux * s - uz * off * cote, z = a[1] + uz * s + ux * off * cote;
      if (hauteur(x, z) > 3 || poses.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6.5)) continue;   // pas sur le rocher, pas l'une dans l'autre
      if (ile && !dansP(x, z, ile.pts) && Math.random() < 0.35) continue;
      poses.push([x, z]);
      const ang = Math.atan2(uz, ux), hm = rand(2.6, 3.4), y0 = 1.3;
      const g = new THREE.BoxGeometry(w, hm, d); g.rotateY(-ang); g.translate(x, y0 + hm / 2, z); murs.push(g.toNonIndexed());
      // un toit de tôle à deux pans, faîtage le long de la passerelle
      const t = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w + 0.8, 3, 1); t.rotateZ(Math.PI / 2); t.rotateX(Math.PI / 2); t.scale(1, 0.45, 1);
      t.rotateY(-ang); t.translate(x, y0 + hm + d * 0.14, z); toits.push(t.toNonIndexed());
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.CylinderGeometry(0.12, 0.14, 4, 5); p.translate(x + px * w * 0.42, y0 - 1.9, z + pz * d * 0.42); pieux.push(p.toNonIndexed()); }
      const ca = Math.cos(ang), sa = Math.sin(ang), coin = (p, q) => [x + p * ca - q * sa, z + p * sa + q * ca];
      inscrire([coin(-w / 2, -d / 2), coin(w / 2, -d / 2), coin(w / 2, d / 2), coin(-w / 2, d / 2)], x, z);
    }
  }
  const uvm = (g) => { g.deleteAttribute('uv'); g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal, uv = [];
    for (let k = 0; k < p.count; k++) uv.push(p.getX(k) * Math.abs(n.getZ(k)) + p.getZ(k) * Math.abs(n.getX(k)) + (Math.abs(n.getY(k)) > 0.7 ? p.getX(k) : 0), Math.abs(n.getY(k)) > 0.7 ? p.getZ(k) : p.getY(k));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; };
  if (murs.length) { const m = new THREE.Mesh(mergeGeometries(murs.map(uvm)), phMat('hinoki_planks', 1, 1, { color: 0x9c8a74 })); m.castShadow = m.receiveShadow = true; scene.add(m); }
  if (toits.length) { const m = new THREE.Mesh(mergeGeometries(toits.map(uvm)), phMat('enduit_gris', 1, 1, { color: 0xa88a78, roughness: 0.75 })); m.castShadow = true; scene.add(m); }
  if (pieux.length) scene.add(new THREE.Mesh(mergeGeometries(pieux), phMat('tree_trunk', 1, 1, { color: 0x5a4838 })));
  // le platelage : partout où le relief de Ko Panyi est à 1,2 m (l'île basse et le long des
  // passerelles, recolter-relief-thailande.py), des planches — le village marche sur l'eau
  const v = [], pas = 2.5;
  for (let z = -440; z < 420; z += pas) for (let x = -260; x < 200; x += pas) {
    const hs = [hauteur(x, z), hauteur(x + pas, z), hauteur(x, z + pas), hauteur(x + pas, z + pas)];
    // une case dont un coin est sur le platelage : la planche déborde au-dessus de l'eau, comme au bord d'une vraie passerelle
    if (hs.some((h) => h > 1.0 && h < 1.45) && hs.every((h) => h < 1.45)) v.push(x, 0, z, x, 0, z + pas, x + pas, 0, z, x + pas, 0, z, x, 0, z + pas, x + pas, 0, z + pas);
  }
  if (v.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const uv = []; for (let k = 0; k < v.length; k += 3) uv.push(v[k], v[k + 2]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, phMat('wood_planks', 1, 1, { color: 0xb8a080, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })); m.position.y = 1.28; m.receiveShadow = true; scene.add(m); }
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
        diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(tSable, vMonde.xz / 3.0).rgb * vec3(1.05, 1.0, 0.9), greve);`);
  };
  m.customProgramCacheKey = () => 'sol-thailande';
  m.needsUpdate = true;
}

// ---------- la jungle ----------
// Partout où la terre monte au-dessus des grèves et où la pente tient un arbre : un semis
// serré (tous les 7 m, décalé au hasard), qui laisse à nu les parois et les villages.
function jungle({ hauteur, bloque, CADRE }) {
  const esp = especeGeo('charme'); if (!esp) return;
  const pts = [], pas = 7;
  for (let z = CADRE.z0; z < CADRE.z1; z += pas) for (let x = CADRE.x0; x < CADRE.x1; x += pas) {
    const px = x + rand(-3, 3), pz = z + rand(-3, 3), h = hauteur(px, pz); if (h < 3.5) continue;
    const pente = Math.max(Math.abs(hauteur(px + 2, pz) - hauteur(px - 2, pz)), Math.abs(hauteur(px, pz + 2) - hauteur(px, pz - 2))) / 4;
    if (pente > 0.75 || (pente > 0.5 && Math.random() < 0.5) || bloque(px, pz, 3)) continue;
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
  addInteract({ pos: new THREE.Vector3(x, y, z), r: 12, prompt: () => 'le chedi doré', fn: () => showMessage('Le chedi du grand piton. Les clochettes de ses anneaux sont arrêtées en plein tintement.', 6) });
}

// ---------- les temples du grand piton : toits thaïs, chedis ----------
// OSM ne dit que l'emprise. Un bâtiment rond devient un chedi (la cloche blanche et dorée sur
// son socle) ; les autres prennent le toit des temples thaïs : deux ou trois pans superposés,
// très pentus, rouges bordés de vert, les pignons dorés et les chofa — les cornes dorées —
// aux bouts du faîtage. Les maillages sont fondus par matière, comme le reste du bâti.
const TEMPLE = { rouge: [], vert: [], or: [], blanc: [] };
function toitThai(b, { cx, cz, ux, uz, a0, a1, b0, b1, L, W, haut }) {
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

// ---------- la pluie suspendue ----------
// Des gouttes immobiles autour de Camille : un pavé de 40 m répété en 3 × 3 × 2, recalé tous
// les 40 m — la même goutte reste au même endroit du monde, elle ne suit pas Camille.
const PLUIE = { tuiles: [], pas: 40 };
function pluie({ scene }) {
  const v = [], N = 900;
  for (let k = 0; k < N; k++) { const x = Math.random() * 40, y = Math.random() * 40, z = Math.random() * 40, l = rand(0.25, 0.5); v.push(x, y, z, x, y - l, z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const m = new THREE.LineBasicMaterial({ color: 0xd8e4f0, transparent: true, opacity: 0.4, depthWrite: false });
  for (let k = 0; k < 18; k++) { const l = new THREE.LineSegments(g, m); l.frustumCulled = false; scene.add(l); PLUIE.tuiles.push(l); }
}
function placerPluie() {
  const P = PLUIE.pas, bx = Math.floor(player.pos.x / P), by = Math.floor(player.pos.y / P), bz = Math.floor(player.pos.z / P);
  let k = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let e = 0; e <= 1; e++) PLUIE.tuiles[k++].position.set((bx + i) * P, (by + e - 0.5) * P, (bz + j) * P);
}

// ---------- les passeurs ----------
const BARQUES = [];
function barque(x, z, rot) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
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
    barque(Q.barque[0], Q.barque[1], Math.atan2(Q.barque[0] - Q.ici[0], Q.barque[1] - Q.ici[1]));   // la proue vers le large
    addInteract({ pos: new THREE.Vector3(Q.ici[0], hauteur(...Q.ici), Q.ici[1]), r: 9, prompt: () => 'parler au passeur',
      fn: () => showMenu('LE PASSEUR', Q.nom, PASSEUR[m], [
        ...Object.entries(QUAIS).filter(([n]) => n !== m).map(([n, D]) => ({ label: 'Vers ' + D.nom, fn: () => traverser(D, hauteur) })),
        { label: 'Rester ici', fn: () => { hideMenu(); state.paused = false; } }]) });
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
  // la mousson arrêtée : un ciel bas et laiteux, une lumière sans ombre franche, la brume chaude
  ciel: [0x6a7884, 0xaab4b4, 0xd4d8cc], brume: [0xbcc6c0, 260, 3200], soleil: [-120, 260, 80, 2.2], soleilCouleur: 0xf4ecdc,
  sol: ['grass_ground', 0x8aa070], mer: 0, merCouleur: 0x2e7a78, merPoli: 0.12, merMetal: 0.55,
  murs: ['chaux_craquelee', 0xe4dccc], toit: { style: 'deuxPans', slug: 'clay_roof_tiles_02', couleur: 0xa84a2a, pente: 0.9, hMax: 4.5 }, hMurs: [3.2, 4.6],
  chemin: ['rocky_trail', 0xb8a888],
  arbres: null,       // la jungle se plante ici (jungle()), sur le relief, pas sur les polygones de bois
  depart: { x: 104, z: 10.4, yaw: -Math.PI / 2 },
  portes: [{ x: 61.5, z: -71.9, rot: 0.3, prompt: 'repasser la porte de l’île', vers: ['temple', [20.35, 0, -11.75], Math.atan2(-20.35, 11.75)], label: 'Retour à l’île du temps…' }],
  counts: 'La baie des pitons : Ko Panyi et son village sur pilotis, Khao Phing Kan, Railay, Phi Phi, et le grand piton du temple. Les passeurs attendent aux pontons.',
  start: 'La pluie ne tombe pas. Elle est là, en l’air, goutte par goutte. Seule la mer bouge encore.',
  entry: { title: 'La baie des pitons', sub: 'La Cloche des Îles — Thaïlande', cam: [700, 260, 900], at: [0, 20, 0], cam2: [180, 30, 80], at2: [40, 10, -40], dur: 6 },
  toitSur: toitThai,
  plus(ctx) {
    // la mousson : un ciel couvert éclaire de partout, le soleil ne fait qu'une ombre molle —
    // sans ça, les parois tournées au nord sont noires
    hemi.intensity = 1.25; hemi.color.setHex(0xe4ecf0); hemi.groundColor.setHex(0x5a6a50);
    parois(ctx); jungle(ctx); pilotis(ctx); templesThai(ctx); koTapu(ctx); chedi(ctx); passeurs(ctx); pluie(ctx); placerPluie();
  },
  anime(now) {
    const t = now / 1000;
    for (const b of BARQUES) { b.g.position.y = Math.sin(t * 1.3 + b.ph) * 0.12; b.g.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.03; }
    if (PLUIE.tuiles.length && (t * 4 | 0) % 2 === 0) placerPluie();
    // vue de loin (le plan d'arrivée), la pluie ne serait qu'un pavé blanc posé sur la baie
    const proche = camera.position.distanceTo(player.pos) < 90; for (const l of PLUIE.tuiles) l.visible = proche;
  },
});
