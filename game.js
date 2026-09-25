// The Legend of Camille — niveau 1 : la citadelle de Lille
import * as E from './engine.js?v=27';
import * as PNJ from './pnj.js';
import * as FORET from './foret.js';
import {
  THREE, Q, T, blocked, bootLevel, camera, lerpAngle, makeSky, rand, scene, showMessage, state,
} from './engine.js?v=27';
import {
  APO, DEHORS, DONJON, ECH, HOUSE, HOUSE_SMOKE_TOP, MAGE, MOAT_IN, MOAT_OUT, MOUNDS, POTERNE,
  TOWN, bastions, haiesIGN, levelBlocked, levelH, nappesLille, pontsLille, sdEau, sdPent, solVille, terrassesDehors,
  voiriesLille,
  zoneName,
} from './carte.js';
import { PARTAGE } from './etat.js';
import { CLOUD_X, perf } from './nature.js';
import { buildCitadel } from './citadelle.js';
import { batirQuartier, rempartsVille } from './quartier.js';
import { entreeDuParc, voieDesCombattants } from './promenade.js';
import { introScene, objective, onKill, onLoad, populate, update } from './quetes.js';
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
const level = {
  name: 'citadel', getH: levelH, blocked: levelBlocked, zoneName,
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
  start: () => { if (!state.introSeen) introScene(); else showMessage('Camille arrive devant la Porte Royale. Va voir Lydéric, le géant, près du pont.', 5); },
  arriveMessage: () => state.princeFreed ? 'Retour à la lumière avec le prince. Rejoins Lydéric près du pont !' : 'Partie reprise. Bonne chance, Camille.',
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
