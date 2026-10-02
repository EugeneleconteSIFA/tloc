// monde.js — les lieux des autres mondes, bâtis depuis leur carte (carte/mondes/)
// =====================================================================
// Le Pouget (2 octobre) a montré la recette : un relief fin, l'horizon au loin, les maisons
// d'OSM, les chemins, l'eau, les arbres, et une porte vers l'île du temps. L'Aveyron et les
// Pouilles la reprennent : ce module la donne UNE fois, et chaque lieu (pouget.js,
// aveyron.js, matera.js, alberobello.js, gallipoli.js) n'en est plus qu'une fiche — sa
// lumière, sa pierre, la forme de ses toits, son départ, ses portes.
//
// Le volume des villes des Pouilles (2 000 à 3 000 bâtiments chacune) impose trois choses :
// tous les murs fondus en UN maillage (et les toits en un autre), les arbres en instances, et
// une grille pour les collisions des bâtiments.
// En mètres (1 unité = 1 m), x est, z sud, l'origine au repère du lieu : Camille à 0,6.
// =====================================================================
import * as PNJ_E from './engine.js?v=41';
import * as PNJ from './pnj.js';
import { THREE, TAU, rand, scene, G, mat, phMat, hemi, sun, renderer, bloom, mesh, boxG,
  addInteract, goToLevel, showMessage, showMenu, hideMenu, bootLevel, minimapDots, makeSky, player, state } from './engine.js?v=41';
import { especeGeo } from './foret.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DIR = 'carte/mondes/';

function dansPoly(x, z, pts) {
  let d = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d;
  }
  return d;
}
function densifier(pts, pas = 2) {
  const o = [];
  for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
    for (let t = 0; t < n; t++) o.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
  o.push(pts[pts.length - 1]); return o;
}

/**
 * Bâtit et lance un lieu. `f` : sa fiche —
 *   name, titre, sous, plan, fin (relief fin), loin (relief de l'horizon, facultatif),
 *   ciel: [haut, milieu, bas], brume: [couleur, près, loin], soleil: [x, y, z, intensité],
 *   sol: [slug, couleur], murs: [slug, couleur], toit: { style: 'deuxPans'|'plat', slug, couleur },
 *   arbres: { espece, bois, isoles, h: [min, max] } | null, mer: altitude NGF de la mer | null,
 *   depart: { x, z, yaw }, portes: [{ x, z, prompt, vers: [lieu, pos, yaw], label }],
 *   gare: { x, z, lignes: [[nom, lieu, pos, yaw]] } | null, plus(ctx) pour ce qui est propre au lieu,
 *   toitSur(b, geo) pour coiffer soi-même un bâtiment, anime(now), solLieu(x, z) → un sol à soi (ou null),
 *   musique, counts, start, entry
 */
