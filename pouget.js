import * as PNJ_E from './engine.js?v=41';
import * as PNJ from './pnj.js';
// The Legend of Camille — le Pouget (Lozère), premier pas dans la Cloche des Troupeaux
// =====================================================================
// Le hameau de granit de STORY.md (« Villefort, le lac, le Pouget… »), d'après les photos
// d'Eugène (docs/references/pouget-photos.webp) : accroché à une pente boisée de châtaigniers,
// toits de lauzes, la vue sur les crêtes. Le plan et le relief viennent de la chaîne des
// mondes (carte/mondes/, README « La Lozère ») : l'OSM pour les maisons et les chemins, le
// LiDAR de l'IGN (2 m) pour la pente, le RGE ALTI (10 m) pour les crêtes au loin.
// Premier pas : un lieu où l'on marche. Pas encore de quête.
// En mètres (1 unité = 1 m), origine au hameau, x est, z sud : Camille à l'échelle 0,6.
// =====================================================================
import { THREE, TAU, rand, scene, G, mat, phMat, hemi, sun, renderer, bloom, mesh, boxG,
  addInteract, goToLevel, showMessage, bootLevel, minimapDots, makeSky, player, state } from './engine.js?v=41';
import { especeGeo } from './foret.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DIR = 'carte/mondes/';
const BORD = 292;                                     // on marche dans le carré du relief fin
let R = null, H0 = 0, PLAN = null, MAISONS = [];
const DEPART = { x: 8.8, z: 40, yaw: Math.PI };       // au pied de la route qui monte au hameau (OSM), face à lui
const PORTE = { x: 7, z: 50 };                         // la porte de l'île, derrière Camille

// l'altitude du relief LiDAR, relative au hameau, interpolée entre les nœuds de 2 m
function hauteur(x, z) {
  if (!R) return 0;
  const fx = Math.max(0, Math.min(R.nx - 1.001, (x - R.x0) / R.pas)), fz = Math.max(0, Math.min(R.nz - 1.001, (z - R.z0) / R.pas));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, h = R.h, n = R.nx;
  const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v - H0;
}
function dansPoly(x, z, pts) {
  let d = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d;
  }
  return d;
}
const dansCadre = (pts, m = 0) => pts.some(([x, z]) => Math.abs(x) < BORD + m && Math.abs(z) < BORD + m);

