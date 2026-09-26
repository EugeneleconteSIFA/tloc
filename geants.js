// geants.js — Lydéric et Phinaert sur le squelette riggé.
//
// Les deux géants sont les seuls humanoïdes du bestiaire : ils entrent donc dans
// le pipeline des personnages (mannequin UE5 + banque d'animations Quaternius),
// comme l'exige la règle 5 du BRIEF — personnages et décor montent ensemble.
// Le reste des bêtes (corbeau, moule, fantôme, rat, chauve-souris) n'a d'équivalent
// dans aucun pack : elles restent maison, et montent par leurs matières.
//
// Si les assets manquent, buildGeant() renvoie null et l'appelant retombe sur
// makeGiant() procédural — le jeu ne casse jamais faute d'un fichier.
import * as THREE from 'three';
import * as A from './assets.js';
import { mesh, mat, boxG, sphG, capG, TAU, rand, CT, creatureMat, GOLD, STEEL, IRON, T, pbrRepeat, G, camera } from './engine.js?v=27';

export const IDS = [
  'corps:Superhero_Male_FullBody',
  'tenues:Male_Ranger',
  'parties:Male_Peasant_Legs',
  'parties:Male_Ranger_Acc_Pauldron',
];

let pret = false, banque = null;

/** À appeler une fois au chargement du niveau. Renvoie false si la banque manque. */
export async function prepare() {
  try {
    await A.preload(IDS);
    banque = await A.animations();
    pret = true;
  } catch (e) {
    console.warn('géants riggés indisponibles :', e.message);
    pret = false;
  }
  return pret;
}

/** Duplique les matériaux d'un modèle : assets.js les mutualise, on ne veut pas
 *  teinter Lydéric en repeignant Phinaert. */
function materiauxPropres(racine) {
  const vus = new Map();
  racine.traverse(o => {
    if (!o.isMesh) return;
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    const neuf = liste.map(m => { if (!vus.has(m)) vus.set(m, m.clone()); return vus.get(m); });
    o.material = Array.isArray(o.material) ? neuf : neuf[0];
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false;             // un géant animé déborde souvent sa boîte
  });
  return [...vus.values()];
}

/** Greffe un relief de peau sur l'albédo d'origine : l'atlas du modèle est conservé,
 *  seules les normales et la rugosité viennent de notre carte de cuir. */
function reliefPeau(mats, cartes, teinte, rep = 7, filtre) {
  // L'atlas du modèle occupe tout l'UV 0..1 : sans répétition, une écaille de
  // cinq millimètres est étirée sur deux mètres de peau et ne se voit plus.
  const nm = cartes.normalMap.clone(), rm = cartes.roughnessMap.clone();
  for (const t of [nm, rm]) { t.repeat.set(rep, rep); t.needsUpdate = true; }
  for (const m of mats) {
    if (filtre && !filtre(m)) continue;
    m.normalMap = nm; m.roughnessMap = rm;
    m.normalScale = new THREE.Vector2(1.1, 1.1);
    m.roughness = 1;
    if (teinte !== undefined) m.color.setHex(teinte);
    m.needsUpdate = true;
  }
}

/** Accroche un objet à un os. `pos`/`rot` omis = on garde ceux de l'objet
 *  (les écraser par défaut faisait disparaître cornes et défenses dans le crâne). */
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _sOs = new THREE.Vector3();          // échelle MONDE de l'os (contient déjà celle du perso)
const _pg = new THREE.Vector3(), _qg = new THREE.Quaternion(), _qo = new THREE.Quaternion();

/**
 * Accroche un objet à un os SANS hériter de son échelle.
 * carrure() gonfle les os pour donner sa masse au géant ; un gourdin parenté à
 * la main hériterait de ce gonflement — et, les échelles étant anisotropes le
 * long de la chaîne, il serait aussi cisaillé. On suit donc l'os par sa position
 * et son orientation seules, remises à jour à chaque image (« socket »).
 */
function socket(g, perso, nomOs, obj, pos = [0, 0, 0], rot = [0, 0, 0], suitRot = true) {
  const os = perso.userData.os && perso.userData.os[nomOs];
  if (!os) return null;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  g.add(obj);
  (g.userData.sockets ||= []).push({
    os, obj,
    p: new THREE.Vector3(...pos),
    q: rot.isQuaternion ? rot.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    suitRot,
    base: obj.scale.x || 1,        // l'objet peut avoir sa propre échelle : on la garde
  });
  return obj;
}

