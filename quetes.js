// quetes.js — la partie qui se joue.
//
// Secteur Quêtes : peuplement du niveau, dialogues, journal, objectifs, cinématiques,
// et la boucle de jeu propre au niveau (update). Le décor lui est donné tout bâti.
import {
  THREE, G, SFX, TAU, addCap, addInteract, blocked, burst, cut, cutscene, dialogue, endGame, enemies,
  followActor, getH, hideMenu, lerp, phMat, makeChest, makePrince, player, questStep, rand, saveGame, scene, setQuest,
  showMenu, showMessage, spawnEnemy, spawnGaufre, state,
} from './engine.js?v=27';
import {
  APO, BAST_H, COURTINES, DONJON, ECH, FERME, MOAT_IN, MOAT_OUT, PONT_Z1, TOWN, bastionAt, bastions, dehorsAt, eauVisible, sdEau, townWorld,
  onBridge, sdPent,
} from './carte.js';
import { PARTAGE } from './etat.js';
import { geant } from './banque.js';
import * as PNJ from './pnj.js';
import * as BOURSE from './bourse.js';
import { FAUCHE_DEBUG, bleFauche } from './nature.js';

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
  bastions.forEach((b, i) => {
    if (i === 3) return;
    const x0 = b.V[0] + b.u[0] * 10 * ECH, z0 = b.V[1] + b.u[1] * 10 * ECH;
    for (let r = 0; r < 40; r += 1.5) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      if (!bastionAt(x, z) || blocked(x, z, 1.2, false, BAST_H + 0.1) || !BOURSE.aCielOuvert(x, BAST_H, z)) continue;
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
  const LYD_Z = PONT_Z1 + 16;
  PARTAGE.lyderic = geant('lyderic', 0x2b4fa8, 0xe0b64a, 'sword'); PARTAGE.lyderic.position.set(-11, 0, LYD_Z); PARTAGE.lyderic.rotation.y = Math.PI / 2 + 0.3;
  scene.add(PARTAGE.lyderic); addCap(-11, LYD_Z, -11, LYD_Z, 2.2); PARTAGE.lyderic.userData.talkCd = 0;
  addInteract({ pos: PARTAGE.lyderic.position, r: 5.5, prompt: () => 'parler à Lydéric', fn: talkLyderic });
  // le PARTAGE.prince Eugène : présent au pont pour l'intro, puis aux côtés de Camille une fois libéré
  // riggé comme les villageois (la version en primitives ne sert plus que de repli), et à
  // la même échelle qu'eux : l'ancien prince, jamais réduit, dépassait Camille d'une tête
  PARTAGE.prince = PNJ.buildRole('prince') || makePrince(); PARTAGE.prince.scale.setScalar(G.echelle);
  PARTAGE.prince.position.set(4, 0, LYD_Z - 5); PARTAGE.prince.rotation.y = -1.2; PARTAGE.prince.visible = false; scene.add(PARTAGE.prince);
  player.pos.set(0, 0, LYD_Z + 4); player.yaw = Math.PI; G.camYaw = Math.PI;
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
  // une sauvegarde prise pendant le prologue (une récolte, un lieu découvert) : l'histoire
  // n'a pas commencé, on la reprend au début plutôt que de lâcher Camille sans rien
  if (!state.introSeen) setTimeout(debut, 0);
  if (state.bowChest && PARTAGE.bowChest) PARTAGE.bowChest.userData.lid.rotation.x = -1.9;
  if (state.keyChest && PARTAGE.keyChest) PARTAGE.keyChest.userData.lid.rotation.x = -1.9;
  if (state.gateOpen) { openGate(); PARTAGE.donjonGate.position.y = 3.3; }
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
  if (PRO.gateau && !p.pose) {
    // porté à deux mains devant elle ; tendu vers Lydéric quand elle le lui offre
    const av = PRO.tend ? 0.75 : 0.45, e = G.echelle;
    PRO.gateau.position.set(p.pos.x + Math.sin(p.yaw) * av, p.pos.y + (PRO.tend ? 1.2 : 1.0) * e / 0.6, p.pos.z + Math.cos(p.yaw) * av);
  }
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
  PARTAGE.donjonGate.position.y = lerp(PARTAGE.donjonGate.position.y, PARTAGE.donjonGate.userData.open ? 3.3 : 0, 1 - Math.exp(-2 * dt));
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
// ---------- le prologue : « Le gâteau de Lydéric » ----------
// Deux à trois minutes qui apprennent à jouer en racontant : Camille, élève de l'école de
// cuisine Lequeuche, prépare en secret avec Eugène le gâteau d'anniversaire de Lydéric.
// Il manque la farine : on court au moulin d'Émile (se déplacer, suivre le point d'or de
// la minicarte), on fauche une gerbe (l'épée), et au pont, au moment où Camille tend le
// gâteau, Phinaert surgit — l'intro de toujours s'enchaîne. Rien n'est sauvegardé avant
// la fin de l'enlèvement : quitter en route, c'est reprendre le prologue au début.
// Réglages d'avancement : pas dans state, qui part dans la sauvegarde (saveGame).
const PRO = {
  etape: null,              // 'moulin' → 'fauche' → null
  bleDepart: 0, cages: [], emileAvant: null, gateau: null,
  objectif: () => PRO.etape === 'moulin' ? "Cours au moulin d'Émile chercher de la farine (le point d'or de la carte)"
    : PRO.etape === 'fin' ? 'Porte le gâteau à Lydéric' : "Fauche le blé du champ d'Émile (clic gauche ou F)",
};
const GERBE = 18;           // épis à faucher : trois ou quatre coups d'épée dans le blé

// Au premier départ : le prologue, ou l'intro seule pour qui connaît déjà l'histoire.
// Rejoué depuis l'accueil (G.sansSauvegarde), il part directement.
export function debut() {
  if (G.sansSauvegarde) { prologue(); return; }
  showMenu('PROLOGUE', 'Le gâteau de Lydéric',
    'Trois minutes pour apprendre à jouer, avant que l’aventure commence.', [
      { label: 'Jouer le prologue', fn: () => { hideMenu(); prologue(); } },
      { label: 'Passer', fn: () => { hideMenu(); introScene(); } },
    ]);
}

// le gâteau : trois étages de crème, des fraises, des bougies — et il ne survivra pas
function faireGateau() {
  const g = new THREE.Group();
  // le glaçage et le biscuit : le RELIEF et la rugosité de matières photographiées, sans
  // leur couleur — une crème unie faisait plastique, et les fissures de la chaux, crasse
  const sansDessin = (m, c) => { m.map = null; m.color.setHex(c); m.needsUpdate = true; return m; };
  const creme = sansDessin(phMat('chaux_craquelee', 0.3, 0.3, { roughness: 0.55 }), 0xfff3e0);
  const biscuit = sansDessin(phMat('terre_battue', 0.3, 0.3), 0xc98f4e);
  const fraise = new THREE.MeshStandardMaterial({ color: 0xc81e2a, roughness: 0.35 });
  const cire = new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.6 });
  const flamme = new THREE.MeshBasicMaterial({ color: 0xffc040 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.7, roughness: 0.3 }));
  g.add(plat);
  let y = 0.015;
  for (const [r, h] of [[0.28, 0.12], [0.2, 0.1], [0.13, 0.09]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), [creme, creme, creme]); t.position.y = y + h / 2; g.add(t);
    const bande = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.004, r + 0.004, h * 0.3, 20, 1, true), biscuit); bande.position.y = y + h * 0.45; g.add(bande);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; const f = new THREE.Mesh(new THREE.SphereGeometry(0.026, 7, 5), fraise); f.position.set(Math.cos(a) * (r - 0.03), y + h + 0.012, Math.sin(a) * (r - 0.03)); g.add(f); }
    y += h;
  }
  for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 5), cire); c.position.set(Math.cos(a) * 0.07, y + 0.035, Math.sin(a) * 0.07); g.add(c);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.011, 5, 4), flamme); fl.scale.y = 1.8; fl.position.set(c.position.x, y + 0.085, c.position.z); g.add(fl); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
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
  eu.visible = true; eu.position.set(E_.eugene[0], getH(E_.eugene[0], E_.eugene[1]), E_.eugene[1]);
  eu.rotation.y = Math.atan2(E_.x - eu.position.x, E_.z - eu.position.z);
  // Émile attend à son moulin, face au bourg d'où arrive Camille
  const em = PARTAGE.emile;
  if (em) { PRO.emileAvant = [em.position.x, em.position.y, em.position.z, em.rotation.y];
    const [x, z] = placeLibre(FERME.x, FERME.z, E_.x - FERME.x, E_.z - FERME.z);
    em.position.set(x, getH(x, z), z); em.rotation.y = Math.atan2(E_.x - x, E_.z - z); }
  const cx = E_.x + Math.sin(E_.yaw) * 2.2, cz = E_.z + Math.cos(E_.yaw) * 2.2, cy = player.pos.y;
  const vx = E_.x - Math.sin(E_.yaw) * 5, vz = E_.z - Math.cos(E_.yaw) * 5;
  G.fade = 1; G.fadeTarget = 1; document.getElementById('fade').style.opacity = 1;
  cutscene([
    { cam: [vx + 30, cy + 26, vz + 30], at: [E_.x, cy + 4, E_.z], cam2: [vx + 8, cy + 7, vz + 8], at2: [E_.x, cy + 2, E_.z], dur: 6, fade: 0, title: 'THE LEGEND OF CAMILLE', sub: 'Prologue — Le gâteau de Lydéric', skippable: false },
    { cam: [vx, cy + 3.2, vz], at: E_.enseigne, cam2: [vx + 0.6, cy + 2.2, vz + 0.6], at2: [cx, cy + 1.3, cz], dur: 6, text: 'Au bourg, à l’école de cuisine Lequeuche, Camille et son ami Eugène préparent une surprise.' },
    { say: '« Chut ! Demain, c’est l’anniversaire de Lydéric, et il ne se doute de rien. Un gâteau pour un géant, ça demande de la farine… »', who: 'Eugène' },
    { say: '« …et le sac est vide ! Cours au moulin d’Émile, de l’autre côté des champs. Je te l’ai marqué d’un point d’or, sur la carte en haut à droite. »', who: 'Eugène' },
  ], () => {
    PRO.etape = 'moulin'; PARTAGE.repere = { x: FERME.x, z: FERME.z };
    player.yaw = G.camYaw = Math.atan2(FERME.x - player.pos.x, FERME.z - player.pos.z);   // dos à l'école, face au chemin
    showMessage('Suis le point d’or de la carte jusqu’au moulin d’Émile. Les touches sont rappelées à droite ; Espace pour sauter.', 7);
  });
}