// un ruban posé sur le relief (chemin, ruisseau), largeur w, à y au-dessus du sol
function ruban(pts, w, y) {
  const pos = [], idx = [], uv = []; let s = 0;
  for (let k = 0; k < pts.length; k++) {
    const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
    let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
    for (const c of [-1, 1]) { const px = x - dz * w / 2 * c, pz = z + dx * w / 2 * c; pos.push(px, hauteur(px, pz) + y, pz); uv.push((c + 1) / 2 * w / 2, s / 2); }
    if (k) { const b = (k - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// on recoupe une ligne trop lâche (des nœuds OSM à 20 m) pour qu'elle épouse le relief
function densifier(pts, pas = 2) {
  const o = [];
  for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
    for (let t = 0; t < n; t++) o.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
  o.push(pts[pts.length - 1]); return o;
}

// UNE MAISON DU POUGET : murs de granit en moellons sur l'emprise OSM, enterrés côté pente,
// et un toit de lauzes à deux pans sur le rectangle qui la contient le mieux (axe principal)
function maison(pts, granit, lauze) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  // axe principal : la direction la plus longue de l'emprise
  let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of pts) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang);
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [x, z] of pts) { const a = (x - cx) * ux + (z - cz) * uz, b = -(x - cx) * uz + (z - cz) * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const L = a1 - a0, W = b1 - b0; if (L < 2.5 || W < 2) return null;
  let hb = 1e9, ht = -1e9; for (const [x, z] of pts) { const h = hauteur(x, z); hb = Math.min(hb, h); ht = Math.max(ht, h); }
  const murs = (L * W > 60 ? 6.2 : 4.6), base = hb - 1.2, haut = ht + murs;
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const gm = new THREE.ExtrudeGeometry(sh, { depth: haut - base, bevelEnabled: false }); gm.rotateX(-Math.PI / 2); gm.translate(0, base, 0);
  // les UV des murs en mètres : sinon le moellon s'étire sur toute la façade
  const m = new THREE.Mesh(gm, granit); m.castShadow = m.receiveShadow = true; scene.add(m);
  // le toit : un prisme de lauzes, débord de 40 cm, pente forte (les lauzes sont lourdes)
  const o = 0.4, hl = (W / 2 + o) * 0.75, ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
  const P = (a, b, y) => [cx + (ac + a) * ux - (bc + b) * uz, haut + y, cz + (ac + a) * uz + (bc + b) * ux];
  const la = L / 2 + o, lb = W / 2 + o;
  const v = [P(-la, -lb, 0), P(la, -lb, 0), P(la, 0, hl), P(-la, 0, hl), P(-la, lb, 0), P(la, lb, 0)];
  const tri = [[0, 1, 2], [0, 2, 3], [4, 3, 2], [4, 2, 5], [0, 3, 4], [1, 5, 2]];
  const pos = [], uv = []; for (const t of tri) for (const k of t) { pos.push(...v[k]); uv.push(v[k][0] / 2, (v[k][1] + v[k][2]) / 2); }
  const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gt.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gt.computeVertexNormals();
  const t = new THREE.Mesh(gt, lauze); t.castShadow = t.receiveShadow = true; scene.add(t);
  // les pignons, en granit, sous le toit
  const gp = new THREE.BufferGeometry(); const pg = [...v[0], ...v[3], ...v[4], ...v[1], ...v[5], ...v[2]];
  gp.setAttribute('position', new THREE.Float32BufferAttribute(pg, 3)); gp.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 1, 1, 0, 0, 0, 1, 0, 0.5, 1], 2)); gp.computeVertexNormals();
  const pm = new THREE.Mesh(gp, granit); pm.material.side = THREE.DoubleSide; scene.add(pm);
  return { pts, cx, cz };
}

