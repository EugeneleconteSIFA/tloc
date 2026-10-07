// quetes.js — la partie qui se joue.
//
// Secteur Quêtes : peuplement du niveau, dialogues, journal, objectifs, cinématiques,
// et la boucle de jeu propre au niveau (update). Le décor lui est donné tout bâti.
import {
  lieux, estDecouvert,
  THREE, G, SFX, TAU, addCap, addInteract, blocked, burst, camera, cut, cutscene, dialogue, endGame, enemies,
  followActor, getH, goToLevel, hideMenu, lerp, phMat, makeChest, makePrince, player, questStep, rand, saveGame, scene, setQuest,
  showMenu, showMessage, spawnEnemy, spawnGaufre, state, naviguer, keys, sun, hemi, renderer, bloom, sky, SUN_DIR,
} from './engine.js?v=41';
import {
  APO, BAST_H, COURTINES, DONJON, ECH, FERME, HOUSE, MOAT_IN, MOAT_OUT, PONT_Z1, TOWN, bastionAt, bastions, dehorsAt, eauVisible, nappeProche, sdEau, townWorld,
  onBridge, sdPent,
} from './carte.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARTAGE, ETAPES_ACTE1, etapeActe1, passerActe1 } from './etat.js';
import { POTERNE_JEU, ACTE1_CITADELLE } from './citadelle.js';
import { geant } from './banque.js';
import * as PNJ from './pnj.js';
import * as BOURSE from './bourse.js';
import { FAUCHE_DEBUG, bleFauche } from './nature.js';
import * as ATLAS from './atlas.js';

// la place de Lydéric sur le pont : 78 m devant la Porte Royale, au tiers du tablier, là où
// les plans du découpage (docs/DECOUPAGE-PROLOGUE.md, plans 8 à 10) prennent la porte en fond
const LYD_X = -1.2, LYD_Z = APO + 78;

export function populate() {
  const fosseAngles = [0.3, 1.4, 2.4, 3.6, 4.6, 5.5];
  fosseAngles.forEach((a, i) => {
    const r = APO + 7; const x = Math.cos(a) * r / Math.cos(((a + Math.PI / 2) % (TAU / 5)) - Math.PI / 5), z = Math.sin(a) * r / Math.cos(((a + Math.PI / 2) % (TAU / 5)) - Math.PI / 5);
    if (Math.abs(x) < 10 * ECH && z > 0) return;
    spawnEnemy(i % 2 ? 'corbeau' : 'moule', x, z, 'fosses');
  });
  spawnEnemy('moule', -30 * ECH, APO + 6 * ECH, 'fosses'); spawnEnemy('moule', 30 * ECH, APO + 6 * ECH, 'fosses'); spawnEnemy('corbeau', -48 * ECH, 10 * ECH, 'fosses');
  for (const c of COURTINES) spawnEnemy('fantome', c.mx - c.nx * 12, c.mz - c.nz * 12, 'remparts');
  spawnEnemy('corbeau', 20 * ECH, -20 * ECH, 'remparts'); spawnEnemy('corbeau', -22 * ECH, 18 * ECH, 'remparts');
  // les quatre corbeaux du champ d'Émile (quête secondaire), près du moulin
  for (const [dx, dz] of [[-16, -11], [-10, -6], [4, -15], [9, -10]]) spawnEnemy('corbeau', FERME.x + dx * ECH, FERME.z + dz * ECH, 'champ');
  for (const b of bastions) spawnEnemy('fantome', b.V[0] + b.u[0] * 8 * ECH, b.V[1] + b.u[1] * 8 * ECH, 'bastions');
  // le boss attend dans l'enclos du donjon
  const boss = spawnEnemy('phinaert', DONJON.x, DONJON.z + 18, 'donjon'); boss.caged = true; boss.home.set(DONJON.x, DONJON.z + 18, 0);
  spawnGaufre(-14 * ECH, APO + 7 * ECH); spawnGaufre(40 * ECH, -10 * ECH); spawnGaufre(12 * ECH, 10 * ECH); spawnGaufre(-8 * ECH, 30 * ECH);
  spawnGaufre(bastions[0].V[0] + bastions[0].u[0] * 14 * ECH, bastions[0].V[1] + bastions[0].u[1] * 14 * ECH);
  spawnGaufre(bastions[3].V[0] + bastions[3].u[0] * 14 * ECH, bastions[3].V[1] + bastions[3].u[1] * 14 * ECH);
  // Les petits coffres à écus des bastions (bourse.js) : un par bastion, sauf celui de
  // Turenne qui a déjà le coffre de l'arc. Posés vers la pointe, là où l'on ne va que pour
  // le plaisir de la vue — et cherchés en spirale sur une dalle libre (canons, guérites).
  // joignable en ligne droite depuis l'arrivée de la rampe sur le terre-plein (on y monte
  // forcément), ou à défaut depuis le centre du bastion — celui du Dauphin porte le mât
  const joignableDuCoeur = (b, x, z) => {
    const libre = (ax, az) => { for (let t = 0; t <= 1.0001; t += 0.05) if (blocked(ax + (x - ax) * t, az + (z - az) * t, 0.5, false, BAST_H + 0.1)) return false; return true; };
    // l'arrivée de la rampe touche ses garde-corps, le centre porte le mât : on part du point
    // libre le plus proche de chacun
    const depuis = (px, pz) => { for (let r = 0; r <= 8; r += 0.5) for (let k = 0; k < 16; k++) {
      const x1 = px + Math.cos(k / 16 * Math.PI * 2) * r, z1 = pz + Math.sin(k / 16 * Math.PI * 2) * r;
      if (bastionAt(x1, z1) && !blocked(x1, z1, 0.5, false, BAST_H + 0.1)) return libre(x1, z1); } return false; };
    const s = (b.sPalier ?? 0) + 3, t = b.tRampe ?? 0;
    if (depuis(b.V[0] + b.u[0] * s + b.v[0] * t, b.V[1] + b.u[1] * s + b.v[1] * t)) return true;
    return depuis(b.poly.reduce((a, q) => a + q[0], 0) / b.poly.length, b.poly.reduce((a, q) => a + q[1], 0) / b.poly.length);
  };
  bastions.forEach((b, i) => {
    if (i === 3) return;
    // d'abord vers la pointe ; à défaut, autour de l'arrivée de la rampe (au Dauphin, rien de
    // joignable près de la pointe : ses parapets suivent les faces théoriques, pas le relevé)
    const sP = (b.sPalier ?? 0) + 3, tP = b.tRampe ?? 0;
    for (const [x0, z0] of [[b.V[0] + b.u[0] * 10 * ECH, b.V[1] + b.u[1] * 10 * ECH], [b.V[0] + b.u[0] * sP + b.v[0] * tP, b.V[1] + b.u[1] * sP + b.v[1] * tP]])
    for (let r = 0; r < 40; r += 1.5) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      if (!bastionAt(x, z) || blocked(x, z, 1.2, false, BAST_H + 0.1) || !BOURSE.aCielOuvert(x, BAST_H, z)) continue;
      // du bon côté du parapet : au Dauphin, la dalle « libre » était la bande du bastion AU-DELÀ
      // de son parapet (1,4 m), côté fossé — on n'y allait ni à pied ni en sautant (banc
      // d'accessibilité, 29 septembre). On exige une ligne droite dégagée depuis le cœur du
      // terre-plein jusqu'au coffre.
      if (!joignableDuCoeur(b, x, z)) continue;
      BOURSE.petitCoffre('bastion-' + i, x, BAST_H, z, 12 + i, Math.atan2(-b.u[0], -b.u[1]));
      COFFRES_VAUBAN.push({ id: 'bastion-' + i, x, z });       // (les plans de Vauban les marquent : la marchande, E3)
      return;
    }
  });
  // coffre de l'arc sur le bastion de Turenne
  { const b = bastions[3]; PARTAGE.bowChest = makeChest(); const cx = b.V[0] + b.u[0] * 12 * ECH, cz = b.V[1] + b.u[1] * 12 * ECH;
    PARTAGE.bowChest.position.set(cx, BAST_H, cz); PARTAGE.bowChest.rotation.y = Math.atan2(-b.u[0], -b.u[1]); scene.add(PARTAGE.bowChest); PARTAGE.bowChest.userData.pos = new THREE.Vector3(cx, BAST_H, cz); addCap(cx, cz, cx, cz, 0.9);
    COFFRES_VAUBAN.push({ id: 'arc', x: cx, z: cz, fait: () => !!state.bowChest }); }
  // Lydéric près du pont
  // APO + MOAT_OUT ne donne PAS le bout du pont : MOAT_OUT est une distance au polygone,
  // et plein sud le fossé s'étend bien au-delà. Lydéric et Camille se retrouvaient donc
  // au milieu de l'eau. On part du bout du pont, mesuré par carte.js.
  // LE PONT DE FIN, C'EST LE PONT DE LA PORTE ROYALE (Eugène, 1er octobre — découpage du
  // prologue). Au bout du pont, dans le pré, les arbres bouchaient tous les plans ; sur le
  // tablier, la Porte Royale est dans le dos de Lydéric, et c'est par elle que Phinaert
  // s'enfuit. Le tablier n'a que 5 m utiles (parapets à ±3 m) : Lydéric se tient à gauche de
  // l'axe, face à la plaine, et sa capsule ne prend que ses pieds — on passe à côté de lui.
  PARTAGE.lyderic = geant('lyderic', 0x2b4fa8, 0xe0b64a, 'sword'); PARTAGE.lyderic.position.set(LYD_X, getH(LYD_X, LYD_Z), LYD_Z); PARTAGE.lyderic.rotation.y = 0;
  scene.add(PARTAGE.lyderic); addCap(LYD_X, LYD_Z, LYD_X, LYD_Z, 1.2); PARTAGE.lyderic.userData.talkCd = 0;
  // 7 m : un géant de 7,6 m se parle de plus loin qu'un villageois, et Camille se relève à 6,5 m de lui
  addInteract({ pos: PARTAGE.lyderic.position, r: 7, prompt: () => 'parler à Lydéric', fn: talkLyderic });
  // LE MORCEAU DE CLOCHE (STORY.md § 2 ; découpage, plan 17) : après l'enlèvement, un éclat de
  // la Grande Cloche fume sur les planches. Camille le garde ; personne n'en parle avant
  // l'acte VI. Un éclat de la robe — le même profil que la cloche du beffroi, un huitième de
  // tour, réduit — en bronze photographié.
  { const prof = [[0.53, 0.5], [0.58, 0.75], [0.68, 0.98], [0.86, 1.18], [0.95, 1.26]].map(([r, y]) => new THREE.Vector2(r * 0.45, -y * 0.45));
    const g = new THREE.LatheGeometry(prof, 4, 0, 0.75); g.center();
    const m = new THREE.Mesh(g, phMat('metal_plate_02', 0.3, 0.3, { color: 0xd09a58, roughness: 0.4, side: THREE.DoubleSide, emissive: 0x5a1a04, emissiveIntensity: 0.6 }));
    const x = 0.2, z = LYD_Z + 3.2; m.position.set(x, getH(x, z) + 0.05, z); m.rotation.set(0.55, 0.6, 0.35);   // calé sur sa tranche : à plat, il se perdait dans les planches m.castShadow = true; m.userData.dynamic = true;
    m.visible = false; scene.add(m); PARTAGE.morceau = m;
    // portée 3 m : à 3 m de lui, Lydéric (portée 7) gagnait le choix d'engine.js, qui rapporte la distance à la portée
    addInteract({ pos: m.position, r: 3, enabled: () => m.visible, prompt: () => 'ramasser le morceau de métal', fn: () => {
      state.morceauCloche = true; m.visible = false; SFX.pickup(); saveGame(true);
      showMessage('Un morceau de la Grande Cloche. Il est chaud.', 5); } }); }
  // le PARTAGE.prince Eugène : présent au pont pour l'intro, puis aux côtés de Camille une fois libéré
  // riggé comme les villageois (la version en primitives ne sert plus que de repli), et à
  // la même échelle qu'eux : l'ancien prince, jamais réduit, dépassait Camille d'une tête
  PARTAGE.prince = PNJ.buildRole('prince') || makePrince(); PARTAGE.prince.scale.setScalar(G.echelle);
  PARTAGE.prince.position.set(1.5, 0, LYD_Z + 2); PARTAGE.prince.rotation.y = Math.PI; PARTAGE.prince.visible = false; scene.add(PARTAGE.prince);
  // LE PASSAGE VERS L'ÎLE DU TEMPS — provisoire (Eugène, 1er octobre). Dans STORY.md, Phinaert
  // ouvre le Temple depuis la dalle du donjon, avec le sang d'Eugène, à la fin de l'acte I ;
  // tant que l'acte I n'est pas écrit, une dalle gravée devant la grille de l'enclos y mène
  // librement, pour qu'on puisse s'y promener. Elle luit du violet de l'île.
  { const x = DONJON.x + 7, z = DONJON.gateZ + 6, y = getH(x, z);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.18, 8), phMat('old_stone_wall_02', 3, 3, { color: 0xc8beac }));
    d.position.set(x, y + 0.09, z); d.receiveShadow = true; d.userData.dynamic = true; scene.add(d);
    const lueur = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 8), new THREE.MeshBasicMaterial({ color: 0xb8a0e0, transparent: true, opacity: 0.55 }));
    lueur.rotation.x = -Math.PI / 2; lueur.rotation.z = Math.PI / 8; lueur.position.set(x, y + 0.19, z); lueur.userData.dynamic = true; scene.add(lueur);
    PARTAGE.dalleTemple = lueur;
    // (6 octobre) pendant l'acte I, c'est Phinaert qui ouvre le Temple (la porte de lumière,
    // citadelle.js) : la dalle se cache jusque-là, puis reste le chemin du retour vers l'île
    const ouverte = () => !acte1() || atteint('temple');
    d.userData.ouverte = lueur.userData.ouverte = ouverte; PARTAGE.dalleTempleSocle = d;
    addInteract({ pos: d.position, r: 2.2, enabled: ouverte, prompt: () => 'poser la main sur la dalle gravée',
      fn: () => goToLevel('temple', [0, 0, 23.5], Math.PI, 'La pierre s’ouvre sur une lumière violette…') }); }
  // Houtland et le vieux mage, devant la salle de la garde le temps du prologue seulement :
  // leurs répliques d'après (« dix hommes poussent la grande grille ») attendent l'acte I
  for (const [cle, role] of [['houtland', 'houtland'], ['mageBourg', 'mage']]) {
    const v = PNJ.buildRole(role); if (!v) continue;
    v.scale.setScalar(G.echelle); v.visible = false; scene.add(v); PARTAGE[cle] = v; }
  player.pos.set(1, 0, LYD_Z + 9); player.yaw = Math.PI; G.camYaw = Math.PI;
  player.speed = 11.5;   // la citadelle fait 700 m de large : à 7,2 m/s on la traversait en deux minutes
  ACTE1_CITADELLE.populate();   // les étapes 9 et 10 de l'acte I : citadelle.js
}

export const KILLS_TO_OPEN = 10;

export function aliveMonsters() { return enemies.filter(e => !e.dead && !e.k.boss).length; }

export function killsDone() { return enemies.filter(e => e.dead && !e.k.boss).length; }

export function killsLeft() { return Math.max(0, KILLS_TO_OPEN - killsDone()); }

export function openGate() {
  state.gateOpen = true; PARTAGE.donjonGate.userData.open = true; PARTAGE.donjonGate.userData.cap.r = 0;
  const boss = enemies.find(e => e.k.boss); if (boss && !boss.dead) { boss.caged = false; boss.state = 'chase'; }
}

export function onKill(e) {
  if (ACTE1_CITADELLE.onKill(e)) return;             // les créatures de l'acte I (citadelle.js) : leurs clés, leurs billets
  BOURSE.prime(e);                                   // la prime tombe avant tout le reste
  if (e.k.boss) { state.bossDead = true; saveGame(true);
    setTimeout(() => cutscene([
      { cam: [DONJON.x + 9, 5, DONJON.z + 16], at: [DONJON.x, 4, DONJON.z + 6], cam2: [DONJON.x + 3, 3, DONJON.z + 10], at2: [DONJON.x, 5, DONJON.z], dur: 4, text: "Phinaert s'effondre dans un nuage de poussière. Le donjon est libre…", shake: 0.8 },
      { cam: [DONJON.x + 3, 9, DONJON.z + 12], at: [DONJON.x, DONJON.h, DONJON.z], cam2: [DONJON.x + 2, 14, DONJON.z + 9], at2: [DONJON.x, DONJON.h + 1, DONJON.z], dur: 3.5, text: "…et tout en haut, dans un coffre, la clé des galeries de Vauban attend Camille." },
    ], () => { showMessage("Monte l'escalier en colimaçon du donjon jusqu'au coffre de la clé.", 5); }), 900); return; }
  const c = { fosses: 0, remparts: 0, bastions: 0, champ: 0 };
  for (const x of enemies) if (!x.dead && !x.k.boss) c[x.zone] = (c[x.zone] || 0) + 1;
  if (e.zone === 'champ') { if (c.champ === 0 && questStep('crows') === 1) setQuest('crows', 2); else if (c.champ > 0 && questStep('crows') >= 1) showMessage(`Encore ${c.champ} corbeau${c.champ > 1 ? 'x' : ''} sur le champ d'Émile.`, 2.5); return; }
  if (e.zone === 'remparts' && e.kind === 'fantome' && questStep('ghosts') === 1 && enemies.filter(x => !x.dead && x.zone === 'remparts' && x.kind === 'fantome').length === 0) setQuest('ghosts', 2);
  if (killsLeft() === 0 && !state.gateOpen) {
    setTimeout(bossReveal, 1000);
  } else if (!state.gateOpen && killsLeft() > 0 && killsLeft() % 3 === 0) { showMessage(`Encore ${killsLeft()} monstres avant que la grille du donjon ne s'ouvre.`, 3); }
  else if (c[e.zone] === 0) { saveGame(true); showMessage(({ fosses: 'Les fossés sont nettoyés !', remparts: 'Les remparts sont libérés !', bastions: 'Les cinq bastions sont repris !' })[e.zone], 3.5); }
}
// cinématique : la grille de l'enclos se lève, Phinaert apparaît

