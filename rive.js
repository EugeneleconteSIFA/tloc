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
import { THREE, TAU, scene, G, phMat, hemi, sun, renderer, bloom, mesh, boxG, PAGES,
  addInteract, goToLevel, showMessage, dialogue, bootLevel, minimapDots, makeSky, player, state, saveGame, SFX } from './engine.js?v=41';
import { especeGeo } from './foret.js';

// la page de la rive, pour goToLevel (engine.js n'est pas à E1 : la table se complète d'ici, et depuis
// temple.js qui y mène ; demande pour la passe D3 : l'inscrire dans PAGES, pour la reprise d'une partie)
PAGES.rive = 'rive.html';

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
const BORNES = { x0: -120, x1: 120, z0: -110, z1: 90 }, LOIN = 760;   // LOIN : jusqu'où la Blessure se voit
const DEPART = { x: 0, z: 55, yaw: Math.PI };
const marches = () => state.marches6 || 0;

// la plaine : quelques ondulations, à peine (la Flandre est plate)
const plaine = (x, z) => Math.sin(x * 0.045) * 0.35 + Math.cos(z * 0.06 + x * 0.02) * 0.3;
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
  return plaine(x, z);
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
  for (const t of TRONCS) if (Math.abs(x - t[0]) < 2 && Math.abs(z - t[1]) < 2 && Math.hypot(x - t[0], z - t[1]) < 0.6 + r) return true;
  return false;
}
const TRONCS = [];

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
  const nx = XS.length, nz = 201, pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = XS[i], z = BORNES.z0 + j, k = j * nx + i;
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
  for (let k = 0; k < 26; k++) { const nord = k % 3 === 0; centres.push([BORNES.x0 + 10 + Math.random() * (BORNES.x1 - BORNES.x0 - 20), nord ? BORD_N + 14 + Math.random() * 30 : SUD - 16 - Math.random() * 78]); }
  for (let k = 0; k < 208; k++) { const [cx, cz] = centres[k % 26], a = Math.random() * TAU, d = Math.random() * 11, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (z < BORD_N + 4 && z > SUD - 4) continue;
    if (Math.abs(x - DEPART.x) < 10 && Math.abs(z - DEPART.z) < 10) continue; if (x > ESC.x0 - 6 && x < ESC.x1 + 6 && z > ESC.z1 - 6) continue; if (x > PONT.x0 - 8 && x < PONT.x1 + 8) continue;
    places.push([x, z]); }
  const tr = new THREE.InstancedMesh(esp.tronc, esp.matT, places.length), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, places.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  places.forEach(([x, z], k) => { const h = 8 + Math.random() * 4; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * TAU); s.set(h, h, h); m4.compose(v.set(x, relief(x, z) - 0.2, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); TRONCS.push([x, z]); });
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
  TRONCS.push([cx, cz]);
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
// le lasso : une descente (ou une remontée) d'une corniche à la suivante, en une seconde
const LASSO = { de: null, vers: null, t: 0 };
function lasso(i, j) {
  if (!state.lasso) return showMessage('Trop haut. Il me faudrait une corde.', 3);
  if (LASSO.de) return;
  const [x0, z0, y0] = ANCRES[i], [x1, z1, y1] = ANCRES[j];
  LASSO.de = [x0, y0, z0 + (j > i ? -1.2 : 0)]; LASSO.vers = [x1, y1, z1 + (j > i ? -1.2 : 0)]; LASSO.t = 0; state.paused = false;
  SFX.swing && SFX.swing();
}
function animeLasso(dt) {
  if (!LASSO.de) return;
  LASSO.t = Math.min(1, LASSO.t + dt);
  const [a, b, c] = LASSO.de, [d, e, f] = LASSO.vers, t = LASSO.t, s = t * t * (3 - 2 * t);
  player.pos.set(a + (d - a) * s, b + (e - b) * s, c + (f - c) * s); player.vy = 0;
  if (t >= 1) { LASSO.de = null; if (LASSO.vers[1] <= FOND + 0.1) passer6('descente'); }
}

