// The Legend of Camille — le Pouget : le bâti de granit et de lauzes, les murets, les terrasses
// =====================================================================
// D'après les images d'Eugène (docs/references/POUGET-PHOTOS.md) : des maisons de granit en
// gros moellons, ACCOLÉES en rangées, sous des toits de lauzes de schiste épaisses à fort
// débord, un faîtage de lauzes posées debout ; des portes et des fenêtres à linteau de pierre ;
// des terrasses dallées de granit, des potagers en terrasses ; la route goudronnée bordée de
// murets de pierre sèche, le panneau bleu émaillé, les piquets de clôture du pré.
// Tout est fusionné par matière (un maillage par matière, pas un par maison) : une vingtaine
// d'appels de dessin pour tout le hameau.
// =====================================================================
import { THREE, scene, phMat, phPeint, PH } from './engine.js?v=41';
import { carteForet } from './foret.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Le granit et le schiste n'existaient pas dans le jeu (Lille est de brique et de calcaire).
// Les matières sont inscrites ici, au chargement du Pouget, plutôt que dans engine.js qu'une
// autre session tient : à remonter dans PH quand il sera libre. Poly Haven, CC0, 1k.
Object.assign(PH, {
  stone_wall:           { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a958a },   // murs : granit en gros moellons, joints secs
  roof_slates_02:       { tuile: 3.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6a6866 },   // lauzes de schiste irrégulières
  rustic_stone_wall_02: { tuile: 1.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a8070 },   // pierre sèche en plaquettes (murets)
  asphalt_02:           { tuile: 3.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a8a88 },   // la route goudronnée
  // granit grenu : sa rugosité d'origine est celle d'un dallage POLI, on ne la prend pas
  granite_tile_03:      { tuile: 1.8, maps: ['couleur', 'normale'], repli: 0x8a8580 },
  bark_willow:          { tuile: 1.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x5a4a3a },
});

// LE HASARD DU POUGET EST FIXE : un lieu réel ne déplace pas ses fenêtres ni ses terrasses d'une
// visite à l'autre. Un générateur à graine (mulberry32), partagé avec pouget.js et pouget-arbres.js.
export function graine(s) {
  return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const alea = graine(1307), rand = (a, b) => a + alea() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z), HAUT = V(0, 1, 0);

// ---------------------------------------------------------------------
//  Un lot de faces d'une même matière, fusionné en un seul maillage
// ---------------------------------------------------------------------
// Les UV sont la projection du MONDE sur la face, en mètres : le moellon garde sa taille réelle
// d'une maison à l'autre et les joints courent sans couture d'un corps de bâtiment au suivant.
// Avec `cel` ([u0, v0, u1, v1]), la face prend au contraire une case de la texture entière :
// une dalle, un linteau taillés d'un seul bloc, sans le joint d'une dalle voisine en travers.
export class Lot {
  constructor() { this.p = []; this.u = []; }
  face(pts, dehors, cel) {
    const n = V().subVectors(pts[1], pts[0]).cross(V().subVectors(pts[2], pts[0])).normalize();
    if (n.dot(dehors) < 0) { pts = pts.slice().reverse(); n.negate(); }
    let tu, tv;
    if (Math.abs(n.y) > 0.92) { tu = V(1, 0, 0); tv = V(0, 0, 1); }
    else { tv = HAUT.clone().addScaledVector(n, -n.y).normalize(); tu = V().crossVectors(tv, n); }   // v monte la pente : les rangs de lauzes restent horizontaux
    let uv = pts.map((p) => [p.dot(tu), p.dot(tv)]);
    if (cel) {
      const us = uv.map((q) => q[0]), vs = uv.map((q) => q[1]), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
      uv = uv.map(([u, v]) => [cel[0] + (u - u0) / (u1 - u0 || 1) * (cel[2] - cel[0]), cel[1] + (v - v0) / (v1 - v0 || 1) * (cel[3] - cel[1])]);
    }
    for (const t of pts.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]) { const p = pts[t]; this.p.push(p.x, p.y, p.z); this.u.push(uv[t][0], uv[t][1]); }
  }
  // un pavé quelconque : centre o, trois demi-axes (pas forcément d'équerre avec le monde)
  bloc(o, ex, ey, ez, cel) {
    const ax = [ex, ey, ez];
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const a = ax[(k + 1) % 3], b = ax[(k + 2) % 3], c = o.clone().addScaledVector(ax[k], s);
      this.face([c.clone().sub(a).sub(b), c.clone().add(a).sub(b), c.clone().add(a).add(b), c.clone().sub(a).add(b)], ax[k].clone().multiplyScalar(s), cel);
    }
  }
  maille(m, ombre = true) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals();                        // faces non indexées : des normales plates, l'arête de pierre reste vive
    const o = new THREE.Mesh(g, m); o.castShadow = ombre; o.receiveShadow = true; scene.add(o); return o;
  }
}
// une case au hasard de la texture de granit (3 × 2 dalles), un peu rentrée pour ne pas prendre le joint
const cellule = () => { const c = Math.floor(alea() * 3), r = Math.floor(alea() * 2);
  return alea() < 0.5 ? [c / 3 + 0.015, r / 2 + 0.015, (c + 1) / 3 - 0.015, (r + 1) / 2 - 0.015] : [(c + 1) / 3 - 0.015, (r + 1) / 2 - 0.015, c / 3 + 0.015, r / 2 + 0.015]; };

