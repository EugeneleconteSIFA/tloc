// look.js — l'apparence de Camille : teint, cheveux, coiffure, tenue, carrure.
//
// Réglée devant l'armoire de sa chambre (house.js), rangée dans `state.look`, donc
// sauvegardée et rechargée sans rien ajouter au système de sauvegarde. Un veilleur la
// repose sur le maillage : le moteur reconstruit Camille à chaque page, l'apparence suit.
//
// Deux Camille peuvent se présenter, et les deux sont servies :
//   — celle en primitives (makeCamille) : ses matériaux se reconnaissent à leur couleur
//     d'origine, et la tête se reconstruit entièrement (coiffure, yeux) ;
//   — celle de la banque d'assets (pnj.js, riggée) : ses maillages se reconnaissent à
//     leur NOM (_Body, _Legs, Hair…), et la coiffure se regreffe depuis la banque.

import {
  G, SFX, THREE, camera, makeHead, player, saveGame, showMessage, state,
} from './engine.js?v=27';

// =====================================================================
//  Les palettes — indices rangés dans la sauvegarde, pas des couleurs
// =====================================================================
const P = (nom, hex) => ({ nom, hex });

export const PEAU = [
  P('Clair', 0xf0c9a8), P('Doré', 0xd8a986), P('Hâlé', 0xc08a62),
  P('Ambré', 0x9a6440), P('Sombre', 0x6f4429), P('Ébène', 0x4a2c1c),
];
export const CHEVEUX = [
  P('Châtain', 0x4a2f1a), P('Noir', 0x1c1410), P('Blond', 0xa8802c), P('Roux', 0xa0421e),
  P('Auburn', 0x6a2f20), P('Cendré', 0x8a7a68), P('Blanc', 0xc2bcae),
];
export const COIFFURES = [
  // cale : [descente le long de l'axe de la tête (unités de l'os Head, ≈ mètres), agrandissement
  // autour du centre du crâne]. Ces deux coupes ont été modelées pour un crâne plus haut et
  // plus étroit que celui de Camille : elles flottaient 7 et 4 cm au-dessus, tempes et nuque
  // à nu ; descendues seules, le crâne les traversait par plaques.
  { nom: 'Courts', style: 'short', asset: 'coiffures_r:Hair_SimpleParted', cale: [-0.05, 1.12] },
  { nom: 'En bataille', style: 'spiky', asset: 'coiffures_r:Hair_BuzzedFemale' },
  { nom: 'Longs', style: 'long', asset: 'coiffures_r:Hair_Long' },
  { nom: 'Chignon', style: 'bun', asset: 'coiffures_r:Hair_Buns' },
  { nom: 'Bonnet', style: 'bonnet', asset: null },
  { nom: 'Ras', style: 'bald', asset: 'coiffures_r:Hair_Buzzed', cale: [-0.03, 1.08] },
];
export const TUNIQUE = [
  P('Bleu de garde', 0x3f6f88), P('Rouge de Flandre', 0x8a2f3a), P('Vert de houblon', 0x2f6f4a),
  P('Violet d’évêque', 0x5a4a8a), P('Ocre', 0xb9772f), P('Bleu de nuit', 0x2a3a5a),
  P('Gris d’étain', 0x6a6a72), P('Écru', 0xd0c8a0),
];
export const TOILE = [
  P('Lin', 0xb9a27c), P('Bure', 0x8a7550), P('Chanvre', 0xc9bda0),
  P('Terre', 0x6a5236), P('Ardoise', 0x555f6a), P('Brique', 0x9a5a44),
];
export const CUIR = [
  P('Tanné', 0x5a3a22), P('Noir', 0x2a2018), P('Fauve', 0x8a5a30), P('Miel', 0xb08040), P('Gris', 0x5a5a56),
];
export const FOULARD = [
  { nom: 'Sans', hex: null }, P('Grenat', 0x8a3a2a), P('Safran', 0xd0a03a), P('Mousse', 0x4a6a3a),
  P('Bleu pâle', 0x6a8aa8), P('Prune', 0x6a3a5a), P('Écru', 0xe0d8c0),
];
export const YEUX = [
  P('Vert', 0x3a6a4a), P('Bleu', 0x3a6a9a), P('Noisette', 0x8a6a3a),
  P('Gris', 0x6a7078), P('Ambre', 0xb07a2a), P('Sombre', 0x3a2a20),
];
export const CARRURE = [
  { nom: 'Fine', v: 0.88 }, { nom: 'Souple', v: 0.96 }, { nom: 'Normale', v: 1 },
  { nom: 'Solide', v: 1.08 }, { nom: 'Râblée', v: 1.16 },
];
export const TAILLE = [
  { nom: 'Petite', v: 0.94 }, { nom: 'Moyenne', v: 1 }, { nom: 'Grande', v: 1.06 },
];

