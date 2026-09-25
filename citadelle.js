// citadelle.js — la place forte.
//
// Secteur Citadelle : courtines, bastions, Porte Royale, casernes, galeries voûtées,
// donjon, poterne. Le tracé vient de carte.js, jamais l'inverse.
import * as E from './engine.js?v=27';
import {
  THREE, GOLD, IRON, Q, SFX, T, TAU, addBox, addCap, addHelix, addInteract, addLieu, addPlatform,
  addRamp, archWindow, boxG, brickMat, brickScaled, burst, corniceAround, dialogue, distSeg, dormer,
  extrudeMesh, flatMesh, getH, goToLevel, lieux, makeCat, makeChest, makeGrille, makeTorch, mat,
  mergeParts, mesh, mouldingRun, pbr, pbrRepeat, phMat, pickups, pilaster, player, pointInPoly, rand,
  rboxG, saveGame, scene, setQuest, showMessage, sky, spawnGaufre, sphG, state, stoneMat, uvMeters,
  wallBox, world, etape,
} from './engine.js?v=27';
import {
  APO, BAST_H, COBBLE_M, COS36, COURTINES, DONJON, FOSSE_IN, GATE_HW, GATE_I, HOUSE, MARCHE_R,
  FERME, MOAT_IN, MOAT_OUT, PLAINE_R, PONT_LONG, PONT_Z1, POTERNE, R, TOWN, TRACE, WALL_H, WALL_T, bastionAt, bastions, eauMat, placerRampes, townWorld,
  cobbles, cuireRelief, maillagePlaine, nearHouse, normale, normals, offsetPoly, patinerMat,
  disqueTrace, pentShape, placerButtes, polyShape, sdPent, solPlaine, tapisForestier,
} from './carte.js';
import { makeDoor } from './menuiserie.js';
import { carteForet } from './foret.js';
import { PARTAGE } from './etat.js';
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
    const bx = c.bx, bz = c.bz, top = c.top;
    c.bx = A[0]; c.bz = A[1];
    addCap(B[0], B[1], bx, bz, c.r, top);
    if (c.r >= 3) {
      // COURTINE : la gorge du bastion EST la ligne de courtine, et la courtine fait onze
      // mètres d'épaisseur. La rampe monte donc DANS le mur, comme dans le vrai ouvrage
      // où elle débouche sur le terre-plein. On efface le tronçon sur la largeur de la
      // rampe. Rien ne s'ouvre vers le fossé pour autant : derrière, c'est le terre-plein
      // du bastion, trois mètres de terre pleine.
      // (Un plafond à BAST_H ne suffisait pas : la rampe traverse les cinq derniers
      // mètres du mur à 2,4 m de haut, sous le plafond, donc toujours bloquée.)
      addCap(A[0], A[1], B[0], B[1], c.r, 0.35);
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

function poserRampes() {
  const terre = pbrRepeat(T.dirt, 4, 2);
  let perces = 0, gardes = 0, restent = 0;
  for (const b of bastions) {
    const bl = percerCouloir(b);
    perces += bl.courtines; gardes += bl.gardeCorps; restent += bl.restent;
    const rl = b.rampLen, hyp = Math.hypot(rl, BAST_H), W = b.demiRampe * 2;
    const sMid = b.sShoulder - rl / 2;
    const cx = b.V[0] + b.u[0] * sMid + b.v[0] * b.tRampe;
    const cz = b.V[1] + b.u[1] * sMid + b.v[1] * b.tRampe;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, hyp), terre);
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
      wallBox(a[0], a[1], q[0], q[1], BAST_H + 0.2, 0.5, stoneMat, -1.4, T.stone);
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
      const pal = new THREE.Mesh(new THREE.BoxGeometry(Wp, BAST_H - 0.01 - bas, Lp + 0.6), terre);
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
      addCap(a[0], a[1], JAMB, APO, WALL_T / 2, WALL_H + 1.4);
      addCap(-JAMB, APO, b[0], b[1], WALL_T / 2, WALL_H + 1.4);
      for (const sx of [-1, 1]) {
        const px = sx * (GATE_HW + 2.6);
        addCap(px, APO - WALL_T / 2 + 0.6, px, APO + WALL_T / 2 - 0.6, 2.4, WALL_H + 1.4);
      }
    } else {
      wallBox(a[0], a[1], b[0], b[1], WALL_H, WALL_T, brickMat, 0, 'church_bricks_03');
      addCap(a[0], a[1], b[0], b[1], WALL_T / 2, WALL_H + 1.4);
    }
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
    // herse relevée, dans sa rainure — celle dont parle la cinématique
    { const hz = APO - WALL_T / 2 + 0.9, iron = IRON();
      for (const sx of [-1, 1]) scene.add(mesh(boxG(0.55, SPR + R0, 0.4), pierre, sx * (R0 - 0.1), (SPR + R0) / 2, hz));
      for (let k = 0; k < 11; k++) {
        const x = -R0 + 0.55 + k * (R0 * 2 - 1.1) / 10;
        scene.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 6.0, 7), iron, x, 14.3, hz));
        scene.add(mesh(new THREE.ConeGeometry(0.2, 0.55, 6), iron, x, 11.0, hz).rotateZ(Math.PI));
      }
      for (const y of [11.9, 14.3, 16.9]) scene.add(mesh(boxG(R0 * 2 - 0.8, 0.3, 0.3), iron, 0, y, hz));
    }
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
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, bridgeLen), pbrRepeat(T.bark, 2, 8, { color: 0xb08a5a }));
  bridge.position.set(0, 0, APO + WALL_T / 2 + bridgeLen / 2 - 1); bridge.receiveShadow = true; bridge.castShadow = true; scene.add(bridge);
  for (const sx of [-1, 1]) {
    for (let k = 0; k <= 6; k++) { const post = mesh(boxG(0.3, 1.3, 0.3), mat(0x5a3d22), sx * 3.8, 0.85, APO + 2.5 + k * (bridgeLen - 2) / 6); scene.add(post); }
    const rail = mesh(boxG(0.18, 0.18, bridgeLen), mat(0x5a3d22), sx * 3.8, 1.4, bridge.position.z); scene.add(rail);
    addCap(sx * 3.8, APO + 2, sx * 3.8, PONT_Z1, 0.3);
  }
  // piliers du pont dans l'eau
  for (let k = 1; k < 4; k++) for (const sx of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 8), mat(0x4a3520), sx * 3, -1.2, APO + 6 + k * 6); scene.add(p); }
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
  PARTAGE.donjonGate = makeGrille(5, 2.8, 8); PARTAGE.donjonGate.position.set(cx, 0, gz); scene.add(PARTAGE.donjonGate);
  PARTAGE.donjonGate.userData.cap = addCap(cx - 2.5, gz, cx + 2.5, gz, 0.2, 2.8);
  PARTAGE.donjonGate.userData.open = false;
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

  // Façade principale : la plus longue arête qui regarde la place — ou la direction
  // imposée par `opt.regard`, quand le bâtiment a une orientation voulue (corps de garde).
  const c = CENTRE(p);
  const vers = opt.regard || [PLACE_C[0] - c[0], PLACE_C[1] - c[1]];
  const vl = Math.hypot(vers[0], vers[1]) || 1;
  let principale = 0, meilleur = -1e9;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 4.5) continue;
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
    const note = L * 0.25 + 30 * (nx * vers[0] + nz * vers[1]) / vl;
    if (note > meilleur) { meilleur = note; principale = i; }
  }

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
        wallBox(e0[0], e0[1], e1[0], e1[1], G.ROOF, 0.8, brickMat, 0, 'church_bricks_03');
        wallBox(e0[0], e0[1], e1[0], e1[1], 0.4, 1.3, stoneMat, G.ROOF, T.stone);
        addCap(e0[0], e0[1], e1[0], e1[1], 0.45, G.ROOF + 0.4);
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
          world.platforms.push({ seg: true, ax: m0[0], az: m0[1], bx: m1[0], bz: m1[1], w: G.DEPTH, h: G.ROOF }); }
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
        const pc = addCap(e0[0], e0[1], e1[0], e1[1], 0.3, Infinity); pc.bottom = G.ROOF - 0.9;
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
      world.platforms.push({ seg: true, ax: q1[0], az: q1[1], bx: q2[0], bz: q2[1], w: 0.7, h: 1.0, x0: minx, x1: maxx, z0: minz, z1: maxz });
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
  for (let i = 0; i < REEDS; i++) {
    const a = rand(0, TAU), edge = Math.random() < 0.5 ? MOAT_IN - rand(0.3, 1.4) : MOAT_OUT + rand(0.3, 1.4);
    const rr = rayonPour(a, edge);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.abs(x) < 9 && z > 0) continue;
    if (bastionAt(x, z)) continue;
    P.set(x, getH(x, z, 0) > 0.1 ? 3 : (sdPent(x, z) > MOAT_IN && sdPent(x, z) < MOAT_OUT ? -1.3 : 0), z); Q.setFromEuler(E.set(rand(-0.15, 0.15), rand(0, TAU), rand(-0.15, 0.15))); S.set(1, rand(0.6, 1.3), 1);
    reeds.setMatrixAt(rn++, M.compose(P, Q, S));
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
