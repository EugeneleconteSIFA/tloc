// citadelle.js — la place forte.
//
// Secteur Citadelle : courtines, bastions, Porte Royale, casernes, galeries voûtées,
// donjon, poterne. Le tracé vient de carte.js, jamais l'inverse.
import * as E from './engine.js?v=41';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  THREE, GOLD, IRON, Q, SFX, T, TAU, addBox, addCap, addHelix, addInteract, addLieu, addPlatform,
  addRamp, archWindow, boxG, brickMat, brickScaled, burst, corniceAround, dialogue, distSeg, dormer,
  extrudeMesh, flatMesh, getH, goToLevel, lieux, makeCat, makeChest, makeGrille, makeTorch, mat,
  mergeParts, mesh, mouldingRun, pbr, pbrRepeat, phMat, pickups, pilaster, player, pointInPoly, rand,
  rboxG, saveGame, scene, setQuest, showMessage, sky, spawnGaufre, sphG, state, stoneMat, uvMeters,
  wallBox, world, etape,
  // l'acte I dans la place (ACTE1_CITADELLE, en fin de fichier)
  G, AIDE, KINDS, TOUCHES, animeCreature, arrows, cut, cutscene, damagePlayer, enemies, hitEnemy, lerp,
  makeCorbeau, makeFantome, makeMoule, makePrince, readSave, setAnimHook, setMaker, shockwaves, spawnEnemy,
} from './engine.js?v=41';
import * as PNJ from './pnj.js';
import * as BOURSE from './bourse.js';
import {
  APO, BAST_H, COBBLE_M, COS36, COURTINES, DONJON, FOSSE_IN, GATE_HW, GATE_I, HOUSE, MARCHE_R,
  FERME, MOAT_IN, MOAT_OUT, PLAINE_R, PONT_LONG, PONT_Z1, POTERNE, R, TOWN, TRACE, WALL_H, WALL_T, bastionAt, bastions, eauMat, placerRampes, townWorld,
  cobbles, cuireRelief, maillagePlaine, nearHouse, normale, normals, offsetPoly, patinerMat,
  disqueTrace, pentShape, placerButtes, polyShape, sdPent, solPlaine, tapisForestier, nappeProche, LILLE,
  EAU_Y, sdEau,
} from './carte.js';
import { makeDoor } from './menuiserie.js';
import { carteForet } from './foret.js';
import { PARTAGE, atteintActe1, etapeActe1, passerActe1 } from './etat.js';
import { buildHouse, buildMaisonMage, buildCountryside } from './campagne.js';
import { buildTown } from './village.js';
import { buildMountains, buildNature, buildVegetation, flowerTexture, perf } from './nature.js';

// La construction rend la main au navigateur entre ses grandes phases : c'est ce qui
// permet à la barre de chargement d'avancer au lieu d'un rouet qui tourne dans le vide.
// Rampes d'accès aux bastions. Elles faisaient toute la largeur de la gorge — un talus
// de 46 m de large pour la Reine — et les casernes relevées étaient posées dessus : on ne
// pouvait monter sur aucun des cinq bastions. carte.js choisit maintenant, pour chaque
// gorge, le couloir de neuf mètres le moins encombré ; on y pose le tablier de terre et
// ses deux murs de soutènement.
// La gorge d'un bastion est la ligne de courtine elle-même : arrivé en haut de la rampe,
// on bute sur onze mètres de maçonnerie. On y perce donc ce que le vrai ouvrage a — un
// passage au niveau du terre-plein. On ne SUPPRIME pas la capsule de courtine (on
// traverserait le rempart au ras du sol) : on la coupe en trois, et le tronçon du milieu
// voit son plafond abaissé à la hauteur du bastion. En bas c'est un mur ; à trois mètres,
// c'est une porte.
function percerCouloir(b) {
  const dem = b.demiRampe;
  const axe = (t) => [b.V[0] + b.u[0] * 0 + b.v[0] * t, b.V[1] + b.u[1] * 0 + b.v[1] * t];
  const bilan = { courtines: 0, gardeCorps: 0, restent: 0 };
  // tout le couloir, du pied de la rampe au terre-plein
  const stations = [];
  for (let sv = b.sShoulder - b.rampLen - 2; sv <= b.sShoulder + WALL_T / 2 + 2; sv += 2) {
    stations.push([b.V[0] + b.u[0] * sv + b.v[0] * b.tRampe, b.V[1] + b.u[1] * sv + b.v[1] * b.tRampe]);
  }
  for (const c of world.capsules.slice()) {
    if (c.r <= 0 || c.top <= 0.35) continue;
    const dx = c.bx - c.ax, dz = c.bz - c.az, L = Math.hypot(dx, dz);
    // un poteau isolé sur le couloir : on le retire, ce n'est pas un ouvrage
    if (L < 1) {
      if (c.r > 0.7) continue;                      // un point isolé de 70 cm : un tonneau, une borne
      for (const P of stations) if (Math.hypot(P[0] - c.ax, P[1] - c.az) < c.r + dem) { c.r = 0; bilan.gardeCorps++; break; }
      continue;
    }
    // point du couloir le plus proche de la capsule
    let u = -1, best = Infinity, PB = null;
    for (const P of stations) {
      const uu = Math.max(0, Math.min(1, ((P[0] - c.ax) * dx + (P[1] - c.az) * dz) / (L * L)));
      const d = Math.hypot(P[0] - (c.ax + dx * uu), P[1] - (c.az + dz * uu));
      if (d < best) { best = d; u = uu; PB = P; }
    }
    if (best > c.r + dem) continue;
    if (c.r > 0.4 && c.r < 3) { bilan.restent++; continue; }     // mur de caserne : on n'y touche pas
    const g = (dem + c.r + 0.6) / L;
    const u0 = Math.max(0, u - g), u1 = Math.min(1, u + g);
    const A = [c.ax + dx * u0, c.az + dz * u0], B = [c.ax + dx * u1, c.az + dz * u1];
    const bx = c.bx, bz = c.bz, top = c.top, rayon = c.r;
    c.bx = A[0]; c.bz = A[1];
    // un tronçon restant de moins d'un mètre disparaît : quand la rampe touche le BOUT de la
    // courtine (Dauphin), il restait un segment de longueur nulle mais de 5,5 m de rayon —
    // un disque invisible de onze mètres en haut de la rampe (30 septembre)
    if (u0 * L < 1) c.r = 0;
    if ((1 - u1) * L >= 1) addCap(B[0], B[1], bx, bz, rayon, top);
    if (rayon >= 3) {
      // COURTINE : la gorge du bastion EST la ligne de courtine, et la courtine fait onze
      // mètres d'épaisseur. La rampe monte donc DANS le mur, comme dans le vrai ouvrage
      // où elle débouche sur le terre-plein. On efface le tronçon sur la largeur de la
      // rampe. Rien ne s'ouvre vers le fossé pour autant : derrière, c'est le terre-plein
      // du bastion, trois mètres de terre pleine.
      // (Un plafond à BAST_H ne suffisait pas : la rampe traverse les cinq derniers
      // mètres du mur à 2,4 m de haut, sous le plafond, donc toujours bloquée.)
      addCap(A[0], A[1], B[0], B[1], rayon, 0.35);
      bilan.courtines++;
    } else {
      // garde-corps, palissade, chaîne : une brèche franche, comme une entrée de rampe
      bilan.gardeCorps++;
    }
  }
  return bilan;
}

export function choisirRampes() {
  // Les remparts sont là, les casernes pas encore : le couloir se choisit contre la
  // maçonnerie seule, puis les casernes lui cèdent le passage.
  // On compte les emprises relevées comme des obstacles DÈS LE CHOIX du couloir : la
  // rampe va se glisser entre les casernes, et il ne restera à écarter que celles qu'on
  // ne peut vraiment pas contourner.
  placerRampes((x, z, y) => (E.blocked(x, z, 0.5, false, y) ? 2
    : CASERNES.some((k) => pointInPoly(x, z, k.poly)) ? 1 : 0));
}

// La rampe et son palier se lisent comme un morceau du bastion : brique des bastions pour
// tout ce qui est maçonnerie (murs de soutènement, flancs du palier), et, dessus, le sol de
// la cour qui monte jusqu'au terre-plein. Avant, les murs prenaient la pierre des corniches
// étalée à 4 m (wallBox reconstruit le matériau sans sa teinte : un blanc cru), et le palier
// était un massif de terre claire sur ses six faces — un bloc sable qui dépassait de la
// courtine, vu de la cour (retour d'Eugène, les cinq bastions).
const BRIQUE_BASTION = (l, h) => patinerMat(phMat('church_bricks_03', l, h), { echelle: 34, force: 0.34, basY: -1.8, humide: 2.2 });
const SOL_RAMPE = (l, h) => phMat('rocks_ground_08', l, h, { color: 0xeadcbc });   // le sable tassé de la cour (cf. buildCitadel)

function poserRampes() {
  let perces = 0, gardes = 0, restent = 0;
  for (const b of bastions) {
    const bl = percerCouloir(b);
    perces += bl.courtines; gardes += bl.gardeCorps; restent += bl.restent;
    const rl = b.rampLen, hyp = Math.hypot(rl, BAST_H), W = b.demiRampe * 2;
    const sMid = b.sShoulder - rl / 2;
    const cx = b.V[0] + b.u[0] * sMid + b.v[0] * b.tRampe;
    const cz = b.V[1] + b.u[1] * sMid + b.v[1] * b.tRampe;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, hyp), SOL_RAMPE(W, hyp));
    ramp.position.set(cx, BAST_H / 2 - 0.25, cz);
    ramp.rotation.y = -Math.atan2(b.u[1], b.u[0]) + Math.PI / 2;
    ramp.rotation.x = -Math.atan2(BAST_H, rl);
    ramp.rotation.order = 'YXZ';
    ramp.receiveShadow = true; ramp.castShadow = true; scene.add(ramp);
    // murs de soutènement : sans eux la rampe est une planche posée sur l'herbe
    for (const sg of [-1, 1]) {
      const t = b.tRampe + sg * (b.demiRampe + 0.75);
      const a = [b.V[0] + b.u[0] * (b.sShoulder - rl) + b.v[0] * t, b.V[1] + b.u[1] * (b.sShoulder - rl) + b.v[1] * t];
      const q = [b.V[0] + b.u[0] * b.sShoulder + b.v[0] * t, b.V[1] + b.u[1] * b.sShoulder + b.v[1] * t];
      wallBox(a[0], a[1], q[0], q[1], BAST_H + 0.2, 0.5, stoneMat, -1.4, 'church_bricks_03');
      // un chaperon de pierre claire : il termine le mur comme le cordon termine la courtine
      wallBox(a[0], a[1], q[0], q[1], 0.16, 0.66, stoneMat, BAST_H - 1.2, T.stone);
      addCap(a[0], a[1], q[0], q[1], 0.3, BAST_H + 0.2);
    }
    // LE PALIER. La gorge du bastion est oblique à la rampe, et la rampe finissait d'équerre :
    // deux coins restaient ouverts entre son extrémité et le bord du bastion, par où l'on
    // voyait le vide (« l'espace transparent »). Le sol marchable, lui, continue à plat
    // sur WALL_T / 2 + 8 m (levelH, carte.js) — on le dessine : un massif plein, du pied
    // jusqu'au niveau du terre-plein, un peu plus large que la rampe et ses murs. Son
    // dessus est un centimètre sous le dallage du bastion : là où ils se recouvrent, c'est
    // le dallage qu'on voit ; dans les coins, c'est le palier. Aucune collision : on ne
    // bute sur rien en passant de la rampe au bastion.
    // Sa longueur se MESURE : jusqu'où le couloir entre tout entier dans le bastion. Posé
    // sur 13,5 m partout, il débordait du bastion là où la gorge est courte, et le sol
    // marchable avec lui — un rebord invisible au-dessus du vide. carte.js lit b.sPalier.
    {
      const Wp = W + 2 * (0.75 + 0.3), bas = -1.8;
      const P = (s, t) => [b.V[0] + b.u[0] * s + b.v[0] * t, b.V[1] + b.u[1] * s + b.v[1] * t];
      let sFin = b.sShoulder;
      for (let s = b.sShoulder; s <= b.sShoulder + WALL_T / 2 + 8; s += 0.25) {
        sFin = s;
        if ([-Wp / 2, 0, Wp / 2].every((dt) => bastionAt(...P(s, b.tRampe + dt)))) break;
      }
      b.sPalier = sFin + 0.5;
      const Lp = b.sPalier - b.sShoulder + 0.3, sP = b.sShoulder - 0.3 + Lp / 2;
      // faces d'une BoxGeometry : +x, −x, +y, −y, +z, −z. Les flancs sont de la maçonnerie
      // (chacun à l'échelle de sa taille réelle), le dessus est le sol de la rampe.
      const Hp = BAST_H - 0.01 - bas, flancLong = BRIQUE_BASTION(Lp + 0.6, Hp), flancCourt = BRIQUE_BASTION(Wp, Hp), dessus = SOL_RAMPE(Wp, Lp + 0.6);
      const pal = new THREE.Mesh(new THREE.BoxGeometry(Wp, Hp, Lp + 0.6), [flancLong, flancLong, dessus, dessus, flancCourt, flancCourt]);
      pal.position.set(b.V[0] + b.u[0] * sP + b.v[0] * b.tRampe, (BAST_H - 0.01 + bas) / 2, b.V[1] + b.u[1] * sP + b.v[1] * b.tRampe);
      pal.rotation.y = -Math.atan2(b.u[1], b.u[0]) + Math.PI / 2;
      pal.receiveShadow = true; scene.add(pal);
    }
  }
  console.log('accès aux bastions : %d courtines percées au niveau du terre-plein, %d garde-corps ouverts, %d murs de caserne laissés en place',
    perces, gardes, restent);
}

export async function buildCitadel() {
  // le champ de hauteur d'abord : tout le reste s'y pose
  await etape('relief');
  placerButtes();
  cuireRelief();
  // sols
  // LE FOSSÉ N'EST PLUS CONSTRUIT ICI. Il l'était comme un anneau à distance constante du
  // pentagone — une forme inventée, un plan d'eau miroir, une grève en liseré net — et il
  // obligeait carte.js à écarter l'eau relevée de la même zone pour éviter le
  // recouvrement. Résultat : la Deûle s'arrêtait au glacis au lieu d'alimenter le fossé.
  // Désormais le sol descend jusqu'au pied de l'escarpe, `creuxEau` y creuse le fossé
  // relevé exactement comme il creuse la Deûle, et `nappesLille()` pose l'eau. Une seule
  // géométrie d'eau dans tout le jeu, une seule matière, une seule règle de noyade.
  await etape('sols');
  scene.add(maillagePlaine(-7, PLAINE_R));
  { const t = tapisForestier(); if (t) scene.add(t); }
  PARTAGE.waterMat = eauMat();       // la même eau partout (cf. carte.js)
  T.waterN.repeat.set(40, 40);
  // intérieur de la citadelle : sable tassé jusqu'au pied des remparts, pas d'herbe
  // en éventail depuis le centre, pas en ShapeGeometry : le tracé décalé vers l'intérieur
  // s'auto-intersecte et ce sol débordait par-dessus l'eau du fossé (cf. carte.js)
  // 2048 secteurs et non 288 : à chaque angle rentrant (les flancs des bastions), une corde
  // de 5 m enjambait le coin et le sable débordait à plat hors du mur, au-dessus de la berme
  // du fossé (banc arpenteur). Sous le mètre, la corde colle au tracé ; 1 800 triangles.
  scene.add(disqueTrace(-WALL_T / 2, phMat('rocks_ground_08', 100, 100, { color: 0xeadcbc }), 0.012, 2048));
  solPlaceDArmes();          // esplanade, rue de ronde, axe royal (cf. « La place d'Armes »)

  await etape('remparts');
  // courtines (murs) entre les épaules des bastions
  for (let i = 0; i < bastions.length; i++) {
    const a = bastions[i].S1, b = bastions[(i + 1) % bastions.length].S2;
    if (i === GATE_I) { // courtine de la Porte Royale
      wallBox(a[0], a[1], GATE_HW, APO, WALL_H, WALL_T, brickMat, 0, 'church_bricks_03');
      wallBox(-GATE_HW, APO, b[0], b[1], WALL_H, WALL_T, brickMat, 0, 'church_bricks_03');
      // LE PASSAGE DE LA PORTE ÉTAIT SCELLÉ. Les deux courtines s'arrêtent à ±GATE_HW
      // (5 m), mais leur capsule de collision a le rayon du mur — 5,5 m. Les deux bouts
      // arrondis se rejoignaient donc au milieu de l'ouverture : |x| < 5 était couvert des
      // deux côtés, et on ne pouvait plus entrer. On recule les capsules d'un rayon, et on
      // rebouche les deux piédroits avec des capsules fines, qui laissent le passage libre.
      const JAMB = GATE_HW + WALL_T / 2;                    // 10,5 m : là où la capsule peut s'arrêter
      // Et du côté des bastions, même chose : le bout arrondi dépassait de 5,5 m l'extrémité
      // du mur, sur le sol de la place au pied du bastion du Roy, où rien n'est dessiné
      // (banc murs.mjs, 13 m²). La capsule part donc d'un rayon en deçà de l'épaule.
      const rentre = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [p[0] + (q[0] - p[0]) / L * WALL_T / 2, p[1] + (q[1] - p[1]) / L * WALL_T / 2]; };
      const a2 = rentre(a, [JAMB, APO]), b2 = rentre(b, [-JAMB, APO]);
      addCap(a2[0], a2[1], JAMB, APO, WALL_T / 2, WALL_H + 1.4);
      addCap(-JAMB, APO, b2[0], b2[1], WALL_T / 2, WALL_H + 1.4);
      for (const sx of [-1, 1]) {
        const px = sx * (GATE_HW + 2.6);
        addCap(px, APO - WALL_T / 2 + 0.6, px, APO + WALL_T / 2 - 0.6, 2.4, WALL_H + 1.4);
      }
    } else if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) {
      wallBox(a[0], a[1], b[0], b[1], WALL_H, WALL_T, brickMat, 0, 'church_bricks_03');
      addCap(a[0], a[1], b[0], b[1], WALL_T / 2, WALL_H + 1.4);
    }
    // (deux bastions qui se touchent n'ont pas de courtine entre eux : sa capsule, de longueur
    // nulle mais de 5,5 m de rayon, posait un disque invisible de onze mètres en haut de la
    // rampe du Dauphin — on n'en montait ni n'en descendait, 30 septembre)
    const [nx, nz] = normale(i);
    wallBox(a[0] + nx * 2.2, a[1] + nz * 2.2, b[0] + nx * 2.2, b[1] + nz * 2.2, 1.2, 1.4, stoneMat, WALL_H); // corniche de pierre
    wallBox(a[0], a[1], b[0], b[1], 0.5, WALL_T + 0.6, stoneMat, WALL_H - 0.3); // cordon
  }
  // bastions
  for (const b of bastions) {
    scene.add(extrudeMesh(polyShape(b.poly), BAST_H + 1.8, -1.8, patinerMat(phMat('church_bricks_03', 1, 1), { echelle: 34, force: 0.34, basY: -1.8, humide: 2.2 })));
    const edges = [[b.S1, b.F1], [b.F1, b.C], [b.C, b.F2], [b.F2, b.S2]];
    for (const [p, q] of edges) { wallBox(p[0], p[1], q[0], q[1], 1.3, 1.1, stoneMat, BAST_H); addCap(p[0], p[1], q[0], q[1], 0.55, BAST_H + 1.4); }
    // La rampe n'est plus posée ici : sa position latérale dépend de ce que la place
    // d'Armes portera (casernes relevées, garde-corps), et la place d'Armes n'est pas
    // encore bâtie. Voir poserRampes(), appelé après.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 8), mat(0x4a3a2a));
    pole.position.set(b.C[0] - b.u[0] * 3, BAST_H + 4, b.C[1] - b.u[1] * 3); pole.castShadow = true; scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4, 8, 1), mat(0xc22a2a, { side: THREE.DoubleSide, roughness: 0.7 }));
    flag.position.set(pole.position.x + 1.2, BAST_H + 7.2, pole.position.z); flag.userData.flag = true; flag.castShadow = true; scene.add(flag);
    // canon sur le bastion
    const cannon = new THREE.Group();
    const barrel = mesh(new THREE.CylinderGeometry(0.28, 0.38, 3.2, 12), mat(0x2b2b30, { roughness: 0.45, metalness: 0.8 }), 0, 0.9, 0.6); barrel.rotation.x = Math.PI / 2 - 0.12; cannon.add(barrel);
    for (const sx of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 14), mat(0x5a3a1e), sx * 0.55, 0.55, -0.3); w.rotation.z = Math.PI / 2; cannon.add(w); }
    cannon.add(mesh(boxG(0.9, 0.35, 1.8), mat(0x6b4a2b), 0, 0.75, -0.3));
    cannon.position.set(b.C[0] - b.u[0] * 5.5, BAST_H, b.C[1] - b.u[1] * 5.5); cannon.rotation.y = Math.atan2(b.u[0], b.u[1]); scene.add(cannon);
  }
  // porte Royale : deux tours + linteau + herse
  for (const sx of [-1, 1]) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 13, 18), patinerMat(brickScaled(2 * Math.PI * 2.75, 13), { echelle: 16, humide: 3.0 }));
    tw.position.set(sx * (GATE_HW + 1.5), 6.5, APO); tw.castShadow = true; tw.receiveShadow = true; scene.add(tw);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 4.2, 18), mat(0x3b4a5c, { roughness: 0.6 }));
    roof.position.set(tw.position.x, 15.1, APO); roof.castShadow = true; scene.add(roof);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.95, 0.3, 8, 24), stoneMat); ring.rotation.x = Math.PI / 2;
    ring.position.set(tw.position.x, 12.7, APO); scene.add(ring);
    addCap(tw.position.x, APO, tw.position.x, APO, 2.7, 15.5);
  }
  // ---------- frontispice de la Porte Royale ----------
  // L'ancienne version posait un LINTEAU plat de 16 m en travers de l'ouverture : une poutre,
  // pas une porte de ville. Et son intrados tombait à 7,45 m, sous les 11 m de Phinaert, qui
  // la traversait en cinématique. Remplacé par un arc en plein cintre à claveaux : naissance
  // à 7,5 m, clé à 12,5 m — le géant passe dessous — surmonté d'un attique et d'un fronton.
  {
    const SPR = 7.5, R0 = GATE_HW, ZF = WALL_T / 2 + 0.25;   // naissance, rayon, plan des façades
    const pierre = pbr(T.stone, { roughness: 0.82, color: 0xd6cdba });
    const dore = mat(0xd9b24a, { roughness: 0.32, metalness: 0.65 });
    // voûte en berceau dans l'épaisseur du mur
    const vt = new THREE.CylinderGeometry(R0, R0, WALL_T + 0.4, 26, 1, true, 0, Math.PI)
      .rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, SPR, APO);
    const vm = new THREE.Mesh(vt, patinerMat(phMat('church_bricks_03', 1, 1, { color: 0xb08d78, side: THREE.DoubleSide }), { echelle: 9, force: 0.45, basY: SPR, humide: 4.5, mousse: 0x4a5a3c, pluie: 0.34 }));
    vm.receiveShadow = true; scene.add(vm);
    // piédroits habillés de pierre, alignés sur le bord de l'ouverture
    for (const sx of [-1, 1]) scene.add(mesh(boxG(0.5, SPR, WALL_T + 0.5), pierre, sx * (R0 + 0.22), SPR / 2, APO));
    for (const sz of [-1, 1]) {
      // pilastres à refends sur les deux faces
      for (const sx of [-1, 1]) scene.add(mesh(boxG(1.5, SPR + 0.6, 0.7), pierre, sx * (R0 + 0.9), (SPR + 0.6) / 2, APO + sz * ZF));
      for (const sx2 of [-1, 1]) scene.add(mesh(boxG(4.2, 0.55, 1.0), pierre, sx2 * (R0 + 2.1), SPR + 0.3, APO + sz * ZF)); // sommiers, sur les piédroits seulement
    }
    // claveaux de l'archivolte, sur les deux faces, avec clé à mascaron
    for (const sz of [-1, 1]) {
      const NV = 17, zf = APO + sz * (ZF + 0.18);
      for (let k = 0; k < NV; k++) {
        const a = Math.PI * (k + 0.5) / NV, cle = Math.abs(a - Math.PI / 2) < 0.1;
        const wt = Math.PI * (R0 + 0.55) / NV * 0.93;
        const cv = mesh(boxG(wt, cle ? 1.7 : 1.1, 0.7), pierre, 0, 0, 0);
        cv.rotation.z = a - Math.PI / 2;
        const rr = R0 + (cle ? 0.62 : 0.42);
        cv.position.set(Math.cos(a) * rr, SPR + Math.sin(a) * rr, zf); scene.add(cv);
        if (cle) scene.add(mesh(sphG(0.42, 10), pierre, 0, SPR + rr + 0.1, zf + 0.25));           // mascaron
      }
    }
    // herse relevée, dans sa rainure — celle dont parle la cinématique. Elle est MOBILE depuis
    // le 29 septembre : en multijoueur, quand la partie se resserre sur la citadelle, elle
    // retombe et ferme le pont (tloc-multi.js). `poser(f)` : 0 relevée, 1 baissée ; sa
    // collision ne vaut que baissée.
    { const hz = APO - WALL_T / 2 + 0.9, iron = IRON();
      for (const sx of [-1, 1]) scene.add(mesh(boxG(0.55, SPR + R0, 0.4), pierre, sx * (R0 - 0.1), (SPR + R0) / 2, hz));
      // un seul maillage : mobile, elle échappe à la fusion des décors, et ses 25 pièces
      // auraient coûté 25 appels de dessin (et autant dans l'ombre)
      const pieces = [];
      for (let k = 0; k < 11; k++) {
        const x = -R0 + 0.55 + k * (R0 * 2 - 1.1) / 10;
        pieces.push(new THREE.CylinderGeometry(0.14, 0.14, 6.0, 7).translate(x, 14.3, hz));
        pieces.push(new THREE.ConeGeometry(0.2, 0.55, 6).rotateZ(Math.PI).translate(x, 11.0, hz));
      }
      for (const y of [11.9, 14.3, 16.9]) pieces.push(boxG(R0 * 2 - 0.8, 0.3, 0.3).clone().translate(0, y, hz));
      const herse = new THREE.Mesh(mergeGeometries(pieces.map((g) => (g.index ? g.toNonIndexed() : g))), iron);
      herse.castShadow = true; herse.userData.dynamic = true;
      scene.add(herse);
      const cap = addCap(-R0, hz, R0, hz, 0);
      herse.userData.f = 0;
      // baissée, les pointes touchent le sol : 10,7 m de course
      herse.userData.poser = (f) => { herse.userData.f = f; herse.position.y = -10.7 * f; cap.r = f > 0.85 ? 0.35 : 0; };
      PARTAGE.herse = herse; }
    // attique, corniches et fronton triangulaire
    const AT0 = SPR + R0 + 0.9, AT1 = AT0 + 2.6;
    scene.add(mesh(boxG(GATE_HW * 2 + 5.8, 0.6, WALL_T + 1.3), pierre, 0, AT0 - 0.3, APO));
    scene.add(mesh(boxG(GATE_HW * 2 + 4.6, AT1 - AT0, WALL_T + 0.9), pierre, 0, (AT0 + AT1) / 2, APO));
    scene.add(mesh(boxG(GATE_HW * 2 + 6.2, 0.7, WALL_T + 1.6), pierre, 0, AT1 + 0.35, APO));
    for (const sz of [-1, 1]) {                                   // cartouche armorié sur l'attique
      scene.add(mesh(rboxG(3.4, 1.9, 0.45, 0.25, 3), pierre, 0, (AT0 + AT1) / 2, APO + sz * (WALL_T / 2 + 0.5)));
      scene.add(mesh(new THREE.TorusGeometry(0.75, 0.13, 8, 20), dore, 0, (AT0 + AT1) / 2, APO + sz * (WALL_T / 2 + 0.72)));
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8;        // soleil doré
        scene.add(mesh(boxG(0.14, 0.7, 0.1), dore, Math.sin(a) * 1.15, (AT0 + AT1) / 2 + Math.cos(a) * 1.15, APO + sz * (WALL_T / 2 + 0.7)).rotateZ(-a)); }
    }
    { const tri = new THREE.Shape(); tri.moveTo(-(GATE_HW + 2.4), 0); tri.lineTo(GATE_HW + 2.4, 0); tri.lineTo(0, 2.8); tri.closePath();
      const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: WALL_T + 0.7, bevelEnabled: false }), pierre);
      fr.position.set(0, AT1 + 0.7, APO - (WALL_T + 0.7) / 2); fr.castShadow = true; scene.add(fr);
      for (const sx of [-1, 0, 1]) scene.add(mesh(sphG(0.42, 10), dore, sx * (GATE_HW + 2.2), AT1 + 0.7 + (sx ? 0.4 : 3.3), APO)); }
  }
  // pont de bois sur les fossés
  await etape('porte et pont');
  const bridgeLen = PONT_LONG;   // mesuré sur l'axe par carte.js, pas déduit de MOAT_OUT
  // tablier de planches et garde-corps de chêne photographiés (c'était l'écorce peinte du moteur,
  // et des poteaux en aplat : le premier pas hors de la citadelle se faisait sur un décor de jouet)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, bridgeLen), phMat('wood_planks', 8, bridgeLen, { color: 0xd8b890 }));
  const chenePont = phMat('wood_cabinet_worn_long', 0.4, 1.4, { color: 0xa88060 });
  bridge.position.set(0, 0, APO + WALL_T / 2 + bridgeLen / 2 - 1); bridge.receiveShadow = true; bridge.castShadow = true; scene.add(bridge);
  for (const sx of [-1, 1]) {
    for (let k = 0; k <= 6; k++) { const post = mesh(boxG(0.3, 1.3, 0.3), chenePont, sx * 3.8, 0.85, APO + 2.5 + k * (bridgeLen - 2) / 6); scene.add(post); }
    const rail = mesh(boxG(0.18, 0.18, bridgeLen), phMat('wood_cabinet_worn_long', 0.2, bridgeLen, { color: 0xa88060 }), sx * 3.8, 1.4, bridge.position.z); scene.add(rail);
    addCap(sx * 3.8, APO + 2, sx * 3.8, PONT_Z1, 0.3);
  }
  // piliers du pont dans l'eau
  for (let k = 1; k < 4; k++) for (const sx of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 8), phMat('wood_cabinet_worn_long', 2.8, 3, { color: 0x806048 }), sx * 3, -1.2, APO + 6 + k * 6); scene.add(p); }
  choisirRampes();                    // où monter sur chaque bastion : avant de bâtir
  await etape('casernes');            buildCasernes();      // les 38 emprises relevées
  await etape("place d'Armes");       buildPlaceDArmes();   // pavage, puits, corps de garde
  await etape('nature');              buildNature();        // le relief d'abord
  await etape('végétation');          buildVegetation();
  await etape('galeries');            buildGalleries();
  await etape('donjon et poterne');   buildDonjon(); buildPoterne();
  await etape('maisons');             buildHouse(); buildMaisonMage();
  await etape('détails');             buildJumpStuff(); buildDetails();
  poserRampes();                      // la place d'Armes est bâtie : on sait où passer
  await etape('village');             buildTown();
  await etape('campagne');            buildCountryside();
  await etape('horizon');             buildMountains();
  // ---------- lieux de la carte : elle se revele a mesure qu'on explore (v28) ----------
  // La chapelle et la chaumiere du mage s'enregistrent dans leur propre fonction.
  E.addLieu({ id: 'donjon', nom: 'le donjon', x: DONJON.x, z: DONJON.z, r: 30 });
  E.addLieu({ id: 'poterne', nom: 'la poterne', x: (POTERNE_JEU || POTERNE).x, z: (POTERNE_JEU || POTERNE).z, r: 16 });
  E.addLieu({ id: 'maison', nom: 'la maison de Camille', x: HOUSE.x, z: HOUSE.z, r: 22 });
  E.addLieu({ id: 'village', nom: 'le village', x: TOWN.x, z: TOWN.z, r: 46 });
  { const [ex, ez] = townWorld(-11, -4.8); E.addLieu({ id: 'estaminet', nom: "l'estaminet", x: ex, z: ez, r: 13 }); }
  E.addLieu({ id: 'moulin', nom: "le moulin d'\u00c9mile", x: FERME.x, z: FERME.z, r: 24 });
  // oiseaux qui tournent dans le ciel (ambiance)
  for (let i = 0; i < 5; i++) { const bd = new THREE.Group(); const w1 = mesh(boxG(1.4, 0.05, 0.4), mat(0x1a1a22), -0.7, 0, 0), w2 = mesh(boxG(1.4, 0.05, 0.4), mat(0x1a1a22), 0.7, 0, 0); bd.add(w1, w2, mesh(sphG(0.2, 6), mat(0x1a1a22), 0, 0, 0)); bd.userData = { dynamic: true, w1, w2, a: rand(0, TAU), r: rand(30, 70), h: rand(30, 50), spd: rand(0.12, 0.25), cx: rand(-40, 40), cz: rand(-20, 60) }; scene.add(bd); PARTAGE.skyBirds.push(bd); }
}

