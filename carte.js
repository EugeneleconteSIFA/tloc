// carte.js — la géométrie du monde, source de vérité.
//
// Tracé de la citadelle (relevé OSM, cf. carte/README.md), relief de la plaine, zones,
// distances signées, exclusions. Tous les autres modules s'y réfèrent et aucun ne
// redéfinit de géométrie dans son coin (cf. ORCHESTRATION.md).
//
// Conventions : une unité = un mètre, origine au centre de la citadelle, x = est,
// z = sud, Porte Royale au sud. Les élévations ne suivent PAS l'échelle du plan —
// elles étaient déjà réalistes.
import { THREE, clamp, lerp, rand, TAU, distSeg, pointInPoly, scene, T, mat, pbr, pbrRepeat, phMat, stoneMat,
  mesh, boxG, flatMesh, extrudeMesh, world, addCap, getH, fbm, makeCanvas, tex, normalMapFrom, patiner, capsulesNear } from './engine.js?v=27';

// Alias : plusieurs fonctions déclarent un « E » local (un THREE.Euler de travail)
// qui masquerait le namespace du moteur. On passe donc par un nom qui ne peut pas
// être masqué — c'est une erreur qui ne se voit qu'à l'exécution.
export const patinerMat = (m, o) => patiner(m, o);
import { PARTAGE } from './etat.js';

export let TRACE = null;
try {
  TRACE = construireTrace(await fetch('carte/citadelle.json').then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }));
  console.log('tracé réel de la citadelle : %d points, %d bastions', TRACE.P.length, TRACE.bastions.length);
} catch (e) { console.warn('tracé réel indisponible, pentagone régulier :', e.message); }

// =====================================================================
//  Le relief réel (RGE ALTI de l'IGN)
// =====================================================================
// carte/relief.json : une grille régulière en coordonnées de JEU, en mètres RELATIFS —
// zéro = le niveau de la place d'Armes (19,76 m NGF). Voir carte/preparer-relief.py.
//
// Le relief du site est doux : la plaine de Flandre varie d'un mètre ou deux, et seuls
// les remparts montent à +3,4 m. C'est peu, mais c'est ce qui manquait pour que la carte
// cesse d'être une table. Les buttes tirées au hasard n'ont plus lieu d'être.

export let MNT = null;
try {
  MNT = await fetch('carte/relief.json').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  console.log('relief IGN : %d × %d au pas de %g m, de %+.2f à %+.2f m', MNT.nx, MNT.nz, MNT.pas, MNT.min, MNT.max);
} catch (e) { console.warn('relief IGN indisponible, terrain plat :', e.message); }

// altitude brute du modèle de terrain, interpolée
export function mntBrut(x, z) {
  if (!MNT) return 0;
  const fx = (x - MNT.x0) / MNT.pas, fz = (z - MNT.z0) / MNT.pas;
  if (fx < 0 || fz < 0 || fx >= MNT.nx - 1 || fz >= MNT.nz - 1) return 0;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, b = j * MNT.nx + i, c = b + MNT.nx;
  const p = MNT.h[b] + (MNT.h[b + 1] - MNT.h[b]) * u, q = MNT.h[c] + (MNT.h[c + 1] - MNT.h[c]) * u;
  return p + (q - p) * v;
}

// =====================================================================
//  Les couches IGN (BD TOPO, BD Forêt, référentiel des haies)
// =====================================================================
// carte/ign.json, déjà en coordonnées de jeu (cf. carte/preparer-ign.py). Ce que l'OSM
// ne donnait pas : la HAUTEUR des bâtiments (1 975 sur 2 035, de 1,3 à 34,2 m, médiane
// 9,5), leur nature et leur usage, les matériaux de murs et de toiture, l'essence des
// peuplements forestiers, et les haies.

export let IGN = { bati: [], haies: [], foret: [], eau: [], cours: [] };
try {
  IGN = await fetch('carte/ign.json').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  console.log('couches IGN : %d bâtiments (%d avec hauteur), %d haies, %d parcelles de forêt',
    IGN.bati.length, IGN.bati.filter((b) => b.h > 0).length, IGN.haies.length, IGN.foret.length);
} catch (e) { console.warn('couches IGN indisponibles :', e.message); }

export function construireTrace(j) {
  const c = j.corps, ferme = c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];
  const P = ferme ? c.slice(0, -1) : c.slice(), n = P.length, seg = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    seg.push({ a, b, ux: dx / L, uz: dz / L, L, nx: dz / L, nz: -dx / L });   // normale sortante
  }
  // distance signée au tracé : négative dedans, positive dehors — même convention
  // que l'ancien sdPent, pour que zones, fossés et exclusions suivent sans retouche
  const sd = (x, z) => {
    let d2 = Infinity, dedans = false;
    for (let i = 0; i < n; i++) {
      const s2 = seg[i], px = x - s2.a[0], pz = z - s2.a[1];
      const t = Math.max(0, Math.min(s2.L, px * s2.ux + pz * s2.uz));
      const qx = px - s2.ux * t, qz = pz - s2.uz * t, q = qx * qx + qz * qz;
      if (q < d2) d2 = q;
      const a = s2.a, b = s2.b;
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) dedans = !dedans;
    }
    const d = Math.sqrt(d2);
    return dedans ? -d : d;
  };
  // décalage en mitre : chaque sommet glisse le long de sa bissectrice
  const off = (o) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const pr = seg[(i - 1 + n) % n], cu = seg[i];
      let nx = pr.nx + cu.nx, nz = pr.nz + cu.nz;
      const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
      const k = o / Math.max(0.35, nx * cu.nx + nz * cu.nz);      // limite de mitre
      out.push([cu.a[0] + nx * k, cu.a[1] + nz * k]);
    }
    return out;
  };
  const rMax = Math.max(...P.map((q) => Math.hypot(q[0], q[1])));
  return { P, seg, n, sd, off, rMax, porte: j.porte, bastions: j.bastions, data: j };
}
// ---------- échelle du plan ----------
// ECH agrandit le PLAN (tout ce qui est horizontal), pas les élévations : les hauteurs
// du jeu étaient déjà réalistes (8 m d'escarpe, 3 m de terre-plein de bastion), c'est la
// carte qui était au 1/4,5. À ECH = 4,5 le pentagone fait ~700 m de pointe à pointe et
// ~1,6 km de tour : les dimensions de la citadelle de Lille.
// Remettre ECH à 1 restitue exactement l'ancienne carte.

export const ECH = 4.5;

export const COS36 = Math.cos(Math.PI / 5);

export const R_REG = 60 * ECH;                                  // pentagone régulier de secours

export const R = TRACE ? TRACE.rMax : R_REG;                    // rayon au saillant le plus éloigné

export const APO = TRACE ? TRACE.porte.p[1] : R_REG * COS36;    // z de la courtine de la Porte Royale

export const WALL_H = 8, WALL_T = 5 * 2.2, BAST_H = 3, GATE_HW = 5;      // élévations et ouvertures : inchangées

// Cotes relevées sur le plan (distance signée à l'escarpe du corps de place) :
// les gorges des ouvrages avancés sont à 35,6 m, les saillants des demi-lunes à 141,4 m.
// Le plan d'eau doit donc commencer AVANT les gorges et finir APRÈS les saillants, sinon
// les demi-lunes ne sont pas des îles mais des bosses posées sur la berge.
export const FOSSE_IN = 3 * ECH, MOAT_IN = 32, MOAT_OUT = 148, WORLD_R = 78 * ECH;

// Demi-largeur du couloir que le pont ouvre dans la demi-lune Royale. Elle est prise plus
// ÉTROITE que le tablier (4 m) : ainsi la terre de l'ouvrage recouvre le bord du tablier
// au lieu de s'en écarter, et il ne reste aucune bande sans sol entre les deux.
export const PONT_HW = 3.6;

// Le glacis : la pente dégagée au-delà de la contrescarpe. Rien n'y pousse et rien ne s'y
// bâtit — c'est la raison d'être d'un glacis, et c'est ce qui donne au XVIIᵉ siècle sa
// silhouette rase. Le parc de la Citadelle l'a boisé depuis ; le jeu se passe avant.
export const GLACIS = MOAT_OUT + 110;

export const BAST_FLANC = 12 * ECH, BAST_FACE = 8 * ECH, BAST_SAILL = 22 * ECH, BAST_RAMPE = 8 * ECH;
// ---------- rayons du monde ----------
// La plaine ne s'arrête plus sur un mur invisible : on peut marcher jusqu'aux abords,
// et c'est la forêt qui devient physiquement infranchissable.

// L'extrait OSM est un rectangle de 1719 × 1180 m, pivoté de 74,61° comme le reste du
// plan. Le monde ne s'arrête plus sur un cercle arbitraire : il s'arrête là où le relevé
// s'arrête, et c'est une enceinte urbaine qui ferme la carte.

export const ENCEINTE = [[417.6, -800.5], [873.9, 857.1], [-263.7, 1170.2], [-719.9, -487.4]];

export const ENCEINTE_C = [77.0, 184.8];      // centre du rectangle, décalé du centre de la place

export const ENCEINTE_H = 11;                 // hauteur de la courtine urbaine

export const PLAINE_R = 1275;       // bord du sol maillé : couvre les quatre coins du relevé

export const MARCHE_R = 1230;       // filet de sécurité radial (l'enceinte est la vraie limite)

export const LISIERE_R0 = 1000;     // début de l'épaississement de la forêt, hors emprise bâtie

export const LISIERE_R1 = 1160;     // au-delà : capsules jointives

// Distance signée au rectangle du relevé : négative dedans. Le retrait est faible (4 m) :
// certains tracés relevés — la Lunette du Grand Carré, des berges — sont coupés par le
// bord de l'extrait, et un retrait plus large les mettait hors du monde.
export function sdEnceinte(x, z) { return sdPoly(x, z, ENCEINTE) + 4; }

export function dansEnceinte(x, z) { return sdEnceinte(x, z) < 0; }

export const BASTION_NAMES = ['Bastion du Roi', 'Bastion de la Reine', 'Bastion du Dauphin', 'Bastion de Turenne', "Bastion d'Anjou"];
// Repères du monde. Les POSITIONS suivent l'échelle du plan ; les BÂTIMENTS gardent
// leurs dimensions réelles (une maison ne grandit pas parce que la carte s'agrandit).

// La maison de Camille se retrouvait dans le fossé une fois celui-ci porté à ses vraies
// cotes. Elle se pose au bord de la route, hors du glacis et hors de l'emprise bâtie.
export const HOUSE = { x: 38.4 * ECH, z: 135.8 * ECH, w: 10, d: 8 };   // maison de Camille

export const MAGE = { x: -102 * ECH, z: 58 * ECH, clair: 13 * 2.5 };     // chaumière du vieux mage, au fond du bois

export const DONJON = { x: 0, z: -4 * ECH, half: 6, h: 18, fence: 13 * 3, gateZ: -4 * ECH + 13 * 3 };

export const POTERNE = { x: 27 * ECH, z: 31 * ECH };

// Le moulin était planté en plein Canal de la Haute-Deûle et sur l'étang de 33 000 m²
// qui le borde : deux relevés que le jeu effaçait pour lui. Il passe dans la plaine
// ouverte à l'est de la place (la Plaine Félix Grimonprez du relevé), à 115 m de toute
// eau et 112 m du premier bois — la Deûle revient entière.
// La carte réelle ne laisse plus un seul carré de 140 m libre : le moulin se serre donc
// contre le bourg, sur la même clairière, et ses parcelles partent vers l'est, du côté
// où il n'y a ni eau, ni bâti, ni ouvrage avancé.
export const FERME = { x: 116.7 * ECH, z: 17.8 * ECH };         // moulin d'Émile, en lisière du bourg
// parcelles : écart au moulin (suit le plan) puis taille réelle du champ

// écarts au moulin (en unités de plan, donc × ECH chez ceux qui les lisent), puis taille
// en mètres. Les écarts étaient multipliés par ECH mais pas les tailles : les quatre
// parcelles se chevauchaient, une clôture traversait le moulin, deux terres labourées se
// disputaient le même sol. Elles ont été replacées par balayage (24 septembre) sur du
// terrain que la carte laisse libre — ni eau, ni voie, ni bois, ni haie relevée, à plus
// de 9 m du moulin — avec 6 m d'allée entre deux parcelles.
export const CHAMPS = [[-2.13, 5.85, 40, 28], [4.89, -8.47, 40, 28], [-12.44, 0, 40, 28], [2.47, 14.01, 40, 28]];

export const HOUSE_SMOKE_TOP = 12;
// ---------- relief doux de la plaine : buttes analytiques ----------
// Chaque butte est un dôme dont le profil h(t) = H·(1-t²)² sert À LA FOIS au maillage
// et à la hauteur de collision : le sol visible et le sol marchable ne peuvent pas diverger.

export const MOUNDS = [];

export let COBBLE = null;

export const cobbles = () => (COBBLE = COBBLE || cobbleTextures());

export const COBBLE_M = 0.96;   // une tuile = 8 × 8 pavés de 12 cm

export function moundH(x, z) {
  let h = 0;
  for (const m of MOUNDS) {
    const dx = x - m.x, dz = z - m.z, d2 = dx * dx + dz * dz;
    if (d2 >= m.r2) continue;
    const k = 1 - d2 / m.r2;
    if (m.h * k * k > h) h = m.h * k * k;
  }
  return h;
}

export function moundGeometry(R, H, seg = 26, rings = 6) {
  const pos = [0, H, 0], uv = [0, 0], idx = [];
  for (let ri = 1; ri <= rings; ri++) {
    const t = ri / rings, rr = t * R, k = 1 - t * t, y = H * k * k;
    for (let a = 0; a < seg; a++) {
      const an = a / seg * TAU, cx = Math.cos(an) * rr, cz = Math.sin(an) * rr;
      pos.push(cx, y, cz); uv.push(cx, cz);          // UV en mètres -> phMat(slug, 1, 1)
    }
  }
  for (let a = 0; a < seg; a++) idx.push(0, 1 + (a + 1) % seg, 1 + a);
  for (let ri = 1; ri < rings; ri++) {
    const b0 = 1 + (ri - 1) * seg, b1 = 1 + ri * seg;
    for (let a = 0; a < seg; a++) {
      const n = (a + 1) % seg;
      idx.push(b0 + a, b1 + n, b1 + a); idx.push(b0 + a, b0 + n, b1 + n);
    }
  }
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ge.setIndex(idx); ge.computeVertexNormals();
  return ge;
}


// vrai là où la nature pousse librement : ni citadelle, ni village, ni route, ni ferme,
// ni maison, ni obstacle déjà posé. Sert au placement des buttes, des arbres et de l'herbe.

// Tissu urbain : emprise bâtie ou chaussée, et les neuf mètres autour. La forêt
// procédurale poussait AU TRAVERS du quartier — deux mille bâtiments relevés, et des
// chênes dans chaque cour et au milieu de chaque rue. Un parc, un bois ou un jardin
// relevés ne sont pas de la ville : on continue d'y planter.
export function enQuartier(x, z, marge = 0) {
  if (distBati(x, z) > 16 + marge) return false;
  if (coucheAt(LILLE.parcs, x, z, 0) || coucheAt(LILLE.bois, x, z, 0) || coucheAt(LILLE.jardins, x, z, 0)) return false;
  return true;
}

export function libreNature(x, z, marge = 0, rMax = PLAINE_R - 8) {
  if (Math.hypot(x, z) > rMax) return false;
  if (sdEnceinte(x, z) > -(marge + 4)) return false;      // rien ne pousse hors du relevé
  if (sdPent(x, z) < GLACIS + marge) return false;                               // glacis dégagé
  if (nearTown(x, z, marge + 4)) return false;
  if (Math.hypot(x - HOUSE.x, z - HOUSE.z) < 34 + marge) return false;
  if (Math.hypot(x - MAGE.x, z - MAGE.z) < MAGE.clair + marge) return false;   // clairière du vieux mage
  if (surDehors(x, z, marge)) return false;                                      // lunettes et ouvrages détachés
  if (margeLille(x, z) < marge + 3) return false;                                // Deûle, canaux, étangs
  if (surVoie(x, z)) return false;                                               // chemins, berges, chaussées
  if (enQuartier(x, z, marge)) return false;                                     // le tissu bâti : la forêt s'y arrête
  if (surPont(x, z) !== null) return false;                                      // tabliers
  if (Math.abs(x) < 14 + marge && z > 0) return false;                             // pont et allée d'entrée
  if (nearFarm(x, z)) return false;
  for (const c of capsulesNear(x, z, 0)) if (c.r > 1 && distSeg(x, z, c.ax, c.az, c.bx, c.bz) < c.r + 2 + marge) return false;
  return true;
}
// Les buttes ne sont plus des dômes posés sur l'herbe : elles entrent dans le champ de
// hauteur, donc dans le maillage unique de la plaine. On ne garde ici que le tirage.

export function placerButtes() {
  construireLille();                       // les nappes d'eau avant les buttes : on ne pose pas une colline dans la Deûle
  // Le relief vient du relevé : on ne tire plus de collines au hasard. Elles entraient
  // en concurrence avec le terrain réel, et la carte fait foi.
  if (MNT) return;
  for (let i = 0, essais = 0; i < 110 && essais < 9000; essais++) {
    // l'anneau de tirage datait de la carte au 1/4,5 : il tombait entièrement dans le
    // glacis plat. On tire désormais entre le bord des fossés et le pied des montagnes.
    const a = rand(0, TAU), r = rand(MOAT_OUT + 70, PLAINE_R - 70), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const grande = i % 3 === 0;
    const R = grande ? rand(28, 46) * 2.2 : rand(13, 24) * 2.2, H = grande ? rand(2.4, 6.5) : rand(1.0, 3.2);
    if (!libreNature(x, z, 6)) continue;
    if (margePlate(x, z) < R + 10) continue;                       // la butte entière reste hors des zones aménagées
    if (sdPent(x, z) - R < GLACIS) continue;                       // la butte ENTIÈRE reste hors du glacis
    if (Math.hypot(x, z) + R > PLAINE_R - 18) continue;
    let chevauche = false;
    for (const m of MOUNDS) if (Math.hypot(x - m.x, z - m.z) < Math.sqrt(m.r2) * 0.75) { chevauche = true; break; }
    if (chevauche) continue;
    MOUNDS.push({ x, z, r2: R * R, h: H });
    i++;
  }
}
// Sol de la plaine : anneau maillé dont le bord intérieur épouse EXACTEMENT le pentagone
// décalé (donc aucune dent de scie contre la berge des douves) et le bord extérieur est
// un cercle au pied des montagnes. Chaque sommet est posé à solPlaine(x, z) : le sol
// qu'on voit et le sol sur lequel on marche sont le même champ.

// Le terrain en MORCEAUX. L'anneau de la plaine était un seul maillage de 380 000 triangles
// et de 1 275 m de rayon : toujours dessiné en entier, y compris derrière la caméra. On le
// découpe en S secteurs × B bandes qui PARTAGENT les sommets (aucune copie), chacun avec la
// sphère englobante de ses seuls sommets — computeBoundingSphere() prendrait l'anneau entier
// et le culling ne rejetterait rien. `garde(i0, i1, i2)` permet d'écarter des triangles.
let NA_PLAINE = 0, NR_PLAINE = 0;
function morcelerAnneau(ge, mat, garde, S = 24, B = 3) {
  const idx = ge.getIndex().array, pos = ge.getAttribute('position'), lots = new Map();
  for (let t = 0; t < idx.length / 3; t++) {
    const q = t >> 1, j = Math.floor(q / NA_PLAINE), a = q % NA_PLAINE;
    const i0 = idx[t * 3], i1 = idx[t * 3 + 1], i2 = idx[t * 3 + 2];
    if (garde && !garde(i0, i1, i2)) continue;
    const k = Math.floor(a * S / NA_PLAINE) + ',' + Math.floor(j * B / NR_PLAINE);
    let l = lots.get(k); if (!l) lots.set(k, l = []); l.push(i0, i1, i2);
  }
  const g = new THREE.Group(), v = new THREE.Vector3();
  g.userData.morcele = true;                        // mergeStatics n'y touche pas
  for (const l of lots.values()) {
    const sub = new THREE.BufferGeometry();
    for (const [nom, attr] of Object.entries(ge.attributes)) sub.setAttribute(nom, attr);
    sub.setIndex(l);
    const box = new THREE.Box3(); for (const i of l) box.expandByPoint(v.fromBufferAttribute(pos, i));
    sub.boundingBox = box; sub.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    g.add(new THREE.Mesh(sub, mat));
  }
  return g;
}

