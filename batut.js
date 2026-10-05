// The Legend of Camille — le Batut et Beauregard : l'arène des deux maisons (multi, 5 octobre)
// =====================================================================
// Eugène : « c'est surtout le gameplay inside house que j'aime, pas mal pour se cacher ». Une
// arène à part, bâtie comme l'estaminet (un niveau à elle, un fichier à elle), d'après les
// grandes maisons des Roquette d'aveyron.js — la pierre du Ségala, les tuiles canal, la tour
// ronde, les volets fermés au soleil au Batut — mais sans en dépendre : ici, on entre.
//
// Un domaine clos de mur : à l'ouest le Batut, à l'est Beauregard, entre les deux un jardin
// (l'allée, le bassin à sec, quatre parterres de buis, les hêtres). Les deux maisons sont la
// même maison en miroir — une arène d'équipes se veut juste.
//
// LES MAISONS, À LA TAILLE D'UN MANOIR (Eugène, 5 octobre au soir : « les salles sont beaucoup
// trop petites pour être des salles de manoir », et l'étage par l'escalier de la tour). Un corps
// de logis de 30 × 36 m, deux niveaux :
//   - le rez-de-chaussée (4,20 m sous plafond) : le vestibule et son escalier droit, le grand
//     salon, la salle à manger (12 × 13 m chacun) ; la galerie qui traverse ; au fond, la
//     bibliothèque, la cuisine, le cellier (14 × 12 m) ;
//   - l'étage (3,60 m) : la galerie haute (10 m de large, la cage de l'escalier droit au bord),
//     deux chambres, la salle de billard, la salle d'armes ;
//   - la tour ronde, collée au fond : un escalier à vis d'un tour presque entier, de la cuisine
//     (et de la cour de derrière) à la galerie haute.
// Deux escaliers : on monte par l'un, on redescend par l'autre, on contourne.
//
// LES PORTES : Camille a 0,5 m de rayon de collision quelle que soit son échelle (engine.js,
// tryMove), et un mur arrête à son rayon plus le sien. Une porte de 1,20 m laissait 7 cm : on
// n'entrait pas. Elles font 2 m et plus.
//
// En mètres (1 unité = 1 m), Camille à l'échelle 0,6 (1,80 m). Origine au bassin, x est, z sud.
// Une maison : `u` la profondeur depuis la façade sur jardin (0) jusqu'au mur du fond (30), `v`
// le long de la façade (−18 à 18) ; x = s·(36 + u), z = v, s = −1 au Batut, +1 à Beauregard.
// =====================================================================
import * as PNJ_E from './engine.js?v=41';
import * as PNJ from './pnj.js';
import { especeGeo } from './foret.js';
import { PARTAGE } from './etat.js';
import { THREE, TAU, scene, G, PH, phMat, boxG, hemi, sun, renderer, bloom, addCap, addBox, addPlatform, addRamp, addHelix,
  showMessage, bootLevel, minimapDots, makeSky, player } from './engine.js?v=41';

// Les pierres de l'Aveyron ne sont pas au registre du moteur : chaque lieu inscrit les siennes
// (cf. aveyron.js, mêmes tailles réelles). Sans elles, phMat retombait sur un gris uni — la
// façade blanche des premiers rendus.
Object.assign(PH, {
  stone_wall:         { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a958a },
  granite_tile_03:    { tuile: 1.8, maps: ['couleur', 'normale'], repli: 0x8a8580 },
  mud_cracked_dry_03: { tuile: 4.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0xb89a74 },
  wool_boucle:        { tuile: 0.6, maps: ['couleur', 'normale', 'rugosite'], repli: 0xc8bca8 },
});

const FACADE = 36, PROF = 30, DEMI = 18;      // la façade à 36 m du bassin, 30 m de fond, 36 m de long
const H = 4.2, H1 = 4.5, HU = 3.6;            // plafond du rez-de-chaussée, plancher de l'étage, hauteur de l'étage
const HF = H1 + HU + 0.4, TOIT = 3.2;         // la corniche, le faîtage au-dessus
const TOUR = { u: PROF + 4, r: 4.2, ri: 3.6 }; // la tour : son centre derrière le mur du fond, rayons extérieur et intérieur
const CLOS = { x: FACADE + TOUR.u + TOUR.r + 7, z: DEMI + 16 };   // le mur du domaine (demi-tailles)
const MAISONS = {
  batut: { s: -1, nom: 'le Batut', volets: 0xb4c8d6, fermes: true, pierre: 0x857d6e },
  beauregard: { s: 1, nom: 'Beauregard', volets: 0x7f9a6c, fermes: false, pierre: 0x8e8470 },
};
const MURS = [];                              // pour la minicarte : les murs pleins du rez-de-chaussée, en plan
const HAIES = [];                             // idem, les buis
const PIECES = [];                            // pour le nom de la zone : { nom, x0, x1, z0, z1, y0 }

// une boîte aux six faces texturées à leur taille réelle (cf. aveyron.js)
function boite(w, h, d, slug, opt = {}) {
  const f = (u, v) => phMat(slug, u, v, opt);
  return new THREE.Mesh(boxG(w, h, d), [f(d, h), f(d, h), f(w, d), f(w, d), f(w, h), f(w, h)]);
}
function poser(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; scene.add(o); return o; }
// Un meuble : la boîte et sa collision. Au rez-de-chaussée, une boîte du moteur (on saute sur un
// banc, pas sur une armoire) ; à l'étage, une capsule à plancher — les boîtes du moteur n'ont pas
// de dessous, une table de l'étage aurait arrêté qui passe en dessous.
function meuble(x, z, w, d, h, slug, couleur, y0 = 0) {
  poser(boite(w, h, d, slug, { color: couleur }), x, y0 + h / 2, z);
  if (y0 < 1) { addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y0 + h); return; }
  const r = Math.min(w, d) / 2, l = Math.max(w, d) / 2 - r, c = w > d ? addCap(x - l, z, x + l, z, r, y0 + h) : addCap(x, z - l, x, z + l, r, y0 + h);
  c.bottom = y0 - 0.3;
}

