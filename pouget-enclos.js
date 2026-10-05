// The Legend of Camille — le Pouget : le grand enclos des brebis
// =====================================================================
// Eugène, 2 octobre : « de l'autre côté de la route, en face de la conciergerie (première maison
// du village en arrivant), un très vaste enclos pour brebis ». C'est le pré qui monte à l'ouest de
// la route d'arrivée (Street View : le pré pentu et ses piquets) : l'enclos le prend sur ~65 m le
// long de la route et ~48 m vers le haut. Une clôture de piquets de châtaignier, une lisse et du
// fil de fer ; une barrière ouverte face à la route ; un abri de pierre sèche sous la lauze, un
// abreuvoir de granit ; et le troupeau.
// La brebis est faite ici (le jeu n'a pas de modèle de mouton) : un corps et une tête de laine
// photographiée (wool_boucle, Poly Haven), des pattes fines, deux postures — tête haute, tête
// dans l'herbe — instanciées.
// =====================================================================
import { THREE, scene, phMat, phPeint, addCap } from './engine.js?v=41';
import { Lot, graine } from './pouget-bati.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// La toison : aucune photo de laine de mouton dans le jeu (wool_boucle, le tissu bouclé, rendait
// des carreaux). Une toison peinte — des mèches bouclées crème, plus sombres au creux — posée
// SUR le relief photographié du gravier (phPeint) : la lumière accroche les mèches.
function toison(clair, rep) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = clair ? '#8a8070' : '#9a9080'; g.fillRect(0, 0, 256, 256);   // le creux entre les mèches, ombré
  for (let k = 0; k < 1400; k++) {
    const x = rand(0, 256), y = rand(0, 256), r = rand(3, 9), t = rand(0, 1);
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {           // raccord sans couture
      const gr = g.createRadialGradient(x + dx - r * 0.3, y + dy - r * 0.3, r * 0.1, x + dx, y + dy, r);
      gr.addColorStop(0, `rgba(248,243,230,${0.85 + t * 0.15})`); gr.addColorStop(0.6, 'rgba(214,204,184,0.85)'); gr.addColorStop(1, 'rgba(110,98,80,0.7)');
      g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}

const alea = graine(2210), rand = (a, b) => a + alea() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z), HAUT = V(0, 1, 0);
function dansPoly(x, z, pts) {
  let d = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; }
  return d;
}