export function maillagePlaine(offset, rOut) {
  // Résolution : à 1:1 une maille de 14 m avalait la Deûle. 6 m radialement, ~2 m le long
  // du bord — c'est ce qu'il faut pour qu'un canal creusé dans le champ de hauteur se voie.
  // ANNEAUX RESSERRÉS AU PIED DE LA PLACE. À pas constant (6 m), un anneau enjambait la
  // berge des fossés — cinq mètres de dénivelé en vingt — et le sol dessiné coupait la
  // pente en corde : jusqu'à 1,5 m d'écart avec le sol marchable (solPlaine, grille de
  // 3 m), Camille enfoncée d'un côté, flottant de l'autre (banc arpenteur, 25 septembre).
  // Les anneaux suivent donc t^1,7 : ~1 m au bord intérieur, 3 à 4 m sur les fossés et le
  // glacis, 9 m au bord de la carte où le relief est doux.
  const PAR_COTE = 230, NA = 5 * PAR_COTE, NR = 190, EXPO = 1.7;
  NA_PLAINE = NA; NR_PLAINE = NR;
  const pos = new Float32Array((NR + 1) * NA * 3), uv = new Float32Array((NR + 1) * NA * 2), col = new Float32Array((NR + 1) * NA * 3);
  const idx = [];
  // BORD INTÉRIEUR — c'est ici que se jouait la forme du glacis. L'ancien bord était un
  // pentagone RÉGULIER de circonscrit R + offset/cos36 : il ne passait ni par les
  // saillants ni par les gorges, et dessinait autour de la place un pentagone plat qui
  // n'avait rien à voir avec elle. On échantillonne désormais le TRACÉ BASTIONNÉ décalé,
  // à pas d'arc constant. Il est étoilé vis-à-vis du centre, donc l'extrusion radiale
  // vers l'extérieur ne peut pas se recouper.
  const bord = new Float32Array(NA * 2);
  if (TRACE) {
    const Pb = TRACE.off(offset), nb = Pb.length, cum = new Float64Array(nb + 1);
    for (let i = 0; i < nb; i++) {
      const a = Pb[i], b = Pb[(i + 1) % nb];
      cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const Lb = cum[nb] || 1;
    let seg = 0;
    for (let a = 0; a < NA; a++) {
      const s = Lb * a / NA;
      while (seg < nb - 1 && cum[seg + 1] < s) seg++;
      const t = (s - cum[seg]) / ((cum[seg + 1] - cum[seg]) || 1);
      const p = Pb[seg], q = Pb[(seg + 1) % nb];
      bord[a * 2] = p[0] + (q[0] - p[0]) * t;
      bord[a * 2 + 1] = p[1] + (q[1] - p[1]) * t;
    }
  } else {
    const rIn = R_REG + offset / COS36;
    for (let a = 0; a < NA; a++) {
      const si = a / PAR_COTE, i0 = Math.floor(si) % 5, f = si - Math.floor(si);
      const a0 = -Math.PI / 2 + i0 * TAU / 5, a1 = a0 + TAU / 5;
      bord[a * 2] = rIn * (Math.cos(a0) + (Math.cos(a1) - Math.cos(a0)) * f);
      bord[a * 2 + 1] = rIn * (Math.sin(a0) + (Math.sin(a1) - Math.sin(a0)) * f);
    }
  }
  let v = 0;
  for (let j = 0; j <= NR; j++) {
    const t = Math.pow(j / NR, EXPO);
    for (let a = 0; a < NA; a++) {
      const px = bord[a * 2], pz = bord[a * 2 + 1], d = Math.hypot(px, pz);
      const rr = d + (rOut - d) * t, x = px / d * rr, z = pz / d * rr, y = solPlaine(x, z);
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
      uv[v * 2] = x / 100; uv[v * 2 + 1] = z / 100;
      // nuances : les crêtes jaunissent, les creux restent verts et sombres
      const g = 0.86 + NZ3(x / 7.5, z / 7.5) * 0.20 + Math.max(0, y) * 0.05;
      let cr = Math.min(1.25, g * 1.04), cg = g, cb = g * 0.90;
      // vase et gravier sur la rive : la couleur du sol EST la berge, donc aucune pièce
      // rapportée ne peut flotter au-dessus ni cligner contre elle
      // Une berge n'est pas un liseré : la vase remonte par plaques, elle est SOMBRE
      // (elle est mouillée) et elle se dissout dans l'herbe au lieu de s'y arrêter net.
      const sde = sdEau(x, z);
      let vase = lisse((5 - sde) / 18);                            // la rive est large, pas un liseré
      vase *= 0.55 + 0.45 * lisse((NZ2(x / 11, z / 11) - 0.30) * 2.4);
      if (sde < -0.5) vase = Math.max(vase, 0.94);                 // sous l'eau : vase franche
      if (vase > 0) { const k = Math.min(1, vase);
        cr = cr + (0.58 - cr) * k; cg = cg + (0.52 - cg) * k; cb = cb + (0.40 - cb) * k; }
      col[v * 3] = cr; col[v * 3 + 1] = cg; col[v * 3 + 2] = cb;
      v++;
    }
  }
  for (let j = 0; j < NR; j++) for (let a = 0; a < NA; a++) {
    const n = (a + 1) % NA, b0 = j * NA, b1 = (j + 1) * NA;
    idx.push(b0 + a, b1 + n, b1 + a, b0 + a, b0 + n, b1 + n);
  }
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  ge.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  ge.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ge.setIndex(idx); ge.computeVertexNormals();
  GEO_PLAINE = ge;
  calerReliefSurMaillage(ge);
  const g = morcelerAnneau(ge, phMat('grass_ground', 100, 100, { color: 0x9cc267, vertexColors: true }));
  g.name = 'plaine';
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

export let GEO_PLAINE = null;
// Tapis de sous-bois : même maillage que la plaine, mais couvert d'aiguilles et de
// feuilles mortes, dont l'opacité monte à mesure qu'on entre dans le bois. Il partage
// les tampons de la plaine — seule la couleur (RVB + alpha) lui appartient.

export function tapisForestier() {
  if (!GEO_PLAINE) return null;
  const pos = GEO_PLAINE.getAttribute('position'), n = pos.count;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', pos);
  g.setAttribute('normal', GEO_PLAINE.getAttribute('normal'));
  g.setAttribute('uv', GEO_PLAINE.getAttribute('uv'));
  g.setIndex(GEO_PLAINE.getIndex());
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    let a = Math.max(sousBois(x, z), lisse((r - LISIERE_R0) / 60));  // bois relevés, puis lisière
    if (sdPent(x, z) < GLACIS || dehorsAt(x, z)) a = 0;              // ni sur le glacis, ni sur les ouvrages
    a *= 0.30 + 0.70 * lisse((NZ2(x / 27, z / 27) - 0.22) * 2.1);   // par plaques, pas uniforme
    if (margePlate(x, z) < 8) a = 0;                                 // rien sur les zones aménagées
    col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1; col[i * 4 + 3] = clamp(a, 0, 0.94);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  // Couche transparente sur TOUT le terrain : chaque pixel de sol était dessiné deux fois,
  // alors que le tapis est invisible (alpha nul) sur l'essentiel de la carte. On ne garde
  // que les triangles où il y a du sous-bois, en morceaux comme la plaine.
  const vu = (i) => col[i * 4 + 3] > 0.004;
  const t = morcelerAnneau(g, phMat('forest_leaves_04', 100, 100, { vertexColors: true, transparent: true, depthWrite: false }),
    (i0, i1, i2) => vu(i0) || vu(i1) || vu(i2));
  t.name = 'tapis-forestier';
  for (const m of t.children) { m.position.y = 0.045; m.receiveShadow = true; m.renderOrder = 1; }
  return t;
}

// =====================================================================
//  Relief de la plaine
// =====================================================================
// Le sol n'est plus un disque parfaitement plat : un bruit de valeur à trois octaves
// (52 m, 21 m, 11 m) lui donne du volume. Le MÊME champ sert au maillage visible et à
// la hauteur de collision — ils ne peuvent donc pas diverger. Tout ce qui a été posé à
// la main (citadelle, village, routes, ferme, maison) reste rigoureusement plat : un
// masque ramène le relief à zéro sur ces zones, avec une transition douce de ~12 m.

export function bruit2D(cells, seed) {
  const g = new Float32Array(cells * cells);
  let st = seed >>> 0;
  for (let i = 0; i < g.length; i++) { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; g[i] = st / 4294967296; }
  const at = (a, b) => g[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    const p = a + (b - a) * u, q = c + (d - c) * u;
    return p + (q - p) * v;
  };
}

export const NZ1 = bruit2D(64, 1337), NZ2 = bruit2D(64, 7717), NZ3 = bruit2D(64, 424242);
// amplitudes en mètres, crête à creux : ±1,08 m au total, pentes ≤ 5°

export function bruitPlaine(x, z) {
  return (NZ1(x / 52, z / 52) - 0.5) * 1.10
       + (NZ2(x / 21, z / 21) - 0.5) * 0.66
       + (NZ3(x / 11, z / 11) - 0.5) * 0.40;
}

export const lisse = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
// distance signée (en mètres) à la zone plate la plus proche : > 0 = on est dehors.
// margeBatie ne connaît que les lieux inventés du jeu ; margePlate y ajoute les nappes
// d'eau relevées. La séparation évite un cycle : le filtrage de LILLE appelle margeBatie.

export function margePlate(x, z) { return Math.min(margeBatie(x, z), margeLille(x, z), margeVille(x, z)); }

export function margeBatie(x, z) { return Math.min(sdPent(x, z) - (MOAT_OUT + 3), margeLieux(x, z)); }

export function margeLieux(x, z) {
  let d = Math.hypot(x - HOUSE.x, z - HOUSE.z) - 16;                       // maison de Camille
  d = Math.min(d, Math.hypot(x - MAGE.x, z - MAGE.z) - (MAGE.clair - 2));  // clairière du vieux mage
  // allée d'entrée + pont : couloir |x| < 9 au sud
  d = Math.min(d, Math.max(Math.abs(x) - 14, -(z + 6)));
  // emprise du bourg : distance à la boîte locale, ramenée en mètres monde
  { const [lx, lz] = townLocal(x, z), B = TOWN_BOITE;
    const ex = Math.max(B.x0 - lx, lx - B.x1), ez = Math.max(B.z0 - lz, lz - B.z1);
    const dl = (ex < 0 && ez < 0) ? Math.max(ex, ez) : Math.hypot(Math.max(ex, 0), Math.max(ez, 0));
    d = Math.min(d, (dl - 4) * TOWN.s); }
  // route du pont au village
  { const P = roadPts(); let dr = Infinity;
    for (let i = 0; i < P.length - 1; i++) dr = Math.min(dr, distSeg(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
    d = Math.min(d, dr - 6); }
  // ouvrages avancés posés hors des fossés (la lunette du Grand Carré) : terrain plat
  for (const o of DEHORS) if (o.sdMin > MOAT_OUT) d = Math.min(d, Math.hypot(x - o.c[0], z - o.c[1]) - (o.rr + 6));
  // moulin et champs labourés de l'ouest
  { let df = Math.hypot(x - FERME.x, z - FERME.z) - 24;
    for (const [dx, dz, fw, fd] of CHAMPS)
      df = Math.min(df, Math.max(Math.abs(x - (FERME.x + dx * ECH)) - fw / 2 - 4, Math.abs(z - (FERME.z + dz * ECH)) - fd / 2 - 4));
    d = Math.min(d, df); }
  return d;
}
// Le MNT contient AUSSI les remparts, les ouvrages et le fossé — que le jeu construit de
// son côté, à ses propres cotes. Les compter deux fois donnerait des bastions de seize
// mètres. On ne prend donc le relevé qu'au-delà des ouvrages (sd > 160), en le faisant
// monter progressivement jusqu'au bord du glacis, et on le coupe hors du relevé.

export function mntH(x, z) {
  if (!MNT) return 0;
  const sd = sdPent(x, z);
  if (sd < 160) return 0;
  const k = lisse((sd - 160) / (GLACIS - 160)) * lisse((-sdEnceinte(x, z)) / 30);
  return k > 0 ? mntBrut(x, z) * k : 0;
}
// 0 = sol rigoureusement plat, 1 = relief complet

export function platK(x, z) {
  const k = lisse(margePlate(x, z) / 12);
  if (k <= 0) return 0;
  // le relief s'éteint avant le pied des montagnes pour que le raccord soit invisible
  return k * lisse((PLAINE_R - 6 - Math.hypot(x, z)) / 14);
}

// ---------- carte de relief pré-calculée ----------
// `levelH` est appelé des dizaines de fois par image (joueur, ennemis, ramassages,
// caméra). On échantillonne donc le champ une bonne fois sur une grille de 2 m et on
// interpole bilinéairement : c'est continu, et le coût par appel devient négligeable.

export const RG_PAS = 3;   // le monde est passé de 900 à 1275 m de rayon : la grille s'allège d'autant

export const RG_N = Math.ceil(2 * PLAINE_R / RG_PAS) + 1, RG_0 = -PLAINE_R;

export let RELIEF = null;

// Le sol naturel en un point : le relevé IGN, l'ondulation de détail là où rien n'est
// aménagé, et le creusement des nappes d'eau — qui se fait désormais par rapport au sol
// LOCAL et non à un zéro global, sinon une rivière posée sur un terrain qui monte
// déborderait d'un côté et se viderait de l'autre.
export function terrainNaturel(x, z) {
  const base = mntH(x, z) + bruitPlaine(x, z) * platK(x, z);
  // LA BERME DU FOSSÉ. L'eau de la ceinture s'arrête à EAU_RETRAIT du trait (7 m) ; en deçà,
  // nappeProche() l'ignore — et le terrain restait à sa cote, puis tombait d'un coup au fond
  // du fossé : un à-pic d'herbe de 4,8 m, que ni le maillage ni la grille du relief ne
  // savent dessiner, d'où un sol marchable et un sol dessiné qui divergeaient de 1,5 m tout
  // autour de la place (banc arpenteur). La berme descend maintenant en pente douce, du pied
  // du mur (1,5 m) jusque sous le niveau de l'eau au bord de la nappe.
  { const sd = sdPent(x, z);
    if (sd > 1.5 && sd < EAU_RETRAIT && Math.hypot(x, z) < R + 60) {
      const ceint = LILLE.eau.find((n) => n.ceinture);
      if (ceint) {
        const k = lisse((sd - 1.5) / (EAU_RETRAIT - 1.5));
        return base + (Math.min(base, ceint.y - 0.4) - base) * k;
      }
    }
  }
  const e = nappeProche(x, z);
  if (!e) return base;
  // La berge descend sur VINGT-DEUX mètres et non douze : avec un fossé creusé à près de
  // cinq mètres, douze mètres donnaient un talus à 21°, qui prenait la lumière de plein
  // fouet et dessinait un bourrelet clair tout autour de l'eau.
  const fond = e.o.y - EAU_FOND;
  const h = e.sd > 3 ? base : base + (fond - base) * lisse((4 - e.sd) / 22);
  // UN CANAL ÉTROIT DOIT SE VOIR. La berge de vingt-deux mètres n'atteint le fond qu'à
  // dix-huit mètres de la rive : un canal de moins de quarante mètres de large gardait
  // son lit AU-DESSUS de sa propre eau — l'eau restait sous l'herbe, invisible, mais on
  // s'y noyait et elle barrait le passage (4,3 ha sur la carte, dont le canal de la
  // Tortue). On borne donc le sol par une rive franche : à la cote de l'eau moins 30 cm au
  // trait de rive, en pente de 35 % vers le dehors et vers le dedans, jamais sous le fond.
  // La pente se prolonge au-delà des trois mètres de la berge d'origine, aussi loin que
  // nappeProche() voit l'eau : arrêtée là, elle aurait laissé une marche au bord du talus.
  const rive = Math.max(fond, e.o.y - 0.3 + 0.35 * e.sd);
  return Math.min(h, rive);
}

// L'eau se voit-elle ici ? Sa surface doit passer au-dessus du sol. Les règles d'eau (on
// bute, on tombe dedans) s'en remettent à ce que l'on voit : si un jour le relief remonte
// au-dessus d'une nappe, on marche sur l'herbe au lieu de se noyer dans une eau cachée.
export function eauVisible(x, z) {
  const e = nappeProche(x, z);
  return !!e && e.sd < 0 && solPlaine(x, z) < e.o.y - 0.05;
}

// La grille n'est publiée qu'une fois pleine : pendant la cuisson, terrainNaturel()
// appelle margeLieux() -> roadPts() -> preparerPonts(), et un RELIEF déjà assigné mais
// encore à zéro faisait croire le relief prêt — les ponts se calaient sur un sol plat.
export function cuireRelief() {
  const g = new Float32Array(RG_N * RG_N);
  for (let j = 0; j < RG_N; j++) for (let i = 0; i < RG_N; i++) {
    const x = RG_0 + i * RG_PAS, z = RG_0 + j * RG_PAS;
    g[j * RG_N + i] = terrainNaturel(x, z);
  }
  RELIEF = g;
}
// LE SOL MARCHABLE EST LE SOL DESSINÉ. Le maillage de la plaine est plus lâche que la
// grille du relief (3 m) : ses triangles coupent les buttes et les berges en corde, et
// Camille marchait jusqu'à 0,9 m au-dessus ou au-dessous de l'herbe qu'on voit (banc
// arpenteur, 25 septembre). Une fois le maillage bâti, on réécrit donc chaque nœud de la
// grille qu'il couvre avec la hauteur du triangle qui le contient. solPlaine lit ensuite
// le sol dessiné, et tout ce qui se pose APRÈS (voies, arbres, maisons) se pose dessus.
function calerReliefSurMaillage(ge) {
  if (!RELIEF) return 0;
  const pos = ge.getAttribute('position').array, idx = ge.getIndex().array;
  let n = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ax = pos[a], az = pos[a + 2], bx = pos[b], bz = pos[b + 2], cx = pos[c], cz = pos[c + 2];
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-9) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - RG_0) / RG_PAS)), i1 = Math.min(RG_N - 1, Math.floor((Math.max(ax, bx, cx) - RG_0) / RG_PAS));
    const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - RG_0) / RG_PAS)), j1 = Math.min(RG_N - 1, Math.floor((Math.max(az, bz, cz) - RG_0) / RG_PAS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = RG_0 + i * RG_PAS, z = RG_0 + j * RG_PAS;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      RELIEF[j * RG_N + i] = l1 * pos[a + 1] + l2 * pos[b + 1] + l3 * pos[c + 1]; n++;
    }
  }
  return n;
}

// hauteur du sol naturel de la plaine (buttes + ondulation), 0 partout ailleurs

export function solPlaine(x, z) {
  if (!RELIEF) return 0;
  const fx = (x - RG_0) / RG_PAS, fz = (z - RG_0) / RG_PAS;
  if (fx < 0 || fz < 0 || fx >= RG_N - 1 || fz >= RG_N - 1) return 0;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, b = j * RG_N + i, c = b + RG_N;
  const p = RELIEF[b] + (RELIEF[b + 1] - RELIEF[b]) * u, q = RELIEF[c] + (RELIEF[c + 1] - RELIEF[c]) * u;
  return p + (q - p) * v;
}

export const verts = [], normals = [], outDirs = [];
for (let i = 0; i < 5; i++) {
  const a = -Math.PI / 2 + i * TAU / 5;
  verts.push([R_REG * Math.cos(a), R_REG * Math.sin(a)]); outDirs.push([Math.cos(a), Math.sin(a)]);
  const na = a + Math.PI / 5; normals.push([Math.cos(na), Math.sin(na)]);
}