function matieres() {
  const granit = phMat('stone_wall', 1, 1, { color: 0xb4b2aa });
  // les lauzes : schiste gris sombre, la texture (des lauzes beiges) assombrie
  const lauze = phMat('roof_slates_02', 1, 1, { color: 0x86857f });
  const taille = phMat('granite_tile_03', 1.8, 1.8, { roughness: 0.92 }); taille.color.setRGB(1.05, 1.1, 1.16);
  // le granit de la texture tire sur le rose : une teinte bleutée le ramène au gris clair des dalles
  const dalle = phMat('granite_tile_03', 1.8, 1.8, { roughness: 0.95 }); dalle.color.setRGB(1.0, 1.07, 1.1);
  const muret = phMat('rustic_stone_wall_02', 1, 1, { color: 0x9ea4a2 });              // le schiste gris, moins roux que la photo de la texture
  const bois = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x8a7a66 });
  const volet = phMat('wood_planks', 1, 1, { color: 0x9a9284 });
  const porte = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x6e5a46 });
  // le noir d'une pièce vue du dehors, avec le reflet d'un carreau
  const vitre = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.18, metalness: 0.3 });
  const herbe = phMat('grass_ground', 1, 1, { color: 0xa8b080 });
  const terre = phMat('terre_battue', 1, 1, { color: 0x8a7458 });
  // la table de la terrasse : un plateau de sapin clair, des pieds peints en rouge sombre
  const sapin = phMat('hinoki_planks', 1, 1, { color: 0xe8d0b0 }), rouge = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x9a4a3a });
  return { granit, lauze, taille, dalle, muret, bois, volet, porte, vitre, herbe, terre, sapin, rouge };
}

// ---------------------------------------------------------------------
//  Les corps de bâtiment d'une emprise OSM
// ---------------------------------------------------------------------
// Une emprise du Pouget, c'est souvent une RANGÉE de maisons accolées (la vue aérienne) : un
// seul toit sur le rectangle englobant faisait une halle. On tranche l'emprise tous les 50 cm
// le long de son orientation dominante ; les tranches voisines de même largeur forment un
// corps, qui aura ses murs, sa hauteur et son toit à lui.
function corpsDe(pts) {
  // l'orientation dominante : les murs sont d'équerre, on prend l'angle (modulo 90°) que portent les plus longs côtés
  const hist = new Float32Array(90);
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const dx = pts[i][0] - pts[j][0], dz = pts[i][1] - pts[j][1], l = Math.hypot(dx, dz);
    const a = Math.round(((Math.atan2(dz, dx) * 180 / Math.PI) % 90 + 90) % 90);
    for (let d = -2; d <= 2; d++) hist[(a + d + 90) % 90] += l * (3 - Math.abs(d));
  }
  let best = 0; for (let k = 1; k < 90; k++) if (hist[k] > hist[best]) best = k;
  const th = best * Math.PI / 180, ux = Math.cos(th), uz = Math.sin(th);
  const A = pts.map(([x, z]) => x * ux + z * uz), B = pts.map(([x, z]) => -x * uz + z * ux);
  const pas = 0.5, tr = [];
  for (let a = Math.min(...A) + pas / 2; a < Math.max(...A); a += pas) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((A[i] - a) * (A[j] - a) < 0) xs.push(B[i] + (a - A[i]) / (A[j] - A[i]) * (B[j] - B[i]));
    xs.sort((p, q) => p - q); let m = null;
    for (let k = 0; k + 1 < xs.length; k += 2) if (!m || xs[k + 1] - xs[k] > m[1] - m[0]) m = [xs[k], xs[k + 1]];
    if (m) tr.push({ a, b0: m[0], b1: m[1] });
  }
  const grp = [];
  for (const t of tr) {
    const g = grp[grp.length - 1];
    if (g && Math.abs(t.b0 - g.b0) < 0.9 && Math.abs(t.b1 - g.b1) < 0.9 && t.a - g.a1 < pas) { g.a1 = t.a + pas / 2; g.n++; g.s0 += t.b0; g.s1 += t.b1; g.b0 = g.s0 / g.n; g.b1 = g.s1 / g.n; }
    else grp.push({ a0: t.a - pas / 2, a1: t.a + pas / 2, b0: t.b0, b1: t.b1, s0: t.b0, s1: t.b1, n: 1 });
  }
  // un corps de moins d'1,5 m n'est qu'un décroché du tracé : le voisin le plus large l'absorbe
  for (let k = 0; k < grp.length; k++) if (grp.length > 1 && grp[k].a1 - grp[k].a0 < 1.5) {
    const v = grp[k - 1] && (!grp[k + 1] || grp[k - 1].b1 - grp[k - 1].b0 > grp[k + 1].b1 - grp[k + 1].b0) ? grp[k - 1] : grp[k + 1];
    v.a0 = Math.min(v.a0, grp[k].a0); v.a1 = Math.max(v.a1, grp[k].a1); grp.splice(k--, 1);
  }
  return grp.filter((g) => g.b1 - g.b0 > 2).map((g) => { const a = (g.a0 + g.a1) / 2, b = (g.b0 + g.b1) / 2;
    return { x: a * ux - b * uz, z: a * uz + b * ux, L: g.a1 - g.a0, W: g.b1 - g.b0, ux, uz }; });
}

