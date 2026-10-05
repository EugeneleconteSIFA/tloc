// Banc de l'acte I, morceau B2 : SOUS LA VILLE (docs/DECOUPAGE-ACTE1.md, étapes 7 et 8).
// De la lanterne en main jusqu'à la sortie par la poterne, dans la citadelle :
//   la dalle de la crypte (chapelle) → les galeries → Bastien près de la citerne → l'arc au
//   fond du puits aux chauves-souris → le levier touché d'une flèche → la grille → les
//   tonneaux pendus → le Rat-Roi → la clé → la porte de la poterne → la citadelle.
// Puis l'ancienne histoire (une sauvegarde sans prologueFait) : la cage et la vanne, intactes.
//
//   bancs/tour.sh node bancs/acte1-souterrains.mjs
//
// On marche (tryMove, la fonction qui déplace Camille, pas à pas de 25 cm) partout où le
// chemin compte ; on se pose (parler) devant ce qu'on actionne. Les flèches sont de vraies
// flèches du moteur (le tableau `arrows`, mises à jour par updateArrows) : seul le geste de
// tirer est épargné. Sortie : bancs/resultats/acte1-souterrains-<date>.json et une capture
// par moment clé ; le banc échoue s'il y a une erreur de page ou un pas manqué.
import fs from 'fs';
import { navigateur, partieActe1, parler, filmer, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';

const { b, page, erreurs } = await navigateur();
const res = { date: new Date().toISOString(), pas: [], repliques: {}, echecs: [], piles: [], introuvables: [] };
// d'où vient une erreur, et quel fichier manque : navigateur() n'en garde que la première ligne
page.on('pageerror', (e) => res.piles.push(String(e.stack || e).split('\n').slice(0, 4).join(' ← ')));
page.on('response', (r) => { if (r.status() === 404) res.introuvables.push(r.url()); });
const ok = (nom, cond, detail = '') => { res.pas.push({ nom, ok: !!cond, detail }); console.log(`${cond ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`); if (!cond) res.echecs.push(nom); };
const charge = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000, polling: 300 });
const capture = (nom) => page.screenshot({ path: DIR + `acte1-souterrains-${JOUR}-${nom}.jpg`, quality: 80 });
// lire un dialogue en cours jusqu'au bout (le même geste que parler)
async function lire() {
  const l = [];
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? `${c.who || ''} : ${c.say}` : (c && c.text) || ''; T.cutAdvance(true); return s; });
    if (r === null) break; if (r) l.push(r);
  }
  return l;
}
// marcher de point en point avec les collisions du jeu : entre deux points, un chemin cherché
// sur une grille de 50 cm (les futailles et les étais sont posés au hasard à ± 70 cm : la ligne
// droite y bute un essai sur deux), puis suivi pas à pas par tryMove, sans jamais téléporter.
// Rend null, ou le point où l'on bute. Camille est rendue invulnérable : les rats et les
// chauves-souris l'attaquent pendant qu'on la mène, et morte, la boucle du jeu s'arrête.
const marcher = (pts) => page.evaluate((pts) => { const T = TLOC, p = T.player.pos, PAS = 0.5, NX = 190, NZ = 76;
  T.player.hp = T.player.maxHp; T.player.invuln = 1e6;
  const libre = (i, j) => { const x = i * PAS, z = j * PAS; return !T.blocked(x, z, 0.5, false, 0) && T.getH(x, z) > -0.5; };
  const chemin = (x0, z0, x1, z1) => {
    const a = [Math.round(x0 / PAS), Math.round(z0 / PAS)], bt = [Math.round(x1 / PAS), Math.round(z1 / PAS)];
    const vu = new Map([[a.join(), null]]), file = [a];
    while (file.length) { const c = file.shift(); if (c[0] === bt[0] && c[1] === bt[1]) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const n = [c[0] + di, c[1] + dj], k = n.join();
        if (n[0] < 0 || n[1] < 0 || n[0] >= NX || n[1] >= NZ || vu.has(k) || !libre(...n)) continue; vu.set(k, c); file.push(n); } }
    if (!vu.has(bt.join())) return null;
    const l = []; for (let c = bt; c; c = vu.get(c.join())) l.unshift([c[0] * PAS, c[1] * PAS]); l.push([x1, z1]); return l;
  };
  for (const [x, z] of pts) {
    const l = chemin(p.x, p.z, x, z); if (!l) return { bute: [+p.x.toFixed(2), +p.z.toFixed(2)], vers: [x, z], pourquoi: 'aucun chemin' };
    for (const [cx, cz] of l) for (let n = 0; n < 40; n++) { const dx = cx - p.x, dz = cz - p.z, d = Math.hypot(dx, dz); if (d < 0.05) break;
      const s = Math.min(0.25, d), x0 = p.x, z0 = p.z;
      if (!T.tryMove(p, dx / d * s, dz / d * s, 0.5, false) || (p.x === x0 && p.z === z0)) return { bute: [+p.x.toFixed(2), +p.z.toFixed(2)], vers: [x, z] }; p.y = T.getH(p.x, p.z); } }
  return null; }, pts);
