import * as PNJ_E from './engine.js?v=41';
import * as PNJ from './pnj.js';
// The Legend of Camille — la rive oubliée : la Blessure et l'autre rive (acte VI, docs/DECOUPAGE-ACTE6.md)
// =====================================================================
// STORY.md, acte VI : « Le grand canyon de Lille… Maintenant Camille peut le franchir. » La carte de
// Lille n'a pas de canyon : la Blessure est un lieu à part (Eugène, 7 octobre), où l'on arrive par la
// porte de la fêlure de l'île — sur le bord côté Lille, le beffroi au loin. Un relief inventé (Eugène,
// 7 octobre), tiré par le code : la plaine humide de Flandre, et l'entaille de la Blessure, 24 m de fond.
//
// La traversée (SCENARIO.md § 15) : descendre AU LASSO de corniche en corniche ; traverser la rivière
// glacée du fond AVEC LE SOUFFLE ; remonter par l'escalier des géants, dont trois marches sont tombées,
// AVEC LA FORCE (pousser les blocs) ; abaisser le vieux pont des géants, pour revenir sans redescendre.
// On ne saute jamais dans le vide : là où le sol est plus de 3 m plus bas que les pieds, on ne passe pas.
//
// En mètres, x est, z sud : le bord côté Lille au nord (z > 40), l'autre rive au sud (z < −14).
// =====================================================================
import { THREE, TAU, scene, G, phMat, hemi, sun, renderer, bloom, mesh, boxG,
  addInteract, goToLevel, showMessage, dialogue, bootLevel, minimapDots, makeSky, player, state, saveGame, SFX, lasso as lassoMoteur,
  KINDS, setMaker, setAnimHook, spawnEnemy, fadeTo } from './engine.js?v=41';
import { especeGeo } from './foret.js';

// ---------- l'avancement de l'acte ----------
const ETAPES6 = ['felure', 'bord', 'descente', 'riviere', 'escalier', 'rive', 'forge', 'metal', 'tombe', 'cloche'];
const passe6 = (e) => ETAPES6.indexOf(state.acte6 || '') >= ETAPES6.indexOf(e);
function passer6(e) { if (passe6(e)) return; state.acte6 = e; saveGame(true); }

// ---------- le relief ----------
const BORD_N = 40, FOND = -24, SUD = -14;                        // le bord côté Lille, le fond, le pied de l'autre paroi
const CORNICHES = [[36.5, 40, -8], [33, 36.5, -16]];             // [z0, z1, y] : les deux corniches de la paroi nord
const RIVIERE = [-8, 8], EAU = FOND - 0.3;                         // la rivière glacée, en travers du fond
const ESC = { x0: -2, x1: 2, z0: SUD, z1: -62, pas: 0.8, haut: 0.4 };   // l'escalier des géants, taillé dans la paroi sud
const TROUS = [[10, 11.6], [24, 25.6], [38, 39.6]];                // les marches tombées, en mètres le long de l'escalier
const PONT = { x0: 38, x1: 42 };                                   // le vieux pont des géants, quand il est abaissé
const BORNES = { x0: -120, x1: 120, z0: -330, z1: 90 }, LOIN = 760;   // LOIN : jusqu'où la Blessure se voit
const DEPART = { x: 0, z: 55, yaw: Math.PI };
// l'autre rive (lot 2) : la fontaine de l'ermite, les trois traces de Lydéric enfant, la forêt du Buc et
// la forge de Cornil au fond, les ruines du château du Buc sur leur butte, à l'est
const FONTAINE = [-68, -72], TRACES = { epee: [-34, -54], pierre: [-92, -112], cabane: [-56, -142] };
const FORET = { x0: -120, x1: 30, z0: -320, z1: -165 }, FORGE = { x: -42, z: -286 };
const RUINES = { x: 72, z: -238, r: 30, h: 6 };
const marches = () => state.marches6 || 0;

// la plaine : quelques ondulations, à peine (la Flandre est plate)
const plaine = (x, z) => Math.sin(x * 0.045) * 0.35 + Math.cos(z * 0.06 + x * 0.02) * 0.3;
// la butte du château du Buc : un sommet plat de 15 m, des pentes douces (on y monte à pied)
const butte = (x, z) => { const d = Math.hypot(x - RUINES.x, z - RUINES.z); if (d >= RUINES.r) return 0;
  const t = Math.min(1, Math.max(0, (RUINES.r - d) / (RUINES.r - 15))); return RUINES.h * t * t * (3 - 2 * t); };
// hors des bornes, la Blessure serpente (tirée au cordeau jusqu'à l'horizon, elle avait l'air d'un fossé) ;
// entre les bornes elle reste droite : les corniches, l'escalier et le pont y sont posés
const courbe = (x) => { const d = Math.abs(x) - BORNES.x1; return d > 0 ? Math.sin(d / 70) * 26 * Math.sign(x) * Math.min(1, d / 60) : 0; };
function relief(x, z) {
  z -= courbe(x);
  if (z >= BORD_N) return plaine(x, z);
  for (const [z0, z1, y] of CORNICHES) if (z >= z0 && z < z1) return y;
  if (z >= SUD) return z > RIVIERE[0] && z < RIVIERE[1] ? FOND - 1.5 : FOND;      // le lit de la rivière, plus bas
  // l'escalier, taillé dans la paroi sud : 60 marches de 40 cm (0,5 m serait un mur : tryMove)
  if (x > ESC.x0 && x < ESC.x1 && z > ESC.z1) {
    const t = SUD - z, k = Math.floor(t / ESC.pas);
    let y = FOND + k * ESC.haut;
    TROUS.forEach(([a, b], i) => { if (t >= a && t < b && marches() <= i) y -= 1.6; });
    return y;
  }
  return plaine(x, z) + butte(x, z);
}
const pontBas = () => !!state.pont6;
const surPont = (x, z) => pontBas() && x > PONT.x0 && x < PONT.x1 && z < BORD_N + 1 && z > SUD - 1;
const dansRiviere = (x, z) => z > RIVIERE[0] && z < RIVIERE[1] && !surPont(x, z);
function sol(x, z) {
  if (surPont(x, z)) return 0.2;
  if (dansRiviere(x, z)) return state.souffle ? FOND - 0.1 : FOND - 1.5;            // avec le souffle, on nage en surface (au ras des berges : on en ressort sans marche)
  return relief(x, z);
}