// Un mur droit de (ax, az) à (bx, bz), de y0 à y0 + h, percé de portes : { t (le milieu, en
// mètres depuis a), w, y (le seuil, y0 par défaut), h (le haut de l'ouverture) }. Le linteau
// n'arrête personne en dessous ; un mur d'étage (y0 > 0) a un plancher : on passe sous lui.
function mur(ax, az, bx, bz, { ep = 0.25, h = H, y0 = 0, slug = 'chaux_craquelee', couleur = 0xeee6d6, portes = [] } = {}) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, ry = -Math.atan2(bz - az, bx - ax), r = ep / 2 + 0.03;
  const piece = (a, b, ya, yb, dur, bas) => {
    if (b - a < 0.02 || yb - ya < 0.02) return;
    poser(boite(b - a, yb - ya, ep, slug, { color: couleur }), ax + ux * (a + b) / 2, (ya + yb) / 2, az + uz * (a + b) / 2, ry);
    if (!dur) return;
    const c = addCap(ax + ux * a, az + uz * a, ax + ux * b, az + uz * b, r, yb);
    if (bas !== undefined) c.bottom = bas;
    if (ya < 1) MURS.push([ax + ux * a, az + uz * a, ax + ux * b, az + uz * b]);
  };
  const plancher = y0 > 0 ? y0 - 0.5 : undefined;
  let t0 = 0;
  for (const p of [...portes].sort((a, b) => a.t - b.t)) {
    const a = p.t - p.w / 2, b = p.t + p.w / 2, seuil = p.y ?? y0, haut = p.h ?? seuil + 2.6;
    piece(t0, a, y0, y0 + h, true, plancher);
    piece(a, b, y0, seuil, true, plancher);                    // l'allège sous une porte d'étage
    piece(a, b, haut, y0 + h, true, haut - 0.3);               // le linteau : il n'arrête que plus haut
    t0 = b;
  }
  piece(t0, L, y0, y0 + h, true, plancher);
}

