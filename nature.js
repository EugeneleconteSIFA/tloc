// nature.js — la végétation, l'eau habillée, les nuages, les montagnes.
//
// Secteur Nature. Ne décide de rien sur la carte : il consomme carte.js (relief,
// exclusions, nappes d'eau relevées) et y sème.
//
// Ce que ce fichier contient, dans l'ordre :
//   1. le shader d'eau, appliqué au matériau partagé — il habille du même coup les
//      fossés de la citadelle et toute la Deûle ;
//   2. le SEMIS PAR TUILES, qui fait suivre la densité au joueur au lieu de l'étaler
//      sur la carte entière. C'est la réponse au passage au 1:1 : la surface a été
//      multipliée par vingt, les compteurs n'ont pas bougé, et multiplier les compteurs
//      aurait été payer vingt fois pour une herbe qu'on ne voit jamais toute ;
//   3. l'habillage des berges — roseaux, nénuphars, saules ;
//   4. les huit couches de semis, de l'herbe rase au bois mort ;
//   5. les nuages, les montagnes, les rochers.
//
// La forêt elle-même, la lisière et le mur du bord du monde sont dans foret.js.
import * as FORET from './foret.js';
import * as BOURSE from './bourse.js';
// Pas de `import * as E` ici : trois fonctions de ce fichier déclarent un THREE.Euler
// nommé `E`, et le namespace du moteur serait masqué à l'intérieur — une erreur qui ne
// se voit qu'à l'exécution (cf. ORCHESTRATION.md). Tout passe par l'import nommé.
import {
  THREE, Q, SFX, T, TAU, addCap, blocked, burst, capsulesNear, clamp, distSeg, fbm, getH, lerp, mat,
  mergeParts, phMat, player, rand, scene, spawnGaufre, state,
} from './engine.js?v=27';
import { PARTAGE } from './etat.js';
import {
  ECH, FOSSE_IN, LILLE, LISIERE_R0, LISIERE_R1, MARCHE_R, MOAT_IN, MOAT_OUT, PLAINE_R,
  bastionAt, essenceAt, libreNature, margeBatie, margePlate, nearHouse, nearTown, sdEau, sdPent, sdPoly,
  solPlaine, sousBois, boisDuParc,
} from './carte.js';

export const perf = { leaves: [], grass: null, flowers: [], reeds: null, roots: null, lights: [] };

// Le tracé du mur végétal, rendu par foret.js au moment du semis. Les couches de
// sous-bois s'en servent pour savoir où le fourré commence.
export let MUR = null;

// Uniformes partagés par tous les shaders du secteur (eau, herbe au vent). Un seul
// objet, mis à jour une fois par image par `tickNature`.
const UNIF = { uTemps: { value: 0 } };

// =====================================================================
//  1. L'EAU — la Deûle, les canaux, les étangs
// =====================================================================
// Le relevé OpenStreetMap porte la Deûle, la Moyenne et la Haute-Deûle, le canal de la
// Tortue et les étangs du Bois de Boulogne, déjà pivotés dans le repère du jeu :
// `carte.js` les expose tels quels dans `TRACE.data.eau`. On ne redessine donc rien à la
// main — on FILTRE.
//
// Le filtre, c'est `margePlate()` : un plan d'eau ne peut traverser ni le village, ni la
// ferme, ni la route du bourg, ni le glacis de la citadelle. Tout tracé dont un SEUL
// point tombe sur une zone aménagée est écarté en entier : mieux vaut une Deûle plus
// courte qu'une Deûle qui coupe la route du village en deux.
//
// Reste le relief. `carte.js` ne creuse pas de cuvette et il n'est pas question de le lui
// demander — c'est son fichier, et une cuvette taillée dans le champ de hauteur casserait
// le maillage de la plaine. La nappe se pose donc LÉGÈREMENT AU-DESSUS du terrain, à la
// cote du quantile haut du fond, et c'est une berge en relief — une digue basse, comme en
// Flandre — qui la raccorde à la plaine. L'herbe qu'on devine sous la surface fait le
// fond, et les roseaux prennent exactement là où le fond affleure.

// ---------- le shader d'eau ----------
// Ce qui sépare une nappe d'eau d'un plan bleu, dans l'ordre d'importance :
//   1. deux couches de rides, à des échelles et des vitesses différentes — une seule a
//      une période visible, et l'œil la trouve en trois secondes ;
//   2. le rasant : de face l'eau est transparente, de biais elle est un miroir. C'est
//      ce contraste, plus que la couleur, qui dit « eau » ;
//   3. la profondeur : clair et translucide sur la grève, sombre et opaque au large ;
//   4. l'écume de rive, qui bat lentement et dit où est le bord.
// Le tout sans une texture de plus : la carte de normales du moteur suffit, lue deux fois
// en coordonnées MONDE — donc continue d'une nappe à l'autre, sans couture aux jointures,
// et indépendante de l'échelle du maillage qui la porte.
export function ennoblirEau(m, opts = {}) {
  // Ces trois valeurs étaient figées pour une pièce d'eau d'ornement de vingt mètres.
  // Depuis que la MÊME matière sert au fossé ET à la Deûle, une rugosité de 0,075 avec un
  // reflet d'environnement à 1,5 donne une plaque de chrome : sur deux cents mètres de
  // large, la rivière renvoie le ciel en blanc et on ne voit plus l'eau du tout. Elles
  // sont donc réglables, et leurs valeurs par défaut restent celles du bassin.
  m.color.setHex(opts.couleur ?? 0x3d7f93);
  m.roughness = opts.rugosite ?? 0.075; m.metalness = 0.02;
  m.transparent = true; m.opacity = opts.opacite ?? 1; m.depthWrite = false;
  m.normalMap = T.waterN; m.normalScale = new THREE.Vector2(1, 1);
  m.envMapIntensity = opts.reflet ?? 1.5;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTemps = UNIF.uTemps;
    sh.uniforms.uForce = { value: opts.force ?? 1 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTemps;\nvarying vec3 vMonde;')
      // Pas de houle géométrique : la nappe relevée est un `flatMesh` tourné de -90°
      // autour de X, donc son axe Y LOCAL pointe vers -Z dans le monde — un décalage de
      // `transformed.y` y ferait GLISSER l'eau de côté au lieu de la soulever. Tout le
      // clapot passe donc par les normales, ce qui est de toute façon ce qui se voit.
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTemps;\nuniform float uForce;\nvarying vec3 vMonde;')
      // la nappe est toujours horizontale : le repère tangent est trivial, on se passe
      // de la matrice TBN et on lit la carte de normales directement, en mètres
      .replace('#include <normal_fragment_maps>', [
        'vec2 uA = vMonde.xz * 0.055 + vec2(uTemps * 0.013, uTemps * 0.009);',
        'vec2 uB = vMonde.xz * 0.021 - vec2(uTemps * 0.008, uTemps * 0.012);',
        'vec3 nA = texture2D(normalMap, uA).xyz * 2.0 - 1.0;',
        'vec3 nB = texture2D(normalMap, uB).xyz * 2.0 - 1.0;',
        'vec2 plis = (nA.xy + nB.xy * 0.75) * normalScale * uForce;',
        // `normal` est en repère VUE dans le fragment de three.js. On y écrivait un
        // vecteur en repère MONDE : la verticale de l'eau pointait donc vers le haut de
        // l'ÉCRAN au lieu du ciel. Éclairage et reflet d'environnement échantillonnaient
        // une direction fixe et la nappe sortait uniformément blanche, quelles que soient
        // sa couleur, sa rugosité et son opacité. Il faut passer par la matrice de vue.
        'vec3 nMonde = normalize(vec3(plis.x, 1.0, plis.y));',
        'normal = normalize((viewMatrix * vec4(nMonde, 0.0)).xyz);',
      ].join('\n'))
      .replace('#include <color_fragment>', [
        // la profondeur voyage dans la couleur des sommets quand le maillage en porte
        // (les grèves de ce fichier) ; sinon on est au large, et c'est très bien
        '#ifdef USE_COLOR',
        '  float prof = vColor.r;',
        '#else',
        '  float prof = 0.85;',
        '#endif',
        'float grain = texture2D(normalMap, vMonde.xz * 0.008 + vec2(uTemps * 0.002)).x;',
        'vec3 greve = vec3(0.47, 0.60, 0.53);',
        'vec3 large = diffuseColor.rgb * 0.34;',
        'diffuseColor.rgb = mix(greve, large, smoothstep(0.0, 0.72, prof));',
        'diffuseColor.a = mix(0.30, 0.95, smoothstep(0.0, 0.46, prof));',
        'vec3 vue = normalize(cameraPosition - vMonde);',
        'float fres = pow(1.0 - clamp(vue.y, 0.0, 1.0), 4.0);',
        // Le Fresnel blanchissait plus de la moitié de la nappe dès qu'on la regardait de
        // profil — et depuis la berge, on la regarde TOUJOURS de profil.
        // Vue de la berge, une nappe est TOUJOURS regardée de profil : le terme de Fresnel
        // s'applique alors sur toute la partie proche et la blanchit en bande. On le garde,
        // parce que c'est ce que fait l'eau, mais discret.
        'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.44, 0.52), fres * 0.18);',
        'diffuseColor.a = clamp(diffuseColor.a + fres * 0.10, 0.0, 1.0);',
        // l'écume bat le long de la rive : une frange constante se lit comme un liseré
        'float bat = 0.5 + 0.5 * sin(uTemps * 1.5 + vMonde.x * 0.19 + vMonde.z * 0.23);',
        'float ecume = smoothstep(0.19 + bat * 0.07, 0.0, prof) * (0.35 + grain * 0.75);',
        'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.91, 0.87), clamp(ecume, 0.0, 0.85));',
        'diffuseColor.a = max(diffuseColor.a, clamp(ecume, 0.0, 1.0) * 0.92);',
      ].join('\n'));
  };
  m.customProgramCacheKey = () => 'eau-tloc';
  m.needsUpdate = true;
  return m;
}