// une vraie flèche du moteur, tirée de Camille vers `cible`
const tirer = (cible) => page.evaluate(async (c) => { const T = TLOC, E = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/engine.js?v=')));
  const p = T.player.pos, o = new T.THREE.Vector3(p.x, p.y + 1.4, p.z), dir = new T.THREE.Vector3(c[0] - o.x, c[1] - o.y, c[2] - o.z).normalize();
  T.player.yaw = Math.atan2(dir.x, dir.z); T.player.invuln = 1e6;
  const m = new T.THREE.Mesh(E.arrowGeo, E.arrowMat); m.position.copy(o); T.scene.add(m);
  T.arrows.push({ mesh: m, vel: dir.multiplyScalar(40), life: 1.5 }); }, cible);
const etat = () => page.evaluate(() => { const s = TLOC.state; return { acte1: s.acte1, bow: s.bow, caveLever: s.caveLever, caveTonneaux: s.caveTonneaux, clePoterne: s.clePoterne, galleryOpen: s.galleryOpen, ind: s.ind, billets: s.billets, over: s.over, hp: TLOC.player.hp }; });

try {
  // ---------- 0. une partie de l'acte I, la lanterne en main, posée dans la chapelle ----------
  await partieActe1(page, { acte1: 'lanterne', lanterne: true });
  await page.evaluate(() => { TLOC.saveGame(true, { level: 'chapelle', pos: [2.7, 0.44, -6.6], yaw: Math.PI }); sessionStorage.setItem('tloc_auto', 'resume'); });
  await page.goto(ORIGINE + '/chapelle.html'); await charge(); await page.waitForTimeout(1500);
  await page.evaluate(() => { while (TLOC.cut.active) TLOC.cutAdvance(true); });

  // ---------- 7. la crypte ----------
  await filmer(page, `acte1-souterrains-${JOUR}-1-dalle.jpg`, [5.2, 2.6, -4.6], [2.7, 0.4, -8.85], { camille: true });
  const dalle = await parler(page, 'descendre dans la crypte', { avant: [2.7, -6.5] });
  res.repliques.dalle = dalle;
  ok('la dalle propose de descendre, la lanterne en main', dalle && /descendre/.test(dalle.invite), dalle && dalle.invite);
  await page.waitForURL(/cave\.html/, { timeout: 30000 }); await charge();
  ok('on arrive dans les galeries', true);
  let s = await etat();
  ok('l’acte passe à « souterrains »', s.acte1 === 'souterrains', s.acte1);
  await page.waitForTimeout(1200); await capture('2-arrivee-titre');
  await page.evaluate(() => { while (TLOC.cut.active) TLOC.cutAdvance(true); });
  const pos0 = await page.evaluate(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  ok('Camille au pied de l’escalier de la crypte', Math.hypot(pos0[0] - 51, pos0[1] - 22.4) < 1.5, pos0.map((v) => v.toFixed(1)).join(' ; '));
  await page.waitForTimeout(1500); await capture('3-escalier-crypte');

  // la porte de la poterne, sans la clé
  const fermee = await parler(page, 'la porte de la poterne', { avant: [3, 5] });
  res.repliques.porteFermee = fermee;
  ok('la porte de la poterne est fermée à clé', fermee && fermee.repliques.some((r) => /Fermé à clé/.test(r)));
  await filmer(page, `acte1-souterrains-${JOUR}-4-porte-poterne.jpg`, [3.2, 1.8, 8.5], [3, 2.0, 1.5], { camille: true, hud: true });

  // l'escalier de la crypte se remonte : on reparaît à côté de la dalle, et on redescend
  const monte = await parler(page, 'remonter à la chapelle', { avant: [51, 24] });
  ok('l’escalier de la crypte remonte à la chapelle', !!monte);
  await page.waitForURL(/chapelle\.html/, { timeout: 30000 }); await charge(); await page.waitForTimeout(1500);
  const enHaut = await page.evaluate(() => { while (TLOC.cut.active) TLOC.cutAdvance(true); const p = TLOC.player.pos; return [p.x, p.y, p.z]; });
  ok('dans la chapelle, Camille reparaît à côté de la dalle', Math.hypot(enHaut[0] - 2.7, enHaut[2] + 8.85) < 3, enHaut.map((v) => v.toFixed(2)).join(' ; '));
  await page.waitForTimeout(800); await capture('3b-remontee-chapelle');
  const redescend = await parler(page, 'descendre dans la crypte', { avant: [2.7, -6.5] });
  ok('et on redescend', !!redescend);
  await page.waitForURL(/cave\.html/, { timeout: 30000 }); await charge(); await page.waitForTimeout(1200);
  await page.evaluate(() => { while (TLOC.cut.active) TLOC.cutAdvance(true); });

  // ---------- 8. Bastien, près de la citerne (il interpelle Camille) ----------
  await page.evaluate(() => { const p = TLOC.player.pos; p.set(51, 0, 22.4); });
  let bute = await marcher([[51, 25.5], [44.5, 25.5]]);
  ok('de l’escalier à la citerne, à pied', !bute, JSON.stringify(bute));
  await page.waitForTimeout(700);
  await capture('5-bastien-halte');
  const b1 = await lire(); res.repliques.bastienSouterrains = b1;
  ok('Bastien : « Halte ! » puis l’arc au puits aux chauves-souris', b1.some((r) => /Halte/.test(r)) && b1.some((r) => /\*\*L'arc de l'intendant/.test(r)), b1.length + ' répliques');
  await filmer(page, `acte1-souterrains-${JOUR}-6-citerne-bastien.jpg`, [44.5, 2.6, 28.5], [37.5, 1.0, 25.0], { camille: true });

  // ---------- l'arc, au fond du puits aux chauves-souris (à droite après la citerne) ----------
  bute = await marcher([[44.5, 20.2], [30, 20.2], [30, 14], [30, 11], [34.0, 9.6]]);
  ok('de la citerne au puits, à pied (à droite après la citerne)', !bute, JSON.stringify(bute));
  await page.waitForTimeout(800);
  s = await etat();
  ok('le coffre donne l’arc ; l’acte passe à « arc »', s.bow && s.acte1 === 'arc', `bow ${s.bow}, ${s.acte1}`);
  await filmer(page, `acte1-souterrains-${JOUR}-7-puits-arc.jpg`, [31.5, 2.2, 13.5], [36, 2.4, 9], { camille: true, hud: true });
  const billet2 = await parler(page, 'ramasser le billet', { avant: [36, 9] }); res.repliques.billet2 = billet2;
  ok('le billet n° 2 se lit', billet2 && billet2.repliques.some((r) => /dalle gravée/.test(r)));

  // Bastien, à l'étape « arc »
  const b2 = await parler(page, 'parler à Bastien', { avant: [44, 25.5] }); res.repliques.bastienArc = b2;
  ok('Bastien : le Rat-Roi a avalé une clé, la flèche dans les tonneaux', b2 && b2.repliques.some((r) => /\*\*Il a avalé une clé\*\*/.test(r)) && b2.repliques.some((r) => /tonneaux pendus/.test(r)));

  // ---------- le levier, trop haut : une flèche ----------
  await page.evaluate(() => TLOC.player.pos.set(45, 0, 8.5));
  await filmer(page, `acte1-souterrains-${JOUR}-8-levier-haut.jpg`, [43.5, 1.6, 10.5], [49.2, 3.0, 6.5], { camille: true });
  await tirer([49.2, 3.0, 6.0]); await page.waitForTimeout(2500);
  s = await etat();
  ok('une flèche dans le levier lève la grille', s.caveLever === true);
  await filmer(page, `acte1-souterrains-${JOUR}-9-grille-levee.jpg`, [44.5, 2.0, 11], [51, 1.8, 9], { camille: true });

  // ---------- les fosses, le terrier ----------
  bute = await marcher([[48, 9], [53.5, 9], [54.5, 10.3]]);
  ok('la grille franchie, à pied', !bute, JSON.stringify(bute));
  const billet3 = await parler(page, 'ramasser le billet', { avant: [53, 9] }); res.repliques.billet3 = billet3;
  ok('le billet n° 3 se lit', billet3 && billet3.repliques.some((r) => /mille ans/.test(r)));
  bute = await marcher([[55.5, 16.2], [79.5, 16.2]]);
  ok('le long des fosses jusqu’au terrier, à pied', !bute, JSON.stringify(bute));
  // le Rat-Roi montre le museau
  let vu = false;
  for (let k = 0; k < 40 && !vu; k++) { await page.waitForTimeout(200); vu = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'ratroi'); return !!(e && e.mesh.visible && e.caged); }); }
  ok('le Rat-Roi terré montre le museau à un trou', vu);
  if (vu) await filmer(page, `acte1-souterrains-${JOUR}-10-terrier.jpg`, [80.5, 2.2, 17.5], [87.5, 1.6, 15], { camille: true, attente: 200 });
  const intouchable = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'ratroi'); const hp = e.hp; return { caged: e.caged, loin: Math.hypot(e.pos.x - 87, e.pos.z - 15) > 100, hp }; });
  ok('terré, il est hors d’atteinte (caged, hors du plan pour la visée)', intouchable.caged && intouchable.loin);
  await page.evaluate(() => TLOC.player.pos.set(80, 0, 15));
  await tirer([87.2, 2.6, 15]); await page.waitForTimeout(2500);
  s = await etat();
  const sorti = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'ratroi'); return { caged: e.caged, visible: e.mesh.visible, pos: [e.pos.x, e.pos.z] }; });
  ok('une flèche dans les tonneaux : ils tombent, le Rat-Roi sort', s.caveTonneaux && !sorti.caged && sorti.visible, JSON.stringify(sorti));
  await filmer(page, `acte1-souterrains-${JOUR}-11-tonneaux-ratroi.jpg`, [79, 2.6, 19], [86, 0.8, 15], { camille: true, attente: 400 });
  // le combat : les coups d'épée du moteur (hitEnemy)
  await page.evaluate(() => { const T = TLOC, e = T.enemies.find((x) => x.kind === 'ratroi'); for (let k = 0; k < 10 && !e.dead && !e.caged; k++) T.hitEnemy(e, 2, T.player.pos.x, T.player.pos.z); });
  await page.waitForTimeout(1200);
  await capture('12-cle');
  const cle = await lire(); res.repliques.cle = cle;
  s = await etat();
  ok('le Rat-Roi vaincu recrache la clé de la poterne', s.clePoterne === true && cle.some((r) => /POTERNE/.test(r)), cle.join(' | '));
  const trone = await parler(page, 'trône', { avant: [84, 6] }); res.repliques.trone = trone;
  ok('le trône du Rat-Roi : le dessin gratté', trone && trone.repliques.some((r) => /cloches pendues/.test(r)));
  await filmer(page, `acte1-souterrains-${JOUR}-13-trone.jpg`, [83.0, 2.2, 7.4], [86.6, 0.6, 3.6]);   // Camille ôtée du champ : elle bouchait le trône

  // ---------- la sortie : retour à pied à la poterne ----------
  await page.evaluate(() => TLOC.player.pos.set(79.5, 0, 16.2));
  bute = await marcher([[55.5, 16.2], [54, 9], [45, 9], [30, 11], [30, 20.2], [16.5, 20.2], [16.5, 15], [16.5, 9], [9, 6], [3.5, 5.0]]);
  ok('du terrier à la poterne, à pied', !bute, JSON.stringify(bute));
  const b3 = await parler(page, 'ouvrir la porte de la poterne', { avant: [3, 5] });
  ok('la clé ouvre la porte de la poterne', b3 && /ouvrir/.test(b3.invite), b3 && b3.invite);
  await page.waitForTimeout(900); await filmer(page, `acte1-souterrains-${JOUR}-14-poterne-ouverte.jpg`, [3.2, 1.8, 8.5], [3, 2.0, 1.5], { camille: true, attente: 600 });
  await page.waitForURL(/index\.html/, { timeout: 30000 }); await charge(); await page.waitForTimeout(2000);
  await page.evaluate(() => { while (TLOC.cut.active) TLOC.cutAdvance(true); });
  s = await etat();
  const sortie = await page.evaluate(async () => { const C = await import('./citadelle.js'); const P = C.POTERNE_JEU; const p = TLOC.player.pos; return { d: P ? Math.hypot(p.x - P.x, p.z - P.z) : -1, niveau: TLOC.G.level.name }; });
  ok('on sort dans la citadelle, devant la poterne ; l’acte passe à « citadelle »', sortie.niveau === 'citadel' && sortie.d >= 0 && sortie.d < 6 && s.acte1 === 'citadelle' && s.galleryOpen, `${sortie.niveau}, à ${sortie.d.toFixed(1)} m, ${s.acte1}` + (res.piles.some((p) => /loadGame/.test(p)) ? ' — la page est figée : loadGame (engine.js:2687) écrit dans le bowBack que la Camille riggée n’a pas (hors B2, PROMPT-REPRISE)' : ''));
  await page.waitForTimeout(1500); await capture('15-citadelle-poterne');
  res.final = s;

  // ---------- l'ancienne histoire : une sauvegarde sans prologueFait ----------
  await page.evaluate(() => { const k = 'tloc_save_v2', d = JSON.parse(localStorage.getItem(k));
    d.flags = { sword: true, introSeen: true, metLyderic: true, key: true, galleryOpen: true, bow: true, decouverts: {} };
    d.level = 'cave'; d.pos = [3, 0, 4]; d.levels = {}; localStorage.setItem(k, JSON.stringify(d)); sessionStorage.setItem('tloc_auto', 'resume'); });
  await page.goto(ORIGINE + '/cave.html'); await charge(); await page.waitForTimeout(1500);
  const vieux = await page.evaluate(() => { const T = TLOC, pr = (i) => { try { return typeof i.prompt === 'function' ? i.prompt() : i.prompt; } catch (e) { return ''; } };
    const ps = T.interactables.map(pr); return { eugene: ps.some((x) => /Eugène/.test(x)), levier: ps.some((x) => /levier/.test(x)), crypte: ps.some((x) => /chapelle/.test(x)), bastien: ps.some((x) => /Bastien|fantôme/.test(x)), sortie: ps.find((x) => /surface|poterne/.test(x)) }; });
  ok('ancienne histoire : la cage d’Eugène et la vanne sont là, ni crypte ni Bastien', vieux.eugene && vieux.levier && !vieux.crypte && !vieux.bastien && vieux.sortie === 'remonter à la surface', JSON.stringify(vieux));
} catch (e) {
  ok('le banc a couru jusqu’au bout', false, String(e).split('\n')[0]);
} finally {
  res.erreurs = erreurs;
  // le seul 404 sans URL relevée est le favicon, que le serveur n'a pas (Playwright ne rapporte pas sa réponse)
  const vraies = erreurs.filter((e) => !(/Failed to load resource.*404/.test(e) && res.introuvables.length === 0));
  ok('aucune erreur de page', vraies.length === 0, vraies.slice(0, 5).join(' | '));
  fs.writeFileSync(DIR + `acte1-souterrains-${JOUR}.json`, JSON.stringify(res, null, 1));
  await b.close();
  console.log(res.echecs.length ? `\n${res.echecs.length} échec(s)` : '\ntout est passé');
  process.exitCode = res.echecs.length ? 1 : 0;
}
