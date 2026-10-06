// Les Pouilles — gallipoli (pouilles.js : la fiche et l'habillage ; monde.js : la recette)
// =====================================================================
// Ce qui n'est qu'à Gallipoli, la ville de Nunzia :
//  - les REMPARTS sur la mer : l'enceinte d'OSM (que monde.js ne bâtit pas) montée en murs de
//    pierre dorée, du fond de l'eau jusqu'au parapet de la rue ;
//  - le PORT : les jetées et les quais d'OSM, qu'on parcourt à pied, et les barques de pêche ;
//  - la place du COLOSSE : le géant de bronze inventé qui garde le port (STORY.md, acte IV ;
//    son allure vient du colosse de Barletta), figé sur son socle pour l'instant ;
//  - NUNZIA sur le quai, à l'âge que l'acte IV lui a laissé (pouilles.js, roleNunzia) ;
//  - la GROTTE de l'acte IV (étape 8) : sous le château angevin, un banc de rochers que la mer
//    découvre à marée basse, de la jetée du Colosse à une bouche noire au pied du mur ; les
//    tarentules, et la corde du tambourin au fond ;
//  - la PLACE DE LA GARE, juste de l'autre côté du pont (Eugène, 2 octobre au soir : « une
//    place bien chaleureuse ») : dallée de pierre claire, une fontaine, des orangers en pots,
//    les tables d'un café sous leurs parasols, des bancs, et des guirlandes d'ampoules.
// =====================================================================
import { ville, GARES, etape4, passe4, passer4, indice4, roleNunzia, TEMPS, EN_INSTANCE, naitre4 } from './pouilles.js';
import { KINDS, setMaker, setAnimHook, spawnEnemy, player, showMessage, addInteract, saveGame, SFX } from './engine.js?v=41';
import { especeGeo } from './foret.js';
import { THREE, TAU, scene, phMat, mesh, boxG, dialogue, G, state } from './engine.js?v=41';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as PNJ from './pnj.js';

// la jetée en U de la Lega Navale, au sud du château angevin : le quai du Colosse
const COLOSSE = { x: 284, z: 32, yaw: -2.2 };
const NUNZIA = { x: 272, z: 40 };
const QUAIS = [];           // segments praticables : [ax, az, bx, bz, demi-largeur, y]
const BARQUES = [];
let HAUTEUR = null, colosse = null, nunzia = null, nunziaY = 0, fige = false, coule = 0, tAvant = 0, Y_MER = 0, BRONZE = null;
const couler = () => colosse.traverse((o) => { if (o.isMesh && o.material !== BRONZE) { o.material = BRONZE; o.castShadow = true; } });

// le sol des quais : monde.js le demande partout (solLieu) ; null hors des quais
function solQuai(x, z) {
  for (const [ax, az, bx, bz, w, y] of QUAIS) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    // le quai prolonge la terre ferme : là où la rive est plus haute que lui, c'est la rive
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < w) return HAUTEUR ? Math.max(y, HAUTEUR(x, z)) : y;
  }
  return null;
}

