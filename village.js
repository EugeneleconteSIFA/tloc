// village.js — le bourg flamand.
//
// Secteur Village : maisons à pignons à redents, enceinte et Porte des Flandres,
// estaminet, place et marché, abords maraîchers, faubourg.
import * as A from './assets.js';
import * as E from './engine.js?v=27';
import { mouldingProfile,
  THREE, G, GOLD, IRON, SFX, T, TAU, addBox, addCap, addInteract, addLieu, archWindow, balcony,
  boxG, brickScaled, burst, corniceAround, dialogue, distSeg, dormer, enemies, fbm, goToLevel,
  keys, lerp, makeCanvas, mat, mergeParts, mesh, normalMapFrom, oriel, pbr, pbrRepeat, phMat,
  pilaster, player, questStep, rand, rboxG, scene, setQuest, sphG, state, stoneMat, uvMeters,
  wallBox, world,
} from './engine.js?v=27';
import {
  COBBLE_M, TOWN, TOWN_BOITE, calerBourg, cobbles, lisse, normale, patinerMat, townWorld,
} from './carte.js';
import * as ATLAS from './atlas.js';
import {
  DOOR_COLORS, FERN, VITRE_CHAUDE, makeDoor, makeParavent, makeToile, makeVolet,
} from './menuiserie.js';
import { PARTAGE } from './etat.js';
import * as PNJ from './pnj.js';
import * as BOURSE from './bourse.js';

// La faux d'Émile : le premier achat qui rapporte. Il la propose à la fin de chaque
// conversation tant qu'on ne l'a pas — et seulement quand on a de quoi compter.
function offrirFaux() {
  if (state.faux || !BOURSE.aBourse()) return;
  BOURSE.boutique('La faux d’Émile', 'Le meunier',
    '« Tu fauches à l’épée ? Tu vas t’user le poignet. Prends ma vieille faux : elle coupe un mètre plus loin et plus large, et une meule te donne une brassée de plus à chaque coup. »',
    [{ label: 'La faux d’Émile', prix: 60, dispo: () => !state.faux, indispo: 'elle est à toi',
      acheter: () => { state.faux = true; E.showMessage('La faux d’Émile : tu fauches plus large, et les meules donnent davantage. (Poche : I)', 5); } }]);
}
import { PROPS_OK, makeVillager } from './banque.js';

export function makeFlemishHouse(w, d, floors, tint, opts = {}) {
  const g = new THREE.Group();
  const h = floors * 3.3;
  // la teinte de la maison est éclaircie : elle multiplie une photo, pas un aplat
  const tintClair = new THREE.Color(tint).lerp(new THREE.Color(0xffffff), 0.55).getHex();
  const MS = TOWN.s;   // échelle du groupe village : les tailles de matériau se comptent en mètres MONDE
  const bodyMat = patinerMat(phMat('stacked_brick_wall', w * MS, h * MS, { color: tintClair }), { echelle: 11, force: 0.20, humide: 1.6, pluie: 0.16 });
  const stone = pbr(T.stone, { roughness: 0.85, color: 0xd8d0c0 }), frameM = mat(0xf4efe4, { roughness: 0.8 }), glass = mat(0x8fb0d0, { roughness: 0.15, metalness: 0.2 });
  const shutterM = mat(opts.shutter || 0x3a6a4a, { roughness: 0.9 });
  // corps aux arêtes arrondies, soubassement mouluré, bandeaux entre étages, corniche en doucine
  const body = new THREE.Mesh(rboxG(w, h, d, 0.16, 3), bodyMat); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  g.add(mesh(rboxG(w + 0.24, 0.7, d + 0.24, 0.08, 2), stone, 0, 0.35, 0));
  corniceAround(g, 0, 0.7, 0, w / 2 + 0.12, d / 2 + 0.12, stone, 0.18, 0.14, 'ovolo');
  for (let f = 1; f < floors; f++) corniceAround(g, 0, f * 3.3 - 0.1, 0, w / 2, d / 2, stone, 0.16, 0.14, 'fillet');
  corniceAround(g, 0, h - 0.4, 0, w / 2, d / 2, stone, 0.42, 0.34, 'cyma');
  // pilastres aux angles de la façade
  for (const sx of [-1, 1]) { const pl = pilaster(h - 0.4, 0.22, stone, stone); pl.position.set(sx * (w / 2 - 0.1), 0.7, d / 2 + 0.12); g.add(pl); }
  // toit : deux pans, faîtière arrondie, lucarnes ; pignons à redents avec chaperons arrondis et fleuron
  const roofH = w * 0.55;
  const tri = new THREE.Shape(); tri.moveTo(-w / 2 - 0.3, 0); tri.lineTo(w / 2 + 0.3, 0); tri.lineTo(0, roofH); tri.closePath();
  const roofM = pbrRepeat(T.plank, 2, 2, { color: opts.roof || 0x6a4a3a, roughness: 0.9 });
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: d + 0.6, bevelEnabled: false }), roofM); roof.position.set(0, h, -d / 2 - 0.3); roof.castShadow = true; g.add(roof);
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, d + 0.7, 8), mat(0x4a3a30), 0, h + roofH, 0).rotateX(Math.PI / 2));
  const nd = w > 6 ? 2 : 1; for (let k = 0; k < nd; k++) { const dm = dormer(1.3, 1.3, stone, roofM, glass); const x = (k - (nd - 1) / 2) * 2.2, t = 0.45; dm.position.set(x, h + roofH * t - 0.2, (1 - t) * (w / 2 + 0.3) * (d + 0.6) / (w + 0.6) * 0 + (d / 2 + 0.3) * (1 - t) - 0.4); dm.position.z = (d / 2 + 0.3) * (1 - t) - 0.5; g.add(dm); }
  const stepMat = phMat('stacked_brick_wall', (w + 0.4) * MS, (roofH / 5 + 0.15) * MS, { color: tintClair });
  for (const side of [1, -1]) {
    const steps = 5;
    for (let k = 0; k < steps; k++) { const t = k / steps, sw = (w + 0.4) * (1 - t);
      g.add(mesh(rboxG(sw, roofH / steps + 0.15, 0.5, 0.05, 2), stepMat, 0, h + t * roofH + roofH / steps / 2, side * (d / 2 + 0.05)));
      g.add(mesh(rboxG(sw + 0.24, 0.14, 0.62, 0.05, 2), stone, 0, h + (t + 1 / steps) * roofH + 0.1, side * (d / 2 + 0.05))); }
    g.add(mesh(sphG(0.22, 10), stone, 0, h + roofH + 0.3, side * (d / 2 + 0.05)));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6), stone, 0, h + roofH + 0.05, side * (d / 2 + 0.05)));
  }
  // fenêtres : rez-de-chaussée en arc, étages rectangulaires à appui mouluré et linteau
  // Fenêtre : embrasure creusée, dormant, deux ouvrants à six carreaux, appui mouluré à
  // larmier, linteau à clé, et deux volets persiennés PENDUS À LEURS GONDS — ouverts ou
  // fermés selon un tirage déterministe, pour que la façade ne soit pas un damier régulier.
  const shutCol = opts.shutter || 0x3a6a4a;
  let winSeed = (Math.round(w * 37) + Math.round(d * 17) + floors * 101) | 1;
  const alea = () => ((winSeed = (winSeed * 1103515 + 12345) & 0x7fffffff) % 1000) / 1000;
  const rectWin = (x, y, z, rot = 0) => {
    const wg = new THREE.Group(); wg.position.set(x, y, z); wg.rotation.y = rot;
    const WW = 1.12, WH = 1.5, r1 = alea(), r2 = alea(), r3 = alea();
    for (const sx of [-1, 1]) wg.add(mesh(boxG(0.16, WH + 0.12, 0.2), stone, sx * (WW / 2 + 0.08), 0, -0.09));   // tableaux
    wg.add(mesh(boxG(WW + 0.32, 0.14, 0.2), stone, 0, WH / 2 + 0.07, -0.09));                                    // voussure
    for (const sx of [-1, 1]) wg.add(mesh(boxG(0.1, WH, 0.15), frameM, sx * (WW / 2 - 0.05), 0, 0));             // dormant
    for (const sy of [-1, 1]) wg.add(mesh(boxG(WW, 0.1, 0.15), frameM, 0, sy * (WH / 2 - 0.05), 0));
    const vitre = r3 < 0.22 || opts.chaud ? VITRE_CHAUDE() : glass;
    for (const sx of [-1, 1]) {                                                                                   // deux ouvrants
      const cw = WW / 2 - 0.1, cx = sx * (WW / 4 + 0.01);
      wg.add(mesh(boxG(cw, WH - 0.2, 0.05), vitre, cx, 0, -0.02));
      wg.add(mesh(boxG(cw + 0.08, 0.07, 0.08), frameM, cx, 0, 0.02));                                            // petit bois
      wg.add(mesh(boxG(0.06, WH - 0.2, 0.08), frameM, cx, 0, 0.02));
      wg.add(mesh(boxG(0.08, WH - 0.16, 0.1), frameM, sx * 0.02, 0, 0.02));                                      // battement
    }
    wg.add(mesh(new THREE.ExtrudeGeometry(mouldingProfile('cyma', 0.14, 0.18), { depth: WW + 0.55, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -(WW + 0.55) / 2).rotateY(-Math.PI / 2), stone, 0, -0.88, 0.04));
    wg.add(mesh(boxG(WW + 0.5, 0.07, 0.26), stone, 0, -0.99, 0.1));                                              // larmier de l'appui
    wg.add(mesh(rboxG(WW + 0.42, 0.22, 0.3, 0.05, 2), stone, 0, 0.9, 0.07));                                     // linteau
    wg.add(mesh(rboxG(0.26, 0.36, 0.34, 0.05, 2), stone, 0, 0.95, 0.09));                                        // clé
    const vg = makeVolet(WW / 2 + 0.07, WH + 0.14, shutCol, 1); vg.position.set(-WW / 2 - 0.07, 0, 0.1);
    vg.rotation.y = r1 < 0.6 ? Math.PI * 0.93 : 0; wg.add(vg);
    const vd = makeVolet(WW / 2 + 0.07, WH + 0.14, shutCol, -1); vd.position.set(WW / 2 + 0.07, 0, 0.1);
    vd.rotation.y = r2 < 0.6 ? -Math.PI * 0.93 : 0; wg.add(vd);
    if (r3 > 0.72) {                                                                                             // jardinière
      wg.add(mesh(boxG(WW + 0.1, 0.26, 0.3), pbrRepeat(T.plank, 1, 1, { color: 0x7a5a3a }), 0, -0.78, 0.26));
      for (let k = 0; k < 5; k++) wg.add(mesh(sphG(0.11, 7), mat([0xd8456a, 0xe8a030, 0xf0e0f0, 0xc23a5a][k % 4]), -WW / 2 + 0.18 + k * (WW - 0.16) / 4, -0.6, 0.26));
    }
    g.add(wg);
  };
  const cols = Math.max(1, Math.floor((w - 1.4) / 2.0));
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    const x = (c - (cols - 1) / 2) * 2.0; if (f === 0 && Math.abs(x - (opts.doorX || 0)) < 1.25) continue; // jamais de fenêtre sur la porte
    if (f === 0) { const aw = archWindow(1.1, 1.9, opts.chaud ? VITRE_CHAUDE() : glass, frameM, { shutters: shutterM }); aw.position.set(x, 1.05, d / 2 + 0.06); g.add(aw); }
    else if (f === 1 && opts.oriel && c === cols - 1) { const o = oriel(0.9, 2.2, bodyMat, stone, glass); o.position.set(x, f * 3.3 + 0.9, d / 2); g.add(o); }
    else rectWin(x, f * 3.3 + 2.0, d / 2 + 0.06);
  }
  for (let f = 0; f < floors; f++) { rectWin(-w / 2 - 0.06, f * 3.3 + 2.0, 0, -Math.PI / 2); rectWin(w / 2 + 0.06, f * 3.3 + 2.0, 0, Math.PI / 2); }
  if (opts.balcony && floors > 1) { const bl = balcony(2.6, 0.9, stone, mat(0x2a2a30, { metalness: 0.8, roughness: 0.4 })); bl.position.set(opts.balcony === 'left' ? -w / 4 : 0, 3.3 + 0.1, d / 2 + 0.05); g.add(bl); }
  // porte : vantail à panneaux, imposte vitrée, encadrement à claveaux (cf. makeDoor)
  const dg = makeDoor(1.5, 2.7, {
    color: opts.doorColor !== undefined ? opts.doorColor : DOOR_COLORS[Math.abs(Math.round(w * 3 + d * 5 + floors)) % DOOR_COLORS.length],
    arc: true, pierre: stone, lanterne: !!opts.lanterne, chaud: !!opts.chaud,
  });
  dg.position.set(opts.doorX || 0, 0, d / 2 + 0.05); g.add(dg);
  if (opts.shop) {
    const t = makeToile(w * 0.82, 1.9, opts.awning || 0xc23a3a, 8, 0.24);
    t.position.set(0, 3.05, d / 2 + 0.95); g.add(t);
    for (const sx of [-1, 1]) {                                  // bras de fer et tirants
      g.add(mesh(boxG(0.07, 0.07, 1.9), FERN(), sx * w * 0.4, 2.95, d / 2 + 0.95).rotateX(-0.22));
      g.add(mesh(boxG(0.06, 1.0, 0.06), FERN(), sx * w * 0.4, 3.35, d / 2 + 0.1).rotateX(0.6));
    }
  }
  if (opts.sign) { const sg = mesh(rboxG(1.6, 0.6, 0.08, 0.04, 2), pbrRepeat(T.plank, 1, 1), w / 2 + 0.9, 3.6, d / 2 - 0.5); sg.rotation.y = Math.PI / 2; g.add(sg); g.add(mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 12, Math.PI), IRON(), w / 2 + 0.55, 3.95, d / 2 - 0.5).rotateY(Math.PI / 2)); g.add(mesh(boxG(0.1, 0.5, 0.1), IRON(), w / 2 + 0.05, 3.8, d / 2 - 0.5)); }
  // cheminée à couronnement mouluré et mitrons, gouttières
  const chim = new THREE.Group(); chim.position.set(w * 0.25, h + roofH * 0.5 + 0.8, -d * 0.2);
  chim.add(mesh(rboxG(0.8, 2.2, 0.8, 0.06, 2), brickScaled(0.9 * MS, 2.4 * MS), 0, 0, 0)); corniceAround(chim, 0, 0.95, 0, 0.4, 0.4, stone, 0.16, 0.14, 'cyma');
  for (const sx of [-1, 1]) chim.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 8), mat(0xb08060), sx * 0.2, 1.35, 0)); g.add(chim);
  for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, d + 0.4, 6), IRON(), sx * (w / 2 + 0.28), h + 0.2, 0).rotateX(Math.PI / 2));
  g.userData.size = { w, d, h: h + roofH };
  return g;
}

export function placeHouse(x, z, yaw, w, d, floors, tint, opts) {
  const hgrp = makeFlemishHouse(w, d, floors, tint, opts); hgrp.position.set(x, 0, z); hgrp.rotation.y = yaw; scene.add(hgrp);
  // collision : boîte alignée (on approxime par la boîte englobante tournée de 0/90°)
  const rot = Math.abs(Math.sin(yaw)) > 0.5, hw = rot ? d / 2 : w / 2, hd = rot ? w / 2 : d / 2;
  addBox(x - hw, x + hw, z - hd, z + hd, hgrp.userData.size.h + 2);
  return hgrp;
}
// =====================================================================
//  L'ENCEINTE DU BOURG ET SES ABORDS ONT ÉTÉ DÉPOSÉS (v29)
// =====================================================================
// `buildRamparts` élevait une muraille de brique en polygone irrégulier avec sa Porte
// des Flandres, et `buildAbords` une ceinture maraîchère de vingt-quatre mètres autour.
// Les deux supposaient un village fortifié isolé dans la campagne. La carte fait foi :
// il n'y a jamais eu de bourg là, et ce qui reste du secteur — la place, le marché,
// l'estaminet, le beffroi, la chapelle — est maintenant posé DANS le vrai quartier,
// tourné dans l'axe des rues relevées. Une enceinte à l'intérieur de la ville n'aurait
// plus aucun sens, et la ceinture maraîchère tomberait sur les maisons du voisinage.
// La limite du monde, elle, est désormais l'enceinte urbaine (ENCEINTE, carte.js).

// « town », agrandi ×TOWN.s : une longueur de GÉOMÉTRIE s'écrit en unités locales,
// mais une taille de MATÉRIAU se compte en mètres MONDE. Pour que l'erreur qui a
// déjà sorti une brique une fois et demie trop grosse ne puisse plus revenir, aucun
// appel direct à phMat() ni à brickScaled() ici : tout passe par les fabriques
// ci-dessous, qui reçoivent la taille de la face EN LOCAL et multiplient par MW une
// seule fois, en un seul endroit.

const MW = TOWN.s;
const _MEMPH = new Map();
function phLocal(slug, l, h, extra) {
  const lr = Math.max(0.25, Math.round(l * 4) / 4), hr = Math.max(0.25, Math.round(h * 4) / 4);
  const k = slug + '|' + lr + '|' + hr + '|' + JSON.stringify(extra || 0);
  if (!_MEMPH.has(k)) _MEMPH.set(k, phMat(slug, lr * MW, hr * MW, extra));
  return _MEMPH.get(k);
}
const BOIS   = (l = 1, h = 1, e) => phLocal('wood_planks', l, h, e);
const CHENE  = (l = 1, h = 1, e) => phLocal('wood_cabinet_worn_long', l, h, e);
const PIERV  = (l = 1, h = 1, e) => phLocal('rocks_ground_08', l, h, e);
const ETOFFE = (l = 1, h = 1, e) => phLocal('fabric_pattern_07', l, h, e);
const TUILV  = (l = 1, h = 1, e) => phLocal('clay_roof_tiles_02', l, h, e);
const _MEMBR = new Map();
function BRIQV(l, h, e) {
  const k = l.toFixed(2) + '|' + h.toFixed(2) + '|' + (e && e.color !== undefined ? e.color : '-');
  if (!_MEMBR.has(k)) _MEMBR.set(k, brickScaled(l * MW, h * MW, e));
  return _MEMBR.get(k);
}
const _MEMUNI = new Map();
function UNI(c, o) {
  const k = c + '|' + (o ? JSON.stringify(o) : '-');
  if (!_MEMUNI.has(k)) _MEMUNI.set(k, mat(c, { roughness: 0.9, ...o }));
  return _MEMUNI.get(k);
}
const sombre = (c, f) => new THREE.Color(c).multiplyScalar(f).getHex();
const clair2 = (c, f) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), f).getHex();

// ---------------------------------------------------------------------
//  Petit mobilier réutilisé partout
// ---------------------------------------------------------------------
// Panier d'osier : cône ouvert à deux faces + jonc de bord. Deux meshes, pas dix.
function panier(r, h, col = 0xb0884e) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r * 0.72, h, 12, 1, true), UNI(col, { side: THREE.DoubleSide }), 0, h / 2, 0));
  g.add(mesh(new THREE.TorusGeometry(r, r * 0.1, 6, 14), UNI(sombre(col, 0.8)), 0, h, 0).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, 0.04, 12), UNI(sombre(col, 0.7)), 0, 0.02, 0));
  return g;
}
// Cageot : fond, deux joues et trois lattes par face longue.
function cageot(w, h, d, col = 0x9a7a4e) {
  const parts = [], B = (gw, gh, gd, x, y, z) => parts.push(boxG(gw, gh, gd).translate(x, y, z));
  B(w, 0.05, d, 0, 0.025, 0);
  for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) B(w, h / 4.2, 0.045, 0, 0.08 + k * h / 2.8, sz * d / 2);
  for (const sx of [-1, 1]) B(0.06, h, d, sx * w / 2, h / 2, 0);
  const o = new THREE.Mesh(mergeParts(parts), BOIS(w, h, { color: col }));
  o.castShadow = o.receiveShadow = true; return o;
}
// Sac de toile fermé au col : deux troncs de cône, un bourrelet, une ficelle.
function sac(r, h, col = 0xcbb98c) {
  const g = new THREE.Group(), m = UNI(col, { roughness: 1 });
  g.add(mesh(new THREE.CylinderGeometry(r * 0.88, r, h * 0.62, 10), m, 0, h * 0.31, 0));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.88, h * 0.3, 10), m, 0, h * 0.77, 0));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.42, h * 0.16, 10), m, 0, h * 0.98, 0));
  g.add(mesh(new THREE.TorusGeometry(r * 0.36, 0.025, 5, 10), UNI(0x6a5535), 0, h * 0.9, 0).rotateX(Math.PI / 2));
  return g;
}
// Tonneau : douves galbées (deux troncs de cône dos à dos) et trois cercles de fer.
function tonneau(r, h, col = 0x8a6440) {
  const g = new THREE.Group(), m = CHENE(r * 2, h, { color: col });
  g.add(mesh(new THREE.CylinderGeometry(r * 0.86, r, h / 2, 14), m, 0, h / 4, 0));
  g.add(mesh(new THREE.CylinderGeometry(r, r * 0.86, h / 2, 14), m, 0, h * 0.75, 0));
  for (const y of [h * 0.12, h * 0.5, h * 0.88]) g.add(mesh(new THREE.TorusGeometry(r * 0.97, 0.035, 5, 16), FERN(), 0, y, 0).rotateX(Math.PI / 2));
  return g;
}
// Cruche / pot de grès, tourné au tour (LatheGeometry) : le profil fait tout.
function cruche(h, col = 0x8d6a4a, anse = true) {
  const g = new THREE.Group(), V = (a, b) => new THREE.Vector2(a * h, b * h);
  g.add(mesh(new THREE.LatheGeometry([V(0, 0), V(0.3, 0), V(0.34, 0.08), V(0.4, 0.3), V(0.36, 0.52),
    V(0.24, 0.68), V(0.17, 0.8), V(0.19, 0.93), V(0.23, 1.0), V(0.2, 1.0), V(0.15, 0.92), V(0.13, 0.7), V(0, 0.66)], 12),
    UNI(col, { roughness: 0.55 }), 0, 0, 0));
  if (anse) g.add(mesh(new THREE.TorusGeometry(h * 0.16, h * 0.035, 5, 10, Math.PI * 1.15), UNI(col, { roughness: 0.55 }), h * 0.28, h * 0.8, 0).rotateZ(-0.5));
  return g;
}
// Seau de bois cerclé.
function seau(r = 0.2, h = 0.34) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r * 0.84, h, 12), BOIS(r * 2, h, { color: 0x9a7a52 }), 0, h / 2, 0));
  for (const y of [h * 0.2, h * 0.82]) g.add(mesh(new THREE.TorusGeometry(r * 0.99, 0.02, 5, 12), FERN(), 0, y, 0).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.TorusGeometry(r * 0.92, 0.018, 5, 12, Math.PI), FERN(), 0, h * 1.05, 0));
  return g;
}
// Échelle de meunier appuyée contre un mur.
function echelle(h, w = 0.44) {
  const parts = [];
  for (const sx of [-1, 1]) parts.push(boxG(0.07, h, 0.07).translate(sx * w / 2, h / 2, 0));
  const n = Math.max(3, Math.round(h / 0.38));
  for (let k = 1; k < n; k++) parts.push(boxG(w, 0.05, 0.05).translate(0, k * h / n, 0));
  const o = new THREE.Mesh(mergeParts(parts), BOIS(w, h, { color: 0xa88a5e }));
  o.castShadow = true; return o;
}
// Roue de charrette : moyeu, jante, huit rais, bandage de fer.
function roueCharrette(r = 0.62) {
  const g = new THREE.Group(), b = BOIS(r, r, { color: 0x8a6a46 });
  g.add(mesh(new THREE.TorusGeometry(r, 0.07, 6, 20), b, 0, 0, 0));
  g.add(mesh(new THREE.TorusGeometry(r + 0.05, 0.03, 5, 22), FERN(), 0, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 10), b, 0, 0, 0).rotateX(Math.PI / 2));
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8;
    g.add(mesh(boxG(0.06, r - 0.12, 0.06), b, Math.cos(a) * (r / 2 + 0.03), Math.sin(a) * (r / 2 + 0.03), 0).rotateZ(-a + Math.PI / 2)); }
  return g;
}