/**
 * La prise d'un poing fermé, calculée sur les os des doigts plutôt que réglée à l'œil.
 * La main du géant est gonflée de façon inégale (×15, ×9, ×13 en monde pour Phinaert) :
 * un décalage fixe de quelques centimètres « d'os » envoyait la masse à 75 cm de la
 * paume, et un angle fixe la tenait droite comme un cierge. Ici, le manche passe au creux
 * de la paume (aux 6/10 du chemin vers la base du majeur) et suit la ligne des jointures,
 * de l'auriculaire vers l'index — la tête de l'arme sort donc du côté du pouce, comme dans
 * un vrai poing. L'axe se calcule À L'ÉCHELLE de l'os, puisque socket() ne reprend que sa
 * rotation.
 */
function prise(perso, cote = 'r') {
  const os = perso.userData.os || {};
  const main = os['hand_' + cote], maj = os['middle_01_' + cote], idx = os['index_01_' + cote], aur = os['pinky_01_' + cote];
  if (!main || !maj || !idx || !aur) return null;
  perso.updateWorldMatrix(true, true);
  const sc = new THREE.Vector3(); main.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc);
  const axe = idx.position.clone().sub(aur.position).multiply(sc).normalize();
  return { p: maj.position.clone().multiplyScalar(0.6).toArray(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axe) };
}

/** Repose les objets accrochés sur leurs os. À appeler après le mixer. */
export function majSockets(g) {
  const liste = g.userData.sockets;
  if (!liste || !liste.length) return;
  const ech = g.userData.perso.scale.x;
  g.updateWorldMatrix(true, true);
  g.getWorldPosition(_pg); g.getWorldQuaternion(_qg); _qg.invert();
  for (const it of liste) {
    // carrure() gonfle les os : un accessoire calé sur un os de taille 1 flotte
    // à côté d'une main 22 % plus large, et une défense s'enfonce dans un crâne
    // agrandi de 24 %. L'offset est donc traité comme un POINT dans l'espace
    // local de l'os, transformé par la matrice monde COMPLÈTE — rotation et
    // échelle gonflée comprises. (Décomposer puis multiplier par l'échelle ne
    // marche pas : le long d'un bras qui tourne, les axes de l'échelle et ceux
    // de l'offset ne coïncident plus, et la position part de travers.)
    it.os.matrixWorld.decompose(_p, _q, _sOs);
    if (it.suitRot) _p.copy(it.p).applyMatrix4(it.os.matrixWorld);
    else _p.add(_s.copy(it.p).multiplyScalar(ech));   // accessoire qui reste vertical
    it.obj.position.copy(_p.sub(_pg)).applyQuaternion(_qg);
    // Le bassin du mannequin UE5 porte une rotation de repos de ~104° en X
    // (convention Z-haut d'Unreal) : une ceinture qui la suivrait partirait de
    // travers. Certains accessoires ne prennent donc que la position de l'os.
    if (it.suitRot) it.obj.quaternion.copy(_qo.copy(_qg).multiply(_q).multiply(it.q));
    else it.obj.quaternion.copy(it.q);
    it.obj.scale.setScalar(ech * (it.base || 1));
  }
}

/** Épaissit la carrure en redimensionnant des os : un géant n'est pas un homme
 *  agrandi, il est plus massif à taille égale. Les clips ne touchent pas l'échelle. */
function carrure(perso, table) {
  const os = perso.userData.os || {};
  for (const [nom, sc] of Object.entries(table)) {
    const b = os[nom]; if (!b) continue;
    b.scale.set(...(Array.isArray(sc) ? sc : [sc, sc, sc]));
  }
}

// Phinaert garde la démarche lourde du volume 2 (Zombie_*, parfaite pour un
// ogre) ; Lydéric prend la marche normale du volume 1.
const CLIPS = ['Zombie_Idle_Loop', 'Zombie_Walk_Fwd_Loop', 'Sword_Heavy_Combo', 'Melee_Hook',
               'Hit_Knockback', 'Hit_Chest', 'Idle_FoldArms_Loop', 'Idle_Shield_Loop',
               'Idle_Loop', 'Walk_Loop', 'Sword_Idle', 'Yes', 'Walk_Carry_Loop'];

/**
 * Construit un géant riggé.
 * role : 'phinaert' (ogre au gourdin) ou 'lyderic' (géant chevalier).
 */
