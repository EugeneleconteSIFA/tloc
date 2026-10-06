// Banc des petites quêtes des Pouilles (SCENARIO.md § 13) : la récolte (six grappes cueillies
// mûres, l'huile), les douze signes des trulli (un cœur de plus), la fête de la pizzica (quatre
// mesures au tambourin, la tenue), les oursins à marée basse (des écus), et la mer la nuit. Une
// capture par moment clé ; aucune pageerror.
//
//   bancs/tour.sh node bancs/acte4-quetes.mjs
import { navigateur, partieActe1, parler, filmer, filmerSujet, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
const charge = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000, polling: 300 });
const passerCut = async () => { for (let k = 0; k < 30; k++) { const r = await page.evaluate(() => { if (!TLOC.cut.active) return null; TLOC.cutAdvance(true); return 1; }); if (r === null) break; await page.waitForTimeout(120); } };
async function train(vers) {
  await parler(page, 'petit train');
  await page.evaluate((vers) => { const M = TLOC.menu; const it = M.active && M.items.find((i) => i.label.includes(vers)); if (it) it.fn(); }, vers);
  await page.waitForTimeout(1500); await charge(); await page.waitForTimeout(3000); await passerCut();
}
const q = (id) => page.evaluate((id) => TLOC.state['q_' + id] || 0, id);
const combien = (re) => page.evaluate((re) => TLOC.interactables.filter((i) => { try { return (!i.enabled || i.enabled()) && new RegExp(re, 'i').test(typeof i.prompt === 'function' ? i.prompt() : ''); } catch (e) { return false; } }).length, re);

try {
  await partieActe1(page, { acte1: 'temple', templeVu: true, bow: true, lanterne: true, acte4: 'heures', tambourin: true, corde4: true, lettre4: 'rendue', elan: true,
    bourse: true, ecus: 0, gourdes: 1, fioles: [], signes4: undefined, tenue4: undefined, oursins4: undefined, q_recolte4: 0, q_signes4: 0, q_pizzica4: 0,
    ind4: { soleil: true } });
  await page.goto(ORIGINE + '/alberobello.html'); await charge(); await page.waitForTimeout(3000); await passerCut();
  await page.waitForFunction(() => window.__alberobello && __alberobello.OLIVES.fermier && __alberobello.OLIVES.signes, null, { timeout: 40000 }).catch(() => {});

  // ---------- la récolte ----------
  await parler(page, 'parler au fermier');
  ok('la récolte : le fermier donne la quête', (await q('recolte4')) === 1);
  const pf = await page.evaluate(() => __alberobello.OLIVES.place);
  // d'en haut : au ras du sol, la caméra tombait dans les maisons autour
  await filmer(page, `acte4-quetes-${JOUR}-oliveraie.jpg`, [pf[0] + Math.sin(pf[3]) * 5 + 9, pf[1] + 13, pf[2] + Math.cos(pf[3]) * 5 + 9], [pf[0] + Math.sin(pf[3]) * 5, pf[1] + 1, pf[2] + Math.cos(pf[3]) * 5]);
  for (let k = 0; k < 6; k++) {
    // la première grappe encore pendue est celle que l'invite désigne : on attend qu'elle soit mûre
    await page.waitForFunction(() => { const A = __alberobello, g = A.OLIVES.grappes.find((g) => !g.prise); return !g || A.etatGrappe(g) === 'mure'; }, null, { timeout: 20000, polling: 50 }).catch(() => {});
    await parler(page, 'cueillir les olives');
  }
  ok('la récolte : six grappes mûres', (await q('recolte4')) === 2, (await page.evaluate(() => __alberobello.OLIVES.n)) + ' / 6');
  await parler(page, 'parler au fermier');
  ok('la récolte : l’huile dans la gourde', (await q('recolte4')) === 3 && await page.evaluate(() => TLOC.state.fioles.includes('huile')));

  // ---------- les signes ----------
  const n = await combien('lire le signe');
  ok('les signes : douze signes à lire', n === 12, n + ' signes');
  const s0 = await page.evaluate(() => { const p = __alberobello.OLIVES.signes[0]; return [p.place[0], p.place[1], p.cx, p.cz, p.haut]; });
  // depuis la rue, à cinq mètres du trullo, en regardant le flanc du cône
  await filmer(page, `acte4-quetes-${JOUR}-signe.jpg`, [s0[2] + (s0[0] - s0[2]) * 2.2, s0[4] + 0.6, s0[3] + (s0[1] - s0[3]) * 2.2], [s0[2], s0[4] + 1.8, s0[3]]);
  const hp0 = await page.evaluate(() => TLOC.player.maxHp);
  for (let k = 0; k < 12; k++) await parler(page, 'lire le signe');
  ok('les signes : un cœur de plus', (await q('signes4')) === 3 && (await page.evaluate(() => TLOC.player.maxHp)) === hp0 + 2, `${hp0} → ${await page.evaluate(() => TLOC.player.maxHp)}`);

  // ---------- la fête de la pizzica ----------
  await parler(page, 'joueuse');
  ok('la fête : Assunta invite à danser', await page.evaluate(() => __alberobello.FETE.actif));
  // (1,5 s après le coup réussi : le tambourin ignore un coup moins de 1,2 s après le précédent)
  for (let k = 0; k < 4; k++) { await page.keyboard.press('KeyK'); await page.waitForTimeout(2500); await page.keyboard.press('KeyK'); await page.waitForTimeout(1500); }
  const reussies = await page.evaluate(() => __alberobello.FETE.reussies);
  await passerCut();
  ok('la fête : quatre mesures, la tenue' + ` (${reussies} réussies)`, (await q('pizzica4')) === 3 && await page.evaluate(() => TLOC.state.tenue4 && TLOC.state.look.tunique === 1 && TLOC.state.look.foulard === 2));
  const pc = await page.evaluate(() => [TLOC.player.pos.x, TLOC.player.pos.y, TLOC.player.pos.z, TLOC.player.yaw]);
  await filmerSujet(page, `acte4-quetes-${JOUR}-tenue.jpg`, pc, { camille: true });

  // ---------- les oursins ----------
  await train('Gallipoli');
  await page.evaluate(async () => { (await import('./pouilles.js')).TEMPS.tMaree = 135; }); await page.waitForTimeout(1500);
  const no = await combien('ramasser un oursin');
  ok('les oursins : sur le banc, à marée basse', no >= 6, no + ' oursins');
  const e0 = await page.evaluate(() => TLOC.state.ecus);
  for (let k = 0; k < no; k++) await parler(page, 'ramasser un oursin');
  ok('les oursins : trois écus chacun', (await page.evaluate(() => TLOC.state.ecus)) - e0 === no * 3, `${e0} → ${await page.evaluate(() => TLOC.state.ecus)}`);

  // ---------- la mer, la nuit (le temps tourne encore : on remet l'acte avant la cloche) ----------
  await page.evaluate(async () => { TLOC.state.acte4 = 'chateau'; (await import('./pouilles.js')).TEMPS.phase = 0.8; });
  await page.waitForTimeout(800);
  await filmer(page, `acte4-quetes-${JOUR}-mer-nuit.jpg`, [330, 8, 70], [600, 0, 160]);
  await page.evaluate(() => { TLOC.state.acte4 = 'heures'; });
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `acte4-quetes-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