// ---------- végétation et rochers (instanciés) ----------

export function buildDonjon() {
  const D = DONJON, cx = D.x, cz = D.z, h = D.half, H = D.h, WT = 1.2;
  // tour creuse : 4 murs épais, porte au sud
  const wm = h - WT / 2; // ligne médiane des murs
  const wallSegs = [[cx - h, cz - wm, cx + h, cz - wm], [cx - wm, cz - h, cx - wm, cz + h], [cx + wm, cz - h, cx + wm, cz + h], [cx - h, cz + wm, cx - 2.3, cz + wm], [cx + 2.3, cz + wm, cx + h, cz + wm]];
  for (const w of wallSegs) { wallBox(w[0], w[1], w[2], w[3], H, WT, brickMat, 0, 'church_bricks_03'); addCap(w[0], w[1], w[2], w[3], WT / 2, H - 0.5); }
  // encadrement de porte + porte ouverte
  const doorZ = cz + h;
  scene.add(mesh(boxG(5.2, 0.5, 1.6), stoneMat, cx, 4.2, doorZ - 0.6));
  for (const sx of [-1, 1]) scene.add(mesh(boxG(0.4, 4.2, 1.6), stoneMat, cx + sx * 2.5, 2.1, doorZ - 0.6));
  { const dp = makeDoor(2.2, 3.9, { rustique: true, imposte: false, recess: 0.28, ouvert: -1.35, pierre: stoneMat });
    dp.position.set(cx, 0, doorZ - 1.25); scene.add(dp); }
  // sol intérieur, sommet (plancher percé du puits d'escalier), parapet, tourelles d'angle
  const floorIn = new THREE.Mesh(new THREE.BoxGeometry(h * 2, 0.1, h * 2), pbrRepeat(T.stone, 4, 4, { color: 0x9a9088 })); floorIn.position.set(cx, 0.05, cz); floorIn.receiveShadow = true; scene.add(floorIn);
  const HOLE = 3.9, R0 = 1.0, R1 = 3.6, TURNS = 4, STEPS = 22;
  const topShape = new THREE.Shape(); topShape.moveTo(-h, -h); topShape.lineTo(h, -h); topShape.lineTo(h, h); topShape.lineTo(-h, h); topShape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, HOLE, 0, TAU, true); topShape.holes.push(hole);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(topShape, { depth: 0.5, bevelEnabled: false }), pbrRepeat(T.stone, 0.4, 0.4, { color: 0xa8a098 }));
  top.rotation.x = -Math.PI / 2; top.position.set(cx, H - 0.5, cz); top.castShadow = top.receiveShadow = true; scene.add(top);
  addPlatform(cx - h, cx - HOLE, cz - h, cz + h, H); addPlatform(cx + HOLE, cx + h, cz - h, cz + h, H); addPlatform(cx - HOLE, cx + HOLE, cz - h, cz - HOLE, H); addPlatform(cx - HOLE, cx + HOLE, cz + HOLE, cz + h, H);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE + 0.15, 0.18, 8, 32), IRON()); rim.rotation.x = Math.PI / 2; rim.position.set(cx, H + 0.15, cz); scene.add(rim);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, dx = Math.cos(a), dz = Math.sin(a);
    const p1 = [cx + dx * h - dz * h, cz + dz * h + dx * h], p2 = [cx + dx * h + dz * h, cz + dz * h - dx * h];
    wallBox(p1[0], p1[1], p2[0], p2[1], 1.0, 0.6, stoneMat, H);
    const c = addCap(p1[0], p1[1], p2[0], p2[1], 0.4, Infinity); c.bottom = H - 1;
    for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6; const m = mesh(boxG(0.9, 0.8, 0.6), stoneMat, p1[0] + (p2[0] - p1[0]) * t, H + 1.4, p1[1] + (p2[1] - p1[1]) * t); m.rotation.y = -a; scene.add(m); }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, H + 2, 12), patinerMat(brickScaled(2 * Math.PI * 1.4, H + 2), { echelle: 12, force: 0.36, humide: 3.4 })); tw.position.set(cx + sx * h, H / 2 + 1, cz + sz * h); tw.castShadow = true; scene.add(tw); scene.add(mesh(new THREE.ConeGeometry(1.6, 2.5, 12), mat(0x3b4a5c), cx + sx * h, H + 3.2, cz + sz * h)); addCap(cx + sx * h, cz + sz * h, cx + sx * h, cz + sz * h, 1.4, Infinity);
    // anneaux moulurés des tourelles, corniche sous le toit conique, fleuron
    for (const y of [H / 3, 2 * H / 3]) scene.add(mesh(new THREE.TorusGeometry(1.42, 0.12, 8, 18), stoneMat, cx + sx * h, y, cz + sz * h).rotateX(Math.PI / 2));
    scene.add(mesh(new THREE.CylinderGeometry(1.75, 1.35, 0.5, 12), stoneMat, cx + sx * h, H + 1.85, cz + sz * h)); scene.add(mesh(sphG(0.2, 8), GOLD(), cx + sx * h, H + 4.5, cz + sz * h)); }
  // volume du donjon : talus mouluré à la base, bandeaux à chaque tiers, corniche à mâchicoulis sous le parapet
  { const kg = new THREE.Group(); scene.add(kg);
    for (const w of wallSegs) { const len = Math.hypot(w[2] - w[0], w[3] - w[1]) + (Math.abs(w[3] - w[1]) < 0.01 ? 0.7 : 0); const m = mesh(rboxG(len, 1.0, WT + 0.6, 0.08, 2), stoneMat, (w[0] + w[2]) / 2, 0.5, (w[1] + w[3]) / 2); m.rotation.y = -Math.atan2(w[3] - w[1], w[2] - w[0]); kg.add(m); }
    for (const w of wallSegs) { const mx = (w[0] + w[2]) / 2 - cx, mz = (w[1] + w[3]) / 2 - cz; const nx = Math.abs(mx) > Math.abs(mz) ? Math.sign(mx) : 0, nz = nx ? 0 : Math.sign(mz);
      const corner = (x, z) => Math.max(Math.abs(x - cx), Math.abs(z - cz)) >= h - 0.01 ? 0.3 : 0; const ux = Math.sign(w[2] - w[0]), uz = Math.sign(w[3] - w[1]);
      const ea = corner(w[0], w[1]), eb = corner(w[2], w[3]), off = WT / 2 + 0.3;
      kg.add(mouldingRun(w[0] + nx * off - ux * ea, w[1] + nz * off - uz * ea, w[2] + nx * off + ux * eb, w[3] + nz * off + uz * eb, 1.0, 'cavet', 0.3, 0.3, stoneMat, nx, nz)); }
    for (const y of [H / 3, 2 * H / 3]) corniceAround(kg, cx, y, cz, h, h, stoneMat, 0.28, 0.26, 'torus');
    corniceAround(kg, cx, H - 1.3, cz, h, h, stoneMat, 0.8, 0.55, 'cyma');
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, dx = Math.cos(a), dz = Math.sin(a); for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7 - 0.5; const m = mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.9, 6), stoneMat, cx + dx * (h + 0.35) - dz * t * h * 1.7, H - 1.7, cz + dz * (h + 0.35) + dx * t * h * 1.7); kg.add(m); } } }
  // colimaçon intérieur : colonne centrale + hélice de marches
  const column = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, H, 16), pbrRepeat(T.stone, 3, 6)); column.position.set(cx, H / 2, cz); column.castShadow = true; scene.add(column);
  addCap(cx, cz, cx, cz, R0, Infinity);
  const a0 = Math.PI / 2 + 0.3, hTurn = H / TURNS;
  addHelix(cx, cz, R0, R1 + 0.5, 0, hTurn, TURNS, a0, false); // rayon de collision un peu plus large que les marches : pas de vide entre l'escalier et le bord du puits
  // palier d'arrivée en haut : secteur plein entre la dernière marche et la terrasse (collision rectangulaire + dalle visible)
  addPlatform(cx - 4.2, cx, cz + 0.9, cz + 4.2, H);
  { const pal = new THREE.Mesh(new THREE.RingGeometry(R0, HOLE + 0.1, 24, 1, -(a0 + 1.15), 1.5), pbrRepeat(T.stone, 0.4, 0.4, { color: 0xa8a098, side: THREE.DoubleSide })); pal.rotation.x = -Math.PI / 2; pal.rotation.z = 0; pal.position.set(cx, H - 0.02, cz); pal.receiveShadow = true; scene.add(pal); }
  const stepMat = pbrRepeat(T.stone, 1, 0.5, { color: 0xb0a89c });
  const stepGeo = new THREE.BoxGeometry(R1 - R0 + 0.3, 0.22, 1.05);
  const steps = new THREE.InstancedMesh(stepGeo, stepMat, TURNS * STEPS + 1); steps.castShadow = steps.receiveShadow = true;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();
  for (let k = 0; k <= TURNS * STEPS; k++) {
    const a = a0 + k / STEPS * TAU, hh = k / STEPS * hTurn;
    P.set(cx + Math.cos(a) * (R0 + R1) / 2, hh - 0.11, cz + Math.sin(a) * (R0 + R1) / 2); Q.setFromEuler(E.set(0, -a, 0));
    steps.setMatrixAt(k, M.compose(P, Q, Sc));
  }
  scene.add(steps);
  // garde-corps hélicoïdal (main courante en fer + balustres) le long du bord extérieur des marches, et anneau de collision
  // invisible au rayon R1+0.3 : on ne peut plus tomber de l'escalier ; l'anneau est ouvert au niveau du sol, du côté de la porte, pour y accéder
  { class HelixCurve extends THREE.Curve { constructor(r, y0) { super(); this.r = r; this.y0 = y0; } getPoint(t, o = new THREE.Vector3()) { const a = a0 + t * TAU * TURNS; return o.set(cx + Math.cos(a) * this.r, t * hTurn * TURNS + this.y0, cz + Math.sin(a) * this.r); } }
    scene.add(mesh(new THREE.TubeGeometry(new HelixCurve(R1 + 0.3, 1.05), 220, 0.05, 6, false), IRON(), 0, 0, 0));
    for (let k = 0; k < TURNS * 16; k++) { const a = a0 + k / 16 * TAU, hh = k / 16 * hTurn; scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.05, 5), IRON(), cx + Math.cos(a) * (R1 + 0.3), hh + 0.52, cz + Math.sin(a) * (R1 + 0.3))); }
    const NR = 28; for (let k = 0; k < NR; k++) { const a1 = k / NR * TAU, a2 = (k + 1) / NR * TAU, rr = R1 + 0.32;
      const c = addCap(cx + Math.cos(a1) * rr, cz + Math.sin(a1) * rr, cx + Math.cos(a2) * rr, cz + Math.sin(a2) * rr, 0.12, Infinity);
      const mid = (a1 + a2) / 2, dd = Math.abs(((mid - a0 + Math.PI) % TAU + TAU) % TAU - Math.PI); if (dd < 0.75) { c.bottom = 1.6; c.top = H - 1; } /* ouvert au sol (entrée) et en haut (sortie sur la terrasse), côté porte */ } }
  for (let k = 0; k < 6; k++) { const a = a0 + k / 6 * TAU * 0.98 + 0.4, hh = 2 + k * (H - 3) / 6; const t = makeTorch(); const rr = Math.min(h - WT - 0.25, Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (h - WT - 0.25) / Math.abs(Math.cos(a)) : (h - WT - 0.25) / Math.abs(Math.sin(a)));
    t.position.set(cx + Math.cos(a) * rr, hh, cz + Math.sin(a) * rr); t.userData.light.intensity = 7; t.userData.light.distance = 15; t.userData.light.decay = 1.5; scene.add(t); }
  { const sky = new THREE.PointLight(0xcfe0ff, 10, 26, 1.2); sky.position.set(cx, H - 1.5, cz); scene.add(sky); } // jour qui tombe par le puits de l'escalier
  for (let k = 0; k < 8; k++) { const side = k % 4, lvl = 5 + Math.floor(k / 4) * 8; const a = side * Math.PI / 2; const slit = mesh(boxG(0.4, 1.6, 0.4), new THREE.MeshBasicMaterial({ color: 0xcfe0ff }), cx + Math.cos(a) * h, lvl, cz + Math.sin(a) * h); scene.add(slit); }
  // coffre de la clé au sommet (côté nord, sur le plancher)
  PARTAGE.keyChest = makeChest(); PARTAGE.keyChest.position.set(cx, H, cz - 5); PARTAGE.keyChest.rotation.y = Math.PI; scene.add(PARTAGE.keyChest);
  PARTAGE.keyChest.userData.pos = new THREE.Vector3(cx, H, cz - 5); addCap(cx, cz - 5, cx, cz - 5, 0.9, Infinity).bottom = H - 1;
  for (const [dx, dz] of [[-h + 0.8, -h + 0.8], [h - 0.8, -h + 0.8], [-h + 0.8, h - 0.8], [h - 0.8, h - 0.8]]) { const t = makeTorch(); t.position.set(cx + dx, H + 0.8, cz + dz); t.remove(t.userData.light); scene.add(t); }
  const flagPole = mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), IRON(), cx + h - 0.8, H + 3, cz); scene.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6, 8, 1), mat(0x8a1a1a, { side: THREE.DoubleSide })); flag.position.set(cx + h + 0.5, H + 5.2, cz); flag.userData.flag = true; scene.add(flag);
  // enclos grillagé avec portail au sud
  const F = D.fence, gz = D.gateZ, z0 = cz - F, x0 = cx - F, x1 = cx + F;
  const barGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), barMat = IRON();
  const segs = [[x0, z0, x1, z0], [x0, z0, x0, gz], [x1, z0, x1, gz], [x0, gz, cx - 2.5, gz], [cx + 2.5, gz, x1, gz]];
  let count = 0; for (const sg of segs) count += Math.ceil(Math.hypot(sg[2] - sg[0], sg[3] - sg[1]) / 0.6) + 1;
  const bars = new THREE.InstancedMesh(barGeo, barMat, count); bars.castShadow = true; let bi = 0;
  for (const sg of segs) {
    const n = Math.ceil(Math.hypot(sg[2] - sg[0], sg[3] - sg[1]) / 0.6);
    for (let k = 0; k <= n; k++) { const t = k / n; bars.setMatrixAt(bi++, M.makeTranslation(sg[0] + (sg[2] - sg[0]) * t, 1.3, sg[1] + (sg[3] - sg[1]) * t)); }
    for (const y of [0.4, 2.4]) { const rail = mesh(boxG(Math.hypot(sg[2] - sg[0], sg[3] - sg[1]), 0.1, 0.1), barMat, (sg[0] + sg[2]) / 2, y, (sg[1] + sg[3]) / 2); rail.rotation.y = -Math.atan2(sg[3] - sg[1], sg[2] - sg[0]); scene.add(rail); }
    addCap(sg[0], sg[1], sg[2], sg[3], 0.15, 2.6);
  }
  scene.add(bars);
  for (const sx of [-1, 1]) { scene.add(mesh(boxG(0.6, 3.4, 0.6), stoneMat, cx + sx * 2.8, 1.7, gz)); scene.add(mesh(sphG(0.4, 8), stoneMat, cx + sx * 2.8, 3.6, gz)); }
  // Un PORTAIL sur gonds, pas une herse : levée de 3,3 m, la grille flottait en l'air au-dessus
  // du passage, sans rien pour la tenir (Eugène, 29 septembre : « la porte est ouverte mais le
  // visuel n'est pas cohérent »). Elle pivote sur le poteau ouest et s'ouvre vers l'enclos.
  // `poser(f)` : 0 fermé, 1 ouvert — la quête l'anime, l'instance l'ouvre d'un coup.
  { const pivot = new THREE.Group(), grille = makeGrille(5, 2.8, 8);
    pivot.position.set(cx - 2.5, 0, gz); grille.position.set(2.5, 0, 0); pivot.add(grille); scene.add(pivot);
    pivot.userData = { dynamic: true, open: false, f: 0, cap: addCap(cx - 2.5, gz, cx + 2.5, gz, 0.2, 2.8),
      poser(f) { pivot.userData.f = f; pivot.rotation.y = f * 1.75; } };
    PARTAGE.donjonGate = pivot; }
}
// =====================================================================
//  Outils de plan : polygones relevés, décalage, nappes de toiture
// =====================================================================
// Les emprises de carte/citadelle.json sont des polygones quelconques — rectangles,
// équerres, U autour d'une cour. On ne les redessine pas, on les habille : tout ce qui
// suit mesure, décale ou tend une nappe entre deux contours, et rien n'invente de forme.
// Le décalage en mitre lui-même vient de carte.js (`offsetPoly`), source de vérité.