export const DEFAUT = { peau: 1, cheveux: 0, coiffure: 0, tunique: 0, toile: 0, cuir: 0, foulard: 1, yeux: 0, carrure: 2, taille: 1 };

/** Les réglages courants (toujours complets, même sur une vieille sauvegarde). */
export function look() {
  if (!state.look || typeof state.look !== 'object') state.look = { ...DEFAUT };
  for (const k in DEFAUT) if (typeof state.look[k] !== 'number') state.look[k] = DEFAUT[k];
  return state.look;
}
const signature = () => Object.values(look()).join(',');

// =====================================================================
//  Camille en primitives : on repère ses matériaux par leur couleur d'origine
// =====================================================================
// makeCamille() crée un matériau neuf par appel : les teindre ne touche donc personne
// d'autre. On les classe une fois, on marque le matériau, et on ne se fie plus ensuite
// qu'à cette marque — sinon, une fois repeints, on ne les reconnaîtrait plus.
const ZONES = {
  peau: [0xd8a986, 0xc48f6c],
  cheveux: [0x4a2f1a, 0x3a2414],
  tunique: [0x3f6f88, 0x35607a],
  toile: [0xb9a27c],
  cuir: [0x5a3a22],
  foulard: [0x8a3a2a],
};

function classer(racine) {
  racine.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (!m || !m.color || m.userData.zoneTLOC) continue;
      const hex = m.color.getHex();
      for (const z in ZONES) if (ZONES[z].includes(hex)) { m.userData.zoneTLOC = z; break; }
      if (m.userData.zoneTLOC === 'foulard') o.userData.foulardTLOC = true;
    }
  });
}

function teindre(racine, zone, hex) {
  racine.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) if (m && m.userData.zoneTLOC === zone && m.color) m.color.setHex(hex);
  });
}

function appliquerPrimitives(m, L) {
  classer(m);
  teindre(m, 'peau', PEAU[L.peau].hex);
  teindre(m, 'tunique', TUNIQUE[L.tunique].hex);
  teindre(m, 'toile', TOILE[L.toile].hex);
  teindre(m, 'cuir', CUIR[L.cuir].hex);
  const f = FOULARD[L.foulard];
  if (f.hex !== null) teindre(m, 'foulard', f.hex);
  m.traverse((o) => { if (o.userData.foulardTLOC) o.visible = f.hex !== null; });

  // la tête se refait : c'est le seul moyen de changer de coiffure et de couleur d'yeux
  const ud = m.userData;
  const clef = `${L.coiffure}|${L.cheveux}|${L.yeux}|${L.peau}`;
  if (ud.head && ud.teteTLOC !== clef) {
    const ancienne = ud.head, parent = ancienne.parent;
    if (parent) {
      const neuve = makeHead({
        skin: PEAU[L.peau].hex, hair: CHEVEUX[L.cheveux].hex, style: COIFFURES[L.coiffure].style,
        iris: YEUX[L.yeux].hex, r: 0.38, female: true, bonnet: TOILE[L.toile].hex,
      });
      neuve.position.copy(ancienne.position); neuve.rotation.copy(ancienne.rotation);
      parent.add(neuve); parent.remove(ancienne);
      ud.head = neuve; ud.teteTLOC = clef;
      classer(neuve);
      teindre(neuve, 'peau', PEAU[L.peau].hex);
    }
  }
  // la carrure : le buste et les bras s'élargissent, les jambes suivent à moitié
  const c = CARRURE[L.carrure].v;
  if (ud.body) ud.body.scale.set(c, 1, c);
  if (ud.legs) for (const j of ud.legs) j.scale.set(1 / Math.sqrt(c), 1, 1 / Math.sqrt(c));
}

