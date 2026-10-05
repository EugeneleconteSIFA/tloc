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
import { THREE, TAU, scene, G, mat, phMat, hemi, sun, renderer, bloom, mesh, boxG,
  addInteract, goToLevel, showMessage, bootLevel, minimapDots, makeSky, player, state } from './engine.js?v=41';
import { especeGeo } from './foret.js';
import { construireHameau, potagers, murets, panneau, graine } from './pouget-bati.js';
import { planterArbresDePres } from './pouget-arbres.js';
import { enclos } from './pouget-enclos.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DIR = 'carte/mondes/';
const alea = graine(91), rand = (a, b) => a + alea() * (b - a);   // les arbres aux mêmes places à chaque visite
const BORD = 292;                                     // on marche dans le carré du relief fin
let R = null, H0 = 0, PLAN = null, MAISONS = [], TRONCS = [], solBati = () => -Infinity;
// sur la route qui monte du nord-est (la vue aérienne, Street View) : Camille arrive par où l'on
// arrive au Pouget, entre les murets, le panneau bleu devant, le hameau au bout de la montée
const DEPART = { x: 52.6, z: -104, yaw: Math.atan2(42 - 52.6, -54 + 104) };
const PORTE = { x: 52.8, z: -114 };
// LES NOMS DES MAISONS (les gîtes : la Bergerie, le 14/15, la Clède…) : à poser avec Eugène,
// d'après son plan (docs/references/pouget-plan-gites.webp). Un premier essai de correspondance
// avec les emprises OSM était faux (2 octobre) : la liste reste vide d'ici là. Une entrée :
// [nom, x, z] — un point dans l'emprise de la maison, ou le centre d'un rond de 5 m sans emprise.
const LIEUX = [];
let NOMMES = [];                    // la porte de l'île, sur la route, derrière Camille

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