const AIRE = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const CENTRE = (p) => [p.reduce((t, q) => t + q[0], 0) / p.length, p.reduce((t, q) => t + q[1], 0) / p.length];
const RAYON = (p, c) => Math.max(...p.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])));

// Relevé OSM -> polygone exploitable : fermeture enlevée, sommets confondus et
// micro-arêtes supprimés (une arête de dix centimètres fait diverger la mitre), sens
// trigonométrique imposé pour que la normale d'arête (dz, -dx) sorte toujours.
function nettoyer(pts, minArete = 0.7) {
  const p = [];
  for (const q of pts) if (!p.length || Math.hypot(q[0] - p[p.length - 1][0], q[1] - p[p.length - 1][1]) > minArete) p.push([q[0], q[1]]);
  while (p.length > 3 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < minArete) p.pop();
  if (AIRE(p) < 0) p.reverse();
  return p;
}

// Un décalage rentrant reste sain tant qu'aucune arête ne s'est retournée sur elle-même.
function decalageSain(p, q) {
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    if ((p[j][0] - p[i][0]) * (q[j][0] - q[i][0]) + (p[j][1] - p[i][1]) * (q[j][1] - q[i][1]) < -0.001) return false;
  }
  return true;
}
// Ligne de faîte = le plus grand décalage rentrant encore sain, trouvé par dichotomie.
// Sur un rectangle il vaut exactement la demi-profondeur et le contour du haut dégénère
// en segment : c'est le faîtage d'un toit à quatre pans. Sur une équerre il s'arrête à la
// plus étroite des ailes et laisse un petit faîte plat — une croupe tronquée, ce qui est
// précisément ce qu'on voit sur les casernes du XVIIe.
function faitage(p, max) {
  let lo = 0, hi = Math.max(0.5, max);
  if (decalageSain(p, offsetPoly(p, -hi))) return { o: hi, q: offsetPoly(p, -hi) };
  for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (decalageSain(p, offsetPoly(p, -m))) lo = m; else hi = m; }
  return { o: lo, q: offsetPoly(p, -lo) };
}

const geoDe = (pos, uv, idx) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
// ExtrudeGeometry sort NON indexée : mergeParts, lui, exige un index. On le lui donne.
const indexe = (g) => (g.index ? g : g.setIndex([...Array(g.attributes.position.count).keys()]));

// Nappe tendue entre deux contours de même longueur, UV EN MÈTRES (u = abscisse
// curviligne du bord bas, v = longueur de la pente). phMat(slug, 1, 1) sort alors la
// tuile à sa taille réelle, et la géométrie reste fusionnable. L'ordre des triangles est
// inversé parce que (b-a) x (c-a) pointe toujours vers l'intérieur, pente montante ou
// descendante : une seule règle pour les toitures comme pour les corniches.
function nappe(bas, haut, y0, y1, couvrir) {
  const n = bas.length, pos = [], uv = [], idx = [];
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = bas[i], b = bas[j], c = haut[j], d = haut[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const pente = Math.hypot(Math.hypot(d[0] - a[0], d[1] - a[1]), y1 - y0);
    const o = pos.length / 3;
    pos.push(a[0], y0, a[1], b[0], y0, b[1], c[0], y1, c[1], d[0], y1, d[1]);
    uv.push(u, 0, u + L, 0, u + L, pente, u, pente);
    idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    u += L;
  }
  if (couvrir) {                       // faîte plat ; sur un rectangle les triangles sont nuls
    const o = pos.length / 3;
    for (const q of haut) { pos.push(q[0], y1, q[1]); uv.push(q[0], q[1]); }
    for (let i = 1; i < n - 1; i++) idx.push(o, o + i + 1, o + i);
  }
  return geoDe(pos, uv, idx);
}

const poseMesh = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };

// Pentagone de la place : les cinq lignes de courtine rentrées de d mètres, puis
// intersectées deux à deux. On ne peut pas s'en tirer avec pentShape() : son décalage en
// mitre part en vrille dès une vingtaine de mètres sur un tracé bastionné. Et le corps de
// place relevé est un pentagone quasi régulier d'apothème 120 m dont le centre n'est PAS
// l'origine du jeu mais (4, 52) — il faut donc le calculer, pas le supposer.
export function pentPlace(d) {
  const out = [];
  for (let i = 0; i < COURTINES.length; i++) {
    const A = COURTINES[i], B = COURTINES[(i + 1) % COURTINES.length];
    const c1 = A.a[0] * A.nx + A.a[1] * A.nz - d, c2 = B.a[0] * B.nx + B.a[1] * B.nz - d;
    const det = A.nx * B.nz - B.nx * A.nz;
    if (Math.abs(det) < 1e-6) continue;
    out.push([(c1 * B.nz - c2 * A.nz) / det, (A.nx * c2 - B.nx * c1) / det]);
  }
  return out;
}

// un rectangle rencontre-t-il ce polygone ? (sommets dedans, coins dedans, arêtes croisées)
function croiseRect(p, x0, x1, z0, z1) {
  for (const [x, z] of p) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true;
  const R4 = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (const c of R4) if (pointInPoly(c[0], c[1], p)) return true;
  const croise = (a, b, c, d) => {
    const w = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
    if (Math.abs(w) < 1e-9) return false;
    const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / w;
    const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / w;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  for (let i = 0; i < p.length; i++) for (let k = 0; k < 4; k++)
    if (croise(p[i], p[(i + 1) % p.length], R4[k], R4[(k + 1) % 4])) return true;
  return false;
}

// =====================================================================
//  Les casernes : les 38 emprises relevées
// =====================================================================
// `casernes` de carte/citadelle.json donne les emprises au sol RÉELLES, en mètres, dans
// le repère du jeu. On n'en écarte que ce qui ne peut pas tenir :
//   - ce qui déborde l'escarpe (artefact de simplification du relevé, ou ouvrage du
//     fossé qu'on ne bâtit pas ici) ;
//   - ce qui tombe dans l'enclos du donjon, qui est l'arène du boss : on s'y bat, il y
//     faut du terrain libre. Le test LIT `DONJON` au lieu de coder ses bornes en dur :
//     le jour où carte.js pose le donjon au vrai centre de la place, (4, 52), les cinq
//     casernes du nord reviennent d'elles-mêmes, sans toucher à ce fichier ;
//   - ce qui barre l'axe de la Porte Royale, qui doit rester dégagé.

// L'AXE ROYAL, tel que le relevé le dessine. Il n'est pas droit : entre les deux grands
// corps de logis du fond (emprises 14 et 17), le passage ne fait que dix mètres et son
// milieu tombe à x = -1,9, alors que la Porte Royale est à x = +2,1. On ne « corrige » ni
// l'un ni l'autre — on coude l'avenue, comme sur le plan. Ces trois rectangles servent à
// la fois à écarter les casernes qui barreraient le passage et à poser le pavage : ils ne
// peuvent donc pas diverger.
export const AXE = [
  { x: 1.0, w: 14.0, z0: 132, z1: APO - 1 },                 // du pont-levis au fond de la place
  { x: -1.9, w: 9.2, z0: 113, z1: 133 },                     // le goulet entre les deux casernes
  { x: -1.9, w: 14.0, z0: DONJON.gateZ - 4, z1: 114 },       // la traversée de l'esplanade
];

export function surAxe(x, z, marge = 0) {
  for (const a of AXE) if (Math.abs(x - a.x) < a.w / 2 + marge && z > a.z0 - marge && z < a.z1 + marge) return true;
  return false;
}

export const CASERNES = (() => {
  const brut = (TRACE && TRACE.data && TRACE.data.casernes) || [];
  const eX = DONJON.fence + 3;
  const out = [];
  brut.forEach((raw, id) => {
    const p = nettoyer(raw);
    if (p.length < 4) return;
    const aire = Math.abs(AIRE(p));
    if (aire < 45) return;                                                    // appentis du relevé
    if (Math.max(...p.map((q) => sdPent(q[0], q[1]))) > 1.5) return;          // déborde l'escarpe
    if (croiseRect(p, DONJON.x - eX, DONJON.x + eX, DONJON.z - eX, DONJON.gateZ + 3)) return;
    if (AXE.some((q) => croiseRect(p, q.x - q.w / 2, q.x + q.w / 2, q.z0, q.z1))) return;   // barre l'axe royal
    const c = CENTRE(p), b = bastionAt(c[0], c[1]);
    out.push({ id, poly: p, c, rr: RAYON(p, c), aire, bastion: b, base: b ? BAST_H : 0 });
  });
  return out;
})();

// Un point posé devant la façade d'une caserne : `note` choisit le bâtiment (on garde le
// meilleur score), `recul` est la distance au mur, `long` le décalage le long de la façade
// en fraction de sa longueur. Tout ce qui était naguère écrit en coordonnées dures — les
// caisses de Pralin, les tonneaux — se raccroche ainsi au bâti relevé plutôt qu'au vide.
export function piedDeCaserne(note, recul = 3, long = 0) {
  let best = null;
  for (const k of CASERNES) { if (k.bastion) continue; const v = note(k); if (!best || v > best.v) best = { v, k }; }
  if (!best) return null;
  const k = best.k, c = k.c;
  const vx = PLACE_C[0] - c[0], vz = PLACE_C[1] - c[1], vl = Math.hypot(vx, vz) || 1;
  let bi = -1, bn = -1e9;
  for (let i = 0; i < k.poly.length; i++) {
    const a = k.poly[i], b = k.poly[(i + 1) % k.poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 6) continue;
    const n = ((b[1] - a[1]) * vx - (b[0] - a[0]) * vz) / (L * vl);
    if (n > bn) { bn = n; bi = i; }
  }
  if (bi < 0) return null;
  const a = k.poly[bi], b = k.poly[(bi + 1) % k.poly.length];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
  const x = (a[0] + b[0]) / 2 + ux * L * long + uz * recul;
  const z = (a[1] + b[1]) / 2 + uz * L * long - ux * recul;
  return caserneIci(x, z, 0.6) ? null : [x, z];
}

// La caserne sous ce point, ou null. Sert aux galeries (sauter une travée), aux
// alignements d'arbres et à tout ce qui cherche du terrain libre dans la place.
export function caserneIci(x, z, marge = 0) {
  for (const k of CASERNES) {
    if (Math.hypot(x - k.c[0], z - k.c[1]) > k.rr + marge) continue;
    if (pointInPoly(x, z, k.poly)) return k;
    for (let i = 0; i < k.poly.length; i++) {
      const a = k.poly[i], b = k.poly[(i + 1) % k.poly.length];
      if (distSeg(x, z, a[0], a[1], b[0], b[1]) < marge) return k;
    }
  }
  return null;
}

// ---------- palette du bâti ----------
// Règle de performance autant que de DA : quelques matériaux PARTAGÉS, jamais un par
// bâtiment. mergeStatics regroupe par matériau ; une teinte propre à chaque caserne
// donnerait trente groupes d'un seul membre et plus aucune fusion. La variété vient donc
// de quatre teintes tirées d'une liste, et de la patine — qui, elle, travaille en
// coordonnées monde et ne se répète donc jamais d'un bâtiment à l'autre.
let MATB = null;
function materiauxBati() {
  if (MATB) return MATB;
  const brique = [0xffffff, 0xe8d6c6, 0xd6bcab, 0xc9b6a8].map((t, k) => patinerMat(
    phMat('church_bricks_03', 1, 1, { color: t }),
    { echelle: 26 + k * 8, force: 0.28 + k * 0.05, basY: 0, humide: 3.2, mousse: 0x53603c, pluie: 0.26 }));
  const tuile = [0xffffff, 0xdcc6b6, 0xc3ab9d, 0xaba69e].map((t, k) => patinerMat(
    phMat('clay_roof_tiles_02', 1, 1, { color: t }),
    { echelle: 30 + k * 6, force: 0.26, basY: 9.5, humide: 5.5, mousse: 0x57703a, pluie: 0.30 }));
  const pierre = patinerMat(pbrRepeat(T.stone, 1 / 2.4, 1 / 2.4, { color: 0xd9d0bc, roughness: 0.86 }),
    { echelle: 18, force: 0.24, basY: 0, humide: 2.6, mousse: 0x55603e, pluie: 0.20 });
  MATB = {
    brique, tuile, pierre,
    vitre: mat(0x1a2531, { roughness: 0.16, metalness: 0.28 }),
    bois: phMat('wood_cabinet_worn_long', 1, 1, { color: 0x6d4b2c }),
    fer: IRON(),
    ardoise: mat(0x40495a, { roughness: 0.68 }),
  };
  return MATB;
}

// ---------- les pièces qui se répètent : une géométrie, N matrices ----------
// Mille deux cents fenêtres en meshes séparés, ce sont mille deux cents objets à tenir en
// mémoire et à parcourir à chaque fusion. En InstancedMesh, c'est un objet par matériau —
// et mergeStatics les laisse tranquilles, il saute explicitement les InstancedMesh.
function chantier() {
  const lots = [];
  const lot = (geo, m) => { const l = { geo, m, l: [] }; lots.push(l); return l; };
  const M4 = new THREE.Matrix4(), MQ = new THREE.Quaternion(), MP = new THREE.Vector3(),
        MS = new THREE.Vector3(1, 1, 1), MEu = new THREE.Euler();
  const pose = (l, x, y, z, ry, s = 1) => {
    MP.set(x, y, z); MQ.setFromEuler(MEu.set(0, ry, 0)); MS.setScalar(s);
    l.l.push(new THREE.Matrix4().compose(MP, MQ, MS));
  };
  const livrer = () => {
    for (const l of lots) {
      if (!l.l.length) continue;
      const im = new THREE.InstancedMesh(l.geo, l.m, l.l.length);
      im.castShadow = im.receiveShadow = true;
      l.l.forEach((mx, i) => im.setMatrixAt(i, mx));
      scene.add(im);
    }
  };
  return { lot, pose, livrer, M4 };
}

// fenêtre de caserne : embrasure de pierre, appui à larmier, linteau à clé. Le vantail
// regarde +z ; l'origine est au centre de la baie, dans le plan de la façade.
function uniteFenetre(w = 1.15, h = 2.05) {
  const p = [];
  const bx = (dx, dy, dz, x, y, z) => p.push(new THREE.BoxGeometry(dx, dy, dz).translate(x, y, z));
  for (const sx of [-1, 1]) bx(0.24, h + 0.3, 0.34, sx * (w / 2 + 0.12), 0, -0.05);   // tableaux
  bx(w + 0.48, 0.26, 0.34, 0, h / 2 + 0.13, -0.05);                                   // linteau
  bx(0.3, 0.44, 0.36, 0, h / 2 + 0.2, 0.02);                                          // clé
  bx(w + 0.8, 0.22, 0.5, 0, -h / 2 - 0.11, -0.02);                                    // appui à larmier
  return mergeParts(p);
}
const uniteVitre = (w = 1.15, h = 2.05) => mergeParts([
  new THREE.BoxGeometry(w, h, 0.1).translate(0, 0, -0.22),
  new THREE.BoxGeometry(w, 0.07, 0.1).translate(0, 0, -0.14),
  new THREE.BoxGeometry(0.07, h, 0.1).translate(0, 0, -0.14),
]);
// lucarne : pignon, joues, toit à deux pans. Origine au pied, dans le plan du toit.
function uniteLucarne() {
  const p = [new THREE.BoxGeometry(1.75, 1.95, 1.5).translate(0, 0.98, -0.45)];
  for (const sx of [-1, 1]) {
    const g = new THREE.BoxGeometry(2.2, 0.16, 1.7);
    g.rotateZ(sx * 0.62); g.translate(sx * 0.62, 2.35, -0.45);
    p.push(g);
  }
  p.push(new THREE.BoxGeometry(0.26, 0.26, 1.8).translate(0, 2.72, -0.45));
  return mergeParts(p);
}
const uniteLucarneVitre = () => mergeParts([new THREE.BoxGeometry(1.0, 1.2, 0.08).translate(0, 1.0, 0.28)]);
// souche de cheminée : fût, corniche, deux poteries
function uniteCheminee() {
  const p = [new THREE.BoxGeometry(1.15, 3.4, 1.15).translate(0, 1.7, 0),
             new THREE.BoxGeometry(1.5, 0.3, 1.5).translate(0, 3.35, 0)];
  for (const sx of [-1, 1]) p.push(new THREE.CylinderGeometry(0.17, 0.19, 0.6, 8).translate(sx * 0.28, 3.8, 0));
  return mergeParts(p);
}
// porte cochère des casernes : deux vantaux, et son encadrement de pierre à part
const unitePorte = () => mergeParts([
  new THREE.BoxGeometry(1.15, 3.0, 0.12).translate(-0.6, 1.5, -0.06),
  new THREE.BoxGeometry(1.15, 3.0, 0.12).translate(0.6, 1.5, -0.06),
  new THREE.BoxGeometry(2.5, 0.16, 0.16).translate(0, 2.4, 0.02),
]);
function unitePorteCadre() {
  const p = [];
  for (const sx of [-1, 1]) p.push(new THREE.BoxGeometry(0.4, 3.5, 0.42).translate(sx * 1.45, 1.75, -0.06));
  p.push(new THREE.BoxGeometry(3.3, 0.36, 0.42).translate(0, 3.68, -0.06));
  p.push(new THREE.BoxGeometry(0.42, 0.62, 0.46).translate(0, 3.8, 0.0));
  p.push(new THREE.BoxGeometry(3.9, 0.26, 0.6).translate(0, 4.02, -0.02));
  return mergeParts(p);
}

// ---------- pose d'un bâtiment sur une emprise relevée ----------
// Une seule recette pour les casernes et pour les corps de garde : le contour décide de
// tout. Le corps descend 3,2 m sous sa base, ce qui évite qu'un angle posé en limite de
// terre-plein de bastion ne se retrouve en l'air.
// Façade principale : la plus longue arête qui regarde la place — ou la direction
// imposée par `regard`, quand le bâtiment a une orientation voulue (corps de garde).
// À part depuis le 5 octobre : l'acte I doit trouver la porte d'un bâtiment (l'armurerie,
// la caserne des soldats cachés) là où poserBatiment l'a mise, pas la deviner.
// Rend l'arête, le milieu de la porte au sol et la normale vers l'extérieur.
function facadePrincipale(p, regard) {
  const c = CENTRE(p);
  const vers = regard || [PLACE_C[0] - c[0], PLACE_C[1] - c[1]];
  const vl = Math.hypot(vers[0], vers[1]) || 1;
  let i0 = 0, meilleur = -1e9;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 4.5) continue;
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
    const note = L * 0.25 + 30 * (nx * vers[0] + nz * vers[1]) / vl;
    if (note > meilleur) { meilleur = note; i0 = i; }
  }
  const a = p[i0], b = p[(i0 + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
  return { i: i0, L, ux, uz, nx: uz, nz: -ux, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2 };
}

function poserBatiment(ch, p, opt = {}) {
  const M = materiauxBati();
  const base = opt.base || 0, etages = opt.etages || 2, teinte = (opt.teinte || 0) % 4;
  const H = 1.05 + etages * 3.55;
  const egout = offsetPoly(p, 0.7);
  const { o: fo, q: faite } = faitage(egout, opt.faiteMax || 9);
  const roofH = Math.min(7.5, Math.max(2.2, fo * (opt.pente || 0.85)));
  const yE = base + H;

  poseMesh(indexe(new THREE.ExtrudeGeometry(polyShape(p), { depth: H + 3.2, bevelEnabled: false })
    .rotateX(-Math.PI / 2).translate(0, base - 3.2, 0)), M.brique[teinte]);
  // soubassement et son glacis
  poseMesh(indexe(new THREE.ExtrudeGeometry(polyShape(offsetPoly(p, 0.45)), { depth: 2.1, bevelEnabled: false })
    .rotateX(-Math.PI / 2).translate(0, base - 1.0, 0)), M.pierre);
  poseMesh(nappe(offsetPoly(p, 0.45), offsetPoly(p, 0.04), base + 1.1, base + 1.34, false), M.pierre);
  // bandeau entre les niveaux
  for (let f = 1; f < etages; f++)
    poseMesh(indexe(new THREE.ExtrudeGeometry(polyShape(offsetPoly(p, 0.16)), { depth: 0.28, bevelEnabled: false })
      .rotateX(-Math.PI / 2).translate(0, base + 1.05 + f * 3.55 - 0.5, 0)), M.pierre);
  // corniche : cavet montant puis larmier
  poseMesh(nappe(offsetPoly(p, 0.08), offsetPoly(p, 0.62), yE - 0.9, yE - 0.3, false), M.pierre);
  poseMesh(indexe(new THREE.ExtrudeGeometry(polyShape(offsetPoly(p, 0.62)), { depth: 0.3, bevelEnabled: false })
    .rotateX(-Math.PI / 2).translate(0, yE - 0.3, 0)), M.pierre);
  // toiture à croupes
  poseMesh(nappe(egout, faite, yE, yE + roofH, true), opt.ardoise ? M.ardoise : M.tuile[(teinte + 2) % 4]);

  const principale = facadePrincipale(p, opt.regard).i;

  // percements, arête par arête
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 4.2) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux;
    const ry = Math.atan2(nx, nz);
    const n = Math.max(1, Math.round((L - 2.2) / 4.3)), pas = L / n;
    const porte = i === principale ? L / 2 : -99;
    for (let k = 0; k < n; k++) {
      const s = (k + 0.5) * pas, x = a[0] + ux * s, z = a[1] + uz * s;
      for (let f = 0; f < etages; f++) {
        if (f === 0 && Math.abs(s - porte) < 2.6) continue;
        const y = base + 1.05 + f * 3.55 + 1.75;
        ch.pose(ch.fen, x + nx * 0.04, y, z + nz * 0.04, ry);
        ch.pose(ch.vit, x + nx * 0.04, y, z + nz * 0.04, ry);
      }
    }
    if (i === principale) {
      const x = a[0] + ux * porte, z = a[1] + uz * porte;
      ch.pose(ch.por, x + nx * 0.1, base + 1.05, z + nz * 0.1, ry);
      ch.pose(ch.porc, x + nx * 0.1, base + 1.05, z + nz * 0.1, ry);
      // parvis pavé devant l'entrée
      const pv = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(L, 16), 7),
        pbrRepeat(cobbles(), Math.min(L, 16) / COBBLE_M, 7 / COBBLE_M, { roughness: 0.9 }));
      pv.rotation.x = -Math.PI / 2; pv.rotation.z = ry;   // un rectangle centré est invariant à pi près
      pv.position.set(x + nx * 3.6, base + 0.036, z + nz * 3.6); pv.receiveShadow = true;
      if (!base) scene.add(pv);
    }
    // lucarnes sur les deux plus longues façades
    if (L > 18 && roofH > 3) {
      const nl = Math.min(4, Math.floor(L / 12));
      for (let k = 0; k < nl; k++) {
        const s = L * (k + 0.5) / nl;
        const t = 0.34, rx = a[0] + ux * s + nx * (0.7 - fo * t), rz = a[1] + uz * s + nz * (0.7 - fo * t);
        ch.pose(ch.luc, rx, yE + roofH * t, rz, ry);
        ch.pose(ch.lucv, rx, yE + roofH * t, rz, ry);
      }
    }
  }
  // cheminées : aux deux tiers de la plus longue diagonale du faîte
  {
    let i0 = 0, i1 = 0, d2 = -1;
    for (let i = 0; i < faite.length; i++) for (let j = i + 1; j < faite.length; j++) {
      const d = (faite[i][0] - faite[j][0]) ** 2 + (faite[i][1] - faite[j][1]) ** 2;
      if (d > d2) { d2 = d; i0 = i; i1 = j; }
    }
    for (const t of (Math.sqrt(d2) > 26 ? [0.16, 0.5, 0.84] : [0.25, 0.75])) {
      const x = faite[i0][0] + (faite[i1][0] - faite[i0][0]) * t;
      const z = faite[i0][1] + (faite[i1][1] - faite[i0][1]) * t;
      ch.pose(ch.che, x, yE + roofH - 0.4, z, 0);
    }
  }
  // collisions : une capsule par arête, arrêtée à mi-toit
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    addCap(a[0], a[1], b[0], b[1], 0.55, base + H + roofH * 0.55);
  }
  return { H, roofH, yE, faite, fo };
}