// =====================================================================
//  Camille riggée : ses maillages, relevés dans le modèle
// =====================================================================
// La tenue de la rôdeuse ne compte que DEUX matériaux d'atlas (MI_Ranger pour tout le
// costume, MI_Regular_Female pour la peau) : teindre par matériau repeindrait Camille
// d'un bloc. On teint donc par MAILLAGE, et les noms viennent du modèle lui-même :
//
//   Female_Ranger_Body / _Arms_1 ........ la tunique et ses manches
//   Female_Ranger_Acc_Pauldrons ......... les épaulières
//   Female_Ranger_Legs / _Head_Hood ..... le pantalon et la capuche
//   Female_Ranger_Body_Belt_1 / _2,
//   _Arms_Bracer, _Feet ................. ceintures, brassards, bottes
//   Female_Ranger_Arms_2 ................ la peau des bras
//   Superhero_Female_tete ............... le visage greffé
//   Eyes_tete / Eyebrows_* / Hair_* ..... yeux, sourcils, cheveux
//
// L'ordre compte : Eyes_tete et Eyebrows_tete finissent tous deux par « _tete », donc
// ils doivent passer AVANT la règle de peau.
const REGLES_RIG = [
  { re: /^Eyes/i, zone: 'yeux' },
  { re: /Eyebrows/i, zone: 'sourcils' },
  { re: /^Hair/i, zone: 'cheveux' },
  { re: /Acc_Pauldrons$/i, zone: 'foulard' },          // l'équivalent du foulard : les épaulières
  { re: /Body$|Arms_1$/i, zone: 'tunique' },
  { re: /Legs$|Head_Hood$/i, zone: 'toile' },
  { re: /Belt_\d$|Bracer$|Feet$/i, zone: 'cuir' },
  { re: /Arms_2$|_tete$/i, zone: 'peau' },
];

function trouverPerso(m) {
  let p = null;
  m.traverse((o) => { if (!p && o.userData && o.userData.perso) p = o.userData.perso; });
  return p;
}
export const estRigge = () => !!(player.mesh && trouverPerso(player.mesh));

// Teindre un atlas, c'est remplacer sa TEINTE, pas la multiplier : on ne peut pas rendre
// bleu un tissu peint en vert en multipliant. On garde donc la luminance peinte (l'ombrage
// du pack) et on remplace teinte et saturation, par les modes de fusion du canvas — la
// méthode de pnj.js. Une différence : on repart TOUJOURS de la texture d'origine, sinon
// les teintes successives dérivent à chaque changement de couleur.
const _teintes = new Map();
function texTeintee(tex, hex) {
  if (!tex || !tex.image) return tex;
  const cle = tex.uuid + '#' + hex;
  if (_teintes.has(cle)) return _teintes.get(cle);
  const img = tex.image, w = img.width || img.videoWidth, h = img.height || img.videoHeight;
  if (!w || !h) return tex;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const css = '#' + hex.toString(16).padStart(6, '0');
  for (const mode of ['saturation', 'hue']) { g.globalCompositeOperation = mode; g.fillStyle = css; g.fillRect(0, 0, w, h); }
  g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0, w, h);   // l'alpha ne bouge pas
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  t.flipY = tex.flipY; t.needsUpdate = true;
  _teintes.set(cle, t);
  return t;
}

// Deux façons de colorer, et il faut les deux — c'est ce que le rendu a montré :
//
//   « teinte » : on remplace la teinte de l'atlas en gardant sa luminance peinte. C'est le
//     seul moyen de rendre bleue une tunique peinte en vert. Mais sur une texture presque
//     blanche — les cheveux — ça ne donne rien : du blanc reste du blanc, quelle que soit
//     la teinte qu'on lui impose.
//   « multiplie » : la couleur multiplie la texture. Inopérant sur un tissu déjà coloré,
//     parfait sur une base claire : des cheveux blancs multipliés par du brun sont bruns.
//
//   La peau demande les deux : la teinte donne le ton, et une valeur tirée de la
//   luminance de la couleur choisie éclaircit ou assombrit — sans quoi « Ébène » et
//   « Clair » rendraient exactement la même chose.
const MODES = {
  tunique: 'teinte', toile: 'teinte', cuir: 'teinte', foulard: 'teinte', yeux: 'teinte',
  cheveux: 'multiplie', sourcils: 'multiplie', peau: 'teinte+valeur',
};
const _c = new THREE.Color();
const luminance = (hex) => { _c.setHex(hex); return 0.299 * _c.r + 0.587 * _c.g + 0.114 * _c.b; };

