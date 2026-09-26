// pnj.js — villageois, Camille et le prince sur le squelette riggé.
//
// Même principe que geants.js : si la banque d'assets manque, chaque fabrique
// renvoie null et l'appelant retombe sur la version procédurale. Le jeu ne
// casse jamais faute d'un fichier.
import * as THREE from 'three';
import * as A from './assets.js';
import { mesh, mat, boxG, sphG, capG, TAU, rand, CT, creatureMat, GOLD, STEEL, IRON, T, pbrRepeat, phMat, phPeint } from './engine.js?v=27';

export const IDS = [
  'tenues:Female_Peasant', 'tenues:Male_Peasant', 'tenues:Female_Ranger', 'tenues:Male_Ranger',
  'corps:Superhero_Female_FullBody', 'corps:Superhero_Male_FullBody',
  'coiffures_r:Hair_Long', 'coiffures_r:Hair_SimpleParted', 'coiffures_r:Hair_Buns',
  'coiffures_r:Hair_Buzzed', 'coiffures_r:Hair_BuzzedFemale', 'coiffures_r:Hair_Beard',
  'coiffures_r:Eyebrows_Female', 'coiffures_r:Eyebrows_Regular',
];

let pret = false, banque = null;

// Les IDS indispensables : sans eux, pas de villageois du tout.
const ESSENTIELS = ['tenues:Female_Peasant', 'tenues:Male_Peasant',
                    'corps:Superhero_Female_FullBody', 'corps:Superhero_Male_FullBody'];
const manquants = new Set();
export const aLAsset = (id) => !manquants.has(id);

export async function prepare() {
  // Chaque asset est chargé séparément : une coiffure absente ne doit pas
  // priver le village de ses six habitants. Seuls les corps et les tenues de
  // base sont bloquants.
  await Promise.all(IDS.map(id => A.load(id).catch(() => { manquants.add(id); })));
  const perdus = ESSENTIELS.filter(id => manquants.has(id));
  if (perdus.length) { console.warn('PNJ riggés indisponibles, manque :', perdus.join(', ')); pret = false; return false; }
  if (manquants.size) console.warn('PNJ : pièces optionnelles absentes —', [...manquants].join(', '));
  try { banque = await A.animations(); }
  catch (e) { console.warn('banque d\'animations indisponible :', e.message); pret = false; return false; }
  CLIP = choisirClips(banque);
  pret = true;
  return true;
}
export const dispo = () => pret;

// ---------------------------------------------------------------------------
//  Quel clip pour quel rôle
// ---------------------------------------------------------------------------
// Le volume 1 de la bibliothèque apporte la vraie locomotion (Idle, Walk, Jog,
// Sprint, Jump, Roll) ; les cycles fabriqués par locomotion.js ne servent plus
// que de repli, et pour ce qu'aucun volume ne couvre (le tir à l'arc, la pose
// allongée). On choisit donc par disponibilité, pas en dur : si un volume
// manque, on retombe automatiquement sur le cycle fabriqué.
export let CLIP = {};
function choisirClips(b) {
  const a = (...noms) => noms.find(n => b.clips.has(n)) || noms[noms.length - 1];
  return {
    repos:    a('Idle_Loop', 'Repos'),
    garde:    a('Sword_Idle', 'ReposGarde'),
    marche:   a('Walk_Loop', 'Marche'),
    marcheLente: a('Walk_Formal_Loop', 'Walk_Loop', 'Marche'),
    course:   a('Sprint_Loop', 'Jog_Fwd_Loop', 'Course'),
    saut:     a('Jump_Loop', 'Saut'),
    sautDepart: a('Jump_Start', 'Jump_Loop', 'Saut'),
    sautFin:  a('Jump_Land', 'Jump_Loop', 'Saut'),
    roulade:  a('Roll'),
    touche:   a('Hit_Chest', 'Hit_Knockback'),
    parle:    a('Idle_Talking_Loop', 'Yes'),
    assis:    a('Sitting_Idle_Loop', 'Assis'),
    genou:    a('Fixing_Kneeling', 'Genou'),
    joie:     a('Dance_Loop', 'Joie'),
    couche:   'Couche',                       // aucun volume n'a de pose allongée
    arc:      'Arc',                          // ni de tir à l'arc (seulement du pistolet)
    coups:    ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'].filter(n => b.clips.has(n)),
  };
}
/** Tous les clips utilisés par les PNJ et Camille, dédoublonnés. */
const tousClips = (...listes) => [...new Set(listes.flat().filter(Boolean))];

/** assets.js mutualise les matériaux : sans copie, teinter un villageois les teint tous. */
function materiauxPropres(racine) {
  const vus = new Map();
  racine.traverse(o => {
    if (!o.isMesh) return;
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    const neuf = liste.map(m => { if (!vus.has(m)) vus.set(m, m.clone()); return vus.get(m); });
    o.material = Array.isArray(o.material) ? neuf : neuf[0];
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false;
  });
  return [...vus.values()];
}

/**
 * Recolore une texture d'atlas en changeant sa TEINTE, pas en la multipliant.
 * Multiplier ne peut pas rendre bleu un tissu peint en vert : on garde donc la
 * luminance (l'ombrage peint du pack) et on remplace teinte et saturation par
 * celles de la couleur voulue, via les modes de fusion du canvas.
 */
const _recolor = new Map();
function recolorer(texture, hex) {
  if (!texture || !texture.image) return texture;
  const cle = (texture.uuid || '') + '#' + hex;
  if (_recolor.has(cle)) return _recolor.get(cle);
  const img = texture.image;
  const w = img.width || img.videoWidth, h = img.height || img.videoHeight;
  if (!w || !h) return texture;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const css = '#' + hex.toString(16).padStart(6, '0');
  for (const mode of ['saturation', 'hue']) {
    g.globalCompositeOperation = mode; g.fillStyle = css; g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = 'destination-in';       // on ne touche pas à l'alpha
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = texture.colorSpace; t.wrapS = texture.wrapS; t.wrapT = texture.wrapT;
  t.flipY = texture.flipY; t.needsUpdate = true;
  _recolor.set(cle, t);
  return t;
}

/**
 * Comme teindreMaillages, mais en remplaçant la teinte de l'atlas.
 * Règle : `[motif, teinte, valeur]`. La teinte remplace celle de l'atlas en
 * gardant sa luminance peinte ; la VALEUR (0..1, 1 par défaut) l'assombrit
 * ensuite d'un coup de gris. Les deux sont nécessaires : garder la luminance
 * est justement ce qui fait qu'une chemise écrue reteintée en prune ressort
 * rose bonbon — la teinte donne la couleur, la valeur donne le tissu.
 */
function recolorerMaillages(racine, regles) {
  racine.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const r = regles.find(([re]) => re.test(o.name || ''));
    if (!r) return;
    const val = r[2] === undefined ? 1 : r[2];
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    const neuf = liste.map(m => {
      const c = m.clone();
      if (c.map) { c.map = recolorer(c.map, r[1]); c.color.setRGB(val, val, val); }
      else { c.color.setHex(r[1]); c.color.multiplyScalar(val); }
      return c;
    });
    o.material = Array.isArray(o.material) ? neuf : neuf[0];
  });
}

/**
 * Teinte par MAILLAGE, pas par matériau : tout le pack partage un seul matériau
 * d'atlas (« MI_Peasant »), donc teinter par nom de matériau repeint la tenue
 * entière d'un bloc. Les maillages, eux, sont nommés Body / Legs / Arms / Feet.
 * Chaque maillage teint reçoit sa propre copie du matériau.
 */
function teindreMaillages(racine, regles) {
  racine.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const nom = o.name || '';
    const r = regles.find(([re]) => re.test(nom));
    if (!r) return;
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    const neuf = liste.map(m => { const c = m.clone(); c.color.setHex(r[1]); return c; });
    o.material = Array.isArray(o.material) ? neuf : neuf[0];
  });
}

// ---------------------------------------------------------------------------
//  Sockets : suivre un os sans hériter de son échelle (cf. geants.js)
// ---------------------------------------------------------------------------
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _sOs = new THREE.Vector3();          // échelle MONDE de l'os (contient déjà celle du perso)
const _pg = new THREE.Vector3(), _qg = new THREE.Quaternion(), _qo = new THREE.Quaternion();
const _qg0 = new THREE.Quaternion();       // orientation du personnage, non inversée
const _sg = new THREE.Vector3();           // échelle MONDE du groupe (G.echelle, dehors 0,6)

export function socket(g, perso, nomOs, obj, pos = [0, 0, 0], rot = [0, 0, 0], suitRot = true) {
  const os = perso.userData.os && perso.userData.os[nomOs];
  if (!os) return null;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  g.add(obj);
  (g.userData.sockets ||= []).push({
    os, obj, p: new THREE.Vector3(...pos),
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), suitRot,
    base: obj.scale.x || 1,        // l'objet peut avoir sa propre échelle : on la garde
  });
  return obj;
}