// h : l'altitude ; bord : la ligne côté route (du nord au sud) ; profond : vers l'ouest ;
// troncs : les arbres déjà plantés (la clôture les contourne) ; porte : la place de la barrière
// le long du bord, de 0 à 1. Renvoie le contour (pour écarter les autres arbres) et l'abri.
export async function enclos({ h, bord, profond = 48, troncs = [], porte = 0.42 }) {
  // le contour : le bord, puis la même ligne repoussée vers le haut du pré
  const ouest = bord.map(([x, z], k) => { const [xa, za] = bord[Math.max(0, k - 1)], [xb, zb] = bord[Math.min(bord.length - 1, k + 1)];
    const dx = xb - xa, dz = zb - za, l = Math.hypot(dx, dz) || 1; return [x - dz / l * profond, z + dx / l * profond]; });
  const tour = [...bord, ...ouest.slice().reverse(), bord[0]];
  // ---------- la clôture ----------
  const bois = new Lot(), fils = [], piquets = [];
  const pres = (x, z) => troncs.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 0.6);
  let prec = null, s = 0;
  const L0 = bord.reduce((a, p, k) => a + (k ? Math.hypot(p[0] - bord[k - 1][0], p[1] - bord[k - 1][1]) : 0), 0);
  for (let k = 1; k < tour.length; k++) {
    const [ax, az] = tour[k - 1], [bx, bz] = tour[k], l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(l / 2.5));
    for (let i = (k === 1 ? 0 : 1); i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; s += k === 1 && i === 0 ? 0 : l / n;
      // la barrière : 3,6 m sans piquet ni fil, sur le bord côté route
      const dansPorte = k < bord.length && Math.abs(s - porte * L0) < 1.8;
      if (pres(x, z) || dansPorte) { prec = dansPorte ? null : prec; continue; }
      const y = h(x, z), hp = rand(1.15, 1.35), p = V(x, y, z);
      const g = new THREE.CylinderGeometry(0.05, 0.065, hp + 0.3, 6); g.translate(0, (hp + 0.3) / 2 - 0.3, 0); g.rotateZ(rand(-0.05, 0.05)); g.rotateX(rand(-0.05, 0.05)); g.translate(x, y, z); piquets.push(g);
      if (prec) {
        const m = prec.clone().add(p).multiplyScalar(0.5), ax2 = V().subVectors(p, prec), lg = ax2.length(); ax2.normalize();
        // la lisse en haut, le grillage à moutons en dessous (quatre fils)
        bois.bloc(m.clone().setY(m.y + 1.1), ax2.clone().multiplyScalar(lg / 2 + 0.08), V(0, 0.045, 0), V(-ax2.z, 0, ax2.x).normalize().multiplyScalar(0.025));
        for (const dy of [0.2, 0.45, 0.7, 0.92]) fils.push(prec.x, prec.y + dy, prec.z, p.x, p.y + dy, p.z);
        addCap(prec.x, prec.z, p.x, p.z, 0.12, Math.min(prec.y, p.y) + 1.25);   // on ne passe pas au travers
      }
      prec = p;
    }
  }
  scene.add(Object.assign(new THREE.Mesh(mergeGeometries(piquets), phMat('dead_tree_tiled', 0.4, 1.4, { color: 0xa09484 })), { castShadow: true }));
  bois.maille(phMat('wood_planks', 1, 1, { color: 0xb8b0a2 }));
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(fils, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x77736c, transparent: true, opacity: 0.55 }))); }
  // la barrière, ouverte, rabattue contre la clôture
  { let t = 0, ip = 0; for (let k = 1; k < bord.length; k++) { const l = Math.hypot(bord[k][0] - bord[k - 1][0], bord[k][1] - bord[k - 1][1]); if (t + l >= porte * L0) { ip = k; break; } t += l; }
    const [ax, az] = bord[ip - 1], [bx, bz] = bord[ip], d = V(bx - ax, 0, bz - az).normalize(), f = (porte * L0 - t) / Math.hypot(bx - ax, bz - az);
    const gond = V(ax + (bx - ax) * f, 0, az + (bz - az) * f).addScaledVector(d, -1.8), y = h(gond.x, gond.z), w = V(-d.z, 0, d.x);  // w : vers l'intérieur
    const ouv = d.clone().multiplyScalar(0.25).addScaledVector(w, 0.97).normalize(), barr = new Lot();
    for (const dy of [0.25, 0.6, 0.95, 1.2]) barr.bloc(gond.clone().addScaledVector(ouv, 1.6).setY(y + dy), ouv.clone().multiplyScalar(1.6), V(0, 0.05, 0), V(-ouv.z, 0, ouv.x).multiplyScalar(0.025));
    for (const t2 of [0.05, 3.15]) barr.bloc(gond.clone().addScaledVector(ouv, t2).setY(y + 0.7), ouv.clone().multiplyScalar(0.05), V(0, 0.62, 0), V(-ouv.z, 0, ouv.x).multiplyScalar(0.03));
    barr.maille(phMat('wood_planks', 1, 1, { color: 0x9a9284 })); }

  // ---------- l'abri et l'abreuvoir ----------
  const ici = (fb, fp) => { const k = Math.round(fb * (bord.length - 1)), [x, z] = bord[k], [ox, oz] = ouest[k]; return [x + (ox - x) * fp, z + (oz - z) * fp]; };
  const [ax, az] = ici(0.12, 0.8), [bx, bz] = bord[Math.min(bord.length - 1, Math.round(0.12 * (bord.length - 1)) + 1)], dir = V(bx - bord[Math.round(0.12 * (bord.length - 1))][0], 0, bz - bord[Math.round(0.12 * (bord.length - 1))][1]).normalize();
  { // l'abri : trois murs de pierre sèche, ouvert vers l'aval, un pan de lauzes
    const r = dir, s = V(-dir.z, 0, dir.x), L = 6, W = 4, sol = Math.min(h(ax, az), h(ax + s.x * W, az + s.z * W)) - 0.4, haut = Math.max(h(ax, az), h(ax + s.x * W, az + s.z * W)) + 2.3;
    const pierre = new Lot(), lauze = new Lot(), o = V(ax, 0, az);
    pierre.bloc(o.clone().addScaledVector(s, W - 0.3).setY((sol + haut + 0.6) / 2), r.clone().multiplyScalar(L / 2), V(0, (haut + 0.6 - sol) / 2, 0), s.clone().multiplyScalar(0.3));   // le fond, côté amont
    for (const sg of [-1, 1]) pierre.bloc(o.clone().addScaledVector(r, sg * (L / 2 - 0.3)).addScaledVector(s, W / 2).setY((sol + haut) / 2), r.clone().multiplyScalar(0.3), V(0, (haut - sol) / 2, 0), s.clone().multiplyScalar(W / 2));
    const pente = Math.atan2(0.9, W + 0.8), n = V(0, Math.cos(pente), 0).addScaledVector(s, -Math.sin(pente)), d2 = s.clone().multiplyScalar(Math.cos(pente)).add(V(0, Math.sin(pente), 0));
    lauze.bloc(o.clone().addScaledVector(s, W / 2).setY(haut + 0.3 + 0.08), r.clone().multiplyScalar(L / 2 + 0.4), d2.multiplyScalar((W + 1) / 2), n.multiplyScalar(0.08));
    pierre.maille(phMat('stone_wall', 1, 1, { color: 0xb4b2aa })); lauze.maille(phMat('roof_slates_02', 1, 1, { color: 0x86857f }));
    const P = (a, b) => [ax + r.x * a + s.x * b, az + r.z * a + s.z * b];
    for (const [p, q] of [[P(-L / 2, W - 0.3), P(L / 2, W - 0.3)], [P(-L / 2 + 0.3, 0), P(-L / 2 + 0.3, W)], [P(L / 2 - 0.3, 0), P(L / 2 - 0.3, W)]]) addCap(p[0], p[1], q[0], q[1], 0.35, haut);
  }
  { // l'abreuvoir : une auge taillée dans un bloc de granit, l'eau dedans
    const [x, z] = ici(0.55, 0.12), y = h(x, z), r = dir, s = V(-dir.z, 0, dir.x), g = new Lot();
    for (const [a, b, ea, eb] of [[0, -0.4, 1.3, 0.08], [0, 0.4, 1.3, 0.08], [-1.22, 0, 0.08, 0.4], [1.22, 0, 0.08, 0.4]])
      g.bloc(V(x, y + 0.3, z).addScaledVector(r, a).addScaledVector(s, b), r.clone().multiplyScalar(ea), V(0, 0.32, 0), s.clone().multiplyScalar(eb));
    g.bloc(V(x, y + 0.08, z), r.clone().multiplyScalar(1.3), V(0, 0.1, 0), s.clone().multiplyScalar(0.48));
    g.maille(phMat('granite_tile_03', 1.8, 1.8, { color: 0xb8b8b4, roughness: 0.9 }));
    const eau = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.65), new THREE.MeshStandardMaterial({ color: 0x3a4a50, roughness: 0.05, metalness: 0.5 }));
    eau.rotation.x = -Math.PI / 2; eau.rotation.z = -Math.atan2(dir.z, dir.x); eau.position.set(x, y + 0.5, z); scene.add(eau);
    addCap(x - r.x * 1.2, z - r.z * 1.2, x + r.x * 1.2, z + r.z * 1.2, 0.45, y + 0.62);
  }

  // ---------- le troupeau ----------
  await troupeau({ h, tour, troncs, n: 40 });
  return { tour };
}

