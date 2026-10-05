// The Legend of Camille — le Batut et Beauregard : l'arène des deux maisons (multi, 5 octobre)
// =====================================================================
// Eugène : « c'est surtout le gameplay inside house que j'aime, pas mal pour se cacher ». Une
// arène à part, bâtie comme l'estaminet (un niveau à elle, un fichier à elle), d'après les
// grandes maisons des Roquette d'aveyron.js — la pierre du Ségala, les tuiles canal, la tour
// ronde, les volets fermés au soleil au Batut — mais sans en dépendre : ici, on entre.
//
// Un domaine clos de mur : à l'ouest le Batut, à l'est Beauregard, entre les deux un jardin
// (l'allée, le bassin à sec, quatre parterres de buis, les tilleuls). Les deux maisons sont
// la même maison en miroir — une arène d'équipes se veut juste. Chacune a sept pièces au
// rez-de-chaussée et six issues : on y entre par la porte, la porte-fenêtre du salon, les
// deux portes de la galerie, la cuisine ; on s'y cache derrière les rayonnages de la
// bibliothèque, l'armoire de la chambre, la grande table de la cuisine.
//
// En mètres (1 unité = 1 m), Camille à l'échelle 0,6 (1,80 m). Origine au bassin, x est, z sud.
// Une maison : `u` la profondeur depuis la façade sur jardin (0) jusqu'au mur du fond (20), `v`
// le long de la façade (−12 à 12) ; x = s·(36 + u), z = v, s = −1 au Batut, +1 à Beauregard.
// =====================================================================
import * as PNJ_E from './engine.js?v=41';
import * as PNJ from './pnj.js';
import { especeGeo } from './foret.js';
import { THREE, TAU, scene, G, PH, phMat, boxG, hemi, sun, renderer, bloom, addCap, addBox,
  showMessage, bootLevel, minimapDots, makeSky, player } from './engine.js?v=41';

// Les pierres de l'Aveyron ne sont pas au registre du moteur : chaque lieu inscrit les siennes
// (cf. aveyron.js, mêmes tailles réelles). Sans elles, phMat retombait sur un gris uni — la
// façade blanche des premiers rendus. La laine bouclée (lit, dos des livres) n'y était pas non plus.
Object.assign(PH, {
  stone_wall:         { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a958a },
  granite_tile_03:    { tuile: 1.8, maps: ['couleur', 'normale'], repli: 0x8a8580 },
  mud_cracked_dry_03: { tuile: 4.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0xb89a74 },
  wool_boucle:        { tuile: 0.6, maps: ['couleur', 'normale', 'rugosite'], repli: 0xc8bca8 },
});

const FACADE = 36, PROF = 20, DEMI = 12;      // la maison : façade à 36 m du bassin, 20 m de fond, 24 m de long
const H = 3.4, HF = 7.2, TOIT = 2.6;          // le plafond du rez-de-chaussée, la corniche, le faîtage au-dessus
const CLOS = { x: 62, z: 34 };                // le mur du domaine (demi-tailles)
const MAISONS = {
  batut: { s: -1, nom: 'le Batut', volets: 0xb4c8d6, fermes: true, pierre: 0x857d6e },
  beauregard: { s: 1, nom: 'Beauregard', volets: 0x7f9a6c, fermes: false, pierre: 0x8e8470 },
};
const MURS = [];                              // pour la minicarte : les murs pleins, en plan
const HAIES = [];                             // idem, les buis
const PIECES = [];                            // pour le nom de la zone : { nom, x0, x1, z0, z1 }

// une boîte aux six faces texturées à leur taille réelle (cf. aveyron.js)
function boite(w, h, d, slug, opt = {}) {
  const f = (u, v) => phMat(slug, u, v, opt);
  return new THREE.Mesh(boxG(w, h, d), [f(d, h), f(d, h), f(w, d), f(w, d), f(w, h), f(w, h)]);
}
function poser(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; scene.add(o); return o; }
// un meuble : la boîte, et sa collision jusqu'à sa hauteur (on saute sur un banc, pas sur une armoire)
function meuble(x, z, w, d, h, slug, couleur, y0 = 0) {
  poser(boite(w, h, d, slug, { color: couleur }), x, y0 + h / 2, z);
  addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y0 + h);
}

