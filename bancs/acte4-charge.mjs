// Le chargement des trois villes des Pouilles (règle 8 de CLAUDE.md) : le temps jusqu'à la fin de
// l'écran de chargement, page par page, une partie neuve à chaque fois (rien de l'acte ne doit
// naître avant). Pour l'avant/après, le lancer deux fois en échangeant les fichiers (cf.
// PROMPT-REPRISE.md § 5, « mesurer en A/B entrelacé »).
//
//   bancs/tour.sh node bancs/acte4-charge.mjs [étiquette]
import { navigateur, ORIGINE } from './acte1-outils.mjs';

const { b, page, erreurs } = await navigateur();
const res = {};
for (const V of ['alberobello', 'gallipoli', 'matera']) {
  await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
  const t0 = Date.now();
  await page.goto(`${ORIGINE}/${V}.html`);
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 100 });
  res[V] = +((Date.now() - t0) / 1000).toFixed(1);
}
console.log((process.argv[2] || '') + ' ' + JSON.stringify(res) + ' Σ ' + Object.values(res).reduce((a, x) => a + x, 0).toFixed(1) + ' s' + (erreurs.filter((e) => /PAGEERROR/.test(e)).length ? ' ERREURS' : ''));
await b.close();