export function majSockets(g) {
  const liste = g.userData.sockets;
  if (!liste || !liste.length) return;
  const ech = g.userData.perso.scale.x;
  g.updateWorldMatrix(true, true);
  g.getWorldPosition(_pg); g.getWorldQuaternion(_qg0); _qg.copy(_qg0).invert();
  // Le calcul se fait en mètres MONDE, mais l'accessoire est l'enfant de g : il faut donc
  // repasser dans son repère À L'ÉCHELLE. Dehors, Camille et les villageois sont ramenés à
  // 1,80 m (échelle 0,6) : sans cette division, épée, bouclier, foulard et bourse se
  // posaient à 60 % de la hauteur de leur os — l'épée à la hanche, le foulard au ventre.
  // Dans les intérieurs (échelle 1), le défaut ne se voyait pas.
  g.getWorldScale(_sg); const kg = _sg.x || 1;
  for (const it of liste) {
    if (!it.obj.visible) continue;
    // carrure() gonfle les os : un accessoire calé sur un os de taille 1 flotte
    // à côté d'une main 22 % plus large, et une défense s'enfonce dans un crâne
    // agrandi de 24 %. L'offset est donc traité comme un POINT dans l'espace
    // local de l'os, transformé par la matrice monde COMPLÈTE — rotation et
    // échelle gonflée comprises. (Décomposer puis multiplier par l'échelle ne
    // marche pas : le long d'un bras qui tourne, les axes de l'échelle et ceux
    // de l'offset ne coïncident plus, et la position part de travers.)
    it.os.matrixWorld.decompose(_p, _q, _sOs);
    if (it.suitRot) _p.copy(it.p).applyMatrix4(it.os.matrixWorld);
    // Accessoire qui reste vertical (un tablier ne suit pas la bascule du bassin) :
    // l'offset est pris dans le repère du PERSONNAGE, pas dans celui du monde —
    // sinon « devant » veut dire « vers le nord » et le tablier passe dans le dos
    // dès que le villageois se retourne.
    else _p.add(_s.copy(it.p).multiplyScalar(ech * kg).applyQuaternion(_qg0));
    it.obj.position.copy(_p.sub(_pg)).applyQuaternion(_qg).divideScalar(kg);
    if (it.suitRot) it.obj.quaternion.copy(_qo.copy(_qg).multiply(_q).multiply(it.q));
    else it.obj.quaternion.copy(it.q);
    it.obj.scale.setScalar(ech * it.base);
  }
}

// ---------------------------------------------------------------------------
//  Contrôleur d'animation commun
// ---------------------------------------------------------------------------
async function controleur(g, perso, noms, depart) {
  const x = await A.animer(perso, noms);
  x.jouer(depart, 0);
  x.mixer.update(0); majSockets(g);
  return {
    mixer: x.mixer, actions: x.actions,
    get nom() { return x.nom; },
    jouer: (n, f, b) => x.jouer(n, f, b),
    update(dt) { x.update(dt); majSockets(g); },
  };
}

// ---------------------------------------------------------------------------
//  Carrure : un village n'est pas une rangée de mannequins
// ---------------------------------------------------------------------------
// Les six habitants sortaient tous du même maillage, à ±5 % de taille près : de
// loin, c'était six fois la même personne dans six chemises. On redimensionne
// donc des os, comme le fait geants.js — un brasseur a du ventre et des épaules,
// un vieux a le torse court et les bras secs. Les clips ne touchent jamais à
// l'échelle des os, donc la carrure tient pendant toute l'animation.
//
// Piège : l'échelle d'un os se propage à TOUS ses enfants. Élargir `spine_01`
// élargit la tête et les mains. Chaque table compense donc au cou et au crâne
// pour que le produit des facteurs y reste voisin de 1 — sinon le village se
// remplit de grosses têtes.
//
// Comme pour les géants, la carrure s'applique AVANT la mise à l'échelle : un
// torse raccourci fait autrement mentir la taille mesurée sur l'os de la tête.
function carrure(perso, table) {
  const os = perso.userData.os || {};
  for (const [nom, sc] of Object.entries(table)) {
    const b = os[nom]; if (!b) continue;
    b.scale.set(...(Array.isArray(sc) ? sc : [sc, sc, sc]));
  }
}

// Cinq gabarits. Le produit des facteurs X de spine_01 → Head est indiqué en
// commentaire : c'est lui qu'il faut garder près de 1.
const GABARITS = {
  // ventru, épaules larges, jambes courtes — le brasseur, le tavernier
  trapu: {
    spine_01: [1.24, 0.96, 1.30], spine_02: [1.10, 1, 1.12], spine_03: [0.93, 1, 0.91],
    neck_01: [0.80, 1, 0.80], Head: 0.98,                      // 1,24×1,10×0,93×0,80 ≈ 1,01
    clavicle_l: [1.10, 1, 1.10], clavicle_r: [1.10, 1, 1.10],
    upperarm_l: [1.12, 1, 1.12], upperarm_r: [1.12, 1, 1.12],
    lowerarm_l: [0.96, 1, 0.96], lowerarm_r: [0.96, 1, 0.96],
    thigh_l: [1.12, 0.93, 1.12], thigh_r: [1.12, 0.93, 1.12],
    calf_l: [1.04, 0.95, 1.04], calf_r: [1.04, 0.95, 1.04],
  },
  // sec, torse court, bras maigres — le vieux garde
  sec: {
    spine_01: [0.88, 0.95, 0.86], spine_02: [0.92, 0.94, 0.90], spine_03: [0.95, 1, 0.94],
    neck_01: [1.26, 1, 1.26], Head: 1.04,                      // 0,88×0,92×0,95×1,26 ≈ 0,97
    clavicle_l: [0.94, 1, 0.94], clavicle_r: [0.94, 1, 0.94],
    upperarm_l: [0.84, 1, 0.84], upperarm_r: [0.84, 1, 0.84],
    lowerarm_l: [0.86, 1, 0.86], lowerarm_r: [0.86, 1, 0.86],
    thigh_l: [0.87, 1.02, 0.87], thigh_r: [0.87, 1.02, 0.87],
    calf_l: [0.88, 1.01, 0.88], calf_r: [0.88, 1.01, 0.88],
  },
  // grand, charpenté, longues jambes — le bûcheron, le meunier
  charpente: {
    spine_01: [1.10, 1.04, 1.08], spine_02: [1.04, 1.02, 1.04], spine_03: [1.02, 1, 1.02],
    neck_01: [0.88, 1, 0.88], Head: 0.98,                      // 1,10×1,04×1,02×0,88 ≈ 1,03
    clavicle_l: [1.16, 1, 1.16], clavicle_r: [1.16, 1, 1.16],
    upperarm_l: [1.14, 1, 1.14], upperarm_r: [1.14, 1, 1.14],
    lowerarm_l: [1.08, 1, 1.08], lowerarm_r: [1.08, 1, 1.08],
    thigh_l: [1.06, 1.05, 1.06], thigh_r: [1.06, 1.05, 1.06],
    calf_l: [1.04, 1.04, 1.04], calf_r: [1.04, 1.04, 1.04],
  },
  // petite et ronde, hanches larges — la marchande
  ronde: {
    spine_01: [1.10, 0.96, 1.14], spine_02: [1.04, 0.99, 1.05], spine_03: [0.96, 1, 0.95],
    neck_01: [0.92, 1, 0.92], Head: 1.0,                       // 1,10×1,04×0,96×0,92 ≈ 1,01
    thigh_l: [1.14, 0.94, 1.14], thigh_r: [1.14, 0.94, 1.14],
    calf_l: [1.06, 0.96, 1.06], calf_r: [1.06, 0.96, 1.06],
    upperarm_l: [1.06, 1, 1.06], upperarm_r: [1.06, 1, 1.06],
  },
  // longue et mince — la lavandière
  mince: {
    spine_01: [0.94, 1.03, 0.92], spine_02: [0.96, 1.02, 0.95], spine_03: [0.99, 1, 0.98],
    neck_01: [1.10, 1, 1.10], Head: 1.01,                      // 0,94×0,96×0,99×1,10 ≈ 0,98
    upperarm_l: [0.92, 1, 0.92], upperarm_r: [0.92, 1, 0.92],
    lowerarm_l: [0.93, 1, 0.93], lowerarm_r: [0.93, 1, 0.93],
    thigh_l: [0.93, 1.04, 0.93], thigh_r: [0.93, 1.04, 0.93],
    calf_l: [0.94, 1.03, 0.94], calf_r: [0.94, 1.03, 0.94],
  },
  // sportive, sans excès — la garde champêtre
  droite: {
    spine_01: [1.03, 1.01, 1.02], spine_02: [1.01, 1, 1.01], spine_03: [1, 1, 1],
    neck_01: [0.96, 1, 0.96], Head: 1.0,                       // ≈ 1,00
    clavicle_l: [1.07, 1, 1.07], clavicle_r: [1.07, 1, 1.07],
    upperarm_l: [1.05, 1, 1.05], upperarm_r: [1.05, 1, 1.05],
    thigh_l: [1.04, 1.02, 1.04], thigh_r: [1.04, 1.02, 1.04],
  },
};

// ---------------------------------------------------------------------------
//  Accessoires — ce qui fait lire une silhouette à trente mètres
// ---------------------------------------------------------------------------
// Le pack ne donne ni coiffe, ni chapeau, ni tablier, ni panier : six habitants
// nu-tête et sans rien dans les mains sont six taches de la même forme. La
// version en primitives avait des chapeaux et des tabliers ; la version riggée
// les avait perdus en route. On les refait en géométrie, accrochés aux os par
// `socket()` — quelques dizaines de triangles chacun, et c'est ce qui se voit en
// premier depuis l'autre bout de la place.
//
// Ils portent aussi la VALEUR : l'atlas du pack est tout entier dans les tons
// moyens et sombres, donc une coiffe de lin ou un tablier écru sont les seules
// taches claires de la silhouette. C'est ce contraste-là qui manque le plus.
const LIN = 0xe0d6bd, LIN_SALE = 0xc9bda0, LAINE = 0x8d8779;
const CUIR = 0x6b4a2e, CUIR_FONCE = 0x45321f, OSIER = 0xb08a4e, FER = 0x55595e;