// ---------- ce qu'on ne traverse pas ----------
let avertiEau = 0;
function blocked(x, z, r = 0.4, flying, y = 0) {
  if (x < BORNES.x0 || x > BORNES.x1 || z < BORNES.z0 || z > BORNES.z1) return true;
  // l'eau glacée sans le souffle : elle coupe le souffle, on reste sur la berge
  if (dansRiviere(x, z) && !state.souffle) {
    if (y > FOND - 1 && Date.now() - avertiEau > 4000) { avertiEau = Date.now(); showMessage('L’eau est si froide qu’elle coupe le souffle. Tu remontes sur la berge.', 3.5); }
    return true;
  }
  // jamais dans le vide : plus de 3 m sous les pieds, on ne passe pas (on descend au lasso)
  if (sol(x, z) < y - 3) return true;
  // les troncs, rangés par cases de 4 m (la forêt du Buc en compte des centaines)
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const t of TRONCS.get(caseT(x + i * 4, z + j * 4)) || [])
    if (Math.hypot(x - t[0], z - t[1]) < 0.6 + r) return true;
  for (const [x0, z0, x1, z1] of MURS) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
  return false;
}
const TRONCS = new Map(), MURS = [];
const caseT = (x, z) => Math.floor(x / 4) + ',' + Math.floor(z / 4);
const tronc = (x, z) => { const k = caseT(x, z); if (!TRONCS.has(k)) TRONCS.set(k, []); TRONCS.get(k).push([x, z]); };

