// quartier.js — le vrai quartier : les emprises relevées, élevées.
//
// Le bourg flamand inventé tenait lieu de ville : vingt maisons le long d'une grand-rue
// droite, dans une enceinte qui n'a jamais existé. Depuis que « la carte fait foi », c'est
// le relevé qui bâtit. La BD TOPO donne 2035 emprises, dont 1975 avec leur hauteur réelle,
// leur nature, leur usage, et les matériaux déclarés des murs et de la toiture.
//
// Les matériaux sont codés sur deux chiffres (nomenclature MAJIC reprise par la BD TOPO) :
// le premier est le matériau principal, le second le secondaire.
//   murs   1 pierre · 2 meulière · 3 béton · 4 brique   (« 40 » = brique seule, 520 fois : c'est Lille)
//   toits  1 tuiles (417 fois) · 2 ardoises · 3 zinc · 9 autre
//
// Économie du module : tout est fusionné à la main dans quelques géométries, une par
// matériau, au lieu de deux mille objets. Les 1780 bâtiments retenus tiennent en ~50 000
// triangles pour les volumes ; la variation d'un bâtiment à l'autre passe par la couleur
// de sommet, ce qui ne coûte pas un appel de dessin de plus.
import {
  THREE, addCap, cleTuile, makeCanvas, mat, patiner, phMat, phPeint,
} from './engine.js?v=41';
import {
  ENCEINTE, ENCEINTE_H, GLACIS, IGN, LARGEUR_CHEMIN, LARGEUR_ROUTE, LILLE, MOAT_OUT, PLAINE_R, PONTS, TOWN_BOITE, dansEnceinte, sdEau, sdPent,
  solPlaine, surVoie, townLocal, voieCombattants, dansVille, horsVille, sdVille, epaisseurVoie, levelH,
} from './carte.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as E from './engine.js?v=41';
import { makeVillager } from './banque.js';
import { PARTAGE } from './etat.js';

// ---------------------------------------------------------------------
//  Géométrie de contour
// ---------------------------------------------------------------------
function aireSignee(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; }
  return a / 2;
}
// Le relevé décrit les façades au décimètre : un mur droit y compte cinq sommets. On
// enlève ceux dont la flèche est sous le seuil — 11 506 sommets tombent à 11 222, et
// surtout les segments de 20 cm disparaissent, qui auraient chacun coûté une capsule.
function simplifier(p, eps = 0.55) {
  const out = p.map((q) => [q[0], q[1]]);
  let change = true;
  while (change && out.length > 4) {
    change = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1;
      if (Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / L < eps) { out.splice(i, 1); change = true; break; }
    }
  }
  return out;
}
function enveloppe(p) {
  const q = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas = [], haut = [];
  for (const v of q) { while (bas.length >= 2 && cr(bas[bas.length - 2], bas[bas.length - 1], v) <= 0) bas.pop(); bas.push(v); }
  for (let i = q.length - 1; i >= 0; i--) { const v = q[i]; while (haut.length >= 2 && cr(haut[haut.length - 2], haut[haut.length - 1], v) <= 0) haut.pop(); haut.push(v); }
  bas.pop(); haut.pop();
  return bas.concat(haut);
}
// Rectangle englobant d'aire minimale (calipers tournants sur l'enveloppe) : il donne
// l'axe du faîtage. Une maison de rue n'a pas un toit orienté nord-sud parce que le
// monde l'est, elle a un toit parallèle à la rue.
function rectMin(p) {
  const h = enveloppe(p);
  if (h.length < 3) return null;
  let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz);
    if (Ln < 1e-6) continue;
    const ux = dx / Ln, uz = dz / Ln;
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const q of h) {
      const s = q[0] * ux + q[1] * uz, t = -q[0] * uz + q[1] * ux;
      if (s < s0) s0 = s; if (s > s1) s1 = s; if (t < t0) t0 = t; if (t > t1) t1 = t;
    }
    const A = (s1 - s0) * (t1 - t0);
    if (!best || A < best.A) best = { A, ux, uz, s0, s1, t0, t1 };
  }
  if (!best) return null;
  let { ux, uz, s0, s1, t0, t1 } = best;
  const sm = (s0 + s1) / 2, tm = (t0 + t1) / 2;
  const cx = sm * ux - tm * uz, cz = sm * uz + tm * ux;
  let L = s1 - s0, W = t1 - t0;
  if (W > L) { const nx = -uz; uz = ux; ux = nx; const k = L; L = W; W = k; }
  return { cx, cz, ux, uz, L, W, A: best.A };
}

// Une emprise qui n'est pas son rectangle — en L, en T, en U, à redans — ne peut pas porter
// UN toit : posé sur le rectangle englobant, il couvrait le vide de la cour, débordait sur
// la rue, et laissait entre le haut des murs et le rampant des jours par où l'on voyait le
// ciel. On la découpe donc en rectangles, dans le repère du rectangle englobant : on relève
// les abscisses et ordonnées des sommets (fusionnées à 2,5 m près : un décrochement plus
// petit n'est pas une aile, et gardé tel quel il donnait une bande d'un ou deux mètres de
// large, coiffée d'un toit raide — une tour étroite plantée le long de la façade), on
// garde les cases de la grille dont le centre est dans l'emprise, puis on réunit les cases
// en bandes, et les bandes identiques en rectangles. Chaque rectangle est une maison.
// Renvoie null quand ce n'est pas la peine (emprise déjà rectangulaire) ou pas possible.
function decouperRectangles(p, rB) {
  const { ux, uz, cx, cz } = rB, vx = -uz, vz = ux;
  const loc = p.map(([x, z]) => [(x - cx) * ux + (z - cz) * uz, (x - cx) * vx + (z - cz) * vz]);
  const coupes = (vals) => {
    const s = [...vals].sort((a, b) => a - b), groupes = [[s[0]]];
    for (let i = 1; i < s.length; i++) {
      if (s[i] - s[i - 1] < 2.5) groupes[groupes.length - 1].push(s[i]); else groupes.push([s[i]]);
    }
    // les bords extrêmes gardent leur valeur extrême, les coupes intérieures la moyenne
    return groupes.map((g, i) => i === 0 ? g[0] : i === groupes.length - 1 ? g[g.length - 1]
      : g.reduce((t, v) => t + v, 0) / g.length);
  };
  const S = coupes(loc.map((q) => q[0])), T2 = coupes(loc.map((q) => q[1]));
  if (S.length < 2 || T2.length < 2 || S.length > 24 || T2.length > 24) return null;
  const dedans = (s, t) => {                          // point dans le polygone (rayon horizontal)
    let c = false;
    for (let i = 0, j = loc.length - 1; i < loc.length; j = i++) {
      const [si, ti] = loc[i], [sj, tj] = loc[j];
      if ((ti > t) !== (tj > t) && s < (sj - si) * (t - ti) / (tj - ti) + si) c = !c;
    }
    return c;
  };
  const ni = S.length - 1, nj = T2.length - 1;
  const plein = [];
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) plein[j * ni + i] = dedans((S[i] + S[i + 1]) / 2, (T2[j] + T2[j + 1]) / 2);
  // bandes le long de s (le grand axe : c'est celui des faîtages), rangée par rangée
  const bandes = [];
  for (let j = 0; j < nj; j++) {
    for (let i = 0; i < ni;) {
      if (!plein[j * ni + i]) { i++; continue; }
      let k = i; while (k < ni && plein[j * ni + k]) k++;
      bandes.push({ i0: i, i1: k, j0: j, j1: j + 1 }); i = k;
    }
  }
  // deux bandes de mêmes bornes, l'une au-dessus de l'autre, ne font qu'un rectangle
  const rects = [];
  for (const b of bandes) {
    const r = rects.find((q) => q.i0 === b.i0 && q.i1 === b.i1 && q.j1 === b.j0);
    if (r) r.j1 = b.j1; else rects.push({ ...b });
  }
  if (rects.length === 1 && rects[0].i0 === 0 && rects[0].i1 === ni && rects[0].j0 === 0 && rects[0].j1 === nj) return null;
  const monde = (s, t) => [cx + ux * s + vx * t, cz + uz * s + vz * t];
  const out = [];
  for (const q of rects) {
    const s0 = S[q.i0], s1 = S[q.i1], t0 = T2[q.j0], t1 = T2[q.j1];
    const Ls = s1 - s0, Lt = t1 - t0;
    // ce qui reste d'étroit après la fusion des coupes est un redan du relevé, pas une maison
    if (Ls * Lt < 6 || Math.min(Ls, Lt) < 1.6) continue;
    let poly = [monde(s0, t0), monde(s1, t0), monde(s1, t1), monde(s0, t1)];
    if (aireSignee(poly) < 0) poly = poly.reverse();
    const [mx, mz] = monde((s0 + s1) / 2, (t0 + t1) / 2);
    const long = Ls >= Lt;
    out.push({ poly, r: { cx: mx, cz: mz, ux: long ? ux : vx, uz: long ? uz : vz, L: long ? Ls : Lt, W: long ? Lt : Ls, A: Ls * Lt } });
  }
  return out.length ? out : null;
}

// ---------------------------------------------------------------------
//  Sacs de triangles : une géométrie par matériau, remplie à la main
// ---------------------------------------------------------------------
function sac(m) { return { mat: m, pos: [], nor: [], uv: [], col: [], n: 0 }; }
function tri(s, a, b, c, ua, ub, uc, col, dehors) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
  const Ln = Math.hypot(nx, ny, nz); if (Ln < 1e-9) return;
  nx /= Ln; ny /= Ln; nz /= Ln;
  // le sens de parcours n'est pas garanti par le relevé : on le déduit de la normale voulue
  let A = a, B = b, C = c, UA = ua, UB = ub, UC = uc;
  if (dehors && nx * dehors[0] + ny * dehors[1] + nz * dehors[2] < 0) {
    B = c; C = b; UB = uc; UC = ub; nx = -nx; ny = -ny; nz = -nz;
  }
  for (const [v, u] of [[A, UA], [B, UB], [C, UC]]) {
    s.pos.push(v[0], v[1], v[2]); s.nor.push(nx, ny, nz); s.uv.push(u[0], u[1]); s.col.push(col[0], col[1], col[2]);
  }
  s.n += 1;
}
function quad(s, a, b, c, d, ua, ub, uc, ud, col, dehors) {
  tri(s, a, b, c, ua, ub, uc, col, dehors);
  tri(s, a, c, d, ua, uc, ud, col, dehors);
}
function cuire(s) {
  if (!s.n) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(s.col, 3));
  g.computeBoundingSphere();
  const o = new THREE.Mesh(g, s.mat);
  o.castShadow = true; o.receiveShadow = true;
  o.userData.fusionne = true;                      // immobile : regroupé en lot (engine.js)
  return o;
}

