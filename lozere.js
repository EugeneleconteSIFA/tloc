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
// propose les deux autres (comme le petit train des Pouilles). La porte de l'île est à Villefort
// (acte V, Eugène, 7 octobre), place du Bosquet ; celle du Pouget reste, pour en revenir.
// =====================================================================
import { monde } from './monde.js';
import { THREE, scene, rand, TAU, phMat, phPeint, PH, showMenu, hideMenu, goToLevel, state, dialogue, G, addCap, saveGame, showMessage, SFX, TOUCHES, AIDE, player, world, addBox, indexCapsules, PAGES, KINDS, setMaker, setAnimHook, spawnEnemy, renderer, sun, hemi } from './engine.js?v=41';
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
  // la laine bouclée, pour le plumage des poules (déjà inscrite par aveyron.js, mêmes valeurs)
  wool_boucle:     { tuile: 0.6, maps: ['couleur', 'normale', 'rugosite'], repli: 0xc8bca8 },
});

// ce que le lieu a bâti, pour le banc (bancs/lieu-lozere.mjs)
export const BILAN = { batiments: 0, corps: [], rubans: [] };

// ---------------------------------------------------------------------
//  Les vieux chemins : où l'on arrive dans chaque lieu
// ---------------------------------------------------------------------
// [x, y, z] et l'angle de Camille à l'arrivée ; le poteau est planté à côté. Le Pouget : l'arrivée
// de pouget.js (la route du nord-est, face au hameau) — c'est Eugène qui pose l'entrée de ce côté ;
// son poteau, sur le bas-côté (1,2 m, devant le muret), est planté par pouget.js (Eugène, 5 octobre : « assure-toi
// qu'un lien entre le Pouget, la Garde-Guérin et Villefort est possible »).
export const ARRIVEES = {
  villefort:   { titre: 'Villefort',         pos: [1582, 0, -1132], yaw: Math.atan2(100, 157), poteau: [1584.5, -1129.5] },
  gardeguerin: { titre: 'La Garde-Guérin',   pos: [1852, 0, -5236], yaw: Math.atan2(-15, -60), poteau: [1850.5, -5233.8] },
  // le lac de Villefort (consigne E4, Eugène, 7 octobre) : la route de la rive sud, face à la via ferrata
  lac:         { titre: 'Le lac',            pos: [130, 0, -2022],   yaw: -Math.PI / 2, poteau: [131.5, -2018.6] },
  pouget:      { titre: 'Le Pouget',         pos: [52.6, 0, -104],  yaw: Math.atan2(42 - 52.6, -54 + 104), poteau: [53.8, -103.75] },
};
const RECIT = {
  villefort: 'Le chemin descend vers le bourg, le long de l’Altier.',
  gardeguerin: 'La vieille route monte au plateau : la Régordane, celle des pèlerins et des muletiers.',
  pouget: 'Le chemin raide qui monte au hameau, à travers les châtaigniers.',
  lac: 'Le chemin descend vers le lac, sous le viaduc de l’Altier.',
};
// la page du lac : engine.js ne la connaît pas encore (demande pour la passe D3 : l'y écrire, pour qu'une
// partie sauvegardée au lac reprenne aussi depuis l'accueil)
PAGES.lac = 'lac.html';

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
  // `sansFond` : pas de face du côté −ez (celle qui est collée au mur, qu'on ne voit jamais : les
  // 3 800 fenêtres de Villefort en économisent 46 000 triangles)
  bloc(o, ex, ey, ez, sansFond = false) {
    const ax = [ex, ey, ez];
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      if (sansFond && k === 2 && s < 0) continue;
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
    // `fondu` (3e valeur de choix, Villefort seulement) : un chemin de terre qui n'est pas un ruban
    // net. Sa largeur ondule (±25 %) et il a, de chaque côté, une frange de 70 cm qui passe de
    // la terre à l'herbe (alpha de 1 à 0, aux sommets)
    const [slug, couleur, fondu] = choix(c), w = largeur(c), pts = densifier(c.pts, 1), y = 0.015 + 0.003 * etage[i];
    const pos = [], idx = [], uv = [], rgba = [], nc0 = Math.max(2, Math.ceil(w) + 1), nc = fondu ? nc0 + 2 : nc0; let s = 0;
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
      let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
      if (fondu) {
        const wk = w * (1 + 0.16 * Math.sin(s * 0.21 + i) + 0.09 * Math.sin(s * 0.63 + 1.7 * i));
        const off = [-(wk / 2 + 0.7), ...Array.from({ length: nc0 }, (_, q) => (q / (nc0 - 1) * 2 - 1) * wk / 2), wk / 2 + 0.7];
        off.forEach((o, q) => { const px = x - dz * o, pz = z + dx * o; pos.push(px, h(px, pz) + y, pz); uv.push(o + w, s); rgba.push(1, 1, 1, q === 0 || q === nc - 1 ? 0 : 1); });
      } else
      for (let q = 0; q < nc; q++) { const t = q / (nc - 1) * 2 - 1, px = x - dz * w / 2 * t, pz = z + dx * w / 2 * t; pos.push(px, h(px, pz) + y, pz); uv.push((t + 1) / 2 * w, s); }
      if (k) for (let q = 0; q + 1 < nc; q++) { const b = (k - 1) * nc + q, e = b + nc; idx.push(b, b + 1, e, b + 1, e + 1, e); }   // faces vers le ciel
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (fondu) g.setAttribute('color', new THREE.Float32BufferAttribute(rgba, 4));
    const xs = c.pts.map((p) => p[0]), zs = c.pts.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    BILAN.rubans.push({ geo: g, pts: c.pts, w, cx, cz, rayon: Math.hypot(Math.max(...xs) - cx, Math.max(...zs) - cz) + w });
    const cle = slug + couleur + !!fondu; if (!lots.has(cle)) lots.set(cle, { slug, couleur, fondu, gs: [] }); lots.get(cle).gs.push(g);
  });
  for (const { slug, couleur, fondu, gs } of lots.values()) {
    const m = new THREE.Mesh(mergeGeometries(gs), phMat(slug, 1, 1, { color: couleur, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      ...(fondu ? { vertexColors: true, transparent: true, depthWrite: false } : {}) }));
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
  // `enduits` : les maisons crépies (opts.enduit(b), Villefort seulement ; la Garde-Guérin n'en a pas)
  const L = { murs: new Lot(), enduits: new Lot(), toits: new Lot(), terre: new Lot(), herbe: new Lot() };
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
    (opts.enduit && opts.enduit(c.b, c.i) ? L.enduits : L.murs).bloc(V(cx, (bas + c.avt) / 2, cz), r.clone().multiplyScalar((c.a1 - c.a0) / 2), V(0, (c.avt - bas) / 2, 0), s.clone().multiplyScalar((c.b1 - c.b0) / 2));
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

  L.murs.maille(M.murs); if (M.enduits) L.enduits.maille(M.enduits); L.toits.maille(M.toits); L.terre.maille(M.terre); L.herbe.maille(M.herbe, false);
  BILAN.batiments += maisons.length;
  for (const c of corps) BILAN.corps.push({ bat: c.i, rect: c.rect, toit: c.toit, toitEchant: c.toitEchant, plancher: c.plancher, cx: c.cx, cz: c.cz, avt: c.avt, k: c.b.k, sp: c.sp, osm: c.b.pts,
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
// par destination, le nom gravé et passé au blanc ; on lui parle pour partir. Exporté : le Pouget
// (pouget.js) plante le même. ctx : { hauteur, scene, addInteract }
export function poteau(ctx, ici) {
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
      [...autres.map((k) => ({ label: 'Vers ' + ARRIVEES[k].titre, fn: () => { hideMenu();
        // l'acte V : sans le chien du berger, le chemin du Pouget se perd dans le brouillard de 1765
        if (k === 'pouget' && !EN_INSTANCE && !atteint5('chien')) { state.paused = false; showMessage('Le chemin monte dans un brouillard qui sent la châtaigne et la poudre. Un hurlement, au loin. Tu te retrouves au poteau sans savoir comment.', 6); return; }
        goToLevel(k, ARRIVEES[k].pos, ARRIVEES[k].yaw, k === 'pouget' && state.chienSuit && !state.chienRendu ? 'Le chien trotte devant toi dans le brouillard, et ne se trompe pas une fois…' : RECIT[k]); } })),
        { label: 'Rester ici', fn: () => { hideMenu(); state.paused = false; } }]) });
}

// Le bord du lieu resserré (Villefort, 5 octobre) : au-delà de l'emprise, rien n'arrête Camille ni le
// regard. Là où une rue sort du cadre, elle bute sur un mur de clôture et son portail fermé
// (une cour, un jardin : le bourg continue derrière, on n'y entre pas) ; le long des bords `cotes`,
// une lisière de chênes serrés (la ripisylve de l'Altier au nord, le bois de la pente à l'ouest) cache
// le bout du relief fin. Seuls les bords donnés (`cotes`).
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
  if (cotes.includes('est')) ctx.inscrire([[E.x1, CADRE.z0 - B], [CADRE.x1 + B, CADRE.z0 - B], [CADRE.x1 + B, CADRE.z1 + B], [E.x1, CADRE.z1 + B]], E.x1 + 30, (E.z0 + E.z1) / 2);
  if (cotes.includes('sud')) ctx.inscrire([[CADRE.x0 - B, E.z1], [CADRE.x1 + B, E.z1], [CADRE.x1 + B, CADRE.z1 + B], [CADRE.x0 - B, CADRE.z1 + B]], (E.x0 + E.x1) / 2, E.z1 + 30);
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
  const bande = (x, z) => (cotes.includes('ouest') && x < E.x0 + 10) || (cotes.includes('nord') && z < E.z0 + 10)
    || (cotes.includes('est') && x > E.x1 - 10) || (cotes.includes('sud') && z > E.z1 - 10);
  const dedans = (x, z) => x > E.x0 && x < E.x1 && z > E.z0 && z < E.z1;
  arbres(ctx, { espece: 'chene', n: 1500, h: [9, 15], bois: bande, libre: (x, z) => bande(x, z) && (!dedans(x, z) || libre(x, z)) && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 1) });
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
// Rend { trottoir(x, z) : la hauteur du trottoir ou null (solLieu : on y marche à 14 cm), pave(x, z) }.
function solDuBourg(ctx, rs, { emprise: E, dense, jardins }) {
  const h = ctx.dessin, corps = BILAN.corps, P = 1.25;
  // la distance au bâti, jusqu'à 4 m
  const bC = corps.map((c) => { const xs = c.rect.map((p) => p[0]), zs = c.rect.map((p) => p[1]); return [Math.min(...xs) - 4, Math.min(...zs) - 4, Math.max(...xs) + 4, Math.max(...zs) + 4]; });
  const cAut = grille(corps, (_, i) => bC[i]);
  const fermes = corps.map((c) => [...c.rect, c.rect[0]]);
  const dBati = (x, z) => { let d = 4; for (const i of cAut(x, z)) { if (x < bC[i][0] || x > bC[i][2] || z < bC[i][1] || z > bC[i][3]) continue;
    if (dansPoly(x, z, corps[i].rect)) return 0; d = Math.min(d, distLigne(x, z, fermes[i])); } return d; };
  // la distance au bord des rues, jusqu'à 4 m
  const pr = rs.flatMap((c, id) => densifier(c.pts, 1).map(([x, z]) => [x, z, largeur(c) / 2, id, c.r || 0]));
  const rAut = grille(pr, ([x, z, w]) => [x - w - 4, z - w - 4, x + w + 4, z + w + 4]);
  // rmin : les seules rues de cette importance (l'accotement ne borde pas les chemins de terre)
  const dRue = (x, z, sauf = -1, rmin = 0) => { let d = 4; for (const i of rAut(x, z)) { const [a, b, w, id, r] = pr[i]; if (id !== sauf && r >= rmin) d = Math.min(d, Math.hypot(a - x, b - z) - w); } return d; };
  const jard = jardins.map((j) => { const xs = j.pts.map((p) => p[0]), zs = j.pts.map((p) => p[1]); return { pts: j.pts, b: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] }; });
  const auJardin = (x, z) => jard.some((j) => x > j.b[0] && x < j.b[2] && z > j.b[1] && z < j.b[3] && dansPoly(x, z, j.pts));
  // hors du bourg dense, un accotement de 1,6 m le long des routes et des rues (pas des chemins de
  // terre) : il ferme les lanières d'herbe de moins de 3 m entre deux routes (au pont Saint-Jean)
  const val = (x, z) => auJardin(x, z) ? -1 : !dense(x, z) ? 1.6 - dRue(x, z, -1, 2) : Math.max(3.5 - dBati(x, z), 3 - dRue(x, z));

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
  return { trottoir: (x, z) => zAut(x, z).some((k) => dansPoly(x, z, zones[k])) ? h(x, z) + HT : null, pave: (x, z) => val(x, z) > 0 };
}

// Les façades de Villefort (réalisme, consigne V). Avant, des blocs de pierre aveugles. Maintenant,
// à chaque niveau (2,9 m), une fenêtre tous les 2,6 m environ :
// - le vitrage, sombre ;
// - un encadrement de granit clair (linteau, appui, piédroits), qui donne au mur son épaisseur ;
// - deux volets de planches peints, ouverts contre le mur (un sur cinq fermé), d'une couleur par
//   maison : gris-bleu, vert, brun, gris, les teintes qu'on voit aux Cévennes.
// Une porte au rez-de-chaussée du côté de la rue. Rien sur un mur mitoyen, ni là où le terrain monte
// plus haut que l'appui (le rez-de-chaussée enterré côté amont). Pas sur la tour, l'église, ni les
// remises. Tout est fondu par matière : sept maillages pour tout le bourg.
const VOLETS = [0x5e7480, 0x56705a, 0x6e5644, 0x9a9488];
function facades(ctx, rs) {
  const h = ctx.dessin, corps = BILAN.corps, U = (a, b, c) => V(a, b, c);
  const verre = new Lot(), cadre = new Lot(), portes = new Lot(), volets = VOLETS.map(() => new Lot());
  const bC = corps.map((c) => { const xs = c.rect.map((p) => p[0]), zs = c.rect.map((p) => p[1]); return [Math.min(...xs) - 1, Math.min(...zs) - 1, Math.max(...xs) + 1, Math.max(...zs) + 1]; });
  const cAut = grille(corps, (_, i) => bC[i]);
  const chezVoisin = (c, x, z) => cAut(x, z).some((j) => corps[j] !== c && dansPoly(x, z, corps[j].rect));
  const pr = rs.flatMap((c) => densifier(c.pts, 1).map(([x, z]) => [x, z, largeur(c) / 2]));
  const rAut = grille(pr, ([x, z, w]) => [x - w - 6, z - w - 6, x + w + 6, z + w + 6]);
  const dRue = (x, z) => { let d = 9; for (const i of rAut(x, z)) { const [a, b, w] = pr[i]; d = Math.min(d, Math.hypot(a - x, b - z) - w); } return d; };
  const hache = (i) => (Math.imul(i + 1, 2654435761) >>> 0);
  let fenetres = 0, nPortes = 0;
  corps.forEach((c, ci) => {
    if (c.sp.tour || c.sp.ruine || c.sp.clocher || ['shed', 'garage', 'garages', 'roof', 'church'].includes(c.k)) return;
    const niveaux = Math.max(1, Math.round((c.avt - c.plancher - 0.5) / 2.9)), teinte = hache(c.bat) % VOLETS.length;
    let porte = false;
    // les murs, celui qui donne sur la rue d'abord (il reçoit la porte)
    const murs = [0, 1, 2, 3].map((k) => { const kk = k, p = c.rect[k], q = c.rect[(k + 1) % 4], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L;
      let nx = -uz, nz = ux; const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; if ((mx - c.cx) * nx + (mz - c.cz) * nz < 0) { nx = -nx; nz = -nz; }
      return { k: kk, p, ux, uz, nx, nz, L, rue: dRue(mx + nx * 1.5, mz + nz * 1.5) }; }).sort((a, b) => a.rue - b.rue);
    if (c.vitrine != null) porte = true;          // une boutique : sa porte est dans la devanture (devantures)
    for (const m of murs) {
      if (m.L < 3) continue;
      const u = U(m.ux, 0, m.uz), n = U(m.nx, 0, m.nz), nc = Math.max(1, Math.floor((m.L - 0.8) / 2.6)), pas = m.L / nc;
      for (let k = 0; k < nc; k++) {
        const t = (k + 0.5) * pas, x = m.p[0] + m.ux * t, z = m.p[1] + m.uz * t;
        if (chezVoisin(c, x + m.nx * 0.6, z + m.nz * 0.6)) continue;
        const sol = h(x + m.nx * 0.5, z + m.nz * 0.5), o = (y, d) => U(x, y, z).addScaledVector(n, d);
        for (let s = 0; s < niveaux; s++) {
          const y0 = c.plancher + s * 2.9;
          if (s === 0 && m.k === c.vitrine) continue;
          if (s === 0 && !porte && m.rue < 4 && Math.abs(sol - c.plancher) < 0.6 && k === Math.floor(nc / 2)) {
            porte = true; nPortes++;
            portes.bloc(o(y0 + 1.05, 0.03), u.clone().multiplyScalar(0.5), U(0, 1.05, 0), n.clone().multiplyScalar(0.03), true);
            cadre.bloc(o(y0 + 2.2, 0.06), u.clone().multiplyScalar(0.68), U(0, 0.1, 0), n.clone().multiplyScalar(0.06), true);
            for (const sg of [-1, 1]) cadre.bloc(o(y0 + 1.05, 0.05).addScaledVector(u, sg * 0.58), u.clone().multiplyScalar(0.08), U(0, 1.05, 0), n.clone().multiplyScalar(0.05), true);
            continue;
          }
          const yb = y0 + 0.95, yt = yb + 1.3, W = 0.9;
          if (yt > c.avt - 0.3 || sol > yb - 0.3) continue;
          fenetres++;
          const a = U(x, yb, z).addScaledVector(n, 0.015);
          verre.face([a.clone().addScaledVector(u, -W / 2), a.clone().addScaledVector(u, W / 2), a.clone().addScaledVector(u, W / 2).setY(yt), a.clone().addScaledVector(u, -W / 2).setY(yt)], n);
          cadre.bloc(o(yt + 0.09, 0.05), u.clone().multiplyScalar(W / 2 + 0.15), U(0, 0.09, 0), n.clone().multiplyScalar(0.05), true);
          cadre.bloc(o(yb - 0.04, 0.07), u.clone().multiplyScalar(W / 2 + 0.1), U(0, 0.04, 0), n.clone().multiplyScalar(0.07), true);
          for (const sg of [-1, 1]) cadre.bloc(o((yb + yt) / 2, 0.04).addScaledVector(u, sg * (W / 2 + 0.06)), u.clone().multiplyScalar(0.06), U(0, 0.65, 0), n.clone().multiplyScalar(0.04), true);
          const ferme = hache(ci * 31 + k * 7 + s) % 5 === 0;
          for (const sg of [-1, 1]) volets[teinte].bloc(o((yb + yt) / 2, ferme ? 0.035 : 0.025).addScaledVector(u, sg * (ferme ? W / 4 : W / 2 + 0.12 + W / 4)),
            u.clone().multiplyScalar(W / 4 - 0.01), U(0, 0.64, 0), n.clone().multiplyScalar(0.018), true);
        }
      }
    }
  });
  verre.maille(new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.15, metalness: 0.4 }), false);
  cadre.maille(phMat('granite_tile_03', 1, 1, { color: 0xd0ccc4 }));
  portes.maille(phMat('wood_cabinet_worn_long', 1, 1, { color: 0x5a4434 }));
  volets.forEach((l, k) => l.maille(phMat('wood_planks', 1, 1, { color: VOLETS[k] }), false));
  BILAN.fenetres = fenetres; BILAN.portes = nPortes;
}

