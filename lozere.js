// lozere.js — la Lozère de l'acte V : Villefort et son lac, la Garde-Guérin
// =====================================================================
// La Cloche des Troupeaux (STORY.md, acte V ; docs/SCENARIO.md § 14) : « Villefort, le lac, le
// Pouget, les vieux chemins, les menhirs et la Garde-Guérin ». Chaque lieu a sa page
// (villefort.html, garde-guerin.html) et sa fiche ici ; monde.js en est la recette.
// Le Pouget a son propre module (pouget.js), tenu par une autre session.
//
// Tout est dans le repère de lozere.json — 1 unité = 1 m, origine au hameau du Pouget, x est,
// z sud — sans recentrer chaque lieu : les positions d'arrivée se donnent d'un lieu à l'autre
// dans un seul repère, et le soleil suit Camille (engine.js), l'ombre ne dépend pas de l'origine.
//
// LE BÂTI EST FAIT ICI, pas par monde.js (consigne d'Eugène du 2 octobre : « ton lieu doit être
// JUSTE et 100 % praticable »). Bâties en masse, les maisons d'OSM avaient un seul toit sur le
// rectangle englobant (une pyramide sur le château en L), des soubassements de plusieurs mètres
// côté aval, des rues coupées par des murs. Le plan de chaque lieu (carte/mondes/
// plans-lieux-lozere.py) ne donne donc à monde.js aucun bâtiment ; ils sont sous `maisons`, et
// `batirMaisons` en fait des ailes, chacune son toit, posées au niveau de leur rue, avec un
// terre-plein côté aval. Les rues et les arbres aussi sont posés ici (voir plus bas pourquoi).
// Ce qui a été bâti est consigné dans BILAN, que mesure bancs/lieu-lozere.mjs.
//
// On passe d'un lieu à l'autre par LES VIEUX CHEMINS : un poteau indicateur à chaque lieu, qui
// propose les deux autres (comme le petit train des Pouilles). Pas encore de porte de l'île.
// =====================================================================
import { monde } from './monde.js';
import { THREE, scene, rand, TAU, phMat, phPeint, PH, showMenu, hideMenu, goToLevel, state, dialogue, G } from './engine.js?v=41';
import * as PNJ from './pnj.js';
import { especeGeo } from './foret.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Le granit en gros moellons et la lauze de schiste : Lille n'en avait pas. Deux matières Poly Haven
// (CC0, stone_wall et roof_slates_02), réduites à 512 px pour la Lozère, inscrites ici plutôt que
// dans engine.js qu'une autre session tient (à y remonter). UV en mètres partout (Lot) : la
// tuile est la taille réelle de la photo, 2 m de moellons, 3 m de lauzes.
Object.assign(PH, {
  granit_lozere: { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a958a },
  lauze_lozere:  { tuile: 3.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6a6866 },
  // l'enrobé et le dallage de granit du bourg de Villefort : déjà dans le dépôt, inscrits comme dans
  // aveyron.js (mêmes valeurs ; la seconde inscription ne change rien)
  asphalt_02:      { tuile: 3.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a8a88 },
  granite_tile_03: { tuile: 1.8, maps: ['couleur', 'normale'], repli: 0x8a8580 },
});

// ce que le lieu a bâti, pour le banc (bancs/lieu-lozere.mjs)
export const BILAN = { batiments: 0, corps: [], rubans: [] };

// ---------------------------------------------------------------------
//  Les vieux chemins : où l'on arrive dans chaque lieu
// ---------------------------------------------------------------------
// [x, y, z] et l'angle de Camille à l'arrivée ; le poteau est planté à côté. Le Pouget : l'arrivée
// de pouget.js (la route du nord-est, face au hameau) — c'est Eugène qui pose l'entrée de ce côté.
export const ARRIVEES = {
  villefort:   { titre: 'Villefort',         pos: [1582, 0, -1132], yaw: Math.atan2(100, 157), poteau: [1584.5, -1129.5] },
  gardeguerin: { titre: 'La Garde-Guérin',   pos: [1852, 0, -5236], yaw: Math.atan2(-15, -60), poteau: [1850.5, -5233.8] },
  pouget:      { titre: 'Le Pouget',         pos: [52.6, 0, -104],  yaw: Math.atan2(42 - 52.6, -54 + 104) },
};
const RECIT = {
  villefort: 'Le chemin descend vers le bourg, le long de l’Altier.',
  gardeguerin: 'La vieille route monte au plateau : la Régordane, celle des pèlerins et des muletiers.',
  pouget: 'Le chemin raide qui monte au hameau, à travers les châtaigniers.',
};

// ---------------------------------------------------------------------
//  Outils
// ---------------------------------------------------------------------
const V = (x, y, z) => new THREE.Vector3(x, y, z), HAUT = V(0, 1, 0);
function densifier(pts, pas = 2) {
  const o = [];
  for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
    for (let t = 0; t < n; t++) o.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
  o.push(pts[pts.length - 1]); return o;
}
function dansPoly(x, z, pts) {
  let d = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; }
  return d;
}
const dansCadre = (CADRE, pts, m = 0) => pts.some(([x, z]) => x > CADRE.x0 - m && x < CADRE.x1 + m && z > CADRE.z0 - m && z < CADRE.z1 + m);
const distLigne = (x, z, pts) => { let d = 1e9; for (let k = 1; k < pts.length; k++) { const [ax, az] = pts[k - 1], [bx, bz] = pts[k], dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return d; };
const largeur = (c) => c.r >= 3 ? 6 : c.r === 2 ? 4.5 : c.r === 1 ? 3 : 1.6;
// une grille de 10 m pour retrouver vite ce qui est près d'un point
function grille(objets, boite) {
  const G = new Map();
  objets.forEach((o, i) => { const [x0, z0, x1, z1] = boite(o, i);
    for (let gx = Math.floor(x0 / 10); gx <= Math.floor(x1 / 10); gx++) for (let gz = Math.floor(z0 / 10); gz <= Math.floor(z1 / 10); gz++) {
      const k = gx + ',' + gz; if (!G.has(k)) G.set(k, []); G.get(k).push(i); } });
  return (x, z) => G.get(Math.floor(x / 10) + ',' + Math.floor(z / 10)) || [];
}

// Le relief TEL QU'IL EST DESSINÉ : monde.js le maille en PlaneGeometry, deux triangles par case
// (diagonale du coin (i, j+1) au coin (i+1, j)), alors que hauteur() interpole en bilinéaire.
// Entre les deux, jusqu'à plusieurs centimètres sur une pente qui tourne : un ruban posé sur
// hauteur() flottait ou s'enfonçait. Aux nœuds les deux s'accordent, on part donc des nœuds.
function relief(hauteur, g) {
  return (x, z) => {
    const fx = (x - g.x0) / g.pas, fz = (z - g.z0) / g.pas, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const N = (a, b) => hauteur(g.x0 + a * g.pas, g.z0 + b * g.pas), A = N(i, j), B = N(i, j + 1), C = N(i + 1, j + 1), D = N(i + 1, j);
    return u + v <= 1 ? A + u * (D - A) + v * (B - A) : C + (1 - u) * (B - C) + (1 - v) * (D - C);
  };
}

// Un lot de faces d'une même matière, fusionné en un seul maillage. Les UV sont la projection
// du MONDE sur la face, en mètres : la pierre garde sa taille réelle d'une maison à l'autre.
class Lot {
  constructor() { this.p = []; this.u = []; }
  face(pts, dehors) {
    const n = V().subVectors(pts[1], pts[0]).cross(V().subVectors(pts[2], pts[0])).normalize();
    if (n.dot(dehors) < 0) { pts = pts.slice().reverse(); n.negate(); }
    let tu, tv;
    if (Math.abs(n.y) > 0.92) { tu = V(1, 0, 0); tv = V(0, 0, 1); }
    else { tv = HAUT.clone().addScaledVector(n, -n.y).normalize(); tu = V().crossVectors(tv, n); }   // v monte la pente : les rangs de lauzes restent horizontaux
    for (const t of pts.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]) { const p = pts[t]; this.p.push(p.x, p.y, p.z); this.u.push(p.dot(tu), p.dot(tv)); }
  }
  bloc(o, ex, ey, ez) {
    const ax = [ex, ey, ez];
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const a = ax[(k + 1) % 3], b = ax[(k + 2) % 3], c = o.clone().addScaledVector(ax[k], s);
      this.face([c.clone().sub(a).sub(b), c.clone().add(a).sub(b), c.clone().add(a).add(b), c.clone().sub(a).add(b)], ax[k].clone().multiplyScalar(s));
    }
  }
  maille(m, ombre = true) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals();
    const o = new THREE.Mesh(g, m); o.castShadow = ombre; o.receiveShadow = true; scene.add(o); return o;
  }
}