// l'avancement du prologue, appelé par update() tant qu'il dure
function suivrePrologue() {
  const p = player, em = PARTAGE.emile;
  if (cut.active) return;
  if (PRO.etape === 'moulin' && em && Math.hypot(em.position.x - p.pos.x, em.position.z - p.pos.z) < 5) {
    PRO.etape = 'fauche-dialogue'; em.rotation.y = Math.atan2(p.pos.x - em.position.x, p.pos.z - em.position.z);
    const ch = FAUCHE_DEBUG.CHAMPS_BLE[0];
    // par-dessus l'épaule de Camille, Émile de face
    const dx = em.position.x - p.pos.x, dz = em.position.z - p.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const y = p.pos.y, cam = [p.pos.x - ux * 2.6 + uz * 1.2, y + 2.1, p.pos.z - uz * 2.6 - ux * 1.2], at = [em.position.x, em.position.y + 1.4, em.position.z];
    cutscene([
      { who: 'Émile', say: '« Camille ! De la farine, pour un gâteau ? Mon grenier est vide depuis hier… »', cam, at },
      { who: 'Émile', say: '« Fauche-moi une belle gerbe de blé, dans mon champ, et je te la mouds tout de suite. »' },
      { who: 'Émile', say: '« Tiens, prends la vieille épée de mon grand-père, un soldat de Vauban : elle coupe encore très bien le blé. »', fn: () => { state.sword = true; SFX.pickup(); } },
    ], () => {
      PRO.etape = 'fauche'; PRO.bleDepart = bleFauche;
      PARTAGE.repere = ch ? { x: ch.cx, z: ch.cz } : null;
      showMessage('Clic gauche (ou F) pour frapper : fauche le blé du champ d’Émile.', 6);
    });
  } else if (PRO.etape === 'fauche' && bleFauche - PRO.bleDepart >= GERBE) {
    PRO.etape = 'fin'; PARTAGE.repere = null;
    dialogue([
      { who: 'Émile', text: '« Voilà une belle gerbe ! Donne, je la passe sous la meule… »' },
      { who: 'Émile', text: '« …et voici ta farine. Bon anniversaire à Lydéric, et garde l’épée : on ne sait jamais, avec ce Phinaert qui rôde. »' },
    ], () => introScene(true));
  }
}