export function eauMat(opts = {}) {
  return ennoblirEau(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide }), opts);
}


// =====================================================================
//  2. LE SEMIS PAR TUILES — la densité suit le joueur
// =====================================================================
// La plaine a été multipliée par vingt ; les compteurs, non. Mais les multiplier par
// vingt serait la mauvaise réponse : ce serait vingt fois le temps de chargement et
// vingt fois la mémoire pour une herbe dont on ne voit jamais, à un instant donné, plus
// que le disque de cent mètres autour de Camille. Le reste est sous l'horizon, derrière
// un arbre, ou noyé dans la brume à huit cents mètres.
//
// On sème donc PAR TUILE, autour du joueur. Trois idées, et elles suffisent :
//
//   1. Chaque tuile est tirée d'une graine qui ne dépend QUE de ses coordonnées. Elle
//      repousse toujours identique — on peut donc l'oublier et la refaire sans que le
//      paysage bouge dans le dos du joueur.
//   2. Les tuiles se rangent en adressage TORIQUE : la tuile (gx, gz) occupe toujours le
//      bloc (gx mod N, gz mod N) du tampon d'instances. Une tuile qui sort du champ est
//      donc écrasée par celle qui entre — pas de liste libre, pas de compactage, pas de
//      tri. C'est ce qui rend la chose triviale.
//   3. On ne réécrit que le bloc qui change (`addUpdateRange`), jamais tout le tampon.
//
// Résultat : la densité LOCALE est multipliée par vingt à cinquante, et le coût, lui,
// ne dépend que de la portée — pas de la taille de la carte. Le monde peut grandir
// encore, ça ne changera rien.

const COUCHES = [];
export const COUCHES_DEBUG = COUCHES;   // lecture seule : inspection au banc d'essai
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// xorshift semé par les coordonnées de la tuile : reproductible, et sans état global
function graineTuile(a, b, sel) {
  let s = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(sel | 0, 2246822519)) >>> 0;
  if (!s) s = 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const poseur = (() => {
  const M = new THREE.Matrix4(), QT = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), EU = new THREE.Euler();
  return (im, i, x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) => {
    P.set(x, y, z); QT.setFromEuler(EU.set(rx, ry, rz, 'YXZ')); S.set(sx, sy, sz);
    im.setMatrixAt(i, M.compose(P, QT, S));
  };
})();

class Couche {
  constructor(o) {
    this.nom = o.nom; this.portee = o.portee; this.tuile = o.tuile; this.sel = o.sel;
    this.poser = o.poser; this.essais = o.essais ?? 2.6; this.poidsQ = o.poidsQ ?? 1;
    this.fauche = o.fauche || null;                 // ce que rapporte une plante coupée (cf. LA FAUCHE)
    this.h = Math.ceil(o.portee / o.tuile);
    this.N = 2 * this.h + 1;
    this.parTuile = Math.max(1, Math.round(o.densite * o.tuile * o.tuile));
    this.cap = this.N * this.N * this.parTuile;
    const im = new THREE.InstancedMesh(o.geo, o.mat, this.cap);
    im.castShadow = !!o.ombre; im.receiveShadow = true;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.cap; i++) im.setMatrixAt(i, ZERO);
    if (o.couleurs) { im.setColorAt(0, new THREE.Color(1, 1, 1)); im.instanceColor.array.fill(1); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    // sphère englobante tenue à la main : celle que three calculerait sur les instances
    // coûterait un balayage complet du tampon à chaque tuile semée
    im.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), o.portee + o.tuile * 1.5);
    im.userData.dynamic = true;
    scene.add(im);
    this.mesh = im;
    this.occup = new Array(this.N * this.N).fill('\u0000');
    this.file = []; this.gx = 1e9; this.gz = 1e9;
    this.frac = 1; this.facteur = 1; this.vivantes = 0;
    COUCHES.push(this);
  }
  refaire() { this.gx = 1e9; this.occup.fill('\u0000'); }
  majFile(px, pz) {
    const g0x = Math.floor(px / this.tuile), g0z = Math.floor(pz / this.tuile);
    if (g0x === this.gx && g0z === this.gz) return;
    this.gx = g0x; this.gz = g0z;
    const pe = this.portee * this.facteur, f = this.file; f.length = 0;
    for (let dx = -this.h; dx <= this.h; dx++) for (let dz = -this.h; dz <= this.h; dz++) {
      const gx = g0x + dx, gz = g0z + dz;
      const cx = (gx + 0.5) * this.tuile - px, cz = (gz + 0.5) * this.tuile - pz;
      const d = Math.hypot(cx, cz), dehors = d > pe + this.tuile * 0.71;
      const bloc = (((gx % this.N) + this.N) % this.N) * this.N + (((gz % this.N) + this.N) % this.N);
      const cle = dehors ? '' : gx + ':' + gz;
      if (this.occup[bloc] !== cle) f.push({ gx, gz, bloc, cle, d, dehors });
    }
    f.sort((a, b) => a.d - b.d);                       // le plus proche de Camille d'abord
    this.mesh.boundingSphere.center.set((g0x + 0.5) * this.tuile, 4, (g0z + 0.5) * this.tuile);
    this.mesh.boundingSphere.radius = pe + this.tuile * 1.5;
  }
  travailler(budget) {
    let n = 0;
    while (this.file.length && n < budget) { this.semer(this.file.shift()); n++; }
    if (n > 12) this.mesh.instanceMatrix.clearUpdateRanges();   // trop de plages : tampon entier
    return n;
  }
  semer(t) {
    const base = t.bloc * this.parTuile;
    const cible = t.dehors ? 0 : Math.round(this.parTuile * this.frac);
    let n = 0;
    if (cible) {
      const al = graineTuile(t.gx, t.gz, this.sel);
      const x0 = t.gx * this.tuile, z0 = t.gz * this.tuile, max = Math.ceil(cible * this.essais);
      for (let k = 0; k < max && n < cible; k++) {
        const x = x0 + al() * this.tuile, z = z0 + al() * this.tuile;
        if (this.poser(x, z, al, base + n, this.mesh)) {
          // une plante fauchée il y a moins de REPOUSSE secondes ne revient pas parce que sa
          // tuile a été re-semée : elle garde sa place (le tirage reste le même), vide
          if (this.fauche && fauchee(x, z)) this.mesh.setMatrixAt(base + n, ZERO);
          n++;
        }
      }
    }
    for (let i = n; i < this.parTuile; i++) this.mesh.setMatrixAt(base + i, ZERO);
    const im = this.mesh;
    im.instanceMatrix.addUpdateRange(base * 16, this.parTuile * 16); im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) { im.instanceColor.addUpdateRange(base * 3, this.parTuile * 3); im.instanceColor.needsUpdate = true; }
    this.occup[t.bloc] = t.cle;
    this.vivantes += n;
  }
}