export function sdPent(x, z) {
  if (TRACE) return TRACE.sd(x, z);
  let m = -Infinity; for (let i = 0; i < 5; i++) m = Math.max(m, x * normals[i][0] + z * normals[i][1]);
  return m - R_REG * COS36;
}

export const bastions = [];
if (TRACE) {
  // Chaque bastion garde sa forme relevée ; S1 regarde le bastion suivant, S2 le
  // précédent, comme l'attend la boucle des courtines. La rampe d'accès part de la
  // gorge vers l'intérieur de la place : sShoulder = 0.
  TRACE.bastions.forEach((b, i) => {
    const u = b.n, v = [-u[1], u[0]];
    const pts = b.pts[0][0] === b.pts[b.pts.length - 1][0] && b.pts[0][1] === b.pts[b.pts.length - 1][1]
      ? b.pts.slice(0, -1) : b.pts.slice();
    bastions.push({
      i, V: b.V, u, v, S1: b.S1, S2: b.S2, F1: b.S1, F2: b.S2, C: b.saillant,
      poly: pts, sShoulder: 0, tShoulder: b.gorge / 2 + 3, rampLen: 28, name: b.nom,
      tRampe: 0, demiRampe: 3.4,
    });
  });
}
for (let i = 0; TRACE ? false : i < 5; i++) {
  const V = verts[i], u = outDirs[i], Vn = verts[(i + 1) % 5], Vp = verts[(i + 4) % 5];
  const e1 = [Vn[0] - V[0], Vn[1] - V[1]], e2 = [Vp[0] - V[0], Vp[1] - V[1]];
  const l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
  e1[0] /= l1; e1[1] /= l1; e2[0] /= l2; e2[1] /= l2;
  const S1 = [V[0] + BAST_FLANC * e1[0], V[1] + BAST_FLANC * e1[1]], S2 = [V[0] + BAST_FLANC * e2[0], V[1] + BAST_FLANC * e2[1]];
  const F1 = [S1[0] + BAST_FACE * u[0], S1[1] + BAST_FACE * u[1]], F2 = [S2[0] + BAST_FACE * u[0], S2[1] + BAST_FACE * u[1]], C = [V[0] + BAST_SAILL * u[0], V[1] + BAST_SAILL * u[1]];
  const v = [-u[1], u[0]];
  const sShoulder = (S1[0] - V[0]) * u[0] + (S1[1] - V[1]) * u[1], tShoulder = Math.abs((S1[0] - V[0]) * v[0] + (S1[1] - V[1]) * v[1]);
  bastions.push({ i, V, u, v, S1, S2, F1, F2, C, poly: [S1, F1, C, F2, S2], sShoulder, tShoulder,
    rampLen: BAST_RAMPE, name: BASTION_NAMES[i], tRampe: 0, demiRampe: 3.4 });
}

// Choix du couloir de rampe, une fois la place d'Armes bâtie. On balaie la largeur de la
// gorge mètre par mètre et on compte, pour chaque position possible, les stations bloquées
// du couloir ; on garde la moins mauvaise. `bloque(x, z, y)` est passé par l'appelant —
// carte.js ne connaît pas le moteur.
export function placerRampes(bloque) {
  const rapport = [];
  for (const bb of bastions) {
    const dem = bb.demiRampe, lim = Math.max(0, bb.tShoulder - dem);
    let best = null;
    // On cherche aussi la LONGUEUR : une gorge encombrée de casernes n'a pas vingt-huit
    // mètres de libre, mais souvent quatorze. Une rampe plus courte est plus raide — 21 %
    // au plus court, ce qui se gravit — et c'est mieux qu'un bastion inaccessible.
    for (const rl of [28, 22, 17, 13]) {
    for (let tr = -lim; tr <= lim + 0.001; tr += 0.5) {
      // Ce qui compte n'est pas le nombre de points bloqués — on peut se faufiler entre
      // deux casernes — mais le nombre de TRAVERSES entièrement barrées : une seule
      // suffit à rendre le bastion inaccessible.
      let barrees = 0, mous = 0, gene = 0, coupes = 0;
      // On balaie AUSSI l'approche : vingt mètres de place d'Armes devant le pied. Une
      // rampe dégagée dont le pied est enfermé dans une cour de casernes ne sert à rien.
      for (let s = bb.sShoulder - rl - 22; s <= bb.sShoulder + WALL_T / 2 + 3; s += 1.5) {
        const h = Math.max(0, BAST_H * Math.min(1, (s - (bb.sShoulder - rl)) / rl));
        // Le PIED et son approche doivent être libres sur toute la largeur : une fois
        // engagé sur la rampe on ne peut plus en sortir latéralement — le bord est une
        // marche de plus d'un demi-mètre — donc un obstacle au pied condamne tout le
        // reste, même si le tablier est dégagé au-dessus.
        const entree = s < bb.sShoulder - rl + 5;
        let libre = 0, dur = 0;
        for (let t = tr - dem + 0.5; t <= tr + dem - 0.5; t += 0.9) {
          const x = bb.V[0] + bb.u[0] * s + bb.v[0] * t, z = bb.V[1] + bb.u[1] * s + bb.v[1] * t;
          // 2 = maçonnerie, on ne l'enlèvera pas ; 1 = emprise relevée, qui cédera le
          // passage si vraiment aucun couloir ne l'évite ; 0 = libre.
          const b = bloque(x, z, h + 0.3);
          if (b >= 2) { dur++; gene++; } else { libre++; if (b) { mous++; gene++; } }
        }
        coupes++;
        if (!libre || (entree && dur)) barrees++;
      }
      const score = barrees * 1e6 + mous * 150 + gene * 10 + (28 - rl) * 6 + Math.abs(tr);
      if (!best || score < best.score) best = { score, tr, rl, barrees, gene, coupes };
    } }
    if (best) {
      bb.tRampe = best.tr; bb.rampLen = best.rl;
      rapport.push([bb.name, best.tr, best.rl, best.barrees, best.coupes]);
    }
  }
  console.log('rampes des bastions : %s', rapport.map((r) => `${r[0]} t=${r[1].toFixed(1)} L=${r[2]} (${r[3]} barrée(s)/${r[4]})`).join(' · '));
  return rapport;
}

export function bastionAt(x, z) { for (const b of bastions) if (pointInPoly(x, z, b.poly)) return b; return null; }

// =====================================================================
//  Ouvrages avancés : demi-lunes, contregardes, lunettes
// =====================================================================
// Relevés dans le fossé, entre l'escarpe du corps de place et la contrescarpe. Les
// demi-lunes couvrent les courtines, les contregardes les faces des bastions. carte.js
// n'en donne que la GÉOMÉTRIE et la terre ; le revêtement de brique, les cordons et les
// rampes appartiennent à citadelle.js, qui lit DEHORS comme il lit déjà `bastions`.

export const DEHORS_H = { demilune: 2.6, contregarde: 2.2, lunette: 2.0 };

export const DEHORS = [];
if (TRACE) {
  const ajoute = (kind, liste) => {
    for (const o of liste || []) {
      const p = o.pts.slice();
      if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
      if (p.length < 3) continue;
      let A = 0;
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; A += a[0] * b[1] - b[0] * a[1]; }
      A = Math.abs(A) / 2;
      if (A < 600) continue;                       // une allée relevée n'est pas un ouvrage
      const ds = p.map((q) => TRACE.sd(q[0], q[1]));
      const c = o.c || [p.reduce((t, q) => t + q[0], 0) / p.length, p.reduce((t, q) => t + q[1], 0) / p.length];
      const L = Math.hypot(c[0], c[1]) || 1;
      const rr = Math.max(...p.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])));
      DEHORS.push({ kind, nom: o.nom, poly: p, c, rr, n: [c[0] / L, c[1] / L],
        sdMin: Math.min(...ds), sdMax: Math.max(...ds), h: DEHORS_H[kind], aire: A });
    }
  };
  ajoute('demilune', TRACE.data.demilunes);
  ajoute('contregarde', TRACE.data.contregardes);
  ajoute('lunette', TRACE.data.ouvrages);
  console.log('ouvrages avancés : %d (%d demi-lunes, %d contregardes, %d lunettes)', DEHORS.length,
    DEHORS.filter((o) => o.kind === 'demilune').length,
    DEHORS.filter((o) => o.kind === 'contregarde').length,
    DEHORS.filter((o) => o.kind === 'lunette').length);
}

// L'ouvrage sous les pieds, ou null. Le couloir du pont est exclu : le pont TRAVERSE la
// demi-lune Royale (c'est le passage du ravelin), il ne passe pas par-dessus.
export function dehorsAt(x, z) {
  // le couloir du pont s'arrête AVEC le pont : au-delà, la terre des ouvrages reprend,
  // sinon on creuse un trou infranchissable juste après le tablier
  if (Math.abs(x) < PONT_HW && z > APO && z < PONT_Z1 + 10) return null;
  for (const o of DEHORS) {
    if (Math.hypot(x - o.c[0], z - o.c[1]) > o.rr) continue;
    if (pointInPoly(x, z, o.poly)) return o;
  }
  return null;
}

// même test, avec marge, pour les exclusions de placement (plus tolérant, sans le pont)
export function surDehors(x, z, marge = 0) {
  for (const o of DEHORS) if (Math.hypot(x - o.c[0], z - o.c[1]) < o.rr + marge) return o;
  return null;
}

// décalage en mitre d'un polygone quelconque, vers l'extérieur si o > 0. Le sens de
// parcours est déduit de l'aire signée : un relevé OSM n'est pas toujours orienté.
export function offsetPoly(pts, o) {
  const n = pts.length;
  let A = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
  const sgn = A < 0 ? -1 : 1, N = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    N.push([sgn * dz / L, -sgn * dx / L]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const pr = N[(i - 1 + n) % n], cu = N[i];
    let nx = pr[0] + cu[0], nz = pr[1] + cu[1];
    const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    out.push([pts[i][0] + nx * (o / Math.max(0.35, nx * cu[0] + nz * cu[1])),
              pts[i][1] + nz * (o / Math.max(0.35, nx * cu[0] + nz * cu[1]))]);
  }
  return out;
}

// découpe d'un polygone par le demi-plan { p·n <= c } (Sutherland–Hodgman)
export function clipHalf(pts, nx, nz, c) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const da = a[0] * nx + a[1] * nz - c, db = b[0] * nx + b[1] * nz - c;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

// Les morceaux de terre-plein d'un ouvrage : un seul, sauf la demi-lune Royale que le
// pont de la Porte Royale coupe en deux.
export function dehorsMorceaux(o) {
  if (o.kind === 'demilune' && Math.abs(o.c[0]) < 60 && o.c[1] > APO && o.c[1] < PONT_Z1 + 10)
    return [clipHalf(o.poly, -1, 0, -PONT_HW), clipHalf(o.poly, 1, 0, -PONT_HW)].filter((p) => p.length >= 3);
  return [o.poly];
}

// =====================================================================
//  La carte élargie : Deûle, canaux, bois et parcs relevés
// =====================================================================
// Mêmes coordonnées de jeu que le tracé (citadelle.json est déjà pivoté). carte.js ne
// construit ici que le TERRAIN : les nappes d'eau et leur cuvette. Les bois et les parcs
// sont exposés en données — c'est à nature.js/foret.js d'y planter, à village.js et
// campagne.js d'y poser ce qui se bâtit.

// distance signée à un polygone quelconque : négative dedans
export function sdPoly(x, z, poly) {
  let d2 = Infinity, dedans = false, n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = x - (a[0] + dx * t), qz = z - (a[1] + dz * t), q = qx * qx + qz * qz;
    if (q < d2) d2 = q;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) dedans = !dedans;
  }
  const d = Math.sqrt(d2);
  return dedans ? -d : d;
}

export const LILLE = { pret: false, eau: [], bois: [], parcs: [], herbe: [], jardins: [],
  routes: [], chemins: [], ponts: [], bati: [] };

export function construireLille() {
  if (!TRACE || LILLE.pret) return LILLE;
  LILLE.pret = true;
  const prepare = (o) => {
    const p = (o.pts || o).slice();
    if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
    if (p.length < 3) return null;
    let A = 0;
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; A += a[0] * b[1] - b[0] * a[1]; }
    A = Math.abs(A) / 2;
    if (A < 400) return null;
    const cx = p.reduce((t, q) => t + q[0], 0) / p.length, cz = p.reduce((t, q) => t + q[1], 0) / p.length;
    const rr = Math.max(...p.map((q) => Math.hypot(q[0] - cx, q[1] - cz)));
    const ds = p.map((q) => TRACE.sd(q[0], q[1]));
    // Le fossé est relevé comme un SEUL contour fermé qui fait le tour de la place. En
    // test pair-impair, l'intérieur du fort compte alors comme « dedans » : sans ce
    // drapeau, la place d'Armes se retrouve sous deux mètres d'eau.
    const ceinture = pointInPoly(0, 0, p);
    // Niveau de CETTE nappe. Un niveau global ne marche plus dès que le terrain n'est pas
    // plat — la Deûle et le fossé de la place ne sont pas à la même hauteur. On le prend
    // sur les SOMMETS, c'est-à-dire sur les berges : échantillonner vers le centre donnait,
    // pour le fossé qui fait le tour de la place, l'altitude des remparts, et le plan d'eau
    // montait de deux mètres au-dessus de sa propre rive.
    // La médiane, et non la moyenne : un seul sommet mal placé sur un talus ne doit pas
    // emporter le niveau de toute la nappe.
    const niv = [];
    for (const q of p) {
      if (ceinture && sdPent(q[0], q[1]) < EAU_RETRAIT) continue;
      niv.push(mntBrut(q[0], q[1]));
    }
    niv.sort((a, b) => a - b);
    const y = (niv.length ? niv[niv.length >> 1] : 0) - 0.55;
    return { nom: o.nom || '', poly: p, c: [cx, cz], rr, aire: A, ceinture, y,
      sdMin: Math.min(...ds), sdMax: Math.max(...ds), rMin: Math.min(...p.map((q) => Math.hypot(q[0], q[1]))) };
  };
  // LE RELEVÉ FAIT FOI. Un lieu inventé du jeu n'efface plus rien : si le cadastre met un
  // canal là où le jeu avait posé un bourg, c'est le bourg qui déménage. Seule exception,
  // le fossé de la place, que citadelle.js construit déjà de son côté.
  const ecarte = { eau: 0, bois: 0 };
  LILLE.conflits = [];        // relevés effacés par un lieu inventé : à relire quand la campagne bougera
  const eau = (TRACE.data.eau || {});
  for (const lst of [eau.plans, eau.canaux]) for (const o of lst || []) {
    const e = prepare(o); if (!e) continue;
    // UN AXE DE CANAL N'EST PAS UNE SURFACE. `canaux`, ce sont les chemins OSM
    // waterway=canal : des LIGNES ouvertes, tracées au milieu du chenal. Refermées en
    // polygone, elles dessinaient des lentilles d'eau entre le canal et sa corde — le
    // « Canal de la Moyenne-Deûle » était un triangle de 3,6 ha posé sur les quais. Mesuré
    // hors du fossé : 74 à 78 % de leur aire n'est en eau ni dans les surfaces OSM ni dans
    // la BD TOPO ; elles noyaient 39 bâtiments et 1,8 km de rues, et arrêtaient trois ponts
    // au milieu de l'eau. La Deûle réelle est déjà là, en surfaces (`plans`).
    // Le fossé de la place fait exception : aucune surface n'y est relevée, mais l'axe OSM
    // et le cours « Citadelle » de l'IGN y font tous deux courir de l'eau — c'est de ces
    // axes qu'il tient la sienne. Ses trois nappes restent sous MOAT_OUT (sdMax ≤ 103 m) ;
    // les lentilles de la Deûle commencent au-delà de 175 m.
    if (lst === eau.canaux && e.sdMax >= MOAT_OUT) { ecarte.eau++; continue; }
    // Plus aucun filtre de distance : le fossé de la place EST de l'eau relevée. Ces deux
    // lignes écartaient 20,7 ha — le Fossé des Pêcheurs et les 16,3 ha de canaux de
    // ceinture — au motif que citadelle.js dessinait un anneau à leur place. Cet anneau
    // n'existe plus ; la Deûle alimente de nouveau le fossé, comme elle l'a toujours fait.
    if (!e.poly.some((q) => dansEnceinte(q[0], q[1]))) continue;   // hors du relevé
    LILLE.eau.push(e);
  }
  // LE FOSSÉ À SEC. Le relevé OSM laisse une centaine de mètres de fossé sans eau sur la
  // face nord-ouest — quatre secteurs sur soixante-douze. L'hydrographie IGN, elle, y
  // fait courir le cours d'eau nommé « Citadelle ». On comble donc le manque, et
  // seulement le manque : on parcourt la polyligne IGN, on garde les tronçons qui sont
  // dans la bande du fossé ET hors de toute nappe déjà posée, et on les élargit.
  {
    const couvert = (x, z) => LILLE.eau.some((o) => sdPoly(x, z, o.poly) < 0);
    // Le fil d'eau relevé par l'IGN court à une vingtaine de mètres de l'escarpe, et non
    // à MOAT_IN (32 m) : le seuil se prend donc sur la maçonnerie, pas sur le pentagone
    // théorique. Faute de quoi tous les tronçons manquants étaient rejetés.
    const dansFosse = (x, z) => { const d = sdPent(x, z); return d > 12 && d < MOAT_OUT + 8; };
    let combles = 0;
    for (const o of IGN.cours) {
      if (!/citadelle/i.test(o.nom || '')) continue;
      const p = o.p || [];
      let run = [];
      const vider = () => {
        if (run.length >= 2) {
          const DEMI = 13, g = [], d = [];
          for (let i = 0; i < run.length; i++) {
            const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)];
            const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
            const nx = -dz / L, nz = dx / L;
            // une berge ne monte pas sur le mur : on repousse le sommet tant qu'il est
            // sous l'aplomb de l'escarpe
            const cale = (sx, sz) => {
              let vx = sx, vz = sz;
              // ...ni sur la poterne, qui débouche dans le fossé : la noyer bloquait
              // la sortie de la place côté bastion du Dauphin.
              const interdit = (px, pz) => sdPent(px, pz) < EAU_RETRAIT + 1.5
                || Math.hypot(px - POTERNE.x, pz - POTERNE.z) < 14
                || (Math.abs(px) < 12 && pz > 0 && sdPent(px, pz) < MOAT_OUT);
              for (let k = 0; k < 16 && interdit(vx, vz); k++) {
                const ex = vx - run[i][0], ez = vz - run[i][1], e = Math.hypot(ex, ez) || 1;
                vx -= ex / e * 1.6; vz -= ez / e * 1.6;
                if (Math.hypot(vx - run[i][0], vz - run[i][1]) < 2) break;
              }
              return [vx, vz];
            };
            g.push(cale(run[i][0] + nx * DEMI, run[i][1] + nz * DEMI));
            d.push(cale(run[i][0] - nx * DEMI, run[i][1] - nz * DEMI));
          }
          const e = prepare({ pts: g.concat(d.reverse()), nom: 'le fossé de la place' });
          if (e) { LILLE.eau.push(e); combles++; }
        }
        run = [];
      };
      for (const q of p) {
        if (dansFosse(q[0], q[1]) && !couvert(q[0], q[1])) run.push(q);
        else vider();
      }
      vider();
    }
    if (combles) console.log('fossé : %d tronçon(s) à sec comblés depuis l\u2019hydrographie IGN', combles);
  }

  // NIVELLEMENT DES NAPPES QUI SE TOUCHENT. Chaque nappe tire son niveau de ses propres
  // berges, ce qui est juste isolément — mais deux nappes voisines, relevées séparément,
  // se retrouvent à dix centimètres l'une de l'autre et leur recouvrement dessine une
  // marche pâle sur l'eau. Des eaux qui communiquent sont à la même hauteur : on les
  // regroupe (union-find sur la proximité des contours) et on donne à chaque groupe la
  // médiane de ses membres.
  {
    const n = LILLE.eau.length, par = LILLE.eau.map((_, i) => i);
    const trouve = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const proche = (a, b) => {
      for (const q of a.poly) if (sdPoly(q[0], q[1], b.poly) < 9) return true;
      for (const q of b.poly) if (sdPoly(q[0], q[1], a.poly) < 9) return true;
      return false;
    };
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = LILLE.eau[i], b = LILLE.eau[j];
      if (Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) > a.rr + b.rr + 12) continue;
      if (proche(a, b)) par[trouve(i)] = trouve(j);
    }
    const grp = new Map();
    for (let i = 0; i < n; i++) { const r = trouve(i); if (!grp.has(r)) grp.set(r, []); grp.get(r).push(i); }
    for (const membres of grp.values()) {
      if (membres.length < 2) continue;
      const ys = membres.map((i) => LILLE.eau[i].y).sort((p, q) => p - q);
      const med = ys[ys.length >> 1];
      for (const i of membres) LILLE.eau[i].y = med;
    }
    const groupes = [...grp.values()].filter((m) => m.length > 1).length;
    if (groupes) console.log('nappes nivelées : %d groupes d\'eaux communicantes', groupes);
  }

  const vert = (TRACE.data.verdure || {});
  for (const [cle, lst] of [['bois', vert.bois], ['parcs', vert.parcs], ['herbe', vert.herbe], ['jardins', vert.jardins]])
    for (const o of lst || []) {
      const e = prepare(o); if (!e) continue;
      if (!e.poly.some((q) => dansEnceinte(q[0], q[1]))) continue;
      LILLE[cle].push(e);
    }
  // ---- voirie, sentiers, ponts et emprises bâties ----
  // Une polyligne est retenue dès qu'un de ses points touche le monde jouable ; le
  // ruban de terrain, lui, s'arrête de lui-même au bord.
  const ligne = (o, cle) => {
    const p = (o.pts || []).filter((q) => q && q.length === 2);
    if (p.length < 2) return;
    if (!p.some((q) => sdEnceinte(q[0], q[1]) < 40)) return;
    let L = 0;
    for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    LILLE[cle].push({ pts: p, r: o.r | 0, nom: o.nom || '', L });
  };
  for (const o of TRACE.data.routes || []) ligne(o, 'routes');
  for (const o of TRACE.data.chemins || []) ligne(o, 'chemins');
  for (const o of TRACE.data.ponts || []) ligne(o, 'ponts');
  for (const poly of TRACE.data.batiments || []) {
    const p = (poly || []).slice();
    if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
    if (p.length < 3) continue;
    if (!p.some((q) => dansEnceinte(q[0], q[1]))) continue;
    if (TRACE.sd(p[0][0], p[0][1]) < GLACIS) continue;          // rien de bâti sur le glacis
    LILLE.bati.push(p);
  }
  cuireAmenage();
  console.log('voirie relevée : %d routes, %d chemins, %d ponts, %d emprises bâties (%.1f km de voies)',
    LILLE.routes.length, LILLE.chemins.length, LILLE.ponts.length, LILLE.bati.length,
    (LILLE.routes.reduce((t, o) => t + o.L, 0) + LILLE.chemins.reduce((t, o) => t + o.L, 0)) / 1000);
  console.log('carte élargie : %d nappes d\'eau, %d bois, %d parcs, %d pelouses, %d jardins (écartés : %d eau, %d bois)',
    LILLE.eau.length, LILLE.bois.length, LILLE.parcs.length, LILLE.herbe.length, LILLE.jardins.length, ecarte.eau, ecarte.bois);
  if (LILLE.conflits.length) console.warn('relevés effacés par un lieu inventé du jeu : %s', LILLE.conflits.join(', '));
  return LILLE;
}

