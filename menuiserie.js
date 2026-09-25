// menuiserie.js — portes, volets, toiles rayées, enseignes, paravents.
//
// Les pièces de menuiserie qui se retrouvent partout : maisons flamandes, maison de
// Camille, tours, chaumières, terrasses. Elles ne connaissent rien du niveau — on leur
// donne des dimensions et une teinte, elles rendent un groupe prêt à poser.
// Bien commun : plusieurs secteurs s'en servent, personne ne doit y mettre de contenu
// de niveau (cf. ORCHESTRATION.md).
import { THREE, T, lerp, mat, pbr, pbrRepeat, phMat, mesh, boxG, sphG, makeCanvas, mergeParts } from './engine.js?v=27';

// =====================================================================
//  Portes
// =====================================================================
// Une seule fabrique pour toutes les portes du jeu. Ce qui fait qu'une porte « tient »,
// dans l'ordre : l'embrasure (le vantail est EN RETRAIT, pas collé sur la façade),
// les panneaux moulurés du vantail, l'imposte vitrée qui éclaire le couloir,
// l'encadrement de pierre à voussoirs et clé, le seuil de pierre, la quincaillerie.
// Le groupe est rendu dans le plan XY, ouverture vers +z : on le pose sur la façade,
// origine au ras du mur et au niveau du sol.
const MATC = new Map();
const cached = (k, f) => { if (!MATC.has(k)) MATC.set(k, f()); return MATC.get(k); };
export const LAITON = () => cached('laiton', () => mat(0xb9913f, { metalness: 0.85, roughness: 0.33 }));
export const FERN = () => cached('ferNoir', () => mat(0x2a2a30, { metalness: 0.75, roughness: 0.45 }));
export const VITRE = () => cached('vitre', () => mat(0x9fc0dc, { roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.55 }));
export const VITRE_CHAUDE = () => cached('vitreChaude', () => mat(0xffd79a, { roughness: 0.2, emissive: 0xff9d3a, emissiveIntensity: 0.75 }));
export const DOOR_COLORS = [0x2f4632, 0x6e2b28, 0x27405e, 0x3f3a46, 0x5a3a22, 0x1f4a4a];