// ---------- le décor ----------
const R = { eau: null, pont: null, blocs: [] };
function terrain() {
  // une grille d'un mètre entre les bornes ; au-delà, de quatre mètres, la Blessure qui file à l'est et à
  // l'ouest jusqu'à l'horizon (coupée aux bornes, elle s'ouvrait sur le ciel). Deux maillages sur les mêmes
  // sommets : l'herbe là où l'on est en haut, la roche dans la Blessure
  const XS = [];
  for (let x = -LOIN; x < BORNES.x0; x += 4) XS.push(x);
  for (let x = BORNES.x0; x <= BORNES.x1; x++) XS.push(x);
  for (let x = BORNES.x1 + 4; x <= LOIN; x += 4) XS.push(x);
  // en z, d'un mètre autour de la Blessure ; de deux mètres plus au sud (l'autre rive, presque plate)
  const ZS = [];
  for (let z = BORNES.z0; z < -110; z += 2) ZS.push(z);
  for (let z = -110; z <= BORNES.z1; z++) ZS.push(z);
  const nx = XS.length, nz = ZS.length, pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = XS[i], z = ZS[j], k = j * nx + i;
    const y = relief(x, z);
    // une paroi tirée au cordeau a l'air d'un mur : ses sommets s'écartent un peu (le sol où l'on marche,
    // relief(), ne bouge pas ; l'écart, d'un mètre au plus, reste dans la roche)
    let dx = 0, dz = 0;
    if (Math.abs(relief(x, z - 1) - y) > 2 || Math.abs(relief(x, z + 1) - y) > 2) dz = Math.sin(x * 0.53 + y * 0.71) * 0.45 + Math.sin(x * 0.17 - y * 0.29) * 0.55;
    if (Math.abs(relief(x - 1, z) - y) > 2 || Math.abs(relief(x + 1, z) - y) > 2) dx = Math.sin(z * 0.61 + y * 0.83) * 0.25;
    pos.set([x + dx, y, z + dz], k * 3); uv.set([(x + y) / 3, (z - y) / 3], k * 2);   // ± y : les parois, en travers de x comme de z, ne s'étirent pas
  }
  const haut = [], bas = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1, ys = [a, b, c, d].map((q) => pos[q * 3 + 1]);
    const cx = pos[a * 3], cz = pos[a * 3 + 2], esc = cx >= ESC.x0 - 1 && cx < ESC.x1 && cz > ESC.z1 && cz < SUD;   // le couloir de l'escalier : en roche
    (Math.min(...ys) > -1.5 && !esc ? haut : bas).push(a, c, b, b, c, d);
  }
  const fais = (idx, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const o = new THREE.Mesh(g, m); o.receiveShadow = true; scene.add(o); return o; };
  fais(haut, phMat('grass_ground', 1, 1, { color: 0x9aae78 }));
  // la roche : chaque triangle projeté sur le plan qui lui fait face (des sommets à lui) — avec des UV
  // partagés, une paroi en travers de x prenait u et v tous deux du seul y, et la pierre filait en stries
  { const n = bas.length, p = new Float32Array(n * 3), t = new Float32Array(n * 2), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
    for (let k = 0; k < n; k += 3) {
      A.fromArray(pos, bas[k] * 3); B.fromArray(pos, bas[k + 1] * 3); C.fromArray(pos, bas[k + 2] * 3);
      N.subVectors(C, B).cross(A.clone().sub(B)); const ax = Math.abs(N.x), ay = Math.abs(N.y), az = Math.abs(N.z);
      [A, B, C].forEach((v, q) => { p.set([v.x, v.y, v.z], (k + q) * 3);
        t.set(ay >= ax && ay >= az ? [v.x / 4, v.z / 4] : ax > az ? [v.z / 4, v.y / 4] : [v.x / 4, v.y / 4], (k + q) * 2); }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.BufferAttribute(t, 2)); g.computeVertexNormals();
    const o = new THREE.Mesh(g, phMat('falaise_02', 1, 1, { color: 0xb8ae9c })); o.receiveShadow = true; scene.add(o); }
  // au-delà des bornes, la plaine qui file à l'horizon
  // (quatre bandes autour des bornes : un seul plan à −0,4 m comblait la Blessure, vue d'en haut)
  const herbe = phMat('grass_ground', 1, 1, { color: 0x8a9e6c }), L = 1500;
  for (const [x0, x1, z0, z1] of [[-L, L, -L, BORNES.z0 + 0.5], [-L, L, BORNES.z1 - 0.5, L], [-L, -LOIN + 0.5, BORNES.z0, BORNES.z1], [LOIN - 0.5, L, BORNES.z0, BORNES.z1]]) {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), herbe.clone()); o.material.map = o.material.map && o.material.map.clone(); if (o.material.map) { o.material.map.repeat.set((x1 - x0) / 10, (z1 - z0) / 10); o.material.map.needsUpdate = true; }
    o.rotation.x = -Math.PI / 2; o.position.set((x0 + x1) / 2, -0.4, (z0 + z1) / 2); scene.add(o); }
}
function riviere() {
  const m = new THREE.MeshStandardMaterial({ color: 0x5a7a8c, roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.88 });
  R.eau = new THREE.Mesh(new THREE.PlaneGeometry(2 * LOIN, RIVIERE[1] - RIVIERE[0], 240, 4), m);
  { const p = R.eau.geometry.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) - courbe(p.getX(k))); }   // la rivière suit la Blessure
  R.eau.rotation.x = -Math.PI / 2; R.eau.position.set(0, EAU, 0); scene.add(R.eau);
}
function escalier() {
  // les marches taillées (le relief les porte ; elles se voient en pierre de taille)
  const pierre = phMat('ruines_02', 1, 1, { color: 0xc8bca4 });
  const n = Math.ceil((SUD - ESC.z1) / ESC.pas);
  for (let k = 0; k < n; k++) { const t = (k + 0.5) * ESC.pas, z = SUD - t;
    if (TROUS.some(([a, b]) => t >= a && t < b)) continue;
    const y = FOND + k * ESC.haut, o = mesh(boxG(ESC.x1 - ESC.x0, 0.5, ESC.pas), pierre, 0, y - 0.17, z); o.receiveShadow = true; scene.add(o); }   // un peu au-dessus du relief : la pierre de taille se voit
  // les trois blocs tombés, au pied de l'escalier, sur le fond
  TROUS.forEach(([a, b], i) => { const o = mesh(boxG(3.6, 1.6, 1.6), pierre, 6 + i * 3.5, FOND + 0.8, SUD + 3); o.castShadow = true; scene.add(o); R.blocs.push({ o, i, a, b }); });
  majBlocs();
}
// un bloc poussé reprend sa place dans l'escalier
function majBlocs() {
  for (const b of R.blocs) if (marches() > b.i) { const t = (b.a + b.b) / 2, k = Math.floor(b.a / ESC.pas); b.o.position.set(0, FOND + k * ESC.haut - 0.8, SUD - t); b.o.scale.set((ESC.x1 - ESC.x0) / 3.6, 1, 1); }
}
function pont() {
  // le pont des géants : un tablier de pierre de 54 m, sur sa charnière côté autre rive ; relevé, il
  // se dresse au-dessus de la Blessure depuis 620
  const g = new THREE.Group(); g.position.set((PONT.x0 + PONT.x1) / 2, 0, SUD); scene.add(g);
  // un pont de pierre, pas une poutre : un tablier épais, des parapets, des voussoirs dessous (la pierre
  // de ruines_02 rendait presque noir à cette échelle, rock_wall_14 du liège : la roche des parois)
  const L = BORD_N - SUD, W = PONT.x1 - PONT.x0, pierre = phMat('falaise_02', 1, 10, { color: 0xd0c4ac }), bord = phMat('falaise_02', 1, 6, { color: 0xc0b49c });
  const tab = mesh(boxG(W + 0.6, 1.6, L), pierre, 0, -0.6, L / 2); tab.castShadow = tab.receiveShadow = true; g.add(tab);
  for (const sx of [-1, 1]) { const p = mesh(boxG(0.5, 1, L), bord, sx * (W / 2 + 0.05), 0.7, L / 2); p.castShadow = true; g.add(p); }
  for (let k = 1; k < 9; k++) { const c = mesh(boxG(W - 0.4, 1.2, 0.7), bord, 0, -1.9, (k / 9) * L); g.add(c); }   // les nervures sous le tablier
  R.pont = g;
  for (const sx of [-1, 1]) { const p = mesh(boxG(1.4, 6, 1.4), bord, 0, 0, 0); p.castShadow = true; scene.add(p); p.position.set(g.position.x + sx * (W / 2 + 1.2), 3, SUD - 1.5); }
  majPont();
}
function majPont() { R.pont.rotation.x = pontBas() ? 0 : -1.35; }
function lointain() {
  // le beffroi de Lille, au loin vers le nord : une silhouette dans la brume
  const pierre = phMat('ruines_03', 2, 8, { color: 0x6a6a72 }), g = new THREE.Group(); g.position.set(-60, 0, 700); scene.add(g);
  g.add(mesh(boxG(12, 70, 12), pierre, 0, 35, 0), mesh(boxG(8, 14, 8), pierre, 0, 77, 0), mesh(new THREE.ConeGeometry(5, 14, 8), pierre, 0, 91, 0));
  // quelques arbres sur les deux bords (la forêt du Buc, au lot 2)
  const esp = especeGeo('hetre'); if (!esp) return;
  const places = [];
  // en bosquets (une plaine semée au hasard a l'air d'un jeu) : 26 centres, 8 arbres autour de chacun
  const centres = [];
  for (let k = 0; k < 26; k++) { const nord = k % 3 === 0; centres.push([BORNES.x0 + 10 + Math.random() * (BORNES.x1 - BORNES.x0 - 20), nord ? BORD_N + 14 + Math.random() * 30 : SUD - 16 - Math.random() * 120]); }
  for (let k = 0; k < 208; k++) { const [cx, cz] = centres[k % 26], a = Math.random() * TAU, d = Math.random() * 11, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (z < BORD_N + 4 && z > SUD - 4) continue;
    if (Math.abs(x - DEPART.x) < 10 && Math.abs(z - DEPART.z) < 10) continue; if (pasIci(x, z)) continue; if (x > ESC.x0 - 6 && x < ESC.x1 + 6 && z > ESC.z1 - 6) continue; if (x > PONT.x0 - 8 && x < PONT.x1 + 8) continue;
    places.push([x, z]); }
  const tr = new THREE.InstancedMesh(esp.tronc, esp.matT, places.length), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, places.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  places.forEach(([x, z], k) => { const h = 8 + Math.random() * 4; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * TAU); s.set(h, h, h); m4.compose(v.set(x, relief(x, z) - 0.2, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); tronc(x, z); });
  tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
  // les éboulis : des blocs tombés des parois, au fond et sur les corniches (jamais sur les passages)
  const roc = phMat('falaise_02', 1, 1, { color: 0xa89e8c }), eb = [];
  for (let k = 0; k < 90; k++) { const x = BORNES.x0 + 4 + Math.random() * (BORNES.x1 - BORNES.x0 - 8), z = SUD + 0.5 + Math.random() * (BORD_N - SUD - 1);
    if (Math.abs(x - ANCRES[0][0]) < 5 || (x > PONT.x0 - 3 && x < PONT.x1 + 3) || (x > ESC.x0 - 4 && x < 20 && z < SUD + 6) || dansRiviere(x, z)) continue; eb.push([x, z]); }
  const ro = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), roc, eb.length), m5 = new THREE.Matrix4();
  eb.forEach(([x, z], k) => { const r = 0.4 + Math.random() ** 2 * 2.2; q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)); s.set(r, r * 0.7, r * 1.1);
    m5.compose(v.set(x, relief(x, z) + r * 0.25, z), q, s); ro.setMatrixAt(k, m5); });
  ro.castShadow = ro.receiveShadow = true; scene.add(ro);
  // la croix de chemin, au bord, côté Lille (SCENARIO.md : « une prairie, une croix de chemin, le vent »)
  const cr = phMat('ruines_02', 1, 1, { color: 0x9a9284 }), cx = DEPART.x + 7, cz = DEPART.z + 2;
  scene.add(mesh(boxG(0.35, 3, 0.35), cr, cx, 1.5, cz), mesh(boxG(1.5, 0.3, 0.3), cr, cx, 2.3, cz), mesh(boxG(1.2, 0.5, 1.2), cr, cx, 0.1, cz));
  tronc(cx, cz);
}

