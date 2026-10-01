// quetes.js — la partie qui se joue.
//
// Secteur Quêtes : peuplement du niveau, dialogues, journal, objectifs, cinématiques,
// et la boucle de jeu propre au niveau (update). Le décor lui est donné tout bâti.
import {
  THREE, G, SFX, TAU, addCap, addInteract, blocked, burst, cut, cutscene, dialogue, endGame, enemies,
  followActor, getH, hideMenu, lerp, phMat, makeChest, makePrince, player, questStep, rand, saveGame, scene, setQuest,
  showMenu, showMessage, spawnEnemy, spawnGaufre, state, naviguer,
} from './engine.js?v=41';
import {
  APO, BAST_H, COURTINES, DONJON, ECH, FERME, MOAT_IN, MOAT_OUT, PONT_Z1, TOWN, bastionAt, bastions, dehorsAt, eauVisible, sdEau, townWorld,
  onBridge, sdPent,
} from './carte.js';
import { PARTAGE } from './etat.js';
import { POTERNE_JEU } from './citadelle.js';
import { geant } from './banque.js';
import * as PNJ from './pnj.js';
import * as BOURSE from './bourse.js';
import { FAUCHE_DEBUG, bleFauche } from './nature.js';

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
      return;
    }
  });
  // coffre de l'arc sur le bastion de Turenne
  { const b = bastions[3]; PARTAGE.bowChest = makeChest(); const cx = b.V[0] + b.u[0] * 12 * ECH, cz = b.V[1] + b.u[1] * 12 * ECH;
    PARTAGE.bowChest.position.set(cx, BAST_H, cz); PARTAGE.bowChest.rotation.y = Math.atan2(-b.u[0], -b.u[1]); scene.add(PARTAGE.bowChest); PARTAGE.bowChest.userData.pos = new THREE.Vector3(cx, BAST_H, cz); addCap(cx, cz, cx, cz, 0.9); }
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
  player.pos.set(1, 0, LYD_Z + 9); player.yaw = Math.PI; G.camYaw = Math.PI;
  player.speed = 11.5;   // la citadelle fait 700 m de large : à 7,2 m/s on la traversait en deux minutes
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
    const an = PARTAGE.lyderic.userData.anim;
    if (an) { an.jouer(PARTAGE.lyderic.userData.walkTo ? 'Walk_Loop' : 'Idle_FoldArms_Loop', 0.4); an.update(dt); }
    else if (!PARTAGE.lyderic.userData.walkTo) { PARTAGE.lyderic.position.y = Math.sin(state.time * 1.5) * 0.08; PARTAGE.lyderic.userData.arms[0].rotation.x = Math.sin(state.time * 1.5) * 0.1; }
  }
  if (PARTAGE.prince && state.princeFreed && !state.ending && !cut.active) {
    PARTAGE.prince.visible = true; followActor(PARTAGE.prince, dt, p.pos, 2.6, 5.5);
    if (Math.hypot(PARTAGE.lyderic.position.x - p.pos.x, PARTAGE.lyderic.position.z - p.pos.z) < 9) finalScene();
  }
  // le prince riggé : marche quand followActor ou une cinématique lui donne un but
  if (PARTAGE.prince && PARTAGE.prince.visible) PNJ.animeVillageois(PARTAGE.prince, dt, !!PARTAGE.prince.userData.walkTo);
  if (PARTAGE.pralin && !cut.active) { PARTAGE.pralin.userData.tail.rotation.z = -0.8 + Math.sin(state.time * 1.7) * 0.4; }
}
// dialogue avec Lydéric selon l'avancement (Entrée)