export function makeDoor(w, h, opts = {}) {
  const g = new THREE.Group();
  const EP = 0.13, rec = opts.recess === undefined ? 0.2 : opts.recess;  // épaisseur du vantail, profondeur de l'embrasure
  const ouvert = opts.ouvert || 0;
  const teinte = opts.color !== undefined ? opts.color : DOOR_COLORS[0];
  const bois = opts.rustique
    ? cached('chene', () => phMat('wood_cabinet_worn_long', 1.5, 2.6, { color: 0x7d5a38 }))
    : cached('peint' + teinte, () => mat(teinte, { roughness: 0.4, metalness: 0.05 }));
  // Le fond des panneaux est peint un ton au-dessus et le chant un ton en dessous. Sans ça,
  // une porte peinte est une planche unie : ni les moulures ni l'épaisseur ne se lisent,
  // et une fois la porte ouverte le battant n'a littéralement pas de tranche.
  const clair = opts.rustique ? bois : cached('peintC' + teinte, () => mat(new THREE.Color(teinte).lerp(new THREE.Color(0xffffff), 0.17).getHex(), { roughness: 0.45 }));
  const chant = opts.rustique
    ? cached('cheneChant', () => phMat('wood_cabinet_worn_long', 0.4, 2.6, { color: 0x5d422a }))
    : cached('peintS' + teinte, () => mat(new THREE.Color(teinte).multiplyScalar(0.64).getHex(), { roughness: 0.5 }));
  const pierre = opts.pierre || cached('pierrePorte', () => pbr(T.stone, { roughness: 0.82, color: 0xcec5b2 }));
  const OMBRE = () => cached('ombrePorte', () => mat(0x150f0a, { roughness: 1 }));
  const vitre = opts.chaud ? VITRE_CHAUDE() : VITRE();
  const imp = opts.imposte === false ? 0 : Math.min(0.62, h * 0.21);     // hauteur de l'imposte
  const hv = h - imp;                                                    // hauteur du vantail
  const add = (geo, m, x, y, z) => { const o = mesh(geo, m, x, y, z); g.add(o); return o; };

  // ---- embrasure : tableaux et voussure, pour que le vantail soit creusé dans le mur ----
  for (const sx of [-1, 1]) add(boxG(rec, h + 0.1, 0.16), pierre, sx * (w / 2 + 0.08), (h + 0.1) / 2, -rec / 2).rotateY(Math.PI / 2);
  add(boxG(w + 0.3, 0.16, rec), pierre, 0, h + 0.05, -rec / 2);
  // filet d'ombre au fond des tableaux : sans lui, en plein soleil, le creux disparaît et
  // la porte a l'air peinte sur la façade
  for (const sx of [-1, 1]) add(boxG(0.05, h - 0.05, 0.05), OMBRE(), sx * (w / 2 - 0.01), (h - 0.05) / 2, -rec + 0.025);
  add(boxG(w, 0.05, 0.05), OMBRE(), 0, h - 0.03, -rec + 0.025);

  // ---- encadrement de pierre : piédroits chanfreinés ----
  for (const sx of [-1, 1]) {
    add(boxG(0.3, h + 0.05, 0.3), pierre, sx * (w / 2 + 0.25), (h + 0.05) / 2, 0.08);
    add(boxG(0.4, 0.22, 0.4), pierre, sx * (w / 2 + 0.25), 0.11, 0.1);                 // base
    add(boxG(0.4, 0.16, 0.4), pierre, sx * (w / 2 + 0.25), h - 0.02, 0.1);             // sommier
  }
  if (opts.arc) {
    // arc en plein cintre à claveaux : douze voussoirs et une clé saillante
    const R0 = w / 2 + 0.25, NV = 11;
    for (let k = 0; k < NV; k++) {
      const a = Math.PI * (k + 0.5) / NV, cle = Math.abs(a - Math.PI / 2) < 0.14;
      const vg = boxG(Math.PI * (R0 + 0.2) / NV * 0.92, cle ? 0.62 : 0.44, 0.34);
      const o = mesh(vg, pierre, 0, 0, 0); o.rotation.z = a - Math.PI / 2;
      const rr = R0 + (cle ? 0.16 : 0.08);
      o.position.set(Math.cos(a) * rr, h + 0.05 + Math.sin(a) * rr, 0.08); g.add(o);
    }
    add(boxG(w + 1.35, 0.14, 0.4), pierre, 0, h + 0.05 + R0 + 0.45, 0.12);             // larmier
  } else {
    add(boxG(w + 1.0, 0.3, 0.34), pierre, 0, h + 0.2, 0.08);                            // linteau
    add(boxG(0.36, 0.5, 0.38), pierre, 0, h + 0.24, 0.1);                               // clé
    add(boxG(w + 1.3, 0.14, 0.42), pierre, 0, h + 0.44, 0.12);                          // larmier
  }

  // ---- imposte vitrée et sa traverse ----
  if (imp > 0) {
    add(boxG(w - 0.06, imp, 0.05), vitre, 0, hv + imp / 2, -rec + 0.03);
    add(boxG(w + 0.12, 0.14, EP + 0.06), bois, 0, hv + 0.02, -rec + EP / 2);            // traverse d'imposte
    if (opts.arc) for (let k = 0; k < 5; k++) {                                          // barlotières en éventail
      const a = Math.PI * (k + 1) / 6, o = mesh(boxG(0.05, imp * 1.05, 0.05), bois, 0, 0, 0);
      o.position.set(Math.cos(a) * imp * 0.5, hv + imp / 2 - 0.02, -rec + 0.06); o.rotation.z = a - Math.PI / 2; g.add(o);
    } else for (const sx of [-1, 0, 1]) add(boxG(0.05, imp, 0.06), bois, sx * w / 3.2, hv + imp / 2, -rec + 0.06);
  }

  // ---- vantail (ou deux) ----
  // Tout ce qui appartient au battant — bâti, panneaux des DEUX faces, chant, heurtoir,
  // bouton, serrure, fiches — est posé dans le groupe pivot : la porte s'ouvre d'une pièce.
  // (Avant, la quincaillerie restait dans le dormant : une porte ouverte laissait son
  // heurtoir flotter en l'air au milieu de l'embrasure, et ses pentures du mauvais côté.)
  const nb = opts.double ? 2 : 1, wl = (w - (nb - 1) * 0.04) / nb;
  for (let v = 0; v < nb; v++) {
    const sgn = nb === 1 ? 1 : (v === 0 ? 1 : -1);
    const piv = new THREE.Group();
    piv.position.set(sgn * -w / 2, 0, -rec + EP / 2);
    piv.rotation.y = ouvert * sgn;
    g.add(piv);
    const add = (geo, m, x, y, z) => { const o = mesh(geo, m, x, y, z); piv.add(o); return o; };
    const cx = sgn * wl / 2, z0 = 0, av = z0 + EP / 2, ar = z0 - EP / 2;   // face avant / revers
    // gonds scellés dans le piédroit, du côté du pivot (et non du côté de la poignée)
    for (const yy of [hv * 0.16, hv * 0.52, hv * 0.88]) {
      g.add(mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.17, 8), FERN(), sgn * -w / 2, yy, -rec + EP / 2 + 0.02));
      g.add(mesh(sphG(0.045, 8), FERN(), sgn * -w / 2, yy + 0.1, -rec + EP / 2 + 0.02));
    }
    add(boxG(wl, hv - 0.04, EP), bois, cx, (hv - 0.04) / 2, z0);                        // âme
    // chant du battant : tranche libre et tranche haute, visibles dès que la porte s'ouvre
    add(boxG(0.04, hv - 0.04, EP + 0.014), chant, cx + sgn * (wl / 2 - 0.018), (hv - 0.04) / 2, z0);
    add(boxG(wl, 0.04, EP + 0.014), chant, cx, hv - 0.05, z0);
    if (opts.rustique) {
      // porte de ferme : planches verticales clouées côté rue, barres et écharpe au revers
      for (let k = 0; k < 5; k++) add(boxG(wl / 5 - 0.03, hv - 0.1, 0.03), bois, cx - sgn * wl / 2 + sgn * (k + 0.5) * wl / 5, (hv - 0.04) / 2, av);
      for (const yy of [hv * 0.22, hv * 0.72]) {
        add(boxG(wl * 0.92, 0.14, 0.04), FERN(), cx, yy, av + 0.02);
        for (let k = 0; k < 5; k++) add(sphG(0.045, 6), FERN(), cx - sgn * wl * 0.38 + sgn * k * wl * 0.19, yy, av + 0.05);
      }
      for (const yy of [hv * 0.18, hv * 0.82]) add(boxG(wl * 0.9, 0.15, 0.05), bois, cx, yy, ar - 0.025);   // barres du revers
      { const L = Math.hypot(wl * 0.88, hv * 0.6), e = mesh(boxG(L, 0.14, 0.05), bois, cx, hv / 2, ar - 0.025);
        e.rotation.z = sgn * Math.atan2(hv * 0.6, wl * 0.88); piv.add(e); }                                  // écharpe
    } else {
      const M = 0.17;                                                                    // largeur des montants et traverses
      add(boxG(M, hv - 0.04, EP + 0.05), bois, cx - wl / 2 + M / 2, (hv - 0.04) / 2, z0);
      add(boxG(M, hv - 0.04, EP + 0.05), bois, cx + wl / 2 - M / 2, (hv - 0.04) / 2, z0);
      const trav = [0.09, hv * 0.42, hv * 0.55, hv - 0.11];                              // traverses basse, de milieu (double), haute
      for (const yy of trav) add(boxG(wl, 0.17, EP + 0.05), bois, cx, yy, z0);
      // deux panneaux par vantail, sur les DEUX faces : plaque en léger relief + baguette moulurée
      for (const [y0, y1] of [[0.19, hv * 0.36], [hv * 0.61, hv - 0.21]]) {
        const ph = y1 - y0, pw = wl - 2 * M - 0.1;
        add(boxG(pw, ph, 0.05), clair, cx, (y0 + y1) / 2, av - 0.045);                   // fond du panneau, côté rue
        for (const sx of [-1, 1]) add(boxG(0.06, ph + 0.1, 0.07), bois, cx + sx * (pw / 2 + 0.03), (y0 + y1) / 2, av - 0.035);
        for (const sy of [-1, 1]) add(boxG(pw + 0.12, 0.06, 0.07), bois, cx, (y0 + y1) / 2 + sy * (ph / 2 + 0.03), av - 0.035);
        add(boxG(pw + 0.1, ph + 0.08, 0.035), clair, cx, (y0 + y1) / 2, ar - 0.018);     // revers : panneau saillant, moulure simple
      }
      // plinthe de bas de porte, usée par les coups de pied et les seaux
      add(boxG(wl - 0.04, 0.2, EP + 0.055), chant, cx, 0.13, z0);
    }
    // ---- quincaillerie, solidaire du battant ----
    const xl = cx + sgn * (wl / 2 - 0.16);          // près du chant libre : poignée et serrure
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12), LAITON(), cx, hv * 0.66, av + 0.02).rotateX(Math.PI / 2); // platine du heurtoir
    add(new THREE.TorusGeometry(0.11, 0.028, 6, 14), LAITON(), cx, hv * 0.60, av + 0.04);                            // anneau
    add(sphG(0.07, 10), LAITON(), xl, hv * 0.45, av + 0.05);                                                         // bouton
    add(boxG(0.09, 0.15, 0.03), LAITON(), xl, hv * 0.36, av + 0.03);                                                 // entrée de serrure
    add(boxG(0.16, 0.22, 0.02), LAITON(), xl, hv * 0.42, av + 0.015);                                                // plaque de propreté
    for (const yy of [hv * 0.16, hv * 0.52, hv * 0.88])                                                              // fiches sur le battant
      add(boxG(0.24, 0.09, EP + 0.035), FERN(), cx - sgn * (wl / 2 - 0.13), yy, z0);
    // poignée de tirage au revers : c'est elle qu'on voit quand la porte est grande ouverte
    add(new THREE.TorusGeometry(0.09, 0.022, 6, 12), FERN(), xl, hv * 0.46, ar - 0.05);
    for (const sy of [-1, 1]) add(boxG(0.03, 0.07, 0.06), FERN(), xl, hv * 0.46 + sy * 0.09, ar - 0.03);
    // ---- porte maintenue ouverte : cale de pierre et piton, sinon elle bat dans le vide ----
    if (ouvert && !opts.sansCale) {
      const th = ouvert * sgn;
      const tx = sgn * -w / 2 + sgn * wl * 0.9 * Math.cos(th), tz = (-rec + EP / 2) - sgn * wl * 0.9 * Math.sin(th);
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.17, 10), pierre, tx, 0.085, tz));
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), FERN(), tx + 0.16, 0.21, tz));
    }
  }
  // ---- seuil de pierre et marche arrondie ----
  g.add(mesh(boxG(w + 0.7, 0.14, 0.42), pierre, 0, 0.07, -rec + 0.12));
  g.add(mesh(new THREE.CylinderGeometry(w * 0.72, w * 0.76, 0.16, 18, 1, false, 0, Math.PI), pierre, 0, 0.08, 0.02));
  if (opts.lanterne) {                                                                    // potence et lanterne, pour les portes qu'on pousse
    g.add(mesh(boxG(0.08, 0.5, 0.08), FERN(), w / 2 + 0.55, h + 0.2, 0.14));
    g.add(mesh(boxG(0.6, 0.08, 0.08), FERN(), w / 2 + 0.28, h + 0.42, 0.14));
    g.add(mesh(boxG(0.34, 0.42, 0.34), mat(0xffe0a0, { emissive: 0xffb44a, emissiveIntensity: 0.9, transparent: true, opacity: 0.88 }), w / 2 + 0.03, h + 0.18, 0.14));
    g.add(mesh(new THREE.ConeGeometry(0.3, 0.22, 4), FERN(), w / 2 + 0.03, h + 0.48, 0.14).rotateY(Math.PI / 4));
  }
  return g;
}
// enseigne peinte suspendue à une potence de fer (estaminet, boutiques)
export function makeEnseigne(texte, w = 2.6, h = 1.0) {
  const g = new THREE.Group();
  const [c, x] = makeCanvas(384, 148);
  x.fillStyle = '#4a2d18'; x.fillRect(0, 0, 384, 148);
  x.strokeStyle = '#c9a25a'; x.lineWidth = 6; x.strokeRect(10, 10, 364, 128);
  x.fillStyle = '#f2debc'; x.font = 'bold 46px Georgia, serif'; x.textAlign = 'center';
  x.fillText(texte, 192, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const pan = new THREE.Mesh(boxG(w, h, 0.07), [FERN(), FERN(), FERN(), FERN(),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })]);
  pan.position.y = -h / 2 - 0.22; pan.castShadow = true; g.add(pan);
  pan.position.x = w / 2 + 0.4;
  for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6), FERN(), w / 2 + 0.4 + sx * w * 0.35, -0.12, 0));
  g.add(mesh(boxG(w + 0.9, 0.08, 0.08), FERN(), (w + 0.9) / 2, 0, 0));            // potence
  g.add(mesh(boxG(0.1, 0.8, 0.1), FERN(), 0.05, -0.4, 0));                        // scellement
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 14, Math.PI), FERN(), 0.42, -0.35, 0).rotateZ(-Math.PI / 2));
  return g;
}