// ---------------------------------------------------------------------
//  Un corps de bâtiment : murs, pignons, deux pans de lauzes, faîtage, ouvertures
// ---------------------------------------------------------------------
function corps3D(c, h, lots) {
  let r = V(c.ux, 0, c.uz), s = V(-c.uz, 0, c.ux), L = c.L, W = c.W;
  if (W > L * 1.25) { [r, s] = [s, r.clone().negate()]; [L, W] = [W, L]; }   // le faîtage suit la plus grande longueur
  const P = (a, b, y) => V(c.x + r.x * a + s.x * b, y, c.z + r.z * a + s.z * b);
  const sol = (a, b) => h(c.x + r.x * a + s.x * b, c.z + r.z * a + s.z * b);
  const R = (k) => r.clone().multiplyScalar(k), S = (k) => s.clone().multiplyScalar(k), U = (k) => V(0, k, 0);
  const g = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([i, j]) => sol(i * L / 2, j * W / 2));
  const gmin = Math.min(...g), gmax = Math.max(...g);
  // enterrée côté pente, la maison prend un étage de plus côté vallée
  const base = gmin - 1.2, avt = gmax + (L * W > 45 ? 4.9 : 3.4) + rand(-0.25, 0.35);
  lots.granit.bloc(P(0, 0, (base + avt) / 2), R(L / 2), U((avt - base) / 2), S(W / 2));
  const pente = rand(0.62, 0.74), mont = W / 2 * Math.tan(pente);          // 36 à 42° : les lauzes sont lourdes, le toit raide
  for (const sg of [-1, 1]) lots.granit.face([P(sg * L / 2, -W / 2, avt), P(sg * L / 2, W / 2, avt), P(sg * L / 2, 0, avt + mont)], R(sg));
  // les pans : des lauzes de 16 cm d'épaisseur, 50 cm de débord en bas de pente, 30 en pignon
  const de = 0.5, dg = 0.3, ep = 0.16;
  for (const sg of [-1, 1]) {
    const haut = P(0, 0, avt + mont), bas = P(0, sg * (W / 2 + de), avt - de * Math.tan(pente));
    const d = V().subVectors(bas, haut), l = d.length(); d.normalize();
    const nrm = S(sg * Math.sin(pente)).add(U(Math.cos(pente)));
    lots.lauze.bloc(haut.clone().add(bas).multiplyScalar(0.5).addScaledVector(nrm, ep / 2), R(L / 2 + dg), d.multiplyScalar(l / 2 + ep / 2), nrm.clone().multiplyScalar(ep / 2));
  }
  // le faîtage : une crête de lauzes posées debout, penchées toutes du même côté, comme des écailles
  { const n = Math.round((L + 2 * dg) / 0.26), p = (L + 2 * dg) / n, inc = 0.5, yf = avt + mont + ep / Math.cos(pente);
    const rr = R(Math.cos(inc)).addScaledVector(HAUT, Math.sin(inc)), uu = U(Math.cos(inc)).addScaledVector(r, -Math.sin(inc));
    for (let k = 0; k < n; k++) lots.lauze.bloc(P(-L / 2 - dg + (k + 0.5) * p, 0, yf + 0.06), rr.clone().multiplyScalar(0.035), uu.clone().multiplyScalar(0.19 * rand(0.85, 1.1)), S(0.24 * rand(0.9, 1.1))); }
  // une cheminée de granit sur les plus longues, coiffée d'une lauze
  if (L > 7 && alea() < 0.5) {
    const a = (alea() < 0.5 ? -1 : 1) * (L / 2 - 1.1), y0 = avt + mont - 0.6, y1 = avt + mont + 1.1;
    lots.granit.bloc(P(a, 0, (y0 + y1) / 2), R(0.38), U((y1 - y0) / 2), S(0.42));
    lots.lauze.bloc(P(a, 0, y1 + 0.05), R(0.55), U(0.05), S(0.6));
  }
  // les ouvertures, sur les deux longues façades : la porte du côté de la pente (on y entre de
  // plain-pied), des fenêtres petites, au linteau d'un seul bloc de granit
  const faces = [-1, 1].map((sg) => { const n = Math.max(1, Math.floor(L / 3.2));
    const pos = Array.from({ length: n }, (_, k) => -L / 2 + (k + 0.5) * L / n + rand(-0.3, 0.3));
    return { sg, pos, sols: pos.map((a) => sol(a, sg * (W / 2 + 0.8))) }; });
  const amont = faces[0].sols.reduce((x, y) => x + y) / faces[0].sols.length > faces[1].sols.reduce((x, y) => x + y) / faces[1].sols.length ? 0 : 1;
  for (const [fi, f] of faces.entries()) {
    const n = S(f.sg), kp = fi === amont ? Math.floor(alea() * f.pos.length) : -1;
    f.pos.forEach((a, k) => {
      const gO = Math.max(f.sols[k], base + 0.3), F = (y) => P(a, f.sg * W / 2, y);
      if (k === kp && avt - gO > 2.6) porte(lots, F(gO), r, n);
      else {
        if (gO + 1.5 + 0.8 < avt - 0.2) fenetre(lots, F(gO + 1.5), r, n, 0.7, 0.9, alea() < 0.5);
        if (gO + 4.2 + 0.7 < avt - 0.15) fenetre(lots, F(gO + 4.2), r, n, 0.66, 0.85, alea() < 0.4);
      }
    });
  }
  return { x: c.x, z: c.z, r, s, L, W, base, avt, faces, amont };
}