export function bossReveal() {
  const D = DONJON, gz = D.gateZ;
  cutscene([
    { cam: [D.x + 10, 4, gz + 14], at: [D.x, 2, gz], cam2: [D.x + 6, 3, gz + 8], at2: [D.x, 2.5, gz], dur: 3.5, text: 'Un grondement monte du donjon… la grille de l\'enclos se lève.', fn: () => { SFX.roar(); openGate(); G.shake = 1; } },
    { cam: [D.x + 6, 3, gz - 4], at: [D.x, 6, D.z + 8], cam2: [D.x + 4, 5, gz - 1], at2: [D.x, 7, D.z + 8], dur: 4, title: 'PHINAERT', sub: 'Géant brigand de Lille', shake: 0.6, fn: () => { setTimeout(() => SFX.roar(), 1500); } },
    { say: "« Camille ! Tu as osé toucher à mes monstres ? Eugène est à moi, et le donjon aussi. Approche, que je t'écrase ! »", who: 'Phinaert' },
  ], () => { saveGame(true); showMessage('Esquive son onde de choc avec une roulade (Maj) ou saute par-dessus (X) !', 5); });
}

export function onLoad(snap) {
  // Au sortir des galeries, la cave vise l'ancienne poterne relevée (117,9 ; 139,5) : depuis
  // que la poterne est ramenée dans la place (POTERNE_JEU, citadelle.js), ce point tombe
  // dans le fossé, et Camille était repêchée ailleurs. Seule la ville connaît la poterne
  // bâtie : c'est elle qui pose Camille devant sa grille, tournée vers la place.
  if (sessionStorage.getItem('tloc_arrive') === 'cave' && POTERNE_JEU) {
    const x = POTERNE_JEU.x - 3.6, z = POTERNE_JEU.z;
    player.pos.set(x, getH(x, z), z); player.yaw = -Math.PI / 2; G.camYaw = player.yaw;
  }
  // une sauvegarde prise pendant le prologue (une récolte, un lieu découvert) : l'histoire
  // n'a pas commencé, on la reprend au début plutôt que de lâcher Camille sans rien
  if (!state.introSeen) setTimeout(debut, 0);
  if (state.bowChest && PARTAGE.bowChest) PARTAGE.bowChest.userData.lid.rotation.x = -1.9;
  if (state.keyChest && PARTAGE.keyChest) PARTAGE.keyChest.userData.lid.rotation.x = -1.9;
  if (state.gateOpen) { openGate(); PARTAGE.donjonGate.userData.poser(1); }
  if (state.galleryOpen) { PARTAGE.poterneGrille.position.y = 2.8; PARTAGE.poterneGrille.userData.cap.r = 0; }
  const boss = enemies.find(e => e.k.boss); if (boss && !boss.dead && !state.gateOpen) boss.caged = true;
  if (killsLeft() === 0 && !state.gateOpen) openGate();
  // TOWN.y : le chat se pose sur le dallage du bourg, qui n'est plus à la cote 0
  if (state.catFound && PARTAGE.pralin) { PARTAGE.pralin.position.set(...(([a, b]) => [a, TOWN.y, b])(townWorld(-8.6, -1.4))); PARTAGE.pralin.rotation.y = 1.2 + TOWN.a; }
  // l'acte I : la grande grille reste baissée tant que la citadelle n'est pas reprise
  if (acte1() && !atteint('citadelle') && PARTAGE.herse) PARTAGE.herse.userData.poser(1);
  if (state.princeFreed && PARTAGE.prince) { PARTAGE.prince.visible = true; PARTAGE.prince.position.set(player.pos.x - Math.sin(player.yaw) * 2, 0, player.pos.z - Math.cos(player.yaw) * 2); }
}
// =====================================================================
//  Logique propre au niveau
// =====================================================================

export let lastSafe = null, chirpT = 2, stepT = 0;

// même règle que levelBlocked : le trait de rive du terrain creusé, pas une bande
// et comme elle, seulement là où l'eau se voit (eauVisible) : pas de noyade dans une eau cachée sous l'herbe
export function inWater(x, z, y) { return sdEau(x, z) < -1.5 && eauVisible(x, z) && !onBridge(x, z) && !bastionAt(x, z) && !dehorsAt(x, z) && y < 0.4; }

export function update(dt) {
  const p = player;
  if (PRO.etape) suivrePrologue();
  tickActe1(dt);
  if (FOULE.aFaire.length) grossirFoule();
  if (FOULE.geants && FOULE.geants.length) avancerProcession(dt);
  for (const v of [PARTAGE.houtland, PARTAGE.mageBourg]) if (v && v.visible) PNJ.animeVillageois(v, dt, false);
  // LA FOULE COÛTE : seize passants animés sur le pont, c'était 7 ms de plus par image (banc
  // du 1er octobre, 30 → 37 ms). Au-delà de 90 m on ne les anime plus ; entre 20 et 90 m,
  // une image sur deux, avec le double du temps (le surcoût tombe à ~3 ms) ; de près, à
  // pleine cadence, là où l'œil verrait la saccade. Leurs ombres restent : sans elles, ils
  // flottaient, pour 2 ms seulement.
  { const c = camera.position;
    for (const v of FOULE.gens) { const d = Math.abs(v.position.x - c.x) + Math.abs(v.position.z - c.z);
      if (d < 20) PNJ.animeVillageois(v, dt, false);
      else if (d < 90 && (v.userData.tic = !v.userData.tic)) PNJ.animeVillageois(v, 2 * dt, false); } }
  if (PRO.botte && !PRO.posee && !p.pose) {
    // portée couchée dans les bras, en travers ; tendue debout vers Lydéric quand elle la lui offre
    const b = PRO.botte, e = G.echelle / 0.6, av = PRO.tend ? 0.75 : 0.42;
    if (PRO.tend) { b.rotation.set(0, p.yaw, 0); b.position.set(p.pos.x + Math.sin(p.yaw) * av, p.pos.y + 0.55 * e, p.pos.z + Math.cos(p.yaw) * av); }
    else {
      b.rotation.set(0, p.yaw + Math.PI / 2, 1.35);
      // le lien au creux des bras : on recule l'origine (le pied) le long de la gerbe
      const ax = new THREE.Vector3(0, 1, 0).applyEuler(b.rotation);
      b.position.set(p.pos.x + Math.sin(p.yaw) * av - ax.x * LIEN_H, p.pos.y + 0.95 * e - ax.y * LIEN_H, p.pos.z + Math.cos(p.yaw) * av - ax.z * LIEN_H);
    }
  }
  // la Grande Cloche : elle se balance quand Eugène la sonne, et reste fendue après l'enlèvement
  const cl = PARTAGE.cloche;
  if (cl) {
    cl.fente.visible = PRO.fendue || !!state.introSeen;
    if (PRO.sonneT >= 0) { PRO.sonneT += dt; cl.joug.rotation.z = Math.sin(PRO.sonneT * 2.4) * 0.38 * Math.exp(-PRO.sonneT * 0.12);
      if (PRO.sonneT > 30) { PRO.sonneT = -1; cl.joug.rotation.z = 0; } }
  }
  // le morceau de cloche : sur le pont dès l'enlèvement joué, tant qu'on ne l'a pas ramassé ; il fume
  if (PARTAGE.morceau) { const m = PARTAGE.morceau; m.visible = !!state.introSeen && !state.morceauCloche && !cut.active;
    if (m.visible && (PRO.fumeT = (PRO.fumeT || 0) - dt) <= 0) { PRO.fumeT = 0.45; burst(m.position.x, m.position.y + 0.2, m.position.z, 0x5a4a44, 3, 0.5, 1.8, -1.4, 1.6); } }
  // la dalle de l'île respire, doucement
  if (PARTAGE.dalleTemple) { PARTAGE.dalleTemple.material.opacity = 0.4 + Math.sin(state.time * 1.3) * 0.18;
    PARTAGE.dalleTemple.visible = PARTAGE.dalleTempleSocle.visible = PARTAGE.dalleTemple.userData.ouverte(); }
  // la herse de la Porte Royale qui retombe derrière Phinaert, le temps de la cinématique
  if (PRO.herseT >= 0 && PARTAGE.herse) { PRO.herseT += dt; const f = Math.min(1, PRO.herseT / 0.9); PARTAGE.herse.userData.poser(f * f); }
  // ambiance : pépiements d'oiseaux et bruits de pas
  chirpT -= dt; if (chirpT <= 0) { chirpT = rand(2, 7); if (Math.random() < 0.8) SFX.chirp(); }
  // douves : si Camille tombe à l'eau, elle est repêchée au dernier endroit sûr
  if (!lastSafe) lastSafe = p.pos.clone();
  if (inWater(p.pos.x, p.pos.z, p.pos.y)) { p.pos.copy(lastSafe); p.vy = 0; p.kb.set(0, 0, 0); SFX.roll(); showMessage("Plouf ! L'eau des douves est glacée… Camille se hisse sur la berge.", 3); }
  else if (p.onGround && !inWater(p.pos.x, p.pos.z, 0)) { if (sdEau(p.pos.x, p.pos.z) > 1.2 || onBridge(p.pos.x, p.pos.z) || bastionAt(p.pos.x, p.pos.z) || dehorsAt(p.pos.x, p.pos.z)) lastSafe.copy(p.pos); }
  // coffres
  for (const [ch, flag, onOpen] of [[PARTAGE.bowChest, 'bowChest', () => { state.bow = true; showMessage("Tu as trouvé l'ARC de la garnison ! Appuie sur C pour tirer une flèche. Les moules des fossés sont à portée depuis la berge ou les bastions.", 8); }],
                                    [PARTAGE.keyChest, 'keyChest', () => { state.key = true; showMessage('La CLÉ DU DONJON ! Elle ouvre la grille de la poterne, à l\'est de la place d\'Armes : la galerie souterraine de la citadelle.', 8); }]]) {
    if (!ch) continue;
    if (!state[flag] && Math.hypot(ch.position.x - p.pos.x, ch.position.z - p.pos.z) < 2.2 && Math.abs(ch.position.y - p.pos.y) < 2) {
      state[flag] = true; ch.userData.glow.intensity = 3; SFX.pickup(); setTimeout(() => SFX.win(), 200); onOpen(); saveGame(true); burst(ch.position.x, ch.position.y + 1, ch.position.z, 0xffe070, 24, 3, 1.2, 2, 1.2);
    }
    ch.userData.lid.rotation.x = lerp(ch.userData.lid.rotation.x, state[flag] ? -1.9 : 0, 1 - Math.exp(-6 * dt));
    ch.userData.glow.intensity = lerp(ch.userData.glow.intensity, state[flag] ? 0.6 : 0, 1 - Math.exp(-2 * dt));
  }
  // grilles animées
  { const g = PARTAGE.donjonGate.userData; g.poser(lerp(g.f, g.open ? 1 : 0, 1 - Math.exp(-2 * dt))); }
  if (state.galleryOpen) { PARTAGE.poterneGrille.position.y = lerp(PARTAGE.poterneGrille.position.y, 2.8, 1 - Math.exp(-2 * dt)); PARTAGE.poterneGrille.userData.cap.r = 0; }
  // caméra rapprochée dans le donjon
  const inKeep = Math.abs(p.pos.x - DONJON.x) < DONJON.half && Math.abs(p.pos.z - DONJON.z) < DONJON.half && p.pos.y < DONJON.h - 1;
  G.camBack = inKeep ? 4.5 : 10.5; G.camUp = inKeep ? 2.6 : 6.5;
  // Lydéric respire ; le prince suit Camille une fois libéré ; fin de l'histoire quand ils rejoignent Lydéric
  if (PARTAGE.lyderic) {
    const L = PARTAGE.lyderic, an = L.userData.anim;
    // l'osier suit la sauvegarde : posé par le serment, ôté par la fin (finalScene)
    if (!!state.lydericOsier !== !!L.userData.osier) osier(L, !!state.lydericOsier);
    if (L.userData.osier) { /* figé : ni souffle ni animation */ }
    else if (an) { an.jouer(L.userData.walkTo ? 'Walk_Loop' : 'Idle_FoldArms_Loop', 0.4); an.update(dt); }
    else if (!L.userData.walkTo) { PARTAGE.lyderic.position.y = Math.sin(state.time * 1.5) * 0.08; PARTAGE.lyderic.userData.arms[0].rotation.x = Math.sin(state.time * 1.5) * 0.1; }
  }
  if (PARTAGE.prince && state.princeFreed && !state.ending && !cut.active) {
    PARTAGE.prince.visible = true; followActor(PARTAGE.prince, dt, p.pos, 2.6, 5.5);
    if (Math.hypot(PARTAGE.lyderic.position.x - p.pos.x, PARTAGE.lyderic.position.z - p.pos.z) < 9) finalScene();
  }
  // le prince riggé : marche quand followActor ou une cinématique lui donne un but
  if (PARTAGE.prince && PARTAGE.prince.visible) PNJ.animeVillageois(PARTAGE.prince, dt, !!PARTAGE.prince.userData.walkTo);
  if (PARTAGE.pralin && !cut.active) { PARTAGE.pralin.userData.tail.rotation.z = -0.8 + Math.sin(state.time * 1.7) * 0.4; }
  ACTE1_CITADELLE.update(dt);   // les étapes 9 et 10 de l'acte I : citadelle.js
}
// LYDÉRIC D'OSIER (STORY.md § 2 ; GAME_DESIGN_BRIEF § 25 : « Lydéric = géant d'osier pendant
// la crise »). Une matière, pas un modèle : la même silhouette, chaque maillage passé aux
// branches sèches photographiées (`dry_branches_01`), et l'animation arrêtée là où le sort
// l'a pris. Il parle encore (SCENARIO.md) ; il ne tourne plus la tête (talkLyderic). Les
// matières d'origine restent sur chaque maillage, pour la fin.
let matOsier = null;
function osier(L, oui) {
  // répétée ~10 fois sur l'atlas du personnage (qui tient tout le corps dans un seul carré) :
  // moins, les brins s'étiraient et Lydéric lisait comme une statue de bronze
  matOsier = matOsier || phMat('dry_branches_01', 15, 15, { color: 0xdcc296, roughness: 0.95 });
  L.traverse((o) => {
    if (!o.isMesh) return;
    if (oui) { if (!o.userData.matAvant) o.userData.matAvant = o.material; o.material = Array.isArray(o.material) ? o.material.map(() => matOsier) : matOsier; }
    else if (o.userData.matAvant) { o.material = o.userData.matAvant; delete o.userData.matAvant; }
  });
  L.userData.osier = oui;
}

// dialogue avec Lydéric selon l'avancement (Entrée)

export function talkLyderic() {
  if (acte1()) { lydericActe1(); return; }
  const alive = killsLeft(); const L = (t, fn) => ({ who: 'Lydéric', text: t, fn });
  if (!PARTAGE.lyderic.userData.osier) PARTAGE.lyderic.rotation.y = Math.atan2(player.pos.x - PARTAGE.lyderic.position.x, player.pos.z - PARTAGE.lyderic.position.z);
  let lines;
  if (!state.metLyderic) lines = [
    L("« Camille ! Tu n'as rien ? Phinaert… je n'ai rien pu faire, ce brigand m'a pris de vitesse. Il a emporté Eugène dans la citadelle et fait tomber la herse. »"),
    L("« Écoute-moi bien. Phinaert s'est enfermé dans l'enclos du donjon, au centre de la place d'Armes. Sa grille est ensorcelée : elle ne s'ouvrira que lorsque dix de ses monstres auront été vaincus. »"),
    L("« Eugène, lui, est sûrement dans les galeries que Vauban a creusées sous les remparts. On y entre par la poterne, à l'est de la place… mais il faut la clé, que Phinaert garde au sommet du donjon. »"),
    L(state.sword ? "« Tu as encore l'épée d'apprentie du vieux mage ? Garde-la, elle coupera autre chose que du blé. Et prends mon bouclier. »"
      : "« Tu n'es pas armée. Prends mon épée, celle de la garnison : elle est lourde pour toi, mais tu es plus vive que moi. Et prends le bouclier. »", () => { state.sword = true; state.metLyderic = true; SFX.win(); burst(player.pos.x, player.pos.y + 1.5, player.pos.z, 0xffe070, 30, 3, 1.2, 2, 1.4); }),
    L("« Clic gauche ou F pour frapper, Maj pour rouler. Sur le bastion de Turenne, à gauche de la porte, un coffre cache un arc : tu en auras besoin pour les moules des fossés. »"),
    L("« Les gens du village, au sud-est, ont aussi besoin d'aide : parle-leur, ils te rendront plus forte. Va, Camille, et ramène-nous Eugène. »"),
  ];
  else if (state.princeFreed) lines = [L("« Eugène ! Vous êtes vivants tous les deux ! »")];
  else if (state.galleryOpen) lines = [L("« La poterne est ouverte : descends, et fais attention aux fosses, saute avec X. Ramène-nous Eugène. »")];
  else if (state.key) lines = [L("« La clé du donjon ouvre la poterne, ce petit bâtiment de pierre à l'est de la place d'Armes. Les galeries de Vauban passent sous les remparts… »")];
  else if (state.bossDead) lines = [L("« Bravo ! Monte l'escalier en colimaçon, à l'intérieur du donjon : la clé des galeries est dans le coffre au sommet. »")];
  else if (state.gateOpen) lines = [L("« Phinaert est libre dans l'enclos du donjon. Esquive son onde de choc avec une roulade (Maj) ou saute par-dessus (X) ! »")];
  else if (state.bow) lines = [L(`« Avec l'arc, vise les moules des fossés depuis la berge (touche C). Encore ${alive} monstres à vaincre avant que la grille du donjon ne s'ouvre. »`)];
  else lines = [L(`« Encore ${alive} monstres à vaincre : remparts, bastions… et l'arc du bastion de Turenne pour les fossés. Ta maison est à l'ouest si tu veux dormir. Appuie sur J pour ton journal. »`)];
  dialogue(lines, () => { if (state.metLyderic) saveGame(true); });
}
// ---------- le prologue : « La fête des géants » ----------
// Le prologue de STORY.md (§ 2), d'après le découpage validé par Eugène le 1er octobre
// (docs/DECOUPAGE-PROLOGUE.md). Premier pas : les LIEUX et le fil. Le sergent Houtland envoie
// Camille couper la première botte de l'année au moulin d'Émile (se déplacer, la carte), elle
// la fauche (l'épée), la porte elle-même jusqu'au pont de Fin (le point d'or), et au serment
// Phinaert surgit de la Porte Royale. Pas encore là : le mage, la cloche qui se fend, Lydéric
// d'osier, la foule — les pas suivants du découpage. Rien n'est sauvegardé avant la fin de
// l'enlèvement : quitter en route, c'est reprendre le prologue au début.
// Réglages d'avancement : pas dans state, qui part dans la sauvegarde (saveGame).
const PRO = {
  etape: null,              // 'moulin' → 'fauche' → 'pont' → null
  bleDepart: 0, cages: [], emileAvant: null, botte: null, tend: false, posee: false,
  sonneT: -1, herseT: -1, fendue: false,   // la cloche qui se balance, la herse qui tombe (update)
  objectif: () => PRO.etape === 'moulin' ? "Cours au moulin d'Émile, au nord-est du bourg (le point d'or de la carte)"
    : PRO.etape === 'pont' || PRO.etape === 'botte' || PRO.etape === 'serment' ? 'Porte la botte à Lydéric, au pont de Fin (le point d’or)' : "Coupe le blé du champ du nord, chez Émile (clic gauche ou F)",
};
const GERBE = 18;           // épis à faucher : trois ou quatre coups d'épée dans le blé