// ---------- le banc de rochers sous le château (acte IV, étape 8) ----------
// Le pied du mur nord du château angevin, relevé sur l'enceinte d'OSM, du côté de la mer ; le banc
// court à 3,2 m du mur (le mur fait 2,6 m d'épaisseur), et descend de la jetée du Colosse par une
// rampe — la jetée est un mètre plus haut, une marche que Camille ne monte pas.
const MUR_NORD = [[254, 50], [244, 55], [232, 53], [222, 43], [198, 52]], CHATEAU = [222, 28];
const BANC = [];          // segments : [ax, az, ay, bx, bz, by, demi-largeur]
let BOUCHE = null;        // [x, z, y, yaw] : la grotte, au bout du banc
const decouvert = () => TEMPS.maree < -0.15;
function solBanc(x, z) {
  if (!decouvert()) return null;
  for (const [ax, az, ay, bx, bz, by, w] of BANC) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < w) return ay + (by - ay) * t;
  }
  return null;
}
function bancDeRochers() {
  const y = Y_MER + 0.35, pts = MUR_NORD.map(([x, z], k) => {
    // la normale moyenne des deux pans qui se rejoignent, tournée vers la mer (loin du château)
    const [px, pz] = MUR_NORD[Math.max(0, k - 1)], [nx, nz] = MUR_NORD[Math.min(MUR_NORD.length - 1, k + 1)];
    let ox = -(nz - pz), oz = nx - px; const l = Math.hypot(ox, oz); ox /= l; oz /= l;
    if (ox * (x - CHATEAU[0]) + oz * (z - CHATEAU[1]) < 0) { ox = -ox; oz = -oz; }
    return [x + ox * 3.2, z + oz * 3.2];
  });
  // la rampe : du bord de la jetée au premier rocher
  BANC.push([249, 60, Y_MER + 1.3, pts[1][0], pts[1][1], y, 1.8]);
  for (let k = 1; k < pts.length - 1; k++) BANC.push([pts[k][0], pts[k][1], y, pts[k + 1][0], pts[k + 1][1], y, 1.8]);
  const roc = phMat('rocher_01', 2, 2, { color: 0x9a8a70 }), geos = [];
  for (const [ax, az, ay, bx, bz, by, w] of BANC) {
    const l = Math.hypot(bx - ax, bz - az), n = Math.ceil(l / 1.6);
    for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, top = ay + (by - ay) * t;
      const b = new THREE.BoxGeometry(2.4 + (i % 3) * 0.3, top - (Y_MER - 2.5), w * 2 + 0.4 - (i % 2) * 0.3);
      b.rotateY(-Math.atan2(bz - az, bx - ax) + (i % 4 - 1.5) * 0.08); b.translate(x, (top + Y_MER - 2.5) / 2, z); geos.push(b.toNonIndexed()); }
  }
  const m = new THREE.Mesh(mergeGeometries(geos), roc); m.castShadow = m.receiveShadow = true; scene.add(m);
  // la bouche de la grotte : une arche noire au pied du mur, au bout du banc, des rochers autour
  const [ex, ez] = pts[pts.length - 1], [fx, fz] = MUR_NORD[MUR_NORD.length - 1], yaw = Math.atan2(fx - ex, fz - ez);
  const g = new THREE.Group(); g.position.set(ex, y, ez); g.rotation.y = yaw; scene.add(g);
  const noir = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  noir.position.set(0, 0, 1.6); noir.rotation.y = Math.PI; g.add(noir);
  for (const [a, b, r] of [[-2.1, 0.6, 0.9], [2.0, 0.4, 0.8], [-1.6, 1.9, 0.7], [1.5, 2.1, 0.6], [0, 2.6, 0.75]]) g.add(mesh(new THREE.DodecahedronGeometry(r), roc, a, b, 1.4));
  BOUCHE = [ex, ez, y, yaw];
}

// ---------- les tarentules (SCENARIO.md § 13 : la vieille croyance de la pizzica) ----------
Object.assign(KINDS, { tarentule: { hp: 3, speed: 5.5, dmg: 1, range: 1.4, aggro: 11, windup: 0.4, cd: 1.3, fly: 0, r: 0.5, label: 'Tarentule des grottes', barY: 0.9 } });
setMaker('tarentule', () => {
  const g = new THREE.Group(), poil = phMat('rocher_01', 0.5, 0.5, { color: 0x5a4030, roughness: 0.95 }), noir = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.6 });
  const abdo = mesh(new THREE.SphereGeometry(0.34, 14, 10), poil, 0, 0.42, -0.32); abdo.scale.set(1, 0.8, 1.2);
  g.add(abdo, mesh(new THREE.SphereGeometry(0.22, 12, 8), poil, 0, 0.38, 0.1));
  // les yeux, deux points rouges qu'on voit dans l'ombre du mur
  for (const sx of [-0.07, 0.07]) g.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3020 }), sx, 0.47, 0.29));
  g.userData.pattes = [];
  for (let k = 0; k < 8; k++) { const c = k < 4 ? -1 : 1, i = k % 4, p = new THREE.Group(); p.position.set(c * 0.16, 0.38, 0.18 - i * 0.12);
    const haut = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.42, 5), noir, c * 0.17, 0.12, 0); haut.rotation.z = -c * 1.0;
    const bas = mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.5, 5), noir, c * 0.4, -0.08, 0); bas.rotation.z = c * 0.5;
    p.add(haut, bas); p.rotation.y = (i - 1.5) * 0.35 * c; g.add(p); g.userData.pattes.push(p); }
  g.scale.setScalar(1.3); g.userData.anim = true; g.userData.dynamic = true; return g;
});
// les pattes qui courent ; le corps suit sa place (le moteur la calcule)
setAnimHook('tarentule', (e, dt, v) => { e.patteT = (e.patteT || 0) + dt * (2 + v * 3);
  e.mesh.userData.pattes.forEach((p, k) => { p.rotation.x = Math.sin(e.patteT * 6 + k * 1.3) * 0.35; });
  e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw; return true; });
