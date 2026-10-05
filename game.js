// The Legend of Camille — niveau 1 : la citadelle de Lille
import * as E from './engine.js?v=41';
import * as PNJ from './pnj.js';
import * as FORET from './foret.js';
import {
  THREE, Q, T, blocked, bootLevel, camera, lerpAngle, makeSky, rand, scene, showMessage, state,
} from './engine.js?v=41';
import {
  APO, DEHORS, DONJON, ECH, HOUSE, HOUSE_SMOKE_TOP, MAGE, MOAT_IN, MOAT_OUT, MOUNDS, PONT_Z1, POTERNE,
  TOWN, bastions, haiesIGN, levelBlocked, levelH, nappesLille, pontsLille, sdEau, sdPent, solVille, terrassesDehors,
  voiriesLille,
  zoneName, ambiance,
} from './carte.js';
import { PARTAGE } from './etat.js';
import { CLOUD_X, perf } from './nature.js';
import { buildCitadel } from './citadelle.js';
import { batirQuartier, rempartsVille } from './quartier.js';
import { entreeDuParc, voieDesCombattants } from './promenade.js';
import { debut, objective, onKill, onLoad, populate, update } from './quetes.js';
import { counts, minimap, titleMenu } from './hud.js';
// Ce qu'anime la boucle : drapeaux, nuages, fumées, flammes. On parcourait toute la scène
// — 6 693 objets — à CHAQUE image pour en trouver quelques dizaines (4 ms mesurées). La liste
// est tenue à part et refaite toutes les 120 images, de quoi attraper ce qui apparaît en jeu.
let ANIMES = [], avantRecens = 0;
function animes() {
  if (--avantRecens > 0) return ANIMES;
  avantRecens = 120; ANIMES = [];
  scene.traverse(o => { const u = o.userData; if (u.flag || u.cloud || u.smoke !== undefined || u.flame) ANIMES.push(o); });
  return ANIMES;
}
function animate(now, dt) {
  if (PARTAGE.windmillBlades) PARTAGE.windmillBlades.rotation.z += dt * 0.6;
  if (PARTAGE.fontaineEau) { const n = PARTAGE.fontaineEau.material.normalMap; n.offset.x += dt * 0.026; n.offset.y += dt * 0.017; }
  for (const bd of PARTAGE.skyBirds) { const u = bd.userData; u.a += u.spd * dt; bd.position.set(u.cx + Math.cos(u.a) * u.r, u.h + Math.sin(u.a * 3) * 2, u.cz + Math.sin(u.a) * u.r); bd.rotation.y = -u.a; const f = Math.sin(now / 90 + u.a) * 0.5; u.w1.rotation.z = f; u.w2.rotation.z = -f; }
  for (const v of PARTAGE.villagers) {
    const ud = v.userData; ud.anim += dt;
    let marche = false;
    if (ud.route && !(ud.talk > 0)) {
      if (ud.pause > 0) ud.pause -= dt;
      else {
        const tgt = ud.route[ud.wp], dx = tgt.x - v.position.x, dz = tgt.z - v.position.z, d = Math.hypot(dx, dz);
        if (d < 0.6) { ud.wp = (ud.wp + 1) % ud.route.length; ud.pause = rand(1, 4); }
        else {
          // Les villageois avançaient en ligne droite, sans rien tester : ils traversaient les
          // murs et pataugeaient dans la fontaine. On passe par le même blocked() que Camille,
          // avec glissement sur un axe, et on abandonne le point de passage si on reste coincé.
          const sp = 1.6, nx = dx / d * sp * dt, nz = dz / d * sp * dt, RV = 0.5, px = v.position.x, pz = v.position.z;
          if (!blocked(px + nx, pz + nz, RV, false, 0.8)) { v.position.x = px + nx; v.position.z = pz + nz; marche = true; }
          else if (!blocked(px + nx, pz, RV, false, 0.8)) { v.position.x = px + nx; marche = true; }
          else if (!blocked(px, pz + nz, RV, false, 0.8)) { v.position.z = pz + nz; marche = true; }
          else { ud.bloque = (ud.bloque || 0) + dt; }
          if (marche) ud.bloque = 0;
          if ((ud.bloque || 0) > 0.8) { ud.wp = (ud.wp + 1) % ud.route.length; ud.pause = rand(0.3, 1); ud.bloque = 0; }
          if (marche) v.rotation.y = lerpAngle(v.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-6 * dt));
        }
      }
    }
    if (ud.talk > 0) ud.talk -= dt;
    if (PNJ.animeVillageois(v, dt, marche)) continue;      // riggé : le mixer fait tout
    // repli procédural
    v.position.y = Math.sin(ud.anim * 1.6) * 0.03;
    if (marche) {
      const sw = Math.sin(ud.anim * 7) * 0.55; ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw;
      ud.legs[0].userData.knee.rotation.x = Math.max(0, sw); ud.legs[1].userData.knee.rotation.x = Math.max(0, -sw);
      ud.arms[0].rotation.x = -sw * 0.5; ud.arms[1].rotation.x = sw * 0.5; continue;
    }
    if (ud.pause > 0 && ud.legs) ud.legs[0].rotation.x = ud.legs[1].rotation.x = 0;
    ud.arms[0].rotation.x = Math.sin(ud.anim * 1.6) * 0.12; ud.arms[1].rotation.x = -Math.sin(ud.anim * 1.6) * 0.12;
    if (ud.talk > 0) { ud.head.rotation.y = Math.sin(ud.anim * 6) * 0.2; ud.arms[1].rotation.x = -0.9 + Math.sin(ud.anim * 8) * 0.3; }
    else ud.head.rotation.y = Math.sin(ud.anim * 0.5) * 0.3;
  }
  animes().forEach(o => { if (o.userData.flag) o.rotation.y = Math.sin(now / 400) * 0.25; if (o.userData.cloud) { o.position.x += o.userData.cloud * dt; if (o.position.x > CLOUD_X) o.position.x = -CLOUD_X; } if (o.userData.smoke !== undefined) { o.position.y += dt * 0.6; o.position.x += Math.sin(now / 700 + o.userData.smoke) * dt * 0.3; if (o.position.y > (o.userData.smokeTop ?? HOUSE_SMOKE_TOP)) o.position.y = o.userData.smokeBase ?? 7.4; }
    if (o.userData.flame) { o.userData.flame.scale.y = 1.4 + Math.sin(now / 60 + o.userData.seed) * 0.3; o.userData.light.intensity = o.userData.light.userData.base ?? (o.userData.light.userData.base = o.userData.light.intensity); o.userData.light.intensity *= 0.85 + Math.sin(now / 45 + o.userData.seed) * 0.15; } });
  for (const f of PARTAGE.follets) { const u = f.userData.follet; u.a += dt * u.v;
    f.position.set(MAGE.x + Math.cos(u.a) * u.r, u.h + Math.sin(now / 900 + u.a * 3) * 0.5, MAGE.z + Math.sin(u.a * 1.27) * u.r);
    f.material.opacity = 0.5 + Math.sin(now / 300 + u.a) * 0.35; }
  T.waterN.offset.x += dt * 0.015; T.waterN.offset.y += dt * 0.01;
}
// L'ARÈNE du multi (5 octobre) : où l'on se bat à plusieurs dans ce lieu. tloc-multi.js la lit
// au lieu de supposer la citadelle ; un autre lieu jouable à plusieurs déclarera la sienne dans
// son propre fichier, sous la même forme (docs/NOTE-MULTI.md, « Les arènes »).
// Les aires vont de la plus large à la plus étroite, mesurées par `sd` (négatif dedans) depuis
// `centre` : la manche part de la première et s'y resserre.
// À Lille, toute la partie se joue DANS LA CITADELLE (Eugène, 5 octobre). « Toute la
// châtellenie » (1,6 × 2 km) éparpillait les joueurs ; le parc et le bourg (1,4 km de large)
// n'y changeaient rien au banc des rencontres. La citadelle fait 530 × 500 m. Le bourg, sa
// forge, les chevaux du moulin et du mage et l'arc de la chapelle sortent du multi.
const ARENE_LILLE = {
  id: 'lille', nom: 'La citadelle de Lille',
  sd: sdPent, centre: [0, 40],
  depart: 'place',               // le lieu où l'on revient quand rien d'autre n'est sûr
  aires: [
    // la herse de la Porte Royale reste baissée tant qu'on y joue ; un bot resté dehors rentre
    // par le pont (hors de la grille des chemins, il filait droit et restait au bord du fossé).
    // `eparpille` : le rayon des départs de manche des bots
    { id: 'citadelle', nom: 'la citadelle', r: 2, couleur: '#ff9a70', lueur: 0xff6a3a, eparpille: 110,
      herse: 'la herse de la Porte Royale',
      porte: { sur: (x, z) => Math.abs(x) < 3.5 && z > APO - 12 && z < PONT_Z1 + 3, dehors: [0, PONT_Z1 + 6], seuil: [0, PONT_Z1 - 2], dedans: [0, APO - 14] } },
  ],
  // les points forts, d'où partent les drapeaux : la place, les casernes, la poterne, et la
  // gorge des cinq bastions (au pied de leur rampe, côté place). Pas le donjon : son enclos a
  // une grille fermée.
  pointsForts: (lieux) => {
    const place = lieux.find((l) => l.id === 'place');
    if (!place) return [];
    const c = [{ id: 'place', nom: place.nom, x: place.x, z: place.z }];
    for (const l of lieux) if (l.id.startsWith('caserne') || l.id === 'poterne') c.push({ id: l.id, nom: l.nom, x: l.x, z: l.z });
    bastions.forEach((b, i) => {
      const gx = (b.S1[0] + b.S2[0]) / 2, gz = (b.S1[1] + b.S2[1]) / 2, d = Math.hypot(place.x - gx, place.z - gz) || 1;
      c.push({ id: 'bastion' + i, nom: 'le b' + (b.name || 'astion').slice(1), x: gx + (place.x - gx) / d * 22, z: gz + (place.z - gz) / d * 22 });
    });
    return c;
  },
};