// ---------- situation initiale : la cinématique d'introduction ----------
// gateau : on vient du prologue. Au pont, Camille et Eugène tendent le gâteau à Lydéric
// quand Phinaert surgit ; sans prologue, Eugène vient saluer Camille, comme avant.
export function introScene(gateau = false) {
  const bz = PONT_Z1 + 6; // pied du pont, côté plaine (et non 33 m après la porte : le pont fait 206 m)
  const villain = geant('phinaert', 0x7a1f1f, 0x333333, 'club'); villain.position.set(0, 0, APO - 12); villain.rotation.y = 0; villain.userData.dynamic = true; villain.visible = false; scene.add(villain);
  PARTAGE.prince.visible = true; PARTAGE.prince.position.set(2.5, 0, bz); PARTAGE.prince.rotation.y = -1.9;
  player.pos.set(-0.5, 0, bz + 1.5); player.yaw = 2.0; G.camYaw = Math.PI;
  const lyd = PARTAGE.lyderic;
  if (gateau) {
    // Lydéric tout près, face à eux ; le gâteau dans les mains de Camille (update le porte)
    lyd.position.set(-6.5, 0, bz + 4.5); lyd.rotation.y = Math.atan2(-0.5 - -6.5, bz + 1.5 - (bz + 4.5));
    player.yaw = Math.atan2(-6.5 - -0.5, bz + 4.5 - (bz + 1.5)); G.camYaw = player.yaw;
    PARTAGE.prince.position.set(-1.2, 0, bz + 0.1); PARTAGE.prince.rotation.y = player.yaw;   // côte à côte, face au géant
    PRO.gateau = faireGateau(); scene.add(PRO.gateau);
  } else { lyd.position.set(-30, 0, APO + 50); lyd.rotation.y = 1.2; }
  G.fade = 1; G.fadeTarget = 1; document.getElementById('fade').style.opacity = 1;
  const ouverture = gateau ? [
    // Lydéric mesure 7,5 m : les plans le prennent en entier, ou en contre-plongée
    { cam: [9, 6, bz + 14], at: [-3.5, 3.5, bz + 2.5], cam2: [6, 4.5, bz + 11], at2: [-3.5, 3.2, bz + 2.5], dur: 5, fade: 0, text: 'Le lendemain, au pied du pont. Lydéric regarde passer les nuages : il ne se doute de rien.' },
    { say: '« Joyeux anniversaire, Lydéric ! »', who: 'Eugène', cam: [-4.4, 2, bz + 2.6], at: [-0.85, 1.3, bz + 0.8] },
    { say: '« Pour moi ? Un gâteau… Vous êtes fous, tous les deux ! Personne n’y avait pensé depuis des années. »', who: 'Lydéric', cam: [2.2, 1.6, bz - 0.8], at: [-6.5, 6.2, bz + 4.5] },
    { say: '« Émile a moulu la farine, et c’est moi qui ai fauché le blé ! Tiens, souffle les bougies… »', who: 'Camille', cam: [0.5, 3.4, bz + 11], at: [-3.5, 3.2, bz + 3], fn: () => { PRO.tend = true; } },
  ] : [
    { cam: [90, 70, 140], at: [0, 6, 0], cam2: [40, 34, 96], at2: [0, 8, 10], dur: 7, fade: 0, title: 'THE LEGEND OF CAMILLE', sub: 'La Citadelle de Lille', skippable: false },
    { cam: [40, 34, 96], at: [0, 8, 10], cam2: [14, 12, APO + 46], at2: [0, 4, APO + 20], dur: 6, text: 'La citadelle de Vauban veille sur Lille depuis des siècles. Ses cinq bastions, ses fossés et son donjon n\'ont jamais été pris.' },
    { cam: [6, 2.2, bz + 6], at: [1, 1.6, bz], cam2: [4, 2, bz + 4], at2: [1, 1.5, bz], dur: 5, text: 'Ce matin-là, Eugène est venu saluer son amie Camille, la jeune gardienne de la citadelle, au pied du pont.' },
    { say: "« Camille ! Regarde ce ciel : une journée parfaite pour une promenade sur les remparts. Lydéric nous attend… »", who: 'Eugène', cam: [4, 2, bz + 4], at: [1, 1.5, bz] },
  ];
  // le gâteau tombe avec Camille : il s'écrase au sol, et n'en bougera plus
  const ecraser = () => { const g = PRO.gateau; if (!g) return; PRO.gateau = null; PRO.tend = false;
    g.position.set(-1.6, 0.02, bz + 2.6); g.rotation.set(0.25, 0.4, 0.1); g.scale.set(1.25, 0.35, 1.25);
    burst(-1.6, 0.3, bz + 2.6, 0xf6ead0, 26, 3, 0.7, 4, 1.1); burst(-1.6, 0.3, bz + 2.6, 0xc81e2a, 10, 2.5, 0.6, 4, 1); };
  cutscene([
    ...ouverture,
    { cam: [-8, 3, bz - 6], at: [0, 4, APO + 4], cam2: [-6, 4, bz - 2], at2: [0, 5, APO + 14], dur: 4.5, text: 'Soudain, la terre tremble. La herse de la Porte Royale se lève dans un fracas de chaînes…', shake: 1.2, fn: () => { SFX.roar(); villain.visible = true; }, actor: villain, to: [0, APO + 18], speed: 7 },
    { cam: [-6, 4, bz - 2], at: [0, 5, bz - 30], cam2: [-6, 4.5, bz], at2: [0.5, 5, bz - 12], dur: 4, actor: villain, to: [1, bz - 5], speed: 9, text: 'PHINAERT, le géant brigand, fond sur le pont.', fn: () => { villain.position.set(0.5, 0, bz - 40); G.shake = 0.8; SFX.stomp(); } },
    { say: gateau ? "« Un anniversaire ? Comme c'est touchant. Le cadeau, je le prends… pas le gâteau : le petit ! Eugène vaudra une belle rançon en or. »"
      : "« Eugène, l'ami de la gardienne ! Tu vaudras une rançon en or… Et toi, la gardienne, ôte-toi de mon chemin ! »", who: 'Phinaert', cam: [4, 6, bz + 5], at: [0.5, 5, bz - 4] },
    { cam: [5, 3, bz + 6], at: [0, 1.5, bz], dur: 1.6, shake: 1.5, fn: () => { SFX.stomp(); SFX.hit(); burst(player.pos.x, 1.2, player.pos.z, 0xc8b898, 20, 4, 0.8, 6, 1.2); ecraser(); player.pose = { kind: 'lie', pos: [-2.5, 0.35, bz + 3], yaw: 2.4 }; } },
    { cam: [5, 3, bz + 6], at: [0.5, 2, bz - 2], dur: 2.5, text: gateau ? 'D\'un revers de massue, le géant envoie Camille au sol. Le gâteau s\'écrase dans la poussière.' : 'D\'un revers de massue, le géant envoie Camille au sol et saisit Eugène.', fn: () => { PARTAGE.prince.visible = false; burst(PARTAGE.prince.position.x, 2, PARTAGE.prince.position.z, 0xffd070, 20, 3, 0.8, 3, 1.2); } },
    { cam: [-9, 5, bz - 10], at: [0, 6, APO + 10], cam2: [-9, 6, bz - 14], at2: [0, 6, APO], dur: 5, actor: villain, to: [0, APO - 2], speed: 6, text: 'Phinaert emporte Eugène dans la citadelle, et la herse retombe derrière lui.', fn: () => { setTimeout(() => { SFX.stomp(); G.shake = 1; scene.remove(villain); }, 4200); } },
    { fade: 1, dur: 2, skippable: false },
    ...(gateau ? [
      { cam: [-4, 2.2, bz + 7], at: [-2.5, 0.8, bz + 3], cam2: [-3, 2.5, bz + 6], at2: [-2.5, 1.2, bz + 3], dur: 4, fade: 0, text: 'Le silence retombe sur le pont. Camille rouvre les yeux…' },
      { say: "« Camille ! Tu es vivante ! Viens, viens me parler, vite… »", who: 'Lydéric', cam: [3, 3.4, bz + 13], at: [-4.5, 3.4, bz + 3.5],
        fn: () => { player.pose = null; player.pos.set(-2.5, 0, bz + 3); player.yaw = Math.atan2(-6.5 - -2.5, 1.5); } },
    ] : [
      { cam: [-4, 2.2, bz + 7], at: [-2.5, 0.8, bz + 3], cam2: [-3, 2.5, bz + 6], at2: [-2.5, 1.2, bz + 3], dur: 4, fade: 0, text: 'Le silence retombe sur le pont. Camille rouvre les yeux…', actor: lyd, to: [-9, APO + 38], speed: 4 },
      { cam: [-4, 3, bz + 8], at: [-4, 3, bz - 1], dur: 3, text: 'Lydéric, le bon géant, accourt de la plaine.', fn: () => { player.pose = null; player.pos.set(-2.5, 0, bz + 3); player.yaw = -0.8; } },
      { say: "« Camille ! Tu es vivante ! Viens, viens me parler, vite… »", who: 'Lydéric', cam: [-4, 3, bz + 8], at: [-6, 3, bz + 2] },
    ]),
  ], () => {
    if (gateau) finPrologue();
    if (G.sansSauvegarde) return;                   // rejoué depuis l'accueil : finPrologue a pris la main
    state.introSeen = true; if (!gateau) lyd.position.set(-9, 0, APO + 38); lyd.userData.walkTo = null;
    G.camYaw = Math.atan2(player.pos.x - lyd.position.x, player.pos.z - lyd.position.z) + Math.PI; saveGame(true); showMessage('Va parler à Lydéric (Entrée). Journal : J.', 6);
  });
}

