// The Legend of Camille — forêt
// =====================================================================
// Tout ce qui pousse en bois est ici : le catalogue d'espèces, la fabrication des
// géométries, le semis et la lisière infranchissable du bord de carte.
//
// PRINCIPE
// Chaque espèce fabrique ses pièces en « unités d'arbre » : le pied est à y = 0, la
// cime à y = 1. Le semeur applique ensuite la hauteur réelle en mètres. Le houppier
// est FUSIONNÉ en une seule géométrie par variante : un arbre = 2 instances (tronc +
// houppier), pas vingt. On a donc quelques milliers d'arbres pour une poignée d'appels
// de dessin.
//
// BRANCHER DE VRAIS ASSETS (pins, sapins, feuillus…)
// Ajouter au catalogue une entrée avec `glb: 'pack:Nom_Du_Mesh'` et le semeur chargera
// le modèle via assets.js, fusionnera ses meshes, le normalisera à une hauteur de 1 et
// l'instanciera exactement comme un arbre procédural. Si le chargement échoue, l'espèce
// retombe sur sa version procédurale : le jeu démarre toujours.
// =====================================================================
import { THREE, rand, clamp, TAU, T, mat, pbr, pbrRepeat, phMat, scene, addCap, makeCanvas, tex } from './engine.js?v=27';
import * as A from './assets.js';

// ---------------------------------------------------------------------
//  Textures de feuillage
// ---------------------------------------------------------------------
// Aiguilles de conifère : un rameau de brindilles sombres sur fond transparent.
function aiguillesTexture(teinte = 130, densite = 34) {
  const W = 256, H = 256, [c, x] = makeCanvas(W, H);
  x.clearRect(0, 0, W, H);
  const brin = (bx, by, ang, len, larg, l) => {
    x.strokeStyle = `hsl(${teinte + rand(-10, 10)}, ${rand(28, 46)}%, ${l}%)`;
    x.lineWidth = larg; x.lineCap = 'round';
    x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len); x.stroke();
  };
  // axe central puis rameaux, puis aiguilles fines sur chaque rameau
  for (let k = 0; k < densite; k++) {
    const by = 20 + (k / densite) * (H - 40), t = k / densite;
    const len = (1 - Math.abs(t - 0.35) * 0.9) * W * 0.42;
    for (const sg of [-1, 1]) {
      const ang = sg > 0 ? rand(-0.35, 0.35) : Math.PI + rand(-0.35, 0.35);
      brin(W / 2, by, ang, len * rand(0.7, 1.05), 2.6, rand(16, 26));
      for (let a = 0; a < 9; a++) {
        const t2 = (a + 1) / 10, px = W / 2 + Math.cos(ang) * len * t2, py = by + Math.sin(ang) * len * t2;
        brin(px, py, ang + sg * rand(0.6, 1.3) * (a % 2 ? 1 : -1), rand(8, 17), 1.5, rand(22, 38));
      }
    }
  }
  return tex(c, 1, true);
}
// Masse de feuilles d'un feuillu : amas de folioles, bord découpé.
function feuillesTexture(teinte = 96) {
  const W = 256, H = 256, [c, x] = makeCanvas(W, H);
  x.clearRect(0, 0, W, H);
  for (let k = 0; k < 220; k++) {
    const a = rand(0, TAU), r = Math.pow(Math.random(), 0.55) * 112;
    const px = W / 2 + Math.cos(a) * r, py = H / 2 + Math.sin(a) * r * 0.92;
    const s = (1 - r / 130) * rand(9, 20) + 4;
    x.fillStyle = `hsl(${teinte + rand(-12, 12)}, ${rand(30, 52)}%, ${rand(17, 40) + (1 - r / 130) * 6}%)`;
    x.save(); x.translate(px, py); x.rotate(rand(0, TAU));
    x.beginPath(); x.ellipse(0, 0, s, s * rand(0.5, 0.75), 0, 0, TAU); x.fill();
    x.restore();
  }
  return tex(c, 1, true);
}
// Silhouette d'arbre pour les lointains : un seul quad suffit à lire « forêt ».
function silhouetteTexture(conifere) {
  const W = 256, H = 384, [c, x] = makeCanvas(W, H);
  x.clearRect(0, 0, W, H);
  // tronc
  const g = x.createLinearGradient(W / 2 - 14, 0, W / 2 + 14, 0);
  g.addColorStop(0, '#2e2318'); g.addColorStop(0.5, '#4a3826'); g.addColorStop(1, '#241b12');
  x.fillStyle = g; x.fillRect(W / 2 - (conifere ? 8 : 12), H * (conifere ? 0.62 : 0.52), conifere ? 16 : 24, H * 0.42);
  const touffe = (px, py, r, l) => {
    x.fillStyle = `hsl(${conifere ? 128 : 95}, ${rand(26, 44)}%, ${l}%)`;
    for (let k = 0; k < 26; k++) {
      const a = rand(0, TAU), rr = Math.pow(Math.random(), 0.5) * r;
      x.beginPath(); x.ellipse(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8, rand(6, 15), rand(4, 10), rand(0, TAU), 0, TAU); x.fill();
    }
  };
  if (conifere) {
    for (let k = 0; k < 7; k++) { const t = k / 6, py = H * (0.70 - t * 0.62), r = (1 - t) * 74 + 16; touffe(W / 2, py, r, 15 + t * 12); }
  } else {
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; touffe(W / 2 + Math.cos(a) * 34, H * 0.34 + Math.sin(a) * 26, 58, rand(17, 31)); }
    touffe(W / 2, H * 0.30, 70, 27);
  }
  return tex(c, 1, true);
}