/** Coiffe de lin, plaquée sur le crâne avec son bourrelet. */
function coiffe(couleur = LIN) {
  const m = mat(couleur, { roughness: 1 });
  const g = new THREE.Group();
  const cal = mesh(new THREE.SphereGeometry(0.093, 16, 9, 0, TAU, 0, Math.PI * 0.55), m, 0, -0.012, 0);
  cal.scale.y = 0.74; g.add(cal);                    // une coiffe est plate, pas ronde
  const bord = mesh(new THREE.TorusGeometry(0.092, 0.015, 6, 18), m, 0, -0.024, 0);
  bord.rotation.x = Math.PI / 2; bord.scale.z = 0.85; g.add(bord);
  // la collerette qui encadre le visage et le pan qui tombe dans la nuque
  g.add(mesh(new THREE.TorusGeometry(0.086, 0.021, 6, 16, Math.PI * 1.1), m, 0, 0.002, 0.012).rotateX(1.25));
  g.add(mesh(boxG(0.135, 0.105, 0.012), m, 0, -0.058, -0.078).rotateX(0.26));
  return g;
}

/** Chapeau de feutre à large bord, avec son ruban. */
function chapeau(couleur = 0x4b4136, ruban = 0x6e5a3a, bord = 0.165) {
  const m = mat(couleur, { roughness: 1 });
  const g = new THREE.Group();
  const b = mesh(new THREE.CylinderGeometry(bord, bord, 0.011, 20), m, 0, 0, 0);
  b.scale.z = 1.12; g.add(b);                        // bord un peu ovale, pas une assiette
  g.add(mesh(new THREE.CylinderGeometry(0.090, 0.104, 0.072, 16), m, 0, 0.040, 0));
  g.add(mesh(new THREE.SphereGeometry(0.090, 16, 6, 0, TAU, 0, Math.PI / 2), m, 0, 0.074, 0));
  g.add(mesh(new THREE.TorusGeometry(0.100, 0.013, 6, 18), mat(ruban, { roughness: 1 }), 0, 0.016, 0).rotateX(Math.PI / 2));
  return g;
}

/** Bonnet de laine, pour ceux qui n'ont ni coiffe ni chapeau. */
function bonnet(couleur = LAINE) {
  const m = mat(couleur, { roughness: 1 });
  const g = new THREE.Group();
  const cal = mesh(new THREE.SphereGeometry(0.106, 16, 9, 0, TAU, 0, Math.PI * 0.58), m, 0, -0.038, 0);
  cal.scale.y = 0.74; g.add(cal);
  const rev = mesh(new THREE.TorusGeometry(0.104, 0.025, 6, 18), m, 0, -0.050, 0);
  rev.rotation.x = Math.PI / 2; g.add(rev);
  g.add(mesh(sphG(0.026, 8), m, 0, 0.034, -0.012));   // le pompon, qui donne l'angle de la tête
  return g;
}

/** Tablier : bavette et pan de toile, sur le bassin. Reste vertical. */
function tablier(couleur = LIN_SALE, bavette = true) {
  const m = mat(couleur, { roughness: 1 });
  const g = new THREE.Group();
  const pan = mesh(new THREE.CylinderGeometry(0.135, 0.175, 0.30, 14, 1, true, -1.15, 2.3), m, 0, -0.10, 0);
  pan.material.side = THREE.DoubleSide;
  g.add(pan);
  if (bavette) g.add(mesh(boxG(0.155, 0.175, 0.011), m, 0, 0.135, 0.072));
  g.add(mesh(new THREE.TorusGeometry(0.145, 0.013, 6, 16), mat(CUIR, { roughness: 0.9 }), 0, 0.045, 0).rotateX(Math.PI / 2));
  return g;
}

/** Fichu croisé sur les épaules — la tache claire du haut du corps. */
function fichu(couleur = LIN) {
  const m = mat(couleur, { roughness: 1 });
  const g = new THREE.Group();
  // un châle est un cône tronqué posé sur les épaules, pas un tore au cou :
  // c'est l'évasement qui le fait lire, et qui élargit la silhouette de loin.
  const chale = mesh(new THREE.CylinderGeometry(0.078, 0.205, 0.145, 18, 1, true), m, 0, -0.045, 0);
  chale.material.side = THREE.DoubleSide; chale.scale.z = 0.88; g.add(chale);
  g.add(mesh(new THREE.TorusGeometry(0.080, 0.016, 6, 18), m, 0, 0.026, 0).rotateX(Math.PI / 2));
  // la pointe qui tombe dans le dos
  const pointe = mesh(new THREE.ConeGeometry(0.105, 0.20, 3), m, 0, -0.145, -0.085);
  pointe.rotation.x = Math.PI + 0.18; pointe.scale.z = 0.3; g.add(pointe);
  return g;
}

/** Panier d'osier, passé au bras (pas dans la main : aucune pose ne l'ouvre). */
function panier() {
  const m = mat(OSIER, { roughness: 1 });
  const g = new THREE.Group();
  const y = -0.165;                       // le panier pend SOUS la main qui le tient
  const corps = mesh(new THREE.CylinderGeometry(0.095, 0.072, 0.105, 12, 1, true), m, 0, y, 0);
  corps.material.side = THREE.DoubleSide; g.add(corps);
  g.add(mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.008, 12), m, 0, y - 0.052, 0));
  g.add(mesh(new THREE.TorusGeometry(0.095, 0.012, 6, 16), m, 0, y + 0.052, 0).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.TorusGeometry(0.092, 0.010, 5, 16, Math.PI), m, 0, y + 0.055, 0));
  // un peu de linge qui dépasse : la seconde tache claire
  g.add(mesh(sphG(0.062, 8), mat(LIN, { roughness: 1 }), 0.012, y + 0.062, 0));
  return g;
}

/** Lanterne à main : le clip Idle_Lantern mime une lanterne, autant qu'il y en ait une. */
function lanterne() {
  const fer = mat(FER, { metalness: 0.7, roughness: 0.5 });
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.085, 8, 1, true), mat(0xffca72, { roughness: 0.4, emissive: 0xffa53a, emissiveIntensity: 0.9 }), 0, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.012, 8), fer, 0, -0.046, 0));
  g.add(mesh(new THREE.ConeGeometry(0.062, 0.045, 8), fer, 0, 0.066, 0));
  g.add(mesh(new THREE.TorusGeometry(0.026, 0.006, 5, 12), fer, 0, 0.098, 0));
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + 0.4;
    g.add(mesh(boxG(0.008, 0.09, 0.008), fer, Math.cos(a) * 0.05, 0.002, Math.sin(a) * 0.05));
  }
  return g;
}

/** Hache de bûcheron, pour le clip TreeChopping. */
function hache() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.019, 0.024, 0.58, 8), pbrRepeat(T.bark, 1, 2), 0, 0.25, 0));
  // la tête : un talon carré, un tranchant évasé, et l'œil qui enserre le manche
  g.add(mesh(boxG(0.046, 0.175, 0.052), STEEL(), 0, 0.535, 0));
  const fer = mesh(new THREE.CylinderGeometry(0.155, 0.075, 0.042, 3), STEEL(), 0, 0.545, 0.105);
  fer.rotation.x = Math.PI / 2; fer.rotation.z = Math.PI / 2; g.add(fer);
  g.add(mesh(new THREE.TorusGeometry(0.036, 0.013, 6, 12), IRON(), 0, 0.455, 0).rotateX(Math.PI / 2));
  return g;
}

/** Besace de toile en bandoulière. */
function besace(couleur = LIN_SALE) {
  const m = mat(couleur, { roughness: 1 });
  const g = new THREE.Group();
  g.add(mesh(boxG(0.16, 0.15, 0.075), m, 0, -0.03, 0));
  g.add(mesh(boxG(0.165, 0.055, 0.08), mat(CUIR, { roughness: 0.9 }), 0, 0.045, 0.004));
  const sangle = mesh(boxG(0.045, 0.40, 0.014), mat(CUIR, { roughness: 0.9 }), 0, 0.09, 0);
  sangle.rotation.z = 0.5; g.add(sangle);
  return g;
}

// ---------------------------------------------------------------------------
//  Villageois
// ---------------------------------------------------------------------------
// Six habitants, chacun reconnaissable : c'est à eux qu'on parle, il faut pouvoir
// les distinguer de loin. Métier, gabarit, taille, palette, coiffe et idle
// varient ENSEMBLE — c'est le faisceau qui fait le personnage, pas la couleur de
// la chemise.
// ---------------------------------------------------------------------------
//  ÉCHELLE — à lire avant de toucher aux tailles
// ---------------------------------------------------------------------------
// Le monde n'est PAS à l'échelle métrique. La Camille d'origine, en primitives,
// mesure ~2,85 unités du sol au sommet du crâne : hauteur des portes, marches,
// rayons de collision, recul de caméra et taille des géants sont tous réglés
// là-dessus. Un personnage riggé posé à 1,72 « mètre » paraît donc minuscule à
// côté des maisons et des géants. Les hauteurs ci-dessous sont en UNITÉS DE JEU.
export const H_CAMILLE = 2.85;
const H_HUMAIN_REEL = 1.72;                       // pour convertir une taille en mètres
export const enUnites = (metres) => metres * (H_CAMILLE / H_HUMAIN_REEL);