// Les boutiques de Villefort (Eugène, 5 octobre : « fais les vitrines de Chez Fernand et du Balme ; je
// veux un café, Le National »). Chacune est désignée par un point DANS son bâtiment d'OSM ; son mur le
// plus proche d'une rue reçoit la devanture au rez-de-chaussée, à la place des fenêtres et de la porte
// (facades le saute : `c.vitrine`). Le National est la maison qui regarde le poteau, de l'autre côté
// de la rue : c'est le café de la place, où l'on arrive.
const BOUTIQUES = [
  { id: 'national', dans: [1599.5, -1125.2], enseigne: 'CAFÉ LE NATIONAL', drapeau: 'CAFÉ', couleur: 0x2e4a3a, fond: '#2a4436', terrasse: true },
  { id: 'fernand', dans: [1568.4, -1100.2], enseigne: 'CHEZ FERNAND', sous: 'Restaurant', drapeau: 'Restaurant', couleur: 0x6a2a24, fond: '#5e2620' },
  // la boulangerie de l'acte V (le chien du berger y a volé un pain), dans la maison au sud de la place
  { id: 'boulangerie', dans: [1579.3, -1080.3], enseigne: 'BOULANGERIE', sous: 'Pain – Fougasse', drapeau: 'PAIN', couleur: 0x8a5a2a, fond: '#7a4e24' },
  { id: 'balme', dans: [1615.1, -1033.4], enseigne: 'HÔTEL BALME', sous: 'Hôtel – Restaurant', drapeau: 'HÔTEL', couleur: 0x30405a, fond: '#2c3a52' },
];
// le mur de devanture de chaque boutique (à appeler avant facades)
function choisirBoutiques(rs) {
  const pr = rs.filter((c) => (c.r || 0) >= 1).flatMap((c) => densifier(c.pts, 1).map(([x, z]) => [x, z, largeur(c) / 2]));
  const dRue = (x, z) => pr.reduce((d, [a, b, w]) => Math.min(d, Math.hypot(a - x, b - z) - w), 99);
  const out = [];
  for (const B of BOUTIQUES) {
    let mieux = null;
    for (const c of BILAN.corps) {
      if (!c.osm || !dansPoly(B.dans[0], B.dans[1], c.osm)) continue;
      for (let k = 0; k < 4; k++) {
        const p = c.rect[k], q = c.rect[(k + 1) % 4], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 4.5) continue;
        const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L; let nx = -uz, nz = ux; const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
        if ((mx - c.cx) * nx + (mz - c.cz) * nz < 0) { nx = -nx; nz = -nz; }
        const d = dRue(mx + nx * 1.5, mz + nz * 1.5);
        if (!mieux || d < mieux.d) mieux = { c, k, d, p, L, u: V(ux, 0, uz), n: V(nx, 0, nz) };
      }
    }
    if (mieux) { mieux.c.vitrine = mieux.k; out.push({ ...B, ...mieux }); }
  }
  return out;
}
// un panneau peint : le nom en capitales claires sur le fond de la devanture
function peinture(texte, sous, fond, l, h) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.max(96, Math.round(1024 * h / l)); const t = c.getContext('2d');
  t.fillStyle = fond; t.fillRect(0, 0, c.width, c.height);
  t.strokeStyle = 'rgba(230,210,150,0.8)'; t.lineWidth = 6; t.strokeRect(10, 10, c.width - 20, c.height - 20);
  t.fillStyle = '#efe2bc'; t.textAlign = 'center'; t.textBaseline = 'middle';
  const H = c.height, taille = Math.min(H * (sous ? 0.5 : 0.62), 1024 / Math.max(6, texte.length) * 1.5);
  t.font = `bold ${Math.round(taille)}px Georgia, serif`; t.fillText(texte, 512, sous ? H * 0.42 : H * 0.53);
  if (sous) { t.font = `italic ${Math.round(H * 0.24)}px Georgia, serif`; t.fillText(sous, 512, H * 0.78); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
// la salle vue à travers la vitrine : un fond chaud qui s'éclaircit vers le bas, des lampes, le
// comptoir et des dossiers de chaises en ombre. Peinte une fois par boutique, étirée sur toute la baie
function salle(fond, l, h) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(128, Math.round(512 * h / l)); const t = c.getContext('2d'), W = c.width, H = c.height;
  const g = t.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a120c'); g.addColorStop(0.55, '#5a3a1e'); g.addColorStop(1, '#2a1c10'); t.fillStyle = g; t.fillRect(0, 0, W, H);
  for (let k = 0; k < 4; k++) { const x = W * (k + 0.5) / 4, r = t.createRadialGradient(x, H * 0.18, 2, x, H * 0.18, H * 0.35);
    r.addColorStop(0, 'rgba(255,214,150,0.9)'); r.addColorStop(1, 'rgba(255,190,120,0)'); t.fillStyle = r; t.fillRect(0, 0, W, H); }
  t.fillStyle = 'rgba(20,12,6,0.85)'; t.fillRect(W * 0.08, H * 0.6, W * 0.5, H * 0.4);                        // le comptoir
  t.fillStyle = fond; t.fillRect(W * 0.08, H * 0.6, W * 0.5, H * 0.04);
  for (let k = 0; k < 5; k++) { const x = W * (0.62 + k * 0.08); t.fillStyle = 'rgba(15,10,6,0.9)'; t.fillRect(x, H * 0.62, W * 0.012, H * 0.38); t.fillRect(x, H * 0.62, W * 0.05, H * 0.015); }
  t.fillStyle = 'rgba(255,255,255,0.06)'; t.beginPath(); t.moveTo(W * 0.15, 0); t.lineTo(W * 0.35, 0); t.lineTo(W * 0.1, H); t.lineTo(0, H); t.fill();   // un reflet
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
// un panneau orienté : sa face avant (+z de la boîte) regarde `face`. Sa largeur suit haut × face,
// qui va de gauche à droite pour qui le regarde ; une base (x, y, z) qui ne serait pas directe le
// retourne en miroir (le bandeau sortait du mur en biais)
function panneau(ctx, centre, face, l, h, ep, bois, avant) {
  const g = new THREE.BoxGeometry(l, h, ep), m = new THREE.Mesh(g, [bois, bois, bois, bois, avant, avant]);
  const long = V().crossVectors(HAUT, face).normalize();
  m.position.copy(centre); m.setRotationFromMatrix(new THREE.Matrix4().makeBasis(long, HAUT, face)); m.castShadow = true; ctx.scene.add(m);
}
// La devanture : deux pilastres et une allège de bois peint, des vitrines en trois ou quatre baies
// et la porte vitrée au bout, le bandeau peint du nom, et une enseigne en drapeau à l'étage. Le
// verre luit un peu chaud (un intérieur éclairé), sans lumière nouvelle. Au National, une terrasse
// (trois guéridons, six chaises) sous un store de toile.
function devantures(ctx, boutiques, rs) {
  const h = ctx.dessin, fer = new Lot(), marbre = new Lot(), toile = new Lot(), peints = new Map();
  const pr = rs.flatMap((c) => densifier(c.pts, 1).map(([x, z]) => [x, z, largeur(c) / 2]));
  const surRue = (x, z) => pr.some(([a, b, w]) => Math.hypot(a - x, b - z) < w + 0.4);
  const bilan = [];
  for (const B of boutiques) {
    const { c, p, L, u, n } = B, y0 = c.plancher, W = Math.min(L - 0.8, 9), centre = V(p[0], 0, p[1]).addScaledVector(u, L / 2);
    const bois = phMat('wood_planks', 1, 1, { color: B.couleur }); if (!peints.has(B.id)) peints.set(B.id, new Lot());
    const P = peints.get(B.id), o = (t, y, d) => centre.clone().addScaledVector(u, t).setY(y).addScaledVector(n, d);
    const haut = Math.min(3.2, c.avt - y0 - 0.3), porte = 1.1, gauche = -W / 2 + 0.3, droite = W / 2 - 0.3, finVitrine = droite - porte;
    // les pilastres, l'allège, la traverse haute, les montants
    for (const sg of [-1, 1]) P.bloc(o(sg * (W / 2 - 0.15), y0 + haut / 2, 0.08), u.clone().multiplyScalar(0.15), V(0, haut / 2, 0), n.clone().multiplyScalar(0.08), true);
    P.bloc(o((gauche + finVitrine) / 2, y0 + 0.3, 0.05), u.clone().multiplyScalar((finVitrine - gauche) / 2), V(0, 0.3, 0), n.clone().multiplyScalar(0.05), true);
    P.bloc(o(0, y0 + 2.65, 0.06), u.clone().multiplyScalar(W / 2 - 0.3), V(0, 0.05, 0), n.clone().multiplyScalar(0.06), true);
    const baies = Math.max(2, Math.round((finVitrine - gauche) / 1.5));
    for (let k = 0; k <= baies; k++) { const t = gauche + (finVitrine - gauche) * k / baies; P.bloc(o(t, y0 + 1.6, 0.06), u.clone().multiplyScalar(0.05), V(0, 1.0, 0), n.clone().multiplyScalar(0.06), true); }
    P.bloc(o(droite, y0 + 1.3, 0.06), u.clone().multiplyScalar(0.05), V(0, 1.3, 0), n.clone().multiplyScalar(0.06), true);
    // le verre : la vitrine (allège à 60 cm) et la porte (jusqu'au seuil), la salle peinte derrière ;
    // UV de 0 à 1 sur toute la baie (pas en mètres) : la salle n'est pas répétée tous les mètres
    const tex = salle(B.fond, W, 2.6), verreB = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.06, metalness: 0.3 });
    const pv = [], uvv = [], q = (t0, t1, ya, yb) => { const a = o(t0, ya, 0.03), b = o(t1, ya, 0.03), c2 = b.clone().setY(yb), d = a.clone().setY(yb);
      const U2 = (t) => (t - gauche) / (droite - gauche), V2 = (y) => (y - y0) / 2.6;
      for (const [P2, uu, vv] of [[a, U2(t0), V2(ya)], [b, U2(t1), V2(ya)], [c2, U2(t1), V2(yb)], [a, U2(t0), V2(ya)], [c2, U2(t1), V2(yb)], [d, U2(t0), V2(yb)]]) { pv.push(P2.x, P2.y, P2.z); uvv.push(uu, vv); } };
    q(gauche, finVitrine, y0 + 0.6, y0 + 2.6); q(finVitrine, droite, y0 + 0.05, y0 + 2.6);
    { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvv, 2)); g.computeVertexNormals();
      // le sens des triangles : vers la rue (n) ; sinon on les retourne
      const nn = V(g.attributes.normal.getX(0), 0, g.attributes.normal.getZ(0)); if (nn.dot(n) < 0) { g.index = null; const a = g.attributes.position.array, w = g.attributes.uv.array;
        for (let k = 0; k < a.length; k += 9) for (let j = 0; j < 3; j++) { [a[k + 3 + j], a[k + 6 + j]] = [a[k + 6 + j], a[k + 3 + j]]; }
        for (let k = 0; k < w.length; k += 6) for (let j = 0; j < 2; j++) { [w[k + 2 + j], w[k + 4 + j]] = [w[k + 4 + j], w[k + 2 + j]]; } g.computeVertexNormals(); }
      ctx.scene.add(new THREE.Mesh(g, verreB)); }
    fer.bloc(o(finVitrine + 0.15, y0 + 1.1, 0.09), u.clone().multiplyScalar(0.015), V(0, 0.12, 0), n.clone().multiplyScalar(0.03));   // la poignée
    // le bandeau du nom, et l'enseigne en drapeau à l'étage
    panneau(ctx, o(0, y0 + Math.min(haut + 0.35, c.avt - y0 - 0.2), 0.1), n, W, 0.62, 0.12, bois, phPeint('wood_planks', 1, 1, peinture(B.enseigne, B.sous, B.fond, W, 0.62)));
    if (c.avt - y0 > 5) {
      const pd = o(-W / 2 + 0.5, y0 + 4.1, 0.75);
      panneau(ctx, pd, u, 0.95, 0.55, 0.05, bois, phPeint('wood_planks', 1, 1, peinture(B.drapeau, null, B.fond, 0.95, 0.55)));
      fer.bloc(o(-W / 2 + 0.5, y0 + 4.42, 0.4), u.clone().multiplyScalar(0.02), V(0, 0.02, 0), n.clone().multiplyScalar(0.4), true);
    }
    const b = { id: B.id, x: +centre.x.toFixed(1), z: +centre.z.toFixed(1), nx: +n.x.toFixed(2), nz: +n.z.toFixed(2), mur: +L.toFixed(1), guerdons: 0 };
    // la terrasse du National : le store, puis les guéridons là où il y a la place (pas sur la rue)
    if (B.terrasse) {
      const dir = n.clone().multiplyScalar(2.2).add(V(0, -0.6, 0)), lg = dir.length(); dir.normalize();
      const nt = V().crossVectors(u, dir).normalize(), ct = centre.clone().setY(y0 + haut + 0.05).addScaledVector(dir, lg / 2);
      toile.bloc(ct, u.clone().multiplyScalar(W / 2 - 0.2), dir.clone().multiplyScalar(lg / 2), nt.multiplyScalar(0.015));
      for (const t of [-W / 3, 0, W / 3]) {
        const g = o(t, 0, 2.3); if (surRue(g.x, g.z) || Math.hypot(g.x - 1584.5, g.z + 1129.5) < 2.5) continue;
        const yg = h(g.x, g.z); b.guerdons++;
        marbre.bloc(g.clone().setY(yg + 0.74), V(0.32, 0, 0), V(0, 0.02, 0), V(0, 0, 0.32));
        fer.bloc(g.clone().setY(yg + 0.37), V(0.025, 0, 0), V(0, 0.36, 0), V(0, 0, 0.025));
        for (const sg of [-1, 1]) { const ch = g.clone().addScaledVector(u, sg * 0.62), yc = h(ch.x, ch.z);
          fer.bloc(ch.clone().setY(yc + 0.46), u.clone().multiplyScalar(0.2), V(0, 0.02, 0), n.clone().multiplyScalar(0.2));
          fer.bloc(ch.clone().addScaledVector(u, sg * 0.19).setY(yc + 0.7), u.clone().multiplyScalar(0.015), V(0, 0.22, 0), n.clone().multiplyScalar(0.19));
          for (const [a, d] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) fer.bloc(ch.clone().addScaledVector(u, a * 0.17).addScaledVector(n, d * 0.17).setY(yc + 0.22), V(0.012, 0, 0), V(0, 0.22, 0), V(0, 0, 0.012)); }
        ctx.inscrire([[g.x - 0.4, g.z - 0.4], [g.x + 0.4, g.z - 0.4], [g.x + 0.4, g.z + 0.4], [g.x - 0.4, g.z + 0.4]], g.x, g.z);
      }
    }
    bilan.push(b);
  }
  fer.maille(phMat('metal_plate_02', 1, 1, { color: 0x283028 }), false);
  marbre.maille(phMat('marble_rock_02', 1, 1, { color: 0xe8e4dc }), false);
  toile.maille(phMat('fabric_pattern_07', 1, 1, { color: 0x8a2c26, side: THREE.DoubleSide }));
  for (const [id, l] of peints) l.maille(phMat('wood_planks', 1, 1, { color: BOUTIQUES.find((B) => B.id === id).couleur }));
  BILAN.boutiques = bilan;
}

// Des arbres posés un par un (InstancedMesh), à des places choisies
function planter(ctx, espece, ps, [h0, h1]) {
  const esp = especeGeo(espece); if (!esp || !ps.length) return;
  const tr = new THREE.InstancedMesh(esp.tronc, esp.matT, ps.length), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, ps.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(), v = V();
  ps.forEach(([x, z], k) => { const t = rand(h0, h1); q.setFromAxisAngle(HAUT, rand(0, TAU)); m4.compose(v.set(x, ctx.hauteur(x, z) - 0.2, z), q, sc.set(t, t, t)); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
  tr.castShadow = hp.castShadow = true; ctx.scene.add(tr, hp);
}

// Le mobilier et les arbres du bourg (réalisme, consigne V, « puis le reste ») :
// - le bosquet de la place du Bosquet : des charmes sur l'herbe de la place, tous les 7 m environ
//   (la place porte le nom de son bosquet) ;
// - l'ormeau de la place de l'Ormeau, un grand arbre seul (un chêne : la forêt du jeu n'a pas d'orme) ;
// - des bancs de granit et de planches sur les places, tournés vers elles ;
// - des lanternes de fer sur une maison sur trois, côté rue, à hauteur d'étage. Pas de lumière
//   nouvelle (règle de la consigne de nuit) : le verre luit à peine, de jour.
function mobilier(ctx, rs, { pave, dense }) {
  const { bloque } = ctx, h = ctx.dessin;
  const loinDesRues = (x, z, m) => rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + m);
  // le bosquet
  const bosquet = [];
  for (let x = 1545; x <= 1605; x += 7) for (let z = -1240; z <= -1115; z += 7) {
    const px = x + rand(-1.5, 1.5), pz = z + rand(-1.5, 1.5);
    if (dense(px, pz) && !pave(px, pz) && !bloque(px, pz, 2.5) && loinDesRues(px, pz, 2)) bosquet.push([px, pz]);
  }
  planter(ctx, 'charme', bosquet, [7, 9.5]);
  // l'ormeau
  const libre = (x0, z0, m) => { for (let r = 0; r < 20; r += 1) for (let k = 0; k < 12; k++) { const x = x0 + Math.cos(k / 12 * TAU) * r, z = z0 + Math.sin(k / 12 * TAU) * r; if (!bloque(x, z, m) && loinDesRues(x, z, 1)) return [x, z]; } return null; };
  const orme = libre(1673, -897, 3); if (orme) planter(ctx, 'chene', [orme], [15, 16]);
  // les bancs : [x, z, regarde vers x, z]
  const granit = new Lot(), planches = new Lot(), bancs = [];
  for (const [x0, z0, lx, lz] of [[1566, -1150, 1575, -1175], [1586, -1172, 1575, -1180], [1567, -1196, 1575, -1180], [1590, -1028, 1584, -1020], [1660, -960, 1670, -968], ...(orme ? [[orme[0] + 3.2, orme[1], orme[0], orme[1]]] : [])]) {
    const p = libre(x0, z0, 1.2); if (!p) continue; const [x, z] = p;
    poserBanc(granit, planches, x, h(x, z), z, Math.atan2(lx - x, lz - z));
    bancs.push([+x.toFixed(1), +z.toFixed(1)]);
  }
  granit.maille(phMat('granite_tile_03', 1, 1, { color: 0xb4b0a8 }));
  planches.maille(phMat('wood_planks', 1, 1, { color: 0x7a6248 }));
  // les lanternes : une maison sur trois qui donne sur une rue, au premier quart de son mur côté rue
  const fer = new Lot(), verre = new Lot(); let lanternes = 0;
  const pr = rs.filter((c) => (c.r || 0) >= 1).flatMap((c) => densifier(c.pts, 2).map(([x, z]) => [x, z, largeur(c) / 2]));
  const rAut = grille(pr, ([x, z, w]) => [x - w - 4, z - w - 4, x + w + 4, z + w + 4]);
  const dRue = (x, z) => { let d = 9; for (const i of rAut(x, z)) { const [a, b, w] = pr[i]; d = Math.min(d, Math.hypot(a - x, b - z) - w); } return d; };
  for (const c of BILAN.corps) {
    if ((Math.imul(c.bat + 3, 2654435761) >>> 0) % 3 || c.sp.tour || c.sp.clocher || c.avt - c.plancher < 5 || !dense(c.cx, c.cz)) continue;
    for (let k = 0; k < 4; k++) {
      const p = c.rect[k], q = c.rect[(k + 1) % 4], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 4) continue;
      const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L; let nx = -uz, nz = ux; const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      if ((mx - c.cx) * nx + (mz - c.cz) * nz < 0) { nx = -nx; nz = -nz; }
      if (dRue(mx + nx * 1.5, mz + nz * 1.5) > 3) continue;
      const x = p[0] + ux * L * 0.25, z = p[1] + uz * L * 0.25, y = c.plancher + 3.1, n = V(nx, 0, nz), u = V(ux, 0, uz);
      fer.bloc(V(x, y + 0.2, z).addScaledVector(n, 0.2), u.clone().multiplyScalar(0.025), V(0, 0.025, 0), n.clone().multiplyScalar(0.2), true);   // la potence
      fer.bloc(V(x, y + 0.24, z).addScaledVector(n, 0.42), u.clone().multiplyScalar(0.12), V(0, 0.03, 0), n.clone().multiplyScalar(0.12));        // le chapeau
      verre.bloc(V(x, y + 0.04, z).addScaledVector(n, 0.42), u.clone().multiplyScalar(0.09), V(0, 0.17, 0), n.clone().multiplyScalar(0.09));
      lanternes++; break;
    }
  }
  fer.maille(phMat('metal_plate_02', 1, 1, { color: 0x2a2826 }), false);
  verre.maille(new THREE.MeshStandardMaterial({ color: 0xf0e2c0, emissive: 0xffd9a0, emissiveIntensity: 0.35, roughness: 0.3 }), false);
  Object.assign(BILAN, { bosquet: bosquet.length, ormeau: !!orme, bancs, lanternes });
}