// ---------------------------------------------------------------------
//  Une maison
// ---------------------------------------------------------------------
function maison(cle) {
  const M = MAISONS[cle], s = M.s, X = (u) => s * (FACADE + u);
  // un mur en coordonnées de maison ; les portes [p, w, seuil?, haut?] au point `p` du côté qui varie
  const murM = (u1, v1, u2, v2, opt = {}, portes = []) => mur(X(u1), v1, X(u2), v2, { ...opt,
    portes: portes.map(([p, w, y, h]) => ({ t: Math.abs(p - (u1 === u2 ? v1 : u1)), w, y, h })) });
  const exterieur = { ep: 0.6, h: HF, slug: 'stone_wall', couleur: M.pierre };
  const etage = { y0: H1, h: HU };
  const NOM = M.nom.charAt(0).toUpperCase() + M.nom.slice(1);
  const rect = (u0, u1, v0, v1) => [Math.min(X(u0), X(u1)), Math.max(X(u0), X(u1)), Math.min(v0, v1), Math.max(v0, v1)];
  const piece = (nom, u0, u1, v0, v1, sol, teinte, y = 0) => {
    const [x0, x1, z0, z1] = rect(u0, u1, v0, v1);
    PIECES.push({ nom: `${NOM} — ${nom}`, x0, x1, z0, z1, y0: y });
    if (sol) poser(boite(x1 - x0, 0.06, z1 - z0, sol, { color: teinte }), (x0 + x1) / 2, y + 0.03, (z0 + z1) / 2).castShadow = false;
  };

  // ---- le rez-de-chaussée : les sols ----
  piece('le vestibule', 0, 12, -5, 5, 'worn_tile_floor', 0xd8d0c4);
  piece('le grand salon', 0, 12, 5, DEMI, 'wood_planks', 0xb08a62);
  piece('la salle à manger', 0, 12, -DEMI, -5, 'worn_tile_floor', 0xc8b8a4);
  piece('la galerie', 12, 16, -DEMI, DEMI, 'wood_planks', 0x9a7a58);
  piece('la bibliothèque', 16, PROF, 6, DEMI, 'wood_planks', 0x8a6a4a);
  piece('la cuisine', 16, PROF, -6, 6, 'worn_tile_floor', 0xbcae9a);
  piece('le cellier', 16, PROF, -DEMI, -6, 'terre_battue', 0xa89478);
  // ---- l'étage : les pièces (leur sol est le plancher, posé plus bas) ----
  piece('la galerie haute', 0, PROF, -5, 5, null, 0, H1);
  piece('la grande chambre', 0, 15, -DEMI, -5, null, 0, H1);
  piece('la chambre du fond', 15, PROF, -DEMI, -5, null, 0, H1);
  piece('la salle de billard', 0, 15, 5, DEMI, null, 0, H1);
  piece('la salle d’armes', 15, PROF, 5, DEMI, null, 0, H1);

  // ---- les murs extérieurs : pierre, sur les deux niveaux ----
  // la façade : la porte, la porte-fenêtre du salon ; le fond : la tour (en bas depuis la cuisine,
  // en haut depuis la galerie haute), la porte de service de la cuisine ; les deux bouts de la galerie
  murM(0, -DEMI, 0, DEMI, exterieur, [[0, 2.4, 0, 3.0], [11.5, 2.0, 0, 2.8]]);
  murM(PROF, -DEMI, PROF, DEMI, exterieur, [[-1.6, 2.0, 0, 2.6], [1.6, 2.0, H1, H1 + 2.5], [-4.6, 2.0, 0, 2.5]]);
  murM(0, DEMI, PROF, DEMI, exterieur, [[14, 2.2, 0, 2.7]]);
  murM(0, -DEMI, PROF, -DEMI, exterieur, [[14, 2.2, 0, 2.7]]);
  // ---- les cloisons du rez-de-chaussée ----
  murM(12, -DEMI, 12, DEMI, {}, [[11.5, 2.2], [-11.5, 2.2]]);                         // devant / galerie (l'escalier du vestibule s'y adosse)
  murM(16, -DEMI, 16, DEMI, {}, [[12, 2.2], [0, 2.4], [-12, 2.2]]);                    // galerie / fond
  murM(0, 5, 12, 5, {}, [[1.6, 2.0]]);                                                 // vestibule / salon
  murM(0, -5, 12, -5, {}, [[6, 2.2]]);                                                 // vestibule / salle à manger
  murM(16, 6, PROF, 6, {}, [[23, 2.0]]);                                               // bibliothèque / cuisine
  murM(16, -6, PROF, -6, {}, [[19, 2.0]]);                                            // cuisine / cellier (la cheminée est à u = 23)
  // ---- les cloisons de l'étage ----
  murM(0, 5, PROF, 5, etage, [[7.5, 2.0], [22.5, 2.0]]);                               // galerie haute / billard, salle d'armes
  murM(0, -5, PROF, -5, etage, [[7.5, 2.0], [22.5, 2.0]]);                             // galerie haute / chambres
  murM(15, 5, 15, DEMI, etage, [[11.5, 2.0]]);                                         // billard / salle d'armes
  murM(15, -5, 15, -DEMI, etage, [[-11.5, 2.0]]);                                      // les deux chambres

  // ---- l'escalier droit du vestibule : contre le mur du salon, de u = 3 à 11 ----
  const ESC = { u0: 3, u1: 11, v0: 2.6, v1: 4.3 };
  { const [x0, x1, z0, z1] = rect(ESC.u0, ESC.u1, ESC.v0, ESC.v1), n = 18, L = ESC.u1 - ESC.u0, w = ESC.v1 - ESC.v0;
    addRamp(X(ESC.u0), (z0 + z1) / 2, s, 0, L, w, 0, H1);
    for (let k = 0; k < n; k++) {
      const u = ESC.u0 + (k + 0.5) * L / n, y = (k + 1) * H1 / n;
      poser(boite(L / n + 0.02, 0.18, w, 'wood_planks', { color: 0x6a4a2e }), X(u), y - 0.09, (z0 + z1) / 2);
      poser(boite(L / n, y - 0.18, 0.12, 'wood_cabinet_worn_long', { color: 0x4a3420 }), X(u), (y - 0.18) / 2, z0 + 0.06);   // le limon, côté vestibule
    }
    // en haut, la rampe de la cage (on ne tombe pas dans l'escalier depuis la galerie haute)
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [X(ESC.u0), z0, X(ESC.u0), z1]]) {
      const c = addCap(ax, az, bx, bz, 0.1, H1 + 1.0); c.bottom = H1 - 0.4;
      const l = Math.hypot(bx - ax, bz - az);
      poser(boite(l, 0.1, 0.1, 'wood_cabinet_worn_long', { color: 0x4a3420 }), (ax + bx) / 2, H1 + 0.95, (az + bz) / 2, -Math.atan2(bz - az, bx - ax));
      for (let t = 0; t <= l; t += 0.5) poser(boite(0.05, 0.9, 0.05, 'wood_cabinet_worn_long', { color: 0x4a3420 }), ax + (bx - ax) * t / l, H1 + 0.45, az + (bz - az) * t / l);
    }
  }

  // ---- le plancher de l'étage (et le plafond du rez-de-chaussée), troué par la cage ----
  { const [hx0, hx1, hz0, hz1] = rect(ESC.u0, ESC.u1, ESC.v0, ESC.v1), [x0, x1, z0, z1] = rect(0.3, PROF - 0.3, -DEMI + 0.3, DEMI - 0.3);
    for (const [a, b, c, d] of [[x0, x1, z0, hz0], [x0, x1, hz1, z1], [x0, hx0, hz0, hz1], [hx1, x1, hz0, hz1]]) {
      addPlatform(a, b, c, d, H1);
      poser(boite(b - a, H1 - H, d - c, 'wood_planks', { color: 0x6a4e34 }), (a + b) / 2, (H + H1) / 2, (c + d) / 2).castShadow = false;
      poser(boite(b - a, 0.04, d - c, 'wood_planks', { color: 0x9a7650 }), (a + b) / 2, H1 + 0.02, (c + d) / 2).castShadow = false;
    }
    // les poutres sous le plancher (pas au-dessus de la cage)
    for (let v = -DEMI + 2.5; v < DEMI; v += 3.2) if (v < ESC.v0 - 0.3 || v > ESC.v1 + 0.3)
      poser(boite(PROF - 0.6, 0.3, 0.26, 'wood_cabinet_worn_long', { color: 0x4a3420 }), (x0 + x1) / 2, H - 0.15, v);
    // le plafond de l'étage
    poser(boite(x1 - x0, 0.2, z1 - z0, 'chaux_craquelee', { color: 0xe4dccc }), (x0 + x1) / 2, H1 + HU + 0.1, (z0 + z1) / 2).castShadow = false;
  }

  // ---- la toiture ----
  const [x0, x1] = rect(0, PROF, 0, 0), xc = (x0 + x1) / 2;
  { const o = 0.7, la = PROF / 2 + o, lb = DEMI + o, P = [], UV = [];
    for (const sg of [-1, 1]) {
      const q = [[xc + sg * la, HF, -lb], [xc + sg * la, HF, lb], [xc, HF + TOIT, lb], [xc, HF + TOIT, -lb]], rampe = Math.hypot(la, TOIT);
      for (const k of [0, 1, 2, 0, 2, 3]) P.push(...q[k]);
      UV.push(0, 0, 2 * lb, 0, 2 * lb, rampe, 0, 0, 2 * lb, rampe, 0, rampe);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV.map((t) => t / 3), 2)); g.computeVertexNormals();
    poser(new THREE.Mesh(g, phMat('clay_roof_tiles_02', 1, 1, { color: 0xd8bca8, roughness: 0.9, side: THREE.DoubleSide })), 0, 0, 0);
    for (const sv of [-1, 1]) {                       // les pignons
      const pg = new THREE.BufferGeometry(), z = sv * DEMI;
      pg.setAttribute('position', new THREE.Float32BufferAttribute([x0, HF, z, x1, HF, z, xc, HF + TOIT - 0.2, z], 3));
      pg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, PROF / 2, 0, PROF / 4, TOIT / 2], 2)); pg.computeVertexNormals();
      poser(new THREE.Mesh(pg, phMat('stone_wall', 1, 1, { color: M.pierre, side: THREE.DoubleSide })), 0, 0, 0);
    }
    for (const v of [-DEMI + 5, DEMI - 5]) poser(boite(1.4, 2.6, 1.0, 'stone_wall', { color: 0x8a8274 }), X(PROF - 8), HF + TOIT - 0.4, v);   // les souches de cheminée
  }

  // ---- la tour ronde et son escalier à vis ----
  { const xc = X(TOUR.u), zc = 0, R = TOUR.r, Ri = TOUR.ri, HT = HF + 3.5;
    poser(new THREE.Mesh(new THREE.ConeGeometry(R + 0.6, 4.2, 32, 1, true), phMat('clay_roof_tiles_02', TAU * R / 2, 4.4, { color: 0xd8bca8, side: THREE.DoubleSide })), xc, HT + 2.1, zc);
    poser(new THREE.Mesh(new THREE.CylinderGeometry(Ri, Ri, 0.1, 32), phMat('worn_tile_floor', 2 * Ri, 2 * Ri, { color: 0xbcae9a })), xc, 0.05, zc).castShadow = false;
    // les portes, vues du centre de la tour : en bas vers la cuisine et vers la cour, en haut vers la galerie haute
    const ang = (x, z) => Math.atan2(z - zc, x - xc);
    const gBas = ang(X(PROF), -1.6), gHaut = ang(X(PROF), 1.6), gCour = ang(X(PROF + 8), 0);
    const pres = (a, b) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI);
    // Le mur de la tour en 32 pans de pierre (un cylindre d'un seul tenant fermait les portes à la
    // vue) ; chaque pan bloque en bas et en haut, sauf aux portes, jusqu'à leur linteau
    const N = 32, rm = (R + Ri) / 2, larg = 2 * rm * Math.sin(Math.PI / N) + 0.08;
    for (let k = 0; k < N; k++) {
      const a = k / N * TAU, b = (k + 1) / N * TAU, m = (a + b) / 2, ax = xc + Math.cos(a) * (Ri + 0.15), az = zc + Math.sin(a) * (Ri + 0.15), bx = xc + Math.cos(b) * (Ri + 0.15), bz = zc + Math.sin(b) * (Ri + 0.15);
      // ±0,45 rad : la porte de la maison n'est pas en face du centre, à ±0,3 le pan voisin barrait le seuil
      const porteBas = pres(m, gBas) < 0.45 || pres(m, gCour) < 0.45, porteHaut = pres(m, gHaut) < 0.45;
      const c1 = addCap(ax, az, bx, bz, 0.15, H1); if (porteBas) c1.bottom = 2.4;
      const c2 = addCap(ax, az, bx, bz, 0.15, HT); c2.bottom = porteHaut ? H1 + 2.3 : H1 - 0.3;
      const pan = (y0, y1) => { if (y1 - y0 > 0.02) poser(boite(R - Ri, y1 - y0, larg, 'stone_wall', { color: M.pierre }), xc + Math.cos(m) * rm, (y0 + y1) / 2, zc + Math.sin(m) * rm, -m); };
      if (porteBas) { pan(2.5, H1); } else pan(0, H1);
      if (porteHaut) pan(H1 + 2.4, HT); else pan(H1, HT);
    }
    // la porte sur la cour : une ouverture dans la pierre (un cadre de granit)
    { const gx = xc + Math.cos(gCour) * R, gz = zc + Math.sin(gCour) * R;
      poser(new THREE.Mesh(boxG(2.1, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 1 })), gx, 1.2, gz, -gCour + Math.PI / 2).castShadow = false; }
    // le noyau de la vis
    poser(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, HT, 12), phMat('granite_tile_03', 2.2, HT, { color: 0x9a948a })), xc, HT / 2, zc);
    addCap(xc, zc, xc, zc, 0.4, HT);
    // L'escalier : il part à côté de la porte du bas, tourne presque un tour entier et arrive à
    // côté de la porte du haut. Le sens qui fait le plus long tour (le plus doux) est retenu.
    const mod = (a) => ((a % TAU) + TAU) % TAU;
    let best = null;
    for (const cw of [false, true]) { const debut = gBas + (cw ? -0.5 : 0.5), tour = cw ? mod(debut - gHaut) : mod(gHaut - debut); if (!best || tour > best.tour) best = { cw, debut, tour }; }
    const f = best.tour / TAU, hTour = H1 / f, angle = (t) => best.debut + (best.cw ? -t : t);
    addHelix(xc, zc, 0.9, Ri - 0.65, 0, hTour, 1, best.debut, best.cw);
    const n = Math.round(f * 30);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n * best.tour, a = angle(t), y = (k + 1) * H1 / n, rm = (0.35 + Ri) / 2;
      poser(boite(Ri - 0.35, 0.2, (Ri * best.tour / n) * 1.15, 'granite_tile_03', { color: 0xa8a294 }), xc + Math.cos(a) * rm, y - 0.1, zc + Math.sin(a) * rm, -a);
    }
    // en haut, le palier côté maison, et un garde-fou au-delà de la dernière marche (sans lui, on
    // continuait de monter sur une vis invisible)
    { const xa = Math.min(xc, X(PROF - 0.8)), xb = Math.max(xc, X(PROF - 0.8));   // jusqu'au plancher de l'étage, par-dessus l'épaisseur du mur (on tombait dans le seuil)
      addPlatform(xa, xb, zc - Ri, zc + Ri, H1);
      // (le demi-disque du côté de la maison : la géométrie compte θ depuis +z, x = r·sin θ)
      poser(new THREE.Mesh(new THREE.CylinderGeometry(Ri, Ri, 0.25, 32, 1, false, s < 0 ? 0 : Math.PI, Math.PI), phMat('wood_planks', 2 * Ri, Ri, { color: 0x7a5a3a })), xc, H1 - 0.125, zc);
      const aB = angle(best.tour + 0.45), c = addCap(xc, zc, xc + Math.cos(aB) * Ri, zc + Math.sin(aB) * Ri, 0.12, H1 + 1.6); c.bottom = H1 - 0.5; }
    PIECES.push({ nom: `${NOM} — la tour`, x0: xc - Ri, x1: xc + Ri, z0: zc - Ri, z1: zc + Ri, y0: 0, tour: true });
  }

  // ---- les baies : granit, vitre, croisée, volets ; dedans, le jour qui entre ----
  const vitre = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.18, metalness: 0.35 });
  const jour = new THREE.MeshBasicMaterial({ color: 0xd6e6f2 });
  const bois = phMat('wood_planks', 0.6, 1.8, { color: M.volets });
  // face : 'facade' | 'fond' | 'nord' | 'sud' ; p : la position le long du mur (v ou u)
  function baie(face, p, y, w = 1.2, h = 1.9) {
    const [u, v, nx, nz] = face === 'facade' ? [0, p, -s, 0] : face === 'fond' ? [PROF, p, s, 0] : face === 'nord' ? [p, -DEMI, 0, -1] : [p, DEMI, 0, 1];
    const ry = Math.atan2(nx, nz), f = new THREE.Group();
    f.position.set(X(u) + nx * 0.31, y, v + nz * 0.31); f.rotation.y = ry; scene.add(f);
    const gr = (a, b, x, yy) => { const m = boite(a, b, 0.2, 'granite_tile_03', { color: 0xbab4a8 }); m.position.set(x, yy, 0.05); f.add(m); };
    gr(w + 0.5, 0.26, 0, h / 2 + 0.13); gr(w + 0.6, 0.16, 0, -h / 2 - 0.08); gr(0.22, h, -w / 2 - 0.11, 0); gr(0.22, h, w / 2 + 0.11, 0);
    f.add(new THREE.Mesh(boxG(w, h, 0.05), vitre));
    if (M.fermes) { for (const sx of [-1, 1]) { const m = new THREE.Mesh(boxG(w / 2 - 0.02, h, 0.05), bois); m.position.set(sx * w / 4, 0, 0.08); f.add(m); } }
    else for (const sx of [-1, 1]) { const m = new THREE.Mesh(boxG(w / 2, h, 0.05), bois); m.position.set(sx * (w * 0.75 + 0.24), 0, 0.12); f.add(m); }
    const j = new THREE.Mesh(boxG(w, h, 0.02), jour); j.position.set(X(u) - nx * 0.32, y, v - nz * 0.32); j.rotation.y = ry; scene.add(j);
  }
  const yB = 1.8, yH = H1 + 1.6;
  for (const v of [-15, -8.5, 6.5, 16]) baie('facade', v, yB);
  for (const v of [-15, -10, -2.5, 2.5, 10, 15]) baie('facade', v, yH);
  for (const v of [-12, 10, 15]) baie('fond', v, yB);
  for (const v of [-15, -9, 9, 15]) baie('fond', v, yH);
  for (const f of ['nord', 'sud']) { for (const u of [6, 22, 27]) baie(f, u, yB); for (const u of [4, 10, 20, 26]) baie(f, u, yH); }

  // ---- le mobilier : de quoi se cacher ----
  const BOIS = 'wood_cabinet_worn_long', SOMBRE = 0x5a4030, CLAIR = 0x8a6a48, mx = X;
  // le vestibule : un banc, un coffre, une console
  meuble(mx(1.2), -3.6, 2.2, 0.55, 0.5, BOIS, CLAIR); meuble(mx(8), -4.4, 1.4, 0.6, 0.9, BOIS, SOMBRE);
  // le grand salon : la cheminée sur le pignon, deux canapés face à face, la table basse, des fauteuils, un piano
  { const fx = mx(6), fz = DEMI - 0.55;
    poser(boite(3.2, 1.8, 0.8, 'granite_tile_03', { color: 0xbab4a8 }), fx, 0.9, fz); addBox(fx - 1.6, fx + 1.6, fz - 0.4, fz + 0.4, 1.8);
    poser(new THREE.Mesh(boxG(1.8, 0.9, 0.1), new THREE.MeshBasicMaterial({ color: 0xff8a3a })), fx, 0.55, fz - 0.41);
    poser(boite(3.6, 2.2, 0.6, 'stone_wall', { color: 0x9a9284 }), fx, 2.9, fz + 0.05); }
  const canape = (u, v, dos) => {
    const x = mx(u), dx = s * dos;                       // dos : +1 le dossier côté fond, −1 côté façade
    poser(boite(0.95, 0.45, 2.8, 'fabric_pattern_07', { color: 0x7a3e32 }), x, 0.225, v);
    poser(boite(0.22, 0.95, 2.8, 'fabric_pattern_07', { color: 0x6e362c }), x + dx * 0.37, 0.475, v);
    for (const sz of [-1, 1]) poser(boite(0.95, 0.65, 0.2, 'fabric_pattern_07', { color: 0x6e362c }), x, 0.325, v + sz * 1.3);
    addBox(x - 0.48, x + 0.48, v - 1.4, v + 1.4, 0.95);
  };
  canape(3.5, 12, -1); canape(8.5, 12, 1); meuble(mx(6), 12, 1.2, 1.8, 0.45, BOIS, SOMBRE);
  meuble(mx(5.5), 7.4, 1.0, 1.0, 1.0, 'fabric_pattern_07', 0x6a5a3a); meuble(mx(10.5), 7.2, 1.6, 2.2, 1.0, BOIS, 0x2a1e16);   // un fauteuil, le piano
  // la salle à manger : la longue table, les buffets contre le pignon et la cloison
  meuble(mx(6), -11.5, 1.4, 6.0, 0.78, BOIS, SOMBRE); meuble(mx(6), -DEMI + 0.45, 3.4, 0.6, 1.2, BOIS, SOMBRE);
  meuble(mx(11.4), -9, 0.6, 2.4, 1.0, BOIS, CLAIR);
  // la galerie : des coffres, une horloge, une statue
  meuble(mx(15.4), -6, 0.7, 1.2, 0.7, BOIS, SOMBRE); meuble(mx(15.4), 6, 0.7, 1.2, 0.7, BOIS, SOMBRE);   // contre la cloison : au milieu, ils bouchaient la galerie meuble(mx(15.4), -16.5, 0.6, 0.6, 2.2, BOIS, SOMBRE);
  meuble(mx(14), 0, 0.9, 0.9, 1.9, 'granite_tile_03', 0xc8c2b6);
  // la bibliothèque : quatre rayonnages en épis (2,4 m : on ne voit pas par-dessus), une table de lecture
  const livres = [0x6a2a24, 0x2a4a3a, 0x3a3a5a, 0x7a5a2a, 0x4a2a3a];
  for (const [k, v] of [[0, 8.5], [1, 11], [2, 13.5], [3, 16]]) {
    const ua = 18.5, ub = 26, x = (mx(ua) + mx(ub)) / 2, w = ub - ua;
    meuble(x, v, w, 0.5, 2.4, 'wood_planks', 0x4a3424);
    for (let r = 0; r < 4; r++) for (const sd of [-1, 1]) poser(boite(w - 0.3, 0.34, 0.06, 'wood_cabinet_worn_long', { color: livres[(k + r) % 5] }), x, 0.4 + r * 0.55, v + sd * 0.27).castShadow = false;
  }
  meuble(mx(28.3), 10, 1.2, 2.4, 0.78, BOIS, SOMBRE);
  // la cuisine : la grande cheminée sur la cloison du cellier, la table, le vaisselier, des tonneaux
  { const fx = mx(23), fz = -6 + 0.55;
    poser(boite(3.0, 2.2, 0.9, 'stone_wall', { color: 0x9a9284 }), fx, 1.1, fz); addBox(fx - 1.5, fx + 1.5, fz - 0.45, fz + 0.45, 2.2);
    poser(new THREE.Mesh(boxG(1.8, 1.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xff7a2a })), fx, 0.65, fz + 0.46); }
  meuble(mx(22), 1.5, 3.4, 1.4, 0.82, BOIS, CLAIR); meuble(mx(18), 5.4, 2.6, 0.55, 2.0, BOIS, SOMBRE);
  const tonneau = (u, v) => { poser(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.05, 14), phMat('wood_planks', 2.8, 1.05, { color: 0x6a4a2a })), mx(u), 0.525, v); addCap(mx(u), v, mx(u), v, 0.48, 1.05); };
  // le cellier : des rangs de tonneaux et de caisses
  for (const v of [-8.5, -11.5, -14.5]) for (const u of [20, 23, 26]) tonneau(u, v);       // 3 m d'axe en axe : on passe entre
  meuble(mx(23), -16.8, 4, 1.2, 1.5, 'wood_planks', 0x7a5a3a);
  // l'étage : la grande chambre (lit, armoire), la chambre du fond, le billard, la salle d'armes
  const y = H1;
  meuble(mx(6), -15.8, 2.4, 2.2, 0.65, 'wool_boucle', 0xc8bca8, y); meuble(mx(6), -17.3, 2.4, 0.2, 1.5, BOIS, SOMBRE, y);
  meuble(mx(12.5), -17.4, 2.0, 0.7, 2.3, BOIS, SOMBRE, y); meuble(mx(2), -8, 1.2, 0.6, 0.8, BOIS, CLAIR, y);
  meuble(mx(24), -15.8, 2.2, 2.0, 0.65, 'wool_boucle', 0xb8c4c8, y); meuble(mx(28.8), -10, 0.7, 2.0, 2.2, BOIS, SOMBRE, y);
  meuble(mx(7.5), 11.5, 2.6, 1.5, 0.85, BOIS, 0x2e4a2e, y);                                     // le billard
  meuble(mx(2), 16, 1.4, 0.5, 1.8, BOIS, SOMBRE, y);
  for (const v of [8, 11, 14]) meuble(mx(28.9), v, 0.5, 2.0, 2.1, BOIS, SOMBRE, y);              // les râteliers de la salle d'armes
  meuble(mx(21), 11.5, 2.4, 1.2, 0.85, BOIS, CLAIR, y);
  // la galerie haute : des bancs, deux bahuts
  meuble(mx(16), -4.2, 2.4, 0.5, 0.5, BOIS, CLAIR, y); meuble(mx(24), 4.2, 2.4, 0.5, 0.5, BOIS, CLAIR, y);
  meuble(mx(20), -4.3, 1.4, 0.6, 1.1, BOIS, SOMBRE, y);

  // ---- dehors : un tas de bois, une charrette, des tonneaux ; la cour de terre battue ----
  meuble(X(PROF + 3), DEMI + 3, 1.2, 4, 1.4, 'wood_planks', 0x7a5a3a);
  meuble(X(-6), -9, 1.6, 3.2, 1.1, 'wood_planks', 0x6a4a2a);
  for (const v of [7, 8.3]) { poser(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.05, 14), phMat('wood_planks', 2.8, 1.05, { color: 0x6a4a2a })), X(-1.6), 0.525, v); addCap(X(-1.6), v, X(-1.6), v, 0.48, 1.05); }
  poser(boite(8, 0.04, 2 * DEMI + 4, 'terre_battue', { color: 0xb09878 }), X(-4), 0.02, 0).castShadow = false;
}