// =====================================================================
//  Les terrains aménagés : ville et routes
// =====================================================================
// « Le terrain sur lequel il y aura la ville et les routes » : une grille de 8 m marque
// tout ce qui est bâti ou carrossable au relevé, une transformée de distance en donne
// l'éloignement, et margePlate s'en sert pour y couper le relief. Une ville ne se bâtit
// pas sur des bosses, et une route ne monte pas sur une butte.

export const LARGEUR_ROUTE = [3.6, 3.6, 5.4, 8.2];   // par classe r : desserte, voie, artère

export const LARGEUR_CHEMIN = 2.6;

export const AM_PAS = 8;

export const AM_N = Math.ceil(2 * PLAINE_R / AM_PAS) + 1, AM_0 = -PLAINE_R;

export let AMENAGE = null;      // distance en mètres au terrain aménagé le plus proche

// Grille séparée : tout ce qui est foulé ou pavé, chemins de forêt compris. AMENAGE sert à
// APLANIR (bâti + chaussées) ; VOIES sert à INTERDIRE LA PLANTATION. Les deux ne peuvent
// pas être la même grille : on ne terrasse pas un sentier de sous-bois, mais on n'y plante
// pas un chêne au milieu non plus.
export let VOIES = null;

export function surVoie(x, z) {
  if (!VOIES) return false;
  const i = Math.round((x - AM_0) / AM_PAS), j = Math.round((z - AM_0) / AM_PAS);
  if (i < 0 || j < 0 || i >= AM_N || j >= AM_N) return false;
  return VOIES[j * AM_N + i] === 1;
}

// ---------------------------------------------------------------------
//  La voie des combattants
// ---------------------------------------------------------------------
// Le chemin qui fait le tour de la citadelle, entre la contrescarpe et le bois : la
// boucle que tout Lille court le dimanche. Le relevé en a des morceaux (34 secteurs sur
// 36), mais en tronçons sans nom, coupés, de 2,60 m — on ne lit pas une promenade.
// On la trace donc en une seule polyligne, calée sur le fossé : pour chaque angle, le
// point à MOAT_OUT + 24 du tracé, repoussé vers l'extérieur tant qu'il tombe dans l'eau,
// sur un ouvrage avancé ou dans l'axe du pont.
export let VOIE_C = null;

export function voieCombattants() {
  if (VOIE_C) return VOIE_C;
  const N = 288, P = [];
  const bon = (x, z) => sdEau(x, z) > 7 && !surDehors(x, z, 3) && !(Math.abs(x) < 13 && z > APO);
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU, cs = Math.cos(a), sn = Math.sin(a);
    // rayon pour lequel sdPent vaut la cible : on balaie, le tracé n'est pas un cercle
    let r0 = 60;
    for (let r = 60; r < 900; r += 2) { if (sdPent(cs * r, sn * r) >= MOAT_OUT + 24) { r0 = r; break; } }
    let r = r0;
    for (let d = 0; d <= 200; d += 3) { const rr = r0 + d; if (bon(cs * rr, sn * rr)) { r = rr; break; } }
    P.push([cs * r, sn * r]);
  }
  // deux passes de lissage : sans elles le tracé fait des créneaux à chaque saut de rayon
  for (let p = 0; p < 3; p++) {
    const c = P.map((q) => q.slice());
    for (let i = 0; i < N; i++) {
      const a = c[(i - 1 + N) % N], b = c[i], d = c[(i + 1) % N];
      const m = [(a[0] + b[0] * 2 + d[0]) / 4, (a[1] + b[1] * 2 + d[1]) / 4];
      if (bon(m[0], m[1])) P[i] = m;
    }
  }
  P.push(P[0].slice());
  VOIE_C = P;
  return VOIE_C;
}

export function cuireAmenage() {
  const N = AM_N, INF = 1e6, d = new Float32Array(N * N).fill(INF);
  VOIES = new Uint8Array(N * N);
  const marque = (x, z) => {
    const i = Math.round((x - AM_0) / AM_PAS), j = Math.round((z - AM_0) / AM_PAS);
    if (i >= 0 && j >= 0 && i < N && j < N) d[j * N + i] = 0;
  };
  const marqueVoie = (x, z) => {
    const i = Math.round((x - AM_0) / AM_PAS), j = Math.round((z - AM_0) / AM_PAS);
    if (i >= 0 && j >= 0 && i < N && j < N) VOIES[j * N + i] = 1;
  };
  // chemins : jamais aplanis (un sentier suit le sol), mais toujours dégagés
  for (const o of LILLE.chemins) for (let i = 0; i < o.pts.length - 1; i++) {
    const a = o.pts[i], b = o.pts[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L, pas = Math.ceil(L / (AM_PAS * 0.5));
    for (let k = 0; k <= pas; k++) {
      const t = k / pas, cx = a[0] + dx * t, cz = a[1] + dz * t;
      for (let w = -AM_PAS; w <= AM_PAS; w += AM_PAS * 0.5) marqueVoie(cx + nx * w, cz + nz * w);
    }
  }
  // emprises bâties : on marque la boîte englobante testée au centre de chaque case.
  // Les deux relevés, et non plus le seul OSM : quartier.js élève le bâti IGN, et le sol
  // doit être terrassé sous les volumes qu'on élève, pas sous d'autres.
  for (const p of LILLE.bati.concat(IGN.bati.map((b) => b.p))) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
    for (let z = Math.floor(z0 / AM_PAS) * AM_PAS; z <= z1 + AM_PAS; z += AM_PAS)
      for (let x = Math.floor(x0 / AM_PAS) * AM_PAS; x <= x1 + AM_PAS; x += AM_PAS)
        if (pointInPoly(x, z, p) || sdPoly(x, z, p) < AM_PAS) marque(x, z);
  }
  // la voie des combattants : dégagée sur cinq mètres de part et d'autre
  { const V = voieCombattants();
    for (let i = 0; i < V.length - 1; i++) {
      const a = V[i], b = V[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L, pas = Math.max(1, Math.ceil(L / (AM_PAS * 0.5)));
      for (let k = 0; k <= pas; k++) {
        const t = k / pas, cx = a[0] + dx * t, cz = a[1] + dz * t;
        for (let w = -5; w <= 5; w += 2.5) marqueVoie(cx + nx * w, cz + nz * w);
      }
    } }
  // chaussées : on marche le long de chaque segment et on tamponne la largeur
  for (const o of LILLE.routes) {
    const demi = LARGEUR_ROUTE[Math.min(3, o.r)] / 2 + 3;
    for (let i = 0; i < o.pts.length - 1; i++) {
      const a = o.pts[i], b = o.pts[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L, pas = Math.ceil(L / (AM_PAS * 0.6));
      for (let k = 0; k <= pas; k++) {
        const t = k / pas, cx = a[0] + dx * t, cz = a[1] + dz * t;
        for (let w = -demi; w <= demi; w += AM_PAS * 0.6) { marque(cx + nx * w, cz + nz * w); marqueVoie(cx + nx * w, cz + nz * w); }
      }
    }
  }
  // transformée de distance en deux balayages (chanfrein 3-4, converti en mètres)
  const D1 = AM_PAS, D2 = AM_PAS * Math.SQRT2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + D1);
    if (j > 0) v = Math.min(v, d[k - N] + D1);
    if (i > 0 && j > 0) v = Math.min(v, d[k - N - 1] + D2);
    if (i < N - 1 && j > 0) v = Math.min(v, d[k - N + 1] + D2);
    d[k] = v;
  }
  for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
    const k = j * N + i; let v = d[k];
    if (i < N - 1) v = Math.min(v, d[k + 1] + D1);
    if (j < N - 1) v = Math.min(v, d[k + N] + D1);
    if (i < N - 1 && j < N - 1) v = Math.min(v, d[k + N + 1] + D2);
    if (i > 0 && j < N - 1) v = Math.min(v, d[k + N - 1] + D2);
    d[k] = v;
  }
  AMENAGE = d;
  cuireBati();
  cuireNomsVoies();
}

// Distance au BÂTI seul, en mètres. AMENAGE mêle chaussées et emprises : s'en servir pour
// poser le sol du quartier étalait une nappe minérale de dix-sept mètres de part et
// d'autre des 63 km de routes relevées, c'est-à-dire un désert autour de la citadelle.
// Le tissu urbain, c'est là où il y a des maisons ; les routes ont déjà leur ruban.
export let BATI_D = null;

// ---------------------------------------------------------------------
//  Le nom des rues
// ---------------------------------------------------------------------
// Le relevé nomme ses voies — boulevard de la Liberté, rue de la Barre, avenue Mathias
// Delobel. Entrer dans une artère sans savoir laquelle, c'est traverser une ville sans
// carte. On tamponne donc les noms dans une grille : une case dit quelle rue on foule,
// et zoneName() la lit en O(1) — impensable de balayer 404 polylignes à chaque image.
export let NOMS_VOIES = [];
export let GRILLE_NOM = null;

export function cuireNomsVoies() {
  const N = AM_N;
  GRILLE_NOM = new Int16Array(N * N).fill(-1);
  NOMS_VOIES = [];
  // les artères d'abord : en cas de recouvrement, c'est le nom de la plus large qui reste
  // ...et la case retient la rue dont l'AXE est le plus proche, pas la dernière
  // tamponnée : sinon, à chaque carrefour, on lit le nom de la rue d'à côté.
  const meilleur = new Float32Array(N * N).fill(1e9);
  const voies = LILLE.routes.filter((o) => o.nom).sort((a, b) => a.r - b.r);
  for (const o of voies) {
    const k = NOMS_VOIES.length;
    NOMS_VOIES.push(o.nom);
    // Marge serrée : à cinq mètres de débord, deux rues voisines se recouvrent et on lit
    // « rue Royale » en marchant rue Voltaire. Deux mètres cinquante couvrent la chaussée
    // et son accotement, pas la maison d'en face.
    const demi = LARGEUR_ROUTE[Math.min(3, o.r)] / 2 + 2.5;
    for (let i = 0; i < o.pts.length - 1; i++) {
      const a = o.pts[i], b = o.pts[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L, pas = Math.ceil(L / (AM_PAS * 0.5));
      for (let m = 0; m <= pas; m++) {
        const t = m / pas, cx = a[0] + dx * t, cz = a[1] + dz * t;
        for (let w = -demi; w <= demi; w += AM_PAS * 0.5) {
          const x = cx + nx * w, z = cz + nz * w;
          const i2 = Math.round((x - AM_0) / AM_PAS), j2 = Math.round((z - AM_0) / AM_PAS);
          if (i2 < 0 || j2 < 0 || i2 >= N || j2 >= N) continue;
          // distance de la case à l'axe, pondérée : une artère porte plus loin qu'une venelle
          const gx = AM_0 + i2 * AM_PAS, gz = AM_0 + j2 * AM_PAS;
          const d = distSeg(gx, gz, a[0], a[1], b[0], b[1]) - o.r * 1.2;
          const c0 = j2 * N + i2;
          if (d < meilleur[c0]) { meilleur[c0] = d; GRILLE_NOM[c0] = k; }
        }
      }
    }
  }
  console.log('voirie nommée : %d rues tamponnées', NOMS_VOIES.length);
}

export function nomDeVoie(x, z) {
  if (!GRILLE_NOM) return null;
  const i = Math.round((x - AM_0) / AM_PAS), j = Math.round((z - AM_0) / AM_PAS);
  if (i < 0 || j < 0 || i >= AM_N || j >= AM_N) return null;
  const k = GRILLE_NOM[j * AM_N + i];
  return k >= 0 ? NOMS_VOIES[k] : null;
}

export function cuireBati() {
  const N = AM_N, INF = 1e6, d = new Float32Array(N * N).fill(INF);
  for (const p of LILLE.bati.concat(IGN.bati.map((b) => b.p))) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
    for (let z = Math.floor(z0 / AM_PAS) * AM_PAS; z <= z1 + AM_PAS; z += AM_PAS)
      for (let x = Math.floor(x0 / AM_PAS) * AM_PAS; x <= x1 + AM_PAS; x += AM_PAS) {
        if (!pointInPoly(x, z, p) && sdPoly(x, z, p) >= AM_PAS) continue;
        const i = Math.round((x - AM_0) / AM_PAS), j = Math.round((z - AM_0) / AM_PAS);
        if (i >= 0 && j >= 0 && i < N && j < N) d[j * N + i] = 0;
      }
  }
  const D1 = AM_PAS, D2 = AM_PAS * Math.SQRT2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + D1);
    if (j > 0) v = Math.min(v, d[k - N] + D1);
    if (i > 0 && j > 0) v = Math.min(v, d[k - N - 1] + D2);
    if (i < N - 1 && j > 0) v = Math.min(v, d[k - N + 1] + D2);
    d[k] = v;
  }
  for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
    const k = j * N + i; let v = d[k];
    if (i < N - 1) v = Math.min(v, d[k + 1] + D1);
    if (j < N - 1) v = Math.min(v, d[k + N] + D1);
    if (i < N - 1 && j < N - 1) v = Math.min(v, d[k + N + 1] + D2);
    if (i > 0 && j < N - 1) v = Math.min(v, d[k + N - 1] + D2);
    d[k] = v;
  }
  BATI_D = d;
}

export function distBati(x, z) {
  if (!BATI_D) return Infinity;
  const fx = (x - AM_0) / AM_PAS, fz = (z - AM_0) / AM_PAS;
  if (fx < 0 || fz < 0 || fx >= AM_N - 1 || fz >= AM_N - 1) return Infinity;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, b = j * AM_N + i, c = b + AM_N;
  const p = BATI_D[b] + (BATI_D[b + 1] - BATI_D[b]) * u, q = BATI_D[c] + (BATI_D[c + 1] - BATI_D[c]) * u;
  return p + (q - p) * v;
}

// distance au terrain aménagé, moins la marge d'assise : négative = terrain de ville
export function margeVille(x, z) {
  if (!AMENAGE) return Infinity;
  const fx = (x - AM_0) / AM_PAS, fz = (z - AM_0) / AM_PAS;
  if (fx < 0 || fz < 0 || fx >= AM_N - 1 || fz >= AM_N - 1) return Infinity;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, b = j * AM_N + i, c = b + AM_N;
  const p = AMENAGE[b] + (AMENAGE[b + 1] - AMENAGE[b]) * u, q = AMENAGE[c] + (AMENAGE[c + 1] - AMENAGE[c]) * u;
  return (p + (q - p) * v) - 9;
}

export function enVille(x, z) { return margeVille(x, z) < 0; }

// Ruban de terrain le long d'une polyligne : une bande de largeur constante posée sur le
// relief, pas un plan horizontal — un chemin de forêt suit le sol, il ne le corrige pas.
// Les stations hors du monde sont sautées, ce qui coupe le ruban au bord de la carte.
export function rubanGeo(lignes, largeur, y, pasMax = 5) {
  const pos = [], uv = [], idx = [];
  for (const o of lignes) {
    const demi = (typeof largeur === 'function' ? largeur(o) : largeur) / 2;
    let s = 0, base = -1, precValide = false;
    for (let i = 0; i < o.pts.length - 1; i++) {
      const a = o.pts[i], b = o.pts[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 0.01) continue;
      const nx = -dz / L, nz = dx / L, pas = Math.max(1, Math.ceil(L / pasMax));
      for (let k = (i === 0 ? 0 : 1); k <= pas; k++) {
        const t = k / pas, cx = a[0] + dx * t, cz = a[1] + dz * t, ds = L / pas * (k === 0 ? 0 : 1);
        s += ds;
        if (sdEnceinte(cx, cz) > 6) { base = -1; precValide = false; continue; }
        // ...et on coupe aussi le ruban là où il passerait SUR l'eau sans tablier : une
        // chaussée s'arrête à la berge, le pont prend le relais.
        // Le tablier se prend DANS L'AXE : le chemin de halage qui passe sous le Pont du
        // Ramponneau montait sur la chaussée du pont, et y dessinait une bande de terre
        // battue entre deux rampes raides.
        const ux = dx / L, uz = dz / L;
        if (sdEau(cx, cz) < -2.5 && surPont(cx, cz, ux, uz) === null && !onBridge(cx, cz)) {
          base = -1; precValide = false; continue;
        }
        // une chaussée qui franchit un pont se pose sur le TABLIER, pas sur le fond
        const hp = surPont(cx, cz, ux, uz);
        // chaque BORD prend le sol sous lui : une section plate, à la cote de l'axe, flottait
        // d'un côté dès que la voie longeait une pente (berges des fossés, clairière du mage)
        // — jusqu'à 0,9 m au-dessus de l'herbe (banc arpenteur). Sur un pont, le tablier est
        // plat : les deux bords restent à sa cote.
        const hA = hp !== null ? hp + 0.03 + y : solPlaine(cx + nx * demi, cz + nz * demi) + y;
        const hB = hp !== null ? hp + 0.03 + y : solPlaine(cx - nx * demi, cz - nz * demi) + y;
        const n0 = pos.length / 3;
        pos.push(cx + nx * demi, hA, cz + nz * demi, cx - nx * demi, hB, cz - nz * demi);
        uv.push(demi, s, -demi, s);
        // ORDRE DE PARCOURS. Les deux triangles étaient enroulés à l'envers : la normale
        // calculée par computeVertexNormals() pointait vers le BAS, si bien que toutes les
        // chaussées, tous les chemins et tous les tabliers de pont relevés étaient en
        // face arrière — donc éliminés par le culling, donc invisibles depuis le ciel
        // comme depuis la rue. On marchait sur des routes qu'on ne voyait pas.
        if (precValide && base >= 0) idx.push(base, n0, base + 1, base + 1, n0, n0 + 1);
        base = n0; precValide = true;
      }
    }
  }
  if (!pos.length) return null;
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ge.setIndex(idx); ge.computeVertexNormals();
  return ge;
}