function teinterMaillage(o, hex, mode = 'teinte') {
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (!o.userData.origTLOC) o.userData.origTLOC = mats.map((x) => ({ mat: x, map: x && x.map }));
  const val = mode === 'teinte+valeur' ? Math.min(1.5, Math.max(0.45, 0.42 + 1.15 * luminance(hex))) : 1;
  const neuf = o.userData.origTLOC.map((orig) => {
    if (!orig.mat) return orig.mat;
    const c = orig.mat.clone();
    if (!orig.map) { c.color.setHex(hex); return c; }
    if (mode === 'multiplie') { c.map = orig.map; c.color.setHex(hex); return c; }
    c.map = texTeintee(orig.map, hex); c.color.setRGB(val, val, val);
    return c;
  });
  o.material = Array.isArray(o.material) ? neuf : neuf[0];
}

// La coiffure se regreffe depuis la banque : on retire l'ancienne et on colle la nouvelle
// sur le même squelette (A.rebind). Sous try/catch : sans la banque, on garde ce qui est là.
// Le verrou est porté par le personnage, pas par le module : en multijoueur, plusieurs
// Camille se coiffent en même temps, et un verrou unique en aurait laissé une nu-tête.
async function coifferRigge(m, perso, L) {
  const c = COIFFURES[L.coiffure];
  if (m.userData.coiffureTLOC === L.coiffure || m.userData.coiffureEnCoursTLOC === L.coiffure) return;
  m.userData.coiffureEnCoursTLOC = L.coiffure;
  try {
    const A = await import('./assets.js');
    if (c.asset && A.load) await A.load(c.asset).catch(() => {});
    // on retire les cheveux en place (ceux du modèle comme ceux qu'on a greffés)
    const aRetirer = [];
    m.traverse((o) => { if ((o.isMesh || o.isSkinnedMesh || o.name === 'Hair_Bonnet') && /^Hair/i.test(o.name || '')) aRetirer.push(o); });
    for (const o of aRetirer) if (o.parent) o.parent.remove(o);
    m.userData.coiffureTLOC = L.coiffure;
    if (!c.asset) { if (c.style === 'bonnet') bonnet(perso, L); return; }   // pas dans la banque : on le tricote
    const p = A.spawn(c.asset, {});
    if (!p) return;
    // A.rebind REPARENTE les morceaux sous le corps : après l'appel, `p` est vide. Il faut
    // donc relever les maillages AVANT, sinon la nouvelle coiffure reste blanche — ce qui
    // ne se voyait qu'en changeant de niveau, la couleur étant reposée ensuite au premier
    // réglage.
    const morceaux = [];
    p.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (o.material) o.material = o.material.clone();
      if (!o.name || !/^Hair/i.test(o.name)) o.name = 'Hair_' + (o.name || c.nom);
      morceaux.push(o);
    });
    if (A.rebind(p, perso)) for (const o of morceaux) { if (c.cale) caler(o, c.cale); teinterMaillage(o, CHEVEUX[L.cheveux].hex, 'multiplie'); }
  } catch (e) { /* pas de banque : la coiffure d'origine reste */ }
  finally { m.userData.coiffureEnCoursTLOC = null; }
}

// Descend une coupe le long de l'axe de la tête. Elle est « skinnée » : on déplace donc sa
// géométrie dans l'espace de liaison, du vecteur qui, au repos, suit l'axe Y de l'os Head.
// La géométrie est clonée d'abord : la banque la partage entre toutes les Camille.
function caler(o, [dy, s]) {
  const sk = o.skeleton; if (!sk || !o.isSkinnedMesh) return;
  const i = sk.bones.findIndex((b) => /^head$/i.test(b.name)); if (i < 0) return;
  const Mh = sk.boneInverses[i].clone().invert();
  // le centre du crâne, 14 cm au-dessus de l'os (mesuré au banc), ramené dans la géométrie
  const vers = new THREE.Matrix4().multiplyMatrices(o.bindMatrixInverse, Mh);
  const centre = new THREE.Vector3(0, 0.142, -0.01).applyMatrix4(vers);
  const d = new THREE.Vector3(0, dy, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(vers));
  o.geometry = o.geometry.clone();
  o.geometry.translate(-centre.x, -centre.y, -centre.z); o.geometry.scale(s, s, s);
  o.geometry.translate(centre.x + d.x, centre.y + d.y, centre.z + d.z);
}