// un ruban posé sur le relief (chemin, ruisseau), largeur w, à y au-dessus du sol. Des sommets
// tous les mètres en travers, pas seulement sur les bords : une route qui passe sur un dos
// d'âne s'enfonçait sous l'herbe en son milieu
function ruban(pts, w, y) {
  const pos = [], idx = [], uv = [], nc = Math.max(2, Math.ceil(w) + 1); let s = 0;
  for (let k = 0; k < pts.length; k++) {
    const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
    let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
    for (let c = 0; c < nc; c++) { const t = c / (nc - 1) * 2 - 1, px = x - dz * w / 2 * t, pz = z + dx * w / 2 * t; pos.push(px, hauteur(px, pz) + y, pz); uv.push((t + 1) / 2 * w / 2, s / 2); }
    // (dans ce sens-là, les faces regardent le ciel : dans l'autre, le chemin était invisible d'en haut)
    if (k) for (let c = 0; c + 1 < nc; c++) { const b = (k - 1) * nc + c, e = b + nc; idx.push(b, b + 1, e, b + 1, e + 1, e); }
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
    const sol = new THREE.Mesh(g, phMat('grass_ground', 600, 600, { color: 0xa2b47a })); sol.receiveShadow = true; scene.add(sol); }
  // ---------- les crêtes au loin : le RGE ALTI à 10 m, éclairci à 60 m, creusé sous le relief fin ----------
  { const st = 6, nx = Math.floor((monde.nx - 1) / st) + 1, nz = Math.floor((monde.nz - 1) / st) + 1;
    const g = new THREE.PlaneGeometry(monde.pas * st * (nx - 1), monde.pas * st * (nz - 1), nx - 1, nz - 1); g.rotateX(-Math.PI / 2);
    g.translate(monde.x0 + monde.pas * st * (nx - 1) / 2, 0, monde.z0 + monde.pas * st * (nz - 1) / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), i = Math.round((x - monde.x0) / monde.pas), j = Math.round((z - monde.z0) / monde.pas);
      const h = monde.h[Math.min(monde.nz - 1, Math.max(0, j)) * monde.nx + Math.min(monde.nx - 1, Math.max(0, i))] - H0;
      p.setY(k, Math.abs(x) < BORD + 4 && Math.abs(z) < BORD + 4 ? h - 12 : h); }
    g.computeVertexNormals();
    // vues de loin, les pentes des Cévennes sont des sapinières sombres (la vue de la terrasse) :
    // la feuillée photographiée, tirée vers le vert noir des épicéas
    const loin = new THREE.Mesh(g, phMat('forest_leaves_02', 300, 300, { color: 0x3e5034 })); loin.receiveShadow = true; scene.add(loin);
    // et la sapinière elle-même, sur les pentes d'en face : sans elle, la vallée n'était qu'une
    // nappe sombre. Les sapins de la forêt de Lille (faits pour le lointain, c'est le cas), posés
    // sur le maillage tel qu'il est dessiné (nœuds à 60 m), plus serrés dans les creux, rares
    // sur les crêtes qui restent nues (la photo de la terrasse)
    const noeud = (i, j) => monde.h[Math.max(0, Math.min(nz - 1, j)) * st * monde.nx + Math.max(0, Math.min(nx - 1, i)) * st] - H0;
    const hM = (x, z) => { const fx = (x - monde.x0) / (monde.pas * st), fz = (z - monde.z0) / (monde.pas * st), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      return (noeud(i, j) * (1 - u) + noeud(i + 1, j) * u) * (1 - v) + (noeud(i, j + 1) * (1 - u) + noeud(i + 1, j + 1) * u) * v; };
    // LE SUD MANQUE : la récolte du RGE ALTI s'arrête 300 m au sud du hameau, là même où la
    // pente descend à la vallée — au-delà, le vide et le ciel. En attendant la vraie tuile (à
    // récolter : carte/mondes/, « La Lozère »), une suite INVENTÉE prolonge le bord du relief :
    // la pente descend encore de 140 m, puis remonte en crête à 2 km, couverte de la même
    // sapinière (la photo de la terrasse). Continue au raccord : toutes les ondulations y valent 0.
    const zS = monde.z0 + monde.pas * st * (nz - 1), lisse = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
    const hSud = (x, z) => { const d = z - zS; return hM(x, zS) - 140 * lisse(0, 700, d) + 430 * lisse(700, 2400, d) + 28 * Math.sin(x / 230) * Math.sin(d / 310); };
    { const lx = monde.pas * st * (nx - 1), g = new THREE.PlaneGeometry(lx, 2400, nx - 1, 40); g.rotateX(-Math.PI / 2); g.translate(monde.x0 + lx / 2, 0, zS + 1200);
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, hSud(p.getX(k), p.getZ(k)));
      g.computeVertexNormals(); const m = new THREE.Mesh(g, loin.material); m.receiveShadow = true; scene.add(m); }
    const hLoin = (x, z) => z > zS ? hSud(x, z) : hM(x, z);
    const sap = especeGeo('sapin');
    if (sap) {
      const ps = [];
      for (let k = 0; k < 40000 && ps.length < 4500; k++) {
        const a = rand(0, TAU), r = BORD + 10 + Math.pow(alea(), 1.6) * 1500, x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.abs(x) < BORD + 4 && Math.abs(z) < BORD + 4) continue;
        const y = hLoin(x, z);
        if (y > 260 || alea() > 1 - (y + 150) / 450) continue;
        ps.push([x, y, z]);
      }
      const tr = new THREE.InstancedMesh(sap.tronc, sap.matT, ps.length), hp = new THREE.InstancedMesh(sap.houppier, sap.matH, ps.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
      ps.forEach(([x, y, z], k) => { const h = rand(16, 26); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU)); m4.compose(v.set(x, y - 1, z), q, sc.set(h * rand(0.9, 1.2), h, h * rand(0.9, 1.2))); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
      hp.material.color.setHex(0x5e6e5c); scene.add(tr, hp);
    } }

  // ---------- le hameau : les maisons accolées, les terrasses dallées (pouget-bati.js) ----------
  const routesHameau = PLAN.routes.filter((c) => dansCadre(c.pts, 40)), cheminsHameau = PLAN.chemins.filter((c) => dansCadre(c.pts, 40));
  const H = construireHameau({ h: hauteur, batiments: PLAN.batiments.filter((b) => dansCadre(b.pts)), chemins: [...routesHameau, ...cheminsHameau], dansPoly });
  MAISONS = H.maisons;
  NOMMES = LIEUX.map(([nom, x, z]) => ({ nom, x, z, m: MAISONS.find((m) => dansPoly(x, z, m.pts)) }));
  // les potagers en terrasses, au sud-ouest sous les maisons (la vue aérienne)
  const SOLS = [...H.sols, ...potagers({ h: hauteur, x0: -40, x1: -15, z0: 42, n: 5, prof: 3.4, M: H.M })];
  level.terrasses = SOLS;                            // (pour les bancs : où sont les terrasses)
  solBati = (x, z) => { let y = -Infinity; for (const t of SOLS) if (t.y > y && dansPoly(x, z, t.pts)) y = t.y; return y; };
  const dansMaison = (x, z, m) => MAISONS.some((mm) => Math.abs(x - mm.cx) < 40 && Math.abs(z - mm.cz) < 40 &&
    [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]].some(([dx, dz]) => dansPoly(x + dx, z + dz, mm.pts)));
  const distTrace = (x, z, cs) => { let d = 1e9; for (const c of cs) for (let k = 1; k < c.pts.length; k++) {
    const [ax, az] = c.pts[k - 1], [bx, bz] = c.pts[k], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return d; };

  // ---------- les chemins et les ruisseaux ----------
  // la route qui monte au hameau est goudronnée, gris clair (Street View) : l'asphalte
  // photographié, éclairci (une teinte au-delà de 1 éclaire la texture au lieu de l'assombrir)
  { const goudron = phMat('asphalt_02', 1, 1, { polygonOffset: true, polygonOffsetFactor: -2 }); goudron.color.setRGB(1.38, 1.36, 1.32);
    const pierre = phMat('rocky_trail', 3, 3, { color: 0xb8a888, polygonOffset: true, polygonOffsetFactor: -2 });
    const gr = routesHameau.map((c) => ruban(densifier(c.pts), 3.6, 0.12)), gc = cheminsHameau.map((c) => ruban(densifier(c.pts), c.r === 1 ? 2.4 : 1.4, 0.14));
    for (const g of gr) { const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 2, uv.getY(k) * 2); }   // ruban : UV en demi-mètres → en mètres
    if (gr.length) { const m = new THREE.Mesh(mergeGeometries(gr), goudron); m.receiveShadow = true; scene.add(m); }
    if (gc.length) { const m = new THREE.Mesh(mergeGeometries(gc), pierre); m.receiveShadow = true; scene.add(m); }
    const eau = new THREE.MeshStandardMaterial({ color: 0x5a7890, roughness: 0.08, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 });
    const ge = PLAN.eau.cours.filter((c) => dansCadre(c.pts, 40)).map((c) => ruban(densifier(c.pts), 1.1, 0.08));
    if (ge.length) scene.add(new THREE.Mesh(mergeGeometries(ge), eau)); }

  // ---------- la route d'arrivée : murets de pierre sèche, panneau, piquets du pré ----------
  // (la route du nord-est et la rue Principale, jusqu'aux maisons ; on coupe le muret au
  // débouché des autres chemins et contre les façades)
  let bordEnclos = null, ENCLOS = null;
  { const arrivee = routesHameau.filter((c) => c.pts.some(([x, z]) => z < -50 && Math.abs(x - 47) < 12) || c.nom === 'Rue Principale');
    const autres = [...cheminsHameau, ...routesHameau.filter((c) => !arrivee.includes(c))];
    murets({ h: hauteur, lignes: arrivee.map((c) => densifier(c.pts, 1)), largeur: 3.6, M: H.M,
      eviter: (x, z) => dansMaison(x, z, 1.2) || distTrace(x, z, autres) < 2.6 || Math.hypot(x - PORTE.x, z - PORTE.z) < 3 });
    // le panneau, à gauche en montant, derrière le muret ; tourné vers qui arrive
    const d = [42 - 53, -54 + 96], l = Math.hypot(...d), dx = d[0] / l, dz = d[1] / l, px = 45.6 + dz * 3.4, pz = -66 - dx * 3.4;
    panneau({ x: px, z: pz, y: hauteur(px, pz), face: Math.atan2(-dx, -dz) });
    // les piquets, à droite, sur le pré qui monte (côté ouest de la route)
    const nord = arrivee.find((c) => c.nom !== 'Rue Principale');
    // (sa clôture est celle du grand enclos des brebis, posé après les arbres : pouget-enclos.js)
    if (nord) bordEnclos = densifier(nord.pts, 2).filter(([, z]) => z < -60 && z > -124).map(([x, z], k, a) => { const [xa, za] = a[Math.max(0, k - 1)], [xb, zb] = a[Math.min(a.length - 1, k + 1)];
        const ex = xb - xa, ez = zb - za, n = Math.hypot(ex, ez) || 1; return [x - ez / n * 5.5, z + ex / n * 5.5]; }); }

  // ---------- les arbres ----------
  // De près (pouget-arbres.js) : les châtaigniers isolés des prés autour du hameau, les
  // bouleaux le long de la route d'arrivée. Au-delà, les arbres de la forêt de Lille, faits pour
  // le lointain : les châtaigniers des bois de la carte, et les sapins sombres de la vallée.
  const CENTRE = [8, -10], PRES = 95;
  { const proche = [], libre = (x, z, m) => !dansMaison(x, z, m) && distTrace(x, z, [...routesHameau, ...cheminsHameau]) > 4.5 && solBati(x, z) === -Infinity &&
      Math.hypot(x - DEPART.x, z - DEPART.z) > 5 && Math.hypot(x - PORTE.x, z - PORTE.z) > 5;
    // les bouleaux de la route : de part et d'autre, entre 4,5 et 10 m de la chaussée
    for (const [x, z] of [[50.2, -71], [50.8, -62], [49.4, -80], [41, -92], [43.5, -76], [38, -66], [47, -128], [60.5, -120], [59, -90], [36.5, -48]])
      if (libre(x, z, 2)) proche.push({ x, z, y: hauteur(x, z) - 0.1, espece: 'bouleau', s: rand(0.9, 1.1) });
    for (let k = 0; k < 4000 && proche.length < 34; k++) {
      const a = rand(0, TAU), r = rand(18, PRES - 6), x = CENTRE[0] + Math.cos(a) * r, z = CENTRE[1] + Math.sin(a) * r;
      if (libre(x, z, 6) && proche.every((p) => Math.hypot(p.x - x, p.z - z) > (p.espece === 'bouleau' ? 6 : 11))) proche.push({ x, z, y: hauteur(x, z) - 0.15, espece: 'chataignier', s: rand(0.85, 1.15) });
    }
    TRONCS = planterArbresDePres(proche);
    R.arbres = proche.map((p) => [p.x, p.z]); }
  // ---------- le grand enclos des brebis, en face de la première maison (Eugène, 2 octobre) ----------
  if (bordEnclos && bordEnclos.length > 3) ENCLOS = await enclos({ h: hauteur, bord: bordEnclos, troncs: TRONCS });
  { const chene = especeGeo('chene'), sapin = especeGeo('sapin');
    if (chene && sapin) {
      const bois = PLAN.verdure.bois.filter((b) => dansCadre(b.pts, 40)), places = [];
      const tous = [...routesHameau, ...cheminsHameau], libre = (x, z) => Math.hypot(x - CENTRE[0], z - CENTRE[1]) > PRES && distTrace(x, z, tous) > 3.5 && !(ENCLOS && dansPoly(x, z, ENCLOS.tour));
      for (let k = 0; k < 14000 && places.length < 1300; k++) {
        const x = rand(-BORD, BORD), z = rand(-BORD, BORD), bas = hauteur(x, z) < -36, dedans = bas || bois.some((b) => dansPoly(x, z, b.pts));
        if ((dedans || alea() < 0.035) && libre(x, z) && places.every((p) => Math.hypot(p[0] - x, p[1] - z) > (bas ? 4.2 : 5.5))) places.push([x, z, bas]);
      }
      // en bas, dans la vallée, la sapinière (la photo de la terrasse) ; plus haut, les châtaigniers
      for (const [esp, ps, h0, h1] of [[chene, places.filter((p) => !p[2]), 8, 13], [sapin, places.filter((p) => p[2]), 13, 21]]) {
        const n = ps.length, tr = new THREE.InstancedMesh(esp.tronc, esp.matT, n), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
        ps.forEach(([x, z], k) => { const h = rand(h0, h1); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU)); s.set(h * rand(0.85, 1.15), h, h * rand(0.85, 1.15));
          m4.compose(v.set(x, hauteur(x, z) - 0.2, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
        if (esp === sapin) hp.material.color.setHex(0x7a8a78);                // l'épicéa, plus sombre que le pin de Lille
        tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
      }
      R.arbres.push(...places.map(([x, z]) => [x, z]));
    } }

  // ---------- la porte de l'île : un arc de pierre seul sur le chemin, qui luit du violet de l'île ----------
  { const g = new THREE.Group(), y = hauteur(PORTE.x, PORTE.z); g.position.set(PORTE.x, y, PORTE.z); g.rotation.y = 0; scene.add(g);   // en travers de la route
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
// devant une maison du plan des gîtes, son nom ; ailleurs, le hameau
function zoneName(x, z) {
  for (const l of NOMMES) {
    if (l.m) { if ([[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dz]) => dansPoly(x + dx, z + dz, l.m.pts))) return l.nom; }
    else if (Math.hypot(x - l.x, z - l.z) < 5) return l.nom;
  }
  return 'Le Pouget';
}
// on ne passe ni à travers les maisons, ni hors du relief fin
function blocked(x, z, r = 0.4) {
  if (Math.abs(x) > BORD || Math.abs(z) > BORD) return true;
  for (const m of MAISONS) if (Math.abs(x - m.cx) < 40 && Math.abs(z - m.cz) < 40)
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (dansPoly(x + dx, z + dz, m.pts)) return true;
  for (const t of TRONCS) if (Math.abs(x - t.x) < 2 && Math.abs(z - t.z) < 2 && Math.hypot(x - t.x, z - t.z) < t.r + r) return true;
  return false;
}
const level = {
  name: 'pouget', echelle: 0.6, musique: 'campagne', getH: (x, z) => Math.max(hauteur(x, z), solBati(x, z)), blocked,   // les terrasses et les potagers se marchent au-dessus du relief
  zoneName,
  build, populate, animate, minimap,
  counts: () => '<small>Le Pouget, en Lozère — le hameau de granit sur sa pente. La porte de l’île, derrière toi, pour revenir.</small>',
  start: () => showMessage('Des maisons de granit accrochées à la pente, des toits de lauzes, et en bas, la vallée.', 6),
  arriveMessage: () => 'Le Pouget.',
  entry: () => ({ title: 'Le Pouget', sub: 'La Cloche des Troupeaux — Lozère', cam: [220, 110, -260], at: [10, -5, 0], cam2: [56, -6, -128], at2: [40, -4, -50], dur: 6 }),
  onKill: () => {},
};
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