export async function monde(f) {
  let R = null, H0 = 0, PLAN = null, B = [], GRILLE = new Map(), CADRE = null, arbres = [], voiles = [];
  const hauteur = (x, z) => {
    if (!R) return 0;
    const fx = Math.max(0, Math.min(R.nx - 1.001, (x - R.x0) / R.pas)), fz = Math.max(0, Math.min(R.nz - 1.001, (z - R.z0) / R.pas));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, h = R.h, n = R.nx;
    return (h[j * n + i] * (1 - u) + h[j * n + i + 1] * u) * (1 - v) + (h[(j + 1) * n + i] * (1 - u) + h[(j + 1) * n + i + 1] * u) * v - H0;
  };
  const dansCadre = (pts, m = 0) => pts.some(([x, z]) => x > CADRE.x0 - m && x < CADRE.x1 + m && z > CADRE.z0 - m && z < CADRE.z1 + m);
  const ruban = (pts, w, y) => {
    const pos = [], idx = [], uv = []; let s = 0;
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
      let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
      for (const c of [-1, 1]) { const px = x - dz * w / 2 * c, pz = z + dx * w / 2 * c; pos.push(px, hauteur(px, pz) + y, pz); uv.push((c + 1) / 2 * w / 2, s / 2); }
      if (k) { const b = (k - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed();
  };

  // ---------- un bâtiment : ses murs (extrudés sur l'emprise), son toit selon le style ----------
  const murs = [], toits = [], cones = [];
  function batir(b) {
    const pts = b.pts; if (pts.length < 3) return;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of pts) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang);
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const [x, z] of pts) { const a = (x - cx) * ux + (z - cz) * uz, c = -(x - cx) * uz + (z - cz) * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, c); b1 = Math.max(b1, c); }
    const L = a1 - a0, W = b1 - b0; if (L < 2 || W < 1.6) return;
    let hb = 1e9, ht = -1e9; for (const [x, z] of pts) { const h = hauteur(x, z); hb = Math.min(hb, h); ht = Math.max(ht, h); }
    const trullo = b.k === 'trullo' || b.toit === 'conical';
    const style = trullo ? 'trullo' : b.toit === 'flat' ? 'plat' : b.toit === 'gabled' ? 'deuxPans' : f.toit.style;
    const hm = trullo ? 2.4 : b.h ? Math.max(2.6, b.h - (style === 'deuxPans' ? W * 0.3 : 0)) : b.niv ? b.niv * 3 : (L * W > 60 ? f.hMurs[1] : f.hMurs[0]);
    const base = hb - 1.2, haut = ht + hm;
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const gm = new THREE.ExtrudeGeometry(sh, { depth: haut - base, bevelEnabled: false, steps: 1 }); gm.rotateX(-Math.PI / 2); gm.translate(0, base, 0);
    gm.clearGroups();
    // les UV des murs en mètres, face par face : sinon la pierre s'étire sur toute la façade
    const p = gm.attributes.position, uv = gm.attributes.uv; gm.computeVertexNormals(); const n = gm.attributes.normal;
    for (let k = 0; k < p.count; k++) { const plat = Math.abs(n.getY(k)) > 0.7; uv.setXY(k, plat ? p.getX(k) / 3 : (p.getX(k) * Math.abs(n.getZ(k)) + p.getZ(k) * Math.abs(n.getX(k))) / 3, plat ? p.getZ(k) / 3 : p.getY(k) / 3); }
    murs.push(gm.index ? gm.toNonIndexed() : gm);
    // un lieu peut coiffer lui-même certains bâtiments (les temples thaïs du grand piton)
    if (f.toitSur && f.toitSur(b, { cx, cz, ux, uz, a0, a1, b0, b1, L, W, haut })) { /* coiffé par le lieu */ }
    else if (style === 'trullo') {
      // le trullo : un cône de pierres sèches grises sur un cylindre blanchi, la pointe blanche
      const r = Math.sqrt(Math.max(4, L * W) / Math.PI) * 0.92, c = new THREE.ConeGeometry(r, r * 1.7, 14, 3); c.translate(cx, haut + r * 0.85, cz);
      cones.push(c.toNonIndexed());
      const s = new THREE.SphereGeometry(r * 0.16, 8, 6); s.translate(cx, haut + r * 1.75, cz); murs.push(s.toNonIndexed());
    } else if (style === 'deuxPans') {
      const o = 0.4, hl = Math.min((W / 2 + o) * f.toit.pente, f.toit.hMax || 1e9), ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
      const P = (a, c, y) => [cx + (ac + a) * ux - (bc + c) * uz, haut + y, cz + (ac + a) * uz + (bc + c) * ux];
      const la = L / 2 + o, lb = W / 2 + o;
      const v = [P(-la, -lb, 0), P(la, -lb, 0), P(la, 0, hl), P(-la, 0, hl), P(-la, lb, 0), P(la, lb, 0)];
      const pos = [], uvr = []; for (const t of [[0, 1, 2], [0, 2, 3], [4, 3, 2], [4, 2, 5]]) for (const k of t) {
        const q = v[k], a = (q[0] - cx) * ux + (q[2] - cz) * uz, c = Math.hypot(q[1] - haut, Math.abs(-(q[0] - cx) * uz + (q[2] - cz) * ux)); pos.push(...q); uvr.push(a / 2, c / 2); }
      const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gt.setAttribute('uv', new THREE.Float32BufferAttribute(uvr, 2)); gt.computeVertexNormals();
      toits.push(gt);
      const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute([...v[0], ...v[3], ...v[4], ...v[4], ...v[3], ...v[0], ...v[1], ...v[5], ...v[2], ...v[2], ...v[5], ...v[1]], 3));
      gp.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 1, 1, 0, 1, 0, 0.5, 1, 0, 0, 0, 0, 1, 0, 0.5, 1, 0.5, 1, 1, 0, 0, 0], 2)); gp.computeVertexNormals();
      murs.push(gp);
    }
    inscrire(pts, cx, cz);
  }
  // la grille des collisions : chaque bâtiment dans les cases de 20 m qu'il touche. Les lieux
  // y inscrivent aussi ce qu'ils bâtissent eux-mêmes (les maisons sur pilotis de Ko Panyi)
  function inscrire(pts, cx, cz) {
    const i = B.length; B.push({ pts, cx, cz });
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let gx = Math.floor(x0 / 20); gx <= Math.floor(x1 / 20); gx++) for (let gz = Math.floor(z0 / 20); gz <= Math.floor(z1 / 20); gz++) {
      const k = gx + ',' + gz; if (!GRILLE.has(k)) GRILLE.set(k, []); GRILLE.get(k).push(i); }
  }
  function bloque(x, z, r = 0.4) {
    if (x < CADRE.x0 || x > CADRE.x1 || z < CADRE.z0 || z > CADRE.z1) return true;
    // la mer — sauf là où le lieu pose un sol à lui (les barques du marché flottant de Ko Panyi)
    if (f.mer != null && hauteur(x, z) < f.mer - H0 + 0.2 && !(f.solLieu && f.solLieu(x, z) != null)) return true;
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
      const l = GRILLE.get(Math.floor((x + dx) / 20) + ',' + Math.floor((z + dz) / 20)); if (!l) continue;
      for (const i of l) if (dansPoly(x + dx, z + dz, B[i].pts)) return true;
    }
    return false;
  }

  // une porte vers l'île : un arc de pierre seul, qui luit du violet de l'île
  function porte(P) {
    const g = new THREE.Group(), y = hauteur(P.x, P.z); g.position.set(P.x, y, P.z); g.rotation.y = P.rot || 0; scene.add(g);
    const taille = phMat('old_stone_wall_02', 2, 2, { color: 0xc8beac });
    for (const sx of [-1, 1]) g.add(mesh(boxG(0.8, 3.6, 0.9), taille, sx * 1.5, 1.6, 0));
    const arc = mesh(new THREE.TorusGeometry(1.5, 0.4, 8, 20, Math.PI), taille, 0, 3.4, 0); arc.scale.z = 2.2; g.add(arc);
    const voile = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), new THREE.MeshBasicMaterial({ color: 0xc8b0e8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    voile.position.y = 1.7; g.add(voile); voiles.push(voile);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    addInteract({ pos: new THREE.Vector3(P.x, y, P.z), r: 3, prompt: () => P.prompt, fn: () => goToLevel(...P.vers, P.label) });
  }

  async function build() {
    const fich = [f.fin, f.plan, f.loin].filter(Boolean);
    const [rel, plan, loin] = await Promise.all(fich.map((n) => fetch(DIR + n).then((r) => r.json())));
    R = rel; PLAN = plan;
    H0 = f.h0 != null ? f.h0 : R.h[Math.round(-R.z0 / R.pas) * R.nx + Math.round(-R.x0 / R.pas)];
    CADRE = { x0: R.x0 + 8, z0: R.z0 + 8, x1: R.x0 + R.pas * (R.nx - 1) - 8, z1: R.z0 + R.pas * (R.nz - 1) - 8 };
    makeSky(...f.ciel, true);
    scene.fog = new THREE.Fog(...f.brume);
    hemi.intensity = 0.62; hemi.color.setHex(0xd8e4f4); hemi.groundColor.setHex(0x4a4430);
    sun.intensity = f.soleil[3]; sun.color.setHex(f.soleilCouleur || 0xfff0d8); sun.position.set(f.soleil[0], f.soleil[1], f.soleil[2]); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 600 }); sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.mapSize.set(2048, 2048);
    renderer.toneMappingExposure = 1.0; bloom.strength = 0.18;
    G.camBack = 7; G.camUp = 3.4;

    // ---------- le relief fin ----------
    { const w = R.pas * (R.nx - 1), d = R.pas * (R.nz - 1), g = new THREE.PlaneGeometry(w, d, R.nx - 1, R.nz - 1); g.rotateX(-Math.PI / 2);
      g.translate(R.x0 + w / 2, 0, R.z0 + d / 2);
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, hauteur(p.getX(k), p.getZ(k)));
      g.computeVertexNormals();
      const sol = new THREE.Mesh(g, phMat(f.sol[0], w, d, { color: f.sol[1] })); sol.receiveShadow = true; scene.add(sol); }
    // ---------- l'horizon : un relief large, éclairci, creusé sous le relief fin ----------
    if (loin) { const st = Math.max(1, Math.round(60 / loin.pas)), nx = Math.floor((loin.nx - 1) / st) + 1, nz = Math.floor((loin.nz - 1) / st) + 1;
      const g = new THREE.PlaneGeometry(loin.pas * st * (nx - 1), loin.pas * st * (nz - 1), nx - 1, nz - 1); g.rotateX(-Math.PI / 2);
      g.translate(loin.x0 + loin.pas * st * (nx - 1) / 2, 0, loin.z0 + loin.pas * st * (nz - 1) / 2);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), i = Math.round((x - loin.x0) / loin.pas), j = Math.round((z - loin.z0) / loin.pas);
        const h = loin.h[Math.min(loin.nz - 1, Math.max(0, j)) * loin.nx + Math.min(loin.nx - 1, Math.max(0, i))] - H0;
        p.setY(k, x > CADRE.x0 - 4 && x < CADRE.x1 + 4 && z > CADRE.z0 - 4 && z < CADRE.z1 + 4 ? h - 12 : h); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, phMat(f.loinSol ? f.loinSol[0] : 'forest_leaves_02', 300, 300, { color: f.loinSol ? f.loinSol[1] : 0x6a8058 })); m.receiveShadow = true; scene.add(m); }
    // ---------- la mer ----------
    if (f.mer != null) { const m = new THREE.Mesh(new THREE.CircleGeometry(6000, 64), new THREE.MeshStandardMaterial({ color: f.merCouleur || 0x2f6a8a, roughness: f.merPoli ?? 0.08, metalness: f.merMetal ?? 0.75 }));
      m.rotation.x = -Math.PI / 2; m.position.y = f.mer - H0 + 0.05; scene.add(m); }

    // ---------- les bâtiments, fondus par matière ----------
    PLAN.batiments.filter((b) => dansCadre(b.pts)).forEach(batir);
    if (murs.length) { const m = new THREE.Mesh(mergeGeometries(murs.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; })), phMat(f.murs[0], 3, 3, { color: f.murs[1], side: THREE.DoubleSide }));
      m.castShadow = m.receiveShadow = true; scene.add(m); }
    if (toits.length) { const m = new THREE.Mesh(mergeGeometries(toits), phMat(f.toit.slug, 1.4, 1.4, { color: f.toit.couleur, roughness: 0.85, side: THREE.DoubleSide })); m.castShadow = m.receiveShadow = true; scene.add(m); }
    if (cones.length) { const m = new THREE.Mesh(mergeGeometries(cones.map((g) => { g.deleteAttribute('uv'); g.computeVertexNormals(); const p = g.attributes.position, uv = [];
        for (let k = 0; k < p.count; k++) uv.push(Math.atan2(p.getZ(k), p.getX(k)) * 1.5, p.getY(k) / 0.6); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; })),
      phMat('rocher_01', 1.2, 1.2, { color: 0x8a8884, roughness: 0.9 })); m.castShadow = m.receiveShadow = true; scene.add(m); }

    // ---------- les chemins, les rues, l'eau ----------
    { const gs = [...PLAN.routes, ...PLAN.chemins].filter((c) => dansCadre(c.pts, 20)).map((c) => ruban(densifier(c.pts), c.r >= 3 ? 6 : c.r === 2 ? 4 : c.r === 1 ? 2.6 : 1.5, 0.18));
      if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), phMat(f.chemin[0], 3, 3, { color: f.chemin[1], polygonOffset: true, polygonOffsetFactor: -2 })); m.receiveShadow = true; scene.add(m); }
      const eau = new THREE.MeshStandardMaterial({ color: 0x4a6a80, roughness: 0.06, metalness: 0.65, polygonOffset: true, polygonOffsetFactor: -3 });
      const ge = (PLAN.eau.cours || []).filter((c) => dansCadre(c.pts, 20)).map((c) => ruban(densifier(c.pts), 1.4, 0.1));
      if (ge.length) scene.add(new THREE.Mesh(mergeGeometries(ge), eau));
      // les lacs : au niveau de leurs RIVES (la médiane du relief le long du contour) — le centre
      // du plan tombait parfois sur une avancée de terre, et l'eau débordait sur la rive
      for (const l of (PLAN.eau.plans || [])) { if (!dansCadre(l.pts) || l.pts.length < 3) continue;
        const rives = l.pts.map(([x, z]) => hauteur(x, z)).sort((a, b) => a - b), niveau = rives[Math.floor(rives.length * 0.3)];
        const g = new THREE.ShapeGeometry(new THREE.Shape(l.pts.map(([x, z]) => new THREE.Vector2(x, -z)))); g.rotateX(-Math.PI / 2);
        const lac = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3e6278, roughness: 0.05, metalness: 0.7 })); lac.position.y = niveau + 0.1; scene.add(lac); } }

    // ---------- les arbres ----------
    if (f.arbres) { const esp = especeGeo(f.arbres.espece);
      if (esp) {
        const bois = (PLAN.verdure.bois || []).filter((b) => dansCadre(b.pts, 30)), libre = (x, z) => !bloque(x, z, 3) && Math.hypot(x - f.depart.x, z - f.depart.z) > 6 && (f.mer == null || hauteur(x, z) > f.mer - H0 + 1);
        const W = CADRE.x1 - CADRE.x0, D = CADRE.z1 - CADRE.z0, cible = f.arbres.max || 900;
        for (let k = 0; k < cible * 12 && arbres.length < cible; k++) {
          const x = CADRE.x0 + Math.random() * W, z = CADRE.z0 + Math.random() * D, dedans = bois.some((b) => dansPoly(x, z, b.pts));
          if ((dedans ? Math.random() < f.arbres.bois : Math.random() < f.arbres.isoles) && libre(x, z) && arbres.every((p) => Math.abs(p[0] - x) > 4 || Math.abs(p[1] - z) > 4)) arbres.push([x, z]);
        }
        const n = arbres.length, tr = new THREE.InstancedMesh(esp.tronc, esp.matT, n), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
        arbres.forEach(([x, z], k) => { const h = rand(...f.arbres.h); q.setFromAxisAngle(Y, rand(0, TAU)); s.set(h * rand(0.85, 1.2), h, h * rand(0.85, 1.2));
          m4.compose(v.set(x, hauteur(x, z) - 0.2, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
        tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
      } }

    // ---------- les portes, la gare, et ce qui est propre au lieu ----------
    for (const P of f.portes || []) porte(P);
    if (f.gare) { const { x, z, lignes } = f.gare, y = hauteur(x, z);
      addInteract({ pos: new THREE.Vector3(x, y, z), r: 6, prompt: () => 'prendre le petit train',
        fn: () => showMenu('LE PETIT TRAIN', 'Gare de ' + f.titre, 'Il passe toutes les heures. Ici, une heure passe vite.',
          [...lignes.map(([nom, lieu, pos, yaw]) => ({ label: nom, fn: () => { hideMenu(); goToLevel(lieu, pos, yaw, 'Le petit train file à travers les oliviers…'); } })),
            { label: 'Rester ici', fn: () => { hideMenu(); state.paused = false; } }]) }); }
    if (f.plus) f.plus({ hauteur, scene, PLAN, H0, bloque, addInteract, inscrire, CADRE });
  }

  // la caméra : à l'arrivée par une porte, la sauvegarde rend l'angle du lieu qu'on quitte —
  // on la remet une fois dans le dos de Camille (camYaw = yaw : derrière elle, cf. engine.js)
  let camPosee = false;
  function animate(now) {
    for (const v of voiles) v.material.opacity = 0.28 + Math.sin(now / 900) * 0.08;
    if (f.anime) f.anime(now);
    if (!camPosee && state.running && !state.paused) {
      // arrivée par le train ou une porte : si la place tombe dans un mur, la place libre la plus proche
      const p = player.pos;
      if (bloque(p.x, p.z, 0.6)) libreAutour(p.x, p.z, (x, z) => p.set(x, hauteur(x, z), z));
      G.camYaw = player.yaw; camPosee = true; }
  }
  function libreAutour(x0, z0, poser) {
    for (let r = 1.5; r < 60; r += 1.5) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r; if (!bloque(x, z, 0.6)) { poser(x, z); return; } }
  }
  function populate() {
    let { x, z } = f.depart;
    // si le départ tombe dans un mur (le plan bouge), on cherche la place libre la plus proche
    for (let r = 0; r < 40 && bloque(x, z, 0.6); r += 1.5) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, xx = f.depart.x + Math.cos(a) * r, zz = f.depart.z + Math.sin(a) * r; if (!bloque(xx, zz, 0.6)) { x = xx; z = zz; break; } }
    player.pos.set(x, hauteur(x, z), z); player.yaw = f.depart.yaw; G.camYaw = f.depart.yaw;
  }
  function minimap(g, W2) {
    const sc = W2 / 300, P = (x, z) => [W2 / 2 + (x - player.pos.x) * sc, W2 / 2 + (z - player.pos.z) * sc];
    g.fillStyle = f.carteFond || '#7a8a5a'; g.fillRect(0, 0, W2, W2);
    g.fillStyle = '#4a6a3a'; for (const [x, z] of arbres) { const [a, b] = P(x, z); if (a > -2 && a < W2 + 2 && b > -2 && b < W2 + 2) g.fillRect(a - 1, b - 1, 2, 2); }
    g.fillStyle = '#6a6460';
    for (const m of B) { if (Math.abs(m.cx - player.pos.x) > 170 || Math.abs(m.cz - player.pos.z) > 170) continue;
      g.beginPath(); m.pts.forEach(([x, z], k) => { const [a, b] = P(x, z); k ? g.lineTo(a, b) : g.moveTo(a, b); }); g.fill(); }
    minimapDots(g, P);
  }
  const level = {
    name: f.name, echelle: 0.6, musique: f.musique || 'campagne', getH: f.solLieu ? (x, z) => { const s = f.solLieu(x, z); return s != null ? s : hauteur(x, z); } : hauteur, blocked: (x, z, r) => bloque(x, z, r), zoneName: () => f.titre,
    build, populate, animate, minimap,
    counts: () => `<small>${f.counts}</small>`,
    start: () => showMessage(f.start, 6), arriveMessage: () => f.titre + '.',
    entry: () => f.entry, onKill: () => {},
  };
  await PNJ.installerCamille(PNJ_E);
  bootLevel(level, null);
}