// Un mur droit de (ax, az) à (bx, bz), percé de portes : { t (le milieu, en mètres depuis a),
// w, h }. Le linteau au-dessus d'une porte n'arrête personne.
function mur(ax, az, bx, bz, { ep = 0.25, h = H, slug = 'chaux_craquelee', couleur = 0xeee6d6, portes = [] } = {}) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, ry = -Math.atan2(bz - az, bx - ax);
  const plein = (a, b, y0, y1, dur) => {
    if (b - a < 0.02) return;
    const m = boite(b - a, y1 - y0, ep, slug, { color: couleur });
    poser(m, ax + ux * (a + b) / 2, (y0 + y1) / 2, az + uz * (a + b) / 2, ry);
    if (dur) { addCap(ax + ux * a, az + uz * a, ax + ux * b, az + uz * b, ep / 2 + 0.05, y1); MURS.push([ax + ux * a, az + uz * a, ax + ux * b, az + uz * b]); }
  };
  let t0 = 0;
  for (const p of [...portes].sort((a, b) => a.t - b.t)) {
    const a = p.t - p.w / 2, b = p.t + p.w / 2;
    plein(t0, a, 0, h, true); plein(a, b, p.h || 2.3, h, false); t0 = b;
  }
  plein(t0, L, 0, h, true);
}