// Au premier départ : le prologue, ou l'intro seule pour qui connaît déjà l'histoire.
// Rejoué depuis l'accueil (G.sansSauvegarde), il part directement.
export function debut() {
  if (G.sansSauvegarde) { prologue(); return; }
  showMenu('PROLOGUE', 'La fête des géants',
    'Quatre minutes pour apprendre à jouer, avant que l’aventure commence.', [
      { label: 'Jouer le prologue', fn: () => { hideMenu(); prologue(); } },
      { label: 'Passer', fn: () => { hideMenu(); rappel(); } },
    ]);
}

// le champ du nord d'Émile (« Coupe les épis du champ du nord ») : celui des quatre qui est le
// plus au nord du moulin — l'ordre de CHAMPS (carte.js) ne le dit pas, la position si
function champDuNord() {
  let n = null; for (const ch of FAUCHE_DEBUG.CHAMPS_BLE) if (!n || ch.cz < n.cz) n = ch;
  return n;
}

// La botte : des épis du champ d'Émile — le même maillage et la même matière que le blé
// qu'on vient de couper, pas un objet peint à part — serrés en gerbe et liés de paille
// tordue. Chaque épi part d'un côté du lien et passe de l'autre : la gerbe est pincée au
// lien, évasée aux pieds et aux épis, comme une vraie. L'origine est au pied.
const LIEN_H = 0.34;
function faireBotte() {
  const g = new THREE.Group(), ch = FAUCHE_DEBUG.CHAMPS_BLE[0];
  const geo = ch ? ch.im.geometry : (() => { const a = new THREE.PlaneGeometry(0.42, 1.15); a.translate(0, 0.575, 0); return a; })();
  const N = 28, epis = new THREE.InstancedMesh(geo, ch ? ch.im.material : phMat('withered_grass', 0.4, 1), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const phi = i * 2.39996, r = 0.025 + 0.05 * Math.sqrt((i + 0.5) / N);        // en tournesol : la gerbe est pleine
    const pench = Math.atan2(r, LIEN_H);                                           // croise l'axe au lien
    p.set(-Math.sin(phi) * r, 0, -Math.cos(phi) * r);
    q.setFromEuler(e.set(pench, phi, rand(-0.05, 0.05)));
    const k = rand(0.68, 0.8); s.set(k * 0.5, k, k * 0.5);
    epis.setMatrixAt(i, m.compose(p, q, s));
    epis.setColorAt(i, c.setHSL(0.115 + rand(-0.02, 0.02), rand(0.3, 0.45), rand(0.52, 0.64)));
  }
  epis.castShadow = true; g.add(epis);
  const lien = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 6, 16), phMat('withered_grass', 0.15, 0.15, { color: 0xb8975a }));
  lien.rotation.x = Math.PI / 2; lien.position.y = LIEN_H; lien.castShadow = true; g.add(lien);
  g.rotation.order = 'YXZ';
  g.traverse((o) => { o.userData.dynamic = true; });
  return g;
}

// le point libre le plus proche d'un lieu, du côté où l'on arrive (Émile devant son moulin)
function placeLibre(x0, z0, vx, vz) {
  for (let r = 0; r < 30; r += 1.5) for (let k = -6; k <= 6; k++) {
    const a = Math.atan2(vx, vz) + k * 0.25, x = x0 + Math.sin(a) * r, z = z0 + Math.cos(a) * r;
    if (!blocked(x, z, 0.9, false, getH(x, z) + 0.5)) return [x, z];
  }
  return [x0, z0];
}

// LA FOULE DE LA FÊTE (STORY.md § 2 : « Lille est pleine de monde » ; validée par Eugène le
// 1er octobre : 20 à 30 passants, mesurés). Des villageois riggés du jeu (PNJ.buildVillageois),
// pas un système à part, tirés dans d'autres poses : le bûcheron ne coupe pas de bois sur
// le pont un jour de fête. Ils ne naissent QU'AVEC LE PROLOGUE — au chargement, vingt-six
// personnages auraient coûté près d'une seconde (règle 8) à tous ceux qui ne le jouent pas —
// et deux par image, pendant le survol du titre. Ils s'enfuient avec l'enlèvement.
const FOULE = { gens: [], caps: [], aFaire: [] };
const POSES_FOULE = () => [PNJ.CLIP.parle, 'Idle_FoldArms_Loop', PNJ.CLIP.repos, PNJ.CLIP.parle, PNJ.CLIP.repos];
function preparerFoule() {
  const P = [], E_ = PARTAGE.ecole;
  // seize sur le pont, le long des deux parapets, de Lydéric à 35 m vers la plaine, tournés
  // vers lui : le milieu du tablier reste libre pour Camille (± 1,9 m)
  for (let k = 0; k < 16; k++) { const cote = k % 2 ? 1 : -1, x = cote * 2.25, z = LYD_Z + (cote < 0 ? 7 : 9) + Math.floor(k / 2) * 4 + rand(-0.8, 0.8);
    P.push([x, z, Math.atan2(LYD_X - x, LYD_Z - z) + rand(-0.4, 0.4)]); }
  // dix devant la salle de la garde, là où le prologue commence
  for (let k = 0, essais = 0; k < 10 && essais < 200; essais++) {
    const a = rand(0, TAU), r = rand(7, 16), x = E_.x + Math.sin(a) * r, z = E_.z + Math.cos(a) * r;
    if (blocked(x, z, 0.8, false, getH(x, z) + 0.5) || P.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.6)) continue;
    P.push([x, z, rand(0, TAU)]); k++;
  }
  // toutes les collisions d'un coup : chaque addCap fait réindexer la grille au prochain test
  FOULE.caps = P.map(([x, z]) => addCap(x, z, x, z, 0.35));
  FOULE.aFaire = P.map((p, i) => [...p, i]);
}
function grossirFoule() {
  for (let n = 0; n < 2 && FOULE.aFaire.length; n++) {
    const [x, z, yaw, i] = FOULE.aFaire.shift(), v = PNJ.buildVillageois(i);
    if (!v) { FOULE.aFaire.length = 0; return; }            // pas de banque riggée : pas de foule
    v.position.set(x, getH(x, z), z); v.rotation.y = yaw; v.scale.setScalar(G.echelle);
    v.userData.idle = POSES_FOULE()[i % 5] || v.userData.idle;
    scene.add(v); FOULE.gens.push(v);
  }
}
// LES FANIONS DE LA FÊTE (découpage, plan 1) : des guirlandes en travers de la rue de la
// salle de la garde, aux couleurs de Lille (rouge et blanc) et du jaune des Flandres. Une
// étoffe photographiée teintée, pas des aplats ; trois maillages en tout, un par couleur.
// Elles sont de la fête, comme la foule : nées avec le prologue, décrochées après.
const RUE_L = 4.4;                       // demi-largeur de la chaussée du bourg (village.js)
function tendreFanions() {
  const parCouleur = [[], [], []], cordes = [], H = 5.6, mats = [];
  // (5 octobre) les guirlandes allaient d'une rangée de façades à l'autre ; il n'y a plus de
  // maisons au sud de la grand-rue (le bâti relevé s'arrête à la rangée nord, au sud c'est
  // l'Esplanade) : elles partent des façades relevées et finissent sur un mât de fête planté au
  // bord de la rue — un mât par guirlande, de la fête comme elles
  for (const lx of [-17, -12.5, -8, -3.5, 1, 5.5, 10]) {
    const [ax, az] = townWorld(lx - 0.6, -RUE_L - 0.3), [bx, bz] = townWorld(lx + 0.6, RUE_L + 0.3);
    mats.push(new THREE.CylinderGeometry(0.07, 0.09, H * TOWN.s + 0.4, 6).translate(bx, TOWN.y + (H * TOWN.s + 0.4) / 2, bz));
    const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.5), ux = (bx - ax) / L, uz = (bz - az) / L;
    const y0 = TOWN.y + H * TOWN.s, fleche = 0.06 * L;
    // la cordelette, sur la même chaînette que les fanions
    const pts = []; for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push(new THREE.Vector3(ax + (bx - ax) * u, y0 - fleche * 4 * u * (1 - u), az + (bz - az) * u)); }
    cordes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 4, false));
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, y = y0 - fleche * 4 * u * (1 - u);
      const g = new THREE.BufferGeometry(), x = ax + (bx - ax) * u, z = az + (bz - az) * u, w = 0.17;
      g.setAttribute('position', new THREE.Float32BufferAttribute([x - ux * w, y, z - uz * w, x + ux * w, y, z + uz * w, x + rand(-0.03, 0.03), y - 0.42, z + rand(-0.03, 0.03)], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
      g.computeVertexNormals(); parCouleur[k % 3].push(g);
    }
  }
  const etoffe = (c) => phMat('fabric_pattern_07', 0.4, 0.4, { color: c, side: THREE.DoubleSide, roughness: 0.9 });
  FOULE.fanions = parCouleur.map((gs, i) => { const m = new THREE.Mesh(mergeGeometries(gs), etoffe([0xb8282a, 0xf2ece0, 0xe0b440][i]));
    m.castShadow = true; m.userData.dynamic = true; scene.add(m); return m; });
  const c = new THREE.Mesh(mergeGeometries(cordes), phMat('withered_grass', 0.3, 0.3, { color: 0x4a3a2a })); c.userData.dynamic = true; scene.add(c); FOULE.fanions.push(c);
  const m = new THREE.Mesh(mergeGeometries(mats), phMat('wood_planks', 0.3, 2, { color: 0x8a6a48 })); m.castShadow = true; m.userData.dynamic = true; scene.add(m); FOULE.fanions.push(m);
}
// LES GÉANTS DE PROCESSION (découpage, plan 1 ; STORY.md § 2 « Les géants passent » ; validés
// par Eugène le 1er octobre). Pas de nouveau modèle : le géant riggé de Lydéric, réduit à
// quatre mètres, la tenue teintée (rouge, vert) pour qu'on ne le prenne pas pour Lydéric, et
// une LONGUE ROBE d'étoffe jusqu'aux pavés — c'est elle qui fait le géant de procession :
// on ne voit pas de jambes, on devine les porteurs. Il remonte la rue en se balançant, comme
// porté à bras d'hommes. Nés avec la fête, partis avec elle.
const PEAU = /skin|body|head|hand/i;
// Leur chemin : la rue passe par la place et sa fontaine, et un géant en robe ne se faufile
// pas. On cherche donc, dans le repère du bourg, le plus long tronçon droit où sa robe (1 m de
// rayon) ne touche rien — étals, fontaine, foule déjà posée : un dans le sens de la rue, un
// dans la rue perpendiculaire. Il y fait l'aller et retour.
function tronconLibre(lignes) {
  let mieux = null;
  for (const [ax, az, bx, bz] of lignes) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.5); let debut = -1;
    for (let i = 0; i <= n + 1; i++) {
      const u = Math.min(i, n) / n, [x, z] = townWorld(ax + (bx - ax) * u, az + (bz - az) * u);
      const libre = i <= n && !blocked(x, z, 1.05, false, getH(x, z) + 0.5);
      if (libre && debut < 0) debut = i;
      if ((!libre || i > n) && debut >= 0) { const l = (i - 1 - debut) * 0.5;
        if (!mieux || l > mieux.l) { const u0 = debut / n, u1 = (i - 1) / n;
          mieux = { l, a: [ax + (bx - ax) * u0, az + (bz - az) * u0], b: [ax + (bx - ax) * u1, az + (bz - az) * u1] }; }
        debut = -1; }
    }
  }
  return mieux && mieux.l >= 8 ? mieux : null;
}
function geantsDeProcession() {
  FOULE.geants = [];
  const rangs = [], travers = [];
  for (let c = -3.9; c <= 3.91; c += 0.3) rangs.push([-22, c, 18, c]);
  for (let c = -3; c <= 3.01; c += 0.3) travers.push([c, 4.5, c, 22], [c, -4.5, c, -22]);
  const chemins = [tronconLibre(rangs), tronconLibre(travers)];
  // un géant par image : chacun se construit avec son squelette et ses foulées mesurées, et
  // les deux d'un coup figeaient le survol du titre
  const faire = (k) => {
    if (k > 1) return;
    requestAnimationFrame(() => { faireGeant(k, chemins[k]); faire(k + 1); });
  };
  faire(0);
}
function faireGeant(k, ch) {
  if (!ch || !FOULE.geants) return;
  {
    const [teinte, robeC] = [[0xd0603e, 0xb03a32], [0x6fa070, 0x4a8a52]][k];   // étoffes vives : la robe sombre se perdait dans l'ombre des façades
    const g = geant('lyderic', teinte, 0xe0b64a, 'sword'); if (!g || !g.userData.anim) return;
    g.traverse((o) => { if (!o.isMesh || Array.isArray(o.material) || PEAU.test(o.material.name || '')) return;
      o.material = o.material.clone(); o.material.color.set(teinte); });
    // la robe : un cône évasé de la taille aux pavés, plissé, dans le repère du géant (6,6 de haut)
    const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.62 + t * t * 1.05, 3.55 - t * 3.55)); }
    const gr = new THREE.LatheGeometry(prof, 36), po = gr.attributes.position;
    for (let i = 0; i < po.count; i++) { const x = po.getX(i), z = po.getZ(i), a = Math.atan2(z, x), f = 1 + 0.045 * Math.sin(a * 14) * (1 - po.getY(i) / 3.55);
      po.setX(i, x * f); po.setZ(i, z * f); }
    gr.computeVertexNormals();
    const robe = new THREE.Mesh(gr, phMat('fabric_pattern_07', 1.2, 1.4, { color: robeC, side: THREE.DoubleSide, roughness: 0.9 }));
    robe.castShadow = true; g.add(robe);
    { const c = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.07, 6, 28), phMat('metal_plate_02', 0.3, 0.3, { color: 0xc9a03a, roughness: 0.4 }));
      c.position.y = 3.5; c.rotation.x = Math.PI / 2; g.add(c); }   // la ceinture dorée
    g.scale.setScalar(0.62); g.userData.dynamic = true;
    g.userData.proc = { ch, u: k ? 0.7 : 0.2, sens: 1, t: k * 1.7 };
    scene.add(g); FOULE.geants.push(g);
  }
}
// le long de la rue de la salle de la garde, d'un bout à l'autre, au pas des porteurs
function avancerProcession(dt) {
  for (const g of FOULE.geants || []) {
    const P = g.userData.proc, { a, b, l } = P.ch; P.t += dt; P.u += P.sens * 0.55 * dt / l;
    if (P.u > 1) { P.u = 1; P.sens = -1; } else if (P.u < 0) { P.u = 0; P.sens = 1; }
    const lx = a[0] + (b[0] - a[0]) * P.u, lz = a[1] + (b[1] - a[1]) * P.u;
    const [x, z] = townWorld(lx, lz), [x2, z2] = townWorld(lx + (b[0] - a[0]) * P.sens, lz + (b[1] - a[1]) * P.sens);
    g.position.set(x, getH(x, z) + Math.abs(Math.sin(P.t * 1.7)) * 0.07, z);
    g.rotation.set(0, Math.atan2(x2 - x, z2 - z), Math.sin(P.t * 1.7) * 0.045);   // le roulis des porteurs
    // comme la foule : à pleine cadence de près, une image sur deux plus loin, pas du tout au-delà de 90 m
    const c = camera.position, d = Math.abs(x - c.x) + Math.abs(z - c.z), an = g.userData.anim;
    if (d < 20) { an.jouer('Idle_FoldArms_Loop', 0.4); an.update(dt); }
    else if (d < 90 && (P.tic = !P.tic)) { an.jouer('Idle_FoldArms_Loop', 0.4); an.update(2 * dt); }
  }
}
function disperserFoule() {
  for (const g of FOULE.geants || []) scene.remove(g);
  FOULE.geants = [];
  for (const m of FOULE.fanions || []) scene.remove(m);
  FOULE.fanions = [];
  for (const v of FOULE.gens) scene.remove(v);
  for (const c of FOULE.caps) c.r = 0;
  FOULE.gens = []; FOULE.caps = []; FOULE.aFaire = [];
}