// ---------- l'autre rive (lot 2) : la fontaine, les traces, la forêt du Buc, la forge, les ruines ----------
// là où ne pousse aucun arbre : les lieux de l'acte et leurs abords
function pasIci(x, z) {
  return Math.hypot(x - FONTAINE[0], z - FONTAINE[1]) < 9 || Object.values(TRACES).some(([a, b]) => Math.hypot(x - a, z - b) < 5)
    || Math.hypot(x - FORGE.x, z - FORGE.z) < 17 || Math.hypot(x - RUINES.x, z - RUINES.z) < RUINES.r + 4;
}
function trace6(k, texte) { state.traces6 = { ...(state.traces6 || {}), [k]: true }; saveGame(true); showMessage(texte, 5); }
// un mot gravé dans la pierre (le vers de la tombe, le nom de l'enfant) : peint une fois, posé en relief sombre
function gravure(lignes, w, h, taille = 46) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const g = c.getContext('2d');
  g.font = `italic ${taille}px Georgia, serif`; g.textAlign = 'center'; g.fillStyle = 'rgba(28,22,16,0.85)';
  lignes.forEach((l, k) => g.fillText(l, 512, c.height / 2 + (k - (lignes.length - 1) / 2) * taille * 1.35 + taille * 0.35));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1 }));
}
function autreRive() {
  // (la roche des parois, comme le pont : ruines_02 et ruines_03 rendaient presque noir ici)
  const pierre = phMat('falaise_02', 1, 1, { color: 0xd0c4ac }), bois = phMat('wood_planks', 0.3, 1.2, { color: 0x6a5a42 });
  const arbres = [];
  // la fontaine de l'ermite : une margelle sous un grand chêne, une eau claire
  { const [x, z] = FONTAINE, y = relief(x, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 20, 1, true), pierre); m.position.set(x, y + 0.3, z); scene.add(m);
    const eau = new THREE.Mesh(new THREE.CircleGeometry(1.65, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a8a94, roughness: 0.08, metalness: 0.3 })); eau.position.set(x, y + 0.45, z); scene.add(eau);
    MURS.push([x - 1.8, z - 1.8, x + 1.8, z + 1.8]); arbres.push([x + 5, z - 3, 15]);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 3.2, prompt: () => 'regarder dans l’eau', fn: () => trace6('fontaine', 'Dans l’eau, un instant : un vieil homme qui berce un enfant, une biche qui boit. Puis plus rien.') }); }
  // les trois traces de Lydéric enfant
  { const [x, z] = TRACES.epee, y = relief(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = 0.12; scene.add(g);
    g.add(mesh(boxG(0.07, 0.9, 0.03), bois, 0, 0.45, 0), mesh(boxG(0.36, 0.06, 0.05), bois, 0, 0.72, 0));
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 2.4, prompt: () => 'regarder', fn: () => trace6('epee', 'Une petite épée de bois, plantée dans la mousse. Taillée par un enfant.') }); }
  { const [x, z] = TRACES.pierre, y = relief(x, z), b = mesh(boxG(1.6, 1.1, 0.9), pierre, x, y + 0.45, z); b.rotation.y = 0.4; b.castShadow = true; scene.add(b);
    const n = gravure(['LIDERIC'], 1.2, 0.4, 120); n.position.set(x + Math.sin(0.4) * 0.46, y + 0.6, z + Math.cos(0.4) * 0.46); n.rotation.y = 0.4; n.rotation.z = -0.08; scene.add(n);
    MURS.push([x - 0.9, z - 0.9, x + 0.9, z + 0.9]);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 2.6, prompt: () => 'lire la pierre', fn: () => trace6('pierre', 'Gravé de travers, sur une pierre : LIDERIC.') }); }
  { const [x, z] = TRACES.cabane, y = relief(x, z); arbres.push([x, z, 14]);
    // un plancher de planches à quatre mètres, des montants, le toit tombé au pied de l'arbre
    scene.add(mesh(boxG(2.6, 0.12, 2.2), bois, x + 0.6, y + 4, z), mesh(boxG(0.1, 1, 0.1), bois, x + 1.8, y + 4.5, z - 1), mesh(boxG(0.1, 1, 0.1), bois, x + 1.8, y + 4.5, z + 1));
    const toit = mesh(boxG(2.4, 0.08, 1.6), bois, x + 2.4, y + 0.3, z + 1.6); toit.rotation.set(0.2, 0.5, 0.35); scene.add(toit);
    addInteract({ pos: new THREE.Vector3(x + 1.5, y, z), r: 3, prompt: () => 'regarder en l’air', fn: () => trace6('cabane', 'Une cabane d’enfant, dans un chêne. Le toit est tombé depuis longtemps.') }); }
  // la forêt du Buc : dense, des hêtres et des chênes ; on s'y guide à la fumée de la forge
  const foret = [];
  for (let k = 0; k < 2600 && foret.length < 520; k++) { const x = FORET.x0 + Math.random() * (FORET.x1 - FORET.x0), z = FORET.z0 + Math.random() * (FORET.z1 - FORET.z0);
    if (pasIci(x, z) || foret.some(([a, b]) => Math.abs(a - x) < 3.2 && Math.abs(b - z) < 3.2)) continue; foret.push([x, z, 9 + Math.random() * 6]); }
  const planter = (esp, l) => { if (!esp || !l.length) return;
    const tr = new THREE.InstancedMesh(esp.tronc, esp.matT, l.length), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, l.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    l.forEach(([x, z, h], k) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * TAU); s.set(h, h, h); m4.compose(v.set(x, relief(x, z) - 0.2, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); tronc(x, z); });
    tr.castShadow = hp.castShadow = true; scene.add(tr, hp); };
  planter(especeGeo('hetre'), foret.filter((_, k) => k % 3)); planter(especeGeo('chene'), [...arbres, ...foret.filter((_, k) => !(k % 3))]);
  forge(pierre, bois); ruines(pierre);
}