// =====================================================================
//  LA FAUCHE — l'épée coupe l'herbe, les fougères, le blé et le foin
// =====================================================================
// Ce qui est coupé disparaît vraiment, et repousse. Trois choses rendent ça possible sans
// toucher au moteur :
//
//   1. Couper une plante semée, c'est mettre sa matrice à zéro et ne renvoyer que ces
//      64 octets à la carte graphique (`addUpdateRange`), pas le tampon entier.
//   2. Une tuile sortie de portée est re-semée à l'identique : sans mémoire, la plante
//      repousserait dès qu'on tourne le dos. On tient donc une TABLE DES FAUCHES par
//      cellule d'un mètre ; le semis laisse vide une cellule fauchée depuis moins de
//      REPOUSSE secondes (cf. Couche.semer).
//   3. La repousse sur place : chaque plante coupée garde sa matrice ; passé le délai, on
//      la remet — si sa tuile n'a pas changé de propriétaire entre-temps.
//
// Ce qui se fauche : les couches semées qui ont un réglage `fauche` (herbe, touffes,
// fleurs, buissons, fougères — pas les ronces, qui font le mur du fourré), et ce que
// campagne.js inscrit : le blé des champs du moulin (`faucherChamp`) et les meules de foin
// (`meuleFauchable`). Le gain est crédité directement (bourse.js), une gaufre tombe parfois
// — plus souvent quand Camille est blessée : c'est le cœur de Zelda sous le buisson.
const REPOUSSE = 90;                 // secondes avant qu'une plante coupée revienne
const REPOUSSE_MEULE = 240;          // une meule de foin, elle, met quatre minutes
const PORTEE_FAUCHE = 2.4;           // la lame de Camille, comme pour les monstres (engine.js)
const PORTEE_FAUX = 3.4, ARC_FAUX = 1.7;   // la faux d'Émile : un mètre de plus, un arc plus ouvert
const REPOUSSE_OR = 600;             // un buisson doré met dix minutes à revenir
const OR_ECUS = 5;
const portee = () => (state.faux ? PORTEE_FAUX : PORTEE_FAUCHE);
export const estDore = (x, z) => (((Math.floor(x * 5) * 73856093) ^ (Math.floor(z * 5) * 19349663)) >>> 0) % 40 === 0;
const PLAFOND_ZONE = 40, ZONE = 80, FENETRE = 600;   // pas plus de 40 écus de verdure par zone de 80 m et par 10 min
const RECUL_GAUFRE = 20;             // secondes entre deux gaufres tombées de la végétation

let horloge = 0;                     // secondes de jeu écoulées (le tick de nature.js)
const fauches = new Map();           // cellule d'un mètre -> instant où la plante pourra revenir
const cellule = (x, z) => Math.floor(x) * 100003 + Math.floor(z);
function fauchee(x, z) {
  const k = cellule(x, z), t = fauches.get(k);
  if (t === undefined) return false;
  if (horloge > t) { fauches.delete(k); return false; }
  return true;
}

const aRepousser = [];               // { im, i, m: Float32Array(16), t (échéance), garde() }
const CHAMPS_BLE = [];               // { im, rayon, cx, cz, fauche }
// les épis tombés depuis le chargement : le prologue compte la gerbe qu'Émile moudra (quetes.js)
export let bleFauche = 0;
const MEULES = [];                   // cf. meuleFauchable
const zones = new Map();             // anti-farm : zone -> { t0, n }
let caisse = 0, caissePos = null, derniereGaufre = -1e9, meuleFrappee = false, coupees = 0, sonne = false;
// lecture seule, pour le banc d'essai (comme COUCHES_DEBUG)
// (et pour la fête de la moisson, tloc-multi.js : le nombre de coupes depuis le chargement)
export const FAUCHE_DEBUG = { aRepousser, MEULES, CHAMPS_BLE, zones, horloge: () => horloge, coupees: () => coupees };

/** Le blé d'un champ du moulin : un InstancedMesh posé une fois (campagne.js). */
export function faucherChamp(im, cx, cz, rayon) {
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  CHAMPS_BLE.push({ im, cx, cz, rayon, fauche: { ecu: 0.03, gaufre: 0.003, couleur: 0xd8b860 } });
}

/**
 * Une meule de foin : chaque coup d'épée en arrache une brassée (écus, parfois une gaufre),
 * elle s'affaisse, et au dernier coup elle n'est plus qu'un rond de paille ; elle revient
 * au bout de REPOUSSE_MEULE secondes. `obj` doit être marqué dynamique : la fusion des
 * décors (engine.js) l'aurait figé. `cap` est sa capsule, qu'on ouvre et referme.
 */
export function meuleFauchable(obj, x, z, r, cap, coups = 4) {
  obj.userData.dynamic = true;
  MEULES.push({ obj, x, z, r, cap, rCap: cap ? cap.r : 0, coups, reste: coups, tombee: -1 });
}

// Anti-farm : combien la verdure peut encore rapporter ici
function resteZone(x, z) {
  const k = Math.floor(x / ZONE) + ':' + Math.floor(z / ZONE);
  let o = zones.get(k);
  if (!o || horloge - o.t0 > FENETRE) zones.set(k, o = { t0: horloge, n: 0 });
  return o;
}

// Ce que rapporte une coupe : on accumule pendant le coup d'épée, et on crédite d'un coup
// à la fin — un seul « +3 » qui s'élève, pas trois « +1 » qui se chevauchent.
function recolte(x, y, z, f, poids = 1) {
  if (f.ecu && Math.random() < f.ecu * poids) {
    const n = f.ecus ? 1 + Math.floor(Math.random() * f.ecus) : 1;
    const zo = resteZone(x, z), permis = Math.min(n, PLAFOND_ZONE - zo.n);
    if (permis > 0) { zo.n += permis; caisse += permis; caissePos = new THREE.Vector3(x, y + 1.2, z); }
  }
  const blessee = player.hp < player.maxHp;
  if (f.gaufre && horloge - derniereGaufre > RECUL_GAUFRE && Math.random() < f.gaufre * poids * (blessee ? 3 : 1)) {
    derniereGaufre = horloge;
    spawnGaufre(x, z);
  }
}

function dansLaLame(x, y, z, marge = 0) {
  const p = player.pos, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d > portee() + marge || Math.abs(y - p.y) > 2) return false;
  const da = ((Math.atan2(dx, dz) - player.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Math.abs(da) < (state.faux ? ARC_FAUX : 1.25) || d < 1.0;
}

// Coupe une instance : sa matrice est gardée pour la repousse, puis mise à zéro.
function couper(im, i, garde, delai = REPOUSSE) {
  const a = im.instanceMatrix.array, o = i * 16;
  aRepousser.push({ im, i, m: a.slice(o, o + 16), t: horloge + delai, garde });
  im.setMatrixAt(i, ZERO);
  im.instanceMatrix.addUpdateRange(o, 16); im.instanceMatrix.needsUpdate = true;
  coupees++;
}

// ---------- les brins qui volent ----------
// Une gerbe de particules rondes dit « touché », pas « coupé ». Ce qui dit coupé, ce sont
// des brins qui partent en l'air, tournent et retombent : quatre-vingts petits plans dans
// un seul InstancedMesh, recyclés en tourniquet, et une couleur par brin (celle de la plante).
const NB_BRINS = 80;
let brins = null, brinSuivant = 0;
const brinsEtat = [];
function lancerBrins(x, y, z, couleur, n) {
  if (!brins) {
    const g = new THREE.PlaneGeometry(0.07, 0.38); g.translate(0, 0.19, 0);
    brins = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 }), NB_BRINS);
    brins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < NB_BRINS; i++) { brins.setMatrixAt(i, ZERO); brins.setColorAt(i, new THREE.Color(1, 1, 1)); brinsEtat.push({ vie: 0 }); }
    brins.frustumCulled = false; brins.userData.dynamic = true;
    scene.add(brins);
  }
  const c = new THREE.Color(couleur);
  for (let k = 0; k < n; k++) {
    const i = brinSuivant; brinSuivant = (brinSuivant + 1) % NB_BRINS;
    const a = Math.random() * TAU, v = 1.5 + Math.random() * 2.5;
    brinsEtat[i] = { vie: 0.9, x, y: y + 0.3, z, vx: Math.cos(a) * v, vy: 2.5 + Math.random() * 2.5, vz: Math.sin(a) * v,
      rx: Math.random() * TAU, rz: Math.random() * TAU, wx: (Math.random() - 0.5) * 18, wz: (Math.random() - 0.5) * 18 };
    brins.setColorAt(i, c.clone().multiplyScalar(0.8 + Math.random() * 0.4));
  }
  brins.instanceColor.needsUpdate = true;
}
const _mb = new THREE.Matrix4(), _qb = new THREE.Quaternion(), _pb = new THREE.Vector3(), _sb = new THREE.Vector3(1, 1, 1), _eb = new THREE.Euler();
function animerBrins(dt) {
  if (!brins) return;
  let vivants = false;
  for (let i = 0; i < NB_BRINS; i++) {
    const b = brinsEtat[i];
    if (b.vie <= 0) continue;
    b.vie -= dt;
    if (b.vie <= 0) { brins.setMatrixAt(i, ZERO); vivants = true; continue; }
    b.vy -= 9 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    b.vx *= 0.97; b.vz *= 0.97; b.rx += b.wx * dt; b.rz += b.wz * dt;
    _pb.set(b.x, b.y, b.z); _qb.setFromEuler(_eb.set(b.rx, 0, b.rz));
    brins.setMatrixAt(i, _mb.compose(_pb, _qb, _sb.setScalar(Math.min(1, b.vie * 2)))); vivants = true;
  }
  if (vivants) brins.instanceMatrix.needsUpdate = true;
}