function prologue() {
  const E_ = PARTAGE.ecole, eu = PARTAGE.prince;
  // les monstres ne sont pas encore là : Phinaert ne les lâche qu'avec l'enlèvement
  PRO.cages = enemies.filter((e) => !e.dead && !e.k.boss && !e.caged); for (const e of PRO.cages) e.caged = true;
  player.pos.set(E_.x, getH(E_.x, E_.z) + 0.1, E_.z); player.yaw = E_.yaw; G.camYaw = E_.yaw;
  // Eugène n'est pas à la salle de la garde : il attend au pont, la corde de la cloche en tête
  eu.visible = false;
  preparerFoule(); tendreFanions(); geantsDeProcession();
  // Houtland à la porte (là où se tenait Eugène), le mage dans la rue, face à Camille
  const ho = PARTAGE.houtland, mg = PARTAGE.mageBourg;
  if (ho) { ho.visible = true; ho.position.set(E_.eugene[0], getH(E_.eugene[0], E_.eugene[1]), E_.eugene[1]); ho.rotation.y = Math.atan2(E_.x - ho.position.x, E_.z - ho.position.z); }
  const [mx, mz] = placeLibre(E_.x - Math.sin(E_.yaw) * 3 + Math.cos(E_.yaw) * 1.6, E_.z - Math.cos(E_.yaw) * 3 - Math.sin(E_.yaw) * 1.6, -Math.sin(E_.yaw), -Math.cos(E_.yaw));
  if (mg) { mg.visible = true; mg.position.set(mx, getH(mx, mz), mz); mg.rotation.y = Math.atan2(E_.x - mx, E_.z - mz); }
  // le champ-contrechamp du mage : par-dessus l'épaule de Camille, le mage de face
  const mdx = mx - E_.x, mdz = mz - E_.z, md = Math.hypot(mdx, mdz) || 1, mux = mdx / md, muz = mdz / md;
  const py = player.pos.y, camMage = [E_.x - mux * 2.4 + muz * 1.1, py + 2.0, E_.z - muz * 2.4 - mux * 1.1], atMage = [mx, py + 1.4, mz];
  // Émile attend à son moulin, face au bourg d'où arrive Camille
  const em = PARTAGE.emile;
  if (em) { PRO.emileAvant = [em.position.x, em.position.y, em.position.z, em.rotation.y];
    const [x, z] = placeLibre(FERME.x, FERME.z, E_.x - FERME.x, E_.z - FERME.z);
    em.position.set(x, getH(x, z), z); em.rotation.y = Math.atan2(E_.x - x, E_.z - z); }
  const cx = E_.x + Math.sin(E_.yaw) * 2.2, cz = E_.z + Math.cos(E_.yaw) * 2.2, cy = player.pos.y;
  const vx = E_.x - Math.sin(E_.yaw) * 5, vz = E_.z - Math.cos(E_.yaw) * 5;
  G.fade = 1; G.fadeTarget = 1; document.getElementById('fade').style.opacity = 1;
  cutscene([
    // le survol descend DANS L'AXE DE LA RUE et finit au-dessus d'elle, devant la façade : en
    // diagonale, il traversait les toits (et finissait dans le mur d'une maison)
    { cam: [vx + Math.cos(E_.yaw) * 30, cy + 24, vz - Math.sin(E_.yaw) * 30], at: [E_.x, cy + 4, E_.z], cam2: [vx - Math.sin(E_.yaw) * 2, cy + 9, vz - Math.cos(E_.yaw) * 2], at2: [E_.x, cy + 2, E_.z], dur: 6, fade: 0, title: 'THE LEGEND OF CAMILLE', sub: 'Prologue — La fête des géants', skippable: false },
    { cam: [vx, cy + 3.2, vz], at: E_.enseigne, cam2: [vx + 0.6, cy + 2.2, vz + 0.6], at2: [cx, cy + 1.3, cz], dur: 6, text: 'Lille est en fête : à midi, Lydéric le géant sort sur le pont de Fin. À la salle de la garde, le sergent Houtland cherche son apprentie.' },
    { say: '« Camille ! Lydéric sort à midi, et la garde n’a pas son blé. C’est l’apprentie qui coupe la première botte de l’année, c’est la règle. File au moulin d’Émile, au nord-est du bourg. »', who: 'Houtland' },
    { say: '« Tu ne sais plus où est le moulin ? La carte du beffroi (M). Une apprentie de la garde qui se perd dans son propre bourg, on aura tout vu. »', who: 'Houtland' },
    { say: '« Et ce soir, tu prêteras serment. Ça ne se reprend pas, un serment de la garde. Réfléchis-y en coupant ton blé. »', who: 'Houtland' },
    { say: '« Le blé se coupe avec une lame, pas avec les dents. Voici l’épée d’apprentie. Ne coupe rien d’autre que du blé. »', who: 'Le vieux mage', cam: camMage, at: atMage,
      fn: () => { state.sword = true; SFX.pickup(); } },
    { say: '« La Grande Cloche sonnera pour Lydéric, aujourd’hui. Il y a longtemps qu’elle n’a pas sonné si fort… »', who: 'Le vieux mage' },
  ], () => {
    PRO.etape = 'moulin'; PARTAGE.repere = { x: FERME.x, z: FERME.z };
    player.yaw = G.camYaw = Math.atan2(FERME.x - player.pos.x, FERME.z - player.pos.z);   // dos à la salle, face au chemin
    showMessage('Suis le point d’or de la carte jusqu’au moulin d’Émile. Les touches sont rappelées à droite ; Espace pour sauter.', 7);
  });
}

// l'avancement du prologue, appelé par update() tant qu'il dure
function suivrePrologue() {
  const p = player, em = PARTAGE.emile, lyd = PARTAGE.lyderic;
  if (cut.active) return;
  if (PRO.etape === 'moulin' && em && Math.hypot(em.position.x - p.pos.x, em.position.z - p.pos.z) < 5) {
    PRO.etape = 'fauche-dialogue'; em.rotation.y = Math.atan2(p.pos.x - em.position.x, p.pos.z - em.position.z);
    const ch = champDuNord();
    // par-dessus l'épaule de Camille, Émile de face
    const dx = em.position.x - p.pos.x, dz = em.position.z - p.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const y = p.pos.y, cam = [p.pos.x - ux * 2.6 + uz * 1.2, y + 2.1, p.pos.z - uz * 2.6 - ux * 1.2], at = [em.position.x, em.position.y + 1.4, em.position.z];
    cutscene([
      // l'épée, Camille la tient du vieux mage, à la salle de la garde (découpage, plan 3)
      { who: 'Émile', say: '« La première botte de l’année ! Coupe les épis du champ du nord, une dizaine suffit. Tiens la lame à plat. »', cam, at },
    ], () => {
      PRO.etape = 'fauche'; PRO.bleDepart = bleFauche;
      PARTAGE.repere = ch ? { x: ch.cx, z: ch.cz } : null;
      showMessage('Clic gauche (ou F) pour frapper : coupe le blé du champ du nord.', 6);
    });
  } else if (PRO.etape === 'fauche' && bleFauche - PRO.bleDepart >= GERBE) {
    PRO.etape = 'botte'; PARTAGE.repere = null;
    dialogue([
      { who: 'Émile', text: '« La plus belle depuis des années. Au pont de Fin, et que Lydéric la voie de loin. »', fn: () => { PRO.botte = faireBotte(); scene.add(PRO.botte); SFX.pickup(); } },
    ], () => {
      PRO.etape = 'pont'; PARTAGE.repere = { x: LYD_X, z: LYD_Z };
      showMessage('Porte la botte à Lydéric : le pont de Fin, devant la Porte Royale (le point d’or).', 7);
    });
  } else if (PRO.etape === 'pont' && lyd && Math.hypot(lyd.position.x - p.pos.x, lyd.position.z - p.pos.z) < 11) {
    PRO.etape = 'serment'; PARTAGE.repere = null;
    introScene(true);
  }
}

// ---------- situation initiale : la cinématique d'introduction ----------
// serment : on vient du prologue. Sur le pont de Fin, Camille offre la botte à Lydéric et
// prête serment ; Phinaert surgit de la Porte Royale. Sans prologue, Eugène vient saluer
// Camille, comme avant. Tout se joue autour de la place de Lydéric (LYD_X, LYD_Z), la Porte
// Royale au fond : Camille arrive de la plaine (z croissant), face au nord.
export function introScene(serment = false) {
  const lx = LYD_X, lz = LYD_Z, hy = getH(0, lz);
  // avec le serment, Phinaert naît de la fumée de la cloche, sur le pont, côté plaine ;
  // sans, il sort de la Porte Royale comme avant
  const villain = geant('phinaert', 0x7a1f1f, 0x333333, 'club'); villain.userData.dynamic = true; villain.visible = false; scene.add(villain);
  if (serment) { villain.position.set(1.5, hy, lz + 16); villain.rotation.y = Math.PI; }   // face au serment qu'il vient interrompre else { villain.position.set(0, hy, APO - 12); villain.rotation.y = 0; }
  const lyd = PARTAGE.lyderic, eu = PARTAGE.prince;
  lyd.position.set(lx, getH(lx, lz), lz); lyd.rotation.y = 0;
  // Camille à 5 m devant Lydéric, Eugène à sa droite ; tous deux face au géant
  const cx = 0.6, cz = lz + 5;
  player.pos.set(cx, hy, cz); player.yaw = Math.atan2(lx - cx, lz - cz); G.camYaw = player.yaw + Math.PI;
  eu.visible = true; eu.position.set(2.1, hy, lz + 3.6); eu.rotation.y = Math.atan2(lx - 2.1, lz - (lz + 3.6));
  G.fade = 1; G.fadeTarget = 1; document.getElementById('fade').style.opacity = 1;
  // la botte posée aux pieds de Lydéric
  const poser = () => { const b = PRO.botte; if (!b) return; PRO.tend = false; PRO.posee = true;
    b.position.set(lx + 0.9, hy, lz + 2.2); b.rotation.set(0, 0.4, 0); SFX.pickup(); };
  const ouverture = serment ? [
    // Lydéric mesure 7,6 m : les plans le prennent en entier, ou en contre-plongée (découpage, plans 8 à 10)
    { cam: [16, 8, lz + 88], at: [0, 6, lz - 42], cam2: [10, 6, lz + 40], at2: [0, 5, lz - 20], dur: 5, fade: 0, text: 'Le pont de Fin. Lydéric attend la première botte de l’année, la Porte Royale dans le dos.' },
    { say: '« Quand tu auras prêté serment, je sonne la Grande Cloche. Désiré m’a laissé la corde, pour la première fois ! »', who: 'Eugène', cam: [2.8, 1.8, lz + 0.8], at: [1.3, 1.4, lz + 4.6] },   // entre eux et le géant : leurs visages, la plaine au fond
    { say: '« Camille, de la garde. La première botte de l’année… Comme au temps de l’ermite. »', who: 'Lydéric', cam: [4, 2.3, lz + 16], at: [lx, 4, lz], fn: () => { PRO.tend = true; } },
    { say: '« Répète après moi, et n’en change pas un mot. »', who: 'Lydéric', cam: [0.5, 1.3, lz + 10], at: [lx + 0.6, 8, lz - 4], fn: poser },
    { say: '« Ce que la garde commence… »', who: 'Lydéric' },
    { say: '« … la garde l’achève. »', who: 'Camille', cam: [-0.6, 1.7, lz + 2.4], at: [cx, hy + 1.45, cz] },   // de face, vue d'où se tient Lydéric
    { say: '« Tu ne pourras plus le reprendre. »', who: 'Lydéric', cam: [0.5, 1.3, lz + 10], at: [lx + 0.6, 8, lz - 4] },
    { say: '« Si je rate le premier coup, tu diras que c’était voulu. »', who: 'Eugène', cam: [2.8, 1.8, lz + 0.8], at: [1.3, 1.4, lz + 4.6] },
    { cam: [3.5, 2.4, lz + 2], at: [2, 1.4, lz + 12], dur: 2.6, actor: eu, to: [2.1, lz + 40], speed: 6, text: 'Eugène court au beffroi.' },
  ] : [
    { cam: [90, 70, 140], at: [0, 6, 0], cam2: [40, 34, 96], at2: [0, 8, 10], dur: 7, fade: 0, title: 'THE LEGEND OF CAMILLE', sub: 'La Citadelle de Lille', skippable: false },
    { cam: [40, 34, 96], at: [0, 8, 10], cam2: [16, 8, lz + 88], at2: [0, 6, lz - 42], dur: 6, text: 'La citadelle de Vauban veille sur Lille depuis des siècles. Ses cinq bastions, ses fossés et son donjon n\'ont jamais été pris.' },
    { cam: [4, 2.2, lz + 12], at: [1.2, 1.6, lz + 4], cam2: [3.2, 2, lz + 10], at2: [1.2, 1.5, lz + 4], dur: 5, text: 'Ce matin-là, Eugène est venu saluer son amie Camille, la jeune gardienne de la citadelle, sur le pont de Fin.' },
    { say: "« Camille ! Regarde ce ciel : une journée parfaite pour une promenade sur les remparts. Lydéric nous attend… »", who: 'Eugène', cam: [3.2, 2, lz + 10], at: [1.2, 1.5, lz + 4] },
  ];
  // la botte tombe avec Camille : renversée sur le tablier, les épis éparpillés
  const renverser = () => { const b = PRO.botte; if (!b) return; PRO.botte = null; PRO.tend = false; PRO.posee = false;
    b.position.set(lx + 1.3, hy + 0.06, lz + 2.6); b.rotation.set(0, 0.9, 1.45);
    burst(lx + 1.3, hy + 0.3, lz + 2.6, 0xd8b860, 26, 3, 0.7, 4, 1.1); };
  // LA GRANDE CLOCHE (STORY.md § 2 ; découpage, plans 11 à 15). Les plans du beffroi se
  // calculent sur la cloche elle-même : le beffroi est bâti dans le repère du bourg puis replacé.
  const cl = PARTAGE.cloche, B = new THREE.Vector3(), V = (x, y, z) => cl.joug.localToWorld(new THREE.Vector3(x, y, z)).toArray();
  if (cl) { cl.joug.updateWorldMatrix(true, false); cl.joug.getWorldPosition(B); }
  const sonner = (fendue) => { PRO.sonneT = 0; SFX.cloche(fendue);
    if (fendue) { PRO.fendue = true; const f = cl.fente.getWorldPosition(new THREE.Vector3()); for (let k = 0; k < 6; k++) setTimeout(() => burst(f.x, f.y, f.z, 0x8a1410, 10, 1.2, 1.6, -1.5, 2.2), k * 160); } };
  // la fumée : une traînée de bouffées rouges du beffroi jusqu'au pont, en arc au-dessus des toits
  const fumee = () => { const D = new THREE.Vector3(1.5, hy + 6, lz + 16), C = B.clone().lerp(D, 0.5).setY(70), P = new THREE.Vector3(); let t = 0;
    const iv = setInterval(() => { t += 0.035; const u = Math.min(1, t);
      P.copy(B).multiplyScalar((1 - u) * (1 - u)).addScaledVector(C, 2 * u * (1 - u)).addScaledVector(D, u * u);
      burst(P.x, P.y, P.z, 0x8a1410, 5, 1.6, 1.8, -0.6, 3.5);
      if (u >= 1) { clearInterval(iv); villain.visible = true; burst(D.x, hy + 4, D.z, 0x8a1410, 40, 4, 1.4, -1, 4); SFX.roar(); G.shake = 1.2; } }, 80); };
  const attaque = serment && cl ? [
    { cam: [B.x + 28, B.y - 39, B.z - 29], at: [B.x, B.y + 1, B.z], cam2: [B.x + 24, B.y - 38, B.z - 25], at2: [B.x, B.y + 1.5, B.z], dur: 4.5,
      text: 'Au beffroi, Eugène tire la corde. La Grande Cloche sonne pour Lydéric.', fn: () => sonner(false) },
    { cam: V(2.0, -0.45, 0.7), at: V(0, -0.7, 0), dur: 4.5, text: 'Au deuxième coup, un craquement. Une fente court sur le métal.', shake: 0.5,
      fn: () => setTimeout(() => sonner(true), 400) },
    { cam: [2.6, hy + 2.2, lz - 3], at: [40, 35, lz + 90], cam2: [2.6, hy + 2.2, lz - 3], at2: [1.5, hy + 5, lz + 16], dur: 5.5,   // à droite de Lydéric : sa jambe bouchait le ciel
      text: 'Une fumée rouge sort du métal, traverse le ciel… et prend forme sur le pont.', fn: fumee },
    { say: '« Mille ans dans une cloche. Et le premier son que j’entends… c’est le sang de Lydéric qui tire la corde. »', who: 'Phinaert', cam: [-1.5, hy + 2, lz + 6], at: [1.5, hy + 5.5, lz + 16] },
    { cam: [6, 3, lz + 20], at: [1.8, 2, lz + 30], dur: 3.2, actor: eu, to: [2, lz + 23], speed: 7, text: 'Eugène redescend du beffroi en courant…',
      fn: () => { eu.visible = true; eu.position.set(2, hy, lz + 45); villain.rotation.y = 0; } },
    { cam: [9, 5, lz + 33], at: [1.8, 4, lz + 20], dur: 2, shake: 0.8, text: '…et Phinaert le saisit.', fn: () => { SFX.stomp(); eu.visible = false; burst(2, hy + 2, lz + 23, 0xffd070, 20, 3, 0.8, 3, 1.2); } },
    { cam: [7, 3.5, lz + 1], at: [1.5, 3.5, lz + 12], dur: 2.2, actor: villain, to: [1.8, lz + 7], speed: 6, text: 'Camille se jette devant lui.' },
  ] : [
    { cam: [2.4, 2.6, lz + 14], at: [0, 5, APO + 4], cam2: [2.8, 3.2, lz + 10], at2: [0, 6, APO + 14], dur: 4.5, text: 'Soudain, la terre tremble. La herse de la Porte Royale se lève dans un fracas de chaînes…', shake: 1.2, fn: () => { SFX.roar(); villain.visible = true; }, actor: villain, to: [0, APO + 18], speed: 7 },
    { cam: [-6, 4, lz + 2], at: [0.5, 5, lz - 30], cam2: [-6, 4.5, lz + 4], at2: [0.5, 5, lz - 12], dur: 4, actor: villain, to: [1.8, lz - 1], speed: 9, text: 'PHINAERT, le géant brigand, fond sur le pont.', fn: () => { villain.position.set(0.5, hy, lz - 40); G.shake = 0.8; SFX.stomp(); } },
    { say: "« Eugène, l'ami de la gardienne ! Tu vaudras une rançon en or… Et toi, la gardienne, ôte-toi de mon chemin ! »", who: 'Phinaert', cam: [4, 6, lz + 9], at: [1.8, 5, lz - 1] },
  ];
  cutscene([
    ...ouverture,
    ...attaque,
    // en retrait : de près, le géant remplissait l'image
    { cam: [-6, 3.5, lz + 12], at: [0.5, 2, lz + 5], dur: 1.6, shake: 1.5, fn: () => { SFX.stomp(); SFX.hit(); burst(player.pos.x, hy + 1.2, player.pos.z, 0xc8b898, 20, 4, 0.8, 6, 1.2); renverser(); player.pose = { kind: 'lie', pos: [-0.6, hy + 0.35, lz + 6.5], yaw: 2.4 }; } },
    { cam: [-6, 3.5, lz + 12], at: [0.5, 2, lz + 5], dur: 2.5, text: serment ? 'D\'un revers de massue, le géant envoie Camille au sol. La botte roule sur les planches.' : 'D\'un revers de massue, le géant envoie Camille au sol et saisit Eugène.', fn: () => { if (eu.visible) { eu.visible = false; burst(eu.position.x, hy + 2, eu.position.z, 0xffd070, 20, 3, 0.8, 3, 1.2); } } },
    // avec le serment : Lydéric lui barre la route de la citadelle, et Phinaert le change en osier
    ...(serment ? [
      { cam: [9, 4.5, lz + 4], at: [0, 4.5, lz + 2], dur: 2.4, actor: villain, to: [1.8, lz + 3.2], speed: 1.8, text: 'Lydéric se dresse devant lui.' },   // lent : le plan s'achève à l'arrivée (cutTick), il faut le temps de lire
      // de l'ouest, côté Lydéric : de l'est, on ne voyait que le dos de Phinaert
      { cam: [-6.5, 2.4, lz + 5.5], at: [lx + 0.6, 5.2, lz + 0.8], dur: 3.6, shake: 0.6, text: 'Phinaert pose la main sur son torse.',
        fn: () => setTimeout(() => { state.lydericOsier = true; SFX.cloche(true); burst(lx + 0.3, hy + 5, lz + 0.6, 0x8a1410, 30, 2.5, 1.2, -1, 2.5); }, 900) },
      { say: '« Reste debout, vieux frère. En osier, tu dureras plus longtemps. »', who: 'Phinaert', cam: [-3, 3.5, lz - 8], at: [1.2, 5, lz + 3] },   // du nord : son visage, le dos d'osier
    ] : []),
    { cam: [-9, 5, lz - 10], at: [0, 6, APO + 10], cam2: [-9, 6, lz - 14], at2: [0, 6, APO], dur: 6, actor: villain, to: [0, APO - 2], speed: 20, text: 'Phinaert emporte Eugène dans la citadelle, et la herse retombe derrière lui.' },
    // un plan à elle : celui qui suit un acteur s'achève quand il arrive (cutTick), la herse
    // tombait donc dans le noir. Phinaert est passé ; elle tombe derrière lui.
    { cam: [-9, 6, lz - 14], at: [0, 6, APO], dur: 2.4, fn: () => { PRO.herseT = 0; SFX.herse(); setTimeout(() => { G.shake = 1; scene.remove(villain); }, 650); } },
    // LA HERSE SE RELÈVE dans le noir : la partie d'aujourd'hui entre dans la citadelle par la
    // Porte Royale. Qu'elle reste baissée — la « grande grille » que dix hommes poussent à
    // l'acte I — se décidera avec l'acte I (docs/DECOUPAGE-PROLOGUE.md).
    // dans le noir aussi, la foule s'enfuit (découpage, plan 17 : « La foule s'est enfuie »)
    // L'ACTE I LA LAISSE BAISSÉE (docs/DECOUPAGE-ACTE1.md, étape 1) : c'est « la grande grille »
    // que dix hommes poussent encore ; on n'entrera plus dans la place que par les souterrains.
    // Sans serment (l'ancienne intro), elle se relève comme avant.
    { fade: 1, dur: 2, skippable: false, fn: () => { PRO.herseT = -1; if (PARTAGE.herse) PARTAGE.herse.userData.poser(serment ? 1 : 0); disperserFoule(); } },
    { cam: [-3, 2.2, lz + 11], at: [-0.6, 0.8, lz + 6.5], cam2: [-2.4, 2.5, lz + 10], at2: [-0.6, 1.2, lz + 6.5], dur: 4, fade: 0, text: 'Le silence retombe sur le pont. Camille rouvre les yeux…' },
    { say: "« Camille ! Tu es vivante ! Viens, viens me parler, vite… »", who: 'Lydéric', cam: [3, 3.4, lz + 17], at: [lx, 3.4, lz],
      fn: () => { player.pose = null; player.pos.set(-0.6, hy, lz + 6.5); player.yaw = Math.atan2(lx + 0.6, -6.5); } },
  ], () => {
    if (serment) finPrologue();
    if (G.sansSauvegarde) return;                   // rejoué depuis l'accueil : finPrologue a pris la main
    state.introSeen = true; lyd.userData.walkTo = null;
    G.camYaw = Math.atan2(player.pos.x - lyd.position.x, player.pos.z - lyd.position.z) + Math.PI; saveGame(true); showMessage('Va parler à Lydéric (Entrée). Journal : J.', 6);
  });
}