// ouvre un chantier prêt à poser fenêtres, lucarnes, cheminées et portes
function ouvrirChantier() {
  const M = materiauxBati(), ch = chantier();
  ch.fen = ch.lot(uniteFenetre(), M.pierre);
  ch.vit = ch.lot(uniteVitre(), M.vitre);
  ch.luc = ch.lot(uniteLucarne(), M.pierre);
  ch.lucv = ch.lot(uniteLucarneVitre(), M.vitre);
  ch.che = ch.lot(uniteCheminee(), M.brique[1]);
  ch.por = ch.lot(unitePorte(), M.bois);
  ch.porc = ch.lot(unitePorteCadre(), M.pierre);
  return ch;
}

// =====================================================================
//  Les casernes
// =====================================================================
// Le couloir de rampe d'un bastion est choisi AVANT que les casernes soient bâties, et
// une emprise relevée qui tombe dedans n'est pas élevée. Le relevé fait foi partout
// ailleurs, mais un bâtiment qui barre l'unique accès à un bastion rend l'ouvrage
// injouable — et le calage du bâti sur celui du tracé n'est pas au mètre près.
export function surCouloirRampe(p) {
  for (const b of bastions) {
    for (const q of p) {
      const s = (q[0] - b.V[0]) * b.u[0] + (q[1] - b.V[1]) * b.u[1];
      const t = (q[0] - b.V[0]) * b.v[0] + (q[1] - b.V[1]) * b.v[1];
      if (s > b.sShoulder - b.rampLen - 3 && s < b.sShoulder + WALL_T / 2 + 3
        && Math.abs(t - b.tRampe) < b.demiRampe + 1.2) return b.name;
    }
  }
  return null;
}

export function buildCasernes() {
  if (!CASERNES.length) { casernesDeSecours(); return; }
  const ch = ouvrirChantier();
  let surface = 0, ecartees = [];
  for (const k of CASERNES) {
    { const nom = surCouloirRampe(k.poly); if (nom) { ecartees.push(nom); continue; } }
    // Un bâtiment de bastion est un magasin : un seul niveau, toit bas, il ne doit pas
    // masquer les pièces ni casser la silhouette de l'ouvrage.
    const etages = k.bastion ? 1 : k.aire > 900 ? 3 : k.aire > 380 ? 2 : 1;
    poserBatiment(ch, k.poly, {
      base: k.base, etages, teinte: (k.id * 5 + k.poly.length) % 4,
      faiteMax: k.bastion ? 6 : 9, pente: k.bastion ? 0.6 : 0.85, ardoise: k.aire > 1200,
    });
    surface += k.aire;
    if (k.aire > 900) addLieu({ id: 'caserne' + k.id, nom: 'les casernes', x: k.c[0], z: k.c[1], r: 40 });
  }
  ch.livrer();
  console.log('casernes : %d emprises bâties sur %d relevées, %d m² au sol%s',
    CASERNES.length - ecartees.length, CASERNES.length, Math.round(surface),
    ecartees.length ? ` (${ecartees.length} écartée(s), en travers de l'accès : ${[...new Set(ecartees)].join(', ')})` : '');
}

// Secours : si carte/citadelle.json manque, TRACE est nul, la citadelle retombe sur le
// pentagone régulier — et les casernes sur les cinq barres d'avant le relevé.
function casernesDeSecours() {
  const ch = ouvrirChantier();
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue;
    const a = -Math.PI / 2 + i * TAU / 5 + Math.PI / 5;
    const cx = Math.cos(a) * (APO - 14), cz = Math.sin(a) * (APO - 14);
    const L = 22, D = 8.5;
    const u = [-Math.sin(a), Math.cos(a)], v = [Math.cos(a), Math.sin(a)];
    const poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) =>
      [cx + u[0] * s * L / 2 + v[0] * t * D / 2, cz + u[1] * s * L / 2 + v[1] * t * D / 2]);
    poserBatiment(ch, nettoyer(poly), { base: 0, etages: 1, teinte: i });
  }
  ch.livrer();
}

// =====================================================================
//  La place d'Armes
// =====================================================================
// À 1:1 l'intérieur du corps de place fait 5,3 hectares. Le paver d'un bout à l'autre,
// comme on le faisait au 1/4,5, c'est trente mille mètres carrés de pavés : la texture
// n'a plus d'échelle et le lieu n'a plus de centre. Un corps de place se lit en trois
// bandes concentriques, et c'est ce qui lui donne sa profondeur :
//   - au pied des casernes, la cour de service, en sable tassé (déjà posée) ;
//   - une rue de ronde pavée de dix mètres, qui dessert les portes ;
//   - au milieu, l'esplanade de manœuvre : du gravier damé, parce qu'on y fait
//     l'exercice et qu'on n'a jamais pavé un terrain de manœuvre.
// Les deux bornes ci-dessous sont des RENTRÉES depuis les lignes de courtine, pas des
// rayons : le pentagone relevé n'est pas centré sur l'origine du jeu.

export const PLACE_RUE0 = 60, PLACE_RUE1 = 70;

export const PLACE_C = CENTRE(pentPlace(PLACE_RUE1));   // vrai centre de la place, ≈ (4, 52)

function solPlaceDArmes() {
  const pave = patinerMat(pbrRepeat(cobbles(), 100 / COBBLE_M, 100 / COBBLE_M, { roughness: 0.9 }),
    { echelle: 34, force: 0.30, basY: -6, humide: 0.4, mousse: 0x4e5c36, pluie: 0.06 });
  // esplanade de manœuvre
  scene.add(flatMesh(polyShape(pentPlace(PLACE_RUE1)),
    patinerMat(phMat('gravier', 100, 100, { color: 0xded1b6 }),
      { echelle: 46, force: 0.36, basY: -6, humide: 0.4, mousse: 0x5a6a3e, pluie: 0.04 }), 0.022));
  // rue de ronde, entre l'esplanade et les casernes
  const rue = polyShape(pentPlace(PLACE_RUE0)); rue.holes.push(polyShape(pentPlace(PLACE_RUE1)));
  scene.add(flatMesh(rue, pave, 0.030));
  // axe royal : trois rectangles pavés, coudés comme le relevé les dessine
  for (const a of AXE) {
    const L = a.z1 - a.z0;
    const av = new THREE.Mesh(new THREE.PlaneGeometry(a.w, L),
      pbrRepeat(cobbles(), a.w / COBBLE_M, L / COBBLE_M, { roughness: 0.9 }));
    av.rotation.x = -Math.PI / 2; av.position.set(a.x, 0.034, (a.z0 + a.z1) / 2);
    av.receiveShadow = true; scene.add(av);
  }
}

// terrain libre pour planter, poser un puits ou une pièce d'artillerie
function placeLibre(x, z, marge = 3) {
  if (caserneIci(x, z, marge + 2)) return false;
  if (surAxe(x, z, marge)) return false;
  const f = DONJON.fence + marge + 2;
  if (Math.abs(x - DONJON.x) < f && z > DONJON.z - f && z < DONJON.gateZ + marge + 2) return false;
  if (sdPent(x, z) > -(WALL_T / 2 + GAL.DEPTH + 6)) return false;     // arcade et chemin de ronde
  return true;
}

// ---------- alignements de tilleuls ----------
// Deux rangées le long de l'axe royal, une troisième au bord de l'esplanade. C'est le
// seul élément vertical de la place : à 1:1, sans lui, le regard n'a plus rien entre les
// pieds du joueur et les remparts à deux cents mètres, et la distance ne se lit pas.
function uniteHouppier() {
  const p = [];
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * TAU + rand(-0.35, 0.35), r = rand(0.5, 2.1), y = 7.6 + rand(-1.4, 1.7);
    const g = new THREE.PlaneGeometry(5.6, 5.6);
    g.rotateX(rand(-0.55, 0.55)); g.rotateY(a);
    g.translate(Math.cos(a) * r, y, Math.sin(a) * r);
    p.push(g);
  }
  return mergeParts(p);
}

function planterAlignements() {
  const pts = [];
  // deux rangées de part et d'autre de l'axe, qui suivent son coude
  for (const a of AXE) for (const sx of [-1, 1]) {
    const n = Math.max(1, Math.round((a.z1 - a.z0 - 6) / 9.6));
    for (let k = 0; k <= n; k++) {
      const z = a.z0 + 3 + (a.z1 - a.z0 - 6) * k / n, x = a.x + sx * (a.w / 2 + 3.4);
      if (caserneIci(x, z, 4)) continue;
      if (surAxe(x, z, -1)) continue;
      if (sdPent(x, z) > -(WALL_T / 2 + GAL.DEPTH + 6)) continue;
      const f = DONJON.fence + 4;
      if (Math.abs(x - DONJON.x) < f && z > DONJON.z - f && z < DONJON.gateZ + 3) continue;
      if (pts.some(([qx, qz]) => Math.hypot(qx - x, qz - z) < 6)) continue;
      pts.push([x, z]);
    }
  }
  // une rangée au bord intérieur de la rue de ronde
  const bord = pentPlace(PLACE_RUE1 + 2.6);
  for (let i = 0; i < bord.length; i++) {
    const a = bord[i], b = bord[(i + 1) % bord.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(L / 11.5);
    for (let k = 1; k < n; k++) {
      const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (placeLibre(x, z, 4)) pts.push([x, z]);
    }
  }
  if (!pts.length) return;
  const troncGeo = new THREE.CylinderGeometry(0.26, 0.42, 5.6, 8).translate(0, 2.8, 0);
  const troncs = new THREE.InstancedMesh(troncGeo, phMat('tree_trunk', 2.1, 5.6), pts.length);
  const houppiers = new THREE.InstancedMesh(uniteHouppier(), new THREE.MeshStandardMaterial({
    map: carteForet('houppier_tendre'), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1, color: 0x9dba6e,
  }), pts.length);
  troncs.castShadow = houppiers.castShadow = true; troncs.receiveShadow = true;
  const MM = new THREE.Matrix4(), MQ = new THREE.Quaternion(), MP = new THREE.Vector3(), MS = new THREE.Vector3(), MEu = new THREE.Euler();
  pts.forEach(([x, z], i) => {
    const s = rand(0.86, 1.14);
    MP.set(x, 0, z); MQ.setFromEuler(MEu.set(0, rand(0, TAU), 0)); MS.set(s, rand(0.92, 1.12), s);
    MM.compose(MP, MQ, MS);
    troncs.setMatrixAt(i, MM); houppiers.setMatrixAt(i, MM);
    addCap(x, z, x, z, 0.5, Infinity);
  });
  scene.add(troncs, houppiers);
  return pts.length;
}

// ---------- puits, corps de garde, parc d'artillerie ----------
function puits(x, z) {
  const M = materiauxBati();
  scene.add(mesh(new THREE.CylinderGeometry(1.35, 1.45, 1.15, 16), M.pierre, x, 0.58, z));
  scene.add(mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.3, 16), mat(0x0d1116), x, 1.05, z));
  for (const sx of [-1, 1]) scene.add(mesh(boxG(0.2, 2.8, 0.2), M.bois, x + sx * 1.15, 1.9, z));
  scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.5, 8), M.bois, x, 2.75, z).rotateZ(Math.PI / 2));
  scene.add(mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.42, 10), M.fer, x, 1.7, z));
  const t = mesh(new THREE.ConeGeometry(2.0, 1.1, 4), M.ardoise, x, 3.75, z); t.rotation.y = Math.PI / 4; scene.add(t);
  scene.add(mesh(sphG(0.18, 8), M.fer, x, 4.4, z));
  addCap(x, z, x, z, 1.55, 3.2);
}

// corps de garde : le petit pavillon où la garde attend, sous auvent, près de la porte
function corpsDeGarde(ch, x, z, ry) {
  const M = materiauxBati(), W = 9.5, D = 7;
  const c = Math.cos(ry), s = Math.sin(ry);
  const loc = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  poserBatiment(ch, nettoyer([loc(-W / 2, -D / 2), loc(W / 2, -D / 2), loc(W / 2, D / 2), loc(-W / 2, D / 2)]),
    { base: 0, etages: 1, teinte: 1, faiteMax: 4.2, pente: 1.0, regard: [s, c] });
  // auvent sur quatre colonnes, côté place
  for (const u of [-W / 2 + 1.1, -1.2, 1.2, W / 2 - 1.1]) {
    const [px, pz] = loc(u, D / 2 + 2.4);
    scene.add(mesh(new THREE.CylinderGeometry(0.28, 0.33, 3.5, 12), M.pierre, px, 1.75, pz));
    addCap(px, pz, px, pz, 0.35, 3.6);
  }
  { const [ax, az] = loc(0, D / 2 + 2.4);
    const av = mesh(boxG(W, 0.42, 3.4), M.pierre, ax, 3.7, az); av.rotation.y = ry; scene.add(av);
    const tt = mesh(boxG(W + 0.6, 0.3, 4.2), M.ardoise, ax, 4.05, az); tt.rotation.y = ry; scene.add(tt); }
  // lanterne de la garde, sur potence. Décor seulement : le niveau tient déjà ses dix
  // lumières ponctuelles, on n'en ajoute pas pour un détail.
  { const [ax, az] = loc(W / 2 - 0.9, D / 2 - 0.1), [lx, lz] = loc(W / 2 - 0.9, D / 2 + 1.1);
    const br = mesh(boxG(0.09, 0.09, 1.4), M.fer, (ax + lx) / 2, 4.5, (az + lz) / 2); br.rotation.y = ry; scene.add(br);
    scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), M.fer, lx, 4.2, lz));
    scene.add(mesh(boxG(0.42, 0.56, 0.42), mat(0xffe6a8, { emissive: 0xffc24a, emissiveIntensity: 0.6 }), lx, 3.75, lz)); }
}

// pièce d'artillerie de parc : affût de siège, roues, tas de boulets
function pieceDArtillerie(x, z, ry) {
  const M = materiauxBati();
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const bronze = mat(0x6a5230, { metalness: 0.75, roughness: 0.42 });
  const b = mesh(new THREE.CylinderGeometry(0.16, 0.24, 3.1, 14), bronze, 0, 1.15, 0.5);
  b.rotation.x = Math.PI / 2 - 0.1; g.add(b);
  g.add(mesh(sphG(0.26, 10), bronze, 0, 1.3, -0.95));
  for (const sx of [-1, 1]) {
    const w = mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.16, 14), M.bois, sx * 0.72, 0.78, -0.2);
    w.rotation.z = Math.PI / 2; g.add(w);
    for (let k = 0; k < 4; k++) g.add(mesh(boxG(0.1, 1.5, 0.1), M.bois, sx * 0.72, 0.78, -0.2).rotateX(k * TAU / 8));
    g.add(mesh(boxG(0.18, 0.72, 2.6), M.bois, sx * 0.52, 0.7, -0.4));
  }
  g.add(mesh(boxG(1.1, 0.24, 2.0), M.bois, 0, 0.92, -0.3));
  scene.add(g);
  addCap(x, z, x, z, 1.5, 1.5);
  // pyramide de boulets à côté
  const bx = x + Math.cos(ry) * 2.8, bz = z - Math.sin(ry) * 2.8;
  let n = 0;
  for (let e = 0; e < 3; e++) for (let i = 0; i <= 2 - e; i++) for (let j = 0; j <= 2 - e; j++) {
    scene.add(mesh(sphG(0.19, 8), M.fer, bx + (i - (2 - e) / 2) * 0.38, 0.19 + e * 0.33, bz + (j - (2 - e) / 2) * 0.38));
    n++;
  }
  addCap(bx, bz, bx, bz, 0.8, 1.2);
}

export function buildPlaceDArmes() {
  const M = materiauxBati(), ch = ouvrirChantier();
  // Corps de garde de part et d'autre de l'entrée, tournés vers l'axe. Ils se tiennent
  // entre la Porte Royale et les deux grands corps de logis du fond (emprises 9 et 10,
  // qui s'arrêtent à z ≈ 156) : plus au sud, ils leur rentreraient dedans.
  let ng = 0;
  for (const sx of [-1, 1]) {
    const x = sx * 15.5, z = APO - 11;
    if (caserneIci(x, z, 7)) continue;
    corpsDeGarde(ch, x, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2); ng++;
  }
  ch.livrer();

  const arbres = planterAlignements();

  // Puits : un par quartier, au bord de la rue de ronde. Les cinq milieux de côté tombaient
  // presque tous sur une caserne — on balaie donc le côté depuis son milieu jusqu'à trouver
  // un emplacement libre, plutôt que de renoncer.
  const bp = pentPlace(PLACE_RUE1 - 4);
  let np = 0;
  for (let i = 0; i < bp.length; i++) {
    const a = bp[i], b = bp[(i + 1) % bp.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (let d = 0; d <= L / 2 - 10; d += 6) {
      let pose = false;
      for (const sg of (d ? [-1, 1] : [1])) {
        const t = L / 2 + sg * d, x = a[0] + ux * t, z = a[1] + uz * t;
        if (!placeLibre(x, z, 4)) continue;
        puits(x, z); np++; pose = true; break;
      }
      if (pose) break;
    }
  }

  // mât des couleurs, au centre géométrique de la place : le repère qui manquait
  { const [cx, cz] = PLACE_C;
    scene.add(mesh(new THREE.CylinderGeometry(2.6, 3.1, 0.7, 10), M.pierre, cx, 0.35, cz));
    scene.add(mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.6, 10), M.pierre, cx, 0.95, cz));
    scene.add(mesh(new THREE.CylinderGeometry(0.16, 0.26, 17, 10), M.bois, cx, 9.7, cz));
    scene.add(mesh(sphG(0.34, 10), GOLD(), cx, 18.4, cz));
    const dr = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6, 8, 2), mat(0xc22a2a, { side: THREE.DoubleSide, roughness: 0.75 }));
    dr.position.set(cx + 2.1, 16.6, cz); dr.userData.flag = true; dr.castShadow = true; scene.add(dr);
    addCap(cx, cz, cx, cz, 3.2, 1.05); }

  // parc d'artillerie : une file de pièces alignées le long de l'esplanade
  { const bd = pentPlace(PLACE_RUE1 + 9);
    const a = bd[1], b = bd[2], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    let n = 0;
    for (let s = 12; s < L - 12 && n < 8; s += 7.5) {
      const x = a[0] + ux * s, z = a[1] + uz * s;
      if (!placeLibre(x, z, 4)) continue;
      // les pièces de parc sont alignées, bouche tournée vers le rempart
      pieceDArtillerie(x, z, Math.atan2(x - PLACE_C[0], z - PLACE_C[1])); n++;
    } }

  // bornes et chasse-roues le long de la rue de ronde : elles donnent l'échelle au sol
  { const bd = pentPlace(PLACE_RUE1 + 0.8), bornes = [];
    for (let i = 0; i < bd.length; i++) {
      const a = bd[i], b = bd[(i + 1) % bd.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(L / 6);
      for (let k = 1; k < n; k++) {
        const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (surAxe(x, z, 2)) continue;
        bornes.push([x, z]);
      }
    }
    if (bornes.length) {
      const g = mergeParts([
        new THREE.CylinderGeometry(0.19, 0.24, 0.85, 8).translate(0, 0.42, 0),
        new THREE.SphereGeometry(0.19, 8, 6).translate(0, 0.86, 0),
      ]);
      const im = new THREE.InstancedMesh(g, M.pierre, bornes.length);
      im.castShadow = im.receiveShadow = true;
      const MM = new THREE.Matrix4();
      bornes.forEach(([x, z], i) => im.setMatrixAt(i, MM.makeTranslation(x, 0, z)));
      scene.add(im);
    } }

  // abreuvoir de la garde, le long du corps de garde de l'est
  { const x = 26, z = APO - 20;
    if (!caserneIci(x, z, 4)) {
      scene.add(mesh(boxG(5.4, 0.85, 1.5), M.pierre, x, 0.42, z));
      scene.add(mesh(boxG(4.8, 0.2, 1.0), mat(0x2f5f7a, { roughness: 0.12, metalness: 0.05 }), x, 0.72, z));
      addCap(x - 2.7, z, x + 2.7, z, 0.8, 0.9);
    } }

  addLieu({ id: 'place', nom: "la place d'Armes", x: PLACE_C[0], z: PLACE_C[1], r: 60 });
  console.log("place d'Armes : %d tilleuls, %d puits, %d corps de garde, esplanade de %d m²",
    arbres || 0, np, ng, Math.round(Math.abs(AIRE(pentPlace(PLACE_RUE1)))));
}

// =====================================================================
//  Galeries voûtées et chemin de ronde
// =====================================================================
// Elles avaient été dessinées pour le pentagone du 1/4,5 : 4,00 m de profondeur, 4,20 m
// sous le toit, une arcade tous les 4,20 m, une rampe d'accès de 3,50 m. Reportées telles
// quelles sur des courtines de 129 à 173 m, elles donnaient un ruban de cent quatre-vingts
// arcades minuscules, une rampe à 48° qu'on ne pouvait pas gravir, et un chemin de ronde à
// 4,20 m d'où l'on ne voyait pas par-dessus une courtine haute de 8 m.
//
// Ici, les mesures sont celles d'un rempart : 8 m de profondeur, berceau plein cintre de
// 4 m de rayon, arcades de 7,40 m, terre-plein à 6,90 m — il reste 1,10 m de banquette
// derrière le parapet, la hauteur qu'il faut pour se couvrir. La rampe fait 26 m pour
// 6,90 m, soit 15° : on y monterait une pièce d'artillerie, et on la gravit sans effort.
//
// Deux choix que l'échelle réelle impose :
//   - la rampe n'est plus un plan posé sous la voûte, c'est une TRANCHÉE dans le
//     terre-plein, entre la courtine et un mur de soutènement. Ni arcade ni berceau
//     au-dessus : c'est ainsi qu'on monte au rempart dans l'ouvrage réel ;
//   - là où une caserne relevée occupe le pied de la courtine, la travée saute. L'arcade
//     est donc interrompue en quelques endroits, et le chemin de ronde se lit en tronçons
//     plutôt qu'en anneau parfait — ce que montre le plan de Lille.

export const GAL = { DEPTH: 8.0, ROOF: 6.9, IMPOSTE: 3.4, TRAVEE: 7.4, RAMPE: 18, VOUTE: 4.0 };

