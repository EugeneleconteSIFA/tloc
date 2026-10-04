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
  const murs = [], toits = [], pieux = [], poses = [];
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
function marche({ hauteur }) {
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
  // les marchandes et les passeurs du marché, assis dans leurs barques : eux ne sont pas
  // figés — ils vivent sur l'eau, où le temps passe encore
  const chapeau = () => { const g = new THREE.Group(); g.add(mesh(new THREE.ConeGeometry(0.26, 0.13, 14, 1, true), phMat('dry_branches_01', 1, 1, { color: 0xd8c08a, side: THREE.DoubleSide }), 0, 0, 0)); return g; };
  [[0, 2], [1, 5], [0, 8], [1, 11], [0, 12]].forEach(([col, k], i) => {
    const b = MARCHE[col * 20 + k], v = PNJ.buildVillageois(i + 2); if (!v) return;
    v.position.set(b.x + rand(-1.5, 1.5), 0.5, b.z); v.rotation.y = rand(0, TAU); scene.add(v);
    PNJ.socket(v, v.userData.perso, 'Head', chapeau(), [0.027, 0.2, -0.055]);
    VENDEURS.push(v);
  });
}
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
const CABLES = [
  { nom: 'vers le grand piton', de: [2605, 1790], a: [976, 322] },          // le belvédère des moines, Phi Phi (~131 m) → le flanc du sommet du grand piton (~66 m), à côté du départ du câble suivant
  { nom: 'vers le marché flottant', de: [972, 330], a: [96, 32] },          // le sommet, à côté du chedi (104 m) → les barques de Ko Panyi
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
  const g = PNJ.buildRole(role); if (!g) return null;
  g.position.set(x, 0, z); g.rotation.y = yaw; scene.add(g);
  const F = { g, x, z, texte, t0: rand(0.3, 2.5), pose: false, ...extra };
  if (role === 'balayeur') PNJ.socket(g, g.userData.perso, 'hand_r', balai(), [0, 0.05, 0.02], [0.3, 0, 0]);
  if (extra.cle) { F.objetCle = cle(); PNJ.socket(g, g.userData.perso, 'hand_l', F.objetCle, [0, 0.12, 0.03], [0, 0, 0]); }
  FIGES.push(F); return F;
}
function habitants({ hauteur, bloque, addInteract }) {
  // Nok, devant la grotte de la porte, au pied du rocher de Ko Panyi
  { const [x, z] = poserLibre(bloque, hauteur, 70, -62);
    NOK = PNJ.buildRole('nok');
    if (NOK) { NOK.position.set(x, hauteur(x, z), z); NOK.rotation.y = Math.atan2(104 - x, 10 - z); scene.add(NOK);
      addInteract({ pos: new THREE.Vector3(x, hauteur(x, z), z), r: 3.5, prompt: () => 'parler à Nok', fn: parlerNok }); } }
  // les trois moines de l'enquête, devant le Wat Tham Suea, et les balayeurs de la cour
  const M = [
    [952, 280, '« …la clé du cloître, c’est le balayeur qui l’avait… »'],
    [930, 292, '« …Somchai balaie toujours la cour du puits… »'],
    [968, 300, '« …il cache la clé dans sa manche gauche… »'],
  ];
  for (const [ax, az, texte] of M) { const [x, z] = poserLibre(bloque, hauteur, ax, az); figer('moine', x, z, rand(0, TAU), texte); }
  const B = [[905, 335, false], [915, 345, true], [898, 350, false]];
  for (const [ax, az, bon] of B) { const [x, z] = poserLibre(bloque, hauteur, ax, az); figer('balayeur', x, z, rand(0, TAU), null, { cle: bon && !state.cleCloitre, balayeur: true, bon }); }
  for (const F of FIGES) { F.g.position.y = hauteur(F.x, F.z);
    addInteract({ pos: F.g.position, r: 3, prompt: () => F.balayeur ? 'regarder le balayeur' : 'écouter le moine', fn: () => parlerFige(F) }); }
  if (state.gongThai) AIDE.extra.push(['K', 'frapper le gong']);
  TOUCHES.KeyK = frapperGong;
}
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
    if (!vivant) return showMessage('Le moine est figé, la bouche ouverte, au milieu d’un mot.' + (state.gongThai ? ' (K : le gong)' : ''), 3.5);
    F.fini = true; return showMessage('Le moine finit sa phrase : ' + F.texte, 6);
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
  socleMax: 2.5, socle: ['old_stone_wall_02', 0xb0a490],
  arbres: null,       // la jungle se plante ici (jungle()), sur le relief, pas sur les polygones de bois
  depart: { x: 104, z: 10.4, yaw: -Math.PI / 2 },
  portes: [{ x: 61.5, z: -71.9, rot: 0.3, prompt: 'repasser la porte de l’île', vers: ['temple', [20.35, 0, -11.75], Math.atan2(-20.35, 11.75)], label: 'Retour à l’île du temps…' }],
  counts: 'La baie des pitons : Ko Panyi et son village sur pilotis, Khao Phing Kan, Railay, Phi Phi, et le grand piton du temple. Les passeurs attendent aux pontons.',
  start: 'La pluie ne tombe pas. Elle est là, en l’air, goutte par goutte. Seule la mer bouge encore.',
  entry: { title: 'La baie des pitons', sub: 'La Cloche des Îles — Thaïlande', cam: [700, 260, 900], at: [0, 20, 0], cam2: [180, 30, 80], at2: [40, 10, -40], dur: 6 },
  toitSur: toitThai, solLieu: solMarche,
  plus(ctx) {
    // la mousson : un ciel couvert éclaire de partout, le soleil ne fait qu'une ombre molle —
    // sans ça, les parois tournées au nord sont noires
    hemi.intensity = 1.25; hemi.color.setHex(0xe4ecf0); hemi.groundColor.setHex(0x5a6a50);
    parois(ctx); jungle(ctx); pilotis(ctx); templesThai(ctx); koTapu(ctx); chedi(ctx); passeurs(ctx); pluie(ctx); placerPluie(); habitants(ctx); marche(ctx); tyroliennes(ctx); garde(ctx);
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