// la forge de maître Cornil, au fond de la forêt : quatre murs, un toit de planches, la cheminée qui fume
function forge(pierre, bois) {
  const { x, z } = FORGE, y = relief(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const W = 8, D = 6, H = 3.2;
  for (const [lx, lz, w, d] of [[0, -D / 2, W, 0.5], [-W / 2, 0, 0.5, D], [W / 2, 0, 0.5, D], [-2.6, D / 2, 2.8, 0.5], [2.6, D / 2, 2.8, 0.5]]) {
    const m = mesh(boxG(w, H, d), pierre, lx, H / 2, lz); m.castShadow = m.receiveShadow = true; g.add(m); MURS.push([x + lx - w / 2, z + lz - d / 2, x + lx + w / 2, z + lz + d / 2]); }
  for (const s of [-1, 1]) { const t = mesh(boxG(W + 1, 0.15, D / 2 + 0.9), bois, 0, H + 0.9, s * D / 4); t.rotation.x = -s * 0.5; t.castShadow = true; g.add(t); }
  const che = mesh(boxG(1.2, 5.5, 1.2), pierre, -W / 2 + 1, 2.75, -D / 2 + 0.9); che.castShadow = true; g.add(che);
  // le four : une gueule rouge, une lumière qui palpite
  g.add(mesh(boxG(1.8, 1.4, 1.2), pierre, -W / 2 + 1.3, 0.7, -D / 2 + 1));
  const braise = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); braise.position.set(-W / 2 + 1.3, 0.6, -D / 2 + 1.61); g.add(braise);
  R.feu = new THREE.PointLight(0xff8a3a, 4, 14, 1.6); R.feu.position.set(-W / 2 + 1.3, 1.2, -D / 2 + 2.2); g.add(R.feu);
  const fer = new THREE.MeshStandardMaterial({ color: 0x3a3836, metalness: 0.8, roughness: 0.45 });
  g.add(mesh(boxG(0.9, 0.35, 0.35), fer, 1.2, 0.85, -0.8), mesh(boxG(0.35, 0.7, 0.35), fer, 1.2, 0.35, -0.8));   // l'enclume
  // le moule de la Grande Cloche, dehors : une cloche de terre cuite, haute comme Camille
  const prof = [[0, 0], [1.25, 0], [1.3, 0.15], [1.12, 0.6], [0.95, 1.5], [0.8, 2.0], [0.45, 2.25], [0, 2.3]].map(([r, h]) => new THREE.Vector2(r, h));
  R.moule = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), phMat('falaise_02', 1, 1, { color: 0x9a6a48 })); R.moule.position.set(x + 7, y, z + 6); R.moule.castShadow = true; scene.add(R.moule);
  MURS.push([x + 5.6, z + 4.6, x + 8.4, z + 7.4]);
  // la Grande Cloche, neuve : cachée jusqu'à la fonte
  R.cloche = new THREE.Mesh(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(v.x * 0.92, v.y * 0.95)), 32), new THREE.MeshStandardMaterial({ color: 0xb8864a, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  R.cloche.position.copy(R.moule.position); R.cloche.castShadow = true; R.cloche.visible = !!state.grandeCloche; R.moule.visible = !state.grandeCloche; scene.add(R.cloche);
  R.moule.userData.dynamic = R.cloche.userData.dynamic = true;   // la fusion du moteur les figerait
  // la fumée : des boules grises qui montent de la cheminée et s'effacent (on la voit au-dessus des arbres)
  R.fumee = []; const fm = new THREE.MeshStandardMaterial({ color: 0x8a8884, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
  for (let k = 0; k < 14; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), fm.clone()); b.userData.smoke = k; b.userData.t = k / 14; scene.add(b); R.fumee.push(b); }
  R.chemine = new THREE.Vector3(x - W / 2 + 1, y + 5.6, z - D / 2 + 0.9);
  // maître Cornil, devant sa porte
  const c = PNJ.buildRole('a6_cornil'); if (c) { c.scale.setScalar(G.echelle); c.position.set(x + 1.5, y, z + D / 2 + 1.4); c.rotation.y = 0.3; scene.add(c); R.cornil = c; }
  addInteract({ pos: new THREE.Vector3(x + 1.5, y, z + D / 2 + 1.4), r: 3, prompt: () => 'parler', fn: parleCornil });
}
Object.assign(PNJ.ROLES, {
  a6_cornil: { ...PNJ.ROLES.aubergiste, cheveuxC: 0xd4d0c8, haut: 0x5a4636, valeur: 0.8, bas: 0x2e2620, valeurBas: 0.8, idle: 'Idle_Loop' },
  a6_bandit: { ...PNJ.ROLES.roquette_batut, gabarit: 'sec', haut: 0x3a3428, valeur: 0.7, bas: 0x24201a, valeurBas: 0.7, idle: 'Idle_Loop' },
  a6_chef: { ...PNJ.ROLES.roquette_beauregard, haut: 0x2a1a14, valeur: 0.7, bas: 0x1e1a16, valeurBas: 0.7, idle: 'Idle_Loop' },
});
const C6 = (...t) => t.map((text) => ({ who: 'Maître Cornil', text }));
function parleCornil() {
  if (!passe6('forge')) return dialogue(C6('Une visiteuse. Depuis le temps, j’avais cessé de compter.',
    'Ma famille garde **le moule de la Grande Cloche** depuis 620. Les morceaux, tu les as ? Bien.',
    'Il manque **le métal du cœur du Dormeur**. Le cœur d’un géant ne fond pas comme le bronze. **Au fond de la mine de l’Aveyron**, sous l’eau.'), () => passer6('forge'));
  if (!passe6('metal')) return dialogue(C6('Le métal du cœur du Dormeur. **Au fond de la mine de l’Aveyron**, sous l’eau.'));
  if (!passe6('tombe')) return dialogue(C6('Tu l’as. Alors **va voir la tombe du prince**, dans les ruines. Je ferai chauffer le four.'));
  if (!passe6('cloche')) return fonte();
  if (state.acte7) return dialogue(C6('Ils sont partis par le pont des géants. **Vers le Temple.**'));
  dialogue(C6('Elle sonnera une fois. Une seule. Choisis bien le moment.'), volee);
}
// la fonte (lot 4) : la nuit tombe, le bronze coule dans le moule ; au matin, la cloche est neuve
function fonte() {
  if (R.fonte) return;
  dialogue(C6('Le four est chaud. Le métal du géant d’abord, les morceaux ensuite.'), () => {
    R.fonte = { t: 0 }; state.paused = false;
    R.jour = { sun: sun.intensity, hemi: hemi.intensity, expo: renderer.toneMappingExposure };
    sun.intensity = 0.15; hemi.intensity = 0.25; renderer.toneMappingExposure = 0.8;
    const M = R.moule.position;
    G.freeCam = { pos: new THREE.Vector3(M.x + 6, M.y + 3.5, M.z + 7), at: new THREE.Vector3(M.x, M.y + 1.5, M.z) };
    R.coulee = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8), new THREE.MeshBasicMaterial({ color: 0xffa040 })); R.coulee.position.set(M.x, M.y + 3.6, M.z); scene.add(R.coulee);
    showMessage('La nuit. Le bronze coule dans le moule.', 5); SFX.stomp && SFX.stomp();
  });
}
function animeFonte(dt) {
  const F = R.fonte; if (!F) return;
  F.t += dt; R.coulee.material.color.setHSL(0.08, 1, 0.5 + Math.sin(F.t * 9) * 0.08);
  if (F.t > 5 && R.coulee.visible) { R.coulee.visible = false; R.moule.material = R.moule.material.clone(); R.moule.material.emissive = new THREE.Color(0x6a1a04); }
  if (F.t > 7 && !F.casse) { F.casse = true; SFX.stomp && SFX.stomp(); R.moule.visible = false; R.cloche.visible = true;
    sun.intensity = R.jour.sun; hemi.intensity = R.jour.hemi; renderer.toneMappingExposure = R.jour.expo; }
  if (F.t > 8.5) { R.fonte = null; G.freeCam = null; state.grandeCloche = true; passer6('cloche'); SFX.fanfare && SFX.fanfare();
    dialogue([{ who: '', text: 'Au matin, on casse le moule. La Grande Cloche est là, neuve. Elle n’a pas encore sonné.' }, ...C6('Elle sonnera une fois. Une seule. Choisis bien le moment.')], volee); }
}
// la cloche volée (acte VII, étape 1 : Eugène, 12 octobre, « Phinaert la vole ») : la nuit suivante, Phinaert
// vient la prendre, Eugène avec lui ; au matin, la forge est ouverte et la cloche partie
const VOLEE = () => C6('Il est venu cette nuit. Je n’ai rien pu faire.', 'Il avait un garçon avec lui. Le garçon m’a regardé comme on demande pardon.', 'Ils sont partis par le pont des géants. **Vers le Temple.**');
function volee() {
  fadeTo(1, () => { state.acte7 = 'volee'; saveGame(true); R.cloche.visible = false;
    setTimeout(() => fadeTo(0, null), 700);
    dialogue([{ who: '', text: 'La nuit suivante. Au matin, la porte de la forge bat au vent. La cloche n’est plus là.' }, ...VOLEE()]); });
}