function fenetre(lots, F, r, n, w, hh, volets) {
  const at = (a, y, e) => F.clone().addScaledVector(r, a).add(V(0, y, 0)).addScaledVector(n, e);
  const R = (k) => r.clone().multiplyScalar(k), N = (k) => n.clone().multiplyScalar(k), U = (k) => V(0, k, 0);
  lots.vitre.bloc(at(0, 0, 0.004), R(w / 2), U(hh / 2), N(0.012));
  // le dormant et la croisée, en bois
  for (const sg of [-1, 1]) { lots.bois.bloc(at(sg * (w / 2 - 0.035), 0, 0.03), R(0.035), U(hh / 2), N(0.022)); lots.bois.bloc(at(0, sg * (hh / 2 - 0.035), 0.03), R(w / 2), U(0.035), N(0.022)); }
  lots.bois.bloc(at(0, 0, 0.028), R(0.02), U(hh / 2), N(0.018)); lots.bois.bloc(at(0, hh * 0.08, 0.028), R(w / 2), U(0.02), N(0.018));
  // l'encadrement de granit : deux piédroits, le linteau, l'appui
  for (const sg of [-1, 1]) lots.taille.bloc(at(sg * (w / 2 + 0.1), 0, 0.045), R(0.1), U(hh / 2), N(0.06), cellule());
  lots.taille.bloc(at(0, hh / 2 + 0.14, 0.055), R(w / 2 + 0.3), U(0.14), N(0.075), cellule());
  lots.taille.bloc(at(0, -hh / 2 - 0.05, 0.07), R(w / 2 + 0.16), U(0.05), N(0.1), cellule());
  if (volets) for (const sg of [-1, 1]) lots.volet.bloc(at(sg * (w / 2 + 0.22 + w / 4), 0, 0.07), R(w / 4), U(hh / 2 + 0.03), N(0.022));
}
function porte(lots, F, r, n) {
  const w = 1.0, hh = 2.0, at = (a, y, e) => F.clone().addScaledVector(r, a).add(V(0, y, 0)).addScaledVector(n, e);
  const R = (k) => r.clone().multiplyScalar(k), N = (k) => n.clone().multiplyScalar(k), U = (k) => V(0, k, 0);
  lots.porte.bloc(at(0, hh / 2, 0.012), R(w / 2), U(hh / 2), N(0.02));
  for (const sg of [-1, 1]) lots.taille.bloc(at(sg * (w / 2 + 0.13), hh / 2, 0.05), R(0.13), U(hh / 2), N(0.07), cellule());
  lots.taille.bloc(at(0, hh + 0.19, 0.06), R(w / 2 + 0.42), U(0.19), N(0.085), cellule());          // le linteau monolithe
  lots.taille.bloc(at(0, 0.03, 0.3), R(w / 2 + 0.18), U(0.09), N(0.32), cellule());                  // la marche du seuil
}

