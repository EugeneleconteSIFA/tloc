// promenade.js — la voie des combattants et l'entrée du parc.
//
// Deux aménagements demandés sur relevé photographique :
//   · la VOIE DES COMBATTANTS, le chemin qui fait le tour de la citadelle entre la
//     contrescarpe et le bois — bande claire, ligne blanche au milieu, alignement de
//     grands arbres du côté du parc, bancs tournés vers le fossé ;
//   · l'ENTRÉE DU PARC au débouché du pont, côté ville : piles de pierre, grille de fer,
//     lanternes, tablier pavé et la cabane de bois du coin.
//
// Tout est fusionné à la main (quelques géométries, une par matériau) et instancié pour
// les arbres : une promenade de deux kilomètres ne doit pas coûter mille objets.
import * as FORET from './foret.js';
import {
  THREE, T, TAU, addCap, mat, mesh, pbrRepeat, phMat, rand,
} from './engine.js?v=27';
import {
  PONTS, cobbles, rubanGeo, sdEau, sdPent, solPlaine, surDehors, surPont, voieCombattants,
} from './carte.js';

// ---------------------------------------------------------------------
//  La voie
// ---------------------------------------------------------------------
export function voieDesCombattants() {
  const g = new THREE.Group(); g.name = 'voie-des-combattants';
  const V = voieCombattants();
  if (!V || V.length < 4) return g;
  const lignes = [{ pts: V, r: 1 }];

  // 1. la bande. Quatre mètres vingt de TERRE BATTUE : le goudron et la ligne blanche
  // peinte au milieu — un marquage routier des années 1960 — n'ont rien à faire dans
  // une ville du XVIIe. Deux ornières de charroi tiennent lieu de marquage.
  const bande = rubanGeo(lignes, 4.2, 0.17);
  if (bande) {
    const m = new THREE.Mesh(bande, phMat('terre_battue', 1, 1, {
      color: 0x8e7b5e, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3,
    }));
    m.receiveShadow = true; m.renderOrder = 2; g.add(m);
  }
  for (const cote of [-1, 1]) {
    const orn = rubanGeo(lignes.map((o) => ({
      pts: o.pts.map((q, i, T) => {
        const a = T[Math.max(0, i - 1)], b2 = T[Math.min(T.length - 1, i + 1)];
        const dx = b2[0] - a[0], dz = b2[1] - a[1], L = Math.hypot(dx, dz) || 1;
        return [q[0] - dz / L * cote * 0.75, q[1] + dx / L * cote * 0.75];
      }),
    })), 0.34, 0.176);
    if (orn) {
      const m = new THREE.Mesh(orn, phMat('brown_mud_03', 1, 1, {
        color: 0x6b5a44, roughness: 1, polygonOffset: true, polygonOffsetFactor: -5,
      }));
      m.renderOrder = 3; g.add(m);
    }
  }

  // 3. l'alignement. Le hêtre : haut, élancé, fût nu — c'est le port des platanes du parc.
  const esp = FORET.especeGeo('hetre');
  const MAXI = 900;
  let tr = null, ho = null, n = 0;
  if (esp) {
    tr = new THREE.InstancedMesh(esp.tronc, esp.matT, MAXI);
    ho = new THREE.InstancedMesh(esp.houppier, esp.matH, MAXI);
    tr.castShadow = tr.receiveShadow = ho.castShadow = ho.receiveShadow = true;
    ho.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking, map: esp.matH.map, alphaTest: 0.42,
    });
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Pv = new THREE.Vector3(),
    Sv = new THREE.Vector3(), Eu = new THREE.Euler();
  const troncs = [];
  // banc : deux planches sur quatre piètements de fonte, tourné vers le fossé
  const bois = pbrRepeat(T.plank, 1, 1, { color: 0x8a6a46 });
  const fonte = mat(0x4a3826, { roughness: 0.9 });   // piètement de chêne, pas de fonte
  const bancs = [];
  let s = 0, prochainArbre = 0, prochainBanc = 40;
  for (let i = 0; i < V.length - 1; i++) {
    const a = V[i], b = V[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 0.01) continue;
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
    // le côté du parc : celui qui s'éloigne de la citadelle
    const dehors = sdPent(a[0] + nx * 6, a[1] + nz * 6) > sdPent(a[0] - nx * 6, a[1] - nz * 6) ? 1 : -1;
    for (let t = 0; t < L; t += 0.5) {
      s += 0.5;
      const cx = a[0] + ux * t, cz = a[1] + uz * t;
      if (s >= prochainArbre && n < MAXI && esp) {
        prochainArbre = s + rand(11, 17);
        for (const cote of [dehors, -dehors]) {
          if (n >= MAXI) break;
          const d = cote === dehors ? rand(5.2, 7.5) : rand(5.2, 6.4);
          const x = cx + nx * cote * d, z = cz + nz * cote * d;
          if (sdEau(x, z) < 5 || surDehors(x, z, 2) || surPont(x, z) !== null) continue;
          if (sdPent(x, z) < 6) continue;
          const h = rand(esp.sp.h[0], esp.sp.h[1]);
          Pv.set(x, solPlaine(x, z) - 0.15, z);
          Q.setFromEuler(Eu.set(rand(-0.05, 0.05), rand(0, TAU), rand(-0.05, 0.05), 'YXZ'));
          Sv.set(h * rand(0.94, 1.1), h, h * rand(0.94, 1.1));
          M.compose(Pv, Q, Sv); tr.setMatrixAt(n, M); ho.setMatrixAt(n, M); n++;
          troncs.push([x, z, Math.max(0.55, h * esp.sp.rTronc * 2)]);
        }
      }
      if (s >= prochainBanc) {
        prochainBanc = s + rand(75, 130);
        const d = 3.4, x = cx - nx * dehors * d, z = cz - nz * dehors * d;
        if (sdEau(x, z) < 4 || surPont(x, z) !== null || surDehors(x, z, 1)) continue;
        bancs.push([x, z, Math.atan2(-nx * dehors, -nz * dehors)]);
      }
    }
  }
  if (esp && n) { tr.count = ho.count = n; g.add(tr, ho); }
  for (const [x, z, r] of troncs) addCap(x, z, x, z, r, 20);
  for (const [x, z, ry] of bancs) {
    const y = solPlaine(x, z);
    const bg = new THREE.Group(); bg.position.set(x, y, z); bg.rotation.y = ry; g.add(bg);
    for (const [dy, dz2, h] of [[0.46, 0, 0.07], [0.72, -0.22, 0.07]]) {
      const pl = mesh(new THREE.BoxGeometry(1.8, h, 0.42), bois, 0, dy, dz2);
      if (dz2) pl.rotation.x = -0.28;
      bg.add(pl);
    }
    for (const sx of [-1, 1]) {
      bg.add(mesh(new THREE.BoxGeometry(0.07, 0.46, 0.4), fonte, sx * 0.78, 0.23, 0));
      bg.add(mesh(new THREE.BoxGeometry(0.07, 0.34, 0.07), fonte, sx * 0.78, 0.62, -0.2));
    }
    addCap(x - Math.cos(ry) * 0.85, z + Math.sin(ry) * 0.85, x + Math.cos(ry) * 0.85, z - Math.sin(ry) * 0.85, 0.35, 0.9);
  }
  console.log('voie des combattants : %d m de promenade, %d arbres d’alignement, %d bancs',
    Math.round(s), n, bancs.length);
  return g;
}

