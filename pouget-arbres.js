// The Legend of Camille — le Pouget : les arbres de près
// =====================================================================
// Les arbres de foret.js sont faits pour être vus de loin : un fût, quatre moignons de
// branches et sept grandes cartes de feuillage. Au Pouget, on passe SOUS les arbres (la route
// d'arrivée, les châtaigniers autour des maisons) : il faut une charpente qui se ramifie
// vraiment, et des feuilles par bouquets au bout des rameaux, avec le ciel entre eux.
// Deux espèces, celles des photos d'Eugène : le châtaignier (le grand arbre rond des prés, la
// vue aérienne) et le bouleau (blanc, élancé, au bord de la route — Street View).
// Chaque espèce a trois variantes, instanciées : quelques appels de dessin pour tous les arbres.
// =====================================================================
import { THREE, scene, phMat, phPeint } from './engine.js?v=41';
import { graine } from './pouget-bati.js';
import { carteForet } from './foret.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const alea = graine(4211), rand = (a, b) => a + alea() * (b - a);   // les mêmes arbres à chaque visite
const HAUT = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// une direction tirée autour de `d`, écartée d'un angle `ecart` (radians), qui remonte un peu vers le ciel
function devie(d, ecart, leve = 0) {
  const t = V().crossVectors(d, Math.abs(d.y) > 0.9 ? V(1, 0, 0) : HAUT).normalize(), b = V().crossVectors(d, t);
  const a = rand(0, Math.PI * 2);
  return d.clone().multiplyScalar(Math.cos(ecart)).addScaledVector(t, Math.sin(ecart) * Math.cos(a)).addScaledVector(b, Math.sin(ecart) * Math.sin(a)).addScaledVector(HAUT, leve).normalize();
}
// un segment de bois : un tronc de cône, UV en mètres (u autour, v le long), pour que
// l'écorce garde son grain du pied du tronc jusqu'aux rameaux
function segment(bois, a, d, l, r0, r1, cotes) {
  const g = new THREE.CylinderGeometry(r1, r0, l, cotes, 1, true);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r0, uv.getY(i) * l);
  g.translate(0, l / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(HAUT, d)); g.translate(a.x, a.y, a.z);
  bois.push(g);
  return a.clone().addScaledVector(d, l);
}
// un bouquet de feuilles : des cartes au hasard autour d'un point
function bouquet(feuilles, c, n, rayon, taille) {
  for (let k = 0; k < n; k++) {
    const g = new THREE.PlaneGeometry(taille, taille);
    g.rotateX(rand(-1.2, 1.2)); g.rotateY(rand(0, Math.PI * 2)); g.rotateZ(rand(-0.5, 0.5));
    const p = devie(HAUT, rand(0, Math.PI), 0).multiplyScalar(rayon * Math.cbrt(alea()));
    g.translate(c.x + p.x, c.y + p.y * 0.8, c.z + p.z); feuilles.push(g);
  }
}

// Le châtaignier : un fût court et gros, trois ou quatre charpentières qui partent en
// gobelet, puis deux ordres de branches ; les feuilles au bout des rameaux.
function chataignier() {
  const bois = [], feuilles = [];
  const ht = rand(2.2, 3.2), pied = segment(bois, V(0, -0.3, 0), devie(HAUT, rand(0, 0.08)), ht + 0.3, rand(0.42, 0.52), 0.34, 10);
  const n1 = 3 + (alea() < 0.6 ? 1 : 0);
  for (let i = 0; i < n1; i++) {
    // des charpentières plus couchées que dressées : le châtaignier des prés est rond et large, pas en parasol
    const d1 = devie(HAUT, rand(0.7, 1.05)), b1 = segment(bois, pied.clone().addScaledVector(d1, -0.15), d1, rand(2.6, 3.4), 0.26, 0.16, 8);
    bouquet(feuilles, b1, 10, 1.5, 1.1);
    const n2 = 2 + (alea() < 0.5 ? 1 : 0);
    for (let j = 0; j < n2; j++) {
      const d2 = devie(d1, rand(0.35, 0.75), 0.25), b2 = segment(bois, b1, d2, rand(2.0, 2.8), 0.15, 0.08, 6);
      bouquet(feuilles, b2, 8, 1.2, 1.1);
      for (let k = 0; k < 3; k++) {
        const d3 = devie(d2, rand(0.4, 0.9), 0.1), b3 = segment(bois, b2, d3, rand(1.2, 1.9), 0.075, 0.03, 5);
        // un houppier plein, mais fait de petits bouquets : le ciel passe entre eux
        bouquet(feuilles, b3, 16, 1.25, rand(1.0, 1.3));
        bouquet(feuilles, b2.clone().lerp(b3, 0.5), 6, 0.8, 1.0);
      }
    }
  }
  return { bois, feuilles };
}
// Le bouleau : une flèche fine qui ondule un peu, des branches montantes tout du long, plus
// courtes vers la cime, des rameaux qui retombent, de petites feuilles clairsemées
function bouleau() {
  const bois = [], feuilles = [];
  const H = rand(11, 15), n = 5; let p = V(0, -0.3, 0), d = devie(HAUT, rand(0, 0.06));
  const tronc = [];
  for (let k = 0; k < n; k++) { const r0 = 0.2 * (1 - k / n) + 0.03, r1 = 0.2 * (1 - (k + 1) / n) + 0.02; tronc.push([p.clone(), d.clone(), H / n]); p = segment(bois, p, d, H / n + 0.06, r0, r1, k < 2 ? 10 : 7); d = devie(d, rand(0.03, 0.1), 0.05); }
  for (let y = H * 0.3; y < H * 0.97; y += rand(0.45, 0.8)) {
    const [a, dd] = tronc[Math.min(n - 1, Math.floor(y / H * n))], t = y / H, o = a.clone().addScaledVector(dd, y - Math.floor(y / H * n) * H / n);
    const db = devie(HAUT, rand(0.7, 1.05)), l = (1.0 - t) * rand(2.4, 3.6) + 0.6;
    const fin = segment(bois, o, db, l, 0.045 * (1 - t) + 0.015, 0.012, 5);
    for (let k = 0; k < 2; k++) { const dr = devie(db, rand(0.5, 1.0), -0.5), b2 = segment(bois, fin, dr, rand(0.8, 1.4), 0.012, 0.005, 4);
      bouquet(feuilles, b2, 10, 0.7, rand(0.65, 0.85)); }
    bouquet(feuilles, o.clone().lerp(fin, 0.6), 7, 0.7, 0.75);
    bouquet(feuilles, fin, 6, 0.6, 0.75);
  }
  return { bois, feuilles };
}