const level = {
  name: 'citadel', getH: levelH, blocked: levelBlocked, zoneName, ambiance,
  arenes: [ARENE_LILLE],
  // Camille et les villageois mesuraient 2,97 m, alors que la citadelle et les 1 975
  // hauteurs relevées sont au 1:1 : une maison de rue lilloise de 9,50 m ne faisait que
  // 3,2 fois sa taille, au lieu de 5,4. Dehors, le personnage est donc ramené à 1,80 m.
  // Les intérieurs gardent leur échelle : ils ont été dessinés pour un personnage de 3 m,
  // et on ne voit jamais les deux en même temps.
  echelle: 0.6,
  // la terre des ouvrages avancés se pose après la citadelle : l'eau du fossé est
  // déjà là, les demi-lunes y sortent comme des îles (cf. carte.js)
  // l'ordre compte : la citadelle cuit le relief, les ouvrages et l'eau s'y posent, et
  // les voiries se drapent sur le sol fini
  build: async () => {
    await buildCitadel();
    await E.etape('ouvrages et eaux');
    scene.add(terrassesDehors()); scene.add(nappesLille());
    scene.add(pontsLille());        // la Deûle coupe la carte : sans ses ponts, rien au-delà
    { const s = solVille(); if (s) scene.add(s); }   // le sol du quartier, sous les chaussées
    scene.add(voiriesLille());
    scene.add(haiesIGN());        // les haies du référentiel IGN
    await E.etape('quartier');
    scene.add(batirQuartier());   // le bâti relevé : la ville, telle qu'elle est
    scene.add(voieDesCombattants());   // la boucle de la citadelle
    scene.add(entreeDuParc());         // l'entrée du parc, au débouché du pont
    scene.add(rempartsVille());        // l'enceinte urbaine ferme le monde
  }, populate, update, animate, minimap, counts, onKill, onLoad, objective,
  start: () => { if (!state.introSeen) debut(); else showMessage('Camille arrive devant la Porte Royale. Va voir Lydéric, le géant, près du pont.', 5); },
  arriveMessage: () => state.princeFreed ? 'Retour à la lumière avec Eugène. Rejoins Lydéric près du pont !' : 'Partie reprise. Bonne chance, Camille.',
  entry: () => state.princeFreed ? { title: 'La Citadelle de Lille', sub: 'Retour à la lumière', cam: [22.5 + 14, 9, 31 + 10], at: [22.5, 2, 31], cam2: [22.5 + 6, 4, 31 + 6], dur: 4 } : null,
  titleCamera: (now) => { const a = now / 9000; camera.position.set(Math.cos(a) * 120, 45, Math.sin(a) * 120); camera.lookAt(0, 0, 0); },
  arrowBlocked: (p) => p.y < 0 && sdEau(p.x, p.z) < -1.5,
};
Q.hooks.push((l) => {
  for (const lm of perf.leaves) lm.castShadow = l < 1;
  if (perf.grass) perf.grass.count = Math.round(perf.grassFull * [1, 0.7, 0.4, 0.2][l]);
  if (perf.tufts) perf.tufts.count = Math.round(perf.tuftsFull * [1, 0.65, 0.35, 0.15][l]);
  if (perf.bushes) perf.bushes.count = Math.round(perf.bushesFull * [1, 0.8, 0.5, 0.25][l]);
  if (perf.wheat) perf.wheat.count = Math.round(perf.wheatFull * [1, 0.7, 0.4, 0.2][l]);
  for (const f of perf.flowers) f.visible = l < 3;
  if (perf.reeds) perf.reeds.visible = l < 3;
  if (perf.roots) perf.roots.visible = l < 2;
  if (perf.foret) { for (const m of perf.foret.loin) m.visible = l < 3; for (const m of perf.foret.feuillages) m.castShadow = l < 1; }
  if (perf.fougeres) for (const m of perf.fougeres) m.visible = l < 2;
});
makeSky(0x2a5da8, 0x89b3dc, 0xe4d4bb);          // zénith / ciel moyen / brume chaude d'horizon
scene.fog = new THREE.Fog(0xd4cec2, 200 * ECH * 0.55, 700 * ECH * 0.8);   // ~495 m à ~2520 m
bootLevel(level, titleMenu);
window.TLOC.DEHORS = DEHORS; window.TLOC.MOUNDS = MOUNDS; window.TLOC.TOWN = TOWN; window.TLOC.bastions = bastions; window.TLOC.DONJON = DONJON; window.TLOC.HOUSE = HOUSE; window.TLOC.POTERNE = POTERNE; window.TLOC.APO = APO;
