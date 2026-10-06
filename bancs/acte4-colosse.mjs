// Banc de l'acte IV, lots 4 et 5 (docs/DECOUPAGE-ACTE4.md, étapes 10 et 11, et la lettre) : Cosimo
// vieux (l'encre qui pâlit sans le tambourin, la boîte de lettres avec), le Colosse qui marche sur la
// jetée, Nunzia à 75 ans qui lit les lettres, le combat (le tambourin, le genou à terre, trois coups),
// l'élan, la Cloche des Heures sonnée, le couchant. Une capture par moment clé ; aucune pageerror.
//
//   bancs/tour.sh node bancs/acte4-colosse.mjs
import { navigateur, partieActe1, parler, filmer, filmerSujet, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
const charge = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000, polling: 300 });
const passerCut = async () => { for (let k = 0; k < 30; k++) { const r = await page.evaluate(() => { if (!TLOC.cut.active) return null; TLOC.cutAdvance(true); return 1; }); if (r === null) break; await page.waitForTimeout(120); } };
async function train(vers) {
  await parler(page, 'petit train');
  const l = await page.evaluate((vers) => { const M = TLOC.menu; const it = M.active && M.items.find((i) => i.label.includes(vers)); if (it) { it.fn(); return it.label; } return null; }, vers);
  ok('le train pour ' + vers, l);
  await page.waitForTimeout(1500); await charge(); await page.waitForTimeout(3000); await passerCut();
}
const etat = (k) => page.evaluate((k) => TLOC.state[k], k);
const pos = (re) => page.evaluate((re) => { const it = TLOC.interactables.find((i) => { try { return (!i.enabled || i.enabled()) && new RegExp(re, 'i').test(typeof i.prompt === 'function' ? i.prompt() : ''); } catch (e) { return false; } }); return it ? [it.pos.x, it.pos.y, it.pos.z, 0] : null; }, re);
const repl = (r) => (r ? r.repliques.join(' | ') : 'personne');
const pouilles = (f) => page.evaluate(`import('./pouilles.js').then((P) => (${f})(P))`);
const K = async () => { await page.keyboard.press('KeyK'); await page.waitForTimeout(400); };