// ---------------------------------------------------------------------
//  Enseignes
// ---------------------------------------------------------------------
// Une enseigne qui « dit quelque chose » n'est pas une plaque de texte : au XVIIe
// siècle on ne lit pas, on reconnaît un DESSIN. Chaque panneau porte donc d'abord
// un emblème peint à l'or sur bois sombre, et le mot ensuite, en petit. À dix
// mètres c'est l'emblème qui parle ; le texte ne sert qu'une fois qu'on s'approche.
const OR = '#e9c98b', OR2 = '#c79a52', NOIR = '#1c1410';
function dessinEmbleme(x, cx, cy, s, type) {
  x.strokeStyle = OR; x.fillStyle = OR; x.lineCap = 'round'; x.lineJoin = 'round';
  if (type === 'pain') {                                  // couronne de pain fendue
    x.lineWidth = s * 0.20; x.beginPath(); x.arc(cx, cy, s * 0.30, 0, TAU); x.stroke();
    x.strokeStyle = OR2; x.lineWidth = s * 0.05;
    for (let k = 0; k < 9; k++) { const a = k * TAU / 9 + 0.2;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * s * 0.23, cy + Math.sin(a) * s * 0.23);
      x.lineTo(cx + Math.cos(a) * s * 0.37, cy + Math.sin(a) * s * 0.37); x.stroke(); }
  } else if (type === 'tonneau') {                        // tonneau cerclé et cône de houblon
    x.lineWidth = s * 0.055;
    x.beginPath(); x.moveTo(cx - s * 0.2, cy - s * 0.3); x.bezierCurveTo(cx - s * 0.36, cy, cx - s * 0.36, cy, cx - s * 0.2, cy + s * 0.3);
    x.lineTo(cx + s * 0.2, cy + s * 0.3); x.bezierCurveTo(cx + s * 0.36, cy, cx + s * 0.36, cy, cx + s * 0.2, cy - s * 0.3); x.closePath(); x.stroke();
    for (const dy of [-0.18, 0, 0.18]) { x.beginPath(); x.moveTo(cx - s * 0.33, cy + s * dy); x.lineTo(cx + s * 0.33, cy + s * dy); x.stroke(); }
  } else if (type === 'drap') {                           // pièce de drap qui se déroule
    x.lineWidth = s * 0.055;
    x.beginPath(); x.moveTo(cx - s * 0.34, cy - s * 0.26); x.lineTo(cx + s * 0.1, cy - s * 0.26);
    x.lineTo(cx + s * 0.1, cy - s * 0.02); x.lineTo(cx - s * 0.34, cy - s * 0.02); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(cx + s * 0.1, cy - s * 0.14);
    x.bezierCurveTo(cx + s * 0.3, cy - s * 0.05, cx + s * 0.16, cy + s * 0.2, cx + s * 0.34, cy + s * 0.32); x.stroke();
    x.beginPath(); x.moveTo(cx - s * 0.3, cy + s * 0.12); x.lineTo(cx - s * 0.02, cy + s * 0.34); x.stroke();
    x.beginPath(); x.moveTo(cx - s * 0.3, cy + s * 0.34); x.lineTo(cx - s * 0.02, cy + s * 0.12); x.stroke();
    x.lineWidth = s * 0.04;
    for (const sx of [-1, 1]) { x.beginPath(); x.arc(cx - s * 0.30, cy + s * 0.23 + sx * s * 0.12, s * 0.055, 0, TAU); x.stroke(); }
  } else if (type === 'fer') {                            // fer à cheval et marteau
    x.lineWidth = s * 0.13;
    x.beginPath(); x.arc(cx, cy + s * 0.02, s * 0.27, Math.PI * 0.82, Math.PI * 0.18, false); x.stroke();
    x.fillStyle = NOIR;
    for (let k = 0; k < 6; k++) { const a = Math.PI * 0.82 + k * (Math.PI * 1.36) / 5;
      x.beginPath(); x.arc(cx + Math.cos(a) * s * 0.27, cy + s * 0.02 + Math.sin(a) * s * 0.27, s * 0.022, 0, TAU); x.fill(); }
    x.strokeStyle = OR2; x.lineWidth = s * 0.05;
    x.beginPath(); x.moveTo(cx - s * 0.3, cy - s * 0.3); x.lineTo(cx + s * 0.18, cy + s * 0.18); x.stroke();
    x.fillStyle = OR; x.save(); x.translate(cx + s * 0.24, cy + s * 0.24); x.rotate(Math.PI / 4);
    x.fillRect(-s * 0.11, -s * 0.07, s * 0.22, s * 0.14); x.restore();
  } else if (type === 'chope') {                          // chope à couvercle et faux-col
    x.lineWidth = s * 0.055;
    x.strokeRect(cx - s * 0.22, cy - s * 0.16, s * 0.36, s * 0.46);
    x.beginPath(); x.arc(cx + s * 0.2, cy + s * 0.06, s * 0.12, -Math.PI / 2, Math.PI / 2); x.stroke();
    x.beginPath(); x.moveTo(cx - s * 0.27, cy - s * 0.16);
    x.bezierCurveTo(cx - s * 0.18, cy - s * 0.34, cx + s * 0.1, cy - s * 0.34, cx + s * 0.19, cy - s * 0.16); x.stroke();
  } else if (type === 'balance') {                        // balance à fléau
    x.lineWidth = s * 0.05;
    x.beginPath(); x.moveTo(cx, cy + s * 0.34); x.lineTo(cx, cy - s * 0.24); x.stroke();
    x.beginPath(); x.moveTo(cx - s * 0.32, cy - s * 0.2); x.lineTo(cx + s * 0.32, cy - s * 0.2); x.stroke();
    for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(cx + sx * s * 0.3, cy - s * 0.2); x.lineTo(cx + sx * s * 0.3, cy + s * 0.02); x.stroke();
      x.beginPath(); x.arc(cx + sx * s * 0.3, cy + s * 0.02, s * 0.13, 0, Math.PI); x.stroke(); }
  } else if (type === 'poisson') {                        // hareng
    x.lineWidth = s * 0.055;
    x.beginPath(); x.moveTo(cx - s * 0.3, cy);
    x.bezierCurveTo(cx - s * 0.1, cy - s * 0.24, cx + s * 0.12, cy - s * 0.2, cx + s * 0.26, cy);
    x.bezierCurveTo(cx + s * 0.12, cy + s * 0.2, cx - s * 0.1, cy + s * 0.24, cx - s * 0.3, cy); x.stroke();
    x.beginPath(); x.moveTo(cx - s * 0.3, cy); x.lineTo(cx - s * 0.42, cy - s * 0.16); x.lineTo(cx - s * 0.42, cy + s * 0.16); x.closePath(); x.stroke();
    x.beginPath(); x.arc(cx + s * 0.16, cy - s * 0.04, s * 0.03, 0, TAU); x.fill();
  } else if (type === 'gaufre') {                         // gaufre à carreaux
    x.lineWidth = s * 0.05; x.strokeRect(cx - s * 0.3, cy - s * 0.22, s * 0.6, s * 0.44);
    for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(cx - s * 0.3 + k * s * 0.15, cy - s * 0.22); x.lineTo(cx - s * 0.3 + k * s * 0.15, cy + s * 0.22); x.stroke(); }
    for (let k = 1; k < 3; k++) { x.beginPath(); x.moveTo(cx - s * 0.3, cy - s * 0.22 + k * s * 0.147); x.lineTo(cx + s * 0.3, cy - s * 0.22 + k * s * 0.147); x.stroke(); }
  }
}
// Panneau peint, pendu par deux anneaux à une potence à volute. L'origine du groupe
// est le scellement dans le mur ; la potence part vers +x et le panneau pend sous
// son extrémité, faces tournées vers ±z — même convention que makeEnseigne().
function enseignePeinte(texte, embleme, w = 2.2, h = 1.2, o = {}) {
  const g = new THREE.Group(), teinte = o.teinte === undefined ? 0x2a1d14 : o.teinte;
  const W = 512, H = Math.round(512 * h / w), [c, x] = makeCanvas(W, H);
  const bois = new THREE.Color(teinte);
  x.fillStyle = '#' + bois.getHexString(); x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;                    // fil du bois
  for (let k = 0; k < 14; k++) { const y = (k + 0.5) * H / 14;
    x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(W / 3, y + 3, 2 * W / 3, y - 3, W, y); x.stroke(); }
  x.strokeStyle = OR2; x.lineWidth = 7; x.strokeRect(9, 9, W - 18, H - 18);
  x.strokeStyle = OR; x.lineWidth = 3; x.strokeRect(19, 19, W - 38, H - 38);
  dessinEmbleme(x, W * 0.205, H * 0.5, H * 0.62, embleme);
  x.fillStyle = '#f0dcb4'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let taille = Math.round(H * 0.24);
  do { x.font = 'bold ' + taille + 'px Georgia, serif'; taille -= 2; } while (x.measureText(texte).width > W * 0.52 && taille > 9);
  x.fillText(texte, W * 0.645, H * 0.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.82 });
  const pan = new THREE.Mesh(boxG(w, h, 0.07), [FERN(), FERN(), FERN(), FERN(), face, face]);
  pan.castShadow = true; g.add(pan);
  // « simple » : le panneau seul, cloué sur une sablière d'étal ou sur un poteau.
  if (o.simple) return g;
  pan.position.set(w / 2 + 0.45, -h / 2 - 0.3, 0);
  for (const sx of [-1, 1]) {                                            // deux anneaux de suspension
    const ax = w / 2 + 0.45 + sx * w * 0.36;
    g.add(mesh(new THREE.TorusGeometry(0.06, 0.018, 5, 10), FERN(), ax, -0.24, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 5), FERN(), ax, -0.24, 0));
  }
  g.add(mesh(boxG(w + 1.05, 0.08, 0.08), FERN(), (w + 1.05) / 2 - 0.08, 0, 0));          // potence
  g.add(mesh(boxG(0.12, 0.85, 0.12), FERN(), 0.02, -0.38, 0));                           // scellement
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.032, 5, 12, Math.PI / 2), FERN(), 0.06, -0.36, 0).rotateZ(Math.PI));
  g.add(mesh(new THREE.TorusGeometry(0.17, 0.026, 5, 12, Math.PI * 1.6), FERN(), 0.62, -0.2, 0).rotateZ(-0.6));  // volute
  g.add(mesh(sphG(0.07, 8), FERN(), w + 1.0, 0, 0));
  return g;
}
// Enseigne-objet : l'autre moitié de l'usage flamand. Un objet de fer forgé pendu à
// une potence au-dessus de la porte — une couronne de pain, un tonneau, une navette,
// un fer à cheval. Le bras part vers +z (perpendiculaire à la façade).
function emblemeObjet(type) {
  const g = new THREE.Group(), fer = FERN(), L = 1.15;
  g.add(mesh(boxG(0.07, 0.07, L), fer, 0, 0, L / 2));
  g.add(mesh(boxG(0.09, 0.5, 0.09), fer, 0, -0.22, 0.04));
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.028, 5, 12, Math.PI / 2), fer, 0, -0.3, 0.06).rotateY(Math.PI / 2));
  const o = new THREE.Group(); o.position.set(0, -0.62, L - 0.1); g.add(o);
  g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 5), fer, 0, -0.17, L - 0.1));
  if (type === 'couronne') {
    o.add(mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), UNI(0xc79a52, { metalness: 0.55, roughness: 0.42 }), 0, -0.3, 0).rotateY(Math.PI / 2));
    for (let k = 0; k < 7; k++) { const a = k * TAU / 7;
      o.add(mesh(boxG(0.03, 0.09, 0.05), UNI(0x8a6a34, { metalness: 0.5, roughness: 0.5 }), 0, -0.3 + Math.sin(a) * 0.3, Math.cos(a) * 0.3).rotateX(-a)); }
  } else if (type === 'tonneau') {
    const tn = tonneau(0.23, 0.5, 0x6a4a2e); tn.position.set(0, -0.58, 0); tn.rotation.z = Math.PI / 2; o.add(tn);
  } else if (type === 'navette') {                       // navette de tisserand
    const nv = mesh(new THREE.LatheGeometry([0, 0.12, 0.3, 0.46, 0.6, 0.76, 1].map((t, i) =>
      new THREE.Vector2([0, 0.05, 0.1, 0.11, 0.1, 0.05, 0][i], t * 0.9 - 0.45)), 10),
      UNI(0x7a5a34, { roughness: 0.5 }), 0, -0.45, 0);
    nv.rotation.z = Math.PI / 2; o.add(nv);
    o.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), UNI(0xc2a05a), 0, -0.45, 0).rotateZ(Math.PI / 2));
  } else if (type === 'fer') {
    o.add(mesh(new THREE.TorusGeometry(0.28, 0.055, 7, 14, Math.PI * 1.45), UNI(0x3a3a40, { metalness: 0.85, roughness: 0.38 }), 0, -0.34, 0)
      .rotateY(Math.PI / 2).rotateZ(-Math.PI * 0.72));
  } else if (type === 'chope') {
    o.add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.36, 12), UNI(0xb9913f, { metalness: 0.8, roughness: 0.35 }), 0, -0.5, 0));
    o.add(mesh(new THREE.TorusGeometry(0.12, 0.025, 5, 10, Math.PI), UNI(0xb9913f, { metalness: 0.8, roughness: 0.35 }), 0.16, -0.5, 0).rotateZ(-Math.PI / 2));
  }
  return g;
}

// ---------------------------------------------------------------------
//  Traces d'usage : ce qui se voit au sol et au pied des murs
// ---------------------------------------------------------------------
// Une rue neuve et une rue vécue ont la même géométrie. Ce qui les sépare tient au
// sol : la terre tassée devant les seuils, l'eau qui stagne dans le creux des pavés,
// les deux bandes lissées par les roues. Tout ce qui suit est plat, sans collision,
// et posé un centimètre au-dessus du pavage (qui culmine à y ≈ 0,043).
function tache(ctx, x, z, r, col, op = 0.5, y = 0.048) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16),
    PIERV(r * 2, r * 2, { color: col, transparent: true, opacity: op, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.z = rand(0.7, 1.25);
  m.rotation.z = rand(0, TAU); m.renderOrder = 3; m.receiveShadow = true; ctx.scene.add(m);
  return m;
}
// Flaque : le fond mouillé est un disque sombre et mat, la lame d'eau un disque
// presque lisse et légèrement métallique posé dessus — c'est le reflet du ciel qui
// fait la flaque, pas la couleur.
const _EAU = [];
const MAT_EAU = () => (_EAU[0] ||= new THREE.MeshStandardMaterial({
  color: 0x6f7c80, roughness: 0.07, metalness: 0.45, transparent: true, opacity: 0.8, depthWrite: false }));
function flaque(ctx, x, z, r) {
  tache(ctx, x, z, r * 1.5, 0x4a4036, 0.55, 0.05);
  const e = new THREE.Mesh(new THREE.CircleGeometry(r, 18), MAT_EAU());
  e.rotation.x = -Math.PI / 2; e.rotation.z = rand(0, TAU); e.position.set(x, 0.053, z);
  e.scale.set(1, 1, rand(0.6, 1.2)); e.renderOrder = 4; ctx.scene.add(e);
}
// Ornières : deux bandes lissées, à l'écartement d'un essieu de charrette (1,5 m
// réel, soit 1 unité locale). Posées le long d'un segment droit.
function ornieres(ctx, x0, z0, x1, z1, ecart = 1.0) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
  for (const s of [-1, 1]) {
    const nx = -dz / len * s * ecart / 2, nz = dx / len * s * ecart / 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.42),
      PIERV(len, 0.42, { color: 0x6a5c4a, transparent: true, opacity: 0.42, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -ang;
    m.position.set((x0 + x1) / 2 + nx, 0.049, (z0 + z1) / 2 + nz);
    m.renderOrder = 3; m.receiveShadow = true; ctx.scene.add(m);
  }
}
// Chasse-roue : la borne de pierre qui protège l'angle d'une maison du moyeu des
// charrettes. Rien ne dit mieux « ici passent des charrois » — et elle est usée.
function chasseRoue(ctx, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); ctx.scene.add(g);
  g.add(mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.72, 8), PIERV(0.5, 0.72, { color: 0xbdb29c }), 0, 0.36, 0));
  const cap = mesh(sphG(0.18, 9), PIERV(0.5, 0.5, { color: 0xc6bba4 }), 0, 0.72, 0);
  cap.scale.set(1, 0.6, 1); g.add(cap);
  ctx.addCap(x, z, x, z, 0.25, 0.95);
}
// Décrottoir de seuil : deux montants et une lame. On s'y racle les bottes avant
// d'entrer, et à l'époque on en a besoin.
function grattoir(ctx, x, z, yaw) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; ctx.scene.add(g);
  for (const sx of [-1, 1]) g.add(mesh(boxG(0.05, 0.3, 0.05), FERN(), sx * 0.15, 0.15, 0));
  g.add(mesh(boxG(0.34, 0.05, 0.03), FERN(), 0, 0.29, 0));
  g.add(mesh(boxG(0.5, 0.06, 0.28), PIERV(0.5, 0.3, { color: 0xb8ad97 }), 0, 0.03, 0.02));
}
// Anneau d'attache scellé dans la façade : une platine, un piton, un anneau.
function anneauMur(ctx, x, y, z, yaw) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; ctx.scene.add(g);
  g.add(mesh(boxG(0.16, 0.16, 0.06), FERN(), 0, 0, 0.03));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 5), FERN(), 0, 0, 0.09).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.TorusGeometry(0.09, 0.02, 5, 12), FERN(), 0, -0.08, 0.12).rotateY(Math.PI / 2));
}
// Plaque de millésime — les maisons flamandes portent un nom, pas un numéro.
function millesime(ctx, x, y, z, yaw, texte) {
  const [c, g2] = makeCanvas(320, 96);
  g2.fillStyle = '#b8ad96'; g2.fillRect(0, 0, 320, 96);
  g2.strokeStyle = '#8d8471'; g2.lineWidth = 5; g2.strokeRect(8, 8, 304, 80);
  g2.fillStyle = '#42392c'; g2.font = 'bold 34px Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.fillText(texte, 160, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const cadre = mesh(boxG(1.34, 0.52, 0.1), PIERV(1.34, 0.52, { color: 0xcabfa8 }), x, y, z);
  cadre.rotation.y = yaw; ctx.scene.add(cadre);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.35), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  p.position.set(x, y, z); p.rotation.y = yaw; p.translateZ(0.052); ctx.scene.add(p);
}