let TARENTULES = null, CORDE = null, mouille = 0;
function grotte() {
  // les tarentules gardent le banc tant que la corde n'est pas reprise ; nées une fois, après le chargement
  if (!TARENTULES && etape4() === 'corde' && !state.corde4 && BANC.length) {
    TARENTULES = [];
    for (let k = 1; k < BANC.length; k++) { const [ax, az, ay, bx, bz] = BANC[k]; for (const t of [0.35, 0.8]) TARENTULES.push(spawnEnemy('tarentule', ax + (bx - ax) * t, az + (bz - az) * t, 'grotte', ay)); }
  }
  // la corde, roulée dans la bouche de la grotte
  if (!CORDE && BOUCHE && etape4() === 'corde' && !state.corde4) {
    const [x, z, y, yaw] = BOUCHE;
    CORDE = mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), phMat('wood_planks', 0.3, 0.3, { color: 0x8a5a30 }), x + Math.sin(yaw) * 0.9, y + 0.08, z + Math.cos(yaw) * 0.9);
    CORDE.rotation.x = Math.PI / 2; scene.add(CORDE);
    addInteract({ pos: CORDE.position, r: 2.4, prompt: () => 'ramasser la corde du tambourin', enabled: () => CORDE.visible && decouvert(),
      fn: () => { state.corde4 = true; CORDE.visible = false; SFX.pickup(); saveGame(true); showMessage('La corde du tambourin ! Rapporte-la à Assunta, à Alberobello.', 4); } });
  }
  // la mer remonte : sur le banc, Camille est repoussée vers la jetée, trempée (pas de noyade :
  // l'acte III n'a pas encore donné le souffle)
  if (BANC.length && !decouvert() && Date.now() - mouille > 3000) {
    const p = player.pos; let sur = false;
    for (const [ax, az, , bx, bz, , w] of BANC.slice(1)) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / l2));
      if (Math.hypot(p.x - ax - dx * t, p.z - az - dz * t) < w + 0.5) sur = true; }
    if (sur) { mouille = Date.now(); const [qx, qz, qy] = BANC[0]; p.set(qx, qy, qz); showMessage('La mer remonte ! Tu ressors trempée sur la jetée.', 3.5); }
  }
}

