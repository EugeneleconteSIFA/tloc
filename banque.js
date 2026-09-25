// banque.js — tout ce qui dépend de la présence de assets_back/.
//
// Un seul endroit décide si la banque d'assets est là, et chaque fabrique retombe sur sa
// version procédurale quand elle ne l'est pas. Le jeu ne casse jamais faute d'un fichier.
import * as E from './engine.js?v=27';
import * as A from './assets.js';
import * as GEANTS from './geants.js';
import * as PNJ from './pnj.js';
import { THREE,
  SKIN, boxG, makeArm, makeGiant, makeHead, makeLeg, makeTorso, mat, mesh, setAnimHook, setMaker,
  sphG,
} from './engine.js?v=27';

export const TOWN_PROPS = [
  'megakit:Prop_Wagon', 'megakit:Prop_Crate', 'megakit:Prop_WoodenFence_Single', 'megakit:Prop_Vine1',
  'props:Stall_Empty', 'props:Stall_Cart_Empty', 'props:FarmCrate_Apple', 'props:FarmCrate_Carrot',
  'props:Barrel_Apples', 'props:Barrel', 'props:Banner_1', 'props:Banner_2', 'props:Crate_Wooden',
];

export let PROPS_OK = false;
try { await A.preload(TOWN_PROPS); PROPS_OK = true; }
catch (e) { console.warn('assets_back indisponible, village sans props externes :', e.message); }

// Lydéric et Phinaert sur le squelette riggé + banque d'animations. Si ça échoue,
// GEANTS.buildGeant() renvoie null partout et les géants procéduraux reprennent.
const [GEANTS_OK, PNJ_OK] = await Promise.all([GEANTS.prepare(), PNJ.prepare()]);

export const CAMILLE_OK = PNJ_OK && await PNJ.installerCamille(E);
if (GEANTS_OK) {
  E.setMaker('phinaert', () => GEANTS.buildGeant('phinaert') || makeGiant(0x7a1f1f, 0x333333, 'club'));
  E.setAnimHook('phinaert', GEANTS.animeGeant);
}

export const geant = (role, ...secours) => (GEANTS_OK && GEANTS.buildGeant(role)) || makeGiant(...secours);

// =====================================================================
//  Géométrie de la citadelle
// =====================================================================
// Le tracé vient de carte/citadelle.json, tiré de l'OpenStreetMap de Lille
// (cf. carte/README.md) : le corps de place bastionné en mètres, origine au centre,
// Porte Royale au sud. Si le fichier manque, on retombe sur le pentagone régulier —
// le jeu ne casse jamais faute d'un fichier.

export function makeVillager(kind) {
  const rigge = PNJ_OK && PNJ.buildVillageois(kind);
  if (rigge) return rigge;
  return makeVillagerProc(kind);
}

export function makeVillagerProc(kind) {
  const g = new THREE.Group();
  const palettes = [[0x8a3a2a, 0x3a2a1a, 0xf0e6d0], [0x2a4a7a, 0x4a3320, 0xe8e0c8], [0x4a6a3a, 0x2a2a2a, 0xf0e6d0], [0x7a3a6a, 0x3a2a1a, 0xf0e6d0], [0xc8a060, 0x5a3a22, 0xffffff], [0x3a3a4a, 0x2a2a2a, 0xd8d0c0]];
  const [tunicC, pantsC, shirtC] = palettes[kind % palettes.length];
  const skinC = [SKIN, 0xc9926a, 0xe6b898, SKIN, 0xd39d7a, 0xf0c8a8][kind % 6], hairC = [0x3a2a1a, 0x1a1210, 0xc8a050, 0x5a3a1a, 0x8a8a8a, 0x2a1a10][kind % 6];
  const skin = mat(skinC, { roughness: 0.65 }), tunic = mat(tunicC, { roughness: 0.9 }), pants = mat(pantsC, { roughness: 0.9 });
  const female = kind % 2 === 0;
  const torso = makeTorso({ top: tunic, bottom: pants, belt: mat(0x3a2a1a), female, width: female ? 0.95 : 1.1 }); g.add(torso);
  for (let k = 0; k < 4; k++) g.add(mesh(sphG(0.02, 5), mat(0xe8d8a0), 0, 1.45 + k * 0.14, female ? 0.33 : 0.38)); // boutons
  const styles = ['bun', 'short', 'long', 'bald', 'bonnet', 'short'];
  const headG = makeHead({ skin: skinC, hair: hairC, style: styles[kind % 6], iris: [0x3a6a4a, 0x5a4a2a, 0x2a5a8a][kind % 3], female, beard: kind === 3 ? 0x8a8a8a : (kind === 5 ? 0x2a1a10 : null), moustache: kind === 1 ? 0x1a1210 : null, bonnet: shirtC });
  headG.position.set(0, 2.4, 0); g.add(headG); const head = headG;
  if (kind % 3 === 0 && !female) { g.add(mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 12), mat(0x3a2a1a), 0, 2.78, 0)); g.add(mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.32, 12), mat(0x3a2a1a), 0, 2.96, 0)); }
  if (kind === 3) { g.add(mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 12), mat(0x3a2a1a), 0, 2.78, 0)); g.add(mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.32, 12), mat(0x3a2a1a), 0, 2.96, 0)); }
  if (female) { const apron = mesh(boxG(0.56, 0.95, 0.05), mat(shirtC, { roughness: 1 }), 0, 1.3, 0.3); g.add(apron); g.add(mesh(new THREE.CylinderGeometry(0.32, 0.5, 0.9, 14, 1, true), mat(pantsC, { roughness: 1, side: THREE.DoubleSide }), 0, 0.85, 0)); } // tablier + jupe
  const legs = [];
  for (const sx of [-1, 1]) { const hip = makeLeg(sx, { cloth: pants, boot: mat(0x2a1a10) }); hip.position.set(sx * 0.17, 0.95, 0); g.add(hip); legs.push(hip); }
  const arms = [];
  for (const sx of [-1, 1]) { const sh = makeArm(sx, { skin, sleeve: tunic, cuff: mat(shirtC) }); sh.position.set(sx * 0.46, 1.95, 0); g.add(sh); arms.push(sh); }
  g.userData = { legs, arms, head, dynamic: true };
  return g;
}