// Les gens du bourg (consigne V, « des lieux jouables ») : Villefort est « l'endroit où l'on parle aux
// gens » (SCENARIO § 14). Des gens de passage seulement, avec les rôles et villageois de pnj.js : ceux de
// l'enquête du chien (la boulangère, le chef de gare, les enfants près du lac) attendent Eugène. Ce
// qu'ils disent oriente (le poteau, la Régordane, le pont) ou raconte le lieu, et ne promet rien.
// [rôle ou n° de villageois, x, z, regarde vers [x, z], qui, répliques]
const GENS_VILLEFORT = [
  ['allumeur', 1578, -1136, [1584.5, -1129.5], 'Un vieux, sur la place', ['Ce poteau, c’est le départ des vieux chemins. Des sentiers de troupeaux, plus vieux que les routes.', 'La Garde-Guérin, c’est en haut, sur le plateau. Le Pouget aussi, c’est en haut. Ici, tout monte.']],
  ['aubergiste', 1591, -1127, [1584.5, -1129.5], 'Le cafetier du National', ['Le National, c’est le café de la place. Tout le bourg y passe un jour ou l’autre.', 'Le poteau des vieux chemins, c’est là, devant la terrasse.']],
  [1, 1559.8, -1095.9, [1575, -1102], 'Le patron de Chez Fernand', ['Chez Fernand, on sert à manger midi et soir.', 'Le café, c’est au National, sur la place.']],
  ['cosimo', 1458, -1272, [1480, -1268], 'Le chef de gare', ['La gare, c’est au bout de l’avenue, en bas, à l’ouest du bourg.', 'Les trains ne passent plus à l’heure. Alors je monte au bourg, et je les attends ici.']],
  ['gardien', 1662, -968, [1683, -973], 'Le sacristain', ['Saint-Victorin. On l’a bâtie avec le granit de la vallée, comme tout le bourg.', 'La cloche sonne encore. Mais quelle heure elle sonne, je ne sais plus.']],
  [2, 1531, -1401, [1527.7, -1407], 'Une femme, au lavoir', ['L’eau de l’Altier est froide, même en plein été.', 'Le pont, là : c’est par lui qu’arrivait la Régordane, avec les mulets.']],
  ['pecheur', 1556, -1393, [1572, -1405], 'Le pêcheur', ['Des truites, dans l’Altier. Il faut savoir attendre.', 'Plus haut, il y a le lac du barrage. Avant, il n’y avait que la rivière.']],
  [0, 1606, -1040, [1614.7, -1033.1], 'L’hôtelière', ['L’hôtel Balme. Les voyageurs du train y dorment, et les marcheurs de la Régordane aussi.']],
  [3, 1668, -900, [1673, -890], 'Un homme, place de l’Ormeau', ['Le bourg est tout en long, entre la rivière et la pente. On ne peut pas s’y perdre.', 'La rue de la Bourgade, c’est l’ancienne Régordane. Elle traverse tout Villefort.']],
  [5, 1585, -1018, [1578, -1013], 'Un homme, place du Portalet', ['Les maisons sont en granit et les toits en lauzes. Ici, tout vient de la montagne.']],
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
    // (le vieux de la place et le chef de gare ont une réplique de l'acte V : parleActe5)
    const acte = { 'Un vieux, sur la place': 'vieux', 'Le chef de gare': 'chefgare' }[qui];
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 2.6, prompt: () => 'parler', fn: () => { const a = acte && parleActe5(acte); dialogue(a && a.length ? a : mots.map((text) => ({ who: qui, text }))); } });
    BILAN.gens.push({ qui, x: +x.toFixed(1), z: +z.toFixed(1), dit: mots[0] });
  }
}

// ---------------------------------------------------------------------
//  La vie des hameaux : tonneaux, bancs, fleurs, oiseaux, bêtes
// ---------------------------------------------------------------------
// Eugène, 5 octobre : « dans la Garde et au Pouget, ça manque d'éléments de déco : bancs, tonneaux,
// fleurs, oiseaux, animaux et troupeaux ». Une seule fabrique, exportée comme le poteau : la
// Garde-Guérin (ici) et le Pouget (pouget.js) l'appellent avec leurs maisons et leurs rues.
// Tout est en instances ou fondu par matière (une quinzaine d'appels de dessin pour tout) ; les
// tonneaux et les bancs ont leur collision (addCap). Les bêtes : la brebis de l'enclos du Pouget
// et le cheval de la banque (Quaternius, CC0) — il n'y a pas d'autre animal sur le PC.

// le banc : deux pieds de granit, l'assise et le dossier de planches (aussi ceux des places de Villefort)
function poserBanc(granit, planches, x, y, z, a) {
  const f = V(Math.sin(a), 0, Math.cos(a)), u = V(f.z, 0, -f.x);
  for (const sg of [-0.6, 0.6]) granit.bloc(V(x, y + 0.2, z).addScaledVector(u, sg), u.clone().multiplyScalar(0.12), V(0, 0.22, 0), f.clone().multiplyScalar(0.2));
  planches.bloc(V(x, y + 0.46, z), u.clone().multiplyScalar(0.85), V(0, 0.04, 0), f.clone().multiplyScalar(0.22));
  planches.bloc(V(x, y + 0.78, z).addScaledVector(f, -0.24), u.clone().multiplyScalar(0.85), V(0, 0.14, 0), f.clone().multiplyScalar(0.03));
}

// Les seuils : devant chaque maison, le mur le plus proche d'une rue, s'il reste entre lui et la
// chaussée au moins 1,2 m de libre. Rend { x, z, a (le regard, vers la rue), ux, uz (le long du mur), L }.
function seuils(maisons, rues, libre) {
  const pr = rues.flatMap((c) => densifier(c.pts, 1).map(([x, z]) => [x, z, largeur(c) / 2]));
  const rAut = grille(pr, ([x, z, w]) => [x - w - 8, z - w - 8, x + w + 8, z + w + 8]);
  const dRue = (x, z) => { let d = 99; for (const i of rAut(x, z)) { const [a, b, w] = pr[i]; d = Math.min(d, Math.hypot(a - x, b - z) - w); } return d; };
  const out = [];
  for (const m of maisons) {
    const pts = m.pts, cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    let mieux = null;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[(k + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 3) continue;
      const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L; let nx = -uz, nz = ux; const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
      const x = mx + nx * 0.7, z = mz + nz * 0.7, d = dRue(x, z);
      if (d < 0.6 || d > 7 || !libre(x, z)) continue;
      if (!mieux || d < mieux.d) mieux = { x, z, a: Math.atan2(nx, nz), ux, uz, L, d };
    }
    if (mieux) out.push(mieux);
  }
  return out;
}

// le tonneau : une douelle bombée (LatheGeometry), trois cercles de fer
function geoTonneau() {
  const prof = [[0.27, 0], [0.31, 0.12], [0.335, 0.45], [0.31, 0.78], [0.27, 0.9]].map(([r, y]) => new THREE.Vector2(r, y));
  const corps = new THREE.LatheGeometry(prof, 18); const uv = corps.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 2.0, uv.getY(k) * 0.9);   // en mètres
  const fond = new THREE.CircleGeometry(0.27, 18); fond.rotateX(-Math.PI / 2); fond.translate(0, 0.88, 0);
  const cercles = [0.1, 0.45, 0.8].map((y) => { const r = y === 0.45 ? 0.338 : 0.305, g = new THREE.CylinderGeometry(r, r, 0.05, 18, 1, true); g.translate(0, y, 0); return g; });
  return { bois: mergeGeometries([corps, fond]), fer: mergeGeometries(cercles) };
}

// les géraniums en pot : des feuilles rondes, des ombelles rouges, roses ou blanches, sur une carte
// découpée (alphaTest) ; trois cartes croisées au-dessus d'un pot de terre cuite
function texGeranium(teinte) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const t = c.getContext('2d');
  for (let k = 0; k < 26; k++) { const x = 20 + Math.random() * 88, y = 55 + Math.random() * 60, r = 9 + Math.random() * 8;
    t.fillStyle = `hsl(${95 + Math.random() * 25},${40 + Math.random() * 20}%,${18 + Math.random() * 14}%)`; t.beginPath(); t.arc(x, y, r, 0, TAU); t.fill(); }
  for (let k = 0; k < 7; k++) { const x = 18 + Math.random() * 92, y = 14 + Math.random() * 50;
    for (let j = 0; j < 14; j++) { const a = Math.random() * TAU, d = Math.random() * 9;
      t.fillStyle = `hsl(${teinte[0] + Math.random() * 10},${teinte[1]}%,${teinte[2] + Math.random() * 14}%)`; t.beginPath(); t.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 3.2, 0, TAU); t.fill(); } }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function geoCartes(l, h, n = 3) {
  const gs = []; for (let k = 0; k < n; k++) { const g = new THREE.PlaneGeometry(l, h); g.translate(0, h / 2, 0); g.rotateY(k * Math.PI / n); gs.push(g); }
  return mergeGeometries(gs);
}
// une fleur des prés : la petite carte de nature.js (un pétale clair, un cœur jaune), en trois couleurs
function texFleur(col) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.strokeStyle = '#3e6a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 64); g.quadraticCurveTo(36, 40, 32, 22); g.stroke();
  for (let k = 0; k < 5; k++) { const a = k * TAU / 5; g.fillStyle = col; g.beginPath(); g.ellipse(32 + Math.cos(a) * 8, 20 + Math.sin(a) * 8, 6.5, 4.5, a, 0, TAU); g.fill(); }
  g.fillStyle = '#e8b020'; g.beginPath(); g.arc(32, 20, 4, 0, TAU); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Un vol d'oiseaux : trois maillages en instances (le corps et les deux ailes) ; chaque oiseau tourne
// sur son cercle autour d'un centre, monte et descend un peu, bat des ailes ou plane. `taille` : son
// envergure en mètres. Les choucas autour de la tour, les hirondelles au ras des toits, la buse haut.
function vol({ centre: [cx, cz], y, rayon: [r0, r1], n, taille, vitesse, couleur, battement = 9, plane = 0.3 }) {
  const corps = new THREE.OctahedronGeometry(0.5, 0); corps.scale(0.22, 0.2, 0.6);
  const aile = (sg) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, sg * 0.5, 0, -0.05, 0, 0, -0.18], 3)); g.computeVertexNormals(); return g; };
  const mat = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.85, side: THREE.DoubleSide });
  const ims = [corps, aile(1), aile(-1)].map((g) => { const m = new THREE.InstancedMesh(g, mat, n); m.frustumCulled = false; scene.add(m); return m; });
  const B = Array.from({ length: n }, () => ({ a: rand(0, TAU), r: rand(r0, r1), dy: rand(-3, 3), w: (Math.random() < 0.5 ? -1 : 1) * vitesse / ((r0 + r1) / 2) * rand(0.8, 1.2), ph: rand(0, TAU) }));
  const m4 = new THREE.Matrix4(), mw = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = V(), s = V(taille, taille, taille);
  return (t, dt) => {
    B.forEach((b, k) => {
      b.a += b.w * dt; const x = cx + Math.cos(b.a) * b.r, z = cz + Math.sin(b.a) * b.r, yy = y + b.dy + Math.sin(t * 0.4 + b.ph) * 1.5;
      const cap = Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w));    // la tangente au cercle
      e.set(0, cap, -Math.sign(b.w) * 0.35); q.setFromEuler(e); m4.compose(p.set(x, yy, z), q, s); ims[0].setMatrixAt(k, m4);
      const glisse = Math.sin(t * 0.3 + b.ph) > 1 - plane * 2, f = glisse ? 0.08 : Math.sin(t * battement + b.ph) * 0.7;
      for (const [im, sg] of [[ims[1], 1], [ims[2], -1]]) { mw.makeRotationZ(sg * f); im.setMatrixAt(k, m4.clone().multiply(mw)); }
    });
    for (const im of ims) im.instanceMatrix.needsUpdate = true;
  };
}

// Les bêtes de la banque (Quaternius, CC0, assets_back/02_personnages/animaux/, préparées par glb.py) :
// chargées et lissées comme dans aveyron.js (dont le chargeur est privé à sa page), UNE fois par
// fichier, puis clonées (SkeletonUtils), à l'échelle des gens du lieu, chacune sa boucle d'animation.
// HAUT : la hauteur de la bête en unités de Lille (le cheval de 2,35, comme dans l'Aveyron).
// TEINTES : les couleurs du pays, posées sur les matières du modèle (des aplats nommés) — la vache
// et le taureau d'Aubrac, froment, le mufle et le tour des yeux sombres, les cornes en lyre claires ;
// l'âne gris, le ventre et le museau clairs, la crinière sombre.
const BETES = {
  'cheval.glb': { haut: 2.35 }, 'cheval_blanc.glb': { haut: 2.35 },
  'vache.glb': { haut: 2.05, teintes: { Main: 0xb48c5a, Main_Light: 0xdcc8a0, Muzzle: 0x2e2622, Horns: 0xe6dcc4, Hooves: 0x2a2420 } },
  'taureau.glb': { haut: 2.25, teintes: { Main: 0x96704a, Main_Light: 0xc8aa7c, Muzzle: 0x2a2220, Horns: 0xe6dcc4, Hooves: 0x2a2420 } },
  'ane.glb': { haut: 1.75, teintes: { Main: 0x5e5852, Main_Light: 0xb4aea4, Main_Dark: 0x4a4642, Hair: 0x34302c, Muzzle: 0xd8d4cc } },
  // La chèvre (Eugène, 6 octobre : « des chèvres au Pouget ») : il n'y en a dans aucun pack libre au
  // style des autres bêtes (celles de Poly Pizza sont des jouets). On prend l'âne, le plus proche par
  // les proportions (corps trapu, cou court), à la taille d'une chèvre (75 cm au garrot), en robe de
  // l'Alpine chamoisée, la chèvre du Massif central : brun fauve, raie dorsale, pattes et tête noires.
  // Les oreilles et la queue sont raccourcies (os : l'échelle de ces os, reposée après chaque image
  // d'animation) et des cornes en arc, recourbées vers l'arrière, sont accrochées à l'os de la tête.
  'chevre': { fichier: 'ane.glb', haut: 1.15, teintes: { Main: 0x8a5a30, Main_Light: 0xa87a4c, Main_Dark: 0x1c1816, Hair: 0x1c1816, Muzzle: 0x24201c, Hooves: 0x1a1714 },
    os: { 'Ear1.L': 0.55, 'Ear1.R': 0.55, 'Tail2': 0.3 }, cornes: true },
};
const modelesBetes = new Map();
// une clé par SORTE de bête : la chèvre et l'âne ont le même fichier, pas les mêmes teintes
function chargerBete(sorte) {
  const fichier = (BETES[sorte] || {}).fichier || sorte;
  if (!modelesBetes.has(sorte)) modelesBetes.set(sorte, Promise.all([import('./lib/addons/loaders/GLTFLoader.js'), import('./lib/addons/utils/SkeletonUtils.js'), import('./lib/addons/utils/BufferGeometryUtils.js')])
    .then(([L, S, U]) => new L.GLTFLoader().loadAsync('assets_back/02_personnages/animaux/' + fichier + '?v=2').then((g) => {
      const T = (BETES[sorte] || {}).teintes || {};
      g.scene.traverse((o) => { if (!o.isSkinnedMesh) return; let ge = o.geometry.clone(); ge.deleteAttribute('normal'); ge = U.mergeVertices(ge, 1e-4); ge.computeVertexNormals(); o.geometry = ge;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m.flatShading = false; m.roughness = 0.82; m.metalness = 0; if (T[m.name] != null) m.color.setHex(T[m.name]); m.needsUpdate = true; } });
      g.scene.updateMatrixWorld(true);
      const b = new THREE.Box3(); g.scene.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); b.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
      return { g, S, echelle: ((BETES[sorte] || {}).haut || 2.35) / (b.max.y - b.min.y) };
    })).catch((e) => { console.warn('décor : ' + fichier + ' indisponible —', e.message); return null; }));
  return modelesBetes.get(sorte);
}
async function beteAuRepos(sorte, x, y, z, yaw, clip) {
  const m = await chargerBete(sorte), D = BETES[sorte] || {}; if (!m) return null;
  const c = m.S.clone(m.g.scene); c.scale.setScalar(m.echelle * G.echelle);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  c.position.set(x, y, z); c.rotation.y = yaw; scene.add(c);
  const mix = new THREE.AnimationMixer(c), a = m.g.animations.find((k) => k.name === clip) || m.g.animations.find((k) => k.name === 'Idle');
  if (a) { const act = mix.clipAction(a); act.time = Math.random() * a.duration; act.play(); }
  const os = Object.entries(D.os || {}).map(([nom, e]) => [c.getObjectByName(nom), e]).filter(([b]) => b);
  if (D.cornes) { mix.update(0); c.updateMatrixWorld(true); cornes(c); }
  if (!os.length) return mix;
  // l'animation repose l'échelle des os à chaque image : on la retaille après elle
  return { update(dt) { mix.update(dt); for (const [b, e] of os) b.scale.setScalar(e); } };
}
// Les cornes de la chèvre : deux arcs effilés (un tube qui s'amincit), partis du haut du crâne,
// montés puis recourbés vers l'arrière. Accrochées à l'os de la tête (elles suivent ses mouvements) ;
// leur taille et leur pente se règlent dans le repère du monde, au moment de la pose.
let geoCorne = null;
function cornes(c) {
  const tete = c.getObjectByName('Head'); if (!tete) return;
  if (!geoCorne) { const courbe = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0.07, -0.02), V(0, 0.12, -0.07), V(0, 0.13, -0.13), V(0, 0.11, -0.17)]);
    geoCorne = new THREE.TubeGeometry(courbe, 12, 0.014, 6, false);
    const p = geoCorne.attributes.position;   // l'amincissement : chaque anneau (7 sommets) rétrécit vers la pointe
    for (let i = 0; i < p.count; i++) { const k = Math.floor(i / 7) / 12, ax = courbe.getPoint(Math.min(1, k)), f = 1 - 0.75 * k;
      p.setXYZ(i, ax.x + (p.getX(i) - ax.x) * f, ax.y + (p.getY(i) - ax.y) * f, ax.z + (p.getZ(i) - ax.z) * f); }
    geoCorne.computeVertexNormals(); }
  const mat = phMat('rocher_01', 0.2, 0.2, { color: 0x6e6252, roughness: 0.6 });
  const qT = tete.getWorldQuaternion(new THREE.Quaternion()), sT = tete.getWorldScale(V()), pT = tete.getWorldPosition(V());
  const qB = c.getWorldQuaternion(new THREE.Quaternion()), e = 1.1 * G.echelle;
  for (const sg of [-1, 1]) {
    // dans le repère de la bête (z vers l'avant) : 9 cm au-dessus de l'os de la tête, 4 cm en avant,
    // 3 cm de côté ; la corne garde l'orientation de la bête (sa courbe part vers l'arrière, −z),
    // inclinée de 0,25 rad vers l'extérieur
    const o = new THREE.Mesh(geoCorne, mat), pw = pT.clone().add(V(sg * 0.03, 0.09, 0.04).multiplyScalar(e).applyQuaternion(qB));
    const qw = qB.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -sg * 0.25));
    o.quaternion.copy(qT.clone().invert().multiply(qw)); o.position.copy(tete.worldToLocal(pw)); o.scale.set(e / sT.x, e / sT.y, e / sT.z);
    o.castShadow = true; tete.add(o);
  }
}