// ---------------------------------------------------------------------
//  Le jardin et le mur du domaine
// ---------------------------------------------------------------------
function jardin() {
  poser(new THREE.Mesh(new THREE.BoxGeometry(500, 0.1, 500), phMat('withered_grass', 500, 500, { color: 0xa8a87a })), 0, -0.06, 0).castShadow = false;
  poser(boite(2 * CLOS.x, 0.04, 2 * CLOS.z, 'grass_ground', { color: 0xa2b47a }), 0, 0, 0).castShadow = false;
  // l'allée de gravier d'une porte à l'autre, et son tour du bassin
  poser(boite(2 * FACADE - 8, 0.05, 4, 'gravier', { color: 0xc8beac }), 0, 0.03, 0).castShadow = false;
  poser(new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.05, 40), phMat('gravier', 14, 14, { color: 0xc8beac })), 0, 0.035, 0).castShadow = false;
  // le bassin, à sec : une margelle de pierre, le fond craquelé
  { const R = 4;
    poser(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.7, 40, 1, true), phMat('granite_tile_03', TAU * R, 0.7, { color: 0x9a948a, side: THREE.DoubleSide })), 0, 0.35, 0);
    poser(new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 8, 40), phMat('granite_tile_03', TAU * R, 1.4, { color: 0x9a948a })), 0, 0.7, 0).rotation.x = Math.PI / 2;
    poser(new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 0.05, 40), phMat('mud_cracked_dry_03', 8, 8, { color: 0xb8a088 })), 0, 0.06, 0).castShadow = false;
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, b = (k + 1) / 16 * TAU; addCap(Math.cos(a) * R, Math.sin(a) * R, Math.cos(b) * R, Math.sin(b) * R, 0.3, 0.75); }
    MURS.push([-R, 0, R, 0]); }
  // quatre parterres de buis : une haie d'1,40 m, ouverte au milieu de chaque côté
  const buis = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax);
    poser(boite(L, 1.4, 0.8, 'forest_leaves_04', { color: 0x4a6a3a }), (ax + bx) / 2, 0.7, (az + bz) / 2, ry);
    addCap(ax, az, bx, bz, 0.45, 1.4); HAIES.push([ax, az, bx, bz]);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const xa = sx * 9, xb = sx * 27, za = sz * 6, zb = sz * 24, xm = (xa + xb) / 2, zm = (za + zb) / 2, o = 1.6;
    buis(xa, za, xm - sx * o, za); buis(xm + sx * o, za, xb, za); buis(xa, zb, xm - sx * o, zb); buis(xm + sx * o, zb, xb, zb);
    buis(xa, za, xa, zm - sz * o); buis(xa, zm + sz * o, xa, zb); buis(xb, za, xb, zm - sz * o); buis(xb, zm + sz * o, xb, zb);
    poser(new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), phMat('forest_leaves_04', 4, 4, { color: 0x3e5e32 })), xm, 1.3, zm);
    addCap(xm, zm, xm, zm, 1.2, 2.6);
  }
  // deux rangs d'arbres le long du mur du domaine : les hêtres de la forêt du jeu (foret.js)
  { const esp = especeGeo('hetre'), places = [];
    for (const sz of [-1, 1]) for (let x = -30; x <= 30; x += 10) places.push([x + (Math.random() - 0.5) * 1.5, sz * (CLOS.z - 5)]);
    if (esp) {
      const n = places.length, tr = new THREE.InstancedMesh(esp.tronc, esp.matT, n), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
      places.forEach(([x, z], k) => { const h = 9 + Math.random() * 3; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * TAU); sc.set(h, h, h);
        m4.compose(v.set(x, -0.2, z), q, sc); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
      tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
    }
    for (const [x, z] of places) addCap(x, z, x, z, 0.5, 4); }
  // le mur du domaine : 2,6 m de pierre, on n'en sort pas
  const clos = { ep: 0.6, h: 2.6, slug: 'old_stone_wall_02', couleur: 0xb0a898 };
  mur(-CLOS.x, -CLOS.z, CLOS.x, -CLOS.z, clos); mur(-CLOS.x, CLOS.z, CLOS.x, CLOS.z, clos);
  mur(-CLOS.x, -CLOS.z, -CLOS.x, CLOS.z, clos); mur(CLOS.x, -CLOS.z, CLOS.x, CLOS.z, clos);
}