// ---------------------------------------------------------------------
//  Les tas
// ---------------------------------------------------------------------
// Un tas dit ce qu'on brûle, ce qu'on répare et ce qu'on attend. Bûches contre le
// mur du boulanger, tourbe au forgeron, tuiles et sable au pied de la chapelle.
function tasBuches(ctx, x, z, yaw, len = 2.4, haut = 1.15) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; ctx.scene.add(g);
  const nr = Math.max(3, Math.round(haut / 0.24)), nc = Math.max(4, Math.round(len / 0.25));
  const geo = new THREE.CylinderGeometry(0.115, 0.115, 0.52, 7).rotateZ(Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, pbrRepeat(T.bark, 1, 1), nr * nc * 2);
  const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), Pv = new THREE.Vector3(), Sv = new THREE.Vector3(), Eu = new THREE.Euler();
  let n = 0;
  for (let r = 0; r < nr; r++) for (let c2 = 0; c2 < nc; c2++) for (const dz of [-0.27, 0.27]) {
    if (r === nr - 1 && Math.random() < 0.35) continue;
    Pv.set(-len / 2 + (c2 + 0.5) * len / nc, 0.12 + r * 0.235 + rand(-0.01, 0.01), dz + rand(-0.02, 0.02));
    Qt.setFromEuler(Eu.set(rand(0, TAU), rand(-0.05, 0.05), rand(-0.04, 0.04)));   // le premier angle tourne la bûche sur SON axe
    Sv.set(rand(0.85, 1.05), rand(0.85, 1.1), rand(0.85, 1.05));
    im.setMatrixAt(n++, M4.compose(Pv, Qt, Sv));
  }
  im.count = n; im.castShadow = im.receiveShadow = true; g.add(im);
  { const tri = new THREE.Shape(); tri.moveTo(-len / 2 - 0.2, 0); tri.lineTo(len / 2 + 0.2, 0); tri.lineTo(0, 0.28); tri.closePath();
    const av = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.85, bevelEnabled: false }), BOIS(len, 0.9, { color: 0x7a6242 }));
    av.position.set(0, 0.12 + nr * 0.235, -0.42); av.castShadow = true; g.add(av); }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  ctx.addCap(x - c * len / 2, z + s * len / 2, x + c * len / 2, z - s * len / 2, 0.42, 0.14 + nr * 0.235);
}
function tasCone(ctx, x, z, r, h, col, rug = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); ctx.scene.add(g);
  const c = mesh(new THREE.ConeGeometry(r, h, 12), PIERV(r * 2, h, { color: col, roughness: rug }), 0, h / 2, 0);
  c.scale.set(1, 1, rand(0.85, 1.15)); g.add(c);
  for (let k = 0; k < 7; k++) { const a = rand(0, TAU), d = rand(r * 0.75, r * 1.2);
    g.add(mesh(sphG(rand(0.06, 0.13), 6), UNI(sombre(col, 0.85)), Math.cos(a) * d, 0.05, Math.sin(a) * d)); }
  ctx.addCap(x, z, x, z, r * 0.8, h);
  return g;
}
function tasTuiles(ctx, x, z, yaw) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; ctx.scene.add(g);
  const m = TUILV(0.5, 0.5, { color: 0xa8552e });
  for (let p = 0; p < 3; p++) for (let k = 0; k < 9 - p * 2; k++)
    g.add(mesh(boxG(0.44, 0.035, 0.3), m, p * 0.5 - 0.5, 0.02 + k * 0.038, rand(-0.03, 0.03)).rotateY(rand(-0.06, 0.06)));
  ctx.addCap(x - 0.7, z, x + 0.7, z, 0.3, 0.45);
}

// ---------------------------------------------------------------------
//  Les commerces
// ---------------------------------------------------------------------
// Quatre métiers, et l'exigence qu'on les distingue SANS lire l'enseigne : la
// couleur du bois de la devanture, la marchandise sur l'étal, et surtout ce qui
// traîne dehors — des tonneaux chez le brasseur, des sacs de farine chez le
// boulanger, des pièces de drap qui sèchent chez le drapier, du charbon et un
// bac à tremper chez le forgeron.
const METIERS = {
  // la boulangerie est aussi l'école de cuisine où Camille apprend son métier (le prologue)
  boulanger: { texte: 'ÉCOLE LEQUEUCHE',      embleme: 'pain',    objet: 'couronne', bois: 0x9a6a2e, nom: 'DE GOUDEN AER — 1662' },
  brasseur:  { texte: 'LA CERVOISE',      embleme: 'tonneau', objet: 'tonneau',  bois: 0x3c5c42, nom: 'IN DEN HOP — 1658' },
  drapier:   { texte: 'AU DRAP D’OR',     embleme: 'drap',    objet: 'navette',  bois: 0x7c2f36, nom: 'DE GOUDEN LEEUW — 1651' },
  forgeron:  { texte: 'À L’ENCLUME',      embleme: 'fer',     objet: 'fer',      bois: 0x43404a, nom: 'T YSER — 1669' },
};

// Devanture à volet rabattable : le volet du bas s'abaisse sur ses béquilles et fait
// la table de vente, celui du haut se relève et fait l'auvent. C'est ce mécanisme —
// pas un store — qui fait lire « échoppe » plutôt que « maison avec un rideau ».
// o : { hx, hz, yaw, w, d, metier, cotes? }. Le repère local a +z vers la rue.
function devanture(ctx, o) {
  const M = METIERS[o.metier], yaw = o.yaw;
  const ox = o.hx + Math.sin(yaw) * o.d / 2, oz = o.hz + Math.cos(yaw) * o.d / 2;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const P = (lx, lz) => [ox + lx * cs + lz * sn, oz - lx * sn + lz * cs];   // local devanture -> local village
  const g = new THREE.Group(); g.position.set(ox, 0, oz); g.rotation.y = yaw; ctx.scene.add(g);
  const Wb = Math.max(0.85, o.w / 2 - 1.75), bois = CHENE(Wb, 2.5, { color: M.bois });
  const boisF = CHENE(Wb, 1.0, { color: clair2(M.bois, 0.18) });
  const baies = [];
  for (const sx of (o.cotes || [-1, 1])) {
    const bx = sx * (1.42 + Wb / 2);
    const b = new THREE.Group(); b.position.set(bx, 0, 0); g.add(b); baies.push([bx, b]);
    // l'ouverture : fond noir, allège de pierre, jambages et linteau de chêne peint
    b.add(mesh(boxG(Wb, 1.5, 0.05), UNI(0x140f0b, { roughness: 1 }), 0, 1.72, 0.04));
    b.add(mesh(boxG(Wb + 0.24, 0.95, 0.2), PIERV(Wb, 0.95, { color: 0xc4b9a2 }), 0, 0.48, 0.1));
    for (const j of [-1, 1]) b.add(mesh(boxG(0.17, 2.55, 0.26), bois, j * (Wb / 2 + 0.085), 1.28, 0.13));
    b.add(mesh(boxG(Wb + 0.42, 0.24, 0.28), bois, 0, 2.6, 0.14));
    b.add(mesh(boxG(Wb + 0.52, 0.1, 0.34), PIERV(Wb, 0.3, { color: 0xc4b9a2 }), 0, 2.76, 0.16));
    // la table de vente, ses béquilles et son rebord
    b.add(mesh(boxG(Wb + 0.42, 0.1, 0.8), BOIS(Wb + 0.42, 0.8, { color: 0xa9885e }), 0, 1.02, 0.42));
    b.add(mesh(boxG(Wb + 0.42, 0.08, 0.06), bois, 0, 1.1, 0.79));
    for (const j of [-1, 1]) { const bq = mesh(boxG(0.07, 1.05, 0.07), bois, j * Wb * 0.42, 0.52, 0.5); bq.rotation.x = 0.28; b.add(bq); }
    // le volet-auvent, relevé sur deux tirants de fer
    const av = new THREE.Group(); av.position.set(0, 2.66, 0.16); av.rotation.x = -0.88; b.add(av);
    av.add(mesh(boxG(Wb + 0.5, 0.07, 1.0), BOIS(Wb + 0.5, 1.0, { color: clair2(M.bois, 0.1) }), 0, 0, 0.5));
    for (const j of [-1, 1]) av.add(mesh(boxG(0.05, 0.05, 0.9), FERN(), j * (Wb / 2 + 0.16), 0.06, 0.46));
    for (const j of [-1, 1]) { const ti = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.15, 5), FERN(), j * (Wb / 2 + 0.1), 3.2, 0.42); ti.rotation.x = 0.85; b.add(ti); }
    garnirBaie(b, o.metier, Wb, boisF);
    const [cx0, cz0] = P(bx - Wb / 2, 0.42), [cx1, cz1] = P(bx + Wb / 2, 0.42);
    ctx.addCap(cx0, cz0, cx1, cz1, 0.3, 1.25);
  }
  // enseigne peinte au bout de la façade, perpendiculaire à la rue
  const ens = enseignePeinte(M.texte, M.embleme, 1.95, 1.05);
  ens.position.set(o.w / 2 - 0.15, 4.42, 0.1); ens.rotation.y = -Math.PI / 2; g.add(ens);
  // enseigne-objet au-dessus de la baie de gauche : l'autre moitié de l'usage flamand
  const eo = emblemeObjet(M.objet); eo.position.set(-(1.42 + Wb / 2), o.objetY || 3.62, 0.08); g.add(eo);
  // nom de maison gravé, à la flamande
  // le bandeau d'étage court à y = 3,2 : la plaque se pose juste au-dessus
  if (!o.sansPlaque) { const [mx, mz] = P(0, 0.16); millesime(ctx, mx, 3.8, mz, yaw, M.nom); }
  // le sol devant une boutique est tassé et sali par ce qu'on y décharge
  { const [tx2, tz2] = P(0, 1.35); tache(ctx, tx2, tz2, 2.3, o.metier === 'boulanger' ? 0xe6dcc0 : 0x7d6c53, 0.42); }
  return { P, g, Wb, baies };
}
// Ce qui est posé sur la table et sur les deux étagères du fond. C'est la seule
// chose qui distingue vraiment deux échoppes quand on passe devant sans s'arrêter.
function garnirBaie(b, metier, Wb, boisF) {
  const et = (y) => b.add(mesh(boxG(Wb - 0.08, 0.05, 0.16), boisF, 0, y, 0.12));
  et(1.42); et(1.95);
  const rang = (n, y, z, f) => { for (let k = 0; k < n; k++) f((k + 0.5) / n * (Wb - 0.2) - (Wb - 0.2) / 2, y, z, k); };
  if (metier === 'boulanger') {
    const croute = UNI(0xb07a3c, { roughness: 0.85 }), mie = UNI(0xd9b070, { roughness: 0.9 });
    rang(4, 1.16, 0.45, (x) => { const p = mesh(sphG(0.17, 9), croute, x, 0, 0); p.scale.set(1.5, 0.62, 0.95); p.position.set(x, 1.16, 0.45); b.add(p); });
    rang(3, 1.55, 0.14, (x) => { const p = mesh(sphG(0.15, 9), croute, x, 1.55, 0.14); p.scale.set(1, 0.7, 1); b.add(p); });
    rang(5, 2.05, 0.14, (x) => { const p = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 7), mie, x, 2.07, 0.14); p.rotation.z = Math.PI / 2; b.add(p); });
    const pa = panier(0.22, 0.2); pa.position.set(Wb / 2 - 0.22, 1.12, 0.52); b.add(pa);
    for (let k = 0; k < 4; k++) pa.add(mesh(sphG(0.08, 7), croute, rand(-0.08, 0.08), 0.2, rand(-0.08, 0.08)));
  } else if (metier === 'brasseur') {
    rang(3, 1.12, 0.44, (x) => { const c = cruche(0.36, 0x7d5c40); c.position.set(x, 1.12, 0.44); b.add(c); });
    rang(4, 1.47, 0.14, (x) => b.add(mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.3, 8), UNI(0x3e5a3a, { roughness: 0.35 }), x, 1.62, 0.14)));
    rang(3, 2.0, 0.14, (x) => { const c = cruche(0.3, 0x6a5238); c.position.set(x, 2.0, 0.14); b.add(c); });
    // la cuve de cuivre, aperçue dans le fond de l'échoppe
    b.add(mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.62, 12), UNI(0x9a6a3a, { metalness: 0.75, roughness: 0.38 }), -Wb * 0.18, 1.3, 0.26));
    b.add(mesh(new THREE.TorusGeometry(0.34, 0.03, 5, 14), UNI(0x7a5430, { metalness: 0.7, roughness: 0.4 }), -Wb * 0.18, 1.6, 0.26).rotateX(Math.PI / 2));
  } else if (metier === 'drapier') {
    const tons = [0x8c2f3a, 0x2f4d7a, 0x3f6a45, 0xd9c07a, 0x54406a];
    rang(3, 1.18, 0.44, (x, y, z, k) => { const r = mesh(new THREE.CylinderGeometry(0.13, 0.13, Wb * 0.28, 12), ETOFFE(0.3, Wb * 0.28, { color: tons[k % 5] }), x, 1.18, 0.44); r.rotation.z = Math.PI / 2; b.add(r); });
    rang(4, 1.5, 0.14, (x, y, z, k) => { const r = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 10), ETOFFE(0.25, 0.26, { color: tons[(k + 2) % 5] }), x, 1.55, 0.14); r.rotation.z = Math.PI / 2; b.add(r); });
    rang(4, 2.02, 0.14, (x, y, z, k) => b.add(mesh(boxG(Wb / 5.5, 0.14, 0.2), ETOFFE(0.3, 0.2, { color: tons[(k + 1) % 5] }), x, 2.05, 0.14)));
    // deux pièces de drap qui tombent du nez de l'auvent : la tache de couleur
    for (const [j, k] of [[-1, 0], [1, 3]]) {
      const pan = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.5, 2, 5), ETOFFE(0.42, 1.5, { color: tons[k], side: THREE.DoubleSide }));
      const po = pan.geometry.attributes.position;
      for (let i = 0; i < po.count; i++) po.setZ(i, Math.sin(po.getY(i) * 3.1 + j) * 0.05);
      po.needsUpdate = true; pan.geometry.computeVertexNormals();
      pan.position.set(j * Wb * 0.33, 2.65, 0.92); pan.castShadow = true; b.add(pan);
    }
  } else if (metier === 'forgeron') {
    const fer = FERN();
    rang(5, 1.13, 0.44, (x) => b.add(mesh(new THREE.TorusGeometry(0.1, 0.022, 5, 10, Math.PI * 1.45), fer, x, 1.13, 0.44).rotateX(-Math.PI / 2)));
    rang(4, 1.5, 0.14, (x) => b.add(mesh(boxG(0.035, 0.035, 0.26), fer, x, 1.52, 0.14)));
    rang(3, 2.0, 0.14, (x) => b.add(mesh(new THREE.CylinderGeometry(0.03, 0.005, 0.22, 5), fer, x, 2.08, 0.14)));
    b.add(mesh(boxG(0.2, 0.06, 0.3), UNI(0x6a5a44), Wb / 2 - 0.2, 1.1, 0.46));
    for (let k = 0; k < 9; k++) b.add(mesh(new THREE.CylinderGeometry(0.012, 0.004, 0.09, 4), fer, Wb / 2 - 0.26 + (k % 3) * 0.05, 1.17, 0.38 + Math.floor(k / 3) * 0.05).rotateX(1.3));
  }
}

// ---------------------------------------------------------------------
//  La forge
// ---------------------------------------------------------------------
// Le forgeron ne vend pas derrière une vitre : il travaille dehors, sous un auvent
// ouvert sur la rue. C'est le seul commerce qu'on entend et qu'on voit brûler —
// d'où l'unique lumière ponctuelle que s'autorise le village (budget ≈10 par niveau).
function forge(ctx) {
  const { scene, addCap } = ctx;
  const FX = 6.1, FZ = 14;                       // façade de la maison du forgeron, ouverte vers -x
  const bois = CHENE(0.3, 3.1, { color: 0x53402c });
  for (const dz of [-2.3, 2.3]) {
    scene.add(mesh(boxG(0.26, 3.05, 0.26), bois, FX - 1.85, 1.52, FZ + dz));
    scene.add(mesh(boxG(0.34, 0.16, 0.34), PIERV(0.4, 0.2, { color: 0xbcb19b }), FX - 1.85, 0.08, FZ + dz));
    addCap(FX - 1.85, FZ + dz, FX - 1.85, FZ + dz, 0.2, 3.15);
    const cf = mesh(boxG(1.05, 0.14, 0.14), bois, FX - 1.0, 2.82, FZ + dz); cf.rotation.z = 0.42; scene.add(cf);
  }
  scene.add(mesh(boxG(0.22, 0.24, 5.0), bois, FX - 1.85, 3.13, FZ));                       // sablière
  { const toit = mesh(boxG(2.35, 0.14, 5.3), TUILV(2.35, 5.3, { color: 0x9c5230 }), FX - 1.0, 3.32, FZ);
    toit.rotation.z = 0.2; scene.add(toit);
    scene.add(mesh(boxG(0.1, 0.2, 5.3), bois, FX - 2.12, 3.09, FZ)); }
  // le foyer : massif de brique, braises, hotte et conduit le long du mur
  const HZ2 = FZ - 1.6;
  scene.add(mesh(boxG(1.1, 0.86, 1.5), BRIQV(1.1, 0.86, { color: 0x9a6a54 }), FX - 0.55, 0.43, HZ2));
  scene.add(mesh(boxG(1.2, 0.1, 1.6), PIERV(1.2, 1.6, { color: 0x6a6058 }), FX - 0.55, 0.9, HZ2));
  scene.add(mesh(boxG(0.66, 0.05, 0.9), UNI(0x120c08, { roughness: 1 }), FX - 0.6, 0.94, HZ2));
  const braises = mesh(boxG(0.56, 0.06, 0.78), new THREE.MeshStandardMaterial({
    color: 0xff6a18, emissive: 0xff5a10, emissiveIntensity: 1.5, roughness: 0.8 }), FX - 0.6, 0.97, HZ2);
  scene.add(braises);
  { const feu = new THREE.Group(); feu.position.set(FX - 0.6, 1.02, HZ2); scene.add(feu);
    const flamme = mesh(sphG(0.2, 8), new THREE.MeshBasicMaterial({ color: 0xffb040 }), 0, 0.18, 0);
    flamme.scale.set(1, 1.5, 0.8); feu.add(flamme);
    const lum = new THREE.PointLight(0xff8a30, 6, 11, 1.5); lum.position.set(0, 0.7, 0); feu.add(lum);
    feu.userData = { flame: flamme, light: lum, seed: rand(0, 10), dynamic: true }; }
  scene.add(mesh(new THREE.CylinderGeometry(0.42, 1.0, 1.05, 4), PIERV(1.0, 1.05, { color: 0x6f645a }), FX - 0.55, 1.95, HZ2).rotateY(Math.PI / 4));
  scene.add(mesh(boxG(0.7, 2.6, 0.7), BRIQV(0.7, 2.6, { color: 0x8f6450 }), FX - 0.3, 3.7, HZ2));
  addCap(FX - 0.55, HZ2 - 0.7, FX - 0.55, HZ2 + 0.7, 0.6, 1.0);
  // le soufflet, pendu au mur à côté du foyer
  { const sf = mesh(new THREE.CylinderGeometry(0.06, 0.34, 0.85, 8), CHENE(0.6, 0.85, { color: 0x6a4c32 }), FX - 0.35, 1.35, HZ2 - 1.25);
    sf.rotation.z = Math.PI / 2; sf.rotation.y = 0.1; scene.add(sf);
    scene.add(mesh(boxG(0.06, 0.06, 0.9), CHENE(0.1, 0.9, { color: 0x6a4c32 }), FX - 0.35, 1.72, HZ2 - 1.6).rotateX(0.35)); }
  // l'enclume sur son billot, marteau posé dessus
  { const AX = FX - 1.2, AZ = FZ + 0.25;
    scene.add(mesh(new THREE.CylinderGeometry(0.31, 0.34, 0.56, 10), pbrRepeat(T.bark, 1, 1), AX, 0.28, AZ));
    const acier = UNI(0x3f4248, { metalness: 0.8, roughness: 0.42 });
    scene.add(mesh(boxG(0.34, 0.1, 0.26), acier, AX, 0.61, AZ));
    scene.add(mesh(boxG(0.22, 0.16, 0.2), acier, AX, 0.72, AZ));
    scene.add(mesh(boxG(0.62, 0.15, 0.26), acier, AX, 0.87, AZ));
    scene.add(mesh(new THREE.ConeGeometry(0.11, 0.38, 8), acier, AX + 0.48, 0.87, AZ).rotateZ(-Math.PI / 2));
    scene.add(mesh(boxG(0.16, 0.12, 0.12), acier, AX - 0.3, 1.0, AZ));
    scene.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.5, 6), CHENE(0.1, 0.5, { color: 0x7a5a38 }), AX - 0.1, 0.99, AZ + 0.16).rotateZ(Math.PI / 2));
    addCap(AX, AZ, AX, AZ, 0.38, 1.0); }
  // le bac à tremper : l'eau noire, c'est là qu'on entend le sifflement
  { const BX = FX - 0.85, BZ = FZ + 1.9;
    scene.add(mesh(boxG(0.8, 0.52, 1.5), PIERV(0.8, 0.52, { color: 0x8e8574 }), BX, 0.26, BZ));
    scene.add(mesh(boxG(0.6, 0.04, 1.3), new THREE.MeshStandardMaterial({ color: 0x1d2528, roughness: 0.12, metalness: 0.4 }), BX, 0.47, BZ));
    addCap(BX, BZ - 0.6, BX, BZ + 0.6, 0.45, 0.6); }
  // râtelier de fers à cheval contre le mur
  { const RZ = FZ + 3.0;
    scene.add(mesh(boxG(0.12, 0.1, 1.5), CHENE(0.2, 1.5, { color: 0x6a4c32 }), FX - 0.1, 1.95, RZ));
    for (let k = 0; k < 5; k++) scene.add(mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 12, Math.PI * 1.45), FERN(), FX - 0.12, 1.75, RZ - 0.6 + k * 0.3).rotateY(Math.PI / 2).rotateZ(-Math.PI * 0.72)); }
  // barres de fer en attente, meule à aiguiser, roue en cours de bandage, charbon
  for (let k = 0; k < 6; k++) { const bx2 = FX - 0.2, bz2 = FZ + 2.3 + k * 0.07;
    const br = mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 5), FERN(), bx2 - k * 0.04, 1.1, bz2); br.rotation.z = 0.16 + k * 0.01; scene.add(br); }
  { const MX = FX - 1.45, MZ = FZ - 2.6;
    scene.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.13, 16), PIERV(0.9, 0.9, { color: 0x8c8274 }), MX, 0.78, MZ).rotateX(Math.PI / 2));
    for (const sz of [-1, 1]) scene.add(mesh(boxG(0.1, 0.85, 0.1), CHENE(0.15, 0.85, { color: 0x6a4c32 }), MX, 0.42, MZ + sz * 0.35));
    scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), FERN(), MX, 0.78, MZ).rotateX(Math.PI / 2));
    addCap(MX, MZ, MX, MZ, 0.45, 0.95); }
  { const r = roueCharrette(0.62); r.position.set(FX - 0.55, 0.66, FZ + 2.75); r.rotation.y = Math.PI / 2; r.rotation.z = 0.22; scene.add(r); }
  tasCone(ctx, FX - 1.4, FZ + 3.15, 0.8, 0.62, 0x2b2724, 1);
  // le sol d'une forge est noir de battitures, et l'eau du bac finit par terre
  tache(ctx, FX - 1.0, FZ, 2.5, 0x2e2a26, 0.55);
  tache(ctx, FX - 1.2, FZ - 1.6, 1.3, 0x1e1b18, 0.6);
  flaque(ctx, FX - 1.7, FZ + 2.1, 0.45);
  anneauMur(ctx, FX - 0.04, 1.5, FZ - 3.3, -Math.PI / 2);
}