// les ruines du château du Buc, le château de Phinaert : des pans de murs sur la butte, la tombe au milieu
function ruines(pierre) {
  const { x, z } = RUINES, y = relief(x, z), vieux = phMat('falaise_02', 1, 1, { color: 0xb0a898 });
  // l'enceinte : un carré de 24 m, des pans à hauteurs inégales, deux brèches (au nord, vers la Blessure, et à l'ouest, vers la forge)
  const L = 24, pans = [];
  for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) { if ((k === 0 && i === 2) || (k === 3 && i === 3)) continue;
    const t = -L / 2 + (i + 0.5) * L / 6, ht = 1.5 + ((i * 7 + k * 3) % 5) * 0.9;
    const [lx, lz, w, d] = k === 0 ? [t, L / 2, L / 6, 1] : k === 1 ? [t, -L / 2, L / 6, 1] : k === 2 ? [L / 2, t, 1, L / 6] : [-L / 2, t, 1, L / 6];
    pans.push([x + lx, z + lz, w, d, ht]); }
  pans.push([x - 4, z - 6, 1, 5, 6.5], [x + 5, z - 7, 6, 1, 4.5]);   // le donjon, deux pans encore debout
  for (const [px, pz, w, d, ht] of pans) { const m = mesh(boxG(w, ht, d), vieux, px, y + ht / 2 - 0.3, pz); m.castShadow = m.receiveShadow = true; scene.add(m); MURS.push([px - w / 2, pz - d / 2, px + w / 2, pz + d / 2]); }
  // la tombe du prince Salvaert : une dalle sur un socle, le vers gravé sur la tranche
  const tx = x, tz = z + 2, socle = mesh(boxG(2.2, 0.8, 3.2), pierre, tx, y + 0.4, tz), dalle = mesh(boxG(2.4, 0.2, 3.4), vieux, tx, y + 0.9, tz);
  socle.castShadow = dalle.castShadow = true; scene.add(socle, dalle); MURS.push([tx - 1.2, tz - 1.7, tx + 1.2, tz + 1.7]);
  const v = gravure(['Le sang de Lydéric fermera la porte,', 'et de l’autre côté restera.'], 2.1, 0.7, 52); v.position.set(tx, y + 0.45, tz + 1.61); scene.add(v);
  addInteract({ pos: new THREE.Vector3(tx, y, tz + 2.4), r: 2.6, prompt: () => (bandeDebout() ? 'la tombe' : 'lire la tombe'), fn: tombe });
}
// la bande du Buc : cinq bandits et leur chef, quand Camille approche des ruines (une fois vaincue, plus jamais)
Object.assign(KINDS, {
  bandit6: { hp: 6, speed: 4.6, dmg: 1, range: 1.9, aggro: 22, windup: 0.55, cd: 1.4, fly: 0, r: 0.55, label: 'Bandit du Buc', barY: 2.1 },
  chef6: { hp: 14, speed: 4.4, dmg: 2, range: 2.1, aggro: 30, windup: 0.6, cd: 1.2, fly: 0, r: 0.6, label: 'Le chef des bandits', barY: 2.2 },
});
for (const [k, role] of [['bandit6', 'a6_bandit'], ['chef6', 'a6_chef']]) {
  setMaker(k, () => { const g = PNJ.buildRole(role) || new THREE.Group(); g.scale.setScalar(G.echelle); g.userData.anim = true; return g; });
  setAnimHook(k, (e, dt, v) => { if (e.mesh.userData.ctrl) PNJ.animeVillageois(e.mesh, dt, v > 0.4); return true; });
}
const bandeDebout = () => !!(R.bande && R.bande.some((e) => !e.dead));
function veilleBande() {
  if (state.bande6 || R.bande || !passe6('rive')) return;
  if (Math.hypot(player.pos.x - RUINES.x, player.pos.z - RUINES.z) > 46) return;
  R.bande = [['chef6', 0, 6], ['bandit6', -5, 3], ['bandit6', 5, 3], ['bandit6', -3, -4], ['bandit6', 4, -3], ['bandit6', 0, 9]]
    .map(([k, lx, lz]) => spawnEnemy(k, RUINES.x + lx, RUINES.z + lz, 'acte6'));
  dialogue([{ who: 'Le chef des bandits', text: 'Le château de Phinaert est à nous. Il nous l’a promis.' }]);
}
function tombe() {
  if (bandeDebout()) return showMessage('Pas avec les bandits sur le dos.', 3);
  if (!passe6('metal')) return showMessage('Une tombe de prince, sous le lierre. Gravé sur la tranche, un vers ; on dirait qu’il attend son heure.', 5);
  dialogue([{ who: '', text: 'Gravé : « *Le sang de Lydéric fermera la porte, et de l’autre côté restera.* »' },
    { who: 'Camille', text: 'Qui restera de l’autre côté ?' },
    { who: 'Camille', text: '(la main sur la pierre) **Ce que la garde commence, la garde l’achève.**' }], () => { state.vers6 = true; passer6('tombe'); });
}