// Les poules (Eugène, 6 octobre : « des poules au Pouget ») : aucune poule libre au style réaliste
// (celles de Poly Pizza sont un monstre et un cube). Faites ici, en mètres, sur la poule pondeuse
// rousse de ferme (40 cm de haut) : un corps ovale relevé vers la queue, la queue en deux plumes
// dressées, le cou et la tête, le bec et les pattes jaunes, la crête et les barbillons rouges.
// Le plumage prend le relief de la laine bouclée (Poly Haven), teint par poule : rousse surtout,
// blanche, noire, cendrée. Elles picorent (la tête plonge, pivot au bas du cou) et trottinent autour
// de leur cour. Cinq maillages en instances pour toute la basse-cour.
function geoPoule() {
  const S = (r, sx, sy, sz, x, y, z) => { const g = new THREE.SphereGeometry(r, 12, 9); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
  const nu = (gs) => mergeGeometries(gs.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; }));
  const corps = [S(1, 0.14, 0.13, 0.2, 0, 0.25, 0), S(1, 0.11, 0.1, 0.11, 0, 0.29, -0.13)];
  for (const [a, h2] of [[-0.5, 0.17], [-0.85, 0.15]]) { const q = new THREE.ConeGeometry(0.06, h2, 5); q.scale(0.5, 1, 1.4); q.rotateX(a); q.translate(0, 0.37, -0.2); corps.push(q); }
  const pattes = []; for (const sx of [-0.05, 0.05]) { const l = new THREE.CylinderGeometry(0.008, 0.008, 0.14, 5); l.translate(sx, 0.07, 0.02); pattes.push(l);
    for (const a of [-0.5, 0, 0.5]) { const d = new THREE.BoxGeometry(0.008, 0.006, 0.055); d.translate(0, 0.003, 0.025); d.rotateY(a); d.translate(sx, 0, 0.03); pattes.push(d); } }
  // la tête, autour de son pivot (le bas du cou, en 0, 0.3, 0.12) : le cou, la tête, le bec, la crête
  const tete = [S(1, 0.055, 0.08, 0.055, 0, 0.06, 0.02), S(0.05, 1, 1, 1.15, 0, 0.13, 0.05)];
  const bec = new THREE.ConeGeometry(0.014, 0.035, 5); bec.rotateX(Math.PI / 2); bec.translate(0, 0.125, 0.11);
  const rouge = [S(0.018, 0.6, 1, 1, 0, 0.18, 0.06), S(0.016, 0.6, 1, 1, 0, 0.18, 0.03), S(0.014, 0.6, 1, 1, 0, 0.175, 0.005), S(0.012, 0.6, 1.4, 0.8, 0, 0.1, 0.08)];
  return { corps: nu(corps), pattes: nu(pattes), tete: nu(tete), bec, rouge: nu(rouge) };
}
function basseCour(h, centre, n, libre) {
  const G2 = geoPoule(), robes = [0x9a5428, 0x9a5428, 0x8a4a22, 0xe6e0d4, 0x2a2624, 0x9c968c];
  // le relief de la laine seulement (sans son image, qui teinte en carreaux de tissu écossais) : la
  // couleur est celle de la robe de chaque poule, le grain celui des plumes
  const plume = phMat('wool_boucle', 0.4, 0.4, { color: 0xffffff, roughness: 0.95 }).clone(); plume.map = null; plume.normalScale.set(0.6, 0.6); plume.needsUpdate = true;
  const jaune = new THREE.MeshStandardMaterial({ color: 0xd8a830, roughness: 0.6 }), rouge = new THREE.MeshStandardMaterial({ color: 0xa82418, roughness: 0.55 });
  const im = { corps: new THREE.InstancedMesh(G2.corps, plume, n), pattes: new THREE.InstancedMesh(G2.pattes, jaune, n), tete: new THREE.InstancedMesh(G2.tete, plume, n), bec: new THREE.InstancedMesh(G2.bec, jaune, n), rouge: new THREE.InstancedMesh(G2.rouge, rouge, n) };
  for (const m of Object.values(im)) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
  const col = new THREE.Color(), P = [];
  for (let k = 0; k < n; k++) { col.setHex(robes[k % robes.length]); im.corps.setColorAt(k, col); im.tete.setColorAt(k, col);
    let x = centre[0], z = centre[1]; for (let j = 0; j < 30; j++) { const a = rand(0, TAU), r = rand(0, 4), x2 = centre[0] + Math.cos(a) * r, z2 = centre[1] + Math.sin(a) * r; if (libre(x2, z2)) { x = x2; z = z2; break; } }
    P.push({ x, z, cap: rand(0, TAU), but: null, ph: rand(0, TAU), picore: rand(0, 3) }); }
  const m4 = new THREE.Matrix4(), mt = new THREE.Matrix4(), mp = new THREE.Matrix4().makeTranslation(0, 0.3, 0.12), mr = new THREE.Matrix4(), q = new THREE.Quaternion(), e = G.echelle * 1.6, sc = V(e, e, e), v = V();
  return (t, dt) => {
    P.forEach((p, k) => {
      // trottiner vers un but, puis picorer un moment ; un nouveau but à moins de 5 m du centre
      if (!p.but && (p.picore -= dt) < 0) { for (let j = 0; j < 8; j++) { const a = rand(0, TAU), r = rand(0, 5), x = centre[0] + Math.cos(a) * r, z = centre[1] + Math.sin(a) * r; if (libre(x, z)) { p.but = [x, z]; break; } } p.picore = rand(1.5, 5); }
      let bec = 0;
      if (p.but) { const dx = p.but[0] - p.x, dz = p.but[1] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.1) p.but = null; else { const pas = Math.min(d, 0.5 * dt); p.x += dx / d * pas; p.z += dz / d * pas; p.cap = Math.atan2(dx, dz); } }
      else bec = Math.max(0, Math.sin(t * 7 + p.ph)) * 1.1;          // la tête plonge vers le sol
      const sautille = p.but ? Math.abs(Math.sin(t * 14 + p.ph)) * 0.012 : 0;
      q.setFromAxisAngle(HAUT, p.cap); m4.compose(v.set(p.x, h(p.x, p.z) + sautille, p.z), q, sc);
      im.corps.setMatrixAt(k, m4); im.pattes.setMatrixAt(k, m4);
      mt.copy(m4).multiply(mp).multiply(mr.makeRotationX(bec));
      im.tete.setMatrixAt(k, mt); im.bec.setMatrixAt(k, mt); im.rouge.setMatrixAt(k, mt);
    });
    for (const m of Object.values(im)) m.instanceMatrix.needsUpdate = true;
  };
}