// Le bonnet : aucune coiffure de la banque n'en est un, et « Bonnet » laissait Camille
// chauve. Un bonnet de laine, à revers, porté un peu en arrière, accroché à l'os de la tête
// (le crâne y est centré 14 cm au-dessus de l'os, rayon 12,5 cm — mesuré au banc). Nommé
// « Hair_… » pour partir avec les autres coiffures quand on en change.
function bonnet(perso, L) {
  const tete = perso.userData.os && perso.userData.os.Head; if (!tete) return;
  const laine = new THREE.MeshStandardMaterial({ color: new THREE.Color(TUNIQUE[L.tunique].hex).multiplyScalar(0.8), roughness: 1 });
  const g = new THREE.Group(); g.name = 'Hair_Bonnet';
  const calotte = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), laine);
  calotte.scale.set(1.02, 1.12, 1.04); calotte.name = 'Hair_BonnetCalotte'; g.add(calotte);
  const revers = new THREE.Mesh(new THREE.TorusGeometry(0.134, 0.024, 8, 24), laine);
  revers.rotation.x = Math.PI / 2; revers.position.y = -0.03; revers.scale.set(1.04, 1.06, 1); revers.name = 'Hair_BonnetRevers'; g.add(revers);
  // centré sur le crâne (13 cm au-dessus de l'os), rayon ≈ 10 cm : le crâne fait 19 cm de large
  g.position.set(0, 0.135, -0.015); g.rotation.x = -0.1; g.scale.set(0.74, 0.8, 0.76);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  tete.add(g);
}

function appliquerRigge(m, perso, L) {
  const couleurs = {
    tunique: TUNIQUE[L.tunique].hex, toile: TOILE[L.toile].hex, cuir: CUIR[L.cuir].hex,
    peau: PEAU[L.peau].hex, cheveux: CHEVEUX[L.cheveux].hex, yeux: YEUX[L.yeux].hex,
    sourcils: new THREE.Color(CHEVEUX[L.cheveux].hex).multiplyScalar(0.75).getHex(),
    foulard: FOULARD[L.foulard].hex,
  };
  m.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const r = REGLES_RIG.find((x) => x.re.test(o.name || ''));
    if (!r) return;
    if (r.zone === 'foulard') { o.visible = couleurs.foulard !== null; if (!o.visible) return; }
    teinterMaillage(o, couleurs[r.zone], MODES[r.zone]);
  });
  coifferRigge(m, perso, L);
  // la carrure : le personnage s'élargit sans changer de hauteur
  if (!perso.userData.echelleTLOC) perso.userData.echelleTLOC = perso.scale.x || 1;
  const e0 = perso.userData.echelleTLOC, c = CARRURE[L.carrure].v;
  perso.scale.set(e0 * c, e0, e0 * c);
}

// =====================================================================
//  Application et veille
// =====================================================================
export function appliquer() {
  const m = player.mesh;
  if (!m) return;
  appliquerSur(m, look());
  m.userData.signatureTLOC = signature();
}

/**
 * Habille n'importe quelle Camille — la sienne, ou celle d'un autre joueur, dont les
 * réglages arrivent par le salon. `echelle` : celle du niveau, que le joueur local tient
 * de G.echelle et qu'un avatar distant reçoit de son propre niveau.
 */
export function appliquerSur(m, L, echelle = G.echelle || 1) {
  const perso = trouverPerso(m);
  if (perso) appliquerRigge(m, perso, L); else appliquerPrimitives(m, L);
  m.scale.setScalar(echelle * TAILLE[L.taille].v);
}

// Des réglages venus d'ailleurs (le salon) : on ne garde que des indices valides, sinon
// une valeur hors palette ferait tomber appliquerSur() sur un `undefined.hex`.
const PALETTES = () => ({ peau: PEAU, cheveux: CHEVEUX, coiffure: COIFFURES, tunique: TUNIQUE, toile: TOILE,
  cuir: CUIR, foulard: FOULARD, yeux: YEUX, carrure: CARRURE, taille: TAILLE });
export function normaliser(l) {
  const L = { ...DEFAUT }, P = PALETTES();
  if (l && typeof l === 'object') for (const k in DEFAUT) {
    const v = l[k];
    if (Number.isInteger(v) && v >= 0 && v < P[k].length) L[k] = v;
  }
  return L;
}