// =====================================================================
//  Les ponts relevés
// =====================================================================
// 33 ouvrages : Pont de la Citadelle, Passerelle Vauban, Pont Napoléon, Pont du
// Ramponneau… Sans eux la Deûle coupe la carte en deux et rien de ce qui est au-delà
// n'est atteignable. Le tablier va de berge à berge, avec une légère cambrure ; sa
// hauteur est prise sur le sol NATUREL des deux culées, pas sur le fond du lit.

export const PONTS = [];

export const PONT_CAMBRE = 1.0;      // bombement de secours si le calcul n'a rien donné

// Le tablier est bombé — c'est un pont de maçonnerie, pas une planche. Le bombement
// n'est plus une constante : il est calculé pont par pont pour dégager la hauteur libre
// sous l'ouvrage (cf. preparerPonts), dans la limite d'une pente d'accès praticable.
// Profil en TRAPÈZE et non en sinusoïde : la rampe d'accès monte sur les premiers mètres,
// puis le tablier reste haut sur toute la portée mouillée. Avec une sinusoïde, un pont
// dont l'eau commence au ras de la culée exigeait un bombement de seize mètres pour
// dégager trois mètres de jour à cet endroit-là — c'est cette division par un sinus
// presque nul qui donnait des dos d'âne de montagne russe.
export function hauteurPont(P, t) {
  // Un ponton ne s'arque pas : il descend la berge avec elle, puis court à plat un
  // demi-mètre au-dessus de l'eau.
  if (P.ponton) { const [x, z] = pointPont(P, t); return Math.max(P.eau + 0.5, solPlaine(x, z) + 0.12); }
  const r = P.rise !== undefined ? P.rise : PONT_CAMBRE;
  const a = P.rampe !== undefined ? P.rampe : 0.25;
  const f = Math.max(0, Math.min(1, t / a, (1 - t) / a));
  return P.yA + (P.yB - P.yA) * t + r * f + 0.38;
}

// Hauteur libre visée sous un pont : de quoi passer dessous à pied sur la berge. Un
// ponceau de sept mètres n'a pas à porter trois mètres de jour, et une rampe d'accès à
// 25 % ne se gravit pas — la pente au départ vaut π·rise/L, on la plafonne à 17 %.
// Camille mesure 1,79 m depuis le passage à l'échelle : 2,80 m de jour suffisent
// largement à passer dessous. Et la pente : le moteur autorise une marche de 50 cm par
// pas, or à onze mètres par seconde un pas fait dix-neuf centimètres — une rampe à 32 %
// se gravit donc sans accroc, et c'est exactement le dos d'âne d'un pont de pierre.
export const PONT_JOUR = 2.8;
export const PONT_PENTE_MAX = 0.32;

// hauteur de la berge à une culée : on s'éloigne du pont jusqu'à retrouver la terre ferme
function solCulee(bout, voisin) {
  const dx = bout[0] - voisin[0], dz = bout[1] - voisin[1], L = Math.hypot(dx, dz) || 1;
  let h = solPlaine(bout[0], bout[1]);
  // Une culée déjà au sec (prolongerSurBerge l'a posée sur la berge) se cale sur SON sol.
  // Prendre le plus haut des vingt-deux mètres qui suivent laissait, dès que la rue monte
  // derrière le pont, le tablier démarrer sur une marche de près d'un mètre.
  if (sdEau(bout[0], bout[1]) > 1.2) return h;
  for (const d of [4, 9, 15, 22]) {
    const x = bout[0] + dx / L * d, z = bout[1] + dz / L * d;
    if (sdEau(x, z) > 2) { h = Math.max(h, solPlaine(x, z)); break; }
    h = Math.max(h, solPlaine(x, z));
  }
  // Plancher : un demi-mètre au-dessus de la nappe VOISINE, pas de l'ancien niveau global
  // EAU_Y. Avec lui, sur une berge de la Deûle qui descend à −1,5 m vers une eau à −2,24,
  // la culée restait à −0,05 et le tablier démarrait sur une marche de 1,85 m.
  const e = nappeProche(bout[0], bout[1]);
  return Math.max(h, (e ? e.o.y : EAU_Y) + 0.5);
}

// Largeur du tablier. Le relevé ne classe aucun de ces ouvrages : tous sortaient à
// 3,40 m, c'est-à-dire un ponton. Le nom dit l'usage mieux que la classe.
export function largeurPont(o) {
  if (/passerelle/i.test(o.nom || '')) return 3.6;
  if (o.r >= 2) return 9;
  if (o.r === 1) return 7;
  return /^pont/i.test(o.nom || '') ? 7 : 4.6;
}

// Un pont, c'est droit. Le relevé range sous « pont » des tracés qui n'en sont pas :
// des BOUCLES FERMÉES (le contour d'un ouvrage, un giratoire de bretelle), des retours
// sur eux-mêmes, des enchevêtrements de bretelles. Le « Pont Napoléon » ainsi relevé est
// un polygone de 52 m qui revient à son point de départ avec quatre virages à 70° : on
// lui construisait un tablier bombé en rond, d'où ces tas de brique en travers de l'eau.
function pontDroit(p) {
  if (p.length < 2) return false;
  const a = p[0], b = p[p.length - 1];
  const corde = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (corde < 6) return false;                          // fermé ou presque
  let L = 0;
  for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
  if (corde / L < 0.62) return false;                   // il revient sur lui-même
  for (let i = 1; i < p.length - 1; i++) {
    const u = p[i - 1], v = p[i], w = p[i + 1];
    let d = Math.atan2(w[1] - v[1], w[0] - v[0]) - Math.atan2(v[1] - u[1], v[0] - u[0]);
    while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    if (Math.abs(d) > 0.96) return false;               // un virage à 55° : ce n'est pas un tablier
  }
  return true;
}

// Prolonge une polyligne de pont de huit mètres à chaque bout, tant que le sol reste sec.
// PASSAGES SOUS LES CULÉES. Une voie relevée qui croise l'axe sur la berge — le chemin de
// halage, le quai — doit passer SOUS le tablier, et la berge n'est qu'à 0,8 m au-dessus
// de l'eau : il faut au-dessus d'elle un tablier déjà monté, donc une rampe finie AVANT
// elle. Au Pont du Ramponneau, le chemin de la rive croisait l'axe à 4,7 m de la culée,
// en pleine rampe : 1,73 m de jour. Arrêter le tablier devant la voie ne marche pas non
// plus — la rampe n'a alors plus la place de monter avant l'eau (0,59 m de jour mesuré
// sous le Pont Napoléon). On recule donc la culée de RAMPE_PASSAGE derrière la voie,
// tant qu'on reste au sec.
// Ne comptent pas : la rue qui prolonge le pont dans son axe (moins de 25°), ni ce qui
// touche le bout relevé lui-même.
const RAMPE_PASSAGE = 11;          // 3,1 m de montée à 32 %, plus la demi-largeur du chemin
// Distances (triées) auxquelles des voies relevées croisent l'axe, de a vers a + u·portée.
function croisementsSurAxe(a, ux, uz, portee) {
  const bx = a[0] + ux * portee, bz = a[1] + uz * portee;
  const out = [];
  for (const o of LILLE.routes.concat(LILLE.chemins)) {
    const q = o.pts;
    for (let k = 0; k < q.length - 1; k++) {
      const c = q[k], d = q[k + 1];
      const ex = d[0] - c[0], ez = d[1] - c[1], le = Math.hypot(ex, ez);
      if (le < 0.01) continue;
      if (Math.abs(ex * ux + ez * uz) / le > Math.cos(25 * Math.PI / 180)) continue;   // dans l'axe
      const den = (bx - a[0]) * ez - (bz - a[1]) * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((c[0] - a[0]) * ez - (c[1] - a[1]) * ex) / den;
      const v = ((c[0] - a[0]) * (bz - a[1]) - (c[1] - a[1]) * (bx - a[0])) / den;
      if (t < 0 || t > 1 || v < 0 || v > 1) continue;
      const dist = t * portee;
      if (dist > 1) out.push(dist);
    }
  }
  return out.sort((p, q) => p - q);
}

function prolongerSurBerge(p) {
  // Le recul pour passage ne vaut que pour un pont qui franchit l'eau : sur un remblai
  // à sec (Pont de la Citadelle), le tablier reste bas et une voie ne passerait pas dessous.
  let franchit = false;
  for (let i = 0; i < p.length - 1 && !franchit; i++) {
    const L = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    for (let s = 0; s <= L; s += 2) if (sdEau(p[i][0] + (p[i + 1][0] - p[i][0]) * s / (L || 1), p[i][1] + (p[i + 1][1] - p[i][1]) * s / (L || 1)) < 0) { franchit = true; break; }
  }
  const bout = (i, j) => {
    const a = p[i], b = p[j];
    const dx = a[0] - b[0], dz = a[1] - b[1], L = Math.hypot(dx, dz) || 1;
    const ux = dx / L, uz = dz / L;
    // voie qui croise l'axe entre le bout relevé et l'eau, ou dans la zone de prolongement
    let eauDedans = 40;
    for (let k = 0.5; k <= 40; k += 0.5) if (sdEau(a[0] - ux * k, a[1] - uz * k) < 0) { eauDedans = k; break; }
    const dedans = croisementsSurAxe(a, -ux, -uz, eauDedans)[0] ?? Infinity;
    const dehors = croisementsSurAxe(a, ux, uz, 20);
    let portee = 8.5, degage = -Infinity;           // degage : la voie qu'on fait passer dessous
    if (franchit && dedans < eauDedans) portee = Math.max(portee, RAMPE_PASSAGE - dedans);
    if (franchit && dehors.length && dehors[0] < 8.5) { degage = dehors[0]; portee = Math.max(portee, degage + RAMPE_PASSAGE); }
    // ...mais on ne recule jamais par-dessus la voie SUIVANTE : elle rejoint la culée à
    // niveau. Sans cette borne, le recul enjambait une seconde rue, qui se retrouvait sous
    // la rampe avec moins d'un mètre de jour.
    const suivante = dehors.find((c) => c > degage + 0.5);
    if (franchit && suivante !== undefined) portee = Math.min(portee, suivante - 1.5);
    portee = Math.min(portee, 20);
    let d = 0;
    for (let k = 1.5; k <= portee + 1e-6; k += 1.5) {
      const x = a[0] + ux * k, z = a[1] + uz * k;
      if (sdEau(x, z) < 1.2) break;
      d = k;
    }
    return d > 2 ? [a[0] + ux * d, a[1] + uz * d] : null;
  };
  const e0 = bout(0, 1), e1 = bout(p.length - 1, p.length - 2);
  if (e0) p.unshift(e0);
  if (e1) p.push(e1);
}

// Point du tablier à l'abscisse t (0..1)
export function pointPont(P, t) {
  const g = P.seg.find((q) => t >= q.s0 && t <= q.s1) || P.seg[P.seg.length - 1];
  const u = (t - g.s0) / ((g.s1 - g.s0) || 1);
  return [g.a[0] + (g.b[0] - g.a[0]) * u, g.a[1] + (g.b[1] - g.a[1]) * u];
}