function faucher() {
  const p = player;
  // un coup = la fenêtre où la lame frappe aussi les monstres (engine.js : 0,08 à 0,3 s)
  const actif = p.attackT > 0.08 && p.attackT < 0.3;
  if (!actif) {
    if (caisse > 0) { BOURSE.gagner(caisse, caissePos); caisse = 0; }
    if (p.attackT < 0) { meuleFrappee = false; sonne = false; }   // le coup est fini : le suivant pourra frapper
    return;
  }
  const avant = coupees;
  let gerbes = 0;
  const gerbe = (x, y, z, c) => { if (gerbes++ < 8) lancerBrins(x, y, z, c, 3); };

  // 1. les couches semées : la tuile sous la lame et ses voisines, rien d'autre
  for (const c of COUCHES) {
    if (!c.fauche) continue;
    const a = c.mesh.instanceMatrix.array, R = portee() + (c.fauche.rayon || 0);
    const gx0 = Math.floor((p.pos.x - R) / c.tuile), gx1 = Math.floor((p.pos.x + R) / c.tuile);
    const gz0 = Math.floor((p.pos.z - R) / c.tuile), gz1 = Math.floor((p.pos.z + R) / c.tuile);
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
      const bloc = (((gx % c.N) + c.N) % c.N) * c.N + (((gz % c.N) + c.N) % c.N);
      const cle = gx + ':' + gz;
      if (c.occup[bloc] !== cle) continue;             // tuile pas (encore) semée ici
      const base = bloc * c.parTuile;
      for (let i = base; i < base + c.parTuile; i++) {
        const o = i * 16;
        if (a[o] === 0 && a[o + 1] === 0 && a[o + 2] === 0) continue;   // vide ou déjà coupée
        const x = a[o + 12], y = a[o + 13], z = a[o + 14];
        if (!dansLaLame(x, y, z, c.fauche.rayon || 0)) continue;
        const col = c.mesh.instanceColor ? c.mesh.instanceColor.array : null;
        const dore = col && col[i * 3] > 1.25 && col[i * 3 + 2] < 0.5;   // la teinte dorée (cf. la couche des buissons)
        const delai = dore ? REPOUSSE_OR : REPOUSSE;
        fauches.set(cellule(x, z), horloge + delai);
        couper(c.mesh, i, () => c.occup[bloc] === cle, delai);
        gerbe(x, y, z, dore ? 0xf0d060 : c.fauche.couleur);
        if (dore) {
          // le buisson doré paie toujours, hors plafond : c'est la récompense de l'œil
          caisse += OR_ECUS; caissePos = new THREE.Vector3(x, y + 1.2, z);
          burst(x, y + 0.8, z, 0xffe070, 16, 3, 0.9, 2, 1.1);
        } else recolte(x, y, z, c.fauche);
      }
    }
  }

  // 2. le blé des champs : un balayage du champ entier, seulement quand la lame y est
  for (const ch of CHAMPS_BLE) {
    if (Math.hypot(p.pos.x - ch.cx, p.pos.z - ch.cz) > ch.rayon + portee()) continue;
    const im = ch.im, a = im.instanceMatrix.array;
    for (let i = 0; i < im.count; i++) {
      const o = i * 16;
      if (a[o] === 0 && a[o + 1] === 0 && a[o + 2] === 0) continue;
      const x = a[o + 12], y = a[o + 13], z = a[o + 14];
      if (!dansLaLame(x, y, z)) continue;
      couper(im, i, null); bleFauche++;
      gerbe(x, y, z, ch.fauche.couleur);
      recolte(x, y, z, ch.fauche);
    }
  }

  // 3. les meules : un coup d'épée = une brassée, une seule par coup
  if (!meuleFrappee) {
    for (const m of MEULES) {
      if (m.reste <= 0 || !dansLaLame(m.x, p.pos.y, m.z, m.r)) continue;
      m.reste--;
      const y = m.obj.position.y;
      burst(m.x, y + 2, m.z, 0xe8c870, 16, 4, 0.8, 2, 1.1);
      // la brassée paie mieux qu'un brin : 2 à 4 écus, et une gaufre une fois sur cinq
      recolte(m.x, y + 2, m.z, { ecu: 1, ecus: 3, gaufre: 0.2 });
      recolte(m.x, y + 2, m.z, { ecu: 1 });
      if (state.faux) recolte(m.x, y + 2, m.z, { ecu: 1, ecus: 2 });   // la faux arrache une brassée de plus
      lancerBrins(m.x, y + 1.5, m.z, 0xe8c870, 10); coupees++;
      if (m.reste > 0) m.obj.scale.set(1, 0.35 + 0.65 * (m.reste / m.coups), 1);
      else {
        m.obj.visible = false; m.tombee = horloge;
        if (m.cap) m.cap.r = 0;                         // on passe là où elle était
        try { SFX.roll(); } catch (e) {}
      }
    }
    meuleFrappee = true;                              // une seule brassée par coup
  }
  // un seul froissement par coup, et seulement si la lame a vraiment coupé quelque chose
  if (coupees > avant && !sonne) { sonne = true; try { SFX.fauche(); } catch (e) {} }
}

function repousser() {
  // la repousse : chaque coupe a son échéance (90 s, dix minutes pour un buisson doré) ;
  // la liste reste courte — quelques centaines au plus — on la parcourt en entier
  for (let k = aRepousser.length - 1; k >= 0; k--) {
    const r = aRepousser[k];
    if (horloge < r.t) continue;
    aRepousser.splice(k, 1);
    if (r.garde && !r.garde()) continue;              // la tuile a été re-semée ailleurs
    const o = r.i * 16, a = r.im.instanceMatrix.array;
    if (!(a[o] === 0 && a[o + 1] === 0 && a[o + 2] === 0)) continue;
    a.set(r.m, o);
    r.im.instanceMatrix.addUpdateRange(o, 16); r.im.instanceMatrix.needsUpdate = true;
  }
  for (const m of MEULES) {
    if (m.reste > 0 || horloge - m.tombee < REPOUSSE_MEULE) continue;
    // on ne refait pas pousser une meule sur Camille : elle y serait prise
    if (Math.hypot(player.pos.x - m.x, player.pos.z - m.z) < m.r + 1.5) continue;
    m.reste = m.coups; m.obj.visible = true; m.obj.scale.set(1, 1, 1);
    if (m.cap) m.cap.r = m.rCap;
  }
}

// ---------- le vent ----------
// Une prairie immobile est morte, et une prairie animée par la géométrie coûterait une
// fortune. Le shader décale donc chaque sommet proportionnellement à sa HAUTEUR dans le
// brin : le pied ne bouge pas, la pointe oscille, et la phase est tirée de la position
// monde du pied — deux touffes voisines ne battent donc jamais ensemble.
export function brasserAuVent(m, ampleur = 0.09, vitesse = 1) {
  const A = ampleur.toFixed(4), B = (ampleur * 0.78).toFixed(4);
  const V1 = (1.7 * vitesse).toFixed(3), V2 = (1.28 * vitesse).toFixed(3);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTemps = UNIF.uTemps;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTemps;')
      .replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        '#ifdef USE_INSTANCING',
        '  vec3 pied = instanceMatrix[3].xyz;',
        '#else',
        '  vec3 pied = vec3(0.0);',
        '#endif',
        'float hh = max(transformed.y, 0.0);',
        'float ph = pied.x * 0.11 + pied.z * 0.13;',
        'transformed.x += sin(uTemps * ' + V1 + ' + ph) * ' + A + ' * hh;',
        'transformed.z += cos(uTemps * ' + V2 + ' + ph * 1.7) * ' + B + ' * hh;',
      ].join('\n'));
  };
  m.customProgramCacheKey = () => 'vent-' + A + '-' + V1;
  return m;
}

// ---------- l'horloge ----------
// nature.js n'a pas de boucle à lui : `game.js` appartient à l'assemblage et `animate`
// au niveau. On se greffe donc sur le rendu d'un objet minuscule, toujours dans la liste
// d'affichage (frustumCulled = false) et dessiné en premier (renderOrder très négatif).
// Le composeur rend la scène plusieurs fois par image — d'où le verrou de temps.
let tPrec = 0;
function poserHorloge() {
  const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
  const o = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), m);
  o.frustumCulled = false; o.renderOrder = -10000; o.userData.dynamic = true;
  tPrec = performance.now();
  o.onBeforeRender = () => {
    const now = performance.now();
    if (now - tPrec < 5) return;                 // même image, deuxième passe du composeur
    const dt = Math.min(0.05, (now - tPrec) / 1000); tPrec = now;
    tickNature(dt);
  };
  scene.add(o);
}

export function tickNature(dt) {
  UNIF.uTemps.value += dt;
  horloge += dt;
  faucher();
  repousser();
  animerBrins(dt);
  if (!COUCHES.length) return;
  const px = player.pos.x, pz = player.pos.z;
  for (const c of COUCHES) {
    c.majFile(px, pz);
    // deux tuiles par couche et par image en régime de croisière ; seize quand la file
    // explose — chargement, cinématique, changement de qualité, téléportation
    if (c.file.length) c.travailler(c.file.length > c.N * 2 ? 8 : 2);
  }
}