// ---------------------------------------------------------------------
//  Le hameau
// ---------------------------------------------------------------------
// h : l'altitude du relief ; batiments : les emprises OSM ; chemins : les tracés (pour ne pas
// dalier une terrasse sur la route). Renvoie les maisons (collisions, carte) et le sol des
// terrasses (où l'on marche plus haut que le relief).
export function construireHameau({ h, batiments, chemins, dansPoly }) {
  const M = matieres(), lots = Object.fromEntries(Object.keys(M).map((k) => [k, new Lot()]));
  const maisons = [], corps = [];
  for (const b of batiments) {
    const cs = corpsDe(b.pts).map((c) => corps3D(c, h, lots));
    if (!cs.length) continue;
    corps.push(...cs);
    maisons.push({ pts: b.pts, cx: b.pts.reduce((s, p) => s + p[0], 0) / b.pts.length, cz: b.pts.reduce((s, p) => s + p[1], 0) / b.pts.length });
  }
  const dansMaison = (x, z, m = 0) => maisons.some((mm) => Math.abs(x - mm.cx) < 40 && Math.abs(z - mm.cz) < 40 &&
    [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]].some(([dx, dz]) => dansPoly(x + dx, z + dz, mm.pts)));
  const prochesChemin = (x, z, d) => chemins.some((c) => c.pts.some((p, k) => k && distSeg(x, z, c.pts[k - 1], p) < d));

  // ---------- les terrasses dallées ----------
  // Devant une façade, de plain-pied avec son seuil : côté vallée de préférence (la photo de la
  // terrasse), sinon une cour à plat entre les maisons (la vue aérienne). On essaie plusieurs
  // profondeurs : le hameau est serré, une terrasse de 4 m ne passe pas partout.
  const sols = [];
  const cand = corps.filter((c) => c.L >= 3.5).sort(() => alea() - 0.5);
  for (const c of cand) {
    if (sols.length >= 9) break;
    const P = (a, b) => [c.x + c.r.x * a + c.s.x * b, c.z + c.r.z * a + c.s.z * b];
    let fait = false;
    for (const fi of [1 - c.amont, c.amont]) for (const D of [4, 3.2, 2.5]) {
      if (fait) break;
      const sg = c.faces[fi].sg, T = Math.min(c.L - 0.3, 8);
      const pts = []; for (let a = -T / 2; a <= T / 2 + 0.01; a += T / 4) for (let b = 0.3; b <= D + 0.01; b += D / 3) pts.push(P(a, sg * (W2(c) + b)));
      if (pts.some(([x, z]) => dansMaison(x, z, 0.3) || prochesChemin(x, z, 2.1) || sols.some((t) => dansPoly(x, z, t.pts)))) continue;
      const y = Math.max(...[-T / 2, 0, T / 2].map((a) => P(a, sg * (W2(c) + 0.3))).map(([x, z]) => h(x, z)));   // de plain-pied avec le pied de la façade
      const hs = pts.map(([x, z]) => h(x, z)), bord = [-T / 2, 0, T / 2].map((a) => P(a, sg * (W2(c) + D))).map(([x, z]) => h(x, z)).reduce((a, b) => a + b) / 3;
      // le sol tombe devant (une terrasse sur son mur) ou reste à plat (une cour) ; jamais à contre-pente, ni perchée
      if (Math.max(...hs) > y + 0.15 || bord > y + 0.1 || y - Math.min(...hs) > 3.2) continue;
      terrasse(lots, c, sg, T, D, y, Math.min(...hs));
      const coins = [P(-T / 2, sg * W2(c)), P(T / 2, sg * W2(c)), P(T / 2, sg * (W2(c) + D)), P(-T / 2, sg * (W2(c) + D))];
      sols.push({ pts: coins, y: y + 0.11, vallee: bord < y - 0.4 });
      if (D >= 3.2 && !sols.some((t) => t.table)) { table(lots, P(-T / 4, sg * (W2(c) + D * 0.55)), c.r, y + 0.11); sols[sols.length - 1].table = true; }   // la table des photos
      fait = true;
    }
  }

  for (const [k, l] of Object.entries(lots)) l.maille(M[k], k !== 'vitre' && k !== 'herbe');
  return { maisons, sols, M, solBati: (x, z) => { let y = -Infinity; for (const t of sols) if (dansPoly(x, z, t.pts) && t.y > y) y = t.y; return y; } };
}
const W2 = (c) => c.W / 2;
function distSeg(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

// une terrasse : un massif de pierre sèche qui rattrape la pente, une herbe rase dans les joints,
// et de grandes dalles de granit irrégulières posées en rangs
function terrasse(lots, c, sg, T, D, y, ybas) {
  const P = (a, b, yy) => V(c.x + c.r.x * a + c.s.x * b, yy, c.z + c.r.z * a + c.s.z * b);
  const R = (k) => c.r.clone().multiplyScalar(k), S = (k) => c.s.clone().multiplyScalar(k), U = (k) => V(0, k, 0);
  const b0 = sg * W2(c), bm = sg * (W2(c) + D / 2), y0 = ybas - 0.6;
  lots.muret.bloc(P(0, bm, (y0 + y - 0.04) / 2), R(T / 2), U((y - 0.04 - y0) / 2), S(D / 2));
  lots.herbe.bloc(P(0, bm, y), R(T / 2), U(0.04), S(D / 2));
  for (let b = 0.05; b < D - 0.3;) {
    const pr = Math.min(rand(0.5, 0.95), D - 0.05 - b);
    for (let a = -T / 2 + 0.05; a < T / 2 - 0.3;) {
      const lg = Math.min(rand(0.6, 1.35), T / 2 - 0.05 - a);
      lots.dalle.bloc(P(a + lg / 2, b0 + sg * (b + pr / 2), y + 0.06 + rand(-0.012, 0.012)), R(lg / 2 - 0.025), U(0.055), S(pr / 2 - 0.025), cellule());
      a += lg;
    }
    b += pr;
  }
}
// la table de bois et ses deux bancs, pieds rouges (la photo de la terrasse)
function table(lots, [x, z], r, y) {
  const s = V(-r.z, 0, r.x), o = V(x, y, z), R = (k) => r.clone().multiplyScalar(k), S = (k) => s.clone().multiplyScalar(k), U = (k) => V(0, k, 0);
  lots.sapin.bloc(o.clone().add(U(0.74)), R(1.0), U(0.03), S(0.42));
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) lots.rouge.bloc(o.clone().add(R(sa * 0.85)).add(S(sb * 0.32)).add(U(0.36)), R(0.04), U(0.36), S(0.04));
  for (const sb of [-1, 1]) { const ob = o.clone().add(S(sb * 0.78));
    lots.sapin.bloc(ob.clone().add(U(0.44)), R(1.0), U(0.025), S(0.15));
    for (const sa of [-1, 1]) lots.rouge.bloc(ob.clone().add(R(sa * 0.85)).add(U(0.21)), R(0.04), U(0.21), S(0.11)); }
}