// ---------------------------------------------------------------------
//  Les rues
// ---------------------------------------------------------------------
// monde.js trace ses rubans, mais leurs faces regardent vers le bas (PROMPT-REPRISE.md § 4.E) et
// son matériau n'a qu'une face : on ne les voit pas. Ici : des sommets tous les mètres en long et
// en travers, posés sur le relief DESSINÉ, 1,5 cm au-dessus. Deux rubans qui se croisent ne sont
// jamais à la même hauteur (sinon les deux surfaces se battent, le z-fighting) : chaque ruban
// reçoit un étage de 3 mm, choisi pour différer de tous ceux qu'il croise.
function rues(ctx, choix) {
  const { PLAN, CADRE, scene } = ctx, h = ctx.dessin;
  const toutes = [...PLAN.routes, ...PLAN.chemins].filter((c) => dansCadre(CADRE, c.pts, 20));
  const boites = toutes.map((c) => { const w = largeur(c) / 2 + 0.5, xs = c.pts.map((p) => p[0]), zs = c.pts.map((p) => p[1]); return [Math.min(...xs) - w, Math.min(...zs) - w, Math.max(...xs) + w, Math.max(...zs) + w]; });
  const etage = [], dens = toutes.map((c) => densifier(c.pts, 1));
  toutes.forEach((c, i) => { const pris = new Set();
    for (let j = 0; j < i; j++) { const a = boites[i], b = boites[j]; if (a[0] > b[2] || b[0] > a[2] || a[1] > b[3] || b[1] > a[3]) continue;
      const lim = (largeur(c) + largeur(toutes[j])) / 2 + 0.5;
      if (dens[i].some(([x, z]) => distLigne(x, z, toutes[j].pts) < lim)) pris.add(etage[j]); }
    let e = 0; while (pris.has(e)) e++; etage.push(e % 6); });
  const lots = new Map();
  toutes.forEach((c, i) => {
    const [slug, couleur] = choix(c), w = largeur(c), pts = densifier(c.pts, 1), y = 0.015 + 0.003 * etage[i];
    const pos = [], idx = [], uv = [], nc = Math.max(2, Math.ceil(w) + 1); let s = 0;
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
      let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
      for (let q = 0; q < nc; q++) { const t = q / (nc - 1) * 2 - 1, px = x - dz * w / 2 * t, pz = z + dx * w / 2 * t; pos.push(px, h(px, pz) + y, pz); uv.push((t + 1) / 2 * w, s); }
      if (k) for (let q = 0; q + 1 < nc; q++) { const b = (k - 1) * nc + q, e = b + nc; idx.push(b, b + 1, e, b + 1, e + 1, e); }   // faces vers le ciel
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const xs = c.pts.map((p) => p[0]), zs = c.pts.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    BILAN.rubans.push({ geo: g, pts: c.pts, w, cx, cz, rayon: Math.hypot(Math.max(...xs) - cx, Math.max(...zs) - cz) + w });
    const cle = slug + couleur; if (!lots.has(cle)) lots.set(cle, { slug, couleur, gs: [] }); lots.get(cle).gs.push(g);
  });
  for (const { slug, couleur, gs } of lots.values()) {
    const m = new THREE.Mesh(mergeGeometries(gs), phMat(slug, 1, 1, { color: couleur, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; scene.add(m);
  }
}

// ---------------------------------------------------------------------
//  Les maisons
// ---------------------------------------------------------------------
// L'orientation d'une emprise : ses murs sont d'équerre, on prend l'angle (modulo 90°) que
// portent ses plus longs côtés.
function angleDe(pts) {
  const hist = new Float32Array(90);
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const dx = pts[i][0] - pts[j][0], dz = pts[i][1] - pts[j][1], l = Math.hypot(dx, dz), a = Math.round(((Math.atan2(dz, dx) * 180 / Math.PI) % 90 + 90) % 90);
    for (let d = -2; d <= 2; d++) hist[(a + d + 90) % 90] += l * (3 - Math.abs(d));
  }
  let b = 0; for (let k = 1; k < 90; k++) if (hist[k] > hist[b]) b = k;
  return b * Math.PI / 180;
}
// Les ailes d'une emprise : on la tranche tous les 50 cm le long de son orientation ; les tranches
// voisines de même largeur forment une aile, qui aura ses murs, sa hauteur et son toit à elle
// (un seul toit sur un L faisait une pyramide). Rendu dans le repère local (a le long, b en travers).
function ailes(pts, th) {
  const ux = Math.cos(th), uz = Math.sin(th);
  const A = pts.map(([x, z]) => x * ux + z * uz), B = pts.map(([x, z]) => -x * uz + z * ux);
  const pas = 0.5, tr = [];
  for (let a = Math.min(...A) + pas / 2; a < Math.max(...A); a += pas) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((A[i] - a) * (A[j] - a) < 0) xs.push(B[i] + (a - A[i]) / (A[j] - A[i]) * (B[j] - B[i]));
    xs.sort((p, q) => p - q); let m = null;
    for (let k = 0; k + 1 < xs.length; k += 2) if (!m || xs[k + 1] - xs[k] > m[1] - m[0]) m = [xs[k], xs[k + 1]];
    if (m) tr.push({ a, b0: m[0], b1: m[1] });
  }
  const g = [];
  for (const t of tr) { const p = g[g.length - 1];
    if (p && Math.abs(t.b0 - p.b0) < 0.9 && Math.abs(t.b1 - p.b1) < 0.9 && t.a - p.a1 < pas) { p.a1 = t.a + pas / 2; p.n++; p.s0 += t.b0; p.s1 += t.b1; p.b0 = p.s0 / p.n; p.b1 = p.s1 / p.n; }
    else g.push({ a0: t.a - pas / 2, a1: t.a + pas / 2, b0: t.b0, b1: t.b1, s0: t.b0, s1: t.b1, n: 1 }); }
  // une aile de moins de 1,5 m n'est qu'un décroché du tracé : la voisine la plus large l'absorbe
  for (let k = 0; k < g.length; k++) if (g.length > 1 && g[k].a1 - g[k].a0 < 1.5) {
    const v = g[k - 1] && (!g[k + 1] || g[k - 1].b1 - g[k - 1].b0 > g[k + 1].b1 - g[k + 1].b0) ? g[k - 1] : g[k + 1];
    v.a0 = Math.min(v.a0, g[k].a0); v.a1 = Math.max(v.a1, g[k].a1); g.splice(k--, 1); }
  return g.filter((r) => r.b1 - r.b0 > 1.8).map(({ a0, a1, b0, b1 }) => ({ a0, a1, b0, b1, ux, uz }));
}
const coins = (r, m = [0, 0, 0, 0]) => [[r.a0 - m[0], r.b0 - m[2]], [r.a1 + m[1], r.b0 - m[2]], [r.a1 + m[1], r.b1 + m[3]], [r.a0 - m[0], r.b1 + m[3]]]
  .map(([a, b]) => [a * r.ux - b * r.uz, a * r.uz + b * r.ux]);
const local = (r, x, z) => [x * r.ux + z * r.uz, -x * r.uz + z * r.ux];

// opts : maisons (les emprises), rues (les tracés), mats, special(b) → { tour, ruine, clocher }
function batirMaisons(ctx, opts) {
  const { hauteur, inscrire } = ctx, h = ctx.dessin, M = opts.mats;
  const L = { murs: new Lot(), toits: new Lot(), terre: new Lot(), herbe: new Lot() };
  const rues = opts.rues.map((c) => ({ pts: densifier(c.pts, 1), w: largeur(c) / 2 }));
  const pointsRue = rues.flatMap((r) => r.pts.map(([x, z]) => [x, z, r.w]));
  const rueAutour = grille(pointsRue, ([x, z, w]) => [x - w - 2, z - w - 2, x + w + 2, z + w + 2]);
  const distRue = (x, z) => { let d = 1e9; for (const i of rueAutour(x, z)) { const [a, b, w] = pointsRue[i]; d = Math.min(d, Math.hypot(a - x, b - z) - w); } return d; };
  const maisons = opts.maisons.filter((b) => b.pts.length >= 3);

  // 1. l'orientation : des maisons mitoyennes (à moins d'un mètre l'une de l'autre) d'angles
  //    voisins prennent la même — une rangée a un seul alignement de faîtages
  const angles = maisons.map((b) => angleDe(b.pts)), parent = maisons.map((_, i) => i), aire = maisons.map((b) => Math.abs(b.pts.reduce((s, [x, z], k) => { const [x2, z2] = b.pts[(k + 1) % b.pts.length]; return s + x * z2 - x2 * z; }, 0)) / 2);
  const chef = (i) => parent[i] === i ? i : (parent[i] = chef(parent[i]));
  const boiteM = maisons.map((b) => { const xs = b.pts.map((p) => p[0]), zs = b.pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; });
  const mAutour = grille(maisons, (_, i) => boiteM[i].map((v, k) => v + (k < 2 ? -1 : 1)));
  maisons.forEach((b, i) => { for (const j of new Set(b.pts.flatMap(([x, z]) => mAutour(x, z)))) if (j > i) {
    const d = Math.abs(((angles[i] - angles[j]) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2)), da = Math.min(d, Math.PI / 2 - d);
    if (da < 0.21 && b.pts.some(([x, z]) => distLigne(x, z, [...maisons[j].pts, maisons[j].pts[0]]) < 1)) parent[chef(j)] = chef(i); } });
  const angleGroupe = new Map(); maisons.forEach((_, i) => { const c = chef(i); if (!angleGroupe.has(c) || aire[i] > angleGroupe.get(c)[1]) angleGroupe.set(c, [angles[i], aire[i]]); });

  // 2. les ailes, reculées hors des rues : là où OSM fait passer une rue dans une emprise (un
  //    passage, un tracé approximatif), on retire du mur la largeur de la rue et 30 cm — sinon
  //    Camille se cogne à un mur invisible au milieu de la chaussée
  const corps = [];
  maisons.forEach((b, i) => {
    const sp = opts.special ? opts.special(b) : {};
    for (const r of ailes(b.pts, angleGroupe.get(chef(i))[0])) {
      if (!sp.tour) {
        const cx0 = (r.a0 + r.a1) / 2, cb0 = (r.b0 + r.b1) / 2, [wx, wz] = [cx0 * r.ux - cb0 * r.uz, cx0 * r.uz + cb0 * r.ux];
        for (const k of rueAutour(wx, wz).concat(...[[-10, 0], [10, 0], [0, -10], [0, 10]].map(([dx, dz]) => rueAutour(wx + dx, wz + dz)))) {
          const [x, z, w] = pointsRue[k], [a, bb] = local(r, x, z), m = w + 0.3;
          if (a < r.a0 - m || a > r.a1 + m || bb < r.b0 - m || bb > r.b1 + m) continue;
          // le côté qu'il en coûte le moins de reculer
          const coupes = [[a + m - r.a0, 'a0'], [r.a1 - (a - m), 'a1'], [bb + m - r.b0, 'b0'], [r.b1 - (bb - m), 'b1']].sort((p, q) => p[0] - q[0]);
          const [d, cote] = coupes[0]; if (cote === 'a0') r.a0 += d; else if (cote === 'a1') r.a1 -= d; else if (cote === 'b0') r.b0 += d; else r.b1 -= d;
          if (r.a1 - r.a0 < 2.2 || r.b1 - r.b0 < 2.2) break;
        }
      }
      if (r.a1 - r.a0 < 2.2 || r.b1 - r.b0 < 2.2) continue;
      corps.push({ ...r, b, i, sp });
    }
  });
  // deux emprises d'OSM qui se recouvrent (deux relevés du même mur) : l'aile la plus petite
  // recule hors de la plus grande, du côté où il en coûte le moins
  for (let i = 0; i < corps.length; i++) for (let j = 0; j < corps.length; j++) {
    const a = corps[i], b = corps[j]; if (a.i === b.i || (a.a1 - a.a0) * (a.b1 - a.b0) > (b.a1 - b.a0) * (b.b1 - b.b0)) continue;
    for (let passe = 0; passe < 4; passe++) {
      const pts = densifier([...coins(a, [-0.05, -0.05, -0.05, -0.05]), coins(a, [-0.05, -0.05, -0.05, -0.05])[0]], 0.5).filter(([x, z]) => dansPoly(x, z, coins(b)));
      if (!pts.length) break;
      const loc = pts.map(([x, z]) => local(a, x, z)), amin = Math.min(...loc.map((q) => q[0])), amax = Math.max(...loc.map((q) => q[0])), bmin = Math.min(...loc.map((q) => q[1])), bmax = Math.max(...loc.map((q) => q[1]));
      const c2 = [[amax - a.a0 + 0.05, 'a0'], [a.a1 - amin + 0.05, 'a1'], [bmax - a.b0 + 0.05, 'b0'], [a.b1 - bmin + 0.05, 'b1']].sort((p, q) => p[0] - q[0])[0];
      if (c2[1] === 'a0') a.a0 += c2[0]; else if (c2[1] === 'a1') a.a1 -= c2[0]; else if (c2[1] === 'b0') a.b0 += c2[0]; else a.b1 -= c2[0];
    }
  }
  for (let i = corps.length - 1; i >= 0; i--) if (corps[i].a1 - corps[i].a0 < 2 || corps[i].b1 - corps[i].b0 < 2) corps.splice(i, 1);
  const boiteC = corps.map((c) => { const p = coins(c), xs = p.map((q) => q[0]), zs = p.map((q) => q[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; });
  const cAutour = grille(corps, (_, i) => boiteC[i].map((v, k) => v + (k < 2 ? -3 : 3)));
  const autreCorps = (c, x, z) => cAutour(x, z).some((j) => corps[j] !== c && dansPoly(x, z, coins(corps[j])));

  // 3. le plancher : au niveau de la rue qui le dessert (le côté le plus bas qui touche une rue,
  //    là est la porte) ; sans rue à moins de 4 m, au tiers bas du terrain autour
  const plateformes = [];
  for (const c of corps) {
    const pied = []; for (const s of [0, 1, 2, 3]) { const [p, q] = [coins(c, [0.35, 0.35, 0.35, 0.35])[s], coins(c, [0.35, 0.35, 0.35, 0.35])[(s + 1) % 4]];
      const n = Math.max(2, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]))); for (let k = 0; k < n; k++) pied.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n, s]); }
    const sol = pied.map(([x, z]) => h(x, z)), rue = pied.map(([x, z]) => distRue(x, z) < 4);
    const cotes = sol.filter((_, k) => rue[k]), tries = sol.slice().sort((a, b) => a - b);
    c.plancher = cotes.length ? Math.min(...cotes) : tries[Math.floor(tries.length / 3)];
    c.solMin = tries[0]; c.pied = pied;
    // 4. le terre-plein, côté aval : là où le terrain tombe sous le plancher, une plate-forme
    //    de 2 m devant le mur, tenue par un mur de pierre — le mur de la maison ne pend plus.
    //    Pas sur une rue (on ne la barre pas), ni chez le voisin.
    const m = [0, 0, 0, 0];
    for (const s of [0, 1, 2, 3]) {
      const basCote = Math.min(...sol.filter((_, k) => pied[k][2] === s));
      if (c.plancher - basCote < 0.3) continue;
      let e = 2.0;
      for (; e > 0.4; e -= 0.4) { const mm = [0, 0, 0, 0]; mm[[2, 1, 3, 0][s]] = e;
        // la bande ajoutée seulement (pas la maison elle-même), en points tous les 50 cm
        const a0 = c.a0 - mm[0], a1 = c.a1 + mm[1], b0 = c.b0 - mm[2], b1 = c.b1 + mm[3]; let ok = true;
        for (let a = a0; a <= a1 + 0.01 && ok; a += 0.5) for (let b = b0; b <= b1 + 0.01 && ok; b += 0.5) {
          if (a > c.a0 && a < c.a1 && b > c.b0 && b < c.b1) continue;
          const x = a * c.ux - b * c.uz, z = a * c.uz + b * c.ux; if (distRue(x, z) < 0.5 || autreCorps(c, x, z)) ok = false; }
        if (ok) break; }
      m[[2, 1, 3, 0][s]] = e > 0.4 ? e : 0.35;
    }
    c.marge = m;
    plateformes.push({ c, pts: coins(c, m), y: c.plancher - 0.05 });
  }

  // 5. la hauteur des murs : les niveaux d'OSM s'ils y sont, sinon d'après la surface ; une remise
  //    reste basse. Les ailes d'une même maison partagent leur avant-toit.
  for (const c of corps) {
    const L2 = c.a1 - c.a0, W2 = c.b1 - c.b0, s = L2 * W2, k = c.b.k;
    c.haut = c.b.niv ? c.b.niv * 2.9 + 0.5 : (k === 'shed' || k === 'garage' || s < 14) ? 2.7 : s > 70 ? 5.8 : s > 30 ? 4.8 : 3.8;
    if (c.sp.tour) c.haut = (c.b.h || 20);
    if (c.sp.ruine) c.haut = 6.5;
    c.avt = c.plancher + c.haut;
  }

  // 6. les murs, de la fondation à l'avant-toit, et les terre-pleins
  for (const c of corps) {
    const [cx, cz] = [((c.a0 + c.a1) / 2) * c.ux - ((c.b0 + c.b1) / 2) * c.uz, ((c.a0 + c.a1) / 2) * c.uz + ((c.b0 + c.b1) / 2) * c.ux];
    const r = V(c.ux, 0, c.uz), s = V(-c.uz, 0, c.ux), bas = Math.min(c.solMin, c.plancher) - 0.5;
    L.murs.bloc(V(cx, (bas + c.avt) / 2, cz), r.clone().multiplyScalar((c.a1 - c.a0) / 2), V(0, (c.avt - bas) / 2, 0), s.clone().multiplyScalar((c.b1 - c.b0) / 2));
    c.cx = cx; c.cz = cz; c.rect = coins(c);
    inscrire(c.rect, cx, cz);
  }
  for (const p of plateformes) {
    const c = p.c, m = c.marge; if (!m.some((v) => v > 0.4)) continue;
    const a0 = c.a0 - m[0], a1 = c.a1 + m[1], b0 = c.b0 - m[2], b1 = c.b1 + m[3], am = (a0 + a1) / 2, bm = (b0 + b1) / 2;
    const r = V(c.ux, 0, c.uz), s = V(-c.uz, 0, c.ux), o = V(am * c.ux - bm * c.uz, 0, am * c.uz + bm * c.ux), bas = c.solMin - 0.6;
    L.terre.bloc(o.clone().setY((bas + p.y - 0.04) / 2), r.clone().multiplyScalar((a1 - a0) / 2), V(0, (p.y - 0.04 - bas) / 2, 0), s.clone().multiplyScalar((b1 - b0) / 2));
    L.herbe.bloc(o.clone().setY(p.y - 0.02), r.clone().multiplyScalar((a1 - a0) / 2), V(0, 0.02, 0), s.clone().multiplyScalar((b1 - b0) / 2));
  }

  // 7. les toits : deux pans de lauzes, le faîtage sur le LONG côté de l'aile, 40 cm de débord en
  //    bas de pente et 30 en pignon — rentrés à zéro du côté où l'aile touche un voisin (le toit ne
  //    descend jamais sur lui). Pente de 37°, montée plafonnée : pas de cathédrale sur une remise.
  for (const c of corps) {
    if (c.sp.tour || c.sp.ruine) { c.toit = c.rect; c.toitEchant = []; continue; }
    const long = c.a1 - c.a0 >= c.b1 - c.b0;
    // r : le faîtage ; s : la pente ; L le long du faîtage, W en travers
    const r = long ? V(c.ux, 0, c.uz) : V(-c.uz, 0, c.ux), s = long ? V(-c.uz, 0, c.ux) : V(-c.ux, 0, -c.uz);
    const Lf = long ? c.a1 - c.a0 : c.b1 - c.b0, W = long ? c.b1 - c.b0 : c.a1 - c.a0;
    const mont = Math.min(W / 2 * 0.75, Lf * W < 14 ? 1.4 : 4.2), ep = 0.15;
    const cx = c.cx, cz = c.cz, P = (a, b, y) => V(cx + r.x * a + s.x * b, y, cz + r.z * a + s.z * b);
    // le débord de chaque côté, rentré là où un voisin est à moins de 60 cm
    const libre = (a, b) => !autreCorps(c, cx + r.x * a + s.x * b, cz + r.z * a + s.z * b);
    const deb = (fixe, cote, o) => { const lg = cote ? Lf + 1.2 : W + 1.2;
      for (let t = -lg / 2; t <= lg / 2 + 0.01; t += 0.5) for (const e of [0.1, o / 2, o + 0.15]) {
        if (!libre(...(cote ? [t, fixe * (W / 2 + e)] : [fixe * (Lf / 2 + e), t]))) return 0; } return o; };
    const o1 = deb(-1, true, 0.4), o2 = deb(1, true, 0.4), g1 = deb(-1, false, 0.3), g2 = deb(1, false, 0.3);
    const pente = Math.atan2(mont, W / 2);
    for (const [sg, o] of [[-1, o1], [1, o2]]) {
      const haut = P((g2 - g1) / 2, 0, c.avt + mont), bas = P((g2 - g1) / 2, sg * (W / 2 + o), c.avt - o * Math.tan(pente));
      const d = V().subVectors(bas, haut), l = d.length(); d.normalize();
      const nrm = s.clone().multiplyScalar(sg * Math.sin(pente)).add(V(0, Math.cos(pente), 0));
      L.toits.bloc(haut.clone().add(bas).multiplyScalar(0.5).addScaledVector(nrm, ep / 2), r.clone().multiplyScalar(Lf / 2 + (g1 + g2) / 2), d.multiplyScalar(l / 2), nrm.clone().multiplyScalar(ep / 2));
    }
    for (const sg of [-1, 1]) L.murs.face([P(sg * Lf / 2, -W / 2, c.avt), P(sg * Lf / 2, W / 2, c.avt), P(sg * Lf / 2, 0, c.avt + mont)], r.clone().multiplyScalar(sg));
    // l'empreinte du toit, et ses points hors des murs (pour le banc : chez le voisin ?)
    c.toit = [P(-Lf / 2 - g1, -W / 2 - o1, 0), P(Lf / 2 + g2, -W / 2 - o1, 0), P(Lf / 2 + g2, W / 2 + o2, 0), P(-Lf / 2 - g1, W / 2 + o2, 0)].map((p) => [p.x, p.z]);
    c.toitEchant = [];
    for (let a = -Lf / 2 - g1 + 0.05; a <= Lf / 2 + g2 - 0.05; a += 0.25) for (let b = -W / 2 - o1 + 0.05; b <= W / 2 + o2 - 0.05; b += 0.25)
      if (Math.abs(a) > Lf / 2 || Math.abs(b) > W / 2) { const p = P(a, b, 0); c.toitEchant.push([p.x, p.z]); }
    if (c.sp.clocher) clocherPeigne(L, c, r, s, Lf, W, mont);
  }
  for (const c of corps) if (c.sp.tour) crenaux(L, c);

  L.murs.maille(M.murs); L.toits.maille(M.toits); L.terre.maille(M.terre); L.herbe.maille(M.herbe, false);
  BILAN.batiments += maisons.length;
  for (const c of corps) BILAN.corps.push({ bat: c.i, rect: c.rect, toit: c.toit, toitEchant: c.toitEchant, plancher: c.plancher, cx: c.cx, cz: c.cz,
    pied: c.pied.filter(([x, z]) => !autreCorps(c, x, z)).map(([x, z]) => [x, z]), echant: densifier([...coins(c, [-0.3, -0.3, -0.3, -0.3]), coins(c, [-0.3, -0.3, -0.3, -0.3])[0]], 1) });
  // le sol des terre-pleins : on y marche à hauteur du plancher (jamais sous le terrain)
  const plat = plateformes.filter((p) => p.c.marge.some((v) => v > 0.4)), pAutour = grille(plat, (p) => { const xs = p.pts.map((q) => q[0]), zs = p.pts.map((q) => q[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; });
  return (x, z) => { let y = null; for (const i of pAutour(x, z)) if (dansPoly(x, z, plat[i].pts) && (y === null || plat[i].y > y)) y = plat[i].y; return y === null ? null : Math.max(y, hauteur(x, z)); };
}

// la tour : pas de toit, une plate-forme et son parapet crénelé (un merlon sur deux)
function crenaux(L, c) {
  const r = V(c.ux, 0, c.uz), s = V(-c.uz, 0, c.ux), Lr = c.a1 - c.a0, W = c.b1 - c.b0;
  for (const [ax, lg, bx] of [[0, Lr, -W / 2], [0, Lr, W / 2], [-Lr / 2, W, 0], [Lr / 2, W, 0]]) {
    const le = bx !== 0, n = Math.max(2, Math.round(lg / 1.1));
    for (let k = 0; k < n; k++) { const t = -lg / 2 + (k + 0.5) * lg / n, hh = k % 2 ? 0.9 : 1.7;
      const o = V(c.cx, c.avt + hh / 2, c.cz).addScaledVector(r, le ? t : ax).addScaledVector(s, le ? bx : t);
      L.murs.bloc(o, (le ? r : s).clone().multiplyScalar(lg / n / 2), V(0, hh / 2, 0), (le ? s : r).clone().multiplyScalar(0.3)); }
  }
}
// le clocher-peigne : un mur-pignon qui monte au-dessus du toit à l'ouest, percé de deux baies
// pour les cloches (trois piliers, un linteau)
function clocherPeigne(L, c, r, s, Lf, W, mont) {
  const o = V(c.cx, 0, c.cz).addScaledVector(r, -Lf / 2 + 0.45), h0 = c.avt, hb = c.avt + mont + 0.6, h1 = hb + 2.2;
  L.murs.bloc(o.clone().setY((h0 + hb) / 2), r.clone().multiplyScalar(0.45), V(0, (hb - h0) / 2, 0), s.clone().multiplyScalar(W * 0.42));   // le bas, plein
  for (const b of [-W * 0.34, 0, W * 0.34]) L.murs.bloc(o.clone().addScaledVector(s, b).setY((hb + h1) / 2), r.clone().multiplyScalar(0.45), V(0, (h1 - hb) / 2, 0), s.clone().multiplyScalar(W * 0.08));
  L.murs.bloc(o.clone().setY(h1 + 0.3), r.clone().multiplyScalar(0.5), V(0, 0.3, 0), s.clone().multiplyScalar(W * 0.46));   // le linteau
}

// Les arbres : posés ici et non par monde.js, qui les plante AVANT que le lieu ait bâti — ils
// tombaient dans les maisons et sur les rues
function arbres(ctx, { espece, n, h: [h0, h1], libre, bois }) {
  const esp = especeGeo(espece); if (!esp) return;
  const { CADRE, hauteur, scene } = ctx, ps = [];
  for (let k = 0; k < n * 14 && ps.length < n; k++) {
    const x = CADRE.x0 + Math.random() * (CADRE.x1 - CADRE.x0), z = CADRE.z0 + Math.random() * (CADRE.z1 - CADRE.z0);
    if ((bois(x, z) || Math.random() < 0.06) && libre(x, z) && ps.every(([a, b]) => Math.abs(a - x) > 4.5 || Math.abs(b - z) > 4.5)) ps.push([x, z]);
  }
  const tr = new THREE.InstancedMesh(esp.tronc, esp.matT, ps.length), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, ps.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(), v = V();
  ps.forEach(([x, z], k) => { const t = rand(h0, h1); q.setFromAxisAngle(HAUT, rand(0, TAU)); m4.compose(v.set(x, hauteur(x, z) - 0.2, z), q, sc.set(t * rand(0.85, 1.2), t, t * rand(0.85, 1.2))); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
  tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
}

// un mur continu le long d'une ligne (enceinte, murets) ; `ouvert(x, z)` y fait les brèches (les
// portes de l'enceinte, là où passe une rue). Chaque tronçon est inscrit dans les collisions.
function mur(ctx, pts, { haut, ep, mat, ouvert = () => false, bas = 1.5 }) {
  const { scene, inscrire } = ctx, h = ctx.dessin, pos = [], uv = [];
  const quad = (a, b, c, d, u0, u1, v0, v1) => { for (const [p, u, v] of [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]]) { pos.push(...p); uv.push(u, v); } };
  const P = densifier(pts, 2); let s = 0;
  for (let k = 1; k < P.length; k++) {
    const [ax, az] = P[k - 1], [bx, bz] = P[k], l = Math.hypot(bx - ax, bz - az); if (l < 0.01) continue;
    const s0 = s; s += l;
    if (ouvert((ax + bx) / 2, (az + bz) / 2) || ouvert(ax, az) || ouvert(bx, bz)) continue;
    const nx = -(bz - az) / l * ep / 2, nz = (bx - ax) / l * ep / 2;
    const ya = h(ax, az), yb = h(bx, bz), ta = ya + haut(s0), tb = yb + haut(s), ba = ya - bas, bb = yb - bas;
    for (const sg of [-1, 1]) {
      const A = [ax + nx * sg, ba, az + nz * sg], B = [bx + nx * sg, bb, bz + nz * sg], C = [bx + nx * sg, tb, bz + nz * sg], D = [ax + nx * sg, ta, az + nz * sg];
      sg > 0 ? quad(A, B, C, D, s0, s, ba, ta) : quad(B, A, D, C, s, s0, bb, tb);
    }
    quad([ax - nx, ta, az - nz], [bx - nx, tb, bz - nz], [bx + nx, tb, bz + nz], [ax + nx, ta, az + nz], s0, s, 0, ep);
    inscrire([[ax - nx, az - nz], [bx - nx, bz - nz], [bx + nx, bz + nz], [ax + nx, az + nz]], (ax + bx) / 2, (az + bz) / 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; scene.add(m);
}

// le poteau indicateur des vieux chemins : un piquet de châtaignier, une planchette fléchée
// par destination, le nom gravé et passé au blanc ; on lui parle pour partir
function poteau(ctx, ici) {
  const { hauteur, scene, addInteract } = ctx, [x, z] = ARRIVEES[ici].poteau, y = hauteur(x, z);
  const autres = Object.keys(ARRIVEES).filter((k) => k !== ici);
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const bois = phMat('wood_cabinet_worn_long', 0.3, 2.6, { color: 0x8a7660 });
  const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8), bois); pied.position.y = 1.3; g.add(pied);
  autres.forEach((k, i) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const t = c.getContext('2d');
    t.fillStyle = '#6e5a44'; t.fillRect(0, 0, 512, 96);
    t.fillStyle = 'rgba(245,240,228,0.92)'; t.font = 'bold 54px Georgia, serif'; t.textBaseline = 'middle'; t.fillText(ARRIVEES[k].titre, 34, 50);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const planche = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.24, 0.04), [bois, bois, bois, bois, phPeint('wood_planks', 1, 1, tex), phPeint('wood_planks', 1, 1, tex)]);
    // la flèche montre la direction du lieu, dans le repère commun
    const [tx, , tz] = ARRIVEES[k].pos, a = Math.atan2(-(tz - z), tx - x);
    const bras = new THREE.Group(); bras.position.y = 2.25 - i * 0.32; bras.rotation.y = a; planche.position.x = 0.55; bras.add(planche); g.add(bras);
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  addInteract({ pos: new THREE.Vector3(x, y, z), r: 3.5, prompt: () => 'prendre un vieux chemin',
    fn: () => showMenu('LES VIEUX CHEMINS', ARRIVEES[ici].titre, 'Des sentiers de troupeaux, plus vieux que les routes. On y marche longtemps, et le temps s’y emmêle.',
      [...autres.map((k) => ({ label: 'Vers ' + ARRIVEES[k].titre, fn: () => { hideMenu(); goToLevel(k, ARRIVEES[k].pos, ARRIVEES[k].yaw, RECIT[k]); } })),
        { label: 'Rester ici', fn: () => { hideMenu(); state.paused = false; } }]) });
}

// Le bord du lieu resserré (Villefort, 5 octobre) : au-delà du cadre, monde.js bloque Camille sans
// rien montrer. Là où une rue sort du cadre, elle bute sur un mur de clôture et son portail fermé
// (une cour, un jardin : le bourg continue derrière, on n'y entre pas) ; le long des bords `cotes`,
// une lisière de chênes serrés (la ripisylve de l'Altier au nord, le bois de la pente à l'ouest) cache
// le bout du relief fin. Seuls les bords donnés : les deux autres sont ceux d'avant le resserrement.
function lisiere(ctx, rs, { cotes, libre, emprise: E }) {
  const h = ctx.dessin, pierre = phMat('granit_lozere', 1, 1, { color: 0xa8a69e });
  const bois = phMat('wood_planks', 1, 1, { color: 0x6e5a44 }), portails = [], murs = [];
  const dehors = (x, z) => (cotes.includes('ouest') && x < E.x0 + 1.5) || (cotes.includes('nord') && z < E.z0 + 1.5)
    || (cotes.includes('est') && x > E.x1 - 1.5) || (cotes.includes('sud') && z > E.z1 - 1.5);
  // le débord, entre l'emprise et le bout du relief fin : bloqué comme un bâtiment (monde.js ne bloque
  // que hors de son cadre, qui est le relief fin rentré de 8 m)
  const { CADRE } = ctx, B = 200;
  if (cotes.includes('ouest')) ctx.inscrire([[CADRE.x0 - B, CADRE.z0 - B], [E.x0, CADRE.z0 - B], [E.x0, CADRE.z1 + B], [CADRE.x0 - B, CADRE.z1 + B]], E.x0 - 30, (E.z0 + E.z1) / 2);
  if (cotes.includes('nord')) ctx.inscrire([[CADRE.x0 - B, CADRE.z0 - B], [CADRE.x1 + B, CADRE.z0 - B], [CADRE.x1 + B, E.z0], [CADRE.x0 - B, E.z0]], (E.x0 + E.x1) / 2, E.z0 - 30);
  for (const c of rs) for (const pts of [c.pts, c.pts.slice().reverse()]) {
    const d = densifier(pts, 0.5); if (!dehors(...d[0])) continue;
    // le premier point franchement dedans, et la direction de la rue à cet endroit
    const k = d.findIndex(([x, z]) => !dehors(x, z)); if (k < 1 || k + 2 >= d.length) continue;
    const [x, z] = d[k], [xb, zb] = d[k + 2], l = Math.hypot(xb - x, zb - z) || 1, ux = (xb - x) / l, uz = (zb - z) / l;
    if (murs.some(([a, b]) => Math.hypot(a - x, b - z) < 5)) continue;      // un carrefour coupé : un seul mur
    const w = largeur(c) + 3.2; murs.push([x, z]);
    mur(ctx, [[x + uz * w / 2, z - ux * w / 2], [x - uz * w / 2, z + ux * w / 2]], { haut: () => 2.3, ep: 0.6, mat: pierre, bas: 0.8 });
    // le portail : un vantail de planches, côté bourg, 5 cm devant le mur
    const pw = Math.min(largeur(c), 4.2), y = h(x, z);
    const g = new THREE.BoxGeometry(pw, 2.0, 0.08); g.rotateY(Math.atan2(ux, uz));   // la largeur en travers de la rue
    g.translate(x + ux * 0.35, y + 1.0, z + uz * 0.35); portails.push(g);
  }
  if (portails.length) { const m = new THREE.Mesh(mergeGeometries(portails), bois); m.castShadow = m.receiveShadow = true; ctx.scene.add(m); }
  // la lisière : serrée sur tout le débord, et 10 m dans l'emprise (là, hors des rues et du bâti)
  const bande = (x, z) => (cotes.includes('ouest') && x < E.x0 + 10) || (cotes.includes('nord') && z < E.z0 + 10);
  const dedans = (x, z) => x > E.x0 && x < E.x1 && z > E.z0 && z < E.z1;
  arbres(ctx, { espece: 'chene', n: 900, h: [9, 15], bois: bande, libre: (x, z) => bande(x, z) && (!dedans(x, z) || libre(x, z)) && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 1) });
  BILAN.bouts = murs;
}