// Une brebis (Blanche du Massif Central, la race de la Lozère : blanche jusqu'à la tête), en
// mètres : 1,15 m de long, 0,75 m au garrot. Deux postures : tête haute, tête qui broute.
function brebisGeo(broute) {
  const laine = [], peau = [];
  const corps = new THREE.SphereGeometry(0.5, 14, 10); corps.scale(1.15, 0.72, 0.68); corps.translate(0, 0.62, 0); laine.push(corps);
  const croupe = new THREE.SphereGeometry(0.36, 10, 8); croupe.scale(1, 0.9, 1); croupe.translate(-0.38, 0.62, 0); laine.push(croupe);
  const cou = new THREE.CylinderGeometry(0.14, 0.2, 0.42, 8); cou.rotateZ(broute ? 2.3 : -0.9); cou.translate(broute ? 0.58 : 0.55, broute ? 0.45 : 0.85, 0); laine.push(cou);
  const tete = new THREE.SphereGeometry(0.15, 10, 8); tete.scale(1.6, 0.95, 0.9); tete.rotateZ(broute ? -1.1 : -0.35); tete.translate(broute ? 0.78 : 0.75, broute ? 0.22 : 1.0, 0); peau.push(tete);
  for (const sz of [-1, 1]) { const o = new THREE.BoxGeometry(0.16, 0.04, 0.07); o.rotateY(sz * 0.6); o.translate(broute ? 0.7 : 0.66, broute ? 0.3 : 1.08, sz * 0.13); peau.push(o); }
  for (const [px, pz] of [[0.32, 0.17], [0.32, -0.17], [-0.36, 0.16], [-0.36, -0.16]]) { const p = new THREE.CylinderGeometry(0.035, 0.03, 0.45, 6); p.translate(px, 0.22, pz); peau.push(p); }
  // fusion SANS recalculer les normales : celles des sphères sont lisses (recalculées sur des
  // faces séparées, la brebis paraissait taillée à facettes)
  const uv = (gs) => mergeGeometries(gs);
  return { laine: uv(laine), peau: uv(peau) };
}
// La brebis : « Animated Sheep » d'igor-lir (Sketchfab, CC BY 4.0 — assets_back/_licences/
// brebis-igor-lir.txt), choisie par Eugène le 2 octobre parce que la brebis faite main n'était pas
// belle. Réduite pour le jeu (texture 512 px, sans ses cibles de morphing : 536 Ko) ; posée
// immobile et en instances — 40 brebis, un appel de dessin. Si le fichier manque, la brebis
// faite main (brebisGeo) la remplace.
async function modeleBrebis() {
  try {
    const g = await new GLTFLoader().loadAsync('assets_back/02_personnages/animaux/brebis.glb');
    let m = null; g.scene.updateMatrixWorld(true); g.scene.traverse((o) => { if (o.isMesh && !m) m = o; });
    const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); geo.computeBoundingBox();
    const b = geo.boundingBox, L = Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = 1.2 / L;   // 1,2 m du museau à la queue
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.scale(k, k, k);
    const mat = m.material; mat.roughness = 1; mat.metalness = 0;
    return { geo, mat };
  } catch (e) { console.warn('enclos : brebis.glb absente, brebis faite main —', e.message); return null; }
}
async function troupeau({ h, tour, troncs, n }) {
  const xs = tour.map((p) => p[0]), zs = tour.map((p) => p[1]), ps = [];
  // les brebis vont par petits groupes : quelques centres, et chacune autour d'un centre
  const centres = []; for (let k = 0; k < 400 && centres.length < 6; k++) { const x = rand(Math.min(...xs), Math.max(...xs)), z = rand(Math.min(...zs), Math.max(...zs)); if (dansPoly(x, z, tour)) centres.push([x, z]); }
  for (let k = 0; k < 4000 && ps.length < n && centres.length; k++) {
    const [cx, cz] = centres[k % centres.length], a = rand(0, Math.PI * 2), r = rand(0.8, 7), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (!dansPoly(x, z, tour) || troncs.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 0.8) || ps.some((p) => Math.hypot(p[0] - x, p[1] - z) < 1.3)) continue;
    ps.push([x, z, alea() < 0.65]);
  }
  // une tuile de toison = 25 cm (UV en mètres) ; la tête, rase, à mèches plus fines
  // (le relief du gravier à la même échelle : uSize = répétitions par mètre × sa tuile de 1,6 m)
  const modele = await modeleBrebis();
  if (modele) {
    const im = new THREE.InstancedMesh(modele.geo, modele.mat, ps.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V();
    ps.forEach(([x, z], k) => { const s = rand(0.88, 1.08); q.setFromAxisAngle(HAUT, rand(0, Math.PI * 2)); m4.compose(V(x, h(x, z) - 0.03, z), q, sc.set(s, s, s)); im.setMatrixAt(k, m4); });
    im.castShadow = im.receiveShadow = true; scene.add(im);
    return;
  }
  const laine = phPeint('gravier', 6.4, 6.4, toison(true, 4), { roughness: 1 }), peau = phPeint('gravier', 12.8, 12.8, toison(false, 8), { roughness: 0.95 });
  laine.color.setHex(0xc4beb2); peau.color.setHex(0xb8b0a0); laine.normalScale.set(1.6, 1.6);
  for (const broute of [true, false]) {
    const lot = ps.filter((p) => p[2] === broute); if (!lot.length) continue;
    const g = brebisGeo(broute);
    // UV de laine en mètres, projetés selon l'orientation de chaque face (une seule projection
    // de côté étirait la laine en rayures sur le dos) : une boucle de laine à sa taille partout
    for (const q of [g.laine, g.peau]) { const p = q.attributes.position, nm = q.attributes.normal, uv = [];
      for (let i = 0; i < p.count; i++) { const ax = Math.abs(nm.getX(i)), ay = Math.abs(nm.getY(i)), az = Math.abs(nm.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (ay >= ax && ay >= az) uv.push(x, z); else if (ax >= az) uv.push(z, y); else uv.push(x, y); }
      q.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); }
    const il = new THREE.InstancedMesh(g.laine, laine, lot.length), ip = new THREE.InstancedMesh(g.peau, peau, lot.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V();
    lot.forEach(([x, z], k) => { const s = rand(0.88, 1.08); q.setFromAxisAngle(HAUT, rand(0, Math.PI * 2)); m4.compose(V(x, h(x, z) - 0.02, z), q, sc.set(s, s, s)); il.setMatrixAt(k, m4); ip.setMatrixAt(k, m4); });
    il.castShadow = ip.castShadow = true; il.receiveShadow = true; scene.add(il, ip);
  }
}