// =====================================================================
//  3. HABILLER L'EAU
// =====================================================================
// Le terrain de l'eau appartient à carte.js : c'est lui qui a relevé la Deûle, les
// canaux et les étangs du Bois de Boulogne dans le cadastre, qui CREUSE la cuvette dans
// le champ de hauteur (`creuxEau`) — ce que ce fichier n'aurait pas pu faire sans
// redéfinir le relief — et qui pose la nappe. On ne refait donc rien de tout cela.
//
// Ce qui reste à Nature est exactement ce qui manque pour que ce ne soit plus un plan
// bleu : la MATIÈRE de l'eau, et la vie de ses bords.
//
//   — le matériau. Il transite par `PARTAGE.waterMat`, que citadelle.js crée et que
//     carte.js réutilise pour ses nappes : l'ennoblir une fois habille du même coup les
//     fossés de la place et toute la Deûle, sans toucher à aucun des deux fichiers.
//   — la grève. La nappe relevée n'a pas de couleur de sommet, donc pas de gradient de
//     profondeur : on pose par-dessus un anneau d'eau peu profonde, à nous, qui porte
//     l'écume et le dégradé là où ils comptent — sur les trois derniers mètres.
//   — les roseaux, les nénuphars, les saules. Une berge nue ne se lit pas comme une
//     berge ; ce qui dit « eau », de loin, c'est la ceinture de roseaux.

export function habillerEaux() {
  // 1. la matière — et c'est tout ce qu'il faut pour les fossés de la citadelle
  // eau de rivière, pas de bassin : elle est mate, elle laisse voir le fond près des rives
  if (PARTAGE.waterMat) ennoblirEau(PARTAGE.waterMat, { couleur: 0x35708c, force: 0.85, rugosite: 0.38, opacite: 0.88, reflet: 0.30 });
  else console.warn('eau : PARTAGE.waterMat absent, les nappes gardent leur matériau');

  const plans = (LILLE && LILLE.eau) || [];
  if (!plans.length) { console.log('eau : aucune nappe relevée à habiller'); return; }

  // 2. PLUS DE GRÈVE. Un anneau de 5,6 m était posé le long de chaque rive pour porter
  // le dégradé de profondeur — mais à `EAU_Y`, une altitude d'eau GLOBALE, alors que
  // chaque nappe tire désormais son niveau de ses propres berges. Le fossé de la place
  // est à −3,00 m : son anneau flottait deux mètres et demi au-dessus de son eau, et
  // dessinait tout autour ce liseré clair qu'on voyait jusqu'en vue aérienne. La
  // bathymétrie relevée fait ce travail toute seule, on l'enlève.

  // 3. la ceinture vivante
  const M = new THREE.Matrix4(), QT = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), EU = new THREE.Euler();
  const C = new THREE.Color();
  const roseauGeo = (() => {
    const q1 = new THREE.PlaneGeometry(1.15, 2.3); q1.translate(0, 1.15, 0);
    const q2 = q1.clone(); q2.rotateY(Math.PI / 2.6);
    const q3 = q1.clone(); q3.rotateY(-Math.PI / 2.6);
    return mergeParts([q1, q2, q3]);
  })();
  const roseauMat = brasserAuVent(new THREE.MeshStandardMaterial({
    map: FORET.carteForet('herbe_haute'), alphaTest: 0.34, side: THREE.DoubleSide, roughness: 1,
  }), 0.06, 1.05);
  const RMAXI = 14000, roseaux = new THREE.InstancedMesh(roseauGeo, roseauMat, RMAXI);
  roseaux.receiveShadow = true; let rn = 0;
  const nenuGeo = new THREE.CircleGeometry(0.52, 9); nenuGeo.rotateX(-Math.PI / 2);
  const NMAXI = 3200, nenus = new THREE.InstancedMesh(nenuGeo, mat(0x3f7a3a, { roughness: 0.55 }), NMAXI);
  let nn = 0;
  const saule = FORET.especeGeo('saule');
  const SMAXI = 520;
  const saulT = saule && new THREE.InstancedMesh(saule.tronc, saule.matT, SMAXI);
  const saulH = saule && new THREE.InstancedMesh(saule.houppier, saule.matH, SMAXI);
  if (saule) {
    saulT.castShadow = saulT.receiveShadow = saulH.castShadow = saulH.receiveShadow = true;
    saulH.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: saule.matH.map, alphaTest: 0.42 });
  }
  let sn = 0;
  // Les capsules sont posées APRÈS le semis : `addCap` salit l'index spatial, que le
  // `blocked()` de l'itération suivante reconstruirait intégralement.
  const troncs = [];

  for (const o of plans) {
    const n = o.poly.length, grand = o.aire > 2500;
    for (let i = 0; i < n; i++) {
      const a = o.poly[i], b = o.poly[(i + 1) % n];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (let t = rand(0, 1.1); t < L; t += 1.1) {
        const bx = a[0] + ux * t, bz = a[1] + uz * t;
        // Les roseaux enjambent la ligne d'eau — un peu dedans, un peu dehors. C'est
        // ce chevauchement qui masque la couture entre la nappe et la berge creusée.
        const nx = uz, nz = -ux;                       // normale au bord, signe inconnu
        const dedans = sdPoly(bx + nx * 3, bz + nz * 3, o.poly) < 0 ? 1 : -1;
        if (rn < RMAXI && Math.random() < 0.8) {
          const x = bx + rand(-0.6, 0.6) + nx * dedans * rand(-2.2, 3.2);
          const z = bz + rand(-0.6, 0.6) + nz * dedans * rand(-2.2, 3.2);
          const sd = sdPoly(x, z, o.poly);
          if (sd > -3.6 && sd < 2.6) {
            // dans l'eau, le pied est au fond ; sur la grève, il suit le terrain
            const y = sd < 0 ? Math.min(o.y - 0.25, getH(x, z, 0)) : Math.max(getH(x, z, 0) - 0.1, o.y - 0.5);
            const sc = rand(0.5, 1.3);
            P.set(x, y, z);
            QT.setFromEuler(EU.set(rand(-0.13, 0.13), rand(0, TAU), rand(-0.13, 0.13)));
            S.set(sc, sc * rand(0.7, 1.55), sc);
            roseaux.setColorAt(rn, C.setRGB(rand(0.78, 1.08), rand(0.86, 1.12), rand(0.60, 0.92)));
            roseaux.setMatrixAt(rn++, M.compose(P, QT, S));
          }
        }
        // nénuphars : au large, jamais collés à la rive
        if (grand && nn < NMAXI && Math.random() < 0.08) {
          const d = 5 + Math.random() * Math.min(26, Math.sqrt(o.aire) * 0.25);
          const px = bx + nx * dedans * d, pz = bz + nz * dedans * d;
          if (sdPoly(px, pz, o.poly) < -2.5) {
            P.set(px, o.y + 0.04, pz); QT.setFromEuler(EU.set(0, rand(0, TAU), 0)); S.setScalar(rand(0.6, 1.5));
            nenus.setMatrixAt(nn++, M.compose(P, QT, S));
          }
        }
      }
      // Saules têtards, sur la berge. Un tous les vingt mètres environ : plus serré, on
      // obtient une haie de peupliers de bord d'autoroute, pas une rivière.
      if (saule) for (let t = rand(0, 26); t < L; t += rand(17, 36)) {
        if (sn >= SMAXI) break;
        const nx = uz, nz = -ux, d = rand(3.5, 9);
        for (const sg of [1, -1]) {
          const x = a[0] + ux * t + nx * d * sg, z = a[1] + uz * t + nz * d * sg;
          if (sdPoly(x, z, o.poly) < 1.5) continue;                 // pas dans l'eau
          // `libreNature` interdit une bande de treize mètres autour de toute nappe —
          // or c'est exactement la berge, et c'est exactement là qu'est le saule. On se
          // rabat donc sur la marge BÂTIE, qui ne connaît que les lieux du jeu.
          if (margeBatie(x, z) < 5 || Math.hypot(x, z) > PLAINE_R - 12) continue;
          if (blocked(x, z, 2.5, false, 0)) continue;
          const h = rand(saule.sp.h[0], saule.sp.h[1]);
          P.set(x, getH(x, z, 0) - 0.15, z);
          QT.setFromEuler(EU.set(rand(-0.09, 0.09), rand(0, TAU), rand(-0.09, 0.09), 'YXZ'));
          S.set(h * rand(0.95, 1.2), h, h * rand(0.95, 1.2));
          M.compose(P, QT, S);
          saulT.setMatrixAt(sn, M); saulH.setMatrixAt(sn, M); sn++;
          troncs.push([x, z, Math.max(0.7, h * saule.sp.rTronc * 2)]);   // encapsulés après la boucle
          break;
        }
      }
    }
  }
  for (const [x, z, r] of troncs) addCap(x, z, x, z, r);
  roseaux.count = rn; if (roseaux.instanceColor) roseaux.instanceColor.needsUpdate = true;
  nenus.count = nn; scene.add(roseaux, nenus);
  perf.roseaux = roseaux; perf.nenuphars = nenus;
  if (saule && sn) { saulT.count = saulH.count = sn; scene.add(saulT, saulH); perf.saules = [saulT, saulH]; perf.leaves.push(saulH); }

  console.log('eau habillée : %d nappes, %d roseaux, %d nénuphars, %d saules', plans.length, rn, nn, sn);
}