// Les normales des feuilles pointent hors du houppier (et un peu vers le ciel) : éclairée
// carte par carte, la couronne faisait un nuage de facettes ; ainsi elle s'ombre comme un
// volume, claire au soleil, sombre au revers.
function normalesHouppier(g) {
  g.computeBoundingBox(); const c = g.boundingBox.getCenter(V()); c.y -= (g.boundingBox.max.y - g.boundingBox.min.y) * 0.15;
  const p = g.attributes.position, n = g.attributes.normal, v = V();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).sub(c).normalize().addScaledVector(HAUT, 0.35).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  n.needsUpdate = true; return g;
}

// l'écorce du bouleau : blanche, barrée de lenticelles sombres, peinte SUR l'écorce
// photographiée du saule pour en garder le relief
function ecorceBouleau() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#e6e2d8'; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${200 + rand(0, 40) | 0},${196 + rand(0, 40) | 0},${186 + rand(0, 40) | 0},0.5)`; g.fillRect(rand(0, 512), rand(0, 512), rand(4, 40), rand(1, 4)); }
  for (let k = 0; k < 160; k++) { const x = rand(0, 512), y = rand(0, 512), l = rand(10, 70);
    g.fillStyle = `rgba(${30 + rand(0, 30) | 0},${28 + rand(0, 25) | 0},${26 + rand(0, 20) | 0},${rand(0.55, 0.95)})`; g.fillRect(x, y, l, rand(1.5, 4)); if (x + l > 512) g.fillRect(x - 512, y, l, 3); }
  for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(40,36,30,0.75)'; g.beginPath(); g.ellipse(rand(0, 512), rand(0, 512), rand(8, 26), rand(5, 14), 0, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

const FAB = { chataignier, bouleau };
// places : [{ x, y, z, espece, s }] — renvoie les troncs pour les collisions
export function planterArbresDePres(places) {
  const mats = {
    chataignier: { bois: phMat('tree_trunk', 1, 1, { color: 0x9a9088 }),
      feuilles: new THREE.MeshStandardMaterial({ map: carteForet('houppier_chene'), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85, color: 0x9cac78 }) },
    bouleau: { bois: phPeint('bark_willow', 1.2, 1.2, ecorceBouleau()),
      // fin d'été qui tourne : du vert clair, et déjà de l'or (la photo de la route)
      feuilles: new THREE.MeshStandardMaterial({ map: carteForet('houppier_fin'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, color: 0xf4e070 }) },
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(), troncs = [];
  for (const esp of Object.keys(FAB)) {
    const ici = places.filter((p) => p.espece === esp); if (!ici.length) continue;
    for (let v = 0; v < 3; v++) {
      const lot = ici.filter((_, k) => k % 3 === v); if (!lot.length) continue;
      const { bois, feuilles } = FAB[esp]();
      const gb = mergeGeometries(bois), gf = normalesHouppier(mergeGeometries(feuilles));
      const ib = new THREE.InstancedMesh(gb, mats[esp].bois, lot.length), iff = new THREE.InstancedMesh(gf, mats[esp].feuilles, lot.length);
      lot.forEach((p, k) => { q.setFromAxisAngle(HAUT, rand(0, Math.PI * 2)); m4.compose(V(p.x, p.y, p.z), q, sc.set(p.s, p.s * rand(0.92, 1.08), p.s)); ib.setMatrixAt(k, m4); iff.setMatrixAt(k, m4);
        troncs.push({ x: p.x, z: p.z, r: (esp === 'bouleau' ? 0.22 : 0.5) * p.s }); });
      ib.castShadow = iff.castShadow = true; ib.receiveShadow = iff.receiveShadow = true; scene.add(ib, iff);
    }
  }
  return troncs;
}