// Le moteur refait Camille à chaque page, et la banque d'assets peut la remplacer une
// seconde plus tard : on repose l'apparence dès que le maillage change ou que les
// réglages bougent. Dix fois par seconde, ça ne coûte rien et ça ne rate jamais.
let dernierMesh = null;
export function veiller() {
  setInterval(() => {
    const m = player.mesh;
    if (!m) return;
    if (m !== dernierMesh || m.userData.signatureTLOC !== signature()) { dernierMesh = m; appliquer(); }
  }, 300);
}

// =====================================================================
//  L'armoire : la page de réglage, devant le miroir
// =====================================================================
// Pas de scène séparée ni d'aperçu bricolé : on met le jeu en pause, on pose la caméra
// devant Camille, on la fait tourner sur elle-même, et chaque réglage se voit sur le
// maillage réel, tout de suite. C'est le même personnage que celui qu'on jouera.

let panneau = null, avant = null;
// la vue : d'où on regarde Camille, et sous quel angle elle se présente
const vue = { p: null, dir: null, lat: null, ech: 1, d: 4.6, h: 1.75, base: 0 };
const PAS = 0.16, DMIN = 2.4, DMAX = 8.5;

const RANGEES = [
  { clef: 'peau', titre: 'Teint', liste: () => PEAU, type: 'couleur' },
  { clef: 'cheveux', titre: 'Cheveux', liste: () => CHEVEUX, type: 'couleur' },
  { clef: 'coiffure', titre: 'Coiffure', liste: () => COIFFURES, type: 'texte' },
  { clef: 'yeux', titre: 'Yeux', liste: () => YEUX, type: 'couleur' },
  { clef: 'tunique', titre: 'Tunique', liste: () => TUNIQUE, type: 'couleur' },
  { clef: 'toile', titre: 'Jupe et toile', liste: () => TOILE, type: 'couleur' },
  { clef: 'cuir', titre: 'Cuir et ceinture', liste: () => CUIR, type: 'couleur' },
  { clef: 'foulard', titre: 'Foulard', liste: () => FOULARD, type: 'couleur' },
  { clef: 'carrure', titre: 'Carrure', liste: () => CARRURE, type: 'texte' },
  { clef: 'taille', titre: 'Taille', liste: () => TAILLE, type: 'texte' },
];

function dessiner() {
  const L = look();
  panneau.querySelectorAll('[data-clef]').forEach((el) => {
    const choisi = L[el.dataset.clef] === Number(el.dataset.i);
    el.style.outline = choisi ? '2px solid #ffe7a3' : '2px solid transparent';
    el.style.outlineOffset = '2px';
    el.style.opacity = choisi ? '1' : '.72';
  });
}

function choisir(clef, i) {
  look()[clef] = i;
  appliquer();
  dessiner();
  SFX.pickup();
}

// ce qu'il faut faire en refermant : dans la maison, un mot ; à l'entrée d'une instance,
// la suite du choix (le point d'apparition)
let quandFerme = null;