// Palette flamande, teintures naturelles. Elle est donnée en TEINTES, pas en
// multiplicateurs : voir `recolorerMaillages` plus haut — l'atlas du pack est
// peint, et le multiplier écrasait tout vers le noir (un pantalon brun à 25 %
// de luminance passait à 13 %, d'où six villageois en pantalon noir).
const GARANCE = 0xa8402f, GUEDE = 0x3f5f86, GAUDE = 0xb8913c, NOIX = 0x7a5a3c,
      VERT_GRIS = 0x6d7a4a, BRIQUE = 0x8a3b28, ARDOISE = 0x5c636b;

const VILLAGEOIS = [
  { // la marchande de beurre — petite et ronde, coiffe et panier
    metier: 'marchande', gabarit: 'ronde', h: enUnites(1.58),
    tenue: 'tenues:Female_Peasant', corps: 'corps:Superhero_Female_FullBody',
    cheveux: 'coiffures_r:Hair_Buns', sourcils: 'coiffures_r:Eyebrows_Female', cheveuxC: 0x4a2f1a,
    haut: GARANCE, valeur: 0.95, bas: NOIX, valeurBas: 0.9, idle: 'Idle_Talking_Loop',
    tete: () => coiffe(LIN), bras: () => panier(), devant: () => tablier(LIN_SALE, false),
  },
  { // le brasseur — trapu, tablier de cuir, chapeau bas
    metier: 'brasseur', gabarit: 'trapu', h: enUnites(1.79),
    tenue: 'tenues:Male_Peasant', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_SimpleParted', sourcils: 'coiffures_r:Eyebrows_Regular', cheveuxC: 0x1a1210,
    haut: GUEDE, valeur: 0.9, bas: ARDOISE, valeurBas: 1.1, idle: 'Idle_FoldArms_Loop',
    tete: () => chapeau(0x3f3730, 0x6e5a3a, 0.145), devant: () => tablier(CUIR, true),
  },
  { // la lavandière — longue et mince, fichu clair, panier de linge
    metier: 'lavandiere', gabarit: 'mince', h: enUnites(1.66),
    tenue: 'tenues:Female_Peasant', corps: 'corps:Superhero_Female_FullBody',
    cheveux: 'coiffures_r:Hair_Long', sourcils: 'coiffures_r:Eyebrows_Female', cheveuxC: 0xc09a4e,
    haut: VERT_GRIS, valeur: 0.95, bas: LAINE, valeurBas: 1.25, idle: 'Farm_Watering',
    tete: () => coiffe(0xd5c9ad), epaules: () => fichu(LIN), bras: () => panier(),
  },
  { // le vieux garde — sec et voûté, chapeau à large bord, lanterne
    metier: 'guetteur', gabarit: 'sec', h: enUnites(1.70),
    tenue: 'tenues:Male_Peasant', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_Buzzed', sourcils: 'coiffures_r:Eyebrows_Regular',
    barbe: 'coiffures_r:Hair_Beard', cheveuxC: 0x9a958c,
    haut: NOIX, valeur: 1.05, bas: CUIR_FONCE, idle: 'Idle_Lantern_Loop',
    tete: () => chapeau(0x50453a, 0x3b3128, 0.185), main: () => lanterne(),
  },
  { // la garde champêtre — la seule en tenue de rôdeuse, capuche baissée
    metier: 'garde', gabarit: 'droite', h: enUnites(1.74),
    tenue: 'tenues:Female_Ranger', corps: 'corps:Superhero_Female_FullBody',
    cheveux: 'coiffures_r:Hair_BuzzedFemale', sourcils: 'coiffures_r:Eyebrows_Female', cheveuxC: 0x5a3a1a,
    haut: GAUDE, valeur: 0.92, bas: NOIX, valeurBas: 0.8, idle: 'Idle_No_Loop',
    tete: () => chapeau(0x5a4a33, 0x8a6a3a, 0.170), dos: () => besace(VERT_GRIS),
  },
  { // le bûcheron — grand et charpenté, hache, bonnet de laine
    metier: 'bucheron', gabarit: 'charpente', h: enUnites(1.86),
    tenue: 'tenues:Male_Peasant', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_SimpleParted', sourcils: 'coiffures_r:Eyebrows_Regular',
    barbe: 'coiffures_r:Hair_Beard', cheveuxC: 0x2a1a10,
    haut: BRIQUE, valeur: 0.48, bas: NOIX, valeurBas: 0.85, idle: 'TreeChopping_Loop',
    tete: () => bonnet(0x7d6b52), main: () => hache(),
  },
];

// Taille de référence pour la cadence de marche : à vitesse de déplacement
// égale, le petit doit poser plus de pas que le grand.
const H_REF = enUnites(1.72);

// ---------------------------------------------------------------------------
//  Les rôles de l'histoire, hors du village
// ---------------------------------------------------------------------------
// Eugène, le vieux mage, Gustave et ses clients étaient restés en primitives :
// à côté des villageois de la banque, ils faisaient figurine. Ils passent par la
// même fabrique, avec leurs propres fiches ; les accessoires reprennent ce qui les
// faisait reconnaître dans l'ancienne version (bonnet mou et bâton, tablier,
// haut-de-forme).
const POURPRE = 0x5a2a7a, ECRU = 0xe8e0d0, ROBE = 0x3a4a6a, BLANC_VIEUX = 0xe8e4dc;

/** Bonnet mou du mage, qui retombe sur le côté. */
function bonnetMou(couleur = ROBE) {
  const m = mat(couleur, { roughness: 0.95 });
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.098, 0.108, 0.06, 14), m, 0, 0, 0));
  const pointe = mesh(new THREE.ConeGeometry(0.095, 0.26, 12), m, 0.05, 0.1, -0.03);
  pointe.rotation.z = -0.6; pointe.rotation.x = 0.25; g.add(pointe);
  g.add(mesh(sphG(0.022, 8), mat(0xd8b44a, { roughness: 0.4 }), 0.14, 0.17, -0.07));
  return g;
}

/** Bâton noueux, pierre verte au sommet : tenu dans la main, il descend jusqu'au sol. */
function baton() {
  const bois = pbrRepeat(T.bark, 1, 3);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.55, 8), bois, 0, -0.5, 0));
  for (let k = 0; k < 3; k++) g.add(mesh(sphG(0.026, 7), bois, 0, -0.9 + k * 0.4, 0.012));
  g.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14), bois, 0, 0.3, 0).rotateY(Math.PI / 2));
  g.add(mesh(sphG(0.036, 12), mat(0x9ad44a, { emissive: 0x7ac030, emissiveIntensity: 1.4 }), 0, 0.3, 0));
  return g;
}

/** Haut-de-forme du client moustachu. */
function hautDeForme() {
  const m = mat(0x2a2a2a, { roughness: 0.8 });
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 18), m, 0, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.092, 0.1, 0.16, 16), m, 0, 0.08, 0));
  return g;
}

export const ROLES = {
  prince: {
    metier: 'prince', gabarit: 'droite', h: enUnites(1.80),
    tenue: 'tenues:Male_Ranger', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_SimpleParted', sourcils: 'coiffures_r:Eyebrows_Regular', cheveuxC: 0xc8a050,
    haut: POURPRE, valeur: 0.9, bas: ECRU, valeurBas: 1.25, idle: 'Idle_Loop',
    // Eugène n'est plus « le prince » (26 septembre) : ni couronne ni cape, un ami de Camille
  },
  mage: {
    metier: 'mage', gabarit: 'sec', h: enUnites(1.62),
    tenue: 'tenues:Male_Peasant', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_Long', sourcils: 'coiffures_r:Eyebrows_Regular',
    barbe: 'coiffures_r:Hair_Beard', cheveuxC: BLANC_VIEUX,
    haut: ROBE, valeur: 0.6, bas: ROBE, valeurBas: 0.7, idle: 'Idle_Loop',
    tete: () => bonnetMou(), bras: () => baton(),
  },
  // Gustave, au comptoir : trapu, tablier de toile, barbe brune
  aubergiste: {
    metier: 'aubergiste', gabarit: 'trapu', h: enUnites(1.76),
    tenue: 'tenues:Male_Peasant', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_SimpleParted', sourcils: 'coiffures_r:Eyebrows_Regular',
    barbe: 'coiffures_r:Hair_Beard', cheveuxC: 0x5a3a1a,
    haut: ECRU, valeur: 1.2, bas: NOIX, valeurBas: 0.85, idle: 'Idle_FoldArms_Loop',
    devant: () => tablier(LIN, true),
  },
  // les clients attablés, repris de l'ancienne version : barbu, moustachu au
  // haut-de-forme, blonde aux cheveux longs, et Séraphin le braconnier. Leurs couleurs
  // sont celles des villageois, valeur comprise : les teintes franches de l'ancienne
  // version, posées sur l'atlas du pack, donnaient du rose bonbon et du violet.
  client0: {
    metier: 'client', gabarit: 'trapu', h: enUnites(1.74),
    tenue: 'tenues:Male_Peasant', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_SimpleParted', sourcils: 'coiffures_r:Eyebrows_Regular',
    barbe: 'coiffures_r:Hair_Beard', cheveuxC: 0x5a3a1a, haut: BRIQUE, valeur: 0.55, bas: NOIX, valeurBas: 0.8, idle: 'Sitting_Idle_Loop',
  },
  client1: {
    metier: 'client', gabarit: 'sec', h: enUnites(1.78),
    tenue: 'tenues:Male_Peasant', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_Buzzed', sourcils: 'coiffures_r:Eyebrows_Regular', cheveuxC: 0x1a1210,
    haut: GUEDE, valeur: 0.9, bas: ARDOISE, valeurBas: 1, idle: 'Sitting_Idle_Loop', tete: () => hautDeForme(),
  },
  client2: {
    metier: 'client', gabarit: 'mince', h: enUnites(1.70),
    tenue: 'tenues:Female_Peasant', corps: 'corps:Superhero_Female_FullBody',
    cheveux: 'coiffures_r:Hair_Long', sourcils: 'coiffures_r:Eyebrows_Female', cheveuxC: 0xc8a060,
    haut: VERT_GRIS, valeur: 0.95, bas: LAINE, valeurBas: 1.1, idle: 'Sitting_Idle_Loop', epaules: () => fichu(LIN),
  },
  // le colporteur du marché : la rôdeuse d'homme, chapeau à large bord, besace au dos
  colporteur: {
    metier: 'colporteur', gabarit: 'sec', h: enUnites(1.76),
    tenue: 'tenues:Male_Ranger', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_SimpleParted', sourcils: 'coiffures_r:Eyebrows_Regular',
    barbe: 'coiffures_r:Hair_Beard', cheveuxC: 0x6a4a2a,
    haut: GARANCE, valeur: 0.7, bas: NOIX, valeurBas: 0.8, idle: 'Idle_Talking_Loop',
    tete: () => chapeau(0x3f3730, 0x9c3630, 0.19), dos: () => besace(OSIER),
  },
  braconnier: {
    metier: 'client', gabarit: 'sec', h: enUnites(1.72),
    tenue: 'tenues:Male_Ranger', corps: 'corps:Superhero_Male_FullBody',
    cheveux: 'coiffures_r:Hair_Buzzed', sourcils: 'coiffures_r:Eyebrows_Regular',
    barbe: 'coiffures_r:Hair_Beard', cheveuxC: 0x7a756c,
    haut: VERT_GRIS, valeur: 0.7, bas: NOIX, valeurBas: 0.8, idle: 'Sitting_Idle_Loop',
    tete: () => chapeau(0x50453a, 0x3b3128, 0.18), dos: () => besace(LIN_SALE),
  },
};