// ---------------------------------------------------------------------
//  Le séchoir du drapier : les rames, au bout de la grand-rue
// ---------------------------------------------------------------------
// Une pièce de drap sort du foulon trempée et se déforme en séchant : on la tend sur
// des « rames », des cadres de bois garnis de crochets. À Lille c'était le paysage
// ordinaire des faubourgs — et c'est ce qui dit « ville drapière » en un coup d'œil.
function sechoirDrapier(ctx) {
  const { scene, addCap } = ctx;
  const tons = [0x8c2f3a, 0x2f4d7a, 0x3f6a45, 0xd9c07a];
  const rame = (x, z, len, col) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const b = CHENE(0.2, 2.6, { color: 0x7a6242 });
    for (const sz of [-1, 1]) g.add(mesh(boxG(0.18, 2.6, 0.18), b, 0, 1.3, sz * len / 2));
    for (const y of [0.85, 2.45]) g.add(mesh(boxG(0.14, 0.14, len), b, 0, y, 0));
    const dr = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.2, 1.5, 6, 3), ETOFFE(len, 1.5, { color: col, side: THREE.DoubleSide }));
    const po = dr.geometry.attributes.position;
    for (let i = 0; i < po.count; i++) po.setZ(i, Math.sin(po.getX(i) * 2.2) * 0.04 + Math.sin(po.getY(i) * 3) * 0.03);
    po.needsUpdate = true; dr.geometry.computeVertexNormals();
    dr.rotation.y = Math.PI / 2; dr.position.set(0, 1.65, 0); dr.castShadow = true; g.add(dr);
    for (let k = 0; k < 7; k++) g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 4), FERN(), 0, 2.38, -len / 2 + 0.3 + k * (len - 0.6) / 6));
    addCap(x, z - len / 2, x, z + len / 2, 0.22, 2.7);
  };
  rame(21.2, -1.8, 3.4, tons[0]); rame(21.2, 1.9, 3.4, tons[1]); rame(22.6, 0.1, 3.4, tons[2]);
  // la cuve de teinture et son foyer, la pile de bois, les écheveaux
  { const CX2 = 20.6, CZ2 = -5.4;
    scene.add(mesh(new THREE.CylinderGeometry(0.75, 0.68, 0.95, 14), PIERV(1.5, 0.95, { color: 0x8a7f6c }), CX2, 0.55, CZ2));
    scene.add(mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.06, 14), UNI(0x2a3a6a, { roughness: 0.2, metalness: 0.15 }), CX2, 1.0, CZ2));
    for (let k = 0; k < 5; k++) { const a = k * TAU / 5; scene.add(mesh(boxG(0.16, 0.5, 0.16), PIERV(0.2, 0.5, { color: 0x7a7060 }), CX2 + Math.cos(a) * 0.78, 0.25, CZ2 + Math.sin(a) * 0.78)); }
    scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), CHENE(0.1, 1.6, { color: 0x7a5a38 }), CX2 + 0.3, 1.5, CZ2).rotateZ(0.4));
    addCap(CX2, CZ2, CX2, CZ2, 0.85, 1.1);
    tache(ctx, CX2, CZ2 + 1.2, 1.7, 0x3a4060, 0.45);
    flaque(ctx, CX2 - 1.1, CZ2 + 1.5, 0.5); }
  tasBuches(ctx, 22.4, -6.4, Math.PI / 2, 2.0, 0.95);
  { const pa = panier(0.42, 0.45); pa.position.set(19.9, 0, -3.1); scene.add(pa);
    for (let k = 0; k < 5; k++) { const e = mesh(new THREE.TorusGeometry(0.11, 0.05, 6, 10), ETOFFE(0.3, 0.3, { color: tons[k % 4] }), rand(-0.12, 0.12), 0.46, rand(-0.12, 0.12));
      e.rotation.x = rand(0, 1); pa.add(e); } }
  { const p = mesh(boxG(0.14, 2.3, 0.14), CHENE(0.2, 2.3, { color: 0x6a5238 }), 19.6, 1.15, 0.6); scene.add(p);
    const ens = enseignePeinte('SÉCHOIR', 'drap', 1.5, 0.82, { simple: true });
    ens.position.set(19.6, 2.0, 0.6); ens.rotation.y = -Math.PI / 2; scene.add(ens);
    ctx.addCap(19.6, 0.6, 19.6, 0.6, 0.2, 2.4); }
  tache(ctx, 21.4, -1.0, 4.0, 0x83745c, 0.4);
}

// ---------------------------------------------------------------------
//  Le marché
// ---------------------------------------------------------------------
// Quatre tables sous des parasols ne font pas un marché. Ce qui le fait : deux
// RANGS qui se font face de part et d'autre de la rue, des métiers différents d'un
// étal à l'autre, de la marchandise en quantité, des cageots par terre, et de la
// paille partout — un marché est un endroit sale.
const ETALS = {
  legumes:  { toile: 0x3f7a4a, texte: 'LÉGUMES',  embleme: 'gaufre' },
  poisson:  { toile: 0x2a6a9a, texte: 'MARÉE',    embleme: 'poisson' },
  fromage:  { toile: 0xd9b45c, texte: 'BEURRE',   embleme: 'gaufre' },
  volaille: { toile: 0x8c5a2a, texte: 'VOLAILLE', embleme: 'gaufre' },
  gaufres:  { toile: 0xc23a3a, texte: 'GAUFRES',  embleme: 'gaufre' },
  poterie:  { toile: 0x6a5a8a, texte: 'POTERIE',  embleme: 'gaufre' },
};
function etalMarche(ctx, x, z, yaw, type) {
  const { scene, addCap } = ctx;
  const D = ETALS[type], L = 2.9, cs = Math.cos(yaw), sn = Math.sin(yaw);
  const P = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; scene.add(g);
  const bois = BOIS(L, 0.9, { color: 0xa88a5e }), mon = CHENE(0.15, 2.5, { color: 0x6a5238 });
  // tréteaux et plateau
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = mesh(boxG(0.09, 0.95, 0.09), mon, sx * (L / 2 - 0.35), 0.47, sz * 0.3);
    p.rotation.z = sx * -0.12; p.rotation.x = sz * 0.1; g.add(p);
  }
  for (const sx of [-1, 1]) g.add(mesh(boxG(0.08, 0.08, 0.8), mon, sx * (L / 2 - 0.35), 0.7, 0));
  g.add(mesh(boxG(L, 0.08, 0.92), bois, 0, 0.98, 0.08));
  g.add(mesh(boxG(L, 0.07, 0.06), bois, 0, 1.05, 0.55));
  // montants, sablières et toile rayée
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(boxG(0.08, 2.5, 0.08), mon, sx * (L / 2 - 0.04), 1.25, sz * 0.58));
    addCap(...P(sx * (L / 2 - 0.04), sz * 0.58), ...P(sx * (L / 2 - 0.04), sz * 0.58), 0.1, 2.5);
  }
  for (const sz of [-1, 1]) g.add(mesh(boxG(L, 0.09, 0.09), mon, 0, 2.44, sz * 0.58));
  { const t = makeToile(L + 0.35, 1.5, D.toile, 6, 0.18); t.position.set(0, 2.62, 0.1); g.add(t); }
  for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5), FERN(), sx * (L / 2 - 0.04), 2.1, 0.86).rotateZ(sx * -0.45));
  // étagère de fond et petite enseigne peinte pendue à la sablière
  g.add(mesh(boxG(L - 0.3, 0.06, 0.22), bois, 0, 1.52, -0.44));
  for (const sx of [-1, 1]) g.add(mesh(boxG(0.07, 0.6, 0.07), mon, sx * (L / 2 - 0.3), 1.25, -0.44));
  { const e = enseignePeinte(D.texte, D.embleme, 1.05, 0.52, { simple: true });
    e.position.set(-L * 0.28, 2.16, 0.62); g.add(e);
    for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 4), FERN(), -L * 0.28 + sx * 0.42, 2.4, 0.62)); }
  garnirEtal(g, type, L);
  // cageots et paniers sous la table, du côté du marchand
  for (let k = 0; k < 3; k++) { const c = cageot(0.52, 0.34, 0.38); c.position.set(-L / 2 + 0.45 + k * 0.62, 0.17 + (k === 1 ? 0.34 : 0), -0.5); c.rotation.y = rand(-0.2, 0.2); g.add(c); }
  addCap(...P(-L / 2, 0.1), ...P(L / 2, 0.1), 0.55, 1.15);
  return g;
}
function garnirEtal(g, type, L) {
  const pose = (n, y, z, f) => { for (let k = 0; k < n; k++) f(-L / 2 + 0.32 + k * (L - 0.64) / Math.max(1, n - 1), y, z, k); };
  if (type === 'legumes') {
    pose(6, 1.12, 0.22, (x) => { const c = mesh(sphG(0.17, 8), UNI(0x7f9a4a), x, 1.14, rand(0.05, 0.35)); c.scale.set(1, 0.78, 1); g.add(c); });
    pose(4, 1.6, -0.44, (x) => { const c = mesh(sphG(0.13, 7), UNI(0xc9a03c), x, 1.62, -0.44); c.scale.set(1, 0.85, 1); g.add(c); });
    { const pa = panier(0.3, 0.3); pa.position.set(L / 2 - 0.4, 1.06, 0.18); g.add(pa);
      for (let k = 0; k < 7; k++) pa.add(mesh(new THREE.ConeGeometry(0.045, 0.3, 5), UNI(0xd97a2a), rand(-0.14, 0.14), 0.3, rand(-0.14, 0.14)).rotateZ(rand(-0.5, 0.5))); }
    for (let k = 0; k < 5; k++) g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.6, 6), UNI(0xcfe0a0), -L / 2 + 0.5 + k * 0.1, 1.28, -0.2).rotateZ(0.9 + k * 0.05));
  } else if (type === 'poisson') {
    g.add(mesh(boxG(L - 0.2, 0.06, 0.8), UNI(0xc9b478), 0, 1.05, 0.1));
    pose(7, 1.12, 0.1, (x, y, z, k) => { const f = mesh(sphG(0.15, 8), UNI(0xa8b4bc, { roughness: 0.35, metalness: 0.25 }), x, 1.12, 0.06 + (k % 2) * 0.3);
      f.scale.set(1.45, 0.42, 0.75); f.rotation.y = rand(-0.4, 0.4); g.add(f);
      g.add(mesh(new THREE.ConeGeometry(0.11, 0.18, 4), UNI(0x93a0aa, { roughness: 0.4 }), x - 0.22, 1.12, 0.06 + (k % 2) * 0.3).rotateZ(Math.PI / 2)); });
    for (let k = 0; k < 4; k++) {                               // harengs pendus à sécher sous la toile
      const d = mesh(sphG(0.1, 7), UNI(0x9aa6ae, { roughness: 0.4 }), -0.6 + k * 0.4, 2.26, 0.2);
      d.scale.set(0.7, 1.5, 0.45); g.add(d);
      g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), UNI(0x8a7a5a), -0.6 + k * 0.4, 2.46, 0.2));
    }
    { const t = tonneau(0.32, 0.6, 0x6a5238); t.position.set(L / 2 + 0.05, 0, 0.55); g.add(t);
      g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), UNI(0x5a6a6a, { roughness: 0.2, metalness: 0.3 }), L / 2 + 0.05, 0.58, 0.55)); }
  } else if (type === 'fromage') {
    pose(3, 1.1, 0.16, (x, y, z, k) => { for (let i = 0; i <= (k % 2); i++)
      g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.13, 14), UNI(0xe0c878, { roughness: 0.6 }), x, 1.09 + i * 0.14, 0.16)); });
    pose(4, 1.6, -0.44, (x) => g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12), UNI(0xf0e2b0, { roughness: 0.55 }), x, 1.6, -0.44)));
    g.add(mesh(sphG(0.2, 9), UNI(0xf6e9b8, { roughness: 0.5 }), L / 2 - 0.45, 1.12, 0.35));
    { const p = cruche(0.42, 0x8d6a4a); p.position.set(-L / 2 + 0.3, 1.02, 0.4); g.add(p); }
  } else if (type === 'volaille') {
    for (let k = 0; k < 2; k++) { const c = cageot(0.66, 0.5, 0.5, 0x8a6a3e); c.position.set(-L / 2 + 0.5 + k * 0.78, 1.28, 0.1); g.add(c);
      for (let i = 0; i < 3; i++) c.add(mesh(sphG(0.11, 7), UNI([0xd8cdb4, 0x8a6a4a, 0xcfc0a0][i]), rand(-0.15, 0.15), 0.18, rand(-0.12, 0.12))); }
    for (let k = 0; k < 4; k++) { const v = mesh(sphG(0.12, 8), UNI(0xd9c8a8), 0.45 + k * 0.33, 2.15, 0.15);
      v.scale.set(0.8, 1.5, 0.8); g.add(v);
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4), UNI(0x8a7a5a), 0.45 + k * 0.33, 2.36, 0.15)); }
    { const pa = panier(0.28, 0.24); pa.position.set(L / 2 - 0.4, 1.04, 0.3); g.add(pa);
      for (let k = 0; k < 6; k++) pa.add(mesh(sphG(0.055, 7), UNI(0xf2e6cc), rand(-0.13, 0.13), 0.26, rand(-0.13, 0.13))); }
  } else if (type === 'gaufres') {
    // la gaufre qui soigne : il fallait bien qu'on la voie cuire quelque part
    g.add(mesh(boxG(0.8, 0.18, 0.66), PIERV(0.8, 0.66, { color: 0x6f645a }), -L / 2 + 0.55, 1.1, 0.18));
    g.add(mesh(boxG(0.66, 0.05, 0.54), new THREE.MeshStandardMaterial({ color: 0xff7a28, emissive: 0xff5a14, emissiveIntensity: 1.1, roughness: 0.8 }), -L / 2 + 0.55, 1.2, 0.18));
    g.add(mesh(boxG(0.44, 0.06, 0.4), FERN(), -L / 2 + 0.55, 1.26, 0.18));
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), FERN(), -L / 2 + 0.3, 1.3, 0.42).rotateY(0.5));
    for (let k = 0; k < 9; k++) {                               // trois piles de gaufres tièdes
      const px = L / 2 - 0.95 + Math.floor(k / 3) * 0.42;
      g.add(mesh(boxG(0.3, 0.04, 0.24), UNI(0xd9a24a, { roughness: 0.72 }), px, 1.06 + (k % 3) * 0.045, 0.22).rotateY(rand(-0.15, 0.15)));
    }
    g.add(mesh(boxG(0.44, 0.03, 0.34), UNI(0xf0e4c4), L / 2 - 0.55, 1.03, 0.22));
  } else if (type === 'poterie') {
    pose(4, 1.05, 0.2, (x, y, z, k) => { const c = cruche(0.3 + (k % 3) * 0.1, [0x8d6a4a, 0x6a5a4a, 0xa07a54][k % 3]); c.position.set(x, 1.04, 0.2); g.add(c); });
    pose(5, 1.56, -0.44, (x, y, z, k) => { const c = cruche(0.22, [0x7a6a52, 0x8d6a4a][k % 2], false); c.position.set(x, 1.56, -0.44); g.add(c); });
    for (let k = 0; k < 3; k++) { const c = cruche(0.5 + k * 0.12, [0x6a5a4a, 0x8d6a4a, 0x9a7a5c][k]); c.position.set(-L / 2 + 0.3 + k * 0.5, 0, 0.75); g.add(c); }
  }
}

// ---------------------------------------------------------------------
//  Le linge, la paille, l'abri du poids public
// ---------------------------------------------------------------------
// Une corde tendue d'une façade à l'autre, et le bourg est habité. La corde suit
// une vraie chaînette (flèche ≈ 9 % de la portée) : tendue droite, elle a l'air
// d'un fil de fer. Deux pièces sur trois portent le drapeau « flag » — le crochet
// d'animation de game.js — pour que tout ne soit pas figé.
function linge(ctx, x0, z0, x1, z1, y, n = 6) {
  const { scene } = ctx;
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), fleche = Math.min(1.3, len * 0.09);
  const pts = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector3(x0 + dx * t, y - fleche * 4 * t * (1 - t), z0 + dz * t)); }
  const courbe = new THREE.CatmullRomCurve3(pts);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(courbe, 26, 0.022, 5, false), UNI(0xcbbb9b)));
  const cols = [0xf2eee2, 0xe6dfcc, 0xa3b6c8, 0xc9a898, 0xdcd6c4, 0x93a893, 0xe8d0b0];
  for (let k = 0; k < n; k++) {
    const t = (k + 0.75) / (n + 0.5), p = courbe.getPointAt(t), d = courbe.getTangentAt(t);
    const w = rand(0.42, 0.72), h = rand(0.6, 1.15);
    const geo = new THREE.PlaneGeometry(w, h, 3, 4).translate(0, -h / 2, 0);
    const po = geo.attributes.position;
    for (let i = 0; i < po.count; i++) po.setZ(i, Math.sin(po.getX(i) * 4.2 + k) * 0.07 * (1 + po.getY(i) / h));
    po.needsUpdate = true; geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, UNI(cols[(k * 3 + Math.round(Math.abs(x0))) % cols.length], { side: THREE.DoubleSide, roughness: 1 }));
    m.position.copy(p); m.rotation.y = Math.atan2(-d.z, d.x); m.castShadow = true;
    // Une pièce sur deux porte « flag » : le crochet l'anime, mais il la sort aussi de
    // la fusion des statiques — donc un appel de rendu chacune. Les pinces ont été
    // supprimées pour la même raison : fusionnées, elles seraient restées en l'air
    // pendant que la pièce tourne.
    if (k % 2 === 0) m.userData.flag = true;
    scene.add(m);
  }
}
// Paille, épluchures, feuilles de chou : un marché est un endroit sale, et c'est
// cette saleté-là qui fait la différence avec une esplanade.
function paille(ctx, cx, cz, r, n) {
  const geo = new THREE.PlaneGeometry(0.34, 0.07).rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, UNI(0xc9b06e, { side: THREE.DoubleSide, roughness: 1 }), n);
  const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), Pv = new THREE.Vector3(), Sv = new THREE.Vector3(), Eu = new THREE.Euler(), Cl = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const a = rand(0, TAU), d = Math.sqrt(Math.random()) * r;
    Pv.set(cx + Math.cos(a) * d, 0.052, cz + Math.sin(a) * d);
    Qt.setFromEuler(Eu.set(0, rand(0, TAU), 0)); Sv.set(rand(0.6, 1.5), 1, rand(0.7, 1.3));
    im.setColorAt(k, Cl.setHSL(0.12 + rand(-0.03, 0.03), rand(0.25, 0.45), rand(0.4, 0.62)));
    im.setMatrixAt(k, M4.compose(Pv, Qt, Sv));
  }
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.receiveShadow = true; im.renderOrder = 2; ctx.scene.add(im);
}
// Le poids public : on y pèse ce qui se vend au poids, et c'est l'autorité de la
// ville qui tient la balance. Un abri, un fléau, une pile de poids de fonte.
function poidsPublic(ctx, x, z) {
  const { scene, addCap } = ctx;
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const mon = CHENE(0.2, 2.6, { color: 0x6a5238 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(boxG(0.19, 2.6, 0.19), mon, sx * 1.35, 1.3, sz * 1.1));
    g.add(mesh(boxG(0.3, 0.14, 0.3), PIERV(0.3, 0.2, { color: 0xbcb19b }), sx * 1.35, 0.07, sz * 1.1));
    addCap(x + sx * 1.35, z + sz * 1.1, x + sx * 1.35, z + sz * 1.1, 0.17, 2.7);
  }
  for (const sz of [-1, 1]) g.add(mesh(boxG(3.0, 0.18, 0.18), mon, 0, 2.66, sz * 1.1));
  g.add(mesh(boxG(0.18, 0.18, 2.4), mon, 0, 2.66, 0));
  { const t = mesh(new THREE.ConeGeometry(2.25, 0.95, 4), TUILV(2.2, 1.0, { color: 0x9c5230 }), 0, 3.24, 0); t.rotateY(Math.PI / 4); t.scale.set(1, 1, 0.82); g.add(t); }
  // le fléau, ses deux plateaux et le contrepoids
  { const b = new THREE.Group(); b.position.set(0, 2.5, 0); g.add(b);
    b.add(mesh(boxG(2.1, 0.09, 0.09), FERN(), 0, 0, 0));
    b.add(mesh(new THREE.ConeGeometry(0.12, 0.28, 4), FERN(), 0, 0.14, 0));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) b.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4), FERN(), sx * 0.95 + sz * 0.16, -0.45, sz * 0.16).rotateZ(sz * 0.06));
      const pl = mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.06, 14), FERN(), sx * 0.95, -0.9, 0); b.add(pl);
    }
    b.add(mesh(sphG(0.13, 8), FERN(), 0.95, -0.82, 0)); }
  { const s = mesh(boxG(0.9, 0.5, 0.7), PIERV(0.9, 0.5, { color: 0xb5aa94 }), -0.95, 0.25, 0.55); g.add(s);
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.CylinderGeometry(0.11 - k * 0.015, 0.13 - k * 0.015, 0.14, 8), FERN(), -1.25 + k * 0.2, 0.57, 0.55));
    addCap(x - 0.95, z + 0.55, x - 0.95, z + 0.55, 0.55, 0.62); }
  { const e = enseignePeinte('POIDS DE VILLE', 'balance', 1.55, 0.8, { simple: true });
    e.position.set(0, 1.95, 1.16); g.add(e); }
  tache(ctx, x, z, 2.6, 0x7d6f58, 0.4);
}