// Le bourg dense : au moins 6 bâtiments dans les neuf cases de 25 m autour du point. C'est là que le
// sol est pavé de mur à mur et que les ruelles sont dallées ; hors de lui, des chemins et des prés.
function densite(maisons) {
  const n = new Map();
  for (const b of maisons) { const cx = b.pts.reduce((s, p) => s + p[0], 0) / b.pts.length, cz = b.pts.reduce((s, p) => s + p[1], 0) / b.pts.length, k = Math.floor(cx / 25) + ',' + Math.floor(cz / 25); n.set(k, (n.get(k) || 0) + 1); }
  // la réponse ne dépend que de la case de 25 m : gardée en mémoire (le sol du bourg la demande
  // 140 000 fois)
  const memo = new Map();
  return (x, z) => { const i = Math.floor(x / 25), j = Math.floor(z / 25), k = i + ',' + j; let r = memo.get(k);
    if (r === undefined) { let s = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) s += n.get((i + a) + ',' + (j + b)) || 0; memo.set(k, r = s >= 6); }
    return r; };
}

// Le sol du bourg (réalisme, consigne V : « ce qu'on a sous les pieds d'abord »). Avant, de l'herbe
// jusqu'au pied des façades, au milieu du bourg. Maintenant, dans le bourg dense :
// - un enrobé de mur à mur, qui borde les rues de 3 m et le bâti de 3,5 m (pas dans les jardins
//   d'OSM ; à 2 m, des lanières d'herbe d'un mètre restaient entre deux rues). Son contour est découpé au pas de 1,25 m (marching squares, interpolé sur les arêtes) :
//   il suit une courbe, pas des marches de cases ;
// - des trottoirs de 14 cm et 1,6 m le long de la départementale (r ≥ 3 : la route de Mende et
//   l'avenue des Cévennes), avec la bordure de granit en face verticale, coupés aux carrefours. Les
//   vieilles rues n'en ont pas : à Villefort comme ailleurs, ce sont celles de la route.
// Rend la hauteur du trottoir en (x, z), ou null (pour solLieu : on y marche à 14 cm).
function solDuBourg(ctx, rs, { emprise: E, dense, jardins }) {
  const h = ctx.dessin, corps = BILAN.corps, P = 1.25;
  // la distance au bâti, jusqu'à 4 m
  const bC = corps.map((c) => { const xs = c.rect.map((p) => p[0]), zs = c.rect.map((p) => p[1]); return [Math.min(...xs) - 4, Math.min(...zs) - 4, Math.max(...xs) + 4, Math.max(...zs) + 4]; });
  const cAut = grille(corps, (_, i) => bC[i]);
  const fermes = corps.map((c) => [...c.rect, c.rect[0]]);
  const dBati = (x, z) => { let d = 4; for (const i of cAut(x, z)) { if (x < bC[i][0] || x > bC[i][2] || z < bC[i][1] || z > bC[i][3]) continue;
    if (dansPoly(x, z, corps[i].rect)) return 0; d = Math.min(d, distLigne(x, z, fermes[i])); } return d; };
  // la distance au bord des rues, jusqu'à 4 m
  const pr = rs.flatMap((c, id) => densifier(c.pts, 1).map(([x, z]) => [x, z, largeur(c) / 2, id]));
  const rAut = grille(pr, ([x, z, w]) => [x - w - 4, z - w - 4, x + w + 4, z + w + 4]);
  const dRue = (x, z, sauf = -1) => { let d = 4; for (const i of rAut(x, z)) { const [a, b, w, id] = pr[i]; if (id !== sauf) d = Math.min(d, Math.hypot(a - x, b - z) - w); } return d; };
  const jard = jardins.map((j) => { const xs = j.pts.map((p) => p[0]), zs = j.pts.map((p) => p[1]); return { pts: j.pts, b: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] }; });
  const auJardin = (x, z) => jard.some((j) => x > j.b[0] && x < j.b[2] && z > j.b[1] && z < j.b[3] && dansPoly(x, z, j.pts));
  // hors du bourg dense, un accotement de 1,6 m le long des rues : il ferme les lanières d'herbe
  // de moins de 3 m entre deux routes (au pont Saint-Jean)
  const val = (x, z) => auJardin(x, z) ? -1 : !dense(x, z) ? 1.6 - dRue(x, z) : Math.max(3.5 - dBati(x, z), 3 - dRue(x, z));

  // 1. l'enrobé : les valeurs aux nœuds, puis chaque case découpée sur val = 0
  const nx = Math.ceil((E.x1 - E.x0) / P) + 1, nz = Math.ceil((E.z1 - E.z0) / P) + 1, V2 = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) V2[j * nx + i] = val(E.x0 + i * P, E.z0 + j * P);
  const pos = [], uv = [];
  const sommet = (x, z) => { pos.push(x, h(x, z) + 0.012, z); uv.push(x, z); };
  for (let j = 0; j + 1 < nz; j++) for (let i = 0; i + 1 < nx; i++) {
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [E.x0 + a * P, E.z0 + b * P, V2[b * nx + a]]);
    if (c.every((q) => q[2] <= 0)) continue;
    const poly = [];
    for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4];
      if (a[2] > 0) poly.push([a[0], a[1]]);
      if ((a[2] > 0) !== (b[2] > 0)) { const t = a[2] / (a[2] - b[2]); poly.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
    // faces vers le ciel ; un triangle plat (deux points confondus au ras d'un coin) aurait une
    // normale nulle, d'où un NaN au shader : on le saute
    for (let k = 1; k + 1 < poly.length; k++) { const [a, b, c2] = [poly[0], poly[k + 1], poly[k]];
      if (Math.abs((b[0] - a[0]) * (c2[1] - a[1]) - (c2[0] - a[0]) * (b[1] - a[1])) < 1e-4) continue;
      for (const q of [a, b, c2]) sommet(...q); }
  }
  if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, phMat('asphalt_02', 1, 1, { color: 0xa8a49c, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.receiveShadow = true; ctx.scene.add(m); }

  // 2. les trottoirs de la départementale : un ruban de chaque côté, coupé là où une autre rue
  //    arrive (le carrefour) ou où le bâti avance sur lui ; la bordure, face verticale côté chaussée
  const tp = [], ti = [], tu = [], bp = [], bi = [], bu = [], zones = [], HT = 0.14, LT = 1.6;
  rs.forEach((c, id) => { if ((c.r || 0) < 3) return;
    const pts = densifier(c.pts, 1), w = largeur(c) / 2;
    for (const sg of [-1, 1]) {
      let run = [];
      const fin = () => { if (run.length >= 3) {
          const b0 = tp.length / 3, c0 = bp.length / 3;
          run.forEach(([x, z, nx2, nz2], k) => {
            const xi = x + nx2 * w, zi = z + nz2 * w, xo = x + nx2 * (w + LT), zo = z + nz2 * (w + LT), yi = h(xi, zi), yo = h(xo, zo);
            tp.push(xi, yi + HT, zi, xo, yo + HT, zo); tu.push(0, k, LT, k);
            bp.push(xi, yi + 0.015, zi, xi, yi + HT, zi); bu.push(k, 0, k, HT);
            if (k) { const a = b0 + (k - 1) * 2, e = c0 + (k - 1) * 2;
              ti.push(...(sg > 0 ? [a, a + 1, a + 2, a + 1, a + 3, a + 2] : [a, a + 2, a + 1, a + 1, a + 2, a + 3]));   // vers le ciel
              // la bordure : UNE face, tournée vers la chaussée. Ses deux faces sur les mêmes sommets
              // annulaient les normales (vecteur nul, NaN au shader) et le flou du post-traitement
              // noircissait tout l'écran
              bi.push(...(sg > 0 ? [e, e + 1, e + 2, e + 1, e + 3, e + 2] : [e, e + 2, e + 1, e + 1, e + 2, e + 3]));
              const [xa, za, na, ma] = run[k - 1];
              zones.push([[xa + na * w, za + ma * w], [x + nx2 * w, z + nz2 * w], [xo, zo], [xa + na * (w + LT), za + ma * (w + LT)]]); } });
        } run = []; };
      for (let k = 0; k < pts.length; k++) {
        const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)], l = Math.hypot(xb - xa, zb - za) || 1;
        const nx2 = -(zb - za) / l * sg, nz2 = (xb - xa) / l * sg, xm = x + nx2 * (w + LT / 2), zm = z + nz2 * (w + LT / 2);
        const ok = dense(xm, zm) && xm > E.x0 && xm < E.x1 && zm > E.z0 && zm < E.z1 && dBati(xm, zm) > 0.3 && dRue(xm, zm, id) > 0.5;
        if (ok) run.push([x, z, nx2, nz2]); else fin();
      }
      fin();
    }
  });
  const pierre = phMat('granite_tile_03', 1, 1, { color: 0xb4b0a8 });
  for (const [p, i, u, m] of [[tp, ti, tu, pierre], [bp, bi, bu, pierre]]) if (p.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.setIndex(i); g.computeVertexNormals();
    const o = new THREE.Mesh(g, m); o.receiveShadow = true; ctx.scene.add(o); }
  const zAut = grille(zones, (q) => { const xs = q.map((p) => p[0]), zs = q.map((p) => p[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; });
  BILAN.trottoirs = zones.length;
  return (x, z) => zAut(x, z).some((k) => dansPoly(x, z, zones[k])) ? h(x, z) + HT : null;
}

// Les gens du bourg (consigne V, « des lieux jouables ») : Villefort est « l'endroit où l'on parle aux
// gens » (SCENARIO § 14). Des gens de passage seulement, avec les rôles et villageois de pnj.js : ceux de
// l'enquête du chien (la boulangère, le chef de gare, les enfants près du lac) attendent Eugène. Ce
// qu'ils disent oriente (le poteau, la Régordane, le pont) ou raconte le lieu, et ne promet rien.
// [rôle ou n° de villageois, x, z, regarde vers [x, z], qui, répliques]
const GENS_VILLEFORT = [
  ['allumeur', 1578, -1136, [1584.5, -1129.5], 'Un vieux, sur la place', ['Ce poteau, c’est le départ des vieux chemins. Des sentiers de troupeaux, plus vieux que les routes.', 'La Garde-Guérin, c’est en haut, sur le plateau. Le Pouget aussi, c’est en haut. Ici, tout monte.']],
  ['aubergiste', 1559.8, -1095.9, [1575, -1102], 'Le cafetier de Chez Fernand', ['Chez Fernand, tout le bourg passe un jour ou l’autre.', 'La place du Bosquet, avec le poteau, c’est juste en bas de la rue.']],
  ['gardien', 1662, -968, [1683, -973], 'Le sacristain', ['Saint-Victorin. On l’a bâtie avec le granit de la vallée, comme tout le bourg.', 'La cloche sonne encore. Mais quelle heure elle sonne, je ne sais plus.']],
  [10, 1531, -1401, [1527.7, -1407], 'Une femme, au lavoir', ['L’eau de l’Altier est froide, même en plein été.', 'Le pont, là : c’est par lui qu’arrivait la Régordane, avec les mulets.']],
  ['pecheur', 1556, -1393, [1572, -1405], 'Le pêcheur', ['Des truites, dans l’Altier. Il faut savoir attendre.', 'Plus haut, il y a le lac du barrage. Avant, il n’y avait que la rivière.']],
  [1, 1606, -1040, [1614.7, -1033.1], 'L’hôtelière', ['L’hôtel Balme. Les voyageurs du train y dorment, et les marcheurs de la Régordane aussi.']],
  [4, 1668, -900, [1673, -890], 'Un homme, place de l’Ormeau', ['Le bourg est tout en long, entre la rivière et la pente. On ne peut pas s’y perdre.', 'La rue de la Bourgade, c’est l’ancienne Régordane. Elle traverse tout Villefort.']],
  [13, 1585, -1018, [1578, -1013], 'Un homme, place du Portalet', ['Les maisons sont en granit et les toits en lauzes. Ici, tout vient de la montagne.']],
];
const GENS = [];          // les passants posés, que la fiche anime à chaque image (anime)
let tAvant = 0;
function gensDuBourg(ctx, gens, sol) {
  const { hauteur, bloque, addInteract } = ctx;
  // un point libre au plus près de la place voulue (un rond de 30 m au plus)
  const placer = (x0, z0) => { for (let r = 0; r < 30; r += 1.5) for (let k = 0; k < 16; k++) { const x = x0 + Math.cos(k / 16 * TAU) * r, z = z0 + Math.sin(k / 16 * TAU) * r; if (!bloque(x, z, 0.9)) return [x, z]; } return null; };
  BILAN.gens = [];
  for (const [qui0, x0, z0, [lx, lz], qui, mots] of gens) {
    const p = placer(x0, z0); if (!p) continue; const [x, z] = p;
    const o = typeof qui0 === 'string' ? PNJ.buildRole(qui0) : PNJ.buildVillageois(qui0); if (!o) continue;
    const y = sol(x, z) ?? hauteur(x, z);
    o.scale.setScalar(G.echelle); o.position.set(x, y, z); o.rotation.y = Math.atan2(lx - x, lz - z); scene.add(o); GENS.push(o);
    // le pêcheur est un rôle ASSIS : sans rien sous lui, il s'asseyait dans le vide. Un banc de
    // granit de 48 cm sous l'assise (l'origine du rôle est à la hanche, pas aux pieds)
    if (qui0 === 'pecheur') { const bx = x, bz = z;
      const banc = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 0.5), phMat('granit_lozere', 1, 1, { color: 0xa8a69e }));
      banc.position.set(bx, y + 0.19, bz); banc.rotation.y = o.rotation.y; banc.castShadow = banc.receiveShadow = true; scene.add(banc); }
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 2.6, prompt: () => 'parler', fn: () => dialogue(mots.map((text) => ({ who: qui, text }))) });
    BILAN.gens.push({ qui, x: +x.toFixed(1), z: +z.toFixed(1), dit: mots[0] });
  }
}