function port({ hauteur, inscrire, PLAN, H0 }) {
  Y_MER = -H0; HAUTEUR = hauteur;
  const pierre = phMat('old_stone_wall_02', 1, 1, { color: 0xe8d4a8 }), murs = [], dalles = [];
  // un pan de mur entre deux points, les UV en mètres sur ses faces
  const pan = (ax, az, bx, bz, y0, y1, ep, liste) => {
    const l = Math.hypot(bx - ax, bz - az); if (l < 0.2) return;
    const b = new THREE.BoxGeometry(l + ep * 0.5, y1 - y0, ep), p = b.attributes.position, uv = b.attributes.uv, n = b.attributes.normal;
    for (let i = 0; i < p.count; i++) { const cote = Math.abs(n.getX(i)) > 0.5, dessus = Math.abs(n.getY(i)) > 0.5;
      uv.setXY(i, (cote ? p.getZ(i) : p.getX(i)) / 2.5, (dessus ? p.getZ(i) : p.getY(i)) / 2.5); }
    b.rotateY(-Math.atan2(bz - az, bx - ax)); b.translate((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2); liste.push(b.toNonIndexed());
  };

  // ---------- les quais et les jetées : des dalles à 1,3 m au-dessus de l'eau ----------
  for (const q of PLAN.ponts || []) {
    const w = q.k === 'breakwater' ? 5 : q.k === 'pier' ? 2.6 : 2.2, y = Y_MER + 1.3;
    for (let k = 0; k < q.pts.length - 1; k++) { const [ax, az] = q.pts[k], [bx, bz] = q.pts[k + 1];
      pan(ax, az, bx, bz, Y_MER - 2.5, y, w * 2, dalles); QUAIS.push([ax, az, bx, bz, w, y]); }
  }
  // la distance au bord du quai le plus proche (négative : sur le quai)
  const auQuai = (x, z) => { let m = 1e9; for (const [ax, az, bx, bz, w] of QUAIS) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t) - w); } return m; };

  // ---------- les remparts : du fond de l'eau au parapet ----------
  // le haut suit la rue derrière le mur (le plus haut du relief à 4 m de part et d'autre),
  // plus un parapet d'un mètre ; jamais moins de 4 m au-dessus de la mer.
  // OUVERT là où un quai le traverse : le pied de la jetée du Colosse passait sous le mur du
  // château, et Camille ne pouvait pas rejoindre Nunzia (bancs/lieu-pouilles.mjs, 2 octobre)
  const morceaux = [];
  for (const e of PLAN.enceinte || []) {
    const pts = e.pts;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], l = Math.hypot(bx - ax, bz - az); if (l < 0.3) continue;
      const n = Math.max(1, Math.ceil(l)); let debut = null;
      for (let t = 0; t <= n; t++) { const x = ax + (bx - ax) * t / n, z = az + (bz - az) * t / n, libre = t < n && auQuai(x, z) > 1;
        if (libre && debut === null) debut = t; else if (!libre && debut !== null) { morceaux.push([ax + (bx - ax) * debut / n, az + (bz - az) * debut / n, x, z]); debut = null; } }
      if (debut !== null) morceaux.push([ax + (bx - ax) * debut / n, az + (bz - az) * debut / n, bx, bz]);
    }
  }
  for (const [ax, az, bx, bz] of morceaux) {
    {
      const l = Math.hypot(bx - ax, bz - az); if (l < 0.3) continue;
      const nx = -(bz - az) / l, nz = (bx - ax) / l, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const rue = Math.max(hauteur(mx + nx * 4, mz + nz * 4), hauteur(mx - nx * 4, mz - nz * 4), hauteur(mx, mz));
      const haut = Math.max(rue + 1.05, Y_MER + 4);
      pan(ax, az, bx, bz, Y_MER - 3, haut, 2.6, murs);
      // le cordon de pierre sous le parapet, en léger débord
      pan(ax, az, bx, bz, haut - 1.35, haut - 1.05, 3.0, murs);
      inscrire([[ax + nx * 0.7, az + nz * 0.7], [bx + nx * 0.7, bz + nz * 0.7], [bx - nx * 0.7, bz - nz * 0.7], [ax - nx * 0.7, az - nz * 0.7], [ax + nx * 0.7, az + nz * 0.7]], mx, mz);
    }
  }
  const m1 = new THREE.Mesh(mergeGeometries(murs), pierre); m1.castShadow = m1.receiveShadow = true; scene.add(m1);
  if (dalles.length) { const m2 = new THREE.Mesh(mergeGeometries(dalles), phMat('marble_rock_02', 1, 1, { color: 0xdcd0bc })); m2.receiveShadow = true; scene.add(m2); }

  // ---------- les barques de pêche, le long des jetées du port ----------
  // une coque : la moitié basse d'un ellipsoïde, ouverte, peinte (le bois clair sous la
  // peinture) ; un plancher de bois brut au fond
  const coque = new THREE.SphereGeometry(1, 18, 8, 0, TAU, Math.PI / 2, Math.PI / 2); coque.scale(1.05, 0.75, 3.1);
  const plancher = new THREE.BoxGeometry(1.5, 0.06, 4.6); plancher.translate(0, -0.35, 0);
  const COULEURS = [[1.15, 1.15, 1.2], [0.5, 0.8, 1.25], [0.55, 0.95, 0.7], [1.2, 0.75, 0.5]];
  for (const [ax, az, bx, bz, w] of QUAIS) {
    const l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l;
    for (let s = 4; s < l - 3 && BARQUES.length < 40; s += 6.5) for (const c of [-1, 1]) {
      const x = ax + ux * s - uz * c * (w + 2), z = az + uz * s + ux * c * (w + 2);
      if (Math.hypot(x - COLOSSE.x, z - COLOSSE.z) > 420 || hauteur(x, z) > Y_MER - 0.6 || solQuai(x, z) != null) continue;
      const ici = (x * 7.1 + z * 3.3) % 1; if (Math.abs(ici) < 0.35) continue;      // pas à toutes les places
      BARQUES.push({ x, z, ry: Math.atan2(ux, uz), ph: x * 0.37 + z * 0.11, c: COULEURS[Math.floor(Math.abs(x + z)) % COULEURS.length] });
    }
  }
  if (BARQUES.length) {
    const hc = new THREE.InstancedMesh(coque, phMat('hinoki_planks', 1, 1, { color: 0xffffff, side: THREE.DoubleSide, roughness: 0.7 }), BARQUES.length);
    const hp = new THREE.InstancedMesh(plancher, phMat('wood_planks', 1.5, 4.6, { color: 0xb8a080 }), BARQUES.length), c = new THREE.Color();
    BARQUES.forEach((b, k) => hc.setColorAt(k, c.setRGB(...b.c)));
    hc.castShadow = true; scene.add(hc, hp); BARQUES.coques = hc; BARQUES.planchers = hp; bercer(0);
  }

  // ---------- la place du Colosse ----------
  const yq = Y_MER + 1.3;
  const socle = new THREE.Group(); socle.position.set(COLOSSE.x, yq, COLOSSE.z); socle.rotation.y = COLOSSE.yaw; scene.add(socle);
  const blanc = phMat('marble_rock_02', 2, 2, { color: 0xf0e8d8 });
  socle.add(mesh(boxG(6.4, 0.5, 6.4), blanc, 0, 0.25, 0), mesh(boxG(5.2, 2.6, 5.2), phMat('old_stone_wall_02', 5.2, 2.6, { color: 0xe8d4a8 }), 0, 1.8, 0), mesh(boxG(5.8, 0.4, 5.8), blanc, 0, 3.3, 0));
  socle.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  inscrire([[-3.2, -3.2], [3.2, -3.2], [3.2, 3.2], [-3.2, 3.2], [-3.2, -3.2]].map(([a, b]) => [COLOSSE.x + a, COLOSSE.z + b]), COLOSSE.x, COLOSSE.z);
  colosse = PNJ.buildRole('colosse');
  if (colosse) {
    // le bronze patiné : une pierre veinée brun-vert, un peu métallique — sans reflet du ciel
    // à renvoyer, un vrai métal sortait noir (comme la mer de la version 1)
    // (posé aussi à chaque image tant que le modèle s'assemble : il remet ses matières en arrivant)
    BRONZE = phMat('marble_rock_03', 0.6, 0.6, { color: 0x8a7444, metalness: 0.35, roughness: 0.42 });
    couler();
    const bronze = BRONZE;
    // la croix levée de la main droite (celle du colosse de Barletta)
    const croix = new THREE.Group(); croix.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), bronze, 0, 0.45, 0), mesh(boxG(0.5, 0.05, 0.05), bronze, 0, 1.0, 0));
    PNJ.socket(colosse, colosse.userData.perso, 'hand_r', croix, [0, 0.05, 0.02], [0, 0, 0]);
    // six fois la taille d'un homme : onze mètres de bronze (G.echelle : la taille des gens ici)
    colosse.scale.setScalar(G.echelle * 6.2); colosse.position.set(COLOSSE.x, yq + 3.5, COLOSSE.z); colosse.rotation.y = COLOSSE.yaw; scene.add(colosse);
  }

  // Nunzia naît après le chargement (anime) : son âge dépend de l'étape de l'acte, que la
  // sauvegarde ne rend qu'une fois la partie lancée
  if (!EN_INSTANCE) bancDeRochers();
  return { y: solQuai(NUNZIA.x, NUNZIA.z) ?? hauteur(NUNZIA.x, NUNZIA.z) };
}