// ---------- le niveau ----------
function build() {
  makeSky(0x6a7f98, 0xb8c4cc, 0xd8d8d0, true);
  scene.fog = new THREE.Fog(0xc8ccc8, 80, 640);
  hemi.intensity = 0.75; hemi.color.setHex(0xe8eef4); hemi.groundColor.setHex(0x4a4a3a);
  sun.intensity = 2.2; sun.color.setHex(0xfff2e0); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 1, far: 500 }); sun.shadow.camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.12;
  terrain(); riviere(); escalier(); pont(); lointain(); gestes();
}
function populate() { player.pos.set(DEPART.x, relief(DEPART.x, DEPART.z), DEPART.z); player.yaw = DEPART.yaw; G.camYaw = DEPART.yaw; }
let camPosee = false, tAvant = 0;
function animate(now) {
  const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
  if (!camPosee && state.running && !state.paused) { G.camYaw = player.yaw; camPosee = true; }
  if (!state.running) return;
  if (!passe6('bord')) passer6('bord');
  animeLasso(dt);
  // de l'autre côté de la rivière, au fond : la rivière est passée
  const p = player.pos; if (p.z < RIVIERE[0] - 0.5 && p.y < FOND + 2 && p.z > SUD - 1) passer6('riviere');
  if (R.eau) R.eau.position.y = EAU + Math.sin(now / 700) * 0.04;
}
function objectif() {
  if (!passe6('descente')) return state.lasso ? 'Descends dans la Blessure au lasso, de corniche en corniche (le vieux pieu, à l’ouest)' : 'La Blessure : il faudrait une corde pour descendre';
  if (!passe6('riviere')) return state.souffle ? 'Traverse la rivière glacée du fond' : 'La rivière glacée coupe le souffle';
  if (!passe6('escalier')) return state.force ? `Remonte par l’escalier des géants : pousse les marches tombées (${marches()} / 3)` : 'Les marches de l’escalier des géants sont tombées : trop lourdes';
  if (!passe6('rive')) return 'En haut de l’autre rive : abaisse le vieux pont des géants (le treuil, à l’est)';
  return 'L’autre rive. La forge de maître Cornil est quelque part dans la forêt du Buc.';
}
function minimap(g, W2) {
  const sc = W2 / 260, P = (x, z) => [W2 / 2 + (x - player.pos.x) * sc, W2 / 2 + (z - player.pos.z) * sc];
  g.fillStyle = '#7a8a5a'; g.fillRect(0, 0, W2, W2);
  { const [a, b] = P(BORNES.x0, SUD), [c, d] = P(BORNES.x1, BORD_N); g.fillStyle = '#8a8070'; g.fillRect(a, b, c - a, d - b); }
  { const [a, b] = P(BORNES.x0, RIVIERE[0]), [c, d] = P(BORNES.x1, RIVIERE[1]); g.fillStyle = '#5a7a8c'; g.fillRect(a, b, c - a, d - b); }
  { const [a, b] = P(ESC.x0, ESC.z1), [c, d] = P(ESC.x1, SUD); g.fillStyle = '#c8bca4'; g.fillRect(a, b, c - a, d - b); }
  if (pontBas()) { const [a, b] = P(PONT.x0, SUD), [c, d] = P(PONT.x1, BORD_N); g.fillStyle = '#b0a690'; g.fillRect(a, b, c - a, d - b); }
  minimapDots(g, P);
}
function zoneName(x, z) {
  if (z >= BORD_N) return 'Le bord de la Blessure';
  if (z >= SUD) return 'La Blessure';
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
window.__rive = { R, ANCRES, TROUS, ESC, PONT, relief, sol };      // pour les bancs (bancs/acte6-*.mjs)
await PNJ.installerCamille(PNJ_E);
bootLevel(level, null);