// LE MUR DE SOUTÈNEMENT PERCÉ D'UNE ARCHE. Au bastion de Turenne, le mur qui borde la rampe
// d'une galerie traversait de part en part la rampe du bastion : on s'y cognait en montant
// comme en descendant, à cheval surtout (Eugène, 30 septembre : « j'aime bien l'idée du mur
// devant le bastion, mais il faudrait une arche pour quand même pouvoir passer »). Là où le
// mur croise le couloir d'une rampe de bastion, il s'interrompt ; au-dessus, un tympan de
// brique percé d'un arc surbaissé laisse 3,4 m sous l'arc au moins — un cavalier y passe.
// La collision ne suit que les morceaux pleins.
function rampeBastionEn(x, z) {
  for (const bb of bastions) {
    if (bb.tRampe === undefined) continue;
    const s = (x - bb.V[0]) * bb.u[0] + (z - bb.V[1]) * bb.u[1], t = (x - bb.V[0]) * bb.v[0] + (z - bb.V[1]) * bb.v[1];
    const s0 = bb.sShoulder - bb.rampLen;
    if (Math.abs(t - bb.tRampe) < bb.demiRampe + 0.5 && s > s0 - 0.5 && s < (bb.sPalier ?? bb.sShoulder) + 0.5)
      return BAST_H * Math.min(1, Math.max(0, (s - s0) / bb.rampLen));
  }
  return null;
}
function murPerce(e0, e1, H) {
  const L = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), ux = (e1[0] - e0[0]) / L, uz = (e1[1] - e0[1]) / L;
  const P = (d) => [e0[0] + ux * d, e0[1] + uz * d];
  // les ouvertures : les intervalles du mur qui passent dans un couloir de rampe
  const trous = []; let debut = null, sol = 0;
  for (let d = 0; d <= L + 1e-6; d += 0.25) {
    const h = rampeBastionEn(...P(d));
    if (h !== null) { if (debut === null) { debut = d; sol = h; } sol = Math.max(sol, h); }
    else if (debut !== null) { trous.push([debut, d, sol]); debut = null; }
  }
  if (debut !== null) trous.push([debut, L, sol]);
  const plein = (a, b) => {
    if (b - a < 0.3) return;
    const [ax, az] = P(a), [bx, bz] = P(b);
    wallBox(ax, az, bx, bz, H, 0.8, brickMat, 0, 'church_bricks_03');
    wallBox(ax, az, bx, bz, 0.4, 1.3, stoneMat, H, T.stone);                 // le couronnement
    const r = 0.45, ca = a > 0 ? a + r : a, cb = b < L ? b - r : b;    // la capsule ne déborde pas dans l'arche
    if (cb > ca) { const [cx0, cz0] = P(ca), [cx1, cz1] = P(cb); addCap(cx0, cz0, cx1, cz1, r, H + 0.4); }
  };
  let d0 = 0;
  for (const [a, b, sol] of trous) {
    plein(d0, a); d0 = b;
    // le mur s'arrête dans le couloir : pas d'arche en porte-à-faux, il finit au bord de la rampe
    if (a < 0.5 || b > L - 0.5) continue;
    const w = b - a, haut = H - 0.5, pied = Math.min(3.4, Math.max(2.6, haut - sol - 1.2)), fleche = Math.max(0.3, Math.min(1.4, haut - sol - pied));
    if (sol + pied + fleche > H - 0.2) continue;            // trop bas pour un tympan : l'ouverture seule
    // le tympan : de la naissance de l'arc au sommet du mur, l'intrados en arc surbaissé
    const sh = new THREE.Shape();
    sh.moveTo(0, sol + pied); sh.lineTo(0, H); sh.lineTo(w, H); sh.lineTo(w, sol + pied);
    sh.quadraticCurveTo(w / 2, sol + pied + 2 * fleche, 0, sol + pied);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false, curveSegments: 16 });
    g.translate(0, 0, -0.4);
    const m = new THREE.Mesh(g, patinerMat(phMat('church_bricks_03', 1, 1), { echelle: 9, force: 0.34, basY: 0, humide: 2.2 }));
    const [ax, az] = P(a);
    m.position.set(ax, 0, az); m.rotation.y = -Math.atan2(uz, ux);
    m.castShadow = m.receiveShadow = true; scene.add(m);
    { const [bx, bz] = P(b); wallBox(ax, az, bx, bz, 0.4, 1.3, stoneMat, H, T.stone); }   // le couronnement passe sur l'arche
  }
  plein(d0, L);
}

export function buildGalleries() {
  const G = GAL, OFF0 = WALL_T / 2, MID = OFF0 + G.DEPTH / 2;
  const MATS = {
    pierre: patinerMat(pbrRepeat(T.stone, 1 / 2.4, 1 / 2.4, { color: 0xcfc6b2, roughness: 0.86 }),
      { echelle: 22, force: 0.30, basY: 0, humide: 3.4, mousse: 0x4f5c38, pluie: 0.26 }),
    voute: patinerMat(phMat('church_bricks_03', 1, 1, { color: 0xc0a893, side: THREE.DoubleSide }),
      { echelle: 13, force: 0.42, basY: 0, humide: 3.6, mousse: 0x475538, pluie: 0.34 }),
    dalle: patinerMat(pbrRepeat(T.stone, 1 / 2.0, 1 / 2.0, { color: 0xa9a196, roughness: 0.92 }),
      { echelle: 26, force: 0.34, basY: -6, humide: 0.5, mousse: 0x4c5a35, pluie: 0.05 }),
  };
  let travees = 0, sautees = 0, paliersN = 0, rampes = 0, orphelins = 0, horsMur = 0;

  for (let i = 0; i < bastions.length; i++) {
    const [n0, n1] = normale(i), nx = -n0, nz = -n1;            // vers l'intérieur de la place
    const A = bastions[i].S1, B = bastions[(i + 1) % bastions.length].S2;
    // la courtine de la Porte Royale est coupée par le frontispice : deux tronçons
    const parts = i === GATE_I ? [[A, [GATE_HW + 12, APO]], [[-GATE_HW - 12, APO], B]] : [[A, B]];
    for (const [a, b] of parts) {
      const ax = a[0] + nx * MID, az = a[1] + nz * MID, bx = b[0] + nx * MID, bz = b[1] + nz * MID;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 34) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      const pt = (s, o) => [ax + dx * s + nx * o, az + dz * s + nz * o];
      const ryF = Math.atan2(-dz, dx);                    // +x local le long de la courtine
      const sgn = (-dz) * nx + dx * nz > 0 ? 1 : -1;      // sens de l'extrusion vis-à-vis de l'intérieur
      const bins = { pierre: [], voute: [], dalle: [] };
      const mettre = (k, g) => bins[k].push(indexe(g));

      // Une travée n'est écartée que si une caserne mord vraiment dessus : on échantillonne
      // son emprise réelle — trois abscisses × trois profondeurs — et non son seul milieu.
      const nb = Math.max(2, Math.round(len / G.TRAVEE)), bw = len / nb;
      // ...ni si elle ne tient pas DERRIÈRE le mur. La galerie court sur toute la corde
      // S1→S2, mais au bout de la courtine le corps de place tourne vers le bastion : les
      // dernières travées de la courtine Anjou–Reine et les premières de Reine–Turenne
      // passaient au travers de l'escarpe et plantaient leurs piles dans l'eau du fossé,
      // dix mètres au-delà du mur. Une travée dont un point sort de l'arrière du rempart
      // (sdPent > −OFF0) est traitée comme une travée occupée.
      const derriereLeMur = (x, z) => sdPent(x, z) < -OFF0 + 0.3;
      const libre = (sc) => {
        for (const ds of [-0.5, -0.42, 0, 0.42, 0.5]) for (const o of [-G.DEPTH / 2, -G.DEPTH / 2 + 0.7, 0, G.DEPTH / 2 - 0.4]) {
          const [x, z] = pt(sc + ds * bw, o);
          if (!derriereLeMur(x, z)) { horsMur++; return false; }
          if (caserneIci(x, z, 0.9)) return false;
        }
        return true;
      };
      const bonne = [];
      for (let k = 0; k < nb; k++) bonne.push(libre((k + 0.5) * bw));

      // Chaque PALIER — suite ininterrompue de travées bâtissables — reçoit sa propre
      // rampe, prise sur ses premières travées. C'est ce qui change tout par rapport à
      // l'ancienne version : elle posait deux rampes aux bouts de la courtine, si bien
      // qu'un tronçon coincé entre deux casernes restait inaccessible.
      const arcade = bonne.slice();
      const paliers = [];
      for (let k = 0; k < nb; k++) {
        if (!bonne[k]) { sautees++; continue; }
        let j = k; while (j + 1 < nb && bonne[j + 1]) j++;
        paliers.push([k, j]); k = j;
      }
      for (const pl of paliers) {
        paliersN++;
        const [k0, k1] = pl, nBaies = k1 - k0 + 1;
        const nr = Math.min(Math.max(2, Math.ceil(G.RAMPE / bw)), nBaies - 1);
        if (nr < 2) { orphelins++; pl.push(k0, k1); continue; }   // trop court : arcade seule
        const auDebut = k0 === 0 || k1 !== nb - 1;
        const r0 = auDebut ? k0 : k1 - nr + 1, r1 = r0 + nr - 1;
        for (let k = r0; k <= r1; k++) arcade[k] = false;
        pl.push(auDebut ? r1 + 1 : k0, auDebut ? k1 : r0 - 1);    // bornes de l'arcade
        // la rampe : une tranchée dans le terre-plein, entre la courtine et un mur de
        // soutènement — pas un plan incliné posé sous la voûte
        const sPied = auDebut ? r0 * bw : (r1 + 1) * bw, sens = auDebut ? 1 : -1;
        const RL = nr * bw, ux = dx * sens, uz = dz * sens;
        const [px, pz] = pt(sPied, 0);
        addRamp(px, pz, ux, uz, RL, G.DEPTH - 1.4, 0, G.ROOF);
        const hyp = Math.hypot(RL, G.ROOF);
        const rm = new THREE.Mesh(new THREE.BoxGeometry(G.DEPTH - 1.4, 0.4, hyp), MATS.dalle);
        rm.position.set(px + ux * RL / 2, G.ROOF / 2 - 0.2, pz + uz * RL / 2);
        rm.rotation.order = 'YXZ';
        rm.rotation.y = Math.atan2(ux, uz);
        rm.rotation.x = -Math.atan2(G.ROOF, RL);
        rm.castShadow = rm.receiveShadow = true; scene.add(rm);
        const e0 = pt(sPied, G.DEPTH / 2), e1 = pt(sPied + sens * RL, G.DEPTH / 2);
        murPerce(e0, e1, G.ROOF);                  // couronnement compris : il suit les morceaux pleins
        rampes++;
      }

      // ---- les travées d'arcade ----
      const rad = Math.min(bw / 2 - 0.62, 3.6);
      for (let k = 0; k < nb; k++) {
        if (!arcade[k]) continue;
        travees++;
        const sc = (k + 0.5) * bw;
        // face d'arcade : un mur PERCÉ d'un plein cintre, pas un arc posé devant un mur —
        // c'est ce qui donne son épaisseur au tableau, et du jour au fond de la galerie
        const sh = new THREE.Shape();
        sh.moveTo(-bw / 2, 0); sh.lineTo(bw / 2, 0); sh.lineTo(bw / 2, G.ROOF - 0.15); sh.lineTo(-bw / 2, G.ROOF - 0.15); sh.closePath();
        const tr = new THREE.Path();
        tr.moveTo(-rad, 0); tr.lineTo(-rad, G.IMPOSTE);
        tr.absarc(0, G.IMPOSTE, rad, Math.PI, 0, true);
        tr.lineTo(rad, 0); tr.closePath();
        sh.holes.push(tr);
        const gf = new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false, curveSegments: 10 });
        gf.rotateY(ryF);
        { const [fx, fz] = pt(sc, G.DEPTH / 2 + (sgn > 0 ? -0.8 : 0)); gf.translate(fx, 0, fz); }
        mettre('pierre', gf);
        for (const sx of [-1, 1]) {
          if (sx > 0 && k < nb - 1 && arcade[k + 1]) continue;     // la pile est partagée
          const [px, pz] = pt(sc + sx * (bw / 2 - 0.35), G.DEPTH / 2 + 0.3);
          const g1 = new THREE.BoxGeometry(0.9, G.IMPOSTE + 0.5, 0.6);
          uvMeters(g1, 0.9, G.IMPOSTE + 0.5); g1.rotateY(ryF); g1.translate(px, (G.IMPOSTE + 0.5) / 2, pz);
          const g2 = new THREE.BoxGeometry(1.2, 0.32, 0.78);
          uvMeters(g2, 1.2, 0.32); g2.rotateY(ryF); g2.translate(px, G.IMPOSTE + 0.66, pz);
          mettre('pierre', g1); mettre('pierre', g2);
          const [qx, qz] = pt(sc + sx * bw / 2, G.DEPTH / 2);
          addCap(qx, qz, qx, qz, bw / 2 - rad, G.ROOF);
          // doubleau : l'arc de renfort du berceau, au droit de la pile — centré sur l'axe
          // de la galerie comme le berceau lui-même (cf. plus bas)
          const [ox, oz] = pt(sc + sx * bw / 2, 0);
          const gd = new THREE.TorusGeometry(G.VOUTE, 0.3, 6, 18, Math.PI);
          uvMeters(gd, Math.PI * G.VOUTE, TAU * 0.3);
          gd.rotateY(Math.atan2(-nz, nx));
          gd.translate(ox, G.ROOF - 0.35 - G.VOUTE, oz);
          mettre('voute', gd);
        }
      }

      // ---- terre-plein et berceau, palier par palier ----
      for (const [k0, k1, a0, a1] of paliers) {
        if (a1 < a0) continue;                       // palier entièrement occupé par sa rampe
        const ga = a0 * bw, gb = (a1 + 1) * bw, Lp = gb - ga, sm = (ga + gb) / 2;
        // le terre-plein marchable ne couvre QUE les travées d'arcade, là où il est dessiné.
        // Il couvrait tout le palier, rampe comprise : arrivé en haut, on continuait à
        // marcher à 6,90 m au-dessus de la tranchée de la rampe, sur rien (banc arpenteur).
        { const m0 = pt(ga, 0), m1 = pt(gb, 0);
          world.platforms.push({ seg: true, carre: true, ax: m0[0], az: m0[1], bx: m1[0], bz: m1[1], w: G.DEPTH, h: G.ROOF }); }
        // CENTRÉS SUR L'AXE DE LA GALERIE (décalage 0), pas sur sa face : berceau, dallage
        // et terre-plein étaient posés à G.DEPTH / 2, une demi-galerie trop en avant. La
        // moitié arrière, contre la courtine, restait sans voûte ni sol — les trous noirs vus
        // à travers les arcades, et Camille qui marchait sur un terre-plein invisible — et
        // l'autre moitié débordait de quatre mètres au-dessus de la place.
        // berceau plein cintre, axe parallèle à la courtine
        { const gv = new THREE.CylinderGeometry(G.VOUTE, G.VOUTE, Lp, 22, 1, true, 0, Math.PI);
          uvMeters(gv, Math.PI * G.VOUTE, Lp);
          gv.rotateZ(Math.PI / 2);
          const vm = new THREE.Mesh(gv, MATS.voute);
          const [vx, vz] = pt(sm, 0);
          vm.position.set(vx, G.ROOF - 0.35 - G.VOUTE, vz);
          vm.rotation.y = ryF; vm.receiveShadow = true; scene.add(vm); }
        // dallage de la galerie
        { const gd = new THREE.BoxGeometry(Lp, 0.12, G.DEPTH - 0.2);
          uvMeters(gd, Lp, G.DEPTH); gd.rotateY(ryF);
          const [px, pz] = pt(sm, 0); gd.translate(px, 0.06, pz);
          mettre('dalle', gd); }
        // terre-plein praticable, juste au-dessus de la clé du berceau
        { const gt = new THREE.BoxGeometry(Lp, 0.35, G.DEPTH);
          uvMeters(gt, Lp, G.DEPTH); gt.rotateY(ryF);
          const [px, pz] = pt(sm, 0); gt.translate(px, G.ROOF - 0.175, pz);
          mettre('dalle', gt); }
        const e0 = pt(ga, G.DEPTH / 2), e1 = pt(gb, G.DEPTH / 2);
        wallBox(e0[0], e0[1], e1[0], e1[1], 1.05, 0.45, stoneMat, G.ROOF, T.stone);
        // le parapet se saute : sa collision s'arrête à sa hauteur (1,05 m, sous les 1,35 m que
        // franchit le saut) — une limite à l'infini arrêtait Camille devant un muret « objectivement
        // franchissable » (Eugène, 30 septembre). Derrière, c'est la place, six mètres plus bas.
        const pc = addCap(e0[0], e0[1], e1[0], e1[1], 0.3, G.ROOF + 1.15); pc.bottom = G.ROOF - 0.9;
        wallBox(e0[0], e0[1], e1[0], e1[1], 0.35, 1.3, stoneMat, G.ROOF - 0.62, T.stone);  // corniche filante
      }
      for (const key of Object.keys(bins)) {
        if (!bins[key].length) continue;
        const m = new THREE.Mesh(mergeParts(bins[key]), MATS[key]);
        m.castShadow = m.receiveShadow = true; scene.add(m);
      }
    }
  }
  console.log('galeries : %d travées d\'arcade, %d sautées (casernes ou hors du mur, dont %d hors du mur), %d paliers de chemin de ronde, %d rampes, %d sans accès',
    travees, sautees, horsMur, paliersN, rampes, orphelins);
}

// ---------- montagnes tout autour de la plaine ----------

// La poterne relevée tombe à 16 m EN DEHORS de l'escarpe. Au 1/4,5 ça ne se voyait pas ;
// au 1:1 elle se retrouve dans le fossé, derrière une courtine pleine — donc injoignable
// depuis la place, et la galerie souterraine avec elle, c'est-à-dire la fin du jeu. On la
// ramène sur la face intérieure de la courtine la plus proche en suivant le gradient du
// champ de distance, ce qui conserve son azimut et ne suppose rien de la forme du tracé.
// DEMANDE À carte.js : POTERNE devrait valoir le point que cette fonction calcule (il est
// affiché dans la console au chargement), sinon la minimap de hud.js pointe le fossé.
export function poterneDansLaPlace() {
  const cible = -(WALL_T / 2 + GAL.DEPTH + 7);      // juste en avant de l'arcade
  const grad = (x, z) => {
    const e = 0.5;
    const gx = (sdPent(x + e, z) - sdPent(x - e, z)) / (2 * e);
    const gz = (sdPent(x, z + e) - sdPent(x, z - e)) / (2 * e);
    const L = Math.hypot(gx, gz) || 1;
    return [gx / L, gz / L];
  };
  // 1. on rentre le long de la normale, jusqu'à la bonne distance à l'escarpe
  let x = POTERNE.x, z = POTERNE.z;
  for (let k = 0; k < 12; k++) {
    const d = sdPent(x, z);
    if (d <= cible + 0.3) break;
    const [gx, gz] = grad(x, z);
    x -= gx * (d - cible); z -= gz * (d - cible);
  }
  // 2. si une caserne occupe la place, on glisse LE LONG du rempart — s'enfoncer
  //    davantage sortirait la poterne du rempart, ce qui n'aurait plus de sens.
  if (caserneIci(x, z, 5)) {
    const [gx, gz] = grad(x, z), tx = -gz, tz = gx;
    for (let d = 6; d <= 90; d += 6) for (const sg of [1, -1]) {
      const qx = x + tx * d * sg, qz = z + tz * d * sg;
      if (Math.abs(sdPent(qx, qz) - cible) < 9 && !caserneIci(qx, qz, 5)) return { x: qx, z: qz };
    }
  }
  return { x, z };
}

// Position effectivement bâtie (cf. poterneDansLaPlace). On ne l'ajoute pas à PARTAGE :
// etat.js est un fichier partagé, et rien d'un autre secteur n'en a besoin pour l'instant.
export let POTERNE_JEU = null;

export function buildPoterne() {
  const P = POTERNE_JEU = poterneDansLaPlace();
  console.log('poterne ramenée dans la place : (%s, %s) — relevé : (%s, %s)',
    P.x.toFixed(1), P.z.toFixed(1), POTERNE.x.toFixed(1), POTERNE.z.toFixed(1));
  const hut = new THREE.Mesh(rboxG(5, 4, 5, 0.2, 3), pbrRepeat(T.stone, 2.5, 2, { color: 0xa09888 })); hut.position.set(P.x, 2, P.z); hut.castShadow = hut.receiveShadow = true; scene.add(hut);
  { const pg = new THREE.Group(); scene.add(pg); const st = pbr(T.stone, { roughness: 0.85, color: 0xc8c0b0 });
    pg.add(mesh(rboxG(5.5, 0.5, 5.5, 0.08, 2), st, P.x, 0.25, P.z)); corniceAround(pg, P.x, 0.5, P.z, 2.75, 2.75, st, 0.18, 0.16, 'ovolo'); corniceAround(pg, P.x, 3.6, P.z, 2.5, 2.5, st, 0.4, 0.34, 'cyma');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const pl = pilaster(3.1, 0.18, st); pl.position.set(P.x + sx * 2.5, 0.5, P.z + sz * 2.5); pg.add(pl); }
    pg.add(mesh(new THREE.CylinderGeometry(3.9, 3.9, 0.35, 4), st, P.x, 4.15, P.z).rotateY(Math.PI / 4)); pg.add(mesh(new THREE.ConeGeometry(3.9, 2.4, 4), mat(0x3b4a5c), P.x, 5.5, P.z).rotateY(Math.PI / 4)); pg.add(mesh(sphG(0.22, 8), mat(0x2f3d4c), P.x, 6.75, P.z)); }
  // ouverture côté ouest : on découpe visuellement avec un cadre noir
  const dark = mesh(boxG(0.3, 3.2, 2.6), new THREE.MeshBasicMaterial({ color: 0x050508 }), P.x - 2.45, 1.6, P.z); scene.add(dark);
  const arch = mesh(new THREE.TorusGeometry(1.4, 0.25, 8, 16, Math.PI), stoneMat, P.x - 2.6, 2.6, P.z); arch.rotation.y = Math.PI / 2; scene.add(arch);
  for (const sg of [[P.x - 2.5, P.z - 2.5, P.x + 2.5, P.z - 2.5], [P.x - 2.5, P.z + 2.5, P.x + 2.5, P.z + 2.5], [P.x + 2.5, P.z - 2.5, P.x + 2.5, P.z + 2.5], [P.x - 2.5, P.z - 2.5, P.x - 2.5, P.z - 1.3], [P.x - 2.5, P.z + 1.3, P.x - 2.5, P.z + 2.5]]) addCap(sg[0], sg[1], sg[2], sg[3], 0.3, 6.5);
  addBox(P.x - 1.2, P.x + 2.5, P.z - 2.5, P.z + 2.5, 4); // intérieur plein (l'escalier descend "sous" le bâtiment)
  PARTAGE.poterneGrille = makeGrille(2.6, 3.0, 5); PARTAGE.poterneGrille.position.set(P.x - 2.6, 0, P.z); PARTAGE.poterneGrille.rotation.y = Math.PI / 2; scene.add(PARTAGE.poterneGrille);
  PARTAGE.poterneGrille.userData.cap = addCap(P.x - 2.6, P.z - 1.3, P.x - 2.6, P.z + 1.3, 0.2);
  for (const dz of [-1.8, 1.8]) { const t = makeTorch(); t.position.set(P.x - 2.9, 2.2, P.z + dz); if (dz > 0) t.remove(t.userData.light); else t.userData.light.intensity = 3; scene.add(t); }
  const sign = mesh(boxG(1.6, 0.5, 0.08), pbrRepeat(T.plank, 1, 1), P.x - 2.7, 3.6, P.z); sign.rotation.y = Math.PI / 2; scene.add(sign);
  addInteract({ pos: new THREE.Vector3(P.x - 3.6, 0, P.z), r: 2.2,
    prompt: () => state.galleryOpen ? 'descendre dans la galerie souterraine' : (state.key ? 'ouvrir la grille avec la clé du donjon' : 'grille verrouillée — il faut une clé'),
    fn: () => {
      if (state.galleryOpen) { goToLevel('cave', [0, 0, 0], 0, 'Descente dans les galeries de la citadelle…'); return; }
      if (!state.key) { showMessage("La grille est verrouillée. Lydéric parlait d'une clé gardée au sommet du donjon…", 4); SFX.hit(); return; }
      state.galleryOpen = true; SFX.pickup(); showMessage('La clé tourne dans la serrure : la grille de la galerie souterraine s\'ouvre en grinçant.', 4); saveGame(true);
    } });
}
// ---------- maison de Camille ----------