// « PASSER » LE PROLOGUE : un rappel de ce qui s'est passé, pas l'ancienne intro (Phinaert
// sortant de la Porte Royale, sans cloche ni osier) qui racontait une autre histoire. Trois
// plans — la cloche fendue, Lydéric d'osier, la grille — et la main au joueur, sur le pont,
// au même point que le prologue joué.
function rappel() {
  const lx = LYD_X, lz = LYD_Z, hy = getH(0, lz), cl = PARTAGE.cloche, lyd = PARTAGE.lyderic;
  PRO.fendue = true; state.lydericOsier = true;
  state.sword = true;          // l'épée d'apprentie, que le mage donne au prologue joué
  lyd.position.set(lx, getH(lx, lz), lz); lyd.rotation.y = 0;
  player.pos.set(-0.6, hy, lz + 6.5); player.yaw = Math.atan2(lx + 0.6, -6.5);
  const V = (x, y, z) => cl.joug.localToWorld(new THREE.Vector3(x, y, z)).toArray();
  if (cl) cl.joug.updateWorldMatrix(true, false);
  G.fade = 1; G.fadeTarget = 1; document.getElementById('fade').style.opacity = 1;
  cutscene([
    { cam: [90, 70, 140], at: [0, 6, 0], cam2: [40, 34, 96], at2: [0, 8, 10], dur: 6, fade: 0, title: 'THE LEGEND OF CAMILLE', sub: 'La fête des géants', skippable: false },
    ...(cl ? [{ cam: V(2.0, -0.45, 0.7), at: V(0, -0.7, 0), dur: 4.5, text: 'Le jour de la fête des géants, la Grande Cloche s’est fendue au deuxième coup. Une fumée rouge en est sortie : Phinaert.' }] : []),
    { cam: [-6.5, 2.4, lz + 5.5], at: [lx + 0.6, 5.2, lz + 0.8], dur: 4.5, text: 'Il a changé Lydéric en géant d’osier et enlevé Eugène, le sonneur.' },
    { cam: [-9, 6, lz - 14], at: [0, 6, APO], dur: 4, text: 'Puis il est entré dans la citadelle, et la grande grille est retombée derrière lui.',
      fn: () => { if (PARTAGE.herse) PARTAGE.herse.userData.poser(1); } },
    // baissée pour de bon, comme au prologue joué : l'acte I commence (docs/DECOUPAGE-ACTE1.md)
    { fade: 1, dur: 1.2, skippable: false },
    { cam: [3, 3.4, lz + 17], at: [lx, 3.4, lz], dur: 1.2, fade: 0 },
    { say: '« Camille ! Tu es vivante ! Viens, viens me parler, vite… »', who: 'Lydéric', cam: [3, 3.4, lz + 17], at: [lx, 3.4, lz] },
  ], () => {
    state.introSeen = true; finPrologue();
    G.camYaw = Math.atan2(player.pos.x - lyd.position.x, player.pos.z - lyd.position.z) + Math.PI; saveGame(true); showMessage('Va parler à Lydéric (Entrée). Journal : J.', 6);
  });
}

// l'enlèvement est joué : les monstres se réveillent, Émile rentre au bourg
function finPrologue() {
  for (const e of PRO.cages) e.caged = false; PRO.cages = [];
  const em = PARTAGE.emile, a = PRO.emileAvant;
  if (em && a) { em.position.set(a[0], a[1], a[2]); em.rotation.y = a[3]; }
  PRO.etape = null; PARTAGE.repere = null; state.prologueFait = true;
  for (const v of [PARTAGE.houtland, PARTAGE.mageBourg]) if (v) v.visible = false;
  if (G.sansSauvegarde) showMenu('FIN DU PROLOGUE', 'La fête des géants', 'Eugène est enlevé. La suite de l’histoire se joue avec ton personnage.', [
    { label: 'Retour à l’accueil', fn: () => { naviguer('accueil.html'); } },
  ]);
}
// =====================================================================
//  L'ACTE I — « La Grande Cloche » (STORY.md ; docs/DECOUPAGE-ACTE1.md)
// =====================================================================
// L'acte commence quand le prologue est joué (state.prologueFait). Une sauvegarde d'avant
// (sans ce drapeau) garde l'ancienne histoire — les dix monstres, la poterne — jusqu'au bout.
// L'étape (state.acte1) porte les noms de DIALOGUES-ACTE1.md : chaque habitant dit la
// réplique de l'étape la plus récente qui lui en donne une. Les indices entendus
// (state.ind) font le carnet du journal et le point d'or de la carte.
// (les étapes et le pas en avant sont dans etat.js depuis le 5 octobre : la chapelle et les
// galeries, d'autres niveaux, font avancer l'acte elles aussi)
const ETAPES = ETAPES_ACTE1;
export const acte1 = () => etapeActe1(state);
const rang = (e) => ETAPES.indexOf(e);
const atteint = (e) => acte1() !== null && rang(acte1()) >= rang(e);
function passerA(e) { if (passerActe1(state, e)) saveGame(true); }

// Le carnet : chaque indice en gras s'y écrit, et se barre quand il a servi (SCENARIO.md § 7,
// règle 6). `ou` pose la marque de la carte quand on sait où ET comment.
const INDICES = {
  crypte:   { txt: 'La crypte de la chapelle Saint-Roch descend jusqu’aux souterrains de la citadelle.', qui: 'Lydéric', fait: () => atteint('souterrains') },
  lanterne: { txt: 'Sous terre, il faut la lanterne de Désiré, le guetteur du beffroi.', qui: 'Lydéric', fait: () => !!state.lanterne },
  cornelie: { txt: 'Désiré a filé vers la chapelle cette nuit, sa lanterne sous le bras.', qui: 'Cornélie', fait: () => !!state.ind?.gustave },
  gustave:  { txt: 'Gustave, à l’estaminet, connaît Désiré mieux que personne.', qui: 'le gardien de la chapelle', fait: () => !!state.ind?.escalier },
  nuit:     { txt: 'Désiré monte au beffroi à minuit ; sa lumière ne se voit là-haut que la nuit.', qui: 'l’allumeur', fait: () => !!state.lanterne },
  escalier: { txt: 'La petite porte du beffroi est fermée ; Émile en a la clé.', qui: 'Gustave', fait: () => !!state.ind?.canal },
  canal:    { txt: 'La clé est tombée dans le canal de la Tortue, derrière le moulin.', qui: 'Émile', fait: () => !!state.cleBeffroi },
  pecheur:  { txt: 'Le vieux pêcheur du quai, devant la maison, a une canne.', qui: 'Émile', fait: () => !!state.canne },
  vers:     { txt: 'Des vers dans la terre du champ d’Émile, là où le blé est coupé.', qui: 'le vieux pêcheur', fait: () => !!state.vers },
  // ceux des galeries (cave.js les pose dans state.ind ; demande de B2) : on les relit au carnet en remontant
  bastien:  { txt: 'L’arc de l’intendant est au puits aux chauves-souris, à droite après la citerne.', qui: 'Bastien', fait: () => !!state.bow },
  ratRoi:   { txt: 'Le Rat-Roi a avalé une clé ; une flèche dans les tonneaux pendus le fera sortir.', qui: 'Bastien', fait: () => !!state.clePoterne },
};
function noter(cle) {
  state.ind = state.ind || {};
  if (state.ind[cle]) return;
  state.ind[cle] = true; saveGame(true);
  setTimeout(() => showMessage('Indice noté au journal (J).', 3), 300);
}
// la section du journal (engine.js, openJournal) : la suite de ce qu'on a appris, barrée quand ça a servi
function indicesJournal() {
  if (!acte1() || !state.ind) return '';
  const l = Object.keys(INDICES).filter((k) => state.ind[k]).map((k) => { const i = INDICES[k], f = i.fait();
    return `<div style="margin:4px 0;${f ? 'opacity:.5;text-decoration:line-through' : ''}">${i.txt} <span style="opacity:.6">— ${i.qui}</span></div>`; });
  return l.length ? `<h3 style="margin:18px 0 6px;color:#9fd0ff;font-size:16px;letter-spacing:1px">INDICES</h3><div style="padding:8px 14px;border-left:4px solid #9fd0ff;background:rgba(255,255,255,.06);border-radius:6px">${l.join('')}</div>` : '';
}