// Rideau de feuillage : la masse opaque qui ferme l'horizon derrière le fourré.
// Une silhouette d'arbre laisse voir le jour entre deux troncs ; un rideau, non.
// Le bas est plein, le haut est déchiqueté, et la tuile se raccorde horizontalement
// (tout ce qui déborde d'un bord est redessiné sur l'autre).
function rideauTexture(teinte = 104, seed = 3) {
  const W = 512, H = 320, [c, x] = makeCanvas(W, H);
  x.clearRect(0, 0, W, H);
  let st = seed >>> 0;
  const al = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
  const ent = (a, b) => a + al() * (b - a);
  const touffe = (px, py, r, l, sat) => {
    x.fillStyle = 'hsl(' + (teinte + ent(-14, 14)) + ', ' + sat + '%, ' + l + '%)';
    for (let k = 0; k < 14; k++) {
      const a = ent(0, TAU), rr = Math.pow(al(), 0.55) * r;
      const ex2 = px + Math.cos(a) * rr, ey = py + Math.sin(a) * rr * 0.72;
      for (const dx of [-W, 0, W]) {
        if (Math.abs(ex2 + dx - W / 2) > W / 2 + r) continue;
        x.beginPath(); x.ellipse(ex2 + dx, ey, ent(9, 22), ent(6, 14), ent(0, TAU), 0, TAU); x.fill();
      }
    }
  };
  // fond plein à partir du tiers supérieur : aucune trouée ne doit subsister en bas
  for (let k = 0; k < 260; k++) touffe(ent(-20, W + 20), ent(H * 0.42, H + 30), ent(26, 52), ent(9, 19), ent(22, 38));
  // cimes irrégulières : c'est ce qui empêche le rideau de se lire comme un mur
  for (let k = 0; k < 46; k++) {
    const px = k / 46 * W + ent(-9, 9), h = Math.pow(al(), 1.5), cy = H * (0.44 - h * 0.34);
    for (let e = 0; e < 4; e++) touffe(px + ent(-16, 16), cy + e * ent(16, 28), ent(20, 40), 14 + e * 3 + h * 8, ent(24, 42));
  }
  // troncs devinés dans l'ombre du bas
  x.globalAlpha = 0.55;
  for (let k = 0; k < 22; k++) { const px = ent(0, W); x.fillStyle = 'hsl(30, 18%, ' + ent(7, 13) + '%)'; x.fillRect(px, H * ent(0.62, 0.74), ent(5, 13), H); }
  x.globalAlpha = 1;
  return tex(c, 1, true);
}

// ---------------------------------------------------------------------
//  Fusion de pièces
// ---------------------------------------------------------------------
function fusionner(pieces) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  const N = new THREE.Matrix3();
  for (const { geo, m } of pieces) {
    const g = geo.index ? geo : geo.toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    N.getNormalMatrix(m);
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      if (n) { w.fromBufferAttribute(n, i).applyMatrix3(N).normalize(); nor.push(w.x, w.y, w.z); }
      if (u) uv.push(u.getX(i), u.getY(i));
    }
    const id = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i);
    for (const i of id) idx.push(i + off);
    off += p.count;
  }
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (nor.length) ge.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (uv.length) ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ge.setIndex(idx);
  if (!nor.length) ge.computeVertexNormals();
  return ge;
}
const M4 = () => new THREE.Matrix4();
function place(x, y, z, rx, ry, rz, s = 1, sy = s, sz = s) {
  return M4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, sy, sz));
}