// ---------- la place de la gare ----------
// Devant le quai, côté ville : on y descend du train. Un repère local (a le long des voies,
// b vers la place) pour tout poser d'un geste.
function place({ hauteur, inscrire }) {
  const Gr = GARES.gallipoli, c = Math.cos(Gr.rot), s = Math.sin(Gr.rot);
  const P = (a, b) => [Gr.x + a * c - b * s, Gr.z + a * s + b * c], CX = P(0, 17), R = 15;
  // le dallage : un disque drapé sur le relief, de pierre de Lecce chaude
  const dg = new THREE.CircleGeometry(R, 40, 0, TAU); dg.rotateX(-Math.PI / 2); const p = dg.attributes.position, uv = dg.attributes.uv;
  for (let k = 0; k < p.count; k++) { const x = CX[0] + p.getX(k), z = CX[1] + p.getZ(k); p.setXYZ(k, x, hauteur(x, z) + 0.07, z); uv.setXY(k, x / 2, z / 2); }
  dg.computeVertexNormals();
  const dalles = new THREE.Mesh(dg, phMat('marble_rock_02', 1, 1, { color: 0xf2dcb8, polygonOffset: true, polygonOffsetFactor: -2 })); dalles.receiveShadow = true; scene.add(dalles);
  const y0 = hauteur(...CX), blanc = phMat('marble_rock_02', 2, 2, { color: 0xf4ead8 });
  const B = (geo, m, x, y, z, ombre = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = ombre; o.receiveShadow = true; scene.add(o); return o; };
  // la fontaine : un bassin rond, une vasque sur sa colonne, l'eau
  B(new THREE.CylinderGeometry(2.6, 2.8, 0.75, 32, 1, true), blanc, CX[0], y0 + 0.37, CX[1]);
  B(new THREE.TorusGeometry(2.6, 0.18, 8, 32), blanc, CX[0], y0 + 0.75, CX[1]).rotation.x = Math.PI / 2;
  B(new THREE.CylinderGeometry(2.55, 2.55, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x5a8aa0, roughness: 0.08, metalness: 0.2 }), CX[0], y0 + 0.6, CX[1], false);
  B(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 12), blanc, CX[0], y0 + 1.3, CX[1]);
  B(new THREE.CylinderGeometry(0.95, 0.35, 0.4, 20), blanc, CX[0], y0 + 2.2, CX[1]);
  { const q = []; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; q.push([CX[0] + Math.cos(a) * 2.9, CX[1] + Math.sin(a) * 2.9]); } q.push(q[0]); inscrire(q, ...CX); }
  // les orangers en pots, autour
  const esp = especeGeo('chene'), pot = phMat('brique_rouge_06', 1.5, 0.8, { color: 0xd89070 }), arbres = [];
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU, x = CX[0] + Math.cos(a) * (R - 1.6), z = CX[1] + Math.sin(a) * (R - 1.6), y = hauteur(x, z);
    if (Math.abs(Math.sin(a - Gr.rot)) > 0.85 && Math.cos(a - Gr.rot - Math.PI / 2) < 0) continue;         // pas devant le quai
    B(new THREE.CylinderGeometry(0.55, 0.42, 0.8, 14), pot, x, y + 0.4, z); arbres.push([x, y + 0.75, z]); }
  if (esp) { const tr = new THREE.InstancedMesh(esp.tronc, esp.matT, arbres.length), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, arbres.length), m4 = new THREE.Matrix4();
    arbres.forEach(([x, y, z], k) => { m4.makeScale(2.6, 2.6, 2.6).setPosition(x, y, z); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
    tr.castShadow = hp.castShadow = true; scene.add(tr, hp); }
  // le café : quatre tables rondes et leurs chaises, sous des parasols de toile écrue
  const fer = new THREE.MeshStandardMaterial({ color: 0x2e3430, roughness: 0.5, metalness: 0.5 }), toile = phMat('wool_boucle', 1, 1, { color: 0xf0e2c8, side: THREE.DoubleSide });
  const chaise = phMat('wood_cabinet_worn_long', 0.5, 0.5, { color: 0x8a6040 });
  for (const [a, b] of [[-9, 9], [-5, 12], [8, 10], [10, 14]]) { const [x, z] = P(a, b), y = hauteur(x, z);
    B(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 18), blanc, x, y + 0.76, z); B(new THREE.CylinderGeometry(0.04, 0.06, 0.74, 8), fer, x, y + 0.37, z);
    for (let k = 0; k < 3; k++) { const t = k / 3 * TAU + a; const cx = x + Math.cos(t) * 0.8, cz = z + Math.sin(t) * 0.8;
      B(new THREE.BoxGeometry(0.42, 0.06, 0.42), chaise, cx, y + 0.46, cz).rotation.y = -t; const d = B(new THREE.BoxGeometry(0.42, 0.45, 0.05), chaise, cx + Math.cos(t) * 0.2, y + 0.7, cz + Math.sin(t) * 0.2); d.rotation.y = -t + Math.PI / 2; }
    B(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), fer, x, y + 1.2, z); B(new THREE.ConeGeometry(1.5, 0.55, 16, 1, true), toile, x, y + 2.45, z); }
  // les bancs de pierre, au bord
  for (const [a, b, r] of [[-12, 20, 0.6], [12, 21, -0.6], [0, 30, 0]]) { const [x, z] = P(a, b); B(new THREE.BoxGeometry(2.2, 0.45, 0.55), blanc, x, hauteur(x, z) + 0.22, z).rotation.y = -Gr.rot + r; }
  // les guirlandes : des fils entre des mâts au bord de la place, des ampoules chaudes qui
  // luisent (le halo du post-traitement les prend) ; aucune lumière vraie, rien à calculer
  const mats = [], ampoules = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.3, x = CX[0] + Math.cos(a) * (R - 0.5), z = CX[1] + Math.sin(a) * (R - 0.5); mats.push([x, hauteur(x, z), z]);
    B(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8), fer, x, hauteur(x, z) + 2.3, z); }
  for (let k = 0; k < 6; k++) for (const j of [k + 2, k + 3]) { const A = mats[k], Bm = mats[j % 6]; if (j % 6 < k && j - k === 3) continue;
    for (let t = 0.05; t < 1; t += 0.06) ampoules.push([A[0] + (Bm[0] - A[0]) * t, A[1] + 4.5 + (Bm[1] - A[1]) * t - Math.sin(t * Math.PI) * 1.1, A[2] + (Bm[2] - A[2]) * t]); }
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 2.2 }), ampoules.length), m4 = new THREE.Matrix4();
  ampoules.forEach(([x, y, z], k) => { m4.makeTranslation(x, y, z); im.setMatrixAt(k, m4); }); scene.add(im);
}

