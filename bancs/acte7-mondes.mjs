// Banc de l'acte VII, lot 2 : les mondes figés (engine.js, MONDES7, arene7Tick). Du Temple (Phinaert enfui par
// la porte du Midi) à Lille : l'Aveyron (le lasso), la Thaïlande (le gong), Alberobello (le tambourin), Villefort
// (la sonnaille). Dans chacun : le temps arrêté, sa garde qui refuse les coups, l'arme qui l'ouvre, six points de
// l'épée de Lydéric, la fuite vers le monde suivant.
//
//   bancs/tour.sh node bancs/acte7-mondes.mjs
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const nom = (n) => `acte7-mondes-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const pret = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
async function lire() { const dits = [];
  for (let k = 0; k < 40; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say; T.cutAdvance(true); return s || ''; });
    if (r === null) break; if (r) dits.push(r); await pause(200); }
  return dits; }
const DONS = { acte5: 'course', troupeauxVu: true, force: true, souffle: true, elan: true, course: true, lasso: true, sword: true, gongThai: true, tambourin: true, sonnaille: true,
  acte6: 'cloche', grandeCloche: true, vers6: true, acte2: 'pluie', clocheIles: true, acte4: 'temple', templeVu: true, midiVu: true, ilesVu: true,
  acte7: 'mondes', epeeLyderic: true };
const phin = () => dans(() => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead); return e ? { hp: e.hp, max: e.k.hp, garde: e.garde7, x: e.pos.x, z: e.pos.z } : null; });
const frapper = () => dans(() => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead); if (e) TLOC.hitEnemy(e, 3, e.pos.x + 1, e.pos.z); });

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/temple.html'); await pret(); await pause(3000); await lire();
await dans((d) => { Object.assign(TLOC.state, d); TLOC.player.maxHp = TLOC.player.hp = 40; TLOC.saveGame(true); }, DONS);
await parler(page, 'pousser la porte du Midi');

for (const [lieu, page1] of [['aveyron', /aveyron\.html/], ['thailande', /thailande\.html/], ['alberobello', /alberobello\.html/], ['villefort', /villefort\.html/]]) {
  await page.waitForURL(page1, { timeout: 90000 }).catch(() => {});
  const t0 = Date.now(); await pret(); console.log(`    ${lieu} : chargement ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  // Phinaert paraît quand les scènes d'arrivée sont passées
  let p = null; for (let k = 0; k < 40 && !p; k++) { await pause(500); await lire(); p = await phin(); }
  const dits = await lire();
  verifier(`${lieu} : Phinaert, le temps arrêté`, !!p && await dans(() => TLOC.G.tempsArrete === true), p ? `${p.x.toFixed(0)}, ${p.z.toFixed(0)}` : '');
  await dans(() => { TLOC.player.hp = TLOC.player.maxHp; });
  await filmer(page, nom(lieu), await dans(() => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead), P = TLOC.player.pos; return [P.x + (P.x - e.pos.x) * 0.6 + 3, P.y + 5, P.z + (P.z - e.pos.z) * 0.6 + 3]; }),
    await dans(() => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead); return [e.pos.x, e.pos.y + 4, e.pos.z]; }), { camille: true, attente: 1200 });
  const h0 = (await phin()).hp; await frapper(); await pause(300);
  verifier(`${lieu} : la garde refuse le coup`, (await phin()).hp === h0);
  const r = await parler(page, 'lasso sur Phinaert|frapper le gong|jouer du tambourin|sonner la sonnaille'); await pause(300);
  verifier(`${lieu} : l’arme du monde ouvre la garde`, !!r && typeof (await phin()).garde === 'number', r ? r.invite : '');
  await frapper(); await pause(200); await frapper(); await pause(1500);
  const fuite = await lire(); console.log('   ', fuite.join(' | '));
  verifier(`${lieu} : il fuit plus loin`, fuite.length > 0 && !(await phin()));
  await dans(() => { TLOC.player.hp = TLOC.player.maxHp; });
}
await page.waitForURL(/index\.html/, { timeout: 90000 }).catch(() => {});
await pret(); await pause(3000);
verifier('à Lille, l’étape « pont »', await dans(() => TLOC.state.acte7 === 'pont' && TLOC.state.monde7 === 4));

verifier('aucune erreur de page', erreurs.length === 0, erreurs.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