// Niveau de l'eau franchie, portée mouillée, et bombement nécessaire pour dégager
// PONT_JOUR sous le tablier sans dépasser la pente d'accès praticable.
// Les voies relevées qui passent sous le tablier, sur la terre ferme : abscisse t et sol.
function passagesSous(P) {
  const out = [];
  for (const o of LILLE.routes.concat(LILLE.chemins)) {
    if (o.nom && o.nom === P.nom) continue;
    for (let k = 0; k < o.pts.length - 1; k++) {
      const c = o.pts[k], d = o.pts[k + 1], ex = d[0] - c[0], ez = d[1] - c[1], le = Math.hypot(ex, ez);
      if (le < 0.01) continue;
      for (const g of P.seg) {
        const rx = g.b[0] - g.a[0], rz = g.b[1] - g.a[1], lr = Math.hypot(rx, rz) || 1;
        if (Math.abs(ex * rx + ez * rz) / (le * lr) > Math.cos(25 * Math.PI / 180)) continue;
        const den = rx * ez - rz * ex;
        if (Math.abs(den) < 1e-9) continue;
        const u = ((c[0] - g.a[0]) * ez - (c[1] - g.a[1]) * ex) / den;
        const v = ((c[0] - g.a[0]) * rz - (c[1] - g.a[1]) * rx) / den;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        const t = g.s0 + (g.s1 - g.s0) * u, x = g.a[0] + rx * u, z = g.a[1] + rz * u;
        if (t < 0.02 || t > 0.98 || sdEau(x, z) < 0.5) continue;
        out.push({ t, sol: solPlaine(x, z) });
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
// Jour visé au-dessus d'un passage, mesuré sur le dessus du tablier : 2,55 m sous la
// dalle, 2,25 m sous la clé de l'arche — Camille mesure 1,80 m.
const PASSAGE_JOUR = 3.1;

function calerPont(P) {
  P.passages = passagesSous(P);
  let eau = null, t0 = null, t1 = null;
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const [x, z] = pointPont(P, t);
    const o = eauAt(x, z);
    if (!o) continue;
    if (eau === null || o.y < eau) eau = o.y;
    if (t0 === null) t0 = t;
    t1 = t;
  }
  P.eau = eau; P.t0 = t0; P.t1 = t1;
  if (eau === null) { P.ponton = false; P.rise = PONT_CAMBRE; P.rampe = 0.3; return; }
  if (P.ponton) { P.rise = 0; return; }
  // Ce qui manque, en mètres, pour dégager le jour sur toute la portée mouillée.
  let besoin = 0;
  for (let t = t0; t <= t1 + 1e-9; t += 0.02) {
    const plat = P.yA + (P.yB - P.yA) * t + 0.38;
    besoin = Math.max(besoin, (eau + PONT_JOUR) - plat);
  }
  P.rampe = 0.25;                                     // valeur de départ pour hauteurPont
  // Le profil en trapèze ne se résout pas en une formule : le point le plus bas dépend de
  // la longueur de rampe, qui dépend du bombement. On itère — six tours suffisent.
  // On mesure le jour AU LARGE, pas contre les culées : à la culée le tablier rejoint la
  // berge par construction, le jour y est nul, et vouloir l'y dégager faisait diverger le
  // bombement (huit mètres de dos d'âne pour un gain nul).
  // ...et on mesure le jour au-dessus de ce qui est SOUS le tablier — l'eau au milieu, la
  // berge sur les bords. C'est là, au ras de l'eau, que court le chemin de halage : viser
  // seulement le plan d'eau laissait un mètre soixante au-dessus de la rive, et on se
  // cognait la tête à l'endroit précis où l'on veut passer.
  const tA = Math.max(0.08, t0 - 0.08), tB = Math.min(0.92, t1 + 0.08);
  const sousPont = (t) => { const [x, z] = pointPont(P, t); return Math.max(eau, solPlaine(x, z)); };
  const jourEau = () => {
    if (tA > tB) return PONT_JOUR;
    let m = Infinity;
    for (let t = tA; t <= tB + 1e-9; t += 0.02) m = Math.min(m, hauteurPont(P, t) - sousPont(t));
    return m;
  };
  // ce qui manque au pire endroit, eau ou passage : négatif tant que le jour n'y est pas
  const mesure = () => {
    let m = jourEau() - PONT_JOUR;
    for (const q of P.passages) m = Math.min(m, hauteurPont(P, q.t) - q.sol - PASSAGE_JOUR);
    return m;
  };
  const caler = () => {
    // Longueur de rampe : la plus douce possible, mais assez courte pour que le tablier
    // soit à sa hauteur AVANT que l'eau commence — et jamais plus raide que 60 %.
    const ideal = P.rise / (PONT_PENTE_MAX * P.L);
    const dur = P.rise / (0.40 * P.L);   // jamais plus raide que 40 %
    let bord = Math.max(t0, 1 - t1, 0.04);
    // et à sa hauteur AVANT chaque passage, chemin compris (1,5 m de demi-largeur)
    for (const q of P.passages) bord = Math.min(bord, (q.t < 0.5 ? q.t : 1 - q.t) - 1.5 / P.L);
    P.rampe = Math.min(0.45, Math.max(dur, 0.03, Math.min(ideal, bord)));
  };
  P.rise = Math.max(0.35, besoin); caler();
  for (let k = 0; k < 6; k++) {
    const j = mesure();
    if (j >= -0.02) break;
    P.rise = Math.min(3.2, P.rise - j * 1.05); caler();
  }
  P.jour = jourEau();
}

// LE RELEVÉ D'ABORD, LE CALAGE ENSUITE. roadPts() a besoin de l'emplacement des ponts et
// il est appelé par margeLieux(), donc PENDANT cuireRelief() : les ponts étaient alors
// calés sur un solPlaine() qui rendait 0 partout, faute de relief. Les dix tabliers
// avaient leurs deux culées à la cote 0 alors que le sol y va de −3,6 à +6,4 m — les
// deux ponts de l'avenue Léon Jouhaux passaient six mètres SOUS la chaussée, et le jour
// des autres était compté au-dessus d'une berge qui n'existait pas. La liste des ponts
// peut se faire à tout moment ; leur hauteur, seulement une fois le relief cuit.
let PONTS_LISTES = false, PONTS_CALES = false;
export function preparerPonts() {
  if (!PONTS_LISTES) listerPonts();
  if (RELIEF && !PONTS_CALES) calerPonts();
  return PONTS;
}

function listerPonts() {
  PONTS_LISTES = true;
  let tordus = 0;
  for (const o of LILLE.ponts) {
    const p = o.pts;
    if (!p || p.length < 2) continue;
    if (!p.some((q) => dansEnceinte(q[0], q[1]))) continue;
    // Le relevé contient AUSSI les ponts de la place — celui de la Porte Royale, celui
    // de la poterne — que citadelle.js construit à sa façon. Les rebâtir par-dessus
    // donnait cet enchevêtrement de parapets crème en travers du tablier de planches.
    // Tout ce qui tombe dans l'emprise des ouvrages appartient à la citadelle.
    if (p.every((q) => sdPent(q[0], q[1]) < GLACIS)) continue;
    if (!pontDroit(p)) { tordus++; continue; }
    const demi = largeurPont(o) / 2;
    // PROLONGEMENT SUR LES BERGES. Le relevé arrête le pont au trait de rive : le tablier
    // ne débordait donc pas d'un centimètre sur la terre ferme, et il n'y avait
    // littéralement pas de « dessous » où passer. On le prolonge de huit mètres de chaque
    // côté, tant qu'on reste au sec — c'est la culée, et c'est sous elle que passe le
    // chemin de halage.
    prolongerSurBerge(p);
    const seg = [];
    let L = 0;
    for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    if (L < 6) continue;
    let s = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      seg.push({ a, b, s0: s / L, s1: (s + d) / L });
      s += d;
    }
    let cx = 0, cz = 0;
    for (const q of p) { cx += q[0]; cz += q[1]; }
    cx /= p.length; cz /= p.length;
    const rr = Math.max(...p.map((q) => Math.hypot(q[0] - cx, q[1] - cz))) + demi + 2;
    // yA / yB provisoires : calerPonts() les remplace par le sol réel des culées
    PONTS.push({ pts: p, nom: o.nom || 'un pont', demi, L, seg, c: [cx, cz], rr, yA: 0, yB: 0 });
  }
  // Le relevé ne marque pas toutes les traversées comme ouvrages d'art : une bonne part
  // des franchissements est une simple voie NOMMÉE « Pont … » ou « Passerelle … ». Sans
  // elles, surPont() ne les connaît pas, et depuis que les rubans de voirie sont
  // visibles on voyait des chaussées flotter sur la Deûle.
  const deja = new Set(PONTS.map((p) => p.nom));
  for (const o of LILLE.routes.concat(LILLE.chemins)) {
    if (!/^(pont|passerelle)\b/i.test(o.nom || '')) continue;
    if (deja.has(o.nom)) continue;
    const p = o.pts;
    if (!p || p.length < 2) continue;
    if (!p.some((q) => sdEau(q[0], q[1]) < 0)) continue;       // ne franchit rien
    if (p.every((q) => sdPent(q[0], q[1]) < GLACIS)) continue;
    if (!pontDroit(p)) { tordus++; continue; }
    const demi = largeurPont(o) / 2;
    prolongerSurBerge(p);
    const seg = [];
    let L = 0;
    for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    if (L < 6) continue;
    let s2 = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      seg.push({ a, b, s0: s2 / L, s1: (s2 + d) / L });
      s2 += d;
    }
    let cx = 0, cz = 0;
    for (const q of p) { cx += q[0]; cz += q[1]; }
    cx /= p.length; cz /= p.length;
    const rr = Math.max(...p.map((q) => Math.hypot(q[0] - cx, q[1] - cz))) + demi + 2;
    PONTS.push({ pts: p, nom: o.nom, demi, L, seg, c: [cx, cz], rr, yA: 0, yB: 0 });
    deja.add(o.nom);
  }
  PONTS.tordus = tordus;
}

function calerPonts() {
  PONTS_CALES = true;
  // ---- calage en hauteur et PLATEFORMES ----
  // Le tablier n'est plus le SOL : c'était la raison pour laquelle on ne pouvait pas
  // passer dessous — levelH() rendait la hauteur du pont partout sous son emprise, donc
  // en marchant sur la berge on était téléporté sur le tablier. Il devient une
  // plateforme, que le moteur ne prend en compte que si l'on est déjà à sa hauteur.
  let nPlat = 0;
  for (const P of PONTS) {
    // PONTONS. Deux tracés « pont » relevés sur la rive nord de l'étang de la nappe 5
    // partent de la berge et s'arrêtent trois mètres dans l'eau, sans aucune voie qui les
    // prolonge : ce sont des embarcadères. Traités en ponts, ils devenaient des dos d'âne
    // à 70 % qui retombaient dans l'étang. Un bout au sec, l'autre dans l'eau même après
    // prolongement sur la berge : c'est un ponton, étroit, plat, en planches.
    const mA = sdEau(P.pts[0][0], P.pts[0][1]) < 0, mB = sdEau(P.pts[P.pts.length - 1][0], P.pts[P.pts.length - 1][1]) < 0;
    P.ponton = mA !== mB;
    if (P.ponton) P.demi = Math.min(P.demi, 1.25);
    P.yA = solCulee(P.pts[0], P.pts[1]);
    P.yB = solCulee(P.pts[P.pts.length - 1], P.pts[P.pts.length - 2]);
    calerPont(P);
    // des RAMPES et non des dalles plates : sur un dos d'âne à 30 %, une dalle de trois
    // mètres se trompe de quarante-cinq centimètres en son milieu, et on ne tient plus
    // debout sur son propre pont.
    const pas = Math.max(2, Math.ceil(P.L / 2.5));
    for (let k = 0; k < pas; k++) {
      const ta = k / pas, tb = (k + 1) / pas;
      const A = pointPont(P, ta), B = pointPont(P, tb);
      const dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      world.platforms.push({ ramp: true, x: A[0], z: A[1], dx: dx / len, dz: dz / len,
        len, w: P.demi * 2, h0: hauteurPont(P, ta), h1: hauteurPont(P, tb) });
      nPlat++;
    }
  }
  const jours = PONTS.filter((P) => P.jour !== undefined && !P.ponton).map((P) => P.jour);
  console.log('ponts relevés : %d posés dont %d pontons (%d tracés écartés, pas des tabliers), %d dalles, hauteur libre %s',
    PONTS.length, PONTS.filter((P) => P.ponton).length, PONTS.tordus, nPlat,
    jours.length ? `${Math.min(...jours).toFixed(2)} à ${Math.max(...jours).toFixed(2)} m` : '(aucun sur l\u2019eau)');
}

// hauteur du tablier sous les pieds, ou null — rejet par cercle englobant d'abord
// Est-on SUR le tablier, et non dessous ? L'ancienne exemption d'eau valait dans toute
// l'emprise du pont, à n'importe quelle hauteur : on marchait à sec au ras de l'eau
// sous l'ouvrage. Elle ne vaut plus qu'à hauteur de tablier.
export function surTablier(x, z, y) {
  const h = surPont(x, z);
  return h !== null && y > h - 1.0;
}

// (ux, uz), facultatif : la direction de qui pose le pied. Un chemin qui passe SOUS le pont
// le croise à angle franc ; seul ce qui suit l'axe du pont (moins de 25°) est sur le tablier.
export function surPont(x, z, ux, uz) {
  for (let i = 0; i < PONTS.length; i++) {
    const P = PONTS[i];
    const ex = x - P.c[0], ez = z - P.c[1];
    if (ex * ex + ez * ez > P.rr * P.rr) continue;
    for (const g of P.seg) {
      const dx = g.b[0] - g.a[0], dz = g.b[1] - g.a[1], L2 = dx * dx + dz * dz || 1;
      if (ux !== undefined && Math.abs(dx * ux + dz * uz) / Math.sqrt(L2) < 0.906) continue;
      let t = ((x - g.a[0]) * dx + (z - g.a[1]) * dz) / L2;
      if (t < -0.08 || t > 1.08) continue;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = x - (g.a[0] + dx * t), qz = z - (g.a[1] + dz * t);
      if (qx * qx + qz * qz > P.demi * P.demi) continue;
      return hauteurPont(P, g.s0 + (g.s1 - g.s0) * t);
    }
  }
  return null;
}

export function pontsLille() {
  const g = new THREE.Group(); g.name = 'ponts-de-lille';
  preparerPonts();
  if (!PONTS.length) return g;
  // PONTS DE MAÇONNERIE. C'étaient des planches posées à plat : un tablier de bois de
  // 3,40 m, un bandeau de 55 cm en guise de parapet, et 1,77 m de jour sous l'ouvrage —
  // on ne passait pas dessous, on passait dedans. Ce sont maintenant des ponts en arc :
  // voûtes de brique, piles, bandeau et parapet de pierre, chaussée pavée.
  const brique = patiner(phMat('stacked_brick_wall', 1, 1, { roughness: 0.94 }),
    { echelle: 16, force: 0.30, humide: 3.4, pluie: 0.26 });
  const taille = pbrRepeat(T.stone, 1, 1, { roughness: 0.86, color: 0xcdc4b0 });
  const pave = pbrRepeat(cobbles(), 1 / COBBLE_M, 1 / COBBLE_M, { roughness: 0.9 });
  const EPD = 0.55;                                   // épaisseur du tablier

  // Un tronçon de maçonnerie posé le long d'une corde. Le dessus SUIT le tablier et le
  // dessous SUIT le terrain, échantillonnés tous les trois mètres : avec deux points
  // seulement, un tablier bombé laissait des marches et des trous entre les morceaux.
  const tronçon = (P, ta, tb, arc, murs) => {
    const A = pointPont(P, ta), B = pointPont(P, tb);
    const dx = B[0] - A[0], dz = B[1] - A[1], La = Math.hypot(dx, dz);
    if (La < 0.8) return;
    const ux = dx / La, uz = dz / La, larg = P.demi * 2;
    const N = Math.max(2, Math.ceil(La / 3));
    const haut = [], bas = [];
    for (let k = 0; k <= N; k++) {
      const t = ta + (tb - ta) * k / N;
      const [x, z] = pointPont(P, t);
      const sc = (x - A[0]) * ux + (z - A[1]) * uz;
      haut.push([sc, hauteurPont(P, t) - EPD]);
      const sol = solPlaine(x, z);
      bas.push([sc, arc && !arc.terre ? P.eau - 1.4 : Math.min(sol, P.eau === null ? sol : P.eau) - 1.5]);
    }
    const sh = new THREE.Shape();
    sh.moveTo(bas[0][0], bas[0][1]);
    for (let k = 1; k < bas.length; k++) sh.lineTo(bas[k][0], bas[k][1]);
    for (let k = haut.length - 1; k >= 0; k--) sh.lineTo(haut[k][0], haut[k][1]);
    sh.closePath();
    if (arc) {
      const { s0, s1, ys, rise } = arc;
      const hw = (s1 - s0) / 2, mid = (s0 + s1) / 2;
      const R = (hw * hw + rise * rise) / (2 * rise), cy = ys + rise - R;
      const h = new THREE.Path();
      h.moveTo(s0, ys);
      const NA = 20;
      for (let k = 1; k <= NA; k++) {
        const x = s0 + (s1 - s0) * k / NA;
        const d2 = Math.max(0, R * R - (x - mid) * (x - mid));
        h.lineTo(x, k === NA ? ys : cy + Math.sqrt(d2));
      }
      h.lineTo(s0, ys);
      sh.holes.push(h);
    }
    // Sur la terre ferme, l'ouvrage n'est pas un bloc plein : c'est un remblai tenu par
    // deux MURS D'AILE. Un parallélépipède de brique de sept mètres de large posé sur la
    // berge faisait un bunker, pas une culée.
    // VOÛTE. Sans l'intrados, l'arche est un trou noir : on voit au travers des deux
    // tympans et rien entre les deux. On tend donc une bande de brique sous le tablier,
    // d'une naissance à l'autre.
    if (arc) {
      const { s0, s1, ys, rise } = arc;
      const hw = (s1 - s0) / 2, mid = (s0 + s1) / 2;
      const R = (hw * hw + rise * rise) / (2 * rise), cy = ys + rise - R;
      const N2 = 16, vp = [], vi = [], vu = [];
      for (let k = 0; k <= N2; k++) {
        const sc = s0 + (s1 - s0) * k / N2;
        const d2 = Math.max(0, R * R - (sc - mid) * (sc - mid));
        const y = (k === 0 || k === N2) ? ys : cy + Math.sqrt(d2);
        const X = A[0] + ux * sc, Z = A[1] + uz * sc;
        const nx2 = -uz, nz2 = ux;
        const n0 = vp.length / 3;
        vp.push(X + nx2 * larg / 2, y, Z + nz2 * larg / 2, X - nx2 * larg / 2, y, Z - nz2 * larg / 2);
        vu.push(0, sc, larg, sc);
        if (k) vi.push(n0 - 2, n0, n0 + 1, n0 - 2, n0 + 1, n0 - 1);
      }
      const gv = new THREE.BufferGeometry();
      gv.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
      gv.setAttribute('uv', new THREE.Float32BufferAttribute(vu, 2));
      gv.setIndex(vi); gv.computeVertexNormals();
      const mv = new THREE.Mesh(gv, brique);
      mv.material.side = THREE.DoubleSide;
      mv.castShadow = mv.receiveShadow = true; g.add(mv);
    }
    // Tympans : deux murs minces, jamais un bloc plein — sinon l'arche est un tunnel
    // percé dans une masse de brique de sept mètres d'épaisseur.
    const ep = Math.min(0.9, larg / 3);
    const dec = [0, larg - ep];
    for (const d of dec) {
      const ge = new THREE.ExtrudeGeometry(sh, { depth: ep, bevelEnabled: false, curveSegments: 4 });
      const m = new THREE.Mesh(ge, brique);
      m.rotation.y = Math.atan2(-uz, ux);
      m.position.set(A[0] + uz * (larg / 2 - d), 0, A[1] - ux * (larg / 2 - d));
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
  };

  const pos = [], uv = [], idx = [];
  const PAR = { pos: [], uv: [], idx: [] }, CHA = { pos: [], uv: [], idx: [] };
  const BOIS = { pos: [], uv: [], idx: [] };
  const quadB = (a, b, c, d, u0, u1, v0, v1) => {
    const n0 = BOIS.pos.length / 3;
    BOIS.pos.push(...a, ...b, ...c, ...d);
    BOIS.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    BOIS.idx.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
  };
  // poteau de section carrée, de y0 à y1 : quatre faces, le dessus est caché par la main courante
  const poteau = (x, z, c, y0, y1) => {
    const co = [[-c, -c], [c, -c], [c, c], [-c, c]];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = co[k], [bx, bz] = co[(k + 1) % 4];
      quadB([x + ax, y0, z + az], [x + bx, y0, z + bz], [x + bx, y1, z + bz], [x + ax, y1, z + az], 0, 2 * c, 0, y1 - y0);
    }
  };
  // PONTON : platelage, lisses de rive, pieux dans l'eau, garde-corps. Pas de maçonnerie :
  // une voûte de brique sous un embarcadère de deux mètres cinquante serait un contresens.
  const ponton = (P) => {
    const N = Math.max(2, Math.ceil(P.L / 1.2)), st = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, [x, z] = pointPont(P, t), g0 = P.seg.find((q) => t >= q.s0 && t <= q.s1) || P.seg[P.seg.length - 1];
      const dx = g0.b[0] - g0.a[0], dz = g0.b[1] - g0.a[1], d = Math.hypot(dx, dz) || 1;
      st.push({ x, z, y: hauteurPont(P, t), nx: -dz / d, nz: dx / d, s: t * P.L, mouille: sdEau(x, z) < 0 });
    }
    const w = P.demi, HG = 0.95;
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], b = st[i + 1];
      const A = (sx, dy = 0) => [a.x + a.nx * w * sx, a.y + dy, a.z + a.nz * w * sx];
      const B = (sx, dy = 0) => [b.x + b.nx * w * sx, b.y + dy, b.z + b.nz * w * sx];
      quadB(A(1), B(1), B(-1), A(-1), a.s, b.s, 0, 2 * w);                         // platelage
      for (const sx of [1, -1]) {
        quadB(A(sx, -0.28), B(sx, -0.28), B(sx), A(sx), a.s, b.s, 0, 0.28);         // lisse de rive
        quadB(A(sx, HG - 0.09), B(sx, HG - 0.09), B(sx, HG), A(sx, HG), a.s, b.s, 0, 0.09);   // main courante
        quadB(A(sx, 0.42), B(sx, 0.42), B(sx, 0.5), A(sx, 0.5), a.s, b.s, 0, 0.08);           // lisse basse
      }
    }
    st.forEach((q, k) => {
      if (k % 2) return;
      for (const sx of [1, -1]) {
        const x = q.x + q.nx * (w - 0.05) * sx, z = q.z + q.nz * (w - 0.05) * sx;
        poteau(x, z, 0.06, q.y, q.y + HG);
        // le pieu descend jusqu'au fond : c'est lui qui dit « ponton » depuis la rive
        if (q.mouille) poteau(x, z, 0.11, solPlaine(x, z) - 0.4, q.y - 0.05);
      }
    });
  };
  for (const P of PONTS) {
    if (P.ponton) { ponton(P); continue; }
    // ---------- corps de l'ouvrage ----------
    {
      const eau = P.eau, t0 = P.t0, t1 = P.t1;
      // culées pleines, par morceaux de huit mètres pour suivre la berge — sauf au droit
      // d'une voie relevée qui passe dessous : là, une arche de six mètres sur le chemin.
      // Sans elle, le chemin de halage entrait dans un bloc de brique plein.
      const morceaux = (ta, tb) => {
        const plein = (a, b) => {
          if (b - a < 1e-3) return;
          const n = Math.max(1, Math.ceil((b - a) * P.L / 8));
          for (let k = 0; k < n; k++) tronçon(P, a + (b - a) * k / n, a + (b - a) * (k + 1) / n, null, true);
        };
        const w = 3 / P.L;
        let t = ta;
        for (const q of P.passages || []) {
          if (q.t - w < t || q.t + w > tb) continue;
          plein(t, q.t - w);
          const A = pointPont(P, q.t - w), B = pointPont(P, q.t + w), La = Math.hypot(B[0] - A[0], B[1] - A[1]);
          let ys = Infinity;
          for (let k = 0; k <= 4; k++) { const [x, z] = pointPont(P, q.t - w + 2 * w * k / 4); ys = Math.min(ys, solPlaine(x, z)); }
          ys -= 0.05;
          const rise = Math.min(hauteurPont(P, q.t - w), hauteurPont(P, q.t + w)) - EPD - ys - 0.3;
          tronçon(P, q.t - w, q.t + w, rise > 1.2 ? { s0: 0.35, s1: La - 0.35, ys, rise, terre: true } : null, true);
          t = q.t + w;
        }
        plein(t, tb);
      };
      if (eau === null || t0 === null) {
        morceaux(0, 1);                           // pas d'eau dessous : un remblai maçonné
      } else {
        if (t0 > 0.01) morceaux(0, t0);
        if (t1 < 0.99) morceaux(t1, 1);
        // arches : une tous les quinze mètres environ, piles entre elles
        const portee = (t1 - t0) * P.L;
        const nA = Math.max(1, Math.round(portee / 15));
        for (let k = 0; k < nA; k++) {
          const ta = t0 + (t1 - t0) * k / nA, tb = t0 + (t1 - t0) * (k + 1) / nA;
          const A = pointPont(P, ta), B = pointPont(P, tb);
          const La = Math.hypot(B[0] - A[0], B[1] - A[1]);
          const PILE = Math.min(1.8, La * 0.2);
          const ys = eau + 0.35;
          const sousTab = Math.min(hauteurPont(P, ta), hauteurPont(P, tb)) - EPD;
          const rise = Math.max(0.7, sousTab - ys - 0.3);
          const arc = La - 2 * PILE > 2.5 ? { s0: PILE, s1: La - PILE, ys, rise } : null;
          tronçon(P, ta, tb, arc);
        }
      }
    }
    // ---------- chaussée pavée ----------
    let base = -1;
    const stations = [];
    for (const gseg of P.seg) {
      const dx = gseg.b[0] - gseg.a[0], dz = gseg.b[1] - gseg.a[1], d = Math.hypot(dx, dz) || 1;
      const nx = -dz / d, nz = dx / d, pas = Math.max(1, Math.ceil(d / 4));
      for (let k = (gseg === P.seg[0] ? 0 : 1); k <= pas; k++) {
        const t = k / pas, cx = gseg.a[0] + dx * t, cz = gseg.a[1] + dz * t;
        const y = hauteurPont(P, gseg.s0 + (gseg.s1 - gseg.s0) * t);
        stations.push([cx, cz, y, nx, nz]);
        const n0 = pos.length / 3;
        pos.push(cx + nx * P.demi, y, cz + nz * P.demi, cx - nx * P.demi, y, cz - nz * P.demi);
        const sm = (gseg.s0 + (gseg.s1 - gseg.s0) * t) * P.L;
        uv.push(P.demi, sm, -P.demi, sm);
        // enroulement : les deux triangles étaient à l'envers, comme dans rubanGeo —
        // le tablier était en face arrière, donc éliminé par le culling vu d'en haut
        if (base >= 0) idx.push(base, n0, base + 1, base + 1, n0, n0 + 1);
        base = n0;
      }
    }
    // ---------- bandeau, parapet et chaperon ----------
    // En boîtes horizontales posées station par station, le parapet montait EN ESCALIER
    // sur un dos d'âne à 30 %. C'est un ruban : il suit la pente exactement.
    for (const sx of [1, -1]) for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i], b = stations[i + 1];
      const A = [a[0] + a[3] * sx * P.demi, a[1] + a[4] * sx * P.demi, a[2]];
      const B = [b[0] + b[3] * sx * P.demi, b[1] + b[4] * sx * P.demi, b[2]];
      const nx = a[3] * sx, nz = a[4] * sx;                 // vers l'extérieur du tablier
      const seg = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const s0 = i * 3, s1 = s0 + seg;
      const EPP = 0.34, HP = 0.92, CH = 0.16, SAIL = 0.1;
      const ruban = (T, ax, ay, az2, bx, by, bz, cx2, cy, cz2, dx2, dy, dz2, u0, u1, v0, v1) => {
        const n0 = T.pos.length / 3;
        T.pos.push(ax, ay, az2, bx, by, bz, cx2, cy, cz2, dx2, dy, dz2);
        T.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        T.idx.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
      };
      // face extérieure (avec un léger fruit), face intérieure, et le chaperon
      const ox = nx * SAIL, oz = nz * SAIL;
      ruban(PAR, A[0] + ox, A[2], A[1] + oz, B[0] + ox, B[2], B[1] + oz,
        B[0] + ox, B[2] + HP, B[1] + oz, A[0] + ox, A[2] + HP, A[1] + oz, s0, s1, 0, HP);
      const ix = -nx * EPP, iz = -nz * EPP;
      ruban(PAR, A[0] + ix, A[2] + HP, A[1] + iz, B[0] + ix, B[2] + HP, B[1] + iz,
        B[0] + ix, B[2], B[1] + iz, A[0] + ix, A[2], A[1] + iz, s0, s1, 0, HP);
      const cx3 = nx * (SAIL + 0.07), cz3 = nz * (SAIL + 0.07);
      const dx3 = -nx * (EPP + 0.07), dz3 = -nz * (EPP + 0.07);
      ruban(CHA, A[0] + cx3, A[2] + HP, A[1] + cz3, B[0] + cx3, B[2] + HP, B[1] + cz3,
        B[0] + dx3, B[2] + HP, B[1] + dz3, A[0] + dx3, A[2] + HP, A[1] + dz3, s0, s1, 0, EPP + 0.2);
      ruban(CHA, A[0] + cx3, A[2] + HP + CH, A[1] + cz3, B[0] + cx3, B[2] + HP + CH, B[1] + cz3,
        B[0] + cx3, B[2] + HP, B[1] + cz3, A[0] + cx3, A[2] + HP, A[1] + cz3, s0, s1, 0, CH);
      ruban(CHA, A[0] + cx3, A[2] + HP + CH, A[1] + cz3, A[0] + dx3, A[2] + HP + CH, A[1] + dz3,
        B[0] + dx3, B[2] + HP + CH, B[1] + dz3, B[0] + cx3, B[2] + HP + CH, B[1] + cz3,
        0, EPP + 0.2, s0, s1);
    }
  }
  const cuireRuban = (T, mt, ordre) => {
    if (!T.pos.length) return;
    const ge = new THREE.BufferGeometry();
    ge.setAttribute('position', new THREE.Float32BufferAttribute(T.pos, 3));
    ge.setAttribute('uv', new THREE.Float32BufferAttribute(T.uv, 2));
    ge.setIndex(T.idx); ge.computeVertexNormals();
    const m = new THREE.Mesh(ge, mt);
    m.material.side = THREE.DoubleSide;
    m.receiveShadow = true; m.castShadow = true; if (ordre) m.renderOrder = ordre; g.add(m);
  };
  cuireRuban({ pos, uv, idx }, pave, 2);
  cuireRuban(PAR, brique, 0);
  cuireRuban(CHA, taille, 0);
  cuireRuban(BOIS, pbrRepeat(T.plank, 0.5, 0.5, { color: 0x9a7552, roughness: 0.88 }), 0);
  return g;
}

