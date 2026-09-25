// locomotion.js — marche, course et repos fabriqués par code sur le squelette UE5.
//
// La Universal Animation Library 2 ne livre AUCUNE locomotion de base : ni repos
// neutre, ni marche, ni course, ni saut simple. Plutôt que de laisser le village
// figé en attendant la volume 1, on fabrique ces cycles ici, sous forme de vrais
// AnimationClip. Ils passent donc par le même AnimationMixer que les clips
// Quaternius et se fondent avec eux (crossFade) sans cas particulier.
//
// Quand la volume 1 arrivera : il suffira de retirer les noms correspondants de
// CYCLES — animer() prendra alors les vrais clips, tout le reste est inchangé.
import * as THREE from 'three';

// Mesuré sur le banc de personnages : l'axe d'un os est son +Y local, et depuis
// la pose en croix c'est Z qui fait descendre le bras le long du corps (≈1,26 rad)
// tandis que X donne le balancement avant-arrière des bras et la foulée.
const BRAS = 1.26;
const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
const AXE = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/** Quaternion produit des rotations demandées, appliqué SUR le repos de l'os. */
function pose(repos, ...paires) {
  const out = repos.clone();
  for (const [ax, an] of paires) out.multiply(_q.setFromAxisAngle(AXE[ax], an));
  return out;
}

/**
 * Décrit un cycle image par image. `f(u)` reçoit la phase 0..1 et renvoie
 * { os: [[axe, angle], …] } ; les os absents gardent leur pose de repos.
 */
function cycle(nom, duree, images, f, bobF) {
  return { nom, duree, images, f, bobF };
}

/**
 * Main au repos. La bind pose du mannequin laisse les doigts tendus et écartés :
 * au repos comme en marche, une main humaine est légèrement refermée. Sans ça,
 * tous les personnages ont l'air de présenter leurs paumes.
 */