// Les habitants nouveaux de l'acte I (pnj.js, ROLES) : nés APRÈS le chargement, un par image,
// comme la foule du prologue — le banc n'en paie rien (règle 8). Houtland et le mage restent
// devant la salle de la garde : la crise les y a trouvés.
const A1 = { gens: {}, aFaire: [], pret: false, lieux: null, enigme: false, desire: null };
PARTAGE.gensActe1 = A1.gens;        // pour les bancs (bancs/acte1-*.mjs) : où se tiennent les témoins
function lieuxActe1() {
  if (A1.lieux) return A1.lieux;
  const E_ = PARTAGE.ecole, L = {};
  // sur le parvis de la chapelle, dans l'axe du portail (−1 ; −13), quatre pas devant lui,
  // tourné vers la place : le parvis est étroit, entre le beffroi et une maison relevée (5
  // octobre : posé de biais, il se tenait devant la porte du beffroi, ou dans la maison). Six
  // mètres du portail : sa portée (2,3 m) et celle du gardien ne se recouvrent pas.
  { const [qx, qz] = townWorld(-0.9, -9.2), [cx, cz] = townWorld(-6, 2);
    const [x, z] = placeLibre(qx, qz, cx - qx, cz - qz); L.gardien = [x, z, Math.atan2(cx - x, cz - z)]; }
  // le crieur, au pied de la fontaine, tourné vers la grand-rue d'où l'on arrive (la salle de
  // la garde est à −23 en x local) : en vue de partout (5 octobre : au bord de la place, il
  // était caché derrière un étal du marché)
  { const [qx, qz] = townWorld(-4.9, 0.6), [cx, cz] = townWorld(-14, 1.5);
    const [x, z] = placeLibre(qx, qz, qx - cx, qz - cz); L.crieur = [x, z, Math.atan2(cx - x, cz - z)]; }
  // l'allumeur, dans la rue qui mène à la salle de la garde, sa lanterne éteinte à la main
  { const x0 = 223, z0 = 668; L.allumeur = [...placeLibre(x0, z0, 1, 0), Math.atan2(200 - x0, 660 - z0)]; }
  // le vieux pêcheur, au bord de l'eau à côté de la maison de Camille (HOUSE, 173 ; 611) : le
  // premier point de berge d'où l'on VOIT l'eau (eauVisible) à trois et cinq mètres devant soi,
  // sur un sol libre de tout mur à deux pas et demi. (2 octobre : la distance à la nappe seule le
  // posait dans une cour de brique, devant une eau cachée sous l'herbe.)
  L.pecheur = rive(164, 610) || [163.6, 610.2, -2.1];
  // Hermès, le cocher (E3, 7 octobre) : au relais de poste, au bout du pont de Fin côté ville, tourné vers le pont
  { const [x, z] = placeLibre(10, 262, 1, 0.4); L.hermes = [x, z, Math.atan2(-1 - x, 252 - z)]; }
  // la marchande de cartes, rue du Cygne (la rue de l'allumeur, qui mène à la salle de la garde), tournée vers la rue
  { const [x, z] = placeLibre(229, 672, 0, 1); L.marchande = [x, z, Math.atan2(223 - x, 668 - z)]; }
  // Houtland et le mage : à la place que leur donnait le prologue, devant la salle de la garde
  L.houtland = [E_.eugene[0], E_.eugene[1], Math.atan2(E_.x - E_.eugene[0], E_.z - E_.eugene[1])];
  { const [mx, mz] = placeLibre(E_.x - Math.sin(E_.yaw) * 3 + Math.cos(E_.yaw) * 1.6, E_.z - Math.cos(E_.yaw) * 3 - Math.sin(E_.yaw) * 1.6, -Math.sin(E_.yaw), -Math.cos(E_.yaw));
    L.mage = [mx, mz, Math.atan2(E_.x - mx, E_.z - mz)]; }
  return (A1.lieux = L);
}
// une berge d'où l'on voit l'eau, au plus près de (x0 ; z0) : [x, z, yaw tourné vers l'eau]
function rive(x0, z0, rMax = 40) {
  for (let r = 0; r < rMax; r += 1) for (let k = 0; k < 48; k++) {
    const a = k / 48 * TAU, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (eauVisible(x, z) || sdEau(x, z) < 0.6) continue;
    const h = getH(x, z); if (blocked(x, z, 0.8, false, h + 0.5)) continue;
    let libre = true;
    for (let j = 0; j < 8 && libre; j++) { const b = j / 8 * TAU, bx = x + Math.cos(b) * 2.5, bz = z + Math.sin(b) * 2.5;
      if (!eauVisible(bx, bz) && blocked(bx, bz, 0.3, false, h + 0.5)) libre = false; }
    if (!libre) continue;
    for (let j = 0; j < 24; j++) { const b = j / 24 * TAU;
      if (eauVisible(x + Math.cos(b) * 3, z + Math.sin(b) * 3) && eauVisible(x + Math.cos(b) * 5, z + Math.sin(b) * 5)) return [x, z, Math.atan2(Math.cos(b), Math.sin(b))]; }
  }
  return null;
}
// les coffres que marquent les plans de Vauban (la marchande, E3) : remplis au bâti, avant la partie
const COFFRES_VAUBAN = [];
const NOMS = { marchande: 'la marchande de cartes', hermes: 'Hermès', crieur: 'le crieur public', allumeur: 'l’allumeur de lanternes', gardien: 'le gardien de la chapelle', pecheur: 'le vieux pêcheur', houtland: 'Houtland', mage: 'le vieux mage' };
// « parler à le… » : l'article se contracte
const A_QUI = (n) => n.replace(/^le /, 'au ').replace(/^(?!au )/, 'à ');
function preparerActe1() {
  if (A1.pret || !acte1()) return;
  A1.pret = true;
  if (G.level) G.level.indices = indicesJournal;
  const L = lieuxActe1();
  // les deux qu'on a déjà (le prologue les a bâtis) : on les pose et on leur donne la parole
  for (const [cle, qui] of [['houtland', 'houtland'], ['mageBourg', 'mage']]) {
    const v = PARTAGE[cle]; if (!v) continue;
    const [x, z, yaw] = L[qui]; v.position.set(x, getH(x, z), z); v.rotation.y = yaw; v.visible = true;
    A1.gens[qui] = v; parlerA(v, qui); addCap(x, z, x, z, 0.4);
  }
  A1.aFaire = ['crieur', 'allumeur', 'gardien', 'pecheur', 'hermes', 'marchande'];
}
// un par image : une demi-douzaine de personnages riggés d'un coup, c'était une image figée
function naitreActe1() {
  // (Hermès prend le corps du colporteur : pnj.js n'a pas de cocher, et il n'est pas à E3)
  // (la marchande est la marchande des villageois de pnj.js, comme Aldegonde au bourg)
  const qui = A1.aFaire.shift(), v = qui === 'marchande' ? PNJ.buildVillageois(0) : PNJ.buildRole(qui === 'hermes' ? 'colporteur' : qui);
  if (!v) { A1.aFaire.length = 0; return; }
  const [x, z, yaw] = lieuxActe1()[qui];
  v.position.set(x, getH(x, z), z); v.rotation.y = yaw; v.scale.setScalar(G.echelle);
  // le pêcheur se tient debout, sa canne tendue au-dessus de l'eau
  if (qui === 'pecheur') { v.userData.idle = 'Idle_Loop'; v.add(canneAPeche()); }
  scene.add(v); A1.gens[qui] = v; addCap(x, z, x, z, 0.4); parlerA(v, qui);
}
// la canne du pêcheur : une perche de frêne, la ligne qui tombe à l'eau. Bois photographié.
function canneAPeche() {
  const g = new THREE.Group(), L = 3.6 / G.echelle;
  const perche = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, L, 6), phMat('wood_planks', 0.3, 2, { color: 0xb89a70 }));
  perche.position.set(0.25, 1.1 + L / 2 * Math.sin(0.5), L / 2 * Math.cos(0.5)); perche.rotation.x = Math.PI / 2 - 0.5; g.add(perche);
  const bout = [0.25, 1.1 + L * Math.sin(0.5), L * Math.cos(0.5)];
  // la ligne s'arrête à la surface, une trentaine de centimètres sous la berge (elle plongeait d'un mètre)
  const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, bout[1] + 0.3, 3), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 }));
  fil.position.set(bout[0], (bout[1] - 0.3) / 2, bout[2]); g.add(fil);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}
function parlerA(v, qui) {
  addInteract({ pos: v.position, r: 2.6, enabled: () => v.visible && !!acte1(), prompt: () => `parler ${A_QUI(NOMS[qui])}`,
    fn: () => { v.rotation.y = Math.atan2(player.pos.x - v.position.x, player.pos.z - v.position.z); v.userData.talk = 4;
      dialogue(repliques(qui) || [{ who: NOMS[qui], text: '« … »' }], () => { v.userData.talk = 0; }); } });
}

// LES RÉPLIQUES (DIALOGUES-ACTE1.md, recopiées mot pour mot ; le gras entre **…** est
// celui du fichier). Une fonction par habitant : elle lit l'étape et le carnet, et rend
// la réplique de l'étape la plus récente. Les habitants du bourg (village.js) passent
// aussi par ici, par PARTAGE.repliquesActe1 : un seul endroit sait où en est l'histoire.
const ind = (k) => !!(state.ind && state.ind[k]);
const dit = (who, text, fn) => ({ who, text, fn });
function repliques(qui) {
  const e = acte1(); if (!e) return null;
  switch (qui) {
    case 'houtland':
      return [dit('Houtland', '« J’ai envoyé dix hommes soulever la grande grille. Ils poussent encore. »')];
    case 'mage':
      if (atteint('lanterne')) return [dit('Le vieux mage', '« Cette lanterne a éclairé plus de nuits que tu ne crois. »')];
      return [dit('Le vieux mage', '« Phinaert. Je pensais ne plus jamais entendre ce nom. »'),
        dit('Le vieux mage', '« Désiré a quitté le beffroi cette nuit. **Cornélie** voit tout ce qui passe dans le bourg : demande-lui. »')];
    case 'crieur':
      // (DIALOGUES-ACTE1.md ; la phrase sur Hermès est revenue avec le voyage rapide, E3)
      if (atteint('donjon')) return [dit('Le crieur public', '« Oyez ! Les trois cadenas sont tombés ! La garde est au donjon ! »')];
      if (atteint('citadelle')) return [dit('Le crieur public', '« Oyez ! La citadelle est reprise ! Trois monstres gardent encore le donjon ! **Hermès, le cocher du relais de poste,** mène la garde partout où elle veut ! »')];
      if (atteint('lanterne')) return [dit('Le crieur public', '« Oyez ! La garde descend sous la chapelle ! Que saint Roch la garde ! »')];
      return [dit('Le crieur public', '« Oyez ! La Grande Cloche est fendue, le géant d’osier ne bouge plus ! On cherche le guetteur Désiré, qui l’a vu ? »')];
    case 'gardien':
      if (state.lanterne) return [dit('Le gardien de la chapelle', '« La crypte ? **L’escalier est derrière l’autel.** Que saint Roch te garde. »')];
      return [dit('Le gardien de la chapelle', '« Il est passé, mais il n’est pas resté. Il voulait **voir la ville sans être vu**, qu’il a dit. **Gustave** le connaît mieux que moi. »', () => noter('gustave')),
        dit('Le gardien de la chapelle', '« La Grande Cloche est plus vieille que cette chapelle. On dit qu’un ermite l’a fait fondre, au temps des géants. »')];
    case 'allumeur':
      if (state.lanterne) return [dit('L’allumeur', '« Tu as la lanterne de Désiré ! **Rallume les lanternes de la rue du Cygne**, veux-tu ? Moi, j’ai peur du noir, maintenant. »')];
      return [dit('L’allumeur', '« Désiré ? Je l’ai vu cette nuit, à minuit, **monter vers le beffroi** avec sa lanterne. Depuis, on voit sa lumière là-haut, mais **seulement la nuit**. Il ne m’a pas dit bonsoir. Il me dit toujours bonsoir. »', () => noter('nuit')),
        dit('L’allumeur', '« Je n’ose plus sortir faire ma tournée. Les rues sont trop noires. »')];
    case 'marchande':
      if (state.plansVauban) return [dit('La marchande de cartes', '« Tu as les plans ? Alors tu sais où chercher. Les coffres, c’est sur les bastions. »')];
      return [dit('La marchande de cartes', '« La citadelle ! J’ai les plans de Vauban, moi. **Les coffres des bastions, tout est dessus.** Ça a un prix : trente écus. »', () => { A1.vauban = true; })];
    case 'hermes':
      return [dit('Hermès', '« Hermès, pour te servir. Pour la garde, c’est gratuit. **Je te mène à tout endroit de Lille que tu as déjà vu.** »', () => { A1.voyage = true; })];
    case 'pecheur':
      if (state.canne) return [dit('Le vieux pêcheur', state.cleBeffroi ? '« Il y a un brochet dans la Deûle, vieux comme la citadelle. Personne ne l’a jamais pris. On dit qu’il ne sort qu’à la pleine lune. »' : '« Alors, ça mord ? »')];
      if (state.vers) return [dit('Le vieux pêcheur', '« Bien gras. **Tiens, la canne.** Lance, attends que le bouchon plonge, et ramène doucement. Doucement, j’ai dit. »',
        () => { state.canne = true; passerA('canne'); SFX.win(); burst(player.pos.x, player.pos.y + 1.5, player.pos.z, 0xffe070, 24, 3, 1.2, 2, 1.2); saveGame(true); })];
      if (ind('pecheur')) return [dit('Le vieux pêcheur', '« Ma canne ? Je veux bien te la prêter. Mais on ne pêche pas sans vers : **il y en a plein dans le champ d’Émile, là où tu as coupé le blé.** »', () => noter('vers'))];
      return [dit('Le vieux pêcheur', '« La cloche s’est tue, et les poissons aussi. Ils sentent ces choses-là, les poissons. »')];
    // ---- les habitants du bourg, que bâtit village.js ----
    case 'Cornélie':
      if (state.lanterne) return [dit('Cornélie', '« Tu l’as trouvé ! Et Pralin, toujours rien ? »')];
      return [dit('Cornélie', '« Désiré ? Je l’ai vu filer **vers la chapelle** cette nuit, sa lanterne sous le bras. »', () => noter('cornelie'))];
    case 'Émile':
      if (state.lanterne) return [dit('Émile', '« Tu l’as trouvé, ce vieux hibou ? Il t’a posé une devinette, je parie. »')];
      if (state.cleBeffroi) return [dit('Émile', '« Désiré ne se montre qu’à la nuit, tu sais. **Dors un peu chez toi, et monte après minuit.** »')];
      if (state.canne) return [dit('Émile', '« Tu as la canne du vieux ? **Lance dans le canal de la Tortue, derrière le moulin**, c’est là qu’elle est tombée. Et dis à Désiré que sa bouteille l’attend. »')];
      if (ind('escalier')) return [dit('Émile', '« La clé de l’escalier du beffroi ? Ah… Ce matin, en courant à la fête, elle m’a glissé de la poche. **Elle est au fond du canal de la Tortue, derrière le moulin.** **Le vieux pêcheur du quai** a une canne, lui. »', () => { noter('canal'); noter('pecheur'); })];
      return [dit('Émile', '« Le canyon, derrière le bois ? Personne n’en est jamais revenu. Au fond, l’eau est si froide qu’elle coupe le souffle. »')];
    // Désiré n'est plus dans les rues : il se cache au beffroi, la nuit (desireOu)
    case 'Désiré':
      if (state.lanterne) return [dit('Désiré', '« Il y a des fantômes dans le quartier depuis cette nuit. Je les sens, je ne les vois pas. **Toi, avec la lanterne, tu les verrais.** »', () => setQuest('ghosts', 1))];
      // au sommet, la nuit : la clé, le remords, puis l'énigme (posée à la fin du dialogue : tickActe1)
      if (state.desireVu) return [dit('Désiré', '« Ma lanterne ? Elle n’éclaire que celui qui sait regarder la ville. Réponds-moi d’abord. »', () => { A1.enigme = true; })];
      return [dit('Désiré', '« Qui t’a donné la clé ? Émile. Évidemment. Il l’a repêchée ? Ah, c’est toi. »', () => { state.desireVu = true; }),
        dit('Désiré', '« C’est moi qui ai laissé la corde au petit. Je ne me le pardonnerai pas. »'),
        dit('Désiré', '« Ma lanterne ? Elle n’éclaire que celui qui sait regarder la ville. Réponds-moi d’abord. »', () => { A1.enigme = true; })];
    // Ceux qui n'ont rien à dire de l'enquête disent la ville qui s'est fermée (ambiance)
    case 'Aldegonde': return [dit('Aldegonde', '« Les volets sont fermés partout. Ma mère disait que la Grande Cloche ne se fendrait jamais. »')];
    case 'Baptiste': return [dit('Baptiste', '« Personne n’a mangé une gaufre depuis midi. Un jour de fête, ça ne s’était jamais vu. »')];
    case 'Fernande': return [dit('Fernande', '« Mon homme est des dix qui poussent la grille. Il rentrera trempé de sueur, et bredouille. »')];
  }
  return null;
}
PARTAGE.repliquesActe1 = repliques;

// Lydéric, en osier : il ne tourne plus la tête, mais il parle (SCENARIO.md)
function lydericActe1() {
  const L = (t, fn) => ({ who: 'Lydéric', text: t, fn });
  let lines;
  if (atteint('lanterne')) lines = [L('« Je ne peux plus tourner la tête. Dis-moi ce que tu vois de la citadelle. »')];
  else if (ind('crypteNoire')) lines = [L('« Sous terre, il faut une lumière qui ne s’éteint pas. **La lanterne de Désiré**, le guetteur du beffroi. Il ne la quitte jamais. »', () => noter('lanterne')),
    L('« Tu as prêté serment ce matin. Tu ne savais pas que ce serait pour ça. »')];
  else lines = [L('« Il est entré dans la citadelle et il a fait tomber la grande grille de l’entrée. Il y a un autre chemin : **la crypte de la chapelle Saint-Roch**, la cave sous l’église, descend jusqu’aux souterrains de la citadelle. »', () => noter('crypte')),
    L('« Tu as prêté serment ce matin. Tu ne savais pas que ce serait pour ça. »')];
  dialogue(lines, () => { state.metLyderic = true; saveGame(true); });
}

// ce qu'il reste à faire, dans l'ordre du fil — l'objectif du journal et le point d'or
function suiteActe1() {
  // de la poterne au Temple (étapes 9 et 10) : citadelle.js dit l'objectif et le point d'or
  const oc = ACTE1_CITADELLE.objectif(); if (oc) return oc;
  const E_ = PARTAGE.ecole, [bx, bz] = [194, 681], [cx, cz] = [210, 691];
  if (!ind('crypte')) return ['Va parler à Lydéric, sur le pont (Entrée)', { x: LYD_X, z: LYD_Z }];
  if (!ind('crypteNoire')) return ['Descends dans la crypte de la chapelle Saint-Roch, au bourg', { x: cx, z: cz }];
  if (!ind('lanterne')) return ['Retourne voir Lydéric, sur le pont', { x: LYD_X, z: LYD_Z }];
  if (!ind('escalier')) {
    // (l'estaminet est une porte dans une façade relevée depuis le 5 octobre : PARTAGE.estaminet)
    if (ind('gustave')) return ['Demande à Gustave, à l’estaminet, où se cache Désiré', PARTAGE.estaminet ? { x: PARTAGE.estaminet.x, z: PARTAGE.estaminet.z } : { x: 218, z: 662 }];
    if (ind('cornelie')) return ['Interroge le gardien de la chapelle Saint-Roch', { x: cx, z: cz }];
    return ['Trouve Désiré, le guetteur du beffroi : demande dans le bourg (le vieux mage, devant la salle de la garde)', { x: E_.x, z: E_.z }];
  }
  if (!ind('canal')) return ['Demande à Émile la clé de la petite porte du beffroi', null];
  if (!state.canne) {
    if (state.vers) return ['Rapporte les vers au vieux pêcheur, sur le quai devant ta maison', A1.gens.pecheur ? { x: A1.gens.pecheur.position.x, z: A1.gens.pecheur.position.z } : null];
    if (ind('vers')) { const ch = champDuNord(); return ['Trouve des vers dans le champ du nord d’Émile : frappe la terre retournée à l’épée', ch ? { x: ch.cx, z: ch.cz } : null]; }
    return ['Demande sa canne au vieux pêcheur, sur le quai devant ta maison', A1.gens.pecheur ? { x: A1.gens.pecheur.position.x, z: A1.gens.pecheur.position.z } : null];
  }
  if (!state.cleBeffroi) return ['Pêche la clé dans le canal de la Tortue, derrière le moulin : face à l’eau, Entrée pour lancer', { x: CANAL.x, z: CANAL.z }];
  const pb = PARTAGE.porteBeffroi;
  if (!state.lanterne) {
    if (!state.nuit) return ['Désiré ne se montre que la nuit : dors chez toi jusqu’au soir (ton lit, Entrée)', { x: HOUSE.x, z: HOUSE.z }];
    if (!state.porteBeffroi) return ['Ouvre la petite porte du beffroi avec la clé d’Émile', pb ? { x: pb.x, z: pb.z } : { x: bx, z: bz }];
    return ['Monte au sommet du beffroi : Désiré y veille, sa lanterne allumée', { x: bx, z: bz }];
  }
  return [state.nuit ? 'Descends dans la crypte de la chapelle avec la lanterne (ou redors jusqu’au matin)' : 'Descends dans la crypte de la chapelle avec la lanterne', { x: cx, z: cz }];
}
const CANAL = { x: 436, z: 12 };