export function ouvrirArmoire(apres = null) {
  if (panneau) return;
  quandFerme = typeof apres === 'function' ? apres : null;
  const L = look();
  state.paused = true;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}

  // La caméra ne se plante PAS devant Camille : devant elle, il y a l'armoire, et on se
  // retrouverait dans le meuble. On reprend l'axe de la caméra de jeu — qui, elle, a déjà
  // une vue dégagée sur son dos — on décale d'un mètre pour la sortir du panneau, et
  // c'est Camille qu'on fait pivoter pour qu'elle regarde l'objectif.
  const p = player.pos, ech = (G.echelle || 1);
  const dir = new THREE.Vector3(camera.position.x - p.x, 0, camera.position.z - p.z);
  if (dir.lengthSq() < 0.04) dir.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  dir.normalize();
  // le panneau mange le tiers droit de l'écran : on décale la caméra pour que Camille
  // tombe à gauche, entière, et pas derrière les boutons
  const lat = new THREE.Vector3(dir.z, 0, -dir.x);
  avant = { freeCam: G.freeCam, rot: player.mesh ? player.mesh.rotation.y : 0, postFX: G.postFX };
  G.postFX = false;                                      // sans le flou de profondeur, elle est nette
  Object.assign(vue, { p: p.clone(), dir, lat, ech, d: 4.6, h: 1.75, base: Math.atan2(dir.x, dir.z) });
  cadrer();

  panneau = document.createElement('div');
  panneau.style.cssText = `position:fixed; top:0; right:0; bottom:0; width:min(390px, 92vw); z-index:9;
    background:linear-gradient(180deg, rgba(12,17,33,.97), rgba(8,11,22,.99));
    border-left:1px solid rgba(255,231,163,.28); box-shadow:-18px 0 40px rgba(0,0,0,.5);
    color:#e8ecf6; font-family:"Trebuchet MS","Segoe UI",sans-serif; overflow-y:auto; padding:18px 20px 26px;`;

  const titre = document.createElement('div');
  titre.innerHTML = `<div style="font-size:20px; letter-spacing:2px; color:#ffe7a3; font-weight:bold">L'ARMOIRE DE CAMILLE</div>
    <div style="font-size:13px; color:#9aa4bd; margin:4px 0 10px">Tout se voit sur elle immédiatement.
      <b style="color:#e8ecf6">←</b> <b style="color:#e8ecf6">→</b> la tournent,
      <b style="color:#e8ecf6">↑</b> <b style="color:#e8ecf6">↓</b> approchent. Échap pour refermer.</div>`;
  panneau.appendChild(titre);

  // la barre de vues : tourner à la souris aussi, et se placer d'un coup
  { const barre = document.createElement('div');
    barre.style.cssText = 'display:flex; gap:6px; align-items:center; margin:0 0 6px; flex-wrap:wrap';
    const b = (texte, fn, large) => {
      const x = document.createElement('button');
      x.textContent = texte; x.tabIndex = -1; x.onclick = () => { x.blur(); fn(); };
      x.style.cssText = `font:inherit; font-size:${large ? 13 : 15}px; padding:${large ? '5px 10px' : '4px 11px'};
        border-radius:8px; cursor:pointer; border:1px solid rgba(255,231,163,.25);
        background:rgba(255,231,163,.08); color:#ffe7a3;`;
      return x;
    };
    barre.appendChild(b('◀', () => tourner(-Math.PI / 8)));
    barre.appendChild(b('Face', () => orienter(0), true));
    barre.appendChild(b('Profil', () => orienter(1), true));
    barre.appendChild(b('Dos', () => orienter(2), true));
    barre.appendChild(b('▶', () => tourner(Math.PI / 8)));
    barre.appendChild(b('＋', () => approcher(-0.6)));
    barre.appendChild(b('－', () => approcher(0.6)));
    panneau.appendChild(barre);
    const bou = document.createElement('div');
    bou.id = 'boussoleTLOC';
    bou.style.cssText = 'font-size:12px; color:#9aa4bd; margin:0 0 14px; min-height:16px';
    panneau.appendChild(bou);
  }

  for (const r of RANGEES) {
    const bloc = document.createElement('div');
    bloc.style.cssText = 'margin-bottom:14px';
    const lab = document.createElement('div');
    // sur la Camille de la banque, le foulard n'existe pas : ce réglage tient les épaulières
    lab.textContent = (r.clef === 'foulard' && estRigge()) ? 'Épaulières' : r.titre;
    lab.style.cssText = 'font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:#9aa4bd; margin-bottom:6px';
    bloc.appendChild(lab);
    const ligne = document.createElement('div');
    ligne.style.cssText = 'display:flex; flex-wrap:wrap; gap:7px';
    r.liste().forEach((o, i) => {
      const b = document.createElement('button');
      b.dataset.clef = r.clef; b.dataset.i = i; b.title = o.nom;
      if (r.type === 'couleur' && o.hex !== null && o.hex !== undefined) {
        b.style.cssText = `width:30px; height:30px; border-radius:50%; cursor:pointer; border:1px solid rgba(0,0,0,.5);
          background:#${o.hex.toString(16).padStart(6, '0')};`;
      } else {
        b.textContent = o.nom;
        b.style.cssText = `font:inherit; font-size:13px; padding:5px 11px; border-radius:8px; cursor:pointer;
          border:1px solid rgba(255,231,163,.25); background:rgba(255,231,163,.08); color:#ffe7a3;`;
      }
      b.onclick = () => choisir(r.clef, i);
      ligne.appendChild(b);
    });
    bloc.appendChild(ligne);
    panneau.appendChild(bloc);
  }

  const pied = document.createElement('div');
  pied.style.cssText = 'display:flex; gap:8px; margin-top:18px; position:sticky; bottom:-26px; padding:12px 0 0; background:linear-gradient(180deg, rgba(8,11,22,0), rgba(8,11,22,.97) 35%)';
  const bouton = (texte, plein, fn) => {
    const b = document.createElement('button');
    b.textContent = texte;
    b.style.cssText = plein
      ? 'flex:1; font:inherit; font-size:15px; padding:10px; border-radius:9px; cursor:pointer; font-weight:bold; border:1px solid #e8c883; background:linear-gradient(180deg,#e0b358,#c9953f); color:#2a1a08;'
      : 'font:inherit; font-size:14px; padding:10px 14px; border-radius:9px; cursor:pointer; border:1px solid rgba(255,231,163,.25); background:rgba(255,231,163,.08); color:#ffe7a3;';
    b.onclick = fn;
    return b;
  };
  pied.appendChild(bouton('Terminé', true, fermerArmoire));
  pied.appendChild(bouton('Au hasard', false, () => {
    const l = look();
    for (const r of RANGEES) l[r.clef] = Math.floor(Math.random() * r.liste().length);
    appliquer(); dessiner();
  }));
  pied.appendChild(bouton('D’origine', false, () => {
    Object.assign(look(), DEFAUT); appliquer(); dessiner();
  }));
  panneau.appendChild(pied);

  document.body.appendChild(panneau);
  dessiner();
  orienter(0);                                           // elle commence de face
  window.addEventListener('keydown', echap, true);
}