// Sol du quartier. Entre les façades, le jeu posait la prairie de la plaine : on marchait
// dans l'herbe haute au milieu d'une rue de Lille. Ce maillage couvre tout ce que la
// grille AMENAGE tient pour aménagé — emprises bâties, cours, chaussées — d'une nappe
// minérale qui s'efface en huit mètres au contact de la campagne. Les chaussées relevées
// se posent par-dessus (elles sont à +0,14 et plus, celle-ci à +0,08).
export function solVille(pas = 6) {
  const pos = [], uv = [], col = [], idx = [];
  const urb = (x, z) => 1 - lisse((distBati(x, z) - 7) / 11);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of LILLE.bati.concat(IGN.bati.map((b) => b.p)).concat(LILLE.routes.map((o) => o.pts)))
    for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
  if (!Number.isFinite(x0)) return null;
  x0 = Math.floor((x0 - 14) / pas) * pas; z0 = Math.floor((z0 - 14) / pas) * pas;
  const NX = Math.ceil((x1 + 14 - x0) / pas), NZ = Math.ceil((z1 + 14 - z0) / pas);
  let n = 0;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const ax = x0 + i * pas, az = z0 + j * pas, bx = ax + pas, bz = az + pas;
    const a = [urb(ax, az), urb(bx, az), urb(bx, bz), urb(ax, bz)];
    if (a[0] < 0.02 && a[1] < 0.02 && a[2] < 0.02 && a[3] < 0.02) continue;
    const k = pos.length / 3;
    const coins = [[ax, az], [bx, az], [bx, bz], [ax, bz]];
    for (let c = 0; c < 4; c++) {
      const [x, z] = coins[c];
      // l'eau garde sa surface : on ne pave pas la Deûle
      const w = sdEau(x, z) < 1 ? 0 : a[c];
      pos.push(x, solPlaine(x, z) + 0.08, z); uv.push(x, z); col.push(1, 1, 1, w);
    }
    idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
    n++;
  }
  if (!n) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, phMat('terre_battue', 1, 1, {
    color: 0x9c8a6c, roughness: 1, transparent: true, depthWrite: false, vertexColors: true,
    polygonOffset: true, polygonOffsetFactor: -1,
  }));
  m.name = 'sol-du-quartier'; m.receiveShadow = true; m.renderOrder = 0;
  console.log('sol du quartier : %d mailles de %d m', n, pas);
  return m;
}

// Les chemins relevés — allées du parc, sentiers de sous-bois, berges de la Deûle — et
// les chaussées. Trois maillages en tout, l'un dans l'autre : sable clair pour les
// sentiers, terre battue pour la desserte, pavé pour les artères.
export function voiriesLille() {
  const g = new THREE.Group(); g.name = 'voiries-de-lille';
  const ajoute = (ge, mat) => { if (!ge) return; const m = new THREE.Mesh(ge, mat); m.receiveShadow = true; m.renderOrder = 1; g.add(m); };
  // Un chemin de halage est de la terre battue, pas de la craie : en clair il dessinait
  // un liseré blanc tout autour du fossé et de la Deûle, visible jusqu'en vue aérienne.
  ajoute(rubanGeo(LILLE.chemins, LARGEUR_CHEMIN, 0.14),
    phMat('rocks_ground_08', 1.6, 1.6, { color: 0x94866c, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  const petites = LILLE.routes.filter((o) => o.r <= 1), grandes = LILLE.routes.filter((o) => o.r >= 2);
  ajoute(rubanGeo(petites, (o) => LARGEUR_ROUTE[Math.min(3, o.r)], 0.16),
    phMat('brown_mud_03', 2, 2, { color: 0x8d7d64, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  ajoute(rubanGeo(grandes, (o) => LARGEUR_ROUTE[Math.min(3, o.r)], 0.18),
    pbrRepeat(cobbles(), 1 / COBBLE_M, 1 / COBBLE_M, { roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
  return g;
}

// le polygone d'une couche sous le point, ou null — rejet par cercle englobant d'abord,
// parce que ces fonctions sont appelées des centaines de milliers de fois à la cuisson
export function coucheAt(liste, x, z, marge = 0) {
  for (const o of liste) {
    if (Math.hypot(x - o.c[0], z - o.c[1]) > o.rr + marge) continue;
    if (sdPoly(x, z, o.poly) < marge) return o;
  }
  return null;
}

// passe par nappeProche, qui seul connaît le retrait du fossé devant l'escarpe : sans ça
// le donjon, au milieu de la place, était annoncé « dans l'eau »
export function eauAt(x, z) { const e = nappeProche(x, z); return e && e.sd < 0 ? e.o : null; }

export function boisAt(x, z) { return coucheAt(LILLE.bois, x, z, 0); }

// distance signée à la nappe d'eau la plus proche, berge de 10 m comprise : sert à
// aplatir le terrain autour de l'eau (cf. margePlate)
export function margeLille(x, z) { return sdEau(x, z) - EAU_RIVE; }

export const EAU_FOND = 1.9, EAU_Y = -0.55, EAU_RIVE = 11;

// De combien l'eau du fossé recule devant l'escarpe. Le relevé trace le plan d'eau
// jusqu'à la ligne du corps de place, mais le REMPART est posé à cheval sur cette ligne,
// sur onze mètres d'épaisseur : sans ce retrait, le fossé passait sous la maçonnerie et
// venait clapoter dans le passage de la Porte Royale, entre le tablier et le pavé.
export const EAU_RETRAIT = WALL_T / 2 + 1.5;
// distance signée à la nappe la plus proche : négative dedans, en mètres. Sert au creux,
// à la teinte du sol et aux roseaux — c'est le seul endroit où cette géométrie est calculée.

// la nappe la plus proche et la distance signée qui va avec — sdEau n'en garde que la
// distance, mais le creusement et le niveau de l'eau ont besoin de la nappe elle-même
export function nappeProche(x, z) {
  let d = Infinity, best = null, dedansPlace = null;
  for (const o of LILLE.eau) {
    if (Math.hypot(x - o.c[0], z - o.c[1]) - o.rr > EAU_RIVE + 4) continue;
    if (o.ceinture) {
      if (dedansPlace === null) dedansPlace = Math.hypot(x, z) < R + 60 && sdPent(x, z) < EAU_RETRAIT;
      if (dedansPlace) continue;
    }
    const sd = sdPoly(x, z, o.poly);
    if (sd < d) { d = sd; best = o; }
  }
  return best ? { o: best, sd: d } : null;
}

export function sdEau(x, z) {
  let d = Infinity, dedansPlace = null;
  for (const o of LILLE.eau) {
    if (Math.hypot(x - o.c[0], z - o.c[1]) - o.rr > EAU_RIVE + 4) continue;
    if (o.ceinture) {                                  // anneau : le fort n'est pas dedans
      if (dedansPlace === null) dedansPlace = Math.hypot(x, z) < R + 60 && sdPent(x, z) < EAU_RETRAIT;
      if (dedansPlace) continue;
    }
    const sd = sdPoly(x, z, o.poly);
    if (sd < d) d = sd;
  }
  return d;
}
// Profil de berge. La cuvette commence 3 m AVANT le bord relevé et atteint son fond 9 m
// après : la rive est une plage en pente, pas une marche. C'est ce profil qui fait qu'on
// voit une berge de vase émerger et non un plan d'eau posé sur la pelouse.

// gardée pour qui l'importe : le terrain, lui, passe par terrainNaturel
export function creuxEau(x, z) {
  const e = nappeProche(x, z);
  if (!e || e.sd > 3) return 0;
  return EAU_FOND * lisse((3 - e.sd) / 12);
}
// L'essence du peuplement à cet endroit, d'après la BD Forêt v2. Autour de la citadelle
// tout est « Feuillus » : le parc est un bois de feuillus, pas une pinède. C'est le
// crochet pour que nature.js cesse de planter au hasard.
export function essenceAt(x, z) {
  for (const f of IGN.foret) if (pointInPoly(x, z, f.p)) return f.essence || 'Feuillus';
  return null;
}

// Les haies relevées, posées comme une file de feuillage bas. Le jeu en inventait le
// long de la route ; celles-ci sont celles du terrain.
export function haiesIGN() {
  const g = new THREE.Group(); g.name = 'haies-ign';
  if (!IGN.haies.length) return g;
  const feuille = phMat('forest_leaves_04', 1, 1, { color: 0x4e6b32, roughness: 1 });
  const H = 1.5, DEMI = 0.75;
  const pos = [], uv = [], idx = [];
  for (const h of IGN.haies) {
    const p = h.p;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 0.5) continue;
      const nx = -dz / L, nz = dx / L, pas = Math.max(1, Math.ceil(L / 3));
      for (let k = 0; k < pas; k++) {
        const t0 = k / pas, t1 = (k + 1) / pas;
        const x0 = a[0] + dx * t0, z0 = a[1] + dz * t0, x1 = a[0] + dx * t1, z1 = a[1] + dz * t1;
        const y0 = solPlaine(x0, z0), y1 = solPlaine(x1, z1);
        // deux plans croisés : une haie se lit de tous les côtés sans coûter un buisson
        for (const [ox, oz] of [[nx * DEMI, nz * DEMI], [0, 0]]) {
          const n0 = pos.length / 3;
          pos.push(x0 - ox, y0, z0 - oz, x1 - ox, y1, z1 - oz,
                   x1 + ox, y1 + H, z1 + oz, x0 + ox, y0 + H, z0 + oz);
          uv.push(0, 0, 1, 0, 1, 1, 0, 1);
          idx.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
        }
      }
    }
  }
  if (!pos.length) return g;
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ge.setIndex(idx); ge.computeVertexNormals();
  const m = new THREE.Mesh(ge, feuille);
  m.material.side = THREE.DoubleSide; m.material.transparent = true; m.material.alphaTest = 0.4;
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return g;
}
// densité de sous-bois relevée, 0 à 1, avec une lisière de 14 m

export function sousBois(x, z) {
  let k = 0;
  for (const o of LILLE.bois) {
    const dc = Math.hypot(x - o.c[0], z - o.c[1]);
    if (dc - o.rr > 14) continue;
    const v = 1 - lisse(sdPoly(x, z, o.poly) / 14);
    if (v > k) k = v;
  }
  return k;
}

// Une rivière n'est pas un miroir : le fossé de la place brille comme du métal parce
// qu'il a été réglé pour une flaque de 20 m. Les nappes de Lille ont leur propre matière,
// mate, qui laisse voir le fond près de la rive.
export let EAU_MAT = null;

export function eauMat() {
  if (EAU_MAT) return EAU_MAT;
  EAU_MAT = new THREE.MeshStandardMaterial({
    color: 0x41748c, roughness: 0.34, metalness: 0.0, transparent: true, opacity: 0.80,
    normalMap: T.waterN, normalScale: new THREE.Vector2(0.65, 0.65), envMapIntensity: 0.5,
    depthWrite: false,
  });
  return EAU_MAT;
}

// Les nappes d'eau : le fond de vase au creux de la cuvette, puis le plan d'eau. La berge,
// elle, est le terrain lui-même, teinté de vase — pas une pièce rapportée.
export function nappesLille() {
  const g = new THREE.Group(); g.name = 'eaux-de-lille';
  if (!LILLE.eau.length) return g;
  const eau = eauMat();
  for (const o of LILLE.eau) {
    // le fond suit le bord relevé : la cuvette est déjà creusée plus large que lui, donc
    // rien ne perce, et il ne dessine plus de liseré autour de la nappe
    // PLUS DE FOND RAPPORTÉ. C'était un disque plat à profondeur fixe, posé dans une
    // cuvette qui, elle, est en pente : il en dépassait tout autour et dessinait ces
    // liserés pâles au bord de l'eau. Le lit, c'est le terrain — déjà creusé au bon
    // niveau et déjà teinté de vase dans les couleurs de sommet du maillage.
    //
    // Le plan d'eau, lui, rentre de 1,2 m sous la berge : à ras du polygone relevé, son
    // bord débordait au-dessus du sol dès que la rive descendait un peu, et il flottait
    // en étagère au-dessus du vide.
    const shEau = polyShape(offsetPoly(o.poly, -1.2));
    if (o.ceinture) shEau.holes.push(traceShape(EAU_RETRAIT));
    const w = flatMesh(shEau, eau, o.y); w.renderOrder = 2; g.add(w);
  }
  return g;
}

// La TERRE des ouvrages : escarpe verticale depuis le fond du fossé et terre-plein gazonné.
// Appelé par game.js après buildCitadel, pour que l'eau soit déjà posée.
export function terrassesDehors() {
  const g = new THREE.Group(); g.name = 'ouvrages-avances';
  if (!DEHORS.length) return g;
  const flanc = phMat('brown_mud_03', 1, 1, { side: THREE.DoubleSide });
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  for (const o of DEHORS) {
    // Le fond du fossé n'est plus à une cote fixe : il suit le niveau relevé de la nappe
    // qui ceinture la place (−4,9 m, soit près de cinq mètres sous la place d'Armes).
    // L'assise des ouvrages doit passer dessous, sinon ils flottent au-dessus de leur
    // propre cuvette.
    const dansLeau = o.sdMin < MOAT_OUT;
    const ceint = LILLE.eau.find((n) => n.ceinture);
    const bas = dansLeau ? (ceint ? ceint.y : 0) - EAU_FOND - 0.8 : -0.8;
    for (const p of dehorsMorceaux(o)) {
      const sh = polyShape(p);
      const corps = extrudeMesh(sh, o.h - bas, bas, [invisible, flanc]);
      corps.receiveShadow = true; corps.castShadow = true;
      g.add(corps);
      const dessus = flatMesh(sh, phMat('grass_ground', 100, 100, { color: 0x8fb45f }), o.h + 0.012);
      dessus.receiveShadow = true;
      g.add(dessus);
    }
  }
  return g;
}


// LA LONGUEUR DU PONT NE SE DÉDUIT PAS DE MOAT_OUT. MOAT_OUT est une distance au
// POLYGONE du corps de place, pas au centre : plein sud la courtine est à APO, mais les
// saillants des bastions du Roy et d'Anjou repoussent la contrescarpe cinquante mètres
// plus loin. Le pont s'arrêtait donc à 108 m de distance signée alors que le fossé va
// jusqu'à 148 : on sortait du pont EN PLEINE EAU, et on restait bloqué là. On mesure
// désormais sur l'axe, une fois, où le fossé finit réellement.
export const PONT_Z1 = (() => {
  let z = APO;
  while (z < APO + 500 && sdPent(0, z) < MOAT_OUT + 6) z += 1;
  return z + 4;
})();

export const PONT_LONG = PONT_Z1 - (APO + WALL_T / 2 - 1);

export function onBridge(x, z) { return Math.abs(x) < 4 && z > APO - 2 && z < PONT_Z1; }

export function nearHouse(x, z) { return (Math.abs(x - HOUSE.x) < HOUSE.w / 2 + 4 && Math.abs(z - HOUSE.z) < HOUSE.d / 2 + 4) || nearTown(x, z) || nearFarm(x, z) || nearRoad(x, z); }

export function nearFarm(x, z) {
  if (Math.hypot(x - FERME.x, z - FERME.z) < 22) return true;                        // le moulin et sa cour
  for (const [dx, dz, fw, fd] of CHAMPS)
    if (Math.abs(x - (FERME.x + dx * ECH)) < fw / 2 + 5 && Math.abs(z - (FERME.z + dz * ECH)) < fd / 2 + 5) return true;
  return false;
}
// tracé de la route du pont au village : une seule liste, partagée par le décor et la
// zone d'exclusion, pour qu'elles ne puissent pas diverger
// Le tracé dépend de TOWN, déclaré plus bas : on le calcule à la demande, une seule fois,
// plutôt que de le figer dans un const qui serait évalué trop tôt.

export let ROAD_CACHE = null;

// Les six points étaient posés à la main pour un bourg qui n'est plus là. La route se
// calcule désormais : elle part de la sortie du pont, contourne le glacis en arc, et
// arrive devant la porte du bourg — où qu'il soit.
export function roadPts() {
  if (!ROAD_CACHE) {
    const A = [0, APO + MOAT_OUT + 8];
    // La route du pont royal ne va plus « au bourg » : le bourg est de l'autre côté de
    // la Deûle. Elle mène à la culée du pont relevé le plus proche de la sortie du pont
    // royal ; au-delà, ce sont les rues de la ville qui prennent le relais.
    const B = (() => {
      preparerPonts();
      let best = null;
      for (const P of PONTS) for (const q of [P.pts[0], P.pts[P.pts.length - 1]]) {
        const d = Math.hypot(q[0] - A[0], q[1] - A[1]);
        if (!best || d < best.d) best = { d, q };
      }
      return best ? [best.q[0], best.q[1]] : [TOWN.x, TOWN.z];
    })();
    const rA = Math.hypot(A[0], A[1]), aA = Math.atan2(A[1], A[0]);
    const rB = Math.hypot(B[0], B[1]), aB = Math.atan2(B[1], B[0]);
    let da = aB - aA; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    // Pour chaque angle, on cherche le rayon le plus proche de l'idéal qui satisfasse DEUX
    // contraintes : être hors du glacis rasé, et être hors de l'eau. La seconde manquait,
    // et la route passait au travers de la Deûle — avec elle le hameau, les haies et les
    // bornes que la campagne pose le long du tracé. On balaie de part et d'autre du rayon
    // idéal et on prend le premier qui convient.
    const N = 16, rayons = new Float64Array(N + 1), angles = new Float64Array(N + 1);
    const bon = (a, r) => {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      return sdPent(x, z) >= GLACIS + 22 && sdEau(x, z) >= 16;
    };
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = aA + da * t, r0 = rA + (rB - rA) * t;
      angles[i] = a;
      let r = r0;
      chercher: for (let d = 0; d <= 420; d += 6) {
        for (const sgn of (d === 0 ? [0] : [1, -1])) {
          const rr = r0 + sgn * d;
          if (rr < 60) continue;
          if (bon(a, rr)) { r = rr; break chercher; }
        }
      }
      rayons[i] = r;
    }
    // un lissage : sans lui la route fait des créneaux à chaque fois qu'un rayon saute
    for (let passe = 0; passe < 2; passe++) {
      const cp = rayons.slice();
      for (let i = 1; i < N; i++) {
        const m = (cp[i - 1] + cp[i] * 2 + cp[i + 1]) / 4;
        if (bon(angles[i], m)) rayons[i] = m;
      }
    }
    const P = [];
    for (let i = 0; i <= N; i++) P.push([Math.cos(angles[i]) * rayons[i], Math.sin(angles[i]) * rayons[i]]);
    P[0] = A; P[P.length - 1] = B;
    ROAD_CACHE = P;
  }
  return ROAD_CACHE;
}

export function nearRoad(x, z) { const P = roadPts(); for (let i = 0; i < P.length - 1; i++) if (distSeg(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]) < 7) return true; return false; }

export function inHouse(x, z) { return Math.abs(x - HOUSE.x) < HOUSE.w / 2 && Math.abs(z - HOUSE.z) < HOUSE.d / 2; }

export function levelH(x, z) {
  if (bastionAt(x, z)) return BAST_H;
  // terrasse du donjon : anneau plein autour du puits (le trou de collision était carré, on tombait entre l'escalier et le bord),
  // sauf dans le couloir côté porte où l'escalier arrive
  { const D = DONJON, dx = x - D.x, dz = z - D.z; if (Math.abs(dx) < D.half + 0.5 && Math.abs(dz) < D.half + 0.5) { const r = Math.hypot(dx, dz); if (r >= 3.65 && !(Math.abs(dx) < 2.6 && dz > 3.2)) return D.h; } }
  // Rampe d'accès au bastion. Elle occupait TOUTE la largeur de la gorge — 46 m pour la
  // Reine — c'est-à-dire un talus de vingt-huit mètres de long en travers de la place
  // d'Armes, sur lequel les casernes relevées et les garde-corps sont posés : les cinq
  // bastions étaient inaccessibles. C'est maintenant une vraie rampe de neuf mètres,
  // placée par placerRampes() dans le couloir libre de la gorge.
  for (const bb of bastions) {
    const s = (x - bb.V[0]) * bb.u[0] + (z - bb.V[1]) * bb.u[1], t = (x - bb.V[0]) * bb.v[0] + (z - bb.V[1]) * bb.v[1];
    // Le palier prolonge la rampe à plat sur l'épaisseur de la courtine : la gorge du
    // bastion EST la ligne de courtine, et sans ce palier on arrive en haut de la rampe
    // devant un trou de trois mètres dans le mur.
    // le palier s'arrête où le couloir entre dans le bastion (b.sPalier, mesuré par
    // citadelle.js) : au-delà, c'était un sol marchable invisible au-dessus du vide
    if (Math.abs(t - bb.tRampe) < bb.demiRampe && s >= bb.sShoulder - bb.rampLen && s < (bb.sPalier ?? bb.sShoulder + WALL_T / 2 + 8)) {
      return BAST_H * Math.min(1, (s - (bb.sShoulder - bb.rampLen)) / bb.rampLen);
    }
  }
  if (onBridge(x, z)) return 0.3;
  // (le tablier des ponts de la Deûle n'est PLUS le sol : c'est une plateforme, posée
  //  par preparerPonts — sans quoi on ne peut pas passer dessous)
  { const o = dehorsAt(x, z); if (o) return o.h; }
  if (BOURG_CALE && inTown(x, z)) return Math.max(TOWN.y, solPlaine(x, z));   // dallage du bourg (cf. calerBourg)
  return solPlaine(x, z);
}

export function levelBlocked(x, z, r, flying, y) {
  const sd = sdPent(x, z);
  if (!dansEnceinte(x, z)) return true;          // l'enceinte urbaine ferme la carte
  // UNE SEULE RÈGLE D'EAU. La bande MOAT_IN..MOAT_OUT était une approximation du fossé
  // par décalage du pentagone ; le fossé est maintenant relevé comme le reste de l'eau,
  // et le trait de rive est celui du terrain creusé, pas celui d'un polygone théorique.
  if (!flying && y < 0.5 && sdEau(x, z) < -1.5 && eauVisible(x, z)
      && !onBridge(x, z) && !bastionAt(x, z) && !dehorsAt(x, z) && !surTablier(x, z, y)) return true;
  return false;
}

export function zoneName(x, z) {
  const b = bastionAt(x, z); if (b) return b.name;
  if (Math.hypot(x - MAGE.x, z - MAGE.z) < MAGE.clair + 4) return 'Clairière du vieux mage';
  if (Math.abs(x) < 9 && z > APO - 5 && z < APO + MOAT_OUT + 6) return 'Porte Royale';
  { const [lx, lz] = townLocal(x, z);
    if (lx > -18 && lx < 10 && lz > -31 && lz < -13) return 'La Chapelle';
    if (inTown(x, z)) return 'La place du bourg'; }
  if (nearFarm(x, z)) return 'Le Moulin';
  // Le lavoir et le hameau sont posés par campagne.js dans la première poche libre entre
  // les arbres : leur place n'est connue qu'après la pose, d'où PARTAGE. Le lavoir passe
  // avant le hameau parce qu'il est plus petit — dans le recouvrement, il est plus précis.
  { const L = PARTAGE.lavoir; if (L && Math.hypot(x - L.x, z - L.z) < L.r) return 'Le Lavoir'; }
  { const H = PARTAGE.hameau;
    if (H) for (let i = 0; i < H.pts.length - 1; i++)
      if (distSeg(x, z, H.pts[i][0], H.pts[i][1], H.pts[i + 1][0], H.pts[i + 1][1]) < H.demi) return 'Le Hameau des Wattines'; }
  { const o = dehorsAt(x, z); if (o) return o.nom; }
  const sd = sdPent(x, z);
  if (Math.abs(x - DONJON.x) < DONJON.half && Math.abs(z - DONJON.z) < DONJON.half) return 'Intérieur du donjon';
  if (Math.abs(x - DONJON.x) < DONJON.fence && z > DONJON.z - DONJON.fence && z < DONJON.gateZ) return 'Donjon';
  if (sdPent(x, z) > -(WALL_T / 2 + 4.2) && sdPent(x, z) < -WALL_T / 2 && !(Math.abs(x) < GATE_HW + 3 && z > APO - 8)) return 'Galeries';
  if (sd < -22) return "Place d'Armes";
  if (sd < FOSSE_IN) return 'Remparts';
  if (sd < MOAT_OUT) return 'Fossés';
  { const o = eauAt(x, z); if (o && o.nom) return o.nom; }
  { const o = boisAt(x, z); if (o && o.nom) return o.nom; }
  // Le nom de la rue qu'on foule, une fois sorti de l'emprise de la place : il prime sur
  // le nom du quartier, et c'est lui qu'on veut lire en entrant dans le boulevard.
  { const n = nomDeVoie(x, z); if (n) return n; }
  { const V = VOIE_C; if (V) { for (let i = 0; i < V.length - 1; i += 2)
    if (distSeg(x, z, V[i][0], V[i][1], V[i + 1][0], V[i + 1][1]) < 7) return 'La voie des combattants'; } }
  if (distBati(x, z) < 22) return 'Les rues de Lille';
  { const o = coucheAt(LILLE.parcs, x, z, 0); if (o) return o.nom || 'Les jardins de la ville'; }
  return 'Bois de Boulogne';
}
// La courtine de la Porte Royale n'est plus forcément la troisième : sur le tracé réel
// elle dépend de l'ordre angulaire des bastions. On la retrouve par la géométrie, et on
// calcule au passage la normale sortante de chaque courtine (l'ancien tableau `normals`
// ne vaut que pour le pentagone régulier).

export const COURTINES = (() => {
  const out = [];
  for (let i = 0; i < bastions.length; i++) {
    const a = bastions[i].S1, b = bastions[(i + 1) % bastions.length].S2;
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    let nx = dz / L, nz = -dx / L;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (mx * nx + mz * nz < 0) { nx = -nx; nz = -nz; }        // sortante : elle s'éloigne du centre
    out.push({ a, b, nx, nz, mx, mz, L });
  }
  return out;
})();

export const GATE_I = COURTINES.reduce((best, c, i) =>
  (Math.hypot(c.mx, c.mz - APO) < Math.hypot(COURTINES[best].mx, COURTINES[best].mz - APO) ? i : best), 0);

export const normale = (i) => (COURTINES.length ? [COURTINES[i].nx, COURTINES[i].nz] : normals[i]);

export function pentShape(offset) {
  if (TRACE) return polyShape(TRACE.off(offset));
  const r = R_REG + offset / COS36, s = new THREE.Shape();
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5, x = r * Math.cos(a), y = -r * Math.sin(a); i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); return s;
}

// LE TRACÉ DÉCALÉ VERS L'INTÉRIEUR S'AUTO-INTERSECTE. Mesuré : une fois à décalage nul,
// cinq fois à −11 m, neuf fois à −22 m — le décalage en mitre replie les gorges des
// bastions l'une sur l'autre. Passé tel quel à ShapeGeometry, un contour pareil remplit
// des régions qui n'existent pas : c'est ainsi que le sable de la place d'Armes débordait
// par-dessus l'eau du fossé, jusqu'à quatorze mètres au-delà de l'escarpe.
//
// Le corps de place est ÉTOILÉ vis-à-vis de son centre. On échantillonne donc le contour
// en polaire, en gardant le croisement le PLUS LOINTAIN sur chaque rayon — si le contour
// s'est replié, c'est son enveloppe qui fait foi — et on obtient un polygone simple, qui
// ne peut plus se recouper.

export function rayonTrace(offset, a) {
  if (!TRACE) return R_REG + offset / COS36;
  const dx = Math.cos(a), dz = Math.sin(a), P = TRACE.off(offset), n = P.length;
  let best = 0;
  for (let i = 0; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n];
    const ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (p[0] * ez - p[1] * ex) / den;      // le centre du relevé est l'origine
    const u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= -0.001 && u <= 1.001 && t > best) best = t;
  }
  return best;
}

export function polyTrace(offset, seg = 288) {
  const out = [];
  for (let k = 0; k < seg; k++) { const a = k / seg * TAU, r = rayonTrace(offset, a); out.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return out;
}

export function traceShape(offset, seg) { return polyShape(polyTrace(offset, seg)); }

// L'intérieur de la place, en éventail depuis le centre : une triangulation qui ne peut
// pas déborder. UV en mètres / 100, pour rester compatible avec phMat(slug, 100, 100).
export function disqueTrace(offset, mat, y = 0, seg = 288) {
  const pos = [0, y, 0], uv = [0, 0], idx = [];
  for (let k = 0; k < seg; k++) {
    const a = k / seg * TAU;
    // LA PREMIÈRE SORTIE, pas le croisement le plus loin (rayonTrace) : au droit des flancs
    // de bastion, le rayon sort du tracé puis y rentre ; le secteur de l'éventail couvrait
    // tout l'entre-deux, hors du mur, à plat par-dessus la berme du fossé (banc arpenteur).
    // Ce qu'on perd sous les bastions, leur terre-plein le couvre déjà.
    const rMax = rayonTrace(offset, a);
    let r = 0;
    while (r < rMax && sdPent(Math.cos(a) * (r + 0.5), Math.sin(a) * (r + 0.5)) <= offset + 0.3) r += 0.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.push(x, y, z); uv.push(x / 100, z / 100);
  }
  for (let k = 0; k < seg; k++) idx.push(0, 1 + (k + 1) % seg, 1 + k);
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ge.setIndex(idx); ge.computeVertexNormals();
  const me = new THREE.Mesh(ge, mat); me.receiveShadow = true;
  return me;
}

export function polyShape(pts) { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1])); s.closePath(); return s; }