// appelé par update() : naissances, point d'or
function tickActe1(dt) {
  nuitLille(!!state.nuit);
  tickPeche(dt);
  if (!acte1()) return;
  if (!A1.pret) preparerActe1();
  if (A1.aFaire.length) naitreActe1();
  if (A1.gens.hermes) A1.gens.hermes.visible = atteint('citadelle');      // le relais rouvre quand la citadelle est reprise
  if (A1.gens.marchande) A1.gens.marchande.visible = atteint('citadelle');
  // les plans de Vauban : les coffres pas encore ouverts, sur la carte et la minicarte (comme les repères du multi)
  if (state.plansVauban && (A1.marquesT = (A1.marquesT || 0) - dt) <= 0) { A1.marquesT = 1;
    PARTAGE.marques = COFFRES_VAUBAN.filter((c) => !(c.fait ? c.fait() : state.coffres && state.coffres[c.id])).map((c) => ({ x: c.x, z: c.z, fond: '#ffd24a', bord: '#3a2a10' })); }
  // Houtland et le mage sont déjà animés par update() ; les nouveaux, seulement s'ils sont près
  const c = camera.position;
  for (const [qui, v] of Object.entries(A1.gens)) if (v.visible && qui !== 'houtland' && qui !== 'mage' && Math.abs(v.position.x - c.x) + Math.abs(v.position.z - c.z) < 60) PNJ.animeVillageois(v, dt, false);
  if (!PRO.etape && !cut.active) { const s = suiteActe1(); PARTAGE.repere = s[1]; }
  desireOu();
  porteBasse();
  tickVers();
  if (A1.enigme && !cut.active) { A1.enigme = false; enigmeDesire(); }
  if (A1.voyage && !cut.active) { A1.voyage = false; voyageHermes(); }
  if (A1.vauban && !cut.active) { A1.vauban = false; plansVauban(); }
}
// LES PLANS DE VAUBAN (E3, 7 octobre ; DIALOGUES-ACTE1.md, « La marchande de cartes ») : contre trente
// écus (bourse.js), les coffres des bastions pas encore ouverts s'affichent sur la carte et la minicarte.
// (Il n'y a pas de morceau de cœur dans la citadelle : la réplique ne parle que des coffres.)
function plansVauban() {
  showMenu('LES PLANS DE VAUBAN', 'La marchande de cartes', 'Les coffres des bastions de la citadelle, relevés par les ingénieurs du roi. Trente écus.',
    [{ label: 'Acheter les plans (30 écus)', fn: () => { hideMenu(); state.paused = false;
        if (!BOURSE.aBourse()) { showMessage('« Sans bourse, petite ? Reviens avec de quoi payer. »', 4); return; }
        if (!BOURSE.peutPayer(30)) { showMessage('« Trente écus, pas un de moins. »', 3); return; }
        BOURSE.payer(30); state.plansVauban = true; A1.marquesT = 0; saveGame(true); SFX.unlock && SFX.unlock();
        showMessage('Les plans de Vauban : les coffres des bastions sont sur ta carte et ta minicarte.', 5); } },
      { label: 'Pas maintenant', fn: () => { hideMenu(); state.paused = false; } }]);
}
PARTAGE.plansVauban = plansVauban;        // pour les bancs

// LE VOYAGE RAPIDE (E3, 7 octobre ; DIALOGUES-ACTE1.md, « Hermès ») : un menu des lieux de Lille déjà
// découverts (ceux de la carte : addLieu, estDecouvert) ; la voiture part, l'écran passe au noir, et
// l'on descend devant le lieu, sur une place libre. Comme le petit train des Pouilles et les poteaux.
function voyageHermes() {
  const vus = lieux.filter((l) => l && l.id && l.x != null && estDecouvert(l.id) && Math.hypot(l.x - player.pos.x, l.z - player.pos.z) > 25);
  if (!vus.length) { showMessage('« Tu n’as encore rien vu de Lille, toi ! Promène-toi d’abord. »', 4); return; }
  showMenu('LA VOITURE D’HERMÈS', 'Le relais de poste', 'Il te mène à tout endroit de Lille que tu as déjà vu.',
    [...vus.map((l) => ({ label: l.nom.charAt(0).toUpperCase() + l.nom.slice(1), fn: () => { hideMenu(); state.paused = false; partirAvecHermes(l); } })),
      { label: 'Rester ici', fn: () => { hideMenu(); state.paused = false; } }]);
}
function partirAvecHermes(l) {
  const voile = document.createElement('div');
  voile.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .6s;z-index:50;pointer-events:none';
  document.body.appendChild(voile); requestAnimationFrame(() => { voile.style.opacity = '1'; });
  showMessage('La voiture d’Hermès cahote sur les pavés…', 3);
  setTimeout(() => {
    // une place libre devant le lieu, du côté d'où l'on arrive (le centre peut être un bâtiment)
    const [x, z] = placeLibre(l.x, l.z, player.pos.x - l.x, player.pos.z - l.z);
    player.pos.set(x, getH(x, z), z); player.vy = 0; player.yaw = Math.atan2(l.x - x, l.z - z); G.camYaw = player.yaw;
    saveGame(true); voile.style.opacity = '0'; setTimeout(() => voile.remove(), 700);
    showMessage('Hermès : « Nous y voilà. ' + l.nom.charAt(0).toUpperCase() + l.nom.slice(1) + '. »', 3);
  }, 900);
}
PARTAGE.voyageHermes = voyageHermes;      // pour les bancs

// ---------- la porte basse du beffroi (étapes 2 et 6) ----------
// Le vantail est bâti par village.js (PARTAGE.porteBeffroi), ouvert : une ancienne partie monte
// au coffret comme avant. L'acte I le ferme à clé jusqu'à la nuit où Camille l'ouvre avec la
// clé d'Émile (state.porteBeffroi) ; il reste ouvert ensuite.
let porteIt = null;
function porteBasse() {
  const pb = PARTAGE.porteBeffroi; if (!pb) return;
  const ferme = !state.porteBeffroi;
  if (pb.etat !== ferme) { pb.etat = ferme; pb.ferme(ferme); }
  if (porteIt) return;
  porteIt = addInteract({ pos: new THREE.Vector3(pb.x, getH(pb.x, pb.z), pb.z), r: 2.2, enabled: () => !!acte1() && !state.porteBeffroi,
    prompt: () => (state.cleBeffroi ? 'ouvrir la petite porte (la clé d’Émile)' : 'la petite porte du beffroi'),
    fn: () => {
      if (!state.cleBeffroi) { dialogue([dit('Camille', '« Fermé à clé. »')]); return; }
      // de jour, la porte reste close : Désiré n'est pas là-haut (DIALOGUES-ACTE1.md, Désiré, `cle`)
      if (!state.nuit) { dialogue([dit('Camille', '« Il n’est pas là. L’allumeur a dit : seulement la nuit. »')]); return; }
      state.porteBeffroi = true; saveGame(true); SFX.pickup();
      showMessage('La clé d’Émile tourne dans la serrure. Là-haut, une lumière veille.', 4);
    } });
}

// ---------- Désiré (étape 6) ----------
// Le jour, il n'est nulle part ; la nuit, il veille au sommet du beffroi, sa lanterne posée à
// ses pieds ; la lanterne donnée, il redescend faire sa ronde dans les rues (sa tournée d'avant).
function desireOu() {
  const v = PARTAGE.desire, B = PARTAGE.beffroi; if (!v) return;
  const ou = state.lanterne ? 'rues' : state.nuit && B ? 'haut' : 'cache';
  if (ou === A1.desire) return;
  const ud = v.userData;
  if (A1.desire === null) { ud.routeRues = ud.route; ud.rues = v.position.clone(); }
  A1.desire = ou;
  v.visible = ou !== 'cache';
  if (ou === 'haut') { ud.route = null; v.position.set(B.desire[0], B.desire[1], B.desire[2]); v.rotation.y = B.desire[3]; }
  else if (ou === 'rues') { ud.route = ud.routeRues; v.position.copy(ud.rues); }
  // sa lanterne éclaire la chambre des cloches : la lumière du haut du colimaçon y monte
  const l = PARTAGE.lumiereBeffroi;
  if (l && B) { if (!l.userData.bas) l.userData.bas = l.position.clone();
    if (ou === 'haut') l.position.set(B.desire[0] + Math.sin(B.desire[3] + 1.2) * 0.6, B.desire[1] + 1.4, B.desire[2] + Math.cos(B.desire[3] + 1.2) * 0.6);
    else l.position.copy(l.userData.bas); }
}
function enigmeDesire() {
  ATLAS.enigme({
    titre: 'L’ÉNIGME DU GUETTEUR', sous: 'Désiré, au sommet du beffroi',
    intro: 'Désiré pose la main sur sa lanterne et regarde la ville endormie.',
    gagne: () => dialogue([dit('Désiré', '« Tu regardes, toi. Prends-la. **La crypte de la chapelle** t’attend. »', () => {
      state.lanterne = true; passerA('lanterne'); SFX.win();
      burst(player.pos.x, player.pos.y + 1.5, player.pos.z, 0xffd27a, 30, 3, 1.4, 2, 1.4);
      showMessage('LA LANTERNE DE DÉSIRÉ : sous terre, elle ne s’éteint pas. Et la carte du guetteur est à toi (M).', 7);
    })]),
    perd: () => dialogue([dit('Désiré', '« Regarde encore. La ville ne bouge pas, elle. »')]),
  });
}

// ---------- les vers (étape 3) ----------
// « Il y en a plein dans le champ d'Émile, là où tu as coupé le blé » : quatre mottes de terre
// retournée par la fauche, dans le champ du nord ; un coup d'épée dans l'une d'elles, et Camille
// en remplit une poignée. Bâties à la première image de l'acte (pas au chargement : règle 8).
const VERS = { mottes: null };
PARTAGE.vers = VERS;                 // pour les bancs (bancs/acte1-b1.mjs)
function tickVers() {
  if (state.vers || state.canne) { if (VERS.mottes) { for (const m of VERS.mottes) scene.remove(m); VERS.mottes = []; } return; }
  if (!VERS.mottes) VERS.mottes = poserMottes();
  if (!(player.attackT > 0.08 && player.attackT < 0.3)) return;
  const fx = player.pos.x + Math.sin(player.yaw) * 1.1, fz = player.pos.z + Math.cos(player.yaw) * 1.1;
  for (const m of VERS.mottes) {
    if (Math.hypot(fx - m.position.x, fz - m.position.z) > 1.5) continue;
    state.vers = true; saveGame(true); SFX.pickup();
    burst(m.position.x, m.position.y + 0.3, m.position.z, 0x5a3e26, 26, 3, 1.0, 2, 0.9);
    showMessage('Des vers, bien gras, bien vivants. Camille en remplit une poignée.', 5);
    return;
  }
}
function poserMottes() {
  const ch = champDuNord(); if (!ch) return [];
  const terre = phMat('brown_mud_03', 1.6, 1.6, { color: 0xb8987a, roughness: 1 });
  // une motte : un dôme bosselé, écrasé, et quelques mottes plus petites autour
  // (assez haute pour sortir des touffes d'herbe du bord du champ : à 25 cm, l'herbe la cachait)
  const geo = new THREE.SphereGeometry(1.0, 16, 8, 0, TAU, 0, Math.PI / 2), po = geo.attributes.position;
  for (let i = 0; i < po.count; i++) { const x = po.getX(i), z = po.getZ(i), y = po.getY(i), n = 1 + 0.18 * Math.sin(x * 7.3 + z * 3.1) * Math.cos(z * 5.7);
    po.setXYZ(i, x * n, y * 0.5 * n, z * n); }
  geo.computeVertexNormals();
  const out = [];
  for (let k = 0, essai = 0; k < 4 && essai < 60; essai++) {
    // au bord du champ, juste hors des épis (au milieu, le blé debout les cachait), du côté du
    // moulin, d'où l'on arrive : de l'autre côté, c'est le bois, et elles étaient sous les arbres
    const a0 = Math.atan2(FERME.z - ch.cz, FERME.x - ch.cx), a = a0 + ((essai * 0.618) % 1 - 0.5) * 1.6;
    const r = ch.rayon + 1.2 + 1.5 * ((essai * 0.382) % 1), x = ch.cx + Math.cos(a) * r, z = ch.cz + Math.sin(a) * r;
    if (blocked(x, z, 1, false, getH(x, z) + 0.5) || out.some((m) => Math.hypot(m.position.x - x, m.position.z - z) < 4)) continue;
    const g = new THREE.Group(); g.position.set(x, getH(x, z) - 0.04, z); g.rotation.y = a;
    const d = new THREE.Mesh(geo, terre); d.receiveShadow = d.castShadow = true; g.add(d);
    for (let j = 0; j < 5; j++) { const b = j * 1.3 + a, c = new THREE.Mesh(geo, terre); c.scale.setScalar(0.18 + 0.08 * (j % 3)); c.position.set(Math.cos(b) * 0.95, 0, Math.sin(b) * 0.95); g.add(c); }
    scene.add(g); out.push(g); k++;
  }
  return out;
}

// ---------- la pêche (étape 4 ; SCENARIO.md, « La canne à pêche ») ----------
// Le même geste partout : face à l'eau, Entrée lance ; on attend que le bouchon plonge ; Entrée
// ferre ; Entrée TENUE ramène, et la ligne se tend — relâcher avant qu'elle casse. Au bon endroit
// (le canal de la Tortue), au lieu d'un poisson : la clé de l'escalier du beffroi.
const PECHE = { it: null, ok: false, phase: null, t: 0, attente: 0, dist: 0, tension: 0, avant: false, x0: 0, z0: 0,
  bouchon: null, ligne: null, perche: null, cible: new THREE.Vector3(), barre: null };
