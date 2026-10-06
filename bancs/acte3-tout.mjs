// L'acte III de bout en bout : les six bancs d'étape, l'un après l'autre (chacun pose l'état où
// l'étape d'avant le laisse, et la joue). Ce n'est pas une seule partie continue : chaque banc ouvre
// une partie neuve. On les relance tous après toute modification de thailande.js (un changement
// pour une étape en a déjà cassé une autre : l'acte posé avant le chargement de la sauvegarde).
// Avec, le coût des morceaux bâtis par thailande.js au chargement (window.__lieu.durees).
//
//   bancs/tour.sh node bancs/acte3-tout.mjs
import { spawnSync } from 'child_process';
import { navigateur, ORIGINE } from './acte1-outils.mjs';
const BANCS = ['baie', 'cloitre', 'mali', 'masques', 'yak', 'fin'];
let rates = 0;
for (const n of BANCS) {
  const t0 = Date.now(), r = spawnSync(process.execPath, [new URL(`./acte3-${n}.mjs`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')], { encoding: 'utf8' });
  const ok = r.status === 0, sortie = (r.stdout || '') + (r.stderr || '');
  console.log(`${ok ? 'ok  ' : 'RATÉ'} acte3-${n} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!ok) { rates++; for (const l of sortie.split('\n').filter((l) => /RATÉ|Error|erreur/.test(l)).slice(0, 6)) console.log('     ', l); }
}
// le coût des morceaux au chargement
{ const { b, page } = await navigateur();
  await page.goto(ORIGINE + '/thailande.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.__lieu, null, { timeout: 300000, polling: 300 });
  const d = await page.evaluate(() => window.__lieu.durees);
  console.log('morceaux (ms) :', Object.entries(d).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
  await b.close(); }
console.log(rates ? `${rates} BANC(S) RATÉ(S)` : 'ACTE III RÉUSSI');
process.exit(rates ? 1 : 0);