export function buildGeant(role = 'phinaert') {
  if (!pret) return null;
  const ogre = role === 'phinaert';
  // ATTENTION : unités de jeu, pas des mètres. Camille mesure ~2,85 unités
  // (cf. pnj.js), donc un géant à 9 unités fait un peu plus de trois fois sa
  // taille — le rapport qu'avaient les géants en primitives. La carrure ci-dessous
  // raccourcit le cou, la tête finit donc ~1,5 unité plus bas que H.
  // BRIEF-GEANTS point 3 : à 10,2 et 8,8 ils dominaient les tours de la porte et
  // leurs foulées lisaient comme du ralenti. 7,6 et 6,6 => 2,7x et 2,3x l'humain
  // (Camille ≈ 2,85) : toujours écrasants, mais ils franchissent la Porte Royale
  // avec de la marge et tiennent dans le cadre caméra en combat.
  // H est la taille en POSE DE REPOS. Phinaert passe sa vie en Zombie_Idle, qui
  // le voûte de ~12 % : à H = 7,6 il lisait 6,7 en jeu, soit la taille de
  // Lydéric. On compense pour qu'il fasse bien ses 7,6 debout.
  const H = ogre ? 8.65 : 6.6;

  const g = new THREE.Group();
  const base = ogre ? 'corps:Superhero_Male_FullBody' : 'tenues:Male_Ranger';
  const perso = A.spawn(base, {});
  const mats = materiauxPropres(perso);
  g.add(perso);
  g.userData.perso = perso;                      // majSockets() en a besoin dès la construction
  // La boîte englobante d'un maillage skinné ne tient pas compte du skinning :
  // spawn({height}) donnerait n'importe quoi. On mesure l'os de la tête, qui lui
  // est exact, et on ajoute la calotte crânienne.
  // La mise à l'échelle vient APRÈS la carrure : celle-ci raccourcit le cou de
  // l'ogre de 28 %, donc mesurer avant faisait mentir H de plus d'une unité —
  // Lydéric finissait plus grand que Phinaert.
  const poser = () => {
    perso.scale.setScalar(1);
    perso.updateWorldMatrix(true, true);
    const tete = perso.userData.os && perso.userData.os.Head;
    const hRef = tete ? tete.getWorldPosition(new THREE.Vector3()).y + 0.12 : 1.8;
    perso.scale.setScalar(H / hRef);
    perso.updateWorldMatrix(true, true);
  };
  if (ogre) carrure(perso, {                     // trapu, épaules larges, jambes courtes
    spine_01: [1.16, 1.0, 1.22], spine_02: [1.10, 0.96, 1.16], spine_03: [1.08, 0.94, 1.12],
    neck_01: [1.2, 0.72, 1.2], Head: 1.24,
    clavicle_l: [1.14, 1, 1.14], clavicle_r: [1.14, 1, 1.14],
    upperarm_l: [1.34, 1, 1.34], upperarm_r: [1.34, 1, 1.34],
    lowerarm_l: [1.26, 1, 1.26], lowerarm_r: [1.26, 1, 1.26],
    hand_l: [1.22, 1.1, 1.22], hand_r: [1.22, 1.1, 1.22],
    thigh_l: [1.34, 0.9, 1.34], thigh_r: [1.34, 0.9, 1.34],
    calf_l: [1.26, 0.92, 1.26], calf_r: [1.26, 0.92, 1.26],
    foot_l: [1.2, 1, 1.2], foot_r: [1.2, 1, 1.2],
  });
  else carrure(perso, { spine_01: [1.06, 1, 1.08], clavicle_l: [1.08, 1, 1.08], clavicle_r: [1.08, 1, 1.08],
    upperarm_l: [1.1, 1, 1.1], upperarm_r: [1.1, 1, 1.1], thigh_l: [1.08, 1, 1.08], thigh_r: [1.08, 1, 1.08] });
  poser();
  const ech = perso.scale.y;                      // pour dimensionner les ajouts

  if (ogre) {
    // peau : cuir d'ogre, rouge sombre
    reliefPeau(mats, CT.cuirOgre, 0x9c3a26, 9);
    // Pagne et ceinture : le pantalon modulaire se noie dans le corps une fois la
    // carrure élargie. Une pièce géométrique cousue sur le bassin tient mieux.
    const cuir = creatureMat(CT.cuirOgre, 1.4, 1.4, { color: 0x4a3324 });
    const pagne = new THREE.Group();
    pagne.add(mesh(new THREE.CylinderGeometry(0.215, 0.275, 0.34, 16, 1, true), cuir, 0, -0.06, 0));
    for (let i = 0; i < 9; i++) {                       // lanières
      const a = -1.35 + i * 0.34;
      const l = mesh(boxG(0.06, rand(0.22, 0.38), 0.018), cuir, Math.sin(a) * 0.255, -0.34, Math.cos(a) * 0.255);
      l.rotation.y = a; pagne.add(l);
    }
    pagne.add(mesh(new THREE.TorusGeometry(0.235, 0.032, 8, 20), cuir, 0, 0.09, 0).rotateX(Math.PI / 2));
    pagne.add(mesh(boxG(0.09, 0.09, 0.026), IRON(), 0, 0.09, 0.245));     // boucle
    socket(g, perso, 'pelvis', pagne, [0, 0.03, 0], [0, 0, 0], false);
  } else {
    // Lydéric garde sa tenue ; on lui greffe la tête et les mains du corps de base
    A.greffeTete(A.spawn('corps:Superhero_Male_FullBody', {}), perso);
    reliefPeau(mats, CT.peauLisse, undefined, 6, m => /skin|body|head|hand/i.test(m.name || ''));
  }
  const ep = A.spawn('parties:Male_Ranger_Acc_Pauldron', {});
  A.rebind(ep, perso);
  for (const m of materiauxPropres(ep)) {
    m.color.setHex(ogre ? 0x3a3f46 : 0xc9a03a); m.metalness = 0.85; m.roughness = 0.34;
  }

  const os = perso.userData.os || {};

  // ---------- attributs : c'est là que le géant redevient lui-même ----------
  if (ogre) {
    const corne = mat(0xe8dcc0, { roughness: 0.5 });
    // L'os Head regarde vers +Y (l'axe de l'os remonte le crâne) : X = côté, Z = nuque->front.
    for (const sx of [-1, 1]) {
      const h = mesh(new THREE.ConeGeometry(0.075, 0.52, 9), corne, 0, 0.26, 0);
      h.rotation.z = -sx * 0.75; h.rotation.x = -0.45;
      socket(g, perso, 'Head', h, [sx * 0.085, 0.085, 0.0]);
    }
    for (const sx of [-1, 1]) {                                     // défenses inférieures
      const d = mesh(new THREE.ConeGeometry(0.026, 0.14, 7), mat(0xf0ead8), 0, 0.07, 0);
      d.rotation.x = -0.25; d.rotation.z = sx * 0.12;
      socket(g, perso, 'Head', d, [sx * 0.033, 0.015, 0.098]);
    }
    socket(g, perso, 'Head', mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 14), IRON(), 0, 0, 0).rotateY(Math.PI / 2),
           [0, 0.035, 0.115]);                                       // anneau de nez
    // gourdin ferré
    const club = new THREE.Group();
    club.add(mesh(new THREE.CylinderGeometry(0.048, 0.082, 0.95, 10), pbrRepeat(T.bark, 1, 2), 0, 0.42, 0));
    // la poignée gainée de cuir (là où le poing se ferme) et deux frettes de fer sous la tête
    club.add(mesh(new THREE.CylinderGeometry(0.056, 0.058, 0.26, 10), mat(0x3a2414, { roughness: 0.9 }), 0, 0.02, 0));
    for (const y of [0.72, 0.8]) club.add(mesh(new THREE.TorusGeometry(0.08, 0.014, 6, 14), IRON(), 0, y, 0).rotateX(Math.PI / 2));
    const tete = mesh(sphG(0.145, 12), IRON(), 0, 0.95, 0);
    club.add(tete);
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10, e = (i % 2) * 0.07 - 0.035;
      const sp = mesh(new THREE.ConeGeometry(0.024, 0.11, 5), STEEL(), Math.cos(a) * 0.145, 0.95 + e, Math.sin(a) * 0.145);
      sp.lookAt(0, 0.95 + e, 0); sp.rotateX(-Math.PI / 2); club.add(sp);
    }
    { const pr = prise(perso); if (pr) socket(g, perso, 'hand_r', club, pr.p, pr.q); else socket(g, perso, 'hand_r', club, [0, 0.06, 0.03], [Math.PI - 0.35, 0, 0]); }
  } else {
    // heaume à plumet et épée longue
    const acier = mat(0xc9a03a, { metalness: 0.9, roughness: 0.3 });
    const heaume = mesh(new THREE.SphereGeometry(0.135, 16, 10, 0, TAU, 0, Math.PI / 2), acier, 0, 0, 0);
    heaume.add(mesh(new THREE.CylinderGeometry(0.016, 0.026, 0.14, 8), acier, 0, 0.16, 0));
    for (let i = 0; i < 5; i++) {
      const pl = mesh(capG(0.013, 0.06, 6), mat(0xc22a2a, { roughness: 0.9 }), 0, 0.24, -0.03 - i * 0.035);
      pl.rotation.x = 0.5 + i * 0.25; heaume.add(pl);
    }
    heaume.add(mesh(boxG(0.03, 0.15, 0.02), acier, 0, -0.02, 0.13));   // nasal
    socket(g, perso, 'Head', heaume, [0, 0.075, 0.01]);
    const epee = new THREE.Group();
    const lame = mesh(new THREE.CylinderGeometry(0.032, 0.006, 0.78, 4), STEEL(), 0, 0.42, 0);
    lame.scale.z = 0.33; epee.add(lame);
    epee.add(mesh(boxG(0.19, 0.028, 0.045), GOLD(), 0, 0.035, 0));
    epee.add(mesh(sphG(0.028, 8), GOLD(), 0, -0.05, 0));
    { const pr = prise(perso); if (pr) socket(g, perso, 'hand_r', epee, pr.p, pr.q); else socket(g, perso, 'hand_r', epee, [0, 0.06, 0.03], [Math.PI - 0.2, 0, 0]); }
  }

  // ---------- animation ----------
  const ctrl = {
    mixer: new THREE.AnimationMixer(perso), actions: {}, courant: null,
    nom: null,
    // RENVOIE l'action, y compris quand elle tournait déjà : animeGeant() s'en
    // servait pour caler la foulée, et un `return` nu laissait le calage mort.
    jouer(nom, fondu = 0.3, boucle = true) {
      const a = this.actions[nom];
      if (!a) return null;
      if (a === this.courant) return a;
      this.nom = nom;
      a.reset(); a.setLoop(boucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !boucle; a.enabled = true; a.setEffectiveWeight(1);
      if (this.courant) a.crossFadeFrom(this.courant, fondu, false); else a.fadeIn(fondu);
      a.play(); this.courant = a;
      return a;
    },
    update(dt) { this.mixer.update(dt); cadence(g, this, dt); majSockets(g); },
  };
  for (const n of CLIPS) {
    const c = banque.clips.get(n);
    if (c) ctrl.actions[n] = ctrl.mixer.clipAction(A.recibler(banque, c, perso));
  }
  // foulées mesurées AVANT la première pose : la mesure balade le temps du mixer.
  ctrl.foulees = {};
  for (const n of MARCHES) {
    const f = mesurerFoulee(g, perso, ctrl, n);
    if (f) ctrl.foulees[n] = f;
  }
  ctrl.mixer.stopAllAction(); ctrl.mixer.setTime(0);
  ctrl.jouer(ogre ? 'Zombie_Idle_Loop' : 'Idle_FoldArms_Loop', 0);
  ctrl.mixer.update(0); majSockets(g);           // pose initiale avant la première image

  g.userData.dynamic = true;
  g.userData.os = os;
  g.userData.anim = ctrl;
  g.userData.role = role;
  g.userData.hauteur = H;
  // compatibilité avec le code qui pilotait le géant procédural : de faux
  // conteneurs, inoffensifs, pour que lyderic.userData.arms[0].rotation.x
  // ne jette pas. Le vrai mouvement passe désormais par le mixer.
  g.userData.arms = [new THREE.Object3D(), new THREE.Object3D()];
  g.userData.elbows = [new THREE.Object3D(), new THREE.Object3D()];
  g.userData.legs = [Object.assign(new THREE.Object3D(), { userData: { knee: new THREE.Object3D() } }),
                     Object.assign(new THREE.Object3D(), { userData: { knee: new THREE.Object3D() } })];
  return g;
}

