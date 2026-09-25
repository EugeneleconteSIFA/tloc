// assets.js — chargement, cache et instanciation des modèles de la banque assets_back/
// Autonome : ne dépend pas de engine.js, s'utilise depuis n'importe quelle page du jeu.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { clipsPour, NOMS as NOMS_LOCO } from './locomotion.js';

const BANK = 'assets_back/';

// Les dossiers « _web » utilisent les textures WebP 1024 (185 Mo -> 2,9 Mo).
export const PACKS = {
  megakit:   { dir: BANK + '01_decors/village_medieval/medieval_village_megakit/models_web/', ext: '.gltf' },
  props:     { dir: BANK + '01_decors/props_fantasy/fantasy_props_megakit/models_web/',        ext: '.gltf' },
  nature:    { dir: BANK + '01_decors/nature/kenney_nature-kit/models/',                      ext: '.glb'  },
  retro:     { dir: BANK + '01_decors/retro_fantasy/kenney_retro-fantasy-kit/models/',        ext: '.glb'  },
  corps:     { dir: BANK + '02_personnages/base/universal_base_characters/models_corps_web/', ext: '.gltf' },
  coiffures: { dir: BANK + '02_personnages/base/universal_base_characters/models_coiffures_origine0_web/', ext: '.gltf' },
  coiffures_r: { dir: BANK + '02_personnages/base/universal_base_characters/models_coiffures_riggees_web/', ext: '.gltf' },
  parties:   { dir: BANK + '02_personnages/tenues/modular_character_outfits_fantasy/models_parties_web/',  ext: '.gltf' },
  tenues:    { dir: BANK + '02_personnages/tenues/modular_character_outfits_fantasy/models_tenues_web/',   ext: '.gltf' },
};

export function url(id) {
  const i = id.indexOf(':');
  const p = PACKS[id.slice(0, i)];
  if (!p) throw new Error('pack inconnu dans « ' + id + ' »');
  return p.dir + id.slice(i + 1) + p.ext;
}

const loader = new GLTFLoader();
const templates = new Map();   // id -> Promise<Group>
const ready_ = new Map();      // id -> Group résolu (spawn est synchrone)
const sharedMats = new Map();  // clé -> matériau partagé (indispensable pour mergeStatics)

function materialKey(m) {
  const t = x => (x && x.image && (x.image.src || x.image.currentSrc)) || (x ? x.uuid : '');
  return [m.name, m.type, m.color && m.color.getHexString(), m.roughness, m.metalness,
          t(m.map), t(m.normalMap), t(m.roughnessMap), m.vertexColors].join('|');
}
function share(mesh) {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const out = list.map(m => {
    const k = materialKey(m);
    if (!sharedMats.has(k)) { m.side = THREE.FrontSide; sharedMats.set(k, m); }
    return sharedMats.get(k);
  });
  mesh.material = Array.isArray(mesh.material) ? out : out[0];
}

/** Charge (une seule fois) le modèle et renvoie un gabarit prêt à cloner. */
export function load(id) {
  if (templates.has(id)) return templates.get(id);
  const p = new Promise((res, rej) => {
    loader.load(url(id), g => {
      const root = g.scene;
      root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        o.frustumCulled = true;
        share(o);
      });
      let skinne = false; root.traverse(o => { if (o.isSkinnedMesh) skinne = true; });
      // recentre en X/Z et pose la base sur y = 0 : le pivot devient prévisible.
      // Un modèle skinné garde son origine (déjà aux pieds) : recentrer la racine
      // décalerait le maillage sans décaler les os.
      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3());
      const holder = new THREE.Group();
      if (!skinne) root.position.set(-c.x, -box.min.y, -c.z);
      holder.add(root);
      holder.userData.size = box.getSize(new THREE.Vector3());
      holder.userData.skinne = skinne;
      holder.userData.animations = g.animations || [];
      ready_.set(id, holder);
      res(holder);
    }, undefined, rej);
  });
  templates.set(id, p);
  return p;
}

/** Précharge une liste d'identifiants. onStep(fait, total) pour un écran de chargement. */
export async function preload(ids, onStep) {
  const uniq = [...new Set(ids)];
  let done = 0;
  await Promise.all(uniq.map(id => load(id).then(v => { onStep && onStep(++done, uniq.length); return v; })));
}