/**
 * Un rôle de l'histoire (voir ROLES). `haut` remplace la couleur de la tunique —
 * c'est ainsi que l'estaminet habille ses clients. Null si la banque manque : l'appelant
 * garde sa version en primitives.
 */
export function buildRole(nom, haut = null) {
  const v = ROLES[nom];
  if (!pret || !v) return null;
  return fabriquer(haut === null ? v : { ...v, haut, valeur: v.valeur ?? 1 }, -1);
}

const clipsPNJ = () => tousClips(
  CLIP.marche, CLIP.marcheLente, CLIP.repos, CLIP.garde, CLIP.parle, CLIP.assis,
  VILLAGEOIS.map(v => v.idle), Object.values(ROLES).map(v => v.idle),
  ['Idle_FoldArms_Loop', 'Idle_No_Loop', 'Farm_Watering', 'Idle_Lantern_Loop',
   'Idle_Talking_Loop', 'Idle_Torch_Loop', 'TreeChopping_Loop'],
);

/**
 * Construit un villageois. Renvoie un Group ; l'animation arrive de façon
 * asynchrone dans `userData.ctrl` (le contrôleur attend les clips).
 */
export function buildVillageois(kind) {
  if (!pret) return null;
  return fabriquer(VILLAGEOIS[kind % VILLAGEOIS.length], kind);
}

function fabriquer(v, kind) {
  const tenue = aLAsset(v.tenue) ? v.tenue
    : (aLAsset('tenues:Female_Peasant') && /Female/.test(v.corps) ? 'tenues:Female_Peasant' : 'tenues:Male_Peasant');
  const g = new THREE.Group();
  const perso = A.spawn(tenue, {});
  materiauxPropres(perso);
  g.add(perso);
  g.userData.perso = perso;

  // carrure AVANT la mise à l'échelle (cf. le commentaire de carrure())
  if (v.gabarit && GABARITS[v.gabarit]) carrure(perso, GABARITS[v.gabarit]);

  // mise à l'échelle par l'os de la tête : la boîte d'un maillage skinné ment
  {
    perso.scale.setScalar(1);
    perso.updateWorldMatrix(true, true);
    const tete = perso.userData.os && perso.userData.os.Head;
    const hRef = tete ? tete.getWorldPosition(new THREE.Vector3()).y + 0.12 : 1.8;
    perso.scale.setScalar(v.h / hRef);
    perso.updateWorldMatrix(true, true);
  }

  A.greffeTete(A.spawn(v.corps, {}), perso);
  // la capuche de la rôdeuse fait un aventurier de fantasy, pas une villageoise
  perso.traverse(o => { if (/Head_Hood/i.test(o.name || '')) o.visible = false; });
  // rebind() REPARENTE les maillages hors du groupe source : il faut donc
  // récupérer les matériaux AVANT, sinon on teint un groupe devenu vide.
  const greffe = (id, couleur) => {
    if (!id || !aLAsset(id)) return;
    const p = A.spawn(id, {});
    const mats = materiauxPropres(p);
    if (A.rebind(p, perso)) for (const m of mats) m.color.setHex(couleur);
  };
  greffe(v.cheveux, v.cheveuxC); greffe(v.sourcils, v.cheveuxC); greffe(v.barbe, v.cheveuxC);

  // TEINTE, pas multiplication : l'atlas du pack est peint (chemise écrue,
  // pantalon brun, cuirs). Le multiplier détruisait justement ce qui en faisait
  // le prix — voir recolorerMaillages().
  recolorerMaillages(perso, [
    [/Body_Belt|Bracer|Pauldron/i, CUIR],          // cuirs et ferrures : avant Body, plus spécifique
    [/_Body$/i, v.haut, v.valeur],
    [/_Head_Hood$/i, v.haut, v.valeur],
    [/_Legs$/i, v.bas, v.valeurBas],
    [/_Arms_1$/i, v.haut, v.valeur],                // manche ; _Arms_2 est la peau nue
  ]);

  // ---------- accessoires ----------
  // `base` : socket() garde l'échelle propre de l'objet, et ces pièces sont
  // dessinées dans le repère de l'os (un crâne fait ~0,10 de rayon).
  if (v.tete) socket(g, perso, 'Head', v.tete(), [0.027, 0.172, -0.055]);
  if (v.epaules) socket(g, perso, 'spine_03', v.epaules(), [0.025, 0.150, 0.004]);
  if (v.devant) socket(g, perso, 'pelvis', v.devant(), [0.015, 0.045, 0.115], [0, 0, 0], false);
  if (v.dos) socket(g, perso, 'spine_03', v.dos(), [0.025, 0.09, -0.125]);
  if (v.bras) socket(g, perso, 'hand_l', v.bras(), [0, 0.05, 0.02], [0.2, 0, 0]);
  if (v.main) socket(g, perso, 'hand_r', v.main(), [0, 0.05, 0.025], [Math.PI - 0.25, 0, 0]);

  g.userData.dynamic = true;
  g.userData.kind = kind;
  g.userData.metier = v.metier;
  g.userData.hauteur = v.h;
  // l'idle demandé peut venir de l'un ou l'autre volume ; s'il manque, on retombe
  // sur le repos neutre plutôt que de laisser le personnage figé en croix.
  const idleOk = banque && banque.clips.has(v.idle);
  g.userData.idle = idleOk ? v.idle : CLIP.repos;
  g.userData.pas = v.pas || CLIP.marche;
  // Six habitants sur le même clip marchaient au pas cadencé, comme une escouade
  // à la parade. Chacun reçoit donc son rythme propre et sa phase de départ.
  g.userData.rythme = 0.9 + Math.random() * 0.2;
  g.userData.cadence = H_REF / v.h;                // le petit pose plus de pas que le grand
  // `userData.anim` est déjà pris par le jeu (phase du ballant procédural) :
  // le contrôleur va dans `ctrl`.
  controleur(g, perso, clipsPNJ(), g.userData.idle).then(c => {
    g.userData.ctrl = c;
    c.mixer.setTime(Math.random() * 4);            // deux voisins jamais sur la même image
  });
  return g;
}

/** Choisit le clip d'un villageois d'après son état, et avance son mixer. */
export function animeVillageois(v, dt, enMarche) {
  const a = v.userData.ctrl;
  if (!a) return false;
  const ud = v.userData;
  let act;
  if (ud.talk > 0) act = a.jouer(CLIP.parle, 0.25);
  else if (enMarche) act = a.jouer(ud.pas || CLIP.marche, 0.3);
  else act = a.jouer(ud.idle, 0.4);
  // La foulée suit la taille : à 1,6 unité/s pour tout le monde, un villageois de
  // 2,6 unités qui joue le même cycle qu'un de 3,1 glisse d'un bon quart.
  if (act) {
    const ts = (ud.rythme || 1) * (enMarche ? (ud.cadence || 1) : 1);
    if (act.timeScale !== ts) act.timeScale = ts;
  }
  a.update(dt);
  return true;
}

// ---------------------------------------------------------------------------
//  Les armes et les armures de Camille (et de l'équipement du multi)
// ---------------------------------------------------------------------------
// Eugène (27 septembre) : « l'armure et le bouclier sont vraiment pas beaux ». Ils étaient
// faits de primitives unies — un cylindre, un disque, un losange. Ils gagnent ici ce qui
// fait lire l'objet de loin : une silhouette juste (lame biseautée à gouttière, garde
// courbe ; écu en pointe bombé ; cuirasse galbée) et un décor peint, flamand de préférence :
// la rondache de Camille porte les armes de Lille (la fleur de lys d'argent sur gueules),
// l'écu de la garnison celles de France (trois lys d'or sur azur). Les peintures sont des
// canevas faits une fois pour toutes. Chaque bouclier a sa face peinte vers +z.
const canevas = (w, h, f, apres) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (apres) apres(t); return t;
};
const unique = (f) => { let v = null; return () => (v ||= f()); };