// ---------------------------------------------------------------------
//  La lumière et la pierre des Cévennes, communes aux deux lieux
// ---------------------------------------------------------------------
const matieres = () => ({
  murs: phMat('granit_lozere', 1, 1, { color: 0xb8b6ae }), toits: phMat('lauze_lozere', 1, 1, { color: 0x8a8984 }),
  terre: phMat('granit_lozere', 1, 1, { color: 0xa09c92 }), herbe: phMat('grass_ground', 1, 1, { color: 0xa2ae7a }),
});
const COMMUN = {
  musique: 'campagne', loin: 'relief-lozere-monde.json',
  // un ciel de moyenne montagne, la brume bleue des crêtes au loin
  ciel: [0x3a6ab0, 0x9ac0e0, 0xd8e2e8], brume: [0xb8c8d8, 300, 3600], soleil: [120, 160, 60, 2.6],
  // monde.js ne bâtit rien ici (plans sans bâtiments) : ces deux clés ne servent qu'à sa recette
  murs: ['granit_lozere', 0xb8b6ae], toit: { style: 'deuxPans', slug: 'lauze_lozere', couleur: 0x8a8984, pente: 0.8 }, hMurs: [5, 7.5],
  chemin: ['gravier', 0xb8b4aa], arbres: null,
  loinSol: ['forest_leaves_02', 0x4a5a3c], carteFond: '#7a8a5a',
};
// la construction commune : le relief dessiné, les rues, le bâti, ses terre-pleins comme sol
function preparer(ctx, f, rueMat) {
  ctx.dessin = relief(ctx.hauteur, f.grille); BILAN.dessin = ctx.dessin;
  rues(ctx, rueMat);
  const rs = [...ctx.PLAN.routes, ...ctx.PLAN.chemins].filter((c) => dansCadre(ctx.CADRE, c.pts, 20));
  f._sol = batirMaisons(ctx, { maisons: ctx.PLAN.maisons, rues: rs, mats: matieres(), special: f.special });
  return rs;
}