// ---------------------------------------------------------------------
//  Tourner autour d'elle
// ---------------------------------------------------------------------
// C'est le cœur de l'affaire : on ne choisit pas une tenue de face uniquement. Les
// flèches gauche/droite la font pivoter sur elle-même, haut/bas approchent et éloignent
// la caméra. Camille tourne, la caméra reste : la lumière de la pièce joue sur elle
// exactement comme elle jouera en jeu.
function cadrer() {
  const { p, dir, lat, ech, d, h } = vue;
  G.freeCam = {
    pos: { x: p.x + dir.x * d * ech + lat.x * 1.5 * ech, y: p.y + h * ech, z: p.z + dir.z * d * ech + lat.z * 1.5 * ech },
    at: { x: p.x + lat.x * 0.5 * ech, y: p.y + 1.35 * ech, z: p.z + lat.z * 0.5 * ech },
  };
}

function tourner(delta) {
  if (!player.mesh) return;
  player.mesh.rotation.y += delta;
  majBoussole();
}

function orienter(quart) {            // 0 face, 1 profil droit, 2 dos, 3 profil gauche
  if (!player.mesh) return;
  player.mesh.rotation.y = vue.base + quart * Math.PI / 2;
  majBoussole();
}

function approcher(delta) {
  vue.d = Math.min(DMAX, Math.max(DMIN, vue.d + delta));
  cadrer();
}

// un repère écrit : sous quel angle on la regarde
const CADRANS = ['de face', 'de trois quarts', 'de profil', 'de trois quarts dos', 'de dos',
  'de trois quarts dos', 'de profil', 'de trois quarts'];
function majBoussole() {
  const el = panneau && panneau.querySelector('#boussoleTLOC');
  if (!el || !player.mesh) return;
  let a = (player.mesh.rotation.y - vue.base) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  el.textContent = 'Tu la vois ' + CADRANS[Math.round(a / (Math.PI / 4)) % 8] + '.';
}

function echap(e) {
  if (!panneau) return;
  if (e.code === 'Escape' || e.code === 'Enter') { e.stopImmediatePropagation(); e.preventDefault(); fermerArmoire(); return; }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.stopImmediatePropagation(); e.preventDefault(); tourner(-PAS); return; }
  if (e.code === 'ArrowRight' || e.code === 'KeyE') { e.stopImmediatePropagation(); e.preventDefault(); tourner(PAS); return; }
  if (e.code === 'ArrowUp') { e.stopImmediatePropagation(); e.preventDefault(); approcher(-0.45); return; }
  if (e.code === 'ArrowDown') { e.stopImmediatePropagation(); e.preventDefault(); approcher(0.45); return; }
}

export function fermerArmoire() {
  if (!panneau) return;
  window.removeEventListener('keydown', echap, true);
  panneau.remove(); panneau = null;
  if (player.mesh && avant) player.mesh.rotation.y = avant.rot;
  if (avant) G.postFX = avant.postFX;
  G.freeCam = avant ? avant.freeCam : null;
  avant = null;
  state.paused = false;
  saveGame(true);
  const f = quandFerme; quandFerme = null;
  if (f) f(); else showMessage('Te voilà. Ferme l’armoire et va voir dehors.', 3);
}