/** La fleur de lys héraldique, dans une boîte de côté h centrée en (cx, cy). */
function lys(x, cx, cy, h, fond, trait) {
  const P = (u, v) => [cx + (u - 0.5) * h, cy + (v - 0.5) * h];
  const chemin = (f) => { x.beginPath(); f(); x.closePath(); x.fillStyle = fond; x.fill(); x.lineWidth = h * 0.022; x.strokeStyle = trait; x.stroke(); };
  const bz = (a, b, c) => x.bezierCurveTo(...P(...a), ...P(...b), ...P(...c));
  for (const s of [-1, 1]) {                       // les pétales de côté, qui s'enroulent vers le bas
    const u = (v) => 0.5 + s * (v - 0.5);
    chemin(() => { x.moveTo(...P(u(0.53), 0.56)); bz([u(0.64), 0.28], [u(0.96), 0.2], [u(0.93), 0.46]);
      bz([u(0.91), 0.6], [u(0.8), 0.62], [u(0.76), 0.52]); bz([u(0.72), 0.6], [u(0.62), 0.62], [u(0.56), 0.6]); });
    chemin(() => { x.moveTo(...P(u(0.53), 0.66)); bz([u(0.62), 0.72], [u(0.72), 0.8], [u(0.7), 0.94]);
      bz([u(0.62), 0.86], [u(0.56), 0.8], [u(0.51), 0.76]); });
  }
  chemin(() => { x.moveTo(...P(0.5, 0.03)); bz([0.64, 0.18], [0.62, 0.42], [0.54, 0.6]); x.lineTo(...P(0.46, 0.6));
    bz([0.38, 0.42], [0.36, 0.18], [0.5, 0.03]); });                      // le pétale du milieu, en fer de lance
  chemin(() => { x.moveTo(...P(0.5, 0.63)); x.lineTo(...P(0.45, 0.76)); x.lineTo(...P(0.5, 0.9)); x.lineTo(...P(0.55, 0.76)); });
  chemin(() => { x.rect(...P(0.3, 0.58), 0.4 * h, 0.07 * h); });          // la bande qui lie les pétales
}
// le fil du bois sous la peinture, et l'usure : sans eux, la peinture fait plastique
function boisPeint(x, w, h, couleur, planches) {
  x.fillStyle = couleur; x.fillRect(0, 0, w, h);
  for (let i = 1; i < planches; i++) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(i * w / planches - 1, 0, 2, h); }
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,220'},${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 6 + Math.random() * 30); }
}
// L'usure : une peinture de bouclier neuve lit comme un jouet. Des rayures claires (le bois
// mis à nu), des écailles, la crasse qui s'amasse vers les bords.
function user(x, w, h, rond) {
  for (let k = 0; k < 140; k++) {                                  // rayures et écailles
    const cx = Math.random() * w, cy = Math.random() * h, l = 6 + Math.random() * 40, a = Math.random() * Math.PI;
    x.strokeStyle = `rgba(${Math.random() < 0.6 ? '150,112,70' : '40,28,18'},${0.25 + Math.random() * 0.4})`; x.lineWidth = 1 + Math.random() * 2.5;
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke();
  }
  const g = rond ? x.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.52) : x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(20,14,8,0)'); g.addColorStop(1, 'rgba(20,14,8,0.45)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}
const texRondache = unique(() => canevas(512, 512, (x, w, h) => {
  boisPeint(x, w, h, '#7c2a22', 6);                                  // un gueules passé, pas un rouge de jouet
  lys(x, w / 2, h / 2 + 6, h * 0.66, '#cfc8b8', '#3e140f');
  x.strokeStyle = '#b8964a'; x.lineWidth = 10; x.beginPath(); x.arc(w / 2, h / 2, w * 0.455, 0, TAU); x.stroke();
  user(x, w, h, true);
}, (t) => { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }));      // le couvercle du disque tourne la peinture d'un quart
const texEcu = unique(() => canevas(512, 704, (x, w, h) => {
  boisPeint(x, w, h, '#26406a', 5);
  const or = '#bf9c46', trait = '#4a3510';
  lys(x, w * 0.29, h * 0.3, w * 0.36, or, trait); lys(x, w * 0.71, h * 0.3, w * 0.36, or, trait); lys(x, w * 0.5, h * 0.62, w * 0.38, or, trait);
  user(x, w, h, false);
}));
const texCuir = unique(() => canevas(256, 256, (x, w, h) => {
  x.fillStyle = '#6b4424'; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,15,5' : '160,110,70'},${Math.random() * 0.12})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  x.strokeStyle = 'rgba(230,200,150,.55)'; x.setLineDash([5, 5]); x.lineWidth = 2;        // les coutures
  for (const y of [8, h / 2, h - 8]) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
  x.setLineDash([]);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {                               // les clous de laiton
    const cx = (k + 0.5 + (r % 2) * 0.5) * w / 4, cy = (r + 0.5) * h / 4 + 10;
    const gr = x.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 8); gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.5, '#c99a33'); gr.addColorStop(1, '#4a3510');
    x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, 7, 0, TAU); x.fill();
  }
}));
const texMailles = unique(() => canevas(256, 256, (x, w, h) => {
  x.fillStyle = '#202328'; x.fillRect(0, 0, w, h);
  for (let r = 0; r < 16; r++) for (let k = 0; k < 17; k++) {               // des anneaux imbriqués, rang sur rang
    const cx = k * 16 + (r % 2) * 8, cy = r * 16 + 8;
    x.strokeStyle = '#9aa0a8'; x.lineWidth = 3.2; x.beginPath(); x.ellipse(cx, cy, 7, 5.5, 0, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(cx, cy, 7, 5.5, 0, Math.PI * 1.1, Math.PI * 1.6); x.stroke();
  }
}));
const texPlates = unique(() => canevas(256, 256, (x, w, h) => {
  const lames = 4;
  for (let i = 0; i < lames; i++) {                                        // des lames qui se recouvrent
    const y0 = i * h / lames, gr = x.createLinearGradient(0, y0, 0, y0 + h / lames);
    gr.addColorStop(0, '#b9c0c9'); gr.addColorStop(0.5, '#7d858f'); gr.addColorStop(1, '#3f444b');   // acier bruni, pas chromé
    x.fillStyle = gr; x.fillRect(0, y0, w, h / lames);
    x.fillStyle = '#c9a03a'; x.fillRect(0, y0 + h / lames - 5, w, 3);           // le liseré de laiton
    for (let k = 0; k < 6; k++) { x.fillStyle = '#e9d27a'; x.beginPath(); x.arc((k + 0.5) * w / 6, y0 + 8, 3.2, 0, TAU); x.fill(); }
  }
  for (let k = 0; k < 400; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; x.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 1); }
}));

/** L'épée de Camille : lame biseautée à gouttière, garde courbe, fusée gainée, pommeau en disque. */
export function faireEpee() {
  const e = new THREE.Group();
  // de la vraie plaque de métal (Poly Haven) : rayures et reflets cassés, pas un chrome lisse
  const acier = phMat('metal_plate_02', 0.12, 0.9, { color: 0xe6ebf0, roughness: 0.4 });
  const laiton = phMat('metal_plate_02', 0.2, 0.2, { color: 0xd4a94a, roughness: 0.45 });
  const forme = new THREE.Shape();
  forme.moveTo(-0.024, 0.06); forme.lineTo(-0.021, 0.6); forme.lineTo(0, 0.73); forme.lineTo(0.021, 0.6); forme.lineTo(0.024, 0.06); forme.closePath();
  const geo = new THREE.ExtrudeGeometry(forme, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 });
  geo.translate(0, 0, -0.002); e.add(new THREE.Mesh(geo, acier));
  for (const z of [-0.0065, 0.0065]) e.add(mesh(boxG(0.009, 0.44, 0.002), phMat('metal_plate_02', 0.05, 0.5, { color: 0x8a919a }), 0, 0.32, z));   // la gouttière
  const courbe = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.1, 0.075, 0), new THREE.Vector3(0, 0.035, 0), new THREE.Vector3(0.1, 0.075, 0));
  e.add(new THREE.Mesh(new THREE.TubeGeometry(courbe, 12, 0.011, 6), laiton));
  for (const s of [-1, 1]) e.add(mesh(sphG(0.017, 8), laiton, s * 0.1, 0.077, 0));
  e.add(mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.11, 10), phMat('wood_cabinet_worn_long', 0.1, 0.1, { color: 0x3b2616 }), 0, -0.015, 0));   // le cuir de la fusée
  for (let k = 0; k < 4; k++) e.add(mesh(new THREE.TorusGeometry(0.018, 0.003, 4, 12), mat(0x24160c), 0, -0.06 + k * 0.03, 0).rotateX(Math.PI / 2));
  e.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.017, 16), laiton, 0, -0.085, 0).rotateX(Math.PI / 2));
  e.add(mesh(sphG(0.011, 8), laiton, 0, -0.1, 0));
  e.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return e;
}