const FICHES = {
  // ---------------------------------------------------------------- Villefort
  // Le bourg de pierre sombre au fond de la vallée de l'Altier (SCENARIO § 14 : « l'endroit où
  // l'on parle aux gens »), seul, du pont Saint-Jean au sud du bourg : 370 × 600 m où l'on marche
  // (PLAN-2026-10-04-CARTES.md, consigne 5, emprise validée par Eugène le 5 octobre). Avant, le lieu
  // allait jusqu'au barrage (1 160 × 2 130 m) ; la gare, à 640 m à l'ouest, et le lac, à 800 m au
  // nord, ne sont plus qu'à l'horizon. Plan et relief d'avant : carte/mondes/complet/.
  villefort: {
    ...COMMUN, name: 'villefort', titre: 'Villefort', plan: 'lozere-villefort.json', fin: 'relief-lozere-villefort.json', h0: 610,
    grille: { x0: 1360, z0: -1490, pas: 5 },
    // où l'on marche : le relief fin (carte/mondes/recoudre-relief-lozere.py) déborde de 60 m à l'ouest
    // et au nord, un débord boisé qu'on ne parcourt pas (lisiere) ; monde.js rentre de 8 m les deux autres bords
    emprise: { x0: 1428, x1: 1792, z0: -1422, z1: -828 },
    // les endroits qui comptent : la minicarte et les lieux découverts (monde.js)
    reperes: [
      { id: 'bosquet', nom: 'la place du Bosquet', x: 1576, z: -1140, r: 18, type: 'lieu' },
      { id: 'poteau', nom: 'le poteau des vieux chemins', x: 1584.5, z: -1129.5, r: 6, type: 'passage' },
      { id: 'portalet', nom: 'la place du Portalet', x: 1584, z: -1022, r: 14, type: 'lieu' },
      { id: 'eglise', nom: 'l’église Saint-Victorin', x: 1668, z: -968, r: 18, type: 'lieu' },
      { id: 'ormeau', nom: 'la place de l’Ormeau', x: 1673, z: -897, r: 14, type: 'lieu' },
      { id: 'pont', nom: 'le pont Saint-Jean et le lavoir', x: 1540, z: -1405, r: 18, type: 'lieu' },
      { id: 'fernand', nom: 'Chez Fernand', x: 1559.8, z: -1095.9, r: 6, type: 'pnj' },
      { id: 'balme', nom: 'l’hôtel Balme', x: 1606, z: -1040, r: 6, type: 'pnj' },
    ],
    sol: ['grass_ground', 0xa2ae7a],
    depart: { x: ARRIVEES.villefort.pos[0], z: ARRIVEES.villefort.pos[2], yaw: ARRIVEES.villefort.yaw },
    portes: [],
    counts: 'Villefort, le bourg de pierre au fond de la vallée, le long de l’Altier. Le poteau des vieux chemins, place du Bosquet, pour la Garde-Guérin et le Pouget.',
    start: 'Un bourg de pierre sombre, des toits de lauzes, et au nord, le lac.',
    entry: { title: 'Villefort', sub: 'La Cloche des Troupeaux — Lozère', cam: [1500, 170, -1560], at: [1610, 0, -1050], cam2: [1700, 40, -1300], at2: [1580, 0, -1120], dur: 6 },
    solLieu(x, z) { return FICHES.villefort._sol ? FICHES.villefort._sol(x, z) : null; },
    plus(ctx) {
      const { PLAN, CADRE, scene } = ctx;
      // les rues : l'enrobé pour la route et les rues (r ≥ 2) ; dans le bourg dense, les ruelles dallées
      // de granit ; dehors, les chemins de terre. Le « gravier » d'avant se lisait comme un ruban noir.
      const dense = densite(PLAN.maisons), milieu = (c) => c.pts[Math.floor(c.pts.length / 2)];
      const rs = preparer(ctx, FICHES.villefort, (c) => c.r >= 2 ? ['asphalt_02', 0x9a9894] : dense(...milieu(c)) ? ['granite_tile_03', 0xb4b8bc] : ['rocky_trail', 0xb8ab90]);
      const t0s = performance.now();
      const trottoir = solDuBourg(ctx, rs, { emprise: FICHES.villefort.emprise, dense, jardins: PLAN.verdure.jardins || [] });
      BILAN.msSol = Math.round(performance.now() - t0s);   // règle 8 : ≤ 300 ms
      const terrePlein = FICHES.villefort._sol;
      FICHES.villefort._sol = (x, z) => { const a = terrePlein(x, z), b = trottoir(x, z); return a === null ? b : b === null ? a : Math.max(a, b); };
      voieFerree(ctx);
      // les quais de la gare : une dalle surélevée
      for (const q of PLAN.fer.quais.filter((q) => dansCadre(CADRE, q.pts) && q.pts.length > 2)) {
        const y = Math.max(...q.pts.map(([x, z]) => ctx.dessin(x, z))) + 0.55, lot = new Lot();
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(q.pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 1.6, bevelEnabled: false });
        g.rotateX(-Math.PI / 2); g.translate(0, y - 1.6, 0);
        const p = g.attributes.position, uv = g.attributes.uv; for (let k = 0; k < p.count; k++) uv.setXY(k, p.getX(k) + p.getZ(k) * 0.3, p.getY(k) + p.getZ(k));
        const m = new THREE.Mesh(g, phMat('worn_tile_floor', 1, 1, { color: 0xb8b4ac })); m.receiveShadow = true; scene.add(m); void lot;
      }
      // le barrage : un mur-poids de béton sur son emprise d'OSM, de la vallée à la crête
      const beton = phMat('enduit_gris', 1, 1, { color: 0xc8c6be });
      for (const b of PLAN.eau.barrages.filter((b) => b.nom && dansCadre(CADRE, b.pts))) {
        const hs = b.pts.map(([x, z]) => ctx.hauteur(x, z)), top = Math.max(...hs) + 1.2, bas = Math.min(...hs) - 2;
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(b.pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: top - bas, bevelEnabled: false });
        g.rotateX(-Math.PI / 2); g.translate(0, bas, 0);
        const p = g.attributes.position, uv = g.attributes.uv; for (let k = 0; k < p.count; k++) uv.setXY(k, p.getX(k) + p.getZ(k), p.getY(k));
        const m = new THREE.Mesh(g, beton); m.castShadow = m.receiveShadow = true; scene.add(m);
      }
      const bois = (PLAN.verdure.bois || []).filter((b) => dansCadre(CADRE, b.pts)), lacs = (PLAN.eau.plans || []).filter((l) => l.pts.length > 2);
      arbres(ctx, { espece: 'chene', n: 500, h: [8, 13], bois: (x, z) => bois.some((b) => dansPoly(x, z, b.pts)),
        libre: (x, z) => !ctx.bloque(x, z, 3) && FICHES.villefort._sol(x, z) === null && !lacs.some((l) => dansPoly(x, z, l.pts)) && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 2.5) });
      // le cadre resserré à l'ouest et au nord ; l'est et le sud sont les bords d'avant
      lisiere(ctx, [...rs, ...PLAN.regordane.filter((c) => dansCadre(CADRE, c.pts, 20))], { cotes: ['ouest', 'nord'], emprise: FICHES.villefort.emprise,
        libre: (x, z) => !ctx.bloque(x, z, 2.5) && FICHES.villefort._sol(x, z) === null && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 1.5) });
      poteau(ctx, 'villefort');
      const t0 = performance.now(); gensDuBourg(ctx, GENS_VILLEFORT, FICHES.villefort._sol); BILAN.msGens = Math.round(performance.now() - t0);   // règle 8 : ≤ 300 ms
    },
    // les passants respirent et bougent un peu, à chaque image
    anime(now) {
      const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
      for (const g of GENS) if (g.userData.ctrl) PNJ.animeVillageois(g, dt, false);
    },
  },

  // ---------------------------------------------------------------- la Garde-Guérin
  // Le village-forteresse du plateau, qui gardait la Régordane : la tour carrée de 21 m, les
  // restes du château, l'église romane Saint-Michel, l'enceinte, le four banal. À l'est, les
  // gorges du Chassezac tombent de 150 m.
  gardeguerin: {
    ...COMMUN, name: 'gardeguerin', titre: 'La Garde-Guérin', plan: 'lozere-garde.json', fin: 'relief-lozere-garde.json', h0: 870,
    grille: { x0: 1528, z0: -5612, pas: 2 },
    sol: ['withered_grass', 0x9ea27a],
    depart: { x: ARRIVEES.gardeguerin.pos[0], z: ARRIVEES.gardeguerin.pos[2], yaw: ARRIVEES.gardeguerin.yaw },
    portes: [],
    counts: 'La Garde-Guérin, le village-forteresse de la Régordane. Le poteau des vieux chemins, à l’entrée, pour Villefort et le Pouget.',
    start: 'Une tour carrée sur le plateau, et le vent. Ici, on payait pour passer.',
    entry: { title: 'La Garde-Guérin', sub: 'La Cloche des Troupeaux — Lozère', cam: [2150, 120, -5000], at: [1815, 0, -5340], cam2: [1890, 30, -5200], at2: [1820, 5, -5350], dur: 6 },
    // la tour : pas de toit, un parapet crénelé ; le château : une courtine en ruine, à ciel
    // ouvert ; l'église : son clocher-peigne
    special(b) { return { tour: b.nom === 'Tour de La Garde-Guérin', ruine: b.nom === 'Château de la Garde-Guérin', clocher: b.nom === 'Église Saint-Michel' }; },
    solLieu(x, z) { return FICHES.gardeguerin._sol ? FICHES.gardeguerin._sol(x, z) : null; },
    plus(ctx) {
      const { PLAN, CADRE } = ctx, pierre = phMat('granit_lozere', 1, 1, { color: 0xb0aea6 });
      const rs = preparer(ctx, FICHES.gardeguerin, () => ['rocky_trail', 0xb8ab90]);
      // l'enceinte : des courtines ruinées, 4 à 7 m, ouvertes là où passe une rue ou un sentier
      // (les portes) ; les murs de clôture d'OSM, bas, ouverts de même
      const ouvert = (x, z) => rs.some((c) => distLigne(x, z, c.pts) < largeur(c) / 2 + 1.2);
      for (const e of PLAN.garde.enceinte) mur(ctx, e.pts, { haut: (s) => 5.2 + 1.4 * Math.sin(s * 0.11) + 0.6 * Math.sin(s * 0.53), ep: 1.4, mat: pierre, ouvert });
      for (const m of PLAN.murs.filter((m) => dansCadre(CADRE, m.pts))) mur(ctx, m.pts, { haut: () => 1.3, ep: 0.6, mat: pierre, bas: 0.6, ouvert });
      const bois = (PLAN.verdure.bois || []).filter((b) => dansCadre(CADRE, b.pts));
      arbres(ctx, { espece: 'pin', n: 450, h: [9, 15], bois: (x, z) => bois.some((b) => dansPoly(x, z, b.pts)),
        libre: (x, z) => !ctx.bloque(x, z, 3) && FICHES.gardeguerin._sol(x, z) === null && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 2.5) });
      poteau(ctx, 'gardeguerin');
    },
  },
};