export function buildJumpStuff() {
  const crate = (x, z, y = 0, s = 1.2) => { const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), pbrRepeat(T.plank, 1, 1)); c.position.set(x, y + s / 2, z); c.rotation.y = rand(-0.2, 0.2); c.castShadow = c.receiveShadow = true; scene.add(c); addBox(x - s / 2, x + s / 2, z - s / 2, z + s / 2, y + s); };
  // Pile de caisses contre la caserne la plus au nord-est, gaufre au sommet, et Pralin sur
  // la caisse isolée. Les six positions étaient écrites en dur pour la carte au 1/4,5 :
  // elles tombaient au milieu de l'enclos du donjon, c'est-à-dire dans l'arène du boss.
  // On les déduit maintenant du bâti relevé, pour qu'elles suivent la carte.
  const [kx, kz] = piedDeCaserne((k) => k.c[0] - k.c[1], 3.4, 0.3) || [24, -22];
  crate(kx, kz); crate(kx + 1.3, kz); crate(kx, kz - 1.3); crate(kx + 1.3, kz - 1.3);
  crate(kx + 0.65, kz - 0.65, 1.2); crate(kx + 1.75, kz + 0.75, 0, 1.2);
  spawnGaufre(kx + 0.65, kz - 0.65);
  pickups[pickups.length - 1].mesh.position.y = 2.4 + 0.8;
  // Pralin, le chat de Cornélie, perché sur la caisse isolée (quête secondaire : il faut sauter)
  PARTAGE.pralin = makeCat(); PARTAGE.pralin.position.set(kx + 1.75, 1.2, kz + 0.75); PARTAGE.pralin.rotation.y = 2.4;
  PARTAGE.pralin.scale.setScalar(E.G.echelle); scene.add(PARTAGE.pralin);   // un chat reste un chat
  addInteract({ pos: PARTAGE.pralin.position, r: 2.3, enabled: () => !state.catFound, prompt: () => 'attraper le chat', fn: () => {
    if (Math.abs(player.pos.y - 1.2) > 1.0) { showMessage("Le chat est perché sur la caisse : saute (X) pour l'attraper.", 3); return; }
    state.catFound = true; SFX.pickup(); burst(PARTAGE.pralin.position.x, 2, PARTAGE.pralin.position.z, 0xffd070, 12, 3, 0.8, 4, 1);
    dialogue([{ who: 'Pralin', text: '« Miaou. »' }, { text: state.q_cat >= 1 ? "C'est bien Pralin, le chat de Cornélie ! Il file vers le village, la queue en l'air." : 'Un chat roux avec un collier gravé « Pralin »… Quelqu\'un doit le chercher au village. Il file vers le sud, la queue en l\'air.' }], () => {
      if (state.q_cat >= 1) setQuest('cat', 2); PARTAGE.pralin.position.set(...(([a, b]) => [a, TOWN.y, b])(townWorld(-8.6, -1.4))); PARTAGE.pralin.rotation.y = 1.2 + TOWN.a; saveGame(true); }); } });
  // Muret d'un mètre au bord de l'esplanade de manœuvre (il se saute), ouvert au milieu de
  // chaque côté. Il était calculé sur `R + (-22) / COS36`, c'est-à-dire sur le pentagone
  // RÉGULIER de secours — or R vaut maintenant 317 m, le rayon au saillant du tracé réel :
  // le muret sortait à 290 m du centre, loin hors des murs. Il se pose désormais sur le
  // pentagone de la place, comme l'esplanade qu'il borde.
  const bordPlace = pentPlace(PLACE_RUE1);
  for (let i = 0; i < bordPlace.length; i++) {
    const p1 = bordPlace[i], p2 = bordPlace[(i + 1) % bordPlace.length];
    for (const [t0, t1] of [[0.02, 0.40], [0.60, 0.98]]) {
      const q1 = [p1[0] + (p2[0] - p1[0]) * t0, p1[1] + (p2[1] - p1[1]) * t0], q2 = [p1[0] + (p2[0] - p1[0]) * t1, p1[1] + (p2[1] - p1[1]) * t1];
      if (surAxe((q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2, 2.5)) continue;   // l'axe royal passe ici
      wallBox(q1[0], q1[1], q2[0], q2[1], 1.0, 0.7, stoneMat, 0, T.stone);
      addCap(q1[0], q1[1], q2[0], q2[1], 0.35, 1.0);
      // dessus praticable : on ajoute une boîte fine
      const minx = Math.min(q1[0], q2[0]) - 0.35, maxx = Math.max(q1[0], q2[0]) + 0.35, minz = Math.min(q1[1], q2[1]) - 0.35, maxz = Math.max(q1[1], q2[1]) + 0.35;
      world.platforms.push({ seg: true, carre: true, ax: q1[0], az: q1[1], bx: q2[0], bz: q2[1], w: 0.7, h: 1.0, x0: minx, x1: maxx, z0: minz, z1: maxz });
    }
  }
}

// ---------- détails de décor : fleurs, roseaux, lierre, racines, puits, tonneaux, boulets ----------

// Rayon, depuis l'origine, où la distance signée au tracé vaut `cible`. L'ancienne
// formule extrapolait depuis sdPent(cos a, sin a) en supposant un pentagone RÉGULIER
// CENTRÉ sur l'origine : sur le relevé, dont le corps de place est centré en (4, 52), elle
// ramenait les mille huit cents roseaux dans un cercle de deux mètres autour du centre de
// la citadelle. Une dichotomie sur le champ de distance ne suppose rien, elle.
function rayonPour(a, cible) {
  const cx = Math.cos(a), cz = Math.sin(a);
  let lo = 0, hi = 700;
  for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (sdPent(cx * m, cz * m) < cible) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export function buildDetails() {
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
  // fleurs (4 couleurs, plans croisés instanciés)
  const flowerGeo = new THREE.PlaneGeometry(0.7, 0.7); flowerGeo.translate(0, 0.35, 0);
  for (let f = 0; f < 4; f++) {
    const fm = new THREE.MeshStandardMaterial({ map: flowerTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
    const N = 260, im = new THREE.InstancedMesh(flowerGeo, fm, N * 2); let n = 0;
    for (let i = 0; i < N; i++) {
      let x, z, sd, k = 0;
      // la troisième zone était la bande sd ∈ [-21, -3] : au 1:1 c'est exactement
      // l'emprise de l'arcade et du chemin de ronde. Les herbes folles vont désormais
      // dans la cour de service, entre le pied des casernes et la rue de ronde.
      do { x = rand(-MARCHE_R, MARCHE_R); z = rand(-MARCHE_R, MARCHE_R); sd = sdPent(x, z); k++; } while (k < 100 && !((sd > MOAT_OUT + 2 && Math.hypot(x, z) < MARCHE_R && !(Math.abs(x) < 9 && z > 0)) || (sd > FOSSE_IN + 1 && sd < MOAT_IN - 1) || (sd < -(WALL_T / 2 + GAL.DEPTH + 4) && sd > -(PLACE_RUE0 - 4))));
      if (bastionAt(x, z) || getH(x, z, 0) > 0.1 || nearHouse(x, z) || caserneIci(x, z, 2)) continue;
      const rot = rand(0, TAU), sc = rand(0.7, 1.2);
      const fy = solPlaine(x, z);
      for (const r of [0, Math.PI / 2]) { P.set(x, fy, z); Q.setFromEuler(E.set(0, rot + r, 0)); S.setScalar(sc); im.setMatrixAt(n++, M.compose(P, Q, S)); }
    }
    im.count = n; scene.add(im); perf.flowers.push(im);
  }
  // roseaux sur les berges (intérieure et extérieure)
  const reedGeo = new THREE.CylinderGeometry(0.02, 0.05, 2.2, 4); reedGeo.translate(0, 1.1, 0);
  const reedMat = mat(0x6a8a3a, { roughness: 1 });
  const REEDS = 1800;
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, REEDS); let rn = 0;
  // MOAT_IN et MOAT_OUT sont le fossé THÉORIQUE ; l'eau, elle, suit le relevé, qui s'en
  // écarte de plusieurs dizaines de mètres. Devant la Porte Royale, la rive est à z ≈ 250
  // quand MOAT_OUT tombe à z ≈ 205 : les tiges plantées sur le pentagone se dressaient à
  // quarante-cinq mètres du bord, en plein milieu des douves, de part et d'autre du pont.
  // On les tire donc sur le contour des nappes du fossé, et on ne garde que ce qui est
  // encore une berge pour l'union des eaux (nappeProche, carte.js) : là où deux relevés se
  // chevauchent, un contour court sous l'eau. Chercher la berge au hasard dans la largeur
  // du fossé coûtait 400 ms ; le contour, lui, est déjà la berge.
  const bords = []; let cumul = 0;
  for (const o of LILLE.eau) {
    if (o.sdMin > MOAT_OUT + 60) continue;
    for (let k = 0; k < o.poly.length; k++) {
      const p = o.poly[k], q = o.poly[(k + 1) % o.poly.length];
      cumul += Math.hypot(q[0] - p[0], q[1] - p[1]); bords.push([cumul, p, q]);
    }
  }
  for (let i = 0; i < REEDS && bords.length; i++) {
    for (let essai = 0; essai < 3; essai++) {
      const u = rand(0, cumul); let lo = 0, hi = bords.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (bords[m][0] < u) lo = m + 1; else hi = m; }
      const [, p, q] = bords[lo], t = Math.random();
      const x = p[0] + (q[0] - p[0]) * t + rand(-1.4, 1.4), z = p[1] + (q[1] - p[1]) * t + rand(-1.4, 1.4);
      if (Math.abs(x) < 9 && z > 0) continue;
      const e = nappeProche(x, z);
      if (!e || e.sd < -1.6 || e.sd > 1.2 || bastionAt(x, z)) continue;
      // le pied au fond près du bord, sur le terrain côté grève — jamais plus haut que l'eau
      P.set(x, Math.min(getH(x, z, 0), e.o.y) - 0.05, z); Q.setFromEuler(E.set(rand(-0.15, 0.15), rand(0, TAU), rand(-0.15, 0.15))); S.set(1, rand(0.6, 1.3), 1);
      reeds.setMatrixAt(rn++, M.compose(P, Q, S));
      break;
    }
  }
  reeds.count = rn; scene.add(reeds); perf.reeds = reeds; perf.reedsFull = rn;
  // nénuphars
  const padGeo = new THREE.CircleGeometry(0.45, 10); padGeo.rotateX(-Math.PI / 2);
  const pads = new THREE.InstancedMesh(padGeo, mat(0x3f7a3a, { roughness: 0.6 }), 160); let pn = 0;
  for (let i = 0; i < 160; i++) {
    const a = rand(0, TAU), edge = rand(MOAT_IN + 1.5, MOAT_OUT - 1.5);
    const rr = rayonPour(a, edge); const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.abs(x) < 9 && z > 0 || bastionAt(x, z)) continue;
    P.set(x, -1.27, z); Q.setFromEuler(E.set(0, rand(0, TAU), 0)); S.setScalar(rand(0.6, 1.3)); pads.setMatrixAt(pn++, M.compose(P, Q, S));
  }
  pads.count = pn; scene.add(pads);
  // Lierre sur la face EXTÉRIEURE des courtines — l'intérieur est désormais couvert par
  // l'arcade. Deux corrections d'échelle : la normale venait de `normals[]`, le tableau du
  // pentagone RÉGULIER, qui ne décrit plus le tracé (il faut `normale(i)`, calculée sur les
  // courtines relevées) ; et la courtine sautée était la n° 2, alors que sur le relevé
  // c'est `GATE_I` qui porte la Porte Royale. Six touffes par courtine sur 165 m ne se
  // voyaient pas : une tous les six mètres.
  const ivyGeo = new THREE.PlaneGeometry(2.6, 3.6);
  const ivy = new THREE.InstancedMesh(ivyGeo, new THREE.MeshStandardMaterial({ map: T.leaf[1], alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0x9ab080 }), 260); let vn = 0;
  for (let i = 0; i < bastions.length && vn < 260; i++) {
    if (i === GATE_I) continue;
    const a = bastions[i].S1, b = bastions[(i + 1) % bastions.length].S2;
    const [nx, nz] = normale(i);                       // sortante : côté fossé
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let k = 0; k < Math.round(L / 6) && vn < 260; k++) {
      const t = rand(0.06, 0.94);
      const x = a[0] + (b[0] - a[0]) * t + nx * (WALL_T / 2 - 0.1), z = a[1] + (b[1] - a[1]) * t + nz * (WALL_T / 2 - 0.1);
      P.set(x, rand(1.4, 5.2), z); Q.setFromEuler(E.set(0, Math.atan2(nx, nz), rand(-0.3, 0.3)));
      S.set(rand(0.8, 1.5), rand(0.8, 1.7), 1); ivy.setMatrixAt(vn++, M.compose(P, Q, S));
    }
  }
  ivy.count = vn; scene.add(ivy);
  // Le puits était posé en (10, 14) : au 1:1 c'est à l'intérieur de l'enclos du donjon,
  // c'est-à-dire dans l'arène du boss. Les puits sont maintenant répartis sur la rue de
  // ronde par buildPlaceDArmes(), un par quartier, comme il se doit sur un corps de place.
  // tonneaux et boulets sur les bastions et près des casernes
  const barrelGeo = new THREE.CylinderGeometry(0.5, 0.45, 1.2, 12), barrelMat = pbrRepeat(T.plank, 2, 1);
  const barrel = (x, z, y = 0) => { const bm = mesh(barrelGeo, barrelMat, x, y + 0.6, z); scene.add(bm); for (const yy of [0.25, 0.95]) scene.add(mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 14), IRON(), x, y + yy, z).rotateX(Math.PI / 2)); addCap(x, z, x, z, 0.55, y + 1.2); };
  for (const b of bastions) { const bx = b.V[0] + b.u[0] * 5 + b.v[0] * 5, bz = b.V[1] + b.u[1] * 5 + b.v[1] * 5; barrel(bx, bz, BAST_H); barrel(bx + 1.1, bz + 0.3, BAST_H);
    const px = b.V[0] + b.u[0] * 5 - b.v[0] * 5, pz = b.V[1] + b.u[1] * 5 - b.v[1] * 5;
    for (const [dx, dz, dy] of [[0, 0, 0], [0.6, 0, 0], [0.3, 0.55, 0], [0.3, 0.2, 0.5]]) scene.add(mesh(sphG(0.32, 10), IRON(), px + dx, BAST_H + 0.32 + dy, pz + dz)); }
  // les trois tonneaux « de la place » étaient eux aussi à des coordonnées de l'ancienne
  // carte, au milieu de nulle part : on les adosse aux casernes
  for (const [note, dec] of [[(k) => k.aire, 0.28], [(k) => -k.c[0], -0.3], [(k) => k.c[1], 0.34]]) {
    const q = piedDeCaserne(note, 2.4, dec);
    if (q) { barrel(q[0], q[1]); barrel(q[0] + 1.15, q[1] + 0.3); }
  }
  // racines des arbres : petits cônes au pied des troncs (via les capsules d'arbres)
  const rootGeo = new THREE.ConeGeometry(0.25, 1.4, 5); rootGeo.rotateX(Math.PI / 2); rootGeo.translate(0, 0, 0.7);
  const roots = new THREE.InstancedMesh(rootGeo, mat(0x5a3d22, { roughness: 1 }), 700); let rt = 0;
  for (const c of world.capsules) { if (rt > 690) break; if (c.r < 0.5 || c.r > 1.2 || c.ax !== c.bx || c.top !== Infinity || Math.random() > 0.25) continue; for (let k = 0; k < 4; k++) { const a = rand(0, TAU); P.set(c.ax, solPlaine(c.ax, c.az) + 0.05, c.az); Q.setFromEuler(E.set(0.35, a, 0, 'YXZ')); S.setScalar(c.r * 1.2); roots.setMatrixAt(rt++, M.compose(P, Q, S)); } }
  roots.count = rt; scene.add(roots); perf.roots = roots;
  // bannières sur la porte Royale
  for (const sx of [-1, 1]) { const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.2, 4, 6), mat(0xc22a2a, { side: THREE.DoubleSide })); ban.position.set(sx * (GATE_HW + 1.5), WALL_H + 2.2, APO + WALL_T / 2 + 0.8); ban.userData.flag = true; scene.add(ban); }
}

// =====================================================================
//  Village flamand (sud-est de la plaine) : rues pavées, maisons à pignons à redents, place, beffroi, marché, estaminet
// =====================================================================

// L'ACTE I DANS LA CITADELLE (étapes 9 et 10, docs/DECOUPAGE-ACTE1.md) : la place d'Armes habitée,
// l'armurerie et les bombes, les trois créatures et leurs clés, le donjon et Phinaert. quetes.js
// appelle ces deux crochets (à la fin de son populate et de son update) ; ce qui s'y écrit reste
// dans ce fichier.
//
// Ce qui tient d'une partie à l'autre est dans `state.a1c` (saveGame sérialise toute clé de
// state) : qui a parlé, la porte de l'armurerie, les créatures mortes, les clés ramassées, les
// cadenas, Phinaert. `state.bombes` et `state.nbBombes` : les bombes. On ne compte pas sur
// l'instantané des ennemis (engine.js le rend par indice, et nos créatures naissent après le
// chargement) : une créature morte ne renaît pas parce que `state.a1c.morts` le dit.
//
// Une ancienne sauvegarde (sans state.prologueFait) n'entre jamais ici : etapeActe1 rend null,
// et les dix monstres, la clé du donjon et le prince libéré restent ce qu'ils étaient.
const A1C = { pret: false, lieux: null, gens: {}, aFaire: [], cre: {}, cles: {}, bombes: [], crachats: [],
  decor: null, retires: false, vuNuit: false, msgT: 0, cloche: null, porteLumiere: null };
const a1 = () => etapeActe1(state);
const atteint = (e) => atteintActe1(state, e);
const A = () => (state.a1c = state.a1c || { morts: {}, cles: {}, clesPos: {}, cadenas: 0 });
const avancer = (e) => { if (passerActe1(state, e)) saveGame(true); };
// LA NUIT vient du lit de Camille (house.js, « jusqu'au soir » : state.nuit ; quetes.js peint la
// ville en nuit). Le Capitaine ne fait sa ronde que la nuit.
const deNuit = () => !!state.nuit;
const dit = (who, text, fn) => ({ who, text, fn });

// ---------- le bestiaire de l'acte : complète KINDS sans toucher à engine.js ----------
// La Moule-Reine ne bouge pas (elle trône dans le fossé), la Corbelle tourne trop haut pour
// voir Camille (aggro 0 : c'est nous qui la menons), la corde de la cloche est une « bête » pour
// que la visée de l'arc la trouve et qu'une flèche la coupe — la machine de l'arc, telle quelle.
Object.assign(KINDS, {
  mouleReine:    { hp: 8,  speed: 0,   dmg: 2, range: 3.2, aggro: 18, windup: 0.8, cd: 2.4, fly: 0,    r: 2.0, label: 'La Moule-Reine', barY: 4.4 },
  capitaine:     { hp: 10, speed: 3.6, dmg: 2, range: 2.6, aggro: 22, windup: 0.6, cd: 1.4, fly: 0.35, r: 0.8, label: 'Le Capitaine sans tête', barY: 4.6 },
  soldatRonde:   { hp: 4,  speed: 4.0, dmg: 1, range: 2.1, aggro: 18, windup: 0.5, cd: 1.3, fly: 0.35, r: 0.6, label: 'Soldat de la ronde', barY: 3.3 },
  corbelle:      { hp: 6,  speed: 0,   dmg: 2, range: 0,   aggro: 0,  windup: 1,   cd: 1,   fly: 15,   r: 1.7, label: 'La Grande Corbelle', barY: 2.8 },
  cordeCloche:   { hp: 2,  speed: 0,   dmg: 0, range: 0,   aggro: 0,  windup: 1,   cd: 1,   fly: 5,    r: 0.5, label: 'La corde de la cloche', barY: 1.2 },
});
Object.assign(BOURSE.PRIMES, { mouleReine: 20, capitaine: 20, corbelle: 20, soldatRonde: 3 });
// les gabarits : les bêtes de la maison, plus grandes, et le fantôme sans sa tête
const anime = (kind) => (e, dt, speed) => { animeCreature({ ...e, kind, state: e.ouverte ? 'windup' : e.state }, e.mesh, dt, speed); return true; };
setMaker('mouleReine', () => { const g = makeMoule(); g.scale.setScalar(2.6); g.userData.anim = true; return g; });
setMaker('corbelle', () => { const g = makeCorbeau(); g.scale.setScalar(3.2); g.userData.anim = true; return g; });
setMaker('soldatRonde', () => { const g = makeFantome(); g.userData.anim = true; return g; });
setMaker('capitaine', () => {
  const g = makeFantome(), habit = g.children.find((o) => o.isMesh && Math.abs(o.position.y - 1.72) < 0.01);
  // sans tête : on ôte le crâne, la mâchoire, les orbites, le tricorne — on garde le col
  for (const o of [...g.children]) if (o.isMesh && o.position.y > 2.1 && o.material !== (habit && habit.material)) g.remove(o);
  // une lueur froide au-dessus du col, là où devrait être la tête
  g.add(mesh(sphG(0.16, 10), new THREE.MeshBasicMaterial({ color: 0x8ab0ff, transparent: true, opacity: 0.55, depthWrite: false }), 0, 2.36, 0));
  g.scale.setScalar(1.45); g.userData.anim = true; return g;
});
setMaker('cordeCloche', () => { const g = new THREE.Group(); g.userData.dynamic = true; return g; });
setAnimHook('mouleReine', anime('moule'));
setAnimHook('corbelle', anime('corbeau'));
setAnimHook('soldatRonde', anime('fantome'));
setAnimHook('capitaine', anime('fantome'));

// ---------- où se joue l'acte ----------
function lieuxA1() {
  if (A1C.lieux) return A1C.lieux;
  const L = {}, P = POTERNE_JEU || POTERNE, dP = (k) => Math.hypot(k.c[0] - P.x, k.c[1] - P.z);
  // la caserne des soldats cachés : la plus proche de la poterne, par où Camille arrive
  let kS = null;
  for (const k of CASERNES) if (!k.bastion && k.aire > 300 && !surCouloirRampe(k.poly) && (!kS || dP(k) < dP(kS))) kS = k;
  L.caserne = facadePrincipale(kS.poly);
  // l'armurerie : le magasin du bastion du Roy (SCENARIO.md, « L'armurerie »), le plus grand des siens
  let kA = null;
  for (const k of CASERNES) if (k.bastion && /Ro[iy]/.test(k.bastion.name) && !surCouloirRampe(k.poly) && (!kA || k.aire > kA.aire)) kA = k;
  L.armurerie = { ...facadePrincipale(kA.poly), y: kA.base };
  // la pointe de Turenne : on ne marche que sur une bande du terre-plein, de l'arrivée de la rampe
  // vers le saillant, jusqu'aux pièces d'artillerie (sonde du 5 octobre : 117 cases sur 2 097, et
  // le saillant à 43 m de la dernière — hors de portée d'arc). On suit donc cette bande depuis la
  // rampe tant qu'elle est libre : là où elle s'arrête, Camille se tient (`pied`, où tombera la
  // clé), et la Corbelle tourne huit mètres plus loin vers la pointe.
  { const b = bastions.find((q) => /Turenne/.test(q.name)) || bastions[1];
    const s0 = (b.sPalier ?? 0) + 3, t0 = b.tRampe ?? 0, at = (s) => [b.V[0] + b.u[0] * s + b.v[0] * t0, b.V[1] + b.u[1] * s + b.v[1] * t0];
    let s = s0;
    while (s < s0 + 120) { const [x, z] = at(s + 1); if (!bastionAt(x, z) || E.blocked(x, z, 0.6, false, BAST_H + 0.1)) break; s += 1; }
    const [px, pz] = at(Math.max(s0, s - 2)), [cx, cz] = at(s + 8);
    L.corbelle = { x: cx, z: cz, R: 8, pied: [px, pz] }; }
  // le fossé de la Porte Royale : de l'eau franche à l'est du pont, à portée de bombe depuis le
  // tablier (ses parapets n'arrêtent ni bombe ni flèche) ; à quarante mètres de la porte, loin de
  // ses ouvrages — tout près, getH trouvait le dessus d'une maçonnerie et la Reine trônait à 3,5 m
  L.reine = { x: 11, z: APO + 40 };
  for (let z = APO + 34; z < APO + 70; z += 2) { if (sdEau(11, z) < -4 && getH(11, z) < -2.5) { L.reine = { x: 11, z }; break; } }
  // la ronde du Capitaine : le long de la courtine du nord-ouest, à 22 m en dedans — la rue du
  // rempart. À 12 m (là où l'ancienne histoire mettait ses fantômes), la ronde traversait une
  // caserne : la sonde du 5 octobre y trouve 134 m de rue droite joignable, de -62 à +70 m autour
  // du milieu de la courtine ; on en prend quarante, au milieu
  { const c = COURTINES[0], tx = -c.nz, tz = c.nx, d = 22, cx = c.mx - c.nx * d + tx * 4, cz = c.mz - c.nz * d + tz * 4;
    L.ronde = { a: [cx - tx * 20, cz - tz * 20], b: [cx + tx * 20, cz + tz * 20], x: cx, z: cz }; }
  // le donjon : la corde de la cloche pend le long de la face sud, à droite de la porte ; la
  // dalle (où s'ouvrira la porte de lumière) devant la porte ; Eugène, attaché à côté
  { const D = DONJON; L.corde = { x: D.x + 3.2, z: D.z + D.half + 0.9 }; L.dalle = { x: D.x, z: D.z + D.half + 9 };
    L.eugene = { x: D.x - 3.6, z: D.z + D.half + 2.2 }; L.tireur = { x: D.x + 6.4, z: D.z + D.half + 2.2 }; }   // à côté de la corde, pas devant : on la voit
  return (A1C.lieux = L);
}