// Nunzia, aux âges de l'enquête (docs/DIALOGUES-ACTE4.md) : les trois témoins sont la même
// personne. Elle ne sait que ce qu'elle a appris à son âge.
function parlerNunzia() {
  const e = etape4(), lettre = () => state.ind4 && state.ind4.apprenti && !state.lettre4
    ? [{ who: 'Nunzia', text: 'Tu l’as trouvé ? Au bout de la ligne… **Porte-lui ça.** Ne lis pas.' },
       { text: 'Nunzia te confie une lettre, cachetée.', fn: () => { state.lettre4 = 'lettre'; } }] : [];
  if (!e || e === 'arrivee') return dialogue([
    { who: 'Nunzia', text: 'Tu n’es pas d’ici, toi. Ici, tout le monde court.' },
    { who: 'Nunzia', text: 'Le Colosse ? Il a changé quand l’homme rouge est venu. **Mon grand-père** l’a vu. Il vit **dans les Sassi de Matera**, à l’ombre : là-bas, on vieillit moins vite.' },
    { text: 'Elle serre dans sa main un ticket de train, poinçonné. Au loin, un sifflet : elle tourne la tête.' },
    { who: 'Nunzia', text: 'C’est le petit train. Il ne s’arrête qu’une minute.',
      fn: () => { if (!e) return; passer4('quinze'); indice4('grandpere'); indice4('ticket'); } },
  ]);
  if (e === 'quinze') return dialogue([
    { who: 'Nunzia', text: 'Grand-père est **dans les Sassi de Matera**. Va vite. Ici, vite, c’est déjà tard.' },
  ]);
  if (e === 'grandpere') return dialogue([
    { who: 'Nunzia', text: 'Camille ? Tu n’as pas changé. Pas d’un jour.' },
    { text: 'Elle a trente ans. Tu lui tends le mot de Donato ; elle le lit sans rien dire.' },
    { who: 'Nunzia', text: 'Grand-père est mort, je sais.' },
    { who: 'Nunzia', text: 'Il me l’avait dit, avant : **l’homme rouge est monté au château de Matera, le Tramontano.**',
      fn: () => { passer4('trente'); indice4('chateau'); } },
    ...lettre(),
  ]);
  if (e === 'rythme') return dialogue([
    { text: 'Nunzia a soixante ans. Un châle sur les épaules, les cheveux gris.' },
    { who: 'Nunzia', text: 'Elle a ta taille, maintenant, ma fille. Elle avait trois ans la dernière fois.' },
    { who: 'Nunzia', text: 'Le château ne s’ouvre qu’au rythme de **la pizzica**. **La vieille joueuse de tambourin d’Alberobello** te l’apprendra. C’est ma fille.',
      fn: () => { passer4('soixante'); indice4('joueuse'); } },
  ]);
  if (e === 'soixante' || e === 'corde') return dialogue([{ who: 'Nunzia', text: 'Assunta, **à Alberobello**, près de la gare. Elle joue mieux que moi. Mieux que tout le monde.' }]);
  if (e === 'trente') return dialogue([
    { who: 'Nunzia', text: 'Le château de Matera, Camille. **Le Tramontano**, sur sa colline.' },
    ...lettre(),
  ]);
  dialogue([{ who: 'Nunzia', text: 'Le temps passe, Camille. Pas pour toi.' }]);
}