PARTAGE.peche = PECHE;               // pour les bancs
const POISSONS = ['un gardon', 'une perche', 'une brème', 'une petite anguille', 'un rotengle'];
// le point d'eau devant Camille, entre 2,5 et 6 m, ou null
function eauDevant() {
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  for (let d = 2.5; d <= 6; d += 0.5) { const x = player.pos.x + fx * d, z = player.pos.z + fz * d;
    if (eauVisible(x, z) && sdEau(x, z) < -0.4) return [x, z]; }
  return null;
}
function tickPeche(dt) {
  if (!state.canne) return;
  if (!PECHE.it) PECHE.it = addInteract({ pos: new THREE.Vector3(1e6, 0, 1e6), r: 1.2, enabled: () => PECHE.ok && !PECHE.phase && !cut.active,
    prompt: () => 'pêcher (lancer la ligne)', fn: lancerLigne });
  // l'invite suit Camille quand elle est face à l'eau, la canne en main
  PECHE.ok = !PECHE.phase && !G.monte && !!eauDevant();
  if (PECHE.ok) PECHE.it.pos.copy(player.pos); else PECHE.it.pos.set(1e6, 0, 1e6);
  if (!PECHE.phase) return;
  const enter = !!keys.Enter, appui = enter && !PECHE.avant; PECHE.avant = enter;
  // Camille s'éloigne : elle ramène sa ligne sans rien dire
  if (Math.hypot(player.pos.x - PECHE.x0, player.pos.z - PECHE.z0) > 1.2 || cut.active) { finPeche(); return; }
  PECHE.t += dt;
  const b = PECHE.bouchon, h = getEau(PECHE.cible);
  if (PECHE.phase === 'vol') {
    const k = Math.min(1, PECHE.t / 0.6), tip = boutPerche();
    b.position.lerpVectors(tip, PECHE.cible, k); b.position.y = THREE.MathUtils.lerp(tip.y, h, k) + Math.sin(k * Math.PI) * 1.4;
    if (k >= 1) { burst(PECHE.cible.x, h + 0.05, PECHE.cible.z, 0xcfe4ff, 10, 1.5, 0.5, 1.2, 0.5); PECHE.phase = 'attente'; PECHE.t = 0; PECHE.attente = rand(2.2, 5); }
  } else if (PECHE.phase === 'attente') {
    b.position.set(PECHE.cible.x, h + 0.02 + Math.sin(PECHE.t * 2.4) * 0.025, PECHE.cible.z);
    if (appui) { showMessage('Patience : attends que le bouchon plonge.', 2); }
    if (PECHE.t > PECHE.attente) { PECHE.phase = 'touche'; PECHE.t = 0; SFX.chirp(); burst(b.position.x, h + 0.05, b.position.z, 0xcfe4ff, 14, 2, 0.6, 1.4, 0.6); showMessage('Ça mord ! Entrée !', 1.4); }
  } else if (PECHE.phase === 'touche') {
    b.position.set(PECHE.cible.x, h - 0.1 + Math.sin(PECHE.t * 30) * 0.03, PECHE.cible.z);
    if (appui) { PECHE.phase = 'ramene'; PECHE.t = 0; PECHE.tension = 0.25; PECHE.dist = Math.hypot(PECHE.cible.x - player.pos.x, PECHE.cible.z - player.pos.z); }
    else if (PECHE.t > 1.3) { PECHE.phase = 'attente'; PECHE.t = 0; PECHE.attente = rand(2, 4.5); showMessage('Trop tard : ça a filé.', 2); }
  } else if (PECHE.phase === 'ramene') {
    // la prise tire par saccades ; la clé, elle, ne fait que peser (elle ne se débat pas)
    const cle = estLaCle(), tire = cle ? 0.25 : 0.55 + 0.45 * Math.max(0, Math.sin(PECHE.t * 2.7) * Math.sin(PECHE.t * 1.3 + 1));
    if (enter) { PECHE.dist -= 1.5 * dt; PECHE.tension += (0.25 + 0.6 * tire) * dt; }
    else { PECHE.dist += (cle ? 0 : 0.4 * tire) * dt; PECHE.tension -= 0.7 * dt; }
    PECHE.tension = Math.max(0, PECHE.tension);
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), d = Math.max(0.6, PECHE.dist);
    b.position.set(player.pos.x + fx * d, h - 0.05, player.pos.z + fz * d);
    if (PECHE.tension >= 1) { SFX.hurt(); showMessage('La ligne casse : tu as tiré trop fort. Relâche quand elle se tend.', 4); finPeche(); return; }
    if (PECHE.dist <= 0.6) { prise(cle); finPeche(); return; }
  }
  majLigne();
  majBarre();
}
// la clé est-elle au bout de la ligne ? au canal de la Tortue, tant qu'on ne l'a pas repêchée
const estLaCle = () => !state.cleBeffroi && !!acte1() && Math.hypot(PECHE.cible.x - CANAL.x, PECHE.cible.z - CANAL.z) < 16;
// la surface de l'eau (la nappe que dessine carte.js), pas le fond : le bouchon flotte
function getEau(v) { const e = nappeProche(v.x, v.z); return (e ? e.o.y : getH(v.x, v.z)) + 0.02; }
function lancerLigne() {
  const e = eauDevant(); if (!e) return;
  if (!PECHE.bouchon) {
    PECHE.bouchon = new THREE.Group();
    PECHE.bouchon.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc8261e, roughness: 0.4 })));
    PECHE.bouchon.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.4 })));
    PECHE.ligne = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xe8e4d8 }));
    PECHE.ligne.frustumCulled = false;
    const L = 3.0; PECHE.perche = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.04, L, 6), phMat('wood_planks', 0.3, 2, { color: 0xb89a70 }));
    PECHE.perche.geometry.translate(0, L / 2, 0); PECHE.perche.castShadow = true;
  }
  scene.add(PECHE.bouchon, PECHE.ligne, PECHE.perche);
  PECHE.cible.set(e[0], 0, e[1]); PECHE.x0 = player.pos.x; PECHE.z0 = player.pos.z;
  PECHE.phase = 'vol'; PECHE.t = 0; PECHE.avant = true; SFX.swing();
  majPerche();
}
// la perche part de la main droite de Camille et se lève devant elle
function majPerche() {
  const p = PECHE.perche, fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), rx = fz, rz = -fx;
  p.position.set(player.pos.x + fx * 0.35 - rx * 0.25, player.pos.y + 1.0, player.pos.z + fz * 0.35 - rz * 0.25);
  p.rotation.set(0, 0, 0); p.rotation.order = 'YXZ'; p.rotation.y = player.yaw; p.rotation.x = PECHE.phase === 'ramene' ? 0.95 : 1.05;
}
function boutPerche() { majPerche(); PECHE.perche.updateMatrixWorld(); return new THREE.Vector3(0, 3.0, 0).applyMatrix4(PECHE.perche.matrixWorld); }
function majLigne() {
  const a = boutPerche(), b = PECHE.bouchon.position, po = PECHE.ligne.geometry.attributes.position;
  po.setXYZ(0, a.x, a.y, a.z); po.setXYZ(1, b.x, b.y + 0.07, b.z); po.needsUpdate = true;
}
// la jauge de la ligne : visible quand on ramène, verte puis rouge
function majBarre() {
  if (!PECHE.barre) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);width:220px;padding:6px 10px;border-radius:8px;background:rgba(10,14,20,.6);color:#f2ead8;font:13px system-ui;text-align:center;pointer-events:none;display:none;z-index:20';
    el.innerHTML = '<div>La ligne — Entrée tenue pour ramener</div><div style="margin-top:5px;height:8px;border-radius:4px;background:rgba(255,255,255,.18)"><div style="height:100%;width:0;border-radius:4px"></div></div>';
    document.body.appendChild(el); PECHE.barre = el;
  }
  const on = PECHE.phase === 'ramene'; PECHE.barre.style.display = on ? 'block' : 'none';
  if (!on) return;
  const t = Math.min(1, PECHE.tension), f = PECHE.barre.lastChild.firstChild;
  f.style.width = `${Math.round(t * 100)}%`; f.style.background = t < 0.6 ? '#7ccf6a' : t < 0.85 ? '#e8c050' : '#e05040';
}
function finPeche() {
  PECHE.phase = null; scene.remove(PECHE.bouchon, PECHE.ligne, PECHE.perche);
  if (PECHE.barre) PECHE.barre.style.display = 'none';
}
function prise(cle) {
  if (cle) {
    state.cleBeffroi = true; passerA('cle'); SFX.win();
    burst(player.pos.x, player.pos.y + 1.4, player.pos.z, 0xc8d070, 26, 3, 1.2, 2, 1.2);
    dialogue([dit('', 'Au bout de la ligne, verte de vase, pend une grosse clé de fer : LA CLÉ DE L’ESCALIER DU BEFFROI.')]);
    return;
  }
  SFX.pickup();
  showMessage(`Camille attrape ${POISSONS[Math.floor(rand(0, POISSONS.length))]}… et le rend à l’eau.`, 4);
}

// ---------- la nuit (étape 5) ----------
// state.nuit vient du lit de Camille (house.js : « jusqu'au soir », « jusqu'au matin »). Sans
// toucher au moteur, par ce qu'il exporte : le ciel (ses couleurs, et le soleil caché sous
// l'horizon), le soleil devenu lune, le ciel d'en bas, la brume ; plus de reflet du ciel de jour
// (scene.environment). Les lumières de la ville sont PEINTES : une fenêtre sur trois s'allume
// (émissive, dans le matériau des fenêtres du quartier), les verres des lanternes brillent plus
// fort, et la lanterne de Désiré luit au sommet du beffroi — pas une seule lumière de plus (règle 8).
const NUIT = { actif: false, jour: null, ciel: null, lueurs: null, desire: null };
const SOUS_HORIZON = new THREE.Vector3(0, -1, 0), NUIT_NUAGE = new THREE.Color(0.11, 0.13, 0.19);
function nuitLille(n) {
  if (NUIT.desire) NUIT.desire.visible = n && !state.lanterne && !!acte1();
  if (n === NUIT.actif || !sky || !sky.material.uniforms) return;
  NUIT.actif = n;
  const u = sky.material.uniforms;
  if (!NUIT.jour) NUIT.jour = { top: u.top.value.getHex(), mid: u.mid.value.getHex(), bot: u.bot.value.getHex(), cirrus: u.cirrus.value, soleil: u.sunDir.value,
    sc: sun.color.getHex(), si: sun.intensity, hc: hemi.color.getHex(), hg: hemi.groundColor.getHex(), hi: hemi.intensity,
    brume: scene.fog ? scene.fog.color.getHex() : null, env: scene.environment, expo: renderer.toneMappingExposure, bloom: bloom.strength };
  const J = NUIT.jour;
  u.top.value.setHex(n ? 0x03070f : J.top); u.mid.value.setHex(n ? 0x0a1428 : J.mid); u.bot.value.setHex(n ? 0x18233a : J.bot);
  u.cirrus.value = n ? 0.08 : J.cirrus; u.sunDir.value = n ? SOUS_HORIZON : J.soleil;
  sun.color.setHex(n ? 0x9cb4e8 : J.sc); sun.intensity = n ? 0.5 : J.si;
  hemi.color.setHex(n ? 0x30426e : J.hc); hemi.groundColor.setHex(n ? 0x0b0d14 : J.hg); hemi.intensity = n ? 0.45 : J.hi;
  if (scene.fog && J.brume !== null) scene.fog.color.setHex(n ? 0x0a0f1c : J.brume);
  scene.environment = n ? null : J.env;
  renderer.toneMappingExposure = n ? 1.15 : J.expo; bloom.strength = n ? 0.45 : J.bloom;
  if (n && !NUIT.ciel) cielDeNuit();
  if (NUIT.ciel) NUIT.ciel.visible = n;
  lueursVille(n);
}
// les étoiles et la lune : enfants du ciel, qui suit la caméra
function cielDeNuit() {
  const g = new THREE.Group(), N = 900, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rand(0, TAU), y = Math.pow(rand(0.02, 1), 0.7), r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 600, y * 600, Math.sin(a) * r * 600], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false })));
  // la lune, là où le soleil était : c'est elle qui donne les ombres
  const lune = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 12), new THREE.MeshBasicMaterial({ color: 0xeef1fa, fog: false }));
  lune.position.copy(SUN_DIR).multiplyScalar(560); g.add(lune);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLueur(), color: 0x8fa6d8, transparent: true, opacity: 0.55, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(lune.position); halo.scale.setScalar(120); g.add(halo);
  sky.add(g); NUIT.ciel = g;
  // la lanterne de Désiré, dans la chambre des cloches : un halo peint qu'on voit de loin
  const B = PARTAGE.beffroi;
  if (B) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLueur(), color: 0xffb860, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    s.position.set(...B.lueur); s.scale.setScalar(5); scene.add(s);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.22), new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffa040, emissiveIntensity: 2.5 }));
    l.position.set(B.desire[0] + Math.sin(B.desire[3] + 1.2) * 0.6, B.desire[1] + 0.16, B.desire[2] + Math.cos(B.desire[3] + 1.2) * 0.6);
    const d = new THREE.Group(); d.add(s, l); scene.add(d); NUIT.desire = d; d.visible = !state.lanterne && !!acte1();
  }
}
let LUEUR = null;
function texLueur() {
  if (LUEUR) return LUEUR;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); LUEUR = new THREE.CanvasTexture(c); return LUEUR;
}
// Les fenêtres : le matériau des baies du quartier (quartier.js, texFenetre : un canevas de
// 128 × 160) reçoit, la nuit, une carte émissive (le verre seul, chaud) ; un tirage par baie,
// sur le CENTRE de son quadrilatère (retrouvé par les dérivées de l'écran), en allume une sur
// trois. Les verres chauds (lanternes, devantures) brillent plus fort.
function lueursVille(n) {
  if (!NUIT.lueurs) {
    if (!n) return;
    const fen = new Set(), chauds = new Set(), nuages = new Set();
    // les nuages (nature.js : des amas de bouffées) restaient blancs comme en plein jour
    scene.traverse((o) => { if (o.userData.cloud) o.traverse((b) => { if (b.material && b.material.color) nuages.add(b.material); }); });
    scene.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) {
      if (!m || !m.isMeshStandardMaterial) continue;
      const im = m.map && m.map.image;
      if (im && im.width === 128 && im.height === 160) fen.add(m);
      else if (m.emissive && m.emissiveIntensity > 0 && m.emissive.r > 0.5 && m.emissive.g > 0.25 && m.emissive.b < 0.5) chauds.add(m);
    } });
    NUIT.lueurs = { fen: [...fen], chauds: [...chauds].map((m) => [m, m.emissiveIntensity]), nuages: [...nuages].map((m) => [m, m.color.getHex()]) };
    const em = texFenetreNuit();
    for (const m of NUIT.lueurs.fen) {
      m.emissiveMap = em; m.emissive.setHex(0x000000); m.emissiveIntensity = 1.6;
      const avant = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        if (avant) avant.call(m, sh, r);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNuitP;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 q = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nq = instanceMatrix * q;\n#endif\nvNuitP = (modelMatrix * q).xyz; }');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNuitP;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { vec3 px = dFdx(vNuitP), py = dFdy(vNuitP); vec2 ux = dFdx(vEmissiveMapUv), uy = dFdy(vEmissiveMapUv);
            float det = ux.x * uy.y - ux.y * uy.x; vec3 c = vNuitP;
            if (abs(det) > 1e-9) { vec3 du = (px * uy.y - py * ux.y) / det, dv = (py * ux.x - px * uy.x) / det;
              c = vNuitP - du * (vEmissiveMapUv.x - 0.5) - dv * (vEmissiveMapUv.y - 0.5); }
            float h = fract(sin(dot(floor(c * 0.8 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
            totalEmissiveRadiance *= step(0.66, h) * (0.65 + 0.7 * fract(h * 13.0)); }`);
      };
      m.customProgramCacheKey = () => 'fenetre-nuit';
      m.needsUpdate = true;
    }
  }
  for (const m of NUIT.lueurs.fen) m.emissive.setHex(n ? 0xffb35c : 0x000000);
  for (const [m, i0] of NUIT.lueurs.chauds) m.emissiveIntensity = n ? i0 * 3 : i0;
  for (const [m, c0] of NUIT.lueurs.nuages) { m.color.setHex(c0); if (n) m.color.multiply(NUIT_NUAGE); }
}
// le verre d'une baie la nuit : la même découpe que texFenetre (quartier.js), le reste noir
function texFenetreNuit() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 160);
  const X0 = 27, Y0 = 16, W = 74, H = 128, grd = g.createLinearGradient(0, Y0, 0, Y0 + H);
  grd.addColorStop(0, '#ffcf8a'); grd.addColorStop(1, '#e88a3a'); g.fillStyle = grd; g.fillRect(X0, Y0, W, H);
  g.strokeStyle = '#3a2410'; g.lineWidth = 2; g.save(); g.beginPath(); g.rect(X0, Y0, W, H); g.clip();
  for (let k = -H; k < W + H; k += 13) { g.beginPath(); g.moveTo(X0 + k, Y0); g.lineTo(X0 + k + H, Y0 + H); g.stroke(); g.beginPath(); g.moveTo(X0 + k, Y0 + H); g.lineTo(X0 + k + H, Y0); g.stroke(); }
  g.restore(); g.fillStyle = '#000'; g.fillRect(X0 + W / 2 - 4, Y0, 8, H); g.fillRect(X0, Y0 + H * 0.42, W, 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- situation finale ----------

export function finalScene() {
  state.ending = true; state.lydericOsier = false; saveGame(true);    // Phinaert vaincu, le sort tombe
  const lx = PARTAGE.lyderic.position.x, lz = PARTAGE.lyderic.position.z;
  PARTAGE.lyderic.rotation.y = Math.atan2(player.pos.x - lx, player.pos.z - lz);
  const px = lx + 5.5, pz = lz + 1.5;
  cutscene([
    { cam: [lx + 12, 4, lz + 10], at: [lx + 3, 3, lz], cam2: [lx + 9, 3, lz + 6], at2: [lx + 3, 2.5, lz], dur: 4, walk: [px + 1.5, pz + 1], actor: PARTAGE.prince, to: [px, pz], speed: 3.5, text: 'Camille ramène Eugène à la lumière du jour.', fn: () => { PARTAGE.prince.visible = true; } },
    { say: "« Eugène ! Vous êtes vivants tous les deux ! Camille, tu as fait ce qu'aucun soldat de la garnison n'aurait osé. »", who: 'Lydéric', cam: [lx + 9, 3, lz + 6], at: [lx + 3, 2.5, lz] },
    { say: "« Sans Camille, je serais encore au fond des galeries à écouter les rats. Lille te doit sa liberté, gardienne de la citadelle. »", who: 'Eugène', cam: [px + 4, 2.4, pz + 4], at: [px, 1.6, pz] },
    { say: "« Ce soir, on fête ça au village. Gaufres pour tout le monde ! »", who: 'Eugène', cam: [px + 4, 2.4, pz + 4], at: [px + 1, 1.6, pz] },
    { cam: [lx + 14, 6, lz + 14], at: [lx + 3, 3, lz], cam2: [lx + 30, 22, lz + 40], at2: [0, 10, APO], dur: 7, text: 'La herse de la Porte Royale se relève. Les corbeaux ont quitté le ciel de la citadelle, et le beffroi sonne à toute volée.', fn: () => { player.pose = { kind: 'cheer' }; SFX.fanfare(0); let n = 0; const iv = setInterval(() => { burst(lx + rand(-20, 30), rand(12, 26), lz + rand(-30, 10), [0xff5070, 0xffd070, 0x70c0ff, 0x80ff90][n % 4], 30, 7, 1.6, 2, 1.6); SFX.win(); if (++n > 9) clearInterval(iv); }, 650); } },
    { cam: [lx + 30, 22, lz + 40], at: [0, 10, APO], cam2: [90, 70, 140], at2: [0, 6, 0], dur: 8, title: 'FIN', sub: 'Eugène est sauvé', fade: 0 },
  ], () => { player.pose = null; endGame(true); });
}

export function objective() {
  if (acte1() && !PRO.etape) return suiteActe1()[0];
  return PRO.etape ? PRO.objectif() : state.princeFreed ? 'Ramène Eugène à Lydéric, près du pont' : !state.metLyderic ? 'Va parler à Lydéric, le géant, près du pont (Entrée)' : state.galleryOpen ? 'Descends dans les galeries par la poterne (est de la place d\'Armes) et délivre Eugène' : state.key ? 'Ouvre la grille de la poterne avec la clé du donjon' : state.bossDead ? 'Monte au sommet du donjon (escalier en colimaçon) chercher la clé' : state.gateOpen ? 'Affronte Phinaert dans l\'enclos du donjon' : (state.bow ? `Vaincs encore ${killsLeft()} monstres (fossés à l'arc, remparts, bastions) pour ouvrir l'enclos du donjon` : `Trouve l'arc (bastion de Turenne, à gauche de la porte) et vaincs ${killsLeft()} monstres`);
}