/**
 * Instancie un modèle déjà préchargé.
 * opts : x, y, z, rotY (radians), scale, height (met le modèle à cette hauteur réelle en m), dynamic
 */
export function spawn(id, opts = {}) {
  const t = ready_.get(id);
  if (!t) throw new Error('« ' + id + ' » n\'est pas préchargé — appelle preload() d\'abord');
  // Object3D.clone() laisse le clone pointer sur le squelette de l'original : tous les
  // exemplaires bougeraient ensemble. Les modèles skinnés passent par SkeletonUtils.
  const o = t.userData.skinne ? cloneSkinned(t) : t.clone(true);
  const s = opts.height ? opts.height / t.userData.size.y : (opts.scale ?? 1);
  o.scale.setScalar(s);
  o.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
  o.rotation.y = opts.rotY || 0;
  if (opts.dynamic) o.traverse(m => { m.userData.dynamic = true; });
  o.userData.assetId = id;
  if (t.userData.skinne) {
    // index des os par nom : squelette du mannequin UE5 (root, pelvis, spine_01..03,
    // neck_01, Head, clavicle/upperarm/lowerarm/hand _l|_r, thigh/calf/foot/ball _l|_r)
    const os = {}, repos = {}, reposPos = {};
    o.traverse(n => { if (n.isBone) {
      os[n.name] = n; repos[n.name] = n.quaternion.clone(); reposPos[n.name] = n.position.clone();
    } });
    o.userData.os = os;
    o.userData.reposPos = reposPos;
    // Pose de repos : le mannequin UE5 a des rotations non nulles au repos (bras le long
    // du corps). Une animation doit s'y AJOUTER, pas l'écraser — sinon les membres
    // se replient sur les axes locaux des os et le personnage part en morceaux.
    o.userData.repos = repos;
    o.userData.animations = t.userData.animations;
  }
  return o;
}

/** Les clips d'animation livrés avec un gabarit préchargé. */
export function clips(id) {
  const t = ready_.get(id);
  return t ? (t.userData.animations || []) : [];
}

/** Boîte englobante monde, au format des collisions de engine.js : {x0,x1,z0,z1,top}. */
export function footprint(obj, shrink = 0) {
  const b = new THREE.Box3().setFromObject(obj);
  return { x0: b.min.x + shrink, x1: b.max.x - shrink, z0: b.min.z + shrink, z1: b.max.z - shrink, top: b.max.y };
}

/**
 * Matériau PBR Poly Haven à l'échelle physique.
 * `mat` est une entrée de 03_textures/polyhaven/materiaux.json ; `w` et `h` sont les dimensions
 * réelles de la surface à couvrir, en mètres — même principe que brickScaled() dans engine.js.
 */
const TEX = new Map();
function tex(url, srgb, rx, ry) {
  const k = url + '|' + srgb;
  if (!TEX.has(k)) {
    const t = new THREE.TextureLoader().load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    TEX.set(k, t);
  }
  const c = TEX.get(k).clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry); c.needsUpdate = true;
  return c;
}
export function material(mat, w, h, extra = {}) {
  const rx = w / mat.tuile_m, ry = h / mat.tuile_m;
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...extra });
  if (mat.maps.couleur)  m.map = tex(mat.maps.couleur, true, rx, ry);
  if (mat.maps.normale)  m.normalMap = tex(mat.maps.normale, false, rx, ry);
  if (mat.maps.rugosite) m.roughnessMap = tex(mat.maps.rugosite, false, rx, ry);
  if (mat.maps.metal) { m.metalnessMap = tex(mat.maps.metal, false, rx, ry); m.metalness = 1; }
  return m;
}

/** Charge le catalogue des matériaux Poly Haven, indexé par slug. */
let _mats = null;
export async function materials() {
  if (!_mats) {
    const j = await fetch(BANK + '03_textures/polyhaven/materiaux.json').then(r => r.json());
    _mats = Object.fromEntries(j.map(m => [m.slug, m]));
  }
  return _mats;
}

/** Taille réelle (m) d'un gabarit préchargé. */
export function size(id) {
  const t = ready_.get(id);
  return t ? t.userData.size.clone() : null;
}

/**
 * Fusionne les meshes statiques d'un groupe, matériau par matériau.
 * Même principe que mergeStatics() de engine.js : marquer userData.dynamic = true
 * sur tout ce qui bouge pour l'exclure. Renvoie { avant, apres } en nombre de meshes.
 */