// ---------- le décor de l'acte, posé au peuplement (avant la fusion : tout est mobile) ----------
const dyn = (o) => { o.userData.dynamic = true; return o; };
function decorA1() {
  const L = lieuxA1(), D = { };
  const bois = pbrRepeat(T.plank, 1, 1), fer = IRON();
  // la barricade de l'armurerie : des planches en croix sur la porte, et la poudre contre le mur
  { const f = L.armurerie, g = dyn(new THREE.Group()), y = f.y;
    g.position.set(f.x + f.nx * 0.35, y, f.z + f.nz * 0.35); g.rotation.y = Math.atan2(f.nx, f.nz); scene.add(g);
    for (const [r, h] of [[0.5, 2.0], [-0.5, 2.3], [0, 1.4], [0, 3.0]]) { const pl = mesh(boxG(r ? 3.0 : 2.6, 0.22, 0.08), bois, 0, h + 1.05, 0); pl.rotation.z = r; g.add(pl); }
    D.barricade = g;
    // trois tonneaux de poudre (deux empilés : à hauteur d'une flèche tirée droit)
    const t = new THREE.Group(), tg = new THREE.CylinderGeometry(0.5, 0.45, 1.2, 12), tm = pbrRepeat(T.plank, 2, 1, { color: 0x9a7048 });
    for (const [dx, dy] of [[0, 0], [0, 1.2], [1.05, 0]]) { t.add(mesh(tg, tm, dx, dy + 0.6, 0)); for (const yy of [0.25, 0.95]) t.add(mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 14), fer, dx, dy + yy, 0).rotateX(Math.PI / 2)); }
    const px = f.x + f.nx * 1.05 + f.ux * 2.6, pz = f.z + f.nz * 1.05 + f.uz * 2.6;   // contre le soubassement
    t.position.set(px, y, pz); dyn(t); scene.add(t); D.poudre = t; D.poudreP = { x: px, z: pz, y };
    D.poudreCap = addCap(px, pz, px + f.ux * 1.05, pz + f.uz * 1.05, 0.55, y + 2.4); }
  // les caisses derrière lesquelles se cachent les soldats
  { const f = L.caserne, cm = phMat('wood_cabinet_worn_long', 1, 1, { color: 0xb89a70 });
    for (const [s, d, h] of [[-2.6, 3.4, 0], [-1.5, 3.9, 0], [-1.9, 3.6, 1.0], [2.4, 3.5, 0], [3.3, 3.2, 0]]) {
      const x = f.x + f.ux * s + f.nx * d, z = f.z + f.uz * s + f.nz * d;
      const c = dyn(mesh(boxG(1.0, 1.0, 1.0), cm, x, getH(x, z) + h + 0.5, z)); c.rotation.y = Math.atan2(f.nx, f.nz) + s * 0.1; scene.add(c);
      if (!h) addCap(x, z, x, z, 0.6, getH(x, z) + 1.1);
    } }
  // les trois cadenas, accrochés à la grille du donjon (ils tournent avec elle)
  { const g = PARTAGE.donjonGate, laiton = GOLD(); D.cadenas = [];
    for (const dx of [1.6, 2.5, 3.4]) {
      const c = new THREE.Group(); c.add(mesh(boxG(0.34, 0.3, 0.14), laiton, 0, 0, 0));
      const anse = mesh(new THREE.TorusGeometry(0.11, 0.03, 6, 12, Math.PI), fer, 0, 0.15, 0); c.add(anse);
      // cachés d'abord : l'ancienne histoire ouvre cette grille au dixième monstre, sans cadenas
      c.position.set(dx, 1.3, 0.12); c.visible = false; g.add(c); D.cadenas.push(c); } }
  // la cloche du donjon : une potence de chêne au parapet sud, la cloche, la corde jusqu'au sol
  { const Dj = DONJON, H = Dj.h, cx = L.corde.x, cz = L.corde.z, g = dyn(new THREE.Group());
    const chene = pbrRepeat(T.plank, 1, 3, { color: 0x6a5038 });
    g.add(mesh(boxG(0.3, 3.6, 0.3), chene, cx, H + 1.8, Dj.z + Dj.half - 0.6));
    g.add(mesh(boxG(0.26, 0.26, 2.2), chene, cx, H + 3.5, Dj.z + Dj.half + 0.3));
    const joug = new THREE.Group(); joug.position.set(cx, H + 3.3, cz); g.add(joug);
    const bronze = phMat('metal_plate_02', 0.5, 0.5, { color: 0xb88a48, roughness: 0.42, metalness: 0.8 });
    const prof = [[0.05, 0], [0.32, -0.08], [0.4, -0.5], [0.52, -0.95], [0.62, -1.1], [0.6, -1.15]].map(([r, y]) => new THREE.Vector2(r, y));
    joug.add(mesh(new THREE.LatheGeometry(prof, 18), bronze, 0, 0, 0));
    scene.add(g); A1C.cloche = joug;
    const corde = mesh(new THREE.CylinderGeometry(0.045, 0.045, H + 2.0, 6), mat(0x8a7350, { roughness: 1 }), cx, (H + 2.2) / 2 + 0.2, cz);
    dyn(corde); scene.add(corde); D.corde = corde;
    const tas = dyn(mesh(new THREE.TorusGeometry(0.4, 0.07, 6, 16), mat(0x8a7350, { roughness: 1 }), cx + 0.6, getH(cx, cz) + 0.08, cz + 0.8));
    tas.rotation.x = Math.PI / 2; tas.visible = false; scene.add(tas); D.cordeTombee = tas; }
  // la dalle gravée devant le donjon, et la porte de lumière qui s'y ouvrira
  { const d = L.dalle, y = getH(d.x, d.z);
    const dalle = dyn(mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.16, 12), phMat('old_stone_wall_02', 3, 3, { color: 0xbab0a0 }), d.x, y + 0.08, d.z)); dalle.receiveShadow = true; scene.add(dalle);
    const lum = new THREE.Group(); lum.position.set(d.x, y + 0.16, d.z); dyn(lum);
    const voile = new THREE.MeshBasicMaterial({ color: 0xe6dcff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const halo = new THREE.MeshBasicMaterial({ color: 0xb8a0e0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    // à la taille de Phinaert (onze mètres) : à six, il y entrait plié en deux
    const arche = new THREE.Shape(); arche.moveTo(-3.6, 0); arche.lineTo(-3.6, 8.6); arche.absarc(0, 8.6, 3.6, Math.PI, 0, true); arche.lineTo(3.6, 0); arche.closePath();
    lum.add(new THREE.Mesh(new THREE.ShapeGeometry(arche, 12), voile));
    const ext = new THREE.Mesh(new THREE.ShapeGeometry(arche, 12), halo); ext.scale.set(1.35, 1.15, 1); ext.position.z = -0.02; lum.add(ext);
    lum.scale.set(1, 0.001, 1); lum.visible = false; scene.add(lum); A1C.porteLumiere = lum; }
  A1C.decor = D;
}

// ---------- les habitants de la place : nés après le chargement, un par image ----------
const NOMS_A1 = { caporal: 'le caporal', tambour: 'le tambour', vieux: 'le vieux soldat', armurier: 'l’armurier' };
function naitreA1() {
  const qui = A1C.aFaire.shift(), L = lieuxA1();
  let v = qui === 'caporal' ? PNJ.buildRole('houtland', 0x7a2a2a) : qui === 'tambour' ? PNJ.buildRole('prince', 0x2a3a6a)
    : qui === 'vieux' ? PNJ.buildVillageois(3) : PNJ.buildRole('aubergiste', 0x4a3b2c);
  v = v || makePrince();
  let x, z, yaw;
  if (qui === 'armurier') { const f = L.armurerie; x = f.x + f.nx * 1.8 - f.ux * 1.2; z = f.z + f.nz * 1.8 - f.uz * 1.2; yaw = Math.atan2(f.nx, f.nz); }
  else { const f = L.caserne, s = { caporal: 0, tambour: -1.7, vieux: 1.7 }[qui], d = qui === 'caporal' ? 1.9 : 1.4;
    x = f.x + f.ux * s + f.nx * d; z = f.z + f.uz * s + f.nz * d; yaw = Math.atan2(f.nx, f.nz); }
  v.position.set(x, getH(x, z, (qui === 'armurier' ? L.armurerie.y : 0) + 0.5), z); v.rotation.y = yaw; v.scale.setScalar(G.echelle);
  v.userData.dynamic = true; scene.add(v); A1C.gens[qui] = v; addCap(x, z, x, z, 0.4);
  if (qui === 'tambour') { const t = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.42, 14), mat(0xb02a2a, { roughness: 0.7 }), x + Math.cos(yaw) * 0.7, v.position.y + 0.21, z - Math.sin(yaw) * 0.7); dyn(t); scene.add(t); }
  addInteract({ pos: v.position, r: 2.6, enabled: () => v.visible && atteint('citadelle'), prompt: () => `parler ${NOMS_A1[qui].replace(/^le /, 'au ').replace(/^l’/, 'à l’')}`,
    fn: () => { v.rotation.y = Math.atan2(player.pos.x - v.position.x, player.pos.z - v.position.z); v.userData.talk = 4;
      dialogue(repliquesA1(qui), () => { v.userData.talk = 0; }); } });
}

// LES RÉPLIQUES (DIALOGUES-ACTE1.md, « La citadelle — les trois cadenas », mot pour mot ; le gras
// est celui du fichier, sauf ce qui promettrait une chose qui n'existe pas encore — dit en note)
function repliquesA1(qui) {
  const s = A();
  switch (qui) {
    case 'caporal':
      if (atteint('donjon')) return [dit('Le caporal', '« La grille ! **Le donjon est ouvert.** Va, on tient la place. »')];
      return [dit('Le caporal', '« Trois de ses créatures ont les clés des cadenas du donjon : **la Moule-Reine dans les fossés, le Capitaine sans tête sur les remparts, la Corbelle à la pointe de Turenne.** »', () => { s.caporal = true; saveGame(true); })];
    case 'tambour':
      return [dit('Le tambour', '« Le Capitaine, personne ne le voit. On l’entend marcher sur les remparts, **seulement la nuit**. **Avec de la lumière**, peut-être… »', () => { s.tambour = true; saveGame(true); })];
    case 'vieux':
      if (state.bombes) return [dit('Le vieux soldat', '« Des bombes ! Ne les lance pas trop près de toi, petite. J’ai vu des moustaches partir pour moins que ça. »')];
      if (s.vieux && state.bow) return [dit('Le vieux soldat', '« La porte est barricadée. Mais **il y a un tonneau de poudre contre le mur : une flèche, et boum.** »', () => { s.poudre = true; saveGame(true); })];
      return [dit('Le vieux soldat', '« La Moule, rien ne l’ouvre. Il faudrait des bombes. **L’armurier s’est barricadé dans l’armurerie**, avec toute sa réserve. »', () => { s.vieux = true; saveGame(true); })];
    case 'armurier':
      if (state.bombes) return [dit('L’armurier', '« Reviens quand tu veux, j’en fabrique. J’ai que ça à faire. »', () => {
        if ((state.nbBombes || 0) < 10) { state.nbBombes = 10; SFX.pickup(); showMessage('L’armurier remplit ton sac : 10 bombes.', 3); saveGame(true); } })];
      return [dit('L’armurier', '« Qui a fait sauter ma porte ? … La garde ! Enfin ! »'),
        dit('L’armurier', '« Prends ça. Les murs fendus cèdent à une bombe. Et **la coquille de la Reine** aussi, si tu la lances quand elle s’ouvre pour cracher. »', donnerBombes)];
  }
  return [dit('…', '« … »')];
}
function donnerBombes() {
  state.bombes = true; state.nbBombes = 10; avancer('bombes'); SFX.win(); saveGame(true);
  burst(player.pos.x, player.pos.y + 1.5, player.pos.z, 0xffe070, 24, 3, 1.2, 2, 1.2);
  showMessage('Les BOMBES ! Touche V pour en lancer une, devant toi. L’armurier en refait quand le sac est vide.', 7);
}

// ---------- les bombes (touche V) ----------
let GB = null;
function lancerBombe() {
  if (!a1() || !state.bombes || cut.active || player.sleeping > 0) return;
  if ((state.nbBombes || 0) <= 0) { showMessage('Plus de bombes. L’armurier en refait, sur le bastion du Roy.', 3); return; }
  state.nbBombes--;
  GB = GB || { g: sphG(0.27, 12), m: phMat('metal_plate_02', 0.4, 0.4, { color: 0x2a2a2e, roughness: 0.5, metalness: 0.7 }), f: new THREE.MeshBasicMaterial({ color: 0xffb040 }) };
  const b = new THREE.Group(); b.add(new THREE.Mesh(GB.g, GB.m)); b.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 5), mat(0x6a5a40), 0, 0.32, 0));
  const etin = new THREE.Mesh(sphG(0.06, 6), GB.f); etin.position.y = 0.42; b.add(etin); dyn(b); scene.add(b);
  const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
  A1C.bombes.push({ m: b, etin, x: player.pos.x + s * 0.8, y: player.pos.y + 1.5, z: player.pos.z + c * 0.8, vx: s * 9.5, vz: c * 9.5, vy: 6, t: 0 });
  SFX.roll();
}
TOUCHES.KeyV = lancerBombe;
function exploser(x, y, z) {
  SFX.stomp(); G.shake = Math.max(G.shake, Math.max(0.2, 0.9 - Math.hypot(player.pos.x - x, player.pos.z - z) / 30));
  burst(x, y + 0.4, z, 0xffa040, 36, 7, 0.7, 6, 1.6); burst(x, y + 0.8, z, 0x4a4440, 18, 3, 1.6, -1, 2.4);
  for (const e of enemies) {
    if (e.dead || e.caged) continue;
    const d = Math.hypot(e.pos.x - x, e.pos.z - z);
    if (d > 3.6 + e.k.r || y < e.pos.y - 2.5 || y > e.pos.y + e.k.barY + 2.5) continue;   // tout le corps de la bête, pas ses pieds
    if (e.a1 === 'reine') {
      if (e.ouverte || e.fendue) { if (!e.fendue) { e.fendue = true; showMessage('La coquille se fend ! Encore une bombe, ou deux.', 3.5); } hitEnemy(e, 3, x, z); }
      else showMessage('La coquille a tenu. Attends qu’elle s’ouvre pour cracher.', 3.5);
    } else hitEnemy(e, 3, x, z);
  }
  if (Math.hypot(player.pos.x - x, player.pos.z - z) < 2.6 && Math.abs(player.pos.y - y) < 2) damagePlayer(2, x, z);
  const P = A1C.decor && A1C.decor.poudreP;
  if (P && !A().porte && Math.hypot(P.x - x, P.z - z) < 3.5) sauterPorte();
}
function bombesTick(dt) {
  for (let i = A1C.bombes.length - 1; i >= 0; i--) {
    const b = A1C.bombes[i]; b.t += dt;
    b.vy -= 14 * dt;
    const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
    // un mur l'arrête, pas une main courante : à plus d'un mètre du sol, elle passe par-dessus
    // (le garde-corps du pont la renvoyait aux pieds de Camille)
    if (b.y < getH(nx, nz, b.y) + 1.1 && E.blocked(nx, nz, 0.2, true, b.y)) { b.vx *= -0.25; b.vz *= -0.25; } else { b.x = nx; b.z = nz; }
    b.y += b.vy * dt;
    // l'eau d'un fossé porte la bombe à sa surface (elle grésille, elle n'y coule pas)
    const sol = Math.max(getH(b.x, b.z, b.y + 0.3), sdEau(b.x, b.z) < -1 ? EAU_Y : -99);
    if (b.y < sol + 0.27) { b.y = sol + 0.27; b.vy = Math.abs(b.vy) > 3 ? -b.vy * 0.3 : 0; b.vx *= 0.55; b.vz *= 0.55; }
    b.m.position.set(b.x, b.y - 0.1, b.z); b.etin.visible = (b.t * 12 | 0) % 2 === 0;
    // lancée dans la coquille ouverte, elle y éclate : la mèche (1,8 s) dure plus que l'ouverture
    const R = A1C.cre.reine;
    if (R && !R.dead && R.ouverte && Math.hypot(R.pos.x - b.x, R.pos.z - b.z) < R.k.r + 0.9) b.t = 9;
    if (b.t > 1.8) { scene.remove(b.m); A1C.bombes.splice(i, 1); exploser(b.x, b.y, b.z); }
  }
}

// ---------- l'armurerie : une flèche dans la poudre ----------
function sauterPorte() {
  const s = A(); if (s.porte) return;
  s.porte = true; saveGame(true);
  const P = A1C.decor.poudreP;
  SFX.stomp(); SFX.roar(); G.shake = 1.2;
  burst(P.x, P.y + 1, P.z, 0xffa040, 60, 9, 0.9, 7, 2.2); burst(P.x, P.y + 1.5, P.z, 0x3a3430, 30, 4, 2.2, -1, 3);
  setTimeout(() => {
    if (!A1C.gens.armurier) return;
    const v = A1C.gens.armurier; v.visible = true; v.userData.talk = 3;
    dialogue([dit('L’armurier', '« Qui a fait sauter ma porte ? … La garde ! Enfin ! »')], () => { v.userData.talk = 0; showMessage('Parle à l’armurier (Entrée).', 3); });
  }, 1400);
}
function poudreTick() {
  const D = A1C.decor, s = A();
  D.barricade.visible = D.poudre.visible = !s.porte; D.poudreCap.r = s.porte ? 0 : 0.55;
  if (A1C.gens.armurier) A1C.gens.armurier.visible = !!s.porte;
  if (s.porte) return;
  // la flèche est cherchée ici, après qu'engine.js l'a fait voler : sans collision sur le tonneau
  // (l'arc ne s'arrêterait pas assez tôt pour qu'on la voie), on prend celle qui le traverse
  const P = D.poudreP;
  for (let i = arrows.length - 1; i >= 0; i--) {
    const p = arrows[i].mesh.position;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 1.4 && p.y > P.y - 0.2 && p.y < P.y + 2.6) { scene.remove(arrows[i].mesh); arrows.splice(i, 1); sauterPorte(); return; }
  }
}

// ---------- les trois créatures ----------
function naitreCreature(qui) {
  const L = lieuxA1();
  let e;
  if (qui === 'reine') {
    const fond = getH(L.reine.x, L.reine.z, EAU_Y);
    e = spawnEnemy('mouleReine', L.reine.x, L.reine.z, 'fosses', fond);
    // à demi sortie de l'eau, quelle que soit la profondeur du fossé. La hauteur est tenue ici
    // (creaturesTick) : engine.js pose toute bête volante (fly > 1) sur un sol à 0 au moins, et la
    // Reine flottait à 3,5 m au-dessus de l'eau
    e.k = { ...e.k, fly: 0.5 }; e.flotte = EAU_Y - 0.6; e.cycle = 0;
  } else if (qui === 'corbelle') {
    e = spawnEnemy('corbelle', L.corbelle.x + L.corbelle.R, L.corbelle.z, 'bastions');
    e.k = { ...e.k }; e.ang = 0; e.pique = 0; e.prochain = 6;
  } else if (qui === 'capitaine') {
    e = spawnEnemy('capitaine', L.ronde.x, L.ronde.z, 'remparts');
    A1C.ronde = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, s = spawnEnemy('soldatRonde', L.ronde.x + Math.cos(a) * 5, L.ronde.z + Math.sin(a) * 5, 'remparts'); s.a1 = 'soldat'; A1C.ronde.push(s); }
    e.parle = false;
  }
  e.a1 = qui; A1C.cre[qui] = e;
}
function creaturesTick(dt) {
  const s = A(), L = lieuxA1();
  for (const qui of ['reine', 'corbelle', 'capitaine']) {
    if (s.morts[qui] || A1C.cre[qui]) continue;
    // le Capitaine ne sort que la nuit, et ne se voit qu'à la lanterne (STORY.md, « La nuit »)
    if (qui === 'capitaine' && !(deNuit() && state.lanterne)) {
      if (!A1C.vuNuit && s.tambour && Math.hypot(player.pos.x - L.ronde.x, player.pos.z - L.ronde.z) < 30) { A1C.vuNuit = true; showMessage('Personne sur la ronde. Le tambour l’a dit : seulement la nuit.', 4); }
      continue;
    }
    naitreCreature(qui); return;   // une par image
  }
  // la Moule-Reine : fermée, rien ne la blesse ; elle s'ouvre pour cracher, et c'est le moment
  { const e = A1C.cre.reine;
    if (e && !e.dead) {
      e.pos.y = e.flotte; e.mesh.position.y = e.flotte;
      if (!e.fendue && e.hp < e.k.hp) { e.hp = e.k.hp; if (A1C.msgT <= 0) { A1C.msgT = 4; showMessage('La coquille est trop dure. Il faudrait des bombes.', 3); } }
      const d = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
      e.cycle += dt;
      if (e.ouverte) {
        if (!e.crache && e.cycle > 0.6) { e.crache = true; cracher(e); }
        if (e.cycle > 2.2) { e.ouverte = false; e.cycle = 0; }
      } else if (d < 24 && e.cycle > 3.0) { e.ouverte = true; e.crache = false; e.cycle = 0; }
    } }
  // la Grande Corbelle tourne au-dessus de la pointe ; toutes les six secondes, elle pique
  { const e = A1C.cre.corbelle;
    if (e && !e.dead) {
      const C = L.corbelle, d = Math.hypot(player.pos.x - C.x, player.pos.z - C.z);
      if (e.pique > 0) {
        e.pique += dt; const t = e.pique;
        const cible = e.cible, haut = 15;
        if (t < 1.3) { const k = t / 1.3; e.pos.x = lerp(e.depart.x, cible.x, k); e.pos.z = lerp(e.depart.z, cible.z, k); e.k.fly = lerp(haut, 1.6, k * k); }
        else if (t < 1.6) { if (!e.frappe && Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < 2.2) { e.frappe = true; damagePlayer(e.k.dmg, e.pos.x, e.pos.z); } }
        else if (t < 3.0) { const k = (t - 1.6) / 1.4; e.k.fly = lerp(1.6, haut, k); }
        else { e.pique = 0; e.prochain = 6 + Math.random() * 2; }
      } else {
        e.ang += dt * 0.25; e.pos.x = C.x + Math.cos(e.ang) * C.R; e.pos.z = C.z + Math.sin(e.ang) * C.R; e.k.fly = 15;
        e.yaw = Math.atan2(-Math.sin(e.ang), Math.cos(e.ang));
        if (d < 24 && (e.prochain -= dt) <= 0) { e.pique = 0.001; e.frappe = false; e.depart = { x: e.pos.x, z: e.pos.z }; e.cible = { x: player.pos.x, z: player.pos.z }; SFX.roar(); }
      }
      e.state = 'idle'; e.target = null; e.t = 9;
    } }
  // le Capitaine : sa ronde le long de la courtine, et ses mots quand la lanterne le trouve
  { const e = A1C.cre.capitaine;
    if (e && !e.dead) {
      if (e.state === 'idle') { const k = 0.5 + 0.5 * Math.sin(state.time * 0.12); e.home.set(lerp(L.ronde.a[0], L.ronde.b[0], k), e.home.y, lerp(L.ronde.a[1], L.ronde.b[1], k)); }
      if (!e.parle && Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < 20 && !cut.active) {
        e.parle = true;
        dialogue([dit('Le Capitaine sans tête', '« Qui marche sur ma ronde ? … Une lumière. Je n’aime pas la lumière. »')]);
      }
    } }
  // les crachats de la Reine
  for (let i = A1C.crachats.length - 1; i >= 0; i--) {
    const c = A1C.crachats[i]; c.t += dt;
    c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt;
    const p = c.m.position;
    if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 1.0 && Math.abs(player.pos.y + 1 - p.y) < 1.3) { damagePlayer(1, p.x, p.z); c.t = 99; }
    if (c.t > 2.4) { burst(p.x, p.y, p.z, 0x8ab0c8, 6, 2, 0.4); scene.remove(c.m); A1C.crachats.splice(i, 1); }
  }
}
let GC = null;
function cracher(e) {
  GC = GC || { g: sphG(0.3, 10), m: new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.2, transparent: true, opacity: 0.8 }) };
  const m = dyn(new THREE.Mesh(GC.g, GC.m)), y0 = e.pos.y + 1.6;
  m.position.set(e.pos.x, y0, e.pos.z); scene.add(m);
  const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z, dy = player.pos.y + 1 - y0, d = Math.hypot(dx, dz, dy) || 1;
  A1C.crachats.push({ m, t: 0, vx: dx / d * 13, vy: dy / d * 13, vz: dz / d * 13 });
  SFX.hit();
}