// les barques se balancent sur l'eau (une matrice par barque et par image : quarante au plus)
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), un = new THREE.Vector3(1, 1, 1);
function bercer(t) {
  if (!BARQUES.coques) return;
  BARQUES.forEach((b, k) => { const ph = t * 1.3 + b.ph; e.set(Math.sin(ph) * 0.05, b.ry, Math.sin(ph * 0.8) * 0.07); q.setFromEuler(e);
    m4.compose(v.set(b.x, Y_MER + TEMPS.maree + 0.35 + Math.sin(ph * 1.1) * 0.08, b.z), q, un); BARQUES.coques.setMatrixAt(k, m4); BARQUES.planchers.setMatrixAt(k, m4); });
  BARQUES.coques.instanceMatrix.needsUpdate = BARQUES.planchers.instanceMatrix.needsUpdate = true;
}

const lieuPret = ville('gallipoli', {
  solLieu: (x, z) => solQuai(x, z) ?? solBanc(x, z),
  plus(ctx) {
    const { y } = port(ctx); place(ctx);
    nunziaY = y;
  },
  anime(now) {
    const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
    bercer(now / 1000);
    if (!nunzia && state.running) nunzia = naitre4(EN_INSTANCE ? 'nunzia' : roleNunzia(), NUNZIA.x, nunziaY, NUNZIA.z,
      Math.atan2(COLOSSE.x - NUNZIA.x, COLOSSE.z - NUNZIA.z), 'parler à Nunzia', parlerNunzia);
    if (nunzia && nunzia.userData.ctrl) PNJ.animeVillageois(nunzia, dt, false);
    if (state.running && !EN_INSTANCE) grotte();
    // le Colosse, figé : une image de sa pose, une fois pour toutes
    if (colosse && coule++ < 900) couler();           // les quinze premières secondes
    if (colosse && !fige && colosse.userData.ctrl) { const c = colosse.userData.ctrl; c.jouer(colosse.userData.idle, 0); c.update(0.9); fige = true; }
  },
});