// Distance parcourue par cycle de marche. Elle N'EST PAS une constante : elle
// dépend du clip (le pas traînant du zombie n'est pas celui du chevalier), de la
// taille, ET de la carrure — celle de l'ogre raccourcit ses cuisses de 10 %.
// Une constante réglée à l'œil donnait 0,62 pour tout le monde, soit 35 % de
// trop pour Lydéric : il patinait. On la MESURE donc, une fois par géant et par
// clip, sur le débattement avant-arrière des pieds dans le repère du bassin.
const _vCam = new THREE.Vector3(), _vPos = new THREE.Vector3();
const _mp = new THREE.Vector3(), _mq = new THREE.Vector3();
const MARCHES = ['Zombie_Walk_Fwd_Loop', 'Walk_Loop', 'Walk_Carry_Loop', 'Walk_Formal_Loop'];

/**
 * Échantillonne un clip de marche et renvoie la distance qu'il fait parcourir
 * par cycle, en unités monde. À appeler à la construction, mixer encore vierge :
 * la mesure déplace le temps du mixer.
 */
function mesurerFoulee(g, perso, ctrl, nom) {
  const a = ctrl.actions[nom], os = perso.userData.os || {};
  const bassin = os.pelvis, pieds = [os.ball_l || os.foot_l, os.ball_r || os.foot_r];
  if (!a || !bassin || !pieds[0] || !pieds[1]) return null;
  a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = 1; a.play();
  const duree = a.getClip().duration || 1, N = 60;
  const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (let i = 0; i < N; i++) {
    ctrl.mixer.setTime((i / N) * duree);
    g.updateWorldMatrix(true, true);
    bassin.getWorldPosition(_mp);
    for (let k = 0; k < 2; k++) {
      pieds[k].getWorldPosition(_mq);
      const z = _mq.z - _mp.z;
      if (z < min[k]) min[k] = z;
      if (z > max[k]) max[k] = z;
    }
  }
  a.stop(); ctrl.mixer.setTime(0);
  return ((max[0] - min[0]) + (max[1] - min[1])) / 2;
}