// ctx : { hauteur, bloque } ; o : { maisons [{pts}], rues [{pts, r}], libre(x, z), centre [x, z],
// pres { rmin, rmax } (où semer fleurs et brebis), oiseaux [params de vol], brebis n, betes
// [[fichier, x, z, yaw, clip]] (posées une à une), vaches { n, taureau } (un troupeau d'Aubrac) }.
// Rend anime(t, dt) (les oiseaux, les bêtes) et un bilan.
export async function decorDeHameau(ctx, o) {
  const { hauteur: h } = ctx, t0 = performance.now(), bilan = {};
  const places = seuils(o.maisons, o.rues, o.libre), pris = [];
  const libreIci = (x, z, m) => o.libre(x, z) && pris.every(([a, b]) => Math.hypot(a - x, b - z) > m);
  // devant les maisons : un banc pour une sur trois, un ou deux tonneaux pour une sur trois, des
  // géraniums pour une sur deux — à côté de la porte, contre le mur
  const granit = new Lot(), planches = new Lot(), tonneaux = [], pots = []; let bancs = 0;
  places.forEach((s, k) => {
    const le = (d, e = 0) => [s.x + s.ux * d + Math.sin(s.a) * e, s.z + s.uz * d + Math.cos(s.a) * e];
    if (k % 3 === 0 && s.L > 4) { const [x, z] = le(-s.L * 0.22); if (libreIci(x, z, 1.2)) { poserBanc(granit, planches, x, h(x, z), z, s.a); pris.push([x, z]); bancs++;
      addCap(x - s.ux * 0.85, z - s.uz * 0.85, x + s.ux * 0.85, z + s.uz * 0.85, 0.28, h(x, z) + 0.5); } }
    // les tonneaux à 85 cm du mur : à 65, le test de place libre (70 cm) les refusait tous
    if (k % 3 === 1) for (const d of [s.L * 0.3, s.L * 0.3 + 0.75].slice(0, 1 + (k % 2))) { const [x, z] = le(d, 0.15); if (libreIci(x, z, 0.7)) { tonneaux.push([x, z, rand(0, TAU)]); pris.push([x, z]); addCap(x, z, x, z, 0.36, h(x, z) + 0.9); } }
    if (k % 2 === 0) for (const d of [0.9, -0.9]) { const [x, z] = le(d, 0.1); if (libreIci(x, z, 0.4)) { pots.push([x, z, k]); pris.push([x, z]); } }
  });
  granit.maille(phMat('granite_tile_03', 1, 1, { color: 0xb4b0a8 })); planches.maille(phMat('wood_planks', 1, 1, { color: 0x7a6248 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(), v = V();
  if (tonneaux.length) { const g = geoTonneau(), ib = new THREE.InstancedMesh(g.bois, phMat('wood_cabinet_worn_long', 1, 1, { color: 0x8a6a48 }), tonneaux.length), ifr = new THREE.InstancedMesh(g.fer, phMat('metal_plate_02', 1, 1, { color: 0x3a3632, side: THREE.DoubleSide }), tonneaux.length);
    tonneaux.forEach(([x, z, a], k) => { q.setFromAxisAngle(HAUT, a); m4.compose(v.set(x, h(x, z) - 0.02, z), q, sc.set(1, rand(0.95, 1.08), 1)); ib.setMatrixAt(k, m4); ifr.setMatrixAt(k, m4); });
    ib.castShadow = ifr.castShadow = true; ib.receiveShadow = true; scene.add(ib, ifr); }
  if (pots.length) { const pot = new THREE.LatheGeometry([[0.11, 0], [0.13, 0.02], [0.17, 0.26], [0.19, 0.28], [0.19, 0.31], [0.16, 0.31], [0.15, 0.28]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const ip = new THREE.InstancedMesh(pot, phMat('terre_battue', 0.6, 0.6, { color: 0xc07850 }), pots.length);
    const cartes = geoCartes(0.5, 0.42), teintes = [[2, 78, 42], [340, 70, 58], [0, 0, 82]], imf = teintes.map((tt) => new THREE.InstancedMesh(cartes, new THREE.MeshStandardMaterial({ map: texGeranium(tt), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), pots.length));
    const nf = [0, 0, 0];
    pots.forEach(([x, z, k], i) => { q.setFromAxisAngle(HAUT, rand(0, TAU)); m4.compose(v.set(x, h(x, z), z), q, sc.set(1, 1, 1)); ip.setMatrixAt(i, m4);
      const c = k % 3; m4.compose(v.set(x, h(x, z) + 0.24, z), q, sc.set(1, 1, 1)); imf[c].setMatrixAt(nf[c]++, m4); });
    imf.forEach((m, c) => { m.count = nf[c]; }); ip.castShadow = true; scene.add(ip, ...imf); }
  Object.assign(bilan, { seuils: places.length, bancs, tonneaux: tonneaux.length, pots: pots.length });

  // les fleurs des prés : en touffes d'une couleur (une seule fleur par-ci par-là se perdait dans
  // l'herbe), autour du hameau, là où l'on ne bâtit ni ne marche
  const [cx, cz] = o.centre, cols = ['#f4f0e4', '#f0d040', '#b080d0'], fl = cols.map(() => []);
  for (let k = 0, n = 0; k < 3000 && n < (o.touffes ?? 70); k++) {
    const a = rand(0, TAU), r = rand(o.pres.rmin * 0.3, o.pres.rmax), x0 = cx + Math.cos(a) * r, z0 = cz + Math.sin(a) * r;
    if (!o.libre(x0, z0) || !o.pre(x0, z0)) continue; n++;
    for (let j = 0; j < 16; j++) { const b2 = rand(0, TAU), d = Math.sqrt(Math.random()) * 1.8, x = x0 + Math.cos(b2) * d, z = z0 + Math.sin(b2) * d; if (o.libre(x, z)) fl[n % 3].push([x, z]); }
  }
  const carte = geoCartes(0.28, 0.32, 2);
  cols.forEach((c, i) => { if (!fl[i].length) return; const im = new THREE.InstancedMesh(carte, new THREE.MeshStandardMaterial({ map: texFleur(c), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), fl[i].length);
    fl[i].forEach(([x, z], k) => { q.setFromAxisAngle(HAUT, rand(0, TAU)); const e = rand(0.7, 1.2); m4.compose(v.set(x, h(x, z) - 0.02, z), q, sc.set(e, e, e)); im.setMatrixAt(k, m4); }); scene.add(im); });
  bilan.fleurs = fl.reduce((s, l) => s + l.length, 0);

  // les brebis : deux ou trois groupes sur les prés, chacune autour d'un centre de groupe
  if (o.brebis) { const { modeleBrebis } = await import('./pouget-enclos.js'), mod = await modeleBrebis();
    if (mod) { const centres = [], ps = [];
      for (let k = 0; k < 3000 && centres.length < 3; k++) { const a = rand(0, TAU), r = rand(o.pres.rmin, o.pres.rmax), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (o.libre(x, z) && o.pre(x, z) && centres.every(([p, s]) => Math.hypot(p - x, s - z) > 25)) centres.push([x, z]); }
      for (let k = 0; k < 4000 && ps.length < o.brebis && centres.length; k++) { const [x0, z0] = centres[k % centres.length], a = rand(0, TAU), r = rand(0.5, 8), x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
        if (o.libre(x, z) && o.pre(x, z) && ps.every(([p, s]) => Math.hypot(p - x, s - z) > 1.4)) ps.push([x, z]); }
      const im = new THREE.InstancedMesh(mod.geo, mod.mat, ps.length);
      ps.forEach(([x, z], k) => { const e = rand(0.88, 1.08); q.setFromAxisAngle(HAUT, rand(0, TAU)); m4.compose(v.set(x, h(x, z) - 0.03, z), q, sc.set(e, e, e)); im.setMatrixAt(k, m4); });
      im.castShadow = im.receiveShadow = true; scene.add(im); bilan.brebis = ps.length; bilan.troupeaux = centres.length; } }

  // les oiseaux, et les bêtes
  const vols = (o.oiseaux || []).map(vol); bilan.oiseaux = (o.oiseaux || []).reduce((s, b) => s + b.n, 0);
  // chaque bête sur une place libre de pré, au plus près de celle voulue (un rond de 25 m)
  const surPre = (x0, z0) => { for (let r = 0; r < 25; r += 1) for (let k = 0; k < 16; k++) { const x = x0 + Math.cos(k / 16 * TAU) * r, z = z0 + Math.sin(k / 16 * TAU) * r; if (o.libre(x, z) && o.pre(x, z) && o.libre(x + 1.2, z) && o.libre(x - 1.2, z)) return [x, z]; } return null; };
  const betes = [...(o.betes || [])];
  // le troupeau d'Aubrac : sur un pré à part des brebis, les vaches à 4 m au moins l'une de l'autre,
  // chacune sa posture (elles broutent surtout), et le taureau un peu à l'écart
  if (o.vaches) {
    let c0 = null; for (let k = 0; k < 2000 && !c0; k++) { const a = rand(0, TAU), r = rand(o.pres.rmin, o.pres.rmax), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (o.libre(x, z) && o.pre(x, z) && surPre(x, z)) c0 = [x, z]; }
    if (c0) { const ps = [];
      for (let k = 0; k < 600 && ps.length < o.vaches.n; k++) { const a = rand(0, TAU), r = rand(0, 14), x = c0[0] + Math.cos(a) * r, z = c0[1] + Math.sin(a) * r;
        if (o.libre(x, z) && o.pre(x, z) && ps.every(([p, q]) => Math.hypot(p - x, q - z) > 4)) ps.push([x, z]); }
      ps.forEach(([x, z], k) => betes.push(['vache.glb', x, z, rand(0, TAU), ['Eating', 'Eating', 'Idle_Headlow', 'Idle', 'Idle_2'][k % 5]]));
      if (o.vaches.taureau) betes.push(['taureau.glb', c0[0] + 16, c0[1] + 6, rand(0, TAU), 'Idle']); }
  }
  // les chèvres : un petit troupeau sur un pré à part, même en pente (elles aiment ça)
  if (o.chevres) {
    let c0 = null; for (let k = 0; k < 2000 && !c0; k++) { const a = rand(0, TAU), r = rand(o.pres.rmin, o.pres.rmax), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (o.libre(x, z) && surPre(x, z) && betes.every((b) => Math.hypot(b[1] - x, b[2] - z) > 25)) c0 = [x, z]; }
    if (c0) for (let k = 0, m = 0; k < 400 && m < o.chevres.n; k++) { const a = rand(0, TAU), r = rand(0, 9), x = c0[0] + Math.cos(a) * r, z = c0[1] + Math.sin(a) * r;
      if (o.libre(x, z) && betes.every((b) => Math.hypot(b[1] - x, b[2] - z) > 2.5)) { betes.push(['chevre', x, z, rand(0, TAU), ['Eating', 'Idle_Headlow', 'Idle', 'Eating'][m % 4]]); m++; } }
  }
  // la basse-cour : près des maisons, sur une place libre de terre ou d'herbe (pas sur la rue)
  let poules = null;
  if (o.poules) { const c0 = o.poules.centre ? surPre(...o.poules.centre) : null;
    if (c0) { poules = basseCour(h, c0, o.poules.n, (x, z) => o.libre(x, z) && Math.hypot(x - c0[0], z - c0[1]) < 6); bilan.poules = o.poules.n; bilan.ou_poules = c0.map((v) => +v.toFixed(1)); } }
  bilan.ou = [];   // où sont les bêtes (pour le banc et les captures)
  const mixers = (await Promise.all(betes.map(([f, x0, z0, a, clip]) => { const p = surPre(x0, z0); if (p) bilan.ou.push([f, +p[0].toFixed(1), +p[1].toFixed(1)]); return p ? beteAuRepos(f, p[0], h(...p), p[1], a, clip) : null; }))).filter(Boolean); bilan.betes = mixers.length;
  bilan.ms = Math.round(performance.now() - t0); BILAN.decor = bilan;
  return (t, dt) => { for (const f of vols) f(t, dt); for (const m of mixers) m.update(dt); if (poules) poules(t, dt); };
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
  f._sol = batirMaisons(ctx, { maisons: ctx.PLAN.maisons, rues: rs, mats: f.mats ? f.mats() : matieres(), special: f.special, enduit: f.enduit });
  return rs;
}

const FICHES = {
  // ---------------------------------------------------------------- le lac de Villefort
  // Un lieu neuf (consigne E4, Eugène, 7 octobre) : le bras de l'Altier du lac de barrage, le viaduc de
  // l'Altier (la voie des Cévennes), la via ferrata de la falaise ouest. 870 × 550 m, tirés des relevés
  // locaux (carte/mondes/plans-lieux-lozere.py lac, relief-lac-lozere.py). Pas de maisons. Le lac lui-
  // même, monde.js le pose (PLAN.eau.plans, G.level.lacs) ; la sonnaille le fait disparaître (la vallée
  // d'avant le barrage).
  lac: {
    ...COMMUN, name: 'lac', titre: 'Le lac de Villefort', plan: 'lozere-lac.json', fin: 'relief-lozere-lacvillefort.json', h0: 600,
    grille: { x0: -480, z0: -2310, pas: 5 },
    emprise: { x0: -412, x1: 442, z0: -2242, z1: -1708 },
    reperes: [
      { id: 'poteau', nom: 'le poteau des vieux chemins', x: 131.5, z: -2018.6, r: 6, type: 'passage' },
      { id: 'viaduc', nom: 'le viaduc de l’Altier', x: 400, z: -1950, r: 30, type: 'lieu' },
      { id: 'ferrata', nom: 'la via ferrata du lac', x: -300, z: -1975, r: 40, type: 'lieu' },
      { id: 'vallee', nom: 'la rive du lac', x: 40, z: -1990, r: 25, type: 'lieu' },
    ],
    sol: ['grass_ground', 0x96a86e],
    depart: { x: 130, z: -2022, yaw: -Math.PI / 2 },
    counts: 'Le lac de Villefort : le bras de l’Altier, le viaduc de la voie des Cévennes, la via ferrata de la falaise. Le poteau des vieux chemins, sur la route de la rive.',
    start: 'Un lac aux bras longs, l’eau verte, le viaduc qui l’enjambe. Sous l’eau, une vallée.',
    entry: { title: 'Le lac de Villefort', sub: 'La Cloche des Troupeaux — Lozère', cam: [520, 120, -2300], at: [100, 0, -1950], cam2: [200, 30, -2060], at2: [60, 0, -1990], dur: 6 },
    solLieu(x, z) { return FICHES.lac._sol ? FICHES.lac._sol(x, z) : null; },
    plus(ctx) {
      const { PLAN, CADRE } = ctx;
      const rs = preparer(ctx, FICHES.lac, (c) => (c.r >= 2 ? ['asphalt_02', 0x9a9894] : ['rocky_trail', 0xb0a088, true]));
      voieFerree(ctx);
      const bois = (PLAN.verdure.bois || []).filter((b) => dansCadre(CADRE, b.pts)), lacs = (PLAN.eau.plans || []).filter((l) => l.pts.length > 2);
      arbres(ctx, { espece: 'chene', n: 700, h: [8, 13], bois: (x, z) => bois.some((b) => dansPoly(x, z, b.pts)),
        libre: (x, z) => !ctx.bloque(x, z, 3) && !lacs.some((l) => dansPoly(x, z, l.pts)) && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 2.5) });
      lisiere(ctx, rs, { cotes: ['ouest', 'nord', 'est', 'sud'], emprise: FICHES.lac.emprise,
        libre: (x, z) => !ctx.bloque(x, z, 2.5) && !lacs.some((l) => dansPoly(x, z, l.pts)) && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 1.5) });
      poteau(ctx, 'lac');
      acteLac(ctx, lacs);
    },
    anime(now) { const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now; acte5Anime(dt); },
  },
  // ---------------------------------------------------------------- Villefort
  // Le bourg de pierre sombre au fond de la vallée de l'Altier (SCENARIO § 14 : « l'endroit où
  // l'on parle aux gens »), seul, du pont Saint-Jean au sud du bourg : 370 × 600 m où l'on marche
  // (PLAN-2026-10-04-CARTES.md, consigne 5, emprise validée par Eugène le 5 octobre). Avant, le lieu
  // allait jusqu'au barrage (1 160 × 2 130 m) ; la gare, à 640 m à l'ouest, et le lac, à 800 m au
  // nord, ne sont plus qu'à l'horizon. Plan et relief d'avant : carte/mondes/complet/.
  villefort: {
    ...COMMUN, name: 'villefort', titre: 'Villefort', plan: 'lozere-villefort.json', fin: 'relief-lozere-villefort.json', h0: 610,
    grille: { x0: 1360, z0: -1490, pas: 5 },
    // où l'on marche : le relief fin (carte/mondes/recoudre-relief-lozere.py) déborde de 60 m tout
    // autour, un débord boisé qu'on ne parcourt pas (lisiere)
    emprise: { x0: 1428, x1: 1792, z0: -1422, z1: -828 },
    // les endroits qui comptent : la minicarte et les lieux découverts (monde.js)
    reperes: [
      { id: 'bosquet', nom: 'la place du Bosquet', x: 1576, z: -1140, r: 18, type: 'lieu' },
      { id: 'poteau', nom: 'le poteau des vieux chemins', x: 1584.5, z: -1129.5, r: 6, type: 'passage' },
      { id: 'portalet', nom: 'la place du Portalet', x: 1584, z: -1022, r: 14, type: 'lieu' },
      { id: 'eglise', nom: 'l’église Saint-Victorin', x: 1668, z: -968, r: 18, type: 'lieu' },
      { id: 'ormeau', nom: 'la place de l’Ormeau', x: 1673, z: -897, r: 14, type: 'lieu' },
      { id: 'pont', nom: 'le pont Saint-Jean et le lavoir', x: 1540, z: -1405, r: 18, type: 'lieu' },
      { id: 'national', nom: 'le café Le National', x: 1593, z: -1126, r: 9, type: 'lieu' },
      { id: 'fernand', nom: 'Chez Fernand', x: 1559.8, z: -1095.9, r: 6, type: 'pnj' },
      { id: 'chefgare', nom: 'le chef de gare', x: 1458, z: -1272, r: 6, type: 'pnj' },
      { id: 'balme', nom: 'l’hôtel Balme', x: 1606, z: -1040, r: 6, type: 'pnj' },
    ],
    sol: ['grass_ground', 0xa2ae7a],
    depart: { x: ARRIVEES.villefort.pos[0], z: ARRIVEES.villefort.pos[2], yaw: ARRIVEES.villefort.yaw },
    // la porte de l'île (acte V, Eugène, 7 octobre) : place du Bosquet, à côté du poteau
    portes: [{ x: 1568, z: -1150, rot: 0, prompt: 'repasser la porte de l’île', vers: ['temple', [-20.35, 0, -11.75], Math.atan2(20.35, 11.75)], label: 'Retour à l’île du temps…' }],
    counts: 'Villefort, le bourg de pierre au fond de la vallée, le long de l’Altier. Le poteau des vieux chemins, place du Bosquet, pour la Garde-Guérin et le Pouget.',
    start: 'Un bourg de pierre sombre, des toits de lauzes, et au nord, le lac.',
    entry: { title: 'Villefort', sub: 'La Cloche des Troupeaux — Lozère', cam: [1500, 170, -1560], at: [1610, 0, -1050], cam2: [1700, 40, -1300], at2: [1580, 0, -1120], dur: 6 },
    solLieu(x, z) { return FICHES.villefort._sol ? FICHES.villefort._sol(x, z) : null; },
    plus(ctx) {
      const { PLAN, CADRE, scene } = ctx;
      // les rues : l'enrobé pour la route et les rues (r ≥ 2) ; dans le bourg dense, les ruelles dallées
      // de granit ; dehors, les chemins de terre. Le « gravier » d'avant se lisait comme un ruban noir.
      const dense = densite(PLAN.maisons), milieu = (c) => c.pts[Math.floor(c.pts.length / 2)];
      // la pierre de Villefort, plus sombre que le granit de la Garde-Guérin (« un bourg de pierre
      // sombre », SCENARIO § 14), et quatre maisons sur dix du bourg dense crépies, comme dans la rue
      FICHES.villefort.mats = () => ({ ...matieres(), murs: phMat('granit_lozere', 1, 1, { color: 0x9c9a94 }), enduits: phMat('enduit_gris', 1, 1, { color: 0xd8d2c4 }) });
      FICHES.villefort.enduit = (b, i) => ['house', 'apartments', 'detached', 'hotel', undefined].includes(b.k) && dense(b.pts[0][0], b.pts[0][1]) && (Math.imul(i + 7, 2654435761) >>> 0) % 10 < 4;
      const rs = preparer(ctx, FICHES.villefort, (c) => c.r >= 2 ? ['asphalt_02', 0x9a9894] : dense(...milieu(c)) ? ['granite_tile_03', 0xb4b8bc] : ['rocky_trail', 0xb0a088, true]);
      const t0s = performance.now();
      const { trottoir, pave } = solDuBourg(ctx, rs, { emprise: FICHES.villefort.emprise, dense, jardins: PLAN.verdure.jardins || [] });
      BILAN.msSol = Math.round(performance.now() - t0s);   // règle 8 : ≤ 300 ms
      const boutiques = choisirBoutiques(rs);
      const t0f = performance.now(); facades(ctx, rs); BILAN.msFacades = Math.round(performance.now() - t0f);
      const t0m = performance.now(); mobilier(ctx, rs, { pave, dense }); devantures(ctx, boutiques, rs); BILAN.msMobilier = Math.round(performance.now() - t0m);
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
      // les quatre bords : l'ouest et le nord du resserrement, l'est et le sud d'avant (la même lisière)
      lisiere(ctx, [...rs, ...PLAN.regordane.filter((c) => dansCadre(CADRE, c.pts, 20))], { cotes: ['ouest', 'nord', 'est', 'sud'], emprise: FICHES.villefort.emprise,
        libre: (x, z) => !ctx.bloque(x, z, 2.5) && FICHES.villefort._sol(x, z) === null && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 1.5) });
      poteau(ctx, 'villefort');
      const t0 = performance.now(); gensDuBourg(ctx, GENS_VILLEFORT, FICHES.villefort._sol); BILAN.msGens = Math.round(performance.now() - t0);   // règle 8 : ≤ 300 ms
      acte5Villefort(ctx, boutiques);
    },
    // les passants respirent et bougent un peu, à chaque image
    anime(now) {
      const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
      for (const g of GENS) if (g.userData.ctrl) PNJ.animeVillageois(g, dt, false);
      acte5Anime(dt);
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
      acte5Garde(ctx);
      // la vie du village (Eugène, 5 octobre) : devant les maisons, bancs, tonneaux et géraniums ; les
      // choucas autour de la tour et les hirondelles sur les toits ; sur le plateau, des fleurs, un
      // troupeau de brebis et des vaches d'Aubrac, et le cheval et l'âne d'un muletier de la Régordane,
      // au repos à l'entrée du village
      const tour = BILAN.corps.find((c) => c.sp.tour), enceinte = PLAN.garde.enceinte.map((e) => e.pts);
      const dansEnceinte = (x, z) => enceinte.some((p) => p.length > 2 && dansPoly(x, z, p));
      const pente = (x, z) => Math.hypot(ctx.hauteur(x + 1, z) - ctx.hauteur(x - 1, z), ctx.hauteur(x, z + 1) - ctx.hauteur(x, z - 1)) / 2;
      FICHES.gardeguerin._anime = null;
      decorDeHameau(ctx, {
        maisons: BILAN.corps.filter((c) => !c.sp.tour && !c.sp.ruine).map((c) => ({ pts: c.rect })), rues: rs, centre: [1815, -5330], pres: { rmin: 70, rmax: 230 },
        libre: (x, z) => !ctx.bloque(x, z, 0.7) && FICHES.gardeguerin._sol(x, z) === null,
        pre: (x, z) => !dansEnceinte(x, z) && pente(x, z) < 0.35 && rs.every((c) => distLigne(x, z, c.pts) > largeur(c) / 2 + 2),
        brebis: 26,
        oiseaux: [
          { centre: tour ? [tour.cx, tour.cz] : [1817, -5362], y: (tour ? tour.avt : ctx.hauteur(1817, -5362) + 21) + 6, rayon: [7, 26], n: 14, taille: 0.7, vitesse: 7, couleur: 0x1e1e22, battement: 10, plane: 0.35 },
          { centre: [1815, -5320], y: ctx.hauteur(1815, -5320) + 11, rayon: [12, 45], n: 10, taille: 0.35, vitesse: 13, couleur: 0x1a2030, battement: 16, plane: 0.2 },
        ],
        betes: [['cheval.glb', 1857, -5243, Math.atan2(-15, -60) + 1.9, 'Eating'], ['ane.glb', 1861, -5247, Math.atan2(-15, -60) + 2.4, 'Idle_Headlow']],
        vaches: { n: 6, taureau: true },
      }).then((f) => { FICHES.gardeguerin._anime = f; });
    },
    anime(now) {
      const t = now / 1000, dt = Math.min(0.1, t - (FICHES.gardeguerin._t || t)); FICHES.gardeguerin._t = t;
      if (FICHES.gardeguerin._anime) FICHES.gardeguerin._anime(t, dt);
      acte5Anime(dt);
    },
  },
};

// =====================================================================
//  L'ACTE V — « La Cloche des Troupeaux » (STORY.md ; docs/DECOUPAGE-ACTE5.md, DIALOGUES-ACTE5.md)
// =====================================================================
// L'acte passe d'un lieu à l'autre (Villefort, le Pouget, la Garde-Guérin) : son avancement
// (state.acte5), son carnet (state.ind5) et la sonnaille vivent ici, que pouget.js importe comme le
// poteau. Chaque habitant dit la réplique de l'étape la plus récente qui lui en donne une. En
// instance du multi (les arènes de la Garde-Guérin et du Pouget), l'acte ne joue pas.
export const EN_INSTANCE = (() => { try { const i = JSON.parse(localStorage.getItem('tloc_instance') || 'null'); return !!(i && i.code); } catch (e) { return false; } })();
const ETAPES5 = ['arrivee', 'chien', 'sonnaille', 'temoins', 'tour', 'loup', 'course'];
const rang5 = (e) => ETAPES5.indexOf(e);
export const atteint5 = (e) => rang5(state.acte5 || 'arrivee') >= rang5(e);
function passer5(e) { if (rang5(e) <= rang5(state.acte5 || 'arrivee')) return; state.acte5 = e; saveGame(true); }
const sait5 = (k) => !!(state.ind5 && state.ind5[k]);
function noter5(cle) { state.ind5 = state.ind5 || {}; if (state.ind5[cle]) return; state.ind5[cle] = true; saveGame(true); setTimeout(() => showMessage('Indice noté au journal (J).', 3), 300); }
// ce que l'acte a posé, pour les bancs (bancs/acte5-*.mjs)
export const A5 = { aFaire: [], apres: [], pret: false, chien: null, gens: {}, ctx: null, lieu: null, sonne: null, sonT: 0, appuis: [], surSonnaille: [] };
if (typeof window !== 'undefined') window.__acte5 = A5;

// Le carnet du journal (J)
const INDICES5 = {
  boulangere: { txt: 'Le chien du berger a volé un pain chez la boulangère, place du Bosquet.', qui: 'le vieux de la place', fait: () => sait5('pont') },
  pont:       { txt: 'Il dort sous la voûte du pont Saint-Jean, et s’enfuit quand on approche.', qui: 'la boulangère, le chef de gare', fait: () => atteint5('chien') },
  sifflet:    { txt: 'Il ne revient qu’au sifflet du berger : deux notes, une haute, une basse.', qui: 'les enfants du lavoir', fait: () => atteint5('chien') },
  sonnaille:  { txt: 'La sonnaille : un coup, le présent ; deux coups, le passé du lieu (touche N).', qui: 'le berger du Pouget', fait: () => false },
};
function indices5() {
  if (!state.ind5) return '';
  const l = Object.keys(INDICES5).filter((k) => state.ind5[k]).map((k) => { const i = INDICES5[k], f = i.fait();
    return `<div style="margin:4px 0;${f ? 'opacity:.5;text-decoration:line-through' : ''}">${i.txt} <span style="opacity:.6">— ${i.qui}</span></div>`; });
  return l.length ? `<h3 style="margin:18px 0 6px;color:#9fd0ff;font-size:16px;letter-spacing:1px">INDICES</h3><div style="padding:8px 14px;border-left:4px solid #9fd0ff;background:rgba(255,255,255,.06);border-radius:6px">${l.join('')}</div>` : '';
}

// Les répliques (DIALOGUES-ACTE5.md) : [étape, fonction qui rend les lignes] ; la dernière atteinte parle
const R5 = (who, ...t) => t.map((text) => ({ who, text }));
const puis5 = (l, fn) => { l[l.length - 1].fn = fn; return l; };
const REPLIQUES5 = {
  vieux: [
    ['arrivee', () => puis5(R5('Un vieux, sur la place', 'Le berger du Pouget est descendu hier soir. Son chien a filé quand le loup a hurlé, et il est remonté seul. **Sans son chien, le chemin du Pouget, on s’y perd.**',
      'Le chien ? **Demande à la boulangère.** Tout ce qui a faim passe chez elle.'), () => noter5('boulangere'))],
    ['chien', () => R5('Un vieux, sur la place', 'Le voilà ! Le chien du berger. Monte vite, il t’attend.')],
    ['course', () => R5('Un vieux, sur la place', 'Le brouillard du chemin s’est levé. Je n’avais pas vu les crêtes depuis des semaines.')],
  ],
  boulangere: [
    ['arrivee', () => puis5(R5('La boulangère', 'Un chien noir et blanc, avec un collier de cuir ? Il m’a pris un pain ce matin, ce voleur.',
      'Il a filé vers le bas du bourg. **Il dort sous le pont Saint-Jean**, à ce qu’on dit.'), () => noter5('pont'))],
    ['chien', () => R5('La boulangère', 'Rends-le au berger. Et dis-lui qu’il me doit un pain.')],
  ],
  chefgare: [
    ['arrivee', () => !sait5('pont') ? R5('Le chef de gare', 'Les trains ne passent plus à l’heure. Alors j’attends ici.')
      : puis5(R5('Le chef de gare', 'Le chien du berger ? Je l’ai vu sous le pont Saint-Jean. Mais il s’enfuit dès qu’on approche.',
        '**Les enfants du lavoir** lui donnent à manger, eux.'), () => noter5('enfants'))],
    ['chien', () => R5('Le chef de gare', 'Les trains ne passent plus à l’heure. Alors j’attends ici.')],
  ],
  enfants: [
    ['arrivee', () => !sait5('pont') ? R5('Les enfants du lavoir', 'On n’a pas le droit d’aller au lac. À cause du loup.')
      : puis5(R5('Les enfants du lavoir', 'Le chien ? Il revient seulement si on siffle comme le berger.',
        '**Deux notes, une haute, une basse.** Tiens, écoute. (Camille apprend le sifflet.)'), () => noter5('sifflet'))],
    ['chien', () => R5('Les enfants du lavoir', 'Il te suit ! Il t’a adoptée.')],
  ],
  berger: [
    ['arrivee', () => R5('Le berger', 'Mon chien… Tu ne l’as pas vu ? Il a filé à Villefort, quand le loup a hurlé.')],
    ['chien', () => puis5([
      ...R5('Le berger', 'Te voilà, toi. Tu as eu peur, hein. Moi aussi.',
        'Le loup qui a hurlé, je le connais. Il est grand comme une grange. Il garde les troupeaux de cette montagne depuis plus longtemps que les hommes.',
        'Quelqu’un lui a planté un morceau de cloche dans l’épaule. Depuis, il ne sait plus quelle année il est. Il chasse en 1765, il chasse aujourd’hui. Là-bas, on l’appelle la Bête.',
        'Je ne veux pas qu’on le tue. Je veux qu’on le libère. Prends ça : **la sonnaille** de ma brebis de tête. Il la connaît. **Un coup, et tout revient au présent. Deux coups, et le lieu revient à son passé.**')],
      () => { state.sonnaille = true; noter5('sonnaille'); passer5('sonnaille'); state.chienRendu = true; saveGame(true); showMessage('La SONNAILLE : touche N. Un coup, le présent ; deux coups, le passé du lieu.', 7); })],
    ['sonnaille', () => R5('Le berger', 'Ici, il n’y a qu’un temps. Grâce à lui.',
      'Il paraît qu’il y a un autre Pouget, en Aveyron. Une grande maison, chez des Roquette. J’y crois pas. Un Pouget, ça suffit.')],
  ],
};
const repl5 = (qui) => { let r = null; for (const [e, l] of REPLIQUES5[qui] || []) if (atteint5(e)) r = l; return r ? r() : []; };
// pour les passants de Villefort (gensDuBourg) : une réplique d'acte quand le passant en a une
export const parleActe5 = (qui) => (EN_INSTANCE ? null : REPLIQUES5[qui] ? repl5(qui) : null);

// Les gens nouveaux : le berger (le colporteur de pnj.js, plus sec), la boulangère (la marchande des
// villageois), les enfants du lavoir (pnj.js, enfant et enfante)
Object.assign(PNJ.ROLES, {
  a5_berger: { ...PNJ.ROLES.colporteur, gabarit: 'sec', idle: 'Idle_Loop' },
});
// (un rôle par son nom, un villageois par son numéro ; animés par acte5Anime, dans tous les lieux)
function personne5(role, x, y, z, yaw) {
  const o = typeof role === 'number' ? PNJ.buildVillageois(role) : PNJ.buildRole(role); if (!o) return null;
  o.scale.setScalar(G.echelle); o.position.set(x, y, z); o.rotation.y = yaw; scene.add(o); (A5.persos = A5.persos || []).push(o); return o;
}

// ---- Le chien : loup.glb réduit (Eugène, 7 octobre : « réduis le loup pour le chien »), assombri ----
BETES.chien = { fichier: 'loup.glb', haut: 1.1,   // (en unités de Lille, × G.echelle : 66 cm à la tête ; à 0,62, un chiot de 37 cm)
  teintes: { M_Wolf: 0x2a2826 } };
async function poserChien(x, y, z, yaw) {
  const m = await chargerBete('chien'); if (!m) return null;
  const c = m.S.clone(m.g.scene); c.scale.setScalar(m.echelle * G.echelle);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  c.position.set(x, y, z); c.rotation.y = yaw; scene.add(c);
  const mix = new THREE.AnimationMixer(c), marche = m.g.animations.find((k) => /Walk/.test(k.name)), act = marche ? mix.clipAction(marche) : null;
  if (act) { act.play(); act.paused = true; }
  return { c, mix, act };
}
// il suit Camille à deux mètres et demi ; il trotte quand elle s'éloigne, s'arrête quand elle s'arrête
function suivreChien(dt, sol) {
  const C = A5.chien; if (!C || !C.c) return;
  const p = player.pos, o = C.c.position, dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
  if (d > 60) { o.set(p.x - 2, p.y, p.z - 2); return; }
  const va = d > 2.5; if (C.act) C.act.paused = !va;
  if (va) { const v = Math.min(d - 2.5, (d > 8 ? 9 : 6) * dt); o.x += dx / d * v; o.z += dz / d * v; C.c.rotation.y = Math.atan2(dx, dz); }
  o.y = sol(o.x, o.z); C.mix.update(dt * (d > 8 ? 1.6 : 1));
}

// ---- Villefort : la boulangère, les enfants du lavoir, le chien sous le pont ----
function acte5Villefort(ctx, boutiques) {
  if (EN_INSTANCE) return;
  A5.ctx = ctx; A5.lieu = 'villefort';
  const { hauteur, bloque, addInteract } = ctx, sol = (x, z) => (FICHES.villefort._sol(x, z) ?? hauteur(x, z));
  const placer = (x0, z0) => { for (let r = 0; r < 25; r += 1) for (let k = 0; k < 16; k++) { const x = x0 + Math.cos(k / 16 * TAU) * r, z = z0 + Math.sin(k / 16 * TAU) * r; if (!bloque(x, z, 0.9)) return [x, z]; } return null; };
  const parle = (x, z, qui, r = 2.6) => addInteract({ pos: new THREE.Vector3(x, sol(x, z), z), r, prompt: () => 'parler', fn: () => dialogue(repl5(qui)) });
  // la boulangère, devant sa devanture
  const B = boutiques.find((b) => b.id === 'boulangerie');
  if (B) { const fx = B.p[0] + B.u.x * B.L / 2 + B.n.x * 1.6, fz = B.p[1] + B.u.z * B.L / 2 + B.n.z * 1.6, p = placer(fx, fz);
    if (p) { A5.aFaire.push(() => { A5.gens.boulangere = personne5(0, p[0], sol(...p), p[1], Math.atan2(B.n.x, B.n.z)); }); parle(p[0], p[1], 'boulangere'); A5.boulangere = p; } }
  // les enfants du lavoir
  for (const [role, x0, z0] of [['enfant', 1526, -1398], ['enfante', 1528, -1395]]) { const p = placer(x0, z0); if (!p) continue;
    A5.aFaire.push(() => { personne5(role, p[0], sol(...p), p[1], Math.atan2(1540 - p[0], -1405 - p[1])); }); A5.enfants = p; }
  if (A5.enfants) parle(A5.enfants[0], A5.enfants[1], 'enfants', 3);
  // le pont Saint-Jean : le chien dort sous la voûte ; on siffle depuis la rive
  { const p = placer(1546, -1410) || [1546, -1410]; A5.pont = p;
    addInteract({ pos: new THREE.Vector3(p[0], sol(...p), p[1]), r: 4, prompt: () => (sait5('sifflet') ? 'siffler comme le berger' : 'regarder sous le pont'), enabled: () => !atteint5('chien'),
      fn: () => { if (!sait5('sifflet')) { showMessage('Sous la voûte, dans l’ombre, deux yeux qui brillent. Ils disparaissent dès que tu avances.', 5); return; }
        SFX.unlock && SFX.unlock(); dialogue([{ who: '', text: '(deux notes) Le chien sort de sous le pont, la queue basse, puis la queue haute. Il te suit.' }], () => {
          state.chienSuit = true; passer5('chien'); saveGame(true);
          poserChien(p[0] - 1.5, sol(...p), p[1], 0).then((c) => { A5.chien = c; }); }); } }); }
  // l'ouvrier de 1870, sur la voie (on y posait les rails), et son chantier
  { const x = 1524, z = -966; temoinDuPasse(ctx, 'a5_ouvrier', 'ouvrier', x, z, [1500, -1014], chantier1870(x + 2.5, sol(x + 2.5, z), z, Math.atan2(55, 110))); }
  if (state.chienSuit && !state.chienRendu) A5.aFaire.push(() => poserChien(player.pos.x - 2, player.pos.y, player.pos.z - 2, 0).then((c) => { A5.chien = c; }));
  A5.sol = sol;
  A5.apres.push(() => { if (state.transh === 1) poserTroupeau(player.pos.x, player.pos.z); });
}

// ---- Le Pouget : le berger, devant sa maison ; le chien rendu ----
export function acte5Pouget(ctx) {
  if (EN_INSTANCE) return;
  A5.ctx = ctx; A5.lieu = 'pouget';
  // devant la première maison du hameau en montant, tourné vers la route d'arrivée (une place libre)
  const { hauteur, addInteract, bloque } = ctx, [x0, z0] = ctx.bergerA || [20, -40];
  let x = x0, z = z0; for (let r = 0, ok = false; r < 25 && !ok; r += 1) for (let k = 0; k < 16 && !ok; k++) { const a = x0 + Math.cos(k / 16 * TAU) * r, b = z0 + Math.sin(k / 16 * TAU) * r; if (!bloque(a, b, 0.9)) { x = a; z = b; ok = true; } }
  const y = hauteur(x, z), yaw = Math.atan2(52.6 - x, -104 - z);
  A5.sol = hauteur; A5.berger = [x, y, z];
  A5.aFaire.push(() => { A5.gens.berger = personne5('a5_berger', x, y, z, yaw); });
  addInteract({ pos: new THREE.Vector3(x, y, z), r: 2.8, prompt: () => 'parler au berger', fn: parlerBerger });
  A5.apres.push(() => { if (state.transh === 1) poserTroupeau(player.pos.x, player.pos.z); });
  // la bergère de 1765, au bois sous le hameau, et le parc de claies d'autrefois
  { const bx = -40, bz = 60; temoinDuPasse(ctx, 2, 'bergere', bx, bz, [0, 5], claies1765(bx + 4, hauteur(bx + 4, bz), bz)); }
  // le chien : il suit Camille jusqu'ici, puis reste avec le berger
  if (state.chienSuit) A5.aFaire.push(() => poserChien(state.chienRendu ? x + 1.2 : player.pos.x - 2, y, state.chienRendu ? z + 0.8 : player.pos.z - 2, 0).then((c) => { A5.chien = c; }));
}

// (la position d'un Mesh ne s'assigne pas : Object.assign plantait le module au chargement)
const posee = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// ---- Trois témoins, trois époques (étape 4) : on ne les voit qu'à deux coups de sonnaille ----
// Chacun est posé à sa place, caché ; le passé le montre (et son décor : les claies, les rails), le
// présent le cache. Sa réplique ne s'entend que pendant le passé.
INDICES5.transhumance = { txt: 'Mener le troupeau du berger à l’enclos d’estive, sur le plateau de la Garde-Guérin.', qui: 'le berger', fait: () => (state.transh || 0) >= 2 };
INDICES5.qui = { txt: 'Un géant rouge a passé la Régordane avec un loup grand comme une grange.', qui: 'le chevalier de la Garde-Guérin', fait: () => atteint5('tour') };
INDICES5.ou = { txt: 'La Bête dort le jour dans la tour de la Garde-Guérin ; la nuit, elle sort sur le plateau.', qui: 'la bergère de 1765', fait: () => atteint5('tour') };
INDICES5.comment = { txt: 'La tour est murée ; du temps des chevaliers, elle avait une porte. La sonnaille la ferait revenir.', qui: 'l’ouvrier de 1870', fait: () => atteint5('tour') };
Object.assign(REPLIQUES5, {
  chevalier: [['sonnaille', () => puis5(R5('Le chevalier', 'Halte. On paie pour passer la Régordane. Toi, tu n’as rien ? Passe quand même.',
    'Un géant rouge est passé sans payer. Il menait **un loup grand comme une grange**, au bout d’une chaîne de fer.'), () => temoin('qui'))]],
  bergere: [['sonnaille', () => puis5(R5('La bergère', 'Tu ne devrais pas être dans le bois. La Bête y chasse.',
    'Le jour, elle dort **dans la tour de la Garde-Guérin**. La nuit, elle sort sur le plateau.'), () => temoin('ou'))]],
  ouvrier: [['sonnaille', () => puis5(R5('L’ouvrier', 'On pose les rails jusqu’à Clermont. Si on finit un jour.',
    'La tour ? Murée depuis longtemps. Mais du temps des chevaliers, **elle avait une porte**. Ta cloche, là — elle fait revenir les portes ?'), () => temoin('comment'))]],
});
function temoin(k) { noter5(k); if (sait5('qui') && sait5('ou') && sait5('comment')) passer5('temoins'); }
Object.assign(PNJ.ROLES, {
  // le chevalier de la Garde-Guérin : la cotte, le manteau sombre (le Rôdeur de la banque, comme le Colosse)
  a5_chevalier: { ...PNJ.ROLES.colosse, haut: 0x5a5a62, valeur: 0.8, bas: 0x3a3430, valeurBas: 0.8, idle: 'Idle_Loop' },
  a5_ouvrier: { ...PNJ.ROLES.cosimo, haut: 0x6a5a48, idle: 'Idle_Loop' },
});
// un témoin du passé : posé caché, montré par la sonnaille ; [rôle ou villageois, qui (REPLIQUES5), x, z, regarde, décor]
function temoinDuPasse(ctx, role, qui, x0, z0, vers, decor = null) {
  const { hauteur, bloque, addInteract } = ctx, sol = A5.sol || hauteur;
  let x = x0, z = z0; for (let r = 0, ok = false; r < 20 && !ok; r += 1) for (let k = 0; k < 16 && !ok; k++) { const a = x0 + Math.cos(k / 16 * TAU) * r, b = z0 + Math.sin(k / 16 * TAU) * r; if (!bloque(a, b, 0.9)) { x = a; z = b; ok = true; } }
  const y = sol(x, z), T = { o: null, decor, x, y, z };
  A5.aFaire.push(() => { T.o = personne5(role, x, y, z, Math.atan2(vers[0] - x, vers[1] - z)); if (T.o) T.o.visible = false; });
  if (decor) { decor.visible = false; decor.userData.dynamic = true; }
  A5.surSonnaille.push((ep, p) => { const pres = Math.hypot(p.x - x, p.z - z) < 40, vu = ep === 'passe' && pres; if (T.o) T.o.visible = vu; if (decor) decor.visible = vu; });
  addInteract({ pos: new THREE.Vector3(x, y, z), r: 3, prompt: () => 'parler', enabled: () => passeVu() && atteint5('sonnaille'), fn: () => dialogue(repl5(qui)) });
  (A5.temoins = A5.temoins || {})[qui] = [x, y, z];
  return T;
}
// le décor de 1870 : une pile de rails et de traverses, une brouette
function chantier1870(x, y, z, a) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = a; scene.add(g);
  const bois = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x5a4636 }), fer = phMat('metal_plate_02', 1, 1, { color: 0x5a5450, metalness: 0.6, roughness: 0.5 });
  for (let k = 0; k < 6; k++) g.add(posee(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.24), bois), 0, 0.07 + Math.floor(k / 3) * 0.15, -0.6 + (k % 3) * 0.6));
  for (let k = 0; k < 4; k++) g.add(posee(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 5), fer), -1.6 + k * 0.12, 0.06, 2.6));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// le décor de 1765 : les claies d'un parc à moutons, au bois