// ---------- volets, toiles rayées, paravents de terrasse ----------
// Le volet pend à ses gonds : rotation.y = 0 → fermé sur la baie, ±0,94 π → rabattu au mur.
// Le bâti est construit vers +x depuis le gond ; sg = -1 le retourne pour le vantail de droite.
// Les géométries sont fusionnées et mises en cache : un volet coûte deux meshes, pas vingt.
// Sans ça, cent vingt fenêtres à deux volets feraient exploser le temps de construction.
const VOLETS = new Map();
export function makeVolet(w, h, col, sg = 1, persienne = true) {
  const key = [w.toFixed(2), h.toFixed(2), col, sg, persienne].join('|');
  if (!VOLETS.has(key)) {
    const bois = [], fer = [], M = 0.11, EP = 0.07;
    const B = (arr, gw, gh, gd, x, y, z, rx = 0) => { const q = boxG(gw, gh, gd); if (rx) q.rotateX(rx); arr.push(q.translate(sg * x, y, z)); };
    B(bois, w, h, EP, w / 2, 0, 0);                                          // âme
    for (const sy of [-1, 1]) B(bois, w, 0.16, EP + 0.035, w / 2, sy * (h / 2 - 0.08), 0);   // traverses
    B(bois, M, h, EP + 0.035, M / 2, 0, 0);                                  // montant du gond
    B(bois, M, h, EP + 0.035, w - M / 2, 0, 0);                              // montant de battée
    B(bois, w, 0.13, EP + 0.03, w / 2, 0, 0);                                // traverse de milieu
    if (persienne) for (const sy of [-1, 1]) for (let k = 0; k < 3; k++)      // lames inclinées
      B(bois, w - 2 * M - 0.04, 0.055, 0.1, w / 2, sy * (0.17 + k * 0.2), 0.012, -0.55);
    for (const sy of [-1, 1]) {                                              // pentures et gonds
      B(fer, w * 0.62, 0.09, 0.03, w * 0.34, sy * (h / 2 - 0.2), EP / 2 + 0.02);
      B(fer, 0.13, 0.2, 0.13, 0.02, sy * (h / 2 - 0.2), 0);
    }
    B(fer, 0.07, 0.24, 0.05, w - 0.12, 0, EP / 2 + 0.03);                    // espagnolette
    const g = new THREE.Group();
    for (const [parts, m] of [[bois, cached('volet' + col, () => mat(col, { roughness: 0.55, metalness: 0.03 }))], [fer, FERN()]]) {
      const o = new THREE.Mesh(mergeParts(parts), m); o.castShadow = o.receiveShadow = true; g.add(o);
    }
    VOLETS.set(key, g);
  }
  return VOLETS.get(key).clone();
}
// toile rayée tendue, avec flèche : une bande par lé, la hauteur suit une parabole
export function makeToile(w, prof, col, lés = 8, creux = 0.22) {
  const g = new THREE.Group();
  const clair = cached('toileClaire', () => mat(0xf3ece0, { roughness: 1, side: THREE.DoubleSide }));
  const teint = cached('toile' + col, () => mat(col, { roughness: 1, side: THREE.DoubleSide }));
  for (let k = 0; k < lés; k++) {
    const t = (k + 0.5) / lés - 0.5;
    const y = -creux * (1 - 4 * t * t);                                      // ventre de la toile
    const bande = mesh(boxG(w / lés + 0.01, 0.05, prof), k % 2 ? clair : teint, (k + 0.5) * w / lés - w / 2, y, 0);
    bande.rotation.x = -0.22; g.add(bande);
  }
  // lambrequin festonné au nez de la toile
  for (let k = 0; k < lés; k++) {
    const x = (k + 0.5) * w / lés - w / 2;
    g.add(mesh(boxG(w / lés - 0.02, 0.34, 0.04), k % 2 ? clair : teint, x, -creux - 0.16, prof / 2 - 0.04));
    g.add(mesh(new THREE.CylinderGeometry(w / lés / 2 - 0.01, w / lés / 2 - 0.01, 0.04, 10, 1, false, 0, Math.PI),
      k % 2 ? clair : teint, x, -creux - 0.33, prof / 2 - 0.04).rotateX(Math.PI / 2).rotateZ(Math.PI));
  }
  return g;
}
// paravent de terrasse : toile rayée tendue sur un bâti de bois, deux battants articulés
export function makeParavent(w, h, col) {
  const g = new THREE.Group();
  const bois = cached('paravBois', () => pbrRepeat(T.plank, 1, 1, { color: 0x8a6a48 }));
  const clair = cached('toileClaire', () => mat(0xf3ece0, { roughness: 1, side: THREE.DoubleSide }));
  const teint = cached('toile' + col, () => mat(col, { roughness: 1, side: THREE.DoubleSide }));
  for (const [dx, ang] of [[-w / 2, 0.25], [w / 2, -0.25]]) {
    const b = new THREE.Group(); b.position.x = dx; b.rotation.y = ang; g.add(b);
    for (let k = 0; k < 6; k++) b.add(mesh(boxG(w / 6 + 0.01, h - 0.3, 0.04), k % 2 ? clair : teint, (k + 0.5) * w / 6 - w / 2, h / 2, 0));
    for (const sy of [0.06, h - 0.06]) b.add(mesh(boxG(w + 0.1, 0.12, 0.1), bois, 0, sy, 0));
    for (const sx of [-1, 1]) b.add(mesh(boxG(0.1, h, 0.1), bois, sx * w / 2, h / 2, 0));
    for (const sx of [-1, 1]) b.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.12, 8), FERN(), sx * w / 2, 0.06, 0));
  }
  return g;
}