export function mergeStatics(root) {
  const groups = new Map();
  let before = 0;
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh) return;
    before++;
    if (Array.isArray(o.material)) return;
    for (let p = o; p; p = p.parent) if (p.userData && p.userData.dynamic) return;
    const g = o.geometry;
    const attrs = Object.keys(g.attributes).sort().join(',');
    const key = o.material.uuid + '|' + attrs + '|' + (g.index ? 'i' : 'n');
    if (!groups.has(key)) groups.set(key, { mat: o.material, attrs: attrs.split(','), geos: [], meshes: [] });
    const grp = groups.get(key);
    const c = g.clone();
    for (const a of Object.keys(c.attributes)) if (!grp.attrs.includes(a)) c.deleteAttribute(a);
    c.applyMatrix4(o.matrixWorld);
    grp.geos.push(c); grp.meshes.push(o);
  });
  let made = 0;
  for (const { mat, geos, meshes } of groups.values()) {
    // un seul mesh dans le groupe : rien à gagner, on le laisse en place
    if (geos.length < 2) { geos.forEach(g => g.dispose()); continue; }
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;            // signatures incompatibles : on ne touche à rien
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    root.add(m); made++;
    for (const o of meshes) { if (o.parent) o.parent.remove(o); o.geometry.dispose(); }
  }
  let after = 0;
  root.traverse(o => { if (o.isMesh) after++; });
  return { before, after, merged: made };
}

/**
 * Attache un élément skinné (coiffure, sourcils) au squelette d'un personnage.
 * Les deux modèles partagent le squelette du mannequin UE5 : il suffit de relier le
 * SkinnedMesh de la source au squelette de la cible et de le reparenter au même endroit,
 * sinon sa propre transformation s'ajoute à celle du skinning et la pièce part de travers.
 * Renvoie true si l'attache a réussi.
 */
export function rebind(source, cible) {
  let ref = null;
  cible.traverse(o => { if (!ref && o.isSkinnedMesh) ref = o; });
  if (!ref) return false;
  const pieces = [];
  source.traverse(o => { if (o.isSkinnedMesh) pieces.push(o); });
  if (!pieces.length) return false;
  for (const m of pieces) {
    m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
    m.bind(ref.skeleton, ref.bindMatrix);
    m.frustumCulled = false;
    m.castShadow = true; m.receiveShadow = true;
    ref.parent.add(m);                    // même espace local que le corps
  }
  return true;
}

/**
 * Greffe la tête d'un corps de base sur un personnage habillé.
 * Le Readme du pack de tenues le dit : « seule la tête du modèle est nécessaire, utiliser
 * le corps entier provoque des interpénétrations ». On ne peut pas découper la tête à la
 * main dans un maillage — mais le modèle est skinné, donc chaque sommet porte le poids de
 * l'os qui le pilote : on garde les triangles dont les trois sommets dépendent de Head ou
 * neck_01, et on jette le reste. Renvoie les morceaux greffés.
 */
export function greffeTete(base, cible, noms = ['Head', 'neck_01']) {
  let ref = null;
  cible.traverse(o => { if (!ref && o.isSkinnedMesh) ref = o; });
  if (!ref) return [];
  const morceaux = [];
  const sources = [];
  base.traverse(o => { if (o.isSkinnedMesh) sources.push(o); });
  for (const m of sources) {
    const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (!si || !sw) continue;
    const garder = new Set();
    m.skeleton.bones.forEach((b, i) => { if (noms.includes(b.name)) garder.add(i); });
    const dom = v => {
      let bi = si.getX(v), bw = sw.getX(v);
      if (sw.getY(v) > bw) { bw = sw.getY(v); bi = si.getY(v); }
      if (sw.getZ(v) > bw) { bw = sw.getZ(v); bi = si.getZ(v); }
      if (sw.getW(v) > bw) { bi = si.getW(v); }
      return bi;
    };
    const idx = g.index, n = idx ? idx.count : g.attributes.position.count;
    const tri = [];
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      if (garder.has(dom(a)) && garder.has(dom(b)) && garder.has(dom(c))) tri.push(a, b, c);
    }
    // les yeux et les sourcils tiennent entièrement sur la tête : on les garde tels quels
    const tout = tri.length >= n * 0.85;
    if (!tri.length) continue;
    const ng = g.clone(); if (!tout) ng.setIndex(tri);
    const nm = new THREE.SkinnedMesh(ng, m.material);
    nm.name = m.name + '_tete';
    nm.castShadow = true; nm.receiveShadow = true; nm.frustumCulled = false;
    nm.bind(ref.skeleton, ref.bindMatrix);
    ref.parent.add(nm);
    morceaux.push(nm);
  }
  return morceaux;
}