// ---------------------------------------------------------------------
//  Ce qui traîne : le reste de la vie du bourg
// ---------------------------------------------------------------------
// Chez le boulanger : ce qui entre (la farine, le bois) et ce qui sort (le pain qui
// refroidit dehors, sur la claie). Les sacs et la claie débordent sur la chaussée —
// c'est exactement ce que faisaient les boutiques, et c'est ce qui rétrécit la rue.
function kitBoulanger(ctx, hx, hz) {
  const { scene, addCap } = ctx;                         // hz = plan de façade ; la rue est en -z
  for (const [x, z, r, h, couche] of [[hx - 3.35, hz - 0.5, 0.3, 0.52, 0], [hx - 3.8, hz - 0.62, 0.3, 0.52, 0], [hx - 3.55, hz - 0.95, 0.28, 0.48, 1]]) {
    const s = sac(r, h); s.position.set(x, couche ? 0.52 : 0, z); if (couche) s.rotation.z = 1.55; scene.add(s);
  }
  addCap(hx - 3.85, hz - 0.66, hx - 3.3, hz - 0.58, 0.35, 0.62);
  { const p = new THREE.Group(); p.position.set(hx + 3.35, 0, hz - 0.22); p.rotation.z = 0.26; p.rotation.y = 0.35; scene.add(p);
    p.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.6, 6), BOIS(0.1, 2.6, { color: 0xb59a6e }), 0, 1.3, 0));
    p.add(mesh(boxG(0.44, 0.04, 0.5), BOIS(0.44, 0.5, { color: 0xc0a478 }), 0, 2.72, 0)); }
  { const c = new THREE.Group(); c.position.set(hx + 0.9, 0, hz - 0.92); scene.add(c);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(mesh(boxG(0.07, 0.95, 0.07), CHENE(0.1, 0.95, { color: 0x6a5238 }), sx * 0.62, 0.47, sz * 0.2));
    c.add(mesh(boxG(1.5, 0.06, 0.58), BOIS(1.5, 0.58, { color: 0xa9885e }), 0, 0.97, 0));
    for (let k = 0; k < 4; k++) { const p = mesh(sphG(0.16, 8), UNI(0xb07a3c, { roughness: 0.85 }), -0.52 + k * 0.35, 1.08, rand(-0.09, 0.09));
      p.scale.set(1.35, 0.6, 0.9); p.rotation.y = rand(0, 1); c.add(p); }
    addCap(hx + 0.3, hz - 0.92, hx + 1.5, hz - 0.92, 0.3, 1.05); }
  grattoir(ctx, hx - 1.2, hz - 0.45, Math.PI);
  anneauMur(ctx, hx + 2.6, 1.45, hz - 0.04, Math.PI);
  tache(ctx, hx - 3.4, hz - 0.9, 1.6, 0xe8e0c8, 0.5);
  { const b = mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.35, 5), BOIS(0.08, 1.35, { color: 0xa98a60 }), hx - 2.95, 0.68, hz - 0.25);
    b.rotation.z = -0.3; scene.add(b);
    scene.add(mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.45, 8), UNI(0xc2a86a), hx - 2.75, 1.3, hz - 0.25)); }   // le balai
}
// Chez le brasseur : tout est lourd, tout roule, et tout mouille. Les tonneaux et la
// trappe de cave sont sur la chaussée parce que c'est par là qu'on livre.
function kitBrasseur(ctx, hx, hz) {
  const { scene, addCap } = ctx;                         // hz = plan de façade ; la rue est en +z
  for (const [x, z] of [[hx + 3.0, hz + 0.78], [hx + 3.75, hz + 0.85], [hx + 3.35, hz + 1.42]]) {
    const t = tonneau(0.36, 0.78); t.position.set(x, 0, z); scene.add(t);
    addCap(x, z, x, z, 0.4, 0.85);
  }
  { const x = hx + 4.6, z = hz + 0.95;
    const t = tonneau(0.34, 0.74); t.position.set(x, 0.38, z); t.rotation.z = Math.PI / 2; scene.add(t);
    for (const sx of [-1, 1]) scene.add(mesh(boxG(0.12, 0.44, 0.72), CHENE(0.2, 0.44, { color: 0x6a5238 }), x + sx * 0.3, 0.21, z));
    addCap(x - 0.36, z, x + 0.36, z, 0.42, 0.82); }
  for (const [x, z] of [[hx - 2.75, hz + 0.72], [hx - 3.15, hz + 1.02]]) { const s = sac(0.32, 0.56, 0xbaa87c); s.position.set(x, 0, z); scene.add(s); }
  addCap(hx - 3.15, hz + 1.02, hx - 2.75, hz + 0.72, 0.34, 0.62);
  { const g = new THREE.Group(); g.position.set(hx + 0.35, 0, hz + 1.1); scene.add(g);     // trappe de cave et rampe (à plat : aucune collision)
    g.add(mesh(boxG(1.5, 0.12, 1.1), PIERV(1.5, 1.1, { color: 0x8e8574 }), 0, 0.06, 0));
    g.add(mesh(boxG(1.3, 0.08, 0.9), UNI(0x2a211a, { roughness: 1 }), 0, 0.1, 0));
    for (const sx of [-1, 1]) { const r = mesh(boxG(1.7, 0.09, 0.26), BOIS(1.7, 0.3, { color: 0x8a6a46 }), sx * 0.1, 0.32, sx * 0.3); r.rotation.z = -0.3 * sx; g.add(r); }
    const v = mesh(boxG(1.35, 0.09, 0.95), CHENE(1.35, 0.95, { color: 0x5a4430 }), -0.1, 0.64, 0.58); v.rotation.x = 1.15; g.add(v); }
  flaque(ctx, hx + 1.5, hz + 2.3, 0.55); flaque(ctx, hx + 3.2, hz + 2.2, 0.4);
  tache(ctx, hx + 2.6, hz + 1.2, 2.1, 0x6f6048, 0.45);
  anneauMur(ctx, hx - 2.0, 1.45, hz + 0.04, 0);
  anneauMur(ctx, hx + 2.0, 1.45, hz + 0.04, 0);
}

// Le chantier de la chapelle : un tas de sable, du mortier, des tuiles de rechange
// et une échelle. Une ville qui n'entretient rien n'a pas l'air habitée non plus.
function chantierChapelle(ctx) {
  const { scene, addCap } = ctx;
  const CX2 = -6.8, CZ2 = -18.6;
  tasCone(ctx, CX2, CZ2, 1.15, 0.8, 0xc9b48a);
  tasTuiles(ctx, CX2 + 2.2, CZ2 + 0.6, 0.4);
  { const b = mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.55, 12), CHENE(1.1, 0.55, { color: 0x6a5238 }), CX2 + 1.5, 0.27, CZ2 - 1.5); scene.add(b);
    scene.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12), UNI(0xcfc9b8, { roughness: 0.95 }), CX2 + 1.5, 0.52, CZ2 - 1.5));
    scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5), BOIS(0.08, 1.5, { color: 0xa98a60 }), CX2 + 1.65, 1.05, CZ2 - 1.5).rotateZ(0.35));
    addCap(CX2 + 1.5, CZ2 - 1.5, CX2 + 1.5, CZ2 - 1.5, 0.6, 0.6); }
  { const e = echelle(3.6); e.position.set(CX2 + 3.4, 0, CZ2 - 2.4); e.rotation.y = 0.5; e.rotation.x = 0.18; scene.add(e); }
  for (const [dx, dz] of [[-1.5, -1.2], [-1.0, -1.6]]) {
    scene.add(mesh(boxG(0.8, 0.4, 0.5), PIERV(0.8, 0.4, { color: 0xc0b6a0 }), CX2 + dx, 0.2, CZ2 + dz).rotateY(rand(-0.3, 0.3)));
  }
  addCap(CX2 - 1.6, CZ2 - 1.4, CX2 - 0.9, CZ2 - 1.6, 0.45, 0.45);
  { const s = seau(); s.position.set(CX2 + 2.4, 0, CZ2 - 1.9); scene.add(s); }
  tache(ctx, CX2 + 0.6, CZ2 - 0.6, 3.0, 0xbdb096, 0.45);
}

// ---------------------------------------------------------------------
//  Assemblage
// ---------------------------------------------------------------------
function marche(ctx) {
  const { prop } = ctx;
  // deux rangs qui se font face de part et d'autre de la rue nord-sud : c'est le
  // plan d'un marché, et il laisse la chaussée libre entre les deux.
  etalMarche(ctx, -5.5, -6.7, Math.PI / 2, 'legumes');
  etalMarche(ctx, 5.5, -6.7, -Math.PI / 2, 'poisson');
  etalMarche(ctx, -5.5, 6.7, Math.PI / 2, 'fromage');
  etalMarche(ctx, 5.5, 6.7, -Math.PI / 2, 'volaille');
  etalMarche(ctx, -5.3, 10.3, Math.PI / 2, 'gaufres');
  etalMarche(ctx, 5.3, 9.8, -Math.PI / 2, 'poterie');
  poidsPublic(ctx, -5.9, -10.4);
  paille(ctx, 0, -7.2, 6.2, 170); paille(ctx, 0, 7.6, 6.2, 170); paille(ctx, 0, 0, 8.6, 130);
  // marchandise au sol entre les étals
  for (const [x, z, n] of [[-6.4, -8.6, 2], [6.4, -8.5, 2], [-6.4, 8.7, 2], [6.3, 8.0, 2]]) {
    for (let k = 0; k < n; k++) { const c = cageot(0.55, 0.36, 0.42); c.position.set(x + rand(-0.25, 0.25), k * 0.37, z + rand(-0.25, 0.25)); c.rotation.y = rand(0, TAU); ctx.scene.add(c); }
    ctx.addCap(x, z, x, z, 0.45, 0.4);
  }
  for (const [x, z] of [[-7.0, -5.6], [7.0, 5.6]]) { const t = tonneau(0.34, 0.74); t.position.set(x, 0, z); ctx.scene.add(t); ctx.addCap(x, z, x, z, 0.38, 0.8); }
  { const pa = panier(0.38, 0.42); pa.position.set(4.6, 0, -8.8); ctx.scene.add(pa);
    for (let k = 0; k < 6; k++) pa.add(mesh(sphG(0.13, 7), UNI(0x7f9a4a), rand(-0.16, 0.16), 0.42, rand(-0.16, 0.16))); }
  // bannières aux angles de la place, si la banque d'assets est là
  for (const sx of [-1, 1]) { prop('props:Banner_1', sx * 7.6, -8.6, 0); prop('props:Banner_2', sx * 7.6, 8.6, Math.PI); }
  prop('props:Barrel_Apples', -7.4, -7.9, 0.4, 0.4);
  prop('props:Barrel', 7.45, 7.9, -0.2, 0.4);
  prop('props:Crate_Wooden', 7.4, -7.7, 0.6, 0.5);
  prop('props:FarmCrate_Apple', -7.35, 7.7, 0.2, 0.4);
  prop('props:FarmCrate_Carrot', -6.95, 8.35, -0.3, 0.4);
}
// Tout ce qui ne relève pas d'un commerce en particulier : le linge au-dessus de la
// rue, les chasse-roues aux angles, les ornières, les flaques, l'échelle oubliée.
function divers(ctx, RUE) {
  const { scene, addCap } = ctx;
  const ZN = -RUE - 0.4, ZS = RUE + 0.4;                  // plans de façade nord et sud de la grand-rue
  linge(ctx, -16.5, ZN + 0.1, -16.5, ZS - 0.1, 5.35, 7);
  linge(ctx, -8.15, ZN + 0.1, -8.15, ZS - 0.1, 5.6, 6);
  linge(ctx, 16.2, ZN + 0.1, 16.2, ZS - 0.1, 5.2, 7);
  for (const [x, z] of [[-7.4, -4.55], [-7.85, 4.55], [7.85, -4.55], [7.5, 4.55], [-21.6, -2.95], [-21.6, 2.95], [14.45, 4.55], [-14.4, -4.55]]) chasseRoue(ctx, x, z);
  ornieres(ctx, -27, 0.25, 17.5, 0.25, 1.05);
  ornieres(ctx, 0.3, -17, 0.3, 17, 1.05);
  for (const [x, z, r] of [[-1.8, 3.95, 0.6], [2.6, -3.85, 0.45], [-18.4, 0.8, 0.55], [14.2, 1.3, 0.5], [-22.5, -0.6, 0.7], [4.4, -1.3, 0.4]]) flaque(ctx, x, z, r);
  { const e = echelle(4.2); e.position.set(-15.0, 0, ZN + 0.62); e.rotation.x = -0.16; scene.add(e); }   // appuyée contre la façade, donc DEVANT elle
  { const r = roueCharrette(0.62); r.position.set(14.6, 0.64, ZN + 0.42); r.rotation.z = 0.3; scene.add(r);
    addCap(14.6, ZN + 0.42, 14.6, ZN + 0.42, 0.35, 1.2); }
  for (const [x, z] of [[-2.6, 3.7], [3.1, -3.6]]) { const s = seau(); s.position.set(x, 0, z); scene.add(s); }
  tasBuches(ctx, -16.6, ZS - 0.55, 0, 2.6, 1.2);
  tasBuches(ctx, 15.4, ZN + 0.55, 0, 2.2, 1.0);
  millesime(ctx, -17, 3.8, ZN + 0.04, 0, 'IN DEN ZWAAN — 1648');
  millesime(ctx, 17, 3.8, ZS - 0.04, Math.PI, 'DE DRIE SLEUTELS — 1655');
  // devant la Porte des Flandres : la boue, le crottin et le fagot du corps de garde
  tache(ctx, -22.8, 0, 3.2, 0x6f5f47, 0.5);
  for (let k = 0; k < 3; k++) { const f = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 8), pbrRepeat(T.bark, 1, 1), -21.2, 0.24 + k * 0.42, -3.4 + (k % 2) * 0.5);
    f.rotation.z = Math.PI / 2; f.rotation.y = rand(-0.2, 0.2); scene.add(f);
    for (const sy of [-0.3, 0.3]) scene.add(mesh(new THREE.TorusGeometry(0.23, 0.02, 4, 10), UNI(0x7a6a4a), -21.2 + sy, 0.24 + k * 0.42, -3.4 + (k % 2) * 0.5).rotateY(Math.PI / 2)); }
  addCap(-21.2, -3.6, -21.2, -2.9, 0.4, 1.1);
}
// Le point d'entrée du secteur. Appelé en fin de buildTown.
export function buildVie(ctx) {
  const RUE = ctx.RUE;
  devanture(ctx, { hx: -11, hz: RUE + 3.5 + 0.4, yaw: Math.PI, w: 6, d: 7, metier: 'boulanger' });
  // l'école Lequeuche : là où commence le prologue, Camille face à l'étal (quetes.js)
  { const [x, z] = townWorld(-11, RUE - 1.6), [ex, ez] = townWorld(-8.6, RUE - 1.2);
    const [sx, sz] = townWorld(-13.2, RUE - 0.4);        // l'enseigne, au bout de la façade
    PARTAGE.ecole = { x, z, yaw: TOWN.a, eugene: [ex, ez], enseigne: [sx, TOWN.y + 4.2 * TOWN.s, sz] };
    const [lx, lz] = townWorld(-11, RUE + 3.9); E.addLieu({ id: 'ecole', nom: 'l’école Lequeuche', x: lx, z: lz, r: 12 }); }
  devanture(ctx, { hx: 11, hz: RUE + 3.5 + 0.4, yaw: Math.PI, w: 6.5, d: 7, metier: 'drapier' });
  devanture(ctx, { hx: 10.5, hz: -RUE - 3.5 - 0.4, yaw: 0, w: 5, d: 7, metier: 'brasseur' });
  devanture(ctx, { hx: 9.6, hz: 14, yaw: -Math.PI / 2, w: 6, d: 7, metier: 'forgeron', cotes: [1], objetY: 4.15, sansPlaque: true });
  kitBoulanger(ctx, -11, RUE + 0.4);
  kitBrasseur(ctx, 10.5, -RUE - 0.4);
  forge(ctx);
  sechoirDrapier(ctx);
  marche(ctx);
  chantierChapelle(ctx);
  divers(ctx, RUE);
  // l'estaminet reçoit son enseigne-objet et ses anneaux : il est déjà meublé dehors
  { const eo = emblemeObjet('chope'); eo.position.set(-8.6, 3.55, -RUE - 0.36); ctx.scene.add(eo);
    anneauMur(ctx, -14.0, 1.45, -RUE - 0.44, 0);
    grattoir(ctx, -12.2, -RUE - 0.05, 0); }
}