export function talkLyderic() {
  const alive = killsLeft(); const L = (t, fn) => ({ who: 'Lydéric', text: t, fn });
  PARTAGE.lyderic.rotation.y = Math.atan2(player.pos.x - PARTAGE.lyderic.position.x, player.pos.z - PARTAGE.lyderic.position.z);
  let lines;
  if (!state.metLyderic) lines = [
    L("« Camille ! Tu n'as rien ? Phinaert… je n'ai rien pu faire, ce brigand m'a pris de vitesse. Il a emporté Eugène dans la citadelle et fait tomber la herse. »"),
    L("« Écoute-moi bien. Phinaert s'est enfermé dans l'enclos du donjon, au centre de la place d'Armes. Sa grille est ensorcelée : elle ne s'ouvrira que lorsque dix de ses monstres auront été vaincus. »"),
    L("« Eugène, lui, est sûrement dans les galeries que Vauban a creusées sous les remparts. On y entre par la poterne, à l'est de la place… mais il faut la clé, que Phinaert garde au sommet du donjon. »"),
    L(state.sword ? "« Tu as encore la vieille épée du grand-père d'Émile ? Garde-la, elle coupera autre chose que du blé. Et prends mon bouclier. »"
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
      { label: 'Passer', fn: () => { hideMenu(); introScene(); } },
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

function prologue() {
  const E_ = PARTAGE.ecole, eu = PARTAGE.prince;
  // les monstres ne sont pas encore là : Phinaert ne les lâche qu'avec l'enlèvement
  PRO.cages = enemies.filter((e) => !e.dead && !e.k.boss && !e.caged); for (const e of PRO.cages) e.caged = true;
  player.pos.set(E_.x, getH(E_.x, E_.z) + 0.1, E_.z); player.yaw = E_.yaw; G.camYaw = E_.yaw;
  // Eugène n'est pas à la salle de la garde : il attend au pont, la corde de la cloche en tête
  eu.visible = false;
  // Émile attend à son moulin, face au bourg d'où arrive Camille
  const em = PARTAGE.emile;
  if (em) { PRO.emileAvant = [em.position.x, em.position.y, em.position.z, em.rotation.y];
    const [x, z] = placeLibre(FERME.x, FERME.z, E_.x - FERME.x, E_.z - FERME.z);
    em.position.set(x, getH(x, z), z); em.rotation.y = Math.atan2(E_.x - x, E_.z - z); }
  const cx = E_.x + Math.sin(E_.yaw) * 2.2, cz = E_.z + Math.cos(E_.yaw) * 2.2, cy = player.pos.y;
  const vx = E_.x - Math.sin(E_.yaw) * 5, vz = E_.z - Math.cos(E_.yaw) * 5;
  G.fade = 1; G.fadeTarget = 1; document.getElementById('fade').style.opacity = 1;
  cutscene([
    { cam: [vx + 30, cy + 26, vz + 30], at: [E_.x, cy + 4, E_.z], cam2: [vx + 8, cy + 7, vz + 8], at2: [E_.x, cy + 2, E_.z], dur: 6, fade: 0, title: 'THE LEGEND OF CAMILLE', sub: 'Prologue — La fête des géants', skippable: false },
    { cam: [vx, cy + 3.2, vz], at: E_.enseigne, cam2: [vx + 0.6, cy + 2.2, vz + 0.6], at2: [cx, cy + 1.3, cz], dur: 6, text: 'Lille est en fête : à midi, Lydéric le géant sort sur le pont de Fin. À la salle de la garde, le sergent Houtland cherche son apprentie.' },
    { say: '« Camille ! Lydéric sort à midi, et la garde n’a pas son blé. C’est l’apprentie qui coupe la première botte de l’année, c’est la règle. File au moulin d’Émile, au nord-est du bourg. »', who: 'Houtland' },
    { say: '« Tu ne sais plus où est le moulin ? La carte du beffroi (M). Une apprentie de la garde qui se perd dans son propre bourg, on aura tout vu. »', who: 'Houtland' },
    { say: '« Et ce soir, tu prêteras serment. Ça ne se reprend pas, un serment de la garde. Réfléchis-y en coupant ton blé. »', who: 'Houtland' },
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
      { who: 'Émile', say: '« La première botte de l’année ! Coupe les épis du champ du nord, une dizaine suffit. Tiens la lame à plat. »', cam, at },
      // l'épée d'apprentie viendra du vieux mage (découpage, plan 3) quand il descendra au
      // bourg ; d'ici là, c'est Émile qui la prête — Lydéric s'en souvient (talkLyderic)
      { who: 'Émile', say: '« Pas de lame ? Prends la vieille épée de mon grand-père, un soldat de Vauban. Et ne coupe rien d’autre que du blé. »', fn: () => { state.sword = true; SFX.pickup(); } },
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
    { cam: [-9, 5, lz - 10], at: [0, 6, APO + 10], cam2: [-9, 6, lz - 14], at2: [0, 6, APO], dur: 6, actor: villain, to: [0, APO - 2], speed: 20, text: 'Phinaert emporte Eugène dans la citadelle, et la herse retombe derrière lui.' },
    // un plan à elle : celui qui suit un acteur s'achève quand il arrive (cutTick), la herse
    // tombait donc dans le noir. Phinaert est passé ; elle tombe derrière lui.
    { cam: [-9, 6, lz - 14], at: [0, 6, APO], dur: 2.4, fn: () => { PRO.herseT = 0; SFX.herse(); setTimeout(() => { G.shake = 1; scene.remove(villain); }, 650); } },
    // LA HERSE SE RELÈVE dans le noir : la partie d'aujourd'hui entre dans la citadelle par la
    // Porte Royale. Qu'elle reste baissée — la « grande grille » que dix hommes poussent à
    // l'acte I — se décidera avec l'acte I (docs/DECOUPAGE-PROLOGUE.md).
    { fade: 1, dur: 2, skippable: false, fn: () => { PRO.herseT = -1; if (PARTAGE.herse) PARTAGE.herse.userData.poser(0); } },
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

// l'enlèvement est joué : les monstres se réveillent, Émile rentre au bourg
function finPrologue() {
  for (const e of PRO.cages) e.caged = false; PRO.cages = [];
  const em = PARTAGE.emile, a = PRO.emileAvant;
  if (em && a) { em.position.set(a[0], a[1], a[2]); em.rotation.y = a[3]; }
  PRO.etape = null; PARTAGE.repere = null; state.prologueFait = true;
  if (G.sansSauvegarde) showMenu('FIN DU PROLOGUE', 'La fête des géants', 'Eugène est enlevé. La suite de l’histoire se joue avec ton personnage.', [
    { label: 'Retour à l’accueil', fn: () => { naviguer('accueil.html'); } },
  ]);
}
// ---------- situation finale ----------

export function finalScene() {
  state.ending = true; saveGame(true);
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
  return PRO.etape ? PRO.objectif() : state.princeFreed ? 'Ramène Eugène à Lydéric, près du pont' : !state.metLyderic ? 'Va parler à Lydéric, le géant, près du pont (Entrée)' : state.galleryOpen ? 'Descends dans les galeries par la poterne (est de la place d\'Armes) et délivre Eugène' : state.key ? 'Ouvre la grille de la poterne avec la clé du donjon' : state.bossDead ? 'Monte au sommet du donjon (escalier en colimaçon) chercher la clé' : state.gateOpen ? 'Affronte Phinaert dans l\'enclos du donjon' : (state.bow ? `Vaincs encore ${killsLeft()} monstres (fossés à l'arc, remparts, bastions) pour ouvrir l'enclos du donjon` : `Trouve l'arc (bastion de Turenne, à gauche de la porte) et vaincs ${killsLeft()} monstres`);
}