// ---------------------------------------------------------------------------
// Banque d'animations — Quaternius Universal Animation Library 2 (CC0).
// Même squelette que les personnages (mannequin UE5, 65 os, bind pose en T,
// noms et ordre identiques), mais des proportions un peu différentes : bras
// plus longs, bassin 1,5 cm plus bas, quelques degrés d'écart sur la colonne.
// Jouer les clips tels quels donnerait une pose légèrement fausse en permanence.
// Chaque piste est donc reciblée en DELTA sur la pose de repos du personnage :
//     q_perso = repos_perso · repos_banque⁻¹ · q_clip
// et les translations (root, pelvis seulement) sont mises à l'échelle du perso.
// ---------------------------------------------------------------------------
// Les deux volumes de la bibliothèque Quaternius. Même squelette, mêmes noms
// d'os : ils se fusionnent en une seule banque. Le volume 1 porte la locomotion
// (Idle, Walk, Jog, Sprint, Jump, Roll), le volume 2 le combat à l'épée et les
// idles typés. En cas de nom identique, le volume 1 gagne — c'est lui qui a les
// cycles de base, les mieux bouclés.
const ANIM_URLS = [
  BANK + '02_personnages/animations/ual1.glb',
  BANK + '02_personnages/animations/ual2.glb',
];
let banque = null;                       // Promise<{clips, repos, posMonde, hauteur}>
const recibles = new Map();              // clé « clip@id » -> AnimationClip recyclé

function chargerBanque(url) {
  return new Promise((res, rej) => {
    loader.load(url, g => {
      const repos = {}, posMonde = {};
      g.scene.updateWorldMatrix(true, true);
      g.scene.traverse(n => {
        if (!n.name) return;
        repos[n.name] = n.quaternion.clone();
        posMonde[n.name] = n.getWorldPosition(new THREE.Vector3());
      });
      res({ animations: g.animations || [], repos, posMonde });
    }, undefined, rej);
  });
}

/** Charge (une seule fois) la banque d'animations, les deux volumes fusionnés. */
export function animations() {
  if (banque) return banque;
  banque = (async () => {
    // Un volume absent ne doit pas priver du reste : on charge ce qui répond.
    const lots = await Promise.all(ANIM_URLS.map(u => chargerBanque(u).catch(e => {
      console.warn('banque d\'animations partielle, manque', u, ':', e.message); return null;
    })));
    const dispo = lots.filter(Boolean);
    if (!dispo.length) throw new Error('aucune banque d\'animations chargée');
    const clips = new Map();
    for (const lot of dispo) for (const c of lot.animations) if (!clips.has(c.name)) clips.set(c.name, c);
    const ref = dispo[0];
    const v = { clips, repos: ref.repos, posMonde: ref.posMonde,
                hauteur: ref.posMonde.Head ? ref.posMonde.Head.y : 1.57 };
    // nomsClips() est synchrone : on accroche le résultat à la promesse dès
    // qu'il existe, sans attendre le premier appel à animer().
    banque.valeur = v;
    return v;
  })();
  return banque;
}

/** Les noms de clips disponibles, une fois animations() résolu.
 *  Inclut la locomotion fabriquée par locomotion.js, qui n'est pas dans la banque. */
export function nomsClips() {
  const b = banque && banque.valeur;
  return [...NOMS_LOCO, ...(b ? [...b.clips.keys()].sort() : [])];
}
export { NOMS_LOCO };

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

/**
 * Recible un clip de la banque sur un personnage instancié par spawn().
 * Renvoie un AnimationClip prêt pour un AnimationMixer posé sur `perso`.
 */