// ---------------------------------------------------------------------
//  Une maison
// ---------------------------------------------------------------------
function maison(cle) {
  const M = MAISONS[cle], s = M.s, X = (u) => s * (FACADE + u);
  // un mur en coordonnées de maison ; les portes au point `p` du côté qui varie (u ou v)
  const murM = (u1, v1, u2, v2, opt = {}, portes = []) => mur(X(u1), v1, X(u2), v2, { ...opt,
    portes: portes.map(([p, w, h]) => ({ t: Math.abs(p - (u1 === u2 ? v1 : u1)), w, h })) });
  const exterieur = { ep: 0.6, h: HF, slug: 'stone_wall', couleur: M.pierre };
  const piece = (nom, u0, u1, v0, v1, sol, teinte) => {
    const x0 = Math.min(X(u0), X(u1)), x1 = Math.max(X(u0), X(u1));
    PIECES.push({ nom: `${M.nom.charAt(0).toUpperCase() + M.nom.slice(1)} — ${nom}`, x0, x1, z0: v0, z1: v1 });
    poser(boite(x1 - x0, 0.06, v1 - v0, sol, { color: teinte }), (x0 + x1) / 2, 0.03, (v0 + v1) / 2).castShadow = false;
  };

  // ---- les pièces : leurs sols ----
  piece('le vestibule', 0, 6, -3, 3, 'worn_tile_floor', 0xd8d0c4);
  piece('le grand salon', 0, 6, 3, DEMI, 'wood_planks', 0xb08a62);
  piece('la salle à manger', 0, 6, -DEMI, -3, 'worn_tile_floor', 0xc8b8a4);
  piece('la galerie', 6, 9, -DEMI, DEMI, 'wood_planks', 0x9a7a58);
  piece('la bibliothèque', 9, PROF, 4, DEMI, 'wood_planks', 0x8a6a4a);
  piece('la cuisine', 9, PROF, -4, 4, 'worn_tile_floor', 0xbcae9a);
  piece('la chambre', 9, PROF, -DEMI, -4, 'wood_planks', 0xa88660);

  // ---- les murs extérieurs : pierre, deux étages vus du dehors ----
  murM(0, -DEMI, 0, DEMI, exterieur, [[0, 1.8, 2.6], [8, 1.4, 2.5]]);              // la façade : la porte, la porte-fenêtre du salon
  murM(PROF, -DEMI, PROF, DEMI, exterieur, [[-1.5, 1.2, 2.3]]);                     // le fond : la porte de la cuisine
  murM(0, DEMI, PROF, DEMI, exterieur, [[7.5, 1.4, 2.4]]);                           // les deux bouts de la galerie
  murM(0, -DEMI, PROF, -DEMI, exterieur, [[7.5, 1.4, 2.4]]);
  // ---- les cloisons ----
  murM(6, -DEMI, 6, DEMI, {}, [[-7.5, 1.2], [0, 1.6], [7.5, 1.2]]);                 // devant / galerie
  murM(9, -DEMI, 9, DEMI, {}, [[8, 1.2], [0, 1.4], [-8, 1.2]]);                     // galerie / fond
  murM(0, 3, 6, 3, {}, [[3, 1.2]]);                                                  // vestibule / salon
  murM(0, -3, 6, -3, {}, [[3, 1.2]]);                                                // vestibule / salle à manger
  murM(9, 4, PROF, 4, {}, [[16, 1.1]]);                                              // bibliothèque / cuisine
  murM(9, -4, PROF, -4, {}, [[16, 1.1]]);                                            // cuisine / chambre

  // ---- le plafond (poutres), la toiture ----
  const x0 = Math.min(X(0), X(PROF)), x1 = Math.max(X(0), X(PROF)), xc = (x0 + x1) / 2;
  poser(boite(PROF, 0.2, 2 * DEMI, 'wood_planks', { color: 0x6a4e34 }), xc, H + 0.1, 0).castShadow = false;
  for (let v = -DEMI + 2; v < DEMI; v += 2.4) poser(boite(PROF, 0.28, 0.24, 'wood_cabinet_worn_long', { color: 0x4a3420 }), xc, H - 0.14, v);
  poser(boite(PROF - 0.2, HF - H - 0.2, 2 * DEMI - 0.2, 'stone_wall', { color: M.pierre }), xc, (H + HF) / 2 + 0.1, 0);   // l'étage, plein (on n'y monte pas)
  { // deux pans de tuiles canal, faîtage le long de la façade (v)
    const o = 0.7, la = PROF / 2 + o, lb = DEMI + o, P = [], UV = [];
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
    poser(boite(1.2, 2.2, 0.9, 'stone_wall', { color: 0x9a9284 }), X(PROF - 5), HF + TOIT, DEMI - 4);   // la souche de cheminée
  }
  // ---- la tour ronde à l'angle de la façade, côté salon ----
  { const tx = X(-1.2), tz = DEMI + 1.2, tr = 2.6;
    poser(new THREE.Mesh(new THREE.CylinderGeometry(tr, tr + 0.15, HF + 3, 24), phMat('stone_wall', TAU * tr, HF + 3, { color: M.pierre })), tx, (HF + 3) / 2, tz);
    poser(new THREE.Mesh(new THREE.ConeGeometry(tr + 0.5, 3, 24, 1, true), phMat('clay_roof_tiles_02', TAU * tr / 2, 3.3, { color: 0xd8bca8, side: THREE.DoubleSide })), tx, HF + 4.5, tz);
    addCap(tx, tz, tx, tz, tr + 0.1, HF + 3); MURS.push([tx - tr, tz, tx + tr, tz]); }

  // ---- les baies : granit, vitre, croisée, volets ; dedans, le jour qui entre ----
  const vitre = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.18, metalness: 0.35 });
  const jour = new THREE.MeshBasicMaterial({ color: 0xd6e6f2 });
  const bois = phMat('wood_planks', 0.6, 1.5, { color: M.volets });
  // face : 'facade' | 'fond' | 'nord' | 'sud' ; p : la position le long du mur (v ou u)
  function baie(face, p, y, dedans = true, w = 1.0, h = 1.5) {
    const [u, v, nx, nz] = face === 'facade' ? [0, p, -s, 0] : face === 'fond' ? [PROF, p, s, 0] : face === 'nord' ? [p, -DEMI, 0, -1] : [p, DEMI, 0, 1];
    const ry = Math.atan2(nx, nz), f = new THREE.Group();
    f.position.set(X(u) + nx * 0.31, y, v + nz * 0.31); f.rotation.y = ry; scene.add(f);
    const gr = (a, b, x, yy) => { const m = boite(a, b, 0.2, 'granite_tile_03', { color: 0xbab4a8 }); m.position.set(x, yy, 0.05); f.add(m); };
    gr(w + 0.5, 0.26, 0, h / 2 + 0.13); gr(w + 0.6, 0.16, 0, -h / 2 - 0.08); gr(0.22, h, -w / 2 - 0.11, 0); gr(0.22, h, w / 2 + 0.11, 0);
    const vt = new THREE.Mesh(boxG(w, h, 0.05), vitre); f.add(vt);
    if (M.fermes || !dedans) { for (const sx of [-1, 1]) { const m = new THREE.Mesh(boxG(w / 2 - 0.02, h, 0.05), bois); m.position.set(sx * w / 4, 0, 0.08); f.add(m); } }
    else for (const sx of [-1, 1]) { const m = new THREE.Mesh(boxG(w / 2, h, 0.05), bois); m.position.set(sx * (w * 0.75 + 0.24), 0, 0.12); f.add(m); }
    if (dedans) { const j = new THREE.Mesh(boxG(w, h, 0.02), jour); j.position.set(X(u) - nx * 0.32, y, v - nz * 0.32); j.rotation.y = ry; scene.add(j); }
  }
  for (const v of [-9.5, -5.5, 5.2, 10.6]) baie('facade', v, 1.55);
  for (const v of [-9.5, -5.5, 0, 5.2, 10.6]) baie('facade', v, 5.2, false);
  for (const v of [8, -8, -3.3]) baie('fond', v, 1.55);              // pas derrière la cheminée de la cuisine (v 1 à 3,8)
  for (const v of [-8, 0, 8]) baie('fond', v, 5.2, false);
  // u = 5 : la cheminée du salon et le buffet de la salle à manger sont à u 1,7 à 4,3
  for (const f of ['nord', 'sud']) { baie(f, 5, 1.55); baie(f, 14.5, 1.55); baie(f, 7.5, 5.2, false); baie(f, 14.5, 5.2, false); }

  // ---- les portes : de lourds vantaux ouverts contre le mur (on passe) ----
  const chene = phMat('wood_cabinet_worn_long', 1, 2.4, { color: 0x5a3e26 });
  const vantail = (x, z, ry) => { const m = new THREE.Mesh(boxG(0.9, 2.3, 0.08), chene); poser(m, x, 1.15, z, ry); };
  vantail(X(0.55), 1.4, Math.PI / 2); vantail(X(0.55), -1.4, Math.PI / 2);

  // ---- le mobilier : de quoi se cacher ----
  const BOIS = 'wood_cabinet_worn_long', SOMBRE = 0x5a4030, CLAIR = 0x8a6a48;
  const mx = (u) => X(u);                                // le milieu d'un meuble en x
  // le vestibule : un banc, un coffre
  meuble(mx(1.2), -2.3, 1.6, 0.5, 0.5, BOIS, CLAIR); meuble(mx(4.8), 2.3, 1.2, 0.6, 0.8, BOIS, SOMBRE);
  // le grand salon : la cheminée sur le pignon, deux canapés, une table basse, un fauteuil
  { const fx = mx(3), fz = DEMI - 0.5;
    poser(boite(2.4, 1.6, 0.7, 'granite_tile_03', { color: 0xbab4a8 }), fx, 0.8, fz); addBox(fx - 1.2, fx + 1.2, fz - 0.35, fz + 0.35, 1.6);
    poser(new THREE.Mesh(boxG(1.4, 0.8, 0.1), new THREE.MeshBasicMaterial({ color: 0xff8a3a })), fx, 0.5, fz - 0.36);
    poser(boite(2.8, 1.6, 0.5, 'stone_wall', { color: 0xa09888 }), fx, 2.4, fz + 0.05); }
  meuble(mx(1.6), 8.6, 0.9, 2.4, 0.85, 'fabric_pattern_07', 0x8a4a3a); meuble(mx(4.6), 8.6, 0.9, 2.4, 0.85, 'fabric_pattern_07', 0x8a4a3a);
  meuble(mx(3.1), 8.6, 1.0, 1.4, 0.45, BOIS, SOMBRE); meuble(mx(1.2), 4.4, 0.9, 0.9, 0.95, 'fabric_pattern_07', 0x6a5a3a);
  // la salle à manger : la longue table, le buffet contre le pignon, une desserte
  meuble(mx(3), -7.5, 1.1, 4.2, 0.78, BOIS, SOMBRE); meuble(mx(3), -DEMI + 0.45, 2.6, 0.6, 1.1, BOIS, SOMBRE);
  meuble(mx(5.4), -4.2, 0.6, 1.4, 0.9, BOIS, CLAIR);
  // la galerie : deux coffres, une horloge
  meuble(mx(7.5), -4.5, 1.0, 0.6, 0.6, BOIS, SOMBRE); meuble(mx(7.5), 4.5, 1.0, 0.6, 0.6, BOIS, SOMBRE); meuble(mx(8.6), -10.8, 0.5, 0.5, 2.1, BOIS, SOMBRE);
  // la bibliothèque : trois rayonnages en épis (2,2 m : on ne voit pas par-dessus), une table de lecture
  const livres = [0x6a2a24, 0x2a4a3a, 0x3a3a5a, 0x7a5a2a, 0x4a2a3a];
  for (const [k, v] of [[0, 6.2], [1, 8.4], [2, 10.6]]) {
    const ua = 11.2, ub = 17.2, x = (mx(ua) + mx(ub)) / 2, w = ub - ua;
    meuble(x, v, w, 0.45, 2.2, 'wood_planks', 0x4a3424);
    for (let r = 0; r < 4; r++) for (const sd of [-1, 1]) poser(boite(w - 0.3, 0.32, 0.06, 'wool_boucle', { color: livres[(k + r) % 5] }), x, 0.35 + r * 0.5, v + sd * 0.24).castShadow = false;
  }
  meuble(mx(18.5), 6, 1.0, 1.8, 0.78, BOIS, SOMBRE);
  // la cuisine : la grande cheminée du fond, la table, le vaisselier, des tonneaux
  { const fx = mx(PROF - 0.5), fz = 2.4;
    poser(boite(0.8, 2.0, 2.8, 'stone_wall', { color: 0x9a9284 }), fx, 1.0, fz); addBox(Math.min(fx, mx(PROF - 0.9)) - 0.4, Math.max(fx, mx(PROF - 0.9)) + 0.4, fz - 1.4, fz + 1.4, 2.0);
    poser(new THREE.Mesh(boxG(0.1, 1.0, 1.6), new THREE.MeshBasicMaterial({ color: 0xff7a2a })), mx(PROF - 0.92), 0.6, fz); }
  meuble(mx(14), 0, 2.6, 1.2, 0.8, BOIS, CLAIR); meuble(mx(10), -3.4, 2.2, 0.55, 1.9, BOIS, SOMBRE);
  for (const [u, v] of [[18.8, -3.1], [18.0, -3.3]]) { poser(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), phMat('wood_planks', 2.6, 1, { color: 0x6a4a2a })), mx(u), 0.5, v); addCap(mx(u), v, mx(u), v, 0.45, 1.0); }
  // la chambre : le lit, l'armoire (2,3 m), le coffre au pied du lit, un bureau
  meuble(mx(17.6), -9.2, 2.2, 1.8, 0.6, 'wool_boucle', 0xc8bca8); meuble(mx(18.9), -9.2, 0.2, 1.8, 1.3, BOIS, SOMBRE);
  meuble(mx(12), -DEMI + 0.4, 1.8, 0.65, 2.3, BOIS, SOMBRE); meuble(mx(15.7), -9.2, 0.6, 1.4, 0.55, BOIS, CLAIR);
  meuble(mx(12.5), -4.6, 1.4, 0.7, 0.78, BOIS, CLAIR);

  // ---- dehors, contre la maison : un tas de bois, des tonneaux, une charrette dans la cour ----
  meuble(X(PROF + 2), DEMI + 3, 1.2, 4, 1.4, 'wood_planks', 0x7a5a3a);
  meuble(X(-6), -7, 1.6, 3.2, 1.1, 'wood_planks', 0x6a4a2a);
  for (const v of [6, 7.2]) { poser(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), phMat('wood_planks', 2.6, 1, { color: 0x6a4a2a })), X(-1.5), 0.5, v); addCap(X(-1.5), v, X(-1.5), v, 0.45, 1.0); }
  // la cour de terre battue devant la façade
  poser(boite(8, 0.04, 2 * DEMI + 4, 'terre_battue', { color: 0xb09878 }), X(-4), 0.02, 0).castShadow = false;
}