export function buildVegetation() {
  // ---------- forêt ----------
  // Densité, espèces, lisière et arrière-plan sont gérés par foret.js.
  const cour = [];
  for (const p of [[-30, -25], [32, -22], [-36, 12], [38, 14], [-18, 30], [20, 30], [-44, 34], [44, 34]])
    if (!blocked(p[0], p[1], 3, false, 0)) cour.push({ x: p[0], z: p[1] });
  const FRT = FORET.planterForet({
    libre: libreNature,
    // BD Forêt v2 : l'inventaire dit quoi planter où ; le bois du parc (carte.js), que
    // l'inventaire ignore, est un bois de feuillus comme le vrai
    essence: (x, z) => essenceAt(x, z) || (boisDuParc(x, z) > 0.3 ? 'Feuillus' : null),
    bois: (x, z) => Math.max(sousBois(x, z), boisDuParc(x, z)),
    marge: margePlate,
    sol: solPlaine,
    rayons: { lis0: LISIERE_R0, lis1: LISIERE_R1, marche: MARCHE_R, plaine: PLAINE_R },
    // La plaine se resserre (8,6 m en clairière, 3,5 m en bosquet contre 10,5 et 4,2) :
    // c'est là qu'on marche. Le fourré se resserre encore. L'arrière-plan, lui, se
    // relâche — il n'est plus traversable, il n'a plus à être dense.
    espacement: { clairiere: 7.6, bosquet: 3.4, mur: 2.25, fond: 8.5 },
    forces: cour,
  });
  MUR = FRT.mur;
  perf.leaves = FRT.feuillages; perf.foret = FRT;
  console.log('forêt :', FRT.total, 'arbres —', FRT.loin.reduce((a, m) => a + m.count, 0), 'silhouettes de fond');
  perf.rideaux = FRT.rideaux;
  console.log('mur végétal : rayon %d à %d m, %d capsules d\'anneau, %d rideaux',
    Math.round(FRT.mur.min), Math.round(FRT.mur.max), FRT.mur.n, FRT.rideaux.length);

  // Le semis par tuiles vient APRÈS la forêt : le sous-bois se repère au fourré, et le
  // fourré n'existe qu'une fois planté.
  initSemis();

  // `perf.grass`, `perf.tufts` et `perf.bushes` restent nuls : ces trois couches ne sont
  // plus des tampons figés dont on tronque le compteur, et le crochet de qualité de
  // game.js les ignore proprement. Leur niveau de détail est réglé dans `initSemis`.
  const M = new THREE.Matrix4(), QT = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), EU = new THREE.Euler();

  // Rochers. Ils portent une collision, donc ils ne peuvent pas être streamés comme le
  // reste : ils restent posés une fois pour toutes. Cent quarante suffisaient sur une
  // carte vingt fois plus petite ; ici ils étaient introuvables.
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rand(0.8, 1.2), p.getY(i) * rand(0.6, 1.0), p.getZ(i) * rand(0.8, 1.2)); rockGeo.computeVertexNormals(); }
  const RN = 620; const rocks = new THREE.InstancedMesh(rockGeo, phMat('rocher_01', 2.6, 2.6, { roughness: 1 }), RN);
  rocks.castShadow = rocks.receiveShadow = true;
  // PIÈGE : `addCap` invalide l'index spatial des capsules, et `libreNature` le
  // reconstruit au premier appel suivant. Poser une capsule DANS la boucle qui teste la
  // liberté, c'est réindexer quarante mille capsules à chaque rocher — six secondes de
  // chargement pour six cents cailloux. On récolte d'abord, on encapsule ensuite.
  let rk = 0; const blocs = [];
  for (let i = 0; i < RN * 14 && rk < RN; i++) {
    const a = rand(0, TAU), r = Math.sqrt(Math.random()) * (MARCHE_R - 10), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const sd = sdPent(x, z);
    // Les éboulis du fossé datent du fossé SEC, à la cote 0. Il est en eau depuis que le
    // relevé fait foi (−2,90 m, fond à −4,80) : vingt-huit rochers flottaient à trois mètres
    // au-dessus de l'eau, avec leur capsule plantée en plein fossé. On n'en pose plus que
    // sur ce qui reste de terre ferme, et au niveau du sol réel.
    const dansFosse = sd > FOSSE_IN + 1 && sd < MOAT_IN - 1 && Math.abs(x) > 8 && sdEau(x, z) > 1;
    if (!dansFosse && !libreNature(x, z, 1)) continue;
    const s = rand(0.4, 1.8);
    P.set(x, solPlaine(x, z) - 0.3 * s, z);
    QT.setFromEuler(EU.set(rand(0, 0.3), rand(0, TAU), rand(0, 0.3)));
    S.set(s, s * rand(0.6, 0.9), s);
    rocks.setMatrixAt(rk++, M.compose(P, QT, S));
    if (s > 0.9) blocs.push([x, z, s * 0.8]);
  }
  rocks.count = rk;
  for (const [x, z, r] of blocs) addCap(x, z, x, z, r);
  scene.add(rocks);

  buildNuages();
}

// ---------- nuages ----------
// Un sprite unique se lit toujours comme un autocollant. Ici chaque nuage est un AMAS
// de bouffées : grosses et claires au sommet, plus petites et grises sous le ventre.
// Trois étages à vitesses différentes donnent la parallaxe, donc l'épaisseur.

export const CLOUD_X = 760;

export function buildNuages() {
  const couches = [
    { n: 18, y: [52, 78],   r: [170, 430], L: [58, 115],  bouffees: [8, 13], op: [0.55, 0.85], v: [0.8, 1.6], aplat: 0.42 },
    { n: 13, y: [98, 136],  r: [220, 540], L: [110, 195], bouffees: [6, 10], op: [0.30, 0.55], v: [0.4, 0.9], aplat: 0.30 },
    { n: 9,  y: [175, 225], r: [260, 620], L: [200, 330], bouffees: [4, 7],  op: [0.12, 0.26], v: [0.18, 0.45], aplat: 0.18 },
  ];
  const HAUT = new THREE.Color(0xfff2e0), BAS = new THREE.Color(0xb9bccb);
  for (const c of couches) for (let i = 0; i < c.n; i++) {
    const g = new THREE.Group();
    const a = rand(0, TAU), r = rand(c.r[0], c.r[1]);
    g.position.set(Math.cos(a) * r, rand(c.y[0], c.y[1]), Math.sin(a) * r);
    g.userData.cloud = rand(c.v[0], c.v[1]);
    const L = rand(c.L[0], c.L[1]), nb = Math.round(rand(c.bouffees[0], c.bouffees[1]));
    for (let k = 0; k < nb; k++) {
      // bouffées réparties dans un ellipsoïde aplati, plus petites vers les bords
      const u = rand(-1, 1), w = rand(-1, 1), hh = Math.pow(Math.random(), 1.6);
      const d = Math.hypot(u, w);
      const px = u * L * 0.5, pz = w * L * 0.22, py = (hh - 0.25) * L * c.aplat;
      const bord = clamp(1 - d * 0.55, 0.3, 1);
      const taille = L * rand(0.30, 0.52) * bord;
      const col = BAS.clone().lerp(HAUT, clamp(hh * 1.2 + 0.15, 0, 1));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T.cloud, color: col, transparent: true, fog: false, depthWrite: false,
        opacity: rand(c.op[0], c.op[1]) * bord, rotation: rand(0, TAU),
      }));
      sp.position.set(px, py, pz);
      sp.scale.set(taille, taille * rand(0.45, 0.7), 1);
      g.add(sp);
    }
    scene.add(g);
  }
}

// =====================================================================
//  Entrée du secteur, appelée par citadelle.js
// =====================================================================
// `buildNature` passe en premier, avant la forêt et avant le décor : l'eau doit avoir
// sa matière avant que quoi que ce soit ne s'en serve.

export function buildNature() {
  // L'eau d'abord : `habillerEaux` ennoblit le matériau partagé, et il vaut mieux que
  // ce soit fait avant que quoi que ce soit ne s'en serve.
  habillerEaux();
}