// ---------------------------------------------------------------------
//  Les potagers en terrasses (au sud-ouest, sous les maisons : la vue aérienne)
// ---------------------------------------------------------------------
// Des bancels : chaque planche est un remblai tenu par un mur de pierre sèche, la terre
// retournée dessus, des rangs de légumes. x0..x1 en travers de la pente, z0 le haut, z vers le bas.
export function potagers({ h, x0, x1, z0, n, prof, M }) {
  const lot = new Lot(), terre = new Lot(), sols = [], plants = [];
  for (let k = 0; k < n; k++) {
    const za = z0 + k * prof, zb = za + prof, xs = [x0, (x0 + x1) / 2, x1];
    const y = Math.max(...xs.flatMap((x) => [h(x, za), h(x, (za + zb) / 2)])) + 0.05, ybas = Math.min(...xs.map((x) => h(x, zb))) - 0.5;
    lot.bloc(V((x0 + x1) / 2, (ybas + y - 0.05) / 2, (za + zb) / 2), V((x1 - x0) / 2, 0, 0), V(0, (y - 0.05 - ybas) / 2, 0), V(0, 0, prof / 2));
    terre.bloc(V((x0 + x1) / 2, y - 0.02, (za + zb) / 2 - 0.05), V((x1 - x0) / 2 - 0.15, 0, 0), V(0, 0.06, 0), V(0, 0, prof / 2 - 0.12));
    sols.push({ pts: [[x0, za], [x1, za], [x1, zb], [x0, zb]], y: y + 0.04 });
    for (let zr = za + 0.6; zr < zb - 0.5; zr += 0.75) for (let x = x0 + 0.5; x < x1 - 0.4; x += rand(0.4, 0.6)) plants.push([x + rand(-0.06, 0.06), y + 0.04, zr + rand(-0.06, 0.06)]);
  }
  lot.maille(M.muret); terre.maille(M.terre, false);
  // les légumes : deux cartes de feuilles en croix, instanciées
  const g = mergeGeometries([0, Math.PI / 2].map((a) => new THREE.PlaneGeometry(0.55, 0.45).translate(0, 0.2, 0).rotateY(a)));
  const m = new THREE.MeshStandardMaterial({ map: carteForet('buisson'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: 0x9ab070 });
  const im = new THREE.InstancedMesh(g, m, plants.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  plants.forEach(([x, y, z], k) => { const s = rand(0.7, 1.2); q.setFromAxisAngle(HAUT, rand(0, 6.3)); m4.compose(V(x, y, z), q, sc.set(s, s, s)); im.setMatrixAt(k, m4); });
  im.castShadow = true; scene.add(im);
  return sols;
}

// ---------------------------------------------------------------------
//  Les murets de pierre sèche le long de la route d'arrivée
// ---------------------------------------------------------------------
// De part et d'autre de la chaussée, à 60 cm du bord. Côté pente, le muret RETIENT le pré : il
// monte jusqu'à 1,5 m, et l'herbe du talus continue au-dessus (Street View) ; côté vallée, c'est
// un muret bas. Un mur continu dont le dessus suit la route (des blocs posés côte à côte
// faisaient un escalier), couronné de grosses pierres plates posées de travers.
export function murets({ h, lignes, largeur, M, eviter }) {
  const lot = new Lot(), ep = 0.28;
  for (const pts of lignes) for (const cote of [-1, 1]) {
    // les points du pied du mur, coupés en tronçons là où il faut l'interrompre
    const runs = [[]]; let s = 0;
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
      let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
      const o = largeur / 2 + 0.6, px = x - dz * o * cote, pz = z + dx * o * cote;
      if (eviter(px, pz)) { if (runs[runs.length - 1].length) runs.push([]); continue; }
      const yr = h(x, z), ydeh = h(px - dz * 0.9 * cote, pz + dx * 0.9 * cote);
      // la hauteur ondule doucement le long du mur : des pierres plus ou moins hautes, pas des marches
      const top = Math.max(yr + 0.62 + 0.12 * Math.sin(s * 0.9) + 0.07 * Math.sin(s * 2.3 + cote), Math.min(ydeh + 0.2, yr + 1.5));
      runs[runs.length - 1].push({ p: V(px, 0, pz), n: V(-dz * cote, 0, dx * cote), top, bas: Math.min(yr, ydeh) - 0.4 });
    }
    for (const run of runs) {
      if (run.length < 2) continue;
      const pt = (q, e, y) => q.p.clone().addScaledVector(q.n, e).setY(y);
      for (let k = 1; k < run.length; k++) {
        const a = run[k - 1], b = run[k];
        for (const e of [-ep, ep]) lot.face([pt(a, e, a.bas), pt(b, e, b.bas), pt(b, e, b.top), pt(a, e, a.top)], a.n.clone().multiplyScalar(e));
        lot.face([pt(a, -ep, a.top), pt(b, -ep, b.top), pt(b, ep, b.top), pt(a, ep, a.top)], HAUT);
      }
      for (const [q, r] of [[run[0], run[1]], [run[run.length - 1], run[run.length - 2]]]) {
        const d = V().subVectors(q.p, r.p).normalize();
        lot.face([pt(q, -ep, q.bas), pt(q, ep, q.bas), pt(q, ep, q.top), pt(q, -ep, q.top)], d);
      }
      // le couronnement : des pierres plates posées de chant le long de la pente du mur (posées
      // à plat, elles faisaient des dents de scie), un peu de travers, à peine plus larges que lui
      for (let k = 1; k < run.length; k++) for (let t = 0; t < 1; t += rand(0.35, 0.55)) {
        const a = run[k - 1], b = run[k], c = a.p.clone().lerp(b.p, t), y = a.top + (b.top - a.top) * t;
        const ax = V().subVectors(b.p, a.p).setY(b.top - a.top).normalize().applyAxisAngle(HAUT, rand(-0.25, 0.25));
        const az = V().crossVectors(ax, HAUT).normalize().applyAxisAngle(ax, rand(-0.1, 0.1)), up = V().crossVectors(az, ax).normalize();
        lot.bloc(c.setY(y + 0.02), ax.multiplyScalar(rand(0.16, 0.26)), up.multiplyScalar(rand(0.04, 0.07)), az.multiplyScalar(rand(0.25, 0.31)));
      }
    }
  }
  lot.maille(M.muret);
}

// ---------------------------------------------------------------------
//  Le panneau bleu émaillé « Le Pouget », et les piquets de clôture du pré
// ---------------------------------------------------------------------
export function panneau({ x, z, y, face }) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#21407e'; g.fillRect(0, 0, 768, 256);
  // l'émail : un dégradé à peine marqué, plus clair au centre
  const gr = g.createRadialGradient(384, 110, 40, 384, 128, 420); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,20,0.18)');
  g.fillStyle = gr; g.fillRect(0, 0, 768, 256);
  g.strokeStyle = '#e8ecf0'; g.lineWidth = 10; g.beginPath(); g.roundRect(14, 14, 740, 228, 26); g.stroke();
  g.fillStyle = '#eef0f2'; g.font = 'italic bold 128px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Le  Pouget', 384, 134);
  // les éclats de l'émail, rouillés, sur les bords
  for (let k = 0; k < 14; k++) { const a = alea() < 0.5, px = a ? rand(10, 758) : (alea() < 0.5 ? rand(6, 30) : rand(738, 762)), py = a ? (alea() < 0.5 ? rand(6, 26) : rand(230, 250)) : rand(10, 246);
    g.fillStyle = `rgba(${90 + rand(0, 40) | 0},${50 + rand(0, 20) | 0},30,0.8)`; g.beginPath(); g.ellipse(px, py, rand(2, 7), rand(2, 5), rand(0, 3), 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const emaille = (m) => { m.metalnessMap = null; m.metalness = 0.05; m.roughnessMap = null; m.roughness = 0.32; return m; };
  const devant = emaille(phPeint('metal_plate_02', 1, 1, t));
  const bleu = emaille(phMat('metal_plate_02', 1, 1, { color: 0x2a3f6e }));
  // le poteau : un tube peint en blanc, la rouille qui coule
  const cp = document.createElement('canvas'); cp.width = 64; cp.height = 512; const gp = cp.getContext('2d');
  gp.fillStyle = '#e4e2dc'; gp.fillRect(0, 0, 64, 512);
  for (let k = 0; k < 40; k++) { gp.fillStyle = `rgba(${120 + rand(0, 40) | 0},60,35,${rand(0.15, 0.5)})`; gp.fillRect(rand(0, 64), rand(0, 512), rand(1, 4), rand(10, 90)); }
  gp.fillStyle = 'rgba(140,40,30,0.85)'; gp.fillRect(0, 300, 64, 70);
  const tp = new THREE.CanvasTexture(cp); tp.colorSpace = THREE.SRGBColorSpace;
  const poteau = emaille(phPeint('metal_plate_02', 1, 1, tp)); poteau.roughness = 0.6;
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = face; scene.add(grp);
  const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 10), poteau); pt.position.y = 1.15; grp.add(pt);
  const pl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.025), [bleu, bleu, bleu, bleu, devant, bleu]); pl.position.set(0, 2.05, 0.04); grp.add(pl);
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}
// des piquets de châtaignier refendu, penchés comme ils ont pu, avec une lisse de bois sur
// quelques travées et du fil de fer ailleurs
export function piquets({ h, pts, pas = 2.6 }) {
  const gs = [], lisses = new Lot(), fils = [];
  let reste = 0, prec = null;
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], l = Math.hypot(bx - ax, bz - az);
    let d = reste;
    for (; d < l; d += pas) {
      const x = ax + (bx - ax) * d / l, z = az + (bz - az) * d / l, y = h(x, z), hp = rand(1.15, 1.4);
      const g = new THREE.CylinderGeometry(0.045, 0.06, hp + 0.3, 6); g.translate(0, (hp + 0.3) / 2 - 0.3, 0);
      g.rotateX(rand(-0.06, 0.06)); g.rotateZ(rand(-0.07, 0.07)); g.translate(x, y, z); gs.push(g);
      const p = V(x, y + hp - 0.08, z);
      if (prec) {
        if (alea() < 0.35) { const m = prec.clone().add(p).multiplyScalar(0.5), ax2 = V().subVectors(p, prec), lg = ax2.length(); ax2.normalize();
          lisses.bloc(m, ax2.multiplyScalar(lg / 2 + 0.1), V(0, 0.05, 0), V(-ax2.z, 0, ax2.x).normalize().multiplyScalar(0.02)); }
        for (const dy of [0, -0.45]) fils.push(prec.x, prec.y + dy, prec.z, p.x, p.y + dy, p.z);
      }
      prec = p;
    }
    reste = d - l;                                   // la travée continue d'un tronçon de tracé au suivant
  }
  if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), phMat('dead_tree_tiled', 0.4, 1.4, { color: 0xa09484 })); m.castShadow = true; scene.add(m); }
  lisses.maille(phMat('wood_planks', 1, 1, { color: 0xc8c4bc }));
  if (fils.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(fils, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6a6a68, transparent: true, opacity: 0.6 }))); }
}