// l'enlèvement est joué : les monstres se réveillent, Émile rentre au bourg
function finPrologue() {
  for (const e of PRO.cages) e.caged = false; PRO.cages = [];
  const em = PARTAGE.emile, a = PRO.emileAvant;
  if (em && a) { em.position.set(a[0], a[1], a[2]); em.rotation.y = a[3]; }
  PRO.etape = null; PARTAGE.repere = null; state.prologueFait = true;
  if (G.sansSauvegarde) showMenu('FIN DU PROLOGUE', 'Le gâteau de Lydéric', 'Eugène est enlevé. La suite de l’histoire se joue avec ton personnage.', [
    { label: 'Retour à l’accueil', fn: () => { location.href = 'accueil.html'; } },
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
    { cam: [lx + 14, 6, lz + 14], at: [lx + 3, 3, lz], cam2: [lx + 30, 22, lz + 40], at2: [0, 10, APO], dur: 7, text: 'La herse de la Porte Royale se relève. Les corbeaux ont quitté le ciel de la citadelle, et le beffroi sonne à toute volée.', fn: () => { player.pose = { kind: 'cheer' }; let n = 0; const iv = setInterval(() => { burst(lx + rand(-20, 30), rand(12, 26), lz + rand(-30, 10), [0xff5070, 0xffd070, 0x70c0ff, 0x80ff90][n % 4], 30, 7, 1.6, 2, 1.6); SFX.win(); if (++n > 9) clearInterval(iv); }, 650); } },
    { cam: [lx + 30, 22, lz + 40], at: [0, 10, APO], cam2: [90, 70, 140], at2: [0, 6, 0], dur: 8, title: 'FIN', sub: 'Eugène est sauvé', fade: 0 },
  ], () => { player.pose = null; endGame(true); });
}

export function objective() {
  return PRO.etape ? PRO.objectif() : state.princeFreed ? 'Ramène Eugène à Lydéric, près du pont' : !state.metLyderic ? 'Va parler à Lydéric, le géant, près du pont (Entrée)' : state.galleryOpen ? 'Descends dans les galeries par la poterne (est de la place d\'Armes) et délivre Eugène' : state.key ? 'Ouvre la grille de la poterne avec la clé du donjon' : state.bossDead ? 'Monte au sommet du donjon (escalier en colimaçon) chercher la clé' : state.gateOpen ? 'Affronte Phinaert dans l\'enclos du donjon' : (state.bow ? `Vaincs encore ${killsLeft()} monstres (fossés à l'arc, remparts, bastions) pour ouvrir l'enclos du donjon` : `Trouve l'arc (bastion de Turenne, à gauche de la porte) et vaincs ${killsLeft()} monstres`);
}