// ---------------------------------------------------------------------
//  Catalogue d'espèces
// ---------------------------------------------------------------------
// poids   : fréquence relative dans le semis
// h       : hauteur en mètres [min, max]
// rTronc  : rayon de collision, en fraction de la hauteur
// zones   : 'plaine' (on circule entre les arbres) et/ou 'lisiere' (mur du bord de carte)
// glb     : (optionnel) identifiant assets.js — remplace la version procédurale
export const ESPECES = [
  { nom: 'chene',    poids: 2.4, h: [8.5, 14.5], rTronc: 0.034, zones: ['plaine', 'lisiere'], type: 'feuillu', teinte: 92,  variantes: 3, slug: 'tree_trunk', carte: 'houppier_chene' },
  { nom: 'hetre',    poids: 1.7, h: [11, 18],    rTronc: 0.023, zones: ['plaine', 'lisiere'], type: 'feuillu', teinte: 104, variantes: 3, elance: true, slug: 'tree_trunk', carte: 'houppier_hetre' },
  { nom: 'bouleau',  poids: 1.0, h: [9, 15],     rTronc: 0.016, zones: ['plaine'],            type: 'feuillu', teinte: 112, variantes: 2, ecorce: 0xd9d4c4, elance: true, carte: 'houppier_fin' },
  { nom: 'pin',      poids: 4.2, h: [14, 23],    rTronc: 0.019, zones: ['plaine', 'lisiere'], type: 'pin',     teinte: 128, variantes: 3, slug: 'pine_bark' },
  { nom: 'sapin',    poids: 3.4, h: [9, 17],     rTronc: 0.027, zones: ['plaine', 'lisiere'], type: 'sapin',   teinte: 134, variantes: 3, slug: 'fir_bark' },
  // Le charme ne pousse pas droit et ne monte pas haut : c'est l'arbre du fourré, celui
  // qui remplit l'entre-deux des troncs. Il ne sert QUE dans le mur végétal.
  { nom: 'charme',   poids: 3.0, h: [5.5, 9.5], rTronc: 0.052, zones: ['lisiere'],           type: 'feuillu', teinte: 98,  variantes: 3, carte: 'houppier_tendre' },
  // Le saule n'est jamais tiré au sort : nature.js le plante à la main sur les berges.
  { nom: 'saule',    poids: 0,   h: [7, 13],    rTronc: 0.046, zones: ['berge'],             type: 'feuillu', teinte: 84,  variantes: 2, carte: 'houppier_tendre' },
];

// ---------- fabrication procédurale ----------
function troncGeo(sp) {
  // tronc légèrement conique, renflé au pied ; hauteur 1 en unités d'arbre
  const hT = sp.type === 'feuillu' ? (sp.elance ? 0.62 : 0.50) : 0.92;
  const r0 = sp.rTronc * (sp.type === 'feuillu' ? 1.25 : 1.15), r1 = sp.rTronc * 0.45;
  const g = new THREE.CylinderGeometry(r1, r0, hT, 8, 1);
  g.translate(0, hT / 2, 0);
  const pieces = [{ geo: g, m: M4() }];
  // contreforts au pied : quelques cônes inclinés vers l'extérieur
  const cone = new THREE.ConeGeometry(sp.rTronc * 0.55, sp.rTronc * 2.6, 5);
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + rand(-0.3, 0.3);
    pieces.push({ geo: cone, m: place(Math.cos(a) * sp.rTronc * 0.8, sp.rTronc * 1.0, Math.sin(a) * sp.rTronc * 0.8, Math.cos(a) * 0.5, -a, Math.sin(a) * 0.5) });
  }
  // branches maîtresses des feuillus
  if (sp.type === 'feuillu') {
    const br = new THREE.CylinderGeometry(sp.rTronc * 0.12, sp.rTronc * 0.42, 0.34, 5); br.translate(0, 0.17, 0);
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU + rand(-0.5, 0.5), tilt = rand(0.5, 0.95);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)));
      pieces.push({ geo: br, m: M4().compose(new THREE.Vector3(0, hT * rand(0.78, 1.0), 0), q, new THREE.Vector3(1, 1, 1)) });
    }
  }
  return fusionner(pieces);
}
function houppierGeo(sp) {
  const pieces = [], carte = (w, h) => new THREE.PlaneGeometry(w, h);
  if (sp.type === 'feuillu') {
    const cy = sp.elance ? 0.76 : 0.72, cr = sp.elance ? 0.20 : 0.27;
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = rand(0, TAU), r = Math.pow(Math.random(), 0.5) * cr, hh = rand(-0.9, 1.0) * cr * 0.8;
      pieces.push({ geo: carte(cr * 2.5, cr * 2.5), m: place(Math.cos(a) * r, cy + hh, Math.sin(a) * r, rand(-0.6, 0.6), rand(0, TAU), rand(-0.4, 0.4), rand(0.85, 1.25)) });
    }
  } else if (sp.type === 'pin') {
    // pin sylvestre : houppier haut et étalé, étages espacés, tronc nu en dessous
    for (let e = 0; e < 4; e++) {
      const t = e / 3, y = 0.66 + t * 0.32, r = (1 - t * 0.55) * 0.20 + 0.05;
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * TAU + rand(-0.35, 0.35);
        pieces.push({ geo: carte(r * 2.4, r * 1.5), m: place(Math.cos(a) * r * 0.62, y + rand(-0.02, 0.02), Math.sin(a) * r * 0.62, rand(0.9, 1.35), -a, 0, rand(0.85, 1.2)) });
      }
    }
  } else {
    // sapin : cône dense, étages du bas vers la cime
    for (let e = 0; e < 7; e++) {
      const t = e / 6, y = 0.20 + t * 0.76, r = (1 - t) * 0.26 + 0.035;
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * TAU + e * 0.5 + rand(-0.2, 0.2);
        pieces.push({ geo: carte(r * 2.6, r * 1.7), m: place(Math.cos(a) * r * 0.55, y, Math.sin(a) * r * 0.55, 1.05 + rand(-0.15, 0.15), -a, 0, rand(0.9, 1.15)) });
      }
    }
  }
  return fusionner(pieces);
}