/** La rondache : bois peint aux armes de Lille, légèrement bombée, cerclée de fer. */
export function faireRondache() {
  const b = new THREE.Group();
  // la peinture posée sur de vrai bois : le grain et les joints des planches restent
  const R = 0.19, face = phPeint('wood_planks', 0.4, 0.4, texRondache(), { roughness: 0.85 });
  const dos = phMat('wood_planks', 0.4, 0.4, { color: 0x8a6a48 });
  const disque = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.02, 32), [dos, face, dos]);
  disque.rotation.x = Math.PI / 2; b.add(disque);                  // la face peinte (le couvercle haut) vers +z
  const fer = phMat('metal_plate_02', 0.2, 0.2, { color: 0x6a6e74 });
  b.add(mesh(new THREE.TorusGeometry(R, 0.012, 6, 32), fer, 0, 0, 0));
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.add(mesh(sphG(0.009, 6), fer, Math.cos(a) * (R - 0.02), Math.sin(a) * (R - 0.02), 0.012)); }
  b.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return b;
}

/** L'écu en pointe de la garnison. Niveau 2 (la forge) : cerclé de fer, avec un umbo. */
export function faireEcu() {
  const e = new THREE.Group();
  const forme = new THREE.Shape();
  forme.moveTo(-0.17, 0.2); forme.lineTo(0.17, 0.2); forme.lineTo(0.17, 0.02);
  forme.quadraticCurveTo(0.15, -0.18, 0, -0.27); forme.quadraticCurveTo(-0.15, -0.18, -0.17, 0.02); forme.closePath();
  const geo = new THREE.ExtrudeGeometry(forme, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 2 });
  geo.translate(0, 0, -0.007);
  const t = texEcu().clone(); t.needsUpdate = true;
  t.repeat.set(1 / 0.34, 1 / 0.47); t.offset.set(0.5, 0.27 / 0.47);          // UV des faces = coordonnées de la forme
  const peint = phPeint('wood_planks', 0.34, 0.47, t, { roughness: 0.85 }), chant = phMat('wood_cabinet_worn_long', 0.3, 0.3, { color: 0x6a4a30 });
  e.add(new THREE.Mesh(geo, [peint, chant]));
  const cercle = new THREE.Group(); cercle.visible = false;
  const pts = forme.getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, 0.014));
  const ferE = phMat('metal_plate_02', 0.2, 0.2, { color: 0x6a6e74 });
  cercle.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.011, 6, true), ferE));
  cercle.add(mesh(sphG(0.034, 14, 8), phMat('metal_plate_02', 0.1, 0.1, { color: 0xc8ced6 }), 0, 0.02, 0.012));   // l'umbo, d'acier clair : il ne mange pas les lys
  for (const [px, py] of [[-0.12, 0.15], [0.12, 0.15], [-0.1, -0.08], [0.1, -0.08]]) cercle.add(mesh(sphG(0.01, 6), ferE, px, py, 0.016));
  e.add(cercle); e.userData.cercle = cercle;
  e.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return e;
}

/** La cuirasse galbée, et ses trois matières : cuir clouté, mailles, plates. */
// Les dessins (coutures et clous, anneaux, lames) sur de vraies matières : le cuir sur le
// bois patiné (son relief imite le cuir tanné), les mailles et les plates sur la plaque de
// métal — rayures et reflets cassés au lieu d'un plastique lisse.
const MATS_CUIRASSE = unique(() => {
  const d = (m) => { m.side = THREE.DoubleSide; return m; };
  const mailles = texMailles().clone(); mailles.needsUpdate = true; mailles.wrapS = mailles.wrapT = THREE.RepeatWrapping; mailles.repeat.set(5, 2);
  return [null,
    d(phPeint('wood_cabinet_worn_long', 0.4, 0.4, texCuir(), { roughness: 0.8 })),
    d(phPeint('metal_plate_02', 0.25, 0.25, mailles, { roughness: 0.55 })),
    d(phPeint('metal_plate_02', 0.6, 0.6, texPlates(), { roughness: 0.42 })),
  ];
});
export function faireCuirasse(niveau = 1) {
  const c = new THREE.Group();
  const m = MATS_CUIRASSE()[niveau];
  // le buste, du bas vers le col : taille, poitrine, épaules, col
  const profil = [[0.165, -0.24], [0.172, -0.16], [0.192, -0.06], [0.207, 0.04], [0.2, 0.11], [0.178, 0.16], [0.125, 0.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const buste = new THREE.Mesh(new THREE.LatheGeometry(profil, 28), m); buste.scale.z = 0.8; buste.position.z = 0.02; c.add(buste);
  const braconniere = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.17, -0.235), new THREE.Vector2(0.2, -0.33)], 28), m);   // la jupe de lames
  braconniere.scale.z = 0.82; braconniere.position.z = 0.02; c.add(braconniere);
  c.add(mesh(new THREE.TorusGeometry(0.115, 0.018, 8, 20), m, 0, 0.19, 0.02).rotateX(Math.PI / 2));            // le colletin
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {                    // les épaulières, deux lames
    const ep = new THREE.Mesh(new THREE.SphereGeometry(0.105 - k * 0.012, 14, 8, 0, TAU, 0, Math.PI / 2), m);
    ep.position.set(sx * (0.19 + k * 0.02), 0.13 - k * 0.045, 0.005); ep.scale.set(1.1, 0.62, 1.05); ep.rotation.z = -sx * (0.35 + k * 0.25); c.add(ep);
  }
  c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  c.userData.niv = niveau;
  c.userData.changer = (n) => { if (n === c.userData.niv || !n) return; c.userData.niv = n; const nm = MATS_CUIRASSE()[n]; c.traverse((o) => { if (o.isMesh) o.material = nm; }); };
  return c;
}

// ---------------------------------------------------------------------------
//  Camille
// ---------------------------------------------------------------------------
// Choix assumé : on garde son identité. Base rôdeuse SANS capuche, reteintée à
// son bleu, cheveux bruns, et on refait en géométrie ce qu'aucun pack ne donne —
// foulard rouge, baudrier à rivets, bourse. L'épée, le bouclier et l'arc sont
// accrochés aux os par sockets, donc ils suivent vraiment la main et l'avant-bras.
const clipsCamille = () => tousClips(
  CLIP.repos, CLIP.garde, CLIP.marche, CLIP.course, CLIP.saut, CLIP.sautDepart, CLIP.sautFin,
  CLIP.roulade, CLIP.touche, CLIP.parle, CLIP.assis, CLIP.genou, CLIP.joie, CLIP.couche, CLIP.arc,
  CLIP.coups, ['Sword_Block'],
);