export function recibler(banqueData, clip, perso) {
  const repos = perso.userData.repos, reposPos = perso.userData.reposPos;
  if (!repos) throw new Error('recibler() attend un personnage skinné issu de spawn()');
  // échelle : rapport des hauteurs de tête, dans l'espace local du squelette
  // k = rapport des hauteurs de tête dans l'espace LOCAL du squelette : la mise à
  // l'échelle du groupe (spawn height:) s'applique par-dessus et ne doit pas compter.
  let k = 1;
  const tete = perso.userData.os && perso.userData.os.Head;
  if (tete) {
    perso.updateWorldMatrix(true, true);
    const h = (tete.getWorldPosition(new THREE.Vector3()).y - perso.position.y) / (perso.scale.y || 1);
    if (h > 0.2) k = h / banqueData.hauteur;
  }
  const pistes = [];
  for (const t of clip.tracks) {
    const pt = t.name.lastIndexOf('.');
    const nom = t.name.slice(0, pt), prop = t.name.slice(pt + 1);
    const rDst = repos[nom];
    if (!rDst) continue;                                   // os absent du personnage
    if (prop === 'quaternion') {
      const rSrc = banqueData.repos[nom];
      if (!rSrc) continue;
      _qb.copy(rDst).multiply(_qa.copy(rSrc).invert());     // repos_perso · repos_banque⁻¹
      const v = Float32Array.from(t.values);
      for (let i = 0; i < v.length; i += 4) {
        _qa.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(_qb).normalize();
        v[i] = _qa.x; v[i + 1] = _qa.y; v[i + 2] = _qa.z; v[i + 3] = _qa.w;
      }
      pistes.push(new THREE.QuaternionKeyframeTrack(t.name, t.times, v));
    } else if (prop === 'position') {
      const pDst = reposPos[nom];
      if (!pDst) continue;
      // le clip donne la position locale de l'os ; on garde le MOUVEMENT, mis à
      // l'échelle, et on le repose sur l'offset de bind du personnage.
      const v = Float32Array.from(t.values);
      const n = t.values.length / 3;
      const o = [v[0], v[1], v[2]];                         // première image = référence
      for (let i = 0; i < n; i++) {
        v[i * 3]     = pDst.x + (v[i * 3]     - o[0]) * k;
        v[i * 3 + 1] = pDst.y + (v[i * 3 + 1] - o[1]) * k;
        v[i * 3 + 2] = pDst.z + (v[i * 3 + 2] - o[2]) * k;
      }
      pistes.push(new THREE.VectorKeyframeTrack(t.name, t.times, v));
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, pistes);
}

/**
 * Prépare un personnage pour l'animation : charge la banque, recible les clips
 * demandés et renvoie { mixer, actions, jouer(nom), update(dt) }.
 * `noms` : liste de clips de la banque (voir nomsClips()).
 */
export async function animer(perso, noms) {
  const b = await animations();
  animations.valeur = b; banque.valeur = b;
  const mixer = new THREE.AnimationMixer(perso);
  const actions = {};
  // Locomotion : absente de la banque, fabriquée par locomotion.js. Même mixer,
  // donc elle se fond avec les clips Quaternius sans cas particulier.
  const veutLoco = noms.some(n => NOMS_LOCO.includes(n));
  if (veutLoco) {
    const cleL = 'loco@' + (perso.userData.assetId || '?');
    let loco = recibles.get(cleL);
    if (!loco) { loco = clipsPour(perso); recibles.set(cleL, loco); }
    for (const n of noms) if (loco.has(n)) actions[n] = mixer.clipAction(loco.get(n));
  }
  for (const n of noms) {
    if (actions[n]) continue;
    const c = b.clips.get(n);
    if (!c) { console.warn('clip inconnu :', n); continue; }
    const cle = n + '@' + (perso.userData.assetId || '?');
    let r = recibles.get(cle);
    if (!r) { r = recibler(b, c, perso); recibles.set(cle, r); }
    actions[n] = mixer.clipAction(r);
  }
  let courant = null, nomCourant = null;
  return {
    mixer, actions,
    get nom() { return nomCourant; },
    /** Enchaîne vers `nom` avec un fondu de `fondu` secondes. */
    jouer(nom, fondu = 0.25, boucle = true) {
      const a = actions[nom];
      if (!a || a === courant) return a;
      nomCourant = nom;
      a.reset();
      a.setLoop(boucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !boucle;
      a.enabled = true; a.setEffectiveWeight(1);
      if (courant) a.crossFadeFrom(courant, fondu, false); else a.fadeIn(fondu);
      a.play();
      courant = a;
      return a;
    },
    get actuel() { return courant; },
    update(dt) { mixer.update(dt); },
  };
}