function claies1765(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const bois = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x6a5642 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.06), bois); m.position.set(Math.cos(a) * 3, 0.45, Math.sin(a) * 3); m.rotation.y = -a + Math.PI / 2; g.add(m); }
  return g;
}

// ---- La tour de la Garde-Guérin (étape 5) : la porte d'autrefois, trois salles ----
// Comme les caves de l'Aveyron : les salles sont bâties très haut au-dessus du plateau, cachées, et
// n'ont de sol et de murs que pendant qu'on y est. Chaque salle a sa ruine (le présent) et son
// état d'autrefois (le passé) : la sonnaille change l'une en l'autre ; l'escalier qui monte à la
// suivante n'existe qu'au passé.
const Y5 = 700;
const SALLES = [];
function salle5(i, cx, cz) {
  const w = 8, d = 8, h = 4, y = Y5 + i * 12, g = new THREE.Group(); g.position.set(cx, y, cz); g.visible = false; g.userData.dynamic = true; scene.add(g);
  const pierre = phMat('granit_lozere', 1, 1, { color: 0x9a968c }), sol = phMat('granite_tile_03', 1, 1, { color: 0xa09a8e });
  const boite = (W, H, D, m, x, yy, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), m); o.position.set(x, yy, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  for (const [x, z, W, D] of [[0, -d / 2, w, 0.5], [0, d / 2, w, 0.5], [-w / 2, 0, 0.5, d], [w / 2, 0, 0.5, d]]) boite(W, h, D, pierre, x, h / 2, z);
  boite(w, 0.3, d, sol, 0, -0.15, 0); boite(w, 0.3, d, pierre, 0, h + 0.15, 0);
  // le présent : un trou dans le plancher du fond, l'escalier coupé, des gravats ; le passé : la dalle
  // entière et l'escalier de bois jusqu'à la trappe
  const ruine = new THREE.Group(), jadis = new THREE.Group(); g.add(ruine, jadis); jadis.visible = false;
  for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + (k % 3) * 0.12, 0), pierre); r.position.set(-2 + k * 0.6, 0.2, -2.6 + (k % 2) * 0.5); ruine.add(r); }
  const bois = phMat('wood_planks', 1, 1, { color: 0x7a5a3a });
  for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.4), bois); m.position.set(2.8, 0.3 + k * 0.48, 2.6 - k * 0.6); jadis.add(m); }
  for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.4), bois); m.position.set(2.8, 0.3 + k * 0.48, 2.6 - k * 0.6); ruine.add(m); }
  const S = { i, g, x: cx, z: cz, y, w, d, h, ruine, jadis, phys: [], obst: [] };
  SALLES.push(S); return S;
}
function physSalle(S, on) {
  if (!on) { for (const p of S.phys) { const a = world.boxes.indexOf(p), b = world.capsules.indexOf(p); if (a >= 0) world.boxes.splice(a, 1); if (b >= 0) world.capsules.splice(b, 1); } S.phys = []; indexCapsules(); return; }
  S.phys = [addBox(S.x - S.w / 2 - 3, S.x + S.w / 2 + 3, S.z - S.d / 2 - 3, S.z + S.d / 2 + 3, S.y)];
  const e = 0.3, x0 = S.x - S.w / 2 + e, x1 = S.x + S.w / 2 - e, z0 = S.z - S.d / 2 + e, z1 = S.z + S.d / 2 - e;
  for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) { const c = addCap(ax, az, bx, bz, 0.25, S.y + S.h); c.bottom = S.y - 1; S.phys.push(c); }
}
function entrerSalle(S, lx, lz) {
  if (A5.salle) { physSalle(A5.salle, false); A5.salle.g.visible = false; }
  physSalle(S, true); S.g.visible = true; A5.salle = S; montrerEpoque(A5.sonne);
  player.pos.set(S.x + lx, S.y + 0.02, S.z + lz); player.vy = 0;
  G.camMaxY = S.y + S.h - 0.3; G.camBack = 3.6; G.camUp = 1.9;
}
function sortirTour() {
  const S = A5.salle; if (!S) return; physSalle(S, false); S.g.visible = false; A5.salle = null;
  const [x, z] = A5.porteTour; player.pos.set(x, A5.ctx.hauteur(x, z) + 0.05, z); player.vy = 0; G.camMaxY = Infinity; G.camBack = 7; G.camUp = 3.4;
  for (const e of A5.loups1765 || []) if (!e.dead) { e.dead = true; e.hp = 0; e.mesh.visible = false; if (e.bar) e.bar.visible = false; }
  A5.loups1765 = null;
}
function montrerEpoque(ep) { const S = A5.salle; if (!S) return; S.ruine.visible = ep !== 'passe'; S.jadis.visible = ep === 'passe'; }

// les loups de 1765 : des bêtes ordinaires, qui fuient la sonnaille
BETES.loup1765 = { fichier: 'loup.glb', haut: 1.3, teintes: { M_Wolf: 0x5a5048 } };
Object.assign(KINDS, { loup1765: { hp: 3, speed: 6.2, dmg: 1, range: 1.6, aggro: 14, windup: 0.4, cd: 1.3, fly: 0, r: 0.6, label: 'Loup de 1765', barY: 1.4 } });
let modeleLoup = null;
setMaker('loup1765', () => { const g = modeleLoup ? modeleLoup.S.clone(modeleLoup.g.scene) : new THREE.Group(); if (modeleLoup) g.scale.setScalar(modeleLoup.echelle * G.echelle); g.userData.anim = true;
  if (modeleLoup) { const mix = new THREE.AnimationMixer(g), a = modeleLoup.g.animations.find((k) => /Walk/.test(k.name)); if (a) mix.clipAction(a).play(); g.userData.mix = mix; } return g; });
setAnimHook('loup1765', (e, dt) => { if (e.mesh.userData.mix) e.mesh.userData.mix.update(dt); return true; });
A5.surSonnaille.push(() => { for (const e of A5.loups1765 || []) if (!e.dead) { e.dead = true; e.hp = 0; e.mesh.visible = false; if (e.bar) e.bar.visible = false; } if ((A5.loups1765 || []).length) showMessage('Les loups de 1765 fuient la sonnaille de la brebis de tête.', 3); });
A5.surSonnaille.push((ep) => montrerEpoque(ep));