async function build() {
  const [rel, monde, plan] = await Promise.all(['relief-lozere-pouget.json', 'relief-lozere-monde.json', 'lozere.json'].map((f) => fetch(DIR + f).then((r) => r.json())));
  R = rel; PLAN = plan; H0 = R.h[Math.round(-R.z0 / R.pas) * R.nx + Math.round(-R.x0 / R.pas)];
  // un ciel de montagne clair, la brume bleue des Cévennes au loin
  makeSky(0x3a6ab0, 0x9ac0e0, 0xd8e2e8, true);
  scene.fog = new THREE.Fog(0xb8c8d8, 260, 3200);
  hemi.intensity = 0.62; hemi.color.setHex(0xd8e4f4); hemi.groundColor.setHex(0x4a4430);
  sun.intensity = 2.6; sun.color.setHex(0xfff0d8); sun.position.set(120, 160, 60); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 500 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.18;
  G.camBack = 7; G.camUp = 3.4;

  // ---------- la pente : le relief LiDAR, 600 × 600 m ----------
  { const g = new THREE.PlaneGeometry(R.pas * (R.nx - 1), R.pas * (R.nz - 1), R.nx - 1, R.nz - 1); g.rotateX(-Math.PI / 2);
    g.translate(R.x0 + R.pas * (R.nx - 1) / 2, 0, R.z0 + R.pas * (R.nz - 1) / 2);
    const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, hauteur(p.getX(k), p.getZ(k)));
    g.computeVertexNormals();
    const sol = new THREE.Mesh(g, phMat('grass_ground', 600, 600, { color: 0xb0b088 })); sol.receiveShadow = true; scene.add(sol); }
  // ---------- les crêtes au loin : le RGE ALTI à 10 m, éclairci à 60 m, creusé sous le relief fin ----------
  { const st = 6, nx = Math.floor((monde.nx - 1) / st) + 1, nz = Math.floor((monde.nz - 1) / st) + 1;
    const g = new THREE.PlaneGeometry(monde.pas * st * (nx - 1), monde.pas * st * (nz - 1), nx - 1, nz - 1); g.rotateX(-Math.PI / 2);
    g.translate(monde.x0 + monde.pas * st * (nx - 1) / 2, 0, monde.z0 + monde.pas * st * (nz - 1) / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), i = Math.round((x - monde.x0) / monde.pas), j = Math.round((z - monde.z0) / monde.pas);
      const h = monde.h[Math.min(monde.nz - 1, Math.max(0, j)) * monde.nx + Math.min(monde.nx - 1, Math.max(0, i))] - H0;
      p.setY(k, Math.abs(x) < BORD + 4 && Math.abs(z) < BORD + 4 ? h - 12 : h); }
    g.computeVertexNormals();
    // vues de loin, les pentes des Cévennes sont des bois : la feuillée photographiée
    const loin = new THREE.Mesh(g, phMat('forest_leaves_02', 300, 300, { color: 0x6a8058 })); loin.receiveShadow = true; scene.add(loin); }

  // ---------- les maisons de granit ----------
  const granit = phMat('old_stone_wall_02', 3, 3, { color: 0xa8a49a });
  // les lauzes : du schiste gris sombre en plaques ; la texture de cailloux, teintée, lisait du bois
  const lauze = phMat('rocher_01', 1.4, 1.4, { color: 0x5e5e64, roughness: 0.85 });
  // UV des murs en mètres : on les recalcule après l'extrusion, côté par côté
  MAISONS = PLAN.batiments.filter((b) => dansCadre(b.pts)).map((b) => maison(b.pts, granit, lauze)).filter(Boolean);
  scene.traverse((o) => { if (o.isMesh && o.material === granit && o.geometry.type === 'ExtrudeGeometry') {
    const p = o.geometry.attributes.position, uv = o.geometry.attributes.uv, n = o.geometry.attributes.normal;
    for (let k = 0; k < p.count; k++) { const ny = Math.abs(n.getY(k)) > 0.7; uv.setXY(k, ny ? p.getX(k) / 3 : (p.getX(k) + p.getZ(k)) / 3, ny ? p.getZ(k) / 3 : p.getY(k) / 3); }
    uv.needsUpdate = true; } });

  // ---------- les chemins et les ruisseaux ----------
  { const pierre = phMat('rocky_trail', 3, 3, { color: 0xb8a888, polygonOffset: true, polygonOffsetFactor: -2 });
    const gs = [...PLAN.routes, ...PLAN.chemins].filter((c) => dansCadre(c.pts, 40)).map((c) => ruban(densifier(c.pts), c.r >= 2 ? 3.6 : c.r === 1 ? 2.4 : 1.4, 0.18));
    if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), pierre); m.receiveShadow = true; scene.add(m); }
    const eau = new THREE.MeshStandardMaterial({ color: 0x5a7890, roughness: 0.08, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 });
    const ge = PLAN.eau.cours.filter((c) => dansCadre(c.pts, 40)).map((c) => ruban(densifier(c.pts), 1.1, 0.08));
    if (ge.length) scene.add(new THREE.Mesh(mergeGeometries(ge), eau)); }

  // ---------- la châtaigneraie : les bois de la carte, et quelques arbres isolés ----------
  { const esp = especeGeo('chene');
    if (esp) {
      const bois = PLAN.verdure.bois.filter((b) => dansCadre(b.pts, 40)), places = [];
      const libre = (x, z) => MAISONS.every((m) => Math.hypot(x - m.cx, z - m.cz) > 16) && Math.hypot(x - DEPART.x, z - DEPART.z) > 6 && Math.hypot(x - PORTE.x, z - PORTE.z) > 6;
      for (let k = 0; k < 9000 && places.length < 900; k++) {
        const x = rand(-BORD, BORD), z = rand(-BORD, BORD), dedans = bois.some((b) => dansPoly(x, z, b.pts));
        if ((dedans || Math.random() < 0.035) && libre(x, z) && places.every((p) => Math.hypot(p[0] - x, p[1] - z) > 5.5)) places.push([x, z]);
      }
      const n = places.length, tr = new THREE.InstancedMesh(esp.tronc, esp.matT, n), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
      places.forEach(([x, z], k) => { const h = rand(8, 13); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU)); s.set(h * rand(0.85, 1.15), h, h * rand(0.85, 1.15));
        m4.compose(v.set(x, hauteur(x, z) - 0.2, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
      tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
      R.arbres = places;
    } }

  // ---------- la porte de l'île : un arc de pierre seul sur le chemin, qui luit du violet de l'île ----------
  { const g = new THREE.Group(), y = hauteur(PORTE.x, PORTE.z); g.position.set(PORTE.x, y, PORTE.z); g.rotation.y = 0.2; scene.add(g);
    const taille = phMat('old_stone_wall_02', 2, 2, { color: 0xc8beac });
    for (const sx of [-1, 1]) g.add(mesh(boxG(0.8, 3.6, 0.9), taille, sx * 1.5, 1.6, 0));
    const arc = mesh(new THREE.TorusGeometry(1.5, 0.4, 8, 20, Math.PI), taille, 0, 3.4, 0); arc.scale.z = 2.2; g.add(arc);
    const voile = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), new THREE.MeshBasicMaterial({ color: 0xc8b0e8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    voile.position.y = 1.7; g.add(voile); R.voile = voile;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    addInteract({ pos: new THREE.Vector3(PORTE.x, y, PORTE.z), r: 3, prompt: () => 'repasser la porte de l’île',
      fn: () => goToLevel('temple', [-20.35, 0, -11.75], Math.atan2(20.35, 11.75), 'Retour à l’île du temps…') }); }
}

function populate() { player.pos.set(DEPART.x, hauteur(DEPART.x, DEPART.z), DEPART.z); player.yaw = DEPART.yaw; G.camYaw = DEPART.yaw; }
// à l'arrivée par la porte, la sauvegarde rend l'angle de caméra du niveau QU'ON QUITTE : une
// fois la partie reprise, on la remet une fois dans le dos de Camille, face au hameau
let camPosee = false;
function animate(now) {
  if (R && R.voile) R.voile.material.opacity = 0.28 + Math.sin(now / 900) * 0.08;
  if (!camPosee && state.running && !state.paused) { G.camYaw = player.yaw; camPosee = true; }   // camYaw = yaw : la caméra est DANS LE DOS (engine.js, la caméra suit le regard)
}
function minimap(g, W2) {
  const sc = W2 / 300, P = (x, z) => [W2 / 2 + (x - player.pos.x) * sc + 0, W2 / 2 + (z - player.pos.z) * sc];
  g.fillStyle = '#7a8a5a'; g.fillRect(0, 0, W2, W2);
  if (R && R.arbres) { g.fillStyle = '#4a6a3a'; for (const [x, z] of R.arbres) { const [a, b] = P(x, z); g.fillRect(a - 1, b - 1, 2, 2); } }
  g.fillStyle = '#6a6460'; for (const m of MAISONS) { g.beginPath(); m.pts.forEach(([x, z], k) => { const [a, b] = P(x, z); k ? g.lineTo(a, b) : g.moveTo(a, b); }); g.fill(); }
  minimapDots(g, P);
}
// on ne passe ni à travers les maisons, ni hors du relief fin
function blocked(x, z, r = 0.4) {
  if (Math.abs(x) > BORD || Math.abs(z) > BORD) return true;
  for (const m of MAISONS) if (Math.abs(x - m.cx) < 40 && Math.abs(z - m.cz) < 40)
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (dansPoly(x + dx, z + dz, m.pts)) return true;
  return false;
}
const level = {
  name: 'pouget', echelle: 0.6, musique: 'campagne', getH: hauteur, blocked, zoneName: () => 'Le Pouget',
  build, populate, animate, minimap,
  counts: () => '<small>Le Pouget, en Lozère — le hameau de granit sur sa pente. La porte de l’île, derrière toi, pour revenir.</small>',
  start: () => showMessage('Des maisons de granit accrochées à la pente, des toits de lauzes, et en bas, la vallée.', 6),
  arriveMessage: () => 'Le Pouget.',
  entry: () => ({ title: 'Le Pouget', sub: 'La Cloche des Troupeaux — Lozère', cam: [180, 120, 260], at: [0, 0, 0], cam2: [30, 22, 110], at2: [0, 4, 0], dur: 6 }),
  onKill: () => {},
};
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