// ---------------------------------------------------------------------
//  Le jardin et le mur du domaine
// ---------------------------------------------------------------------
function jardin() {
  // le pré tout autour, et le domaine
  poser(new THREE.Mesh(new THREE.BoxGeometry(400, 0.1, 400), phMat('withered_grass', 400, 400, { color: 0xa8a87a })), 0, -0.06, 0).castShadow = false;
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
    const xa = sx * 9, xb = sx * 27, za = sz * 6, zb = sz * 22, xm = (xa + xb) / 2, zm = (za + zb) / 2, o = 1.4;
    buis(xa, za, xm - sx * o, za); buis(xm + sx * o, za, xb, za); buis(xa, zb, xm - sx * o, zb); buis(xm + sx * o, zb, xb, zb);
    buis(xa, za, xa, zm - sz * o); buis(xa, zm + sz * o, xa, zb); buis(xb, za, xb, zm - sz * o); buis(xb, zm + sz * o, xb, zb);
    // au milieu de chaque parterre, une topiaire (un bon pilier pour tourner autour)
    poser(new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), phMat('forest_leaves_04', 4, 4, { color: 0x3e5e32 })), xm, 1.3, zm);
    addCap(xm, zm, xm, zm, 1.2, 2.6);
  }
  // deux rangs d'arbres le long du mur du domaine : les hêtres de la forêt du jeu (foret.js)
  { const esp = especeGeo('hetre'), places = [];
    for (const sz of [-1, 1]) for (let x = -30; x <= 30; x += 10) places.push([x + (Math.random() - 0.5) * 1.5, sz * 28.5]);
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
  scene.fog = new THREE.Fog(0xd8d4c4, 120, 900);
  hemi.intensity = 0.75; hemi.color.setHex(0xfff2dc); hemi.groundColor.setHex(0x5a4a36);
  sun.intensity = 2.6; sun.color.setHex(0xfff0d8); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 400 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.15;
  jardin();
  maison('batut'); maison('beauregard');
}
// dedans, la caméra reste sous le plafond et se rapproche ; dehors, elle reprend du champ
const dansMaison = (x, z) => Math.abs(z) < DEMI && Math.abs(x) > FACADE && Math.abs(x) < FACADE + PROF;
function animate() {
  const p = player.pos, dedans = dansMaison(p.x, p.z);
  G.camMaxY = dedans ? H - 0.3 : Infinity;
  G.camBack = dedans ? 4.2 : 7; G.camUp = dedans ? 2.2 : 3.4;
}
function populate() { player.pos.set(0, 0, 9); player.yaw = Math.PI; G.camYaw = Math.PI; }
function zoneName(x, z) {
  for (const r of PIECES) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r.nom;
  return 'Le jardin';
}
// la minicarte : tout le domaine d'un coup d'œil, les murs, les buis, les joueurs
function minimap(g, W2) {
  const sc = (W2 - 10) / (2 * CLOS.x), P = (x, z) => [W2 / 2 + x * sc, W2 / 2 + z * sc];
  g.fillStyle = '#8a9a5e'; g.fillRect(0, 0, W2, W2);
  g.fillStyle = '#b8ab90';
  for (const s of [-1, 1]) { const [a, b] = P(s < 0 ? -FACADE - PROF : FACADE, -DEMI); g.fillRect(a, b, PROF * sc, 2 * DEMI * sc); }
  g.lineCap = 'round';
  g.strokeStyle = '#3e5a30'; g.lineWidth = Math.max(2, 0.8 * sc);
  for (const [ax, az, bx, bz] of HAIES) { const [a, b] = P(ax, az), [c, d] = P(bx, bz); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  g.strokeStyle = '#3a2e24'; g.lineWidth = Math.max(1.5, 0.35 * sc);
  for (const [ax, az, bx, bz] of MURS) { const [a, b] = P(ax, az), [c, d] = P(bx, bz); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  minimapDots(g, P);
}

// L'ARÈNE (cf. ARENE_LILLE dans game.js, docs/NOTE-MULTI.md) : tout le domaine, puis le jardin
// seul — en fin de manche, il faut sortir des maisons. Mesurée au rectangle du mur du domaine.
function sdRect(x, z, hx, hz) { const dx = Math.abs(x) - hx, dz = Math.abs(z) - hz; return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0); }
const ARENE_BATUT = {
  id: 'batut', nom: 'Le Batut et Beauregard',
  sd: (x, z) => sdRect(x, z, CLOS.x - 2, CLOS.z - 2), centre: [0, 0],
  depart: { x: 0, z: 9 },
  aires: [
    { id: 'domaine', nom: 'le domaine', r: 0, couleur: '#ffd070', lueur: 0xffc860, eparpille: 30 },
    // −24 : le rectangle de 36 × 8 m entre les deux façades (l'allée, le bassin)
    { id: 'jardin', nom: 'le jardin', r: -24, couleur: '#ff9a70', lueur: 0xff6a3a, eparpille: 14 },
  ],
  camps: {
    garnison: { nom: 'Le Batut', court: 'Batut', pluriel: false },
    bourg: { nom: 'Beauregard', court: 'Beauregard', pluriel: false },
  },
  campsTexte: 'Le Batut contre Beauregard : chacun tient sa maison, et le jardin est entre les deux.',
  // chacun arrive dans son vestibule
  departsCamps: { garnison: [-(FACADE + 3), 0], bourg: [FACADE + 3, 0] },
  dispersion: 2.5,                       // on reste dans son vestibule (6 × 6 m)
  pointsForts: () => [
    { id: 'bassin', nom: 'le bassin', x: 0, z: 0 },
    { id: 'parterre-no', nom: 'le parterre nord-ouest', x: -18, z: -14 },
    { id: 'parterre-ne', nom: 'le parterre nord-est', x: 18, z: -14 },
    { id: 'parterre-so', nom: 'le parterre sud-ouest', x: -18, z: 14 },
    { id: 'parterre-se', nom: 'le parterre sud-est', x: 18, z: 14 },
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
  entry: () => ({ title: 'Le Batut et Beauregard', sub: 'Deux maisons, un jardin', cam: [0, 34, 70], at: [0, 0, 0], cam2: [0, 5, 18], at2: [0, 1.5, 0], dur: 4 }),
  onKill: () => {},
};
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