function acte5Garde(ctx) {
  if (EN_INSTANCE) return;
  A5.ctx = ctx; A5.lieu = 'gardeguerin'; A5.sol = (x, z) => (FICHES.gardeguerin._sol(x, z) ?? ctx.hauteur(x, z));
  // le chevalier, au péage : à l'entrée du village, où arrive la Régordane
  temoinDuPasse(ctx, 'a5_chevalier', 'chevalier', 1846, -5250, [1852, -5236]);
  // la tour : sa face nord (vers le village), la porte murée au présent, ouverte au passé
  const t = BILAN.corps.find((c) => c.sp.tour), [tx, tz] = t ? [t.cx, t.cz] : [1830, -5378];
  const px = 1831, pz = -5373.6, y = ctx.hauteur(px, pz), porte = new THREE.Group(); porte.position.set(px, y, pz); porte.rotation.y = Math.atan2(px - tx, pz - tz); scene.add(porte); porte.userData.dynamic = true;
  const murage = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.3), phMat('rustic_stone_wall_02', 1.6, 2.4, { color: 0x8a8478 })); murage.position.y = 1.2; porte.add(murage);
  const ouverte = new THREE.Group(); porte.add(ouverte); ouverte.visible = false;
  ouverte.add(posee(new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 0.05), new THREE.MeshBasicMaterial({ color: 0x0a0806 })), 0, 1.15, 0.12));
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.18, 6, 14, Math.PI), phMat('granit_lozere', 1, 1, { color: 0xb0aea6 })); arc.position.set(0, 2.3, 0.2); ouverte.add(arc);
  A5.surSonnaille.push((ep, p) => { const pres = Math.hypot(p.x - px, p.z - pz) < 30; murage.visible = !(ep === 'passe' && pres); ouverte.visible = !murage.visible; });
  const [ax, az] = [px + Math.sin(porte.rotation.y) * 2, pz + Math.cos(porte.rotation.y) * 2]; A5.porteTour = [ax, az];
  { const libre = (x, z) => { for (let a = -7; a <= 7; a += 3.5) for (let b = -7; b <= 7; b += 3.5) if (ctx.bloque(x + a, z + b, 0.5)) return false; return true; }, pris = [];
    for (let r = 0; r < 200 && pris.length < 3; r += 6) for (let k = 0; k < 24 && pris.length < 3; k++) { const x = 1760 + Math.cos(k / 24 * TAU) * r, z = -5300 + Math.sin(k / 24 * TAU) * r;
      if (libre(x, z) && pris.every(([a, b]) => Math.hypot(a - x, b - z) > 20)) pris.push([x, z]); }
    pris.forEach(([x, z], i) => salle5(i, x, z)); }
  ctx.addInteract({ pos: new THREE.Vector3(px, y, pz), r: 3, enabled: () => atteint5('sonnaille') && !A5.salle,
    prompt: () => (passeVu() ? 'entrer dans la tour' : 'la porte de la tour'),
    fn: () => { if (!passeVu()) { showMessage(sait5('comment') ? 'La porte est murée. Du temps des chevaliers, elle était là, ouverte.' : 'Une porte murée depuis des siècles, au pied de la tour.', 5); return; }
      entrerSalle(SALLES[0], 0, 3); showMessage('Au présent, la tour est en ruine. Au passé, elle est debout. Sonne pour passer.', 5); } });
  // dans la tour : monter (au passé seulement), sortir
  SALLES.forEach((S, i) => {
    ctx.addInteract({ pos: new THREE.Vector3(S.x + 2.8, S.y, S.z - 1.6), r: 2.4, enabled: () => A5.salle === S && i < 2,
      prompt: () => (passeVu() ? 'monter l’escalier' : 'l’escalier effondré'),
      fn: () => { if (!passeVu()) { showMessage('L’escalier s’arrête à hauteur d’homme. Au-dessus, le vide.', 3); return; }
        entrerSalle(SALLES[i + 1], 0, 3); if (i + 1 === 1 && !A5.loups1765) poserLoups1765(SALLES[1]); if (i + 1 === 2) chambreDuLoup(); } });
    ctx.addInteract({ pos: new THREE.Vector3(S.x, S.y, S.z + 3.4), r: 1.8, enabled: () => A5.salle === S, prompt: () => 'redescendre et sortir', fn: sortirTour });
  });
  // la chambre du loup, en haut : sa litière, les griffes dans la pierre
  { const S = SALLES[2], paille = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 20), phMat('withered_grass', 2, 2, { color: 0xc8b070 })); paille.position.set(0, 0.15, -1.5); S.g.add(paille);
    for (let k = 0; k < 4; k++) { const gr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.02), new THREE.MeshBasicMaterial({ color: 0x1a1612 })); gr.position.set(-1 + k * 0.25, 2, -3.7); gr.rotation.z = 0.3; S.g.add(gr); } }
  chargerBete('loup1765').then((m) => { modeleLoup = m; });
  acte5Loup(ctx);
  tourParLeDehors(ctx); estive(ctx);
}
function poserLoups1765(S) {
  A5.loups1765 = [[-2, -2], [2, -2.5], [0, -3]].map(([lx, lz]) => { const e = spawnEnemy('loup1765', S.x + lx, S.z + lz, 'acte5', S.y); e.home.y = S.y; return e; });
  showMessage('Des loups ! De 1765. Ils craignent la sonnaille de la brebis de tête.', 4);
}
function chambreDuLoup() {
  dialogue([{ who: '', text: 'Une litière de paille, grande comme une étable. Des griffes dans la pierre. Il est sorti.' }], () => { passer5('tour'); showMessage('Dehors, la nuit tombe sur le plateau.', 5); });
}

// ---- Le loup (étape 6) et la fin (étape 7), sur le plateau de la Garde-Guérin, la nuit ----
// La nuit : on baisse l'exposition et la lumière (comme la nuit des Pouilles : changer la carte
// d'environnement recompilerait tout) ; le jour revient quand le loup dort.
REPLIQUES5.berger.push(['tour', () => R5('Le berger', 'Je ne peux pas regarder. Fais vite.')]);
REPLIQUES5.berger.push(['course', () => R5('Le berger', 'Il a gardé mes bêtes toute ma vie. Garde les tiennes. Ce que tu as commencé…')]);
function nuit5(on) {
  if (A5.nuit === on) return; A5.nuit = on;
  if (on) { A5.jour = { expo: renderer.toneMappingExposure, sun: sun.intensity, hemi: hemi.intensity, brume: scene.fog ? scene.fog.color.getHex() : null };
    renderer.toneMappingExposure = A5.jour.expo * 0.42; sun.intensity = A5.jour.sun * 0.25; sun.color.setHex(0xa8b8e8); hemi.intensity = A5.jour.hemi * 0.6; hemi.color.setHex(0x6a7aa8);
    if (scene.fog) scene.fog.color.setHex(0x1a2234); }
  else if (A5.jour) { renderer.toneMappingExposure = A5.jour.expo; sun.intensity = A5.jour.sun; sun.color.setHex(0xfff0d8); hemi.intensity = A5.jour.hemi; hemi.color.setHex(0xd8e4f4); if (scene.fog && A5.jour.brume != null) scene.fog.color.setHex(A5.jour.brume); }
}
// le loup : loup.glb grand comme une grange ; il passe d'une époque à l'autre — une seconde ici, une
// seconde ailleurs (figé, intouchable : e.caged) ; un coup de sonnaille le tient au présent cinq
// secondes. On frappe le morceau planté dans son épaule.
BETES.loupGeant = { fichier: 'loup.glb', haut: 4,   // (6,6 m mesurés : une grange ; à 7, il en faisait 11,5)
  teintes: { M_Wolf: 0x4a4440 } };
Object.assign(KINDS, { loupGeant: { hp: 8, speed: 5.5, dmg: 2, range: 4.2, aggro: 60, windup: 0.7, cd: 1.6, fly: 0, r: 2.2, label: 'Le loup de Lozère', boss: true, barY: 5 } });
let modeleGeant = null;
setMaker('loupGeant', () => { const g = modeleGeant ? modeleGeant.S.clone(modeleGeant.g.scene) : new THREE.Group(); if (modeleGeant) g.scale.setScalar(modeleGeant.echelle * G.echelle); g.userData.anim = true;
  g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.castShadow = true; } });
  // le morceau de cloche dans l'épaule : un éclat de bronze qui luit
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.5, 10, 1, true, 0, 1.2), new THREE.MeshStandardMaterial({ color: 0x8a6a34, metalness: 0.8, roughness: 0.4, emissive: 0x3a2008, side: THREE.DoubleSide }));
  m.position.set(0.6, 3.4, 1.4); m.rotation.set(0.6, 0.2, 0.8); g.add(m); g.userData.morceau = m;
  if (modeleGeant) { const mix = new THREE.AnimationMixer(g), a = modeleGeant.g.animations.find((k) => /Walk/.test(k.name)), h = modeleGeant.g.animations.find((k) => /Howl/.test(k.name)); if (a) mix.clipAction(a).play(); g.userData.mix = mix; g.userData.hurle = h ? mix.clipAction(h) : null; }
  return g; });
setAnimHook('loupGeant', (e, dt) => { if (e.mesh.userData.mix) e.mesh.userData.mix.update(e.caged ? 0 : dt); return true; });
A5.surSonnaille.push((ep) => { if (ep === 'present' && A5.loup && !A5.loup.dead) { A5.presentJusqua = performance.now() + 5000; showMessage('La sonnaille ! Le loup est tenu au présent. Frappe le morceau dans son épaule.', 3); } });
function plateau(ctx) {
  // une place ouverte sur le plateau, à l'est de l'enceinte, au-dessus des gorges du Chassezac
  const libre = (x, z) => { for (let a = -12; a <= 12; a += 4) for (let b = -12; b <= 12; b += 4) if (ctx.bloque(x + a, z + b, 0.8)) return false; return true; };
  for (let r = 0; r < 220; r += 6) for (let k = 0; k < 24; k++) { const x = 1880 + Math.cos(k / 24 * TAU) * r, z = -5320 + Math.sin(k / 24 * TAU) * r; if (libre(x, z)) return [x, z]; }
  return [1880, -5320];
}
function acte5Loup(ctx) {
  if (EN_INSTANCE) return;
  const [px, pz] = A5.plateau = plateau(ctx), sol = A5.sol;
  chargerBete('loupGeant').then((m) => { modeleGeant = m; });
  // le berger et son chien, à la lisière, à 22 m : il ne peut pas regarder
  const bx = px - 22, bz = pz + 6;
  ctx.addInteract({ pos: new THREE.Vector3(bx, sol(bx, bz), bz), r: 2.8, prompt: () => 'parler au berger', enabled: () => atteint5('tour'), fn: () => dialogue(repl5('berger')) });
  A5.bergerPlateau = [bx, bz];
  // (ils montent quand l'étape « tour » est atteinte — dans la partie, ou rechargée : animeLoup)
}
function animeLoup(dt) {
  if (A5.lieu !== 'gardeguerin' || !A5.plateau) return;
  // la nuit, de la tour jusqu'à la course
  nuit5(atteint5('tour') && !atteint5('course') && !A5.salle);
  if (!atteint5('tour') || atteint5('course')) return;
  if (!A5.bergerPose) { A5.bergerPose = true; const [bx, bz] = A5.bergerPlateau, sol = A5.sol;
    A5.gens.bergerPlateau = personne5('a5_berger', bx, sol(bx, bz), bz, Math.atan2(-1, 0)); poserChien(bx + 1.2, sol(bx + 1.2, bz), bz + 0.8, 0).then((c) => { A5.chien = c; A5.chienRepos = true; }); }
  const [px, pz] = A5.plateau, p = player.pos;
  // le loup sort quand Camille arrive sur le plateau (et que le modèle est là)
  if (!A5.loup && modeleGeant && Math.hypot(p.x - px, p.z - pz) < 45) {
    A5.loup = spawnEnemy('loupGeant', px + 8, pz - 8, 'acte5'); A5.loup.yaw = Math.atan2(p.x - px, p.z - pz); A5.bascule = 0; passer5('loup');
    showMessage('Le loup. Grand comme une grange. Il est là… et il n’est plus là.', 4);
  }
  const L = A5.loup; if (!L) return;
  if (L.dead && !A5.fini) { A5.fini = true; finActe5(); return; }
  if (L.dead) return;
  // une seconde ici, une seconde ailleurs — sauf tenu au présent par la sonnaille
  const tenu = performance.now() < (A5.presentJusqua || 0);
  A5.bascule += dt; const ailleurs = !tenu && Math.floor(A5.bascule) % 2 === 1;
  L.caged = ailleurs;
  L.mesh.traverse((o) => { if (o.isMesh && o.material) o.material.opacity = ailleurs ? 0.18 : 1; });
}
function finActe5() {
  const [bx, bz] = A5.bergerPlateau, sol = A5.sol;
  // le loup endormi, couché près du berger : le même modèle, à terre, la tête vers lui
  const m = modeleGeant ? modeleGeant.S.clone(modeleGeant.g.scene) : null;
  if (m) { m.scale.setScalar(modeleGeant.echelle * G.echelle * 0.9); m.position.set(bx + 6, sol(bx + 6, bz) - 0.6, bz); m.rotation.set(0, -Math.PI / 2, 0.25); scene.add(m); A5.dort = m; }
  dialogue([
    { who: '', text: 'Le morceau de cloche sort de l’épaule. Le loup vient poser la tête sur les genoux du berger. Il ne bouge plus.' },
    { who: '', text: 'Il te donne **sa course**. Puis il s’endort sous la montagne.' },
    { who: 'Le berger', text: 'Il a gardé mes bêtes toute ma vie. Garde les tiennes. Ce que tu as commencé…' },
  ], () => {
    state.course = true; passer5('course'); saveGame(true); SFX.win && SFX.win();
    clocheTroupeaux();
    showMessage('Au sommet de la tour, la Cloche des Troupeaux. Les époques se séparent : le présent, partout.', 7);
  });
}
// la Cloche des Troupeaux : une sonnaille géante (tôle rivée en tronc de pyramide, DECISIONS-RECIT.md
// § 2) au sommet de la tour, et le vers gravé dessous
function clocheTroupeaux() {
  if (A5.cloche) return;
  const t = BILAN.corps.find((c) => c.sp.tour), x = t ? t.cx : 1830, z = t ? t.cz : -5378, y = t ? t.avt : A5.ctx.hauteur(x, z) + 21;
  const g = new THREE.Group(); g.position.set(x, y + 1.2, z); scene.add(g); g.userData.dynamic = true;
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 1.5, 4, 1, true), phMat('metal_plate_02', 1, 1, { color: 0x8a6a3a, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
  s.rotation.y = Math.PI / 4; s.position.y = 0.75; s.castShadow = true; g.add(s);
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const k = c.getContext('2d'); k.fillStyle = '#b9b1a2'; k.fillRect(0, 0, 512, 128);
  k.fillStyle = 'rgba(40,32,24,0.92)'; k.font = 'italic bold 22px Georgia, serif'; k.textAlign = 'center';
  k.fillText('Toutes les heures seront mêlées,', 256, 52); k.fillText('et la dernière sera la sienne.', 256, 88);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 })); p.position.set(0, -0.6, 0.8); g.add(p);
  A5.cloche = g;
}

// =====================================================================
//  LES RESTES DE LA LOZÈRE (consigne E4 ; docs/DECOUPAGE-ACTE5.md, « Les restes »)
// =====================================================================
// Après l'acte V (state.acte5 === 'course'), jamais à sa place. L'avancement : state.transh (0 rien,
// 1 le troupeau en route, 2 à l'estive, 3 le berger a donné le lasso), state.lasso, state.sonnailleForte.

// ---- Le lasso (Eugène, 7 octobre : « le berger », la corde des brebis tombées) ----
// Il s'accroche à ce qui est fait pour : des anneaux de fer scellés, visibles de loin. Devant l'un d'eux,
// à portée, Camille lance, la corde file, et elle se hisse (ou se laisse descendre) jusqu'à lui. Le geste
// vit ici ; l'acte VI en aura besoin : demande pour la passe D3 de le monter dans le moteur.
const fer = () => new THREE.MeshStandardMaterial({ color: 0x4a4644, metalness: 0.85, roughness: 0.35 });
function anneauDeFer(x, y, z, yaw = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; scene.add(g);
  const a = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 18), fer()); a.position.z = 0.1; g.add(a);
  const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), fer()); tige.rotation.x = Math.PI / 2; g.add(tige);   // scellée dans la pierre
  return g;
}
// la corde, tendue entre Camille et l'anneau pendant qu'elle monte ou descend
let corde = null;
function tendreCorde(a, b) {
  if (!corde) { corde = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 0.9 })); corde.userData.dynamic = true; scene.add(corde); }
  const d = b.clone().sub(a), L = d.length(); corde.visible = true;
  corde.position.copy(a).addScaledVector(d, 0.5); corde.scale.set(1, L, 1);
  corde.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
// se hisser (ou descendre) jusqu'à `vers` ; `ancre` : l'anneau, où la corde est nouée
function lasso(vers, ancre, msg) {
  if (A5.hisse) return;
  if (!state.lasso) { showMessage('Un anneau de fer, là-haut. Il faudrait une corde à lancer.', 3.5); return; }
  A5.hisse = { de: player.pos.clone(), vers: new THREE.Vector3(...vers), ancre: new THREE.Vector3(...ancre), t: 0 };
  A5.hisse.dur = Math.min(2.4, Math.max(1.2, A5.hisse.de.distanceTo(A5.hisse.vers) / 12));
  SFX.roll && SFX.roll(); if (msg) showMessage(msg, 2.5);
}
function animeLasso(dt) {
  const H = A5.hisse; if (!H) return;
  H.t = Math.min(1, H.t + dt / H.dur); const u = H.t * H.t * (3 - 2 * H.t);
  player.pos.lerpVectors(H.de, H.vers, u); player.vy = 0; player.fallFrom = player.pos.y; player.onGround = true;
  tendreCorde(player.pos.clone().setY(player.pos.y + 0.9), H.ancre);
  if (H.t >= 1) { A5.hisse = null; if (corde) corde.visible = false; }
}