export function buildTown() {
  const C = cobbles();
  // tout le village est construit en coordonnées locales (centre 0,0, demi-largeur 16) dans un groupe agrandi ×S ;
  // les aides de collision et d'interaction sont redéfinies ici pour convertir en coordonnées monde
  const S = TOWN.s, town = new THREE.Group();
  // le bourg se pose sur le sol relevé et non plus à la cote 0 (cf. calerBourg, carte.js)
  calerBourg();
  town.position.set(TOWN.x, TOWN.y, TOWN.z); town.rotation.y = TOWN.a; town.scale.setScalar(S);
  E.scene.add(town);
  const scene = town;
  // Le bourg est maintenant TOURNÉ (dans l'axe des rues relevées) : aucune conversion
  // local -> monde ne peut plus s'écrire « TOWN.x + x * S ». Tout passe par townWorld().
  const W2 = (x, z) => townWorld(x, z);
  // LE SOCLE DU BOURG. Le sol marchable est à la cote du dallage sur toute la boîte du bourg
  // (levelH, carte.js : TOWN_BOITE), mais on ne dessinait de sol que sous les pavés et leur
  // fondu : sur les bords, Camille marchait 0,5 à 0,8 m au-dessus de l'herbe du quartier
  // (banc arpenteur). Un socle de terre battue couvre toute la boîte, son dessus un
  // centimètre sous les pavés, et ses flancs descendent jusqu'au terrain : là où le relevé
  // est plus bas, on voit une petite marche au lieu d'un sol invisible.
  { const B = TOWN_BOITE, ep = 3;
    const socle = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0, ep, B.z1 - B.z0),
      phMat('rocks_ground_08', (B.x1 - B.x0) * S, (B.z1 - B.z0) * S, { color: 0xd5c4a0, roughness: 1 }));
    socle.position.set((B.x0 + B.x1) / 2, -ep / 2 + 0.02, (B.z0 + B.z1) / 2);
    socle.receiveShadow = true; scene.add(socle); }
  // top est une hauteur LOCALE : elle se compte depuis le dallage du bourg, pas depuis 0
  const addCap = (ax, az, bx, bz, r, top = Infinity) => E.addCap(...W2(ax, az), ...W2(bx, bz), r * S, TOWN.y + top * S);
  // addBox pose une boîte ALIGNÉE sur les axes du monde : sous rotation elle ne veut plus
  // rien dire. On la remplace par une capsule tendue le long du grand axe de la boîte,
  // de rayon la demi-largeur — le stade inscrit dans le rectangle. Les quatre coins ne
  // sont plus couverts, ce qui vaut mieux que de bloquer un mètre de rue en biais.
  const addBox = (x0, x1, z0, z1, top) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hw = (x1 - x0) / 2, hd = (z1 - z0) / 2;
    const r = Math.min(hw, hd), l = Math.max(hw, hd) - r;
    const ux = hw >= hd ? l : 0, uz = hw >= hd ? 0 : l;
    return addCap(cx - ux, cz - uz, cx + ux, cz + uz, r, top);
  };
  const addInteract = (it) => { const [wx, wz] = W2(it.pos.x, it.pos.z);
    return E.addInteract({ ...it, pos: new THREE.Vector3(wx, TOWN.y + it.pos.y * S, wz), r: it.r * S }); };
  const placeHouse = (x, z, yaw, w, d, floors, tint, opts) => { const hgrp = makeFlemishHouse(w, d, floors, tint, opts); hgrp.position.set(x, 0, z); hgrp.rotation.y = yaw; town.add(hgrp);
    const rot = Math.abs(Math.sin(yaw)) > 0.5, hw = rot ? d / 2 : w / 2, hd = rot ? w / 2 : d / 2; addBox(x - hw, x + hw, z - hd, z + hd, hgrp.userData.size.h + 2); return hgrp; };
  const tx = 0, tz = 0, R2 = 16;
  // props externes : le groupe town est agrandi ×S, on compense par scale 1/S
  // pour que les modèles gardent leurs dimensions réelles (règle 3 du brief).
  const prop = (id, x, z, rotY = 0, r = 0, y = 0) => {
    if (!PROPS_OK) return null;
    const o = A.spawn(id, { x, y, z, rotY, scale: 1 / S });
    scene.add(o);
    if (r) addCap(x, z, x, z, r / S);
    return o;
  };

  // sol pavé : rues + place
  // Le groupe « town » est agrandi ×S : une tuile de 0,96 m MONDE vaut 0,96/S en local.
  // Sans cette division les pavés du village sortaient 1,5 fois trop gros (18 cm au lieu de 12).
  const COBBLE_TILE = COBBLE_M / S;
  // Sol du bourg. Le bord suivait le tracé de l'enceinte ; l'enceinte n'existe plus, et
  // le quartier a désormais son propre sol minéral (solVille, carte.js). Il ne reste
  // qu'un disque de terre battue sous la place, pour que l'herbe ne remonte pas entre
  // les pavés et les façades, avec un fondu de quatre mètres sur son pourtour.
  {
    const jitter = (a) => 1.0 * Math.sin(a * 5.3 + 1.1) + 0.65 * Math.sin(a * 11.7) + 0.35 * Math.sin(a * 23.1 + 2.4);
    const RB = 26;                                     // rayon de l'assise, en unités locales
    const plat = (pos, uv, col, idx) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => i % 3 === 1 ? 1 : 0), 3));
      if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
      g.setIndex(idx); return g;
    };
    const nappe = (stops, m, y) => {
      const NA = 96, NR = stops.length, pos = [], uv = [], col = [], idx = [];
      for (let i = 0; i <= NA; i++) {
        const a = i / NA * TAU, j = jitter(a);
        for (let k = 0; k < NR; k++) {
          const r = Math.max(0.2, RB + stops[k][0] + j * (0.35 + k * 0.4));
          const x = Math.cos(a) * r, z = -4 + Math.sin(a) * r;
          pos.push(x, y, z); uv.push(x * S, z * S); col.push(1, 1, 1, stops[k][1]);
        }
      }
      for (let i = 0; i < NA; i++) for (let k = 0; k < NR - 1; k++) {
        const A = i * NR + k, B = (i + 1) * NR + k;
        idx.push(A, B, A + 1, A + 1, B, B + 1);
      }
      const o = new THREE.Mesh(plat(pos, uv, col, idx), m); o.receiveShadow = true; return o;
    };
    const terre = (extra) => phMat('rocks_ground_08', 1, 1, { color: 0xd5c4a0, side: THREE.DoubleSide, ...extra });
    const sol = nappe([[-24, 1], [-2, 1], [1.5, 0.55], [4.5, 0]],
      terre({ transparent: true, depthWrite: false, vertexColors: true }), 0.03);
    sol.renderOrder = 2; scene.add(sol);
  }
  // Chaque nappe de pavés monte d'un demi-millimètre sur la précédente : posées à la même
  // altitude, elles se disputaient le z-buffer et la place virait aux taches bleutées.
  let pavY = 0.040;
  const paved = (x0, z0, w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pbrRepeat(C, w / COBBLE_TILE, d / COBBLE_TILE, { roughness: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.set(tx + x0, pavY += 0.0006, tz + z0); m.receiveShadow = true; scene.add(m); };
  const RUE = 4.4;                       // demi-largeur de la chaussée, en unités locales
  // la grand-rue ne court plus jusqu'à une porte qui n'existe plus : elle se raccorde
  // aux rues relevées du quartier, aux deux bouts
  paved(0, 0, 46, RUE * 2); paved(0, 0, RUE * 1.8, R2 * 2 + 4); paved(0, 0, 18, 18);
  // trottoirs/bordures en pierre le long de la grand-rue
  for (const sz of [-1, 1]) scene.add(mesh(boxG(R2 * 2 + 4, 0.18, 0.4), stoneMat, tx, 0.09, tz + sz * (RUE - 0.3)));
  // maisons de part et d'autre de la grand-rue (façades vers la rue)
  const tints = [0xd08a6a, 0xb8654a, 0xe0c090, 0xf0e6d6, 0xc07060, 0xd9a070];
  // La dernière maison de la rangée n'a que 3,5 de profondeur : elle est adossée au beffroi.
  // Avec ses 7 unités, elle entrait de 2,9 dans le fût — invisible tant qu'il était plein,
  // mais sa collision barrait le colimaçon.
  const north = [[-17, 6, 7, 2, 0], [-11, 6.5, 7, 3, 1], [16, 6, 7, 2, 4], [10.5, 5, 3.5, 3, 5]];
  // i === 1 : l'estaminet. Pas d'auvent de boutique — il masquait la porte — mais des vitres
  // chaudes, une lanterne et une enseigne à potence, pour qu'on voie de loin que ça s'ouvre.
  north.forEach(([x, w, d, fl, t], i) => placeHouse(tx + x, tz - RUE - d / 2 - 0.4, 0, w, d, fl, tints[t], { shutter: [0x3a6a4a, 0x8a2a2a, 0x2a4a7a][i % 3], shop: false, oriel: i === 3, balcony: i === 1 ? 'left' : false, chaud: i === 1, lanterne: i === 1, doorColor: i === 1 ? 0x6e2b28 : undefined }));
  const south = [[-17, 6, 7, 2, 2], [-11, 6, 7, 2, 3], [11, 6.5, 7, 3, 0], [17, 5.5, 7, 2, 1]];
  south.forEach(([x, w, d, fl, t], i) => placeHouse(tx + x, tz + RUE + d / 2 + 0.4, Math.PI, w, d, fl, tints[t], { shutter: [0x8a2a2a, 0x3a6a4a, 0x2a4a7a][i % 3], shop: false, oriel: i === 2, balcony: i === 0 }));
  // maisons le long de la rue nord-sud
  placeHouse(tx - 9.6, tz - 14, Math.PI / 2, 6, 7, 2, tints[4], { shutter: 0x3a6a4a }); placeHouse(tx + 14.6, tz - 14.8, -Math.PI / 2, 6, 7, 2, tints[2], { shutter: 0x8a2a2a });   // reculée à l'est : elle occupait le tiers du fût du beffroi
  placeHouse(tx - 9.6, tz + 14, Math.PI / 2, 6, 7, 3, tints[3], { shutter: 0x2a4a7a, balcony: true }); placeHouse(tx + 9.6, tz + 14, -Math.PI / 2, 6, 7, 2, tints[5], { shutter: 0x2a2a30, shop: false });   // le forgeron : volets de fer, auvent de forge (cf. forge())
  // beffroi (coin nord-est de la place)
  { const bx = tx + 8, bz = tz - 12, BH = 26;
    const bf = new THREE.Group(); bf.position.set(bx, 0, bz); const stoneB = pbr(T.stone, { roughness: 0.85, color: 0xd8d0c0 }), dark = mat(0x10141c);
    // fût aux arêtes arrondies, soubassement mouluré, bandeaux à chaque étage, pilastres d'angle sur les deux derniers niveaux
    // LE FÛT EST CREUX. C'était un bloc plein de 39 m (26 unités × 1,5) : on ne montait pas au
    // beffroi du guetteur. Il est maintenant fait de quatre murs de brique — le mur ouest
    // percé d'une porte : c'est le seul qui donne sur une rue, les maisons de la rangée
    // nord sont adossées aux deux autres — et le colimaçon court dedans. Chaque
    // pan a sa propre brique à l'échelle : un seul matériau étiré sur un trumeau d'un
    // mètre quatre-vingts donnait des briques de quarante centimètres.
    const EPm = 0.45, DH = 2.2, DW = 0.8;       // épaisseur des murs, hauteur et demi-largeur de la porte
    const mur = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(rboxG(w, h, d, 0.12, 2), patinerMat(brickScaled(Math.max(w, d) * S, h * S), { echelle: 24, force: 0.28, humide: 3.5 }));
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; bf.add(m);
    };
    const lp = 2.5 - DW;
    mur(5, BH, EPm, 0, BH / 2, -2.5 + EPm / 2); mur(5, BH, EPm, 0, BH / 2, 2.5 - EPm / 2);
    mur(EPm, BH, 5, 2.5 - EPm / 2, BH / 2, 0);
    mur(EPm, BH, lp, -2.5 + EPm / 2, BH / 2, -(DW + lp / 2)); mur(EPm, BH, lp, -2.5 + EPm / 2, BH / 2, DW + lp / 2);
    mur(EPm, BH - DH, 2 * DW, -2.5 + EPm / 2, DH + (BH - DH) / 2, 0);
    // soubassement, ouvert au droit de la porte ; son listel mouluré, qui aurait barré le
    // passage à hauteur de front, cède la place à un encadrement de pierre
    const soc = (w, d, x, z) => bf.add(mesh(rboxG(w, 1.0, d, 0.12, 2), stoneB, x, 0.5, z));
    soc(6.2, 0.6, 0, -2.8); soc(6.2, 0.6, 0, 2.8); soc(0.6, 5, 2.8, 0);
    soc(0.6, 3.1 - DW, -2.8, -(DW + (3.1 - DW) / 2)); soc(0.6, 3.1 - DW, -2.8, DW + (3.1 - DW) / 2);
    for (const sz of [-1, 1]) bf.add(mesh(boxG(0.75, DH, 0.3), stoneB, -2.55, DH / 2, sz * (DW + 0.15)));
    bf.add(mesh(boxG(0.75, 0.35, 2 * DW + 0.6), stoneB, -2.55, DH + 0.17, 0));
    for (let k = 1; k < 4; k++) corniceAround(bf, 0, k * 6.5, 0, 2.5, 2.5, stoneB, 0.22, 0.22, k === 3 ? 'cyma' : 'torus');
    corniceAround(bf, 0, BH - 0.6, 0, 2.5, 2.5, stoneB, 0.6, 0.5, 'cyma');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const pl = pilaster(BH - 0.6 - 13, 0.26, stoneB); pl.position.set(sx * 2.45, 13, sz * 2.45); bf.add(pl); }
    // cadrans à cadre mouluré, meurtrières en arc, ouvertures en arc de la chambre des cloches
    for (const [dx, dz, ry] of [[0, 2.55, 0], [0, -2.55, Math.PI], [2.55, 0, Math.PI / 2], [-2.55, 0, -Math.PI / 2]]) {
      const fg = new THREE.Group(); fg.position.set(dx * 1.02, BH - 4, dz * 1.02); fg.rotation.y = ry; bf.add(fg);
      fg.add(mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 24), mat(0xf6f0e0, { roughness: 0.6 }), 0, 0, 0).rotateX(Math.PI / 2));
      fg.add(mesh(new THREE.TorusGeometry(1.5, 0.14, 8, 28), stoneB, 0, 0, 0.04)); fg.add(mesh(new THREE.TorusGeometry(1.75, 0.08, 6, 28), stoneB, 0, 0, 0.02));
      fg.add(mesh(boxG(0.1, 1.0, 0.05), mat(0x202020), 0, 0.4, 0.1)); fg.add(mesh(boxG(0.7, 0.1, 0.05), mat(0x202020), 0.3, 0, 0.1));
      for (let k = 0; k < 12; k++) { const a = k * TAU / 12; fg.add(mesh(boxG(0.08, 0.2, 0.04), mat(0x202020), Math.sin(a) * 1.15, Math.cos(a) * 1.15, 0.1)); }
      for (let f = 0; f < 2; f++) { const sl = archWindow(0.6, 1.9, dark, stoneB, { bars: false }); sl.position.set(dx * 1.02, 5.5 + f * 6.5, dz * 1.02); sl.rotation.y = ry; bf.add(sl); }
      const bo = archWindow(1.5, 3.2, dark, stoneB, { bars: false }); bo.position.set(dx * 1.02, 14.2, dz * 1.02); bo.rotation.y = ry; bf.add(bo);
    }
    // terrasse à balustrade, chambre des cloches octogonale à arcades, dôme en bulbe, lanternon, flèche dorée
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const bl = balcony(6.2, 0.35, stoneB, stoneB); bl.position.set(Math.sin(a) * 2.75, BH + 0.1, Math.cos(a) * 2.75); bl.rotation.y = a; bf.add(bl); }
    // Le plancher de la chambre des cloches est une coursive autour du puits, plus un
    // palier sur le quart nord-ouest où débouche l'escalier. Il fallait laisser les trois
    // autres quarts ouverts : avec 3,61 m par tour, la tête de Camille aurait traversé la
    // dalle sur les trois derniers quarts de la montée. La cloche pend au-dessus du vide.
    { const sh = new THREE.Shape();
      sh.moveTo(-2.9, -2.9); sh.lineTo(2.9, -2.9); sh.lineTo(2.9, 2.9); sh.lineTo(-2.9, 2.9); sh.closePath();
      const w = 2.05, trou = new THREE.Path();      // (x, y) de la forme = (x, -z) local
      trou.moveTo(-w, -w); trou.lineTo(w, -w); trou.lineTo(w, w); trou.lineTo(0, w); trou.lineTo(0, 0); trou.lineTo(-w, 0); trou.closePath();
      sh.holes.push(trou);
      const gs = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }); gs.rotateX(-Math.PI / 2);
      const dalle = new THREE.Mesh(gs, stoneB); dalle.position.y = BH; dalle.castShadow = dalle.receiveShadow = true; bf.add(dalle); }
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; const pl = pilaster(4.2, 0.24, stoneB); pl.position.set(Math.sin(a) * 2.35, BH + 0.5, Math.cos(a) * 2.35); bf.add(pl);
      const ar = mesh(new THREE.TorusGeometry(0.85, 0.12, 6, 14, Math.PI), stoneB, Math.sin(a + Math.PI / 8) * 2.2, BH + 3.9, Math.cos(a + Math.PI / 8) * 2.2); ar.rotation.y = a + Math.PI / 8; bf.add(ar); }
    const bell = mesh(new THREE.CylinderGeometry(0.6, 0.9, 1.3, 12), mat(0xb8862a, { metalness: 0.9, roughness: 0.35 }), 0, BH + 2.4, 0); bf.add(bell);
    corniceAround(bf, 0, BH + 4.5, 0, 2.5, 2.5, stoneB, 0.4, 0.35, 'cyma');
    const domeM = mat(0x3b4a5c, { roughness: 0.55, metalness: 0.25 });
    const prof = []; for (let k = 0; k <= 14; k++) { const t = k / 14; prof.push(new THREE.Vector2(2.9 * Math.sin(t * Math.PI * 0.92) * (1 - t * 0.12) + 0.05, t * 4.6)); }
    bf.add(mesh(new THREE.LatheGeometry(prof, 20), domeM, 0, BH + 4.9, 0));
    bf.add(mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.6, 8), stoneB, 0, BH + 10.2, 0)); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; bf.add(mesh(boxG(0.25, 1.0, 0.1), dark, Math.sin(a) * 0.72, BH + 10.2, Math.cos(a) * 0.72).rotateY(a)); }
    bf.add(mesh(new THREE.ConeGeometry(0.9, 1.6, 8), domeM, 0, BH + 11.7, 0)); bf.add(mesh(sphG(0.28, 10), GOLD(), 0, BH + 12.6, 0));
    bf.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), GOLD(), 0, BH + 14, 0)); const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4, 6, 1), mat(0xc22a2a, { side: THREE.DoubleSide })); fl.position.set(bx + 1.1, BH + 14.8, bz); fl.userData.flag = true; scene.add(fl);
    scene.add(bf);
    // ---- collisions du fût : les murs (jusqu'au plancher), le soubassement, la porte libre ----
    for (const [ax, az, cx, cz] of [[-2.5, -2.275, 2.5, -2.275], [-2.5, 2.275, 2.5, 2.275], [2.275, -2.5, 2.275, 2.5],
      [-2.275, -2.5, -2.275, -DW], [-2.275, DW, -2.275, 2.5]]) addCap(bx + ax, bz + az, bx + cx, bz + cz, EPm / 2, BH);
    for (const [ax, az, cx, cz] of [[-2.8, -2.8, 2.8, -2.8], [-2.8, 2.8, 2.8, 2.8], [2.8, -2.8, 2.8, 2.8],
      [-2.8, -2.8, -2.8, -DW - 0.05], [-2.8, DW + 0.05, -2.8, 2.8]]) addCap(bx + ax, bz + az, bx + cx, bz + cz, 0.3, 1.0);
    // ---- le colimaçon, en coordonnées MONDE : addHelix ne connaît pas la rotation du bourg ----
    // Onze tours de 3,61 m : 36 % à mi-rayon, la pente d'un escalier de tour. Il part au
    // pied de la porte (angle local −x) et arrive au même angle, au bord du palier.
    { const [hx, hz] = W2(bx, bz), y0 = TOWN.y, yTop = TOWN.y + (BH + 0.5) * S;
      const TOURS = 11, hTour = (yTop - y0) / TOURS, R0 = 0.5, R1 = 2.9, PAS = 16;
      const a0 = Math.atan2(TOWN.sa, -TOWN.ca);           // direction monde de l'axe local −x (la porte)
      E.addHelix(hx, hz, R0, 3.0, y0, hTour, TOURS, a0, false);
      E.addCap(hx, hz, hx, hz, R0, yTop - 0.1);           // le noyau, jusque sous le plancher
      // les quatre coins du fût sont hors de l'hélice : on y tombait du trentième mètre
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const [cx, cz] = W2(bx + sx * 2.05, bz + sz * 2.05); E.addCap(cx, cz, cx, cz, 0.8, TOWN.y + BH * S);
      }
      const noyau = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, yTop - y0, 12), stoneMat);
      noyau.position.set(hx, (y0 + yTop) / 2, hz); noyau.castShadow = true; E.scene.add(noyau);
      const marches = new THREE.InstancedMesh(new THREE.BoxGeometry(R1 - R0 + 0.1, 0.22, 1.2), pbrRepeat(T.stone, 1, 0.5, { color: 0xb0a89c }), TOURS * PAS + 1);
      const Mx = new THREE.Matrix4(), Qt = new THREE.Quaternion(), Pv = new THREE.Vector3(), Sv = new THREE.Vector3(1, 1, 1), Eu = new THREE.Euler();
      for (let k = 0; k <= TOURS * PAS; k++) {
        const a = a0 + k / PAS * TAU, hh = y0 + k / PAS * hTour;
        Pv.set(hx + Math.cos(a) * (R0 + R1) / 2, hh - 0.11, hz + Math.sin(a) * (R0 + R1) / 2); Qt.setFromEuler(Eu.set(0, -a, 0));
        marches.setMatrixAt(k, Mx.compose(Pv, Qt, Sv));
      }
      marches.castShadow = marches.receiveShadow = true; E.scene.add(marches);
      // Le jour ne descend pas dans un puits de quarante mètres : une lanterne à mi-hauteur
      // et une au sommet, sinon on monte dans le noir complet.
      for (const f of [0.35, 0.8]) { const l = new THREE.PointLight(0xffc98a, 9, 22, 1.4); l.position.set(hx, y0 + (yTop - y0) * f, hz); E.scene.add(l); }
      // ---- le plancher, pour les pieds : coursive + palier (plateformes orientées) ----
      const hP = yTop, seg = (ax, az, cx, cz, w) => { const [pa, pb] = W2(ax, az), [pc, pd] = W2(cx, cz);
        world.platforms.push({ seg: true, ax: pa, az: pb, bx: pc, bz: pd, w: w * S, h: hP }); };
      seg(bx - 2.475, bz - 2.475, bx + 2.475, bz - 2.475, 0.85); seg(bx - 2.475, bz + 2.475, bx + 2.475, bz + 2.475, 0.85);
      seg(bx - 2.475, bz - 2.475, bx - 2.475, bz + 2.475, 0.85); seg(bx + 2.475, bz - 2.475, bx + 2.475, bz + 2.475, 0.85);
      seg(bx - 1.025, bz - 0.5, bx - 1.025, bz - 1.55, 2.05);           // le palier, quart nord-ouest
      // ---- garde-corps : autour du puits (sauf l'arrivée de l'escalier) et au bord de la terrasse ----
      // .bottom sous le plancher : ils n'arrêtent que celui qui est déjà en haut
      const rampe = (ax, az, cx, cz) => { const c = addCap(bx + ax, bz + az, bx + cx, bz + cz, 0.06, BH + 0.5 + 0.75); c.bottom = hP - 0.5;
        const [pa, pb] = W2(bx + ax, bz + az), [pc, pd] = W2(bx + cx, bz + cz), L = Math.hypot(pc - pa, pd - pb);
        const main = mesh(boxG(L, 0.07, 0.07), IRON(), (pa + pc) / 2, hP + 1.05, (pb + pd) / 2); main.rotation.y = -Math.atan2(pd - pb, pc - pa); E.scene.add(main);
        for (let k = 0; k <= Math.ceil(L / 0.9); k++) { const t = k / Math.ceil(L / 0.9); E.scene.add(mesh(boxG(0.05, 1.05, 0.05), IRON(), pa + (pc - pa) * t, hP + 0.52, pb + (pd - pb) * t)); } };
      rampe(0, -2.05, 0, 0); rampe(-2.05, 2.05, 2.05, 2.05); rampe(2.05, -2.05, 2.05, 2.05); rampe(0, -2.05, 2.05, -2.05); rampe(-2.05, 0, -2.05, 2.05);
      for (const [ax, az, cx, cz] of [[-2.9, -2.9, 2.9, -2.9], [-2.9, 2.9, 2.9, 2.9], [-2.9, -2.9, -2.9, 2.9], [2.9, -2.9, 2.9, 2.9]]) {
        const c = addCap(bx + ax, bz + az, bx + cx, bz + cz, 0.12, BH + 0.5 + 0.9); c.bottom = hP - 0.5; }
    }
    // ---- le coffret du guetteur, sur la coursive ouest ----
    { const cf = new THREE.Group(); cf.position.set(bx - 2.45, BH + 0.5, bz - 1.2); cf.rotation.y = Math.PI / 2;
      cf.add(mesh(rboxG(0.55, 0.3, 0.36, 0.03, 2), pbrRepeat(T.plank, 1, 1, { color: 0x7a4e2c }), 0, 0.15, 0));
      cf.add(mesh(rboxG(0.57, 0.08, 0.38, 0.03, 2), pbrRepeat(T.plank, 1, 1, { color: 0x6a4226 }), 0, 0.33, 0));
      for (const sx of [-1, 1]) cf.add(mesh(boxG(0.04, 0.34, 0.39), IRON(), sx * 0.2, 0.17, 0));
      cf.add(mesh(boxG(0.08, 0.1, 0.02), GOLD(), 0, 0.24, 0.19));
      scene.add(cf);
      addInteract({ pos: new THREE.Vector3(bx - 2.45, BH + 0.5, bz - 1.2), r: 1.7,
        prompt: () => (state.carteBeffroi ? 'le coffret est ouvert' : 'ouvrir le coffret'), fn: ATLAS.enigme }); }
    // un petit coffre à écus (bourse.js) sur la coursive est, en face du coffret du guetteur :
    // la récompense de ceux qui font le tour de la chambre des cloches
    { const [px, pz] = W2(bx + 2.45, bz + 1.2), [cx, cz] = W2(bx, bz);
      BOURSE.petitCoffre('beffroi', px, TOWN.y + (BH + 0.5) * S, pz, 20, Math.atan2(cx - px, cz - pz), 0.5); }
    { const [lx, lz] = W2(bx, bz); E.addLieu({ id: 'beffroi', nom: 'le beffroi', x: lx, z: lz, r: 18 }); }
  }
  // ---------- fontaine de la place ----------
  // Refaite : les « lions » étaient quatre sphères posées sur des cylindres, l'eau un disque
  // bleu opaque et les jets des cônes plantés en l'air. Ici : bassin mouluré, vasque haute qui
  // déborde en nappe, quatre mascarons de pierre qui crachent en arc dans le bassin, eau animée.
  { const fx = tx, fz = tz;
    const fstone = phMat('rocks_ground_08', 3 * S, 1.4 * S, { color: 0xd4cbb6 });
    const fmoul = pbr(T.stone, { roughness: 0.78, color: 0xded5c0 });
    const V2 = (x, y) => new THREE.Vector2(x, y);
    // ---- emmarchement et bassin : profil tourné, lèvre en doucine ----
    scene.add(mesh(new THREE.CylinderGeometry(3.75, 3.85, 0.18, 32), fmoul, fx, 0.09, fz));
    scene.add(mesh(new THREE.CylinderGeometry(3.45, 3.6, 0.18, 32), fmoul, fx, 0.26, fz));
    scene.add(mesh(new THREE.LatheGeometry([
      V2(0, 0.18), V2(3.15, 0.18), V2(3.2, 0.42), V2(3.05, 0.55), V2(3.08, 1.02),
      V2(3.3, 1.14), V2(3.3, 1.30), V2(3.05, 1.36), V2(2.72, 1.24), V2(2.72, 0.34), V2(0, 0.34),
    ], 32), fstone, fx, 0, fz));
    // huit refends verticaux sur la cuve : le bassin lisse lisait comme un tube
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8;
      scene.add(mesh(boxG(0.26, 0.82, 0.34), fmoul, fx + Math.cos(a) * 3.12, 0.76, fz + Math.sin(a) * 3.12).rotateY(-a)); }
    // ---- plan d'eau, normale qui dérive (animée dans animate()) ----
    { const W = 128, h = new Float32Array(W * W), a1 = fbm(W, W, 4, 5), a2 = fbm(W, W, 3, 91);
      for (let i = 0; i < W * W; i++) h[i] = a1[i] * 0.58 + a2[i] * 0.42;
      const nm = normalMapFrom(h, W, W, 1.1);
      nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.set(3, 3);
      const eau = mesh(new THREE.CircleGeometry(2.74, 32), new THREE.MeshStandardMaterial({
        color: 0x2e6d93, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.86, normalMap: nm,
      }), fx, 1.04, fz);
      eau.rotation.x = -Math.PI / 2; eau.castShadow = false; eau.userData.dynamic = true;
      scene.add(eau); PARTAGE.fontaineEau = eau; }
    // quelques galets et une piécette au fond
    for (let k = 0; k < 9; k++) { const a = rand(0, TAU), r = rand(0.9, 2.4);
      const gal = mesh(sphG(0.09, 6), mat(k % 3 ? 0x8a867c : 0xb9963f, { roughness: k % 3 ? 0.9 : 0.35, metalness: k % 3 ? 0 : 0.8 }),
        fx + Math.cos(a) * r, 0.4, fz + Math.sin(a) * r);
      gal.scale.set(1, 0.45, 1); scene.add(gal); }
    // ---- pile centrale : base, balustre, vasque haute, urne ----
    scene.add(mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.5, 8), fmoul, fx, 0.55, fz));
    scene.add(mesh(new THREE.LatheGeometry([
      V2(0, 0), V2(0.92, 0), V2(0.96, 0.14), V2(0.72, 0.26), V2(0.58, 0.44), V2(0.44, 0.62),
      V2(0.4, 1.35), V2(0.5, 1.55), V2(0.66, 1.72), V2(0.9, 1.86), V2(1.5, 2.02), V2(1.56, 2.2),
      V2(1.34, 2.24), V2(1.02, 2.1), V2(0, 2.04),
    ], 20), fstone, fx, 0.8, fz));
    for (const y of [1.18, 2.5]) scene.add(mesh(new THREE.TorusGeometry(0.5, 0.1, 8, 20), fmoul, fx, y, fz).rotateX(Math.PI / 2));
    // nappe qui déborde de la vasque : tronc de cône très fin, presque transparent
    scene.add(mesh(new THREE.CylinderGeometry(1.46, 1.2, 0.9, 24, 1, true), new THREE.MeshStandardMaterial({
      color: 0xbfe0f2, transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide }), fx, 2.55, fz));
    scene.add(mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 24), new THREE.MeshStandardMaterial({
      color: 0x4d8fb5, transparent: true, opacity: 0.8, roughness: 0.05 }), fx, 2.94, fz));
    scene.add(mesh(new THREE.LatheGeometry([V2(0, 0), V2(0.3, 0), V2(0.32, 0.12), V2(0.15, 0.24), V2(0.13, 0.46),
      V2(0.36, 0.62), V2(0.42, 0.92), V2(0.32, 1.18), V2(0.13, 1.3), V2(0.15, 1.42), V2(0, 1.52)], 14), fstone, fx, 3.0, fz));
    scene.add(mesh(sphG(0.13, 10), GOLD(), fx, 4.6, fz));
    // ---- quatre mascarons : tête sculptée, gueule de bronze, jet en arc jusqu'au bassin ----
    const bronze = mat(0x8a6a34, { metalness: 0.85, roughness: 0.4 });
    const eauJet = new THREE.MeshStandardMaterial({ color: 0xcfe8f6, transparent: true, opacity: 0.55, roughness: 0.05 });
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + Math.PI / 4, cs = Math.cos(a), sn = Math.sin(a);
      const g2 = new THREE.Group(); g2.position.set(fx + cs * 0.55, 1.95, fz + sn * 0.55); g2.rotation.y = -a; scene.add(g2);
      g2.add(mesh(rboxG(0.62, 0.62, 0.42, 0.14, 3), fmoul, 0, 0, 0.18));                 // face
      g2.add(mesh(rboxG(0.34, 0.26, 0.26, 0.08, 2), fmoul, 0, -0.1, 0.42));              // museau
      for (const sx of [-1, 1]) g2.add(mesh(sphG(0.09, 8), fmoul, sx * 0.17, 0.14, 0.38));  // yeux
      for (const sx of [-1, 1]) g2.add(mesh(new THREE.ConeGeometry(0.12, 0.2, 6), fmoul, sx * 0.26, 0.32, 0.16)); // oreilles
      for (let m = 0; m < 9; m++) { const b = m * TAU / 9;                                 // crinière
        g2.add(mesh(new THREE.ConeGeometry(0.1, 0.26, 5), fmoul, Math.cos(b) * 0.36, Math.sin(b) * 0.36, 0.06).rotateZ(-b + Math.PI / 2)); }
      g2.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 10), bronze, 0, -0.12, 0.54).rotateX(Math.PI / 2));
      // jet : parabole de la gueule vers le bassin, en tube
      const p0 = new THREE.Vector3(0, -0.12, 0.62), p2 = new THREE.Vector3(0, -0.88, 1.85);
      const courbe = new THREE.QuadraticBezierCurve3(p0, new THREE.Vector3(0, 0.12, 1.3), p2);
      const jet = new THREE.Mesh(new THREE.TubeGeometry(courbe, 14, 0.055, 7, false), eauJet); g2.add(jet);
      // écume au point de chute
      g2.add(mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 14), eauJet, 0, -0.9, 1.85).rotateX(Math.PI / 2));
      g2.add(mesh(sphG(0.11, 8), eauJet, 0, -0.86, 1.85));
    }
    // seau de bois accroché à la margelle
    { const a = 2.2, bx = fx + Math.cos(a) * 3.3, bz = fz + Math.sin(a) * 3.3;
      scene.add(mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.42, 12), pbrRepeat(T.plank, 1, 1, { color: 0x8a6440 }), bx, 1.55, bz));
      scene.add(mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 14), FERN(), bx, 1.7, bz).rotateX(Math.PI / 2));
      scene.add(mesh(new THREE.TorusGeometry(0.26, 0.022, 6, 14, Math.PI), FERN(), bx, 1.82, bz)); }
    addCap(fx, fz, fx, fz, 3.35, 3.6); }
  // Les étals du marché sont montés par buildVie() (section « La vie du bourg ») :
  // deux rangs qui se font face le long de la rue nord-sud, un métier par étal, et
  // les props de la banque en complément. L'ancien bloc — quatre tables identiques
  // posées aux quatre coins, plus un repli procédural séparé — a été déposé ici.
  // lanternes de rue
  for (const [x, z] of [[-12, -3.4], [-4, -3.4], [4, 3.4], [12, 3.4], [-3.4, -12], [3.4, 12]]) {
    const lx = tx + x, lz = tz + z; scene.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.6, 8), IRON(), lx, 1.8, lz)); scene.add(mesh(boxG(0.5, 0.6, 0.5), mat(0xffe0a0, { emissive: 0xffc860, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }), lx, 3.7, lz)); scene.add(mesh(new THREE.ConeGeometry(0.45, 0.35, 4), IRON(), lx, 4.15, lz)); addCap(lx, lz, lx, lz, 0.2, 3.5);
  }
  // bancs, tonneaux devant l'estaminet, charrette
  for (const [x, z] of [[-3, -6.5], [3, 6.5]]) { const bx = tx + x, bz = tz + z; scene.add(mesh(boxG(2, 0.12, 0.5), pbrRepeat(T.plank, 1, 1), bx, 0.55, bz)); for (const sx of [-1, 1]) scene.add(mesh(boxG(0.12, 0.5, 0.45), mat(0x4a3320), bx + sx * 0.85, 0.28, bz)); addCap(bx - 0.9, bz, bx + 0.9, bz, 0.35, 1); }
  { const cx = tx - 12, cz = tz - 3.6; const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = Math.PI / 2;
    g.add(mesh(boxG(2.6, 0.6, 1.4), pbrRepeat(T.plank, 2, 1), 0, 0.9, 0)); for (const sx of [-1, 1]) { const wh = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 12), mat(0x4a3320), sx * 0.3, 0.6, 0.8); wh.rotation.x = Math.PI / 2; g.add(wh); const wh2 = wh.clone(); wh2.position.z = -0.8; g.add(wh2); }
    for (let k = 0; k < 6; k++) g.add(mesh(sphG(0.22, 8), mat(0xe8c060), -0.8 + (k % 3) * 0.8, 1.35, -0.3 + Math.floor(k / 3) * 0.6)); g.add(mesh(boxG(0.12, 0.12, 2.2), mat(0x4a3320), 0, 0.7, 2.2)); scene.add(g);
    // capsule le long du brancard au lieu d'un disque de 1,4 : la charrette bouchait la rue
    addCap(cx, cz - 1.2, cx, cz + 1.2, 0.7, 2); }
  // ---------- chapelle Saint-Roch et son cimetière, au bout de la rue nord ----------
  // v28 : la nef passe de 7 × 10 × 5 à 9 × 14 × 6,4 (unités locales, ×1,5 en monde, soit
  // 13,5 × 21 × 9,6 m). C'est la condition de cohérence de l'intérieur : à l'ancienne
  // taille, la nef jouable faisait 9 m de long, moins que la salle de l'estaminet.
  { const cx = tx, cz = tz - 22, NW = 9, ND = 14, NH = 6.4, HN = NW / 2, HD = ND / 2;
    const ch = new THREE.Group(); ch.position.set(cx, 0, cz);
    const wallC = pbrRepeat(T.stone, 3 * S, 2 * S, { color: 0xc8c0b0 }), stoneC = pbr(T.stone, { roughness: 0.85, color: 0xe0d8c8 }), slate = mat(0x3b4a5c, { roughness: 0.7 }), vitrail = mat(0x6a8ab8, { roughness: 0.2, emissive: 0x304060, emissiveIntensity: 0.3 });
    // nef aux arêtes adoucies, soubassement, corniche ; contreforts à glacis entre les fenêtres en arc ; abside semi-circulaire au nord
    const nave = new THREE.Mesh(rboxG(NW, NH, ND, 0.15, 3), wallC); nave.position.y = NH / 2; nave.castShadow = nave.receiveShadow = true; ch.add(nave);
    ch.add(mesh(rboxG(NW + 0.4, 0.5, ND + 0.4, 0.06, 2), stoneC, 0, 0.25, 0)); corniceAround(ch, 0, NH - 0.4, 0, HN, HD, stoneC, 0.4, 0.3, 'cyma');
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const z = -6 + k * 3; const bt = new THREE.Group(); bt.position.set(sx * HN, 0, z);
      bt.add(mesh(boxG(0.8, 4.2, 0.9), wallC, sx * 0.4, 2.1, 0)); bt.add(mesh(boxG(0.6, 1.5, 0.9), wallC, sx * 0.3, 4.95, 0));
      const gl = mesh(new THREE.CylinderGeometry(0.02, 0.55, 0.9, 4), stoneC, sx * 0.6, 4.65, 0); gl.rotation.y = Math.PI / 4; gl.rotation.z = sx * -0.15; bt.add(gl); bt.add(mesh(new THREE.ConeGeometry(0.5, 0.7, 4), stoneC, sx * 0.3, 6.05, 0).rotateY(Math.PI / 4)); ch.add(bt); }
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const wv = archWindow(1.15, 3.1, vitrail, stoneC, { bars: false }); wv.position.set(sx * (HN + 0.06), 1.9, -4.5 + k * 3); wv.rotation.y = sx * Math.PI / 2; ch.add(wv);
      wv.add(mesh(boxG(0.05, 2.5, 0.03), stoneC, 0, 1.25, 0.03)); wv.add(mesh(boxG(1.15, 0.05, 0.03), stoneC, 0, 1.2, 0.03)); }
    const HALF = [18, 1, false, Math.PI / 2, Math.PI]; // moitié nord (z<0)
    const AR = 4.2, AZ = -HD;                          // rayon et centre de l'abside
    const apse = mesh(new THREE.CylinderGeometry(AR, AR, NH - 0.4, ...HALF), wallC, 0, (NH - 0.4) / 2, AZ); ch.add(apse);
    ch.add(mesh(new THREE.CylinderGeometry(AR + 0.2, AR + 0.2, 0.5, ...HALF), stoneC, 0, 0.25, AZ));
    ch.add(mesh(new THREE.CylinderGeometry(AR + 0.3, AR, 0.4, ...HALF), stoneC, 0, NH - 0.2, AZ));
    ch.add(mesh(new THREE.ConeGeometry(AR + 0.5, 3.0, ...HALF), slate, 0, NH + 1.6, AZ)); ch.add(mesh(new THREE.CylinderGeometry(AR + 0.5, AR + 0.5, 0.3, ...HALF), slate, 0, NH + 0.25, AZ));
    for (let k = -1; k <= 1; k++) { const a = Math.PI + k * Math.PI / 3.2; const wv = archWindow(0.85, 2.4, vitrail, stoneC, { bars: false }); wv.position.set(Math.sin(a) * (AR + 0.02), 2.3, AZ + Math.cos(a) * (AR + 0.02)); wv.rotation.y = a; ch.add(wv); }
    // toit à faîtière arrondie et flèche ; façade avec rosace, portail à voussures et pilastres
    const tri = new THREE.Shape(); tri.moveTo(-HN - 0.4, 0); tri.lineTo(HN + 0.4, 0); tri.lineTo(0, 4.2); tri.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: ND + 0.6, bevelEnabled: false }), slate); roof.position.set(0, NH - 0.4, -HD - 0.3); roof.castShadow = true; ch.add(roof);
    ch.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, ND + 0.8, 8), mat(0x2f3d4c), 0, NH + 3.85, 0).rotateX(Math.PI / 2));
    ch.add(mesh(new THREE.CylinderGeometry(0.45, 0.65, 0.6, 8), stoneC, 0, NH + 3.9, 4)); ch.add(mesh(new THREE.ConeGeometry(0.5, 2.4, 8), slate, 0, NH + 5.4, 4)); ch.add(mesh(sphG(0.14, 8), GOLD(), 0, NH + 6.7, 4));
    { const gt = new THREE.Shape(); gt.moveTo(-HN - 0.1, 0); gt.lineTo(HN + 0.1, 0); gt.lineTo(0, 3.9); gt.closePath(); const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(gt, { depth: 0.35, bevelEnabled: false }), wallC); gable.position.set(0, NH - 0.4, HD + 0.15); gable.castShadow = true; ch.add(gable);
      for (const sx of [-1, 1]) ch.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 6.3, 6), stoneC, sx * 2.4, NH + 1.5, HD + 0.5).rotateZ(sx * Math.atan2(HN + 0.1, 3.9))); }
    // rosace de la façade, dans l'axe du portail
    const PX = -1.0;                                              // portail et rosace décalés : le clocher-porche occupe l'est de la façade
    ch.add(mesh(new THREE.TorusGeometry(0.95, 0.15, 8, 24), stoneC, PX, NH + 1.1, HD + 0.36)); ch.add(mesh(new THREE.CircleGeometry(0.92, 24), vitrail, PX, NH + 1.1, HD + 0.35));
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ch.add(mesh(boxG(0.08, 1.7, 0.05), stoneC, PX, NH + 1.1, HD + 0.38).rotateZ(a)); }
    // portail : la vraie porte du jeu (makeDoor), à deux vantaux, sous ses voussures
    { const pg = new THREE.Group(); pg.position.set(PX, 0, HD + 0.05); ch.add(pg);
      // makeDoor dessine en mètres MONDE ; le groupe town est agrandi ×S, on compense par 1/S
      // (même règle que les props du MegaKit), et on demande donc 1,8×S sur 3,0×S.
      const porte = makeDoor(1.8 * S, 3.0 * S, { rustique: true, arc: true, imposte: false, double: true, recess: 0.34 * S, pierre: stoneC, sansCale: true });
      porte.scale.setScalar(1 / S); pg.add(porte);
      for (let k = 0; k < 3; k++) pg.add(mesh(new THREE.TorusGeometry(1.15 + k * 0.24, 0.13, 8, 18, Math.PI), stoneC, 0, 3.15, 0.12 + k * 0.12));
      for (const sx of [-1, 1]) { const pl = pilaster(3.2, 0.2, stoneC); pl.position.set(sx * 1.75, 0, 0.3); pg.add(pl); } pg.add(mesh(rboxG(0.36, 0.55, 0.32, 0.06, 2), stoneC, 0, 4.5, 0.3));
      // emmarchement et parvis
      for (let k = 0; k < 3; k++) pg.add(mesh(new THREE.CylinderGeometry(1.9 - k * 0.12, 1.95 - k * 0.12, 0.14, 20, 1, false, 0, Math.PI), stoneC, 0, 0.07 + k * 0.001, 0.45 + k * 0.3)); }
    // clocher-porche : fût arrondi, bandeaux, abat-sons en arc, flèche octogonale sur corniche, croix
    const tw = new THREE.Group(); tw.position.set(2.9, 0, HD + 0.6); ch.add(tw);
    const tower = new THREE.Mesh(rboxG(2.9, 13, 2.9, 0.22, 3), pbrRepeat(T.stone, 1.5 * S, 5 * S, { color: 0xc8c0b0 })); tower.position.y = 6.5; tower.castShadow = true; tw.add(tower);
    tw.add(mesh(rboxG(3.4, 0.6, 3.4, 0.06, 2), stoneC, 0, 0.3, 0)); corniceAround(tw, 0, 6.2, 0, 1.45, 1.45, stoneC, 0.22, 0.2, 'torus'); corniceAround(tw, 0, 12.6, 0, 1.45, 1.45, stoneC, 0.42, 0.36, 'cyma');
    for (const [dx, dz, ry] of [[0, 1.47, 0], [0, -1.47, Math.PI], [1.47, 0, Math.PI / 2], [-1.47, 0, -Math.PI / 2]]) { const ab = archWindow(0.9, 2.0, mat(0x10141c), stoneC, { bars: false }); ab.position.set(dx, 9.6, dz); ab.rotation.y = ry; tw.add(ab); for (let k = 0; k < 4; k++) { const sl = mesh(boxG(0.8, 0.08, 0.32), stoneC, 0, 0.32 + k * 0.42, 0.1); sl.rotation.x = -0.5; ab.add(sl); } }
    tw.add(mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.4, 8), stoneC, 0, 13.2, 0)); tw.add(mesh(new THREE.ConeGeometry(1.75, 4.4, 8), slate, 0, 15.6, 0));
    tw.add(mesh(boxG(0.15, 1.5, 0.15), GOLD(), 0, 18.6, 0)); tw.add(mesh(boxG(0.85, 0.15, 0.15), GOLD(), 0, 18.9, 0));
    tw.add(mesh(new THREE.CylinderGeometry(0.42, 0.58, 0.85, 10), mat(0xb8862a, { metalness: 0.9, roughness: 0.35 }), 0, 10.2, 0));
    scene.add(ch);
    addBox(cx - HN, cx + HN, cz - HD, cz + HD, NH + 4.5); addBox(cx + 1.45, cx + 4.35, cz + HD - 0.85, cz + HD + 2.05, 20); addCap(cx, cz - HD, cx, cz - HD, AR, NH + 1);
    // entrée : on pousse le portail pour passer dans la nef
    addInteract({ pos: new THREE.Vector3(PX + cx, 0, cz + HD + 2.0), r: 2.3,
      prompt: () => 'entrer dans la chapelle',
      fn: () => goToLevel('chapelle', [-1.5, 0, 9.0], Math.PI, 'Camille pousse le portail de la chapelle…') });
    { const [lx, lz] = W2(cx, cz); E.addLieu({ id: 'chapelle', nom: 'la chapelle Saint-Roch', x: lx, z: lz, r: 26 }); }
    // cimetière : muret, tombes, if — décalé vers l'ouest, la nef ayant gagné 2 unités de large
    const gx = cx - 13, gz = cz;
    for (const [ax, az, bx2, bz2] of [[gx - 5, gz - 5, gx + 4, gz - 5], [gx - 5, gz + 5, gx + 4, gz + 5], [gx - 5, gz - 5, gx - 5, gz + 5]]) { wallBox(ax, az, bx2, bz2, 0.9, 0.4, stoneMat, 0, T.stone); addCap(ax, az, bx2, bz2, 0.25, 0.9); }
    for (let k = 0; k < 8; k++) { const px = gx - 3.5 + (k % 4) * 2.2, pz = gz - 2.5 + Math.floor(k / 4) * 4;
      const st = mesh(boxG(0.9, 1.3, 0.25), pbrRepeat(T.stone, 0.5, 0.7, { color: [0xb0a898, 0x9a9490, 0xa8a0a8][k % 3] }), px, 0.65, pz); st.rotation.y = rand(-0.12, 0.12); st.rotation.z = rand(-0.06, 0.06); scene.add(st);
      scene.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 12, 1, false, 0, Math.PI), pbrRepeat(T.stone, 0.5, 0.5, { color: 0xa8a098 }), px, 1.3, pz).rotateX(Math.PI / 2).rotateY(0));
      scene.add(mesh(boxG(1.1, 0.2, 2.0), stoneMat, px, 0.1, pz + 1.0)); if (k % 3 === 0) scene.add(mesh(boxG(0.1, 0.5, 0.08), IRON(), px, 1.55, pz - 0.1)); if (k % 3 === 0) scene.add(mesh(boxG(0.3, 0.08, 0.08), IRON(), px, 1.65, pz - 0.1));
      addCap(px, pz, px, pz, 0.5, 1.4); }
    const yew = mesh(new THREE.ConeGeometry(1.4, 5, 9), mat(0x2f4f34, { roughness: 1 }), gx + 3, 2.5, gz + 3.5); scene.add(yew); addCap(gx + 3, gz + 3.5, gx + 3, gz + 3.5, 0.6);
    for (let k = 0; k < 6; k++) scene.add(mesh(sphG(0.12, 6), mat([0xffffff, 0xffe066, 0xff6fa0][k % 3]), gx - 3.5 + (k % 4) * 2.2 + rand(-0.3, 0.3), 0.3, gz - 1.5 + Math.floor(k / 4) * 4 + rand(-0.3, 0.3)));
  }
  // villageois (parlent quand on appuie sur Entrée)
  const giveHeart = (who, txt) => ({ who, text: txt, fn: () => { player.maxHp += 2; player.hp = player.maxHp; SFX.win(); burst(player.pos.x, player.pos.y + 1.5, player.pos.z, 0xff5070, 24, 3, 1.2, 2, 1.2); } });
  const lines = [
    ['Aldegonde', () => [{ who: 'Aldegonde', text: state.princeFreed ? "« Eugène est sauvé ! Ce soir, tout le village fête ça sur la place. »" : state.metLyderic ? "« Bienvenue au village, Camille ! Depuis que Phinaert a enlevé Eugène, plus personne n'ose passer le pont. Si tu as besoin de reprendre des forces, Gustave, à l'estaminet, offre des gaufres aux braves. »" : "« Tu es la gardienne de la citadelle, non ? Va vite voir Lydéric, près du pont : il t'attend. »" }]],
    ['Baptiste', () => [{ who: 'Baptiste', text: "« Mes gaufres ? Les meilleures de la région… après celles de chez Méert, bien sûr. Il y en a de cachées un peu partout : elles redonnent deux cœurs. »" }, { who: 'Baptiste', text: "« Et appuie sur J pour ouvrir ton journal : tu y retrouveras tout ce qu'on te demande. »" }]],
    ['Cornélie', () => { const q = questStep('cat');
      if (q >= 3) return [{ who: 'Cornélie', text: "« Pralin ronronne à nouveau près du poêle. Merci mille fois, Camille ! »" }];
      if (q === 2 || (q === 1 && state.catFound) || (q === 0 && state.catFound)) return [{ who: 'Cornélie', text: "« Pralin ! Mon gros chat ! Où l'as-tu trouvé ? Sur des caisses, dans la citadelle ?! »", fn: () => setQuest('cat', 2, true) }, giveHeart('Cornélie', "« Tiens, prends ceci : c'est un réceptacle de cœur que tenait mon grand-père, un soldat de la garnison. Il te protégera. »"), { who: 'Cornélie', text: "« Et souviens-toi : on dit que Vauban a fait creuser des galeries sous les remparts. La clé serait au sommet du donjon… »", fn: () => setQuest('cat', 3) }];
      if (q === 1) return [{ who: 'Cornélie', text: "« Toujours pas de Pralin ? Il adore grimper… regarde sur les caisses, les toits, les remparts. »" }];
      return [{ who: 'Cornélie', text: "« Camille ! Mon chat Pralin a disparu depuis que ces monstres rôdent. Il adore grimper sur tout ce qui dépasse : caisses, toits, remparts… »" }, { who: 'Cornélie', text: "« Si tu le retrouves dans la citadelle, ramène-le-moi. Je saurai te récompenser. »", fn: () => setQuest('cat', 1) }]; }],
    ['Désiré', () => { const q = questStep('ghosts'), left = enemies.filter(e => !e.dead && e.zone === 'remparts' && e.kind === 'fantome').length;
      // la carte du guetteur : Désiré envoie Camille au sommet tant que le coffret est fermé
      const monte = [{ who: 'Désiré', text: "« Ma carte du pays est restée là-haut, dans le coffret. Le vieux guetteur d'avant moi l'a fermée d'une devinette — monte, et réponds-lui. »" },
        { who: 'Désiré', text: "« La porte est au pied du beffroi, côté rue. Quarante mètres de colimaçon : garde ton souffle. »" }];
      if (q >= 3) return state.carteBeffroi
        ? [{ who: 'Désiré', text: "« Tu as eu raison du vieux guetteur ! Garde sa carte : touche M, et tout le pays est sous tes yeux. »" }]
        : [{ who: 'Désiré', text: "« Je remonte au beffroi demain à l'aube. Le village te doit une fière chandelle, Camille. »" }, ...monte];
      if (q >= 1 && left === 0) return [{ who: 'Désiré', text: "« Les remparts sont silencieux… tu as chassé les fantômes de la garnison ! »", fn: () => setQuest('ghosts', 2, true) }, giveHeart('Désiré', "« Voilà le cœur de la garnison, que je gardais au sommet du beffroi. Il est à toi. »"), { who: 'Désiré', text: "« Le beffroi sonnera midi demain, comme avant. »", fn: () => setQuest('ghosts', 3) }, ...(state.carteBeffroi ? [] : monte)];
      if (q >= 1) return [{ who: 'Désiré', text: `« Il reste ${left} fantôme${left > 1 ? 's' : ''} sur les remparts, je les entends gémir la nuit. »` }];
      return [{ who: 'Désiré', text: "« Je suis le guetteur du beffroi… enfin, je l'étais. Depuis que les fantômes de la garnison hantent les remparts de la citadelle, je n'ose plus monter. »" }, { who: 'Désiré', text: "« Chasse les cinq fantômes des remparts et je te donnerai ce que je garde de plus précieux. »", fn: () => setQuest('ghosts', 1) }]; }],
    ['Émile', () => { const q = questStep('crows'), left = enemies.filter(e => !e.dead && e.zone === 'champ').length;
      if (q >= 3) return [{ who: 'Émile', text: "« Le blé pousse tranquille. Le moulin tourne encore grâce au vent des Flandres ! »" }];
      if (q >= 1 && left === 0) return [{ who: 'Émile', text: "« Plus un corbeau sur mon champ ! Tu es une sacrée gardienne. »", fn: () => setQuest('crows', 2, true) }, giveHeart('Émile', "« Tiens : une gaufre de force, cuite avec la farine du moulin. Un cœur de plus pour toi. »"), { who: 'Émile', text: "« Reviens quand tu veux, la porte du moulin est ouverte. »", fn: () => setQuest('crows', 3) }];
      if (q >= 1) return [{ who: 'Émile', text: `« Encore ${left} corbeau${left > 1 ? 'x' : ''} sur mon champ, près du moulin, à l'ouest du pont. Ils se moquent de moi ! »` }];
      return [{ who: 'Émile', text: "« Je suis le meunier. Mon champ, près du moulin à l'ouest du pont, est pillé par quatre corbeaux de Phinaert. »" }, { who: 'Émile', text: "« Chasse-les et je te donnerai de quoi reprendre des forces. »", fn: () => setQuest('crows', 1) }]; }],
    ['Fernande', () => [{ who: 'Fernande', text: state.bow ? "« Avec ton arc, tu peux viser les moules des fossés depuis la berge. De mon temps, on les mangeait avec des frites… »" : "« Tu as vu les moules mutantes des fossés ? Impossible de les atteindre à pied. Il paraît qu'un arc est caché sur le bastion de Turenne, à gauche de la porte. »" }]],
  ];
  const spots = [[-3, 2.5, 0.8], [6.5, -1.5, -1.2], [-9.5, -2.2, 0.2], [2, -8.5, 2.8], [-6, 9, -2.4], [11, 1.8, -0.9]];
  spots.forEach(([x, z, yaw], i) => {
    const v = makeVillager(i); { const [wx, wz] = W2(x, z); v.position.set(wx, TOWN.y, wz); }
    v.rotation.y = yaw; v.scale.setScalar(E.G.echelle); E.scene.add(v);   // même taille que Camille
    v.userData.anim = rand(0, 10); v.userData.name = lines[i][0]; PARTAGE.villagers.push(v);
    if (lines[i][0] === 'Émile') PARTAGE.emile = v;     // le prologue l'attend à son moulin
    if (i === 1 || i === 3 || i === 5) { // trois villageois se promènent dans les rues
      // Tracés recalés hors de la fontaine (bassin de 3,3 en local) et hors des étals :
      // ils passaient tous les trois en plein milieu du bassin.
      const routes = {
        1: [[6.5, -3.6], [14, -3.6], [14, 3.6], [3.6, 3.6], [3.6, 12], [-3.6, 12], [-3.6, 3.6], [6.5, 3.6]],
        // Désiré tournait devant la porte de la chapelle (−1, −13) : quand Camille le rejoignait
        // là, Entrée la faisait entrer dans la chapelle au lieu de lui parler. Sa ronde tourne
        // désormais à z = −8,5, à 4,5 unités de la porte — plus que les deux portées réunies.
        3: [[2, -8.5], [-2, -8.5], [-2, -6], [-3.7, -3.7], [-12, -3.7], [-12, 3.7], [-3.7, 3.7], [-2, -6]],
        5: [[11, 3.7], [15, 3.7], [15, -3.7], [-14, -3.7], [-14, 3.7]],
      };
      v.userData.route = routes[i].map(([rx, rz]) => { const [wx, wz] = W2(rx, rz); return new THREE.Vector3(wx, TOWN.y, wz); }); v.userData.wp = 0; v.userData.pause = rand(0, 3);
    } else addCap(x, z, x, z, 0.5);
    E.addInteract({ pos: v.position, r: 2.6, prompt: () => `parler à ${lines[i][0]}`, fn: () => { v.userData.talk = 4; v.rotation.y = Math.atan2(player.pos.x - v.position.x, player.pos.z - v.position.z); dialogue(lines[i][1](), () => { v.userData.talk = 0; if (lines[i][0] === 'Émile') offrirFaux(); }); } });
  });
  // ---------- le colporteur ----------
  // Au débouché de la rue du marché, là où elle s'ouvre sur l'esplanade, derrière sa
  // charrette à bras : il vend ce qui ne se mérite pas (bourse.js, colporteur()). Il ne se
  // promène pas — on doit savoir où le retrouver. L'emplacement a été relevé au banc (libre,
  // à ciel ouvert, hors des tournées des villageois) : la première place tombait DANS une
  // maison de la rangée.
  { const CX = 6.5, CZ = 19.5;
    const col = PNJ.buildRole('colporteur') || makeVillager(1);
    { const [wx, wz] = W2(CX, CZ); col.position.set(wx, TOWN.y, wz);
      const [fx, fz] = W2(0, 14); col.rotation.y = Math.atan2(fx - wx, fz - wz); }   // il regarde la rue
    col.scale.setScalar(E.G.echelle); E.scene.add(col);
    col.userData.anim = rand(0, 10); col.userData.name = 'Le colporteur';
    if (col.userData.perso || col.userData.legs) PARTAGE.villagers.push(col);
    addCap(CX, CZ, CX, CZ, 0.5);
    // la charrette : un plateau, deux roues, des ballots et un coffre de colifichets
    const cg = new THREE.Group(); { const [wx, wz] = W2(CX + 2.3, CZ + 0.4); cg.position.set(wx, TOWN.y, wz); }
    cg.rotation.y = col.rotation.y + Math.PI / 2; cg.scale.setScalar(TOWN.s * 0.8); E.scene.add(cg);
    const bois = pbrRepeat(T.plank, 1, 1, { color: 0x7a5a3a });
    cg.add(mesh(boxG(1.9, 0.12, 1.1), bois, 0, 0.62, 0));
    for (const sz of [-1, 1]) cg.add(mesh(boxG(1.9, 0.3, 0.06), bois, 0, 0.8, sz * 0.52));
    for (const sz of [-1, 1]) { const r = mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 14), mat(0x4a3320), 0.25, 0.44, sz * 0.62); cg.add(r);
      cg.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6), IRON(), 0.25, 0.44, sz * 0.62).rotateX(Math.PI / 2)); }
    for (const sx of [-1, 1]) cg.add(mesh(boxG(1.2, 0.07, 0.07), mat(0x4a3320), -1.35, 0.62, sx * 0.35));
    cg.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.75, 10), mat(0xc9bda0, { roughness: 1 }), -0.35, 0.95, 0).rotateX(Math.PI / 2));
    cg.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.6, 10), mat(0x8a3a2a, { roughness: 1 }), 0.35, 0.92, 0.15).rotateX(Math.PI / 2));
    cg.add(mesh(boxG(0.45, 0.3, 0.35), pbrRepeat(T.plank, 1, 1, { color: 0x5a3a22 }), 0.55, 0.83, -0.25));
    for (let k = 0; k < 3; k++) cg.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.24, 8), mat([0x9ad44a, 0xff5070, 0x7aa0e0][k], { roughness: 0.3 }), -0.1 + k * 0.17, 0.8, -0.3));
    addCap(CX + 1.6, CZ + 0.4, CX + 3.0, CZ + 0.4, 0.8, 1.2);
    const [px, pz] = W2(CX - 0.8, CZ - 0.8);
    E.addInteract({ pos: new THREE.Vector3(px, TOWN.y, pz), r: 2.6, prompt: () => 'parler au colporteur',
      fn: () => { col.userData.talk = 3; col.rotation.y = Math.atan2(player.pos.x - col.position.x, player.pos.z - col.position.z);
        if (!BOURSE.aBourse()) { dialogue([{ who: 'Le colporteur', text: '« Pas de bourse, pas d’affaires, ma belle. Reviens quand tu auras de quoi compter. »' }]); return; }
        BOURSE.colporteur(); } });
  }
  // ---------- l'estaminet ----------
  // La zone d'interaction était posée au milieu de la rue, à trois mètres de la porte : on ne
  // pouvait pas entrer. Elle est maintenant calée sur le seuil de la maison n° 1 de la rangée
  // nord, et les tables — qui étaient À L'INTÉRIEUR du bâtiment — sont sorties en terrasse.
  const EST_X = -11, EST_Z = -RUE - 0.4;                    // x de la porte, z de la façade
  addInteract({ pos: new THREE.Vector3(tx + EST_X, 0, tz + EST_Z + 1.7), r: 2.4,
    prompt: () => "entrer dans l'estaminet",
    fn: () => goToLevel('tavern', [0, 0, 4.4], Math.PI, "Camille pousse la porte de l'estaminet…") });
  // terrasse : deux guéridons, des tabourets, un tonneau-table
  for (const [x, z] of [[EST_X - 2.9, EST_Z + 1.35], [EST_X + 2.9, EST_Z + 1.35]]) {
    const bx = tx + x, bz = tz + z;
    scene.add(mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 14), pbrRepeat(T.plank, 1, 1), bx, 1.0, bz));
    scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.28, 1.0, 8), mat(0x4a3320), bx, 0.5, bz));
    scene.add(mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.08, 12), mat(0x4a3320), bx, 0.06, bz));
    scene.add(mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.36, 10), mat(0xe8c060, { roughness: 0.25 }), bx + 0.22, 1.23, bz));
    for (const a of [0.7, 2.9, 4.6]) {                       // tabourets
      const sx2 = bx + Math.cos(a) * 1.5, sz2 = bz + Math.sin(a) * 1.5;
      scene.add(mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.1, 10), pbrRepeat(T.plank, 1, 1), sx2, 0.66, sz2));
      for (let k = 0; k < 3; k++) scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.62, 5), mat(0x4a3320), sx2 + Math.cos(k * 2.1) * 0.17, 0.31, sz2 + Math.sin(k * 2.1) * 0.17));
      addCap(sx2, sz2, sx2, sz2, 0.3, 0.8);
    }
    addCap(bx, bz, bx, bz, 0.78, 1.15);
  }
  // paravents : la terrasse d'un estaminet flamand se garde du vent, et ça donne
  // la tache de couleur qui manquait devant la façade de brique
  for (const [sx, col] of [[-1, 0x8a2a2a], [1, 0x2a5a4a]]) {
    const pv = makeParavent(1.6, 1.95, col);
    pv.position.set(tx + EST_X + sx * 5.6, 0, tz + EST_Z + 2.1); pv.rotation.y = Math.PI / 2; scene.add(pv);
    addCap(tx + EST_X + sx * 5.6, tz + EST_Z + 0.6, tx + EST_X + sx * 5.6, tz + EST_Z + 3.6, 0.3, 2.0);
  }
  { const bx = tx + EST_X - 4.6, bz = tz + EST_Z + 1.1;      // tonneau-table et son ardoise
    scene.add(mesh(new THREE.CylinderGeometry(0.52, 0.46, 1.1, 14), pbrRepeat(T.plank, 1, 1, { color: 0x8a6440 }), bx, 0.55, bz));
    for (const yy of [0.2, 0.9]) scene.add(mesh(new THREE.TorusGeometry(0.52, 0.05, 6, 16), FERN(), bx, yy, bz).rotateX(Math.PI / 2));
    addCap(bx, bz, bx, bz, 0.55, 1.2); }
  // ---------- props MegaKit : charrette, caisses, barrière, vigne vierge ----------
  prop('megakit:Prop_Wagon', tx + 11, tz + 3.4, Math.PI / 2, 0.9);
  prop('megakit:Prop_Crate', tx - 13.1, tz + 3.6, 0.3, 0.5);
  prop('megakit:Prop_Crate', tx - 12.35, tz + 3.8, -0.4, 0.5);
  prop('megakit:Prop_Crate', tx - 13.0, tz + 3.65, 0.9, 0, 1.06);
  for (let i = 0; i < 4; i++) prop('megakit:Prop_WoodenFence_Single', tx - 5 + i * (2.04 / S), tz - RUE - 0.5);
  prop('megakit:Prop_Vine1', tx - 16.6, tz - RUE - 0.6);
  prop('megakit:Prop_Vine1', tx + 10.2, tz + RUE + 0.6, Math.PI);
  // enseigne de l'estaminet : panneau peint à emblème (une chope), comme les quatre
  // commerces — le texte seul se perd dès qu'on s'éloigne de dix mètres
  { const ens = enseignePeinte("L'ESTAMINET", 'chope', 2.5, 1.3);
    ens.position.set(tx + EST_X - 2.5, 5.05, tz + EST_Z + 0.06); ens.rotation.y = -Math.PI / 2; scene.add(ens); }
  // la vie du bourg : commerces, marché, linge, tas, traces d'usage.
  // tx et tz valent 0 — buildVie travaille donc directement en coordonnées locales.
  buildVie({ scene, addCap, addBox, addInteract, prop, S, RUE });
}
// ---------- route pavée du pont au village, moulin et champs ----------