export function buildCamille(makeBow) {
  if (!pret) return null;
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  // La roulade fait tourner tout le personnage : on garde un pivot, comme la
  // version en primitives, pour ne rien casser dans updatePlayer().
  const pivot = new THREE.Group(); root.add(pivot);
  const g = new THREE.Group(); pivot.add(g);

  const perso = A.spawn('tenues:Female_Ranger', {});
  materiauxPropres(perso);
  g.add(perso);
  g.userData.perso = perso;
  {
    const tete = perso.userData.os && perso.userData.os.Head;
    perso.updateWorldMatrix(true, true);
    const hRef = tete ? tete.getWorldPosition(new THREE.Vector3()).y + 0.12 : 1.8;
    perso.scale.setScalar(H_CAMILLE / hRef);
  }
  // la capuche cache le visage : Camille se montre à découvert
  perso.traverse(o => { if (/Head_Hood/i.test(o.name || '')) o.visible = false; });

  A.greffeTete(A.spawn('corps:Superhero_Female_FullBody', {}), perso);
  const greffe = (id, couleur) => {
    if (!id || !aLAsset(id)) return;
    const p = A.spawn(id, {});
    const mats = materiauxPropres(p);
    if (A.rebind(p, perso)) for (const m of mats) m.color.setHex(couleur);
  };
  greffe('coiffures_r:Hair_SimpleParted', 0x4a2f1a);
  greffe('coiffures_r:Eyebrows_Female', 0x3a2414);

  const BLEU = 0x3f7fa8, CUIR = 0x9a7048, TOILE = 0x8a7550;
  // la tunique de la rôdeuse est peinte en vert : il faut lui changer la teinte,
  // pas la multiplier, sinon Camille reste verte quoi qu'on fasse.
  recolorerMaillages(perso, [
    [/_Body$/i, BLEU],
    [/_Arms_1$/i, BLEU],
    [/_Legs$/i, TOILE],          // le pantalon du pack est presque noir : même traitement
  ]);
  teindreMaillages(perso, [
    [/Body_Belt|Bracer|Pauldron/i, CUIR],
    [/_Feet/i, CUIR],
  ]);

  // ---------- ce que le pack ne donne pas ----------
  const laine = mat(0x9c3630, { roughness: 0.95 });
  const cuir = mat(0x6a4526, { roughness: 0.7 });
  // foulard : un tore au col plus deux pans qui tombent dans le dos
  const foulard = new THREE.Group();
  foulard.add(mesh(new THREE.TorusGeometry(0.075, 0.028, 8, 16), laine, 0, 0, 0).rotateX(Math.PI / 2));
  for (const sx of [-1, 1]) {
    const pan = mesh(boxG(0.055, 0.22, 0.016), laine, sx * 0.035, -0.11, -0.055);
    pan.rotation.x = -0.25; pan.rotation.z = sx * 0.12; foulard.add(pan);
  }
  socket(g, perso, 'neck_01', foulard, [0, 0.02, 0.005]);
  // baudrier + bourse, sur le buste
  const baudrier = new THREE.Group();
  const sangle = mesh(boxG(0.055, 0.46, 0.018), cuir, 0.01, 0.06, 0.088);
  sangle.rotation.z = 0.55; baudrier.add(sangle);
  for (let k = 0; k < 4; k++) baudrier.add(mesh(sphG(0.008, 6), GOLD(), -0.10 + k * 0.07, -0.05 + k * 0.10, 0.095));
  socket(g, perso, 'spine_03', baudrier, [0, 0, 0]);
  const bourse = new THREE.Group();
  bourse.add(mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.075, 10), cuir, 0, 0, 0));
  bourse.add(mesh(new THREE.TorusGeometry(0.046, 0.009, 6, 12), cuir, 0, 0.04, 0).rotateX(Math.PI / 2));
  socket(g, perso, 'pelvis', bourse, [0.115, 0.06, 0.03], [0, 0, 0], false);

  // ---------- armes (cf. « Les armes et les armures de Camille », plus haut) ----------
  const epee = faireEpee();
  socket(g, perso, 'hand_r', epee, [0, 0.03, 0.015], [-0.18, 0, 0]);
  // les boucliers ont leur face peinte vers +z : au bras, elle regarde donc dehors à −π/2
  const bouclier = faireRondache();
  socket(g, perso, 'lowerarm_l', bouclier, [0.02, 0.10, -0.05], [0, -Math.PI / 2, 0]);

  // ---------- l'équipement du multi (tloc-multi.js) ----------
  // L'écu remplace la rondache quand on l'a ramassé. Il y en a deux : l'un au bras, l'autre
  // tenu devant la poitrine quand on lève la garde (le clip Sword_Block lève l'épée, pas
  // l'avant-bras gauche : l'écu du bras restait sur le côté).
  const ecu = faireEcu(), ecuGarde = faireEcu(); ecu.visible = ecuGarde.visible = false;
  socket(g, perso, 'lowerarm_l', ecu, [0.03, 0.10, -0.06], [0, -Math.PI / 2, 0]);
  socket(g, perso, 'spine_03', ecuGarde, [0.07, 0.02, 0.27], [0.12, 0.3, 0]);
  const cuirasse = faireCuirasse(1); cuirasse.visible = false;
  socket(g, perso, 'spine_03', cuirasse, [0, -0.02, 0]);

  const arc = makeBow ? makeBow() : null;
  if (arc) { arc.scale.setScalar(0.26); arc.visible = false; socket(g, perso, 'hand_l', arc, [0, 0.06, 0], [0, Math.PI / 2, 0]); }
  const arcDos = makeBow ? makeBow() : null;
  if (arcDos) { arcDos.scale.setScalar(0.26); arcDos.visible = false; socket(g, perso, 'spine_03', arcDos, [0, 0.04, -0.10], [0.2, 0, 0.55]); }

  root.userData = {
    dynamic: true, pivot, perso, groupe: g,
    os: perso.userData.os || {},
    sockets: g.userData.sockets,
    epee, bouclier, arc, arcDos, ecu, ecuGarde, cuirasse,
  };
  // les sockets vivent sur `g` : majSockets(g) est appelé par le contrôleur
  controleur(g, perso, clipsCamille(), CLIP.repos).then(c => { root.userData.ctrl = c; });
  return root;
}

/**
 * Traduit l'état du joueur en clip. Renvoie false si Camille n'est pas riggée,
 * pour que engine.js reprenne son animation en primitives.
 */
// À cheval. La pose assise est celle d'une chaise : genoux joints devant soi. Ajouter des
// angles aux os par-dessus faisait partir les pieds n'importe où (Eugène, 27 septembre) :
// l'orientation propre de chaque os dépend du squelette et de l'image du clip. On VISE
// donc, après le mixer : chaque segment de jambe est tourné pour pointer une direction
// donnée dans le repère du personnage (x vers sa gauche, y en haut, z devant) — la cuisse
// en avant et en dehors, le bas de la jambe le long du flanc, le pied devant.
export const MONTE = {
  cuisse: [0.42, -0.55, 0.62], mollet: [0.14, -1, -0.12], pied: [0.12, -0.3, 1],
};
const _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3(), _vw = new THREE.Vector3();
const _qd = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qpa = new THREE.Quaternion(), _qra = new THREE.Quaternion();
function viser(os, enfant, dir, sx) {
  if (!os || !enfant) return;
  os.updateMatrixWorld(true);
  os.getWorldPosition(_v0); enfant.getWorldPosition(_v1);
  const cur = _v1.sub(_v0).normalize();
  _vw.set(dir[0] * sx, dir[1], dir[2]).normalize().applyQuaternion(_qra);
  _qd.setFromUnitVectors(cur, _vw);
  os.getWorldQuaternion(_qw); _qw.premultiply(_qd);
  os.parent.getWorldQuaternion(_qpa);
  os.quaternion.copy(_qpa.invert().multiply(_qw));
  os.updateMatrixWorld(true);
}
function enfourcher(os, racine) {
  racine.getWorldQuaternion(_qra);
  for (const [c, sx] of [['l', 1], ['r', -1]]) {
    viser(os['thigh_' + c], os['calf_' + c], MONTE.cuisse, sx);
    viser(os['calf_' + c], os['foot_' + c], MONTE.mollet, sx);
    viser(os['foot_' + c], os['ball_' + c], MONTE.pied, sx);
  }
}

export function animeCamille(m, p, dt, ctx) {
  const ud = m.userData, a = ud.ctrl;
  if (!a) return false;
  const { walking, running, drawing, bowOut, pose } = ctx;

  // à cheval : la pose assise, remontée à la hauteur de la selle par le pivot (la racine,
  // elle, suit le joueur — ou glisse vers la position annoncée, pour un avatar distant)
  if (ud.pivot) ud.pivot.position.y = ctx.monte ? (ctx.selle || 0) / (m.scale.y || 1) : 0;
  if (pose) a.jouer({ lie: CLIP.couche, kneel: CLIP.genou, sit: CLIP.assis, cheer: CLIP.joie }[pose] || CLIP.repos, 0.3);
  else if (ctx.monte && p.attackT < 0) a.jouer(CLIP.assis, 0.25);
  else if (p.rollT >= 0 && CLIP.roulade) a.jouer(CLIP.roulade, 0.06, false);
  else if (p.attackT >= 0 && CLIP.coups.length) {
    // les coups alternent : un enchaînement, pas un moulinet identique
    const n = CLIP.coups[(ud.coup |= 0) % CLIP.coups.length];
    if (a.nom !== n) a.jouer(n, 0.06, false);
  } else if (ctx.garde) a.jouer('Sword_Block', 0.12);
  else if (p.invuln > 0.55) a.jouer(CLIP.touche, 0.08, false);
  else if (drawing || bowOut) a.jouer(CLIP.arc, 0.18);
  else if (!p.onGround) a.jouer(CLIP.saut, 0.14);
  else if (running) a.jouer(CLIP.course, 0.2);
  else if (walking) a.jouer(CLIP.marche, 0.22);
  else a.jouer(ctx.epeeSortie ? CLIP.garde : CLIP.repos, 0.35);

  if (p.attackT < 0 && ud.coupArme) { ud.coup = (ud.coup | 0) + 1; ud.coupArme = false; }
  if (p.attackT >= 0) ud.coupArme = true;

  // visibilité des accessoires, puis on repose les sockets
  if (ud.epee) ud.epee.visible = ctx.epeeSortie && !(drawing || bowOut);
  if (ud.bouclier) ud.bouclier.visible = ctx.epeeSortie && !(drawing || bowOut) && !ctx.bouclier;
  if (ud.ecu) {
    ud.ecu.visible = !!ctx.bouclier && !ctx.garde && !(drawing || bowOut); ud.ecuGarde.visible = !!ctx.bouclier && !!ctx.garde;
    ud.ecu.userData.cercle.visible = ud.ecuGarde.userData.cercle.visible = ctx.bouclier > 1;
  }
  if (ud.cuirasse) { ud.cuirasse.visible = ctx.armure > 0; ud.cuirasse.userData.changer(ctx.armure); }   // cuir, mailles, plates
  if (ud.arc) ud.arc.visible = !!(drawing || bowOut);
  if (ud.arcDos) ud.arcDos.visible = ctx.arcTrouve && !(drawing || bowOut);
  a.update(dt);
  if (ctx.monte) {
    // LA FRAPPE EN SELLE. Les coups d'épée sont des clips debout : le bassin y est à hauteur
    // d'homme, un demi-mètre au-dessus de celui de la pose assise — Camille se dressait
    // au-dessus du cheval à chaque coup. On garde donc le bassin où la pose assise le met
    // (relevé tant qu'elle est assise), et les jambes en selle : le buste et le bras jouent
    // le coup, le reste reste en selle.
    const bassin = ud.os.pelvis;
    if (bassin) {
      if (p.attackT < 0) (ud.bassinAssis ||= new THREE.Vector3()).copy(bassin.position);
      else if (ud.bassinAssis) bassin.position.copy(ud.bassinAssis);
    }
    enfourcher(ud.os, m);
  }
  return true;
}

/**
 * Remplace Camille par sa version riggée, dans n'importe quel niveau.
 * À appeler AVANT bootLevel(). Ne fait rien (et renvoie false) si la banque
 * d'assets manque : le niveau garde la Camille en primitives.
 */
export async function installerCamille(E) {
  if (!pret && !(await prepare())) return false;
  const m = buildCamille(E.makeBow);
  if (!m) return false;
  E.setPlayerMesh(m);
  E.setCamilleHook(animeCamille);
  return true;
}