// ---------------------------------------------------------------------
//  Percements
// ---------------------------------------------------------------------
// Deux mille volumes de brique aveugles ne font pas une ville : ce sont des hangars. Les
// fenêtres sont dessinées une fois sur un canevas et posées en un seul quadrilatère par
// baie, à quatre centimètres du nu du mur — une baie coûte deux triangles et aucun appel
// de dessin de plus, ce qui permet d'en poser des dizaines de milliers.
function texFenetre() {
  const [c, g] = makeCanvas(128, 160);
  // BAIE MÉDIÉVALE. Plus d'encadrement peint ni de grands carreaux : un linteau et un
  // appui de pierre, un dormant de chêne, des petits verres losangés sertis au plomb, et
  // deux volets de bois rabattus contre le mur.
  g.clearRect(0, 0, 128, 160);
  g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, 128, 160);              // fond : bois du dormant
  // volets, un de chaque côté
  const volets = ['#3f5a42', '#7a3a2c', '#4a5a6b'];
  for (const [x0, x1] of [[0, 25], [103, 128]]) {
    g.fillStyle = volets[0]; g.fillRect(x0, 6, x1 - x0, 148);
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (let k = 0; k < 4; k++) g.fillRect(x0 + 2 + k * 6, 6, 2, 148);   // planches
    g.fillStyle = '#2b2018';
    g.fillRect(x0 + 1, 24, x1 - x0 - 2, 5); g.fillRect(x0 + 1, 128, x1 - x0 - 2, 5);  // pentures
  }
  const X0 = 27, Y0 = 16, W = 74, H = 128;
  g.fillStyle = '#20262c'; g.fillRect(X0, Y0, W, H);                // le noir du verre
  // petits verres losangés : on hachure en diagonale dans les deux sens
  g.strokeStyle = '#cdd6dc'; g.lineWidth = 2;
  g.save(); g.beginPath(); g.rect(X0, Y0, W, H); g.clip();
  for (let k = -H; k < W + H; k += 13) {
    g.beginPath(); g.moveTo(X0 + k, Y0); g.lineTo(X0 + k + H, Y0 + H); g.stroke();
    g.beginPath(); g.moveTo(X0 + k, Y0 + H); g.lineTo(X0 + k + H, Y0); g.stroke();
  }
  // un peu de ciel dans les verres du haut, de la pénombre dans ceux du bas
  const grd = g.createLinearGradient(0, Y0, 0, Y0 + H);
  grd.addColorStop(0, 'rgba(150,178,200,0.50)'); grd.addColorStop(0.5, 'rgba(70,88,104,0.35)');
  grd.addColorStop(1, 'rgba(18,22,26,0.55)');
  g.fillStyle = grd; g.fillRect(X0, Y0, W, H);
  g.restore();
  // meneau et traverse de pierre : la croisée
  g.fillStyle = '#b3aa96';
  g.fillRect(X0 + W / 2 - 4, Y0, 8, H); g.fillRect(X0, Y0 + H * 0.42, W, 7);
  // linteau, appui, jambages
  g.fillStyle = '#bdb4a0'; g.fillRect(20, 4, 88, 13);
  g.fillStyle = '#a89e8a'; g.fillRect(18, 146, 92, 10);
  g.fillStyle = '#8a7f6c'; g.fillRect(X0 - 4, Y0, 4, H); g.fillRect(X0 + W, Y0, 4, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function texPorte() {
  const [c, g] = makeCanvas(128, 250);
  g.fillStyle = '#bdb4a0'; g.fillRect(0, 0, 128, 250);              // piédroits et linteau de pierre
  g.fillStyle = '#a89e8a'; g.fillRect(0, 0, 128, 12);
  g.fillStyle = '#5a3a22'; g.fillRect(14, 12, 100, 238);            // vantail de chêne
  g.fillStyle = 'rgba(0,0,0,0.26)';
  for (let k = 0; k < 6; k++) g.fillRect(16 + k * 17, 12, 3, 238);  // planches verticales
  g.fillStyle = '#2f2a26';                                          // pentures de fer
  for (const y of [44, 126, 208]) {
    g.fillRect(14, y, 100, 9);
    g.beginPath(); g.arc(24, y + 4, 6, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#3a342e';                                          // clous
  for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) {
    g.beginPath(); g.arc(24 + k * 20, 26 + r * 50, 3.2, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#6a6156'; g.beginPath(); g.arc(98, 130, 7, 0, Math.PI * 2); g.fill();   // heurtoir
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// Pan de bois. Une ville médiévale du Nord n'est pas qu'en brique : une maison sur cinq
// est à colombage, torchis blanchi entre les bois. C'est une TEXTURE et non de la
// géométrie — une tuile de 2,40 m qui se raccorde dans les deux sens, donc zéro triangle
// de plus pour six cents maisons.
function texColombage() {
  const S = 256, [c, g] = makeCanvas(S, S);
  g.fillStyle = '#d8cfba'; g.fillRect(0, 0, S, S);                   // torchis blanchi
  g.fillStyle = 'rgba(150,138,116,0.30)';
  for (let k = 0; k < 260; k++) {                                     // grain du torchis
    g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 5, 2);
  }
  const bois = '#4a3421', ombre = 'rgba(0,0,0,0.22)';
  const poutre = (x, y, w, h) => {
    g.fillStyle = bois; g.fillRect(x, y, w, h);
    g.fillStyle = ombre; g.fillRect(x, y + h - 3, w, 3);
  };
  // sablières haute et basse, à cheval sur le bord : la tuile se raccorde verticalement
  poutre(0, 0, S, 16); poutre(0, S - 16, S, 16);
  // poteaux, à cheval sur les bords gauche et droit
  poutre(-8, 0, 16, S); poutre(S - 8, 0, 16, S);
  poutre(S / 2 - 8, 0, 16, S);
  // décharges en croix de Saint-André dans chaque panneau
  g.strokeStyle = bois; g.lineWidth = 13; g.lineCap = 'butt';
  for (const x0 of [8, S / 2 + 8]) {
    const x1 = x0 + S / 2 - 16;
    g.beginPath(); g.moveTo(x0, S - 18); g.lineTo(x1, 18); g.stroke();
    g.beginPath(); g.moveTo(x1, S - 18); g.lineTo(x0, 18); g.stroke();
  }
  poutre(0, S / 2 - 7, S, 14);                                        // entretoise à mi-hauteur
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 2.4, 1 / 2.4); t.anisotropy = 4;
  return t;
}

// Ardoise. C'était un aplat gris : sur une nef de quarante mètres, un aplat lit comme du
// carton. Ici, les rangs d'ardoises se recouvrent, chacune un peu plus claire ou plus
// sombre que sa voisine, et la tuile se raccorde dans les deux sens.
function texArdoise() {
  const S = 256, LG = 32, HT = 21, [c, g] = makeCanvas(S, S);
  g.fillStyle = '#1b2026'; g.fillRect(0, 0, S, S);
  for (let r = 0; r < Math.ceil(S / HT) + 1; r++) {
    const dec = (r % 2) * (LG / 2);
    for (let k = -1; k < S / LG + 1; k++) {
      const x = k * LG + dec, y = r * HT;
      const v = 38 + Math.random() * 30;
      g.fillStyle = `rgb(${v | 0},${(v + 5) | 0},${(v + 12) | 0})`;
      g.beginPath();
      g.moveTo(x + 1, y); g.lineTo(x + LG - 1, y);
      g.lineTo(x + LG - 3, y + HT + 5); g.lineTo(x + 3, y + HT + 5);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 2, y + 1, LG - 4, 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 1.6, 1 / 1.6); t.anisotropy = 4;
  return t;
}

function texVitrail() {
  const [c, g] = makeCanvas(128, 320);
  g.fillStyle = '#b9b2a2'; g.fillRect(0, 0, 128, 320);                  // pierre de taille
  g.save(); g.beginPath();                                              // baie en arc brisé
  g.moveTo(16, 320); g.lineTo(16, 118);
  g.quadraticCurveTo(64, 4, 112, 118); g.lineTo(112, 320); g.closePath(); g.clip();
  g.fillStyle = '#1b2430'; g.fillRect(0, 0, 128, 320);
  const teintes = ['#8d2f34', '#2f4f86', '#c9a23c', '#386b4a', '#6b3d78', '#a8442c'];
  for (let j = 0; j < 14; j++) for (let i = 0; i < 5; i++) {
    g.fillStyle = teintes[(i * 5 + j * 3) % teintes.length];
    g.globalAlpha = 0.86; g.fillRect(18 + i * 19, 12 + j * 22, 17, 20);
  }
  g.globalAlpha = 1; g.restore();
  g.strokeStyle = '#d8d2c2'; g.lineWidth = 6;                           // meneaux
  g.beginPath(); g.moveTo(64, 30); g.lineTo(64, 318);
  g.moveTo(16, 150); g.lineTo(112, 150); g.moveTo(16, 232); g.lineTo(112, 232); g.stroke();
  g.lineWidth = 8; g.strokeStyle = '#c6bfae';                           // ébrasement
  g.beginPath(); g.moveTo(16, 320); g.lineTo(16, 118);
  g.quadraticCurveTo(64, 4, 112, 118); g.lineTo(112, 320); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------------
//  La vie de la rue : boutiques, enseignes, lanternes, tonneaux
// ---------------------------------------------------------------------
// « Rues vides » (Eugène, 27 septembre) : mille sept cents façades et pas un commerce. Une
// maison sur quatre qui donne sur une rue ouvre boutique au rez-de-chaussée — devanture de
// bois peint, vitrine garnie selon le métier, enseigne pendue en potence — et la rue reçoit
// des lanternes près des portes, des tonneaux et des caisses devant les échoppes. Tout est
// dans des atlas (un canevas pour quatre métiers) et fusionné ou instancié : quelques
// appels de dessin pour toute la ville.
const METIERS_Q = ['pain', 'biere', 'drap', 'fer'];
function texDevantures() {
  const W = 256, H = 256, [c, g] = makeCanvas(W * 4, H);
  const bois = ['#44574a', '#6e3b33', '#3b4b60', '#7a6440'];      // des peintures passées, pas des couleurs de jouet
  METIERS_Q.forEach((m, k) => {
    const x0 = k * W;
    g.fillStyle = bois[k]; g.fillRect(x0, 0, W, H);                          // le bâti de bois peint
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 6; i++) g.fillRect(x0 + i * 44 + 4, 170, 3, 86);   // panneaux bas
    g.fillStyle = '#1d242a'; g.fillRect(x0 + 16, 18, W - 32, 140);             // la vitrine
    const grd = g.createLinearGradient(0, 18, 0, 158); grd.addColorStop(0, 'rgba(170,190,205,.45)'); grd.addColorStop(1, 'rgba(30,36,42,.2)');
    g.fillStyle = grd; g.fillRect(x0 + 16, 18, W - 32, 140);
    // la marchandise, sur deux tablettes
    for (const [ty, n] of [[100, 5], [150, 6]]) {
      g.fillStyle = '#5b4028'; g.fillRect(x0 + 18, ty, W - 36, 6);
      for (let i = 0; i < n; i++) {
        const cx = x0 + 34 + i * ((W - 68) / (n - 1)), cy = ty - 2;
        if (m === 'pain') { g.fillStyle = '#c08a45'; g.beginPath(); g.ellipse(cx, cy - 10, 16, 10, 0, 0, Math.PI * 2); g.fill(); }
        else if (m === 'biere') { g.fillStyle = i % 2 ? '#3a5a34' : '#6b4a2a'; g.fillRect(cx - 6, cy - 34, 12, 34); g.fillRect(cx - 3, cy - 42, 6, 8); }
        else if (m === 'drap') { g.fillStyle = ['#8a2f3a', '#2f5a86', '#c9a23c', '#3f6f4a', '#d8cfba', '#6b3d78'][i % 6]; g.fillRect(cx - 14, cy - 26, 28, 26); }
        else { g.fillStyle = '#6a6f76'; g.fillRect(cx - 2, cy - 30, 4, 30); g.fillRect(cx - 10, cy - 34, 20, 7); }
      }
    }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x0 + W / 2 - 3, 18, 6, 140); // le meneau
    g.strokeStyle = '#1a140e'; g.lineWidth = 6; g.strokeRect(x0 + 16, 18, W - 32, 140);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function texEnseignes() {
  const W = 128, H = 96, [c, g] = makeCanvas(W * 4, H);
  METIERS_Q.forEach((m, k) => {
    const x0 = k * W;
    g.fillStyle = '#2a1d14'; g.fillRect(x0, 0, W, H);
    g.strokeStyle = '#d9b24a'; g.lineWidth = 5; g.strokeRect(x0 + 5, 5, W - 10, H - 10);
    g.fillStyle = '#e9c14f'; g.strokeStyle = '#e9c14f'; g.lineWidth = 7; g.lineCap = 'round';
    const cx = x0 + W / 2, cy = H / 2;
    if (m === 'pain') { g.beginPath(); g.ellipse(cx, cy, 34, 20, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx - 20, cy); g.lineTo(cx + 20, cy); g.stroke(); }
    else if (m === 'biere') { g.fillRect(cx - 16, cy - 22, 32, 44); g.strokeRect(cx + 16, cy - 12, 12, 22); g.fillStyle = '#f4ead0'; g.fillRect(cx - 18, cy - 28, 36, 9); }
    else if (m === 'drap') { g.beginPath(); g.arc(cx - 14, cy + 12, 10, 0, Math.PI * 2); g.arc(cx + 14, cy + 12, 10, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx - 10, cy + 4); g.lineTo(cx + 18, cy - 26); g.moveTo(cx + 10, cy + 4); g.lineTo(cx - 18, cy - 26); g.stroke(); }
    else { g.beginPath(); g.arc(cx, cy + 2, 24, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke(); }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// les objets de rue, instanciés : une géométrie chacun, fusionnée une fois
function geoLanterne() {
  const fer = [], verre = [];
  const b = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  fer.push(b(0.05, 0.05, 0.55, 0, 0.35, 0.27), b(0.26, 0.04, 0.26, 0, 0.21, 0.55), b(0.26, 0.04, 0.26, 0, -0.12, 0.55));
  const toit = new THREE.ConeGeometry(0.2, 0.16, 4); toit.rotateY(Math.PI / 4); toit.translate(0, 0.3, 0.55); fer.push(toit);
  verre.push(b(0.2, 0.3, 0.2, 0, 0.05, 0.55));
  return { fer: mergeGeometries(fer.map((g) => g.toNonIndexed())), verre: mergeGeometries(verre.map((g) => g.toNonIndexed())) };
}
function geoTonneau() {
  const g = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 12); g.translate(0, 0.45, 0);
  const cercles = [0.12, 0.78].map((y) => { const t = new THREE.CylinderGeometry(0.37, 0.37, 0.07, 12, 1, true); t.translate(0, y, 0); return t; });
  return { bois: g, fer: mergeGeometries(cercles) };
}
function instancier(geo, m, poses, ombre = true) {
  if (!poses.length) return null;
  const im = new THREE.InstancedMesh(geo, m, poses.length);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  poses.forEach((p, i) => { Q.setFromAxisAngle(Y, p.yaw); S.setScalar(p.s || 1); im.setMatrixAt(i, M4.compose(P.set(p.x, p.y, p.z), Q, S)); });
  im.castShadow = ombre; im.receiveShadow = true; im.computeBoundingSphere();
  return im;
}

// ---------------------------------------------------------------------
//  Matériaux
// ---------------------------------------------------------------------
// Tous en couleurs de sommet : la teinte change d'un bâtiment à l'autre sans multiplier
// les matériaux. phMat(slug, 1, 1) cale une unité d'UV sur un mètre — les UV sont donc
// écrits en mètres, et la brique garde sa taille réelle quelle que soit la façade.
function materiaux() {
  const toit = (slug) => patiner(phMat(slug, 1, 1, { vertexColors: true, roughness: 0.9 }),
    { echelle: 26, force: 0.22, humide: 0, pluie: 0.12 });
  const mur = (slug, extra) => patiner(phMat(slug, 1, 1, { vertexColors: true, roughness: 0.94, ...extra }),
    { echelle: 22, force: 0.26, humide: 3.2, pluie: 0.2 });
  return {
    brique: mur('brique_rouge_06'),
    brique2: mur('stacked_brick_wall'),
    pierre: mur('old_stone_wall_02'),
    enduit: mur('chaux_craquelee'),
    beton: mur('enduit_gris'),
    // Les toitures reçoivent la patine elles aussi : sans elle, un versant de quarante
    // mètres est un aplat, quelle que soit la finesse de la tuile. La patine a la période
    // du BÂTIMENT, pas celle de la tuile — c'est ce qui fait respirer un toitscape.
    tuile: toit('clay_roof_tiles_02'),
    tuile2: toit('clay_roof_tiles'),
    ardoise: patiner(mat(0xffffff, { map: texArdoise(), vertexColors: true, roughness: 0.66, metalness: 0.05 }),
      { echelle: 26, force: 0.24, humide: 0, pluie: 0.1 }),
    zinc: mat(0xffffff, { vertexColors: true, roughness: 0.45, metalness: 0.45 }),
    terrasse: patiner(phMat('rocks_ground_08', 1, 1, { vertexColors: true, roughness: 0.96 }),
      { echelle: 18, force: 0.28, humide: 0, pluie: 0.12 }),
    fenetre: mat(0xffffff, { map: texFenetre(), roughness: 0.55, metalness: 0.05 }),
    porte: mat(0xffffff, { map: texPorte(), roughness: 0.7 }),
    vitrail: mat(0xffffff, { map: texVitrail(), roughness: 0.35, emissive: 0x2a3348, emissiveIntensity: 0.35 }),
    // pierre de taille des bandeaux, du soubassement et des chaperons de pignon :
    // c'est l'alternance brique / pierre blanche qui fait lire un mur comme flamand
    pierreT: phMat('chaux_craquelee', 1, 1, { vertexColors: true, roughness: 0.85 }),
    colombage: patiner(mat(0xffffff, { map: texColombage(), vertexColors: true, roughness: 0.95 }),
      { echelle: 20, force: 0.22, humide: 2.6, pluie: 0.16 }),
    ardoiseU: mat(0xffffff, { vertexColors: true, roughness: 0.62, metalness: 0.06 }),
    // peintes sur du vrai bois (grain, joints) et du vrai fer : cf. phPeint, engine.js
    devanture: phPeint('wood_cabinet_worn_long', 2.4, 2.4, texDevantures(), { roughness: 0.7 }),
    enseigne: (() => { const m = phPeint('wood_cabinet_worn_long', 0.9, 0.7, texEnseignes(), { roughness: 0.75 }); m.side = THREE.DoubleSide; return m; })(),
    ferRue: phMat('metal_plate_02', 0.3, 0.3, { color: 0x4a4540, roughness: 0.6 }),
    verreRue: mat(0xffe2a0, { emissive: 0xffb04a, emissiveIntensity: 0.6, roughness: 0.3 }),
    boisRue: phMat('wood_planks', 1, 1, { color: 0x8a6a48 }),
  };
}
// hasard reproductible : le même bâtiment doit avoir la même teinte à chaque chargement
function hache(i) { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 8) / 16777216; }
const melange = (a, b, t) => a + (b - a) * t;

// Pignon à redents. Un rampant droit lit comme un hangar ; ce sont les gradins de brique
// couronnés de pierre qui font la façade flamande. Le pignon est construit comme un
// prisme : la face extérieure, les dessus de marche et les contremarches.
// LA FACE INTÉRIEURE AUSSI. On la croyait couverte par le toit — elle l'est sous le
// rampant, mais les gradins MONTENT au-dessus : vus de derrière ou depuis le toit, ils
// disparaissaient (face écartée par le tri des faces arrière), et le haut de la façade
// paraissait transparent sur presque toutes les maisons à redents.
function pignonRedents(sMur, sPierre, P, hl, hw, yEg, yFa, sg, tmur, tpierre, n) {
  const dessus = [];                                   // (t, y) du profil en gradins, d'un bord au faîte
  for (let k = 0; k <= n; k++) {
    const t1 = hw * (1 - k / n), t0 = hw * (1 - (k + 1) / n);
    // Le gradin monte jusqu'au toit à son bord INTÉRIEUR (k + 1). Arrêté à la hauteur du toit
    // à son bord extérieur, il laissait le pan de tuiles dépasser en dents de scie entre les
    // marches : vu de biais, une bande de tuiles en diagonale hors du pignon.
    const y = yEg + (yFa - yEg) * ((k + 1) / n);
    dessus.push([t1, y], [t0, y]);
  }
  const EP = 0.22, CH = 0.16;                          // saillie du pignon, épaisseur du chaperon
  const u = sg * hl;
  const dehors = [P(1, 0, 0)[0] - P(0, 0, 0)[0], 0, P(1, 0, 0)[2] - P(0, 0, 0)[2]];
  const n3 = [dehors[0] * sg, 0, dehors[2] * sg], n3i = [-n3[0], 0, -n3[2]];
  for (const cote of [1, -1]) {                        // les deux versants du pignon
    for (let k = 0; k < dessus.length - 1; k += 2) {
      const [tA, y] = dessus[k], [tB] = dessus[k + 1];
      const a = cote * tA, b = cote * tB;
      // chaque gradin descend JUSQU'À L'ÉGOUT. Il ne descendait qu'au gradin précédent :
      // le pignon n'était qu'une diagonale de carrés, vide en dessous, et l'on voyait par
      // ce trou le dessous du toit — que rien ne dessine — donc le ciel. C'était la façade
      // « transparente au niveau du toit » de presque toutes les maisons à redents.
      const yBas = yEg - 0.3;
      // le tableau de la marche : un rectangle plein de brique, vu des deux côtés
      for (const nn of [n3, n3i]) {
        quad(sMur, P(u, a, yBas), P(u, b, yBas), P(u, b, y), P(u, a, y),
          [0, 0], [Math.abs(b - a), 0], [Math.abs(b - a), y - yBas], [0, y - yBas], tmur, nn);
        // le chaperon de pierre qui couronne la marche
        quad(sPierre, P(u, a, y), P(u, b, y), P(u, b, y + CH), P(u, a, y + CH),
          [0, 0], [Math.abs(b - a), 0], [Math.abs(b - a), CH], [0, CH], tpierre, nn);
      }
      quad(sPierre, P(u + sg * EP, a, y + CH), P(u + sg * EP, b, y + CH), P(u, b, y + CH), P(u, a, y + CH),
        [0, 0], [Math.abs(b - a), 0], [Math.abs(b - a), EP], [0, EP], tpierre, [0, 1, 0]);
    }
  }
}

function dansPoly(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
}
function barrePont(p) {
  for (const P of PONTS) for (let i = 0; i < P.pts.length - 1; i++) {
    const a = P.pts[i], b = P.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L);
    for (let k = 0; k <= n; k++) if (dansPoly(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, p)) return true;
  }
  return false;
}
// Les axes de TOUTES les voies relevées et des sentiers, un point par mètre, rangés par cases
// de 20 m, chacun avec le dégagement qu'il réclame (la demi-chaussée dessinée ; 1,2 m pour une
// cour ou un sentier). Les cours d'abord ; puis, à la revue des liaisons (27 septembre), les
// rues aussi : des façades du relevé débordaient jusqu'à l'axe de la rue de l'Arc ou de la rue
// Saint-Jean, et barraient une chaussée qu'on voyait libre.
let COURS = null;
function traverseCour(p) {
  if (!COURS) {
    COURS = new Map();
    const ranger = (m, x, z, v, dg = 0) => { const g = Math.floor(x / 20) * 100003 + Math.floor(z / 20); let l = m.get(g); if (!l) m.set(g, l = []); l.push(x, z, v, dg); };
    // la voie des combattants aussi : elle traversait deux maisons au pied du glacis
    const cours = LILLE.routes.concat(LILLE.chemins, [{ pts: voieCombattants(), r: 3, voieC: true }]);
    const degage = (o) => (o.voieC ? 2.4 : o.r >= 2 && LILLE.routes.includes(o) ? LARGEUR_ROUTE[Math.min(3, o.r)] / 2 - 0.2 : COUR_DEMI);
    // toutes les voies, pour savoir où une cour inachevée retrouve la rue
    const VOIE = new Map(), toutes = LILLE.routes.concat(LILLE.chemins);
    toutes.forEach((o, v) => { for (let i = 0; i < o.pts.length - 1; i++) {
      const a = o.pts[i], b = o.pts[i + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let k = 0; k <= n; k++) ranger(VOIE, a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, v); } });
    const pres = (x, z, sauf) => { const l = VOIE.get(Math.floor(x / 20) * 100003 + Math.floor(z / 20)); if (!l) return false;
      for (let i = 0; i < l.length; i += 4) if (l[i + 2] !== sauf && Math.abs(l[i] - x) < 1.5 && Math.abs(l[i + 1] - z) < 1.5) return true; return false; };
    for (const o of cours) {
      const v = toutes.indexOf(o), dg = degage(o);
      for (let i = 0; i < o.pts.length - 1; i++) {
        const a = o.pts[i], b = o.pts[i + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
        for (let k = 0; k <= n; k++) ranger(COURS, a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, v, dg);
      }
      if (o.voieC || (o.r >= 2 && LILLE.routes.includes(o))) continue;     // une rue ne se prolonge pas
      // Une cour que le relevé arrête à quelques mètres d'une rue, une maison entre les deux :
      // c'est le porche qui manque au tracé. On prolonge le bout dans l'axe, douze mètres au
      // plus, et seulement s'il retrouve une autre voie.
      for (const [q, r] of [[o.pts[0], o.pts[1]], [o.pts[o.pts.length - 1], o.pts[o.pts.length - 2]]]) {
        const L = Math.hypot(q[0] - r[0], q[1] - r[1]) || 1, ux = (q[0] - r[0]) / L, uz = (q[1] - r[1]) / L;
        if (pres(q[0], q[1], v)) continue;                                  // il débouche déjà
        let d = 1; while (d <= 12 && !pres(q[0] + ux * d, q[1] + uz * d, v)) d++;
        if (d <= 12) for (let k = 1; k <= d; k++) ranger(COURS, q[0] + ux * k, q[1] + uz * k, v, dg);
      }
    }
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
  for (let gx = Math.floor(x0 / 20); gx <= Math.floor(x1 / 20); gx++) for (let gz = Math.floor(z0 / 20); gz <= Math.floor(z1 / 20); gz++) {
    const l = COURS.get(gx * 100003 + gz); if (!l) continue;
    for (let i = 0; i < l.length; i += 4) {
      const x = l[i], z = l[i + 1];
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;       // hors de la boîte : pas la peine de tester le polygone
      if (dansPoly(x, z, p)) return true;
    }
  }
  return false;
}
// vrai à moins de deux mètres de l'axe d'une cour, d'un passage ou d'un sentier
function dansCour(x, z) {
  const l = COURS && COURS.get(Math.floor(x / 20) * 100003 + Math.floor(z / 20)); if (!l) return false;
  for (let i = 0; i < l.length; i += 4) if (l[i + 3] <= COUR_DEMI && Math.hypot(l[i] - x, l[i + 1] - z) < 2) return true;
  return false;
}
// Un lot recule chaque mur qui passe à moins du dégagement de l'axe d'une voie (COUR_DEMI
// pour une cour ou un sentier, la demi-chaussée pour une rue). Renvoie vrai s'il a reculé,
// faux sinon, null s'il y perdrait près de la moitié de sa largeur (on ne l'élève pas : la
// cour s'élargit d'autant). Rectangles ET contours relevés irréguliers : ceux-ci restaient
// en place et resserraient la cour Notre-Dame et une ruelle près du bourg. Chaque sommet
// va à l'intersection des deux murs voisins déplacés (ajouter les deux décalages, c'était
// pousser deux fois un sommet entre deux murs presque alignés).
const COUR_DEMI = 1.2;
function degagerCour(PA) {
  const n = PA.poly.length;
  if (n < 3 || !COURS) return false;
  // des copies : le contour d'un lot entier EST celui du relevé (IGN.bati), partagé
  const q = PA.poly.map((v) => v.slice()), r = { ...PA.r };
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const v of q) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); z0 = Math.min(z0, v[1]); z1 = Math.max(z1, v[1]); }
  const pts = [];
  for (let gx = Math.floor((x0 - 4) / 20); gx <= Math.floor((x1 + 4) / 20); gx++) for (let gz = Math.floor((z0 - 4) / 20); gz <= Math.floor((z1 + 4) / 20); gz++) {
    const l = COURS.get(gx * 100003 + gz); if (!l) continue;
    for (let i = 0; i < l.length; i += 4) if (l[i] > x0 - 4 && l[i] < x1 + 4 && l[i + 1] > z0 - 4 && l[i + 1] < z1 + 4) pts.push(l[i], l[i + 1], l[i + 3]);
  }
  if (!pts.length) return false;
  const sens = aireSignee(q) < 0 ? -1 : 1;
  // la place qu'on peut prendre : pour un rectangle, la profondeur ; sinon la plus petite
  // largeur de la boîte orientée du lot
  const largeur = n === 4 ? null : Math.min(r.L, r.W);
  const bes = new Float64Array(n), N = [];
  let bouge = false;
  for (let i = 0; i < n; i++) {
    const a = q[i], c = q[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 0.05) { N.push([0, 0]); continue; }
    const tx = (c[0] - a[0]) / L, tz = (c[1] - a[1]) / L, nx = tz * sens, nz = -tx * sens;   // normale sortante
    N.push([nx, nz]);
    let besoin = 0;
    for (let k = 0; k < pts.length; k += 3) {
      const ex = pts[k] - a[0], ez = pts[k + 1] - a[1], le = ex * tx + ez * tz, d = ex * nx + ez * nz, dg = pts[k + 2];
      if (le > -0.3 && le < L + 0.3 && d > -0.01 && d < dg) besoin = Math.max(besoin, dg - d);
    }
    if (besoin <= 0.02) continue;
    const place = largeur ?? Math.hypot(q[(i + 2) % n][0] - c[0], q[(i + 2) % n][1] - c[1]);
    if (besoin > place * 0.45) return null;
    bes[i] = besoin; bouge = true;
    if (Math.abs(nx * r.ux + nz * r.uz) > 0.7) r.L -= besoin; else if (Math.abs(nx * r.ux + nz * r.uz) < 0.3) r.W -= besoin;
    r.cx -= nx * besoin / 2; r.cz -= nz * besoin / 2;
  }
  if (!bouge) return false;
  const neuf = q.map((v, i) => {
    const e1 = (i - 1 + n) % n, e2 = i, b1 = bes[e1], b2 = bes[e2];
    if (!b1 && !b2) return v;
    const [n1x, n1z] = N[e1], [n2x, n2z] = N[e2];
    // intersection des droites  (P − v)·n1 = −b1  et  (P − v)·n2 = −b2
    const det = n1x * n2z - n1z * n2x;
    if (Math.abs(det) < 0.2) { const b = Math.max(b1, b2), mx = n1x + n2x, mz = n1z + n2z, m = Math.hypot(mx, mz) || 1; return [v[0] - mx / m * b, v[1] - mz / m * b]; }
    const dx = (-b1 * n2z + b2 * n1z) / det, dz = (-b2 * n1x + b1 * n2x) / det;
    return [v[0] + dx, v[1] + dz];
  });
  if (aireSignee(neuf) * sens < aireSignee(q) * sens * 0.4) return null;   // le contour s'est retourné ou effondré
  r.A = r.L * r.W; PA.aire = r.A; PA.poly = neuf; PA.r = r;
  return true;
}
const RMUR = 0.3;                // rayon des capsules de façade (cf. « collisions » dans batirQuartier)
export function batirQuartier() {
  const M = materiaux();
  const sacs = new Map();
  // Un sac par matériau ET par tuile (cf. mergeStatics, engine.js) : un seul sac de
  // fenêtres pour toute la ville faisait un maillage d'un kilomètre de rayon, toujours
  // dessiné, dans l'image comme dans l'ombre.
  let tuile = '';
  const prendre = (m) => { const k = m.uuid + '|' + tuile; let s = sacs.get(k); if (!s) sacs.set(k, s = sac(m)); return s; };
  // LE RELIEF DES FAÇADES. Fenêtres et portes étaient des images collées à cinq centimètres
  // du mur : de près, la rue lisait plate (Eugène, 27 septembre). Chaque baie reçoit un appui
  // et un linteau de pierre EN SAILLIE, chaque porte une marche et un encadrement : des
  // arêtes qui prennent la lumière. 56 000 baies × 8 triangles, c'est trop pour toute la
  // ville à la fois : ce relief vit dans des sacs à part, par tuile, que des LOD n'affichent
  // qu'à moins de 140 m — au-delà, on ne le distinguerait pas.
  const reliefs = new Map();
  const prendreRelief = () => { let s = reliefs.get(tuile); if (!s) reliefs.set(tuile, s = sac(M.pierreT)); return s; };
  const grp = new THREE.Group();
  grp.name = 'quartier';
  let porches = 0, degages = 0, horsEmprise = 0;
  const lointains = [];
  let bati = 0, ecarte = 0, caps = 0, baies = 0, bourg = 0, pignons = 0, cheminees = 0, lucarnes = 0, boutiques = 0;
  const lanternes = [], tonneaux = [], caisses = [], vitrines = [];   // vitrines : pour les bancs d'essai
  const compteToit = { pans: 0, croupe: 0, terrasse: 0 };

  for (let idx = 0; idx < IGN.bati.length; idx++) {
    const b = IGN.bati[idx];
    let p = b.p.slice();
    if (p.length > 2 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
    if (p.length < 3) { ecarte++; continue; }
    let A = aireSignee(p);
    if (A < 0) { p.reverse(); A = -A; }
    if (A < 12) { ecarte++; continue; }                       // abris de jardin : on ne les élève pas
    p = simplifier(p);
    A = Math.abs(aireSignee(p));
    if (p.length < 3 || A < 10) { ecarte++; continue; }
    const cx = p.reduce((t, q) => t + q[0], 0) / p.length, cz = p.reduce((t, q) => t + q[1], 0) / p.length;
    tuile = cleTuile(cx, cz);
    // Ce qui est dans le fossé ou dans la place est déjà bâti par citadelle.js — les 34
    // emprises que la BD TOPO y relève sont le zoo et le parc d'aujourd'hui, pas 1670.
    if (sdPent(cx, cz) < MOAT_OUT + 10) { ecarte++; continue; }
    if (b.n === 'Fort, blockhaus, casemate') { ecarte++; continue; }   // un blockhaus de 1940 n'a rien à faire là
    // L'îlot du bourg. Il cédait toute sa place aux maisons inventées de village.js ; depuis le
    // 5 octobre (Eugène), le bâti relevé y revient, et ne cède plus qu'aux monuments gardés —
    // le beffroi, la chapelle et son cimetière (village.js, PARTAGE.batiBourg). Les commerces
    // du bourg se posent dans ses façades (PARTAGE.facadeBourg, plus bas).
    { const [lx, lz] = townLocal(cx, cz), B = TOWN_BOITE;
      if (lx > B.x0 - 12 && lx < B.x1 + 12 && lz > B.z0 - 12 && lz < B.z1 + 12 && PARTAGE.batiBourg && PARTAGE.batiBourg(p)) { ecarte++; bourg++; continue; } }
    if (!dansEnceinte(cx, cz) || Math.hypot(cx, cz) > PLAINE_R - 25) { ecarte++; continue; }
    if (sdEau(cx, cz) < 2) { ecarte++; continue; }            // le relevé pose quelques hangars sur la rive
    // une emprise sur l'axe d'un pont (culées prolongées comprises) : la passerelle de
    // Soubise arrivait droit dans une façade, on ne la traversait plus
    if (barrePont(p)) { ecarte++; continue; }
    // LA VILLE RESSERRÉE (carte.js, VILLE) : hors de l'emprise, plus de maison praticable.
    // Jusqu'à 260 m au-delà, un volume bas — quatre murs et deux pans — pour que l'horizon
    // ne soit pas vide ; plus loin, rien. On ne s'en approche pas (horsVille, levelBlocked).
    // Le premier rang hors de l'emprise (35 m) reste une vraie maison, sans collision : c'est
    // lui qu'on voit au bout des rues, et en volume nu il montrait des pignons aveugles.
    const premierRang = !dansVille(cx, cz) && sdVille(cx, cz) < 35;
    if (!dansVille(cx, cz) && !premierRang) {
      ecarte++; horsEmprise++;
      if (sdVille(cx, cz) < LOINTAIN) { const r = rectMin(p);
        if (r) { let y = Infinity; for (const q of p) y = Math.min(y, solPlaine(q[0], q[1]));
          lointains.push({ r, y, H: b.n === 'Eglise' ? Math.min(b.h || 19, 24) : Math.min(Math.max(b.h > 0 ? b.h : 9.5, 4), 15.5), g: idx }); } }
      continue;
    }

    const rB = rectMin(p);
    if (!rB) { ecarte++; continue; }

    // hauteur : le relevé quand il l'a, sinon un défaut par usage
    const parDefaut = b.n === 'Eglise' ? 19 : b.u === 'Annexe' ? 3.2 : b.u === 'Industriel' ? 7.5
      : b.n === 'Industriel, agricole ou commercial' ? 6.5 : 9.5;
    const eglise = b.n === 'Eglise' || b.n === 'Tour, donjon';
    // PLAFOND DES HAUTEURS. La BD TOPO monte à 34,20 m : c'est une barre d'après-guerre.
    // Une maison de ville flamande tient en quatre niveaux sous comble. Seuls les
    // clochers et les tours gardent la hauteur relevée.
    let HB = b.h > 0 ? b.h : parDefaut;
    if (!eglise) HB = Math.min(Math.max(HB, 4), 15.5);

    // sol : le terrain est déjà terrassé sous les emprises, mais il n'est pas horizontal.
    // On prend le plus bas des sommets pour l'assise et le plus haut pour l'égout, et on
    // enfonce l'assise d'un mètre et demi : sinon un mur décolle du sol en bas de pente.
    let yBas = Infinity, yHaut = -Infinity;
    for (const q of p) { const y = solPlaine(q[0], q[1]); if (y < yBas) yBas = y; if (y > yHaut) yHaut = y; }
    const base = yBas - 1.6;
    const pleinB = A / Math.max(1, rB.A);     // 1 = le bâtiment EST son rectangle

    // ---------------------------------------------------------------
    //  DÉCOUPE EN PARCELLES
    // ---------------------------------------------------------------
    // Un « immeuble » de trente mètres de façade n'existe pas dans une ville flamande :
    // la rue est une suite de maisons ÉTROITES, pignon sur rue, chacune avec sa hauteur,
    // sa teinte et son léger décrochement de façade. On découpe donc les longues emprises
    // dans le sens de la rue, en lots de sept mètres, et chaque lot devient une maison
    // dont le faîtage court vers le fond — donc dont le pignon regarde la rue.
    const parcelles = [];
    // une emprise irrégulière devient plusieurs rectangles (cf. decouperRectangles) ;
    // les églises gardent leur volume d'un tenant
    const morceaux = !eglise && pleinB < 0.95 ? decouperRectangles(p, rB) : null;
    for (const [mi, bloc] of (morceaux || [{ poly: p, r: rB, entier: true }]).entries()) {
      const R = bloc.r, gm = idx * 131 + mi * 977;
      // un morceau découpé EST son rectangle : il peut toujours se lotir
      const nP = (!eglise && (bloc.entier ? pleinB > 0.68 : true) && R.L > 13) ? Math.max(2, Math.round(R.L / 7.2)) : 1;
      if (nP === 1) parcelles.push({ poly: bloc.poly, r: R, H: HB, aire: bloc.entier ? A : R.A, graine: bloc.entier ? idx : gm, seule: true });
      else {
        const { ux, uz } = R, vx = -uz, vz = ux;
        const pu = R.L / nP, hwq = R.W / 2;
        const rec = (rs, rt) => [R.cx + ux * rs + vx * rt, R.cz + uz * rs + vz * rt];
        for (let i = 0; i < nP; i++) {
          const s0 = -R.L / 2 + i * pu, s1 = s0 + pu;
          const hq = hache(gm + i * 17);
          const av = (hq - 0.5) * 0.55;                 // la rue n'est pas un plan
          const poly = [rec(s0, -hwq + av), rec(s1, -hwq + av), rec(s1, hwq + av), rec(s0, hwq + av)];
          const c2 = rec((s0 + s1) / 2, av);
          // LE FAÎTAGE COURT TOUJOURS DANS LE PLUS GRAND SENS. On le mettait d'office
          // dans la profondeur pour avoir le pignon sur rue — mais quand la maison est
          // moins profonde que large, le demi-faîtage `hl - W/2` devient NÉGATIF, le toit
          // se retourne, et l'on obtient ces poutres qui partent dans le ciel et ces
          // pignons à redents décrochés du bâtiment.
          const profond = R.W >= pu;
          parcelles.push({
            poly,
            r: { cx: c2[0], cz: c2[1],
              ux: profond ? vx : ux, uz: profond ? vz : uz,
              L: profond ? R.W : pu, W: profond ? pu : R.W, A: pu * R.W },
            H: HB * (0.86 + 0.26 * hq), aire: pu * R.W, graine: gm + i * 17, seule: false,
          });
        }
      }
    }

    // ---- les porches ----
    // Le relevé fait passer 130 cours et sentiers À TRAVERS une emprise bâtie : c'est un
    // porche, la cour s'ouvre sous la maison. Dessinée pleine, la maison enfermait la cour
    // (Corderie, Cygne, Cado…) — une rue dessinée au fond d'un îlot, où l'on n'entre pas.
    // Le lot traversé n'est pas élevé : la cour débouche sur la rue par une ruelle.
    // (chaque lot, et pas seulement le contour : un rectangle d'approximation déborde du
    // relevé jusqu'à 1,25 m, et c'est lui qui bouchait l'entrée de la cour de la Corderie)
    for (let i = parcelles.length - 1; i >= 0; i--) if (traverseCour(parcelles[i].poly)) { parcelles.splice(i, 1); porches++; }
    // Et les lots qui la bordent reculent : leurs rectangles approchent le contour à
    // ±1,25 m, et une cour de deux mètres n'était plus qu'une fente entre deux façades.
    for (let i = parcelles.length - 1; i >= 0; i--) { const e = degagerCour(parcelles[i]);
      if (e === null) { parcelles.splice(i, 1); porches++; } else if (e) degages++; }

    // ---- collisions : les murs DESSINÉS ----
    // Elles suivaient le contour relevé, alors que les murs, eux, suivent les parcelles —
    // des rectangles qui approchent le contour à ±1,25 m (decouperRectangles), et qui
    // laissent tomber les redans de moins de 1,6 m. Partout où le dessin rentrait, il
    // restait un mur invisible dans la rue ; partout où il débordait, on entrait dans la
    // façade. Et la capsule de 0,45 était CENTRÉE sur le mur : ajoutée au rayon de Camille,
    // elle l'arrêtait à près d'un mètre des façades, et une cour de deux mètres ne passait
    // plus (Eugène, 26 septembre : « des routes libres mais impossible d'avancer »). Chaque
    // capsule est donc posée sur un mur de parcelle, décalée vers l'intérieur de son rayon :
    // son bord affleure la façade. Les murs mitoyens en reçoivent une aussi ; on ne les
    // atteint jamais, elles ne coûtent qu'un peu de mémoire.
    if (!premierRang) for (const PA of parcelles) {
      const q = PA.poly, sens = aireSignee(q) < 0 ? -1 : 1;   // les lots découpés ne sont pas orientés
      for (let i = 0; i < q.length; i++) {
        const a = q[i], c = q[(i + 1) % q.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (L < 0.05) continue;
        const ix = -(c[1] - a[1]) / L * RMUR * sens, iz = (c[0] - a[0]) / L * RMUR * sens;   // normale rentrante
        addCap(a[0] + ix, a[1] + iz, c[0] + ix, c[1] + iz, RMUR, yHaut + HB + 4); caps++;
      }
    }

    for (const PA of parcelles) {
      const p2 = PA.poly, r = PA.r, H = PA.H, A2 = PA.aire, gr = PA.graine;

      // forme du toit
      const large = r.W;
      let forme = 'pans', pente;
      if (eglise) {
        forme = pleinB < 0.55 ? 'terrasse' : 'croupe';
        pente = forme === 'terrasse' ? 0 : Math.min(Math.max(large * (H > 18 ? 1.5 : 0.8), 3), 26);
      } else {
        // PLUS AUCUN TOIT-TERRASSE. Ils étaient 505, c'est-à-dire 505 immeubles modernes
        // au milieu d'une ville médiévale. Et le comble est raide : 0,62 de la largeur,
        // soit 50° environ, la pente des combles du Nord.
        // et l'on ne fait une croupe que si le bâtiment est effectivement plus long que
        // large : sur un carré, la croupe dégénère en pyramide et le faîtage disparaît
        forme = (large > 13 && r.L > r.W * 1.25) ? 'croupe' : 'pans';
        pente = Math.min(Math.max(large * 0.62, 2.8), 9);
      }
      const egout = Math.max(2.6, H - pente);
      const yEgout = yHaut + egout, yFaite = yHaut + egout + pente;
      compteToit[forme]++;

      // ---- teintes ----
      const cm = b.m ? b.m[0] : '', ct = b.t ? b.t[0] : '';
      const h1 = hache(gr), h2 = hache(gr * 7 + 3), h3 = hache(gr * 13 + 11);
      // PLUS DE BÉTON : la pierre, la brique et la chaux. Le code « 3 » du relevé vaut
      // aujourd'hui béton ; ici il vaut enduit à la chaux sur brique.
      // (5 octobre) LA PIERRE DE LILLE. Les façades déclarées en pierre étaient TOUTES en
      // pierre grise, presque blanche, et toutes pareilles : au quai du Wault, une rangée
      // de murs de calcaire uniformes. Lille bâtit en brique et en pierre de Lezennes, une
      // craie jaunâtre qui grisaille ; le rang-de-Lille mêle les deux. Une sur deux reste en
      // pierre (teinte chaude, plus ou moins patinée), l'autre passe à la brique.
      let matMur = cm === '1' || cm === '2' ? (h1 < 0.5 ? M.pierre : h1 < 0.8 ? M.brique2 : M.brique) : cm === '3' ? M.enduit
        : cm === '4' ? (h1 < 0.55 ? M.brique : h1 < 0.93 ? M.brique2 : M.colombage)
          : h1 < 0.48 ? M.brique : h1 < 0.68 ? M.brique2 : h1 < 0.74 ? M.enduit
            : h1 < 0.95 ? M.colombage : M.pierre;
      if (eglise) matMur = M.pierre;
      const tmur = matMur === M.colombage
        ? [melange(0.92, 1.06, h2), melange(0.90, 1.04, h2), melange(0.86, 1.00, h2)]
        : matMur === M.pierre
        // de la craie jaune à peine posée (0,92) à la pierre noircie par la suie (0,62)
        ? [melange(0.66, 0.94, h2), melange(0.60, 0.88, h2), melange(0.48, 0.74, h2)]
        // l'enduit à la chaux reçoit un badigeon : ocre, crème ou gris rosé, plus ou moins
        // passé — blanc pur, la longue rangée du quai du Wault (« 30 » au relevé) éblouissait
        : matMur === M.enduit
        ? [[0.96, 0.82, 0.58], [0.93, 0.88, 0.76], [0.86, 0.77, 0.73]][Math.floor(h3 * 2.999)].map((c) => c * melange(0.78, 1.0, h2))
        : [melange(0.74, 1.14, h2), melange(0.66, 1.02, h2), melange(0.62, 0.96, h2)];
      // PLUS DE ZINC : tuile de terre cuite, ardoise sur les clochers et quelques combles
      let matToit = forme === 'terrasse' ? M.terrasse
        : eglise ? M.ardoise
          : ct === '2' ? M.ardoise
            : h3 < 0.62 ? M.tuile : h3 < 0.88 ? M.tuile2 : M.ardoise;
      let ttoit;
      if (matToit === M.ardoise) ttoit = [melange(0.20, 0.30, h3), melange(0.24, 0.34, h3), melange(0.30, 0.40, h3)];
      else if (matToit === M.terrasse) ttoit = [melange(0.26, 0.36, h3), melange(0.26, 0.35, h3), melange(0.25, 0.32, h3)];
      else ttoit = [melange(0.78, 1.12, h3), melange(0.70, 1.00, h3), melange(0.66, 0.94, h3)];

      const sMur = prendre(matMur), sToit = prendre(matToit);
      const sFen = prendre(M.fenetre), sPor = prendre(M.porte), sVit = prendre(M.vitrail);
      const sPierre = prendre(M.pierreT);
      const tpierre = [melange(0.66, 0.82, h2), melange(0.66, 0.81, h2), melange(0.63, 0.78, h2)];

      // la façade qui reçoit la porte : la rue quand on la trouve, la plus longue sinon
      let iPorte = 0, lPorte = PA.seule ? 0 : Infinity;
      for (let i = 0; i < p2.length; i++) {
        const a = p2[i], c = p2[(i + 1) % p2.length];
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (PA.seule ? L > lPorte : L < lPorte) { lPorte = L; iPorte = i; }
      }
      if (!PA.seule) {
        // des deux pignons, celui qui donne sur une voie relevée
        for (let i = 0; i < p2.length; i++) {
          const a = p2[i], c = p2[(i + 1) % p2.length];
          const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
          if (L > lPorte + 0.5) continue;
          const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
          const nx = (c[1] - a[1]) / (L || 1), nz = -(c[0] - a[0]) / (L || 1);
          if (surVoie(mx + nx * 5, mz + nz * 5)) { iPorte = i; break; }
        }
      }
      const perce = H >= 4.2 && b.u !== 'Annexe' && A2 >= 20;
      const BLANC = [1, 1, 1];

      // ---- murs ----
      let u = 0;
      for (let i = 0; i < p2.length; i++) {
        const a = p2[i], c = p2[(i + 1) % p2.length];
        const dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz);
        if (L < 0.05) continue;
        const tx = dx / L, tz = dz / L;
        const nx = dz / L, nz = -dx / L;                 // contour direct : la normale sort
        quad(sMur,
          [a[0], base, a[1]], [c[0], base, c[1]], [c[0], yEgout, c[1]], [a[0], yEgout, a[1]],
          [u, 0], [u + L, 0], [u + L, yEgout - base], [u, yEgout - base], tmur, [nx, 0, nz]);
        u += L;

        // ---- cordons de pierre ----
        if (perce) {
          const ySol0 = solPlaine(a[0] + tx * L / 2, a[1] + tz * L / 2);
          const cordon = (y0, hh, pr) => {
            const ox = nx * pr, oz = nz * pr;
            quad(sPierre, [a[0] + ox, y0, a[1] + oz], [c[0] + ox, y0, c[1] + oz],
              [c[0] + ox, y0 + hh, c[1] + oz], [a[0] + ox, y0 + hh, a[1] + oz],
              [0, 0], [L, 0], [L, hh], [0, hh], tpierre, [nx, 0, nz]);
          };
          cordon(ySol0 + 0.55, 0.14, 0.045);                     // soubassement
          for (let f = 1; f < 7; f++) {
            const y = ySol0 + 0.55 + f * 3.15;
            if (y + 0.4 > yEgout - 0.5) break;
            cordon(y, 0.13, 0.045);                              // bandeau d'étage
          }
          if (yEgout - 0.36 > ySol0 + 1) cordon(yEgout - 0.36, 0.26, 0.085);  // corniche
        }

        // ---- baies ----
        if (!perce || L < 2.6) continue;
        const baie = (s2, sc, y0, w, hh) => {
          const ox = a[0] + tx * sc + nx * 0.05, oz = a[1] + tz * sc + nz * 0.05;
          quad(s2,
            [ox - tx * w / 2, y0, oz - tz * w / 2], [ox + tx * w / 2, y0, oz + tz * w / 2],
            [ox + tx * w / 2, y0 + hh, oz + tz * w / 2], [ox - tx * w / 2, y0 + hh, oz - tz * w / 2],
            [0, 0], [1, 0], [1, 1], [0, 1], BLANC, [nx, 0, nz]);
        };
        // une tablette de pierre en saillie : dessus (ou dessous) et face, en mètres d'UV
        const X = (sc, d, y) => [a[0] + tx * sc + nx * d, y, a[1] + tz * sc + nz * d];
        const tablette = (sR, s0, s1, yb, yh, d0, d1, dessous) => {
          const yF = dessous ? yb : yh;
          quad(sR, X(s0, d0, yF), X(s1, d0, yF), X(s1, d1, yF), X(s0, d1, yF),
            [0, 0], [s1 - s0, 0], [s1 - s0, d1 - d0], [0, d1 - d0], tpierre, [0, dessous ? -1 : 1, 0]);
          quad(sR, X(s0, d1, yb), X(s1, d1, yb), X(s1, d1, yh), X(s0, d1, yh),
            [0, 0], [s1 - s0, 0], [s1 - s0, yh - yb], [0, yh - yb], tpierre, [nx, 0, nz]);
        };
        const reliefBaie = (sc, y0, w, hh) => {
          const sR = prendreRelief();
          tablette(sR, sc - w / 2 - 0.12, sc + w / 2 + 0.12, y0 - 0.1, y0, 0.03, 0.17, false);        // l'appui
          tablette(sR, sc - w / 2 - 0.08, sc + w / 2 + 0.08, y0 + hh, y0 + hh + 0.17, 0.03, 0.12, true);   // le linteau
        };
        const reliefPorte = (sc, y0, w, hh) => {
          const sR = prendreRelief();
          tablette(sR, sc - w / 2 - 0.25, sc + w / 2 + 0.25, y0 - 0.02, y0 + 0.16, 0.03, 0.4, false);    // la marche
          for (const sx of [-1, 1]) {                                                                  // les piédroits
            const e0 = sc + sx * (w / 2), e1 = sc + sx * (w / 2 + 0.18);
            const [s0, s1] = sx < 0 ? [e1, e0] : [e0, e1];
            quad(sR, X(s0, 0.13, y0 + 0.16), X(s1, 0.13, y0 + 0.16), X(s1, 0.13, y0 + hh + 0.2), X(s0, 0.13, y0 + hh + 0.2),
              [0, 0], [0.18, 0], [0.18, hh], [0, hh], tpierre, [nx, 0, nz]);
            quad(sR, X(e0, 0.03, y0 + 0.16), X(e0, 0.13, y0 + 0.16), X(e0, 0.13, y0 + hh + 0.2), X(e0, 0.03, y0 + hh + 0.2),
              [0, 0], [0.1, 0], [0.1, hh], [0, hh], tpierre, [-tx * sx, 0, -tz * sx]);
          }
          tablette(sR, sc - w / 2 - 0.18, sc + w / 2 + 0.18, y0 + hh + 0.2, y0 + hh + 0.42, 0.03, 0.15, true);  // le linteau
        };
        const ySol = solPlaine(a[0] + tx * L / 2, a[1] + tz * L / 2);
        // LE SEUIL (5 octobre). Le trottoir est monté de 14 cm au-dessus de la chaussée et va
        // jusqu'au pied des murs (carte.js, voiriesLille) : posées au relief, portes, devantures
        // et marchandises s'y enfonçaient. On les pose sur ce qui est dessiné devant elles.
        const devant = (sc) => { const [x, , z] = X(sc, 0.6, 0); return solPlaine(x, z) + epaisseurVoie(x, z); };
        if (eglise) {
          const ne = Math.floor(L / 5.2);
          if (ne < 1) continue;
          const ph = Math.min(Math.max((yEgout - ySol) * 0.58, 2.2), 7.5), pw = ph * 0.38;
          for (let ci = 0; ci < ne; ci++) { baie(sVit, (ci + 0.5) * (L / ne), ySol + (yEgout - ySol) * 0.26, pw, ph); baies++; }
          continue;
        }
        const nc = Math.floor(L / 2.9);
        if (nc < 1) continue;
        const pas = L / nc;
        // un mur de la grand-rue du bourg réservé par un commerce (village.js) : le commerce s'y
        // pose, et le rez-de-chaussée reste aveugle derrière lui — ni porte, ni boutique, ni baie
        const sensP = aireSignee(p2) < 0 ? -1 : 1;
        const reserve = !premierRang && PARTAGE.facadeBourg ? PARTAGE.facadeBourg(a, c, nx * sensP, nz * sensP) : false;
        const colPorte = i === iPorte && !reserve ? Math.floor(nc / 2) : -1;
        // une boutique : façade de la porte, sur une voie, une maison sur quatre
        const surRue = colPorte >= 0 && surVoie(a[0] + tx * L / 2 + nx * 5, a[1] + tz * L / 2 + nz * 5);
        const boutique = surRue && hache(gr * 31 + 7) < 0.26 && nc >= 2 && ySol + 3.4 < yEgout;
        const metier = Math.floor(hache(gr * 53 + 1) * 4);
        if (boutique) {
          const sD = prendre(M.devanture), u0 = metier / 4, u1 = u0 + 0.25;
          for (let ci = 0; ci < nc; ci++) {
            if (ci === colPorte) continue;
            const sc = (ci + 0.5) * pas, w = pas - 0.25, y0 = Math.max(ySol + 0.1, devant(sc) + 0.04), hh = 2.5;
            const ox = a[0] + tx * sc + nx * 0.06, oz = a[1] + tz * sc + nz * 0.06;
            quad(sD, [ox - tx * w / 2, y0, oz - tz * w / 2], [ox + tx * w / 2, y0, oz + tz * w / 2],
              [ox + tx * w / 2, y0 + hh, oz + tz * w / 2], [ox - tx * w / 2, y0 + hh, oz - tz * w / 2],
              [u0, 0], [u1, 0], [u1, 1], [u0, 1], BLANC, [nx, 0, nz]);
            // de la marchandise devant — sauf dans une cour ou un passage : un tonneau y bouche tout
            if (hache(gr + ci * 3) < 0.55 && !dansCour(a[0] + tx * (sc + 0.4) + nx * 0.8, a[1] + tz * (sc + 0.4) + nz * 0.8)) {
              const px = a[0] + tx * (sc + 0.4) + nx * 0.8, pz = a[1] + tz * (sc + 0.4) + nz * 0.8;
              // +10 cm : la dalle du trottoir est dessinée 8 à 15 cm au-dessus du relief (solVille,
              // voiriesLille) ; posés sur le relief nu, tonneaux et caisses s'y enfonçaient
              (metier === 1 ? tonneaux : caisses).push({ x: px, y: solPlaine(px, pz) + Math.max(0.1, epaisseurVoie(px, pz)), z: pz, yaw: hache(gr + ci) * 6.28 });
            }
          }
          // l'enseigne en potence, à côté de la porte
          { const sc = (colPorte + 0.5) * pas + 1.0, sE = prendre(M.enseigne), y0 = ySol + 2.9, d0 = 0.35, d1 = 1.15;
            const P0 = X(sc, d0, y0), P1 = X(sc, d1, y0), P2 = X(sc, d1, y0 + 0.7), P3 = X(sc, d0, y0 + 0.7);
            quad(sE, P0, P1, P2, P3, [metier / 4, 0], [metier / 4 + 0.25, 0], [metier / 4 + 0.25, 1], [metier / 4, 1], BLANC, [tx, 0, tz]);
            quad(prendre(M.ferRue), X(sc, 0.03, y0 + 0.78), X(sc, d1 + 0.05, y0 + 0.78), X(sc, d1 + 0.05, y0 + 0.84), X(sc, 0.03, y0 + 0.84),
              [0, 0], [1, 0], [1, 0.06], [0, 0.06], BLANC, [tx, 0, tz]);     // la potence de fer
          }
          boutiques++; vitrines.push({ x: a[0] + tx * L / 2, z: a[1] + tz * L / 2, nx, nz });
        }
        // une lanterne près d'une porte sur trois qui donne sur la rue
        if (surRue && hache(gr * 17 + 5) < 0.4) {
          const sc = (colPorte + 0.5) * pas - 1.0, ly = ySol + 2.7;
          lanternes.push({ x: a[0] + tx * sc + nx * 0.02, y: ly, z: a[1] + tz * sc + nz * 0.02, yaw: Math.atan2(nx, nz) });
        }
        for (let ci = 0; ci < nc; ci++) {
          const sc = (ci + 0.5) * pas;
          for (let f = 0; f < 7; f++) {
            const appui = ySol + 0.95 + f * 3.15;
            if (appui + 1.6 > yEgout - 0.4) break;
            if (f === 0 && (reserve || ci === colPorte || boutique)) continue;
            baie(sFen, sc, appui, 1.24, 1.56); reliefBaie(sc, appui, 1.24, 1.56); baies++;
          }
        }
        if (colPorte >= 0 && ySol + 2.35 < yEgout - 0.3) { const sc = (colPorte + 0.5) * pas, y0 = Math.max(ySol, devant(sc)) + 0.02;
          baie(sPor, sc, y0, 1.18, 2.3); reliefPorte(sc, y0, 1.18, 2.3); }
      }
      // plafond à l'égout : sans lui on voit l'intérieur du volume par-dessous le toit
      {
        const ct2 = p2.map((q) => new THREE.Vector2(q[0], q[1]));
        let faces = [];
        try { faces = THREE.ShapeUtils.triangulateShape(ct2, []); } catch (e) { faces = []; }
        const yc = forme === 'terrasse' ? yEgout : yEgout + 0.02;
        const sc = forme === 'terrasse' ? sToit : sMur;
        const cc = forme === 'terrasse' ? ttoit : tmur;
        for (const f of faces) {
          const A3 = p2[f[0]], B3 = p2[f[1]], C3 = p2[f[2]];
          if (!A3 || !B3 || !C3) continue;
          tri(sc, [A3[0], yc, A3[1]], [B3[0], yc, B3[1]], [C3[0], yc, C3[1]],
            [A3[0], A3[1]], [B3[0], B3[1]], [C3[0], C3[1]], cc, [0, 1, 0]);
        }
      }

      // ---- toiture ----
      if (forme !== 'terrasse') {
        const OV = 0.38;
        const { ux, uz } = r, vx = -uz, vz = ux;
        const P = (s2, t, y) => [r.cx + ux * s2 + vx * t, y, r.cz + uz * s2 + vz * t];
        const hl = r.L / 2, hw = r.W / 2 + OV;
        // demi-faîtage : jamais négatif, sinon la croupe se croise sur elle-même
        const sf = forme === 'croupe' ? Math.max(0, hl - r.W / 2) : hl;
        const rampant = Math.hypot(hw, pente);
        for (const sg of [1, -1]) {
          const e0 = P(-hl, sg * hw, yEgout), e1 = P(hl, sg * hw, yEgout);
          const f0 = P(-sf, 0, yFaite), f1 = P(sf, 0, yFaite);
          quad(sToit, e0, e1, f1, f0,
            [0, 0], [r.L, 0], [hl + sf, rampant], [hl - sf, rampant], ttoit, [vx * sg * pente, hw, vz * sg * pente]);
        }
        // ---- lucarnes ----
        if (pente >= 2.6 && r.L >= 5.5 && sf > 0.6 && hw > 1.2) {
          const nl = Math.min(2, Math.floor(r.L / 6.5));
          const f = 0.44, LW = 0.62, LH = 1.45;
          for (const sg of [1, -1]) for (let li = 0; li < nl; li++) {
            const su = (li + 0.5) / nl * r.L - r.L / 2;
            if (Math.abs(su) > sf + 0.5) continue;
            const tf = sg * (hw - OV) * (1 - f), yb = yEgout + pente * f;
            const dirT = [vx * sg, 0, vz * sg];
            const A3 = P(su - LW, tf, yb), B3 = P(su + LW, tf, yb);
            const C3 = P(su + LW, tf, yb + LH), D3 = P(su - LW, tf, yb + LH);
            quad(sFen, [A3[0], A3[1] + 0.03, A3[2]], [B3[0], B3[1] + 0.03, B3[2]], C3, D3,
              [0, 0], [1, 0], [1, 1], [0, 1], BLANC, dirT);
            for (const sx of [-1, 1]) {
              const px = su + sx * LW;
              const t2 = sg * (hw - OV) * (1 - f - 0.42), y2 = yEgout + pente * (f + 0.42);
              tri(sToit, P(px, tf, yb), P(px, t2, y2), P(px, tf, yb + LH),
                [0, 0], [1.2, 0], [0, LH], ttoit, [ux * sx, 0, uz * sx]);
              quad(sToit, P(px - sx * 0.12, tf, yb + LH), P(px - sx * 0.12, t2, y2 + 0.24),
                P(px + sx * 0.12, t2, y2 + 0.24), P(px + sx * 0.12, tf, yb + LH),
                [0, 0], [1.3, 0], [1.3, 0.25], [0, 0.25], ttoit, [0, 1, 0]);
            }
          }
          lucarnes += nl * 2;
        }
        if (forme === 'croupe') {
          for (const sg of [1, -1]) {
            const e0 = P(sg * hl, -hw, yEgout), e1 = P(sg * hl, hw, yEgout);
            const f = P(sg * sf, 0, yFaite);
            tri(sToit, e0, e1, f, [0, 0], [r.W + 2 * OV, 0], [hw, rampant], ttoit, [ux * sg, hw, uz * sg]);
          }
        } else {
          const redents = large <= 13 && pente >= 2.0 && hw > 1.2 && yFaite > yEgout + 0.5;
          for (const sg of [1, -1]) {
            if (redents) {
              const n = Math.min(7, Math.max(3, Math.round(pente / 0.8)));
              pignonRedents(sMur, sPierre, P, hl, hw, yEgout, yFaite, sg, tmur, tpierre, n);
              pignons++;
            } else {
              const e0 = P(sg * hl, -hw, yEgout), e1 = P(sg * hl, hw, yEgout);
              const f = P(sg * hl, 0, yFaite);
              tri(sMur, e0, e1, f, [0, 0], [r.W + 2 * OV, 0], [hw, pente], tmur, [ux * sg, 0, uz * sg]);
            }
          }
        }
        // ---- cheminée ----
        {
          const su = (h1 < 0.5 ? -1 : 1) * sf * 0.62, CW = 0.42, CH2 = 1.5 + h3 * 0.9;
          const y0 = yFaite - 0.35, y1 = yFaite + CH2;
          const co = [[-CW, -CW], [CW, -CW], [CW, CW], [-CW, CW]].map(([ds, dt]) => P(su + ds, dt, 0));
          for (let k = 0; k < 4; k++) {
            const A3 = co[k], B3 = co[(k + 1) % 4];
            const dxx = B3[0] - A3[0], dzz = B3[2] - A3[2], Lc = Math.hypot(dxx, dzz) || 1;
            quad(sMur, [A3[0], y0, A3[2]], [B3[0], y0, B3[2]], [B3[0], y1, B3[2]], [A3[0], y1, A3[2]],
              [0, 0], [Lc, 0], [Lc, y1 - y0], [0, y1 - y0], tmur, [dzz / Lc, 0, -dxx / Lc]);
          }
          quad(sPierre, [co[0][0], y1, co[0][2]], [co[1][0], y1, co[1][2]], [co[2][0], y1, co[2][2]], [co[3][0], y1, co[3][2]],
            [0, 0], [CW * 2, 0], [CW * 2, CW * 2], [0, CW * 2], tpierre, [0, 1, 0]);
          cheminees++;
        }
      }
    }
    bati++;
  }

  // un commerce du bourg qu'aucun mur n'a porté se pose quand même (village.js)
  if (PARTAGE.facadeBourgFin) PARTAGE.facadeBourgFin();
  for (const s of sacs.values()) { const o = cuire(s); if (o) grp.add(o); }
  grp.add(decorLointain(M, lointains));
  grp.add(portesDeVille(M));
  // le relief, par tuile, sous un LOD : présent de près, rien au-delà de 140 m. Pas de
  // `fusionne` : mergeStatics le regrouperait, et le LOD ne pourrait plus l'éteindre.
  let triRelief = 0;
  for (const s of reliefs.values()) {
    const o = cuire(s); if (!o) continue;
    o.userData.fusionne = false; o.castShadow = false; triRelief += s.n;
    const g = o.geometry; g.computeBoundingSphere();
    const lod = new THREE.LOD(); lod.position.copy(g.boundingSphere.center);
    g.translate(-lod.position.x, -lod.position.y, -lod.position.z); g.computeBoundingSphere();
    lod.addLevel(o, 0); lod.addLevel(new THREE.Object3D(), 140 + g.boundingSphere.radius);
    grp.add(lod);
  }
  console.log('relief des façades : %d triangles en %d tuiles, affichés à moins de 140 m', triRelief, reliefs.size);
  // les objets de rue, instanciés
  { const gl = geoLanterne(), gt = geoTonneau(), gc = new THREE.BoxGeometry(0.6, 0.5, 0.6).translate(0, 0.25, 0);
    for (const o of [instancier(gl.fer, M.ferRue, lanternes, false), instancier(gl.verre, M.verreRue, lanternes, false),
      instancier(gt.bois, M.boisRue, tonneaux), instancier(gt.fer, M.ferRue, tonneaux, false), instancier(gc, M.boisRue, caisses)]) if (o) grp.add(o);
    // on ne les traverse pas, mais on saute par-dessus : le haut se compte depuis LEUR sol
    // (il valait 0,95 en cote absolue — un mur de deux mètres là où le relief descend)
    for (const o of [...tonneaux, ...caisses]) addCap(o.x, o.z, o.x, o.z, 0.38, o.y + 0.95);
    console.log('la rue : %d boutiques, %d lanternes, %d tonneaux, %d caisses', boutiques, lanternes.length, tonneaux.length, caisses.length); }
  console.log('ville resserrée : %d bâtiments hors de l’emprise, dont %d en volumes lointains', horsEmprise, lointains.length);
  console.log('porches : %d lots traversés par une cour relevée, laissés ouverts ; %d lots reculés au bord d’une cour', porches, degages);
  console.log('quartier relevé : %d bâtiments élevés (%d écartés, dont %d sur l’îlot du bourg), %d toits à deux pans, %d à croupe, %d terrasses, %d baies, %d pignons à redents, %d cheminées, %d lucarnes, %d capsules de façade',
    bati, ecarte, bourg, compteToit.pans, compteToit.croupe, compteToit.terrasse, baies, pignons, cheminees, lucarnes, caps);
  grp.userData.vitrines = vitrines;
  passantsDeVille();
  return grp;
}

// ---------------------------------------------------------------------
//  Les passants de la ville
// ---------------------------------------------------------------------
// (5 octobre) La ville resserrée était vide : on traversait cinq cents maisons sans croiser
// personne, et rien ne disait où aller. Quatre passants, sur le chemin du bourg au quai du
// Wault — la rue Léonard Danel, la rue du Gros Gérard, la rue Saint-Martin —, chacun à sa
// place, qui disent le lieu et orientent. Des gens de passage : aucun n'est de l'histoire
// (STORY.md fait foi), aucun ne donne de quête. Les silhouettes sont celles des villageois
// du bourg (pnj.js n'a pas d'autres métiers) ; ils sont animés avec eux (PARTAGE.villagers).
const PORTES = [];             // les portes des rues coupées, relevées par portesDeVille
function passantsDeVille() {
  const route = (nom) => LILLE.routes.find((o) => o.nom === nom);
  // sur le trottoir d'une rue relevée, à la fraction t de son tracé, du côté `cote`
  const trottoir = (o, t, cote) => {
    if (!o) return null;
    const P = o.pts, Ls = []; let L = 0;
    for (let i = 0; i < P.length - 1; i++) { Ls.push(L); L += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); }
    let i = 0; while (i < P.length - 2 && Ls[i + 1] < t * L) i++;
    const a = P[i], b = P[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = Math.min(1, Math.max(0, (t * L - Ls[i]) / l));
    const nx = -(b[1] - a[1]) / l * cote, nz = (b[0] - a[0]) / l * cote, d = LARGEUR_ROUTE[Math.min(3, o.r)] / 2 + 1.1;
    return { x: a[0] + (b[0] - a[0]) * u + nx * d, z: a[1] + (b[1] - a[1]) * u + nz * d, regard: Math.atan2(-nx, -nz) };
  };
  // la place libre la plus proche (une façade ou un tonneau peuvent occuper le point visé)
  const libre = (p) => {
    for (let r = 0; r <= 3; r += 0.5) for (let k = 0; k < (r ? 12 : 1); k++) {
      const x = p.x + Math.cos(k / 12 * 6.283) * r, z = p.z + Math.sin(k / 12 * 6.283) * r, y = levelH(x, z);
      if (!E.blocked(x, z, 0.6, false, y + 0.2)) return { ...p, x, z, y };
    }
    return null;
  };
  // le quai du Wault : un point de la margelle, celui du bassin le plus proche de (vx, vz),
  // reculé de `d` vers la terre ; on y regarde l'eau
  const W = LILLE.eau.find((o) => o.nom === 'Quai du Wault');
  const auQuai = (vx, vz, d) => {
    if (!W) return null;
    let best = null;
    for (let i = 0; i < W.poly.length - 1; i++) {
      const a = W.poly[i], b = W.poly[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((vx - a[0]) * dx + (vz - a[1]) * dz) / l2)), x = a[0] + dx * t, z = a[1] + dz * t, e = Math.hypot(vx - x, vz - z);
      if (!best || e < best.e) { const l = Math.sqrt(l2); best = { e, x, z, nx: -dz / l, nz: dx / l }; }
    }
    if (sdEau(best.x + best.nx * 2, best.z + best.nz * 2) < sdEau(best.x - best.nx * 2, best.z - best.nz * 2)) { best.nx = -best.nx; best.nz = -best.nz; }
    return { x: best.x + best.nx * d, z: best.z + best.nz * d, regard: Math.atan2(-best.nx, -best.nz) };
  };
  // le garde : devant la porte coupée la plus proche de la rue du Gros Gérard, côté ville
  const porte = PORTES.slice().sort((p, q) => Math.hypot(p.x + 20, p.z - 775) - Math.hypot(q.x + 20, q.z - 775))[0];
  const devantPorte = porte && { x: porte.x - porte.ux * porte.sens * 2.2 - porte.uz * 1.6, z: porte.z - porte.uz * porte.sens * 2.2 + porte.ux * 1.6,
    regard: Math.atan2(-porte.ux * porte.sens, -porte.uz * porte.sens) };
  const ici = [
    { qui: 'La lavandière', kind: 2, p: auQuai(-152, 735, 1.4),
      dit: ['« Les bateaux déchargent le grain au bout du bassin. Moi, je rince mon linge ici, où l’eau est calme. »',
        '« Le bourg ? Prends la rue qui monte du quai, puis tout droit vers le soleil levant. Tu verras le beffroi. »'] },
    // (la marchande et le brasseur font les cent pas sur leur trottoir : `va`, de t0 à t1 du tracé)
    { qui: 'La marchande', kind: 0, p: trottoir(route('Rue du Gros Gérard'), 0.04, 1), va: [0.02, 0.22, 1],
      dit: ['« Du beurre, des œufs, du maroilles ! Tout vient des fermes d’à côté, ce matin même. »',
        '« Le quai du Wault ? Suis cette rue vers le couchant, jusqu’à l’eau. Le bourg, c’est de l’autre côté, vers le beffroi. »'] },
    { qui: 'Le brasseur', kind: 1, p: trottoir(route('Rue du Gros Gérard'), 0.5, -1), va: [0.42, 0.62, -1],
      dit: ['« Ici, on brasse la bière de garde. Elle dort tout l’hiver dans le tonneau avant qu’on la boive. »',
        '« Au bout des rues, les portes sont fermées. Le guet y veille : ne perds pas ton temps à pousser. »'] },
    { qui: 'Le garde du guet', kind: 3, p: devantPorte,
      dit: ['« Halte ! Cette porte reste fermée. Ordre du guet. »',
        '« Tu te perds ? Le bourg est derrière toi. Et le quai du Wault, vers l’eau. »'] },
  ];
  let poses = 0;
  for (const { qui, kind, p: p0, dit, va } of ici) {
    const p = p0 && libre(p0);
    if (!p) { console.warn('passants : pas de place pour', qui); continue; }
    const v = makeVillager(kind);
    v.position.set(p.x, p.y, p.z); v.rotation.y = p.regard; v.scale.setScalar(E.G.echelle); E.scene.add(v);
    v.userData.anim = Math.random() * 10; v.userData.name = qui; PARTAGE.villagers.push(v);
    // celui qui marche suit une ronde (game.js, comme les villageois du bourg : il s'arrête quand on
    // lui parle et contourne ce qui le bloque) ; une capsule fixe l'aurait laissé derrière lui
    if (va) { const o = route('Rue du Gros Gérard'), pts = [];
      for (const t of [va[0], (va[0] + va[1]) / 2, va[1]]) { const q = trottoir(o, t, va[2]); if (q) pts.push(new THREE.Vector3(q.x, p.y, q.z)); }
      v.userData.route = pts.concat(pts.slice(1, -1).reverse()); v.userData.wp = 0; v.userData.pause = Math.random() * 3; }
    else addCap(p.x, p.z, p.x, p.z, 0.5, p.y + 1.9);
    E.addInteract({ pos: v.position, r: 2.6, enabled: () => v.visible, prompt: () => 'parler ' + (qui.startsWith('La ') ? 'à la ' + qui.slice(3).toLowerCase() : 'au ' + qui.slice(3).toLowerCase()),
      fn: () => { v.userData.talk = 4; v.rotation.y = Math.atan2(E.player.pos.x - v.position.x, E.player.pos.z - v.position.z);
        E.dialogue(dit.map((text) => ({ who: qui, text })), () => { v.userData.talk = 0; }); } });
    poses++;
  }
  // le quai du Wault, lieu découvert : il compte au journal et se nomme sur la carte
  if (W) E.addLieu({ id: 'wault', nom: 'le quai du Wault', x: W.c[0], z: W.c[1], r: 70 });
  console.log('la ville : %d passants posés', poses);
}


// ---------------------------------------------------------------------
//  Au bord de la ville resserrée
// ---------------------------------------------------------------------
const LOINTAIN = 260;              // au-delà de l'emprise, on ne dresse plus rien
// LE DÉCOR LOINTAIN. Chaque bâtiment ôté redevient son rectangle d'emprise, élevé à sa
// hauteur, coiffé de deux pans de tuile : la silhouette d'une ville flamande, pour quelques
// triangles par maison. Deux sacs (brique, tuile), sans ombre portée (pas d'ombre nouvelle :
// le Mac n'a qu'1,5 Go de mémoire graphique) et sans collision : on n'y va pas.
function decorLointain(M, liste) {
  const sMur = sac(M.brique), sToit = sac(M.tuile), g = new THREE.Group(); g.name = 'ville-lointaine';
  for (const { r, y, H, g: gr } of liste) {
    const h = hache(gr), col = [0.78 + 0.18 * h, 0.66 + 0.14 * h, 0.58 + 0.1 * h], ct = [0.72 + 0.2 * hache(gr + 7), 0.6, 0.52];
    const { cx, cz, ux, uz } = r, vx = -uz, vz = ux, hl = r.L / 2, hw = r.W / 2;
    const P = (s, t, yy) => [cx + ux * s + vx * t, yy, cz + uz * s + vz * t];
    const b0 = y - 1.5, e = y + H, f = e + Math.min(hw * 0.9, 6);       // assise enfoncée, égout, faîtage
    const coins = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]];
    let s0 = 0;
    for (let k = 0; k < 4; k++) {
      const [as, at] = coins[k], [bs, bt] = coins[(k + 1) % 4], L = Math.hypot(bs - as, bt - at);
      const nx = (ux * (as + bs) + vx * (at + bt)) / 2, nz = (uz * (as + bs) + vz * (at + bt)) / 2;
      quad(sMur, P(as, at, b0), P(bs, bt, b0), P(bs, bt, e), P(as, at, e), [s0, 0], [s0 + L, 0], [s0 + L, e - b0], [s0, e - b0], col, [nx, 0, nz]);
      s0 += L;
    }
    // deux pans le long du grand côté, deux pignons
    for (const sg of [1, -1]) {
      quad(sToit, P(-hl, sg * hw, e), P(hl, sg * hw, e), P(hl, 0, f), P(-hl, 0, f), [0, 0], [r.L, 0], [r.L, hw * 1.3], [0, hw * 1.3], ct, [vx * sg, 1, vz * sg]);
      tri(sMur, P(sg * hl, -hw, e), P(sg * hl, hw, e), P(sg * hl, 0, f), [0, 0], [r.W, 0], [hw, f - e], col, [ux * sg, 0, uz * sg]);
    }
  }
  for (const s of [sMur, sToit]) { const o = cuire(s); if (o) { o.castShadow = false; g.add(o); } }
  return g;
}
// LES RUES COUPÉES finissent sur un mur et une porte cochère fermée, pas dans le vide : là
// où une voie relevée sort de l'emprise pour entrer dans le tissu coupé, on dresse en
// travers un mur de brique à chaperon de pierre, percé d'une porte de bois.
function portesDeVille(M) {
  const sMur = sac(M.brique2), sPierre = sac(M.pierreT), sBois = sac(M.boisRue), g = new THREE.Group(); g.name = 'portes-de-ville';
  const posees = [];
  const voies = LILLE.routes.map((o) => [o, LARGEUR_ROUTE[Math.min(3, o.r)] || 6]).concat(LILLE.chemins.map((o) => [o, LARGEUR_CHEMIN]));
  for (const [o, larg] of voies) {
    const pts = o.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.1) continue;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      let avant = null;
      for (let t = 0; t <= L; t += 1.5) {
        const x = a[0] + ux * t, z = a[1] + uz * t, ici = dansVille(x, z) ? 'dedans' : horsVille(x, z) ? 'coupe' : 'libre';
        if (avant && avant.e !== ici && (avant.e === 'coupe' || ici === 'coupe') && (avant.e === 'dedans' || ici === 'dedans' || avant.e === 'libre' || ici === 'libre')) {
          // le mur se dresse côté ouvert, à un mètre et demi du tissu coupé
          const [px, pz] = ici === 'coupe' ? [avant.x, avant.z] : [x, z];
          if (!posees.some(([qx, qz]) => Math.hypot(qx - px, qz - pz) < larg + 4)) { posees.push([px, pz]); murPorte(sMur, sPierre, sBois, px, pz, ux, uz, larg);
            // sens : +1 quand le tissu coupé est devant, dans le sens du tracé (le garde du guet se poste de l'autre côté)
            PORTES.push({ x: px, z: pz, ux, uz, sens: ici === 'coupe' ? 1 : -1, ville: avant.e === 'dedans' || ici === 'dedans' }); }
        }
        avant = { e: ici, x, z };
      }
    }
  }
  for (const s of [sMur, sPierre, sBois]) { const o = cuire(s); if (o) g.add(o); }
  console.log('ville resserrée : %d rues coupées, fermées d’un mur et d’une porte', posees.length);
  return g;
}
function murPorte(sMur, sPierre, sBois, x, z, ux, uz, larg) {
  const vx = -uz, vz = ux, demi = larg / 2 + 1.6, EP = 0.35, H = 4.4, PH = 3.1, PL = Math.min(larg - 0.6, 3.4) / 2;
  const y = solPlaine(x, z), b0 = y - 0.8;
  const P = (s, t, yy) => [x + vx * s + ux * t, yy, z + vz * s + uz * t];
  const col = [0.82, 0.72, 0.64], cp = [0.86, 0.84, 0.8], cb = [1.0, 0.92, 0.84];   // le bois est déjà teinté (boisRue) : une couleur de sommet sombre le noircissait
  for (const sg of [1, -1]) {                         // les deux faces du mur
    const t = sg * EP;
    // de part et d'autre de la porte, puis au-dessus d'elle
    quad(sMur, P(-demi, t, b0), P(-PL, t, b0), P(-PL, t, y + H), P(-demi, t, y + H), [0, 0], [demi - PL, 0], [demi - PL, H + 0.8], [0, H + 0.8], col, [ux * sg, 0, uz * sg]);
    quad(sMur, P(PL, t, b0), P(demi, t, b0), P(demi, t, y + H), P(PL, t, y + H), [0, 0], [demi - PL, 0], [demi - PL, H + 0.8], [0, H + 0.8], col, [ux * sg, 0, uz * sg]);
    quad(sMur, P(-PL, t, y + PH), P(PL, t, y + PH), P(PL, t, y + H), P(-PL, t, y + H), [0, 0], [2 * PL, 0], [2 * PL, H - PH], [0, H - PH], col, [ux * sg, 0, uz * sg]);
    // les vantaux, en retrait de dix centimètres
    const tb = sg * (EP - 0.1);
    quad(sBois, P(-PL, tb, y), P(PL, tb, y), P(PL, tb, y + PH), P(-PL, tb, y + PH), [0, 0], [2 * PL, 0], [2 * PL, PH], [0, PH], cb, [ux * sg, 0, uz * sg]);
  }
  // le chaperon de pierre et les bouts du mur
  quad(sPierre, P(-demi - 0.08, -EP - 0.08, y + H), P(demi + 0.08, -EP - 0.08, y + H), P(demi + 0.08, EP + 0.08, y + H + 0.2), P(-demi - 0.08, EP + 0.08, y + H + 0.2), [0, 0], [2 * demi, 0], [2 * demi, 0.9], [0, 0.9], cp, [0, 1, 0]);
  for (const sg of [1, -1]) quad(sMur, P(sg * demi, -EP, b0), P(sg * demi, EP, b0), P(sg * demi, EP, y + H), P(sg * demi, -EP, y + H), [0, 0], [2 * EP, 0], [2 * EP, H], [0, H], col, [vx * sg, 0, vz * sg]);
  addCap(x - vx * demi, z - vz * demi, x + vx * demi, z + vz * demi, EP + 0.1, y + H);
}

// ---------------------------------------------------------------------
//  Les remparts de la ville
// ---------------------------------------------------------------------
// Le monde s'arrêtait sur un mur invisible : `levelBlocked` refusait de sortir du
// quadrilatère relevé, et il n'y avait rien à voir. C'est maintenant l'enceinte urbaine
// qui ferme la carte — celle que Lille a gardée jusqu'à 1858. Courtine de brique de
// onze mètres sur son talus, cordon de pierre, parapet, et une tour saillante tous les
// deux cents mètres. Tout est fusionné : six kilomètres huit de muraille tiennent en
// une poignée de milliers de triangles.
export function rempartsVille() {
  const M = materiaux();
  const sacs = new Map();
  const prendre = (m) => { let s = sacs.get(m); if (!s) sacs.set(m, s = sac(m)); return s; };
  const grp = new THREE.Group(); grp.name = 'remparts-de-la-ville';
  const sMur = prendre(M.brique2), sP = prendre(M.pierreT);
  const tmur = [0.80, 0.62, 0.54], tp = [0.72, 0.70, 0.66];
  const EP = 6, H = ENCEINTE_H, PAR = 1.4, PAS = 11;
  // centre du quadrilatère : il donne le sens « dehors »
  const cx0 = ENCEINTE.reduce((t, q) => t + q[0], 0) / ENCEINTE.length;
  const cz0 = ENCEINTE.reduce((t, q) => t + q[1], 0) / ENCEINTE.length;
  let long = 0, tours = 0, prochaineTour = 120;
  for (let e = 0; e < ENCEINTE.length; e++) {
    const A = ENCEINTE[e], B = ENCEINTE[(e + 1) % ENCEINTE.length];
    const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
    const ux = dx / L, uz = dz / L;
    let nx = -uz, nz = ux;
    if ((A[0] + nx - cx0) ** 2 + (A[1] + nz - cz0) ** 2 < (A[0] - cx0) ** 2 + (A[1] - cz0) ** 2) { nx = -nx; nz = -nz; }
    const n = Math.ceil(L / PAS);
    let prec = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, cx = A[0] + dx * t - nx, cz = A[1] + dz * t - nz;   // axe reculé d'un mètre
      const y = solPlaine(cx, cz);
      const st = {
        ext: [cx + nx * EP / 2, cz + nz * EP / 2],
        int: [cx - nx * EP / 2, cz - nz * EP / 2],
        par: [cx + nx * (EP / 2 - 1.6), cz + nz * (EP / 2 - 1.6)],
        y, s: long,
      };
      if (prec) {
        const seg = Math.hypot(st.ext[0] - prec.ext[0], st.ext[1] - prec.ext[1]);
        const face = (a, b, y0a, y1a, y0b, y1b, sc, col, out) => quad(sc,
          [a[0], y0a, a[1]], [b[0], y0b, b[1]], [b[0], y1b, b[1]], [a[0], y1a, a[1]],
          [prec.s, 0], [prec.s + seg, 0], [prec.s + seg, y1b - y0b], [prec.s, y1a - y0a], col, out);
        const OUT = [nx, 0, nz], IN = [-nx, 0, -nz], UP = [0, 1, 0];
        face(prec.ext, st.ext, prec.y - 3, prec.y + H - 1.7, st.y - 3, st.y + H - 1.7, sMur, tmur, OUT);
        face(prec.ext, st.ext, prec.y + H - 1.7, prec.y + H - 1.1, st.y + H - 1.7, st.y + H - 1.1, sP, tp, OUT);  // cordon
        face(prec.ext, st.ext, prec.y + H - 1.1, prec.y + H, st.y + H - 1.1, st.y + H, sMur, tmur, OUT);
        face(prec.int, st.int, prec.y - 3, prec.y + H, st.y - 3, st.y + H, sMur, tmur, IN);
        // chemin de ronde
        quad(sMur, [prec.int[0], prec.y + H, prec.int[1]], [st.int[0], st.y + H, st.int[1]],
          [st.par[0], st.y + H, st.par[1]], [prec.par[0], prec.y + H, prec.par[1]],
          [0, 0], [seg, 0], [seg, EP], [0, EP], tmur, UP);
        // parapet : face intérieure, face extérieure et chaperon de pierre
        face(prec.par, st.par, prec.y + H, prec.y + H + PAR, st.y + H, st.y + H + PAR, sMur, tmur, IN);
        face(prec.ext, st.ext, prec.y + H, prec.y + H + PAR, st.y + H, st.y + H + PAR, sMur, tmur, OUT);
        quad(sP, [prec.par[0], prec.y + H + PAR, prec.par[1]], [st.par[0], st.y + H + PAR, st.par[1]],
          [st.ext[0], st.y + H + PAR, st.ext[1]], [prec.ext[0], prec.y + H + PAR, prec.ext[1]],
          [0, 0], [seg, 0], [seg, 1.6], [0, 1.6], tp, UP);
        long += seg;
      }
      prec = st;
      // tour saillante, demi-hexagonale, un peu plus haute que la courtine
      if (long >= prochaineTour && k > 0 && k < n) {
        prochaineTour = long + 195;
        const R = 8, HT = H + 2.2, base = y - 3;
        const co = [];
        for (let a = -2; a <= 2; a++) {
          const an = a * Math.PI / 6;
          co.push([cx + ux * Math.sin(an) * R + nx * Math.cos(an) * R,
            cz + uz * Math.sin(an) * R + nz * Math.cos(an) * R]);
        }
        co.unshift([cx - ux * R, cz - uz * R]); co.push([cx + ux * R, cz + uz * R]);
        for (let i2 = 0; i2 < co.length - 1; i2++) {
          const a = co[i2], b = co[i2 + 1];
          const ddx = b[0] - a[0], ddz = b[1] - a[1], ll = Math.hypot(ddx, ddz) || 1;
          quad(sMur, [a[0], base, a[1]], [b[0], base, b[1]], [b[0], y + HT, b[1]], [a[0], y + HT, a[1]],
            [0, 0], [ll, 0], [ll, HT + 3], [0, HT + 3], tmur, [ddz / ll, 0, -ddx / ll]);
          quad(sP, [a[0], y + HT, a[1]], [b[0], y + HT, b[1]], [b[0], y + HT + 0.5, b[1]], [a[0], y + HT + 0.5, a[1]],
            [0, 0], [ll, 0], [ll, 0.5], [0, 0.5], tp, [ddz / ll, 0, -ddx / ll]);
        }
        // couronnement : un disque de pierre sur le sommet de la tour
        for (let i2 = 1; i2 < co.length - 1; i2++) {
          tri(sP, [cx, y + HT + 0.5, cz], [co[i2][0], y + HT + 0.5, co[i2][1]], [co[i2 + 1][0], y + HT + 0.5, co[i2 + 1][1]],
            [0, 0], [R, 0], [R, R], tp, [0, 1, 0]);
        }
        tours++;
      }
    }
  }
  for (const s of sacs.values()) { const o = cuire(s); if (o) grp.add(o); }
  console.log('remparts de la ville : %d m de courtine, %d tours', Math.round(long), tours);
  return grp;
}