// ---------- les gestes : le lasso, les blocs, le treuil, la fêlure ----------
// les ancrages du lasso : le bord, les deux corniches, le fond — un vieux pieu à chacun
const ANCRES = [[-20, 41.5, 0], [-20, 38.2, -8], [-20, 34.7, -16], [-20, 31, FOND]];
const VERS_ILE = ['temple', [-20.35, 0, 11.75], 2.094, 'La fêlure se referme derrière toi…'];
function gestes() {
  const bois = phMat('wood_planks', 0.3, 1.2, { color: 0x6a5a42 });
  ANCRES.forEach(([x, z, y], i) => { const p = mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.3, 8), bois, x, y + 0.65, z); p.castShadow = true; scene.add(p);
    if (i < ANCRES.length - 1) addInteract({ pos: new THREE.Vector3(x, y, z), r: 2.4, prompt: () => 'descendre au lasso', fn: () => lasso(i, i + 1) });
    if (i > 0) addInteract({ pos: new THREE.Vector3(x, y, z), r: 2.4, prompt: () => 'remonter au lasso', fn: () => lasso(i, i - 1) }); });
  for (const b of R.blocs) addInteract({ pos: b.o.position, r: 2.8, prompt: () => 'pousser le bloc dans l’escalier', enabled: () => marches() <= b.i && b.o.position.y < FOND + 1,
    fn: () => { if (!state.force) return showMessage('Une marche de géant, tombée. Elle ne bouge pas.', 3);
      state.marches6 = marches() + 1; SFX.stomp && SFX.stomp(); majBlocs(); saveGame(true);
      showMessage(marches() >= 3 ? 'La dernière marche reprend sa place. L’escalier des géants est entier.' : 'Camille pousse. Le bloc remonte la pente et se loge dans l’escalier.', 4);
      if (marches() >= 3) passer6('escalier'); } });
  // le treuil du pont, en haut de l'autre rive
  const tx = PONT.x1 + 4, tz = SUD - 4, treuil = mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 14), bois, tx, 1.2, tz); treuil.rotation.z = Math.PI / 2; treuil.castShadow = true; scene.add(treuil);
  addInteract({ pos: new THREE.Vector3(tx, relief(tx, tz), tz), r: 3, prompt: () => (pontBas() ? 'le pont des géants' : 'tourner le treuil du pont'), fn: () => {
    if (pontBas()) return showMessage('Le pont des géants, abaissé. Le chemin de la fêlure, à pied.', 3);
    if (!state.force) return showMessage('Un treuil de géant. Il ne tourne pas d’un cran.', 3);
    state.pont6 = true; majPont(); SFX.stomp && SFX.stomp(); saveGame(true); passer6('rive');
    showMessage('Le pont des géants s’abaisse, pierre contre pierre. Après mille ans, il tient encore.', 5); } });
  // la fêlure : le retour vers l'île, là où l'on est arrivé
  addInteract({ pos: new THREE.Vector3(DEPART.x, relief(DEPART.x, DEPART.z + 3), DEPART.z + 3), r: 2.6, prompt: () => 'repasser la fêlure', fn: () => goToLevel(...VERS_ILE) });
}
// le lasso : une descente (ou une remontée) d'une corniche à la suivante, en une seconde ; le geste est
// celui du moteur (engine.js, passe D3), la corde nouée au pieu du haut
function lasso(i, j) {
  const [x0, z0, y0] = ANCRES[i], [x1, z1, y1] = ANCRES[j], [xa, za, ya] = ANCRES[Math.min(i, j)];
  state.paused = false;
  lassoMoteur([x1, y1, z1 + (j > i ? -1.2 : 0)], [xa, ya + 1.2, za], { dur: 1, sansCorde: 'Trop haut. Il me faudrait une corde.',
    fin: () => { if (y1 <= FOND + 0.1) passer6('descente'); } });
}