// une créature tombée lâche sa clé ; ramassée, la clé vient avec un billet d'Eugène
const BILLETS = {
  reine: '« Il dit que Lydéric l’a vaincu, avant. Avant quoi ? »',
  capitaine: '« Il parle d’une tour. Il dit qu’il aura besoin de quelqu’un pour sonner. »',
  corbelle: '« Il m’a demandé si tu étais courageuse. J’ai dit oui. Il a eu l’air content. Je n’aurais pas dû. »',
};
const NOM_CLE = { reine: 'la clé de la Moule-Reine', capitaine: 'la clé du Capitaine', corbelle: 'la clé de la Corbelle' };
let GK = null;
function poserCle(qui, x, z) {
  if (A1C.cles[qui]) return;
  GK = GK || GOLD();
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 14), GK, 0, 0.42, 0));
  g.add(mesh(boxG(0.07, 0.5, 0.07), GK, 0, 0.05, 0));
  g.add(mesh(boxG(0.18, 0.06, 0.07), GK, 0.08, -0.12, 0)); g.add(mesh(boxG(0.14, 0.06, 0.07), GK, 0.06, 0.0, 0));
  dyn(g); g.scale.setScalar(1.5);
  const y = getH(x, z, 40);
  g.position.set(x, y + 1.1, z); scene.add(g);
  A1C.cles[qui] = { m: g, x, z, y };
}
function clesTick(dt) {
  const s = A();
  for (const qui of ['reine', 'capitaine', 'corbelle']) if (s.morts[qui] && !s.cles[qui] && !A1C.cles[qui] && s.clesPos[qui]) poserCle(qui, ...s.clesPos[qui]);
  for (const [qui, k] of Object.entries(A1C.cles)) {
    if (s.cles[qui]) { if (k.m.parent) scene.remove(k.m); continue; }
    k.m.rotation.y += dt * 2; k.m.position.y = k.y + 1.1 + Math.sin(state.time * 2.5) * 0.15;
    if (!cut.active && Math.hypot(player.pos.x - k.x, player.pos.z - k.z) < 1.8 && Math.abs(player.pos.y - k.y) < 2.2) {
      s.cles[qui] = true; scene.remove(k.m); SFX.pickup(); setTimeout(() => SFX.win(), 200); saveGame(true);
      burst(k.x, k.y + 1.2, k.z, 0xffe070, 20, 3, 1, 2, 1.2);
      const n = Object.keys(s.cles).length;
      dialogue([{ text: `Tu as ${NOM_CLE[qui]} ! (${n}/3) Un billet est roulé autour.` }, dit('Billet d’Eugène', BILLETS[qui])],
        () => showMessage(n === 3 ? 'Les trois clés ! La grille du donjon, au centre de la place.' : `Encore ${3 - n} clé${3 - n > 1 ? 's' : ''} pour les cadenas du donjon.`, 4));
    }
  }
}

// ---------- la grille du donjon : trois cadenas ----------
function ouvrirCadenas() {
  const s = A(), n = Object.keys(s.cles).length;
  if (n <= s.cadenas) { showMessage(s.cadenas ? `Encore ${3 - s.cadenas} cadenas. Leurs clés sont aux créatures de Phinaert.` : 'Trois cadenas ferment la grille. Leurs clés sont aux créatures de Phinaert.', 4); SFX.hit(); return; }
  s.cadenas = n; SFX.pickup(); saveGame(true);
  if (s.cadenas < 3) { showMessage(`La clé tourne : un cadenas tombe. Encore ${3 - s.cadenas}.`, 3.5); return; }
  avancer('donjon');
  cutscene([
    { cam: [DONJON.x + 10, 4, DONJON.gateZ + 12], at: [DONJON.x, 2, DONJON.gateZ], dur: 3, text: 'Le dernier cadenas tombe. La grille du donjon s’ouvre.', fn: () => { SFX.roar(); ouvrirGrille(); G.shake = 0.8; } },
  ], () => showMessage('Phinaert est dans l’enclos. Eugène aussi.', 4));
}
function ouvrirGrille() {
  state.gateOpen = true; const g = PARTAGE.donjonGate.userData; g.open = true; g.cap.r = 0;
}

// ---------- Phinaert (étape 10) ----------
// Il ne meurt pas à l'acte I (STORY.md : « il part avant de pouvoir être vaincu »). À mi-vie il
// va sonner la cloche du donjon : le sol tremble, et on coupe la corde à l'arc. À un quart, il
// s'arrête, pose la main d'Eugène sur la dalle, et la porte de lumière s'ouvre.
const boss = () => enemies.find((e) => e.k.boss) || A1C.bossHors;
// Hors de la liste, engine.js ne l'anime plus : on rend aussi sa teinte, sinon le rouge d'un coup
// reçu à l'instant de sortir lui restait (updateEnemy l'efface d'habitude à l'image suivante)
function sortir(e) {
  const i = enemies.indexOf(e); if (i < 0) return;
  enemies.splice(i, 1); A1C.bossHors = e; e.bar.visible = false; e.flash = 0;
  e.mesh.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && o.material.userData.em !== undefined) o.material.emissive.setHex(o.material.userData.em); });
}
function rentrer(e) { if (!enemies.includes(e)) enemies.push(e); A1C.bossHors = null; }
function phinaertTick(dt) {
  const s = A(), e = boss(), L = lieuxA1();
  // Eugène, attaché devant le donjon, tant que Phinaert ne l'a pas emmené
  const eu = PARTAGE.prince;
  if (eu && !state.princeFreed && !A1C.eugeneJoue) {
    eu.visible = !s.parti; if (eu.visible) { eu.scale.setScalar(G.echelle); eu.position.set(L.eugene.x, getH(L.eugene.x, L.eugene.z), L.eugene.z); eu.rotation.y = 0; }
  }
  if (!e) return;
  // pendant la fin, hors de la liste des ennemis : c'est nous qui l'animons
  if (A1C.finJoue && !s.parti) { e.state = 'idle'; animeCreature(e, e.mesh, dt, e.mesh.userData.walkTo ? 3 : 0); return; }
  if (s.parti) { if (enemies.includes(e)) sortir(e); e.mesh.visible = false; e.caged = true; return; }
  if (!atteint('donjon')) { e.caged = true; return; }
  if (!state.gateOpen) ouvrirGrille();
  const dans = Math.abs(player.pos.x - DONJON.x) < DONJON.fence && player.pos.z > DONJON.z - DONJON.fence && player.pos.z < DONJON.gateZ - 1;
  if (!s.vu) {
    e.caged = true;
    if (dans && !cut.active) { s.vu = true; saveGame(true);
      cutscene([
        { cam: [DONJON.x + 8, 3, DONJON.gateZ - 6], at: [e.pos.x, 7, e.pos.z], dur: 2.5, title: 'PHINAERT', sub: 'le Maître du Temps', fn: () => SFX.roar() },
        { say: '« La petite de la garde. Tu as fait vite. Plus vite que je ne pensais. »', who: 'Phinaert' },
      ], () => { e.caged = false; e.state = 'chase'; showMessage('Esquive son onde de choc avec une roulade (Maj) ou saute par-dessus (Espace) !', 5); }); }
    return;
  }
  // la cloche : de mi-vie jusqu'à ce que la corde soit coupée
  if (!s.cloche && (A1C.sonne || (e.hp <= e.k.hp / 2 && dans))) { clocheTick(e, dt); return; }
  if (!s.cloche) return;
  if (e.hp <= e.k.hp / 4 && dans && !cut.active) finPhinaert(e);
}
function clocheTick(e, dt) {
  const L = lieuxA1();
  if (!A1C.sonne) {
    A1C.sonne = { t: 0, coup: 0.5 }; e.caged = true; sortir(e);
    // la corde devient une cible pour l'arc (KINDS.cordeCloche)
    const c = spawnEnemy('cordeCloche', L.corde.x, L.corde.z, 'donjon'); c.a1 = 'corde'; A1C.corde = c;
    cutscene([
      { cam: [L.tireur.x + 9, 5, L.tireur.z + 12], at: [L.corde.x, 9, L.corde.z], dur: 2.2, actor: e.mesh, to: [L.tireur.x, L.tireur.z], speed: 6 },
      { say: '« Écoute. Une cloche, ça ne sert qu’à une chose. »', who: 'Phinaert', cam: [L.tireur.x + 7, 4, L.tireur.z + 10], at: [L.corde.x, 12, L.corde.z] },
    ], () => showMessage('La cloche fait trembler le sol ! Saute les ondes (Espace) et coupe la corde à l’arc (C).', 6));
    return;
  }
  const S = A1C.sonne; S.t += dt;
  // il tire la corde : on le tient là, face au donjon, le bras levé
  if (!cut.active) { e.pos.set(L.tireur.x, getH(L.tireur.x, L.tireur.z), L.tireur.z); e.mesh.position.copy(e.pos); }
  e.yaw = Math.PI; e.mesh.rotation.y = Math.PI; e.state = Math.sin(S.t * 3) > 0 ? 'windup' : 'cool'; animeCreature(e, e.mesh, dt, 0);
  if (A1C.cloche) A1C.cloche.rotation.z = Math.sin(S.t * 3) * 0.55;
  if (!cut.active && (S.coup -= dt) <= 0) {
    S.coup = 1.9; SFX.stomp(); G.shake = Math.max(G.shake, 0.5);
    const y = getH(L.corde.x, L.dalle.z), rm = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    rm.rotation.x = -Math.PI / 2; rm.position.set(L.corde.x, y + 0.15, L.dalle.z - 4); scene.add(rm);
    shockwaves.push({ x: L.corde.x, z: L.dalle.z - 4, y, r: 2, t: 0, hit: false, mesh: rm });
  }
}
function cordeCoupee() {
  const s = A(), e = A1C.bossHors, D = A1C.decor;
  s.cloche = true; saveGame(true); A1C.sonne = null;
  D.corde.visible = false; D.cordeTombee.visible = true; if (A1C.cloche) A1C.cloche.rotation.z = 0;
  burst(D.corde.position.x, 5, D.corde.position.z, 0xd8c098, 14, 3, 0.8);
  showMessage('La corde tombe. La cloche se tait.', 3.5);
  if (e) { rentrer(e); e.caged = false; e.state = 'chase'; }
}
function finPhinaert(e) {
  A1C.finJoue = true; e.caged = true; sortir(e);
  const L = lieuxA1(), s = A(), eu = PARTAGE.prince, lum = A1C.porteLumiere, d = L.dalle;
  A1C.eugeneJoue = true;
  cutscene([
    { say: '« Assez. Tu m’es plus utile debout. »', who: 'Phinaert', cam: [d.x + 10, 4, d.z + 12], at: [e.pos.x, 7, e.pos.z] },
    { cam: [d.x + 11, 5, d.z + 9], at: [d.x, 3, d.z - 2], dur: 3, actor: e.mesh, to: [d.x + 2.5, d.z - 1.5], speed: 5, text: 'Phinaert va prendre Eugène.' },
    { cam: [d.x + 9, 3, d.z + 7], at: [d.x, 2, d.z], dur: 2.6, actor: eu, to: [d.x - 0.8, d.z], speed: 2.2 },
    { say: '« Le sang de Lydéric. Il fallait bien qu’il serve à quelque chose. »', who: 'Phinaert', cam: [d.x - 6, 2.4, d.z + 6], at: [d.x, 1.4, d.z] },
    { cam: [d.x + 8, 3, d.z + 10], at: [d.x, 3, d.z], dur: 3.2, shake: 0.6, text: 'La dalle s’illumine. Une porte de lumière s’ouvre dans la pierre.', fn: () => { SFX.roar(); lum.visible = true; A1C.lumT = 0; } },
    { cam: [d.x + 6, 3, d.z + 10], at: [d.x, 3, d.z], dur: 3.4, text: 'Phinaert y entre, et il emmène Eugène.', fn: () => { e.mesh.userData.walkTo = { x: d.x, z: d.z, speed: 3 }; if (eu) eu.userData.walkTo = { x: d.x, z: d.z, speed: 3 }; A1C.entrent = true; } },
  ], () => {
    e.mesh.visible = false; if (eu) eu.visible = false; A1C.entrent = false; s.parti = true; saveGame(true);
    showMessage('Suis-les : la porte de lumière, devant le donjon (Entrée).', 6);
  });
}
function lumiereTick(dt) {
  const s = A(), lum = A1C.porteLumiere; if (!lum) return;
  if (s.parti) lum.visible = true;
  if (!lum.visible) return;
  A1C.lumT = (A1C.lumT ?? 1) + dt;
  lum.scale.y = Math.min(1, Math.max(0.001, A1C.lumT / 1.6));
  lum.children[0].material.opacity = 0.7 + Math.sin(state.time * 2.2) * 0.12;
  lum.rotation.y = Math.atan2(player.pos.x - lum.position.x, player.pos.z - lum.position.z);
  // pendant qu'ils y entrent : on les fait avancer (cutTick ne mène que l'acteur de l'étape)
  if (A1C.entrent) { const e = A1C.bossHors, eu = PARTAGE.prince;
    for (const a of [e && e.mesh, eu]) if (a && a.userData.walkTo) E.actorWalk(a, dt);
    for (const a of [e && e.mesh, eu]) if (a && Math.hypot(a.position.x - lum.position.x, a.position.z - lum.position.z) < 0.8) a.visible = false; }
}

// ---------- l'objectif du journal et le point d'or ----------
// quetes.js (suiteActe1) ne connaît pas la citadelle : on lui donne ce qu'il faut dire ici
function objectifA1() {
  if (!atteint('citadelle')) return null;
  const s = A(), L = lieuxA1(), pt = (o) => ({ x: o.x, z: o.z });
  if (s.parti) return ['Suis Phinaert dans la porte de lumière, devant le donjon', pt(L.dalle)];
  if (atteint('donjon')) return ['Affronte Phinaert dans l’enclos du donjon', pt(L.dalle)];
  if (!s.caporal) return ['Des soldats se cachent devant une caserne, près de la poterne : parle-leur', pt(L.caserne)];
  if (!state.bombes) {
    if (s.porte) return ['Parle à l’armurier, sur le bastion du Roy', pt(L.armurerie)];
    if (s.poudre) return ['Une flèche dans le tonneau de poudre de l’armurerie (bastion du Roy)', pt(L.armurerie)];
    if (s.vieux) return ['L’armurier s’est barricadé dans l’armurerie, sur le bastion du Roy', pt(L.armurerie)];
    return ['Demande au vieux soldat comment ouvrir la Moule-Reine', pt(L.caserne)];
  }
  const reste = ['reine', 'capitaine', 'corbelle'].filter((q) => !s.cles[q]), n = 3 - reste.length;
  if (!reste.length) return ['Ouvre les trois cadenas de la grille du donjon', { x: DONJON.x, z: DONJON.gateZ }];
  // il ne reste que le Capitaine, et il fait jour : la nuit se prend dans son lit
  if (reste.length === 1 && reste[0] === 'capitaine' && !deNuit()) return ['Le Capitaine ne sort que la nuit : dors chez toi jusqu’au soir, puis va sur les remparts de l’ouest avec la lanterne', { x: HOUSE.x, z: HOUSE.z }];
  const ou = { reine: [L.reine, 'la Moule-Reine (le fossé, devant la Porte Royale)'], capitaine: [L.ronde, 'le Capitaine sans tête (les remparts de l’ouest, la nuit)'], corbelle: [L.corbelle, 'la Grande Corbelle (la pointe de Turenne)'] };
  const proche = reste.map((q) => ou[q]).sort((a, b) => Math.hypot(a[0].x - player.pos.x, a[0].z - player.pos.z) - Math.hypot(b[0].x - player.pos.x, b[0].z - player.pos.z))[0];
  return [`Les clés des cadenas (${n}/3) : ${reste.map((q) => ou[q][1]).join(' ; ')}`, pt(proche[0])];
}

// ---------- les trois crochets : peupler, faire vivre, et la mise à terre ----------
// Les dix monstres de l'ancienne histoire (fossés, remparts, bastions) n'ont pas leur place dans
// l'acte I : la grille du donjon y tombe aux cadenas, pas au dixième monstre. On les retire du
// jeu — l'indice des ennemis reste le même à la sauvegarde et au chargement (on les retire AVANT
// que loadGame relise l'instantané, en lisant la sauvegarde nous-mêmes) ; les corbeaux du champ
// d'Émile restent, c'est une quête du bourg.
function retirerAnciens() {
  if (A1C.retires) return;
  A1C.retires = true;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.k.boss || e.zone === 'champ' || e.a1) continue;
    scene.remove(e.mesh); scene.remove(e.bar); enemies.splice(i, 1);
  }
}
export const ACTE1_CITADELLE = {
  populate() {
    // une partie de l'acte I qu'on reprend : on le sait avant loadGame (cf. retirerAnciens)
    let sv = null; try { sv = readSave(); } catch (e) {}
    const reprise = sessionStorage.getItem('tloc_auto') !== 'new' && sv && sv.flags && sv.flags.prologueFait;
    if (reprise) retirerAnciens();
    decorA1();
    addInteract({ pos: new THREE.Vector3(DONJON.x, 0, DONJON.gateZ + 1.6), r: 3,
      enabled: () => atteint('citadelle') && !state.gateOpen,
      prompt: () => { const s = A(), n = Object.keys(s.cles).length; return n > s.cadenas ? 'ouvrir les cadenas de la grille' : `trois cadenas — ${s.cadenas}/3 ouverts`; },
      fn: ouvrirCadenas });
    addInteract({ pos: new THREE.Vector3(lieuxA1().dalle.x, 0, lieuxA1().dalle.z), r: 3,
      enabled: () => !!(state.a1c && state.a1c.parti),
      prompt: () => 'suivre Phinaert dans la lumière',
      fn: () => { avancer('temple'); saveGame(true); goToLevel('temple', [0, 0, 23.5], Math.PI, 'Camille passe la porte de lumière…'); } });
    // (la passerelle qui enveloppait onKill, objective et counts du niveau est partie le 6 octobre :
    // quetes.js et hud.js appellent maintenant onKill, objectif et bandeau d'ici)
  },
  update(dt) {
    if (!a1()) return;
    retirerAnciens();
    if (!atteint('citadelle')) return;
    // Camille est sortie des galeries par la poterne : la grille en reste levée
    if (!state.galleryOpen) { state.galleryOpen = true; saveGame(true); }
    if (!A1C.pret) { A1C.pret = true; A1C.aFaire = ['caporal', 'tambour', 'vieux', 'armurier']; }
    if (A1C.aFaire.length) naitreA1();
    const c = E.camera.position;
    for (const v of Object.values(A1C.gens)) if (v.visible && Math.abs(v.position.x - c.x) + Math.abs(v.position.z - c.z) < 60) PNJ.animeVillageois(v, dt, false);
    A1C.msgT -= dt;
    poudreTick();
    if (state.bombes) { if (!AIDE.extra.some((x) => x[0] === 'V')) AIDE.extra.push(['V', 'lancer une bombe']); }
    bombesTick(dt);
    creaturesTick(dt);
    clesTick(dt);
    { const n = A().cadenas; A1C.decor.cadenas.forEach((p, i) => { p.visible = i >= n; }); }
    phinaertTick(dt);
    lumiereTick(dt);
    if (!cut.active) { const o = objectifA1(); if (o) PARTAGE.repere = o[1]; }
  },
  // vrai si la mise à terre est de l'acte I (et donc traitée ici)
  onKill(e) {
    if (!e.a1 || !a1()) return false;
    BOURSE.prime(e);
    const s = A();
    if (e.a1 === 'corde') { cordeCoupee(); return true; }
    if (e.a1 === 'soldat') return true;
    s.morts[e.a1] = true;
    // la clé tombe là où la bête est tombée ; celle de la Corbelle, là où Camille se tenait sous elle
    const L = lieuxA1(), p = e.a1 === 'corbelle' ? L.corbelle.pied : e.a1 === 'reine' ? cleDeLaReine() : [e.pos.x, e.pos.z];
    s.clesPos[e.a1] = p; saveGame(true);
    if (e.a1 === 'capitaine') for (const x of A1C.ronde || []) if (!x.dead) hitEnemy(x, 99, x.pos.x, x.pos.z);
    setTimeout(() => poserCle(e.a1, ...p), 700);
    showMessage({ reine: 'La Moule-Reine coule. Quelque chose brille sur la berge.', capitaine: 'Le Capitaine se défait en fumée. Sa ronde avec lui.', corbelle: 'La Corbelle tombe sur la pointe du bastion.' }[e.a1], 4);
    return true;
  },
  objectif: objectifA1,
  lieux: lieuxA1,   // pour les bancs (bancs/acte1-citadelle.mjs)
  // le bandeau du haut de l'écran (hud.js, counts) pendant les étapes de la citadelle : les clés
  // des cadenas et les bombes au lieu des dix monstres de l'ancienne histoire ; null avant
  bandeau() {
    const o = objectifA1(); if (!o) return null;
    const s = A(), n = Object.keys(s.cles).length;
    return `Clés des cadenas <b>${atteint('donjon') ? 3 : n}</b> / 3 &nbsp; ` + (state.bow ? 'Arc ✓ &nbsp; ' : '') +
      (state.bombes ? `Bombes <b>${state.nbBombes || 0}</b> &nbsp; ` : '') +
      `Lieux <b>${lieux.filter((l) => E.estDecouvert(l.id)).length}</b> / ${lieux.length}` +
      `<br><small>Objectif : ${o[0]}</small>` + BOURSE.ligneHUD();
  },
};
// la clé de la Reine ne peut pas rester au fond du fossé : on la pose sur le pont, au bout du
// tablier le plus proche (le pont est à x = 0, ses parapets à ±3 m)
function cleDeLaReine() { const L = lieuxA1(); return [1.6, L.reine.z]; }