// =====================================================================
//  Les couches de semis
// =====================================================================
// Huit couches, de la plus rase à la plus haute. Chacune a sa portée, sa densité et sa
// règle d'implantation. Les quatre premières habillent la prairie, les quatre dernières
// sont le sous-bois — et le sous-bois ne pousse pas en plein champ : il lui faut le
// couvert, qu'on mesure à la distance au fourré ou au voisinage d'un tronc.
function initSemis() {
  const C = new THREE.Color();
  const murD = (x, z) => (MUR ? Math.hypot(x, z) - MUR.rayon(x, z) : -1e4);

  // L'herbe pousse aussi dans les fossés et au pied des remparts — c'était vrai avant la
  // bascule d'échelle, il n'y a pas de raison que ça cesse.
  const herbeLibre = (x, z) => {
    const sd = sdPent(x, z);
    if (sd > MOAT_OUT + 1.5) return libreNature(x, z);
    if (Math.abs(x) < 8 && z > 0) return false;                     // pont et allée d'entrée
    if (sd > FOSSE_IN + 1 && sd < MOAT_IN - 1) return true;
    return sd < -3 && sd > -21;
  };
  const posable = (x, z) => {
    const y = solPlaine(x, z);
    if (bastionAt(x, z) || getH(x, z) - y > 0.1 || nearHouse(x, z)) return -1e4;
    return y;
  };
  // Le sous-bois ne pousse pas en plein champ : il lui faut le couvert. Trois manières
  // d'en avoir — être dans un bois relevé au cadastre, être près du fourré du bord du
  // monde, ou simplement avoir un tronc à cinq mètres.
  const couvert = (x, z, portee = 175) => {
    if (!libreNature(x, z)) return false;
    if (sousBois(x, z) > 0.25) return true;
    if (murD(x, z) > -portee) return true;
    for (const c of capsulesNear(x, z, 0)) if (c.r > 0.5 && c.r < 2.4 && distSeg(x, z, c.ax, c.az, c.bx, c.bz) < 5) return true;
    return false;
  };

  // ---------- 1. brins d'herbe : deux plans croisés, la couche la plus dense ----------
  const bladeGeo = (() => {
    const p1 = new THREE.PlaneGeometry(1.2, 1.0); p1.translate(0, 0.5, 0);
    const p2 = p1.clone(); p2.rotateY(Math.PI / 2);
    return mergeParts([p1, p2]);
  })();
  new Couche({
    nom: 'herbe', sel: 1, portee: 58, tuile: 12, densite: 0.70, essais: 2.2,
    fauche: { ecu: 0.035, gaufre: 0.004, couleur: 0x86b04a },
    geo: bladeGeo,
    mat: brasserAuVent(new THREE.MeshStandardMaterial({ map: T.blade, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0.055, 1.25),
    poser: (x, z, al, i, im) => {
      if (!herbeLibre(x, z)) return false;
      const y = posable(x, z); if (y < -1e3) return false;
      poseur(im, i, x, y, z, al() * TAU, 0.7 + al() * 0.6, 0.6 + al() * 0.55, 0.7 + al() * 0.6);
      return true;
    },
  });

  // ---------- 2. touffes d'herbe haute, en bouquets ----------
  const tuftGeo = (() => {
    const p1 = new THREE.PlaneGeometry(1.1, 1.5); p1.translate(0, 0.75, 0);
    const p2 = p1.clone(); p2.rotateY(Math.PI / 2.4);
    const p3 = p1.clone(); p3.rotateY(-Math.PI / 2.4);
    return mergeParts([p1, p2, p3]);
  })();
  new Couche({
    nom: 'touffes', sel: 2, portee: 155, tuile: 26, densite: 0.085, couleurs: true,
    fauche: { ecu: 0.25, gaufre: 0.02, couleur: 0xa8c060 },
    geo: tuftGeo,
    mat: brasserAuVent(new THREE.MeshStandardMaterial({ map: FORET.carteForet('brins'), alphaTest: 0.38, side: THREE.DoubleSide, roughness: 1 }), 0.075, 1),
    poser: (x, z, al, i, im) => {
      if (!libreNature(x, z)) return false;
      const y = posable(x, z); if (y < -1e3) return false;
      const sc = 0.42 + al() * 0.5;
      im.setColorAt(i, C.setRGB(0.80 + al() * 0.30, 0.88 + al() * 0.26, 0.70 + al() * 0.28));
      poseur(im, i, x, y, z, al() * TAU, sc, sc * (0.85 + al() * 0.6), sc);
      return true;
    },
  });

  // ---------- 3. fleurs des champs ----------
  const fleurGeo = (() => {
    const p1 = new THREE.PlaneGeometry(0.7, 0.7); p1.translate(0, 0.35, 0);
    const p2 = p1.clone(); p2.rotateY(Math.PI / 2);
    return mergeParts([p1, p2]);
  })();
  new Couche({
    nom: 'fleurs', sel: 3, portee: 82, tuile: 22, densite: 0.05, couleurs: true, poidsQ: 0.8,
    fauche: { ecu: 0.12, gaufre: 0.01, couleur: 0xe8d070 },
    geo: fleurGeo,
    mat: brasserAuVent(new THREE.MeshStandardMaterial({ map: flowerTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0.05, 1.4),
    poser: (x, z, al, i, im) => {
      if (!libreNature(x, z)) return false;
      const y = posable(x, z); if (y < -1e3) return false;
      const t = al();
      // la texture est monochrome : c'est la couleur d'instance qui fait les variétés
      const teintes = [[1.35, 1.35, 1.25], [1.45, 1.20, 0.40], [1.40, 0.62, 0.86], [0.66, 0.82, 1.45]];
      const k = teintes[(t * 4) | 0];
      im.setColorAt(i, C.setRGB(k[0], k[1], k[2]));
      const sc = 0.7 + al() * 0.55;
      poseur(im, i, x, y, z, al() * TAU, sc, sc, sc);
      return true;
    },
  });

  // ---------- 4. buissons ----------
  const bushGeo = (() => {
    const q1 = new THREE.PlaneGeometry(1.7, 1.25); q1.translate(0, 0.6, 0);
    const q2 = q1.clone(); q2.rotateY(Math.PI / 3);
    const q3 = q1.clone(); q3.rotateY(-Math.PI / 3);
    const q4 = q1.clone(); q4.rotateX(-Math.PI / 2.2); q4.translate(0, 0.35, 0);
    return mergeParts([q1, q2, q3, q4]);
  })();
  new Couche({
    nom: 'buissons', sel: 4, portee: 235, tuile: 40, densite: 0.013, couleurs: true, ombre: true,
    fauche: { ecu: 0.5, ecus: 2, gaufre: 0.06, couleur: 0x5f8a3a, rayon: 0.8 },
    geo: bushGeo,
    mat: brasserAuVent(new THREE.MeshStandardMaterial({ map: FORET.carteForet('buisson'), alphaTest: 0.40, side: THREE.DoubleSide, roughness: 1 }), 0.035, 0.8),
    poser: (x, z, al, i, im) => {
      if (!libreNature(x, z)) return false;
      const y = posable(x, z); if (y < -1e3) return false;
      // ils s'épaississent à l'approche du fourré : c'est la transition prairie / bois
      const sc = (0.55 + al() * 0.7) * (murD(x, z) > -70 ? 1.3 : 1);
      im.setColorAt(i, C.setRGB(0.72 + al() * 0.34, 0.82 + al() * 0.28, 0.62 + al() * 0.30));
      // UN BUISSON SUR QUARANTE EST DORÉ, et paie toujours cinq écus (cf. LA FAUCHE). Tiré
      // d'un hachage de la position et non du tirage de la tuile : sinon ajouter ce test
      // aurait déplacé tous les buissons suivants. La teinte ne ment pas trop — un œil
      // attentif la repère, un œil distrait passe à côté.
      if (estDore(x, z)) im.setColorAt(i, C.setRGB(1.30, 1.12, 0.42));
      poseur(im, i, x, y, z, al() * TAU, sc, sc * (0.8 + al() * 0.4), sc);
      return true;
    },
  });

  // ---------- 5. fougères ----------
  new Couche({
    nom: 'fougeres', sel: 5, portee: 155, tuile: 26, densite: 0.05,
    fauche: { ecu: 0.25, gaufre: 0.02, couleur: 0x5a8a3a },
    geo: FORET.fougereGeo(7), mat: FORET.fougereMat(),
    poser: (x, z, al, i, im) => {
      if (!couvert(x, z, 165)) return false;
      const y = posable(x, z); if (y < -1e3) return false;
      const h = (0.7 + al() * 0.8) * (murD(x, z) > -40 ? 1.2 : 1);
      poseur(im, i, x, y - 0.05, z, al() * TAU, h, h * (0.85 + al() * 0.35), h);
      return true;
    },
  });

  // ---------- 6. ronces : c'est elles qui rendent le fourré infranchissable À L'ŒIL ----------
  const ronceGeo = (() => {
    const q1 = new THREE.PlaneGeometry(2.3, 0.95); q1.translate(0, 0.42, 0);
    const q2 = q1.clone(); q2.rotateY(Math.PI / 2.8);
    const q3 = q1.clone(); q3.rotateY(-Math.PI / 2.2); q3.rotateX(-0.22);
    const q4 = q1.clone(); q4.rotateX(-Math.PI / 2.1); q4.translate(0, 0.22, 0);
    return mergeParts([q1, q2, q3, q4]);
  })();
  new Couche({
    nom: 'ronces', sel: 6, portee: 175, tuile: 30, densite: 0.026, couleurs: true, ombre: true,
    geo: ronceGeo,
    mat: brasserAuVent(new THREE.MeshStandardMaterial({ map: FORET.carteForet('buisson_bas'), alphaTest: 0.38, side: THREE.DoubleSide, roughness: 1 }), 0.03, 0.7),
    poser: (x, z, al, i, im) => {
      const d = murD(x, z);
      if (d < -120 && !couvert(x, z, 120)) return false;
      if (!libreNature(x, z)) return false;
      const y = posable(x, z); if (y < -1e3) return false;
      const sc = (0.6 + al() * 0.8) * (d > -50 ? 1.35 : 1);
      im.setColorAt(i, C.setRGB(0.66 + al() * 0.36, 0.76 + al() * 0.30, 0.54 + al() * 0.30));
      poseur(im, i, x, y, z, al() * TAU, sc, sc * (0.6 + al() * 0.5), sc);
      return true;
    },
  });

  // ---------- 7. bois mort ----------
  const boisGeo = (() => {
    const t = new THREE.CylinderGeometry(0.2, 0.32, 4.4, 7); t.rotateZ(Math.PI / 2); t.translate(0, 0.28, 0);
    const b1 = new THREE.CylinderGeometry(0.06, 0.12, 1.5, 5); b1.rotateZ(Math.PI / 2.6); b1.rotateY(0.7); b1.translate(1.1, 0.55, 0.3);
    const b2 = new THREE.CylinderGeometry(0.05, 0.1, 1.2, 5); b2.rotateZ(-Math.PI / 2.4); b2.rotateY(-0.5); b2.translate(-1.3, 0.5, -0.25);
    return mergeParts([t, b1, b2]);
  })();
  new Couche({
    nom: 'boisMort', sel: 7, portee: 215, tuile: 46, densite: 0.005, ombre: true, poidsQ: 0.7,
    geo: boisGeo, mat: phMat('tronc_mort_02', 1.7, 4.4, { roughness: 1 }),
    poser: (x, z, al, i, im) => {
      if (!couvert(x, z, 190)) return false;
      const y = posable(x, z); if (y < -1e3) return false;
      const sc = 0.7 + al() * 0.8;
      poseur(im, i, x, y + 0.05, z, al() * TAU, sc, sc, sc, (al() - 0.5) * 0.18, (al() - 0.5) * 0.18);
      return true;
    },
  });

  // ---------- 8. souches ----------
  const soucheGeo = (() => {
    const parts = [];
    const c = new THREE.CylinderGeometry(0.42, 0.66, 0.8, 9); c.translate(0, 0.36, 0); parts.push(c);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU, r = new THREE.CylinderGeometry(0.08, 0.2, 1.0, 5);
      r.rotateZ(1.18); r.rotateY(-a); r.translate(Math.cos(a) * 0.52, 0.11, Math.sin(a) * 0.52);
      parts.push(r);
    }
    return mergeParts(parts);
  })();
  new Couche({
    nom: 'souches', sel: 8, portee: 190, tuile: 52, densite: 0.0035, ombre: true, poidsQ: 0.7,
    geo: soucheGeo, mat: phMat('tree_roots_01', 1.9, 1.3, { roughness: 1 }),
    poser: (x, z, al, i, im) => {
      if (!couvert(x, z, 190)) return false;
      const y = posable(x, z); if (y < -1e3) return false;
      const sc = 0.75 + al() * 0.9;
      poseur(im, i, x, y - 0.12, z, al() * TAU, sc, sc * (0.7 + al() * 0.7), sc);
      return true;
    },
  });

  // Premier remplissage : on vide les files d'un coup, avant que la première image ne
  // soit rendue. Le joueur ne doit jamais voir la prairie pousser sous ses pieds.
  const px = player.pos.x, pz = player.pos.z;
  for (const c of COUCHES) { c.majFile(px, pz); c.travailler(1e9); }
  poserHorloge();

  // Niveaux de détail. On ne coupe pas les couches, on les CLAIRSEME et on raccourcit
  // leur portée : la prairie reste une prairie en qualité basse, elle est seulement
  // moins fournie et s'arrête plus tôt dans la brume.
  Q.hooks.push((l) => {
    const fr = [1, 0.72, 0.45, 0.24][l], po = [1, 0.88, 0.72, 0.55][l];
    for (const c of COUCHES) { c.frac = fr * c.poidsQ; c.facteur = po; c.refaire(); }
    if (perf.roseaux) perf.roseaux.visible = l < 3;
    if (perf.nenuphars) perf.nenuphars.visible = l < 2;
    if (perf.saules) for (const m of perf.saules) m.castShadow = l < 1;
    if (perf.rideaux) for (const m of perf.rideaux) m.receiveShadow = l < 2;
  });
  console.log('semis par tuiles : %d couches, %s instances réservées, %s vivantes',
    COUCHES.length,
    COUCHES.reduce((a, c) => a + c.cap, 0),
    COUCHES.reduce((a, c) => a + c.vivantes, 0));
}

export function buildMountains() {
  const N = 240, SIZE = 800 * ECH, geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
  const noise = fbm(256, 256, 6, 7), noise2 = fbm(256, 256, 3, 19), noise3 = fbm(256, 256, 4, 43);
  const pos = geo.attributes.position, colors = [];
  const cGrass = new THREE.Color(0x5a8a3a), cRock = new THREE.Color(0x6e6a62), cSnow = new THREE.Color(0xf2f4f8), cDark = new THREE.Color(0x3f4a3a);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), zz = -pos.getY(i), r = Math.hypot(x, zz);
    const u = ((x / SIZE + 0.5) * 255) | 0, v = ((zz / SIZE + 0.5) * 255) | 0, n = noise[v * 256 + u], n2 = noise2[v * 256 + u];
    const t = clamp((r - (PLAINE_R - 2)) / (110 * ECH * 0.55), 0, 1);
    const ridge = 1 - Math.abs(2 * noise3[v * 256 + u] - 1); // crêtes vives
    let hgt = Math.pow(t, 1.4) * 150 * (0.35 + n * 0.7 + ridge * 0.55) + t * n2 * 30;
    hgt = r < PLAINE_R - 2 ? -6 : hgt + 0.15; // sous la plaine à l'intérieur, juste au-dessus de l'herbe à l'extérieur
    pos.setZ(i, hgt);
    const c = new THREE.Color();
    if (hgt < 6) c.copy(cGrass).lerp(cDark, n * 0.4); else if (hgt < 34) c.copy(cGrass).lerp(cRock, clamp((hgt - 6) / 14, 0, 1)).lerp(cDark, n2 * 0.4); else c.copy(cRock).lerp(cSnow, clamp((hgt - 48) / 18, 0, 1) * (0.7 + ridge * 0.3));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m);
  // sapins sur les premières pentes
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 6), coneGeo = new THREE.ConeGeometry(2.4, 7, 7);
  const FIRS = 1200;
  const firs = new THREE.InstancedMesh(coneGeo, mat(0x2f5a34, { roughness: 1 }), FIRS), trunks = new THREE.InstancedMesh(trunkGeo, mat(0x4a3320), FIRS);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
  let k = 0;
  for (let i = 0; i < FIRS; i++) {
    const a = rand(0, TAU), r = rand(PLAINE_R + 4, PLAINE_R + 68 * ECH * 0.6), x = Math.cos(a) * r, zz = Math.sin(a) * r;
    const u = ((x / SIZE + 0.5) * 255) | 0, v = ((zz / SIZE + 0.5) * 255) | 0, n = noise[v * 256 + u], n2 = noise2[v * 256 + u];
    const ridge = 1 - Math.abs(2 * noise3[v * 256 + u] - 1);
    const t = clamp((r - (PLAINE_R - 2)) / (110 * ECH * 0.55), 0, 1), hgt = Math.pow(t, 1.4) * 150 * (0.35 + n * 0.7 + ridge * 0.55) + t * n2 * 30;
    if (hgt > 55 || nearTown(x, zz, 14)) continue;   // les sapins ne descendent pas sur le bourg
    const s = rand(0.8, 1.5);
    P.set(x, hgt + 3.5 * s, zz); Q.setFromEuler(E.set(0, a, 0)); S.setScalar(s); firs.setMatrixAt(k, M.compose(P, Q, S));
    P.set(x, hgt + 1.5 * s, zz); trunks.setMatrixAt(k, M.compose(P, Q, S)); k++;
  }
  firs.count = trunks.count = k; firs.castShadow = true; scene.add(firs, trunks);
}
export function flowerTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#3a7a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 64); g.quadraticCurveTo(36, 40, 32, 22); g.stroke();
  const col = ['#ffffff', '#ffe066', '#ff6fa0', '#8fb6ff'][Math.floor(Math.random() * 4)];
  for (let k = 0; k < 5; k++) { const a = k * TAU / 5; g.fillStyle = col; g.beginPath(); g.ellipse(32 + Math.cos(a) * 9, 20 + Math.sin(a) * 9, 7, 5, a, 0, TAU); g.fill(); }
  g.fillStyle = '#ffb020'; g.beginPath(); g.arc(32, 20, 4.5, 0, TAU); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