// ---- La tour par le dehors (R5) : l'anneau du sommet, et la tyrolienne vers Villefort (la poulie) ----
// Le sommet de la tour (BILAN.corps, `avt`) reçoit un plancher du moteur (addBox) : on y tient debout,
// au milieu ; ses murs (inscrits par le lieu) empêchent d'y marcher — on n'y fait que deux choses :
// redescendre au lasso, ou prendre le câble. Le câble descend vers Villefort (on ne glisse que vers le
// bas : du sommet, 900 m environ, vers les gorges) ; au bout de quelques secondes, un fondu, Villefort
// (Eugène, 7 octobre : « la glisse, un fondu, Villefort »).
function tourParLeDehors(ctx) {
  const t = BILAN.corps.find((c) => c.sp.tour); if (!t || !A5.porteTour) return;
  const { hauteur } = ctx, x = t.cx, z = t.cz, y = t.avt;
  A5.sommet = [x, y, z];
  addBox(x - 2.2, x + 2.2, z - 2.2, z + 2.2, y);
  // l'anneau, scellé au parapet du côté du village (au-dessus de la porte), et sa lueur de métal
  const [px, pz] = A5.porteTour, a = Math.atan2(px - x, pz - z), ax = x + Math.sin(a) * 2.4, az = z + Math.cos(a) * 2.4;
  anneauDeFer(ax, y + 0.4, az, a);
  ctx.addInteract({ pos: new THREE.Vector3(px, hauteur(px, pz), pz), r: 5, enabled: () => !A5.salle && !A5.hisse && player.pos.y < y - 3,
    prompt: () => (state.lasso ? 'lancer le lasso au sommet de la tour' : 'l’anneau du sommet'),
    fn: () => lasso([x, y + 0.05, z], [ax, y + 0.4, az], 'La corde s’enroule autour de l’anneau. Tu te hisses le long du mur.') });
  ctx.addInteract({ pos: new THREE.Vector3(x, y, z), r: 3, enabled: () => !A5.hisse && player.pos.y > y - 1, prompt: () => 'redescendre au lasso',
    fn: () => lasso([px, hauteur(px, pz) + 0.05, pz], [ax, y + 0.4, az]) });
  // le câble : vers Villefort (le nord), jusqu'au premier point 40 m plus bas que le sommet
  const vx = 1582 - x, vz = -1132 - z, n = Math.hypot(vx, vz), ux = vx / n, uz = vz / n;
  let fin = null; for (let d = 120; d < 560 && !fin; d += 20) { const ex = x + ux * d, ez = z + uz * d; if (hauteur(ex, ez) < y - 40) fin = [ex, ez]; }
  if (!fin) fin = [x + ux * 400, z + uz * 400];
  const y1 = Math.min(hauteur(...fin) + 3, y - 30);
  if (!(y1 < y - 2)) return;                        // la règle : on ne glisse que vers le bas
  const p0 = new THREE.Vector3(x + ux * 1.5, y + 3.4, z + uz * 1.5), p1 = new THREE.Vector3(fin[0], y1, fin[1]), fl = p0.distanceTo(p1) * 0.02;
  const point = (t) => new THREE.Vector3(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t - fl * 4 * t * (1 - t), p0.z + (p1.z - p0.z) * t);
  const pts = []; for (let k = 0; k <= 40; k++) pts.push(point(k / 40));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.04, 5), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: 0.7, roughness: 0.45 })));
  { const bois = phMat('wood_cabinet_worn_long', 0.3, 2, { color: 0x7a6650 }), g = new THREE.Group(); g.position.set(p0.x, y, p0.z); scene.add(g);
    g.add(posee(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.6, 7), bois), 0, 1.8, 0)); }
  A5.cable = { point, dur: 6 };
  ctx.addInteract({ pos: new THREE.Vector3(x, y, z), r: 3, enabled: () => !A5.hisse && !A5.glisse && player.pos.y > y - 1,
    prompt: () => 'glisser vers Villefort, sur le câble',
    fn: () => { if (!state.poulie) { showMessage('Un câble part du sommet, vers Villefort. Et rien pour s’y accrocher.', 3.5); return; }
      A5.glisse = { t: 0 }; showMessage('La poulie des moines file sur le câble, au-dessus des gorges…', 3); SFX.roll && SFX.roll(); } });
}
function animeGlisse5(dt) {
  const Gl = A5.glisse, C = A5.cable; if (!Gl || !C) return;
  Gl.t = Math.min(1, Gl.t + dt / C.dur); const q = C.point(Gl.t * Gl.t * (3 - 2 * Gl.t) * 0.85);
  player.pos.set(q.x, q.y - 2.1, q.z); player.vy = 0; player.fallFrom = player.pos.y; player.onGround = true;
  if (Gl.t >= 1 && !Gl.fini) { Gl.fini = true; goToLevel('villefort', ARRIVEES.villefort.pos, ARRIVEES.villefort.yaw, 'Le câble plonge vers la vallée. Villefort, en bas.'); }
}

// ---- La transhumance (Q2) : mener le troupeau du berger à l'estive, sur le plateau de la Garde-Guérin ----
// Les brebis suivent Camille (la sonnaille) d'un lieu à l'autre : chaque lieu les fait renaître tant que
// le troupeau est en route (state.transh === 1). À l'enclos d'estive, elles restent.
const TROUPEAU = { n: 6, betes: [], estive: null };
A5.troupeau = TROUPEAU;                // (pour les bancs)
async function poserTroupeau(cx, cz, autour = true) {
  const { modeleBrebis } = await import('./pouget-enclos.js'), mod = await modeleBrebis(); if (!mod) return;
  for (let k = 0; k < TROUPEAU.n; k++) { const m = new THREE.Mesh(mod.geo, mod.mat); m.castShadow = true; m.userData.dynamic = true;
    const a = k / TROUPEAU.n * TAU, r = autour ? 3 + (k % 2) * 1.5 : 1.5 + k * 0.8; m.position.set(cx + Math.cos(a) * r, A5.sol ? A5.sol(cx, cz) : 0, cz + Math.sin(a) * r); scene.add(m);
    TROUPEAU.betes.push({ m, off: [Math.cos(a) * (2.5 + k * 0.6), Math.sin(a) * (2.5 + k * 0.6)], ph: rand(0, TAU) }); }
}
function animeTroupeau(dt) {
  if (!TROUPEAU.betes.length || !A5.sol) return;
  const suit = state.transh === 1, p = player.pos, t = performance.now() / 1000;
  for (const B of TROUPEAU.betes) { const o = B.m.position;
    if (suit) { const tx = p.x - 3 + B.off[0], tz = p.z - 3 + B.off[1], dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
      if (d > 50) { o.x = tx; o.z = tz; } else if (d > 0.6) { const v = Math.min(d, (d > 6 ? 7 : 3.5) * dt); o.x += dx / d * v; o.z += dz / d * v; B.m.rotation.y = Math.atan2(dx, dz); } }
    o.y = A5.sol(o.x, o.z) - 0.03 + (suit ? Math.abs(Math.sin(t * 7 + B.ph)) * 0.05 : 0); }
  // l'enclos d'estive : le troupeau y entre (la moitié des bêtes à moins de 9 m), et y reste
  const E = TROUPEAU.estive;
  if (suit && E && TROUPEAU.betes.filter((B) => Math.hypot(B.m.position.x - E[0], B.m.position.z - E[1]) < 9).length >= TROUPEAU.n / 2) {
    state.transh = 2; saveGame(true); SFX.win && SFX.win();
    TROUPEAU.betes.forEach((B, k) => { const a = k / TROUPEAU.n * TAU; B.m.position.set(E[0] + Math.cos(a) * 3, B.m.position.y, E[1] + Math.sin(a) * 3); });
    showMessage('Les brebis passent la claie et se mettent à brouter. L’estive. Le berger t’attend au Pouget.', 6);
  }
}
// l'enclos d'estive, sur le plateau, à côté de la place du loup ; le troupeau qui y est
function estive(ctx) {
  const [px, pz] = A5.plateau || plateau(ctx), x = px + 28, z = pz - 12, y = A5.sol(x, z);
  TROUPEAU.estive = [x, z];
  // l'enclos : un cercle de claies de 7 m, ouvert vers le village (deux claies manquent)
  { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const bois = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x6a5642 });
    for (let k = 0; k < 18; k++) { if (k === 8 || k === 9) continue; const a = k / 18 * TAU, m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 0.07), bois);
      m.position.set(Math.cos(a) * 7, 0.47 + (A5.sol(x + Math.cos(a) * 7, z + Math.sin(a) * 7) - y), Math.sin(a) * 7); m.rotation.y = -a + Math.PI / 2; m.castShadow = true; g.add(m); } }
  // (après le chargement de la sauvegarde : au moment où le lieu se bâtit, state.transh n'est pas encore lu)
  A5.apres.push(() => { if (state.transh === 1) poserTroupeau(player.pos.x, player.pos.z); else if (state.transh >= 2) poserTroupeau(x, z); });
}
// le berger, après l'acte : la transhumance, puis la corde
function parlerBerger() {
  if (!atteint5('course')) return dialogue(repl5('berger'));
  const B = 'Le berger';
  if (!state.transh) return dialogue([
    { who: B, text: 'Il a gardé mes bêtes toute ma vie. Garde les tiennes. Ce que tu as commencé…' },
    { who: B, text: 'Il reste un troupeau à monter à l’estive, et mes jambes ne veulent plus. **Mène-les au plateau de la Garde-Guérin.** Elles suivront la sonnaille.',
      fn: () => { state.transh = 1; saveGame(true); noter5('transhumance'); poserTroupeau(player.pos.x, player.pos.z); } }]);
  if (state.transh === 1) return dialogue([{ who: B, text: 'Par les vieux chemins, jusqu’au plateau de la Garde-Guérin. Il y a un enclos de claies, au-dessus des gorges.' }]);
  if (state.transh === 2) return dialogue([
    { who: B, text: 'Elles y sont ? Alors tiens : **la corde des brebis tombées.** Dans les gorges, c’est elle qui les remonte. Lance-la sur un anneau, et tiens bon.' },
    { who: B, text: 'Et ta sonnaille : je lui ai mis un battant de plus. **Le passé tiendra plus longtemps.**',
      fn: () => { state.transh = 3; state.lasso = true; state.sonnailleForte = true; saveGame(true); SFX.fanfare && SFX.fanfare(); showMessage('LE LASSO : devant un anneau de fer, lance-le.', 5); } }]);
  return dialogue([{ who: B, text: 'Ici, il n’y a qu’un temps. Grâce à lui.' }]);
}

// ---- Le lac de Villefort (R3, R4, R6) ----
// R3, la vallée d'avant : deux coups au bord, et le lac (monde.js) disparaît le temps du passé ; son eau
// profonde ne bloque plus (on vide sa grille le temps du passé, on la rend au présent) ; au fond, les
// murets et le pont de pierre d'avant le barrage. R4, le viaduc : au passé, en construction (échafaudages,
// ouvriers). R6, la via ferrata : des anneaux (le lasso) et sa tyrolienne (la poulie), un cœur au bout.
function acteLac(ctx, lacs) {
  if (EN_INSTANCE) return;
  A5.ctx = ctx; A5.lieu = 'lac'; A5.sol = (x, z) => (FICHES.lac._sol(x, z) ?? ctx.hauteur(x, z));
  const { hauteur, addInteract } = ctx, sol = A5.sol;
  const pierre = phMat('granit_lozere', 1, 1, { color: 0x8a8478 }), bois = phMat('wood_planks', 1, 1, { color: 0x7a5a3a });
  // le fond d'autrefois : le vieux chemin et son pont de pierre, des murets de terrasses (sous l'eau d'aujourd'hui)
  const avant = new THREE.Group(); avant.visible = false; avant.userData.dynamic = true; scene.add(avant);
  const L = lacs[0];
  if (L) {
    const fond = (x, z) => hauteur(x, z) - 0.05;
    // le pont : deux piles et un tablier, en travers du bras (de la rive sud vers le nord), là où le lac
    // est le plus étroit dans le lieu
    const px = 40, pz = -1985;
    for (const dz of [-6, 6]) avant.add(posee(new THREE.Mesh(new THREE.BoxGeometry(2.2, 6, 2.2), pierre), px, fond(px, pz + dz) + 2.4, pz + dz));
    avant.add(posee(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 16), pierre), px, fond(px, pz) + 5.1, pz));
    for (let k = 0; k < 9; k++) { const x = -60 + k * 22, z = -2005 + Math.sin(k) * 6; avant.add(posee(new THREE.Mesh(new THREE.BoxGeometry(8, 0.9, 0.6), pierre), x, fond(x, z) + 0.45, z)); }
    avant.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  A5.surSonnaille.push((ep, p) => {
    const passe = ep === 'passe' && (A5.lieu === 'lac');
    avant.visible = passe;
    for (const l of (G.level && G.level.lacs) || []) {
      l.mesh.visible = !passe;
      if (passe && !l.profondAvant) { l.profondAvant = l.profond.slice(); l.profond.fill(0); }
      else if (!passe && l.profondAvant) { l.profond.set(l.profondAvant); l.profondAvant = null; }
    }
    if (passe && !A5.valleeVue) { A5.valleeVue = true; showMessage('L’eau se retire. Au fond, une vallée sèche, des murets, un pont de pierre.', 5); }
    echafaudages.visible = passe;
  });
  // R4 : le viaduc en 1870 — des échafaudages de bois le long du tablier, deux ouvriers
  const echafaudages = new THREE.Group(); echafaudages.visible = false; echafaudages.userData.dynamic = true; scene.add(echafaudages);
  { const v = (ctx.PLAN.fer.voies || []).find((v) => v.pont); if (v) { const a = v.pts[0], b = v.pts[v.pts.length - 1];
      for (let k = 1; k < 8; k++) { const t = k / 8, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y0 = hauteur(x, z), y1 = (ctx.dessin || hauteur)(a[0], a[1]) + 0.4;
        for (const o of [-2.2, 2.2]) { const ux = -(b[1] - a[1]), uz = b[0] - a[0], n = Math.hypot(ux, uz); echafaudages.add(posee(new THREE.Mesh(new THREE.BoxGeometry(0.25, Math.max(1, y1 - y0), 0.25), bois), x + ux / n * o, (y0 + y1) / 2, z + uz / n * o)); }
        echafaudages.add(posee(new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 1.2), bois), x, y1 - 0.6, z)); }
      A5.viaduc = [a, b]; } }
  // R6 : la via ferrata — les anneaux des ponts de singe (le lasso, de rive à rive de la gorge) et la
  // tyrolienne (la poulie), puis un cœur au bout, sur le belvédère du haut
  const VF = [[-283, -1992, -278, -1974], [-252, -1939, -245, -1932], [-348, -1962, -367, -1969]];
  VF.forEach(([x0, z0, x1, z1], i) => {
    const y1 = sol(x1, z1); anneauDeFer(x1, y1 + 1.6, z1, Math.atan2(x0 - x1, z0 - z1));
    addInteract({ pos: new THREE.Vector3(x0, sol(x0, z0), z0), r: 4, enabled: () => !A5.hisse, prompt: () => (state.lasso ? 'lancer le lasso de l’autre côté' : 'l’anneau, de l’autre côté'),
      fn: () => lasso([x1, y1 + 0.05, z1], [x1, y1 + 1.6, z1], i === 0 ? 'La corde file au-dessus du vide. Tu passes, accrochée.' : null) });
  });
  // (la tyrolienne d'OSM relie deux points presque à la même hauteur dans le relief du jeu, 58 et 60 m :
  // elle ne descendrait dans aucun sens. On la tend au-dessus de la même gorge, du rocher du haut,
  // 64 m, au pied du pont de singe, 43 m — mesuré au banc, 7 octobre)
  { const de = [-316, -1968], a = [-367, -1969], y0 = sol(...de), y1 = sol(...a);
    if (y1 < y0 - 2) {                                // la règle : on ne glisse que vers le bas
      const p0 = new THREE.Vector3(de[0], y0 + 3.8, de[1]), p1 = new THREE.Vector3(a[0], y1 + 3.2, a[1]), fl = p0.distanceTo(p1) * 0.02;
      const point = (t) => new THREE.Vector3(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t - fl * 4 * t * (1 - t), p0.z + (p1.z - p0.z) * t);
      const pts = []; for (let k = 0; k <= 30; k++) pts.push(point(k / 30));
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 5), fer()));
      A5.cableLac = { point, dur: 3, a: [a[0], y1, a[1]] };
      addInteract({ pos: new THREE.Vector3(de[0], y0, de[1]), r: 3, enabled: () => !A5.glisseLac, prompt: () => 'la tyrolienne de la via ferrata',
        fn: () => { if (!state.poulie) return showMessage('Un câble au-dessus de la gorge, et rien pour s’y accrocher.', 3.5); A5.glisseLac = { t: 0 }; SFX.roll && SFX.roll(); } });
    } }
  // le cœur, au belvédère du haut de la via ferrata
  { const [x, z] = [-403, -1951], y = sol(x, z);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 3, enabled: () => !state.coeurFerrata, prompt: () => 'le haut de la via ferrata',
      fn: () => { state.coeurFerrata = true; player.maxHp += 2; player.hp = player.maxHp; SFX.win && SFX.win(); saveGame(true); showMessage('Tout en haut de la falaise, au-dessus du lac : un morceau de cœur. Un cœur de plus.', 5); } }); }
}
function animeGlisseLac(dt) {
  const Gl = A5.glisseLac, C = A5.cableLac; if (!Gl || !C) return;
  Gl.t = Math.min(1, Gl.t + dt / C.dur); const q = C.point(Gl.t * Gl.t * (3 - 2 * Gl.t));
  player.pos.set(q.x, q.y - 2.1, q.z); player.vy = 0; player.fallFrom = player.pos.y; player.onGround = true;
  if (Gl.t >= 1) { A5.glisseLac = null; player.pos.set(...C.a); }
}

// ---- La sonnaille (touche N) : un coup, le présent ; deux coups, le passé du lieu ----
// Deux appuis à moins de 0,45 s : deux coups. Le passé dure huit secondes autour de Camille ; les lieux
// s'y abonnent (A5.surSonnaille). L'image passe au sépia tant qu'on est dans le passé.
// (A5.surSonnaille : la liste est créée avec A5, plus haut — les témoins et la tour s'y abonnent avant ce point)
function sonnaille() {
  if (!state.sonnaille || EN_INSTANCE || !state.running || state.paused) return;
  A5.appuis.push(performance.now());
  clearTimeout(A5.attente);
  A5.attente = setTimeout(() => { const n = A5.appuis.filter((t) => performance.now() - t < 700).length >= 2 ? 2 : 1; A5.appuis = []; sonner(n); }, 460);
}
function sonner(n) {
  for (let k = 0; k < n; k++) setTimeout(() => SFX.piece && SFX.piece(), k * 260);
  A5.sonne = n === 2 ? 'passe' : 'present'; A5.sonT = n === 2 ? (state.sonnailleForte ? 12 : 8) : 0;      // 12 s : la sonnaille du berger, après la transhumance
  const cv = document.querySelector('canvas'); if (cv) cv.style.filter = n === 2 ? 'sepia(0.55) contrast(1.05)' : '';
  for (const f of A5.surSonnaille) f(A5.sonne, player.pos);
  if (n === 2 && A5.lieu === 'pouget') showMessage('Le Pouget ne change pas. Ici, il n’y a qu’un temps.', 3);
}
TOUCHES.KeyN = sonnaille;
export const passeVu = () => A5.sonne === 'passe';

// à chaque image, dans chaque lieu de l'acte
export function acte5Anime(dt) {
  if (EN_INSTANCE) return;
  if (!A5.pret && G.level && state.running) { A5.pret = true; if (!state.acte5) { state.acte5 = 'arrivee'; saveGame(true); } for (const f of A5.apres.splice(0)) f(); G.level.indices = indices5; if (A5.lieu === 'gardeguerin' && atteint5('course')) clocheTroupeaux(); }
  if (state.sonnaille && !AIDE.extra.some(([k]) => k === 'N')) AIDE.extra.push(['N', 'sonner la sonnaille']);
  const f = A5.aFaire.shift(); if (f) f();
  for (const o of A5.persos || []) if (o.userData.ctrl) PNJ.animeVillageois(o, dt, false);
  if (A5.chien && A5.sol && !(A5.lieu === 'pouget' && state.chienRendu) && !A5.chienRepos) suivreChien(dt, A5.sol);
  else if (A5.chien && A5.chien.mix) A5.chien.mix.update(0);
  animeLoup(dt); animeLasso(dt); animeGlisse5(dt); animeTroupeau(dt); animeGlisseLac(dt);
  // le passé qui s'efface
  if (A5.sonT > 0) { A5.sonT -= dt; if (A5.sonT <= 0) { A5.sonne = 'present'; const cv = document.querySelector('canvas'); if (cv) cv.style.filter = ''; for (const fn of A5.surSonnaille) fn('present', player.pos); } }
}

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
  if (!FICHES[nom]) throw new Error('lieu de Lozère inconnu : ' + nom);
  const f = FICHES[nom];
  if (new URLSearchParams(location.search).has('avant'))
    return monde({ ...f, plan: 'lozere.json', solLieu: undefined, arbres: { espece: nom === 'villefort' ? 'chene' : 'pin', bois: 0.5, isoles: 0.02, h: [8, 14], max: 900 },
      plus(ctx) { ctx.dessin = relief(ctx.hauteur, f.grille); poteau(ctx, nom); } });
  return monde(f);
}