// ---------------------------------------------------------------------
//  L'entrée du parc
// ---------------------------------------------------------------------
// Au débouché du pont, côté ville : deux piles de pierre, la grille de fer entre elles,
// deux lanternes, le tablier pavé qui s'évase, et la cabane de bois du coin.
export function entreeDuParc() {
  const g = new THREE.Group(); g.name = 'entree-du-parc';
  // Le relevé nomme les ponts : on prend celui qui s'appelle « Pont de la Citadelle »
  // — c'est lui qui porte le boulevard de la Liberté jusqu'au parc — et on ne retombe
  // sur une heuristique de largeur que s'il manque.
  let P = null;
  for (const p of PONTS) {
    if (!p.pts || p.pts.length < 2) continue;
    const d = Math.min(...p.pts.map((q) => Math.hypot(q[0], q[1])));
    if (/citadelle/i.test(p.nom || '')) { if (!P || !P.nomme || d < P.d) P = { p, d, nomme: true }; continue; }
    if (P && P.nomme) continue;
    if (d > 620) continue;
    if (!P || p.demi > P.p.demi || (p.demi === P.p.demi && d < P.d)) P = { p, d, nomme: false };
  }
  if (!P) { console.warn('entrée du parc : aucun pont large près du glacis'); return g; }
  const pts = P.p.pts;
  // la culée côté PARC : celle dont le point est le plus proche de la citadelle
  const A = Math.hypot(pts[0][0], pts[0][1]) < Math.hypot(pts[pts.length - 1][0], pts[pts.length - 1][1])
    ? [pts[0], pts[1]] : [pts[pts.length - 1], pts[pts.length - 2]];
  const [q0, q1] = A;
  const dx = q0[0] - q1[0], dz = q0[1] - q1[1], L = Math.hypot(dx, dz) || 1;
  const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
  const cx = q0[0] + ux * 9, cz = q0[1] + uz * 9, y0 = solPlaine(cx, cz);
  const HW = Math.max(6, P.p.demi + 2);

  const pierre = phMat('old_stone_wall_02', 1, 1, { color: 0xbdb4a2, roughness: 0.9 });
  // Une grille de fonte au barreaudage régulier, c'est du mobilier urbain de 1880. Ici
  // c'est une claire-voie de chêne entre deux piles de pierre, avec ses ferrures.
  const fer = pbrRepeat(T.plank, 1, 1, { color: 0x6b4a2e, roughness: 0.95 });
  const ferrure = mat(0x2f2a26, { roughness: 0.6, metalness: 0.35 });
  // y s'AJOUTE à la hauteur propre de la pièce : en l'écrasant, la pile de 2,50 m (centre à
  // 1,25) se retrouvait centrée sur le sol, à moitié enterrée, et son chapeau et sa lanterne
  // flottaient 1,25 m au-dessus d'elle ; les barreaux de la claire-voie de même.
  const pose = (o, sx2, sz2, y) => { o.position.set(cx + ux * sz2 + nx * sx2, o.position.y + y, cz + uz * sz2 + nz * sx2); g.add(o); return o; };

  // tablier pavé qui s'évase devant la grille
  { const pav = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 9, 22),
      pbrRepeat(cobbles(), 1 / 0.96, 1 / 0.96, { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3 }));
    pav.rotation.x = -Math.PI / 2; pav.rotation.z = -Math.atan2(uz, ux);
    pav.position.set(cx, y0 + 0.16, cz); pav.receiveShadow = true; pav.renderOrder = 2; g.add(pav); }

  // deux piles de pierre moulurées, la grille entre elles, un passage libre au milieu
  for (const sg of [-1, 1]) {
    const px = sg * HW;
    const pile = mesh(new THREE.BoxGeometry(1.15, 2.5, 1.15), pierre, 0, 1.25, 0);
    pose(pile, px, 0, y0);
    pose(mesh(new THREE.BoxGeometry(1.42, 0.22, 1.42), pierre, 0, 0, 0), px, 0, y0 + 2.5);
    pose(mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), pierre, 0, 0, 0), px, 0, y0 + 2.85);
    addCap(cx + nx * px, cz + nz * px, cx + nx * px, cz + nz * px, 0.8, y0 + 3.2);
    // la grille : barreaux entre la pile et le bord du tablier
    const dep = sg * 5.4;
    for (let t = 0; t <= 11; t++) {
      const bx = px + (dep - px) * (t / 11);
      pose(mesh(new THREE.BoxGeometry(0.11, 1.9, 0.11), fer, 0, 0.95, 0), bx, 0, y0);
    }
    for (const yy of [0.22, 1.82]) {
      const trav = mesh(new THREE.BoxGeometry(Math.abs(dep - px), 0.12, 0.12), fer, 0, 0, 0);
      pose(trav, (px + dep) / 2, 0, y0 + yy); trav.rotation.y = -Math.atan2(uz, ux) + Math.PI / 2;
    }
    addCap(cx + nx * px, cz + nz * px, cx + nx * dep, cz + nz * dep, 0.25, y0 + 1.9);
    // lanterne sur la pile
    pose(mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.6, 8), ferrure, 0, 1.3, 0), px, -1.7, y0);
    pose(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), mat(0xffe6b4, {
      emissive: 0xffc860, emissiveIntensity: 0.55, transparent: true, opacity: 0.85 }), 0, 0, 0), px, -1.7, y0 + 2.75);
    pose(mesh(new THREE.ConeGeometry(0.34, 0.3, 4), ferrure, 0, 0, 0), px, -1.7, y0 + 3.14);
  }

  // la cabane de bois du coin : billes horizontales, toit d'une pente, appentis
  { const bois = pbrRepeat(T.plank, 2, 1, { color: 0x8a6440 });
    const toit = mat(0x4a3a2c, { roughness: 0.9 });
    const cab = new THREE.Group();
    cab.add(mesh(new THREE.BoxGeometry(3.4, 2.4, 2.6), bois, 0, 1.2, 0));
    const t2 = mesh(new THREE.BoxGeometry(4.0, 0.16, 3.2), toit, 0, 2.55, 0); t2.rotation.x = 0.16; cab.add(t2);
    cab.add(mesh(new THREE.BoxGeometry(1.0, 1.9, 0.08), mat(0x3d4f43, { roughness: 0.85 }), 0, 0.95, 1.32));
    cab.rotation.y = -Math.atan2(uz, ux);
    pose(cab, -(HW + 4.6), 6, y0);
    addCap(cx + ux * 6 + nx * -(HW + 4.6), cz + uz * 6 + nz * -(HW + 4.6),
      cx + ux * 6 + nx * -(HW + 4.6), cz + uz * 6 + nz * -(HW + 4.6), 2.0, y0 + 2.6); }

  console.log('entrée du parc : posée sur « %s », à %d m du centre', P.p.nom || 'un pont', Math.round(P.d));
  return g;
}