// La voie Nîmes–Clermont : le ballast et deux files de rails, posés sur le relief dessiné ; les
// ponts tendus à plat d'une culée à l'autre, sur des piles ; les tunnels ne sont pas dessinés (la
// voie s'y enfonce dans la pente).
function voieFerree(ctx) {
  const { PLAN, CADRE, scene } = ctx, h = ctx.dessin, ballast = [], rails = [], piles = [];
  for (const v of PLAN.fer.voies.filter((v) => dansCadre(CADRE, v.pts, 20) && !v.tunnel && !v.abandonnee)) {
    const pts = densifier(v.pts, 1), pont = !!v.pont, L = pts.length - 1;
    const y0 = h(...pts[0]), y1 = h(...pts[L]);
    const H = pont ? (x, z, t) => y0 + (y1 - y0) * t + 0.4 : (x, z) => h(x, z) + 0.12;
    const bande = (w, off, dy) => { const P = [], I = [], uv = [];
      for (let k = 0; k <= L; k++) { const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(L, k + 1)]; let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const y = H(x, z, k / L) + dy; for (const c of [-1, 1]) { const o = off + c * w / 2; P.push(x - dz * o, y, z + dx * o); uv.push((c + 1) / 2 * w, k); }
        if (k) { const b = (k - 1) * 2; I.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(I); g.computeVertexNormals(); return g; };
    ballast.push(bande(3.2, 0, 0)); rails.push(bande(0.08, -0.72, 0.14), bande(0.08, 0.72, 0.14));
    if (pont) for (let k = 4; k < L; k += 10) { const [x, z] = pts[k], y = H(x, z, k / L), g = new THREE.BoxGeometry(2.2, y - h(x, z) + 2, 2.2); g.translate(x, (y + h(x, z) - 2) / 2, z); piles.push(g); }
  }
  if (ballast.length) { const m = new THREE.Mesh(mergeGeometries(ballast), phMat('gravier', 1, 1, { color: 0x8a8278, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.receiveShadow = true; scene.add(m); }
  if (rails.length) scene.add(new THREE.Mesh(mergeGeometries(rails), phMat('metal_plate_02', 1, 1, { color: 0x9a9894, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
  if (piles.length) { const m = new THREE.Mesh(mergeGeometries(piles), phMat('granit_lozere', 2, 2, { color: 0xb0aea6 })); m.castShadow = true; scene.add(m); }
}

// `?avant` dans l'adresse : le lieu tel que monde.js le bâtissait en masse depuis OSM (le plan
// entier, ses toits, ses rubans, ses arbres), pour que le banc mesure l'avant et l'après de la
// même façon (bancs/lieu-lozere.mjs)
export function lieu(nom) {
  const f = FICHES[nom];
  if (new URLSearchParams(location.search).has('avant'))
    return monde({ ...f, plan: 'lozere.json', solLieu: undefined, arbres: { espece: nom === 'villefort' ? 'chene' : 'pin', bois: 0.5, isoles: 0.02, h: [8, 14], max: 900 },
      plus(ctx) { ctx.dessin = relief(ctx.hauteur, f.grille); poteau(ctx, nom); } });
  return monde(f);
}