// L'ARÈNE du multi (5 octobre, cf. ARENE_LILLE dans game.js et docs/NOTE-MULTI.md) : la vieille
// ville sur son île, ses ruelles blanches et ses palais — 4 100 m² où l'on marche, relevés le
// 5 octobre en marchant aux règles du moteur depuis (20, 60) : de (−56, −24) à (104, 140), de
// −1,7 à 4,2 m. Puis le parvis du Duomo. Deux camps de la ville : les pêcheurs du port, à l'est,
// et les mouliniers des pressoirs à huile creusés sous les maisons (les frantoi), à l'ouest.
const ARENE_GALLIPOLI = {
  id: 'gallipoli', nom: 'Gallipoli, la vieille ville',
  sd: (x, z) => Math.hypot(x - 20, z - 60), centre: [20, 60],
  depart: { x: 9.5, z: 100 },                   // devant le Duomo
  aires: [
    { id: 'ville', nom: 'la vieille ville', r: 95,   // 95 : les départs des camps restent à 20 m de la limite
      couleur: '#ffd070', lueur: 0xffc860, eparpille: 45 },
    { id: 'duomo', nom: 'le parvis du Duomo', r: 30, sd: (x, z) => Math.hypot(x - 9.5, z - 107.5), couleur: '#ff9a70', lueur: 0xff6a3a, eparpille: 18 },
  ],
  camps: {
    garnison: { nom: 'Les pêcheurs', court: 'Pêcheurs', pluriel: true },
    bourg: { nom: 'Les mouliniers', court: 'Mouliniers', pluriel: true },
  },
  campsTexte: 'Les pêcheurs du port contre les mouliniers des pressoirs à huile, dans les ruelles de la vieille ville.',
  departsCamps: { garnison: [96, 72], bourg: [-44, 94] },
  objets: [
    { id: 'armure-port', type: 'armure', x: 96, z: 74, nom: 'du côté du port' },
    { id: 'armure-pressoirs', type: 'armure', x: -48, z: 96, nom: 'du côté des pressoirs' },
    { id: 'arc-nord', type: 'arc', x: -2, z: -18, nom: 'au bout nord de l’île' },
    { id: 'arc-sud', type: 'arc', x: 78, z: 118, nom: 'au sud, vers le Palazzo Ravenna' },
    { id: 'bouclier', type: 'bouclier', x: 9.5, z: 100, nom: 'sur le parvis du Duomo' },
  ],
  pointsForts: () => [
    { id: 'duomo', nom: 'le parvis du Duomo', x: 9.5, z: 100 },
    { id: 'balsamo', nom: 'le Palazzo Balsamo', x: 38.4, z: 72.5 },
    { id: 'ravenna', nom: 'le Palazzo Ravenna', x: 82.6, z: 95.4 },
    { id: 'centre', nom: 'le cœur de la vieille ville', x: 20, z: 60 },
    { id: 'nord', nom: 'le bout nord de l’île', x: -2, z: -20 },
    { id: 'port', nom: 'le côté du port', x: 100, z: 72 },
    { id: 'pressoirs', nom: 'le côté des pressoirs', x: -52, z: 98 },
  ],
};
// le niveau naît dans monde() (après l'installation de Camille) : ville() rend sa promesse
lieuPret.then(() => { if (G.level && G.level.name === 'gallipoli') G.level.arenes = [ARENE_GALLIPOLI]; });

window.__gallipoli = { BANC, bouche: () => BOUCHE, decouvert };      // pour les bancs (bancs/acte4-*.mjs)