const DOIGTS = ['index', 'middle', 'ring', 'pinky'];
// Axe de flexion mesuré sur le rig : X positif referme le doigt (Z ne fait que
// l'écarter, ce qui donnait des mains en éventail — l'erreur du premier essai).
function mains(k = 1) {
  const out = {};
  for (const cote of ['l', 'r']) {
    for (let d = 0; d < DOIGTS.length; d++) {
      // l'auriculaire se referme plus que l'index : c'est ce dégradé qui fait main
      const base = (0.30 + d * 0.085) * k;
      out[`${DOIGTS[d]}_01_${cote}`] = [['x', base]];
      out[`${DOIGTS[d]}_02_${cote}`] = [['x', base * 1.25]];
      out[`${DOIGTS[d]}_03_${cote}`] = [['x', base * 0.9]];
    }
    out[`thumb_01_${cote}`] = [['x', 0.18 * k], ['y', cote === 'l' ? 0.24 * k : -0.24 * k]];
    out[`thumb_02_${cote}`] = [['x', 0.26 * k]];
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Les cycles
// ---------------------------------------------------------------------------
// Une marche crédible tient à trois choses : la jambe arrière reste tendue et la
// jambe avant plie (le genou ne plie QUE vers l'arrière), le bassin monte deux
// fois par cycle (une fois par appui), et les épaules contrent les hanches.
const borne = (x) => Math.max(-0.42, Math.min(0.45, x));   // une cheville a une course limitée
const foulee = (amp, genou, brasAmp, lean, cadence) => (u) => {
  const w = u * Math.PI * 2;
  const s = Math.sin(w), c = Math.cos(w);
  // flexion du genou : nulle jambe tendue, maximale juste après le décollage
  const plie = (ph) => Math.max(0, Math.sin(ph + Math.PI * 0.45)) ** 1.6 * genou;
  return {
    pelvis:     [['x', -lean * 0.35]],
    spine_01:   [['x', lean * 0.5], ['y', -s * 0.10 * cadence]],
    spine_02:   [['x', lean * 0.3], ['y', -s * 0.06 * cadence]],
    spine_03:   [['y', -s * 0.05 * cadence]],
    neck_01:    [['x', -lean * 0.5], ['y', s * 0.08]],
    Head:       [['y', s * 0.05]],

    upperarm_l: [['z', -BRAS], ['x', -s * brasAmp]],
    upperarm_r: [['z',  BRAS], ['x',  s * brasAmp]],
    lowerarm_l: [['x', -0.25 - Math.max(0, -s) * brasAmp * 0.8]],
    lowerarm_r: [['x', -0.25 - Math.max(0,  s) * brasAmp * 0.8]],

    thigh_l:    [['x',  s * amp]],
    thigh_r:    [['x', -s * amp]],
    calf_l:     [['x', -plie(w)]],
    calf_r:     [['x', -plie(w + Math.PI)]],
    // Le pied doit rester à peu près parallèle au sol : il compense ce que la
    // cuisse et le genou lui font subir. Sans ça, la jambe avance pointe en bas
    // et le personnage marche comme une danseuse.
    foot_l:     [['x', borne(-(s * amp - plie(w)) * 0.55 + 0.05)]],
    foot_r:     [['x', borne(-(-s * amp - plie(w + Math.PI)) * 0.55 + 0.05)]],
    clavicle_l: [['x', s * 0.05]],
    clavicle_r: [['x', -s * 0.05]],
    ...mains(0.9),
  };
};

// Le bassin monte à chaque appui : deux fois par cycle, donc en 2·phase.
const bobFoulee = (h) => (u) => Math.abs(Math.sin(u * Math.PI * 2)) * h - h * 0.5;

const CYCLES = [
  cycle('Marche', 1.05, 24, foulee(0.52, 1.05, 0.34, 0.06, 1), bobFoulee(0.035)),
  cycle('Course', 0.62, 24, foulee(0.82, 1.42, 0.72, 0.22, 1.6), bobFoulee(0.075)),

  // Repos : presque rien, mais pas rien. Respiration lente, léger report de poids,
  // regard qui dérive — c'est l'absence de ces trois choses qui fait « mannequin ».
  cycle('Repos', 4.6, 28, (u) => {
    const w = u * Math.PI * 2, r = Math.sin(w), r2 = Math.sin(w * 2 + 0.7);
    return {
      pelvis:     [['z', r * 0.025]],
      spine_01:   [['x', -0.03 + r2 * 0.022], ['z', -r * 0.02]],
      spine_02:   [['x', r2 * 0.018]],
      spine_03:   [['x', r2 * 0.012]],
      neck_01:    [['x', 0.04 - r2 * 0.02], ['y', r * 0.10]],
      Head:       [['y', r * 0.13], ['x', r2 * 0.03]],
      upperarm_l: [['z', -BRAS - 0.05], ['x', -0.06 + r * 0.035]],
      upperarm_r: [['z',  BRAS + 0.05], ['x', -0.06 - r * 0.035]],
      lowerarm_l: [['x', -0.30 - r2 * 0.03]],
      lowerarm_r: [['x', -0.30 + r2 * 0.03]],
      thigh_l:    [['x', 0.02], ['z', -0.04]],
      thigh_r:    [['x', -0.02], ['z', 0.04]],
      calf_l:     [['x', -0.06]],
      calf_r:     [['x', -0.10]],
      ...mains(1),
    };
  }, (u) => Math.sin(u * Math.PI * 2 * 2 + 0.7) * 0.008),

  // Repos en garde : épée basse, bouclier prêt, appui décalé.
  cycle('ReposGarde', 3.4, 24, (u) => {
    const w = u * Math.PI * 2, r = Math.sin(w), r2 = Math.sin(w * 2);
    return {
      pelvis:     [['y', 0.16]],
      spine_01:   [['x', -0.08 + r2 * 0.02], ['y', -0.12]],
      spine_02:   [['y', -0.08]],
      neck_01:    [['y', 0.16], ['x', 0.05]],
      Head:       [['y', 0.10 + r * 0.05]],
      upperarm_l: [['z', -BRAS + 0.34], ['x', -0.55 + r * 0.03]],
      lowerarm_l: [['x', -1.25], ['y', 0.25]],
      upperarm_r: [['z',  BRAS - 0.10], ['x', -0.22 + r * 0.03]],
      lowerarm_r: [['x', -0.55]],
      thigh_l:    [['x', -0.22], ['z', -0.10]],
      thigh_r:    [['x',  0.20], ['z',  0.12]],
      calf_l:     [['x', -0.30]],
      calf_r:     [['x', -0.22]],
      foot_l:     [['x', 0.22]],
      foot_r:     [['x', 0.10]],
      ...mains(1.5),                 // poings serrés sur l'épée et le bouclier
    };
  }, (u) => Math.sin(u * Math.PI * 2 * 2) * 0.006),
];

// ---------------------------------------------------------------------------
//  Poses de Camille que la banque ne couvre pas
// ---------------------------------------------------------------------------
// La UAL2 a de l'épée et du bouclier, mais ni tir à l'arc, ni poses de
// cinématique. On les écrit ici, en cycles très courts ou quasi statiques.
CYCLES.push(
  // Arc bandé : bras gauche tendu vers l'avant, droit qui tire la corde à la joue.
  cycle('Arc', 2.2, 12, (u) => {
    const r = Math.sin(u * Math.PI * 2) * 0.012;              // tremblement de la tension
    return {
      pelvis:     [['y', 0.30]],
      spine_01:   [['y', -0.22], ['x', -0.05 + r]],
      spine_02:   [['y', -0.14]],
      spine_03:   [['y', -0.10]],
      neck_01:    [['y', 0.34], ['x', 0.06]],
      Head:       [['y', 0.22]],
      clavicle_l: [['x', -0.12]],
      upperarm_l: [['z', -BRAS + 1.24], ['x', -0.12 + r]],    // bras d'arc tendu
      lowerarm_l: [['x', -0.10]],
      clavicle_r: [['x', -0.18]],
      upperarm_r: [['z',  BRAS - 1.05], ['x', 0.30 + r]],
      lowerarm_r: [['x', -2.05]],                              // coude haut, main à la joue
      thigh_l:    [['x', -0.26], ['z', -0.16]],
      thigh_r:    [['x',  0.24], ['z',  0.14]],
      calf_l:     [['x', -0.24]], calf_r: [['x', -0.20]],
      foot_l:     [['x', 0.20]], foot_r: [['x', 0.12]],
      ...mains(1.6),
    };
  }),

  // Saut : une seule pose tenue, le moteur gère la hauteur.
  cycle('Saut', 1.0, 8, (u) => {
    const r = Math.sin(u * Math.PI * 2) * 0.06;
    return {
      spine_01:   [['x', 0.10]], spine_02: [['x', 0.06]],
      neck_01:    [['x', -0.12]],
      upperarm_l: [['z', -BRAS + 0.75], ['x', -0.85 + r]],
      upperarm_r: [['z',  BRAS - 0.75], ['x', -0.85 - r]],
      lowerarm_l: [['x', -0.85]], lowerarm_r: [['x', -0.85]],
      thigh_l:    [['x', 0.62]], calf_l: [['x', -1.05]], foot_l: [['x', 0.30]],
      thigh_r:    [['x', 0.18]], calf_r: [['x', -0.55]], foot_r: [['x', 0.25]],
      ...mains(1.2),
    };
  }),

  // Cinématiques. Couché : le moteur bascule déjà le personnage à l'horizontale,
  // on ne fait qu'ouvrir les membres pour qu'il ne reste pas debout couché.
  cycle('Couche', 1.0, 4, () => ({
    spine_01: [['x', 0.04]],
    upperarm_l: [['z', -BRAS + 0.38]], upperarm_r: [['z', BRAS - 0.38]],
    lowerarm_l: [['x', -0.32]], lowerarm_r: [['x', -0.32]],
    thigh_l: [['x', 0.06], ['z', -0.09]], thigh_r: [['x', 0.06], ['z', 0.09]],
    calf_l: [['x', -0.10]], calf_r: [['x', -0.10]],
    ...mains(0.6),
  })),
  cycle('Genou', 1.0, 4, () => ({
    pelvis: [['x', 0.16]],
    spine_01: [['x', -0.12]], neck_01: [['x', 0.10]],
    upperarm_l: [['z', -BRAS + 0.16], ['x', -0.28]], upperarm_r: [['z', BRAS - 0.16], ['x', -0.28]],
    lowerarm_l: [['x', -0.55]], lowerarm_r: [['x', -0.55]],
    thigh_l: [['x', -1.55], ['z', -0.10]], calf_l: [['x', -1.60]], foot_l: [['x', 0.42]],
    thigh_r: [['x',  0.22], ['z',  0.12]], calf_r: [['x', -1.95]], foot_r: [['x', 0.55]],
    ...mains(1),
  })),
  cycle('Assis', 1.0, 4, () => ({
    spine_01: [['x', -0.10]],
    upperarm_l: [['z', -BRAS + 0.20], ['x', -0.20]], upperarm_r: [['z', BRAS - 0.20], ['x', -0.20]],
    lowerarm_l: [['x', -0.75]], lowerarm_r: [['x', -0.75]],
    thigh_l: [['x', -1.50], ['z', -0.12]], calf_l: [['x', -1.45]], foot_l: [['x', 0.28]],
    thigh_r: [['x', -1.50], ['z',  0.12]], calf_r: [['x', -1.45]], foot_r: [['x', 0.28]],
    ...mains(0.8),
  })),
  cycle('Joie', 0.9, 14, (u) => {
    const r = Math.sin(u * Math.PI * 2);
    return {
      spine_01: [['x', -0.14 + r * 0.05]], neck_01: [['x', -0.20]],
      upperarm_l: [['z', -BRAS + 2.55], ['x', -0.20 + r * 0.14]],
      upperarm_r: [['z',  BRAS - 2.55], ['x', -0.20 - r * 0.14]],
      lowerarm_l: [['x', -0.30]], lowerarm_r: [['x', -0.30]],
      thigh_l: [['x', 0.10 * r]], thigh_r: [['x', -0.10 * r]],
      calf_l: [['x', -0.16]], calf_r: [['x', -0.16]],
      ...mains(1.7),
    };
  }, (u) => Math.abs(Math.sin(u * Math.PI * 2)) * 0.06),
);

export const NOMS = CYCLES.map(c => c.nom);

/**
 * Fabrique les clips pour un personnage instancié par assets.spawn().
 * Les pistes sont écrites en valeurs locales absolues, composées sur la pose de
 * repos du personnage — même convention que les clips reciblés de la banque.
 */
export function clipsPour(perso) {
  const repos = perso.userData.repos, reposPos = perso.userData.reposPos;
  if (!repos) throw new Error('clipsPour() attend un personnage skinné issu de spawn()');

  // Direction « haut du monde » exprimée dans le repère du parent du bassin :
  // le mannequin UE5 vient d'Unreal (Z vers le haut), le bassin n'est donc pas
  // aligné sur l'axe Y de la scène et un bond écrit en Y partirait de côté.
  const bassin = perso.userData.os && perso.userData.os.pelvis;
  let haut = null;
  if (bassin && bassin.parent) {
    perso.updateWorldMatrix(true, true);
    haut = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(bassin.parent.getWorldQuaternion(new THREE.Quaternion()).invert())
      .normalize();
  }

  const out = new Map();
  for (const c of CYCLES) {
    const temps = new Float32Array(c.images + 1);
    for (let i = 0; i <= c.images; i++) temps[i] = (i / c.images) * c.duree;

    const buffers = new Map();                       // os -> Float32Array
    for (let i = 0; i <= c.images; i++) {
      const u = (i % c.images) / c.images;           // la dernière image boucle sur la première
      const p = c.f(u);
      for (const nom of Object.keys(p)) {
        const r = repos[nom];
        if (!r) continue;
        let buf = buffers.get(nom);
        if (!buf) { buf = new Float32Array((c.images + 1) * 4); buffers.set(nom, buf); }
        const q = pose(r, ...p[nom]);
        buf[i * 4] = q.x; buf[i * 4 + 1] = q.y; buf[i * 4 + 2] = q.z; buf[i * 4 + 3] = q.w;
      }
    }

    const pistes = [];
    for (const [nom, buf] of buffers) pistes.push(new THREE.QuaternionKeyframeTrack(nom + '.quaternion', temps, buf));

    if (c.bobF && haut && bassin && reposPos.pelvis) {
      const buf = new Float32Array((c.images + 1) * 3);
      for (let i = 0; i <= c.images; i++) {
        const u = (i % c.images) / c.images;
        _v.copy(reposPos.pelvis).addScaledVector(haut, c.bobF(u));
        buf[i * 3] = _v.x; buf[i * 3 + 1] = _v.y; buf[i * 3 + 2] = _v.z;
      }
      pistes.push(new THREE.VectorKeyframeTrack('pelvis.position', temps, buf));
    }
    out.set(c.nom, new THREE.AnimationClip(c.nom, c.duree, pistes));
  }
  return out;
}