// ---------------------------------------------------------------------
//  Le niveau
// ---------------------------------------------------------------------
function build() {
  makeSky(0x3a6ab0, 0x9ac0e0, 0xe0dccc, true);
  scene.fog = new THREE.Fog(0xd8d4c4, 140, 900);
  hemi.intensity = 0.8; hemi.color.setHex(0xfff2dc); hemi.groundColor.setHex(0x5a4a36);
  sun.intensity = 2.6; sun.color.setHex(0xfff0d8); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 420 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.15;
  jardin();
  maison('batut'); maison('beauregard');
}
// où est Camille : dans une maison (et à quel niveau), dans une tour, ou dehors
const dansMaison = (x, z) => Math.abs(z) < DEMI && Math.abs(x) > FACADE && Math.abs(x) < FACADE + PROF;
const dansTour = (x, z) => Math.hypot(Math.abs(x) - (FACADE + TOUR.u), z) < TOUR.ri + 0.2;
// dedans, la caméra reste sous le plafond (celui de l'étage où l'on est) et se rapproche ; dans
// la tour, elle suit Camille dans la vis ; dehors, elle reprend du champ
function animate() {
  const p = player.pos, haut = p.y > H1 - 0.8;
  if (dansTour(p.x, p.z)) { G.camMaxY = p.y + 2.4; G.camBack = 3; G.camUp = 1.8; }
  else if (dansMaison(p.x, p.z)) { G.camMaxY = haut ? H1 + HU - 0.3 : H - 0.3; G.camBack = 4.6; G.camUp = 2.2; }
  else { G.camMaxY = Infinity; G.camBack = 7; G.camUp = 3.4; }
}
function populate() { player.pos.set(0, 0, 9); player.yaw = Math.PI; G.camYaw = Math.PI; }
function zoneName(x, z) {
  const y = player.pos.y;
  for (const r of PIECES) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && (r.tour || (y > H1 - 0.8) === (r.y0 > 0))) return r.nom;
  return 'Le jardin';
}
// la minicarte : tout le domaine d'un coup d'œil, les murs, les buis, la limite de l'aire, les joueurs
function minimap(g, W2) {
  const sc = (W2 - 10) / (2 * CLOS.x), P = (x, z) => [W2 / 2 + x * sc, W2 / 2 + z * sc];
  g.fillStyle = '#8a9a5e'; g.fillRect(0, 0, W2, W2);
  g.fillStyle = '#b8ab90';
  for (const s of [-1, 1]) { const [a, b] = P(s < 0 ? -FACADE - PROF : FACADE, -DEMI); g.fillRect(a, b, PROF * sc, 2 * DEMI * sc);
    const [c, d] = P(s * (FACADE + TOUR.u), 0); g.beginPath(); g.arc(c, d, TOUR.r * sc, 0, TAU); g.fill(); }
  g.lineCap = 'round';
  g.strokeStyle = '#3e5a30'; g.lineWidth = Math.max(2, 0.8 * sc);
  for (const [ax, az, bx, bz] of HAIES) { const [a, b] = P(ax, az), [c, d] = P(bx, bz); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  g.strokeStyle = '#3a2e24'; g.lineWidth = Math.max(1.2, 0.3 * sc);
  for (const [ax, az, bx, bz] of MURS) { const [a, b] = P(ax, az), [c, d] = P(bx, bz); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  // la limite de l'aire du multi (PARTAGE.aires, posée par tloc-multi.js) : pleine, celle en
  // vigueur ; en tirets, celle qui s'annonce
  for (const a of PARTAGE.aires || []) {
    g.save(); g.strokeStyle = a.couleur; g.lineWidth = 2; g.setLineDash(a.tirets ? [5, 4] : []);
    g.beginPath(); a.pts.forEach(([x, z], k) => { const [u, v] = P(x, z); k ? g.lineTo(u, v) : g.moveTo(u, v); }); g.stroke(); g.restore();
  }
  minimapDots(g, P);
}

// L'ARÈNE (cf. ARENE_LILLE dans game.js, docs/NOTE-MULTI.md) : tout le domaine, puis le jardin
// seul — en fin de manche, il faut sortir des maisons. Chaque aire a sa mesure (`sd`) : le
// jardin n'est pas le domaine rétréci (il est plus long que large, l'autre l'inverse).
function sdRect(x, z, hx, hz) { const dx = Math.abs(x) - hx, dz = Math.abs(z) - hz; return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0); }
const ARENE_BATUT = {
  id: 'batut', nom: 'Le Batut et Beauregard',
  sd: (x, z) => sdRect(x, z, CLOS.x - 2, CLOS.z - 2), centre: [0, 0],
  depart: { x: 0, z: 9 },
  aires: [
    { id: 'domaine', nom: 'le domaine', r: 0, couleur: '#ffd070', lueur: 0xffc860, eparpille: 40 },
    // entre les deux façades, parterres compris
    { id: 'jardin', nom: 'le jardin', r: 0, sd: (x, z) => sdRect(x, z, FACADE - 4, 26), couleur: '#ff9a70', lueur: 0xff6a3a, eparpille: 20 },
  ],
  camps: {
    garnison: { nom: 'Le Batut', court: 'Batut', pluriel: false },
    bourg: { nom: 'Beauregard', court: 'Beauregard', pluriel: false },
  },
  campsTexte: 'Le Batut contre Beauregard : chacun tient sa maison, et le jardin est entre les deux.',
  // chacun arrive dans son vestibule
  departsCamps: { garnison: [-(FACADE + 7), -1.5], bourg: [FACADE + 7, -1.5] },
  dispersion: 2.5,                       // on reste dans son vestibule (12 × 10 m)
  // de quoi fouiller les maisons : l'armure en haut, dans la grande chambre ; l'arc dans la
  // bibliothèque ; l'écu, un seul, au bord du bassin — on se le dispute au milieu du jardin
  objets: [
    { id: 'armure-batut', type: 'armure', x: -(FACADE + 8), z: -11, y: H1, nom: 'dans la grande chambre du Batut' },
    { id: 'armure-beauregard', type: 'armure', x: FACADE + 8, z: -11, y: H1, nom: 'dans la grande chambre de Beauregard' },
    { id: 'arc-batut', type: 'arc', x: -(FACADE + 22), z: 9.75, y: 0, nom: 'dans la bibliothèque du Batut' },
    { id: 'arc-beauregard', type: 'arc', x: FACADE + 22, z: 9.75, y: 0, nom: 'dans la bibliothèque de Beauregard' },
    { id: 'bouclier', type: 'bouclier', x: 0, z: 6, nom: 'au bord du bassin' },
  ],
  pointsForts: () => [
    { id: 'bassin', nom: 'le bassin', x: 0, z: 0 },
    { id: 'parterre-no', nom: 'le parterre nord-ouest', x: -18, z: -15 },
    { id: 'parterre-ne', nom: 'le parterre nord-est', x: 18, z: -15 },
    { id: 'parterre-so', nom: 'le parterre sud-ouest', x: -18, z: 15 },
    { id: 'parterre-se', nom: 'le parterre sud-est', x: 18, z: 15 },
    { id: 'cour-batut', nom: 'la cour du Batut', x: -31, z: 0 },
    { id: 'cour-beauregard', nom: 'la cour de Beauregard', x: 31, z: 0 },
  ],
};

const level = {
  name: 'batut', echelle: 0.6, musique: 'campagne', getH: () => 0, zoneName,
  build, populate, animate, minimap, arenes: [ARENE_BATUT],
  counts: () => '<small>Le Batut et Beauregard — deux maisons, un jardin entre les deux.</small>',
  start: () => showMessage('Le Batut à l’ouest, Beauregard à l’est. Le jardin entre les deux.', 5),
  arriveMessage: () => 'Le Batut et Beauregard.',
  entry: () => ({ title: 'Le Batut et Beauregard', sub: 'Deux maisons, un jardin', cam: [0, 40, 85], at: [0, 0, 0], cam2: [0, 5, 18], at2: [0, 1.5, 0], dur: 4 }),
  onKill: () => {},
};
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