// ---------------------------------------------------------------------
//  Chargement optionnel des assets GLB
// ---------------------------------------------------------------------
// Renvoie le nombre d'espèces effectivement remplacées par un modèle.
export async function chargerModeles() {
  const avecGlb = ESPECES.filter(e => e.glb);
  if (!avecGlb.length) return 0;
  try { await A.preload(avecGlb.map(e => e.glb)); } catch (err) { console.warn('forêt : assets indisponibles, arbres procéduraux —', err.message); return 0; }
  let n = 0;
  for (const sp of avecGlb) {
    try {
      const o = A.spawn(sp.glb, {});
      const pieces = [];
      o.updateMatrixWorld(true);
      o.traverse(m => { if (m.isMesh && !Array.isArray(m.material)) pieces.push({ geo: m.geometry, m: m.matrixWorld.clone(), mat: m.material }); });
      if (!pieces.length) continue;
      const g = fusionner(pieces);
      g.computeBoundingBox();
      const bb = g.boundingBox, h = bb.max.y - bb.min.y;
      g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
      g.scale(1 / h, 1 / h, 1 / h);                    // normalisé : cime à y = 1
      sp._geoGlb = g; sp._matGlb = pieces[0].mat; n++;
    } catch (err) { console.warn('forêt : modèle', sp.glb, 'ignoré —', err.message); }
  }
  return n;
}

// ---------------------------------------------------------------------
//  Sous-bois : fougères
// ---------------------------------------------------------------------
// L'atlas fern_02 du pack Poly Haven contient quatre frondes côte à côte. On découpe
// chacune par ses UV et on en assemble des touffes : une seule géométrie instanciée.
export const FOR_BASE = 'assets_back/03_textures/foret/';
const FRONDES = [[0.093, 0.230, 0.111, 0.949], [0.321, 0.453, 0.024, 0.857], [0.517, 0.664, 0.026, 0.966], [0.724, 0.834, 0.109, 1.000]];
export function carteForet(nom) {
  const t = A.chargerTexture(FOR_BASE + nom + '.webp', () => console.warn('carte de forêt absente :', nom));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function fougereGeo(n = 7) {
  const pieces = [];
  for (let k = 0; k < n; k++) {
    const f = FRONDES[Math.floor(rand(0, FRONDES.length))];
    const du = f[1] - f[0], dv = f[3] - f[2];
    const g = new THREE.PlaneGeometry(du / dv * 0.95, 1, 1, 3);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, f[0] + uv.getX(i) * du, f[2] + uv.getY(i) * dv);
    g.translate(0, 0.5, 0);
    g.rotateX(-rand(0.35, 0.85));                       // la fronde retombe vers l'extérieur
    g.rotateY(k / n * TAU + rand(-0.35, 0.35));
    g.scale(rand(0.8, 1.15), rand(0.85, 1.2), rand(0.8, 1.15));
    pieces.push({ geo: g, m: M4() });
  }
  return fusionner(pieces);
}
export function fougereMat() {
  return new THREE.MeshStandardMaterial({ map: carteForet('fougere'), alphaTest: 0.38, side: THREE.DoubleSide, roughness: 1 });
}