// ---------- le niveau ----------
function build() {
  makeSky(0x6a7f98, 0xb8c4cc, 0xd8d8d0, true);
  scene.fog = new THREE.Fog(0xc8ccc8, 80, 640);
  hemi.intensity = 0.75; hemi.color.setHex(0xe8eef4); hemi.groundColor.setHex(0x4a4a3a);
  sun.intensity = 2.2; sun.color.setHex(0xfff2e0); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 1, far: 500 }); sun.shadow.camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.12;
  terrain(); riviere(); escalier(); pont(); lointain(); autreRive(); gestes();
}
function populate() { player.pos.set(DEPART.x, relief(DEPART.x, DEPART.z), DEPART.z); player.yaw = DEPART.yaw; G.camYaw = DEPART.yaw; }
let camPosee = false, tAvant = 0;
function animate(now) {
  const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
  if (!camPosee && state.running && !state.paused) { G.camYaw = player.yaw; camPosee = true; }
  if (!state.running) return;
  if (!passe6('bord')) passer6('bord');
  // de l'autre côté de la rivière, au fond : la rivière est passée
  const p = player.pos; if (p.z < RIVIERE[0] - 0.5 && p.y < FOND + 2 && p.z > SUD - 1) passer6('riviere');
  if (R.eau) R.eau.position.y = EAU + Math.sin(now / 700) * 0.04;
  veilleBande(); animeFonte(dt);
  // la cloche et le moule selon l'état (le lieu se bâtit avant que la sauvegarde ne soit lue)
  if (!R.fonte && R.cloche) { R.cloche.visible = !!state.grandeCloche && !state.acte7; R.moule.visible = !state.grandeCloche; }
  if (R.bande && !bandeDebout() && !state.bande6) { state.bande6 = true; saveGame(true); showMessage('Les bandits sont à terre. Au milieu des ruines, une tombe.', 4); }
  if (R.cornil && R.cornil.userData.ctrl) PNJ.animeVillageois(R.cornil, dt, false);
  if (R.feu) R.feu.intensity = (R.fonte ? 14 : 4) + Math.sin(now / 90) * 0.6 + Math.sin(now / 37) * 0.4;
  for (const b of R.fumee || []) { b.userData.t = (b.userData.t + dt * 0.08) % 1; const t = b.userData.t;
    b.position.set(R.chemine.x + t * 6, R.chemine.y + t * 22, R.chemine.z - t * 3); b.scale.setScalar(0.6 + t * 3.2); b.material.opacity = 0.5 * (1 - t); }
}
function objectif() {
  if (!passe6('descente')) return state.lasso ? 'Descends dans la Blessure au lasso, de corniche en corniche (le vieux pieu, à l’ouest)' : 'La Blessure : il faudrait une corde pour descendre';
  if (!passe6('riviere')) return state.souffle ? 'Traverse la rivière glacée du fond' : 'La rivière glacée coupe le souffle';
  if (!passe6('escalier')) return state.force ? `Remonte par l’escalier des géants : pousse les marches tombées (${marches()} / 3)` : 'Les marches de l’escalier des géants sont tombées : trop lourdes';
  if (!passe6('rive')) return 'En haut de l’autre rive : abaisse le vieux pont des géants (le treuil, à l’est)';
  if (!passe6('forge')) return 'L’autre rive. La forge de maître Cornil est quelque part dans la forêt du Buc (la fumée, au sud-ouest)';
  if (!passe6('metal')) return 'Le métal du cœur du Dormeur : au fond de la mine de l’Aveyron, sous l’eau (la porte du Midi, sur l’île)';
  if (!passe6('tombe')) return 'La tombe du prince, dans les ruines du château du Buc (la butte, au sud-est)';
  if (!passe6('cloche')) return 'Retourne à la forge : maître Cornil fait chauffer le four';
  if (!state.acte7) return 'La Grande Cloche est neuve. Elle n’a pas encore sonné.';
  return 'Phinaert a pris la Grande Cloche. Le Temple : repasse la fêlure';
}
function minimap(g, W2) {
  const sc = W2 / 260, P = (x, z) => [W2 / 2 + (x - player.pos.x) * sc, W2 / 2 + (z - player.pos.z) * sc];
  g.fillStyle = '#7a8a5a'; g.fillRect(0, 0, W2, W2);
  { const [a, b] = P(BORNES.x0, SUD), [c, d] = P(BORNES.x1, BORD_N); g.fillStyle = '#8a8070'; g.fillRect(a, b, c - a, d - b); }
  { const [a, b] = P(BORNES.x0, RIVIERE[0]), [c, d] = P(BORNES.x1, RIVIERE[1]); g.fillStyle = '#5a7a8c'; g.fillRect(a, b, c - a, d - b); }
  { const [a, b] = P(ESC.x0, ESC.z1), [c, d] = P(ESC.x1, SUD); g.fillStyle = '#c8bca4'; g.fillRect(a, b, c - a, d - b); }
  if (pontBas()) { const [a, b] = P(PONT.x0, SUD), [c, d] = P(PONT.x1, BORD_N); g.fillStyle = '#b0a690'; g.fillRect(a, b, c - a, d - b); }
  { const [a, b] = P(FORET.x0, FORET.z0), [c, d] = P(FORET.x1, FORET.z1); g.fillStyle = '#4e6238'; g.fillRect(a, b, c - a, d - b); }
  { const [a, b] = P(RUINES.x, RUINES.z); g.fillStyle = '#9a948a'; g.beginPath(); g.arc(a, b, RUINES.r * sc * 0.6, 0, TAU); g.fill(); }
  if (passe6('rive')) { const [a, b] = P(FORGE.x, FORGE.z); g.fillStyle = '#e07a2a'; g.beginPath(); g.arc(a, b, 4, 0, TAU); g.fill(); }
  minimapDots(g, P);
}
function zoneName(x, z) {
  if (z >= BORD_N) return 'Le bord de la Blessure';
  if (z >= SUD) return 'La Blessure';
  if (Math.hypot(x - RUINES.x, z - RUINES.z) < RUINES.r) return 'Les ruines du château du Buc';
  if (Math.hypot(x - FORGE.x, z - FORGE.z) < 16) return 'La forge de maître Cornil';
  if (Math.hypot(x - FONTAINE[0], z - FONTAINE[1]) < 10) return 'La fontaine de l’ermite';
  if (x > FORET.x0 && x < FORET.x1 && z > FORET.z0 && z < FORET.z1) return 'La forêt du Buc';
  return 'L’autre rive';
}
const level = {
  name: 'rive', echelle: 0.6, musique: 'campagne', getH: (x, z) => sol(x, z), blocked, zoneName,
  nageIci: (x, z) => dansRiviere(x, z) && !!state.souffle,
  objective: objectif,
  build, populate, animate, minimap,
  counts: () => `<small>La rive oubliée</small><br><small>Objectif : ${objectif()}</small>`,
  start: () => showMessage('Le vent. Devant toi, la terre s’ouvre : la Blessure. De l’autre côté, l’autre rive, telle qu’en 620.', 6),
  arriveMessage: () => 'La rive oubliée.',
  entry: () => ({ title: 'La rive oubliée', sub: 'La Blessure — acte VI', cam: [60, 30, 90], at: [0, -10, 10], cam2: [8, 6, 64], at2: [0, -8, 30], dur: 6 }),
  onKill: () => {},
};
window.__rive = { R, ANCRES, TROUS, ESC, PONT, FONTAINE, TRACES, FORGE, RUINES, relief, sol };      // pour les bancs (bancs/acte6-*.mjs)
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