// =====================================================================
//  Construction
// =====================================================================

// Le bourg inventé était posé en travers du Canal de la Moyenne-Deûle et à l'entrée du
// quartier de l'Esplanade. Puisque le relevé fait foi, c'est lui qui bouge : il se pose
// sur la seule vraie clairière de la carte, la plaine à l'est de la place (122 m de
// dégagement, le plus grand vide du relevé). C'est un emplacement PROVISOIRE : le bourg
// a vocation à être remplacé par le quartier réel, reconstruit depuis LILLE.bati.
// Le bourg n'est plus un village fortifié planté dans un champ, avec sa muraille et sa
// Porte des Flandres : la carte fait foi, et il n'y a jamais eu de bourg là. Ce qu'il en
// reste — la place, le marché, l'estaminet, le beffroi, la chapelle — est posé dans le
// VRAI quartier, à (200, 660) : 350 m au-delà de la sortie du pont de la Porte Royale,
// sur l'autre rive de la Deûle qu'on franchit par un pont relevé. Il était vingt mètres
// plus près du quai : 45 des 210 cases de son emprise trempaient dans la Deûle, et une
// maison débordait sur l'eau.
//
// `a` est l'orientation du groupe : 162,5°, la direction dominante des rues relevées
// dans un rayon de 140 m. La grand-rue du bourg est donc dans l'axe des rues voisines,
// et non dans celui du monde. Les coordonnées LOCALES de village.js ne changent pas :
// tout ce qui pose un objet du bourg depuis l'extérieur passe par townWorld().
export const TOWN = { x: 200, z: 660, half: 26, s: 1.5, a: -162.5 * Math.PI / 180 };
TOWN.ca = Math.cos(TOWN.a);
TOWN.sa = Math.sin(TOWN.a);

// emprise du bourg en unités locales : la grand-rue, la place, la chapelle et son cimetière
export const TOWN_BOITE = { x0: -28, x1: 28, z0: -32, z1: 22 };

// L'ALTITUDE DU BOURG. Il était bâti à la cote 0 — celle de la place d'Armes — alors que
// le relevé met la plaine de l'Esplanade 1,1 à 1,7 m plus bas sous la place : tout le bourg
// flottait, et Camille marchait sous ses pavés, la caméra au ras du dallage.
// Le bourg se pose au plus haut du sol relevé sous son CŒUR PAVÉ (place et rues), et
// levelH() y rend le plus haut du pavé et du terrain : on ne s'enfonce jamais. Pas au plus
// haut de toute l'emprise : les coins nord (chapelle, cimetière) montent à −0,4 m, et
// caler la place dessus la remettait un mètre en l'air.
// Calé par village.js au début de buildTown(), une fois le relief cuit.
TOWN.y = 0;
const BOURG_COEUR = { x0: -20, x1: 20, z0: -16, z1: 22 };   // unités locales
let BOURG_CALE = false;
export function calerBourg() {
  const B = BOURG_COEUR;
  let m = -Infinity;
  for (let lx = B.x0; lx <= B.x1; lx += 2) for (let lz = B.z0; lz <= B.z1; lz += 2) {
    const [x, z] = townWorld(lx, lz);
    m = Math.max(m, solPlaine(x, z));
  }
  TOWN.y = Number.isFinite(m) ? m + 0.02 : 0;
  BOURG_CALE = true;
  return TOWN.y;
}

export function townWorld(lx, lz) {
  return [TOWN.x + TOWN.s * (lx * TOWN.ca + lz * TOWN.sa),
    TOWN.z + TOWN.s * (-lx * TOWN.sa + lz * TOWN.ca)];
}

export function inTown(x, z) {
  const [lx, lz] = townLocal(x, z), B = TOWN_BOITE;
  return lx > B.x0 && lx < B.x1 && lz > B.z0 && lz < B.z1;
}

export function cobbleTextures() {
  const W = 256, H = 256, [c, x] = makeCanvas(W, H);
  const height = new Float32Array(W * H).fill(0.18);
  const grand = fbm(W, H, 2, 21);          // variation lente, casse la répétition de la tuile
  const n = fbm(W, H, 3, 77);
  x.fillStyle = '#56514a'; x.fillRect(0, 0, W, H);
  // 8 × 8 pavés, dessinés avec report sur les quatre bords : la tuile se raccorde dans les deux axes
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const cx = col * 32 + 16 + (row % 2) * 16 + rand(-3.5, 3.5);
    const cy = row * 32 + 16 + rand(-3, 3);
    const rx = rand(11.5, 15), ry = rand(10.5, 14), rot = rand(0, TAU);
    const gi = ((Math.round(cy) % H + H) % H) * W + ((Math.round(cx) % W + W) % W);
    const v = 108 + Math.random() * 62 + (grand[gi] - 0.5) * 46;
    x.fillStyle = `rgb(${v | 0},${(v - 5) | 0},${(v - 13) | 0})`;
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
      if (Math.abs(cx + dx - W / 2) > W / 2 + rx || Math.abs(cy + dy - H / 2) > H / 2 + ry) continue;
      x.beginPath(); x.ellipse(cx + dx, cy + dy, rx, ry, rot, 0, TAU); x.fill();
    }
    for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++)
      for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const u = (xx - cx) / rx, w = (yy - cy) / ry, dd = u * u + w * w;
        if (dd >= 1) continue;
        const px = ((xx % W) + W) % W, py = ((yy % H) + H) % H;
        height[py * W + px] = 0.45 + (1 - dd) * 0.55;
      }
  }
  const img = x.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) {
    const g2 = (n[i] - 0.5) * 26 + (Math.random() - 0.5) * 14 + (grand[i] - 0.5) * 30;
    img.data[i * 4] += g2; img.data[i * 4 + 1] += g2; img.data[i * 4 + 2] += g2;
  }
  x.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: normalMapFrom(height, W, H, 2.6) };
}

export function townLocal(x, z) {
  const px = (x - TOWN.x) / TOWN.s, pz = (z - TOWN.z) / TOWN.s;
  return [px * TOWN.ca - pz * TOWN.sa, px * TOWN.sa + pz * TOWN.ca];
}

// vrai sur l'emprise du bourg et sa marge : ni arbre sauvage, ni touffe d'herbe folle,
// ni butte — tout y est planté à la main
export function nearTown(x, z, marge = 0) {
  const [lx, lz] = townLocal(x, z), B = TOWN_BOITE, m = marge / TOWN.s + 3;
  return lx > B.x0 - m && lx < B.x1 + m && lz > B.z0 - m && lz < B.z1 + m;
}