/**
 * BRIEF-GEANTS point 4 : la foulée suit la taille.
 *
 * La vitesse est MESURÉE sur le déplacement réel du groupe, pas reçue en
 * paramètre : Phinaert est piloté par `updateEnemy()` (engine.js) et Lydéric
 * par les cinématiques de `quetes.js`, qui ne passent ni l'un ni l'autre la
 * même chose. Mesurer ici règle les deux d'un coup, et sans rien demander à
 * personne d'autre.
 *
 * Appelée depuis `ctrl.update()`, donc valable pour tout géant animé, y compris
 * ceux qu'aucun `animeGeant()` ne pilote.
 */
function cadence(g, ctrl, dt) {
  const ud = g.userData;
  const a = ctrl.courant;
  const parCycle = ctrl.foulees && ctrl.foulees[ctrl.nom];
  if (!a || !parCycle || dt <= 0) { ud.dernierAppui = -1; return; }

  g.getWorldPosition(_vPos);
  const prec = ud.posPrec || (ud.posPrec = _vPos.clone());
  const pas = Math.hypot(_vPos.x - prec.x, _vPos.z - prec.z);
  prec.copy(_vPos);
  // Un saut de position (téléportation de cinématique, changement de scène) n'est
  // pas une foulée : on le jette au lieu d'emballer le clip.
  const v = pas > 3 ? (ud.vitesse || 0) : pas / dt;
  ud.vitesse = ud.vitesse === undefined ? v : ud.vitesse + (v - ud.vitesse) * Math.min(1, dt * 8);

  const duree = a.getClip().duration || 1;
  a.timeScale = Math.max(0.35, Math.min(2.2, (ud.vitesse * duree) / parCycle));

  // tremblement de sol à chaque appui, seulement si la caméra est assez près
  const appui = Math.floor((a.time / duree) * 2);        // deux appuis par cycle
  if (appui !== ud.dernierAppui) {
    ud.dernierAppui = appui;
    const d = _vCam.copy(_vPos).distanceTo(camera.position);
    if (d < 25) G.shake = Math.max(G.shake, 0.22 * (1 - d / 25));
  }
}

/** Fait correspondre l'état de combat du moteur à un clip. */
export function animeGeant(e, dt, vitesse) {
  const ctrl = e.mesh.userData.anim;
  if (!ctrl) return false;
  const s = e.state;
  if (s === 'windup') ctrl.jouer('Sword_Heavy_Combo', 0.12, false);
  else if (s === 'cool') ctrl.jouer('Melee_Hook', 0.15, false);
  else if (e.flash > 0.12) ctrl.jouer('Hit_Chest', 0.1, false);
  else if (vitesse > 0.4) ctrl.jouer('Zombie_Walk_Fwd_Loop', 0.25);
  else ctrl.jouer('Zombie_Idle_Loop', 0.35);
  ctrl.update(dt);                       // cadence() et majSockets() sont dedans
  return true;
}