try {
  await partieActe1(page, { acte1: 'temple', templeVu: true, bow: true, lanterne: true, acte4: 'chateau', lettre4: 'lettre', q_lettre: 1, tambourin: true, corde4: true, elan: undefined,
    portes4: { 0: true, 1: true, 2: true }, levier4: { 0: true, 2: true },
    ind4: { soleil: true, grandpere: true, ticket: true, mot: true, apprenti: true, chateau: true, rythme: true, joueuse: true, tarentules: true, colosse: true, vers4: true } });
  // ---------- la lettre : Cosimo vieux ----------
  await page.goto(ORIGINE + '/alberobello.html'); await charge(); await page.waitForTimeout(3000); await passerCut();
  await page.waitForFunction(() => TLOC.interactables.some((i) => /vieux Cosimo/.test(typeof i.prompt === 'function' ? i.prompt() : '')), null, { timeout: 30000 }).catch(() => {});
  const pc = await pos('vieux Cosimo'); ok('5. Cosimo vieux, devant son trullo', pc);
  if (pc) await filmerSujet(page, `acte4-colosse-${JOUR}-cosimo-vieux.jpg`, pc);
  const c1 = await parler(page, 'vieux Cosimo');
  ok('5. sans le tambourin, l’encre a pâli', /bue/.test(repl(c1)) && (await etat('lettre4')) === 'lettre', repl(c1));
  await K();
  const c2 = await parler(page, 'vieux Cosimo');
  ok('5. dans le ralenti : la boîte de lettres', (await etat('lettre4')) === 'boite' && (await etat('q_lettre')) === 2, repl(c2));

  // ---------- Gallipoli : le Colosse qui marche ----------
  await train('Gallipoli');
  await page.waitForFunction(() => window.__gallipoli && __gallipoli.CO.morceau, null, { timeout: 30000 }).catch(() => {});
  const g1 = await page.evaluate(() => { const c = __gallipoli.colosse(); return [c.position.x, c.position.z]; });
  const ph1 = await pouilles('(P) => P.TEMPS.phase');
  await page.waitForTimeout(4000);
  const g2 = await page.evaluate(() => { const c = __gallipoli.colosse(); return [c.position.x, c.position.z, c.position.y]; });
  const ph2 = await pouilles('(P) => P.TEMPS.phase');
  ok('10. le Colosse marche sur la jetée', Math.hypot(g1[0] - g2[0], g1[1] - g2[1]) > 2, `${Math.hypot(g1[0] - g2[0], g1[1] - g2[1]).toFixed(1)} m en 4 s`);
  ok('10. ses pas font bondir le temps', ph2 - ph1 > 4 / 120 + 0.03, `phase ${ph1.toFixed(3)} → ${ph2.toFixed(3)}`);
  await filmer(page, `acte4-colosse-${JOUR}-marche.jpg`, [g2[0] + 26, g2[2] + 9, g2[1] + 18], [g2[0], g2[2] + 7, g2[1]]);

  // ---------- la lettre rendue ----------
  const pn = await pos('Nunzia'); if (pn) await filmerSujet(page, `acte4-colosse-${JOUR}-nunzia75.jpg`, pn);
  const n1 = await parler(page, 'Nunzia');
  ok('5. Nunzia lit les lettres : la quête finie', /tous les jours/.test(repl(n1)) && (await etat('lettre4')) === 'rendue' && (await etat('q_lettre')) === 3, repl(n1));
  const n2 = await parler(page, 'Nunzia');
  ok('10. Nunzia, 75 ans : le morceau qui brille', /brille/.test(repl(n2)), repl(n2));

  // ---------- le combat ----------
  // Camille à huit mètres du géant, le tambourin : il s'arrête et met un genou à terre
  await page.evaluate(() => { const c = __gallipoli.colosse(), p = TLOC.player.pos; p.set(c.position.x + 7, c.position.y, c.position.z + 3); });
  await K(); await page.waitForTimeout(1500);
  ok('10. ralenti, le Colosse met un genou à terre', await page.evaluate(() => __gallipoli.CO.genou > 0.6), (await page.evaluate(() => __gallipoli.CO.genou)).toFixed(2));
  const gc = await page.evaluate(() => { const c = __gallipoli.colosse(); return [c.position.x, c.position.y, c.position.z]; });
  await filmer(page, `acte4-colosse-${JOUR}-genou.jpg`, [gc[0] + 14, gc[1] + 6, gc[2] + 10], [gc[0], gc[1] + 5, gc[2]], { camille: true, attente: 600 });
  for (let k = 0; k < 3; k++) {
    if (k) { await page.waitForTimeout(900); await K(); await page.waitForTimeout(800); }
    await parler(page, 'frapper le morceau');
  }
  ok('10. trois coups : le morceau ôté, l’étape `colosse`', (await etat('acte4')) === 'colosse', await etat('acte4'));
  ok('11. l’élan du Colosse', (await etat('elan')) === true);
  await page.waitForTimeout(2000);
  const cl = await pos('Cloche des Heures'); ok('11. la Cloche des Heures, au pied du socle', cl);
  if (cl) await filmer(page, `acte4-colosse-${JOUR}-statue.jpg`, [cl[0] + 12, cl[1] + 5, cl[2] + 12], [cl[0], cl[1] + 4, cl[2]]);
  const so = await parler(page, 'Cloche des Heures');
  ok('11. la cloche sonnée : `heures`', (await etat('acte4')) === 'heures', repl(so));
  await page.waitForTimeout(5000);
  const ph3 = await pouilles('(P) => [P.TEMPS.phase, P.TEMPS.lent]');
  ok('11. le temps ralentit : le soleil descend vers le couchant', ph3[0] > 0.3 && ph3[0] <= 0.46, 'phase ' + ph3[0].toFixed(3));
  const pn2 = await pos('Nunzia');
  const n3 = await parler(page, 'Nunzia');
  ok('11. Nunzia reste vieille', /Une vie entière|J’ai eu une vie/.test(repl(n3)), repl(n3));
  if (pn2) { await pouilles('(P) => { P.TEMPS.phase = 0.455; }'); await filmerSujet(page, `acte4-colosse-${JOUR}-couchant.jpg`, pn2, { yaw: 2.6 }); }
  ok('l’objectif : le retour au Temple', /Temple/.test(await page.evaluate(() => TLOC.G.level.objective())));
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `acte4-colosse-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