// Fabrique de quoi instancier une espèce HORS semis — les saules que nature.js plante
// sur les berges de la Deûle. Même géométrie, mêmes matériaux que dans la forêt : une
// berge plantée et un bois planté ne doivent pas avoir l'air de venir de deux jeux.
export function especeGeo(nom) {
  const sp = ESPECES.find(e => e.nom === nom);
  if (!sp) { console.warn('forêt : espèce inconnue', nom); return null; }
  const matH = new THREE.MeshStandardMaterial({
    map: sp.carte ? carteForet(sp.carte) : (sp.type === 'feuillu' ? feuillesTexture(sp.teinte) : aiguillesTexture(sp.teinte)),
    alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1,
  });
  const matT = sp.slug ? phMat(sp.slug, 1.6, 13) : pbrRepeat(T.bark, 2, 3, sp.ecorce ? { color: sp.ecorce } : {});
  return { sp, tronc: troncGeo(sp), houppier: houppierGeo(sp), matT, matH };
}

// ---------------------------------------------------------------------
//  Semis
// ---------------------------------------------------------------------
// ctx = { libre(x,z,marge), sol(x,z), rayons: { lis0, lis1, marche, plaine, interne },
//         espacement: { clairiere, bosquet, mur }, cible, perf }
export function planterForet(ctx) {
  const { libre, sol, rayons } = ctx;
  const { lis0, lis1, marche, plaine } = rayons;
  // Trois nombres règlent tout le semis : l'espacement en clairière, en bosquet, et
  // dans le fourré du bord du monde. Un quatrième, `fond`, tient l'arrière-plan.
  const ESP = ctx.espacement || {};
  const E_CLAIR = ESP.clairiere ?? 7.6, E_BOSQ = ESP.bosquet ?? 3.4,
        E_MUR = ESP.mur ?? 2.25, E_FOND = ESP.fond ?? 8.5;
  const marge = ctx.marge || (() => 1e4);          // distance aux zones aménagées
  const bois = ctx.bois || (() => 0);              // densité de bois relevée au cadastre, 0 à 1

  // ---------- champ de densité : bosquets et clairières ----------
  // Un bruit lisse décide, en tout point, si l'on est dans un bosquet serré ou dans une
  // trouée. À l'approche du mur végétal, l'espacement se resserre jusqu'au fourré.
  const grille = new Float32Array(128 * 128);
  { let st = 20260920 >>> 0; for (let i = 0; i < grille.length; i++) { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; grille[i] = st / 4294967296; } }
  const bruit = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const at = (a, b) => grille[(((b % 128) + 128) % 128) * 128 + (((a % 128) + 128) % 128)];
    const p = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u, q = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return p + (q - p) * v;
  };
  const massif = (x, z) => clamp(bruit(x / 46, z / 46) * 0.7 + bruit(x / 17, z / 17) * 0.3, 0, 1);
  const lisse = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

  // ---------- le mur végétal : une courbe fermée, pas un cercle ----------
  // Le bord du monde ne peut pas être un rayon constant : le faubourg du village déborde
  // de la ceinture et un cercle lui passerait au travers. On part donc d'un rayon de base,
  // on repousse la courbe partout où elle tomberait sur une zone aménagée, et on lisse —
  // sans quoi le fourré aurait des angles droits là où il contourne le bourg.
  const NA = 256, MUR = new Float32Array(NA), MUR_DEDANS = 26, MUR_DEHORS = 16;
  {
    const base = lis0 + 40, cap = Math.min(lis1, marche - 24);
    for (let i = 0; i < NA; i++) {
      const a = i / NA * TAU, cx = Math.cos(a), cz = Math.sin(a);
      let r = base;
      for (let d = base - MUR_DEDANS; d <= cap; d += 4) if (marge(cx * d, cz * d) < 18) r = Math.min(cap, d + MUR_DEDANS + 14);
      MUR[i] = r;
    }
    for (let p = 0; p < 8; p++) { const c = Float32Array.from(MUR); for (let i = 0; i < NA; i++) MUR[i] = (c[(i + NA - 1) % NA] + 2 * c[i] + c[(i + 1) % NA]) / 4; }
  }
  let MUR_MIN = Infinity, MUR_MAX = 0;
  for (const v of MUR) { if (v < MUR_MIN) MUR_MIN = v; if (v > MUR_MAX) MUR_MAX = v; }
  const murR = (x, z) => {
    let t = Math.atan2(z, x) / TAU * NA; t = ((t % NA) + NA) % NA;
    const i = t | 0; return MUR[i] + (MUR[(i + 1) % NA] - MUR[i]) * (t - i);
  };

  // `d` = distance signée au mur : négative en deçà (on circule), positive au-delà.
  function espacement(x, z, d) {
    let e0 = E_CLAIR + (E_BOSQ - E_CLAIR) * Math.pow(massif(x, z), 1.35);
    // Là où le cadastre dit « bois » — le parc de la Citadelle, le Bois de Boulogne —,
    // le bruit de bosquets ne décide plus : il y a un bois, on le plante.
    const b = bois(x, z);
    if (b > 0) e0 += (E_BOSQ * 0.88 - e0) * b;
    if (d < -MUR_DEDANS - 55) return e0;
    if (d < -MUR_DEDANS) return e0 + (E_MUR - e0) * lisse((d + MUR_DEDANS + 55) / 55);
    if (d <= MUR_DEHORS) return E_MUR;
    return E_MUR + (E_FOND - E_MUR) * lisse((d - MUR_DEHORS) / 45);
  }

  // ---------- semis par grille jitterée + rejet de proximité ----------
  const arbres = [];
  const CASE = 4, hash = new Map();
  const cle = (gx, gz) => gx * 100003 + gz;
  const tropPres = (x, z, d) => {
    const gx = Math.floor(x / CASE), gz = Math.floor(z / CASE), p = Math.ceil(d / CASE);
    for (let a = gx - p; a <= gx + p; a++) for (let b = gz - p; b <= gz + p; b++) {
      const l = hash.get(cle(a, b)); if (!l) continue;
      for (const t of l) if ((t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) < d * d) return true;
    }
    return false;
  };
  const poser = (x, z, sp, zone) => {
    const h = rand(sp.h[0], sp.h[1]);
    const t = { x, z, sp, h, rot: rand(0, TAU), zone, v: Math.floor(rand(0, sp.variantes || 1)) };
    arbres.push(t);
    const gx = Math.floor(x / CASE), gz = Math.floor(z / CASE);
    let l = hash.get(cle(gx, gz)); if (!l) hash.set(cle(gx, gz), l = []); l.push(t);
    return t;
  };
  // L'ESSENCE VIENT DU RELEVÉ. La BD Forêt v2 classe tout le pourtour de la citadelle en
  // « Feuillus » — le parc de la Citadelle et le Bois de Boulogne sont des bois de
  // feuillus. Or les poids du semis donnaient 7,6 sur 15,7 aux pins et aux sapins : une
  // pinède là où il y a des chênes et des hêtres. On filtre donc le tirage sur ce que
  // l'inventaire annonce à cet endroit, et on retombe sur les poids libres ailleurs.
  const tirer = (zone, x, z) => {
    let pool = ESPECES.filter(e => e.zones.includes(zone) && e.poids > 0);
    const ess = ctx.essence ? ctx.essence(x, z) : null;
    if (ess) {
      const veut = /feuillu/i.test(ess) ? 'feuillu' : (/conif|résineux|resineux/i.test(ess) ? 'autre' : null);
      if (veut === 'feuillu') { const f = pool.filter(e => e.type === 'feuillu'); if (f.length) pool = f; }
      else if (veut === 'autre') { const c = pool.filter(e => e.type !== 'feuillu'); if (c.length) pool = c; }
    }
    let tot = 0; for (const e of pool) tot += e.poids;
    let r = Math.random() * tot;
    for (const e of pool) { r -= e.poids; if (r <= 0) return e; }
    return pool[pool.length - 1];
  };

  // Balayage en TROIS passes, chacune à son pas. Une passe unique au pas du fourré
  // coûtait 570 000 tests de liberté sur toute la carte, pour un monde qui n'en demande
  // que le tiers : la plaine n'a pas besoin d'être échantillonnée tous les deux mètres.
  const LIM = Math.min(plaine - 8, marche + 4);
  const balayer = (pas, rMin, rMax, garde) => {
    const lim = Math.min(LIM, rMax), n = Math.ceil(lim / pas);
    for (let gx = -n; gx <= n; gx++) for (let gz = -n; gz <= n; gz++) {
      const cx = (gx + 0.5) * pas, cz = (gz + 0.5) * pas, rc = Math.hypot(cx, cz);
      if (rc > lim + pas || rc < rMin - pas) continue;                 // rejet à la case, avant tout tirage
      const x = (gx + rand(0.1, 0.9)) * pas, z = (gz + rand(0.1, 0.9)) * pas;
      const r = Math.hypot(x, z);
      if (r > LIM) continue;
      const d = r - murR(x, z);
      if (!garde(d)) continue;
      const zone = d > -MUR_DEDANS ? 'lisiere' : 'plaine';
      // dans le fourré, seuls le pentagone et le cercle extérieur comptent : on y plante
      // même là où la « nature libre » s'arrête, sinon le mur aurait des brèches
      if (zone === 'plaine' ? !libre(x, z, 0) : !libre(x, z, 0, plaine - 4)) continue;
      if (tropPres(x, z, espacement(x, z, d))) continue;
      poser(x, z, tirer(zone, x, z), zone);
    }
  };
  balayer(E_BOSQ * 0.78, 0, MUR_MAX, (d) => d <= -MUR_DEDANS);                                          // la plaine boisée
  balayer(E_MUR * 0.78, MUR_MIN - MUR_DEDANS, MUR_MAX + MUR_DEHORS, (d) => d > -MUR_DEDANS && d <= MUR_DEHORS);  // le fourré
  balayer(E_FOND * 0.78, MUR_MIN + MUR_DEHORS, LIM, (d) => d > MUR_DEHORS);                             // l'arrière-plan

  // plantations imposées (cour des remparts, fossés…)
  for (const f of (ctx.forces || [])) if (!tropPres(f.x, f.z, 3)) poser(f.x, f.z, tirer(f.zone || 'plaine', f.x, f.z), 'plaine');

  // ---------- construction des instances ----------
  const ecorce = pbrRepeat(T.bark, 2, 3);
  const mats = new Map(), geos = new Map();
  const lots = new Map();     // clé espèce|variante -> { sp, tronc:[], houppier:[] }
  for (const sp of ESPECES) {
    const nv = sp.variantes || 1;
    for (let v = 0; v < nv; v++) {
      const k = sp.nom + '|' + v;
      if (sp._geoGlb) { lots.set(k, { sp, tronc: sp._geoGlb, houppier: null, matT: sp._matGlb, matH: null, n: 0 }); continue; }
      if (!mats.has(sp.nom)) {
        // `carte` : feuillage photographié découpé dans les atlas Poly Haven (foret.js
        // fabrique les touffes hors ligne). Sans carte, on retombe sur le feuillage peint.
        mats.set(sp.nom, new THREE.MeshStandardMaterial({
          map: sp.carte ? carteForet(sp.carte) : (sp.type === 'feuillu' ? feuillesTexture(sp.teinte) : aiguillesTexture(sp.teinte)),
          alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1,
        }));
      }
      const matT = sp.slug ? phMat(sp.slug, 1.6, 13) : (sp.ecorce ? pbrRepeat(T.bark, 2, 3, { color: sp.ecorce }) : ecorce);
      lots.set(k, { sp, tronc: troncGeo(sp), houppier: houppierGeo(sp), matT, matH: mats.get(sp.nom), n: 0 });
    }
  }
  for (const t of arbres) { const l = lots.get(t.sp.nom + '|' + t.v); if (l) l.n++; }

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
  const meshes = [], feuillages = [];
  for (const [k, l] of lots) {
    if (!l.n) continue;
    l.troncI = new THREE.InstancedMesh(l.tronc, l.matT, l.n); l.troncI.castShadow = l.troncI.receiveShadow = true; l.troncI.count = 0;
    meshes.push(l.troncI); scene.add(l.troncI);
    if (l.houppier) {
      const hm = new THREE.InstancedMesh(l.houppier, l.matH, l.n);
      hm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: l.matH.map, alphaTest: 0.42 });
      hm.castShadow = true; hm.receiveShadow = true; hm.count = 0;
      l.houppierI = hm; meshes.push(hm); feuillages.push(hm); scene.add(hm);
    }
  }
  for (const t of arbres) {
    const l = lots.get(t.sp.nom + '|' + t.v); if (!l || !l.troncI) continue;
    const y = sol(t.x, t.z);
    P.set(t.x, y - 0.15, t.z); Q.setFromEuler(E.set(rand(-0.035, 0.035), t.rot, rand(-0.035, 0.035), 'YXZ'));
    S.set(t.h * rand(0.92, 1.08), t.h, t.h * rand(0.92, 1.08));
    M.compose(P, Q, S);
    l.troncI.setMatrixAt(l.troncI.count++, M);
    if (l.houppierI) l.houppierI.setMatrixAt(l.houppierI.count++, M);
    // Collision : un cylindre au pied. Dans le fourré on l'épaissit pour que les troncs
    // se touchent et qu'aucun passage ne subsiste. Au-delà du mur, l'arrière-plan n'est
    // plus atteignable : pas de capsule. C'est la moitié du budget de collision du niveau
    // qui disparaît — 26 000 capsules qui ne servaient qu'à border un décor inaccessible.
    const dm = Math.hypot(t.x, t.z) - murR(t.x, t.z);
    if (dm <= MUR_DEHORS + 3) addCap(t.x, t.z, t.x, t.z, t.zone === 'lisiere' ? 1.45 : Math.max(0.58, t.h * t.sp.rTronc * 1.9));
  }

  // ---------- arrière-plan : silhouettes au-delà du mur ----------
  // Sans collision et sans ombre portée : elles ne servent qu'à donner de la profondeur
  // à la forêt derrière la lisière, jusqu'au pied des montagnes.
  const loin = [];
  { const silGeo = (conif) => {
      const q1 = new THREE.PlaneGeometry(0.62, 1); q1.translate(0, 0.5, 0);
      const q2 = q1.clone(); q2.rotateY(Math.PI / 2);
      return fusionner([{ geo: q1, m: M4() }, { geo: q2, m: M4() }]);
    };
    for (const conif of [true, false]) {
      const N = conif ? 2200 : 1200;
      const m = new THREE.MeshStandardMaterial({ map: silhouetteTexture(conif), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
      const im = new THREE.InstancedMesh(silGeo(conif), m, N); im.castShadow = false; im.receiveShadow = true;
      let n = 0, ess = 0;
      while (n < N && ess < N * 12) {
        ess++;
        // elles commencent derrière le rideau, pas au bord de la carte : c'est tout
        // l'espace entre le mur et les montagnes qu'il faut remplir, pas un liseré.
        const a = rand(0, TAU), w = murR(Math.cos(a), Math.sin(a)) + 95;
        if (w > plaine - 12) continue;
        const r = w + Math.pow(Math.random(), 0.7) * (plaine - 6 - w), x = Math.cos(a) * r, z = Math.sin(a) * r;
        const h = conif ? rand(14, 24) : rand(10, 17);
        P.set(x, sol(x, z) - 0.2, z); Q.setFromEuler(E.set(0, rand(0, TAU), 0)); S.set(h, h, h);
        im.setMatrixAt(n++, M.compose(P, Q, S));
      }
      im.count = n; scene.add(im); loin.push(im);
    }
  }

  // ---------- fermeture du monde : l'anneau de collision et les rideaux ----------
  // Le fourré est déjà infranchissable arbre par arbre — mais une brèche d'un mètre
  // suffit à faire sortir le joueur du monde, et un semis aléatoire en laisse toujours
  // une. On double donc le fourré d'une chaîne de capsules jointives qui suit exactement
  // le tracé du mur : 256 segments pour tout le tour, là où les troncs en coûtaient
  // vingt mille. Ce qu'on perd en souplesse, on le gagne en certitude.
  for (let i = 0; i < NA; i++) {
    const a0 = i / NA * TAU, a1 = (i + 1) / NA * TAU, r0 = MUR[i], r1 = MUR[(i + 1) % NA];
    addCap(Math.cos(a0) * r0, Math.sin(a0) * r0, Math.cos(a1) * r1, Math.sin(a1) * r1, 3.4);
  }
  // Et derrière, deux rideaux de feuillage décalés : c'est eux qui rendent la forêt
  // OPAQUE. Entre des troncs, si serrés soient-ils, on voit toujours le jour passer ;
  // il faut une masse. Deux fois 256 quads, deux appels de dessin.
  const rideaux = [];
  {
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    for (const [off, h0, h1, teinte, seed] of [[26, 24, 32, 104, 3], [62, 29, 39, 114, 11]]) {
      const m = new THREE.MeshStandardMaterial({ map: rideauTexture(teinte, seed), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1 });
      const im = new THREE.InstancedMesh(geo, m, NA);
      im.castShadow = false; im.receiveShadow = true;
      for (let i = 0; i < NA; i++) {
        const a = (i + (off > 40 ? 0.5 : 0)) / NA * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const r = murR(ca, sa) + off + rand(-5, 5), x = ca * r, z = sa * r;
        const larg = TAU * r / NA * 1.45, haut = rand(h0, h1);
        P.set(x, sol(x, z) - 1.6, z);
        Q.setFromEuler(E.set(0, -(a + Math.PI / 2), 0, 'YXZ'));
        S.set(larg, haut, 1);
        im.setMatrixAt(i, M.compose(P, Q, S));
      }
      scene.add(im); rideaux.push(im);
    }
  }

  return {
    arbres, meshes, feuillages, loin, rideaux, total: arbres.length,
    mur: { rayon: murR, table: MUR, n: NA, dedans: MUR_DEDANS, dehors: MUR_DEHORS, min: MUR_MIN, max: MUR_MAX },
  };
}
